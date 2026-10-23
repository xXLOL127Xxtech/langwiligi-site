// Game-Hub: Spielräume mit Code (WebSocket-Relay) + Rangliste.
// Läuft auf dem Server als systemd-Dienst "game-hub", nginx leitet /ws und /api hierher.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = 8090;
const DATA_DIR = process.env.DATA_DIR || '/var/lib/game-hub';
const BOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 6 * 3600 * 1000;
// Schutz vor Überlastung. Eine Schulklasse hinter einer IP soll noch gehen, ein einzelner Angreifer nicht den Server füllen.
const MAX_ROOMS = 3000, MAX_ROOMS_PER_IP = 40;
const MAX_CONN_PER_IP = 80;             // offene WebSockets pro IP
const MSG_RATE = 150, MSG_BURST = 600;  // Nachrichten pro Sekunde und Spitze (Spiele schicken ~20–60 pro Sekunde)
const GAMES_DIR = process.env.GAMES_DIR || '/var/www/games';
const MAX_PER_GAME = +process.env.MAX_PER_GAME || 1000;  // Ranglisten-Einträge pro Spiel; darüber fliegen die schlechtesten raus

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
  const week = addDays(today, -6), month = addDays(today, -29), games = [];
  Object.keys(plays).forEach(g => {
    if (g === START_KEY) return;
    const e = { game: g, name: gameTitle(g), week: 0, month: 0 };
    Object.keys(plays[g]).forEach(d => {
      if (d >= month) e.month += plays[g][d];
      if (d >= week) e.week += plays[g][d];
    });
    if (e.month) games.push(e);
  });
  games.sort((a, b) => b.month - a.month || b.week - a.week);
  return { today, days, weeks, games };
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
<h3 id="top-h">Meistgespielt</h3><div class="sum" id="top"></div></section>
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
var visits=null,range='7',COLORS={start:'#0fa3bf',spiele:'#ff2e88'};
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
[num(avg(d.slice(-30),'start')),'Startseite Ø pro Tag, 30 Tage'],[num(t.spiele),'Spiel-Aufrufe heute']].map(function(x){return '<div class="tile"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>'}).join('');
document.getElementById('top').innerHTML=v.games.length?'<b>Spiel</b><span>7 Tage</span><span>30 Tage</span>'+v.games.slice(0,15).map(function(g){return '<b>'+esc(g.name)+'</b><span>'+g.week+'</span><span>'+g.month+'</span>'}).join(''):'<span class="msg">Noch keine Aufrufe.</span>';
render()}
document.querySelector('.range').addEventListener('click',function(e){var b=e.target.closest('button[data-r]');if(!b)return;range=b.dataset.r;
document.querySelectorAll('.range button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});render()});
var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(render,150)});
call('aufrufe.json','GET').then(showVisits,err);call('empfehlungen.json','GET').then(showTips,err);call('bewertungen.json','GET').then(showRates,err);
</script></body></html>`;

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Spieler';
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

function leave(ws) {
  const room = ws.room; if (!room) return;
  ws.room = null;
  const idx = room.players.findIndex(p => p && p.ws === ws);
  if (idx >= 0) room.players[idx] = null;
  room.players.forEach(p => p && send(p.ws, { t: 'peer-left', idx }));
  if (room.players.every(p => !p)) rooms.delete(room.code);
  roomChanged(room);
}

function onMessage(ws, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'create': {
      leave(ws);
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'busy' });
      let mine = 0;
      for (const r of rooms.values()) if (r.ip === ws.ip) mine++;
      if (mine >= MAX_ROOMS_PER_IP) return send(ws, { t: 'error', msg: 'busy' });
      const room = { ip: ws.ip, code: newCode(), game: cleanGame(m.game), max: Math.min(16, Math.max(2, m.max | 0 || 2)),
        players: [], roundOpen: false, created: Date.now() };
      room.players[0] = { ws, name: cleanName(m.name) };
      rooms.set(room.code, room); ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: 0, players: names(room), max: room.max });
      roomChanged(room);
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) {
        // Codes durchprobieren bremsen: zu viele Fehlversuche in einer Minute trennen die Verbindung
        const t = Date.now();
        ws.misses = (ws.misses || []).filter(x => t - x < 60000);
        ws.misses.push(t);
        if (ws.misses.length > 15) return ws.close(1008);
        return send(ws, { t: 'error', msg: 'not-found' });
      }
      if (room.game !== cleanGame(m.game)) return send(ws, { t: 'error', msg: 'wrong-game' });
      let idx = -1;
      for (let i = 0; i < room.max; i++) if (!room.players[i]) { idx = i; break; }
      if (idx < 0) return send(ws, { t: 'error', msg: 'full' });
      leave(ws);
      room.players[idx] = { ws, name: cleanName(m.name) }; ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: idx, players: names(room), max: room.max });
      others(room, ws).forEach(p => send(p.ws, { t: 'peer-join', idx, name: room.players[idx].name, players: names(room) }));
      roomChanged(room);
      break;
    }
    case 'relay': {
      const room = ws.room; if (!room) return;
      const from = room.players.findIndex(p => p && p.ws === ws);
      const out = JSON.stringify({ t: 'relay', from, d: m.d });
      others(room, ws).forEach(p => p.ws.readyState === 1 && p.ws.send(out));
      break;
    }
    // Nur der Host (Platz 0) meldet Rundenstart und Ergebnis -> jede Runde zählt genau einmal
    case 'round-start': {
      const room = ws.room; if (!room || room.players[0]?.ws !== ws) return;
      room.roundOpen = true;
      break;
    }
    case 'result': {
      const room = ws.room; if (!room || room.players[0]?.ws !== ws || !room.roundOpen) return;
      room.roundOpen = false;
      const present = room.players.filter(Boolean).length;
      if (present < 2) return;
      const w = Number.isInteger(m.winner) ? m.winner : -1;
      record(room.game, names(room), w);
      room.players.forEach(p => p && send(p.ws, { t: 'leaderboard', game: room.game, rows: rows(room.game) }));
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
  if (m.name !== undefined) { p.name = cleanName(m.name); acc.name = p.name; saveAccounts(); }
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
    let acc = accounts[code];
    if (!acc) {
      const ip = ws.ip, list = (newAccountPosts.get(ip) || []).filter(t => now - t < 3600000);
      if (list.length >= 30 || Object.keys(accounts).length >= MAX_ACCOUNTS) return send(ws, { t: 'error', msg: 'too-fast' });
      list.push(now); newAccountPosts.set(ip, list);
      if (newAccountPosts.size > 5000) newAccountPosts.clear();
      acc = accounts[code] = { name: cleanName(m.name), friends: [], req: [], out: [], seen: now };
    }
    acc.out = acc.out || [];
    ws.pres = { code, name: cleanName(m.name), game: cleanGame(m.game), room: '', visible: m.visible !== false, onlyFriends: !!m.onlyFriends,
      lastInvite: new Map(), invites: [] };
    acc.name = ws.pres.name; acc.seen = now; saveAccounts();
    if (!online.has(code)) online.set(code, new Set());
    online.get(code).add(ws);
    send(ws, { t: 'me', code, name: acc.name, feat: 2 });
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
      const to = cleanFriendCode(m.code), b = accounts[to];
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
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
function json(res, status, obj) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS));
  res.end(JSON.stringify(obj));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
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
  if (url.pathname === '/api/score' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let m; try { m = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'bad-json' }); }
      const game = cleanGame(m && m.game), name = cleanName(m && m.name);
      const score = Math.floor(Number(m && m.score)), jumps = Math.floor(Number(m && m.jumps) || 0);
      // Grobe Plausibilitätsprüfung: pro Sprung sind höchstens ~450 Punkte möglich
      if (!game || !Number.isFinite(score) || score < 0 || score > 10000000 || jumps < 0 || jumps > 100000 ||
          score > (jumps + 1) * 450) return json(res, 400, { error: 'invalid' });
      if (!isKnownGame(game)) return json(res, 400, { error: 'unknown-game' });
      const ip = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress;
      const key = ip + '|' + name.toLowerCase(), now = Date.now();
      if (now - (lastScorePost.get(key) || 0) < 2000) return json(res, 429, { error: 'too-fast' });
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
  if (url.pathname === '/api/spiele') {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
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
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
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
  for (const [code, room] of rooms) if (now - room.created > ROOM_TTL) {
    room.players.forEach(p => p && p.ws.close()); rooms.delete(code);
  }
}, 25000);
server.listen(PORT, '127.0.0.1', () => console.log('game-hub läuft auf Port ' + PORT));
