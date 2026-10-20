'use strict';
// =====================================================================
//  Welten: Farben, Hintergründe, Bodenkacheln und Dekoration
// =====================================================================
const THEME_ORDER = ['wiese', 'hoehle', 'wueste', 'wolken', 'schnee', 'abend', 'burg'];
const THEMES = {
  wiese: {
    name: 'Sonnenwiese', sky: ['#3d9cf5', '#8fd3ff', '#e2f6ff'], sun: { x: .78, y: .18, r: 46, c: '#fff6c2' },
    layers: [
      { style: 'berge', c1: '#8db9e3', c2: '#c3dcf2', cap: '#f4f9ff', base: .52, amp: .26, f: .06, seed: 3 },
      { style: 'huegel', c1: '#6cc35b', c2: '#9fe08a', base: .66, amp: .12, f: .18, seed: 5 },
      { style: 'baeume', c1: '#2f8f45', c2: '#4fb257', base: .78, amp: .07, f: .34, seed: 9 },
    ],
    ground: { style: 'gras', top: '#8ae657', top2: '#45b53c', body: '#d99a5b', body2: '#8e542a', dot: '#b97a42', dot2: '#f0b878' },
    stone: ['#ded2bf', '#a8957a'], brick: ['#e8874a', '#a8501f'], plat: 'holz',
    enemies: { kaefer: 6, schnecke: 3, hummel: 1 },
    deko: { back: ['baum', 'baum', 'busch'], front: ['busch', 'blume', 'blume', 'zaun', 'gras'] },
    ambient: 'pollen', clouds: 6,
    music: { scale: 'dur', root: 60, bpm: 128, lead: 'triangle' },
  },
  hoehle: {
    name: 'Kristallhöhle', sky: ['#0e0a1e', '#221840', '#33275a'], ceiling: true, dark: .28,
    layers: [
      { style: 'kristalle', c1: '#2a1f4e', c2: '#3a2c68', base: .62, amp: .3, f: .08, seed: 4, glow: '#8a7cff' },
      { style: 'stalag', c1: '#1c1536', c2: '#2a2050', base: .8, amp: .25, f: .22, seed: 8 },
    ],
    ground: { style: 'moos', top: '#5fe0cf', top2: '#2a9d8f', body: '#5d4c80', body2: '#251c3c', dot: '#7a68a6', dot2: '#9a88c8' },
    stone: ['#8f80c4', '#4f4282'], brick: ['#9a68d8', '#5a2e9a'], plat: 'kristall',
    enemies: { kaefer: 4, igel: 3, schnecke: 2 },
    deko: { back: [], front: ['kristall', 'kristall', 'pilz', 'pilz', 'stein'] },
    ambient: 'gluehw', clouds: 0,
    music: { scale: 'dorisch', root: 57, bpm: 106, lead: 'sine', comp: 'pad', legato: 1.4 },
  },
  wueste: {
    name: 'Dünenmeer', sky: ['#ff8a4c', '#ffc77e', '#fff0c4'], sun: { x: .25, y: .26, r: 70, c: '#fff3b0' },
    layers: [
      { style: 'tafel', c1: '#d9925c', c2: '#ecb27a', base: .56, amp: .2, f: .07, seed: 2 },
      { style: 'duenen', c1: '#eab06a', c2: '#f6cd8b', base: .7, amp: .1, f: .2, seed: 6 },
      { style: 'duenen', c1: '#df9d55', c2: '#f0bd76', base: .8, amp: .06, f: .36, seed: 11 },
    ],
    ground: { style: 'sand', top: '#ffe7a3', top2: '#f0c26a', body: '#e6aa62', body2: '#a86a33', dot: '#cf8f4c', dot2: '#f7c98a' },
    stone: ['#e8b77a', '#a8743f'], brick: ['#e0743a', '#9c4518'], plat: 'stein',
    enemies: { kaefer: 4, igel: 3, hummel: 2 },
    deko: { back: ['palme'], front: ['kaktus', 'kaktus', 'stein', 'gras'] },
    ambient: 'sand', clouds: 2,
    music: { scale: 'dorisch', root: 62, bpm: 120, lead: 'triangle' },
  },
  wolken: {
    name: 'Wolkenpfad', sky: ['#5ab4ff', '#b2e3ff', '#fdfdff'], sun: { x: .7, y: .14, r: 40, c: '#fffbe0' },
    layers: [
      { style: 'wolkenbank', c1: '#e9f5ff', c2: '#ffffff', base: .62, amp: .12, f: .06, seed: 3, alpha: .7 },
      { style: 'wolkenbank', c1: '#d6ecff', c2: '#f4faff', base: .82, amp: .08, f: .16, seed: 7, alpha: .85 },
    ],
    ground: { style: 'wolke', top: '#ffffff', top2: '#eef4ff', body: '#f2f6ff', body2: '#b9caee', dot: '#dce6fb', dot2: '#ffffff' },
    stone: ['#ffe9a8', '#d8a845'], brick: ['#f2a65a', '#b8652a'], plat: 'wolke',
    enemies: { hummel: 4, kaefer: 2, schnecke: 2 }, bottomless: true,
    deko: { back: [], front: ['puff'] },
    ambient: 'none', clouds: 12,
    music: { scale: 'dur', root: 65, bpm: 118, lead: 'sine', legato: 1.2 },
  },
  schnee: {
    name: 'Frostgipfel', sky: ['#6aa6e0', '#bcd9f2', '#f2f8ff'], ice: true,
    layers: [
      { style: 'berge', c1: '#9fb9d9', c2: '#d2e2f2', cap: '#ffffff', base: .5, amp: .3, f: .06, seed: 12 },
      { style: 'tannen', c1: '#5d86a8', c2: '#7fa3c2', base: .7, amp: .1, f: .2, seed: 4 },
      { style: 'tannen', c1: '#3f6687', c2: '#5a809f', base: .82, amp: .07, f: .36, seed: 10 },
    ],
    ground: { style: 'schnee', top: '#ffffff', top2: '#d4e6f8', body: '#8aa6c8', body2: '#48627f', dot: '#a6bdd8', dot2: '#c8daee' },
    stone: ['#c4ecff', '#6fb4dc'], brick: ['#cc6b4c', '#86361f'], plat: 'eis',
    enemies: { schnecke: 3, igel: 3, kaefer: 3 },
    deko: { back: ['tanne', 'tanne'], front: ['schneemann', 'busch', 'stein'] },
    ambient: 'schnee', clouds: 3,
    music: { scale: 'dur', root: 64, bpm: 112, lead: 'sine', legato: 1.1 },
  },
  abend: {
    name: 'Abendwald', sky: ['#2b2668', '#b84f7c', '#ffb36b'], sun: { x: .62, y: .5, r: 80, c: '#ffcf8a' },
    layers: [
      { style: 'berge', c1: '#5d3f7e', c2: '#8a5a8e', cap: null, base: .62, amp: .22, f: .06, seed: 5 },
      { style: 'baeume', c1: '#3a2550', c2: '#523868', base: .74, amp: .08, f: .2, seed: 13 },
      { style: 'baeume', c1: '#24163a', c2: '#352552', base: .84, amp: .06, f: .36, seed: 21 },
    ],
    ground: { style: 'gras', top: '#e5b24a', top2: '#b0702a', body: '#7e4f3c', body2: '#3a2220', dot: '#5f392d', dot2: '#9a6a52' },
    stone: ['#b0a0b4', '#6a5a72'], brick: ['#cf6a33', '#7f3315'], plat: 'holz',
    enemies: { kaefer: 4, schnecke: 3, igel: 2, hummel: 2 },
    deko: { back: ['herbstbaum', 'herbstbaum'], front: ['laterne', 'busch', 'pilz', 'gras'] },
    ambient: 'blaetter', clouds: 3,
    music: { scale: 'mixo', root: 62, bpm: 116, lead: 'triangle' },
  },
  burg: {
    name: 'Lavaburg', sky: ['#14070a', '#3a1210', '#71230f'], ceiling: true, lava: true, dark: .2,
    layers: [
      { style: 'burg', c1: '#2a1214', c2: '#3a1a1a', base: .6, amp: .3, f: .08, seed: 7 },
      { style: 'burg', c1: '#1d0b0e', c2: '#2b1214', base: .78, amp: .2, f: .22, seed: 15 },
    ],
    ground: { style: 'burg', top: '#8a8796', top2: '#5c5968', body: '#4a4654', body2: '#211e28', dot: '#5f5b6b', dot2: '#76728a' },
    stone: ['#7a7488', '#3f3a4c'], brick: ['#9a4434', '#5a1e14'], plat: 'gitter',
    enemies: { kaefer: 2, igel: 3, schnecke: 1 },
    deko: { back: ['kette'], front: ['fackel', 'stein'] },
    ambient: 'funken', clouds: 0,
    music: { scale: 'moll', root: 57, bpm: 134, lead: 'triangle' },
  },
};

// ---------------------------------------------------------------------
//  Hintergrund-Ebenen (einmal pro Bildschirmgrösse vorgezeichnet, kachelbar)
// ---------------------------------------------------------------------
const BG_W = 1600;
function buildBackground(theme, hpx) {
  const out = [];
  for (const L of theme.layers) {
    const c = document.createElement('canvas');
    c.width = BG_W; c.height = Math.max(2, Math.round(hpx));
    const g = c.getContext('2d');
    paintLayer(g, L, BG_W, c.height);
    out.push({ canvas: c, f: L.f, alpha: L.alpha || 1 });
  }
  return out;
}
function paintLayer(g, L, W, H) {
  const rng = makeRng(L.seed * 977);
  const base = L.base * H, amp = L.amp * H;
  const grad = g.createLinearGradient(0, base - amp, 0, H);
  grad.addColorStop(0, L.c2); grad.addColorStop(1, L.c1);
  g.fillStyle = grad;
  const ph = [rng.f() * TAU, rng.f() * TAU, rng.f() * TAU, rng.f() * TAU];
  const P = k => TAU * k / W;
  if (L.style === 'huegel' || L.style === 'duenen' || L.style === 'wolkenbank') {
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      let y;
      if (L.style === 'duenen') {
        const s = Math.sin(x * P(3) + ph[0]);
        y = base - amp * (0.55 * Math.pow((s + 1) / 2, 1.6) + 0.3 * Math.sin(x * P(7) + ph[1]) * 0.5 + 0.15 * Math.sin(x * P(13) + ph[2]));
      } else if (L.style === 'wolkenbank') {
        y = base - amp * (0.5 + 0.5 * Math.abs(Math.sin(x * P(9) + ph[0])) * 0.8 + 0.3 * Math.abs(Math.sin(x * P(23) + ph[1])));
      } else {
        y = base - amp * (0.55 * Math.sin(x * P(2) + ph[0]) + 0.3 * Math.sin(x * P(5) + ph[1]) + 0.15 * Math.sin(x * P(11) + ph[2]));
      }
      g.lineTo(x, y);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    if (L.style === 'huegel') {     // weiche Lichtkante oben
      g.save(); g.clip();
      g.globalAlpha = .18; g.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) { const x = (i + .5) * W / 9 + rng.f() * 60; g.beginPath(); g.ellipse(x, base + amp * .2, 60 + rng.f() * 60, 20, 0, 0, TAU); g.fill(); }
      g.restore();
    }
  } else if (L.style === 'berge') {
    const peaks = [];
    const n = 7;
    for (let i = 0; i < n; i++) peaks.push({ x: (i + rng.f() * .6) * W / n, h: amp * (0.5 + rng.f() * 0.5), w: W / n * (0.8 + rng.f() * 0.5) });
    for (const pk of peaks) {
      for (const dx of [-W, 0, W]) {
        const cx = pk.x + dx, top = base - pk.h;
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(cx - pk.w, H); g.lineTo(cx - pk.w * .55, base - pk.h * .35);
        g.quadraticCurveTo(cx - pk.w * .15, top - 8, cx, top); g.quadraticCurveTo(cx + pk.w * .2, top - 4, cx + pk.w * .5, base - pk.h * .45);
        g.lineTo(cx + pk.w, H); g.closePath(); g.fill();
        // Schattenseite
        g.fillStyle = 'rgba(30,40,80,.12)';
        g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(cx + pk.w * .2, top - 4, cx + pk.w * .5, base - pk.h * .45); g.lineTo(cx + pk.w, H); g.lineTo(cx + pk.w * .1, H); g.closePath(); g.fill();
        if (L.cap) {
          g.fillStyle = L.cap;
          g.beginPath(); g.moveTo(cx, top);
          g.quadraticCurveTo(cx + pk.w * .12, top + 2, cx + pk.w * .2, top + pk.h * .2);
          g.lineTo(cx + pk.w * .1, top + pk.h * .16); g.lineTo(cx, top + pk.h * .24); g.lineTo(cx - pk.w * .1, top + pk.h * .15);
          g.lineTo(cx - pk.w * .2, top + pk.h * .22); g.quadraticCurveTo(cx - pk.w * .1, top, cx, top); g.fill();
        }
      }
    }
  } else if (L.style === 'tafel') {
    g.beginPath(); g.moveTo(0, H);
    let x = 0;
    while (x < W) {
      const w = 120 + rng.f() * 200, h = amp * (0.3 + rng.f() * 0.7), top = base - h;
      g.lineTo(x, base); g.lineTo(x + 30, top + 10); g.lineTo(x + 40, top); g.lineTo(x + w - 40, top); g.lineTo(x + w - 30, top + 10);
      x += w; g.lineTo(Math.min(x, W), base);
      x += 40 + rng.f() * 120;
    }
    g.lineTo(W, base); g.lineTo(W, H); g.closePath(); g.fill();
    g.fillRect(0, base, W, H - base);
  } else if (L.style === 'baeume' || L.style === 'tannen') {
    g.fillRect(0, base, W, H - base);
    const n = Math.round(W / 46);
    for (let i = 0; i < n; i++) {
      const x = i * W / n + rng.f() * 20, h = amp * (0.6 + rng.f() * 0.8), r = 26 + rng.f() * 22;
      for (const dx of [-W, 0, W]) {
        const cx = x + dx;
        if (L.style === 'tannen') {
          g.beginPath(); g.moveTo(cx, base - h - 40);
          g.lineTo(cx + r * .9, base + 4); g.lineTo(cx - r * .9, base + 4); g.closePath(); g.fill();
        } else {
          g.beginPath(); g.arc(cx, base - h + r * .4, r, 0, TAU); g.arc(cx + r * .6, base - h * .5 + r * .5, r * .8, 0, TAU);
          g.arc(cx - r * .6, base - h * .5 + r * .5, r * .75, 0, TAU); g.fill();
          g.fillRect(cx - r * .9, base - h * .5 + r * .5, r * 1.8, h * .5);
        }
      }
    }
  } else if (L.style === 'kristalle' || L.style === 'stalag') {
    g.fillRect(0, base, W, H - base);
    const n = L.style === 'stalag' ? 16 : 22;
    for (let i = 0; i < n; i++) {
      const x = i * W / n + rng.f() * 30, h = amp * (0.3 + rng.f() * 0.9), w = 20 + rng.f() * 40;
      for (const dx of [-W, 0, W]) {
        const cx = x + dx;
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(cx - w, base + 2); g.lineTo(cx - w * .3, base - h); g.lineTo(cx + w * .2, base - h * 1.05); g.lineTo(cx + w, base + 2); g.closePath(); g.fill();
        if (L.style === 'stalag') {   // Tropfsteine von oben
          const h2 = amp * (0.3 + rng.f() * .7);
          g.beginPath(); g.moveTo(cx - w * .8 + 40, 0); g.lineTo(cx + 40, h2); g.lineTo(cx + w * .8 + 40, 0); g.closePath(); g.fill();
        }
        if (L.glow && rng.chance(.5)) {
          g.fillStyle = L.glow; g.globalAlpha = .35;
          g.beginPath(); g.moveTo(cx - w * .2, base - h * .3); g.lineTo(cx, base - h * .85); g.lineTo(cx + w * .15, base - h * .3); g.closePath(); g.fill();
          g.globalAlpha = 1;
        }
      }
    }
    if (L.style === 'kristalle') g.fillRect(0, 0, W, H * .12);
  } else if (L.style === 'burg') {
    g.fillRect(0, base, W, H - base);
    let x = 0;
    while (x < W) {
      const w = 80 + rng.f() * 140, h = amp * (0.3 + rng.f() * 0.7), top = base - h;
      g.fillRect(x, top, w, h + 2);
      for (let cx = x; cx < x + w - 10; cx += 22) g.fillRect(cx, top - 14, 13, 15);
      if (rng.chance(.5)) {    // Turm
        const tx = x + w * .3, tw = 46, th = h + 70;
        g.fillRect(tx, base - th, tw, th);
        g.beginPath(); g.moveTo(tx - 8, base - th); g.lineTo(tx + tw / 2, base - th - 60); g.lineTo(tx + tw + 8, base - th); g.fill();
        g.fillStyle = 'rgba(255,140,50,.5)'; g.fillRect(tx + tw / 2 - 5, base - th + 24, 10, 16); g.fillStyle = grad;
      }
      x += w + 20 + rng.f() * 60;
    }
  }
}

// Wolken-Bild (weich, einmal gezeichnet)
let cloudSprite = null;
function getCloudSprite() {
  if (cloudSprite) return cloudSprite;
  const c = document.createElement('canvas'); c.width = 320; c.height = 150;
  const g = c.getContext('2d');
  const blobs = [[90, 95, 50], [150, 70, 62], [215, 88, 50], [255, 105, 34], [55, 110, 32], [160, 108, 50]];
  g.fillStyle = 'rgba(160,190,230,.35)';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + 4, y + 10, r, 0, TAU); g.fill(); }
  const gr = g.createLinearGradient(0, 20, 0, 150); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e4effc');
  g.fillStyle = gr;
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  cloudSprite = c; return c;
}

// ---------------------------------------------------------------------
//  Kacheln zeichnen (für den Zwischenspeicher pro Abschnitt)
// ---------------------------------------------------------------------
const TILE = { EMPTY: 0, G: 1, S: 2, B: 3, Q: 4, U: 5, H: 6, P: 7, X: 8, C: 9, V: 10 };
function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}

function paintChunk(g, L, x0, x1) {
  const th = L.theme, gr = th.ground;
  const isG = (tx, ty) => { if (tx < 0 || tx >= L.w || ty >= L.h || ty < 0) return true; return L.g[ty * L.w + tx] === TILE.G; };
  const tx0 = Math.max(0, Math.floor(x0 / T) - 1), tx1 = Math.min(L.w - 1, Math.ceil(x1 / T) + 1);
  // Hintere Deko
  for (const d of L.deko) if (d.back && d.x > x0 - 300 && d.x < x1 + 300) paintDeko(g, d, th);
  const body = g.createLinearGradient(0, 0, 0, L.h * T);
  body.addColorStop(0, gr.body); body.addColorStop(1, gr.body2);
  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = L.g[ty * L.w + tx];
      if (c === TILE.G) paintGround(g, tx, ty, isG, th, body);
      else if (c === TILE.S) paintStone(g, tx * T, ty * T, th, hash2(tx, ty));
      else if (c === TILE.P) paintPlat(g, tx, ty, L, th);
      else if (c === TILE.X) paintSpikes(g, tx * T, ty * T, th);
    }
  }
  // Grasnarbe / Schneedecke oben drüber (damit sie über Nachbarkacheln ragt)
  for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (L.g[ty * L.w + tx] === TILE.G && !isG(tx, ty - 1)) paintTop(g, tx, ty, isG, th);
  }
  for (const d of L.deko) if (!d.back && !d.dyn && d.x > x0 - 200 && d.x < x1 + 200) paintDeko(g, d, th);
}

function paintGround(g, tx, ty, isG, th, body) {
  const x = tx * T, y = ty * T, gr = th.ground;
  const up = !isG(tx, ty - 1), dn = !isG(tx, ty + 1), lf = !isG(tx - 1, ty), rt = !isG(tx + 1, ty);
  const R = gr.style === 'burg' ? 6 : 18;
  g.fillStyle = body;
  rr(g, x, y, T + (rt ? 0 : 1), T + (dn ? 0 : 1), [up && lf ? R : 0, up && rt ? R : 0, dn && rt ? R : 0, dn && lf ? R : 0]);
  g.fill();
  const h = hash2(tx, ty), h2 = hash2(tx + 31, ty * 7);
  if (gr.style === 'burg') {
    // Mauerwerk
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y + T / 2); g.lineTo(x + T, y + T / 2);
    const off = (ty % 2) ? T / 2 : 0;
    g.moveTo(x + off + 1, y); g.lineTo(x + off + 1, y + T / 2);
    g.moveTo(x + (off + T / 2) % T + 1, y + T / 2); g.lineTo(x + (off + T / 2) % T + 1, y + T);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 2, y + 2, T - 4, 5);
  } else if (gr.style === 'wolke') {
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.arc(x + h * T, y + h2 * T, 8 + h * 8, 0, TAU); g.fill();
  } else {
    // Steinchen im Boden
    g.fillStyle = gr.dot;
    g.beginPath(); g.ellipse(x + 8 + h * 30, y + 10 + h2 * 28, 6 + h2 * 4, 4 + h * 3, h * 3, 0, TAU); g.fill();
    if (h > .45) { g.beginPath(); g.ellipse(x + 10 + h2 * 26, y + 28 + h * 10, 3 + h * 3, 2.5, 0, 0, TAU); g.fill(); }
    g.fillStyle = gr.dot2; g.globalAlpha = .5;
    g.beginPath(); g.ellipse(x + 6 + h * 30, y + 8 + h2 * 28, 2.5, 1.5, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    if (gr.style === 'moos' && h > .6) {   // kleine Kristalle im Fels
      g.fillStyle = '#b39cff'; g.globalAlpha = .7;
      g.beginPath(); g.moveTo(x + h2 * 30 + 6, y + 30); g.lineTo(x + h2 * 30 + 10, y + 18); g.lineTo(x + h2 * 30 + 14, y + 30); g.fill();
      g.globalAlpha = 1;
    }
  }
  // Seitenkanten dunkler
  g.fillStyle = 'rgba(0,0,0,.14)';
  if (lf) g.fillRect(x, y + (up ? R : 0), 5, T - (up ? R : 0) - (dn ? R : 0));
  if (rt) g.fillRect(x + T - 5, y + (up ? R : 0), 5, T - (up ? R : 0) - (dn ? R : 0));
  if (dn) {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + (lf ? R : 0), y + T - 6, T - (lf ? R : 0) - (rt ? R : 0), 6);
    if (th.ceiling && ty < 3) {   // Tropfsteine an der Decke
      g.fillStyle = gr.body2;
      if (h > .35) { g.beginPath(); g.moveTo(x + 8 + h * 16, y + T - 2); g.lineTo(x + 16 + h * 16, y + T + 14 + h2 * 16); g.lineTo(x + 24 + h * 16, y + T - 2); g.fill(); }
    }
  }
}

function paintTop(g, tx, ty, isG, th) {
  const x = tx * T, y = ty * T, gr = th.ground;
  const lf = !isG(tx - 1, ty), rt = !isG(tx + 1, ty);
  const ox = lf ? -3 : 0, w = T + (lf ? 3 : 0) + (rt ? 3 : 0) + (rt ? 0 : 1);
  const h = hash2(tx * 3, ty);
  const grad = g.createLinearGradient(0, y - 4, 0, y + 20);
  grad.addColorStop(0, gr.top); grad.addColorStop(1, gr.top2);
  g.fillStyle = grad;
  if (gr.style === 'wolke') {
    g.fillStyle = gr.top;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 8 + i * 16, y + 6 - (i === 1 ? 3 : 0), 14 + h * 3, 0, TAU); g.fill(); }
    if (lf) { g.beginPath(); g.arc(x + 4, y + 14, 14, 0, TAU); g.fill(); }
    if (rt) { g.beginPath(); g.arc(x + T - 4, y + 14, 14, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(150,180,230,.25)'; g.fillRect(x + (lf ? 10 : 0), y + 16, T - (lf ? 10 : 0) - (rt ? 10 : 0), 4);
    return;
  }
  if (gr.style === 'burg') {
    rr(g, x + ox, y - 2, w, 14, [lf ? 5 : 0, rt ? 5 : 0, 0, 0]); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + ox, y - 2, w, 3);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + ox, y + 11, w, 2);
    return;
  }
  const depth = gr.style === 'schnee' ? 18 : gr.style === 'sand' ? 12 : 15;
  g.beginPath();
  g.moveTo(x + ox, y + depth * .6);
  if (lf) { g.quadraticCurveTo(x + ox, y - 3, x + 8, y - 3); } else g.lineTo(x + ox, y - 3);
  g.lineTo(x + T - (rt ? 8 : 0), y - 3);
  if (rt) g.quadraticCurveTo(x + T + 3, y - 3, x + T + 3, y + depth * .6);
  else g.lineTo(x + T + 1, y - 3);
  // gewellter Unterrand
  const n = 3;
  const xr = x + T + (rt ? 3 : 1), xl = x + ox;
  g.lineTo(xr, y + depth * .7);
  for (let i = n; i > 0; i--) {
    const sx = xl + (xr - xl) * i / n, ex = xl + (xr - xl) * (i - 1) / n;
    g.quadraticCurveTo((sx + ex) / 2, y + depth + (gr.style === 'schnee' ? 8 * hash2(tx, i) : 4), ex, y + depth * .7);
  }
  g.closePath(); g.fill();
  // Glanzkante
  g.fillStyle = 'rgba(255,255,255,' + (gr.style === 'schnee' ? .9 : .32) + ')';
  rr(g, x + (lf ? 4 : 0), y - 3, T - (lf ? 4 : 0) - (rt ? 4 : 0) + (rt ? 0 : 1), 3, 2); g.fill();
  if (gr.style === 'gras' || gr.style === 'moos') {
    // Grashalme
    g.fillStyle = gr.top;
    for (let i = 0; i < 3; i++) {
      const bx = x + 6 + i * 15 + h * 6;
      if (hash2(tx, i + ty * 5) < .55) continue;
      g.beginPath(); g.moveTo(bx - 3, y); g.quadraticCurveTo(bx, y - 6, bx + 1, y - 9); g.quadraticCurveTo(bx + 1, y - 4, bx + 3, y); g.fill();
    }
    if (gr.style === 'moos' && h > .5) {
      g.fillStyle = '#c4fff6';
      g.beginPath(); g.arc(x + h * 40 + 4, y + 6, 2, 0, TAU); g.fill();
    }
  } else if (gr.style === 'schnee') {
    g.fillStyle = 'rgba(160,200,240,.5)';
    g.beginPath(); g.arc(x + h * 40 + 4, y + 7, 1.8, 0, TAU); g.fill();
  } else if (gr.style === 'sand') {
    g.strokeStyle = 'rgba(200,130,60,.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 6, y + 6 + h * 3); g.quadraticCurveTo(x + 24, y + 3, x + 42, y + 7 - h * 2); g.stroke();
  }
}

function paintStone(g, x, y, th, h) {
  const [c1, c2] = th.stone;
  const grad = g.createLinearGradient(x, y, x + T, y + T);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2);
  g.fillStyle = grad; rr(g, x + 1, y + 1, T - 2, T - 2, 8); g.fill();
  if (th.plat === 'eis') {
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.moveTo(x + 8, y + 30); g.lineTo(x + 26, y + 8); g.lineTo(x + 34, y + 8); g.lineTo(x + 14, y + 34); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; rr(g, x + 2.5, y + 2.5, T - 5, T - 5, 7); g.stroke();
    return;
  }
  g.fillStyle = 'rgba(255,255,255,.28)'; rr(g, x + 5, y + 4, T - 10, 6, 3); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; rr(g, x + 5, y + T - 9, T - 10, 5, 3); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x + 12 + h * 10, y + 14); g.lineTo(x + 20 + h * 8, y + 24); g.lineTo(x + 16 + h * 10, y + 32); g.stroke();
}

function paintPlat(g, tx, ty, L, th) {
  const x = tx * T, y = ty * T;
  const lf = tx === 0 || L.g[ty * L.w + tx - 1] !== TILE.P, rt = tx === L.w - 1 || L.g[ty * L.w + tx + 1] !== TILE.P;
  const st = th.plat;
  if (st === 'wolke') {
    g.fillStyle = 'rgba(150,180,230,.35)';
    g.beginPath(); g.ellipse(x + T / 2, y + 22, T / 2 + 6, 9, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x + 12, y + 12, 13, 0, TAU); g.arc(x + 34, y + 10, 15, 0, TAU); g.ellipse(x + T / 2, y + 16, T / 2 + 4, 8, 0, 0, TAU); g.fill();
    return;
  }
  const cols = {
    holz: ['#d9954a', '#8c5222', '#f2bf7a'], stein: ['#e8b77a', '#a8743f', '#ffe0ac'], kristall: ['#9f7cff', '#4e2fae', '#e2d4ff'],
    eis: ['#bfe9ff', '#5ea9d6', '#ffffff'], gitter: ['#8b8798', '#3d3a48', '#c4c0d0'],
  }[st];
  const grad = g.createLinearGradient(0, y, 0, y + 20);
  grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
  g.fillStyle = 'rgba(0,0,0,.18)'; rr(g, x + (lf ? 4 : 0), y + 18, T - (lf ? 4 : 0) - (rt ? 4 : 0), 6, 3); g.fill();
  g.fillStyle = grad;
  rr(g, x - (lf ? 2 : 0), y, T + (lf ? 2 : 0) + (rt ? 2 : 1), 20, [lf ? 9 : 0, rt ? 9 : 0, rt ? 9 : 0, lf ? 9 : 0]); g.fill();
  g.fillStyle = cols[2]; g.globalAlpha = .6;
  rr(g, x + (lf ? 3 : 0), y + 2, T - (lf ? 3 : 0) - (rt ? 3 : 0) + (rt ? 0 : 1), 4, 2); g.fill();
  g.globalAlpha = 1;
  if (st === 'holz') {
    g.strokeStyle = 'rgba(80,40,10,.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 4, y + 11); g.lineTo(x + T - 4, y + 12); g.stroke();
    g.fillStyle = '#5a3412'; g.beginPath(); g.arc(x + T / 2, y + 10, 2.4, 0, TAU); g.fill();
  } else if (st === 'gitter') {
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11, y + 8, 6, 8);
  } else if (st === 'kristall') {
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.beginPath(); g.moveTo(x + 6, y + 18); g.lineTo(x + 18, y + 4); g.lineTo(x + 24, y + 4); g.lineTo(x + 12, y + 18); g.fill();
  }
}

function paintSpikes(g, x, y, th) {
  g.fillStyle = '#5b5868'; rr(g, x + 1, y + T - 10, T - 2, 10, 3); g.fill();
  for (let i = 0; i < 3; i++) {
    const sx = x + 2 + i * 15;
    const grad = g.createLinearGradient(sx, 0, sx + 15, 0);
    grad.addColorStop(0, '#f2f4fa'); grad.addColorStop(.5, '#b8bccb'); grad.addColorStop(1, '#6f7385');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(sx, y + T - 9); g.lineTo(sx + 7.5, y + 12); g.lineTo(sx + 15, y + T - 9); g.closePath(); g.fill();
  }
}

// ---------------------------------------------------------------------
//  Dekoration (Bäume, Büsche, Kristalle ...)
// ---------------------------------------------------------------------
function paintDeko(g, d, th) {
  const { x, y } = d, s = d.s || 1, h = d.h || 0.5;
  g.save(); g.translate(x, y); g.scale(s, s);
  switch (d.kind) {
    case 'baum': case 'herbstbaum': {
      const leaf = d.kind === 'baum' ? ['#3fae4a', '#7fd65c', '#2d8a3c'] : ['#d9762e', '#f5b04a', '#a8441e'];
      g.fillStyle = '#7a4a2a'; rr(g, -9, -110, 18, 112, 6); g.fill();
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(2, -110, 7, 110);
      const blobs = [[0, -150, 46], [-34, -120, 34], [34, -118, 36], [-14, -175, 30], [20, -168, 28]];
      g.fillStyle = leaf[2]; for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(bx + 3, by + 6, r, 0, TAU); g.fill(); }
      g.fillStyle = leaf[0]; for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill(); }
      g.fillStyle = leaf[1]; g.globalAlpha = .7;
      for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(bx - r * .3, by - r * .35, r * .45, 0, TAU); g.fill(); }
      break;
    }
    case 'tanne': {
      g.fillStyle = '#6a4a32'; g.fillRect(-7, -30, 14, 32);
      const lay = [[-130, 30], [-95, 42], [-60, 54]];
      for (const [ly, w] of lay) {
        g.fillStyle = '#2f6b5a';
        g.beginPath(); g.moveTo(0, ly - 50); g.lineTo(w, ly + 30); g.lineTo(-w, ly + 30); g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(0, ly - 50); g.lineTo(w * .45, ly - 14); g.quadraticCurveTo(0, ly - 6, -w * .45, ly - 14); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-w, ly + 30); g.quadraticCurveTo(0, ly + 20, w, ly + 30); g.lineTo(w * .8, ly + 24); g.quadraticCurveTo(0, ly + 14, -w * .8, ly + 24); g.fill();
      }
      break;
    }
    case 'palme': {
      g.strokeStyle = '#9a6a3a'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -80, 26, -150); g.stroke();
      g.fillStyle = '#4c9a3c';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * .55;
        g.save(); g.translate(26, -150); g.rotate(a);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, -18, 78, 14); g.quadraticCurveTo(40, -2, 0, 0); g.fill();
        g.restore();
      }
      break;
    }
    case 'busch': {
      const c = th.ground.style === 'schnee' ? ['#5b8a7a', '#ffffff', '#3d6a5c'] : th === THEMES.abend ? ['#b85f2a', '#e89a48', '#7f3a18'] : ['#3fae4a', '#86dd62', '#2a8238'];
      const bl = [[-26, -16, 20], [0, -26, 26], [26, -16, 20]];
      g.fillStyle = c[2]; for (const [bx, by, r] of bl) { g.beginPath(); g.arc(bx, by + 4, r, 0, TAU); g.fill(); }
      g.fillStyle = c[0]; for (const [bx, by, r] of bl) { g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill(); }
      g.fillStyle = c[1]; g.globalAlpha = .75;
      for (const [bx, by, r] of bl) { g.beginPath(); g.ellipse(bx - r * .25, by - r * .45, r * .5, r * .3, 0, 0, TAU); g.fill(); }
      break;
    }
    case 'blume': {
      const col = ['#ff6fa8', '#ffd23a', '#ffffff', '#b57cff', '#ff8a4a'][Math.floor(h * 5)];
      g.strokeStyle = '#3a9a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-4, -12, 0, -24); g.stroke();
      g.fillStyle = '#4fbf4a'; g.beginPath(); g.ellipse(-6, -10, 6, 3, -.5, 0, TAU); g.fill();
      g.fillStyle = col;
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * 6, -24 + Math.sin(a) * 6, 5, 0, TAU); g.fill(); }
      g.fillStyle = '#ffb22e'; g.beginPath(); g.arc(0, -24, 4, 0, TAU); g.fill();
      break;
    }
    case 'gras': {
      g.fillStyle = th.ground.top2;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 6 - 3, 0); g.quadraticCurveTo(i * 8, -10, i * 9, -16 - Math.abs(i - .5) * -2); g.quadraticCurveTo(i * 6 + 1, -6, i * 6 + 3, 0); g.fill(); }
      break;
    }
    case 'zaun': {
      g.fillStyle = '#f4e3c4'; g.strokeStyle = '#b8955e'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { rr(g, -40 + i * 30, -38, 12, 38, [6, 6, 0, 0]); g.fill(); g.stroke(); }
      rr(g, -46, -28, 92, 7, 3); g.fill(); g.stroke();
      break;
    }
    case 'kristall': {
      const cols = [['#b49cff', '#6a4ad8'], ['#7fe8ff', '#2a8ec8'], ['#ff9ad8', '#c03a8e']][Math.floor(h * 3)];
      const cr = [[-14, 34, -.3], [0, 52, 0], [14, 30, .35]];
      for (const [cx, ch, a] of cr) {
        g.save(); g.translate(cx, 0); g.rotate(a);
        const grd = g.createLinearGradient(-8, 0, 8, 0); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]);
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(-8, 0); g.lineTo(-8, -ch + 12); g.lineTo(0, -ch); g.lineTo(8, -ch + 12); g.lineTo(8, 0); g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(-5, -4); g.lineTo(-5, -ch + 13); g.lineTo(0, -ch + 4); g.lineTo(-1, -4); g.fill();
        g.restore();
      }
      break;
    }
    case 'pilz': {
      const cap = th === THEMES.abend ? ['#e0603a', '#ffd0a0'] : ['#5ad6ff', '#c8f6ff'];
      g.fillStyle = '#efe4d0'; rr(g, -6, -26, 12, 26, 5); g.fill();
      g.fillStyle = cap[0]; g.beginPath(); g.ellipse(0, -26, 20, 14, 0, Math.PI, TAU); g.fill();
      g.fillStyle = cap[1]; g.globalAlpha = .8;
      g.beginPath(); g.arc(-8, -32, 3, 0, TAU); g.arc(5, -35, 2.5, 0, TAU); g.arc(10, -29, 2, 0, TAU); g.fill();
      break;
    }
    case 'kaktus': {
      const grd = g.createLinearGradient(-14, 0, 14, 0); grd.addColorStop(0, '#5fb04a'); grd.addColorStop(1, '#2f7a34');
      g.fillStyle = grd;
      rr(g, -12, -84, 24, 86, 12); g.fill();
      rr(g, -36, -62, 14, 34, 7); g.fill(); rr(g, -36, -36, 30, 13, 6); g.fill();
      rr(g, 22, -72, 14, 30, 7); g.fill(); rr(g, 6, -50, 30, 13, 6); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-4, -76); g.lineTo(-4, -4); g.stroke();
      g.fillStyle = '#ff7ab0'; g.beginPath(); g.arc(0, -86, 6, 0, TAU); g.fill();
      break;
    }
    case 'stein': {
      g.fillStyle = th.stone[1]; g.beginPath(); g.ellipse(0, -10, 24, 14, 0, Math.PI, TAU); g.lineTo(24, 0); g.lineTo(-24, 0); g.fill();
      g.fillStyle = th.stone[0]; g.beginPath(); g.ellipse(-4, -12, 16, 10, 0, Math.PI, TAU); g.fill();
      break;
    }
    case 'schneemann': {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(0, -20, 22, 0, TAU); g.arc(0, -54, 16, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,160,210,.35)'; g.beginPath(); g.arc(6, -16, 16, 0, TAU); g.fill();
      g.fillStyle = '#2a2a3a'; g.beginPath(); g.arc(-5, -58, 2.4, 0, TAU); g.arc(5, -58, 2.4, 0, TAU); g.fill();
      g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(0, -54); g.lineTo(16, -51); g.lineTo(0, -50); g.fill();
      g.fillStyle = '#d23a3a'; rr(g, -15, -44, 30, 7, 3); g.fill();
      break;
    }
    case 'puff': {
      g.globalAlpha = .9; g.drawImage(getCloudSprite(), -60, -50, 120, 56);
      break;
    }
    case 'stamm': {
      // Stiel unter einer schwebenden Plattform
      const len = d.len;
      const col = th.plat === 'kristall' ? ['#4b3a7a', '#2f2452'] : th.plat === 'eis' ? ['#9fc8e4', '#6a98bf'] : th.plat === 'gitter' ? ['#45414f', '#2a2732'] : th.plat === 'stein' ? ['#c99a62', '#966a38'] : ['#e8d6b0', '#bba57a'];
      const grd = g.createLinearGradient(-14, 0, 14, 0); grd.addColorStop(0, col[0]); grd.addColorStop(1, col[1]);
      g.fillStyle = grd; g.fillRect(-14, 0, 28, len);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-14, 0, 28, 10);
      break;
    }
    case 'kette': {
      g.strokeStyle = '#3a3440'; g.lineWidth = 4;
      for (let i = 0; i < d.len / 14; i++) { g.beginPath(); g.ellipse(0, i * 14 + 7, i % 2 ? 2 : 5, 7, 0, 0, TAU); g.stroke(); }
      break;
    }
    case 'fackel': case 'laterne': {
      g.fillStyle = '#3a3036'; rr(g, -4, -60, 8, 60, 3); g.fill();
      g.fillStyle = '#5a4a40'; rr(g, -10, -70, 20, 12, 4); g.fill();
      break;
    }
  }
  g.restore();
}
// Bewegte Deko (Flammen, Licht) – jedes Bild neu gezeichnet
function paintDekoDyn(g, d, t) {
  if (d.kind === 'fackel' || d.kind === 'laterne') {
    const fl = Math.sin(t * 13 + d.x) * .15 + Math.sin(t * 7.3 + d.x * .1) * .1;
    const cx = d.x, cy = d.y - 76;
    const glow = g.createRadialGradient(cx, cy, 2, cx, cy, 90);
    glow.addColorStop(0, d.kind === 'fackel' ? 'rgba(255,170,60,.38)' : 'rgba(255,220,140,.35)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 90, 0, TAU); g.fill();
    if (d.kind === 'fackel') {
      g.fillStyle = '#ff7a1a';
      g.beginPath(); g.moveTo(cx - 9, cy + 6); g.quadraticCurveTo(cx - 10, cy - 10, cx + fl * 20, cy - 26 - fl * 8); g.quadraticCurveTo(cx + 12, cy - 6, cx + 9, cy + 6); g.fill();
      g.fillStyle = '#ffe07a';
      g.beginPath(); g.moveTo(cx - 4, cy + 5); g.quadraticCurveTo(cx - 5, cy - 4, cx + fl * 10, cy - 14); g.quadraticCurveTo(cx + 6, cy - 2, cx + 4, cy + 5); g.fill();
    } else {
      g.fillStyle = '#ffe9a8'; rr(g, cx - 8, cy - 8, 16, 18, 5); g.fill();
      g.strokeStyle = '#3a3036'; g.lineWidth = 2; rr(g, cx - 8, cy - 8, 16, 18, 5); g.stroke();
    }
  }
}
