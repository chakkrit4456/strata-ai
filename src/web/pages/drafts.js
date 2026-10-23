// หน้า "ร่างโพสต์": ทุกโพสต์ที่ยังไม่ลงเพจ แสดงครบทุกรายละเอียด แก้/อนุมัติ/โพสต์/เขียนใหม่/ลบได้
import { loadGroups, readPillars } from '../../config.js';
import { slotLabel } from '../../time.js';
import * as db from '../../db.js';
import { postWarnings, deleteDraft, jobState } from '../../jobs.js';
import { esc, badge, btn, layout } from '../ui.js';
import { STATUS, MODE, mediaUrl, redirect } from './shared.js';
import { jobBanner } from './queue.js';
import { getTheme, getTone } from '../../image/themes.js';

const WHEN = { morning: '09:20–09:40 น. (ถ้าอนุมัติแล้ว)', evening: '19:20–19:40 น. (ถ้าอนุมัติแล้ว)' };

function draftCard(post, { groups, pillars, csrf, running }) {
  const items = db.itemsForPost(post.id);
  const warnings = postWarnings(post, items);
  const pillar = pillars.find((p) => p.id === post.pillar);
  const img = JSON.parse(post.image_json || '{}');
  const name = (id) => groups.find((g) => g.id === id)?.name ?? id;
  const when = WHEN[post.slot] ?? 'เมื่อกด "โพสต์ตอนนี้"';
  return `<section class="card" id="draft-${post.id}">
    <div class="head"><h2>${esc(post.topic)}</h2>${badge(STATUS[post.status] ?? [post.status, 'mute'])}</div>
    <div class="post">
      <div><img class="preview" src="${mediaUrl(post.image_path)}" alt="">
        ${post.soft_image_path ? `<p class="muted">ภาพแบบไม่ขาย</p><img class="preview" src="${mediaUrl(post.soft_image_path)}" alt="">` : ''}</div>
      <div>
        <table class="table"><tbody>
          <tr><td class="muted">วันที่ / รอบ</td><td>${esc(post.date)} · ${esc(slotLabel(post.slot))}</td></tr>
          <tr><td class="muted">จะโพสต์ลงเพจ</td><td>${esc(when)}</td></tr>
          <tr><td class="muted">หมวด</td><td>${esc(pillar?.label ?? post.pillar)} ${post.is_promo ? badge(['โปรโมท', 'warn']) : badge(['ไม่ขาย', 'info'])}</td></tr>
          <tr><td class="muted">เขียนโดย</td><td>${esc(post.model ?? '-')}</td></tr>
          <tr><td class="muted">ธีม / สไตล์</td><td>${esc(getTheme(post.theme).name)} · ${esc(getTone(post.tone).name)}${post.bg_path ? ' · ภาพประกอบ AI' : ''}</td></tr>
          ${post.news_url ? `<tr><td class="muted">ข่าวที่ใช้</td><td><a href="${esc(post.news_url)}" target="_blank" rel="noopener">${esc(db.getNewsByUrl(post.news_url)?.title ?? post.news_url)} ↗</a></td></tr>` : ''}
          <tr><td class="muted">ข้อความในภาพ</td><td>${esc([img.kicker, img.headline?.replace('|', ''), img.subhead].filter(Boolean).join(' · '))}</td></tr>
        </tbody></table>
        ${post.error ? `<div class="flash bad">${esc(post.error)}</div>` : ''}
        ${warnings.length ? `<div class="flash warn">ตัวตรวจพบ ${warnings.length} ข้อ:\n• ${warnings.map(esc).join('\n• ')}</div>` : '<p class="ok">✓ ผ่านตัวตรวจเนื้อหา</p>'}
        <h3>แคปชันเพจ</h3><pre>${esc(post.caption)}</pre>
      </div>
    </div>
    <h3>ข้อความสำหรับกลุ่ม (${items.length})</h3>
    ${items.map((it) => `<details class="item" style="margin-bottom:8px"><summary><strong>${esc(name(it.group_id))}</strong> ${badge([MODE[it.mode], 'info'])}</summary><pre>${esc(it.text)}</pre></details>`).join('') || '<p class="muted">โพสต์ลงเพจอย่างเดียว</p>'}
    <div class="actions">
      <a class="button primary" href="/post/${post.id}">แก้ไข</a>
      ${post.status === 'pending_approval' ? btn(`/post/${post.id}/approve`, 'อนุมัติ (โพสต์ตามเวลา)', { csrf }) : ''}
      ${btn(`/post/${post.id}/publish`, 'โพสต์ลงเพจตอนนี้', { csrf, confirm: 'โพสต์ลงเพจตอนนี้เลยไหม?' })}
      ${btn(`/post/${post.id}/regenerate`, running ? 'มีงานกำลังทำอยู่…' : 'ให้ AI เขียนใหม่', { csrf, confirm: 'ทิ้งร่างนี้แล้วให้ AI เขียนใหม่?' })}
      ${btn(`/post/${post.id}/delete`, 'ลบร่าง', { csrf, tone: 'danger', confirm: 'ลบร่างนี้ทิ้ง? (กู้คืนไม่ได้)' })}
    </div>
  </section>`;
}

function draftsPage(ctx) {
  const posts = db.draftPosts(50);
  let pillars = [];
  try { pillars = readPillars().pillars; } catch { /* ไม่มีชื่อหมวดก็แสดง id แทน */ }
  const opts = { groups: loadGroups(), pillars, csrf: ctx.csrf, running: jobState().running };
  return {
    html: layout({
      title: 'ร่างโพสต์', active: 'drafts', flash: ctx.flash, refresh: jobState().running ? 10 : 0,
      body: `${jobBanner()}<div class="head"><h1 style="margin:0 auto 0 0">ร่างโพสต์ <span class="muted">(${posts.length})</span></h1>
        <a class="button primary" href="/now">⚡ สร้างและโพสต์ทันที</a></div>
        <p class="muted">โพสต์ที่ AI สร้างแล้วแต่ยังไม่ลงเพจ — ตรวจ แก้ อนุมัติ หรือลบทิ้งได้ที่นี่</p>
        ${posts.map((p) => draftCard(p, opts)).join('') || '<div class="empty">ไม่มีร่างค้างอยู่</div>'}`,
    }),
  };
}

export const routes = [
  ['GET', /^\/drafts$/, draftsPage],
  ['POST', /^\/post\/(\d+)\/delete$/, (ctx, [, id]) => {
    try {
      const post = deleteDraft(Number(id));
      return redirect('/drafts', { ok: `ลบร่าง "${post.topic}" แล้ว` });
    } catch (e) {
      return redirect('/drafts', { err: e.message });
    }
  }],
];
