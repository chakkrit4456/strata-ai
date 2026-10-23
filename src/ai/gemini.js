import { GoogleGenAI, ApiError } from '@google/genai';
import { ProviderError, isFatalStatus } from './errors.js';

/**
 * Google Gemini (AI Studio, มีโควตาฟรี) — บังคับผลลัพธ์เป็น JSON ตาม schema ได้โดยตรง
 * @param {{ apiKey: string, model: string }} cfg
 */
export function createGemini({ apiKey, model }) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000 } });
  return {
    name: 'gemini',
    model,
    async generate({ system, messages, jsonSchema }) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          config: {
            systemInstruction: system,
            maxOutputTokens: 16000,
            ...(jsonSchema ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema } : {}),
          },
        });
        const text = res.text ?? '';
        if (!text.trim()) throw new ProviderError('gemini', `ไม่มีข้อความตอบกลับ (${res.candidates?.[0]?.finishReason ?? 'unknown'})`);
        return { text, model };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (e instanceof ApiError) throw new ProviderError('gemini', `${e.status} ${e.message.slice(0, 300)}`, { status: e.status, fatal: isFatalStatus(e.status) });
        throw new ProviderError('gemini', e.message);
      }
    },
  };
}
