// ข้อผิดพลาดจากผู้ให้บริการ AI
// fatal = ใช้เจ้านี้ต่อไม่ได้ในรอบนี้ (คีย์ผิด/ไม่มีสิทธิ์) — retryable = ลองเจ้าถัดไปได้ (โควตาหมด, ล่ม, timeout)
export class ProviderError extends Error {
  constructor(provider, message, { status, fatal = false } = {}) {
    super(`${provider}: ${message}`);
    this.provider = provider;
    this.status = status;
    this.fatal = fatal;
  }
}

export const isFatalStatus = (status) => status === 400 || status === 401 || status === 403 || status === 404;
