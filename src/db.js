// src/db.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

// Resolve a stable data directory (Render-safe if you mount a Disk at ./data)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "nom.json");
const adapter = new JSONFile(dbPath);
export const db = new Low(adapter, {
  settings: {},   // guildId -> { announce_channel_id }
  stats: {},      // guildId -> { userId -> { total_nom, daily_nom, last_day } }
  counters: {},   // guildId -> { total_nom, next_drop_at, marathon_active, marathon_count }
  wins: {}        // guildId -> { userId -> wins }
});
await db.read();
await db.write();

// internal helper
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function ensureCounter(gid) {
  db.data.counters[gid] ||= {
    total_nom: 0,
    next_drop_at: 35,      // first drop between 30–40; we’ll randomize after first trigger
    marathon_active: 0,
    marathon_count: 0
  };
  return db.data.counters[gid];
}
async function save() { await db.write(); }

// ----- Settings -----
export function getSetting(gid) {
  return db.data.settings[gid] || null;
}
export async function upsertSetting(gid, channelId) {
  db.data.settings[gid] = { guild_id: gid, announce_channel_id: channelId };
  await save();
  return db.data.settings[gid];
}

// ----- Stats -----
export function bumpUserNom(gid, uid) {
  db.data.stats[gid] ||= {};
  const t = todayStr();
  const row = db.data.stats[gid][uid] || { total_nom: 0, daily_nom: 0, last_day: t };
  if (row.last_day !== t) { row.daily_nom = 0; row.last_day = t; }
  row.total_nom += 1;
  row.daily_nom += 1;
  db.data.stats[gid][uid] = row;
  save(); // fire-and-forget
  return { total: row.total_nom, daily: row.daily_nom };
}

export function topToday(gid) {
  const t = todayStr();
  const m = db.data.stats[gid] || {};
  return Object.entries(m)
    .filter(([, r]) => r.last_day === t)
    .map(([user_id, r]) => ({ user_id, daily_nom: r.daily_nom }))
    .sort((a, b) => b.daily_nom - a.daily_nom)
    .slice(0, 10);
}

export function topAll(gid) {
  const m = db.data.stats[gid] || {};
  return Object.entries(m)
    .map(([user_id, r]) => ({ user_id, total_nom: r.total_nom }))
    .sort((a, b) => b.total_nom - a.total_nom)
    .slice(0, 10);
}

// ----- Counters (guild total, drops, marathon) -----
export function getCounter(gid) {
  return ensureCounter(gid);
}

export function incrTotalNom(gid) {
  const c = ensureCounter(gid);
  c.total_nom += 1;
  if (c.marathon_active) c.marathon_count += 1;
  save();
  return c.total_nom;
}

// set next mini-drop threshold to random between [min, max]
export function setNextDrop(gid, min = 30, max = 40) {
  const c = ensureCounter(gid);
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  c.next_drop_at = n;
  save();
  return n;
}

export function resetMarathon(gid, active) {
  const c = ensureCounter(gid);
  c.marathon_active = active ? 1 : 0;
  c.marathon_count = 0;
  save();
}

// ----- Mini-game wins -----
export function addWin(gid, uid) {
  db.data.wins[gid] ||= {};
  db.data.wins[gid][uid] = (db.data.wins[gid][uid] || 0) + 1;
  save();
  return db.data.wins[gid][uid];
}

export function topWinners(gid) {
  const m = db.data.wins[gid] || {};
  return Object.entries(m)
    .map(([user_id, wins]) => ({ user_id, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);
}
