'use strict';
// =====================================================================
//  Bonushäuser: Memory (Extras) und Ballon-Kanone (Extraleben)
// =====================================================================
function drawHouseRoom(g, w, h, t, warm) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, warm ? '#5a2a22' : '#1f3a2a'); bg.addColorStop(1, warm ? '#2a120e' : '#0e1c14');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3;
  for (let x = 0; x < w; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.fillStyle = 'rgba(255,220,150,.07)';
  for (let i = 0; i < 4; i++) { const x = w * (.15 + i * .23); const gl = g.createRadialGradient(x, h * .12, 4, x, h * .12, 160); gl.addColorStop(0, 'rgba(255,220,140,.25)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gl; g.fillRect(x - 160, 0, 320, 320); }
  g.fillStyle = warm ? '#3a1a10' : '#14281c'; g.fillRect(0, h - 70, w, 70);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, h - 70, w, 4);
}
function miniInput() { return readInput([...KB_SCHEMES, 'solo', 'pad0', 'pad1', 'pad2', 'pad3']); }

// ---------------------------------------------------------------------
//  Memory: 18 Karten, 9 Paare, 2 Fehler erlaubt
// ---------------------------------------------------------------------
const Memory = {
  cards: [], sel: 0, open: [], misses: 0, phase: 'show', t: 0, won: [], prev: {},
  start() {
    const kinds = ['beere', 'beere', 'bluete', 'bluete', 'frost', 'wirbel', 'wirbel', 'eisbaer', 'stern'];
    const deck = kinds.flatMap(k => [k, k]);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    this.cards = deck.map((k, i) => ({ kind: k, up: true, done: false, flip: 1, i }));
    this.sel = 0; this.open = []; this.misses = 0; this.phase = 'show'; this.t = 0; this.won = []; this.prev = {};
    G.mode = 'memory';
    Music.play(composeSong(4242, { scale: 'dur', root: 65, bpm: 120, lead: 'sine', legato: 1 }));
  },
  layout() {
    const cw = Math.min(110, (SW - 180) / 6.4), ch = cw * 1.25;
    const gx = cw * .22;
    const tw = 6 * cw + 5 * gx, th = 3 * ch + 2 * gx;
    return { cw, ch, gx, x0: SW / 2 - tw / 2, y0: Math.max(120, SH / 2 - th / 2 + 10) };
  },
  update(dt) {
    this.t += dt;
    for (const c of this.cards) { const target = c.up || c.done ? 1 : 0; c.flip += (target - c.flip) * Math.min(1, dt * 10); }
    if (this.phase === 'show' && this.t > 2.4) { this.phase = 'shuffle'; this.t = 0; for (const c of this.cards) c.up = false; SFX.flip(); }
    if (this.phase === 'shuffle' && this.t > 1.2) { this.phase = 'play'; this.t = 0; }
    if (this.phase === 'wait' && this.t > .8) {
      for (const c of this.open) c.up = false;
      this.open = []; this.phase = this.misses >= 2 ? 'end' : 'play'; this.t = 0;
      if (this.phase === 'end') { SFX.wrong(); this.finish(); }
    }
    if (this.phase === 'end' || this.phase === 'done') {
      const inp = miniInput();
      if (this.t > 1.2 && (inp.jP || anyPressed(['Space', 'Enter']))) this.leave();
      return;
    }
    if (this.phase !== 'play') return;
    const inp = miniInput();
    const held = { l: inp.l, r: inp.r, u: anyKey(['KeyW', 'ArrowUp', 'KeyI', 'KeyT']) || pads.some(p => p.on && p.ly < 0), d: inp.d };
    const mv = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
    for (const k in mv) if (held[k] && !this.prev[k]) {
      const cx = this.sel % 6, cy = Math.floor(this.sel / 6);
      this.sel = clamp(cy + mv[k][1], 0, 2) * 6 + clamp(cx + mv[k][0], 0, 5); SFX.step();
    }
    this.prev = held;
    if (anyPressed(['Space', 'Enter', 'NumpadEnter', 'KeyQ', 'KeyE']) || pads.some(p => p.jP || p.aP) || (inp.jP && !held.u)) this.flipCard(this.sel);
  },
  flipCard(i) {
    const c = this.cards[i];
    if (this.phase !== 'play' || !c || c.up || c.done) return;
    c.up = true; this.open.push(c); SFX.flip();
    if (this.open.length === 2) {
      const [a, b] = this.open;
      if (a.kind === b.kind) {
        a.done = b.done = true; this.open = [];
        this.won.push(a.kind); SFX.power();
        if (this.cards.every(c2 => c2.done)) { this.phase = 'done'; this.t = 0; this.finish(); }
      } else { this.misses++; this.phase = 'wait'; this.t = 0; SFX.bump(); }
    }
  },
  click(mx, my) {
    const L = this.layout();
    for (let i = 0; i < 18; i++) {
      const x = L.x0 + (i % 6) * (L.cw + L.gx), y = L.y0 + Math.floor(i / 6) * (L.ch + L.gx);
      if (mx > x && mx < x + L.cw && my > y && my < y + L.ch) { this.sel = i; this.flipCard(i); return; }
    }
    if (this.phase === 'end' || this.phase === 'done') this.leave();
  },
  finish() {
    for (const k of this.won) Prog.save.inv[k] = Math.min(20, (Prog.save.inv[k] || 0) + 1);
    UI.autosave();
  },
  leave() { Music.stop(); Karte.enter(Karte.W.n); if (this.won.length) Karte.say(`${this.won.length} Extras sind jetzt im Inventar!`); },
  render() {
    const g = ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHouseRoom(g, SW, SH, this.t, true);
    const L = this.layout();
    g.textAlign = 'center'; g.font = '34px ' + FONT; g.fillStyle = '#ffd23a';
    g.fillText('Memory-Haus', SW / 2, 56);
    g.font = '15px system-ui, sans-serif'; g.fillStyle = '#fff';
    const info = this.phase === 'show' ? 'Merkt euch die Karten!' : this.phase === 'shuffle' ? 'Gemischt …' : this.phase === 'end' ? 'Zu viele Fehler – das Spiel ist vorbei.' : this.phase === 'done' ? 'Alle Paare gefunden!' : 'Pfeile/WASD wählen · Springen oder Klick dreht um · Paare wandern ins Inventar';
    g.fillText(info, SW / 2, 84);
    for (let i = 0; i < 18; i++) {
      const c = this.cards[i];
      let x = L.x0 + (i % 6) * (L.cw + L.gx), y = L.y0 + Math.floor(i / 6) * (L.ch + L.gx);
      if (this.phase === 'shuffle') { const a = this.t * 8 + i; x += Math.sin(a) * 30 * (1 - this.t / 1.2); y += Math.cos(a * 1.3) * 20 * (1 - this.t / 1.2); }
      const sx = Math.abs(c.flip * 2 - 1);
      const face = c.flip > .5;
      g.save(); g.translate(x + L.cw / 2, y + L.ch / 2); g.scale(Math.max(.05, sx), 1);
      if (i === this.sel && this.phase === 'play') { g.fillStyle = 'rgba(255,230,120,.35)'; rr(g, -L.cw / 2 - 8, -L.ch / 2 - 8, L.cw + 16, L.ch + 16, 16); g.fill(); }
      if (face) {
        rr(g, -L.cw / 2, -L.ch / 2, L.cw, L.ch, 12); fs(g, c.done ? '#fff6d8' : '#ffffff', 3);
        g.save(); g.scale(L.cw / 90, L.cw / 90); drawItemIcon(g, c.kind, this.t + i); g.restore();
        if (c.done) { g.strokeStyle = '#ffcf3a'; g.lineWidth = 4; rr(g, -L.cw / 2 + 4, -L.ch / 2 + 4, L.cw - 8, L.ch - 8, 9); g.stroke(); }
      } else {
        rr(g, -L.cw / 2, -L.ch / 2, L.cw, L.ch, 12);
        const grd = g.createLinearGradient(0, -L.ch / 2, 0, L.ch / 2); grd.addColorStop(0, '#ffc21a'); grd.addColorStop(1, '#d0800a'); fs(g, grd, 3);
        starPath(g, 0, 0, L.cw * .25, L.cw * .11); g.fillStyle = '#fff'; g.fill();
      }
      g.restore();
    }
    // Fehler
    g.font = '18px ' + FONT; g.textAlign = 'left'; g.fillStyle = '#fff';
    g.fillText('Fehler: ', SW / 2 - 70, SH - 32);
    for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(SW / 2 + 20 + i * 30, SH - 38, 10, 0, TAU); fs(g, i < this.misses ? '#ef5350' : 'rgba(255,255,255,.2)', 2); }
    if (this.phase === 'end' || this.phase === 'done') {
      g.fillStyle = 'rgba(12,10,24,.85)'; rr(g, SW / 2 - 230, SH / 2 - 70, 460, 140, 20); g.fill();
      g.textAlign = 'center'; g.font = '28px ' + FONT; g.fillStyle = '#ffd23a';
      g.fillText(this.won.length ? `${this.won.length} Extras gewonnen!` : 'Leider nichts gewonnen', SW / 2, SH / 2 - 22);
      this.won.forEach((k, i) => { g.save(); g.translate(SW / 2 - (this.won.length - 1) * 22 + i * 44, SH / 2 + 34); g.scale(.6, .6); drawItemIcon(g, k, this.t); g.restore(); });
      g.font = '13px system-ui'; g.fillStyle = '#fff'; g.fillText('Springen oder Klick: zurück zur Karte', SW / 2, SH / 2 + 60);
    }
  },
};
modeHandlers.memory = { update: dt => Memory.update(dt), render: dt => Memory.render(dt) };

// ---------------------------------------------------------------------
//  Ballon-Kanone: die Figur wird hochgeschossen und zerplatzt Ballons
// ---------------------------------------------------------------------
const Ballon = {
  balloons: [], shots: 0, shooter: 0, ang: 0, t: 0, flyer: null, won: 0, phase: 'aim', endT: 0,
  start() {
    this.t = 0; this.won = 0; this.flyer = null; this.phase = 'aim'; this.shooter = 0;
    const n = G.players.length;
    this.shots = n === 1 ? 4 : n * 2;
    this.balloons = [];
    for (let i = 0; i < 9; i++) this.balloons.push({ x: .1 + Math.random() * .8, y: .14 + Math.random() * .4, ph: Math.random() * 9, sp: (.03 + Math.random() * .05) * (Math.random() < .5 ? -1 : 1), col: ['#ef5350', '#4f8ff7', '#3fbf5a', '#ffc531', '#c88aff'][i % 5], pop: 0 });
    G.mode = 'ballon';
    Music.play(composeSong(777, { scale: 'mixo', root: 62, bpm: 132, lead: 'triangle' }));
  },
  click() { if (this.phase === 'aim') this.fire(); else if (this.phase === 'end' && this.endT > 1) this.leave(); },
  fire() {
    if (this.phase !== 'aim' || this.shots <= 0) return;
    this.shots--;
    const a = this.ang, sp = SH * 1.55;
    this.flyer = { x: SW / 2, y: SH - 110, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, p: G.players[this.shooter % G.players.length], rot: 0 };
    this.phase = 'fly'; SFX.cannon();
  },
  update(dt) {
    this.t += dt;
    for (const b of this.balloons) { if (b.pop) { b.pop += dt; continue; } b.x += b.sp * dt; if (b.x < .06 || b.x > .94) b.sp = -b.sp; }
    if (this.phase === 'aim') {
      this.ang = Math.sin(this.t * 1.6) * 1.05;
      const inp = miniInput();
      if (inp.jP || inp.aP || anyPressed(['Space', 'Enter'])) this.fire();
    } else if (this.phase === 'fly') {
      const f = this.flyer;
      f.vy += SH * 1.4 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 12;
      for (const b of this.balloons) {
        if (b.pop) continue;
        const bx = b.x * SW, by = b.y * SH + Math.sin(this.t * 2 + b.ph) * 12;
        if (Math.hypot(f.x - bx, f.y - by) < 42) { b.pop = .01; this.won++; SFX.pop(); SFX.life(); }
      }
      if (f.y > SH + 60 || f.x < -60 || f.x > SW + 60) {
        this.flyer = null; this.shooter++;
        if (this.shots <= 0 || this.balloons.every(b => b.pop)) { this.phase = 'end'; this.endT = 0; G.lives = Math.min(99, G.lives + this.won); Prog.save.lives = G.lives; UI.autosave(); }
        else this.phase = 'aim';
      }
    } else if (this.phase === 'end') {
      this.endT += dt;
      const inp = miniInput();
      if (this.endT > 1 && (inp.jP || anyPressed(['Space', 'Enter']))) this.leave();
    }
  },
  leave() { Music.stop(); Karte.enter(Karte.W.n); if (this.won) Karte.say(`${this.won} Extraleben gewonnen!`); },
  render() {
    const g = ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHouseRoom(g, SW, SH, this.t, false);
    g.textAlign = 'center'; g.font = '34px ' + FONT; g.fillStyle = '#7ef08a';
    g.fillText('Ballon-Haus', SW / 2, 56);
    g.font = '15px system-ui, sans-serif'; g.fillStyle = '#fff';
    g.fillText('Die Kanone schwenkt hin und her · Springen, Leertaste oder Klick feuert · jeder Ballon ist ein Extraleben', SW / 2, 84);
    for (const b of this.balloons) {
      const bx = b.x * SW, by = b.y * SH + Math.sin(this.t * 2 + b.ph) * 12;
      if (b.pop) { if (b.pop < .4) { g.globalAlpha = 1 - b.pop / .4; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = b.col; g.beginPath(); g.arc(bx + Math.cos(a) * b.pop * 120, by + Math.sin(a) * b.pop * 120, 5, 0, TAU); g.fill(); } g.font = '20px ' + FONT; g.fillStyle = '#7ef08a'; g.fillText('1UP', bx, by - b.pop * 80); g.globalAlpha = 1; } continue; }
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by + 34); g.quadraticCurveTo(bx + 8, by + 60, bx, by + 80); g.stroke();
      g.beginPath(); g.ellipse(bx, by, 28, 34, 0, 0, TAU); fs(g, radial(g, bx, by, 34, '#ffffff', b.col, b.col), 2.5);
      g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, bx - 9, by - 12, 6, 10, -.4); g.fill();
      g.save(); g.translate(bx, by + 4); g.scale(.6, .6); drawItemIcon(g, 'herz', this.t); g.restore();
    }
    // Kanone
    const cx = SW / 2, cy = SH - 70;
    g.save(); g.translate(cx, cy - 40); g.rotate(this.ang);
    rr(g, -20, -80, 40, 90, 10); fs(g, '#3a3646', 3);
    rr(g, -24, -88, 48, 18, 6); fs(g, '#5a5468', 2.5);
    g.restore();
    g.beginPath(); g.arc(cx, cy - 30, 34, Math.PI, TAU); fs(g, '#6a5a4a', 3);
    rr(g, cx - 50, cy - 32, 100, 30, 8); fs(g, '#8a6a4a', 3);
    const p = G.players[this.shooter % G.players.length];
    if (this.phase === 'aim' && p) drawHero(g, p.ch, { x: cx - Math.sin(this.ang) * 70, y: cy - 40 - Math.cos(this.ang) * 70 + 20, s: .7, face: 1, t: this.t, state: 'jump', power: p.power });
    if (this.flyer) drawHero(g, this.flyer.p.ch, { x: this.flyer.x, y: this.flyer.y + 20, s: .7, face: sign(this.flyer.vx) || 1, t: this.t, state: 'pound', power: this.flyer.p.power, rot: this.flyer.rot });
    g.font = '18px ' + FONT; g.textAlign = 'left'; g.fillStyle = '#fff';
    g.fillText(`Schüsse: ${this.shots}`, 30, SH - 30);
    g.textAlign = 'right'; g.fillText(`Gewonnen: ${this.won} Leben`, SW - 30, SH - 30);
    if (this.phase === 'aim' && p && G.players.length > 1) { g.textAlign = 'center'; g.fillStyle = p.color; g.fillText(`${PLAYER_TAG[p.idx]} ${p.ch.name} ist dran!`, SW / 2, SH - 20); }
    if (this.phase === 'end') {
      g.fillStyle = 'rgba(12,10,24,.85)'; rr(g, SW / 2 - 220, SH / 2 - 60, 440, 120, 20); g.fill();
      g.textAlign = 'center'; g.font = '28px ' + FONT; g.fillStyle = '#7ef08a';
      g.fillText(this.won ? `+${this.won} Extraleben!` : 'Kein Ballon getroffen', SW / 2, SH / 2 - 8);
      g.font = '13px system-ui'; g.fillStyle = '#fff'; g.fillText('Springen oder Klick: zurück zur Karte', SW / 2, SH / 2 + 30);
    }
  },
};
modeHandlers.ballon = { update: dt => Ballon.update(dt), render: dt => Ballon.render(dt) };

// ---------------------------------------------------------------------
//  Toad-Haus (über einen versteckten Tunnel erreichbar): eine von drei Truhen wählen
// ---------------------------------------------------------------------
const Toad = {
  rewards: [], sel: 1, phase: 'pick', t: 0, got: null, prev: {},
  start() {
    const pool = ['beere', 'bluete', 'frost', 'wirbel', 'eisbaer', 'stern', 'leben', 'leben', 'leben3'];
    const pick = [];
    while (pick.length < 3) { const k = pool[Math.floor(Math.random() * pool.length)]; if (!pick.includes(k)) pick.push(k); }
    this.rewards = pick; this.sel = 1; this.phase = 'pick'; this.t = 0; this.got = null; this.prev = {};
    G.mode = 'toad';
    Music.play(composeSong(555, { scale: 'dur', root: 64, bpm: 112, lead: 'triangle' }));
  },
  update(dt) {
    this.t += dt;
    const inp = miniInput();
    if (this.phase === 'pick') {
      const held = { l: inp.l, r: inp.r };
      if (held.l && !this.prev.l) { this.sel = (this.sel + 2) % 3; SFX.step(); }
      if (held.r && !this.prev.r) { this.sel = (this.sel + 1) % 3; SFX.step(); }
      this.prev = held;
      if (this.t > .5 && (anyPressed(['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyQ']) || inp.jP || inp.aP)) this.open(this.sel);
    } else if (this.t > 1.2 && (inp.jP || inp.aP || anyPressed(['Space', 'Enter']))) this.leave();
  },
  open(i) {
    const k = this.rewards[i];
    this.got = k; this.phase = 'open'; this.t = 0;
    if (k === 'leben' || k === 'leben3') { const n = k === 'leben' ? 1 : 3; G.lives = Math.min(99, G.lives + n); Prog.save.lives = G.lives; SFX.life(); }
    else { Prog.save.inv[k] = Math.min(20, (Prog.save.inv[k] || 0) + 1); SFX.power(); }
    UI.autosave();
  },
  click(mx, my) {
    if (this.phase === 'open') { if (this.t > 1) this.leave(); return; }
    for (let i = 0; i < 3; i++) { const c = this.pos(i); if (Math.abs(mx - c.x) < 80 && Math.abs(my - c.y) < 70) { this.sel = i; this.open(i); return; } }
  },
  pos(i) { return { x: SW / 2 + (i - 1) * Math.min(230, SW / 4), y: SH * .58 }; },
  leave() { Music.stop(); Karte.enter(Karte.W.n); Karte.say(this.got === 'leben' ? '+1 Extraleben!' : this.got === 'leben3' ? '+3 Extraleben!' : `${ITEM_INFO[this.got].name} liegt im Inventar!`); },
  render() {
    const g = ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHouseRoom(g, SW, SH, this.t, true);
    g.textAlign = 'center'; g.font = '34px ' + FONT; g.fillStyle = '#ffd23a';
    g.fillText('Toad-Haus', SW / 2, 56);
    g.font = '15px system-ui, sans-serif'; g.fillStyle = '#fff';
    g.fillText(this.phase === 'pick' ? 'Ihr habt den geheimen Tunnel gefunden! Links/Rechts wählen · Springen oder Klick öffnet eine Truhe' : 'Das war eure Truhe! Springen oder Klick: zurück zur Karte', SW / 2, 84);
    // Toad
    g.save(); g.translate(SW / 2, SH * .3 + Math.sin(this.t * 3) * 3);
    rr(g, -16, -4, 32, 42, 10); fs(g, '#fff4d8', 2.5);
    g.beginPath(); g.ellipse(0, -4, 44, 34, 0, Math.PI, TAU); fs(g, '#ef5350', 3);
    g.fillStyle = '#fff'; for (const [dx, dy, r] of [[-24, -22, 8], [0, -34, 9], [24, -22, 8]]) { g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.fill(); }
    g.fillStyle = '#1a0a08'; g.beginPath(); g.arc(-7, 12, 3, 0, TAU); g.arc(7, 12, 3, 0, TAU); g.fill();
    g.restore();
    for (let i = 0; i < 3; i++) {
      const c = this.pos(i), opened = this.phase === 'open' && i === this.sel;
      g.save(); g.translate(c.x, c.y);
      if (i === this.sel && this.phase === 'pick') { g.fillStyle = 'rgba(255,230,120,.35)'; rr(g, -78, -62, 156, 124, 18); g.fill(); }
      rr(g, -60, -10, 120, 56, 8); fs(g, '#a8682a', 3);
      g.save(); g.translate(-60, -10); g.rotate(opened ? -.9 : 0); rr(g, 0, -34, 120, 34, [14, 14, 0, 0]); fs(g, '#c8863a', 3); g.restore();
      rr(g, -8, 6, 16, 22, 3); fs(g, '#ffd23a', 2);
      if (this.phase === 'open') {
        const k = this.rewards[i], a = i === this.sel ? 1 : .45;
        g.globalAlpha = a; g.translate(0, -46 - Math.min(1, this.t * 3) * 26);
        if (k === 'leben' || k === 'leben3') { heartPath(g, 0, 0, 20); g.fillStyle = '#ff5a7a'; g.fill(); g.font = '24px ' + FONT; g.fillStyle = '#fff'; g.fillText(k === 'leben' ? '+1' : '+3', 0, 44); }
        else { g.scale(.8, .8); drawItemIcon(g, k, this.t); }
        g.globalAlpha = 1;
      }
      g.restore();
    }
  },
};
modeHandlers.toad = { update: dt => Toad.update(dt), render: dt => Toad.render(dt) };
