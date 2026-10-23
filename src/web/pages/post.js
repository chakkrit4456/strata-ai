// หน้าแก้ไขโพสต์: แคปชัน, ข้อความในภาพ (render ใหม่), ข้อความแต่ละกลุ่ม, สร้างรอบนี้ใหม่ด้วย AI
import { loadBrand, loadGroups } from '../../config.js';
import { slotLabel } from '../../time.js';
import * as db from '../../db.js';
import { savePostEdits, startRegenerate, postWarnings, jobState } from '../../jobs.js';
import { esc, badge, btn, layout, field, area, select, csrfInput, lines } from '../ui.js';
import { STATUS, ITEM, MODE, mediaUrl, redirect } from './shared.js';

function editPage(ctx, post) {
  const items = db.itemsForPost(post.id);
  const groups = loadGroups();
  const img = JSON.parse(post.image_json || '{}');
  const locked = post.status === 'published';
  const warnings = postWarnings(post, items);
  const pkgs = loadBrand().packages.map((p) => [p.id, p.name]);
  const dis = locked ? ' disabled' : '';
  return {
    html: layout({
      title: `แก้โพสต์ ${post.date}`, active: 'history', flash: ctx.flash,
      body: `<div class="head"><h1 style="margin:0 auto 0 0">${esc(slotLabel(post.slot))} ${esc(post.date)}</h1>
        ${badge([post.pillar + (post.is_promo ? ' · โปรโมท' : ''), 'info'])}${badge(STATUS[post.status] ?? [post.status, 'mute'])}
        <a class="button" href="/?date=${esc(post.date)}">ไปที่คิววันนั้น</a></div>
      ${warnings.length ? `<div class="flash warn">ตัวตรวจเนื้อหาพบ ${warnings.length} ข้อ (บันทึกได้ แต่ควรดูก่อน):\n• ${warnings.map(esc).join('\n• ')}</div>` : ''}
      ${locked ? '<div class="flash info">โพสต์นี้ลงเพจแล้ว แก้แคปชันและภาพไม่ได้ (แก้ที่ Facebook โดยตรง) แต่ยังแก้ข้อความของกลุ่มได้</div>' : ''}
      <form method="post" action="/post/${post.id}/save">${csrfInput(ctx.csrf)}
        <section class="card"><div class="post">
          <div><img class="preview" src="${mediaUrl(post.image_path)}" alt="">
            ${post.soft_image_path ? `<p class="muted">ภาพแบบไม่ขาย</p><img class="preview" src="${mediaUrl(post.soft_image_path)}" alt="">` : ''}</div>
          <div>
            ${field('หัวข้อ', 'topic_ro', post.topic, { attrs: 'disabled' })}
            ${area('แคปชันโพสต์เพจ', 'caption', post.caption, { rows: 12 })}
          </div></div></section>
        <section class="card"><h2 style="margin-top:0">ข้อความในภาพ</h2>
          <p class="muted">ถ้าแก้ส่วนนี้ ระบบจะทำภาพใหม่ให้ตอนบันทึก · ใส่ | ใน headline เพื่อให้ส่วนท้ายเป็นสีเขียว</p>
          <fieldset style="border:0;padding:0;margin:0"${dis}>
          <div class="grid2">${field('ป้ายมุมขวา (kicker)', 'img_kicker', img.kicker)}${field('ข้อความท้ายภาพ (cta)', 'img_cta', img.cta)}</div>
          ${field('หัวเรื่อง (headline)', 'img_headline', img.headline)}
          ${field('คำอธิบาย (subhead)', 'img_subhead', img.subhead)}
          <div class="grid2">${area('bullets (บรรทัดละ 1, ไม่เกิน 4)', 'img_bullets', (img.bullets ?? []).join('\n'), { rows: 4 })}
          ${area('ตัวเลือกโพล (เฉพาะเทมเพลต question)', 'img_options', (img.options ?? []).join('\n'), { rows: 4 })}</div>
          ${area('โค้ด/คำสั่ง (เฉพาะเทมเพลต tip)', 'img_code', img.code, { rows: 4, mono: true })}
          ${select('แพ็กเกจในภาพ (เฉพาะเทมเพลต package)', 'img_packageId', img.packageId ?? 'all', [['all', 'ทั้งหมด'], ...pkgs])}
          </fieldset></section>
        <section class="card"><h2 style="margin-top:0">ข้อความสำหรับแต่ละกลุ่ม</h2>
          ${items.map((it) => `<div class="item" style="margin-bottom:12px"><div class="head"><h3>${esc(groups.find((g) => g.id === it.group_id)?.name ?? it.group_id)}</h3>
            ${badge([MODE[it.mode], 'info'])}${badge(ITEM[it.status])}</div>
            <textarea name="item_${it.id}" rows="8">${esc(it.text)}</textarea></div>`).join('') || '<p class="muted">ไม่มีกลุ่มในรอบนี้</p>'}
        </section>
        <div class="actions"><button class="primary">บันทึก${locked ? '' : ' (ทำภาพใหม่ถ้าข้อความในภาพเปลี่ยน)'}</button><a class="button" href="/?date=${esc(post.date)}">กลับ</a></div>
      </form>
      ${locked ? '' : `<section class="card" style="margin-top:20px"><h2 style="margin-top:0">พร้อมแล้ว?</h2>
        <div class="actions">${btn(`/post/${post.id}/publish`, 'ยืนยันโพสต์ลงเพจตอนนี้', { csrf: ctx.csrf, tone: 'primary', confirm: 'บันทึกการแก้ไขก่อนแล้วหรือยัง? โพสต์ลงเพจตอนนี้เลยไหม?' })}
        ${btn(`/post/${post.id}/delete`, 'ลบร่างนี้', { csrf: ctx.csrf, tone: 'danger', confirm: 'ลบร่างนี้ทิ้ง? (กู้คืนไม่ได้)' })}</div></section>
      <section class="card"><h2 style="margin-top:0">ไม่ชอบทั้งโพสต์?</h2>
        <p class="muted">ทิ้งโพสต์รอบนี้และข้อความกลุ่มทั้งหมด แล้วให้ AI คิดหัวข้อและเขียนใหม่ (ใช้เวลาประมาณ 1–2 นาที)</p>
        ${btn(`/post/${post.id}/regenerate`, jobState().running ? 'มีงานกำลังทำอยู่…' : 'สร้างรอบนี้ใหม่ด้วย AI', { csrf: ctx.csrf, tone: 'danger', confirm: 'ทิ้งโพสต์นี้แล้วให้ AI เขียนใหม่?' })}</section>`}`,
    }),
  };
}

export const routes = [
  ['GET', /^\/post\/(\d+)$/, (ctx, [, id]) => {
    const post = db.getPost(Number(id));
    return post ? editPage(ctx, post) : redirect('/history', { err: 'ไม่พบโพสต์ (อาจถูกสร้างใหม่แล้ว)' });
  }],
  ['POST', /^\/post\/(\d+)\/save$/, async (ctx, [, id]) => {
    const f = ctx.form;
    const items = Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('item_')).map(([k, v]) => [Number(k.slice(5)), v]));
    const image = f.img_headline === undefined ? null : {
      kicker: String(f.img_kicker ?? '').trim(),
      headline: String(f.img_headline ?? '').trim(),
      subhead: String(f.img_subhead ?? '').trim(),
      bullets: lines(f.img_bullets).slice(0, 5),
      options: lines(f.img_options).slice(0, 4),
      code: String(f.img_code ?? '').replace(/\r\n/g, '\n').trimEnd(),
      cta: String(f.img_cta ?? '').trim(),
      packageId: String(f.img_packageId ?? 'all'),
    };
    try {
      const r = await savePostEdits(Number(id), { caption: f.caption, image, items });
      return redirect(`/post/${id}`, { ok: r.rerendered ? 'บันทึกแล้ว และทำภาพใหม่แล้ว' : 'บันทึกแล้ว' });
    } catch (e) {
      return redirect(`/post/${id}`, { err: e.message });
    }
  }],
  ['POST', /^\/post\/(\d+)\/regenerate$/, (ctx, [, id]) => {
    const post = db.getPost(Number(id));
    try {
      startRegenerate(Number(id));
    } catch (e) {
      return redirect(`/post/${id}`, { err: e.message });
    }
    return redirect('/drafts', { ok: 'กำลังให้ AI เขียนใหม่…' });
  }],
];
