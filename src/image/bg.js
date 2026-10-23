// พื้นหลังเสริม (ไม่บังคับ): สุ่มภาพจากโฟลเดอร์ BG_IMAGE_DIR เช่น ภาพ abstract ที่สร้างจาก AI ไว้ล่วงหน้า
// ภาพต้องไม่มีตัวอักษร เพราะตัวอักษรทั้งหมดวาดด้วย HTML
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export function pickBackground(dir = env.bgImageDir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => TYPES[path.extname(f).toLowerCase()]);
  if (!files.length) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  const data = fs.readFileSync(path.join(dir, file)).toString('base64');
  return `data:${TYPES[path.extname(file).toLowerCase()]};base64,${data}`;
}
