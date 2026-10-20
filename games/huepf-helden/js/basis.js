'use strict';
// =====================================================================
//  Hüpf-Helden – Grundlagen: Hilfsfunktionen, Eingabe, Ton und Musik
// =====================================================================
const GAME_ID = 'huepf-helden';
const T = 48;                 // Kachelgrösse in Welt-Einheiten
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    f: r,
    i: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: arr => arr[Math.floor(r() * arr.length)],
    chance: p => r() < p,
    weighted(obj) {
      let sum = 0; for (const k in obj) sum += obj[k];
      let x = r() * sum;
      for (const k in obj) { x -= obj[k]; if (x <= 0) return k; }
      return Object.keys(obj)[0];
    },
  };
}
// Feste Zufallszahl pro Kachel (für Muster, die sich nicht bewegen sollen)
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(GAME_ID + '-' + key) || 'null');
    localStorage.setItem(GAME_ID + '-' + key, JSON.stringify(val));
  } catch (e) { return null; }
}

// =====================================================================
//  Eingabe: 4 Tastatur-Bereiche und bis zu 4 Gamepads
// =====================================================================
const SCHEMES = {
  wasd:   { name: 'WASD',   l: ['KeyA'], r: ['KeyD'], j: ['KeyW'], d: ['KeyS'], a: ['KeyQ', 'KeyE'],
            html: '<kbd>A</kbd><kbd>D</kbd> laufen · <kbd>W</kbd> springen · <kbd>S</kbd> stampfen · <kbd>Q</kbd> Spezial' },
  pfeile: { name: 'Pfeile', l: ['ArrowLeft'], r: ['ArrowRight'], j: ['ArrowUp'], d: ['ArrowDown'], a: ['Enter', 'Slash', 'Period', 'Numpad0'],
            html: '<kbd>←</kbd><kbd>→</kbd> laufen · <kbd>↑</kbd> springen · <kbd>↓</kbd> stampfen · <kbd>Enter</kbd> Spezial' },
  ijkl:   { name: 'IJKL',   l: ['KeyJ'], r: ['KeyL'], j: ['KeyI'], d: ['KeyK'], a: ['KeyU', 'KeyO'],
            html: '<kbd>J</kbd><kbd>L</kbd> laufen · <kbd>I</kbd> springen · <kbd>K</kbd> stampfen · <kbd>U</kbd> Spezial' },
  tfgh:   { name: 'TFGH',   l: ['KeyF'], r: ['KeyH'], j: ['KeyT'], d: ['KeyG'], a: ['KeyR', 'KeyY'],
            html: '<kbd>F</kbd><kbd>H</kbd> laufen · <kbd>T</kbd> springen · <kbd>G</kbd> stampfen · <kbd>R</kbd> Spezial' },
  // Zusatztasten, wenn nur eine Person spielt
  solo:   { name: 'Solo',   l: [], r: [], j: ['Space'], d: [], a: ['KeyX', 'KeyC'] },
};
for (let i = 0; i < 4; i++) SCHEMES['pad' + i] = { name: 'Gamepad ' + (i + 1), pad: i, html: 'Gamepad ' + (i + 1) + ': Stick laufen · <kbd>A</kbd> springen · <kbd>B</kbd>/<kbd>X</kbd> Spezial' };
const KB_SCHEMES = ['wasd', 'pfeile', 'ijkl', 'tfgh'];
const GAME_KEYS = new Set(Object.values(SCHEMES).flatMap(s => [].concat(s.l || [], s.r || [], s.j || [], s.d || [], s.a || [])));

const keys = new Set();
const pressed = new Set();     // seit dem letzten Spieltakt neu gedrückt
const keyListeners = [];       // Menüs hören hier mit: fn(code) -> true = verbraucht
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if ((GAME_KEYS.has(e.code) || e.code === 'Space') && window.captureKeys && window.captureKeys()) e.preventDefault();
  audioUnlock();
  if (!e.repeat) {
    pressed.add(e.code);
    for (const fn of keyListeners.slice()) if (fn(e.code)) break;
  }
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const pads = [0, 1, 2, 3].map(() => ({ on: false, lx: 0, ly: 0, j: false, a: false, prevJ: false, prevA: false, prevD: false, prevS: false, prevL: false, prevR: false, jP: false, aP: false, dP: false, sP: false, lP: false, rP: false }));
function pollPads() {
  let list = [];
  try { list = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch (e) { }
  for (let i = 0; i < 4; i++) {
    const gp = list[i], P = pads[i];
    if (!gp || !gp.connected) { P.on = false; P.lx = P.ly = 0; P.j = P.a = false; continue; }
    P.on = true;
    const b = k => !!(gp.buttons[k] && gp.buttons[k].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    P.lx = (b(15) || ax > 0.4) ? 1 : (b(14) || ax < -0.4) ? -1 : 0;
    P.ly = (b(13) || ay > 0.55) ? 1 : (b(12) || ay < -0.55) ? -1 : 0;
    const j = b(0) || b(3), a = b(1) || b(2) || b(5) || b(7), s = b(9), d = P.ly > 0, l = P.lx < 0, r = P.lx > 0;
    if (j && !P.prevJ) { P.jP = true; padEvent(i, 'j'); }
    if (a && !P.prevA) { P.aP = true; padEvent(i, 'a'); }
    if (d && !P.prevD) P.dP = true;
    if (s && !P.prevS) { P.sP = true; padEvent(i, 's'); }
    if (l && !P.prevL) padEvent(i, 'l');
    if (r && !P.prevR) padEvent(i, 'r');
    P.prevJ = j; P.prevA = a; P.prevD = d; P.prevS = s; P.prevL = l; P.prevR = r;
    P.j = j; P.a = a;
    if (j || a || s) audioUnlock();
  }
}
const padListeners = [];
function padEvent(i, what) { for (const fn of padListeners.slice()) if (fn(i, what)) break; }

const anyKey = codes => { for (const c of codes) if (keys.has(c)) return true; return false; };
const anyPressed = codes => { for (const c of codes) if (pressed.has(c)) return true; return false; };

// Eingabe eines Spielers aus einer Liste von Schemas lesen
function readInput(schemeIds) {
  const inp = { l: 0, r: 0, j: false, jP: false, d: false, dP: false, a: false, aP: false };
  for (const id of schemeIds) {
    const s = SCHEMES[id];
    if (s.pad !== undefined) {
      const P = pads[s.pad];
      if (!P.on) continue;
      if (P.lx < 0) inp.l = 1; if (P.lx > 0) inp.r = 1;
      if (P.j) inp.j = true; if (P.a) inp.a = true; if (P.ly > 0) inp.d = true;
      if (P.jP) inp.jP = true; if (P.aP) inp.aP = true; if (P.dP) inp.dP = true;
      continue;
    }
    if (anyKey(s.l)) inp.l = 1; if (anyKey(s.r)) inp.r = 1;
    if (anyKey(s.j)) inp.j = true; if (anyKey(s.d)) inp.d = true; if (anyKey(s.a)) inp.a = true;
    if (anyPressed(s.j)) inp.jP = true; if (anyPressed(s.d)) inp.dP = true; if (anyPressed(s.a)) inp.aP = true;
  }
  return inp;
}
function clearPressed() {
  pressed.clear();
  for (const P of pads) P.jP = P.aP = P.dP = P.sP = P.lP = P.rP = false;
}

// =====================================================================
//  Ton: Klangeffekte und erzeugte Musik (Web Audio, keine Dateien)
// =====================================================================
let AC = null, master = null, sfxGain = null, musGain = null, noiseBuf = null;
let muted = !!store('stumm');
function audioUnlock() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(AC.destination);
    sfxGain = AC.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musGain = AC.createGain(); musGain.gain.value = 0.32; musGain.connect(master);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (Music.pending) Music.play(Music.pending);
  } catch (e) { AC = null; }
}
function setMuted(m) {
  muted = m; store('stumm', m);
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, AC.currentTime, 0.03);
}

function tone(freq, dur, { type = 'triangle', vol = 0.3, slide = 0, attack = 0.005, delay = 0, out = null, vib = 0 } = {}) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  if (vib) {
    const lfo = AC.createOscillator(), lg = AC.createGain();
    lfo.frequency.value = 6; lg.gain.value = vib; lfo.connect(lg); lg.connect(o.frequency);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(out || sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, { vol = 0.25, freq = 1800, q = 0.8, type = 'bandpass', delay = 0, out = null, slide = 0 } = {}) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out || sfxGain);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI-Note -> Hz
const SFX = {
  jump(big) { tone(big ? 260 : 340, 0.17, { type: 'sine', vol: 0.22, slide: 2.1 }); tone(big ? 520 : 680, 0.12, { type: 'triangle', vol: 0.06, slide: 1.8 }); },
  coin() { tone(N(83), 0.07, { type: 'sine', vol: 0.18 }); tone(N(88), 0.32, { type: 'sine', vol: 0.2, delay: 0.06 }); tone(N(100), 0.2, { type: 'sine', vol: 0.04, delay: 0.06 }); },
  stomp() { tone(170, 0.16, { type: 'sine', vol: 0.4, slide: 0.4 }); noise(0.08, { vol: 0.2, freq: 900 }); },
  bump() { tone(110, 0.12, { type: 'sine', vol: 0.4, slide: 0.6 }); noise(0.06, { vol: 0.12, freq: 400 }); },
  brick() { noise(0.28, { vol: 0.35, freq: 1200, slide: 0.3 }); tone(140, 0.15, { type: 'sine', vol: 0.3, slide: 0.5 }); },
  sprout() { for (let i = 0; i < 6; i++) tone(N(60 + i * 3), 0.1, { type: 'triangle', vol: 0.13, delay: i * 0.045 }); },
  power() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(N(67 + s), 0.16, { type: 'triangle', vol: 0.17, delay: i * 0.05 })); },
  hurt() { tone(N(76), 0.12, { type: 'triangle', vol: 0.2 }); tone(N(70), 0.12, { type: 'triangle', vol: 0.2, delay: 0.1 }); tone(N(64), 0.25, { type: 'triangle', vol: 0.2, delay: 0.2 }); },
  die() { [72, 71, 70, 67, 64, 60].forEach((n, i) => tone(N(n), 0.18, { type: 'triangle', vol: 0.2, delay: i * 0.11 })); },
  life() { [76, 79, 88, 84, 86, 91].forEach((n, i) => tone(N(n), 0.14, { type: 'sine', vol: 0.18, delay: i * 0.08 })); },
  fire() { noise(0.12, { vol: 0.16, freq: 2400, slide: 0.4 }); tone(600, 0.1, { type: 'sine', vol: 0.1, slide: 0.5 }); },
  kick() { tone(300, 0.07, { type: 'square', vol: 0.08, slide: 0.5 }); noise(0.05, { vol: 0.2, freq: 3000 }); },
  spring() { tone(200, 0.35, { type: 'sine', vol: 0.3, slide: 4, vib: 30 }); },
  pound() { tone(90, 0.3, { type: 'sine', vol: 0.5, slide: 0.5 }); noise(0.2, { vol: 0.3, freq: 600, type: 'lowpass' }); },
  dash() { noise(0.2, { vol: 0.22, freq: 1500, slide: 2.5 }); },
  tongue() { tone(500, 0.12, { type: 'sine', vol: 0.18, slide: 2 }); tone(900, 0.1, { type: 'sine', vol: 0.12, slide: 0.5, delay: 0.12 }); },
  float() { tone(N(84), 0.3, { type: 'sine', vol: 0.06, vib: 8 }); },
  bubble() { tone(N(79), 0.1, { type: 'sine', vol: 0.2, slide: 1.6 }); tone(N(86), 0.15, { type: 'sine', vol: 0.15, delay: 0.07, slide: 1.4 }); },
  starcoin() { [79, 83, 86, 91, 95].forEach((n, i) => tone(N(n), 0.3, { type: 'sine', vol: 0.16, delay: i * 0.06 })); },
  checkpoint() { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.22, { type: 'triangle', vol: 0.17, delay: i * 0.07 })); },
  goal() {
    const m = [72, 76, 79, 84, 79, 84, 88, 91];
    m.forEach((n, i) => { tone(N(n), 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.12 }); tone(N(n - 12), 0.3, { type: 'sine', vol: 0.12, delay: i * 0.12 }); });
  },
  bossHit() { tone(120, 0.4, { type: 'sawtooth', vol: 0.15, slide: 0.5 }); noise(0.3, { vol: 0.3, freq: 500 }); },
  quake() { noise(0.5, { vol: 0.4, freq: 200, type: 'lowpass' }); tone(55, 0.5, { type: 'sine', vol: 0.4, slide: 0.6 }); },
  select() { tone(N(79), 0.08, { type: 'sine', vol: 0.15 }); },
  swim() { tone(320, 0.14, { type: 'sine', vol: 0.12, slide: 1.6 }); noise(0.1, { vol: 0.06, freq: 900 }); },
  ice() { tone(N(96), 0.12, { type: 'sine', vol: 0.12, slide: 0.6 }); tone(N(100), 0.18, { type: 'triangle', vol: 0.06, delay: 0.04 }); },
  whirl() { tone(300, 0.5, { type: 'triangle', vol: 0.16, slide: 3, vib: 40 }); noise(0.4, { vol: 0.12, freq: 2000, slide: 2 }); },
  cannon() { tone(80, 0.3, { type: 'sine', vol: 0.4, slide: 0.5 }); noise(0.25, { vol: 0.3, freq: 500, type: 'lowpass' }); },
  secret() { [79, 83, 86, 91, 86, 95].forEach((n, i) => tone(N(n), 0.2, { type: 'triangle', vol: 0.14, delay: i * 0.07 })); },
  hurry() { [84, 88, 91, 84, 88, 91].forEach((n, i) => tone(N(n), 0.1, { type: 'square', vol: 0.06, delay: i * 0.09 })); },
  thunder() { noise(1.6, { vol: 0.35, freq: 140, type: 'lowpass', slide: 0.5 }); },
  shadow() { tone(140, 0.5, { type: 'sawtooth', vol: 0.1, slide: 0.5, vib: 20 }); noise(0.4, { vol: 0.1, freq: 700, slide: 0.3 }); },
  open() { [60, 67, 72, 76].forEach((n, i) => tone(N(n), 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.08 })); },
  step() { tone(N(72), 0.05, { type: 'sine', vol: 0.06 }); },
  flip() { tone(N(84), 0.08, { type: 'triangle', vol: 0.12, slide: 1.4 }); },
  wrong() { tone(N(55), 0.25, { type: 'triangle', vol: 0.18, slide: 0.8 }); },
  pop() { tone(N(91), 0.08, { type: 'sine', vol: 0.18, slide: 0.5 }); noise(0.06, { vol: 0.12, freq: 3000 }); },
  join() { tone(N(72), 0.1, { type: 'triangle', vol: 0.15 }); tone(N(79), 0.18, { type: 'triangle', vol: 0.15, delay: 0.08 }); },
};

// Musik: pro Level neu komponiert (Akkordfolge, Melodie und Rhythmus aus dem Level-Zufall)
const Music = {
  timer: null, song: null, pending: null, step: 0, next: 0, speed: 1,
  play(song) {
    this.stop();
    if (!AC) { this.pending = song; return; }
    this.pending = null; this.song = song; this.step = 0; this.next = AC.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
  },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.song = null; this.pending = null; },
  tick() {
    const s = this.song; if (!s || !AC) return;
    const stepDur = 60 / s.bpm / 4 / this.speed;
    while (this.next < AC.currentTime + 0.12) {
      if (!muted) this.playStep(s, this.step, this.next, stepDur);
      this.step++; this.next += stepDur;
    }
  },
  playStep(s, st, t, d) {
    const bar = Math.floor(st / 16) % s.chords.length, pos = st % 16;
    const ch = s.chords[bar];
    const out = musGain;
    const at = Math.max(0, t - AC.currentTime);
    // Bass
    const bn = s.bass[pos];
    if (bn !== null) tone(N(s.root - 24 + ch[0] + bn), d * 1.8, { type: 'triangle', vol: 0.28, delay: at, out });
    // Begleitakkord
    if (s.comp[pos]) for (let k = 1; k < 3; k++) tone(N(s.root + ch[k]), d * 1.4, { type: 'sine', vol: 0.06, delay: at, out, attack: 0.01 });
    // Melodie (Teil A/B wechseln sich ab)
    const mel = s.melody[(Math.floor(st / 16 / s.chords.length) % 2)][bar * 16 + pos];
    if (mel !== null) {
      tone(N(s.root + 12 + mel), d * s.legato, { type: s.lead, vol: 0.13, delay: at, out, attack: 0.012, vib: 3 });
      tone(N(s.root + 24 + mel), d * s.legato * 0.6, { type: 'sine', vol: 0.025, delay: at, out });
    }
    // Schlagzeug
    if (s.drums) {
      if (s.kick[pos]) tone(130, 0.14, { type: 'sine', vol: 0.32, slide: 0.35, delay: at, out });
      if (s.snare[pos]) noise(0.11, { vol: 0.1, freq: 1700, q: 0.7, delay: at, out });
      if (s.hat[pos]) noise(0.035, { vol: 0.045, freq: 8000, type: 'highpass', delay: at, out });
    }
  },
};
const SCALES = { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], dorisch: [0, 2, 3, 5, 7, 9, 10] };
function composeSong(seed, mood) {
  const rng = makeRng(seed * 7 + 13);
  const scale = SCALES[mood.scale];
  const deg = d => { const o = Math.floor(d / 7); return scale[((d % 7) + 7) % 7] + 12 * o; };
  const triad = d => [deg(d), deg(d + 2), deg(d + 4)];
  const progs = mood.scale === 'dur' || mood.scale === 'mixo'
    ? [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 4, 5, 3], [3, 4, 0, 0], [0, 2, 3, 4]]
    : [[0, 5, 6, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 3, 6, 4]];
  const prog = rng.pick(progs);
  const chords = prog.map(triad);
  const rhythms = [
    [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0],
    [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0], [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
  ];
  const makeMelody = () => {
    const out = [];
    let cur = rng.i(2, 6);
    const rhy = rng.pick(rhythms), rhy2 = rng.pick(rhythms);
    for (let b = 0; b < chords.length; b++) {
      const r = b % 2 ? rhy2 : rhy;
      for (let p = 0; p < 16; p++) {
        if (!r[p] || (b === chords.length - 1 && p > 10)) { out.push(null); continue; }
        const chordTone = rng.chance(p % 4 === 0 ? 0.75 : 0.35);
        if (chordTone) {
          const targets = [prog[b], prog[b] + 2, prog[b] + 4, prog[b] + 7].map(x => x);
          let best = targets[0], bd = 99;
          for (const tg of targets) for (const o of [-7, 0, 7]) { const v = tg + o; if (Math.abs(v - cur) < bd && v > -2 && v < 12) { bd = Math.abs(v - cur); best = v; } }
          cur = rng.chance(0.3) ? best + (rng.chance(0.5) ? 2 : -2) : best;
        } else cur += rng.pick([-1, 1, 1, -1, 2, -2]);
        cur = clamp(cur, -1, 11);
        out.push(deg(cur));
      }
    }
    return out;
  };
  const m1 = makeMelody(), m2 = makeMelody();
  const bassPats = [
    [0, null, null, 12, null, null, 0, null, 0, null, null, 7, null, null, 12, null],
    [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, null],
    [0, null, null, null, 0, null, 12, null, 0, null, null, null, 7, null, 5, null],
    [0, 12, null, 0, null, 12, 0, null, 0, 12, null, 0, 7, null, 12, null],
  ];
  return {
    bpm: mood.bpm + rng.i(-6, 6), root: mood.root, chords, lead: mood.lead || 'triangle', legato: mood.legato || 0.9,
    melody: [m1, m2], bass: rng.pick(bassPats),
    comp: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0].map((v, i) => mood.comp === 'pad' ? (i % 8 === 0 ? 1 : 0) : v),
    drums: mood.drums !== false,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  };
}
