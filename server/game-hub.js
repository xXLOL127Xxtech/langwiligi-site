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
// Ansehen nur mit Schlüssel: https://langwiligi.site/api/empfehlungen#SCHLUESSEL (steht in admin-key.txt)
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
// Übersicht für den Betreiber. Der Schlüssel steht nach dem # und wird darum nie an den Server/ins Log geschickt.
const TIPS_PAGE = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Empfehlungen</title><style>
:root{color-scheme:dark}body{margin:0;background:#0b0b12;color:#f4f1ea;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:820px;margin:0 auto;padding:32px 16px 64px}h1{margin:0 0 4px;font-size:30px}.sub{color:#a19cae;margin:0 0 24px}
.tip{background:#14141f;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin:0 0 12px;display:flex;gap:12px}
.tip.done{opacity:.45}.tip>div{flex:1;min-width:0}.tip h2{margin:0;font-size:18px;overflow-wrap:anywhere}
.tip p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.meta{color:#a19cae;font-size:13px;margin-top:6px}
.tip nav{display:flex;flex-direction:column;gap:6px}button{font:600 13px system-ui,sans-serif;color:#f4f1ea;background:rgba(255,255,255,.06);
border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:7px 10px;cursor:pointer;white-space:nowrap}button:hover{background:rgba(255,255,255,.14)}
a{color:#ffb703}.msg{color:#a19cae}</style></head><body><main><h1>Spiel-Empfehlungen</h1><p class="sub" id="sub">Lade …</p><div id="list"></div></main>
<script>
var key=decodeURIComponent(location.hash.slice(1));
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function link(s){return esc(s).replace(/https?:\\/\\/[^\\s<"]+/g,function(u){return '<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>'})}
function call(m,body){return fetch('empfehlungen.json',{method:m,headers:{'X-Key':key,'Content-Type':'text/plain'},body:body&&JSON.stringify(body),cache:'no-store'})
.then(function(r){if(r.status===403)throw new Error('key');if(!r.ok)throw new Error('http');return r.json()})}
function show(rows){var open=rows.filter(function(t){return !t.done}).length;
document.getElementById('sub').textContent=rows.length?rows.length+' Empfehlungen, davon '+open+' offen':'Noch keine Empfehlungen.';
document.getElementById('list').innerHTML=rows.slice().reverse().map(function(t){return '<div class="tip'+(t.done?' done':'')+'"><div><h2>'+esc(t.game)+'</h2>'+
(t.note?'<p>'+link(t.note)+'</p>':'')+'<div class="meta">'+esc(t.name||'Anonym')+' · '+new Date(t.at).toLocaleString('de-CH')+'</div></div>'+
'<nav><button data-a="done" data-id="'+t.id+'">'+(t.done?'Wieder offen':'Erledigt')+'</button><button data-a="delete" data-id="'+t.id+'">Löschen</button></nav></div>'}).join('')}
function err(e){document.getElementById('sub').innerHTML='<span class="msg">'+(e.message==='key'?'Falscher oder fehlender Schlüssel. Link: …/api/empfehlungen#SCHLUESSEL':'Server nicht erreichbar.')+'</span>'}
document.getElementById('list').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
call('POST',{action:b.dataset.a,id:b.dataset.id}).then(show,err)});
call('GET').then(show,err);
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
    return res.end(TIPS_PAGE);
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
