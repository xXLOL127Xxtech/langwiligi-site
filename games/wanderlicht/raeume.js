'use strict';
// Wanderlicht – Räume: Möbel, Fackeln und Einrichtung für Burgen und Schlösser

const LORE = [
  'Das Buch erzählt von einem König, der jeden Abend eine Laterne in den Himmel schickte, damit sein Volk den Heimweg fand.',
  'Eine vergilbte Seite: „Wer die Stille fürchtet, hat nie ihr Lied gehört.“',
  'Ein Rezept für Sternensuppe. Zutaten: ein Löffel Mondlicht, drei Prisen Wind und viel Geduld.',
  'Die Chronik nennt die Schatten „Kinder der Nacht, die den Weg zum Feuer nicht fanden“.',
  'In den Rand gekritzelt: „Der Wächter im Berg schläft nur, solange man ihm nichts schuldet.“',
  'Eine Karte der Sternbilder. Eines ist mit roter Tinte eingekreist: das Bild eines Besens.',
  'Das Tagebuch einer Köchin: „Heute hat der Hofnarr den Pudding gestohlen. Das Schloss bebte vor Lachen.“',
  'Ein Brief, nie abgeschickt: „Ich warte noch immer am Tor. Der Frühling kommt, und mit ihm vielleicht auch du.“',
];

// ---------- Bauhelfer in Burg-Koordinaten (x nach rechts, z zum Tor) ----------
class CB {
  constructor(out, rot, cx, cz, y0, rnd) {
    this.out = out; this.rot = rot; this.c = Math.cos(rot); this.s = Math.sin(rot);
    this.cx = cx; this.cz = cz; this.y0 = y0; this.fy = 0; this.r = rnd;
    this.mg = new Merger(); this.gl = new PointSet(); this.fl = new PointSet(); this.ls = new LeafSet(); this.rays = [];
    out.surfaces = out.surfaces || []; out.rooms = out.rooms || [];
  }
  wx(lx, lz) { return this.cx + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.cz - lx * this.s + lz * this.c; }
  box(lx, h, lz, sx, sy, sz, ry, col, mt = MT.stone, jit = 0.05) { this.mg.add('box', M(this.wx(lx, lz), this.y0 + this.fy + h, this.wz(lx, lz), sx, sy, sz, 0, ry + this.rot, 0), col, jit, this.r, mt); }
  cyl(lx, h0, lz, rad, hgt, col, mt = MT.stone, jit = 0.04) { this.mg.add('cyl', M(this.wx(lx, lz), this.y0 + this.fy + h0, this.wz(lx, lz), rad, hgt, rad, 0, this.rot, 0), col, jit, this.r, mt); }
  cyl6(lx, h0, lz, rad, hgt, col, mt = MT.stone) { this.mg.add('cyl6', M(this.wx(lx, lz), this.y0 + this.fy + h0, this.wz(lx, lz), rad, hgt, rad, 0, this.rot, 0), col, 0, this.r, mt); }
  cone(lx, h0, lz, rad, hgt, col, mt = MT.roof, jit = 0.05) { this.mg.add('cone', M(this.wx(lx, lz), this.y0 + this.fy + h0, this.wz(lx, lz), rad, hgt, rad, 0, this.rot, 0), col, jit, this.r, mt); }
  pyr(lx, h0, lz, sx, hgt, sz, ry, col, mt = MT.roof) { this.mg.add('cone4', M(this.wx(lx, lz), this.y0 + this.fy + h0, this.wz(lx, lz), sx * 1.4142, hgt, sz * 1.4142, 0, ry + this.rot + Math.PI / 4, 0), col, 0.04, this.r, mt); }
  sph(lx, h, lz, sx, sy, sz, col, mt = MT.gen) { this.mg.add('sph', M(this.wx(lx, lz), this.y0 + this.fy + h, this.wz(lx, lz), sx, sy, sz, 0, this.rot, 0), col, 0, this.r, mt); }
  rock(lx, h, lz, sx, sy, sz, ry, col) { this.mg.add('rock', M(this.wx(lx, lz), this.y0 + this.fy + h, this.wz(lx, lz), sx, sy, sz, 0, ry + this.rot, 0), col, 0.1, this.r, MT.stone); }
  tor(lx, h, lz, rad, tube, rx, ry, col, mt = MT.metal) { this.mg.add('torus', M(this.wx(lx, lz), this.y0 + this.fy + h, this.wz(lx, lz), rad, rad, rad * (tube / 0.12), rx, ry + this.rot, 0), col, 0, this.r, mt); }
  // Röhre durch lokale Punkte [lx, h, lz]
  tube(pts, rads, col, seg = 10, mt = MT.stone, col2 = null) {
    tube(this.mg, pts.map(p => [this.wx(p[0], p[2]), this.y0 + this.fy + p[1], this.wz(p[0], p[2])]), rads, col, seg, mt, col2, this.r);
  }
  // Balken schräg von a nach b (lokale Koordinaten, h = Höhe über y0)
  beam(a, b, th, col, mt = MT.wood) {
    const ax = this.wx(a[0], a[2]), az = this.wz(a[0], a[2]), bx = this.wx(b[0], b[2]), bz = this.wz(b[0], b[2]);
    const dx = bx - ax, dy = b[1] - a[1], dz = bz - az, len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return;
    const yaw = Math.atan2(dx, dz), pitch = -Math.asin(dy / len);
    _e.set(pitch, yaw, 0, 'YXZ'); _q.setFromEuler(_e);
    this.mg.add('box', _m4.compose(_v.set((ax + bx) / 2, this.y0 + this.fy + (a[1] + b[1]) / 2, (az + bz) / 2), _q, _s.set(th, th, len)), col, 0.03, this.r, mt);
  }
  // Kollision (Kapsel von a nach b mit Radius r) und Höhenbereich relativ zu y0
  cap(lx0, lz0, lx1, lz1, r, h0 = -1, h1 = 40) { this.out.colliders.push({ seg: true, ax: this.wx(lx0, lz0), az: this.wz(lx0, lz0), bx: this.wx(lx1, lz1), bz: this.wz(lx1, lz1), r, y0: this.y0 + this.fy + h0, y1: this.y0 + h1 }); }
  circ(lx, lz, r, h0 = -1, h1 = 40) { this.out.colliders.push({ seg: false, x: this.wx(lx, lz), z: this.wz(lx, lz), r, y0: this.y0 + this.fy + h0, y1: this.y1 !== undefined ? this.y1 : this.y0 + h1 }); }
  boxCol(lx, lz, w, d, ry, h0 = -1, h1 = 3) {
    const along = w >= d, len = along ? w : d, r = (along ? d : w) / 2, c = Math.cos(ry), s = Math.sin(ry);
    const ux = (along ? 1 : 0), uz = (along ? 0 : 1), hl = Math.max(0, len / 2 - r);
    const dx = (ux * c + uz * s) * hl, dz = (-ux * s + uz * c) * hl;
    this.cap(lx - dx, lz - dz, lx + dx, lz + dz, r, h0, h1);
  }
  // Begehbare Fläche (Boden, Rampe): Mitte, halbe Masse, Drehung, Höhe am Anfang/Ende entlang der lokalen x-Achse (axis 'x') oder z-Achse
  surface(lx, lz, hx, hz, ry, ya, yb, axis = 'x') {
    const a = ry + this.rot;
    this.out.surfaces.push({ x: this.wx(lx, lz), z: this.wz(lx, lz), hx, hz, c: Math.cos(a), s: Math.sin(a), ya: this.y0 + this.fy + ya, yb: this.y0 + this.fy + yb, axis });
  }
  room(lx0, lz0, lx1, lz1, hFloor, hCeil) {
    this.out.rooms.push({ lx0, lz0, lx1, lz1, c: this.c, s: this.s, cx: this.cx, cz: this.cz, yf: this.y0 + hFloor, yc: this.y0 + hCeil });
  }
  // Flamme (leuchtet, flackert, beleuchtet nah ein paar Lichter)
  flame(lx, h, lz, size = 0.5, col = [1, 0.62, 0.28], light = true) {
    const x = this.wx(lx, lz), z = this.wz(lx, lz), y = this.y0 + this.fy + h;
    this.mg.add('cone', M(x, y - 0.04 * size, z, 0.07 * size, 0.22 * size, 0.07 * size), [1, 0.75, 0.3], 0, this.r, MT.emit);
    this.fl.add(x, y + 0.1 * size, z, col, 1);
    if (light) this.out.fires.push({ x, y: y + 0.2, z, size, col: new THREE.Color(col[0], col[1], col[2]), sparkT: 99 });
  }
  glow(lx, h, lz, col, f = 1) { this.gl.add(this.wx(lx, lz), this.y0 + this.fy + h, this.wz(lx, lz), col, f); }
  window(lx, h, lz, w, hh, ry, col) {
    // Leuchtendes Fenster mit Rahmen (ry = Richtung der Wand)
    this.box(lx, h, lz, w, hh, 0.12, ry, col, MT.emit, 0);
    this.box(lx, h, lz, w + 0.3, 0.14, 0.3, ry, this.st.stone2, MT.stone, 0);
    this.box(lx, h - hh / 2, lz, w + 0.4, 0.2, 0.4, ry, this.st.stone2, MT.stone, 0);
    this.box(lx, h, lz, 0.1, hh, 0.2, ry, this.st.stone2, MT.stone, 0);
  }
}

// ---------- Einzelne Möbel ----------
function fTable(cb, lx, lz, len, wid, ry, st, items = true, h = 1.0) {
  const r = cb.r, c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, h, lz, len, 0.12, wid, ry, st.wood, MT.wood);
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cb.box(lx + (u * (len / 2 - 0.2)) * c + (v * (wid / 2 - 0.2)) * s, h / 2, lz - (u * (len / 2 - 0.2)) * s + (v * (wid / 2 - 0.2)) * c, 0.16, h, 0.16, ry, st.wood2, MT.wood, 0);
  cb.boxCol(lx, lz, len, wid, ry, -1, h + 0.3);
  if (items) {
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 1.5, px = lx + u * c, pz = lz - u * s;
      for (const sd of [-1, 1]) {
        const ox = px + sd * (wid / 2 - 0.35) * s, oz = pz + sd * (wid / 2 - 0.35) * c;
        cb.cyl(ox, h + 0.06, oz, 0.19, 0.03, [0.85, 0.85, 0.82], MT.metal, 0);
        if (r() < 0.8) cb.cyl6(ox + 0.25 * s * sd, h + 0.06, oz + 0.25 * c * sd, 0.05, 0.16, st.gold, MT.gold);
      }
      const k = r();
      if (k < 0.3) cb.sph(px, h + 0.22, pz, 0.28, 0.16, 0.2, [0.7, 0.42, 0.2], MT.gen);
      else if (k < 0.5) cb.sph(px, h + 0.2, pz, 0.12, 0.12, 0.12, [0.85, 0.2, 0.15], MT.gen);
      else if (k < 0.7) cb.box(px, h + 0.14, pz, 0.3, 0.1, 0.22, ry, [0.9, 0.75, 0.4], MT.gen, 0);
    }
    for (let i = 0; i < Math.max(1, Math.floor(len / 5)); i++) { const u = (i - (Math.floor(len / 5) - 1) / 2) * 4.2; cb.cyl6(lx + u * c, h + 0.06, lz - u * s, 0.04, 0.3, [0.95, 0.9, 0.8], MT.plaster); cb.flame(lx + u * c, h + 0.4, lz - u * s, 0.35, [1, 0.8, 0.45], false); }
  }
}
function fBench(cb, lx, lz, len, ry, st) {
  const c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, 0.55, lz, len, 0.1, 0.42, ry, st.wood2, MT.wood);
  for (const u of [-1, 1]) cb.box(lx + u * (len / 2 - 0.2) * c, 0.27, lz - u * (len / 2 - 0.2) * s, 0.1, 0.54, 0.38, ry, st.wood2, MT.wood, 0);
  cb.boxCol(lx, lz, len, 0.42, ry, -1, 0.7);
}
function fChair(cb, lx, lz, ry, st, grand = false) {
  const c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, 0.5, lz, 0.55, 0.08, 0.55, ry, st.wood2, MT.wood);
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cb.box(lx + (u * 0.23) * c + (v * 0.23) * s, 0.25, lz - (u * 0.23) * s + (v * 0.23) * c, 0.07, 0.5, 0.07, ry, st.wood2, MT.wood, 0);
  cb.box(lx - 0.27 * s, grand ? 1.1 : 0.9, lz - 0.27 * c, 0.55, grand ? 1.2 : 0.8, 0.07, ry, st.wood2, MT.wood);
  cb.circ(lx, lz, 0.35, -1, 1.2);
}
function fBarrel(cb, lx, lz, st, sc = 1) {
  cb.cyl(lx, 0, lz, 0.42 * sc, 0.95 * sc, st.wood2, MT.wood, 0.05);
  cb.tor(lx, 0.25 * sc, lz, 0.43 * sc, 0.06, Math.PI / 2, 0, [0.25, 0.22, 0.2]);
  cb.tor(lx, 0.7 * sc, lz, 0.43 * sc, 0.06, Math.PI / 2, 0, [0.25, 0.22, 0.2]);
  cb.circ(lx, lz, 0.45 * sc, -1, 1.1);
}
function fCrate(cb, lx, lz, sz, ry, st) { cb.box(lx, sz / 2, lz, sz, sz, sz, ry, st.wood, MT.wood); cb.circ(lx, lz, sz * 0.7, -1, sz + 0.1); }
function fCandelabrum(cb, lx, lz, h, st, n = 3) {
  cb.cyl6(lx, 0, lz, 0.07, h, st.gold, MT.gold);
  cb.cyl(lx, 0, lz, 0.22, 0.08, st.gold, MT.gold);
  for (let i = 0; i < n; i++) { const a = (i / n - 0.5) * 2.2; cb.cyl6(lx + Math.sin(a) * 0.3, h - 0.1 + Math.abs(a) * 0.1, lz, 0.025, 0.2, [0.95, 0.92, 0.82], MT.plaster); cb.flame(lx + Math.sin(a) * 0.3, h + 0.2 + Math.abs(a) * 0.1, lz, 0.3, [1, 0.8, 0.45], i === 0); }
  cb.circ(lx, lz, 0.25, -1, h);
}
function fBrazier(cb, lx, lz, st, h = 1.1) {
  cb.cyl6(lx, 0, lz, 0.06, h, [0.15, 0.13, 0.13], MT.metal);
  cb.cyl(lx, h, lz, 0.4, 0.22, [0.2, 0.17, 0.16], MT.metal);
  for (let i = 0; i < 3; i++) cb.beam([lx, 0, lz], [lx + Math.cos(i * 2.1) * 0.35, h * 0.5, lz + Math.sin(i * 2.1) * 0.35], 0.05, [0.15, 0.13, 0.13], MT.metal);
  cb.flame(lx, h + 0.35, lz, 1.2, st.torch, true);
  cb.flame(lx + 0.12, h + 0.3, lz + 0.05, 0.8, [1, 0.5, 0.2], false);
  cb.circ(lx, lz, 0.45, -1, h + 0.3);
}
function fTorch(cb, lx, lz, h, ry, st) {
  const c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, h - 0.15, lz, 0.1, 0.5, 0.1, ry, [0.2, 0.15, 0.12], MT.wood, 0);
  cb.cyl(lx + s * 0.1, h + 0.12, lz + c * 0.1, 0.11, 0.1, [0.2, 0.18, 0.18], MT.metal, 0);
  cb.flame(lx + s * 0.1, h + 0.24, lz + c * 0.1, 0.7, st.torch, true);
}
function fBanner(cb, lx, lz, h, ry, st, col, w = 1.3, len = 3.2) {
  cb.box(lx, h + len / 2 + 0.15, lz, w + 0.5, 0.08, 0.1, ry, st.gold, MT.gold, 0);
  cb.box(lx, h, lz, w, len, 0.04, ry, col, MT.cloth, 0.03);
  cb.box(lx, h + 0.4, lz, w * 0.45, w * 0.45, 0.06, ry + 0.78, st.gold, MT.gold, 0);
  for (let i = -1; i <= 1; i++) cb.box(lx + i * w * 0.3 * Math.cos(ry), h - len / 2 - 0.12, lz - i * w * 0.3 * Math.sin(ry), 0.2, 0.3, 0.05, ry, st.gold, MT.cloth, 0);
}
function fRug(cb, lx, lz, w, d, ry, col, border) {
  cb.box(lx, 0.05, lz, w, 0.04, d, ry, border, MT.cloth, 0);
  cb.box(lx, 0.07, lz, w - 0.5, 0.04, d - 0.5, ry, col, MT.cloth, 0.03);
  cb.box(lx, 0.09, lz, w - 1.2, 0.03, d - 1.2, ry, border.map(v => v * 0.9), MT.cloth, 0);
}
function fChandelier(cb, lx, lz, h, rad, st, up = 2.5) {
  cb.tor(lx, h, lz, rad, 0.06, Math.PI / 2, 0, [0.2, 0.17, 0.15]);
  cb.tor(lx, h - 0.1, lz, rad * 0.6, 0.05, Math.PI / 2, 0, st.gold, MT.gold);
  for (let i = 0; i < 3; i++) cb.beam([lx, h + up, lz], [lx + Math.cos(i * 2.09) * rad, h, lz + Math.sin(i * 2.09) * rad], 0.03, [0.2, 0.17, 0.15], MT.metal);
  cb.cyl6(lx, h + up, lz, 0.03, 0.4, [0.2, 0.17, 0.15], MT.metal);
  const n = 8;
  for (let i = 0; i < n; i++) { const a = i / n * 6.28; cb.cyl6(lx + Math.cos(a) * rad, h, lz + Math.sin(a) * rad, 0.035, 0.22, [0.95, 0.9, 0.78], MT.plaster); cb.flame(lx + Math.cos(a) * rad, h + 0.32, lz + Math.sin(a) * rad, 0.4, [1, 0.82, 0.5], i === 0); }
}
function fPillar(cb, lx, lz, h, rad, st) {
  cb.cyl(lx, 0, lz, rad, h, st.stone, MT.marble);
  cb.cyl(lx, 0, lz, rad * 1.3, 0.5, st.stone2, MT.stone);
  cb.cyl(lx, h - 0.4, lz, rad * 1.3, 0.4, st.stone2, MT.stone);
  cb.box(lx, h + 0.1, lz, rad * 3, 0.3, rad * 3, 0, st.stone2, MT.stone, 0);
  cb.circ(lx, lz, rad * 1.1, -1, h);
}
function fFireplace(cb, lx, lz, ry, w, st, hall) {
  const c = Math.cos(ry), s = Math.sin(ry);
  // Öffnung zeigt nach +z' (lokal), d.h. in Richtung ry
  cb.box(lx - 0.4 * s, 1.9, lz - 0.4 * c, w, 3.8, 0.8, ry, st.stone2, MT.stone);
  cb.box(lx + 0.05 * s, 1.0, lz + 0.05 * c, w * 0.62, 2.0, 0.6, ry, [0.04, 0.03, 0.03], MT.gen, 0);
  cb.box(lx + 0.15 * s, 2.15, lz + 0.15 * c, w + 0.5, 0.25, 0.9, ry, st.stone, MT.stone, 0);
  cb.box(lx + 0.05 * s, 0.1, lz + 0.05 * c, w * 0.6, 0.15, 0.55, ry, [0.2, 0.2, 0.2], MT.stone, 0);
  for (let i = 0; i < 3; i++) cb.box(lx + (i - 1) * 0.3 * c + 0.1 * s, 0.35, lz - (i - 1) * 0.3 * s + 0.1 * c, 0.9, 0.18, 0.18, ry + i * 0.4, [0.2, 0.12, 0.08], MT.wood, 0);
  cb.flame(lx + 0.1 * s, 0.6, lz + 0.1 * c, 2.2, [1, 0.55, 0.2], true);
  cb.flame(lx + 0.3 * s + 0.2 * c, 0.5, lz + 0.3 * c - 0.2 * s, 1.5, [1, 0.45, 0.15], false);
  cb.flame(lx + 0.3 * s - 0.2 * c, 0.5, lz + 0.3 * c + 0.2 * s, 1.4, [1, 0.6, 0.2], false);
  cb.cap(lx - 0.2 * s - 0.5 * c, lz - 0.2 * c + 0.5 * s, lx - 0.2 * s + 0.5 * c, lz - 0.2 * c - 0.5 * s, 0.7, -1, 4);
  if (hall) cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'fire', x: cb.wx(lx + 1.3 * s, lz + 1.3 * c), z: cb.wz(lx + 1.3 * s, lz + 1.3 * c), r: 2.6 });
}
function fBookshelf(cb, lx, lz, w, h, ry, st) {
  const c = Math.cos(ry), s = Math.sin(ry), r = cb.r;
  cb.box(lx, h / 2, lz, w, h, 0.6, ry, st.wood2, MT.wood);
  const rows = Math.floor(h / 0.55);
  for (let k = 0; k < rows; k++) {
    const y = 0.35 + k * 0.52;
    cb.box(lx + 0.18 * s, y - 0.28, lz + 0.18 * c, w - 0.1, 0.05, 0.5, ry, st.wood, MT.wood, 0);
    let u = -w / 2 + 0.2;
    while (u < w / 2 - 0.25) {
      const bw = 0.07 + r() * 0.1, bh = 0.32 + r() * 0.15;
      const col = pick(r, [[0.5, 0.15, 0.15], [0.15, 0.3, 0.5], [0.2, 0.4, 0.25], [0.55, 0.4, 0.15], [0.35, 0.2, 0.45], [0.7, 0.65, 0.5]]);
      cb.box(lx + u * c + 0.2 * s, y - 0.28 + bh / 2 + 0.03, lz - u * s + 0.2 * c, bw, bh, 0.28, ry, col, MT.cloth, 0.1);
      u += bw + 0.01;
    }
  }
  cb.boxCol(lx, lz, w, 0.6, ry, -1, h);
}
function fBed(cb, lx, lz, ry, st, col) {
  const c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, 0.4, lz, 2.0, 0.3, 2.9, ry, st.wood2, MT.wood);
  cb.box(lx, 0.62, lz, 1.85, 0.25, 2.7, ry, [0.9, 0.88, 0.82], MT.cloth);
  cb.box(lx + 0.4 * s, 0.78, lz + 0.4 * c, 1.9, 0.12, 2.0, ry, col, MT.cloth);
  cb.box(lx - 1.0 * s, 0.9, lz - 1.0 * c, 1.5, 0.22, 0.5, ry, [0.95, 0.93, 0.9], MT.cloth);
  cb.box(lx - 1.45 * s, 1.2, lz - 1.45 * c, 2.0, 1.6, 0.14, ry, st.wood2, MT.wood);
  for (const [u, v] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cb.box(lx + u * 0.95 * c + v * 1.4 * s, 1.6, lz - u * 0.95 * s + v * 1.4 * c, 0.1, 3.2, 0.1, ry, st.wood2, MT.wood, 0);
  cb.box(lx, 3.2, lz, 2.1, 0.1, 3.0, ry, col, MT.cloth, 0);
  cb.boxCol(lx, lz, 2.0, 2.9, ry, -1, 1.2);
}
function fCauldron(cb, lx, lz, col, size = 1) {
  cb.sph(lx, 0.7 * size, lz, 0.6 * size, 0.5 * size, 0.6 * size, [0.1, 0.1, 0.12], MT.metal);
  cb.cyl(lx, 1.0 * size, lz, 0.5 * size, 0.04, col, MT.emit);
  for (let i = 0; i < 3; i++) cb.beam([lx, 0, lz], [lx + Math.cos(i * 2.09) * 0.5 * size, 0.4 * size, lz + Math.sin(i * 2.09) * 0.5 * size], 0.07, [0.12, 0.12, 0.12], MT.metal);
  cb.glow(lx, 1.2 * size, lz, col, 1);
  cb.circ(lx, lz, 0.65 * size, -1, 1.1);
}
function fArmorStand(cb, lx, lz, ry, st) {
  const steel = [0.58, 0.61, 0.7], dark = [0.34, 0.36, 0.43];
  const fx = Math.sin(ry), fz = Math.cos(ry), px = Math.cos(ry), pz = -Math.sin(ry);
  cb.box(lx, 0.1, lz, 1.0, 0.2, 1.0, ry, st.stone2, MT.stone, 0);
  cb.cyl6(lx, 0.2, lz, 0.05, 0.8, [0.3, 0.2, 0.14], MT.wood);
  for (const sd of [-1, 1]) cb.tube([[lx + px * sd * 0.15, 0.22, lz + pz * sd * 0.15], [lx + px * sd * 0.15, 0.7, lz + pz * sd * 0.15], [lx + px * sd * 0.14, 1.15, lz + pz * sd * 0.14]], [0.1, 0.09, 0.11], steel, 8, MT.metal);
  cb.cone(lx, 0.78, lz, 0.4, 0.5, st.cloth, MT.cloth);
  cb.sph(lx, 1.55, lz, 0.3, 0.4, 0.22, steel, MT.metal);
  cb.tor(lx, 1.2, lz, 0.3, 0.05, Math.PI / 2, 0, [0.35, 0.25, 0.15], MT.metal);
  for (const sd of [-1, 1]) {
    const sx = lx + px * sd * 0.4, sz = lz + pz * sd * 0.4;
    cb.sph(sx, 1.85, sz, 0.17, 0.11, 0.17, steel, MT.metal);
    cb.tube([[sx, 1.8, sz], [sx + px * sd * 0.1 + fx * 0.05, 1.45, sz + pz * sd * 0.1 + fz * 0.05], [sx + px * sd * 0.08 + fx * 0.25, 1.1, sz + pz * sd * 0.08 + fz * 0.25]], [0.08, 0.07, 0.06], dark, 7, MT.metal);
  }
  cb.sph(lx, 2.12, lz, 0.19, 0.23, 0.2, steel, MT.metal);
  cb.box(lx + fx * 0.16, 2.14, lz + fz * 0.16, 0.26, 0.05, 0.05, ry, [0.05, 0.05, 0.08], MT.gen, 0);
  cb.box(lx + fx * 0.17, 2.05, lz + fz * 0.17, 0.04, 0.2, 0.04, ry, [0.05, 0.05, 0.08], MT.gen, 0);
  cb.tube([[lx, 2.32, lz], [lx - fx * 0.1, 2.5, lz - fz * 0.1], [lx - fx * 0.3, 2.35, lz - fz * 0.3], [lx - fx * 0.4, 2.0, lz - fz * 0.4]], [0.02, 0.06, 0.05, 0.02], st.banner, 7, MT.cloth);
  // Schild und Speer
  cb.sph(lx - px * 0.55 + fx * 0.15, 1.3, lz - pz * 0.55 + fz * 0.15, 0.3, 0.38, 0.05, st.banner, MT.metal);
  cb.cyl6(lx + px * 0.6, 0.2, lz + pz * 0.6, 0.025, 2.4, [0.4, 0.3, 0.2], MT.wood);
  cb.cone(lx + px * 0.6, 2.6, lz + pz * 0.6, 0.06, 0.3, steel, MT.metal);
  cb.circ(lx, lz, 0.55, -1, 2.6);
}
function fWeaponRack(cb, lx, lz, ry, st) {
  const c = Math.cos(ry), s = Math.sin(ry);
  cb.box(lx, 0.9, lz, 2.4, 0.08, 0.4, ry, st.wood2, MT.wood, 0);
  cb.box(lx, 0.2, lz, 2.4, 0.08, 0.4, ry, st.wood2, MT.wood, 0);
  for (const u of [-1.15, 1.15]) cb.box(lx + u * c, 0.6, lz - u * s, 0.1, 1.3, 0.1, ry, st.wood2, MT.wood, 0);
  for (let i = 0; i < 6; i++) { const u = (i - 2.5) * 0.4; cb.box(lx + u * c, 1.3, lz - u * s, 0.07, 2.0, 0.05, ry, i % 2 ? [0.4, 0.3, 0.2] : [0.78, 0.8, 0.86], i % 2 ? MT.wood : MT.metal, 0); if (i % 2 === 0) cb.box(lx + u * c, 2.3, lz - u * s, 0.1, 0.3, 0.03, ry + 0.78, [0.8, 0.82, 0.88], MT.metal, 0); }
  cb.boxCol(lx, lz, 2.4, 0.5, ry, -1, 2.4);
}
function fAnvil(cb, lx, lz, ry, st) {
  cb.box(lx, 0.35, lz, 0.5, 0.7, 0.4, ry, st.wood2, MT.wood);
  cb.box(lx, 0.78, lz, 0.9, 0.18, 0.34, ry, [0.2, 0.2, 0.23], MT.metal, 0);
  cb.box(lx, 0.7, lz, 0.3, 0.3, 0.2, ry, [0.2, 0.2, 0.23], MT.metal, 0);
  cb.circ(lx, lz, 0.55, -1, 1);
}
function fChest(cb, lx, lz, ry, st) {
  cb.box(lx, 0.32, lz, 1.0, 0.64, 0.62, ry, st.wood, MT.wood);
  cb.box(lx, 0.7, lz, 1.02, 0.12, 0.64, ry, st.wood2, MT.wood, 0);
  cb.box(lx, 0.34, lz, 0.1, 0.7, 0.66, ry, st.gold, MT.gold, 0);
  cb.boxCol(lx, lz, 1.0, 0.62, ry, -1, 0.8);
}
function fStatue(cb, lx, lz, ry, st, h = 3) {
  const fx = Math.sin(ry), fz = Math.cos(ry), px = Math.cos(ry), pz = -Math.sin(ry);
  cb.box(lx, 0.4, lz, 1.3, 0.8, 1.3, ry, st.stone2, MT.marble, 0);
  cb.box(lx, 0.95, lz, 1.0, 0.3, 1.0, ry, st.stone, MT.marble, 0);
  const y0 = 1.1, bh = h * 0.5;
  cb.tube([[lx, y0, lz], [lx, y0 + bh * 0.4, lz], [lx, y0 + bh, lz]], [0.46, 0.36, 0.26], st.stone, 12, MT.marble);
  cb.sph(lx, y0 + bh + 0.05, lz, 0.36, 0.16, 0.22, st.stone, MT.marble);
  cb.sph(lx, y0 + bh + 0.5, lz, 0.2, 0.24, 0.21, st.stone, MT.marble);
  cb.cone(lx, y0 + bh + 0.62, lz - fz * 0.02, 0.24, 0.4, st.stone2, MT.marble);
  for (const sd of [-1, 1]) {
    const sx = lx + px * sd * 0.38, sz = lz + pz * sd * 0.38;
    cb.tube([[sx, y0 + bh - 0.05, sz], [sx + fx * 0.15, y0 + bh - 0.55, sz + fz * 0.15], [lx + fx * 0.42 + px * sd * 0.05, y0 + bh - 1.0, lz + fz * 0.42 + pz * sd * 0.05]], [0.12, 0.1, 0.08], st.stone, 8, MT.marble);
  }
  // Schwert, Spitze nach unten
  cb.box(lx + fx * 0.45, y0 + bh - 0.6, lz + fz * 0.45, 0.09, 1.6, 0.05, ry, st.stone2, MT.marble, 0);
  cb.box(lx + fx * 0.45, y0 + bh + 0.1, lz + fz * 0.45, 0.5, 0.08, 0.1, ry, st.stone2, MT.marble, 0);
  cb.circ(lx, lz, 0.9, -1, h + 1);
}
function fPew(cb, lx, lz, len, ry, st) { fBench(cb, lx, lz, len, ry, st); const c = Math.cos(ry), s = Math.sin(ry); cb.box(lx - 0.3 * s, 0.85, lz - 0.3 * c, len, 0.5, 0.06, ry, st.wood2, MT.wood, 0); }
function fGoldPile(cb, lx, lz, n, st) {
  const r = cb.r;
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * 0.9, hh = Math.max(0.05, 0.5 - d * 0.5); cb.sph(lx + Math.cos(a) * d, hh * 0.5, lz + Math.sin(a) * d, 0.3, 0.14, 0.3, [1, 0.82 + r() * 0.1, 0.25], MT.gold); }
  cb.glow(lx, 0.6, lz, [1, 0.85, 0.4], 1);
}
function fBottle(cb, lx, h, lz, col) { cb.cyl6(lx, h, lz, 0.07, 0.28, col, MT.emit); cb.cyl6(lx, h + 0.28, lz, 0.03, 0.1, [0.5, 0.4, 0.3], MT.wood); cb.glow(lx, h + 0.15, lz, col, 0.5); }
function fSkeleton(cb, lx, lz, ry) {
  const bone = [0.88, 0.85, 0.76], r = cb.r;
  cb.sph(lx, 0.15, lz, 0.14, 0.12, 0.15, bone, MT.plaster);
  cb.box(lx - 0.45 * Math.sin(ry), 0.08, lz - 0.45 * Math.cos(ry), 0.4, 0.1, 0.25, ry, bone, MT.plaster, 0);
  for (let i = 0; i < 4; i++) cb.box(lx + (r() - 0.5) * 0.9, 0.05, lz + (r() - 0.5) * 0.9, 0.5, 0.05, 0.05, r() * 3, bone, MT.plaster, 0);
}

// ---------- Räume ----------
const ROOM_NAMES = { thron: 'Thronsaal', bankett: 'Bankettsaal', tanz: 'Ballsaal', kapelle: 'Kapelle', kueche: 'Küche', waffen: 'Waffenkammer', biblio: 'Bibliothek', schlaf: 'Schlafgemach', kerker: 'Kerker', schatz: 'Schatzkammer', alchemie: 'Alchemistenstube', krieg: 'Kriegsrat', halle: 'Eingangshalle', kaserne: 'Kaserne', stall: 'Stall', schmiede: 'Schmiede', vorrat: 'Vorratskammer', sternwarte: 'Sternenzimmer' };

function roomDoorFree(room, x, z, d = 2.4) { for (const p of room.doors) if (Math.hypot(p[0] - x, p[1] - z) < d) return false; return true; }
// Fackeln entlang der Wände
function roomTorches(cb, room, st, spacing = 6, h = 2.6, skip = []) {
  const { x0, x1, z0, z1 } = room;
  const place = (x, z, ry) => { if (roomDoorFree(room, x, z, 2.0) && !skip.some(p => Math.hypot(p[0] - x, p[1] - z) < 1.4)) fTorch(cb, x, z, h, ry, st); };
  for (let x = x0 + spacing / 2; x < x1; x += spacing) { place(x, z0 + 0.25, 0); place(x, z1 - 0.25, Math.PI); }
  for (let z = z0 + spacing / 2; z < z1; z += spacing) { place(x0 + 0.25, z, Math.PI / 2); place(x1 - 0.25, z, -Math.PI / 2); }
}

const ROOM_FILL = {
  halle(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r, cx = (x0 + x1) / 2;
    fRug(cb, cx, (z0 + z1) / 2, 5, z1 - z0 - 1.5, 0, st.carpet, st.gold);
    for (const sx of [-1, 1]) { fStatue(cb, cx + sx * (x1 - x0) * 0.32, z1 - 1.8, Math.PI, st); fBrazier(cb, cx + sx * 3.2, z1 - 1.2, st); }
    for (const x of [x0 + 2.5, x1 - 2.5]) { fBanner(cb, x, z0 + 0.4, st.ceil - 3, 0, st, st.banner); }
    fBench(cb, x0 + 2.2, z1 - 0.9, 2.2, 0, st); fBench(cb, x1 - 2.2, z1 - 0.9, 2.2, 0, st);
    roomTorches(cb, room, st, 7, 2.8);
  },
  thron(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r, cx = (x0 + x1) / 2, w = x1 - x0;
    // Podest am hinteren Ende (z0)
    const dz = z0 + 1.0, dd = Math.min(6.5, (z1 - z0) * 0.22);
    for (let i = 0; i < 3; i++) {
      const top = 0.4 * (i + 1), wi = w * 0.52 - i * 1.2, di = dd - i * 1.0, zc = dz + di / 2;
      cb.box(cx, top / 2, zc, wi, top, di, 0, st.stone2.map(v => v * (1 + i * 0.05)), MT.marble, 0.02);
      cb.surface(cx, zc, wi / 2, di / 2, 0, top, top, 'x');
    }
    // Thron
    const tz = dz + 1.4, ty = 1.2;
    cb.box(cx, ty + 0.35, tz, 1.8, 0.6, 1.6, 0, st.wood2, MT.wood);
    cb.box(cx, ty + 2.2, tz - 0.7, 1.8, 3.6, 0.35, 0, st.wood2, MT.wood);
    cb.box(cx, ty + 4.2, tz - 0.7, 2.2, 0.5, 0.5, 0, st.gold, MT.gold, 0);
    cb.cone(cx - 0.95, ty + 3.9, tz - 0.7, 0.28, 0.9, st.gold, MT.gold);
    cb.cone(cx + 0.95, ty + 3.9, tz - 0.7, 0.28, 0.9, st.gold, MT.gold);
    cb.cone(cx, ty + 4.4, tz - 0.7, 0.35, 1.3, st.gold, MT.gold);
    for (const sd of [-1, 1]) { cb.box(cx + sd * 0.95, ty + 0.9, tz, 0.2, 0.35, 1.3, 0, st.wood2, MT.wood, 0); cb.sph(cx + sd * 0.95, ty + 1.15, tz + 0.55, 0.14, 0.14, 0.14, st.gold, MT.gold); }
    cb.box(cx, ty + 0.78, tz, 1.4, 0.22, 1.3, 0, st.banner, MT.cloth, 0);
    cb.cap(cx - 0.6, tz, cx + 0.6, tz, 0.9, -1, 3);
    cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'rest', x: cb.wx(cx, tz + 1.9), z: cb.wz(cx, tz + 1.9), r: 2.6, label: 'Auf den Thron blicken und rasten' });
    cb.glow(cx, ty + 4.5, tz - 0.4, st.gold, 1.2);
    // Teppich vom Eingang zum Podest
    fRug(cb, cx, (dz + dd + z1) / 2, 4.4, z1 - dz - dd - 1, 0, st.carpet, st.gold);
    // Säulen links und rechts
    for (let z = dz + dd + 3; z < z1 - 3; z += 6) for (const sd of [-1, 1]) { fPillar(cb, cx + sd * (w * 0.36), z, st.ceil - 0.8, 0.55, st); fBrazier(cb, cx + sd * (w * 0.36 - 1.4), z + 1.0, st); }
    for (const sd of [-1, 1]) { fBanner(cb, cx + sd * (w * 0.2), dz + 0.4, ty + 3.4, 0, st, st.banner, 1.6, 4.6); fStatue(cb, cx + sd * (w * 0.45), dz + 1.2, 0.3 * sd, st, 3.5); }
    // Bankett im vorderen Teil, falls Platz
    if (z1 - dz - dd > 16) for (const sd of [-1, 1]) { const tzz = (dz + dd + z1) / 2 + 3; fTable(cb, cx + sd * 4.6, tzz, 7.5, 1.3, Math.PI / 2, st); for (const k of [-1, 1]) fBench(cb, cx + sd * 4.6 + k * 1.1, tzz, 7, Math.PI / 2, st); }
    fChandelier(cb, cx, st.ceil - 3.4, (dz + dd + z1) / 2, 2.0, st, 2.6);
    fChandelier(cb, cx, st.ceil - 3.4, dz + dd + 3, 1.6, st, 2.6);
    roomTorches(cb, room, st, 8, 3.2);
  },
  bankett(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r, cx = (x0 + x1) / 2, w = x1 - x0, L = z1 - z0;
    // Kamin am hinteren Ende
    fFireplace(cb, cx, z0 + 0.2, Math.PI, 5, st, true);
    // Hohe Tafel quer
    fTable(cb, cx, z0 + 4.4, Math.min(w - 5, 11), 1.6, 0, st);
    for (let i = 0; i < 5; i++) fChair(cb, cx + (i - 2) * 1.8, z0 + 5.6, 0, st, i === 2);
    // Lange Tafeln
    const nt = w > 17 ? 3 : 2;
    for (let i = 0; i < nt; i++) {
      const tx = cx + (i - (nt - 1) / 2) * 5.4;
      fTable(cb, tx, z0 + 9 + (L - 12) / 2, L - 15, 1.5, Math.PI / 2, st);
      for (const sd of [-1, 1]) fBench(cb, tx + sd * 1.15, z0 + 9 + (L - 12) / 2, L - 15.5, Math.PI / 2, st);
    }
    fRug(cb, cx, z0 + 2.5, 8, 3, 0, st.carpet, st.gold);
    for (const z of [z0 + 8, z1 - 5]) for (const sd of [-1, 1]) fBrazier(cb, cx + sd * (w / 2 - 1.6), z, st);
    for (let z = z0 + 6; z < z1 - 2; z += 9) fChandelier(cb, cx, st.ceil - 3.6, z, 2.0, st, 2.6);
    for (const sd of [-1, 1]) { fBanner(cb, cx + sd * (w / 2 - 0.4), z0 + 3.5, st.ceil - 3.6, sd * -Math.PI / 2, st, st.banner, 1.5, 4.2); }
    // Trophäen: Hirschgeweih über dem Kamin
    cb.box(cx, 5.8, z0 + 0.5, 1.2, 0.8, 0.3, 0, [0.35, 0.25, 0.18], MT.wood);
    for (const sd of [-1, 1]) { cb.beam([cx + sd * 0.4, 6.1, z0 + 0.6], [cx + sd * 1.6, 7.4, z0 + 0.6], 0.09, [0.85, 0.8, 0.68], MT.plaster); cb.beam([cx + sd * 1.0, 6.7, z0 + 0.6], [cx + sd * 1.9, 6.9, z0 + 0.6], 0.07, [0.85, 0.8, 0.68], MT.plaster); }
    roomTorches(cb, room, st, 8, 3.2);
  },
  tanz(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, w = x1 - x0;
    // Schachbrettboden
    const n = 8, tw = (w - 3) / n, tl = (z1 - z0 - 8) / 10;
    for (let i = 0; i < n; i++) for (let j = 0; j < 10; j++) if ((i + j) % 2) cb.box(x0 + 1.5 + tw * (i + 0.5), 0.04, z0 + 4 + tl * (j + 0.5), tw, 0.04, tl, 0, st.stone2.map(v => v * 0.55), MT.marble, 0);
    for (let z = z0 + 5; z < z1 - 3; z += 6) for (const sd of [-1, 1]) { fPillar(cb, cx + sd * (w * 0.4), z, st.ceil - 0.8, 0.5, st); fCandelabrum(cb, cx + sd * (w * 0.4 - 1.4), z + 1.2, 1.7, st, 5); }
    for (let z = z0 + 6; z < z1 - 2; z += 8) { fChandelier(cb, cx - 3, st.ceil - 3.2, z, 2.2, st, 2.5); fChandelier(cb, cx + 3, st.ceil - 3.2, z + 3, 2.2, st, 2.5); }
    // Bühne mit Harfe und Spielleuten (Stühle)
    cb.box(cx, 0.3, z0 + 2.4, 8, 0.6, 3.6, 0, st.wood2, MT.wood);
    cb.surface(cx, z0 + 2.4, 4, 1.8, 0, 0.6, 0.6, 'x');
    for (let i = 0; i < 4; i++) fChair(cb, cx - 2.4 + i * 1.6, z0 + 2.4, 0, st);
    cb.box(cx + 3, 1.4, z0 + 2.0, 0.2, 1.8, 0.8, 0, st.gold, MT.gold); cb.box(cx + 3.4, 1.4, z0 + 2.0, 0.08, 1.7, 0.7, 0.6, st.gold, MT.gold);
    for (const sd of [-1, 1]) fStatue(cb, cx + sd * (w * 0.46), z1 - 1.6, Math.PI + 0.3 * sd, st, 3.4);
    for (const sd of [-1, 1]) fTable(cb, cx + sd * (w * 0.34), z1 - 3, 3.5, 1.2, 0, st);
    // Spiegel an der Wand
    for (let i = 0; i < 3; i++) cb.box(cx + (i - 1) * 5, 3.5, z0 + 0.3, 2.2, 4.2, 0.12, 0, [0.7, 0.85, 1], MT.emit, 0);
    roomTorches(cb, room, st, 9, 3.2);
  },
  kapelle(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, w = x1 - x0;
    // Altar mit Tuch und Kerzen
    cb.box(cx, 0.5, z0 + 1.6, 3.2, 1.0, 1.2, 0, st.stone2, MT.marble);
    cb.box(cx, 1.05, z0 + 1.6, 3.4, 0.1, 1.3, 0, st.banner, MT.cloth, 0);
    for (const sd of [-1, 1]) fCandelabrum(cb, cx + sd * 1.3, z0 + 1.6, 1.2, st, 3);
    cb.cap(cx - 1.4, z0 + 1.6, cx + 1.4, z0 + 1.6, 0.8, -1, 1.4);
    cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'rest', x: cb.wx(cx, z0 + 3.4), z: cb.wz(cx, z0 + 3.4), r: 3, label: 'Am Altar innehalten' });
    // grosses farbiges Fenster
    for (let i = 0; i < 5; i++) cb.box(cx + (i - 2) * 0.9, st.ceil * 0.55, z0 + 0.3, 0.8, 5.5 - Math.abs(i - 2) * 1.0, 0.1, 0, [[0.9, 0.3, 0.3], [0.3, 0.5, 0.95], [1, 0.85, 0.3], [0.4, 0.85, 0.5], [0.8, 0.4, 0.9]][i], MT.emit, 0);
    cb.glow(cx, st.ceil * 0.55, z0 + 1.0, [1, 0.95, 0.8], 2.5);
    // Bankreihen
    for (let z = z0 + 5; z < z1 - 3; z += 1.9) for (const sd of [-1, 1]) fPew(cb, cx + sd * 3.0, z, 4.2, 0, st);
    fRug(cb, cx, (z0 + z1) / 2 + 1, 2.2, z1 - z0 - 3, 0, st.carpet, st.gold);
    for (let z = z0 + 6; z < z1 - 2; z += 7) for (const sd of [-1, 1]) fPillar(cb, cx + sd * (w * 0.4), z, st.ceil - 0.8, 0.5, st);
    fStatue(cb, x0 + 2.0, z0 + 2.2, 0.4, st, 3.2); fStatue(cb, x1 - 2.0, z0 + 2.2, -0.4, st, 3.2);
    for (let z = z0 + 7; z < z1; z += 9) fChandelier(cb, cx, st.ceil - 3.2, z, 1.6, st, 2.4);
    roomTorches(cb, room, st, 7, 2.8);
  },
  kueche(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r, cx = (x0 + x1) / 2;
    fFireplace(cb, cx, z0 + 0.2, Math.PI, 5.5, st, false);
    fCauldron(cb, cx, z0 + 1.6, [0.4, 0.9, 0.3], 1.3);
    // Spiess am Feuer
    cb.cyl6(cx, 0.9, z0 + 1.1, 0.04, 3, [0.15, 0.13, 0.13], MT.metal);
    fTable(cb, cx, (z0 + z1) / 2 + 0.5, 6, 1.6, 0, st, true, 1.0);
    for (const sd of [-1, 1]) fTable(cb, cx + sd * 4.4, (z0 + z1) / 2, 4, 1.2, Math.PI / 2, st, false, 1.0);
    for (let i = 0; i < 5; i++) fBarrel(cb, x0 + 0.9 + (i % 2) * 0.1, z0 + 2 + i * 1.1, st);
    for (let i = 0; i < 4; i++) fCrate(cb, x1 - 1.0, z0 + 2 + i * 1.2, 0.9, r() * 3, st);
    for (let i = 0; i < 6; i++) { const a = x0 + 2 + i * 1.6; cb.cyl6(a, 3.2, z1 - 0.5, 0.025, 1.0, [0.2, 0.2, 0.2], MT.metal); cb.cyl(a, 2.4, z1 - 0.5, 0.25, 0.1, [0.3, 0.3, 0.32], MT.metal); }
    for (let i = 0; i < 4; i++) cb.sph(cx - 2.5 + i * 1.7, 3.3, (z0 + z1) / 2, 0.22, 0.34, 0.2, [0.55, 0.22, 0.2], MT.gen);   // hängende Würste
    cb.beam([x0 + 0.5, 3.6, (z0 + z1) / 2], [x1 - 0.5, 3.6, (z0 + z1) / 2], 0.2, st.wood2);
    for (let i = 0; i < 6; i++) cb.sph(x0 + 1 + i * (x1 - x0 - 2) / 5, 0.25, z1 - 0.9, 0.35, 0.28, 0.35, [0.75, 0.65, 0.4], MT.cloth); // Säcke
    cb.cap(x0 + 1, z1 - 0.9, x1 - 1, z1 - 0.9, 0.5, -1, 1);
    roomTorches(cb, room, st, 7, 2.6);
  },
  waffen(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2;
    for (let i = 0; i < 4; i++) { fArmorStand(cb, x0 + 1.5 + i * ((x1 - x0 - 3) / 3), z1 - 1.5, Math.PI, st); }
    for (let i = 0; i < 3; i++) fWeaponRack(cb, x0 + 2.5 + i * 3.6, z0 + 0.8, 0, st);
    fAnvil(cb, cx, (z0 + z1) / 2, 0.5, st);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { cb.box(sd > 0 ? x1 - 0.2 : x0 + 0.2, 2.8, z0 + 3 + i * 3, 0.06, 1.1, 1.1, 0, [0.5, 0.15, 0.15], MT.metal); cb.box(sd > 0 ? x1 - 0.25 : x0 + 0.25, 2.8, z0 + 3 + i * 3, 0.05, 0.4, 0.4, 0, st.gold, MT.gold); }
    fChest(cb, x1 - 1.2, z0 + 1.0, 0.2, st);
    fBrazier(cb, cx - 3, (z0 + z1) / 2 + 2, st);
    roomTorches(cb, room, st, 7, 2.6);
  },
  biblio(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = cb.r;
    for (let x = x0 + 1.6; x < x1 - 1; x += 2.8) fBookshelf(cb, x, z0 + 0.5, 2.6, 5.2, 0, st);
    for (let z = z0 + 3; z < z1 - 3; z += 2.8) fBookshelf(cb, x0 + 0.5, z, 2.6, 5.2, -Math.PI / 2, st);
    for (let z = z0 + 3; z < z1 - 3; z += 2.8) fBookshelf(cb, x1 - 0.5, z, 2.6, 5.2, Math.PI / 2, st);
    fRug(cb, cx, cz, 6, 5, 0, st.carpet, st.gold);
    fTable(cb, cx, cz, 3.2, 1.4, 0, st, false, 1.0);
    cb.box(cx - 0.5, 1.15, cz, 0.7, 0.1, 0.5, 0.2, [0.7, 0.2, 0.2], MT.cloth); cb.box(cx + 0.6, 1.15, cz + 0.1, 0.6, 0.1, 0.45, -0.3, [0.2, 0.3, 0.6], MT.cloth);
    fCandelabrum(cb, cx + 1.2, cz - 0.2, 1.5, st, 3);
    for (const sd of [-1, 1]) fChair(cb, cx + sd * 1.0, cz + 1.4, Math.PI, st);
    // Globus
    cb.cyl6(cx - 4, 0, cz + 2, 0.07, 1.2, st.gold, MT.gold); cb.sph(cx - 4, 1.6, cz + 2, 0.6, 0.6, 0.6, [0.3, 0.5, 0.75], MT.gen); cb.circ(cx - 4, cz + 2, 0.5, -1, 2.2);
    cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'lore', x: cb.wx(cx, cz + 2.6), z: cb.wz(cx, cz + 2.6), r: 3, label: 'Ein Buch aufschlagen', text: pick(r, LORE) });
    fChandelier(cb, cx, st.ceil - 3, cz, 1.4, st, 1.8);
    roomTorches(cb, room, st, 8, 3, [[cx, z0 + 0.3]]);
  },
  schlaf(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    fBed(cb, cx, z0 + 2.2, 0, st, st.banner);
    fRug(cb, cx, cz + 1, 5, 4, 0, st.carpet, st.gold);
    cb.box(x0 + 1.0, 1.4, z1 - 1.0, 1.7, 2.8, 0.8, 0, st.wood2, MT.wood); cb.boxCol(x0 + 1.0, z1 - 1.0, 1.7, 0.8, 0, -1, 2.8);
    fChest(cb, x1 - 1.3, z0 + 1.0, 0.1, st); fChest(cb, cx + 2.4, z0 + 1.8, 0.3, st);
    fTable(cb, x1 - 1.6, z1 - 1.8, 1.8, 1.0, Math.PI / 2, st, false, 0.9); fChair(cb, x1 - 2.7, z1 - 1.8, Math.PI / 2, st);
    fFireplace(cb, x0 + 0.2, cz, Math.PI / 2, 3.2, st, false);
    fCandelabrum(cb, cx - 2.2, z0 + 1.2, 1.3, st, 3);
    roomTorches(cb, room, st, 8, 2.8, [[x0 + 0.3, cz]]);
  },
  kerker(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r;
    const nc = Math.max(2, Math.floor((x1 - x0) / 4.2));
    for (let i = 0; i < nc; i++) {
      const cxx = x0 + (i + 0.5) * (x1 - x0) / nc, w = (x1 - x0) / nc;
      cb.box(cxx - w / 2, 2.6, (z0 + z1) / 2 + 0.5, 0.35, 5.2, (z1 - z0) - 2, 0, st.stone2.map(v => v * 0.7), MT.stone, 0);
      // Gitterstäbe zur Gangseite
      for (let b = 0; b < 8; b++) cb.cyl6(cxx - w / 2 + 0.3 + b * (w - 0.6) / 7, 0, z1 - 4, 0.035, 4.6, [0.2, 0.2, 0.22], MT.metal);
      cb.box(cxx, 4.6, z1 - 4, w - 0.4, 0.1, 0.1, 0, [0.2, 0.2, 0.22], MT.metal, 0);
      cb.cap(cxx - w / 2 + 0.3, z1 - 4, cxx + w / 2 - 0.3, z1 - 4, 0.12, -1, 5);
      cb.box(cxx, 0.12, (z0 + z1) / 2 - 1.2, w - 1.2, 0.2, 2, 0, [0.7, 0.6, 0.3], MT.cloth);
      if (r() < 0.6) fSkeleton(cb, cxx, (z0 + z1) / 2 - 0.8, r() * 3);
      for (let k = 0; k < 2; k++) cb.cyl6(cxx - w / 2 + 0.5, 3 + k * 0.6, z0 + 0.4, 0.03, 1.4, [0.25, 0.25, 0.28], MT.metal);
    }
    cb.cap(x0 + 0.5, z1 - 4, x1 - 0.5, z1 - 4, 0.12, -1, 5);
    for (let i = 0; i < 3; i++) fTorch(cb, x0 + 3 + i * (x1 - x0 - 6) / 2, z1 - 0.3, 2.8, Math.PI, st);
    fBarrel(cb, x1 - 1, z1 - 1.2, st); fBarrel(cb, x0 + 1, z1 - 1.2, st);
    cb.box((x0 + x1) / 2, 0.45, z1 - 1.6, 1.4, 0.9, 0.9, 0, st.wood2, MT.wood);
  },
  schatz(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r, cx = (x0 + x1) / 2;
    for (let i = 0; i < 5; i++) fGoldPile(cb, x0 + 2 + r() * (x1 - x0 - 4), z0 + 2 + r() * (z1 - z0 - 4), 14, st);
    for (let i = 0; i < 3; i++) fChest(cb, x0 + 1.3 + i * 2.2, z0 + 0.9, 0, st);
    for (const sd of [-1, 1]) { cb.cyl(cx + sd * 3.5, 0, z1 - 1.6, 0.4, 1.2, st.stone2, MT.marble); cb.sph(cx + sd * 3.5, 1.5, z1 - 1.6, 0.28, 0.3, 0.28, st.gold, MT.gold); cb.circ(cx + sd * 3.5, z1 - 1.6, 0.5, -1, 1.8); }
    cb.glow(cx, 1.2, (z0 + z1) / 2, [1, 0.85, 0.4], 3);
    fBrazier(cb, cx, z1 - 1.2, st);
    room.chestSpot = [cx, z0 + 3.2];
    roomTorches(cb, room, st, 6, 2.6);
  },
  alchemie(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = cb.r;
    fCauldron(cb, cx, cz, pick(r, [[0.5, 0.2, 1], [0.2, 1, 0.6], [1, 0.4, 0.8]]), 1.6);
    for (let i = 0; i < 4; i++) { fBookshelf(cb, x0 + 1.6 + i * 2.8, z0 + 0.5, 2.6, 4.6, 0, st); }
    for (let i = 0; i < 12; i++) fBottle(cb, x0 + 1.2 + i * 0.9, 2.1 + (i % 3) * 0.55, z0 + 0.9, pick(r, [[0.3, 1, 0.5], [0.8, 0.3, 1], [1, 0.5, 0.2], [0.3, 0.7, 1]]));
    fTable(cb, x1 - 2, cz, 4, 1.4, Math.PI / 2, st, false, 1.0);
    for (let i = 0; i < 5; i++) fBottle(cb, x1 - 2 + (r() - 0.5) * 0.8, 1.1, cz + (i - 2) * 0.7, pick(r, [[0.3, 1, 0.5], [0.8, 0.3, 1], [1, 0.5, 0.2]]));
    cb.sph(x0 + 1.5, 0.9, z1 - 1.5, 0.25, 0.28, 0.25, [0.9, 0.88, 0.8], MT.plaster);
    // Sternbild-Lichter an der Decke
    for (let i = 0; i < 26; i++) cb.glow(x0 + 1 + r() * (x1 - x0 - 2), st.ceil - 0.4, z0 + 1 + r() * (z1 - z0 - 2), [0.8, 0.85, 1], 0.8);
    cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'lore', x: cb.wx(cx, cz + 2.6), z: cb.wz(cx, cz + 2.6), r: 3, label: 'Das Rezeptbuch lesen', text: pick(r, LORE) });
    roomTorches(cb, room, st, 8, 2.8, [[cx, z0 + 0.3]]);
  },
  krieg(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = cb.r;
    cb.box(cx, 1.0, cz, 5, 0.2, 3.2, 0, st.wood2, MT.wood); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cb.box(cx + a * 2.2, 0.5, cz + b * 1.3, 0.3, 1, 0.3, 0, st.wood2, MT.wood, 0);
    cb.box(cx, 1.12, cz, 4.6, 0.04, 2.8, 0, [0.7, 0.62, 0.42], MT.cloth, 0);
    for (let i = 0; i < 9; i++) cb.cyl6(cx - 2 + r() * 4, 1.15, cz - 1.2 + r() * 2.4, 0.07, 0.25 + r() * 0.15, r() < 0.5 ? [0.7, 0.15, 0.15] : [0.2, 0.3, 0.7], MT.wood);
    cb.cap(cx - 2, cz, cx + 2, cz, 1.6, -1, 1.3);
    for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) fChair(cb, cx + (i - 0.5) * 2.2, cz + sd * 2.5, sd > 0 ? Math.PI : 0, st);
    for (let i = 0; i < 3; i++) fBanner(cb, x0 + 2 + i * (x1 - x0 - 4) / 2, z0 + 0.4, st.ceil - 3.4, 0, st, st.banner, 1.4, 3.4);
    fWeaponRack(cb, x1 - 1.5, (z0 + z1) / 2, -Math.PI / 2, st);
    fBrazier(cb, x0 + 1.4, z1 - 1.4, st); fBrazier(cb, x1 - 1.4, z1 - 1.4, st);
    cb.out.interact.push({ y: cb.y0 + cb.fy, kind: 'lore', x: cb.wx(cx, cz + 3.4), z: cb.wz(cx, cz + 3.4), r: 3, label: 'Die Karte betrachten', text: 'Die Karte zeigt Wege, Burgen und kleine rote Kreuze. Eines liegt genau dort, wo du jetzt stehst.' });
    roomTorches(cb, room, st, 7, 2.8);
  },
  sternwarte(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = cb.r;
    // Himmelsglobus und Sternkarte am Boden
    cb.tor(cx, 1.5, cz, 1.6, 0.05, 0, 0, st.gold, MT.gold); cb.tor(cx, 1.5, cz, 1.6, 0.05, Math.PI / 2, 0, st.gold, MT.gold); cb.tor(cx, 1.5, cz, 1.3, 0.05, 1, 0.7, st.gold, MT.gold);
    cb.sph(cx, 1.5, cz, 0.5, 0.5, 0.5, [0.5, 0.7, 1], MT.emit); cb.glow(cx, 1.5, cz, [0.6, 0.8, 1], 3);
    cb.cyl(cx, 0, cz, 0.7, 0.9, st.stone2, MT.marble); cb.circ(cx, cz, 1.0, -1, 3);
    for (let i = 0; i < 40; i++) cb.glow(x0 + 1 + r() * (x1 - x0 - 2), 0.1, z0 + 1 + r() * (z1 - z0 - 2), [0.7, 0.85, 1], 0.7);
    for (let i = 0; i < 60; i++) cb.glow(x0 + 1 + r() * (x1 - x0 - 2), st.ceil - 0.5, z0 + 1 + r() * (z1 - z0 - 2), [0.85, 0.9, 1], 0.9);
    fBookshelf(cb, x0 + 0.5, cz, 3, 4.5, -Math.PI / 2, st);
    fTable(cb, x1 - 2, cz, 3, 1.2, Math.PI / 2, st, false, 1.0);
    for (let i = 0; i < 4; i++) fCandelabrum(cb, x0 + 2 + i * (x1 - x0 - 4) / 3, z1 - 1.2, 1.5, st, 3);
    roomTorches(cb, room, st, 8, 2.8);
  },
  vorrat(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r;
    for (let i = 0; i < 18; i++) { const x = x0 + 1 + r() * (x1 - x0 - 2), z = z0 + 1 + r() * (z1 - z0 - 2); if (!roomDoorFree(room, x, z, 2.6)) continue; if (r() < 0.5) fBarrel(cb, x, z, st, 0.8 + r() * 0.5); else fCrate(cb, x, z, 0.7 + r() * 0.5, r() * 3, st); }
    roomTorches(cb, room, st, 8, 2.6);
  },
  kaserne(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r;
    for (let i = 0; i < Math.floor((x1 - x0) / 2.6); i++) for (const sd of [-1, 1]) { const x = x0 + 1.6 + i * 2.6, z = sd > 0 ? z1 - 1.2 : z0 + 1.2; cb.box(x, 0.4, z, 1.0, 0.18, 2.0, Math.PI / 2, st.wood2, MT.wood); cb.box(x, 0.6, z, 0.9, 0.18, 1.8, Math.PI / 2, [0.6, 0.55, 0.45], MT.cloth); cb.boxCol(x, z, 1.0, 2.0, Math.PI / 2, -1, 1); }
    fTable(cb, (x0 + x1) / 2, (z0 + z1) / 2, 5, 1.2, 0, st); fWeaponRack(cb, (x0 + x1) / 2, z0 + 0.6, 0, st);
    for (let i = 0; i < 3; i++) fBarrel(cb, x1 - 0.8, (z0 + z1) / 2 + (i - 1) * 1.0, st);
    roomTorches(cb, room, st, 7, 2.6);
  },
  stall(cb, room, st) {
    const { x0, x1, z0, z1 } = room, r = cb.r;
    for (let i = 0; i < Math.floor((x1 - x0) / 3.4); i++) {
      const x = x0 + 1.9 + i * 3.4;
      cb.box(x + 1.7, 1, z0 + (z1 - z0) / 2, 0.15, 2, z1 - z0 - 4, 0, st.wood2, MT.wood);
      cb.box(x, 0.2, z0 + 3, 2.4, 0.4, 2.2, 0, [0.85, 0.75, 0.4], MT.cloth);
      cb.boxCol(x + 1.7, z0 + (z1 - z0) / 2, 0.15, z1 - z0 - 4, 0, -1, 2);
      if (r() < 0.7) { // Pferd
        const hc = pick(r, [[0.35, 0.24, 0.16], [0.85, 0.82, 0.78], [0.15, 0.12, 0.12]]);
        cb.sph(x, 1.3, z0 + (z1 - z0) / 2 + 0.5, 0.45, 0.45, 1.0, hc, MT.cloth); cb.sph(x, 1.9, z0 + (z1 - z0) / 2 + 1.5, 0.28, 0.42, 0.3, hc, MT.cloth); cb.sph(x, 2.2, z0 + (z1 - z0) / 2 + 1.9, 0.2, 0.2, 0.36, hc, MT.cloth);
        for (const [a, b] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.5], [0.2, -0.5]]) cb.cyl6(x + a, 0, z0 + (z1 - z0) / 2 + 0.5 + b * 2, 0.06, 1.0, hc, MT.cloth);
        cb.circ(x, z0 + (z1 - z0) / 2 + 0.6, 0.8, -1, 2.5);
      }
    }
    for (let i = 0; i < 4; i++) cb.box(x1 - 1.2, 0.5 + i * 0.4, z1 - 1.2, 1.4, 0.4, 1.0, r() * 0.4, [0.85, 0.75, 0.35], MT.cloth);
    roomTorches(cb, room, st, 8, 2.6);
  },
  schmiede(cb, room, st) {
    const { x0, x1, z0, z1 } = room, cx = (x0 + x1) / 2;
    cb.box(x0 + 1.2, 0.6, z0 + 1.2, 2.2, 1.2, 1.8, 0, st.stone2, MT.stone); cb.flame(x0 + 1.2, 1.4, z0 + 1.2, 2, [1, 0.45, 0.12], true); cb.cap(x0 + 0.6, z0 + 1.2, x0 + 1.8, z0 + 1.2, 1.1, -1, 1.5);
    cb.box(x0 + 1.2, 3.0, z0 + 0.5, 1.4, 4, 0.8, 0, st.stone2, MT.stone);
    fAnvil(cb, cx, z0 + 2.4, 0.3, st);
    fWeaponRack(cb, cx + 2, z1 - 0.7, Math.PI, st);
    fBarrel(cb, x1 - 1, z0 + 1, st); fCrate(cb, x1 - 1, z0 + 2.4, 0.9, 0.2, st);
    cb.box(x1 - 1.2, 0.4, z1 - 1.2, 1.2, 0.8, 0.9, 0, st.wood2, MT.wood);
    roomTorches(cb, room, st, 8, 2.6);
  },
};

function furnishRoom(cb, room, st) {
  cb.st = st;
  st.ceil = room.h;
  cb.fy = room.y || 0;
  const fn = ROOM_FILL[room.type];
  if (fn) fn(cb, room, st);
  cb.fy = 0;
}
