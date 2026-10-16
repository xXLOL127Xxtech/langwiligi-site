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
// Anzeigenamen der Spiele aus dem <title> der Webseite (für die Admin-Seite, 1 Min. gecacht)
let titles = {}, titlesAt = 0;
function gameTitle(game) {
  if (Date.now() - titlesAt > 60000) {
    titlesAt = Date.now();
    const t = {};
    try {
      for (const d of fs.readdirSync(GAMES_DIR)) {
        try {
          const m = fs.readFileSync(path.join(GAMES_DIR, d, 'index.html'), 'utf8').slice(0, 6000).match(/<title>([^<]*)<\/title>/i);
          if (m) t[d] = m[1].trim().replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
}

function onMessage(ws, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'create': {
      leave(ws);
      const room = { code: newCode(), game: cleanGame(m.game), max: Math.min(8, Math.max(2, m.max | 0 || 2)),
        players: [], roundOpen: false, created: Date.now() };
      room.players[0] = { ws, name: cleanName(m.name) };
      rooms.set(room.code, room); ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: 0, players: names(room) });
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) return send(ws, { t: 'error', msg: 'not-found' });
      if (room.game !== cleanGame(m.game)) return send(ws, { t: 'error', msg: 'wrong-game' });
      let idx = -1;
      for (let i = 0; i < room.max; i++) if (!room.players[i]) { idx = i; break; }
      if (idx < 0) return send(ws, { t: 'error', msg: 'full' });
      leave(ws);
      room.players[idx] = { ws, name: cleanName(m.name) }; ws.room = room;
      send(ws, { t: 'joined', code: room.code, you: idx, players: names(room) });
      others(room, ws).forEach(p => send(p.ws, { t: 'peer-join', idx, name: room.players[idx].name, players: names(room) }));
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
  }
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
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => onMessage(ws, raw));
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.created > ROOM_TTL) {
    room.players.forEach(p => p && p.ws.close()); rooms.delete(code);
  }
}, 25000);
server.listen(PORT, '127.0.0.1', () => console.log('game-hub läuft auf Port ' + PORT));
