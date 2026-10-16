'use strict';
// ============================================================
//  Bots: drücken dieselben Tasten wie Menschen (A/D + Zielen + Schiessen)
// ============================================================
const BOT_LEVELS = [
  { name: 'Leicht', aimErr: 0.24, react: 0.75, cool: 0.38, hold: [0.04, 0.22], patience: 1.2, fireP: 0.55, look: 14 },
  { name: 'Mittel', aimErr: 0.11, react: 0.4, cool: 0.16, hold: [0.04, 0.12], patience: 2.2, fireP: 0.85, look: 20 },
  { name: 'Schwer', aimErr: 0.04, react: 0.18, cool: 0.04, hold: [0.03, 0.07], patience: 3.5, fireP: 1, look: 28 },
];

class Bot {
  constructor(sim, p, level) {
    this.sim = sim; this.p = p; this.L = BOT_LEVELS[clamp(level, 0, 2)];
    this.hold = 0; this.cool = 0.3 + Math.random() * 0.4; this.wait = 0;
    this.target = null; this.seen = 0; this.scan = 0; this.err = 0; this.errT = 0;
    this.best = 0; this.stuck = 0; this.back = 0; this.aim = 0;
  }
  press(side) {
    const inp = this.p.input;
    if (side > 0) { inp.rp++; inp.r = true; inp.l = false; } else { inp.lp++; inp.l = true; inp.r = false; }
    const h = this.L.hold;
    this.hold = h[0] + Math.random() * (h[1] - h[0]);
  }
  // Prüft einen Sprung in Richtung side: landet die Figur sicher?
  safeHop(side) { this.hazardHit = false; return this._safeHop(side); }
  _safeHop(side) {
    const sim = this.sim, b = this.p.body;
    const pos = b.getPosition();
    let pvx = 0, pvy = 0;
    if (this.p.groundBody && this.p.groundPt) { const v = this.p.groundBody.getLinearVelocityFromWorldPoint(this.p.groundPt); pvx = v.x; pvy = v.y; }
    const tilt = clamp(-normAng(b.getAngle()), -0.7, 0.7);
    let vx = pvx + side * JUMP_VX + tilt * JUMP_TILT, vy = pvy + JUMP_VY;
    let x = pos.x, y = pos.y - 0.55;
    const hz = sim.map.hazards ? sim.map.hazards(sim) : [];
    const dt = 0.05;
    let landed = null;
    for (let t = 0; t < 1.4; t += dt) {
      const nx = x + vx * dt, ny = y + vy * dt; vy -= GRAV * dt;
      // Gefahren entlang der Flugbahn (Kopf = Füsse + 1.25)
      for (const h of hz) {
        if (h.circle) { const c = h.circle(t); if (Math.hypot(nx - c.x, ny + 0.6 - c.y) < c.r + 0.75) { this.hazardHit = true; return false; } }
        else { const x0 = h.x0 + h.vx * t - 0.4, x1 = h.x1 + h.vx * t + 0.4; if (nx > x0 && nx < x1 && ny + 1.3 > h.yb - 0.05) { this.hazardHit = true; return false; } }
      }
      if (vy < 0) {
        const hit = this.groundRay(V2(x, y), V2(nx, ny));
        if (hit) { landed = hit; break; }
      }
      x = nx; y = ny;
    }
    if (!landed) {
      landed = this.groundRay(V2(x, y), V2(x, sim.map.killY - 1));
      if (!landed) return false;
    }
    // Wand statt Boden getroffen -> was liegt darunter?
    if (landed.normal.y < 0.5) {
      const back = landed.point.x - Math.sign(vx || side) * 0.35;
      landed = this.groundRay(V2(back, landed.point.y), V2(back, sim.map.killY - 1));
      if (!landed) return false;
    }
    if (landed.point.y < sim.map.killY + 0.8) return false;
    // beide Fusskanten brauchen Halt
    for (const dx of [-0.4, 0.4]) {
      const h = this.groundRay(V2(landed.point.x + dx, landed.point.y + 0.4), V2(landed.point.x + dx, landed.point.y - 0.9));
      if (!h || h.normal.y < 0.5) return false;
    }
    if (sim.map.fus) {
      const l = sim.map.fus.body.getLocalPoint(landed.point);
      if (l.x > 44.5) return false;
    }
    return true;
  }
  groundRay(a, c) {
    let best = null;
    const me = this.p.body;
    this.sim.world.rayCast(a, c, (f, pt, n, fr) => {
      if (f.isSensor() || f.getBody() === me) return -1;
      const cat = f.getFilterCategoryBits();
      if (cat & (CAT.PICKUP | CAT.GREN)) return -1;
      const ud = f.getBody().getUserData();
      if (ud && ud.kind === 'mb' && (ud.mb.state === 3 || ud.mb.state === 2 || (ud.mb.state === 1 && ud.mb.timer > 0.35))) return -1;
      best = { point: V2(pt.x, pt.y), normal: V2(n.x, n.y), f };
      return fr;
    });
    return best;
  }
  visible(q) {
    const sim = this.sim;
    const a = sim.shoulder(this.p), c = q.body.getPosition();
    const hit = sim.ray(a, c, this.p.body);
    return hit && hit.f.getBody() === q.body;
  }
  update(dt) {
    const sim = this.sim, p = this.p, inp = p.input, L = this.L;
    if (this.hold > 0) { this.hold -= dt; if (this.hold <= 0) { inp.l = false; inp.r = false; } }
    if (!p.alive || sim.phase === 'countdown') { inp.fire = false; if (!p.alive) { inp.l = inp.r = false; this.target = null; } return; }
    const b = p.body, pos = b.getPosition();
    const ang = normAng(b.getAngle()), av = b.getAngularVelocity();
    const map = sim.map, goal = map.goal(sim);
    let tx = (goal.x0 + goal.x1) / 2;
    // Fortschritt / Feststecken
    if (pos.x > this.best + 0.5) { this.best = pos.x; this.stuck = 0; } else this.stuck += dt;
    if (p.deadT === 0 && this.lastAlive === false) this.best = pos.x;
    this.lastAlive = p.alive;
    // Waffe suchen
    if (!p.weapon) {
      let bestD = 9;
      for (const k of sim.pickups) {
        const c = k.body.getPosition();
        const dx = c.x - pos.x, dy = c.y - pos.y;
        if (dx < -4 || Math.abs(dy) > 2.6) continue;
        const d = Math.hypot(dx, dy);
        if (d < bestD) { bestD = d; tx = c.x; }
      }
    }
    if (this.back > 0) { this.back -= dt; tx = pos.x - 5; }
    // Bewegung
    this.cool -= dt;
    if (p.ground && this.cool <= 0 && this.hold <= 0) {
      if (Math.abs(ang) > 0.85) {
        // liegt: meist rappelt sich die Figur selbst auf; nur wenn es lange dauert, mit sicherem Hopser helfen
        if (p.lieT > 1.2 && this.safeHop(ang > 0 ? 1 : -1)) { this.press(ang > 0 ? 1 : -1); this.cool = L.cool + 0.3; }
      } else if (Math.abs(av) < 3 && Math.abs(ang) < 0.55) {
        const dir = tx > pos.x + 0.4 ? 1 : tx < pos.x - 0.4 ? -1 : (pos.y < goal.y0 ? (Math.random() < 0.5 ? 1 : -1) : 0);
        const gud = p.groundBody && p.groundBody.getUserData();
        const onCrumble = gud && gud.kind === 'mb' && gud.mb.crumble && gud.mb.state >= 1;
        if (onCrumble) {
          // Brett bricht: sofort weg, vorwärts wenn möglich
          const d = this.safeHop(dir || 1) ? (dir || 1) : this.safeHop(-(dir || 1)) ? -(dir || 1) : (this.hazardHit ? 0 : (dir || 1));
          if (d) { this.press(d); this.cool = L.cool; this.wait = 0; }
        } else if (dir !== 0) {
          if (this.safeHop(dir) || (this.wait > L.patience * 3 && !this.hazardHit)) {
            this.press(dir); this.wait = 0; this.cool = L.cool + Math.random() * L.cool;
          } else {
            this.wait += dt;
            // nicht sicher: zurückhopsen, um die Absprungstelle zu verschieben
            if (this.wait > 0.25 + L.patience * 0.3 && this.safeHop(-dir) && Math.random() < 0.15) { this.press(-dir); this.cool = L.cool + 0.1; this.wait = L.patience * 0.5; }
          }
        }
      }
      if (this.stuck > 7) { this.stuck = 0; this.back = 0.6; }
    }
    // Kampf
    this.scan -= dt;
    if (this.scan <= 0) {
      this.scan = 0.25;
      let best = null, bd = L.look;
      for (const q of sim.players) {
        if (q === p || !q.alive || q.escaped) continue;
        const c = q.body.getPosition();
        const d = Math.hypot(c.x - pos.x, c.y - pos.y);
        if (d < bd && this.visible(q)) { bd = d; best = q; }
      }
      if (best !== this.target) { this.target = best; this.seen = 0; }
    }
    this.errT -= dt;
    if (this.errT <= 0) { this.errT = 0.3 + Math.random() * 0.4; this.err = (Math.random() - 0.5) * 2 * L.aimErr; }
    let want = Math.cos(this.aim) >= 0 ? 0.1 : Math.PI - 0.1;
    inp.fire = false;
    if (this.target && p.weapon) {
      this.seen += dt;
      const W = WEAPONS[p.weapon];
      const sh = sim.shoulder(p), q = this.target, c = q.body.getPosition(), v = q.body.getLinearVelocity();
      let dx = c.x - sh.x, dy = c.y - sh.y;
      const d = Math.hypot(dx, dy);
      if (W.kind === 'rocket') { const t = d / W.speed; dx += v.x * t; dy += v.y * t; want = Math.atan2(dy, dx); }
      else if (W.kind === 'grenade') {
        const s = W.speed, g = GRAV, X = Math.abs(dx), Y = dy;
        const disc = s ** 4 - g * (g * X * X + 2 * Y * s * s);
        let a = disc >= 0 ? Math.atan((s * s - Math.sqrt(disc)) / (g * X)) : Math.PI / 4;
        want = dx >= 0 ? a : Math.PI - a;
      } else want = Math.atan2(dy, dx);
      want += this.err;
      const okRange = W.kind === 'hit' ? d < W.range * 0.85 : (W.kind === 'rocket' ? d > 3.8 && d < 22 : d > 3 && d < 13);
      const shotgunOk = p.weapon !== 'schrot' || d < 9;
      if (this.seen > L.react && okRange && shotgunOk && Math.abs(normAng(this.aim - want)) < 0.2 && Math.random() < L.fireP) inp.fire = true;
    } else if (!p.weapon) want = tx >= pos.x ? 0.15 : Math.PI - 0.15;
    // Zielen dreht sich weich (wie eine Hand am Touchpad)
    const turn = [6, 10, 16][BOT_LEVELS.indexOf(L)] * dt;
    const da = normAng(want - this.aim);
    this.aim = normAng(this.aim + clamp(da, -turn, turn));
    inp.aim = this.aim;
  }
}
