'use strict';
// Catch a Mob – die Welt: Karte aus einer festen Zahl (Seed), Biome, Dörfer, Wetter, Tag und Nacht.
// Alle Spieler bauen aus demselben Seed dieselbe Karte, sie muss nicht übertragen werden.
(function (G) {
  const CAM = G.CAM;
  const W = 640, H = 640;          // das alte Kerngebiet mit den 8 Dörfern (eigene, lokale Koordinaten)
  // Die Welt ist jetzt riesig (4096 x 4096 Felder) und entsteht beim Laufen aus dem Seed: Der Kern liegt in der Mitte, rundherum werden
  // Stücke (Chunks) und Gebiete (Regionen) erst erzeugt, wenn du in die Nähe kommst. Jeder Spieler bekommt aus demselben Seed dieselbe Welt.
  const WB = 4096, OFF = 13 * 128, CHS = 64, RG = 128, NR = WB / RG;
  const T = { WASSER: 0, BODEN: 1, GRAS: 2, WEG: 3, BAUM: 4, FELS: 5, LAVA: 6, WAND: 7, TUER: 8, STEIN: 9, RUNE: 10, GRAB: 11, KRISTALL: 12, DACH: 13, SCHILD: 14 };
  const BLOCK = new Uint8Array(16); [T.WASSER, T.FELS, T.LAVA, T.WAND, T.TUER, T.STEIN, T.RUNE, T.GRAB, T.KRISTALL, T.DACH, T.SCHILD].forEach(i => BLOCK[i] = 1);
  const START = { x: 320 + OFF, y: 320 + OFF };
  const GEBAEUDE = { 1: { n: 'Heilhaus', wand: '#e9e0d0', dach: '#c0392b' }, 2: { n: 'Fangkugel-Laden', wand: '#c9d4e8', dach: '#2d5fa8' }, 3: { n: 'Mob-Händler', wand: '#e8d9a8', dach: '#a8801f' }, 6: { n: 'Arena', wand: '#ddd0f4', dach: '#6a2fc4' } };

  CAM.BIOME.forEach(b => { b.cx = Math.round(b.cx * 1.6); b.cy = Math.round(b.cy * 1.6); b.P = Object.assign({ obst: b.obst }, b.pal); });
  const Welt = CAM.Welt = { W: WB, H: WB, T, OFF, NR, RG, START, INNEN_R: 20, LV_DIST: 1800, bereit: false, dorf: [], dorfLoad: [], trainer: [], boss: [], arena: [], schilder: new Map(), sicher: [], seed: 1 };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function vn(x, y, sc, seed) {
    const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), h = CAM.hash2;
    return lerp(lerp(h(x0, y0, seed), h(x0 + 1, y0, seed), sx), lerp(h(x0, y0 + 1, seed), h(x0 + 1, y0 + 1, seed), sx), sy);
  }

  // ---------- Gelände: jedes Feld ergibt sich allein aus Seed und Koordinaten ----------
  let SEED = 1, ZB = 0, ZT = 0;
  const aussen = new Map();
  // Äussere Biom-Mittelpunkte: ein Punkt pro Rasterfeld (224 Felder), nie im Kerngebiet (lokale Koordinaten)
  function aussenMitte(gx, gy) {
    const key = (gx + 100) * 1000 + gy + 100;
    let m = aussen.get(key);
    if (m === undefined) {
      const hs = CAM.hash2, cx = (gx + 0.2 + 0.6 * hs(gx, gy, SEED + 101)) * 224, cy = (gy + 0.2 + 0.6 * hs(gx, gy, SEED + 102)) * 224;
      m = (cx > -90 && cx < W + 90 && cy > -90 && cy < H + 90) ? null : { cx, cy, id: Math.floor(hs(gx, gy, SEED + 103) * 8) };
      aussen.set(key, m);
    }
    return m;
  }
  // Setzt ZB (Biom) und ZT (Feldart) für ein Feld in Weltkoordinaten
  function zelle(gx, gy) {
    const B = CAM.BIOME, x = gx - OFF, y = gy - OFF;
    const wx = x + (vn(x, y, 26, SEED + 1) - 0.5) * 56, wy = y + (vn(x, y, 26, SEED + 2) - 0.5) * 56;
    let bi = 0, bd = 1e12;
    for (let i = 0; i < B.length; i++) { const dx = wx - B[i].cx, dy = wy - B[i].cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
    const ax = Math.floor(x / 224), ay = Math.floor(y / 224);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const m = aussenMitte(ax + i, ay + j);
      if (m) { const dx = wx - m.cx, dy = wy - m.cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = m.id; } }
    }
    const p = B[bi], hs = CAM.hash2, edge = Math.min(gx, gy, WB - 1 - gx, WB - 1 - gy);
    let t = T.BODEN;
    if (edge < 4 + vn(x, y, 7, SEED + 3) * 6) t = T.WASSER;
    else if (p.lava && vn(x, y, 11, SEED + 11) > p.lava) t = T.LAVA;
    else if (vn(x, y, 20, SEED + 4) < p.lake) t = T.WASSER;
    else {
      const tn = vn(x, y, 7, SEED + 6) * 0.6 + vn(x, y, 3, SEED + 7) * 0.4;
      if (tn > (p.tree || 0.74)) {
        const r = hs(x, y, SEED + 21);
        t = p.obst === 'fels' ? T.FELS : p.obst === 'grab' ? (r > 0.45 ? T.GRAB : T.BAUM) : p.obst === 'kristall' ? (r > 0.4 ? T.KRISTALL : T.FELS) : (p.obst === 'tanne' && r > 0.88) ? T.FELS : T.BAUM;
      } else {
        const gn = vn(x, y, 9, SEED + 8) * 0.7 + vn(x, y, 4, SEED + 9) * 0.3;
        if (gn > p.grass + 0.04) t = T.GRAS;
      }
    }
    ZB = bi; ZT = t;
  }

  // Dorf an eine Stelle setzen (set = Schreibfunktion des Kerns oder eines Chunks)
  function stampDorf(set, cx, cy) {
    for (let y = cy - 8; y <= cy + 6; y++) for (let x = cx - 9; x <= cx + 9; x++) set(x, y, T.BODEN, 0);
    for (let y = cy - 3; y <= cy + 4; y++) for (let x = cx - 7; x <= cx + 7; x++) set(x, y, T.WEG, 0);
    const haus = (x0, art) => {   // 3 breit, 3 hoch, Tür unten Mitte
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(x0 + i, cy - 6 + j, j === 0 ? T.DACH : (j === 2 && i === 1) ? T.TUER : T.WAND, art);
      set(x0 + 1, cy - 4, T.TUER, art);
    };
    haus(cx - 6, 1); haus(cx - 1, 2); haus(cx + 4, 3);
    set(cx, cy + 1, T.STEIN, 4);
    set(cx - 4, cy + 1, T.SCHILD, 10);   // Ranglistentafel
  }

  Welt.erzeugen = function (seed) {
    seed = (seed | 0) || 1; Welt.seed = seed; SEED = seed; aussen.clear(); regionen.clear(); chunks.clear(); lc = null; lck = -1;
    const tiles = new Uint8Array(W * H), biome = new Uint8Array(W * H), meta = new Uint8Array(W * H);
    const B = CAM.BIOME;
    const hs = CAM.hash2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      zelle(x + OFF, y + OFF);
      const idx = y * W + x; biome[idx] = ZB; tiles[idx] = ZT;
    }
    alt = { tiles, biome, meta };
    Welt.dorf = []; Welt.dorfLoad = []; Welt.trainer = []; Welt.boss = []; Welt.sicher = []; Welt.arena = []; Welt.schilder = new Map();

    const set = (x, y, t, m) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; tiles[i] = t; if (m !== undefined) meta[i] = m; };
    const fest = t => t === T.WAND || t === T.TUER || t === T.DACH || t === T.STEIN || t === T.RUNE || t === T.SCHILD;
    const strasse = (x1, y1, x2, y2) => {   // L-förmiger Weg, 2 Felder breit, mit leichter Welle
      let x = x1, y = y1, n = 0;
      const put = (px, py) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const i = (py + b) * W + px + a; if (px + a >= 0 && py + b >= 0 && px + a < W && py + b < H && !fest(tiles[i])) { tiles[i] = T.WEG; } } };
      while (x !== x2) { put(x, y + Math.round(Math.sin(n / 11) * 1.5)); x += x < x2 ? 1 : -1; n++; }
      while (y !== y2) { put(x + Math.round(Math.sin(n / 11) * 1.5), y); y += y < y2 ? 1 : -1; n++; }
    };

    // Dörfer
    for (const p of B) {
      const cx = p.cx, cy = p.cy;
      const d = { x: cx, y: cy, biome: p.id, nr: p.id, name: p.dorf, rect: { x1: cx - 9, y1: cy - 8, x2: cx + 9, y2: cy + 6 } };
      Welt.dorf.push(d); Welt.sicher.push(d.rect);
      stampDorf(set, cx, cy);
      // Gras und Blumen am Rand für etwas Leben bleiben aus dem Rechteck heraus
    }
    // Wege zum Startdorf
    const sd = Welt.dorf[0];
    for (const d of Welt.dorf) if (d !== sd) strasse(d.x, d.y + 2, sd.x, sd.y + 2);
    // Riesen-Arenen (Raid-Plätze)
    for (const p of B) {
      const d = Welt.dorf[p.id];
      let dx = d.x - sd.x, dy = d.y - sd.y; const len = Math.hypot(dx, dy);
      let ax, ay;
      if (!len) { ax = sd.x - 38; ay = sd.y - 18; }
      else { ax = Math.round(d.x + dx / len * CAM.BOSS[p.boss].dist); ay = Math.round(d.y + dy / len * CAM.BOSS[p.boss].dist); }
      ax = Math.max(14, Math.min(W - 15, ax)); ay = Math.max(14, Math.min(H - 15, ay));
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 30) set(ax + x, ay + y, (x * x + y * y > 18) ? T.WEG : T.BODEN, 0);
      set(ax, ay, T.RUNE, 5);
      strasse(ax, ay + 6, d.x + 8, d.y + 6 > H ? d.y : d.y + 3);
      const lv = Math.min(100, Welt.wildLevel(ax + OFF, ay + OFF) + 10);
      Welt.boss.push({ x: ax, y: ay, biome: p.id, idx: p.boss, lv, key: p.boss });
      Welt.sicher.push({ x1: ax - 1, y1: ay - 1, x2: ax + 1, y2: ay + 1, nurSicherRand: true });
    }
    // Trainer
    const rnd = CAM.mulberry32(seed * 7 + 5);
    let id = 0;
    for (const p of B) {
      let n = 0, tries = 0;
      while (n < 6 && tries++ < 700) {
        const x = 12 + Math.floor(rnd() * (W - 24)), y = 12 + Math.floor(rnd() * (H - 24));
        const i = y * W + x;
        if (biome[i] !== p.id || (tiles[i] !== T.BODEN && tiles[i] !== T.GRAS)) continue;
        if (Welt.istSicher(x, y, 6)) continue;
        if (Welt.trainer.some(t => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) continue;
        const lv = Math.min(98, Welt.wildLevel(x + OFF, y + OFF) + 1);
        const r2 = rnd();
        Welt.trainer.push({
          id: id++, x, y, biome: p.id, lv, dir: Math.floor(rnd() * 4), anz: lv < 8 ? 1 + (r2 > 0.6 ? 1 : 0) : lv < 16 ? 2 : 3,
          name: CAM.TRAINER_VORNAMEN[Math.floor(rnd() * CAM.TRAINER_VORNAMEN.length)] + ' der ' + CAM.TRAINER_TITEL[Math.floor(rnd() * CAM.TRAINER_TITEL.length)],
          farbe: CAM.FARBEN[Math.floor(rnd() * CAM.FARBEN.length)], seed: Math.floor(rnd() * 1e9),
        });
        // Feld unter dem Trainer frei halten
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (tiles[(y + b) * W + x + a] !== T.WASSER && !BLOCK[tiles[(y + b) * W + x + a]]) { /* frei */ } else if (a === 0 && b === 0) { tiles[i] = T.BODEN; }
        n++;
      }
    }
    // Arenen: acht Stück auf festen Stufen, grob nach Stufe weiter weg vom Start, sonst zufällig verteilt
    const ra = CAM.mulberry32(seed * 11 + 29), baseA = ra() * 6.283;
    CAM.ARENEN.forEach((def, i) => {
      for (let tries = 0; tries < 3000; tries++) {
        const ang = baseA + i * 2.4 + (ra() - 0.5) * (tries > 1000 ? 6.3 : 0.9), dist = 55 + i * 33 + (ra() - 0.5) * (tries > 1500 ? 90 : 24);
        const cx = Math.round(START.x - OFF + Math.cos(ang) * dist), cy = Math.round(START.y - OFF + Math.sin(ang) * dist);
        if (cx < 16 || cy < 16 || cx > W - 17 || cy > H - 17) continue;
        if (Welt.dorf.some(d => Math.hypot(d.x - cx, d.y - cy) < 28) || Welt.boss.some(b => Math.hypot(b.x - cx, b.y - cy) < 22) || Welt.arena.some(a => Math.hypot(a.cx - cx, a.cy - cy) < 45)) continue;
        let nass = 0; for (let y = -4; y <= 5; y++) for (let x = -5; x <= 5; x++) { const t = tiles[(cy + y) * W + cx + x]; if (t === T.WASSER || t === T.LAVA) nass++; }
        if (nass > 18) continue;
        for (let y = -4; y <= 5; y++) for (let x = -5; x <= 5; x++) set(cx + x, cy + y, (y >= 1 && Math.abs(x) <= 1) ? T.WEG : T.BODEN, 0);
        for (let j = 0; j < 3; j++) for (let k = -2; k <= 2; k++) set(cx + k, cy - 3 + j, j === 0 ? T.DACH : (j === 2 && k === 0) ? T.TUER : T.WAND, 6);
        Welt.sicher.push({ x1: cx - 7, y1: cy - 6, x2: cx + 7, y2: cy + 7 });
        Welt.arena.push({ idx: i, x: cx, y: cy - 1, cx, cy, lv: def.lv, el: def.el, leitung: CAM.TRAINER_VORNAMEN[Math.floor(ra() * CAM.TRAINER_VORNAMEN.length)], seed: Math.floor(ra() * 1e9) });
        break;
      }
    });
    // Wegweiser: entlang der Wege zwischen den Dörfern, zeigen zum nächsten Dorf
    const rs = CAM.mulberry32(seed * 17 + 41), frei = (x, y) => { const t = tiles[y * W + x]; return (t === T.BODEN || t === T.GRAS || t === T.WEG) && !Welt.istSicher(x, y, 1); };
    const platz = (x0, y0) => {
      for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) {
        const x = Math.round(x0 + (rs() - 0.5) * 2 * r), y = Math.round(y0 + (rs() - 0.5) * 2 * r);
        if (x < 4 || y < 4 || x > W - 5 || y > H - 5) continue;
        if (frei(x, y) && frei(x + 1, y) && frei(x - 1, y) && frei(x, y + 1) && frei(x, y - 1)) return [x, y];
      }
      return null;
    };
    const schilder = [];
    for (const d of Welt.dorf) {
      const ziele = Welt.dorf.filter(o => o !== d).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y)).slice(0, 2);
      if (d !== sd) ziele.push(sd);
      for (const z of new Set(ziele)) {
        const len = Math.hypot(z.x - d.x, z.y - d.y), ux = (z.x - d.x) / len, uy = (z.y - d.y) / len;
        for (let dist = 14; dist < len - 14; dist += 46) {
          const pos = platz(d.x + ux * dist, d.y + uy * dist);
          if (pos && !schilder.some(q => Math.hypot(q[0] - pos[0], q[1] - pos[1]) < 18)) schilder.push(pos);
        }
      }
    }
    for (const [x, y] of schilder) {
      const nah = Welt.dorf.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      set(x, y, T.SCHILD, 9); Welt.schilder.set(y * W + x, Math.atan2(nah.y - y, nah.x - x));
    }
    // Kerngebiet in Weltkoordinaten umrechnen (alles bisher war lokal)
    Welt.dorf.forEach(d => { d.x += OFF; d.y += OFF; d.rect.x1 += OFF; d.rect.x2 += OFF; d.rect.y1 += OFF; d.rect.y2 += OFF; });
    Welt.sicher.forEach(r => { r.x1 += OFF; r.x2 += OFF; r.y1 += OFF; r.y2 += OFF; });
    Welt.trainer.forEach(t => { t.x += OFF; t.y += OFF; });
    Welt.boss.forEach(b => { b.x += OFF; b.y += OFF; });
    Welt.arena.forEach(a => { a.x += OFF; a.y += OFF; a.cx += OFF; a.cy += OFF; });
    const sm = new Map(); Welt.schilder.forEach((v, k) => sm.set((Math.floor(k / W) + OFF) * WB + (k % W) + OFF, v)); Welt.schilder = sm;
    Welt.bereit = true;
    Welt.karteBauen();
  };

  // ---------- Zugriff auf Felder: Kern (feste Tabelle) oder Chunk (wird bei Bedarf erzeugt) ----------
  let alt = null, lc = null, lck = -1;
  const chunks = new Map();
  function chunkAt(x, y) {
    const key = (y >> 6) * 64 + (x >> 6);
    if (key === lck) return lc;
    let c = chunks.get(key);
    if (!c) c = baueChunk(x >> 6, y >> 6);
    lck = key; lc = c;
    return c;
  }
  Welt.get = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= WB || y >= WB) return T.WASSER;
    const lx = x - OFF, ly = y - OFF;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) return alt.tiles[ly * W + lx];
    return chunkAt(x, y).t[((y & 63) << 6) | (x & 63)];
  };
  Welt.metaAt = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= WB || y >= WB) return 0;
    const lx = x - OFF, ly = y - OFF;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) return alt.meta[ly * W + lx];
    return chunkAt(x, y).m[((y & 63) << 6) | (x & 63)];
  };
  Welt.biomeAt = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= WB || y >= WB) return 0;
    const lx = x - OFF, ly = y - OFF;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) return alt.biome[ly * W + lx];
    return chunkAt(x, y).b[((y & 63) << 6) | (x & 63)];
  };
  Welt.blockiert = (x, y, schwimm) => { const t = Welt.get(Math.floor(x), Math.floor(y)); return BLOCK[t] === 1 && !(schwimm && t === T.WASSER); };
  Welt.istWasser = (x, y) => Welt.get(Math.floor(x), Math.floor(y)) === T.WASSER;

  // ---------- Gebiete (Regionen, 128 x 128): Dörfer, Trainer und Riesen-Arenen weit draussen ----------
  const regionen = new Map();
  const D_VOR = ['Birken', 'Eichen', 'Stein', 'Nebel', 'Rabe', 'Silber', 'Moos', 'Falken', 'Wolfs', 'Bären', 'Salz', 'Rauch', 'Dorn', 'Licht', 'Eisen', 'Mond', 'Sturm', 'Fuchs', 'Kupfer', 'Distel'];
  const D_NACH = ['hain', 'furt', 'bach', 'stein', 'heim', 'dorf', 'brück', 'tal', 'rast', 'wacht', 'feld', 'hof', 'sprung', 'winkel', 'ruh'];
  function region(rx, ry) {
    if (rx < 0 || ry < 0 || rx >= NR || ry >= NR) return { rx, ry, dorf: null, trainer: [], boss: null, sicher: [], stempel: [], geladen: false, leer: true };
    const key = ry * NR + rx;
    let R = regionen.get(key);
    if (R) return R;
    R = { rx, ry, key, dorf: null, trainer: [], boss: null, sicher: [], stempel: [], geladen: false };
    regionen.set(key, R);
    const x0 = rx * RG, y0 = ry * RG;
    if (x0 >= OFF && x0 < OFF + W && y0 >= OFF && y0 < OFF + H) return R;   // das ist das Kerngebiet
    const rnd = CAM.mulberry32(SEED * 131 + key * 7919 + 17);
    const land = () => ZT === T.BODEN || ZT === T.GRAS || ZT === T.WEG;
    const frei = (x, y) => { zelle(x, y); return land(); };
    // Dorf
    if (rnd() < 0.42) {
      for (let v = 0; v < 14; v++) {
        const cx = x0 + 30 + Math.floor(rnd() * (RG - 60)), cy = y0 + 30 + Math.floor(rnd() * (RG - 60));
        zelle(cx, cy);
        if (ZT === T.WASSER || ZT === T.LAVA) continue;
        const n = Math.floor(rnd() * D_VOR.length), m = Math.floor(rnd() * D_NACH.length);
        R.dorf = { x: cx, y: cy, biome: ZB, nr: 8 + key, aussen: true, name: D_VOR[n] + D_NACH[m], rect: { x1: cx - 9, y1: cy - 8, x2: cx + 9, y2: cy + 6 } };
        R.sicher.push(R.dorf.rect); R.stempel.push(set => stampDorf(set, cx, cy));
        break;
      }
    }
    // Riesen-Arena (selten, stark)
    if (rnd() < 0.16) {
      for (let v = 0; v < 14; v++) {
        const ax = x0 + 24 + Math.floor(rnd() * (RG - 48)), ay = y0 + 24 + Math.floor(rnd() * (RG - 48));
        if (R.dorf && Math.hypot(R.dorf.x - ax, R.dorf.y - ay) < 40) continue;
        if (!frei(ax, ay)) continue;
        const bi = ZB;
        R.boss = { x: ax, y: ay, biome: bi, idx: bi, lv: Math.min(100, Welt.wildLevel(ax, ay) + 10), key: 'o' + key };
        R.sicher.push({ x1: ax - 1, y1: ay - 1, x2: ax + 1, y2: ay + 1, nurSicherRand: true });
        R.stempel.push(set => {
          for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 30) set(ax + x, ay + y, (x * x + y * y > 18) ? T.WEG : T.BODEN, 0);
          set(ax, ay, T.RUNE, 5);
        });
        break;
      }
    }
    // Trainer: mehr als im Kern
    const ziel = 3 + Math.floor(rnd() * 4);
    for (let v = 0, n = 0; n < ziel && v < 80; v++) {
      const x = x0 + 12 + Math.floor(rnd() * (RG - 24)), y = y0 + 12 + Math.floor(rnd() * (RG - 24));
      if (!frei(x, y) || ZT === T.WEG) continue;
      const bi = ZB;
      if (R.dorf && x > R.dorf.rect.x1 - 8 && x < R.dorf.rect.x2 + 8 && y > R.dorf.rect.y1 - 8 && y < R.dorf.rect.y2 + 8) continue;
      if (R.boss && Math.hypot(R.boss.x - x, R.boss.y - y) < 12) continue;
      if (R.trainer.some(t => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) continue;
      const lv = Math.min(98, Welt.wildLevel(x, y) + 1), r2 = rnd();
      R.trainer.push({
        id: 1000 + key * 8 + n, x, y, biome: bi, lv, dir: Math.floor(rnd() * 4), anz: lv < 8 ? 1 + (r2 > 0.6 ? 1 : 0) : lv < 16 ? 2 : 3,
        name: CAM.TRAINER_VORNAMEN[Math.floor(rnd() * CAM.TRAINER_VORNAMEN.length)] + ' der ' + CAM.TRAINER_TITEL[Math.floor(rnd() * CAM.TRAINER_TITEL.length)],
        farbe: CAM.FARBEN[Math.floor(rnd() * CAM.FARBEN.length)], seed: Math.floor(rnd() * 1e9),
      });
      R.stempel.push(set => set(x, y, T.BODEN));
      n++;
    }
    return R;
  }
  function regionLaden(R) {
    if (R.geladen || R.leer) return; R.geladen = true;
    R.trainer.forEach(t => Welt.trainer.push(t));
    if (R.boss) Welt.boss.push(R.boss);
    R.sicher.forEach(r => Welt.sicher.push(r));
    if (R.dorf) Welt.dorfLoad.push(R.dorf);
  }
  function regionEntladen(R) {
    R.geladen = false;
    const ts = new Set(R.trainer), ss = new Set(R.sicher);
    Welt.trainer = Welt.trainer.filter(t => !ts.has(t));
    if (R.boss) Welt.boss = Welt.boss.filter(b => b !== R.boss);
    Welt.sicher = Welt.sicher.filter(r => !ss.has(r));
    if (R.dorf) Welt.dorfLoad = Welt.dorfLoad.filter(d => d !== R.dorf);
  }
  // Dorf mit dieser Nummer (0 bis 7 = Kern, danach die äusseren Dörfer); gibt es keines, das Startdorf
  Welt.dorfNr = function (nr) {
    if (nr < 8) return Welt.dorf[nr] || Welt.dorf[0];
    const k = nr - 8, R = region(k % NR, Math.floor(k / NR));
    return R.dorf || Welt.dorf[0];
  };
  Welt.alleDoerfer = () => Welt.dorf.concat(Welt.dorfLoad);
  const imRechteck = (d, x, y) => x >= d.rect.x1 && x <= d.rect.x2 && y >= d.rect.y1 && y <= d.rect.y2;
  Welt.dorfAnPos = function (x, y) {   // wie dorfBei, aber auch für Gegenden, die gerade nicht geladen sind
    const k = Welt.dorf.find(d => imRechteck(d, x, y));
    if (k) return k;
    const R = region(Math.floor(x / RG), Math.floor(y / RG));
    return R.dorf && imRechteck(R.dorf, x, y) ? R.dorf : null;
  };
  Welt.dorfMax = 8 + NR * NR;

  // ---------- Chunks (64 x 64) ----------
  function baueChunk(cx, cy) {
    const c = { t: new Uint8Array(CHS * CHS), b: new Uint8Array(CHS * CHS), m: new Uint8Array(CHS * CHS), cx, cy };
    const gx0 = cx * CHS, gy0 = cy * CHS;
    for (let j = 0; j < CHS; j++) for (let i = 0; i < CHS; i++) { zelle(gx0 + i, gy0 + j); c.t[j * CHS + i] = ZT; c.b[j * CHS + i] = ZB; }
    const R = region(cx >> 1, cy >> 1);
    const set = (x, y, t, m) => { const i = x - gx0, j = y - gy0; if (i < 0 || j < 0 || i >= CHS || j >= CHS) return; c.t[j * CHS + i] = t; if (m !== undefined) c.m[j * CHS + i] = m; };
    R.stempel.forEach(st => st(set));
    chunks.set(cy * 64 + cx, c);
    kartenFleck(c);
    return c;
  }
  // Wird jeden Takt aufgerufen: nahe Gebiete laden, ferne wieder vergessen (die Welt ist ja aus dem Seed jederzeit neu erzeugbar)
  Welt.aktualisieren = function (px, py) {
    const rx = Math.floor(px / RG), ry = Math.floor(py / RG);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) regionLaden(region(rx + dx, ry + dy));
    for (const R of regionen.values()) if (R.geladen && (Math.abs(R.rx - rx) > 2 || Math.abs(R.ry - ry) > 2)) regionEntladen(R);
    pcx = Math.floor(px / CHS); pcy = Math.floor(py / CHS);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = chunks.get((pcy + dy) * 64 + pcx + dx); if (c && !c.gemalt) kartenFleck(c); }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {   // höchstens ein neues Stück pro Takt, damit es nicht ruckelt
      const x = pcx + dx, y = pcy + dy;
      if (x >= 0 && y >= 0 && x < 64 && y < 64 && !chunks.has(y * 64 + x) && !(x * CHS >= OFF && x * CHS < OFF + W && y * CHS >= OFF && y * CHS < OFF + H)) { baueChunk(x, y); dy = 2; break; }
    }
    if (chunks.size > 120) for (const [k, c] of chunks) if (Math.abs(c.cx - pcx) > 4 || Math.abs(c.cy - pcy) > 4) { chunks.delete(k); if (k === lck) { lc = null; lck = -1; } }
  };

  Welt.istSicher = function (x, y, rand) {
    rand = rand || 0;
    return Welt.sicher.some(r => !r.nurSicherRand && x >= r.x1 - rand && x <= r.x2 + rand && y >= r.y1 - rand && y <= r.y2 + rand);
  };
  Welt.wildLevel = function (x, y, r) {
    const d = Math.hypot(x - START.x, y - START.y);
    const n = r !== undefined ? r : CAM.hash2(Math.floor(x), Math.floor(y), 9);
    // Innen (bis 20 Felder um den Start) Stufe 3 bis 5, damit du am Anfang gewinnen kannst. Danach ab Stufe 6 und ganz langsam mehr:
    // nach 100 Feldern etwa Stufe 8, nach 500 etwa Stufe 22, nach 1000 etwa Stufe 48, nach 1500 etwa Stufe 79. Stufe 100 gibt es erst ganz aussen (ab 1800 Feldern).
    if (d <= Welt.INNEN_R) return 3 + Math.min(2, Math.floor(n * 3));
    const t = Math.min(1, (d - Welt.INNEN_R) / (Welt.LV_DIST - Welt.INNEN_R));
    return Math.max(6, Math.min(100, Math.round(6 + 94 * Math.pow(t, 1.35) + (n - 0.5) * 2)));
  };

  // Was steht neben dem Feld? Gibt { x, y, meta, t } für Dinge zum Ansprechen zurück (Türen, Wegstein, Rune)
  Welt.ansprechbar = function (px, py, dir) {
    const ox = [0, 1, 0, -1], oy = [-1, 0, 1, 0];
    const fx = Math.floor(px), fy = Math.floor(py);
    const cand = [];
    for (let k = 0; k < 4; k++) { const d = (dir + k) % 4; cand.push([fx + ox[d], fy + oy[d]]); }
    cand.push([fx + 1, fy + 1], [fx - 1, fy + 1], [fx + 1, fy - 1], [fx - 1, fy - 1]);
    for (const [x, y] of cand) {
      const t = Welt.get(x, y);
      if (t === T.TUER || t === T.STEIN || t === T.RUNE || t === T.SCHILD) return { x, y, t, meta: Welt.metaAt(x, y) };
    }
    return null;
  };
  Welt.dorfBei = function (x, y) { return Welt.alleDoerfer().find(d => x >= d.rect.x1 && x <= d.rect.x2 && y >= d.rect.y1 && y <= d.rect.y2) || null; };

  // ---------- Wetter, Tag und Nacht, Jahreszeit (alles aus der Uhr berechnet) ----------
  CAM.wetterBei = function (biome, now) {
    const slot = Math.floor(now / CAM.WETTER_DAUER);
    const w = CAM.BIOME[biome].wetter, keys = Object.keys(w);
    let sum = 0; keys.forEach(k => sum += w[k]);
    let r = CAM.hash2(slot, biome, 77) * sum;
    for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
    return keys[0];
  };
  CAM.tageslicht = function (now) {
    const t = (now % CAM.TAG_DAUER) / CAM.TAG_DAUER;
    return Math.max(0, Math.min(1, 0.5 + 0.75 * Math.sin(2 * Math.PI * (t - 0.25))));
  };
  CAM.tageszeit = function (now) {
    const t = (now % CAM.TAG_DAUER) / CAM.TAG_DAUER;
    return t < 0.18 ? 'Nacht' : t < 0.3 ? 'Morgen' : t < 0.7 ? 'Tag' : t < 0.82 ? 'Abend' : 'Nacht';
  };
  CAM.saison = now => Math.floor(now / CAM.SAISON_DAUER) % 4;

  // ---------- Zeichnen ----------
  const h2 = CAM.hash2;
  function bodenFarbe(p, h) { return h < 0.28 ? p.g2 : p.g1; }

  function zeichneFeld(c, tx, ty, sx, sy, S, t, p, tick, pm) {
    const h = h2(tx, ty, 1), hb = h2(tx, ty, 2);
    const u = S / 16;
    const boden = () => { c.fillStyle = bodenFarbe(p, h); c.fillRect(sx, sy, S + 1, S + 1); };
    switch (t) {
      case T.BODEN:
        boden();
        for (let i = 0; i < 7; i++) { const hh = h2(tx * 7 + i, ty, 31); c.fillStyle = hh > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'; c.fillRect(sx + h2(tx, ty * 5 + i, 32) * 14 * u, sy + h2(tx + i, ty, 33) * 14 * u, 2 * u, 1 * u); }
        if (hb > 0.93) { c.fillStyle = p.deco; if (pm === 4) { c.globalAlpha = 0.5; c.fillStyle = p.w; c.fillRect(sx + 3 * u, sy + 8 * u, 8 * u, 3 * u); c.globalAlpha = 1; } else c.fillRect(sx + (h * 10 + 2) * u, sy + (hb * 20 - 17) * u + 8 * u, 2 * u, 2 * u); }
        else if (hb < 0.06) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(sx + 4 * u, sy + 10 * u, 5 * u, 2 * u); }
        break;
      case T.GRAS: {
        c.fillStyle = p.gr; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(sx, sy + 12 * u, S + 1, 4 * u);
        const sw = Math.sin(tick / 520 + tx * 0.8 + ty * 0.3) * u * 0.9;
        if (hb > 0.7) { c.fillStyle = p.deco; c.fillRect(sx + (h * 9 + 2) * u, sy + (hb * 8 + 3) * u, 1.5 * u, 1.5 * u); c.fillStyle = '#ffe680'; c.fillRect(sx + (h * 9 + 2.4) * u, sy + (hb * 8 + 3.4) * u, 0.7 * u, 0.7 * u); }
        for (let i = 0; i < 8; i++) {
          const bx = sx + (i * 2 + 0.5 + h * 1.5) * u, by = sy + (6 + ((i * 7 + tx) % 5) * 2) * u;
          c.fillStyle = i % 2 ? p.gr2 : p.gr;
          c.fillRect(bx + sw, by - 4 * u, 1.6 * u, 6 * u);
          c.fillStyle = p.gr2; c.fillRect(bx + sw * 1.4, by - 5 * u, 1.6 * u, 2 * u);
        }
        break;
      }
      case T.WEG:
        c.fillStyle = p.path; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.10)'; if (h > 0.5) c.fillRect(sx + (h * 8) * u, sy + (hb * 10) * u, 3 * u, 2 * u);
        c.fillStyle = 'rgba(255,255,255,0.08)'; if (hb > 0.6) c.fillRect(sx + (hb * 9) * u, sy + (h * 10 + 3) * u, 2 * u, 2 * u);
        break;
      case T.WASSER: {
        c.fillStyle = p.w; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(sx, sy + 8 * u, S + 1, 8 * u);
        const o = (tick / 700 + tx * 0.6 + ty * 0.9);
        c.fillStyle = p.w2; c.globalAlpha = 0.35;
        c.fillRect(sx + (4 + Math.sin(o) * 3) * u, sy + (4 + h * 6) * u, 6 * u, 1.2 * u);
        c.fillRect(sx + (2 + Math.cos(o * 0.8) * 3) * u, sy + (11 + hb * 3) * u, 5 * u, 1.2 * u);
        c.globalAlpha = 1;
        break;
      }
      case T.LAVA: {
        c.fillStyle = p.w; c.fillRect(sx, sy, S + 1, S + 1);
        const o = Math.sin(tick / 400 + tx * 1.3 + ty) * 0.5 + 0.5;
        c.fillStyle = p.w2; c.globalAlpha = 0.45 + o * 0.4;
        c.fillRect(sx + (3 + h * 6) * u, sy + (3 + hb * 6) * u, (4 + o * 3) * u, 3 * u);
        c.globalAlpha = 1;
        break;
      }
      case T.BAUM: {
        boden();
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(sx + 8 * u, sy + 14 * u, 6 * u, 2 * u, 0, 0, 6.3); c.fill();
        const obst = p.obst, sway = Math.sin(tick / 900 + tx) * u * 0.5;
        if (obst === 'tanne') {
          c.fillStyle = p.trunk; c.fillRect(sx + 7 * u, sy + 11 * u, 2 * u, 4 * u);
          for (let k = 0; k < 3; k++) { c.fillStyle = p.tr; c.beginPath(); c.moveTo(sx + 8 * u + sway, sy + (1 + k * 3.5) * u); c.lineTo(sx + (13 - k * 0.5) * u, sy + (7 + k * 3.4) * u); c.lineTo(sx + (3 + k * 0.5) * u, sy + (7 + k * 3.4) * u); c.fill(); c.fillStyle = p.tr2; c.fillRect(sx + (6.5 - k * 0.3) * u, sy + (2 + k * 3.5) * u, 3 * u, 1.4 * u); }
        } else if (obst === 'palme') {
          c.fillStyle = p.trunk; c.fillRect(sx + 7 * u + sway, sy + 5 * u, 2 * u, 10 * u);
          c.fillStyle = p.tr; for (let k = 0; k < 5; k++) { const a = k * 1.26 - 1.2; c.beginPath(); c.moveTo(sx + 8 * u + sway, sy + 5 * u); c.lineTo(sx + 8 * u + Math.cos(a) * 7 * u + sway, sy + 5 * u + Math.sin(a) * 3 * u + 2 * u); c.lineTo(sx + 8 * u + Math.cos(a) * 3 * u, sy + 5 * u + Math.sin(a) * 1.5 * u + 3 * u); c.fill(); }
        } else if (obst === 'totbaum' || obst === 'grab') {
          c.strokeStyle = p.trunk; c.lineWidth = Math.max(1, 1.6 * u);
          c.beginPath(); c.moveTo(sx + 8 * u, sy + 15 * u); c.lineTo(sx + 8 * u + sway, sy + 4 * u);
          c.moveTo(sx + 8 * u, sy + 10 * u); c.lineTo(sx + 3 * u, sy + 5 * u); c.moveTo(sx + 8 * u, sy + 8 * u); c.lineTo(sx + 13 * u, sy + 3 * u); c.moveTo(sx + 3 * u, sy + 5 * u); c.lineTo(sx + 2 * u, sy + 2 * u);
          c.stroke();
          c.fillStyle = p.tr2; c.globalAlpha = 0.6; c.fillRect(sx + 1 * u, sy + 1 * u, 3 * u, 2 * u); c.fillRect(sx + 11 * u, sy + 1 * u, 3 * u, 2 * u); c.globalAlpha = 1;
        } else {
          c.fillStyle = p.trunk; c.fillRect(sx + 7 * u, sy + 9 * u, 2 * u, 6 * u);
          c.fillStyle = '#10180e'; c.beginPath(); c.arc(sx + 8 * u + sway, sy + 6 * u, 6.8 * u, 0, 6.3); c.fill();
          c.fillStyle = p.tr; c.beginPath(); c.arc(sx + 8 * u + sway, sy + 6 * u, 6 * u, 0, 6.3); c.fill();
          c.fillStyle = p.tr; c.beginPath(); c.arc(sx + 4 * u + sway, sy + 8 * u, 3.4 * u, 0, 6.3); c.arc(sx + 12 * u + sway, sy + 8 * u, 3.4 * u, 0, 6.3); c.fill();
          c.fillStyle = p.tr2; c.beginPath(); c.arc(sx + 6 * u + sway, sy + 4.5 * u, 3.5 * u, 0, 6.3); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 4; k++) c.fillRect(sx + (4 + k * 2.3 + h) * u + sway, sy + (3 + (k % 2) * 3) * u, 1.4 * u, 1 * u);
          c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.arc(sx + 10 * u + sway, sy + 8 * u, 3 * u, 0, 6.3); c.fill();
        }
        break;
      }
      case T.FELS:
        boden();
        c.fillStyle = '#5c5a60'; c.beginPath(); c.moveTo(sx + 2 * u, sy + 14 * u); c.lineTo(sx + 4 * u, sy + 5 * u); c.lineTo(sx + 9 * u, sy + 3 * u); c.lineTo(sx + 14 * u, sy + 8 * u); c.lineTo(sx + 14 * u, sy + 14 * u); c.fill();
        c.fillStyle = '#7a787f'; c.beginPath(); c.moveTo(sx + 4 * u, sy + 5 * u); c.lineTo(sx + 9 * u, sy + 3 * u); c.lineTo(sx + 8 * u, sy + 9 * u); c.lineTo(sx + 3 * u, sy + 11 * u); c.fill();
        break;
      case T.GRAB:
        boden();
        c.fillStyle = '#8a8798'; c.beginPath(); c.moveTo(sx + 4 * u, sy + 15 * u); c.lineTo(sx + 4 * u, sy + 6 * u); c.arc(sx + 8 * u, sy + 6 * u, 4 * u, Math.PI, 0); c.lineTo(sx + 12 * u, sy + 15 * u); c.fill();
        c.fillStyle = '#2a2838'; c.fillRect(sx + 7.3 * u, sy + 4 * u, 1.4 * u, 6 * u); c.fillRect(sx + 5.6 * u, sy + 5.8 * u, 4.8 * u, 1.4 * u);
        break;
      case T.KRISTALL: {
        boden();
        const pulse = 0.75 + Math.sin(tick / 600 + tx * 2 + ty) * 0.25;
        c.globalAlpha = pulse; c.fillStyle = p.tr2;
        c.beginPath(); c.moveTo(sx + 8 * u, sy + 1 * u); c.lineTo(sx + 12 * u, sy + 8 * u); c.lineTo(sx + 9 * u, sy + 15 * u); c.lineTo(sx + 5 * u, sy + 15 * u); c.lineTo(sx + 4 * u, sy + 8 * u); c.fill();
        c.fillStyle = '#ffffff'; c.globalAlpha = pulse * 0.5; c.fillRect(sx + 7 * u, sy + 3 * u, 1.5 * u, 6 * u);
        c.globalAlpha = 1;
        break;
      }
      case T.DACH: {
        const g = GEBAEUDE[pm] || GEBAEUDE[1];
        c.fillStyle = g.dach; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < 4; k++) c.fillRect(sx, sy + (k * 4 + 3) * u, S + 1, 1.2 * u);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(sx, sy, S + 1, 2 * u);
        break;
      }
      case T.WAND: {
        const g = GEBAEUDE[pm] || GEBAEUDE[1];
        c.fillStyle = g.wand; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(sx, sy + 12 * u, S + 1, 4 * u);
        c.fillStyle = '#3a4a68'; c.fillRect(sx + 4 * u, sy + 3 * u, 8 * u, 6 * u); c.fillStyle = '#ffd98a'; c.fillRect(sx + 5 * u, sy + 4 * u, 6 * u, 4 * u);
        break;
      }
      case T.TUER: {
        const g = GEBAEUDE[pm] || GEBAEUDE[1];
        c.fillStyle = g.wand; c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = '#3a2418'; c.fillRect(sx + 4 * u, sy + 3 * u, 8 * u, 13 * u);
        c.beginPath(); c.arc(sx + 8 * u, sy + 3 * u, 4 * u, Math.PI, 0); c.fill();
        c.fillStyle = '#ffd54a'; c.fillRect(sx + 10 * u, sy + 9 * u, 1.4 * u, 1.4 * u);
        break;
      }
      case T.STEIN: {
        c.fillStyle = p.path; c.fillRect(sx, sy, S + 1, S + 1);
        const g = 0.5 + Math.sin(tick / 500) * 0.3;
        c.fillStyle = '#8a8798'; c.beginPath(); c.moveTo(sx + 3 * u, sy + 15 * u); c.lineTo(sx + 5 * u, sy + 2 * u); c.lineTo(sx + 11 * u, sy + 2 * u); c.lineTo(sx + 13 * u, sy + 15 * u); c.fill();
        c.fillStyle = '#7de4ff'; c.globalAlpha = g; c.fillRect(sx + 7 * u, sy + 4 * u, 2 * u, 8 * u); c.fillRect(sx + 5 * u, sy + 7 * u, 6 * u, 2 * u); c.globalAlpha = 1;
        break;
      }
      case T.SCHILD: {
        const id = ty * WB + tx, rangliste = pm === 10;
        c.fillStyle = rangliste ? p.path : bodenFarbe(p, h); c.fillRect(sx, sy, S + 1, S + 1);
        c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(sx + 3 * u, sy + 14 * u, 10 * u, 2 * u);
        c.fillStyle = '#6a4424'; c.fillRect(sx + 7 * u, sy + 6 * u, 2 * u, 9 * u);
        if (rangliste) {
          c.fillStyle = '#3a2a5a'; c.fillRect(sx + 1.5 * u, sy + 1 * u, 13 * u, 8 * u); c.strokeStyle = '#ffd54a'; c.lineWidth = Math.max(1, u * 0.9); c.strokeRect(sx + 1.5 * u, sy + 1 * u, 13 * u, 8 * u);
          c.font = Math.round(6 * u) + 'px system-ui,"Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('🏆', sx + 8 * u, sy + 5.3 * u);
        } else {
          c.fillStyle = '#c89a5a'; c.fillRect(sx + 1.5 * u, sy + 2 * u, 13 * u, 6 * u); c.strokeStyle = '#6a4424'; c.lineWidth = Math.max(1, u * 0.8); c.strokeRect(sx + 1.5 * u, sy + 2 * u, 13 * u, 6 * u);
          const a = Welt.schilder.get(id) || 0;
          c.save(); c.translate(sx + 8 * u, sy + 5 * u); c.rotate(a); c.fillStyle = '#3a2418';
          c.beginPath(); c.moveTo(4.5 * u, 0); c.lineTo(0.5 * u, -2.2 * u); c.lineTo(0.5 * u, 2.2 * u); c.fill(); c.fillRect(-4 * u, -0.7 * u, 5 * u, 1.4 * u); c.restore();
        }
        break;
      }
      case T.RUNE: {
        c.fillStyle = bodenFarbe(p, h); c.fillRect(sx, sy, S + 1, S + 1);
        const g = 0.5 + Math.sin(tick / 300) * 0.4;
        c.fillStyle = '#c0392b'; c.globalAlpha = 0.35 + g * 0.35; c.beginPath(); c.arc(sx + 8 * u, sy + 8 * u, 7.5 * u, 0, 6.3); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = '#ff6a5e'; c.lineWidth = Math.max(1, u); c.beginPath(); c.arc(sx + 8 * u, sy + 8 * u, 6 * u, 0, 6.3); c.stroke();
        c.fillStyle = '#ffd1c8'; c.fillRect(sx + 7.3 * u, sy + 3 * u, 1.4 * u, 10 * u); c.fillRect(sx + 3 * u, sy + 7.3 * u, 10 * u, 1.4 * u);
        break;
      }
    }
  }

  // Sichtbaren Ausschnitt zeichnen
  Welt.zeichnen = function (c, camx, camy, vw, vh, S, tick) {
    const x0 = Math.floor(camx), y0 = Math.floor(camy);
    const nx = Math.ceil(vw / S) + 2, ny = Math.ceil(vh / S) + 2;
    const offx = -(camx - x0) * S, offy = -(camy - y0) * S;
    const labels = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const tx = x0 + i, ty = y0 + j, sx = Math.round(offx + i * S), sy = Math.round(offy + j * S);
      if (tx < 0 || ty < 0 || tx >= WB || ty >= WB) { c.fillStyle = '#10243a'; c.fillRect(sx, sy, S + 1, S + 1); continue; }
      const t = Welt.get(tx, ty), bi = Welt.biomeAt(tx, ty), mt = Welt.metaAt(tx, ty), p = CAM.BIOME[bi].P;
      zeichneFeld(c, tx, ty, sx, sy, S, t, p, tick, (t === T.DACH || t === T.WAND || t === T.TUER || t === T.SCHILD) ? mt : bi);
      // Ufer: dunkle Kante am Land, heller Schaum am Wasser
      const tu = ty > 0 ? Welt.get(tx, ty - 1) : t;
      if (ty > 0 && (t === T.WASSER) !== (tu === T.WASSER) && t !== T.LAVA && tu !== T.LAVA) {
        if (t === T.WASSER) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(sx, sy, S + 1, Math.max(2, S * 0.1)); }
        else { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(sx, sy, S + 1, Math.max(2, S * 0.12)); }
      }
      if (t === T.TUER) labels.push([sx, sy, mt]);
      else if (t === T.STEIN) labels.push([sx, sy, 4]);
      else if (t === T.RUNE) labels.push([sx, sy, 5]);
      else if (t === T.SCHILD && mt === 10) labels.push([sx, sy, 10]);
    }
    c.font = '700 ' + Math.round(S * 0.34) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [sx, sy, m] of labels) {
      const txt = m === 4 ? 'Wegstein' : m === 5 ? 'Riesen-Gegner' : m === 10 ? 'Rangliste' : GEBAEUDE[m].n;
      const y = m === 4 || m === 5 || m === 10 ? sy - S * 0.35 : sy - S * 2.6;
      c.fillStyle = 'rgba(8,6,16,.7)'; const w = c.measureText(txt).width + 10;
      c.fillRect(sx + S / 2 - w / 2, y - S * 0.25, w, S * 0.5);
      c.fillStyle = m === 5 ? '#ff9a8e' : '#f2efe8'; c.fillText(txt, sx + S / 2, y + 1);
    }
  };

  // ---------- Karte als Bild (für die Übersicht und die Minikarte) ----------
  // 1 Bildpunkt = 2 Felder. Der Kern ist von Anfang an sichtbar, alles andere zeichnet sich ein, sobald du dort warst.
  const KS = 2, KW = WB / KS;
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  let pcol = null;
  Welt.farbe = function (t, bi) {
    if (!pcol) pcol = CAM.BIOME.map(p => ({ g: hex(p.pal.g1), gr: hex(p.pal.gr), t: hex(p.pal.tr), w: hex(p.pal.w), path: hex(p.pal.path) }));
    const q = pcol[bi];
    if (t === T.WASSER || t === T.LAVA) return q.w; if (t === T.GRAS) return q.gr; if (t === T.BAUM || t === T.KRISTALL || t === T.GRAB) return q.t;
    if (t === T.WEG) return q.path; if (t === T.FELS) return [92, 90, 96];
    if (t === T.WAND || t === T.DACH || t === T.TUER || t === T.STEIN) return [240, 230, 200]; if (t === T.RUNE) return [255, 80, 70];
    return q.g;
  };
  function punkte(c, x0, y0, n, get) {   // n x n Bildpunkte ab Welt-Feld (x0, y0)
    const img = c.createImageData(n, n), d = img.data;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const col = get(x0 + i * KS, y0 + j * KS), k = (j * n + i) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
    return img;
  }
  let pcx = -99, pcy = -99;
  function kartenFleck(ch) {
    if (!Welt.karte || ch.gemalt || Math.abs(ch.cx - pcx) > 1 || Math.abs(ch.cy - pcy) > 1) return;   // nur wo du warst (nicht, wo NPC-Spieler Gelände erzeugen)
    ch.gemalt = true;
    const n = CHS / KS, gx0 = ch.cx * CHS, gy0 = ch.cy * CHS;
    Welt.karte.getContext('2d').putImageData(punkte(Welt.karte.getContext('2d'), gx0, gy0, n, (x, y) => { const k = (y - gy0) * CHS + (x - gx0); return Welt.farbe(ch.t[k], ch.b[k]); }), gx0 / KS, gy0 / KS);
  }
  Welt.karteBauen = function () {
    const cv = document.createElement('canvas'); cv.width = KW; cv.height = KW;
    const c = cv.getContext('2d'); c.fillStyle = '#0b0a14'; c.fillRect(0, 0, KW, KW);
    Welt.karte = cv;
    c.putImageData(punkte(c, OFF, OFF, W / KS, (x, y) => { const k = (y - OFF) * W + (x - OFF); return Welt.farbe(alt.tiles[k], alt.biome[k]); }), OFF / KS, OFF / KS);
    // Die Karte merkt sich nur den Kern. Bereits erzeugte Stücke zeichnen sich nachträglich ein.
    for (const ch of chunks.values()) kartenFleck(ch);
  };

  // ---------- Wetter-Partikel ----------
  const POOL = {};
  const MAXN = { regen: 220, schnee: 160, asche: 110, wind: 50, dunst: 40 };
  const rr = CAM.mulberry32(99);
  for (const k in MAXN) POOL[k] = Array.from({ length: MAXN[k] }, () => ({ x: rr(), y: rr(), s: 0.5 + rr(), p: rr() }));
  const intens = {};
  let blitz = 0, blitzNext = 3;
  const FARBE_NACHT = 'rgba(8,8,36,';

  CAM.WetterAnzeige = {
    aktualisieren(dt, art) {
      const typen = ['regen', 'gewitter', 'nebel', 'schnee', 'hitze', 'asche', 'blutmond', 'wind', 'dunst'];
      for (const k of typen) {
        const ziel = k === art ? 1 : 0, v = intens[k] || 0;
        intens[k] = v + Math.max(-dt * 0.5, Math.min(dt * 0.5, ziel - v));
      }
      if ((intens.gewitter || 0) > 0.5) { blitzNext -= dt; if (blitzNext < 0) { blitz = 1; blitzNext = 4 + Math.random() * 9; } }
      blitz = Math.max(0, blitz - dt * 2.5);
    },
    zeichnen(c, w, h, tick, dunkel, biomeId, qualitaet) {
      const q = qualitaet === 0 ? 0.35 : 1;
      const I = k => intens[k] || 0;
      // Nacht
      if (dunkel > 0.02) {
        // Nacht: dunkel, aber um dich herum bleibt es hell genug
        const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12, w / 2, h / 2, Math.max(w, h) * 0.62);
        g.addColorStop(0, FARBE_NACHT + (0.16 * dunkel).toFixed(3) + ')'); g.addColorStop(1, FARBE_NACHT + (0.62 * dunkel).toFixed(3) + ')');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
      if (I('blutmond') > 0.02) { c.fillStyle = 'rgba(150,10,10,' + (0.2 * I('blutmond')).toFixed(3) + ')'; c.fillRect(0, 0, w, h); }
      if (I('hitze') > 0.02) { c.fillStyle = 'rgba(255,150,40,' + (0.1 * I('hitze')).toFixed(3) + ')'; c.fillRect(0, 0, w, h); }
      // Regen und Gewitter
      const rain = Math.max(I('regen'), I('gewitter') * 1.0);
      if (rain > 0.02) {
        c.strokeStyle = 'rgba(170,200,255,0.55)'; c.lineWidth = 1.3; c.beginPath();
        const n = Math.floor(MAXN.regen * rain * q), sp = I('gewitter') > 0.3 ? 1.6 : 1;
        for (let i = 0; i < n; i++) { const p = POOL.regen[i]; const x = ((p.x * w + tick * 0.25 * p.s * sp) % (w + 40)) - 20, y = ((p.y * h + tick * 0.9 * p.s * sp) % (h + 40)) - 20; c.moveTo(x, y); c.lineTo(x - 5, y + 14 * p.s); }
        c.stroke();
        c.fillStyle = 'rgba(20,30,60,' + (0.18 * rain).toFixed(3) + ')'; c.fillRect(0, 0, w, h);
      }
      if (blitz > 0.02) { c.fillStyle = 'rgba(255,255,255,' + (0.6 * blitz).toFixed(3) + ')'; c.fillRect(0, 0, w, h); }
      // Schnee
      if (I('schnee') > 0.02) {
        c.fillStyle = 'rgba(255,255,255,0.85)';
        const n = Math.floor(MAXN.schnee * I('schnee') * q);
        for (let i = 0; i < n; i++) { const p = POOL.schnee[i]; const x = ((p.x * w + tick * 0.12 * p.s + Math.sin(tick / 600 + i) * 12) % (w + 20)) - 10, y = ((p.y * h + tick * 0.14 * p.s) % (h + 20)) - 10; c.fillRect(x, y, 2 + p.s, 2 + p.s); }
        c.fillStyle = 'rgba(220,235,255,' + (0.16 * I('schnee')).toFixed(3) + ')'; c.fillRect(0, 0, w, h);
      }
      // Asche
      if (I('asche') > 0.02) {
        const n = Math.floor(MAXN.asche * I('asche') * q);
        for (let i = 0; i < n; i++) { const p = POOL.asche[i]; const x = ((p.x * w + tick * 0.05 * p.s + Math.sin(tick / 700 + i) * 10) % (w + 20)) - 10, y = ((p.y * h + tick * 0.07 * p.s) % (h + 20)) - 10; c.fillStyle = p.p > 0.8 ? 'rgba(255,140,50,0.9)' : 'rgba(150,140,140,0.7)'; c.fillRect(x, y, 2 + p.s, 2 + p.s); }
        c.fillStyle = 'rgba(40,20,10,' + (0.2 * I('asche')).toFixed(3) + ')'; c.fillRect(0, 0, w, h);
      }
      // Wind: Laub
      if (I('wind') > 0.02) {
        const n = Math.floor(MAXN.wind * I('wind') * q);
        const farbe = ['#c24e1a', '#e0a02e', '#a0521e', '#7a5a34'];
        for (let i = 0; i < n; i++) { const p = POOL.wind[i]; const x = ((p.x * w + tick * 0.5 * p.s) % (w + 30)) - 15, y = ((p.y * h + Math.sin(tick / 400 + i) * 14 + tick * 0.05) % (h + 20)) - 10; c.fillStyle = biomeId === 2 ? farbe[i % 4] : 'rgba(210,220,200,0.6)'; c.fillRect(x, y, 4 + p.s * 2, 2 + p.s); }
      }
      // Nebel und Giftdunst: weiche Schwaden
      const fog = Math.max(I('nebel'), I('dunst'));
      if (fog > 0.02) {
        const gift = I('dunst') > I('nebel');
        for (let i = 0; i < 7; i++) {
          const x = ((i * 0.17 + tick / 60000 * (i % 2 ? 1 : -1) + 10) % 1.4 - 0.2) * w, y = (0.1 + (i * 0.137) % 0.8) * h, r = Math.max(w, h) * 0.32;
          const g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, (gift ? 'rgba(130,200,110,' : 'rgba(210,215,225,') + (0.3 * fog).toFixed(3) + ')'); g.addColorStop(1, 'rgba(210,215,225,0)');
          c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        c.fillStyle = (gift ? 'rgba(90,140,80,' : 'rgba(190,195,205,') + (0.12 * fog).toFixed(3) + ')'; c.fillRect(0, 0, w, h);
      }
    },
  };
})(window);
