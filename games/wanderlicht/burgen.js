'use strict';
// Wanderlicht – Burgen und Schlösser: riesige Anlagen mit Mauern, Türmen, Höfen und begehbaren, eingerichteten Innenräumen

// ---------- Stile ----------
const CASTLE_STYLES = {
  abendschloss: { stone: [0.8, 0.7, 0.78], stone2: [0.64, 0.54, 0.68], roof: [0.42, 0.26, 0.58], win: [1, 0.78, 0.45], torch: [1, 0.7, 0.4], banner: [0.72, 0.2, 0.5], carpet: [0.6, 0.12, 0.3], gold: [0.95, 0.8, 0.4], wood: [0.5, 0.34, 0.24], wood2: [0.36, 0.24, 0.17], cloth: [0.7, 0.3, 0.5], halls: ['tanz', 'thron'], glass: [1, 0.7, 0.8] },
  dunkelfeste: { stone: [0.16, 0.15, 0.19], stone2: [0.1, 0.09, 0.12], roof: [0.07, 0.06, 0.09], win: [1, 0.2, 0.1], torch: [1, 0.28, 0.12], banner: [0.55, 0.05, 0.09], carpet: [0.36, 0.04, 0.07], gold: [0.72, 0.56, 0.3], wood: [0.22, 0.15, 0.12], wood2: [0.15, 0.1, 0.09], cloth: [0.4, 0.1, 0.12], halls: ['thron'], glass: [1, 0.25, 0.15] },
  mondschloss: { stone: [0.72, 0.78, 0.92], stone2: [0.56, 0.63, 0.8], roof: [0.2, 0.24, 0.5], win: [0.8, 0.92, 1], torch: [0.6, 0.8, 1], banner: [0.2, 0.3, 0.7], carpet: [0.15, 0.2, 0.5], gold: [0.85, 0.88, 1], wood: [0.4, 0.4, 0.5], wood2: [0.28, 0.28, 0.38], cloth: [0.3, 0.4, 0.8], halls: ['tanz', 'kapelle'], glass: [0.6, 0.8, 1] },
};
// Grössen der Wahrzeichen-Schlösser
const CASTLE_DIMS = {
  abendschloss: { R: 100, n: 7, wallH: 24, towerH: [52, 78], towerR: 8, keepW: 62, keepD: 46, FH: 10, FH2: 9, roofH: 36, spires: 4 },
  dunkelfeste: { R: 88, n: 8, wallH: 34, towerH: [68, 108], towerR: 8.5, keepW: 66, keepD: 52, FH: 11, FH2: 10, roofH: 44, spires: 6 },
  mondschloss: { R: 96, n: 6, wallH: 22, towerH: [54, 84], towerR: 8, keepW: 60, keepD: 46, FH: 10, FH2: 9, roofH: 38, spires: 4 },
};
function shuffled(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const BANNER_COLS = [[0.65, 0.12, 0.14], [0.14, 0.25, 0.55], [0.15, 0.4, 0.22], [0.5, 0.35, 0.1], [0.4, 0.15, 0.5], [0.12, 0.12, 0.14]];

function burgStyle(s, r) {
  const B = BIOMES[s.biome];
  const stone = pick(r, STONES).map((v, i) => Math.min(0.95, lerp(v, B.rockC[i], 0.2) * 1.7));
  const roof = pick(r, ROOFS).map(v => Math.min(1, v * 1.9 + 0.05));
  const banner = pick(r, BANNER_COLS);
  return { stone, stone2: stone.map(v => v * 0.8), roof, win: pick(r, [[1, 0.78, 0.45], [1, 0.85, 0.5], [0.85, 1, 0.6]]), torch: [1, 0.68, 0.34], banner, carpet: banner.map(v => v * 0.9), gold: [0.92, 0.76, 0.35], wood: [0.5, 0.34, 0.22], wood2: [0.34, 0.23, 0.15], cloth: banner, halls: pick(r, [['thron'], ['bankett'], ['thron'], ['kapelle'], ['tanz']]), glass: pick(r, [[1, 0.8, 0.4], [0.5, 0.8, 1], [1, 0.5, 0.5], [0.6, 1, 0.6]]) };
}

// ---------- Wand mit Öffnungen ----------
// ops: { u (Mitte entlang der Wand), w, v0, v1, kind: 'tuer' | 'fenster', glass }
function wallSeg(cb, x0, z0, x1, z1, hA, hB, th, ops, st, o = {}) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ang = -Math.atan2(dz, dx), ux = dx / L, uz = dz / L;
  const H = hB - hA, col = o.col || st.stone, mt = o.mt || MT.stone;
  const list = ops.slice().sort((a, b) => a.u - b.u);
  const piece = (u0, u1, v0, v1) => {
    if (u1 - u0 < 0.03 || v1 - v0 < 0.03) return;
    const um = (u0 + u1) / 2;
    cb.box(x0 + ux * um, hA + (v0 + v1) / 2, z0 + uz * um, u1 - u0, v1 - v0, th, ang, col, mt, 0.04);
  };
  let u = 0;
  for (const op of list) {
    const u0 = op.u - op.w / 2, u1 = op.u + op.w / 2;
    piece(u, u0, 0, H);
    piece(u0, u1, 0, op.v0);
    piece(u0, u1, op.v1, H);
    u = u1;
  }
  piece(u, L, 0, H);
  // Kollision: Türen lassen Lücken
  if (!o.noCol) {
    const r = th / 2 + 0.1;
    let p = 0;
    for (const op of list) {
      if (op.kind !== 'tuer') continue;
      const u0 = op.u - op.w / 2, u1 = op.u + op.w / 2;
      if (u0 - p > 0.05) cb.cap(x0 + ux * p, z0 + uz * p, x0 + ux * u0, z0 + uz * u0, r, hA - 0.5, hB - 0.1);
      p = u1;
    }
    if (L - p > 0.05) cb.cap(x0 + ux * p, z0 + uz * p, x1, z1, r, hA - 0.5, hB - 0.1);
  }
  // Rahmen, Türflügel und Glas
  for (const op of list) {
    const u0 = op.u - op.w / 2, u1 = op.u + op.w / 2, mx = x0 + ux * op.u, mz = z0 + uz * op.u;
    if (op.kind === 'tuer') {
      for (const e of [u0, u1]) cb.box(x0 + ux * e, hA + op.v1 / 2, z0 + uz * e, 0.35, op.v1, th + 0.3, ang, st.stone2, MT.stone, 0);
      cb.box(mx, hA + op.v1 + 0.15, mz, op.w + 0.7, 0.4, th + 0.3, ang, st.stone2, MT.stone, 0);
      if (!op.open) {
        // offene Flügeltür
        for (const sd of [-1, 1]) {
          const hx = x0 + ux * (op.u + sd * op.w / 2), hz = z0 + uz * (op.u + sd * op.w / 2);
          const nx = -uz, nz = ux;
          cb.box(hx - ux * sd * op.w * 0.22 + nx * op.w * 0.2, hA + op.v1 / 2, hz - uz * sd * op.w * 0.22 + nz * op.w * 0.2, op.w * 0.5, op.v1 - 0.1, 0.18, ang + sd * 1.1, st.wood2, MT.wood, 0);
        }
      }
    } else {
      const ww = op.w, hh = op.v1 - op.v0;
      cb.box(mx, hA + (op.v0 + op.v1) / 2, mz, ww - 0.1, hh - 0.1, 0.1, ang, op.glass || st.glass, MT.emit, 0);
      cb.box(mx, hA + (op.v0 + op.v1) / 2, mz, 0.09, hh, th * 0.5, ang, st.stone2, MT.stone, 0);
      cb.box(mx, hA + (op.v0 + op.v1) / 2, mz, ww, 0.09, th * 0.5, ang, st.stone2, MT.stone, 0);
      cb.box(mx, hA + op.v1 + 0.12, mz, ww + 0.5, 0.24, th + 0.2, ang, st.stone2, MT.stone, 0);
      cb.box(mx, hA + op.v0 - 0.1, mz, ww + 0.5, 0.2, th + 0.3, ang, st.stone2, MT.stone, 0);
      if (!o.noGlow) cb.glow(mx - uz * 0.4 * (o.glowSide || 0), hA + (op.v0 + op.v1) / 2, mz + ux * 0.4 * (o.glowSide || 0), op.glass || st.glass, 0.9);
    }
  }
}
function windowsAlong(len, gap, w, skip = []) {
  const out = [];
  const n = Math.max(1, Math.floor(len / gap));
  for (let i = 0; i < n; i++) { const u = (i + 0.5) * len / n; if (skip.some(s => Math.abs(s - u) < w * 1.6)) continue; out.push(u); }
  return out;
}

// ---------- Türme ----------
function tower(cb, lx, lz, rad, h, st, o = {}) {
  const r = cb.r;
  cb.cyl(lx, -3, lz, rad, h + 3, st.stone, MT.stone, 0.04);
  for (let q = 0; q < 3; q++) cb.cyl(lx, h * (0.22 + q * 0.24), lz, rad * 1.035, 0.55, st.stone2, MT.stone, 0.03);
  cb.cyl(lx, h - 1.5, lz, rad * 1.16, 1.5, st.stone2, MT.stone, 0.03);
  // Pfeilschlitze und Fenster
  const rows = Math.max(1, Math.floor(h / 8));
  for (let k = 1; k <= rows; k++) {
    const wy = (h - 3) * k / (rows + 0.3) + 2;
    for (let q = 0; q < 4; q++) {
      const a = q / 4 * 6.283 + k * 0.7, wx = lx + Math.cos(a) * (rad + 0.05), wz = lz + Math.sin(a) * (rad + 0.05);
      if (r() < (o.lit == null ? 0.45 : o.lit)) { cb.box(wx, wy, wz, 0.9, 2.2, 0.5, Math.PI / 2 - a, st.win, MT.emit, 0); cb.glow(wx + Math.cos(a) * 0.4, wy, wz + Math.sin(a) * 0.4, st.win, 1); }
      else cb.box(wx, wy, wz, 0.5, 1.6, 0.4, Math.PI / 2 - a, [0.03, 0.03, 0.05], MT.gen, 0);
    }
  }
  if (o.spire === false) {
    for (let q = 0; q < 14; q++) { const a = q / 14 * 6.283; cb.box(lx + Math.cos(a) * rad * 1.08, h + 0.5, lz + Math.sin(a) * rad * 1.08, 1.0, 1.2, 1.0, Math.PI / 2 - a, st.stone, MT.stone, 0.03); }
    cb.cyl(lx, h - 0.1, lz, rad * 1.1, 0.4, st.stone2, MT.stone, 0);
  } else {
    const sp = o.spireH || rad * (3.4 + r() * 1.6);
    cb.cone(lx, h, lz, rad * 1.18, sp, st.roof, MT.roof, 0.03);
    cb.cyl6(lx, h + sp - 0.3, lz, 0.1, 4.5, [0.5, 0.5, 0.55], MT.metal);
    cb.cone(lx, h + sp + 3.6, lz, 0.4, 1.2, st.gold, MT.gold);
    if (o.flag !== false) { const fc = o.flagCol || st.banner; cb.box(lx + 1.4, h + sp + 1.8, lz, 2.6, 1.4, 0.08, 0, fc, MT.cloth, 0); cb.box(lx + 1.4, h + sp + 1.8, lz, 0.9, 0.9, 0.1, 0.78, st.gold, MT.gold, 0); }
    // Erker um die Spitze
    for (let q = 0; q < 4; q++) { const a = q / 4 * 6.283 + 0.4; cb.cone(lx + Math.cos(a) * rad * 1.13, h - 0.6, lz + Math.sin(a) * rad * 1.13, 0.55, 2.4 + r() * 1.5, st.roof, MT.roof); }
  }
  cb.circ(lx, lz, rad + 0.4, -3, h + 8);
}

// ---------- Burghaus (Nebengebäude mit Raum) ----------
function outbuilding(cb, o, st, ctx) {
  const { x, z, w, d, ry, type, h } = o, r = cb.r;
  const c = Math.cos(ry), s = Math.sin(ry);
  const loc = (u, v) => [x + u * c + v * s, z - u * s + v * c];   // Gebäude-Koordinaten -> Burg-Koordinaten
  const th = 0.9;
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(p => loc(p[0], p[1]));
  // Tür auf der +v-Seite (zeigt zum Hofzentrum)
  const sides = [[0, 1, w, false], [1, 2, d, false], [2, 3, w, true], [3, 0, d, false]];
  for (const [i, j, len, front] of sides) {
    const ops = [];
    if (front) ops.push({ u: len / 2, w: 4.2, v0: 0, v1: 3.8, kind: 'tuer' });
    for (const u of windowsAlong(len, 5.5, 1.4, front ? [len / 2] : [])) ops.push({ u, w: 1.3, v0: 1.6, v1: 3.2, kind: 'fenster', glass: st.glass });
    const a = corners[i], b = corners[j];
    wallSeg(cb, a[0], a[1], b[0], b[1], 0, h, th, ops, st, { noGlow: false });
  }
  const cp = loc(0, 0);
  cb.box(cp[0], 0.03, cp[1], w - 0.6, 0.12, d - 0.6, ry, st.stone2.map(v => v * 0.9), MT.flag, 0);
  cb.box(cp[0], h + 0.15, cp[1], w + 0.6, 0.4, d + 0.6, ry, st.wood2, MT.wood, 0);
  cb.pyr(cp[0], h + 0.3, cp[1], (w + 1.8) / 2, h * 0.55 + 2.2, (d + 1.8) / 2, ry, st.roof, MT.roof);
  for (let q = 0; q < 2; q++) { const p = loc((q ? 1 : -1) * w * 0.28, -d * 0.1); cb.box(p[0], h + 3.4, p[1], 0.9, 3, 0.9, ry, st.stone2, MT.stone); }
  // Einrichtung in Gebäude-Koordinaten
  const shift = new CBShift(cb, cp[0], cp[1], ry);
  st.ceil = h - 0.6;
  const rr = { type, x0: -w / 2 + th + 0.3, x1: w / 2 - th - 0.3, z0: -d / 2 + th + 0.3, z1: d / 2 - th - 0.3, doors: [[0, d / 2 - 0.5]], h: h - 0.6, y: 0 };
  const fn = ROOM_FILL[type];
  if (fn) fn(shift, rr, st);
  ctx.rooms.push({ name: ROOM_NAMES[type] || type });
  cb.room(cp[0] - w / 2, cp[1] - d / 2, cp[0] + w / 2, cp[1] + d / 2, 0, h);
  ctx.spawnSlots.push({ x0: cp[0] - w * 0.3, x1: cp[0] + w * 0.3, z0: cp[1] - d * 0.3, z1: cp[1] + d * 0.3, y: 0 });
  return { x: cp[0], z: cp[1], w, d, ry };
}
// Hilfsklasse: leitet Bauaufrufe in ein gedrehtes, verschobenes Gebäude-Koordinatensystem um
class CBShift {
  constructor(cb, ox, oz, ry) { this.cb = cb; this.ox = ox; this.oz = oz; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); this.out = cb.out; this.r = cb.r; this.fy = 0; this.mg = cb.mg; }
  get st() { return this.cb.st; } set st(v) { this.cb.st = v; }
  get y0() { return this.cb.y0; }
  lx(x, z) { return this.ox + x * this.c + z * this.s; }
  lz(x, z) { return this.oz - x * this.s + z * this.c; }
  wx(x, z) { return this.cb.wx(this.lx(x, z), this.lz(x, z)); }
  wz(x, z) { return this.cb.wz(this.lx(x, z), this.lz(x, z)); }
  set fy2(v) { this.cb.fy = v; }
  box(x, h, z, sx, sy, sz, ry, ...rest) { this.cb.fy = this.fy; this.cb.box(this.lx(x, z), h, this.lz(x, z), sx, sy, sz, ry + this.ry, ...rest); }
  cyl(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.cyl(this.lx(x, z), h, this.lz(x, z), ...rest); }
  cyl6(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.cyl6(this.lx(x, z), h, this.lz(x, z), ...rest); }
  cone(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.cone(this.lx(x, z), h, this.lz(x, z), ...rest); }
  sph(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.sph(this.lx(x, z), h, this.lz(x, z), ...rest); }
  rock(x, h, z, sx, sy, sz, ry, col) { this.cb.fy = this.fy; this.cb.rock(this.lx(x, z), h, this.lz(x, z), sx, sy, sz, ry + this.ry, col); }
  tor(x, h, z, rad, tube, rx, ry, col, mt) { this.cb.fy = this.fy; this.cb.tor(this.lx(x, z), h, this.lz(x, z), rad, tube, rx, ry + this.ry, col, mt); }
  beam(a, b, th, col, mt) { this.cb.fy = this.fy; this.cb.beam([this.lx(a[0], a[2]), a[1], this.lz(a[0], a[2])], [this.lx(b[0], b[2]), b[1], this.lz(b[0], b[2])], th, col, mt); }
  cap(x0, z0, x1, z1, r, h0, h1) { this.cb.fy = this.fy; this.cb.cap(this.lx(x0, z0), this.lz(x0, z0), this.lx(x1, z1), this.lz(x1, z1), r, h0, h1); }
  circ(x, z, r, h0, h1) { this.cb.fy = this.fy; this.cb.circ(this.lx(x, z), this.lz(x, z), r, h0, h1); }
  boxCol(x, z, w, d, ry, h0, h1) { this.cb.fy = this.fy; this.cb.boxCol(this.lx(x, z), this.lz(x, z), w, d, ry + this.ry, h0, h1); }
  surface(x, z, hx, hz, ry, ya, yb, axis) { this.cb.fy = this.fy; this.cb.surface(this.lx(x, z), this.lz(x, z), hx, hz, ry + this.ry, ya, yb, axis); }
  tube(pts, ...rest) { this.cb.fy = this.fy; this.cb.tube(pts.map(p => [this.lx(p[0], p[2]), p[1], this.lz(p[0], p[2])]), ...rest); }
  flame(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.flame(this.lx(x, z), h, this.lz(x, z), ...rest); }
  glow(x, h, z, ...rest) { this.cb.fy = this.fy; this.cb.glow(this.lx(x, z), h, this.lz(x, z), ...rest); }
  flush() { this.cb.fy = 0; }
}

// ---------- Hauptbau: Bergfried mit begehbaren Sälen und Stockwerken ----------
function buildKeep(cb, P, st, ctx) {
  const r = cb.r, { W, D, kz, FH, FH2 } = P;
  const H = FH + FH2, tw = 1.8;
  const xL = -W / 2, xR = W / 2, zB = kz - D / 2, zF = kz + D / 2;
  const ix0 = xL + tw, ix1 = xR - tw, iz0 = zB + tw, iz1 = zF - tw;
  const hw = clamp(W * 0.2, 6.5, 14), eb = Math.min(10, D * 0.24);
  const ez0 = iz1 - eb, zm = (iz0 + ez0) / 2;
  P.hall = { x0: -hw + 0.6, x1: hw - 0.6, z0: iz0, z1: ez0 - 0.5 };
  const mat = MT.stone;

  // Sockel und Boden
  cb.box(0, -0.3, kz, W + 3, 1.0, D + 3, 0, st.stone2, MT.stone, 0.02);
  cb.box(0, 0.04, kz, W - 2 * tw, 0.14, D - 2 * tw, 0, st.stone2.map(v => v * 0.85), MT.flag, 0);
  // Wirtschaftsraum-Böden aus Holz
  for (const sd of [-1, 1]) cb.box(sd * (hw + (ix1 - hw) / 2), 0.1, (iz0 + ez0) / 2, ix1 - hw - 0.8, 0.06, ez0 - iz0 - 0.8, 0, st.wood2.map(v => v * 1.05), MT.wood, 0);

  // ---- Aussenwände ----
  // Vorderwand mit Haupttor
  const frontOps = [{ u: W / 2, w: 6.4, v0: 0, v1: 7.4, kind: 'tuer' }];
  for (const u of windowsAlong(W, 6.2, 1.6, [W / 2])) { frontOps.push({ u, w: 1.5, v0: 3.2, v1: 6.2, kind: 'fenster', glass: st.glass }); frontOps.push({ u, w: 1.5, v0: FH + 3.2, v1: FH + 6.2, kind: 'fenster', glass: st.glass }); }
  // Zweige: Wand wird getrennt für Erdgeschoss und Obergeschoss
  const exteriorWall = (ax, az, bx, bz, ops, colIdx) => {
    const g = ops.filter(o => o.v0 < FH - 0.1), u = ops.filter(o => o.v0 >= FH - 0.1).map(o => ({ ...o, v0: o.v0 - FH, v1: o.v1 - FH }));
    wallSeg(cb, ax, az, bx, bz, 0, FH, tw, g, st, { glowSide: 0 });
    wallSeg(cb, ax, az, bx, bz, FH, H, tw, u, st, { noCol: true });
    cb.cap(ax, az, bx, bz, tw / 2 + 0.2, FH - 0.5, H + 6);
  };
  // Haupttor als eigene Öffnung hoch genug: Erdgeschoss
  exteriorWall(xR, zF, xL, zF, frontOps);
  // Hinterwand: mit grossem Rosenfenster der Halle
  const backOps = [];
  for (const u of windowsAlong(W, 6.4, 1.6, [W / 2])) { backOps.push({ u, w: 1.5, v0: 3.2, v1: 6.2, kind: 'fenster', glass: st.glass }); backOps.push({ u, w: 1.5, v0: FH + 3.2, v1: FH + 6.2, kind: 'fenster', glass: st.glass }); }
  backOps.push({ u: W / 2, w: 5.2, v0: 3, v1: FH, kind: 'fenster', glass: st.glass }); backOps.push({ u: W / 2, w: 5.2, v0: FH, v1: H - 2.2, kind: 'fenster', glass: st.glass });
  exteriorWall(xL, zB, xR, zB, backOps);
  const sideOps = [];
  for (const u of windowsAlong(D, 6.4, 1.6)) { sideOps.push({ u, w: 1.5, v0: 3.2, v1: 6.2, kind: 'fenster', glass: st.glass }); sideOps.push({ u, w: 1.5, v0: FH + 3.2, v1: FH + 6.2, kind: 'fenster', glass: st.glass }); }
  exteriorWall(xL, zF, xL, zB, sideOps);
  exteriorWall(xR, zB, xR, zF, sideOps);
  // Rosenfenster-Licht und Strahlen in der Halle
  cb.glow(0, H * 0.55, iz0 + 0.8, st.glass, 3);
  // Eckstrebepfeiler und Gesimse
  for (const [x, z] of [[xL, zF], [xR, zF], [xL, zB], [xR, zB]]) { cb.box(x, H / 2, z, 3.2, H + 1, 3.2, 0, st.stone2, MT.stone, 0.02); cb.circ(x, z, 2.2, -1, H + 6); }
  cb.box(0, FH, kz, W + 0.8, 0.5, D + 0.8, 0, st.stone2, MT.stone, 0);
  cb.box(0, H + 0.2, kz, W + 1.6, 0.9, D + 1.6, 0, st.stone2, MT.stone, 0);

  // ---- Zwischenwände (Erdgeschoss, Obergeschoss) ----
  const doorW = 4.4, doorH = 4.8, wing = ix1 - hw;
  const part = (ax, az, bx, bz, doorsG, doorsU, o = {}) => {
    const g = doorsG.map(u => ({ u, w: doorW, v0: 0, v1: doorH, kind: 'tuer' }));
    wallSeg(cb, ax, az, bx, bz, 0, FH, 0.9, g, st, { col: o.col || st.stone2.map(v => v * 1.05), noGlow: true });
    if (o.upper !== false) { const u = doorsU.map(uu => ({ u: uu, w: doorW, v0: 0, v1: doorH, kind: 'tuer' })); wallSeg(cb, ax, az, bx, bz, FH, H, 0.9, u, st, { col: o.col || st.stone2.map(v => v * 1.05), noGlow: true }); }
  };
  const lenZ = ez0 - iz0;
  // Halle/Flügel: x = -hw und x = +hw, von iz0 bis ez0
  for (const sd of [-1, 1]) {
    const x = sd * hw;
    const a = sd < 0 ? [x, iz0] : [x, ez0], b = sd < 0 ? [x, ez0] : [x, iz0];
    // Türen in der Mitte beider Flügelräume (von a aus gemessen)
    const dB = sd < 0 ? [lenZ * 0.25, lenZ * 0.75] : [lenZ * 0.25, lenZ * 0.75];
    part(a[0], a[1], b[0], b[1], dB, []);
  }
  // Eingangsband / Flügel: Wand bei z = ez0 ausserhalb der Halle
  for (const sd of [-1, 1]) {
    const xa = sd < 0 ? ix0 : ix1, xb = sd < 0 ? -hw : hw;
    const c = Math.abs(xb - xa) / 2;
    part(xa, ez0, xb, ez0, [c], [c]);
  }
  // Flügelräume trennen (z = zm)
  for (const sd of [-1, 1]) { const xa = sd < 0 ? ix0 : ix1, xb = sd < 0 ? -hw : hw; const c = Math.abs(xb - xa) / 2; part(xa, zm, xb, zm, [c], [c]); }
  // Halle zum Eingangsband: grosser Durchgang (unten), oben Brüstung
  wallSeg(cb, -hw, ez0, hw, ez0, 0, FH, 0.9, [{ u: hw, w: hw * 2 - 2.6, v0: 0, v1: FH - 1.6, kind: 'tuer', open: true }], st, { col: st.stone2.map(v => v * 1.05), noGlow: true });
  cb.box(0, FH + 0.6, ez0, hw * 2, 1.2, 0.35, 0, st.stone2, MT.stone, 0);
  cb.cap(-hw + 0.8, ez0, hw - 0.8, ez0, 0.3, FH - 0.1, FH + 2.2);
  for (let i = -3; i <= 3; i++) cb.box(i * hw / 3.2, FH + 0.9, ez0, 0.3, 1.8, 0.3, 0, st.stone, MT.marble, 0);

  // ---- Decken- und Zwischenböden ----
  const slab = (x0, z0, x1, z1, y, surf = true) => {
    cb.box((x0 + x1) / 2, y - 0.35, (z0 + z1) / 2, x1 - x0, 0.7, z1 - z0, 0, st.wood2.map(v => v * 1.1), MT.wood, 0);
    // Deckenbalken unten
    for (let z = z0 + 2; z < z1 - 1; z += 3.5) cb.box((x0 + x1) / 2, y - 0.9, z, x1 - x0, 0.35, 0.4, 0, st.wood2, MT.wood, 0);
    if (surf) cb.surface((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, y, y, 'x');
  };
  for (const sd of [-1, 1]) { const xa = sd < 0 ? ix0 : hw, xb = sd < 0 ? -hw : ix1; slab(xa, iz0, xb, ez0, FH); }
  // Eingangsband: Boden mit Treppenöffnung an der Vorderseite links
  const sx0 = ix0 + 0.3, sx1 = ix0 + 9.0, sz0 = iz1 - 3.4;
  slab(ix0, ez0, ix1, sz0, FH);
  slab(sx1 - 0.6, sz0, ix1, iz1, FH);
  // Treppe
  const steps = 24, run = sx1 - sx0 - 0.4, rise = FH / steps;
  for (let i = 0; i < steps; i++) cb.box(sx0 + (i + 0.5) * run / steps, (i + 1) * rise / 2, (sz0 + iz1) / 2, run / steps + 0.02, (i + 1) * rise, iz1 - sz0 - 0.3, 0, st.stone2.map(v => v * (0.9 + (i % 2) * 0.1)), MT.flag, 0);
  cb.surface(sx0 + run / 2, (sz0 + iz1) / 2, run / 2, (iz1 - sz0) / 2 - 0.2, 0, 0, FH, 'x');
  cb.cap(sx0 + 1.8, sz0, sx1, sz0, 0.3, -0.5, FH + 2);
  cb.cap(sx1, sz0, sx1, iz1, 0.3, -0.5, FH - 0.6);
  cb.box((sx0 + sx1) / 2, FH * 0.5 + 1.2, sz0, run, 0.1, 0.1, 0, st.gold, MT.gold, 0);
  for (let i = 0; i <= 6; i++) { const t = i / 6; cb.box(sx0 + t * run, FH * t + 0.8, sz0, 0.12, 1.5, 0.12, 0, st.gold, MT.gold, 0); }
  cb.beam([sx0, 1.4, sz0], [sx0 + run, FH + 1.4, sz0], 0.12, st.gold, MT.gold);
  // Dachdecke
  cb.box(0, H + 0.2, kz, W - 2 * tw + 1, 0.8, D - 2 * tw + 1, 0, st.wood2, MT.wood, 0);
  for (let x = ix0 + 2; x < ix1 - 1; x += 3.5) cb.box(x, H - 0.4, kz, 0.5, 0.5, D - 2 * tw, 0, st.wood2, MT.wood, 0);
  cb.room(-hw, iz0, hw, ez0, 0, H);
  cb.room(ix0, ez0, ix1, iz1, 0, FH);
  cb.room(ix0, ez0, ix1, iz1, FH, H);
  for (const sd of [-1, 1]) for (const [za, zb] of [[iz0, zm], [zm, ez0]]) { const xa = sd < 0 ? ix0 : hw, xb = sd < 0 ? -hw : ix1; cb.room(xa, za, xb, zb, 0, FH); cb.room(xa, za, xb, zb, FH, H); }

  // ---- Dach ----
  const rh = P.roofH;
  cb.pyr(0, H + 0.6, kz, W / 2 + 1.8, rh, D / 2 + 1.8, 0, st.roof, MT.roof);
  // Dachfenster und Zierfirste
  for (let q = -2; q <= 2; q++) for (const sd of [-1, 1]) { const z = kz + sd * (D / 2 - 1.5 - Math.abs(q) * 0.0), x = q * W * 0.17; cb.box(x, H + 3.6, z + sd * 0.4, 2.6, 3.0, 1.6, 0, st.stone2, MT.stone, 0); cb.pyr(x, H + 5.1, z + sd * 0.4, 1.7, 2.0, 1.1, 0, st.roof, MT.roof); cb.box(x, H + 3.4, z + sd * 1.3, 1.1, 1.6, 0.1, 0, st.win, MT.emit, 0); cb.glow(x, H + 3.4, z + sd * 1.6, st.win, 1); }
  // Ecktürmchen
  const turretH = H + rh * 0.5;
  for (const [x, z] of [[xL, zF], [xR, zF], [xL, zB], [xR, zB]]) tower(cb, x, z, 3.5, turretH, st, { lit: 0.5, spireH: 14 + r() * 8 });
  // Schornsteine
  for (let q = 0; q < 3; q++) cb.box(-W * 0.3 + q * W * 0.3, H + rh * 0.3 + 2, kz - D * 0.15, 1.8, 6, 1.8, 0, st.stone2, MT.stone);
  // Rosette über dem Tor
  for (let q = 0; q < 28; q++) { const a = q / 28 * 6.283, rr = q % 2 ? 2.6 : 1.4; cb.glow(Math.cos(a) * rr, H * 0.82 + Math.sin(a) * rr, zF + 0.4, st.glass, 1.3); }
  // Banner an der Vorderseite
  for (const sd of [-1, 1]) { cb.box(sd * W * 0.32, H * 0.55, zF + 0.5, 2.4, 7, 0.08, 0, st.banner, MT.cloth, 0); cb.box(sd * W * 0.32, H * 0.55 + 1.5, zF + 0.56, 1.2, 1.2, 0.08, 0.78, st.gold, MT.gold, 0); }

  // ---- Einrichtung ----
  const r0 = shuffled(['kueche', 'waffen', 'schatz', 'kerker', 'vorrat', 'biblio'], r);
  const up = shuffled(['schlaf', 'biblio', 'alchemie', 'krieg', 'sternwarte', 'schlaf', 'kapelle'], r);
  const hallType = P.hallType;
  const hallRoom = { type: hallType, x0: -hw + 0.8, x1: hw - 0.8, z0: iz0 + 0.8, z1: ez0 - 0.8, doors: [[-hw, iz0 + lenZ * 0.25], [-hw, iz0 + lenZ * 0.75], [hw, iz0 + lenZ * 0.25], [hw, iz0 + lenZ * 0.75], [0, ez0]], h: H, y: 0 };
  furnishRoom(cb, hallRoom, st);
  ctx.rooms.push({ name: ROOM_NAMES[hallType] });
  const entry = { type: 'halle', x0: ix0 + 0.8, x1: ix1 - 0.8, z0: ez0 + 0.8, z1: iz1 - 0.8, doors: [[0, ez0], [(ix0 - hw) / 2, ez0], [(ix1 + hw) / 2, ez0], [0, iz1]], h: FH, y: 0 };
  entry.x0 += 9; furnishRoom(cb, entry, st);
  const slots = [];
  for (const sd of [-1, 1]) for (const [za, zb, k] of [[iz0, zm, 0], [zm, ez0, 1]]) {
    const xa = sd < 0 ? ix0 : hw, xb = sd < 0 ? -hw : ix1;
    slots.push({ x0: xa + 0.8, x1: xb - 0.8, z0: za + 0.8, z1: zb - 0.8, doors: [[sd < 0 ? xb + 0.8 : xa - 0.8, (za + zb) / 2], [(xa + xb) / 2, za], [(xa + xb) / 2, zb]], sd, k });
  }
  slots.forEach((sl, i) => {
    const t = r0[i % r0.length];
    const room = { ...sl, type: t, h: FH - 0.6, y: 0 };
    furnishRoom(cb, room, st);
    ctx.rooms.push({ name: ROOM_NAMES[t] });
    if (t === 'schatz') ctx.treasure = ctx.treasure || room;
    if (t === 'schatz' || t === 'waffen' || t === 'kerker') ctx.chestSlots.push(room);
    ctx.spawnSlots.push(room);
    const rt = up[i % up.length];
    const upper = { ...sl, type: rt, h: FH2 - 0.6, y: FH, doors: sl.doors };
    furnishRoom(cb, upper, st);
    if (rt === 'schlaf' || rt === 'biblio') ctx.chestSlots.push(upper);
  });
  // Galerie oben: Banner und Fackeln
  const gal = { type: 'halle', x0: ix0 + 10, x1: ix1 - 0.8, z0: ez0 + 0.8, z1: iz1 - 0.8, doors: [[0, ez0]], h: FH2 - 0.6, y: FH };
  cb.fy = FH;
  for (let x = ix0 + 12; x < ix1 - 1; x += 7) { fTorch(cb, x, iz1 - 0.3, 3, Math.PI, st); fTorch(cb, x, ez0 + 0.7, 3, 0, st); }
  for (let x = ix0 + 12; x < ix1 - 1; x += 14) fBanner(cb, x, iz1 - 0.2, 3.6, Math.PI, st, st.banner, 1.5, 4);
  fRug(cb, (ix0 + 10 + ix1) / 2, (ez0 + iz1 - 3) / 2, 4, 2.6, Math.PI / 2, st.carpet, st.gold);
  void gal;
  cb.fy = 0;
  // Fackeln an der Aussenseite des Tores
  for (const sd of [-1, 1]) fTorch(cb, sd * 5, zF + 0.4, 4.6, 0, st);
  // Eingangstüre: Stufen aussen
  cb.box(0, 0.12, zF + 1.6, 9, 0.3, 3.2, 0, st.stone2, MT.flag, 0);
  P.zF = zF; P.zB = zB; P.hw = hw; P.iz0 = iz0; P.ez0 = ez0; P.ix0 = ix0; P.ix1 = ix1; P.FH = FH; P.H = H;
  ctx.keep = { x0: xL, x1: xR, z0: zB, z1: zF };
  void mat; void wing;
}

// ---------- Die ganze Anlage ----------
function buildCastleComplex(s, siteSt, st, kind, dim) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const ga = s.lakeAng != null ? s.lakeAng : s.gateAng, rot = Math.PI / 2 - ga;
  const cx = s.x, cz = s.z, y0 = s.baseH;
  const cb = new CB(out, rot, cx, cz, y0, r);
  const R = dim.R, n = dim.n, wallH = dim.wallH, wallT = 3.2;
  const ctx = { rooms: [], chestSlots: [], spawnSlots: [], treasure: null };
  out.reach = R + 60;
  const boss = s.content === 'boss' || kind === 'dunkelfeste';
  const hallPool = boss ? ['thron'] : st.halls;
  const hallType = pick(r, hallPool);
  const apo = R * Math.cos(Math.PI / n);
  // Mauerring
  const corners = [];
  for (let k = 0; k < n; k++) { const phi = -Math.PI / n + k * 2 * Math.PI / n; corners.push([R * Math.sin(phi), R * Math.cos(phi)]); }
  const gateW = 7.2;
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
    const gate = i === 0;
    const segs = gate ? [[0, len / 2 - gateW / 2 - 0.0], [len / 2 + gateW / 2, len]] : [[0, len]];
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const sml = Math.hypot((ax + bx) / 2, (az + bz) / 2), onx = (ax + bx) / 2 / sml, onz = (az + bz) / 2 / sml;
    for (const [u0, u1] of segs) {
      const L = u1 - u0, mx = ax + ux * (u0 + u1) / 2, mz = az + uz * (u0 + u1) / 2;
      cb.box(mx, wallH / 2 - 2, mz, L + 0.1, wallH + 4, wallT, ang, st.stone, MT.stone, 0.03);
      // Zinnen und Wehrgang
      cb.box(mx - uz * wallT * 0.3, wallH + 0.2, mz + ux * wallT * 0.3, L, 0.5, wallT * 0.4, ang, st.stone2, MT.stone, 0);
      const nm = Math.floor(L / 2.6);
      for (let q = 0; q < nm; q++) { const u = u0 + (q + 0.5) * L / nm; for (const sd of [-1, 1]) cb.box(ax + ux * u + sd * (-uz) * (wallT / 2 - 0.3), wallH + 1.05, az + uz * u + sd * ux * (wallT / 2 - 0.3), 1.3, 1.3, 0.6, ang, st.stone, MT.stone, 0.02); }
      // Strebepfeiler aussen
      for (let q = 0; q < Math.floor(L / 9); q++) { const u = u0 + (q + 0.5) * L / Math.floor(L / 9); cb.box(ax + ux * u + onx * (wallT / 2 + 0.9), wallH * 0.4, az + uz * u + onz * (wallT / 2 + 0.9), 1.6, wallH * 0.8, 2.2, ang, st.stone2, MT.stone, 0.02); }
      // Schiessscharten
      for (let q = 0; q < Math.floor(L / 7); q++) { const u = u0 + (q + 0.5) * L / Math.floor(L / 7); cb.box(ax + ux * u + onx * (wallT / 2 + 0.02), wallH * 0.55, az + uz * u + onz * (wallT / 2 + 0.02), 0.35, 2.4, 0.2, ang, [0.02, 0.02, 0.03], MT.gen, 0); }
      cb.cap(ax + ux * u0, az + uz * u0, ax + ux * u1, az + uz * u1, wallT / 2 + 0.3, -1, wallH + 3);
    }
  }
  // Ecktürme
  const th2 = towerHeights(s, dim);
  for (let k = 0; k < n; k++) tower(cb, corners[k][0], corners[k][1], th2[k].rad, th2[k].h, st, { lit: 0.5 });
  // Torhaus
  {
    const gz = apo, tx = gateW / 2 + 5.2;
    for (const sd of [-1, 1]) tower(cb, sd * tx, gz + 1.5, 5.2, wallH + 14, st, { lit: 0.4, spireH: 15 });
    // Gang: Seitenmauern und Decke
    for (const sd of [-1, 1]) { cb.box(sd * (gateW / 2 + 1.2), (wallH + 4) / 2 - 2, gz, 2.4, wallH + 4, 9, 0, st.stone2, MT.stone, 0.02); cb.cap(sd * (gateW / 2 + 0.2), gz - 4.6, sd * (gateW / 2 + 0.2), gz + 4.6, 0.4, -1, wallH + 3); }
    cb.box(0, 11.4, gz, gateW + 0.4, 3, 9.4, 0, st.stone, MT.stone, 0.02);
    cb.box(0, 13.2, gz, gateW + 6, 0.8, 11, 0, st.stone2, MT.stone, 0);
    cb.box(0, wallH + 0.6, gz, gateW + 6, 3, 8.6, 0, st.stone, MT.stone, 0.02);
    for (let q = 0; q < 8; q++) cb.box(-gateW / 2 - 1.5 + q * (gateW + 3) / 7, wallH + 2.6, gz + 4.5, 1.1, 1.2, 0.8, 0, st.stone, MT.stone, 0);
    cb.pyr(0, wallH + 2.1, gz, (gateW + 6) / 2, 8, 4.6, 0, st.roof, MT.roof);
    // Fallgitter (hochgezogen) und Torflügel
    for (let q = 0; q < 9; q++) cb.box(-gateW / 2 + 0.4 + q * (gateW - 0.8) / 8, 11.2, gz + 4.2, 0.12, 2.4, 0.12, 0, [0.2, 0.2, 0.22], MT.metal, 0);
    for (let q = 0; q < 3; q++) cb.box(0, 10.4 + q * 0.8, gz + 4.2, gateW - 0.6, 0.1, 0.1, 0, [0.2, 0.2, 0.22], MT.metal, 0);
    for (const sd of [-1, 1]) cb.box(sd * (gateW / 2 + 0.1), 4.2, gz + 5.5, 0.3, 8.2, 3.4, 0.0, st.wood2, MT.wood, 0);
    for (const sd of [-1, 1]) for (const z of [gz - 3, gz + 3]) fTorch(cb, sd * (gateW / 2 - 0.3), z, 4.2, sd * Math.PI / 2 * -1, st);
    for (const sd of [-1, 1]) { cb.box(sd * (gateW / 2 + 7.5), wallH * 0.6, gz + 5, 2.6, 8, 0.08, 0, st.banner, MT.cloth, 0); }
    out.gateInfo = { gz, w: gateW };
  }
  // Hofboden
  cb.cyl(0, 0, 0, apo - 1.3, 0.12, st.stone2.map(v => v * 0.82), MT.flag, 0);
  cb.cyl(0, 0.08, 0, apo - 1.6, 0.06, st.stone2.map(v => v * 0.9), MT.flag, 0);
  // Weg vom Tor zum Bergfried
  const keepW = dim.keepW, keepD = dim.keepD, kz = -apo * 0.34;
  const KP = { W: keepW, D: keepD, kz, FH: dim.FH, FH2: dim.FH2, roofH: dim.roofH, hallType, bossHall: boss };
  cb.box(0, 0.22, (kz + keepD / 2 + apo) / 2, 6.5, 0.1, apo - kz - keepD / 2, 0, st.stone.map(v => v * 1.05), MT.flag, 0);
  for (let z = kz + keepD / 2 + 4; z < apo - 4; z += 9) for (const sd of [-1, 1]) { cb.cyl6(sd * 4.6, 0, z, 0.1, 3, [0.2, 0.17, 0.15], MT.metal); cb.flame(sd * 4.6, 3.3, z, 0.9, st.torch, true); }
  buildKeep(cb, KP, st, ctx);
  // Nebengebäude entlang der Innenmauer
  const types = shuffled(kind === 'burg' ? ['kaserne', 'stall', 'schmiede', 'vorrat', 'kueche', 'kaserne', 'stall'] : ['kaserne', 'stall', 'schmiede', 'vorrat', 'kapelle', 'stall', 'kaserne'], r);
  const nb = kind === 'burg' ? 4 : 6;
  const placed = [];
  let tries = 0;
  const ringR = apo * 0.8;
  const bw = kind === 'burg' ? 15 : 22, bd = kind === 'burg' ? 11 : 15;
  for (let k = 0; k < 60 && placed.length < nb; k++) {
    tries++;
    const a = r() * Math.PI * 2;
    const lx = Math.sin(a) * ringR, lz = Math.cos(a) * ringR;
    // Abstand zu Bergfried, Tor, Mauern und anderen
    if (Math.abs(lx) < keepW / 2 + bw / 2 + 4 && lz > kz - keepD / 2 - bd / 2 - 6 && lz < kz + keepD / 2 + bd / 2 + 6) continue;
    if (Math.abs(lx) < 12 && lz > 0) continue;
    if (Math.hypot(lx, lz) > apo - bd * 0.75 - 4) continue;
    if (placed.some(p => Math.hypot(p.x - lx, p.z - lz) < bw * 1.1)) continue;
    placed.push({ x: lx, z: lz, type: types[placed.length % types.length] });
  }
  for (const p of placed) {
    // Drehung so, dass die Gebäude-+z-Seite zum Hof zeigt: Richtung (−x, −z) in Burg-Koordinaten
    const ry = Math.atan2(-p.x, -p.z);
    const b = outbuilding(cb, { x: p.x, z: p.z, w: bw, d: bd, ry, type: p.type, h: 6.2 }, st, ctx);
    p.info = b;
  }
  // Hof: Brunnen, Übungspuppen, Stände, Fässer, Fässer, Fahnen
  const wellZ = (apo + kz + keepD / 2) / 2 + 2, wellX = -11;
  cb.cyl(wellX, 0, wellZ, 2.2, 1.2, st.stone2, MT.stone, 0.02); cb.cyl(wellX, 0.9, wellZ, 1.7, 0.2, [0.2, 0.55, 0.8], MT.emit, 0);
  for (const sd of [-1, 1]) cb.box(wellX + sd * 1.9, 2.4, wellZ, 0.3, 3.6, 0.3, 0, st.wood2, MT.wood, 0);
  cb.box(wellX, 4.4, wellZ, 5, 0.3, 0.3, 0, st.wood2, MT.wood, 0); cb.pyr(wellX, 4.2, wellZ, 3.2, 1.8, 2.4, 0, st.roof, MT.roof);
  cb.circ(wellX, wellZ, 2.4, -1, 5);
  out.interact.push({ kind: 'rest', x: cb.wx(wellX, wellZ + 3.2), z: cb.wz(wellX, wellZ + 3.2), r: 3, label: 'Am Brunnen rasten' });
  cb.glow(wellX, 1.2, wellZ, [0.5, 0.8, 1], 2);
  for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = apo * (0.35 + r() * 0.2); const lx = Math.cos(a) * d, lz = Math.sin(a) * d * 0.7 + 4; if (Math.abs(lx) < keepW * 0.7 && lz < kz + keepD) continue; if (Math.abs(lx) < 10) continue; cb.cyl6(lx, 0, lz, 0.1, 2.0, st.wood2, MT.wood); cb.box(lx, 1.7, lz, 1.4, 0.2, 0.2, 0, st.wood2, MT.wood, 0); cb.sph(lx, 2.2, lz, 0.28, 0.3, 0.28, [0.75, 0.6, 0.35], MT.cloth); cb.circ(lx, lz, 0.5, -1, 2.4); }
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = apo * (0.4 + r() * 0.3); const lx = Math.cos(a) * d, lz = Math.sin(a) * d; if (Math.abs(lx) < 12 && lz > 0) continue; if (placed.some(p => Math.hypot(p.x - lx, p.z - lz) < bw * 0.7)) continue; if (Math.abs(lx) < keepW * 0.62 && lz > kz - keepD && lz < kz + keepD) continue; fBarrelOut(cb, lx, lz, st, r); }
  // Garten
  if (kind !== 'burg' && kind !== 'dunkelfeste') {
    const B = BIOMES[s.biome];
    const tree = kind === 'abendschloss' ? { tree: 'kirsch', trunkC: [0.3, 0.2, 0.25], canopyC: [[0.85, 0.55, 0.9], [0.6, 0.38, 0.72], [1, 0.82, 0.95]] } : { tree: 'weide', trunkC: [0.25, 0.27, 0.35], canopyC: [[0.7, 0.8, 1], [0.45, 0.52, 0.75], [0.92, 0.95, 1]] };
    for (let k = 0; k < 9; k++) {
      const a = r() * 6.28, d = apo * (0.45 + r() * 0.35), lx = Math.cos(a) * d, lz = Math.sin(a) * d;
      if (Math.abs(lx) < keepW * 0.7 && lz > kz - keepD && lz < kz + keepD + 6) continue;
      if (Math.abs(lx) < 14 && lz > 0) continue;
      if (placed.some(p => Math.hypot(p.x - lx, p.z - lz) < bw)) continue;
      const wx = cb.wx(lx, lz), wz = cb.wz(lx, lz);
      buildTree(tree, wx, y0, wz, r, cb.mg, cb.ls);
      out.colliders.push({ seg: false, x: wx, z: wz, r: 0.8, y0: y0 - 1, y1: y0 + 8 });
    }
    void B;
  }
  // Kisten, Wächter und Beute
  populateCastle(s, siteSt, st, out, cb, ctx, KP, kind, boss, r, apo);
  // Meshes
  const mat = kind === 'burg' ? MAT.flat : MAT.landmark;
  for (const g of cb.mg.buildBuckets(36)) { const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; out.group.add(m); }
  if (!cb.gl.empty) out.group.add(new THREE.Points(cb.gl.build(), MAT.landGlow));
  if (!cb.fl.empty) out.group.add(new THREE.Points(cb.fl.build(), MAT.flame));
  if (!cb.ls.empty) out.group.add(leafObj(cb.ls));
  out.updaters.push(dt => updateChests(out, dt));
  out.castle = { cb, KP, apo, ctx, rot };
  return out;
}
function fBarrelOut(cb, lx, lz, st, r) { if (r() < 0.5) fBarrel(cb, lx, lz, st); else fCrate(cb, lx, lz, 0.9 + r() * 0.4, r() * 3, st); }

function populateCastle(s, siteSt, st, out, cb, ctx, KP, kind, boss, r, apo) {
  const stOp = { opened: S.opened, cleared: S.cleared };
  // Truhen in Räumen
  const slots = shuffled(ctx.chestSlots, r);
  const nCh = kind === 'burg' ? 2 : 3;
  for (let k = 0; k < Math.min(nCh, slots.length); k++) {
    const sl = slots[k], key = s.key + ':c' + k;
    const lx = sl.chestSpot ? sl.chestSpot[0] : (sl.x0 + sl.x1) / 2, lz = sl.chestSpot ? sl.chestSpot[1] : sl.z1 - 1.0;
    const ry = sl.chestSpot ? 0 : Math.PI;
    cb.fy = sl.y || 0;
    makeChest(out, key, cb.wx(lx, lz), cb.wz(lx, lz), cb.rot + ry, false, !!stOp.opened[key], false);
    const c = out.chests[out.chests.length - 1];
    c.y = cb.y0 + cb.fy; c.lid.parent.position.y = c.y;
    cb.fy = 0;
  }
  // Bosstruhe hinter dem Thron
  const hall = KP.hall;
  if (boss) {
    const key = s.key + ':boss';
    const lx = 0, lz = hall.z0 + 1.4;
    makeChest(out, key, cb.wx(lx, lz + 3.8), cb.wz(lx, lz + 3.8), cb.rot + Math.PI, true, !!stOp.opened[key], !stOp.cleared[s.key]);
  }
  // Bewohner
  if (!stOp.cleared[s.key]) {
    const B = BIOMES[s.biome];
    const types = kind === 'dunkelfeste' ? ['ritter', 'schatten', 'waechter'] : s.biome === 3 || s.biome === 0 ? ['ritter', 'schatten', 'waechter'] : ['waechter', 'ritter', 'dornling', 'schatten'];
    const sp = (lx, lz, type, bossFlag, name) => out.spawns.push({ type, x: cb.wx(lx, lz), z: cb.wz(lx, lz), boss: !!bossFlag, name });
    void B;
    if (boss) {
      const bt = pick(r, types);
      sp(0, hall.z0 + 7, bt, true, pick(r, BOSS_TITLES[bt]));
      const n = kind === 'burg' ? 2 + Math.floor(r() * 2) : 5;
      for (let k = 0; k < n; k++) sp((r() - 0.5) * (hall.x1 - hall.x0) * 0.7, hall.z0 + 10 + r() * (hall.z1 - hall.z0 - 14), pick(r, kind === 'dunkelfeste' ? ['ritter', 'schatten'] : types), false);
      for (let k = 0; k < (kind === 'burg' ? 2 : 4); k++) { const a = r() * 6.28; sp(Math.cos(a) * apo * 0.5, Math.sin(a) * apo * 0.4 + 6, pick(r, types), false); }
    } else if (s.content === 'wachen') {
      const cnt = 4 + Math.floor(r() * 4);
      const rooms = ctx.spawnSlots.length ? ctx.spawnSlots : [];
      for (let k = 0; k < cnt; k++) {
        if (k % 2 === 0 || !rooms.length) { const a = r() * 6.28; sp(Math.cos(a) * apo * 0.45, Math.sin(a) * apo * 0.35 + 8, pick(r, types), false); }
        else if (k % 3 === 0) sp((r() - 0.5) * (hall.x1 - hall.x0) * 0.6, hall.z0 + 6 + r() * (hall.z1 - hall.z0 - 8), pick(r, types), false);
        else { const rm = rooms[k % rooms.length]; sp((rm.x0 + rm.x1) / 2, (rm.z0 + rm.z1) / 2, pick(r, types), false); }
      }
    }
  }
  void st;
}

function towerHeights(s, dim) {
  const rr = mulberry32(s.seed ^ 0x1234), out = [];
  for (let k = 0; k < dim.n; k++) out.push({ h: dim.towerH[0] + rr() * (dim.towerH[1] - dim.towerH[0]), rad: dim.towerR * (0.9 + rr() * 0.25) });
  return out;
}
// Normale Burgen
function buildCastle(s, st) {
  const r = mulberry32(s.seed ^ 0x77);
  const sty = burgStyle(s, r);
  const R = s.radius, wallH = 13 + r() * 4;
  const dim = { R, n: 6 + Math.floor(r() * 3), wallH, towerH: [wallH + 14, wallH + 30], towerR: 5.5 + r() * 1.6, keepW: clamp(R * 0.62, 32, 46), keepD: clamp(R * 0.5, 26, 36), FH: 7.5, FH2: 6.5, roofH: 18 + r() * 6 };
  const out = buildCastleComplex(s, st, sty, 'burg', dim);
  return out;
}
