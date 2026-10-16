'use strict';
// ============================================================
//  Pixel-Art: alle Grafiken werden beim Start per Code gezeichnet
// ============================================================
const PPM = 18;                       // Pixel pro Meter (in der niedrigen Spielauflösung)

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rgbOf(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexOf(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
// f > 0 heller, f < 0 dunkler
function shade(hex, f) {
  const [r, g, b] = rgbOf(hex);
  if (f >= 0) return hexOf(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  return hexOf(r * (1 + f), g * (1 + f), b * (1 + f));
}
function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return hexOf(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function RNG(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function px(g, x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
function box(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function art(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const [c, g] = mkCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch !== '.' && ch !== ' ' && pal[ch]) px(g, x, y, pal[ch]);
  }
  return c;
}
function flipX(src) {
  const [c, g] = mkCanvas(src.width, src.height);
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}
function tinted(src, col) {
  const [c, g] = mkCanvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  box(g, 0, 0, src.width, src.height, col);
  return c;
}
// Gerasterter Farbverlauf (Dithering) – typischer Pixel-Art-Himmel
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function ditherGrad(g, x, y, w, h, stops) {
  // stops: [[t, '#hex'], ...] vertikal
  const cols = stops.map(s => [s[0], rgbOf(s[1])]);
  const bands = Math.max(2, Math.round(h / 3));
  for (let yy = 0; yy < h; yy++) {
    const t = yy / Math.max(1, h - 1);
    let i = 0;
    while (i < cols.length - 2 && t > cols[i + 1][0]) i++;
    const a = cols[i], b = cols[i + 1];
    const lt = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1) * (bands / cols.length);
    const lvl = Math.floor(lt * 4) / 4, frac = lt * 4 - Math.floor(lt * 4);
    for (let xx = 0; xx < w; xx++) {
      const th = BAYER[yy & 3][xx & 3] / 16;
      const tt = clamp((lvl + (frac > th ? 0.25 : 0)) / (bands / cols.length), 0, 1);
      g.fillStyle = hexOf(lerp(a[1][0], b[1][0], tt), lerp(a[1][1], b[1][1], tt), lerp(a[1][2], b[1][2], tt));
      g.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}
function ditherGradFast(g, x, y, w, h, stops) {
  // schneller: zeilenweise mit 2 Farben im Schachbrett
  const cols = stops.map(s => [s[0], rgbOf(s[1])]);
  const steps = 10;
  for (let yy = 0; yy < h; yy++) {
    const t = yy / Math.max(1, h - 1);
    let i = 0;
    while (i < cols.length - 2 && t > cols[i + 1][0]) i++;
    const a = cols[i], b = cols[i + 1];
    const lt = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1) * steps;
    const lo = Math.floor(lt), fr = lt - lo;
    const c1 = hexOf(...a[1].map((v, k) => lerp(v, b[1][k], lo / steps)));
    const c2 = hexOf(...a[1].map((v, k) => lerp(v, b[1][k], Math.min(steps, lo + 1) / steps)));
    g.fillStyle = c1; g.fillRect(x, y + yy, w, 1);
    if (fr > 0.1) {
      g.fillStyle = c2;
      for (let xx = 0; xx < w; xx++) {
        if (BAYER[yy & 3][xx & 3] / 16 < fr) g.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }
}

// ============================================================
//  Figuren
// ============================================================
const BASE_BODY = [
  '...........',
  '...........',
  '...........',
  '...........',
  '...KKKKK...',
  '..KhhhhhK..',
  '..KSSSWPK..',
  '..KsSSSSK..',
  '..KsSSmSK..',
  '...KsssK...',
  '..KJJWTJK..',
  '.KJJJWTJLK.',
  '.KjJJWTJLK.',
  '.KjJJJTJLK.',
  '.KjJJJJJLK.',
  '.KjJJJJJLK.',
  '.KGjJJJJGK.',
  '..KBBBBBK..',
  '..KNNNNNK..',
  '..KNnKNnK..',
  '..KNnKNnK..',
  '..KNnKNnK..',
  '..KOOKOOOK.',
  '..KKKKKKKK.',
];
const JUMP_LEGS = [
  '..KNNNNNK..',
  '.KNnKKNnK..',
  '.KOOK.KOOK.',
  '..KK...KK..',
  '...........',
  '...........',
];
const HATS = {
  fedora: ['...........', '....KKK....', '...KHHHK...', '..KHHwHHK..', '..KbbbbbK..', 'KKHHHHHHHKK'],
  beanie: ['....KK.....', '...KwwK....', '...KHHHK...', '..KHIHIHK..', '..KHHHHHK..', '..KbbbbbK..'],
  cap: ['...........', '...........', '...........', '...KKKKK...', '..KHHHwHK..', '..KbHHHHHHK'],
  cowboy: ['...........', '...K...K...', '...KHKHK...', '...KHHHK...', 'KK.KbbbK.KK', '.KKHHHHHKK.'],
  helm: ['...........', '...KKKKK...', '..KHHHHwK..', '.KHHHHHHHK.', '.KHIIIIIHK.', '.KHbbbbbHK.'],
};
const FACES = {
  mask: { 6: '..KMMMWPK..' },
  shades: { 6: '..KSKKKwK..' },
  stache: { 8: '..KsSmmmK..' },
  none: {},
};
const OUTFITS = [
  { name: 'Blau', main: '#4f8ff7', hat: 'fedora', hatCol: '#283250', band: '#f2c94c', face: 'mask', skin: '#f1c27d', hair: '#3a2618', pants: '#262b3b', tie: '#f2c94c' },
  { name: 'Rot', main: '#ef5350', hat: 'beanie', hatCol: '#9a2228', band: '#2a1a1a', face: 'shades', skin: '#dba274', hair: '#1e1410', pants: '#2e2626', tie: '#1c1c22' },
  { name: 'Grün', main: '#52c06a', hat: 'cowboy', hatCol: '#7a4b2a', band: '#3a2414', face: 'stache', skin: '#c68a5a', hair: '#2a1a10', pants: '#3a3a2e', tie: '#b03030' },
  { name: 'Gelb', main: '#f5c040', hat: 'cap', hatCol: '#e0662c', band: '#a03c14', face: 'mask', skin: '#f6d3b0', hair: '#7a4a20', pants: '#2f2f3f', tie: '#1f4f9f' },
];

function outfitPal(o) {
  return {
    K: '#17121d', S: o.skin, s: shade(o.skin, -0.18), W: '#f4f4f0', P: '#17121d', m: shade(o.skin, -0.45),
    h: o.hair, J: o.main, j: shade(o.main, -0.3), L: shade(o.main, 0.28), T: o.tie, G: shade(o.skin, -0.08),
    B: '#3a2a1e', N: o.pants, n: shade(o.pants, -0.3), O: '#2a1d18', H: o.hatCol, I: shade(o.hatCol, -0.28),
    b: o.band, w: shade(o.hatCol, 0.35), M: '#22202a',
  };
}
function buildFigure(o, jump, dead) {
  const rows = BASE_BODY.slice();
  if (jump) for (let i = 0; i < 6; i++) rows[18 + i] = JUMP_LEGS[i];
  const hat = HATS[o.hat];
  for (let i = 0; i < hat.length; i++) {
    let r = rows[i].split('');
    for (let x = 0; x < hat[i].length; x++) if (hat[i][x] !== '.') r[x] = hat[i][x];
    rows[i] = r.join('');
  }
  const f = FACES[o.face] || {};
  for (const k in f) rows[k] = f[k];
  if (dead) {
    rows[6] = rows[6].replace('W', 'x').replace('P', 'S');
    rows[8] = '..KsSmmSK..';
  }
  const pal = outfitPal(o);
  pal.x = '#17121d';
  // Hut-Schatten ('w' der Kopf-Highlights nur beim Hut)
  return art(rows, pal);
}
const FIG = OUTFITS.map(o => {
  const r = { stand: buildFigure(o, false, false), jump: buildFigure(o, true, false), dead: buildFigure(o, true, true) };
  for (const k of ['stand', 'jump', 'dead']) { r[k + 'L'] = flipX(r[k]); r[k + 'W'] = tinted(r[k], '#ffffff'); r[k + 'LW'] = tinted(r[k + 'L'], '#ffffff'); }
  r.icon = r.stand;
  return r;
});

// ============================================================
//  Waffen
// ============================================================
const WPAL = { K: '#141318', d: '#363a44', g: '#5f6673', l: '#9aa3b2', w: '#8a5a32', v: '#5a3a1e', r: '#c83a3a', o: '#e8822a', y: '#f2d040', G: '#4d6b39', H: '#7b9a5a', b: '#2a2d36', s: '#c9d3e0' };
const WEAPON_ART = {
  pistole: { rows: [
    '.KKKKKKKKK',
    'KllllllllK',
    'KgggggggdK',
    '.KdKKKKKK.',
    '.KvK......',
    '.KKK......',
  ], grip: [2, 4], muzzle: [10, 1.5] },
  mp: { rows: [
    '....KKK.......',
    '.KKKKKKKKKKKKK',
    'KlllllllllllgK',
    'KgggggggggddKK',
    'KKdKKdKKKKKK..',
    '..KvK.KbK.....',
    '..KKK.KbK.....',
    '......KKK.....',
  ], grip: [3, 5], muzzle: [14, 2.5] },
  schrot: { rows: [
    '..........KKKKKKK.',
    'KKKKKKKKKKllllllllK',
    'KwwwwwwKggggggggggK',
    'KvwwwwKKdKKKKKKKKK.',
    '.KvvKKKwwwwwK......',
    '..KK...KKKKK.......',
  ], grip: [6, 3], muzzle: [19, 1.5] },
  sniper: { rows: [
    '.......KKKKKKK..........',
    '.......KsbbbbsK.........',
    'KKKKK...KKKKKK..........',
    'KHHHHKKKKKKKKKKKKKKKKKKK',
    'KGGGGGGGGGGGgggggggggglK',
    '.KKGGGKKdKKKKKKKKKKKKKK.',
    '...KGGKvK...............',
    '....KKKKK...............',
  ], grip: [7, 5], muzzle: [24, 4] },
  rakete: { rows: [
    '...KKKKKKKKKKKKKKKK.',
    '..KHGGGGGGGGGGGGGGHK',
    'KKKGGGGGGGGGGGGGGGGK',
    'KrrKHHHHHHHHHHHHHHHK',
    '.KKKKKKdKKKdKKKKKKK.',
    '......KvK.KbK.......',
    '......KKK.KKK.......',
  ], grip: [7, 4], muzzle: [20, 2] },
  granate: { rows: [
    '..KK.',
    '.KlKK',
    'KGHGK',
    'KGGGK',
    'KGHGK',
    '.KKK.',
  ], grip: [2, 3], muzzle: [4, 2] },
};
const WSPR = {};
for (const k in WEAPON_ART) {
  const a = WEAPON_ART[k];
  const img = art(a.rows, WPAL);
  const [c, g] = mkCanvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  WSPR[k] = { img: c, flip: (() => { const [f, fg] = mkCanvas(img.width, img.height); fg.translate(0, img.height); fg.scale(1, -1); fg.drawImage(img, 0, 0); return f; })(), grip: a.grip, muzzle: a.muzzle, w: img.width, h: img.height };
}
const ROCKET_SPR = art(['.KKKK..', 'KoyrrKK', 'KorrrrK', '.KKKK..'], { K: '#141318', o: '#f4a020', y: '#fff3a0', r: '#c83a3a' });
const WCOL = { pistole: '#9aa3b2', mp: '#4f8ff7', schrot: '#e8822a', sniper: '#7b9a5a', rakete: '#ef5350', granate: '#f2d040' };

// Waffenkiste (Pickup)
function buildCrate(col) {
  const [c, g] = mkCanvas(12, 10);
  box(g, 0, 0, 12, 10, '#17121d');
  box(g, 1, 1, 10, 8, '#8a5a32');
  box(g, 1, 1, 10, 1, '#b07a44');
  box(g, 1, 8, 10, 1, '#5a3a1e');
  box(g, 1, 4, 10, 2, col);
  box(g, 1, 4, 10, 1, shade(col, 0.3));
  px(g, 2, 2, '#c9d3e0'); px(g, 9, 2, '#c9d3e0'); px(g, 2, 7, '#c9d3e0'); px(g, 9, 7, '#c9d3e0');
  box(g, 5, 1, 2, 8, 'rgba(0,0,0,0.18)');
  return c;
}
const CRATE = {};
for (const k in WCOL) CRATE[k] = buildCrate(WCOL[k]);

// ============================================================
//  Materialien (Kacheln 16x16)
// ============================================================
function tile(fn, w = 16, h = 16, seed = 1) {
  const [c, g] = mkCanvas(w, h);
  fn(g, w, h, RNG(seed));
  return c;
}
const MAT = {
  beton: { top: '#c9c6bd', edge: '#3c3b40', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#9a978f');
    for (let i = 0; i < 40; i++) px(g, r() * w | 0, r() * h | 0, r() < 0.5 ? '#88857d' : '#aaa79f');
    for (let i = 0; i < 4; i++) px(g, r() * w | 0, r() * h | 0, '#6f6c66');
    box(g, 0, 15, 16, 1, '#8a877f');
    box(g, 7, 0, 1, 16, '#8f8c84');
  }) },
  stahl: { top: '#ff9b6b', edge: '#3a1c14', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#c4532c');
    box(g, 0, 0, w, 2, '#e07448'); box(g, 0, 14, w, 2, '#8e3a1f');
    for (let x = 0; x < 16; x += 8) { px(g, x + 3, 4, '#f0a080'); px(g, x + 3, 11, '#f0a080'); px(g, x + 4, 5, '#6a2a14'); px(g, x + 4, 12, '#6a2a14'); }
    for (let i = 0; i < 10; i++) px(g, r() * w | 0, 2 + r() * 12 | 0, '#b04a26');
  }) },
  holz: { top: '#d7a468', edge: '#3a2412', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#9b6a3c');
    for (let y = 0; y < 16; y += 4) { box(g, 0, y, 16, 1, '#7a4f2a'); box(g, 0, y + 1, 16, 1, '#b07c48'); }
    for (let i = 0; i < 14; i++) box(g, r() * 16 | 0, (r() * 4 | 0) * 4 + 2, 3 + r() * 4 | 0, 1, '#8a5c32');
    px(g, 2, 2, '#3a3a3a'); px(g, 13, 6, '#3a3a3a'); px(g, 5, 10, '#3a3a3a'); px(g, 11, 14, '#3a3a3a');
  }) },
  brett: { top: '#e3b878', edge: '#3a2412', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#b88446');
    box(g, 0, 0, 16, 1, '#d6a262'); box(g, 0, 15, 16, 1, '#7a5228');
    for (let i = 0; i < 8; i++) box(g, r() * 16 | 0, 2 + r() * 12 | 0, 2 + r() * 5 | 0, 1, '#a07038');
    px(g, 1, 3, '#2a2a2a'); px(g, 14, 3, '#2a2a2a');
  }) },
  fels: { top: '#8fc25a', edge: '#2a1e18', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#7a5f4a');
    for (let i = 0; i < 7; i++) {
      const x = r() * 16 | 0, y = r() * 16 | 0, s = 2 + r() * 4 | 0;
      box(g, x, y, s, s - 1, '#8e7058'); box(g, x, y, s, 1, '#a3836a'); box(g, x, y + s - 1, s, 1, '#5e4636');
    }
    for (let i = 0; i < 12; i++) px(g, r() * 16 | 0, r() * 16 | 0, '#5a4434');
  }, 16, 16, 7) },
  sandstein: { top: '#e9b07a', edge: '#3a1e14', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#c06c42');
    for (let y = 0; y < 16; y += 5) box(g, 0, y, 16, 1, '#a85a36');
    for (let y = 2; y < 16; y += 5) box(g, 0, y, 16, 1, '#d07c50');
    for (let i = 0; i < 16; i++) px(g, r() * 16 | 0, r() * 16 | 0, r() < 0.5 ? '#b0623a' : '#d48a5c');
  }, 16, 16, 9) },
  blech: { top: '#c8d2dc', edge: '#22262e', tile: tile((g, w, h) => {
    box(g, 0, 0, w, h, '#7d8794');
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 2; x < 16; x += 4) { px(g, x, y, '#a7b1be'); px(g, x + 1, y + 1, '#5d6672'); }
  }) },
  dunkel: { top: '#55606e', edge: '#101318', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#2f353f');
    for (let i = 0; i < 20; i++) px(g, r() * 16 | 0, r() * 16 | 0, '#363d48');
  }) },
  erde: { top: '#6aa84f', edge: '#20160f', tile: tile((g, w, h, r) => {
    box(g, 0, 0, w, h, '#5e432e');
    for (let i = 0; i < 26; i++) px(g, r() * 16 | 0, r() * 16 | 0, r() < 0.5 ? '#6e5038' : '#4c3624');
    for (let i = 0; i < 3; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; box(g, x, y, 2, 2, '#7d7468'); px(g, x, y, '#9a9184'); }
  }, 16, 16, 3) },
};
for (const k in MAT) MAT[k].pat = null;
function matPattern(g, name) {
  const m = MAT[name] || MAT.beton;
  return g.createPattern(m.tile, 'repeat');
}

// Generischer Maler für Körper: füllt Polygone mit Kachelmuster, oben Licht, aussen Rand
function paintFixtures(g, fixtures, P) {
  for (const f of fixtures) {
    if (f.invisible) continue;
    const m = MAT[f.mat] || MAT.beton;
    g.save();
    g.beginPath();
    if (f.shape === 'circle') {
      const [cx, cy] = P(f.cx || 0, f.cy || 0);
      g.arc(cx, cy, f.r * PPM, 0, Math.PI * 2);
    } else {
      const v = f.verts;
      for (let i = 0; i < v.length; i++) {
        const [x, y] = P(v[i][0], v[i][1]);
        if (i === 0) g.moveTo(Math.round(x), Math.round(y)); else g.lineTo(Math.round(x), Math.round(y));
      }
      g.closePath();
    }
    g.fillStyle = matPattern(g, f.mat);
    g.fill();
    g.clip();
    // Randlinien
    g.lineWidth = 2; g.strokeStyle = m.edge; g.stroke();
    g.restore();
    if (f.shape !== 'circle') {
      const v = f.verts;
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        // Aussennormale (Polygon gegen Uhrzeigersinn in y-oben-Koordinaten)
        const nx = dy / len, ny = -dx / len;
        if (ny > 0.6) {
          const [x1, y1] = P(a[0], a[1]), [x2, y2] = P(b[0], b[1]);
          const steps = Math.max(1, Math.round(Math.abs(x2 - x1)));
          for (let s = 0; s <= steps; s++) {
            const x = Math.round(lerp(x1, x2, s / steps)), y = Math.round(lerp(y1, y2, s / steps));
            px(g, x, y + 1, m.top);
            if (f.mat === 'fels' || f.mat === 'erde') {
              px(g, x, y, m.top); px(g, x, y + 2, shade(m.top, -0.25));
              if ((x * 7 + y * 3) % 5 === 0) px(g, x, y - 1, shade(m.top, 0.15));
              if ((x * 13) % 11 === 0) px(g, x, y + 3, shade(m.top, -0.35));
            }
          }
        }
      }
    }
  }
}

// ============================================================
//  Effekte
// ============================================================
const FLASH = [
  art(['..y..', '.yWy.', 'yWWWy', '.yWy.', '..y..'], { y: '#ffd040', W: '#fffbe0' }),
  art(['.y.y...', '..yWy..', 'yWWWWWy', '..yWy..', '.y.y...'], { y: '#ffb020', W: '#fff6c0' }),
];
const FONT5 = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  '!': '010010010000010', '?': '111001011000010', '+': '000010111010000', '-': '000000111000000', ' ': '000000000000000',
  ':': '000010000010000', '/': '001001010100100', '.': '000000000000010',
};
// winzige Pixel-Schrift (3x5) für Zahlen
function pixText(g, s, x, y, col, shadow) {
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    const p = FONT5[s[i]] || FONT5[' '];
    for (let k = 0; k < 15; k++) if (p[k] === '1') {
      const xx = x + i * 4 + (k % 3), yy = y + (k / 3 | 0);
      if (shadow) px(g, xx + 1, yy + 1, shadow);
      px(g, xx, yy, col);
    }
  }
}

// ============================================================
//  Grosse Objekte
// ============================================================
// Helikopter (Fluchtfahrzeug), ohne Rotor
function buildHeli() {
  const W = 120, H = 52;
  const [c, g] = mkCanvas(W, H);
  const K = '#141318', body = '#2b2f3a', bl = '#454b5a', bd = '#1e2129', acc = '#f2c94c';
  // Heckausleger
  box(g, 4, 14, 50, 6, K); box(g, 5, 15, 48, 4, body); box(g, 5, 15, 48, 1, bl);
  box(g, 2, 6, 8, 12, K); box(g, 3, 7, 6, 10, body); box(g, 3, 7, 6, 2, acc);
  // Rumpf
  g.fillStyle = K;
  g.beginPath(); g.moveTo(44, 8); g.lineTo(92, 6); g.lineTo(112, 16); g.lineTo(116, 30); g.lineTo(106, 38); g.lineTo(52, 38); g.lineTo(44, 28); g.closePath(); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.moveTo(46, 10); g.lineTo(91, 8); g.lineTo(110, 17); g.lineTo(114, 30); g.lineTo(105, 36); g.lineTo(53, 36); g.lineTo(46, 27); g.closePath(); g.fill();
  box(g, 48, 11, 60, 2, bl);
  box(g, 50, 30, 58, 4, bd);
  box(g, 48, 24, 64, 2, acc);
  // Cockpitscheibe
  g.fillStyle = '#7ec8f0';
  g.beginPath(); g.moveTo(92, 11); g.lineTo(108, 18); g.lineTo(111, 24); g.lineTo(92, 24); g.closePath(); g.fill();
  g.fillStyle = '#c6ecff'; g.fillRect(94, 13, 6, 2); g.fillRect(96, 15, 3, 1);
  // Seitentür offen (dunkel)
  box(g, 62, 13, 20, 13, K); box(g, 63, 14, 18, 11, '#0c0d12');
  px(g, 66, 17, '#3a3f4c');
  // Rotor-Mast
  box(g, 68, 2, 8, 6, K); box(g, 69, 3, 6, 4, bl);
  // Kufen
  box(g, 54, 38, 3, 8, K); box(g, 98, 38, 3, 8, K);
  box(g, 46, 46, 64, 3, K); box(g, 47, 46, 62, 1, '#6b7280');
  box(g, 108, 44, 4, 3, K);
  return c;
}
const HELI = buildHeli();

// Fluchtwagen (Lieferwagen)
function buildVan() {
  const W = 104, H = 50;
  const [c, g] = mkCanvas(W, H);
  const K = '#141318', b = '#e9e4d8', bl = '#ffffff', bd = '#b8b2a4', acc = '#ef5350';
  box(g, 2, 6, 74, 34, K); box(g, 3, 7, 72, 32, b); box(g, 3, 7, 72, 2, bl); box(g, 3, 34, 72, 4, bd);
  box(g, 3, 22, 72, 4, acc); box(g, 3, 22, 72, 1, shade(acc, 0.3));
  // Kabine
  g.fillStyle = K; g.beginPath(); g.moveTo(74, 10); g.lineTo(90, 10); g.lineTo(102, 24); g.lineTo(102, 40); g.lineTo(74, 40); g.closePath(); g.fill();
  g.fillStyle = b; g.beginPath(); g.moveTo(75, 11); g.lineTo(89, 11); g.lineTo(101, 25); g.lineTo(101, 38); g.lineTo(75, 38); g.closePath(); g.fill();
  g.fillStyle = '#7ec8f0'; g.beginPath(); g.moveTo(78, 13); g.lineTo(88, 13); g.lineTo(97, 23); g.lineTo(78, 23); g.closePath(); g.fill();
  box(g, 80, 14, 4, 1, '#d8f2ff');
  box(g, 75, 26, 27, 2, acc);
  box(g, 99, 30, 3, 3, '#ffe28a');
  // Hecktür offen
  box(g, 0, 8, 4, 30, K); box(g, 1, 9, 2, 28, '#d0cabc');
  box(g, 4, 9, 6, 28, '#0c0d12');
  // Räder
  for (const x of [20, 84]) {
    g.fillStyle = K; g.beginPath(); g.arc(x, 40, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3d46'; g.beginPath(); g.arc(x, 40, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa3b2'; g.beginPath(); g.arc(x, 40, 3, 0, Math.PI * 2); g.fill();
  }
  return c;
}
const VAN = buildVan();

// Geländewagen (Jeep)
function buildJeep() {
  const W = 96, H = 46;
  const [c, g] = mkCanvas(W, H);
  const K = '#141318', b = '#5f7a3a', bl = '#7f9a52', bd = '#3f5226';
  box(g, 6, 18, 86, 16, K); box(g, 7, 19, 84, 14, b); box(g, 7, 19, 84, 2, bl); box(g, 7, 30, 84, 3, bd);
  box(g, 22, 6, 34, 14, K); box(g, 23, 7, 32, 2, '#2a2a2a');
  box(g, 26, 9, 2, 10, K); box(g, 50, 9, 2, 10, K);
  box(g, 58, 10, 3, 9, K); box(g, 59, 11, 1, 8, '#7ec8f0');
  box(g, 88, 22, 4, 4, '#ffe28a');
  box(g, 2, 16, 6, 14, K); box(g, 3, 17, 4, 12, '#2a2a2a');
  for (const x of [22, 76]) {
    g.fillStyle = K; g.beginPath(); g.arc(x, 35, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#33363e'; g.beginPath(); g.arc(x, 35, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a929e'; g.beginPath(); g.arc(x, 35, 3, 0, Math.PI * 2); g.fill();
  }
  return c;
}
const JEEP = buildJeep();

// Fallschirm-Paket an der Wand
function buildChute() {
  return art([
    '..KKKKKK..',
    '.KggggggK.',
    'KgyyyyyygK',
    'KgyKyyKygK',
    'KgyyyyyygK',
    'KggggggggK',
    'KgKKggKKgK',
    'KggggggggK',
    '.KKKKKKKK.',
  ], { K: '#141318', g: '#4d6b39', y: '#f2d040' });
}
const CHUTE = buildChute();

// Fallschirm (offen) für die Flucht-Animation
function buildCanopy() {
  const [c, g] = mkCanvas(40, 22);
  g.fillStyle = '#141318'; g.beginPath(); g.ellipse(20, 10, 20, 10, 0, Math.PI, 0); g.fill();
  const cols = ['#ef5350', '#f4f4f0', '#ef5350', '#f4f4f0', '#ef5350'];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = cols[i];
    g.beginPath(); g.moveTo(20, 10);
    g.ellipse(20, 10, 19, 9, 0, Math.PI + i * Math.PI / 5, Math.PI + (i + 1) * Math.PI / 5); g.closePath(); g.fill();
  }
  box(g, 1, 10, 38, 1, '#141318');
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(2, 10); g.lineTo(20, 22); g.moveTo(38, 10); g.lineTo(20, 22); g.moveTo(14, 10); g.lineTo(20, 22); g.moveTo(26, 10); g.lineTo(20, 22); g.stroke();
  return c;
}
const CANOPY = buildCanopy();

// Warnschild für Gefahren (Brücke, Tunnel)
function buildWarn() {
  return art([
    '....KK....',
    '...KyyK...',
    '...KyyK...',
    '..KyKKyK..',
    '..KyKKyK..',
    '.KyyKKyyK.',
    '.KyyyyyyK.',
    'KyyyKKyyyK',
    'KyyyyyyyyK',
    'KKKKKKKKKK',
  ], { K: '#141318', y: '#f2c94c' });
}
const WARN = buildWarn();

// Zielmarke (Pfeil über dem Fluchtpunkt)
const GOAL_ARROW = art([
  '..KKKKK..',
  '..KgggK..',
  '..KgggK..',
  'KKKgggKKK',
  '.KgggggK.',
  '..KgggK..',
  '...KgK...',
  '....K....',
], { K: '#141318', g: '#6fdc8c' });

// Fadenkreuz
const CROSS = art([
  '...KWK...',
  '...KWK...',
  '.........',
  'KK.....KK',
  'WW..W..WW',
  'KK.....KK',
  '.........',
  '...KWK...',
  '...KWK...',
], { K: '#141318', W: '#ffffff' });
