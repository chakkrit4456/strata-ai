// ธีมภาพโพสต์: ชุดสี ฟอนต์ ลวดลายพื้นหลัง และการจัดวาง — "strata" คือธีมของเพจ (โทนเดียวกับหน้าปก)
// font ต้องเป็นฟอนต์ที่มีใน Google Fonts และรองรับภาษาไทย

export const BRAND_THEME = 'strata';

export const THEMES = [
  {
    id: 'strata', name: 'Strata (ธีมเพจ)', brand: true,
    colors: { bg: '#0d0f12', panel: '#15181d', line: '#262a31', text: '#f2ece1', muted: '#8d939c', accent: '#5fe3b3', accent2: '#c9a35c', onAccent: '#08100c' },
    font: 'IBM Plex Sans Thai', mono: 'JetBrains Mono', decor: 'frame', align: 'left', photo: 'faint',
    mood: 'dark tech, deep charcoal with mint green accents, clean geometric lines',
  },
  {
    id: 'paper', name: 'กระดาษครีม มินิมอล',
    colors: { bg: '#f4efe6', panel: '#ffffff', line: '#e2d9c8', text: '#1e1b16', muted: '#7a7064', accent: '#d9502f', accent2: '#2f6fd9', onAccent: '#ffffff' },
    font: 'Noto Serif Thai', mono: 'JetBrains Mono', decor: 'none', align: 'left', photo: 'card',
    mood: 'warm cream paper texture, minimal editorial, soft daylight',
  },
  {
    id: 'sunset', name: 'ส้มพระอาทิตย์ตก',
    colors: { bg: '#2a1033', panel: '#3a1a45', line: '#57305f', text: '#fff4ea', muted: '#e2b9c8', accent: '#ff8a3d', accent2: '#ff4f7b', onAccent: '#2a1033' },
    font: 'Kanit', mono: 'JetBrains Mono', decor: 'gradient', align: 'center', photo: 'full',
    mood: 'vibrant sunset gradient, purple to orange, dreamy and energetic',
  },
  {
    id: 'ocean', name: 'ฟ้าทะเล สดใส',
    colors: { bg: '#e8f4ff', panel: '#ffffff', line: '#c6def5', text: '#0b2540', muted: '#4f6b88', accent: '#0a7cff', accent2: '#00b3a4', onAccent: '#ffffff' },
    font: 'Prompt', mono: 'JetBrains Mono', decor: 'dots', align: 'left', photo: 'card',
    mood: 'bright airy sky blue, friendly modern startup, soft shapes',
  },
  {
    id: 'neon', name: 'นีออน ไซเบอร์',
    colors: { bg: '#07040f', panel: '#120b24', line: '#2b1d52', text: '#f1ecff', muted: '#a597d6', accent: '#ff2bd6', accent2: '#21f0ff', onAccent: '#07040f' },
    font: 'Chakra Petch', mono: 'JetBrains Mono', decor: 'grid', align: 'left', photo: 'full',
    mood: 'cyberpunk neon city at night, magenta and cyan glow, futuristic',
  },
  {
    id: 'forest', name: 'เขียวธรรมชาติ',
    colors: { bg: '#10221a', panel: '#173026', line: '#25463a', text: '#eef6ea', muted: '#9fbfaa', accent: '#b6e36b', accent2: '#f0c75e', onAccent: '#10221a' },
    font: 'Bai Jamjuree', mono: 'JetBrains Mono', decor: 'blob', align: 'left', photo: 'faint',
    mood: 'calm forest greens, natural leaves and soft light, organic shapes',
  },
  {
    id: 'pop', name: 'ป๊อปอาร์ต สีสด',
    colors: { bg: '#ffd84d', panel: '#ffffff', line: '#1b1b1b', text: '#111111', muted: '#3d3d3d', accent: '#ff3b3b', accent2: '#2457ff', onAccent: '#ffffff' },
    font: 'Mitr', mono: 'JetBrains Mono', decor: 'stripes', align: 'center', photo: 'card',
    mood: 'bold pop art comic style, halftone dots, playful bright colors',
  },
  {
    id: 'mono', name: 'ขาวดำ คลาสสิก',
    colors: { bg: '#ffffff', panel: '#f3f3f3', line: '#dddddd', text: '#111111', muted: '#666666', accent: '#111111', accent2: '#888888', onAccent: '#ffffff' },
    font: 'Sarabun', mono: 'JetBrains Mono', decor: 'none', align: 'center', photo: 'card',
    mood: 'black and white high contrast photography, elegant minimal',
  },
  {
    id: 'lavender', name: 'ม่วงพาสเทล',
    colors: { bg: '#f3eefe', panel: '#ffffff', line: '#ddd2f7', text: '#2a1f4a', muted: '#7a6ea3', accent: '#7c4dff', accent2: '#ff7eb3', onAccent: '#ffffff' },
    font: 'Mitr', mono: 'JetBrains Mono', decor: 'blob', align: 'left', photo: 'faint',
    mood: 'soft pastel lavender and pink, cute 3d shapes, gentle',
  },
  {
    id: 'blueprint', name: 'พิมพ์เขียววิศวกร',
    colors: { bg: '#0f3b78', panel: '#14498f', line: '#3c6fb3', text: '#eaf3ff', muted: '#a9c4ea', accent: '#ffffff', accent2: '#ffd166', onAccent: '#0f3b78' },
    font: 'Chakra Petch', mono: 'JetBrains Mono', decor: 'grid', align: 'left', photo: 'faint',
    mood: 'technical blueprint drawing, white lines on blue, engineering schematics',
  },
];

export const getTheme = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const isTheme = (id) => THEMES.some((t) => t.id === id);

// สไตล์คำบรรยาย — ส่งให้ AI เป็นแนวทางการเขียน
export const TONES = [
  { id: 'friendly', name: 'เป็นกันเองแบบพี่ dev', brief: 'เป็นกันเอง ใช้ภาษาพูด เหมือนพี่ dev เล่าให้เพื่อนฟัง' },
  { id: 'pro', name: 'มืออาชีพ น่าเชื่อถือ', brief: 'สุภาพ เป็นทางการพอประมาณ เน้นข้อมูลและความน่าเชื่อถือ' },
  { id: 'story', name: 'เล่าเรื่อง', brief: 'เปิดด้วยสถานการณ์หรือเรื่องเล่าสั้นๆ แล้วค่อยเข้าประเด็น' },
  { id: 'punchy', name: 'สั้น กระชับ ตรงประเด็น', brief: 'ประโยคสั้น ขึ้นบรรทัดบ่อย อ่านจบใน 15 วินาที แคปชันไม่เกิน 500 ตัวอักษร' },
  { id: 'fun', name: 'ขำๆ มีมๆ', brief: 'ขำ เล่นมุก ใช้มุกสายเดฟที่คนในวงการเข้าใจ แต่ไม่หยาบ' },
  { id: 'news', name: 'สรุปข่าว', brief: 'สรุปประเด็นข่าวเป็นข้อๆ แล้วบอกว่ากระทบธุรกิจ/คนทำงานอย่างไร' },
  { id: 'question', name: 'ชวนคุย/ถามคำถาม', brief: 'ตั้งคำถามให้คนอยากคอมเมนต์ เล่าแค่พอให้เกิดความเห็น' },
];

export const getTone = (id) => TONES.find((t) => t.id === id) ?? TONES[0];
export const isTone = (id) => TONES.some((t) => t.id === id);

/**
 * เลือกธีม/สไตล์ให้โพสต์อัตโนมัติ: โหมด mix = ใช้ธีมเพจทุกๆ N โพสต์ ที่เหลือสุ่มไม่ซ้ำ 3 โพสต์ล่าสุด
 * @param {{ mode: 'mix'|'random'|'brand', every: number, recent: {theme?: string, tone?: string}[], rand?: () => number }} o
 */
export function pickStyle({ mode = 'mix', every = 3, recent = [], rand = Math.random }) {
  const recentThemes = recent.slice(0, 3).map((p) => p.theme).filter(Boolean);
  const sinceBrand = recent.findIndex((p) => p.theme === BRAND_THEME);
  const useBrand = mode === 'brand' || (mode === 'mix' && (sinceBrand === -1 ? recent.length >= every - 1 : sinceBrand >= every - 1));
  let theme = BRAND_THEME;
  if (!useBrand) {
    const fresh = THEMES.filter((t) => !t.brand && !recentThemes.includes(t.id));
    const pool = fresh.length ? fresh : THEMES.filter((t) => !t.brand);
    theme = pool[Math.floor(rand() * pool.length)].id;
  }
  const recentTones = recent.slice(0, 2).map((p) => p.tone).filter(Boolean);
  const tones = TONES.filter((t) => !recentTones.includes(t.id));
  return { theme, tone: tones[Math.floor(rand() * tones.length)].id };
}
