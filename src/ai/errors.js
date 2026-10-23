// ข้อผิดพลาดจากผู้ให้บริการ AI
// fatal = ใช้เจ้านี้ต่อไม่ได้ในรอบนี้ (คีย์ผิด/ไม่มีสิทธิ์) — retryable = ลองเจ้าถัดไปได้ (โควตาหมด, ล่ม, timeout)
export class ProviderError extends Error {
  constructor(provider, message, { status, fatal = false } = {}) {
    super(`${provider}: ${message}`);
    this.provider = provider;
    this.status = status;
    this.fatal = fatal;
    // โควตา/rate limit ชั่วคราว — คีย์ยังใช้ได้ (พบบ่อยกับโมเดลฟรี)
    this.rateLimited = status === 429 || status === 503;
  }
}

export const isFatalStatus = (status) => status === 400 || status === 401 || status === 403 || status === 404;

/** "a, b ,c" → ['a','b','c'] — ตั้งโมเดลสำรองหลายตัวได้ในค่าเดียว */
export const modelList = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * ลองโมเดลทีละตัวจนกว่าจะสำเร็จ — คีย์ผิด (401) หยุดทันทีเพราะโมเดลอื่นก็ใช้ไม่ได้
 * @template T
 * @param {string[]} models
 * @param {(model: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function tryModels(models, fn) {
  let last;
  const tried = [];
  for (const model of models) {
    try {
      return await fn(model);
    } catch (e) {
      last = e;
      tried.push(`${model} → ${e.status ?? 'error'}`);
      if (e.status === 401) break;
    }
  }
  if (last && tried.length > 1) last.message = `${last.message} (ลองแล้ว: ${tried.join(', ')})`;
  throw last;
}
