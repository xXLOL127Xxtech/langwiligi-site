'use strict';
// Catch a Mob – weitere Angriffs-Animationen für die neuen Fabelwesen (Nummer 28 bis 47).
// Arten: segen (Heilung), stich, blitz, tornado, netz, schall, sand, regenbogen, zunge, wurf (Nadeln, Pollen, Tropfen, Schleim).
// Sie hängen sich wie in kampfanim.js an K.anim und lesen ihre Farben und Formen aus anim in daten.js.
(function (G) {
  const CAM = G.CAM, K = CAM.Kampf, UI = CAM.UI;
  const h = K.h, sleep = h.sleep, ani = h.ani, ease = h.ease, easeIO = h.easeIO, burst = h.burst, addFx = h.addFx, mitte = h.mitte;
  const R = Math.random;
  const reg = K.anim;

  const ziele = x => x.ziele.length ? x.ziele : [x.an.a];
  const grund = id => { const l = h.BS().lay[id]; return l ? l.y + l.sz * 0.98 : mitte(id)[1] + 40; };
  const farben = x => x.cfg.cols && x.cfg.cols.length ? x.cfg.cols : [x.col, '#ffffff'];
  const stoss = (id, n) => { const BS = h.BS(); if (BS) BS.shake = Math.max(BS.shake, n); };
  const blitzen = (s) => { const BS = h.BS(); const f = BS && BS.shown && BS.shown[s]; if (f) f.flash = Math.max(f.flash || 0, 80); };

  // ---------- Segen: Heilung mit aufsteigenden Funken und Lichtkreisen am Boden ----------
  reg.segen = async function (x) {
    const { an, o, A } = x, cols = farben(x), gy = grund(an.a);
    UI.snd('status');
    ani(300, t => { o.y = -8 * ease(t); o.sy = 1 + 0.05 * t; });
    addFx(1400, (c, p) => {
      const a = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15, aufb = Math.min(1, p / 0.3);
      c.save(); c.shadowColor = cols[0]; c.shadowBlur = 14;
      const g = c.createRadialGradient(A[0], A[1], 4, A[0], A[1], 90); g.addColorStop(0, cols[1] + 'aa'); g.addColorStop(1, cols[0] + '00');
      c.globalAlpha = 0.55 * Math.sin(Math.min(1, p * 1.1) * Math.PI) * a; c.fillStyle = g; c.beginPath(); c.arc(A[0], A[1], 90, 0, 6.3); c.fill();
      c.globalAlpha = 0.9 * a; c.strokeStyle = cols[0]; c.lineWidth = 3;
      for (let k = 0; k < 2; k++) { c.beginPath(); c.ellipse(A[0], gy, (34 + k * 22) * aufb, (11 + k * 7) * aufb, 0, 0, 6.3); c.stroke(); }
      for (let i = 0; i < 16; i++) {          // Funken steigen auf
        const q = (p * 1.1 + i / 16) % 1, fx = A[0] + Math.sin(i * 2.3 + p * 4) * (40 + (i % 3) * 14), fy = gy - q * 150;
        c.globalAlpha = Math.sin(q * Math.PI) * a; c.fillStyle = i % 2 ? cols[0] : cols[1];
        const s = 3 + (i % 3) * 1.5;
        c.fillRect(fx - s / 2, fy - s * 1.6, s, s * 3.2); c.fillRect(fx - s * 1.6, fy - s / 2, s * 3.2, s);   // kleines Kreuz
      }
      c.restore();
    });
    await sleep(1050);
    ani(300, t => { o.y = -8 * (1 - ease(t)); o.sy = 1; });
    burst(A[0], A[1], cols[0], 12, 90, -60);
    await sleep(260);
  };

  // ---------- Stich: blitzschneller Stachel ----------
  reg.stich = async function (x) {
    const { an, cfg, o, A, T, ux, uy } = x, cols = farben(x), G = cfg.gross ? 1.4 : 1, ang = Math.atan2(uy, ux);
    UI.snd('schwung');
    await ani(260, t => { o.x = -ux * 24 * ease(t); o.y = -uy * 12 * ease(t); o.sx = 1 + 0.08 * t; o.sy = 1 - 0.08 * t; });
    const ziel = Math.max(0, Math.hypot(T[0] - A[0], T[1] - A[1]) * 0.55);
    await ani(120, t => { const e = easeIO(t); o.x = -ux * 24 * (1 - e) + ux * ziel * e; o.y = -uy * 12 * (1 - e) + uy * ziel * e; o.sx = 1.1 - 0.1 * t; o.sy = 0.9 + 0.1 * t; });
    stoss(an.a, 9);
    addFx(560, (c, p) => {
      const L = 120 * G * (p < 0.2 ? ease(p / 0.2) : p < 0.62 ? 1 : 1 - ease((p - 0.62) / 0.38)), a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      c.save(); c.translate(T[0], T[1]); c.rotate(ang); c.globalAlpha = a; c.lineJoin = 'round';
      const base = -100 * G;
      c.fillStyle = '#1a0f24'; c.beginPath(); c.moveTo(base + L + 4, 0); c.lineTo(base - 2, -12 * G); c.lineTo(base - 2, 12 * G); c.closePath(); c.fill();
      c.fillStyle = cols[0]; c.beginPath(); c.moveTo(base + L, 0); c.lineTo(base, -9 * G); c.lineTo(base, 9 * G); c.closePath(); c.fill();
      c.fillStyle = cols[1]; c.beginPath(); c.moveTo(base + L * 0.92, 0); c.lineTo(base + L * 0.2, -3 * G); c.lineTo(base + L * 0.2, 0); c.closePath(); c.fill();
      if (p > 0.2) {                          // Einstich: Strahlen und Tropfen
        c.restore(); c.save(); c.translate(T[0], T[1]); c.globalAlpha = a; c.strokeStyle = '#fff'; c.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const w = i * 0.785 + 0.3, r1 = 14 + p * 10, r2 = 26 + p * 36; c.beginPath(); c.moveTo(Math.cos(w) * r1, Math.sin(w) * r1); c.lineTo(Math.cos(w) * r2, Math.sin(w) * r2); c.stroke(); }
        c.fillStyle = cols[1]; for (let i = 0; i < 5; i++) { const q = Math.max(0, p - 0.25), dx = (i - 2) * 12, dy = 8 + q * 90 * (0.6 + (i % 3) * 0.3); c.beginPath(); c.arc(dx, dy, 4 - (i % 2), 0, 6.3); c.fill(); }
      }
      c.restore();
    });
    burst(T[0], T[1], cols[0], 16, 220); burst(T[0], T[1], cols[1], 10, 170);
    ani(380, t => { const e = easeIO(t); o.x = ux * ziel * (1 - e); o.y = uy * ziel * (1 - e); o.sx = 1; o.sy = 1; });
    await sleep(360);
  };

  // ---------- Blitz: Einschläge aus dem Himmel ----------
  reg.blitz = async function (x) {
    const { an, cfg, o, A } = x, cols = farben(x), BS = h.BS(), n = cfg.n || 1;
    UI.snd('schwung');
    ani(520, t => { o.y = -10 * Math.sin(Math.PI * t); o.sy = 1 + 0.06 * Math.sin(Math.PI * t); });
    addFx(560, (c, p) => {                    // Aufladen: Funken am Angreifer
      c.save(); c.shadowColor = cols[0]; c.shadowBlur = 12; c.strokeStyle = cols[0]; c.lineWidth = 2; c.globalAlpha = 1 - p * 0.4;
      for (let i = 0; i < 5; i++) { const w = R() * 6.3, r = 20 + R() * 36 * p; c.beginPath(); c.moveTo(A[0] + Math.cos(w) * r * 0.5, A[1] + Math.sin(w) * r * 0.5); c.lineTo(A[0] + Math.cos(w) * r, A[1] + Math.sin(w) * r); c.stroke(); }
      c.restore();
    });
    await sleep(520);
    const zl = ziele(x);
    for (let k = 0; k < n; k++) {
      const zid = zl[k % zl.length], Z = mitte(zid), tx = Z[0] + (n > 1 ? (R() - 0.5) * 110 : 0), ty = Z[1] + (n > 1 ? (R() - 0.5) * 50 : 0);
      const pts = [[tx + (R() - 0.5) * 40, -10]], zweige = [];
      const seg = 9; for (let i = 1; i <= seg; i++) { const q = i / seg; pts.push([tx + (R() - 0.5) * 46 * (1 - q * 0.6), -10 + (ty + 10) * q]); }
      for (let i = 2; i < seg - 1; i += 3) { const [bx, by] = pts[i], d = R() < 0.5 ? -1 : 1; zweige.push([[bx, by], [bx + d * (20 + R() * 20), by + 22], [bx + d * (36 + R() * 24), by + 52]]); }
      addFx(300, (c, p) => {
        const a = p < 0.15 ? 1 : (1 - p) * 1.15;
        c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
        c.fillStyle = '#ffffff'; c.globalAlpha = Math.max(0, 0.5 * (1 - p * 3)); c.fillRect(0, 0, BS.w, BS.h);
        c.globalAlpha = Math.max(0, a); c.shadowColor = cols[0]; c.shadowBlur = 30;
        const bahn = l => { c.beginPath(); l.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke(); };
        c.strokeStyle = cols[0]; c.lineWidth = 12; bahn(pts); zweige.forEach(bahn);
        c.strokeStyle = cols[1] || '#fff'; c.lineWidth = 4; bahn(pts); zweige.forEach(bahn);
        c.restore();
      });
      UI.snd('beben'); stoss(an.a, 12); blitzen(zid);
      burst(tx, ty, cols[0], 18, 260, 0); burst(tx, ty, '#ffffff', 8, 200, 0);
      await sleep(n > 1 ? 150 : 260);
    }
    await sleep(240);
  };

  // ---------- Tornado: ein Wirbelsturm zieht zum Ziel ----------
  reg.tornado = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), BS = h.BS(), G = cfg.gross ? 1.45 : 1;
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 12 * ease(t); o.sy = 1 + 0.06 * t; });
    const sx = A[0] + ux * 40, sy = grund(an.a), gz = grund(ziele(x)[0]);
    const dauer = 1250;
    addFx(dauer, (c, p) => {
      const q = Math.min(1, p / 0.45), px = sx + (T[0] - sx) * ease(q) + (p > 0.45 ? Math.sin(p * 30) * 8 : 0), py = sy + (gz - sy) * ease(q);
      const a = p < 0.12 ? p / 0.12 : p > 0.82 ? Math.max(0, 1 - (p - 0.82) / 0.18) : 1, hoch = 150 * G * (0.5 + 0.5 * Math.min(1, p * 3));
      c.save(); c.translate(px, py);
      for (let i = 0; i < 12; i++) {           // Schichten des Trichters
        const t = i / 11, y = -t * hoch, w = (14 + 52 * t) * G, dreh = p * 18 + i * 0.7;
        c.globalAlpha = a * (0.35 + 0.35 * (1 - t)); c.fillStyle = cols[i % cols.length];
        c.beginPath(); c.ellipse(Math.sin(dreh) * 8 * t, y, w, 8 + 5 * t, 0, 0, 6.3); c.fill();
        c.globalAlpha = a * 0.5; c.strokeStyle = cols[(i + 1) % cols.length]; c.lineWidth = 2; c.beginPath(); c.ellipse(Math.sin(dreh) * 8 * t, y, w * 0.8, (8 + 5 * t) * 0.7, 0, dreh, dreh + 3.5); c.stroke();
      }
      c.globalAlpha = a; c.fillStyle = cols[0];                   // Trümmer kreisen
      for (let i = 0; i < 12; i++) { const t = (i * 0.37 + p * 2.2) % 1, w = i * 1.9 + p * 14, rr = (20 + 60 * t) * G; c.fillRect(Math.cos(w) * rr, -t * hoch + Math.sin(w) * 8, 4 + (i % 3), 3); }
      c.restore();
    });
    ani(400, t => { o.x = -ux * 12 * (1 - ease(t)); o.sy = 1; });
    await sleep(dauer * 0.55); stoss(an.a, 6);
    for (let i = 0; i < 3; i++) { await sleep(130); burst(T[0], T[1], cols[i % cols.length], 8, 220, -40); }
    await sleep(dauer * 0.25);
  };

  // ---------- Netz: wird geworfen, breitet sich aus und zieht sich zu ----------
  reg.netz = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), G = cfg.gross ? 1.35 : 1;
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 10 * ease(t); o.sy = 1 + 0.05 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 12;
    addFx(1250, (c, p) => {
      const flug = Math.min(1, p / 0.32), zu = p < 0.5 ? 0 : Math.min(1, (p - 0.5) / 0.25), a = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      const px = sx + (T[0] - sx) * ease(flug), py = sy + (T[1] - sy) * ease(flug) - Math.sin(flug * Math.PI) * 50;
      const r = (10 + 66 * ease(flug)) * G * (1 - zu * 0.45), spin = flug * 2.5;
      c.save(); c.translate(px, py); c.rotate(spin); c.globalAlpha = a; c.shadowColor = cols[1] || cols[0]; c.shadowBlur = 10; c.lineCap = 'round';
      const sp = 10;
      c.strokeStyle = cols[0]; c.lineWidth = 1.5 + zu * 1.5;
      for (let i = 0; i < sp; i++) { const w = i / sp * 6.283; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(w) * r, Math.sin(w) * r); c.stroke(); }
      for (let k = 1; k <= 4; k++) {
        const rr = r * k / 4; c.beginPath();
        for (let i = 0; i <= sp; i++) { const w = i / sp * 6.283, mid = (i + 0.5) / sp * 6.283; if (i === 0) c.moveTo(Math.cos(w) * rr, Math.sin(w) * rr); else c.quadraticCurveTo(Math.cos(((i - 0.5) / sp) * 6.283) * rr * 0.86, Math.sin(((i - 0.5) / sp) * 6.283) * rr * 0.86, Math.cos(w) * rr, Math.sin(w) * rr); }
        c.stroke();
      }
      if (cols[1]) { c.strokeStyle = cols[1]; c.lineWidth = 1; c.globalAlpha = a * 0.7; for (let i = 0; i < sp; i += 2) { const w = i / sp * 6.283; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(w) * r, Math.sin(w) * r); c.stroke(); } }
      c.restore();
    });
    ani(300, t => { o.x = -ux * 10 * (1 - ease(t)); o.sy = 1; });
    await sleep(430);
    stoss(an.a, 5); burst(T[0], T[1], cols[0], 14, 160, 40);
    await sleep(520);
    burst(T[0], T[1], cols[1] || '#fff', 10, 200, 0);
    await sleep(240);
  };

  // ---------- Schall: Schallringe wandern zum Ziel ----------
  reg.schall = async function (x) {
    const { an, o, A, T, ux } = x, cols = farben(x), ang = Math.atan2(T[1] - A[1], T[0] - A[0]);
    UI.snd('ruf');
    await ani(220, t => { o.sy = 1 + 0.1 * t; o.sx = 1 - 0.06 * t; });
    const sx = A[0] + ux * 34, sy = A[1] - 12, dist = Math.hypot(T[0] - sx, T[1] - sy);
    addFx(950, (c, p) => {
      c.save(); c.translate(sx, sy); c.rotate(ang); c.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const q = Math.max(0, Math.min(1, (p - k * 0.1) / 0.55)); if (q <= 0) continue;
        const r = q * (dist + 20), w = 0.35 + q * 0.5, al = Math.sin(q * Math.PI);
        c.globalAlpha = al * 0.9; c.strokeStyle = cols[k % cols.length]; c.lineWidth = 7 - k; c.shadowColor = cols[0]; c.shadowBlur = 12;
        c.beginPath(); c.arc(0, 0, Math.max(1, r), -w, w); c.stroke();
      }
      c.restore();
    });
    ani(300, t => { o.sy = 1; o.sx = 1; });
    await sleep(620);
    stoss(an.a, 8); blitzen(x.ziele[0]);
    addFx(500, (c, p) => { c.save(); c.translate(T[0], T[1]); c.globalAlpha = 1 - p; c.strokeStyle = cols[0]; c.lineWidth = 5 * (1 - p); c.beginPath(); c.arc(0, 0, 14 + p * 70, 0, 6.3); c.stroke(); c.strokeStyle = cols[1] || '#fff'; c.beginPath(); c.arc(0, 0, 6 + p * 44, 0, 6.3); c.stroke(); c.restore(); });
    burst(T[0], T[1], cols[0], 12, 190, 0);
    await sleep(440);
  };

  // ---------- Sand: Sandsturm fegt über das Feld ----------
  reg.sand = async function (x) {
    const { an, cfg, o, A, T, ux } = x, cols = farben(x), gz = grund(ziele(x)[0]);
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 12 * ease(t); o.sy = 1 - 0.07 * t; });
    const sx = A[0] + ux * 30, sy = A[1] + 10, n = 80, korn = Array.from({ length: n }, () => ({ s: R() * 0.35, r: R(), y: (R() - 0.5) * 2, k: Math.floor(R() * cols.length), g: 2 + R() * 3 }));
    const dauer = 1250;
    addFx(dauer, (c, p) => {
      const a = p < 0.12 ? p / 0.12 : p > 0.8 ? Math.max(0, 1 - (p - 0.8) / 0.2) : 1;
      c.save();
      for (const f of korn) {
        const q = Math.max(0, Math.min(1, (p - f.s) / 0.5)); if (q <= 0) continue;
        const dx = T[0] - sx, bx = sx + dx * ease(q), by = sy + (gz - 40 - sy) * ease(q) + f.y * (14 + 60 * q);
        const wirbel = p > 0.55 ? Math.sin(p * 22 + f.r * 6) * 40 * f.r + Math.cos(p * 18 + f.y * 3) * 10 : 0;
        c.globalAlpha = a * (0.55 + 0.4 * f.r); c.fillStyle = cols[f.k]; c.fillRect(bx + wirbel * (ux < 0 ? -1 : 1), by - Math.abs(wirbel) * 0.25, f.g, f.g * 0.7);
      }
      if (p > 0.3) {                           // Staubwolke am Ziel
        for (let i = 0; i < 6; i++) { c.globalAlpha = a * 0.22; c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(T[0] + Math.sin(p * 5 + i * 2) * 50, gz - 30 - (i % 3) * 20, 34 + i * 4, 0, 6.3); c.fill(); }
      }
      c.restore();
    });
    ani(400, t => { o.x = -ux * 12 * (1 - ease(t)); o.sy = 1; });
    await sleep(dauer * 0.5); stoss(an.a, 6);
    burst(T[0], T[1], cols[0], 16, 230, 0);
    await sleep(dauer * 0.4);
  };

  // ---------- Regenbogen: ein Farbenbogen schlägt im Ziel ein ----------
  reg.regenbogen = async function (x) {
    const { an, o, A, T, ux } = x;
    const bunt = ['#ff4a4a', '#ff9f43', '#ffe14d', '#5fd38a', '#4f8ff7', '#8a3ffc', '#ff7ad9'];
    UI.snd('schwung');
    await ani(240, t => { o.y = -8 * ease(t); o.sy = 1 + 0.06 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 14, cx = (sx + T[0]) / 2, cy = Math.min(sy, T[1]) - 130;
    const punkt = (q, off) => {
      const x0 = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * cx + q * q * T[0], y0 = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * cy + q * q * T[1];
      const tx = 2 * (1 - q) * (cx - sx) + 2 * q * (T[0] - cx), ty = 2 * (1 - q) * (cy - sy) + 2 * q * (T[1] - cy), l = Math.hypot(tx, ty) || 1;
      return [x0 - ty / l * off, y0 + tx / l * off];
    };
    addFx(1250, (c, p) => {
      const l = Math.min(1, p / 0.4), a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      c.save(); c.lineCap = 'round'; c.globalAlpha = a; c.shadowColor = '#ffffff'; c.shadowBlur = 16;
      bunt.forEach((cl, k) => {
        c.strokeStyle = cl; c.lineWidth = 7; c.beginPath();
        for (let i = 0; i <= 28; i++) { const q = i / 28 * l, [px, py] = punkt(q, (k - 3) * 6 * (1 - 0.5 * q)); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        c.stroke();
      });
      if (l >= 1) { c.globalAlpha = a; c.fillStyle = '#fff'; for (let i = 0; i < 10; i++) { const w = i * 0.628 + p * 5, r = 14 + (p - 0.4) * 80 * (0.6 + (i % 3) * 0.3); c.beginPath(); c.arc(T[0] + Math.cos(w) * r, T[1] + Math.sin(w) * r, 3, 0, 6.3); c.fill(); } }
      c.restore();
    });
    ani(500, t => { o.y = -8 * (1 - ease(t)); o.sy = 1; });
    await sleep(520); stoss(an.a, 9);
    bunt.forEach((cl, i) => setTimeout(() => burst(T[0], T[1], cl, 6, 200, 0), i * 30));
    await sleep(620);
  };

  // ---------- Zunge: schnellt vor und holt das Ziel ----------
  reg.zunge = async function (x) {
    const { an, o, A, T, ux, uy } = x, cols = farben(x);
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 14 * ease(t); o.sx = 1 - 0.06 * t; o.sy = 1 + 0.05 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 6;
    addFx(700, (c, p) => {
      const l = p < 0.3 ? ease(p / 0.3) : 1 - ease((p - 0.3) / 0.7) * 0.97, ex = sx + (T[0] - sx) * l, ey = sy + (T[1] - sy) * l;
      c.save(); c.lineCap = 'round';
      c.strokeStyle = '#4a0a1a'; c.lineWidth = 14; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = cols[0]; c.lineWidth = 9; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = cols[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy - 2); c.lineTo(ex, ey - 2); c.stroke();
      c.fillStyle = cols[0]; c.strokeStyle = '#4a0a1a'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey, 11, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = cols[1]; c.beginPath(); c.arc(ex - 3, ey - 3, 4, 0, 6.3); c.fill();
      if (p > 0.26 && p < 0.42) { c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 8; i++) { const w = i * 0.785, r = 14 + (p - 0.26) * 140; c.beginPath(); c.moveTo(ex + Math.cos(w) * 12, ey + Math.sin(w) * 12); c.lineTo(ex + Math.cos(w) * r, ey + Math.sin(w) * r); c.stroke(); } }
      c.restore();
    });
    await sleep(230); stoss(an.a, 8); burst(T[0], T[1], cols[0], 14, 200, 0);
    ani(400, t => { o.x = -ux * 14 * (1 - ease(t)); o.sx = 1; o.sy = 1; });
    await sleep(460);
  };

  // ---------- Wurf: ein Schwarm kleiner Geschosse (Nadeln, Pollen, Tropfen, Schleim) ----------
  function form(c, shape, s, cols, t) {
    const a = cols[0], b = cols[1] || cols[0];
    switch (shape) {
      case 'nadel': c.strokeStyle = a; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 1.5, 0); c.lineTo(s * 1.2, 0); c.stroke(); c.fillStyle = b; c.beginPath(); c.moveTo(s * 1.8, 0); c.lineTo(s * 0.9, -s * 0.28); c.lineTo(s * 0.9, s * 0.28); c.closePath(); c.fill(); break;
      case 'pollen': { const g = c.createRadialGradient(0, 0, 0, 0, 0, s); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, b); g.addColorStop(1, a + '00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, s, 0, 6.3); c.fill(); c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.38, 0, 6.3); c.fill(); break; }
      case 'tropfen': c.fillStyle = a; c.strokeStyle = b; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s * 1.4, 0); c.quadraticCurveTo(0, -s * 0.9, -s * 0.8, 0); c.quadraticCurveTo(0, s * 0.9, s * 1.4, 0); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-s * 0.1, -s * 0.2, s * 0.22, 0, 6.3); c.fill(); break;
      case 'schleim': c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.85, 0, 6.3); c.arc(-s * 0.9, s * 0.2, s * 0.5, 0, 6.3); c.fill(); c.fillStyle = b; c.beginPath(); c.arc(-s * 0.2, -s * 0.3, s * 0.3, 0, 6.3); c.fill(); break;
      case 'sichel': c.strokeStyle = a; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(-s * 0.6, 0, s * 1.2, -1, 1); c.stroke(); c.strokeStyle = b; c.lineWidth = 2; c.stroke(); break;
      default: c.fillStyle = a; c.beginPath(); c.arc(0, 0, s * 0.7, 0, 6.3); c.fill();
    }
  }
  reg.wurf = async function (x) {
    const { an, cfg, o, A, ux } = x, cols = farben(x), n = cfg.n || 6, sh = cfg.shape, BS = h.BS(), oben = cfg.von === 'oben';
    UI.snd('schwung');
    await ani(oben ? 300 : 220, t => { if (oben) o.y = -12 * ease(t); o.x = -ux * 10 * ease(t); o.sy = 1 + 0.05 * t; });
    const sx = A[0] + ux * 30, sy = A[1] - 12, fertig = [], zl = ziele(x);
    for (let i = 0; i < n; i++) {
      const Z = mitte(zl[i % zl.length]), st = i * (oben ? 60 : 70), flug = oben ? 420 + R() * 100 : 380 + R() * 120;
      const jx = (R() - 0.5) * (oben ? 120 : 60), jy = (R() - 0.5) * 50, bog = oben ? 0 : 20 + R() * 50;
      const px0 = oben ? Z[0] + jx : sx, py0 = oben ? -30 : sy;
      let lx = px0, ly = py0, hit = false;
      fertig.push(ani(flug + st, t0 => {
        if (t0 * (flug + st) < st) return;
        const t = Math.min(1, (t0 * (flug + st) - st) / flug);
        const ex = oben ? Z[0] + jx : Z[0] + jx, ey = Z[1] + jy;
        const px = px0 + (ex - px0) * t, py = py0 + (ey - py0) * (oben ? t * t : t) - Math.sin(t * Math.PI) * bog;
        const w = oben ? 1.57 : Math.atan2(py - ly, px - lx); lx = px; ly = py;
        BS.proj = BS.proj || [];
        BS.proj.push({ fn: c => { c.translate(px, py); c.rotate(w); form(c, sh, 9, cols, t); } });
        if (t >= 1 && !hit) { hit = true; burst(px, py, cols[i % cols.length], 5, 130); }
      }));
    }
    ani(300, t => { o.x = -ux * 10 * (1 - ease(t)); o.y = oben ? -12 * (1 - ease(t)) : 0; o.sy = 1; });
    await Promise.all(fertig);
    stoss(an.a, 5); await sleep(200);
  };
})(window);
