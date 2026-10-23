import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pickBackground } from './bg.js';
import { getTheme } from './themes.js';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'template.html');
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/gu;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

let browser;

async function getBrowser() {
  browser ??= await chromium.launch({ args: ['--font-render-hinting=none'] });
  return browser;
}

export async function closeRenderer() {
  await browser?.close();
  browser = undefined;
}

const stripEmoji = (img) => JSON.parse(JSON.stringify(img, (_, v) => (typeof v === 'string' ? v.replace(EMOJI, '').trim() : v)));

function dataUrl(file) {
  if (!file || !fs.existsSync(file)) return null;
  return `data:${MIME[path.extname(file).toLowerCase()] ?? 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * แปลงข้อมูลภาพเป็น PNG 1080x1350
 * @param {{ layout: string, image: object, brand: object, outFile: string, theme?: string, bgPath?: string|null }} o
 *   bgPath = ภาพพื้นหลังจาก AI (ถ้าไม่มี จะใช้ภาพจาก BG_IMAGE_DIR ถ้าตั้งไว้)
 * @returns {Promise<{file: string, overflow: boolean}>}
 */
export async function renderImage({ layout, image, brand, outFile, theme, bgPath = null }) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`file://${TEMPLATE.replace(/\\/g, '/')}`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.evaluate((data) => window.renderPost(data), {
      layout, image: stripEmoji(image), brand, theme: getTheme(theme), bg: dataUrl(bgPath) ?? pickBackground(),
    });
    const fit = await page.evaluate(() => window.fitContent());
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, type: 'png' });
    return { file: outFile, overflow: fit.overflow };
  } finally {
    await page.close();
  }
}
