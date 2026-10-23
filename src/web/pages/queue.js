// หน้า "คิววันนี้": อนุมัติ/โพสต์เพจ + คิวโพสต์ลงกลุ่ม + ปุ่มสร้างโพสต์ของวัน
import { env } from '../../env.js';
import { loadGroups } from '../../config.js';
import { today, addDays, slotLabel } from '../../time.js';
import * as db from '../../db.js';
import { publishPost, startGenerate, jobState } from '../../jobs.js';
import { esc, badge, btn, layout } from '../ui.js';
import { STATUS, ITEM, MODE, mediaUrl, redirect } from './shared.js';

function renderItem(item, post, group, csrf) {
  const img = item.mode === 'soft' && post.softImageUrl ? post.softImageUrl : post.imageUrl;
  const open = item.status === 'queued' || item.status === 'waiting';
  return `<div class="item ${item.status}" id="item-${item.id}">
    <div class="head"><h3>${esc(group?.name ?? item.group_id)}</h3>${badge([MODE[item.mode], 'info'])}${badge(ITEM[item.status])}</div>
    ${group?.rules ? `<p class="muted">กฎกลุ่ม: ${esc(group.rules)}</p>` : ''}
    <textarea id="t-${item.id}" rows="7" readonly>${esc(item.text)}</textarea>
    <div class="actions">
      <button type="button" onclick="copyText('t-${item.id}')">คัดลอกข้อความ</button>
      <a class="button" href="${img}" download="strata-${post.date}-${post.slot}-${item.group_id}.png">ดาวน์โหลดภาพ</a>
      ${post.permalink ? `<input type="hidden" id="l-${item.id}" value="${esc(post.permalink)}"><button type="button" onclick="copyText('l-${item.id}')">คัดลอกลิงก์โพสต์เพจ</button>` : ''}
      ${group?.url ? `<button type="button" class="primary" onclick="copyOpen('t-${item.id}', ${esc(JSON.stringify(group.url))})">คัดลอก + เปิดกลุ่ม ↗</button>` : ''}
      ${open
        ? btn(`/item/${item.id}/done`, 'โพสต์แล้ว ✓', { csrf }) + btn(`/item/${item.id}/skip`, 'ข้าม', { csrf })
        : btn(`/item/${item.id}/undo`, 'ย้อนกลับ', { csrf })}
    </div></div>`;
}

function renderPost(post, groups, csrf) {
  const actions = [];
  if (post.status === 'pending_approval') actions.push(btn(`/post/${post.id}/approve`, 'อนุมัติ (โพสต์ตามเวลา)', { csrf, tone: 'primary' }));
  if (['pending_approval', 'approved', 'failed'].includes(post.status)) {
    actions.push(btn(`/post/${post.id}/publish`, post.status === 'failed' ? 'ลองโพสต์อีกครั้ง' : 'โพสต์ลงเพจทันที', { csrf, confirm: 'โพสต์ลงเพจตอนนี้เลยไหม?' }));
  }
  if (!['published', 'skipped'].includes(post.status)) actions.push(btn(`/post/${post.id}/skip`, 'ข้ามโพสต์นี้', { csrf, tone: 'danger', confirm: 'ข้ามโพสต์นี้?' }));
  const groupOf = (id) => groups.find((g) => g.id === id);
  return `<section class="card" id="post-${post.id}">
    <div class="head"><h2>${esc(slotLabel(post.slot))} · ${esc(post.topic)}</h2>
      ${badge([post.pillar + (post.is_promo ? ' · โปรโมท' : ''), 'info'])}${badge(STATUS[post.status] ?? [post.status, 'mute'])}</div>
    <div class="post">
      <div><img src="${post.imageUrl}" alt="">${post.softImageUrl ? `<p class="muted">ภาพแบบไม่ขาย (กลุ่มที่ห้ามขาย)</p><img src="${post.softImageUrl}" alt="">` : ''}</div>
      <div><pre id="c-${post.id}">${esc(post.caption)}</pre>
        ${post.error ? `<p class="bad">${esc(post.error)}</p>` : ''}
        ${post.permalink ? `<p><a href="${esc(post.permalink)}" target="_blank" rel="noopener">ดูโพสต์บนเพจ ↗</a></p>` : ''}
        <div class="actions">${actions.join('')}
          <a class="button" href="/post/${post.id}">แก้ไข</a>
          <button type="button" onclick="copyText('c-${post.id}')">คัดลอกแคปชัน</button></div>
        ${env.requireApproval && post.status === 'pending_approval' ? '<p class="muted">โหมดอนุมัติเปิดอยู่: ถ้าไม่อนุมัติก่อนเวลา ระบบจะไม่โพสต์</p>' : ''}
      </div>
    </div>
    ${post.items.length ? `<div class="items">${post.items.map((it) => renderItem(it, post, groupOf(it.group_id), csrf)).join('')}</div>` : ''}
  </section>`;
}

export function jobBanner() {
  const j = jobState();
  const steps = j.steps.length
    ? `<ol class="steps">${j.steps.map((s, i) => `<li>${esc(s)}${j.running && i === j.steps.length - 1 ? ' …' : ' ✓'}</li>`).join('')}</ol>`
    : '';
  if (j.running) return `<div class="flash info">⏳ ${esc(j.label)} (หน้านี้จะรีเฟรชเอง)${steps}</div>`;
  if (j.finishedAt && j.error) return `<div class="flash bad">งาน "${esc(j.label)}" ล้มเหลว: ${esc(j.error)}${steps}</div>`;
  if (j.finishedAt && Date.now() - Date.parse(j.finishedAt) < 10 * 60_000) {
    return `<div class="flash ok">เสร็จแล้ว: ${esc(j.label)}${j.summary ? `\n${esc(j.summary)}` : ''}${j.url ? `\n<a href="${esc(j.url)}">เปิดดู →</a>` : ''}</div>`;
  }
  return '';
}

function queuePage(ctx) {
  const q = ctx.query.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today();
  const posts = db.postsForDate(date).map((post) => ({
    ...post,
    imageUrl: mediaUrl(post.image_path),
    softImageUrl: mediaUrl(post.soft_image_path),
    items: db.itemsForPost(post.id),
  }));
  const groups = loadGroups();
  const pending = posts.reduce((n, p) => n + p.items.filter((i) => i.status === 'queued').length, 0);
  const running = jobState().running;
  const genBtn = posts.length < 2 && date >= today()
    ? `<div class="card"><p>${posts.length ? 'ยังสร้างไม่ครบ 2 รอบ' : 'ยังไม่มีโพสต์ของวันนี้'} — ปกติระบบสร้างให้เองตอน 07:00</p>
       <div class="actions">${btn('/generate', running ? 'กำลังสร้าง…' : 'สร้างโพสต์ของวันนี้ด้วย AI', { csrf: ctx.csrf, tone: 'primary', fields: { date } })}</div></div>`
    : '';
  return {
    html: layout({
      title: `Strata · ${date}`, active: 'queue', flash: ctx.flash, refresh: running ? 10 : 0,
      body: `${jobBanner(ctx.csrf)}
        <div class="head"><h1 style="margin:0 auto 0 0">คิวโพสต์ ${esc(date)}${date === today() ? ' (วันนี้)' : ''}</h1>
          <a class="button" href="/?date=${addDays(date, -1)}">‹ วันก่อน</a><a class="button" href="/?date=${addDays(date, 1)}">วันถัดไป ›</a>
          ${pending ? badge([`รอโพสต์ในกลุ่ม ${pending}`, 'warn']) : ''}</div>
        ${genBtn}
        ${posts.map((p) => renderPost(p, groups, ctx.csrf)).join('') || (genBtn ? '' : '<div class="empty">ไม่มีโพสต์ของวันนี้</div>')}`,
    }),
  };
}

const back = (ctx, hash = '') => {
  const ref = ctx.req.headers.referer;
  try {
    const u = new URL(ref);
    return `${u.pathname}${u.search.replace(/[?&](ok|err)=[^&]*/g, '')}${hash}`;
  } catch {
    return `/${hash}`;
  }
};

export const routes = [
  ['GET', /^\/$/, queuePage],
  ['POST', /^\/post\/(\d+)\/(approve|publish|skip)$/, async (ctx, [, id, action]) => {
    const post = db.getPost(Number(id));
    if (!post) return redirect('/', { err: 'ไม่พบโพสต์' });
    if (action === 'approve' && post.status === 'pending_approval') db.updatePost(post.id, { status: 'approved' });
    if (action === 'skip' && post.status !== 'published') db.updatePost(post.id, { status: 'skipped' });
    if (action === 'publish' && ['pending_approval', 'approved', 'failed'].includes(post.status)) {
      if (post.status !== 'approved') db.updatePost(post.id, { status: 'approved' });
      const r = await publishPost(post.id);
      return redirect(back(ctx), r?.status === 'published' ? { ok: 'โพสต์ลงเพจแล้ว' } : { err: r?.error ?? 'โพสต์ไม่สำเร็จ' });
    }
    return { redirect: back(ctx) };
  }],
  ['POST', /^\/item\/(\d+)\/(done|skip|undo)$/, (ctx, [, id, action]) => {
    if (!db.getItem(Number(id))) return redirect('/', { err: 'ไม่พบรายการ' });
    db.setItemStatus(Number(id), { done: 'done', skip: 'skipped', undo: 'queued' }[action]);
    return { redirect: back(ctx, `#item-${id}`) };
  }],
  ['POST', /^\/generate$/, (ctx) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(ctx.form.date ?? '') ? ctx.form.date : today();
    try {
      startGenerate(date);
    } catch (e) {
      return redirect(`/?date=${date}`, { err: e.message });
    }
    return { redirect: `/?date=${date}` };
  }],
];
