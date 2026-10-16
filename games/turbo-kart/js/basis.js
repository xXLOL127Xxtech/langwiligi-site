// Turbo-Kart – Grundlagen: Hilfsfunktionen, Einstellungen, Eingabe, Ton und Musik
'use strict';
const GAME_ID = 'turbo-kart';
const HUB = window.GameHub || null;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = t => t * t * (3 - 2 * t);
const r2 = v => Math.round(v * 100) / 100;
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
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtZeit(t) {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}

// ---------- Einstellungen ----------
const EINST_KEY = GAME_ID + '-einstellungen';
const Einst = Object.assign({
  qual: 'auto', musik: 0.55, sfx: 0.8, stumm: false, autogas: false,
  cc: 150, ki: 1, items: 'normal', teams: false, runden: 3, gegner: 7, kamera: 0,
  wahl: [{ f: 0, k: 0 }, { f: 2, k: 1 }, { f: 4, k: 2 }, { f: 6, k: 3 }],
}, (() => { try { return JSON.parse(localStorage.getItem(EINST_KEY)) || {}; } catch (e) { return {}; } })());
function einstSpeichern() { try { localStorage.setItem(EINST_KEY, JSON.stringify(Einst)); } catch (e) { } }
const REKORD_KEY = GAME_ID + '-rekorde';
const Rekorde = (() => { try { return JSON.parse(localStorage.getItem(REKORD_KEY)) || {}; } catch (e) { return {}; } })();
function rekordSpeichern() { try { localStorage.setItem(REKORD_KEY, JSON.stringify(Rekorde)); } catch (e) { } }

// ---------- Eingabe ----------
// e.code ist die Position der Taste, funktioniert also auch mit Schweizer Tastatur (QWERTZ)
const TASTEN = {
  solo: {
    gas: ['KeyW', 'ArrowUp'], bremse: ['KeyS', 'ArrowDown'], links: ['KeyA', 'ArrowLeft'], rechts: ['KeyD', 'ArrowRight'],
    drift: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'], item: ['KeyE', 'KeyQ', 'Enter', 'KeyJ', 'KeyL'], zurueck: ['KeyR'],
  },
  p1: {
    gas: ['KeyW'], bremse: ['KeyS'], links: ['KeyA'], rechts: ['KeyD'],
    drift: ['ShiftLeft', 'KeyC', 'Space'], item: ['KeyE', 'KeyQ'], zurueck: ['KeyR'],
  },
  p2: {
    gas: ['ArrowUp'], bremse: ['ArrowDown'], links: ['ArrowLeft'], rechts: ['ArrowRight'],
    drift: ['ShiftRight', 'Period', 'Numpad0'], item: ['Enter', 'Slash', 'ControlRight', 'NumpadEnter'], zurueck: ['Backslash'],
  },
};
const Eingabe = {
  down: new Set(), hit: new Set(), prev: [{}, {}, {}, {}], lokal: 1, aktiv: false,
  init() {
    addEventListener('keydown', e => {
      if (!e.repeat) this.hit.add(e.code);
      this.down.add(e.code);
      Ton.init();
      if (this.aktiv && /^(Arrow|Space|Tab)/.test(e.code)) e.preventDefault();
      if (this.aktiv && e.code === 'Enter' && document.activeElement && document.activeElement.tagName === 'BUTTON') e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('pointerdown', () => Ton.init());
  },
  any(list) { for (const k of list) if (this.down.has(k)) return true; return false; },
  pads() {
    const out = [];
    try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected) out.push(p); } catch (e) { }
    return out;
  },
  padFuer(i, n) {
    const pads = this.pads();
    if (!pads.length) return null;
    // Bei 3–4 Spielern bekommen zuerst Spieler 3 und 4 ein Gamepad (sie haben keine Tasten)
    const order = n >= 3 ? [2, 3, 0, 1].slice(0, Math.max(n, 2)).filter(x => x < n) : [0, 1];
    const k = order.indexOf(i);
    return k >= 0 && k < pads.length ? pads[k] : null;
  },
  spieler(i) {
    const n = this.lokal;
    const set = n === 1 ? TASTEN.solo : i === 0 ? TASTEN.p1 : i === 1 ? TASTEN.p2 : null;
    let gas = 0, bremse = 0, lenk = 0, drift = false, item = false, zurueck = false;
    if (set) {
      if (this.any(set.gas)) gas = 1;
      if (this.any(set.bremse)) bremse = 1;
      if (this.any(set.links)) lenk -= 1;
      if (this.any(set.rechts)) lenk += 1;
      drift = this.any(set.drift); item = this.any(set.item); zurueck = this.any(set.zurueck);
    }
    const p = this.padFuer(i, n);
    if (p) {
      const b = k => p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > 0.4);
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.18) lenk += Math.sign(ax) * (Math.abs(ax) - 0.18) / 0.82;
      if (b(14)) lenk -= 1; if (b(15)) lenk += 1;
      if (b(0)) gas = 1;
      if (b(1) || b(2)) bremse = 1;
      if (b(5) || b(7)) drift = true;
      if (b(4) || b(6) || b(3)) item = true;
      if ((p.axes[1] || 0) > 0.6 || b(13)) zurueck = zurueck || false;
    }
    if (Einst.autogas && !bremse) gas = 1;
    const pr = this.prev[i];
    const r = { gas, bremse, lenk: clamp(lenk, -1, 1), drift, item, zurueck,
      driftDruck: drift && !pr.drift, itemDruck: item && !pr.item, itemLos: !item && pr.item };
    this.prev[i] = { drift, item };
    return r;
  },
  pausePad() {
    for (const p of this.pads()) if (p.buttons[9] && p.buttons[9].pressed) return true;
    return false;
  },
  endFrame() { this.hit.clear(); },
};

// ---------- Ton ----------
const Ton = {
  ctx: null, master: null, musikG: null, sfxG: null, noise: null, motoren: [], musik: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.musikG = c.createGain(); this.musikG.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.lautstaerke();
    if (this.wartendeMusik) { const w = this.wartendeMusik; this.wartendeMusik = null; this.spieleMusik(w); }
  },
  lautstaerke() {
    if (!this.ctx) return;
    this.master.gain.value = Einst.stumm ? 0 : 1;
    this.musikG.gain.value = Einst.musik * 0.5;
    this.sfxG.gain.value = Einst.sfx * 0.7;
  },
  ton(f, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const os = c.createOscillator(), g = c.createGain();
    os.type = o.typ || 'square';
    os.frequency.setValueAtTime(f, t);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const v = (o.vol || 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(o.ziel || this.sfxG);
    os.start(t); os.stop(t + dur + 0.05);
  },
  rausch(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.ftyp || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.ziel || this.sfxG);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  sfx(n, vol = 1) {
    if (!this.ctx || Einst.stumm) return;
    const T = (f, d, o = {}) => this.ton(f, d, Object.assign({}, o, { vol: (o.vol || 0.2) * vol }));
    const R = (d, o = {}) => this.rausch(d, Object.assign({}, o, { vol: (o.vol || 0.3) * vol }));
    switch (n) {
      case 'klick': T(880, 0.06, { typ: 'triangle', vol: 0.15 }); break;
      case 'wahl': T(660, 0.07, { typ: 'square', vol: 0.08 }); T(990, 0.1, { typ: 'square', vol: 0.08, delay: 0.06 }); break;
      case 'ok': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.12, { typ: 'square', vol: 0.09, delay: i * 0.05 })); break;
      case 'zurueck': T(500, 0.08, { typ: 'triangle', vol: 0.15, slide: 300 }); break;
      case 'box': R(0.25, { freq: 3000, q: 0.6, vol: 0.3, slide: 800 }); [1318, 1760, 2093].forEach((f, i) => T(f, 0.12, { typ: 'triangle', vol: 0.1, delay: i * 0.04 })); break;
      case 'roulette': T(1200 + Math.random() * 600, 0.035, { typ: 'square', vol: 0.05 }); break;
      case 'itemda': T(1046, 0.08, { typ: 'square', vol: 0.1 }); T(1568, 0.16, { typ: 'square', vol: 0.1, delay: 0.07 }); break;
      case 'muenze': T(988, 0.07, { typ: 'square', vol: 0.11 }); T(1319, 0.22, { typ: 'square', vol: 0.11, delay: 0.07 }); break;
      case 'boost': R(0.6, { freq: 600, q: 0.7, vol: 0.4, slide: 2400, ftyp: 'bandpass' }); T(120, 0.5, { typ: 'sawtooth', vol: 0.12, slide: 340 }); break;
      case 'mini1': R(0.3, { freq: 900, q: 1, vol: 0.25, slide: 2600 }); break;
      case 'funke1': T(1500, 0.05, { typ: 'square', vol: 0.06 }); break;
      case 'funke2': T(1900, 0.06, { typ: 'square', vol: 0.07 }); T(2300, 0.06, { typ: 'square', vol: 0.06, delay: 0.05 }); break;
      case 'funke3': [2000, 2500, 3000].forEach((f, i) => T(f, 0.06, { typ: 'square', vol: 0.06, delay: i * 0.04 })); break;
      case 'hop': T(260, 0.09, { typ: 'triangle', vol: 0.12, slide: 420 }); break;
      case 'land': R(0.12, { freq: 400, q: 0.8, vol: 0.18 }); break;
      case 'trick': T(700, 0.08, { typ: 'square', vol: 0.09 }); T(1050, 0.12, { typ: 'square', vol: 0.09, delay: 0.07 }); break;
      case 'wand': R(0.18, { freq: 500, q: 1.5, vol: 0.35 }); T(90, 0.15, { typ: 'square', vol: 0.12 }); break;
      case 'rempel': R(0.12, { freq: 900, q: 2, vol: 0.25 }); T(140, 0.1, { typ: 'square', vol: 0.1 }); break;
      case 'dreh': T(900, 0.6, { typ: 'triangle', vol: 0.12, slide: 200 }); R(0.5, { freq: 2000, q: 3, vol: 0.12 }); break;
      case 'treffer': R(0.35, { freq: 1200, q: 0.8, vol: 0.4, slide: 300 }); T(300, 0.4, { typ: 'square', vol: 0.12, slide: 80 }); break;
      case 'explo': R(1.1, { freq: 900, q: 0.5, vol: 0.7, slide: 60, ftyp: 'lowpass' }); T(80, 0.8, { typ: 'sine', vol: 0.4, slide: 30 }); break;
      case 'wurf': R(0.15, { freq: 1800, q: 2, vol: 0.18, slide: 900 }); break;
      case 'stern': [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.1, { typ: 'square', vol: 0.08, delay: i * 0.05 })); break;
      case 'blitz': R(0.9, { freq: 5000, q: 0.4, vol: 0.5, slide: 200 }); T(60, 0.6, { typ: 'sawtooth', vol: 0.2, slide: 30 }); break;
      case 'schrumpf': T(1200, 0.5, { typ: 'square', vol: 0.08, slide: 300 }); break;
      case 'tinte': R(0.4, { freq: 300, q: 4, vol: 0.3, slide: 120 }); break;
      case 'hupe': T(330, 0.45, { typ: 'sawtooth', vol: 0.2 }); T(415, 0.45, { typ: 'sawtooth', vol: 0.2 }); R(0.5, { freq: 300, vol: 0.3, ftyp: 'lowpass' }); break;
      case 'ballon': T(1800, 0.05, { typ: 'square', vol: 0.12 }); R(0.15, { freq: 3000, q: 0.5, vol: 0.4 }); break;
      case 'rakete': R(1.2, { freq: 400, q: 0.5, vol: 0.4, slide: 1500 }); break;
      case 'warnung': T(1400, 0.1, { typ: 'square', vol: 0.09 }); T(1400, 0.1, { typ: 'square', vol: 0.09, delay: 0.18 }); break;
      case 'drei': T(523, 0.25, { typ: 'square', vol: 0.14 }); break;
      case 'los': T(1046, 0.6, { typ: 'square', vol: 0.15 }); T(1568, 0.6, { typ: 'triangle', vol: 0.1 }); break;
      case 'runde': [784, 1046].forEach((f, i) => T(f, 0.15, { typ: 'square', vol: 0.12, delay: i * 0.1 })); break;
      case 'letzte': [659, 784, 988, 1318, 1046, 1318].forEach((f, i) => T(f, 0.14, { typ: 'square', vol: 0.12, delay: i * 0.11 })); break;
      case 'ziel': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => T(f, 0.2, { typ: 'square', vol: 0.12, delay: i * 0.1 })); break;
      case 'verloren': [392, 370, 349, 330].forEach((f, i) => T(f, 0.3, { typ: 'triangle', vol: 0.14, delay: i * 0.22 })); break;
      case 'rettung': T(600, 0.6, { typ: 'triangle', vol: 0.1, slide: 1200 }); break;
      case 'stein': R(0.7, { freq: 220, q: 0.6, vol: 0.8, ftyp: 'lowpass', slide: 50 }); T(55, 0.5, { typ: 'sine', vol: 0.5, slide: 30 }); break;
      case 'falle': R(0.4, { freq: 600, q: 0.6, vol: 0.3, slide: 100, ftyp: 'lowpass' }); break;
    }
  },
  // ---------- Motoren (einer pro lokalem Spieler) ----------
  motorStart(n) {
    this.motorStop();
    const c = this.ctx; if (!c) return;
    for (let i = 0; i < n; i++) {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o1.type = 'sawtooth'; o2.type = 'square';
      f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
      g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxG);
      o1.start(); o2.start();
      const ns = c.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 6;
      const ng = c.createGain(); ng.gain.value = 0;
      ns.connect(nf); nf.connect(ng); ng.connect(this.sfxG); ns.start();
      this.motoren.push({ o1, o2, f, g, ns, ng, nf });
    }
  },
  motor(i, spd01, boost, drift, an) {
    const m = this.motoren[i]; if (!m) return;
    const t = this.ctx.currentTime;
    const base = 48 + spd01 * 95 + (boost ? 30 : 0);
    m.o1.frequency.setTargetAtTime(base, t, 0.06);
    m.o2.frequency.setTargetAtTime(base * 0.502, t, 0.06);
    m.f.frequency.setTargetAtTime(300 + spd01 * 700 + (boost ? 500 : 0), t, 0.08);
    m.g.gain.setTargetAtTime(an ? (0.014 + spd01 * 0.018) / Math.sqrt(this.motoren.length) : 0, t, 0.1);
    m.ng.gain.setTargetAtTime(an && drift ? 0.03 : 0, t, 0.05);
    m.nf.frequency.setTargetAtTime(2000 + spd01 * 800, t, 0.1);
  },
  motorStop() {
    for (const m of this.motoren) { try { m.o1.stop(); m.o2.stop(); m.ns.stop(); m.g.disconnect(); m.ng.disconnect(); } catch (e) { } }
    this.motoren = [];
  },
  // ---------- Musik: kleiner Sequenzer, Lieder werden aus einem Startwert erzeugt ----------
  spieleMusik(lied) {
    if (!this.ctx) { this.wartendeMusik = lied; return; }
    this.stoppeMusik();
    if (!lied) return;
    const m = this.musik = Musik.erzeuge(lied);
    m.next = this.ctx.currentTime + 0.1;
    m.step = 0;
    m.timer = setInterval(() => this.planen(), 25);
  },
  stoppeMusik() {
    if (this.musik) { clearInterval(this.musik.timer); this.musik = null; }
  },
  tempo(f) { if (this.musik) this.musik.tempoF = f; },
  planen() {
    const m = this.musik, c = this.ctx;
    if (!m || !c) return;
    while (m.next < c.currentTime + 0.12) {
      Musik.spieleSchritt(m, m.step, m.next);
      m.step = (m.step + 1) % m.len;
      m.next += 60 / (m.bpm * (m.tempoF || 1)) / 4;
    }
  },
};

const Musik = {
  SKALEN: { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10], dorisch: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10] },
  mtof: n => 440 * Math.pow(2, (n - 69) / 12),
  // lied: { seed, bpm, root, skala, prog: [Stufen], stil }
  erzeuge(l) {
    const R = rng(l.seed);
    const sk = this.SKALEN[l.skala] || this.SKALEN.dur;
    const bars = l.prog.length;
    const len = bars * 16;
    const note = deg => { const o = Math.floor(deg / 7); const d = ((deg % 7) + 7) % 7; return l.root + sk[d] + 12 * o; };
    const akk = l.prog.map(s => [note(s), note(s + 2), note(s + 4)]);
    // Rhythmus-Motive für die Melodie (1 = Note, 2 = gehalten)
    const motive = [];
    for (let k = 0; k < 3; k++) {
      const r = [];
      for (let i = 0; i < 16; i++) {
        const stark = i % 4 === 0, halb = i % 2 === 0;
        const p = stark ? 0.85 : halb ? 0.45 : 0.18;
        r.push(R() < p ? 1 : 0);
      }
      r[0] = 1;
      motive.push(r);
    }
    const form = [0, 0, 1, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2].slice(0, bars);
    const mel = new Array(len).fill(null);
    let deg = l.prog[0] + 7;
    for (let b = 0; b < bars; b++) {
      const mot = motive[form[b]];
      const tones = [l.prog[b], l.prog[b] + 2, l.prog[b] + 4].map(x => x + 7);
      for (let i = 0; i < 16; i++) {
        if (!mot[i]) continue;
        if (i % 4 === 0) {
          // Auf den Schlägen: Akkordton in der Nähe
          let best = tones[0], bd = 99;
          for (const t of tones) for (const o of [-7, 0, 7]) { const dd = Math.abs(t + o - deg) + R() * 2; if (dd < bd) { bd = dd; best = t + o; } }
          deg = best;
        } else deg += R() < 0.5 ? (R() < 0.5 ? 1 : -1) : (R() < 0.5 ? 2 : -2);
        deg = clamp(deg, l.prog[0] + 3, l.prog[0] + 15);
        let dauer = 1; while (i + dauer < 16 && !mot[i + dauer] && dauer < 4) dauer++;
        mel[b * 16 + i] = { n: note(deg) + 12, d: dauer };
      }
    }
    return { bpm: Math.round(l.bpm * 0.9), len, akk, mel, stil: l.stil || 'pop', R, tempoF: 1, lead: l.lead || 'square', bass: l.bass || 'triangle' };
  },
  spieleSchritt(m, s, t) {
    const c = Ton.ctx, out = Ton.musikG;
    const sec = 60 / (m.bpm * (m.tempoF || 1)) / 4;
    const bar = Math.floor(s / 16), i = s % 16;
    const ak = m.akk[bar];
    const osc = (f, d, typ, v, att = 0.005, dest = out) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = typ; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02);
    };
    const noise = (d, freq, v, typ = 'highpass') => {
      const src = c.createBufferSource(); src.buffer = Ton.noise;
      const f = c.createBiquadFilter(); f.type = typ; f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + d + 0.02);
    };
    // Schlagzeug
    const vier = m.stil !== 'ruhig';
    if (i % 4 === 0 && (vier || i % 8 === 0)) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    }
    if (i === 4 || i === 12) noise(0.14, 1800, 0.22, 'bandpass');
    if (m.stil === 'rock' && i === 14) noise(0.1, 1800, 0.12, 'bandpass');
    if (i % 2 === 0) noise(0.03, 7000, i % 4 === 2 ? 0.07 : 0.04);
    // Bass
    const bp = m.stil === 'rock' ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 3, 6, 8, 11, 14];
    if (bp.includes(i)) {
      const n = ak[0] - 24 + (i === 6 || i === 14 ? 7 : 0) + (i === 11 ? 12 : 0);
      osc(Musik.mtof(n), sec * 1.8, m.bass, 0.32);
    }
    // Akkord-Stösse auf den Nachschlägen
    if (i % 4 === 2 && m.stil !== 'ruhig') for (const n of ak) osc(Musik.mtof(n), sec * 1.2, 'square', 0.035);
    if (m.stil === 'ruhig' && i === 0) for (const n of ak) osc(Musik.mtof(n), sec * 14, 'triangle', 0.05, 0.08);
    // Melodie
    const me = m.mel[s];
    if (me) {
      osc(Musik.mtof(me.n), sec * me.d * 0.95, m.lead, 0.07);
      osc(Musik.mtof(me.n) * 1.005, sec * me.d * 0.95, 'triangle', 0.06);
    }
  },
};
