// Sternen-Party – Grundlagen: Hilfsfunktionen, Zufall, Einstellungen, Spiel-Uhr und Ton
'use strict';
const GAME_ID = 'sternen-party';
const HUB = window.GameHub || null;
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const wahl = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const r1 = v => Math.round(v * 10) / 10;
function mischen(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const Ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TAU / 3) + 1,
};

// Weltgrösse der Minispiele (wird auf den Bildschirm skaliert)
const WELT_B = 1600, WELT_H = 900;

// Farben der vier Plätze (wie in den anderen Spielen der Seite)
const PLATZ_FARBEN = ['#4f8ff7', '#ef5350', '#43c463', '#ffb52e'];

// ---------- Einstellungen ----------
const EINST_KEY = GAME_ID + '-einstellungen';
const Einst = Object.assign({
  runden: 15, stufe: 1, tempo: 1, stumm: false, musik: true, bonus: true,
  figuren: [0, 1, 2, 3],
}, (() => { try { return JSON.parse(localStorage.getItem(EINST_KEY)) || {}; } catch (e) { return {}; } })());
function einstSpeichern() { try { localStorage.setItem(EINST_KEY, JSON.stringify(Einst)); } catch (e) { } }

// ---------- Spiel-Uhr ----------
// Alle Wartezeiten der Spiellogik laufen über diese Uhr. Sie steht still, wenn das Spiel pausiert.
const Uhr = {
  zeit: 0, timer: [], tempo: 1,
  tick(dt) {
    this.zeit += dt;
    const fertig = [];
    this.timer = this.timer.filter(t => { if (t.bis <= this.zeit) { fertig.push(t); return false; } return true; });
    for (const t of fertig) t.res();
  },
  // ms in normaler Geschwindigkeit; die Tempo-Einstellung verkürzt alle Pausen
  warte(ms) {
    return new Promise(res => this.timer.push({ bis: this.zeit + ms / 1000 / this.tempo, res }));
  },
  abbrechen() { this.timer = []; },
};

// ---------- Ton (alles synthetisch, keine Dateien) ----------
const Ton = {
  ctx: null, master: null, musikGain: null, musikAn: false, naechsterSchlag: 0, schlag: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = Einst.stumm ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musikGain = this.ctx.createGain();
      this.musikGain.gain.value = Einst.musik ? 0.16 : 0;
      this.musikGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  },
  stumm(an) {
    Einst.stumm = an; einstSpeichern();
    if (this.master) this.master.gain.value = an ? 0 : 0.5;
  },
  note(freq, dauer, typ = 'sine', laut = 0.3, wann = 0, ziel = null, gleit = 0) {
    if (!this.ctx || Einst.stumm) return;
    const t = this.ctx.currentTime + wann;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(freq, t);
    if (gleit) o.frequency.exponentialRampToValueAtTime(gleit, t + dauer);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel || this.master);
    o.start(t); o.stop(t + dauer + 0.05);
  },
  rauschen(dauer, laut = 0.2, filter = 1200) {
    if (!this.ctx || Einst.stumm) return;
    const len = Math.floor(this.ctx.sampleRate * dauer);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = filter; g.gain.value = laut;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  spiel(name) {
    if (!this.ctx) return;
    const n = (f, d, ty, l, w, gl) => this.note(f, d, ty, l, w, null, gl);
    switch (name) {
      case 'klick': n(880, .06, 'triangle', .15); break;
      case 'fokus': n(660, .04, 'triangle', .08); break;
      case 'muenze': n(988, .08, 'square', .09); n(1319, .25, 'square', .09, .07); break;
      case 'verlust': n(523, .12, 'triangle', .2); n(392, .12, 'triangle', .2, .1); n(262, .3, 'triangle', .2, .2); break;
      case 'schritt': n(420 + Math.random() * 60, .07, 'sine', .18, 0, 260); break;
      case 'wuerfel': n(1200, .03, 'square', .05); break;
      case 'treffer': n(196, .08, 'square', .2); n(784, .18, 'triangle', .25, .02); n(1046, .25, 'triangle', .2, .08); break;
      case 'stern': [784, 988, 1175, 1568, 1976].forEach((f, i) => n(f, .35, 'triangle', .2, i * .08)); break;
      case 'fanfare': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => n(f, i === 5 ? .7 : .2, 'square', .1, i * .13)); break;
      case 'boese': n(110, .6, 'sawtooth', .2, 0, 55); n(146, .6, 'sawtooth', .15, .05, 70); break;
      case 'glueck': [659, 831, 988, 1319].forEach((f, i) => n(f, .25, 'triangle', .18, i * .07)); break;
      case 'item': n(700, .1, 'sine', .2, 0, 1400); n(1400, .2, 'triangle', .12, .1); break;
      case 'sprung': n(330, .16, 'sine', .22, 0, 760); break;
      case 'pop': n(600, .08, 'sine', .25, 0, 120); this.rauschen(.08, .1, 3000); break;
      case 'boom': this.rauschen(.5, .45, 700); n(90, .4, 'sine', .35, 0, 40); break;
      case 'zaehl': n(660, .14, 'square', .1); break;
      case 'los': n(1320, .4, 'square', .12); break;
      case 'pfiff': n(1500, .18, 'sine', .2, 0, 1800); n(1500, .35, 'sine', .2, .2, 1300); break;
      case 'weg': n(520, .1, 'sine', .15, 0, 780); break;
      case 'tusch': [392, 523, 659, 784].forEach((f, i) => n(f, 1.2, 'triangle', .12, i * .03)); break;
      case 'fehler': n(180, .25, 'square', .15); break;
      case 'schuss': this.rauschen(.12, .25, 2500); n(300, .1, 'square', .1, 0, 90); break;
      case 'platsch': this.rauschen(.35, .3, 900); n(250, .2, 'sine', .2, 0, 80); break;
    }
  },
  // Kleine Begleitmusik: Bass und Marimba-Akkorde, sanft im Hintergrund
  musik(an) {
    Einst.musik = an; einstSpeichern();
    if (this.musikGain) this.musikGain.gain.value = an ? 0.16 : 0;
  },
  musikTick() {
    if (!this.ctx || Einst.stumm || !Einst.musik || !this.musikLaeuft) return;
    const jetzt = this.ctx.currentTime;
    if (this.naechsterSchlag < jetzt) this.naechsterSchlag = jetzt + 0.05;
    const takt = 60 / (this.musikLaeuft === 'mini' ? 150 : 112) / 2;
    const akkorde = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]];
    const tonart = this.musikLaeuft === 'mini' ? 57 : 60;
    while (this.naechsterSchlag < jetzt + 0.2) {
      const s = this.schlag++, wann = this.naechsterSchlag - jetzt;
      const akk = akkorde[Math.floor(s / 8) % 4];
      const hz = m => 440 * Math.pow(2, (m - 69) / 12);
      if (s % 4 === 0) this.note(hz(tonart - 24 + akk[0]), takt * 1.6, 'triangle', .5, wann, this.musikGain);
      if (s % 4 === 2) this.note(hz(tonart - 17 + akk[0]), takt * .9, 'triangle', .35, wann, this.musikGain);
      const muster = [0, -1, 1, 2, -1, 1, 0, 2];
      const m = muster[s % 8];
      if (m >= 0) this.note(hz(tonart + 12 + akk[m]), takt * 1.2, 'sine', .22, wann, this.musikGain);
      this.naechsterSchlag += takt;
    }
  },
  musikLaeuft: null,
};

// ---------- Kleine Helfer für HTML ----------
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
