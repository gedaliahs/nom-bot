import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, "nom.sqlite3");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT PRIMARY KEY,
  announce_channel_id TEXT
);

CREATE TABLE IF NOT EXISTS stats (
  guild_id TEXT,
  user_id TEXT,
  total_nom INTEGER DEFAULT 0,
  daily_nom INTEGER DEFAULT 0,
  last_day TEXT,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS counters (
  guild_id TEXT PRIMARY KEY,
  total_nom INTEGER DEFAULT 0,
  next_drop_at INTEGER DEFAULT 35,
  marathon_active INTEGER DEFAULT 0,
  marathon_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wins (
  guild_id TEXT,
  user_id TEXT,
  wins INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
`);

export const getSetting = db.prepare("SELECT * FROM settings WHERE guild_id=?");
export const upsertSetting = db.prepare(`
INSERT INTO settings (guild_id, announce_channel_id) VALUES (?,?)
ON CONFLICT(guild_id) DO UPDATE SET announce_channel_id=excluded.announce_channel_id
`);

const selStats = db.prepare("SELECT * FROM stats WHERE guild_id=? AND user_id=?");
const insStats = db.prepare(`
INSERT INTO stats (guild_id, user_id, total_nom, daily_nom, last_day)
VALUES (?,?,?,?,?)
`);
const updStats = db.prepare(`
UPDATE stats SET total_nom=total_nom+1, daily_nom=daily_nom+1, last_day=? WHERE guild_id=? AND user_id=?
`);
const updStatsNewDay = db.prepare(`
UPDATE stats SET total_nom=total_nom+1, daily_nom=1, last_day=? WHERE guild_id=? AND user_id=?
`);

export function bumpUserNom(guildId, userId) {
  const today = new Date().toISOString().slice(0,10);
  const row = selStats.get(guildId, userId);
  if (!row) {
    insStats.run(guildId, userId, 1, 1, today);
    return { total: 1, daily: 1 };
  }
  if (row.last_day !== today) {
    updStatsNewDay.run(today, guildId, userId);
    return { total: row.total_nom + 1, daily: 1 };
  } else {
    updStats.run(today, guildId, userId);
    return { total: row.total_nom + 1, daily: row.daily_nom + 1 };
  }
}

export const topToday = db.prepare(`
SELECT user_id, daily_nom FROM stats
WHERE guild_id=? AND last_day=?
ORDER BY daily_nom DESC
LIMIT 10
`);

export const topAll = db.prepare(`
SELECT user_id, total_nom FROM stats
WHERE guild_id=?
ORDER BY total_nom DESC
LIMIT 10
`);

export const getCounter = db.prepare("SELECT * FROM counters WHERE guild_id=?");
export const upsertCounter = db.prepare(`
INSERT INTO counters (guild_id, total_nom, next_drop_at, marathon_active, marathon_count)
VALUES (?,?,?,?,?)
ON CONFLICT(guild_id) DO UPDATE SET
  total_nom=excluded.total_nom,
  next_drop_at=excluded.next_drop_at,
  marathon_active=excluded.marathon_active,
  marathon_count=excluded.marathon_count
`);

export function incrTotalNom(guildId) {
  const row = getCounter.get(guildId);
  const current = row?.total_nom ?? 0;
  const nextDrop = row?.next_drop_at ?? 35;
  const marathonActive = row?.marathon_active ?? 0;
  const marathonCount = row?.marathon_count ?? 0;
  upsertCounter.run(guildId, current + 1, nextDrop, marathonActive, marathonCount + (marathonActive ? 1 : 0));
  return current + 1;
}

export function setNextDrop(guildId, min=30, max=40) {
  const next = Math.floor(Math.random() * (max - min + 1)) + min;
  const row = getCounter.get(guildId) || {};
  upsertCounter.run(guildId, row.total_nom ?? 0, next, row.marathon_active ?? 0, row.marathon_count ?? 0);
  return next;
}

export function resetMarathon(guildId, active) {
  const row = getCounter.get(guildId) || {};
  upsertCounter.run(guildId, row.total_nom ?? 0, row.next_drop_at ?? 35, active ? 1 : 0, 0);
}

export const addWin = db.prepare(`
INSERT INTO wins (guild_id, user_id, wins) VALUES (?,?,1)
ON CONFLICT(guild_id, user_id) DO UPDATE SET wins = wins + 1
`);

export const topWinners = db.prepare(`
SELECT user_id, wins FROM wins WHERE guild_id=? ORDER BY wins DESC LIMIT 10
`);
