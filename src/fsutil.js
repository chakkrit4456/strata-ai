import fs from 'node:fs';
import path from 'node:path';

/** เขียนไฟล์แบบไม่ทิ้งไฟล์ครึ่งๆ กลางๆ: เขียนไฟล์ชั่วคราวแล้ว rename และเก็บของเดิมเป็น .bak */
export function writeAtomic(file, content, { mode } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, mode ? { mode } : undefined);
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.renameSync(tmp, file);
}
