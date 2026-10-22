'use strict';
// Wanderlicht – Spielablauf: Steuerung, Kamera, Kampf, Orte, Oberfläche, Speichern

const GAME_ID = 'wanderlicht';
const SAVE_KEY = GAME_ID + '-save', SET_KEY = GAME_ID + '-settings';
const DAY_LEN = 960;
const $ = id => document.getElementById(id);

// ---------- Zustand ----------
const SET = { quality: 2, view: 1, sound: true, v: 3 };
let S = null;         // Spielstand
let P = null;         // Spielfigur
let playerModel = null;
const built = new Map(), impostors = new Map();
let enemies = [], orbs = [], rings = [], pickups = [];
const keys = {};
const cam = { yaw: 0, dist: 9, pitch: 0.18, manualT: 0, shake: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), restYaw: 0 };
let mode = 'title', prevMode = 'play';
let hudHidden = false, worldReady = false, readyFrames = 0;
let siteTick = 0, roamTick = 4, saveTick = 0, hitStop = 0;
let lastBiome = -1, biomeShowT = 0, bossShown = null;
let restInfo = null;
const _bw = new Float32Array(NB);

function loadSettings() {
  try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { /* egal */ }
  if ((SET.v | 0) < 3) { SET.v = 3; SET.quality = 2; }
  SET.quality = clamp(SET.quality | 0, 0, 2); SET.view = clamp(SET.view | 0, 0, 2);
}
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { /* egal */ } }

function freshState(seed) {
  return {
    v: 1, seed, spawn: null, pos: null, face: 0, hp: 100, gold: 20, splinters: 0, potions: 2,
    weapon: 0, armor: 0, up: { leben: 0, kraft: 0, tempo: 0 },
    disc: {}, opened: {}, cleared: {}, hints: {}, met: {}, names: {},
    fire: null, dayT: 0.735, weather: 5, weatherT: 150, kills: 0, dist: 0, deaths: 0,
  };
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.v === 1 && s.seed) return s; } catch (e) { /* egal */ }
  return null;
}
function saveGame() {
  if (!S || !P) return;
  const px = P.inCave ? P.inCave.mouth.x : P.x, pz = P.inCave ? P.inCave.mouth.z : P.z;
  S.pos = [Math.round(px * 10) / 10, Math.round(pz * 10) / 10]; S.face = P.face; S.hp = Math.round(P.hp);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* egal */ }
}

const maxHp = () => 100 + S.up.leben * 25;
const playerDmg = () => WEAPONS[S.weapon].dmg * (1 + S.up.kraft * 0.15);
const playerSpeed = () => 6.2 * (1 + S.up.tempo * 0.07);

// ---------- Welt starten ----------
function startWorld(state) {
  S = state;
  G.caveGround = null;
  for (const [, b] of built) unbuild(b);
  built.clear();
  for (const [, g] of impostors) disposeObj(g);
  impostors.clear();
  for (const e of enemies) e.remove();
  for (const o of orbs) o.remove();
  for (const r of rings) r.remove();
  for (const p of pickups) p.remove();
  enemies = []; orbs = []; rings = []; pickups = [];
  clearChunks();
  initWorld(S.seed, S.spawn);
  S.spawn = [World.spawnX, World.spawnZ];
  if (!S.fire) S.fire = [World.spawnX, World.spawnZ];
  const px = S.pos ? S.pos[0] : World.spawnX, pz = S.pos ? S.pos[1] : World.spawnZ;
  P = { x: px, z: pz, y: heightAt(px, pz), vx: 0, vz: 0, vy: 0, face: S.face || 0, hp: S.hp || 100, onGround: true,
    atkT: 0, atkCd: 0, hitDone: true, hurtCd: 0, dead: false, resting: false, moving: 0, stepT: 0, swim: false };
  P.hp = Math.min(P.hp, maxHp());
  if (playerModel) disposeObj(playerModel);
  playerModel = makePlayerModel(S.armor);
  playerModel.userData.parts.setWeapon(S.weapon);
  G.scene.add(playerModel);
  cam.yaw = P.face + Math.PI * 0.15;
  cam.pos.set(P.x - Math.sin(cam.yaw) * 9, P.y + 4, P.z - Math.cos(cam.yaw) * 9);
  worldReady = false; readyFrames = 0;
  lastBiome = -1;
  ATM.cur = Object.assign({}, WEATHERS[S.weather]);

  clearEyes();
}

// ---------- Eingabe ----------
const canvas = $('spiel');
let drag = null;
canvas.addEventListener('pointerdown', e => {
  Ton.start();
  if (e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.moved > 6 && (mode === 'play' || mode === 'rest')) {
    cam.yaw -= dx * 0.006;
    cam.pitch = clamp(cam.pitch + dy * 0.004, -0.55, 1.1);
    cam.manualT = 2.5;
  }
});
canvas.addEventListener('pointerup', e => {
  if (drag && drag.moved <= 6) {
    if (mode === 'play') attack();
    else if (mode === 'rest') endRest();
  }
  drag = null;
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* egal */ }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (mode === 'play' || mode === 'rest' || mode === 'title') { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 3.5, 16); cam.manualT = 1; }
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  Ton.start();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
  if (mode === 'panel') { panelKey(e, k); return; }
  if (mode === 'title') { if (k === 'Enter') $('btnStart').click(); return; }
  if (mode === 'dead') { if (k === 'Enter' || k === 'e' || k === ' ') respawn(); return; }
  if (mode === 'rest') { if (!e.repeat) endRest(); return; }
  if (e.repeat && ['e', 'q', 'f', 'Tab', 'Escape', 'm', 'h', ' '].includes(k)) { if (k !== ' ' && k !== 'f') return; }
  keys[k] = true;
  switch (k) {
    case 'f': case 'j': attack(); break;
    case ' ': jump(); break;
    case 'e': case 'Enter': interact(); break;
    case 'q': drinkPotion(); break;
    case 'b': toggleBroom(); break;
    case 'Tab': case 'i': openJournal(); break;
    case 'Escape': case 'p': openMenu(); break;
    case 'm': toggleSound(); break;
    case 'h': hudHidden = !hudHidden; document.body.classList.toggle('nohud', hudHidden); break;
  }
});
window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') openMenu(); });
window.addEventListener('resize', () => resizeGraphics());

function toggleSound() {
  SET.sound = !SET.sound; Ton.setOn(SET.sound); saveSettings();
  toast(SET.sound ? 'Ton an' : 'Ton aus');
  $('btnSound').textContent = SET.sound ? '♪' : '×';
}

// ---------- Spielfigur ----------
function toggleBroom() {
  if (P.dead || mode !== 'play' || P.inCave) return;
  if (P.broom) {
    P.broom = false; P.glide = true;
    toast('Du steigst vom Besen ab.');
    return;
  }
  if (P.swim || P.resting) return;
  P.broom = true; P.onGround = false; P.vy = 3; P.y += 0.3;
  burst(P.x, P.y + 0.6, P.z, 24, [1, 0.8, 0.5], 3, 0.18, 1, -1, 0.8);
  Ton.sfx('jump');
  if (!S.broomSeen) { S.broomSeen = true; card('Der Besen', 'Leertaste steigt, Shift sinkt, B steigt ab.'); }
  else toast('Besen: Leertaste steigen · Shift sinken · B absteigen');
}
function jump() {
  if (P.broom) return;
  if (!P.onGround || P.dead || P.swim) return;
  P.vy = 7.8; P.onGround = false; Ton.sfx('jump');
}
function attack() {
  if (P.dead || P.atkCd > 0 || mode !== 'play') return;
  if (P.broom) { if (!P.broomHint) { P.broomHint = true; toast('Zum Kämpfen erst vom Besen absteigen (B).'); } return; }
  P.atkT = 0.34; P.atkCd = 0.44; P.hitDone = false;
  // sanft zum nächsten Gegner drehen
  let best = null, bd = 5.5;
  for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = e; } }
  if (best) P.face = Math.atan2(best.x - P.x, best.z - P.z);
  Ton.sfx('swing');
}
function doHits() {
  const W = WEAPONS[S.weapon];
  const reach = W.len + 1.5;
  let any = false;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > reach + e.radius) continue;
    let da = Math.atan2(dx, dz) - P.face; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    if (Math.abs(da) > 1.15 && d > 1.2) continue;
    const crit = Math.random() < 0.12;
    const dmg = playerDmg() * (0.88 + Math.random() * 0.24) * (crit ? 1.8 : 1);
    e.hit(dmg, P.x, P.z, ctx);
    any = true;
    if (crit) burst(e.x, e.y + 1.4 * e.scale, e.z, 14, [1, 0.95, 0.7], 7, 0.25, 0.5);
  }
  if (any) { Ton.sfx('hit'); hitStop = 0.05; cam.shake = Math.max(cam.shake, 0.15); }
}
function drinkPotion() {
  if (P.dead || mode !== 'play') return;
  if (S.potions <= 0) { toast('Keine Heiltränke mehr'); return; }
  if (P.hp >= maxHp()) { toast('Du bist bei voller Kraft'); return; }
  S.potions--; P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.55);
  burst(P.x, P.y + 1, P.z, 24, [1, 0.5, 0.65], 3, 0.2, 1, -2, 1);
  Ton.sfx('drink');
}
function hurtPlayer(dmg, fx, fz) {
  if (P.dead || P.hurtCd > 0 || P.resting) return;
  const d = dmg * (1 - ARMORS[S.armor].def);
  P.hp -= d; P.hurtCd = 0.55;
  const dx = P.x - fx, dz = P.z - fz, l = Math.hypot(dx, dz) || 1;
  P.vx += dx / l * 9; P.vz += dz / l * 9;
  G.hurt = 0.55; cam.shake = Math.max(cam.shake, 0.35);
  burst(P.x, P.y + 1, P.z, 10, [0.9, 0.3, 0.4], 4, 0.2, 0.6);
  Ton.sfx('hurt');
  if (P.hp <= 0) die();
}
function die() {
  P.hp = 0; P.dead = true; mode = 'dead';
  S.deaths++;
  const lost = Math.floor(S.gold * 0.25);
  S.gold -= lost;
  Ton.sfx('death');
  $('deathLost').textContent = lost > 0 ? `${lost} Gold sind dir aus der Tasche gefallen.` : 'Du hattest nichts, was du verlieren konntest.';
  setTimeout(() => { if (mode === 'dead') show('death', true); }, 1400);
  saveGame();
  if (window.LW && LW.rundeFertig) { try { LW.rundeFertig(); } catch (e) { /* egal */ } }
}
function respawn() {
  show('death', false);
  if (P.inCave) leaveCave(true);
  P.dead = false; P.hp = maxHp();
  P.x = S.fire[0] + 2; P.z = S.fire[1] + 2; P.y = groundY(P.x, P.z) + 0.5; P.vx = P.vz = P.vy = 0;
  for (const e of enemies) if (!e.dead) { e.state = 'home'; }
  mode = 'play';
  G.fade = 1;
  toast('Du erwachst am Feuer. Die Welt hat gewartet.');
  saveGame();
}

// Höhe des begehbaren Bodens (Gelände oder Boden eines Gebäudes)
function walkY(x, z, yHint) {
  let best = groundY(x, z);
  if (P && P.inCave) return best;
  for (const [, b] of built) {
    if (!b.surfaces || !b.surfaces.length) continue;
    const s = b.site, rr = b.reach || 90;
    if (Math.abs(s.x - x) > rr || Math.abs(s.z - z) > rr) continue;
    for (const f of b.surfaces) {
      const dx = x - f.x, dz = z - f.z;
      const u = dx * f.c - dz * f.s, v = dx * f.s + dz * f.c;
      if (u > f.hx || u < -f.hx || v > f.hz || v < -f.hz) continue;
      const t = f.axis === 'x' ? (u + f.hx) / (2 * f.hx) : (v + f.hz) / (2 * f.hz);
      const y = f.ya + (f.yb - f.ya) * t;
      if (y <= yHint + 1.0 && y > best) best = y;
    }
  }
  return best;
}
// Raum, in dem ein Punkt liegt (für Decke, Licht und Kamera)
function roomAt(x, y, z) {
  for (const [, b] of built) {
    if (!b.rooms || !b.rooms.length) continue;
    const s = b.site, rr = b.reach || 90;
    if (Math.abs(s.x - x) > rr || Math.abs(s.z - z) > rr) continue;
    let best = null;
    for (const m of b.rooms) {
      if (y < m.yf - 0.3 || y > m.yc + 0.3) continue;
      const dx = x - m.cx, dz = z - m.cz, lx = dx * m.c - dz * m.s, lz = dx * m.s + dz * m.c;
      if (lx < m.lx0 || lx > m.lx1 || lz < m.lz0 || lz > m.lz1) continue;
      if (!best || m.yc - m.yf < best.yc - best.yf) best = m;
    }
    if (best) return best;
  }
  return null;
}
function updatePlayer(dt) {
  const parts = playerModel.userData.parts;
  P.atkCd = Math.max(0, P.atkCd - dt); P.hurtCd = Math.max(0, P.hurtCd - dt);
  let ix = 0, iz = 0;
  if (mode === 'play' && !P.dead) {
    if (keys.w) iz += 1; if (keys.s) iz -= 1; if (keys.a) ix -= 1; if (keys.d) ix += 1;
  }
  const fwdX = Math.sin(cam.yaw), fwdZ = Math.cos(cam.yaw), rgtX = -Math.cos(cam.yaw), rgtZ = Math.sin(cam.yaw);
  let mx = fwdX * iz + rgtX * ix, mz = fwdZ * iz + rgtZ * ix;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }
  const ground = groundY(P.x, P.z);
  P.swim = !P.inCave && !P.broom && ground < WATER - 0.9;
  const sprint = keys.Shift && !P.swim && !P.broom;
  let sp = playerSpeed() * (sprint ? 1.55 : 1) * (P.swim ? 0.55 : 1) * (P.atkT > 0 ? 0.45 : 1) * (P.broom ? 2.6 : 1);
  const tvx = mx * sp, tvz = mz * sp;
  const acc = Math.min(1, dt * (P.broom ? 2.6 : P.onGround ? 10 : 3));
  // Rückstoss klingt ab, Laufen wird angeglichen
  P.vx += (tvx - P.vx) * acc; P.vz += (tvz - P.vz) * acc;
  const ox = P.x, oz = P.z;
  P.x += P.vx * dt; P.z += P.vz * dt;
  collide(P, 0.45);
  const moved = Math.hypot(P.x - ox, P.z - oz);
  S.dist += moved;
  P.moving = ml > 0 ? Math.hypot(P.vx, P.vz) / playerSpeed() : 0;
  if (ml > 0 && P.atkT <= 0) {
    const ta = Math.atan2(mx, mz);
    let da = ta - P.face; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    P.face += da * Math.min(1, dt * 12);
  }
  // Höhe
  const gNow = walkY(P.x, P.z, P.y);
  if (P.broom) {
    const tgt = (keys[' '] ? 8 : 0) - (keys.Shift ? 8 : 0);
    P.vy += (tgt - P.vy) * Math.min(1, dt * 3);
    P.y += P.vy * dt;
    const fl = Math.max(gNow, WATER) + 1.1;
    if (P.y < fl) { P.y = fl; if (P.vy < 0) P.vy = 0; }
    P.y = Math.min(P.y, 700);
    P.onGround = false;
  } else {
    P.vy -= 24 * dt;
    if (P.glide) P.vy = Math.max(P.vy, -6);
    P.y += P.vy * dt;
    const floor = P.swim ? WATER - 1.05 : gNow;
    if (P.y <= floor) { P.y = floor; P.vy = 0; P.onGround = true; P.glide = false; } else if (P.y > floor + 0.25) P.onGround = false;
    if (P.swim && P.vy < 0 && P.y < WATER - 1.05) { P.y = WATER - 1.05; P.vy = 0; }
  }
  // Angriff
  if (P.atkT > 0) {
    P.atkT -= dt;
    if (!P.hitDone && P.atkT < 0.2) { P.hitDone = true; doHits(); }
  }
  // Spuren im Gras
  P.stepT -= dt;
  if (P.moving > 0.3 && P.onGround && P.stepT <= 0 && !P.swim) {
    P.stepT = sprint ? 0.12 : 0.22;
    const w = chunkW(P.x, P.z);
    let gr = 0; for (let b = 0; b < NB; b++) gr += w[b] * BIOMES[b].grass;
    if (gr > 0.3) { const B = BIOMES[dominantBiome(w)]; burst(P.x + (Math.random() - 0.5), P.y + 0.6, P.z + (Math.random() - 0.5), 1, B.tipC, 1.5, 0.12, 1.2, 1.5); }
  }
  if (P.swim && P.moving > 0.2 && Math.random() < dt * 8) burst(P.x, WATER + 0.1, P.z, 2, [0.8, 0.85, 1], 1.5, 0.15, 0.6, 4);
  // Modell
  const t = U.uTime.value;
  const dFace = P.face - (P.lastFace == null ? P.face : P.lastFace); P.lastFace = P.face;
  let dF = dFace; while (dF > Math.PI) dF -= 6.283; while (dF < -Math.PI) dF += 6.283;
  P.bank = (P.bank || 0) + (clamp(-dF / Math.max(dt, 0.001) * 0.18, -0.5, 0.5) - (P.bank || 0)) * Math.min(1, dt * 5);
  playerModel.position.set(P.x, P.y, P.z);
  playerModel.rotation.y = P.face;
  animatePlayer(dt, { moving: Math.min(1.2, P.moving), sprint, onGround: P.onGround, swim: P.swim, vy: P.vy, atkT: P.atkT, resting: P.resting, broom: P.broom, bank: P.bank });
  playerModel.visible = !(P.hurtCd > 0 && Math.floor(t * 20) % 2 === 0) && !(window.DEBUGCAM && window.DEBUGCAM.hide);
  if (P.broom && Math.random() < dt * 40) burst(P.x - Math.sin(P.face) * 1.3, P.y + 0.6, P.z - Math.cos(P.face) * 1.3, 1, [1, 0.8, 0.45], 0.6, 0.14, 0.9, -0.5, 0.2);
  // Heilen beim Rasten
  if (P.resting) P.hp = Math.min(maxHp(), P.hp + maxHp() * dt * 0.08);
}
function chunkW(x, z) {
  const ch = G.chunks.get(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
  return ch ? chunkWeights(ch, x, z, _bw) : weightsAt(x, z, _bw);
}

// ---------- Kollision ----------
function collideList(o, rad, list, oy) {
  for (const c of list) {
    if (c.top != null && oy > c.top) continue;
    if (c.y0 != null && (oy + 1.5 < c.y0 || oy > c.y1)) continue;
    if (c.ring) {
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r - rad;
      if (d > m) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; }
      continue;
    }
    let px, pz;
    if (c.seg) {
      const ex = c.bx - c.ax, ez = c.bz - c.az;
      const t = clamp(((o.x - c.ax) * ex + (o.z - c.az) * ez) / (ex * ex + ez * ez), 0, 1);
      px = c.ax + ex * t; pz = c.az + ez * t;
    } else { px = c.x; pz = c.z; }
    const dx = o.x - px, dz = o.z - pz, d = Math.hypot(dx, dz), m = c.r + rad;
    if (d < m && d > 1e-5) { o.x = px + dx / d * m; o.z = pz + dz / d * m; }
  }
}
const _cl = [];
function collide(o, rad) {
  const inCave = !!o.inCave;
  const oy = o.y == null ? 0 : o.y;
  for (const [, b] of built) {
    const s = b.site;
    if (Math.abs(s.x - o.x) > (b.reach || 90) || Math.abs(s.z - o.z) > (b.reach || 90)) continue;
    _cl.length = 0;
    for (const c of b.colliders) if (!!c.cave === inCave) _cl.push(c);
    collideList(o, rad, _cl, oy);
  }
  if (inCave) return;
  const ci = Math.floor(o.x / CHUNK), cj = Math.floor(o.z / CHUNK);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ch = G.chunks.get((ci + di) + ',' + (cj + dj));
    if (!ch) continue;
    if (ch.col.length) collideList(o, rad, ch.col, oy);
    if (ch.out && ch.out.colliders.length) collideList(o, rad, ch.out.colliders, oy);
  }
}
function clearGrass() { for (const [, gm] of G.grass) if (gm) disposeObj(gm); G.grass.clear(); }

// ---------- Kamera ----------
function updateCamera(dt) {
  if (window.DEBUGCAM) { const d = window.DEBUGCAM; G.camera.position.copy(d.pos); G.camera.lookAt(d.look); U.uCam.value.copy(d.pos); return; }
  if (mode === 'title') {
    cam.yaw += dt * 0.035;
    const d = 15;
    const tx = World.spawnX, tz = World.spawnZ, ty = groundY(tx, tz);
    cam.pos.set(tx - Math.sin(cam.yaw) * d, ty + 3.2, tz - Math.cos(cam.yaw) * d);
    cam.pos.y = Math.max(cam.pos.y, groundY(cam.pos.x, cam.pos.z) + 1.5);
    G.camera.position.copy(cam.pos);
    cam.look.set(tx, ty + 6, tz);
    G.camera.lookAt(cam.look);
    U.uCam.value.copy(cam.pos);
    return;
  }
  if (mode === 'play' && !P.dead) {
    if (keys.ArrowLeft) { cam.yaw += dt * 1.9; cam.manualT = 2.5; }
    if (keys.ArrowRight) { cam.yaw -= dt * 1.9; cam.manualT = 2.5; }
    if (keys.ArrowUp) cam.pitch = clamp(cam.pitch - dt * 0.9, -0.55, 1.1);
    if (keys.ArrowDown) cam.pitch = clamp(cam.pitch + dt * 0.9, -0.55, 1.1);
    if (keys['+'] || keys['=']) cam.dist = clamp(cam.dist - dt * 8, 3.5, 16);
    if (keys['-']) cam.dist = clamp(cam.dist + dt * 8, 3.5, 16);
    cam.manualT -= dt;
    // Kamera folgt sanft, wenn man vorwärts geht
    if (cam.manualT <= 0 && keys.w && P.moving > 0.3) {
      let da = P.face - cam.yaw; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      if (Math.abs(da) < 2.2) cam.yaw += da * Math.min(1, dt * 0.9);
    }
  }
  let dist = cam.dist, yaw = cam.yaw;
  let pitch = Math.max(0.04, cam.pitch), skyLook = Math.max(0, 0.04 - cam.pitch) * 28;
  if (mode === 'rest' && restInfo) {
    restInfo.t += dt;
    yaw = restInfo.yaw != null ? restInfo.yaw + Math.sin(restInfo.t * 0.08) * 0.35 : cam.yaw + restInfo.t * 0.04;
    dist = 10; pitch = 0.1; skyLook = 2;
  }
  if (P.inCave) dist = Math.min(dist, 7);
  let tx = P.x - Math.sin(yaw) * dist * Math.cos(pitch);
  let tz = P.z - Math.cos(yaw) * dist * Math.cos(pitch);
  let ty = P.y + 1.6 + Math.sin(pitch) * dist;
  ty = Math.max(ty, groundY(tx, tz) + 0.8, P.inCave ? -1e9 : WATER + 0.5);
  if (!P.inCave) {
    const tc = clipCamera(P.x, P.y + 1.6, P.z, tx, ty, tz);
    if (tc < 1) { tx = P.x + (tx - P.x) * tc; ty = P.y + 1.6 + (ty - P.y - 1.6) * tc; tz = P.z + (tz - P.z) * tc; }
  }
  if (P.inCave) {
    const cv = P.inCave.cave;
    ty = Math.min(ty, cv.y + cv.ceil - 2);
    const dx = tx - cv.x, dz = tz - cv.z, d = Math.hypot(dx, dz), lim = cv.R - 1;
    if (d > lim) { tx = cv.x + dx / d * lim; tz = cv.z + dz / d * lim; }
  }
  const k = Math.min(1, dt * 8);
  cam.pos.x += (tx - cam.pos.x) * k; cam.pos.y += (ty - cam.pos.y) * k; cam.pos.z += (tz - cam.pos.z) * k;
  G.camera.position.copy(cam.pos);
  if (cam.shake > 0) {
    G.camera.position.x += (Math.random() - 0.5) * cam.shake; G.camera.position.y += (Math.random() - 0.5) * cam.shake;
    cam.shake = Math.max(0, cam.shake - dt * 1.8);
  }
  const lookUp = (mode === 'rest' ? 3.5 : 1.5 + (1 - (dist - 3.5) / 12.5) * 0.4) + skyLook;
  cam.look.set(P.x, P.y + lookUp, P.z);
  G.camera.lookAt(cam.look);
  U.uCam.value.copy(G.camera.position);
}

// Kamera: nicht durch Wände, Stämme und Decken
const _cc = [];
function clipCamera(hx, hy, hz, tx, ty, tz) {
  _cc.length = 0;
  const reach = 22;
  for (const [, b] of built) {
    const s = b.site, rr = (b.reach || 90) + reach;
    if (Math.abs(s.x - hx) > rr || Math.abs(s.z - hz) > rr) continue;
    for (const c of b.colliders) if (!c.cave) _cc.push(c);
  }
  const ci = Math.floor(hx / CHUNK), cj = Math.floor(hz / CHUNK);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ch = G.chunks.get((ci + di) + ',' + (cj + dj)); if (!ch) continue; for (const c of ch.col) _cc.push(c); if (ch.out) for (const c of ch.out.colliders) _cc.push(c); }
  const room = roomAt(hx, hy, hz);
  const len = Math.hypot(tx - hx, ty - hy, tz - hz);
  const steps = Math.max(4, Math.ceil(len / 0.5));
  let tm = 1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, x = hx + (tx - hx) * t, y = hy + (ty - hy) * t, z = hz + (tz - hz) * t;
    if (len * t < 0.9) continue;
    let bad = false;
    if (room && (y > room.yc - 0.4 || y < room.yf + 0.3)) bad = true;
    if (!bad) for (const c of _cc) {
      const top = c.top != null ? c.top : c.y1, bot = c.y0 != null ? c.y0 : -1e9;
      if (top != null && y > top + 0.2) continue;
      if (y < bot - 0.2) continue;
      let px, pz;
      if (c.ring) continue;
      if (c.seg) { const ex = c.bx - c.ax, ez = c.bz - c.az, l2 = ex * ex + ez * ez; const k = clamp(((x - c.ax) * ex + (z - c.az) * ez) / l2, 0, 1); px = c.ax + ex * k; pz = c.az + ez * k; } else { px = c.x; pz = c.z; }
      const dd = (x - px) * (x - px) + (z - pz) * (z - pz), rr = c.r + 0.3;
      if (dd < rr * rr) { bad = true; break; }
    }
    if (bad) { tm = (i - 1) / steps; break; }
  }
  return Math.max(0.12, tm);
}

// ---------- Orte ----------
const siteState = {
  opened: k => !!S.opened[k],
  cleared: k => !!S.cleared[k],
};
function unbuild(b) {
  for (const e of b.enemies || []) if (!e.dead) e.remove();
  enemies = enemies.filter(e => !(b.enemies || []).includes(e) || e.dead);
  disposeObj(b.group);
}
function updateSites(dt, px, pz) {
  siteTick -= dt;
  if (siteTick <= 0) {
    siteTick = 0.35;
    const list = bigsNear(px, pz, 1450).concat(sitesNear(px, pz, 470));
    let builtOne = false;
    for (const s of list) {
      if (built.has(s.key) || builtOne) continue;
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d > (s.type === 'wahrzeichen' ? 1400 : 430)) continue;
      const b = buildSite(s, siteState);
      if (b.cave) b.onClink = () => { if (P.inCave === b && Math.random() < 0.5) Ton.sfx('clink'); };
      b.enemies = [];
      for (const sp of b.spawns) {
        const e = new Enemy(sp.type, sp.x, sp.z, s.level, { boss: sp.boss, name: sp.name, site: s, homeX: sp.x, homeZ: sp.z, seed: hash2(Math.round(sp.x), Math.round(sp.z), 3) });
        e.y = groundY(e.x, e.z);
        b.enemies.push(e); enemies.push(e);
      }
      built.set(s.key, b);
      builtOne = true;
    }
    // ferne Schloss-Silhouetten
    const uR = VIEW_SETTINGS[G.view].ultraR;
    const seen = new Set();
    for (const L of bigsNear(px, pz, uR)) {
      seen.add(L.key);
      if (!built.has(L.key) && !impostors.has(L.key)) impostors.set(L.key, buildImpostor(L));
    }
    for (const [k, g] of impostors) if (!seen.has(k) || built.has(k)) { disposeObj(g); impostors.delete(k); }
    for (const [key, b] of built) {
      const d = Math.hypot(b.site.x - px, b.site.z - pz);
      if (d > (b.site.type === 'wahrzeichen' ? 1650 : 600) && P.inCave !== b) { unbuild(b); built.delete(key); }
    }
  }
  // Fackeln und Feuer: die vier nächsten leuchten wirklich
  P.safe = false;
  const near4 = [];
  for (const [, b] of built) {
    for (const u of b.updaters) u(dt);
    const s = b.site, d = Math.hypot(s.x - px, s.z - pz);
    for (const f of b.fires) {
      const dd = (f.x - px) * (f.x - px) + (f.y - (P.y + 1)) * (f.y - (P.y + 1)) + (f.z - pz) * (f.z - pz);
      if (dd > 2500) continue;
      if (near4.length < 4) { near4.push([dd, f]); near4.sort((p, q) => p[0] - q[0]); }
      else if (dd < near4[3][0]) { near4[3] = [dd, f]; near4.sort((p, q) => p[0] - q[0]); }
    }
    if ((s.type === 'lager' || s.type === 'ritter') && d < 16) P.safe = true;
    if (mode === 'play' && !S.disc[s.key] && s.discR > 0 && d < s.discR) discover(s);
    if (b.gate && mode === 'play') {
      const g = b.gate;
      const ln = (P.x - g.x) * g.nx + (P.z - g.z) * g.nz, lt = (P.x - g.x) * g.tx + (P.z - g.z) * g.tz;
      const side = ln > 0 ? 1 : -1;
      if (g.prev != null && side !== g.prev && Math.abs(lt) < 7.5 && Math.abs(ln) < 3) passGate(b);
      g.prev = side;
    }
    // Burg befreit?
    if ((s.type === 'burg' || s.type === 'wahrzeichen') && !S.cleared[s.key] && b.enemies.length && b.enemies.every(e => e.dead)) {
      S.cleared[s.key] = 1;
      for (const c of b.chests) c.locked = false;
      card(s.name, s.type === 'wahrzeichen' ? 'Die Feste ist gefallen. Zum ersten Mal seit Ewigkeiten sieht man hier Sterne.' : 'Die Burg ist befreit. Stille kehrt zurück.');
      Ton.sfx('discover');
      saveGame();
    }
  }
  for (let i = 0; i < G.torches.length; i++) {
    const l = G.torches[i], e = near4[i];
    if (e) { const f = e[1]; l.position.set(f.x, f.y + 0.4, f.z); l.color.copy(f.col); l.intensity = (1.0 + Math.random() * 0.45) * (0.5 + Math.min(f.size, 1.6) * 0.55); l.distance = 12 + f.size * 7; }
    else l.intensity = 0;
  }
}
function siteSub(s) {
  if (s.type === 'wunder' || s.type === 'wahrzeichen' || s.type === 'lichtung') return s.sub;
  if (s.type === 'hoehle') return s.cave === 'kristall' ? 'Aus der Tiefe flackert ein kaltes Licht.' : 'Tief unten hämmert es, und die Luft ist warm.';
  if (s.type === 'ritter') return 'Müde Rüstungen, warme Geschichten.';
  if (s.type === 'burg') return s.content === 'boss' ? 'Etwas Grosses schläft hinter diesen Mauern.' : s.content === 'wachen' ? 'Die Mauern sind nicht so leer, wie sie scheinen.' : 'Verlassen seit Jahrhunderten. Nur der Wind wohnt hier.';
  if (s.type === 'lager') return 'Ein warmes Feuer und ein offenes Ohr.';
  if (s.type === 'aussicht') return 'Setz dich. Die Welt läuft nicht weg.';
  return '';
}
function discover(s) {
  S.disc[s.key] = 1;
  S.names[s.key] = [s.type, s.name, Math.round(s.x), Math.round(s.z)];
  card(s.name, siteSub(s));
  Ton.sfx(s.wonder === 'wal' ? 'wal' : 'discover');
  if (s.type === 'wunder') {
    S.splinters++;
    setTimeout(() => toast('✦ Ein Sternensplitter glimmt in deiner Hand.'), 1800);
    burst(P.x, P.y + 1.5, P.z, 30, [0.85, 0.9, 1], 3, 0.2, 2, -1, 1);
  }
  if (s.type === 'aussicht') { P.hp = maxHp(); }
  saveGame();
}
function passGate(b) {
  if (b.gate.moon) {
    G.flash = 0.8;
    Ton.sfx('gate');
    P.hp = maxHp();
    burst(P.x, P.y + 1.5, P.z, 50, [0.8, 0.9, 1], 4, 0.22, 1.8, -1, 2);
    const k = b.site.key + ':segen';
    if (!S.opened[k]) { S.opened[k] = 1; S.splinters += 2; card('Der Segen des Mondes', 'Zwei Sternsplitter leuchten in deiner Hand.'); saveGame(); }
    else toast('Das Mondlicht heilt deine Wunden.');
    return;
  }
  S.dayT = (S.dayT + 0.5) % 1;
  G.flash = 1.2;
  Ton.sfx('gate');
  card('Das Mondtor', ATM.night > 0.5 ? 'Auf der anderen Seite ist es Tag.' : 'Auf der anderen Seite ist es Nacht.');
  void b;
}

// ---------- Gegner ----------
const ctx = {
  collide, hurtPlayer,
  sfx: (n, v) => Ton.sfx(n, v),
  shake: a => { cam.shake = Math.max(cam.shake, a); },
  spawnRing: (e, r, t) => rings.push(new Ring(e.x, e.z, r, t)),
  spawnOrb: (x, y, z, vx, vz, d) => orbs.push(new Orb(x, y, z, vx, vz, d)),
  onBossAggro: e => { bossShown = e; $('bossName').textContent = e.name; show('bossbar', true); Ton.sfx('boss'); },
  onKill: e => {
    S.kills++;
    Ton.sfx('kill');
    const lvl = e.level;
    const g = Math.round((e.def.gold[0] + Math.random() * (e.def.gold[1] - e.def.gold[0])) * (0.8 + lvl * 0.3) * (e.boss ? 10 : 1));
    let left = g;
    const coins = e.boss ? 18 : Math.min(8, 2 + Math.floor(g / 5));
    for (let i = 0; i < coins; i++) { const v = i === coins - 1 ? left : Math.max(1, Math.floor(g / coins)); left -= v; if (v > 0) pickups.push(new Pickup('gold', e.x, e.y + 1, e.z, v)); }
    if (Math.random() < (e.boss ? 1 : 0.12)) pickups.push(new Pickup('trank', e.x, e.y + 1, e.z, 1));
    if (e.boss) {
      if (e.site) {
        S.cleared[e.site.key] = 1;
        const b = built.get(e.site.key);
        if (b) for (const c of b.chests) c.locked = false;
      }
      for (let i = 0; i < 2; i++) pickups.push(new Pickup('splitter', e.x, e.y + 1.5, e.z, 1));
      setTimeout(() => card(e.name, 'ist besiegt. Die Truhe öffnet ihr Schloss.'), 900);
      if (bossShown === e) { bossShown = null; show('bossbar', false); }
    } else if (Math.random() < 0.04) pickups.push(new Pickup('splitter', e.x, e.y + 1.5, e.z, 1));
  },
  collect: p => {
    if (p.kind === 'gold') { S.gold += p.value; Ton.sfx('coin'); }
    else if (p.kind === 'trank') { S.potions++; toast('Heiltrank gefunden'); Ton.sfx('buy'); }
    else { S.splinters++; toast('✦ Sternensplitter gefunden'); Ton.sfx('upgrade'); }
  },
};
function roamSpawn(dt) {
  roamTick -= dt;
  if (roamTick > 0) return;
  roamTick = 5 + Math.random() * 5;
  const roaming = enemies.filter(e => !e.site && !e.dead).length;
  const night = ATM.night, storm = ATM.cur.storm;
  const max = Math.round(1 + night * 3 + storm * 2 + (ATM.blood || 0) * 3);
  const dSpawn = Math.hypot(P.x - World.spawnX, P.z - World.spawnZ);
  if (roaming >= max || dSpawn < 140 || P.resting || P.inCave) return;
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * 6.283, d = 38 + Math.random() * 25;
    const x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
    if (groundY(x, z) < 0.3) continue;
    if (sitesNear(x, z, 45).some(s => s.type === 'lager' || s.type === 'wanderer')) continue;
    const w = weightsAt(x, z, new Float32Array(NB)), bi = dominantBiome(w);
    let type = night > 0.5 || storm > 0.5 ? 'schatten' : 'dornling';
    if ((bi === 3 || bi === 6) && Math.random() < 0.3) type = 'ritter';
    if (bi === 4 && Math.random() < 0.4) type = 'waechter';
    const lvl = 1 + Math.hypot(x - World.spawnX, z - World.spawnZ) / 700;
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) enemies.push(new Enemy(type, x + i * 2, z + i, lvl, {}));
    return;
  }
}
function updateEnemies(dt) {
  if (P.inCave) dt = 0;
  for (const e of enemies) {
    if (!e.site && Math.hypot(e.x - P.x, e.z - P.z) > 120) e.remove();
    if (!e.gone) e.update(dt, P, ctx);
  }
  enemies = enemies.filter(e => !e.gone);
  for (const o of orbs) o.update(dt, P, ctx);
  orbs = orbs.filter(o => !o.gone);
  for (const r of rings) r.update(dt);
  rings = rings.filter(r => !r.gone);
  for (const p of pickups) p.update(dt, P, ctx);
  pickups = pickups.filter(p => !p.gone);
  if (bossShown) {
    $('bossFill').style.width = Math.max(0, bossShown.hp / bossShown.maxHp * 100) + '%';
    if (bossShown.dead || bossShown.gone || Math.hypot(bossShown.x - P.x, bossShown.z - P.z) > 50 || bossShown.state === 'home') { bossShown = null; show('bossbar', false); }
  }
}

// ---------- Interaktion ----------
let nearI = null;
const prayed = {};
function findInteract() {
  nearI = null;
  if (mode !== 'play' || P.dead || P.broom) return;
  let bd = 1e9;
  const pci = Math.floor(P.x / CHUNK), pcj = Math.floor(P.z / CHUNK);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ch = G.chunks.get((pci + di) + ',' + (pcj + dj));
    if (!ch) continue;
    if (ch.shrines) for (const sh of ch.shrines) {
      const d = Math.hypot(sh.x - P.x, sh.z - P.z);
      if (d < 2.6 && d < bd) { bd = d; nearI = { it: { kind: 'shrine', x: sh.x, z: sh.z, sh }, b: null }; }
    }
    if (ch.out) for (const it of ch.out.interact) {
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < it.r && d < bd) {
        if (it.kind === 'chest' && it.chest.opened) continue;
        bd = d; nearI = { it, b: ch.out };
      }
    }
  }
  const inCave = !!P.inCave;
  for (const [, b] of built) for (const it of b.interact) {
    if (!!it.cave !== inCave) continue;
    if (it.y != null && Math.abs(it.y - P.y) > 3.2) continue;
    const d = Math.hypot(it.x - P.x, it.z - P.z);
    if (d < it.r && d < bd) {
      if (it.kind === 'chest' && it.chest.opened) continue;
      bd = d; nearI = { it, b };
    }
  }
}
function interactLabel(n) {
  const it = n.it;
  switch (it.kind) {
    case 'chest': return it.chest.locked ? 'Verschlossene Truhe' : 'Truhe öffnen';
    case 'shop': return 'Mit ' + it.name + ' handeln';
    case 'fire': return 'Am Feuer rasten';
    case 'rest': return it.label;
    case 'lore': return it.label;
    case 'view': return 'Auf der Bank rasten';
    case 'npc': return 'Mit ' + n.b.site.npc + ' sprechen';
    case 'lantern': return it.label;
    case 'shrine': return 'Am Schrein innehalten';
    case 'ring': return 'Im Pilzring verweilen';
    case 'quelle': return 'Eine Münze in die Quelle werfen';
    case 'cave': case 'caveExit': case 'feen': return it.label;
  }
  return '';
}
function interact() {
  if (!nearI || mode !== 'play') return;
  const { it, b } = nearI;
  switch (it.kind) {
    case 'chest': openChest(it.chest, b); break;
    case 'shop': openShop(it.name); break;
    case 'fire':
      S.fire = [it.x, it.z];
      startRest(null, 'Am Feuer wird es warm. Hier wachst du auf, wenn du fällst.');
      break;
    case 'rest':
      S.fire = [it.x, it.z];
      P.hp = maxHp();
      burst(P.x, P.y + 1, P.z, 30, [0.5, 1, 0.9], 3, 0.2, 1.5, -1.5, 1.5);
      startRest(null, 'Die Steine summen. Du fühlst dich wieder ganz.');
      break;
    case 'view': startRest(it.yaw, 'Du setzt dich und schaust in die Weite.'); break;
    case 'npc': talkTo(b.site); break;
    case 'shrine': {
      const k = it.sh.key, now = U.uTime.value;
      if (prayed[k] && now - prayed[k] < 180) { toast('Die Kerzen sind fast heruntergebrannt.'); break; }
      prayed[k] = now;
      P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.4);
      burst(it.x, it.sh.y + 1, it.z, 24, [1, 0.75, 0.4], 2, 0.18, 1.6, -1.2, 1);
      Ton.sfx('lantern');
      toast(pick(Math.random, ['Jemand hat hier lange gebetet. Du fühlst dich leichter.', 'Ein kleines Licht in einer grossen Dunkelheit.', 'Die Kerzen flackern, als würden sie dich kennen.']));
      break;
    }
    case 'ring': {
      const now = U.uTime.value;
      if (prayed[it.key] && now - prayed[it.key] < 240) { toast('Die Pilze leuchten still. Sie brauchen noch Ruhe.'); break; }
      prayed[it.key] = now;
      P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.5);
      burst(it.x, it.y + 0.8, it.z, 40, it.col, 2.5, 0.16, 2, -1.2, 2.2);
      Ton.sfx('lantern');
      if (!S.opened[it.key]) { S.opened[it.key] = 1; S.splinters++; card('Der Pilzring', 'Ein Sternsplitter liegt zwischen den Kappen.'); saveGame(); }
      else toast(pick(Math.random, ['Ein warmes Kribbeln fliesst durch deine Füsse.', 'Die Pilze summen leise im Takt deines Herzens.', 'Für einen Moment tanzt der ganze Wald.']));
      break;
    }
    case 'quelle': {
      const now = U.uTime.value;
      if (S.gold < 5) { toast('Du hast keine Münze übrig.'); break; }
      if (prayed[it.key] && now - prayed[it.key] < 300) { toast('Die Quelle schweigt. Vielleicht später wieder.'); break; }
      S.gold -= 5; prayed[it.key] = now;
      burst(it.x, it.y + 0.8, it.z, 30, [0.6, 0.85, 1], 2.5, 0.15, 1.6, -1, 1.2);
      Ton.sfx('lantern');
      const q = Math.random();
      if (q < 0.45) { P.hp = maxHp(); toast('Das Wasser leuchtet auf. Du fühlst dich ganz.'); }
      else if (q < 0.7) { S.potions++; toast('Aus der Tiefe steigt ein kleiner Trank.'); }
      else if (q < 0.85) { S.splinters++; toast('✦ Ein Sternsplitter glitzert im Wasser.'); }
      else { const g = 20 + Math.floor(Math.random() * 30); S.gold += g; toast('Die Quelle gibt dir ' + g + ' Gold zurück.'); }
      saveGame();
      break;
    }
    case 'lore': dialogPages = [it.text]; dialogName = 'Ein altes Buch'; showDialog(); break;
    case 'cave': enterCave(b); break;
    case 'caveExit': leaveCave(false); break;
    case 'feen': {
      const k = b.site.key + ':feen';
      P.hp = maxHp();
      burst(P.x, P.y + 1.5, P.z, 40, [1, 0.9, 0.6], 3, 0.18, 2, -1, 1.5);
      Ton.sfx('lantern');
      if (!S.opened[k]) { S.opened[k] = 1; S.splinters++; S.potions++; card('Der Segen der Feen', 'Sie legen dir einen Splitter und einen Trank in die Hände.'); saveGame(); }
      else toast(pick(Math.random, ['Die Feen kichern und tanzen um deinen Kopf.', 'Ein warmes Leuchten fliesst durch dich hindurch.', 'Du hörst ein leises Lied aus dem Laub.']));
      break;
    }
    case 'lantern':
      if (b.addLantern) b.addLantern();
      Ton.sfx('lantern');
      toast('Deine Laterne steigt in den Himmel.');
      break;
  }
}
// ---------- Höhlen ----------
function enterCave(b) {
  const cv = b.cave;
  P.inCave = b;
  cv.inner.visible = true;
  G.caveGround = (x, z) => (P.inCave && Math.hypot(x - cv.x, z - cv.z) < cv.R + 12 ? cv.y : null);
  P.x = cv.inX; P.z = cv.inZ; P.y = cv.y + 0.2; P.vx = P.vz = P.vy = 0;
  P.face = Math.atan2(cv.x - P.x, cv.z - P.z); cam.yaw = P.face;
  cam.pos.set(P.x - Math.sin(cam.yaw) * 6, P.y + 3, P.z - Math.cos(cam.yaw) * 6);
  G.fade = 1;
  Ton.sfx('discover');
  const k = b.site.key + ':innen';
  if (!S.disc[k]) { S.disc[k] = 1; card(b.site.name, b.site.cave === 'kristall' ? 'Die Wände atmen Licht.' : 'Ein Abgrund aus Feuer. Und irgendwo singen Zwerge.'); }
}
function leaveCave(silent) {
  const b = P.inCave;
  if (!b) return;
  b.cave.inner.visible = false;
  P.inCave = null; G.caveGround = null;
  if (silent) return;
  P.x = b.mouth.x; P.z = b.mouth.z; P.y = groundY(P.x, P.z) + 0.2; P.vx = P.vz = P.vy = 0;
  P.face = b.mouth.face; cam.yaw = P.face;
  cam.pos.set(P.x - Math.sin(cam.yaw) * 8, P.y + 3, P.z - Math.cos(cam.yaw) * 8);
  G.fade = 1;
}

// ---------- Stimmung: Orte färben die Welt ----------
const mood = { hell: 0, dunkel: 0, mond: 0, fogBank: 0, feen: 0, hellDir: new THREE.Vector3(1, 0.06, 0), mondDir: new THREE.Vector3(1, 0.35, 0) };
const env = { mood, cave: null, elev: 0, dunkelYaw: null, indoor: 0 };
let moodTick = 0, elevBase = 0, lakeNear = false;
function updateMood(dt, x, y, z) {
  moodTick -= dt;
  if (moodTick <= 0) {
    moodTick = 0.5;
    let sum = 0;
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; sum += Math.max(WATER, heightAt(x + Math.cos(a) * 70, z + Math.sin(a) * 70)); }
    elevBase = sum / 8;
    lakeNear = false;
    for (let i = 0; i < 12 && !lakeNear; i++) { const a = i / 12 * 6.283, d = 40 + (i % 3) * 50; if (heightAt(x + Math.cos(a) * d, z + Math.sin(a) * d) < -0.4) lakeNear = true; }
  }
  const tg = { hell: 0, dunkel: 0, mond: 0, fogBank: 0, feen: 0 };
  env.dunkelYaw = null;
  for (const L of bigsNear(x, z, 1300)) {
    const dx = L.x - x, dz = L.z - z, d = Math.hypot(dx, dz);
    if (L.lake && d < 900) lakeNear = lakeNear || d < 600;
    if (L.kind === 'abendschloss') {
      const k = smooth(720, 160, d);
      if (k > tg.hell) { tg.hell = k; mood.hellDir.set(dx / d, 0.05 + 0.04 * (1 - k), dz / d).normalize(); }
    } else if (L.kind === 'dunkelfeste') {
      const k = smooth(650, 110, d);
      if (k > tg.dunkel) { tg.dunkel = k; env.dunkelYaw = Math.atan2(dx, dz); }
    } else if (L.kind === 'koloss') {
      tg.fogBank = Math.max(tg.fogBank, smooth(520, 160, d) * 0.3);
    } else if (L.kind === 'mondschloss') {
      const k = smooth(430, 200, d);
      tg.fogBank = Math.max(tg.fogBank, smooth(760, 590, d) * (1 - smooth(460, 360, d)));
      if (k > tg.mond) { tg.mond = k; const top = L.baseH + LM_STYLE.mondschloss.keep * 1.15 - y; mood.mondDir.set(dx / d, clamp(top / Math.max(d, 1) * 0.9, 0.12, 0.7), dz / d).normalize(); }
    }
  }
  for (const [, b] of built) if (b.site.type === 'lichtung') tg.feen = Math.max(tg.feen, smooth(48, 18, Math.hypot(b.site.x - x, b.site.z - z)));
  const k = Math.min(1, dt * 0.7);
  for (const key in tg) mood[key] += (tg[key] - mood[key]) * k;
  env.cave = P && P.inCave ? P.inCave.cave.env : null;
  const inRoom = P && !P.inCave && !P.dead ? roomAt(P.x, P.y + 1.2, P.z) : null;
  env.indoor += ((inRoom ? 1 : 0) - env.indoor) * Math.min(1, dt * 2.5);
  env.elev = env.cave ? 0 : y - elevBase;
  G.reflOn = !env.cave && lakeNear && G.quality >= 1;
}

function openChest(c, b) {
  if (c.locked) { toast(b.site.content === 'boss' ? 'Verschlossen. Ein mächtiger Wächter hält den Schlüssel.' : 'Verschlossen.'); return; }
  c.opened = true; S.opened[c.key] = 1;
  Ton.sfx('chest');
  burst(c.x, c.y + 1, c.z, 30, c.big ? [0.8, 0.85, 1] : [1, 0.85, 0.5], 4, 0.2, 1.4, 2);
  const lvl = b.site.level || 1;
  const gold = Math.round((c.big ? 120 : 20 + Math.random() * 30) * (0.7 + lvl * 0.3));
  for (let i = 0; i < (c.big ? 14 : 6); i++) pickups.push(new Pickup('gold', c.x, c.y + 0.8, c.z, Math.max(1, Math.round(gold / (c.big ? 14 : 6)))));
  if (c.big || Math.random() < 0.4) pickups.push(new Pickup('trank', c.x, c.y + 0.8, c.z, 1));
  if (c.big) { for (let i = 0; i < 2; i++) pickups.push(new Pickup('splitter', c.x, c.y + 1, c.z, 1)); }
  else if (Math.random() < 0.22) pickups.push(new Pickup('splitter', c.x, c.y + 1, c.z, 1));
  saveGame();
}
function startRest(yaw, text) {
  mode = 'rest'; P.resting = true;
  restInfo = { yaw: yaw, t: 0 };
  $('restText').textContent = text;
  show('rest', true);
  saveGame();
}
function endRest() {
  if (mode !== 'rest') return;
  mode = 'play'; P.resting = false; restInfo = null;
  show('rest', false);
}

// ---------- Gespräche ----------
const NPC_LINES = [
  'Hast du je den Wal gesehen, der durch die Wolken zieht? Man sagt, er singt, wenn der Wind dreht.',
  'Ich wandere seit Jahren. Hinter jedem Hügel wartet etwas, das ich noch nie gesehen habe.',
  'Nimm dir Zeit. Die schönsten Dinge sieht man nur, wenn man stehen bleibt.',
  'In den alten Burgen schlafen Dinge, die besser weiterschlafen würden. Aber die Truhen… die Truhen sind verlockend.',
  'Wenn der Himmel violett wird, beginnt die schönste Stunde. Dann schweigen sogar die Grillen.',
  'Bei Gewitter leuchtet der Himmel wie zerbrochenes Glas. Ich habe nie etwas Schöneres gesehen.',
  'Die Schatten kommen nachts. Halte deine Laterne hoch und deine Klinge bereit.',
  'Hast du schon mal eine Laterne über dem See steigen lassen? Man darf sich dabei etwas wünschen.',
  'Ich male die Welt, aber sie verändert sich schneller, als meine Farben trocknen.',
  'Die Händler am Feuer verkaufen gute Klingen. Und sie hören zu, wenn man reden will.',
];
const DIRS = ['Süden', 'Südosten', 'Osten', 'Nordosten', 'Norden', 'Nordwesten', 'Westen', 'Südwesten'];
function dirWord(dx, dz) {
  const a = Math.atan2(dx, dz);
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
let dialogPages = [], dialogName = '';
const KNIGHT_LINES = [
  'Wir ziehen seit dem Fall unseres Königs durch die Lande. Setz dich, das Feuer reicht für alle.',
  'Siehst du die Türme am Horizont? Je näher man ihnen kommt, desto weiter scheinen sie fort.',
  'Einer von uns schwört, er habe in einer Höhle einen Baum aus reinem Licht gesehen. Wir lachen. Aber nur ein bisschen.',
  'Ruh dich aus, Wanderer. Morgen ist ein langer Weg, und übermorgen auch.',
];
function talkTo(s) {
  const r = mulberry32(s.seed + (S.met[s.key] || 0));
  dialogPages = [pick(r, s.type === 'ritter' ? KNIGHT_LINES : NPC_LINES)];
  if (s.type === 'ritter') {
    const L = bigNear(P.x, P.z, 2600);
    if (L && !S.disc[L.key]) {
      const what = L.kind === 'koloss' ? 'Auf der Ebene kniet ein Riese aus Stein. ' + L.name + ' nennen ihn die Alten. Man sagt, wer ihm zuhört, hört die Zeit.' : L.kind === 'dunkelfeste' ? 'Wo der Himmel schwarz wird, steht ' + L.name + '. Wer dort hingeht, kommt verändert zurück, oder gar nicht.' : L.kind === 'mondschloss' ? 'Hinter dem Nebel liegt ' + L.name + '. Geh hindurch, auch wenn du nichts mehr siehst.' : L.name + ' leuchtet im Abendrot. Dort ist das Licht freundlicher als irgendwo sonst.';
      S.hints[L.key] = [L.x, L.z, L.name];
      dialogPages.push(what + ' Es liegt im ' + dirWord(L.x - P.x, L.z - P.z) + '.');
    }
  }
  // Hinweis auf ein unentdecktes Wunder
  const cands = sitesNear(P.x, P.z, 1400).filter(o => o.type === 'wunder' && !S.disc[o.key] && !S.hints[o.key]);
  cands.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (cands.length) {
    const w = cands[0];
    S.hints[w.key] = [w.x, w.z, w.name];
    dialogPages.push(`Weit im ${dirWord(w.x - P.x, w.z - P.z)} liegt ${w.name}. Ich zeichne es dir auf deinen Kompass.`);
  }
  if (!S.met[s.key]) { dialogPages.push('Hier, nimm diesen Trank. Für den Weg.'); S.potions++; }
  S.met[s.key] = (S.met[s.key] || 0) + 1;
  dialogName = s.npc;
  showDialog();
}
function showDialog() {
  const text = dialogPages.shift();
  openPanel('dialog', () => {
    $('dlgName').textContent = dialogName;
    $('dlgText').textContent = text;
    $('dlgBtn').textContent = dialogPages.length ? 'Weiter' : 'Auf Wiedersehen';
    $('dlgBtn').onclick = () => { if (dialogPages.length) { closePanel(); showDialog(); } else closePanel(); };
  });
}

// ---------- Panels ----------
let panel = null, panelSel = 0;
function show(id, on) { $(id).classList.toggle('show', on); }
function openPanel(id, fill) {
  if (mode !== 'panel') prevMode = mode;
  mode = 'panel';
  panel = id;
  fill();
  show(id, true);
  panelSel = 0;
  markSel();
}
function panelOpts() { return panel ? [...$(panel).querySelectorAll('.opt:not([disabled])')] : []; }
function markSel() {
  const o = panelOpts();
  o.forEach((b, i) => b.classList.toggle('sel', i === panelSel));
  if (o[panelSel]) o[panelSel].scrollIntoView({ block: 'nearest' });
}
function closePanel() {
  if (!panel) return;
  show(panel, false);
  panel = null;
  mode = prevMode === 'panel' ? 'play' : prevMode;
  if (mode === 'title') show('title', true);
  for (const k in keys) keys[k] = false;
}
function panelKey(e, k) {
  if (e.repeat && (k === 'Enter' || k === 'e' || k === ' ')) return;
  const o = panelOpts();
  if (k === 'ArrowDown' || k === 's') { panelSel = (panelSel + 1) % Math.max(1, o.length); markSel(); Ton.sfx('click'); }
  else if (k === 'ArrowUp' || k === 'w') { panelSel = (panelSel - 1 + o.length) % Math.max(1, o.length); markSel(); Ton.sfx('click'); }
  else if (k === 'Enter' || k === 'e' || k === ' ') { if (o[panelSel]) o[panelSel].click(); }
  else if (k === 'Escape' || (k === 'Tab' && panel === 'journal') || (k === 'i' && panel === 'journal')) closePanel();
}

// Laden
function openShop(name) {
  openPanel('shop', () => fillShop(name));
}
function fillShop(name) {
  $('shopTitle').textContent = name + 's Waren';
  $('shopMoney').textContent = `${S.gold} Gold · ${S.splinters} ✦`;
  const list = $('shopList');
  list.innerHTML = '';
  const add = (title, desc, price, ok, fn) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.innerHTML = `<span><b>${title}</b><small>${desc}</small></span><em>${price}</em>`;
    if (!ok) b.classList.add('arm');
    b.onclick = () => {
      if (!ok) { Ton.sfx('click'); toast('Das kannst du dir noch nicht leisten.'); return; }
      fn(); Ton.sfx('buy'); saveGame();
      const keep = panelSel; fillShop(name); panelSel = Math.min(keep, panelOpts().length - 1); markSel();
    };
    list.appendChild(b);
  };
  add('Heiltrank', `Heilt mehr als die Hälfte · du hast ${S.potions}`, '25 Gold', S.gold >= 25 && S.potions < 9, () => { S.gold -= 25; S.potions++; });
  for (let t = S.weapon + 1; t < Math.min(WEAPONS.length, S.weapon + 3); t++) {
    const W = WEAPONS[t];
    add(W.name, `Waffe · ${W.dmg} Schaden (jetzt ${WEAPONS[S.weapon].dmg})`, W.price + ' Gold', S.gold >= W.price, () => { S.gold -= W.price; S.weapon = t; playerModel.userData.parts.setWeapon(t); toast(W.name + ' angelegt'); });
  }
  for (let t = S.armor + 1; t < Math.min(ARMORS.length, S.armor + 3); t++) {
    const A = ARMORS[t];
    add(A.name, `Rüstung · hält ${Math.round(A.def * 100)} % Schaden ab`, A.price + ' Gold', S.gold >= A.price, () => { S.gold -= A.price; S.armor = t; playerModel.userData.parts.setArmor(t); toast(A.name + ' angelegt'); });
  }
  const seg = [['leben', 'Segen des Lebens', '+25 Lebenskraft'], ['kraft', 'Segen der Kraft', '+15 % Schaden'], ['tempo', 'Segen des Windes', '+7 % Tempo']];
  for (const [k, n, d] of seg) {
    const lv = S.up[k];
    if (lv >= 5) continue;
    const cost = lv + 1;
    add(`${n} ${'I'.repeat(lv + 1).replace('IIII', 'IV').replace('IIIII', 'V')}`, d, cost + ' ✦', S.splinters >= cost, () => { S.splinters -= cost; S.up[k]++; if (k === 'leben') P.hp += 25; Ton.sfx('upgrade'); });
  }
  add('Wanderkarte', 'Zeigt ein unentdecktes Wunder auf dem Kompass', '40 Gold', S.gold >= 40, () => {
    S.gold -= 40;
    const c = sitesNear(P.x, P.z, 1600).filter(o => o.type === 'wunder' && !S.disc[o.key] && !S.hints[o.key]).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    if (c[0]) { S.hints[c[0].key] = [c[0].x, c[0].z, c[0].name]; toast(c[0].name + ' liegt im ' + dirWord(c[0].x - P.x, c[0].z - P.z)); }
    else { S.gold += 40; toast('Hier in der Nähe kennst du schon alles.'); }
  });
  const close = document.createElement('button');
  close.className = 'opt close'; close.textContent = 'Danke, auf Wiedersehen';
  close.onclick = closePanel;
  list.appendChild(close);
}

// Tagebuch
function openJournal() {
  openPanel('journal', () => {
    const names = Object.values(S.names);
    const wonders = names.filter(n => n[0] === 'wunder'), castles = names.filter(n => n[0] === 'burg');
    const freed = Object.keys(S.cleared).length;
    const hour = Math.floor(S.dayT * 24), min = Math.floor((S.dayT * 24 - hour) * 60);
    $('jStats').innerHTML = `
      <div><b>${wonders.length}</b><small>Wunder</small></div>
      <div><b>${castles.length}</b><small>Burgen (${freed} befreit)</small></div>
      <div><b>${S.kills}</b><small>Schatten gebannt</small></div>
      <div><b>${(S.dist / 1000).toFixed(1)} km</b><small>gewandert</small></div>`;
    $('jGear').innerHTML = `${WEAPONS[S.weapon].name} · ${ARMORS[S.armor].name}<br>Leben ${S.up.leben} · Kraft ${S.up.kraft} · Wind ${S.up.tempo} · ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} Uhr · ${WEATHERS[S.weather].name}`;
    const ul = $('jList');
    ul.innerHTML = '';
    const items = names.filter(n => n[0] !== 'lager').slice(-40).reverse();
    if (!items.length) ul.innerHTML = '<li class="dim">Noch leer. Geh los und staune.</li>';
    for (const n of items) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="ico">${n[0] === 'wunder' ? '✦' : n[0] === 'burg' ? '♜' : '◠'}</span>${n[1]}`;
      ul.appendChild(li);
    }
    $('jClose').onclick = closePanel;
  });
}

// Menü
function openMenu() {
  if (mode === 'panel') return;
  openPanel('menu', fillMenu);
}
function fillMenu() {
  $('mQuality').textContent = 'Grafik: ' + QUALITY[SET.quality].name;
  $('mView').textContent = 'Sichtweite: ' + VIEW_SETTINGS[SET.view].name;
  $('mSound').textContent = 'Ton: ' + (SET.sound ? 'An' : 'Aus');
}
$('mResume').onclick = closePanel;
$('mJournal').onclick = () => { closePanel(); openJournal(); };
let qualityManual = false;
$('mQuality').onclick = () => { qualityManual = true; SET.quality = (SET.quality + 2) % 3; G.quality = SET.quality; applyQuality(); clearGrass(); saveSettings(); fillMenu(); };
$('mView').onclick = () => { SET.view = (SET.view + 1) % 3; G.view = SET.view; clearChunks(); worldReady = false; saveSettings(); fillMenu(); };
$('mSound').onclick = () => { toggleSound(); fillMenu(); };
$('mTitle').onclick = () => { saveGame(); show('menu', false); panel = null; goTitle(); };

// ---------- Oberfläche ----------
function toast(text) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = text;
  $('toasts').appendChild(d);
  setTimeout(() => d.classList.add('out'), 3200);
  setTimeout(() => d.remove(), 4000);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}
const cardQueue = [];
let cardBusy = false;
function card(title, sub) {
  cardQueue.push([title, sub]);
  if (!cardBusy) nextCard();
}
function nextCard() {
  const c = cardQueue.shift();
  if (!c) { cardBusy = false; return; }
  cardBusy = true;
  $('cardTitle').textContent = c[0]; $('cardSub').textContent = c[1];
  show('card', true);
  setTimeout(() => { show('card', false); setTimeout(nextCard, 900); }, 5200);
}

// Kompass
const COMPASS_W = 440;
const compassMarks = [];
function initCompass() {
  const strip = $('cstrip');
  for (const [txt, a] of [['S', 0], ['SO', Math.PI / 4], ['O', Math.PI / 2], ['NO', Math.PI * 0.75], ['N', Math.PI], ['NW', -Math.PI * 0.75], ['W', -Math.PI / 2], ['SW', -Math.PI / 4]]) {
    const s = document.createElement('span'); s.className = txt.length === 1 ? 'cdir big' : 'cdir'; s.textContent = txt; s.dataset.a = a;
    strip.appendChild(s); compassMarks.push(s);
  }
  for (let i = 0; i < 14; i++) { const s = document.createElement('span'); s.className = 'cmark'; strip.appendChild(s); }
}
function compassPos(a) {
  let rel = a - cam.yaw; while (rel > Math.PI) rel -= 6.283; while (rel < -Math.PI) rel += 6.283;
  return Math.abs(rel) > Math.PI / 2 ? null : COMPASS_W / 2 - rel / (Math.PI / 2) * (COMPASS_W / 2);
}
let compassT = 0;
function updateCompass(dt) {
  for (const s of compassMarks) { const x = compassPos(+s.dataset.a); s.style.display = x == null ? 'none' : ''; if (x != null) s.style.left = x + 'px'; }
  compassT -= dt;
  if (compassT > 0) return;
  compassT = 0.08;
  const marks = [...$('cstrip').querySelectorAll('.cmark')];
  const list = [];
  for (const L of bigsNear(P.x, P.z, 2600)) {
    const d = Math.hypot(L.x - P.x, L.z - P.z);
    list.push([Math.atan2(L.x - P.x, L.z - P.z), '♛', d * 0.3, S.disc[L.key] ? 'burg' : 'hint']);
  }
  for (const s of sitesNear(P.x, P.z, 650)) {
    if (s.type === 'wanderer' && !S.met[s.key] && Math.hypot(s.x - P.x, s.z - P.z) > 200) continue;
    const d = Math.hypot(s.x - P.x, s.z - P.z);
    const known = S.disc[s.key] || S.hints[s.key];
    if (!known && d > 320) continue;
    const icon = !known ? '?' : s.type === 'wunder' ? '✦' : s.type === 'burg' ? '♜' : s.type === 'lager' ? '▲' : s.type === 'aussicht' ? '◠' : s.type === 'hoehle' ? '◓' : s.type === 'lichtung' ? '❀' : s.type === 'ritter' ? '⚔' : '•';
    list.push([Math.atan2(s.x - P.x, s.z - P.z), icon, d, known ? s.type : 'neu']);
  }
  for (const k in S.hints) {
    if (S.disc[k]) continue;
    const h = S.hints[k];
    if (Array.isArray(h) && Math.hypot(h[0] - P.x, h[1] - P.z) >= 650) list.push([Math.atan2(h[0] - P.x, h[1] - P.z), '✦', Math.hypot(h[0] - P.x, h[1] - P.z), 'hint']);
  }
  list.sort((a, b) => a[2] - b[2]);
  marks.forEach((m, i) => {
    const L = list[i];
    const x = L ? compassPos(L[0]) : null;
    if (x == null) { m.style.display = 'none'; return; }
    m.style.display = ''; m.style.left = x + 'px';
    m.textContent = L[1];
    m.className = 'cmark ' + L[3];
    m.style.opacity = clamp(1.2 - L[2] / 700, 0.35, 1);
  });
}

let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud(dt) {
  const mh = maxHp();
  const hpw = Math.max(0, P.hp / mh * 100).toFixed(1) + '%';
  if (hudCache.hp !== hpw) { hudCache.hp = hpw; $('hpFill').style.width = hpw; }
  setText('hpText', `${Math.ceil(Math.max(0, P.hp))} / ${mh}`);
  setText('gold', S.gold);
  setText('splinters', S.splinters);
  setText('potions', S.potions);
  // Interaktion
  if (nearI) { setText('promptText', interactLabel(nearI)); show('prompt', true); } else show('prompt', false);
  // Biom-Name beim Wechsel
  const w = chunkW(P.x, P.z), bi = dominantBiome(w);
  if (bi !== lastBiome && w[bi] > 0.62) {
    if (lastBiome !== -1) { setText('regionText', BIOMES[bi].name); biomeShowT = 4; }
    lastBiome = bi;
  }
  biomeShowT -= dt;
  show('region', biomeShowT > 0);
  updateCompass(dt);
}

// ---------- Wetter und Zeit ----------
function updateWeather(dt) {
  S.weatherT -= dt;
  if (S.weatherT <= 0) {
    const weights = [2, 3, 2, 1.6, 2.6, 2.2];
    let sum = 0; weights.forEach((w, i) => { if (i !== S.weather) sum += w; });
    let r = Math.random() * sum, next = 0;
    for (let i = 0; i < weights.length; i++) { if (i === S.weather) continue; r -= weights[i]; if (r <= 0) { next = i; break; } }
    S.weather = next; S.weatherT = 130 + Math.random() * 140;
    setText('regionText', WEATHERS[next].name); biomeShowT = 4;
  }
}

// ---------- Rote Augen in der Dunkelheit ----------
let eyesList = [], eyeT = 3;
function clearEyes() { for (const e of eyesList) disposeObj(e.g); eyesList = []; }
function updateEyes(dt) {
  const dark = clamp01(ATM.night * 1.3 - 0.3 + ATM.cur.fog * 0.5 + ATM.biomeFog * 0.6);
  eyeT -= dt;
  if (eyeT <= 0 && eyesList.length < 4 && dark > 0.3 && !P.safe) {
    eyeT = 2 + Math.random() * 6;
    const a = Math.random() * 6.283, d = 16 + Math.random() * 22;
    const x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d, y = groundY(x, z);
    if (y > 0.2) {
      const g = new THREE.Group();
      const col = Math.random() < 0.75 ? 0xff2a20 : 0xffc020;
      for (const sx of [-1, 1]) { const e = makeGlow(col, 0.32, 1); e.position.set(sx * 0.13, 0, 0); g.add(e); }
      g.position.set(x, y + 0.5 + Math.random() * 0.6, z);
      G.scene.add(g);
      eyesList.push({ g, x, z, life: 6 + Math.random() * 10, t: 0, blink: 1 });
    }
  }
  for (const e of eyesList) {
    e.t += dt;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d < 11 || e.t > e.life || dark < 0.15) e.life = Math.min(e.life, e.t);
    e.g.lookAt(G.camera.position);
    const fadeIn = Math.min(1, e.t * 2), out = e.t >= e.life ? 0 : 1;
    if (Math.random() < dt * 0.4) e.blink = 0.12;
    e.blink = Math.max(0, e.blink - dt);
    const vis = e.blink > 0 && e.blink < 0.12 ? 0 : fadeIn * out;
    e.g.children.forEach(c => { c.material.opacity = vis; });
    if (!out) e.dead = true;
  }
  eyesList = eyesList.filter(e => { if (e.dead) { disposeObj(e.g); return false; } return true; });
}

// ---------- Titel und Start ----------
let pendingNew = false;
function goTitle() {
  mode = 'title';
  show('title', true); show('hud', false); show('rest', false); show('bossbar', false);
  const sv = loadSave();
  $('btnStart').textContent = sv ? 'Weiterwandern' : 'Losgehen';
  $('btnNew').style.display = sv ? '' : 'none';
  $('btnNew').textContent = 'Neue Welt';
  pendingNew = false;
  if (playerModel) playerModel.visible = false;
}
$('btnStart').onclick = () => {
  Ton.start();
  const sv = loadSave();
  if (sv && (!S || S.seed !== sv.seed)) startWorld(sv);
  beginPlay();
};
$('btnNew').onclick = () => {
  Ton.start();
  if (!pendingNew) { pendingNew = true; $('btnNew').textContent = 'Wirklich? Die alte Welt verblasst.'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* egal */ }
  startWorld(freshState(newSeed()));
  beginPlay();
};
function newSeed() { return (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0 || 7; }
function beginPlay() {
  show('title', false); show('hud', true);
  playerModel.visible = true;
  mode = 'play';
  G.fade = 1;
  cam.dist = 9; cam.yaw = P.face + 0.4;
  if (!S.pos) {
    setTimeout(() => card('Wanderlicht', 'Geh, wohin der Wind dich trägt.'), 1200);
    setTimeout(() => toast('WASD gehen · Leertaste springen · F oder Klick schlagen · E sprechen'), 2500);
  }
  saveGame();
}

// ---------- Hauptschleife ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0, (now - last) / 1000);
  let dt = Math.min(0.05, raw);
  last = now;
  fpsAcc += Math.min(raw, 0.5); fpsN++;
  // Bleibt es zu langsam, wird das Bild etwas gröber (nur für diese Sitzung)
  if (mode !== 'play' || !worldReady) { fpsAcc = 0; fpsN = 0; }
  else if (fpsAcc > 6) {
    const fps = fpsN / fpsAcc;
    if (fps < 24 && !qualityManual && G.quality > 0) { G.quality--; SET.quality = G.quality; applyQuality(); clearGrass(); toast('Die Grafik wurde etwas reduziert, damit alles flüssig läuft.'); }
    fpsAcc = 0; fpsN = 0;
  }
  if (hitStop > 0) { hitStop -= dt; dt *= 0.15; }
  const live = mode === 'play' || mode === 'rest' || mode === 'title' || mode === 'dead';
  if (live) U.uTime.value += dt;
  const focusX = mode === 'title' ? World.spawnX : P.x, focusZ = mode === 'title' ? World.spawnZ : P.z;
  const done = updateChunks(focusX, focusZ, worldReady ? 5 : 40);
  if (!worldReady) { readyFrames++; if (done || readyFrames > 240) { worldReady = true; } }
  show('loading', !worldReady);
  if (live) {
    const timeSpeed = mode === 'rest' ? 32 : 1;
    S.dayT += dt * timeSpeed / DAY_LEN;
    if (S.dayT >= 1) { S.dayT -= 1; S.days = (S.days || 0) + 1; }
    // jede fünfte Nacht steigt der Blutmond auf
    const bloodNow = Math.floor((S.days || 0) + S.dayT + 0.25) % 5 === 3 ? 1 : 0;
    env.blood = lerp(env.blood || 0, bloodNow, Math.min(1, dt * 0.2));
    if (bloodNow && !S.bloodSeen && ATM.night > 0.6 && mode === 'play') { S.bloodSeen = true; card('Blutmond', 'Heute Nacht ist die Welt nicht freundlich. Bleib nah am Feuer.'); Ton.sfx('boss'); }
    if (!bloodNow) S.bloodSeen = false;
    if (mode !== 'title') {
      updateWeather(dt * timeSpeed);
      updatePlayer(dt);
      updateEnemies(dt);
      if (mode === 'play') roamSpawn(dt);
    }
    updateSites(dt, focusX, focusZ);
  }
  updateCamera(dt);
  if (S && live) {
    const w = chunkW(cam.pos.x, cam.pos.z);
    updateMood(dt, cam.pos.x, cam.pos.y, cam.pos.z);
    if (mood.feen > 0.4 && Math.random() < dt * 0.4) Ton.sfx('chime');
    updateAtmosphere(dt, S.dayT, WEATHERS[S.weather], w, G.camera.position, cam.yaw, mode === 'title' ? { x: World.spawnX, y: groundY(World.spawnX, World.spawnZ), z: World.spawnZ } : P, mode !== 'title', d => Ton.thunder(d), env);
    G.sky.position.copy(G.camera.position);
    updateBurst(dt);
    let cold = 0; for (let b = 0; b < NB; b++) cold += w[b] * BIOMES[b].cold;
    Ton.update(dt, { wind: ATM.cur.wind * (P && P.inCave ? 0.1 : 1), rain: P && P.inCave ? 0 : ATM.cur.rain, night: ATM.night, storm: ATM.cur.storm, cold, hell: mood.hell, dunkel: mood.dunkel, mond: mood.mond, feen: mood.feen, cave: P && P.inCave ? 1 : 0 });
  }
  if (S && P) {
    U.uPlayer.value.set(P.x, P.y, P.z);
    const pci = Math.floor(P.x / CHUNK), pcj = Math.floor(P.z / CHUNK);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ch = G.chunks.get((pci + di) + ',' + (pcj + dj)); if (ch && ch.out) for (const u of ch.out.updaters) u(dt); }
  }
  if (mode === 'play' || mode === 'rest') { findInteract(); updateHud(dt); }
  else if (mode === 'panel' && P) { nearI = null; updateHud(0); }
  if (mode === 'play' || mode === 'rest') updateEyes(dt);
  G.hurt = Math.max(0, G.hurt - dt * 1.5);
  if (mode === 'dead') G.fade = Math.min(0.7, G.fade + dt * 0.5);
  else G.fade = Math.max(0, G.fade - dt * (worldReady ? 0.8 : 0));
  if (S && P && mode !== 'title') G.hurt = Math.max(G.hurt, P.hp < maxHp() * 0.25 && !P.dead ? 0.15 + Math.sin(now * 0.006) * 0.08 : 0);
  saveTick -= dt;
  if (saveTick <= 0 && mode === 'play') { saveTick = 15; saveGame(); }
  renderFrame();
}

// ---------- Start ----------
function boot() {
  loadSettings();
  G.quality = SET.quality; G.view = SET.view;
  Ton.on = SET.sound;
  $('btnSound').textContent = SET.sound ? '♪' : '×';
  initGraphics(canvas);
  initCreatureMats();
  initBauten();
  initCompass();
  G.postMat.uniforms.uFadeCol.value.setRGB(0.04, 0.03, 0.08);
  const sv = loadSave();
  startWorld(sv || freshState(newSeed()));
  goTitle();
  $('btnSound').onclick = () => { Ton.start(); toggleSound(); };
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
