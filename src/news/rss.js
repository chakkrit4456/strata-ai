// อ่าน RSS / Atom แบบเบาๆ (ไม่ต้องใช้ไลบรารี) — เอาแค่ชื่อข่าว ลิงก์ วันที่ และเนื้อสั้นๆ
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const entities = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  }
  return ENT[e.toLowerCase()] ?? m;
});

// คำอธิบายข่าวมักเป็น HTML ที่ถูก escape มาอีกชั้น (&lt;p&gt;) จึงถอด entity ก่อนแล้วค่อยลบแท็ก
export function decode(s) {
  const raw = String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return entities(entities(raw).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

/**
 * @returns {{ title: string, url: string, publishedAt: string, summary: string }[]}
 */
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    let url = decode(tag(b, 'link'));
    if (!url) url = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i)?.[1] ?? b.match(/<link[^>]*href=["']([^"']+)/i)?.[1] ?? '';
    const date = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const t = Date.parse(date);
    return {
      title: decode(tag(b, 'title')).slice(0, 300),
      url: url.trim(),
      publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : '',
      summary: decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 600),
    };
  }).filter((x) => x.title && /^https?:\/\//.test(x.url));
}

export const googleNewsUrl = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:3d`)}&hl=th&gl=TH&ceid=TH:th`;
