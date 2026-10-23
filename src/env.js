import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const str = (k, d = '') => (process.env[k] ?? '').trim() || d;
const bool = (k, d) => {
  const v = str(k);
  return v ? /^(1|true|yes|on)$/i.test(v) : d;
};

export const env = {
  aiProviders: str('AI_PROVIDERS', 'gemini,groq,openrouter').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  geminiKey: str('GEMINI_API_KEY'),
  geminiModel: str('GEMINI_MODEL', 'gemini-3.5-flash'),
  groqKey: str('GROQ_API_KEY'),
  groqModel: str('GROQ_MODEL', 'openai/gpt-oss-120b'),
  openrouterKey: str('OPENROUTER_API_KEY'),
  openrouterModel: str('OPENROUTER_MODEL', 'google/gemma-4-31b-it:free'),

  fbPageId: str('FB_PAGE_ID'),
  fbPageToken: str('FB_PAGE_TOKEN'),
  fbGraphVersion: str('FB_GRAPH_VERSION', 'v23.0'),

  timezone: str('TIMEZONE', 'Asia/Bangkok'),
  requireApproval: bool('REQUIRE_APPROVAL', true),
  dataDir: path.resolve(ROOT, str('DATA_DIR', './data')),
  bgImageDir: str('BG_IMAGE_DIR') ? path.resolve(ROOT, str('BG_IMAGE_DIR')) : '',

  host: str('HOST', '0.0.0.0'),
  port: Number(str('PORT', '8787')),
  publicUrl: str('PUBLIC_URL', 'http://localhost:8787').replace(/\/$/, ''),
  dashboardPassword: str('DASHBOARD_PASSWORD'),
  sessionSecret: str('SESSION_SECRET', 'dev-secret'),

  telegramToken: str('TELEGRAM_BOT_TOKEN'),
  telegramChatId: str('TELEGRAM_CHAT_ID'),
};

export const mediaDir = () => path.join(env.dataDir, 'media');
