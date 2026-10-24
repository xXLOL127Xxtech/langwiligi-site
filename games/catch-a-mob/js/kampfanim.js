'use strict';
// Catch a Mob – Angriffs-Animationen. Jede Attacke hat in daten.js ein Feld anim: { t: Art, ... }.
// Hier stehen die Arten, die kampfui.js nicht selbst kennt (Sprung, Atem, Feuerball, Salve, Säule, Ranken, Spiesse, Wirbel, Flut,
// Meteore, Schattenhände, Saugen, Druckwelle, Seelenflammen, Wolke). Jede Art liest ihre Farben und Formen aus anim.
(function (G) {
  const CAM = G.CAM, K = CAM.Kampf, UI = CAM.UI;
  const h = K.h, sleep = h.sleep, ani = h.ani, ease = h.ease, easeIO = h.easeIO, burst = h.burst, addFx = h.addFx, mitte = h.mitte;
  const R = Math.random;
  const reg = K.anim = {};

  // ---------- Formen, die fliegen oder fallen (Ursprung in der Mitte, Spitze zeigt nach rechts) ----------
  function form(c, shape, s, cols, t) {
    const a = cols[0], b = cols[1] || cols[0];
    c.lineJoin = 'round';
    switch (shape) {
      case 'dorn': c.fillStyle = a; c.strokeStyle = b; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s * 1.3, 0); c.lineTo(-s * 0.8, -s * 0.3); c.lineTo(-s * 0.4, 0); c.lineTo(-s * 0.8, s * 0.3); c.closePath(); c.fill(); c.stroke(); break;
      case 'feder': c.fillStyle = a; c.beginPath(); c.ellipse(0, 0, s * 1.3, s * 0.38, 0, 0, 6.3); c.fill(); c.strokeStyle = b; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-s * 1.4, 0); c.lineTo(s * 1.2, 0); c.stroke();
        c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.4, 0); c.lineTo(i * s * 0.4 + s * 0.35, -s * 0.3); c.moveTo(i * s * 0.4, 0); c.lineTo(i * s * 0.4 + s * 0.35, s * 0.3); c.stroke(); } break;
      case 'funke': c.fillStyle = a; c.shadowColor = b; c.shadowBlur = 10; c.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.28 : s; c.lineTo(Math.cos(k * 0.785) * r, Math.sin(k * 0.785) * r); } c.closePath(); c.fill(); c.shadowBlur = 0; break;
      case 'knochen': c.fillStyle = a; c.strokeStyle = b; c.lineWidth = 1.5; c.fillRect(-s, -s * 0.16, s * 2, s * 0.32); for (const e of [-s, s]) for (const d of [-1, 1]) { c.beginPath(); c.arc(e, d * s * 0.2, s * 0.26, 0, 6.3); c.fill(); c.stroke(); } break;
      case 'blase': c.strokeStyle = a; c.lineWidth = 2; c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(0, 0, s * 0.9, 0, 6.3); c.fill(); c.stroke(); c.strokeStyle = b; c.beginPath(); c.arc(0, 0, s * 0.6, 3.6, 4.7); c.stroke(); break;
      case 'eis': c.fillStyle = a; c.strokeStyle = b; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s * 1.2, 0); c.lineTo(0, -s * 0.38); c.lineTo(-s * 0.8, 0); c.lineTo(0, s * 0.38); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(s * 0.7, 0); c.lineTo(0, -s * 0.2); c.lineTo(-s * 0.1, 0); c.closePath(); c.fill(); break;
      case 'kristall': c.fillStyle = a; c.strokeStyle = b; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s * 1.2, 0); c.lineTo(s * 0.3, -s * 0.5); c.lineTo(-s * 0.8, -s * 0.3); c.lineTo(-s * 0.8, s * 0.3); c.lineTo(s * 0.3, s * 0.5); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(s * 0.9, 0); c.lineTo(s * 0.3, -s * 0.4); c.lineTo(-s * 0.2, -s * 0.1); c.closePath(); c.fill(); break;
      case 'blatt': c.fillStyle = a; c.beginPath(); c.ellipse(0, 0, s, s * 0.55, 0, 0, 6.3); c.fill(); c.strokeStyle = b; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-s * 0.9, 0); c.lineTo(s * 0.9, 0); c.stroke(); break;
      case 'spore': c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.5, 0, 6.3); c.fill(); c.strokeStyle = b; c.globalAlpha *= 0.5; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, s * 0.85, 0, 6.3); c.stroke(); break;
      case 'klumpen': c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.8, 0, 6.3); c.fill(); c.fillStyle = b; c.beginPath(); c.arc(-s * 0.25, -s * 0.25, s * 0.35, 0, 6.3); c.fill(); break;
      case 'fels': c.fillStyle = a; c.strokeStyle = '#2a2018'; c.lineWidth = 2; c.beginPath(); c.moveTo(-s, -s * 0.2); c.lineTo(-s * 0.3, -s); c.lineTo(s * 0.8, -s * 0.6); c.lineTo(s, s * 0.4); c.lineTo(s * 0.1, s); c.lineTo(-s * 0.8, s * 0.6); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = b; c.beginPath(); c.moveTo(-s * 0.3, -s); c.lineTo(s * 0.8, -s * 0.6); c.lineTo(s * 0.1, -s * 0.1); c.closePath(); c.fill(); break;
      case 'feuer': { const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 1.2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, b); g.addColorStop(0.7, a); g.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 1.2, 0, 6.3); c.fill();
        c.fillStyle = a; c.globalAlpha *= 0.7; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-s * (1 + i * 0.6), Math.sin(t * 20 + i) * s * 0.3, s * (0.8 - i * 0.15), s * (0.5 - i * 0.1), 0, 0, 6.3); c.fill(); } break; }
      case 'lava': c.shadowColor = a; c.shadowBlur = 16; c.fillStyle = '#4a2a20'; c.beginPath(); c.arc(0, 0, s * 0.95, 0, 6.3); c.fill(); c.shadowBlur = 0; c.strokeStyle = a; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-s * 0.7, -s * 0.2); c.lineTo(0, s * 0.1); c.lineTo(s * 0.6, -s * 0.4); c.moveTo(0, s * 0.1); c.lineTo(s * 0.2, s * 0.7); c.stroke(); c.fillStyle = b; c.fillRect(-s * 0.1, -s * 0.1, s * 0.25, s * 0.25); break;
      case 'orb': { const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 1.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, a); g.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 1.3, 0, 6.3); c.fill();
        c.strokeStyle = b; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const an = i * 1.047 + t * 8; c.beginPath(); c.moveTo(Math.cos(an) * s * 0.9, Math.sin(an) * s * 0.9); c.lineTo(Math.cos(an) * s * 1.5, Math.sin(an) * s * 1.5); c.stroke(); } break; }
      case 'stern': c.fillStyle = a; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.shadowColor = b; c.shadowBlur = 10; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.4 : s; c.lineTo(Math.cos(k * 0.628 - 1.57) * r, Math.sin(k * 0.628 - 1.57) * r); } c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0; break;
      default: c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.8, 0, 6.3); c.fill();
    }
  }
  const mitStamm = (c, x, y, ang, fn) => { c.save(); c.translate(x, y); c.rotate(ang); fn(); c.restore(); };

  function ziele(x) { return x.ziele.length ? x.ziele : [x.an.a]; }
  function grund(id) { const l = h.BS().lay[id]; return l ? l.y + l.sz * 0.98 : mitte(id)[1] + 40; }
  const farben = x => x.cfg.cols && x.cfg.cols.length ? x.cfg.cols : [x.col, '#ffffff'];
  const stoss = (id, n) => { const BS = h.BS(); if (BS) BS.shake = Math.max(BS.shake, n); };

  // ---------- Sprung: nach oben, dann auf das Ziel ----------
  reg.sprung = async function (x) {
    const { an, cfg, o, A, T, ux } = x, dx = T[0] - A[0], dy = T[1] - A[1], cols = farben(x);
    UI.snd('schwung');
    await ani(180, t => { o.sy = 1 - 0.18 * t; o.sx = 1 + 0.1 * t; });
    if (cfg.deco === 'sturz') {
      // erst hoch hinaus, dann im Sturzflug schräg nach unten
      await ani(300, t => { o.y = -170 * ease(t); o.x = -ux * 30 * ease(t); o.sy = 1; o.sx = 1; o.rot = -0.3 * ux * t; });
      const sx = A[0] + o.x, sy = A[1] + o.y;
      UI.snd('schwung');
      await ani(170, t => {
        const e = t * t; o.x = -ux * 30 + (dx + ux * 30) * e; o.y = -170 + (dy + 170) * e; o.rot = Math.atan2(dy + 170, dx + 30) * (ux < 0 ? -1 : 1) * 0.6;
        h.BS().parts.push({ x: A[0] + o.x, y: A[1] + o.y, vx: (R() - 0.5) * 40, vy: (R() - 0.5) * 40, life: 0, max: 0.3, col: cfg.dunkel ? '#2a1048' : cols[0], size: 5, grav: 0 });
      });
      o.rot = 0;
      stoss(an.a, 10); burst(T[0], T[1], cols[0], 16, 240); burst(T[0], T[1], cols[1] || '#fff', 8, 160);
      addFx(380, (c, p) => { c.save(); c.translate(T[0], T[1]); c.globalAlpha = 1 - p; c.strokeStyle = cfg.dunkel ? '#8a5cf0' : '#fff'; c.lineWidth = 6 * (1 - p); for (let i = 0; i < 10; i++) { const a = i * 0.628; c.beginPath(); c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); c.lineTo(Math.cos(a) * (30 + p * 60), Math.sin(a) * (30 + p * 60)); c.stroke(); } c.restore(); });
      ani(420, t => { const e = easeIO(t); o.x = (dx + ux * 30) * (1 - e); o.y = dy * (1 - e); o.rot = 0; });
      await sleep(260);
      return;
    }
    // Sprung in hohem Bogen
    const bis = 0.92;
    await ani(380, t => { const e = easeIO(t); o.x = dx * bis * e; o.y = dy * bis * e - Math.sin(Math.PI * t) * 130; o.sx = 1 - 0.08 * Math.sin(Math.PI * t); o.sy = 1 + 0.12 * Math.sin(Math.PI * t); });
    o.sx = 1; o.sy = 1;
    stoss(an.a, 12);
    if (cfg.deco === 'feuer') {
      burst(T[0], T[1], '#ff6a2e', 22, 260, 40); burst(T[0], T[1], '#ffd54a', 14, 200, 40);
      addFx(560, (c, p) => { c.save(); c.translate(T[0], T[1] + 30); for (let k = 0; k < 3; k++) { const q = Math.max(0, p - k * 0.1); if (q <= 0) continue; c.globalAlpha = (1 - q) * 0.9; c.strokeStyle = k ? '#ff6a2e' : '#ffd54a'; c.lineWidth = 8 - k * 2; c.beginPath(); c.ellipse(0, 0, q * 130, q * 44, 0, 0, 6.3); c.stroke(); }
        c.globalAlpha = 1 - p; c.fillStyle = '#ff6a2e'; for (let i = 0; i < 7; i++) { const a = -1.57 + (i - 3) * 0.35; const l = 40 + 60 * Math.sin(p * 3.1) * (0.5 + (i % 2) * 0.5); c.beginPath(); c.moveTo(Math.cos(a - 0.14) * 10, Math.sin(a - 0.14) * 4); c.lineTo(Math.cos(a) * l, Math.sin(a) * l * 1.3); c.lineTo(Math.cos(a + 0.14) * 10, Math.sin(a + 0.14) * 4); c.fill(); } c.restore(); });
    } else {   // stampf
      const gy = grund(ziele(x)[0]);
      for (let i = 0; i < 12; i++) h.BS().parts.push({ x: T[0] + (R() - 0.5) * 120, y: gy, vx: (R() - 0.5) * 220, vy: -80 - R() * 160, life: 0, max: 0.7, col: i % 2 ? '#8a7a62' : '#b8a888', size: 4 + R() * 6, grav: 420 });
      addFx(600, (c, p) => { c.save(); c.translate(T[0], gy); c.globalAlpha = 1 - p; c.strokeStyle = '#2a2018'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, p * 170, p * 30, 0, 0, 6.3); c.stroke(); c.strokeStyle = '#b8a888'; c.lineWidth = 2; c.stroke(); c.restore(); });
      UI.snd('beben');
    }
    ani(420, t => { const e = easeIO(t); o.x = dx * bis * (1 - e); o.y = dy * bis * (1 - e); });
    await sleep(300);
  };

  // ---------- Rolle: dreht sich und rast zweimal durch das Ziel ----------
  reg.rolle = async function (x) {
    const { an, o, A, T } = x, dx = T[0] - A[0], dy = T[1] - A[1], cols = farben(x);
    UI.snd('schwung');
    await ani(220, t => { o.x = -dx * 0.08 * ease(t); o.sx = 1 + 0.1 * t; o.sy = 1 - 0.1 * t; });
    for (let pass = 0; pass < 2; pass++) {
      await ani(260, t => {
        const e = easeIO(t), k = pass ? 1 - e : e; o.x = dx * 0.95 * k - dx * 0.08 * (1 - k); o.y = dy * 0.95 * k; o.rot = (pass * 6.3 + t * 6.3) * (dx < 0 ? -1 : 1); o.sx = 1; o.sy = 1;
        if (R() < 0.8) h.BS().parts.push({ x: A[0] + o.x, y: A[1] + o.y, vx: (R() - 0.5) * 80, vy: (R() - 0.5) * 80, life: 0, max: 0.35, col: cols[R() < 0.5 ? 0 : 1] || cols[0], size: 3 + R() * 4, grav: 0 });
      });
      burst(T[0], T[1], cols[0], 12, 220); burst(T[0], T[1], cols[1] || '#fff', 8, 160); stoss(an.a, 8);
    }
    o.rot = 0;
    ani(300, t => { const e = easeIO(t); o.x = -dx * 0.08 * (1 - e); o.y = 0; });
    await sleep(240);
  };

  // ---------- Atem: ein Kegel aus Teilchen ----------
  reg.atem = async function (x) {
    const { an, o, A, T, ux, uy, cfg } = x, cols = farben(x);
    UI.snd('schwung');
    await ani(260, t => { o.x = -ux * 14 * ease(t); o.sy = 1 + 0.07 * t; o.sx = 1 - 0.05 * t; });
    const sx = A[0] + ux * 36, sy = A[1] - 14, dist = Math.hypot(T[0] - sx, T[1] - sy), ang = Math.atan2(T[1] - sy, T[0] - sx);
    const dauer = 700;
    await ani(dauer, t => {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = ang + (R() - 0.5) * 0.5, v = dist / 0.55 * (0.7 + R() * 0.5);
        h.BS().parts.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.4 + R() * 0.25, col: cols[Math.floor(R() * cols.length)], size: 6 + R() * 12 * (0.4 + t), grav: -30 });
      }
      if (t > 0.25) stoss(an.a, 2);
    });
    burst(T[0], T[1], cols[0], 14, 180, 0);
    ani(300, t => { o.x = -ux * 14 * (1 - ease(t)); o.sx = 1; o.sy = 1; });
    await sleep(260);
  };

  // ---------- Ball: lädt auf, fliegt im Bogen, explodiert ----------
  reg.ball = async function (x) {
    const { an, cfg, o, A, T, ux, uy } = x, cols = farben(x), r = cfg.r || 14, sh = cfg.shape || 'orb';
    UI.snd('schwung');
    const sx = A[0] + ux * 34, sy = A[1] - 22;
    // aufladen
    const lad = addFx(380, (c, p) => { c.save(); c.translate(sx, sy); c.globalAlpha = 0.5 + 0.5 * p; form(c, sh, r * (0.3 + 0.7 * p), cols, p); c.restore(); });
    await ani(380, t => { o.y = -6 * ease(t); o.sx = 1 + 0.05 * t; });
    ani(280, t => { o.y = -6 * (1 - ease(t)); o.sx = 1; });
    const Z = T, flug = 460, spin = sh === 'fels' || sh === 'lava';
    let lx = sx, ly = sy;
    await ani(flug, t => {
      const px = sx + (Z[0] - sx) * t, py = sy + (Z[1] - sy) * t - Math.sin(t * Math.PI) * 70;
      h.BS().proj = h.BS().proj || [];
      h.BS().proj.push({ fn: c => mitStamm(c, px, py, spin ? t * 12 : Math.atan2(py - ly, px - lx), () => form(c, sh, r * (1 + 0.3 * t), cols, t)) });
      if (R() < 0.8) h.BS().parts.push({ x: px, y: py, vx: (R() - 0.5) * 40, vy: (R() - 0.5) * 40 + 20, life: 0, max: 0.3, col: cols[R() < 0.5 ? 0 : 1] || cols[0], size: 3 + R() * 5, grav: 0 });
      lx = px; ly = py;
    });
    for (const zid of ziele(x)) {
      const ZZ = mitte(zid);
      burst(ZZ[0], ZZ[1], cols[0], 22, 260); burst(ZZ[0], ZZ[1], cols[1] || '#fff', 12, 180);
      addFx(480, (c, p) => { c.save(); c.translate(ZZ[0], ZZ[1]); const g = c.createRadialGradient(0, 0, 0, 0, 0, 30 + p * 70); g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - p)) + ')'); g.addColorStop(0.5, cols[0] + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = 1 - p * 0.6; c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30 + p * 70, 0, 6.3); c.fill(); c.restore(); });
    }
    stoss(an.a, 10); await sleep(260);
  };

  // ---------- Salve: ein Schwarm kleiner Geschosse ----------
  reg.salve = async function (x) {
    const { an, cfg, o, A, T, ux, uy } = x, cols = farben(x), n = cfg.n || 6, sh = cfg.shape;
    UI.snd('schwung');
    await ani(220, t => { o.x = -ux * 12 * ease(t); o.sy = 1 + 0.05 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 14, fertig = [], zl = ziele(x);
    for (let i = 0; i < n; i++) {
      const Z = mitte(zl[i % zl.length]), st = i * 70, flug = 380 + R() * 120;
      const jx = (R() - 0.5) * 60, jy = (R() - 0.5) * 60, bog = 20 + R() * 60 * (sh === 'blase' ? 1.5 : 1), wob = R() * 6;
      let lx = sx, ly = sy, treffer = false;
      fertig.push(ani(flug + st, t0 => {
        if (t0 * (flug + st) < st) return;
        const t = Math.min(1, (t0 * (flug + st) - st) / flug);
        const px = sx + (Z[0] + jx - sx) * t + (sh === 'blase' ? Math.sin(t * 9 + wob) * 14 : 0), py = sy + (Z[1] + jy - sy) * t - Math.sin(t * Math.PI) * bog;
        const ang = Math.atan2(py - ly, px - lx); lx = px; ly = py;
        h.BS().proj = h.BS().proj || [];
        h.BS().proj.push({ fn: c => mitStamm(c, px, py, sh === 'fels' || sh === 'stern' || sh === 'funke' || sh === 'knochen' ? t * 14 + i : ang, () => form(c, sh, 9 + (cfg.gross ? 5 : 0), cols, t)) });
        if (t >= 1 && !treffer) { treffer = true; burst(px, py, cols[i % cols.length], 6, 140); }
      }));
    }
    ani(300, t => { o.x = -ux * 12 * (1 - ease(t)); o.sy = 1; });
    await Promise.all(fertig);
    stoss(an.a, 5); await sleep(200);
  };

  // ---------- Säule: Kreis am Boden, dann ein Strahl von oben ----------
  reg.saeule = async function (x) {
    const { an, o, cfg } = x, cols = farben(x);
    UI.snd('schwung');
    await ani(240, t => { o.y = -10 * ease(t); o.sy = 1 + 0.06 * t; });
    ani(500, t => { o.y = -10 * (1 - ease(t)); o.sy = 1; });
    for (const zid of ziele(x)) {
      const Z = mitte(zid), gy = grund(zid), l = h.BS().lay[zid], br = Math.max(26, (l ? l.sz : 80) * 0.28);
      addFx(1250, (c, p) => {
        c.save();
        const warn = Math.min(1, p / 0.28), beam = p < 0.28 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        c.translate(Z[0], gy);
        c.strokeStyle = cols[0]; c.lineWidth = 3; c.globalAlpha = 0.8 * (p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1);
        c.beginPath(); c.ellipse(0, 0, br * 1.6 * warn, br * 0.5 * warn, 0, 0, 6.3); c.stroke();
        c.beginPath(); c.ellipse(0, 0, br * 1.0 * warn, br * 0.32 * warn, p * 6, 0, 6.3); c.stroke();
        if (beam > 0) {
          const wob = 1 + Math.sin(p * 90) * 0.06, top = -gy - 20;
          c.shadowColor = cols[0]; c.shadowBlur = 28; c.globalAlpha = beam;
          c.fillStyle = cols[0]; c.fillRect(-br * wob, top, br * 2 * wob, -top);
          c.fillStyle = cols[1] || '#fff'; c.fillRect(-br * 0.6 * wob, top, br * 1.2 * wob, -top);
          c.fillStyle = cols[2] || '#fff'; c.fillRect(-br * 0.25, top, br * 0.5, -top);
          c.shadowBlur = 0;
        }
        c.restore();
      });
      setTimeout(() => { const BS = h.BS(); if (!BS) return; for (let i = 0; i < 26; i++) BS.parts.push({ x: Z[0] + (R() - 0.5) * br * 2, y: gy - R() * 40, vx: (R() - 0.5) * 60, vy: -140 - R() * 220, life: 0, max: 0.8, col: cols[i % cols.length], size: 3 + R() * 5, grav: -40 }); BS.shake = Math.max(BS.shake, 12); }, 350);
    }
    await sleep(900);
  };

  // ---------- Ranken: wachsen aus dem Boden und packen zu ----------
  reg.ranken = async function (x) {
    const { an, cfg, o, ux } = x, cols = farben(x), gross = cfg.gross;
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 10 * ease(t); });
    ani(500, t => { o.x = -ux * 10 * (1 - ease(t)); });
    for (const zid of ziele(x)) {
      const Z = mitte(zid), gy = grund(zid), l = h.BS().lay[zid], hoch = (l ? l.sz : 90) * (gross ? 0.8 : 0.62), n = gross ? 7 : 5;
      addFx(1100, (c, p) => {
        c.save(); c.lineCap = 'round';
        const wachs = p < 0.4 ? ease(p / 0.4) : 1, ein = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1, zu = p > 0.4 && p < 0.8 ? (p - 0.4) / 0.4 : p >= 0.8 ? 1 : 0;
        for (let k = 0; k < n; k++) {
          const bx = Z[0] + (k - (n - 1) / 2) * 20, seg = 14, ph = k * 1.7;
          c.globalAlpha = ein;
          for (const [w, col] of [[10, cols[0]], [4, cols[1] || '#fff']]) {
            c.strokeStyle = col; c.lineWidth = w * (gross ? 1.15 : 1); c.beginPath();
            for (let i = 0; i <= seg; i++) {
              const q = i / seg * wachs, y = gy - q * hoch * (0.7 + 0.3 * ((k * 37) % 5) / 4);
              const x2 = bx + Math.sin(q * 6 + ph + p * 8) * 16 * (1 - zu * 0.7) - (bx - Z[0]) * zu * q * 0.8;
              if (i) c.lineTo(x2, y); else c.moveTo(x2, y);
            }
            c.stroke();
          }
          if (cfg.t && wachs > 0.5) { c.fillStyle = cols[1] || '#fff'; for (let i = 3; i < seg; i += 4) { const q = i / seg * wachs, y = gy - q * hoch * 0.8, x2 = bx + Math.sin(q * 6 + ph + p * 8) * 16; c.beginPath(); c.moveTo(x2, y); c.lineTo(x2 + 8 * (k % 2 ? 1 : -1), y - 6); c.lineTo(x2, y - 3); c.fill(); } }
        }
        c.restore();
      });
      setTimeout(() => { const BS = h.BS(); if (BS) { burst(Z[0], gy - 20, cols[0], 14, 160); BS.shake = Math.max(BS.shake, 6); } }, 520);
    }
    await sleep(820);
  };

  // ---------- Spiesse: brechen in einer Reihe aus dem Boden ----------
  function spiess(c, sh, w, hh, cols) {
    switch (sh) {
      case 'koralle': c.fillStyle = cols[0]; c.strokeStyle = '#4a1a14'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.4, 0); c.lineTo(-w * 0.3, -hh * 0.6); c.lineTo(-w * 0.8, -hh * 0.9); c.lineTo(-w * 0.2, -hh * 0.75); c.lineTo(0, -hh); c.lineTo(w * 0.2, -hh * 0.7); c.lineTo(w * 0.8, -hh * 0.85); c.lineTo(w * 0.3, -hh * 0.5); c.lineTo(w * 0.4, 0); c.closePath(); c.fill(); c.stroke(); break;
      case 'pilz': c.fillStyle = cols[1] || '#f0e0c0'; c.fillRect(-w * 0.25, -hh * 0.8, w * 0.5, hh * 0.8); c.fillStyle = cols[0]; c.strokeStyle = '#2a1008'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -hh * 0.85, w * 1.1, hh * 0.28, 0, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = cols[1] || '#f0e0c0'; c.fillRect(-w * 0.5, -hh * 0.95, w * 0.2, w * 0.2); c.fillRect(w * 0.2, -hh * 0.9, w * 0.25, w * 0.25); break;
      case 'eis': c.fillStyle = cols[0]; c.strokeStyle = '#3a7aa8'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.5, 0); c.lineTo(0, -hh); c.lineTo(w * 0.5, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(-w * 0.3, -hh * 0.1); c.lineTo(0, -hh * 0.9); c.lineTo(-w * 0.05, -hh * 0.1); c.closePath(); c.fill(); break;
      case 'kristall': c.fillStyle = cols[0]; c.strokeStyle = '#2a3a7a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.5, 0); c.lineTo(-w * 0.4, -hh * 0.75); c.lineTo(0, -hh); c.lineTo(w * 0.4, -hh * 0.75); c.lineTo(w * 0.5, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = cols[1] || '#fff'; c.globalAlpha *= 0.6; c.beginPath(); c.moveTo(-w * 0.35, -hh * 0.1); c.lineTo(-w * 0.3, -hh * 0.7); c.lineTo(0, -hh * 0.95); c.lineTo(-w * 0.05, -hh * 0.1); c.closePath(); c.fill(); break;
      default: c.fillStyle = cols[0]; c.strokeStyle = '#2a2018'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.5, 0); c.lineTo(-w * 0.1, -hh); c.lineTo(w * 0.5, 0); c.closePath(); c.fill(); c.stroke();
    }
  }
  reg.spiesse = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), gross = cfg.gross, n = gross ? 7 : 5;
    UI.snd('beben');
    await ani(220, t => { o.y = -8 * ease(t); o.sy = 1 + 0.06 * t; });
    ani(300, t => { o.y = -8 * (1 - ease(t)); o.sy = 1; });
    for (const zid of ziele(x)) {
      const Z = mitte(zid), gy = grund(zid), sx = A[0] + ux * 60;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n, px = sx + (Z[0] - sx) * f + (R() - 0.5) * 16, hh = (50 + 90 * f) * (gross ? 1.25 : 1), w = 18 + 24 * f, st = i * 90;
        addFx(900 + st, (c, p) => {
          const tt = p * (900 + st) - st; if (tt < 0) return;
          const q = tt / 900, hoch = q < 0.18 ? ease(q / 0.18) : q > 0.75 ? 1 - (q - 0.75) / 0.25 : 1;
          c.save(); c.translate(px, gy); c.beginPath(); c.rect(-90, -hh - 40, 180, hh + 40); c.clip(); c.translate(0, (1 - hoch) * hh); spiess(c, cfg.shape, w, hh, cols); c.restore();
        });
        setTimeout(() => { const BS = h.BS(); if (BS) { for (let k = 0; k < 4; k++) BS.parts.push({ x: px + (R() - 0.5) * 30, y: gy, vx: (R() - 0.5) * 140, vy: -90 - R() * 130, life: 0, max: 0.55, col: cols[k % cols.length], size: 3 + R() * 4, grav: 420 }); BS.shake = Math.max(BS.shake, 5 + f * 6); } }, st);
      }
    }
    await sleep(n * 90 + 600);
  };

  // ---------- Wirbel: Trichter aus kreisenden Teilen ----------
  reg.wirbel = async function (x) {
    const { an, cfg, o } = x, cols = farben(x), sh = cfg.shape || 'blase', gross = cfg.gross;
    UI.snd('schwung');
    await ani(240, t => { o.y = -8 * ease(t); });
    ani(500, t => { o.y = -8 * (1 - ease(t)); });
    for (const zid of ziele(x)) {
      const Z = mitte(zid), gy = grund(zid), l = h.BS().lay[zid], hoch = (l ? l.sz : 90) * (gross ? 1.0 : 0.8), breit = (l ? l.sz : 90) * (gross ? 0.55 : 0.42);
      const teile = Array.from({ length: gross ? 34 : 24 }, (_, i) => ({ q: R(), a: R() * 6.3, v: 0.8 + R() * 0.8, s: 5 + R() * 6, k: i }));
      addFx(1000, (c, p) => {
        const auf = p < 0.2 ? p / 0.2 : p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
        c.save(); c.translate(Z[0], gy);
        c.globalAlpha = 0.25 * auf; c.fillStyle = cols[0]; c.beginPath(); c.moveTo(-breit * 0.4, 0); c.lineTo(-breit, -hoch); c.lineTo(breit, -hoch); c.lineTo(breit * 0.4, 0); c.closePath(); c.fill();
        c.globalAlpha = auf; c.strokeStyle = cols[1] || '#fff'; c.lineWidth = 3;
        for (let k = 0; k < 5; k++) { const q = (k + 0.5) / 5, r = breit * (0.4 + 0.6 * q); c.beginPath(); c.ellipse(0, -hoch * q, r, r * 0.28, 0, Math.PI * 0.1 + p * 14 * (k % 2 ? 1 : -1), Math.PI * 0.9 + p * 14 * (k % 2 ? 1 : -1)); c.stroke(); }
        for (const t of teile) {
          const q = (t.q + p * t.v) % 1, a = t.a + p * 12 * t.v, r = breit * (0.4 + 0.6 * q);
          mitStamm(c, Math.cos(a) * r, -hoch * q + Math.sin(a) * r * 0.28, a + 1.57 * (sh === 'feder' ? 1 : 0), () => { c.globalAlpha = auf * (Math.sin(a) > -0.2 ? 1 : 0.5); form(c, sh === 'schnee' ? 'funke' : sh, t.s, sh === 'schnee' ? ['#ffffff', '#bfe6ff'] : cols, p); });
        }
        c.restore();
      });
      setTimeout(() => { const BS = h.BS(); if (BS) BS.shake = Math.max(BS.shake, 7); }, 400);
    }
    await sleep(1000);
  };

  // ---------- Flut: eine Welle rauscht über das Feld ----------
  reg.flut = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), BS = h.BS(), gross = cfg.gross;
    UI.snd('schwung');
    await ani(240, t => { o.y = -8 * ease(t); o.sy = 1 + 0.05 * t; });
    ani(500, t => { o.y = -8 * (1 - ease(t)); o.sy = 1; });
    const gy = grund(ziele(x)[0]), von = A[0] - ux * 40, bis = T[0] + ux * 220, hoch = gross ? 190 : 120, br = 260, dauer = 1100;
    UI.snd('el_Wasser');
    addFx(dauer, (c, p) => {
      const cx = von + (bis - von) * p, a = Math.min(1, p * 4) * (1 - Math.max(0, (p - 0.8) / 0.2));
      c.save(); c.globalAlpha = a;
      const g = c.createLinearGradient(0, gy - hoch, 0, gy + 10); g.addColorStop(0, cols[1] || '#fff'); g.addColorStop(0.25, cols[0]); g.addColorStop(1, cfg.dunkel ? '#10241c' : cfg.lava ? '#7a1a08' : '#1a4a8a');
      c.fillStyle = g; c.beginPath(); c.moveTo(cx - br, gy + 10);
      const top = x2 => gy - hoch * Math.max(0, 1 - Math.pow(Math.abs(x2 - cx) / br, 1.6)) * (0.85 + 0.15 * Math.sin(x2 * 0.05 + p * 30));
      for (let x2 = cx - br; x2 <= cx + br; x2 += 8) c.lineTo(x2, top(x2));
      c.lineTo(cx + br, gy + 10); c.closePath(); c.fill();
      c.fillStyle = cfg.lava ? '#ffe14d' : '#fff'; for (let i = 0; i < 18; i++) { const x2 = cx - br + ((i * 53 + p * 600) % (br * 2)), yy = top(x2); if (yy < gy - 6) { c.globalAlpha = a * 0.8; c.beginPath(); c.arc(x2, yy + 4 + Math.sin(p * 20 + i) * 3, 3 + (i % 3), 0, 6.3); c.fill(); } }
      c.restore();
    });
    const t0 = Math.abs(T[0] - von) / Math.abs(bis - von) * dauer;
    await sleep(Math.max(300, t0 - 100));
    for (const zid of ziele(x)) { const Z = mitte(zid); burst(Z[0], Z[1], cols[0], 22, 260, 60); burst(Z[0], Z[1], cols[1] || '#fff', 12, 180, 60); }
    BS.shake = Math.max(BS.shake, 12);
    await sleep(520);
  };

  // ---------- Meteore: fallen schräg vom Himmel ----------
  reg.meteor = async function (x) {
    const { an, cfg, o, ux } = x, cols = farben(x), n = cfg.n || 7, sh = cfg.shape, BS = h.BS();
    UI.snd('schwung');
    await ani(260, t => { o.y = -12 * ease(t); o.sy = 1 + 0.08 * t; });
    ani(500, t => { o.y = -12 * (1 - ease(t)); o.sy = 1; });
    const zl = ziele(x), fertig = [];
    for (let i = 0; i < n; i++) {
      const Z = mitte(zl[i % zl.length]), gy = grund(zl[i % zl.length]), zx = Z[0] + (R() - 0.5) * 150, zy = Math.min(gy - 10, Z[1] + (R() - 0.2) * 70), st = i * 100, flug = 380, sx = zx + 260, sy = -60 - R() * 120;
      let aus = false;
      fertig.push(ani(flug + st, t0 => {
        if (t0 * (flug + st) < st) return;
        const t = Math.min(1, (t0 * (flug + st) - st) / flug), px = sx + (zx - sx) * t * t, py = sy + (zy - sy) * t * t, ang = Math.atan2(zy - sy, zx - sx);
        BS.proj = BS.proj || [];
        BS.proj.push({ fn: c => { c.save(); c.globalAlpha = 0.5; c.strokeStyle = cols[0]; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(px - Math.cos(ang) * 70, py - Math.sin(ang) * 70); c.lineTo(px, py); c.stroke(); c.restore(); mitStamm(c, px, py, sh === 'feuer' ? ang : t * 10, () => form(c, sh, 16 + (i % 3) * 3, cols, t)); } });
        if (t >= 1 && !aus) { aus = true; burst(px, py, cols[i % cols.length], 14, 220, 160); addFx(340, (c, p) => { c.save(); c.translate(px, py); c.globalAlpha = 1 - p; c.strokeStyle = cols[0]; c.lineWidth = 5 * (1 - p); c.beginPath(); c.ellipse(0, 0, 14 + p * 50, (14 + p * 50) * 0.5, 0, 0, 6.3); c.stroke(); c.restore(); }); BS.shake = Math.max(BS.shake, 9); UI.snd('el_Erde'); }
      }));
    }
    await Promise.all(fertig); await sleep(240);
  };

  // ---------- Schattenhände greifen aus dem Boden ----------
  reg.schatten = async function (x) {
    const { an, cfg, o } = x, cols = farben(x), gross = cfg.gross;
    UI.snd('el_Schatten');
    await ani(240, t => { o.y = -8 * ease(t); });
    ani(500, t => { o.y = -8 * (1 - ease(t)); });
    for (const zid of ziele(x)) {
      const Z = mitte(zid), gy = grund(zid), l = h.BS().lay[zid], hoch = (l ? l.sz : 90) * 0.55, n = gross ? 5 : 3;
      addFx(1100, (c, p) => {
        const auf = p < 0.35 ? ease(p / 0.35) : 1, zu = p > 0.45 ? Math.min(1, (p - 0.45) / 0.2) : 0, ein = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
        c.save(); c.globalAlpha = ein; c.lineCap = 'round';
        for (let k = 0; k < n; k++) {
          const bx = Z[0] + (k - (n - 1) / 2) * 34, hx = bx - (bx - Z[0]) * zu * 0.9, hy = gy - hoch * auf * (0.8 + 0.2 * Math.sin(k * 2)) + Math.sin(p * 14 + k) * 4;
          c.strokeStyle = '#120a1c'; c.lineWidth = 11; c.beginPath(); c.moveTo(bx, gy); c.quadraticCurveTo(bx + Math.sin(p * 8 + k) * 22, (gy + hy) / 2, hx, hy); c.stroke();
          c.strokeStyle = cols[0]; c.lineWidth = 3; c.stroke();
          c.fillStyle = '#120a1c'; c.beginPath(); c.arc(hx, hy, 11, 0, 6.3); c.fill();
          c.strokeStyle = '#120a1c'; c.lineWidth = 4; for (let f = 0; f < 4; f++) { const a = -1.57 + (f - 1.5) * 0.45 * (1 - zu * 0.8); c.beginPath(); c.moveTo(hx, hy - 6); c.lineTo(hx + Math.cos(a) * 16, hy - 6 + Math.sin(a) * 16); c.stroke(); c.strokeStyle = cols[1] || '#fff'; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = '#120a1c'; c.lineWidth = 4; }
        }
        c.restore();
      });
      setTimeout(() => { const BS = h.BS(); if (BS) { for (let i = 0; i < 16; i++) BS.parts.push({ x: Z[0] + (R() - 0.5) * 80, y: gy - R() * 80, vx: (R() - 0.5) * 50, vy: -50 - R() * 80, life: 0, max: 0.9, col: cols[i % cols.length], size: 3 + R() * 4, grav: -30 }); BS.shake = Math.max(BS.shake, 6); } }, 560);
    }
    await sleep(900);
  };

  // ---------- Saugen: Lebenskraft strömt zum Angreifer ----------
  reg.saugen = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), BS = h.BS();
    UI.snd('einsaugen');
    await ani(240, t => { o.x = -ux * 8 * ease(t); o.sy = 1 + 0.05 * t; });
    const tid = ziele(x)[0], s = BS.shown[tid];
    await ani(cfg.stark ? 1000 : 800, t => {
      if (s && Math.floor(t * 40) % 3 === 0) s.flash = Math.max(s.flash, 60);
      for (let i = 0; i < (cfg.stark ? 4 : 3); i++) {
        const q = R(), bx = T[0] + (R() - 0.5) * 60, by = T[1] + (R() - 0.5) * 60;
        BS.parts.push({ x: bx, y: by, vx: (A[0] - bx) * 1.6 + Math.sin(R() * 6) * 40, vy: (A[1] - by) * 1.6 - 40, life: 0, max: 0.55, col: cols[q < 0.5 ? 0 : cols.length - 1], size: 4 + R() * 5, grav: 0 });
      }
    });
    burst(A[0], A[1], cols[0], 12, 100, -30); burst(T[0], T[1], cols[0], 10, 160);
    ani(300, t => { o.x = -ux * 8 * (1 - ease(t)); o.sy = 1; });
    await sleep(240);
  };

  // ---------- Nova: Druckwelle rund um den Angreifer ----------
  reg.nova = async function (x) {
    const { an, cfg, o, A } = x, cols = farben(x), BS = h.BS(), ringe = cfg.ringe || 3;
    UI.snd('beben');
    await ani(420, t => { o.sy = 1 - 0.14 * t; o.sx = 1 + 0.12 * t; if (R() < 0.7) BS.parts.push({ x: A[0] + (R() - 0.5) * 70, y: A[1] + 40, vx: 0, vy: -90 - R() * 80, life: 0, max: 0.5, col: cols[0], size: 3 + R() * 4, grav: -20 }); });
    addFx(850, (c, p) => {
      c.save(); c.translate(A[0], A[1]); c.shadowColor = cols[0]; c.shadowBlur = 18;
      for (let k = 0; k < ringe; k++) { const q = Math.max(0, p - k * 0.1); if (q <= 0) continue; c.globalAlpha = (1 - q) * 0.9; c.strokeStyle = cols[k % cols.length]; c.lineWidth = 11 - k * 2; c.beginPath(); c.ellipse(0, 0, q * 520, q * 330, 0, 0, 6.3); c.stroke(); }
      c.globalAlpha = Math.max(0, 1 - p * 2.2); c.fillStyle = cols[0]; for (let i = 0; i < 14; i++) { const a = i * 0.449, l = 40 + p * 300; c.beginPath(); c.moveTo(Math.cos(a - 0.07) * l * 0.5, Math.sin(a - 0.07) * l * 0.32); c.lineTo(Math.cos(a) * l, Math.sin(a) * l * 0.62); c.lineTo(Math.cos(a + 0.07) * l * 0.5, Math.sin(a + 0.07) * l * 0.32); c.fill(); }
      c.restore();
    });
    o.sx = 1; o.sy = 1; o.y = -10;
    ani(360, t => { o.y = -10 * (1 - ease(t)); });
    BS.shake = Math.max(BS.shake, 14);
    await sleep(380);
    for (const zid of ziele(x)) { const Z = mitte(zid); burst(Z[0], Z[1], cols[0], 16, 240); }
    await sleep(380);
  };

  // ---------- Puls: Schallwellen laufen zum Ziel ----------
  reg.puls = async function (x) {
    const { an, cfg, o, A, T, ux, uy } = x, cols = farben(x), BS = h.BS();
    UI.snd('ruf');
    await ani(260, t => { o.sx = 1 + 0.12 * t; o.sy = 1 - 0.1 * t; });
    const sx = A[0] + ux * 40, sy = A[1] - 14, ang = Math.atan2(T[1] - sy, T[0] - sx), dist = Math.hypot(T[0] - sx, T[1] - sy);
    addFx(900, (c, p) => {
      c.save(); c.translate(sx, sy); c.rotate(ang); c.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const q = Math.max(0, Math.min(1, (p - k * 0.07) / 0.5)); if (q <= 0) continue;
        const r = 16 + k * 6; c.globalAlpha = Math.sin(q * Math.PI) * 0.9; c.strokeStyle = cols[k % cols.length]; c.lineWidth = 5 - k * 0.4;
        c.beginPath(); c.arc(q * dist - r * 0.6, 0, r * (1 + q * 1.8), -0.9, 0.9); c.stroke();
      }
      c.restore();
    });
    BS.shake = Math.max(BS.shake, 10);
    ani(500, t => { o.sx = 1 + 0.12 * (1 - t) + Math.sin(t * 40) * 0.02; o.sy = 1 - 0.1 * (1 - t); });
    await sleep(640);
    for (const zid of ziele(x)) { const Z = mitte(zid); burst(Z[0], Z[1], cols[0], 16, 220, 0); BS.shown[zid] && (BS.shown[zid].shake = 420); }
    await sleep(240);
  };

  // ---------- Seelenflammen kreisen und stürzen auf das Ziel ----------
  reg.seelen = async function (x) {
    const { an, cfg, o, A } = x, cols = farben(x), BS = h.BS(), n = cfg.viele ? 6 : 4;
    UI.snd('el_Schatten');
    await ani(220, t => { o.y = -10 * ease(t); });
    const zl = ziele(x), flammen = Array.from({ length: n }, (_, i) => ({ a: i / n * 6.283, z: mitte(zl[i % zl.length]), st: 600 + i * 110 }));
    const fertig = [];
    for (const f of flammen) {
      let lx = A[0], ly = A[1];
      fertig.push(ani(f.st + 380, t0 => {
        const tt = t0 * (f.st + 380); let px, py;
        if (tt < f.st) { const a = f.a + tt / 160, r = 50 + 20 * Math.sin(tt / 90); px = A[0] + Math.cos(a) * r; py = A[1] - 30 + Math.sin(a) * r * 0.6; f.px = px; f.py = py; }
        else { const t = (tt - f.st) / 380, e = t * t; px = f.px + (f.z[0] - f.px) * e; py = f.py + (f.z[1] - f.py) * e; }
        const ang = Math.atan2(py - ly, px - lx); lx = px; ly = py;
        BS.proj = BS.proj || [];
        BS.proj.push({ fn: c => { c.save(); c.translate(px, py); c.rotate(ang); c.shadowColor = cols[0]; c.shadowBlur = 14;
          c.fillStyle = cols[0]; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(-34, 0); c.quadraticCurveTo(-14, -12, 6, -9); c.lineTo(6, 9); c.quadraticCurveTo(-14, 12, -34, 0); c.fill();
          c.globalAlpha = 1; c.fillStyle = cols[1] || '#fff'; c.beginPath(); c.ellipse(0, 0, 11, 9, 0, 0, 6.3); c.fill(); c.shadowBlur = 0;
          c.fillStyle = '#1a0f24'; c.fillRect(1, -4, 3, 4); c.fillRect(6, -4, 3, 4); c.restore(); } });
        if (R() < 0.5) BS.parts.push({ x: px, y: py, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, life: 0, max: 0.4, col: cols[0], size: 3 + R() * 3, grav: -40 });
      }));
    }
    ani(400, t => { o.y = -10 * (1 - ease(t)); });
    await Promise.all(fertig);
    for (const zid of zl) { const Z = mitte(zid); burst(Z[0], Z[1], cols[0], 20, 240, 0); burst(Z[0], Z[1], cols[1] || '#fff', 10, 160, 0); }
    BS.shake = Math.max(BS.shake, 10); await sleep(260);
  };

  // ---------- Wolke: Spore, Tinte oder Giftdunst breitet sich aus ----------
  reg.wolke = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), BS = h.BS(), gross = cfg.gross;
    UI.snd('status');
    await ani(240, t => { o.sy = 1 + 0.08 * t; o.sx = 1 - 0.05 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 10, dauer = gross ? 1200 : 900;
    const puffs = Array.from({ length: gross ? 34 : 22 }, () => ({ a: R() * 6.283, r: R(), s: 14 + R() * (gross ? 30 : 20), k: Math.floor(R() * cols.length), st: R() * 0.35 }));
    const zl = ziele(x);
    addFx(dauer, (c, p) => {
      c.save();
      for (const f of puffs) {
        const q = Math.max(0, Math.min(1, (p - f.st) / 0.65)); if (q <= 0) continue;
        const Z = mitte(zl[0]), px = sx + (Z[0] - sx) * ease(q) + Math.cos(f.a + p * 3) * f.r * (30 + q * 70), py = sy + (Z[1] - sy) * ease(q) + Math.sin(f.a + p * 3) * f.r * (22 + q * 50) - q * 20;
        c.globalAlpha = Math.sin(Math.min(1, q + 0.1) * Math.PI) * 0.45 * (p > 0.85 ? (1 - p) / 0.15 : 1); c.fillStyle = cols[f.k]; c.beginPath(); c.arc(px, py, f.s * (0.6 + q * 0.7), 0, 6.3); c.fill();
      }
      c.restore();
    });
    ani(400, t => { o.sy = 1; o.sx = 1; });
    await sleep(dauer * 0.65);
    for (const zid of zl) { const Z = mitte(zid); for (let i = 0; i < 14; i++) BS.parts.push({ x: Z[0] + (R() - 0.5) * 100, y: Z[1] + (R() - 0.3) * 80, vx: (R() - 0.5) * 30, vy: -20 - R() * 40, life: 0, max: 0.9, col: cols[i % cols.length], size: 3 + R() * 4, grav: -10 }); }
    await sleep(dauer * 0.35);
  };
})(window);
