'use strict';
// ============================================================
//  Ablauf: Menüs, Eingabe, Spielschleife, Online-Räume
// ============================================================
const HUB = window.GameHub || null;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOT_NAMES = ['Ganove Gustav', 'Panzerknacker', 'Langfinger', 'Die Elster', 'Tresor-Toni', 'Blitz-Berta', 'Schlitzohr', 'Fuchs'];
const SET_KEY = GAME_ID + '-settings';

function loadSet() { try { return Object.assign({ bots: 3, level: 1, map: 'zufall', muted: false }, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { return { bots: 3, level: 1, map: 'zufall', muted: false }; } }
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} }
const SET = loadSet();

const R = new Renderer($('c'));
const G = {
  mode: null, slots: [], sim: null, bots: [], me: 0, round: 0, scores: [], kills: [], mapQueue: [], paused: false, running: false,
  room: null, lobby: { bots: 2, level: 1, map: 'zufall' }, snaps: [], sendT: 0, inT: 0, acc: 0, lastPhase: '', lastCount: -1, view: null, ended: false,
};
const input = { l: false, r: false, fire: false, lp: 0, rp: 0, aim: 0, keyFire: false, mouseFire: false };

function myName() { return ((HUB ? HUB.getName() : '') || $('name').value || '').trim() || 'Spieler'; }
function saveName() { const n = $('name').value.trim(); if (HUB && n) HUB.setName(n); }
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  document.body.classList.toggle('ingame', !id);
}
function setStatus(id, txt, spin, err) { const el = $(id); el.className = 'status' + (err ? ' err' : ''); el.innerHTML = (spin ? '<span class="spin"></span>' : '') + esc(txt || ''); }

// ---------- Eingabe ----------
const KEY_L = ['KeyA', 'ArrowLeft'], KEY_R = ['KeyD', 'ArrowRight'];
addEventListener('keydown', e => {
  SFX.init();
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT') {
    // Im Spiel ist kein Eingabefeld sichtbar: Fokus abgeben, sonst kann man sich nicht bewegen
    if (G.running && document.body.classList.contains('ingame')) ae.blur(); else return;
  }
  if (KEY_L.includes(e.code)) { if (!e.repeat) { input.lp++; G.inT = 0; } input.l = true; e.preventDefault(); }
  else if (KEY_R.includes(e.code)) { if (!e.repeat) { input.rp++; G.inT = 0; } input.r = true; e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') { input.keyFire = true; e.preventDefault(); }
  else if (e.code === 'Escape' && G.running) togglePause();
  else if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', e => {
  if (KEY_L.includes(e.code)) input.l = false;
  else if (KEY_R.includes(e.code)) input.r = false;
  else if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') input.keyFire = false;
});
addEventListener('blur', () => { input.l = input.r = input.keyFire = input.mouseFire = false; });
const cv = $('c');
cv.addEventListener('pointermove', e => { R.mouse.x = e.clientX; R.mouse.y = e.clientY; R.mouse.in = true; });
cv.addEventListener('pointerdown', e => { SFX.init(); R.mouse.x = e.clientX; R.mouse.y = e.clientY; R.mouse.in = true; if (e.button === 0) input.mouseFire = true; });
addEventListener('pointerup', e => { if (e.button === 0) input.mouseFire = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('resize', () => R.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && G.running && G.mode === 'solo' && !G.paused) togglePause(); });

function togglePause() {
  if (!G.running) return;
  if (G.mode === 'solo') { G.paused = !G.paused; $('pause').classList.toggle('hidden', !G.paused); $('pause-t').textContent = 'Pause'; }
  else { const h = $('pause').classList.toggle('hidden'); G.paused = false; $('pause-t').textContent = h ? 'Pause' : 'Menü (Spiel läuft weiter)'; }
}
function toggleMute() { SET.muted = !SET.muted; SFX.setMuted(SET.muted); saveSet(); $('btn-mute').textContent = SET.muted ? '🔇' : '🔊'; }

// ---------- Spiel starten ----------
function shuffle(a, r = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = r() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function nextMap(choice) {
  if (choice !== 'zufall') return choice;
  if (!G.mapQueue.length) { G.mapQueue = shuffle(MAPS.map(m => m.id)); if (G.lastMap && G.mapQueue[0] === G.lastMap) G.mapQueue.push(G.mapQueue.shift()); }
  return (G.lastMap = G.mapQueue.shift());
}
function botSlots(n, level, start, names) {
  names = names || shuffle(BOT_NAMES.slice());
  const out = [];
  for (let i = 0; i < n; i++) out.push({ name: names[i] + ' 🤖', outfit: start + i, bot: level });
  return out;
}
function startSolo() {
  saveName();
  G.mode = 'solo'; G.me = 0; G.mapChoice = SET.map;
  G.slots = [{ name: myName(), outfit: 0, bot: null }, ...botSlots(SET.bots, SET.level, 1)];
  startMatch();
}
function startMatch() {
  G.round = 0; G.scores = G.slots.map(() => 0); G.kills = G.slots.map(() => 0); G.mapQueue = []; G.ended = false;
  if (G.mode === 'host' && G.room) {
    G.humans = G.slots.filter(s => s.seat != null).length;
    if (G.humans >= 2) G.room.roundStart();
  }
  startRound();
}
function startRound() {
  G.round++;
  if (G.mode === 'host' && G.round > 1) addLateJoiners();
  const mapId = nextMap(G.mapChoice);
  const seed = (Math.random() * 2 ** 31) >>> 0;
  buildRound(mapId, seed, false);
  G.cur = { t: 'round', map: mapId, seed, slots: G.slots, scores: G.scores, kills: G.kills, round: G.round };
  if (G.mode === 'host') netSend(G.cur);
}
// Wer während einer Runde beitritt, übernimmt ab der nächsten Runde einen Bot-Platz (oder einen freien Platz)
function addLateJoiners() {
  let added = false;
  for (const h of humansInRoom()) {
    if (G.slots.some(s => s.seat === h.seat)) continue;
    let i = G.slots.findIndex(s => s.bot != null && s.seat == null);
    if (i < 0 && G.slots.length < 4) { i = G.slots.length; G.scores.push(0); G.kills.push(0); }
    if (i < 0) continue;
    const used = G.slots.filter((s, k) => k !== i).map(s => s.outfit);
    let outfit = G.slots[i] ? G.slots[i].outfit : 0;
    while (used.includes(outfit)) outfit = (outfit + 1) % OUTFITS.length;
    G.slots[i] = { name: h.name, outfit, bot: null, seat: h.seat };
    G.scores[i] = 0; G.kills[i] = 0;
    added = true;
  }
  if (added) {
    const n = G.slots.filter(s => s.seat != null).length;
    if (n >= 2 && G.humans < 2) G.room.roundStart();
    G.humans = n;
  }
}
function buildRound(mapId, seed, client) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  G.inBase = { lp: input.lp, rp: input.rp };
  G.seed = seed;
  G.sim = new Sim({ mapId, seed, slots: G.slots, scores: G.scores, client });
  G.sim.players.forEach((p, i) => (p.kills = G.kills[i] || 0));
  G.bots = client ? [] : G.slots.map((s, i) => (s.bot != null ? new Bot(G.sim, G.sim.players[i], s.bot) : null));
  R.reset(); G.acc = 0; G.snaps = []; G.lastPhase = ''; G.lastCount = -1; G.view = G.sim.view();
  G.running = true; G.paused = false;
  $('pause').classList.add('hidden');
  show(null);
  $('maplbl').textContent = G.sim.mapDef.name + ' · Runde ' + G.round;
  $('feed').innerHTML = '';
  buildScoreboard();
}

// ---------- Schleife ----------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // bis 10 Bilder/s darf ein langsamer Rechner aufholen, sonst läuft das Spiel (online für alle) in Zeitlupe
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (!G.running || !G.sim) return;
  const sim = G.sim;
  input.fire = input.mouseFire || input.keyFire;
  // Zielwinkel aus Mausposition relativ zur eigenen Schulter
  const meV = G.view && G.me >= 0 ? G.view.P[G.me] : null;
  if (meV && R.mouse.in) {
    const w = R.screenToWorld(R.mouse.x, R.mouse.y);
    const ca = Math.cos(meV[2]), sa = Math.sin(meV[2]);
    const sx = meV[0] + ca * 0.02 - sa * 0.1, sy = meV[1] + sa * 0.02 + ca * 0.1;
    input.aim = Math.atan2(w.y - sy, w.x - sx);
  }
  if (G.mode === 'client') clientFrame(dt);
  else if (!G.paused) {
    G.acc += dt;
    let steps = 0;
    while (G.acc >= STEP && steps < 6) {
      const me = sim.players[G.me];
      if (me) Object.assign(me.input, { l: input.l, r: input.r, fire: input.fire, aim: input.aim, lp: input.lp - G.inBase.lp, rp: input.rp - G.inBase.rp });
      for (const b of G.bots) if (b) b.update(STEP);
      sim.step(STEP);
      G.acc -= STEP; steps++;
    }
    if (steps === 6) G.acc = 0;
    G.view = sim.view();
    const evs = sim.events; sim.events = [];
    handleEvents(evs);
    if (G.mode === 'host') {
      G.netEv = (G.netEv || []).concat(evs);
      G.sendT -= dt;
      if (G.sendT <= 0) { G.sendT = 1 / 30; netSend({ t: 's', v: packView(G.view), e: G.netEv }); G.netEv = []; }
    }
    if (sim.done && !G.ended) {
      G.scores = sim.players.map(p => p.escapes); G.kills = sim.players.map(p => p.kills);
      if (sim.done === 'over') endMatch(); else startRound();
      return;
    }
  }
  if (!G.view) return;
  const v = G.view;
  // eigene Zielrichtung sofort anzeigen
  if (meV) v.P[G.me][3] = input.aim;
  const focus = G.me >= 0 && v.P[G.me] ? { x: v.P[G.me][0], y: v.P[G.me][1] } : leaderFocus(v);
  R.updateCamera(sim, focus, dt);
  R.goalRect = sim.map.goal(sim);
  R.updateFx(dt);
  R.draw(sim, v, G.slots, G.me, dt);
  updateHud(v);
}
function leaderFocus(v) { let b = v.P[0]; for (const p of v.P) if (p[0] > b[0]) b = p; return { x: b[0], y: b[1] }; }

function handleEvents(evs) {
  const v = G.view, me = v && G.me >= 0 ? v.P[G.me] : null;
  const focus = me ? { x: me[0], y: me[1] } : null;
  for (const e of evs) {
    R.event(e, G.slots, focus);
    if (e[0] === 'die') {
      const [, pi, , , cause, by] = e;
      const map = G.sim.map;
      let txt;
      if (by >= 0 && by !== pi) txt = `<b style="color:${OUTFITS[G.slots[by].outfit].main}">${esc(G.slots[by].name)}</b> ✖ <b style="color:${OUTFITS[G.slots[pi].outfit].main}">${esc(G.slots[pi].name)}</b>`;
      else txt = `<b style="color:${OUTFITS[G.slots[pi].outfit].main}">${esc(G.slots[pi].name)}</b> ${esc(deathText(cause, map))}`;
      feed(txt);
      if (pi === G.me) banner(by >= 0 && by !== pi ? 'Erwischt von ' + G.slots[by].name : 'Du bist ' + deathText(cause, map), 'Gleich geht es weiter …', 1.8);
    } else if (e[0] === 'escape') {
      const pi = e[1];
      G.scores[pi] = (G.scores[pi] || 0) + 1;
      if (G.view) G.view.sc[pi] = G.scores[pi];
      banner(pi === G.me ? 'Du bist entkommen!' : G.slots[pi].name + ' ist entkommen!', `${G.scores[pi]} von ${WIN_SCORE} Fluchten`, 3.4);
      buildScoreboard();
    } else if (e[0] === 'pick' && e[1] === G.me) feed('Du hast ' + esc(WEAPONS[WKEYS[e[2]]].name) + ' aufgehoben', true);
  }
}
function deathText(cause, map) {
  const t = (map.deathText || {})[cause];
  if (t) return t;
  return { schuss: 'erschossen', explosion: 'in die Luft gesprengt', sturz: 'abgestürzt' }[cause] || 'ausgeschieden';
}
let feedN = 0;
function feed(html, mine) {
  const el = document.createElement('div');
  el.className = 'fi' + (mine ? ' mine' : ''); el.innerHTML = html;
  $('feed').prepend(el);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3500);
  setTimeout(() => el.remove(), 4200);
}
let bannerT = 0;
function banner(big, small, dur) {
  $('banner').innerHTML = `<div class="big">${esc(big)}</div>${small ? `<div class="small">${esc(small)}</div>` : ''}`;
  $('banner').classList.remove('hidden'); $('banner').classList.remove('pop'); void $('banner').offsetWidth; $('banner').classList.add('pop');
  bannerT = performance.now() + dur * 1000;
}

// ---------- HUD ----------
function buildScoreboard() {
  $('score').innerHTML = G.slots.map((s, i) => `<div class="sr${i === G.me ? ' me' : ''}"><i style="background:${OUTFITS[s.outfit].main}"></i><b>${esc(s.name)}</b><span class="st" id="st${i}"></span><span class="kl" id="kl${i}"></span></div>`).join('');
}
const WICON = {};
for (const k of WKEYS) { const s = WSPR[k]; const [c, g] = mkCanvas(s.w * 3, s.h * 3); g.drawImage(s.img, 0, 0, s.w * 3, s.h * 3); WICON[k] = c.toDataURL(); }
let hudCache = '';
function updateHud(v) {
  // Countdown und Phasen
  if (v.ph === 'countdown') {
    const n = 3 - Math.floor(v.pt);
    if (n !== G.lastCount && n > 0) { G.lastCount = n; banner(String(n), n === 3 ? 'Erreiche als Erster das Fluchtfahrzeug!' : '', 0.9); SFX.play('tick', 1); }
  } else if (G.lastPhase === 'countdown' && v.ph === 'play') banner('LOS!', '', 0.8);
  G.lastPhase = v.ph;
  if (bannerT && performance.now() > bannerT) { $('banner').classList.add('hidden'); bannerT = 0; }
  // Punkte
  v.sc.forEach((s, i) => {
    const el = $('st' + i); if (!el) return;
    const t = '★'.repeat(Math.min(s, WIN_SCORE)) + '☆'.repeat(Math.max(0, WIN_SCORE - s));
    if (el.textContent !== t) el.textContent = t;
    const k = $('kl' + i), kt = '✖ ' + (v.kl ? v.kl[i] : 0);
    if (k.textContent !== kt) k.textContent = kt;
  });
  // Waffe
  const me = G.me >= 0 ? v.P[G.me] : null;
  let h = '';
  if (me) {
    if (me[4] >= 0) { const k = WKEYS[me[4]]; h = `<img src="${WICON[k]}" alt=""><div><b>${WEAPONS[k].name}</b><span>${me[5]} Schuss</span></div>`; }
    else h = `<div><b>Keine Waffe</b><span>Lauf über eine Kiste</span></div>`;
  }
  if (h !== hudCache) { $('weapon').innerHTML = h; hudCache = h; }
}

// ---------- Ende ----------
function endMatch() {
  G.ended = true; G.running = false;
  const sim = G.sim;
  const w = sim.winner;
  const rows = G.slots.map((s, i) => ({ s, i, e: G.scores[i], k: G.kills[i] })).sort((a, b) => b.e - a.e || b.k - a.k);
  $('end-title').textContent = w === G.me ? 'Geschafft – du bist entkommen!' : G.slots[w].name + ' gewinnt!';
  $('end-title').style.color = OUTFITS[G.slots[w].outfit].main;
  $('end-table').innerHTML = '<tr><th>#</th><th>Name</th><th>Fluchten</th><th>Treffer</th></tr>' +
    rows.map((r, n) => `<tr class="${r.i === G.me ? 'me' : ''}"><td>${n + 1}</td><td><i style="background:${OUTFITS[r.s.outfit].main}"></i>${esc(r.s.name)}</td><td>${r.e}</td><td>${r.k}</td></tr>`).join('');
  const canRestart = G.mode !== 'client';
  $('btn-again').classList.toggle('hidden', !canRestart);
  $('end-wait').classList.toggle('hidden', canRestart);
  $('btn-lobby').classList.toggle('hidden', G.mode !== 'host');
  $('end-board').innerHTML = '';
  show('end');
  if (window.LW) LW.rundeFertig();
  if (G.mode === 'host') {
    netSend({ t: 'end', w, scores: G.scores, kills: G.kills });
    if (G.humans >= 2) { const seat = G.slots[w].seat; G.room.result(seat != null ? seat : -1); }
  }
}
function toMenu() {
  G.running = false; G.sim = null;
  if (G.room) { G.room.close(); G.room = null; }
  G.mode = null;
  show('menu');
  if (HUB) HUB.loadBoard(GAME_ID, $('menu-board'), myName());
}

// ---------- Online ----------
function netSend(m) { if (G.room) G.room.send(m); }
function bindRoom(room) {
  room.on('msg', (d, from) => onNet(d, from));
  room.on('peer-join', m => {
    if (G.mode !== 'host') return;
    if (!G.running) renderLobby();
    sendLobby();
    // Läuft schon eine Runde: Neuling schaut zu und ist ab der nächsten Runde dabei
    if (G.running && G.cur) { netSend(G.cur); feed(esc(m.name || 'Jemand') + ' ist beigetreten und spielt ab der nächsten Runde mit'); }
  });
  room.on('peer-left', m => {
    if (G.mode === 'host') {
      const s = G.slots.find(x => x.seat === m.idx);
      if (s && G.running) { s.bot = 1; s.name = s.name + ' 🤖'; s.seat = null; const i = G.slots.indexOf(s); G.bots[i] = new Bot(G.sim, G.sim.players[i], 1); G.sim.players[i].isBot = true; feed(esc(s.name) + ' hat das Spiel verlassen'); buildScoreboard(); }
      if (!G.running) renderLobby();
      sendLobby();
    } else if (m.idx === 0) { hostGone(); }
  });
  room.on('close', () => { if (G.room === room) hostGone('Verbindung zum Server verloren.'); });
  room.on('leaderboard', rows => { if (HUB) HUB.renderBoard($('end-board'), rows, myName()); });
}
function hostGone(msg) {
  const wasIn = !!G.room;
  G.running = false; G.sim = null;
  if (G.room) { const r = G.room; G.room = null; r.close(); }
  G.mode = null;
  show('menu');
  if (wasIn) setStatus('menu-status', msg || 'Der Host hat das Spiel verlassen.', false, true);
}
async function createRoom() {
  if (!HUB) return;
  saveName();
  setStatus('online-status', 'Raum wird erstellt …', true);
  const room = HUB.connect(GAME_ID);
  try {
    const info = await room.create(myName(), 4);
    G.room = room; G.mode = 'host'; bindRoom(room);
    G.lobby = { bots: SET.bots >= 1 ? Math.min(2, SET.bots) : 0, level: SET.level, map: SET.map, names: shuffle(BOT_NAMES.slice()) };
    setStatus('online-status', '');
    openLobby(info.code);
  } catch (e) { setStatus('online-status', HUB.errorText(e), false, true); }
}
async function joinRoom(code) {
  if (!HUB) return;
  saveName();
  if (code.length !== 4) return setStatus('online-status', 'Bitte einen 4-stelligen Code eingeben.', false, true);
  setStatus('online-status', 'Trete bei …', true);
  const room = HUB.connect(GAME_ID);
  try {
    const info = await room.join(code, myName());
    G.room = room; G.mode = 'client'; bindRoom(room);
    setStatus('online-status', '');
    openLobby(info.code);
  } catch (e) { setStatus('online-status', HUB.errorText(e), false, true); }
}
function openLobby(code) {
  $('lobby-code').textContent = code;
  $('lobby-host').classList.toggle('hidden', G.mode !== 'host');
  $('lobby-wait').classList.toggle('hidden', G.mode === 'host');
  show('lobby');
  renderLobby();
  if (G.mode === 'host') sendLobby();
}
function humansInRoom() {
  return (G.room && G.room.players || []).map((n, seat) => (n ? { name: n, seat } : null)).filter(Boolean);
}
function lobbySlots() {
  const hum = humansInRoom().slice(0, 4);
  const slots = hum.map((h, i) => ({ name: h.name, outfit: i, bot: null, seat: h.seat }));
  const nb = Math.min(G.lobby.bots, 4 - slots.length);
  return slots.concat(botSlots(nb, G.lobby.level, slots.length, G.lobby.names));
}
function renderLobby(slots) {
  slots = slots || (G.mode === 'host' ? lobbySlots() : G.lobbySlots || []);
  $('lobby-list').innerHTML = slots.map(s => `<div class="lp"><i style="background:${OUTFITS[s.outfit].main}"></i>${esc(s.name)}${s.seat === 0 ? ' <span class="small">(Host)</span>' : ''}</div>`).join('') +
    `<div class="small">${slots.length} von 4 Plätzen</div>`;
  if (G.mode === 'host') {
    for (const b of document.querySelectorAll('#lb-bots .btn')) b.classList.toggle('sel', +b.dataset.v === G.lobby.bots);
    for (const b of document.querySelectorAll('#lb-level .btn')) b.classList.toggle('sel', +b.dataset.v === G.lobby.level);
    $('lb-map').value = G.lobby.map;
    $('btn-lstart').disabled = slots.length < 2;
  } else {
    const L = G.lobbyInfo;
    $('lobby-wait-info').textContent = L ? `Karte: ${L.map === 'zufall' ? 'Zufall' : (MAPS.find(m => m.id === L.map) || {}).name} · Bots: ${['Leicht', 'Mittel', 'Schwer'][L.level]}` : '';
  }
}
function sendLobby() { if (G.mode === 'host') netSend({ t: 'lobby', slots: lobbySlots(), map: G.lobby.map, level: G.lobby.level }); }
function hostStart() {
  G.slots = lobbySlots(); G.me = 0; G.mapChoice = G.lobby.map;
  startMatch();
}
function onNet(d, from) {
  if (!d || typeof d !== 'object') return;
  if (G.mode === 'host') {
    if (d.t === 'in' && G.running && G.sim) {
      const i = G.slots.findIndex(s => s.seat === from);
      if (i < 0) return;
      // Eingaben aus einer alten Runde ignorieren (sonst blieben Sprünge nach dem Rundenwechsel hängen)
      if (d.rd != null && d.rd !== G.round) return;
      const p = G.sim.players[i], inp = p.input, lp = d.lp | 0, rp = d.rp | 0;
      inp.l = !!d.l; inp.r = !!d.r; inp.fire = !!d.f; inp.aim = +d.a || 0;
      // Gäste zählen ihre Tastendrücke fortlaufend: die erste Meldung der Runde ist der Startwert
      if (!inp.net) { inp.net = true; inp.lp = p.seenL = lp; inp.rp = p.seenR = rp; }
      else { inp.lp = Math.max(inp.lp, lp); inp.rp = Math.max(inp.rp, rp); }
    }
    return;
  }
  // Gast
  if (d.t === 'lobby') {
    G.lobbySlots = d.slots; G.lobbyInfo = d;
    if (!G.running) { show('lobby'); renderLobby(d.slots); }
  } else if (d.t === 'round') {
    if (G.running && G.sim && d.seed === G.seed && d.round === G.round) return;   // gleiche Runde nochmal (für Neulinge)
    G.slots = d.slots; G.scores = d.scores; G.kills = d.kills; G.round = d.round; G.mapChoice = d.map;
    G.me = G.slots.findIndex(s => s.seat === G.room.you);
    buildRound(d.map, d.seed, true);
    if (G.me < 0) banner('Du schaust zu', 'Ab der nächsten Runde spielst du mit', 3);
  } else if (d.t === 's' && G.running && G.sim) {
    const now = performance.now(), last = G.snaps[G.snaps.length - 1];
    if (last) {
      // Abstand und Schwankung der Pakete messen -> so wenig Verzögerung wie möglich
      const gap = now - last.at;
      G.gap = G.gap ? G.gap + (gap - G.gap) * 0.1 : gap;
      G.jit = (G.jit || 0) + (Math.abs(gap - G.gap) - (G.jit || 0)) * 0.1;
    }
    G.snaps.push({ at: now, v: d.v });
    if (G.snaps.length > 30) G.snaps.shift();
    if (d.e && d.e.length) handleEvents(d.e);
  } else if (d.t === 'end' && G.sim) {
    G.scores = d.scores; G.kills = d.kills;
    G.sim.winner = d.w;
    endMatch();
  }
}
// Gast: Zustand zwischen zwei Paketen weich überblenden
function lerpAng(a, b, t) { return a + normAng(b - a) * t; }
function interp(A, B, t) {
  const P = B.P.map((b, i) => { const a = A.P[i]; if (!a) return b; const o = b.slice(); o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerpAng(a[2], b[2], t); o[3] = lerpAng(a[3], b[3], t); return o; });
  const M = B.M.map((b, i) => { const a = A.M[i]; if (!a || a[3] === 3 || b[3] === 3) return b; return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerpAng(a[2], b[2], t), b[3]]; });
  const byId = (arr) => { const m = new Map(); for (const x of arr) m.set(x[0], x); return m; };
  const ka = byId(A.K), ra = byId(A.R);
  const K = B.K.map(b => { const a = ka.get(b[0]); return a ? [b[0], b[1], lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerpAng(a[4], b[4], t)] : b; });
  const Rr = B.R.map(b => { const a = ra.get(b[0]); return a ? [b[0], b[1], lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerpAng(a[4], b[4], t)] : b; });
  return { t: lerp(A.t, B.t, t), ph: B.ph, pt: lerp(A.pt, B.pt, t), w: B.w, sc: B.sc, kl: B.kl, H: B.H, P, M, K: K, R: Rr };
}
function clientFrame(dt) {
  const sim = G.sim;
  // Eingaben senden (bei Tastendruck sofort, sonst ~30 mal pro Sekunde)
  G.inT -= dt;
  if (G.inT <= 0 && G.me >= 0) {
    G.inT = 1 / 30;
    netSend({ t: 'in', l: input.l, r: input.r, f: input.fire, a: Math.round(input.aim * 100) / 100, lp: input.lp, rp: input.rp, rd: G.round });
  }
  if (!G.snaps.length) return;
  const delay = clamp((G.gap || 40) * 1.5 + (G.jit || 10) * 2, 45, 160);
  const rt = performance.now() - delay;
  let A = null, B = null;
  for (let i = G.snaps.length - 1; i >= 0; i--) { if (G.snaps[i].at <= rt) { A = G.snaps[i]; B = G.snaps[i + 1] || null; break; } }
  let v;
  if (!A) v = G.snaps[0].v;
  else if (!B) v = A.v;
  else v = interp(A.v, B.v, clamp((rt - A.at) / Math.max(1, B.at - A.at), 0, 1));
  // Eigene Figur: neuester Stand plus kurze Vorausschau statt Verzögerung -> Steuerung fühlt sich direkter an
  const L = G.snaps[G.snaps.length - 1];
  if (G.me >= 0 && L.v.P[G.me]) {
    const o = L.v.P[G.me].slice(), age = Math.min(0.1, (performance.now() - L.at) / 1000);
    if ((o[7] & 1) && !(o[7] & 64)) { o[0] += o[8] * age; o[1] += o[9] * age - (o[7] & 2 ? 0 : 0.5 * GRAV * age * age); }
    v = Object.assign({}, v, { P: v.P.slice() });
    v.P[G.me] = o;
  }
  G.view = v;
  // Kartenkörper auf den Stand des Hosts setzen (für Ziel, Seile usw.)
  sim.movers.forEach((mb, i) => { const m = v.M[i]; if (m) { mb.body.setTransform(V2(m[0], m[1]), m[2]); mb.state = m[3]; } });
  sim.t = v.t;
}

// ---------- Menü-Knöpfe ----------
function initUi() {
  $('name').value = HUB ? HUB.getName() : '';
  $('name').addEventListener('change', saveName);
  $('btn-solo').onclick = () => { SFX.init(); show('solo'); renderSolo(); };
  $('btn-online').onclick = () => { SFX.init(); show('online'); setStatus('online-status', HUB ? '' : 'Online-Spiel ist nur auf langwiligi.site verfügbar.', false, !HUB); };
  if (!HUB) { $('btn-online').disabled = true; $('btn-online').title = 'Nur auf langwiligi.site'; }
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => toMenu();
  $('btn-go').onclick = () => startSolo();
  $('btn-create').onclick = () => createRoom();
  $('btn-join').onclick = () => joinRoom(HUB ? HUB.cleanCode($('join-code').value) : '');
  $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
  $('btn-copy').onclick = () => {
    const url = location.origin + location.pathname + '#' + $('lobby-code').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { $('btn-copy').textContent = 'Kopiert ✓'; }, () => { $('btn-copy').textContent = url; });
    setTimeout(() => ($('btn-copy').textContent = 'Link kopieren'), 2500);
  };
  $('btn-leave').onclick = () => toMenu();
  for (const b of document.querySelectorAll('#lb-bots .btn')) b.onclick = () => { G.lobby.bots = +b.dataset.v; renderLobby(); sendLobby(); };
  for (const b of document.querySelectorAll('#lb-level .btn')) b.onclick = () => { G.lobby.level = +b.dataset.v; renderLobby(); sendLobby(); };
  $('lb-map').onchange = () => { G.lobby.map = $('lb-map').value; sendLobby(); };
  $('btn-lstart').onclick = () => hostStart();
  for (const b of document.querySelectorAll('#so-bots .btn')) b.onclick = () => { SET.bots = +b.dataset.v; saveSet(); renderSolo(); };
  for (const b of document.querySelectorAll('#so-level .btn')) b.onclick = () => { SET.level = +b.dataset.v; saveSet(); renderSolo(); };
  $('so-map').onchange = () => { SET.map = $('so-map').value; saveSet(); };
  const opts = '<option value="zufall">Zufällig (alle Karten)</option>' + MAPS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('so-map').innerHTML = opts; $('lb-map').innerHTML = opts;
  $('map-list').innerHTML = MAPS.map(m => `<div class="mi"><i style="background:${m.color}"></i><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></div>`).join('');
  $('btn-again').onclick = () => { if (G.mode === 'solo') startMatch(); else if (G.mode === 'host') { G.slots = lobbySlots().length >= 2 ? lobbySlots() : G.slots; startMatch(); } };
  $('btn-lobby').onclick = () => { G.running = false; show('lobby'); renderLobby(); sendLobby(); };
  $('btn-menu2').onclick = () => toMenu();
  $('btn-resume').onclick = () => togglePause();
  $('btn-quit').onclick = () => { $('pause').classList.add('hidden'); toMenu(); };
  $('btn-pause').onclick = () => togglePause();
  $('btn-mute').onclick = () => toggleMute();
  $('btn-mute').textContent = SET.muted ? '🔇' : '🔊';
  SFX.setMuted(SET.muted);
  if (HUB) {
    HUB.loadBoard(GAME_ID, $('menu-board'), myName());
    const code = HUB.cleanCode(location.hash);
    if (code.length === 4) { show('online'); $('join-code').value = code; setStatus('online-status', 'Name eingeben und „Beitreten“ drücken.'); }
  } else $('board-box').classList.add('hidden');
}
function renderSolo() {
  for (const b of document.querySelectorAll('#so-bots .btn')) b.classList.toggle('sel', +b.dataset.v === SET.bots);
  for (const b of document.querySelectorAll('#so-level .btn')) b.classList.toggle('sel', +b.dataset.v === SET.level);
  $('so-map').value = SET.map;
}
initUi();
show('menu');
requestAnimationFrame(frame);
