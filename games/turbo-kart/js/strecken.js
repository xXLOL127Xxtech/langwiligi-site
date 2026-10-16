// Turbo-Kart – Strecken, Arenen, Themen und der Streckenbauer
'use strict';

// ---------- Themen ----------
const THEMEN = {
  wiese: {
    himmel: ['#2f7fff', '#8fcfff', '#e9f7ff'], sonne: '#fff3d0', sonneI: 1.15, hemi: ['#d6ecff', '#3f6f2f', 0.8],
    nebel: ['#b9e0ff', 380, 1300], boden: 'gras', strasse: 'asphalt', wand: 'bande', berge: '#4f9a45', bergSchnee: true,
    musik: { seed: 101, bpm: 152, root: 62, skala: 'dur', prog: [0, 3, 4, 0, 5, 3, 1, 4], stil: 'pop' },
  },
  strand: {
    himmel: ['#1f8fff', '#7fd8ff', '#fff4dc'], sonne: '#fff1c8', sonneI: 1.2, hemi: ['#dff4ff', '#c9a874', 0.8],
    nebel: ['#bfe9ff', 400, 1400], boden: 'sand', strasse: 'asphalt', wand: 'holz', berge: '#3e8f3a', wasser: true,
    musik: { seed: 202, bpm: 128, root: 65, skala: 'mixo', prog: [0, 6, 3, 4, 0, 6, 3, 4], stil: 'pop', lead: 'triangle' },
  },
  wueste: {
    himmel: ['#ff9a3d', '#ffd08a', '#fff0d0'], sonne: '#fff0c0', sonneI: 1.25, hemi: ['#ffe6c0', '#a06a3a', 0.75],
    nebel: ['#ffd9a0', 300, 1100], boden: 'sand', strasse: 'sand', wand: 'fels', berge: '#c27a42',
    musik: { seed: 303, bpm: 138, root: 57, skala: 'dorisch', prog: [0, 0, 6, 6, 5, 5, 4, 4], stil: 'rock', lead: 'sawtooth' },
  },
  dschungel: {
    himmel: ['#3aa0d8', '#9fe0d0', '#f2ffe8'], sonne: '#fff6d0', sonneI: 1.05, hemi: ['#d8ffe0', '#2f5a24', 0.85],
    nebel: ['#a8d8b0', 220, 900], boden: 'dschungel', strasse: 'dschungel', wand: 'tempel', berge: '#2f7a35',
    musik: { seed: 404, bpm: 144, root: 60, skala: 'moll', prog: [0, 5, 2, 6, 0, 5, 3, 4], stil: 'pop', lead: 'triangle' },
  },
  schnee: {
    himmel: ['#4a7fd8', '#a8ccf0', '#f0f6ff'], sonne: '#ffffff', sonneI: 1.0, hemi: ['#e8f2ff', '#8aa0c0', 0.9],
    nebel: ['#dce9f8', 260, 1000], boden: 'schnee', strasse: 'schnee', wand: 'schnee', berge: '#e8f0fa', bergSchnee: true,
    musik: { seed: 505, bpm: 132, root: 64, skala: 'dur', prog: [0, 4, 5, 3, 0, 4, 3, 4], stil: 'ruhig', lead: 'triangle' },
  },
  stadt: {
    himmel: ['#05051a', '#1a1450', '#5a2a7a'], sonne: '#9db4ff', sonneI: 0.55, hemi: ['#6a6aff', '#201830', 0.6], nacht: true,
    nebel: ['#1a1440', 250, 1000], boden: 'stadt', strasse: 'stadt', wand: 'beton', berge: '#1a1a2e',
    musik: { seed: 606, bpm: 160, root: 57, skala: 'moll', prog: [0, 5, 3, 4, 0, 5, 6, 4], stil: 'rock', lead: 'sawtooth', bass: 'square' },
  },
  lava: {
    himmel: ['#1a0505', '#5a1408', '#c23a0a'], sonne: '#ffb080', sonneI: 0.8, hemi: ['#ff9a6a', '#3a0a05', 0.7], nacht: true,
    nebel: ['#4a1208', 200, 800], boden: 'lava', strasse: 'burg', wand: 'burg', berge: '#2a1410', lavaSee: true,
    musik: { seed: 707, bpm: 150, root: 52, skala: 'moll', prog: [0, 0, 5, 5, 3, 3, 4, 4], stil: 'rock', lead: 'sawtooth', bass: 'sawtooth' },
  },
  all: {
    himmel: ['#02020a', '#0a0628', '#2a0a4a'], sonne: '#ffffff', sonneI: 0.8, hemi: ['#b0a0ff', '#301050', 0.85], nacht: true, weltall: true,
    nebel: ['#0a0628', 500, 1800], boden: null, strasse: 'regenbogen', wand: 'leucht', berge: null,
    musik: { seed: 808, bpm: 156, root: 62, skala: 'dur', prog: [0, 5, 3, 4, 0, 5, 1, 4], stil: 'pop', lead: 'square' },
  },
  mond: {
    himmel: ['#000005', '#050518', '#151538'], sonne: '#ffffff', sonneI: 1.0, hemi: ['#c0c8ff', '#404050', 0.7], nacht: true, weltall: true,
    nebel: ['#05051a', 400, 1500], boden: 'mond', strasse: 'asphalt', wand: 'leucht', berge: '#6a6a78',
    musik: { seed: 909, bpm: 140, root: 59, skala: 'moll', prog: [0, 3, 5, 4, 0, 3, 6, 4], stil: 'rock', lead: 'square' },
  },
};

// Strecke als Vieleck: jede Ecke [x, z, radius, höhe] wird mit einem Kreisbogen abgerundet.
// Gestartet wird in der Mitte der Geraden von der letzten zur ersten Ecke.
function kurs(ecken, skala = 1) {
  const n = ecken.length, V = ecken.map(e => ({ x: e[0] * skala, z: e[1] * skala, r: e[2] || 20, y: e[3] || 0 }));
  const roh = [];   // Punkte mit Höhe
  const stuecke = [];
  for (let i = 0; i < n; i++) {
    const a = V[(i - 1 + n) % n], b = V[i], c = V[(i + 1) % n];
    const d1x = b.x - a.x, d1z = b.z - a.z, l1 = Math.hypot(d1x, d1z);
    const d2x = c.x - b.x, d2z = c.z - b.z, l2 = Math.hypot(d2x, d2z);
    const u1x = d1x / l1, u1z = d1z / l1, u2x = d2x / l2, u2z = d2z / l2;
    const th = Math.acos(clamp(u1x * u2x + u1z * u2z, -1, 1));
    let r = b.r, t = r * Math.tan(th / 2);
    const tmax = Math.min(l1, l2) * 0.49;
    if (t > tmax) { t = tmax; r = t / Math.tan(th / 2); }
    const p1 = { x: b.x - u1x * t, z: b.z - u1z * t }, p2 = { x: b.x + u2x * t, z: b.z + u2z * t };
    const kreuz = u1x * u2z - u1z * u2x;   // Drehsinn
    stuecke.push({ p1, p2, b, r, th, kreuz, u1x, u1z, y: b.y });
  }
  const pts = [];
  const SCH = 8;
  for (let i = 0; i < n; i++) {
    const s = stuecke[i], nx = stuecke[(i + 1) % n];
    // Bogen um die Ecke
    if (s.th > 1e-3) {
      const m = Math.max(2, Math.ceil(s.r * s.th / SCH));
      // Mittelpunkt: von p1 senkrecht zur Einfahrtsrichtung
      const sg = s.kreuz > 0 ? 1 : -1;
      const cx = s.p1.x - s.u1z * s.r * sg, cz = s.p1.z + s.u1x * s.r * sg;
      const a0 = Math.atan2(s.p1.z - cz, s.p1.x - cx);
      for (let k = 0; k <= m; k++) { const a = a0 + sg * s.th * k / m; pts.push({ x: cx + Math.cos(a) * s.r, z: cz + Math.sin(a) * s.r, y: s.y }); }
    } else pts.push({ x: s.b.x, z: s.b.z, y: s.y });
    // Gerade zur nächsten Ecke
    const gl = Math.hypot(nx.p1.x - s.p2.x, nx.p1.z - s.p2.z), m = Math.floor(gl / SCH);
    for (let k = 1; k < m; k++) { const f = k / m; pts.push({ x: lerp(s.p2.x, nx.p1.x, f), z: lerp(s.p2.z, nx.p1.z, f), y: lerp(s.y, nx.y, smooth(f)) }); }
  }
  // Höhen weich machen
  const H = pts.map(p => p.y);
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < pts.length; i++) pts[i].y = (H[(i - 1 + pts.length) % pts.length] + H[i] * 2 + H[(i + 1) % pts.length]) / 4, H[i] = pts[i].y;
  // Start in die Mitte der letzten Geraden legen
  const s = stuecke[n - 1], e = stuecke[0];
  const mx = (s.p2.x + e.p1.x) / 2, mz = (s.p2.z + e.p1.z) / 2;
  let bi = 0, bd = 1e18; pts.forEach((p, i) => { const d = (p.x - mx) ** 2 + (p.z - mz) ** 2; if (d < bd) { bd = d; bi = i; } });
  const out = pts.slice(bi).concat(pts.slice(0, bi));
  // doppelte Punkte entfernen
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 1).map(p => [p.x, p.z, p.y]);
}

// ---------- Strecken ----------
// ecken: Vieleck der Strecke [x, z, Kurvenradius, Höhe], skala: Grösse. Positionen (items, boost …) als Anteil der Runde ab dem Start.
// abschnitte (fall, bruecke, eis, stil, wand) zählen ab dem ersten Punkt der Strecke, nicht ab dem Start.
const CUPS = [{ name: 'Nitro-Cup', symbol: 'nitro' }, { name: 'Stern-Cup', symbol: 'stern' }];
const STRECKEN = [
  {
    id: 'sonnenwiese', name: 'Sonnenwiesen-Ring', cup: 0, thema: 'wiese', breite: 13, rand: 6, skala: 0.792,
    story: 'Erntefest in Sonnenwil! Rase an der Windmühle vorbei, mitten durch die rote Scheune und über die Hügel der Kuhweide.',
    ecken: [[250, 230, 45], [250, 70, 40], [170, 25, 24], [235, -55, 26], [235, -180, 45, 1], [-10, -210, 50, 3], [-95, -150, 24, 4], [15, -90, 24, 6],
      [35, 15, 32, 8], [-80, 55, 28, 6], [-140, -40, 28, 3], [-250, -50, 40, 1], [-200, 90, 35], [-260, 230, 45]],
    items: [0.06, 0.3, 0.47, 0.685, 0.79], boost: [[0.155, 0], [0.362, -0.4], [0.362, 0.4], [0.93, 0]], rampen: [0.53],
    muenzen: [[0.02, 0.4, 6], [0.145, -0.4, 5], [0.37, 0, 7], [0.56, 0.3, 5], [0.7, -0.3, 5], [0.95, -0.4, 6]],
    abschnitte: [], abk: [[0.04, 0.17, -1]],
    wahrzeichen: [{ typ: 'girlanden', u: 0.975 }, { typ: 'windmuehle', u: 0.21 }, { typ: 'scheune', u: 0.395 }, { typ: 'kuehe', u: 0.6 }, { typ: 'heuballen', u: [0.12, 0.33, 0.5, 0.74, 0.86] }, { typ: 'vogelscheuche', u: 0.68 }],
  },
  {
    id: 'palmenstrand', name: 'Palmenstrand', cup: 0, thema: 'strand', breite: 13, rand: 6, skala: 0.855,
    story: 'Die Piratenbucht ruft! Über den wackligen Holzsteg, vorbei am gestrandeten Piratenschiff und rund ums Leuchtturm-Kap.',
    ecken: [[360, 110, 50], [340, -40, 35], [235, -60, 28], [195, -230, 26], [115, -70, 28], [20, -90, 40], [-60, -200, 30, 1], [-170, -180, 30, 1],
      [-190, -50, 35], [-310, -20, 40], [-380, 110, 50], [-120, 160, 140]],
    items: [0.08, 0.22, 0.42, 0.6, 0.72], boost: [[0.03, 0], [0.53, -0.35], [0.53, 0.35], [0.88, 0]], rampen: [0.66],
    muenzen: [[0.12, 0.3, 6], [0.29, 0, 6], [0.45, -0.3, 5], [0.58, 0.3, 5], [0.74, 0, 6], [0.92, -0.4, 6]],
    abschnitte: [{ von: 0.275, bis: 0.35, fall: true, stil: 'holz' }], abk: [[0.08, 0.16, -1], [0.67, 0.16, -1]],
    wahrzeichen: [{ typ: 'piratentor', u: 0.045 }, { typ: 'piratenschiff', u: 0.31 }, { typ: 'leuchtturm', u: 0.5 }, { typ: 'strandkorb', u: [0.15, 0.62, 0.8] }],
  },
  {
    id: 'wuestenschlucht', name: 'Wüstenschlucht', cup: 0, thema: 'wueste', breite: 13, rand: 5, wandH: 7, skala: 0.765,
    story: 'Auf der Jagd nach dem goldenen Skarabäus: durch die enge Schlucht, unter den Felsbögen hindurch und an der Sphinx vorbei. Achtung, Steinschlag!',
    ecken: [[300, 200, 40], [330, 60, 35], [230, 0, 30], [320, -90, 30], [250, -200, 40, 3], [120, -150, 30, 4], [60, -240, 28, 4], [-60, -170, 35, 3],
      [-20, -60, 30, 2], [-140, -10, 28], [-250, -120, 40], [-330, 0, 35], [-250, 120, 30], [-300, 210, 40], [0, 180, 150]],
    items: [0.07, 0.17, 0.39, 0.6, 0.91], boost: [[0.495, 0], [0.66, -0.35], [0.66, 0.35], [0.97, 0]], rampen: [0.79],
    muenzen: [[0.03, -0.4, 6], [0.2, 0.3, 5], [0.42, 0, 6], [0.56, -0.3, 5], [0.7, 0.3, 5], [0.86, 0, 6]],
    abschnitte: [], abk: [[0.03, 0.14, -1], [0.58, 0.14, -1]],
    steine: [[0.3, -0.42, 0], [0.3, 0.42, 2.8], [0.77, 0, 1.2]],
    wahrzeichen: [{ typ: 'felsbogen', u: 0.12 }, { typ: 'felsbogen', u: 0.64 }, { typ: 'sphinx', u: 0.96 }, { typ: 'skarabaeus', u: 0.5 }],
  },
  {
    id: 'dschungeltempel', name: 'Dschungeltempel', cup: 0, thema: 'dschungel', breite: 13, rand: 5, skala: 0.765, start: 0.62,
    story: 'Der Tempel des Smaragdaffen erwacht! Über die Holzbrücke der grossen Acht, durch das Tempeltor und vorbei an den steinernen Wächtern.',
    ecken: [[0, 0, 10, 11], [150, 150, 45, 2], [300, 210, 45], [400, 80, 50], [330, -110, 40], [200, -60, 26], [150, -170, 30],
      [-150, 150, 45, 0], [-300, 210, 45], [-400, 80, 50], [-330, -110, 40], [-200, -60, 26], [-150, -170, 30, 2]],
    items: [0.04, 0.17, 0.36, 0.54, 0.68, 0.96], boost: [[0.115, 0], [0.61, -0.35], [0.61, 0.35], [0.93, 0]], rampen: [0.87],
    muenzen: [[0.07, 0.3, 5], [0.2, -0.3, 5], [0.42, 0, 7], [0.58, 0.3, 5], [0.73, -0.3, 5], [0.9, 0, 6]],
    abschnitte: [{ von: 0.962, bis: 1, bruecke: true, stil: 'holz', wand: 'holz' }, { von: 0, bis: 0.115, bruecke: true, stil: 'holz', wand: 'holz' }], abk: [[0.03, 0.18, 1], [0.52, 0.19, -1]],
    steine: [[0.28, -0.42, 0], [0.28, 0.42, 2.8], [0.75, 0, 1.4]],
    wahrzeichen: [{ typ: 'tempeltor', u: 0.115 }, { typ: 'wasserfall', u: 0.6 }, { typ: 'affenstatue', u: [0.05, 0.45, 0.8] }],
  },
  {
    id: 'eisgipfel', name: 'Eisgipfel', cup: 1, thema: 'schnee', breite: 13, rand: 6, skala: 0.756,
    story: 'Die Seilbahn ist viel zu langsam! Die Serpentinen hinauf, vorbei an der Skihütte, durch die glitzernde Eishöhle und rasant zurück ins Tal.',
    ecken: [[300, 250, 40, 0], [340, 140, 40, 2], [120, 95, 22, 6], [340, 40, 22, 11], [120, -15, 22, 16], [300, -90, 35, 20], [300, -220, 45, 23],
      [50, -250, 40, 24], [-80, -170, 30, 22], [-200, -230, 35, 20], [-330, -120, 45, 16], [-250, 0, 35, 11], [-330, 120, 40, 6], [-250, 250, 45, 1]],
    items: [0.06, 0.33, 0.55, 0.79, 0.94], boost: [[0.44, -0.35], [0.44, 0.35], [0.66, 0], [0.85, 0]], rampen: [0.485],
    muenzen: [[0.03, 0.3, 6], [0.22, 0, 5], [0.4, -0.3, 6], [0.6, 0.3, 5], [0.72, 0, 6], [0.9, -0.3, 6]],
    abschnitte: [{ von: 0.6, bis: 0.66, eis: true }, { von: 0.83, bis: 0.88, eis: true }], abk: [[0.31, 0.15, -1]],
    steine: [[0.25, -0.42, 0], [0.25, 0.42, 2.8]],
    wahrzeichen: [{ typ: 'seilbahn' }, { typ: 'skihuette', u: 0.47 }, { typ: 'eishoehle', u: 0.547 }],
  },
  {
    id: 'neonstadt', name: 'Neonstadt', cup: 1, thema: 'stadt', breite: 13, rand: 2, skala: 0.675,
    story: 'Mitternachtsrennen in Neonstadt! Durch den Lichtertunnel, hinauf auf die Hochstrasse und vorbei am leuchtenden Riesenrad.',
    ecken: [[300, 230, 30], [300, 40, 30], [170, 40, 28], [170, -230, 30], [-60, -230, 30, 9], [-60, 100, 28, 9], [60, 100, 28, 9],
      [60, -100, 28, 0], [-200, -100, 30], [-300, 230, 30]],
    items: [0.06, 0.15, 0.37, 0.62, 0.8], boost: [[0.28, -0.35], [0.28, 0.35], [0.48, 0], [0.72, 0], [0.93, 0]], rampen: [0.84],
    muenzen: [[0.03, -0.3, 6], [0.2, 0.3, 5], [0.45, 0, 6], [0.6, -0.3, 5], [0.76, 0.3, 6], [0.9, 0, 6]],
    abschnitte: [{ von: 0.405, bis: 0.675, bruecke: true }], abk: [[0.08, 0.14, -1]],
    wahrzeichen: [{ typ: 'tunnel', u: 0.278, laenge: 70 }, { typ: 'riesenrad', u: 0.58 }, { typ: 'neonbogen', u: [0.02, 0.09, 0.8, 0.86] }],
  },
  {
    id: 'lavaburg', name: 'Lavaburg', cup: 1, thema: 'lava', breite: 13, rand: 3, wandH: 2.5, skala: 0.720,
    story: 'Die Burg des Feuerkönigs! Über die Zugbrücken, durch Burgtor und Thronsaal – und pass auf die Steinwächter auf, die herunterkrachen.',
    ecken: [[300, 220, 30, 1], [300, 40, 28, 2], [200, 40, 24, 3], [200, -80, 24, 4], [300, -80, 24, 5], [300, -230, 30, 5], [100, -230, 30, 4],
      [100, -120, 24, 3], [-40, -120, 24, 3], [-40, -230, 28, 2], [-280, -230, 35, 2], [-280, 0, 30, 1], [-160, 60, 30, 1], [-280, 220, 35, 1]],
    items: [0.07, 0.33, 0.505, 0.82, 0.94], boost: [[0.39, 0], [0.62, -0.35], [0.62, 0.35], [0.915, 0]], rampen: [0.412],
    muenzen: [[0.03, 0.3, 6], [0.2, -0.3, 5], [0.36, 0, 5], [0.6, 0, 6], [0.76, -0.3, 5], [0.88, 0.3, 6]],
    abschnitte: [{ von: 0.135, bis: 0.16, fall: true, stil: 'holz' }, { von: 0.7, bis: 0.74, fall: true, stil: 'holz' }], abk: [[0.6, 0.19, -1]],
    steine: [[0.25, -0.42, 0], [0.25, 0.42, 2.8], [0.55, 0, 1.2], [0.86, -0.4, 0.6]],
    wahrzeichen: [{ typ: 'burgtor', u: 0.08 }, { typ: 'thronsaal', u: 0.4, laenge: 70 }, { typ: 'zugbruecke', u: [0.1475, 0.72] }, { typ: 'lavafontaene', u: [0.2, 0.45, 0.78, 0.95] }],
  },
  {
    id: 'regenbogenbahn', name: 'Regenbogenbahn', cup: 1, thema: 'all', breite: 13, rand: 1, skala: 0.702,
    story: 'Eine Reise durch die Sterne! Vom Raumhafen durch funkelnde Sternentore, über Brücken ohne Geländer bis zum Ringplaneten.',
    ecken: [[300, 260, 60, 20], [380, 60, 60, 26], [250, -60, 40, 32], [340, -220, 50, 36], [120, -280, 50, 34], [40, -120, 35, 30], [-60, 40, 40, 24],
      [-200, -100, 40, 20], [-120, -240, 40, 18], [-320, -260, 50, 16], [-400, -40, 50, 18], [-260, 120, 40, 20], [-340, 260, 50, 20]],
    items: [0.06, 0.22, 0.35, 0.54, 0.72, 0.94], boost: [[0.15, 0], [0.42, -0.35], [0.42, 0.35], [0.8, 0]], rampen: [0.47],
    muenzen: [[0.03, 0.3, 6], [0.18, -0.3, 6], [0.38, 0, 6], [0.6, 0.3, 6], [0.76, 0, 6], [0.88, -0.3, 6]],
    abschnitte: [{ von: 0.44, bis: 0.53, fall: true }, { von: 0.76, bis: 0.86, fall: true }], abk: [[0.27, 0.14, -1]],
    steine: [[0.62, -0.4, 0], [0.62, 0.4, 2.8]],
    wahrzeichen: [{ typ: 'sternentor', u: [0.04, 0.17, 0.4, 0.73, 0.9] }, { typ: 'raumstation', u: 0.0 }],
  },
];
const ARENEN = [
  {
    id: 'wuerfelplatz', name: 'Würfelplatz', thema: 'wiese', gr: 58,
    hindernisse: [[0, 0, 12, 12, 3], [-31, -31, 9, 3.5, 2], [31, 31, 9, 3.5, 2], [-31, 31, 3.5, 9, 2], [31, -31, 3.5, 9, 2], [0, -40, 15, 3, 2], [0, 40, 15, 3, 2], [-40, 0, 3, 15, 2], [40, 0, 3, 15, 2]],
    boxen: [[-17, 0], [17, 0], [0, -17], [0, 17], [-45, -45], [45, 45], [-45, 45], [45, -45], [-22, -22], [22, 22], [-22, 22], [22, -22]],
  },
  {
    id: 'mondkrater', name: 'Mondkrater', thema: 'mond', gr: 62, schwerkraft: 0.6,
    hindernisse: [[-18, -18, 7, 7, 4], [18, 18, 7, 7, 4], [-18, 18, 7, 7, 4], [18, -18, 7, 7, 4], [0, -44, 22, 3.5, 3], [0, 44, 22, 3.5, 3], [-44, 0, 3.5, 22, 3], [44, 0, 3.5, 22, 3]],
    boxen: [[0, 0], [-32, 0], [32, 0], [0, -32], [0, 32], [-50, -50], [50, 50], [-50, 50], [50, -50], [-32, -32], [32, 32], [-32, 32], [32, -32]],
  },
];

// ---------- Himmel ----------
function baueHimmel(th, gruppe) {
  const geo = new THREE.SphereGeometry(1900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { oben: { value: new THREE.Color(th.himmel[0]) }, mitte: { value: new THREE.Color(th.himmel[1]) }, unten: { value: new THREE.Color(th.himmel[2]) }, sonne: { value: new THREE.Vector3(0.4, 0.55, 0.3).normalize() }, sonneF: { value: new THREE.Color(th.sonne) }, nacht: { value: th.nacht ? 1 : 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 oben; uniform vec3 mitte; uniform vec3 unten; uniform vec3 sonne; uniform vec3 sonneF; uniform float nacht; varying vec3 vD;
      void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(mitte, oben, pow(clamp(h,0.0,1.0), 0.6)) : mix(mitte, unten, clamp(-h*4.0,0.0,1.0));
        c = mix(unten, c, smoothstep(-0.02, 0.18, h));
        float s = max(dot(normalize(vD), sonne), 0.0);
        c += sonneF * (pow(s, 600.0)*1.5 + pow(s, 12.0)*0.25) * (1.0 - nacht*0.7);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10; m.frustumCulled = false;
  gruppe.add(m);
  if (th.nacht) {
    const R = rng(77);
    const n = th.weltall ? 2500 : 900;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = R() * 2 - 1, a = R() * TAU, r = 1700;
      const y = th.weltall ? u : Math.abs(u) * 0.9 + 0.08;
      const q = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * q * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = Math.sin(a) * q * r;
      const c = new THREE.Color().setHSL(0.55 + R() * 0.2, 0.5, 0.75 + R() * 0.25);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false });
    const sterne = new THREE.Points(sg, sm); sterne.frustumCulled = false; sterne.renderOrder = -9;
    gruppe.add(sterne);
  }
  if (th.weltall) {
    // Planeten und Nebel
    const R = rng(31);
    const farben = ['#ff7ab0', '#7ad0ff', '#ffd27a', '#a07aff'];
    for (let i = 0; i < 4; i++) {
      const a = R() * TAU, r = 1100 + R() * 300, y = 100 + R() * 500;
      const pl = new THREE.Mesh(G.kugel(60 + R() * 90, 32, 20), new THREE.MeshLambertMaterial({ color: farben[i], emissive: new THREE.Color(farben[i]).multiplyScalar(0.25), fog: false }));
      pl.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      gruppe.add(pl);
      if (i % 2 === 0) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(pl.geometry.parameters.radius * 1.4, pl.geometry.parameters.radius * 2.0, 48), new THREE.MeshBasicMaterial({ color: '#ffe0b0', transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }));
        ring.position.copy(pl.position); ring.rotation.x = 1.2; ring.rotation.y = 0.3;
        gruppe.add(ring);
      }
    }
  } else if (!th.nacht) {
    // Wolken
    const R = rng(55);
    const wm = new THREE.SpriteMaterial({ map: Tex.wolke(), transparent: true, depthWrite: false, fog: false, opacity: 0.92 });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(wm);
      const a = R() * TAU, r = 500 + R() * 900;
      s.position.set(Math.cos(a) * r, 140 + R() * 220, Math.sin(a) * r);
      const sc = 160 + R() * 200; s.scale.set(sc, sc * 0.45, 1);
      gruppe.add(s);
    }
  }
}

// ---------- Platzierer für viele gleiche Dinge ----------
// teile: [{ geo, mat, x,y,z, sx,sy,sz, rx,ry,rz }], plaetze: [{ x,y,z,s,r, sy? }]
function streuen(gruppe, teile, plaetze, schatten = true) {
  if (!plaetze.length) return;
  const m4 = new THREE.Matrix4(), t = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const tl of teile) {
    const im = new THREE.InstancedMesh(tl.geo, tl.mat, plaetze.length);
    plaetze.forEach((p, i) => {
      const sy = p.sy || p.s;
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromEuler(e.set(p.rx || 0, p.r || 0, p.rz || 0)), new THREE.Vector3(p.s, sy, p.s));
      t.compose(new THREE.Vector3(tl.x || 0, tl.y || 0, tl.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(tl.rx || 0, tl.ry || 0, tl.rz || 0)), new THREE.Vector3(tl.sx || 1, tl.sy || 1, tl.sz || 1));
      m4.multiply(t);
      im.setMatrixAt(i, m4);
      if (p.farbe && tl.farbig) im.setColorAt(i, new THREE.Color(p.farbe));
    });
    im.castShadow = schatten && tl.schatten !== false; im.receiveShadow = !!tl.empfang;
    im.instanceMatrix.needsUpdate = true;
    gruppe.add(im);
  }
}

function bezier(a, b, c, d, t, out) {
  const u = 1 - t;
  return (out || new THREE.Vector3()).set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
}
const STEIN_H = 7.5;        // Höhe, auf der die Steinblöcke warten
const STEIN_TAKT = 5.6;     // Sekunden pro Fall

// ---------- Streckenbauer ----------
class Strecke {
  constructor(def) {
    this.def = def; this.istArena = false;
    this.th = THEMEN[def.thema];
    this.gruppe = new THREE.Group();
    this.anim = [];       // Funktionen, die jedes Bild aufgerufen werden (Wasser, Lava, ...)
    this.boxPlaetze = []; this.muenzPlaetze = []; this.boosts = []; this.rampen = [];
    this.abk = []; this.steine = [];
    this.berechne();
  }
  berechne() {
    const d = this.def;
    // Rohform auf Ziellänge skalieren
    if (!d.pts) d.pts = kurs(d.ecken, d.skala);
    let raw = d.pts.map(p => new THREE.Vector3(p[0], p[2] || 0, p[1]));
    let c0 = new THREE.CatmullRomCurve3(raw, true, 'centripetal');
    c0.arcLengthDivisions = 3000;
    const k = d.laenge ? d.laenge / c0.getLength() : 1;
    raw = raw.map(v => new THREE.Vector3(v.x * k, v.y, v.z * k));
    const curve = new THREE.CatmullRomCurve3(raw, true, 'centripetal');
    curve.arcLengthDivisions = 4000;
    this.curve = curve;
    const L = curve.getLength();
    const N = Math.round(L / 2);
    this.L = L; this.n = N; this.ds = L / N;
    const S = this.S = [];
    const nP = raw.length;
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const t = curve.getUtoTmapping(u);
      const p = curve.getPoint(t);
      const seg = t * nP, ki = Math.floor(seg) % nP, f = seg - Math.floor(seg);
      const w0 = d.pts[ki][3] || d.breite, w1 = d.pts[(ki + 1) % nP][3] || d.breite;
      S.push({ p, w: lerp(w0, w1, smooth(f)), u });
    }
    // Höhenprofil überschreiben (z.B. Rampen zur Hochstrasse)
    if (d.hoehen) {
      const H = d.hoehen;
      for (const s of S) {
        let y = H[0][1];
        for (let j = 0; j < H.length - 1; j++) if (s.u >= H[j][0] && s.u <= H[j + 1][0]) y = lerp(H[j][1], H[j + 1][1], smooth((s.u - H[j][0]) / (H[j + 1][0] - H[j][0])));
        if (s.u > H[H.length - 1][0] || s.u < H[0][0]) y = H[0][1];
        s.p.y = y;
      }
    }
    // Richtung, Krümmung
    for (let i = 0; i < N; i++) {
      const a = S[(i - 1 + N) % N].p, b = S[(i + 1) % N].p;
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      S[i].t = t;
      S[i].h = Math.atan2(t.x, t.z);
    }
    const kr = [];
    for (let i = 0; i < N; i++) kr.push(wrapA(S[(i + 1) % N].h - S[(i - 1 + N) % N].h) / (2 * this.ds));
    for (let i = 0; i < N; i++) {
      let s = 0; for (let j = -6; j <= 6; j++) s += kr[(i + j + N) % N];
      S[i].k = s / 13;
    }
    // Abschnitte
    for (const s of S) {
      s.fall = false; s.bruecke = false; s.eis = false; s.stil = this.th.strasse; s.wand = this.th.wand;
      for (const a of d.abschnitte || []) {
        if (s.u >= a.von && s.u < a.bis) {
          if (a.fall !== undefined) s.fall = a.fall;
          if (a.bruecke) s.bruecke = true;
          if (a.eis) s.eis = true;
          if (a.stil) s.stil = a.stil;
          if (a.wand) s.wand = a.wand;
        }
      }
    }
    // Neigung in Kurven, Rahmen
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      let k2 = 0; for (let j = -10; j <= 10; j++) k2 += S[(i + j + N) % N].k; k2 /= 21;
      S[i].bank = clamp(k2 * 5.5, -0.2, 0.2) * (d.neigung === undefined ? 1 : d.neigung);
    }
    // In geneigten Kurven die Mitte anheben, damit der innere Rand nicht absinkt
    for (const s of S) s.p.y += Math.abs(Math.tan(s.bank)) * (s.w + (s.fall ? 1.2 : d.rand));
    for (let i = 0; i < N; i++) S[i].t = new THREE.Vector3().subVectors(S[(i + 1) % N].p, S[(i - 1 + N) % N].p).normalize();
    for (let i = 0; i < N; i++) {
      const s = S[i];
      s.rh = new THREE.Vector3(-Math.cos(s.h), 0, Math.sin(s.h));
      s.r = s.rh.clone().multiplyScalar(Math.cos(s.bank)).addScaledVector(up, Math.sin(s.bank)).normalize();
      s.n = new THREE.Vector3().crossVectors(s.r, s.t).normalize();
      s.tanB = Math.tan(s.bank);
      s.rand = s.fall ? 1.2 : d.rand;
      s.lim = s.w + s.rand;
      s.s = i * this.ds;
    }
    // Ideallinie für Computerfahrer
    for (let i = 0; i < N; i++) {
      let k3 = 0; for (let j = -4; j <= 22; j++) k3 += S[(i + j + N) % N].k; k3 /= 27;
      S[i].ideal = clamp(-k3 * 260, -0.62, 0.62) * S[i].w;
      let vor = 0; for (let j = 8; j <= 40; j++) vor = Math.max(vor, Math.abs(S[(i + j) % N].k));
      S[i].kurveVor = vor;
    }
    for (let pass = 0; pass < 3; pass++) {
      const id = S.map(s => s.ideal);
      for (let i = 0; i < N; i++) { let a = 0; for (let j = -8; j <= 8; j++) a += id[(i + j + N) % N]; S[i].ideal = a / 17; }
    }
    // Grenzen
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (const s of S) { mnx = Math.min(mnx, s.p.x); mxx = Math.max(mxx, s.p.x); mnz = Math.min(mnz, s.p.z); mxz = Math.max(mxz, s.p.z); }
    this.box = { mnx, mxx, mnz, mxz, cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2, r: Math.max(mxx - mnx, mxz - mnz) / 2 };
    // Start
    this.startS = (d.start || 0) * L;
    this.abkBerechnen();
    // Belegungsraster (für Deko)
    this.raster = new Map();
    for (const s of S) {
      const rr = s.lim + 4 + (s.bruecke ? 0 : Math.max(0, s.p.y - (this.bodenY() || 0)) * 1.3);
      const c = 6;
      for (let x = -rr; x <= rr; x += c) for (let z = -rr; z <= rr; z += c) {
        if (x * x + z * z > rr * rr) continue;
        this.raster.set(Math.floor((s.p.x + x) / c) + ',' + Math.floor((s.p.z + z) / c), 1);
      }
    }
    for (const A of this.abk) for (const q of A.P) {
      const rr = A.lim + 4, c = 6;
      for (let x = -rr; x <= rr; x += c / 2) for (let z = -rr; z <= rr; z += c / 2) if (x * x + z * z <= rr * rr) this.raster.set(Math.floor((q.p.x + x) / c) + ',' + Math.floor((q.p.z + z) / c), 1);
    }
  }
  // ---------- Abkürzungen ----------
  // Ein schmaler Weg quer durchs Innenfeld (Bézierkurve zwischen zwei Punkten der Strecke).
  // Eingang eng, danach ein Stück hohes Gras (bremst stark, ausser mit Turbo oder Stern), dann ein holpriger Weg.
  // Der Weg liegt auf dem Boden; in der Lava ein Felsdamm, im Weltall ein Sternenpfad – dort ohne Geländer.
  // Wo er die Strecke berührt, ist die Seite zur Strecke hin offen (keine Wand).
  abkBerechnen() {
    const d = this.def, L = this.L, th = d.thema, boden = this.th.wasser ? 0 : this.bodenY();
    this.abk = [];
    (d.abk || []).forEach(([u1, sp, sd], nr) => {
      const s1 = u1 * L + this.startS, s2 = s1 + sp * L;
      const A1 = this.S[this.idx(s1)], A2 = this.S[this.idx(s2)];
      const d0 = sd * A1.w * 0.5, d3 = sd * A2.w * 0.5;
      const p0 = this.punkt(s1, d0), p3 = this.punkt(s2, d3);
      const ch = p0.distanceTo(p3);
      const p1 = p0.clone().addScaledVector(A1.t, ch * 0.25), p2 = p3.clone().addScaledVector(A2.t, -ch * 0.25);
      // fein abtasten, dann gleichmässig alle ~2 m ein Punkt
      const fein = [{ p: p0.clone(), l: 0 }];
      for (let i = 1; i <= 400; i++) { const q = bezier(p0, p1, p2, p3, i / 400); fein.push({ p: q, l: fein[i - 1].l + q.distanceTo(fein[i - 1].p) }); }
      const len = fein[400].l, n = Math.max(8, Math.round(len / 2)), P = [];
      let j = 0;
      for (let i = 0; i <= n; i++) {
        const l = i / n * len;
        while (j < 399 && fein[j + 1].l < l) j++;
        const f = clamp((l - fein[j].l) / Math.max(1e-6, fein[j + 1].l - fein[j].l), 0, 1);
        P.push({ p: fein[j].p.clone().lerp(fein[j + 1].p, f), s: l });
      }
      const fall = !!th && (th === 'all' || this.th.lavaSee);
      const A = { nr, P, len, s1: ((s1 % L) + L) % L, span: sp * L, seite: sd, d0, d3, fall, rauh: th === 'stadt' ? 0.9 : 0.84 };
      // Wo verlässt der Weg die Strecke? (für Höhe, Engstelle und hohes Gras)
      const o = {};
      A.ein = -1;
      for (const q of P) {
        this.projHaupt(o, q.p.x, q.p.y, q.p.z);
        q.mitte = Math.abs(o.d) < o.lim && Math.abs(o.bodenY - q.p.y) < 2.5;
        q.haupt = o.bodenY;
        if (A.ein < 0 && Math.abs(o.d) > o.w + 0.6) A.ein = (((o.s - A.s1) % L) + L) % L;
      }
      let iE = P.findIndex(q => !q.mitte), iA = P.length - 1 - [...P].reverse().findIndex(q => !q.mitte);
      if (iE < 0) { iE = 0; iA = P.length - 1; }
      const sE = P[iE].s, sA = P[iA].s;
      A.grasBis = sE + (sA - sE) * (th === 'strand' ? 0.42 : 0.35);
      // Höhe: auf dem Gelände (mit kurzer Rampe an den Enden), sonst als Damm
      const tief = boden !== null && !this.th.lavaSee && Math.max(P[iE].p.y, P[iA].p.y) - boden < 4.5;
      for (const q of P) {
        if (tief && !q.mitte) {
          const ab = Math.min(q.s - sE, sA - q.s), f = smooth(clamp(1 - ab / 16, 0, 1));
          q.p.y = boden + 0.08 + (q.p.y - boden - 0.08) * f;
        }
        // Breite: am Eingang eng
        const eng = smooth(clamp((q.s - sE - 14) / 10, 0, 1)) * smooth(clamp((sA - q.s + 4) / 10, 0, 1));
        q.w = lerp(fall ? 3.2 : 2.7, fall ? 3.6 : 3.8, eng);
        q.lim = q.w + (fall ? 0.4 : 1.2);
        q.gras = q.s >= sE - 6 && q.s < A.grasBis;
      }
      for (let i = 0; i <= n; i++) {
        const q = P[i];
        q.t = new THREE.Vector3().subVectors(P[Math.min(n, i + 1)].p, P[Math.max(0, i - 1)].p).normalize();
        q.h = Math.atan2(q.t.x, q.t.z);
        q.rh = new THREE.Vector3(-Math.cos(q.h), 0, Math.sin(q.h));
        q.n = new THREE.Vector3().crossVectors(q.rh, q.t).normalize();
      }
      let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
      for (const q of P) {
        mnx = Math.min(mnx, q.p.x); mxx = Math.max(mxx, q.p.x); mnz = Math.min(mnz, q.p.z); mxz = Math.max(mxz, q.p.z);
        this.projHaupt(o, q.p.x, q.p.y, q.p.z);
        q.offen = Math.abs(o.d) < o.lim + q.lim + 0.5 && Math.abs(o.bodenY - q.p.y) < 3 ? ((o.cx - q.p.x) * q.rh.x + (o.cz - q.p.z) * q.rh.z > 0 ? 1 : -1) : 0;
      }
      A.lim = 5; A.w = 3.8;
      const r = A.lim + 8;
      A.box = { mnx: mnx - r, mxx: mxx + r, mnz: mnz - r, mxz: mxz + r };
      this.abk.push(A);
    });
  }
  // Lage eines Punkts zur Abkürzung (null = nicht in der Nähe)
  abkLage(A, x, y, z) {
    const b = A.box;
    if (x < b.mnx || x > b.mxx || z < b.mnz || z > b.mxz) return null;
    const P = A.P, n = P.length;
    let best = 0, bd = 1e18;
    for (let i = 0; i < n; i++) { const p = P[i].p, dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < bd) { bd = dd; best = i; } }
    let a = Math.min(best, n - 2), b2 = a + 1;
    const seg = () => { const sx = P[b2].p.x - P[a].p.x, sz = P[b2].p.z - P[a].p.z; return ((x - P[a].p.x) * sx + (z - P[a].p.z) * sz) / (sx * sx + sz * sz); };
    let f = seg();
    if (f < 0 && a > 0) { a--; b2--; f = seg(); }
    if ((f < -0.02 && a === 0) || (f > 1.02 && b2 === n - 1)) return null;
    f = clamp(f, 0, 1);
    const A0 = P[a], B0 = P[b2], o = this._lage || (this._lage = {});
    o.a = a; o.f = f; o.A0 = A0; o.B0 = B0;
    o.cx = lerp(A0.p.x, B0.p.x, f); o.cy = lerp(A0.p.y, B0.p.y, f); o.cz = lerp(A0.p.z, B0.p.z, f);
    if (Math.abs(y - o.cy) > 6) return null;
    const hx = lerp(A0.rh.x, B0.rh.x, f), hz = lerp(A0.rh.z, B0.rh.z, f), hl = Math.hypot(hx, hz);
    o.hx = hx / hl; o.hz = hz / hl;
    o.d = (x - o.cx) * o.hx + (z - o.cz) * o.hz;
    return o;
  }
  abkLim(q) { return lerp(q.A0.lim, q.B0.lim, q.f); }
  imKorridor(x, y, z, extra = 0) {
    for (const A of this.abk) { const q = this.abkLage(A, x, y, z); if (q && Math.abs(q.d) < this.abkLim(q) + extra) return true; }
    return false;
  }
  // Punkt auf der Abkürzung bei lokaler Länge s (davor und danach weiter auf der Strecke)
  abkPunkt(A, s, d, out) {
    out = out || new THREE.Vector3();
    if (s >= A.len) return this.punkt(A.s1 + A.span + (s - A.len), A.d3 * 0.6 + d, out);
    if (s <= 0) return this.punkt(A.s1 + s, A.d0 + d, out);
    const n = A.P.length - 1, f = s / A.len * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const a = A.P[i], b = A.P[i + 1];
    out.lerpVectors(a.p, b.p, t);
    out.x += lerp(a.rh.x, b.rh.x, t) * d; out.z += lerp(a.rh.z, b.rh.z, t) * d;
    return out;
  }
  bodenY() { return this.th.lavaSee ? -2 : this.th.wasser ? -0.6 : this.th.boden ? 0 : null; }
  frei(x, z) { return !this.raster.has(Math.floor(x / 6) + ',' + Math.floor(z / 6)); }
  idx(s) { const N = this.n; return (((Math.round(s / this.ds) % N) + N) % N); }
  // Weltpunkt bei Streckenposition s und seitlichem Abstand d
  punkt(s, d, out) {
    s = ((s % this.L) + this.L) % this.L;
    const f = s / this.ds, i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
    const A = this.S[i], B = this.S[j];
    out = out || new THREE.Vector3();
    out.lerpVectors(A.p, B.p, t);
    const rx = lerp(A.r.x, B.r.x, t), ry = lerp(A.r.y, B.r.y, t), rz = lerp(A.r.z, B.r.z, t);
    const rl = Math.hypot(rx, rz) || 1;
    out.x += rx / rl * d; out.z += rz / rl * d; out.y += ry / rl * d;
    return out;
  }
  richtung(s) { const A = this.S[this.idx(s)]; return A.h; }
  // Nächster Streckenpunkt (lokale Suche um den letzten Index, sonst global)
  suche(x, y, z, hint) {
    const S = this.S, N = this.n;
    let best = -1, bd = 1e18;
    if (hint >= 0) {
      for (let k = -10; k <= 10; k++) {
        const i = (hint + k + N) % N, p = S[i].p;
        const dx = p.x - x, dz = p.z - z, dy = p.y - y;
        const dd = dx * dx + dz * dz + (Math.abs(dy) > 5 ? dy * dy * 4 : 0);
        if (dd < bd) { bd = dd; best = i; }
      }
      if (bd < 40 * 40) return best;
    }
    for (let i = 0; i < N; i++) {
      const p = S[i].p;
      const dx = p.x - x, dz = p.z - z, dy = p.y - y;
      const dd = dx * dx + dz * dz + dy * dy * 4;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }
  // Projektion: füllt o.si, o.s, o.d, o.boden { y, nx, ny, nz }, o.lim, o.fall, o.flaeche
  proj(o, x, y, z) {
    this.projHaupt(o, x, y, z);
    o.ab = -1; o.offen = 0;
    if (this.abk.length) {
      // Liegt der Punkt auf dieser Höhe überhaupt auf der Strecke? (Strecken über- und untereinander)
      const hauptPasst = Math.abs(y - o.bodenY) < 3.5;
      const aufStrasse = hauptPasst && Math.abs(o.d) <= o.w + 0.6;
      for (const A of this.abk) {
        if (aufStrasse) break;
        const q = this.abkLage(A, x, y, z);
        if (!q) continue;
        const lim = this.abkLim(q);
        // ohne Geländer: etwas breiter mitzählen, damit man herunterfällt statt zur Strecke zu springen
        if (Math.abs(q.d) > lim + (A.fall ? 6 : 0)) continue;
        if (hauptPasst && Math.abs(y - q.cy) > Math.abs(y - o.bodenY) + 1.5 && Math.abs(o.d) <= o.lim) continue;
        // Auf der Abkürzung: Werte relativ zu ihr, Fortschritt auf die Strecke umgerechnet
        const aufHaupt = Math.abs(o.d) <= o.lim && Math.abs(o.bodenY - q.cy) < 2.5;
        o.ab = A.nr; o.abS = q.A0.s + q.f * (q.B0.s - q.A0.s);
        o.abH = q.A0.h + wrapA(q.B0.h - q.A0.h) * q.f;
        o.d = q.d; o.hx = q.hx; o.hz = q.hz; o.w = lerp(q.A0.w, q.B0.w, q.f); o.lim = lim;
        o.offen = (q.f < 0.5 ? q.A0 : q.B0).offen;
        if (!aufHaupt) {
          o.bodenY = q.cy;
          o.nx = lerp(q.A0.n.x, q.B0.n.x, q.f); o.ny = lerp(q.A0.n.y, q.B0.n.y, q.f); o.nz = lerp(q.A0.n.z, q.B0.n.z, q.f);
          o.fall = A.fall;
        } else o.fall = false;
        o.eis = false;
        o.s = (A.s1 + o.abS / A.len * A.span) % this.L;
        o.flaeche = Math.abs(q.d) <= o.w && !(q.f < 0.5 ? q.A0 : q.B0).gras ? 'piste' : 'gelaende';
        o.rauh = A.rauh;
        break;
      }
    }
    return o;
  }
  projHaupt(o, x, y, z) {
    const S = this.S, N = this.n;
    let i = this.suche(x, y, z, o.si === undefined ? -1 : o.si);
    let a = i, b = (i + 1) % N;
    let A = S[a], B = S[b];
    let sx = B.p.x - A.p.x, sz = B.p.z - A.p.z;
    let f = ((x - A.p.x) * sx + (z - A.p.z) * sz) / (sx * sx + sz * sz);
    if (f < 0) {
      a = (i - 1 + N) % N; b = i; A = S[a]; B = S[b];
      sx = B.p.x - A.p.x; sz = B.p.z - A.p.z;
      f = ((x - A.p.x) * sx + (z - A.p.z) * sz) / (sx * sx + sz * sz);
    }
    f = clamp(f, 0, 1);
    o.si = i;
    const cx = lerp(A.p.x, B.p.x, f), cy = lerp(A.p.y, B.p.y, f), cz = lerp(A.p.z, B.p.z, f);
    const hx = lerp(A.rh.x, B.rh.x, f), hz = lerp(A.rh.z, B.rh.z, f);
    const hl = Math.hypot(hx, hz);
    const d = ((x - cx) * hx + (z - cz) * hz) / hl;
    o.cx = cx; o.cz = cz;
    o.s = A.s + f * this.ds;
    o.d = d;
    o.hx = hx / hl; o.hz = hz / hl;
    o.w = lerp(A.w, B.w, f);
    o.lim = lerp(A.lim, B.lim, f);
    const tb = lerp(A.tanB, B.tanB, f);
    o.bodenY = cy + d * tb;
    o.nx = lerp(A.n.x, B.n.x, f); o.ny = lerp(A.n.y, B.n.y, f); o.nz = lerp(A.n.z, B.n.z, f);
    const seg = f < 0.5 ? A : B;
    o.fall = seg.fall; o.eis = seg.eis; o.seg = seg;
    const ad = Math.abs(d);
    o.flaeche = ad <= o.w ? 'strasse' : ad <= o.w + 1.2 ? 'rand' : 'gelaende';
    if (seg.stil === 'regenbogen' || this.def.thema === 'stadt') if (o.flaeche === 'gelaende') o.flaeche = 'rand';
    return o;
  }
  // ---------- Aufbau der Grafik ----------
  baue(qual) {
    const g = this.gruppe, th = this.th, S = this.S, N = this.n, d = this.def;
    baueHimmel(th, g);
    const bodenY = this.bodenY();
    // Boden
    if (th.boden) {
      const bm = new THREE.MeshLambertMaterial({ map: Tex.boden(th.boden).clone() });
      bm.map.needsUpdate = true; bm.map.repeat.set(160, 160);
      const boden = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), bm);
      boden.rotation.x = -Math.PI / 2; boden.position.set(this.box.cx, bodenY === null ? 0 : (th.lavaSee || th.wasser ? bodenY - 0.4 : bodenY - 0.15), this.box.cz);
      boden.receiveShadow = true;
      if (th.lavaSee) {
        boden.material = new THREE.MeshBasicMaterial({ map: Tex.lava().clone(), color: '#ffffff' });
        boden.material.map.needsUpdate = true; boden.material.map.repeat.set(60, 60);
        boden.position.y = bodenY;
        this.anim.push(t => { boden.material.map.offset.set(t * 0.004, t * 0.002); });
      }
      if (th.wasser) {
        // Wasser auf einer Seite, Sand auf der anderen
        const wm = new THREE.MeshLambertMaterial({ map: Tex.wasser().clone(), transparent: true, opacity: 0.9 });
        wm.map.needsUpdate = true; wm.map.repeat.set(80, 80);
        const wasser = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), wm);
        wasser.rotation.x = -Math.PI / 2; wasser.position.set(0, bodenY, 0);
        this.anim.push(t => { wm.map.offset.set(Math.sin(t * 0.3) * 0.02, t * 0.01); });
        g.add(wasser);
        // Sandinsel: grosse Fläche, die das Wasser verdeckt ausser beim Steg
        const sand = this.sandinsel(bodenY);
        g.add(sand);
        boden.visible = false;
      }
      g.add(boden);
    }
    this.baueStrasse(qual);
    this.baueAbk();
    this.baueStart();
    this.baueFeatures();
    Wahrzeichen.baue(this);
    this.baueDeko(qual);
    // Wasser-/Lavaplane als "tödlicher Boden"
    this.todY = bodenY === null ? -60 : (th.lavaSee || th.wasser) ? bodenY - 0.5 : -30;
  }
  sandinsel(y) {
    // Strand: Sandfläche als Polygon um die Strecke herum, ohne den Stegbereich
    const shape = new THREE.Shape();
    const R = 1;
    const pts = [];
    for (let a = 0; a < 64; a++) {
      const w = a / 64 * TAU;
      let r = 0;
      // Radius: weitester Streckenpunkt in diese Richtung + Rand, ohne Steg
      for (const s of this.S) {
        if (s.fall) continue;
        const dx = s.p.x - this.box.cx, dz = s.p.z - this.box.cz;
        const ang = Math.atan2(dz, dx);
        if (Math.abs(wrapA(ang - w)) < 0.25) r = Math.max(r, Math.hypot(dx, dz) + 30);
      }
      if (!r) r = 60;
      pts.push(new THREE.Vector2(this.box.cx + Math.cos(w) * r, -(this.box.cz + Math.sin(w) * r)));
    }
    shape.setFromPoints(pts);
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 20, pos.getY(i) / 20);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: Tex.boden('sand') }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0;
    m.receiveShadow = true;
    // Strandkante
    const kante = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: '#f3e2b8' }));
    kante.rotation.x = -Math.PI / 2; kante.position.y = -0.35; kante.scale.set(1.04, 1.04, 1);
    kante.position.x = -this.box.cx * 0.04; kante.position.z = -this.box.cz * 0.04;
    const gg = new THREE.Group(); gg.add(m, kante);
    return gg;
  }
  baueStrasse(qual) {
    const S = this.S, N = this.n, th = this.th, g = this.gruppe;
    const bodenY = this.bodenY();
    // Strassenoberfläche, nach Stil gruppiert
    const stile = {};
    const add = (key, arr) => { (stile[key] = stile[key] || []).push(arr); };
    const V = (s, off, dy = 0) => {
      const p = s.p, r = s.r;
      return [p.x + r.x * off, p.y + r.y * off + dy, p.z + r.z * off];
    };
    const quads = { strasse: {}, rand: [], schulter: [], boeschung: [], unter: [] };
    const wandProben = { '-1': new Array(N).fill(null), '1': new Array(N).fill(null) };
    const wandSeg = { '-1': new Array(N).fill(false), '1': new Array(N).fill(false) };
    const strassenGeo = {};
    const pushQuad = (arr, a, b, c, d2, uv) => { arr.push({ a, b, c, d: d2, uv }); };
    for (let i = 0; i < N; i++) {
      const A = S[i], B = S[(i + 1) % N];
      const vA = A.s / (A.w * 2), vB = (A.s + this.ds) / (A.w * 2);
      // Strasse
      const key = A.stil;
      (quads.strasse[key] = quads.strasse[key] || []).push({ a: V(A, -A.w, 0.02), b: V(A, A.w, 0.02), c: V(B, B.w, 0.02), d: V(B, -B.w, 0.02), uv: [[0, vA], [1, vA], [1, vB], [0, vB]] });
      // Randsteine
      for (const sd of [-1, 1]) {
        const w0 = A.w * sd, w1 = (A.w + 1.2) * sd, x0 = B.w * sd, x1 = (B.w + 1.2) * sd;
        const rv = A.s / 4, rv2 = (A.s + this.ds) / 4;
        if (A.stil !== 'regenbogen' && A.stil !== 'holz') quads.rand.push({ a: V(A, w0, 0.06), b: V(A, w1, 0.06), c: V(B, x1, 0.06), d: V(B, x0, 0.06), uv: [[0, rv], [1, rv], [1, rv2], [0, rv2]], flip: sd < 0 });
        // Schulter (Gelände)
        if (A.rand > 1.3) {
          const y0 = A.w + 1.2, y1 = A.lim;
          const p = [V(A, y0 * sd, 0.03), V(A, y1 * sd, 0.03), V(B, (B.lim) * sd, 0.03), V(B, (B.w + 1.2) * sd, 0.03)];
          quads.schulter.push({ a: p[0], b: p[1], c: p[2], d: p[3], welt: true, flip: sd < 0 });
        }
        // Wände
        let wall = !A.fall && !B.fall && A.wand !== 'keine';
        const hW = A.wand === 'leucht' ? 1.0 : (this.def.wandH || (A.wand === 'schnee' ? 1.6 : A.wand === 'fels' ? 6 : 1.3));
        const lim0 = (A.lim + 0.15) * sd, lim1 = (B.lim + 0.15) * sd;
        const p0 = V(A, lim0), p1 = V(B, lim1);
        // Lücke in der Wand, wo eine Abkürzung abzweigt
        if (wall && this.abk.length) {
          const tiefe = A.wand === 'fels' ? [0, 3, 6, 9.5] : A.wand === 'schnee' ? [0, 1.5, 2.4] : [0, 0.6];
          for (const t of tiefe) {
            const x0 = p0[0] + A.rh.x * sd * t, z0 = p0[2] + A.rh.z * sd * t, x1 = p1[0] + B.rh.x * sd * t, z1 = p1[2] + B.rh.z * sd * t;
            if (this.imKorridor(x0, p0[1], z0, 0.6) || this.imKorridor(x1, p1[1], z1, 0.6)) { wall = false; break; }
          }
        }
        wandSeg[sd][i] = wall;
        wandProben[sd][i] = { x: p0[0], y: p0[1], z: p0[2], ax: A.rh.x * sd, az: A.rh.z * sd, s: A.s, stil: A.wand, h: hW };
        // Böschung bzw. Unterseite
        const ausLim = A.lim * sd, ausLimB = B.lim * sd;
        const pA = V(A, ausLim), pB = V(B, ausLimB);
        if (A.bruecke || A.fall || bodenY === null || th.lavaSee || th.wasser && A.fall) {
          // dicke Platte
          const dick = 1.6;
          quads.unter.push({ a: [pA[0], pA[1] - dick, pA[2]], b: [pB[0], pB[1] - dick, pB[2]], c: [pB[0], pB[1] + 0.02, pB[2]], d: [pA[0], pA[1] + 0.02, pA[2]], flip: sd < 0 });
        } else {
          const hA = Math.max(0, A.p.y - bodenY), hB = Math.max(0, B.p.y - bodenY);
          const eA = 1.5 + hA * 1.3, eB = 1.5 + hB * 1.3;
          const qA = [pA[0] + A.rh.x * eA * sd, bodenY - 0.4, pA[2] + A.rh.z * eA * sd];
          const qB = [pB[0] + B.rh.x * eB * sd, bodenY - 0.4, pB[2] + B.rh.z * eB * sd];
          quads.boeschung.push({ a: pA, b: qA, c: qB, d: pB, welt: true, flip: sd < 0 });
        }
      }
      if (A.bruecke || A.fall || bodenY === null || th.lavaSee) {
        const dick = 1.6;
        const a = V(A, -A.lim, -dick), b = V(A, A.lim, -dick), c = V(B, B.lim, -dick), d2 = V(B, -B.lim, -dick);
        quads.unter.push({ a: b, b: a, c: d2, d: c });
      }
    }
    const baueGeo = (list, weltUV, uvSkala = 8) => {
      const pos = [], uv = [], idx = [];
      let v = 0;
      for (const q of list) {
        const P = q.flip ? [q.a, q.d, q.c, q.b] : [q.a, q.b, q.c, q.d];
        const U = q.uv ? (q.flip ? [q.uv[0], q.uv[3], q.uv[2], q.uv[1]] : q.uv) : null;
        for (let k = 0; k < 4; k++) {
          pos.push(P[k][0], P[k][1], P[k][2]);
          if (weltUV || !U) uv.push(P[k][0] / uvSkala, P[k][2] / uvSkala + P[k][1] / uvSkala);
          else uv.push(U[k][0], U[k][1]);
        }
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    for (const key in quads.strasse) {
      let mat;
      if (key === 'regenbogen') {
        const tex = Tex.regenbogen();
        mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
        this.anim.push(t => { tex.offset.y = -t * 0.35; });
      } else if (key === 'holz') {
        const tex = Tex.wand('holz').clone(); tex.needsUpdate = true; tex.repeat.set(1, 1); tex.rotation = Math.PI / 2;
        mat = new THREE.MeshLambertMaterial({ map: tex });
      } else mat = new THREE.MeshLambertMaterial({ map: Tex.strasse(key) });
      // Fahrbahn gewinnt immer gegen Boden und Böschung darunter
      mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2;
      const m = new THREE.Mesh(baueGeo(quads.strasse[key]), mat);
      m.receiveShadow = true;
      g.add(m);
    }
    if (quads.rand.length) {
      const rm = this.def.thema === 'all' ? null : new THREE.MeshLambertMaterial({ map: Tex.randstein(this.th.nacht ? '#ffcf3a' : '#e8322f', this.th.nacht ? '#2a2a30' : '#ffffff') });
      if (rm) { const m = new THREE.Mesh(baueGeo(quads.rand), rm); m.receiveShadow = true; g.add(m); }
    }
    if (quads.schulter.length) {
      const sm = new THREE.MeshLambertMaterial({ map: Tex.boden(this.th.boden || 'gras') });
      const m = new THREE.Mesh(baueGeo(quads.schulter, true, 20), sm); m.receiveShadow = true; g.add(m);
    }
    if (quads.boeschung.length) {
      const bm = new THREE.MeshLambertMaterial({ map: Tex.boden(this.th.boden === 'stadt' ? 'stadt' : (this.th.boden || 'gras')) });
      const m = new THREE.Mesh(baueGeo(quads.boeschung, true, 20), bm); m.receiveShadow = true; g.add(m);
    }
    if (quads.unter.length) {
      const um = this.def.thema === 'all'
        ? new THREE.MeshBasicMaterial({ color: '#3a1a6a', transparent: true, opacity: 0.7 })
        : new THREE.MeshLambertMaterial({ map: Tex.wand(this.th.wand === 'burg' ? 'burg' : this.def.thema === 'strand' || this.def.thema === 'dschungel' ? 'holz' : 'beton') });
      const m = new THREE.Mesh(baueGeo(quads.unter, false), um); g.add(m);
    }
    // Wände: zusammenhängende Stücke mit mitlaufendem Profil
    for (const sd of ['-1', '1']) {
      const seg = wandSeg[sd], pr = wandProben[sd];
      const gilt = i => seg[i] || seg[(i - 1 + N) % N];
      let start = 0; while (start < N && gilt(start)) start++;
      const ganz = start >= N;
      if (ganz) start = 0;
      const liste = [];
      for (let k = 0; k <= N; k++) {
        const i = (start + k) % N;
        if (!gilt(i)) { liste.push(null); continue; }
        const q = Object.assign({}, pr[i]);
        if (k > 0 && start + k >= N) q.s += this.L;   // über die Ziellinie hinweg weiterzählen
        liste.push(q);
      }
      for (const st of Waende.stuecke(liste)) Waende.lauf(this, g, st.pk, st.stil, { h: st.h, zu: ganz });
    }
    // Brückenpfeiler
    const pfeiler = [];
    for (let i = 0; i < N; i += 10) {
      const s = S[i];
      if (!(s.bruecke || (bodenY === null) || (this.th.lavaSee && s.p.y > -1))) continue;
      for (const sd of [-1, 1]) {
        const x = s.p.x + s.rh.x * (s.lim - 1) * sd, z = s.p.z + s.rh.z * (s.lim - 1) * sd;
        // Nicht auf einer anderen Strecke darunter
        let frei = true;
        for (let j = 0; j < N; j += 2) {
          if (Math.abs(j - i) < 30 || Math.abs(j - i) > N - 30) continue;
          const q = S[j];
          if (Math.hypot(q.p.x - x, q.p.z - z) < q.lim + 2 && q.p.y < s.p.y - 2) { frei = false; break; }
        }
        const unten = bodenY === null ? s.p.y - 40 : bodenY - 1;
        const h = s.p.y - 1.6 - unten;
        if (frei && h > 0.5) pfeiler.push({ x, y: unten + h / 2, z, s: 1, sy: h });
      }
    }
    if (pfeiler.length) {
      const pm = this.def.thema === 'all' ? new THREE.MeshBasicMaterial({ color: '#5a2a9a', transparent: true, opacity: 0.5 }) : new THREE.MeshLambertMaterial({ map: Tex.wand(this.th.wand === 'burg' ? 'burg' : this.def.thema === 'dschungel' ? 'holz' : 'beton') });
      streuen(g, [{ geo: G.box(1.6, 1, 1.6), mat: pm }], pfeiler);
    }
  }
  baueStart() {
    const g = this.gruppe, s0 = this.startS;
    const A = this.S[this.idx(s0)];
    // Ziellinie
    const tex = Tex.zielflagge().clone(); tex.needsUpdate = true; tex.repeat.set(A.w * 2 / 3, 1);
    const linie = new THREE.Mesh(new THREE.PlaneGeometry(A.w * 2, 3), new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));
    linie.position.copy(this.punkt(s0, 0)); linie.position.y += 0.07;
    linie.rotation.set(-Math.PI / 2, 0, A.h, 'YXZ');
    linie.rotation.order = 'YXZ'; linie.rotation.set(-Math.PI / 2 + 0, A.h, 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, A.h, 0));
    linie.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
    linie.receiveShadow = true;
    g.add(linie);
    // Torbogen
    const tor = new THREE.Group();
    const breite = A.lim + 1.5;
    const pm = Mat.std(this.th.nacht ? '#3a3f4a' : '#e8ecf2', { roughness: 0.4, metalness: 0.4 });
    for (const sd of [-1, 1]) tor.add(M(G.box(1.2, 10, 1.2), pm, breite * sd, 5, 0));
    const bTex = Tex.canvas(512, 64, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff3b2f'); gr.addColorStop(1, '#b8160e');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) for (let y = 0; y < 2; y++) { c.fillStyle = (x / 16 + y) % 2 ? '#111' : '#fff'; c.fillRect(x, y * 8, 16, 8); c.fillRect(x, h - 16 + y * 8, 16, 8); }
      c.font = '900 38px "Lilita One", system-ui'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = '#6a0a05'; c.strokeText('TURBO-KART', w / 2, h / 2 + 1); c.fillText('TURBO-KART', w / 2, h / 2 + 1);
    });
    const bt = new THREE.CanvasTexture(bTex);
    const banner = M(G.box(breite * 2 + 1.2, 2.4, 0.5), [pm, pm, pm, pm, new THREE.MeshLambertMaterial({ map: bt }), new THREE.MeshLambertMaterial({ map: bt })], 0, 10, 0);
    tor.add(banner);
    // Ampel
    const ampel = new THREE.Group();
    ampel.add(M(G.box(4.6, 1.5, 0.6), Mat.std('#1a1c22', { roughness: 0.5 }), 0, 0, 0));
    this.ampelLichter = [];
    for (let i = 0; i < 3; i++) {
      const l = M(G.kugel(0.45, 14, 10), new THREE.MeshStandardMaterial({ color: '#333', emissive: new THREE.Color('#000'), roughness: 0.3 }), -1.4 + i * 1.4, 0, 0.32);
      ampel.add(l); this.ampelLichter.push(l);
    }
    ampel.position.set(0, 7.8, 0.3);
    tor.add(ampel);
    tor.position.copy(this.punkt(s0 + 4, 0));
    tor.rotation.y = A.h;
    g.add(tor);
  }
  baueFeatures() {
    const g = this.gruppe, d = this.def, L = this.L;
    // Item-Würfel-Reihen
    for (const u of d.items || []) {
      const s = u * L + this.startS;
      const A = this.S[this.idx(s)];
      for (const f of [-0.6, -0.2, 0.2, 0.6]) {
        const p = this.punkt(s, f * A.w); p.y += 1.3;
        this.boxPlaetze.push(p);
      }
    }
    // Münzen
    for (const [u, df, n] of d.muenzen || []) {
      for (let k = 0; k < n; k++) {
        const s = u * L + this.startS + k * 4;
        const A = this.S[this.idx(s)];
        const p = this.punkt(s, df * A.w); p.y += 1.0;
        this.muenzPlaetze.push(p);
      }
    }
    // Turbo-Felder
    const tt = Tex.turbo();
    const bmat = new THREE.MeshBasicMaterial({ map: tt, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 });
    this.anim.push(t => { tt.offset.y = -t * 1.6; });
    for (const [u, df] of d.boost || []) {
      const s = u * L + this.startS;
      const A = this.S[this.idx(s)];
      const dd = df * A.w;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), bmat);
      const p = this.punkt(s, dd); m.position.copy(p); m.position.y += 0.09;
      // flach hinlegen und um 180° drehen, damit die Pfeile in Fahrtrichtung zeigen
      m.quaternion.copy(this.lage(A)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
      g.add(m);
      this.boosts.push({ s: ((s % L) + L) % L, d: dd, b: 2.2, l: 3.6 });
    }
    // Sprungschanzen
    for (const u of d.rampen || []) {
      const s = u * L + this.startS;
      const A = this.S[this.idx(s)];
      const geo = new THREE.BufferGeometry();
      const w = A.w;
      // Keil: 6 lang, 0.9 hoch
      const pts = [[-w, 0, -3], [w, 0, -3], [w, 0.9, 3], [-w, 0.9, 3], [-w, 0, 3], [w, 0, 3]];
      const pos = []; const uv = [];
      const tri = (a, b, c, ua, ub, uc) => { pos.push(...pts[a], ...pts[b], ...pts[c]); uv.push(...ua, ...ub, ...uc); };
      tri(0, 2, 1, [0, 0], [1, 1], [1, 0]); tri(0, 3, 2, [0, 0], [0, 1], [1, 1]);
      tri(3, 4, 5, [0, 1], [0, 0], [1, 0]); tri(3, 5, 2, [0, 1], [1, 0], [1, 1]);
      tri(0, 4, 3, [0, 0], [1, 0], [1, 1]); tri(1, 2, 5, [0, 0], [1, 1], [1, 0]);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      const rt = Tex.holen('rampe', () => Tex.aus(Tex.canvas(128, 64, (c, W, H) => {
        for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#1e5bff' : '#ffd23a'; c.fillRect(i * 16, 0, 16, H); }
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, W, 6);
      })));
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: rt }));
      const p = this.punkt(s, 0); m.position.copy(p);
      m.quaternion.copy(this.lage(A));
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      this.rampen.push({ s: ((s % L) + L) % L, w: A.w });
    }
    this.baueSteine();
    this.baueBremsen();
  }
  // Grafik der Abkürzungen: hohes Gras am Eingang, Weg, Ränder mit Wandprofil, Unterbau, Wegweiser und Münzen
  baueAbk() {
    if (!this.abk.length) return;
    const g = this.gruppe, th = this.th, bodenY = this.bodenY(), thema = this.def.thema;
    const weg = { wiese: 'dschungel', strand: 'holz', wueste: 'sand', dschungel: 'dschungel', schnee: 'schnee', stadt: 'stadt', lava: 'burg', all: 'regenbogen' }[thema] || 'dschungel';
    const gras = { wiese: 'gras', strand: 'sand', wueste: 'sand', dschungel: 'dschungel', schnee: 'schnee', stadt: 'stadt', lava: 'lava', all: 'mond' }[thema] || 'gras';
    const wandStil = { wiese: 'holz', strand: 'holz', wueste: 'fels', dschungel: 'holz', schnee: 'schnee', stadt: 'beton' }[thema];
    const o = {};
    // Höhe eines Punkts: auf der Hauptstrecke deren Oberfläche, sonst die der Abkürzung
    const Y = (x, y, z) => { this.projHaupt(o, x, y, z); return Math.abs(o.d) <= o.lim && Math.abs(o.bodenY - y) < 2.5 ? o.bodenY : y; };
    const flaechen = { weg: [], gras: [] }, unter = [], boesch = [], pfeiler = [], buesche = [];
    const quad = (arr, a, b, c, d2, uvs) => arr.push([a, b, c, d2, uvs]);
    const R = rng(hashStr(this.def.id) + 5);
    for (const A of this.abk) {
      const P = A.P;
      const rand = (q, d, dy = 0) => { const x = q.p.x + q.rh.x * d, z = q.p.z + q.rh.z * d; return [x, Y(x, q.p.y, z) + dy, z]; };
      const wandPk = { '-1': [], '1': [] };
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        const va = a.s / 7.6, vb = b.s / 7.6;
        // Fahrfläche (bis zum Rand, damit kein Spalt bleibt)
        const art = a.gras ? 'gras' : 'weg';
        quad(flaechen[art], rand(a, -a.lim, 0.05), rand(a, a.lim, 0.05), rand(b, b.lim, 0.05), rand(b, -b.lim, 0.05), [[0, va], [1, va], [1, vb], [0, vb]]);
        for (const sd of [-1, 1]) {
          // Ränder: Wandprofil wie an der Strecke (nicht auf der offenen Seite und nicht auf der Strecke selbst)
          if (wandStil && !A.fall) {
            const zu = a.offen === sd || a.mitte;
            if (zu) { if (wandPk[sd].length) { Waende.lauf(this, g, wandPk[sd], wandStil, { h: wandStil === 'fels' ? 2.6 : undefined }); wandPk[sd] = []; } }
            else { const w0 = rand(a, (a.lim + 0.15) * sd); wandPk[sd].push({ x: w0[0], y: w0[1], z: w0[2], ax: a.rh.x * sd, az: a.rh.z * sd, s: a.s }); }
          }
          if (a.mitte && b.mitte) continue;
          const e0 = rand(a, a.lim * sd), e1 = rand(b, b.lim * sd);
          if (bodenY === null) quad(unter, [e0[0], e0[1] - 1.6, e0[2]], [e1[0], e1[1] - 1.6, e1[2]], [e1[0], e1[1] + 0.05, e1[2]], [e0[0], e0[1] + 0.05, e0[2]]);
          else {
            // Böschung bis zum Boden (in der Lava ein Felsdamm)
            const tief = bodenY - 0.4, hA = Math.max(0, a.p.y - tief), hB = Math.max(0, b.p.y - tief);
            const eA = 0.8 + hA * 1.1, eB = 0.8 + hB * 1.1;
            quad(boesch, [e0[0], e0[1] + 0.04, e0[2]], [e0[0] + a.rh.x * eA * sd, tief, e0[2] + a.rh.z * eA * sd], [e1[0] + b.rh.x * eB * sd, tief, e1[2] + b.rh.z * eB * sd], [e1[0], e1[1] + 0.04, e1[2]]);
          }
          // Büsche und Steine neben dem hohen Gras verstecken den Eingang ein wenig
          if (a.gras && i % 2 === 0 && R() < 0.8) {
            const ab = a.lim + 1.2 + R() * 3;
            buesche.push({ x: a.p.x + a.rh.x * ab * sd, y: Y(a.p.x, a.p.y, a.p.z), z: a.p.z + a.rh.z * ab * sd, s: 0.9 + R() * 0.9, r: R() * TAU });
          }
        }
        if (bodenY === null && !(a.mitte && b.mitte)) {
          const l0 = rand(a, -a.lim, -1.6), r0 = rand(a, a.lim, -1.6), l1 = rand(b, -b.lim, -1.6), r1 = rand(b, b.lim, -1.6);
          quad(unter, r0, l0, l1, r1);
          if (i % 8 === 0) { const unten = a.p.y - 40, h = a.p.y - 1.6 - unten; pfeiler.push({ x: a.p.x, y: unten + h / 2, z: a.p.z, s: 1, sy: h }); }
        }
      }
      if (wandStil && !A.fall) for (const sd of ['-1', '1']) if (wandPk[sd].length) Waende.lauf(this, g, wandPk[sd], wandStil, { h: wandStil === 'fels' ? 2.6 : undefined });
      // Büschel im hohen Gras (in der Stadt: Baustelle mit Pylonen)
      for (const q of P) if (q.gras && !q.mitte) for (let k = 0; k < (thema === 'stadt' ? 1 : 3); k++) {
        if (thema === 'stadt' && R() < 0.6) continue;
        const d = (R() * 2 - 1) * q.w;
        buesche.push({ x: q.p.x + q.rh.x * d, y: q.p.y + 0.05, z: q.p.z + q.rh.z * d, s: 0.7 + R() * 0.5, sy: 0.6 + R() * 0.6, r: R() * TAU, halm: true });
      }
      // Wegweiser am Eingang (auf der Seite weg von der Strecke)
      const k0 = Math.max(0, P.findIndex(q => !q.mitte) - 1), e = P[k0];
      const sd = e.offen ? -e.offen : 1;
      const x = e.p.x + e.rh.x * (e.lim + 1.3) * sd, z = e.p.z + e.rh.z * (e.lim + 1.3) * sd, y = Y(x, e.p.y, z);
      const sch = new THREE.Group();
      const holz = Mat.lam('#7a5232');
      sch.add(M(G.box(0.22, 2.6, 0.22), holz, 0, 1.3, 0));
      const pfeil = new THREE.Shape(); pfeil.moveTo(-1.2, -0.35); pfeil.lineTo(0.6, -0.35); pfeil.lineTo(0.6, -0.6); pfeil.lineTo(1.3, 0); pfeil.lineTo(0.6, 0.6); pfeil.lineTo(0.6, 0.35); pfeil.lineTo(-1.2, 0.35); pfeil.lineTo(-1.2, -0.35);
      const pm = M(new THREE.ExtrudeGeometry(pfeil, { depth: 0.12, bevelEnabled: false }), Mat.lam('#ffd23a'), 0, 2.2, 0.12, 0, Math.PI / 2 * (sd > 0 ? 1 : -1) + Math.PI / 2, 0);
      sch.add(pm);
      sch.position.set(x, y, z); sch.rotation.y = e.h;
      sch.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.add(sch);
      // Münzen als Belohnung
      for (let i = 0; i < 5; i++) { const p = this.abkPunkt(A, A.len * (0.45 + i * 0.07), 0); p.y += 1.0; this.muenzPlaetze.push(p); }
    }
    const geo = (list, weltUV) => {
      const pos = [], uv = [], idx = [];
      list.forEach((q, n) => {
        for (let k = 0; k < 4; k++) { pos.push(...q[k]); if (q[4] && !weltUV) uv.push(...q[4][k]); else uv.push(q[k][0] / 14, q[k][2] / 14 + q[k][1] / 14); }
        const v = n * 4; idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      });
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      gg.setIndex(idx); gg.computeVertexNormals();
      return gg;
    };
    const off = m => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; m.side = THREE.DoubleSide; return m; };
    let wm;
    if (weg === 'regenbogen') wm = off(new THREE.MeshBasicMaterial({ map: Tex.regenbogen(), transparent: true, opacity: 0.92 }));
    else if (weg === 'holz') { const t = Tex.wand('holz').clone(); t.needsUpdate = true; t.rotation = Math.PI / 2; wm = off(new THREE.MeshLambertMaterial({ map: t })); }
    else wm = off(new THREE.MeshLambertMaterial({ map: Tex.strasse(weg) }));
    if (flaechen.weg.length) { const m = new THREE.Mesh(geo(flaechen.weg), wm); m.receiveShadow = true; g.add(m); }
    if (flaechen.gras.length) {
      const gm = thema === 'all' ? off(new THREE.MeshBasicMaterial({ map: Tex.boden(gras), color: '#b088ff', transparent: true, opacity: 0.95 })) : off(new THREE.MeshLambertMaterial({ map: Tex.boden(gras), color: thema === 'lava' ? '#ffffff' : '#d8e8c8' }));
      const m = new THREE.Mesh(geo(flaechen.gras, true), gm); m.receiveShadow = true; g.add(m);
    }
    if (boesch.length) {
      const bm = th.lavaSee ? new THREE.MeshStandardMaterial({ color: '#3a2420', flatShading: true, roughness: 1, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ map: Tex.boden(th.boden === 'stadt' ? 'stadt' : (th.boden || 'gras')), side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo(boesch, true), bm); m.receiveShadow = true; m.castShadow = !!th.lavaSee; g.add(m);
    }
    if (unter.length) g.add(new THREE.Mesh(geo(unter, true), new THREE.MeshBasicMaterial({ color: '#3a1a6a', transparent: true, opacity: 0.7, side: THREE.DoubleSide })));
    if (pfeiler.length) streuen(g, [{ geo: G.box(1.4, 1, 1.4), mat: new THREE.MeshBasicMaterial({ color: '#5a2a9a', transparent: true, opacity: 0.5 }) }], pfeiler);
    if (buesche.length) {
      const farbe = { wiese: '#4aa83f', strand: '#9ab85a', wueste: '#b0804a', dschungel: '#3a9a3a', schnee: '#eef4fb', stadt: '#6a6e78' }[thema] || '#4aa83f';
      const busch = buesche.filter(b => !b.halm), halm = buesche.filter(b => b.halm);
      streuen(g, [{ geo: thema === 'wueste' || thema === 'stadt' ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0), mat: Mat.lam(farbe, { flatShading: true }), y: 0.5, sy: 0.75 }], busch);
      if (thema === 'stadt') streuen(g, [{ geo: G.kegel(0.38, 0.95, 8), mat: Mat.lam('#ff6a10'), y: 0.5 }, { geo: G.zyl(0.26, 0.3, 0.15, 8), mat: Mat.lam('#ffffff'), y: 0.55 }, { geo: G.box(0.9, 0.08, 0.9), mat: Mat.lam('#ff6a10'), y: 0.04 }], halm.map(h => Object.assign(h, { s: 1, sy: 1 })));
      else if (thema === 'schnee') streuen(g, [{ geo: G.kugel(0.7, 7, 5), mat: Mat.lam('#ffffff', { flatShading: true }), y: 0.1, sy: 0.45 }], halm, false);
      else if (thema === 'lava') streuen(g, [{ geo: new THREE.DodecahedronGeometry(0.45, 0), mat: Mat.lam('#2a1a16', { flatShading: true }), y: 0.15, sy: 0.6 }, { geo: G.kugel(0.12, 5, 4), mat: new THREE.MeshBasicMaterial({ color: '#ff7a10' }), y: 0.35, x: 0.2 }], halm, false);
      else if (thema === 'all') streuen(g, [{ geo: new THREE.OctahedronGeometry(0.35, 0), mat: new THREE.MeshBasicMaterial({ color: '#fff6a0' }), y: 0.4, sy: 1.6 }], halm, false);
      else {
        const hm = Mat.lam(thema === 'wueste' || thema === 'strand' ? '#c8a860' : '#5aaa3a', { flatShading: true });
        const h = G.kegel(0.09, 0.9, 3);
        streuen(g, [{ geo: h, mat: hm, y: 0.42 }, { geo: h, mat: hm, x: 0.18, y: 0.38, rz: -0.35 }, { geo: h, mat: hm, x: -0.16, y: 0.38, rz: 0.4 }, { geo: h, mat: hm, z: 0.17, y: 0.36, rx: 0.4 }], halm, false);
      }
    }
  }
  // Steinblöcke mit grimmigem Gesicht, die immer wieder auf die Strecke krachen
  baueSteine() {
    const d = this.def, L = this.L, g = this.gruppe;
    this.steine = [];
    if (!d.steine) return;
    const stil = { wueste: 'fels', schnee: 'schnee' }[d.thema] || 'burg';
    const tex = Tex.wand(stil).clone(); tex.needsUpdate = true;
    const farbe = d.thema === 'schnee' ? '#bfe6ff' : d.thema === 'all' ? '#9a8ac8' : '#ffffff';
    const steinM = new THREE.MeshLambertMaterial({ map: tex, color: farbe });
    const dunkel = Mat.std('#1a1418', { roughness: 0.6 }), weiss = Mat.std('#ffffff', { roughness: 0.4 }), stachel = Mat.std('#8a8490', { roughness: 0.5 });
    const schattenM = new THREE.MeshBasicMaterial({ map: Tex.punkt(), color: '#000', transparent: true, opacity: 0.3, depthWrite: false });
    for (const [u, df, phase] of d.steine) {
      const s = u * L + this.startS, A = this.S[this.idx(s)];
      const dd = df * A.w, p = this.punkt(s, dd);
      const grp = new THREE.Group();
      const koerper = new THREE.Group();
      koerper.add(M(G.box(3.8, 3.4, 3.0), steinM, 0, 1.7, 0));
      // Gesicht schaut den Fahrern entgegen
      const z = -1.52;
      for (const sx of [-1, 1]) {
        koerper.add(M(G.box(0.85, 0.6, 0.08), weiss, sx * 0.8, 2.25, z));
        koerper.add(M(G.box(0.34, 0.4, 0.06), dunkel, sx * 0.62, 2.18, z - 0.05));
        koerper.add(M(G.box(1.05, 0.24, 0.12), dunkel, sx * 0.8, 2.75, z - 0.02, 0, 0, -sx * 0.38));
      }
      koerper.add(M(G.box(2.3, 0.62, 0.08), dunkel, 0, 1.05, z));
      for (let i = 0; i < 5; i++) koerper.add(M(G.box(0.3, 0.26, 0.06), weiss, -0.9 + i * 0.45, 1.24, z - 0.05));
      // Stacheln
      for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) {
        koerper.add(M(G.kegel(0.32, 0.7, 6), stachel, sx * 1.2, 3.75, sz));
        koerper.add(M(G.kegel(0.32, 0.7, 6), stachel, sx * 2.25, 1.7, sz, 0, 0, -sx * Math.PI / 2));
      }
      koerper.traverse(m => { if (m.isMesh) m.castShadow = true; });
      grp.add(koerper);
      grp.position.copy(p); grp.rotation.y = A.h;
      g.add(grp);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4), schattenM.clone());
      sh.position.copy(p); sh.position.y += 0.1;
      sh.quaternion.copy(this.lage(A)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
      sh.renderOrder = 1;
      g.add(sh);
      this.steine.push({ s: ((s % L) + L) % L, d: dd, p: p.clone(), h: A.h, hw: 1.9, hd: 1.5, phase, m: koerper, sh, y: STEIN_H, faellt: false, aufprall: false });
    }
  }
  // Ablauf: warten (zum Schluss zittern), herunterkrachen, liegen bleiben, langsam hochziehen
  steineSchritt(t) {
    for (const st of this.steine) {
      const x = (((t + st.phase) % STEIN_TAKT) + STEIN_TAKT) % STEIN_TAKT;
      let y, zit = false;
      if (x < 2.6) { y = STEIN_H; zit = x > 1.95; }
      else if (x < 2.85) { const f = (x - 2.6) / 0.25; y = STEIN_H * (1 - f * f); }
      else if (x < 4.1) y = 0;
      else y = STEIN_H * smooth((x - 4.1) / 1.5);
      st.aufprall = st.y > 0 && y === 0;
      st.faellt = x >= 2.6 && x < 2.95;
      st.y = y;
      st.m.position.set(zit ? (Math.random() - 0.5) * 0.18 : 0, y, zit ? (Math.random() - 0.5) * 0.18 : 0);
      const nah = 1 - y / STEIN_H;
      st.sh.material.opacity = 0.22 + 0.5 * nah;
      st.sh.scale.setScalar(0.75 + 0.35 * nah);
    }
  }
  // Bremsfallen wie im echten Kart-Spiel: Pfützen (Matsch, Sand, Schnee, Öl …) und Pylonen, die man umfährt
  baueBremsen() {
    const g = this.gruppe, d = this.def, L = this.L;
    this.bremsen = []; this.huetchen = [];
    let h = 7; for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const zufall = rng(h);
    const belegt = [0, ...(d.items || []), ...(d.boost || []).map(b => b[0]), ...(d.rampen || []), ...(d.steine || []).map(x => x[0]), ...(d.abk || []).flatMap(a => [a[0], a[0] + a[1]])];
    const nah = (u, v, m) => { const x = Math.abs(u - v) % 1; return Math.min(x, 1 - x) < m; };
    const frei = u => {
      if (belegt.some(b => nah(u, b, 0.04))) return false;
      for (let k = -4; k <= 4; k++) { const A = this.S[this.idx(u * L + this.startS + k * 2)]; if (A.fall || A.eis) return false; }
      return true;
    };
    const kandidaten = [];
    for (let u = 0.06; u < 0.95; u += 0.01) if (frei(u)) kandidaten.push(u);
    const wahl = (n, abst) => {
      const out = [];
      for (let t = 0; t < 400 && out.length < n && kandidaten.length; t++) {
        const u = kandidaten[(zufall() * kandidaten.length) | 0];
        if (out.every(v => !nah(u, v, abst)) && belegt.every(v => !nah(u, v, 0.04))) { out.push(u); belegt.push(u); }
      }
      return out;
    };
    const art = { wiese: 'matsch', dschungel: 'matsch', strand: 'sand', wueste: 'sand', schnee: 'schnee', stadt: 'oel', lava: 'asche', all: 'glibber' }[d.thema] || 'matsch';
    const farben = { matsch: ['#6b4a2b', '#4f3520', '#8a6440'], sand: ['#d9b46a', '#c49a50', '#f0d08e'], schnee: ['#f4f8ff', '#cfe0f2', '#ffffff'],
      oel: ['#15161c', '#2a2440', '#4a3a7a'], asche: ['#3a3434', '#252020', '#5a4a44'], glibber: ['#b04ae0', '#7a2aa8', '#e6a0ff'] }[art];
    const tex = Tex.holen('pfuetze-' + art, () => Tex.aus(Tex.canvas(128, 128, (c, W, H) => {
      const z = rng(art.length * 977);
      c.fillStyle = farben[0];
      for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(W / 2 + (z() - 0.5) * 50, H / 2 + (z() - 0.5) * 60, 22 + z() * 22, 18 + z() * 26, z() * 3, 0, TAU); c.fill(); }
      c.fillStyle = farben[1];
      for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(W / 2 + (z() - 0.5) * 40, H / 2 + (z() - 0.5) * 50, 10 + z() * 14, 8 + z() * 12, z() * 3, 0, TAU); c.fill(); }
      c.fillStyle = farben[2]; c.globalAlpha = 0.7;
      for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(W / 2 + (z() - 0.5) * 60, H / 2 + (z() - 0.5) * 70, 3 + z() * 5, 2 + z() * 3, z() * 3, 0, TAU); c.fill(); }
    })));
    const pmat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (const u of wahl(4, 0.1)) {
      const s = u * L + this.startS, A = this.S[this.idx(s)];
      // oft genau auf der Ideallinie: ausweichen kostet Zeit, durchfahren auch
      const dd = clamp(A.ideal + (zufall() - 0.5) * 0.5 * A.w, -0.55 * A.w, 0.55 * A.w);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 6.4), pmat);
      m.position.copy(this.punkt(s, dd)); m.position.y += 0.07;
      m.quaternion.copy(this.lage(A)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, zufall() * TAU)));
      m.receiveShadow = true;
      g.add(m);
      this.bremsen.push({ s: ((s % L) + L) % L, d: dd, b: 2.4, l: 2.8, art });
    }
    // Pylonen-Reihen: umfahren kostet Tempo
    const kegel = new THREE.MeshLambertMaterial({ color: '#ff6a10' }), streifen = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    for (const u of wahl(2, 0.15)) {
      const s = u * L + this.startS, A = this.S[this.idx(s)];
      const seite = zufall() < 0.5 ? -1 : 1;
      for (let k = 0; k < 4; k++) {
        const dd = seite * (0.15 + k * 0.2) * A.w;
        const grp = new THREE.Group();
        grp.add(M(G.kegel(0.42, 1.0, 10), kegel, 0, 0.55, 0), M(G.zyl(0.3, 0.34, 0.16, 10), streifen, 0, 0.62, 0), M(G.box(1.0, 0.1, 1.0), kegel, 0, 0.05, 0));
        const p = this.punkt(s + k * 1.5, dd);
        grp.position.copy(p);
        grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.add(grp);
        this.huetchen.push({ p: p.clone(), m: grp, weg: 0, vx: 0, vy: 0, vz: 0, s: (((s + k * 1.5) % L) + L) % L, d: dd, reihe: u });
      }
    }
    if (this.huetchen.length) this.anim.push(() => {
      const jetzt = performance.now() / 1000;
      for (const h of this.huetchen) {
        if (!h.weg) continue;
        const a = jetzt - h.weg;
        if (a > 6) { h.weg = 0; h.m.position.copy(h.p); h.m.rotation.set(0, 0, 0); h.m.visible = true; continue; }
        if (a < 1.2) {
          h.m.position.set(h.p.x + h.vx * a, h.p.y + h.vy * a - 15 * a * a, h.p.z + h.vz * a);
          h.m.rotation.x = a * 9; h.m.rotation.z = a * 6;
        } else h.m.visible = false;
      }
    });
  }
  // Pylone umgefahren: fliegt weg, Kart wird langsamer
  huetchenTreffer(h, k) {
    h.weg = performance.now() / 1000;
    const sx = Math.sin(k.mYaw), sz = Math.cos(k.mYaw), v = Math.max(6, Math.abs(k.v));
    h.vx = sx * v * 0.6 + (Math.random() - 0.5) * 4; h.vz = sz * v * 0.6 + (Math.random() - 0.5) * 4; h.vy = 5 + Math.random() * 3;
  }
  // Ausrichtung an Steigung und Neigung der Strecke
  lage(A) {
    const z = A.t.clone().normalize(), y = A.n.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    y.crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  // Freie Plätze neben der Strecke suchen
  plaetze(n, abMin, abMax, R, ausser = 0) {
    const out = [];
    const by = this.bodenY() || 0;
    let versuche = 0;
    while (out.length < n && versuche < n * 20) {
      versuche++;
      const s = this.S[(R() * this.n) | 0];
      const sd = R() < 0.5 ? -1 : 1;
      const ab = s.lim + abMin + R() * (abMax - abMin) + Math.max(0, s.p.y - by) * 1.3;
      const x = s.p.x + s.rh.x * ab * sd + (R() - 0.5) * 6, z = s.p.z + s.rh.z * ab * sd + (R() - 0.5) * 6;
      if (!this.frei(x, z)) continue;
      if (ausser && out.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < ausser * ausser)) continue;
      out.push({ x, y: by, z, s: 1, r: R() * TAU });
    }
    return out;
  }
  ring(n, r0, r1, R) {
    const out = [], by = this.bodenY() || 0;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + R() * 0.3, r = this.box.r + r0 + R() * (r1 - r0);
      out.push({ x: this.box.cx + Math.cos(a) * r, y: by, z: this.box.cz + Math.sin(a) * r, s: 1, r: R() * TAU });
    }
    return out;
  }
  baueDeko(qual) {
    const g = this.gruppe, th = this.th, R = rng(hashStr(this.def.id));
    const viel = qual === 'niedrig' ? 0.45 : qual === 'mittel' ? 0.75 : 1;
    const N = x => Math.round(x * viel * clamp(this.L / 1150, 1, 2));
    const by = this.bodenY() || 0;
    // Berge rundum
    if (th.berge) {
      const bm = Mat.lam(th.berge, { flatShading: true });
      const pl = this.ring(28, 260, 520, R).map(p => Object.assign(p, { s: 70 + R() * 90, sy: 60 + R() * 120 }));
      streuen(g, [{ geo: new THREE.ConeGeometry(1, 1, 7), mat: bm, y: 0.5 }], pl, false);
      if (th.bergSchnee) {
        const sm = Mat.lam('#ffffff', { flatShading: true });
        streuen(g, [{ geo: new THREE.ConeGeometry(1, 1, 7), mat: sm, y: 0.84, sx: 0.34, sy: 0.32, sz: 0.34 }], pl, false);
      }
    }
    const baum = (stamm, krone, kroneGeo, kroneY, kroneS) => [
      { geo: G.zyl(0.35, 0.5, 1, 7), mat: Mat.lam(stamm), y: 0.5 },
      { geo: kroneGeo, mat: Mat.lam(krone, { flatShading: true }), y: kroneY, sx: kroneS, sy: kroneS, sz: kroneS },
    ];
    switch (this.def.thema) {
      case 'wiese': {
        const b = this.plaetze(N(160), 4, 60, R, 3).map(p => Object.assign(p, { s: 2 + R() * 2.5 }));
        streuen(g, [{ geo: G.zyl(0.3, 0.45, 2.4, 7), mat: Mat.lam('#7a5232'), y: 1.2 }, { geo: new THREE.IcosahedronGeometry(1.6, 0), mat: Mat.lam('#3f9a3a', { flatShading: true }), y: 3.4 }, { geo: new THREE.IcosahedronGeometry(1.1, 0), mat: Mat.lam('#57b84a', { flatShading: true }), y: 4.6 }], b);
        const t = this.plaetze(N(90), 8, 80, R, 3).map(p => Object.assign(p, { s: 2 + R() * 2 }));
        streuen(g, [{ geo: G.zyl(0.3, 0.4, 1.6, 6), mat: Mat.lam('#6a4428'), y: 0.8 }, { geo: G.kegel(1.6, 3.6, 7), mat: Mat.lam('#2e7d3a', { flatShading: true }), y: 3 }, { geo: G.kegel(1.2, 2.8, 7), mat: Mat.lam('#38904a', { flatShading: true }), y: 4.6 }], t);
        const bl = this.plaetze(N(300), 1, 25, R).map(p => Object.assign(p, { s: 0.6 + R() * 0.5, farbe: ['#ff5a7a', '#ffd23a', '#ffffff', '#b07aff', '#ff8a3a'][(R() * 5) | 0] }));
        streuen(g, [{ geo: G.kugel(0.35, 6, 4), mat: new THREE.MeshLambertMaterial({ color: '#ffffff' }), y: 0.35, farbig: true, schatten: false }, { geo: G.zyl(0.05, 0.05, 0.4, 4), mat: Mat.lam('#3f8a2f'), y: 0.1, schatten: false }], bl, false);
        const bu = this.plaetze(N(80), 2, 40, R).map(p => Object.assign(p, { s: 1 + R() }));
        streuen(g, [{ geo: new THREE.IcosahedronGeometry(1, 0), mat: Mat.lam('#4aa83f', { flatShading: true }), y: 0.6, sy: 0.7 }], bu);
        this.tribuene(R);
        this.ballons(R, 8);
        break;
      }
      case 'strand': {
        const p = this.plaetze(N(110), 3, 50, R, 4).map(q => Object.assign(q, { s: 1 + R() * 0.6, rz: (R() - 0.5) * 0.3 }));
        this.palmen(p, R);
        const sch = this.plaetze(N(30), 3, 25, R, 6).map(q => Object.assign(q, { s: 1, farbe: ['#ff4a5a', '#3a8aff', '#ffd23a', '#2ccf8a'][(R() * 4) | 0] }));
        streuen(g, [{ geo: G.zyl(0.06, 0.06, 3, 5), mat: Mat.lam('#eeeeee'), y: 1.5 }, { geo: G.kegel(2, 0.8, 8), mat: new THREE.MeshLambertMaterial({ color: '#fff' }), y: 3, farbig: true }], sch);
        const st = this.plaetze(N(40), 5, 60, R, 5).map(q => Object.assign(q, { s: 1 + R() * 2.5 }));
        streuen(g, [{ geo: new THREE.DodecahedronGeometry(1, 0), mat: Mat.lam('#9a8a7a', { flatShading: true }), y: 0.4, sy: 0.7 }], st);
        this.huetten(R);
        this.ballons(R, 5);
        break;
      }
      case 'wueste': {
        const k = this.plaetze(N(90), 3, 60, R, 4).map(q => Object.assign(q, { s: 1 + R() * 0.8 }));
        const km = Mat.lam('#3f9a4a', { flatShading: true });
        streuen(g, [{ geo: G.zyl(0.6, 0.7, 5, 8), mat: km, y: 2.5 }, { geo: G.kugel(0.6, 8, 6), mat: km, y: 5 }, { geo: G.zyl(0.4, 0.4, 2, 8), mat: km, x: 1.2, y: 3.2 }, { geo: G.zyl(0.4, 0.4, 1.4, 8), mat: km, x: 0.7, y: 2.2, rz: Math.PI / 2 }, { geo: G.zyl(0.35, 0.35, 1.6, 8), mat: km, x: -1.0, y: 2.8 }, { geo: G.zyl(0.35, 0.35, 1, 8), mat: km, x: -0.6, y: 2.0, rz: Math.PI / 2 }], k);
        const f = this.plaetze(N(40), 10, 90, R, 12).map(q => Object.assign(q, { s: 6 + R() * 8, sy: 10 + R() * 18 }));
        streuen(g, [{ geo: new THREE.CylinderGeometry(0.8, 1, 1, 7), mat: Mat.lam('#c47a45', { flatShading: true }), y: 0.5 }, { geo: new THREE.CylinderGeometry(0.85, 0.8, 0.12, 7), mat: Mat.lam('#e0a060', { flatShading: true }), y: 1.0 }], f);
        // Pyramiden
        const py = this.ring(5, 60, 160, R).map(q => Object.assign(q, { s: 50 + R() * 30, r: R() }));
        streuen(g, [{ geo: new THREE.ConeGeometry(1, 0.75, 4), mat: Mat.lam('#e2b36a', { flatShading: true }), y: 0.375 }], py);
        const st = this.plaetze(N(40), 3, 50, R, 4).map(q => Object.assign(q, { s: 0.8 + R() * 2 }));
        streuen(g, [{ geo: new THREE.DodecahedronGeometry(1, 0), mat: Mat.lam('#b77a4a', { flatShading: true }), y: 0.3, sy: 0.6 }], st);
        this.ballons(R, 4);
        break;
      }
      case 'dschungel': {
        const b = this.plaetze(N(170), 3, 60, R, 4).map(p => Object.assign(p, { s: 2 + R() * 2.5 }));
        streuen(g, [{ geo: G.zyl(0.4, 0.6, 6, 7), mat: Mat.lam('#6a4a2a'), y: 3 }, { geo: new THREE.IcosahedronGeometry(2.4, 0), mat: Mat.lam('#2a8a35', { flatShading: true }), y: 6.5, sy: 0.7 }, { geo: new THREE.IcosahedronGeometry(1.8, 0), mat: Mat.lam('#3aa845', { flatShading: true }), x: 1.2, y: 5.6, sy: 0.6 }], b);
        const fa = this.plaetze(N(160), 1, 30, R).map(p => Object.assign(p, { s: 0.8 + R() * 0.8 }));
        streuen(g, [{ geo: G.kegel(1.2, 1.4, 5), mat: Mat.lam('#4ab84a', { flatShading: true }), y: 0.7 }], fa);
        const p = this.plaetze(N(50), 5, 50, R, 4).map(q => Object.assign(q, { s: 1 + R() * 0.5 }));
        this.palmen(p, R);
        // Tempel in der Mitte
        const tm = new THREE.Group();
        const st = Mat.lam('#a8a07a', { flatShading: true });
        for (let i = 0; i < 6; i++) tm.add(M(G.box(44 - i * 7, 5, 44 - i * 7), st, 0, 2.5 + i * 5, 0));
        tm.add(M(G.box(8, 6, 8), Mat.lam('#8a8060'), 0, 33, 0));
        tm.add(M(G.kugel(2, 12, 8), Mat.leucht('#3affb0', 1.2), 0, 38, 0));
        tm.position.set(this.box.cx, 0, this.box.mnz - 90);
        g.add(tm);
        const tm2 = tm.clone(); tm2.position.set(this.box.cx, 0, this.box.mxz + 90); tm2.scale.setScalar(0.7); g.add(tm2);
        // Säulen
        const sa = this.plaetze(N(30), 2, 20, R, 6).map(q => Object.assign(q, { s: 1, sy: 0.5 + R() }));
        streuen(g, [{ geo: G.zyl(0.9, 1, 6, 8), mat: st, y: 3 }, { geo: G.box(2.4, 0.6, 2.4), mat: st, y: 6.2 }], sa);
        break;
      }
      case 'schnee': {
        const t = this.plaetze(N(200), 3, 70, R, 3).map(p => Object.assign(p, { s: 1.5 + R() * 2 }));
        streuen(g, [{ geo: G.zyl(0.3, 0.4, 1.6, 6), mat: Mat.lam('#5a3a22'), y: 0.8 }, { geo: G.kegel(2, 3.6, 7), mat: Mat.lam('#2a6a4a', { flatShading: true }), y: 3 }, { geo: G.kegel(1.5, 2.8, 7), mat: Mat.lam('#2f7a52', { flatShading: true }), y: 4.6 }, { geo: G.kegel(1.0, 1.2, 7), mat: Mat.lam('#ffffff', { flatShading: true }), y: 5.8 }], t);
        const sm = this.plaetze(N(18), 3, 20, R, 8).map(p => Object.assign(p, { s: 1 }));
        const w = Mat.lam('#ffffff');
        streuen(g, [{ geo: G.kugel(1.2, 12, 8), mat: w, y: 1.1 }, { geo: G.kugel(0.85, 12, 8), mat: w, y: 2.7 }, { geo: G.kugel(0.6, 12, 8), mat: w, y: 3.8 }, { geo: G.kegel(0.15, 0.7, 6), mat: Mat.lam('#ff8a1a'), y: 3.8, z: 0.8, rx: Math.PI / 2 }, { geo: G.zyl(0.5, 0.5, 0.7, 10), mat: Mat.lam('#222'), y: 4.5 }], sm);
        const ei = this.plaetze(N(40), 4, 50, R, 6).map(p => Object.assign(p, { s: 1 + R() * 2.5, rz: (R() - 0.5) * 0.5 }));
        streuen(g, [{ geo: new THREE.OctahedronGeometry(1, 0), mat: new THREE.MeshStandardMaterial({ color: '#9fe6ff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 }), y: 1.5, sy: 2.2 }], ei);
        this.ballons(R, 3);
        break;
      }
      case 'stadt': {
        // Hochhäuser
        const hs = this.plaetze(N(120), 6, 70, R, 14).map(p => Object.assign(p, { s: 8 + R() * 6, sy: 18 + R() * 60, r: Math.round(R() * 4) * Math.PI / 2 }));
        const farben = ['#2a2f45', '#38304a', '#1f3040', '#40354f'];
        for (let i = 0; i < 4; i++) {
          const tex = Tex.fenster(farben[i]).clone(); tex.needsUpdate = true; tex.repeat.set(2, 6);
          const m = new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.7 });
          streuen(g, [{ geo: G.box(1, 1, 1), mat: m, y: 0.5 }], hs.filter((_, k) => k % 4 === i), false);
        }
        // Neonschilder auf den Häusern
        const neon = hs.filter((_, k) => k % 3 === 0).map(p => ({ x: p.x, y: p.sy + 1.5, z: p.z, s: p.s * 0.8, sy: 2.5, r: p.r, farbe: ['#ff2fa8', '#2ff0ff', '#ffe02f', '#7a5aff'][(R() * 4) | 0] }));
        streuen(g, [{ geo: G.box(1, 1, 0.2), mat: new THREE.MeshBasicMaterial({ color: '#ffffff' }), farbig: true }], neon, false);
        // Strassenlampen
        const lp = [];
        for (let i = 0; i < this.n; i += 14) {
          const s = this.S[i];
          for (const sd of [-1, 1]) lp.push({ x: s.p.x + s.rh.x * (s.lim + 1.2) * sd, y: s.p.y, z: s.p.z + s.rh.z * (s.lim + 1.2) * sd, s: 1, r: s.h + (sd > 0 ? 0 : Math.PI) + Math.PI / 2 });
        }
        streuen(g, [{ geo: G.zyl(0.12, 0.15, 6, 6), mat: Mat.lam('#55596a'), y: 3 }, { geo: G.box(0.3, 0.2, 2), mat: Mat.lam('#55596a'), y: 6, z: -0.8 }, { geo: G.box(0.5, 0.15, 0.8), mat: new THREE.MeshBasicMaterial({ color: '#fff2b0' }), y: 5.85, z: -1.4 }], lp, false);
        this.mond();
        break;
      }
      case 'lava': {
        // Burgtürme
        const bt = this.plaetze(N(30), 4, 30, R, 18).map(p => Object.assign(p, { s: 1, sy: 1 + R() * 0.8 }));
        const st = Mat.lam('#4a4450', { flatShading: true });
        streuen(g, [{ geo: G.zyl(4, 4.5, 16, 10), mat: st, y: 8 }, { geo: G.kegel(5, 7, 10), mat: Mat.lam('#6a1a1a', { flatShading: true }), y: 19.5 }, { geo: G.box(1.2, 2, 0.4), mat: new THREE.MeshBasicMaterial({ color: '#ffb040' }), y: 10, z: 4.2 }], bt);
        // Felsen in der Lava
        const fe = this.plaetze(N(60), 6, 90, R, 6).map(p => Object.assign(p, { s: 2 + R() * 5, y: -2 }));
        streuen(g, [{ geo: new THREE.DodecahedronGeometry(1, 0), mat: Mat.lam('#2a1a16', { flatShading: true }), y: 0.3 }], fe);
        // Vulkan
        const vu = new THREE.Group();
        vu.add(M(new THREE.CylinderGeometry(40, 160, 180, 12, 1, true), Mat.lam('#2a1410', { flatShading: true }), 0, 90, 0));
        vu.add(M(new THREE.CircleGeometry(40, 12), new THREE.MeshBasicMaterial({ color: '#ff6a10' }), 0, 178, 0, -Math.PI / 2));
        vu.position.set(this.box.cx + 120, -2, this.box.mxz + 380);
        g.add(vu);
        this.vulkan = vu.position.clone().add(new THREE.Vector3(0, 180, 0));
        break;
      }
      case 'all': {
        // Schwebende Sternbrocken
        const sb = [];
        for (let i = 0; i < N(140); i++) {
          const s = this.S[(R() * this.n) | 0];
          const sd = R() < 0.5 ? -1 : 1, ab = s.lim + 15 + R() * 90;
          sb.push({ x: s.p.x + s.rh.x * ab * sd, y: s.p.y - 30 + R() * 70, z: s.p.z + s.rh.z * ab * sd, s: 0.6 + R() * 2.4, r: R() * TAU, rx: R() * TAU, farbe: ['#ffe07a', '#7af0ff', '#ff7ae0', '#b07aff'][(R() * 4) | 0] });
        }
        streuen(g, [{ geo: new THREE.OctahedronGeometry(1, 0), mat: new THREE.MeshBasicMaterial({ color: '#fff' }), farbig: true }], sb, false);
        break;
      }
    }
  }
  palmen(pl, R) {
    const stamm = Mat.lam('#9a6a3a', { flatShading: true }), blatt = Mat.lam('#2fae3a', { side: THREE.DoubleSide, flatShading: true });
    const teile = [];
    for (let i = 0; i < 5; i++) teile.push({ geo: G.zyl(0.32 - i * 0.03, 0.36 - i * 0.03, 1.8, 6), mat: stamm, x: i * i * 0.06, y: 0.9 + i * 1.7, rz: -i * 0.06 });
    const bg = new THREE.ConeGeometry(0.7, 4.2, 3, 1, true);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; teile.push({ geo: bg, mat: blatt, x: 1.5 + Math.cos(a) * 1.6, y: 8.6, z: Math.sin(a) * 1.6, rx: Math.sin(a) * 1.2, rz: -Math.cos(a) * 1.2 - 0.0, sy: 1, sx: 1, sz: 0.25 }); }
    teile.push({ geo: G.kugel(0.35, 6, 4), mat: Mat.lam('#6a4a2a'), x: 1.5, y: 8.4 });
    streuen(this.gruppe, teile, pl);
  }
  huetten(R) {
    const pl = this.plaetze(6, 6, 30, R, 15);
    streuen(this.gruppe, [{ geo: G.box(5, 3, 5), mat: Mat.lam('#c9935a'), y: 1.5 }, { geo: G.kegel(4.6, 3, 4), mat: Mat.lam('#e0c070', { flatShading: true }), y: 4.5, ry: Math.PI / 4 }], pl);
  }
  tribuene(R) {
    // Tribünen mit Publikum an der Startgeraden
    const g = this.gruppe;
    const s0 = this.startS;
    for (const sd of [-1, 1]) {
      for (const off of [-24, 6]) {
        const A = this.S[this.idx(s0 + off)];
        const ab = A.lim + 6;
        const x = A.p.x + A.rh.x * ab * sd, z = A.p.z + A.rh.z * ab * sd;
        const tr = new THREE.Group();
        const holz = Mat.lam('#d8dce4');
        for (let r = 0; r < 4; r++) tr.add(M(G.box(20, 1, 2), holz, 0, 0.5 + r * 1, r * 2));
        tr.add(M(G.box(21, 0.4, 9), Mat.lam('#e8322f'), 0, 6.5, 3));
        const pl = [];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) if (R() < 0.85) pl.push({ x: -9 + c * 1.2 + (R() - 0.5) * 0.3, y: 1.5 + r * 1, z: r * 2, s: 0.9, farbe: ['#ff5a5a', '#5a9aff', '#ffd23a', '#5adf7a', '#ff9a3a', '#c07aff', '#ffffff'][(R() * 7) | 0] });
        streuen(tr, [{ geo: G.kugel(0.38, 8, 6), mat: new THREE.MeshLambertMaterial({ color: '#fff' }), farbig: true, y: 0.4 }, { geo: G.kugel(0.3, 8, 6), mat: Mat.lam('#ffd9b0'), y: 1.0 }], pl, false);
        tr.position.set(x, this.bodenY() || 0, z);
        tr.rotation.y = A.h + (sd > 0 ? -Math.PI / 2 : Math.PI / 2);
        if (this.frei(x, z)) g.add(tr);
      }
    }
  }
  ballons(R, n) {
    const g = this.gruppe;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      const f = ['#ff4a5a', '#ffd23a', '#3a8aff', '#2ccf8a', '#c07aff'][i % 5];
      b.add(M(G.kugel(6, 16, 12), Mat.lam(f), 0, 8, 0, 0, 0, 0, 1, 1.15, 1));
      b.add(M(G.box(2.2, 1.6, 2.2), Mat.lam('#8a5a2a'), 0, 0, 0));
      const a = R() * TAU, r = this.box.r * (0.6 + R() * 0.9);
      b.position.set(this.box.cx + Math.cos(a) * r, 50 + R() * 50, this.box.cz + Math.sin(a) * r);
      const y0 = b.position.y, ph = R() * 10;
      this.anim.push(t => { b.position.y = y0 + Math.sin(t * 0.3 + ph) * 3; });
      g.add(b);
    }
  }
  mond() {
    const m = new THREE.Mesh(G.kugel(60, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }));
    m.position.set(this.box.cx - 600, 500, this.box.cz - 900);
    this.gruppe.add(m);
  }
}

// ---------- Arena für die Ballon-Schlacht ----------
class Arena {
  constructor(def) {
    this.def = def; this.istArena = true;
    this.th = THEMEN[def.thema];
    this.gruppe = new THREE.Group();
    this.anim = [];
    this.boxPlaetze = []; this.muenzPlaetze = []; this.boosts = []; this.rampen = [];
    this.gr = def.gr;
    this.L = 1; this.n = 1;
    this.box = { cx: 0, cz: 0, r: def.gr, mnx: -def.gr, mxx: def.gr, mnz: -def.gr, mxz: def.gr };
    this.hind = def.hindernisse.map(h => ({ x: h[0], z: h[1], hw: h[2] / 2, hd: h[3] / 2, h: h[4] }));
    this.todY = -50;
    this.schwer = def.schwerkraft || 1;
    for (const [x, z] of def.boxen) this.boxPlaetze.push(new THREE.Vector3(x, 1.3, z));
  }
  bodenY() { return 0; }
  proj(o, x, y, z) {
    o.si = 0; o.s = 0; o.d = 0; o.w = this.gr; o.lim = this.gr;
    o.bodenY = 0; o.nx = 0; o.ny = 1; o.nz = 0;
    o.fall = false; o.eis = false; o.flaeche = 'strasse';
    return o;
  }
  // Kreis gegen Wände: gibt Schiebevektor zurück (oder null)
  wand(x, z, r) {
    let px = 0, pz = 0, hit = false;
    const g = this.gr - r;
    if (x > g) { px += g - x; hit = true; } if (x < -g) { px += -g - x; hit = true; }
    if (z > g) { pz += g - z; hit = true; } if (z < -g) { pz += -g - z; hit = true; }
    for (const h of this.hind) {
      const cx = clamp(x, h.x - h.hw, h.x + h.hw), cz = clamp(z, h.z - h.hd, h.z + h.hd);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { // Mittelpunkt im Kasten
          const ox = (h.hw - Math.abs(x - h.x)), oz = (h.hd - Math.abs(z - h.z));
          if (ox < oz) px += Math.sign(x - h.x) * (ox + r); else pz += Math.sign(z - h.z) * (oz + r);
        } else {
          const d = Math.sqrt(d2);
          px += dx / d * (r - d); pz += dz / d * (r - d);
        }
        hit = true;
      }
    }
    return hit ? { x: px, z: pz } : null;
  }
  frei(x, z) {
    for (const h of this.hind) if (Math.abs(x - h.x) < h.hw + 3 && Math.abs(z - h.z) < h.hd + 3) return false;
    return Math.abs(x) < this.gr - 3 && Math.abs(z) < this.gr - 3;
  }
  baue(qual) {
    const g = this.gruppe, th = this.th, gr = this.gr;
    baueHimmel(th, g);
    const R = rng(hashStr(this.def.id));
    // Boden der Arena
    const bt = Tex.holen('arenaboden-' + this.def.id, () => Tex.aus(Tex.canvas(256, 256, (c, w, h) => {
      const mond = this.def.thema === 'mond';
      c.fillStyle = mond ? '#8a8a9a' : '#d8c9a8'; c.fillRect(0, 0, w, h);
      const RR = rng(3);
      Tex.rauschen(c, w, h, mond ? ['#7a7a8a', '#9a9aaa'] : ['#c8b898', '#e8d8b8', '#bfae8c'], 3000, 1, 3, RR);
      c.strokeStyle = mond ? 'rgba(40,40,60,.35)' : 'rgba(120,100,70,.5)'; c.lineWidth = 3;
      c.strokeRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.strokeRect(4, 4, w - 8, h - 8);
    })));
    bt.repeat.set(gr / 8, gr / 8);
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(gr * 2, gr * 2), new THREE.MeshLambertMaterial({ map: bt }));
    boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
    g.add(boden);
    const aussen = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ map: Tex.boden(th.boden) }));
    aussen.material.map = Tex.boden(th.boden).clone(); aussen.material.map.needsUpdate = true; aussen.material.map.repeat.set(120, 120);
    aussen.rotation.x = -Math.PI / 2; aussen.position.y = -0.05; aussen.receiveShadow = true;
    g.add(aussen);
    // Mittelkreis
    const kreis = new THREE.Mesh(new THREE.RingGeometry(16, 17.5, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }));
    kreis.rotation.x = -Math.PI / 2; kreis.position.y = 0.03; g.add(kreis);
    // Aussenwand
    const wm = this.def.thema === 'mond'
      ? new THREE.MeshStandardMaterial({ color: '#7af0ff', emissive: new THREE.Color('#2a8aa0'), roughness: 0.3, transparent: true, opacity: 0.8 })
      : new THREE.MeshLambertMaterial({ map: Tex.wand('bande') });
    for (let i = 0; i < 4; i++) {
      const w = M(G.box(gr * 2 + 2, 2, 1), wm, 0, 1, 0);
      const a = i * Math.PI / 2;
      w.position.set(Math.sin(a) * (gr + 0.5), 1, Math.cos(a) * (gr + 0.5)); w.rotation.y = a;
      g.add(w);
    }
    // Hindernisse
    const farben = this.def.thema === 'mond' ? ['#5a6aff', '#ff5ab0', '#5affb0', '#ffd23a'] : ['#ff5a4a', '#4a8aff', '#ffd23a', '#4acf6a'];
    this.hind.forEach((h, i) => {
      const m = M(G.box(h.hw * 2, h.h, h.hd * 2), Mat.std(farben[i % 4], { roughness: 0.4 }), h.x, h.h / 2, h.z);
      m.receiveShadow = true; g.add(m);
      const deckel = M(G.box(h.hw * 2 + 0.3, 0.3, h.hd * 2 + 0.3), Mat.std('#ffffff', { roughness: 0.4 }), h.x, h.h + 0.15, h.z);
      g.add(deckel);
    });
    // Umgebung
    if (this.def.thema === 'wiese') {
      const pl = [];
      for (let i = 0; i < 90; i++) { const a = R() * TAU, r = gr + 12 + R() * 80; pl.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, s: 2 + R() * 2, r: R() * TAU }); }
      streuen(g, [{ geo: G.zyl(0.3, 0.45, 2.4, 7), mat: Mat.lam('#7a5232'), y: 1.2 }, { geo: new THREE.IcosahedronGeometry(1.6, 0), mat: Mat.lam('#3f9a3a', { flatShading: true }), y: 3.4 }], pl);
      const bm = Mat.lam(th.berge, { flatShading: true });
      const bp = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = 400 + R() * 200; bp.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, s: 80 + R() * 60, sy: 60 + R() * 90, r: R() }); }
      streuen(g, [{ geo: new THREE.ConeGeometry(1, 1, 7), mat: bm, y: 0.5 }], bp, false);
      // Tribünen
      for (let i = 0; i < 4; i++) {
        const tr = new THREE.Group();
        for (let r = 0; r < 5; r++) tr.add(M(G.box(50, 1, 2), Mat.lam('#d8dce4'), 0, 0.5 + r, r * 2));
        const pls = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 40; c++) if (R() < 0.8) pls.push({ x: -24 + c * 1.2, y: 1.5 + r, z: r * 2, s: 0.9, farbe: ['#ff5a5a', '#5a9aff', '#ffd23a', '#5adf7a', '#ff9a3a'][(R() * 5) | 0] });
        streuen(tr, [{ geo: G.kugel(0.38, 8, 6), mat: new THREE.MeshLambertMaterial({ color: '#fff' }), farbig: true, y: 0.4 }], pls, false);
        const a = i * Math.PI / 2;
        tr.position.set(Math.sin(a) * (gr + 8), 0, Math.cos(a) * (gr + 8)); tr.rotation.y = a + Math.PI;
        g.add(tr);
      }
    } else {
      const kr = [];
      for (let i = 0; i < 60; i++) { const a = R() * TAU, r = gr + 20 + R() * 300; kr.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, s: 4 + R() * 14, sy: 1 + R() * 3, r: R() }); }
      streuen(g, [{ geo: new THREE.TorusGeometry(1, 0.35, 6, 14), mat: Mat.lam('#7a7a88', { flatShading: true }), rx: Math.PI / 2, y: 0 }], kr, false);
      const erde = new THREE.Mesh(G.kugel(120, 32, 24), new THREE.MeshLambertMaterial({ color: '#3a7aff', emissive: new THREE.Color('#0a2a6a'), fog: false }));
      erde.position.set(-500, 400, -900); g.add(erde);
      const land = new THREE.Mesh(G.kugel(121, 16, 12), new THREE.MeshLambertMaterial({ color: '#3aaf4a', fog: false }));
      land.scale.set(1, 0.6, 0.7); land.position.copy(erde.position).add(new THREE.Vector3(20, 30, 30)); g.add(land);
    }
  }
}
