// แก้ไฟล์ .env จากหน้าเว็บ: เปลี่ยนเฉพาะบรรทัด KEY=value ที่ระบุ คงคอมเมนต์และลำดับเดิมไว้
import fs from 'node:fs';
import { ENV_FILE, reloadEnv } from './env.js';
import { writeAtomic } from './fsutil.js';

const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

function quote(v) {
  const s = String(v ?? '');
  if (/[\r\n]/.test(s)) throw new Error('ค่าใน .env ห้ามขึ้นบรรทัดใหม่');
  return /[\s#"'=]/.test(s) ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;
}

/**
 * @param {Record<string, string>} updates  ค่าที่จะเขียน (key ที่ไม่มีในไฟล์จะต่อท้าย)
 * @param {string} file
 */
export function writeEnv(updates, file = ENV_FILE) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const pending = new Map(Object.entries(updates));
  const out = lines.map((line) => {
    const m = line.match(LINE);
    if (!m || !pending.has(m[1])) return line;
    const v = pending.get(m[1]);
    pending.delete(m[1]);
    return `${m[1]}=${quote(v)}`;
  });
  if (pending.size) {
    while (out.length && out.at(-1) === '') out.pop();
    out.push('', ...[...pending].map(([k, v]) => `${k}=${quote(v)}`));
  }
  if (out.at(-1) !== '') out.push('');
  writeAtomic(file, out.join('\n'), { mode: 0o600 });
  for (const [k, v] of Object.entries(updates)) process.env[k] = String(v ?? '');
  return file === ENV_FILE ? reloadEnv() : null;
}

export const maskSecret = (v) => (v ? `••••${String(v).slice(-4)}` : '');
