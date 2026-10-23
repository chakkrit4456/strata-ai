import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ROOT } from './env.js';

const read = (name) => YAML.parse(fs.readFileSync(path.join(ROOT, 'config', name), 'utf8'));

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function loadBrand() {
  return read('brand.yaml');
}

export function loadPillars() {
  const cfg = read('pillars.yaml');
  for (const p of cfg.pillars) {
    if (!['value', 'promo'].includes(p.kind)) throw new Error(`pillar ${p.id}: kind ต้องเป็น value หรือ promo`);
  }
  return cfg;
}

export function loadGroups() {
  const file = fs.existsSync(path.join(ROOT, 'config', 'groups.yaml')) ? 'groups.yaml' : 'groups.example.yaml';
  const { groups = [] } = read(file) ?? {};
  const seen = new Set();
  return groups.map((g) => {
    if (!g.id || seen.has(g.id)) throw new Error(`groups: id ว่างหรือซ้ำ (${g.id})`);
    seen.add(g.id);
    const promo = g.promo ?? 'never';
    if (!['always', 'never', 'days'].includes(promo)) throw new Error(`group ${g.id}: promo ไม่ถูกต้อง`);
    const promoDays = (g.promoDays ?? []).map((d) => String(d).toLowerCase().slice(0, 3));
    for (const d of promoDays) if (!WEEKDAYS.includes(d)) throw new Error(`group ${g.id}: promoDays มี "${d}"`);
    return {
      id: g.id,
      name: g.name ?? g.id,
      url: g.url ?? '',
      audience: g.audience ?? '',
      rules: g.rules ?? '',
      promo,
      promoDays,
      maxPerDay: Math.min(2, Math.max(1, Number(g.maxPerDay ?? 2))),
      signature: g.signature !== false,
      enabled: g.enabled !== false,
    };
  });
}

export { WEEKDAYS };
