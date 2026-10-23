// หน้า "กลุ่ม": เพิ่ม/แก้/เปิดปิด/ลบกลุ่ม Facebook (บันทึกลง config/groups.yaml)
import { loadGroups, saveGroups, groupsFileExists, WEEKDAYS, parseGroupImport, canonicalGroupUrl, groupIdFromUrl } from '../../config.js';
import { BOOKMARKLET } from '../bookmarklet.js';
import * as db from '../../db.js';
import { esc, badge, btn, layout, field, area, select, check, csrfInput } from '../ui.js';
import { PROMO, DAY_LABEL, redirect } from './shared.js';

const DAYS = [...WEEKDAYS.slice(1), 'sun'];

function listPage(ctx) {
  const groups = loadGroups();
  const stats = Object.fromEntries(db.groupStats().map((s) => [s.group_id, s]));
  const rows = groups.map((g) => {
    const s = stats[g.id] ?? {};
    const promo = g.promo === 'days' ? `${PROMO.days}: ${g.promoDays.map((d) => DAY_LABEL[d]).join(' ')}` : PROMO[g.promo];
    return `<tr>
      <td><a href="/groups/${esc(g.id)}">${esc(g.name)}</a><div class="muted">${esc(g.id)}</div></td>
      <td>${esc(promo)}</td><td>${g.maxPerDay}</td>
      <td>${s.done ?? 0} / ข้าม ${s.skipped ?? 0}${s.last_done ? `<div class="muted">ล่าสุด ${esc(s.last_done.slice(0, 10))}</div>` : ''}</td>
      <td>${badge(g.enabled ? ['เปิด', 'ok'] : ['พักไว้', 'mute'])}</td>
      <td><div class="actions" style="margin:0">${btn(`/groups/${g.id}/toggle`, g.enabled ? 'พัก' : 'เปิด', { csrf: ctx.csrf })}
        <a class="button" href="/groups/${esc(g.id)}">แก้ไข</a></div></td></tr>`;
  }).join('');
  return {
    html: layout({
      title: 'กลุ่ม', active: 'groups', flash: ctx.flash,
      body: `<div class="head"><h1 style="margin:0 auto 0 0">กลุ่ม Facebook</h1><a class="button primary" href="/groups/import">⬇ นำเข้ากลุ่มที่ฉันเป็นสมาชิก</a><a class="button" href="/groups/new">+ เพิ่มทีละกลุ่ม</a></div>
        ${groupsFileExists() ? '' : '<div class="flash info">ตอนนี้ยังใช้รายชื่อกลุ่มตัวอย่าง — แก้หรือเพิ่มกลุ่มครั้งแรกจะสร้างไฟล์ groups.yaml ของจริงให้</div>'}
        <div class="card scroll"><table class="table"><thead><tr><th>กลุ่ม</th><th>โปรโมท</th><th>ต่อวัน</th><th>โพสต์แล้ว</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="empty">ยังไม่มีกลุ่ม</td></tr>'}</tbody></table></div>
        <p class="muted">เริ่มจาก 3–5 กลุ่มที่เป็นสมาชิกอยู่แล้ว อ่านกฎกลุ่มก่อนเสมอ แล้วใส่กฎสำคัญไว้ในช่อง "กฎกลุ่ม" ให้ AI ทำตาม</p>`,
    }),
  };
}

function formPage(ctx, g, { isNew, error } = {}) {
  return {
    status: error ? 400 : 200,
    html: layout({
      title: isNew ? 'เพิ่มกลุ่ม' : `แก้กลุ่ม ${g.name}`, active: 'groups', flash: error ? { err: error } : ctx.flash,
      body: `<h1>${isNew ? 'เพิ่มกลุ่ม' : `แก้กลุ่ม: ${esc(g.name)}`}</h1>
      <form method="post" action="/groups/save" class="card">${csrfInput(ctx.csrf)}
        <input type="hidden" name="original_id" value="${esc(isNew ? '' : g.originalId ?? g.id)}">
        <div class="grid2">
          ${field('ชื่อกลุ่ม', 'name', g.name, { required: true })}
          ${field('id (ภาษาอังกฤษ ไม่ซ้ำ)', 'id', g.id, { required: true, hint: 'ใช้ a-z 0-9 - เช่น webdev-th', attrs: 'pattern="[a-z0-9-]+"' })}
        </div>
        ${field('ลิงก์กลุ่ม', 'url', g.url, { type: 'url', hint: 'https://www.facebook.com/groups/...' })}
        ${area('สมาชิกในกลุ่มส่วนใหญ่เป็นใคร', 'audience', g.audience, { rows: 2, hint: 'AI ใช้ปรับโทนภาษาให้เข้ากับกลุ่ม' })}
        ${area('กฎกลุ่มที่เกี่ยวกับการโพสต์', 'rules', g.rules, { rows: 3, hint: 'เช่น ห้ามขายของ ยกเว้นวันเสาร์ / ห้ามแปะลิงก์' })}
        <div class="grid2">
          ${select('การโปรโมท', 'promo', g.promo, Object.entries(PROMO))}
          ${select('จำนวนโพสต์ต่อวัน', 'maxPerDay', g.maxPerDay, [[1, '1 โพสต์'], [2, '2 โพสต์']])}
        </div>
        <div class="field"><span>วันที่โปรโมทได้ (ใช้เมื่อเลือก "โปรโมทได้บางวัน")</span><div>
          ${DAYS.map((d) => check(DAY_LABEL[d], 'promoDays', g.promoDays.includes(d), { value: d })).join('')}</div></div>
        ${check('ใส่ลายเซ็นท้ายโพสต์สาย value ได้ ("— Strata dev")', 'signature', g.signature)}
        ${check('เปิดใช้งานกลุ่มนี้', 'enabled', g.enabled)}
        <div class="actions"><button class="primary">บันทึก</button><a class="button" href="/groups">ยกเลิก</a></div>
      </form>
      ${isNew ? '' : `<div class="card"><h2 style="margin-top:0">ลบกลุ่ม</h2><p class="muted">ประวัติคิวของกลุ่มนี้ยังเก็บไว้</p>
        ${btn(`/groups/${g.id}/delete`, 'ลบกลุ่มนี้', { csrf: ctx.csrf, tone: 'danger', confirm: `ลบกลุ่ม "${g.name}"?` })}</div>`}`,
    }),
  };
}

const fromForm = (f) => ({
  id: String(f.id ?? '').trim().toLowerCase(),
  name: f.name,
  url: f.url,
  audience: f.audience,
  rules: f.rules,
  promo: f.promo,
  promoDays: [].concat(f.promoDays ?? []),
  maxPerDay: Number(f.maxPerDay),
  signature: f.signature === '1',
  enabled: f.enabled === '1',
});

const EMPTY = { id: '', name: '', url: '', audience: '', rules: '', promo: 'never', promoDays: [], maxPerDay: 1, signature: true, enabled: true };

function importPage(ctx, { error, text = '' } = {}) {
  return {
    status: error ? 400 : 200,
    html: layout({
      title: 'นำเข้ากลุ่ม', active: 'groups', flash: error ? { err: error } : ctx.flash,
      body: `<h1>นำเข้ากลุ่มที่คุณเป็นสมาชิก</h1>
      <div class="flash info">Facebook ไม่อนุญาตให้โปรแกรมดึงรายชื่อกลุ่มของคุณโดยตรง จึงใช้ปุ่มช่วยเก็บรายชื่อจากหน้า "กลุ่มของคุณ" ในเบราว์เซอร์ของคุณเอง (ข้อมูลไม่ถูกส่งไปที่ไหน จนกว่าคุณจะวางในหน้านี้)</div>
      <section class="card"><h2 style="margin-top:0">วิธีที่ 1: ปุ่มเก็บรายชื่อกลุ่ม (แนะนำ บนคอมพิวเตอร์)</h2>
        <ol>
          <li>ลากปุ่มนี้ไปวางที่แถบบุ๊กมาร์กของเบราว์เซอร์ (ทำครั้งเดียว) →
            <a class="button primary" href="${esc(BOOKMARKLET)}" onclick="alert('ลากปุ่มนี้ไปวางที่แถบบุ๊กมาร์ก แล้วไปกดบนหน้ากลุ่มของคุณใน Facebook');return false">📋 เก็บรายชื่อกลุ่ม Strata</a></li>
          <li>เปิด <a href="https://www.facebook.com/groups/joins/" target="_blank" rel="noopener">facebook.com/groups/joins</a> (หน้า "กลุ่มของคุณ")</li>
          <li>กดบุ๊กมาร์ก "เก็บรายชื่อกลุ่ม Strata" → ระบบจะเลื่อนหน้าโหลดกลุ่มทั้งหมด แล้วกด <b>คัดลอก</b></li>
          <li>กลับมาวางในช่องด้านล่าง แล้วกด "ตรวจรายการ"</li>
        </ol></section>
      <section class="card"><h2 style="margin-top:0">วิธีที่ 2: วางลิงก์เอง (ใช้บนมือถือได้)</h2>
        <p class="muted">บรรทัดละกลุ่ม: <span class="mono">ชื่อกลุ่ม | https://www.facebook.com/groups/...</span> หรือวางแค่ลิงก์ก็ได้
          (ในแอป Facebook: เข้ากลุ่ม → แชร์ → คัดลอกลิงก์)</p></section>
      <form method="post" action="/groups/import" class="card">${csrfInput(ctx.csrf)}
        ${area('วางรายชื่อกลุ่มที่นี่', 'text', text, { rows: 8, required: true })}
        <div class="actions"><button class="primary">ตรวจรายการ</button><a class="button" href="/groups">กลับ</a></div></form>`,
    }),
  };
}

function confirmPage(ctx, found) {
  const existing = new Map(loadGroups().map((g) => [canonicalGroupUrl(g.url), g]));
  const rows = found.map((r, i) => {
    const dup = groupsFileExists() ? existing.get(r.url) : null;
    return `<tr class="${dup ? 'disabled' : ''}"><td><input type="checkbox" name="pick" value="${i}" class="grp"${dup ? ' disabled' : ' checked'}></td>
      <td><input name="name_${i}" value="${esc(r.name)}"${dup ? ' disabled' : ''}><input type="hidden" name="url_${i}" value="${esc(r.url)}">
        <div class="muted">${esc(r.url)}</div></td>
      <td>${dup ? badge([`มีแล้ว: ${dup.name}`, 'mute']) : badge(['ใหม่', 'ok'])}</td></tr>`;
  }).join('');
  return {
    html: layout({
      title: 'ยืนยันนำเข้ากลุ่ม', active: 'groups', flash: ctx.flash,
      body: `<h1>เจอ ${found.length} กลุ่ม</h1>
      <form method="post" action="/groups/import/save">${csrfInput(ctx.csrf)}<input type="hidden" name="count" value="${found.length}">
        <div class="card scroll">
          <label class="check"><input type="checkbox" checked onchange="document.querySelectorAll('.grp:not(:disabled)').forEach(c=>c.checked=this.checked)"> เลือกทั้งหมด</label>
          <table class="table"><thead><tr><th></th><th>ชื่อกลุ่ม (แก้ได้)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <section class="card">
          ${select('การโปรโมทของกลุ่มที่นำเข้า', 'promo', 'never', Object.entries(PROMO), { hint: 'แนะนำ "ห้ามขาย" ไว้ก่อน แล้วค่อยแก้ทีละกลุ่มตามกฎของกลุ่มนั้น' })}
          ${select('จำนวนโพสต์ต่อวัน', 'maxPerDay', 1, [[1, '1 โพสต์'], [2, '2 โพสต์']])}
          <p class="muted">กลุ่มที่นำเข้าจะเปิดใช้และเลือกได้ในหน้า "สร้างและโพสต์ทันที" ทันที อย่าลืมใส่กฎของแต่ละกลุ่มให้ AI ทำตาม</p>
          <div class="actions"><button class="primary">นำเข้ากลุ่มที่เลือก</button><a class="button" href="/groups/import">กลับ</a></div></section>
      </form>`,
    }),
  };
}

function saveImport(ctx) {
  const f = ctx.form;
  const picks = new Set([].concat(f.pick ?? []).map(Number));
  // ยังใช้ไฟล์ตัวอย่างอยู่ = เริ่มรายชื่อใหม่ ไม่เอากลุ่มตัวอย่างมาด้วย
  const groups = groupsFileExists() ? loadGroups() : [];
  const urls = new Set(groups.map((g) => canonicalGroupUrl(g.url)));
  const ids = new Set(groups.map((g) => g.id));
  let added = 0;
  for (let i = 0; i < Math.min(300, Number(f.count) || 0); i++) {
    if (!picks.has(i)) continue;
    const url = canonicalGroupUrl(f[`url_${i}`]);
    if (!url || urls.has(url)) continue;
    const id = groupIdFromUrl(url, ids);
    ids.add(id);
    urls.add(url);
    groups.push({
      id, url, name: String(f[`name_${i}`] ?? '').trim() || id,
      promo: f.promo, promoDays: f.promo === 'days' ? ['sat'] : [], maxPerDay: Number(f.maxPerDay), signature: true, enabled: true,
    });
    added += 1;
  }
  if (!added) return redirect('/groups/import', { err: 'ไม่ได้เลือกกลุ่มใหม่' });
  try {
    saveGroups(groups);
  } catch (e) {
    return redirect('/groups/import', { err: e.message });
  }
  return redirect('/groups', { ok: `นำเข้าแล้ว ${added} กลุ่ม — กด "แก้ไข" เพื่อใส่กฎของแต่ละกลุ่ม` });
}

export const routes = [
  // /groups/import ต้องมาก่อน /groups/:id เพราะ "import" ตรงรูปแบบ id ได้
  ['GET', /^\/groups\/import$/, (ctx) => importPage(ctx)],
  ['POST', /^\/groups\/import$/, (ctx) => {
    let found;
    try {
      found = parseGroupImport(ctx.form.text);
    } catch (e) {
      return importPage(ctx, { error: e.message, text: ctx.form.text });
    }
    if (!found.length) return importPage(ctx, { error: 'ไม่เจอลิงก์กลุ่ม Facebook ในข้อความที่วาง (ต้องเป็น facebook.com/groups/...)', text: ctx.form.text });
    return confirmPage(ctx, found.slice(0, 300));
  }],
  ['POST', /^\/groups\/import\/save$/, saveImport],
  ['GET', /^\/groups$/, listPage],
  ['GET', /^\/groups\/new$/, (ctx) => formPage(ctx, EMPTY, { isNew: true })],
  ['GET', /^\/groups\/([a-z0-9-]+)$/, (ctx, [, id]) => {
    const g = loadGroups().find((x) => x.id === id);
    return g ? formPage(ctx, g) : redirect('/groups', { err: 'ไม่พบกลุ่ม' });
  }],
  ['POST', /^\/groups\/save$/, (ctx) => {
    const g = fromForm(ctx.form);
    const original = String(ctx.form.original_id ?? '');
    const groups = loadGroups();
    try {
      if (original) {
        const i = groups.findIndex((x) => x.id === original);
        if (i < 0) throw new Error('ไม่พบกลุ่มเดิม');
        groups[i] = g;
      } else {
        if (groups.some((x) => x.id === g.id)) throw new Error(`id "${g.id}" มีอยู่แล้ว`);
        groups.push(g);
      }
      saveGroups(groups);
    } catch (e) {
      return formPage(ctx, { ...g, originalId: original }, { isNew: !original, error: e.message });
    }
    return redirect('/groups', { ok: `บันทึกกลุ่ม "${g.name}" แล้ว` });
  }],
  ['POST', /^\/groups\/([a-z0-9-]+)\/toggle$/, (ctx, [, id]) => {
    const groups = loadGroups();
    const g = groups.find((x) => x.id === id);
    if (!g) return redirect('/groups', { err: 'ไม่พบกลุ่ม' });
    g.enabled = !g.enabled;
    saveGroups(groups);
    return redirect('/groups', { ok: `${g.enabled ? 'เปิด' : 'พัก'}กลุ่ม "${g.name}" แล้ว` });
  }],
  ['POST', /^\/groups\/([a-z0-9-]+)\/delete$/, (ctx, [, id]) => {
    const groups = loadGroups();
    const g = groups.find((x) => x.id === id);
    if (!g) return redirect('/groups', { err: 'ไม่พบกลุ่ม' });
    saveGroups(groups.filter((x) => x.id !== id));
    return redirect('/groups', { ok: `ลบกลุ่ม "${g.name}" แล้ว` });
  }],
];
