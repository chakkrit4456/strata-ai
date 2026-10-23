// เรนเดอร์เทมเพลตทั้ง 5 แบบด้วยข้อมูลตัวอย่าง (ไม่เรียก AI) ใช้ตรวจหน้าตาภาพ/ฟอนต์บนเครื่องหรือเซิร์ฟเวอร์
import path from 'node:path';
import { ROOT } from './env.js';
import { loadBrand } from './config.js';
import { renderImage, closeRenderer } from './image/render.js';

const base = { kicker: '', subhead: '', bullets: [], code: '', options: [], cta: '', packageId: 'all' };
const SAMPLES = {
  tip: { ...base, kicker: 'DEV TIP', headline: 'Backup ฐานข้อมูล|ก่อนอัปเดตทุกครั้ง', subhead: 'คำสั่งเดียว กันน้ำตาไหลตอนตีสอง', bullets: ['ตั้ง cron ให้ dump ทุกคืน', 'เก็บไว้นอกเครื่องอย่างน้อย 1 ชุด'], code: 'pg_dump -Fc shop > shop_$(date +%F).dump', cta: 'เซฟเก็บไว้ใช้ได้เลย' },
  showcase: { ...base, kicker: 'PROJECT', headline: 'ระบบสต็อกที่|ไม่ต้องนับมือ', subhead: 'รู้ยอดคงเหลือทุกสาขาแบบเรียลไทม์', bullets: ['แจ้งเตือนของใกล้หมด', 'รับ-จ่ายผ่านมือถือ', 'รายงาน Excel/PDF', 'แยกสิทธิ์พนักงาน'], cta: 'ทักแชทเพจ ประเมินราคาฟรี' },
  package: { ...base, kicker: 'PACKAGE', headline: 'มีเว็บร้านของตัวเอง|เริ่มต้นหลักพัน', subhead: 'เลือกขนาดที่พอดีกับธุรกิจ', cta: 'ทักแชทเพจ ประเมินราคาฟรี', packageId: 'all' },
  fun: { ...base, kicker: 'REAL TALK', headline: 'ลูกค้า: "ขอแก้นิดเดียวครับ"', subhead: 'ผ่านไป 3 วัน: เปลี่ยนทั้งระบบ', cta: 'ใครเคยเจอบ้าง ยกมือ' },
  question: { ...base, kicker: 'POLL', headline: 'ร้านเล็กๆ ควรเริ่มจาก|อะไรก่อน?', options: ['เว็บไซต์หน้าร้าน', 'ระบบสต็อก', 'ระบบจอง/สั่งซื้อ', 'เพจอย่างเดียวพอ'], cta: 'ตอบในคอมเมนต์ได้เลย' },
};

const brand = loadBrand();
const outDir = path.join(ROOT, 'out', 'preview');
try {
  for (const [layout, image] of Object.entries(SAMPLES)) {
    const r = await renderImage({ layout, image, brand, outFile: path.join(outDir, `${layout}.png`) });
    console.log(`${layout}: ${r.file}${r.overflow ? '  ⚠ ข้อความล้นกรอบ' : ''}`);
  }
  const one = { ...SAMPLES.package, packageId: 'backoffice', headline: 'เว็บพร้อมหลังบ้าน|แก้สินค้าเองได้' };
  const r = await renderImage({ layout: 'package', image: one, brand, outFile: path.join(outDir, 'package-single.png') });
  console.log(`package-single: ${r.file}`);
} finally {
  await closeRenderer();
}
