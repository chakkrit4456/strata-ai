import { z } from 'zod';
import { loadProviders } from '../ai/providers.js';
import { systemPrompt, slotPrompt } from './prompts.js';
import { checkSlot } from './guard.js';

const ImageSchema = z.object({
  kicker: z.string(),
  headline: z.string(),
  subhead: z.string(),
  bullets: z.array(z.string()),
  code: z.string(),
  options: z.array(z.string()),
  cta: z.string(),
  packageId: z.string(),
});

export const SlotContentSchema = z.object({
  topic: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  image: ImageSchema,
  softImage: ImageSchema,
  variants: z.array(z.object({ groupId: z.string(), text: z.string() })),
});

const JSON_SCHEMA = z.toJSONSchema(SlotContentSchema);
const SCHEMA_NOTE = `\n\nตอบเป็น JSON อย่างเดียว (ไม่มีข้อความอื่น ไม่มี markdown) ตาม JSON Schema นี้:\n${JSON.stringify(JSON_SCHEMA)}`;

const ATTEMPTS_PER_PROVIDER = 2;
const PACKAGE_IDS = ['starter', 'backoffice', 'enterprise', 'all'];

export function parseContent(text) {
  const raw = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  let data;
  try {
    data = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);
  } catch {
    throw new Error('ตอบกลับไม่ใช่ JSON ที่ถูกต้อง');
  }
  const r = SlotContentSchema.safeParse(data);
  if (!r.success) throw new Error(`JSON ไม่ตรง schema: ${r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  return normalize(r.data);
}

/**
 * เขียนคอนเทนต์ของ 1 รอบ ลองผู้ให้บริการตามลำดับ (Gemini → Groq → OpenRouter)
 * แต่ละเจ้าแก้งานที่ไม่ผ่าน guard ได้ 2 ครั้ง ถ้าโควตาหมด/ล่ม/ตอบผิดรูปแบบ จะข้ามไปเจ้าถัดไป
 * @returns {Promise<{content: object, attempts: number, issues: string[], provider: string, model: string}>}
 */
export async function writeSlot({ date, slotPlan, groups, brand, history, providers = loadProviders() }) {
  if (!providers.length) throw new Error('ยังไม่ได้ตั้งคีย์ AI (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY)');
  const system = systemPrompt(brand) + SCHEMA_NOTE;
  const firstPrompt = slotPrompt({ date, slotPlan, groups, recentTopics: history.topics.slice(0, 60) });
  const failures = [];
  let attempts = 0;
  let lastIssues = [];

  for (const provider of providers) {
    const messages = [{ role: 'user', content: firstPrompt }];
    for (let i = 1; i <= ATTEMPTS_PER_PROVIDER; i++) {
      attempts++;
      let reply;
      try {
        reply = await provider.generate({ system, messages, jsonSchema: JSON_SCHEMA });
      } catch (e) {
        failures.push(e.message);
        console.warn(`  ↪ ${e.message} — ลองเจ้าถัดไป`);
        break;
      }
      let content;
      try {
        content = parseContent(reply.text);
      } catch (e) {
        failures.push(`${provider.name}: ${e.message}`);
        console.warn(`  ↪ ${provider.name}: ${e.message} — ลองเจ้าถัดไป`);
        break;
      }
      const { issues } = checkSlot(content, slotPlan, { brand, history });
      if (!issues.length) return { content, attempts, issues, provider: provider.name, model: reply.model };

      lastIssues = issues;
      failures.push(`${provider.name}: ไม่ผ่านการตรวจ ${issues.length} ข้อ`);
      messages.push({ role: 'assistant', content: reply.text });
      messages.push({ role: 'user', content: `ผลลัพธ์ยังไม่ผ่านการตรวจ แก้ทุกข้อแล้วส่ง JSON ชุดใหม่ทั้งหมด:\n${issues.map((x) => `- ${x}`).join('\n')}` });
    }
  }
  const err = new Error(`ทุกผู้ให้บริการทำไม่สำเร็จ (${failures.join(' | ')})`);
  err.issues = lastIssues;
  throw err;
}

function normalize(c) {
  const tags = c.hashtags.map((h) => `#${h.replace(/^#+/, '').replace(/\s+/g, '')}`).filter((h) => h.length > 1);
  const inCaption = new Set(c.caption.match(/#[^\s#]+/g) ?? []);
  const extra = tags.filter((t) => !inCaption.has(t)).slice(0, Math.max(0, 3 - inCaption.size));
  const pkg = (img) => ({ ...img, packageId: PACKAGE_IDS.includes(img.packageId) ? img.packageId : 'all' });
  return {
    ...c,
    image: pkg(c.image),
    softImage: pkg(c.softImage),
    topic: c.topic.trim(),
    caption: extra.length ? `${c.caption.trim()}\n\n${extra.join(' ')}` : c.caption.trim(),
    // ลายเซ็นท้ายโพสต์ให้ขึ้นบรรทัดใหม่เสมอ (บางโมเดลเขียนติดกับประโยคสุดท้าย)
    variants: c.variants.map((v) => ({ groupId: v.groupId.trim(), text: v.text.trim().replace(/\s*(—\s*\S+ dev)$/, '\n\n$1') })),
  };
}
