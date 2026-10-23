// แจ้งเตือนผ่าน Telegram (ไม่ตั้งค่า = ข้ามเงียบๆ)
import { env } from '../env.js';

export const telegramEnabled = () => Boolean(env.telegramToken && env.telegramChatId);

export async function notify(text) {
  if (!telegramEnabled()) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.telegramChatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) console.error(`telegram: ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.error(`telegram: ${e.message}`);
    return false;
  }
}
