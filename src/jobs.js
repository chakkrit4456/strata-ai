import fs from 'node:fs';
import path from 'node:path';
import { env, mediaDir, ROOT } from './env.js';
import { loadBrand, loadGroups, loadPillars } from './config.js';
import { planDay } from './content/planner.js';
import { writeSlot } from './content/writer.js';
import { renderImage, closeRenderer } from './image/render.js';
import { publishPhoto } from './publish/facebookPage.js';
import { notify } from './notify/telegram.js';
import { SLOT_LABEL } from './time.js';
import * as db from './db.js';

const SOFT_LAYOUT = 'tip';

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
      const label = `${date} ${SLOT_LABEL[slotPlan.slot]}`;
      if (!dry && db.getPostBySlot(date, slotPlan.slot)) {
        results.push({ slot: slotPlan.slot, skipped: true });
        continue;
      }
      try {
        const { content, attempts, provider, model } = await writeSlot({ date, slotPlan, groups, brand, history });
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
          imagePath, softImagePath, status: env.requireApproval ? 'pending_approval' : 'approved',
        };
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
        ...made.map((r) => `• ${SLOT_LABEL[r.slot]}: ${r.record.topic} (${r.items.length} กลุ่ม)`),
        ...failed.map((r) => `⚠ ${SLOT_LABEL[r.slot]} สร้างไม่สำเร็จ: ${r.error}`),
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
    await notify(`⚠ Strata: ไม่มีโพสต์${SLOT_LABEL[slot]}ของวันที่ ${date} (generate อาจล้มเหลว)`);
    return null;
  }
  if (post.status === 'pending_approval') {
    await notify(`⏸ Strata: โพสต์${SLOT_LABEL[slot]} "${post.topic}" ยังไม่ได้อนุมัติ\nอนุมัติแล้วกด "โพสต์ทันที" ได้ที่ ${env.publicUrl}/`);
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
    if (r.error) return `<section><h2>${SLOT_LABEL[r.slot]} — ล้มเหลว</h2><pre>${esc(r.error)}\n${esc((r.issues ?? []).join('\n'))}</pre></section>`;
    const rec = r.record;
    return `<section><h2>${SLOT_LABEL[r.slot]} · ${esc(rec.pillar)}${rec.isPromo ? ' · โปรโมท' : ''}</h2>
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
