// ผู้ให้บริการที่ใช้ API แบบ OpenAI-compatible (Groq, OpenRouter) — เรียกด้วย fetch ตรงๆ
import { ProviderError, isFatalStatus, modelList, tryModels } from './errors.js';

const TIMEOUT_MS = 120_000;

/**
 * @param {{ name: string, baseUrl: string, apiKey: string, model: string, headers?: Record<string,string> }} cfg
 *   model ใส่หลายตัวคั่นด้วย , ได้ — ถ้าตัวแรกโดนจำกัด/ล่ม จะลองตัวถัดไป
 */
export function createOpenAICompat({ name, baseUrl, apiKey, model, headers = {} }) {
  const models = modelList(model);

  async function call(m, { system, messages, jsonSchema }) {
    let res;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...headers },
        body: JSON.stringify({
          model: m,
          max_tokens: 8000,
          messages: [{ role: 'system', content: system }, ...messages],
          ...(jsonSchema ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    } catch (e) {
      throw new ProviderError(name, e.name === 'TimeoutError' ? `${m}: timeout` : `${m}: ${e.message}`);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const status = res.ok ? Number(body.error?.code) || 500 : res.status;
      // OpenRouter ใส่สาเหตุจริงจากต้นทางไว้ใน metadata.raw
      const raw = typeof body.error?.metadata?.raw === 'string' ? ` — ${body.error.metadata.raw}` : '';
      throw new ProviderError(name, `${status} ${m}: ${String(body.error?.message ?? res.statusText)}${raw}`.slice(0, 400), { status, fatal: isFatalStatus(status) });
    }
    const text = body.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new ProviderError(name, `${m}: ไม่มีข้อความตอบกลับ (${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
    return { text, model: body.model ?? m };
  }

  return {
    name,
    model: models.join(', '),
    generate: (req) => tryModels(models, (m) => call(m, req)),
  };
}
