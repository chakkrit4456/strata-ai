// ตรวจการตั้งค่าและการเชื่อมต่อ — ใช้ร่วมกันระหว่าง `cli check` กับหน้า "ตั้งค่า" ใน Dashboard
import { env } from './env.js';
import { loadBrand, loadGroups, readPillars, groupsFileExists } from './config.js';
import { loadProviders } from './ai/providers.js';
import { checkToken } from './publish/facebookPage.js';
import { notify, telegramEnabled } from './notify/telegram.js';

/**
 * @param {{ telegramTest?: boolean }} o
 * @returns {Promise<{ name: string, ok: boolean | null, detail: string }[]>}  ok=null คือข้อมูล/ไม่บังคับ
 */
export async function runHealth({ telegramTest = false } = {}) {
  const out = [];
  const add = (name, ok, detail = '') => out.push({ name, ok, detail });

  for (const [name, fn] of [['brand.yaml', loadBrand], ['pillars.yaml', readPillars], ['กลุ่ม', loadGroups]]) {
    try {
      const r = fn();
      add(name, true, name === 'กลุ่ม' ? `เปิดใช้ ${r.filter((g) => g.enabled).length} กลุ่ม${groupsFileExists() ? '' : ' (ยังใช้ไฟล์ตัวอย่าง)'}` : '');
    } catch (e) {
      add(name, false, e.message);
    }
  }
  add('รหัส Dashboard', Boolean(env.dashboardPassword) && env.dashboardPassword !== 'change-me',
    env.dashboardPassword ? '' : 'ยังไม่ได้ตั้ง');

  const providers = loadProviders();
  if (!providers.length) add('AI', false, 'ยังไม่มีคีย์ AI สักเจ้า');
  await Promise.all(providers.map(async (p) => {
    try {
      const r = await p.generate({ system: 'ตอบสั้นที่สุด', messages: [{ role: 'user', content: 'ตอบคำว่า OK' }] });
      add(`AI: ${p.name}`, true, r.model);
    } catch (e) {
      add(`AI: ${p.name}`, false, e.message.slice(0, 300));
    }
  }));

  if (!env.fbPageId || !env.fbPageToken) add('Facebook Page', false, 'ยังไม่ได้ตั้ง FB_PAGE_ID / FB_PAGE_TOKEN');
  else {
    try {
      const t = await checkToken();
      add('Facebook Page', t.matchesPage, t.matchesPage ? `${t.name} (${t.id})` : `token เป็นของ ${t.name} (${t.id}) ไม่ตรงกับ FB_PAGE_ID`);
    } catch (e) {
      add('Facebook Page', false, e.message);
    }
  }

  if (!telegramEnabled()) add('Telegram', null, 'ไม่ได้ตั้งค่า (ไม่บังคับ)');
  else if (telegramTest) add('Telegram', await notify('🔔 ทดสอบการแจ้งเตือนจาก Strata Dashboard'), 'ส่งข้อความทดสอบแล้ว');
  else add('Telegram', true, 'ตั้งค่าแล้ว');
  return out;
}
