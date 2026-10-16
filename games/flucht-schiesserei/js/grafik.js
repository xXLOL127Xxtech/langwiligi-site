'use strict';
// ============================================================
//  Grafik: zeichnet in niedriger Auflösung, skaliert pixelgenau hoch
// ============================================================
class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.sc = canvas.getContext('2d');
    [this.lo, this.ctx] = mkCanvas(320, 200);
    this.scale = 3;
    this.cam = { x: 0, y: 0, w: 320, h: 200 };
    this.camPos = null;
    this.parts = [];
    this.tracers = [];
    this.flashes = [];
    this.shake = 0;
    this.mouse = { x: 0, y: 0, in: false };
    this.resize();
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    this.cv.width = W; this.cv.height = H;
    this.dpr = dpr;
    this.scale = Math.max(2, Math.round(H / 265));
    this.lo.width = Math.ceil(W / this.scale); this.lo.height = Math.ceil(H / this.scale);
    this.ctx = this.lo.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.cam.w = this.lo.width; this.cam.h = this.lo.height;
  }
  reset() { this.parts = []; this.tracers = []; this.flashes = []; this.camPos = null; this.shake = 0; }
  // Bildschirm (CSS-Pixel) -> Welt (m)
  screenToWorld(mx, my) {
    const lx = mx * this.dpr / this.scale, ly = my * this.dpr / this.scale;
    return { x: (lx + this.cam.x) / PPM, y: (this.cam.y - ly) / PPM };
  }
  W2S(x, y) { return [x * PPM - this.cam.x, this.cam.y - y * PPM]; }

  updateCamera(sim, focus, dt) {
    const map = sim.map, cam = this.cam;
    const vw = cam.w / PPM, vh = cam.h / PPM;
    let fx = focus.x, fy = focus.y + 1.2;
    if (this.mouse.in) {
      const w = this.screenToWorld(this.mouse.x, this.mouse.y);
      fx += clamp((w.x - focus.x) * 0.22, -vw * 0.2, vw * 0.2);
      fy += clamp((w.y - focus.y) * 0.15, -vh * 0.15, vh * 0.15);
    }
    if (!this.camPos) this.camPos = { x: fx, y: fy };
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.x += (fx - this.camPos.x) * k;
    this.camPos.y += (fy - this.camPos.y) * k;
    let cx = this.camPos.x, cy = this.camPos.y;
    const x0 = map.minX - 1, x1 = map.maxX + 1;
    if (x1 - x0 < vw) cx = (x0 + x1) / 2; else cx = clamp(cx, x0 + vw / 2, x1 - vw / 2);
    if (map.camMaxY - map.camMinY < vh) cy = map.camMinY + vh / 2; else cy = clamp(cy, map.camMinY + vh / 2, map.camMaxY - vh / 2);
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake * 6; sy = (Math.random() - 0.5) * this.shake * 6; this.shake = Math.max(0, this.shake - dt * 2.5); }
    cam.x = Math.round((cx - vw / 2) * PPM + sx);
    cam.y = Math.round((cy + vh / 2) * PPM + sy);
  }

  // ---------- Effekte aus Ereignissen ----------
  burst(x, y, n, cols, sp, life, g = 18, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, col: cols[i % cols.length], g, size });
    }
  }
  event(e, slots, focusPos) {
    const t = e[0];
    const near = (x, y) => focusPos ? clamp(1 - Math.hypot(x - focusPos.x, y - focusPos.y) / 30, 0.08, 1) : 0.6;
    switch (t) {
      case 'jump': this.burst(e[2], e[3], 4, ['#d8d0c0', '#a8a090'], 2, 0.3, 4); SFX.play('jump', near(e[2], e[3]) * 0.6); break;
      case 'shot': {
        const [, pi, wc, x1, y1, x2, y2, kind] = e;
        const w = WKEYS[wc];
        if (WEAPONS[w].kind === 'hit') {
          this.tracers.push({ x1, y1, x2, y2, life: w === 'sniper' ? 0.35 : 0.08, max: w === 'sniper' ? 0.35 : 0.08, col: w === 'sniper' ? '#fff3c0' : '#ffe680', w: w === 'sniper' ? 2 : 1 });
          if (kind === 1) this.burst(x2, y2, 4, ['#fff3a0', '#ffb040', '#ffffff'], 6, 0.2, 10);
          if (kind === 2) this.burst(x2, y2, 6, ['#ffffff', '#ff6a5a', '#ffd040'], 5, 0.3, 10);
        }
        this.flashes.push({ x: x1, y: y1, life: 0.06, big: w === 'schrot' || w === 'rakete' || w === 'sniper' });
        if (w !== 'granate') this.parts.push({ x: x1, y: y1, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 2, life: 0.6, max: 0.6, col: '#f2c94c', g: 20, size: 1 });
        if (focusPos && pi >= 0) { const d = Math.hypot(x1 - focusPos.x, y1 - focusPos.y); if (d < 2 && (w === 'schrot' || w === 'rakete')) this.shake = Math.max(this.shake, 0.3); }
        SFX.play('s_' + w, near(x1, y1));
        break;
      }
      case 'hit': this.burst(e[2], e[3], 5, ['#ffffff', '#ffd040'], 4, 0.25, 8); SFX.play('hit', near(e[2], e[3]) * 0.8); break;
      case 'boom': {
        const [, x, y] = e;
        this.parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, boom: true, g: 0 });
        this.burst(x, y, 22, ['#fff3a0', '#ffb040', '#ef5350', '#ffd040'], 12, 0.5, 6, 2);
        for (let i = 0; i < 12; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 1.5, y: y + (Math.random() - 0.5) * 1.5, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, life: 1.2 + Math.random(), max: 2, col: '#5a5560', g: -1, size: 3, smoke: true });
        const n = near(x, y); this.shake = Math.max(this.shake, n * 1.1);
        SFX.play('boom', n);
        break;
      }
      case 'die': {
        const [, pi, x, y] = e;
        const o = OUTFITS[slots[pi].outfit];
        this.burst(x, y, 10, [o.main, '#ffffff', shade(o.main, -0.3)], 6, 0.6, 14);
        for (let i = 0; i < 5; i++) this.parts.push({ x, y: y + 0.8, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, life: 0.9, max: 0.9, star: true, g: 4 });
        SFX.play('die', near(x, y));
        break;
      }
      case 'spawn': this.burst(e[2], e[3], 12, ['#ffffff', '#6fdc8c'], 4, 0.5, 0); SFX.play('spawn', near(e[2], e[3]) * 0.6); break;
      case 'pick': SFX.play('pick', 0.8); break;
      case 'drop': this.burst(e[1], e[2], 6, ['#fff3a0', '#ffffff'], 2, 0.6, -2); break;
      case 'crumble': this.burst(e[1], e[2], 10, ['#b88446', '#7a5228', '#9a978f'], 3, 0.8, 16, 2); SFX.play('crumble', near(e[1], e[2])); break;
      case 'go': SFX.play('go', 1); break;
      case 'escape': SFX.play('escape', 1); break;
      case 'empty': SFX.play('empty', 0.5); break;
    }
  }
  updateFx(dt) {
    for (const p of this.parts) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.smoke) { p.vx *= 0.97; } }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter(t => t.life > 0);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
  }

  // ---------- Zeichnen ----------
  drawBody(mb, tf) {
    const s = mb.sprite;
    if (!s) return;
    const ctx = this.ctx, cam = this.cam;
    let [sx, sy] = this.W2S(tf[0], tf[1]);
    if (Math.abs(tf[2]) < 0.02) {
      if (sx - s.ox > cam.w || sx - s.ox + s.img.width < 0 || sy - s.oy > cam.h || sy - s.oy + s.img.height < 0) return;
    } else { const R = s.rad; if (sx + R < 0 || sx - R > cam.w || sy + R < 0 || sy - R > cam.h) return; }
    if (tf[3] === 1) { sx += Math.random() < 0.5 ? -1 : 1; }
    sx = Math.round(sx); sy = Math.round(sy);
    if (Math.abs(tf[2]) < 0.02) ctx.drawImage(s.img, sx - s.ox, sy - s.oy);
    else { ctx.save(); ctx.translate(sx, sy); ctx.rotate(-tf[2]); ctx.drawImage(s.img, -s.ox, -s.oy); ctx.restore(); }
  }
  drawDecos(sim, M, layer) {
    const ctx = this.ctx;
    for (const d of sim.decos) {
      if (d.layer !== layer || !d.img) continue;
      let x = d.x, y = d.y, a = 0;
      if (d.attach) { const tf = M[d.attach.mi]; const ca = Math.cos(tf[2]), sa = Math.sin(tf[2]); x = tf[0] + ca * d.x - sa * d.y; y = tf[1] + sa * d.x + ca * d.y; a = tf[2]; }
      const [sx, sy] = this.W2S(x, y);
      const w = d.img.width, h = d.img.height;
      if (sx + w < 0 || sx - w > this.cam.w || sy + h < 0 || sy - h > this.cam.h) continue;
      if (!a) ctx.drawImage(d.img, Math.round(sx - w / 2), Math.round(sy - h / 2));
      else { ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(-a); ctx.drawImage(d.img, -w / 2 | 0, -h / 2 | 0); ctx.restore(); }
    }
  }
  bodyTf(mb, M) { return mb.mi !== undefined ? M[mb.mi] : [mb.home.x, mb.home.y, mb.home.a, 0]; }
  drawLayerBodies(sim, M, layer) {
    for (const mb of sim.mbs) {
      if (mb.layer !== layer) continue;
      const tf = this.bodyTf(mb, M);
      if (tf[3] === 3) continue;
      this.drawBody(mb, tf);
    }
  }
  drawPlayer(p, slot, me) {
    const ctx = this.ctx;
    const [x, y, a, aim, wc, , , fl] = p;
    const alive = fl & 1, ground = fl & 2, shield = fl & 4, flash = fl & 8;
    if (fl & 64) return;   // ist ins Fluchtfahrzeug eingestiegen
    if (shield && Math.floor(performance.now() / 90) % 2) return;
    const F = FIG[slot.outfit];
    const face = Math.cos(aim) >= 0 ? 1 : -1;
    const key = (alive ? (ground ? 'stand' : 'jump') : 'dead') + (face < 0 ? 'L' : '') + (flash ? 'W' : '');
    const img = F[key];
    const [sx, sy] = this.W2S(x, y);
    if (sx < -40 || sx > this.cam.w + 40 || sy < -40 || sy > this.cam.h + 40) return;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.rotate(-a);
    ctx.drawImage(img, -5, -12);
    ctx.restore();
    if (!alive) return;
    // Arm und Waffe
    const o = OUTFITS[slot.outfit];
    const ca = Math.cos(a), sa = Math.sin(a);
    const shx = x + ca * 0.02 - sa * 0.1, shy = y + sa * 0.02 + ca * 0.1;
    const [ax, ay] = this.W2S(shx, shy);
    ctx.save();
    ctx.translate(Math.round(ax), Math.round(ay));
    ctx.rotate(-aim);
    const armPx = Math.round(ARM * PPM);
    ctx.fillStyle = '#17121d'; ctx.fillRect(0, -1, armPx + 1, 3);
    ctx.fillStyle = shade(o.main, -0.1); ctx.fillRect(0, 0, armPx - 1, 1);
    ctx.fillStyle = o.skin; ctx.fillRect(armPx - 1, 0, 2, 1);
    if (wc >= 0) {
      const w = WSPR[WKEYS[wc]];
      if (face > 0) ctx.drawImage(w.img, armPx - w.grip[0], -w.grip[1]);
      else ctx.drawImage(w.flip, armPx - w.grip[0], -(w.h - 1 - w.grip[1]));
      if (WKEYS[wc] === 'sniper' && me) { ctx.fillStyle = 'rgba(255,60,60,0.55)'; ctx.fillRect(armPx + w.muzzle[0] - w.grip[0], 0, 400, 1); }
    }
    ctx.restore();
    if (shield) { ctx.strokeStyle = 'rgba(160,240,255,0.7)'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), 16, 0, Math.PI * 2); ctx.stroke(); }
  }
  draw(sim, view, slots, meIdx, dt) {
    const ctx = this.ctx, cam = this.cam, map = sim.map;
    const M = view.M;
    ctx.imageSmoothingEnabled = false;
    map.drawBack(ctx, cam, view);
    this.drawDecos(sim, M, -2);
    this.drawLayerBodies(sim, M, -2);
    this.drawDecos(sim, M, -1);
    this.drawLayerBodies(sim, M, -1);
    if (map.drawMid) map.drawMid(ctx, cam, view, M);
    this.drawLayerBodies(sim, M, 0);
    this.drawDecos(sim, M, 0);
    // Ziel-Pfeil
    const g = this.goalRect;
    if (g) {
      const [gx, gy] = this.W2S((g.x0 + g.x1) / 2, g.y1 + 0.6);
      ctx.drawImage(GOAL_ARROW, Math.round(gx - 4), Math.round(gy + Math.sin(view.t * 5) * 2 - 8));
    }
    // Waffenkisten
    for (const k of view.K) {
      const [, wc, x, y, a] = k;
      const [sx, sy] = this.W2S(x, y);
      if (sx < -20 || sx > cam.w + 20) continue;
      const w = WKEYS[wc];
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(-a); ctx.drawImage(CRATE[w], -6, -5); ctx.restore();
      const ws = WSPR[w], bob = Math.round(Math.sin(view.t * 4 + k[0]) * 1.5);
      ctx.drawImage(ws.img, Math.round(sx - ws.w / 2), Math.round(sy - 10 - ws.h + bob));
      if (Math.floor(view.t * 3 + k[0]) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(sx + ws.w / 2 - 1), Math.round(sy - 11 - ws.h + bob), 1, 1); }
    }
    // Spieler (eigener zuletzt)
    const order = view.P.map((_, i) => i).filter(i => i !== meIdx);
    if (meIdx >= 0) order.push(meIdx);
    for (const i of order) this.drawPlayer(view.P[i], slots[i], i === meIdx);
    // Geschosse
    for (const r of view.R) {
      const [, kind, x, y, a] = r;
      const [sx, sy] = this.W2S(x, y);
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(-a);
      if (kind === 0) ctx.drawImage(ROCKET_SPR, -3, -2); else ctx.drawImage(WSPR.granate.img, -2, -3);
      ctx.restore();
      if (kind === 0 && Math.random() < 0.8) this.parts.push({ x: x - Math.cos(a) * 0.2, y: y - Math.sin(a) * 0.2, vx: (Math.random() - 0.5), vy: 0.5, life: 0.6, max: 0.6, col: '#c8c4cc', g: -1, size: 2, smoke: true });
      if (kind === 1 && Math.floor(view.t * 10) % 2) { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round(sx), Math.round(sy) - 3, 1, 1); }
    }
    // Leuchtspuren
    for (const t of this.tracers) {
      const [x1, y1] = this.W2S(t.x1, t.y1), [x2, y2] = this.W2S(t.x2, t.y2);
      ctx.globalAlpha = clamp(t.life / t.max * 1.4, 0, 1);
      ctx.strokeStyle = t.col; ctx.lineWidth = t.w;
      ctx.beginPath(); ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const f of this.flashes) { const [sx, sy] = this.W2S(f.x, f.y); const img = FLASH[f.big ? 1 : 0]; ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height / 2)); }
    // Partikel
    for (const p of this.parts) {
      const [sx, sy] = this.W2S(p.x, p.y);
      if (p.boom) {
        const k = 1 - p.life / p.max, r = 6 + k * 48;
        ctx.fillStyle = k < 0.3 ? '#ffffff' : k < 0.6 ? '#fff3a0' : '#ffb040';
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef5350'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), r * 0.6, 0, Math.PI * 2); ctx.globalAlpha = (1 - k) * 0.4; ctx.lineWidth = 3; ctx.strokeStyle = '#ef5350'; ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      if (p.star) { ctx.fillStyle = '#ffe680'; const X = Math.round(sx), Y = Math.round(sy); ctx.fillRect(X - 1, Y, 3, 1); ctx.fillRect(X, Y - 1, 1, 3); continue; }
      ctx.globalAlpha = p.smoke ? clamp(p.life / p.max, 0, 0.7) : 1;
      ctx.fillStyle = p.col;
      const s = p.smoke ? Math.round(p.size + (1 - p.life / p.max) * 4) : p.size;
      ctx.fillRect(Math.round(sx - s / 2), Math.round(sy - s / 2), s, s);
      ctx.globalAlpha = 1;
    }
    this.drawDecos(sim, M, 1);
    if (map.drawFront) map.drawFront(ctx, cam, view, M);
    // Hochskalieren
    const sc = this.sc;
    sc.imageSmoothingEnabled = false;
    sc.drawImage(this.lo, 0, 0, this.lo.width * this.scale, this.lo.height * this.scale);
    if (!this.noOverlay) this.overlay(sim, view, slots, meIdx);
  }
  // Namen, Lebensbalken, Fortschritt, Fadenkreuz (scharf in voller Auflösung)
  overlay(sim, view, slots, meIdx) {
    const sc = this.sc, S = this.scale, cam = this.cam, map = sim.map;
    const fs = Math.max(11, Math.round(4.2 * S));
    sc.font = `700 ${fs}px system-ui, sans-serif`;
    sc.textAlign = 'center'; sc.textBaseline = 'bottom';
    view.P.forEach((p, i) => {
      const [x, y, , , , , hp, fl] = p;
      if (!(fl & 1) || (fl & 64)) return;
      const [sx, sy] = this.W2S(x, y + 1.0);
      const X = sx * S, Y = sy * S;
      if (X < -50 || X > this.cv.width + 50 || Y < -50 || Y > this.cv.height + 50) return;
      const o = OUTFITS[slots[i].outfit];
      if (i !== meIdx) {
        sc.fillStyle = 'rgba(0,0,0,0.55)'; sc.fillText(slots[i].name, X + 1, Y - S * 2 + 1);
        sc.fillStyle = o.main; sc.fillText(slots[i].name, X, Y - S * 2);
      }
      if (hp < 100) {
        const w = S * 12, h = Math.max(3, S);
        sc.fillStyle = 'rgba(0,0,0,0.6)'; sc.fillRect(X - w / 2 - 1, Y - 1, w + 2, h + 2);
        sc.fillStyle = hp > 40 ? '#6fdc8c' : '#ef5350'; sc.fillRect(X - w / 2, Y, w * hp / 100, h);
      }
    });
    // Pfeile zu Gegnern ausserhalb des Bildes
    const me = meIdx >= 0 ? view.P[meIdx] : null;
    view.P.forEach((p, i) => {
      if (i === meIdx || !(p[7] & 1)) return;
      const [sx, sy] = this.W2S(p[0], p[1]);
      if (sx >= 0 && sx <= cam.w && sy >= 0 && sy <= cam.h) return;
      const cx = cam.w / 2, cy = cam.h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(sx, 8, cam.w - 8) * S, ey = clamp(sy, 8, cam.h - 8) * S;
      sc.save(); sc.translate(ex, ey); sc.rotate(a);
      sc.fillStyle = OUTFITS[slots[i].outfit].main; sc.strokeStyle = '#000'; sc.lineWidth = 2;
      sc.beginPath(); sc.moveTo(S * 4, 0); sc.lineTo(-S * 3, -S * 3); sc.lineTo(-S * 3, S * 3); sc.closePath(); sc.stroke(); sc.fill();
      sc.restore();
    });
    // Fortschrittsbalken
    const bw = Math.min(this.cv.width * 0.5, 520 * this.dpr), bx0 = (this.cv.width - bw) / 2, by = 18 * this.dpr + 44 * this.dpr;
    sc.fillStyle = 'rgba(0,0,0,0.5)'; sc.fillRect(bx0 - 4, by - 4, bw + 8, 8 * this.dpr + 8);
    sc.fillStyle = 'rgba(255,255,255,0.25)'; sc.fillRect(bx0, by + 3 * this.dpr, bw, 2 * this.dpr);
    sc.fillStyle = '#6fdc8c'; sc.fillRect(bx0 + bw - 3 * this.dpr, by - 2 * this.dpr, 3 * this.dpr, 12 * this.dpr);
    view.P.forEach((p, i) => {
      const prog = clamp((p[0] - map.startX) / (map.goalX - map.startX), 0, 1);
      const r = (i === meIdx ? 5 : 3.5) * this.dpr;
      sc.fillStyle = (p[7] & 1) ? OUTFITS[slots[i].outfit].main : '#777';
      sc.strokeStyle = i === meIdx ? '#fff' : '#000'; sc.lineWidth = 1.5 * this.dpr;
      sc.beginPath(); sc.arc(bx0 + prog * bw, by + 4 * this.dpr, r, 0, Math.PI * 2); sc.fill(); sc.stroke();
    });
    // Fadenkreuz
    if (this.mouse.in) {
      const X = Math.round(this.mouse.x * this.dpr), Y = Math.round(this.mouse.y * this.dpr);
      const k = Math.max(2, Math.round(S * 0.8));
      sc.drawImage(CROSS, X - 4 * k - k / 2, Y - 4 * k - k / 2, 9 * k, 9 * k);
    }
    // wenig Leben: roter Rand
    if (me && (me[7] & 1) && me[6] <= 35) {
      const a = 0.25 + 0.15 * Math.sin(performance.now() / 150);
      const gr = sc.createRadialGradient(this.cv.width / 2, this.cv.height / 2, this.cv.height * 0.3, this.cv.width / 2, this.cv.height / 2, this.cv.height * 0.8);
      gr.addColorStop(0, 'rgba(200,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${a})`);
      sc.fillStyle = gr; sc.fillRect(0, 0, this.cv.width, this.cv.height);
    }
  }
}

// ============================================================
//  Ton: alles synthetisch mit WebAudio
// ============================================================
const SFX = {
  ac: null, muted: false, master: null, noiseBuf: null, last: {},
  init() {
    if (this.ac) return;
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ac.destination);
      const n = this.ac.sampleRate * 1.5, b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    } catch (e) { this.ac = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const ac = this.ac, t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, q = 1, type = 'lowpass', delay = 0) {
    const ac = this.ac, t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  play(name, vol = 1) {
    if (!this.ac || this.muted || vol < 0.05) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'jump': this.tone('square', 220, 520, 0.09, 0.05 * v); break;
      case 's_pistole': this.noise(0.12, 0.35 * v, 2400); this.tone('square', 300, 80, 0.06, 0.08 * v); break;
      case 's_mp': this.noise(0.07, 0.25 * v, 3000); this.tone('square', 400, 120, 0.04, 0.05 * v); break;
      case 's_schrot': this.noise(0.3, 0.5 * v, 1200); this.tone('sawtooth', 150, 40, 0.2, 0.12 * v); break;
      case 's_sniper': this.noise(0.4, 0.45 * v, 4000, 0.7); this.tone('sawtooth', 900, 60, 0.3, 0.12 * v); break;
      case 's_rakete': this.noise(0.5, 0.3 * v, 800, 1, 'bandpass'); this.tone('sawtooth', 200, 600, 0.3, 0.05 * v); break;
      case 's_granate': this.tone('triangle', 500, 300, 0.1, 0.1 * v); break;
      case 'boom': this.noise(0.9, 0.7 * v, 500); this.tone('sine', 120, 30, 0.6, 0.4 * v); break;
      case 'hit': this.tone('square', 900, 400, 0.05, 0.08 * v); break;
      case 'die': this.tone('square', 500, 60, 0.45, 0.1 * v); this.noise(0.2, 0.15 * v, 1500); break;
      case 'spawn': this.tone('triangle', 400, 900, 0.2, 0.08 * v); break;
      case 'pick': this.tone('square', 600, 600, 0.06, 0.07 * v); this.tone('square', 900, 900, 0.08, 0.07 * v, 0.06); break;
      case 'crumble': this.noise(0.5, 0.25 * v, 400); break;
      case 'empty': this.tone('square', 200, 180, 0.05, 0.05 * v); break;
      case 'tick': this.tone('square', 660, 660, 0.08, 0.1 * v); break;
      case 'go': this.tone('square', 990, 990, 0.25, 0.12 * v); break;
      case 'warn': this.tone('sawtooth', 330, 330, 0.35, 0.08 * v); this.tone('sawtooth', 262, 262, 0.45, 0.08 * v, 0.35); break;
      case 'escape': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.18, 0.09, i * 0.12)); break;
    }
  },
};
