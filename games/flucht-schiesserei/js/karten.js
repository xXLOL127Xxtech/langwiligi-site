'use strict';
// ============================================================
//  Karten: jede Karte verändert sich während der Runde
// ============================================================

// Rechteck in lokalen Metern zeichnen (y oben)
function RR(g, P, x0, y0, x1, y1, col) {
  const [a, b] = P(x0, y1), [c, d] = P(x1, y0);
  const X = Math.round(a), Y = Math.round(b);
  g.fillStyle = col; g.fillRect(X, Y, Math.max(1, Math.round(c) - X), Math.max(1, Math.round(d) - Y));
}
function RRo(g, P, x0, y0, x1, y1, col, edge) { RR(g, P, x0, y0, x1, y1, edge); const e = 1 / PPM; RR(g, P, x0 + e, y0 + e, x1 - e, y1 - e, col); }
function circlePx(g, cx, cy, r, col) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }

// Hintergrund-Ebene (horizontal kachelbar) zeichnen
function drawLayer(ctx, img, cam, fx, scroll, bottomWorldY, fy) {
  const W = img.width;
  let off = -((cam.x * fx + scroll) % W);
  if (off > 0) off -= W;
  const yb = (cam.y - bottomWorldY * PPM) * fy + (1 - fy) * cam.h * 0.78;
  const y = Math.round(yb - img.height);
  for (let x = Math.round(off); x < cam.w; x += W) ctx.drawImage(img, x, y);
  return y;
}
function skyCanvas(stops, h = 300) {
  const [c, g] = mkCanvas(32, h);
  ditherGradFast(g, 0, 0, 32, h, stops);
  return c;
}
function drawSky(ctx, cam, sky) {
  for (let x = 0; x < cam.w; x += sky.width) ctx.drawImage(sky, 0, 0, sky.width, sky.height, x, 0, sky.width, cam.h);
}
function cloud(g, x, y, w, rnd, col, shadow) {
  const n = 3 + (w / 10 | 0);
  for (let i = 0; i < n; i++) {
    const cx = x + rnd() * w, r = 4 + rnd() * w * 0.25;
    circlePx(g, Math.round(cx), Math.round(y + 2), Math.round(r), shadow);
  }
  for (let i = 0; i < n; i++) {
    const cx = x + rnd() * w, r = 3 + rnd() * w * 0.22;
    circlePx(g, Math.round(cx), Math.round(y - 1), Math.round(r), col);
  }
}
function cloudLayer(W, H, count, seed, col, shadow, ymin, ymax, wmin, wmax) {
  const [c, g] = mkCanvas(W, H);
  const r = RNG(seed);
  for (let i = 0; i < count; i++) {
    const w = wmin + r() * (wmax - wmin), x = r() * (W - w), y = ymin + r() * (ymax - ymin);
    cloud(g, x, y, w, r, col, shadow);
    // kachelbar: am Rand wiederholen
    if (x + w > W - 20) cloud(g, x - W, y, w, RNG(seed + i), col, shadow);
  }
  return c;
}
function mountains(W, H, seed, col, snow, peaks, hmin, hmax) {
  const [c, g] = mkCanvas(W, H);
  const r = RNG(seed);
  const hs = new Float32Array(W);
  for (let k = 0; k < peaks; k++) {
    const cx = r() * W, h = hmin + r() * (hmax - hmin), sl = 0.5 + r() * 0.8;
    for (let x = 0; x < W; x++) {
      let dx = Math.abs(x - cx); dx = Math.min(dx, W - dx);
      hs[x] = Math.max(hs[x], h - dx * sl);
    }
  }
  for (let x = 0; x < W; x++) {
    const h = Math.round(hs[x] + Math.sin(x * 0.3) * 1.2);
    if (h <= 0) continue;
    box(g, x, H - h, 1, h, col);
    if (snow && h > hmax * 0.62) {
      const sh = Math.round((h - hmax * 0.62) * 0.8 + (x * 7 % 3));
      box(g, x, H - h, 1, sh, snow);
      if ((x % 5) === 0) px(g, x, H - h + sh, snow);
    }
    // Licht von links
    if (x > 0 && hs[x] > hs[x - 1] + 0.3) px(g, x, H - h, shade(col, 0.15));
  }
  return c;
}

const THEMES = {};
function theme(name, fn) { let t = null; return () => (t || (t = fn())); }

// ------------------------------------------------------------
//  Karte 1: Güterzug
// ------------------------------------------------------------
const ZUG_V = 26;
const zugTheme = theme('zug', () => {
  const sky = skyCanvas([[0, '#3f86d8'], [0.55, '#8cc4f0'], [1, '#e4f2f6']]);
  const clouds = cloudLayer(640, 110, 7, 11, '#ffffff', '#d8e6f2', 25, 80, 30, 70);
  const alps = mountains(512, 90, 5, '#7d93b5', '#f2f6fa', 9, 30, 86);
  const alps2 = mountains(512, 60, 9, '#5f7a9e', '#e6eef6', 7, 18, 58);
  // Hügel mit Dörfern
  const [hills, hg] = mkCanvas(512, 64);
  { const r = RNG(21); const hs = [];
    for (let x = 0; x < 512; x++) hs[x] = 26 + Math.sin(x / 512 * Math.PI * 4) * 9 + Math.sin(x / 512 * Math.PI * 10 + 1) * 4;
    for (let x = 0; x < 512; x++) { box(hg, x, 64 - hs[x], 1, hs[x], '#5f9a4a'); px(hg, x, 64 - hs[x], '#7cb85a'); }
    for (let i = 0; i < 9; i++) { const x = r() * 500 | 0, y = 64 - hs[x] + 2; // Häuser
      box(hg, x, y - 6, 7, 6, '#efe6d2'); box(hg, x - 1, y - 9, 9, 3, '#a64032'); px(hg, x + 2, y - 4, '#4a6a9a'); px(hg, x + 4, y - 4, '#4a6a9a'); }
    { const x = 300, y = 64 - hs[300] + 2; box(hg, x, y - 18, 4, 18, '#efe6d2'); box(hg, x - 1, y - 22, 6, 4, '#3a5a3a'); px(hg, x + 1, y - 13, '#333'); }
    for (let i = 0; i < 40; i++) { const x = r() * 510 | 0, y = 64 - hs[x] + 4 + r() * 10 | 0; circlePx(hg, x, y, 2, '#3f7a36'); px(hg, x - 1, y - 1, '#5a9a48'); }
  }
  // Bäume und Zäune (nah)
  const [near, ng] = mkCanvas(512, 50);
  { const r = RNG(33);
    box(ng, 0, 38, 512, 12, '#6a9e48'); for (let x = 0; x < 512; x++) if (r() < 0.4) px(ng, x, 38, '#86ba5a');
    for (let i = 0; i < 9; i++) { const x = 20 + r() * 470 | 0, h = 18 + r() * 14 | 0;
      box(ng, x, 38 - h * 0.4, 2, h * 0.4, '#4a3020');
      for (let k = 0; k < 6; k++) circlePx(ng, x + 1 + (r() - 0.5) * 10, 38 - h * 0.45 - r() * h * 0.6, 4 + r() * 3, k < 3 ? '#2f6a2c' : '#3f8236');
      circlePx(ng, x - 2, 38 - h * 0.8, 2, '#55a044'); }
    for (let x = 0; x < 512; x += 16) { box(ng, x, 30, 1, 9, '#7a5a3a'); } box(ng, 0, 32, 512, 1, '#9a7a5a'); box(ng, 0, 35, 512, 1, '#9a7a5a');
  }
  // Gleisbett (direkt unter dem Zug)
  const [bed, bg] = mkCanvas(256, 40);
  { const r = RNG(44);
    box(bg, 0, 0, 256, 40, '#6e655c');
    for (let i = 0; i < 500; i++) px(bg, r() * 256 | 0, r() * 40 | 0, r() < 0.5 ? '#7f766c' : '#5a524a');
    for (let x = 0; x < 256; x += 8) { box(bg, x, 6, 5, 3, '#4a3a2c'); box(bg, x, 6, 5, 1, '#6a5440'); }
    box(bg, 0, 4, 256, 2, '#9aa3b2'); box(bg, 0, 4, 256, 1, '#dfe6ee'); box(bg, 0, 6, 256, 1, '#3a3d44');
    box(bg, 0, 14, 256, 26, '#5a6e3e'); for (let i = 0; i < 160; i++) px(bg, r() * 256 | 0, 14 + r() * 26 | 0, r() < 0.5 ? '#6a8048' : '#4a5e32');
  }
  // Fahrleitungsmast
  const [mast, mg] = mkCanvas(24, 150);
  box(mg, 10, 10, 4, 140, '#3a3f4a'); box(mg, 10, 10, 1, 140, '#6b7280');
  for (let y = 14; y < 150; y += 8) { px(mg, 11, y, '#2a2d34'); px(mg, 12, y + 4, '#2a2d34'); }
  box(mg, 0, 12, 24, 3, '#3a3f4a'); box(mg, 2, 15, 2, 4, '#c9d3e0');
  return { sky, clouds, alps, alps2, hills, near, bed, mast };
});

function paintWheels(g, P, xs) {
  for (const bxp of xs) {
    RR(g, P, bxp - 1.5, 0.35, bxp + 1.5, 1.05, '#17121d');
    RR(g, P, bxp - 1.45, 0.4, bxp + 1.45, 1.0, '#33363e');
    RR(g, P, bxp - 1.45, 0.9, bxp + 1.45, 1.0, '#4a4e58');
    for (const wx of [-0.85, 0.85]) {
      const [cx, cy] = P(bxp + wx, 0.45);
      circlePx(g, cx, cy, 8, '#17121d'); circlePx(g, cx, cy, 6.5, '#555b66'); circlePx(g, cx, cy, 3, '#8a929e'); px(g, Math.round(cx), Math.round(cy), '#17121d');
    }
    // Feder
    for (let k = 0; k < 4; k++) RR(g, P, bxp - 0.25, 0.55 + k * 0.1, bxp + 0.25, 0.6 + k * 0.1, k % 2 ? '#8a929e' : '#5f6673');
  }
}
function paintFrame(g, P, L) {
  RR(g, P, -L / 2, 1.0, L / 2, 1.55, '#17121d');
  RR(g, P, -L / 2 + 0.06, 1.06, L / 2 - 0.06, 1.5, '#2c2f37');
  RR(g, P, -L / 2 + 0.06, 1.42, L / 2 - 0.06, 1.5, '#4a4e58');
  // Puffer
  for (const s of [-1, 1]) { RR(g, P, s > 0 ? L / 2 : -L / 2 - 0.35, 1.1, s > 0 ? L / 2 + 0.35 : -L / 2, 1.45, '#17121d'); RR(g, P, s > 0 ? L / 2 + 0.2 : -L / 2 - 0.35, 1.13, s > 0 ? L / 2 + 0.35 : -L / 2 - 0.2, 1.42, '#9aa3b2'); }
}
function grime(g, P, x0, y0, x1, y1, rnd, n, cols) {
  for (let i = 0; i < n; i++) {
    const [x, y] = P(lerp(x0, x1, rnd()), lerp(y0, y1, rnd()));
    px(g, Math.round(x), Math.round(y), cols[i % cols.length]);
  }
}
function carPainter(kind, L, top, rnd) {
  const col = ['#9c3b2b', '#7a4a32', '#4a6a7e', '#8a2f2f'][rnd() * 4 | 0];
  const cc = ['#2d6fb5', '#c8432f', '#e0a030', '#3d8a4f', '#7a4fa0', '#d06a28'];
  const c1 = cc[rnd() * cc.length | 0], c2 = cc[rnd() * cc.length | 0];
  const seed = rnd() * 1e9 | 0;
  return (g, P, def) => {
    const r = RNG(seed);
    paintWheels(g, P, [-(L / 2 - 2.1), L / 2 - 2.1]);
    paintFrame(g, P, L);
    const K = '#17121d';
    if (kind === 'kasten') {
      const x0 = -L / 2 + 0.2, x1 = L / 2 - 0.2;
      RR(g, P, x0, 1.5, x1, top, K);
      RR(g, P, x0 + 0.06, 1.55, x1 - 0.06, top - 0.06, col);
      for (let x = x0 + 0.7; x < x1 - 0.3; x += 0.75) { RR(g, P, x, 1.6, x + 0.06, top - 0.2, shade(col, -0.25)); RR(g, P, x + 0.06, 1.6, x + 0.11, top - 0.2, shade(col, 0.12)); }
      RR(g, P, x0 + 0.06, top - 0.3, x1 - 0.06, top - 0.06, shade(col, 0.2));
      RR(g, P, x0 + 0.06, top - 0.06, x1 - 0.06, top, '#5f6673');
      // Schiebetür
      RR(g, P, -1.6, 1.6, 1.6, top - 0.4, K); RR(g, P, -1.55, 1.65, 1.55, top - 0.45, shade(col, -0.1));
      for (let y = 2.0; y < top - 0.5; y += 0.5) RR(g, P, -1.55, y, 1.55, y + 0.05, shade(col, -0.3));
      RR(g, P, 1.2, 2.6, 1.35, 3.0, '#c9d3e0');
      RR(g, P, -2.0, top - 0.42, 2.0, top - 0.36, '#3a3d44');
      // Graffiti
      const gc = ['#f2d040', '#52c06a', '#ef5350', '#4f8ff7'][r() * 4 | 0];
      for (let i = 0; i < 26; i++) { const [x, y] = P(x0 + 1 + r() * 2.6, 1.75 + r() * 0.7); box(g, Math.round(x), Math.round(y), 2, 1, i % 4 ? gc : '#ffffff'); }
      grime(g, P, x0, 1.5, x1, top, r, 140, [shade(col, -0.35), shade(col, 0.2), '#5a3a2a']);
    } else if (kind === 'offen') {
      const x0 = -L / 2 + 0.2, x1 = L / 2 - 0.2;
      // Kohle-Haufen
      g.fillStyle = '#1c1c22'; g.beginPath();
      const f = def.fixtures.find(ff => ff.coal);
      f.verts.forEach((v, i) => { const [x, y] = P(v[0], v[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      for (let i = 0; i < 260; i++) { const [x, y] = P(lerp(x0 + 0.3, x1 - 0.3, r()), lerp(2.9, 3.6, r())); px(g, Math.round(x), Math.round(y), r() < 0.5 ? '#3a3a44' : '#2a2a32'); }
      for (const v of f.verts) { const [x, y] = P(v[0], v[1]); if (v[1] > 3.2) { px(g, Math.round(x), Math.round(y), '#5a5a66'); } }
      // Seitenwand
      RR(g, P, x0, 1.5, x1, 3.1, K); RR(g, P, x0 + 0.06, 1.55, x1 - 0.06, 3.05, col);
      for (let x = x0 + 1.2; x < x1 - 0.5; x += 1.4) { RR(g, P, x, 1.55, x + 0.12, 3.05, shade(col, -0.3)); RR(g, P, x + 0.12, 1.55, x + 0.17, 3.05, shade(col, 0.15)); }
      RR(g, P, x0 + 0.06, 2.9, x1 - 0.06, 3.05, shade(col, 0.25));
      // Stirnwände
      for (const s of [-1, 1]) { const xa = s < 0 ? x0 : x1 - 0.32, xb = s < 0 ? x0 + 0.32 : x1; RR(g, P, xa, 1.5, xb, 3.9, K); RR(g, P, xa + 0.05, 1.55, xb - 0.05, 3.85, shade(col, -0.12)); RR(g, P, xa + 0.05, 3.75, xb - 0.05, 3.85, shade(col, 0.25)); }
      grime(g, P, x0, 1.5, x1, 3.1, r, 90, [shade(col, -0.35), shade(col, 0.2)]);
    } else if (kind === 'container') {
      RR(g, P, -L / 2 + 0.1, 1.5, L / 2 - 0.1, 1.8, K); RR(g, P, -L / 2 + 0.15, 1.55, L / 2 - 0.15, 1.75, '#4a4e58');
      const cs = [[-L / 2 + 0.2, -0.05, c1], [0.05, L / 2 - 0.2, c2]];
      for (const [a, b, c] of cs) {
        RR(g, P, a, 1.8, b, top, K); RR(g, P, a + 0.06, 1.86, b - 0.06, top - 0.06, c);
        for (let x = a + 0.25; x < b - 0.2; x += 0.22) RR(g, P, x, 1.95, x + 0.06, top - 0.15, shade(c, -0.2));
        RR(g, P, a + 0.06, top - 0.18, b - 0.06, top - 0.06, shade(c, 0.25));
        RR(g, P, a + 0.06, 1.86, b - 0.06, 1.98, shade(c, -0.3));
        RR(g, P, a + 0.06, 1.86, a + 0.2, top - 0.06, shade(c, -0.35)); RR(g, P, b - 0.2, 1.86, b - 0.06, top - 0.06, shade(c, -0.35));
        RR(g, P, (a + b) / 2 - 0.9, 3.05, (a + b) / 2 + 0.9, 3.4, shade(c, 0.45));
        grime(g, P, a, 1.8, b, top, r, 50, [shade(c, -0.3), '#7a5a3a']);
      }
    } else if (kind === 'kessel') {
      RR(g, P, -L / 2 + 0.1, 1.5, L / 2 - 0.1, 1.8, K); RR(g, P, -L / 2 + 0.15, 1.55, L / 2 - 0.15, 1.75, '#4a4e58');
      const f = def.fixtures.find(ff => ff.tank);
      g.fillStyle = K; g.beginPath(); f.verts.forEach((v, i) => { const [x, y] = P(v[0], v[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      const tc = ['#2a2d36', '#d8d8d0', '#3a5a3a'][r() * 3 | 0];
      g.fillStyle = tc; g.beginPath(); f.verts.forEach((v, i) => { const [x, y] = P(v[0] * 0.985, 1.8 + (v[1] - 1.8) * 0.97); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      RR(g, P, -L / 2 + 0.8, 3.7, L / 2 - 0.8, 4.0, shade(tc, 0.3));
      RR(g, P, -L / 2 + 0.8, 4.05, L / 2 - 0.8, 4.12, shade(tc, 0.5));
      RR(g, P, -L / 2 + 0.8, 1.85, L / 2 - 0.8, 2.25, shade(tc, -0.3));
      for (const x of [-3, 0, 3]) RR(g, P, x - 0.05, 1.85, x + 0.05, 4.2, shade(tc, -0.2));
      RR(g, P, -0.9, 4.42, 0.9, 4.75, K); RR(g, P, -0.8, 4.45, 0.8, 4.7, shade(tc, 0.15));
      RR(g, P, 1.4, 2.4, 2.4, 3.2, K); RR(g, P, 1.45, 2.45, 2.35, 3.15, '#f08a24'); RR(g, P, 1.7, 2.7, 2.1, 2.9, '#ffffff');
      for (let y = 1.9; y < 4.3; y += 0.35) RR(g, P, -0.45, y, 0.45, y + 0.06, '#9aa3b2');
      RR(g, P, -0.5, 1.85, -0.44, 4.4, '#9aa3b2'); RR(g, P, 0.44, 1.85, 0.5, 4.4, '#9aa3b2');
      grime(g, P, -L / 2 + 0.6, 1.9, L / 2 - 0.6, 4.3, r, 70, [shade(tc, -0.25), shade(tc, 0.2)]);
    } else if (kind === 'lok') {
      const red = '#d52b1e', rd = '#9e1e14', rl = '#f0574a';
      const f = def.fixtures.find(ff => ff.nose);
      RR(g, P, -L / 2 + 0.2, 1.5, 5.0, top, K);
      g.fillStyle = K; g.beginPath(); f.verts.forEach((v, i) => { const [x, y] = P(v[0], v[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      RR(g, P, -L / 2 + 0.26, 1.56, 4.95, top - 0.06, red);
      g.fillStyle = red; g.beginPath(); f.verts.forEach((v, i) => { const [x, y] = P(v[0] - (v[0] > 6 ? 0.06 : 0), v[1] + (v[1] < 2 ? 0.06 : v[1] > 4 ? -0.06 : 0)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      RR(g, P, -L / 2 + 0.26, 2.0, 7.3, 2.25, '#e8e8e8');
      RR(g, P, -L / 2 + 0.26, 1.56, 7.3, 1.75, rd);
      RR(g, P, -L / 2 + 0.26, top - 0.25, 4.95, top - 0.06, rl);
      // Lüftungsgitter
      for (let x = -4.6; x < 3.5; x += 1.6) { RR(g, P, x, 2.6, x + 1.1, 3.7, rd); for (let y = 2.7; y < 3.65; y += 0.15) RR(g, P, x + 0.05, y, x + 1.05, y + 0.06, '#5a1410'); }
      // Führerstand-Fenster
      RR(g, P, 5.1, 3.0, 6.4, 3.95, K); RR(g, P, 5.15, 3.05, 6.3, 3.9, '#7ec8f0'); RR(g, P, 5.25, 3.6, 5.7, 3.75, '#d8f2ff');
      RR(g, P, -L / 2 + 0.6, 3.0, -L / 2 + 1.6, 3.95, K); RR(g, P, -L / 2 + 0.65, 3.05, -L / 2 + 1.55, 3.9, '#7ec8f0');
      RR(g, P, 7.0, 1.9, 7.3, 2.1, '#fff3a0');
      // Stromabnehmer
      for (const x of [-3.5, 2.5]) {
        RR(g, P, x - 0.6, top, x + 0.6, top + 0.15, K);
        const [ax, ay] = P(x - 0.4, top + 0.15), [bx2, by] = P(x + 0.3, top + 1.1), [cx, cy] = P(x - 0.2, top + 1.6);
        g.strokeStyle = '#3a3d44'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by); g.lineTo(cx, cy); g.stroke();
        RR(g, P, x - 0.7, top + 1.6, x + 0.5, top + 1.68, '#3a3d44');
      }
      grime(g, P, -L / 2 + 0.3, 1.6, 4.9, top - 0.1, r, 50, [rd, rl]);
    }
  };
}
function buildZug(sim, rnd) {
  const mid = ['offen', 'container', 'kessel', 'kasten', 'container', 'offen', 'kessel', 'kasten'];
  for (let i = mid.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [mid[i], mid[j]] = [mid[j], mid[i]]; }
  const kinds = ['kasten', ...mid.slice(0, 7), 'lok'];
  const cars = [];
  let x = 0;
  const GAP = 1.6;
  kinds.forEach((kind, i) => {
    const L = kind === 'lok' ? 15 : 12;
    const top = { kasten: 4.4, offen: 3.9, container: 4.3, kessel: 4.45, lok: 4.3 }[kind];
    const fx = [rc(-L / 2, 1.0, L / 2, 1.55, 'dunkel')];
    let standY = top;
    if (kind === 'kasten') fx.push(rc(-L / 2 + 0.2, 1.5, L / 2 - 0.2, top, 'holz'));
    else if (kind === 'offen') {
      const x0 = -L / 2 + 0.5, x1 = L / 2 - 0.5;
      fx.push(rc(-L / 2 + 0.2, 1.5, x0 - 0.18, 3.9, 'stahl'), rc(x1 + 0.18, 1.5, L / 2 - 0.2, 3.9, 'stahl'));
      // Kohlehaufen: Physik als zwei Polygone (max 8 Ecken), Grafik als ein Polygon
      fx.push(poly([[x0 - 0.18, 1.5], [0, 1.5], [0, 3.55], [-1.6, 3.45], [-3.2, 3.6], [x0 - 0.18, 3.3]], 'dunkel', { friction: 0.8 }));
      fx.push(poly([[0, 1.5], [x1 + 0.18, 1.5], [x1 + 0.18, 3.3], [3.4, 3.55], [1.5, 3.4], [0, 3.55]], 'dunkel', { friction: 0.8 }));
      fx.push({ decoOnly: true, coal: true, mat: 'dunkel', verts: [[x0 - 0.18, 1.5], [x1 + 0.18, 1.5], [x1 + 0.18, 3.3], [3.4, 3.55], [1.5, 3.4], [0, 3.55], [-1.6, 3.45], [-3.2, 3.6], [x0 - 0.18, 3.3]] });
      standY = 3.55;
    } else if (kind === 'container') fx.push(rc(-L / 2 + 0.1, 1.5, L / 2 - 0.1, 1.8, 'dunkel'), rc(-L / 2 + 0.2, 1.8, L / 2 - 0.2, top, 'blech'));
    else if (kind === 'kessel') {
      const h = L / 2 - 0.6;
      fx.push(rc(-L / 2 + 0.1, 1.5, L / 2 - 0.1, 1.8, 'dunkel'));
      fx.push(poly([[-h, 1.8], [h, 1.8], [h, 3.6], [h - 0.4, 4.2], [h - 1.2, 4.45], [-h + 1.2, 4.45], [-h + 0.4, 4.2], [-h, 3.6]], 'dunkel', { tank: true, friction: 0.35 }));
    } else if (kind === 'lok') {
      fx.push(rc(-L / 2 + 0.2, 1.5, 5.0, top, 'stahl'));
      fx.push(poly([[5.0, 1.5], [7.4, 1.5], [7.4, 3.0], [6.5, top], [5.0, top]], 'stahl', { nose: true }));
    }
    const cx = x + L / 2;
    const mb = sim.addBody({ type: 'kinematic', x: cx, y: 0, fixtures: fx, friction: 0.85, paint: carPainter(kind, L, top, rnd), bounds: [-L / 2 - 0.4, 0, L / 2 + 0.4, top + 1.8], tag: 'car' });
    cars.push({ mb, kind, L, x: cx, top, standY, phase: i * 1.7 });
    x += L + GAP;
  });
  const end = x - GAP;
  const loco = cars[cars.length - 1];
  // Gefahren: Signalbrücke und Tunnel
  const gantry = sim.addBody({ type: 'kinematic', x: 400, y: 0, layer: -1, fixtures: [rc(-0.5, 6.15, 0.5, 6.75, 'stahl', { friction: 0.2 })],
    bounds: [-0.6, 0, 0.6, 7.6], paint: (g, P) => {
      const K = '#17121d';
      RR(g, P, -0.25, 0, 0.25, 6.2, K); RR(g, P, -0.2, 0, 0.2, 6.2, '#4a4e58');
      for (let y = 0.3; y < 6.1; y += 0.5) { const [a, b] = P(-0.2, y), [c, d] = P(0.2, y + 0.5); g.strokeStyle = '#2a2d34'; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
      RR(g, P, -0.5, 6.15, 0.5, 6.75, K); RR(g, P, -0.45, 6.2, 0.45, 6.7, '#c4532c'); RR(g, P, -0.45, 6.6, 0.45, 6.7, '#e07448');
      RR(g, P, -0.35, 6.75, 0.35, 7.5, K); RR(g, P, -0.3, 6.8, 0.3, 7.45, '#2a2d34');
      circlePx(g, ...P(0, 7.25), 2, '#ff4040'); circlePx(g, ...P(0, 6.98), 2, '#40ff70');
    } });
  const tunnel = sim.addBody({ type: 'kinematic', x: 500, y: 0, layer: -1, fixtures: [rc(0, 6.05, 70, 9.5, 'fels', { friction: 0.05 })],
    bounds: [-1.6, 0, 71.6, 11], paint: (g, P) => {
      const r = RNG(77);
      RR(g, P, 0, 0, 70, 9.5, '#24201e');
      for (let yy = 0.2; yy < 6; yy += 0.45) for (let xx = (yy * 3 % 1); xx < 70; xx += 1.1) RR(g, P, xx, yy, xx + 1.0, yy + 0.38, r() < 0.5 ? '#2e2926' : '#2a2522');
      for (let xx = 4; xx < 70; xx += 9) { RR(g, P, xx, 5.3, xx + 0.5, 5.6, '#f2d488'); RR(g, P, xx - 0.3, 5.0, xx + 0.8, 5.3, 'rgba(242,212,136,0.25)'); }
      RR(g, P, 0, 6.05, 70, 9.5, '#3a3430');
      for (const ex of [0, 70]) {
        RR(g, P, ex - 1.5, 0, ex + 1.5, 11, '#17121d'); RR(g, P, ex - 1.4, 0, ex + 1.4, 10.9, '#8a8478');
        for (let yy = 0.3; yy < 10.8; yy += 0.6) RR(g, P, ex - 1.4, yy, ex + 1.4, yy + 0.07, '#6a655c');
        for (let yy = 0; yy < 10.8; yy += 1.2) RR(g, P, ex - 0.05 + (yy % 2.4 ? 0.6 : -0.6), yy, ex + 0.02 + (yy % 2.4 ? 0.6 : -0.6), yy + 0.6, '#6a655c');
        RR(g, P, ex - 1.5, 10.6, ex + 1.5, 11, '#5f9a4a');
      }
    } });
  const hz = { next: 7 + rnd() * 3, gantryOn: false, tunnelOn: false, lastTunnel: 0, bump: -10, bumpNext: 5 };
  const spots = [];
  cars.forEach((c, i) => { if (i > 0) { spots.push({ mb: c.mb, x: -2.8, y: c.standY + 0.5 }); spots.push({ mb: c.mb, x: 2.6, y: c.standY + 0.5 }); } });
  const cps = [0, 2, 4, 6].map(i => ({ x: cars[i].x - cars[i].L / 2, car: cars[i] }));
  const map = {
    minX: -3, maxX: end + 3, killY: 1.15, camMinY: -0.6, camMaxY: 15, startX: cars[0].x, goalX: loco.x + 1,
    cps, spots, maxPickups: 6, cars, hzBodies: [gantry, tunnel], deathText: { sturz: 'vom Zug gefallen' },
    spawn(sim, cpi, idx) {
      const c = cps[clamp(cpi, 0, cps.length - 1)].car;
      const p = c.mb.body.getWorldPoint(V2(-3 + idx * 1.3, c.standY + 0.9));
      return { x: p.x, y: p.y };
    },
    goal() { const p = loco.mb.body.getPosition(); return { x0: p.x + 0.3, x1: p.x + 1.9, y0: loco.top + 0.6, y1: loco.top + 4 }; },
    update(sim, t, dt) {
      // Schienenstösse laufen von vorne nach hinten durch den Zug
      hz.bumpNext -= dt;
      if (hz.bumpNext <= 0) { hz.bump = t; hz.bumpNext = 6 + sim.rng() * 5; }
      for (const c of cars) {
        let y = 0.035 * Math.sin(t * 8.1 + c.phase) + 0.02 * Math.sin(t * 13.7 + c.phase * 2);
        let a = 0.008 * Math.sin(t * 3.3 + c.phase);
        const tb = t - hz.bump - (end - c.x) / ZUG_V;
        if (tb > 0 && tb < 0.4) { const k = Math.sin(tb / 0.4 * Math.PI); y += 0.17 * k; a += 0.025 * k * Math.sin(tb * 30); }
        drive(c.mb.body, c.x, y, a, dt);
      }
      // Gefahren
      const live = sim.phase !== 'countdown';
      for (const h of [gantry, tunnel]) {
        const p = h.body.getPosition();
        if (h.state !== 3 && p.x < map.minX - (h === tunnel ? 80 : 10)) { h.body.setTransform(V2(500, 0), 0); h.body.setLinearVelocity(V2(0, 0)); h.state = 3; }
        else if (h.state !== 3) h.body.setLinearVelocity(V2(-ZUG_V, 0));
      }
      if (gantry.state === 0 && gantry.body.getPosition().x > 300) gantry.state = 3;
      if (tunnel.state === 0 && tunnel.body.getPosition().x > 300) tunnel.state = 3;
      if (live && gantry.state === 3 && tunnel.state === 3) {
        hz.next -= dt;
        if (hz.next <= 0) {
          const useTunnel = t - hz.lastTunnel > 22 && sim.rng() < 0.45;
          const h = useTunnel ? tunnel : gantry;
          if (useTunnel) hz.lastTunnel = t;
          h.state = 0;
          h.body.setTransform(V2(map.maxX + 2 * ZUG_V, 0), 0);
          h.body.setLinearVelocity(V2(-ZUG_V, 0));
          hz.next = 5 + sim.rng() * 5;
        }
      }
    },
    hazards() {
      const out = [];
      const g = gantry.body.getPosition();
      if (gantry.state !== 3) out.push({ x0: g.x - 0.5, x1: g.x + 0.5, yb: 6.15, vx: -ZUG_V });
      const tp = tunnel.body.getPosition();
      if (tunnel.state !== 3) out.push({ x0: tp.x, x1: tp.x + 70, yb: 6.05, vx: -ZUG_V });
      return out;
    },
    drawBack(ctx, cam, view) {
      const T = zugTheme();
      const sc = view.t * ZUG_V * PPM;
      drawSky(ctx, cam, T.sky);
      drawLayer(ctx, T.clouds, cam, 0.02, sc * 0.004, 12, 0.08);
      drawLayer(ctx, T.alps, cam, 0.03, sc * 0.01, 1.5, 0.12);
      drawLayer(ctx, T.alps2, cam, 0.06, sc * 0.03, 0.8, 0.2);
      drawLayer(ctx, T.hills, cam, 0.12, sc * 0.08, 0.5, 0.35);
      // Gleisbett, Masten (fahren mit Zuggeschwindigkeit vorbei)
      const y = Math.round(cam.y - 0.25 * PPM);
      ctx.fillStyle = '#6a9e48'; ctx.fillRect(0, y - 40, cam.w, 40);
      drawLayer(ctx, T.near, cam, 0.5, sc * 0.45, 0.1, 0.75);
      let off = -((cam.x + sc) % T.bed.width); if (off > 0) off -= T.bed.width;
      for (let x = Math.round(off); x < cam.w; x += T.bed.width) ctx.drawImage(T.bed, x, y);
      if (y + T.bed.height < cam.h) { ctx.fillStyle = '#4a5e32'; ctx.fillRect(0, y + T.bed.height, cam.w, cam.h - y - T.bed.height); }
      const mastGap = 34 * PPM;
      let mo = -((cam.x + sc) % mastGap); if (mo > 0) mo -= mastGap;
      for (let x = Math.round(mo); x < cam.w + 30; x += mastGap) ctx.drawImage(T.mast, x, y - T.mast.height + 6);
      ctx.fillStyle = '#2a2d34';
      ctx.fillRect(0, Math.round(cam.y - 8.2 * PPM), cam.w, 1);
      ctx.fillRect(0, Math.round(cam.y - 7.6 * PPM), cam.w, 1);
    },
    drawMid(ctx, cam, view, M) {
      // Fluchthelikopter über der Lok
      const lp = M[loco.mb.mi];
      const hx = lp[0] + 1.1, hy = loco.top + 4.6 + Math.sin(view.t * 1.7) * 0.15;
      const sx = Math.round(hx * PPM - cam.x), sy = Math.round(cam.y - hy * PPM);
      // Strickleiter aus der offenen Tür
      const lx = sx - 3, ly0 = sy, ly1 = Math.round(cam.y - (loco.top + 0.9) * PPM);
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(lx, ly0, 1, ly1 - ly0); ctx.fillRect(lx + 6, ly0, 1, ly1 - ly0);
      for (let y = ly0 + 3; y < ly1; y += 4) ctx.fillRect(lx, y, 7, 1);
      ctx.drawImage(HELI, sx - 72, sy - 26);
      drawRotor(ctx, sx, sy - 25, view.t);
    },
    drawFront(ctx, cam, view, M) {
      const tp = M[tunnel.mi];
      if (tp[3] !== 3) {
        const x0 = Math.round(tp[0] * PPM - cam.x), x1 = Math.round((tp[0] + 70) * PPM - cam.x);
        if (x1 > 0 && x0 < cam.w) { ctx.fillStyle = 'rgba(8,8,16,0.38)'; ctx.fillRect(Math.max(0, x0), 0, Math.min(cam.w, x1) - Math.max(0, x0), cam.h); }
      }
      // Warnung vor herannahenden Gefahren
      for (const h of [gantry, tunnel]) {
        const p = M[h.mi];
        if (p[3] === 3) continue;
        const sx = p[0] * PPM - cam.x;
        if (sx > cam.w && sx < cam.w + ZUG_V * PPM * 2.2) {
          const blink = Math.floor(view.t * 6) % 2;
          const y = Math.round(cam.y - 6.4 * PPM);
          if (blink) ctx.drawImage(WARN, cam.w - 16, y - 5);
          ctx.fillStyle = '#f2c94c'; ctx.fillRect(cam.w - 22, y, 4, 1); ctx.fillRect(cam.w - 21, y - 1, 1, 3);
        }
      }
    },
  };
  return map;
}
const _flipCache = new Map();
function flipX_cached(img) { if (!_flipCache.has(img)) _flipCache.set(img, flipX(img)); return _flipCache.get(img); }
function drawRotor(ctx, x, y, t) {
  const f = Math.floor(t * 30) % 4;
  const w = [58, 40, 18, 40][f];
  ctx.fillStyle = '#17121d'; ctx.fillRect(x - w, y, w * 2, 2);
  ctx.fillStyle = 'rgba(40,40,50,0.35)'; ctx.fillRect(x - 58, y, 116, 1);
}

// ------------------------------------------------------------
//  Karte 2: Frachtflugzeug
// ------------------------------------------------------------
const planeTheme = theme('flug', () => {
  const sky = skyCanvas([[0, '#16407e'], [0.45, '#3d7fcf'], [1, '#a9d6f4']]);
  const far = cloudLayer(640, 120, 9, 3, '#f4f8fc', '#c8dcee', 20, 100, 20, 60);
  const near = cloudLayer(800, 160, 6, 8, '#ffffff', '#d4e4f2', 30, 140, 60, 140);
  const [sea, sg] = mkCanvas(512, 80);
  { const r = RNG(5); box(sg, 0, 20, 512, 60, '#e8f0f8');
    for (let x = 0; x < 512; x += 1) { const h = 20 - Math.round(6 + Math.sin(x * 0.05) * 4 + Math.sin(x * 0.17) * 2); box(sg, x, h, 1, 22 - h, '#f6fafd'); }
    for (let i = 0; i < 300; i++) px(sg, r() * 512 | 0, 22 + r() * 58 | 0, '#d4e2ee'); }
  return { sky, far, near, sea };
});
function paintRumpf(g, P, def) {
  const K = '#17121d';
  const hull = '#c6ccd4', hullD = '#8e96a2', hullL = '#e4e8ee';
  // Aussenhaut oben und unten
  g.fillStyle = K;
  g.beginPath();
  const pts = [[-46, -0.5], [-44.5, 2.6], [-41, 4.2], [30, 4.4], [36, 4.2], [44, 6.6], [47.5, 9.4], [49.5, 9.4], [48, 4.0], [38, 3.1], [-40.8, 3.1], [-40.8, -3.1], [36, -3.1], [36, -3.6], [30, -4.6], [-38, -4.6], [-43.5, -3.2]];
  pts.forEach((v, i) => { const [x, y] = P(v[0], v[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
  g.fillStyle = hull;
  g.beginPath();
  pts.forEach((v, i) => { const [x, y] = P(v[0] + (v[0] < -40 ? 0.08 : v[0] > 47 ? -0.08 : 0), v[1] + (v[1] > 0 ? -0.08 : 0.08)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
  RR(g, P, -41, 3.7, 36, 3.85, hullL);
  RR(g, P, -38, -4.4, 30, -4.25, hullD);
  RR(g, P, -40, 3.15, 36, 3.3, hullD);
  // Fenster im Cockpit (Nase)
  RR(g, P, -44.2, 1.0, -42.6, 2.0, '#2a3a4a'); RR(g, P, -44, 1.15, -42.8, 1.85, '#7ec8f0');
  // Innenraum: Rückwand mit Spanten und Fenstern
  RR(g, P, -40.3, -2.5, 36.6, 2.5, '#59616d');
  for (let x = -40; x < 36; x += 0.5) RR(g, P, x, -2.5, x + 0.03, 2.5, '#535a66');
  for (let x = -39; x < 36; x += 2) {
    RR(g, P, x, -2.5, x + 0.25, 2.5, '#454b56'); RR(g, P, x + 0.25, -2.5, x + 0.32, 2.5, '#6c7581');
  }
  RR(g, P, -40.3, 1.6, 36.6, 1.72, '#454b56'); RR(g, P, -40.3, -0.6, 36.6, -0.5, '#454b56');
  // Isolations-Polster
  for (let x = -38.7; x < 35; x += 2) { RR(g, P, x + 0.15, -0.45, x + 1.55, 1.5, '#7a8a72'); RR(g, P, x + 0.15, 1.4, x + 1.55, 1.5, '#8e9e84'); for (let y = -0.2; y < 1.4; y += 0.45) RR(g, P, x + 0.15, y, x + 1.55, y + 0.05, '#6a7a62'); }
  // Fenster (durchsichtig -> Himmel)
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (let x = -37.7; x < 34; x += 4) { const [cx, cy] = P(x + 0.85, 0.55); g.beginPath(); g.ellipse(cx, cy, 5, 6, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  for (let x = -37.7; x < 34; x += 4) { const [cx, cy] = P(x + 0.85, 0.55); g.strokeStyle = '#2a2d34'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, 6, 7, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#a7b1be'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, 7, 8, 0, Math.PI * 0.9, Math.PI * 1.6); g.stroke(); }
  // Klappsitze (rot) entlang der Wand
  for (let x = -37; x < 33; x += 5.5) { if (Math.abs(x + 5.75) < 1.5 || Math.abs(x - 26) < 1.5) continue;
    RR(g, P, x, -1.75, x + 2.4, -1.6, '#7a1e1e'); for (let k = 0; k < 4; k++) RR(g, P, x + 0.1 + k * 0.58, -1.6, x + 0.5 + k * 0.58, -0.9, '#b03030');
    RR(g, P, x, -2.5, x + 0.08, -1.6, '#3a3d44'); RR(g, P, x + 2.3, -2.5, x + 2.38, -1.6, '#3a3d44'); }
  // Leitungen an der Decke
  RR(g, P, -40.3, 2.1, 36.6, 2.22, '#9aa3b2'); RR(g, P, -40.3, 2.3, 36.6, 2.38, '#c8432f'); RR(g, P, -40.3, 1.95, 36.6, 2.0, '#f2c94c');
  for (let x = -39; x < 36; x += 6) { RR(g, P, x, 2.0, x + 0.6, 2.45, '#3a3d44'); RR(g, P, x + 0.1, 2.05, x + 0.5, 2.15, '#fff3a0'); }
  // Gurt-Anzeigen (werden bei Turbulenz beleuchtet)
  for (const x of def.signs) { RR(g, P, x - 0.45, 1.8, x + 0.45, 2.15, K); RR(g, P, x - 0.4, 1.85, x + 0.4, 2.1, '#3a3020'); }
  // Fallschirme an der Wand beim Heck
  // Ladenetz
  for (let x = -20.5; x < -15.5; x += 0.35) RR(g, P, x, -1.4, x + 0.04, 1.2, '#2a2d34');
  for (let y = -1.3; y < 1.2; y += 0.35) RR(g, P, -21, y, -15.5, y + 0.04, '#2a2d34');
  // Fixe Bauteile (Physik)
  paintFixtures(g, def.fixtures.filter(f => !f.hide), P);
  // Cockpit-Tür
  RR(g, P, -40.3, -2.5, -39.2, 1.0, K); RR(g, P, -40.25, -2.45, -39.3, 0.95, '#6c7581'); RR(g, P, -40.1, 0.1, -39.5, 0.7, '#7ec8f0');
  // Heck: offene Rampe -> Kanten
  RR(g, P, 36.6, -2.5, 37.0, 3.1, K); RR(g, P, 36.65, -2.45, 36.95, 3.05, '#8e96a2');
  // Notausgang-Schild (grünes Männchen)
  RR(g, P, 33.2, 1.5, 34.6, 2.1, K); RR(g, P, 33.25, 1.55, 34.55, 2.05, '#2e9e4e');
  const [mx, my] = P(33.5, 2.0); px(g, mx + 4, my + 1, '#fff'); box(g, mx + 3, my + 3, 3, 1, '#fff'); px(g, mx + 4, my + 4, '#fff'); px(g, mx + 3, my + 5, '#fff'); px(g, mx + 5, my + 5, '#fff'); box(g, mx + 10, my + 2, 6, 5, '#fff'); box(g, mx + 11, my + 3, 4, 3, '#2e9e4e');
  for (let i = 0; i < 3; i++) { const [cx, cy] = P(30.5 + i * 0.75, 1.5); g.drawImage(CHUTE, Math.round(cx), Math.round(cy)); }
}
function buildFlug(sim, rnd) {
  const PX = 40, PY = 8;
  const signs = [-30, -12, 6, 22];
  const fx = [
    rc(-40.8, -3.1, 36, -2.5, 'blech', { friction: 0.6 }),
    rc(-40.8, 2.5, 38, 3.1, 'blech'),
    rc(-40.8, -2.5, -40.3, 2.5, 'blech', { hide: true }),
    poly([[36, -3.1], [44, -4.15], [44, -3.75], [36, -2.5]], 'blech', { friction: 0.6 }),
    rc(-30, -2.5, -27, -1.55, 'dunkel'),
    rc(-21, -2.5, -15.5, -1.4, 'stahl'),
    rc(-6, 0.5, -5.45, 2.5, 'blech'),
    rc(6, -2.5, 10, -1.85, 'dunkel'),
    rc(16.5, -2.5, 19.5, -1.35, 'stahl'),
    rc(26, 0.6, 26.55, 2.5, 'blech'),
  ];
  const fus = sim.addBody({ type: 'kinematic', x: PX, y: PY, fixtures: fx, friction: 0.6, paint: paintRumpf, signs, bounds: [-46.2, -4.8, 49.8, 9.6], tag: 'rumpf' });
  // Lose Fracht
  const props = [];
  const crate = (lx, ly, w, h, mat, extra) => {
    const p = fus.body.getWorldPoint(V2(lx, ly));
    const mb = sim.addBody(Object.assign({ type: 'dynamic', x: p.x, y: p.y, cat: CAT.PROP, fixtures: [bx(w, h, 0, 0, mat, extra)], friction: 0.06, density: 0.9, angDamp: 0.3 }, extra || {}));
    mb.lhome = { x: lx, y: ly };
    props.push(mb);
    return mb;
  };
  const crPaint = (w, h, col) => (g, P, def) => {
    paintFixtures(g, def.fixtures, P);
    RR(g, P, -w / 2 + 0.08, -0.05, w / 2 - 0.08, 0.05, col);
    RR(g, P, -0.05, -h / 2 + 0.08, 0.05, h / 2 - 0.08, col);
  };
  crate(-24, -1.95, 1.05, 1.05, 'holz', { paint: crPaint(1.05, 1.05, '#c8432f') });
  crate(-11, -1.95, 1.05, 1.05, 'holz', { paint: crPaint(1.05, 1.05, '#2d6fb5') });
  crate(1.5, -1.95, 1.05, 1.05, 'holz', { paint: crPaint(1.05, 1.05, '#c8432f') });
  crate(13, -2.0, 0.95, 0.95, 'holz', { paint: crPaint(0.95, 0.95, '#3d8a4f') });
  crate(23, -1.95, 1.05, 1.05, 'holz', { paint: crPaint(1.05, 1.05, '#e0a030') });
  // Fässer (rollen)
  for (const lx of [-2.5, 14.8, 31]) {
    const p = fus.body.getWorldPoint(V2(lx, -2.05));
    const mb = sim.addBody({ type: 'dynamic', x: p.x, y: p.y, cat: CAT.PROP, fixtures: [circ(0.42, 0, 0, 'stahl')], friction: 0.5, density: 0.8,
      paint: (g, P) => { const [cx, cy] = P(0, 0); circlePx(g, cx, cy, 8, '#17121d'); circlePx(g, cx, cy, 7, '#c8432f'); circlePx(g, cx, cy, 4, '#a03028'); box(g, cx - 1, cy - 7, 2, 14, '#e8e8e8'); circlePx(g, cx - 3, cy - 3, 1, '#f08070'); } });
    mb.lhome = { x: lx, y: -2.05 }; props.push(mb);
  }
  // Rollcontainer (schwer, fast ohne Reibung)
  {
    const p = fus.body.getWorldPoint(V2(-9.5, -1.85));
    const mb = sim.addBody({ type: 'dynamic', x: p.x, y: p.y, cat: CAT.PROP, fixtures: [bx(2.8, 1.3, 0, 0, 'blech')], friction: 0.015, density: 2.6,
      paint: (g, P, def) => { RRo(g, P, -1.4, -0.65, 1.4, 0.65, '#9aa3b2', '#17121d'); for (let x = -1.2; x < 1.3; x += 0.3) RR(g, P, x, -0.5, x + 0.06, 0.5, '#7d8794'); RR(g, P, -1.35, 0.5, 1.35, 0.6, '#c8d2dc'); RR(g, P, -1.0, -0.15, 1.0, 0.15, '#f2c94c'); for (const x of [-1.0, 1.0]) { const [cx, cy] = P(x, -0.6); circlePx(g, cx, cy, 3, '#17121d'); } } });
    mb.lhome = { x: -9.5, y: -1.85 }; props.push(mb);
  }
  const st = { turbNext: 7 + rnd() * 4, turbT: -10, pocket: false, warn: 0 };
  const spotsL = [[-35, -2], [-28.5, -1.2], [-18, -1.0], [-12.5, -2], [-3.5, -2], [3.5, -2], [8, -1.5], [12, -2], [18, -1], [22, -2], [29, -2], [33, -2]];
  const spots = spotsL.map(([x, y]) => ({ mb: fus, x, y: y + 0.2 }));
  const cpsL = [[-37.5, -1.6], [-23, -1.6], [-8, -1.6], [8, -1.0], [21, -1.6]];
  const cps = cpsL.map(([lx, ly]) => ({ x: PX + lx - 1, lx, ly }));
  const pose = (t) => {
    let a = 0.1 * Math.sin(t * 0.45) + 0.05 * Math.sin(t * 1.13 + 1.3);
    let y = PY + 0.3 * Math.sin(t * 0.8);
    const k = t - st.turbT;
    if (k > 0 && k < 3) {
      const env = Math.sin(k / 3 * Math.PI);
      a += env * (0.06 * Math.sin(t * 8.5) + 0.035 * Math.sin(t * 13.1));
      y += env * 0.2 * Math.sin(t * 10.3);
      if (st.pocket) y -= 1.6 * (k < 0.6 ? (k / 0.6) * (k / 0.6) : Math.max(0, 1 - (k - 0.6) / 2.4));
    }
    return { x: PX, y, a };
  };
  { const p0 = pose(0); fus.body.setTransform(V2(p0.x, p0.y), p0.a); for (const pr of props) { const w = fus.body.getWorldPoint(V2(pr.lhome.x, pr.lhome.y)); pr.body.setTransform(w, p0.a); } }
  const map = {
    minX: -8, maxX: 92, killY: -4, camMinY: 0.5, camMaxY: 15.5, startX: PX - 38, goalX: PX + 40,
    cps, spots, maxPickups: 6, fus, deathText: { sturz: 'aus dem Flugzeug gefallen' },
    spawn(sim, cpi, idx) {
      const c = cps[clamp(cpi, 0, cps.length - 1)];
      const p = fus.body.getWorldPoint(V2(c.lx + idx * 1.0, c.ly));
      const v = fus.body.getLinearVelocityFromWorldPoint(p);
      return { x: p.x, y: p.y, vx: v.x, vy: v.y };
    },
    goal() {
      const a = fus.body.getWorldPoint(V2(39.5, -4.2)), b = fus.body.getWorldPoint(V2(44.5, -0.5));
      return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
    },
    dead(sim, p) {
      const l = fus.body.getLocalPoint(p.body.getPosition());
      if (l.x > 45.5 || l.y < -5.5 || l.y > 5 || l.x < -42) return 'sturz';
      return null;
    },
    update(sim, t, dt) {
      if (sim.phase !== 'countdown') {
        st.turbNext -= dt;
        if (st.turbNext <= 0) { st.turbT = t + 1.6; st.pocket = sim.rng() < 0.5; st.turbNext = 9 + sim.rng() * 6; }
      }
      st.warn = (t > st.turbT - 1.6 && t < st.turbT + 3) ? (st.pocket ? 2 : 1) : 0;
      const p = pose(t);
      drive(fus.body, p.x, p.y, p.a, dt);
      for (const pr of props) {
        const l = fus.body.getLocalPoint(pr.body.getPosition());
        if (l.x > 46 || l.y < -6 || l.x < -41 || l.y > 4) {
          const w = fus.body.getWorldPoint(V2(pr.lhome.x, pr.lhome.y + 0.3));
          pr.body.setTransform(w, fus.body.getAngle());
          pr.body.setLinearVelocity(fus.body.getLinearVelocityFromWorldPoint(w)); pr.body.setAngularVelocity(0);
        }
      }
    },
    netState() { return st.warn; },
    hazards() { return []; },
    drawBack(ctx, cam, view) {
      const T = planeTheme();
      const sc = -view.t * 60 * PPM;
      drawSky(ctx, cam, T.sky);
      // Sonne
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(Math.round(cam.w * 0.8), 34, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(cam.w * 0.8), 34, 10, 0, Math.PI * 2); ctx.fill();
      drawLayer(ctx, T.far, cam, 0.05, sc * 0.05, 14, 0.15);
      drawLayer(ctx, T.sea, cam, 0.1, sc * 0.08, -2, 0.3);
      drawLayer(ctx, T.near, cam, 0.3, sc * 0.4, -0.5, 0.5);
    },
    drawMid(ctx, cam, view, M) {
      // Fallschirm-Symbol über dem Ziel
    },
    drawFront(ctx, cam, view, M) {
      const f = M[fus.mi];
      // Gurt-Zeichen leuchten bei Turbulenz
      if (view.H) {
        const blink = Math.floor(view.t * 4) % 2 === 0;
        const ca = Math.cos(f[2]), sa = Math.sin(f[2]);
        for (const x of signs) {
          const wx = f[0] + ca * x - sa * 1.97, wy = f[1] + sa * x + ca * 1.97;
          const sx = Math.round(wx * PPM - cam.x), sy = Math.round(cam.y - wy * PPM);
          ctx.fillStyle = blink ? '#ffd040' : '#a07a20'; ctx.fillRect(sx - 6, sy - 2, 13, 4);
          ctx.fillStyle = '#3a3020'; ctx.fillRect(sx - 3, sy - 1, 1, 2); ctx.fillRect(sx + 3, sy - 1, 1, 2); ctx.fillRect(sx - 2, sy, 5, 1);
        }
      }
    },
  };
  return map;
}

// ------------------------------------------------------------
//  Karte 3: Baustelle
// ------------------------------------------------------------
const bauTheme = theme('bau', () => {
  const sky = skyCanvas([[0, '#2b1d4e'], [0.35, '#7a2e6a'], [0.7, '#e2604a'], [1, '#ffc46a']]);
  const city = (seed, col, lit, hmin, hmax, H) => {
    const [c, g] = mkCanvas(512, H); const r = RNG(seed);
    let x = 0;
    while (x < 512) {
      const w = 14 + r() * 26 | 0, h = hmin + r() * (hmax - hmin) | 0;
      box(g, x, H - h, Math.min(w, 512 - x), h, col);
      if (r() < 0.3) box(g, x + w / 2 - 1, H - h - 6, 2, 6, col);
      for (let yy = H - h + 4; yy < H - 3; yy += 4) for (let xx = x + 3; xx < x + w - 2; xx += 4) if (r() < 0.35) px(g, xx, yy, lit);
      x += w + (r() * 4 | 0);
    }
    return c;
  };
  const far = city(3, '#4a2a5a', '#ffd88a', 30, 90, 110);
  const midc = city(8, '#2e1a3a', '#ffcf6a', 20, 70, 90);
  const [cranes, cg] = mkCanvas(640, 140);
  for (const [x, h, jl] of [[120, 120, 90], [420, 100, 70]]) {
    box(cg, x, 140 - h, 3, h, '#1e1228');
    for (let y = 140 - h; y < 140; y += 4) px(cg, x + 1, y, '#3a2448');
    box(cg, x - 20, 140 - h, jl + 20, 2, '#1e1228'); box(cg, x - 18, 140 - h - 5, 10, 5, '#1e1228');
    box(cg, x + jl - 30, 140 - h + 2, 1, 30, '#1e1228');
  }
  return { sky, far, midc, cranes };
});
function scaffoldDeco(w, h) {
  const [c, g] = mkCanvas(w * PPM + 2, h * PPM + 2);
  const W = c.width, H = c.height, col = '#9aa3b2', d = '#4a4e58';
  for (let x = 1; x < W; x += 1.5 * PPM) { box(g, Math.round(x), 0, 2, H, d); box(g, Math.round(x), 0, 1, H, col); }
  for (let y = 4; y < H; y += 2 * PPM) { box(g, 0, y, W, 2, d); box(g, 0, y, W, 1, col); }
  g.strokeStyle = d; g.lineWidth = 1;
  for (let x = 1; x + 1.5 * PPM < W; x += 1.5 * PPM) for (let y = 4; y + 2 * PPM < H; y += 2 * PPM) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5 * PPM, y + 2 * PPM); g.stroke(); }
  return c;
}
function pitDeco(w, depth) {
  const [c, g] = mkCanvas(w * PPM, depth * PPM);
  const r = RNG(w * 31 | 0);
  ditherGradFast(g, 0, 0, c.width, c.height, [[0, '#2a1e18'], [1, '#0e0a08']]);
  const by = c.height - 14;
  box(g, 0, by + 6, c.width, 8, '#3a2a1e');
  for (let x = 2; x < c.width - 2; x += 5 + (r() * 3 | 0)) { const h = 8 + r() * 8 | 0; box(g, x, by + 6 - h, 1, h, '#8a4a2a'); px(g, x, by + 6 - h, '#c87a4a'); }
  return c;
}
function buildBau(sim, rnd) {
  const killY = -5.5;
  sim.addBody({ fixtures: [rc(-3, -8, 14, 0, 'beton')], tag: 'boden' });
  sim.addBody({ fixtures: [rc(26, -8, 40, 0, 'beton'), rc(31, 0, 34, 1.0, 'beton'), rc(34, 0, 40, 2.0, 'beton')] });
  sim.addBody({ fixtures: [rc(46, 1.6, 50, 2.0, 'stahl'), rc(47.4, -8, 48.6, 1.6, 'stahl')] });
  sim.addBody({ fixtures: [rc(62, -8, 80, 2.0, 'beton')] });
  sim.addBody({ fixtures: [rc(86, -8, 107, 0.6, 'beton')] });
  // Gruben (Deko)
  for (const [a, b, top] of [[14, 26, 0], [40, 46, 0], [50, 62, 0], [80, 86, 0]]) sim.addDeco(pitDeco(b - a, 8), (a + b) / 2, -4.5, -2);
  // Einsturz-Bretter
  const plank = (cx, y) => {
    sim.addDeco(scaffoldDeco(2.8, 6), cx, y - 3.2, -1);
    return sim.addBody({ type: 'kinematic', x: cx, y: y - 0.15, crumble: true, delay: 0.55, respawn: 7, w: 2.9, fixtures: [bx(2.9, 0.3, 0, 0, 'brett')], friction: 0.9, density: 1.5 });
  };
  for (const x of [15.5, 18.5, 21.5, 24.5]) plank(x, 0);
  for (const x of [41.5, 44.5]) plank(x, 2.0);
  for (const x of [81.5, 84.5]) plank(x, 2.0);
  // Kranträger über der grossen Grube
  const beam = sim.addBody({ type: 'kinematic', x: 56, y: 1.8, fixtures: [bx(4.2, 0.36, 0, 0, 'stahl')], friction: 0.9,
    paint: (g, P) => { RRo(g, P, -2.1, -0.18, 2.1, 0.18, '#c4532c', '#17121d'); RR(g, P, -2.05, 0.08, 2.05, 0.14, '#e07448'); for (let x = -1.8; x < 2; x += 0.6) { RR(g, P, x, -0.12, x + 0.08, 0.06, '#8e3a1f'); } } });
  // Abrissbirne
  const ball = sim.addBody({ type: 'kinematic', x: 46.5, y: 3.8, fixtures: [circ(0.75, 0, 0, 'dunkel')], friction: 0.3, restitution: 0.4,
    paint: (g, P) => { const [cx, cy] = P(0, 0); circlePx(g, cx, cy, 14, '#17121d'); circlePx(g, cx, cy, 12.5, '#3a3d44'); circlePx(g, cx - 4, cy - 4, 5, '#5f6673'); circlePx(g, cx - 5, cy - 6, 2, '#9aa3b2'); box(g, cx - 2, cy - 16, 4, 4, '#17121d'); } });
  // Fallende Stahlträger (Pool)
  const girders = [0, 1].map(i => {
    const mb = sim.addBody({ type: 'kinematic', x: 300 + i * 10, y: 60, fixtures: [bx(3.2, 0.36, 0, 0, 'stahl')], friction: 0.7, density: 1.6,
      paint: (g, P) => { RRo(g, P, -1.6, -0.18, 1.6, 0.18, '#c4532c', '#17121d'); RR(g, P, -1.55, 0.08, 1.55, 0.14, '#e07448'); RR(g, P, -1.55, -0.14, 1.55, -0.08, '#8e3a1f'); } });
    mb.state = 3; mb.mover = true; mb.gT = 0; mb.hurt = false;
    return mb;
  });
  // Lose Zementsäcke / Paletten
  for (const [x, y] of [[8, 0.35], [8.9, 0.35], [8.45, 1.0], [36.5, 2.35], [68, 2.35], [68.9, 2.35], [74, 2.35], [91, 0.95]]) {
    sim.addBody({ type: 'dynamic', x, y, cat: CAT.PROP, fixtures: [bx(0.85, 0.6, 0, 0, 'beton')], friction: 0.8, density: 1.4,
      paint: (g, P) => { RRo(g, P, -0.42, -0.3, 0.42, 0.3, '#d8cfb8', '#3a3020'); RR(g, P, -0.38, 0.12, 0.38, 0.2, '#b8ac90'); RR(g, P, -0.2, -0.1, 0.2, 0.05, '#c8432f'); } });
  }
  // Absperrung + Kran im Hintergrund
  const [crane, cg] = mkCanvas(30 * PPM, 15 * PPM);
  { const H = cg.canvas.height; const x0 = 25 * PPM;
    box(cg, x0, 10, 8, H - 10, '#17121d'); box(cg, x0 + 1, 10, 6, H - 10, '#e0a030');
    for (let y = 14; y < H; y += 9) { cg.strokeStyle = '#8a6018'; cg.beginPath(); cg.moveTo(x0 + 1, y); cg.lineTo(x0 + 7, y + 9); cg.stroke(); }
    box(cg, 0, 8, cg.canvas.width, 6, '#17121d'); box(cg, 0, 9, cg.canvas.width - 1, 4, '#e0a030');
    for (let x = 2; x < cg.canvas.width; x += 9) { cg.strokeStyle = '#8a6018'; cg.beginPath(); cg.moveTo(x, 9); cg.lineTo(x + 9, 13); cg.stroke(); }
    box(cg, x0 - 6, 0, 20, 8, '#17121d'); box(cg, x0 - 5, 1, 18, 6, '#e0a030'); box(cg, x0 - 3, 2, 6, 4, '#7ec8f0');
    box(cg, cg.canvas.width - 30, 14, 26, 14, '#3a3d44'); }
  sim.addDeco(crane, 59, 6.1, -2);
  const st = { gNext: 6 + rnd() * 3, warnX: 0, warnT: 0 };
  const spots = [[6, 0.5], [11, 0.5], [29, 0.5], [37.5, 2.5], [48, 2.5], [65, 2.5], [71, 2.5], [77, 2.5], [90, 1.1], [94, 1.1]].map(([x, y]) => ({ x, y }));
  const cps = [[0, 1.5, 1.0], [27, 28.5, 1.0], [46.5, 47.5, 2.8], [63, 64, 2.8], [86.5, 88, 1.5]].map(([x, sx, sy]) => ({ x, sx, sy }));
  const map = {
    minX: -3, maxX: 106, killY, camMinY: -6, camMaxY: 16, startX: 1.5, goalX: 97.5, cps, spots, maxPickups: 6,
    deathText: { sturz: 'in die Grube gestürzt', traeger: 'vom Stahlträger getroffen' },
    spawn(sim, cpi, idx) { const c = cps[clamp(cpi, 0, cps.length - 1)]; return { x: c.sx + idx * 0.9, y: c.sy }; },
    goal() { return { x0: 96.4, x1: 98.6, y0: 0.6, y1: 3.2 }; },
    update(sim, t, dt) {
      // Kranträger: pendelt mit Pausen an den Enden
      const bxp = 56 + 3.75 * clamp(1.5 * Math.sin(t * Math.PI * 2 / 8), -1, 1);
      drive(beam.body, bxp, 1.8 + 0.04 * Math.sin(t * 2.3), 0.01 * Math.sin(t * 1.7), dt);
      // Abrissbirne
      const ang = 1.05 * Math.sin(t * Math.PI * 2 / 3.8);
      drive(ball.body, 46.5 + Math.sin(ang) * 8.2, 12 - Math.cos(ang) * 8.2, ang, dt);
      // Stahlträger
      if (sim.phase !== 'countdown') {
        st.gNext -= dt;
        if (st.gNext <= 1.3 && st.warnT <= 0) { st.warnX = 64.5 + sim.rng() * 13.5; st.warnT = 1.3; }
        if (st.warnT > 0) st.warnT -= dt;
        if (st.gNext <= 0) {
          const gd = girders.find(gg => gg.state === 3);
          if (gd) { gd.body.setDynamic(); gd.body.setTransform(V2(st.warnX, 15), (sim.rng() - 0.5) * 0.3); gd.body.setLinearVelocity(V2(0, -6)); gd.body.setAwake(true); gd.state = 0; gd.gT = 0; gd.hurt = false; }
          st.gNext = 5 + sim.rng() * 4; st.warnT = 0;
        }
      }
      for (const gd of girders) {
        if (gd.state === 3) continue;
        gd.gT += dt;
        const v = gd.body.getLinearVelocity();
        if (!gd.hurt && v.y < -6) {
          for (let ce = gd.body.getContactList(); ce; ce = ce.next) {
            const ud = ce.other.getUserData();
            if (ce.contact.isTouching() && ud && ud.kind === 'player' && ud.p.alive) { sim.damage(ud.p, 70, -1, ud.p.body.getPosition(), 'traeger'); gd.hurt = true; }
          }
        }
        if (gd.gT > 5 || gd.body.getPosition().y < killY - 3) { gd.body.setKinematic(); gd.body.setTransform(V2(300, 60), 0); gd.body.setLinearVelocity(V2(0, 0)); gd.body.setAngularVelocity(0); gd.state = 3; }
      }
    },
    netState() { return st.warnT > 0 ? Math.round(st.warnX * 10) : 0; },
    hazards(sim) {
      return [{ circle: (tau) => { const a = 1.05 * Math.sin((sim.t + tau) * Math.PI * 2 / 3.8); return { x: 46.5 + Math.sin(a) * 8.2, y: 12 - Math.cos(a) * 8.2, r: 0.8 }; } },
        ...(st.warnT > 0 ? [{ circle: () => ({ x: st.warnX, y: 3, r: 2.2 }) }] : [])];
    },
    drawBack(ctx, cam, view) {
      const T = bauTheme();
      drawSky(ctx, cam, T.sky);
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(Math.round(cam.w * 0.3 - cam.x * 0.01), Math.round(cam.h * 0.62), 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(Math.round(cam.w * 0.3 - cam.x * 0.01), Math.round(cam.h * 0.62), 20, 0, Math.PI * 2); ctx.fill();
      drawLayer(ctx, T.cranes, cam, 0.08, 0, 2, 0.15);
      drawLayer(ctx, T.far, cam, 0.12, 0, 1, 0.22);
      drawLayer(ctx, T.midc, cam, 0.3, 0, 0, 0.45);
    },
    drawMid(ctx, cam, view, M) {
      // Kranseile zum Träger, Kette zur Abrissbirne
      const b = M[beam.mi];
      const bx0 = Math.round(b[0] * PPM - cam.x), by0 = Math.round(cam.y - (b[1] + 0.18) * PPM), topY = Math.round(cam.y - 12.8 * PPM);
      ctx.fillStyle = '#17121d';
      ctx.fillRect(bx0 - 1, topY, 1, by0 - topY - 14);
      ctx.fillRect(bx0 - 4, by0 - 14, 8, 3);
      ctx.strokeStyle = '#17121d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx0, by0 - 12); ctx.lineTo(bx0 - 30, by0); ctx.moveTo(bx0, by0 - 12); ctx.lineTo(bx0 + 30, by0); ctx.stroke();
      const o = M[ball.mi];
      const pxp = Math.round(46.5 * PPM - cam.x), pyp = Math.round(cam.y - 12 * PPM);
      const ox = Math.round(o[0] * PPM - cam.x), oy = Math.round(cam.y - o[1] * PPM);
      ctx.strokeStyle = '#2a2d34'; ctx.beginPath(); ctx.moveTo(pxp, pyp); ctx.lineTo(ox, oy - 14); ctx.stroke();
      for (let k = 0; k < 1; k += 0.08) { ctx.fillStyle = '#5f6673'; ctx.fillRect(Math.round(lerp(pxp, ox, k)), Math.round(lerp(pyp, oy - 14, k)), 2, 2); }
      ctx.fillStyle = '#17121d'; ctx.fillRect(pxp - 6, pyp - 3, 12, 3);
      // Warnung: fallender Träger
      if (view.H) {
        const wx = Math.round(view.H / 10 * PPM - cam.x), wy = Math.round(cam.y - 2.0 * PPM);
        if (Math.floor(view.t * 8) % 2) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(wx - 28, wy - 2, 56, 3); }
        ctx.drawImage(WARN, wx - 5, wy - 30);
      }
      // Fluchtwagen
      ctx.drawImage(VAN, Math.round(97 * PPM - cam.x), Math.round(cam.y - 0.6 * PPM) - 48);
    },
    drawFront() {},
  };
  return map;
}

// ------------------------------------------------------------
//  Karte 4: Hängebrücken-Schlucht
// ------------------------------------------------------------
const schluchtTheme = theme('schlucht', () => {
  const sky = skyCanvas([[0, '#3a86d0'], [0.6, '#9ccbea'], [1, '#f5dcae']]);
  const clouds = cloudLayer(640, 90, 5, 17, '#fff6ec', '#f0d8c4', 20, 70, 30, 60);
  const mesas = (seed, col, top, H, hmin, hmax) => {
    const [c, g] = mkCanvas(512, H); const r = RNG(seed);
    let x = 0;
    while (x < 512) {
      const w = 30 + r() * 70 | 0, h = hmin + r() * (hmax - hmin) | 0;
      const gap = 10 + r() * 40 | 0;
      for (let xx = 0; xx < w && x + xx < 512; xx++) {
        const edge = Math.min(xx, w - xx);
        const hh = h - (edge < 6 ? (6 - edge) * 2 : 0);
        box(g, x + xx, H - hh, 1, hh, col);
        px(g, x + xx, H - hh, top);
        for (let s = H - hh + 6; s < H; s += 7) px(g, x + xx, s, shade(col, -0.12));
      }
      x += w + gap;
    }
    box(g, 0, H - 4, 512, 4, col);
    return c;
  };
  const far = mesas(4, '#d29a7a', '#e8b896', 100, 30, 80);
  const mid = mesas(12, '#b8603e', '#d47a50', 90, 20, 60);
  const [river, rg] = mkCanvas(256, 40);
  box(rg, 0, 0, 256, 40, '#3a6ea0'); for (let i = 0; i < 80; i++) box(rg, Math.random() * 256 | 0, Math.random() * 40 | 0, 4, 1, '#6aa0d0');
  return { sky, clouds, far, mid, river };
});
function buildSchlucht(sim, rnd) {
  const cliff = (verts) => sim.addBody({ fixtures: [poly(verts, 'fels')] });
  cliff([[-4, -22], [15.6, -22], [16, 0], [10, 0.2], [4, 0], [-4, 0.1]]);
  cliff([[31, -22], [37, -22], [38, 0.4], [30, 0.4]]);
  sim.addBody({ fixtures: [poly([[57, -22], [74, -22], [74, 0], [66, 0.15], [57, 0]], 'fels')] });
  sim.addBody({ fixtures: [poly([[64, 3.4], [74, 3.4], [74, 9], [62, 9]], 'fels'), poly([[74, -22], [84, -22], [84, 1.2], [74, 0]], 'fels'), poly([[84, -22], [106, -22], [106, 1.2], [84, 1.2]], 'fels')] });
  // Bröckelnde Felskante
  const chunk = (x0, x1) => sim.addBody({ type: 'kinematic', x: (x0 + x1) / 2, y: -0.6, crumble: true, delay: 0.7, respawn: 8, w: x1 - x0,
    fixtures: [poly([[-(x1 - x0) / 2, -0.6], [(x1 - x0) / 2, -0.8], [(x1 - x0) / 2, 0.6], [-(x1 - x0) / 2, 0.6]], 'fels')], friction: 0.9, density: 2 });
  chunk(54, 55.5); chunk(55.5, 57);
  // Hängebrücken
  const bridges = [];
  const makeBridge = (ax, ay, bx2, by, n, sag) => {
    const pts = [];
    const N = 400;
    const fine = [];
    for (let i = 0; i <= N; i++) { const u = i / N; fine.push([lerp(ax, bx2, u), lerp(ay, by, u) - 4 * sag * u * (1 - u)]); }
    let total = 0; const acc = [0];
    for (let i = 1; i <= N; i++) { total += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]); acc.push(total); }
    for (let k = 0; k <= n; k++) { const target = total * k / n; let i = 0; while (i < N && acc[i + 1] < target) i++; pts.push(fine[i]); }
    const posts = [ax, bx2].map((x, i) => sim.addBody({ fixtures: [rc(-0.15, -0.6, 0.15, 0.1, 'holz')], x, y: [ay, by][i] }));
    const planks = [];
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[k + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mb = sim.addBody({ type: 'dynamic', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 0.11, a: Math.atan2(b[1] - a[1], b[0] - a[0]),
        fixtures: [bx(L * 0.98, 0.22, 0, 0, 'brett')], friction: 0.95, density: 2.4, angDamp: 0.6, linDamp: 0.1, hp: 45,
        onHit: (s, m, d) => { m.hp -= d; if (m.hp <= 0) breakPlank(s, m); }, onBlast: (s, m, f) => { if (f > 0.25) breakPlank(s, m); } });
      mb.bridge = null; mb.k = k; mb.ja = a; mb.jb = b;
      planks.push(mb);
    }
    const br = { posts, planks, joints: [], broken: false, timer: 0, pts };
    planks.forEach(m => (m.bridge = br));
    linkBridge(sim, br);
    bridges.push(br);
    return br;
  };
  const linkBridge = (s, br) => {
    for (const j of br.joints) if (j) s.world.destroyJoint(j);
    br.joints = [];
    const { planks, posts, pts } = br;
    for (let k = 0; k <= planks.length; k++) {
      const A = k === 0 ? posts[0].body : planks[k - 1].body;
      const B = k === planks.length ? posts[1].body : planks[k].body;
      const p = pts[k];
      br.joints.push(s.world.createJoint(pl.RevoluteJoint({}, A, B, V2(p[0], p[1] - 0.02))));
    }
  };
  const breakPlank = (s, m) => {
    if (m.state === 2) return;
    const br = m.bridge;
    const k = m.k;
    for (const ji of [k, k + 1]) if (br.joints[ji]) { s.world.destroyJoint(br.joints[ji]); br.joints[ji] = null; }
    m.state = 2;
    if (!br.broken) { br.broken = true; br.timer = 0; }
    const c = m.body.getPosition();
    s.ev('crumble', +c.x.toFixed(2), +c.y.toFixed(2));
  };
  makeBridge(16, -0.05, 30, 0.3, 12, 0.85);
  makeBridge(38, 0.35, 54, -0.05, 14, 0.95);
  // Felsbrocken (Steinschlag)
  const rocks = [0, 1, 2].map(i => {
    const mb = sim.addBody({ type: 'kinematic', x: 300 + i * 5, y: 60, fixtures: [circ(0.5, 0, 0, 'fels')], friction: 0.6, density: 2.5, restitution: 0.2,
      paint: (g, P) => { const [cx, cy] = P(0, 0); circlePx(g, cx, cy, 9, '#2a1e18'); circlePx(g, cx, cy, 7.5, '#7a5f4a'); circlePx(g, cx - 2, cy - 3, 4, '#8e7058'); px(g, cx - 3, cy - 4, '#a3836a'); px(g, cx + 3, cy + 2, '#5e4636'); } });
    mb.state = 3; mb.mover = true; mb.gT = 0; mb.hurt = false;
    return mb;
  });
  const st = { rNext: 7 + rnd() * 4, warnX: 0, warnT: 0 };
  const spots = [[5, 0.6], [11, 0.7], [34, 1.0], [60.5, 0.6], [66, 0.6], [70.5, 0.6], [79, 1.2], [88, 1.8], [91, 1.8]].map(([x, y]) => ({ x, y }));
  const cps = [[0, 1.5, 1.0], [31, 33, 1.3], [58, 60, 0.9], [80, 86, 2.1]].map(([x, sx, sy]) => ({ x, sx, sy }));
  const map = {
    minX: -4, maxX: 106, killY: -12, camMinY: -12, camMaxY: 13, startX: 1.5, goalX: 95, cps, spots, maxPickups: 6, bridges,
    deathText: { sturz: 'in die Schlucht gestürzt', fels: 'vom Steinschlag getroffen' },
    spawn(sim, cpi, idx) { const c = cps[clamp(cpi, 0, cps.length - 1)]; return { x: c.sx + idx * 0.9, y: c.sy }; },
    goal() { return { x0: 93.8, x1: 96.2, y0: 1.2, y1: 3.8 }; },
    update(sim, t, dt) {
      for (const br of bridges) {
        if (!br.broken) continue;
        br.timer += dt;
        if (br.timer > 8) {
          br.broken = false;
          br.planks.forEach(m => { m.body.setTransform(V2(m.home.x, m.home.y), m.home.a); m.body.setLinearVelocity(V2(0, 0)); m.body.setAngularVelocity(0); m.state = 0; m.hp = 45; m.body.setAwake(true); });
          linkBridge(sim, br);
        }
      }
      if (sim.phase !== 'countdown') {
        st.rNext -= dt;
        if (st.rNext <= 1.4 && st.warnT <= 0) { st.warnX = 39 + sim.rng() * 14; st.warnT = 1.4; }
        if (st.warnT > 0) st.warnT -= dt;
        if (st.rNext <= 0) {
          const r = rocks.find(q => q.state === 3);
          if (r) { r.body.setDynamic(); r.body.setTransform(V2(st.warnX, 13), 0); r.body.setLinearVelocity(V2((sim.rng() - 0.5) * 2, -4)); r.body.setAngularVelocity((sim.rng() - 0.5) * 6); r.body.setAwake(true); r.state = 0; r.gT = 0; r.hurt = false; }
          st.rNext = 6 + sim.rng() * 5; st.warnT = 0;
        }
      }
      for (const r of rocks) {
        if (r.state === 3) continue;
        r.gT += dt;
        if (!r.hurt && r.body.getLinearVelocity().y < -6) {
          for (let ce = r.body.getContactList(); ce; ce = ce.next) {
            const ud = ce.other.getUserData();
            if (ce.contact.isTouching() && ud && ud.kind === 'player' && ud.p.alive) { sim.damage(ud.p, 55, -1, ud.p.body.getPosition(), 'fels'); r.hurt = true; }
            if (ce.contact.isTouching() && ud && ud.kind === 'mb' && ud.mb.bridge && sim.rng() < 0.5) breakPlank(sim, ud.mb);
          }
        }
        if (r.gT > 6 || r.body.getPosition().y < -14) { r.body.setKinematic(); r.body.setTransform(V2(300, 60), 0); r.body.setLinearVelocity(V2(0, 0)); r.body.setAngularVelocity(0); r.state = 3; }
      }
    },
    netState() { return st.warnT > 0 ? Math.round(st.warnX * 10) : 0; },
    hazards() { return st.warnT > 0 ? [{ circle: () => ({ x: st.warnX, y: 1, r: 1.8 }) }] : []; },
    drawBack(ctx, cam, view) {
      const T = schluchtTheme();
      drawSky(ctx, cam, T.sky);
      ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(Math.round(cam.w * 0.72), 30, 12, 0, Math.PI * 2); ctx.fill();
      drawLayer(ctx, T.clouds, cam, 0.03, view.t * 3, 10, 0.08);
      drawLayer(ctx, T.far, cam, 0.1, 0, -3, 0.2);
      drawLayer(ctx, T.mid, cam, 0.25, 0, -6, 0.4);
      // Fluss tief unten
      const ry = Math.round((cam.y + 16 * PPM) * 0.85 + cam.h * 0.15 * 0.78);
      if (ry < cam.h) {
        let off = -((cam.x * 0.6 + view.t * 30) % 256); if (off > 0) off -= 256;
        for (let x = Math.round(off); x < cam.w; x += 256) ctx.drawImage(T.river, x, ry);
        ctx.fillStyle = '#3a6ea0'; ctx.fillRect(0, ry + 40, cam.w, Math.max(0, cam.h - ry - 40));
      }
    },
    drawMid(ctx, cam, view, M) {
      // Seile der Hängebrücken
      for (const br of bridges) {
        const segs = [];
        for (const m of br.planks) {
          const s = M[m.mi];
          if (s[3] === 2) { segs.push(null); continue; }
          const ca = Math.cos(s[2]), sa = Math.sin(s[2]);
          const L = Math.hypot(m.jb[0] - m.ja[0], m.jb[1] - m.ja[1]) / 2;
          segs.push([[s[0] - ca * L, s[1] - sa * L], [s[0] + ca * L, s[1] + sa * L]]);
        }
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1;
        const P2 = (x, y) => [Math.round(x * PPM - cam.x) + 0.5, Math.round(cam.y - y * PPM) + 0.5];
        const pa = br.pts[0], pb = br.pts[br.pts.length - 1];
        // Pfosten
        for (const p of [pa, pb]) { const [x, y] = P2(p[0], p[1]); ctx.fillStyle = '#17121d'; ctx.fillRect(x - 2, y - 22, 4, 24); ctx.fillStyle = '#8a5a32'; ctx.fillRect(x - 1, y - 21, 2, 22); }
        ctx.beginPath();
        let started = false;
        const pts = [pa, ...segs.map(s => s && s[1])];
        for (let i = 0; i < pts.length; i++) {
          const q = pts[i];
          if (!q) { started = false; continue; }
          const [x, y] = P2(q[0], q[1] + 0.95);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Senkrechte Halteseile
        ctx.strokeStyle = '#8a6a44';
        ctx.beginPath();
        for (const s of segs) { if (!s) continue; const [x1, y1] = P2(s[1][0], s[1][1]); const [x2, y2] = P2(s[1][0], s[1][1] + 0.95); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        ctx.stroke();
      }
      // Warnung Steinschlag
      if (view.H) {
        const wx = Math.round(view.H / 10 * PPM - cam.x), wy = Math.round(cam.y - 7 * PPM);
        ctx.drawImage(WARN, wx - 5, wy);
        if (Math.floor(view.t * 10) % 2) { ctx.fillStyle = '#a3836a'; for (let i = 0; i < 4; i++) ctx.fillRect(wx - 6 + i * 4, wy + 14 + (i * 7 + Math.floor(view.t * 20)) % 12, 2, 2); }
      }
      ctx.drawImage(JEEP, Math.round(94 * PPM - cam.x), Math.round(cam.y - 1.2 * PPM) - 44);
    },
    drawFront() {},
  };
  return map;
}

const MAPS = [
  { id: 'zug', name: 'Güterzug', desc: 'Über die Dächer eines rasenden Güterzugs. Achtung: Signalbrücken und Tunnel!', color: '#d52b1e', build: buildZug },
  { id: 'flug', name: 'Frachtflugzeug', desc: 'Das Flugzeug schwankt, Fracht rutscht. Hinten wartet der Fallschirm.', color: '#4f8ff7', build: buildFlug },
  { id: 'bau', name: 'Baustelle', desc: 'Bretter brechen ein, die Abrissbirne schwingt, Träger fallen vom Kran.', color: '#e0a030', build: buildBau },
  { id: 'schlucht', name: 'Hängebrücke', desc: 'Wacklige Brücken über der Schlucht – zerschiess die Bretter!', color: '#52c06a', build: buildSchlucht },
];
