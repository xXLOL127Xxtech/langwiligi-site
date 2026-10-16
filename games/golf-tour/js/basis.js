// Golf-Tour – Grundlagen: Hilfsfunktionen, Zufall, Rauschen, Einstellungen, Eingabe und Ton
'use strict';
const GAME_ID = 'golf-tour';
const HUB = window.GameHub || null;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mischen(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ---------- Wertrauschen (Value Noise) mit fester Saat ----------
function rauschen(seed) {
  const r = rng(seed);
  const perm = new Uint16Array(512), val = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  }
  function fbm(x, y, okt) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < okt; i++) { s += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }
  return { n2, fbm };
}

// ---------- Einstellungen ----------
const EINST_KEY = GAME_ID + '-einstellungen';
const Einst = Object.assign({ stumm: false, laut: 0.8, grafik: 'hoch', putthilfe: true, namen: ['Spieler 1', 'Spieler 2'] },
  (() => { try { return JSON.parse(localStorage.getItem(EINST_KEY)) || {}; } catch (e) { return {}; } })());
function einstSpeichern() { try { localStorage.setItem(EINST_KEY, JSON.stringify(Einst)); } catch (e) { } }

// ---------- Eingabe ----------
// e.code = Position der Taste, funktioniert auch auf Schweizer Tastaturen (QWERTZ)
const TASTEN = {
  a: { links: ['KeyA'], rechts: ['KeyD'], schlAuf: ['KeyW'], schlAb: ['KeyS'], kraft: ['Space'],
    drallL: ['KeyQ'], drallR: ['KeyE'], drallRueck: ['KeyR'], drallVor: ['KeyF'], kamera: ['KeyC'], fein: [] },
  b: { links: ['ArrowLeft'], rechts: ['ArrowRight'], schlAuf: ['ArrowUp'], schlAb: ['ArrowDown'], kraft: ['Enter', 'NumpadEnter'],
    drallL: ['KeyJ'], drallR: ['KeyL'], drallRueck: ['KeyI'], drallVor: ['KeyK'], kamera: ['Slash', 'Minus'], fein: [] },
};
const Eingabe = {
  down: new Set(), hit: new Set(), aktiv: false,
  init() {
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!e.repeat) this.hit.add(e.code);
      this.down.add(e.code);
      Ton.init();
      if (this.aktiv && /^(Arrow|Space|Tab|Enter)/.test(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('pointerdown', () => Ton.init());
  },
  any(list) { for (const k of list) if (this.down.has(k)) return true; return false; },
  hitAny(list) { for (const k of list) if (this.hit.has(k)) return true; return false; },
  // Eingabe für einen Spieler: blocks = ['a'], ['b'] oder ['a','b']
  lies(blocks) {
    const r = { links: false, rechts: false, schlAuf: false, schlAb: false, kraft: false, kraftDruck: false,
      drallL: false, drallR: false, drallRueck: false, drallVor: false, kamera: false };
    for (const b of blocks) {
      const s = TASTEN[b];
      r.links = r.links || this.any(s.links); r.rechts = r.rechts || this.any(s.rechts);
      r.schlAuf = r.schlAuf || this.hitAny(s.schlAuf); r.schlAb = r.schlAb || this.hitAny(s.schlAb);
      r.kraft = r.kraft || this.any(s.kraft); r.kraftDruck = r.kraftDruck || this.hitAny(s.kraft);
      r.drallL = r.drallL || this.hitAny(s.drallL); r.drallR = r.drallR || this.hitAny(s.drallR);
      r.drallRueck = r.drallRueck || this.hitAny(s.drallRueck); r.drallVor = r.drallVor || this.hitAny(s.drallVor);
      r.kamera = r.kamera || this.hitAny(s.kamera);
    }
    return r;
  },
  endFrame() { this.hit.clear(); },
};

// ---------- Ton (alles synthetisch mit WebAudio) ----------
const Ton = {
  ctx: null, master: null, noise: null, windG: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.lautstaerke();
    // leises Windrauschen als Atmosphäre
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    src.connect(f); f.connect(this.windG); this.windG.connect(this.master); src.start();
  },
  lautstaerke() { if (this.ctx) this.master.gain.value = Einst.stumm ? 0 : Einst.laut; },
  wind(st) { if (this.windG) this.windG.gain.setTargetAtTime(0.012 + st * 0.006, this.ctx.currentTime, 0.5); },
  ton(f, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const os = c.createOscillator(), g = c.createGain();
    os.type = o.typ || 'sine';
    os.frequency.setValueAtTime(f, t);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.att || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(this.master);
    os.start(t); os.stop(t + dur + 0.05);
  },
  rausch(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = o.ftyp || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.att || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  sfx(n, st = 1) {
    if (!this.ctx || Einst.stumm) return;
    const T = (f, d, o) => this.ton(f, d, o), R = (d, o) => this.rausch(d, o);
    switch (n) {
      case 'schlag': // voller Schlag: harter Klick + Holzresonanz
        R(0.09, { freq: 3800, q: 0.9, vol: 0.55 * st, ftyp: 'bandpass' });
        T(180 + 120 * st, 0.12, { typ: 'triangle', vol: 0.25 * st, slide: 90 });
        R(0.4, { freq: 900, q: 0.4, vol: 0.12 * st, slide: 300, delay: 0.03 });
        break;
      case 'putt': R(0.05, { freq: 2600, q: 2, vol: 0.18 + 0.2 * st }); T(900, 0.06, { typ: 'sine', vol: 0.08 }); break;
      case 'aufprall': R(0.08, { freq: 220, q: 0.8, vol: Math.min(0.35, 0.05 + st * 0.02), ftyp: 'lowpass' }); break;
      case 'sand': R(0.2, { freq: 1600, q: 0.5, vol: 0.18, slide: 600 }); break;
      case 'holz': T(420, 0.12, { typ: 'triangle', vol: 0.22, slide: 260 }); R(0.06, { freq: 1200, q: 3, vol: 0.2 }); break;
      case 'stein': T(1400, 0.08, { typ: 'square', vol: 0.06 }); R(0.05, { freq: 4200, q: 4, vol: 0.2 }); break;
      case 'blaetter': R(0.45, { freq: 4500, q: 0.6, vol: 0.18, slide: 2000 }); break;
      case 'fahne': T(1900, 0.25, { typ: 'triangle', vol: 0.16, slide: 1600 }); break;
      case 'lippe': T(700, 0.07, { typ: 'triangle', vol: 0.16 }); T(560, 0.08, { typ: 'triangle', vol: 0.12, delay: 0.06 }); break;
      case 'loch':
        T(520, 0.06, { typ: 'triangle', vol: 0.2 }); T(430, 0.06, { typ: 'triangle', vol: 0.18, delay: 0.08 });
        T(390, 0.08, { typ: 'triangle', vol: 0.15, delay: 0.15 }); R(0.15, { freq: 700, q: 2, vol: 0.12, delay: 0.05 });
        break;
      case 'jubel': // Applaus aus vielen kurzen Rauschimpulsen
        for (let i = 0; i < 46; i++) R(0.05, { freq: 1800 + Math.random() * 2400, q: 1.5, vol: 0.05 + Math.random() * 0.06 * st, delay: Math.random() * 1.6 * st });
        break;
      case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.22, { typ: 'triangle', vol: 0.12, delay: i * 0.09 })); break;
      case 'platsch': R(0.6, { freq: 900, q: 0.6, vol: 0.4, slide: 250 }); R(0.25, { freq: 3000, q: 1, vol: 0.2, delay: 0.05 }); break;
      case 'zisch': R(0.9, { freq: 2500, q: 0.4, vol: 0.35, slide: 700 }); T(90, 0.5, { typ: 'sawtooth', vol: 0.08, slide: 50 }); break;
      case 'eis': T(2400, 0.08, { typ: 'sine', vol: 0.1 }); T(3100, 0.1, { typ: 'sine', vol: 0.06, delay: 0.03 }); break;
      case 'aus': T(300, 0.25, { typ: 'square', vol: 0.06, slide: 180 }); break;
      case 'klick': T(880, 0.05, { typ: 'triangle', vol: 0.1 }); break;
      case 'wahl': T(660, 0.06, { typ: 'triangle', vol: 0.08 }); T(990, 0.08, { typ: 'triangle', vol: 0.07, delay: 0.05 }); break;
      case 'laden': T(200 + st * 500, 0.04, { typ: 'sine', vol: 0.03 }); break;
    }
  },
};
