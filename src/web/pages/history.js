// หน้า "โพสต์/ประวัติ" และ "Log"
import { readPillars } from '../../config.js';
import { SLOT_LABEL } from '../../time.js';
import * as db from '../../db.js';
import { esc, badge, layout, select } from '../ui.js';
import { STATUS } from './shared.js';

const PAGE_SIZE = 30;

function historyPage(ctx) {
  const status = STATUS[ctx.query.get('status')] ? ctx.query.get('status') : '';
  const pillar = /^[a-z0-9-]+$/.test(ctx.query.get('pillar') ?? '') ? ctx.query.get('pillar') : '';
  const page = Math.max(1, Number(ctx.query.get('page')) || 1);
  const { total, rows } = db.listPosts({ status, pillar, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  let pillarOpts = [];
  try { pillarOpts = readPillars().pillars.map((p) => [p.id, p.label]); } catch { /* แสดงหน้าได้แม้ config เสีย */ }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (n) => `?${new URLSearchParams({ ...(status && { status }), ...(pillar && { pillar }), page: n })}`;

  const body = rows.map((p) => `<tr>
    <td>${esc(p.date)}<div class="muted">${esc(SLOT_LABEL[p.slot])}</div></td>
    <td><a href="/post/${p.id}">${esc(p.topic)}</a><div class="muted">${esc(p.pillar)}${p.is_promo ? ' · โปรโมท' : ''}</div></td>
    <td>${badge(STATUS[p.status] ?? [p.status, 'mute'])}</td>
    <td>${p.items_done} / ${p.items_total}</td>
    <td>${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener">เปิด ↗</a>` : ''}</td></tr>`).join('');

  return {
    html: layout({
      title: 'โพสต์/ประวัติ', active: 'history', flash: ctx.flash,
      body: `<h1>โพสต์ทั้งหมด <span class="muted">(${total})</span></h1>
      <form method="get" class="card"><div class="grid3">
        ${select('สถานะ', 'status', status, [['', 'ทั้งหมด'], ...Object.entries(STATUS).map(([k, [t]]) => [k, t])])}
        ${select('หมวด', 'pillar', pillar, [['', 'ทั้งหมด'], ...pillarOpts])}
        <div class="field"><span>&nbsp;</span><button class="primary">กรอง</button></div></div></form>
      <div class="card scroll"><table class="table"><thead><tr><th>วันที่</th><th>หัวข้อ</th><th>สถานะเพจ</th><th>กลุ่มที่โพสต์</th><th>บนเพจ</th></tr></thead>
        <tbody>${body || '<tr><td colspan="5" class="empty">ยังไม่มีโพสต์</td></tr>'}</tbody></table></div>
      ${pages > 1 ? `<div class="actions">${page > 1 ? `<a class="button" href="${qs(page - 1)}">‹ ก่อนหน้า</a>` : ''}
        <span class="muted">หน้า ${page} / ${pages}</span>${page < pages ? `<a class="button" href="${qs(page + 1)}">ถัดไป ›</a>` : ''}</div>` : ''}`,
    }),
  };
}

function logsPage(ctx) {
  const rows = db.recentRuns(200).map((r) => `<tr>
    <td class="mono">${esc(r.created_at.replace('T', ' ').slice(0, 19))}</td><td>${esc(r.job)}</td>
    <td>${badge(r.ok ? ['สำเร็จ', 'ok'] : ['ล้มเหลว', 'bad'])}</td>
    <td class="mono" style="max-width:520px;word-break:break-word">${esc(r.detail)}</td></tr>`).join('');
  return {
    html: layout({
      title: 'Log', active: 'logs', flash: ctx.flash,
      body: `<h1>Log การทำงาน</h1><p class="muted">200 รายการล่าสุด (เวลา UTC) — log ละเอียดดูบนเซิร์ฟเวอร์ด้วย <span class="mono">journalctl -u 'strata-*'</span></p>
      <div class="card scroll"><table class="table"><thead><tr><th>เวลา</th><th>งาน</th><th>ผล</th><th>รายละเอียด</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="empty">ยังไม่มี log</td></tr>'}</tbody></table></div>`,
    }),
  };
}

export const routes = [
  ['GET', /^\/history$/, historyPage],
  ['GET', /^\/logs$/, logsPage],
];
