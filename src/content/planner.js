// วางแผนคอนเทนต์ของวัน: แต่ละรอบ (เช้า/เย็น) ใช้หมวดอะไร เป็นโปรโมทหรือไม่
// และแต่ละกลุ่มได้โพสต์แบบไหน — เป็นฟังก์ชันบริสุทธิ์ (ไม่แตะ DB/เครือข่าย) เพื่อให้เทสได้
import { SLOTS, weekday } from '../time.js';

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(items, rand) {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = rand() * total;
  for (const i of items) if ((r -= i.w) <= 0) return i.item;
  return items.at(-1).item;
}

export function canPromoToday(group, date) {
  if (group.promo === 'always') return true;
  if (group.promo === 'days') return group.promoDays.includes(weekday(date));
  return false;
}

/**
 * @param {object} o
 * @param {string} o.date          YYYY-MM-DD
 * @param {object} o.pillarsCfg    จาก config/pillars.yaml
 * @param {object[]} o.groups      จาก loadGroups()
 * @param {object[]} o.recent      โพสต์เพจล่าสุด (ใหม่ → เก่า) มี pillar, is_promo
 * @param {Record<string,string>} o.lastModes  โหมดล่าสุดของแต่ละกลุ่ม
 */
export function planDay({ date, pillarsCfg, groups, recent = [], lastModes = {} }) {
  const rand = rng(`strata:${date}`);
  const window = recent.slice(0, 14);
  const promoRatio = window.length ? window.filter((p) => p.is_promo).length / window.length : 0;
  const lastWasPromo = Boolean(recent[0]?.is_promo);
  const hasPromoPillar = pillarsCfg.pillars.some((p) => p.kind === 'promo');
  const wantPromo = hasPromoPillar && (pillarsCfg.maxPromoPerDay ?? 1) > 0 && promoRatio < (pillarsCfg.promoRatio ?? 0.3) && !lastWasPromo;
  const promoSlot = wantPromo ? (rand() < 0.6 ? 'evening' : 'morning') : null;

  // ลดน้ำหนักหมวดที่เพิ่งใช้ไป เพื่อให้เนื้อหาหมุนเวียน
  const recentUse = {};
  for (const p of recent.slice(0, 6)) recentUse[p.pillar] = (recentUse[p.pillar] ?? 0) + 1;

  const used = new Set(recent[0] ? [recent[0].pillar] : []);
  const slots = [];
  for (const slot of SLOTS) {
    const kind = slot === promoSlot ? 'promo' : 'value';
    let pool = pillarsCfg.pillars.filter((p) => p.kind === kind && !used.has(p.id));
    if (!pool.length) pool = pillarsCfg.pillars.filter((p) => p.kind === kind);
    const pillar = pickWeighted(
      pool.map((p) => ({ item: p, w: (p.weight ?? 1) * 0.5 ** (recentUse[p.id] ?? 0) })),
      rand,
    );
    used.add(pillar.id);
    slots.push({ slot, pillar, isPromo: kind === 'promo', groups: [] });
  }

  const modes = { ...lastModes };
  for (const g of groups.filter((x) => x.enabled)) {
    let targetSlots = SLOTS;
    if (g.maxPerDay === 1) {
      const promoOk = promoSlot && canPromoToday(g, date) && modes[g.id] !== 'promo';
      const valueSlots = slots.filter((s) => !s.isPromo).map((s) => s.slot);
      targetSlots = promoOk ? [promoSlot] : [valueSlots[hash(g.id + date) % valueSlots.length]];
    }
    for (const s of slots) {
      if (!targetSlots.includes(s.slot)) continue;
      let mode = 'value';
      if (s.isPromo) mode = canPromoToday(g, date) && modes[g.id] !== 'promo' ? 'promo' : 'soft';
      s.groups.push({ groupId: g.id, mode });
      modes[g.id] = mode;
    }
  }
  return { date, slots };
}
