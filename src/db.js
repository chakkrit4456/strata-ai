import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';
import { nowIso } from './time.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,
  slot         TEXT NOT NULL,
  pillar       TEXT NOT NULL,
  is_promo     INTEGER NOT NULL,
  topic        TEXT NOT NULL,
  caption      TEXT NOT NULL,
  image_json   TEXT NOT NULL,
  image_path   TEXT NOT NULL,
  soft_image_path TEXT,
  status       TEXT NOT NULL,   -- pending_approval | approved | published | failed | skipped
  fb_post_id   TEXT,
  permalink    TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (date, slot)
);
CREATE TABLE IF NOT EXISTS group_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  group_id   TEXT NOT NULL,
  mode       TEXT NOT NULL,     -- promo | soft | value
  text       TEXT NOT NULL,
  status     TEXT NOT NULL,     -- waiting | queued | done | skipped | expired
  done_at    TEXT,
  UNIQUE (post_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_items_group ON group_items (group_id, id);
CREATE TABLE IF NOT EXISTS runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job        TEXT NOT NULL,
  ok         INTEGER NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL
);
`;

let db;

// เพิ่มคอลัมน์ให้ฐานข้อมูลเดิมโดยไม่ต้องลบข้อมูล
function migrate(d) {
  const cols = new Set(d.prepare('PRAGMA table_info(posts)').all().map((c) => c.name));
  if (!cols.has('model')) d.exec('ALTER TABLE posts ADD COLUMN model TEXT');
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(env.dataDir, { recursive: true });
  db = new DatabaseSync(path.join(env.dataDir, 'strata.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// สำหรับเทส: ใช้ฐานข้อมูลในหน่วยความจำ
export function useMemoryDb() {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function logRun(job, ok, detail = '') {
  getDb().prepare('INSERT INTO runs (job, ok, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(job, ok ? 1 : 0, String(detail).slice(0, 2000), nowIso());
}

export function recentPosts(limit = 60) {
  return getDb().prepare('SELECT * FROM posts ORDER BY date DESC, slot DESC LIMIT ?').all(limit);
}

export function lastModeByGroup() {
  const rows = getDb().prepare(`
    SELECT gi.group_id, gi.mode FROM group_items gi
    JOIN posts p ON p.id = gi.post_id
    WHERE gi.status IN ('queued','done','waiting')
    ORDER BY p.date DESC, p.slot DESC`).all();
  const out = {};
  for (const r of rows) if (!(r.group_id in out)) out[r.group_id] = r.mode;
  return out;
}

export function insertPost(post, items) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const { lastInsertRowid } = d.prepare(`INSERT INTO posts
      (date, slot, pillar, is_promo, topic, caption, image_json, image_path, soft_image_path, status, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      post.date, post.slot, post.pillar, post.isPromo ? 1 : 0, post.topic, post.caption,
      JSON.stringify(post.image), post.imagePath, post.softImagePath ?? null, post.status, post.model ?? null, nowIso());
    const ins = d.prepare('INSERT INTO group_items (post_id, group_id, mode, text, status) VALUES (?, ?, ?, ?, ?)');
    for (const it of items) ins.run(lastInsertRowid, it.groupId, it.mode, it.text, 'waiting');
    d.exec('COMMIT');
    return Number(lastInsertRowid);
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export function getPost(id) {
  return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id);
}

export function getPostBySlot(date, slot) {
  return getDb().prepare('SELECT * FROM posts WHERE date = ? AND slot = ?').get(date, slot);
}

export function updatePost(id, fields) {
  const keys = Object.keys(fields);
  getDb().prepare(`UPDATE posts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), id);
}

export function itemsForPost(postId) {
  return getDb().prepare('SELECT * FROM group_items WHERE post_id = ? ORDER BY id').all(postId);
}

export function setItemStatus(id, status) {
  getDb().prepare('UPDATE group_items SET status = ?, done_at = ? WHERE id = ?')
    .run(status, ['done', 'skipped'].includes(status) ? nowIso() : null, id);
}

export function releaseItems(postId) {
  getDb().prepare("UPDATE group_items SET status = 'queued' WHERE post_id = ? AND status = 'waiting'").run(postId);
}

// รายการกลุ่มของวันก่อนหน้าที่ไม่ได้โพสต์ → หมดอายุ (ไม่ทบไปวันถัดไป)
export function expireBefore(date) {
  return getDb().prepare(`UPDATE group_items SET status = 'expired'
    WHERE status IN ('waiting','queued') AND post_id IN (SELECT id FROM posts WHERE date < ?)`).run(date).changes;
}

export function postsForDate(date) {
  return getDb().prepare("SELECT * FROM posts WHERE date = ? ORDER BY CASE slot WHEN 'morning' THEN 0 ELSE 1 END").all(date);
}

export function deletePost(id) {
  getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
}

export function getItem(id) {
  return getDb().prepare('SELECT * FROM group_items WHERE id = ?').get(id);
}

export function updateItemText(id, text) {
  getDb().prepare('UPDATE group_items SET text = ? WHERE id = ?').run(text, id);
}

/** รายการโพสต์ย้อนหลัง พร้อมจำนวนกลุ่มที่โพสต์แล้ว/ทั้งหมด */
export function listPosts({ status = '', pillar = '', limit = 30, offset = 0 } = {}) {
  const where = [];
  const args = [];
  if (status) { where.push('p.status = ?'); args.push(status); }
  if (pillar) { where.push('p.pillar = ?'); args.push(pillar); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = getDb().prepare(`SELECT COUNT(*) AS n FROM posts p ${w}`).get(...args).n;
  const rows = getDb().prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM group_items gi WHERE gi.post_id = p.id) AS items_total,
      (SELECT COUNT(*) FROM group_items gi WHERE gi.post_id = p.id AND gi.status = 'done') AS items_done
    FROM posts p ${w}
    ORDER BY p.date DESC, CASE p.slot WHEN 'evening' THEN 0 ELSE 1 END
    LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { total, rows };
}

/** สรุปต่อกลุ่ม: โพสต์แล้ว / ข้าม / หมดอายุ / ล่าสุดเมื่อไร */
export function groupStats() {
  return getDb().prepare(`
    SELECT group_id,
      SUM(status = 'done') AS done, SUM(status = 'skipped') AS skipped, SUM(status = 'expired') AS expired,
      MAX(done_at) AS last_done
    FROM group_items GROUP BY group_id`).all();
}

export function recentRuns(limit = 200) {
  return getDb().prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit);
}

/** ร่างที่ยังไม่ลงเพจ (ทุกวัน) ใหม่สุดก่อน */
export function draftPosts(limit = 50) {
  return getDb().prepare(`SELECT * FROM posts WHERE status IN ('pending_approval','approved','failed')
    ORDER BY date DESC, created_at DESC LIMIT ?`).all(limit);
}
