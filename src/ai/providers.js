import { env } from '../env.js';
import { createGemini } from './gemini.js';
import { createOpenAICompat } from './openaiCompat.js';

const FACTORIES = {
  gemini: () => env.geminiKey && createGemini({ apiKey: env.geminiKey, model: env.geminiModel }),
  groq: () => env.groqKey && createOpenAICompat({
    name: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: env.groqKey, model: env.groqModel,
  }),
  openrouter: () => env.openrouterKey && createOpenAICompat({
    name: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: env.openrouterKey, model: env.openrouterModel,
    headers: { 'x-title': 'Strata Automation' },
  }),
};

export const PROVIDER_NAMES = Object.keys(FACTORIES);

/** ผู้ให้บริการตามลำดับใน AI_PROVIDERS — เจ้าที่ไม่มีคีย์ถูกข้าม */
export function loadProviders() {
  return env.aiProviders.map((n) => FACTORIES[n]?.()).filter(Boolean);
}
