// ตัวเลือกธีม/น้ำเสียงที่ใช้ร่วมกันในหน้า "สร้างและโพสต์ทันที" และ "แก้ไขโพสต์"
import fs from 'node:fs';
import { THEMES, TONES } from '../image/themes.js';
import { previewFile } from '../image/previews.js';
import { esc } from './ui.js';
import { mediaUrl } from './pages/shared.js';

export const PICKER_CSS = `<style>
.quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.quick label,.themes label{cursor:pointer}
.quick input,.themes input{position:absolute;opacity:0;pointer-events:none}
.quick span{display:inline-block;padding:10px 16px;border:1px solid var(--line);border-radius:99px;background:#20242b;font-size:15px}
.quick input:checked+span{background:var(--mint);color:#08100c;border-color:var(--mint);font-weight:600}
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.themes .t{display:block;border:2px solid var(--line);border-radius:10px;overflow:hidden;background:#0b0d10}
.themes input:checked+.t{border-color:var(--mint);box-shadow:0 0 0 3px #5fe3b333}
.themes img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover}
.themes .sw{display:flex;height:42px}.themes .sw i{flex:1}
.themes .nm{display:block;padding:6px 8px;font-size:13px}
</style>`;

const swatch = (t) => `<span class="sw">${['bg', 'panel', 'accent', 'accent2', 'text'].map((k) => `<i style="background:${t.colors[k]}"></i>`).join('')}</span>`;

/**
 * @param {string} name  ชื่อฟิลด์ฟอร์ม
 * @param {string} value '' | 'brand' | 'random' | id ธีม
 * @param {{ auto?: string|false }} o  ข้อความของตัวเลือก "อัตโนมัติ" (false = ไม่แสดง)
 */
export function themePicker(name, value, { auto = 'อัตโนมัติ (ตามที่ตั้งไว้)' } = {}) {
  const quick = [
    ...(auto ? [['', auto]] : []),
    ['brand', '🏠 ธีมเพจ'],
    ['random', '🎲 สุ่มธีม'],
  ];
  const card = (t) => {
    const prev = fs.existsSync(previewFile(t.id)) ? `<img src="${mediaUrl(previewFile(t.id))}" alt="" loading="lazy">` : swatch(t);
    return `<label><input type="radio" name="${esc(name)}" value="${t.id}"${value === t.id ? ' checked' : ''}>
      <span class="t">${prev}<span class="nm">${esc(t.name)}</span></span></label>`;
  };
  return `<div class="quick">${quick.map(([v, label]) => `<label><input type="radio" name="${esc(name)}" value="${v}"${value === v ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>
    <details${THEMES.some((t) => t.id === value) ? ' open' : ''}><summary>หรือเลือกธีมเอง (${THEMES.length} แบบ)</summary>
    <div class="themes">${THEMES.map(card).join('')}</div></details>`;
}

export function toneOptions(withAuto = true) {
  return [...(withAuto ? [['', 'อัตโนมัติ (สลับไม่ซ้ำโพสต์ก่อน)']] : []), ...TONES.map((t) => [t.id, `${t.name} — ${t.brief}`])];
}
