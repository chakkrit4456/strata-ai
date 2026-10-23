#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { env, ROOT } from './env.js';
import { today, SLOTS } from './time.js';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    date: { type: 'string' },
    dry: { type: 'boolean', default: false },
    test: { type: 'boolean', default: false },
  },
});
const [cmd, arg] = positionals;
const date = values.date ?? today();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date ต้องเป็น YYYY-MM-DD');

const HELP = `ใช้งาน:
  generate [--date YYYY-MM-DD] [--dry]   สร้างคอนเทนต์ + ภาพของวัน (--dry = ไม่บันทึก ไม่โพสต์ ดูผลใน out/)
  publish <morning|evening> [--date]      โพสต์ลงเพจตามรอบ (ใช้กับ timer)
  publish --test                          ทดสอบ token ด้วยการโพสต์ภาพตัวอย่างแบบไม่เผยแพร่
  serve                                   เปิด Dashboard
  check [--test]                          ตรวจการตั้งค่า (--test = ส่งข้อความทดสอบเข้า Telegram)
  preview                                 เรนเดอร์ภาพตัวอย่างทุกเทมเพลตลง out/preview`;

switch (cmd) {
  case 'generate': {
    const { generateDay } = await import('./jobs.js');
    const res = await generateDay({ date, dry: values.dry });
    process.exitCode = res.some((r) => r.error) ? 1 : 0;
    break;
  }
  case 'publish': {
    if (values.test) {
      const { publishPhoto } = await import('./publish/facebookPage.js');
      const img = path.join(ROOT, 'out', 'preview', 'tip.png');
      if (!fs.existsSync(img)) throw new Error('ยังไม่มี out/preview/tip.png — รัน npm run preview ก่อน');
      const r = await publishPhoto({ caption: 'ทดสอบระบบ Strata Automation (ไม่เผยแพร่)', imagePath: img, published: false });
      console.log(`✓ Graph API ใช้งานได้ (photo id ${r.postId}, ไม่ได้เผยแพร่)`);
      break;
    }
    if (!SLOTS.includes(arg)) throw new Error(`ต้องระบุรอบ: ${SLOTS.join(' | ')}`);
    const { publishSlot } = await import('./jobs.js');
    const post = await publishSlot({ date, slot: arg });
    console.log(post ? `${arg}: ${post.status}${post.permalink ? ` ${post.permalink}` : ''}${post.error ? ` — ${post.error}` : ''}` : `${arg}: ไม่มีโพสต์`);
    if (post?.status === 'failed') process.exitCode = 1;
    break;
  }
  case 'serve': {
    const { startServer } = await import('./web/server.js');
    startServer();
    break;
  }
  case 'check': {
    const { runHealth } = await import('./health.js');
    console.log(`โหมดอนุมัติ: ${env.requireApproval ? 'เปิด' : 'ปิด'} | AI: ${env.aiProviders.join(' → ')}`);
    const rows = await runHealth({ telegramTest: values.test });
    for (const r of rows) console.log(`${r.warn ? '!' : r.ok === null ? '·' : r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    if (rows.some((r) => r.ok === false)) process.exitCode = 1;
    break;
  }
  case 'preview':
    await import('./preview.js');
    break;
  default:
    console.log(HELP);
}
