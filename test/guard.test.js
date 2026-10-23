import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSlot, findPrices } from '../src/content/guard.js';
import { similarity } from '../src/content/similarity.js';
import { loadBrand } from '../src/config.js';

const brand = loadBrand();
const img = { kicker: 'DEV TIP', headline: 'Backup ก่อนอัปเดต', subhead: '', bullets: ['ข้อหนึ่ง'], code: '', options: [], cta: '', packageId: 'all' };
const filler = 'เนื้อหาตัวอย่างที่ยาวพอสำหรับการทดสอบความยาวขั้นต่ำของระบบตรวจเนื้อหา ';
const caption = `${filler.repeat(3)}คุณใช้วิธีไหนกันบ้าง?`;
const textA = `สวัสดีชาวเว็บ dev วันนี้มาแชร์วิธี backup ฐานข้อมูลแบบง่ายที่ใช้จริง ตั้ง cron ให้ทำงานทุกคืน แล้วเก็บไฟล์ไว้นอกเครื่องอย่างน้อยหนึ่งชุด ช่วยได้มากเวลาอัปเดตแล้วพัง ใครมีเทคนิคเพิ่มเติมเล่าให้ฟังหน่อยครับ`;
const textB = `เจ้าของร้านหลายคนอาจไม่รู้ว่าข้อมูลสินค้าในระบบหายได้ถ้าไม่มีการสำรอง ลองถามคนดูแลระบบของคุณดูว่ามีสำรองข้อมูลทุกวันหรือยัง และเก็บไว้ที่ไหน เป็นคำถามง่ายๆ ที่ช่วยกันปัญหาใหญ่ได้ ร้านไหนเคยเจอข้อมูลหายบ้างครับ`;
const valuePlan = { isPromo: false, groups: [{ groupId: 'a', mode: 'value' }, { groupId: 'b', mode: 'value' }] };
const base = { topic: 'backup ฐานข้อมูล', caption, hashtags: [], image: img, softImage: img, variants: [{ groupId: 'a', text: textA }, { groupId: 'b', text: textB }] };

test('เนื้อหาปกติผ่าน', () => {
  const r = checkSlot(base, valuePlan, { brand });
  assert.deepEqual(r.issues, []);
});

test('จับราคาได้หลายรูปแบบ', () => {
  assert.deepEqual(findPrices('เริ่ม ฿1,500 หรือ 5,000 บาท และ 10000.-'), [1500, 5000, 10000]);
});

test('โพสต์โปรโมทที่ใช้ราคาผิดไม่ผ่าน', () => {
  const plan = { isPromo: true, groups: [{ groupId: 'a', mode: 'promo' }] };
  const c = { ...base, caption: `${caption} เริ่มต้นเพียง ฿990 ทักแชทเลย`, variants: [{ groupId: 'a', text: `${textA} ราคา 1,500 บาท` }] };
  const r = checkSlot(c, plan, { brand });
  assert.ok(r.issues.some((i) => i.includes('990')));
  assert.ok(!r.issues.some((i) => i.includes('1500')));
});

test('กลุ่มโหมด value/soft ห้ามมีราคาหรือคำชวนจ้าง', () => {
  const c = { ...base, variants: [{ groupId: 'a', text: `${textA} สนใจติดต่อได้` }, { groupId: 'b', text: `${textB} เริ่ม 1,500 บาท` }] };
  const r = checkSlot(c, valuePlan, { brand });
  assert.ok(r.issues.some((i) => i.includes('กลุ่ม a') && i.includes('ชวน')));
  assert.ok(r.issues.some((i) => i.includes('กลุ่ม b') && i.includes('ราคา')));
});

test('ห้ามแต่งจำนวนลูกค้า/รีวิว', () => {
  const c = { ...base, caption: `${caption} ลูกค้ากว่า 200 ราย รีวิว 5 ดาว` };
  const r = checkSlot(c, valuePlan, { brand });
  assert.ok(r.issues.some((i) => i.includes('อ้างจำนวน')));
});

test('ข้อความกลุ่มที่ก็อปกันไม่ผ่าน', () => {
  const c = { ...base, variants: [{ groupId: 'a', text: textA }, { groupId: 'b', text: `${textA} ครับ` }] };
  const r = checkSlot(c, valuePlan, { brand });
  assert.ok(r.issues.some((i) => i.includes('เหมือนข้อความของกลุ่ม a')));
});

test('ต้องมีข้อความครบทุกกลุ่ม และไม่มีกลุ่มเกิน', () => {
  const c = { ...base, variants: [{ groupId: 'a', text: textA }, { groupId: 'zzz', text: textB }] };
  const r = checkSlot(c, valuePlan, { brand });
  assert.ok(r.issues.some((i) => i.includes('ไม่มีข้อความของกลุ่ม b')));
  assert.ok(r.issues.some((i) => i.includes('zzz')));
});

test('หัวข้อ/แคปชันซ้ำของเก่าไม่ผ่าน', () => {
  const r = checkSlot(base, valuePlan, { brand, history: { topics: ['backup ฐานข้อมูล!'], captions: [caption] } });
  assert.ok(r.issues.some((i) => i.includes('หัวข้อซ้ำ')));
  assert.ok(r.issues.some((i) => i.includes('คล้ายโพสต์เก่า')));
});

test('แฮชแท็กเกิน 3 ไม่ผ่าน', () => {
  const r = checkSlot({ ...base, caption: `${caption} #a #b #c #d` }, valuePlan, { brand });
  assert.ok(r.issues.some((i) => i.includes('แฮชแท็ก')));
});

test('similarity ของข้อความไทย', () => {
  assert.equal(similarity('ระบบสต็อกสินค้า', 'ระบบสต็อกสินค้า'), 1);
  assert.ok(similarity('ระบบสต็อกสินค้า', 'ระบบหอพัก') < 0.3);
});
