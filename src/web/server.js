// Dashboard: router + ล็อกอิน + CSRF — หน้าต่างๆ อยู่ใน ./pages/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env, mediaDir } from '../env.js';
import { esc, layout } from './ui.js';
import { routes as queue } from './pages/queue.js';
import { routes as post } from './pages/post.js';
import { routes as history } from './pages/history.js';
import { routes as groups } from './pages/groups.js';
import { routes as brand } from './pages/brand.js';
import { routes as pillars } from './pages/pillars.js';
import { routes as settings } from './pages/settings.js';
import { routes as drafts } from './pages/drafts.js';
import { routes as now } from './pages/now.js';
import { routes as themes } from './pages/themes.js';
import { routes as newsPage } from './pages/news.js';

const ROUTES = [...queue, ...drafts, ...now, ...themes, ...newsPage, ...post, ...history, ...groups, ...brand, ...pillars, ...settings];
const COOKIE = 'strata_sid';
const MAX_BODY = 1_000_000;

// session ผูกกับรหัสผ่าน: เปลี่ยนรหัสแล้วทุก session เดิมหลุดเอง
export const sessionToken = () => crypto.createHmac('sha256', env.sessionSecret).update(`ok:${env.dashboardPassword}`).digest('hex');
export const sessionCookie = () => `${COOKIE}=${sessionToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${env.publicUrl.startsWith('https://') ? '; Secure' : ''}`;
const csrfToken = () => crypto.createHmac('sha256', env.sessionSecret).update(`csrf:${sessionToken()}`).digest('hex').slice(0, 32);

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function authed(req) {
  if (!env.dashboardPassword) return true;
  const c = Object.fromEntries((req.headers.cookie ?? '').split(';').map((x) => x.trim().split('=')));
  return safeEqual(c[COOKIE], sessionToken());
}

async function readForm(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw Object.assign(new Error('ข้อมูลใหญ่เกินไป'), { status: 413 });
  }
  // ช่องที่ชื่อซ้ำ (เช่น checkbox หลายอัน) เก็บเป็น array
  const out = {};
  for (const [k, v] of new URLSearchParams(body)) {
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

const send = (res, status, body, type = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(status, {
    'content-type': type, 'cache-control': 'no-store',
    'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', ...extra,
  });
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

function loginPage(error = '') {
  return layout({
    title: 'Strata · เข้าสู่ระบบ', nav: false,
    body: `<div class="card" style="max-width:360px;margin:12vh auto 0"><h2 style="margin-top:0">Strata Automation</h2>
      ${error ? `<p class="bad">${esc(error)}</p>` : ''}
      <form method="post" action="/login"><input type="password" name="password" placeholder="รหัสผ่าน" autofocus>
      <div class="actions"><button class="primary">เข้าสู่ระบบ</button></div></form></div>`,
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/login' && req.method === 'GET') return send(res, 200, loginPage());
  if (p === '/login' && req.method === 'POST') {
    const { password } = await readForm(req);
    const ok = env.dashboardPassword && password && safeEqual(
      crypto.createHash('sha256').update(String(password)).digest('hex'),
      crypto.createHash('sha256').update(env.dashboardPassword).digest('hex'));
    if (!ok) return send(res, 401, loginPage('รหัสผ่านไม่ถูกต้อง'));
    return redirect(res, '/', { 'set-cookie': sessionCookie() });
  }
  if (!authed(req)) return req.method === 'GET' ? redirect(res, '/login') : send(res, 401, 'unauthorized', 'text/plain');
  if (p === '/logout' && req.method === 'POST') return redirect(res, '/login', { 'set-cookie': `${COOKIE}=; HttpOnly; Path=/; Max-Age=0` });
  if (p.startsWith('/media/') && req.method === 'GET') return serveMedia(res, decodeURIComponent(p.slice(7)));

  const route = ROUTES.find(([m, re]) => m === req.method && re.test(p));
  if (!route) return send(res, 404, layout({ title: 'ไม่พบหน้า', body: '<div class="empty">ไม่พบหน้านี้</div>' }));

  const ctx = {
    req, url, query: url.searchParams, csrf: csrfToken(), form: {},
    flash: { ok: url.searchParams.get('ok'), err: url.searchParams.get('err') },
  };
  if (req.method === 'POST') {
    ctx.form = await readForm(req);
    if (!safeEqual(ctx.form._csrf, ctx.csrf)) return send(res, 403, 'CSRF token ไม่ถูกต้อง — รีเฟรชหน้าแล้วลองใหม่', 'text/plain; charset=utf-8');
  }
  const out = await route[2](ctx, p.match(route[1]));
  if (out.redirect) return redirect(res, out.redirect, out.headers);
  return send(res, out.status ?? 200, out.html, undefined, out.headers);
}

export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) send(res, e.status ?? 500, layout({ title: 'ผิดพลาด', body: `<div class="flash bad">${esc(e.message)}</div>` }));
    });
  });
}

export function startServer() {
  if (!env.dashboardPassword) console.warn('⚠ ไม่ได้ตั้ง DASHBOARD_PASSWORD — ใครก็เข้า Dashboard ได้');
  const server = createServer();
  server.listen(env.port, env.host, () => console.log(`Dashboard: http://${env.host}:${env.port}  (public: ${env.publicUrl})`));
  return server;
}
