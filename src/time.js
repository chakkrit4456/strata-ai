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
