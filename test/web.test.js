// เทส Dashboard + การบันทึกไฟล์ตั้งค่า โดยใช้โฟลเดอร์ชั่วคราว (ไม่แตะ config/.env จริง)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-web-'));
fs.cpSync(path.join(root, 'config'), path.join(tmp, 'config'), { recursive: true });
fs.rmSync(path.join(tmp, 'config', 'groups.yaml'), { force: true });
fs.writeFileSync(path.join(tmp, '.env'), '# comment stays\nGEMINI_API_KEY=old-secret-1234\nPUBLIC_URL=http://localhost:1\n');
Object.assign(process.env, {
  CONFIG_DIR: path.join(tmp, 'config'), ENV_FILE: path.join(tmp, '.env'), DATA_DIR: path.join(tmp, 'data'),
  DASHBOARD_PASSWORD: 'test-password-123', SESSION_SECRET: 'test-secret',
});

const { createServer } = await import('../src/web/server.js');
const config = await import('../src/config.js');
const { writeEnv } = await import('../src/envFile.js');
const { env } = await import('../src/env.js');

let server;
let base;
let cookie = '';

async function req(p, { method = 'GET', form } = {}) {
  const res = await fetch(base + p, {
    method, redirect: 'manual',
    headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: res.status, location: res.headers.get('location'), text: await res.text() };
}
const csrfOf = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows: ไฟล์ DB ยังเปิดอยู่ */ }
});

test('ต้องล็อกอินก่อน และรหัสผิดเข้าไม่ได้', async () => {
  assert.equal((await req('/groups')).location, '/login');
  assert.equal((await req('/login', { method: 'POST', form: { password: 'nope' } })).status, 401);
  const ok = await req('/login', { method: 'POST', form: { password: 'test-password-123' } });
  assert.equal(ok.status, 303);
  assert.equal((await req('/groups')).status, 200);
});

test('ทุกหน้าเปิดได้', async () => {
  for (const p of ['/', '/history', '/groups', '/groups/new', '/brand', '/brand/yaml', '/pillars', '/pillars/yaml', '/settings', '/logs']) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
  }
});

test('POST ที่ไม่มี CSRF token ถูกปฏิเสธ', async () => {
  const r = await req('/groups/save', { method: 'POST', form: { id: 'x', name: 'x' } });
  assert.equal(r.status, 403);
});

test('เพิ่มกลุ่มแล้วบันทึกลง groups.yaml', async () => {
  const csrf = csrfOf((await req('/groups/new')).text);
  const r = await req('/groups/save', {
    method: 'POST',
    form: [['_csrf', csrf], ['id', 'new-group'], ['name', 'กลุ่มใหม่'], ['url', 'https://www.facebook.com/groups/abc'], ['promo', 'days'],
      ['promoDays', 'sat'], ['promoDays', 'sun'], ['maxPerDay', '2'], ['enabled', '1']],
  });
  assert.equal(r.status, 303);
  const g = config.loadGroups().find((x) => x.id === 'new-group');
  assert.deepEqual(g.promoDays, ['sat', 'sun']);
  assert.equal(g.signature, false);
  assert.ok(config.groupsFileExists());
});

test('กลุ่มที่ลิงก์ผิดไม่ถูกบันทึก', async () => {
  const csrf = csrfOf((await req('/groups/new')).text);
  const r = await req('/groups/save', { method: 'POST', form: { _csrf: csrf, id: 'bad', name: 'x', url: 'https://evil.example/', promo: 'never', maxPerDay: '1' } });
  assert.equal(r.status, 400);
  assert.ok(!config.loadGroups().some((x) => x.id === 'bad'));
});

test('แก้ราคาแพ็กเกจผ่าน YAML แล้วราคาผิดถูกปฏิเสธ', async () => {
  const csrf = csrfOf((await req('/brand/yaml')).text);
  const b = config.loadBrand();
  b.packages[0].price = 1990;
  const YAML = (await import('yaml')).default;
  assert.equal((await req('/brand/yaml', { method: 'POST', form: { _csrf: csrf, yaml: YAML.stringify(b) } })).status, 303);
  assert.equal(config.loadBrand().packages[0].price, 1990);
  b.packages[0].price = -5;
  assert.equal((await req('/brand/yaml', { method: 'POST', form: { _csrf: csrf, yaml: YAML.stringify(b) } })).status, 400);
  assert.equal(config.loadBrand().packages[0].price, 1990);
});

test('ปิดหมวดแล้ว loadPillars ไม่เอาหมวดนั้น', () => {
  const cfg = config.readPillars();
  cfg.pillars.find((p) => p.id === 'fun').enabled = false;
  config.savePillars(cfg);
  assert.ok(!config.loadPillars().pillars.some((p) => p.id === 'fun'));
  assert.ok(config.readPillars().pillars.some((p) => p.id === 'fun'));
  cfg.pillars.forEach((p) => { if (p.kind === 'value') p.enabled = false; });
  assert.throws(() => config.savePillars(cfg), /value/);
});

test('writeEnv คงคอมเมนต์ แก้เฉพาะค่าที่ระบุ และโหลดค่าใหม่ทันที', () => {
  writeEnv({ GROQ_MODEL: 'some/model', TELEGRAM_CHAT_ID: '12345' });
  const s = fs.readFileSync(process.env.ENV_FILE, 'utf8');
  assert.match(s, /^# comment stays$/m);
  assert.match(s, /^GEMINI_API_KEY=old-secret-1234$/m);
  assert.match(s, /^GROQ_MODEL=some\/model$/m);
  assert.equal(env.groqModel, 'some/model');
  assert.throws(() => writeEnv({ X: 'a\nb' }));
});

test('หน้าตั้งค่าไม่ส่งคีย์จริงไปที่เบราว์เซอร์ และเว้นว่าง = ใช้ค่าเดิม', async () => {
  const page = await req('/settings');
  assert.ok(!page.text.includes('old-secret-1234'));
  assert.ok(page.text.includes('••••1234'));
  const r = await req('/settings/save', {
    method: 'POST',
    form: { _csrf: csrfOf(page.text), AI_PROVIDERS: 'groq,gemini', GEMINI_MODEL: 'g', GROQ_MODEL: 'q', OPENROUTER_MODEL: 'o:free', FB_PAGE_ID: '1393910303809343', FB_GRAPH_VERSION: 'v26.0', TELEGRAM_CHAT_ID: '', PUBLIC_URL: 'https://strata.example.com', GEMINI_API_KEY: '' },
  });
  assert.equal(r.status, 303);
  assert.equal(env.geminiKey, 'old-secret-1234');
  assert.deepEqual(env.aiProviders, ['groq', 'gemini']);
  assert.equal(env.requireApproval, false);
});

test('เปลี่ยนรหัสแล้ว session เดิมหลุด แต่คนเปลี่ยนยังอยู่ต่อได้', async () => {
  const oldCookie = cookie;
  const csrf = csrfOf((await req('/settings')).text);
  const r = await req('/settings/password', { method: 'POST', form: { _csrf: csrf, current: 'test-password-123', next: 'new-password-456' } });
  assert.equal(r.status, 303);
  assert.equal((await req('/settings')).status, 200);
  const saved = cookie;
  cookie = oldCookie;
  assert.equal((await req('/settings')).location, '/login');
  cookie = saved;
});
