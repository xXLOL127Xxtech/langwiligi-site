'use strict';
// =====================================================================
//  Menüs: Titel, Lobby, Weltkarte, Ergebnis, Pause, Ende
// =====================================================================
const HUB = window.GameHub || null;
const THEME_ICON = { wiese: ['🌼', '#5ed04a'], hoehle: ['💎', '#8a6cff'], wueste: ['🌵', '#f0b04a'], wolken: ['☁️', '#8fd3ff'], schnee: ['❄️', '#cfe6ff'], abend: ['🍂', '#ff7a6a'], burg: ['🌋', '#ff4a1a'] };
const UI = {
  screen: 'titel', slots: [null, null, null, null], diff: store('diff') || 'normal', shownAt: 0,
  previews: [], lastDefs: null, worldDone: false,
};
window.UI = UI;
window.captureKeys = () => G.mode === 'play' || ['lobby', 'karte', 'ergebnis'].includes(UI.screen);

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  UI.screen = id; UI.shownAt = performance.now();
  $('pauseKnopf').classList.toggle('hidden', id !== null || G.mode !== 'play');
  const f = id && document.querySelector('#' + id + ' .btn.haupt');
  if (f && id !== 'lobby') setTimeout(() => f.focus({ preventScroll: true }), 30);
}
const ready = (ms = 450) => performance.now() - UI.shownAt > ms;

// ---------------------------------------------------------------------
//  Titel
// ---------------------------------------------------------------------
$('bSpielen').onclick = () => { audioUnlock(); openLobby(); };
$('bHilfe').onclick = () => { show('hilfe'); };
$('bHilfeZurueck').onclick = () => show('titel');
$('figInfo').innerHTML = CHARS.map(c => `<div style="--f:${c.color}"><span><b>${c.name}</b> – ${c.desc}</span></div>`).join('');

// ---------------------------------------------------------------------
//  Lobby
// ---------------------------------------------------------------------
function openLobby() {
  if (!UI.slots.some(Boolean)) UI.slots = [null, null, null, null];
  show('lobby');
  renderLobby();
  for (const b of $('diffSeg').children) b.classList.toggle('on', b.dataset.d === UI.diff);
}
for (const b of $('diffSeg').children) b.onclick = () => { UI.diff = b.dataset.d; store('diff', UI.diff); for (const x of $('diffSeg').children) x.classList.toggle('on', x === b); SFX.select(); };
$('bLobbyZurueck').onclick = () => show('titel');
$('bLos').onclick = () => startFromLobby();

function freeChar(start, dir = 1, except = -1) {
  const taken = UI.slots.filter((s, i) => s && i !== except).map(s => s.ci);
  for (let k = 0; k < 4; k++) { const c = ((start + k * dir) % 4 + 4) % 4; if (!taken.includes(c)) return c; }
  return start;
}
function join(scheme) {
  if (UI.slots.some(s => s && s.scheme === scheme)) return;
  const i = UI.slots.findIndex(s => !s);
  if (i < 0) return;
  UI.slots[i] = { scheme, ci: freeChar(i) };
  SFX.join(); renderLobby(); hop(i);
}
function leave(i) { UI.slots[i] = null; SFX.select(); renderLobby(); }
function changeChar(i, d) {
  const s = UI.slots[i]; if (!s) return;
  s.ci = freeChar(((s.ci + d) % 4 + 4) % 4, d, i);
  SFX.select(); renderLobby(); hop(i);
}
function hop(i) { const el = $('plaetze').children[i]; if (el) { el.classList.remove('hops'); void el.offsetWidth; el.classList.add('hops'); } }
function renderLobby() {
  const wrap = $('plaetze');
  wrap.innerHTML = '';
  UI.previews = [];
  UI.slots.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'pkarte' + (s ? ' dabei' : '');
    if (s) {
      const ch = CHARS[s.ci];
      d.style.setProperty('--f', ch.color);
      d.innerHTML = `<div class="ptag">${PLAYER_TAG[i]}</div><canvas class="pfig" width="260" height="260"></canvas>
        <div class="pname"><button data-a="l" title="Figur wechseln">◀</button><span>${ch.name}</span><button data-a="r" title="Figur wechseln">▶</button></div>
        <div class="pfaehig">${ch.desc}</div><div class="psteuer">${SCHEMES[s.scheme].html}</div>
        <button class="pweg" title="Platz freigeben">✕</button>`;
      d.querySelector('[data-a=l]').onclick = e => { e.stopPropagation(); changeChar(i, -1); };
      d.querySelector('[data-a=r]').onclick = e => { e.stopPropagation(); changeChar(i, 1); };
      d.querySelector('.pweg').onclick = e => { e.stopPropagation(); leave(i); };
      UI.previews.push({ c: d.querySelector('canvas'), ch, i });
    } else {
      d.style.setProperty('--f', ['#4f8ff7', '#ef5350', '#3fbf5a', '#ffc531'][i]);
      d.innerHTML = `<div class="ptag">${PLAYER_TAG[i]}</div><canvas class="pfig" width="260" height="260" style="opacity:.25"></canvas>
        <div class="pleer"><b>Frei</b>Springen-Taste drücken<br>oder hier klicken</div>`;
      d.onclick = () => { const sc = KB_SCHEMES.find(k => !UI.slots.some(x => x && x.scheme === k)); if (sc) join(sc); };
      UI.previews.push({ c: d.querySelector('canvas'), ch: null, i });
    }
    wrap.appendChild(d);
  });
  $('bLos').disabled = !UI.slots.some(Boolean);
  $('bLos').innerHTML = UI.slots.filter(Boolean).length > 1 ? `Los geht's! <small>${UI.slots.filter(Boolean).length} Spieler</small>` : `Los geht's!`;
}
function lobbyKey(code) {
  for (const id of KB_SCHEMES) {
    const s = SCHEMES[id];
    const i = UI.slots.findIndex(x => x && x.scheme === id);
    if (s.j.includes(code)) { if (i < 0) join(id); else hop(i); return true; }
    if (i >= 0) {
      if (s.l.includes(code)) { changeChar(i, -1); return true; }
      if (s.r.includes(code)) { changeChar(i, 1); return true; }
      if (s.d.includes(code)) { leave(i); return true; }
      if (s.a.includes(code)) { startFromLobby(); return true; }
    }
  }
  if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { startFromLobby(); return true; }
  if (code === 'Escape') { show('titel'); return true; }
  return false;
}
function startFromLobby() {
  if (!ready(250)) return;
  let defs = UI.slots.filter(Boolean);
  if (!defs.length) { join('wasd'); defs = UI.slots.filter(Boolean); }
  UI.lastDefs = defs.map(d => ({ ...d }));
  newGame(UI.lastDefs);
}
function newGame(defs) {
  const n = defs.length;
  G.players = defs.map((d, i) => makePlayer({
    ci: d.ci,
    schemes: n === 1 ? [...KB_SCHEMES, 'solo', 'pad0', 'pad1', 'pad2', 'pad3'] : [d.scheme],
  }, i));
  G.solo = n === 1;
  G.diffSet = UI.diff;
  G.lives = UI.diff === 'locker' ? 6 + 2 * n : UI.diff === 'knifflig' ? 2 + n : 4 + 2 * n;
  G.seed = (Math.random() * 2 ** 31) >>> 0;
  G.world = 1; G.li = 0; G.totalJumps = 0;
  G.starGot = [false, false, false]; G.checkReached = false;
  UI.worldDone = false;
  showMap();
}

// ---------------------------------------------------------------------
//  Weltkarte
// ---------------------------------------------------------------------
function showMap() {
  if (G.mode !== 'attract') startAttract();
  $('karteTitel').textContent = UI.worldDone ? `Welt ${G.world - 1} geschafft! Auf in Welt ${G.world}` : `Welt ${G.world}`;
  $('weg').innerHTML = THEME_ORDER.map((k, i) => {
    const [ic, col] = THEME_ICON[k];
    const cls = i < G.li ? 'fertig' : i === G.li ? 'jetzt' : '';
    return `<div class="knoten ${cls}" style="--k:${col}"><i>${ic}</i><span>${G.world}-${i + 1}<br>${THEMES[k].name}</span></div>`;
  }).join('');
  const team = $('team'); team.innerHTML = '';
  UI.teamPrev = G.players.map(p => { const c = document.createElement('canvas'); c.width = 172; c.height = 172; team.appendChild(c); return { c, p }; });
  const coins = G.players.reduce((s, p) => s + p.tot.coins + p.ls.coins, 0);
  const score = G.players.reduce((s, p) => s + p.score, 0);
  $('karteInfo').innerHTML = `<span>❤ <b>${Math.max(0, G.lives)}</b> Leben</span><span>🪙 <b>${coins}</b> Münzen</span><span>⭐ <b>${score}</b> Punkte</span>`;
  show('karte');
}
function startLevelFromMap() {
  if (!ready()) return;
  show(null);
  G.starGot = [false, false, false]; G.checkReached = false;
  startLevel();
  $('pauseKnopf').classList.remove('hidden');
}
$('bKarteLos').onclick = () => startLevelFromMap();

// ---------------------------------------------------------------------
//  Ergebnis nach jedem Level
// ---------------------------------------------------------------------
const AWARDS = [
  { t: 'Blitzschnell', f: s => s.first, d: () => 'Als Erstes im Ziel' },
  { t: 'Sternenjäger', f: s => s.stars, d: v => v + (v > 1 ? ' Sternmünzen' : ' Sternmünze') + ' gefunden' },
  { t: 'Stampfprofi', f: s => s.stomps, d: v => v + ' Gegner erledigt' },
  { t: 'Münzmagnet', f: s => s.coins, d: v => v + ' Münzen gesammelt' },
  { t: 'Retter in Not', f: s => s.pops, d: v => v + (v > 1 ? ' Freunde' : ' Freund') + ' aus der Blase befreit' },
  { t: 'Kraftpaket', f: s => s.power, d: v => v + (v > 1 ? ' Extras' : ' Extra') + ' geschnappt' },
  { t: 'Unverwüstlich', f: s => s.deaths === 0 ? 1 : 0, d: () => 'Kein einziges Mal erwischt' },
  { t: 'Hüpfwunder', f: s => s.jumps, d: v => v + ' Sprünge' },
  { t: 'Draufgänger', f: s => s.deaths, d: v => v + ' Mal mutig ins Verderben' },
];
function awardsFor(players, key) {
  const rng = makeRng(levelSeed() + 31);
  const order = AWARDS.slice();
  for (let i = order.length - 1; i > 2; i--) { const j = 3 + Math.floor(rng.f() * (i - 2)); [order[i], order[j]] = [order[j], order[i]]; }
  const res = new Map();
  for (const a of order) {
    const free = players.filter(p => !res.has(p));
    if (!free.length) break;
    let best = -1, who = [];
    for (const p of free) { const v = a.f(p[key]); if (v > best) { best = v; who = [p]; } else if (v === best) who.push(p); }
    if (best > 0 && who.length === 1) res.set(who[0], { t: a.t, d: a.d(best) });
  }
  for (const p of players) if (!res.has(p)) res.set(p, { t: 'Teamgeist', d: 'Immer mit dabei' });
  return res;
}
function heroCanvas(ch, power, size = 200) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  drawHero(g, ch, { x: size / 2, y: size * .9, s: size / 110, face: 1, t: 1, state: 'goal', power });
  return c;
}
function statTable(s, p) {
  return `<table><tr><td>🪙 Münzen</td><td>${s.coins}</td></tr><tr><td>👟 Gegner</td><td>${s.stomps}</td></tr><tr><td>⭐ Sternmünzen</td><td>${s.stars}</td></tr><tr><td>🏆 Punkte</td><td>${p !== undefined ? p : s.score}</td></tr></table>`;
}
UI.levelClear = () => {
  setTimeout(() => {
    const aw = awardsFor(G.players, 'ls');
    $('ergTitel').textContent = G.li === THEME_ORDER.length - 1 ? `Welt ${G.world} geschafft!` : `Level ${G.world}-${G.li + 1} geschafft!`;
    $('ergSterne').innerHTML = G.starGot.map(x => `<span class="${x ? 'ja' : ''}">⭐</span>`).join('');
    const wrap = $('ekarten'); wrap.innerHTML = '';
    G.players.forEach((p, i) => {
      const a = aw.get(p);
      const d = document.createElement('div');
      d.className = 'ekarte'; d.style.setProperty('--f', p.color); d.style.animationDelay = (i * .12) + 's';
      d.innerHTML = `<div class="ptag">${PLAYER_TAG[i]} · ${p.ch.name}</div>`;
      d.appendChild(heroCanvas(p.ch, p.power));
      d.insertAdjacentHTML('beforeend', `<div class="preis">${a.t}</div><div class="pgrund">${a.d}</div>${statTable(p.ls)}`);
      wrap.appendChild(d);
    });
    show('ergebnis');
  }, 400);
};
function nextFromResults() {
  if (!ready(700)) return;
  for (const p of G.players) {
    for (const k in p.tot) p.tot[k] += p.ls[k];
    p.ls = newStats();
  }
  G.li++;
  UI.worldDone = false;
  if (G.li >= THEME_ORDER.length) {
    G.li = 0; G.world++; UI.worldDone = true;
    if (window.LW && LW.rundeFertig) { try { LW.rundeFertig(); } catch (e) { } }
  }
  showMap();
}
$('bWeiter').onclick = () => nextFromResults();

// ---------------------------------------------------------------------
//  Game Over
// ---------------------------------------------------------------------
UI.gameOver = () => {
  for (const p of G.players) { for (const k in p.tot) p.tot[k] += p.ls[k]; p.ls = newStats(); }
  setTimeout(() => {
    $('endeTitel').textContent = 'Game Over';
    const aw = awardsFor(G.players, 'tot');
    const wrap = $('endeKarten'); wrap.innerHTML = '';
    G.players.forEach((p, i) => {
      const a = aw.get(p);
      const d = document.createElement('div');
      d.className = 'ekarte'; d.style.setProperty('--f', p.color); d.style.animationDelay = (i * .12) + 's';
      d.innerHTML = `<div class="ptag">${PLAYER_TAG[i]} · ${p.ch.name}</div>`;
      d.appendChild(heroCanvas(p.ch, 0));
      d.insertAdjacentHTML('beforeend', `<div class="preis">${a.t}</div><div class="pgrund">${a.d}</div>${statTable(p.tot, p.score)}`);
      wrap.appendChild(d);
    });
    const reached = `Erreicht: Welt ${G.world}-${G.li + 1}`;
    wrap.insertAdjacentHTML('afterbegin', `<div class="hinweis" style="grid-column:1/-1;margin:0 0 4px;font-size:15px">${reached}</div>`);
    const hs = $('hsBox');
    hs.classList.toggle('hidden', !(HUB && G.solo));
    if (HUB && G.solo) {
      $('hsName').value = HUB.getName() || '';
      $('hsInfo').textContent = `${G.players[0].score} Punkte`;
      $('hsSenden').disabled = false;
      HUB.highscores(GAME_ID).then(rows => HUB.renderScores($('hsListe'), rows, HUB.getName(), { cols: [['score', 'Punkte']] })).catch(() => { });
    }
    show('ende');
    if (window.LW && LW.rundeFertig) { try { LW.rundeFertig(); } catch (e) { } }
  }, 900);
};
$('hsSenden').onclick = async () => {
  if (!HUB) return;
  const name = $('hsName').value.trim().slice(0, 16);
  if (!name) { $('hsInfo').textContent = 'Bitte einen Namen eingeben.'; return; }
  HUB.setName(name);
  $('hsSenden').disabled = true;
  const p = G.players[0];
  const jumps = G.totalJumps + ((G.world - 1) * 7 + G.li) * 30;
  const pts = Math.min(p.score, (jumps + 1) * 450);
  try {
    const res = await HUB.submitScore(GAME_ID, name, pts, { jumps });
    HUB.renderScores($('hsListe'), res.rows, name, { cols: [['score', 'Punkte']] });
    $('hsInfo').textContent = res.rank ? `Platz ${res.rank} von ${res.total}` : 'Eingetragen!';
  } catch (e) { $('hsInfo').textContent = HUB.errorText ? HUB.errorText(e) : 'Das hat nicht geklappt.'; $('hsSenden').disabled = false; }
};
$('bNochmal').onclick = () => { if (UI.lastDefs) newGame(UI.lastDefs); else openLobby(); };
$('bEndeMenu').onclick = () => toMenu();

// ---------------------------------------------------------------------
//  Pause
// ---------------------------------------------------------------------
function pause() {
  if (G.mode !== 'play') return;
  G.mode = 'paused';
  if (AC) AC.suspend();
  show('pause');
}
function resume() {
  if (G.mode !== 'paused') return;
  show(null);
  G.mode = 'play';
  if (AC && !muted) AC.resume();
  $('pauseKnopf').classList.remove('hidden');
}
function toMenu() {
  Music.stop();
  if (AC) AC.resume();
  G.players = [];
  startAttract();
  show('titel');
}
$('bPWeiter').onclick = resume;
$('bPNeu').onclick = () => { show(null); if (AC) AC.resume(); for (const p of G.players) if (p.state === 'out') p.state = 'play'; startLevel(); $('pauseKnopf').classList.remove('hidden'); };
$('bPMenu').onclick = toMenu;
$('pauseKnopf').onclick = () => pause();
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------------
//  Ton
// ---------------------------------------------------------------------
function updateTon() { $('ton').textContent = muted ? '🔇' : '🔊'; }
$('ton').onclick = () => { audioUnlock(); setMuted(!muted); updateTon(); $('ton').blur(); };
updateTon();

// ---------------------------------------------------------------------
//  Tasten und Gamepads in den Menüs
// ---------------------------------------------------------------------
const anyJump = code => KB_SCHEMES.some(k => SCHEMES[k].j.includes(code)) || code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
keyListeners.push(code => {
  if (code === 'KeyM') { setMuted(!muted); updateTon(); return true; }
  if (G.mode === 'play' && (code === 'Escape' || code === 'KeyP')) { pause(); return true; }
  if (UI.screen === 'pause' && (code === 'Escape' || code === 'KeyP')) { resume(); return true; }
  if (UI.screen === 'lobby') return lobbyKey(code);
  if (UI.screen === 'karte' && anyJump(code)) { startLevelFromMap(); return true; }
  if (UI.screen === 'ergebnis' && anyJump(code)) { nextFromResults(); return true; }
  if (UI.screen === 'hilfe' && code === 'Escape') { show('titel'); return true; }
  return false;
});
padListeners.push((i, what) => {
  if (G.mode === 'play' && what === 's') { pause(); return true; }
  if (UI.screen === 'pause' && (what === 's' || what === 'j')) { resume(); return true; }
  if (UI.screen === 'titel' && (what === 'j' || what === 's')) { openLobby(); join('pad' + i); return true; }
  if (UI.screen === 'lobby') {
    const id = 'pad' + i, k = UI.slots.findIndex(x => x && x.scheme === id);
    if (what === 'j') { if (k < 0) join(id); else hop(k); }
    else if (k >= 0 && what === 'l') changeChar(k, -1);
    else if (k >= 0 && what === 'r') changeChar(k, 1);
    else if (k >= 0 && what === 'a') leave(k);
    else if (what === 's') startFromLobby();
    return true;
  }
  if (UI.screen === 'karte' && (what === 'j' || what === 's')) { startLevelFromMap(); return true; }
  if (UI.screen === 'ergebnis' && (what === 'j' || what === 's')) { nextFromResults(); return true; }
  if (UI.screen === 'ende' && what === 's') { $('bNochmal').click(); return true; }
  return false;
});

// ---------------------------------------------------------------------
//  Kleine Vorschauen (Titel, Lobby, Karte)
// ---------------------------------------------------------------------
let uiT = 0;
UI.frame = dt => {
  uiT += dt;
  if (UI.screen === 'titel') {
    const c = $('titelHelden'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    CHARS.forEach((ch, i) => {
      const x = 130 + i * 220, ph = uiT * 2.2 + i * 1.3;
      const hop = Math.max(0, Math.sin(ph)) * 40;
      g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, x, 238, 46 - hop * .4, 9); g.fill();
      drawHero(g, ch, { x, y: 236 - hop, s: 2.6, face: i < 2 ? 1 : -1, t: uiT + i, state: hop > 5 ? 'jump' : 'stand', power: 1, blink: (uiT + i) % 3.5 < .12 });
    });
  } else if (UI.screen === 'lobby') {
    for (const pv of UI.previews) {
      const g = pv.c.getContext('2d');
      g.clearRect(0, 0, 260, 260);
      if (pv.ch) {
        const hop = Math.max(0, Math.sin(uiT * 3 + pv.i)) * 18;
        g.fillStyle = 'rgba(0,0,0,.28)'; ell(g, 130, 236, 52, 10); g.fill();
        drawHero(g, pv.ch, { x: 130, y: 234 - hop, s: 2.75, face: 1, t: uiT + pv.i, state: hop > 3 ? 'jump' : 'stand', power: 1, blink: (uiT + pv.i) % 3 < .12 });
      } else {
        g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '120px ' + FONT; g.textAlign = 'center'; g.fillText('?', 130, 180);
      }
    }
  } else if (UI.screen === 'karte' && UI.teamPrev) {
    for (const { c, p } of UI.teamPrev) {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 172, 172);
      const hop = Math.max(0, Math.sin(uiT * 3 + p.idx)) * 14;
      drawHero(g, p.ch, { x: 86, y: 160 - hop, s: 1.9, face: 1, t: uiT + p.idx, state: hop > 3 ? 'jump' : 'stand', power: p.power });
    }
  }
};

// ---------------------------------------------------------------------
//  Start
// ---------------------------------------------------------------------
resize();
startAttract();
show('titel');
requestAnimationFrame(frame);
if (document.fonts && document.fonts.load) document.fonts.load('20px "Lilita One"').catch(() => { });
