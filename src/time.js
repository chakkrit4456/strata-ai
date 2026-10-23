import { env } from './env.js';
import { WEEKDAYS } from './config.js';

// วันที่ปัจจุบันตามเขตเวลาไทย รูปแบบ YYYY-MM-DD
export function today(tz = env.timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function weekday(date) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export const SLOTS = ['morning', 'evening'];
export const SLOT_LABEL = { morning: 'รอบเช้า', evening: 'รอบเย็น' };

/** ชื่อรอบสำหรับแสดงผล — โพสต์ด่วนเก็บเป็น slot "now-HHMMSS" */
export function slotLabel(slot) {
  if (SLOT_LABEL[slot]) return SLOT_LABEL[slot];
  const m = /^now-(\d{2})(\d{2})/.exec(slot ?? '');
  return m ? `โพสต์ด่วน ${m[1]}:${m[2]}` : String(slot ?? '');
}

/** เวลาปัจจุบันตามเขตเวลาไทย รูปแบบ HHMMSS */
export function clockId(tz = env.timezone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date()).replace(/\D/g, '');
}
