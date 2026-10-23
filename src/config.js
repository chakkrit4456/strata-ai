import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CONFIG_DIR } from './env.js';
import { writeAtomic } from './fsutil.js';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const TEMPLATES = ['tip', 'showcase', 'package', 'fun', 'question'];

const file = (name) => path.join(CONFIG_DIR, name);
const read = (name) => YAML.parse(fs.readFileSync(file(name), 'utf8')) ?? {};
const save = (name, header, data) => writeAtomic(file(name), `${header}\n${YAML.stringify(data, { lineWidth: 0 })}`);

const fail = (msg) => { throw new Error(msg); };
const text = (v, label, { required = true, max = 4000 } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) fail(`${label}: ต้องกรอก`);
  if (s.length > max) fail(`${label}: ยาวเกิน ${max} ตัวอักษร`);
  return s;
};
const list = (v, label) => {
  if (!Array.isArray(v)) fail(`${label}: ต้องเป็นรายการ`);
  return v.map((x) => text(x, label, { max: 500 })).filter(Boolean);
};

// ---------- brand ----------

export function validateBrand(b) {
  if (!b || typeof b !== 'object') fail('ข้อมูลแบรนด์ไม่ถูกต้อง');
  const ids = new Set();
  if (!Array.isArray(b.packages) || !b.packages.length) fail('ต้องมีแพ็กเกจอย่างน้อย 1 ตัว');
  const packages = b.packages.map((p, i) => {
    const id = text(p.id, `แพ็กเกจที่ ${i + 1}: id`, { max: 40 });
    if (!/^[a-z0-9-]+$/.test(id)) fail(`แพ็กเกจ ${id}: id ใช้ได้แค่ a-z 0-9 -`);
    if (ids.has(id)) fail(`แพ็กเกจ id ซ้ำ: ${id}`);
    ids.add(id);
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0) fail(`แพ็กเกจ ${id}: ราคาต้องเป็นตัวเลขมากกว่า 0`);
    return {
      id,
      name: text(p.name, `แพ็กเกจ ${id}: ชื่อ`, { max: 120 }),
      price,
      ...(String(p.priceNote ?? '').trim() ? { priceNote: text(p.priceNote, 'หมายเหตุราคา', { max: 200 }) } : {}),
      unit: text(p.unit ?? 'โปรเจกต์', 'หน่วย', { max: 40 }),
      scope: text(p.scope, `แพ็กเกจ ${id}: ขอบเขต`, { max: 500 }),
      features: list(p.features ?? [], `แพ็กเกจ ${id}: ฟีเจอร์`),
      revisions: text(p.revisions ?? '', 'จำนวนครั้งแก้ไข', { required: false, max: 100 }),
      duration: text(p.duration, `แพ็กเกจ ${id}: ระยะเวลา`, { max: 100 }),
      support: text(p.support ?? '', 'ระยะดูแล', { required: false, max: 100 }),
    };
  });
  const portfolio = b.portfolio ?? {};
  return {
    ...b,
    name: text(b.name, 'ชื่อแบรนด์', { max: 80 }),
    studio: text(b.studio ?? b.name, 'ชื่อสตูดิโอ', { max: 120 }),
    owner: text(b.owner ?? '', 'เจ้าของ', { required: false, max: 120 }),
    location: text(b.location ?? '', 'ที่ตั้ง', { required: false, max: 120 }),
    tagline: text(b.tagline ?? '', 'tagline', { required: false, max: 300 }),
    experience: text(b.experience ?? '', 'ประสบการณ์', { required: false, max: 1500 }),
    services: list(b.services ?? [], 'บริการ'),
    portfolio: { shops: list(portfolio.shops ?? [], 'ผลงานเว็บร้านค้า'), systems: list(portfolio.systems ?? [], 'ผลงานระบบ') },
    packages,
    includedInAll: list(b.includedInAll ?? [], 'สิ่งที่ได้ทุกแพ็กเกจ'),
    process: list(b.process ?? [], 'ขั้นตอนการทำงาน'),
    contact: Object.fromEntries(Object.entries(b.contact ?? {}).map(([k, v]) => [k, text(v, `ติดต่อ ${k}`, { required: false, max: 300 })])),
    doNotClaim: list(b.doNotClaim ?? [], 'สิ่งที่ห้ามอ้าง'),
    voice: text(b.voice, 'น้ำเสียงแบรนด์', { max: 1500 }),
  };
}

export function loadBrand() {
  return read('brand.yaml');
}

export function saveBrand(b) {
  const clean = validateBrand(b);
  save('brand.yaml', '# ข้อเท็จจริงทั้งหมดที่ AI ใช้อ้างอิงได้ — แก้ได้จากหน้า "แบรนด์" ใน Dashboard', clean);
  return clean;
}

// ---------- pillars ----------

export function validatePillars(cfg) {
  if (!cfg || !Array.isArray(cfg.pillars)) fail('ต้องมีรายการหมวด (pillars)');
  const promoRatio = Number(cfg.promoRatio ?? 0.3);
  if (!(promoRatio >= 0 && promoRatio <= 1)) fail('สัดส่วนโปรโมทต้องอยู่ระหว่าง 0–1');
  const maxPromoPerDay = Number(cfg.maxPromoPerDay ?? 1);
  if (![0, 1].includes(maxPromoPerDay)) fail('โปรโมทต่อวันต้องเป็น 0 หรือ 1');
  const ids = new Set();
  const pillars = cfg.pillars.map((p, i) => {
    const id = text(p.id, `หมวดที่ ${i + 1}: id`, { max: 40 });
    if (!/^[a-z0-9-]+$/.test(id)) fail(`หมวด ${id}: id ใช้ได้แค่ a-z 0-9 -`);
    if (ids.has(id)) fail(`หมวด id ซ้ำ: ${id}`);
    ids.add(id);
    if (!['value', 'promo'].includes(p.kind)) fail(`หมวด ${id}: kind ต้องเป็น value หรือ promo`);
    if (!TEMPLATES.includes(p.template)) fail(`หมวด ${id}: template ต้องเป็น ${TEMPLATES.join('/')}`);
    const weight = Number(p.weight ?? 1);
    if (!(weight >= 0 && weight <= 100)) fail(`หมวด ${id}: น้ำหนักต้องอยู่ระหว่าง 0–100`);
    return {
      id, kind: p.kind, weight, template: p.template,
      label: text(p.label, `หมวด ${id}: ชื่อ`, { max: 120 }),
      brief: text(p.brief, `หมวด ${id}: แนวทาง`, { max: 1500 }),
      enabled: p.enabled !== false,
    };
  });
  const active = pillars.filter((p) => p.enabled && p.weight > 0);
  if (!active.some((p) => p.kind === 'value')) fail('ต้องเปิดหมวดแบบ value อย่างน้อย 1 หมวด');
  return { promoRatio, maxPromoPerDay, pillars };
}

/** ค่าเต็มจากไฟล์ (รวมหมวดที่ปิดไว้) — ใช้ในหน้าแก้ไข */
export function readPillars() {
  return validatePillars(read('pillars.yaml'));
}

/** สำหรับวางแผนโพสต์: เฉพาะหมวดที่เปิดและมีน้ำหนัก */
export function loadPillars() {
  const cfg = readPillars();
  return { ...cfg, pillars: cfg.pillars.filter((p) => p.enabled && p.weight > 0) };
}

export function savePillars(cfg) {
  const clean = validatePillars(cfg);
  save('pillars.yaml', '# หมวดเนื้อหา — แก้ได้จากหน้า "หมวดเนื้อหา" ใน Dashboard', clean);
  return clean;
}

// ---------- groups ----------

export function normalizeGroup(g) {
  const id = text(g.id, 'id กลุ่ม', { max: 40 });
  if (!/^[a-z0-9-]+$/.test(id)) fail(`กลุ่ม ${id}: id ใช้ได้แค่ a-z 0-9 -`);
  const url = text(g.url ?? '', `กลุ่ม ${id}: ลิงก์`, { required: false, max: 300 });
  if (url && !/^https:\/\/(www\.|m\.|web\.)?facebook\.com\//.test(url)) fail(`กลุ่ม ${id}: ลิงก์ต้องขึ้นต้นด้วย https://www.facebook.com/`);
  const promo = g.promo ?? 'never';
  if (!['always', 'never', 'days'].includes(promo)) fail(`กลุ่ม ${id}: promo ไม่ถูกต้อง`);
  const promoDays = [...new Set((g.promoDays ?? []).map((d) => String(d).toLowerCase().slice(0, 3)))];
  for (const d of promoDays) if (!WEEKDAYS.includes(d)) fail(`กลุ่ม ${id}: promoDays มี "${d}"`);
  if (promo === 'days' && !promoDays.length) fail(`กลุ่ม ${id}: เลือกวันที่โปรโมทได้อย่างน้อย 1 วัน`);
  return {
    id,
    name: text(g.name ?? id, `กลุ่ม ${id}: ชื่อ`, { max: 200 }),
    url,
    audience: text(g.audience ?? '', 'สมาชิกกลุ่ม', { required: false, max: 500 }),
    rules: text(g.rules ?? '', 'กฎกลุ่ม', { required: false, max: 1500 }),
    promo,
    promoDays: promo === 'days' ? promoDays : [],
    maxPerDay: Math.min(2, Math.max(1, Number(g.maxPerDay ?? 2))),
    signature: g.signature !== false,
    enabled: g.enabled !== false,
  };
}

export const groupsFileExists = () => fs.existsSync(file('groups.yaml'));

export function loadGroups() {
  const { groups = [] } = read(groupsFileExists() ? 'groups.yaml' : 'groups.example.yaml');
  const seen = new Set();
  return groups.map((g) => {
    const n = normalizeGroup(g);
    if (seen.has(n.id)) fail(`groups: id ซ้ำ (${n.id})`);
    seen.add(n.id);
    return n;
  });
}

export function saveGroups(groups) {
  const seen = new Set();
  const clean = groups.map((g) => {
    const n = normalizeGroup(g);
    if (seen.has(n.id)) fail(`id กลุ่มซ้ำ: ${n.id}`);
    seen.add(n.id);
    return n;
  });
  save('groups.yaml', '# รายชื่อกลุ่ม Facebook — แก้ได้จากหน้า "กลุ่ม" ใน Dashboard', { groups: clean });
  return clean;
}

export { WEEKDAYS };

/**
 * กลุ่มที่เลือกโพสต์ได้จริง: มาจาก groups.yaml ของจริง, เปิดใช้อยู่ และลิงก์เป็นกลุ่ม Facebook ที่ไม่ใช่ลิงก์ตัวอย่าง
 * @returns {string} เหตุผลที่ใช้ไม่ได้ ('' = ใช้ได้)
 */
export function groupProblem(g) {
  if (!groupsFileExists()) return 'ยังเป็นรายชื่อกลุ่มตัวอย่าง (เพิ่มกลุ่มจริงที่หน้า "กลุ่ม")';
  if (!g.enabled) return 'กลุ่มนี้พักไว้';
  if (!g.url) return 'ยังไม่ได้ใส่ลิงก์กลุ่ม';
  const m = /^https:\/\/(?:www\.|m\.|web\.)?facebook\.com\/groups\/([A-Za-z0-9._-]+)\/?(?:[?#].*)?$/.exec(g.url);
  if (!m) return 'ลิงก์ไม่ใช่กลุ่ม Facebook (ต้องเป็น facebook.com/groups/...)';
  if (/replace|example|xxx/i.test(m[1])) return 'ยังเป็นลิงก์ตัวอย่าง';
  return '';
}

export const isRealGroup = (g) => groupProblem(g) === '';
