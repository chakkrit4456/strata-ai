import { GoogleGenAI, ApiError } from '@google/genai';
import { ProviderError, isFatalStatus, modelList, tryModels } from './errors.js';

/**
 * Google Gemini (AI Studio, มีโควตาฟรี) — บังคับผลลัพธ์เป็น JSON ตาม schema ได้โดยตรง
 * @param {{ apiKey: string, model: string }} cfg  model ใส่หลายตัวคั่นด้วย , ได้ (ตัวสำรองเมื่อโดนจำกัด/ล่ม)
 */
export function createGemini({ apiKey, model }) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000 } });
  const models = modelList(model);

  async function call(m, { system, messages, jsonSchema }) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
        config: {
          systemInstruction: system,
          maxOutputTokens: 16000,
          ...(jsonSchema ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema } : {}),
        },
      });
      const text = res.text ?? '';
      if (!text.trim()) throw new ProviderError('gemini', `${m}: ไม่มีข้อความตอบกลับ (${res.candidates?.[0]?.finishReason ?? 'unknown'})`);
      return { text, model: m };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (e instanceof ApiError) throw new ProviderError('gemini', `${e.status} ${m}: ${e.message.slice(0, 300)}`, { status: e.status, fatal: isFatalStatus(e.status) });
      throw new ProviderError('gemini', `${m}: ${e.message}`);
    }
  }

  return {
    name: 'gemini',
    model: models.join(', '),
    generate: (req) => tryModels(models, (m) => call(m, req)),
  };
}
