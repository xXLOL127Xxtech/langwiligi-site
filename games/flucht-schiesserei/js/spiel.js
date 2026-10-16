'use strict';
// ============================================================
//  Simulation: Physik (planck.js), Bewegung, Waffen, Runden
//  Läuft nur beim Host bzw. im Solo-Spiel. Gäste bauen nur die Karte für die Grafik.
// ============================================================
const pl = window.planck;
const V2 = (x, y) => pl.Vec2(x, y);
const GRAV = 22;
const STEP = 1 / 60;
const CAT = { WORLD: 1, PLAYER: 2, PICKUP: 4, PROP: 8, GREN: 16 };
const MASKS = { 1: 0xffff, 2: 1 | 2 | 8 | 16, 4: 1 | 8, 8: 1 | 2 | 4 | 8 | 16, 16: 1 | 2 | 8 };

// Bewegung: Jeder Druck neigt die Figur und lässt sie immer gleich hoch abspringen
const JUMP_VY = 8.7;        // immer gleiche Absprung-Geschwindigkeit nach oben (≈1.7 m hoch)
const JUMP_VX = 3.1;        // seitlicher Anteil in Druckrichtung
const JUMP_TILT = 3.3;      // zusätzlich: je schräger die Figur, desto weiter der Sprung
const LEAN_TAP = 2.7;       // Dreh-Impuls bei jedem Druck (kurzes Antippen = leichte Neigung)
const LEAN_MAX = 4.8;       // Drehgeschwindigkeit beim Halten
const RESPAWN = 2.2;
const WIN_SCORE = 3;
const ARM = 0.26;           // Schulter -> Hand (m)

const WEAPONS = {
  pistole: { name: 'Pistole', ammo: 10, rate: 0.27, dmg: 25, imp: 2.4, recoil: 1.3, spread: 0.025, pellets: 1, range: 42, kind: 'hit' },
  mp: { name: 'Maschinenpistole', ammo: 36, rate: 0.085, dmg: 11, imp: 1.2, recoil: 0.55, spread: 0.075, pellets: 1, range: 32, kind: 'hit' },
  schrot: { name: 'Schrotflinte', ammo: 5, rate: 0.8, dmg: 14, imp: 1.7, recoil: 5.2, spread: 0.24, pellets: 7, range: 15, kind: 'hit' },
  sniper: { name: 'Scharfschützengewehr', ammo: 4, rate: 1.15, dmg: 95, imp: 8.5, recoil: 3.6, spread: 0, pellets: 1, range: 90, kind: 'hit' },
  rakete: { name: 'Raketenwerfer', ammo: 3, rate: 1.0, recoil: 4.6, kind: 'rocket', speed: 20 },
  granate: { name: 'Granaten', ammo: 3, rate: 0.7, recoil: 0.6, kind: 'grenade', speed: 12.5 },
};
const WKEYS = Object.keys(WEAPONS);
const WWEIGHT = { pistole: 3, mp: 2.2, schrot: 2, sniper: 1, rakete: 1.1, granate: 1.4 };
for (const k of WKEYS) {
  const s = WSPR[k];
  WEAPONS[k].len = ARM + (s.muzzle[0] - s.grip[0]) / PPM;
}

function normAng(a) { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; }
function bx(w, h, cx = 0, cy = 0, mat = 'beton', extra) {
  const f = { verts: [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], mat };
  return Object.assign(f, extra || {});
}
// Rechteck über Kanten: links, unten, rechts, oben
function rc(x0, y0, x1, y1, mat = 'beton', extra) { return bx(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, mat, extra); }
function poly(verts, mat = 'beton', extra) { return Object.assign({ verts, mat }, extra || {}); }
function circ(r, cx = 0, cy = 0, mat = 'stahl', extra) { return Object.assign({ shape: 'circle', r, cx, cy, mat }, extra || {}); }

// Kinematischen Körper per Geschwindigkeit zur Zielpose führen (Reibung bleibt korrekt)
function drive(body, x, y, a, dt) {
  const p = body.getPosition();
  body.setLinearVelocity(V2((x - p.x) / dt, (y - p.y) / dt));
  body.setAngularVelocity(normAng(a - body.getAngle()) / dt);
}

// Sprite für einen Kartenkörper erzeugen (lokale Koordinaten, Achsen-ausgerichtet)
function bodySprite(def) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const f of def.fixtures) {
    if (f.shape === 'circle') {
      minx = Math.min(minx, f.cx - f.r); maxx = Math.max(maxx, f.cx + f.r);
      miny = Math.min(miny, f.cy - f.r); maxy = Math.max(maxy, f.cy + f.r);
    } else for (const v of f.verts) {
      minx = Math.min(minx, v[0]); maxx = Math.max(maxx, v[0]);
      miny = Math.min(miny, v[1]); maxy = Math.max(maxy, v[1]);
    }
  }
  if (def.bounds) { [minx, miny, maxx, maxy] = [Math.min(minx, def.bounds[0]), Math.min(miny, def.bounds[1]), Math.max(maxx, def.bounds[2]), Math.max(maxy, def.bounds[3])]; }
  if (!isFinite(minx)) return null;
  const m = 3;
  const W = (maxx - minx) * PPM + 2 * m, H = (maxy - miny) * PPM + 2 * m;
  const [c, g] = mkCanvas(W, H);
  const P = (x, y) => [(x - minx) * PPM + m, (maxy - y) * PPM + m];
  if (def.paint) def.paint(g, P, def, c.width, c.height);
  else paintFixtures(g, def.fixtures, P);
  if (def.paintAfter) def.paintAfter(g, P, def);
  const ox = -minx * PPM + m, oy = maxy * PPM + m;
  return { img: c, ox, oy, rad: Math.hypot(Math.max(ox, c.width - ox), Math.max(oy, c.height - oy)) };
}

class Sim {
  // opts: { mapId, seed, slots: [{name, outfit, bot}], scores, round, client }
  constructor(opts) {
    this.opts = opts;
    this.client = !!opts.client;
    this.world = new pl.World({ gravity: V2(0, -GRAV) });
    this.t = 0;
    this.rng = RNG(opts.seed);
    this.events = [];
    this.mbs = []; this.movers = []; this.decos = [];
    this.players = []; this.pickups = []; this.projs = [];
    this.nextId = 1;
    this.phase = 'countdown'; this.phaseT = 0;
    this.winner = -1; this.done = null;
    this.pickT = 1.5;
    this.mapDef = MAPS.find(m => m.id === opts.mapId) || MAPS[0];
    this.map = this.mapDef.build(this, RNG(opts.seed ^ 0x9e3779b9));
    const scores = opts.scores || [];
    opts.slots.forEach((s, i) => this.makePlayer(i, s, scores[i] || 0));
    if (!this.client) for (let i = 0; i < 3; i++) this.spawnPickup(true);
  }
  ev(...a) { this.events.push(a); }

  // ---------- Karten-Bausteine ----------
  addBody(def) {
    const type = def.type || 'static';
    const body = this.world.createBody({ type, position: V2(def.x || 0, def.y || 0), angle: def.a || 0,
      linearDamping: def.linDamp || 0, angularDamping: def.angDamp || 0, bullet: !!def.bullet });
    const cat = def.cat || CAT.WORLD;
    for (const f of def.fixtures) {
      if (f.decoOnly) continue;
      const shape = f.shape === 'circle' ? pl.Circle(V2(f.cx || 0, f.cy || 0), f.r) : pl.Polygon(f.verts.map(v => V2(v[0], v[1])));
      body.createFixture(shape, { density: f.density ?? def.density ?? 1, friction: f.friction ?? def.friction ?? 0.7,
        restitution: f.restitution ?? def.restitution ?? 0, filterCategoryBits: cat, filterMaskBits: MASKS[cat], isSensor: !!f.sensor, userData: f });
    }
    const mb = { id: this.mbs.length, body, def, type, state: 0, timer: 0, hp: def.hp || 0, layer: def.layer || 0,
      crumble: !!def.crumble, onHit: def.onHit || null, onBlast: def.onBlast || null, home: { x: def.x || 0, y: def.y || 0, a: def.a || 0 }, tag: def.tag };
    if (def.crumble) { mb.onHit = mb.onHit || crumbleHit; mb.onBlast = mb.onBlast || crumbleBlast; }
    body.setUserData({ kind: 'mb', mb });
    const spr = def.noSprite ? null : bodySprite(def);
    mb.sprite = spr;
    if (type !== 'static' || def.crumble || def.mover) { mb.mi = this.movers.length; this.movers.push(mb); }
    this.mbs.push(mb);
    return mb;
  }
  // Dekoration ohne Kollision. attach: Kartenkörper (x/y dann lokal)
  addDeco(img, x, y, layer = -1, attach = null, extra) {
    const d = Object.assign({ img, x, y, layer, attach }, extra || {});
    this.decos.push(d);
    return d;
  }

  // ---------- Spieler ----------
  makePlayer(i, slot, score) {
    const sp = this.map.spawn(this, 0, i);
    const body = this.world.createBody({ type: 'dynamic', position: V2(sp.x, sp.y), angle: 0, linearDamping: 0.04, angularDamping: 0.5, bullet: true });
    const hw = 0.24, hh = 0.62;
    const shape = pl.Polygon([V2(-hw, -hh + 0.1), V2(-hw + 0.08, -hh), V2(hw - 0.08, -hh), V2(hw, -hh + 0.1), V2(hw, hh - 0.14), V2(hw - 0.1, hh), V2(-hw + 0.1, hh), V2(-hw, hh - 0.14)]);
    body.createFixture(shape, { density: 1.6, friction: 0.9, restitution: 0, filterCategoryBits: CAT.PLAYER, filterMaskBits: MASKS[CAT.PLAYER] });
    const md = { mass: 0, center: V2(0, 0), I: 0 };
    body.getMassData(md);
    const cy = -0.17;
    body.setMassData({ mass: md.mass, center: V2(0, cy), I: md.I + md.mass * cy * cy });
    const p = {
      idx: i, name: slot.name, outfit: slot.outfit, isBot: !!slot.bot, body, alive: true, hp: 100, weapon: null, ammo: 0, cd: 0,
      aim: 0, input: { l: false, r: false, fire: false, aim: 0, lp: 0, rp: 0 }, seenL: 0, seenR: 0,
      ground: false, groundBody: null, groundPt: null, lastGround: 0, lastJump: -1, jumpBuf: null, deadT: 0, shield: 0, flash: 0,
      cp: 0, escapes: score, kills: 0, prog: 0, holdT: 0, lieT: 0,
    };
    body.setUserData({ kind: 'player', p });
    this.players.push(p);
    return p;
  }
  shoulder(p) { return p.body.getWorldPoint(V2(0.02, 0.1)); }
  canJump(p) { return (p.ground || this.t - p.lastGround < 0.09) && this.t - p.lastJump > 0.22; }
  press(p, side) {
    const b = p.body;
    const air = !p.ground && this.t - p.lastGround > 0.09;
    b.setAngularVelocity(b.getAngularVelocity() * (air ? 0.6 : 0.25) - side * LEAN_TAP * (air ? 0.65 : 1));
    if (this.canJump(p)) this.jump(p, side);
    else p.jumpBuf = { side, t: this.t };
  }
  jump(p, side) {
    const b = p.body;
    let pvx = 0, pvy = 0;
    if (p.groundBody && p.groundPt) {
      const v = p.groundBody.getLinearVelocityFromWorldPoint(p.groundPt);
      pvx = v.x; pvy = v.y;
    }
    const tilt = clamp(-normAng(b.getAngle()), -0.7, 0.7);
    const vx = pvx + side * JUMP_VX + tilt * JUMP_TILT;
    const vy = pvy + JUMP_VY;
    const old = b.getLinearVelocity();
    b.setLinearVelocity(V2(vx, vy));
    // Rückstoss auf bewegliche Unterlage (Brücken, Kisten)
    if (p.groundBody && p.groundBody.isDynamic()) {
      const m = b.getMass() * 0.5;
      p.groundBody.applyLinearImpulse(V2(-(vx - old.x) * m * 0.3, -(vy - old.y) * m), p.groundPt, true);
    }
    p.lastJump = this.t; p.ground = false; p.lastGround = -1; p.jumpBuf = null;
    const pos = b.getPosition();
    this.ev('jump', p.idx, +pos.x.toFixed(2), +(pos.y - 0.6).toFixed(2));
  }

  updatePlayer(p, dt, live) {
    const b = p.body, inp = p.input;
    if (p.flash > 0) p.flash -= dt;
    if (p.escaped) return;
    if (!p.alive) {
      p.deadT += dt;
      if (p.deadT > RESPAWN && this.phase !== 'escaped') this.respawn(p);
      return;
    }
    if (p.shield > 0) p.shield -= dt;
    p.cd -= dt;
    let nl = inp.lp - p.seenL, nr = inp.rp - p.seenR;
    p.seenL = inp.lp; p.seenR = inp.rp;
    if (!live) nl = nr = 0;
    if (nl > 0) this.press(p, -1);
    if (nr > 0) this.press(p, 1);
    if (p.jumpBuf && live) {
      if (this.t - p.jumpBuf.t > 0.13) p.jumpBuf = null;
      else if (this.canJump(p)) this.jump(p, p.jumpBuf.side);
    }
    const I = b.getInertia();
    const av = b.getAngularVelocity();
    const ang = normAng(b.getAngle());
    const hl = live && inp.l, hr = live && inp.r;
    if (hl !== hr) {
      const side = hr ? 1 : -1;
      b.applyTorque((-side * LEAN_MAX - av) * I * 9, true);
      p.holdT += dt;
    } else {
      p.holdT = 0;
      let K = p.ground ? 42 : 13, D = p.ground ? 8 : 2.2;
      // Liegt die Figur, rappelt sie sich nach kurzer Zeit wieder auf (Stehauf-Männchen)
      if (p.ground && Math.abs(ang) > 0.95) p.lieT += dt; else if (Math.abs(ang) < 0.4) p.lieT = 0;
      if (p.lieT > 0.45) { K = 140; D = 14; }
      else if (p.ground && Math.abs(ang) > 1.15) K *= 0.3;
      b.applyTorque((-K * clamp(ang, -1.6, 1.6) - D * av) * I, true);
    }
    if (Math.abs(av) > 11) b.setAngularVelocity(Math.sign(av) * 11);
    p.aim = inp.aim;
    if (live && inp.fire && p.weapon && p.cd <= 0) this.fire(p);
  }

  respawn(p) {
    const sp = this.map.spawn(this, p.cp, p.idx);
    const b = p.body;
    b.setTransform(V2(sp.x, sp.y), 0);
    b.setLinearVelocity(V2(sp.vx || 0, sp.vy || 0));
    b.setAngularVelocity(0);
    b.setAwake(true);
    p.alive = true; p.hp = 100; p.shield = 1.6; p.lieT = 0; p.deadT = 0; p.weapon = null; p.ammo = 0; p.jumpBuf = null;
    this.ev('spawn', p.idx, +sp.x.toFixed(2), +sp.y.toFixed(2));
  }
  kill(p, cause, byIdx) {
    if (!p.alive || p.escaped) return;
    p.alive = false; p.deadT = 0; p.hp = 0; p.weapon = null; p.ammo = 0;
    if (byIdx != null && byIdx >= 0 && byIdx !== p.idx) this.players[byIdx].kills++;
    const pos = p.body.getPosition();
    this.ev('die', p.idx, +pos.x.toFixed(2), +pos.y.toFixed(2), cause, byIdx == null ? -1 : byIdx);
  }
  damage(q, dmg, byIdx, pt, cause) {
    if (!q.alive) return;
    if (q.shield > 0) return;
    q.hp -= dmg; q.flash = 0.12;
    this.ev('hit', q.idx, +pt.x.toFixed(2), +pt.y.toFixed(2));
    if (q.hp <= 0) this.kill(q, cause || 'schuss', byIdx);
  }

  // ---------- Waffen ----------
  ray(a, b, ignore) {
    let best = null;
    this.world.rayCast(a, b, (f, pt, n, fr) => {
      if (f.isSensor()) return -1;
      const cat = f.getFilterCategoryBits();
      if (cat & (CAT.PICKUP | CAT.GREN)) return -1;
      if (ignore && f.getBody() === ignore) return -1;
      const ud = f.getBody().getUserData();
      if (ud && ud.kind === 'mb' && ud.mb.state === 3) return -1;
      best = { f, point: V2(pt.x, pt.y), normal: V2(n.x, n.y), fr };
      return fr;
    });
    return best;
  }
  fire(p) {
    const W = WEAPONS[p.weapon], b = p.body;
    p.cd = W.rate; p.ammo--;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    const sh = this.shoulder(p);
    let mz = V2(sh.x + dx * W.len, sh.y + dy * W.len);
    const blk = this.ray(sh, mz, b);
    if (blk) mz = V2(blk.point.x - dx * 0.05, blk.point.y - dy * 0.05);
    const wc = WKEYS.indexOf(p.weapon);
    if (W.kind === 'hit') {
      for (let k = 0; k < W.pellets; k++) {
        const a = p.aim + (W.pellets > 1 ? (this.rng() - 0.5) * 2 * W.spread : (this.rng() - 0.5) * 2 * W.spread);
        const ex = Math.cos(a), ey = Math.sin(a);
        const end = V2(mz.x + ex * W.range, mz.y + ey * W.range);
        const hit = this.ray(mz, end, b);
        let kind = 0, hx = end.x, hy = end.y;
        if (hit) { hx = hit.point.x; hy = hit.point.y; kind = this.hitFixture(hit, ex, ey, W.dmg, W.imp, p.idx); }
        this.ev('shot', p.idx, wc, +mz.x.toFixed(2), +mz.y.toFixed(2), +hx.toFixed(2), +hy.toFixed(2), kind);
      }
    } else if (W.kind === 'rocket') {
      const v = b.getLinearVelocity();
      this.projs.push({ id: this.nextId++, kind: 'rocket', x: mz.x, y: mz.y, vx: dx * W.speed + v.x * 0.2, vy: dy * W.speed + v.y * 0.2, owner: p.idx, life: 0 });
      this.ev('shot', p.idx, wc, +mz.x.toFixed(2), +mz.y.toFixed(2), +mz.x.toFixed(2), +mz.y.toFixed(2), 0);
    } else if (W.kind === 'grenade') {
      const v = b.getLinearVelocity();
      const gb = this.world.createBody({ type: 'dynamic', position: mz, bullet: true, angularDamping: 0.5 });
      gb.createFixture(pl.Circle(0.11), { density: 3, friction: 0.5, restitution: 0.45, filterCategoryBits: CAT.GREN, filterMaskBits: MASKS[CAT.GREN] });
      gb.setLinearVelocity(V2(dx * W.speed + v.x * 0.5, dy * W.speed + v.y * 0.5));
      gb.setAngularVelocity(-Math.sign(dx) * 8);
      const pr = { id: this.nextId++, kind: 'gren', body: gb, x: mz.x, y: mz.y, a: 0, owner: p.idx, life: 0 };
      gb.setUserData({ kind: 'gren', pr });
      this.projs.push(pr);
      this.ev('shot', p.idx, wc, +mz.x.toFixed(2), +mz.y.toFixed(2), +mz.x.toFixed(2), +mz.y.toFixed(2), 0);
    }
    b.applyLinearImpulse(V2(-dx * W.recoil, -dy * W.recoil), b.getWorldCenter(), true);
    if (p.ammo <= 0) { p.weapon = null; this.ev('empty', p.idx); }
  }
  hitFixture(hit, dx, dy, dmg, imp, byIdx) {
    const body = hit.f.getBody();
    const ud = body.getUserData();
    if (ud && ud.kind === 'player') {
      const q = ud.p;
      this.damage(q, dmg, byIdx, hit.point);
      body.applyLinearImpulse(V2(dx * imp, dy * imp), hit.point, true);
      return 2;
    }
    if (ud && ud.kind === 'mb') {
      if (body.isDynamic()) body.applyLinearImpulse(V2(dx * imp * 0.8, dy * imp * 0.8), hit.point, true);
      if (ud.mb.onHit) ud.mb.onHit(this, ud.mb, dmg);
      return 1;
    }
    return 1;
  }
  explode(x, y, owner) {
    const R = 3.3;
    this.ev('boom', +x.toFixed(2), +y.toFixed(2));
    for (const q of this.players) {
      const c = q.body.getWorldCenter();
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      const f = 1 - d / R;
      const nx = d > 0.01 ? dx / d : 0, ny = (d > 0.01 ? dy / d : 1) + 0.45;
      q.body.applyLinearImpulse(V2(nx * 11 * f, ny * 11 * f), V2(c.x + (this.rng() - 0.5) * 0.4, c.y + 0.3), true);
      this.damage(q, 92 * f * (q.idx === owner ? 0.55 : 1), owner, c, 'explosion');
    }
    for (const mb of this.mbs) {
      const b = mb.body;
      if (mb.type === 'static' && !mb.crumble) continue;
      const c = b.getWorldCenter();
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > R + 1) continue;
      const f = 1 - Math.min(1, d / (R + 1));
      if (b.isDynamic()) b.applyLinearImpulse(V2(dx / (d || 1) * 8 * f * Math.min(3, b.getMass()), (dy / (d || 1) + 0.4) * 8 * f * Math.min(3, b.getMass())), c, true);
      if (mb.onBlast) mb.onBlast(this, mb, f);
    }
    for (const pk of this.pickups) {
      const c = pk.body.getWorldCenter();
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d < R) pk.body.applyLinearImpulse(V2(dx / (d || 1) * 2, (dy / (d || 1) + 0.5) * 2), c, true);
    }
  }

  // ---------- Waffenkisten ----------
  spotWorld(s) {
    if (s.mb) { const p = s.mb.body.getWorldPoint(V2(s.x, s.y)); const v = s.mb.body.getLinearVelocityFromWorldPoint(p); return { x: p.x, y: p.y, vx: v.x, vy: v.y }; }
    return { x: s.x, y: s.y, vx: 0, vy: 0 };
  }
  spawnPickup(initial) {
    const spots = this.map.spots;
    if (!spots || !spots.length) return;
    let pos = null;
    for (let tries = 0; tries < 8 && !pos; tries++) {
      const s = spots[this.rng() * spots.length | 0];
      const w = this.spotWorld(s);
      if (this.pickups.some(k => { const c = k.body.getPosition(); return Math.hypot(c.x - w.x, c.y - w.y) < 3; })) continue;
      if (!initial && this.players.some(q => { const c = q.body.getPosition(); return Math.hypot(c.x - w.x, c.y - w.y) < 1.5; })) continue;
      pos = w;
    }
    if (!pos) return;
    let tot = 0; for (const k of WKEYS) tot += WWEIGHT[k];
    let r = this.rng() * tot, w = WKEYS[0];
    for (const k of WKEYS) { r -= WWEIGHT[k]; if (r <= 0) { w = k; break; } }
    const body = this.world.createBody({ type: 'dynamic', position: V2(pos.x, pos.y + 0.3), angularDamping: 1.5 });
    body.createFixture(pl.Box(0.31, 0.25), { density: 1.2, friction: 0.6, restitution: 0.1, filterCategoryBits: CAT.PICKUP, filterMaskBits: MASKS[CAT.PICKUP] });
    body.setLinearVelocity(V2(pos.vx, pos.vy));
    const pk = { id: this.nextId++, w, body };
    body.setUserData({ kind: 'pickup', pk });
    this.pickups.push(pk);
    this.ev('drop', +pos.x.toFixed(2), +(pos.y + 0.3).toFixed(2));
  }

  // ---------- Schritt ----------
  step(dt) {
    this.t += dt; this.phaseT += dt;
    const live = this.phase === 'play' || this.phase === 'escaped';
    if (this.map.update) this.map.update(this, this.t, dt);
    this.updateMbs(dt);
    for (const p of this.players) this.updatePlayer(p, dt, live);
    this.updateProjs(dt);
    this.world.step(dt, 8, 3);
    this.postStep(dt, live);
    this.updatePhase();
  }
  updateMbs(dt) {
    for (const mb of this.movers) {
      if (!mb.crumble) continue;
      const b = mb.body;
      if (mb.state === 1) {
        mb.timer += dt;
        if (mb.timer > (mb.def.delay || 0.6)) {
          mb.state = 2; mb.timer = 0;
          b.setDynamic(); b.setAwake(true);
          b.setAngularVelocity((this.rng() - 0.5) * 1.5);
          const c = b.getPosition();
          this.ev('crumble', +c.x.toFixed(2), +c.y.toFixed(2));
        }
      } else if (mb.state === 2) {
        mb.timer += dt;
        if (mb.timer > (mb.def.respawn || 7)) {
          // nur zurücksetzen, wenn niemand im Weg steht
          const h = mb.home;
          const blocked = this.players.some(q => { const c = q.body.getPosition(); return Math.abs(c.x - h.x) < (mb.def.w || 2) / 2 + 0.5 && Math.abs(c.y - h.y) < 1.3; });
          if (!blocked) {
            b.setKinematic();
            b.setTransform(V2(h.x, h.y), h.a);
            b.setLinearVelocity(V2(0, 0)); b.setAngularVelocity(0);
            mb.state = 0; mb.timer = 0;
          }
        }
      }
    }
  }
  updateProjs(dt) {
    for (const pr of this.projs) {
      pr.life += dt;
      if (pr.kind === 'rocket') {
        pr.vy -= 1.5 * dt;
        const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
        const own = pr.life < 0.15 ? this.players[pr.owner].body : null;
        const hit = this.ray(V2(pr.x, pr.y), V2(nx, ny), own);
        if (hit) { this.explode(hit.point.x - pr.vx * 0.004, hit.point.y - pr.vy * 0.004, pr.owner); pr.dead = true; }
        else { pr.x = nx; pr.y = ny; }
        pr.a = Math.atan2(pr.vy, pr.vx);
        if (pr.life > 4 || pr.y < this.map.killY - 5) { if (!pr.dead) this.explode(pr.x, pr.y, pr.owner); pr.dead = true; }
      } else if (pr.kind === 'gren') {
        const p = pr.body.getPosition();
        pr.x = p.x; pr.y = p.y; pr.a = pr.body.getAngle();
        if (pr.life > 1.7 || pr.y < this.map.killY - 3) {
          if (pr.y >= this.map.killY - 3) this.explode(pr.x, pr.y, pr.owner);
          this.world.destroyBody(pr.body); pr.dead = true;
        }
      }
    }
    if (this.projs.some(p => p.dead)) this.projs = this.projs.filter(p => !p.dead);
  }
  postStep(dt, live) {
    const map = this.map;
    for (const p of this.players) {
      const b = p.body;
      p.ground = false; p.groundBody = null; p.groundPt = null;
      for (let ce = b.getContactList(); ce; ce = ce.next) {
        const c = ce.contact;
        if (!c.isTouching()) continue;
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        if (fa.isSensor() || fb.isSensor()) continue;
        const wm = c.getWorldManifold(null);
        if (!wm) continue;
        const ny = fa.getBody() === b ? -wm.normal.y : wm.normal.y;
        if (ny > 0.35) {
          p.ground = true; p.groundBody = ce.other;
          const pt = wm.points && wm.points[0];
          p.groundPt = pt ? V2(pt.x, pt.y) : V2(b.getPosition().x, b.getPosition().y - 0.6);
          const ud = ce.other.getUserData();
          if (ud && ud.kind === 'mb' && ud.mb.crumble && ud.mb.state === 0 && p.alive) { ud.mb.state = 1; ud.mb.timer = 0; }
        }
      }
      if (p.ground) p.lastGround = this.t;
      const pos = b.getPosition();
      if (p.alive) {
        let cause = map.dead ? map.dead(this, p) : null;
        if (!cause && (pos.y < map.killY || pos.x < map.minX - 6 || pos.x > map.maxX + 6)) cause = 'sturz';
        if (cause) this.kill(p, cause, null);
      }
      if (p.alive && map.cps) {
        for (let i = p.cp + 1; i < map.cps.length; i++) if (pos.x >= map.cps[i].x) p.cp = i;
      }
      p.prog = clamp((pos.x - map.startX) / (map.goalX - map.startX), 0, 1);
      if (p.alive && p.hp > 0 && this.phase === 'play') {
        const g = map.goal(this);
        if (pos.x > g.x0 && pos.x < g.x1 && pos.y > g.y0 && pos.y < g.y1) {
          this.phase = 'escaped'; this.phaseT = 0; this.winner = p.idx; p.escapes++;
          // Eingestiegen: Figur verschwindet im Fluchtfahrzeug und kann nicht mehr sterben (sonst lag eine "Leiche" im Ziel)
          p.escaped = true; p.shield = 0; p.weapon = null; p.ammo = 0;
          b.setLinearVelocity(V2(0, 0)); b.setAngularVelocity(0); b.setActive(false);
          this.ev('escape', p.idx);
        }
      }
      if (p.alive && !p.escaped) {
        const c = b.getPosition();
        for (const pk of this.pickups) {
          if (pk.taken) continue;
          const k = pk.body.getPosition();
          if (Math.abs(k.x - c.x) < 0.62 && Math.abs(k.y - c.y) < 0.95) {
            pk.taken = true;
            p.weapon = pk.w; p.ammo = WEAPONS[pk.w].ammo; p.cd = 0.15;
            this.ev('pick', p.idx, WKEYS.indexOf(pk.w));
          }
        }
      }
    }
    for (const pk of this.pickups) {
      if (pk.body.getPosition().y < map.killY - 2) pk.taken = true;
      if (pk.taken) this.world.destroyBody(pk.body);
    }
    if (this.pickups.some(k => k.taken)) this.pickups = this.pickups.filter(k => !k.taken);
    if (live) {
      this.pickT -= dt;
      if (this.pickT <= 0) {
        this.pickT = 3.2 + this.rng() * 3;
        if (this.pickups.length < (map.maxPickups || 6)) this.spawnPickup(false);
      }
    }
  }
  updatePhase() {
    if (this.phase === 'countdown' && this.phaseT >= 3) { this.phase = 'play'; this.phaseT = 0; this.ev('go'); }
    else if (this.phase === 'escaped' && this.phaseT >= 3.6 && !this.done) {
      this.done = this.players[this.winner].escapes >= WIN_SCORE ? 'over' : 'next';
    }
  }

  // ---------- Zustand für Grafik und Netzwerk ----------
  view() {
    const P = this.players.map(p => {
      const b = p.body, pos = b.getPosition(), v = b.getLinearVelocity();
      let fl = 0;
      if (p.alive) fl |= 1; if (p.ground) fl |= 2; if (p.shield > 0) fl |= 4; if (p.flash > 0) fl |= 8;
      if (p.input.l) fl |= 16; if (p.input.r) fl |= 32; if (p.escaped) fl |= 64;
      return [pos.x, pos.y, b.getAngle(), p.aim, p.weapon ? WKEYS.indexOf(p.weapon) : -1, p.ammo, Math.max(0, Math.round(p.hp)), fl, v.x, v.y];
    });
    const M = this.movers.map(mb => { const b = mb.body, p = b.getPosition(); return [p.x, p.y, b.getAngle(), mb.state]; });
    const K = this.pickups.map(k => { const p = k.body.getPosition(); return [k.id, WKEYS.indexOf(k.w), p.x, p.y, k.body.getAngle()]; });
    const R = this.projs.map(r => [r.id, r.kind === 'rocket' ? 0 : 1, r.x, r.y, r.a || 0]);
    return { t: this.t, ph: this.phase, pt: this.phaseT, w: this.winner, P, M, K, R,
      sc: this.players.map(p => p.escapes), kl: this.players.map(p => p.kills), H: this.map.netState ? this.map.netState(this) : 0 };
  }
}
function r3(v) { return Math.round(v * 1000) / 1000; }
function r2(v) { return Math.round(v * 100) / 100; }
// Kompakte Version für das Netzwerk
function packView(v) {
  return {
    t: r3(v.t), ph: v.ph, pt: r2(v.pt), w: v.w, sc: v.sc, kl: v.kl, H: v.H,
    P: v.P.map(a => [r3(a[0]), r3(a[1]), r3(a[2]), r2(a[3]), a[4], a[5], a[6], a[7], r2(a[8]), r2(a[9])]),
    M: v.M.map(a => [r3(a[0]), r3(a[1]), r3(a[2]), a[3]]),
    K: v.K.map(a => [a[0], a[1], r2(a[2]), r2(a[3]), r2(a[4])]),
    R: v.R.map(a => [a[0], a[1], r2(a[2]), r2(a[3]), r2(a[4])]),
  };
}

// Brett/Plattform, die nach kurzem Betreten einstürzt
function crumbleHit(sim, mb, dmg) { if (mb.state === 0) { mb.state = 1; mb.timer = Math.max(0, (mb.def.delay || 0.6) - 0.25); } }
function crumbleBlast(sim, mb) { if (mb.state <= 1) { mb.state = 1; mb.timer = 99; } }
