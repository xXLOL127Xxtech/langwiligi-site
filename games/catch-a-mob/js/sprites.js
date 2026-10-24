'use strict';
// Catch a Mob – Mobs werden im Code als Pixelbilder gezeichnet (kein Bilder-Download nötig).
(function (G) {
  const CAM = G.CAM;
  const N = 80;               // Raster 80 x 80 (doppelt so fein wie früher), die Zeichnung selbst rechnet weiter in 40er-Schritten
  const R = N / 40;
  const cache = {};

  function draw(fam, stufe, glanz, ph) {
    ph = ph == null ? -1 : ph;   // -1 = Standbild, 0..3 = Laufschritt
    const f = CAM.FAMILIEN[fam];
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const c = cv.getContext('2d');
    const pal = f.pal.map(col => glanz ? shiny(col) : col);
    const P = { b: pal[0], d: pal[1], a: pal[2], e: pal[3] };
    // Stufe 1..3 wird grösser, Riesen sind gross
    const s = f.legend ? 1.15 : [0.66, 0.85, 1.05][stufe - 1];
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x * R), Math.round(y * R), R, R); };
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x * R), Math.round(y * R), Math.max(R, Math.round(w * R)), Math.max(R, Math.round(h * R))); };
    const ell = (cx, cy, rx, ry, col) => {
      c.fillStyle = col;
      const x0 = Math.max(0, Math.floor((cx - rx) * R)), x1 = Math.min(N - 1, Math.ceil((cx + rx) * R));
      for (let Y = Math.max(0, Math.floor((cy - ry) * R)); Y <= Math.min(N - 1, Math.ceil((cy + ry) * R)); Y++) {
        const dy = (Y / R - cy) / ry; if (dy * dy > 1) continue;
        const w = Math.sqrt(1 - dy * dy) * rx * R, xa = Math.max(x0, Math.ceil(cx * R - w)), xb = Math.min(x1, Math.floor(cx * R + w));
        if (xb >= xa) c.fillRect(xa, Y, xb - xa + 1, 1);
      }
    };
    const tri = (x1, y1, x2, y2, x3, y3, col) => {   // gefülltes Dreieck
      c.fillStyle = col;
      x1 *= R; y1 *= R; x2 *= R; y2 *= R; x3 *= R; y3 *= R;
      const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3))), maxY = Math.min(N - 1, Math.ceil(Math.max(y1, y2, y3)));
      const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3))), maxX = Math.min(N - 1, Math.ceil(Math.max(x1, x2, x3)));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2), d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3), d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) c.fillRect(x, y, 1, 1);
      }
    };
    const augen = [];
    const eye = (x, y, r) => { px(x, y, P.e); if (r) px(x + 1, y, P.e); augen.push([Math.round(x * R), Math.round(y * R), r ? 2 : 1]); };
    const o = f.opt || {};
    const base = 38;           // Standlinie
    // Laufschritt: Bein i (0 und 3 gehen im Takt, 1 und 2 gegengleich) -> [Versatz nach vorn, Hubhöhe]
    const gait = (i, amp) => {
      if (ph < 0) return [0, 0];
      const a = (ph / 4 + (i === 1 || i === 2 ? 0.5 : 0)) * 6.2832;
      return [Math.sin(a) * amp * s, Math.max(0, Math.cos(a)) * amp * 0.75 * s];
    };
    const wave = (k, sp) => ph < 0 ? 0 : Math.sin(ph * 1.5708 * (sp || 1) + k);

    switch (f.kind) {
      case 'quad': {     // Vierbeiner (Wolf, Bär, Hase, Reh, Einhorn, Steinbock)
        const slim = !!o.slim, bx = 18, by = base - (slim ? 17 : 11) * s - 2;
        ell(bx, by, 11 * s, (slim ? 5.2 : 6.5) * s, P.b);
        ell(bx - 2, by + 2, 8 * s, (slim ? 2.6 : 3.5) * s, P.d);
        const hx = bx + 11 * s, hy = by - (slim ? 7 : 4) * s, hk = slim ? 0.85 : 1;
        if (slim) { ell(bx + 9 * s, by - 3.5 * s, 3.4 * s, 5.5 * s, P.b); }
        if (o.mane) ell(hx - 4 * s, hy + 2 * s + wave(0.5) * 0.6, 4 * s, 5 * s + (slim ? 3 * s : 0), P.a);
        ell(hx, hy, 5.5 * s * hk, 5 * s * hk, P.b);
        ell(hx + 4 * s * hk, hy + 1.5 * s, 3 * s * hk, 2.2 * s * hk, P.d);   // Schnauze
        if (o.ears === 'long') { ell(hx - 1, hy - 8 * s, 1.6 * s, 6 * s, P.b); ell(hx + 2, hy - 8 * s, 1.6 * s, 6 * s, P.a); }
        else if (o.ears === 'round') { ell(hx - 2, hy - 5 * s, 2 * s, 2 * s, P.b); ell(hx + 3, hy - 5 * s, 2 * s, 2 * s, P.b); }
        else { tri(hx - 4 * s, hy - 3 * s, hx - 2 * s, hy - 9 * s, hx, hy - 4 * s, P.b); tri(hx + 1, hy - 4 * s, hx + 3 * s, hy - 9 * s, hx + 5 * s, hy - 3 * s, P.b); }
        [bx - 8 * s, bx - 3 * s, bx + 4 * s, bx + 9 * s].forEach((lx0, i) => {
          const [gx, gl] = gait(i, slim ? 3.2 : 2.4), lx = lx0 + gx, w = slim ? 2 * s + 0.6 : 3 * s + 1;
          rect(lx, by + 4 * s, w, base - gl - (by + 4 * s), P.d);
          if (o.hoof) { rect(lx - 0.3, base - gl - 2, w + 0.6, 2, '#2a2230'); }
          else {
            ell(lx + 1.5 * s + 0.5, base - 1 - gl, 2.6 * s + 0.6, 1.4, P.b);                       // Pfote
            for (let k = 0; k < 3; k++) px(lx + 0.6 * s + k * 0.9 * s, base - gl, '#efe8d8');       // Krallen
          }
        });
        if (o.tail === 'flame') { ell(bx - 12 * s, by - 3 * s, 3 * s, 5 * s, P.a); ell(bx - 12 * s, by - 5 * s, 1.6 * s, 3.5 * s, P.e); }
        else if (o.tail === 'fluff') ell(bx - 12 * s + wave(1, 2) * 0.8, by - 1, 4 * s, 3.5 * s, P.a);
        else if (o.tail === 'short') ell(bx - 11 * s, by - 3 * s, 1.8 * s, 2.4 * s, '#fff2d8');
        else if (o.tail === 'flow') { for (let i = 0; i < 6; i++) ell(bx - 11 * s - i * 1.3 * s, by - 1 + i * 1.2 * s + wave(i * 0.7, 2) * 1.2, (2.6 - i * 0.2) * s, 2 * s, i % 2 ? P.a : P.b); }
        if (o.spots) { const rr = CAM.mulberry32(fam * 7 + 3); for (let i = 0; i < 9; i++) { const sx = bx - 8 * s + rr() * 16 * s, sy = by - 4 * s + rr() * 4 * s; ell(sx, sy, 0.9 * s + 0.2, 0.9 * s + 0.2, '#fff2d8'); } }
        if (o.antler) {
          const h2 = stufe >= 3 ? 11 : stufe >= 2 ? 8 : 3;
          for (const dx of [-1, 2.5]) { let x = hx + dx, y = hy - 4.5 * s; for (let i = 0; i < h2; i++) { px(x, y, P.a); px(x + 0.6, y, P.a); x += 0.35; y -= 1; if (i % 3 === 2 && i < h2 - 1) for (let j = 1; j < 4; j++) px(x + j * 0.9, y - j * 0.6, P.a); } }
        }
        if (o.horn === 'uni') { const n = Math.round(12 * s) + 4; for (let i = 0; i < n; i++) { const hxx = hx + 2.5 * s + i * 0.5, hyy = hy - 4 * s - i * 0.95; px(hxx, hyy, i % 3 === 0 ? P.e : '#ffffff'); px(hxx + 0.6, hyy, i % 3 === 0 ? '#ffffff' : P.e); } }
        if (o.horn === 'ibex') { for (let i = 0; i < 16; i++) { const t = i / 15, hxx = hx - 1 - i * 0.85 * s, hyy = hy - 4 * s - Math.sin(t * 2.6) * 8 * s; rect(hxx, hyy, 2, 2, i % 3 === 0 ? P.d : P.a); } }
        if (stufe >= 2 && !o.antler && !o.horn || f.legend) { for (let i = 0; i < 4; i++) tri(bx - 8 * s + i * 5 * s, by - 6 * s, bx - 6 * s + i * 5 * s, by - 10 * s, bx - 4 * s + i * 5 * s, by - 6 * s, P.a); }
        px(hx + 6.4 * s * hk, hy + 0.4 * s, '#1a1018');
        if (!o.herb) { px(hx + 5 * s, hy + 3.2 * s, '#fff'); px(hx + 6 * s, hy + 3.2 * s, '#fff'); }   // Fangzähne (nicht bei Pflanzenfressern)
        eye(hx + 2, hy - 1, true);
        break;
      }
      case 'blob': {     // Geist / Schlammwesen mit zerfetztem Rand
        const cy = base - 12 * s - 1;
        ell(20, cy, 11 * s, 12 * s, P.b);
        ell(20, cy + 4 * s, 9 * s, 7 * s, P.d);
        for (let i = -3; i <= 3; i++) rect(20 + i * 3.3 * s, cy + 9 * s, 3 * s, (2 + ((i * i) % 3)) * s + 1 + wave(i, 1) * 1.6, P.b);
        ell(20, cy - 2 * s, 8 * s, 8 * s, P.b);
        rect(20 - 10 * s, cy, 3 * s, 6 * s, P.d); rect(20 + 8 * s, cy, 3 * s, 6 * s, P.d);   // Arme
        eye(20 - 4 * s, cy - 3 * s, true); eye(20 + 3 * s, cy - 3 * s, true);
        if (stufe >= 2 || f.legend) { for (let i = 0; i < 3; i++) px(20 - 6 * s + i * 5 * s, cy - 11 * s, P.a); ell(20, cy - 9 * s, 4 * s, 2 * s, P.a); }
        if (stufe >= 3 || f.legend) { tri(20 - 7 * s, cy - 9 * s, 20 - 5 * s, cy - 16 * s, 20 - 3 * s, cy - 9 * s, P.a); tri(20 + 3 * s, cy - 9 * s, 20 + 5 * s, cy - 16 * s, 20 + 7 * s, cy - 9 * s, P.a); }
        if (f.legend) for (let i = 0; i < 4; i++) { rect(4 + i * 9, cy + 6, 2, 12 - i, P.a); }   // Tentakel
        break;
      }
      case 'bird': {
        const by = base - 14 * s - 4;
        ell(20, by, 8 * s, 7 * s, P.b);
        ell(20, by + 2, 6 * s, 4 * s, P.d);
        ell(27 * (0.9 + 0.1 * s), by - 8 * s, 4.5 * s, 4.2 * s, P.b);                   // Kopf
        tri(31 * (0.9 + 0.1 * s), by - 9 * s, 38, by - 7 * s, 31 * (0.9 + 0.1 * s), by - 5 * s, P.a);    // Schnabel
        const fl = ph < 0 ? 0 : [-4, 0, 4, 0][ph];                                         // Flügelschlag
        if (o.phoenix) {   // Feuerschweif und Federkrone
          for (let i = 0; i < 4; i++) tri(10 - i * 2, by + 2 + i * 2 + wave(i) * 1.2, 2 - i * 0.6, by + 8 * s + i * 4 + wave(i + 1) * 1.5, 12 - i * 1.5, by + 7 + i * 2, i % 2 ? P.a : P.e);
          for (let i = 0; i < 3; i++) tri(24 * (0.9 + 0.1 * s) + i * 2.5, by - 12 * s, 26 * (0.9 + 0.1 * s) + i * 2.5 - 4 + wave(i) * 1.2, by - 20 * s - i * 2, 28 * (0.9 + 0.1 * s) + i * 2.5, by - 12 * s, i % 2 ? P.e : P.a);
        }
        ell(12, by - 3 * s + fl * 0.4, 9 * s, 4 * s, P.d);                                 // Flügel
        for (let i = 0; i < 4; i++) tri(3 + i * 3, by - 3 * s + fl, 4 + i * 3, by + 6 * s + fl * 1.5, 7 + i * 3, by - 1 + fl * 0.5, P.d);
        if (stufe >= 2 || f.legend) { ell(10, by - 9 * s, 5 * s, 3 * s, P.b); for (let i = 0; i < 3; i++) tri(3 + i * 3, by - 9 * s, 4 + i * 3, by - 3 * s, 7 + i * 3, by - 7 * s, P.d); }
        [17, 22].forEach((lx0, i) => { const [gx, gl] = gait(i, 2.2), lx = lx0 + gx; rect(lx, by + 6 * s, 2, base - gl - (by + 6 * s), P.a); for (let k = -1; k <= 1; k++) px(lx + 0.5 + k * 1.5, base - gl, P.a); px(lx + 4, base - gl, P.a); });   // Krallenfüsse
        tri(12, by + 2, 4, by + 10 * s, 14, by + 6, P.d);                                   // Schwanz
        eye(28 * (0.9 + 0.1 * s), by - 9 * s, false);
        break;
      }
      case 'skull': {    // Hirschschädel mit Ranken
        const hy = base - 17 * s - 3;
        ell(20, hy, 9 * s, 8 * s, P.b);                        // Schädel
        ell(20, hy + 8 * s, 6 * s, 5 * s, P.b);                // Schnauze
        ell(20 - 4 * s, hy - 1, 2.6 * s, 3 * s, P.d); ell(20 + 4 * s, hy - 1, 2.6 * s, 3 * s, P.d);
        eye(20 - 4 * s, hy - 1, false); eye(20 + 4 * s, hy - 1, false);
        for (const dir of [-1, 1]) {   // Geweih
          let x = 20 + dir * 6 * s, y = hy - 6 * s;
          for (let i = 0; i < 9 * s + 3; i++) { px(x, y, P.a); px(x + dir, y, P.d); x += dir * 0.8; y -= 1; if (i % 3 === 2) { for (let j = 1; j < 4 * s + 1; j++) px(x + dir * j, y - j * 0.7, P.a); } }
        }
        rect(20 - 5 * s, hy + 11 * s, 10 * s, base - (hy + 11 * s), P.d);   // Hals / Ranken
        for (let i = 0; i < 4; i++) { rect(20 - 7 * s + i * 4 * s + wave(i * 1.3) * 1.4, hy + 12 * s, 2, base - (hy + 12 * s), P.a); }
        if (f.opt && f.opt.big) for (let i = 0; i < 6; i++) ell(6 + i * 6, base - 4, 3, 3, P.a);
        break;
      }
      case 'wisp': {     // Flamme / Laterne
        const cy = base - 14 * s - 4;
        tri(20 - 8 * s, cy + 2, 20 + wave(0, 2) * 2, cy - 16 * s - Math.abs(wave(1)) * 3, 20 + 8 * s, cy + 2, P.a);
        ell(20, cy + 4 * s, 9 * s, 10 * s, P.b);
        ell(20, cy + 6 * s, 6 * s, 6 * s, P.a);
        eye(20 - 4 * s, cy + 2 * s, true); eye(20 + 2 * s, cy + 2 * s, true);
        if (stufe >= 2) { rect(20 - 9 * s, cy - 6 * s, 18 * s, 2, P.d); for (let i = 0; i < 4; i++) rect(20 - 9 * s + i * 6 * s, cy - 6 * s, 1, 18 * s, P.d); }
        if (stufe >= 3) { rect(20 - 1, cy - 20 * s, 2, 6 * s, P.d); ell(20, cy - 21 * s, 3, 3, P.d); }
        break;
      }
      case 'dragon': {
        const by = base - 11 * s - 3;
        // Schwanz (nach links, leicht nach oben gebogen)
        for (let i = 0; i < 14; i++) ell(12 - i * 0.95 * s - 1, by + 3 - Math.sin(i / 3) * 2 * s - i * 0.25 + wave(i * 0.5) * i * 0.12, Math.max(0.8, (3.4 - i * 0.2) * s), Math.max(0.8, (3 - i * 0.18) * s), i % 3 === 2 ? P.d : P.b);
        // Beine
        [11, 24].forEach((lx0, i) => { const [gx, gl] = gait(i, 2.4); rect(lx0 * (0.85 + 0.15 * s) + gx, by + 4 * s, 3.2 * s + 1, base - gl - (by + 4 * s), P.d); px(lx0 * (0.85 + 0.15 * s) + gx + 3 * s, base - gl, '#efe8d8'); });
        ell(19, by, 9.5 * s, 5.8 * s, P.b);
        ell(19, by + 3 * s, 7.5 * s, 2.8 * s, P.a);                                          // Bauch
        // Hals und Kopf
        for (let t = 0; t <= 1.01; t += 0.14) ell(25 + t * 6 * s, by - 2 * s - t * 9 * s, (3.6 - 1.2 * t) * s + 0.6, (3.6 - 1.2 * t) * s + 0.6, P.b);
        const hx = 31 + 1.2 * s, hy = by - 11 * s;
        ell(hx, hy, 4.2 * s, 3.4 * s, P.b);
        ell(hx + 4 * s, hy + 1.2 * s, 3.4 * s, 2.1 * s, P.d);                                  // Schnauze
        tri(hx - 2 * s, hy - 2 * s, hx - 5 * s, hy - 9 * s, hx, hy - 3 * s, P.d); tri(hx + 0.5 * s, hy - 3 * s, hx + 1 * s, hy - 10 * s, hx + 3 * s, hy - 2 * s, P.d);   // Hörner
        // Rückenzacken
        for (let i = 0; i < 6; i++) tri(11 + i * 3.1 * s, by - 5 * s, 12.5 + i * 3.1 * s, by - 9 * s - (i % 2) * 2, 14 + i * 3.1 * s, by - 5 * s, P.a);
        // Flügel mit Knochenstreben
        if (stufe >= 2 || f.legend) {
          const wf = ph < 0 ? 0 : [-3, 0, 3, 0][ph];
          tri(12, by - 4 * s, 3, by - 20 * s + wf, 24, by - 6 * s, P.d);
          tri(12, by - 4 * s, 8, by - 12 * s + wf * 0.6, 21, by - 6 * s, P.a);
          for (let i = 0; i < 3; i++) { rect(12 + i * 3, by - 5 * s - i * 5, 1, 6, P.b); }
        }
        eye(hx + 1.5 * s, hy - 1, true);
        break;
      }
      case 'crab': {
        const by = base - 7 * s - 3;
        ell(20, by, 12 * s, 6.5 * s, P.b);
        ell(20, by + 2, 10 * s, 3 * s, P.d);
        for (const dir of [-1, 1]) {
          ell(20 + dir * 14 * s, by - 6 * s + wave(dir) * 1.4, 5 * s, 5 * s, P.a);
          rect(20 + dir * 14 * s - 1, by - 12 * s, 2, 4, P.d);
          for (let i = 0; i < 3; i++) { const [gx, gl] = gait(i + (dir > 0 ? 1 : 0), 1.8); rect(20 + dir * (6 + i * 3) * s + gx * dir, by + 5 * s, 1, base - gl - (by + 5 * s), P.d); }
          rect(20 + dir * 4 * s, by - 9 * s, 1, 4 * s, P.d); px(20 + dir * 4 * s, by - 10 * s, P.e);
        }
        if (stufe >= 2) for (let i = 0; i < 5; i++) tri(20 - 8 * s + i * 4 * s, by - 5 * s, 20 - 6 * s + i * 4 * s, by - 10 * s, 20 - 4 * s + i * 4 * s, by - 5 * s, P.a);
        eye(20 - 3 * s, by - 1, true); eye(20 + 2 * s, by - 1, true);
        break;
      }
      case 'mushroom': {
        const sy = base - 8 * s;
        rect(20 - 4 * s, sy - 4 * s, 8 * s, 12 * s, P.a);
        ell(20, sy - 6 * s, 13 * s, 8 * s, P.b);
        for (let i = 0; i < 5; i++) ell(20 - 8 * s + i * 4 * s, sy - 8 * s + (i % 2) * 3 * s, 1.6 * s + 0.3, 1.6 * s + 0.3, P.a);
        eye(20 - 3 * s, sy - 1, true); eye(20 + 2 * s, sy - 1, true);
        if (ph < 0) rect(20 - 3 * s, sy + 8 * s - 1, 6 * s, 2, P.d);
        else { const g1 = gait(0, 2.4), g2 = gait(1, 2.4); rect(20 - 4 * s + g1[0], sy + 8 * s - 1 - g1[1], 3 * s, 2, P.d); rect(20 + 1 * s + g2[0], sy + 8 * s - 1 - g2[1], 3 * s, 2, P.d); }
        if (stufe >= 2) { rect(20 + 4 * s, sy - 2 * s, 2, 12 * s, P.d); tri(20 + 3 * s, sy - 2 * s, 20 + 5 * s, sy - 10 * s, 20 + 7 * s, sy - 2 * s, P.a); }
        if (stufe >= 3) { rect(20 - 9 * s, sy - 3 * s, 2, 10 * s, P.d); ell(20 - 8 * s, sy - 4 * s, 3 * s, 3 * s, P.b); }
        break;
      }
      case 'serpent': {
        const n = Math.round(14 * s) + 8;
        for (let i = n; i >= 0; i--) {
          const t = i / n, x = 6 + t * 26, y = base - 8 - Math.sin(t * 7 - (ph < 0 ? 0 : ph * 1.57)) * 6 * s - t * 6;
          ell(x, y, (2.5 + 3 * (1 - t) + 1.5 * (i === 0 ? 1 : 0)) * s + 1, (2.5 + 3 * (1 - t)) * s + 1, i % 3 === 0 ? P.d : P.b);
          if (i % 2 === 0) px(x, y - 2 * s, P.a);
        }
        const hx = 6 + 0 * 26, hy = base - 8 - 0 * 6;
        ell(hx + 25 * s, base - 22 * s, 5.5 * s, 4.5 * s, P.b);
        tri(hx + 22 * s, base - 25 * s, hx + 22 * s, base - 32 * s, hx + 26 * s, base - 25 * s, P.a);
        eye(hx + 26 * s, base - 23 * s, true);
        break;
      }
      case 'golem': {
        const w = 18 * s;
        if (ph < 0) rect(20 - w / 2, base - 10 * s, w, 10 * s, P.b);                     // Beine/Sockel
        else { const g0 = gait(0, 2.2), g1 = gait(1, 2.2); rect(20 - w / 2 + g0[0], base - 10 * s, w / 2 - 0.5, 10 * s - g0[1], P.b); rect(20 + 0.5 + g1[0], base - 10 * s, w / 2 - 0.5, 10 * s - g1[1], P.b); }
        rect(20 - w / 2 - 3 * s, base - 22 * s, w + 6 * s, 13 * s, P.b);     // Rumpf
        rect(20 - 6 * s, base - 31 * s, 12 * s, 9 * s, P.b);                 // Kopf
        rect(20 - w / 2 - 7 * s, base - 21 * s, 5 * s, 14 * s, P.d); rect(20 + w / 2 + 2 * s, base - 21 * s, 5 * s, 14 * s, P.d);
        for (let i = 0; i < 4; i++) tri(20 - 8 * s + i * 5 * s, base - 22 * s, 20 - 6 * s + i * 5 * s, base - 31 * s - (i % 2) * 5, 20 - 3 * s + i * 5 * s, base - 22 * s, P.a);
        rect(20 - 4 * s, base - 29 * s, 3 * s, 2 * s, P.e); rect(20 + 2 * s, base - 29 * s, 3 * s, 2 * s, P.e);
        if (stufe >= 2) for (let i = 0; i < 3; i++) tri(20 - 9 * s + i * 8 * s, base - 10 * s, 20 - 7 * s + i * 8 * s, base - 17 * s, 20 - 5 * s + i * 8 * s, base - 10 * s, P.a);
        break;
      }
      case 'ghoul': {   // aufrecht gehende Gestalt
        const hy = base - 27 * s - 1;
        rect(20 - 6 * s, hy + 10 * s, 12 * s, 14 * s, P.b);          // Rumpf
        ell(20, hy + 10 * s, 7 * s, 3 * s, P.d);
        { const g0 = gait(0, 2.6), g1 = gait(1, 2.6);
          rect(20 - 5 * s + g0[0], hy + 22 * s, 4 * s, base - g0[1] - (hy + 22 * s), P.d); rect(20 + 1 * s + g1[0], hy + 22 * s, 4 * s, base - g1[1] - (hy + 22 * s), P.d);
          rect(20 - 10 * s - g1[0] * 0.6, hy + 11 * s, 4 * s, 14 * s, P.d); rect(20 + 6 * s - g0[0] * 0.6, hy + 11 * s, 4 * s, 14 * s, P.d); }
        ell(20, hy + 5 * s, 6 * s, 6 * s, P.b);                       // Kopf
        eye(20 - 3 * s, hy + 4 * s, true); eye(20 + 2 * s, hy + 4 * s, true);
        if (o.horns) { tri(20 - 6 * s, hy + 2 * s, 20 - 8 * s, hy - 8 * s, 20 - 2 * s, hy + 1 * s, P.a); tri(20 + 2 * s, hy + 1 * s, 20 + 8 * s, hy - 8 * s, 20 + 6 * s, hy + 2 * s, P.a); }
        if (o.fire) { for (let i = 0; i < 5; i++) tri(20 - 8 * s + i * 4 * s, hy + 14 * s, 20 - 6 * s + i * 4 * s, hy + 6 * s - (i % 2) * 4, 20 - 4 * s + i * 4 * s, hy + 14 * s, P.a); }
        else if (stufe >= 2) { rect(20 - 7 * s, hy + 14 * s, 14 * s, 2, P.a); rect(20 - 1, hy + 10 * s, 2, 12 * s, P.a); }
        if (stufe >= 3 || f.legend) { tri(20 - 9 * s, hy + 12 * s, 20 - 16 * s, hy + 26 * s, 20 - 5 * s, hy + 24 * s, P.d); tri(20 + 9 * s, hy + 12 * s, 20 + 16 * s, hy + 26 * s, 20 + 5 * s, hy + 24 * s, P.d); }
        break;
      }
      case 'raupe': {    // Raupe: Rücken wellt sich beim Laufen, Beinchen unten
        const n = 3 + stufe, rr = 2.8 * s + 1.2, sp = rr * 1.4, x0 = 20 - ((n - 1) * sp) / 2;
        for (let i = 0; i < n; i++) {
          const lift = ph < 0 ? Math.sin(i * 0.8) * 0.8 : Math.max(0, Math.sin(i * 1.1 - ph * 1.5708)) * 3.4 * s;
          const x = x0 + i * sp, cy = base - rr - 1 - lift, kopf = i === n - 1;
          rect(x - 0.5, cy + rr * 0.6, 1.2, base - (cy + rr * 0.6) - (lift > 1.5 ? 0 : 0), P.d);
          ell(x, cy, rr + (kopf ? 0.9 : 0), rr + (kopf ? 0.7 : 0), kopf ? P.b : (i % 2 ? P.b : P.a));
          ell(x, cy + rr * 0.4, rr * 0.8, rr * 0.45, P.d);
          if (!kopf && stufe >= 2) { px(x, cy - rr, P.e); px(x + 1, cy - rr + 1, P.e); }
          if (!kopf && stufe >= 3 && i % 2) tri(x - 1.2, cy - rr + 1, x, cy - rr - 2 * s - 1, x + 1.2, cy - rr + 1, P.a);
          if (kopf) {
            eye(x + 1, cy - 1.2, true);
            px(x + rr + 0.2, cy + 1.6, '#1a1018');
            for (const d of [-1, 1]) { rect(x + d * 1.4, cy - rr - 3, 1, 3, P.d); px(x + d * 1.4 + (d > 0 ? 1 : -1), cy - rr - 4, P.a); }
          }
        }
        if (stufe >= 3) { const xm = x0 + 2.5 * sp, yy = base - rr * 2 - 1; tri(xm - 2, yy, xm - 6 * s, yy - 9 * s, xm + 1, yy - 1, P.a); tri(xm + 1, yy, xm + 5 * s, yy - 8 * s - wave(0) * 1.2, xm + 4, yy - 1, P.e); }
        break;
      }
      case 'falter': {   // Schmetterling: Flügel klappen beim Laufen
        const sp = ph < 0 ? 1 : [1, 0.55, 0.2, 0.55][ph], by = base - 16 * s - 5 + (ph < 0 ? 0 : (ph % 2 ? 1.5 : -1.5));
        for (const d of [-1, 1]) {
          const wx = 20 + d * (3 + 6.5 * sp) * s;
          ell(wx, by - 5 * s, (5.5 * sp + 1) * s, 7 * s, P.b);           // Vorderflügel
          ell(wx, by - 5 * s, (3.4 * sp + 0.5) * s, 4.4 * s, P.a);
          ell(wx - d * 0.5, by + 4 * s, (4 * sp + 0.8) * s, 5 * s, P.d); // Hinterflügel
          ell(wx - d * 0.5, by + 4.5 * s, (2.2 * sp + 0.4) * s, 2.6 * s, P.a);
          if (sp > 0.4) { ell(wx + d * 0.5, by - 6 * s, 1.3 * s, 1.3 * s, P.e); }
          if (stufe >= 3) tri(wx + d * 2 * sp * s, by + 8 * s, wx + d * 3 * sp * s, by + 15 * s, wx - d * 1 * s, by + 8 * s, P.d);   // Schwalbenschwanz
        }
        ell(20, by + 1, 2.1 * s + 0.4, 7.5 * s, P.d);                    // Körper
        ell(20, by - 6 * s, 2.7 * s, 2.7 * s, P.b);                      // Kopf
        eye(20 - 1.4, by - 6.5 * s, false); px(20 + 1.5, by - 6.5 * s, P.e);
        for (const d of [-1, 1]) { px(20 + d * 2, by - 9 * s, P.a); px(20 + d * 3.2, by - 11 * s - wave(d) * 0.8, P.a); px(20 + d * 4, by - 12 * s - wave(d), P.e); }
        break;
      }
      case 'hummel': {   // Hummel mit Streifen und schwirrenden Flügeln
        const by = base - 14 * s - 4 + (ph < 0 ? 0 : (ph % 2 ? 1.2 : -1.2)), wl = ph < 0 ? 0 : [-4, 0, 3, 0][ph];
        ell(16, by - 7 * s - 1 + wl * 0.5, 7 * s, 3.2 * s, 'rgba(230,240,255,0.9)'); ell(21, by - 8 * s - 1 - wl * 0.4, 6 * s, 2.6 * s, 'rgba(210,225,250,0.9)');
        ell(17, by, 9 * s, 6 * s, P.b);
        for (let i = 0; i < 3; i++) rect(11 * s + 3 + i * 4 * s - 3, by - 5 * s, 2 * s + 0.6, 10 * s, P.d);
        tri(17 - 8 * s, by - 1, 17 - 8 * s - 5, by + 1, 17 - 8 * s, by + 3, P.a);   // Stachel
        ell(27 * (0.9 + 0.1 * s), by - 1, 4.4 * s, 4.2 * s, P.b);
        ell(26 * (0.9 + 0.1 * s) + 2, by + 1.5, 2.6 * s, 2 * s, P.a);
        eye(27 * (0.9 + 0.1 * s) + 1, by - 2.5 * s, true);
        for (const d of [0, 1]) { px(27 * (0.9 + 0.1 * s) + d * 3, by - 5.5 * s, P.d); px(27 * (0.9 + 0.1 * s) + d * 3 + 1, by - 6.5 * s, P.a); }
        for (let i = 0; i < 3; i++) { const [gx, gl] = gait(i, 1.3); rect(12 + i * 4 * s + gx, by + 5 * s, 1, 4 * s - gl, P.d); }
        if (stufe >= 3) { for (let i = 0; i < 4; i++) tri(10 + i * 3 * s, by - 5 * s, 11.5 + i * 3 * s, by - 9 * s, 13 + i * 3 * s, by - 5 * s, P.e); }
        break;
      }
      case 'schildkroete': {
        const by = base - 8 * s - 4;
        const [g0, g1, g2, g3] = [0, 1, 2, 3].map(i => gait(i, 1.6));
        rect(11 * s + g0[0], by + 3 * s, 4 * s + 1, base - g0[1] - (by + 3 * s), P.d); rect(25 * s + g3[0], by + 3 * s, 4 * s + 1, base - g3[1] - (by + 3 * s), P.d);   // hinten / vorn
        ell(20, by, 13 * s, 8.5 * s, P.b);                                // Panzer
        ell(20, by + 6 * s, 12 * s, 3 * s, P.a);                          // Bauchplatte
        for (let i = -2; i <= 2; i++) { ell(20 + i * 5 * s, by - 2 * s - (Math.abs(i) === 2 ? -2 * s : 0), 2.6 * s, 2.3 * s, P.d); ell(20 + i * 5 * s, by - 3 * s - (Math.abs(i) === 2 ? -2 * s : 0), 1.8 * s, 1.5 * s, i % 2 ? P.b : P.a); }
        rect(14 * s + g1[0], by + 3 * s, 4 * s + 1, base - g1[1] - (by + 3 * s), P.d); rect(30 * s + g2[0] - 4 * s, by + 3 * s, 4 * s + 1, base - g2[1] - (by + 3 * s), P.d);
        const hx = 20 + 13 * s + 1 + wave(0, 1) * 0.8;                    // Kopf auf langem Hals
        rect(20 + 9 * s, by - 2 * s, 5 * s, 4 * s, P.d); ell(hx + 1, by - 1 * s, 4 * s, 3.6 * s, P.d); ell(hx + 3 * s, by, 2.6 * s, 2 * s, P.d);
        eye(hx + 1, by - 2 * s, true);
        tri(2 + 20 - 14 * s, by + 2 * s, 20 - 17 * s, by + 4 * s + wave(1) * 1, 20 - 13 * s, by + 5 * s, P.d);   // Schwanz
        if (stufe >= 2) for (let i = 0; i < 4; i++) tri(20 - 9 * s + i * 5 * s, by - 7 * s, 20 - 7.5 * s + i * 5 * s, by - 12 * s, 20 - 6 * s + i * 5 * s, by - 7 * s, P.a);
        if (stufe >= 3) for (let i = 0; i < 3; i++) { tri(20 - 6 * s + i * 6 * s, by - 9 * s, 20 - 4.5 * s + i * 6 * s, by - 17 * s, 20 - 3 * s + i * 6 * s, by - 9 * s, P.e); }
        break;
      }
      case 'frosch': {   // Frosch: hüpft statt zu laufen
        const ex = ph < 0 ? 0 : [0, 0.5, 1, 0.5][ph], lift = ex * 3.5, by = base - 9 * s - 2 - lift;
        const bk = 20 - 5 * s - ex * 4 * s;
        ell(20, by, 11 * s, 7 * s, P.b);                                // Körper
        ell(20, by + 3 * s, 9 * s, 3.4 * s, P.a);                       // heller Bauch
        // Hinterbeine: zusammengelegt oder gestreckt
        ell(bk + 3, by + 3 * s, 5 * s, 3.4 * s, P.b);
        rect(bk - 3 * s - ex * 5 * s, base - 2 - lift * 0.2 * (1 - ex), 7 * s + ex * 6 * s, 2, P.d); ell(bk - 3 * s - ex * 5 * s + 1, base - 1.2, 3 * s + 1, 1.3, P.b);
        rect(20 + 9 * s, by + 3 * s, 3 * s, base - (by + 3 * s) - lift * 0.1, P.d); ell(20 + 10.5 * s + 1, base - 1, 3 * s, 1.3, P.b);   // Vorderbein
        const hx = 20 + 7 * s;                                          // Kopf
        ell(hx, by - 3 * s, 6 * s, 4.6 * s, P.b);
        rect(hx - 2, by - 1 * s + 1, 9 * s, 1, P.d);                    // Maul
        ell(hx - 1 * s, by - 8 * s, 2.7 * s, 2.7 * s, P.b); ell(hx + 4 * s, by - 8 * s, 2.7 * s, 2.7 * s, P.b);   // Glubschaugen
        eye(hx - 1.6 * s, by - 8.5 * s, true); eye(hx + 3.4 * s, by - 8.5 * s, true);
        ell(hx + 2 * s, by + 0.5 * s, 3 * s, 2 * s + wave(0, 2) * 0.5, P.a);   // Kehlsack
        if (stufe >= 2) for (let i = 0; i < 5; i++) ell(20 - 8 * s + i * 4 * s, by - 5 * s + (i % 2) * 2 * s, 1.2 * s + 0.3, 1.2 * s + 0.3, P.e);
        if (stufe >= 3) { for (let i = 0; i < 5; i++) tri(hx - 5 * s + i * 2.6 * s, by - 10 * s, hx - 4 * s + i * 2.6 * s, by - 16 * s - (i % 2) * 3, hx - 3 * s + i * 2.6 * s, by - 10 * s, P.a); }
        break;
      }
      case 'schnecke': {
        const st = ph < 0 ? 0 : [0, 1.2, 2.4, 1.2][ph] * s, by = base - 3;
        for (let i = 0; i <= 12; i++) { const t = i / 12; ell(7 + t * (14 * s + 8) + st * t, by - (1 - t) * 1 - Math.sin(t * 3.1) * 1.2 * s, (4.2 - 2.4 * t) * s + 1, (3.3 - 1.4 * t) * s + 0.8, i % 2 ? P.d : P.b); }   // Fuss
        const hx = 7 + 14 * s + 8 + st;
        ell(hx - 2, by - 7 * s, 3.2 * s, 6 * s, P.b);                    // Hals
        ell(hx, by - 12 * s, 3.6 * s, 3.2 * s, P.b);                     // Kopf
        for (const d of [-1, 1]) { rect(hx + d * 2.4, by - 20 * s + 3, 1, 8 * s, P.d); ell(hx + d * 2.4 + 0.5, by - 20 * s + 3, 1.5 * s, 1.5 * s, P.a); px(hx + d * 2.4 + 0.5, by - 20 * s + 3, P.e); }
        eye(hx - 0.5, by - 12 * s, true);
        px(hx + 3 * s, by - 11 * s, '#1a1018');
        const sx = 15 - st * 0.2, sy = by - 11 * s - 2;                  // Schneckenhaus mit Spirale
        ell(sx, sy, 10 * s, 10 * s, P.a); ell(sx, sy, 8.2 * s, 8.2 * s, P.b);
        for (let a = 0; a < 15; a += 0.22) { const rr = 1 + a * 0.42 * s; px(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, P.d); if (a > 4) px(sx + Math.cos(a) * rr + 1, sy + Math.sin(a) * rr, P.e); }
        if (stufe >= 2) for (let i = 0; i < 3; i++) tri(sx - 6 * s + i * 6 * s, sy - 7 * s, sx - 5 * s + i * 6 * s, sy - 12 * s, sx - 3 * s + i * 6 * s, sy - 7 * s, P.a);
        if (stufe >= 3) { rect(sx - 1, sy - 14 * s, 2, 6 * s, P.d); ell(sx, sy - 15 * s, 3, 3, P.e); }
        break;
      }
      case 'qualle': {   // schwebende Leuchtqualle
        const pu = ph < 0 ? 0 : wave(0, 1) * 0.12, cy = base - 22 * s - 3, rx = 11 * s * (1 + pu), ry = 9 * s * (1 - pu);
        for (let i = 0; i < 6; i++) {            // Fangarme
          const x = 20 - 8 * s + i * 3.2 * s, len = (9 + (i % 3) * 5) * s + (stufe >= 3 ? 6 : 0);
          for (let k = 0; k < len; k++) px(x + Math.sin(k * 0.5 + i + (ph < 0 ? 0 : ph * 1.57)) * 1.4, cy + 4 * s + k, k % 4 === 0 ? P.a : P.d);
        }
        for (const d of [-1, 1]) for (let k = 0; k < 7 * s + 3; k++) rect(20 + d * 3 * s + Math.sin(k * 0.6 + d + (ph < 0 ? 0 : ph * 1.2)) * 2, cy + 5 * s + k, 2, 1, P.b);   // Mundarme
        ell(20, cy, rx, ry, P.b);                                         // Schirm
        rect(20 - rx, cy, rx * 2, 3 * s, P.b);
        ell(20, cy + 1, rx * 0.75, ry * 0.6, P.a);                       // Leuchtkern
        for (let i = 0; i < 5; i++) ell(20 - rx + 1 + i * (rx * 2 - 2) / 4, cy + 3 * s + 1, 1.8 * s, 1.6 * s, P.d);   // Rand
        eye(20 - 4 * s, cy - 1 * s, true); eye(20 + 2 * s, cy - 1 * s, true);
        if (stufe >= 2) for (let i = 0; i < 5; i++) px(20 - 6 * s + i * 3 * s, cy - ry + 1, P.e);
        if (stufe >= 3) { tri(20 - 4 * s, cy - ry + 2, 20, cy - ry - 8 * s, 20 + 4 * s, cy - ry + 2, P.a); }
        break;
      }
      case 'skorpion': {
        const by = base - 6 * s - 2;
        for (let i = 0; i < 4; i++) {            // 8 Beine (4 sichtbar je Seite)
          const [gx, gl] = gait(i, 2.2), lx = 14 + i * 3.4 * s;
          for (let k = 0; k < 6; k++) px(lx + k * 0.3 * (i < 2 ? -1 : 1) + gx * (k / 6), by + 3 * s + k * (base - by - 3 * s) / 6 - (k > 4 ? gl : 0), P.d);
          rect(lx + gx * 1 - (i < 2 ? 2 : -1), base - 1 - gl, 3, 1, P.d);
        }
        for (let i = 0; i < 5; i++) ell(18 - i * 1.2 * s + 2, by + (i % 2) * 0.5, (7 - i * 0.6) * s, (4.4 - i * 0.2) * s, i % 2 ? P.d : P.b);   // Rumpf in Segmenten
        ell(24 * (0.9 + 0.1 * s), by - 1, 5 * s, 4.2 * s, P.b);                    // Kopf
        eye(25 * (0.9 + 0.1 * s), by - 2 * s, true);
        const cl = wave(0, 2) * 1.2;
        for (const [dy, dd] of [[-4, 0], [3, 1]]) {   // Scheren
          const cx = 28 * (0.9 + 0.1 * s), cyy = by + dy * s;
          rect(cx - 3, cyy + 0.5, 4 * s, 1.6, P.d);
          ell(cx + 4 * s, cyy + cl * (dd ? -1 : 1), 3.4 * s, 2.5 * s, P.a); tri(cx + 6 * s, cyy - 1.6 * s, cx + 9 * s, cyy + 0.5 + cl, cx + 6 * s, cyy + 0.8, P.d);
        }
        let tx = 11, ty = by - 2;                 // Schwanz mit Stachel (bogenförmig nach vorn)
        for (let i = 0; i < 11 + stufe * 2; i++) { const a = i * 0.28 + wave(i * 0.3) * 0.08; ell(tx, ty, Math.max(1.1, (2.6 - i * 0.1) * s), Math.max(1.1, (2.6 - i * 0.1) * s), i % 2 ? P.b : P.d); tx = 9 + Math.sin(a + 0.4) * (9 * s) * 0.55 + i * 0.1; ty = by - 2 - i * 1.5 * s - (i > 6 ? -(i - 6) * 0.6 : 0); tx += (i > 5 ? (i - 5) * 0.9 : 0); }
        tri(tx, ty - 1, tx + 5, ty + 3, tx + 1, ty + 3, P.a); tri(tx + 3, ty + 2, tx + 4, ty + 6, tx + 1, ty + 3, P.e);
        if (stufe >= 2) for (let i = 0; i < 4; i++) tri(14 + i * 3 * s, by - 4 * s, 15.5 + i * 3 * s, by - 7 * s, 17 + i * 3 * s, by - 4 * s, P.a);
        break;
      }
      case 'spinne': {
        const by = base - 12 * s - 4;
        for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {   // 8 Beine: hoch zum Knie, dann schräg nach unten
          const [gx, gl] = gait(i + (sx > 0 ? 1 : 0), 2), ax = 20 + sx * 1.5, ay = by + 1 + (i - 1.5) * 0.8 * s;
          const kx = 20 + sx * (4 + i * 1.6) * s, ky = by - (7 + (i === 1 || i === 2 ? 3 : 0)) * s;
          const fx = kx + sx * (2 + i * 1.4) * s + gx, fy = base - gl;
          for (let k = 0; k <= 8; k++) { const q = k / 8; rect(ax + (kx - ax) * q, ay + (ky - ay) * q - Math.sin(q * 3.1) * 1.5 * s, 1.4, 1.4, k % 3 === 1 ? P.b : P.d); }
          for (let k = 0; k <= 12; k++) { const q = k / 12; rect(kx + (fx - kx) * q, ky + (fy - ky) * q, 1.4, 1.4, k % 3 === 1 ? P.b : P.d); }
        }
        ell(15, by + 2 * s, 8.5 * s, 7.5 * s, P.b);                       // Hinterleib
        ell(15, by + 3 * s, 6 * s, 4.5 * s, P.d);
        if (stufe >= 2) { tri(12, by - 1 * s, 15, by + 4 * s, 18, by - 1 * s, P.a); rect(14, by + 4 * s - 1, 2, 2, P.e); }
        ell(25 * (0.9 + 0.1 * s), by, 5.5 * s, 4.6 * s, P.b);             // Vorderleib
        for (const [ex, ey] of [[0, 0], [2, -1.5], [3.5, 0.5]]) { px(25 * (0.9 + 0.1 * s) + ex * s, by - 1 * s + ey, P.e); px(25 * (0.9 + 0.1 * s) + ex * s + 1, by - 1 * s + ey, P.e); }
        augen.push([Math.round((25 * (0.9 + 0.1 * s) + 1) * R), Math.round((by - 1 * s) * R), 2]);
        tri(27 * (0.9 + 0.1 * s), by + 2 * s, 28.5 * (0.9 + 0.1 * s), by + 8 * s + wave(0, 2) * 1, 30 * (0.9 + 0.1 * s), by + 3 * s, P.a);   // Kieferklauen
        if (stufe >= 3) for (let i = 0; i < 3; i++) tri(9 + i * 4, by - 5 * s, 10.5 + i * 4, by - 9 * s, 12 + i * 4, by - 5 * s, P.a);
        break;
      }
      case 'fledermaus': {
        const by = base - 20 * s - 2 + (ph < 0 ? 0 : (ph % 2 ? 1.5 : -1.5)), fl = ph < 0 ? 0.3 : [-1, 0, 1, 0][ph];   // Flügelstellung -1 oben, 1 unten
        for (const d of [-1, 1]) {   // Flügel mit Fingerknochen
          const tipY = by - 3 * s + fl * 8 * s, tipX = 20 + d * 17 * s;
          const midY = by - 5 * s + fl * 5 * s;
          tri(20 + d * 3 * s, by - 1, tipX, tipY, 20 + d * 5 * s, by + 8 * s, P.d);
          tri(20 + d * 3 * s, by - 3 * s, 20 + d * 12 * s, midY - 8 * s, tipX, tipY, P.b);
          tri(20 + d * 5 * s, by + 8 * s, 20 + d * 11 * s, by + 5 * s + fl * 4 * s, tipX, tipY, P.d);
          for (let k = 0; k <= 8; k++) px(20 + d * (3 * s + (tipX - 20 - d * 3 * s) * d * k / 8 * d), by - 1 + (tipY - by + 1) * k / 8, P.a);
        }
        ell(20, by + 2, 4.4 * s, 6 * s, P.b);                               // Körper
        ell(20, by + 4 * s, 3 * s, 3.4 * s, P.d);
        ell(20, by - 6 * s, 4.2 * s, 3.8 * s, P.b);                         // Kopf
        tri(20 - 4 * s, by - 7 * s, 20 - 5 * s, by - 14 * s, 20 - 1.4 * s, by - 8 * s, P.b); tri(20 + 1.4 * s, by - 8 * s, 20 + 5 * s, by - 14 * s, 20 + 4 * s, by - 7 * s, P.b);   // Ohren
        tri(20 - 3.4 * s, by - 8 * s, 20 - 4.2 * s, by - 12 * s, 20 - 1.8 * s, by - 8.4 * s, P.a); tri(20 + 1.8 * s, by - 8.4 * s, 20 + 4.2 * s, by - 12 * s, 20 + 3.4 * s, by - 8 * s, P.a);
        eye(20 - 3 * s, by - 6.5 * s, false); eye(20 + 1.6 * s, by - 6.5 * s, false);
        px(20 - 1.4 * s, by - 3.2 * s, '#fff'); px(20 + 1.4 * s, by - 3.2 * s, '#fff');   // Fangzähne
        for (const d of [-1, 1]) { const [gx, gl] = gait(d > 0 ? 1 : 0, 1.4); rect(20 + d * 2 * s + gx, by + 7 * s, 1.4, 4 * s - gl, P.d); }
        if (stufe >= 3) for (let i = 0; i < 3; i++) tri(20 - 3 * s + i * 3 * s, by - 9 * s, 20 - 2 * s + i * 3 * s, by - 13 * s, 20 - 1 * s + i * 3 * s, by - 9 * s, P.e);
        break;
      }
      case 'eule': {
        const wd = ph < 0 ? 0 : wave(0, 2) * 0.9, by = base - 13 * s - 3;
        { const g0 = gait(0, 1.8), g1 = gait(1, 1.8);                       // Füsse watscheln
          for (const [gg, ox] of [[g0, -3], [g1, 3]]) { rect(20 + ox * s + gg[0], by + 9 * s, 2, base - gg[1] - (by + 9 * s), P.a); for (let k = -1; k <= 1; k++) px(20 + ox * s + gg[0] + 0.5 + k * 1.5, base - gg[1], P.a); } }
        ell(20 + wd, by + 1, 8.5 * s, 10.5 * s, P.b);                       // Körper
        ell(20 + wd, by + 3 * s, 5.8 * s, 7 * s, P.d);                      // Brust
        for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) px(20 + wd + j * 2.4 * s, by + 1 * s + i * 2.2 * s + (j & 1), P.b);   // Brustgefieder
        for (const d of [-1, 1]) { ell(20 + wd + d * 8.5 * s, by + 1 * s, 2.6 * s, 7.5 * s, P.d); tri(20 + wd + d * 7 * s, by + 6 * s, 20 + wd + d * 10 * s, by + 12 * s, 20 + wd + d * 8 * s, by + 5 * s, P.d); }   // Flügel
        const hy = by - 9 * s - 1 + (ph < 0 ? 0 : (ph % 2 ? 0.6 : 0));
        ell(20 + wd, hy, 7.6 * s, 6 * s, P.b);                              // Kopf
        for (const d of [-1, 1]) tri(20 + wd + d * 4 * s, hy - 4 * s, 20 + wd + d * 6.4 * s, hy - 11 * s - (stufe >= 2 ? 3 : 0), 20 + wd + d * 1.4 * s, hy - 5 * s, P.d);   // Federohren
        for (const d of [-1, 1]) { ell(20 + wd + d * 3.2 * s, hy + 0.2, 3.1 * s, 3.1 * s, P.a); ell(20 + wd + d * 3.2 * s, hy + 0.2, 2 * s, 2 * s, P.e); }   // Gesichtsscheibe
        eye(20 + wd - 3.8 * s, hy - 0.3, true); eye(20 + wd + 2.6 * s, hy - 0.3, true);
        tri(20 + wd - 1.2, hy + 1.5 * s, 20 + wd + 1.2, hy + 1.5 * s, 20 + wd, hy + 5 * s, '#e0b050');   // Schnabel
        if (stufe >= 3) { for (let i = 0; i < 5; i++) tri(20 + wd - 6 * s + i * 3 * s, hy - 6 * s, 20 + wd - 5 * s + i * 3 * s, hy - 11 * s - (i % 2) * 3, 20 + wd - 4 * s + i * 3 * s, hy - 6 * s, P.e); }
        break;
      }
      case 'baum': {    // wandelnder Baumwächter
        const hy = base - 25 * s - 2, g0 = gait(0, 2.4), g1 = gait(1, 2.4);
        for (const [gg, ox] of [[g0, -5], [g1, 2]]) {   // Wurzelbeine
          rect(20 + ox * s + gg[0], hy + 22 * s, 4.2 * s, base - gg[1] - (hy + 22 * s), P.d);
          for (let k = -1; k <= 1; k++) rect(20 + ox * s + gg[0] + k * 2 * s - 1, base - 1 - gg[1], 2, 1.4, P.d);
        }
        rect(20 - 7 * s, hy + 8 * s, 14 * s, 15 * s, P.b);                  // Stamm
        for (let i = 0; i < 4; i++) rect(20 - 6 * s + i * 3.5 * s, hy + 9 * s, 1.2, 13 * s, P.d);   // Rindenfurchen
        rect(20 - 8 * s, hy + 18 * s, 16 * s, 5 * s, P.d);
        for (const d of [-1, 1]) {                                          // Astarme
          const sw = (d > 0 ? g0 : g1)[0] * -0.7;
          rect(20 + d * 7 * s + (d > 0 ? 0 : -3 * s) + sw, hy + 11 * s, 3 * s, 12 * s, P.d);
          tri(20 + d * 9 * s + sw, hy + 22 * s, 20 + d * 12 * s + sw, hy + 28 * s, 20 + d * 8 * s + sw, hy + 24 * s, P.b);
          if (stufe >= 2) { tri(20 + d * 9 * s + sw, hy + 15 * s, 20 + d * 15 * s + sw, hy + 12 * s, 20 + d * 9 * s + sw, hy + 12 * s, P.b); ell(20 + d * 14 * s + sw, hy + 12 * s, 2.6 * s, 2.2 * s, P.a); }
        }
        eye(20 - 3.4 * s, hy + 13 * s, true); eye(20 + 2 * s, hy + 13 * s, true);   // Gesicht im Stamm
        rect(20 - 2 * s, hy + 17 * s, 4 * s, 1.4, P.d);
        // Krone
        const kr = [[0, -3, 10], [-7, 0, 7.6], [7, 0, 7.6], [-3.5, -7, 7.4], [3.5, -7, 7.4], [0, -10, 6]];
        kr.forEach(([kx, ky, r], i) => ell(20 + kx * s * 0.9 + wave(i) * 0.5, hy + 5 * s + ky * s * 0.8, r * s * 0.66, r * s * 0.56, i % 2 ? P.a : (i === 0 ? P.b : P.e)));
        if (stufe >= 2) for (let i = 0; i < 5; i++) ell(20 - 10 * s + i * 5 * s, hy + 6 * s + (i % 2) * 4 * s, 1.5 * s, 1.5 * s, '#ff6a5a');   // Früchte
        if (stufe >= 3) { for (let i = 0; i < 4; i++) ell(20 - 7 * s + i * 4.6 * s, hy - 2 * s - (i % 2) * 3, 1.6 * s, 1.6 * s, '#ff9ad0'); }
        break;
      }
      case 'wolke': {   // Gewitterwolke mit Gesicht und Blitz
        const cy = base - 21 * s - 4 + (ph < 0 ? 0 : wave(0) * 1.2);
        const bl = ph < 0 || ph % 2 === 1;                                  // Blitz flackert
        if (bl) { const bx = 20 + (ph === 3 ? 4 : -1) * s; tri(bx - 3 * s, cy + 6 * s, bx + 3 * s, cy + 6 * s, bx - 1 * s, cy + 15 * s, P.a); tri(bx - 3 * s, cy + 12 * s, bx + 4 * s, cy + 12 * s, bx - 2 * s, cy + 22 * s + 3, P.e); }
        const bl2 = [[0, 0, 9], [-8, 2, 7], [8, 2, 7], [-4, -5, 7.4], [4, -5, 7.4], [-12, 4, 5], [12, 4, 5]];
        bl2.forEach(([x, y, r], i) => ell(20 + x * s + wave(i, 1) * 0.6, cy + y * s * 0.8, r * s * 0.92, r * s * 0.78, i < 3 ? P.d : P.b));
        ell(20, cy + 2 * s, 11 * s, 4.4 * s, P.d);
        for (let i = 0; i < 3; i++) ell(20 - 5 * s + i * 5 * s, cy - 6 * s, 3.4 * s, 2.6 * s, P.b);
        eye(20 - 4 * s, cy - 1 * s, true); eye(20 + 2.4 * s, cy - 1 * s, true);
        rect(20 - 2 * s, cy + 3.4 * s, 4 * s, 1.4, P.a);
        if (stufe >= 2) { for (let i = 0; i < 3; i++) { rect(20 - 7 * s + i * 7 * s, cy + 8 * s, 1, 4, P.e); } }
        if (stufe >= 3) { for (const d of [-1, 1]) { tri(20 + d * 13 * s, cy + 3 * s, 20 + d * 19 * s, cy + 12 * s, 20 + d * 10 * s, cy + 8 * s, P.a); tri(20 + d * 16 * s, cy + 9 * s, 20 + d * 21 * s, cy + 16 * s + 2, 20 + d * 14 * s, cy + 14 * s, P.e); } }
        break;
      }
      case 'echse': {   // Salamander / Axolotl: langer Körper, Beine abgespreizt, Schwanz peitscht
        const by = base - 6 * s - 2, o2 = o;
        { let tx = 14, ty = by + 1;                                          // Schwanz
          for (let i = 0; i < 10; i++) { ell(tx, ty, Math.max(1, (3.6 - i * 0.3) * s), Math.max(1, (3 - i * 0.26) * s), i % 3 === 2 ? P.d : P.b); tx -= 1.3 * s; ty += Math.sin(i * 0.6 + (ph < 0 ? 0 : ph * 1.57)) * 1.0 + (i > 7 ? -0.35 : 0.0); }
          if (o2.flame) { ell(tx, ty - 2 * s, 3 * s, 4.4 * s + wave(0, 2), P.a); ell(tx, ty - 2.6 * s, 1.6 * s, 2.6 * s, P.e); } }
        ell(21, by, 9.5 * s, 4.8 * s, P.b);
        ell(21, by + 2 * s, 7.5 * s, 2.4 * s, P.d);
        [11, 16, 24, 28].forEach((lx0, i) => {   // Beine: Oberarm seitlich, Fuss mit Zehen
          const [gx, gl] = gait(i, 2.4), lx = lx0 * (0.85 + 0.15 * s) + gx;
          rect(lx, by + 2 * s, 3 * s + 1, base - gl - (by + 2 * s), P.d); ell(lx + 1.5 * s + 1, base - 1 - gl, 2.8 * s + 0.4, 1.3, P.b);
          for (let k = 0; k < 3; k++) px(lx + k * 1.2 * s, base - gl, o2.flame ? P.a : '#efe8d8');
        });
        const hx = 28 * (0.9 + 0.1 * s);
        ell(hx, by - 1 * s, 5 * s, 4 * s, P.b); ell(hx + 3 * s, by + 0.5 * s, 3 * s, 2.2 * s, P.d);
        eye(hx + 0.5, by - 2.4 * s, true);
        px(hx + 6 * s, by - 0.5 * s, '#1a1018');
        if (o2.kiemen) { for (const k of [0, 1, 2]) for (const d of [-1, 1]) { tri(hx - 3 * s, by - 2 * s, hx - 8 * s - k * 1.5, by - (4 + k * 3) * s + wave(k + d) * 1.6, hx - 1 * s, by - 4 * s - k, k % 2 ? P.a : '#ffc0d4'); } }
        if (o2.flame || stufe >= 2) for (let i = 0; i < 5; i++) tri(11 + i * 3.6 * s, by - 4 * s, 12.5 + i * 3.6 * s, by - (7 + (i % 2) * 2) * s, 14 + i * 3.6 * s, by - 4 * s, P.a);
        if (stufe >= 3) { tri(hx - 2, by - 4 * s, hx - 3, by - 11 * s, hx + 1, by - 5 * s, P.e); tri(hx + 1, by - 5 * s, hx + 3, by - 10 * s, hx + 4, by - 4 * s, P.e); }
        break;
      }
      case 'kaefer': {   // Hirschkäfer: Panzer, grosse Zangen, sechs Beine
        const by = base - 8 * s - 3;
        for (let i = 0; i < 3; i++) for (const d of [0, 1]) {
          const [gx, gl] = gait(i * 2 + d, 2.0), lx = 12 + i * 5.2 * s + d * 2;
          for (let k = 0; k < 7; k++) px(lx + (k / 7) * (i === 0 ? -3 : i === 2 ? 3 : 0) + gx * (k / 7), by + 3 * s + k * (base - by - 3 * s) / 7 - (k > 5 ? gl : 0), d ? P.d : P.b);
          rect(lx + gx + (i === 0 ? -3 : i === 2 ? 3 : 0), base - 1 - gl, 3, 1, P.d);
        }
        ell(14, by, 10.5 * s, 7.2 * s, P.b);                                  // Flügeldecken
        rect(15 - 0.5, by - 7 * s, 1, 14 * s, P.d);                         // Naht
        ell(15, by + 3 * s, 9 * s, 3.4 * s, P.d);
        ell(11, by - 3 * s, 3.6 * s, 3 * s, P.a); ell(19.5, by - 3 * s, 3.6 * s, 3 * s, P.a);   // Glanzflecken
        ell(22 * (0.9 + 0.1 * s), by - 0.5, 4.6 * s, 4.4 * s, P.d);            // Halsschild
        ell(26 * (0.9 + 0.1 * s), by + 0.5, 3.4 * s, 3.1 * s, P.b);          // Kopf
        eye(26 * (0.9 + 0.1 * s) + 0.5, by - 1.5 * s, true);
        const zg = wave(0, 2) * 1.3;                                         // Zangen
        for (const d of [-1, 1]) { for (let k = 0; k < 8 * s + 3; k++) { const t = k / (8 * s + 3); rect(28 * (0.9 + 0.1 * s) + k * 0.7, by + 0.5 + d * (1.4 + Math.sin(t * 2.4) * (3.6 + zg) * s), 2, 2, k % 3 === 0 ? P.a : P.d); } }
        if (stufe >= 2) for (let i = 0; i < 3; i++) tri(10 + i * 5 * s, by - 6 * s, 11.5 + i * 5 * s, by - 10 * s, 13 + i * 5 * s, by - 6 * s, P.e);
        if (stufe >= 3) { tri(20 * (0.9 + 0.1 * s), by - 6 * s, 22 * (0.9 + 0.1 * s), by - 15 * s, 25 * (0.9 + 0.1 * s), by - 6 * s, P.a); }
        break;
      }
    }
    nachbearbeiten(c, f, fam, stufe, glanz, P, augen, cv);
    return cv;
  }

  // ---------- Licht und Schatten, Material, Umriss ----------
  const rgb = h => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mixRGB = (c, k) => { const t = k < 0 ? 0 : 255, a = Math.abs(k); return [Math.round(c[0] + (t - c[0]) * a), Math.round(c[1] + (t - c[1]) * a), Math.round(c[2] + (t - c[2]) * a)]; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const MATERIAL = { quad: 'fell', blob: 'schleim', bird: 'feder', skull: 'knochen', wisp: 'schleim', dragon: 'schuppen', crab: 'schuppen', mushroom: 'pilz', serpent: 'schuppen', golem: 'stein', ghoul: 'stoff', raupe: 'pilz', falter: 'feder', hummel: 'fell', schildkroete: 'schuppen', frosch: 'schleim', schnecke: 'schleim', qualle: 'schleim', skorpion: 'schuppen', spinne: 'fell', fledermaus: 'fell', eule: 'feder', baum: 'rinde', wolke: 'schleim', echse: 'schuppen', kaefer: 'schuppen' };

  function boxBlur(src, r) {   // Kastenfilter (zweimal waagrecht und senkrecht)
    const out = new Float32Array(N * N), tmp = new Float32Array(N * N), k = 2 * r + 1;
    for (let y = 0; y < N; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * N + Math.max(0, Math.min(N - 1, x))]; for (let x = 0; x < N; x++) { tmp[y * N + x] = acc / k; acc += src[y * N + Math.min(N - 1, x + r + 1)] - src[y * N + Math.max(0, x - r)]; } }
    for (let x = 0; x < N; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(N - 1, y)) * N + x]; for (let y = 0; y < N; y++) { out[y * N + x] = acc / k; acc += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x]; } }
    return out;
  }

  function nachbearbeiten(c, f, fam, stufe, glanz, P, augen, cv) {
    const img = c.getImageData(0, 0, N, N), d = img.data;
    const A = new Float32Array(N * N);
    let y0 = N, y1 = 0;
    for (let i = 0; i < N * N; i++) if (d[i * 4 + 3]) { A[i] = 1; const y = (i / N) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const h1 = boxBlur(boxBlur(A, 2), 1), h2 = boxBlur(boxBlur(A, 6), 3);
    const hs = (x, y) => CAM.hash2(x, y, fam * 13 + stufe);
    const mat = MATERIAL[f.kind] || 'fell';
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? 0 : A[y * N + x];
    // Abstand zum Rand (für Randlicht und Körpermaske)
    const dist = new Uint8Array(N * N);
    for (let pass = 1; pass <= 8; pass++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (!A[i] || dist[i]) continue;
      if (pass === 1 ? (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))
        : ((x > 0 && dist[i - 1] === pass - 1) || (x < N - 1 && dist[i + 1] === pass - 1) || (y > 0 && dist[i - N] === pass - 1) || (y < N - 1 && dist[i + N] === pass - 1))) dist[i] = pass;
    }
    const cmap = {};
    const ramp = (r, g, b) => { const key = (r << 16) | (g << 8) | b; return cmap[key] || (cmap[key] = [mixRGB([r, g, b], 0.3), mixRGB([r, g, b], 0.13), [r, g, b], mixRGB([r, g, b], -0.2), mixRGB([r, g, b], -0.38)]); };
    const Lx = -0.55, Ly = -0.83;
    const out = new Uint8ClampedArray(d.length);
    const dunkel = rgb(P.d);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, j = i * 4;
      if (!A[i]) continue;
      let r = d[j], g = d[j + 1], b = d[j + 2];
      const e1 = -(((x < N - 1 ? h1[i + 1] : h1[i]) - (x > 0 ? h1[i - 1] : h1[i])) * Lx + ((y < N - 1 ? h1[i + N] : h1[i]) - (y > 0 ? h1[i - N] : h1[i])) * Ly);
      const e2 = -(((x < N - 1 ? h2[i + 1] : h2[i]) - (x > 0 ? h2[i - 1] : h2[i])) * Lx + ((y < N - 1 ? h2[i + N] : h2[i]) - (y > 0 ? h2[i - N] : h2[i])) * Ly);
      let sh = e1 * 3.4 + e2 * 7 + (0.5 - (y - y0) / Math.max(1, y1 - y0)) * 0.42;
      // Material: Muster, die das Licht stören
      const hh = hs(x >> 1, y >> 1), h3 = hs(x, y >> 1);
      if (mat === 'fell') sh += (h3 > 0.8 ? 0.2 : h3 < 0.16 ? -0.18 : 0) + ((x + (y >> 1)) % 7 === 0 ? -0.08 : 0);
      else if (mat === 'schuppen') { const gx = (x + (((y >> 1) & 1) * 3)) % 6, gy = y % 4; sh += gy === 0 ? -0.2 : (gx === 1 && gy === 1 ? 0.2 : 0) + (hh > 0.85 ? 0.1 : 0); }
      else if (mat === 'stein') sh += (hh > 0.82 ? 0.2 : hh < 0.12 ? -0.2 : 0) + ((x * 3 + y * 5) % 17 === 0 ? -0.3 : 0);
      else if (mat === 'knochen') sh += (hh > 0.88 ? -0.2 : 0) + (h3 > 0.9 ? 0.12 : 0) + ((x + y * 2) % 11 === 0 ? -0.15 : 0);
      else if (mat === 'feder') sh += ((y + (x >> 2)) % 3 === 0 ? -0.16 : 0) + (h3 > 0.85 ? 0.12 : 0);
      else if (mat === 'stoff') sh += (x % 5 === 0 ? -0.12 : 0) + (hh > 0.85 ? 0.1 : 0);
      else if (mat === 'pilz') sh += (hh > 0.8 ? 0.14 : hh < 0.1 ? -0.14 : 0);
      else if (mat === 'schleim') sh += (hh > 0.9 ? 0.1 : 0);
      else if (mat === 'rinde') sh += (x % 4 === 0 ? -0.2 : 0) + ((x + (y >> 3)) % 7 === 0 ? 0.14 : 0) + (hh > 0.9 ? -0.15 : 0);
      const v = sh + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.22;
      const band = v > 0.62 ? 0 : v > 0.22 ? 1 : v > -0.22 ? 2 : v > -0.55 ? 3 : 4;
      let col = ramp(r, g, b)[band];
      // dunkle Tiefe am Rand unten rechts
      const dd = dist[i];
      if (dd === 1 && (!at(x + 1, y) || !at(x, y + 1))) col = mixRGB(col, -0.25);
      else if (dd === 1 && (!at(x - 1, y) || !at(x, y - 1))) col = mixRGB(col, 0.08);
      out[j] = col[0]; out[j + 1] = col[1]; out[j + 2] = col[2]; out[j + 3] = 255;
    }
    // Zusatzdetails je Material
    const setPx = (x, y, col) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const k = (y * N + x) * 4; if (!A[y * N + x]) return; out[k] = col[0]; out[k + 1] = col[1]; out[k + 2] = col[2]; out[k + 3] = 255; };
    if (mat === 'schleim' || mat === 'pilz') {   // nasse Glanzpunkte
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (A[y * N + x] && dist[y * N + x] >= 3 && hs(x, y) > 0.985) { setPx(x, y, [255, 255, 255]); setPx(x + 1, y, [235, 245, 255]); setPx(x, y + 1, [235, 245, 255]); }
    }
    if (mat === 'stein') {   // Risse
      const rr = CAM.mulberry32(fam * 71 + stufe);
      for (let k = 0; k < 4; k++) { let x = 12 + rr() * 52, y = y0 + 4 + rr() * Math.max(6, y1 - y0 - 8); for (let n = 0; n < 9; n++) { if (A[Math.round(y) * N + Math.round(x)] && dist[Math.round(y) * N + Math.round(x)] > 1) setPx(Math.round(x), Math.round(y), mixRGB(rgb(P.d), -0.5)); x += (rr() - 0.4) * 2.4; y += rr() * 1.8; } }
    }
    // Augen: dunkle Pupille und weisser Glanzpunkt, dazu ein feiner Rand
    for (const [ex, ey, w] of augen) {
      for (let k = 0; k < w * 2; k++) { setPx(ex + k, ey, rgb(P.e)); setPx(ex + k, ey + 1, rgb(P.e)); }
      setPx(ex + (w > 1 ? 2 : 1), ey + 1, mixRGB(rgb(P.e), -0.6)); setPx(ex, ey, [255, 255, 255]);
      setPx(ex - 1, ey - 1, mixRGB(dunkel, -0.4)); setPx(ex, ey - 1, mixRGB(dunkel, -0.5)); setPx(ex + 1, ey - 1, mixRGB(dunkel, -0.4));
    }
    if (glanz) {   // Glanzsternchen
      const rr = CAM.mulberry32(fam * 5 + 1);
      for (let k = 0; k < 3; k++) { const x = 14 + Math.floor(rr() * 50), y = y0 + Math.floor(rr() * Math.max(4, y1 - y0)); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (x + dx >= 0 && y + dy >= 0 && x + dx < N && y + dy < N) { const kk = ((y + dy) * N + x + dx) * 4; out[kk] = 255; out[kk + 1] = 255; out[kk + 2] = 255; out[kk + 3] = 255; } }
    }
    // Umriss in der abgedunkelten Farbe des Nachbarn
    const res = new Uint8ClampedArray(out);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (A[y * N + x]) continue;
      let best = -1;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nx = x + dx, ny = y + dy; if (at(nx, ny)) { best = (ny * N + nx) * 4; break; } }
      if (best < 0) continue;
      const k = (y * N + x) * 4, col = mixRGB([out[best], out[best + 1], out[best + 2]], -0.8);
      res[k] = col[0] * 0.8 + 6; res[k + 1] = col[1] * 0.8 + 4; res[k + 2] = col[2] * 0.8 + 12; res[k + 3] = 255;
    }
    c.putImageData(new ImageData(res, N, N), 0, 0);
    // weicher Schein bei Flammen, Irrlichtern und Lava
    if (f.kind === 'wisp' || (f.opt && (f.opt.fire || f.opt.glow)) || f.kind === 'serpent') {
      c.save(); c.globalCompositeOperation = 'destination-over';
      const gr = c.createRadialGradient(N / 2, (y0 + y1) / 2, 4, N / 2, (y0 + y1) / 2, 34);
      gr.addColorStop(0, P.a + '55'); gr.addColorStop(1, P.a + '00');
      c.fillStyle = gr; c.fillRect(0, 0, N, N); c.restore();
    }
    cv.maske = dist;     // für Wunden: nur Punkte im Körper (Abstand >= 3 vom Rand)
    cv.y0 = y0; cv.y1 = y1;
  }

  function shiny(col) {   // Glanz-Variante: Farbkanäle tauschen und aufhellen
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
    const h = v => Math.min(255, Math.round(v * 1.1 + 20)).toString(16).padStart(2, '0');
    return '#' + h(b) + h(r) + h(g);
  }

  // Liefert das Bild eines Mobs (Zeichnung wird zwischengespeichert)
  // ph: -1 oder weggelassen = Standbild, 0..3 = Bild des Laufschritts (wird erst beim ersten Bedarf gezeichnet)
  CAM.sprite = function (m, ph) { return CAM.spriteFam(m.fam, m.stufe, m.glanz, ph); };
  CAM.spriteFam = function (fam, stufe, glanz, ph) {
    ph = ph == null ? -1 : ph;
    const key = fam + '-' + stufe + (glanz ? 's' : '') + (ph >= 0 ? 'w' + ph : '');
    return cache[key] || (cache[key] = draw(fam, stufe, glanz, ph));
  };
  CAM.zeichneMob = function (ctx, m, x, y, size, flip, t) {
    const img = CAM.sprite(m);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const bob = t ? Math.sin(t / 380 + m.fam) * size * 0.02 : 0;
    if (flip) { ctx.translate(x + size, y + bob); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, size, size); }
    else ctx.drawImage(img, x, y + bob, size, size);
    ctx.restore();
  };

  // ---------- Wunden und Verbände ----------
  // Rein fürs Auge, ohne Wirkung im Spiel. Jede Wunde: { x, y } im 80er-Raster des Sprites, t = Art, r = Richtung, v = 0 offen, 1 verbunden, 2 Verband zerfetzt.
  const MAX_WUNDEN = 9;
  const verbundSet = new Set();
  function koerperPunkt(m, rnd) {
    const sp = CAM.sprite(m), mask = sp.maske;
    if (!mask) return [40, 40];
    const pts = [];
    for (let i = 0; i < mask.length; i++) if (mask[i] >= 3) pts.push(i);
    if (!pts.length) for (let i = 0; i < mask.length; i++) if (mask[i] >= 1) pts.push(i);
    if (!pts.length) return [40, 40];
    const i = pts[Math.floor(rnd() * pts.length)];
    return [i % N, (i / N) | 0];
  }
  // Neue Wunde nach einem Treffer. schwere: Schaden als Anteil der maximalen LP, el: Element der Attacke
  CAM.wundeNeu = function (m, schwere, el, rnd) {
    rnd = rnd || Math.random;
    if (!m.wunden) m.wunden = [];
    let t = schwere < 0.1 ? 'kratzer' : schwere < 0.22 ? 'schnitt' : 'riss';
    if (el === 'Feuer' || el === 'Licht') t = schwere < 0.1 ? 'brandmal' : t === 'riss' ? 'riss' : 'brandmal';
    else if ((el === 'Erde' || el === 'Wasser' || el === 'Normal') && rnd() < 0.45 && schwere < 0.22) t = 'prellung';
    let p = null;
    for (let k = 0; k < 14 && !p; k++) {
      const q = koerperPunkt(m, rnd);
      if (m.wunden.every(w => Math.hypot(w.x - q[0], w.y - q[1]) > 7)) p = q;
    }
    if (!p) p = koerperPunkt(m, rnd);
    m.wunden.push({ x: p[0], y: p[1], t, r: Math.floor(rnd() * 4), v: 0 });
    // zu viele Wunden: die ältesten verbundenen verschwinden unter dem Fell
    while (m.wunden.length > MAX_WUNDEN) { const i = m.wunden.findIndex(w => w.v); m.wunden.splice(i >= 0 ? i : 0, 1); }
    return m.wunden[m.wunden.length - 1];
  };
  // Je weniger LP, desto mehr Wunden sind zu sehen (mindestens)
  CAM.wundenMindestens = function (m, rnd, ratio) {
    const q = ratio != null ? ratio : m.hp / m.mhp, ziel = q <= 0 ? 6 : q < 0.25 ? 4 : q < 0.5 ? 2 : q < 0.75 ? 1 : 0;
    if (!m.wunden) m.wunden = [];
    while (m.wunden.filter(w => w.v !== 1).length < ziel && m.wunden.length < MAX_WUNDEN) CAM.wundeNeu(m, q < 0.25 ? 0.25 : 0.12, 'Normal', rnd);
  };
  // Ein schwerer Treffer kann einen Verband zerfetzen
  CAM.verbandZerfetzen = function (m, rnd) {
    const l = (m.wunden || []).filter(w => w.v === 1);
    if (l.length) { l[Math.floor((rnd || Math.random)() * l.length)].v = 2; return true; }
    return false;
  };
  // Nach dem Kampf: alle Wunden werden notdürftig verbunden
  CAM.wundenVerbinden = function (m) { (m.wunden || []).forEach(w => { w.v = 1; }); };
  // Nach Heilung: Wunden verschwinden je nach LP (bei vollen LP alle)
  CAM.wundenAnpassen = function (m, hp) {
    if (!m.wunden || !m.wunden.length) return;
    if (hp == null) hp = m.hp;
    if (hp >= m.mhp) { m.wunden = []; return; }
    const erlaubt = Math.ceil((1 - hp / m.mhp) * MAX_WUNDEN);
    while (m.wunden.length > erlaubt) { const i = m.wunden.findIndex(w => w.v === 1); m.wunden.splice(i >= 0 ? i : 0, 1); }
  };

  function stempel(c, w) {
    const P = (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const dir = [[1, 0.6], [1, -0.6], [1, 0.1], [0.5, 1]][w.r % 4], len = Math.hypot(dir[0], dir[1]), ux = dir[0] / len, uy = dir[1] / len, vx = -uy, vy = ux;
    const lin = (u, v, col) => P(w.x + ux * u + vx * v, w.y + uy * u + vy * v, col);
    if (w.v === 1 || w.v === 2) {                      // Verband
      const heil = w.v === 1;
      for (let u = -7; u <= 7; u++) for (let v = -3; v <= 3; v++) {
        if (!heil && u > 1 && CAM.hash2(w.x + u, w.y + v, 3) > 0.15 && u > 2) continue;       // zerfetzt: rechte Hälfte fehlt
        const rand = Math.abs(v) === 3 || Math.abs(u) === 7 || (!heil && u === 2);
        let col = rand ? '#5f5238' : v === -2 ? '#fffaf0' : v === 2 ? '#c4b692' : '#e9dfc4';
        if (!rand && (u + 8) % 4 === 0) col = '#b3a380';
        if (!heil && rand && Math.abs(u) === 7) continue;
        lin(u, v, col);
      }
      if (heil && (w.t === 'riss' || w.t === 'schnitt')) { lin(0, 0, '#c4222a'); lin(1, 0, '#a01a20'); lin(0, 1, '#a01a20'); }   // Blut sickert durch
      if (!heil) {
        for (let k = 0; k < 7; k++) { lin(2 + (k % 3), 3 + k, k % 2 ? '#d9cdae' : '#e9dfc4'); lin(3 + (k % 2), 4 + k, '#b3a380'); }   // loser Streifen
        for (let k = -1; k <= 1; k++) lin(k, 0, '#9b1b1b'); lin(0, 1, '#c4222a'); lin(1, 1, '#7a0f12');
        lin(-5, 4, '#e9dfc4'); lin(-4, 4, '#b3a380'); lin(-5, 5, '#5f5238');
      }
      return;
    }
    switch (w.t) {
      case 'kratzer': for (let i = -1; i <= 1; i++) for (let u = -3; u <= 3; u++) { lin(u, i * 2, '#8a1a1a'); if (u % 2 === 0) lin(u, i * 2 - 1, '#e07070'); } break;
      case 'schnitt':
        for (let u = -5; u <= 5; u++) { lin(u, 0, '#6a0c10'); lin(u, 1, '#b01c24'); if (u % 3 === 0) lin(u, -1, '#e8908a'); }
        lin(2, 2, '#c4222a'); lin(2, 3, '#c4222a'); lin(2, 4, '#8a1219'); break;
      case 'riss':
        for (let u = -5; u <= 5; u++) { const h = 1 + (CAM.hash2(w.x + u, w.y, 7) > 0.5 ? 1 : 0); for (let v = -h; v <= h; v++) lin(u, v, Math.abs(v) === h ? '#a01a20' : '#3e0508'); lin(u, -h - 1, '#e8908a'); }
        for (const u of [-2, 3]) for (let k = 0; k < 4 + (u > 0 ? 3 : 0); k++) lin(u, 3 + k, k === 3 + (u > 0 ? 3 : 0) ? '#8a1219' : '#c4222a');
        break;
      case 'prellung':
        for (let u = -5; u <= 5; u++) for (let v = -3; v <= 3; v++) if ((u * u) / 28 + (v * v) / 10 <= 1) lin(u, v, v < 0 && u < 1 ? '#8a68b0' : (u * u) / 28 + (v * v) / 10 > 0.6 ? '#4a2e68' : '#6a4a8c');
        break;
      case 'brandmal':
        for (let u = -4; u <= 4; u++) for (let v = -3; v <= 3; v++) { const e = (u * u) / 18 + (v * v) / 10; if (e <= 1) lin(u, v, e > 0.65 ? '#ff9a3c' : '#2a1612'); }
        lin(-1, -1, '#ffd54a'); lin(2, 1, '#ff6a2e'); break;
    }
  }

  const mitCache = {};
  // Sprite mit sichtbaren Wunden und Verbänden (gleiche Grösse wie CAM.sprite)
  CAM.spriteMit = function (m, ph) {
    ph = ph == null ? -1 : ph;
    const base = CAM.sprite(m, ph);
    if (!m.wunden || !m.wunden.length) return base;
    const sig = m.fam + '-' + m.stufe + (m.glanz ? 's' : '') + (ph >= 0 ? 'w' + ph : '') + ':' + m.wunden.map(w => w.x + ',' + w.y + w.t[0] + w.r + w.v).join(';');
    if (mitCache[sig]) return mitCache[sig];
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const c = cv.getContext('2d'); c.drawImage(base, 0, 0);
    const ov = document.createElement('canvas'); ov.width = N; ov.height = N;
    const oc = ov.getContext('2d');
    m.wunden.forEach(w => stempel(oc, w));
    c.globalCompositeOperation = 'source-atop'; c.drawImage(ov, 0, 0);
    cv.maske = base.maske;
    if (Object.keys(mitCache).length > 80) for (const k of Object.keys(mitCache).slice(0, 40)) delete mitCache[k];
    return mitCache[sig] = cv;
  };

  // ---------- Menschen (Spieler und Trainer) ----------
  // Pixelfigur mit Umriss, Schattierung, Mütze oder Kapuze, Gürtel und Umhängetasche. 4 Blickrichtungen (0 oben, 1 rechts, 2 unten, 3 links)
  // und Laufschritt. Raster 16 x 24 plus Rand für den Umriss, wird wie die Mobs ohne Glättung vergrössert.
  const HAARE = ['#2a1c2e', '#5a3420', '#c9a24a', '#8e2f2f', '#d8d4cc'];
  const menschen = {};
  function mix(hex, k) {      // k > 0 heller, k < 0 dunkler
    const n = parseInt(hex.slice(1, 7), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
    const f = v => Math.round(v + (t - v) * a).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }
  function zeichneMensch(col, dir, frame, look) {
    const cv = document.createElement('canvas'); cv.width = 20; cv.height = 28;
    const c = cv.getContext('2d');
    const R = (x, y, w, h, f) => { c.fillStyle = f; c.fillRect(2 + x, 2 + y, w, h); };
    const sk = '#f1c9a0', skD = '#d49f78', hair = HAARE[look % HAARE.length], hairD = mix(hair, -0.35);
    const cl = col, clL = mix(col, 0.3), clD = mix(col, -0.35), clDD = mix(col, -0.55);
    const pant = '#2d2840', pantD = '#1f1b2e', boot = '#46321f', bootD = '#2a1d12', belt = '#5a3d28', gold = '#e8c04a';
    const bag = '#8a5c33', bagD = '#5d3d22', dark = '#1a1420';
    const kopf = look % 3;                       // 0 Mütze, 1 Kapuze, 2 nur Haare
    const bein = (x, hoch, breit) => {           // Bein + Stiefel, hoch = angehoben im Laufschritt
      R(x, 20, breit, hoch ? 1 : 2, pant); R(x, hoch ? 21 : 22, breit, 2, boot); R(x, hoch ? 22 : 23, breit, 1, bootD);
    };
    const links = frame === 1, rechts = frame === 2;
    if (dir === 2 || dir === 0) {
      const vorne = dir === 2;
      // Arme (hinter dem Rumpf)
      R(1, 11, 2, 6, clD); R(13, 11, 2, 6, clD); R(1, 17, 2, 2, sk); R(13, 17, 2, 2, sk);
      bein(4, links, 3); bein(9, rechts, 3);
      R(3, 11, 10, 8, cl); R(3, 11, 1, 8, clL); R(11, 11, 2, 8, clD); R(3, 18, 10, 1, clD);
      R(3, 17, 10, 1, belt);
      if (vorne) {
        R(5, 11, 6, 1, clL); R(7, 12, 2, 1, clD); R(7, 17, 2, 1, gold);
        for (let i = 0; i < 7; i++) R(4 + i, 11 + i, 1, 1, bag);       // Gurt der Tasche
        R(10, 16, 4, 3, bag); R(10, 16, 4, 1, bagD); R(11, 17, 1, 1, gold);
      } else {
        R(4, 12, 8, 6, bag); R(4, 12, 8, 1, bagD); R(7, 12, 2, 6, bagD); R(5, 16, 6, 1, bagD);
      }
      R(6, 10, 4, 1, skD);
      // Kopf
      R(4, 3, 8, 7, vorne ? sk : hair); if (vorne) R(4, 9, 8, 1, skD);
      if (kopf === 0) {                           // Mütze mit Schirm
        R(3, 1, 10, 4, cl); R(4, 1, 3, 1, clL); R(3, 4, 10, 1, clD); R(8, 0, 4, 1, cl);
        if (vorne) R(4, 5, 8, 1, clDD);
      } else if (kopf === 1) {                    // Kapuze
        R(2, 1, 12, 3, cl); R(3, 0, 8, 1, cl); R(2, 4, 3, 7, cl); R(11, 4, 3, 7, cl); R(2, 4, 1, 7, clL); R(13, 4, 1, 7, clD);
        R(5, 3, 6, 1, clDD); if (!vorne) R(5, 4, 6, 6, clD);
      } else {                                    // Haare
        R(3, 1, 10, 3, hair); R(4, 0, 6, 1, hair); R(3, 4, 2, vorne ? 4 : 6, hair); R(11, 4, 2, vorne ? 4 : 6, hair); R(5, 1, 3, 1, mix(hair, 0.25));
        if (vorne) R(5, 3, 6, 1, hairD);
      }
      if (vorne) { R(5, 6, 2, 2, dark); R(9, 6, 2, 2, dark); R(5, 6, 1, 1, '#fff'); R(9, 6, 1, 1, '#fff'); R(7, 8, 2, 1, '#b5755a'); }
    } else {
      const r = dir === 1;
      const X = (x, w) => r ? x : 16 - x - w;      // links = gespiegelt
      const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      // hinteres Bein / vorderes Bein
      R(X(5, 3) + (r ? -sw : sw), 20, 3, frame && sw < 0 ? 1 : 2, pantD); R(X(5, 3) + (r ? -sw : sw), frame && sw < 0 ? 21 : 22, 4, 2, bootD);
      R(X(8, 3) + (r ? sw : -sw), 20, 3, frame && sw > 0 ? 1 : 2, pant); R(X(8, 4) + (r ? sw : -sw), frame && sw > 0 ? 21 : 22, 5, 2, boot);
      R(X(4, 8), 11, 8, 8, cl); R(X(4, 1), 11, 1, 8, clL); R(X(11, 1), 11, 1, 8, clD); R(X(4, 8), 18, 8, 1, clD); R(X(4, 8), 17, 8, 1, belt);
      R(X(2, 4), 12, 4, 6, bag); R(X(2, 4), 12, 4, 1, bagD); R(X(2, 4), 17, 4, 1, bagD);     // Tasche am Rücken
      R(X(6, 4), 12 + (sw ? -sw : 0) * 0, 4, 6, clD); R(X(6, 4), 18 + (sw ? -sw : 0) * 0, 4, 1, sk);   // Arm
      R(X(8, 1), 17, 2, 1, gold);
      R(X(6, 3), 10, 3, 1, skD);
      R(X(5, 7), 3, 7, 7, sk); R(X(12, 1), 6, 1, 2, sk); R(X(5, 7), 9, 7, 1, skD);
      if (kopf === 0) { R(X(4, 9), 1, 9, 4, cl); R(X(5, 3), 1, 3, 1, clL); R(X(4, 9), 4, 9, 1, clD); R(X(11, 4), 4, 4, 1, clDD); R(X(8, 3), 0, 3, 1, cl); }
      else if (kopf === 1) { R(X(3, 11), 1, 11, 4, cl); R(X(5, 7), 0, 7, 1, cl); R(X(3, 6), 4, 6, 7, cl); R(X(3, 1), 4, 1, 7, clL); R(X(7, 3), 3, 3, 1, clDD); }
      else { R(X(4, 9), 1, 9, 3, hair); R(X(5, 5), 0, 5, 1, hair); R(X(4, 4), 4, 4, 5, hair); R(X(6, 3), 1, 3, 1, mix(hair, 0.25)); R(X(9, 3), 3, 3, 1, hairD); }
      R(X(10, 1), 6, 1, 2, dark); R(X(10, 1), 6, 1, 1, '#fff'); R(X(11, 2), 9, 2, 1, '#b5755a');
    }
    // Umriss
    const img = c.getImageData(0, 0, 20, 28), d = img.data, out = new Uint8ClampedArray(d.length); out.set(d);
    const at = (x, y) => (x < 0 || y < 0 || x >= 20 || y >= 28) ? 0 : d[(y * 20 + x) * 4 + 3];
    for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { const i = (y * 20 + x) * 4; out[i] = 14; out[i + 1] = 9; out[i + 2] = 20; out[i + 3] = 255; }
    }
    c.putImageData(new ImageData(out, 20, 28), 0, 0);
    return cv;
  }
  CAM.lookVon = function (txt) {
    let h = 7; txt = String(txt || '').replace(/[^A-Za-zÄÖÜäöü0-9]/g, '');
    for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
    return h % 30;
  };
  // x = Mitte, y = Boden (Füsse). ts = Kachelgrösse. gehen: Laufschritt aus tick
  CAM.zeichneMensch = function (ctx, x, y, ts, col, dir, gehen, tick, look) {
    const frame = gehen ? [1, 0, 2, 0][Math.floor(tick / 120) % 4] : 0;
    const key = col + '|' + dir + '|' + frame + '|' + look;
    const img = menschen[key] || (menschen[key] = zeichneMensch(col, dir, frame, look));
    const p = ts / 16 * 0.95, bob = gehen && frame === 0 ? -p * 0.5 : 0;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x - 10 * p), Math.round(y - 26 * p + bob), Math.round(20 * p), Math.round(28 * p));
    ctx.restore();
  };
})(window);
