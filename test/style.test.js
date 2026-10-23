import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStyle, THEMES, TONES, BRAND_THEME } from '../src/image/themes.js';
import { parseFeed, decode } from '../src/news/rss.js';
import { checkSlot } from '../src/content/guard.js';
import { loadBrand } from '../src/config.js';

// จำลองการเลือกธีมต่อเนื่อง N โพสต์
function run(mode, n, every = 3) {
  const recent = [];
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) recent.unshift(pickStyle({ mode, every, recent, rand }));
  return recent.reverse();
}

test('โหมดผสม: ใช้ธีมเพจทุกๆ 3 โพสต์ ที่เหลือไม่ซ้ำกัน 3 โพสต์ติด', () => {
  const s = run('mix', 30);
  const brandIdx = s.map((x, i) => (x.theme === BRAND_THEME ? i : -1)).filter((i) => i >= 0);
  assert.ok(brandIdx.length >= 9 && brandIdx.length <= 11, `brand ${brandIdx.length}`);
  for (let i = 1; i < brandIdx.length; i++) assert.equal(brandIdx[i] - brandIdx[i - 1], 3);
  for (let i = 1; i < s.length; i++) if (s[i].theme !== BRAND_THEME) assert.notEqual(s[i].theme, s[i - 1].theme);
});

test('โหมดสุ่ม: ไม่ใช้ธีมเพจ และไม่ซ้ำ 3 โพสต์ล่าสุด, น้ำเสียงไม่ซ้ำ 2 โพสต์ล่าสุด', () => {
  const s = run('random', 40);
  for (let i = 0; i < s.length; i++) {
    assert.notEqual(s[i].theme, BRAND_THEME);
    for (let k = 1; k <= 3 && i - k >= 0; k++) assert.notEqual(s[i].theme, s[i - k].theme);
    for (let k = 1; k <= 2 && i - k >= 0; k++) assert.notEqual(s[i].tone, s[i - k].tone);
  }
  assert.ok(new Set(s.map((x) => x.theme)).size >= THEMES.length - 2);
  assert.ok(new Set(s.map((x) => x.tone)).size >= TONES.length - 1);
});

test('โหมดธีมเพจ: ธีมเพจทุกโพสต์', () => {
  assert.ok(run('brand', 5).every((x) => x.theme === BRAND_THEME));
});

test('อ่าน RSS และ Atom ได้', () => {
  const rss = `<rss><channel><item><title><![CDATA[ข่าว &amp; เทค]]></title><link>https://a.com/1</link>
    <pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;สรุป&lt;/p&gt;</description></item></channel></rss>`;
  const atom = `<feed><entry><title>Atom news</title><link rel="alternate" href="https://b.com/2"/><updated>2026-10-23T08:00:00Z</updated>
    <summary>sum</summary></entry></feed>`;
  assert.deepEqual(parseFeed(rss)[0], { title: 'ข่าว & เทค', url: 'https://a.com/1', publishedAt: '2026-10-23T10:00:00.000Z', summary: 'สรุป' });
  assert.equal(parseFeed(atom)[0].url, 'https://b.com/2');
  assert.equal(decode('A&#3585;&#x0E02;'), 'Aกข');
});

test('ตัวตรวจ: ข่าวต้องมาจากรายการ และต้องบอกที่มา', () => {
  const brand = loadBrand();
  const img = { kicker: 'NEWS', headline: 'ข่าว', subhead: '', bullets: [], code: '', options: [], cta: '', packageId: 'all' };
  const base = {
    topic: 'ข่าว AI', caption: `${'สรุปข่าวล่าสุดให้คนทำธุรกิจเข้าใจง่ายๆ ว่ากระทบอะไรบ้าง '.repeat(4)} ที่มา: Blognone`,
    hashtags: [], image: img, softImage: img, variants: [],
  };
  const news = [{ url: 'https://blognone.com/x', source: 'Blognone', title: 't' }];
  const plan = { isPromo: false, groups: [] };
  assert.deepEqual(checkSlot({ ...base, newsUrl: 'https://blognone.com/x' }, plan, { brand, news, requireNews: true }).issues, []);
  assert.match(checkSlot({ ...base, newsUrl: 'https://fake.com/y' }, plan, { brand, news }).issues.join(), /ห้ามแต่งข่าว/);
  assert.match(checkSlot({ ...base, newsUrl: '' }, plan, { brand, news, requireNews: true }).issues.join(), /ต้องเลือกข่าว/);
  assert.match(checkSlot({ ...base, caption: base.caption.replace('Blognone', 'ที่ไหนสักแห่ง'), newsUrl: 'https://blognone.com/x' }, plan, { brand, news }).issues.join(), /ที่มา/);
});
