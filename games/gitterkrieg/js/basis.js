// Gitterkrieg – Grundlagen: Konstanten, Hilfsfunktionen, Eingabe, Ton
'use strict';

const AW = 1800, AH = 1120;          // Arena in Welt-Einheiten
const STEP = 1 / 60;                  // feste Simulationsschritte
const TAU = Math.PI * 2;
const HUB = window.GameHub || null;

const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fmtNum(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\''); }

// ---------- Gegnertypen ----------
const ET = { WANDERER: 0, SEEKER: 1, WEAVER: 2, SPLITTER: 3, MINI: 4, SNAKE: 5, ROCKET: 6, BLACKHOLE: 7, PROTON: 8 };
const EDEF = [
  { name: 'Wirbler', r: 18, pts: 25, hp: 1, col: hexRgb('#b863ff') },
  { name: 'Jäger', r: 17, pts: 50, hp: 1, col: hexRgb('#40c0ff') },
  { name: 'Weber', r: 17, pts: 100, hp: 1, col: hexRgb('#5aff66') },
  { name: 'Spalter', r: 20, pts: 100, hp: 1, col: hexRgb('#ff4fd0') },
  { name: 'Splitter', r: 11, pts: 50, hp: 1, col: hexRgb('#ff7ee0') },
  { name: 'Schlange', r: 15, pts: 150, hp: 1, col: hexRgb('#ffe640') },
  { name: 'Rakete', r: 15, pts: 50, hp: 1, col: hexRgb('#ff8a26') },
  { name: 'Schwarzes Loch', r: 24, pts: 150, hp: 12, col: hexRgb('#ff3a3a') },
  { name: 'Proton', r: 9, pts: 25, hp: 1, col: hexRgb('#8cd8ff') },
];
const TAIL_COL = hexRgb('#ff9a2e');
const GEOM_COL = hexRgb('#ccff40');
const BULLET_COL = [1, 0.95, 0.7];
const PCOLS_HEX = ['#4f8ff7', '#ef5350', '#ffd84a', '#3dffb0', '#ff7af5', '#b48cff', '#ffffff'];
const PCOLS = PCOLS_HEX.map(hexRgb);
const SNAKE_N = 16, SNAKE_SP = 13;

// ---------- Eingabe: Tastatur, Touchpad-Zeiger, Gamepad ----------
const Input = {
  keys: new Set(),
  px: 0, py: 0,              // Zeiger in CSS-Pixeln
  aimMode: 'keys',           // 'keys' | 'pointer' | 'pad'
  bombQ: 0,                  // Zähler, jede Erhöhung = eine Bombe
  pauseQ: 0,
  keyAim: null,              // geglätteter Winkel bei Pfeiltasten
  padBombWas: false, padStartWas: false,
  onKey: null,
  init() {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    addEventListener('keydown', e => {
      const typing = e.target && (e.target.tagName === 'INPUT');
      if (typing) return;
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.bombQ++;
        if (/^Arrow/.test(e.code) || ['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(e.code)) this.aimMode = 'keys';
        if (this.onKey) this.onKey(e.code);
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let lx = null, ly = null;
    addEventListener('pointermove', e => {
      this.px = e.clientX; this.py = e.clientY;
      if (lx !== null && Math.hypot(e.clientX - lx, e.clientY - ly) > 2) this.aimMode = 'pointer';
      lx = e.clientX; ly = e.clientY;
    });
  },
  pad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected && p.axes.length >= 4) return p;
    return null;
  },
  // liefert {mx, my, aim (Winkel oder null), fire}
  read(shipX, shipY, toWorld, dt) {
    const k = this.keys;
    let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let my = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    let ax = ((k.has('ArrowRight') || k.has('KeyL')) ? 1 : 0) - ((k.has('ArrowLeft') || k.has('KeyJ')) ? 1 : 0);
    let ay = ((k.has('ArrowDown') || k.has('KeyK')) ? 1 : 0) - ((k.has('ArrowUp') || k.has('KeyI')) ? 1 : 0);
    let aim = null, fire = false;
    const p = this.pad();
    if (p) {
      const dz = v => (Math.abs(v) < 0.22 ? 0 : v);
      const lx = dz(p.axes[0]), ly = dz(p.axes[1]), rx = p.axes[2], ry = p.axes[3];
      if (lx || ly) { mx = lx; my = ly; }
      if (Math.hypot(rx, ry) > 0.35) { this.aimMode = 'pad'; aim = Math.atan2(ry, rx); fire = true; }
      const b = p.buttons;
      const bomb = [0, 4, 5, 6, 7].some(i => b[i] && (b[i].pressed || b[i].value > 0.5));
      if (bomb && !this.padBombWas) this.bombQ++;
      this.padBombWas = bomb;
      const st = b[9] && b[9].pressed;
      if (st && !this.padStartWas) this.pauseQ++;
      this.padStartWas = st;
    }
    if (aim === null) {
      if (ax || ay) {
        const t = Math.atan2(ay, ax);
        if (this.keyAim === null) this.keyAim = t;
        else this.keyAim += clamp(angDiff(this.keyAim, t), -dt * 22, dt * 22);
        aim = this.keyAim; fire = true;
      } else {
        this.keyAim = null;
        if (this.aimMode === 'pointer') {
          const w = toWorld(this.px, this.py);
          const dx = w[0] - shipX, dy = w[1] - shipY;
          if (dx * dx + dy * dy > 16 * 16) { aim = Math.atan2(dy, dx); fire = true; }
        }
      }
    }
    return { mx, my, aim, fire };
  },
};

// ---------- Ton: Effekte und Musik, alles mit WebAudio erzeugt ----------
const Snd = (() => {
  let ac = null, master, sfx, mus, comp, noiseBuf = null;
  let muted = false, sfxLevel = 0.8;
  try { muted = localStorage.getItem('gitter-krieg-stumm') === '1'; } catch (e) {}
  const last = {};
  function gate(k, ms) { const t = performance.now(); if (last[k] && t - last[k] < ms) return false; last[k] = t; return true; }
  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(comp);
    sfx = ac.createGain(); sfx.gain.value = sfxLevel; sfx.connect(master);
    mus = ac.createGain(); mus.gain.value = 0.32; mus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function ok() { return ac && !muted && ac.state === 'running'; }
  function tone(type, f0, f1, dur, vol, dest, when) {
    const t = when || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, type, q, dest, when) {
    const t = when || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- Musik: treibender Synth-Loop, 128 BPM ----------
  const BPM = 128, S16 = 60 / BPM / 4;
  const ROOTS = [55, 43.65, 49, 41.2];                         // A, F, G, E
  const CH = [[0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 10], [0, 3, 7, 12]];
  const BASS = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 10, 0, 7, 12];
  const ARP = [0, 2, 1, 3, 2, 1, 0, 2];
  let musicOn = false, nextT = 0, stepI = 0, timer = null, intensity = 0.5;
  function schedule() {
    if (!ac || !musicOn) return;
    while (nextT < ac.currentTime + 0.15) {
      const st = stepI % 16, bar = Math.floor(stepI / 16) % 4, t = nextT;
      const root = ROOTS[bar];
      if (st % 4 === 0) { // Kick
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
        g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.3);
      }
      if (st % 4 === 2) noise(0.045, 0.16, 9000, 7000, 'highpass', 0.7, mus, t);
      if (st === 4 || st === 12) noise(0.16, 0.28 * intensity + 0.08, 1800, 900, 'bandpass', 1.2, mus, t);
      // Bass
      const bf = root * Math.pow(2, BASS[st] / 12);
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(bf, t);
      f.type = 'lowpass'; f.Q.value = 7; f.frequency.setValueAtTime(300 + 900 * intensity, t); f.frequency.exponentialRampToValueAtTime(140, t + 0.11);
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.14);
      // Arpeggio, wird mit mehr Gegnern lauter
      if (st % 2 === 0 && intensity > 0.25) {
        const ch = CH[bar], n = ch[ARP[(st / 2) % 8] % ch.length];
        tone('square', root * 8 * Math.pow(2, n / 12), root * 8 * Math.pow(2, n / 12), 0.09, 0.035 * intensity, mus, t);
      }
      nextT += S16; stepI++;
    }
  }
  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('gitter-krieg-stumm', muted ? '1' : '0'); } catch (e) {}
      if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.7, ac.currentTime, 0.05);
      return muted;
    },
    music(on) {
      if (on === musicOn && (!on || timer || !ac)) return;
      musicOn = on;
      if (on && ac) { nextT = ac.currentTime + 0.05; if (!timer) timer = setInterval(schedule, 30); }
      if (!on && timer) { clearInterval(timer); timer = null; }
    },
    sfxVol(v) { sfxLevel = v; if (ac) sfx.gain.setTargetAtTime(v, ac.currentTime, 0.1); },
    intensity(v) { intensity = clamp(v, 0, 1); },
    shoot() { if (ok() && gate('shot', 70)) { tone('square', 1250, 420, 0.055, 0.035); tone('triangle', 2400, 900, 0.04, 0.02); } },
    boom(size) {
      if (!ok() || !gate('boom' + size, size ? 60 : 35)) return;
      if (size >= 2) { noise(1.1, 0.7, 2200, 60, 'lowpass', 0.7); tone('sine', 120, 30, 0.9, 0.6); }
      else if (size === 1) { noise(0.45, 0.4, 3000, 120, 'lowpass', 1); tone('sine', 180, 50, 0.3, 0.25); }
      else { noise(0.22, 0.22, 4200 + rnd(1500), 300, 'lowpass', 1.2); tone('triangle', 420 + rnd(200), 90, 0.12, 0.06); }
    },
    spawn() { if (ok() && gate('spawn', 110)) tone('sine', 200 + rnd(80), 900 + rnd(300), 0.18, 0.05); },
    geom(m) { if (ok() && gate('geom', 45)) { const f = 900 + Math.min(m, 200) * 6; tone('sine', f, f * 1.5, 0.08, 0.07); } },
    hit() { if (ok() && gate('hit', 60)) tone('square', 300, 160, 0.05, 0.05); },
    wall() { if (ok() && gate('wall', 90)) noise(0.04, 0.05, 6000, 2000, 'bandpass', 2); },
    bomb() { if (!ok()) return; noise(1.6, 0.9, 5000, 40, 'lowpass', 0.5); tone('sine', 300, 25, 1.4, 0.7); tone('sawtooth', 80, 30, 1.0, 0.25); },
    die() { if (!ok()) return; noise(1.4, 0.8, 1600, 40, 'lowpass', 0.6); tone('sawtooth', 600, 40, 1.2, 0.25); tone('sine', 90, 25, 1.2, 0.6); },
    extra() { if (!ok()) return; [0, 4, 7, 12].forEach((n, i) => tone('square', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), 0.12, 0.08, null, ac.currentTime + i * 0.08)); },
    blackhole() { if (ok() && gate('bh', 200)) tone('sine', 90, 50, 0.35, 0.18); },
    respawn() { if (ok()) tone('sine', 300, 1200, 0.45, 0.12); },
  };
})();
