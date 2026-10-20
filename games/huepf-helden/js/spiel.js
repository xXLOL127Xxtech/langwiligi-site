'use strict';
// =====================================================================
//  Hüpf-Helden – Spiellogik, Physik und Darstellung im Level
// =====================================================================
const cv = $('c'), ctx = cv.getContext('2d');
const FONT = '"Lilita One", system-ui, sans-serif';
let SW = 0, SH = 0, DPR = 1, baseScale = 1;
const VIEW_TILES_H = 13;
const STEP = 1 / 120;
const PH = {
  grav: 4400, gravHold: 2150, maxFall: 980, walk: 245, run: 410,
  accG: 1650, accIce: 480, accAir: 1150, fric: 2000, fricIce: 260, fricAir: 380,
  jump: 890, jumpRun: .12, coyote: .1, buffer: .13,
};
const SOLID = new Uint8Array(16);
SOLID[TILE.G] = SOLID[TILE.S] = SOLID[TILE.B] = SOLID[TILE.Q] = SOLID[TILE.U] = SOLID[TILE.X] = SOLID[TILE.R] = SOLID[TILE.K] = 1;
const NOINPUT = { l: 0, r: 0, j: false, jP: false, d: false, dP: false, a: false, aP: false };

const G = {
  mode: 'title', t: 0, L: null, players: [], enemies: [], items: [], fbs: [], parts: [], pops: [], plats: [], springs: [],
  checks: [], starEnts: [], bumps: new Map(), coinPops: [], goals: [], boss: null, decoDyn: [], chains: [],
  cam: { cx: 0, cy: 0, zoom: 1, shake: 0, left: 0, top: 0, vw: 0, vh: 0 },
  lives: 5, node: null, diffSet: 'normal', starGot: [false, false, false], checkReached: false,
  goalTimer: -1, goalHow: 'normal', introT: 0, wipeT: -1, arenaLocked: false, solo: true, totalJumps: 0,
  bg: null, ambient: [], clouds: [], time: 300, timeAcc: 0, hurry: false, hitstop: 0, flash: 0, startPower: null,
  levelDiffNow: .3,
};

// ---------------------------------------------------------------------
//  Bildschirm und Kachel-Zwischenspeicher
// ---------------------------------------------------------------------
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  SW = innerWidth; SH = innerHeight;
  cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
  baseScale = SH / (VIEW_TILES_H * T);
  if (SW / baseScale < 16 * T) baseScale = SW / (16 * T);
  G.bg = null; chunkCache.clear();
}
addEventListener('resize', resize);
const CHW = 8 * T, CPAD = 4;
const chunkCache = new Map();
let chunkTick = 0;
function cacheScale() { return Math.min(2, baseScale * DPR); }
function getChunk(i) {
  let e = chunkCache.get(i);
  if (e) { e.used = ++chunkTick; return e; }
  if (chunkCache.size >= 10) {
    let old = null; for (const [k, v] of chunkCache) if (!old || v.used < old[1].used) old = [k, v];
    chunkCache.delete(old[0]);
  }
  const L = G.L, cs = cacheScale();
  const c = document.createElement('canvas');
  c.width = Math.ceil((CHW + CPAD) * cs); c.height = Math.ceil(L.h * T * cs);
  const g = c.getContext('2d');
  g.scale(cs, cs); g.translate(-i * CHW, 0);
  paintChunk(g, L, i * CHW, i * CHW + CHW + CPAD);
  e = { c, cs, used: ++chunkTick };
  chunkCache.set(i, e);
  return e;
}

// ---------------------------------------------------------------------
//  Kacheln und Bewegung
// ---------------------------------------------------------------------
function tAt(tx, ty) {
  const L = G.L;
  if (tx < 0 || tx >= L.w) return TILE.S;
  if (ty < 0 || ty >= L.h) return 0;
  return L.g[ty * L.w + tx];
}
function setTile(tx, ty, c) { const L = G.L; if (tx >= 0 && tx < L.w && ty >= 0 && ty < L.h) L.g[ty * L.w + tx] = c; }
function moveBody(b, dt, hidden) {
  const r = { l: false, r: false, u: false, d: false, wx: 0, wy: 0, hx: null, hy: 0 };
  const dx = b.vx * dt;
  if (dx) {
    b.x += dx;
    const ty0 = Math.floor((b.y - b.h + 3) / T), ty1 = Math.floor((b.y - 3) / T);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w / 2) / T);
      for (let ty = ty0; ty <= ty1; ty++) if (SOLID[tAt(tx, ty)]) { b.x = tx * T - b.w / 2 - .01; r.r = true; r.wx = tx; r.wy = ty; break; }
    } else {
      const tx = Math.floor((b.x - b.w / 2) / T);
      for (let ty = ty0; ty <= ty1; ty++) if (SOLID[tAt(tx, ty)]) { b.x = (tx + 1) * T + b.w / 2 + .01; r.l = true; r.wx = tx; r.wy = ty; break; }
    }
  }
  const prevBot = b.y, prevTop = b.y - b.h;
  const dy = b.vy * dt;
  b.y += dy;
  const lx = Math.floor((b.x - b.w / 2 + 1) / T), rx = Math.floor((b.x + b.w / 2 - 1) / T);
  if (dy >= 0) {
    const ty = Math.floor(b.y / T);
    for (let tx = lx; tx <= rx; tx++) {
      const c = tAt(tx, ty);
      if (SOLID[c] || (c === TILE.P && prevBot <= ty * T + .5)) { b.y = ty * T; r.d = true; r.dy = ty; if (c === TILE.X) r.spike = true; break; }
    }
  } else {
    const ty = Math.floor((b.y - b.h) / T);
    const hit = [];
    for (let tx = lx; tx <= rx; tx++) {
      const c = tAt(tx, ty);
      if (SOLID[c] || (hidden && c === TILE.H && prevTop >= (ty + 1) * T - 1)) hit.push(tx);
    }
    if (hit.length) {
      if (hidden && hit.length === 1) {   // Ecken-Hilfe
        const tx = hit[0];
        const ovL = (b.x + b.w / 2) - tx * T, ovR = (tx + 1) * T - (b.x - b.w / 2);
        if (ovL < 11 && !SOLID[tAt(tx - 1, ty)] && tAt(tx - 1, ty) !== TILE.H) { b.x -= ovL + .1; return r; }
        if (ovR < 11 && !SOLID[tAt(tx + 1, ty)] && tAt(tx + 1, ty) !== TILE.H) { b.x += ovR + .1; return r; }
      }
      b.y = (ty + 1) * T + b.h; r.u = true; r.hx = hit; r.hy = ty;
    }
  }
  return r;
}
const overlap = (a, b) => a.x + a.w / 2 > b.x - b.w / 2 && a.x - a.w / 2 < b.x + b.w / 2 && a.y > b.y - b.h && a.y - a.h < b.y;
const inWater = (y) => G.L && G.L.water !== null && y > G.L.water;

// ---------------------------------------------------------------------
//  Partikel und Punkte
// ---------------------------------------------------------------------
function part(o) { if (G.parts.length < 700) G.parts.push(Object.assign({ vx: 0, vy: 0, life: .6, t: 0, size: 6, grav: 0, rot: 0, vr: 0, color: '#fff', kind: 'dust' }, o)); }
function dust(x, y, n = 5, col = 'rgba(255,255,255,.8)') {
  for (let i = 0; i < n; i++) part({ x: x + (Math.random() - .5) * 20, y: y - 4, vx: (Math.random() - .5) * 160, vy: -Math.random() * 90, life: .35 + Math.random() * .25, size: 5 + Math.random() * 6, color: col, kind: 'dust' });
}
function sparkle(x, y, n = 8, col = '#fff6b0') {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 80 + Math.random() * 220; part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4 + Math.random() * .3, size: 4 + Math.random() * 4, color: col, kind: 'star', vr: 8 }); }
}
function popup(x, y, text, col = '#fff') { G.pops.push({ x, y, text, col, t: 0 }); }
function shake(a) { G.cam.shake = Math.max(G.cam.shake, a); }
function hitstop(s) { G.hitstop = Math.max(G.hitstop, s); }

// ---------------------------------------------------------------------
//  Spieler
// ---------------------------------------------------------------------
function newStats() { return { coins: 0, score: 0, stomps: 0, jumps: 0, deaths: 0, pops: 0, stars: 0, power: 0, first: 0, time: 0 }; }
function makePlayer(def, idx) {
  return {
    idx, ch: CHARS[def.ci], schemes: def.schemes, color: CHARS[def.ci].color,
    x: 0, y: 0, vx: 0, vy: 0, w: 28, h: 42, power: 0, face: 1, onGround: false, onPlat: null,
    coyote: 0, jumpBuf: 0, runT: 0, state: 'play', inv: 0, starT: 0, pounding: false, poundT: 0,
    wallSlide: false, wallDir: 0, wallLock: 0, canDouble: true, floatFuel: 1.2, floating: false,
    dashT: 0, rammT: 0, tongueT: 0, dashCd: 0, stunT: 0, springT: false, sx: 1, sy: 1, walk: 0, t: Math.random() * 9,
    blinkT: 2, deadT: 0, goalPhase: '', goalT: 0, combo: 0, growT: 0, coins: 0, score: 0,
    carry: null, carried: null, slide: false, whirlUsed: false, whirlT: 0, throwT: 0, swim: false,
    ls: newStats(), tot: newStats(), inp: NOINPUT, bx: 0, by: 0,
  };
}
function setPower(p, pw) {
  const old = p.power;
  p.power = pw;
  p.h = pw > 0 ? 68 : 42; p.w = pw > 0 ? 32 : 28;
  if ((old > 0) !== (pw > 0)) p.growT = .5;
}
function addScore(p, n, x, y) {
  if (!p) return;
  p.score += n; p.ls.score += n;
  if (x !== undefined) popup(x, y, n >= 1000 ? (n / 1000) + 'K' : String(n), p.color);
}
function addCoin(p, n = 1) {
  SFX.coin();
  if (!p) p = G.players.find(q => q.state === 'play') || G.players[0];
  if (!p) return;
  p.coins += n; p.ls.coins += n; addScore(p, 100 * n);
  while (p.coins >= 100) { p.coins -= 100; gainLife(p, p.x, p.y - p.h); }
}
function gainLife(p, x, y) {
  G.lives = Math.min(99, G.lives + 1); SFX.life(); popup(x, y, '1UP', '#7ef08a');
  const out = G.players.find(q => q.state === 'out');
  if (out && G.lives > 0) { G.lives--; toBubble(out); }
}
function dropCarry(p) {
  const c = p.carry; if (!c) return;
  p.carry = null;
  if (c.type === 'player') { c.ref.carried = null; c.ref.vy = -300; }
  else if (c.type === 'shell') { c.ref.carried = false; c.ref.vx = 0; }
  else if (c.type === 'ice') { c.ref.carried = false; }
}
function hurt(p) {
  if (p.inv > 0 || p.starT > 0 || p.state !== 'play') return;
  dropCarry(p);
  if (p.power > 0) {
    setPower(p, p.power > 1 ? 1 : 0); p.inv = 2; SFX.hurt(); shake(4);
    sparkle(p.x, p.y - 30, 6, p.color);
  } else die(p, false);
}
function die(p, fell) {
  if (p.state !== 'play') return;
  dropCarry(p);
  if (p.carried) { p.carried.carry = null; p.carried = null; }
  p.state = 'dead'; p.deadT = 0; p.fell = fell; p.vx = 0; p.vy = fell ? 0 : -900;
  p.pounding = false; p.floating = false; p.dashT = p.rammT = p.tongueT = 0; p.slide = false;
  p.ls.deaths++; G.lives--;
  setPower(p, 0); p.starT = 0;
  if (G.solo || G.players.every(q => q === p || q.state !== 'play')) Music.stop();
  SFX.die(); hitstop(.12);
  if (fell && G.L.theme.lava) for (let i = 0; i < 12; i++) part({ x: p.x + (Math.random() - .5) * 30, y: (G.L.h - 2) * T, vx: (Math.random() - .5) * 200, vy: -200 - Math.random() * 400, grav: 1200, life: .8, size: 6, color: '#ffb02a', kind: 'ember' });
}
function afterDeath(p) {
  const alive = G.players.filter(q => q.state === 'play' || q.state === 'goal');
  if (G.lives < 0 && alive.length) { p.state = 'out'; G.lives = 0; return; }
  if (alive.length && !G.solo) { toBubble(p); return; }
  p.state = 'wait';
  if (G.wipeT < 0) G.wipeT = 0;
}
function toBubble(p) {
  p.state = 'bubble';
  setPower(p, 0);
  p.bx = G.cam.cx; p.by = G.cam.top + 120;
  p.vx = p.vy = 0;
  SFX.bubble();
}
function popBubble(p, by) {
  p.state = 'play'; p.x = p.bx; p.y = p.by + 20; p.vx = 0; p.vy = -420; p.inv = 1.5; p.onGround = false;
  by.ls.pops++;
  SFX.bubble(); sparkle(p.bx, p.by, 10, '#bfe9ff');
}

function updatePlayer(p, dt) {
  p.t += dt;
  p.blinkT -= dt; if (p.blinkT < -.12) p.blinkT = 2 + Math.random() * 3;
  p.sx += (1 - p.sx) * Math.min(1, dt * 12); p.sy += (1 - p.sy) * Math.min(1, dt * 12);
  if (p.growT > 0) p.growT -= dt;
  if (p.throwT > 0) p.throwT -= dt;
  if (p.state === 'play') {
    p.inp = G.introT > 0 ? NOINPUT : readInput(p.schemes);
    if (p.carried) {   // wird gerade getragen
      if (p.inp.jP) { const c = p.carried; c.carry = null; p.carried = null; p.vy = -720; p.onGround = false; SFX.jump(false); }
      return;
    }
    playPhysics(p, p.inp, dt); p.ls.time += dt;
  } else if (p.state === 'dead') {
    p.deadT += dt;
    if (!p.fell && p.deadT > .35) { p.vy += 2600 * dt; p.y += p.vy * dt; }
    if (p.deadT > 1.4) afterDeath(p);
  } else if (p.state === 'bubble') {
    const inp = readInput(p.schemes);
    const tx = G.cam.cx + (p.idx - 1.5) * 80 + ((inp.r ? 1 : 0) - (inp.l ? 1 : 0)) * 140, ty = G.cam.top + G.cam.vh * .3 + (p.idx % 2) * 40;
    p.bx += (tx - p.bx) * Math.min(1, dt * 1.4);
    p.by += (ty - p.by) * Math.min(1, dt * 1.4) + Math.sin(p.t * 2.2) * 20 * dt;
    for (const q of G.players) {
      if (q.state !== 'play') continue;
      if (Math.hypot(q.x - p.bx, q.y - q.h / 2 - p.by) < 44) { popBubble(p, q); break; }
    }
  } else if (p.state === 'goal') goalAnim(p, dt);
}

function playPhysics(p, inp, dt) {
  const th = G.L.theme, ch = p.ch;
  if (p.inv > 0) p.inv -= dt;
  if (p.starT > 0) { p.starT -= dt; if (Math.random() < .3) sparkle(p.x, p.y - p.h / 2, 1, `hsl(${Math.random() * 360},100%,75%)`); if (p.starT <= 0) Music.speed = G.hurry ? 1.3 : 1; }
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.stunT > 0) { p.stunT -= dt; inp = NOINPUT; }
  const water = inWater(p.y - p.h * .45);
  if (water !== p.swim) { p.swim = water; if (water) { p.vy *= .35; p.pounding = false; dust(p.x, p.y - p.h, 6, 'rgba(220,245,255,.9)'); } }
  if (inp.aP) doAction(p, inp);
  let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (p.wallLock > 0) { p.wallLock -= dt; if (dir === p.wallDir) dir = 0; }
  if (p.pounding || p.dashT > 0 || p.rammT > 0) dir = 0;
  if (dir && !p.slide) p.face = dir;
  if (dir && p.onGround && sign(p.vx) === dir && Math.abs(p.vx) > 140) p.runT += dt;
  if (!dir || sign(p.vx) === -dir) p.runT = 0;
  const bear = p.power === 5;
  if (bear && p.onGround && inp.d && Math.abs(p.vx) > 120 && !p.carry) { if (!p.slide) { p.slide = true; SFX.dash(); } }
  if (p.slide && (!inp.d || Math.abs(p.vx) < 50 || !bear)) p.slide = false;
  let top = (p.runT > .4 ? PH.run : PH.walk) * ch.speed;
  if (p.carry) top *= .9;
  const ice = th.ice && p.onGround && !bear;
  if (water) {
    const sp = (bear ? 270 : 160) * ch.speed;
    if (dir) p.vx += dir * 700 * dt; else p.vx -= sign(p.vx) * Math.min(Math.abs(p.vx), 320 * dt);
    p.vx = clamp(p.vx, -sp, sp);
  } else if (p.dashT > 0) {
    p.dashT -= dt; p.vx = p.face * 800; p.vy = 0;
    if (Math.random() < .7) part({ x: p.x - p.face * 14, y: p.y - p.h / 2 + (Math.random() - .5) * 30, vx: -p.face * 60, life: .25, size: 7, color: 'rgba(170,210,255,.8)', kind: 'dust' });
    if (p.dashT <= 0) { p.vx = p.face * PH.run * ch.speed; p.runT = 1; }
  } else if (p.rammT > 0) {
    p.rammT -= dt; p.vx = p.face * 640;
    if (Math.random() < .6) dust(p.x - p.face * 16, p.y, 1);
  } else if (p.slide) {
    const s = Math.abs(p.vx) + (th.ice ? 300 : -260) * dt; p.vx = sign(p.vx) * clamp(s, 0, 560);
    if (Math.random() < .5) dust(p.x - p.face * 16, p.y, 1, 'rgba(230,245,255,.9)');
  } else if (dir) {
    const acc = p.onGround ? (ice ? PH.accIce : PH.accG) : PH.accAir;
    if (p.vx * dir < 0) {
      p.vx += dir * acc * (p.onGround ? (ice ? 1 : 2.3) : 1.4) * dt;
      if (p.onGround && !ice && Math.abs(p.vx) > 140 && Math.random() < .4) dust(p.x, p.y, 1);
    } else if (Math.abs(p.vx) < top) p.vx = dir * Math.min(top, Math.abs(p.vx) + acc * dt);
    else p.vx = dir * Math.max(top, Math.abs(p.vx) - PH.fricAir * dt);
  } else {
    const fr = p.onGround ? (ice ? PH.fricIce : PH.fric) : PH.fricAir;
    const s = Math.abs(p.vx) - fr * dt; p.vx = s > 0 ? sign(p.vx) * s : 0;
  }
  p.jumpBuf = inp.jP ? PH.buffer : Math.max(0, p.jumpBuf - dt);
  p.coyote = p.onGround ? PH.coyote : Math.max(0, p.coyote - dt);
  if (water) {
    if (inp.jP) {
      const nearTop = p.y - p.h < G.L.water + 34;
      p.vy = nearTop ? -780 : -(bear ? 400 : 330);
      p.onGround = false; p.sy = 1.1; p.ls.jumps++; G.totalJumps++;
      SFX.swim(); part({ x: p.x, y: p.y - p.h, vx: 0, vy: -60, life: .8, size: 5, color: 'rgba(220,245,255,.8)', kind: 'bubble' });
    }
  } else if (p.jumpBuf > 0 && !p.pounding && p.dashT <= 0) {
    if (p.coyote > 0) {
      p.vy = -(PH.jump + PH.jumpRun * Math.abs(p.vx)) * ch.jump;
      p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.onPlat = null;
      p.sx = .78; p.sy = 1.25; p.ls.jumps++; G.totalJumps++;
      SFX.jump(p.power > 0); dust(p.x, p.y, 3);
    } else if (p.wallSlide && !p.carry) {
      p.vx = -p.wallDir * 340; p.vy = -830 * ch.jump; p.face = -p.wallDir; p.wallLock = .16; p.wallSlide = false; p.jumpBuf = 0;
      p.sx = .8; p.sy = 1.2; p.ls.jumps++; G.totalJumps++; SFX.jump(p.power > 0);
      dust(p.x + p.wallDir * 14, p.y - 20, 4);
    } else if (ch.id === 'hops' && p.canDouble) {
      p.canDouble = false; p.vy = -770; p.jumpBuf = 0; p.spin = 1; p.ls.jumps++; G.totalJumps++;
      SFX.jump(false); sparkle(p.x, p.y, 5, '#b6ff9a');
    }
  }
  if (p.spin > 0) p.spin -= dt * 2.5;
  if (p.whirlT > 0) p.whirlT -= dt;
  let g = PH.grav, maxFall = PH.maxFall;
  if (p.vy < 0 && (inp.j || p.springT)) g = PH.gravHold;
  if (p.vy >= 0) p.springT = false;
  if (p.power === 4 && p.whirlUsed && p.vy > 0 && (inp.j || inp.a)) { g = 1200; maxFall = 115; }
  if (p.whirlT > 0) g = 900;
  p.floating = false;
  if (ch.special === 'schweben' && p.power < 2 && inp.a && !p.onGround && p.floatFuel > 0 && !p.pounding && !p.carry && !water) {
    p.floating = true; p.floatFuel -= dt; g = 0; p.vy += (35 - p.vy) * Math.min(1, dt * 7);
    if (Math.random() < .25) part({ x: p.x, y: p.y - 10, vx: (Math.random() - .5) * 60, vy: 60, life: .5, size: 4, color: '#fff7b0', kind: 'star', vr: 4 });
  }
  if (water) {
    g = inp.d ? 900 : 520; maxFall = inp.d ? 260 : 140;
  } else {
    if (inp.dP && !p.onGround && !p.pounding && p.dashT <= 0 && !p.carry) { p.pounding = true; p.poundT = .17; p.rammT = 0; p.whirlT = 0; }
    if (p.pounding) { g = 0; if (p.poundT > 0) { p.poundT -= dt; p.vy = 0; p.vx = 0; } else p.vy = 1200; }
  }
  if (p.dashT > 0) g = 0;
  p.vy = Math.min(maxFall, p.vy + g * dt);
  if (water && p.vy < -420 && p.y - p.h > G.L.water + 34) p.vy = -420;
  if (p.wallSlide && p.vy > 170) { p.vy = 170; if (Math.random() < .2) dust(p.x + p.wallDir * 14, p.y - 10, 1); }
  if (p.onPlat) { p.x += p.onPlat.dx; p.y += p.onPlat.dy; }
  const prevBottom = p.y, wasGround = p.onGround;
  const r = moveBody(p, dt, true);
  p.onGround = r.d; p.onPlat = null;
  if (!r.d && p.vy >= 0) platformCollide(p, prevBottom);
  p.wallSlide = false;
  if (r.l || r.r) {
    const wd = r.r ? 1 : -1;
    if (p.rammT > 0) rammHit(p, r, wd);
    else if (p.dashT > 0) p.dashT = 0;
    if (p.slide) { const c = tAt(r.wx, r.wy); if (c === TILE.B || c === TILE.Q) hitBlock(r.wx, r.wy, p, 'side'); p.slide = false; }
    if (!p.onGround && !water && dir === wd && p.vy > 0 && !p.pounding && !p.carry) { p.wallSlide = true; p.wallDir = wd; }
    p.vx = 0;
  }
  if (r.u) {
    let tx = r.hx[0];
    for (const h of r.hx) if (Math.floor(p.x / T) === h) tx = h;
    hitBlock(tx, r.hy, p);
    p.vy = 40;
  }
  if (p.onGround) {
    if (!wasGround) land(p);
    p.vy = 0;
    if (r.spike) { hurt(p); p.vy = -620; p.onGround = false; }
  }
  if (p.pounding && r.d && p.poundT <= 0) poundLand(p, r);
  collectTiles(p);
  if (p.tongueT > 0) tongue(p, dt);
  if (p.y - p.h > G.L.h * T + 40) die(p, true);
  else if (th.lava && p.y > (G.L.h - 2) * T + 16) die(p, true);
}
function land(p) {
  p.sx = 1.22; p.sy = .78; p.combo = 0; p.canDouble = true; p.floatFuel = 1.3; p.whirlUsed = false;
  if (!p.pounding) dust(p.x, p.y, 3);
}
function platformCollide(p, prevBottom) {
  for (const s of G.plats) {
    if (s.state === 'gone' || s.carried) continue;
    const top = s.y, l = s.x, rgt = s.x + s.w;
    if (prevBottom <= top + 2 + Math.max(0, s.dy) && p.y >= top && p.x + p.w / 2 > l && p.x - p.w / 2 < rgt) {
      p.y = top; p.onGround = true; p.onPlat = s; s.stood = true; return;
    }
  }
}
// Spezial-Taste: tragen/werfen, dann Verwandlungs-Kraft, dann Fähigkeit der Figur
function doAction(p, inp) {
  if (p.carry) { throwCarry(p, inp); return; }
  if (tryPickup(p)) return;
  if (p.power === 2 || p.power === 3 || p.power === 5) {
    const ice = p.power !== 2;
    if (G.fbs.filter(f => f.owner === p).length < 2) {
      G.fbs.push({ x: p.x + p.face * 18, y: p.y - p.h * .6, vx: p.face * (ice ? 480 : 560), vy: ice ? 60 : 120, owner: p, life: ice ? 1.6 : 3, w: 18, h: 18, ice });
      if (ice) SFX.ice(); else SFX.fire();
      p.sx = 1.1; p.throwT = .18;
    }
    return;
  }
  if (p.power === 4) {
    if (!p.whirlUsed) {
      p.whirlUsed = true; p.whirlT = .45; p.vy = -1080; p.onGround = false; p.pounding = false;
      SFX.whirl(); for (let i = 0; i < 10; i++) part({ x: p.x + (Math.random() - .5) * 40, y: p.y, vx: (Math.random() - .5) * 300, vy: 100, life: .4, size: 7, color: 'rgba(200,255,180,.8)', kind: 'dust' });
    }
    return;
  }
  if (p.dashCd > 0) return;
  switch (p.ch.special) {
    case 'dash': p.dashT = .2; p.dashCd = .85; p.pounding = false; SFX.dash(); break;
    case 'ramm': p.rammT = .34; p.dashCd = .9; SFX.dash(); break;
    case 'zunge': p.tongueT = .3; p.dashCd = .45; SFX.tongue(); break;
    case 'schweben': if (!p.onGround && p.floatFuel > 0) SFX.float(); break;
  }
}
function tryPickup(p) {
  const reach = { x: p.x + p.face * 14, y: p.y, w: p.w + 30, h: p.h };
  for (const e of G.enemies) {
    if (e.kind === 'schnecke' && e.shell && !e.vx && !e.dead && !e.carried && overlap(reach, e)) {
      e.carried = true; p.carry = { type: 'shell', ref: e }; SFX.select(); return true;
    }
  }
  for (const s of G.plats) {
    if (s.mode === 'ice' && !s.carried && !s.vx && Math.abs(s.x + s.w / 2 - (p.x + p.face * 20)) < 46 && Math.abs(s.y + s.h - p.y) < 40) {
      s.carried = true; p.carry = { type: 'ice', ref: s }; SFX.select(); return true;
    }
  }
  for (const q of G.players) {
    if (q !== p && q.state === 'play' && !q.carried && !q.carry && !p.carried && Math.abs(q.x - (p.x + p.face * 20)) < 38 && Math.abs(q.y - p.y) < 24) {
      q.carried = p; p.carry = { type: 'player', ref: q }; q.vx = q.vy = 0; q.pounding = false; SFX.select(); return true;
    }
  }
  return false;
}
function throwCarry(p) {
  const c = p.carry; p.carry = null; p.throwT = .25;
  SFX.kick();
  if (c.type === 'shell') {
    const e = c.ref; e.carried = false;
    e.x = p.x + p.face * (p.w / 2 + e.w / 2 + 2); e.y = p.y - 2;
    if (bodyStuckE(e)) e.x = p.x;
    e.vx = p.face * 600; e.dir = p.face; e.kickGrace = .3; e.kicker = p;
  } else if (c.type === 'ice') {
    const s = c.ref; s.carried = false;
    s.bx = p.x + p.face * (p.w / 2 + s.w / 2 + 2); s.by = p.y - 2;
    if (bodyStuckE({ x: s.bx, y: s.by, w: s.w, h: s.h })) s.bx = p.x;
    s.vx = p.face * 580; s.vy = -100; s.thrower = p;
  } else if (c.type === 'player') {
    const q = c.ref; q.carried = null;
    q.x = p.x + p.face * 10; q.y = p.y - p.h - 4; q.vx = p.face * 430; q.vy = -720; q.onGround = false; q.inv = Math.max(q.inv, .3);
  }
}
function bodyStuckE(b) {
  const lx = Math.floor((b.x - b.w / 2 + 2) / T), rx = Math.floor((b.x + b.w / 2 - 2) / T);
  const ty0 = Math.floor((b.y - b.h + 2) / T), ty1 = Math.floor((b.y - 2) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = lx; tx <= rx; tx++) if (SOLID[tAt(tx, ty)]) return true;
  return false;
}
function updateCarry(p) {
  const c = p.carry; if (!c) return;
  if (p.state !== 'play') { dropCarry(p); return; }
  const cx = p.x + p.face * 2, cy = p.y - p.h + 6;
  if (c.type === 'shell') { c.ref.x = cx; c.ref.y = cy; c.ref.vx = 0; c.ref.vy = 0; c.ref.wake = Math.max(c.ref.wake, 2.5); }
  else if (c.type === 'ice') { const s = c.ref; s.bx = cx; s.by = cy; s.vx = 0; s.vy = 0; s.x = cx - s.w / 2; s.y = cy - s.h; s.timer = Math.max(s.timer, 3); }
  else if (c.type === 'player') { const q = c.ref; if (q.state !== 'play') { p.carry = null; return; } q.x = cx; q.y = cy; q.vx = 0; q.vy = 0; q.face = p.face; }
}
function tongue(p, dt) {
  p.tongueT -= dt;
  const k = 1 - p.tongueT / .3;
  const len = Math.sin(clamp(k, 0, 1) * Math.PI) * 150;
  const tx = p.x + p.face * (14 + len), ty = p.y - p.h * .62;
  p.tip = { x: tx, y: ty };
  const box = { x: tx, y: ty + 14, w: 28, h: 28 };
  for (const e of G.enemies) if (!e.dead && e.active && !INVULN[e.kind] && overlap(box, enemyBox(e))) { killEnemy(e, 'eat', p); p.tongueT = Math.min(p.tongueT, .15); }
  if (G.boss && !G.boss.dead && overlap(box, G.boss)) bossDamage(.34, p);
  for (const it of G.items) if (!it.emerge && overlap(box, it)) applyItem(p, it);
  const cx2 = Math.floor(tx / T), cy2 = Math.floor(ty / T);
  if (tAt(cx2, cy2) === TILE.C) { setTile(cx2, cy2, 0); addCoin(p); sparkle(cx2 * T + T / 2, cy2 * T + T / 2, 4); }
}
function rammHit(p, r, wd) {
  for (const ty of [r.wy, r.wy - 1]) {
    const c = tAt(r.wx, ty);
    if (c === TILE.B || c === TILE.Q || c === TILE.R) hitBlock(r.wx, ty, p, 'side');
  }
  p.rammT = 0; p.vx = -wd * 220; shake(5);
}
function poundLand(p, r) {
  const ty = r.dy;
  const lx = Math.floor((p.x - p.w / 2 + 2) / T), rx = Math.floor((p.x + p.w / 2 - 2) / T);
  let broke = false;
  for (let tx = lx; tx <= rx; tx++) {
    const c = tAt(tx, ty);
    if (c === TILE.R) { breakBrick(tx, ty, p); broke = true; }
    else if (c === TILE.B && (p.power > 0 || p.ch.id === 'rumpel') && !G.L.content.get(ty * G.L.w + tx)) { breakBrick(tx, ty, p); broke = true; }
    else if (c === TILE.Q || c === TILE.B) hitBlock(tx, ty, p, 'top');
  }
  if (broke) {
    for (let tx = lx - 1; tx <= rx + 1; tx++) if (tAt(tx, ty) === TILE.R) breakBrick(tx, ty, p);
    p.onGround = false; p.vy = 600; return;
  }
  p.pounding = false;
  SFX.pound(); shake(p.ch.id === 'rumpel' ? 9 : 5);
  p.sx = 1.35; p.sy = .65;
  const rad = p.ch.id === 'rumpel' ? 4.2 * T : 1.6 * T;
  for (let i = 0; i < 14; i++) { const a = Math.PI + i / 13 * Math.PI; part({ x: p.x, y: p.y - 4, vx: Math.cos(a) * 260 * (rad / T / 2), vy: Math.sin(a) * 120, life: .45, size: 9, color: 'rgba(255,255,255,.85)', kind: 'dust' }); }
  for (const e of G.enemies) {
    if (e.dead || !e.active || INVULN[e.kind]) continue;
    if (Math.abs(e.x - p.x) < rad && Math.abs(e.y - p.y) < T * .6) killEnemy(e, 'flip', p);
  }
  for (const q of G.players) if (q !== p && q.state === 'play' && q.onGround && Math.abs(q.x - p.x) < rad && Math.abs(q.y - p.y) < 10) { q.vy = -500; q.onGround = false; }
}
function collectTiles(p) {
  const lx = Math.floor((p.x - p.w / 2) / T), rx = Math.floor((p.x + p.w / 2) / T);
  const ty0 = Math.floor((p.y - p.h) / T), ty1 = Math.floor((p.y - 1) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = lx; tx <= rx; tx++) {
    if (tAt(tx, ty) === TILE.C) { setTile(tx, ty, 0); addCoin(p); sparkle(tx * T + T / 2, ty * T + T / 2, 4); }
  }
}

// ---------------------------------------------------------------------
//  Blöcke
// ---------------------------------------------------------------------
function hitBlock(tx, ty, p, how) {
  const L = G.L, k = ty * L.w + tx, c = L.g[k];
  if (c === TILE.U || c === TILE.S || c === TILE.G || c === TILE.X || c === TILE.K) { if (c === TILE.U) SFX.bump(); return; }
  if (c === TILE.R) { if (how === 'side' || how === 'top') breakBrick(tx, ty, p); else SFX.bump(); return; }
  if (c !== TILE.Q && c !== TILE.H && c !== TILE.B) return;
  G.bumps.set(k, 0);
  bumpAbove(tx, ty, p);
  if (c === TILE.Q || c === TILE.H) {
    const what = L.content.get(k) || 'coin';
    L.g[k] = TILE.U; L.content.delete(k);
    if (what === 'coin') coinPop(tx, ty, p);
    else {
      const pick = ['bluete', 'frost', 'wirbel', 'eisbaer'];
      const kind = what === 'life' ? 'herz' : what === 'stern' ? 'stern' : (!p || p.power === 0) ? 'beere' : pick[Math.floor(Math.random() * pick.length)];
      spawnItem(kind, tx, ty, how === 'top');
    }
    SFX.bump();
  } else if (c === TILE.B) {
    const what = L.content.get(k);
    if (what === 'multi' || typeof what === 'number') {
      const n = (what === 'multi' ? 8 : what) - 1;
      coinPop(tx, ty, p);
      if (n <= 0) { L.g[k] = TILE.U; L.content.delete(k); } else L.content.set(k, n);
    } else if (!p || p.power > 0 || p.rammT > 0 || how === 'side') breakBrick(tx, ty, p);
    else SFX.bump();
  }
}
function breakBrick(tx, ty, p) {
  const c = tAt(tx, ty);
  setTile(tx, ty, 0); G.L.content.delete(ty * G.L.w + tx);
  SFX.brick(); addScore(p, 50);
  const col = c === TILE.R ? G.L.theme.stone : G.L.theme.brick;
  for (let i = 0; i < 4; i++) part({ x: tx * T + (i % 2 ? 34 : 14), y: ty * T + (i < 2 ? 14 : 34), vx: (i % 2 ? 1 : -1) * (120 + Math.random() * 80), vy: -(i < 2 ? 720 : 520), grav: 2400, life: 1.2, size: 15, color: col[0], color2: col[1], kind: 'debris', vr: (Math.random() - .5) * 20 });
  if (c === TILE.R) { SFX.secret(); sparkle(tx * T + T / 2, ty * T + T / 2, 10, '#fff6b0'); }
  bumpAbove(tx, ty, p);
}
function bumpAbove(tx, ty, p) {
  const top = ty * T, cx = tx * T + T / 2;
  for (const e of G.enemies) if (!e.dead && Math.abs(e.y - top) < 8 && Math.abs(e.x - cx) < T * .85 && !INVULN[e.kind] && e.kind !== 'pflanze') killEnemy(e, 'flip', p);
  for (const it of G.items) if (!it.emerge && Math.abs(it.y - top) < 8 && Math.abs(it.x - cx) < T * .8) { it.vy = -520; it.dir = it.x < cx ? -1 : 1; }
  if (tAt(tx, ty - 1) === TILE.C) { setTile(tx, ty - 1, 0); coinPop(tx, ty - 1, p, true); }
}
function coinPop(tx, ty, p, inPlace) {
  G.coinPops.push({ x: tx * T + T / 2, y: ty * T - (inPlace ? 0 : 10), vy: -760, t: 0 });
  addCoin(p);
}
function spawnItem(kind, tx, ty, down) {
  const it = { kind, x: tx * T + T / 2, y: (ty + 1) * T, w: 32, h: 34, vx: 0, vy: 0, dir: 1, emerge: down ? 0 : .55, home: ty * T, t: 0 };
  if (down) { it.y = ty * T; it.vy = -500; }
  G.items.push(it);
  SFX.sprout();
}
function applyPower(p, kind) {
  const info = ITEM_INFO[kind];
  if (!info) return;
  if (kind === 'stern') { p.starT = 10; Music.speed = 1.3; return; }
  if (kind === 'beere') { if (p.power === 0) setPower(p, 1); return; }
  setPower(p, info.power);
}
function applyItem(p, it) {
  if (it.got) return;
  it.got = true;
  if (it.kind === 'orb') { bossOrb(p, false); return; }
  if (it.kind === 'prinzessin') { bossOrb(p, true); return; }
  p.ls.power++;
  if (it.kind === 'herz') gainLife(p, it.x, it.y - 40);
  else {
    if (it.kind === 'beere' && p.power > 0) { SFX.coin(); if (window.UI && UI.addInventory) UI.addInventory('beere'); popup(it.x, it.y - 70, 'Ins Inventar', '#bfe9ff'); }
    else { applyPower(p, it.kind); SFX.power(); }
    addScore(p, 1000, it.x, it.y - 40);
  }
  sparkle(it.x, it.y - 16, 10, '#fff6b0');
}

// ---------------------------------------------------------------------
//  Gegner
// ---------------------------------------------------------------------
const ENEMY_SIZE = {
  kaefer: [36, 32], flugkaefer: [36, 32], schnecke: [34, 44], igel: [38, 32], hummel: [36, 34], lavaball: [28, 30], crusher: [2 * T - 8, 2 * T - 8],
  magma: [24, 24], kugel: [36, 36], kanone: [40, 40], pflanze: [30, 60], wicht: [30, 48], stein: [18, 18], irrlicht: [34, 40],
  fisch: [40, 30], qualle: [36, 40], seeigel: [40, 40], schattenball: [30, 30],
};
const SPIKY = { igel: 1, lavaball: 1, magma: 1, pflanze: 1, irrlicht: 1, qualle: 1, seeigel: 1, stein: 1, schattenball: 1 };
const INVULN = { crusher: 1, kanone: 1, lavaball: 1, magma: 1, stein: 1, schattenball: 1 };
function makeEnemy(d) {
  const [w, h] = ENEMY_SIZE[d.kind] || [32, 32];
  const e = Object.assign({ w, h, vx: 0, vy: 0, dir: -1, active: false, dead: false, walk: 0, t: Math.random() * 9 }, d);
  if (e.kind === 'hummel' || e.kind === 'irrlicht' || e.kind === 'fisch' || e.kind === 'qualle') { e.x0 = e.x; e.y0 = e.y; }
  if (e.kind === 'lavaball') { e.home = e.y + 20; e.y = e.home; e.state = 'wait'; e.wait = 1 + (d.delay || 0) + Math.random(); }
  if (e.kind === 'crusher') { e.home = e.y; e.state = 'idle'; e.wait = 0; e.dx = 0; e.dy = 0; }
  if (e.kind === 'kanone') { e.cool = 1.5 + Math.random() * 2; e.aim = Math.PI; }
  if (e.kind === 'pflanze') { e.up = 0; e.state = 'hidden'; e.wait = 1 + Math.random(); e.base = e.y; }
  if (e.kind === 'wicht') e.cool = 1.5 + Math.random() * 1.5;
  return e;
}
const STOMP_PTS = [100, 200, 400, 800, 1000, 2000, 4000, 8000];
function killEnemy(e, how, p) {
  if (e.dead || e.kind === 'crusher' || e.kind === 'kanone') return;
  if (INVULN[e.kind] && how !== 'star') return;
  if (e.carried) { for (const q of G.players) if (q.carry && q.carry.ref === e) q.carry = null; e.carried = false; }
  hitstop(.045);
  if (how === 'stomp') {
    p.combo = (p.combo || 0) + 1;
    const pts = STOMP_PTS[Math.min(p.combo - 1, STOMP_PTS.length - 1)];
    if (p.combo > STOMP_PTS.length) gainLife(p, e.x, e.y - 50); else addScore(p, pts, e.x, e.y - 50);
    p.ls.stomps++;
    SFX.stomp(); shake(2);
    if (e.kind === 'kaefer') { e.dead = 'squash'; e.squash = true; e.removeT = .5; e.vx = 0; }
    else if (e.kind === 'flugkaefer') { e.kind = 'kaefer'; return; }
    else if (e.kind === 'schnecke') { e.shell = true; e.h = 32; e.w = 32; e.vx = 0; e.wake = 7; return; }
    else { e.dead = 'flip'; e.vy = -300; e.vx = 0; }
    dust(e.x, e.y - 10, 5);
    return;
  }
  if (p) { addScore(p, how === 'eat' ? 300 : 200, e.x, e.y - 50); p.ls.stomps++; }
  if (how === 'eat') { e.dead = 'eaten'; e.removeT = 0; sparkle(e.x, e.y - 16, 8, '#b6ff9a'); SFX.stomp(); return; }
  if (how === 'freeze') {
    e.dead = 'eaten'; e.removeT = 0;
    const kind = e.kind === 'flugkaefer' ? 'kaefer' : e.kind;
    G.plats.push({ mode: 'ice', w: 46, h: 46, bx: e.x, by: e.y, x: e.x - 23, y: e.y - 46, vx: 0, vy: 0, dx: 0, dy: 0, timer: 9, kind, dir: e.dir, t: 0 });
    SFX.ice(); sparkle(e.x, e.y - 20, 8, '#d8f6ff');
    return;
  }
  e.dead = 'flip'; e.vy = -560; e.vx = (Math.random() < .5 ? -1 : 1) * 90;
  SFX.kick(); sparkle(e.x, e.y - 16, 6);
}
function updateEnemy(e, dt) {
  const cam = G.cam;
  if (e.carried) return;
  if (!e.active) {
    if (Math.abs(e.x - cam.cx) < cam.vw / 2 + 2.5 * T || G.mode === 'attract' && Math.abs(e.x - cam.cx) < cam.vw / 2 + T) {
      e.active = true;
      const near = nearestPlayer(e.x, e.y);
      e.dir = near ? (near.x < e.x ? -1 : 1) : -1;
    } else return;
  }
  e.t += dt;
  if (e.dead) {
    if (e.dead === 'flip') { e.vy += 2400 * dt; e.x += e.vx * dt; e.y += e.vy * dt; if (e.y > G.L.h * T + 200) e.remove = true; }
    else { e.removeT -= dt; if (e.removeT <= 0) e.remove = true; }
    return;
  }
  const L = G.L;
  const near = nearestPlayer(e.x, e.y);
  switch (e.kind) {
    case 'kaefer': case 'igel': case 'schnecke': case 'flugkaefer': case 'wicht': {
      if (e.shell) {
        if (e.kickGrace > 0) e.kickGrace -= dt;
        if (e.vx) {
          e.spin = (e.spin || 0) + dt * 18 * sign(e.vx);
          for (const o of G.enemies) if (o !== e && !o.dead && o.active && !o.carried && !INVULN[o.kind] && overlap(e, enemyBox(o))) {
            if (o.shell && o.vx) killEnemy(e, 'flip', e.kicker);
            killEnemy(o, 'flip', e.kicker);
          }
          if (G.boss && !G.boss.dead && overlap(e, G.boss)) { bossDamage(1, e.kicker); killEnemy(e, 'flip', null); }
        } else {
          e.wake -= dt;
          if (e.wake <= 0) { e.shell = false; e.w = 34; e.h = 44; e.vx = 0; }
        }
      } else if (e.kind === 'wicht') {
        e.walk += dt * 7;
        e.cool -= dt;
        if (near) { const dx = near.x - e.x; e.dir = sign(dx) || e.dir; e.vx = Math.abs(dx) > 5 * T ? e.dir * 70 : Math.abs(dx) < 3 * T ? -e.dir * 50 : 0; }
        e.hold = e.cool < .6;
        if (e.cool <= 0 && near && Math.abs(near.x - e.x) < 12 * T) {
          e.cool = 2 + Math.random() * 1.2 - G.levelDiffNow * .6; e.throwT = .3;
          const dx = near.x - e.x;
          G.enemies.push(Object.assign(makeEnemy({ kind: 'stein', x: e.x + e.dir * 14, y: e.y - 40 }), { active: true, vx: clamp(dx * 1.1, -380, 380), vy: -620, life: 3 }));
        }
        if (e.throwT > 0) e.throwT -= dt;
      } else {
        e.walk += dt * 8;
        const sp = (e.kind === 'igel' ? 58 : e.kind === 'schnecke' ? 62 : 80) * (1 + G.levelDiffNow * .35);
        e.vx = e.dir * sp;
        if (e.kind === 'flugkaefer' && e.onGround) { e.vy = -720; e.onGround = false; }
      }
      e.vy = Math.min(900, e.vy + (e.kind === 'flugkaefer' ? 1700 : 2400) * dt);
      const r = moveBody(e, dt, false);
      e.onGround = r.d;
      if (r.d || r.u) e.vy = 0;
      if (r.l || r.r) {
        if (e.shell && e.vx) {
          const c = tAt(r.wx, r.wy);
          if (c === TILE.B || c === TILE.Q || c === TILE.R) hitBlock(r.wx, r.wy, e.kicker, 'side'); else SFX.bump();
          e.vx = -e.vx; e.dir = sign(e.vx);
        } else e.dir = r.r ? -1 : 1;
      }
      if (!e.shell && e.kind !== 'wicht') {
        if (r.d && e.kind === 'schnecke') {
          const fx = Math.floor((e.x + e.dir * (e.w / 2 + 3)) / T), fy = Math.floor((e.y + 2) / T);
          const c = tAt(fx, fy); if (!SOLID[c] && c !== TILE.P) e.dir = -e.dir;
        }
        for (const o of G.enemies) if (o !== e && !o.dead && o.active && !o.shell && !o.carried && (o.kind === 'kaefer' || o.kind === 'igel' || o.kind === 'schnecke') && overlap(e, o)) {
          if (sign(o.x - e.x) === e.dir) e.dir = -e.dir;
        }
      }
      platformCollideEnemy(e);
      break;
    }
    case 'hummel': {
      e.walk += dt;
      e.x += e.dir * 60 * dt;
      if (Math.abs(e.x - e.x0) > 2.6 * T) e.dir = sign(e.x0 - e.x);
      e.y = e.y0 + Math.sin(e.t * 2.6) * 28;
      break;
    }
    case 'irrlicht': {
      if (near) {
        const dx = near.x - e.x, dy = (near.y - near.h / 2) - (e.y - 20), d = Math.hypot(dx, dy) || 1;
        const sp = 48 + G.levelDiffNow * 30;
        e.x += dx / d * sp * dt; e.y += dy / d * sp * dt + Math.sin(e.t * 3) * 14 * dt;
        e.dir = sign(dx) || e.dir;
      }
      break;
    }
    case 'fisch': {
      e.x += e.dir * 90 * dt;
      e.y = e.y0 + Math.sin(e.t * 2) * 20;
      if (Math.abs(e.x - e.x0) > 4 * T || SOLID[tAt(Math.floor((e.x + e.dir * 22) / T), Math.floor((e.y - 15) / T))]) e.dir = -e.dir;
      break;
    }
    case 'qualle': e.y = e.y0 + Math.sin(e.t * 1.4) * 60; break;
    case 'seeigel': break;
    case 'lavaball': {
      if (e.state === 'wait') { e.wait -= dt; e.y = e.home; e.vy = 0; if (e.wait <= 0) { e.state = 'jump'; e.vy = -Math.sqrt(2 * 1800 * (e.home - e.top)); } }
      else {
        e.vy += 1800 * dt; e.y += e.vy * dt;
        if (Math.random() < .3) part({ x: e.x + (Math.random() - .5) * 10, y: e.y - 14, vx: 0, vy: 40, life: .4, size: 5, color: '#ff9a2a', kind: 'ember' });
        if (e.vy > 0 && e.y >= e.home) { e.state = 'wait'; e.wait = 1.2 + Math.random(); }
      }
      break;
    }
    case 'magma': case 'stein': {
      e.vy += 1600 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
      const floor = L.arena && e.kind === 'magma' ? L.arena.gy * T : null;
      if (floor && e.y >= floor) { e.y = floor; e.vy = -e.vy * .5; e.bounces = (e.bounces || 0) + 1; if (e.bounces > 2) e.remove = true; }
      if (e.kind === 'stein' && e.vy > 0 && SOLID[tAt(Math.floor(e.x / T), Math.floor((e.y - 2) / T))]) { e.remove = true; dust(e.x, e.y, 3, 'rgba(160,150,140,.8)'); }
      if (e.kind === 'magma' && Math.random() < .4) part({ x: e.x, y: e.y - 12, vx: 0, vy: -20, life: .35, size: 5, color: '#ff9a2a', kind: 'ember' });
      if (e.life <= 0) e.remove = true;
      break;
    }
    case 'schattenball': {
      e.x += e.vx * dt; e.y += Math.sin(e.t * 6) * 60 * dt; e.life -= dt;
      if (Math.random() < .5) part({ x: e.x, y: e.y - 14, vx: -e.vx * .1, vy: 0, life: .4, size: 7, color: 'rgba(180,80,255,.8)', kind: 'ember' });
      if (e.life <= 0) e.remove = true;
      break;
    }
    case 'kugel': {
      e.x += e.vx * dt; e.life -= dt; e.dir = sign(e.vx);
      if (e.life <= 0) e.remove = true;
      break;
    }
    case 'kanone': {
      if (e.flash > 0) e.flash -= dt;
      if (near) { const want = near.x < e.x ? Math.PI : 0; e.aim += (want - e.aim) * Math.min(1, dt * 4); }
      e.cool -= dt;
      if (e.cool <= 0 && near && Math.abs(near.x - e.x) > 2 * T && Math.abs(near.x - e.x) < 13 * T) {
        e.cool = 3.2 - G.levelDiffNow * 1.2;
        const d = near.x < e.x ? -1 : 1;
        G.enemies.push(Object.assign(makeEnemy({ kind: 'kugel', x: e.x + d * 40, y: e.y - T * .55 + 20 }), { active: true, vx: d * (210 + G.levelDiffNow * 80), life: 7, dir: d }));
        e.flash = .25; SFX.cannon(); shake(2);
        for (let i = 0; i < 6; i++) part({ x: e.x + d * 40, y: e.y - T * .55, vx: d * Math.random() * 200, vy: (Math.random() - .5) * 120, life: .5, size: 9, color: 'rgba(90,80,100,.7)', kind: 'dust' });
      }
      break;
    }
    case 'pflanze': {
      const close = G.players.some(p => p.state === 'play' && Math.abs(p.x - e.x) < 1.4 * T && p.y <= e.base + 4);
      if (e.state === 'hidden') { e.wait -= dt; if (e.wait <= 0 && !close) e.state = 'rise'; }
      else if (e.state === 'rise') { e.up = Math.min(1, e.up + dt * 2); if (e.up >= 1) { e.state = 'out'; e.wait = 1.4; } }
      else if (e.state === 'out') { e.wait -= dt; if (e.wait <= 0) e.state = 'sink'; }
      else if (e.state === 'sink') { e.up = Math.max(0, e.up - dt * 2); if (e.up <= 0) { e.state = 'hidden'; e.wait = 1.4 + Math.random(); } }
      e.h = 10 + 56 * e.up; e.y = e.base;
      break;
    }
    case 'crusher': {
      const prevY = e.y;
      if (e.state === 'idle') {
        e.wait -= dt;
        if (e.wait <= 0) for (const p of G.players) if (p.state === 'play' && Math.abs(p.x - e.x) < e.w / 2 + 24 && p.y > e.y) { e.state = 'fall'; e.vy = 0; break; }
      } else if (e.state === 'fall') {
        e.vy = Math.min(1300, e.vy + 3200 * dt); e.y += e.vy * dt;
        if (e.y >= e.floor) { e.y = e.floor; e.state = 'wait'; e.wait = .9; shake(7); SFX.pound(); dust(e.x - 30, e.y, 4); dust(e.x + 30, e.y, 4); }
      } else if (e.state === 'wait') { e.wait -= dt; if (e.wait <= 0) e.state = 'rise'; }
      else if (e.state === 'rise') { e.y -= 130 * dt; if (e.y <= e.home) { e.y = e.home; e.state = 'idle'; e.wait = .6; } }
      e.dy = e.y - prevY; e.dx = 0;
      break;
    }
  }
  if (e.y > L.h * T + 100) e.remove = true;
  if (L.theme.lava && !INVULN[e.kind] && e.y > (L.h - 2) * T + 10) e.remove = true;
  if (G.mode !== 'attract' && e.x < cam.cx - cam.vw / 2 - 30 * T) e.remove = true;
}
function platformCollideEnemy(e) {
  if (e.vy < 0) return;
  for (const s of G.plats) {
    if (s.state === 'gone' || s.carried) continue;
    if (e.y >= s.y && e.y - e.vy * STEP - 1 <= s.y + 2 + Math.max(0, s.dy) && e.x > s.x && e.x < s.x + s.w) { e.y = s.y; e.vy = 0; e.x += s.dx; e.onGround = true; }
  }
}
function nearestPlayer(x, y) {
  let best = null, bd = 1e9;
  for (const p of G.players) if (p.state === 'play') { const d = Math.abs(p.x - x) + Math.abs(p.y - y) * .5; if (d < bd) { bd = d; best = p; } }
  return best;
}
function enemyBox(e) {
  if (e.kind === 'pflanze') return { x: e.x, y: e.base, w: 30, h: e.h };
  if (e.kind === 'kanone') return { x: e.x, y: e.y, w: 44, h: 44 };
  return e;
}
function playerVsEnemies(p) {
  if (p.state !== 'play' || p.carried) return;
  for (const e of G.enemies) {
    if (e.dead || !e.active || e.carried) continue;
    if (e.kind === 'crusher') {
      if (p.vy >= 0 && p.prevBottom <= e.y - e.h + 4 + Math.max(0, -e.dy) && p.y >= e.y - e.h && p.x + p.w / 2 > e.x - e.w / 2 && p.x - p.w / 2 < e.x + e.w / 2) {
        p.y = e.y - e.h; p.vy = 0; p.onGround = true; p.onPlat = { dx: 0, dy: e.state === 'rise' ? -130 * STEP : 0 };
        continue;
      }
      const box = { x: e.x, y: e.y - 4, w: e.w - 8, h: e.h - 8 };
      if (overlap(p, box)) {
        if (e.state === 'fall' && p.y > e.y - 10) { p.starT = 0; p.inv = 0; die(p, false); }
        else if (p.y - p.h < e.y - 6) { hurt(p); p.vx = sign(p.x - e.x) * 300; }
      }
      continue;
    }
    if (e.kind === 'kanone') continue;
    if (e.kind === 'pflanze' && e.up < .3) continue;
    const box = enemyBox(e);
    if (!overlap(p, box)) continue;
    if (p.starT > 0 || p.rammT > 0 || p.slide) {
      if (!INVULN[e.kind]) killEnemy(e, 'flip', p);
      else if (p.starT > 0) killEnemy(e, 'star', p);
      continue;
    }
    if (e.shell && !e.vx) {
      const d = p.x < e.x ? 1 : -1;
      e.vx = d * 580; e.dir = d; e.kickGrace = .3; e.kicker = p;
      addScore(p, 400, e.x, e.y - 40); SFX.kick();
      if (p.vy > 0 && p.prevBottom <= e.y - e.h + 10) p.vy = -500;
      continue;
    }
    const fromAbove = p.vy > 0 && p.prevBottom <= box.y - box.h * .45 + 6;
    if (fromAbove && !SPIKY[e.kind]) {
      if (e.shell && e.vx) { e.vx = 0; e.wake = 7; SFX.stomp(); addScore(p, 100, e.x, e.y - 40); }
      else if (e.kind === 'kugel') { e.dead = 'flip'; e.vy = 0; e.vx = 0; SFX.stomp(); addScore(p, 200, e.x, e.y - 50); p.ls.stomps++; hitstop(.045); }
      else killEnemy(e, 'stomp', p);
      p.y = box.y - box.h; p.vy = p.inp.j ? -840 : -570; p.pounding = false;
      p.canDouble = true; p.whirlUsed = false; p.floatFuel = Math.max(p.floatFuel, .6);
      p.sx = .8; p.sy = 1.2;
      continue;
    }
    if (e.shell && e.kickGrace > 0 && e.kicker === p) continue;
    hurt(p);
  }
}

// ---------------------------------------------------------------------
//  Feuerketten und Eisblöcke
// ---------------------------------------------------------------------
function updateChains(dt) {
  for (const f of G.chains) {
    f.a += f.speed * dt;
    for (const p of G.players) {
      if (p.state !== 'play' || p.starT > 0) continue;
      for (let i = 1; i < f.n; i++) {
        const x = f.cx + Math.cos(f.a) * i * 19, y = f.cy + Math.sin(f.a) * i * 19;
        if (Math.abs(p.x - x) < p.w / 2 + 7 && y > p.y - p.h - 7 && y < p.y + 4) { hurt(p); break; }
      }
    }
  }
}
function updateIce(s, dt) {
  if (s.carried) return;
  s.t += dt;
  const body = { x: s.bx, y: s.by, w: s.w, h: s.h, vx: s.vx, vy: Math.min(900, s.vy + 2400 * dt) };
  const ox = s.x, oy = s.y;
  const r = moveBody(body, dt, false);
  s.bx = body.x; s.by = body.y; s.vy = r.d ? 0 : body.vy;
  if (s.vx) {
    for (const o of G.enemies) if (!o.dead && o.active && !INVULN[o.kind] && overlap(body, enemyBox(o))) killEnemy(o, 'flip', s.thrower);
    if (G.boss && !G.boss.dead && overlap(body, G.boss)) { bossDamage(1, s.thrower); s.timer = 0; s.shatter = true; }
    if (r.l || r.r) {
      const c = tAt(r.wx, r.wy);
      if (c === TILE.B || c === TILE.Q || c === TILE.R) hitBlock(r.wx, r.wy, s.thrower, 'side');
      s.timer = 0; s.shatter = true;
    }
  }
  s.timer -= dt;
  s.x = s.bx - s.w / 2; s.y = s.by - s.h;
  s.dx = s.x - ox; s.dy = s.y - oy;
  if (s.timer <= 0) {
    s.gone2 = true;
    if (!s.shatter && s.kind) { const e = makeEnemy({ kind: s.kind, x: s.bx, y: s.by }); e.active = true; G.enemies.push(e); }
    SFX.brick();
    for (let i = 0; i < 6; i++) part({ x: s.bx + (Math.random() - .5) * 30, y: s.by - 20, vx: (Math.random() - .5) * 400, vy: -300 - Math.random() * 300, grav: 2000, life: .8, size: 10, color: '#d8f6ff', color2: '#7ac8f0', kind: 'debris', vr: 10 });
  }
  if (s.by > G.L.h * T + 100) s.gone2 = true;
}

// ---------------------------------------------------------------------
//  Bosse
// ---------------------------------------------------------------------
function makeBoss(d) {
  const multi = G.players.length > 2 ? 1 : 0;
  const w = (G.node && G.node.world) || 1;
  if (d.boss === 'krax') {
    const hp = 3 + multi + (w > 4 ? 1 : 0);
    return { type: 'krax', x: d.x, y: d.y, w: 120, h: 90, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'sleep', t: 0, hurtT: 0, walk: 0, dead: false, timer: 0, name: 'Panzerkäfer Krax' };
  }
  if (d.boss === 'morvax') {
    const hp = 6 + multi;
    return { type: 'morvax', x: d.x, y: d.y, w: 90, h: 200, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'sleep', t: 0, hurtT: 0, walk: 0, dead: false, timer: 0, name: 'Morvax, der Schattenkönig' };
  }
  const look = d.look || w;
  const hp = Math.min(8, 3 + multi + Math.floor((w - 1) / 2));
  return { type: 'koloss', look, x: d.x, y: d.y, w: 140, h: 150, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'sleep', t: 0, hurtT: 0, walk: 0, squash: 0, dead: false, timer: 0, onGround: true, name: (BOSS_LOOK[look] || BOSS_LOOK[1]).name };
}
function bossLand(b) {
  shake(12); SFX.quake(); b.squash = 1;
  dust(b.x - 50, b.y, 8); dust(b.x + 50, b.y, 8);
  for (const p of G.players) if (p.state === 'play' && p.onGround && p.y >= G.L.arena.gy * T - 2) { p.stunT = .7; p.vy = -300; p.onGround = false; }
}
function updateBoss(b, dt) {
  const A = G.L.arena;
  b.t += dt;
  if (b.hurtT > 0) b.hurtT -= dt;
  if (b.squash) b.squash *= Math.pow(.02, dt);
  if (b.state === 'sleep') return;
  if (b.dead) {
    b.deadT += dt;
    if (Math.random() < .5) part({ x: b.x + (Math.random() - .5) * 120, y: b.y - Math.random() * b.h, vx: (Math.random() - .5) * 300, vy: -Math.random() * 400, grav: 1200, life: .8, size: 10, color: Math.random() < .5 ? '#ff9a2a' : '#4a3a42', kind: 'ember' });
    if (b.deadT > 1.8 && !b.gone) {
      b.gone = true; shake(14); SFX.brick(); SFX.quake();
      for (let i = 0; i < 30; i++) part({ x: b.x + (Math.random() - .5) * 120, y: b.y - Math.random() * b.h, vx: (Math.random() - .5) * 900, vy: -Math.random() * 900, grav: 2000, life: 1.4, size: 16, color: b.type === 'morvax' ? '#3a1050' : '#5a4a52', color2: '#2a1a20', kind: 'debris', vr: 10 });
      if (b.type === 'morvax') { const c = G.cage; G.cage = null; G.items.push({ kind: 'prinzessin', x: c.x, y: c.y + 50, w: 50, h: 90, vx: 0, vy: 0, t: 0 }); sparkle(c.x, c.y, 30, '#e8d8ff'); }
      else G.items.push({ kind: 'orb', x: (A.x0 + A.x1) / 2, y: A.gy * T - 160, w: 60, h: 60, vx: 0, vy: 0, t: 0 });
    }
    return;
  }
  b.timer -= dt;
  const tgt = nearestPlayer(b.x, b.y);
  const angry = b.hp <= b.maxHp / 2;
  if (b.type === 'krax') updateKrax(b, dt, tgt, angry);
  else if (b.type === 'morvax') updateMorvax(b, dt, tgt, angry);
  else updateKoloss(b, dt, tgt, angry);
  b.vy += 2600 * dt;
  b.y += b.vy * dt;
  if (b.y >= A.gy * T) {
    b.y = A.gy * T;
    if (!b.onGround && b.vy > 300) { bossLand(b); if (b.state === 'jump') { b.state = 'walk'; b.timer = 1.4 + Math.random(); } }
    b.vy = 0; b.onGround = true;
  } else b.onGround = false;
  b.x += b.vx * dt;
  const minX = A.x0 + b.w / 2 + 10, maxX = A.x1 - b.w / 2 - 10;
  const bounce = d => { b.dir = d; if (b.state === 'spin') { b.vx = d * Math.abs(b.vx); shake(5); SFX.bump(); } else if (b.state === 'charge') { b.vx = 0; b.state = 'walk'; b.timer = 1; shake(6); SFX.bump(); } };
  if (b.x < minX) { b.x = minX; bounce(1); }
  if (b.x > maxX) { b.x = maxX; bounce(-1); }
  for (const p of G.players) {
    if (p.state !== 'play' || p.carried) continue;
    const box = { x: b.x, y: b.y, w: b.w - 20, h: b.h - 10 };
    if (!overlap(p, box)) continue;
    if (p.vy > 0 && p.prevBottom <= b.y - b.h + 40) {
      p.vy = -950; p.y = b.y - b.h + 10; p.whirlUsed = false;
      if (b.type === 'krax' && b.state === 'spin') { SFX.bump(); continue; }
      if (b.hurtT <= 0) bossDamage(1, p, true);
    } else if (p.starT > 0) { if (b.hurtT <= 0) bossDamage(1, p); }
    else { hurt(p); p.vx = sign(p.x - b.x) * 420; p.vy = -420; }
  }
}
function updateKoloss(b, dt, tgt, angry) {
  const speed = 85 + (b.maxHp - b.hp) * 28;
  if (b.state === 'intro') { b.vx = 0; if (b.timer <= 0) { b.state = 'walk'; b.timer = 2; } return; }
  if (b.state === 'walk') {
    b.walk += dt * 5;
    if (tgt && Math.random() < dt * .8) b.dir = tgt.x < b.x ? -1 : 1;
    b.vx = b.dir * speed;
    if (b.timer <= 0) {
      const r = Math.random();
      if (r < .4) { b.state = 'jump'; b.vy = -1150; b.onGround = false; b.vx = tgt ? clamp((tgt.x - b.x) * .8, -320, 320) : 0; }
      else if (r < .75 || !angry) { b.state = 'throw'; b.timer = 1.1; b.thrown = 0; b.vx = 0; }
      else { b.state = 'charge'; b.timer = 1.6; b.vx = 0; b.wind = .5; }
    }
  } else if (b.state === 'throw') {
    const n = angry ? 4 : 3;
    if (b.thrown < n && b.timer < 1 - b.thrown * .22) {
      b.thrown++;
      const dx = tgt ? tgt.x - b.x : b.dir * 300;
      G.enemies.push(Object.assign(makeEnemy({ kind: 'magma', x: b.x + b.dir * 50, y: b.y - 120 }), { active: true, vx: clamp(dx * .9 + (Math.random() - .5) * 200, -520, 520), vy: -700 - Math.random() * 200, life: 4 }));
      SFX.fire();
    }
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.6 + Math.random() * 1.5; }
  } else if (b.state === 'charge') {
    b.wind -= dt;
    if (b.wind > 0) { b.vx = 0; if (Math.random() < .3) dust(b.x - b.dir * 40, b.y, 1); if (tgt) b.dir = tgt.x < b.x ? -1 : 1; }
    else { b.vx = b.dir * 520; b.walk += dt * 12; if (Math.random() < .5) dust(b.x - b.dir * 50, b.y, 1); }
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.5; }
  }
}
function updateKrax(b, dt, tgt, angry) {
  if (b.state === 'intro') { b.vx = 0; if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.6; } return; }
  if (b.state === 'walk') {
    b.walk += dt * 6;
    if (tgt) b.dir = tgt.x < b.x ? -1 : 1;
    b.vx = b.dir * (110 + (b.maxHp - b.hp) * 25);
    if (b.timer <= 0) { b.state = 'wind'; b.timer = .6; b.vx = 0; }
  } else if (b.state === 'wind') {
    b.vx = 0; if (Math.random() < .4) dust(b.x - b.dir * 60, b.y, 1);
    if (b.timer <= 0) { b.state = 'charge'; b.timer = 2.2; b.vx = b.dir * (angry ? 560 : 460); SFX.dash(); }
  } else if (b.state === 'charge') {
    b.walk += dt * 14;
    if (Math.random() < .5) dust(b.x - b.dir * 60, b.y, 1);
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.5 + Math.random(); }
  } else if (b.state === 'spin') {
    b.spin = (b.spin || 0) + dt * 18 * sign(b.vx);
    if (b.onGround && Math.random() < dt * 1.5) b.vy = -700;
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.8; b.vx = 0; b.h = 90; }
  }
}
function updateMorvax(b, dt, tgt, angry) {
  const A = G.L.arena;
  if (b.state === 'intro') { b.vx = 0; if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.8; } return; }
  if (b.state === 'walk') {
    b.walk += dt * 5;
    if (tgt) b.dir = tgt.x < b.x ? -1 : 1;
    b.vx = b.dir * (70 + (angry ? 60 : 0));
    if (b.timer <= 0) {
      const r = Math.random();
      if (r < .3) { b.state = 'cast'; b.timer = 1.2; b.cast = 0; b.vx = 0; }
      else if (r < .55) { b.state = 'jump'; b.vy = -1250; b.onGround = false; b.vx = tgt ? clamp((tgt.x - b.x) * .9, -380, 380) : 0; }
      else if (r < .8) { b.state = 'rain'; b.timer = 2.2; b.vx = 0; b.rained = 0; }
      else { b.state = 'summon'; b.timer = 1; b.vx = 0; }
    }
  } else if (b.state === 'cast') {
    const n = angry ? 3 : 2;
    if (b.cast < n && b.timer < 1 - b.cast * .3) {
      b.cast++;
      const d = tgt && tgt.x < b.x ? -1 : 1;
      G.enemies.push(Object.assign(makeEnemy({ kind: 'schattenball', x: b.x + d * 60, y: b.y - 30 - b.cast * 46 }), { active: true, vx: d * (300 + (angry ? 120 : 0)), life: 6 }));
      SFX.shadow();
    }
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.4 + Math.random(); }
  } else if (b.state === 'rain') {
    if (b.rained < (angry ? 9 : 6) && b.timer < 2 - b.rained * .18) {
      b.rained++;
      const x = A.x0 + T + Math.random() * (A.x1 - A.x0 - 2 * T);
      G.enemies.push(Object.assign(makeEnemy({ kind: 'magma', x, y: G.cam.top + 10 }), { active: true, vx: 0, vy: 100, life: 4 }));
    }
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 1.6; }
  } else if (b.state === 'summon') {
    if (!b.summoned && b.timer < .5) {
      b.summoned = true;
      for (const dx of [-160, 160]) { const e = makeEnemy({ kind: 'wicht', x: clamp(b.x + dx, A.x0 + T, A.x1 - T), y: A.gy * T }); e.active = true; G.enemies.push(e); sparkle(e.x, e.y - 30, 10, '#c88aff'); }
      SFX.shadow();
    }
    if (b.timer <= 0) { b.state = 'walk'; b.timer = 2; b.summoned = false; }
  }
}
function bossDamage(n, p, stomp) {
  const b = G.boss;
  if (!b || b.dead || b.state === 'sleep' || b.state === 'intro') return;
  if (stomp || n >= 1) { if (b.hurtT > 0) return; b.hurtT = 1.3; b.squash = 1; b.angry = true; SFX.bossHit(); shake(8); hitstop(.1); }
  b.hp -= n;
  if (p) addScore(p, n >= 1 ? 2000 : 100, b.x, b.y - b.h - 20);
  if (b.type === 'krax' && stomp && b.hp > 0) { b.state = 'spin'; b.timer = 2.6; b.vx = (Math.random() < .5 ? -1 : 1) * 480; b.h = 80; }
  if (b.type === 'morvax' && stomp && b.hp > 0) {
    const A = G.L.arena;
    sparkle(b.x, b.y - 100, 20, '#c88aff');
    b.x = b.x < (A.x0 + A.x1) / 2 ? A.x1 - 3 * T : A.x0 + 3 * T; b.state = 'walk'; b.timer = 1.2;
  }
  if (b.hp <= 0) {
    b.dead = true; b.deadT = 0; b.vx = 0; Music.stop(); SFX.bossHit(); if (p) p.ls.stomps += 3;
    for (const e of G.enemies) if (e.kind === 'magma' || e.kind === 'schattenball' || e.kind === 'wicht') e.remove = true;
  }
}
function bossOrb(p, princess) {
  for (const q of G.players) if (q.state === 'play') { q.state = 'goal'; q.goalPhase = 'cheer'; q.goalT = 0; q.vy = 0; q.goal = null; }
  p.ls.first = 1;
  SFX.goal(); sparkle(p.x, p.y - 40, 30, '#fff6b0');
  G.goalHow = princess ? 'final' : 'boss';
  G.goalTimer = 0;
}

// ---------------------------------------------------------------------
//  Ziel
// ---------------------------------------------------------------------
function touchGoal(p, z) {
  const frac = clamp((z.y - (p.y - p.h)) / (z.y - z.top), 0, 1);
  p.state = 'goal'; p.goalPhase = 'slide'; p.goalT = 0; p.vx = 0; p.vy = 0; p.goal = z;
  dropCarry(p);
  p.x = z.x - 16; p.face = 1; p.pounding = false; p.floating = false;
  if (frac > .93) { gainLife(p, p.x, p.y - p.h - 20); addScore(p, 5000, p.x, p.y - p.h - 50); }
  else addScore(p, frac > .7 ? 2000 : frac > .45 ? 800 : frac > .2 ? 400 : 100, p.x, p.y - p.h - 20);
  if (!z.taken) {
    z.taken = true; p.ls.first = 1;
    SFX.goal(); Music.stop();
    if (G.goalTimer < 0) G.goalHow = z.secret ? 'secret' : 'normal';
    for (let i = 0; i < 60; i++) part({ x: z.x, y: z.top, vx: (Math.random() - .5) * 700, vy: -Math.random() * 600, grav: 900, life: 2, size: 7, color: ['#4f8ff7', '#ef5350', '#3fbf5a', '#ffc531', '#ffffff'][i % 5], kind: 'confetti', vr: 10 });
  }
  if (G.goalTimer < 0) G.goalTimer = 0;
  if (G.time > 0 && !G.timeBonusDone) { G.timeBonusDone = true; addScore(p, G.time * 10); }
}
function goalAnim(p, dt) {
  const z = p.goal;
  p.goalT += dt;
  if (p.goalPhase === 'slide' && z) {
    p.y = Math.min(z.y - 22, p.y + 380 * dt);
    if (z.flagY === undefined || z.flagY < p.y - 40) z.flagY = Math.min(z.y - 60, Math.max(z.flagY || z.top, p.y - 50));
    if (p.y >= z.y - 22) { p.goalPhase = 'drop'; p.x = z.x + 14; p.vy = -200; }
  } else if (p.goalPhase === 'drop' && z) {
    p.vy += 2600 * dt; p.y += p.vy * dt;
    if (p.y >= z.y) { p.y = z.y; p.goalPhase = 'walk'; p.goalT = 0; p.sx = 1.2; p.sy = .8; }
  } else if (p.goalPhase === 'walk') {
    p.x += 170 * dt; p.walk += dt * 9;
    if (!SOLID[tAt(Math.floor(p.x / T), Math.floor((p.y + 1) / T))]) { p.vy += 2600 * dt; p.y += p.vy * dt; } else { p.vy = 0; p.y = Math.floor((p.y + 1) / T) * T; }
    if (p.goalT > 1.2) { p.goalPhase = 'cheer'; p.goalT = 0; p.floor = p.y; }
  } else if (p.goalPhase === 'cheer') {
    const fl = p.floor !== undefined ? p.floor : (G.L.arena ? G.L.arena.gy * T : p.y);
    if (!p.vy && p.y >= fl && Math.random() < dt * 2) p.vy = -500;
    if (p.vy || p.y < fl) { p.vy += 2600 * dt; p.y += p.vy * dt; if (p.y >= fl) { p.y = fl; p.vy = 0; } }
  }
}

// ---------------------------------------------------------------------
//  Level starten
// ---------------------------------------------------------------------
function loadLevel(L) {
  G.L = L;
  chunkCache.clear(); G.bg = null;
  G.enemies = []; G.items = []; G.fbs = []; G.parts = []; G.pops = []; G.plats = []; G.springs = []; G.checks = []; G.chains = [];
  G.starEnts = []; G.bumps.clear(); G.coinPops = []; G.goals = []; G.boss = null; G.cage = null;
  G.goalTimer = -1; G.wipeT = -1; G.arenaLocked = false; G.goalHow = 'normal'; G.timeBonusDone = false; G.flash = 0; G.hitstop = 0;
  G.decoDyn = L.deko.filter(d => d.dyn);
  for (const d of L.ents) {
    if (d.type === 'enemy') G.enemies.push(makeEnemy(d));
    else if (d.type === 'plat') G.plats.push(Object.assign({ dx: 0, dy: 0, t: 0, dirp: 1, state: 'idle', ox: d.x, oy: d.y }, d));
    else if (d.type === 'feder') G.springs.push({ x: d.x, y: d.y, comp: 0, superf: !!d.superf, power: d.power || 1320 });
    else if (d.type === 'check') G.checks.push({ x: d.x, y: d.y, on: G.checkReached });
    else if (d.type === 'sternmuenze') G.starEnts.push({ x: d.x, y: d.y, idx: d.idx, got: G.starGot[d.idx], prev: G.starPrev && G.starPrev[d.idx] });
    else if (d.type === 'ziel') G.goals.push({ x: d.x, y: d.y, top: d.top, taken: false, secret: !!d.secret });
    else if (d.type === 'boss') G.boss = makeBoss(d);
    else if (d.type === 'feuerkette') G.chains.push(Object.assign({}, d));
  }
  if (G.boss && G.boss.type === 'morvax') G.cage = { x: (L.arena.x0 + L.arena.x1) / 2, y: L.arena.gy * T - 7 * T };
  G.clouds = [];
  const rng = makeRng(L.seed + 5);
  for (let i = 0; i < L.theme.clouds; i++) G.clouds.push({ x: rng.f(), y: .05 + rng.f() * .45, s: .5 + rng.f() * .9, sp: .002 + rng.f() * .004 });
  G.ambient = [];
}
function levelKindOf(nd) { return nd.type === 'turm' ? 'turm' : nd.type === 'burg' ? (WORLD_SPECS[nd.world - 1].final ? 'final' : 'burg') : 'normal'; }
function startLevel() {
  const nd = G.node;
  const kind = levelKindOf(nd);
  const themeKey = kind === 'turm' ? 'turm' : kind === 'final' ? 'schatten' : kind === 'burg' ? 'burg' : nd.theme;
  const diff = Prog.levelDiff(nd);
  G.levelDiffNow = diff;
  loadLevel(generateLevel({ themeKey, seed: Prog.levelSeed(nd.id), diff, kind, secret: !!nd.secret, bossLook: nd.world }));
  const L = G.L;
  const sp = G.checkReached && L.checkpoint ? L.checkpoint : L.spawn;
  G.players.forEach((p, i) => {
    if (p.state === 'out' && G.lives > 0) { G.lives--; p.state = 'play'; }
    if (p.state !== 'out') p.state = 'play';
    p.x = sp.x - (i - (G.players.length - 1) / 2) * 34;
    p.y = sp.y; p.vx = p.vy = 0; p.onGround = true; p.face = 1; p.inv = 0; p.starT = 0; p.pounding = false;
    p.dashT = p.rammT = p.tongueT = 0; p.floating = false; p.wallSlide = false; p.stunT = 0; p.goalPhase = ''; p.goal = null;
    p.carry = null; p.carried = null; p.slide = false; p.whirlUsed = false; p.swim = false; p.floor = undefined;
    setPower(p, p.power);
  });
  if (G.startPower) { for (const p of G.players) if (p.state === 'play') applyPower(p, G.startPower); G.startPower = null; }
  Music.speed = 1; G.hurry = false;
  G.time = L.time; G.timeAcc = 0;
  G.cam.cx = sp.x + 4 * T; G.cam.cy = sp.y - 3 * T; G.cam.zoom = 1;
  updateCamera(1, true);
  G.introT = 1.6;
  G.mode = 'play';
  const mood = Object.assign({}, L.theme.music);
  if (kind !== 'normal') mood.bpm += 6;
  Music.play(composeSong(Prog.levelSeed(nd.id), mood));
}
function restartFromCheckpoint() {
  G.players.forEach(p => setPower(p, 0));
  startLevel();
}

// ---------------------------------------------------------------------
//  Kamera
// ---------------------------------------------------------------------
function updateCamera(dt, snap) {
  const cam = G.cam, L = G.L;
  const baseW = SW / baseScale, baseH = VIEW_TILES_H * T;
  let act = G.players.filter(p => p.state === 'play' || p.state === 'goal');
  if (!act.length) act = G.players.filter(p => p.state === 'dead');
  let tx = cam.cx, ty = cam.cy, zoomT = 1;
  if (G.mode === 'attract') {
    tx = cam.cx + 110 * dt; ty = (L.h - 7) * T;
  } else if (G.arenaLocked) {
    const A = L.arena;
    tx = (A.x0 + A.x1) / 2; ty = A.gy * T - 5 * T;
    zoomT = Math.min(1, baseW / (A.x1 - A.x0 + T));
  } else if (act.length) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of act) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y - p.h); maxY = Math.max(maxY, p.y); }
    zoomT = clamp(Math.min(baseW / (maxX - minX + 8 * T), baseH / (maxY - minY + 7 * T)), .68, 1);
    tx = (minX + maxX) / 2;
    if (act.length === 1) { cam.look = lerp(cam.look || 0, act[0].face * 1.6 * T, Math.min(1, dt * 1.5)); tx += cam.look; }
    ty = (minY + maxY) / 2 - .5 * T;
  }
  cam.zoom += (zoomT - cam.zoom) * Math.min(1, snap ? 1 : dt * 2.2);
  cam.vw = baseW / cam.zoom; cam.vh = baseH / cam.zoom;
  const k = snap ? 1 : Math.min(1, dt * 7), ky = snap ? 1 : Math.min(1, dt * 3.5);
  cam.cx += (tx - cam.cx) * k;
  cam.cy += (ty - cam.cy) * ky;
  const LW = L.w * T, LH = L.h * T;
  cam.cx = clamp(cam.cx, cam.vw / 2, Math.max(cam.vw / 2, LW - cam.vw / 2));
  const minTop = L.theme.ceiling ? 0 : -4 * T;
  let top = cam.cy - cam.vh / 2;
  top = clamp(top, minTop, LH - cam.vh);
  if (cam.vh > LH - minTop) top = LH - cam.vh;
  cam.cy = top + cam.vh / 2;
  cam.left = cam.cx - cam.vw / 2; cam.top = top;
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 30);
}
function keepInView(p) {
  const cam = G.cam;
  const l = cam.left + 18, r = cam.left + cam.vw - 18;
  if (p.x - p.w / 2 < l) { p.x = l + p.w / 2; if (p.vx < 0) p.vx = 0; if (bodyStuckE(p)) toBubble(p); }
  else if (p.x + p.w / 2 > r) { p.x = r - p.w / 2; if (p.vx > 0) p.vx = 0; if (bodyStuckE(p)) toBubble(p); }
}

// ---------------------------------------------------------------------
//  Haupt-Update
// ---------------------------------------------------------------------
function update(dt) {
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.t += dt;
  const L = G.L;
  if (G.introT > 0) G.introT -= dt;
  if (G.flash > 0) G.flash -= dt;
  if (G.introT <= 0 && G.goalTimer < 0 && G.wipeT < 0 && !(G.boss && G.boss.dead)) {
    G.timeAcc += dt;
    while (G.timeAcc >= .4) {
      G.timeAcc -= .4; G.time--;
      if (G.time === 100 && !G.hurry) { G.hurry = true; SFX.hurry(); Music.speed = Math.max(Music.speed, 1.3); }
      if (G.time <= 0) { G.time = 0; for (const p of G.players) if (p.state === 'play') { p.inv = 0; p.starT = 0; die(p, false); } }
    }
  }
  for (const s of G.plats) {
    if (s.mode === 'ice') { updateIce(s, dt); continue; }
    s.t += dt;
    const ox = s.x, oy = s.y;
    if (s.mode === 'h') { s.x += s.dirp * s.speed * dt; if (s.x > s.x1) { s.x = s.x1; s.dirp = -1; } if (s.x < s.x0) { s.x = s.x0; s.dirp = 1; } }
    else if (s.mode === 'v') { s.y += s.dirp * s.speed * dt; if (s.y > s.y1) { s.y = s.y1; s.dirp = -1; } if (s.y < s.y0) { s.y = s.y0; s.dirp = 1; } }
    else if (s.mode === 'fall') {
      if (s.state === 'idle' && s.stood) { s.state = 'shake'; s.st = .45; }
      else if (s.state === 'shake') { s.st -= dt; if (s.st <= 0) { s.state = 'fall'; s.vy = 0; } }
      else if (s.state === 'fall') { s.vy = Math.min(700, s.vy + 1600 * dt); s.y += s.vy * dt; if (s.y > L.h * T + 80) { s.state = 'gone'; s.st = 3; } }
      else if (s.state === 'gone') { s.st -= dt; if (s.st <= 0) { s.state = 'idle'; s.x = s.ox; s.y = s.oy; } }
    }
    s.stood = false;
    s.dx = s.x - ox; s.dy = s.y - oy;
  }
  G.plats = G.plats.filter(s => !s.gone2);
  for (const p of G.players) { p.prevBottom = p.y; updatePlayer(p, dt); }
  for (const p of G.players) updateCarry(p);
  const multi = G.players.length > 1;
  for (const p of G.players) if (p.state === 'play') {
    playerVsEnemies(p);
    if (multi && !G.arenaLocked && !p.carried) keepInView(p);
  }
  for (const a of G.players) for (const b of G.players) {
    if (a === b || a.state !== 'play' || b.state !== 'play' || a.carried || b.carried) continue;
    if (a.vy > 0 && a.prevBottom <= b.y - b.h + 6 && overlap(a, b) && a.y < b.y - b.h + 20) {
      a.y = b.y - b.h; a.vy = a.inp.j ? -780 : -480; b.sy = .7; b.sx = 1.25; SFX.stomp(); a.canDouble = true; a.whirlUsed = false;
    }
  }
  for (const s of G.springs) {
    s.comp = Math.max(0, s.comp - dt * 4);
    for (const p of G.players) if (p.state === 'play' && !p.carried && p.vy >= 0 && Math.abs(p.x - s.x) < (s.superf ? 40 : 26) && p.y >= s.y - 36 && p.prevBottom <= s.y - 24) {
      p.y = s.y - 30; p.vy = -s.power; p.springT = true; p.onGround = false; p.pounding = false; s.comp = 1; p.canDouble = true; p.whirlUsed = false;
      if (s.superf) { SFX.secret(); sparkle(s.x, s.y - 30, 14); } else SFX.spring();
    }
  }
  for (const c of G.checks) if (!c.on) for (const p of G.players) if (p.state === 'play' && Math.abs(p.x - c.x) < 30 && p.y > c.y - 120) {
    c.on = true; G.checkReached = true; SFX.checkpoint(); sparkle(c.x + 20, c.y - 95, 14);
    for (const q of G.players) if (q.state === 'play' && q.power === 0) setPower(q, 1);
    popup(c.x, c.y - 140, 'Zwischenziel!', '#ffd23a');
    break;
  }
  for (const s of G.starEnts) if (!s.got) for (const p of G.players) if (p.state === 'play' && Math.abs(p.x - s.x) < 34 && p.y - p.h < s.y + 26 && p.y > s.y - 26) {
    s.got = true; G.starGot[s.idx] = true; p.ls.stars++; addScore(p, 2000, s.x, s.y - 40); SFX.starcoin(); sparkle(s.x, s.y, 18);
    break;
  }
  for (const z of G.goals) for (const p of G.players) if (p.state === 'play' && !p.carried && Math.abs(p.x - z.x) < p.w / 2 + 6 && p.y - p.h < z.y && p.y > z.top) touchGoal(p, z);
  if (L.arena && !G.arenaLocked) {
    const inside = G.players.find(p => p.state === 'play' && p.x > L.arena.x0 + 3 * T);
    if (inside) {
      G.arenaLocked = true;
      const wx = Math.floor(L.arena.x0 / T) - 1;
      for (let ty = 0; ty < L.arena.gy; ty++) setTile(wx, ty, TILE.S);
      chunkCache.clear();
      for (const p of G.players) {
        if (p.state === 'play' && p.x < L.arena.x0 + T) { dropCarry(p); p.x = L.arena.x0 + 2 * T; p.y = L.arena.gy * T; p.vx = p.vy = 0; }
        if (p.state === 'bubble') p.bx = L.arena.x0 + 4 * T;
      }
      if (G.boss) { G.boss.state = 'intro'; G.boss.timer = 1.8; shake(10); SFX.quake(); }
      const final = G.boss && G.boss.type === 'morvax';
      Music.play(composeSong(L.seed + 99, { scale: 'moll', root: final ? 48 : 52, bpm: final ? 156 : 148, lead: 'sawtooth', legato: .7 }));
    }
  }
  if (G.boss) updateBoss(G.boss, dt);
  updateChains(dt);
  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter(e => !e.remove);
  for (const it of G.items) {
    it.t += dt;
    if (it.emerge > 0) { it.emerge -= dt; it.y = it.home + T * Math.max(0, it.emerge / .55); if (it.emerge <= 0) { it.y = it.home; it.emerge = 0; it.dir = 1; } continue; }
    if (it.kind === 'orb') it.y += Math.sin(it.t * 2) * 20 * dt;
    else if (it.kind === 'prinzessin') it.y = Math.min(L.arena.gy * T, it.y + 120 * dt);
    else if (it.kind === 'bluete' || it.kind === 'frost' || it.kind === 'eisbaer') { it.vy = Math.min(900, it.vy + 2400 * dt); const r = moveBody(it, dt, false); if (r.d) it.vy = 0; }
    else if (it.kind === 'wirbel') {
      if (it.vy < 0) { it.vy += 1800 * dt; it.y += it.vy * dt; }
      else { it.vy = 60; it.x += Math.sin(it.t * 3) * 120 * dt; const r = moveBody(it, dt, false); if (r.d) it.vy = 0; }
    } else {
      it.vx = it.dir * (it.kind === 'stern' ? 210 : 140);
      it.vy = Math.min(900, it.vy + 2400 * dt);
      const r = moveBody(it, dt, false);
      if (r.d) it.vy = it.kind === 'stern' ? -780 : 0;
      if (r.l || r.r) it.dir = -it.dir;
    }
    for (const p of G.players) if (p.state === 'play' && !p.carried && overlap(p, it)) { applyItem(p, it); break; }
    if (it.y > L.h * T + 100) it.got = true;
  }
  G.items = G.items.filter(it => !it.got);
  for (const f of G.fbs) {
    f.life -= dt;
    f.vy = Math.min(800, f.vy + 2200 * dt);
    const r = moveBody(f, dt, false);
    if (r.d) f.vy = f.ice ? -330 : -430;
    if (r.l || r.r || r.u) { f.life = 0; dust(f.x, f.y - 8, 4, f.ice ? 'rgba(220,245,255,.9)' : 'rgba(255,170,60,.9)'); }
    if (Math.random() < .5) part({ x: f.x, y: f.y - 9, vx: 0, vy: -30, life: .25, size: 6, color: f.ice ? '#d8f6ff' : '#ffb02a', kind: 'ember' });
    for (const e of G.enemies) if (!e.dead && e.active && overlap(f, enemyBox(e))) {
      if (e.kind === 'lavaball' && f.ice) { f.life = 0; break; }
      if (INVULN[e.kind]) continue;
      if (f.ice && e.kind !== 'pflanze' && e.kind !== 'kugel' && e.kind !== 'irrlicht') killEnemy(e, 'freeze', f.owner);
      else killEnemy(e, 'flip', f.owner);
      f.life = 0; break;
    }
    if (G.boss && !G.boss.dead && G.boss.state !== 'sleep' && overlap(f, G.boss)) { bossDamage(.25, f.owner); f.life = 0; sparkle(f.x, f.y, 5, f.ice ? '#d8f6ff' : '#ffb02a'); }
    if (L.theme.lava && f.y > (L.h - 2) * T + 10) f.life = 0;
  }
  G.fbs = G.fbs.filter(f => f.life > 0 && Math.abs(f.x - G.cam.cx) < G.cam.vw);
  for (const [k, t] of G.bumps) { if (t > .25) G.bumps.delete(k); else G.bumps.set(k, t + dt); }
  for (const c of G.coinPops) { c.t += dt; c.vy += 2600 * dt; c.y += c.vy * dt; if (c.t > .45 && !c.done) { c.done = true; sparkle(c.x, c.y, 5); } }
  G.coinPops = G.coinPops.filter(c => !c.done);
  if (L.theme.rain && Math.random() < dt * .08) { G.flash = .35; setTimeout(() => SFX.thunder(), 250); }
  updateParticles(dt);
  updateCamera(dt);
  if (G.goalTimer >= 0) {
    G.goalTimer += dt;
    const still = G.players.filter(p => p.state === 'play').length;
    if (G.goalTimer > 5.5 || (!still && G.goalTimer > 3.2)) levelClear();
  }
  if (G.wipeT >= 0) {
    G.wipeT += dt;
    if (G.wipeT > .9) {
      G.wipeT = -1;
      if (G.lives < 0) gameOver(); else restartFromCheckpoint();
    }
  } else if (G.mode === 'play' && G.goalTimer < 0 && G.players.length && G.players.every(p => p.state === 'out' || p.state === 'bubble' || p.state === 'wait')) {
    G.wipeT = 0;
  }
}
function updateParticles(dt) {
  for (const q of G.parts) {
    q.t += dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    if (q.kind === 'dust') { q.vx *= .9; q.vy *= .9; }
    if (q.kind === 'bubble') { q.x += Math.sin(q.t * 8) * 30 * dt; if (G.L.water !== null && q.y < G.L.water) q.t = q.life; }
  }
  G.parts = G.parts.filter(q => q.t < q.life);
  for (const pp of G.pops) pp.t += dt;
  G.pops = G.pops.filter(pp => pp.t < 1.2);
}
function levelClear() {
  if (G.mode !== 'play') return;
  G.mode = 'clear';
  Music.stop();
  if (window.UI) UI.levelClear(G.goalHow);
}
function gameOver() {
  G.mode = 'over';
  Music.stop();
  if (window.UI) UI.gameOver();
}

// ---------------------------------------------------------------------
//  Zeichnen
// ---------------------------------------------------------------------
function render(dt) {
  const L = G.L;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!L) { ctx.fillStyle = '#0d0f13'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  const th = L.theme, cam = G.cam;
  const sky = ctx.createLinearGradient(0, 0, 0, cv.height);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, cv.width, cv.height);
  if (th.sun) {
    const sx = th.sun.x * cv.width, sy = th.sun.y * cv.height, r = th.sun.r * DPR * (SH / 800);
    const gl = ctx.createRadialGradient(sx, sy, r * .5, sx, sy, r * 4);
    gl.addColorStop(0, 'rgba(255,250,220,.55)'); gl.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
    ctx.fillStyle = th.sun.c; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }
  if (th.stars || th === THEMES.abend || th === THEMES.hoehle) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) { const x = hash2(i, 1) * cv.width, y = hash2(i, 2) * cv.height * .5; ctx.globalAlpha = (.5 + .5 * Math.sin(G.t * 2 + i)) * .75; ctx.fillRect(x, y, 2 * DPR, 2 * DPR); }
    ctx.globalAlpha = 1;
    if (th === THEMES.nebel || th === THEMES.schatten) {
      const mx = cv.width * .78, my = cv.height * .2, mr = 46 * DPR * SH / 800;
      const gl = ctx.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3.5); gl.addColorStop(0, th === THEMES.schatten ? 'rgba(255,90,120,.35)' : 'rgba(220,230,255,.3)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      ctx.fillStyle = th === THEMES.schatten ? '#ff8aa0' : '#e8ecff'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    }
  }
  const csp = getCloudSprite();
  for (const c of G.clouds) {
    const w = 320 * c.s * DPR * (SH / 800), h = 150 * c.s * DPR * (SH / 800);
    const span = cv.width + w * 2;
    const x = ((c.x * span - cam.left * baseScale * DPR * .05 * c.s - G.t * c.sp * span * .1) % span + span) % span - w;
    ctx.globalAlpha = th.clouds > 6 ? .95 : .85;
    ctx.drawImage(csp, x, c.y * cv.height, w, h);
  }
  ctx.globalAlpha = 1;
  if (!G.bg) G.bg = buildBackground(th, cv.height);
  const refTop = L.h * T - VIEW_TILES_H * T;
  for (const layer of G.bg) {
    const off = -((cam.left * baseScale * DPR * layer.f) % BG_W + BG_W) % BG_W;
    const yoff = -(cam.top - refTop) * baseScale * DPR * layer.f * .5;
    ctx.globalAlpha = layer.alpha;
    for (let x = off; x < cv.width; x += BG_W) ctx.drawImage(layer.canvas, Math.floor(x), yoff, BG_W + 1, cv.height);
  }
  ctx.globalAlpha = 1;
  if (th === THEMES.nebel) {
    for (let i = 0; i < 3; i++) {
      const y = cv.height * (.55 + i * .12), x = ((G.t * (12 + i * 8) * DPR - cam.left * baseScale * DPR * (.1 + i * .08)) % (cv.width * 1.5) + cv.width * 1.5) % (cv.width * 1.5) - cv.width * .25;
      const fg = ctx.createRadialGradient(x, y, 10, x, y, cv.width * .45); fg.addColorStop(0, 'rgba(150,160,190,.16)'); fg.addColorStop(1, 'rgba(150,160,190,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }
  const s = baseScale * cam.zoom * DPR;
  const shx = cam.shake ? (Math.random() - .5) * cam.shake * DPR : 0, shy = cam.shake ? (Math.random() - .5) * cam.shake * DPR : 0;
  ctx.setTransform(s, 0, 0, s, Math.round(-cam.left * s + shx), Math.round(-cam.top * s + shy));
  const t = G.t;
  for (const d of G.decoDyn) if (d.x > cam.left - 200 && d.x < cam.left + cam.vw + 200 && d.kind !== 'tor') paintDekoDyn(ctx, d, t);
  for (const d of G.decoDyn) if (d.kind === 'tor' && d.x > cam.left - 300 && d.x < cam.left + cam.vw + 300) drawTor(ctx, d, t);
  if (G.cage) drawCage(ctx, G.cage, t);
  for (const it of G.items) if (it.emerge > 0) drawItem(ctx, it, t);
  for (const e of G.enemies) if (e.kind === 'pflanze' && e.active) drawEnemy(ctx, e, t);
  const c0 = Math.floor((cam.left - CPAD) / CHW), c1 = Math.floor((cam.left + cam.vw) / CHW);
  for (let i = Math.max(0, c0); i <= c1 && i * CHW < L.w * T; i++) {
    const ch = getChunk(i);
    ctx.drawImage(ch.c, i * CHW, 0, ch.c.width / ch.cs, ch.c.height / ch.cs);
  }
  const tx0 = Math.max(0, Math.floor(cam.left / T) - 1), tx1 = Math.min(L.w - 1, Math.ceil((cam.left + cam.vw) / T) + 1);
  const ty0 = Math.max(0, Math.floor(cam.top / T)), ty1 = Math.min(L.h - 1, Math.ceil((cam.top + cam.vh) / T));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const k = ty * L.w + tx, c = L.g[k];
    if (c === TILE.B || c === TILE.Q || c === TILE.U || c === TILE.R || c === TILE.K) {
      const bt = G.bumps.get(k);
      const off = bt !== undefined ? -Math.sin(bt / .25 * Math.PI) * 12 : 0;
      drawBlock(ctx, c, tx * T, ty * T + off, t, th);
    } else if (c === TILE.C) drawCoin(ctx, tx * T + T / 2, ty * T + T / 2, t);
  }
  if (th.lava) drawLava(ctx, L, tx0, tx1, t);
  for (const pl of G.plats) {
    if (pl.mode === 'ice') { if (!pl.carried) drawEisblock(ctx, { x: pl.bx, y: pl.by, w: pl.w, h: pl.h, kind: pl.kind, dir: pl.dir, timer: pl.timer }, t); continue; }
    if (pl.state !== 'gone' && pl.x + pl.w > cam.left && pl.x < cam.left + cam.vw) drawPlatform(ctx, pl, th);
  }
  for (const sp of G.springs) drawSpring(ctx, sp, t);
  for (const c of G.checks) drawCheckpoint(ctx, c, t);
  for (const z of G.goals) drawGoal(ctx, z, t);
  for (const st of G.starEnts) if (!st.got) drawStarCoin(ctx, st.x, st.y, t, !!st.prev);
  for (const it of G.items) if (!it.emerge) {
    if (it.kind === 'orb') drawOrb(ctx, it, t);
    else if (it.kind === 'prinzessin') drawPrincess(ctx, it.x, it.y, 1.1, t, 'froh');
    else drawItem(ctx, it, t);
  }
  for (const c of G.coinPops) drawCoin(ctx, c.x, c.y, t * 4);
  for (const e of G.enemies) if ((e.active || G.mode === 'attract') && e.kind !== 'pflanze' && !e.carried) {
    if (e.x < cam.left - 100 || e.x > cam.left + cam.vw + 100) continue;
    drawEnemy(ctx, e, t);
  }
  for (const f of G.chains) drawFeuerkette(ctx, f, t);
  if (G.boss && !G.boss.gone) {
    const b = G.boss;
    if (b.type === 'krax') drawKrax(ctx, b, t);
    else if (b.type === 'morvax') drawMorvax(ctx, b.x, b.y, 1, t, { face: b.dir, hurt: b.hurtT > 0, angry: b.angry, cast: b.state === 'cast' || b.state === 'summon' });
    else drawKoloss(ctx, b, t);
  }
  if (G.mode !== 'attract') for (const p of G.players) drawPlayer(ctx, p, t);
  for (const p of G.players) if (p.carry && p.state === 'play') {
    const c = p.carry;
    if (c.type === 'shell') drawEnemy(ctx, c.ref, t);
    else if (c.type === 'ice') drawEisblock(ctx, { x: c.ref.bx, y: c.ref.by, w: c.ref.w, h: c.ref.h, kind: c.ref.kind, dir: c.ref.dir, timer: c.ref.timer }, t);
    else if (c.type === 'player') drawPlayer(ctx, c.ref, t, true);
  }
  for (const f of G.fbs) drawShot(ctx, f, t);
  drawParticles(ctx);
  if (L.water !== null) drawWater(ctx, L, t);
  ctx.textAlign = 'center'; ctx.font = '26px ' + FONT;
  for (const pp of G.pops) {
    ctx.globalAlpha = 1 - Math.max(0, pp.t - .7) / .5;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(pp.text, pp.x, pp.y - pp.t * 60);
    ctx.fillStyle = pp.col; ctx.fillText(pp.text, pp.x, pp.y - pp.t * 60);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawAmbient(dt);
  const dk = (th.dark || 0) + .12;
  const v = ctx.createRadialGradient(SW / 2, SH / 2, SH * .32, SW / 2, SH / 2, SH * .95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(5,0,15,${dk + .2})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, SW, SH);
  if (th.lava) {
    const lv = ctx.createLinearGradient(0, SH * .7, 0, SH);
    lv.addColorStop(0, 'rgba(255,90,20,0)'); lv.addColorStop(1, 'rgba(255,90,20,.18)');
    ctx.fillStyle = lv; ctx.fillRect(0, 0, SW, SH);
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${G.flash * (G.flash > .25 ? 1.4 : .8)})`; ctx.fillRect(0, 0, SW, SH); }
  if (G.mode !== 'attract' && G.mode !== 'title' && !G.noHud) drawHUD();
}
function drawCage(g, c, t) {
  const y = c.y + Math.sin(t * 1.5) * 10;
  drawPrincess(g, c.x, y + 50, .9, t, 'hilfe');
  const gl = g.createRadialGradient(c.x, y, 20, c.x, y, 80);
  gl.addColorStop(0, 'rgba(120,40,200,.1)'); gl.addColorStop(.8, 'rgba(120,40,200,.35)'); gl.addColorStop(1, 'rgba(200,120,255,.7)');
  g.fillStyle = gl; g.beginPath(); g.arc(c.x, y, 80, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(220,160,255,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(c.x, y, 80, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(40,10,60,.7)'; g.lineWidth = 4;
  for (let i = -2; i <= 2; i++) { const h = Math.sqrt(6400 - (i * 30) ** 2); g.beginPath(); g.moveTo(c.x + i * 30, y - h); g.lineTo(c.x + i * 30, y + h); g.stroke(); }
}
function drawWater(g, L, t) {
  const cam = G.cam, wy = L.water;
  const x0 = cam.left - 10, x1 = cam.left + cam.vw + 10, y1 = cam.top + cam.vh + 10;
  const grd = g.createLinearGradient(0, wy, 0, L.h * T);
  grd.addColorStop(0, 'rgba(40,170,230,.28)'); grd.addColorStop(1, 'rgba(10,40,110,.42)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(x0, y1);
  for (let x = x0; x <= x1; x += 16) g.lineTo(x, wy + Math.sin(t * 2 + x * .03) * 4);
  g.lineTo(x1, y1); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(220,250,255,.75)'; g.lineWidth = 3;
  g.beginPath(); for (let x = x0; x <= x1; x += 16) { const y = wy + Math.sin(t * 2 + x * .03) * 4; if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  g.save(); g.globalAlpha = .08; g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) { const bx = x0 + ((i * 260 + t * 20) % (cam.vw + 300)) - 150; g.beginPath(); g.moveTo(bx, wy); g.lineTo(bx + 60, wy); g.lineTo(bx + 220, y1); g.lineTo(bx + 120, y1); g.fill(); }
  g.restore();
}
function drawLava(g, L, tx0, tx1, t) {
  const ty = L.h - 2, y = ty * T;
  for (let tx = tx0; tx <= tx1; tx++) {
    if (L.g[ty * L.w + tx] !== TILE.V) continue;
    const x = tx * T;
    const grd = g.createLinearGradient(0, y, 0, y + 2 * T);
    grd.addColorStop(0, '#ffb02a'); grd.addColorStop(.25, '#ff5a1a'); grd.addColorStop(1, '#a81a0a');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(x, y + 2 * T);
    for (let i = 0; i <= 4; i++) { const xx = x + i * T / 4; g.lineTo(xx, y + 6 + Math.sin(t * 3 + xx * .05) * 4); }
    g.lineTo(x + T + .8, y + 2 * T); g.fill();
    g.fillStyle = 'rgba(255,240,150,.6)';
    if (hash2(tx, Math.floor(t * 1.5)) > .7) { g.beginPath(); g.arc(x + hash2(tx, 3) * T, y + 14, 3 + Math.sin(t * 6 + tx) * 2, 0, TAU); g.fill(); }
  }
}
function playerAnimState(p) {
  if (p.state === 'dead') return 'dead';
  if (p.state === 'goal') return p.goalPhase === 'slide' ? 'wall' : p.goalPhase === 'walk' ? 'run' : p.goalPhase === 'cheer' ? (p.vy ? 'goal' : 'stand') : 'fall';
  if (p.carried) return 'fall';
  if (p.swim) return 'swim';
  if (p.slide) return 'slide';
  if (p.carry) return 'carry';
  if (p.throwT > 0) return 'throw';
  if (p.pounding) return 'pound';
  if (p.dashT > 0 || p.rammT > 0) return 'dash';
  if (p.whirlT > 0 || (p.power === 4 && p.whirlUsed && p.vy > 0 && (p.inp.j || p.inp.a))) return 'whirl';
  if (p.floating) return 'float';
  if (p.wallSlide) return 'wall';
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
  if (Math.abs(p.vx) > 15) return 'run';
  return 'stand';
}
function drawPlayer(g, p, t, carriedNow) {
  if (p.state === 'out' || p.state === 'wait') return;
  if (p.carried && !carriedNow) return;
  if (p.state === 'bubble') { drawBubble(g, p.bx, p.by, 34, t + p.idx, p.ch, 0); drawTag(g, p, p.bx, p.by - 42); return; }
  const st = playerAnimState(p);
  if (st === 'run' || (st === 'carry' && Math.abs(p.vx) > 15)) p.walk += Math.max(Math.abs(p.vx), 120) * STEP * .12;
  let sc = p.h / 68;
  if (p.growT > 0) sc = (Math.floor(p.growT * 14) % 2) ? (p.power > 0 ? 42 / 68 : 1) : sc;
  let rot = 0;
  if (p.pounding && p.poundT > 0) rot = (1 - p.poundT / .17) * TAU * p.face;
  if (p.spin > 0) rot = (1 - p.spin) * TAU * p.face;
  if (st === 'dash') rot = .22 * p.face;
  if (st === 'whirl' && p.whirlT > 0) rot = Math.sin(t * 40) * .1;
  const alpha = p.inv > 0 && Math.floor(t * 18) % 2 ? .35 : 1;
  if (p.tongueT > 0 && p.tip) {
    limb(g, p.x + p.face * 10, p.y - p.h * .62, p.tip.x, p.tip.y, 5, '#ff6a8a');
    g.beginPath(); g.arc(p.tip.x, p.tip.y, 8, 0, TAU); fs(g, '#ff4a72', 2);
  }
  drawHero(g, p.ch, {
    x: p.x, y: p.y, s: sc, sx: p.sx, sy: p.sy, face: p.face, t: p.t, walk: p.walk, state: st, power: p.power,
    blink: p.blinkT < 0, alpha, star: p.starT > 0, rot, look: p.vx / 400, speed: Math.abs(p.vx) / 200, whirl: st === 'whirl',
  });
  if (G.players.length > 1 && p.state === 'play' && !G.noHud && !p.carried) drawTag(g, p, p.x, p.y - p.h - (p.carry ? 70 : 20));
}
function drawTag(g, p, x, y) {
  g.save();
  g.font = '15px ' + FONT; g.textAlign = 'center';
  rr(g, x - 15, y - 12, 30, 18, 9); fs(g, p.color, 2);
  g.beginPath(); g.moveTo(x - 5, y + 6); g.lineTo(x + 5, y + 6); g.lineTo(x, y + 12); g.fillStyle = p.color; g.fill();
  g.fillStyle = '#fff'; g.fillText(PLAYER_TAG[p.idx], x, y + 3);
  g.restore();
}
function drawParticles(g) {
  for (const q of G.parts) {
    const a = 1 - q.t / q.life;
    g.globalAlpha = Math.max(0, a);
    if (q.kind === 'dust') { g.fillStyle = q.color; g.beginPath(); g.arc(q.x, q.y, q.size * (.6 + (1 - a) * .8), 0, TAU); g.fill(); }
    else if (q.kind === 'star') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); starPath(g, 0, 0, q.size, q.size * .45, 4); g.fillStyle = q.color; g.fill(); g.restore(); }
    else if (q.kind === 'debris') {
      g.globalAlpha = 1;
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
      g.fillStyle = q.color; rr(g, -q.size / 2, -q.size / 2, q.size, q.size * .8, 3); g.fill();
      g.fillStyle = q.color2 || 'rgba(0,0,0,.3)'; g.fillRect(-q.size / 2, q.size * .1, q.size, q.size * .2);
      g.restore();
    } else if (q.kind === 'ember') { g.fillStyle = q.color; g.beginPath(); g.arc(q.x, q.y, q.size * a, 0, TAU); g.fill(); }
    else if (q.kind === 'bubble') { g.strokeStyle = q.color; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, q.size, 0, TAU); g.stroke(); }
    else if (q.kind === 'confetti') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.color; g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); g.restore(); q.vx *= .99; }
  }
  g.globalAlpha = 1;
}
function drawAmbient(dt) {
  const L = G.L, kind = L.theme.ambient;
  if (kind === 'none') return;
  const n = kind === 'schnee' ? 70 : kind === 'regen' ? 120 : 30;
  while (G.ambient.length < n) G.ambient.push({ x: Math.random() * SW, y: Math.random() * SH, s: Math.random(), ph: Math.random() * 9 });
  const camDx = (G.cam.left - (G.ambLeft ?? G.cam.left)) * baseScale * G.cam.zoom;
  G.ambLeft = G.cam.left;
  for (const a of G.ambient) {
    a.ph += dt;
    a.x -= camDx * (.4 + a.s * .8);
    let col, r;
    switch (kind) {
      case 'schnee': a.y += (30 + a.s * 50) * dt; a.x += Math.sin(a.ph * 1.3) * 20 * dt; col = 'rgba(255,255,255,.85)'; r = 1.5 + a.s * 3; break;
      case 'pollen': a.y -= 8 * dt; a.x += Math.sin(a.ph) * 14 * dt; col = 'rgba(255,250,200,.6)'; r = 1.2 + a.s * 2; break;
      case 'gluehw': a.x += Math.sin(a.ph * .7) * 30 * dt; a.y += Math.cos(a.ph * .9) * 22 * dt; col = `rgba(160,255,230,${.4 + .4 * Math.sin(a.ph * 3)})`; r = 1.5 + a.s * 2.5; break;
      case 'sand': a.x -= (60 + a.s * 80) * dt; a.y += Math.sin(a.ph * 2) * 10 * dt; col = 'rgba(255,230,180,.45)'; r = 1 + a.s * 1.5; break;
      case 'blaetter': a.y += (25 + a.s * 30) * dt; a.x += Math.sin(a.ph * 1.6) * 40 * dt; col = a.s > .5 ? 'rgba(240,140,50,.8)' : 'rgba(220,90,40,.75)'; r = 3 + a.s * 3; break;
      case 'funken': a.y -= (30 + a.s * 50) * dt; a.x += Math.sin(a.ph * 2) * 15 * dt; col = `rgba(255,${150 + a.s * 80},60,${.5 + .4 * Math.sin(a.ph * 5)})`; r = 1 + a.s * 2; break;
      case 'blasen': a.y -= (20 + a.s * 40) * dt; a.x += Math.sin(a.ph * 2) * 10 * dt; col = 'rgba(220,250,255,.5)'; r = 2 + a.s * 3; break;
      case 'staub': a.y += Math.sin(a.ph) * 6 * dt; a.x += 6 * dt; col = 'rgba(220,200,255,.35)'; r = 1 + a.s * 1.5; break;
      case 'regen': a.y += (700 + a.s * 300) * dt; a.x -= 120 * dt; col = 'rgba(170,190,230,.45)'; r = 1; break;
      default: return;
    }
    if (a.y > SH + 10) a.y = -10; if (a.y < -10) a.y = SH + 10;
    if (a.x > SW + 10) a.x = -10; if (a.x < -10) a.x = SW + 10;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    if (kind === 'blaetter') { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ph * 2); ell(ctx, 0, 0, r, r * .5); ctx.fill(); ctx.restore(); }
    else if (kind === 'regen') { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - 4, a.y + 16 + a.s * 8); ctx.stroke(); }
    else if (kind === 'blasen') { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.fill(); }
  }
}

// ---------------------------------------------------------------------
//  Anzeige (HUD)
// ---------------------------------------------------------------------
function heartPath(g, x, y, s) {
  g.beginPath(); g.moveTo(x, y + s * .9);
  g.bezierCurveTo(x - s * 1.6, y - s * .1, x - s * .8, y - s * 1.3, x, y - s * .45);
  g.bezierCurveTo(x + s * .8, y - s * 1.3, x + s * 1.6, y - s * .1, x, y + s * .9);
}
function nodeTitle(nd) {
  if (!nd) return '';
  if (nd.type === 'level') return 'Level ' + nd.title;
  if (nd.type === 'turm') return 'Turm ' + nd.world;
  return WORLD_SPECS[nd.world - 1].final ? 'Schattenburg' : 'Burg ' + nd.world;
}
function drawHUD() {
  const g = ctx;
  const u = clamp(SH / 800, .75, 1.25);
  g.save();
  g.scale(u, u);
  const W = SW / u;
  G.players.forEach((p, i) => {
    const x = 14 + i * 186, y = 12;
    g.fillStyle = 'rgba(12,10,24,.66)'; rr(g, x, y, 176, 58, 16); g.fill();
    g.strokeStyle = p.color; g.lineWidth = 3; rr(g, x, y, 176, 58, 16); g.stroke();
    g.save(); rr(g, x + 4, y + 4, 50, 50, 12); g.clip();
    g.fillStyle = p.color + '33'; g.fillRect(x + 4, y + 4, 50, 50);
    drawHero(g, p.ch, { x: x + 29, y: y + 80, s: .8, face: 1, t: p.t, state: 'stand', power: p.state === 'play' ? p.power : 0, blink: p.blinkT < 0 });
    g.restore();
    if (p.state === 'out' || p.state === 'bubble') { g.fillStyle = 'rgba(12,14,30,.5)'; rr(g, x + 4, y + 4, 50, 50, 12); g.fill(); }
    g.textAlign = 'left';
    g.font = '16px ' + FONT; g.fillStyle = p.color; g.fillText(PLAYER_TAG[p.idx] + ' ' + p.ch.name, x + 60, y + 22);
    drawCoin(g, x + 68, y + 41, 0, 7.5);
    g.font = '19px ' + FONT; g.fillStyle = '#fff'; g.fillText('× ' + p.coins, x + 79, y + 48);
    g.font = '12px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right';
    if (p.state === 'bubble' || p.state === 'out') { g.fillStyle = '#bfe9ff'; g.font = '14px ' + FONT; g.fillText(p.state === 'out' ? 'Raus' : 'Blase!', x + 168, y + 47); }
    else g.fillText(String(p.score).padStart(6, '0'), x + 168, y + 47);
    if (p.ch.special === 'schweben' && p.state === 'play' && p.power < 2) {
      g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, x + 140, y + 14, 28, 6, 3); g.fill();
      g.fillStyle = '#fff07a'; rr(g, x + 140, y + 14, 28 * clamp(p.floatFuel / 1.3, 0, 1), 6, 3); g.fill();
    }
  });
  const rx = W - 118;
  g.fillStyle = 'rgba(12,10,24,.66)'; rr(g, rx - 300, 12, 300, 58, 16); g.fill();
  heartPath(g, rx - 276, 36, 11); g.fillStyle = '#ff5a7a'; g.fill();
  g.font = '22px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'left';
  g.fillText('× ' + Math.max(0, G.lives), rx - 258, 44);
  for (let i = 0; i < 3; i++) { g.save(); g.translate(rx - 168 + i * 30, 36); g.scale(.55, .55); drawStarCoin(g, 0, 0, 0, !G.starGot[i], true); g.restore(); }
  const hurry = G.time <= 100;
  g.font = '22px ' + FONT; g.textAlign = 'right';
  g.fillStyle = hurry ? (Math.floor(G.t * 4) % 2 ? '#ff5a5a' : '#ffd0d0') : '#fff';
  g.fillText('⏱ ' + Math.max(0, G.time), rx - 14, 44);
  g.font = '12px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'center';
  const nd = G.node;
  g.fillText(nd ? `${nodeTitle(nd)} · ${G.L.theme.name}` : G.L.theme.name, rx - 150, 64);
  if (G.introT > 0 && nd) {
    const a = Math.min(1, G.introT * 2.5);
    g.globalAlpha = a; g.textAlign = 'center';
    g.font = '64px ' + FONT; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineJoin = 'round';
    const ty = SH / u * .38 - (1 - a) * 20, title = nodeTitle(nd);
    g.strokeText(title, W / 2, ty); g.fillStyle = '#ffd23a'; g.fillText(title, W / 2, ty);
    g.font = '34px ' + FONT;
    g.strokeText(G.L.theme.name, W / 2, ty + 48); g.fillStyle = '#fff'; g.fillText(G.L.theme.name, W / 2, ty + 48);
    g.globalAlpha = 1;
  }
  if (G.goalTimer >= 0 && G.goalTimer < 4) {
    g.textAlign = 'center'; g.font = '70px ' + FONT;
    const sc = 1 + Math.max(0, .3 - G.goalTimer) * 2;
    g.save(); g.translate(W / 2, SH / u * .3); g.scale(sc, sc);
    g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineJoin = 'round';
    const txt = G.goalHow === 'secret' ? 'Geheimer Ausgang!' : G.goalHow === 'final' ? 'Lunara ist frei!' : 'Geschafft!';
    g.strokeText(txt, 0, 0); g.fillStyle = G.goalHow === 'secret' ? '#ff7a7a' : '#ffd23a'; g.fillText(txt, 0, 0);
    g.restore();
  }
  if (G.hurry && G.time > 90 && G.goalTimer < 0) {
    g.textAlign = 'center'; g.font = '44px ' + FONT; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.45)';
    g.strokeText('Beeil dich!', W / 2, SH / u * .25); g.fillStyle = '#ff6a6a'; g.fillText('Beeil dich!', W / 2, SH / u * .25);
  }
  if (G.boss && G.arenaLocked && !G.boss.dead) {
    const bw = 320, bx = W / 2 - bw / 2, by = SH / u - 46;
    g.fillStyle = 'rgba(12,10,24,.75)'; rr(g, bx - 10, by - 26, bw + 20, 48, 14); g.fill();
    g.font = '15px ' + FONT; g.fillStyle = '#ffb07a'; g.textAlign = 'center'; g.fillText(G.boss.name, W / 2, by - 8);
    g.fillStyle = 'rgba(255,255,255,.15)'; rr(g, bx, by, bw, 12, 6); g.fill();
    const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#ffcf3a'); gr.addColorStop(1, '#ff4a1a');
    g.fillStyle = gr; rr(g, bx, by, bw * Math.max(0, G.boss.hp / G.boss.maxHp), 12, 6); g.fill();
  }
  for (const p of G.players) {
    if (p.state !== 'play') continue;
    const sy = (p.y - p.h - G.cam.top) * baseScale * G.cam.zoom / u;
    if (sy < 0) { const sx = (p.x - G.cam.left) * baseScale * G.cam.zoom / u; g.fillStyle = p.color; g.beginPath(); g.moveTo(sx, 80); g.lineTo(sx - 10, 96); g.lineTo(sx + 10, 96); g.fill(); }
  }
  g.restore();
}

// ---------------------------------------------------------------------
//  Hauptschleife
// ---------------------------------------------------------------------
let lastNow = performance.now(), accum = 0;
const modeHandlers = {};   // weitere Modi (Karte, Minispiele, Geschichte) melden sich hier an
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
  pollPads();
  const mh = modeHandlers[G.mode];
  if (mh) { mh.update(dt); clearPressed(); mh.render(dt); if (window.UI && UI.frame) UI.frame(dt); return; }
  if (G.mode === 'play' || G.mode === 'attract') {
    accum += dt;
    let n = 0;
    while (accum >= STEP && n < 14) {
      if (G.mode === 'attract') attractUpdate(STEP); else update(STEP);
      clearPressed();
      accum -= STEP; n++;
      if (G.mode !== 'play' && G.mode !== 'attract') break;
    }
    if (n >= 14) accum = 0;
  } else {
    accum = 0;
    if (G.mode === 'clear' && G.L) { updateParticles(dt); G.t += dt; for (const p of G.players) if (p.state === 'goal') goalAnim(p, dt); }
  }
  if (G.mode !== 'play' && G.mode !== 'attract') clearPressed();
  render(dt);
  if (window.UI && UI.frame) UI.frame(dt);
}
function attractUpdate(dt) {
  G.t += dt;
  for (const s of G.plats) { const ox = s.x, oy = s.y; if (s.mode === 'h') { s.x += s.dirp * s.speed * dt; if (s.x > s.x1 || s.x < s.x0) s.dirp *= -1; } else if (s.mode === 'v') { s.y += s.dirp * s.speed * dt; if (s.y > s.y1 || s.y < s.y0) s.dirp *= -1; } s.dx = s.x - ox; s.dy = s.y - oy; }
  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter(e => !e.remove);
  updateChains(dt);
  updateParticles(dt);
  updateCamera(dt);
  if (G.cam.cx >= G.L.w * T - G.cam.vw / 2 - 2) startAttract();
}
function startAttract() {
  const keys = ['wiese', 'nebel', 'wueste', 'schnee', 'abend', 'strand', 'schatten'];
  const key = keys[Math.floor(Math.random() * keys.length)];
  G.levelDiffNow = .5;
  loadLevel(generateLevel({ themeKey: key, seed: Math.floor(Math.random() * 1e9), diff: .5 }));
  G.cam.cx = SW / baseScale / 2; G.cam.cy = (G.L.h - 7) * T; G.cam.zoom = 1;
  updateCamera(1, true);
  G.mode = 'attract';
}
