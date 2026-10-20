'use strict';
// Wanderlicht – Ton: ruhige Klangflächen, Glöckchen, Wind, Regen, Donner und Geräusche (alles erzeugt)

const Ton = {
  ctx: null, master: null, music: null, fx: null, amb: null, rev: null, noise: null,
  on: true, chordT: 0, bellT: 2, chord: 0, cricketT: 1,
  env: { wind: 0.5, rain: 0, night: 0, storm: 0 },

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.85 : 0;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.5;
    this.fx = c.createGain(); this.fx.gain.value = 0.7;
    this.amb = c.createGain(); this.amb.gain.value = 0.8;
    this.rev = c.createConvolver();
    this.rev.buffer = this.impulse(3.8);
    const revGain = c.createGain(); revGain.gain.value = 0.55;
    this.rev.connect(revGain); revGain.connect(this.master);
    this.music.connect(this.master); this.fx.connect(this.master); this.amb.connect(this.master);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 1100;
    this.musicFilter.connect(this.music); this.musicFilter.connect(this.rev);
    // Rauschen für Wind, Regen und Donner
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    const loop = (type, f, q, gain) => {
      const src = c.createBufferSource(); src.buffer = b; src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      src.connect(fl); fl.connect(g); g.connect(this.amb); src.start();
      return { fl, g };
    };
    this.wind = loop('bandpass', 420, 0.7, 0);
    this.rain = loop('highpass', 1400, 0.3, 0);
    this.chordT = 0;
  },
  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  },
  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.15);
  },
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  // Akkorde: Tag hell und offen, Nacht tiefer und weicher
  CH_DAY: [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 59, 61], [45, 52, 57, 59, 64]],
  CH_NIGHT: [[40, 47, 54, 55, 62], [36, 43, 50, 52, 59], [45, 52, 55, 59, 64], [43, 50, 54, 57, 62]],
  PENTA: [62, 64, 66, 69, 71, 74, 76, 78, 81],

  update(dt, env) {
    if (!this.ctx) return;
    Object.assign(this.env, env);
    const c = this.ctx, t = c.currentTime, e = this.env;
    this.wind.g.gain.setTargetAtTime(0.05 + e.wind * 0.07 + e.storm * 0.05, t, 0.8);
    this.wind.fl.frequency.setTargetAtTime(300 + Math.sin(t * 0.23) * 120 + e.wind * 150, t, 1);
    this.rain.g.gain.setTargetAtTime(e.rain * 0.16, t, 1);
    this.musicFilter.frequency.setTargetAtTime(700 + (1 - e.night) * 700 - e.storm * 200, t, 2);
    this.chordT -= dt;
    if (this.chordT <= 0) { this.chordT = 9; this.playChord(); }
    this.bellT -= dt;
    if (this.bellT <= 0) { this.bellT = 1.8 + Math.random() * 4; if (Math.random() < 0.75) this.bell(); }
    if (e.night > 0.6 && e.rain < 0.2 && e.cold < 0.5) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) { this.cricketT = 0.5 + Math.random() * 2.5; this.cricket(); }
    }
  },
  playChord() {
    const c = this.ctx, t = c.currentTime;
    const set = this.env.night > 0.5 ? this.CH_NIGHT : this.CH_DAY;
    this.chord = (this.chord + (Math.random() < 0.8 ? 1 : 2)) % set.length;
    const notes = set[this.chord];
    for (const m of notes) {
      for (const [type, det, vol] of [['triangle', -4, 0.022], ['sine', 5, 0.03]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = this.hz(m); o.detune.value = det;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 3);
        g.gain.setValueAtTime(vol, t + 8);
        g.gain.linearRampToValueAtTime(0, t + 13);
        o.connect(g); g.connect(this.musicFilter);
        o.start(t); o.stop(t + 13.2);
      }
    }
  },
  tone(freq, start, dur, vol, type = 'sine', dest, attack = 0.005, glideTo) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest || this.fx);
    o.start(start); o.stop(start + dur + 0.05);
    return g;
  },
  bell() {
    const c = this.ctx, t = c.currentTime;
    const m = this.PENTA[Math.floor(Math.random() * this.PENTA.length)] + (this.env.night > 0.5 ? -2 : 0);
    const g = this.tone(this.hz(m), t, 2.6, 0.035, 'sine', this.musicFilter, 0.01);
    void g;
    if (Math.random() < 0.35) this.tone(this.hz(m + 7), t + 0.35, 2.2, 0.02, 'sine', this.musicFilter, 0.01);
  },
  cricket() {
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 300, t + i * 0.07, 0.04, 0.006, 'sine', this.amb);
  },
  noiseHit(start, dur, vol, type, f, q = 1, f2) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, start); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, start + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(fl); fl.connect(g); g.connect(this.fx);
    src.start(start, Math.random()); src.stop(start + dur + 0.05);
  },
  thunder(dist) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + dist / 340 * 0.6;
    const vol = Math.max(0.08, 0.5 - dist / 900);
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 160;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    src.connect(fl); fl.connect(g); g.connect(this.amb); g.connect(this.rev);
    src.start(t); src.stop(t + 3.6);
  },
  sfx(name, vol = 1) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime, h = m => this.hz(m);
    switch (name) {
      case 'swing': this.noiseHit(t, 0.18, 0.18 * vol, 'bandpass', 700, 1.5, 2600); break;
      case 'swoosh': this.noiseHit(t, 0.22, 0.12 * vol, 'bandpass', 400, 1.2, 1200); break;
      case 'hit': this.tone(320, t, 0.18, 0.2 * vol, 'triangle', null, 0.003, 70); this.noiseHit(t, 0.08, 0.15 * vol, 'highpass', 1500); break;
      case 'hurt': this.tone(220, t, 0.25, 0.14, 'square', null, 0.005, 110); this.noiseHit(t, 0.15, 0.12, 'lowpass', 900); break;
      case 'coin': this.tone(h(88), t, 0.12, 0.06, 'sine'); this.tone(h(93), t + 0.06, 0.25, 0.06, 'sine'); break;
      case 'chest': [74, 78, 81, 86, 90].forEach((m, i) => { this.tone(h(m), t + i * 0.09, 1.2, 0.06, 'sine', this.musicFilter); }); this.noiseHit(t, 0.3, 0.1, 'lowpass', 600); break;
      case 'discover':
        [62, 69, 73, 76, 78, 81, 85].forEach((m, i) => { this.tone(h(m), t + i * 0.16, 3, 0.05, 'sine', this.musicFilter, 0.02); this.tone(h(m - 12), t + i * 0.16, 3, 0.025, 'triangle', this.musicFilter, 0.05); });
        break;
      case 'buy': this.tone(h(81), t, 0.3, 0.07, 'sine'); this.tone(h(88), t + 0.08, 0.5, 0.07, 'sine'); break;
      case 'drink': for (let i = 0; i < 5; i++) this.tone(300 + Math.random() * 300, t + i * 0.07, 0.08, 0.05, 'sine', null, 0.005, 700); break;
      case 'death': [69, 65, 62, 57].forEach((m, i) => this.tone(h(m), t + i * 0.35, 1.6, 0.06, 'triangle', this.musicFilter, 0.02)); break;
      case 'slam': this.tone(90, t, 0.6, 0.35, 'sine', null, 0.005, 35); this.noiseHit(t, 0.5, 0.25, 'lowpass', 300); break;
      case 'orb': this.tone(500, t, 0.5, 0.06, 'sine', null, 0.02, 900); break;
      case 'boss': this.tone(h(38), t, 3, 0.18, 'sawtooth', this.musicFilter, 0.6); this.tone(h(45), t + 0.3, 3, 0.12, 'sawtooth', this.musicFilter, 0.6); break;
      case 'upgrade': [69, 73, 76, 81, 85, 88].forEach((m, i) => this.tone(h(m), t + i * 0.07, 1.4, 0.05, 'sine', this.musicFilter)); break;
      case 'gate': [93, 88, 85, 81, 76, 73, 69].forEach((m, i) => this.tone(h(m), t + i * 0.1, 2, 0.04, 'sine', this.musicFilter)); break;
      case 'lantern': this.tone(h(81), t, 2, 0.05, 'sine', this.musicFilter, 0.05); this.tone(h(76), t + 0.3, 2, 0.04, 'sine', this.musicFilter, 0.05); break;
      case 'kill': this.tone(h(74), t, 0.4, 0.05, 'triangle'); this.noiseHit(t, 0.35, 0.12, 'bandpass', 900, 0.8, 300); break;
      case 'jump': this.noiseHit(t, 0.12, 0.05, 'bandpass', 500, 1, 1200); break;
      case 'click': this.tone(h(86), t, 0.06, 0.04, 'sine'); break;
      case 'wal': {
        const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(340, t + 1.4); o.frequency.linearRampToValueAtTime(240, t + 2.4); o.frequency.linearRampToValueAtTime(150, t + 4);
        lfo.frequency.value = 5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
        o.connect(g); g.connect(this.musicFilter); g.connect(this.rev);
        o.start(t); lfo.start(t); o.stop(t + 4.3); lfo.stop(t + 4.3);
        break;
      }
    }
  },
};
