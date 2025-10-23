// src/db.js (JSON store)
import { JSONFile, Low } from 'lowdb';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "nom.json");
const adapter = new JSONFile(dbPath);
export const db = new Low(adapter, {
  settings: {}, stats: {}, counters: {}, wins: {}
});
await db.read();

function save() { return db.write(); }

// settings
export function getSetting(gid){ return db.data.settings[gid] || null; }
export function upsertSetting(gid, channelId){
  db.data.settings[gid] = { guild_id: gid, announce_channel_id: channelId };
  return save();
}

// stats
export function bumpUserNom(gid, uid){
  const today = new Date().toISOString().slice(0,10);
  db.data.stats[gid] ||= {};
  const row = db.data.stats[gid][uid] || { total_nom:0, daily_nom:0, last_day: today };
  if (row.last_day !== today) { row.daily_nom = 0; row.last_day = today; }
  row.total_nom++; row.daily_nom++;
  db.data.stats[gid][uid] = row; save();
  return { total: row.total_nom, daily: row.daily_nom };
}

export function topTodayAll(gid){
  const today = new Date().toISOString().slice(0,10);
  const m = db.data.stats[gid] || {};
  return Object.entries(m)
    .filter(([,r]) => r.last_day === today)
    .map(([user_id, r]) => ({ user_id, daily_nom: r.daily_nom }))
    .sort((a,b)=>b.daily_nom-a.daily_nom).slice(0,10);
}
export function topAllAll(gid){
  const m = db.data.stats[gid] || {};
  return Object.entries(m)
    .map(([user_id, r]) => ({ user_id, total_nom: r.total_nom }))
    .sort((a,b)=>b.total_nom-a.total_nom).slice(0,10);
}

// counters
export function getCounter(gid){ return db.data.counters[gid] || null; }
export function upsertCounter(gid, obj){
  db.data.counters[gid] = { ...(db.data.counters[gid]||{}), ...obj };
  return save();
}
export function incrTotalNom(gid){
  const row = getCounter(gid) || { total_nom:0, next_drop_at:35, marathon_active:0, marathon_count:0 };
  row.total_nom++; if (row.marathon_active) row.marathon_count++;
  upsertCounter(gid, row); return row.total_nom;
}
export function setNextDrop(gid, min=30, max=40){
  const next = Math.floor(Math.random()*(max-min+1))+min;
  const row = getCounter(gid) || {};
  upsertCounter(gid, { ...row, next_drop_at: next }); return next;
}
export function resetMarathon(gid, active){
  const row = getCounter(gid) || { total_nom:0, next_drop_at:35, marathon_count:0 };
  upsertCounter(gid, { ...row, marathon_active: active?1:0, marathon_count:0 });
}
export function addWinRun(gid, uid){
  db.data.wins[gid] ||= {};
  db.data.wins[gid][uid] = (db.data.wins[gid][uid]||0)+1; return save();
}
export function topWinnersAll(gid){
  const m = db.data.wins[gid] || {};
  return Object.entries(m).map(([user_id,wins])=>({user_id, wins}))
    .sort((a,b)=>b.wins-a.wins).slice(0,10);
}
