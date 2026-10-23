// ภาพประกอบจาก AI (ไม่มีตัวอักษร) ใช้เป็นพื้นหลัง/ภาพในการ์ด — ฟรีทั้งหมด ล้มเหลวก็โพสต์ต่อได้โดยไม่มีภาพ
// ลำดับ: Pollinations (ฟรี ไม่ต้องใช้คีย์) → Gemini image (ใช้ได้เมื่อบัญชีมีโควตาภาพ)
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { env } from '../env.js';
import { getTheme } from './themes.js';

const NO_TEXT = 'no text, no letters, no words, no logo, no watermark, no signature';

export function imagePrompt(visual, themeId) {
  const t = getTheme(themeId);
  return `${String(visual || 'abstract technology concept').slice(0, 300)}. Style: ${t.mood}. Color palette ${t.colors.bg}, ${t.colors.accent}, ${t.colors.accent2}. Clean composition with empty space for text, ${NO_TEXT}`;
}

async function pollinations(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1350&nologo=true&model=flux&seed=${seed}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.startsWith('image/')) throw new Error(`pollinations ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5_000) throw new Error('pollinations: ภาพเล็กผิดปกติ');
  return { buf, ext: type.includes('png') ? '.png' : '.jpg' };
}

async function gemini(prompt) {
  if (!env.geminiKey) throw new Error('gemini: ไม่มีคีย์');
  const ai = new GoogleGenAI({ apiKey: env.geminiKey, httpOptions: { timeout: 90_000 } });
  const res = await ai.models.generateContent({
    model: env.geminiImageModel, contents: prompt,
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5' } },
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('gemini: ไม่ได้ภาพ');
  return { buf: Buffer.from(part.inlineData.data, 'base64'), ext: part.inlineData.mimeType?.includes('jpeg') ? '.jpg' : '.png' };
}

const PROVIDERS = { pollinations, gemini };

/**
 * @param {{ visual: string, theme: string, outBase: string }} o  outBase = path ไม่มีนามสกุล
 * @returns {Promise<{ file: string|null, provider?: string, error?: string }>}
 */
export async function generateAiImage({ visual, theme, outBase }) {
  if (!env.aiImageProviders.length) return { file: null };
  const prompt = imagePrompt(visual, theme);
  const seed = Math.floor(Math.random() * 1e9);
  const errors = [];
  for (const name of env.aiImageProviders) {
    const fn = PROVIDERS[name];
    if (!fn) continue;
    try {
      const { buf, ext } = await fn(prompt, seed);
      const file = `${outBase}${ext}`;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return { file, provider: name };
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  console.warn(`  ↪ สร้างภาพ AI ไม่สำเร็จ (${errors.join(' | ')}) — ใช้ภาพแบบไม่มีภาพประกอบ`);
  return { file: null, error: errors.join(' | ') };
}
