// ผู้ให้บริการที่ใช้ API แบบ OpenAI-compatible (Groq, OpenRouter) — เรียกด้วย fetch ตรงๆ
import { ProviderError, isFatalStatus } from './errors.js';

const TIMEOUT_MS = 120_000;

/**
 * @param {{ name: string, baseUrl: string, apiKey: string, model: string, headers?: Record<string,string> }} cfg
 */
export function createOpenAICompat({ name, baseUrl, apiKey, model, headers = {} }) {
  return {
    name,
    model,
    async generate({ system, messages, jsonSchema }) {
      let res;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...headers },
          body: JSON.stringify({
            model,
            max_tokens: 8000,
            messages: [{ role: 'system', content: system }, ...messages],
            ...(jsonSchema ? { response_format: { type: 'json_object' } } : {}),
          }),
        });
      } catch (e) {
        throw new ProviderError(name, e.name === 'TimeoutError' ? 'timeout' : e.message);
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        const status = res.ok ? Number(body.error?.code) || 500 : res.status;
        throw new ProviderError(name, `${status} ${String(body.error?.message ?? res.statusText).slice(0, 300)}`, { status, fatal: isFatalStatus(status) });
      }
      const text = body.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new ProviderError(name, `ไม่มีข้อความตอบกลับ (${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
      return { text, model: body.model ?? model };
    },
  };
}
