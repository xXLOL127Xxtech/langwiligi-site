'use strict';
// Catch a Mob – Spieldaten: Elemente, Attacken, Mobs, Biome, Gegenstände.
// Neue Mobs oder Attacken ergänzt man einfach als weitere Zeilen in den Tabellen.
(function (G) {
  const CAM = G.CAM = G.CAM || {};

  // ---------- Zufall ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  CAM.mulberry32 = mulberry32; CAM.hash2 = hash2;

  // ---------- Elemente ----------
  CAM.ELEMENTE = ['Normal', 'Feuer', 'Wasser', 'Pflanze', 'Erde', 'Luft', 'Licht', 'Schatten'];
  CAM.EL_FARBE = { Normal: '#b9b4a8', Feuer: '#ff6a2e', Wasser: '#3fa0ff', Pflanze: '#59c25a', Erde: '#b98a4e', Luft: '#9fd8ff', Licht: '#ffe680', Schatten: '#9a5cf0' };
  // Wer stark gegen wen ist (Schaden x2). Umgekehrt halbiert sich der Schaden.
  const STARK = { Feuer: ['Pflanze'], Pflanze: ['Erde'], Erde: ['Luft'], Luft: ['Wasser'], Wasser: ['Feuer'], Licht: ['Schatten'], Schatten: ['Licht'] };
  CAM.STARK = STARK;
  CAM.effekt = function (atkEl, defEls) {
    let m = 1;
    for (const d of defEls) {
      if (!d) continue;
      if ((STARK[atkEl] || []).includes(d)) m *= 2;
      else if ((STARK[d] || []).includes(atkEl)) m *= 0.5;
    }
    return m;
  };

  // ---------- Attacken ----------
  // fx: st = Status (gift, brand, schlaf, furcht) mit Chance p, heal = heilt sich selbst (Anteil der max. LP)
  const M = CAM.MOVES = {
    rammen:        { n: 'Rammen',          el: 'Normal',   pow: 40, acc: 100 },
    genesung:      { n: 'Genesung',        el: 'Normal',   pow: 0,  acc: 100, heal: 0.4 },
    glutbiss:      { n: 'Glutbiss',        el: 'Feuer',    pow: 40, acc: 100 },
    aschesturm:    { n: 'Aschesturm',      el: 'Feuer',    pow: 65, acc: 95,  st: 'brand', p: 30 },
    infernoschrei: { n: 'Infernoschrei',   el: 'Feuer',    pow: 100, acc: 80, st: 'brand', p: 20 },
    moorspritzer:  { n: 'Moorspritzer',    el: 'Wasser',   pow: 40, acc: 100 },
    tiefenwoge:    { n: 'Tiefenwoge',      el: 'Wasser',   pow: 65, acc: 95 },
    flutgrab:      { n: 'Flutgrab',        el: 'Wasser',   pow: 100, acc: 80, st: 'furcht', p: 15 },
    dornenpeitsche:{ n: 'Dornenpeitsche',  el: 'Pflanze',  pow: 40, acc: 100 },
    wuergeranke:   { n: 'Würgeranke',      el: 'Pflanze',  pow: 65, acc: 95,  st: 'gift', p: 30 },
    waldfluch:     { n: 'Waldfluch',       el: 'Pflanze',  pow: 95, acc: 85,  st: 'gift', p: 20 },
    steinwurf:     { n: 'Steinwurf',       el: 'Erde',     pow: 40, acc: 100 },
    beben:         { n: 'Beben',           el: 'Erde',     pow: 65, acc: 95 },
    bergsturz:     { n: 'Bergsturz',       el: 'Erde',     pow: 100, acc: 80, st: 'furcht', p: 15 },
    krallenhieb:   { n: 'Krallenhieb',     el: 'Luft',     pow: 40, acc: 100 },
    sturmschwinge: { n: 'Sturmschwinge',   el: 'Luft',     pow: 65, acc: 95 },
    todesboe:      { n: 'Todesböe',        el: 'Luft',     pow: 95, acc: 85,  st: 'furcht', p: 15 },
    lichtblitz:    { n: 'Lichtblitz',      el: 'Licht',    pow: 40, acc: 100 },
    reinigung:     { n: 'Reinigung',       el: 'Licht',    pow: 0,  acc: 100, heal: 0.4 },
    strahlenlanze: { n: 'Strahlenlanze',   el: 'Licht',    pow: 90, acc: 90 },
    schattenbiss:  { n: 'Schattenbiss',    el: 'Schatten', pow: 40, acc: 100 },
    albtraum:      { n: 'Albtraum',        el: 'Schatten', pow: 60, acc: 90,  st: 'schlaf', p: 35 },
    seelenriss:    { n: 'Seelenriss',      el: 'Schatten', pow: 95, acc: 85,  st: 'furcht', p: 15 },
    // Nur für Riesen-Gegner (Flächenangriffe treffen alle Spieler)
    verderben:     { n: 'Verderben',       el: 'Schatten', pow: 70, acc: 100, aoe: true },
    zorn_feuer:    { n: 'Glutwelle',       el: 'Feuer',    pow: 65, acc: 100, aoe: true, st: 'brand', p: 25 },
    zorn_wasser:   { n: 'Sturmflut',       el: 'Wasser',   pow: 65, acc: 100, aoe: true },
    zorn_pflanze:  { n: 'Dornenmeer',      el: 'Pflanze',  pow: 65, acc: 100, aoe: true, st: 'gift', p: 25 },
    zorn_erde:     { n: 'Erdbeben',        el: 'Erde',     pow: 65, acc: 100, aoe: true },
    zorn_luft:     { n: 'Federhagel',      el: 'Luft',     pow: 65, acc: 100, aoe: true },
    zorn_licht:    { n: 'Prismasturm',     el: 'Licht',    pow: 65, acc: 100, aoe: true },
  };
  for (const k in M) M[k].id = k;
  // Die drei Attacken pro Element in der Reihenfolge, wie sie gelernt werden
  CAM.EL_MOVES = {
    Normal: ['rammen', 'genesung', 'rammen'],
    Feuer: ['glutbiss', 'aschesturm', 'infernoschrei'],
    Wasser: ['moorspritzer', 'tiefenwoge', 'flutgrab'],
    Pflanze: ['dornenpeitsche', 'wuergeranke', 'waldfluch'],
    Erde: ['steinwurf', 'beben', 'bergsturz'],
    Luft: ['krallenhieb', 'sturmschwinge', 'todesboe'],
    Licht: ['lichtblitz', 'reinigung', 'strahlenlanze'],
    Schatten: ['schattenbiss', 'albtraum', 'seelenriss'],
  };
  CAM.EL_ZORN = { Feuer: 'zorn_feuer', Wasser: 'zorn_wasser', Pflanze: 'zorn_pflanze', Erde: 'zorn_erde', Luft: 'zorn_luft', Licht: 'zorn_licht', Schatten: 'verderben', Normal: 'verderben' };

  CAM.STATUS = { gift: 'vergiftet', brand: 'brennt', schlaf: 'schläft', furcht: 'verängstigt' };
  CAM.STATUS_KURZ = { gift: 'GIF', brand: 'BRA', schlaf: 'SCH', furcht: 'ANG' };

  // ---------- Mobs ----------
  // el/el2: Elemente (el2 ab Stufe el2ab), base: LP/Angriff/Verteidigung/Tempo, rar: 0 gewöhnlich, 1 selten, 2 episch, 3 legendär
  // kind = Körperform für die Zeichnung, pal = [Körper, Schatten, Akzent, Augen]
  const F = CAM.FAMILIEN = [
    { n: ['Glutfunke', 'Aschewolf', 'Infernhund'], el: 'Feuer', base: [52, 62, 48, 62], rar: 1, kind: 'quad', opt: { ears: 'point', tail: 'flame' }, pal: ['#4a3a3a', '#2a1c1e', '#ff6a2e', '#ffd54a'] },
    { n: ['Moorblase', 'Sumpfgeist', 'Leichenfürst'], el: 'Wasser', el2: 'Schatten', base: [66, 50, 55, 48], rar: 1, kind: 'blob', pal: ['#2f6a6a', '#18383c', '#7dd9c4', '#d6ff7a'] },
    { n: ['Dornling', 'Knochenranke', 'Waldwürger'], el: 'Pflanze', base: [58, 55, 58, 50], rar: 1, kind: 'skull', pal: ['#d8d2bc', '#7a7560', '#3f9a3f', '#ff4a4a'] },
    { n: ['Steinzahn', 'Gruftbär', 'Berghüter'], el: 'Erde', base: [70, 66, 70, 36], rar: 0, kind: 'quad', opt: { ears: 'round', tail: 'none', mane: true }, pal: ['#6d6354', '#383128', '#c9a05a', '#ffb347'] },
    { n: ['Rabenkind', 'Nachtkrähe', 'Unheilsfürst'], el: 'Luft', el2: 'Schatten', base: [46, 58, 42, 78], rar: 0, kind: 'bird', pal: ['#2b2438', '#15101f', '#6c5aa6', '#ff5a5a'] },
    { n: ['Lichtwisp', 'Irrlicht', 'Seelenlaterne'], el: 'Licht', base: [48, 58, 44, 72], rar: 1, kind: 'wisp', pal: ['#fff0a8', '#c9a038', '#7de4ff', '#2a2a55'] },
    { n: ['Knochenei', 'Wyrmling', 'Knochendrache'], el: 'Schatten', el2: 'Luft', base: [60, 66, 58, 56], rar: 2, kind: 'dragon', pal: ['#d9d3bd', '#6c6652', '#8a3ffc', '#c46bff'] },
    { n: ['Moosgeist', 'Moderkopf', 'Fäulnisriese'], el: 'Pflanze', el2: 'Schatten', base: [64, 52, 56, 40], rar: 0, kind: 'blob', pal: ['#4a6a35', '#25381b', '#a6d65a', '#fff27a'] },
    { n: ['Dornhase', 'Blutdorn', 'Rosenmörder'], el: 'Pflanze', base: [48, 56, 46, 70], rar: 0, kind: 'quad', opt: { ears: 'long', tail: 'fluff' }, pal: ['#a85a6c', '#4a2634', '#f0d0d8', '#ffdf5a'] },
    { n: ['Salzkrabbe', 'Gezeitenwächter', 'Riffkoloss'], el: 'Wasser', el2: 'Erde', base: [58, 60, 70, 36], rar: 0, kind: 'crab', pal: ['#b0553d', '#5a2418', '#f0c070', '#111111'] },
    { n: ['Sporling', 'Pilzritter', 'Faulkönig'], el: 'Pflanze', el2: 'Erde', base: [62, 56, 60, 40], rar: 0, kind: 'mushroom', pal: ['#b0472b', '#4e1d12', '#f0e0c0', '#ffe14d'] },
    { n: ['Frostpfote', 'Eiswolf', 'Winterwolf'], el: 'Wasser', el2: 'Luft', base: [54, 62, 50, 66], rar: 1, kind: 'quad', opt: { ears: 'point', tail: 'fluff', mane: true }, pal: ['#bcd8ee', '#5f7f9c', '#ffffff', '#3ad4ff'] },
    { n: ['Irrflamme', 'Glutdämon', 'Höllenfürst'], el: 'Feuer', el2: 'Schatten', base: [54, 68, 48, 64], rar: 2, kind: 'ghoul', opt: { horns: true, fire: true }, pal: ['#6a1e1e', '#2e0c0c', '#ff8a2e', '#fff27a'] },
    { n: ['Lavawurm', 'Magmaschlange', 'Feuerwyrm'], el: 'Feuer', el2: 'Erde', base: [62, 62, 56, 46], rar: 1, kind: 'serpent', pal: ['#5a3a2e', '#26160f', '#ff7a2e', '#ffe14d'] },
    { n: ['Kristallkern', 'Edelgolem', 'Prismakoloss'], el: 'Erde', el2: 'Licht', base: [68, 62, 76, 30], rar: 2, kind: 'golem', pal: ['#6a5f84', '#2f2845', '#7de4ff', '#ffffff'] },
    { n: ['Grabstaub', 'Wiedergänger', 'Totenwächter'], el: 'Schatten', base: [56, 60, 52, 52], rar: 1, kind: 'ghoul', opt: {}, pal: ['#7d7a66', '#35332a', '#9affb0', '#9affb0'] },
    // Riesen-Gegner (nur einstufig, über Raids zähmbar)
    { n: ['Dornenkönig'], el: 'Pflanze', base: [90, 80, 80, 50], rar: 3, kind: 'skull', opt: { big: true }, legend: true, pal: ['#cfc8ae', '#6c6650', '#2f8f3a', '#ff3b3b'] },
    { n: ['Riffschlund'], el: 'Wasser', el2: 'Erde', base: [96, 78, 90, 40], rar: 3, kind: 'crab', opt: { big: true }, legend: true, pal: ['#2f6f8f', '#143040', '#8fe0ff', '#ffe14d'] },
    { n: ['Rabenkaiser'], el: 'Luft', el2: 'Schatten', base: [80, 86, 70, 90], rar: 3, kind: 'bird', opt: { big: true }, legend: true, pal: ['#1d1830', '#0c0916', '#8a5cf0', '#ff3b3b'] },
    { n: ['Frostwyrm'], el: 'Wasser', el2: 'Luft', base: [92, 84, 80, 60], rar: 3, kind: 'dragon', opt: { big: true }, legend: true, pal: ['#bcd8ee', '#4d6e8c', '#ffffff', '#3ad4ff'] },
    { n: ['Moorkrake'], el: 'Wasser', el2: 'Schatten', base: [100, 76, 84, 44], rar: 3, kind: 'blob', opt: { big: true }, legend: true, pal: ['#1f4a4a', '#0c2024', '#6cf0c8', '#d6ff7a'] },
    { n: ['Aschekönig'], el: 'Feuer', el2: 'Schatten', base: [92, 92, 74, 60], rar: 3, kind: 'ghoul', opt: { horns: true, fire: true, big: true }, legend: true, pal: ['#4a1414', '#1e0606', '#ff7a2e', '#fff27a'] },
    { n: ['Totenlord'], el: 'Schatten', base: [94, 88, 78, 54], rar: 3, kind: 'ghoul', opt: { horns: true, big: true }, legend: true, pal: ['#6d6a58', '#26241c', '#9affb0', '#9affb0'] },
    { n: ['Prismagolem'], el: 'Licht', el2: 'Erde', base: [102, 84, 100, 30], rar: 3, kind: 'golem', opt: { big: true }, legend: true, pal: ['#5a4f78', '#241e3a', '#ffe680', '#ffffff'] },
  ];
  F.forEach((f, i) => { f.id = i; f.stufen = f.n.length; });
  CAM.ANZ_FAMILIEN = 16;                // normale Familien; danach kommen die 8 Riesen
  CAM.RARITAET = ['Gewöhnlich', 'Selten', 'Episch', 'Legendär'];
  CAM.RAR_FARBE = ['#b9b4a8', '#5fd38a', '#c46bff', '#ffb347'];
  CAM.FANGRATE = [0.9, 0.55, 0.3, 0.06];
  CAM.PREIS_RAR = [1, 2.5, 6, 30];
  const STUFEN_FAKTOR = { 1: [1.05], 3: [0.78, 0.97, 1.2] };
  CAM.EVO_LV = [16, 34];

  CAM.stufeFuer = function (fam, lv) {
    const f = F[fam];
    if (f.stufen === 1) return 1;
    return lv >= CAM.EVO_LV[1] ? 3 : lv >= CAM.EVO_LV[0] ? 2 : 1;
  };
  CAM.name = function (m) { return F[m.fam].n[Math.min(F[m.fam].stufen, m.stufe) - 1]; };
  CAM.elemente = function (m) {
    const f = F[m.fam];
    const e = [f.el];
    if (f.el2 && (m.stufe >= 3 || f.stufen === 1 || (f.el2 && m.stufe >= 2 && f.legend))) e.push(f.el2);
    return e;
  };
  CAM.xpBedarf = lv => Math.floor(0.6 * lv * lv * lv) + 10;

  CAM.werte = function (fam, stufe, lv) {
    const f = F[fam], b = f.base;
    const k = STUFEN_FAKTOR[f.stufen][stufe - 1];
    const w = i => Math.floor((2 * b[i] * k * lv) / 100) + 5;
    return {
      hp: Math.floor((2 * b[0] * k * lv) / 100) + lv + 12,
      atk: w(1), def: w(2), spd: w(3),
    };
  };

  // Welche Attacken ein Mob auf einer Stufe kennt (höchstens 4, die zuletzt gelernten)
  CAM.attackenFuer = function (fam, lv) {
    const f = F[fam], e1 = CAM.EL_MOVES[f.el], e2 = f.el2 ? CAM.EL_MOVES[f.el2] : null;
    const l = [['rammen', 1], [e1[0], 1], [e1[1], 10]];
    if (e2) l.push([e2[0], 14]);
    l.push([e1[2], 22]);
    if (e2) l.push([e2[1], 30]);
    if (f.el === 'Licht' || f.el2 === 'Licht') l.push(['genesung', 18]);
    const got = [];
    for (const [id, min] of l.sort((a, b) => a[1] - b[1])) if (lv >= min && !got.includes(id)) got.push(id);
    return got.slice(-4);
  };

  CAM.neuerMob = function (fam, lv, opt) {
    opt = opt || {};
    const m = { fam, lv, stufe: CAM.stufeFuer(fam, lv), xp: 0, status: null, glanz: !!opt.glanz };
    CAM.neuBerechnen(m);
    m.hp = m.mhp;
    return m;
  };
  CAM.neuBerechnen = function (m) {
    m.stufe = CAM.stufeFuer(m.fam, m.lv);
    const w = CAM.werte(m.fam, m.stufe, m.lv);
    m.mhp = w.hp; m.atk = w.atk; m.def = w.def; m.spd = w.spd;
    m.moves = CAM.attackenFuer(m.fam, m.lv);
    if (m.hp > m.mhp) m.hp = m.mhp;
  };
  CAM.kopie = m => JSON.parse(JSON.stringify(m));
  CAM.preis = function (m, saison) {
    const f = F[m.fam];
    let p = (20 + m.lv * 9) * CAM.PREIS_RAR[f.rar] * (m.stufe >= 3 ? 1.5 : m.stufe === 2 ? 1.2 : 1);
    if (m.glanz) p *= 5;
    const el = f.el;
    if (saison != null && CAM.SAISON_BONUS[saison] === el) p *= 1.3;
    return Math.max(10, Math.round(p / 5) * 5);
  };

  // ---------- Jahreszeiten (laufen auf der Uhr, alle sehen dasselbe) ----------
  CAM.SAISONS = ['Frühling', 'Sommer', 'Herbst', 'Winter'];
  CAM.SAISON_BONUS = ['Pflanze', 'Feuer', 'Luft', 'Wasser'];   // dieses Element ist in der Jahreszeit gefragt (teurer, öfter zu sehen)
  CAM.SAISON_DAUER = 2 * 3600 * 1000;
  CAM.TAG_DAUER = 20 * 60 * 1000;
  CAM.WETTER_DAUER = 3 * 60 * 1000;

  // ---------- Wetter ----------
  CAM.WETTER = {
    klar: 'Klar', regen: 'Regen', gewitter: 'Gewitter', nebel: 'Nebel', schnee: 'Schneesturm', hitze: 'Hitzewelle',
    asche: 'Ascheregen', blutmond: 'Blutmond', wind: 'Sturmwind', dunst: 'Giftdunst',
  };
  // Wirkung im Kampf: Element-Faktor und Trefferfaktor
  CAM.WETTER_FX = {
    regen: { Wasser: 1.3, Feuer: 0.8 },
    gewitter: { Luft: 1.3, Wasser: 1.1 },
    nebel: { acc: 0.85 },
    schnee: { Wasser: 1.2, Feuer: 0.8 },
    hitze: { Feuer: 1.3, Wasser: 0.8 },
    asche: { Feuer: 1.2, Pflanze: 0.8 },
    blutmond: { Schatten: 1.3, Licht: 0.8 },
    wind: { Luft: 1.2 },
    dunst: { Pflanze: 1.1, acc: 0.9 },
  };
  CAM.WETTER_INFO = {
    regen: 'Wasser stärker, Feuer schwächer', gewitter: 'Luft stärker', nebel: 'Attacken treffen schlechter',
    schnee: 'Wasser stärker, Feuer schwächer', hitze: 'Feuer stärker, Wasser schwächer', asche: 'Feuer stärker, Pflanze schwächer',
    blutmond: 'Schatten stärker, Licht schwächer', wind: 'Luft stärker', dunst: 'Attacken treffen schlechter', klar: '',
  };

  // ---------- Biome ----------
  // pal: g1/g2 Boden, gr/gr2 hohes Gras (hier tauchen wilde Mobs auf), tr/tr2/trunk Bäume, w/w2 Wasser, path Weg
  CAM.BIOME = [
    { id: 0, n: 'Blütenwiesen', cx: 200, cy: 200, lake: 0.10, tree: 0.74, grass: 0.50, obst: 'baum',
      wetter: { klar: 5, regen: 2, nebel: 1, wind: 1 },
      pal: { g1: '#5a8c4a', g2: '#64975a', gr: '#3d7a3a', gr2: '#7fd06a', tr: '#2f6f3a', tr2: '#4e9b4e', trunk: '#4a3322', w: '#2f6a9a', w2: '#5aa0d0', path: '#a89870', deco: '#f7a8c8' },
      dorf: 'Blütenhain', boss: 0,
      spawn: [[8, 30], [7, 20], [0, 15], [2, 14], [1, 10], [5, 10]] },
    { id: 1, n: 'Sonnenküste', cx: 315, cy: 305, lake: 0.30, tree: 0.80, grass: 0.52, obst: 'palme',
      wetter: { klar: 5, hitze: 3, gewitter: 2, regen: 1 },
      pal: { g1: '#d9c27c', g2: '#cdb36a', gr: '#8fa850', gr2: '#c5d97a', tr: '#3f8a3a', tr2: '#68b84a', trunk: '#7a5a30', w: '#2a8ab5', w2: '#70d0e8', path: '#b89a5a', deco: '#ffffff' },
      dorf: 'Sonnenhafen', boss: 1,
      spawn: [[9, 35], [1, 20], [4, 20], [0, 10], [3, 15]] },
    { id: 2, n: 'Herbstwald', cx: 85, cy: 215, lake: 0.08, tree: 0.58, grass: 0.46, obst: 'baum',
      wetter: { wind: 4, nebel: 3, regen: 3, klar: 2 },
      pal: { g1: '#7a5a34', g2: '#85643a', gr: '#a0521e', gr2: '#e08a2e', tr: '#c24e1a', tr2: '#e0a02e', trunk: '#4a2e1a', w: '#3a5a6a', w2: '#6a8a9a', path: '#9a8458', deco: '#e0a02e' },
      dorf: 'Laubfall', boss: 2,
      spawn: [[10, 30], [4, 25], [2, 15], [7, 15], [3, 15]] },
    { id: 3, n: 'Frostgipfel', cx: 205, cy: 70, lake: 0.12, tree: 0.66, grass: 0.50, obst: 'tanne',
      wetter: { schnee: 4, klar: 3, nebel: 2 },
      pal: { g1: '#dfe9f2', g2: '#cfdce8', gr: '#b8cfe2', gr2: '#f4fbff', tr: '#2f5f4a', tr2: '#e8f4ff', trunk: '#3a2a22', w: '#5a7fa8', w2: '#a8d0f0', path: '#9aa8b8', deco: '#ffffff' },
      dorf: 'Frostwacht', boss: 3,
      spawn: [[11, 35], [3, 25], [4, 20], [5, 20]] },
    { id: 4, n: 'Nebelmoor', cx: 90, cy: 90, lake: 0.26, tree: 0.62, grass: 0.46, obst: 'totbaum',
      wetter: { nebel: 5, dunst: 3, regen: 2 },
      pal: { g1: '#4a5a3e', g2: '#3f4e35', gr: '#2e4a3a', gr2: '#6a9a6a', tr: '#2a3a2a', tr2: '#4e6a4e', trunk: '#2a2218', w: '#2a4a4a', w2: '#4a7a6a', path: '#6a6248', deco: '#9affb0' },
      dorf: 'Moorbruch', boss: 4,
      spawn: [[1, 30], [7, 25], [5, 15], [15, 15], [10, 15]] },
    { id: 5, n: 'Aschegipfel', cx: 325, cy: 85, lake: 0.0, tree: 0.0, grass: 0.50, obst: 'fels', lava: 0.80,
      wetter: { asche: 5, hitze: 3, klar: 1 },
      pal: { g1: '#4a403c', g2: '#3e3532', gr: '#2e2624', gr2: '#8a4a2a', tr: '#3a3230', tr2: '#5a4e48', trunk: '#222', w: '#d84a1a', w2: '#ffb42e', path: '#6a5a50', deco: '#ff7a2e' },
      dorf: 'Aschenburg', boss: 5,
      spawn: [[12, 25], [13, 30], [0, 25], [6, 20]] },
    { id: 6, n: 'Knochenfriedhof', cx: 200, cy: 335, lake: 0.06, tree: 0.70, grass: 0.46, obst: 'grab',
      wetter: { blutmond: 4, gewitter: 3, nebel: 3, klar: 1 },
      pal: { g1: '#4a4658', g2: '#3e3a4c', gr: '#38334a', gr2: '#8a7ab0', tr: '#2a2438', tr2: '#4a4260', trunk: '#1c1626', w: '#26264a', w2: '#4a4a8a', path: '#6a647a', deco: '#d9d3bd' },
      dorf: 'Gräberstein', boss: 6,
      spawn: [[15, 35], [6, 25], [4, 20], [12, 10], [1, 10]] },
    { id: 7, n: 'Kristallschlucht', cx: 330, cy: 195, lake: 0.06, tree: 0.62, grass: 0.48, obst: 'kristall',
      wetter: { klar: 4, nebel: 2, gewitter: 2 },
      pal: { g1: '#5a5470', g2: '#4e4864', gr: '#4a4a7a', gr2: '#8a9aff', tr: '#4a4470', tr2: '#7de4ff', trunk: '#2a2540', w: '#2a3a7a', w2: '#6a8aff', path: '#8a84a0', deco: '#7de4ff' },
      dorf: 'Kristallfurt', boss: 7,
      spawn: [[14, 35], [3, 30], [5, 20], [11, 15]] },
  ];
  CAM.BOSS = [
    { fam: 16, n: 'Dornenkönig', lv: 13, dist: 28 },
    { fam: 17, n: 'Riffschlund', lv: 0, dist: 26 },
    { fam: 18, n: 'Rabenkaiser', lv: 0, dist: 26 },
    { fam: 19, n: 'Frostwyrm', lv: 0, dist: 26 },
    { fam: 20, n: 'Moorkrake', lv: 0, dist: 26 },
    { fam: 21, n: 'Aschekönig', lv: 0, dist: 26 },
    { fam: 22, n: 'Totenlord', lv: 0, dist: 26 },
    { fam: 23, n: 'Prismagolem', lv: 0, dist: 26 },
  ];

  // ---------- Gegenstände ----------
  CAM.ITEMS = {
    siegel1: { n: 'Einfaches Siegel', preis: 20, fang: 1.0, info: 'Fängt geschwächte Mobs' },
    siegel2: { n: 'Starkes Siegel', preis: 60, fang: 1.7, info: 'Fängt deutlich besser' },
    siegel3: { n: 'Meistersiegel', preis: 1200, fang: 99, info: 'Fängt immer' },
    trank: { n: 'Trank', preis: 30, heil: 40, info: 'Heilt 40 LP' },
    trank2: { n: 'Grosser Trank', preis: 100, heil: 120, info: 'Heilt 120 LP' },
    beleber: { n: 'Wiederbeleber', preis: 150, beleb: 0.5, info: 'Belebt einen Mob mit halben LP' },
    gegengift: { n: 'Gegengift', preis: 25, heilStatus: true, info: 'Heilt Gift, Brand, Schlaf und Angst' },
    // Fundstücke (nur zum Verkaufen)
    knochen: { n: 'Knochensplitter', preis: 12, fund: true, info: 'Verkaufsware' },
    kristall: { n: 'Mondkristall', preis: 45, fund: true, info: 'Verkaufsware' },
    glut: { n: 'Glutstein', preis: 30, fund: true, info: 'Verkaufsware' },
    beere: { n: 'Schattenbeere', preis: 8, fund: true, info: 'Verkaufsware' },
    feder: { n: 'Rabenfeder', preis: 15, fund: true, info: 'Verkaufsware' },
    eis: { n: 'Eissplitter', preis: 25, fund: true, info: 'Verkaufsware' },
    muschel: { n: 'Perlmuschel', preis: 20, fund: true, info: 'Verkaufsware' },
  };
  CAM.SHOP = ['siegel1', 'siegel2', 'siegel3', 'trank', 'trank2', 'beleber', 'gegengift'];
  CAM.FUNDE = { 0: ['beere', 'feder'], 1: ['muschel', 'feder'], 2: ['beere', 'feder'], 3: ['eis', 'kristall'], 4: ['beere', 'knochen'], 5: ['glut', 'knochen'], 6: ['knochen', 'feder'], 7: ['kristall', 'eis'] };

  // ---------- Trainer ----------
  CAM.TRAINER_VORNAMEN = ['Aska', 'Brand', 'Corvin', 'Dunja', 'Eldric', 'Fenna', 'Garm', 'Hilda', 'Ivo', 'Jorun', 'Kaspar', 'Lilith', 'Mordan', 'Nyra', 'Orlok', 'Perun', 'Quill', 'Rhea', 'Sigrun', 'Tiber', 'Ulrik', 'Vesna', 'Wulf', 'Xanthe', 'Yorick', 'Zelda'];
  CAM.TRAINER_TITEL = ['Jäger', 'Hexer', 'Wächterin', 'Totengräber', 'Wandersfrau', 'Kräutersammler', 'Einsiedler', 'Schattenläufer'];

  CAM.GESTEN = [['👋', 'Winken'], ['❤', 'Herz'], ['❗', 'Hilfe!'], ['⚔', 'Kampf?']];
  CAM.FARBEN = ['#4f8ff7', '#ef5350', '#5fd38a', '#ffd54a', '#c46bff', '#ff9f43'];
  CAM.STARTER = [0, 1, 2];   // Glutfunke, Moorblase, Dornling
})(typeof window !== 'undefined' ? window : globalThis);
