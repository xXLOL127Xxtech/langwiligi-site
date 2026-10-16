// Gitterkrieg – Hauptschleife, Zeichnen, HUD, Menüs und Online-Ablauf
'use strict';

const glc = $('gl'), ovc = $('ov'), ov = ovc.getContext('2d');
const GL_OK = (() => { try { return R.init(glc); } catch (e) { console.error(e); return false; } })();
Input.init();

// ---------- Zustand ----------
let role = 'demo';          // 'demo' | 'local' | 'host' | 'guest'
let state = 'menu';         // 'menu' | 'play' | 'end'
let paused = false;
let sim = null, cview = null;
let mySlot = -1;
let myName = 'Spieler';
let room = null, lobbyCfg = { mode: 'coop', bots: 0, diff: 1, time: 180 }, gid = 0, roster = [];
let lastLocal = null;        // letzte lokale Spieleinstellung für „Nochmal“
let netEv = [], snapTick = 0, inSendT = 0;
let acc = 0, gridAcc = 0, time = 0, lastT = 0, frameLast = 0;
let camX = AW / 2, camY = AH / 2, camZ = 1, cssW = innerWidth, cssH = innerHeight;
let quality = 1, bloomOn = true, perfAcc = 0, perfN = 0, perfT = 0, goodT = 0, showFps = false, fpsVal = 60;
let deadNoticeShown = false, lastWeapon = 0;
const floats = [];
const BRIGHT = EDEF.map(d => d.col.map(v => v * 1.75));
const PBRIGHT = PCOLS.map(c => c.map(v => v * 1.6 + 0.15));

// ---------- Formen (lokale Einheiten) ----------
const SH_SHIP = [-12, -4, -6, -12, 12, -9, 3, -4, 3, 4, 12, 9, -6, 12, -12, 4];
const SH_BLADE = [0, 0, 1, 0, 0.3, 0.52];
const SH_DIAMOND = [1, 0, 0, 0.66, -1, 0, 0, -0.66];
const SH_SQUARE = [-0.72, -0.72, 0.72, -0.72, 0.72, 0.72, -0.72, 0.72];
const SH_ARROW = [1.15, 0, -0.6, 0.78, -0.25, 0, -0.6, -0.78];
const SH_ROCKET = [1.25, 0, -0.35, 0.62, -0.95, 0.62, -0.6, 0, -0.95, -0.62, -0.35, -0.62];
const SH_GEOM = [1, 0, 0.2, 0.55, -1, 0, -0.2, -0.55];

// ---------- Hilfen ----------
function viewOf() {
  if (role === 'guest' && cview) return cview;
  if (sim) return sim;
  return null;
}
function toWorld(px, py) { return [camX + (px - cssW / 2) / camZ, camY + (py - cssH / 2) / camZ]; }
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === id));
  $('overlay').classList.toggle('hidden', !id);
}
let noticeT = null;
function notice(t, s, col) {
  const n = $('notice');
  n.querySelector('.t').textContent = t; n.querySelector('.s').textContent = s || '';
  n.style.setProperty('--nc', col || '#3ae0ff');
  n.classList.add('show');
  clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('show'), 1700);
}
FX.onNotice = notice;
FX.onPvp = (victim, killer) => {
  const v = viewOf(); if (!v) return;
  const vs = v.ships[victim], ks = v.ships[killer];
  if (!vs || !ks) return;
  floats.push({ x: vs.x, y: vs.y - 30, text: ks.name + ' erwischt ' + vs.name, col: PCOLS_HEX[killer % PCOLS_HEX.length], t: 1.8 });
  if (killer === mySlot) Snd.extra();
};
function setHud(on) { $('hud').classList.toggle('on', on); document.body.classList.toggle('menu', !on); }
function readName() {
  const v = $('name').value.trim().slice(0, 16);
  myName = (HUB ? GameHub.setName(v) : v) || 'Spieler';
  return myName;
}
function resetWorld() {
  Gitter.reset(); Partikel.clear(); floats.length = 0;
  FX.shake = 0; FX.flash = 0; acc = 0; netEv = []; snapTick = 0;
  deadNoticeShown = false; lastWeapon = 0;
}

// ---------- Modi ----------
function startDemo() {
  role = 'demo'; state = 'menu'; paused = false; cview = null;
  sim = new Sim({ mode: 'coop', demo: true });
  sim.addShip('Demo', 2); sim.addShip('Demo', 2); sim.addShip('Demo', 1);
  mySlot = -1; FX.mySlot = -1;
  Snd.sfxVol(0.18); Snd.music(false);
  setHud(false);
  $('roombox').style.display = 'none';
}

function startLocal(c) {
  lastLocal = c;
  resetWorld();
  role = 'local'; state = 'play'; paused = false; cview = null;
  sim = new Sim({ mode: c.mode, time: c.time });
  sim.addShip(myName, null, 0);
  for (let i = 0; i < (c.bots || 0); i++) sim.addShip(BOT_NAMES[i] + ' (' + BOT_DIFF[c.diff].name + ')', c.diff);
  mySlot = 0; FX.mySlot = 0;
  const me = sim.ships[0];
  me.bombReq = me.bombDone = 0; Input.bombBase = Input.bombQ;
  beginPlay();
  notice(c.mode === 'versus' ? 'Versus' : c.mode === 'coop' ? 'Koop' : 'Los!', c.mode === 'versus' ? 'Alle gegen alle – meiste Punkte gewinnt' : 'Überlebe die Schwärme', '#3ae0ff');
}
const BOT_NAMES = ['Vektor', 'Pixel', 'Neon'];

function beginPlay() {
  showPanel(null); setHud(true);
  Snd.unlock(); Snd.sfxVol(0.8); Snd.music(true);
  buildHudCards();
  camZ = targetZoom();
}

function endGame() {
  if (state !== 'play') return;
  state = 'end';
  const res = role === 'guest' ? null : sim.results();
  if (role === 'host') {
    room.send({ t: 'over', res, mode: sim.cfg.mode, gid });
    if (sim.cfg.mode === 'versus' && humansInRoom() >= 2) {
      const tie = res.length > 1 && res[0].score === res[1].score;
      room.result(!tie && res[0].bot < 0 ? res[0].seat : -1);
    }
  }
  showEnd(res, sim.cfg.mode);
}

function showEnd(res, mode) {
  Snd.music(false);
  setHud(false);
  const solo = mode === 'solo';
  const meRes = res.find(r => r.slot === mySlot);
  let title = 'Spiel vorbei', body = '';
  if (solo) {
    body = `<div class="bigval">${fmtNum(meRes.score)}</div>` +
      `<div class="stat3"><div><b>${meRes.kills}</b>Abschüsse</div><div><b>x${meRes.maxMult}</b>höchster Multiplikator</div><div><b>${fmtTime(sim ? sim.t : 0)}</b>überlebt</div></div>`;
  } else {
    if (mode === 'versus') {
      const win = res[0];
      const tie = res.length > 1 && res[1].score === win.score;
      title = tie ? 'Unentschieden' : win.slot === mySlot ? '🏆 Du hast gewonnen!' : esc(win.name) + ' gewinnt';
    } else {
      const team = res.reduce((a, r) => a + r.score, 0);
      title = 'Koop vorbei';
      body = `<div class="bigval">${fmtNum(team)}</div><div class="hint" style="text-align:center">Team-Punkte</div>`;
    }
    body += '<table class="rank"><tr><th></th><th>Name</th><th class="r">Punkte</th><th class="r">Abschüsse</th>' +
      (mode === 'versus' ? '<th class="r">Treffer</th>' : '') + '<th class="r">max. x</th></tr>' +
      res.map((r, i) => `<tr class="${r.slot === mySlot ? 'me' : ''}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>` +
        `<td><span style="color:${PCOLS_HEX[r.slot % PCOLS_HEX.length]}">●</span> ${esc(r.name)}${r.bot >= 0 ? '<span class="tag">Bot</span>' : ''}</td>` +
        `<td class="r">${fmtNum(r.score)}</td><td class="r">${r.kills}</td>` + (mode === 'versus' ? `<td class="r">${r.pk}</td>` : '') +
        `<td class="r">x${r.maxMult}</td></tr>`).join('') + '</table>';
  }
  $('end-title').innerHTML = title;
  $('end-body').innerHTML = body;
  $('end-status').textContent = '';
  const online = role === 'host' || role === 'guest';
  $('end-boardwrap').style.display = (solo || (online && mode === 'versus')) && HUB ? '' : 'none';
  $('btn-again').style.display = role === 'guest' ? 'none' : '';
  $('btn-again').textContent = 'Nochmal';
  $('btn-end-menu').textContent = role === 'host' ? 'Zur Lobby' : role === 'guest' ? 'Raum verlassen' : 'Menü';
  if (role === 'guest') $('end-status').textContent = 'Warte auf den Host …';
  if (solo && HUB) {
    $('end-boardtitle').textContent = 'Highscores';
    $('end-board').innerHTML = '<div class="hint">Speichere Punkte …</div>';
    GameHub.submitScore(GAME_ID, myName, Math.min(10000000, Math.round(meRes.score)), { jumps: Math.round(meRes.prog) })
      .then(r => {
        GameHub.renderScores($('end-board'), r.rows, myName, { cols: [['score', 'Punkte']] });
        if (r.rank) $('end-status').textContent = `Platz ${r.rank} von ${r.total}` + (r.best > meRes.score ? ` – dein Rekord: ${fmtNum(r.best)}` : '');
      })
      .catch(() => loadHighscores($('end-board')));
  } else if (online && mode === 'versus' && HUB) {
    $('end-boardtitle').textContent = 'Rangliste Versus-Siege';
    GameHub.loadBoard(GAME_ID, $('end-board'), myName);
  }
  showPanel('p-end');
  if (window.LW && LW.rundeFertig) LW.rundeFertig();
}
function fmtTime(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function loadHighscores(el) {
  if (!HUB) return;
  el.innerHTML = '<div class="hint">Lade Highscores …</div>';
  GameHub.highscores(GAME_ID).then(rows => GameHub.renderScores(el, rows, myName, { cols: [['score', 'Punkte']] }),
    () => { el.innerHTML = '<div class="hint">Highscores gerade nicht erreichbar.</div>'; });
}

function toMenu() {
  if (room) leaveRoom();
  startDemo();
  showPanel('p-menu');
  if (HUB) loadHighscores($('menu-board'));
}

function setPause(on) {
  if (state !== 'play') return;
  if (role === 'local') {
    paused = on;
    Snd.music(!on);
    $('pause-sub').textContent = 'Das Spiel ist angehalten.';
  } else {
    paused = false;
    $('pause-sub').textContent = 'Online läuft das Spiel weiter!';
  }
  showPanel(on ? 'p-pause' : null);
}

// ---------- Online ----------
function humansInRoom() { return room ? (room.players || []).filter(Boolean).length : 0; }
function inviteLink() {
  const base = location.protocol === 'https:' ? location.origin + location.pathname : 'https://langwiligi.site/' + GAME_ID + '/';
  return base + '#' + (room ? room.code : '');
}
function bindRoom() {
  room.on('msg', (d, from) => {
    if (!d || typeof d !== 'object') return;
    if (role === 'host' || (role === 'lobby-host')) onGuestMsg(d, from);
    else if (from === 0) onHostMsg(d);
  });
  room.on('peer-join', m => {
    if (role === 'lobby-host') { sendLobby(); renderLobby(); }
    else if (role === 'host') {
      const s = sim.addShip(m.name || 'Gast', null, m.idx);
      s.remote = true;
      sendStart(true);
      if (state === 'end') room.send({ t: 'over', res: sim.results(), mode: sim.cfg.mode, gid });
    }
  });
  room.on('peer-left', m => {
    if (role === 'lobby-guest' || role === 'guest') {
      if (m.idx === 0) { leaveRoom(); startDemo(); info('Spiel beendet', 'Der Host hat den Raum verlassen.'); }
      else if (role === 'lobby-guest') renderLobby();
      return;
    }
    if (role === 'lobby-host') { renderLobby(); sendLobby(); }
    else if (role === 'host') {
      const s = sim.ships.find(x => x.seat === m.idx && !x.bot && !x.gone);
      if (s) { s.gone = true; s.alive = false; sendStart(true); }
    }
  });
  room.on('close', () => { leaveRoom(); startDemo(); info('Verbindung weg', 'Die Verbindung zum Spiel-Server ist abgebrochen.'); });
  room.on('leaderboard', rows => { if ($('end-board')) GameHub.renderBoard($('end-board'), rows, myName); });
}
function info(t, s) { $('info-t').textContent = t; $('info-s').textContent = s; showPanel('p-info'); }

async function hostRoom() {
  if (!HUB) return;
  readName();
  const st = $('online-status'); st.className = 'status'; st.textContent = 'Erstelle Raum …';
  room = GameHub.connect(GAME_ID); bindRoom();
  try {
    await room.create(myName, 4);
    role = 'lobby-host';
    history.replaceState(null, '', '#' + room.code);
    st.textContent = '';
    openLobby();
  } catch (e) { st.className = 'status err'; st.textContent = GameHub.errorText(e); if (room) room.close(); room = null; }
}
async function joinRoom(code) {
  if (!HUB) return;
  readName();
  const st = $('online-status');
  if (code.length !== 4) { st.className = 'status err'; st.textContent = 'Der Code hat 4 Zeichen.'; return; }
  st.className = 'status'; st.textContent = 'Verbinde …';
  room = GameHub.connect(GAME_ID); bindRoom();
  role = 'lobby-guest';
  try {
    await room.join(code, myName);
    st.textContent = '';
    openLobby();
  } catch (e) {
    role = 'demo'; st.className = 'status err'; st.textContent = GameHub.errorText(e);
    if (room) room.close(); room = null;
  }
}
function leaveRoom() {
  if (room) { room.close(); room = null; }
  cview = null;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
function openLobby() {
  if (role === 'host') role = 'lobby-host';
  if (role === 'guest') role = 'lobby-guest';
  if (role === 'lobby-host' && (!sim || !sim.cfg.demo)) startDemoKeepRole();
  state = 'menu';
  $('lb-code').textContent = room.code;
  const host = role === 'lobby-host';
  ['lb-mode', 'lb-n', 'lb-diff', 'lb-time'].forEach(id => $(id).querySelectorAll('button').forEach(b => { b.disabled = !host; }));
  $('btn-lobby-go').style.display = host ? '' : 'none';
  $('lobby-status').textContent = host ? 'Schick den Link an Freunde. Du kannst auch allein mit Bots starten.' : 'Warte, bis der Host das Spiel startet …';
  renderLobby();
  showPanel('p-lobby');
  if (host) sendLobby();
}
function startDemoKeepRole() { const r = role; startDemo(); role = r; }
function renderLobby() {
  if (!room) return;
  const names = room.players || [];
  $('lb-players').innerHTML = names.map((n, i) => n ? `<div style="color:${PCOLS_HEX[i]}"><i></i><span style="color:var(--text)">${esc(n)}${i === 0 ? ' <span class="tag">Host</span>' : ''}${i === room.you ? ' <span class="tag">Du</span>' : ''}</span></div>` : '').join('') +
    (lobbyCfg.bots ? `<div style="color:var(--muted)"><i></i><span>+ ${lobbyCfg.bots} Bot${lobbyCfg.bots > 1 ? 's' : ''} (${BOT_DIFF[lobbyCfg.diff].name})</span></div>` : '');
  setSeg('lb-mode', lobbyCfg.mode); setSeg('lb-n', String(lobbyCfg.bots)); setSeg('lb-diff', String(lobbyCfg.diff)); setSeg('lb-time', String(lobbyCfg.time));
  $('lb-timewrap').style.display = lobbyCfg.mode === 'versus' ? '' : 'none';
}
function sendLobby() { if (room && role === 'lobby-host') room.send({ t: 'lobby', cfg: lobbyCfg }); }

function hostStart() {
  resetWorld();
  gid++;
  role = 'host'; state = 'play'; paused = false;
  sim = new Sim({ mode: lobbyCfg.mode, time: lobbyCfg.time });
  const names = room.players || [];
  names.forEach((n, i) => {
    if (!n) return;
    const s = sim.addShip(n, null, i);
    if (i !== 0) s.remote = true;
  });
  for (let i = 0; i < lobbyCfg.bots; i++) sim.addShip(BOT_NAMES[i] + ' (Bot)', lobbyCfg.diff);
  mySlot = 0; FX.mySlot = 0;
  sim.ships[0].bombReq = sim.ships[0].bombDone = 0; Input.bombBase = Input.bombQ;
  if (lobbyCfg.mode === 'versus' && humansInRoom() >= 2) room.roundStart();
  sendStart(false);
  beginPlay();
  $('roombox').style.display = 'block'; $('rb-code').textContent = room.code;
}
function sendStart(update) {
  roster = sim.ships.map(s => ({ n: s.name, b: s.bot ? s.bot.lvl : -1, seat: s.seat }));
  room.send({ t: 'start', gid, cfg: sim.cfg, roster, update });
  buildHudCards();
}

function onGuestMsg(d, from) {
  if (d.t !== 'i' || role !== 'host' || !sim) return;
  const s = sim.ships.find(x => x.seat === from && !x.bot && !x.gone);
  if (!s) return;
  s.inp.mx = clamp(+d.mx || 0, -1, 1); s.inp.my = clamp(+d.my || 0, -1, 1);
  s.inp.aim = d.a == null ? null : d.a / 100; s.inp.fire = !!d.f;
  if (s.bombBase == null) s.bombBase = d.b | 0;
  s.bombReq = (d.b | 0) - s.bombBase;
  if (d.x != null && s.alive) { s.netX = +d.x; s.netY = +d.y; }
}

let guestMode = 'coop';
function onHostMsg(d) {
  switch (d.t) {
    case 'lobby':
      lobbyCfg = d.cfg;
      if (role === 'lobby-guest') renderLobby();
      break;
    case 'start': {
      const mine = d.roster.findIndex(r => r.seat === room.you);
      if (role === 'guest' && d.gid === gid && cview && state === 'play') {  // nur neue Spielerliste
        roster = d.roster; cview.setRoster(roster); buildHudCards();
        break;
      }
      if (mine < 0) break;
      gid = d.gid; roster = d.roster; guestMode = d.cfg.mode;
      resetWorld();
      role = 'guest'; state = 'play'; paused = false; sim = null;
      cview = new ClientView(roster, mine);
      mySlot = mine; FX.mySlot = mine;
      lobbyCfg = Object.assign(lobbyCfg, { mode: d.cfg.mode, time: d.cfg.time });
      beginPlay();
      $('roombox').style.display = 'block'; $('rb-code').textContent = room.code;
      break;
    }
    case 's':
      if (role !== 'guest' || !cview || d.gid !== gid) break;
      cview.applySnap(d, performance.now() / 1000);
      if (d.v) for (const ev of d.v) FX.handle(ev);
      break;
    case 'over':
      if (role !== 'guest' || d.gid !== gid) break;
      if (state === 'play') { state = 'end'; showEnd(d.res, d.mode); }
      break;
    case 'lobby-back':
      if (role === 'guest' || role === 'lobby-guest') { role = 'guest'; cview = null; openLobby(); startDemoKeepRole(); }
      break;
  }
}

// ---------- Simulation pro Schritt ----------
function stepSim() {
  if (mySlot >= 0 && sim.ships[mySlot] && (role === 'local' || role === 'host')) {
    const me = sim.ships[mySlot];
    const inp = Input.read(me.x, me.y, toWorld, STEP);
    me.inp.mx = inp.mx; me.inp.my = inp.my; me.inp.aim = inp.aim; me.inp.fire = inp.fire;
    me.bombReq = Input.bombQ - (Input.bombBase || 0);
  }
  sim.step();
  for (const ev of sim.ev) {
    FX.handle(ev);
    if (role === 'host') netEv.push(ev);
  }
  sim.ev.length = 0;
  if (role === 'host') {
    if (++snapTick % SNAP_EVERY === 0) {
      const snap = sim.snapshot();
      snap.t = 's'; snap.gid = gid; snap.v = netEv;
      room.send(snap);
      netEv = [];
    }
  }
  if (role === 'demo') {
    // Demo: Gegner nicht überhandnehmen lassen
    if (sim.t > 150) { sim.diffT = 60; sim.t = 60; }
  }
  if (sim.over && state === 'play') endGame();
}

function guestTick(dt, now) {
  const me = cview.ships[mySlot];
  const inp = me ? Input.read(me.x, me.y, toWorld, dt) : { mx: 0, my: 0, aim: null, fire: false };
  cview.update(dt, now, inp);
  inSendT -= dt;
  if (inSendT <= 0 && room) {
    inSendT = 1 / 20;
    room.send({ t: 'i', mx: +inp.mx.toFixed(2), my: +inp.my.toFixed(2), a: inp.aim == null ? null : Math.round(inp.aim * 100), f: inp.fire ? 1 : 0,
      b: Input.bombQ, x: me && me.alive ? Math.round(me.x) : null, y: me && me.alive ? Math.round(me.y) : null });
  }
}

// ---------- Kamera ----------
function targetZoom() {
  if (role === 'demo' || role === 'lobby-host' || role === 'lobby-guest') return Math.min(cssW / (AW + 60), cssH / (AH + 60)) * 1.12;
  return Math.min(cssW / 1300, cssH / 800);
}
function updateCamera(dt, v) {
  let tx = AW / 2, ty = AH / 2;
  const tz = targetZoom();
  camZ += (tz - camZ) * Math.min(1, dt * 3);
  const me = v && mySlot >= 0 ? v.ships[mySlot] : null;
  if (me && state === 'play') { tx = me.x; ty = me.y; }
  else if (v && role === 'demo') {
    // Demo: langsam um die Bots schwenken
    let n = 0, sx = 0, sy = 0;
    for (const s of v.ships) if (s.alive) { sx += s.x; sy += s.y; n++; }
    if (n) { tx = lerp(AW / 2, sx / n, 0.4); ty = lerp(AH / 2, sy / n, 0.4); }
  }
  const k = 1 - Math.exp(-dt * (state === 'play' ? 6 : 1.5));
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  const hw = cssW / 2 / camZ, hh = cssH / 2 / camZ, m = 90;
  camX = 2 * hw >= AW + 2 * m ? AW / 2 : clamp(camX, hw - m, AW - hw + m);
  camY = 2 * hh >= AH + 2 * m ? AH / 2 : clamp(camY, hh - m, AH - hh + m);
}

// ---------- Zeichnen ----------
function drawWorld(v) {
  const scale = Math.min(devicePixelRatio || 1, 2) * quality;
  R.resize(Math.round(cssW * scale), Math.round(cssH * scale));
  const sh = FX.shake;
  const ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
  R.camera(camX + ox, camY + oy, camZ * (R.W / cssW));
  R.begin();
  Gitter.draw(camX, camY);
  // Rand der Arena
  const bc = [0.55, 0.75, 1.9];
  R.seg(0, 0, AW, 0, 3.2, bc[0], bc[1], bc[2], 0.9); R.seg(AW, 0, AW, AH, 3.2, bc[0], bc[1], bc[2], 0.9);
  R.seg(AW, AH, 0, AH, 3.2, bc[0], bc[1], bc[2], 0.9); R.seg(0, AH, 0, 0, 3.2, bc[0], bc[1], bc[2], 0.9);
  if (!v) { Partikel.draw(); R.end(FX.flash, FX.tint, bloomOn); return; }
  // Geoms
  for (const g of v.geoms) {
    const blink = g.life < 1.5 ? (Math.sin(time * 30) > 0 ? 1 : 0.25) : 1;
    R.shape(SH_GEOM, g.x, g.y, time * 4 + g.x * 0.01, 7, 7, 1.6, [GEOM_COL[0] * 1.8, GEOM_COL[1] * 1.8, GEOM_COL[2] * 1.8], blink);
  }
  for (const e of v.enemies) drawEnemy(e);
  // Geschosse
  const multi = v.ships.length > 1;
  for (const b of v.bullets) {
    let c = [1.95, 1.8, 1.25];
    if (multi) { const p = PBRIGHT[b.o % PBRIGHT.length]; c = [(c[0] + p[0]) * 0.55, (c[1] + p[1]) * 0.55, (c[2] + p[2]) * 0.55]; }
    R.seg(b.x, b.y, b.x - b.vx * 0.013, b.y - b.vy * 0.013, 2.6, c[0], c[1], c[2], 1);
  }
  Partikel.draw();
  for (const s of v.ships) drawShip(s);
  for (const b of v.bombs) {
    const a = Math.max(0, 1 - b.r / 2300);
    R.circle(b.x, b.y, b.r, 96, 6, [1.2, 1.5, 2], a, 0);
    R.circle(b.x, b.y, b.r * 0.93, 96, 3, [0.6, 0.9, 2], a * 0.6, 0.03);
  }
  R.end(FX.flash, FX.tint, bloomOn);
}

function drawShip(s) {
  if (!s.alive || s.gone) return;
  const c = PBRIGHT[s.slot % PBRIGHT.length];
  let a = 1;
  if (s.inv > 0) a = Math.sin(time * 28) > 0 ? 1 : 0.3;
  R.shape(SH_SHIP, s.x, s.y, s.ang, 1.2, 1.2, 2.8, c, a);
  R.shape(SH_SHIP, s.x, s.y, s.ang, 0.55, 0.55, 1.4, [1.6, 1.6, 1.8], a * 0.6);
  // Zielrichtung als kleiner Punkt
  if (s.slot === mySlot && Input.aimMode !== 'keys') {
    const ax = s.x + Math.cos(s.aim) * 42, ay = s.y + Math.sin(s.aim) * 42;
    R.seg(ax, ay, ax, ay, 2.2, c[0], c[1], c[2], 0.5);
  }
}

function drawEnemy(e) {
  const c = BRIGHT[e.type];
  let a = 1, sc = 1;
  if (e.spawn > 0) { a = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(time * 32 + e.id)); sc = 1.35 + 0.15 * Math.sin(time * 9 + e.id); }
  const r = e.r * sc;
  switch (e.type) {
    case ET.WANDERER:
      for (let k = 0; k < 4; k++) R.shape(SH_BLADE, e.x, e.y, e.ang + k * Math.PI / 2, r, r, 2, c, a);
      break;
    case ET.SEEKER: {
      const p = Math.sin(time * 6 + e.id);
      R.shape(SH_DIAMOND, e.x, e.y, 0, r * (1 + p * 0.15), r * (1 - p * 0.15), 2.2, c, a);
      R.shape(SH_DIAMOND, e.x, e.y, 0, r * 0.45, r * 0.45, 1.5, c, a * 0.7);
      break;
    }
    case ET.PROTON:
      R.circle(e.x, e.y, r, 10, 2, c, a, e.ang);
      R.seg(e.x, e.y, e.x, e.y, 3, c[0], c[1], c[2], a);
      break;
    case ET.WEAVER: {
      R.shape(SH_SQUARE, e.x, e.y, e.ang, r, r, 2.2, c, a);
      const co = Math.cos(e.ang), si = Math.sin(e.ang), q = r * 0.72;
      R.seg(e.x + (-q * co + q * si), e.y + (-q * si - q * co), e.x + (q * co - q * si), e.y + (q * si + q * co), 1.6, c[0], c[1], c[2], a * 0.8);
      R.seg(e.x + (q * co + q * si), e.y + (q * si - q * co), e.x + (-q * co - q * si), e.y + (-q * si + q * co), 1.6, c[0], c[1], c[2], a * 0.8);
      break;
    }
    case ET.SPLITTER:
      R.shape(SH_SQUARE, e.x, e.y, e.ang, r, r, 2.3, c, a);
      R.shape(SH_SQUARE, e.x, e.y, -e.ang * 1.5 + Math.PI / 4, r * 0.62, r * 0.62, 1.7, c, a * 0.8);
      break;
    case ET.MINI:
      R.shape(SH_SQUARE, e.x, e.y, e.ang, r * 1.1, r * 1.1, 1.8, c, a);
      break;
    case ET.SNAKE: {
      const t = e.tail;
      if (t && !e.spawn) {
        let px = e.x, py = e.y;
        for (let i = 0; i < SNAKE_N; i++) {
          const x = t[i * 2], y = t[i * 2 + 1];
          const sz = 8.5 * (1 - i / SNAKE_N * 0.55);
          const an = Math.atan2(py - y, px - x);
          R.shape(SH_DIAMOND, x, y, an, sz, sz, 1.6, [TAIL_COL[0] * 1.7, TAIL_COL[1] * 1.7, TAIL_COL[2] * 1.7], a * (1 - i / SNAKE_N * 0.4));
          px = x; py = y;
        }
      }
      R.shape(SH_ARROW, e.x, e.y, e.ang, r * 1.1, r * 1.1, 2.4, c, a);
      break;
    }
    case ET.ROCKET:
      R.shape(SH_ROCKET, e.x, e.y, e.ang, r, r, 2.2, c, a);
      break;
    case ET.BLACKHOLE: {
      const p = 1 + 0.07 * Math.sin(time * 7 + e.id);
      const n = 28;
      R.circle(e.x, e.y, r * p, n, 2.8, c, a, e.ang);
      R.circle(e.x, e.y, r * 0.62 / p, n - 8, 2, [c[0], c[1] * 1.6, c[2] * 1.4], a * 0.85, -e.ang * 2);
      R.circle(e.x, e.y, r * 0.28, 10, 1.6, [1.9, 0.8, 0.6], a * 0.7, e.ang * 3);
      break;
    }
  }
}

// 2D-Ebene: Namen und schwebende Texte
function drawOverlay(v, dt) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (ovc.width !== Math.round(cssW * dpr) || ovc.height !== Math.round(cssH * dpr)) { ovc.width = Math.round(cssW * dpr); ovc.height = Math.round(cssH * dpr); }
  ov.setTransform(dpr, 0, 0, dpr, 0, 0);
  ov.clearRect(0, 0, cssW, cssH);
  if (!v || state !== 'play') return;
  const sx = x => (x - camX) * camZ + cssW / 2, sy = y => (y - camY) * camZ + cssH / 2;
  ov.textAlign = 'center'; ov.textBaseline = 'middle';
  if (v.ships.length > 1) {
    ov.font = '600 12px system-ui, sans-serif';
    for (const s of v.ships) {
      if (!s.alive || s.gone) continue;
      ov.fillStyle = PCOLS_HEX[s.slot % PCOLS_HEX.length];
      ov.globalAlpha = s.slot === mySlot ? 0.55 : 0.9;
      ov.fillText(s.slot === mySlot ? 'Du' : s.name, sx(s.x), sy(s.y) - 28);
    }
    ov.globalAlpha = 1;
  }
  ov.font = '800 15px system-ui, sans-serif';
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt; f.y -= 30 * dt;
    if (f.t <= 0) { floats.splice(i, 1); continue; }
    ov.globalAlpha = Math.min(1, f.t * 2);
    ov.fillStyle = f.col;
    ov.fillText(f.text, sx(f.x), sy(f.y));
  }
  ov.globalAlpha = 1;
}

// ---------- HUD ----------
let hudT = 0;
function buildHudCards() {
  const v = viewOf();
  const solo = (sim && sim.cfg.mode === 'solo') || false;
  $('players').innerHTML = '';
  $('players').style.display = solo ? 'none' : '';
  $('solostats').style.display = solo ? '' : 'none';
  $('timer').style.display = (sim ? sim.cfg.mode : guestMode) === 'versus' ? '' : 'none';
  if (solo || !v) return;
  $('players').innerHTML = v.ships.map((s, i) => `<div class="pc box${i === mySlot ? ' me' : ''}" id="pc${i}" style="--c:${PCOLS_HEX[i % PCOLS_HEX.length]}">` +
    `<div class="n"><b>${esc(s.name)}</b><span class="lv"></span></div><div><span class="s">0</span><span class="x">x1</span></div></div>`).join('');
}
function updateHud(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.1;
  const v = viewOf();
  if (!v || state !== 'play') return;
  const mode = sim ? sim.cfg.mode : guestMode;
  const me = v.ships[mySlot];
  if (me) {
    $('bigscore').textContent = fmtNum(me.score);
    $('bigmult').textContent = 'x' + me.mult;
    const w = weaponOf(me.mult);
    if (w > lastWeapon) notice('Waffe Stufe ' + (w + 1), ['', 'Dreifach-Schuss', 'Vierfach-Fächer', 'Fünffach-Fächer'][w], '#ffd84a');
    lastWeapon = w;
  }
  if (mode === 'solo' && me) {
    $('solostats').innerHTML = `Leben<b style="color:var(--p1)">${'▲'.repeat(Math.max(0, Math.min(me.lives, 9)))}</b>` +
      `Bomben<b style="color:var(--accent)">${'●'.repeat(Math.max(0, Math.min(me.bombs, 9)))}</b>`;
  } else {
    for (const s of v.ships) {
      const el = $('pc' + s.slot);
      if (!el) continue;
      el.querySelector('.s').textContent = fmtNum(s.score);
      el.querySelector('.x').textContent = 'x' + s.mult;
      el.querySelector('.lv').textContent = s.gone ? 'weg' : (mode === 'versus' ? '' : '▲'.repeat(Math.max(0, Math.min(s.lives, 9))) + ' ') + '●'.repeat(Math.max(0, Math.min(s.bombs, 9)));
      el.classList.toggle('dead', !s.alive);
    }
  }
  if (mode === 'versus') $('timer').textContent = fmtTime(sim ? sim.timeLeft : cview.tl);
  const rs = $('respawn');
  if (me && !me.alive) {
    rs.style.display = 'block';
    // Countdown nur für den, der wartet. Die anderen sehen davon nichts.
    const rev = me.revT > 0 || me.revWait ? Math.max(1, Math.ceil(me.revT)) : 0;
    rs.classList.toggle('rev', !!rev);
    if (rev) rs.innerHTML = `Wiederbelebung in<b>${rev}</b>${me.revT > 0 ? 'Überlebt dein Team so lange, bist du wieder dabei.' : 'Sobald ein Mitspieler lebt …'}`;
    else rs.textContent = mode === 'versus' || me.lives > 0 ? 'Gleich kommt dein nächstes Schiff …' : 'Keine Schiffe mehr. Du schaust den anderen zu.';
  } else rs.style.display = 'none';
  if (showFps) { $('fps').style.display = 'block'; $('fps').textContent = `${fpsVal | 0} FPS · ${R.stat.quads} Linien · ${Partikel.count} Partikel · ${v.enemies.length} Gegner · Qualität ${Math.round(quality * 100)}%${R.hdr ? ' · HDR' : ''}`; }
  else $('fps').style.display = 'none';
  Snd.intensity(0.3 + Math.min(0.7, v.enemies.length / 120));
}

// ---------- Leistung: Auflösung automatisch anpassen ----------
function perf(dt) {
  perfAcc += dt; perfN++;
  perfT += dt;
  if (perfT < 1) return;
  const avg = perfAcc / perfN;
  fpsVal = 1 / avg;
  perfAcc = 0; perfN = 0; perfT = 0;
  if (document.hidden) return;
  if (avg > 1 / 50 && quality > 0.55) { quality = Math.max(0.55, quality - 0.12); goodT = 0; }
  else if (avg < 1 / 57) { goodT++; if (goodT >= 4 && quality < 1) { quality = Math.min(1, quality + 0.08); goodT = 0; } }
  FX.quality = quality < 0.7 ? 0.7 : 1;
  Partikel.limit = quality < 0.7 ? 5000 : 9000;
}

// ---------- Hauptschleife ----------
function frame(ms) {
  requestAnimationFrame(frame);
  const now = ms / 1000;
  let dt = lastT ? now - lastT : STEP;
  lastT = now; frameLast = ms;
  if (dt > 0.1) dt = 0.1;
  perf(dt);
  if (Input.pauseQ) { Input.pauseQ = 0; if (state === 'play') setPause(!$('p-pause').classList.contains('on')); }
  const v0 = viewOf();
  if (!paused) {
    time += dt;
    if (sim && role !== 'guest') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { stepSim(); acc -= STEP; n++; }
      if (n >= 6) acc = 0;
    }
    if (role === 'guest' && cview && state === 'play') guestTick(dt, now);
    const v = viewOf();
    gridAcc += dt;
    let g = 0;
    while (gridAcc >= STEP && g < 4) {
      if (v) FX.continuous(STEP, v, time);
      Gitter.step();
      gridAcc -= STEP; g++;
    }
    if (g >= 4) gridAcc = 0;
    const holes = [];
    if (v) for (const e of v.enemies) if (e.type === ET.BLACKHOLE && !(e.spawn > 0)) holes.push(e.x, e.y, 1 + (e.absorb || 0) * 0.1);
    Partikel.update(dt, holes);
    FX.decay(dt);
  }
  const v = viewOf() || v0;
  updateCamera(dt, v);
  if (GL_OK) drawWorld(v);
  drawOverlay(v, paused ? 0 : dt);
  updateHud(dt);
}

// Im Hintergrund läuft requestAnimationFrame nicht – der Host rechnet dann per Timer weiter
setInterval(() => {
  if (role !== 'host' || !sim || state !== 'play') return;
  if (performance.now() - frameLast < 150) return;
  const n = 3;
  for (let i = 0; i < n; i++) stepSim();
}, 50);

// ---------- Fenster ----------
function onResize() { cssW = innerWidth; cssH = innerHeight; }
addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && role === 'local' && !paused) setPause(true); });

// ---------- Tasten ----------
Input.onKey = code => {
  Snd.unlock();
  if (code === 'KeyM') { const m = Snd.toggleMute(); $('btn-mute').textContent = m ? '🔇' : '🔊'; }
  if (code === 'KeyF' && state === 'play') showFps = !showFps;
  if ((code === 'Escape' || code === 'KeyP') && state === 'play') setPause(!$('p-pause').classList.contains('on'));
  else if (code === 'Escape' && $('p-bots').classList.contains('on')) showPanel('p-menu');
  else if (code === 'Escape' && $('p-online').classList.contains('on')) showPanel('p-menu');
};
addEventListener('pointerdown', () => Snd.unlock());

// ---------- Knöpfe ----------
function seg(id, onPick) {
  $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    onPick(b.dataset.v);
  }));
}
function setSeg(id, v) { $(id).querySelectorAll('button').forEach(x => x.classList.toggle('sel', x.dataset.v === v)); }
const botCfg = { mode: 'coop', bots: 2, diff: 1, time: 180 };
try { Object.assign(botCfg, JSON.parse(localStorage.getItem('gitter-krieg-bots') || '{}')); } catch (e) {}
function saveBotCfg() { try { localStorage.setItem('gitter-krieg-bots', JSON.stringify(botCfg)); } catch (e) {} }
function syncBotUi() {
  setSeg('bt-mode', botCfg.mode); setSeg('bt-n', String(botCfg.bots)); setSeg('bt-diff', String(botCfg.diff)); setSeg('bt-time', String(botCfg.time));
  $('bt-timewrap').style.display = botCfg.mode === 'versus' ? '' : 'none';
}
seg('bt-mode', v => { botCfg.mode = v; syncBotUi(); saveBotCfg(); });
seg('bt-n', v => { botCfg.bots = +v; saveBotCfg(); });
seg('bt-diff', v => { botCfg.diff = +v; saveBotCfg(); });
seg('bt-time', v => { botCfg.time = +v; saveBotCfg(); });
seg('lb-mode', v => { lobbyCfg.mode = v; renderLobby(); sendLobby(); });
seg('lb-n', v => { lobbyCfg.bots = +v; renderLobby(); sendLobby(); });
seg('lb-diff', v => { lobbyCfg.diff = +v; renderLobby(); sendLobby(); });
seg('lb-time', v => { lobbyCfg.time = +v; renderLobby(); sendLobby(); });

$('btn-solo').onclick = () => { readName(); Snd.unlock(); startLocal({ mode: 'solo' }); };
$('btn-bots').onclick = () => { readName(); syncBotUi(); showPanel('p-bots'); };
$('btn-bots-go').onclick = () => { Snd.unlock(); startLocal({ mode: botCfg.mode, bots: botCfg.bots, diff: botCfg.diff, time: botCfg.time }); };
$('btn-bots-back').onclick = () => showPanel('p-menu');
$('btn-online').onclick = () => {
  readName(); showPanel('p-online');
  if (HUB) GameHub.loadBoard(GAME_ID, $('online-board'), myName);
};
$('btn-online-back').onclick = () => showPanel('p-menu');
$('btn-host').onclick = () => { Snd.unlock(); hostRoom(); };
$('btn-join').onclick = () => joinRoom(HUB ? GameHub.cleanCode($('join-code').value) : '');
$('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-copy').onclick = () => {
  const link = inviteLink();
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
    () => { $('btn-copy').textContent = 'Kopiert ✓'; setTimeout(() => { $('btn-copy').textContent = 'Link kopieren'; }, 1500); },
    () => { $('btn-copy').textContent = link; });
};
$('btn-lobby-go').onclick = () => { Snd.unlock(); hostStart(); };
$('btn-lobby-leave').onclick = () => { leaveRoom(); toMenu(); };
$('btn-resume').onclick = () => setPause(false);
$('btn-pause').onclick = () => setPause(!$('p-pause').classList.contains('on'));
$('btn-pause-menu').onclick = () => { paused = false; if (room) { leaveRoom(); } toMenu(); };
$('btn-mute').onclick = () => { Snd.unlock(); const m = Snd.toggleMute(); $('btn-mute').textContent = m ? '🔇' : '🔊'; };
$('btn-again').onclick = () => {
  Snd.unlock();
  if (role === 'host') hostStart();
  else if (lastLocal) startLocal(lastLocal);
};
$('btn-end-menu').onclick = () => {
  if (role === 'host') {
    room.send({ t: 'lobby-back' });
    role = 'lobby-host'; sim = null; startDemoKeepRole(); openLobby();
    $('roombox').style.display = 'none';
  } else toMenu();
};
$('btn-info').onclick = () => toMenu();
$('btn-mute').textContent = Snd.muted ? '🔇' : '🔊';

// ---------- Start ----------
if (HUB) {
  const n = GameHub.getName(); if (n) $('name').value = n;
  loadHighscores($('menu-board'));
  const readInvite = () => {
    const code = GameHub.cleanCode(location.hash);
    if (code.length === 4 && !room) {
      $('join-code').value = code;
      showPanel('p-online');
      $('online-status').className = 'status';
      $('online-status').textContent = 'Einladung erhalten – Name prüfen und „Beitreten“ drücken.';
      GameHub.loadBoard(GAME_ID, $('online-board'), $('name').value);
    }
  };
  readInvite();
  addEventListener('hashchange', readInvite);
} else {
  $('btn-host').disabled = true; $('btn-join').disabled = true;
  $('online-status').textContent = 'Der Online-Modus geht nur auf langwiligi.site.';
}
if (!GL_OK) info('WebGL fehlt', 'Dein Browser kann leider kein WebGL. Bitte aktiviere die Hardware-Beschleunigung oder nimm einen anderen Browser.');
startDemo();
if (!location.hash || !HUB) showPanel('p-menu');
requestAnimationFrame(frame);
