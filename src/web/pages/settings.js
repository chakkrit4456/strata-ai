// หน้า "ตั้งค่า": ค่าระบบใน .env (คีย์แสดงแบบซ่อน), เปลี่ยนรหัส Dashboard, ทดสอบการเชื่อมต่อ
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env, ROOT } from '../../env.js';
import { writeEnv, maskSecret } from '../../envFile.js';
import { runHealth } from '../../health.js';
import { PROVIDER_NAMES } from '../../ai/providers.js';
import { sessionCookie } from '../server.js';
import { esc, badge, layout, field, check, csrfInput } from '../ui.js';
import { redirect } from './shared.js';

const SECRETS = [
  ['GEMINI_API_KEY', 'Gemini API key', 'geminiKey'],
  ['GROQ_API_KEY', 'Groq API key', 'groqKey'],
  ['OPENROUTER_API_KEY', 'OpenRouter API key', 'openrouterKey'],
  ['FB_PAGE_TOKEN', 'Facebook Page token', 'fbPageToken'],
  ['TELEGRAM_BOT_TOKEN', 'Telegram bot token', 'telegramToken'],
];

// เวลาโพสต์อ่านจากไฟล์ timer (แก้ได้บนเซิร์ฟเวอร์เท่านั้น เพราะต้องใช้สิทธิ์ root)
function timerSchedule() {
  const dir = path.join(ROOT, 'deploy', 'systemd');
  const read = (f) => {
    try {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const cal = s.match(/^OnCalendar=\S+ (\d{2}:\d{2})/m)?.[1] ?? '?';
      const delay = Number(s.match(/^RandomizedDelaySec=(\d+)min/m)?.[1] ?? 0);
      return delay ? `${cal} น. + สุ่มไม่เกิน ${delay} นาที` : `${cal} น.`;
    } catch {
      return '?';
    }
  };
  return [['สร้างโพสต์', read('strata-generate.timer')], ['โพสต์รอบเช้า', read('strata-publish-morning.timer')], ['โพสต์รอบเย็น', read('strata-publish-evening.timer')]];
}

function page(ctx, { health } = {}) {
  const secretRows = SECRETS.map(([key, label, prop]) => `<div class="item" style="margin-bottom:10px">
    <div class="grid2"><div>${field(label, key, '', { type: 'password', hint: env[prop] ? `ตั้งไว้แล้ว ${maskSecret(env[prop])} — เว้นว่างเพื่อใช้ค่าเดิม` : 'ยังไม่ได้ตั้ง', attrs: 'autocomplete="off"' })}</div>
    <div class="field"><span>&nbsp;</span>${env[prop] ? check('ลบค่านี้', `clear_${key}`, false) : ''}</div></div></div>`).join('');
  const healthHtml = health ? `<section class="card"><h2 style="margin-top:0">ผลทดสอบ</h2><table class="table"><tbody>
    ${health.map((r) => `<tr><td>${badge(r.warn ? ['โดนจำกัดชั่วคราว', 'warn'] : r.ok === null ? ['ไม่บังคับ', 'mute'] : r.ok ? ['ผ่าน', 'ok'] : ['ไม่ผ่าน', 'bad'])}</td><td>${esc(r.name)}</td><td class="muted">${esc(r.detail)}</td></tr>`).join('')}
    </tbody></table></section>` : '';

  return {
    html: layout({
      title: 'ตั้งค่า', active: 'settings', flash: ctx.flash,
      body: `<h1>ตั้งค่าระบบ</h1>${healthHtml}
      <form method="post" action="/settings/test" class="card">${csrfInput(ctx.csrf)}
        <h2 style="margin-top:0">ทดสอบการเชื่อมต่อ</h2><p class="muted">เช็คคีย์ AI ทุกเจ้า, Facebook token และส่งข้อความทดสอบเข้า Telegram (ใช้เวลาไม่เกิน 2 นาที)</p>
        <button class="primary">ทดสอบตอนนี้</button></form>
      <form method="post" action="/settings/save">${csrfInput(ctx.csrf)}
        <section class="card"><h2 style="margin-top:0">การโพสต์</h2>
          ${check('ต้องกดอนุมัติก่อนโพสต์ลงเพจ (แนะนำช่วงแรก)', 'REQUIRE_APPROVAL', env.requireApproval)}
          <table class="table" style="margin-top:8px"><tbody>${timerSchedule().map(([k, v]) => `<tr><td class="muted">${k}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
          <p class="muted">เวลาโพสต์แก้ได้ที่ deploy/systemd/*.timer บนเซิร์ฟเวอร์แล้วรัน install.sh ใหม่</p></section>
        <section class="card"><h2 style="margin-top:0">AI</h2>
          ${field('ลำดับที่ลอง (คั่นด้วย ,)', 'AI_PROVIDERS', env.aiProviders.join(','), { hint: `ใช้ได้: ${PROVIDER_NAMES.join(', ')} — ถ้าเจ้าแรกล่ม/โควตาหมด ระบบใช้เจ้าถัดไปเอง` })}
          <div class="grid3">${field('โมเดล Gemini', 'GEMINI_MODEL', env.geminiModel, { hint: 'ใส่หลายตัวคั่นด้วย , เพื่อเป็นตัวสำรอง' })}${field('โมเดล Groq', 'GROQ_MODEL', env.groqModel)}${field('โมเดล OpenRouter', 'OPENROUTER_MODEL', env.openrouterModel)}</div></section>
        <section class="card"><h2 style="margin-top:0">Facebook และ Telegram</h2>
          <div class="grid3">${field('Page ID (Graph API)', 'FB_PAGE_ID', env.fbPageId)}${field('Graph API version', 'FB_GRAPH_VERSION', env.fbGraphVersion)}${field('Telegram chat id', 'TELEGRAM_CHAT_ID', env.telegramChatId)}</div>
          ${field('ลิงก์ Dashboard สาธารณะ', 'PUBLIC_URL', env.publicUrl, { hint: 'ใช้ในข้อความแจ้งเตือน เช่น https://strata.itdev.in.th' })}</section>
        <section class="card"><h2 style="margin-top:0">คีย์และ token</h2><p class="muted">ค่าจริงไม่ถูกส่งมาที่เบราว์เซอร์ กรอกเฉพาะตัวที่ต้องการเปลี่ยน</p>${secretRows}</section>
        <div class="actions"><button class="primary">บันทึกการตั้งค่า</button></div>
      </form>
      <form method="post" action="/settings/password" class="card" style="margin-top:20px">${csrfInput(ctx.csrf)}
        <h2 style="margin-top:0">เปลี่ยนรหัส Dashboard</h2>
        <div class="grid2">${field('รหัสปัจจุบัน', 'current', '', { type: 'password', required: true })}${field('รหัสใหม่ (อย่างน้อย 10 ตัว)', 'next', '', { type: 'password', required: true, attrs: 'minlength="10"' })}</div>
        <button>เปลี่ยนรหัส</button></form>
      <p class="muted">ค่าที่ต้องรีสตาร์ทถึงจะมีผล (HOST, PORT, DATA_DIR, TIMEZONE) แก้ในไฟล์ .env บนเซิร์ฟเวอร์</p>`,
    }),
  };
}

// ใส่หลายโมเดลคั่นด้วย , ได้ (ตัวสำรองเมื่อตัวแรกโดนจำกัด)
const MODEL = /^[\w./:-]+(\s*,\s*[\w./:-]+){0,5}$/;

function fromForm(f) {
  const out = {};
  out.REQUIRE_APPROVAL = f.REQUIRE_APPROVAL === '1' ? 'true' : 'false';
  const providers = String(f.AI_PROVIDERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = providers.filter((p) => !PROVIDER_NAMES.includes(p));
  if (!providers.length || bad.length) throw new Error(`ลำดับ AI ไม่ถูกต้อง${bad.length ? `: ${bad.join(', ')}` : ''}`);
  out.AI_PROVIDERS = providers.join(',');
  for (const k of ['GEMINI_MODEL', 'GROQ_MODEL', 'OPENROUTER_MODEL']) {
    const v = String(f[k] ?? '').trim();
    if (!MODEL.test(v)) throw new Error(`${k}: ชื่อโมเดลไม่ถูกต้อง`);
    out[k] = v.split(',').map((x) => x.trim()).join(',');
  }
  const pageId = String(f.FB_PAGE_ID ?? '').trim();
  if (pageId && !/^\d{5,25}$/.test(pageId)) throw new Error('Page ID ต้องเป็นตัวเลข');
  out.FB_PAGE_ID = pageId;
  const ver = String(f.FB_GRAPH_VERSION ?? '').trim();
  if (!/^v\d{1,3}\.\d$/.test(ver)) throw new Error('Graph API version ต้องเป็นรูปแบบ v26.0');
  out.FB_GRAPH_VERSION = ver;
  const chat = String(f.TELEGRAM_CHAT_ID ?? '').trim();
  if (chat && !/^-?\d{3,20}$/.test(chat)) throw new Error('Telegram chat id ต้องเป็นตัวเลข');
  out.TELEGRAM_CHAT_ID = chat;
  const url = String(f.PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!/^https?:\/\/[^\s/]+$/.test(url)) throw new Error('ลิงก์ Dashboard ต้องเป็น https://โดเมน (ไม่มี path)');
  out.PUBLIC_URL = url;
  for (const [key] of SECRETS) {
    if (f[`clear_${key}`] === '1') out[key] = '';
    else {
      const v = String(f[key] ?? '').trim();
      if (v) {
        if (/\s/.test(v) || v.length > 500) throw new Error(`${key}: ค่าไม่ถูกต้อง`);
        out[key] = v;
      }
    }
  }
  return out;
}

export const routes = [
  ['GET', /^\/settings$/, (ctx) => page(ctx)],
  ['POST', /^\/settings\/save$/, (ctx) => {
    try {
      writeEnv(fromForm(ctx.form));
    } catch (e) {
      return redirect('/settings', { err: e.message });
    }
    return redirect('/settings', { ok: 'บันทึกการตั้งค่าแล้ว มีผลทันที' });
  }],
  ['POST', /^\/settings\/test$/, async (ctx) => page(ctx, { health: await runHealth({ telegramTest: true }) })],
  ['POST', /^\/settings\/password$/, (ctx) => {
    const { current = '', next = '' } = ctx.form;
    const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
    if (!crypto.timingSafeEqual(h(current), h(env.dashboardPassword))) return redirect('/settings', { err: 'รหัสปัจจุบันไม่ถูกต้อง' });
    if (String(next).length < 10 || /\s/.test(next)) return redirect('/settings', { err: 'รหัสใหม่ต้องยาวอย่างน้อย 10 ตัวและไม่มีช่องว่าง' });
    writeEnv({ DASHBOARD_PASSWORD: next });
    // รหัสเปลี่ยน → session เดิมใช้ไม่ได้ ออก cookie ใหม่ให้คนที่เปลี่ยนเอง
    return { ...redirect('/settings', { ok: 'เปลี่ยนรหัสแล้ว อุปกรณ์อื่นต้องล็อกอินใหม่' }), headers: { 'set-cookie': sessionCookie() } };
  }],
];
