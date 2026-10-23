// Dashboard: อนุมัติโพสต์เพจ + คิวโพสต์ลงกลุ่ม (คัดลอกข้อความ / ดาวน์โหลดภาพ / เปิดกลุ่ม / กดว่าโพสต์แล้ว)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env, mediaDir } from '../env.js';
import { loadGroups } from '../config.js';
import { today, addDays, SLOT_LABEL } from '../time.js';
import * as db from '../db.js';
import { publishPost } from '../jobs.js';
import { renderDay, renderLogin } from './views.js';

const COOKIE = 'strata_sid';
const token = () => crypto.createHmac('sha256', env.sessionSecret).update(`ok:${env.dashboardPassword}`).digest('hex');

function authed(req) {
  if (!env.dashboardPassword) return true;
  const c = Object.fromEntries((req.headers.cookie ?? '').split(';').map((x) => x.trim().split('=')));
  const a = Buffer.from(c[COOKIE] ?? '');
  const b = Buffer.from(token());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readForm(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1e5) throw new Error('body too large');
  }
  return Object.fromEntries(new URLSearchParams(body));
}

const send = (res, status, body, type = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...extra });
  res.end(body);
};
const redirect = (res, to, extra = {}) => send(res, 303, '', 'text/plain', { location: to, ...extra });

function serveMedia(res, rel) {
  const root = mediaDir();
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private, max-age=86400' });
  fs.createReadStream(file).pipe(res);
}

export const mediaUrl = (abs) => (abs ? `/media/${path.relative(mediaDir(), abs).split(path.sep).join('/')}` : '');

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/login' && req.method === 'GET') return send(res, 200, renderLogin());
  if (p === '/login' && req.method === 'POST') {
    const { password } = await readForm(req);
    const ok = env.dashboardPassword && password &&
      crypto.timingSafeEqual(crypto.createHash('sha256').update(password).digest(), crypto.createHash('sha256').update(env.dashboardPassword).digest());
    if (!ok) return send(res, 401, renderLogin('รหัสผ่านไม่ถูกต้อง'));
    return redirect(res, '/', { 'set-cookie': `${COOKIE}=${token()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
  }
  if (!authed(req)) return redirect(res, '/login');

  if (p.startsWith('/media/')) return serveMedia(res, decodeURIComponent(p.slice(7)));

  if (req.method === 'GET' && p === '/') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') ?? '') ? url.searchParams.get('date') : today();
    const posts = db.postsForDate(date).map((post) => ({
      ...post,
      imageUrl: mediaUrl(post.image_path),
      softImageUrl: mediaUrl(post.soft_image_path),
      items: db.itemsForPost(post.id),
    }));
    return send(res, 200, renderDay({
      date, prev: addDays(date, -1), next: addDays(date, 1), isToday: date === today(),
      posts, groups: loadGroups(), slotLabel: SLOT_LABEL, requireApproval: env.requireApproval,
    }));
  }

  if (req.method === 'POST') {
    const back = req.headers.referer && new URL(req.headers.referer).pathname === '/' ? new URL(req.headers.referer).search : '';
    let m;
    if ((m = p.match(/^\/post\/(\d+)\/(approve|publish|skip|reject)$/))) {
      const post = db.getPost(Number(m[1]));
      if (!post) return send(res, 404, 'not found', 'text/plain');
      if (m[2] === 'approve' && post.status === 'pending_approval') db.updatePost(post.id, { status: 'approved' });
      if (m[2] === 'skip' && post.status !== 'published') db.updatePost(post.id, { status: 'skipped' });
      if (m[2] === 'publish' && ['pending_approval', 'approved', 'failed'].includes(post.status)) {
        if (post.status !== 'approved') db.updatePost(post.id, { status: 'approved' });
        await publishPost(post.id);
      }
      return redirect(res, `/${back}`);
    }
    if ((m = p.match(/^\/item\/(\d+)\/(done|skip|undo)$/))) {
      db.setItemStatus(Number(m[1]), { done: 'done', skip: 'skipped', undo: 'queued' }[m[2]]);
      return redirect(res, `/${back}#item-${m[1]}`);
    }
  }
  return send(res, 404, 'not found', 'text/plain');
}

export function startServer() {
  if (!env.dashboardPassword) console.warn('⚠ ไม่ได้ตั้ง DASHBOARD_PASSWORD — ใครก็เข้า Dashboard ได้');
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) send(res, 500, `<pre>${String(e.message).replace(/</g, '&lt;')}</pre>`);
    });
  });
  server.listen(env.port, env.host, () => console.log(`Dashboard: http://${env.host}:${env.port}  (public: ${env.publicUrl})`));
  return server;
}
