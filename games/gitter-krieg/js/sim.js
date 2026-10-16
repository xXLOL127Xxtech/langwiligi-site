// Gitterkrieg – Spielsimulation: Schiffe, Geschosse, Gegner-Verhalten, Geoms, Smart-Bomben, Wellen und Bots.
// Läuft beim Host (bzw. lokal) in festen 1/60-s-Schritten. Ereignisse landen in sim.ev und werden zu Effekten.
'use strict';

const SHIP_R = 13, SHIP_SPEED = 430, BULLET_SPEED = 1150;
const MAX_ENEMIES = 260, MAX_GEOMS = 180, MAX_BULLETS = 700;
const HCS = 64, HC = Math.ceil(AW / HCS), HR = Math.ceil(AH / HCS);

// Waffenstufen nach Multiplikator: [Winkelversatz, seitlicher Versatz]
const WEAPONS = [
  { at: 1, int: 0.1, pat: [[-0.035, -5], [0.035, 5]] },
  { at: 10, int: 0.1, pat: [[-0.1, 0], [0, 0], [0.1, 0]] },
  { at: 30, int: 0.09, pat: [[-0.16, -3], [-0.055, -3], [0.055, 3], [0.16, 3]] },
  { at: 75, int: 0.08, pat: [[-0.24, 0], [-0.12, 0], [0, 0], [0.12, 0], [0.24, 0]] },
];
function weaponOf(mult) { let w = 0; for (let i = 0; i < WEAPONS.length; i++) if (mult >= WEAPONS[i].at) w = i; return w; }

const BOT_DIFF = [
  { name: 'Leicht', react: 0.35, err: 0.35, danger: 120, look: 0, lead: 0, speed: 0.7, bombN: 14, geom: 0.3, dodge: false, turn: 6 },
  { name: 'Mittel', react: 0.17, err: 0.14, danger: 180, look: 0.12, lead: 0.4, speed: 0.85, bombN: 7, geom: 0.8, dodge: true, turn: 14 },
  { name: 'Schwer', react: 0.04, err: 0.025, danger: 250, look: 0.25, lead: 1, speed: 1, bombN: 5, geom: 1.2, dodge: true, turn: 40 },
];

class Sim {
  constructor(cfg) {
    this.cfg = Object.assign({ mode: 'solo', time: 180, demo: false }, cfg);
    this.t = 0; this.diffT = 0;
    this.ships = []; this.enemies = []; this.bullets = []; this.geoms = []; this.bombs = []; this.holes = [];
    this.ev = []; this.nid = 1;
    this.spawnAcc = 0; this.formT = 11; this.calm = 1.4;
    this.over = false;
    this.timeLeft = this.cfg.mode === 'versus' ? this.cfg.time : 0;
    this.head = new Int32Array(HC * HR); this.next = new Int32Array(1024);
  }
  get versus() { return this.cfg.mode === 'versus'; }
  emit(...a) { this.ev.push(a); }

  addShip(name, botLvl, seat) {
    const slot = this.ships.length;
    const a = slot / 6 * TAU - Math.PI / 2;
    const r = this.ships.length ? 170 : 0;
    const s = {
      slot, seat: seat == null ? -1 : seat, name, bot: null, remote: false, gone: false,
      x: AW / 2 + Math.cos(a) * r, y: AH / 2 + Math.sin(a) * r, vx: 0, vy: 0, ang: -Math.PI / 2, aim: -Math.PI / 2,
      alive: true, deadT: 0, inv: 2.5, lives: 3, bombs: 3, score: 0, mult: 1, maxMult: 1, prog: 0, kills: 0, deaths: 0, pk: 0,
      fireCD: 0, firing: false, inp: { mx: 0, my: 0, aim: null, fire: false }, bombReq: 0, bombDone: 0,
      nextLife: 75000, nextBomb: 100000, netX: null, netY: null,
    };
    if (botLvl != null) {
      s.bot = { lvl: botLvl, d: BOT_DIFF[botLvl], t: rnd(0.2), wx: AW / 2, wy: AH / 2, wt: 0, bombCD: 3, err: 0, aimT: null };
    }
    if (this.t > 0) { s.inv = 3; this.emit(EV.RESPAWN, s.x | 0, s.y | 0, slot); }
    this.ships.push(s);
    return s;
  }

  // ---------------- Hauptschritt ----------------
  step() {
    const dt = STEP;
    if (this.over) return;
    this.t += dt; this.diffT += dt;
    if (this.versus) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.over = true; return; }
    }
    this.holes.length = 0;
    for (const e of this.enemies) if (e.type === ET.BLACKHOLE && e.spawn <= 0) this.holes.push(e);
    for (const s of this.ships) if (s.bot) this.botThink(s, dt);
    for (const s of this.ships) this.updateShip(s, dt);
    this.updateBullets(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.blackHoles(dt);
    this.buildHash();
    this.separate();
    this.bulletHits();
    this.shipHits();
    this.updateGeoms(dt);
    this.updateBombs(dt);
    compact(this.enemies); compact(this.bullets); compact(this.geoms);
    this.spawning(dt);
    this.checkOver();
  }

  // ---------------- Schiffe ----------------
  updateShip(s, dt) {
    if (s.gone) return;
    if (!s.alive) {
      if (s.lives > 0 || this.versus || this.cfg.demo) {
        s.deadT -= dt;
        if (s.deadT <= 0) this.respawn(s);
      }
      return;
    }
    if (s.inv > 0) s.inv -= dt;
    const inp = s.inp;
    if (s.remote) {
      // Gast steuert sein Schiff selbst, der Host übernimmt die gemeldete Position
      if (s.netX != null) {
        const ox = s.x, oy = s.y;
        s.x += (clamp(s.netX, SHIP_R, AW - SHIP_R) - s.x) * 0.5;
        s.y += (clamp(s.netY, SHIP_R, AH - SHIP_R) - s.y) * 0.5;
        s.vx = (s.x - ox) / dt; s.vy = (s.y - oy) / dt;
      }
    } else {
      let mx = inp.mx, my = inp.my;
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      const sp = SHIP_SPEED * (s.bot ? s.bot.d.speed : 1);
      const k = 1 - Math.exp(-dt * 14);
      s.vx += (mx * sp - s.vx) * k; s.vy += (my * sp - s.vy) * k;
      s.x += s.vx * dt; s.y += s.vy * dt;
      pullByHoles(s, this.holes, dt);
      if (s.x < SHIP_R) { s.x = SHIP_R; s.vx = Math.max(0, s.vx); } else if (s.x > AW - SHIP_R) { s.x = AW - SHIP_R; s.vx = Math.min(0, s.vx); }
      if (s.y < SHIP_R) { s.y = SHIP_R; s.vy = Math.max(0, s.vy); } else if (s.y > AH - SHIP_R) { s.y = AH - SHIP_R; s.vy = Math.min(0, s.vy); }
    }
    if (s.vx * s.vx + s.vy * s.vy > 900) s.ang += angDiff(s.ang, Math.atan2(s.vy, s.vx)) * Math.min(1, dt * 16);
    if (inp.aim != null) { s.aim = inp.aim; s.firing = !!inp.fire; } else s.firing = false;
    s.fireCD -= dt;
    if (s.firing && s.fireCD <= 0) {
      const w = WEAPONS[weaponOf(s.mult)];
      this.fire(s, w);
      s.fireCD += w.int;
      if (s.fireCD < 0) s.fireCD = 0;
    } else if (!s.firing && s.fireCD < 0) s.fireCD = 0;
    if (s.bombReq > s.bombDone) {
      s.bombDone = s.bombReq;
      if (s.bombs > 0) this.useBomb(s);
    }
  }

  fire(s, w) {
    if (this.bullets.length > MAX_BULLETS) return;
    const ca = Math.cos(s.aim), sa = Math.sin(s.aim);
    for (const p of w.pat) {
      const a = s.aim + p[0] + (Math.random() - 0.5) * 0.025;
      this.bullets.push({
        x: s.x + ca * 14 - sa * p[1], y: s.y + sa * 14 + ca * p[1],
        vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, o: s.slot, dead: false,
      });
    }
    this.emit(EV.SHOT, s.slot);
  }

  useBomb(s) {
    s.bombs--;
    s.inv = Math.max(s.inv, 1.2);
    this.bombs.push({ x: s.x, y: s.y, r: 0, slot: s.slot });
    this.emit(EV.BOMB, s.x | 0, s.y | 0, s.slot);
  }

  respawn(s) {
    let bx = AW / 2, by = AH / 2;
    if (this.ships.length > 1 || this.enemies.length) {
      let best = -1;
      for (let i = 0; i < 18; i++) {
        const x = i === 0 ? AW / 2 : rnd(150, AW - 150), y = i === 0 ? AH / 2 : rnd(130, AH - 130);
        let md = 1e9;
        for (const e of this.enemies) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < md) md = d; }
        for (const o of this.ships) if (o !== s && o.alive) { const d = ((o.x - x) ** 2 + (o.y - y) ** 2) * (this.versus ? 1 : 4); if (d < md) md = d; }
        if (md > best) { best = md; bx = x; by = y; }
      }
    }
    s.x = bx; s.y = by; s.vx = s.vy = 0;
    s.alive = true; s.inv = 2.5; s.fireCD = 0.3; s.netX = s.netY = null;
    this.emit(EV.RESPAWN, bx | 0, by | 0, s.slot);
  }

  dieShip(s, killer) {
    if (!s.alive) return;
    s.alive = false; s.deaths++; s.mult = 1; s.vx = s.vy = 0;
    s.deadT = this.versus ? 2.2 : 2.0;
    this.emit(EV.SHIPDIE, s.x | 0, s.y | 0, s.slot);
    if (!this.versus && !this.cfg.demo) s.lives--;
    if (killer != null && killer >= 0 && killer !== s.slot && this.ships[killer]) {
      const k = this.ships[killer];
      k.score += 1000 * k.mult; k.pk++;
      this.emit(EV.PVP, s.slot, killer);
    }
    const all = this.ships.filter(o => !o.gone).length === 1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (all || (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < 340 * 340) this.kill(e, -1, true);
    }
    if (all) {
      this.bullets.length = 0; this.geoms.length = 0;
      this.calm = 2.4; this.spawnAcc = 0; this.diffT = Math.max(0, this.diffT - 15);
    }
  }

  extras(s) {
    if (this.versus || this.cfg.demo) return;
    while (s.score >= s.nextLife) { s.lives++; s.nextLife = Math.round(s.nextLife * 3); this.emit(EV.EXTRA, s.slot, 0); }
    while (s.score >= s.nextBomb) { s.bombs = Math.min(9, s.bombs + 1); s.nextBomb = Math.round(s.nextBomb * 3); this.emit(EV.EXTRA, s.slot, 1); }
  }

  nearestShip(x, y) {
    let best = null, bd = 1e12;
    for (const s of this.ships) {
      if (!s.alive) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---------------- Geschosse ----------------
  updateBullets(dt) {
    const holes = this.holes;
    for (const b of this.bullets) {
      for (const h of holes) {
        const dx = h.x - b.x, dy = h.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 300 * 300) {
          const d = Math.sqrt(d2) + 0.01, f = 2400 * (1 - d / 300);
          b.vx += dx / d * f * dt; b.vy += dy / d * f * dt;
          const sp = Math.hypot(b.vx, b.vy);
          b.vx *= BULLET_SPEED / sp; b.vy *= BULLET_SPEED / sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0 || b.x > AW || b.y < 0 || b.y > AH) {
        b.dead = true;
        this.emit(EV.WALL, clamp(b.x, 0, AW) | 0, clamp(b.y, 0, AH) | 0);
      }
    }
  }

  // ---------------- Gegner ----------------
  spawnEnemy(type, x, y, o) {
    o = o || {};
    if (this.enemies.length >= MAX_ENEMIES + 40) return null;
    const d = EDEF[type];
    const e = {
      id: this.nid++, type, x: clamp(x, d.r, AW - d.r), y: clamp(y, d.r, AH - d.r), vx: o.vx || 0, vy: o.vy || 0,
      ang: rnd(TAU), r: d.r, hp: d.hp, spawn: o.now ? 0 : (o.spawn || 0.8), t: 0,
      dir: o.dir != null ? o.dir : rnd(TAU), turn: 0, spin: o.spin || (Math.random() < 0.5 ? -1 : 1), absorb: 0, tail: null, dead: false,
    };
    if (type === ET.SNAKE) { e.tail = new Float32Array(SNAKE_N * 2); for (let i = 0; i < SNAKE_N; i++) { e.tail[i * 2] = e.x; e.tail[i * 2 + 1] = e.y; } }
    if (type === ET.ROCKET) e.ang = e.dir;
    this.enemies.push(e);
    if (!o.now) this.emit(EV.SPAWN, e.x | 0, e.y | 0, type);
    return e;
  }

  updateEnemy(e, dt) {
    if (e.dead) return;
    e.t += dt;
    if (e.spawn > 0) { e.spawn -= dt; return; }
    const sf = 1 + Math.min(0.4, this.diffT / 500);
    const tg = this.nearestShip(e.x, e.y);
    let dx = 0, dy = 0, d = 1;
    if (tg) { dx = tg.x - e.x; dy = tg.y - e.y; d = Math.hypot(dx, dy) + 0.01; }
    switch (e.type) {
      case ET.WANDERER: {
        e.turn += (Math.random() - 0.5) * dt * 14;
        e.turn = clamp(e.turn, -2.2, 2.2);
        e.dir += e.turn * dt;
        if (e.x < 70 || e.x > AW - 70 || e.y < 70 || e.y > AH - 70) {
          e.dir += angDiff(e.dir, Math.atan2(AH / 2 - e.y, AW / 2 - e.x)) * dt * 3;
        }
        e.vx = Math.cos(e.dir) * 105 * sf; e.vy = Math.sin(e.dir) * 105 * sf;
        e.ang += dt * 4;
        break;
      }
      case ET.SEEKER: case ET.PROTON: {
        const acc = e.type === ET.PROTON ? 1700 : 1100, max = (e.type === ET.PROTON ? 390 : 250) * sf;
        if (tg) { e.vx += dx / d * acc * dt; e.vy += dy / d * acc * dt; }
        limit(e, max);
        e.vx *= 0.99; e.vy *= 0.99;
        e.ang = Math.atan2(e.vy, e.vx);
        break;
      }
      case ET.WEAVER: {
        if (tg) { e.vx += dx / d * 1300 * dt; e.vy += dy / d * 1300 * dt; }
        // Ausweichen vor anfliegenden Geschossen
        for (const b of this.bullets) {
          const rx = e.x - b.x, ry = e.y - b.y;
          if (rx * rx + ry * ry > 170 * 170) continue;
          const bl = BULLET_SPEED, bx = b.vx / bl, by = b.vy / bl;
          const along = rx * bx + ry * by;
          if (along < 0) continue;
          const perp = rx * by - ry * bx;
          if (Math.abs(perp) < 46) {
            const sgn = perp >= 0 ? 1 : -1;
            e.vx += by * sgn * 3600 * dt; e.vy += -bx * sgn * 3600 * dt;
          }
        }
        limit(e, 300 * sf);
        e.vx *= 0.985; e.vy *= 0.985;
        e.ang += dt * 2.5;
        break;
      }
      case ET.SPLITTER: {
        if (tg) { e.vx += dx / d * 500 * dt; e.vy += dy / d * 500 * dt; }
        limit(e, 135 * sf);
        e.ang += dt * 1.6 * e.spin;
        break;
      }
      case ET.MINI: {
        if (tg) {
          const a = Math.atan2(dy, dx) + e.spin * 1.05;
          e.vx += (Math.cos(a) * 340 * sf - e.vx) * Math.min(1, dt * 5);
          e.vy += (Math.sin(a) * 340 * sf - e.vy) * Math.min(1, dt * 5);
        }
        e.ang += dt * 9 * e.spin;
        break;
      }
      case ET.SNAKE: {
        const want = tg ? Math.atan2(dy, dx) : e.dir;
        e.dir += clamp(angDiff(e.dir, want), -2.1 * dt, 2.1 * dt) + Math.sin(e.t * 5 + e.id) * dt * 2.2;
        if (e.x < 50 || e.x > AW - 50 || e.y < 50 || e.y > AH - 50) e.dir += angDiff(e.dir, Math.atan2(AH / 2 - e.y, AW / 2 - e.x)) * dt * 4;
        e.vx = Math.cos(e.dir) * 225 * sf; e.vy = Math.sin(e.dir) * 225 * sf;
        e.ang = e.dir;
        break;
      }
      case ET.ROCKET: {
        e.vx = Math.cos(e.dir) * 380 * sf; e.vy = Math.sin(e.dir) * 380 * sf;
        e.ang = e.dir;
        break;
      }
      case ET.BLACKHOLE: {
        e.vx += (Math.random() - 0.5) * 60 * dt; e.vy += (Math.random() - 0.5) * 60 * dt;
        if (tg) { e.vx += dx / d * 8 * dt; e.vy += dy / d * 8 * dt; }
        limit(e, 28);
        e.ang += dt * 0.6;
        break;
      }
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    const r = e.r;
    if (e.x < r) { e.x = r; bounce(e, 1, 0); } else if (e.x > AW - r) { e.x = AW - r; bounce(e, -1, 0); }
    if (e.y < r) { e.y = r; bounce(e, 0, 1); } else if (e.y > AH - r) { e.y = AH - r; bounce(e, 0, -1); }
    if (e.tail) followTail(e);
  }

  blackHoles(dt) {
    for (const h of this.holes) {
      if (h.dead) continue;
      const R = 360 + h.absorb * 6;
      for (const e of this.enemies) {
        if (e === h || e.dead || e.spawn > 0 || e.type === ET.BLACKHOLE) continue;
        const dx = h.x - e.x, dy = h.y - e.y, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2) + 0.01;
        if (d < h.r + e.r * 0.4) {
          e.dead = true;
          h.absorb++; h.hp = Math.min(h.hp + 1, 30); h.r = EDEF[ET.BLACKHOLE].r + h.absorb * 1.5;
          this.emit(EV.HIT, e.x | 0, e.y | 0, e.type);
          if (h.absorb >= 10) { this.overload(h); break; }
          continue;
        }
        const k = 280 * (1 - d / R);
        e.x += dx / d * k * dt; e.y += dy / d * k * dt;
      }
      for (const g of this.geoms) {
        const dx = h.x - g.x, dy = h.y - g.y, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2) + 0.01;
        if (d < h.r) { g.dead = true; continue; }
        const k = 320 * (1 - d / R);
        g.x += dx / d * k * dt; g.y += dy / d * k * dt;
      }
    }
  }

  overload(h) {
    h.dead = true;
    this.emit(EV.BHBOOM, h.x | 0, h.y | 0);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      this.spawnEnemy(ET.PROTON, h.x + Math.cos(a) * 30, h.y + Math.sin(a) * 30, { now: true, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420 });
    }
  }

  buildHash() {
    const es = this.enemies;
    if (es.length > this.next.length) this.next = new Int32Array(es.length * 2);
    this.head.fill(-1);
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead) continue;
      const c = cellOf(e.x, e.y);
      this.next[i] = this.head[c]; this.head[c] = i;
    }
  }

  separate() {
    const es = this.enemies, head = this.head, next = this.next;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead || e.spawn > 0 || e.type === ET.BLACKHOLE) continue;
      const ci = Math.min(HC - 1, Math.max(0, Math.floor(e.x / HCS))), cj = Math.min(HR - 1, Math.max(0, Math.floor(e.y / HCS)));
      let budget = 12;   // in dichten Haufen nur einige Nachbarn prüfen
      for (let j = Math.max(0, cj - 1); j <= Math.min(HR - 1, cj + 1) && budget > 0; j++) {
        for (let k = Math.max(0, ci - 1); k <= Math.min(HC - 1, ci + 1) && budget > 0; k++) {
          for (let m = head[j * HC + k]; m !== -1 && budget > 0; m = next[m]) {
            if (m === i) continue;
            budget--;
            const o = es[m];
            if (o.dead || o.spawn > 0 || o.type === ET.BLACKHOLE) continue;
            const dx = o.x - e.x, dy = o.y - e.y, rr = (e.r + o.r) * 0.85, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) + 0.01, p = (rr - d) * 0.25;
            e.x -= dx / d * p; e.y -= dy / d * p;
          }
        }
      }
    }
  }

  bulletHits() {
    const es = this.enemies, head = this.head, next = this.next;
    const snakes = es.filter(e => e.type === ET.SNAKE && !e.dead && e.spawn <= 0);
    for (const b of this.bullets) {
      if (b.dead) continue;
      const ci = Math.min(HC - 1, Math.max(0, Math.floor(b.x / HCS))), cj = Math.min(HR - 1, Math.max(0, Math.floor(b.y / HCS)));
      let hit = null;
      for (let j = Math.max(0, cj - 1); j <= Math.min(HR - 1, cj + 1) && !hit; j++) {
        for (let k = Math.max(0, ci - 1); k <= Math.min(HC - 1, ci + 1) && !hit; k++) {
          for (let m = head[j * HC + k]; m !== -1; m = next[m]) {
            const e = es[m];
            if (e.dead || e.spawn > 0 || e.type === ET.BLACKHOLE) continue;
            const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + 5;
            if (dx * dx + dy * dy < rr * rr) { hit = e; break; }
          }
        }
      }
      if (hit) {
        b.dead = true;
        if (--hit.hp <= 0) this.kill(hit, b.o, false); else this.emit(EV.HIT, b.x | 0, b.y | 0, hit.type);
        continue;
      }
      for (const h of this.holes) {
        if (h.dead) continue;
        const dx = h.x - b.x, dy = h.y - b.y, rr = h.r + 5;
        if (dx * dx + dy * dy < rr * rr) {
          b.dead = true;
          h.vx += b.vx * 0.03; h.vy += b.vy * 0.03;
          if (--h.hp <= 0) this.kill(h, b.o, false); else this.emit(EV.HIT, b.x | 0, b.y | 0, ET.BLACKHOLE);
          break;
        }
      }
      if (b.dead) continue;
      for (const sn of snakes) {
        const t = sn.tail;
        for (let i = 0; i < SNAKE_N; i++) {
          const dx = t[i * 2] - b.x, dy = t[i * 2 + 1] - b.y;
          if (dx * dx + dy * dy < 12 * 12) { b.dead = true; this.emit(EV.HIT, b.x | 0, b.y | 0, -1); break; }
        }
        if (b.dead) break;
      }
      if (b.dead || !this.versus) continue;
      for (const s of this.ships) {
        if (s.slot === b.o || !s.alive || s.inv > 0) continue;
        const dx = s.x - b.x, dy = s.y - b.y, rr = SHIP_R + 4;
        if (dx * dx + dy * dy < rr * rr) { b.dead = true; this.dieShip(s, b.o); break; }
      }
    }
  }

  kill(e, by, noScore) {
    if (e.dead) return;
    e.dead = true;
    const sz = noScore ? 3 : e.type === ET.BLACKHOLE ? 2 : (e.type === ET.SNAKE || e.type === ET.SPLITTER) ? 1 : 0;
    this.emit(EV.EXPL, e.x | 0, e.y | 0, e.type, sz);
    if (e.type === ET.SNAKE && !noScore) {
      for (let i = 2; i < SNAKE_N; i += 3) this.emit(EV.HIT, e.tail[i * 2] | 0, e.tail[i * 2 + 1] | 0, -1);
    }
    if (noScore) return;
    const s = this.ships[by];
    if (s) {
      const base = e.type === ET.BLACKHOLE ? Math.min(450, 150 + e.absorb * 30) : EDEF[e.type].pts;
      s.score += base * s.mult; s.prog += s.mult; s.kills++;
      this.extras(s);
    }
    const ng = e.type === ET.BLACKHOLE ? 6 : (e.type === ET.MINI || e.type === ET.PROTON) ? (Math.random() < 0.5 ? 1 : 0) : 1;
    for (let i = 0; i < ng && this.geoms.length < MAX_GEOMS; i++) {
      const a = rnd(TAU), v = rnd(40, ng > 1 ? 260 : 130);
      this.geoms.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 6.5, dead: false });
    }
    if (e.type === ET.SPLITTER) {
      this.emit(EV.SPLIT, e.x | 0, e.y | 0);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + rnd(1);
        this.spawnEnemy(ET.MINI, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, { now: true, spin: i % 2 ? 1 : -1, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320 });
      }
    }
  }

  shipHits() {
    for (const s of this.ships) {
      if (!s.alive || s.inv > 0) continue;
      for (const e of this.enemies) {
        if (e.dead || e.spawn > 0) continue;
        const dx = e.x - s.x, dy = e.y - s.y, rr = SHIP_R + e.r * 0.7;
        if (dx * dx + dy * dy < rr * rr) { this.dieShip(s, -1); break; }
        if (e.tail) {
          let hit = false;
          for (let i = 0; i < SNAKE_N; i++) {
            const tx = e.tail[i * 2] - s.x, ty = e.tail[i * 2 + 1] - s.y;
            if (tx * tx + ty * ty < (SHIP_R + 6) ** 2) { hit = true; break; }
          }
          if (hit) { this.dieShip(s, -1); break; }
        }
      }
    }
  }

  updateGeoms(dt) {
    const k = Math.pow(0.95, dt * 60);
    for (const g of this.geoms) {
      if (g.dead) continue;
      g.life -= dt;
      if (g.life <= 0) { g.dead = true; continue; }
      let best = null, bd = 175 * 175;
      for (const s of this.ships) {
        if (!s.alive) continue;
        const d = (s.x - g.x) ** 2 + (s.y - g.y) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      if (best) {
        const d = Math.sqrt(bd) + 0.01;
        if (d < 26) {
          g.dead = true;
          best.mult++; if (best.mult > best.maxMult) best.maxMult = best.mult;
          this.emit(EV.GEOM, g.x | 0, g.y | 0, best.slot, best.mult);
          continue;
        }
        const a = 2600 * (1 - d / 175) + 700;
        g.vx += (best.x - g.x) / d * a * dt; g.vy += (best.y - g.y) / d * a * dt;
      } else { g.vx *= k; g.vy *= k; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.x < 6 || g.x > AW - 6) { g.vx = -g.vx; g.x = clamp(g.x, 6, AW - 6); }
      if (g.y < 6 || g.y > AH - 6) { g.vy = -g.vy; g.y = clamp(g.y, 6, AH - 6); }
    }
  }

  updateBombs(dt) {
    for (const b of this.bombs) {
      b.r += 2500 * dt;
      const r2 = b.r * b.r;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < r2) this.kill(e, -1, true);
      }
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) if (this.bombs[i].r > 2300) this.bombs.splice(i, 1);
  }

  // ---------------- Wellen ----------------
  spawning(dt) {
    if (this.cfg.noSpawn) return;
    if (this.calm > 0) { this.calm -= dt; return; }
    const T = this.diffT;
    const np = this.ships.filter(s => !s.gone).length;
    const rate = Math.min(20, (1.6 + T * 0.065) * (1 + 0.3 * (np - 1)));
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < MAX_ENEMIES) this.spawnRandom(T);
    }
    this.formT -= dt;
    if (this.formT <= 0) {
      this.formation(T);
      this.formT = rnd(8, 14) - Math.min(4, T / 60);
    }
  }

  count(type) { let n = 0; for (const e of this.enemies) if (e.type === type && !e.dead) n++; return n; }

  safePos(minD, margin) {
    margin = margin || 50;
    let bx = rnd(margin, AW - margin), by = rnd(margin, AH - margin), bd = -1;
    for (let i = 0; i < 16; i++) {
      const x = rnd(margin, AW - margin), y = rnd(margin, AH - margin);
      let md = 1e12;
      for (const s of this.ships) if (s.alive) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < md) md = d; }
      if (md >= minD * minD) return [x, y];
      if (md > bd) { bd = md; bx = x; by = y; }
    }
    return [bx, by];
  }

  spawnRandom(T) {
    const w = [
      3, 3 + T / 30, T > 18 ? 2 + T / 60 : 0, T > 30 ? 1.5 : 0, 0,
      T > 45 && this.count(ET.SNAKE) < 5 ? 0.7 : 0, T > 25 ? 1.2 : 0, T > 40 && this.count(ET.BLACKHOLE) < 4 ? 0.35 : 0, 0,
    ];
    let sum = 0; for (const v of w) sum += v;
    let r = Math.random() * sum, type = 0;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { type = i; break; } }
    if (type === ET.ROCKET) {
      const side = (Math.random() * 4) | 0;
      const p = side < 2 ? [side ? AW - 30 : 30, rnd(60, AH - 60)] : [rnd(60, AW - 60), side === 2 ? 30 : AH - 30];
      this.spawnEnemy(ET.ROCKET, p[0], p[1], { dir: [0, Math.PI, Math.PI / 2, -Math.PI / 2][side] });
      return;
    }
    const p = this.safePos(type === ET.BLACKHOLE ? 380 : 270);
    this.spawnEnemy(type, p[0], p[1]);
  }

  formation(T) {
    const opts = ['corners', 'ring'];
    if (T > 20) opts.push('rockets', 'weavers');
    if (T > 35) opts.push('splitters');
    if (T > 50) opts.push('snakes');
    if (T > 70 && this.count(ET.BLACKHOLE) < 3) opts.push('holes');
    const f = opts[(Math.random() * opts.length) | 0];
    const corners = [[70, 70], [AW - 70, 70], [70, AH - 70], [AW - 70, AH - 70]];
    const alive = this.ships.filter(s => s.alive);
    const far = () => {
      let best = corners[0], bd = -1;
      for (const c of corners) {
        let md = 1e12;
        for (const s of alive) md = Math.min(md, (s.x - c[0]) ** 2 + (s.y - c[1]) ** 2);
        if (md > bd) { bd = md; best = c; }
      }
      return best;
    };
    if (f === 'corners') {
      const n = Math.min(9, 3 + (T / 30 | 0));
      const type = T > 60 && Math.random() < 0.5 ? ET.WEAVER : ET.SEEKER;
      for (const c of corners) {
        if (alive.some(s => (s.x - c[0]) ** 2 + (s.y - c[1]) ** 2 < 260 * 260)) continue;
        for (let i = 0; i < n; i++) this.spawnEnemy(type, c[0] + rnd(-45, 45), c[1] + rnd(-45, 45), { spawn: 1 });
      }
    } else if (f === 'ring') {
      const s = alive[(Math.random() * alive.length) | 0];
      if (!s) return;
      const n = Math.min(22, 10 + (T / 20 | 0));
      const type = T < 40 ? ET.WANDERER : Math.random() < 0.5 ? ET.SEEKER : ET.WANDERER;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        this.spawnEnemy(type, s.x + Math.cos(a) * 340, s.y + Math.sin(a) * 340, { spawn: 1.2 });
      }
    } else if (f === 'rockets') {
      const side = (Math.random() * 4) | 0, n = 11;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const p = side < 2 ? [side ? AW - 30 : 30, 40 + t * (AH - 80)] : [40 + t * (AW - 80), side === 2 ? 30 : AH - 30];
        this.spawnEnemy(ET.ROCKET, p[0], p[1], { dir: [0, Math.PI, Math.PI / 2, -Math.PI / 2][side], spawn: 1 });
      }
    } else if (f === 'weavers') {
      const c = far();
      for (let i = 0; i < 6; i++) this.spawnEnemy(ET.WEAVER, c[0] + rnd(-60, 60), c[1] + rnd(-60, 60), { spawn: 1 });
    } else if (f === 'splitters') {
      const c = far();
      for (let i = 0; i < 4; i++) this.spawnEnemy(ET.SPLITTER, c[0] + rnd(-80, 80), c[1] + rnd(-80, 80), { spawn: 1 });
    } else if (f === 'snakes') {
      const c = far();
      for (let i = 0; i < 3; i++) this.spawnEnemy(ET.SNAKE, c[0] + rnd(-40, 40), c[1] + rnd(-40, 40), { spawn: 1 });
    } else if (f === 'holes') {
      for (let i = 0; i < 2; i++) { const p = this.safePos(420, 150); this.spawnEnemy(ET.BLACKHOLE, p[0], p[1], { spawn: 1 }); }
    }
  }

  checkOver() {
    if (this.versus || this.cfg.demo) return;
    const humans = this.ships.filter(s => !s.bot && !s.gone);
    if (humans.length && humans.every(s => !s.alive && s.lives <= 0)) this.over = true;
  }

  results() {
    return this.ships.filter(s => !s.gone || s.score > 0).map(s => ({
      slot: s.slot, name: s.name, bot: s.bot ? s.bot.lvl : -1, seat: s.seat, score: s.score, kills: s.kills, deaths: s.deaths,
      pk: s.pk, maxMult: s.maxMult, prog: s.prog,
    })).sort((a, b) => b.score - a.score);
  }

  // ---------------- Bots ----------------
  botThink(s, dt) {
    const B = s.bot, D = B.d, inp = s.inp;
    if (!s.alive) { inp.mx = inp.my = 0; inp.fire = false; inp.aim = null; return; }
    B.bombCD -= dt;
    if (B.aimT != null) {
      inp.aim = inp.aim == null ? B.aimT : inp.aim + clamp(angDiff(inp.aim, B.aimT), -D.turn * dt, D.turn * dt);
    }
    B.t -= dt;
    if (B.t > 0) return;
    const think = D.react * rnd(0.7, 1.3);
    B.t = think;
    let fx = 0, fy = 0, threat = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.vx * D.look, ey = e.y + e.vy * D.look;
      const range = D.danger + e.r + (e.type === ET.BLACKHOLE ? 220 : 0);
      const dx = s.x - ex, dy = s.y - ey, d2 = dx * dx + dy * dy;
      if (d2 < range * range) {
        const d = Math.sqrt(d2) + 0.01;
        let w = (range - d) / range;
        w = w * w * (e.spawn > 0 ? 0.45 : 1) * (e.type === ET.BLACKHOLE ? 2.5 : (e.type === ET.PROTON || e.type === ET.MINI || e.type === ET.ROCKET) ? 1.4 : 1);
        fx += dx / d * w * 4; fy += dy / d * w * 4; threat += w;
      }
      if (e.tail) {
        for (let i = 2; i < SNAKE_N; i += 3) {
          const tx = s.x - e.tail[i * 2], ty = s.y - e.tail[i * 2 + 1], t2 = tx * tx + ty * ty, rr = D.danger * 0.7;
          if (t2 < rr * rr) { const d = Math.sqrt(t2) + 0.01, w = ((rr - d) / rr) ** 2; fx += tx / d * w * 4; fy += ty / d * w * 4; threat += w; }
        }
      }
    }
    if (this.versus) {
      if (D.dodge) {
        for (const b of this.bullets) {
          if (b.o === s.slot) continue;
          const rx = s.x - b.x, ry = s.y - b.y;
          if (rx * rx + ry * ry > 280 * 280) continue;
          const bx = b.vx / BULLET_SPEED, by = b.vy / BULLET_SPEED, along = rx * bx + ry * by;
          if (along < 0) continue;
          const perp = rx * by - ry * bx;
          if (Math.abs(perp) < 42) { const sg = perp >= 0 ? 1 : -1, w = (280 - along) / 280 * 3; fx += by * sg * w; fy += -bx * sg * w; threat += w * 0.5; }
        }
      }
      // Abstand zu Gegenspielern halten
      for (const o of this.ships) {
        if (o === s || !o.alive) continue;
        const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy) + 0.01;
        if (d < 260) { const w = (260 - d) / 260 * 1.5; fx += dx / d * w; fy += dy / d * w; }
      }
    }
    const m = 150;
    if (s.x < m) fx += (m - s.x) / m * 3; else if (s.x > AW - m) fx -= (s.x - AW + m) / m * 3;
    if (s.y < m) fy += (m - s.y) / m * 3; else if (s.y > AH - m) fy -= (s.y - AH + m) / m * 3;
    if (threat < 1.2 && D.geom > 0) {
      let bg = null, bd = 480 * 480;
      for (const g of this.geoms) { const d = (g.x - s.x) ** 2 + (g.y - s.y) ** 2; if (d < bd) { bd = d; bg = g; } }
      if (bg) { const d = Math.sqrt(bd) + 0.01; fx += (bg.x - s.x) / d * D.geom; fy += (bg.y - s.y) / d * D.geom; }
    }
    B.wt -= think;
    if (fx * fx + fy * fy < 0.05) {
      if (B.wt <= 0 || (B.wx - s.x) ** 2 + (B.wy - s.y) ** 2 < 80 * 80) { B.wx = rnd(220, AW - 220); B.wy = rnd(180, AH - 180); B.wt = rnd(2, 4); }
      const dx = B.wx - s.x, dy = B.wy - s.y, d = Math.hypot(dx, dy) + 0.01;
      fx += dx / d * 0.55; fy += dy / d * 0.55;
    }
    const L = Math.hypot(fx, fy);
    if (L > 0.3) { fx /= L; fy /= L; }
    inp.mx = fx; inp.my = fy;
    // Ziel wählen
    let best = null, bs = 1e12;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - s.x, e.y - s.y) * (e.spawn > 0 ? 1.8 : 1) * (e.type === ET.BLACKHOLE ? 1.4 : 1);
      if (d < bs) { bs = d; best = e; }
    }
    if (this.versus) {
      for (const o of this.ships) {
        if (o === s || !o.alive || o.inv > 0) continue;
        const d = Math.hypot(o.x - s.x, o.y - s.y) * 0.75;
        if (d < bs) { bs = d; best = o; }
      }
    }
    if (best && bs < 1300) {
      const d = Math.hypot(best.x - s.x, best.y - s.y);
      const tt = d / BULLET_SPEED * D.lead;
      const tx = best.x + (best.vx || 0) * tt, ty = best.y + (best.vy || 0) * tt;
      B.err = lerp(B.err, (Math.random() * 2 - 1) * D.err, 0.5);
      B.aimT = Math.atan2(ty - s.y, tx - s.x) + B.err;
      inp.fire = true;
      if (inp.aim == null) inp.aim = B.aimT;
    } else { inp.fire = false; B.aimT = null; }
    if (B.bombCD <= 0 && s.bombs > 0 && s.inv <= 0) {
      let n = 0;
      for (const e of this.enemies) if (!e.dead && e.spawn <= 0 && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < 130 * 130) n++;
      if (n >= D.bombN) { s.bombReq++; B.bombCD = 4; }
    }
  }

  // ---------------- Netzwerk: kompakter Zustand für die Gäste ----------------
  snapshot() {
    const s = [], e = [], b = [], g = [], k = [];
    for (const sh of this.ships) {
      s.push((sh.alive ? 1 : 0) | (sh.inv > 0 ? 2 : 0) | (sh.firing ? 4 : 0) | (sh.gone ? 8 : 0),
        sh.x | 0, sh.y | 0, (sh.ang * 100) | 0, (sh.aim * 100) | 0, sh.score, sh.mult, sh.lives, sh.bombs);
    }
    for (const en of this.enemies) {
      if (en.dead) continue;
      e.push(en.id, en.type, en.x | 0, en.y | 0, (en.spawn > 0 ? 1 : 0) | (en.absorb << 1));
    }
    for (const bu of this.bullets) if (!bu.dead) b.push(bu.x | 0, bu.y | 0, (Math.atan2(bu.vy, bu.vx) * 100) | 0, bu.o);
    for (const ge of this.geoms) if (!ge.dead) g.push(ge.x | 0, ge.y | 0, ge.life < 1.5 ? 1 : 0);
    for (const bo of this.bombs) k.push(bo.x | 0, bo.y | 0, bo.r | 0);
    return { s, e, b, g, k, tl: Math.ceil(this.timeLeft) };
  }
}

// ---------------- Hilfsfunktionen ----------------
function compact(a) { let j = 0; for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i]; a.length = j; }
function limit(e, max) { const v = Math.hypot(e.vx, e.vy); if (v > max) { e.vx *= max / v; e.vy *= max / v; } }
function cellOf(x, y) {
  const i = Math.min(HC - 1, Math.max(0, Math.floor(x / HCS))), j = Math.min(HR - 1, Math.max(0, Math.floor(y / HCS)));
  return j * HC + i;
}
function bounce(e, nx, ny) {
  if (e.type === ET.ROCKET) { e.dir += Math.PI; return; }
  if (e.type === ET.WANDERER || e.type === ET.SNAKE) {
    if (nx) e.dir = Math.atan2(Math.sin(e.dir), nx * Math.abs(Math.cos(e.dir)));
    else e.dir = Math.atan2(ny * Math.abs(Math.sin(e.dir)), Math.cos(e.dir));
    return;
  }
  if (nx) e.vx = Math.abs(e.vx) * nx * 0.5;
  if (ny) e.vy = Math.abs(e.vy) * ny * 0.5;
}
function followTail(e) {
  const t = e.tail;
  let px = e.x - Math.cos(e.ang) * 8, py = e.y - Math.sin(e.ang) * 8;
  for (let i = 0; i < SNAKE_N; i++) {
    const dx = t[i * 2] - px, dy = t[i * 2 + 1] - py, d = Math.hypot(dx, dy);
    if (d > SNAKE_SP) { t[i * 2] = px + dx / d * SNAKE_SP; t[i * 2 + 1] = py + dy / d * SNAKE_SP; }
    px = t[i * 2]; py = t[i * 2 + 1];
  }
}
function pullByHoles(s, holes, dt) {
  for (const h of holes) {
    const R = 340 + (h.absorb || 0) * 6;
    const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) + 0.01;
    if (d < R) {
      const k = 230 * Math.pow(1 - d / R, 1.3) * (1 + (h.absorb || 0) * 0.05);
      s.x += dx / d * k * dt; s.y += dy / d * k * dt;
    }
  }
}
