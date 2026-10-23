import fs from 'node:fs';
import path from 'node:path';
import { env, mediaDir, ROOT } from './env.js';
import { loadBrand, loadGroups, loadPillars, readPillars, isRealGroup, groupProblem } from './config.js';
import { planDay, planNow } from './content/planner.js';
import { checkSlot } from './content/guard.js';
import { writeSlot } from './content/writer.js';
import { renderImage, closeRenderer } from './image/render.js';
import { publishPhoto } from './publish/facebookPage.js';
import { notify } from './notify/telegram.js';
import { slotLabel, today, clockId } from './time.js';
import * as db from './db.js';

const SOFT_LAYOUT = 'tip';

/**
 * AI เขียน → ทำภาพ (และภาพแบบไม่ขายถ้ามีกลุ่มที่ห้ามขาย) → ได้ข้อมูลพร้อมบันทึก
 * ใช้ร่วมกันระหว่างโพสต์รายวันกับปุ่ม "สร้างและโพสต์ทันที"
 */
async function buildSlot({ date, slotPlan, groups, brand, history, outRoot, status, topicHint = '', onStep = () => {} }) {
  onStep('AI กำลังเขียนโพสต์');
  const { content, attempts, provider, model } = await writeSlot({ date, slotPlan, groups, brand, history, topicHint });
  onStep(`ทำภาพ (เขียนโดย ${provider}/${model})`);
  const imagePath = path.join(outRoot, `${slotPlan.slot}.png`);
  const main = await renderImage({ layout: slotPlan.pillar.template, image: content.image, brand, outFile: imagePath });
  let softImagePath = null;
  if (slotPlan.groups.some((g) => g.mode === 'soft')) {
    softImagePath = path.join(outRoot, `${slotPlan.slot}-soft.png`);
    await renderImage({ layout: SOFT_LAYOUT, image: content.softImage, brand, outFile: softImagePath });
  }
  const variants = new Map(content.variants.map((v) => [v.groupId, v.text]));
  const items = slotPlan.groups.map((g) => ({ ...g, text: variants.get(g.groupId) }));
  const record = {
    date, slot: slotPlan.slot, pillar: slotPlan.pillar.id, isPromo: slotPlan.isPromo,
    topic: content.topic, caption: content.caption, image: content.image,
    imagePath, softImagePath, status, model: `${provider}/${model}`,
  };
  return { content, attempts, provider, model, record, items, overflow: main.overflow };
}

/**
 * สร้างคอนเทนต์ของทั้งวัน (2 รอบ) — รันซ้ำได้ รอบที่สร้างแล้วจะข้าม
 * dry=true: เขียนผลลง out/<date>/ อย่างเดียว ไม่บันทึก DB
 */
export async function generateDay({ date, dry = false }) {
  const brand = loadBrand();
  const groups = loadGroups();
  const pillarsCfg = loadPillars();
  if (!dry) db.expireBefore(date);

  const recent = db.recentPosts(60);
  const plan = planDay({ date, pillarsCfg, groups, recent, lastModes: db.lastModeByGroup() });
  const history = { topics: recent.map((p) => p.topic), captions: recent.map((p) => p.caption) };
  const outRoot = dry ? path.join(ROOT, 'out', date) : path.join(mediaDir(), date);
  const results = [];

  try {
    for (const slotPlan of plan.slots) {
      const label = `${date} ${slotLabel(slotPlan.slot)}`;
      if (!dry && db.getPostBySlot(date, slotPlan.slot)) {
        results.push({ slot: slotPlan.slot, skipped: true });
        continue;
      }
      try {
        const { content, attempts, provider, model, record, items, overflow } = await buildSlot({
          date, slotPlan, groups, brand, history, outRoot, status: env.requireApproval ? 'pending_approval' : 'approved',
        });
        const main = { overflow };
        if (dry) {
          fs.writeFileSync(path.join(outRoot, `${slotPlan.slot}.json`), JSON.stringify({ plan: summarize(slotPlan), ...content }, null, 2));
        } else {
          record.id = db.insertPost(record, items);
        }
        history.topics.unshift(content.topic);
        history.captions.unshift(content.caption);
        results.push({ slot: slotPlan.slot, record, items, attempts, model: `${provider}/${model}`, overflow: main.overflow });
        console.log(`✓ ${label}: [${slotPlan.pillar.id}] ${content.topic} (${provider}/${model}, ลอง ${attempts} ครั้ง${main.overflow ? ', ⚠ ข้อความในภาพล้น' : ''})`);
      } catch (e) {
        console.error(`✗ ${label}: ${e.message}${e.issues ? `\n  - ${e.issues.join('\n  - ')}` : ''}`);
        results.push({ slot: slotPlan.slot, error: e.message, issues: e.issues });
      }
    }
  } finally {
    await closeRenderer();
  }

  if (dry) writeDryPreview(outRoot, date, results, groups);
  else {
    const failed = results.filter((r) => r.error);
    db.logRun('generate', !failed.length, JSON.stringify(results.map((r) => ({ slot: r.slot, error: r.error, skipped: r.skipped }))));
    const made = results.filter((r) => r.record);
    if (made.length || failed.length) {
      await notify([
        `📝 Strata: เตรียมโพสต์วันที่ ${date} แล้ว`,
        ...made.map((r) => `• ${slotLabel(r.slot)}: ${r.record.topic} (${r.items.length} กลุ่ม)`),
        ...failed.map((r) => `⚠ ${slotLabel(r.slot)} สร้างไม่สำเร็จ: ${r.error}`),
        env.requireApproval && made.length ? `ต้องกดอนุมัติก่อนโพสต์: ${env.publicUrl}/` : `ดูคิว: ${env.publicUrl}/`,
      ].join('\n'));
    }
  }
  return results;
}

const summarize = (s) => ({ slot: s.slot, pillar: s.pillar.id, isPromo: s.isPromo, groups: s.groups });

/** โพสต์ลงเพจตามรอบ (เรียกจาก systemd timer) */
export async function publishSlot({ date, slot }) {
  const post = db.getPostBySlot(date, slot);
  if (!post) {
    db.logRun(`publish:${slot}`, false, 'no post');
    await notify(`⚠ Strata: ไม่มีโพสต์${slotLabel(slot)}ของวันที่ ${date} (generate อาจล้มเหลว)`);
    return null;
  }
  if (post.status === 'pending_approval') {
    await notify(`⏸ Strata: โพสต์${slotLabel(slot)} "${post.topic}" ยังไม่ได้อนุมัติ\nอนุมัติแล้วกด "โพสต์ทันที" ได้ที่ ${env.publicUrl}/`);
    return post;
  }
  if (post.status !== 'approved') return post;
  return publishPost(post.id);
}

/** โพสต์ทันที (ใช้ทั้งจาก timer และปุ่มใน Dashboard) */
export async function publishPost(postId) {
  const post = db.getPost(postId);
  if (!post || post.status === 'published') return post;
  try {
    const { postId: fbId, permalink } = await publishPhoto({ caption: post.caption, imagePath: post.image_path });
    db.updatePost(post.id, { status: 'published', fb_post_id: fbId, permalink, error: null, published_at: new Date().toISOString() });
    db.releaseItems(post.id);
    db.logRun(`publish:${post.slot}`, true, fbId);
    const n = db.itemsForPost(post.id).length;
    await notify(`✅ Strata: โพสต์ลงเพจแล้ว — ${post.topic}\n${permalink}${n ? `\n\nมี ${n} กลุ่มรอโพสต์/แชร์: ${env.publicUrl}/` : ''}`);
  } catch (e) {
    db.updatePost(post.id, { status: 'failed', error: e.message });
    db.logRun(`publish:${post.slot}`, false, e.message);
    await notify(`❌ Strata: โพสต์ลงเพจไม่สำเร็จ — ${post.topic}\n${e.message}`);
  }
  return db.getPost(post.id);
}

function writeDryPreview(outRoot, date, results, groups) {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const name = (id) => groups.find((g) => g.id === id)?.name ?? id;
  const blocks = results.map((r) => {
    if (r.error) return `<section><h2>${slotLabel(r.slot)} — ล้มเหลว</h2><pre>${esc(r.error)}\n${esc((r.issues ?? []).join('\n'))}</pre></section>`;
    const rec = r.record;
    return `<section><h2>${slotLabel(r.slot)} · ${esc(rec.pillar)}${rec.isPromo ? ' · โปรโมท' : ''}</h2>
      <h3>${esc(rec.topic)}</h3><p>เขียนโดย ${esc(r.model)} · ลอง ${r.attempts} ครั้ง</p>
      <div class="row"><img src="${path.basename(rec.imagePath)}">${rec.softImagePath ? `<img src="${path.basename(rec.softImagePath)}">` : ''}</div>
      <h4>แคปชันเพจ</h4><pre>${esc(rec.caption)}</pre>
      ${r.items.map((it) => `<h4>${esc(name(it.groupId))} <small>(${it.mode})</small></h4><pre>${esc(it.text)}</pre>`).join('')}
    </section>`;
  }).join('');
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Strata ${date}</title>
<style>body{font-family:system-ui,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;background:#111;color:#eee}
pre{white-space:pre-wrap;background:#1b1d21;padding:14px;border-radius:6px;line-height:1.6}
.row{display:flex;gap:12px}.row img{width:48%;border:1px solid #333}section{border-bottom:1px solid #333;padding-bottom:24px}</style>
<h1>Dry run ${date}</h1>${blocks}`);
  console.log(`\nดูผลได้ที่ ${path.join(outRoot, 'index.html')}`);
}

// ---------- งานเบื้องหลังจาก Dashboard (รันได้ทีละงาน) ----------

const job = { running: false, label: '', startedAt: null, finishedAt: null, error: null, summary: '', steps: [], url: '' };
export const jobState = () => ({ ...job, steps: [...job.steps] });

export function startJob(label, fn) {
  if (job.running) throw new Error(`มีงาน "${job.label}" กำลังทำอยู่ รอให้เสร็จก่อน`);
  Object.assign(job, { running: true, label, startedAt: new Date().toISOString(), finishedAt: null, error: null, summary: '', steps: [], url: '' });
  const step = (msg) => { job.steps.push(msg); };
  fn(step)
    .then((r) => {
      if (r && typeof r === 'object') Object.assign(job, { summary: r.summary ?? '', url: r.url ?? '' });
      else job.summary = r ?? '';
    })
    .catch((e) => { job.error = e.message; console.error(`job "${label}":`, e); })
    .finally(() => { job.running = false; job.finishedAt = new Date().toISOString(); });
}

const summarizeResults = (results) => results
  .map((r) => `${slotLabel(r.slot)}: ${r.error ? `ล้มเหลว — ${r.error}` : r.skipped ? 'มีอยู่แล้ว' : `${r.record.topic} (${r.model})`}`)
  .join(' · ');

/** สร้างโพสต์ของวันที่ระบุ (เฉพาะรอบที่ยังไม่มี) */
export function startGenerate(date) {
  startJob(`สร้างโพสต์วันที่ ${date}`, async () => summarizeResults(await generateDay({ date })));
}

/** ทิ้งโพสต์รอบนี้ (ที่ยังไม่ลงเพจ) แล้วให้ AI สร้างใหม่ */
export function startRegenerate(postId) {
  const post = db.getPost(postId);
  if (!post) throw new Error('ไม่พบโพสต์');
  if (post.status === 'published') throw new Error('โพสต์นี้ลงเพจแล้ว สร้างใหม่ไม่ได้');
  if (post.slot.startsWith('now-')) {
    // โพสต์ด่วน: เขียนใหม่ด้วยหมวดเดิมและกลุ่มเดิม (เฉพาะกลุ่มที่ยังใช้ได้)
    const groups = loadGroups();
    const groupIds = db.itemsForPost(post.id).map((i) => i.group_id).filter((id) => groups.some((g) => g.id === id && isRealGroup(g)));
    const task = createNowTask({ pillarId: post.pillar, groupIds, preview: true });
    startJob(`เขียน${slotLabel(post.slot)}ใหม่`, async (step) => {
      deleteDraft(post.id);
      return task(step);
    });
    return;
  }
  startJob(`สร้าง${slotLabel(post.slot)} ${post.date} ใหม่`, async () => {
    db.deletePost(post.id);
    return summarizeResults(await generateDay({ date: post.date }));
  });
}

const templateFor = (pillarId) => {
  try {
    return readPillars().pillars.find((p) => p.id === pillarId)?.template ?? 'tip';
  } catch {
    return 'tip';
  }
};

/** คำเตือนจากตัวตรวจเนื้อหา สำหรับแสดงในหน้าแก้ไขโพสต์ (ไม่บล็อกการบันทึก) */
export function postWarnings(post, items) {
  const content = {
    topic: post.topic,
    caption: post.caption,
    image: JSON.parse(post.image_json || '{}'),
    softImage: null,
    variants: items.map((i) => ({ groupId: i.group_id, text: i.text })),
  };
  const slotPlan = { isPromo: Boolean(post.is_promo), groups: items.map((i) => ({ groupId: i.group_id, mode: i.mode })) };
  return checkSlot(content, slotPlan, { brand: loadBrand() }).issues.filter((i) => !i.startsWith('ภาพแบบไม่ขาย'));
}

/**
 * บันทึกการแก้ไขจาก Dashboard: แคปชัน ข้อความในภาพ (render ใหม่ถ้าเปลี่ยน) และข้อความของแต่ละกลุ่ม
 * โพสต์ที่ลงเพจแล้วแก้ได้เฉพาะข้อความกลุ่ม
 */
export async function savePostEdits(postId, { caption, image, items = {} }) {
  const post = db.getPost(postId);
  if (!post) throw new Error('ไม่พบโพสต์');
  const editable = post.status !== 'published';
  const fields = {};
  if (editable && typeof caption === 'string' && caption.trim() && caption.trim() !== post.caption) fields.caption = caption.trim();
  let rerendered = false;
  if (editable && image) {
    const old = JSON.parse(post.image_json || '{}');
    const next = { ...old, ...image };
    if (JSON.stringify(next) !== JSON.stringify(old)) {
      if (job.running) throw new Error('มีงานสร้างโพสต์กำลังทำอยู่ รอให้เสร็จก่อนค่อยทำภาพใหม่');
      try {
        await renderImage({ layout: templateFor(post.pillar), image: next, brand: loadBrand(), outFile: post.image_path });
      } finally {
        await closeRenderer();
      }
      fields.image_json = JSON.stringify(next);
      rerendered = true;
    }
  }
  if (Object.keys(fields).length) db.updatePost(post.id, fields);
  for (const it of db.itemsForPost(post.id)) {
    const t = items[it.id];
    if (typeof t === 'string' && t.trim() && t.trim() !== it.text) db.updateItemText(it.id, t.trim());
  }
  return { rerendered };
}

/**
 * ปุ่ม "สร้างและโพสต์ทันที": AI เขียน 1 โพสต์ → ทำภาพ → (preview=false) โพสต์ลงเพจ → ปล่อยคิวกลุ่มที่เลือก
 * ส่งได้เฉพาะกลุ่ม Facebook จริง (ตรวจซ้ำฝั่ง server)
 */
export function startCreateNow(opts) {
  startJob(opts.preview === false ? 'สร้างและโพสต์ทันที' : 'สร้างร่างโพสต์ด่วน', createNowTask(opts));
}

function createNowTask({ pillarId = '', topicHint = '', groupIds = [], preview = true }) {
  const all = loadGroups();
  const chosen = [...new Set(groupIds)].map((id) => {
    const g = all.find((x) => x.id === id);
    if (!g) throw new Error(`ไม่พบกลุ่ม "${id}"`);
    if (!isRealGroup(g)) throw new Error(`กลุ่ม "${g.name}" ใช้ไม่ได้: ${groupProblem(g)}`);
    return g;
  });
  const hint = String(topicHint ?? '').trim().slice(0, 300);
  return async (step) => {
    const date = today();
    const slot = `now-${clockId()}`;
    const brand = loadBrand();
    const recent = db.recentPosts(60);
    step('วางแผนหมวดและกลุ่ม');
    const slotPlan = planNow({ date, slot, pillarsCfg: loadPillars(), pillarId, groups: chosen, recent, lastModes: db.lastModeByGroup() });
    const history = { topics: recent.map((p) => p.topic), captions: recent.map((p) => p.caption) };
    let built;
    try {
      built = await buildSlot({
        date, slotPlan, groups: chosen, brand, history, topicHint: hint, onStep: step,
        outRoot: path.join(mediaDir(), date), status: preview ? 'pending_approval' : 'approved',
      });
    } finally {
      await closeRenderer();
    }
    step('บันทึกร่าง');
    const id = db.insertPost(built.record, built.items);
    db.logRun('create-now', true, `${slot} ${built.record.topic}`);
    if (preview) return { summary: `ร่างพร้อมแล้ว: ${built.record.topic}`, url: `/post/${id}` };

    step('โพสต์ลงเพจ');
    const post = await publishPost(id);
    if (post.status !== 'published') throw new Error(`สร้างเสร็จแต่โพสต์เพจไม่สำเร็จ: ${post.error}`);
    step(chosen.length ? `ปล่อยคิว ${chosen.length} กลุ่ม` : 'เสร็จ');
    return { summary: `โพสต์ลงเพจแล้ว: ${built.record.topic}`, url: `/?date=${date}#post-${id}` };
  };
}

/** ลบร่างที่ยังไม่ลงเพจ พร้อมไฟล์ภาพ */
export function deleteDraft(postId) {
  const post = db.getPost(postId);
  if (!post) throw new Error('ไม่พบโพสต์');
  if (post.status === 'published') throw new Error('โพสต์นี้ลงเพจแล้ว ลบจากที่นี่ไม่ได้ (ลบที่ Facebook)');
  db.deletePost(post.id);
  for (const f of [post.image_path, post.soft_image_path]) {
    if (f) fs.rmSync(f, { force: true });
  }
  return post;
}
