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
    { n: ['Rabenkind', 'Nachtkrähe', 'Unheilsfürst'], bos: true, el: 'Luft', el2: 'Schatten', base: [46, 58, 42, 78], rar: 0, kind: 'bird', pal: ['#2b2438', '#15101f', '#6c5aa6', '#ff5a5a'] },
    { n: ['Lichtwisp', 'Irrlicht', 'Seelenlaterne'], el: 'Licht', base: [48, 58, 44, 72], rar: 1, kind: 'wisp', pal: ['#fff0a8', '#c9a038', '#7de4ff', '#2a2a55'] },
    { n: ['Knochenei', 'Wyrmling', 'Knochendrache'], bos: true, el: 'Schatten', el2: 'Luft', base: [60, 66, 58, 56], rar: 2, kind: 'dragon', pal: ['#d9d3bd', '#6c6652', '#8a3ffc', '#c46bff'] },
    { n: ['Moosgeist', 'Moderkopf', 'Fäulnisriese'], bos: true, el: 'Pflanze', el2: 'Schatten', base: [64, 52, 56, 40], rar: 0, kind: 'blob', pal: ['#4a6a35', '#25381b', '#a6d65a', '#fff27a'] },
    { n: ['Dornhase', 'Blutdorn', 'Rosenmörder'], el: 'Pflanze', base: [48, 56, 46, 70], rar: 0, kind: 'quad', opt: { ears: 'long', tail: 'fluff' }, pal: ['#a85a6c', '#4a2634', '#f0d0d8', '#ffdf5a'] },
    { n: ['Salzkrabbe', 'Gezeitenwächter', 'Riffkoloss'], el: 'Wasser', el2: 'Erde', base: [58, 60, 70, 36], rar: 0, kind: 'crab', pal: ['#b0553d', '#5a2418', '#f0c070', '#111111'] },
    { n: ['Sporling', 'Pilzritter', 'Faulkönig'], el: 'Pflanze', el2: 'Erde', base: [62, 56, 60, 40], rar: 0, kind: 'mushroom', pal: ['#b0472b', '#4e1d12', '#f0e0c0', '#ffe14d'] },
    { n: ['Frostpfote', 'Eiswolf', 'Winterwolf'], el: 'Wasser', el2: 'Luft', base: [54, 62, 50, 66], rar: 1, kind: 'quad', opt: { ears: 'point', tail: 'fluff', mane: true }, pal: ['#bcd8ee', '#5f7f9c', '#ffffff', '#3ad4ff'] },
    { n: ['Irrflamme', 'Glutdämon', 'Höllenfürst'], bos: true, el: 'Feuer', el2: 'Schatten', base: [54, 68, 48, 64], rar: 2, kind: 'ghoul', opt: { horns: true, fire: true }, pal: ['#6a1e1e', '#2e0c0c', '#ff8a2e', '#fff27a'] },
    { n: ['Lavawurm', 'Magmaschlange', 'Feuerwyrm'], bos: true, el: 'Feuer', el2: 'Erde', base: [62, 62, 56, 46], rar: 1, kind: 'serpent', pal: ['#5a3a2e', '#26160f', '#ff7a2e', '#ffe14d'] },
    { n: ['Kristallkern', 'Edelgolem', 'Prismakoloss'], el: 'Erde', el2: 'Licht', base: [68, 62, 76, 30], rar: 2, kind: 'golem', pal: ['#6a5f84', '#2f2845', '#7de4ff', '#ffffff'] },
    { n: ['Grabstaub', 'Wiedergänger', 'Totenwächter'], bos: true, el: 'Schatten', base: [56, 60, 52, 52], rar: 1, kind: 'ghoul', opt: {}, pal: ['#7d7a66', '#35332a', '#9affb0', '#9affb0'] },
    // Riesen-Gegner (nur einstufig, über Raids zähmbar)
    { n: ['Dornenkönig'], el: 'Pflanze', base: [90, 80, 80, 50], rar: 3, kind: 'skull', opt: { big: true }, legend: true, pal: ['#cfc8ae', '#6c6650', '#2f8f3a', '#ff3b3b'] },
    { n: ['Riffschlund'], el: 'Wasser', el2: 'Erde', base: [96, 78, 90, 40], rar: 3, kind: 'crab', opt: { big: true }, legend: true, pal: ['#2f6f8f', '#143040', '#8fe0ff', '#ffe14d'] },
    { n: ['Rabenkaiser'], el: 'Luft', el2: 'Schatten', base: [80, 86, 70, 90], rar: 3, kind: 'bird', opt: { big: true }, legend: true, pal: ['#1d1830', '#0c0916', '#8a5cf0', '#ff3b3b'] },
    { n: ['Frostwyrm'], el: 'Wasser', el2: 'Luft', base: [92, 84, 80, 60], rar: 3, kind: 'dragon', opt: { big: true }, legend: true, pal: ['#bcd8ee', '#4d6e8c', '#ffffff', '#3ad4ff'] },
    { n: ['Moorkrake'], el: 'Wasser', el2: 'Schatten', base: [100, 76, 84, 44], rar: 3, kind: 'blob', opt: { big: true }, legend: true, pal: ['#1f4a4a', '#0c2024', '#6cf0c8', '#d6ff7a'] },
    { n: ['Aschekönig'], el: 'Feuer', el2: 'Schatten', base: [92, 92, 74, 60], rar: 3, kind: 'ghoul', opt: { horns: true, fire: true, big: true }, legend: true, pal: ['#4a1414', '#1e0606', '#ff7a2e', '#fff27a'] },
    { n: ['Totenlord'], el: 'Schatten', base: [94, 88, 78, 54], rar: 3, kind: 'ghoul', opt: { horns: true, big: true }, legend: true, pal: ['#6d6a58', '#26241c', '#9affb0', '#9affb0'] },
    { n: ['Prismagolem'], el: 'Licht', el2: 'Erde', base: [102, 84, 100, 30], rar: 3, kind: 'golem', opt: { big: true }, legend: true, pal: ['#5a4f78', '#241e3a', '#ffe680', '#ffffff'] },
    // Spezial-Mobs: kommen in keinem Biom normal vor, nur auf besonderen Wegen (spezial = Erklärung im Mob-Buch)
    { n: ['Sternschnuppe', 'Sternenfuchs', 'Himmelsfuchs'], el: 'Licht', base: [50, 64, 50, 84], rar: 2, kind: 'quad', opt: { ears: 'point', tail: 'fluff', mane: true }, pal: ['#c9d4ff', '#6a6fb8', '#fff3a8', '#7de4ff'], spezial: 'Taucht nur in klaren Nächten auf und rennt schnell davon.' },
    { n: ['Blutschemen', 'Mondschlächter', 'Blutgraf'], el: 'Schatten', base: [58, 72, 50, 64], rar: 2, kind: 'ghoul', opt: { horns: true }, pal: ['#5a1020', '#26060c', '#ff3b5a', '#ffd0d8'], spezial: 'Zeigt sich nur bei Blutmond.' },
    { n: ['Glutei', 'Ascheschlüpfer', 'Weltendrache'], el: 'Feuer', el2: 'Licht', base: [66, 74, 62, 58], rar: 2, kind: 'dragon', pal: ['#ffb36b', '#7a3a1a', '#ffe14d', '#fff3a8'], spezial: 'Schlüpft aus dem Drachenei, das manchmal als Beute von Riesen fällt (600 Schritte im Beutel tragen).' },
    { n: ['Zwillingskopf', 'Chimäre', 'Urchimäre'], el: 'Normal', el2: 'Schatten', base: [72, 72, 66, 60], rar: 2, kind: 'quad', opt: { ears: 'round', tail: 'flame', mane: true }, pal: ['#c9a24a', '#6a4a1a', '#ff6a2e', '#fff3a8'], spezial: 'Gehört den Champion-Bots. Du bekommst sie nur, wenn du sie im Einsatz-Duell gewinnst.' },
    // ---------- 20 weitere Fabelwesen (Nummer 28 bis 47): Tiere der Wiese, des Wassers, der Nacht und der Berge ----------
    // hab = Lebensraum fürs Spawnen (siehe wilde.js), fliegt = schwebt über dem Boden
    { n: ['Rehkitz', 'Wiesenreh', 'Blütenhirsch'], el: 'Pflanze', el2: 'Licht', base: [56, 52, 52, 68], rar: 0, kind: 'quad', opt: { slim: true, antler: true, spots: true, tail: 'short', hoof: true, herb: true }, pal: ['#c4864c', '#7a4a28', '#e6d6a8', '#1a1210'], hab: { tile: 'gras', herde: [3, 5], scheu: true, zeit: 'tag' } },
    { n: ['Raupling', 'Blattraupe', 'Seidenwurm'], el: 'Pflanze', el2: 'Luft', base: [58, 40, 50, 34], rar: 0, kind: 'raupe', pal: ['#8fd05a', '#3f7a2e', '#f0e46a', '#1a2a14'], hab: { tile: 'gras', herde: [2, 4], scheu: false } },
    { n: ['Flatterling', 'Blütenfalter', 'Prismafalter'], el: 'Luft', el2: 'Licht', base: [44, 52, 40, 82], rar: 0, kind: 'falter', fliegt: true, pal: ['#ff9ad0', '#8a3a7a', '#fff0a8', '#3a1a40'], hab: { tile: 'gras', herde: [2, 3], scheu: true, zeit: 'tag', streng: true } },
    { n: ['Brummel', 'Honighummel', 'Stachelkönigin'], bos: true, el: 'Normal', el2: 'Pflanze', base: [50, 60, 46, 66], rar: 0, kind: 'hummel', fliegt: true, pal: ['#f2c230', '#5a3a10', '#7a3a1a', '#1a1210'], hab: { tile: 'gras', herde: [2, 3], zeit: 'tag', streng: true } },
    { n: ['Tümpelchen', 'Schilfkröte', 'Riffpanzer'], el: 'Wasser', el2: 'Erde', base: [64, 48, 72, 26], rar: 0, kind: 'schildkroete', pal: ['#4a8a5a', '#244a30', '#e0c88a', '#f0e070'], hab: { nah: 'wasser', scheu: false } },
    { n: ['Quakling', 'Moorfrosch', 'Giftkönig'], el: 'Wasser', el2: 'Pflanze', base: [56, 58, 48, 62], rar: 0, kind: 'frosch', pal: ['#4aa860', '#1e5a30', '#e8e070', '#f0e84a'], hab: { nah: 'wasser', herde: [2, 3] } },
    { n: ['Kriechling', 'Schneckenritter', 'Spiralkoloss'], el: 'Normal', el2: 'Erde', base: [66, 44, 66, 16], rar: 0, kind: 'schnecke', pal: ['#c9b07a', '#6a5638', '#e0708a', '#1a1210'], hab: { wetter: ['regen', 'nebel', 'dunst'], scheu: false } },
    { n: ['Leuchtling', 'Leuchtqualle', 'Polarlichtqualle'], el: 'Wasser', el2: 'Licht', base: [52, 58, 44, 58], rar: 1, kind: 'qualle', fliegt: true, opt: { glow: true }, pal: ['#7fd4f0', '#2a5a9a', '#d8a0ff', '#fff8c0'], hab: { nah: 'wasser', herde: [1, 2], scheu: false } },
    { n: ['Sandstachel', 'Wüstenskorpion', 'Dünentyrann'], bos: true, el: 'Erde', el2: 'Feuer', base: [58, 68, 60, 48], rar: 0, kind: 'skorpion', pal: ['#c9a24a', '#6a4a1a', '#e0603a', '#ffe14d'], hab: { tile: 'boden', zeit: 'tag' } },
    { n: ['Webling', 'Giftspinne', 'Schattenweberin'], bos: true, el: 'Schatten', el2: 'Pflanze', base: [50, 66, 46, 62], rar: 1, kind: 'spinne', pal: ['#3a2a4a', '#150e20', '#a060e0', '#ff4a6a'], hab: { nah: 'baum', zeit: 'nacht' } },
    { n: ['Flattermaus', 'Nachtfledermaus', 'Mondschwinge'], bos: true, el: 'Schatten', el2: 'Luft', base: [46, 60, 40, 80], rar: 1, kind: 'fledermaus', fliegt: true, pal: ['#5a4a70', '#2a2038', '#c9a0ff', '#ffe14d'], hab: { nah: ['baum', 'grab'], zeit: 'nacht', streng: true, herde: [2, 4] } },
    { n: ['Käuzchen', 'Waldkauz', 'Mondeule'], el: 'Luft', el2: 'Licht', base: [56, 56, 50, 66], rar: 1, kind: 'eule', pal: ['#9a7a5a', '#4e3a28', '#ffe0a0', '#ffcc2a'], hab: { nah: 'baum', zeit: 'nacht', scheu: true } },
    { n: ['Setzling', 'Baumwächter', 'Urwaldriese'], el: 'Pflanze', el2: 'Erde', base: [74, 62, 72, 22], rar: 2, kind: 'baum', pal: ['#7a5a3a', '#3e2a1a', '#4fae4a', '#ffd54a'], hab: { nah: 'baum', min: 7, scheu: false } },
    { n: ['Nebelflocke', 'Gewitterwolke', 'Sturmtitan'], bos: true, el: 'Luft', el2: 'Wasser', base: [52, 66, 44, 70], rar: 1, kind: 'wolke', fliegt: true, opt: { glow: true }, pal: ['#7a86a8', '#3a4260', '#ffe14d', '#fff6b0'], hab: { wetter: ['gewitter', 'regen', 'wind'], streng: true } },
    { n: ['Zicklein', 'Eisbock', 'Gipfelfürst'], el: 'Erde', el2: 'Wasser', base: [64, 64, 64, 50], rar: 0, kind: 'quad', opt: { horn: 'ibex', hoof: true, herb: true, ears: 'round', tail: 'short' }, pal: ['#d8e2ea', '#6a7a8a', '#b09a70', '#2a2a38'], hab: { nah: 'fels', herde: [2, 3], scheu: true } },
    { n: ['Funkenmolch', 'Lavasalamander', 'Magmakaiman'], el: 'Feuer', base: [52, 64, 50, 58], rar: 0, kind: 'echse', opt: { flame: true, glow: true }, pal: ['#a8321e', '#4a140c', '#ff8a2e', '#fff27a'], hab: { nah: ['lava', 'fels'] } },
    { n: ['Glutküken', 'Aschephönix', 'Sonnenphönix'], el: 'Feuer', el2: 'Licht', base: [54, 70, 48, 74], rar: 2, kind: 'bird', opt: { phoenix: true, glow: true }, pal: ['#d8481e', '#7a1a0e', '#ffb02e', '#fff27a'], hab: { tile: 'boden', zeit: 'tag', scheu: true } },
    { n: ['Käferchen', 'Hirschkäfer', 'Zangenkönig'], el: 'Erde', base: [60, 64, 72, 34], rar: 0, kind: 'kaefer', pal: ['#5a3a2a', '#24160e', '#c98a42', '#ffe14d'], hab: { nah: 'baum', zeit: 'tag' } },
    { n: ['Sternenfohlen', 'Einhorn', 'Regenbogenross'], el: 'Licht', el2: 'Luft', base: [62, 60, 58, 76], rar: 2, kind: 'quad', opt: { slim: true, horn: 'uni', mane: true, tail: 'flow', hoof: true, herb: true, ears: 'point' }, pal: ['#f4eefc', '#a89ac8', '#ff9ad8', '#7a4ad0'], hab: { tile: 'gras', zeit: 'tag', wetter: ['klar'], scheu: true } },
    { n: ['Molchling', 'Axolotl', 'Seedrache'], el: 'Wasser', base: [62, 52, 56, 46], rar: 1, kind: 'echse', opt: { kiemen: true }, pal: ['#f2a6c0', '#a8607a', '#ff6a9a', '#2a1a2a'], hab: { nah: 'wasser', scheu: false } },
  ];
  F.forEach((f, i) => { f.id = i; f.stufen = f.n.length; });
  // Lebensräume der ersten 16 Familien (die neuen tragen hab direkt in der Zeile)
  // tile: gras | boden, nah: Wasser, Bäume, Felsen, Lava, Gräber oder Kristalle in der Nähe, zeit: bevorzugt tag | nacht (streng = nur dann),
  // herde: [von, bis] Tiere, wetter: bevorzugtes Wetter, scheu: weicht aus
  const HAB = [
    { tile: 'boden' }, { nah: 'wasser' }, { nah: 'baum' }, { tile: 'boden', nah: 'fels', scheu: false }, { nah: 'baum' }, { zeit: 'nacht' }, { nah: 'grab', zeit: 'nacht' }, { nah: ['wasser', 'baum'] },
    { tile: 'gras', herde: [2, 4], scheu: true }, { nah: 'wasser', tile: 'boden', herde: [1, 3] }, { nah: 'baum', herde: [2, 3], scheu: false }, { herde: [2, 3] }, { tile: 'boden' }, { nah: 'lava' }, { nah: 'kristall' }, { nah: 'grab', zeit: 'nacht' },
  ];
  F.forEach((f, i) => { if (!f.hab) f.hab = HAB[i] || {}; });
  CAM.habText = function (f) {
    const h = f.hab || {}, t = [];
    if (h.herde) t.push('Gruppen');
    if (h.tile === 'gras') t.push('auf Wiesen'); else if (h.tile === 'boden') t.push('auf offenem Boden');
    const nah = [].concat(h.nah || []).map(n => ({ wasser: 'am Wasser', baum: 'zwischen Bäumen', fels: 'bei Felsen', lava: 'bei Lava', grab: 'bei Gräbern', kristall: 'bei Kristallen' }[n]));
    if (nah.length) t.push(nah.join(' oder '));
    if (h.zeit === 'nacht') t.push(h.streng ? 'nur nachts' : 'meist nachts'); else if (h.zeit === 'tag') t.push(h.streng ? 'nur tagsüber' : 'meist tagsüber');
    if (h.wetter) t.push('bei ' + h.wetter.map(w => (CAM.WETTER[w] || w)).join('/'));
    return t.join(', ');
  };

  // ---------- Eigene Attacken jeder Familie ----------
  // Jedes Fabelwesen hat vier (Riesen drei) eigene Attacken mit eigener Animation (anim: Art der Animation + Feinheiten, siehe kampfanim.js).
  // [id, Name, Element, Stärke, Treffer, anim, Status, Chance]
  const SIG = [
    // 0 Glutfunke
    [['funkenbiss', 'Funkenbiss', 'Feuer', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#ffd54a', '#ff6a2e'] }],
     ['glutschweif', 'Glutschweif', 'Feuer', 52, 100, { t: 'lunge', deco: 'schweif', cols: ['#ff6a2e', '#ffd54a'] }, 'brand', 20],
     ['glutsprung', 'Glutsprung', 'Feuer', 72, 95, { t: 'sprung', deco: 'feuer' }, 'brand', 20],
     ['infernoheulen', 'Infernoheulen', 'Feuer', 100, 85, { t: 'nova', cols: ['#ffd54a', '#ff6a2e', '#c0301a'], ringe: 4 }, 'brand', 25]],
    // 1 Moorblase
    [['schlammspritzer', 'Schlammspritzer', 'Wasser', 40, 100, { t: 'salve', shape: 'klumpen', n: 5, cols: ['#5a7a4a', '#7a8a52'] }],
     ['moorgriff', 'Moorgriff', 'Schatten', 52, 100, { t: 'saugen', cols: ['#7dd9c4', '#d6ff7a'] }],
     ['sumpfsog', 'Sumpfsog', 'Wasser', 72, 95, { t: 'wirbel', cols: ['#2f6a6a', '#7dd9c4'], shape: 'blase' }],
     ['leichenflut', 'Leichenflut', 'Wasser', 100, 85, { t: 'flut', cols: ['#2f5a4a', '#8affb0'], dunkel: true }, 'furcht', 15]],
    // 2 Dornling
    [['dornenspucke', 'Dornenspucke', 'Pflanze', 40, 100, { t: 'salve', shape: 'dorn', n: 6, cols: ['#e8e0b0', '#3f9a3f'] }],
     ['rankengriff', 'Rankengriff', 'Pflanze', 55, 100, { t: 'ranken', cols: ['#3f9a3f', '#7de05a'] }, 'gift', 25],
     ['geweihstoss', 'Geweihstoss', 'Pflanze', 74, 95, { t: 'lunge', deco: 'horn', cols: ['#e8e0b0', '#3f9a3f'] }],
     ['waldwuergen', 'Waldwürgen', 'Pflanze', 98, 85, { t: 'ranken', gross: true, cols: ['#2f6a2f', '#9aff6a'] }, 'gift', 25]],
    // 3 Steinzahn
    [['pranke', 'Pranke', 'Erde', 40, 100, { t: 'lunge', deco: 'kralle', cols: ['#e8d8b0'] }],
     ['felswurf', 'Felswurf', 'Erde', 55, 95, { t: 'ball', shape: 'fels', r: 15, cols: ['#8a7a62', '#b8a888'] }],
     ['baerenstampf', 'Bärenstampf', 'Erde', 76, 95, { t: 'sprung', deco: 'stampf' }],
     ['lawine', 'Lawine', 'Erde', 100, 85, { t: 'meteor', shape: 'fels', n: 8, cols: ['#8a7a62', '#c9a05a'] }, 'furcht', 15]],
    // 4 Rabenkind
    [['schnabelhieb', 'Schnabelhieb', 'Luft', 40, 100, { t: 'lunge', deco: 'schnabel', cols: ['#d8d0ff'] }],
     ['federsalve', 'Federsalve', 'Luft', 55, 95, { t: 'salve', shape: 'feder', n: 6, cols: ['#2b2438', '#6c5aa6'] }],
     ['sturzflug', 'Sturzflug', 'Luft', 76, 95, { t: 'sprung', deco: 'sturz' }],
     ['rabensturm', 'Rabensturm', 'Schatten', 98, 85, { t: 'wirbel', shape: 'feder', cols: ['#15101f', '#8a5cf0'] }, 'furcht', 15]],
    // 5 Lichtwisp
    [['funkenflug', 'Funkenflug', 'Licht', 40, 100, { t: 'salve', shape: 'funke', n: 7, cols: ['#fff0a8', '#7de4ff'] }],
     ['leuchtkugel', 'Leuchtkugel', 'Licht', 55, 100, { t: 'ball', shape: 'orb', r: 14, cols: ['#fff6b0', '#ffd54a'] }],
     ['lichtsaeule', 'Lichtsäule', 'Licht', 80, 95, { t: 'saeule', cols: ['#fff6b0', '#ffffff', '#7de4ff'] }],
     ['sternenregen', 'Sternenregen', 'Licht', 96, 90, { t: 'meteor', shape: 'stern', n: 9, cols: ['#fff6b0', '#7de4ff'] }]],
    // 6 Knochenei
    [['knochenbiss', 'Knochenbiss', 'Schatten', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#d9d3bd', '#8a3ffc'] }],
     ['knochenwurf', 'Knochenwurf', 'Schatten', 55, 95, { t: 'salve', shape: 'knochen', n: 4, cols: ['#d9d3bd', '#8a3ffc'] }],
     ['schattenatem', 'Schattenatem', 'Schatten', 80, 95, { t: 'atem', cols: ['#8a3ffc', '#c46bff', '#2a1048'] }],
     ['totenschrei', 'Totenschrei', 'Luft', 100, 85, { t: 'puls', cols: ['#c46bff', '#ffffff'] }, 'furcht', 25]],
    // 7 Moosgeist
    [['sporenwolke', 'Sporenwolke', 'Pflanze', 36, 100, { t: 'wolke', cols: ['#a6d65a', '#fff27a'] }, 'gift', 30],
     ['moosfaust', 'Moosfaust', 'Pflanze', 52, 100, { t: 'lunge', deco: 'faust', cols: ['#4a6a35', '#a6d65a'] }],
     ['faeulnispeitsche', 'Fäulnispeitsche', 'Pflanze', 72, 95, { t: 'peitsche', cols: ['#4a6a35', '#a6d65a'] }, 'gift', 20],
     ['verwesung', 'Verwesung', 'Schatten', 95, 90, { t: 'saugen', cols: ['#a6d65a', '#25381b'], stark: true }, 'gift', 25]],
    // 8 Dornhase
    [['hasentritt', 'Hasentritt', 'Pflanze', 40, 100, { t: 'lunge', deco: 'kopfnuss', cols: ['#f0d0d8'] }],
     ['rosenblaetter', 'Rosenblätter', 'Pflanze', 52, 100, { t: 'salve', shape: 'blatt', n: 8, cols: ['#e0507a', '#f0d0d8'] }],
     ['blutranke', 'Blutranke', 'Pflanze', 72, 95, { t: 'peitsche', cols: ['#a0203a', '#e0507a'], dornen: true }, 'gift', 20],
     ['dornenwirbel', 'Dornenwirbel', 'Pflanze', 98, 90, { t: 'rolle', cols: ['#e0507a', '#3f9a3f'] }]],
    // 9 Salzkrabbe
    [['zangenhieb', 'Zangenhieb', 'Wasser', 40, 100, { t: 'lunge', deco: 'zange', cols: ['#f0c070'] }],
     ['blasenschauer', 'Blasenschauer', 'Wasser', 52, 100, { t: 'salve', shape: 'blase', n: 8, cols: ['#bfe6ff', '#ffffff'] }],
     ['gezeitenschlag', 'Gezeitenschlag', 'Wasser', 76, 95, { t: 'flut', cols: ['#3fa0ff', '#bfe6ff'] }],
     ['riffbrecher', 'Riffbrecher', 'Erde', 100, 85, { t: 'spiesse', shape: 'koralle', cols: ['#f07a6a', '#ffd0a0'] }, 'furcht', 15]],
    // 10 Sporling
    [['sporenschuss', 'Sporenschuss', 'Pflanze', 40, 100, { t: 'salve', shape: 'spore', n: 6, cols: ['#f0e0c0', '#b0472b'] }, 'gift', 25],
     ['hutschlag', 'Hutschlag', 'Pflanze', 54, 100, { t: 'sprung', deco: 'stampf' }],
     ['pilzsaeule', 'Pilzsäule', 'Erde', 76, 95, { t: 'spiesse', shape: 'pilz', cols: ['#b0472b', '#f0e0c0'] }],
     ['faeulnissturm', 'Fäulnissturm', 'Pflanze', 95, 90, { t: 'wolke', gross: true, cols: ['#8a9a3a', '#f0e0c0', '#4e1d12'] }, 'gift', 35]],
    // 11 Frostpfote
    [['eisbiss', 'Eisbiss', 'Wasser', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#ffffff', '#3ad4ff'] }],
     ['frostatem', 'Frostatem', 'Wasser', 56, 100, { t: 'atem', cols: ['#ffffff', '#bfe6ff', '#3ad4ff'] }],
     ['eissplitter', 'Eissplitter', 'Wasser', 76, 95, { t: 'salve', shape: 'eis', n: 7, cols: ['#ffffff', '#3ad4ff'] }],
     ['blizzard', 'Blizzard', 'Luft', 100, 85, { t: 'wirbel', shape: 'schnee', cols: ['#ffffff', '#bfe6ff'] }, 'furcht', 15]],
    // 12 Irrflamme
    [['flammenfaust', 'Flammenfaust', 'Feuer', 40, 100, { t: 'lunge', deco: 'faust', cols: ['#ff8a2e', '#fff27a'] }],
     ['feuerball', 'Feuerball', 'Feuer', 56, 100, { t: 'ball', shape: 'feuer', r: 16, cols: ['#ff8a2e', '#fff27a'] }, 'brand', 20],
     ['hoellenfeuer', 'Höllenfeuer', 'Feuer', 82, 95, { t: 'saeule', cols: ['#ff3b1a', '#ff8a2e', '#fff27a'] }, 'brand', 20],
     ['seelenbrand', 'Seelenbrand', 'Schatten', 100, 85, { t: 'seelen', cols: ['#ff8a2e', '#9affb0'] }, 'brand', 30]],
    // 13 Lavawurm
    [['lavaspucke', 'Lavaspucke', 'Feuer', 40, 100, { t: 'ball', shape: 'lava', r: 11, cols: ['#ff7a2e', '#ffe14d'] }],
     ['schlangenbiss', 'Schlangenbiss', 'Feuer', 52, 100, { t: 'lunge', deco: 'biss', cols: ['#ff7a2e', '#ffe14d'] }, 'gift', 20],
     ['magmaschwall', 'Magmaschwall', 'Feuer', 76, 95, { t: 'flut', cols: ['#ff7a2e', '#ffe14d'], lava: true }, 'brand', 20],
     ['vulkanausbruch', 'Vulkanausbruch', 'Erde', 100, 85, { t: 'meteor', shape: 'lava', n: 7, cols: ['#ff7a2e', '#ffe14d', '#5a3a2e'] }, 'brand', 30]],
    // 14 Kristallkern
    [['kristallsplitter', 'Kristallsplitter', 'Erde', 40, 100, { t: 'salve', shape: 'kristall', n: 6, cols: ['#7de4ff', '#ffffff'] }],
     ['felsfaust', 'Felsfaust', 'Erde', 56, 100, { t: 'lunge', deco: 'faust', cols: ['#8a84a0', '#7de4ff'] }],
     ['prismastrahl', 'Prismastrahl', 'Licht', 82, 95, { t: 'strahl', dick: true, prisma: true }],
     ['edelsturz', 'Edelsturz', 'Erde', 100, 85, { t: 'spiesse', shape: 'kristall', cols: ['#7de4ff', '#ffffff'], gross: true }, 'furcht', 15]],
    // 15 Grabstaub
    [['grabgriff', 'Grabgriff', 'Schatten', 40, 100, { t: 'schatten', cols: ['#4a4a40', '#9affb0'] }],
     ['seelenhieb', 'Seelenhieb', 'Schatten', 56, 100, { t: 'hieb', x: true, cols: ['#9affb0', '#ffffff'] }],
     ['totenklage', 'Totenklage', 'Schatten', 76, 95, { t: 'puls', cols: ['#9affb0', '#ffffff'] }, 'furcht', 20],
     ['seelenernte', 'Seelenernte', 'Schatten', 96, 90, { t: 'saugen', cols: ['#9affb0', '#ffffff'], stark: true }]],
    // 16 Dornenkönig
    [['wurzelhieb', 'Wurzelhieb', 'Pflanze', 60, 100, { t: 'ranken', cols: ['#4a3a22', '#3f9a3f'] }],
     ['dornensturm', 'Dornensturm', 'Pflanze', 85, 95, { t: 'salve', shape: 'dorn', n: 14, cols: ['#e8e0b0', '#2f8f3a'] }, 'gift', 25],
     ['koenigsfluch', 'Königsfluch', 'Pflanze', 108, 90, { t: 'saeule', cols: ['#2f8f3a', '#9aff6a', '#ffffff'] }, 'gift', 30]],
    // 17 Riffschlund
    [['scherenschlag', 'Scherenschlag', 'Erde', 60, 100, { t: 'lunge', deco: 'zange', gross: true, cols: ['#8fe0ff'] }],
     ['strudel', 'Strudel', 'Wasser', 85, 95, { t: 'wirbel', shape: 'blase', cols: ['#2f6f8f', '#8fe0ff'] }],
     ['tsunami', 'Tsunami', 'Wasser', 108, 90, { t: 'flut', gross: true, cols: ['#2f6f8f', '#8fe0ff'] }]],
    // 18 Rabenkaiser
    [['kaiserschwinge', 'Kaiserschwinge', 'Luft', 60, 100, { t: 'hieb', gross: true, cols: ['#8a5cf0', '#ffffff'] }],
     ['federsturm', 'Federsturm', 'Luft', 85, 95, { t: 'salve', shape: 'feder', n: 14, cols: ['#1d1830', '#8a5cf0'] }],
     ['schattensturz', 'Schattensturz', 'Schatten', 108, 90, { t: 'sprung', deco: 'sturz', dunkel: true }, 'furcht', 20]],
    // 19 Frostwyrm
    [['eishauch', 'Eishauch', 'Wasser', 60, 100, { t: 'atem', cols: ['#ffffff', '#bfe6ff', '#3ad4ff'] }],
     ['frostklaue', 'Frostklaue', 'Luft', 85, 95, { t: 'hieb', gross: true, cols: ['#bfe6ff', '#ffffff'] }],
     ['eiszeit', 'Eiszeit', 'Wasser', 108, 90, { t: 'spiesse', shape: 'eis', gross: true, cols: ['#bfe6ff', '#ffffff'] }, 'furcht', 20]],
    // 20 Moorkrake
    [['fangarmhieb', 'Fangarmhieb', 'Wasser', 60, 100, { t: 'lunge', deco: 'umarmung', cols: ['#6cf0c8'] }],
     ['tintenwolke', 'Tintenwolke', 'Wasser', 85, 95, { t: 'wolke', gross: true, cols: ['#0c2024', '#1f4a4a', '#6cf0c8'] }],
     ['tiefsog', 'Tiefsog', 'Schatten', 108, 90, { t: 'wirbel', shape: 'blase', cols: ['#0c2024', '#6cf0c8'], gross: true }, 'furcht', 20]],
    // 21 Aschekönig
    [['aschefaust', 'Aschefaust', 'Schatten', 60, 100, { t: 'lunge', deco: 'faust', gross: true, cols: ['#ff7a2e', '#fff27a'] }],
     ['glutstrahl', 'Glutstrahl', 'Feuer', 88, 95, { t: 'strahl', dick: true }, 'brand', 25],
     ['ascheregen', 'Ascheregen', 'Feuer', 108, 90, { t: 'meteor', shape: 'feuer', n: 10, cols: ['#ff7a2e', '#fff27a', '#4a1414'] }, 'brand', 30]],
    // 22 Totenlord
    [['knochenhand', 'Knochenhand', 'Schatten', 60, 100, { t: 'schatten', gross: true, cols: ['#d9d3bd', '#9affb0'] }],
     ['todeshauch', 'Todeshauch', 'Schatten', 85, 95, { t: 'atem', cols: ['#9affb0', '#26241c', '#ffffff'] }],
     ['seelensturm', 'Seelensturm', 'Schatten', 108, 90, { t: 'seelen', cols: ['#9affb0', '#ffffff'], viele: true }, 'furcht', 25]],
    // 23 Prismagolem
    [['prismafaust', 'Prismafaust', 'Licht', 60, 100, { t: 'lunge', deco: 'faust', gross: true, cols: ['#ffe680', '#ffffff'] }],
     ['lichtbrechung', 'Lichtbrechung', 'Licht', 88, 95, { t: 'strahl', dick: true, prisma: true }],
     ['kristallsturm', 'Kristallsturm', 'Erde', 108, 90, { t: 'spiesse', shape: 'kristall', gross: true, cols: ['#ffe680', '#7de4ff'] }, 'furcht', 20]],
    // 24 Sternschnuppe
    [['sternenbiss', 'Sternenbiss', 'Licht', 42, 100, { t: 'lunge', deco: 'biss', cols: ['#fff3a8', '#7de4ff'] }],
     ['funkenregen', 'Funkenregen', 'Licht', 54, 100, { t: 'salve', shape: 'funke', n: 8, cols: ['#fff3a8', '#c9d4ff'] }],
     ['kometenschweif', 'Kometenschweif', 'Licht', 78, 95, { t: 'meteor', shape: 'stern', n: 6, cols: ['#fff3a8', '#7de4ff'] }],
     ['himmelssturz', 'Himmelssturz', 'Licht', 100, 90, { t: 'saeule', cols: ['#c9d4ff', '#ffffff', '#fff3a8'] }]],
    // 25 Blutschemen
    [['blutbiss', 'Blutbiss', 'Schatten', 42, 100, { t: 'lunge', deco: 'biss', cols: ['#ff3b5a', '#5a1020'] }],
     ['blutregen', 'Blutregen', 'Schatten', 56, 100, { t: 'salve', shape: 'klumpen', n: 7, cols: ['#a01a30', '#ff3b5a'] }],
     ['mondsichel', 'Mondsichel', 'Schatten', 78, 95, { t: 'lunge', deco: 'schweif', cols: ['#ff3b5a', '#ffd0d8'] }, 'furcht', 20],
     ['blutmondnova', 'Blutmond-Nova', 'Schatten', 100, 90, { t: 'nova', cols: ['#ff3b5a', '#a01a30', '#5a1020'], ringe: 4 }, 'furcht', 25]],
    // 26 Glutei
    [['glutschnabel', 'Glutschnabel', 'Feuer', 42, 100, { t: 'lunge', deco: 'schnabel', cols: ['#ffe14d', '#ff6a2e'] }],
     ['schalensplitter', 'Schalensplitter', 'Feuer', 56, 100, { t: 'salve', shape: 'fels', n: 5, cols: ['#ffb36b', '#7a3a1a'] }],
     ['drachenatem', 'Drachenatem', 'Feuer', 80, 95, { t: 'atem', cols: ['#fff3a8', '#ffb36b', '#ff6a2e'] }, 'brand', 20],
     ['weltenbrand', 'Weltenbrand', 'Licht', 102, 90, { t: 'meteor', shape: 'feuer', n: 9, cols: ['#ff6a2e', '#fff3a8', '#ffe14d'] }, 'brand', 25]],
    // 27 Zwillingskopf
    [['doppelbiss', 'Doppelbiss', 'Normal', 42, 100, { t: 'lunge', deco: 'biss', cols: ['#fff3a8', '#c9a24a'] }],
     ['loewenpranke', 'Löwenpranke', 'Normal', 58, 100, { t: 'lunge', deco: 'kralle', cols: ['#ffd54a', '#fff'] }],
     ['chimaerenatem', 'Chimärenatem', 'Schatten', 82, 95, { t: 'atem', cols: ['#ff6a2e', '#8a3ffc', '#fff3a8'] }, 'brand', 20],
     ['urgewalt', 'Urgewalt', 'Normal', 104, 90, { t: 'nova', cols: ['#ffd54a', '#ff6a2e', '#8a3ffc'], ringe: 4 }]],
    // 28 Wiesenreh
    [['hufstoss', 'Hufstoss', 'Normal', 40, 100, { t: 'sprung', deco: 'stampf' }],
     ['wiesenruhe', 'Wiesenruhe', 'Pflanze', 0, 100, { t: 'segen', cols: ['#8fd36a', '#fff0a8'] }, null, 0, 0.35],
     ['bluetenreigen', 'Blütenreigen', 'Pflanze', 62, 95, { t: 'salve', shape: 'blatt', n: 10, cols: ['#ff9ad0', '#fff0f4'] }, 'schlaf', 25],
     ['hirschsturm', 'Hirschsturm', 'Normal', 98, 90, { t: 'lunge', deco: 'horn', gross: true, cols: ['#e6d6a8', '#8fd36a'] }, 'furcht', 15]],
    // 29 Blattraupe
    [['blattnagen', 'Blattnagen', 'Pflanze', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#8fd05a', '#f0e46a'] }],
     ['seidenfaden', 'Seidenfaden', 'Pflanze', 52, 100, { t: 'netz', cols: ['#ffffff', '#d8f0c0'] }, 'schlaf', 25],
     ['raupenrolle', 'Raupenrolle', 'Normal', 72, 95, { t: 'rolle', cols: ['#8fd05a', '#f0e46a'] }],
     ['seidensturm', 'Seidensturm', 'Luft', 96, 90, { t: 'tornado', cols: ['#ffffff', '#f0e46a', '#8fd05a'] }]],
    // 30 Blütenfalter
    [['fluegelschlag', 'Flügelschlag', 'Luft', 40, 100, { t: 'hieb', cols: ['#ff9ad0', '#ffffff'] }],
     ['schuppenstaub', 'Schuppenstaub', 'Luft', 54, 100, { t: 'wolke', cols: ['#ff9ad0', '#fff0a8'] }, 'schlaf', 30],
     ['prismaflug', 'Prismaflug', 'Licht', 78, 95, { t: 'regenbogen' }],
     ['sturmflattern', 'Sturmflattern', 'Luft', 98, 90, { t: 'tornado', cols: ['#ff9ad0', '#fff0a8', '#ffffff'], gross: true }, 'furcht', 15]],
    // 31 Honighummel
    [['brummstoss', 'Brummstoss', 'Normal', 40, 100, { t: 'lunge', deco: 'kopfnuss', cols: ['#f2c230'] }],
     ['giftstachel', 'Giftstachel', 'Pflanze', 54, 100, { t: 'stich', cols: ['#f2c230', '#a0e040'] }, 'gift', 30],
     ['pollenschauer', 'Pollenschauer', 'Pflanze', 70, 95, { t: 'wurf', shape: 'pollen', n: 10, cols: ['#f2c230', '#fff6a0'] }],
     ['schwarmangriff', 'Schwarmangriff', 'Normal', 98, 90, { t: 'wirbel', shape: 'funke', cols: ['#f2c230', '#2a2218'] }, 'furcht', 15]],
    // 32 Schilfkröte
    [['panzerstoss', 'Panzerstoss', 'Normal', 40, 100, { t: 'lunge', deco: 'faust', cols: ['#4a8a5a', '#e0c88a'] }],
     ['wasserkanone', 'Wasserkanone', 'Wasser', 56, 100, { t: 'ball', shape: 'blase', r: 15, cols: ['#3fa0ff', '#bfe6ff'] }],
     ['panzerrolle', 'Panzerrolle', 'Erde', 74, 95, { t: 'rolle', cols: ['#4a8a5a', '#e0c88a'] }],
     ['gezeitenwelle', 'Gezeitenwelle', 'Wasser', 98, 90, { t: 'flut', cols: ['#3fa0ff', '#bfe6ff'] }, 'furcht', 15]],
    // 33 Moorfrosch
    [['zungenschlag', 'Zungenschlag', 'Wasser', 40, 100, { t: 'zunge', cols: ['#ff7a9a', '#ffd0dc'] }],
     ['schleimspritzer', 'Schleimspritzer', 'Pflanze', 54, 100, { t: 'salve', shape: 'klumpen', n: 5, cols: ['#7ad060', '#e8e070'] }, 'gift', 30],
     ['quakschall', 'Quakschall', 'Wasser', 72, 95, { t: 'schall', cols: ['#7dd9c4', '#e8e070'] }],
     ['giftflut', 'Giftflut', 'Pflanze', 98, 85, { t: 'flut', cols: ['#4aa860', '#e8e070'] }, 'gift', 35]],
    // 34 Schneckenritter
    [['schleimspur', 'Schleimspur', 'Normal', 40, 100, { t: 'wurf', shape: 'schleim', n: 4, cols: ['#d8c88a', '#e0708a'] }],
     ['fuehlerhieb', 'Fühlerhieb', 'Normal', 52, 100, { t: 'peitsche', cols: ['#c9b07a', '#e0708a'] }],
     ['gehaeuserammen', 'Gehäuserammen', 'Erde', 76, 95, { t: 'rolle', cols: ['#e0708a', '#c9b07a'] }],
     ['spiralsturz', 'Spiralsturz', 'Erde', 100, 85, { t: 'wirbel', shape: 'fels', cols: ['#e0708a', '#c9b07a'] }, 'furcht', 20]],
    // 35 Leuchtqualle
    [['nesselfaden', 'Nesselfaden', 'Wasser', 40, 100, { t: 'ranken', cols: ['#7fd4f0', '#d8a0ff'] }, 'gift', 20],
     ['lichtpuls', 'Lichtpuls', 'Licht', 56, 100, { t: 'puls', cols: ['#d8a0ff', '#ffffff'] }],
     ['heilleuchten', 'Heilleuchten', 'Licht', 0, 100, { t: 'segen', cols: ['#d8a0ff', '#fff8c0'] }, null, 0, 0.4],
     ['polarlicht', 'Polarlicht', 'Licht', 98, 90, { t: 'saeule', cols: ['#7fd4f0', '#d8a0ff', '#ffffff'] }]],
    // 36 Wüstenskorpion
    [['scherenzwick', 'Scherenzwick', 'Erde', 40, 100, { t: 'lunge', deco: 'zange', cols: ['#c9a24a'] }],
     ['sandwirbel', 'Sandwirbel', 'Erde', 54, 95, { t: 'sand', cols: ['#d9c27c', '#a8884a'] }],
     ['skorpiongift', 'Skorpiongift', 'Erde', 74, 95, { t: 'stich', cols: ['#e0603a', '#ffe14d'], gross: true }, 'gift', 30],
     ['duenenglut', 'Dünenglut', 'Feuer', 98, 85, { t: 'flut', cols: ['#ff8a2e', '#ffe14d'], lava: true }, 'brand', 25]],
    // 37 Giftspinne
    [['spinnenbiss', 'Spinnenbiss', 'Schatten', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#a060e0', '#ff4a6a'] }, 'gift', 20],
     ['netzwurf', 'Netzwurf', 'Schatten', 54, 100, { t: 'netz', cols: ['#ffffff', '#c9b8ff'] }, 'schlaf', 20],
     ['giftspritzer', 'Giftspritzer', 'Pflanze', 74, 95, { t: 'wurf', shape: 'tropfen', n: 6, cols: ['#7ad060', '#d6ff7a'] }, 'gift', 40],
     ['todesnetz', 'Todesnetz', 'Schatten', 98, 85, { t: 'netz', gross: true, cols: ['#d0c0ff', '#ff4a6a'] }, 'furcht', 20]],
    // 38 Nachtfledermaus
    [['flatterbiss', 'Flatterbiss', 'Schatten', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#c9a0ff', '#5a4a70'] }],
     ['ultraschall', 'Ultraschall', 'Luft', 56, 100, { t: 'schall', cols: ['#c9a0ff', '#ffffff'] }, 'furcht', 20],
     ['blutsauger', 'Blutsauger', 'Schatten', 74, 95, { t: 'saugen', cols: ['#c9a0ff', '#a01a30'] }],
     ['nachtschwarm', 'Nachtschwarm', 'Schatten', 98, 85, { t: 'wirbel', shape: 'feder', cols: ['#2a2038', '#c9a0ff'] }, 'schlaf', 25]],
    // 39 Waldkauz
    [['krallenschwung', 'Krallenschwung', 'Luft', 40, 100, { t: 'lunge', deco: 'kralle', cols: ['#ffe0a0'] }],
     ['federnadeln', 'Federnadeln', 'Luft', 56, 100, { t: 'wurf', shape: 'nadel', n: 7, cols: ['#9a7a5a', '#ffe0a0'] }],
     ['weisenruf', 'Weisenruf', 'Licht', 74, 95, { t: 'schall', cols: ['#ffe0a0', '#ffffff'] }, 'schlaf', 30],
     ['mondjagd', 'Mondjagd', 'Licht', 98, 90, { t: 'sprung', deco: 'sturz', cols: ['#ffe0a0', '#ffffff'] }]],
    // 40 Baumwächter
    [['astschlag', 'Astschlag', 'Pflanze', 40, 100, { t: 'lunge', deco: 'faust', cols: ['#7a5a3a', '#4fae4a'] }],
     ['rindenpanzer', 'Rindenpanzer', 'Pflanze', 0, 100, { t: 'segen', cols: ['#4fae4a', '#ffd54a'] }, null, 0, 0.4],
     ['wurzelfessel', 'Wurzelfessel', 'Erde', 70, 95, { t: 'ranken', cols: ['#7a5a3a', '#4fae4a'] }, 'furcht', 20],
     ['urwaldzorn', 'Urwaldzorn', 'Pflanze', 100, 85, { t: 'meteor', shape: 'blatt', n: 10, cols: ['#4fae4a', '#ffd54a'] }, 'gift', 20]],
    // 41 Gewitterwolke
    [['windstoss', 'Windstoss', 'Luft', 40, 100, { t: 'tornado', cols: ['#dfe6f5', '#9fb0d0'] }],
     ['regenguss', 'Regenguss', 'Wasser', 54, 100, { t: 'wurf', shape: 'tropfen', n: 12, von: 'oben', cols: ['#7ab0ff', '#d0e8ff'] }],
     ['blitzschlag', 'Blitzschlag', 'Luft', 78, 95, { t: 'blitz', n: 1, cols: ['#ffe14d', '#ffffff'] }],
     ['sturmgewitter', 'Sturmgewitter', 'Luft', 100, 85, { t: 'blitz', n: 5, cols: ['#ffe14d', '#ffffff'] }, 'furcht', 15]],
    // 42 Eisbock
    [['hornstoss', 'Hornstoss', 'Erde', 40, 100, { t: 'lunge', deco: 'horn', cols: ['#b09a70', '#d8e2ea'] }],
     ['felssprung', 'Felssprung', 'Erde', 56, 95, { t: 'sprung', deco: 'stampf' }],
     ['frostwurf', 'Frostwurf', 'Wasser', 74, 95, { t: 'salve', shape: 'eis', n: 6, cols: ['#ffffff', '#3ad4ff'] }],
     ['gipfelsturm', 'Gipfelsturm', 'Erde', 100, 85, { t: 'meteor', shape: 'fels', n: 8, cols: ['#d8e2ea', '#8a7a62'] }, 'furcht', 15]],
    // 43 Lavasalamander
    [['funkenspucke', 'Funkenspucke', 'Feuer', 40, 100, { t: 'ball', shape: 'feuer', r: 12, cols: ['#ff8a2e', '#fff27a'] }],
     ['flammenpeitsche', 'Flammenpeitsche', 'Feuer', 54, 100, { t: 'peitsche', cols: ['#ff8a2e', '#fff27a'] }, 'brand', 20],
     ['magmabiss', 'Magmabiss', 'Feuer', 76, 95, { t: 'lunge', deco: 'biss', cols: ['#ff8a2e', '#fff27a'] }, 'brand', 25],
     ['glutwirbel', 'Glutwirbel', 'Feuer', 98, 85, { t: 'wirbel', shape: 'feuer', cols: ['#ff8a2e', '#fff27a'] }, 'brand', 30]],
    // 44 Aschephönix
    [['funkenschwinge', 'Funkenschwinge', 'Feuer', 42, 100, { t: 'hieb', cols: ['#ffb02e', '#fff27a'] }],
     ['feuerfedern', 'Feuerfedern', 'Feuer', 56, 100, { t: 'salve', shape: 'feder', n: 7, cols: ['#d8481e', '#ffb02e'] }, 'brand', 25],
     ['wiedergeburt', 'Wiedergeburt', 'Feuer', 0, 100, { t: 'segen', cols: ['#ffb02e', '#fff27a'] }, null, 0, 0.5],
     ['phoenixsturz', 'Phönixsturz', 'Feuer', 102, 90, { t: 'sprung', deco: 'feuer' }, 'brand', 30]],
    // 45 Hirschkäfer
    [['zangengriff', 'Zangengriff', 'Erde', 40, 100, { t: 'lunge', deco: 'zange', cols: ['#c98a42'] }],
     ['kaeferflug', 'Käferflug', 'Luft', 56, 95, { t: 'sprung', deco: 'sturz', cols: ['#c98a42', '#ffffff'] }],
     ['erdschleuder', 'Erdschleuder', 'Erde', 74, 95, { t: 'ball', shape: 'fels', r: 14, cols: ['#5a3a2a', '#c98a42'] }],
     ['zangensturm', 'Zangensturm', 'Erde', 98, 85, { t: 'hieb', gross: true, cols: ['#c98a42', '#ffffff'] }, 'furcht', 15]],
    // 46 Einhorn
    [['lichtstoss', 'Lichtstoss', 'Licht', 42, 100, { t: 'lunge', deco: 'horn', cols: ['#ffffff', '#7a4ad0'] }],
     ['heilglanz', 'Heilglanz', 'Licht', 0, 100, { t: 'segen', cols: ['#fff0f8', '#ff9ad8'] }, null, 0, 0.45],
     ['regenbogenstrahl', 'Regenbogenstrahl', 'Licht', 80, 95, { t: 'regenbogen' }],
     ['sternenjagd', 'Sternenjagd', 'Licht', 100, 90, { t: 'meteor', shape: 'stern', n: 9, cols: ['#fff0f8', '#ff9ad8'] }, 'schlaf', 20]],
    // 47 Axolotl
    [['blubberbiss', 'Blubberbiss', 'Wasser', 40, 100, { t: 'lunge', deco: 'biss', cols: ['#ff6a9a', '#ffd0dc'] }],
     ['blasenreigen', 'Blasenreigen', 'Wasser', 54, 100, { t: 'salve', shape: 'blase', n: 8, cols: ['#ffd0dc', '#ffffff'] }],
     ['regeneration', 'Regeneration', 'Wasser', 0, 100, { t: 'segen', cols: ['#ff9ab8', '#ffffff'] }, null, 0, 0.45],
     ['seedrachenwoge', 'Seedrachenwoge', 'Wasser', 100, 85, { t: 'flut', gross: true, cols: ['#ff6a9a', '#bfe6ff'] }, 'furcht', 15]],
  ];
  SIG.forEach((list, i) => {
    const f = F[i];
    f.sig = list.map(([id, n, el, pow, acc, anim, st, pr, heal]) => {
      const mv = M[id] = { n, el, pow, acc, anim, id };
      if (st) { mv.st = st; mv.p = pr; }
      if (heal) mv.heal = heal;
      return id;
    });
    f.sigLv = f.legend ? [1, 6, 12] : [1, 4, 12, 24];
  });

  CAM.ANZ_FAMILIEN = 16;                // normale Familien am Anfang; danach 8 Riesen, 4 Spezial-Mobs (24 bis 27) und 20 weitere Fabelwesen (28 bis 47)
  CAM.RARITAET = ['Gewöhnlich', 'Selten', 'Episch', 'Legendär'];
  CAM.RAR_FARBE = ['#b9b4a8', '#5fd38a', '#c46bff', '#ffb347'];
  CAM.FANGRATE = [0.9, 0.55, 0.3, 0.06];
  CAM.PREIS_RAR = [1, 2.5, 6, 30];
  // ---------- Fangen ----------
  // Fang-Stufe = Durchschnitt der Stufen deines Teams + Erfahrung (je gewonnener Kampf +0.1, je Fang +0.15).
  // Grundchance (einfache Kugel, voller LP): Mob eine Stufe unter 0.73 unter deiner Fang-Stufe = 33 %, viel tiefere Mobs bis 95 %, höhere werden schnell sehr schwer (Stufe 20 bei Fang-Stufe 5.7 ca. 1 %).
  // Schaden hilft: die Chance wird mit dem Exponenten (1 - 0.65 * Schaden) hochgezogen. Gute Kugeln, Schlaf, Gift und Brand helfen auch.
  CAM.fangStufe = function (team, xp) {
    const t = team || [];
    return (t.length ? t.reduce((a, m) => a + m.lv, 0) / t.length : 1) + (xp || 0);
  };
  // kugel = Gegenstand: Die starke Kugel (fang 1) gibt die Grundkurve, die einfache ist ab höheren Stufen deutlich schlechter (steil),
  // die Meister-Kugel (zehn) versucht es zehnmal: p = 1 - (1 - p)^10.
  CAM.fangChance = function (stufe, m, kugel, schaden) {
    const f = CAM.FAMILIEN[m.fam];
    const s = schaden !== undefined ? schaden : (m.hp <= 0 ? 1 : 1 - m.hp / m.mhp);
    const d = m.lv - (stufe - 0.73), odds = 0.4925 * Math.exp(-(d < 0 ? 1.2 : 0.259 + (kugel.steil || 0)) * d) * (CAM.FANGRATE[f.rar] / 0.9) * kugel.fang * (1 + (kugel.bonus || 0) * Math.exp(-0.4 * Math.max(0, d)));
    let base = Math.max(0.0005, Math.min(0.95, odds / (1 + odds)));
    let p = Math.pow(base, 1 - 0.65 * Math.max(0, Math.min(1, s)));
    if (m.status) p *= m.status.t === 'schlaf' ? 1.5 : 1.2;
    p = Math.max(0.0005, Math.min(0.999, p));
    if (kugel.zehn) p = 1 - Math.pow(1 - p, 10);
    return Math.min(0.999, p);
  };
  CAM.chanceText = p => (p >= 0.995 ? '100' : p >= 0.1 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + ' %';
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

  // Bei jedem Stufenaufstieg steigen die LP um mindestens 1 und Angriff und Verteidigung ebenfalls (der Zusatz lv * 0.55 sorgt dafür).
  CAM.werte = function (fam, stufe, lv) {
    const f = F[fam], b = f.base;
    const k = STUFEN_FAKTOR[f.stufen][stufe - 1];
    const w = i => Math.floor((2 * b[i] * k * lv) / 100) + 5;
    const w2 = i => Math.floor((2 * b[i] * k * lv) / 100 + lv * 0.55) + 5;
    return {
      hp: Math.floor((2 * b[0] * k * lv) / 100 + lv * 0.4) + lv + 12,
      atk: w2(1), def: w2(2), spd: w(3),
    };
  };

  // Welche Attacken ein Mob auf einer Stufe kennt (höchstens 4, die zuletzt gelernten).
  // Jede Familie hat ihre eigenen Attacken (f.sig). Bei Mobs mit zwei Elementen gehört eine davon zum zweiten Element.
  CAM.attackenFuer = function (fam, lv) {
    const f = F[fam];
    const l = f.sig.map((id, i) => [id, f.sigLv[i]]);
    if (f.el === 'Licht' || f.el2 === 'Licht') l.push(['genesung', 18]);
    const got = [];
    for (const [id, min] of l.sort((a, b) => a[1] - b[1])) if (lv >= min && !got.includes(id)) got.push(id);
    return got.slice(-4);
  };

  // ---------- Heilhaus: Preis und Dauer pro Mob ----------
  // Dauer nach Stufe und Schaden: Stufe 5 = 1 Sekunde, Stufe 100 = 3 Minuten (bei vollem Schaden, linear dazwischen).
  const HEIL_RAR = [1, 1.7, 2.8, 5];
  CAM.heilInfo = function (m) {
    const f = F[m.fam];
    const schaden = m.hp <= 0 ? 1 : Math.max(0, 1 - m.hp / m.mhp), stat = m.status ? 1 : 0;
    if (schaden <= 0 && !stat) return null;
    const preis = Math.max(2, Math.round((6 + m.lv * 2.2) * HEIL_RAR[f.rar] * (0.2 + 0.8 * schaden) * (m.hp <= 0 ? 1.25 : 1) + stat * 3));
    const lvF = Math.max(0, Math.min(1, (m.lv - 5) / 95));
    const sek = Math.max(1, Math.min(180, Math.round(1 + 179 * Math.max(schaden, stat ? 0.15 : 0) * lvF)));
    return { preis, sek, schaden };
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
  // Alte Spielstände auf die aktuellen Werte und Attacken bringen (LP-Zuwachs wird gutgeschrieben)
  CAM.angleichen = function (m) {
    const alt = m.mhp || 0;
    CAM.neuBerechnen(m);
    if (m.hp > 0 && m.mhp > alt && alt) m.hp = Math.min(m.mhp, m.hp + m.mhp - alt);
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
      spawn: [[28, 30], [29, 30], [30, 24], [31, 14], [8, 26], [33, 10], [34, 14], [45, 8], [47, 8], [7, 8], [2, 8], [0, 8], [1, 6], [5, 8], [40, 3], [46, 2]] },
    { id: 1, n: 'Sonnenküste', cx: 315, cy: 305, lake: 0.30, tree: 0.80, grass: 0.52, obst: 'palme',
      wetter: { klar: 5, hitze: 3, gewitter: 2, regen: 1 },
      pal: { g1: '#d9c27c', g2: '#cdb36a', gr: '#8fa850', gr2: '#c5d97a', tr: '#3f8a3a', tr2: '#68b84a', trunk: '#7a5a30', w: '#2a8ab5', w2: '#70d0e8', path: '#b89a5a', deco: '#ffffff' },
      dorf: 'Sonnenhafen', boss: 1,
      spawn: [[9, 35], [32, 24], [35, 22], [36, 24], [30, 8], [31, 8], [41, 10], [1, 14], [4, 18], [0, 8], [3, 10]] },
    { id: 2, n: 'Herbstwald', cx: 85, cy: 215, lake: 0.08, tree: 0.58, grass: 0.46, obst: 'baum',
      wetter: { wind: 4, nebel: 3, regen: 3, klar: 2 },
      pal: { g1: '#7a5a34', g2: '#85643a', gr: '#a0521e', gr2: '#e08a2e', tr: '#c24e1a', tr2: '#e0a02e', trunk: '#4a2e1a', w: '#3a5a6a', w2: '#6a8a9a', path: '#9a8458', deco: '#e0a02e' },
      dorf: 'Laubfall', boss: 2,
      spawn: [[10, 30], [28, 14], [39, 18], [37, 14], [45, 16], [34, 12], [38, 8], [29, 10], [4, 20], [2, 12], [7, 10], [3, 10], [40, 6]] },
    { id: 3, n: 'Frostgipfel', cx: 205, cy: 70, lake: 0.12, tree: 0.66, grass: 0.50, obst: 'tanne',
      wetter: { schnee: 4, klar: 3, nebel: 2 },
      pal: { g1: '#dfe9f2', g2: '#cfdce8', gr: '#b8cfe2', gr2: '#f4fbff', tr: '#2f5f4a', tr2: '#e8f4ff', trunk: '#3a2a22', w: '#5a7fa8', w2: '#a8d0f0', path: '#9aa8b8', deco: '#ffffff' },
      dorf: 'Frostwacht', boss: 3,
      spawn: [[11, 35], [42, 32], [39, 10], [41, 8], [3, 18], [4, 14], [5, 16]] },
    { id: 4, n: 'Nebelmoor', cx: 90, cy: 90, lake: 0.26, tree: 0.62, grass: 0.46, obst: 'totbaum',
      wetter: { nebel: 5, dunst: 3, regen: 2 },
      pal: { g1: '#4a5a3e', g2: '#3f4e35', gr: '#2e4a3a', gr2: '#6a9a6a', tr: '#2a3a2a', tr2: '#4e6a4e', trunk: '#2a2218', w: '#2a4a4a', w2: '#4a7a6a', path: '#6a6248', deco: '#9affb0' },
      dorf: 'Moorbruch', boss: 4,
      spawn: [[1, 26], [33, 28], [47, 16], [32, 12], [34, 14], [37, 16], [38, 12], [7, 20], [5, 12], [15, 12], [10, 12]] },
    { id: 5, n: 'Aschegipfel', cx: 325, cy: 85, lake: 0.0, tree: 0.0, grass: 0.50, obst: 'fels', lava: 0.80,
      wetter: { asche: 5, hitze: 3, klar: 1 },
      pal: { g1: '#4a403c', g2: '#3e3532', gr: '#2e2624', gr2: '#8a4a2a', tr: '#3a3230', tr2: '#5a4e48', trunk: '#222', w: '#d84a1a', w2: '#ffb42e', path: '#6a5a50', deco: '#ff7a2e' },
      dorf: 'Aschenburg', boss: 5,
      spawn: [[12, 22], [13, 26], [43, 30], [36, 12], [44, 6], [0, 20], [6, 16]] },
    { id: 6, n: 'Knochenfriedhof', cx: 200, cy: 335, lake: 0.06, tree: 0.70, grass: 0.46, obst: 'grab',
      wetter: { blutmond: 4, gewitter: 3, nebel: 3, klar: 1 },
      pal: { g1: '#4a4658', g2: '#3e3a4c', gr: '#38334a', gr2: '#8a7ab0', tr: '#2a2438', tr2: '#4a4260', trunk: '#1c1626', w: '#26264a', w2: '#4a4a8a', path: '#6a647a', deco: '#d9d3bd' },
      dorf: 'Gräberstein', boss: 6,
      spawn: [[15, 32], [38, 28], [37, 20], [39, 10], [6, 22], [4, 16], [12, 8], [1, 8]] },
    { id: 7, n: 'Kristallschlucht', cx: 330, cy: 195, lake: 0.06, tree: 0.62, grass: 0.48, obst: 'kristall',
      wetter: { klar: 4, nebel: 2, gewitter: 2 },
      pal: { g1: '#5a5470', g2: '#4e4864', gr: '#4a4a7a', gr2: '#8a9aff', tr: '#4a4470', tr2: '#7de4ff', trunk: '#2a2540', w: '#2a3a7a', w2: '#6a8aff', path: '#8a84a0', deco: '#7de4ff' },
      dorf: 'Kristallfurt', boss: 7,
      spawn: [[14, 32], [45, 16], [38, 12], [42, 10], [3, 26], [5, 16], [11, 12], [46, 3]] },
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
    siegel1: { n: 'Einfache Fangkugel', preis: 20, fang: 1, steil: 0.255, info: 'Fängt geschwächte Mobs, bei hohen Stufen kaum' },
    siegel2: { n: 'Starke Fangkugel', preis: 100, fang: 1, bonus: 0.8, info: 'Fängt auch höhere Mobs' },
    siegel3: { n: 'Meister-Fangkugel', preis: 1200, fang: 1, zehn: true, info: 'Zehn Fangversuche in einem Wurf' },
    trank: { n: 'Heiltrank', preis: 30, heil: 40, info: 'Heilt 40 LP' },
    trank2: { n: 'Grosser Heiltrank', preis: 100, heil: 120, info: 'Heilt 120 LP' },
    ei: { n: 'Drachenei', preis: 0, fund: false, info: 'Schlüpft nach 600 Schritten', nurBeute: true },
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
