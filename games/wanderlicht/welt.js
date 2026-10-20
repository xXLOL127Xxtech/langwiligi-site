'use strict';
// Wanderlicht – Welt: Zufall, Rauschen, Biome, Höhen und Orte (ohne Grafik)

const WATER = 0;
const CHUNK = 48, CHUNK_RES = 16;
const CELL = 280;

// ---------- Zufall ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(i, j, s) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ---------- Simplex-Rauschen 2D ----------
const GRAD = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1]);
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
class Simplex {
  constructor(seed) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { g = (perm[ii + perm[jj]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2); }
    return 70 * n;
  }
}
function fbm(n, x, y, oct) {
  let s = 0, a = 1, f = 1, t = 0;
  for (let i = 0; i < oct; i++) { s += a * n.noise(x * f, y * f); t += a; a *= 0.5; f *= 2.03; }
  return s / t;
}

// ---------- Biome ----------
function hexRGB(h) { return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }

const BIOMES = [
  { id: 'lavendel', name: 'Lavendelweite', t: 0.5, m: 0.58,
    ground: 0x45403a, groundHi: 0x5c5248, rock: 0x6a6070, stem: 0x6b6440, tip: 0xd9cdea,
    grass: 1.0, grassH: 1.5, trees: 0.35, tree: 'schirm', canopy: [0xb98ddc, 0x8a63b0, 0xd6b4f0], trunk: 0x2a2230,
    amp: 7, mnt: 4, det: 0.7, off: 3, dune: 0, cold: 0, petals: 0xd8c0f0, petalAmt: 0.6, flies: 1, dust: 0,
    sky: [0.06, 0.0, 0.1], fogAdd: 0.1, desat: 0.05, neon: 0.35, fly: 0xe070ff, neonC: [0xd060ff, 0x9a70ff, 0xff80e0] },
  { id: 'gold', name: 'Goldsteppe', t: 0.7, m: 0.4,
    ground: 0x7a6838, groundHi: 0x8e7a48, rock: 0x8a6e50, stem: 0x9a8444, tip: 0xf2d68c,
    grass: 0.85, grassH: 1.25, trees: 0.12, tree: 'akazie', canopy: [0xe0773a, 0xb4502a, 0xf09a50], trunk: 0x3a2a20,
    amp: 4, mnt: 3, det: 0.4, off: 3, dune: 0, cold: 0, petals: 0xf6dc90, petalAmt: 0.25, flies: 0.6, dust: 0.7,
    sky: [0.08, 0.04, -0.04], fogAdd: 0, desat: 0, neon: 0.1, fly: 0xd8ff50, neonC: [0xffe060, 0xd8ff50, 0xffb040] },
  { id: 'kirsch', name: 'Kirschhain', t: 0.44, m: 0.24,
    ground: 0x56704a, groundHi: 0x6a8256, rock: 0x7a7480, stem: 0x6f8c52, tip: 0xf6d0de,
    grass: 0.7, grassH: 0.9, trees: 0.6, tree: 'kirsch', canopy: [0xf4a8c8, 0xd77aa4, 0xffd2e4], trunk: 0x3b2a2e,
    amp: 12, mnt: 8, det: 1, off: 4, dune: 0, cold: 0.1, petals: 0xffc0d8, petalAmt: 1, flies: 0.3, dust: 0,
    sky: [0.06, 0.0, 0.03], fogAdd: 0.05, desat: 0, neon: 0.15, fly: 0xff70c0, neonC: [0xff70c0, 0xff9ad8, 0xc060ff] },
  { id: 'mondwald', name: 'Mondwald', t: 0.3, m: 0.78,
    ground: 0x284440, groundHi: 0x335450, rock: 0x4a5a66, stem: 0x2e5a54, tip: 0x92d4c6,
    grass: 0.55, grassH: 1.0, trees: 1.0, tree: 'tanne', canopy: [0x1f4f5c, 0x2d6f78, 0x5fb0b8], trunk: 0x1d1e26,
    amp: 14, mnt: 16, det: 1.2, off: 5, dune: 0, cold: 0.3, petals: 0x9fe8d8, petalAmt: 0.15, flies: 1, dust: 0,
    sky: [-0.02, 0.03, 0.06], fogAdd: 0.3, fogTint: [0.42, 0.5, 0.58], desat: 0.3, neon: 0.6, fly: 0x50e0ff, neonC: [0x40c0ff, 0x60ffe0, 0x8080ff] },
  { id: 'schnee', name: 'Schneeweite', t: 0.1, m: 0.5,
    ground: 0xd8e0ec, groundHi: 0xf4f6fc, rock: 0x7a8494, stem: 0xa8b4c8, tip: 0xffffff,
    grass: 0.18, grassH: 0.55, trees: 0.45, tree: 'schneetanne', canopy: [0x5a7a94, 0xe8f0ff, 0x8aa6c0], trunk: 0x2a2a34,
    amp: 18, mnt: 42, det: 1.5, off: 6, dune: 0, cold: 1, petals: 0xffffff, petalAmt: 0, flies: 0, dust: 0,
    sky: [0.02, 0.04, 0.08], fogAdd: 0.15, desat: 0.15, neon: 0.1, fly: 0xa0d0ff, neonC: [0x90c8ff, 0xc0e0ff, 0x80a0ff] },
  { id: 'duenen', name: 'Rote Dünen', t: 0.88, m: 0.16,
    ground: 0xc4784a, groundHi: 0xe0a060, rock: 0x9a4a34, stem: 0xa87e58, tip: 0xeccb90,
    grass: 0.08, grassH: 0.7, trees: 0.08, tree: 'tot', canopy: [0x804030, 0x603020, 0xa05030], trunk: 0x4a3024,
    amp: 5, mnt: 3, det: 0.3, off: 3, dune: 6, cold: 0, petals: 0xf0c890, petalAmt: 0, flies: 0, dust: 1,
    sky: [0.1, 0.03, -0.05], fogAdd: 0, desat: 0.05, neon: 0, fly: 0xffb050, neonC: [0xffa040, 0xff7040, 0xffd060] },
  { id: 'moor', name: 'Kristallmoor', t: 0.72, m: 0.84,
    ground: 0x2a5048, groundHi: 0x3a6656, rock: 0x4a6a78, stem: 0x3a7060, tip: 0x84f0da,
    grass: 0.75, grassH: 1.1, trees: 0.3, tree: 'weide', canopy: [0x3aa090, 0x24705e, 0x7ae0c8], trunk: 0x22282a,
    amp: 3.5, mnt: 0, det: 0.5, off: -0.3, dune: 0, cold: 0, petals: 0x9ff8e8, petalAmt: 0.3, flies: 1.4, dust: 0,
    sky: [-0.03, 0.05, 0.05], fogAdd: 0.35, fogTint: [0.3, 0.52, 0.48], desat: 0.1, neon: 0.9, fly: 0x40fff0, neonC: [0x30fff0, 0x80ff90, 0x40a0ff] },
  { id: 'toten', name: 'Totenwald', t: 0.2, m: 0.27,
    ground: 0x2a282c, groundHi: 0x38343a, rock: 0x48444a, stem: 0x3c382e, tip: 0x7a7258,
    grass: 0.45, grassH: 0.8, trees: 1.2, tree: 'knorrig', canopy: [0x2a2a24, 0x1a1a18, 0x4a4630], trunk: 0x161418,
    amp: 10, mnt: 9, det: 1.1, off: 4, dune: 0, cold: 0.25, petals: 0x8a8a70, petalAmt: 0.5, flies: 0.8, dust: 0,
    sky: [0.04, 0.04, -0.05], fogAdd: 0.6, fogTint: [0.6, 0.56, 0.14], desat: 0.75, neon: 0.25, fly: 0xd0ff40, neonC: [0xc8ff30, 0xa0ff60, 0xffff50] },
];
const NB = BIOMES.length;
for (const b of BIOMES) {
  b.groundC = hexRGB(b.ground); b.groundHiC = hexRGB(b.groundHi); b.rockC = hexRGB(b.rock);
  b.stemC = hexRGB(b.stem); b.tipC = hexRGB(b.tip); b.canopyC = b.canopy.map(hexRGB); b.trunkC = hexRGB(b.trunk);
  b.petalC = hexRGB(b.petals);
  b.fogTintC = b.fogTint || null;
  b.flyC = hexRGB(b.fly); b.neonCC = b.neonC.map(hexRGB);
  // Ferne Wiesen sollen die Farbe der Halme haben
  b.fieldC = b.groundC.map((v, i) => lerp(v, lerp(b.stemC[i], b.tipC[i], 0.45), 0.55 * Math.min(1, b.grass)));
}

// ---------- Welt-Zustand ----------
const World = {
  seed: 1, spawnX: 0, spawnZ: 0,
  nH: null, nT: null, nM: null, nD: null,
  sites: new Map(),
};

function initWorld(seed, spawn) {
  World.seed = seed >>> 0;
  World.nH = new Simplex(seed);
  World.nT = new Simplex(seed + 11);
  World.nM = new Simplex(seed + 23);
  World.nD = new Simplex(seed + 37);
  World.sites.clear();
  if (spawn) { World.spawnX = spawn[0]; World.spawnZ = spawn[1]; }
  else findSpawn();
}

// Start mitten in einer Lavendelweite, auf trockenem Boden
function findSpawn() {
  World.spawnX = 0; World.spawnZ = 0;
  let best = [0, 0], bestScore = -1;
  for (let ring = 0; ring < 40 && bestScore < 0.75; ring++) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + ring;
      const x = Math.cos(a) * ring * 160, z = Math.sin(a) * ring * 160;
      const w = weightsAt(x, z);
      const h = naturalHeight(x, z, w);
      const score = w[0] * (h > 1.5 && h < 12 ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = [x, z]; if (score >= 0.75) break; }
    }
  }
  World.spawnX = Math.round(best[0]); World.spawnZ = Math.round(best[1]);
}

const _w = new Float32Array(NB);
function weightsAt(x, z, out) {
  out = out || _w;
  const T = clamp01(0.5 + 1.0 * fbm(World.nT, x * 0.0011, z * 0.0011, 3));
  const M = clamp01(0.5 + 1.0 * fbm(World.nM, x * 0.0011 + 50, z * 0.0011 - 80, 3));
  let s = 0;
  for (let i = 0; i < NB; i++) {
    const b = BIOMES[i], dt = T - b.t, dm = M - b.m;
    const v = Math.exp(-(dt * dt + dm * dm) * 40);
    out[i] = v; s += v;
  }
  for (let i = 0; i < NB; i++) out[i] /= s;
  return out;
}

function naturalHeight(x, z, w) {
  w = w || weightsAt(x, z);
  let a = 0, mn = 0, dt = 0, off = 0, du = 0;
  for (let i = 0; i < NB; i++) {
    const b = BIOMES[i], k = w[i];
    a += k * b.amp; mn += k * b.mnt; dt += k * b.det; off += k * b.off; du += k * b.dune;
  }
  const n1 = fbm(World.nH, x * 0.0055, z * 0.0055, 4);
  let r = 1 - Math.abs(fbm(World.nH, x * 0.0024 + 300, z * 0.0024 - 120, 4));
  r = r * r * r;
  const n3 = World.nD.noise(x * 0.05, z * 0.05);
  const cont = fbm(World.nD, x * 0.0009 + 40, z * 0.0009, 2);
  let h = n1 * a + r * mn + n3 * dt + off + cont * (2 + a * 0.3);
  if (du > 0.02) {
    const dn = World.nD.noise(x * 0.008, z * 0.008);
    const ang = 0.6 + dn * 0.7;
    const u = x * Math.cos(ang) + z * Math.sin(ang);
    h += du * Math.pow(Math.abs(Math.sin(u * 0.04 + dn * 2.5)), 1.6);
  }
  return h;
}

function cellOf(x, z) { return [Math.floor(x / CELL), Math.floor(z / CELL)]; }

function applySites(x, z, h) {
  const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  const s = siteAt(ci, cj);
  if (!s || !s.flatR) return h;
  const dx = x - s.x, dz = z - s.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const R = s.flatR, F = s.flatF || 18;
  if (d >= R + F) return h;
  const t = smooth(R + F, R, d);
  return lerp(h, s.baseH, t);
}

function heightAt(x, z, w) {
  return applySites(x, z, naturalHeight(x, z, w || weightsAt(x, z)));
}

function dominantBiome(w) {
  let bi = 0;
  for (let i = 1; i < NB; i++) if (w[i] > w[bi]) bi = i;
  return bi;
}
// Biom per Zufall nach Gewicht wählen (mischt Übergänge natürlich)
function sampleBiome(w, r) {
  let acc = 0;
  for (let i = 0; i < NB; i++) { acc += w[i]; if (r <= acc) return i; }
  return NB - 1;
}

// ---------- Namen ----------
const NAME_A = ['Nebel', 'Silber', 'Mond', 'Stern', 'Aschen', 'Rosen', 'Wolken', 'Dämmer', 'Eis', 'Gold', 'Raben', 'Lilien', 'Sturm', 'Schatten', 'Glut', 'Kristall', 'Distel', 'Falken', 'Abend', 'Flieder'];
const NAME_B = ['wacht', 'horn', 'fels', 'stein', 'burg', 'hall', 'tor', 'fall', 'grund', 'feste', 'zinne', 'turm', 'krone', 'mark'];
const CASTLE_KIND = ['Burg', 'Feste', 'Schloss', 'Zitadelle', 'Burgruine', 'Turmfeste'];
const MERCHANTS = ['Mira', 'Oskar', 'Lenja', 'Taavi', 'Ilka', 'Bruno', 'Selma', 'Jorin', 'Fenna', 'Aurel', 'Nele', 'Corvin'];
const WANDERERS = ['Alte Hirtin', 'Stiller Pilger', 'Junge Malerin', 'Müder Barde', 'Sternenleser', 'Kräutersammlerin', 'Verirrter Ritter'];
const VIEW_NAMES = ['Wolkenrast', 'Abendhöhe', 'Die stille Bank', 'Sternenblick', 'Windkanzel', 'Fernsicht', 'Rast der Träumer', 'Himmelsbalkon', 'Der lange Blick', 'Dämmerbank'];

const WONDERS = {
  lichtbaum: { name: 'Der Lichtbaum', sub: 'Seine Blätter leuchten seit tausend Jahren.', flatR: 20, discR: 60 },
  inseln: { name: 'Die schwebenden Inseln', sub: 'Wasser fällt aus dem Himmel und kommt nie an.', flatR: 22, discR: 70 },
  wal: { name: 'Der Himmelswal', sub: 'Er zieht seine Kreise, seit es Wolken gibt.', flatR: 0, discR: 85 },
  kristalle: { name: 'Der Kristallgarten', sub: 'Die Steine summen leise im Wind.', flatR: 18, discR: 45 },
  saeule: { name: 'Die Lichtsäule', sub: 'Niemand weiss, wohin das Licht geht.', flatR: 16, discR: 50 },
  steinkreis: { name: 'Steinkreis der Stille', sub: 'Hier ruht man und wird wieder ganz.', flatR: 18, discR: 30 },
  riese: { name: 'Der kniende Riese', sub: 'Er wartet auf einen König, der nie kam.', flatR: 22, discR: 60 },
  mondtor: { name: 'Das Mondtor', sub: 'Dahinter liegt dieselbe Welt, nur stiller.', flatR: 16, discR: 45 },
  laternen: { name: 'Der Laternensee', sub: 'Jede Laterne ist ein Wunsch, der fliegen lernt.', flatR: 30, discR: 50 },
  bogen: { name: 'Der Himmelsbogen', sub: 'Ein Bogen aus Stein, so alt wie der Wind.', flatR: 0, discR: 50 },
};
const WONDER_KEYS = Object.keys(WONDERS);

// ---------- Orte im Raster ----------
function siteAt(ci, cj) {
  const key = ci + ',' + cj;
  if (World.sites.has(key)) return World.sites.get(key);
  const s = makeSite(ci, cj, key);
  World.sites.set(key, s);
  return s;
}

function makeSite(ci, cj, key) {
  const r = mulberry32(hash2(ci, cj, World.seed ^ 0x51ed));
  const ox = ci * CELL, oz = cj * CELL;
  const [sci, scj] = cellOf(World.spawnX, World.spawnZ);
  const spawnCell = ci === sci && cj === scj;
  const cx = ox + CELL / 2, cz = oz + CELL / 2;
  const distSpawn = Math.hypot(cx - World.spawnX, cz - World.spawnZ);
  let type;
  const roll = r();
  if (spawnCell) type = 'lager';
  else if (roll < 0.30) type = 'burg';
  else if (roll < 0.62) type = 'wunder';
  else if (roll < 0.74) type = 'lager';
  else if (roll < 0.85) type = 'aussicht';
  else if (roll < 0.93) type = 'wanderer';
  else return null;
  if (type === 'burg' && distSpawn < 420) type = 'wunder';

  const M = 64;
  let x = ox + M + r() * (CELL - 2 * M), z = oz + M + r() * (CELL - 2 * M);
  if (spawnCell) {
    x = clamp(World.spawnX + 14, ox + M, ox + CELL - M);
    z = clamp(World.spawnZ + 9, oz + M, oz + CELL - M);
  }
  const s = { key, type, ci, cj, x, z, seed: hash2(ci, cj, World.seed + 777), flatR: 0, flatF: 18, baseH: 0 };
  const w = weightsAt(x, z, new Float32Array(NB));
  s.biome = dominantBiome(w);
  const nat = naturalHeight(x, z, w);
  s.dist = Math.hypot(x - World.spawnX, z - World.spawnZ);
  s.level = 1 + s.dist / 700;

  if (type === 'aussicht') {
    // höchsten Punkt in der Umgebung suchen
    let bh = -1e9;
    for (let k = 0; k < 14; k++) {
      const px = ox + M + r() * (CELL - 2 * M), pz = oz + M + r() * (CELL - 2 * M);
      const h = naturalHeight(px, pz);
      if (h > bh) { bh = h; s.x = px; s.z = pz; }
    }
    s.baseH = Math.max(bh, 1.5);
    s.flatR = 4; s.flatF = 6;
    s.name = pick(r, VIEW_NAMES);
    s.discR = 10;
  } else if (type === 'burg') {
    s.radius = 18 + r() * 12;
    s.flatR = s.radius + 7;
    s.baseH = Math.max(nat, 1.6);
    s.name = pick(r, CASTLE_KIND) + ' ' + pick(r, NAME_A) + pick(r, NAME_B);
    const c = r();
    s.content = c < 0.36 ? 'boss' : c < 0.72 ? 'wachen' : 'leer';
    s.discR = s.radius + 16;
  } else if (type === 'wunder') {
    let wk;
    if (spawnCell) wk = 'steinkreis';
    else {
      // in der Nähe des Starts lieber etwas Spektakuläres
      wk = distSpawn < 420 ? pick(r, ['lichtbaum', 'inseln', 'wal', 'mondtor']) : WONDER_KEYS[Math.floor(r() * WONDER_KEYS.length)];
    }
    const def = WONDERS[wk];
    s.wonder = wk; s.name = def.name; s.sub = def.sub;
    s.flatR = def.flatR; s.discR = def.discR;
    s.baseH = Math.max(nat, 1.4);
    if (wk === 'laternen') { s.baseH = -2.6; s.flatF = 14; }
  } else if (type === 'lager') {
    s.flatR = 11; s.baseH = Math.max(nat, 1.4);
    s.merchant = pick(r, MERCHANTS);
    s.name = 'Lager von ' + s.merchant;
    s.discR = 22;
  } else if (type === 'wanderer') {
    s.flatR = 0; s.baseH = Math.max(nat, 0.5);
    s.npc = pick(r, WANDERERS);
    s.name = s.npc;
    s.discR = 0;
  }
  return s;
}

function sitesNear(x, z, rad) {
  const out = [];
  const c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL);
  const d0 = Math.floor((z - rad) / CELL), d1 = Math.floor((z + rad) / CELL);
  for (let i = c0; i <= c1; i++) for (let j = d0; j <= d1; j++) {
    const s = siteAt(i, j);
    if (s && Math.hypot(s.x - x, s.z - z) < rad) out.push(s);
  }
  return out;
}

// ---------- Bodenfarbe ----------
const SHORE = [0.62, 0.58, 0.5];
const SNOWC = [0.93, 0.95, 1.0];
function groundColor(x, z, h, slope, w, out) {
  let r = 0, g = 0, b = 0, rr = 0, rg = 0, rb = 0;
  const hi = smooth(2, 18, h);
  for (let i = 0; i < NB; i++) {
    const k = w[i]; if (k < 0.001) continue;
    const B = BIOMES[i];
    r += k * lerp(B.fieldC[0], B.groundHiC[0], hi * 0.5);
    g += k * lerp(B.fieldC[1], B.groundHiC[1], hi * 0.5);
    b += k * lerp(B.fieldC[2], B.groundHiC[2], hi * 0.5);
    rr += k * B.rockC[0]; rg += k * B.rockC[1]; rb += k * B.rockC[2];
  }
  const rock = smooth(0.55, 0.9, slope);
  r = lerp(r, rr, rock); g = lerp(g, rg, rock); b = lerp(b, rb, rock);
  const shore = smooth(1.1, 0.2, h) * (1 - w[6] * 0.7);
  r = lerp(r, SHORE[0], shore * 0.6); g = lerp(g, SHORE[1], shore * 0.6); b = lerp(b, SHORE[2], shore * 0.6);
  const snow = smooth(34, 44, h) * (1 - rock * 0.6);
  r = lerp(r, SNOWC[0], snow); g = lerp(g, SNOWC[1], snow); b = lerp(b, SNOWC[2], snow);
  // feine Flecken
  const n = World.nD.noise(x * 0.09, z * 0.09) * 0.06 + World.nD.noise(x * 0.013 + 9, z * 0.013) * 0.08;
  out[0] = r * (1 + n); out[1] = g * (1 + n); out[2] = b * (1 + n);
  return out;
}
