'use strict';
// =====================================================================
//  Weltkarte: Wege, Knoten, Laufen von Punkt zu Punkt
// =====================================================================
const Karte = {
  W: null, at: null, tok: { x: 0, y: 0 }, route: [], face: 1, t: 0, msg: null, prevDir: { l: 0, r: 0, u: 0, d: 0 }, view: null, bgCache: null,
  enter(n) {
    this.W = Prog.world(n);
    Prog.save.world = n;
    if (!Prog.save.unlocked.includes(n)) Prog.save.unlocked.push(n);
    this.at = Prog.save.at[n] && this.W.byId[Prog.save.at[n]] ? Prog.save.at[n] : this.W.nodes[0].id;
    const nd = this.W.byId[this.at];
    this.tok = { x: nd.x, y: nd.y };
    this.route = [];
    this.bgCache = null;
    G.mode = 'map';
    Music.play(composeSong(n * 77 + 5, { scale: (n >= 7 && n <= 9) || n === 11 ? 'moll' : n === 6 ? 'dorisch' : n === 10 ? 'mixo' : 'dur', root: 60 + (n % 3), bpm: 104, lead: 'triangle', comp: 'pad', legato: 1.2 }));
  },
  node() { return this.W.byId[this.at]; },
  // Welt links/rechts davon (Welt 9 nur, wenn sie offen ist); null am Ende
  neighbourWorld(d) {
    const list = [];
    for (let n = 1; n <= WORLD_COUNT; n++) if (n !== 9 || Prog.save.unlocked.includes(9)) list.push(n);
    const i = list.indexOf(this.W.n) + d;
    return i >= 0 && i < list.length ? list[i] : null;
  },
  arrowPos(d) { return { x: d < 0 ? Math.max(48, this.view.ox / 2) : SW - Math.max(48, this.view.ox / 2), y: this.view.oy + 280 * this.view.s + 10, r: 34 }; },
  switchWorld(d) {
    const n = this.neighbourWorld(d);
    if (n === null) { SFX.bump(); return; }
    if (!Prog.save.unlocked.includes(n)) { SFX.wrong(); const need = n === NEW_FIRST ? 'Besiegt Morvax in Welt 8' : `Schafft 5 Level in Welt ${n === NEW_FIRST + 1 ? NEW_FIRST : n - 1}`; this.say(`Welt ${n} ist noch gesperrt: ${need}.`, 3); return; }
    SFX.select(); this.enter(n);
  },
  say(text, dur = 2.6) { this.msg = { text, t: dur }; },
  // Ansicht: Kartenkoordinaten (1000×560) -> Bildschirm
  layout() {
    const top = 92, bottom = 150;
    const s = Math.min((SW - 60) / 1000, (SH - top - bottom) / 560);
    this.view = { s, ox: (SW - 1000 * s) / 2, oy: top + (SH - top - bottom - 560 * s) / 2 };
    return this.view;
  },
  toScreen(x, y) { const v = this.view; return [v.ox + x * v.s, v.oy + y * v.s]; },
  update(dt) {
    this.t += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (UI.overlayOpen()) return;
    // Laufen
    if (this.route.length) {
      const nd = this.W.byId[this.route[0]];
      const dx = nd.x - this.tok.x, dy = nd.y - this.tok.y, d = Math.hypot(dx, dy);
      const sp = 420 * dt;
      if (Math.abs(dx) > 1) this.face = sign(dx);
      if (d <= sp) { this.tok.x = nd.x; this.tok.y = nd.y; this.at = nd.id; Prog.save.at[this.W.n] = nd.id; this.route.shift(); SFX.step(); }
      else { this.tok.x += dx / d * sp; this.tok.y += dy / d * sp; }
      return;
    }
    // Richtungen: neu gedrückte Tasten (auch sehr kurze) oder Gamepad-Flanken; Halten läuft weiter
    const codes = k => KB_SCHEMES.flatMap(s => SCHEMES[s][k]);
    const padDir = { l: pads.some(p => p.on && p.lx < 0), r: pads.some(p => p.on && p.lx > 0), u: pads.some(p => p.on && p.ly < 0), d: pads.some(p => p.on && p.ly > 0) };
    const held = { l: anyKey(codes('l')) || padDir.l, r: anyKey(codes('r')) || padDir.r, u: anyKey(codes('j')) || padDir.u, d: anyKey(codes('d')) || padDir.d };
    const hit = { l: anyPressed(codes('l')), r: anyPressed(codes('r')), u: anyPressed(codes('j')), d: anyPressed(codes('d')) };
    let dir = null;
    for (const k of ['l', 'r', 'u', 'd']) if (hit[k] || (held[k] && !this.prevDir[k])) dir = k;
    if (!dir) for (const k of ['l', 'r', 'u', 'd']) if (held[k] && this.holdT > .3) dir = k;
    this.holdT = (held.l || held.r || held.u || held.d) ? (this.holdT || 0) + dt : 0;
    this.prevDir = held;
    if (dir) { this.step(dir); this.holdT = 0; }
    if (anyPressed(['PageUp', 'BracketLeft'])) { this.switchWorld(-1); return; }
    if (anyPressed(['PageDown', 'BracketRight'])) { this.switchWorld(1); return; }
    const confirm = anyPressed(['Space', 'Enter', 'NumpadEnter']) || pads.some(p => p.jP);
    const menuKey = anyPressed(['KeyQ', 'KeyE', 'KeyU', 'KeyO', 'KeyR', 'KeyX', 'KeyC', 'Slash', 'Period']) || pads.some(p => p.aP);
    if (confirm) this.enterNode();
    else if (menuKey) UI.openInventory();
  },
  step(dir) {
    const v = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[dir];
    const cur = this.node();
    let best = null, bd = .35;
    for (const id of Prog.neighbours(this.W, cur.id)) {
      const nd = this.W.byId[id];
      const dx = nd.x - cur.x, dy = nd.y - cur.y, l = Math.hypot(dx, dy) || 1;
      const dot = (dx * v[0] + dy * v[1]) / l;
      if (dot > bd) { bd = dot; best = nd; }
    }
    if (best) this.route = [best.id];
    else SFX.bump();
  },
  goTo(id) {
    if (id === this.at) { this.enterNode(); return; }
    const p = Prog.path(this.W, this.at, id);
    if (p) this.route = p.slice(1);
    else { SFX.bump(); this.say('Dieser Weg ist noch versperrt.'); }
  },
  enterNode() {
    const nd = this.node();
    if (this.route.length) return;
    if (nd.type === 'level' || nd.type === 'turm' || nd.type === 'burg') { UI.playNode(nd); return; }
    if (nd.type === 'haus') {
      if (!Prog.houseReady(nd.id)) { this.say('Das Haus öffnet wieder, wenn ihr ein weiteres Level geschafft habt.'); SFX.bump(); return; }
      Prog.save.houses[nd.id] = Prog.save.clears;
      if (nd.variant === 'rot') Memory.start(); else if (nd.variant === 'toad') Toad.start(); else Ballon.start();
      return;
    }
    if (nd.type === 'tor') {
      if (Prog.save.paid[nd.id]) return;
      const have = Prog.starsFree();
      if (have >= nd.cost) UI.ask(`Sternentor öffnen? Kostet ${nd.cost} Sternmünzen (du hast ${have}).`, 'Öffnen', () => { Prog.save.spent += nd.cost; Prog.save.paid[nd.id] = true; SFX.open(); this.say('Das Tor ist offen!'); UI.autosave(); });
      else { SFX.wrong(); this.say(`Für dieses Tor braucht ihr ${nd.cost} Sternmünzen – ihr habt ${have}.`); }
      return;
    }
    if (nd.type === 'kanone') {
      UI.ask(`Mit der Kanone direkt in Welt ${nd.target} fliegen?`, 'Abfeuern!', () => {
        SFX.cannon();
        if (!Prog.save.unlocked.includes(nd.target)) Prog.save.unlocked.push(nd.target);
        for (let w = this.W.n + 1; w < nd.target; w++) if (!Prog.save.unlocked.includes(w)) Prog.save.unlocked.push(w);
        UI.autosave();
        this.enter(nd.target);
        this.say(`Willkommen in Welt ${nd.target}: ${WORLD_SPECS[nd.target - 1].name}!`, 3);
      });
    }
  },
  click(mx, my) {
    if (!this.view) return;
    for (const d of [-1, 1]) { const a = this.arrowPos(d); if (Math.hypot(mx - a.x, my - a.y) < a.r + 12) { this.switchWorld(d); return; } }
    if (this.route.length) return;
    let best = null, bd = 34;
    for (const nd of this.W.nodes) {
      if (!this.visible(nd)) continue;
      const [sx, sy] = this.toScreen(nd.x, nd.y);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bd) { bd = d; best = nd; }
    }
    if (best) this.goTo(best.id);
  },
  visible(nd) {
    if (nd.type === 'start') return true;
    const W = this.W;
    return W.edges.some(e => e.b === nd.id && (Prog.edgeOpen(W, e) || (e.req !== 'secret' && !nd.geheim && nd.type !== 'kanone')));
  },
  // ---------------- Zeichnen ----------------
  render() {
    const g = ctx, W = this.W, spec = W.spec, t = this.t;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.layout();
    const v = this.view;
    if (!this.bgCache || this.bgCache.w !== SW || this.bgCache.h !== SH) this.bgCache = this.paintBg();
    g.drawImage(this.bgCache.c, 0, 0, SW, SH);
    g.save(); g.translate(v.ox, v.oy); g.scale(v.s, v.s);
    // Wege
    for (const e of W.edges) {
      const a = W.byId[e.a], b = W.byId[e.b];
      const open = Prog.edgeOpen(W, e);
      if (!open && (e.req === 'secret' || b.geheim || b.type === 'kanone')) continue;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(20,10,30,.55)'; g.lineWidth = 18; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = open ? spec.path : 'rgba(150,140,160,.55)'; g.lineWidth = 11;
      g.setLineDash(open ? [] : [10, 12]);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.setLineDash([]);
      if (open) {
        g.fillStyle = 'rgba(0,0,0,.18)';
        const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 22);
        for (let i = 1; i < n; i++) { g.beginPath(); g.arc(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, 2.4, 0, TAU); g.fill(); }
      }
    }
    // Knoten
    for (const nd of W.nodes) if (this.visible(nd)) this.drawNode(g, nd, t);
    // Spielfiguren
    const P = G.players.length ? G.players : [];
    P.forEach((p, i) => {
      const off = (i - (P.length - 1) / 2) * 20;
      const hop = this.route.length ? Math.abs(Math.sin(t * 12 + i)) * 6 : Math.max(0, Math.sin(t * 3 + i)) * 3;
      drawHero(g, p.ch, { x: this.tok.x + off, y: this.tok.y - 6 - hop, s: .62, face: this.face, t: t + i, walk: t * 10, state: this.route.length ? 'run' : 'stand', power: p.power });
    });
    g.restore();
    this.drawHud(g);
    this.drawArrows(g);
  },
  drawArrows(g) {
    for (const d of [-1, 1]) {
      const n = this.neighbourWorld(d);
      if (n === null) continue;
      const a = this.arrowPos(d), open = Prog.save.unlocked.includes(n), pul = 1 + Math.sin(this.t * 4) * .05;
      g.save(); g.translate(a.x, a.y); g.scale(pul, pul);
      g.globalAlpha = open ? 1 : .5;
      g.beginPath(); g.arc(0, 0, a.r, 0, TAU); fs(g, open ? 'rgba(255,200,50,.95)' : 'rgba(90,90,110,.9)', 3.5);
      g.beginPath(); g.moveTo(d * 12, 0); g.lineTo(-d * 10, -18); g.lineTo(-d * 10, 18); g.closePath(); fs(g, '#fff', 2.5);
      g.restore();
      g.globalAlpha = 1; g.textAlign = 'center'; g.font = '15px ' + FONT; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4;
      const label = open ? `Welt ${n}` : `Welt ${n} 🔒`;
      g.strokeText(label, a.x, a.y + a.r + 22); g.fillText(label, a.x, a.y + a.r + 22);
      if (open) { g.font = '12px system-ui, sans-serif'; g.strokeText(WORLD_SPECS[n - 1].name, a.x, a.y + a.r + 38); g.fillText(WORLD_SPECS[n - 1].name, a.x, a.y + a.r + 38); }
    }
  },
  drawNode(g, nd, t) {
    const done = Prog.beaten(nd.id), r = Prog.save.done[nd.id];
    const here = nd.id === this.at;
    g.save(); g.translate(nd.x, nd.y);
    if (here) { g.fillStyle = 'rgba(255,230,120,.25)'; g.beginPath(); g.arc(0, 0, 38 + Math.sin(t * 4) * 3, 0, TAU); g.fill(); }
    switch (nd.type) {
      case 'start': g.beginPath(); g.ellipse(0, 4, 22, 10, 0, 0, TAU); fs(g, '#8a7a6a', 2.5); rr(g, -2, -34, 4, 36, 2); fs(g, '#e0e0e8', 1.5); g.beginPath(); g.moveTo(2, -34); g.lineTo(22, -28); g.lineTo(2, -22); fs(g, '#ffd23a', 1.5); break;
      case 'level': {
        const col = nd.geheim ? (done ? '#c88aff' : '#7a3ab8') : done ? '#4f8ff7' : '#ef5a3a';
        g.beginPath(); g.ellipse(0, 6, 25, 12, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        g.beginPath(); g.arc(0, 0, 21, 0, TAU); fs(g, radial(g, 0, 0, 22, '#ffffff', col, col), 3);
        g.fillStyle = '#fff'; g.font = '18px ' + FONT; g.textAlign = 'center'; g.fillText(nd.geheim ? '?' : String(nd.num), 0, 7);
        if (r && r.s) { rr(g, 14, -38, 3, 26, 1); fs(g, '#e0e0e8', 1.2); g.beginPath(); g.moveTo(17, -38); g.lineTo(32, -32); g.lineTo(17, -26); fs(g, '#e0283a', 1.4); }
        if (!done && !nd.geheim) { g.globalAlpha = .4 + .4 * Math.sin(t * 5); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.stroke(); g.globalAlpha = 1; }
        this.drawStarsUnder(g, nd);
        break;
      }
      case 'turm': {
        g.beginPath(); g.ellipse(0, 6, 26, 10, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        rr(g, -16, -46, 32, 52, 4); fs(g, '#7a7488', 2.5);
        if (!done) { for (let i = 0; i < 3; i++) { rr(g, -18 + i * 13, -54, 10, 10, 2); fs(g, '#7a7488', 2); } rr(g, -1, -76, 3, 24, 1); fs(g, '#c0c0c8', 1.2); g.beginPath(); g.moveTo(2, -76); g.lineTo(18, -70); g.lineTo(2, -64); fs(g, '#7a1a9a', 1.4); }
        else { g.beginPath(); g.moveTo(-18, -46); g.lineTo(-8, -54); g.lineTo(0, -44); g.lineTo(10, -56); g.lineTo(18, -46); fs(g, '#7a7488', 2); }
        rr(g, -6, -10, 12, 16, [6, 6, 0, 0]); fs(g, '#2a1a20', 1.5);
        g.fillStyle = 'rgba(255,170,60,.7)'; rr(g, -4, -36, 8, 10, 3); g.fill();
        this.drawStarsUnder(g, nd);
        break;
      }
      case 'burg': {
        const fin = WORLD_SPECS[nd.world - 1].final;
        g.beginPath(); g.ellipse(0, 8, 46, 14, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        if (!done) { const au = g.createRadialGradient(0, -30, 10, 0, -30, 80); au.addColorStop(0, fin ? 'rgba(160,40,255,.45)' : 'rgba(120,40,160,.3)'); au.addColorStop(1, 'rgba(60,0,80,0)'); g.fillStyle = au; g.beginPath(); g.arc(0, -30, 80, 0, TAU); g.fill(); }
        const wall = fin ? '#3a2a4a' : '#6a6476';
        rr(g, -38, -40, 76, 46, 4); fs(g, wall, 2.5);
        for (const tx of [-40, 22]) { rr(g, tx, -66, 18, 72, 3); fs(g, wall, 2.5); g.beginPath(); g.moveTo(tx - 3, -66); g.lineTo(tx + 9, -86); g.lineTo(tx + 21, -66); fs(g, fin ? '#7a1a9a' : '#8a3a3a', 2); }
        rr(g, -10, -60, 20, 66, 3); fs(g, wall, 2.5);
        rr(g, -1, -88, 3, 30, 1); fs(g, '#c0c0c8', 1.2);
        g.beginPath(); g.moveTo(2, -88); g.lineTo(22, -82 + Math.sin(t * 4) * 2); g.lineTo(2, -76); fs(g, done ? '#ffffff' : '#7a1a9a', 1.4);
        if (done) { starPath(g, 10, -82, 4, 1.8); g.fillStyle = '#ffd23a'; g.fill(); }
        rr(g, -8, -14, 16, 20, [8, 8, 0, 0]); fs(g, '#1a0e14', 1.5);
        g.fillStyle = done ? 'rgba(255,220,120,.7)' : 'rgba(255,60,60,.75)'; for (const wx of [-30, 26]) { rr(g, wx, -50, 7, 9, 3); g.fill(); }
        this.drawStarsUnder(g, nd, 30);
        break;
      }
      case 'haus': {
        const used = !Prog.houseReady(nd.id);
        g.globalAlpha = used ? .5 : 1;
        g.beginPath(); g.ellipse(0, 6, 28, 10, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        rr(g, -20, -26, 40, 32, 3); fs(g, '#f4e6c8', 2.5);
        g.beginPath(); g.moveTo(-28, -24); g.lineTo(0, -50); g.lineTo(28, -24); g.closePath(); fs(g, nd.variant === 'rot' ? '#e0403a' : nd.variant === 'toad' ? '#ffc21a' : '#3fae4a', 2.5);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -34, 5, 0, TAU); g.fill();
        rr(g, -6, -14, 12, 20, [6, 6, 0, 0]); fs(g, '#8a5a2a', 1.5);
        rr(g, 9, -20, 8, 8, 2); fs(g, '#9ad4ff', 1.4);
        g.globalAlpha = 1;
        break;
      }
      case 'tor': {
        const paid = Prog.save.paid[nd.id];
        g.beginPath(); g.ellipse(0, 6, 30, 10, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        if (!paid) {
          rr(g, -24, -34, 48, 40, 6); fs(g, '#8a7a6a', 2.5);
          rr(g, -18, -50, 36, 22, 5); fs(g, '#f4e0b0', 2.2);
          starPath(g, -7, -39, 7, 3); g.fillStyle = '#ffb01a'; g.fill();
          g.fillStyle = '#4a2a10'; g.font = '15px ' + FONT; g.textAlign = 'left'; g.fillText(String(nd.cost), 2, -33);
        } else { for (const sx of [-26, 16]) { rr(g, sx, -30, 10, 36, 3); fs(g, '#8a7a6a', 2); } }
        break;
      }
      case 'kanone': {
        g.beginPath(); g.ellipse(0, 6, 26, 10, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
        g.save(); g.rotate(-.7); rr(g, -8, -40, 16, 40, 5); fs(g, '#3a3646', 2.5); g.restore();
        g.beginPath(); g.arc(0, -4, 14, 0, TAU); fs(g, '#5a5468', 2.5);
        g.fillStyle = '#ffd23a'; g.font = '13px ' + FONT; g.textAlign = 'center'; g.fillText('→' + nd.target, 0, 26);
        break;
      }
    }
    g.restore();
  },
  drawStarsUnder(g, nd, dy = 26) {
    const r = Prog.save.done[nd.id];
    for (let i = 0; i < 3; i++) {
      const got = r && r.stars[i];
      starPath(g, -14 + i * 14, dy + 6, 6, 2.6);
      g.fillStyle = got ? '#ffd23a' : 'rgba(0,0,0,.35)'; g.fill();
      g.strokeStyle = got ? '#a86400' : 'rgba(255,255,255,.4)'; g.lineWidth = 1.2; g.stroke();
    }
  },
  drawHud(g) {
    const spec = this.W.spec, nd = this.node();
    // Titel
    g.fillStyle = 'rgba(12,10,24,.7)'; rr(g, 14, 14, 360, 60, 16); g.fill();
    g.font = '26px ' + FONT; g.fillStyle = '#ffd23a'; g.textAlign = 'left';
    g.fillText(`Welt ${this.W.n}`, 30, 46);
    g.font = '15px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(spec.name, 30, 64);
    const [sg, sa] = Prog.starsWorld(this.W.n);
    g.font = '15px ' + FONT; g.fillStyle = '#ffe9a0'; g.textAlign = 'right'; g.fillText(`⭐ ${sg}/${sa}`, 360, 46);
    // rechts: Leben, Sternmünzen, Inventar
    const rx = SW - 118;
    g.fillStyle = 'rgba(12,10,24,.7)'; rr(g, rx - 300, 14, 300, 60, 16); g.fill();
    heartPath(g, rx - 276, 40, 11); g.fillStyle = '#ff5a7a'; g.fill();
    g.font = '22px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('× ' + G.lives, rx - 258, 48);
    g.save(); g.translate(rx - 168, 40); g.scale(.55, .55); drawStarCoin(g, 0, 0, 0, false, true); g.restore();
    g.fillText(String(Prog.starsFree()), rx - 148, 48);
    const invN = Object.values(Prog.save.inv).reduce((a, b) => a + b, 0);
    g.font = '13px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; g.textAlign = 'right';
    g.fillText(`🎒 ${invN} Extras`, rx - 14, 38);
    if (G.startPower) { g.fillStyle = '#7ef08a'; g.fillText('Bereit: ' + ITEM_INFO[G.startPower].name, rx - 14, 58); }
    // Info unten
    const bw = Math.min(640, SW - 40), bx = SW / 2 - bw / 2, by = SH - 130;
    g.fillStyle = 'rgba(12,10,24,.78)'; rr(g, bx, by, bw, 112, 18); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.stroke();
    let title = nd.title, sub = '';
    const r = Prog.save.done[nd.id];
    if (nd.type === 'level') { title = nd.geheim ? `Geheimlevel ${this.W.n}` : `Level ${nd.title}`; sub = THEMES[nd.theme].name + (nd.secret ? ' · hier gibt es einen geheimen Ausgang' : '') + (r && r.c ? ' · geschafft' : ''); }
    else if (nd.type === 'turm') { title = `Turm ${this.W.n}`; sub = 'Zwischenboss Panzerkäfer Krax · danach wird gespeichert'; }
    else if (nd.type === 'burg') { title = burgName(this.W.n); sub = spec.final ? 'Hier hält Morvax Prinzessin Lunara gefangen!' : spec.sternFinale ? 'Der Sternenkönig wartet – der letzte Kampf der Sternenwelt!' : spec.himmelFinale ? `${(BOSS_LOOK[this.W.n] || BOSS_LOOK[1]).name} wartet · der Kampf um das Himmelsreich` : `${(BOSS_LOOK[this.W.n] || BOSS_LOOK[1]).name} wartet · danach geht es in die nächste Welt`; }
    else if (nd.type === 'haus') sub = nd.variant === 'toad' ? 'Geheimer Tunnel entdeckt! Wählt eine Truhe mit Extras oder Leben' : nd.variant === 'rot' ? 'Findet Paare und gewinnt Extras fürs Inventar' : 'Schiesst auf Ballons und gewinnt Extraleben';
    else if (nd.type === 'tor') sub = Prog.save.paid[nd.id] ? 'Offen' : `Öffnen kostet ${nd.cost} Sternmünzen`;
    else if (nd.type === 'kanone') sub = `Fliegt direkt in Welt ${nd.target}`;
    else if (nd.type === 'start') sub = this.W.n === 1 ? 'Das Abenteuer beginnt!' : 'Hier geht es los';
    g.font = '24px ' + FONT; g.fillStyle = '#ffd23a'; g.textAlign = 'center';
    g.fillText(title, SW / 2, by + 34);
    g.font = '14px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(sub, SW / 2, by + 58);
    g.font = '12.5px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText('Laufen: Pfeile/WASD · Starten: Leertaste, Springen oder Klick · Inventar: E · Welt: Pfeile am Rand · Menü: Esc', SW / 2, by + 90);
    if (this.msg) {
      const a = Math.min(1, this.msg.t * 3);
      g.globalAlpha = a;
      g.font = '20px ' + FONT;
      const w = Math.min(SW - 60, g.measureText(this.msg.text).width + 50);
      g.fillStyle = 'rgba(255,248,230,.96)'; rr(g, SW / 2 - w / 2, 92, w, 46, 14); g.fill();
      g.fillStyle = '#3a1a40'; g.textAlign = 'center'; g.fillText(this.msg.text, SW / 2, 122);
      g.globalAlpha = 1;
    }
  },
  paintBg() {
    const c = document.createElement('canvas'); c.width = Math.round(SW * DPR); c.height = Math.round(SH * DPR);
    const g = c.getContext('2d'); g.scale(DPR, DPR);
    const spec = this.W.spec, rng = makeRng(this.W.n * 31);
    const sky = g.createLinearGradient(0, 0, 0, SH); sky.addColorStop(0, spec.sky[0]); sky.addColorStop(1, spec.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, SW, SH);
    const map = spec.map;
    if (map === 'nebel' || map === 'schatten' || map === 'sterne' || map === 'hoehle' || map === 'vulkan') {
      g.fillStyle = '#fff';
      for (let i = 0; i < 120; i++) { g.globalAlpha = rng.f() * .7; g.fillRect(rng.f() * SW, rng.f() * SH, 1.6, 1.6); }
      g.globalAlpha = 1;
    }
    if (spec.sea || map === 'wolken' || map === 'himmel') {
      g.strokeStyle = map === 'wolken' || map === 'himmel' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.25)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const x = rng.f() * SW, y = rng.f() * SH; g.beginPath(); g.arc(x, y, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    }
    this.layout();
    const v = this.view;
    g.save(); g.translate(v.ox, v.oy); g.scale(v.s, v.s);
    // Landmasse unter den Wegen
    const pts = this.W.nodes;
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (const nd of pts) { g.beginPath(); g.ellipse(nd.x + 8, nd.y + 18, 120, 80, 0, 0, TAU); g.fill(); }
    const land = g.createLinearGradient(0, 0, 0, 560); land.addColorStop(0, spec.land[0]); land.addColorStop(1, spec.land[1]);
    g.fillStyle = land;
    for (const nd of pts) { g.beginPath(); g.ellipse(nd.x, nd.y + 8, 120, 80, 0, 0, TAU); g.fill(); }
    // Deko
    for (let i = 0; i < 60; i++) {
      const nd = pts[Math.floor(rng.f() * pts.length)];
      const a = rng.f() * TAU, d = 50 + rng.f() * 60;
      const x = nd.x + Math.cos(a) * d * 1.4, y = nd.y + 8 + Math.sin(a) * d * .8;
      if (pts.some(o => Math.hypot(o.x - x, o.y - y) < 46)) continue;
      g.save(); g.translate(x, y); g.scale(.45, .45);
      const k = { wiese: ['baum', 'busch', 'blume'], wueste: ['kaktus', 'stein'], schnee: ['tanne', 'schneemann'], strand: ['palme', 'koralle'], wolken: ['puff'], hoehle: ['kristall', 'pilz'], nebel: ['baumtot', 'grab'], schatten: ['baumtot', 'kristall'], sterne: ['kristall'], dschungel: ['dschungelbaum', 'farn', 'busch', 'blume'], vulkan: ['obsidian', 'stein'], zucker: ['lolli', 'stange', 'muffin'], himmel: ['saeule', 'puff'] }[map];
      paintDeko(g, { kind: rng.pick(k), x: 0, y: 0, h: rng.f(), s: 1 }, THEMES[map] || THEMES.wiese);
      g.restore();
    }
    g.restore();
    const vg = g.createRadialGradient(SW / 2, SH / 2, SH * .3, SW / 2, SH / 2, SH);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,0,15,.45)');
    g.fillStyle = vg; g.fillRect(0, 0, SW, SH);
    return { c, w: SW, h: SH };
  },
};
modeHandlers.map = { update: dt => Karte.update(dt), render: dt => Karte.render(dt) };
cv.addEventListener('click', e => { if (G.mode === 'map' && !UI.overlayOpen()) Karte.click(e.clientX, e.clientY); else if (G.mode === 'memory') Memory.click(e.clientX, e.clientY); else if (G.mode === 'ballon') Ballon.click(); else if (G.mode === 'toad') Toad.click(e.clientX, e.clientY); else if (G.mode === 'story') Story.next(); });
