'use strict';
// =====================================================================
//  Menüs: Titel, Spielstände, Lobby, Inventar, Weltwahl, Ergebnis, Pause, Game Over
// =====================================================================
const UI = {
  screen: 'titel', slots: [null, null, null, null], diff: store('diff') || 'normal', shownAt: 0,
  previews: [], lastDefs: null, invSel: 0, ask_: null,
};
window.UI = UI;
window.captureKeys = () => ['play', 'map', 'memory', 'ballon', 'toad', 'story'].includes(G.mode) || ['lobby', 'ergebnis'].includes(UI.screen);

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  UI.screen = id; UI.shownAt = performance.now();
  updatePauseKnopf();
  const f = id && document.querySelector('#' + id + ' .btn.haupt');
  if (f && id !== 'lobby') setTimeout(() => f.focus({ preventScroll: true }), 30);
}
function updatePauseKnopf() { $('pauseKnopf').classList.toggle('hidden', !(UI.screen === null && (G.mode === 'play' || G.mode === 'map'))); }
const ready = (ms = 450) => performance.now() - UI.shownAt > ms;
const OVERLAYS = ['inventar', 'kartenmenue', 'weltwahl', 'frage'];
UI.overlayOpen = () => UI.screen !== null || OVERLAYS.some(id => !$(id).classList.contains('hidden'));
function openOver(id) { for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id); const f = $(id).querySelector('.btn.haupt, .inv:not([disabled]), .welt:not([disabled])'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30); }
function closeOver() { for (const o of OVERLAYS) $(o).classList.add('hidden'); cv.focus && cv.focus(); }
UI.autosave = () => {
  if (!Prog.save) return;
  Prog.save.lives = Math.max(0, G.lives);
  Prog.save.diff = G.diffSet;
  writeSlot(Prog.slot, Prog.save);
};
UI.addInventory = kind => { if (Prog.save) Prog.save.inv[kind] = Math.min(20, (Prog.save.inv[kind] || 0) + 1); };

// ---------------------------------------------------------------------
//  Titel und Hilfe
// ---------------------------------------------------------------------
$('bSpielen').onclick = () => { audioUnlock(); showSlots(); };
$('bHilfe').onclick = () => show('hilfe');
$('bHilfeZurueck').onclick = () => show('titel');
$('figInfo').innerHTML = CHARS.map(c => `<div style="--f:${c.color}"><span><b>${c.name}</b> – ${c.desc}</span></div>`).join('');
$('itemInfo').innerHTML = Object.values(ITEM_INFO).map(i => `<div><span><b style="color:#ffd23a">${i.name}</b> – ${i.desc}</span></div>`).join('');

// ---------------------------------------------------------------------
//  Spielstände
// ---------------------------------------------------------------------
function showSlots() {
  const wrap = $('slotListe'); wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = loadSlot(i);
    const d = document.createElement('div'); d.className = 'slot';
    if (s) {
      Prog.save = s; Prog.worlds = {};
      const stars = Prog.starsTotal(), date = new Date(s.saved).toLocaleDateString('de-CH');
      const beat = s.beaten.length;
      d.innerHTML = `<b>Spielstand ${i + 1}</b><div class="sinfo">Welt ${s.world} · ${beat} ${beat === 1 ? 'Burg' : 'Burgen'} erobert<br>⭐ ${stars} Sternmünzen · ❤ ${s.lives}<br><span style="opacity:.7">${date}${s.story.ending ? ' · durchgespielt 👑' : ''}</span></div>
        <button class="btn haupt">Weiter</button><button class="btn klein">Löschen</button>`;
      d.querySelector('.haupt').onclick = () => chooseSlot(i, s);
      d.querySelector('.klein').onclick = () => { UI.askHtml(`Spielstand ${i + 1} wirklich löschen?`, 'Löschen', () => { deleteSlot(i); showSlots(); }); };
    } else {
      d.innerHTML = `<b>Spielstand ${i + 1}</b><div class="sinfo">Leer</div><button class="btn haupt">Neues Spiel</button>`;
      d.querySelector('.haupt').onclick = () => chooseSlot(i, null);
    }
    wrap.appendChild(d);
  }
  Prog.save = null;
  show('slots');
}
$('bSlotsZurueck').onclick = () => show('titel');
function chooseSlot(i, s) {
  Prog.slot = i; Prog.worlds = {};
  Prog.save = s || newSave();
  if (s && s.diff) UI.diff = s.diff;
  if (!s) Prog.save.lives = UI.diff === 'locker' ? 8 : UI.diff === 'knifflig' ? 3 : 5;
  openLobby();
}

// ---------------------------------------------------------------------
//  Lobby
// ---------------------------------------------------------------------
function openLobby() {
  show('lobby');
  renderLobby();
  for (const b of $('diffSeg').children) b.classList.toggle('on', b.dataset.d === UI.diff);
}
for (const b of $('diffSeg').children) b.onclick = () => { UI.diff = b.dataset.d; store('diff', UI.diff); for (const x of $('diffSeg').children) x.classList.toggle('on', x === b); SFX.select(); };
$('bLobbyZurueck').onclick = () => showSlots();
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
        <div class="pleer"><b>Frei</b>${i < 2 ? 'Springen-Taste drücken<br>oder hier klicken' : 'Gamepad: <b>A</b> drücken'}</div>`;
      d.onclick = () => { const sc = KB_SCHEMES.find(k => !UI.slots.some(x => x && x.scheme === k)); if (sc) join(sc); };
      UI.previews.push({ c: d.querySelector('canvas'), ch: null, i });
    }
    wrap.appendChild(d);
  });
  const n = UI.slots.filter(Boolean).length;
  $('bLos').disabled = !n;
  $('bLos').innerHTML = n > 1 ? `Los geht's! <small>${n} Spieler</small>` : `Los geht's!`;
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
  if (code === 'Escape') { showSlots(); return true; }
  return false;
}
function startFromLobby() {
  if (!ready(250)) return;
  let defs = UI.slots.filter(Boolean);
  if (!defs.length) { join('wasd'); defs = UI.slots.filter(Boolean); }
  UI.lastDefs = defs.map(d => ({ ...d }));
  startSession(UI.lastDefs);
}
function startSession(defs) {
  const n = defs.length;
  G.players = defs.map((d, i) => makePlayer({ ci: d.ci, schemes: n === 1 ? [...KB_SCHEMES, 'solo', 'pad0', 'pad1', 'pad2', 'pad3'] : [d.scheme] }, i));
  G.solo = n === 1;
  G.diffSet = UI.diff;
  G.lives = Prog.save.lives;
  G.totalJumps = 0; G.startPower = null;
  show(null);
  if (!Prog.save.story.intro) {
    Story.play(STORY.intro(), () => { Prog.save.story.intro = true; UI.autosave(); Karte.enter(Prog.save.world); updatePauseKnopf(); });
  } else { Karte.enter(Prog.save.world); updatePauseKnopf(); }
}

// ---------------------------------------------------------------------
//  Level starten und beenden
// ---------------------------------------------------------------------
UI.playNode = nd => {
  G.node = nd;
  G.starGot = [false, false, false];
  const r = Prog.save.done[nd.id];
  G.starPrev = r ? r.stars.slice() : [0, 0, 0];
  G.checkReached = false;
  for (const p of G.players) { p.ls = newStats(); if (p.state !== 'out') p.state = 'play'; }
  startLevel();
  updatePauseKnopf();
};
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
  const rng = makeRng((G.node ? Prog.levelSeed(G.node.id) : 1) + 31);
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
  drawHero(c.getContext('2d'), ch, { x: size / 2, y: size * .92, s: size / 115, face: 1, t: 1, state: 'goal', power });
  return c;
}
function statTable(s, p) {
  return `<table><tr><td>🪙 Münzen</td><td>${s.coins}</td></tr><tr><td>👟 Gegner</td><td>${s.stomps}</td></tr><tr><td>⭐ Sternmünzen</td><td>${s.stars}</td></tr><tr><td>🏆 Punkte</td><td>${p !== undefined ? p : s.score}</td></tr></table>`;
}
UI.levelClear = how => {
  const nd = G.node;
  const wasW9 = Prog.save.unlocked.includes(9), unlockedBefore = Prog.save.unlocked.slice();
  const secretBefore = Prog.save.done[nd.id] && Prog.save.done[nd.id].s;
  Prog.levelDone(nd.id, how === 'secret' ? 'secret' : 'normal', G.starGot);
  UI.after = { nd, how, newSecret: how === 'secret' && !secretBefore, newW9: !wasW9 && Prog.save.unlocked.includes(9), newWorlds: Prog.save.unlocked.filter(w => !unlockedBefore.includes(w) && w !== 9) };
  UI.autosave();
  setTimeout(() => {
    const aw = awardsFor(G.players, 'ls');
    $('ergTitel').textContent = how === 'secret' ? 'Geheimer Ausgang gefunden!' : how === 'final' ? 'Lunara ist gerettet!' : nd.type === 'burg' ? `${burgName(nd.world)} erobert!` : nd.type === 'turm' ? `Turm ${nd.world} erobert!` : `Level ${nd.title} geschafft!`;
    const r = Prog.save.done[nd.id];
    $('ergSterne').innerHTML = [0, 1, 2].map(i => `<span class="${r.stars[i] ? 'ja' : ''}">⭐</span>`).join('');
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
  if (!ready(700) || UI.screen !== 'ergebnis') return;
  for (const p of G.players) { for (const k in p.tot) p.tot[k] += p.ls[k]; p.ls = newStats(); }
  show(null);
  const { nd, how, newSecret, newW9, newWorlds } = UI.after;
  const n = nd.world;
  const lw = () => { if (window.LW && LW.rundeFertig) { try { LW.rundeFertig(); } catch (e) { } } };
  if (how === 'final' || (nd.type === 'burg' && WORLD_SPECS[n - 1].final)) {
    lw();
    Story.play(STORY.ending(Prog.w9Open()), () => { Prog.save.story.ending = true; Prog.save.world = NEW_FIRST; UI.autosave(); Karte.enter(NEW_FIRST); Karte.say(Prog.w9Open() ? 'Lunara ist gerettet! Neue Welten und die geheime Sternenwelt sind offen!' : 'Lunara ist gerettet! Vier neue Welten sind offen – „Welt wählen“ zeigt alle.', 5); updatePauseKnopf(); });
    return;
  }
  if (nd.type === 'burg') {
    lw();
    const spec = WORLD_SPECS[n - 1], nx = nextWorldOf(n);
    const back = (w, msg) => () => { Prog.save.world = w; UI.autosave(); Karte.enter(w); Karte.say(msg, 4); updatePauseKnopf(); };
    if (spec.sternFinale) Story.play(STORY.ende9(), back(9, 'Die Sternenwelt ist gerettet! Spielstand gespeichert.'));
    else if (spec.himmelFinale) Story.play(STORY.ende13(), back(13, 'Alle Welten sind gerettet! Sammelt weiter Sternmünzen und Geheimwege.'));
    else if (n >= NEW_FIRST) Story.play(STORY.castleNeu(n), back(nx, `Welt ${nx}: ${WORLD_SPECS[nx - 1].name} – Spielstand gespeichert!`));
    else Story.play(STORY.castle(n), back(nx, `Welt ${nx}: ${WORLD_SPECS[nx - 1].name} – Spielstand gespeichert!`));
    return;
  }
  Karte.enter(n);
  updatePauseKnopf();
  if (newWorlds && newWorlds.length) Karte.say(`Neue Welt freigeschaltet: ${WORLD_SPECS[newWorlds[0] - 1].name}! (Esc → Welt wählen)`, 4.5);
  else if (newW9) Karte.say('Alle Sternmünzen gefunden – die geheime Sternenwelt ist erschienen!', 4.5);
  else if (newSecret) Karte.say('Ein geheimer Weg ist erschienen!', 3.5);
  else if (nd.type === 'turm') Karte.say('Turm erobert! Spielstand gespeichert.', 3);
  else Karte.say('Geschafft – gespeichert!', 2);
}
$('bWeiter').onclick = () => nextFromResults();

// ---------------------------------------------------------------------
//  Game Over
// ---------------------------------------------------------------------
UI.gameOver = () => {
  for (const p of G.players) { for (const k in p.tot) p.tot[k] += p.ls[k]; p.ls = newStats(); }
  setTimeout(() => {
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
    show('ende');
    if (window.LW && LW.rundeFertig) { try { LW.rundeFertig(); } catch (e) { } }
  }, 900);
};
$('bNochmal').onclick = () => {
  const s = loadSlot(Prog.slot);
  if (s) { Prog.save = s; Prog.worlds = {}; }
  Prog.save.lives = Math.max(5, Prog.save.lives || 0);
  G.lives = Prog.save.lives;
  for (const p of G.players) { p.state = 'play'; setPower(p, 0); }
  UI.autosave();
  show(null);
  Karte.enter(Prog.save.world);
  updatePauseKnopf();
};
$('bEndeMenu').onclick = () => toMenu();

// ---------------------------------------------------------------------
//  Pause im Level
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
  updatePauseKnopf();
}
function toMenu() {
  Music.stop();
  if (AC) AC.resume();
  if (Prog.save) UI.autosave();
  closeOver();
  G.players = [];
  startAttract();
  show('titel');
}
$('bPWeiter').onclick = resume;
$('bPNeu').onclick = () => { show(null); if (AC) AC.resume(); for (const p of G.players) if (p.state === 'out') p.state = 'play'; startLevel(); updatePauseKnopf(); };
$('bPKarte').onclick = () => { show(null); if (AC) AC.resume(); Music.stop(); for (const p of G.players) { if (p.state !== 'play') { p.state = 'play'; setPower(p, 0); } } Prog.save.lives = Math.max(0, G.lives); Karte.enter(G.node.world); updatePauseKnopf(); };
$('bPMenu').onclick = toMenu;
$('pauseKnopf').onclick = () => { if (G.mode === 'play') pause(); else if (G.mode === 'map') openMapMenu(); $('pauseKnopf').blur(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------------
//  Weltkarte: Menü, Inventar, Weltwahl, Fragen
// ---------------------------------------------------------------------
function openMapMenu() {
  const [g, a] = Prog.starsWorld(Karte.W.n);
  $('kInfo').textContent = `Sternmünzen gesamt: ${Prog.starsTotal()} · verfügbar: ${Prog.starsFree()} · diese Welt: ${g}/${a}`;
  openOver('kartenmenue');
}
$('bKWeiter').onclick = closeOver;
$('bKInv').onclick = () => UI.openInventory();
$('bKWelt').onclick = () => openWorldSelect();
$('bKSpeichern').onclick = () => { UI.autosave(); closeOver(); Karte.say('Spielstand gespeichert!'); SFX.checkpoint(); };
$('bKMenu').onclick = () => toMenu();
const INV_ORDER = ['beere', 'bluete', 'frost', 'wirbel', 'eisbaer', 'stern'];
UI.openInventory = () => {
  const grid = $('invGrid'); grid.innerHTML = '';
  INV_ORDER.forEach((k, i) => {
    const n = Prog.save.inv[k] || 0;
    const b = document.createElement('button');
    b.className = 'inv' + (i === UI.invSel ? ' sel' : ''); b.disabled = !n;
    const c = document.createElement('canvas'); c.width = 144; c.height = 144;
    const g = c.getContext('2d'); g.translate(72, 112); g.scale(2, 2); drawItemIcon(g, k, 0);
    b.appendChild(c);
    b.insertAdjacentHTML('beforeend', `<b>${ITEM_INFO[k].name}</b><span class="anz">× ${n}</span>`);
    b.onclick = () => useItem(k);
    b.onmouseenter = () => { UI.invSel = i; markInv(); };
    grid.appendChild(b);
  });
  $('invInfo').textContent = G.startPower ? `Bereit: ${ITEM_INFO[G.startPower].name} (beim nächsten Level)` : 'Ein Extra wählen: alle Spieler werden sofort verwandelt (der Funkelstern wirkt beim Levelstart).';
  openOver('inventar');
  markInv();
};
function markInv() { [...$('invGrid').children].forEach((b, i) => b.classList.toggle('sel', i === UI.invSel)); const k = INV_ORDER[UI.invSel]; if (k) $('invInfo').textContent = `${ITEM_INFO[k].name}: ${ITEM_INFO[k].desc}`; }
function useItem(k) {
  if (!(Prog.save.inv[k] > 0)) { SFX.wrong(); return; }
  Prog.save.inv[k]--;
  if (k === 'stern') { if (G.startPower) Prog.save.inv[G.startPower]++; G.startPower = 'stern'; }
  else for (const p of G.players) applyPower(p, k);
  SFX.power(); closeOver();
  Karte.say(`${ITEM_INFO[k].name} eingesetzt!`);
}
$('bInvZu').onclick = closeOver;
function openWorldSelect() {
  const wrap = $('weltListe'); wrap.innerHTML = '';
  for (let n = 1; n <= WORLD_COUNT; n++) {
    const spec = WORLD_SPECS[n - 1], open = Prog.save.unlocked.includes(n);
    if (n === 9 && !open) continue;
    if (n >= NEW_FIRST + 1 && !open && !Prog.save.unlocked.includes(n - 1)) continue;
    const b = document.createElement('button'); b.className = 'welt'; b.disabled = !open;
    b.style.setProperty('--w1', spec.sky[0]); b.style.setProperty('--w2', spec.land[1]);
    const [g, a] = Prog.starsWorld(n);
    b.innerHTML = `<b>Welt ${n}</b>${open ? spec.name : '???'}<br>${open ? `⭐ ${g}/${a}${Prog.save.beaten.includes(n) ? ' · 🏰' : ''}` : '🔒'}`;
    b.onclick = () => { closeOver(); Karte.enter(n); };
    b.dataset.n = n;
    wrap.appendChild(b);
  }
  const btns = [...wrap.children];
  UI.worldSel = Math.max(0, btns.findIndex(b => +b.dataset.n === Karte.W.n && !b.disabled));
  openOver('weltwahl');
  markWorld();
}
// Auswahl in der Weltliste (Pfeiltasten, scrollt automatisch)
function markWorld() {
  const btns = [...$('weltListe').children];
  btns.forEach((b, i) => b.classList.toggle('sel', i === UI.worldSel));
  const cur = btns[UI.worldSel]; if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function moveWorld(dx, dy) {
  const btns = [...$('weltListe').children]; if (!btns.length) return;
  const step = dy ? dy * 3 : dx;
  let i = UI.worldSel + step;
  while (i >= 0 && i < btns.length && btns[i].disabled) i += step > 0 ? 1 : -1;
  if (i < 0 || i >= btns.length) { if (dy) { SFX.bump(); return; } i = clamp(UI.worldSel + step, 0, btns.length - 1); if (btns[i].disabled) return; }
  UI.worldSel = i; markWorld(); SFX.step();
}
$('bWeltZu').onclick = () => openMapMenu();
UI.ask = (text, yes, fn) => { $('frageText').textContent = text; $('bFrageJa').textContent = yes; UI.ask_ = fn; openOver('frage'); };
UI.askHtml = (text, yes, fn) => { UI.askScreen = UI.screen; UI.ask(text, yes, fn); };
$('bFrageJa').onclick = () => { const fn = UI.ask_; UI.ask_ = null; closeOver(); if (fn) fn(); };
$('bFrageNein').onclick = () => { UI.ask_ = null; closeOver(); };

// ---------------------------------------------------------------------
//  Ton
// ---------------------------------------------------------------------
function updateTon() { $('ton').textContent = muted ? '🔇' : '🔊'; }
$('ton').onclick = () => { audioUnlock(); setMuted(!muted); updateTon(); $('ton').blur(); };
updateTon();

// ---------------------------------------------------------------------
//  Tasten und Gamepads in den Menüs
// ---------------------------------------------------------------------
const isJump = code => KB_SCHEMES.some(k => SCHEMES[k].j.includes(code)) || code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
const isAct = code => KB_SCHEMES.some(k => SCHEMES[k].a.includes(code)) || code === 'KeyX' || code === 'KeyC';
const isL = code => KB_SCHEMES.some(k => SCHEMES[k].l.includes(code));
const isR = code => KB_SCHEMES.some(k => SCHEMES[k].r.includes(code));
const overOpen = id => !$(id).classList.contains('hidden');
keyListeners.push(code => {
  if (code === 'KeyM') { setMuted(!muted); updateTon(); return true; }
  if (G.mode === 'play' && (code === 'Escape' || code === 'KeyP')) { pause(); return true; }
  if (UI.screen === 'pause' && (code === 'Escape' || code === 'KeyP')) { resume(); return true; }
  if (UI.screen === 'lobby') return lobbyKey(code);
  if (UI.screen === 'ergebnis' && isJump(code)) { nextFromResults(); pressed.delete(code); return true; }
  if (UI.screen === 'hilfe' && code === 'Escape') { show('titel'); return true; }
  if (UI.screen === 'slots' && code === 'Escape') { show('titel'); return true; }
  if (G.mode === 'map' && UI.screen === null) {
    if (overOpen('frage')) {
      if (isJump(code)) $('bFrageJa').click(); else if (code === 'Escape' || isAct(code)) $('bFrageNein').click(); else return false;
      pressed.delete(code); return true;
    }
    if (overOpen('inventar')) {
      if (isL(code)) { UI.invSel = (UI.invSel + 5) % 6; markInv(); SFX.step(); }
      else if (isR(code)) { UI.invSel = (UI.invSel + 1) % 6; markInv(); SFX.step(); }
      else if (isJump(code)) useItem(INV_ORDER[UI.invSel]);
      else if (code === 'Escape' || isAct(code)) closeOver();
      else return false;
      pressed.delete(code); return true;
    }
    if (overOpen('weltwahl')) {
      const anyOf = k => KB_SCHEMES.some(sc => SCHEMES[sc][k].includes(code));
      if (anyOf('l')) moveWorld(-1, 0); else if (anyOf('r')) moveWorld(1, 0);
      else if (anyOf('j')) moveWorld(0, -1); else if (anyOf('d')) moveWorld(0, 1);
      else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { const b = $('weltListe').children[UI.worldSel]; if (b && !b.disabled) b.click(); }
      else if (code === 'Escape' || isAct(code)) closeOver();
      else return false;
      pressed.delete(code); return true;
    }
    if (overOpen('kartenmenue')) { if (code === 'Escape') { closeOver(); pressed.delete(code); return true; } return false; }
    if (code === 'Escape' || code === 'KeyP') { openMapMenu(); return true; }
  }
  return false;
});
padListeners.push((i, what) => {
  if (G.mode === 'play' && what === 's') { pause(); return true; }
  if (UI.screen === 'pause' && (what === 's' || what === 'j')) { resume(); return true; }
  if (UI.screen === 'titel' && (what === 'j' || what === 's')) { showSlots(); return true; }
  if (UI.screen === 'lobby') {
    const id = 'pad' + i, k = UI.slots.findIndex(x => x && x.scheme === id);
    if (what === 'j') { if (k < 0) join(id); else hop(k); }
    else if (k >= 0 && what === 'l') changeChar(k, -1);
    else if (k >= 0 && what === 'r') changeChar(k, 1);
    else if (k >= 0 && what === 'a') leave(k);
    else if (what === 's') startFromLobby();
    return true;
  }
  if (UI.screen === 'ergebnis' && (what === 'j' || what === 's')) { nextFromResults(); pads[i].jP = false; return true; }
  if (UI.screen === 'ende' && what === 's') { $('bNochmal').click(); return true; }
  if (G.mode === 'map' && UI.screen === null) {
    const P = pads[i];
    if (overOpen('frage')) { if (what === 'j') $('bFrageJa').click(); else if (what === 'a') $('bFrageNein').click(); P.jP = P.aP = false; return true; }
    if (overOpen('weltwahl')) {
      if (what === 'l') moveWorld(-1, 0); else if (what === 'r') moveWorld(1, 0);
      else if (what === 'j') { const b = $('weltListe').children[UI.worldSel]; if (b && !b.disabled) b.click(); }
      else if (what === 'a' || what === 's') closeOver();
      P.jP = P.aP = false; return true;
    }
    if (overOpen('inventar')) {
      if (what === 'l') { UI.invSel = (UI.invSel + 5) % 6; markInv(); } else if (what === 'r') { UI.invSel = (UI.invSel + 1) % 6; markInv(); }
      else if (what === 'j') useItem(INV_ORDER[UI.invSel]); else if (what === 'a' || what === 's') closeOver();
      P.jP = P.aP = false; return true;
    }
    if (what === 's') { if (overOpen('kartenmenue')) closeOver(); else openMapMenu(); return true; }
  }
  return false;
});

// ---------------------------------------------------------------------
//  Kleine Vorschauen (Titel, Lobby)
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
      g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, x, 240, 46 - hop * .4, 9); g.fill();
      drawHero(g, ch, { x, y: 238 - hop, s: 2.5, face: i < 2 ? 1 : -1, t: uiT + i, state: hop > 5 ? 'jump' : 'stand', power: 1, blink: (uiT + i) % 3.5 < .12 });
    });
  } else if (UI.screen === 'lobby') {
    for (const pv of UI.previews) {
      const g = pv.c.getContext('2d');
      g.clearRect(0, 0, 260, 260);
      if (pv.ch) {
        const hop = Math.max(0, Math.sin(uiT * 3 + pv.i)) * 18;
        g.fillStyle = 'rgba(0,0,0,.28)'; ell(g, 130, 238, 52, 10); g.fill();
        drawHero(g, pv.ch, { x: 130, y: 236 - hop, s: 2.6, face: 1, t: uiT + pv.i, state: hop > 3 ? 'jump' : 'stand', power: 1, blink: (uiT + pv.i) % 3 < .12 });
      } else { g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '120px ' + FONT; g.textAlign = 'center'; g.fillText('?', 130, 180); }
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
