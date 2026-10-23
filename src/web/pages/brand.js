// หน้า "แบรนด์": ข้อมูลบริการ แพ็กเกจ ราคา ผลงาน ช่องทางติดต่อ (บันทึกลง config/brand.yaml)
import YAML from 'yaml';
import { loadBrand, saveBrand } from '../../config.js';
import { esc, layout, field, area, check, csrfInput, lines } from '../ui.js';
import { redirect } from './shared.js';

const PKG_FIELDS = ['id', 'name', 'price', 'priceNote', 'scope', 'features', 'revisions', 'duration', 'support'];

function pkgBlock(p, i, isNew) {
  const n = (f) => `pkg_${i}_${f}`;
  return `<div class="item" style="margin-bottom:12px">
    <div class="head"><h3>${isNew ? 'เพิ่มแพ็กเกจใหม่ (เว้นว่างถ้าไม่ต้องการ)' : esc(p.name)}</h3>
      ${isNew ? '' : check('ลบแพ็กเกจนี้', n('delete'), false)}</div>
    <div class="grid3">
      ${field('ชื่อแพ็กเกจ', n('name'), p.name)}
      ${field('ราคา (บาท)', n('price'), p.price, { type: 'number', attrs: 'min="1" step="1"' })}
      ${field('id (ภาษาอังกฤษ)', n('id'), p.id, { hint: 'a-z 0-9 - เช่น starter', attrs: 'pattern="[a-z0-9-]*"' })}
    </div>
    ${field('หมายเหตุราคา', n('priceNote'), p.priceNote, { hint: 'เช่น "เริ่มต้น ราคาจริงประเมินตามฟีเจอร์" (ถ้ามี ภาพจะขึ้นคำว่า "เริ่ม")' })}
    ${area('ขอบเขตงาน', n('scope'), p.scope, { rows: 2 })}
    ${area('ฟีเจอร์ (บรรทัดละ 1 ข้อ)', n('features'), (p.features ?? []).join('\n'), { rows: 4 })}
    <div class="grid3">
      ${field('ระยะเวลา', n('duration'), p.duration)}
      ${field('แก้ไขงานได้', n('revisions'), p.revisions)}
      ${field('ดูแลหลังส่งมอบ', n('support'), p.support)}
    </div></div>`;
}

function formPage(ctx, b, error) {
  const pk = b.packages ?? [];
  const blank = { ...Object.fromEntries(PKG_FIELDS.map((f) => [f, ''])), features: [] };
  return {
    status: error ? 400 : 200,
    html: layout({
      title: 'แบรนด์', active: 'brand', flash: error ? { err: error } : ctx.flash,
      body: `<div class="head"><h1 style="margin:0 auto 0 0">ข้อมูลแบรนด์</h1><a class="button" href="/brand/yaml">แก้แบบ YAML</a></div>
      <p class="muted">AI ใช้ข้อมูลในหน้านี้เท่านั้นตอนเขียนโพสต์ และตัวตรวจจะเช็คว่าราคาในโพสต์ตรงกับแพ็กเกจที่นี่</p>
      <form method="post" action="/brand/save">${csrfInput(ctx.csrf)}
        <section class="card"><h2 style="margin-top:0">ข้อมูลทั่วไป</h2>
          <div class="grid2">${field('ชื่อแบรนด์', 'name', b.name, { required: true })}${field('ชื่อสตูดิโอ', 'studio', b.studio)}
          ${field('เจ้าของ', 'owner', b.owner)}${field('ที่ตั้ง', 'location', b.location)}</div>
          ${field('Tagline', 'tagline', b.tagline)}
          ${area('ประสบการณ์', 'experience', b.experience, { rows: 3 })}
          ${area('น้ำเสียงแบรนด์ (วิธีเขียนโพสต์)', 'voice', b.voice, { rows: 3, required: true })}
        </section>
        <section class="card"><h2 style="margin-top:0">แพ็กเกจและราคา</h2>
          ${pk.map((p, i) => pkgBlock(p, i, false)).join('')}${pkgBlock(blank, pk.length, true)}
          <input type="hidden" name="pkg_count" value="${pk.length + 1}">
        </section>
        <section class="card"><h2 style="margin-top:0">บริการและผลงาน</h2>
          ${area('บริการ (บรรทัดละ 1)', 'services', (b.services ?? []).join('\n'), { rows: 5 })}
          <div class="grid2">
            ${area('ผลงานเว็บร้านค้า (บรรทัดละ 1)', 'shops', (b.portfolio?.shops ?? []).join('\n'), { rows: 5 })}
            ${area('ผลงานระบบ (บรรทัดละ 1)', 'systems', (b.portfolio?.systems ?? []).join('\n'), { rows: 5 })}
          </div>
          ${area('ทุกแพ็กเกจได้รับ (บรรทัดละ 1)', 'includedInAll', (b.includedInAll ?? []).join('\n'), { rows: 4 })}
          ${area('ขั้นตอนการทำงาน (บรรทัดละ 1)', 'process', (b.process ?? []).join('\n'), { rows: 5 })}
          ${area('สิ่งที่ห้าม AI อ้างถึง (บรรทัดละ 1)', 'doNotClaim', (b.doNotClaim ?? []).join('\n'), { rows: 4, hint: 'เช่น จำนวนลูกค้า รีวิว ชื่อลูกค้า' })}
        </section>
        <section class="card"><h2 style="margin-top:0">ช่องทางติดต่อ</h2>
          ${field('เพจ Facebook', 'contact_page', b.contact?.page)}
          ${field('Fastwork', 'contact_fastwork', b.contact?.fastwork)}
          ${field('LINE', 'contact_line', b.contact?.line)}
        </section>
        <div class="actions"><button class="primary">บันทึกข้อมูลแบรนด์</button></div>
      </form>`,
    }),
  };
}

function fromForm(f, current) {
  const packages = [];
  const count = Math.min(50, Number(f.pkg_count) || 0);
  for (let i = 0; i < count; i++) {
    const g = (k) => String(f[`pkg_${i}_${k}`] ?? '').trim();
    if (f[`pkg_${i}_delete`] === '1') continue;
    if (!g('name') && !g('price') && !g('id')) continue;
    packages.push({
      id: g('id').toLowerCase(), name: g('name'), price: g('price'), priceNote: g('priceNote'),
      unit: current.packages?.[i]?.unit ?? 'โปรเจกต์',
      scope: g('scope'), features: lines(f[`pkg_${i}_features`]), revisions: g('revisions'), duration: g('duration'), support: g('support'),
    });
  }
  return {
    ...current,
    name: f.name, studio: f.studio, owner: f.owner, location: f.location, tagline: f.tagline,
    experience: f.experience, voice: f.voice,
    services: lines(f.services),
    portfolio: { shops: lines(f.shops), systems: lines(f.systems) },
    packages,
    includedInAll: lines(f.includedInAll),
    process: lines(f.process),
    doNotClaim: lines(f.doNotClaim),
    contact: { page: f.contact_page ?? '', fastwork: f.contact_fastwork ?? '', line: f.contact_line ?? '' },
  };
}

function yamlPage(ctx, text, error) {
  return {
    status: error ? 400 : 200,
    html: layout({
      title: 'แบรนด์ (YAML)', active: 'brand', flash: error ? { err: error } : ctx.flash,
      body: `<h1>แก้ข้อมูลแบรนด์แบบ YAML</h1><p class="muted">สำหรับแก้ทีละมากๆ ระบบตรวจรูปแบบก่อนบันทึก และเก็บไฟล์เดิมไว้เป็น brand.yaml.bak</p>
      <form method="post" action="/brand/yaml" class="card">${csrfInput(ctx.csrf)}
        <textarea name="yaml" rows="30" class="mono">${esc(text)}</textarea>
        <div class="actions"><button class="primary">บันทึก</button><a class="button" href="/brand">กลับ</a></div></form>`,
    }),
  };
}

export const routes = [
  ['GET', /^\/brand$/, (ctx) => formPage(ctx, loadBrand())],
  ['POST', /^\/brand\/save$/, (ctx) => {
    const b = fromForm(ctx.form, loadBrand());
    try {
      saveBrand(b);
    } catch (e) {
      return formPage(ctx, b, e.message);
    }
    return redirect('/brand', { ok: 'บันทึกข้อมูลแบรนด์แล้ว — โพสต์ถัดไปจะใช้ข้อมูลใหม่' });
  }],
  ['GET', /^\/brand\/yaml$/, (ctx) => yamlPage(ctx, YAML.stringify(loadBrand(), { lineWidth: 0 }))],
  ['POST', /^\/brand\/yaml$/, (ctx) => {
    try {
      saveBrand(YAML.parse(String(ctx.form.yaml ?? '')));
    } catch (e) {
      return yamlPage(ctx, ctx.form.yaml, e.message);
    }
    return redirect('/brand', { ok: 'บันทึกข้อมูลแบรนด์แล้ว' });
  }],
];
