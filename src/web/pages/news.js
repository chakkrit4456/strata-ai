// หน้า "ข่าว/เทรนด์": ข่าวล่าสุดที่ระบบดึงมา + จัดการแหล่งข่าว
import { loadNews, saveNews } from '../../config.js';
import { fetchAllNews } from '../../news/fetch.js';
import * as db from '../../db.js';
import { env } from '../../env.js';
import { esc, badge, btn, layout, field, area, select, check, csrfInput, lines } from '../ui.js';
import { redirect } from './shared.js';

const ago = (iso) => {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (!Number.isFinite(h)) return '';
  return h < 1 ? 'เมื่อสักครู่' : h < 24 ? `${h} ชม.ที่แล้ว` : `${Math.round(h / 24)} วันที่แล้ว`;
};

function page(ctx, { results } = {}) {
  const cfg = loadNews();
  const news = db.freshNews({ days: cfg.maxAgeDays, limit: 80, includeUsed: true });
  const rows = news.map((n) => `<tr>
    <td style="min-width:260px"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      ${n.summary ? `<div class="muted">${esc(n.summary.slice(0, 160))}</div>` : ''}</td>
    <td>${esc(n.source)}<div class="muted">${esc(ago(n.published_at ?? n.fetched_at))}</div></td>
    <td>${n.used_post_id ? `<a href="/post/${n.used_post_id}">${badge(['ใช้แล้ว', 'mute'])}</a>`
      : `<a class="button" href="/now?news=${encodeURIComponent(n.url)}">สร้างโพสต์จากข่าวนี้</a>`}</td></tr>`).join('');
  const feeds = cfg.feeds.map((f, i) => `<div class="grid3" style="align-items:end">
    <input type="hidden" name="f_${i}_id" value="${esc(f.id)}">
    ${field('ชื่อ', `f_${i}_name`, f.name)}${field('ลิงก์ RSS', `f_${i}_url`, f.url)}
    <div class="field">${select('ภาษา', `f_${i}_lang`, f.lang, [['th', 'ไทย'], ['en', 'อังกฤษ (AI สรุปเป็นไทย)']])}
      ${check('เปิดใช้', `f_${i}_enabled`, f.enabled)} ${check('ลบ', `f_${i}_delete`, false)}</div></div>`).join('');
  const resHtml = results ? `<div class="flash ${results.some((r) => !r.ok) ? 'warn' : 'ok'}">ดึงข่าวเสร็จ: ข่าวใหม่ ${results.reduce((n, r) => n + r.added, 0)} รายการ\n${
    results.map((r) => `${r.ok ? '✓' : '✗'} ${esc(r.source)} — ${r.ok ? `${r.found} ข่าว (ใหม่ ${r.added})` : esc(r.error)}`).join('\n')}</div>` : '';

  return {
    html: layout({
      title: 'ข่าว/เทรนด์', active: 'news', flash: ctx.flash,
      body: `${resHtml}<div class="head"><h1 style="margin:0 auto 0 0">ข่าว/เทรนด์ล่าสุด <span class="muted">(${news.length})</span></h1>
        ${btn('/news/fetch', 'ดึงข่าวตอนนี้', { csrf: ctx.csrf, tone: 'primary' })}</div>
      ${env.useNews ? '<p class="muted">ระบบดึงข่าวให้เองทุกเช้าก่อนสร้างโพสต์ และไม่ใช้ข่าวเดิมซ้ำ หมวด "ข่าว/เทรนด์ล่าสุด" เขียนจากข่าวเหล่านี้ หมวดอื่นหยิบมาเชื่อมได้ถ้าเข้ากับหัวข้อ</p>'
        : '<div class="flash warn">ปิดการใช้ข่าวอยู่ — เปิดได้ที่หน้า "ธีม"</div>'}
      <div class="card scroll"><table class="table"><thead><tr><th>ข่าว</th><th>แหล่ง</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="empty">ยังไม่มีข่าว — กด "ดึงข่าวตอนนี้"</td></tr>'}</tbody></table></div>
      <form method="post" action="/news/sources" class="card">${csrfInput(ctx.csrf)}
        <h2 style="margin-top:0">แหล่งข่าว</h2>${feeds}<input type="hidden" name="count" value="${cfg.feeds.length}">
        <h3>เพิ่มแหล่งข่าว (RSS)</h3>
        <div class="grid3">${field('ชื่อ', 'new_name', '')}${field('ลิงก์ RSS', 'new_url', '', { hint: 'เช่น https://example.com/feed' })}${select('ภาษา', 'new_lang', 'th', [['th', 'ไทย'], ['en', 'อังกฤษ']])}</div>
        ${area('คำค้น Google News (บรรทัดละ 1)', 'googleNews', cfg.googleNews.join('\n'), { rows: 5, hint: 'ค้นข่าวไทยล่าสุดตามคำเหล่านี้ เช่น "AI ธุรกิจ", "ขายของออนไลน์"' })}
        ${select('ใช้ข่าวย้อนหลังไม่เกิน', 'maxAgeDays', cfg.maxAgeDays, [1, 2, 3, 5, 7].map((d) => [d, `${d} วัน`]))}
        <div class="actions"><button class="primary">บันทึกแหล่งข่าว</button></div></form>`,
    }),
  };
}

export const routes = [
  ['GET', /^\/news$/, (ctx) => page(ctx)],
  ['POST', /^\/news\/fetch$/, async (ctx) => page(ctx, { results: await fetchAllNews() })],
  ['POST', /^\/news\/sources$/, (ctx) => {
    const f = ctx.form;
    const feeds = [];
    for (let i = 0; i < Math.min(50, Number(f.count) || 0); i++) {
      if (f[`f_${i}_delete`] === '1') continue;
      feeds.push({ id: f[`f_${i}_id`], name: f[`f_${i}_name`], url: String(f[`f_${i}_url`] ?? '').trim(), lang: f[`f_${i}_lang`], enabled: f[`f_${i}_enabled`] === '1' });
    }
    const newUrl = String(f.new_url ?? '').trim();
    if (newUrl) {
      const base = (String(f.new_name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feed').slice(0, 30);
      let id = base;
      for (let n = 2; feeds.some((x) => x.id === id); n++) id = `${base}-${n}`;
      feeds.push({ id, name: String(f.new_name ?? '').trim() || newUrl, url: newUrl, lang: f.new_lang, enabled: true });
    }
    try {
      saveNews({ maxAgeDays: Number(f.maxAgeDays), feeds, googleNews: lines(f.googleNews) });
    } catch (e) {
      return redirect('/news', { err: e.message });
    }
    return redirect('/news', { ok: 'บันทึกแหล่งข่าวแล้ว — กด "ดึงข่าวตอนนี้" เพื่อลองดึง' });
  }],
];
