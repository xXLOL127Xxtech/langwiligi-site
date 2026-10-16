// Gitterkrieg – Online-Teil der Gäste: Zustand des Hosts empfangen, weich interpolieren,
// eigenes Schiff sofort lokal bewegen (Vorhersage) und Eingaben an den Host schicken.
'use strict';

const SNAP_EVERY = 4;   // Host sendet alle 4 Schritte (15x pro Sekunde) einen Zustand

class ClientView {
  constructor(roster, mySlot) {
    this.mySlot = mySlot;
    this.ships = []; this.enemies = []; this.emap = new Map();
    this.bullets = []; this.bpool = []; this.geoms = []; this.gpool = []; this.bombs = [];
    this.bRaw = []; this.gRaw = []; this.kRaw = [];
    this.lastRecv = 0; this.interval = SNAP_EVERY / 60; this.tl = 0; this.have = false; this.stamp = 0;
    this.holes = [];
    this.setRoster(roster);
  }
  setRoster(roster) {
    this.roster = roster;
    for (let i = 0; i < roster.length; i++) {
      if (!this.ships[i]) {
        this.ships[i] = { slot: i, x: AW / 2, y: AH / 2, px: AW / 2, py: AH / 2, tx: AW / 2, ty: AH / 2, vx: 0, vy: 0, ang: 0, tang: 0, aim: 0,
          alive: false, inv: 0, firing: false, gone: false, score: 0, mult: 1, lives: 0, bombs: 0, sx: 0, sy: 0 };
      }
      this.ships[i].name = roster[i].n; this.ships[i].bot = roster[i].b >= 0 ? { lvl: roster[i].b } : null;
    }
    this.ships.length = roster.length;
  }

  applySnap(d, now) {
    const gap = now - this.lastRecv;
    if (this.lastRecv && gap > 0.01 && gap < 0.5) this.interval = lerp(this.interval, gap, 0.15);
    this.lastRecv = now;
    // Schiffe
    const s = d.s, n = Math.min(this.ships.length, s.length / 9);
    for (let i = 0; i < n; i++) {
      const o = i * 9, sh = this.ships[i], f = s[o];
      const was = sh.alive;
      sh.alive = !!(f & 1); sh.inv = f & 2 ? 1 : 0; sh.firing = !!(f & 4); sh.gone = !!(f & 8);
      const x = s[o + 1], y = s[o + 2];
      sh.score = s[o + 5]; sh.mult = s[o + 6]; sh.lives = s[o + 7]; sh.bombs = s[o + 8];
      if (i === this.mySlot) {
        sh.sx = x; sh.sy = y;
        if ((sh.alive && !was) || !this.have || Math.hypot(sh.x - x, sh.y - y) > 260) { sh.x = x; sh.y = y; sh.vx = sh.vy = 0; }
      } else {
        sh.tang = s[o + 3] / 100; sh.aim = s[o + 4] / 100;
        if ((sh.alive && !was) || !this.have) { sh.x = sh.px = sh.tx = x; sh.y = sh.py = sh.ty = y; sh.ang = sh.tang; }
        else { sh.px = sh.x; sh.py = sh.y; sh.tx = x; sh.ty = y; }
      }
    }
    // Gegner
    const st = ++this.stamp, e = d.e;
    for (let o = 0; o < e.length; o += 5) {
      const id = e[o], type = e[o + 1], x = e[o + 2], y = e[o + 3], fl = e[o + 4];
      let en = this.emap.get(id);
      if (!en) {
        en = { id, type, x, y, px: x, py: y, tx: x, ty: y, vx: 0, vy: 0, ang: rnd(TAU), spawn: 0, absorb: 0, r: EDEF[type].r, tail: null, spin: id % 2 ? 1 : -1 };
        if (type === ET.SNAKE) { en.tail = new Float32Array(SNAKE_N * 2); for (let i = 0; i < SNAKE_N; i++) { en.tail[i * 2] = x; en.tail[i * 2 + 1] = y; } }
        this.emap.set(id, en);
      } else { en.px = en.x; en.py = en.y; en.tx = x; en.ty = y; }
      en.spawn = fl & 1; en.absorb = fl >> 1;
      if (type === ET.BLACKHOLE) en.r = EDEF[type].r + en.absorb * 1.5;
      en.st = st;
    }
    for (const [id, en] of this.emap) if (en.st !== st) this.emap.delete(id);
    this.enemies = Array.from(this.emap.values());
    this.bRaw = d.b; this.gRaw = d.g; this.kRaw = d.k; this.tl = d.tl;
    this.have = true;
  }

  // inp: lokale Eingabe {mx, my, aim, fire}
  update(dt, now, inp) {
    if (!this.have) return;
    const a = clamp((now - this.lastRecv) / this.interval, 0, 1.2);
    const age = Math.min(0.25, now - this.lastRecv);
    this.holes.length = 0;
    for (const e of this.enemies) if (e.type === ET.BLACKHOLE && !e.spawn) this.holes.push(e);
    for (const sh of this.ships) {
      if (sh.slot === this.mySlot) continue;
      const ox = sh.x, oy = sh.y;
      sh.x = sh.px + (sh.tx - sh.px) * a; sh.y = sh.py + (sh.ty - sh.py) * a;
      if (dt > 0) { sh.vx = lerp(sh.vx, (sh.x - ox) / dt, 0.3); sh.vy = lerp(sh.vy, (sh.y - oy) / dt, 0.3); }
      sh.ang += angDiff(sh.ang, sh.tang) * Math.min(1, dt * 15);
    }
    // eigenes Schiff: gleiche Physik wie beim Host
    const me = this.ships[this.mySlot];
    if (me && me.alive) {
      let mx = inp.mx, my = inp.my;
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      const k = 1 - Math.exp(-dt * 14);
      me.vx += (mx * SHIP_SPEED - me.vx) * k; me.vy += (my * SHIP_SPEED - me.vy) * k;
      me.x += me.vx * dt; me.y += me.vy * dt;
      pullByHoles(me, this.holes, dt);
      me.x = clamp(me.x, SHIP_R, AW - SHIP_R); me.y = clamp(me.y, SHIP_R, AH - SHIP_R);
      if (me.vx * me.vx + me.vy * me.vy > 900) me.ang += angDiff(me.ang, Math.atan2(me.vy, me.vx)) * Math.min(1, dt * 16);
      if (inp.aim != null) me.aim = inp.aim;
    } else if (me) { me.vx = me.vy = 0; }
    // Gegner
    for (const e of this.enemies) {
      e.x = e.px + (e.tx - e.px) * a; e.y = e.py + (e.ty - e.py) * a;
      const vx = (e.tx - e.px) / this.interval, vy = (e.ty - e.py) / this.interval;
      e.vx = lerp(e.vx, vx, 0.3); e.vy = lerp(e.vy, vy, 0.3);
      switch (e.type) {
        case ET.WANDERER: e.ang += dt * 4; break;
        case ET.WEAVER: e.ang += dt * 2.5; break;
        case ET.SPLITTER: e.ang += dt * 1.6 * e.spin; break;
        case ET.MINI: e.ang += dt * 9 * e.spin; break;
        case ET.BLACKHOLE: e.ang += dt * 0.6; break;
        default: if (e.vx * e.vx + e.vy * e.vy > 25) e.ang += angDiff(e.ang, Math.atan2(e.vy, e.vx)) * Math.min(1, dt * 12);
      }
      if (e.tail) followTail(e);
    }
    // Geschosse geradeaus weiterrechnen
    const b = this.bRaw;
    let nb = 0;
    for (let o = 0; o < b.length; o += 4) {
      const an = b[o + 2] / 100, c = Math.cos(an), s = Math.sin(an);
      const x = b[o] + c * BULLET_SPEED * age, y = b[o + 1] + s * BULLET_SPEED * age;
      if (x < 0 || x > AW || y < 0 || y > AH) continue;
      const it = this.bpool[nb] || (this.bpool[nb] = { x: 0, y: 0, vx: 0, vy: 0, o: 0 });
      it.x = x; it.y = y; it.vx = c * BULLET_SPEED; it.vy = s * BULLET_SPEED; it.o = b[o + 3];
      nb++;
    }
    this.bullets = this.bpool.slice(0, nb);
    const g = this.gRaw;
    let ng = 0;
    for (let o = 0; o < g.length; o += 3) {
      const it = this.gpool[ng] || (this.gpool[ng] = { x: 0, y: 0, life: 6 });
      it.x = g[o]; it.y = g[o + 1]; it.life = g[o + 2] ? 1 : 6;
      ng++;
    }
    this.geoms = this.gpool.slice(0, ng);
    this.bombs.length = 0;
    for (let o = 0; o < this.kRaw.length; o += 3) this.bombs.push({ x: this.kRaw[o], y: this.kRaw[o + 1], r: this.kRaw[o + 2] + 2500 * age });
  }
}
