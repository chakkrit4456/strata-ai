// หน้า "หมวดเนื้อหา": น้ำหนัก เปิด/ปิด แนวทางของแต่ละหมวด และสัดส่วนโปรโมท (บันทึกลง config/pillars.yaml)
import YAML from 'yaml';
import { readPillars, savePillars, TEMPLATES } from '../../config.js';
import { esc, badge, layout, field, area, select, check, csrfInput } from '../ui.js';
import { redirect } from './shared.js';

const KIND = { value: ['ให้ความรู้/สนุก', 'info'], promo: ['โปรโมท', 'warn'] };

function formPage(ctx, cfg, error) {
  const blocks = cfg.pillars.map((p, i) => {
    const n = (f) => `p_${i}_${f}`;
    return `<div class="item" style="margin-bottom:12px">
      <input type="hidden" name="${n('id')}" value="${esc(p.id)}">
      <div class="head"><h3>${esc(p.label)} <span class="muted">(${esc(p.id)})</span></h3>${badge(KIND[p.kind])}
        ${check('เปิดใช้', n('enabled'), p.enabled)}</div>
      <div class="grid3">
        ${field('ชื่อหมวด', n('label'), p.label)}
        ${select('ประเภท', n('kind'), p.kind, [['value', 'ให้ความรู้/สนุก'], ['promo', 'โปรโมท']])}
        ${select('เทมเพลตภาพ', n('template'), p.template, TEMPLATES.map((t) => [t, t]))}
      </div>
      ${field('น้ำหนัก (ยิ่งมากยิ่งถูกเลือกบ่อย)', n('weight'), p.weight, { type: 'number', attrs: 'min="0" max="100" step="0.5"' })}
      ${area('แนวทางให้ AI', n('brief'), p.brief, { rows: 3 })}</div>`;
  }).join('');
  return {
    status: error ? 400 : 200,
    html: layout({
      title: 'หมวดเนื้อหา', active: 'pillars', flash: error ? { err: error } : ctx.flash,
      body: `<div class="head"><h1 style="margin:0 auto 0 0">หมวดเนื้อหา</h1><a class="button" href="/pillars/yaml">แก้แบบ YAML / เพิ่มหมวด</a></div>
      <form method="post" action="/pillars/save">${csrfInput(ctx.csrf)}
        <section class="card"><h2 style="margin-top:0">สัดส่วนโพสต์</h2>
          <div class="grid2">
            ${field('สัดส่วนโพสต์โปรโมทของเพจ (%)', 'promoPercent', Math.round(cfg.promoRatio * 100), { type: 'number', attrs: 'min="0" max="100" step="5"', hint: 'แนะนำ 20–30% เพื่อไม่ให้ดูเป็นสแปม' })}
            ${select('โปรโมทต่อวันสูงสุด', 'maxPromoPerDay', cfg.maxPromoPerDay, [[1, '1 โพสต์'], [0, 'ไม่โปรโมทเลย']])}
          </div></section>
        <section class="card"><h2 style="margin-top:0">หมวด</h2>${blocks}
          <input type="hidden" name="count" value="${cfg.pillars.length}"></section>
        <div class="actions"><button class="primary">บันทึก</button></div>
      </form>`,
    }),
  };
}

function fromForm(f) {
  const pillars = [];
  for (let i = 0; i < Math.min(50, Number(f.count) || 0); i++) {
    const g = (k) => f[`p_${i}_${k}`];
    pillars.push({ id: g('id'), label: g('label'), kind: g('kind'), template: g('template'), weight: Number(g('weight')), brief: g('brief'), enabled: g('enabled') === '1' });
  }
  return { promoRatio: Number(f.promoPercent) / 100, maxPromoPerDay: Number(f.maxPromoPerDay), pillars };
}

function yamlPage(ctx, text, error) {
  return {
    status: error ? 400 : 200,
    html: layout({
      title: 'หมวดเนื้อหา (YAML)', active: 'pillars', flash: error ? { err: error } : ctx.flash,
      body: `<h1>แก้หมวดเนื้อหาแบบ YAML</h1>
      <p class="muted">เพิ่มหมวดใหม่ได้โดยคัดลอกหมวดเดิมแล้วเปลี่ยน id · template ใช้ได้: ${TEMPLATES.join(', ')} · kind: value หรือ promo</p>
      <form method="post" action="/pillars/yaml" class="card">${csrfInput(ctx.csrf)}
        <textarea name="yaml" rows="30" class="mono">${esc(text)}</textarea>
        <div class="actions"><button class="primary">บันทึก</button><a class="button" href="/pillars">กลับ</a></div></form>`,
    }),
  };
}

export const routes = [
  ['GET', /^\/pillars$/, (ctx) => formPage(ctx, readPillars())],
  ['POST', /^\/pillars\/save$/, (ctx) => {
    const cfg = fromForm(ctx.form);
    try {
      savePillars(cfg);
    } catch (e) {
      return formPage(ctx, { ...cfg, pillars: cfg.pillars.map((p) => ({ ...p, enabled: p.enabled !== false })) }, e.message);
    }
    return redirect('/pillars', { ok: 'บันทึกหมวดเนื้อหาแล้ว' });
  }],
  ['GET', /^\/pillars\/yaml$/, (ctx) => yamlPage(ctx, YAML.stringify(readPillars(), { lineWidth: 0 }))],
  ['POST', /^\/pillars\/yaml$/, (ctx) => {
    try {
      savePillars(YAML.parse(String(ctx.form.yaml ?? '')));
    } catch (e) {
      return yamlPage(ctx, ctx.form.yaml, e.message);
    }
    return redirect('/pillars', { ok: 'บันทึกหมวดเนื้อหาแล้ว' });
  }],
];
