// ดึงข่าวล่าสุดจากทุกแหล่งที่เปิดใช้ แล้วเก็บลงฐานข้อมูล (ข่าวซ้ำลิงก์เดิมจะถูกข้าม)
import { loadNews } from '../config.js';
import * as db from '../db.js';
import { parseFeed, googleNewsUrl } from './rss.js';

const UA = 'Mozilla/5.0 (compatible; StrataNewsBot/1.0; +https://strata.itdev.in.th)';

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, text/xml, */*' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** @returns {Promise<{ source: string, ok: boolean, found: number, added: number, error?: string }[]>} */
export async function fetchAllNews() {
  const cfg = loadNews();
  const jobs = [
    ...cfg.feeds.filter((f) => f.enabled).map((f) => ({ source: f.name, lang: f.lang, focus: f.focus, url: f.url })),
    ...cfg.googleNews.map((q) => ({ source: `Google News: ${q}`, lang: 'th', url: googleNewsUrl(q), limit: 8 })),
  ];
  const maxAge = Date.now() - cfg.maxAgeDays * 86_400_000;
  const results = await Promise.all(jobs.map(async (j) => {
    try {
      const items = parseFeed(await get(j.url))
        .filter((n) => !n.publishedAt || Date.parse(n.publishedAt) >= maxAge)
        .slice(0, j.limit ?? 20)
        .map((n) => ({
          ...n,
          // Google News ใส่ชื่อสำนักข่าวต่อท้ายหัวข้อ " - สำนักข่าว"
          source: j.source.startsWith('Google News') ? (n.title.match(/ - ([^-]+)$/)?.[1]?.trim() ?? 'Google News') : j.source,
          title: j.source.startsWith('Google News') ? n.title.replace(/ - [^-]+$/, '') : n.title,
          lang: j.lang,
          focus: j.focus ?? 'general',
        }));
      return { source: j.source, ok: true, found: items.length, added: db.upsertNews(items) };
    } catch (e) {
      return { source: j.source, ok: false, found: 0, added: 0, error: e.message };
    }
  }));
  db.pruneNews(14);
  const added = results.reduce((n, r) => n + r.added, 0);
  db.logRun('news', results.some((r) => r.ok), `ข่าวใหม่ ${added} รายการ · ${results.filter((r) => !r.ok).map((r) => `${r.source}: ${r.error}`).join(' · ')}`);
  return results;
}
