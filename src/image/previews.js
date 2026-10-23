// ภาพตัวอย่างของแต่ละธีม (ใช้ในหน้า "ธีม" ของ Dashboard) — สร้างครั้งเดียวแล้วเก็บไว้
import fs from 'node:fs';
import path from 'node:path';
import { mediaDir } from '../env.js';
import { loadBrand } from '../config.js';
import { THEMES } from './themes.js';
import { renderImage, closeRenderer } from './render.js';

export const SAMPLE = {
  kicker: 'DEV TIP', headline: 'ทำเว็บให้ร้าน|ขายได้จริง', subhead: 'ตัวอย่างหน้าตาของธีมนี้',
  bullets: ['ชุดสีและฟอนต์ของธีม', 'อ่านง่ายบนมือถือ'], code: '', options: [], cta: 'Strata — ทักแชทประเมินราคาฟรี', packageId: 'all',
};

export const previewDir = () => path.join(mediaDir(), 'theme-previews');
export const previewFile = (id) => path.join(previewDir(), `${id}.png`);

/** สร้างภาพตัวอย่างของธีมที่ยังไม่มี (force = สร้างใหม่ทั้งหมด) */
export async function ensureThemePreviews({ force = false, bgPath = null } = {}) {
  const brand = loadBrand();
  const made = [];
  try {
    for (const t of THEMES) {
      const out = previewFile(t.id);
      if (!force && fs.existsSync(out)) continue;
      await renderImage({ layout: 'tip', image: SAMPLE, brand, outFile: out, theme: t.id, bgPath });
      made.push(t.id);
    }
  } finally {
    await closeRenderer();
  }
  return made;
}
