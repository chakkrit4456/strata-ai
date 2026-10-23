import fs from 'node:fs';
import path from 'node:path';
import { mediaDir } from '../../env.js';

export const STATUS = {
  pending_approval: ['รออนุมัติ', 'warn'],
  approved: ['อนุมัติแล้ว รอเวลาโพสต์', 'info'],
  published: ['โพสต์ลงเพจแล้ว', 'ok'],
  failed: ['โพสต์ไม่สำเร็จ', 'bad'],
  skipped: ['ข้าม', 'mute'],
};
export const ITEM = {
  waiting: ['รอโพสต์เพจก่อน', 'mute'],
  queued: ['พร้อมโพสต์', 'warn'],
  done: ['โพสต์แล้ว', 'ok'],
  skipped: ['ข้าม', 'mute'],
  expired: ['หมดอายุ', 'mute'],
};
export const MODE = { promo: 'โปรโมท', soft: 'ไม่ขาย (ปรับจากโปรโมท)', value: 'ให้ความรู้/สนุก' };
export const PROMO = { always: 'โปรโมทได้ทุกวัน', never: 'ห้ามขาย', days: 'โปรโมทได้บางวัน' };
export const DAY_LABEL = { mon: 'จ', tue: 'อ', wed: 'พ', thu: 'พฤ', fri: 'ศ', sat: 'ส', sun: 'อา' };

// ใส่ ?v=เวลาแก้ไขไฟล์ เพื่อให้เบราว์เซอร์โหลดภาพใหม่หลัง render ซ้ำ
export function mediaUrl(abs) {
  if (!abs) return '';
  const rel = path.relative(mediaDir(), abs).split(path.sep).join('/');
  let v = '';
  try { v = `?v=${Math.floor(fs.statSync(abs).mtimeMs)}`; } catch { /* ไฟล์ยังไม่มี */ }
  return `/media/${rel}${v}`;
}

export const redirect = (to, flash = {}) => {
  const q = new URLSearchParams();
  if (flash.ok) q.set('ok', flash.ok);
  if (flash.err) q.set('err', flash.err);
  const qs = q.toString();
  if (!qs) return { redirect: to };
  const [base, hash = ''] = to.split('#');
  return { redirect: `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` };
};
