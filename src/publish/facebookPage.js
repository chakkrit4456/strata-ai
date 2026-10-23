// โพสต์ภาพ + แคปชันลงเพจผ่าน Graph API (ช่องทางทางการของ Meta)
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

const api = (p) => `https://graph.facebook.com/${env.fbGraphVersion}/${p}`;

async function call(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    throw new Error(`Graph API ${res.status}: ${e.message ?? 'unknown error'} (code ${e.code ?? '-'}${e.error_subcode ? `/${e.error_subcode}` : ''})`);
  }
  return body;
}

/**
 * @param {{ caption: string, imagePath: string, published?: boolean }} o
 * published=false ใช้ทดสอบ token โดยไม่แสดงโพสต์ต่อสาธารณะ
 * @returns {Promise<{ postId: string, permalink: string }>}
 */
export async function publishPhoto({ caption, imagePath, published = true }) {
  if (!env.fbPageId || !env.fbPageToken) throw new Error('ยังไม่ได้ตั้ง FB_PAGE_ID / FB_PAGE_TOKEN ใน .env');
  const form = new FormData();
  form.set('message', caption);
  form.set('published', String(published));
  form.set('access_token', env.fbPageToken);
  form.set('source', new Blob([fs.readFileSync(imagePath)], { type: 'image/png' }), path.basename(imagePath));

  const body = await call(api(`${env.fbPageId}/photos`), { method: 'POST', body: form });
  const postId = body.post_id ?? body.id;
  let permalink = `https://www.facebook.com/${postId}`;
  if (published) {
    try {
      const info = await call(api(`${postId}?fields=permalink_url&access_token=${encodeURIComponent(env.fbPageToken)}`));
      if (info.permalink_url) permalink = info.permalink_url;
    } catch { /* ใช้ลิงก์แบบ id แทน */ }
  }
  return { postId, permalink };
}

// ตรวจว่า token ใช้กับเพจนี้ได้ และมีสิทธิ์อะไรบ้าง
export async function checkToken() {
  const me = await call(api(`me?fields=id,name&access_token=${encodeURIComponent(env.fbPageToken)}`));
  return { id: me.id, name: me.name, matchesPage: me.id === env.fbPageId };
}
