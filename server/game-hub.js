// Game-Hub: Spielräume mit Code (WebSocket-Relay) + Rangliste.
// Läuft auf dem Server als systemd-Dienst "game-hub", nginx leitet /ws und /api hierher.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT !== undefined ? +process.env.PORT : 8090;
const DATA_DIR = process.env.DATA_DIR || '/var/lib/game-hub';
const BOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 6 * 3600 * 1000;
// Schutz vor Überlastung. Eine Schulklasse hinter einer IP soll noch gehen, ein einzelner Angreifer nicht den Server füllen.
const MAX_SEATS = 20;                   // Plätze pro Raum (Spiele fragen 2–20 an)
const MAX_ROOMS = 3000, MAX_ROOMS_PER_IP = 40;
const MAX_CONN_PER_IP = 80;             // offene WebSockets pro IP
const MSG_RATE = 150, MSG_BURST = 600;  // Nachrichten pro Sekunde und Spitze (Spiele schicken ~20–60 pro Sekunde)
const GAMES_DIR = process.env.GAMES_DIR || '/var/www/games';
const MAX_PER_GAME = +process.env.MAX_PER_GAME || 1000;
// Absicherung: Der Server vertraut dem Browser nicht.
const MAX_BYTES_PER_SEC = 400 * 1024, BYTES_BURST = 2 * 1024 * 1024;   // Datenmenge pro Verbindung (Spiele schicken Zustände, aber keine Megabytes)
const MAX_RELAY_BYTES = 64 * 1024;       // eine einzelne Spiel-Nachricht
const MIN_ROUND_MS = 8000;               // Eine Runde, die kürzer dauert, zählt nicht für die Rangliste
const MAX_COUNTED_PER_PAIR_HOUR = 12;    // gleiche Spieler untereinander: höchstens so viele gewertete Runden pro Stunde (gegen Sieg-Farmen zu zweit)
const MAX_COUNTED_PER_ACCOUNT_HOUR = 60;
const VOTE_GRACE_MS = 3000;              // Nach dem Host-Ergebnis dürfen die anderen so lange widersprechen (room.result() von Nicht-Hosts)
const MISS_LIMIT_PER_IP = 30;            // falsche Raumcodes pro IP und Minute, dann Sperre für diese Minute
const MAX_SCORE_PER_ACCOUNT_HOUR = 120;
// Erlaubte Herkunft (Origin) für WebSocket und schreibende API-Aufrufe: unsere Seite, die Server-IP und lokale Tests.
// Weitere mit ALLOWED_ORIGINS="https://a.example,https://b.example" ergänzen.
const ORIGIN_HOSTS = new Set(['langwiligi.site', '46.224.94.231', 'localhost', '127.0.0.1']);
(process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean).forEach(o => { try { ORIGIN_HOSTS.add(new URL(o).hostname); } catch (e) {} });
function originOk(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return ORIGIN_HOSTS.has(h) || h.endsWith('.langwiligi.site');
  } catch (e) { return false; }
}  // Ranglisten-Einträge pro Spiel; darüber fliegen die schlechtesten raus

// Nur Spiele, die es als Ordner auf der Webseite gibt, dürfen etwas speichern (Liste 1 Min. gecacht)
let knownGames = null, knownAt = 0;
function isKnownGame(game) {
  if (!game) return false;
  if (Date.now() - knownAt > 60000) {
    knownAt = Date.now();
    try {
      knownGames = new Set(fs.readdirSync(GAMES_DIR).filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'index.html'))));
    } catch (e) { knownGames = null; }   // Ordner nicht lesbar (z.B. kurz während dem Hochladen) -> nicht blockieren
  }
  return !knownGames || knownGames.has(game);
}
// Anzeigenamen der Spiele aus dem <title> der Webseite (für die Admin-Seite, 1 Min. gecacht).
// deploy.sh hängt für Google Suchbegriffe an den Titel, die schneiden wir hier wieder ab (wie in games/_shared/back.js).
let titles = {}, titlesAt = 0;
function gameTitle(game) {
  if (Date.now() - titlesAt > 60000) {
    titlesAt = Date.now();
    const t = {};
    try {
      for (const d of fs.readdirSync(GAMES_DIR)) {
        try {
          const m = fs.readFileSync(path.join(GAMES_DIR, d, 'index.html'), 'utf8').slice(0, 6000).match(/<title>([^<]*)<\/title>/i);
          if (m) t[d] = m[1].trim().replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/( \([^)]*\))? – [^|]*\| KEI Langwiligi site$/, '');
        } catch (e) { /* kein Spielordner */ }
      }
    } catch (e) { /* Ordner gerade nicht lesbar */ }
    titles = t;
  }
  return titles[game] || game;
}
// Löscht die schlechtesten Einträge, bis höchstens MAX_PER_GAME übrig sind. worse(a, b) < 0 heisst: a ist schlechter.
function prune(g, worse) {
  const keys = Object.keys(g);
  if (keys.length <= MAX_PER_GAME) return;
  keys.sort((a, b) => worse(g[a], g[b])).slice(0, keys.length - MAX_PER_GAME).forEach(k => delete g[k]);
}

// ---------- Rangliste ----------
let board = {};
try { board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')); } catch (e) { board = {}; }
let saveTimer = null;
function saveBoard() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BOARD_FILE + '.tmp', JSON.stringify(board, null, 1));
    fs.renameSync(BOARD_FILE + '.tmp', BOARD_FILE);
  }, 200);
}
// ---------- Highscores (Einzelspieler: bester Punktestand pro Name) ----------
const SCORE_FILE = path.join(DATA_DIR, 'highscores.json');
let scores = {};
try { scores = JSON.parse(fs.readFileSync(SCORE_FILE, 'utf8')); } catch (e) { scores = {}; }
let scoreTimer = null;
function saveScores() {
  clearTimeout(scoreTimer);
  scoreTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SCORE_FILE + '.tmp', JSON.stringify(scores, null, 1));
    fs.renameSync(SCORE_FILE + '.tmp', SCORE_FILE);
  }, 200);
}
function sortedScores(game) {
  return Object.values(scores[game] || {}).sort((a, b) => b.score - a.score || a.at - b.at);
}
function scoreRows(game) { return sortedScores(game).slice(0, 50); }
function recordScore(game, name, score, jumps) {
  const g = scores[game] || (scores[game] = {});
  const key = name.toLowerCase();
  const e = g[key] || (g[key] = { name, score: 0, jumps: 0, runs: 0, at: 0 });
  e.name = name; e.runs++;
  if (score > e.score) { e.score = score; e.jumps = jumps; e.at = Date.now(); }
  const all = sortedScores(game);
  const result = { rows: all.slice(0, 50), rank: all.indexOf(e) + 1, total: all.length, best: e.score };
  prune(g, (a, b) => a.score - b.score || b.at - a.at);
  saveScores();
  return result;
}
const lastScorePost = new Map();
const namePosts = new Map();   // ip -> Zeitpunkte der letzten Namensabfragen

// ---------- Spiel-Empfehlungen (Knopf "Spiel empfehlen" auf der Startseite) ----------
// Ansehen nur mit Schlüssel: https://langwiligi.site/api/empfehlungen#SCHLUESSEL (steht in admin-key.txt).
// Dieselbe Seite zeigt auch die Bewertungen.
const TIPS_FILE = path.join(DATA_DIR, 'empfehlungen.json');
const MAX_TIPS = 500;
let tips = [];
try { tips = JSON.parse(fs.readFileSync(TIPS_FILE, 'utf8')); } catch (e) { tips = []; }
let tipsTimer = null;
function saveTips() {
  clearTimeout(tipsTimer);
  tipsTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TIPS_FILE + '.tmp', JSON.stringify(tips, null, 1));
    fs.renameSync(TIPS_FILE + '.tmp', TIPS_FILE);
  }, 200);
}
const KEY_FILE = path.join(DATA_DIR, 'admin-key.txt');
let adminKey = '';
try { adminKey = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch (e) {}
if (!adminKey) {
  adminKey = crypto.randomBytes(12).toString('hex');
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(KEY_FILE, adminKey + '\n', { mode: 0o600 }); } catch (e) {}
}
function isAdmin(req) {
  const k = Buffer.from(String(req.headers['x-key'] || '')), a = Buffer.from(adminKey);
  return k.length === a.length && crypto.timingSafeEqual(k, a);
}
function cleanText(s, max) { return String(s || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').trim().slice(0, max); }
const lastTipPost = new Map();
function clientIp(req) {
  return req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress;
}
function readBody(req, max, cb) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > max) req.destroy(); });
  req.on('end', () => { let m = null; try { m = JSON.parse(body); } catch (e) {} cb(m && typeof m === 'object' ? m : null); });
}
// ---------- Bewertungen (1–5 Sterne + Verbesserungsvorschlag, pro Gerät und Spiel zählt die neuste) ----------
// Das Gerät schickt eine zufällige ID mit (localStorage). Gespeichert wird nur ein Hash davon.
const RATINGS_FILE = path.join(DATA_DIR, 'bewertungen.json');
const MAX_RATINGS = 20000;
const RATINGS_PER_IP_HOUR = 40;   // ganze Schulklasse hinter einer IP soll noch gehen
let ratings = [];
try { ratings = JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf8')); } catch (e) { ratings = []; }
let ratingsTimer = null;
function saveRatings() {
  clearTimeout(ratingsTimer);
  ratingsTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RATINGS_FILE + '.tmp', JSON.stringify(ratings));
    fs.renameSync(RATINGS_FILE + '.tmp', RATINGS_FILE);
  }, 200);
}
function hashId(s) { return crypto.createHash('sha256').update('lw|' + s).digest('hex').slice(0, 20); }
const ratingPosts = new Map();   // ip -> Zeitpunkte der letzten Stunde
function ratingAllowed(ip, now) {
  const list = (ratingPosts.get(ip) || []).filter(t => now - t < 3600000);
  if (list.length >= RATINGS_PER_IP_HOUR) return false;
  list.push(now); ratingPosts.set(ip, list);
  if (ratingPosts.size > 5000) ratingPosts.clear();
  return true;
}

// ---------- Aufrufe (für "Trendet" auf der Startseite und die Übersicht für den Betreiber) ----------
// plays[spiel][JJJJ-MM-TT] = Anzahl. Ein Gerät zählt pro Spiel höchstens alle 30 Minuten einmal.
// Die Startseite zählt gleich, unter START_KEY (kein Spielordner, darum mit _).
const PLAYS_FILE = path.join(DATA_DIR, 'aufrufe.json');
const PLAY_DAYS = 60;
const START_KEY = '_start';
let plays = {};
try { plays = JSON.parse(fs.readFileSync(PLAYS_FILE, 'utf8')); } catch (e) { plays = {}; }
let playsTimer = null;
function savePlays() {
  clearTimeout(playsTimer);
  playsTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYS_FILE + '.tmp', JSON.stringify(plays));
    fs.renameSync(PLAYS_FILE + '.tmp', PLAYS_FILE);
  }, 1000);
}
// Tage nach Schweizer Zeit, damit ein Besuch um 00:30 zum richtigen Tag zählt
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' });
function day(t) {
  const p = {};
  DAY_FMT.formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function monday(d) { return addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7)); }
const lastPlay = new Map();
function countPlay(game, ip, now) {
  const key = ip + '|' + game;
  if (now - (lastPlay.get(key) || 0) < 30 * 60000) return;
  lastPlay.set(key, now);
  if (lastPlay.size > 20000) lastPlay.clear();
  const g = plays[game] || (plays[game] = {});
  const d = day(now);
  g[d] = (g[d] || 0) + 1;
  const oldest = addDays(d, -PLAY_DAYS);
  Object.keys(g).forEach(k => { if (k < oldest) delete g[k]; });
  savePlays();
}
// Spielzeit: zeit[spiel][JJJJ-MM-TT] = [Sekunden, Anzahl Besuche]. Die Besuche melden ihre Zeit beim Verlassen der Seite.
const TIME_FILE = path.join(DATA_DIR, 'spielzeit.json');
let zeit = {};
try { zeit = JSON.parse(fs.readFileSync(TIME_FILE, 'utf8')); } catch (e) { zeit = {}; }
let zeitTimer = null;
function saveZeit() {
  clearTimeout(zeitTimer);
  zeitTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TIME_FILE + '.tmp', JSON.stringify(zeit));
    fs.renameSync(TIME_FILE + '.tmp', TIME_FILE);
  }, 1000);
}
const zeitPosts = new Map();   // ip -> Zeitpunkte der letzten Stunde
function countTime(game, sek, ip, now) {
  const list = (zeitPosts.get(ip) || []).filter(t => now - t < 3600000);
  if (list.length >= 120) return;
  list.push(now); zeitPosts.set(ip, list);
  if (zeitPosts.size > 5000) zeitPosts.clear();
  const g = zeit[game] || (zeit[game] = {}), d = day(now), e = g[d] || (g[d] = [0, 0]);
  e[0] += sek; e[1]++;
  const oldest = addDays(d, -PLAY_DAYS);
  Object.keys(g).forEach(k => { if (k < oldest) delete g[k]; });
  saveZeit();
}
// Aufrufe eines Tages: Startseite und alle Spiele zusammen
function dayTotals(d) {
  const t = { start: 0, spiele: 0 };
  Object.keys(plays).forEach(g => { t[g === START_KEY ? 'start' : 'spiele'] += plays[g][d] || 0; });
  return t;
}

// ---------- Verlauf: Wochenschnitt für die Jahres-Ansicht ----------
// Die Tageszahlen bleiben nur PLAY_DAYS Tage. Von jeder fertigen Woche (Montag bis Sonntag) wird darum
// der Durchschnitt pro Tag aufbewahrt, und zwar für immer: wochen[Montag] = { start, spiele }.
// seit = erster gezählter Tag; Tage davor zählen nicht in den Durchschnitt.
const HISTORY_FILE = path.join(DATA_DIR, 'verlauf.json');
let history = { seit: {}, wochen: {} };
try {
  const h = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  if (h && h.seit && h.wochen) history = h;
} catch (e) { /* noch kein Verlauf */ }
function weekAvg(mon, last) {
  const out = {};
  ['start', 'spiele'].forEach(s => {
    let sum = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      if (d > last || d < history.seit[s]) continue;
      sum += dayTotals(d)[s]; n++;
    }
    out[s] = n ? Math.round(sum / n * 10) / 10 : null;
  });
  return out;
}
function rollWeeks() {
  const today = day(Date.now()), oldest = addDays(today, -PLAY_DAYS);
  let changed = false;
  if (!history.seit.start) { history.seit.start = today; changed = true; }
  if (!history.seit.spiele) {
    let first = today;
    Object.keys(plays).forEach(g => { if (g !== START_KEY) Object.keys(plays[g]).forEach(d => { if (d < first) first = d; }); });
    history.seit.spiele = first < oldest ? oldest : first;
    changed = true;
  }
  // Nur Wochen, deren Tage noch alle vorhanden sind
  let m = monday(oldest);
  if (m < oldest) m = addDays(m, 7);
  for (const cur = monday(today); m < cur; m = addDays(m, 7)) {
    if (history.wochen[m]) continue;
    const w = weekAvg(m, addDays(m, 6));
    if (w.start === null && w.spiele === null) continue;
    history.wochen[m] = w;
    changed = true;
  }
  if (changed) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(HISTORY_FILE + '.tmp', JSON.stringify(history, null, 1));
      fs.renameSync(HISTORY_FILE + '.tmp', HISTORY_FILE);
    } catch (e) { console.error('Verlauf nicht gespeichert:', e.message); }
  }
}
rollWeeks();
setInterval(rollWeeks, 3600000);
// Alles für die Übersicht: Tageszahlen, Wochenschnitte (inkl. laufender Woche) und Aufrufe pro Spiel
function visitStats() {
  const today = day(Date.now()), days = [];
  for (let i = PLAY_DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i), t = dayTotals(d);
    days.push({ d, start: d < history.seit.start ? null : t.start, spiele: d < history.seit.spiele ? null : t.spiele });
  }
  const cur = monday(today);
  const weeks = Object.keys(history.wochen).filter(w => w < cur).sort().map(w => Object.assign({ w }, history.wochen[w]));
  weeks.push(Object.assign({ w: cur, laufend: true }, weekAvg(cur, today)));
  const week = addDays(today, -6), month = addDays(today, -29), games = [], heute = [];
  Object.keys(plays).forEach(g => {
    if (g === START_KEY) return;
    const e = { game: g, name: gameTitle(g), week: 0, month: 0, total: 0 };
    Object.keys(plays[g]).forEach(d => {
      e.total += plays[g][d];
      if (d >= month) e.month += plays[g][d];
      if (d >= week) e.week += plays[g][d];
    });
    const z = zeit[g] || {};
    let sek = 0, n = 0;
    Object.keys(z).forEach(d => { if (d >= month) { sek += z[d][0]; n += z[d][1]; } });
    e.avgSek = n ? Math.round(sek / n) : null;
    if (e.month) games.push(e);
    if (plays[g][today]) {
      const t = z[today];
      heute.push({ game: g, name: e.name, n: plays[g][today], sek: t ? t[0] : 0, avgSek: t && t[1] ? Math.round(t[0] / t[1]) : null });
    }
  });
  games.sort((a, b) => b.month - a.month || b.week - a.week);
  heute.sort((a, b) => b.n - a.n);
  return { today, days, weeks, games, heute };
}

// Öffentliche Zahlen pro Spiel: Durchschnitt, Anzahl Bewertungen, Aufrufe der letzten 7 Tage
function gameStats() {
  const out = {};
  const get = g => out[g] || (out[g] = { avg: 0, count: 0, sum: 0, week: 0 });
  ratings.forEach(r => { const e = get(r.game); e.count++; e.sum += r.stars; });
  const since = addDays(day(Date.now()), -6);
  Object.keys(plays).forEach(g => {
    if (g === START_KEY) return;
    const e = get(g);
    Object.keys(plays[g]).forEach(d => { if (d >= since) e.week += plays[g][d]; });
  });
  Object.values(out).forEach(e => { e.avg = e.count ? Math.round(e.sum / e.count * 100) / 100 : 0; delete e.sum; });
  return out;
}

// Übersicht für den Betreiber. Der Schlüssel steht nach dem # und wird darum nie an den Server/ins Log geschickt.
const ADMIN_PAGE = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Langwiligi Übersicht</title><style>
:root{color-scheme:dark;--bg:#07060d;--panel:#100e1c;--line:#2a2540;--text:#ecebf5;--muted:#8e89a8;--pink:#ff2e88;--cyan:#22e4ff;--yellow:#ffe14d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1240px;margin:0 auto;padding:32px 16px 64px}h1{margin:0 0 20px;font-size:28px;letter-spacing:.02em}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}@media (max-width:820px){.cols{grid-template-columns:1fr}}
section{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:16px}
section h2{margin:0 0 2px;font-size:18px;text-transform:uppercase;letter-spacing:.12em}
#tips-col h2{color:var(--pink)}#rates-col h2{color:var(--cyan)}.sub{color:var(--muted);margin:0 0 14px;font-size:14px}
.item{border-top:1px solid var(--line);padding:12px 0;display:flex;gap:12px}.item.done{opacity:.45}.item>div{flex:1;min-width:0}
.item h3{margin:0;font-size:16px;overflow-wrap:anywhere}.item p{margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.meta{color:var(--muted);font-size:13px;margin-top:4px}.stars{color:var(--yellow);letter-spacing:2px}
.item nav{display:flex;flex-direction:column;gap:6px}
button{font:600 13px system-ui,sans-serif;color:var(--text);background:transparent;border:1px solid var(--line);border-radius:3px;padding:6px 10px;cursor:pointer;white-space:nowrap}
button:hover{border-color:var(--cyan)}button.del:hover{border-color:var(--pink);color:var(--pink)}
.sum{display:grid;grid-template-columns:1fr auto auto;gap:4px 12px;margin:0 0 14px;font-size:14px}.sum b{font-weight:600}
.sum span{color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
select{font:14px system-ui,sans-serif;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:3px;padding:6px 8px;margin:0 0 6px}
a{color:var(--yellow)}.msg{color:var(--muted)}
#stats-col{margin:0 0 24px}#stats-col h2{color:var(--yellow)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 16px}
.tile{border:1px solid var(--line);border-radius:4px;padding:10px 12px}.tile b{display:block;font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}
.tile span{color:var(--muted);font-size:13px}
.range{display:flex;gap:6px;margin:0 0 12px}.range button[aria-pressed="true"]{border-color:var(--yellow);color:var(--yellow)}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media (max-width:820px){.charts{grid-template-columns:1fr}}
figure{margin:0;min-width:0}figcaption{font-weight:600;margin:0 0 6px}figcaption span{color:var(--muted);font-weight:400;font-size:13px}
.chart{position:relative;height:220px;outline:none}.chart:focus-visible{box-shadow:0 0 0 2px var(--yellow);border-radius:3px}
.chart svg{display:block;width:100%;height:220px}.chart text{font:11px system-ui,sans-serif;fill:var(--muted);font-variant-numeric:tabular-nums}
.chart text.val{fill:var(--text);font-weight:600;font-size:12px}.chart .bar.hi{filter:brightness(1.3)}
.tip{position:absolute;top:4px;pointer-events:none;background:var(--bg);border:1px solid var(--line);border-radius:3px;padding:6px 9px;font-size:13px;white-space:nowrap;display:none;transform:translateX(-50%)}
.tip b{display:block;font-size:16px;font-variant-numeric:tabular-nums}.tip span{color:var(--muted)}
[hidden]{display:none!important}
.tile.btn{cursor:pointer;text-align:left;font:inherit;color:inherit;background:transparent}.tile.btn:hover,.tile.btn[aria-expanded="true"]{border-color:var(--yellow)}.tile.btn span:after{content:' ▾'}
.sum.zeit{grid-template-columns:1fr auto auto}#heute{margin:0 0 16px}#heute h3{margin:0 0 6px;font-size:15px}
#top-h{cursor:pointer}#top-h:hover{color:var(--yellow)}#top-h:after{content:' ▾'}#top-h[aria-expanded="true"]:after{content:' ▴'}
.empty{color:var(--muted);display:flex;align-items:center;justify-content:center;height:100%}
#top-h{margin:20px 0 6px;font-size:15px}details{margin-top:14px;color:var(--muted);font-size:14px}summary{cursor:pointer}
table{border-collapse:collapse;margin-top:8px;font-variant-numeric:tabular-nums}td,th{padding:3px 14px 3px 0;text-align:right;color:var(--text)}td:first-child,th:first-child{text-align:left}th{color:var(--muted);font-weight:600}
</style></head><body><main><h1>Übersicht</h1><p class="msg" id="err"></p>
<section id="stats-col"><h2>Aufrufe</h2><p class="sub">Ein Gerät zählt pro Seite höchstens alle 30 Minuten einmal. Ohne Cookies, es wird nur gezählt.</p>
<div class="tiles" id="tiles"></div>
<div class="range" role="group" aria-label="Zeitraum"><button data-r="7" aria-pressed="true">Woche</button><button data-r="30" aria-pressed="false">Monat</button><button data-r="jahre" aria-pressed="false">Jahre</button></div>
<div class="charts"><figure><figcaption>Startseite <span class="unit"></span></figcaption><div class="chart" id="ch-start" tabindex="0"></div></figure>
<figure><figcaption>Spiele, alle zusammen <span class="unit"></span></figcaption><div class="chart" id="ch-spiele" tabindex="0"></div></figure></div>
<details><summary>Als Tabelle</summary><table id="tbl"></table></details>
<div id="heute" hidden></div>
<h3 id="top-h" role="button" tabindex="0" aria-expanded="false">Meistgespielt</h3><div class="sum" id="top" hidden></div></section>
<div class="cols"><section id="tips-col"><h2>Empfehlungen</h2><p class="sub" id="tips-sub">Lade …</p><div id="tips"></div></section>
<section id="rates-col"><h2>Bewertungen</h2><p class="sub" id="rates-sub">Lade …</p><div class="sum" id="sum"></div>
<select id="filter"><option value="">Alle Spiele</option></select> <label class="msg"><input type="checkbox" id="notes"> nur mit Verbesserungsvorschlag</label><div id="rates"></div></section></div></main>
<script>
var key=decodeURIComponent(location.hash.slice(1)),allRates=[];
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function link(s){return esc(s).replace(/https?:\\/\\/[^\\s<"]+/g,function(u){return '<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>'})}
function when(t){return new Date(t).toLocaleString('de-CH')}
function stars(n){return '★★★★★'.slice(0,n)+'<span style="opacity:.25">'+'★★★★★'.slice(n)+'</span>'}
function call(file,m,body){return fetch(file,{method:m,headers:{'X-Key':key,'Content-Type':'text/plain'},body:body&&JSON.stringify(body),cache:'no-store'})
.then(function(r){if(r.status===403)throw new Error('key');if(!r.ok)throw new Error('http');return r.json()})}
function showTips(rows){var open=rows.filter(function(t){return !t.done}).length;
document.getElementById('tips-sub').textContent=rows.length?rows.length+' Empfehlungen, davon '+open+' offen':'Noch keine Empfehlungen.';
document.getElementById('tips').innerHTML=rows.slice().reverse().map(function(t){return '<div class="item'+(t.done?' done':'')+'"><div><h3>'+esc(t.game)+'</h3>'+
(t.note?'<p>'+link(t.note)+'</p>':'')+'<div class="meta">'+esc(t.name||'Anonym')+' · '+when(t.at)+'</div></div>'+
'<nav><button data-t="tip" data-a="done" data-id="'+t.id+'">'+(t.done?'Wieder offen':'Erledigt')+'</button><button class="del" data-t="tip" data-a="delete" data-id="'+t.id+'">Löschen</button></nav></div>'}).join('')}
function showRates(rows){allRates=rows;var by={},names={};rows.forEach(function(r){names[r.game]=r.name||r.game;var g=by[r.game]||(by[r.game]={n:0,s:0});g.n++;g.s+=r.stars});
var games=Object.keys(by).sort(function(a,b){return by[b].s/by[b].n-by[a].s/by[a].n||by[b].n-by[a].n});
document.getElementById('rates-sub').textContent=rows.length?rows.length+' Bewertungen für '+games.length+' Spiele':'Noch keine Bewertungen.';
document.getElementById('sum').innerHTML=games.map(function(g){return '<b>'+esc(names[g])+'</b><span>'+(by[g].s/by[g].n).toFixed(1)+' ★</span><span>'+by[g].n+'×</span>'}).join('');
var f=document.getElementById('filter'),cur=f.value;f.innerHTML='<option value="">Alle Spiele</option>'+games.map(function(g){return '<option value="'+esc(g)+'"'+(g===cur?' selected':'')+'>'+esc(names[g])+'</option>'}).join('');
listRates()}
function listRates(){var g=document.getElementById('filter').value,n=document.getElementById('notes').checked;
document.getElementById('rates').innerHTML=allRates.filter(function(r){return (!g||r.game===g)&&(!n||r.note)}).slice().reverse().slice(0,300).map(function(r){
return '<div class="item"><div><h3>'+esc(r.name||r.game)+' <span class="stars">'+stars(r.stars)+'</span></h3>'+(r.note?'<p>'+link(r.note)+'</p>':'')+'<div class="meta">'+when(r.at)+(r.v?' · Version '+esc(r.v):'')+'</div></div>'+
'<nav><button class="del" data-t="rate" data-a="delete" data-id="'+r.id+'">Löschen</button></nav></div>'}).join('')}
function err(e){document.getElementById('err').textContent=e.message==='key'?'Falscher oder fehlender Schlüssel. Link: …/api/empfehlungen#SCHLUESSEL':'Server nicht erreichbar.'}
document.getElementById('filter').addEventListener('change',listRates);document.getElementById('notes').addEventListener('change',listRates);
document.body.addEventListener('click',function(e){var b=e.target.closest('button[data-t]');if(!b)return;
if(b.dataset.t==='tip')call('empfehlungen.json','POST',{action:b.dataset.a,id:b.dataset.id}).then(showTips,err);
else call('bewertungen.json','POST',{action:'delete',id:b.dataset.id}).then(showRates,err)});
var visits=null,heuteOffen=false,range='7',COLORS={start:'#0fa3bf',spiele:'#ff2e88'};
function day(d,o){o.timeZone='UTC';return new Date(d+'T12:00:00Z').toLocaleDateString('de-CH',o)}
function num(v){return v==null?'–':(Math.round(v*10)/10).toLocaleString('de-CH')}
function avg(list,k){var s=0,n=0;list.forEach(function(d){if(d[k]!=null){s+=d[k];n++}});return n?s/n:null}
function points(k){
if(range==='jahre')return visits.weeks.map(function(w){return{v:w[k],t:'Woche ab '+day(w.w,{day:'numeric',month:'numeric',year:'numeric'})+(w.laufend?' (laufend)':''),x:day(w.w,{month:'short',year:'2-digit'})}});
return visits.days.slice(-range).map(function(d){return{v:d[k],t:day(d.d,{weekday:'short',day:'numeric',month:'numeric',year:'numeric'}),
x:range==='7'?day(d.d,{weekday:'short',day:'numeric',month:'numeric'}):day(d.d,{day:'numeric',month:'numeric'})}})}
function nice(x){if(x<=0)return 1;var p=Math.pow(10,Math.floor(Math.log10(x))),f=x/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p}
function draw(el,pts,color,line){
var W=el.clientWidth||600,H=220,L=40,R=12,T=22,B=24,pw=W-L-R,ph=H-T-B,n=pts.length,max=0,last=-1;
pts.forEach(function(p,i){if(p.v!=null){if(p.v>max)max=p.v;last=i}});
if(last<0){el.innerHTML='<div class="empty">Noch keine Daten</div>';return}
var step=nice(max/4),top=step*Math.max(1,Math.ceil(max/step)),cw=pw/n,bw=Math.max(1,Math.min(48,cw-2));
function y(v){return T+ph-v/top*ph}function cx(i){return L+cw*(i+.5)}
var g='',k=Math.ceil(n/Math.max(1,Math.floor(pw/64)));
for(var t=0;t<=top+1e-9;t+=step)g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(t)+'" y2="'+y(t)+'" stroke="var(--line)"/><text x="'+(L-6)+'" y="'+(y(t)+4)+'" text-anchor="end">'+num(t)+'</text>';
pts.forEach(function(p,i){if((n-1-i)%k)return;var e=cx(i)+30>W;g+='<text x="'+(e?W-2:cx(i))+'" y="'+(H-6)+'" text-anchor="'+(e?'end':'middle')+'">'+esc(p.x)+'</text>'});
if(line){var d='',pen=false;pts.forEach(function(p,i){if(p.v==null){pen=false;return}d+=(pen?'L':'M')+cx(i)+' '+y(p.v);pen=true});
g+='<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round"/>';
function alone(i){return(!pts[i-1]||pts[i-1].v==null)&&(!pts[i+1]||pts[i+1].v==null)}
pts.forEach(function(p,i){if(p.v!=null&&(n<=40||alone(i)))g+='<circle cx="'+cx(i)+'" cy="'+y(p.v)+'" r="4" fill="'+color+'" stroke="var(--panel)" stroke-width="2"/>'});
g+='<line class="cross" x1="0" x2="0" y1="'+T+'" y2="'+(T+ph)+'" stroke="var(--muted)" visibility="hidden"/>'}
else pts.forEach(function(p,i){if(!p.v)return;var x=cx(i)-bw/2,yy=y(p.v),r=Math.min(4,bw/2,T+ph-yy),b=T+ph;
g+='<path class="bar" data-i="'+i+'" fill="'+color+'" d="M'+x+' '+b+'V'+(yy+r)+'Q'+x+' '+yy+' '+(x+r)+' '+yy+'H'+(x+bw-r)+'Q'+(x+bw)+' '+yy+' '+(x+bw)+' '+(yy+r)+'V'+b+'Z"/>'});
g+='<text class="val" x="'+cx(last)+'" y="'+(y(pts[last].v)-8)+'" text-anchor="middle">'+num(pts[last].v)+'</text>';
el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Diagramm, Werte auch in der Tabelle">'+g+'</svg><div class="tip"><b></b><span></span></div>';
el._c={pts:pts,L:L,cw:cw,cx:cx,line:line,i:-1}}
function show(el,i){var c=el._c;if(!c)return;var tip=el.querySelector('.tip'),cr=el.querySelector('.cross');
el.querySelectorAll('.bar.hi').forEach(function(b){b.classList.remove('hi')});
if(i<0||i>=c.pts.length){c.i=-1;tip.style.display='none';if(cr)cr.setAttribute('visibility','hidden');return}
c.i=i;var p=c.pts[i],x=c.cx(i);
tip.querySelector('b').textContent=p.v==null?'nicht gezählt':num(p.v)+(range==='jahre'?' pro Tag':'');
tip.querySelector('span').textContent=p.t;tip.style.display='block';
tip.style.left=Math.max(tip.offsetWidth/2,Math.min(el.clientWidth-tip.offsetWidth/2,x))+'px';
if(cr){cr.setAttribute('x1',x);cr.setAttribute('x2',x);cr.setAttribute('visibility','visible')}
var b=el.querySelector('.bar[data-i="'+i+'"]');if(b)b.classList.add('hi')}
['ch-start','ch-spiele'].forEach(function(id){var el=document.getElementById(id);
el.addEventListener('pointermove',function(e){var c=el._c;if(c)show(el,Math.floor((e.clientX-el.getBoundingClientRect().left-c.L)/c.cw))});
el.addEventListener('pointerleave',function(){show(el,-1)});el.addEventListener('blur',function(){show(el,-1)});
el.addEventListener('keydown',function(e){var c=el._c;if(!c)return;var i=c.i<0?c.pts.length-1:c.i;
if(e.key==='ArrowLeft')i--;else if(e.key==='ArrowRight')i++;else return;e.preventDefault();show(el,Math.max(0,Math.min(c.pts.length-1,i)))});
el.addEventListener('focus',function(){if(el._c)show(el,el._c.pts.length-1)})});
function render(){if(!visits)return;var s=points('start'),p=points('spiele');
draw(document.getElementById('ch-start'),s,COLORS.start,range==='jahre');draw(document.getElementById('ch-spiele'),p,COLORS.spiele,range==='jahre');
document.querySelectorAll('.unit').forEach(function(u){u.textContent=range==='jahre'?'· Durchschnitt pro Tag, je Woche':'· Aufrufe pro Tag'});
document.getElementById('tbl').innerHTML='<tr><th>'+(range==='jahre'?'Woche (Ø pro Tag)':'Tag')+'</th><th>Startseite</th><th>Spiele</th></tr>'+
s.map(function(x,i){return '<tr><td>'+esc(x.t)+'</td><td>'+num(x.v)+'</td><td>'+num(p[i].v)+'</td></tr>'}).reverse().join('')}
function showVisits(v){visits=v;var d=v.days,t=d[d.length-1],y=d[d.length-2];
document.getElementById('tiles').innerHTML=[[num(t.start),'Startseite heute'],[num(y.start),'Startseite gestern'],[num(avg(d.slice(-7),'start')),'Startseite Ø pro Tag, 7 Tage'],
[num(avg(d.slice(-30),'start')),'Startseite Ø pro Tag, 30 Tage'],[num(t.spiele),'Spiel-Aufrufe heute']].map(function(x,i){return i===4?'<button class="tile btn" id="tile-heute" aria-expanded="'+(heuteOffen?'true':'false')+'"><b>'+x[0]+'</b><span>'+x[1]+'</span></button>':'<div class="tile"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>'}).join('');
document.getElementById('top').innerHTML=v.games.length?'<b>Spiel</b><span>7 Tage</span><span>30 Tage</span>'+v.games.map(function(g){return '<b>'+esc(g.name)+'</b><span>'+g.week+'× gespielt</span><span>'+g.month+'× gespielt</span>'}).join(''):'<span class="msg">Noch keine Aufrufe.</span>';
showHeute();render()}
function dauer(s){if(s==null)return '–';if(s<90)return s+' s';var m=Math.round(s/60);return m<90?m+' Min.':Math.floor(m/60)+' Std. '+(m%60)+' Min.'}
function showHeute(){var el=document.getElementById('heute'),b=document.getElementById('tile-heute'),h=visits&&visits.heute||[];
el.hidden=!heuteOffen;if(b)b.setAttribute('aria-expanded',heuteOffen?'true':'false');if(!heuteOffen)return;
el.innerHTML='<h3>Heute gespielt</h3>'+(h.length?'<div class="sum zeit"><b>Spiel</b><span>Aufrufe</span><span>Zeit pro Besuch (Ø)</span>'+h.map(function(g){return '<b>'+esc(g.name)+'</b><span>'+g.n+'×</span><span>'+(g.avgSek==null?'noch offen':'ca. '+dauer(g.avgSek))+'</span>'}).join('')+'</div><p class="msg">Die Zeit zählt nur, solange das Spiel im Vordergrund offen ist, und wird beim Verlassen der Seite gemeldet.</p>':'<p class="msg">Heute wurde noch nichts gespielt.</p>')}
document.addEventListener('click',function(e){if(e.target.closest('#tile-heute')){heuteOffen=!heuteOffen;showHeute()}
var h=e.target.closest('#top-h');if(h)toggleTop(h)});
document.addEventListener('keydown',function(e){var h=e.target.closest&&e.target.closest('#top-h');if(h&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggleTop(h)}});
function toggleTop(h){var o=h.getAttribute('aria-expanded')!=='true';h.setAttribute('aria-expanded',o?'true':'false');document.getElementById('top').hidden=!o}
document.querySelector('.range').addEventListener('click',function(e){var b=e.target.closest('button[data-r]');if(!b)return;range=b.dataset.r;
document.querySelectorAll('.range button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});render()});
var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(render,150)});
call('aufrufe.json','GET').then(showVisits,err);call('empfehlungen.json','GET').then(showTips,err);call('bewertungen.json','GET').then(showRates,err);
</script></body></html>`;

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Spieler';
}
// Wie cleanName, aber leer bleibt leer und mehrfache Leerzeichen werden eins (für Benutzernamen)
function rawName(n) {
  return String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
}
function cleanGame(g) { return String(g || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40); }
function rows(game) {
  const g = board[game] || {};
  return Object.values(g).sort((a, b) => b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name)).slice(0, 50);
}
function record(game, names, winnerIdx) {
  if (!isKnownGame(game)) return;
  const g = board[game] || (board[game] = {});
  names.forEach((name, i) => {
    if (!name) return;
    const key = name.toLowerCase();
    const e = g[key] || (g[key] = { name, wins: 0, games: 0 });
    e.name = name; e.games++; e.at = Date.now();
    if (i === winnerIdx) e.wins++;
  });
  // Bei Gleichstand geht zuerst raus, wer am längsten nicht mehr gespielt hat
  prune(g, (a, b) => a.wins - b.wins || a.games - b.games || (a.at || 0) - (b.at || 0));
  saveBoard();
}

// ---------- Schiedsrichter: der Server spielt mit und kennt die Regeln ----------
// Der Server sieht alle Nachrichten eines Raums. Für Spiele, deren Züge vollständig durch den Server laufen, gibt es hier
// einen Schiedsrichter: Er verfolgt die Partie mit, lehnt regelwidrige Züge ab (sie werden nicht weitergeleitet, die Runde zählt dann nicht)
// und bestimmt den Sieger selbst. Das Ergebnis des Hosts spielt für die Rangliste dann keine Rolle mehr.
// Neues Spiel: unten in REFEREES einen Eintrag mit dem Spiel-Ordnernamen ergänzen. Die Funktion liefert ein Objekt mit
//   move(seat, daten)  -> true (Nachricht ok, weiterleiten) oder false (regelwidrig)
//   verdict()          -> null (läuft noch / unbekannt) oder { winner: Platz im Raum, -1 = unentschieden }
// REFEREE_MODE=watch: nur protokollieren, nichts verwerfen und den Host weiter zählen lassen (falls ein Schiedsrichter fälschlich ablehnt)
const REFEREE_WATCH = process.env.REFEREE_MODE === 'watch';
// Gemeinsames Gerüst für die Brettspiele der Plattform (GameRegistry): Der Host schickt start { swap, options }, danach kommen die Züge
// als mv { m: Zug }. Spieler p (0 = beginnt) sitzt auf Platz (swap ? 1 - p : p). Das Gerüst kümmert sich um Start, Platz und Zugrecht,
// die Engine nur um die Regeln:
//   engine.init(options, seed) -> Spielzustand, oder null wenn die Optionen ungültig sind
//   engine.turn(state)      -> Spieler (0/1), der jetzt ziehen darf
//   engine.apply(state, zug)-> true (legal, Zustand ist aktualisiert) oder false
//   engine.result(state)    -> null (läuft noch) oder { winner: Spieler 0/1, oder -1 = unentschieden }
function platformReferee(engine) {
  return () => {
    let st = null, swap = false;
    return {
      move(seat, d) {
        if (!d || typeof d !== 'object') return false;
        if (d.t === 'start') {
          if (seat !== 0) return false;
          st = engine.init(d.options && typeof d.options === 'object' ? d.options : {}, d.seed);
          swap = !!d.swap;
          return !!st;
        }
        if (d.t !== 'mv') return true;   // again, bye usw.: nichts zu prüfen
        if (!st || engine.result(st)) return false;
        if (seat !== (swap ? 1 - engine.turn(st) : engine.turn(st))) return false;
        try { return !!engine.apply(st, d.m); } catch (e) { return false; }
      },
      verdict() {
        const r = st && engine.result(st);
        return r ? { winner: r.winner < 0 ? -1 : (swap ? 1 - r.winner : r.winner) } : null;
      },
    };
  };
}
// Hilfen für die Engines
const inChoices = (v, list, def) => { v = v === undefined || v === null || v === '' ? def : +v; return list.includes(v) ? v : null; };
// n gleiche Steine in einer Reihe durch (r, c)? board[r][c] === p, beliebige Grösse
function lineThrough(board, rows, cols, r, c, p, need) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (let k = 1; ; k++) { const y = r + dr * k, x = c + dc * k; if (y < 0 || x < 0 || y >= rows || x >= cols || board[y][x] !== p) break; n++; }
    for (let k = 1; ; k++) { const y = r - dr * k, x = c - dc * k; if (y < 0 || x < 0 || y >= rows || x >= cols || board[y][x] !== p) break; n++; }
    if (n >= need) return true;
  }
  return false;
}
const LINES3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function winner3(cells) { for (const [a, b, c] of LINES3) if (cells[a] !== null && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]; return null; }

const ENGINES = {
  // Fünf gewinnt: Zug { r, c }, Brett size×size, need in einer Reihe
  'fuenf-gewinnt': {
    init(o) {
      const size = inChoices(o.size, [9, 13, 15, 19], 15), need = inChoices(o.need, [4, 5, 6], 5);
      if (!size || !need) return null;
      return { size, need, board: Array.from({ length: size }, () => Array(size).fill(-1)), turn: 0, moves: 0, res: null };
    },
    turn: st => st.turn,
    apply(st, m) {
      const r = m && m.r, c = m && m.c;
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= st.size || c >= st.size || st.board[r][c] !== -1) return false;
      const p = st.turn; st.board[r][c] = p; st.moves++;
      if (lineThrough(st.board, st.size, st.size, r, c, p, st.need)) st.res = { winner: p };
      else if (st.moves >= st.size * st.size) st.res = { winner: -1 };
      else st.turn = 1 - p;
      return true;
    },
    result: st => st.res,
  },
  // Vier gewinnt: Zug = Spalte (Zahl), Steine fallen nach unten
  'vier-gewinnt': {
    init(o) {
      const cols = inChoices(o.cols, [5, 7, 9], 7), rows = inChoices(o.rows, [5, 6, 8], 6), need = inChoices(o.need, [3, 4, 5], 4);
      if (!cols || !rows || !need) return null;
      return { cols, rows, need, board: Array.from({ length: rows }, () => Array(cols).fill(-1)), turn: 0, res: null };
    },
    turn: st => st.turn,
    apply(st, c) {
      if (!Number.isInteger(c) || c < 0 || c >= st.cols) return false;
      let r = -1;
      for (let y = st.rows - 1; y >= 0; y--) if (st.board[y][c] === -1) { r = y; break; }
      if (r < 0) return false;
      const p = st.turn; st.board[r][c] = p;
      if (lineThrough(st.board, st.rows, st.cols, r, c, p, st.need)) st.res = { winner: p };
      else if (st.board[0].every(v => v !== -1)) st.res = { winner: -1 };
      else st.turn = 1 - p;
      return true;
    },
    result: st => st.res,
  },
  // Ultimate Tic-Tac-Toe: Zug { b, c } (Teilbrett, Feld), man muss im Teilbrett spielen, auf das der letzte Zug zeigte
  'ultimate-tic-tac-toe': {
    init() { return { boards: Array.from({ length: 9 }, () => Array(9).fill(null)), bWin: Array(9).fill(null), turn: 0, forced: -1, res: null }; },
    turn: st => st.turn,
    apply(st, m) {
      const b = m && m.b, c = m && m.c;
      if (!Number.isInteger(b) || !Number.isInteger(c) || b < 0 || b > 8 || c < 0 || c > 8) return false;
      if (st.bWin[b] !== null || (st.forced !== -1 && b !== st.forced) || st.boards[b][c] !== null) return false;
      const p = st.turn; st.boards[b][c] = p;
      const w = winner3(st.boards[b]);
      if (w !== null) st.bWin[b] = w; else if (st.boards[b].every(v => v !== null)) st.bWin[b] = 'draw';
      const bw = winner3(st.bWin.map(x => (x === 0 || x === 1) ? x : null));
      if (bw !== null) { st.res = { winner: bw }; return true; }
      if (st.bWin.every(x => x !== null)) {
        const c0 = st.bWin.filter(x => x === 0).length, c1 = st.bWin.filter(x => x === 1).length;
        st.res = { winner: c0 === c1 ? -1 : (c0 > c1 ? 0 : 1) };
        return true;
      }
      st.forced = st.bWin[c] === null ? c : -1;
      st.turn = 1 - p;
      return true;
    },
    result: st => st.res,
  },

  // Reversi: Zug { r, c }. Ohne Zug des Gegners zieht man nochmal, ohne Zug für beide ist Schluss. Mehr Steine gewinnen.
  'reversi': (() => {
    const N = 8, DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    const flips = (b, r, c, p) => {
      if (b[r][c] !== null) return [];
      const out = [];
      for (const [dr, dc] of DIRS) {
        const line = []; let y = r + dr, x = c + dc;
        while (y >= 0 && x >= 0 && y < N && x < N && b[y][x] === 1 - p) { line.push([y, x]); y += dr; x += dc; }
        if (line.length && y >= 0 && x >= 0 && y < N && x < N && b[y][x] === p) out.push(...line);
      }
      return out;
    };
    const hasMove = (b, p) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (flips(b, r, c, p).length) return true; return false; };
    return {
      init() {
        const b = Array.from({ length: N }, () => Array(N).fill(null));
        b[3][3] = 1; b[3][4] = 0; b[4][3] = 0; b[4][4] = 1;
        return { b, turn: 0, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        const r = m && m.r, c = m && m.c;
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= N || c >= N) return false;
        const f = flips(st.b, r, c, st.turn);
        if (!f.length) return false;
        st.b[r][c] = st.turn; f.forEach(([y, x]) => { st.b[y][x] = st.turn; });
        const other = 1 - st.turn;
        if (hasMove(st.b, other)) st.turn = other;
        else if (!hasMove(st.b, st.turn)) {
          let n0 = 0, n1 = 0;
          st.b.forEach(row => row.forEach(v => { if (v === 0) n0++; else if (v === 1) n1++; }));
          st.res = { winner: n0 > n1 ? 0 : n1 > n0 ? 1 : -1 };
        }
        return true;
      },
      result: st => st.res,
    };
  })(),
  // Mancala: Zug = Mulde 0–5 (Spieler 0) oder 7–12 (Spieler 1). Speicher 6 und 13. Letzter Stein im eigenen Speicher = nochmal.
  'mancala': {
    init() { return { pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: 0, res: null }; },
    turn: st => st.turn,
    apply(st, i) {
      const own = (p, k) => p === 0 ? (k >= 0 && k <= 5) : (k >= 7 && k <= 12);
      if (!Number.isInteger(i) || !own(st.turn, i) || st.pits[i] === 0) return false;
      const me = st.turn, myS = me === 0 ? 6 : 13, oppS = me === 0 ? 13 : 6, pits = st.pits;
      let stones = pits[i], idx = i; pits[i] = 0;
      while (stones > 0) { idx = (idx + 1) % 14; if (idx === oppS) continue; pits[idx]++; stones--; }
      if (own(me, idx) && pits[idx] === 1) {
        const opp = 12 - idx;
        if (pits[opp] > 0) { pits[myS] += pits[opp] + 1; pits[opp] = 0; pits[idx] = 0; }
      }
      const empty = p => { for (let k = p === 0 ? 0 : 7; k <= (p === 0 ? 5 : 12); k++) if (pits[k] > 0) return false; return true; };
      if (empty(0) || empty(1)) {
        for (let k = 0; k <= 5; k++) { pits[6] += pits[k]; pits[k] = 0; }
        for (let k = 7; k <= 12; k++) { pits[13] += pits[k]; pits[k] = 0; }
        st.res = { winner: pits[6] > pits[13] ? 0 : pits[13] > pits[6] ? 1 : -1 };
        return true;
      }
      st.turn = idx === myS ? me : 1 - me;
      return true;
    },
    result: st => st.res,
  },
  // Dame: Zug { from:[r,c], to:[r,c] } (cap wird vom Server selbst bestimmt). Schlagpflicht, Weiterschlagen, Dame bei "kings": "flying" fliegend.
  'dame': (() => {
    const N = 8, inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N, D4 = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    function pieceMoves(st, r, c, capsOnly) {
      const b = st.board, piece = b[r][c], moves = [];
      if (!piece) return moves;
      if (piece.king && st.flying) {
        for (const [dr, dc] of D4) {
          let y = r + dr, x = c + dc;
          while (inB(y, x) && b[y][x] === null) { if (!capsOnly) moves.push({ to: [y, x], cap: null }); y += dr; x += dc; }
          if (inB(y, x) && b[y][x] && b[y][x].p !== piece.p) {
            const cap = [y, x]; let ly = y + dr, lx = x + dc;
            while (inB(ly, lx) && b[ly][lx] === null) { moves.push({ to: [ly, lx], cap }); ly += dr; lx += dc; }
          }
        }
        return moves;
      }
      const dirs = piece.king ? D4 : piece.p === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const ar = r + dr, ac = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
        if (inB(lr, lc) && b[ar][ac] && b[ar][ac].p !== piece.p && b[lr][lc] === null) moves.push({ to: [lr, lc], cap: [ar, ac] });
        else if (!capsOnly && inB(ar, ac) && b[ar][ac] === null) moves.push({ to: [ar, ac], cap: null });
      }
      return moves;
    }
    const hasCap = (st, p) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (st.board[r][c] && st.board[r][c].p === p && pieceMoves(st, r, c, true).length) return true; return false; };
    const hasAny = (st, p) => { const f = hasCap(st, p); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (st.board[r][c] && st.board[r][c].p === p && pieceMoves(st, r, c, f).length) return true; return false; };
    return {
      init(o) {
        if (o.kings !== undefined && o.kings !== 'standard' && o.kings !== 'flying') return null;
        const board = Array.from({ length: N }, () => Array(N).fill(null));
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) { if (r < 3) board[r][c] = { p: 1, king: false }; else if (r > 4) board[r][c] = { p: 0, king: false }; }
        return { board, flying: o.kings === 'flying', turn: 0, quiet: 0, must: null, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        const f = m && m.from, t = m && m.to;
        if (!Array.isArray(f) || !Array.isArray(t) || ![...f, ...t].every(Number.isInteger) || !inB(f[0], f[1]) || !inB(t[0], t[1])) return false;
        const piece = st.board[f[0]][f[1]];
        if (!piece || piece.p !== st.turn) return false;
        let legal;
        if (st.must) { if (st.must[0] !== f[0] || st.must[1] !== f[1]) return false; legal = pieceMoves(st, f[0], f[1], true); }
        else legal = pieceMoves(st, f[0], f[1], hasCap(st, st.turn));
        const mv = legal.find(x => x.to[0] === t[0] && x.to[1] === t[1]);
        if (!mv) return false;
        const cap = mv.cap;
        m.cap = cap;   // (für den Vergleichstest: der Server bestimmt den Schlag selbst)
        st.board[t[0]][t[1]] = piece; st.board[f[0]][f[1]] = null;
        if (cap) st.board[cap[0]][cap[1]] = null;
        let promoted = false;
        if (!piece.king && ((piece.p === 0 && t[0] === 0) || (piece.p === 1 && t[0] === N - 1))) { piece.king = true; promoted = true; }
        if (cap && !promoted && pieceMoves(st, t[0], t[1], true).length) { st.must = [t[0], t[1]]; return true; }
        st.must = null;
        st.quiet = (cap || !piece.king || promoted) ? 0 : st.quiet + 1;
        st.turn = 1 - st.turn;
        if (st.quiet >= 40) st.res = { winner: -1 };
        else if (!hasAny(st, st.turn)) st.res = { winner: 1 - st.turn };
        return true;
      },
      result: st => st.res,
    };
  })(),
  // Käsekästchen: Zug { type: 'h'|'v', r, c }. Wer ein Kästchen schliesst, zieht nochmal. Bonus-Kästchen (aus dem Seed) zählen 2.
  'kaesekaestchen': {
    init(o, seed) {
      const clamp = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : def; };
      const W = clamp(o.cols, 3, 9, 5), H = clamp(o.rows, 3, 9, 5), bonus = o.bonus || 'few';
      if (!['off', 'few', 'many'].includes(bonus) || !seed) return null;
      // Gleicher Zufallsgenerator und gleiche Mischung wie im Spiel, damit dieselben Kästchen Bonus sind
      let a = seed >>> 0;
      const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const total = W * H, want = bonus === 'off' ? 0 : bonus === 'many' ? Math.max(2, Math.round(total * 0.2)) : Math.max(1, Math.round(total * 0.1));
      const all = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) all.push([r, c]);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = all[i]; all[i] = all[j]; all[j] = tmp; }
      const stars = new Set(); for (let i = 0; i < want && i < all.length; i++) stars.add(all[i][0] + ',' + all[i][1]);
      return { W, H, stars, h: Array.from({ length: H + 1 }, () => Array(W).fill(false)), v: Array.from({ length: H }, () => Array(W + 1).fill(false)),
        owner: Array.from({ length: H }, () => Array(W).fill(null)), pts: [0, 0], filled: 0, turn: 0, res: null };
    },
    turn: st => st.turn,
    apply(st, m) {
      const type = m && m.type, r = m && m.r, c = m && m.c;
      if ((type !== 'h' && type !== 'v') || !Number.isInteger(r) || !Number.isInteger(c)) return false;
      const { W, H } = st;
      if (type === 'h') { if (r < 0 || r > H || c < 0 || c >= W || st.h[r][c]) return false; st.h[r][c] = true; }
      else { if (r < 0 || r >= H || c < 0 || c > W || st.v[r][c]) return false; st.v[r][c] = true; }
      const cand = [];
      if (type === 'h') { if (r > 0) cand.push([r - 1, c]); if (r < H) cand.push([r, c]); }
      else { if (c > 0) cand.push([r, c - 1]); if (c < W) cand.push([r, c]); }
      let count = 0;
      for (const [br, bc] of cand) {
        if (st.owner[br][bc] === null && st.h[br][bc] && st.h[br + 1][bc] && st.v[br][bc] && st.v[br][bc + 1]) {
          st.owner[br][bc] = st.turn; st.filled++; count++;
          st.pts[st.turn] += st.stars.has(br + ',' + bc) ? 2 : 1;
        }
      }
      if (count > 0) { if (st.filled === W * H) st.res = { winner: st.pts[0] > st.pts[1] ? 0 : st.pts[1] > st.pts[0] ? 1 : -1 }; }
      else st.turn = 1 - st.turn;
      return true;
    },
    result: st => st.res,
  },

  // Mauer-Duell: Zug { t: 'move', r, c } (Figur) oder { t: 'wall', o: 'h'|'v', r, c } (Mauer). Wer die Gegenseite erreicht, gewinnt.
  'mauer-duell': (() => {
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const blocked = (st, r1, c1, r2, c2) => {
      if (r2 === r1 - 1) return st.h.has((r1 - 1) + ',' + c1) || st.h.has((r1 - 1) + ',' + (c1 - 1));
      if (r2 === r1 + 1) return st.h.has(r1 + ',' + c1) || st.h.has(r1 + ',' + (c1 - 1));
      if (c2 === c1 - 1) return st.v.has(r1 + ',' + (c1 - 1)) || st.v.has((r1 - 1) + ',' + (c1 - 1));
      if (c2 === c1 + 1) return st.v.has(r1 + ',' + c1) || st.v.has((r1 - 1) + ',' + c1);
      return true;
    };
    const on = (st, r, c) => r >= 0 && r < st.N && c >= 0 && c < st.N;
    function pawnMoves(st, me, opp) {
      const res = [];
      for (const [dr, dc] of DIRS) {
        const nr = me.r + dr, nc = me.c + dc;
        if (!on(st, nr, nc) || blocked(st, me.r, me.c, nr, nc)) continue;
        if (opp.r === nr && opp.c === nc) {
          const jr = nr + dr, jc = nc + dc;
          if (on(st, jr, jc) && !blocked(st, nr, nc, jr, jc)) res.push([jr, jc]);
          else for (const [sr, sc] of (dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]])) {
            const r2 = nr + sr, c2 = nc + sc;
            if (on(st, r2, c2) && !blocked(st, nr, nc, r2, c2)) res.push([r2, c2]);
          }
        } else res.push([nr, nc]);
      }
      return res;
    }
    function hasPath(st, pawn) {
      const seen = new Set([pawn.r + ',' + pawn.c]), q = [[pawn.r, pawn.c]];
      while (q.length) {
        const [r, c] = q.shift();
        if (r === pawn.goal) return true;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc;
          if (!on(st, nr, nc) || blocked(st, r, c, nr, nc)) continue;
          const k = nr + ',' + nc;
          if (!seen.has(k)) { seen.add(k); q.push([nr, nc]); }
        }
      }
      return false;
    }
    function conflict(st, o, r, c) {
      const S = st.N - 1;
      if (r < 0 || r > S - 1 || c < 0 || c > S - 1) return true;
      if (o === 'h') return st.h.has(r + ',' + c) || st.h.has(r + ',' + (c - 1)) || st.h.has(r + ',' + (c + 1)) || st.v.has(r + ',' + c);
      return st.v.has(r + ',' + c) || st.v.has((r - 1) + ',' + c) || st.v.has((r + 1) + ',' + c) || st.h.has(r + ',' + c);
    }
    function wallLegal(st, o, r, c) {
      if (conflict(st, o, r, c)) return false;
      const set = o === 'h' ? st.h : st.v;
      set.add(r + ',' + c);
      const ok = hasPath(st, st.pawns[0]) && hasPath(st, st.pawns[1]);
      set.delete(r + ',' + c);
      return ok;
    }
    return {
      init(o) {
        const N = o.size === undefined ? 9 : inChoices(o.size, [5, 7, 9], 9);
        const walls = o.walls === undefined ? 10 : +o.walls;
        if (!N || !Number.isInteger(walls) || walls < 1 || walls > 30) return null;
        const CC = (N - 1) / 2;
        return { N, pawns: [{ r: N - 1, c: CC, goal: 0 }, { r: 0, c: CC, goal: N - 1 }], walls: [walls, walls], h: new Set(), v: new Set(), turn: 0, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        if (!m || !Number.isInteger(m.r) || !Number.isInteger(m.c)) return false;
        const me = st.pawns[st.turn];
        if (m.t === 'move') {
          if (!pawnMoves(st, me, st.pawns[1 - st.turn]).some(([r, c]) => r === m.r && c === m.c)) return false;
          me.r = m.r; me.c = m.c;
          if (me.r === me.goal) { st.res = { winner: st.turn }; return true; }
        } else if (m.t === 'wall' && (m.o === 'h' || m.o === 'v')) {
          if (st.walls[st.turn] <= 0 || !wallLegal(st, m.o, m.r, m.c)) return false;
          (m.o === 'h' ? st.h : st.v).add(m.r + ',' + m.c);
          st.walls[st.turn]--;
        } else return false;
        st.turn = 1 - st.turn;
        return true;
      },
      result: st => st.res,
    };
  })(),
  // Farben-Duell: Zug { p, idx, to: [r, c] }. Die Farbe des Zielfelds bestimmt, welchen Turm der Gegner ziehen muss.
  'farben-duell': (() => {
    const N = 8;
    const BC = [[0, 1, 2, 3, 4, 5, 6, 7], [5, 0, 3, 6, 1, 4, 7, 2], [6, 3, 0, 5, 2, 7, 4, 1], [3, 2, 1, 0, 7, 6, 5, 4],
      [4, 5, 6, 7, 0, 1, 2, 3], [1, 4, 7, 2, 5, 0, 3, 6], [2, 7, 4, 1, 6, 3, 0, 5], [7, 6, 5, 4, 3, 2, 1, 0]];
    const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
    const goal = p => p === 0 ? 0 : N - 1;
    const moves = (st, p, idx) => {
      const pc = st.pieces[p][idx], dr = p === 0 ? -1 : 1, out = [];
      for (const [a, b] of [[dr, 0], [dr, -1], [dr, 1]]) { let r = pc.r + a, c = pc.c + b; while (inB(r, c) && !st.occ[r][c]) { out.push([r, c]); r += a; c += b; } }
      return out;
    };
    const forced = (st, p) => { const o = []; if (st.forcedColor >= 0) st.pieces[p].forEach((pc, i) => { if (pc.color === st.forcedColor) o.push(i); }); return o; };
    const selectable = (st, p) => { const fp = forced(st, p); if (fp.length) { const ok = fp.filter(i => moves(st, p, i).length); return ok.length ? ok : fp; } return st.pieces[p].map((_, i) => i); };
    return {
      init(o) {
        const rowsOpt = o.reihen === undefined ? 2 : inChoices(o.reihen, [1, 2], 2);
        if (!rowsOpt) return null;
        const occ = Array.from({ length: N }, () => Array(N).fill(null)), pieces = [[], []];
        for (let k = 0; k < rowsOpt; k++) for (let c = 0; c < N; c++) {
          pieces[1].push({ r: k, c, color: BC[k][c] }); occ[k][c] = { p: 1, idx: pieces[1].length - 1 };
          pieces[0].push({ r: N - 1 - k, c, color: BC[N - 1 - k][c] }); occ[N - 1 - k][c] = { p: 0, idx: pieces[0].length - 1 };
        }
        return { occ, pieces, turn: 0, forcedColor: -1, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        const p = m && m.p, idx = m && m.idx, to = m && m.to;
        if (p !== st.turn || !Number.isInteger(idx) || !Array.isArray(to) || !Number.isInteger(to[0]) || !Number.isInteger(to[1])) return false;
        if (!st.pieces[p][idx] || !selectable(st, p).includes(idx)) return false;
        if (!moves(st, p, idx).some(([r, c]) => r === to[0] && c === to[1])) return false;
        const pc = st.pieces[p][idx];
        st.occ[pc.r][pc.c] = null; pc.r = to[0]; pc.c = to[1]; st.occ[pc.r][pc.c] = { p, idx };
        if (pc.r === goal(p)) { st.res = { winner: p }; return true; }
        let next = 1 - p; st.forcedColor = BC[pc.r][pc.c];
        let guard = 0;
        for (;;) {
          const fps = forced(st, next);
          if (!fps.length) break;
          if (fps.some(i => moves(st, next, i).length > 0)) break;
          const fp = fps.reduce((a, b) => (Math.abs(st.pieces[next][b].r - goal(next)) < Math.abs(st.pieces[next][a].r - goal(next)) ? b : a));
          const stuck = st.pieces[next][fp];
          st.forcedColor = BC[stuck.r][stuck.c];
          next = 1 - next;
          if (++guard > 4) { st.res = { winner: -1 }; return true; }
        }
        st.turn = next;
        return true;
      },
      result: st => st.res,
    };
  })(),
  // Dreh-Duell: Zug { cell: Feldnummer 0–35, quad: 0–3, dir: 'cw'|'ccw' }. Kugel setzen, dann ein Viertel drehen. Fünf in einer Reihe gewinnt.
  'dreh-duell': (() => {
    const N = 6;
    const rotate = (b, q, dir) => {
      const qr = Math.floor(q / 2) * 3, qc = (q % 2) * 3, old = [];
      for (let r = 0; r < 3; r++) old.push([b[qr + r][qc], b[qr + r][qc + 1], b[qr + r][qc + 2]]);
      const nu = [[null, null, null], [null, null, null], [null, null, null]];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { if (dir === 'cw') nu[c][2 - r] = old[r][c]; else nu[2 - c][r] = old[r][c]; }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b[qr + r][qc + c] = nu[r][c];
    };
    const winners = b => {
      const found = new Set();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const p = b[r][c]; if (p === null) continue;
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          let cnt = 1, nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < N && nc >= 0 && nc < N && b[nr][nc] === p) { cnt++; nr += dr; nc += dc; if (cnt >= 5) { found.add(p); break; } }
        }
      }
      return [...found];
    };
    return {
      init() { return { b: Array.from({ length: N }, () => Array(N).fill(null)), turn: 0, res: null }; },
      turn: st => st.turn,
      apply(st, m) {
        const cell = m && m.cell, q = m && m.quad;
        if (!Number.isInteger(cell) || cell < 0 || cell >= N * N || !Number.isInteger(q) || q < 0 || q > 3 || (m.dir !== 'cw' && m.dir !== 'ccw')) return false;
        const r = Math.floor(cell / N), c = cell % N;
        if (st.b[r][c] !== null) return false;
        st.b[r][c] = st.turn; rotate(st.b, q, m.dir);
        const w = winners(st.b);
        if (w.length) st.res = { winner: w.includes(0) && w.includes(1) ? -1 : w[0] };
        else if (st.b.every(row => row.every(v => v !== null))) st.res = { winner: -1 };
        else st.turn = 1 - st.turn;
        return true;
      },
      result: st => st.res,
    };
  })(),

  // Laser-Duell: Zug { t: 'rotate', idx } oder { t: 'move', from, to } (Feldnummern 0–63). Danach feuert die eigene Kanone automatisch.
  'laser-duell': (() => {
    const N = 8, ADJ = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const refl = (m, dr, dc) => m === '/' ? [-dc, -dr] : [dc, dr];
    function fire(pieces, player) {
      const cannon = pieces.findIndex(p => p && p.type === 'cannon' && p.player === player);
      let r = Math.floor(cannon / N), c = cannon % N, [dr, dc] = player === 0 ? [-1, 0] : [1, 0];
      const seen = new Set();
      for (let step = 0; step < N * N * 8; step++) {
        r += dr; c += dc;
        if (r < 0 || c < 0 || r >= N || c >= N) return null;
        const i = r * N + c, key = i + ':' + dr + ':' + dc;
        if (seen.has(key)) return null;
        seen.add(key);
        const p = pieces[i];
        if (!p) continue;
        if (p.type === 'mirror') { [dr, dc] = refl(p.mirror, dr, dc); continue; }
        if (p.type === 'core') return p.player === player ? 1 - player : player;
        return null;
      }
      return null;
    }
    return {
      init() {
        const b = Array(N * N).fill(null), put = (r, c, p) => { b[r * N + c] = p; };
        put(7, 0, { type: 'cannon', player: 0 }); put(7, 4, { type: 'core', player: 0 });
        put(6, 2, { type: 'mirror', player: 0, mirror: '/' }); put(6, 5, { type: 'mirror', player: 0, mirror: '\\' });
        put(5, 1, { type: 'mirror', player: 0, mirror: '\\' }); put(5, 6, { type: 'mirror', player: 0, mirror: '/' });
        put(0, 7, { type: 'cannon', player: 1 }); put(0, 3, { type: 'core', player: 1 });
        put(1, 5, { type: 'mirror', player: 1, mirror: '/' }); put(1, 2, { type: 'mirror', player: 1, mirror: '\\' });
        put(2, 6, { type: 'mirror', player: 1, mirror: '\\' }); put(2, 1, { type: 'mirror', player: 1, mirror: '/' });
        return { b, turn: 0, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        if (!m) return false;
        if (m.t === 'rotate') {
          const p = Number.isInteger(m.idx) ? st.b[m.idx] : null;
          if (!p || p.type !== 'mirror' || p.player !== st.turn) return false;
          p.mirror = p.mirror === '/' ? '\\' : '/';
        } else if (m.t === 'move') {
          const f = m.from, t = m.to;
          if (!Number.isInteger(f) || !Number.isInteger(t) || f < 0 || f >= N * N || t < 0 || t >= N * N) return false;
          const p = st.b[f];
          if (!p || p.type !== 'mirror' || p.player !== st.turn || st.b[t]) return false;
          const r = Math.floor(f / N), c = f % N;
          if (!ADJ.some(([dr, dc]) => r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && (r + dr) * N + c + dc === t)) return false;
          st.b[t] = p; st.b[f] = null;
        } else return false;
        const w = fire(st.b, st.turn);
        if (w !== null) st.res = { winner: w }; else st.turn = 1 - st.turn;
        return true;
      },
      result: st => st.res,
    };
  })(),

  // Panzer-Taktik: Zug { t: 'move'|'shoot'|'pierce'|'rocket'|'mine', r, c } oder { t: 'end' }. Mehrere Aktionen pro Zug (Aktionspunkte).
  // Gelände und Kisten kommen aus dem Seed der Runde (gleicher Zufallsgenerator wie im Spiel).
  'panzer-taktik': (() => {
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]], ITEM_KEYS = ['repair', 'armor', 'rocket', 'mine'];
    const DENS = { open: { wall: 0.06, crate: 0.11, water: 0.04, forest: 0.05 }, balanced: { wall: 0.09, crate: 0.16, water: 0.06, forest: 0.07 }, dense: { wall: 0.12, crate: 0.20, water: 0.08, forest: 0.09 } };
    const inside = (st, r, c) => r >= 0 && r < st.N && c >= 0 && c < st.N;
    const occupied = (st, r, c) => st.players.findIndex(p => p.hp > 0 && p.r === r && p.c === c);
    const passable = (st, r, c) => inside(st, r, c) && (st.terrain[r][c].type === 'empty' || st.terrain[r][c].type === 'forest') && occupied(st, r, c) === -1;
    function makeTerrain(N, density, rng) {
      const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ type: 'empty', hp: 0, item: null })));
      const safe = (r, c) => Math.abs(r - (N - 1)) + Math.abs(c) <= 2 || Math.abs(r) + Math.abs(c - (N - 1)) <= 2 || r === 0 || c === 0 || r === N - 1 || c === N - 1;
      const setPair = (r, c, cell) => { const mr = N - 1 - r, mc = N - 1 - c; if (!safe(r, c)) grid[r][c] = Object.assign({}, cell); if (!safe(mr, mc)) grid[mr][mc] = Object.assign({}, cell); };
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const mr = N - 1 - r, mc = N - 1 - c;
        if (r > mr || (r === mr && c > mc) || safe(r, c)) continue;
        const roll = rng(), tWall = density.wall, tCrate = tWall + density.crate, tWater = tCrate + density.water, tForest = tWater + density.forest;
        if (roll < tWall) setPair(r, c, { type: 'wall', hp: 0, item: null });
        else if (roll < tCrate) { const item = rng() < 0.58 ? ITEM_KEYS[Math.floor(rng() * ITEM_KEYS.length)] : null; setPair(r, c, { type: 'crate', hp: 1, item }); }
        else if (roll < tWater) setPair(r, c, { type: 'water', hp: 0, item: null });
        else if (roll < tForest) setPair(r, c, { type: 'forest', hp: 0, item: null });
      }
      return grid;
    }
    function checkEnd(st) {
      if (st.res) return;
      const d0 = st.players[0].hp <= 0, d1 = st.players[1].hp <= 0;
      if (!d0 && !d1) return;
      st.res = { winner: d0 && d1 ? -1 : d0 ? 1 : 0 };
    }
    function damage(st, idx, raw, defer) {
      const p = st.players[idx]; let dmg = raw;
      if (p.armor) { dmg = Math.ceil(dmg * 0.45); p.armor = false; }
      p.hp = Math.max(0, p.hp - dmg);
      if (!defer) checkEnd(st);
    }
    function breakCrate(st, r, c) {
      const cell = st.terrain[r][c];
      if (cell.type !== 'crate') return;
      if (cell.item) st.items[r][c] = cell.item;
      st.terrain[r][c] = { type: 'empty', hp: 0, item: null };
    }
    function endTurn(st) { if (st.res) return; st.turn = 1 - st.turn; st.ap = st.START_AP; }
    function shortestPath(st, start, target, maxCost) {
      if (!passable(st, target.r, target.c)) return null;
      const q = [{ r: start.r, c: start.c }], seen = new Set([start.r + ',' + start.c]), prev = new Map();
      const dist = cur => { let key = cur.r + ',' + cur.c, d = 0; while (prev.has(key)) { key = prev.get(key); d++; } return d; };
      while (q.length) {
        const cur = q.shift();
        if (dist(cur) >= maxCost) continue;
        for (const [dr, dc] of DIRS) {
          const nr = cur.r + dr, nc = cur.c + dc, key = nr + ',' + nc;
          if (!passable(st, nr, nc) || seen.has(key)) continue;
          seen.add(key); prev.set(key, cur.r + ',' + cur.c);
          if (nr === target.r && nc === target.c) {
            const out = []; let k = key;
            while (k) { const [r, c] = k.split(',').map(Number); out.push({ r, c }); k = prev.get(k); }
            return out.reverse();
          }
          q.push({ r: nr, c: nc });
        }
      }
      return null;
    }
    const lineDir = (sr, sc, tr, tc) => (sr === tr && sc !== tc) ? [0, tc > sc ? 1 : -1] : (sc === tc && sr !== tr) ? [tr > sr ? 1 : -1, 0] : null;
    function traceShot(st, sr, sc, tr, tc, dir) {
      let r = sr + dir[0], c = sc + dir[1];
      while (inside(st, r, c)) {
        const tank = occupied(st, r, c);
        if (tank !== -1) return { type: 'tank', player: tank, r, c };
        const cell = st.terrain[r][c];
        if (cell.type === 'wall') return { type: 'wall', r, c };
        if (cell.type === 'crate') return { type: 'crate', r, c };
        if (r === tr && c === tc) return { type: 'miss', r, c };
        r += dir[0]; c += dir[1];
      }
      return { type: 'miss', r: tr, c: tc };
    }
    return {
      init(o, seed) {
        const N = o.size === undefined ? 11 : inChoices(o.size, [9, 11, 13], 11), hp = o.hp === undefined ? 100 : inChoices(o.hp, [80, 100, 120], 100);
        const ap = o.ap === undefined ? 4 : inChoices(o.ap, [3, 4, 5], 4), map = o.map === undefined ? 'balanced' : o.map;
        if (!N || !hp || !ap || !DENS[map] || !seed || (o.range !== undefined && o.range !== 5)) return null;
        let a = seed >>> 0;
        const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        return { N, MAX_HP: hp, START_AP: ap, RANGE: 5, terrain: makeTerrain(N, DENS[map], rng),
          items: Array.from({ length: N }, () => Array(N).fill(null)), mines: Array.from({ length: N }, () => Array(N).fill(null)),
          players: [{ r: N - 1, c: 0, hp, armor: false, rockets: 1, mines: 1 }, { r: 0, c: N - 1, hp, armor: false, rockets: 1, mines: 1 }],
          turn: 0, ap, res: null };
      },
      turn: st => st.turn,
      apply(st, m) {
        if (!m) return false;
        if (m.t === 'end') { endTurn(st); return true; }
        const r = m.r, c = m.c;
        if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
        const pl = st.players[st.turn], t = st.turn;
        if (m.t === 'move') {
          const path = shortestPath(st, pl, { r, c }, st.ap);
          if (!path || path.length < 2) return false;
          const cost = path.length - 1;
          for (let i = 1; i < path.length; i++) {
            pl.r = path[i].r; pl.c = path[i].c;
            const mine = st.mines[pl.r][pl.c];
            if (mine && mine.owner !== t) { st.mines[pl.r][pl.c] = null; damage(st, t, 28); }
            const it = st.items[pl.r][pl.c];
            if (it) {
              st.items[pl.r][pl.c] = null;
              if (it === 'repair') pl.hp = Math.min(st.MAX_HP, pl.hp + 30); else if (it === 'armor') pl.armor = true; else if (it === 'rocket') pl.rockets++; else if (it === 'mine') pl.mines++;
            }
            if (st.res) return true;
          }
          st.ap -= cost;
          if (st.ap <= 0) endTurn(st);
          return true;
        }
        if (m.t === 'shoot') {
          if (st.ap < 2) return false;
          const dir = lineDir(pl.r, pl.c, r, c);
          if (!dir) return false;
          st.ap -= 2;
          const hit = traceShot(st, pl.r, pl.c, r, c, dir);
          if (hit.type === 'tank') damage(st, hit.player, 32); else if (hit.type === 'crate') breakCrate(st, hit.r, hit.c);
          if (!st.res && st.ap <= 0) endTurn(st);
          return true;
        }
        if (m.t === 'pierce') {
          if (st.ap < 3) return false;
          const dir = lineDir(pl.r, pl.c, r, c);
          if (!dir) return false;
          st.ap -= 3;
          let rr = pl.r + dir[0], cc = pl.c + dir[1];
          while (inside(st, rr, cc)) {
            const cell = st.terrain[rr][cc];
            if (cell.type === 'wall') break;
            const tank = occupied(st, rr, cc);
            if (tank !== -1) damage(st, tank, 30, true);
            if (cell.type === 'crate') breakCrate(st, rr, cc);
            rr += dir[0]; cc += dir[1];
          }
          checkEnd(st);
          if (!st.res && st.ap <= 0) endTurn(st);
          return true;
        }
        if (m.t === 'rocket') {
          if (st.ap < 3 || pl.rockets <= 0 || Math.abs(pl.r - r) + Math.abs(pl.c - c) > st.RANGE) return false;
          pl.rockets--; st.ap -= 3;
          for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
            if (!inside(st, rr, cc)) continue;
            if (st.terrain[rr][cc].type === 'crate') breakCrate(st, rr, cc);
            const tank = occupied(st, rr, cc);
            if (tank !== -1) damage(st, tank, (rr === r && cc === c) ? 48 : 28, true);
          }
          checkEnd(st);
          if (!st.res && st.ap <= 0) endTurn(st);
          return true;
        }
        if (m.t === 'mine') {
          if (st.ap < 1 || pl.mines <= 0) return false;
          if (Math.abs(pl.r - r) + Math.abs(pl.c - c) !== 1 || !passable(st, r, c) || st.mines[r][c] || st.items[r][c]) return false;
          st.mines[r][c] = { owner: t }; pl.mines--; st.ap--;
          if (st.ap <= 0) endTurn(st);
          return true;
        }
        return false;
      },
      result: st => st.res,
    };
  })(),
};
const REFEREES = {};
Object.keys(ENGINES).forEach(g => { REFEREES[g] = platformReferee(ENGINES[g]); });

// ---------- Räume ----------
const rooms = new Map();
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function others(room, ws) { return room.players.filter(p => p && p.ws !== ws); }
function names(room) { return room.players.map(p => p ? p.name : null); }

// Gegen Siege-Farmen: gleiche Konten untereinander und einzelne Konten bekommen nur eine begrenzte Zahl gewerteter Runden pro Stunde
const counted = new Map();   // Schlüssel -> Zeitpunkte
function bump(key, limit, now) {
  const list = (counted.get(key) || []).filter(t => now - t < 3600000);
  if (list.length >= limit) { counted.set(key, list); return false; }
  list.push(now); counted.set(key, list);
  return true;
}
function countAllowed(room, now) {
  const codes = [...new Set(room.players.filter(Boolean).map(p => p.code))].sort();
  if (counted.size > 20000) counted.clear();
  for (const c of codes) if ((counted.get('a|' + c) || []).filter(t => now - t < 3600000).length >= MAX_COUNTED_PER_ACCOUNT_HOUR) return false;
  if (codes.length >= 2 && (counted.get('p|' + codes.join('|')) || []).filter(t => now - t < 3600000).length >= MAX_COUNTED_PER_PAIR_HOUR) return false;
  codes.forEach(c => bump('a|' + c, 1e9, now));
  if (codes.length >= 2) bump('p|' + codes.join('|'), 1e9, now);
  return true;
}
function leave(ws) {
  const room = ws.room; if (!room) return;
  ws.room = null;
  const idx = room.players.findIndex(p => p && p.ws === ws);
  if (idx >= 0) room.players[idx] = null;
  room.players.forEach(p => p && send(p.ws, { t: 'peer-left', idx }));
  if (room.players.every(p => !p)) rooms.delete(room.code);
  roomChanged(room);
}

const joinMisses = new Map();   // ip -> Zeitpunkte falscher Raumcodes
function onMessage(ws, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'create': {
      leave(ws);
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'busy' });
      if (!accountOf(m)) return send(ws, { t: 'error', msg: 'invalid' });
      let mine = 0;
      for (const r of rooms.values()) if (r.ip === ws.ip) mine++;
      if (mine >= MAX_ROOMS_PER_IP) return send(ws, { t: 'error', msg: 'busy' });
      const room = { ip: ws.ip, code: newCode(), game: cleanGame(m.game), max: Math.min(MAX_SEATS, Math.max(2, m.max | 0 || 2)),
        players: [], roundOpen: false, created: Date.now() };
      if (REFEREES[room.game]) room.ref = REFEREES[room.game]();
      const nm = roomName(ws, m);
      if (!nm) { rooms.delete(room.code); return send(ws, { t: 'error', msg: 'invalid' }); }
      room.players[0] = { ws, name: nm, code: accountOf(m) };
      rooms.set(room.code, room); ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: 0, players: names(room), max: room.max });
      roomChanged(room);
      break;
    }
    // Offene Welt: alle, die "mitspielen" wählen, landen im selben öffentlichen Raum. Ist er voll, öffnet sich der nächste.
    case 'quick': {
      leave(ws);
      const game = cleanGame(m.game);
      if (!accountOf(m)) return send(ws, { t: 'error', msg: 'invalid' });
      let room = null;
      for (const r of rooms.values()) if (r.pub && r.game === game && freeSeats(r) > 0 && !sitztSchon(r, ws, m) && (!room || freeSeats(r) < freeSeats(room))) room = r;
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'busy' });
        room = { ip: ws.ip, code: newCode(), game, max: Math.min(MAX_SEATS, Math.max(2, m.max | 0 || 2)), players: [], roundOpen: false, created: Date.now(), pub: true };
        if (REFEREES[room.game]) room.ref = REFEREES[room.game]();
        rooms.set(room.code, room);
      }
      let idx = -1;
      for (let i = 0; i < room.max; i++) if (!room.players[i]) { idx = i; break; }
      const nm = roomName(ws, m);
      if (!nm || idx < 0) { if (!room.players.some(Boolean)) rooms.delete(room.code); return send(ws, { t: 'error', msg: nm ? 'full' : 'invalid' }); }
      room.players[idx] = { ws, name: nm, code: accountOf(m) }; ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: idx, players: names(room), max: room.max });
      others(room, ws).forEach(p => send(p.ws, { t: 'peer-join', idx, name: room.players[idx].name, players: names(room) }));
      roomChanged(room);
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) {
        // Codes durchprobieren bremsen: zu viele Fehlversuche in einer Minute trennen die Verbindung
        // Pro Verbindung UND pro IP (sonst umgeht man die Bremse mit neuen Verbindungen)
        const t = Date.now();
        ws.misses = (ws.misses || []).filter(x => t - x < 60000);
        ws.misses.push(t);
        const ipm = (joinMisses.get(ws.ip) || []).filter(x => t - x < 60000);
        ipm.push(t); joinMisses.set(ws.ip, ipm);
        if (joinMisses.size > 5000) joinMisses.clear();
        if (ws.misses.length > 15 || ipm.length > MISS_LIMIT_PER_IP) return ws.close(1008);
        return send(ws, { t: 'error', msg: 'not-found' });
      }
      if (room.game !== cleanGame(m.game)) return send(ws, { t: 'error', msg: 'wrong-game' });
      let idx = -1;
      for (let i = 0; i < room.max; i++) if (!room.players[i]) { idx = i; break; }
      if (idx < 0) return send(ws, { t: 'error', msg: 'full' });
      if (sitztSchon(room, ws, m)) return send(ws, { t: 'error', msg: 'already-in' });
      const nm = roomName(ws, m);
      if (!nm) return send(ws, { t: 'error', msg: 'invalid' });
      leave(ws);
      room.players[idx] = { ws, name: nm, code: accountOf(m) }; ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: idx, players: names(room), max: room.max });
      others(room, ws).forEach(p => send(p.ws, { t: 'peer-join', idx, name: room.players[idx].name, players: names(room) }));
      roomChanged(room);
      break;
    }
    case 'relay': {
      const room = ws.room; if (!room) return;
      const from = room.players.findIndex(p => p && p.ws === ws);
      if (from < 0 || m.d === undefined) return;
      const out = JSON.stringify({ t: 'relay', from, d: m.d });
      if (out.length > MAX_RELAY_BYTES) return;
      // Schiedsrichter: Regelwidriges wird nicht weitergeleitet, und die Runde zählt nicht mehr
      if (room.ref && !room.ref.move(from, m.d)) {
        console.log('Regelwidrige Nachricht' + (REFEREE_WATCH ? ' (nur protokolliert)' : ' verworfen') + ':', room.game, room.code, 'Platz', from);
        if (!REFEREE_WATCH) { room.tainted = true; return; }
      }
      others(room, ws).forEach(p => p.ws.readyState === 1 && p.ws.send(out));
      break;
    }
    // Nur der Host (Platz 0) meldet Rundenstart und Ergebnis -> jede Runde zählt genau einmal
    case 'round-start': {
      const room = ws.room; if (!room || room.players[0]?.ws !== ws) return;
      // Beginnt nur, wenn die letzte Runde zu Ende gemeldet war (oder die alte schon lange offen ist). Merkt, wer dabei war.
      if (room.roundOpen && Date.now() - room.roundAt < MIN_ROUND_MS) return;
      room.roundOpen = true; room.roundAt = Date.now();
      room.roundCodes = room.players.map(p => p ? p.code : null);
      room.votes = new Map();
      room.tainted = false;
      break;
    }
    case 'result': {
      const room = ws.room; if (!room) return;
      let w = Number.isInteger(m.winner) ? m.winner : -1;
      const me = room.players.findIndex(p => p && p.ws === ws);
      if (me < 0) return;
      // Mitspieler (nicht der Host) dürfen das Ergebnis ebenfalls melden. Weichen sie vom Host ab, wird die Runde nicht gewertet.
      // Spiele, die das nicht tun, zählen weiter nur mit dem Host-Ergebnis.
      if (me !== 0) {
        if (room.roundOpen || room.pending) { room.votes = room.votes || new Map(); room.votes.set(room.players[me].code, w); }
        return;
      }
      if (!room.roundOpen) return;
      room.roundOpen = false;
      // Der Server kann das Spiel nicht nachrechnen, prüft aber alles, was er prüfen kann:
      const now = Date.now(), present = room.players.filter(Boolean).length;
      if (present < 2) return;
      if (room.ref && !REFEREE_WATCH) {
        // Der Schiedsrichter entscheidet, nicht der Host. Läuft die Partie noch oder war etwas regelwidrig: keine Wertung.
        const v = room.ref.verdict();
        if (!v || room.tainted) return;
        if (v.winner !== w) console.log('Host meldete anderen Sieger als der Schiedsrichter:', room.game, room.code, w, '->', v.winner);
        w = v.winner;
      } else if (now - room.roundAt < MIN_ROUND_MS) return;                            // zu kurz für eine echte Runde
      const codes = room.roundCodes || [];
      // Sieger muss jemand sein, der die ganze Runde dabei war (kein Geisterplatz, kein Spieler, der später reinkam)
      if (w >= 0 && !(room.players[w] && room.players[w].code && room.players[w].code === codes[w])) return;
      // Mindestens zwei verschiedene Geräte (Konten) am Tisch
      const real = new Set(room.players.filter(Boolean).map(p => p.code));
      if (real.size < 2 || real.has(null)) return;
      if (!countAllowed(room, now)) return;
      // Kurze Frist, in der die anderen widersprechen können
      const snapshot = names(room), votes = room.ref ? new Map() : (room.votes || new Map());
      room.pending = true;
      setTimeout(() => {
        room.pending = false;
        for (const v of votes.values()) if (v !== w) { console.log('Ergebnis angezweifelt, nicht gewertet:', room.game, room.code); return; }
        record(room.game, snapshot, w);
        room.players.forEach(p => p && send(p.ws, { t: 'leaderboard', game: room.game, rows: rows(room.game) }));
      }, VOTE_GRACE_MS);
      break;
    }
    case 'leaderboard':
      send(ws, { t: 'leaderboard', game: cleanGame(m.game), rows: rows(cleanGame(m.game)) });
      break;
    default:
      social(ws, m);
  }
}

// ---------- Freunde, Online-Status und Einladungen ----------
// Kein Login: Jedes Gerät hat ein geheimes Kennwort (localStorage "lw-pid"). Der Server leitet daraus den öffentlichen Freundescode ab
// (8 Zeichen, z.B. K7QD-93MX) und speichert nur diesen Code, den Namen und die Freunde. Wer online ist, weiss der Server nur im Arbeitsspeicher.
// Freundschaft: Anfrage per Code, die andere Person nimmt an. Einladungen gehen an Freunde und an Leute, die gerade in der
// Lobby desselben Spiels sind (ausser sie haben "Nur Freunde" gewählt oder sich unsichtbar gestellt).
const FRIENDS_FILE = path.join(DATA_DIR, 'freunde.json');
const MAX_FRIENDS = 100, MAX_REQ = 50, MAX_LOBBY = 40, ACCOUNT_DAYS = 180, MAX_ACCOUNTS = 100000;
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf8')); } catch (e) { accounts = {}; }
{
  const oldest = Date.now() - ACCOUNT_DAYS * 86400000;
  Object.keys(accounts).forEach(c => { if ((accounts[c].seen || 0) < oldest) delete accounts[c]; });
}

// ---------- Benutzernamen ----------
// Jeder Name gibt es nur einmal (Gross-/Kleinschreibung, Akzente, Leerzeichen und Striche zählen nicht), für alle Spiele.
// Der Name gehört dem Konto (Gerät) und bleibt gespeichert, bis er geändert wird. Wer keinen wählt, bekommt einen Zufallsnamen.
const TIERE = ['Fuchs', 'Luchs', 'Dachs', 'Igel', 'Hase', 'Rabe', 'Wolf', 'Otter', 'Falke', 'Kauz', 'Biber', 'Marder', 'Specht', 'Molch', 'Gecko',
  'Panda', 'Lama', 'Puma', 'Kiwi', 'Adler', 'Hirsch', 'Frosch', 'Krebs', 'Bär', 'Pinguin', 'Delfin'];
const RESERVIERT = new Set(['spieler', 'gast', 'admin', 'administrator', 'server', 'langwiligi', 'bot', 'computer', 'ich', 'du', 'niemand', 'anonym', 'unbekannt', 'wild']);
const nameOwner = new Map();   // Namensschlüssel -> Freundescode
function nameKey(n) {
  return String(n).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_.\-]+/g, '');
}
function validName(n) { const k = nameKey(n); return n.length >= 2 && k.length >= 2 && !RESERVIERT.has(k); }
function randomName() {
  for (let i = 0; ; i++) {
    const n = TIERE[Math.floor(Math.random() * TIERE.length)] + (10 + Math.floor(Math.random() * (i < 50 ? 990 : 99000)));
    if (!nameOwner.has(nameKey(n))) return n;
  }
}
// Gewünschter Name ist frei? Sonst eine Variante mit Zahl (nur für alte Konten mit doppeltem Namen)
function freeVariant(n) {
  n = rawName(n);
  if (!validName(n)) return randomName();
  for (let i = 2; i < 100; i++) { const v = n.slice(0, 16 - String(i).length) + i; if (!nameOwner.has(nameKey(v))) return v; }
  return randomName();
}
{
  // Alte Konten mit gleichem Namen: wer zuletzt aktiv war, behält ihn
  Object.keys(accounts).sort((a, b) => (accounts[b].seen || 0) - (accounts[a].seen || 0)).forEach(c => {
    const acc = accounts[c];
    let n = rawName(acc.name);
    if (!validName(n) || nameOwner.has(nameKey(n))) n = freeVariant(n);
    acc.name = n; nameOwner.set(nameKey(n), c);
  });
}
function setAccountName(code, n) {
  const acc = accounts[code];
  if (nameOwner.get(nameKey(acc.name)) === code) nameOwner.delete(nameKey(acc.name));
  acc.name = n; nameOwner.set(nameKey(n), code);
  const set = online.get(code);
  if (set) set.forEach(w => { if (w.pres) w.pres.name = n; });
  saveAccounts();
  notifyFriends(code);
  if (set) set.forEach(w => { if (w.pres && w.pres.game) dirtyGames.add(w.pres.game); });
}
// Versucht, dem Konto den Namen zu geben. { ok, name } oder { ok: false, error: 'taken' | 'invalid', name: bisheriger Name }
function claimName(code, wanted) {
  const acc = accounts[code], n = rawName(wanted);
  if (!acc) return { ok: false, error: 'invalid', name: '' };
  if (n === acc.name) return { ok: true, name: n };
  if (!validName(n)) return { ok: false, error: 'invalid', name: acc.name };
  const o = nameOwner.get(nameKey(n));
  if (o && o !== code) return { ok: false, error: 'taken', name: acc.name };
  setAccountName(code, n);
  return { ok: true, name: n };
}
// Konto zum geheimen Schlüssel des Geräts. Gibt es noch keins, wird es angelegt (mit dem Wunschnamen, falls frei, sonst mit Zufallsnamen).
function ensureAccount(ip, secret, wanted) {
  secret = String(secret || '');
  if (!/^[A-Za-z0-9]{16,64}$/.test(secret)) return null;
  const code = friendCode(secret), now = Date.now();
  if (!accounts[code]) {
    const list = (newAccountPosts.get(ip) || []).filter(t => now - t < 3600000);
    if (list.length >= 30 || Object.keys(accounts).length >= MAX_ACCOUNTS) return null;
    list.push(now); newAccountPosts.set(ip, list);
    if (newAccountPosts.size > 5000) newAccountPosts.clear();
    const w = rawName(wanted), n = validName(w) && !nameOwner.has(nameKey(w)) ? w : randomName();
    accounts[code] = { name: n, friends: [], req: [], out: [], seen: now, since: now };
    nameOwner.set(nameKey(n), code);
    saveAccounts();
  }
  return code;
}
// Name für einen Raum: der Name des Kontos (so kann sich niemand als jemand anderes ausgeben). Ohne Schlüssel (alte Seiten) der angegebene Name.
// Dasselbe Gerät (gleicher Schlüssel = gleiches Konto) darf nur einmal pro Raum sitzen, auch nicht mit zwei Tabs
function accountOf(m) { const s = String(m.secret || ''); return /^[A-Za-z0-9]{16,64}$/.test(s) ? friendCode(s) : null; }
function sitztSchon(room, ws, m) { const c = accountOf(m); return !!c && room.players.some(p => p && p.ws !== ws && p.code === c); }
function roomName(ws, m) {
  const code = ensureAccount(ws.ip, m.secret, m.name);
  if (!code) return null;
  const acc = accounts[code], w = rawName(m.name);
  if (w && w !== acc.name) claimName(code, w);
  acc.seen = Date.now();
  return acc.name;
}
let accountsTimer = null;
function saveAccounts() {
  clearTimeout(accountsTimer);
  accountsTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FRIENDS_FILE + '.tmp', JSON.stringify(accounts));
      fs.renameSync(FRIENDS_FILE + '.tmp', FRIENDS_FILE);
    } catch (e) { console.error('Freunde nicht gespeichert:', e.message); }
  }, 1000);
}
const online = new Map();            // Freundescode -> Set der offenen Seiten (WebSocket)
const dirtyGames = new Set();        // Spiele, deren Lobby-Liste neu verschickt werden muss
const newAccountPosts = new Map();   // ip -> Zeitpunkte neuer Konten der letzten Stunde
function friendCode(secret) {
  const h = crypto.createHash('sha256').update('lwf|' + secret).digest();
  let c = '';
  for (let i = 0; i < 8; i++) c += CODE_CHARS[h[i] % CODE_CHARS.length];
  return c;
}
function cleanFriendCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function freeSeats(room) { return room.max - room.players.filter(Boolean).length; }
// So sehen andere eine Person: online (mit Spiel und offenem Raum) oder offline. Unsichtbare zählen als offline.
function stateOf(code) {
  const acc = accounts[code];
  if (!acc) return null;
  let best = null;
  const set = online.get(code);
  if (set) for (const w of set) {
    const p = w.pres;
    if (p.visible && (!best || (p.room && !best.room))) best = p;
  }
  if (!best) return { code, name: acc.name, online: false };
  const r = best.room ? rooms.get(best.room) : null;
  const mine = r && r.game === best.game ? r : null;
  const free = mine ? freeSeats(mine) : 0;
  return { code, name: acc.name, online: true, game: best.game, gameName: best.game ? gameTitle(best.game) : '',
    inRoom: !!mine, room: mine && free > 0 ? { code: mine.code, free, max: mine.max } : null };
}
function sendTo(code, msg) { const set = online.get(code); if (set) set.forEach(w => send(w, msg)); }
function pushFriends(code) {
  const acc = accounts[code];
  if (!acc || !online.has(code)) return;
  const nameOf = c => (accounts[c] ? accounts[c].name : null);
  sendTo(code, { t: 'friends', list: acc.friends.map(stateOf).filter(Boolean),
    requests: acc.req.filter(nameOf).map(c => ({ code: c, name: nameOf(c) })),
    sent: acc.out.filter(nameOf).map(c => ({ code: c, name: nameOf(c) })) });
}
// Etwas an der Person hat sich geändert (online, Spiel, Raum): nur ihre Freunde bekommen die neue Zeile
function notifyFriends(code) {
  const acc = accounts[code];
  if (!acc) return;
  const f = stateOf(code);
  acc.friends.forEach(c => sendTo(c, { t: 'friend', f }));
}
// Wer gerade in der Lobby eines Spiels ist (auf der Seite, aber in keinem Raum): einmal pro Spiel gesammelt, dann pro Empfänger angepasst
function lobbyBase(game) {
  const base = [];
  for (const [c, set] of online) {
    for (const w of set) {
      const p = w.pres;
      if (p.game !== game || !p.visible || (p.room && rooms.has(p.room))) continue;
      base.push({ code: c, name: p.name, onlyFriends: p.onlyFriends });
      break;
    }
    if (base.length >= 300) break;
  }
  return base;
}
function lobbyFor(base, code) {
  const mine = accounts[code];
  const list = base.filter(b => b.code !== code).map(b => ({ code: b.code, name: b.name, friend: !!mine && mine.friends.includes(b.code), onlyFriends: b.onlyFriends }));
  // Freunde zuerst, dann nach Name
  list.sort((a, b) => (b.friend - a.friend) || a.name.localeCompare(b.name));
  return list.slice(0, MAX_LOBBY);
}
function flushLobbies() {
  if (!dirtyGames.size) return;
  const bases = new Map();
  dirtyGames.forEach(g => bases.set(g, lobbyBase(g)));
  dirtyGames.clear();
  for (const [code, set] of online) set.forEach(w => {
    const base = bases.get(w.pres.game);
    if (base) send(w, { t: 'lobby', game: w.pres.game, list: lobbyFor(base, code) });
  });
}
setInterval(flushLobbies, 1000);
// Raum hat sich verändert (jemand rein/raus): Freunde sehen neu, wie viele Plätze frei sind
function roomChanged(room) {
  for (const [code, set] of online) {
    for (const w of set) if (w.pres.room === room.code) { notifyFriends(code); dirtyGames.add(w.pres.game); break; }
  }
}
function dropPresence(ws) {
  const p = ws.pres;
  if (!p) return;
  ws.pres = null;
  const set = online.get(p.code);
  if (set) { set.delete(ws); if (!set.size) online.delete(p.code); }
  const acc = accounts[p.code];
  if (acc) { acc.seen = Date.now(); saveAccounts(); }
  if (p.game) dirtyGames.add(p.game);
  notifyFriends(p.code);
}
function makeFriends(a, b) {
  const A = accounts[a], B = accounts[b];
  [[A, b], [B, a]].forEach(([x, other]) => {
    if (!x.friends.includes(other)) x.friends.push(other);
    ['req', 'out'].forEach(k => { x[k] = x[k].filter(c => c !== other); });
  });
}
function applyStatus(ws, m) {
  const p = ws.pres, acc = accounts[p.code], oldGame = p.game;
  if (m.name !== undefined) {
    const now = Date.now();
    p.nameTries = (p.nameTries || []).filter(t => now - t < 60000);
    if (p.nameTries.length >= 10) send(ws, { t: 'name-error', msg: 'too-fast', name: acc.name });
    else {
      p.nameTries.push(now);
      const r = claimName(p.code, m.name);
      send(ws, r.ok ? { t: 'name-ok', name: r.name } : { t: 'name-error', msg: r.error, name: r.name, wanted: rawName(m.name) });
    }
  }
  if (m.game !== undefined) p.game = cleanGame(m.game);
  if (m.room !== undefined) p.room = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (m.visible !== undefined) p.visible = m.visible !== false;
  if (m.onlyFriends !== undefined) p.onlyFriends = !!m.onlyFriends;
  if (oldGame) dirtyGames.add(oldGame);
  if (p.game) dirtyGames.add(p.game);
  notifyFriends(p.code);
}
function social(ws, m) {
  const p = ws.pres, now = Date.now();
  if (m.t === 'hello') {
    if (p) return;
    const secret = String(m.secret || '');
    if (!/^[A-Za-z0-9]{16,64}$/.test(secret)) return;
    const code = friendCode(secret);
    if (!accounts[code] && !ensureAccount(ws.ip, secret, m.name)) return send(ws, { t: 'error', msg: 'too-fast' });
    const acc = accounts[code], wanted = rawName(m.name);
    // Der Name des Geräts kann vergeben sein (oder fehlen): dann bleibt der bisherige und das Gerät übernimmt ihn aus "me"
    if (wanted && wanted !== acc.name) claimName(code, wanted);
    acc.out = acc.out || [];
    ws.pres = { code, name: acc.name, game: cleanGame(m.game), room: '', visible: m.visible !== false, onlyFriends: !!m.onlyFriends,
      lastInvite: new Map(), invites: [] };
    acc.seen = now; saveAccounts();
    if (!online.has(code)) online.set(code, new Set());
    online.get(code).add(ws);
    send(ws, { t: 'me', code, name: acc.name, feat: 3 });
    pushFriends(code);
    if (ws.pres.game) dirtyGames.add(ws.pres.game);
    notifyFriends(code);
    return;
  }
  if (!p) return;
  const acc = accounts[p.code];
  switch (m.t) {
    case 'status': applyStatus(ws, m); break;
    case 'friend-add': {
      // Per Benutzername (oder, wie früher, per 8-stelligem Freundescode)
      let to = m.name !== undefined ? nameOwner.get(nameKey(rawName(m.name))) : null;
      if (!to) to = cleanFriendCode(m.code !== undefined ? m.code : m.name);
      const b = accounts[to];
      p.adds = (p.adds || []).filter(t => now - t < 60000);
      if (p.adds.length >= 10) return send(ws, { t: 'friend-error', msg: 'too-fast' });
      p.adds.push(now);
      if (to === p.code) return send(ws, { t: 'friend-error', msg: 'self' });
      if (!b) return send(ws, { t: 'friend-error', msg: 'not-found' });
      if (acc.friends.includes(to)) return send(ws, { t: 'friend-error', msg: 'already' });
      if (acc.friends.length >= MAX_FRIENDS || b.friends.length >= MAX_FRIENDS) return send(ws, { t: 'friend-error', msg: 'limit' });
      if (acc.req.includes(to)) {                     // die Person hat mich schon angefragt: sofort Freunde
        makeFriends(p.code, to);
        pushFriends(p.code); pushFriends(to); notifyFriends(p.code); notifyFriends(to);
        sendTo(to, { t: 'friend-new', code: p.code, name: acc.name });
        send(ws, { t: 'friend-new', code: to, name: b.name });
      } else {
        if (!b.req.includes(p.code)) {
          if (b.req.length >= MAX_REQ) return send(ws, { t: 'friend-error', msg: 'limit' });
          b.req.push(p.code);
        }
        if (!acc.out.includes(to)) acc.out.push(to);
        send(ws, { t: 'friend-sent', code: to, name: b.name });
        pushFriends(p.code); pushFriends(to);
        sendTo(to, { t: 'friend-request', code: p.code, name: acc.name });
      }
      saveAccounts();
      break;
    }
    case 'friend-accept': {
      const from = cleanFriendCode(m.code);
      if (!accounts[from] || !acc.req.includes(from)) return pushFriends(p.code);
      if (acc.friends.length >= MAX_FRIENDS) return send(ws, { t: 'friend-error', msg: 'limit' });
      makeFriends(p.code, from);
      saveAccounts();
      pushFriends(p.code); pushFriends(from); notifyFriends(p.code); notifyFriends(from);
      sendTo(from, { t: 'friend-new', code: p.code, name: acc.name });
      break;
    }
    case 'friend-decline': {
      const from = cleanFriendCode(m.code);
      acc.req = acc.req.filter(c => c !== from);
      if (accounts[from]) accounts[from].out = (accounts[from].out || []).filter(c => c !== p.code);
      saveAccounts(); pushFriends(p.code); pushFriends(from);
      break;
    }
    case 'friend-remove': {
      const other = cleanFriendCode(m.code);
      acc.friends = acc.friends.filter(c => c !== other);
      acc.out = acc.out.filter(c => c !== other);
      const o = accounts[other];
      if (o) { o.friends = o.friends.filter(c => c !== p.code); o.out = (o.out || []).filter(c => c !== p.code); o.req = o.req.filter(c => c !== p.code); }
      acc.req = acc.req.filter(c => c !== other);
      saveAccounts(); pushFriends(p.code); pushFriends(other);
      break;
    }
    case 'invite': {
      const to = cleanFriendCode(m.to), room = rooms.get(String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
      const fail = msg => send(ws, { t: 'invite-error', to, msg });
      if (!room || !p.game || room.game !== p.game || p.room !== room.code || freeSeats(room) <= 0) return fail('no-room');
      if (to === p.code || !accounts[to]) return fail('not-found');
      p.recent = (p.recent || []).filter(t => now - t < 600000);
      if (p.recent.length >= 30 || now - (p.lastInvite.get(to) || 0) < 8000) return fail('too-fast');
      const targets = [...(online.get(to) || [])];
      if (!targets.length) return fail('offline');
      const friend = acc.friends.includes(to);
      // Fremde nur, wenn sie gerade in der Lobby dieses Spiels sind und Einladungen von allen zulassen
      const open = targets.some(w => w.pres.game === p.game && !(w.pres.room && rooms.has(w.pres.room)) && w.pres.visible && !w.pres.onlyFriends);
      if (!friend && !open) return fail('denied');
      p.lastInvite.set(to, now); p.recent.push(now);
      if (p.lastInvite.size > 200) p.lastInvite.clear();
      targets.forEach(w => send(w, { t: 'invite', from: { code: p.code, name: p.name, friend }, game: room.game, gameName: gameTitle(room.game),
        room: room.code, free: freeSeats(room) }));
      send(ws, { t: 'invite-sent', to });
      break;
    }
  }
}

// ---------- Einladungs-Seite: Vorschau für WhatsApp, Discord & Co., dann weiter ins Spiel ----------
function htmlEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function inviteImage(game) {
  for (const f of ['_shared/einladung/' + game + '.jpg', game + '/cover.webp', game + '/cover.png', game + '/cover.jpg']) {
    try { return { path: '/' + f, v: Math.floor(fs.statSync(path.join(GAMES_DIR, f)).mtimeMs / 1000) }; } catch (e) { /* nächste */ }
  }
  return { path: '/vorschau.jpg', v: 1 };
}
function gameBlurb(game) {
  try {
    const m = fs.readFileSync(path.join(GAMES_DIR, game, 'index.html'), 'utf8').slice(0, 8000).match(/<meta name="description" content="([^"]*)"/i);
    if (m) return m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').slice(0, 140);
  } catch (e) { /* ohne Beschreibung */ }
  return '';
}
function invitePage(req, game, code, from) {
  const host = String(req.headers.host || '').toLowerCase();
  const base = /(^|\.)langwiligi\.site$/.test(host) ? 'https://' + host : /^[0-9.]+(:\d+)?$/.test(host) ? 'http://' + host : 'https://langwiligi.site';
  const name = gameTitle(game), img = inviteImage(game), blurb = gameBlurb(game);
  const title = from ? from + ' lädt dich zu ' + name + ' ein!' : 'Du wurdest zu ' + name + ' eingeladen!';
  const desc = 'Komm in die Lobby ' + code + ' und spiel mit: direkt im Browser, ohne Download und ohne Login.' + (blurb ? ' ' + blurb : '');
  const target = '/' + game + '/#' + code;
  return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(title)} | KEI Langwiligi site</title><meta name="robots" content="noindex"><meta name="theme-color" content="#07060d">
<meta name="description" content="${htmlEsc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="KEI Langwiligi site"><meta property="og:locale" content="de_CH">
<meta property="og:url" content="${htmlEsc(base + '/api/e/' + game + '/' + code)}">
<meta property="og:title" content="${htmlEsc(title)}"><meta property="og:description" content="${htmlEsc(desc)}">
<meta property="og:image" content="${htmlEsc(base + img.path + '?v=' + img.v)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${htmlEsc(title)}"><meta name="twitter:card" content="summary_large_image">
<style>html{background:#07060d}body{margin:0;min-height:100vh;display:grid;place-items:center;color:#ecebf5;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
a{display:inline-block;margin-top:18px;padding:12px 22px;background:#22e4ff;color:#07060d;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:.06em}
code{color:#ffe14d;font-size:1.4em;letter-spacing:.2em}</style></head>
<body><main><p>${htmlEsc(title)}</p><p>Lobby <code>${htmlEsc(code)}</code></p><a href="${htmlEsc(target)}">Jetzt beitreten</a></main>
<script>location.replace(${JSON.stringify(target)});</script></body></html>`;
}

// ---------- HTTP + WebSocket ----------
// CORS nur für unsere Seiten (statt für alle). Eine fremde Webseite darf im Browser des Spielers weder lesen noch schreiben.
// Die Spiele selbst liegen auf derselben Adresse wie die API, brauchen CORS also normalerweise gar nicht.
function json(res, status, obj) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, res.cors));
  res.end(JSON.stringify(obj));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  res.cors = origin && originOk(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Key' }
    : { 'Vary': 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(origin && !originOk(origin) ? 403 : 204, res.cors); return res.end(); }
  // Schreibende Aufrufe nur von unseren Seiten. Browser schicken Origin immer mit; wer ohne Origin kommt (curl, Skript), darf nicht schreiben.
  // Die Admin-Seite ist ausgenommen, sie schützt sich mit dem Schlüssel.
  if (req.method === 'POST' && !originOk(origin) && !/^\/api\/(empfehlungen|bewertungen|moderation)\.json$/.test(url.pathname)) return json(res, 403, { error: 'bad-origin' });
  const inv = url.pathname.match(/^\/api\/e\/([a-z0-9-]{1,40})\/([A-Za-z0-9]{4})$/);
  if (inv) {
    const game = inv[1], code = inv[2].toUpperCase();
    if (!isKnownGame(game)) { res.writeHead(302, { Location: '/' }); return res.end(); }
    const von = cleanName(url.searchParams.get('von') || '').replace(/^Spieler$/, '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex' });
    return res.end(invitePage(req, game, code, von));
  }
  if (url.pathname === '/api/leaderboard') {
    const game = cleanGame(url.searchParams.get('game'));
    return json(res, 200, { game, rows: rows(game) });
  }
  if (url.pathname === '/api/highscores') {
    const game = cleanGame(url.searchParams.get('game'));
    return json(res, 200, { game, rows: scoreRows(game) });
  }
  // Benutzername des Geräts festlegen oder abfragen: { secret, name } -> { ok, name } oder { ok: false, error: 'taken' | 'invalid' | 'too-fast', name }
  if (url.pathname === '/api/name' && req.method === 'POST') {
    return readBody(req, 1024, m => {
      if (!m) return json(res, 400, { error: 'bad-json' });
      const ip = clientIp(req), now = Date.now();
      const list = (namePosts.get(ip) || []).filter(t => now - t < 60000);
      if (list.length >= 60) return json(res, 429, { ok: false, error: 'too-fast' });
      list.push(now); namePosts.set(ip, list);
      if (namePosts.size > 5000) namePosts.clear();
      const code = ensureAccount(ip, m.secret, m.name);
      if (!code) return json(res, 400, { ok: false, error: 'invalid-secret' });
      const acc = accounts[code], w = rawName(m.name);
      const r = w ? claimName(code, w) : { ok: true, name: acc.name };
      acc.seen = now;
      json(res, 200, r.ok ? { ok: true, name: acc.name } : { ok: false, error: r.error, name: acc.name });
    });
  }
  if (url.pathname === '/api/score' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let m; try { m = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'bad-json' }); }
      const game = cleanGame(m && m.game);
      // Mit dem geheimen Schlüssel des Geräts zählt der Name des Kontos (so kann niemand unter fremdem Namen eintragen)
      // Ohne gültigen Schlüssel wird nichts eingetragen (sonst könnte jeder unter jedem Namen Punkte setzen)
      const sec = String(m && m.secret || ''), ipS = clientIp(req);
      const code = /^[A-Za-z0-9]{16,64}$/.test(sec) ? ensureAccount(ipS, sec, m && m.name) : null;
      const acct = code ? accounts[code] : null;
      if (!acct) return json(res, 400, { error: 'invalid-secret' });
      const name = acct.name;
      const score = Math.floor(Number(m && m.score)), jumps = Math.floor(Number(m && m.jumps) || 0);
      // Grobe Plausibilitätsprüfung: pro Sprung sind höchstens ~450 Punkte möglich
      if (!game || !Number.isFinite(score) || score < 0 || score > 10000000 || jumps < 0 || jumps > 100000 ||
          score > (jumps + 1) * 450) return json(res, 400, { error: 'invalid' });
      if (!isKnownGame(game)) return json(res, 400, { error: 'unknown-game' });
      const ip = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress;
      const key = ip + '|' + name.toLowerCase(), now = Date.now();
      if (now - (lastScorePost.get(key) || 0) < 2000) return json(res, 429, { error: 'too-fast' });
      if (!bump('s|' + code, MAX_SCORE_PER_ACCOUNT_HOUR, now)) return json(res, 429, { error: 'too-fast' });
      acct.seen = now;
      lastScorePost.set(key, now);
      if (lastScorePost.size > 5000) lastScorePost.clear();
      json(res, 200, recordScore(game, name, score, jumps));
    });
    return;
  }
  if (url.pathname === '/api/empfehlung' && req.method === 'POST') {
    return readBody(req, 4096, m => {
      if (!m) return json(res, 400, { error: 'bad-json' });
      const game = cleanText(m.game, 80), note = cleanText(m.note, 500), name = cleanText(m.name, 16).replace(/[<>]/g, '');
      if (!game) return json(res, 400, { error: 'invalid' });
      const ip = clientIp(req), now = Date.now();
      if (now - (lastTipPost.get(ip) || 0) < 15000) return json(res, 429, { error: 'too-fast' });
      lastTipPost.set(ip, now);
      if (lastTipPost.size > 5000) lastTipPost.clear();
      tips.push({ id: crypto.randomBytes(6).toString('hex'), at: now, game, note, name, done: false });
      if (tips.length > MAX_TIPS) tips.splice(0, tips.length - MAX_TIPS);
      saveTips();
      json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/empfehlungen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    return res.end(ADMIN_PAGE);
  }
  if (url.pathname === '/api/bewertung' && req.method === 'POST') {
    return readBody(req, 2048, m => {
      if (!m) return json(res, 400, { error: 'bad-json' });
      const game = cleanGame(m.game), stars = Number(m.stars), cid = String(m.cid || '');
      const v = cleanText(m.v, 20).replace(/[^0-9a-z-]/gi, ''), note = cleanText(m.note, 500);
      if (!game || !Number.isInteger(stars) || stars < 1 || stars > 5 || !/^[a-z0-9]{8,64}$/i.test(cid)) return json(res, 400, { error: 'invalid' });
      if (!isKnownGame(game)) return json(res, 400, { error: 'unknown-game' });
      const who = hashId(cid), now = Date.now();
      if (!ratingAllowed(clientIp(req), now)) return json(res, 429, { error: 'too-fast' });
      // Pro Gerät und Spiel zählt nur die neuste Bewertung: nach einer Änderung am Spiel ersetzt sie die alte.
      // Kommt nur noch der Verbesserungsvorschlag nach (gleiche Version), wird er an die Bewertung angehängt.
      const old = ratings.find(r => r.game === game && r.who === who);
      if (old) {
        old.stars = stars; old.at = now;
        if (old.v !== v) { old.note = ''; old.v = v; }
        if (note) old.note = note;
      } else {
        ratings.push({ id: crypto.randomBytes(6).toString('hex'), at: now, game, stars, who, v, note });
        if (ratings.length > MAX_RATINGS) ratings.splice(0, ratings.length - MAX_RATINGS);
      }
      saveRatings();
      json(res, 200, { ok: true, stats: gameStats()[game] });
    });
  }
  if (url.pathname === '/api/aufruf' && req.method === 'POST') {
    return readBody(req, 512, m => {
      const game = cleanGame(m && m.game);
      if (m && m.seite === 'start') countPlay(START_KEY, clientIp(req), Date.now());
      else if (game && isKnownGame(game)) countPlay(game, clientIp(req), Date.now());
      json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/spielzeit' && req.method === 'POST') {
    return readBody(req, 512, m => {
      const game = cleanGame(m && m.game), sek = Math.floor(Number(m && m.sek));
      if (game && isKnownGame(game) && sek >= 5 && sek <= 14400) countTime(game, sek, clientIp(req), Date.now());
      json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/spiele') {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, res.cors));
    return res.end(JSON.stringify(gameStats()));
  }
  if (url.pathname === '/api/bewertungen.json') {
    if (!isAdmin(req)) return json(res, 403, { error: 'forbidden' });
    const list = () => ratings.map(r => ({ id: r.id, at: r.at, game: r.game, name: gameTitle(r.game), stars: r.stars, v: r.v || '', note: r.note || '' }));
    if (req.method !== 'POST') return json(res, 200, list());
    return readBody(req, 1024, m => {
      const i = ratings.findIndex(r => m && r.id === m.id);
      if (i >= 0 && m.action === 'delete') { ratings.splice(i, 1); saveRatings(); }
      json(res, 200, list());
    });
  }
  // Betrüger entfernen: { name, game? } löscht den Namen aus Duell-Rangliste und Highscores (eines Spiels oder aller)
  if (url.pathname === '/api/moderation.json' && req.method === 'POST') {
    if (!isAdmin(req)) return json(res, 403, { error: 'forbidden' });
    return readBody(req, 1024, m => {
      const key = rawName(m && m.name).toLowerCase(), only = m && m.game ? cleanGame(m.game) : '';
      let n = 0;
      if (key) [board, scores].forEach(store => Object.keys(store).forEach(g => {
        if ((!only || g === only) && store[g][key]) { delete store[g][key]; n++; }
      }));
      if (n) { saveBoard(); saveScores(); }
      json(res, 200, { ok: true, removed: n });
    });
  }
  if (url.pathname === '/api/aufrufe.json') {
    if (!isAdmin(req)) return json(res, 403, { error: 'forbidden' });
    return json(res, 200, visitStats());
  }
  if (url.pathname === '/api/empfehlungen.json') {
    if (!isAdmin(req)) return json(res, 403, { error: 'forbidden' });
    if (req.method !== 'POST') return json(res, 200, tips);
    return readBody(req, 1024, m => {
      const i = tips.findIndex(t => m && t.id === m.id);
      if (i >= 0 && m.action === 'delete') tips.splice(i, 1);
      if (i >= 0 && m.action === 'done') tips[i].done = !tips[i].done;
      saveTips();
      json(res, 200, tips);
    });
  }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 128 * 1024,
  // Browser schicken bei WebSockets immer die Herkunft mit. Fremde Webseiten (oder Skripte) kommen nicht rein.
  verifyClient: (info, cb) => originOk(info.origin) ? cb(true) : cb(false, 403, 'bad-origin') });
const connPerIp = new Map();
wss.on('connection', (ws, req) => {
  ws.alive = true;
  ws.ip = clientIp(req);
  ws.on('error', () => {});
  const open = (connPerIp.get(ws.ip) || 0) + 1;
  if (open > MAX_CONN_PER_IP) { ws.close(1013); return; }
  connPerIp.set(ws.ip, open);
  ws.tokens = MSG_BURST; ws.tokenAt = Date.now();
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    // Wer mehr schickt als erlaubt (Flut), wird getrennt
    const now = Date.now();
    ws.tokens = Math.min(MSG_BURST, ws.tokens + (now - ws.tokenAt) * MSG_RATE / 1000); ws.tokenAt = now;
    if (--ws.tokens < 0) return ws.close(1008);
    // Auch die Datenmenge begrenzen (wenige grosse Nachrichten wären sonst eine Flut)
    const size = raw.length || 0;
    ws.bytes = Math.min(BYTES_BURST, (ws.bytes === undefined ? BYTES_BURST : ws.bytes) + (now - (ws.bytesAt || now)) * MAX_BYTES_PER_SEC / 1000) - size; ws.bytesAt = now;
    if (ws.bytes < 0) return ws.close(1008);
    onMessage(ws, raw);
  });
  ws.on('close', () => {
    const n = (connPerIp.get(ws.ip) || 1) - 1;
    if (n > 0) connPerIp.set(ws.ip, n); else connPerIp.delete(ws.ip);
    leave(ws); dropPresence(ws);
  });
});
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  const now = Date.now();
  for (const [code, room] of rooms) if (!room.pub && now - room.created > ROOM_TTL) {
    room.players.forEach(p => p && p.ws.close()); rooms.delete(code);
  }
}, 25000);
if (process.env.HUB_TEST) module.exports = { ENGINES };   // nur für die Tests (tools/schiedsrichter-test.js)
server.listen(PORT, '127.0.0.1', () => console.log('game-hub läuft auf Port ' + PORT));
