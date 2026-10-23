import test from 'node:test';
import assert from 'node:assert/strict';
import { writeSlot, parseContent } from '../src/content/writer.js';
import { ProviderError } from '../src/ai/errors.js';
import { loadBrand } from '../src/config.js';

const brand = loadBrand();
const groups = [{ id: 'a', name: 'A', audience: '', rules: '', signature: true }];
const slotPlan = { slot: 'morning', isPromo: false, pillar: { id: 'tip', label: 'tip', brief: '', template: 'tip' }, groups: [{ groupId: 'a', mode: 'value' }] };
const history = { topics: [], captions: [] };
const img = { kicker: 'DEV TIP', headline: 'Backup ก่อนอัปเดต', subhead: '', bullets: [], code: '', options: [], cta: '', packageId: 'all' };
const good = JSON.stringify({
  topic: 'backup ฐานข้อมูล',
  caption: `${'เนื้อหาตัวอย่างที่ยาวพอสำหรับการทดสอบความยาวขั้นต่ำของระบบตรวจ '.repeat(3)}คุณทำยังไงกันบ้าง?`,
  hashtags: ['devtip'],
  image: img, softImage: img,
  variants: [{ groupId: 'a', text: 'สวัสดีชาว dev วันนี้มาแชร์วิธี backup ฐานข้อมูลแบบง่ายที่ใช้จริง ตั้ง cron ทุกคืน เก็บไฟล์ไว้นอกเครื่องอย่างน้อยหนึ่งชุด ใครมีเทคนิคเพิ่มเติมเล่าให้ฟังหน่อยครับ' }],
});
const bad = JSON.parse(good);
bad.caption = `${bad.caption} ลูกค้ากว่า 200 ราย`;

// provider ปลอม: ตอบตามลำดับที่กำหนด แต่ละค่าเป็นสตริง หรือ Error ที่จะโยน
const fake = (name, replies) => {
  const calls = [];
  return {
    name, model: `${name}-m`, calls,
    async generate(req) {
      calls.push(req);
      const r = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (r instanceof Error) throw r;
      return { text: r, model: `${name}-m` };
    },
  };
};
const run = (providers) => writeSlot({ date: '2026-10-24', slotPlan, groups, brand, history, providers });

test('เจ้าแรกโควตาหมด → ใช้เจ้าที่สอง', async () => {
  const a = fake('gemini', [new ProviderError('gemini', '429 quota', { status: 429 })]);
  const b = fake('groq', [good]);
  const r = await run([a, b]);
  assert.equal(r.provider, 'groq');
  assert.equal(a.calls.length, 1);
});

test('ตอบ JSON พัง → ข้ามไปเจ้าถัดไป', async () => {
  const a = fake('gemini', ['ขออภัย ไม่สามารถ...']);
  const b = fake('groq', [`\`\`\`json\n${good}\n\`\`\``]);
  const r = await run([a, b]);
  assert.equal(r.provider, 'groq');
});

test('ไม่ผ่าน guard → ส่งปัญหาให้แก้ในเจ้าเดิม', async () => {
  const a = fake('gemini', [JSON.stringify(bad), good]);
  const r = await run([a]);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.attempts, 2);
  assert.match(a.calls[1].messages.at(-1).content, /อ้างจำนวน/);
});

test('ไม่ผ่าน guard 2 ครั้ง → ไปเจ้าถัดไป', async () => {
  const a = fake('gemini', [JSON.stringify(bad)]);
  const b = fake('openrouter', [good]);
  const r = await run([a, b]);
  assert.equal(a.calls.length, 2);
  assert.equal(r.provider, 'openrouter');
  assert.equal(r.attempts, 3);
});

test('ทุกเจ้าล้มเหลว → error รวมเหตุผล', async () => {
  const a = fake('gemini', [new ProviderError('gemini', '503', { status: 503 })]);
  const b = fake('groq', [new ProviderError('groq', '401 bad key', { status: 401, fatal: true })]);
  await assert.rejects(run([a, b]), /gemini: 503.*groq: 401/);
});

test('ไม่มีคีย์สักเจ้า', async () => {
  await assert.rejects(run([]), /ยังไม่ได้ตั้งคีย์ AI/);
});

test('parseContent แก้ packageId และรวมแฮชแท็ก', () => {
  const c = parseContent(good.replace('"packageId":"all"', '"packageId":"xxx"'));
  assert.equal(c.image.packageId, 'all');
  assert.match(c.caption, /#devtip$/);
});
