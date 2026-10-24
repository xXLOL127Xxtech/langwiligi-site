'use strict';
// Catch a Mob – Mobs werden im Code als Pixelbilder gezeichnet (kein Bilder-Download nötig).
(function (G) {
  const CAM = G.CAM;
  const N = 40;               // Raster 40 x 40
  const cache = {};

  function draw(fam, stufe, glanz) {
    const f = CAM.FAMILIEN[fam];
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const c = cv.getContext('2d');
    const pal = f.pal.map(col => glanz ? shiny(col) : col);
    const P = { b: pal[0], d: pal[1], a: pal[2], e: pal[3] };
    const rnd = CAM.mulberry32(fam * 977 + stufe * 31);
    // Stufe 1..3 wird grösser, Riesen sind gross
    const s = f.legend ? 1.15 : [0.66, 0.85, 1.05][stufe - 1];
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    const ell = (cx, cy, rx, ry, col) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(x, y, col);
    };
    const tri = (x1, y1, x2, y2, x3, y3, col) => {   // gefülltes Dreieck
      const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
      for (let y = minY; y <= maxY; y++) for (let x = 0; x < N; x++) {
        const d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2), d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3), d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) px(x, y, col);
      }
    };
    const eye = (x, y, r) => { px(x, y, P.e); if (r) { px(x + 1, y, P.e); } };
    const o = f.opt || {};
    const base = 38;           // Standlinie

    switch (f.kind) {
      case 'quad': {     // Vierbeiner (Wolf, Bär, Hase)
        const bx = 18, by = base - 11 * s - 2;
        ell(bx, by, 11 * s, 6.5 * s, P.b);
        ell(bx - 2, by + 2, 8 * s, 3.5 * s, P.d);
        const hx = bx + 11 * s, hy = by - 4 * s;
        ell(hx, hy, 5.5 * s, 5 * s, P.b);
        ell(hx + 4 * s, hy + 1.5 * s, 3 * s, 2.2 * s, P.d);   // Schnauze
        if (o.ears === 'long') { ell(hx - 1, hy - 8 * s, 1.6 * s, 6 * s, P.b); ell(hx + 2, hy - 8 * s, 1.6 * s, 6 * s, P.a); }
        else if (o.ears === 'round') { ell(hx - 2, hy - 5 * s, 2 * s, 2 * s, P.b); ell(hx + 3, hy - 5 * s, 2 * s, 2 * s, P.b); }
        else { tri(hx - 4 * s, hy - 3 * s, hx - 2 * s, hy - 9 * s, hx, hy - 4 * s, P.b); tri(hx + 1, hy - 4 * s, hx + 3 * s, hy - 9 * s, hx + 5 * s, hy - 3 * s, P.b); }
        for (const lx of [bx - 8 * s, bx - 3 * s, bx + 4 * s, bx + 9 * s]) rect(lx, by + 4 * s, 3 * s + 1, base - (by + 4 * s), P.d);
        if (o.tail === 'flame') { ell(bx - 12 * s, by - 3 * s, 3 * s, 5 * s, P.a); ell(bx - 12 * s, by - 5 * s, 1.6 * s, 3.5 * s, P.e); }
        else if (o.tail === 'fluff') ell(bx - 12 * s, by - 1, 4 * s, 3.5 * s, P.a);
        if (o.mane) ell(hx - 4 * s, hy + 2 * s, 4 * s, 5 * s, P.a);
        if (stufe >= 2 || f.legend) { for (let i = 0; i < 4; i++) tri(bx - 8 * s + i * 5 * s, by - 6 * s, bx - 6 * s + i * 5 * s, by - 10 * s, bx - 4 * s + i * 5 * s, by - 6 * s, P.a); }
        eye(hx + 2, hy - 1, true);
        break;
      }
      case 'blob': {     // Geist / Schlammwesen mit zerfetztem Rand
        const cy = base - 12 * s - 1;
        ell(20, cy, 11 * s, 12 * s, P.b);
        ell(20, cy + 4 * s, 9 * s, 7 * s, P.d);
        for (let i = -3; i <= 3; i++) rect(20 + i * 3.3 * s, cy + 9 * s, 3 * s, (2 + ((i * i) % 3)) * s + 1, P.b);
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
        ell(12, by - 3 * s, 9 * s, 4 * s, P.d);                                            // Flügel
        for (let i = 0; i < 4; i++) tri(3 + i * 3, by - 3 * s, 4 + i * 3, by + 6 * s, 7 + i * 3, by - 1, P.d);
        if (stufe >= 2 || f.legend) { ell(10, by - 9 * s, 5 * s, 3 * s, P.b); for (let i = 0; i < 3; i++) tri(3 + i * 3, by - 9 * s, 4 + i * 3, by - 3 * s, 7 + i * 3, by - 7 * s, P.d); }
        rect(17, by + 6 * s, 2, base - (by + 6 * s), P.a); rect(22, by + 6 * s, 2, base - (by + 6 * s), P.a);
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
        for (let i = 0; i < 4; i++) { rect(20 - 7 * s + i * 4 * s, hy + 12 * s, 2, base - (hy + 12 * s), P.a); }
        if (f.opt && f.opt.big) for (let i = 0; i < 6; i++) ell(6 + i * 6, base - 4, 3, 3, P.a);
        break;
      }
      case 'wisp': {     // Flamme / Laterne
        const cy = base - 14 * s - 4;
        tri(20 - 8 * s, cy + 2, 20, cy - 16 * s, 20 + 8 * s, cy + 2, P.a);
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
        for (let i = 0; i < 14; i++) ell(12 - i * 0.95 * s - 1, by + 3 - Math.sin(i / 3) * 2 * s - i * 0.25, Math.max(0.8, (3.4 - i * 0.2) * s), Math.max(0.8, (3 - i * 0.18) * s), i % 3 === 2 ? P.d : P.b);
        // Beine
        for (const lx of [11, 24]) rect(lx * (0.85 + 0.15 * s), by + 4 * s, 3.2 * s + 1, base - (by + 4 * s), P.d);
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
          tri(12, by - 4 * s, 3, by - 20 * s, 24, by - 6 * s, P.d);
          tri(12, by - 4 * s, 8, by - 12 * s, 21, by - 6 * s, P.a);
          for (let i = 0; i < 3; i++) { c.fillStyle = P.b; c.fillRect(Math.round(12 + i * 3), Math.round(by - 5 * s - i * 5), 1, 6); }
        }
        eye(hx + 1.5 * s, hy - 1, true);
        break;
      }
      case 'crab': {
        const by = base - 7 * s - 3;
        ell(20, by, 12 * s, 6.5 * s, P.b);
        ell(20, by + 2, 10 * s, 3 * s, P.d);
        for (const dir of [-1, 1]) {
          ell(20 + dir * 14 * s, by - 6 * s, 5 * s, 5 * s, P.a);
          rect(20 + dir * 14 * s - 1, by - 12 * s, 2, 4, P.d);
          for (let i = 0; i < 3; i++) rect(20 + dir * (6 + i * 3) * s, by + 5 * s, 1, base - (by + 5 * s), P.d);
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
        rect(20 - 3 * s, sy + 8 * s - 1, 6 * s, 2, P.d);
        if (stufe >= 2) { rect(20 + 4 * s, sy - 2 * s, 2, 12 * s, P.d); tri(20 + 3 * s, sy - 2 * s, 20 + 5 * s, sy - 10 * s, 20 + 7 * s, sy - 2 * s, P.a); }
        if (stufe >= 3) { rect(20 - 9 * s, sy - 3 * s, 2, 10 * s, P.d); ell(20 - 8 * s, sy - 4 * s, 3 * s, 3 * s, P.b); }
        break;
      }
      case 'serpent': {
        const n = Math.round(14 * s) + 8;
        for (let i = n; i >= 0; i--) {
          const t = i / n, x = 6 + t * 26, y = base - 8 - Math.sin(t * 7) * 6 * s - t * 6;
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
        rect(20 - w / 2, base - 10 * s, w, 10 * s, P.b);                     // Beine/Sockel
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
        rect(20 - 5 * s, hy + 22 * s, 4 * s, base - (hy + 22 * s), P.d); rect(20 + 1 * s, hy + 22 * s, 4 * s, base - (hy + 22 * s), P.d);
        rect(20 - 10 * s, hy + 11 * s, 4 * s, 14 * s, P.d); rect(20 + 6 * s, hy + 11 * s, 4 * s, 14 * s, P.d);
        ell(20, hy + 5 * s, 6 * s, 6 * s, P.b);                       // Kopf
        eye(20 - 3 * s, hy + 4 * s, true); eye(20 + 2 * s, hy + 4 * s, true);
        if (o.horns) { tri(20 - 6 * s, hy + 2 * s, 20 - 8 * s, hy - 8 * s, 20 - 2 * s, hy + 1 * s, P.a); tri(20 + 2 * s, hy + 1 * s, 20 + 8 * s, hy - 8 * s, 20 + 6 * s, hy + 2 * s, P.a); }
        if (o.fire) { for (let i = 0; i < 5; i++) tri(20 - 8 * s + i * 4 * s, hy + 14 * s, 20 - 6 * s + i * 4 * s, hy + 6 * s - (i % 2) * 4, 20 - 4 * s + i * 4 * s, hy + 14 * s, P.a); }
        else if (stufe >= 2) { rect(20 - 7 * s, hy + 14 * s, 14 * s, 2, P.a); rect(20 - 1, hy + 10 * s, 2, 12 * s, P.a); }
        if (stufe >= 3 || f.legend) { tri(20 - 9 * s, hy + 12 * s, 20 - 16 * s, hy + 26 * s, 20 - 5 * s, hy + 24 * s, P.d); tri(20 + 9 * s, hy + 12 * s, 20 + 16 * s, hy + 26 * s, 20 + 5 * s, hy + 24 * s, P.d); }
        break;
      }
    }
    // Umriss (dunkel) – sorgt für den düsteren Comic-Look
    const img = c.getImageData(0, 0, N, N), d = img.data;
    const out = new Uint8ClampedArray(d.length); out.set(d);
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? 0 : d[(y * N + x) * 4 + 3];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        const i = (y * N + x) * 4; out[i] = 12; out[i + 1] = 8; out[i + 2] = 18; out[i + 3] = 255;
      }
    }
    c.putImageData(new ImageData(out, N, N), 0, 0);
    return cv;
  }

  function shiny(col) {   // Glanz-Variante: Farbkanäle tauschen und aufhellen
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
    const h = v => Math.min(255, Math.round(v * 1.1 + 20)).toString(16).padStart(2, '0');
    return '#' + h(b) + h(r) + h(g);
  }

  // Liefert das Bild eines Mobs (Zeichnung wird zwischengespeichert)
  CAM.sprite = function (m) {
    const key = m.fam + '-' + m.stufe + (m.glanz ? 's' : '');
    return cache[key] || (cache[key] = draw(m.fam, m.stufe, m.glanz));
  };
  CAM.spriteFam = function (fam, stufe, glanz) {
    const key = fam + '-' + stufe + (glanz ? 's' : '');
    return cache[key] || (cache[key] = draw(fam, stufe, glanz));
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
