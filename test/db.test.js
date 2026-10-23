import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/db.js';

db.useMemoryDb();
const post = (date, slot, isPromo = false) => ({
  date, slot, pillar: 'tip', isPromo, topic: `t-${date}-${slot}`, caption: 'c', image: {}, imagePath: '/x.png', status: 'approved',
});

test('บันทึกโพสต์ + รายการกลุ่ม แล้วปล่อยเข้าคิวตอนโพสต์เพจ', () => {
  const id = db.insertPost(post('2026-11-01', 'morning', true), [{ groupId: 'a', mode: 'promo', text: 'x' }, { groupId: 'b', mode: 'soft', text: 'y' }]);
  assert.deepEqual(db.itemsForPost(id).map((i) => i.status), ['waiting', 'waiting']);
  db.releaseItems(id);
  assert.deepEqual(db.itemsForPost(id).map((i) => i.status), ['queued', 'queued']);
  assert.deepEqual(db.lastModeByGroup(), { a: 'promo', b: 'soft' });
});

test('รอบเดียวกันของวันเดียวกันบันทึกซ้ำไม่ได้', () => {
  assert.throws(() => db.insertPost(post('2026-11-01', 'morning'), []));
});

test('รายการค้างของวันก่อนหมดอายุ ไม่ทบไปวันใหม่', () => {
  const id = db.insertPost(post('2026-11-02', 'evening'), [{ groupId: 'a', mode: 'value', text: 'z' }]);
  const n = db.expireBefore('2026-11-02');
  assert.equal(n, 2);
  assert.equal(db.itemsForPost(id)[0].status, 'waiting');
  assert.equal(db.lastModeByGroup().a, 'value');
});

test('ข่าวแยกตามสาย: เลือกเฉพาะข่าวเทคได้ และข่าวที่ใช้แล้วไม่ถูกเลือกซ้ำ', () => {
  const now = new Date().toISOString();
  db.upsertNews([
    { url: 'https://t.com/1', title: 'New AI tool', source: 'GitHub Blog', lang: 'en', focus: 'tech', publishedAt: now },
    { url: 'https://g.com/1', title: 'ข่าวธุรกิจ', source: 'Techsauce', lang: 'th', focus: 'general', publishedAt: now },
  ]);
  assert.deepEqual(db.freshNews({ focus: 'tech' }).map((n) => n.url), ['https://t.com/1']);
  assert.equal(db.freshNews().length, 2);
  db.markNewsUsed('https://t.com/1', 1);
  assert.equal(db.freshNews({ focus: 'tech' }).length, 0);
  assert.equal(db.freshNews({ focus: 'tech', includeUsed: true }).length, 1);
});
