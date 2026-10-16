// Sternen-Party – Spielbrett „Sternen-Insel“: Felder, Wege, Gabelungen und das Zeichnen des Bretts
'use strict';

// Feldarten
//  A Start (wie blau)   B blau +3   R rot −3   G Glück   ? Ereignis   X Grimm   I Item   D Duell   K Bank
//  Stationen (zählen nicht als Schritt, man kommt nur vorbei): L Laden, S Gusti das Gespenst
const FELD_INFO = {
  A: { name: 'Start', farbe: ['#6fb2ff', '#2f6fd6'], team: 'blau' },
  B: { name: 'Blaues Feld', farbe: ['#6fb2ff', '#2f6fd6'], team: 'blau' },
  R: { name: 'Rotes Feld', farbe: ['#ff7a7a', '#cf2f3a'], team: 'rot' },
  G: { name: 'Glücksfeld', farbe: ['#7ef08a', '#22a33a'], team: 'gruen' },
  '?': { name: 'Ereignisfeld', farbe: ['#7ef08a', '#22a33a'], team: 'gruen' },
  X: { name: 'Grimm-Feld', farbe: ['#5b2a6e', '#25102e'], team: 'rot' },
  I: { name: 'Item-Feld', farbe: ['#ffb0f0', '#c040b0'], team: 'gruen' },
  D: { name: 'Duell-Feld', farbe: ['#ffc070', '#e06a10'], team: 'gruen' },
  K: { name: 'Bank', farbe: ['#ffe680', '#d9a400'], team: 'gruen' },
  L: { name: 'Laden', station: true },
  S: { name: 'Gusti das Gespenst', station: true },
};

// Wege als Kontrollpunkte einer weichen Kurve. Die Felder werden gleichmässig darauf verteilt.
const BRETT_DEF = {
  name: 'Sternen-Insel', breite: 3000, hoehe: 2050,
  haupt: {
    punkte: [[1500, 1660], [1150, 1645], [820, 1570], [560, 1390], [420, 1120], [460, 840], [640, 590], [900, 420], [1200, 350],
      [1500, 370], [1800, 350], [2100, 420], [2370, 590], [2560, 850], [2600, 1130], [2470, 1400], [2200, 1570], [1850, 1645]],
    typen: 'ABBRB?BGLBIBRBBDB?BBSBRGBBXBIBR?BBGBKBRBDBBIBR?BGB',
  },
  zweige: [
    // Hängebrücke über die Schlucht: kurz, aber gefährlich
    { name: 'Hängebrücke', von: [460, 840], nach: [2560, 850], ueber: [[800, 760], [1150, 715], [1500, 700], [1850, 715], [2200, 760]], typen: 'BRBX?BRGBRXB' },
    // Lavapfad am Vulkan vorbei: Grimm wohnt hier, aber auch viel Glück
    { name: 'Lavapfad', von: [2200, 1570], nach: [820, 1570], ueber: [[2020, 1380], [1780, 1290], [1500, 1350], [1220, 1290], [980, 1380]], typen: 'BXGB?IBXGBRB' },
  ],
  sternPlaetze: [], // wird beim Aufbau mit passenden blauen Feldern gefüllt
  vulkan: [1500, 1080],
};

// Catmull-Rom-Kurve durch Punkte, gibt dicht abgetastete Punkte zurück
function kurve(punkte, geschlossen, proSegment = 40) {
  const n = punkte.length, out = [];
  const P = i => geschlossen ? punkte[(i + n) % n] : punkte[clamp(i, 0, n - 1)];
  const segs = geschlossen ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < proSegment; s++) {
      const t = s / proSegment, t2 = t * t, t3 = t2 * t;
      out.push([
        .5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!geschlossen) out.push(punkte[n - 1]);
  return out;
}
// n Punkte in gleichem Abstand auf einer abgetasteten Kurve (ohne Endpunkte bei offenen Wegen)
function verteilen(dicht, n, geschlossen) {
  const len = [0];
  for (let i = 1; i < dicht.length; i++) len.push(len[i - 1] + dist(...dicht[i - 1], ...dicht[i]));
  let total = len[len.length - 1];
  if (geschlossen) total += dist(...dicht[dicht.length - 1], ...dicht[0]);
  const out = [];
  for (let k = 0; k < n; k++) {
    const ziel = geschlossen ? total * k / n : total * (k + 1) / (n + 1);
    let i = 1; while (i < len.length && len[i] < ziel) i++;
    if (i >= len.length) { out.push(dicht[dicht.length - 1].slice()); continue; }
    const t = (ziel - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
    out.push([lerp(dicht[i - 1][0], dicht[i][0], t), lerp(dicht[i - 1][1], dicht[i][1], t)]);
  }
  return out;
}

// Baut den Graphen: felder[i] = { i, x, y, typ, weiter: [Indizes], zurueck: [...], weg, ereignis }
function baueBrett(def) {
  const felder = [];
  const neu = (x, y, typ, weg) => { const f = { i: felder.length, x: Math.round(x), y: Math.round(y), typ, weiter: [], zurueck: [], weg }; felder.push(f); return f; };
  const h = def.haupt;
  const hp = verteilen(kurve(h.punkte, true), h.typen.length, true);
  const haupt = hp.map((p, k) => neu(p[0], p[1], h.typen[k], 'Hauptweg'));
  haupt.forEach((f, k) => f.weiter.push(haupt[(k + 1) % haupt.length].i));
  const naechstes = (x, y) => {
    let best = null, bd = 1e9;
    for (const f of haupt) { if (FELD_INFO[f.typ].station) continue; const d = dist(x, y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
    return best;
  };
  for (const z of def.zweige) {
    const a = naechstes(...z.von), b = naechstes(...z.nach);
    const pts = [[a.x, a.y], ...z.ueber, [b.x, b.y]];
    const zp = verteilen(kurve(pts, false), z.typen.length, false);
    let vorher = a;
    zp.forEach((p, k) => {
      const f = neu(p[0], p[1], z.typen[k], z.name);
      vorher.weiter.push(f.i); vorher = f;
    });
    vorher.weiter.push(b.i);
  }
  for (const f of felder) for (const w of f.weiter) felder[w].zurueck.push(f.i);
  // Ereignisse den ?-Feldern zuteilen
  const ereignisse = ['seilbahn', 'strudel', 'tausch', 'sternwechsel', 'kokos'];
  let e = 0;
  for (const f of felder) if (f.typ === '?') f.ereignis = ereignisse[e++ % ereignisse.length];
  // Mögliche Sternplätze: blaue Felder, gut verteilt, nicht zu nah am Start
  const start = felder[0];
  const kandidaten = felder.filter(f => f.typ === 'B' && f.weg === 'Hauptweg' && dist(f.x, f.y, start.x, start.y) > 500);
  const sterne = [];
  for (const k of kandidaten) {   // feste Reihenfolge: auf allen Rechnern gleich
    if (sterne.every(s => dist(s.x, s.y, k.x, k.y) > 650)) sterne.push(k);
  }
  return { def, felder, sternPlaetze: sterne.map(f => f.i), start: 0 };
}

// Ist das Feld eine Station (zählt nicht als Schritt)? Der aktuelle Sternplatz ist auch eine.
function istStation(brett, i, sternFeld) { return i === sternFeld || !!FELD_INFO[brett.felder[i].typ].station; }

// Schritte (nur echte Felder) von a zum Feld ziel, kürzester Weg vorwärts
function schritteBis(brett, a, ziel, sternFeld) {
  const n = brett.felder.length;
  const d = new Array(n).fill(Infinity); d[a] = 0;
  const q = [a];
  while (q.length) {
    const i = q.shift();
    if (i === ziel) return d[i];
    for (const w of brett.felder[i].weiter) {
      const c = d[i] + (istStation(brett, w, sternFeld) && w !== ziel ? 0 : 1);
      if (c < d[w]) { d[w] = c; q.push(w); }
    }
  }
  return Infinity;
}

// ---------- Zeichnen des Bretts ----------
const BrettBild = {
  deko: null, insel: null, cache: null,
  vorbereiten(brett) {
    const def = brett.def;
    // Inselumriss: Hauptweg etwas nach aussen geschoben
    const mx = def.breite / 2, my = def.hoehe / 2 + 20;
    const um = kurve(def.haupt.punkte, true, 24);
    this.insel = um.map(([x, y]) => { const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy); return [x + dx / l * 190, y + dy / l * 170]; });
    this.strand = um.map(([x, y]) => { const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy); return [x + dx / l * 290, y + dy / l * 260]; });
    this.wege = [];
    // Wegverlauf als Kette über die Felder (für den Pfad unter den Feldern)
    for (const f of brett.felder) for (const w of f.weiter) this.wege.push([f, brett.felder[w]]);
    // Deko deterministisch verteilen (Palmen, Büsche, Blumen, Felsen, Hütten)
    let s = 7;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.deko = [];
    const frei = (x, y, abst) => brett.felder.every(f => dist(x, y, f.x, f.y) > abst) && dist(x, y, def.vulkan[0], def.vulkan[1]) > 330 &&
      this.deko.every(d => dist(x, y, d.x, d.y) > 70);
    const innen = (x, y) => punktInPoly(x, y, this.insel);
    for (let i = 0; i < 900 && this.deko.length < 150; i++) {
      const x = 150 + R() * (def.breite - 300), y = 120 + R() * (def.hoehe - 240);
      if (!innen(x, y) || !frei(x, y, 95)) continue;
      const r = R();
      this.deko.push({ x, y, art: r < .38 ? 'palme' : r < .65 ? 'busch' : r < .85 ? 'blumen' : r < .95 ? 'fels' : 'huette', s: .8 + R() * .5, v: R() });
    }
    // Ein paar Felsen im Meer
    for (let i = 0; i < 400 && this.deko.length < 175; i++) {
      const x = R() * def.breite, y = R() * def.hoehe;
      if (punktInPoly(x, y, this.strand) || !frei(x, y, 200)) continue;
      this.deko.push({ x, y, art: 'meerfels', s: .7 + R() * .6, v: R() });
    }
    this.deko.sort((a, b) => a.y - b.y);
    this.cache = null;
  },
  // Statischer Hintergrund (Insel, Wege, Deko) wird einmal in ein Bild gerendert
  hintergrund(brett, qualitaet) {
    const def = brett.def;
    const sk = qualitaet;
    if (this.cache && this.cache.sk === sk) return this.cache.c;
    const c = document.createElement('canvas');
    c.width = Math.round(def.breite * sk); c.height = Math.round(def.hoehe * sk);
    const g = c.getContext('2d');
    g.scale(sk, sk);
    // Strand
    const pfad = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    g.fillStyle = 'rgba(160,240,255,.35)'; pfad(this.strand.map(([x, y]) => [x + (x - 1500) * .03, y + (y - 1045) * .03])); g.fill();
    const sand = g.createLinearGradient(0, 0, 0, def.hoehe);
    sand.addColorStop(0, '#ffe7a8'); sand.addColorStop(1, '#f5cf7a');
    g.fillStyle = sand; pfad(this.strand); g.fill();
    // Wiese
    const gras = g.createRadialGradient(1500, 900, 200, 1500, 1000, 1600);
    gras.addColorStop(0, '#8fdc5c'); gras.addColorStop(.7, '#5fbf45'); gras.addColorStop(1, '#46a63a');
    g.fillStyle = gras; pfad(this.insel); g.fill();
    g.strokeStyle = 'rgba(40,110,30,.35)'; g.lineWidth = 10; g.stroke();
    // Grasbüschel-Struktur
    let s = 3; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = 'rgba(255,255,255,.07)';
    for (let i = 0; i < 500; i++) {
      const x = R() * def.breite, y = R() * def.hoehe;
      if (!punktInPoly(x, y, this.insel)) continue;
      g.beginPath(); g.ellipse(x, y, 30 + R() * 50, 12 + R() * 16, 0, 0, TAU); g.fill();
    }
    // Schlucht unter der Hängebrücke
    const br = brett.felder.filter(f => f.weg === 'Hängebrücke');
    if (br.length) {
      g.strokeStyle = '#3b2c22'; g.lineWidth = 120; g.lineCap = 'round';
      g.beginPath(); g.moveTo(br[0].x + 80, br[0].y - 180); g.bezierCurveTo(br[3].x, br[3].y + 160, br[8].x, br[8].y - 160, br[br.length - 1].x - 60, br[br.length - 1].y + 200); g.stroke();
      g.strokeStyle = '#1f6fb0'; g.lineWidth = 50; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 8; g.setLineDash([30, 40]); g.stroke(); g.setLineDash([]);
    }
    this.zeichneVulkan(g, def.vulkan[0], def.vulkan[1]);
    // Wege
    for (const [w, breite, farbe] of [['Hauptweg', 46, '#e9d29b'], ['Lavapfad', 46, '#5a4a4a'], ['Hängebrücke', 40, '#a0703f']]) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [a, b] of this.wege) {
        const typ = b.weg === 'Hauptweg' && a.weg === 'Hauptweg' ? 'Hauptweg' : (a.weg !== 'Hauptweg' ? a.weg : b.weg);
        if (typ !== w) continue;
        g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = breite + 14; g.beginPath(); g.moveTo(a.x, a.y + 6); g.lineTo(b.x, b.y + 6); g.stroke();
        g.strokeStyle = farbe; g.lineWidth = breite; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        if (w === 'Hängebrücke') {
          const n = Math.floor(dist(a.x, a.y, b.x, b.y) / 18);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          g.strokeStyle = '#6b4523'; g.lineWidth = 4;
          for (let k = 0; k < n; k++) {
            const t = k / n, x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
            g.beginPath(); g.moveTo(x - Math.sin(ang) * 22, y + Math.cos(ang) * 22); g.lineTo(x + Math.sin(ang) * 22, y - Math.cos(ang) * 22); g.stroke();
          }
        }
        if (w === 'Lavapfad') { g.strokeStyle = 'rgba(255,120,40,.35)'; g.lineWidth = 6; g.setLineDash([14, 22]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); }
      }
    }
    // Deko
    for (const d of this.deko) this.zeichneDeko(g, d);
    this.cache = { sk, c };
    return c;
  },
  zeichneVulkan(g, x, y) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 210, 380, 90, 0, 0, TAU); g.fill();
    const berg = g.createLinearGradient(-300, 0, 300, 0);
    berg.addColorStop(0, '#6b4a3c'); berg.addColorStop(.5, '#8a6150'); berg.addColorStop(1, '#4e342a');
    g.fillStyle = berg;
    g.beginPath(); g.moveTo(-360, 200); g.quadraticCurveTo(-200, 120, -110, -120); g.lineTo(110, -120); g.quadraticCurveTo(200, 120, 360, 200); g.quadraticCurveTo(0, 260, -360, 200); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 6; g.stroke();
    // Lava-Ströme
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-40, -110); g.quadraticCurveTo(-90, 0, -60, 150); g.stroke();
    g.beginPath(); g.moveTo(50, -110); g.quadraticCurveTo(110, 20, 140, 170); g.stroke();
    g.strokeStyle = '#ffd23a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-40, -110); g.quadraticCurveTo(-90, 0, -60, 150); g.stroke();
    g.beginPath(); g.moveTo(50, -110); g.quadraticCurveTo(110, 20, 140, 170); g.stroke();
    // Krater
    const kr = g.createRadialGradient(0, -122, 10, 0, -122, 120);
    kr.addColorStop(0, '#ffe066'); kr.addColorStop(.5, '#ff7a1a'); kr.addColorStop(1, '#a0281a');
    g.fillStyle = kr; g.beginPath(); g.ellipse(0, -122, 112, 28, 0, 0, TAU); g.fill();
    // Grimms Burg auf dem Gipfel
    g.fillStyle = '#3a2440'; g.strokeStyle = '#1e1024'; g.lineWidth = 4;
    for (const [bx, bh] of [[-70, 120], [70, 120], [0, 170]]) {
      g.beginPath(); g.rect(bx - 28, -130 - bh, 56, bh); g.fill(); g.stroke();
      g.fillStyle = '#c42a3a'; g.beginPath(); g.moveTo(bx - 36, -130 - bh); g.lineTo(bx, -130 - bh - 60); g.lineTo(bx + 36, -130 - bh); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(bx, -130 - bh + 40, 9, 14, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a2440';
    }
    g.restore();
  },
  zeichneDeko(g, d) {
    const { x, y } = d, s = d.s;
    g.save(); g.translate(x, y); g.scale(s, s);
    switch (d.art) {
      case 'palme': {
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(18, 4, 46, 14, 0, 0, TAU); g.fill();
        g.strokeStyle = '#9a6a3a'; g.lineWidth = 14; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14 * (d.v - .5) * 2, -60, 6 * (d.v - .5) * 4, -120); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 3;
        for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(-6, -k * 17); g.lineTo(6, -k * 17 - 3); g.stroke(); }
        const tx = 6 * (d.v - .5) * 4, ty = -122;
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * .62 + d.v * .3;
          g.fillStyle = k % 2 ? '#2f9a3a' : '#3cb84a';
          g.beginPath(); g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(a - .3) * 60, ty + Math.sin(a - .3) * 60 - 10, tx + Math.cos(a) * 90, ty + Math.sin(a) * 90 + 30);
          g.quadraticCurveTo(tx + Math.cos(a + .3) * 50, ty + Math.sin(a + .3) * 50, tx, ty); g.fill();
        }
        g.fillStyle = '#7a4a22'; for (const [cx, cy] of [[-8, 4], [8, 6], [0, 12]]) { g.beginPath(); g.arc(tx + cx, ty + cy, 8, 0, TAU); g.fill(); }
        break;
      }
      case 'busch': {
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(0, 6, 46, 14, 0, 0, TAU); g.fill();
        for (const [cx, cy, r, f] of [[-24, -12, 24, '#2f9a3a'], [22, -12, 24, '#2f9a3a'], [0, -26, 30, '#3cb84a'], [-8, -34, 12, '#5fd06a']]) {
          g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
        }
        if (d.v > .5) { g.fillStyle = '#ff5f8f'; for (const [cx, cy] of [[-14, -22], [12, -30], [20, -10]]) { g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill(); } }
        break;
      }
      case 'blumen': {
        const farben = ['#ff6b8a', '#ffd23a', '#ffffff', '#b98cff'];
        for (let k = 0; k < 5; k++) {
          const bx = (k - 2) * 14, by = (k % 2) * 10;
          g.strokeStyle = '#2f9a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - 18); g.stroke();
          g.fillStyle = farben[(k + Math.floor(d.v * 4)) % 4];
          for (let b = 0; b < 5; b++) { const a = b * TAU / 5; g.beginPath(); g.arc(bx + Math.cos(a) * 6, by - 18 + Math.sin(a) * 6, 4.5, 0, TAU); g.fill(); }
          g.fillStyle = '#ffb000'; g.beginPath(); g.arc(bx, by - 18, 3.5, 0, TAU); g.fill();
        }
        break;
      }
      case 'fels': case 'meerfels': {
        if (d.art === 'meerfels') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 4, 62, 20, 0, 0, TAU); g.stroke(); }
        g.fillStyle = '#8a8f9e'; g.beginPath(); g.moveTo(-44, 6); g.quadraticCurveTo(-40, -36, -6, -44); g.quadraticCurveTo(36, -40, 46, 6); g.closePath(); g.fill();
        g.fillStyle = '#b4b9c6'; g.beginPath(); g.moveTo(-30, -10); g.quadraticCurveTo(-26, -34, -4, -38); g.quadraticCurveTo(-10, -18, -30, -10); g.fill();
        break;
      }
      case 'huette': {
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 6, 60, 16, 0, 0, TAU); g.fill();
        g.fillStyle = '#c98a4b'; g.fillRect(-40, -50, 80, 54);
        g.fillStyle = '#7a4a22'; g.fillRect(-12, -30, 24, 34);
        g.fillStyle = '#e8c06a'; g.beginPath(); g.moveTo(-56, -44); g.lineTo(0, -96); g.lineTo(56, -44); g.closePath(); g.fill();
        g.strokeStyle = '#b8902a'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-46 + k * 10, -52 + k * 2); g.lineTo(-4 + k * 12, -88 + k * 10); g.stroke(); }
        break;
      }
    }
    g.restore();
  },
  // Ein Feld zeichnen (jedes Bild neu, wegen Leuchten und Stern)
  feld(g, f, t, hervor = false) {
    const info = FELD_INFO[f.typ];
    const { x, y } = f;
    if (info.station) {
      if (f.typ === 'L') this.laden(g, x, y, t);
      else if (f.typ === 'S') { g.fillStyle = 'rgba(80,60,140,.3)'; g.beginPath(); g.ellipse(x, y + 6, 46, 20, 0, 0, TAU); g.fill(); zeichneGusti(g, x, y - 30, 30, t); }
      return;
    }
    const r = 36;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + 8, r + 2, r * .55 + 2, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, r + 4, r * .62 + 4, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(x, y - r * .6, x, y + r * .6);
    gr.addColorStop(0, info.farbe[0]); gr.addColorStop(1, info.farbe[1]);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .62, 0, 0, TAU); g.fill();
    if (hervor) { g.strokeStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(t * 6)})`; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, r + 10, r * .62 + 8, 0, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(x - 8, y - 8, r * .55, r * .2, 0, 0, TAU); g.fill();
    // Symbol
    g.save(); g.translate(x, y); g.scale(1, .7);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 30px system-ui,sans-serif';
    const sym = s => { g.strokeText(s, 0, 2); g.fillText(s, 0, 2); };
    switch (f.typ) {
      case 'B': case 'A': g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); if (f.typ === 'A') { g.font = '900 20px system-ui'; g.fillStyle = '#fff'; g.fillText('START', 0, -44); } break;
      case 'R': g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-11, -4, 22, 8); break;
      case 'G': sym('!'); break;
      case '?': sym('?'); break;
      case 'X': zeichneGrimmKopf(g, 0, 2, 17); break;
      case 'I': g.fillStyle = '#fff'; g.fillRect(-14, -10, 28, 22); g.fillStyle = '#ff4fa3'; g.fillRect(-3, -10, 6, 22); g.fillRect(-14, -2, 28, 5); g.fillStyle = '#fff'; g.beginPath(); g.arc(-6, -14, 6, 0, TAU); g.arc(6, -14, 6, 0, TAU); g.fill(); break;
      case 'D': g.font = '900 24px system-ui'; sym('VS'); break;
      case 'K': zeichneMuenze(g, 0, 0, 16); break;
    }
    g.restore();
  },
  laden(g, x, y, t) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 8, 64, 20, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe9c4'; g.fillRect(-46, -60, 92, 66);
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 4; g.strokeRect(-46, -60, 92, 66);
    // Markise
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff' : '#ff4f7a'; g.beginPath(); g.moveTo(-54 + k * 18, -60); g.lineTo(-36 + k * 18, -60); g.lineTo(-36 + k * 18, -44); g.arc(-45 + k * 18, -44, 9, 0, Math.PI); g.closePath(); g.fill(); }
    g.fillStyle = '#7a4a22'; g.fillRect(-14, -30, 28, 36);
    g.fillStyle = '#ffd23a'; g.font = '900 20px system-ui'; g.textAlign = 'center'; g.fillText('LADEN', 0, -70);
    g.restore();
  },
};
function zeichneGrimmKopf(g, x, y, r) {
  g.fillStyle = '#f2e6c9';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * r * .4, y - r * .6); g.lineTo(x + s * r * 1.1, y - r * 1.3); g.lineTo(x + s * r * .85, y - r * .3); g.closePath(); g.fill(); }
  g.fillStyle = '#e0404a'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#ffe066'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * r * .38, y - r * .15, r * .22, r * .16, s * .4, 0, TAU); g.fill(); }
  g.fillStyle = '#3a0a14'; g.beginPath(); g.arc(x, y + r * .25, r * .45, .1, Math.PI - .1); g.fill();
}
function punktInPoly(x, y, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}
