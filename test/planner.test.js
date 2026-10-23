import test from 'node:test';
import assert from 'node:assert/strict';
import { planDay, canPromoToday } from '../src/content/planner.js';
import { loadPillars } from '../src/config.js';
import { addDays, weekday } from '../src/time.js';

const pillarsCfg = loadPillars();
const g = (id, extra = {}) => ({ id, name: id, promo: 'always', promoDays: [], maxPerDay: 2, signature: true, enabled: true, ...extra });

// จำลองการรัน N วันต่อเนื่อง โดยป้อนผลของวันก่อนกลับเข้าไป
function simulate(days, groups, start = '2026-11-02') {
  const recent = [];
  const lastModes = {};
  const plans = [];
  for (let i = 0; i < days; i++) {
    const plan = planDay({ date: addDays(start, i), pillarsCfg, groups, recent, lastModes });
    for (const s of plan.slots) {
      recent.unshift({ pillar: s.pillar.id, is_promo: s.isPromo ? 1 : 0 });
      for (const x of s.groups) lastModes[x.groupId] = x.mode;
    }
    plans.push(plan);
  }
  return { plans, recent };
}

test('ได้ 2 รอบต่อวัน และหมวดไม่ซ้ำกันในวันเดียว', () => {
  const { plans } = simulate(30, [g('a')]);
  for (const p of plans) {
    assert.deepEqual(p.slots.map((s) => s.slot), ['morning', 'evening']);
    assert.notEqual(p.slots[0].pillar.id, p.slots[1].pillar.id);
  }
});

test('โปรโมทไม่เกินวันละ 1 และสัดส่วนใกล้ 30%', () => {
  const { plans, recent } = simulate(60, [g('a')]);
  for (const p of plans) assert.ok(p.slots.filter((s) => s.isPromo).length <= 1);
  const ratio = recent.filter((r) => r.is_promo).length / recent.length;
  assert.ok(ratio >= 0.2 && ratio <= 0.35, `ratio ${ratio}`);
});

test('ไม่มีโพสต์โปรโมทติดกันในเพจ', () => {
  const { recent } = simulate(60, [g('a')]);
  for (let i = 1; i < recent.length; i++) assert.ok(!(recent[i].is_promo && recent[i - 1].is_promo));
});

test('กลุ่มเดียวกันไม่ได้โปรโมทติดกัน', () => {
  const { plans } = simulate(60, [g('a')]);
  const modes = plans.flatMap((p) => p.slots.flatMap((s) => s.groups.map((x) => x.mode)));
  for (let i = 1; i < modes.length; i++) assert.ok(!(modes[i] === 'promo' && modes[i - 1] === 'promo'));
});

test('กลุ่ม promo: never ไม่เคยได้โหมด promo', () => {
  const { plans } = simulate(40, [g('n', { promo: 'never' })]);
  const modes = plans.flatMap((p) => p.slots.flatMap((s) => s.groups.map((x) => x.mode)));
  assert.ok(!modes.includes('promo'));
  assert.ok(modes.includes('soft'));
});

test('กลุ่ม promoDays โปรโมทได้เฉพาะวันที่กำหนด', () => {
  const { plans } = simulate(60, [g('d', { promo: 'days', promoDays: ['sat'] })]);
  for (const p of plans) {
    for (const s of p.slots) for (const x of s.groups) if (x.mode === 'promo') assert.equal(weekday(p.date), 'sat');
  }
  assert.ok(canPromoToday(g('d', { promo: 'days', promoDays: ['sat'] }), '2026-10-24'));
});

test('maxPerDay 1 ได้วันละ 1 โพสต์, enabled false ไม่ได้เลย', () => {
  const { plans } = simulate(20, [g('one', { maxPerDay: 1 }), g('off', { enabled: false })]);
  for (const p of plans) {
    const all = p.slots.flatMap((s) => s.groups.map((x) => x.groupId));
    assert.equal(all.filter((x) => x === 'one').length, 1);
    assert.ok(!all.includes('off'));
  }
});

test('ผลลัพธ์คงที่สำหรับวันเดียวกัน', () => {
  const a = planDay({ date: '2026-11-05', pillarsCfg, groups: [g('a')] });
  const b = planDay({ date: '2026-11-05', pillarsCfg, groups: [g('a')] });
  assert.deepEqual(a.slots.map((s) => s.pillar.id), b.slots.map((s) => s.pillar.id));
});
