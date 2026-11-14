// Gitterkrieg – Partikelsystem (typisierte Arrays) und Effekte aus Spielereignissen
'use strict';

const Partikel = (() => {
  const MAX = 9000;
  const x = new Float32Array(MAX), y = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX);
  const life = new Float32Array(MAX), maxl = new Float32Array(MAX);
  const cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX);
  const len = new Float32Array(MAX), wid = new Float32Array(MAX), drag = new Float32Array(MAX);
  const grav = new Uint8Array(MAX);
  let n = 0, limit = MAX;

  function add(px, py, pvx, pvy, l, r, g, b, ln, w, dr, gv) {
    let i;
    if (n < limit) i = n++;
    else i = (Math.random() * n) | 0;      // voll: zufälligen alten ersetzen
    x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy; life[i] = maxl[i] = l;
    cr[i] = r; cg[i] = g; cb[i] = b; len[i] = ln; wid[i] = w; drag[i] = dr; grav[i] = gv ? 1 : 0;
  }

  // holes: [x, y, stärke, ...]
  function update(dt, holes) {
    const nh = holes.length / 3;
    for (let i = 0; i < n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        n--;
        if (i < n) {
          x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n]; life[i] = life[n]; maxl[i] = maxl[n];
          cr[i] = cr[n]; cg[i] = cg[n]; cb[i] = cb[n]; len[i] = len[n]; wid[i] = wid[n]; drag[i] = drag[n]; grav[i] = grav[n];
          i--;
        }
        continue;
      }
      let ux = vx[i], uy = vy[i];
      if (grav[i] && nh) {
        for (let h = 0; h < nh; h++) {
          const dx = holes[h * 3] - x[i], dy = holes[h * 3 + 1] - y[i];
          const d2 = dx * dx + dy * dy;
          if (d2 < 260 * 260) {
            const d = Math.sqrt(d2) + 1, s = holes[h * 3 + 2];
            const a = 9000 * s / (d + 40);
            ux += (dx / d * a + dy / d * a * 0.6) * dt;   // Sog plus Drall
            uy += (dy / d * a - dx / d * a * 0.6) * dt;
            if (d < 20) life[i] = Math.min(life[i], 0.05);
          }
        }
      }
      const k = Math.pow(drag[i], dt * 60);
      ux *= k; uy *= k;
      let nx = x[i] + ux * dt, ny = y[i] + uy * dt;
      if (nx < 0) { nx = -nx; ux = -ux * 0.6; } else if (nx > AW) { nx = 2 * AW - nx; ux = -ux * 0.6; }
      if (ny < 0) { ny = -ny; uy = -uy * 0.6; } else if (ny > AH) { ny = 2 * AH - ny; uy = -uy * 0.6; }
      x[i] = nx; y[i] = ny; vx[i] = ux; vy[i] = uy;
    }
  }

  function draw() {
    for (let i = 0; i < n; i++) {
      const t = life[i] / maxl[i];
      const sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      const a = Math.min(1, t * 2) * Math.min(1, sp / 60 + 0.25);
      const k = 0.032 * len[i];
      R.seg(x[i], y[i], x[i] - vx[i] * k, y[i] - vy[i] * k, wid[i], cr[i], cg[i], cb[i], a);
    }
  }

  return {
    add, update, draw,
    get count() { return n; },
    set limit(v) { limit = clamp(v | 0, 500, MAX); },
    clear() { n = 0; },
  };
})();

// ---------- Effekte: verwandelt Spielereignisse in Partikel, Gitterkräfte, Ton und Kamerawackeln ----------
const EV = { EXPL: 1, SHIPDIE: 2, BOMB: 3, WALL: 4, SPAWN: 5, GEOM: 6, HIT: 7, BHBOOM: 8, EXTRA: 9, RESPAWN: 10, PVP: 11, SHOT: 12, SPLIT: 13 };

const FX = {
  shake: 0, flash: 0, tint: [1, 1, 1],
  mySlot: -1,
  onNotice: null,         // (titel, untertitel, farbe)
  onFloat: null,          // (x, y, text, farbe)
  quality: 1,

  burst(x, y, col, count, speed, lifeMin, lifeMax, w, white, grav) {
    count = Math.round(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (1 - Math.pow(1 - Math.random(), 2.2));
      const m = Math.random() < (white || 0) ? 1 : 0;
      const j = 0.75 + Math.random() * 0.5;
      Partikel.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(lifeMin, lifeMax),
        m ? 1.9 : col[0] * 1.6 * j, m ? 1.9 : col[1] * 1.6 * j, m ? 1.9 : col[2] * 1.6 * j, 1, w || 1.6, 0.94, grav !== false);
    }
  },
  ring(x, y, col, count, speed, life, w) {
    count = Math.round(count * this.quality);
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU;
      const s = speed * rnd(0.92, 1.08);
      Partikel.add(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rnd(0.7, 1.1), col[0] * 1.8, col[1] * 1.8, col[2] * 1.8, 1, w || 2.2, 0.95, false);
    }
  },

  handle(ev, ships) {
    switch (ev[0]) {
      case EV.EXPL: {
        const [, x, y, t, sz] = ev;
        const c = EDEF[t] ? EDEF[t].col : BULLET_COL;
        if (sz === 3) {          // von Bombe oder Tod weggeräumt: kleiner, ohne Punkte
          this.burst(x, y, c, 40, 600, 0.4, 1.1, 1.6, 0.2);
          Gitter.explosive(20, x, y, 100);
          Snd.boom(0);
        } else if (sz === 2) {
          this.burst(x, y, c, 420, 1100, 0.8, 2.2, 2.2, 0.25);
          this.ring(x, y, [1, 0.5, 0.5], 90, 900, 1.2, 2.6);
          Gitter.explosive(180, x, y, 320);
          this.shake = Math.max(this.shake, 14);
          Snd.boom(2);
        } else {
          this.burst(x, y, c, sz ? 160 : 110, sz ? 900 : 720, 0.5, 1.5, 1.7, 0.18);
          Gitter.explosive(sz ? 70 : 38, x, y, sz ? 200 : 140);
          if (sz) this.shake = Math.max(this.shake, 4);
          Snd.boom(sz ? 1 : 0);
        }
        break;
      }
      case EV.SHIPDIE: {
        const [, x, y, slot] = ev;
        const c = PCOLS[slot % PCOLS.length] || PCOLS[0];
        this.burst(x, y, c, 700, 1400, 1.0, 2.8, 2.4, 0.4);
        this.burst(x, y, [1, 0.7, 0.3], 350, 900, 0.8, 2.2, 2, 0.3);
        this.ring(x, y, c, 100, 1100, 1.2, 2.2);
        Gitter.explosive(420, x, y, 450, -120);
        this.shake = Math.max(this.shake, slot === this.mySlot ? 28 : 14);
        if (slot === this.mySlot) { this.flash = Math.max(this.flash, 0.5); this.tint = [1, 0.4, 0.3]; }
        Snd.die();
        break;
      }
      case EV.BOMB: {
        const [, x, y, slot] = ev;
        const c = PCOLS[slot % PCOLS.length] || PCOLS[0];
        this.ring(x, y, [1, 1, 1], 160, 1500, 1.1, 2);
        this.ring(x, y, c, 140, 1100, 1.3, 1.8);
        this.burst(x, y, c, 220, 1200, 0.6, 1.6, 1.7, 0.5, false);
        Gitter.explosive(700, x, y, 800, -150);
        this.shake = Math.max(this.shake, 22);
        this.flash = Math.max(this.flash, 0.35); this.tint = [0.6, 0.8, 1];
        Snd.bomb();
        break;
      }
      case EV.WALL: {
        const [, x, y] = ev;
        this.burst(x, y, BULLET_COL, 8, 380, 0.2, 0.5, 1.3, 0.3, false);
        Gitter.explosive(10, x, y, 70);
        Snd.wall();
        break;
      }
      case EV.SPAWN: {
        const [, x, y, t] = ev;
        const c = EDEF[t] ? EDEF[t].col : BULLET_COL;
        this.ring(x, y, c, 18, 260, 0.45, 1.6);
        Snd.spawn();
        break;
      }
      case EV.GEOM: {
        const [, x, y, slot, m] = ev;
        this.burst(x, y, GEOM_COL, 10, 260, 0.2, 0.5, 1.4, 0.4, false);
        if (slot === this.mySlot) {
          Snd.geom(m || 1);
          if (m && m % 25 === 0 && this.onNotice) this.onNotice('x' + m, 'Multiplikator', '#ffd84a');
        }
        break;
      }
      case EV.HIT: {
        const [, x, y, t] = ev;
        const c = t === -1 ? TAIL_COL : EDEF[t] ? EDEF[t].col : BULLET_COL;
        this.burst(x, y, c, 14, 420, 0.2, 0.6, 1.4, 0.5, false);
        Gitter.explosive(14, x, y, 80);
        Snd.hit();
        break;
      }
      case EV.BHBOOM: {
        const [, x, y] = ev;
        this.burst(x, y, EDEF[ET.BLACKHOLE].col, 500, 1300, 0.9, 2.4, 2.2, 0.3);
        this.ring(x, y, EDEF[ET.PROTON].col, 100, 1000, 1.2, 2.4);
        Gitter.explosive(380, x, y, 420, -150);
        this.shake = Math.max(this.shake, 16);
        Snd.boom(2);
        break;
      }
      case EV.EXTRA: {
        const [, slot, kind] = ev;
        if (slot === this.mySlot) {
          Snd.extra();
          if (this.onNotice) this.onNotice(kind ? 'Bombe +1' : 'Extra-Leben!', kind ? 'Smart-Bomben aufgestockt' : 'Ein Schiff mehr', kind ? '#3ae0ff' : '#3dffb0');
        }
        break;
      }
      case EV.RESPAWN: {
        const [, x, y, slot] = ev;
        const c = PCOLS[slot % PCOLS.length] || PCOLS[0];
        this.ring(x, y, c, 70, -500, 0.6, 2);
        Gitter.implosive(60, x, y, 220);
        if (slot === this.mySlot) Snd.respawn();
        break;
      }
      case EV.PVP: {
        const [, victim, killer] = ev;
        if (this.onPvp) this.onPvp(victim, killer);
        break;
      }
      case EV.SHOT: {
        if (ev[1] === this.mySlot) Snd.shoot();
        break;
      }
      case EV.SPLIT: {
        const [, x, y] = ev;
        this.ring(x, y, EDEF[ET.MINI].col, 30, 500, 0.5, 1.8);
        break;
      }
    }
  },

  // laufende Effekte pro Bildschirm-Frame: Triebwerke, Raketenflammen, Schwarze Löcher, Gitterkräfte
  // erzeugt Partikel abhängig von dt
  continuous(dt, view, time) {
    const q = this.quality;
    for (const s of view.ships) {
      if (!s.alive) continue;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 40) {
        const n = Math.random() < dt * 90 * q ? 2 : 1;
        const bx = s.x - s.vx / sp * 14, by = s.y - s.vy / sp * 14;
        const side = Math.sin(time * 18 + s.slot) * 0.6;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(-s.vy, -s.vx) + (Math.random() - 0.5) * 0.5 + side * (i ? -1 : 1);
          const v = rnd(120, 260);
          const hot = Math.random() < 0.4;
          Partikel.add(bx, by, Math.cos(a) * v + s.vx * 0.2, Math.sin(a) * v + s.vy * 0.2, rnd(0.25, 0.5),
            hot ? 1.9 : 1.9, hot ? 1.8 : 1.1, hot ? 1.4 : 0.35, 1, 1.8, 0.92, true);
        }
        Gitter.directed(s.vx * 0.0012, s.vy * 0.0012, 0, s.x, s.y, 60);
      }
    }
    for (const e of view.enemies) {
      if (e.spawn > 0) continue;
      if (e.type === ET.ROCKET && Math.random() < dt * 40 * q) {
        const a = e.ang + Math.PI + rnd(-0.3, 0.3);
        Partikel.add(e.x - Math.cos(e.ang) * 14, e.y - Math.sin(e.ang) * 14, Math.cos(a) * 200, Math.sin(a) * 200, 0.3, 1.9, 0.9, 0.2, 1, 1.5, 0.92, false);
      } else if (e.type === ET.BLACKHOLE) {
        const k = 1 + (e.absorb || 0) * 0.1;
        Gitter.implosive((Math.sin(time * 2 + e.id) * 10 + 22) * k, e.x, e.y, 260 + (e.absorb || 0) * 6);
        if (Math.random() < dt * 60 * q) {
          const a = time * 3 + e.id;
          const r = e.r + 6;
          Partikel.add(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.cos(a) * 260, Math.sin(a) * 260, rnd(0.8, 1.6),
            1.9, rnd(0.3, 1.2), 0.3, 1, 1.6, 0.97, true);
        }
      }
    }
    for (const b of view.bullets) Gitter.explosive(5.5, b.x, b.y, 60, -20);
  },

  decay(dt) {
    this.shake = Math.max(0, this.shake - dt * 60);
    this.flash = Math.max(0, this.flash - dt * 1.8);
  },
};
