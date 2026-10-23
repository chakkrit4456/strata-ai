// หน้า "ธีม": ดูตัวอย่างทุกธีม และตั้งค่าวิธีเลือกธีมของโพสต์อัตโนมัติ
import fs from 'node:fs';
import { env } from '../../env.js';
import { writeEnv } from '../../envFile.js';
import { THEMES, TONES, BRAND_THEME } from '../../image/themes.js';
import { ensureThemePreviews, previewFile } from '../../image/previews.js';
import { jobState, startJob } from '../../jobs.js';
import { esc, badge, btn, layout, select, csrfInput } from '../ui.js';
import { mediaUrl, redirect } from './shared.js';

const MODES = [
  ['mix', 'ผสม: ใช้ธีมเพจเป็นระยะ ที่เหลือสุ่มไม่ซ้ำ (แนะนำ)'],
  ['random', 'สุ่มธีมใหม่ทุกโพสต์ (ไม่ซ้ำ 3 โพสต์ล่าสุด)'],
  ['brand', 'ใช้ธีมเพจทุกโพสต์'],
];

function page(ctx) {
  const missing = THEMES.some((t) => !fs.existsSync(previewFile(t.id)));
  const cards = THEMES.map((t) => {
    const img = fs.existsSync(previewFile(t.id))
      ? `<img class="preview" src="${mediaUrl(previewFile(t.id))}" alt="" loading="lazy">`
      : `<div style="display:flex;height:120px;border-radius:6px;overflow:hidden">${['bg', 'panel', 'accent', 'accent2', 'text'].map((k) => `<i style="flex:1;background:${t.colors[k]}"></i>`).join('')}</div>`;
    return `<div class="item">${img}
      <div class="head" style="margin:8px 0 0"><strong style="margin-right:auto">${esc(t.name)}</strong>${t.id === BRAND_THEME ? badge(['ธีมเพจ', 'ok']) : ''}</div>
      <div class="muted">ฟอนต์ ${esc(t.font)} · ${esc(t.mood)}</div></div>`;
  }).join('');
  return {
    html: layout({
      title: 'ธีม', active: 'themes', flash: ctx.flash, refresh: jobState().running ? 8 : 0,
      body: `<h1>ธีมโพสต์</h1>
      <form method="post" action="/themes/save" class="card">${csrfInput(ctx.csrf)}
        <h2 style="margin-top:0">โพสต์อัตโนมัติรายวันเลือกธีมยังไง</h2>
        <div class="grid2">
          ${select('วิธีเลือกธีม', 'THEME_MODE', env.themeMode, MODES)}
          ${select('โหมดผสม: ใช้ธีมเพจทุกๆ', 'THEME_BRAND_EVERY', env.themeBrandEvery, [2, 3, 4, 5, 6].map((n) => [n, `${n} โพสต์`]))}
        </div>
        <label class="check"><input type="checkbox" name="AI_IMAGE" value="1"${env.aiImageProviders.length ? ' checked' : ''}> สร้างภาพประกอบด้วย AI ทุกโพสต์ (ฟรี)</label>
        <label class="check"><input type="checkbox" name="USE_NEWS" value="1"${env.useNews ? ' checked' : ''}> ดึงข่าวล่าสุดมาช่วยคิดโพสต์ให้ทันเทรนด์</label>
        <p class="muted">สไตล์คำบรรยายจะสลับให้อัตโนมัติไม่ซ้ำ 2 โพสต์ล่าสุด: ${TONES.map((t) => esc(t.name)).join(' · ')}</p>
        <p class="muted">ตอนกด "สร้างและโพสต์ทันที" หรือแก้โพสต์ เลือกได้เองทุกครั้ง: 🏠 ธีมเพจ / 🎲 สุ่มธีม / เลือกธีมเอง</p>
        <div class="actions"><button class="primary">บันทึก</button></div>
      </form>
      <section class="card"><div class="head"><h2 style="margin:0 auto 0 0">ธีมทั้งหมด (${THEMES.length})</h2>
        ${btn('/themes/previews', jobState().running ? 'มีงานกำลังทำอยู่…' : missing ? 'สร้างภาพตัวอย่าง' : 'สร้างภาพตัวอย่างใหม่', { csrf: ctx.csrf })}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">${cards}</div></section>`,
    }),
  };
}

export const routes = [
  ['GET', /^\/themes$/, page],
  ['POST', /^\/themes\/save$/, (ctx) => {
    const f = ctx.form;
    if (!MODES.some(([m]) => m === f.THEME_MODE)) return redirect('/themes', { err: 'วิธีเลือกธีมไม่ถูกต้อง' });
    const every = Number(f.THEME_BRAND_EVERY);
    if (!(every >= 2 && every <= 10)) return redirect('/themes', { err: 'จำนวนโพสต์ไม่ถูกต้อง' });
    writeEnv({
      THEME_MODE: f.THEME_MODE, THEME_BRAND_EVERY: String(every),
      AI_IMAGE_PROVIDERS: f.AI_IMAGE === '1' ? 'pollinations,gemini' : 'off',
      USE_NEWS: f.USE_NEWS === '1' ? 'true' : 'false',
    });
    return redirect('/themes', { ok: 'บันทึกแล้ว — โพสต์ถัดไปจะใช้ค่าใหม่' });
  }],
  ['POST', /^\/themes\/previews$/, () => {
    try {
      startJob('สร้างภาพตัวอย่างธีม', async (step) => {
        step(`เรนเดอร์ ${THEMES.length} ธีม`);
        const made = await ensureThemePreviews({ force: true });
        return { summary: `สร้างแล้ว ${made.length} ธีม`, url: '/themes' };
      });
    } catch (e) {
      return redirect('/themes', { err: e.message });
    }
    return redirect('/themes', { ok: 'กำลังสร้างภาพตัวอย่าง (ประมาณ 15–30 วินาที)…' });
  }],
];
