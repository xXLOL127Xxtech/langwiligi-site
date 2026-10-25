'use strict';
// Catch a Mob – kleine Pixelart-Symbole (10 × 10) für Gegenstände, Elemente, Zustände und Menüpunkte.
// Jedes Symbol ist ein Raster aus Buchstaben, die Farbe pro Buchstabe steht in PAL. Mit `a`/`A` bekommt ein Symbol seine Hauptfarbe (hell/dunkel).
// Benutzung: CAM.Icons.html('sword', 20) gibt ein <img> zurück. Menüs (UI.choose) setzen das passende Symbol vor die Beschriftung selbst.
(function (G) {
  const CAM = G.CAM, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAL = { k: '#1b1030', w: '#ffffff', g: '#a9a5bd', G: '#5d5877', r: '#e8444a', R: '#a82434', o: '#ff9a3c', O: '#c4601c', y: '#ffd54a', Y: '#b8901c',
    l: '#7ed957', d: '#3a8f45', b: '#4a9dff', B: '#2a5fb8', c: '#7fe3ff', p: '#a56bff', P: '#6a35c9', m: '#ff8ad8', n: '#8a5a34', t: '#e8c88a' };
  const S = (...rows) => rows;
  const SHAPES = {
    ball: S('...kkkk...', '..kaaaak..', '.kawaaaak.', '.kaaaaaak.', 'kkkkkkkkkk', 'kwwwkkwwwk', '.kwwwwwwk.', '.kwwwwwAk.', '..kwwwAk..', '...kkkk...'),
    potion: S('...kttk...', '...kwwk...', '..kwwwwk..', '.kwaaaawk.', '.kaaaaaak.', '.kaaaaaak.', '.kaaaaaAk.', '.kaaaaAAk.', '..kAAAAk..', '...kkkk...'),
    heart: S('.kkk..kkk.', 'krrrkkrrrk', 'krwrrrrrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....', '..........', '..........'),
    gem: S('..kkkkkk..', '.kwwaaaak.', 'kwaaaaaaAk', 'kaaaaaaAAk', '.kaaaaAAk.', '..kaaAAk..', '...kaAk...', '....kk....', '..........', '..........'),
    feather: S('........kk', '......kkak', '....kkaaak', '...kaaaak.', '..kwaaaak.', '.kwaaaak..', 'kwaaakk...', 'nkkk......', 'n.........', '..........'),
    thorn: S('..........', '.......kk.', '......kak.', '.....kaak.', '....kaak..', '...kaak...', '..kaak....', '.kaak.....', 'kak.......', 'kk........'),
    flame: S('....k.....', '...kok....', '...koyk.k.', '..kooyk.k.', '.kkooyokk.', '.koooyyook', '.koooyyook', '.kooyyyook', '..kooyyok.', '...kkkkk..'),
    bolt: S('....kkkk..', '...kyyyk..', '..kyyyk...', '.kyyyyyk..', '.kkkyyyk..', '....kyyk..', '...kyyk...', '...kyk....', '..kyk.....', '..kk......'),
    rune: S('..kkkkkk..', '.kGGGGGGk.', 'kGGgGGgGGk', 'kGgGGGgGGk', 'kGGgggGGGk', 'kGGGgGGGGk', 'kGGgGgGGGk', 'kGgGGGgGGk', '.kGGGGGGk.', '..kkkkkk..'),
    dust: S('..........', '..k...k...', '.kwk.kwk..', '..k.kwk.k.', '.k.kkk.kwk', 'kwk.k.k.k.', '.k.kwk....', '...kwwk.k.', '..kkkkkkwk', '..........'),
    swirl: S('..kkkkkk..', '.kaaaaaak.', 'kaakkkkaak', 'kak....kak', 'kak.kk.kak', 'kak.kk.kak', 'kaak..kaak', '.kaaaaaak.', '..kkkkkk..', '..........'),
    crack: S('.kkkkkkkk.', 'kGGGGkGGGk', 'kGgGGkGgGk', 'kGGGkGGGGk', 'kGGGkkGGGk', 'kGGGGkGGGk', 'kGgGGGkGGk', 'kGGGGkGGGk', '.kkkkkkkk.', '..........'),
    egg: S('...kkkk...', '..kwwwwk..', '.kwwpwwwk.', '.kwwwwwwk.', 'kwwpwwwpwk', 'kwwwwwwwwk', 'kwpwwwpwwk', '.kwwwwwwk.', '..kkkkkk..', '..........'),
    bone: S('kk......kk', 'kwk....kwk', '.kwkkkkwk.', '..kwwwwk..', '..kwwwwk..', '.kwkkkkwk.', 'kwk....kwk', 'kk......kk', '..........', '..........'),
    moon: S('...kkkk...', '..kyyyyk..', '.kyyk.....', '.kyk......', '.kyk......', '.kyyk.....', '..kyyyyk..', '...kkkk...', '..........', '..........'),
    berry: S('....kk....', '...kdlk...', '..kk.kk...', '.kpppppk..', 'kppwpppPk.', 'kpppppPPk.', 'kppppPPPk.', '.kpPPPPk..', '..kkkkk...', '..........'),
    ice: S('....kk....', '...kwck...', '...kwck...', '..kwcck...', '..kwcccck.', '.kwccccck.', '.kwcccbbk.', '..kcccbk..', '...kbbk...', '....kk....'),
    shell: S('....kkk...', '..kkwwwkk.', '.kwtwwtwwk', 'kwtwwtwwtk', 'kwtwwtwwtk', 'kwwtwtwtwk', '.kwtwtwtk.', '..kkwtwk..', '....kkk...', '..........'),
    coal: S('..........', '...kkkk...', '..kGGGGk..', '.kGgGGGGk.', '.kGGGGgGk.', '.kGGGGGGk.', '..kGGGGk..', '...kkkk...', '..........', '..........'),
    shield: S('.kkkkkkkk.', 'kaaaaaaaak', 'kawaaaaAak', 'kawaaaaAak', 'kaaaaaaAak', '.kaaaaAak.', '..kaaAak..', '...kaAk...', '....kk....', '..........'),
    drop: S('....kk....', '....kak...', '...kaaak..', '..kawaaak.', '.kawaaaaAk', '.kaaaaaaAk', '.kaaaaaAAk', '..kaaaAAk.', '...kkkkk..', '..........'),
    leaf: S('.......kkk', '....kkkaak', '..kkaaaaak', '.kaaaaaAak', '.kaaaaAAk.', 'kkaaAAAk..', 'nkkAAk....', 'nk.kk.....', 'n.........', '..........'),
    mountain: S('..........', '....kk....', '...kwwk...', '..kwaaak..', '.kaaaaaak.', '.kaaaakaAk', 'kaaaakaaAk', 'kaaakaaaAk', 'kkkkkkkkkk', '..........'),
    wind: S('..........', '.kkkkkk...', 'kwwwwwwk..', '.kkkkkwwk.', '.......kwk', '.kkkkkkwwk', 'kwwwwwwk..', '.kkkkkk...', '..........', '..........'),
    sun: S('....kk....', '.k..kk..k.', '..kkyykk..', '..kyyyyk..', 'kkyyyyyykk', 'kkyyyyyykk', '..kyyyyk..', '..kkyykk..', '.k..kk..k.', '....kk....'),
    star: S('....kk....', '....kyk...', '...kyyk...', 'kkkkyyykkk', 'kyyyyyyyyk', '.kyyyyyyk.', '..kyyyyk..', '..kyykyyk.', '.kyyk.kyyk', '.kkk...kkk'),
    ring: S('...kkkk...', '.kkaaaakk.', '.kaakkaak.', 'kaak..kaak', 'kak....kak', 'kaak..kaak', '.kaakkaak.', '.kkaaaakk.', '...kkkk...', '..........'),
    skull: S('..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwkkwwwk', '.kwwwwwwk.', '..kwkwkwk.', '..kkkkkkk.', '..........'),
    zzz: S('..........', '.kkkkkk...', '.kwwwwk...', '....kwk...', '...kwk.kkk', '..kwk..kwk', '.kwwwwk.kk', '.kkkkkk..k', '..........', '..........'),
    ghost: S('...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwkkwkkk.', '.kwkkwkkwk', '.kwwwwwwk.', '.kwwwwwwk.', '.kwkwwkwk.', '..k.kk.k..', '..........'),
    stars: S('..........', '..k....k..', '.kyk..kyk.', 'kyyyk.kyyk', '.kyk..kyk.', '..k.kk.k..', '...kyyk...', '..kyyyyk..', '...kyyk...', '....kk....'),
    eye: S('..........', '..kkkkkk..', '.kwwwwwwk.', 'kwwkbbkwwk', 'kwkbkkbkwk', 'kwwkbbkwwk', '.kwwwwwwk.', '..kkkkkk..', '..........', '..........'),
    down: S('..........', '...kkkk...', '...kaak...', '...kaak...', 'kkkkaakkkk', 'kaaaaaaaak', '.kaaaaaak.', '..kaaaak..', '...kaak...', '....kk....'),
    up: S('....kk....', '...kaak...', '..kaaaak..', '.kaaaaaak.', 'kaaaaaaaak', 'kkkkaakkkk', '...kaak...', '...kaak...', '...kkkk...', '..........'),
    sword: S('........kk', '.......kwk', '......kwk.', '.....kwk..', '.k..kwk...', '.kk.kwk...', '..kkwk....', '..kyyk....', '.kyk.kk...', 'kyk.......'),
    swords: S('kk......kk', 'kwk....kwk', '.kwk..kwk.', '..kwkkwk..', '...kwwk...', '..kwkkwk..', '.kykkkkyk.', 'kyk.kk.kyk', 'kk.......k', '..........'),
    swap: S('..........', '...k......', '..kak.....', 'kkkaakkkk.', 'kaaaaaaak.', 'kkkaakkkk.', '..kak.....', '...k...kk.', '.kkkkkkak.', '.kaaaaaak.'),
    bag: S('...kkkk...', '..knnnnk..', '...knnk...', '..kttttk..', '.knnnnnnk.', 'knnnynnnnk', 'knnnnnnnnk', 'knnnnnnnnk', '.knnnnnnk.', '..kkkkkk..'),
    boot: S('.kkkk.....', '.knnk.....', '.knnk.....', '.knnk.....', '.knnnkkk..', '.knnnnnnk.', 'kknnnnnnnk', 'knnnnnnnnk', 'kwwwwwwwwk', '.kkkkkkkk.'),
    book: S('.kkkkkkkk.', 'kaaaaaaaak', 'kawwwwwwak', 'kawGGGGwak', 'kawwwwwwak', 'kawGGGwwak', 'kawwwwwwak', 'kaaaaaaaak', '.kkkkkkkk.', '..........'),
    map: S('..........', 'kkkkkkkkkk', 'ktllkbbkdk', 'ktlkbbbkdk', 'kttkbbkddk', 'kllkkkkdkk', 'klkcckkkdk', 'kkkkkkkkkk', '..........', '..........'),
    people: S('..........', '.kkk..kkk.', 'kttk.kttk.', 'kttk.kttk.', '.kk...kk..', 'kbbbkkrrrk', 'kbbbkkrrrk', 'kbkbk.krkr', 'kk.kk..kk.', '..........'),
    gear: S('...k..k...', '..kkkkkk..', '.kkGGGGkk.', 'kkGGkkGGkk', '.kGkwwkGk.', '.kGkwwkGk.', 'kkGGkkGGkk', '.kkGGGGkk.', '..kkkkkk..', '...k..k...'),
    disk: S('.kkkkkkkk.', 'kBBwwwwBBk', 'kBBwwwwBBk', 'kBBBBBBBBk', 'kBBBBBBBBk', 'kBkkkkkkBk', 'kBkwwwwkBk', 'kBkwwwwkBk', '.kkkkkkkk.', '..........'),
    door: S('.kkkkkkk..', '.knnnnnk..', '.knttttk..', '.kntttnk..', '.kntttnk..', '.kntttnyk.', '.kntttnk..', '.kntttnk..', '.knnnnnk..', 'kkkkkkkkk.'),
    back: S('..........', '...k......', '..kak.....', '.kaak.....', 'kaaaaaaaak', 'kaaaaaaaak', '.kaak...ak', '..kak...ak', '...k..kkk.', '..........'),
    bang: S('....kk....', '...kyyk...', '...kyyk...', '...kyyk...', '...kyyk...', '....kk....', '....kk....', '...kyyk...', '...kyyk...', '....kk....'),
    x: S('..........', '.kk....kk.', 'kaak..kaak', '.kaakkaak.', '..kaaaak..', '..kaaaak..', '.kaakkaak.', 'kaak..kaak', '.kk....kk.', '..........'),
    check: S('..........', '.........k', '........kk', 'kk.....kak', 'kak...kak.', '.kak.kak..', '..kakak...', '...kak....', '....k.....', '..........'),
    box: S('..........', 'kkkkkkkkkk', 'kttttttttk', 'kkkkkkkkkk', 'knnnnnnnnk', 'knnnkknnnk', 'knnnkknnnk', 'knnnnnnnnk', 'kkkkkkkkkk', '..........'),
    coin: S('...kkkk...', '..kyyyyk..', '.kywwyyYk.', 'kyywkkyyYk', 'kyywkyyyYk', 'kyywkkyyYk', 'kyyyyyyYYk', '.kyyyyYYk.', '..kkkkkk..', '..........'),
    trophy: S('kkkkkkkkkk', 'kyyyyyyyyk', 'kywyyyyyYk', '.kyyyyyYk.', '..kyyyYk..', '...kyyk...', '...kyYk...', '..kkkkkk..', '.kyyyyyyk.', '.kkkkkkkk.'),
    badge: S('...kkkk...', '..kyyyyk..', '.kywyyyYk.', '.kyyyyyYk.', '.kyyyyYYk.', '..kyyYYk..', '..kkrrkk..', '..krrrrk..', '..kr..rk..', '..kk..kk..'),
    house: S('....kk....', '...krrk...', '..krrrrk..', '.krrrrrrk.', 'kkkkkkkkkk', '.ktttttwk.', '.ktwwtttk.', '.kttttnnk.', '.kttttnnk.', '.kkkkkkkk.'),
    globe: S('...kkkk...', '.kkbbbbkk.', '.kbllbbbk.', 'kbllllbbbk', 'kbbllbblbk', 'kbbbbbllbk', '.kbbbblbk.', '.kkbbbbkk.', '...kkkk...', '..........'),
    robot: S('....kk....', '....kr....', '.kkkkkkkk.', 'kGggggggGk', 'kGkyykyyGk', 'kGggggggGk', 'kGgkkkkgGk', '.kkkkkkkk.', '.kG....Gk.', '.kk....kk.'),
    question: S('...kkkk...', '..kaaaak..', '.kaakkaak.', '.kkk.kaak.', '....kaak..', '...kaak...', '...kaak...', '....kk....', '...kaak...', '....kk....'),
    speaker: S('..........', '.....k....', '....kwk..k', 'kkkkkwk.k.', 'kwwwkwk..k', 'kwwwkwk..k', 'kkkkkwk.k.', '....kwk..k', '.....k....', '..........'),
    cloud: S('..........', '...kkk....', '..kwwwkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kkkkkkkk.', '..b..b..b.', '.b..b..b..', '..........'),
    link: S('..........', '.kkkk.....', 'kaaaak....', 'kak.kak...', 'kak.kkkkk.', '.kkkkaaaak', '....kak.ka', '....kak.ka', '.....kaaak', '......kkk.'),
    pen: S('.......kk.', '......kyyk', '.....kyyk.', '....kyyk..', '...kyyk...', '..kyyk....', '.ktyk.....', 'kttk......', 'kkk.......', '..........'),
    bandage: S('..........', '..kkkkkk..', '.kwwrwwwk.', 'kwwwrwwwwk', 'kwwrrrwwwk', 'kwwwrwwwwk', '.kwwrwwwk.', '..kkkkkk..', '..........', '..........'),
  };
  // Hauptfarben: [hell, dunkel]
  const FARBEN = { r: ['#e8444a', '#a82434'], o: ['#ff9a3c', '#c4601c'], y: ['#ffd54a', '#b8901c'], l: ['#7ed957', '#3a8f45'], d: ['#3a8f45', '#1f5c2c'], b: ['#4a9dff', '#2a5fb8'],
    c: ['#7fe3ff', '#3a9fc8'], p: ['#a56bff', '#6a35c9'], m: ['#ff8ad8', '#c4509e'], t: ['#e8c88a', '#a8884a'], g: ['#a9a5bd', '#5d5877'], n: ['#a8744a', '#6a4020'], w: ['#ffffff', '#b9b4c8'], k: ['#4a3578', '#1b1030'] };

  // Wer bekommt welches Symbol? [Form, Farbe]
  const EL = { Normal: ['ring', 'g'], Feuer: ['flame'], Wasser: ['drop', 'b'], Pflanze: ['leaf', 'l'], Erde: ['mountain', 'n'], Luft: ['wind'], Licht: ['sun'], Schatten: ['moon', 'p'] };
  const ST = { gift: ['drop', 'p'], brand: ['flame'], schlaf: ['zzz'], furcht: ['ghost'], betaeubt: ['stars'], laehmung: ['bolt'], blind: ['eye'], schwaeche: ['down', 'g'], verwirrt: ['swirl', 'm'], bruch: ['crack'] };
  const ITEM = { siegel1: ['ball', 'r'], siegel2: ['ball', 'b'], siegel3: ['ball', 'p'], trank: ['potion', 'r'], trank2: ['potion', 'm'], gegengift: ['potion', 'l'], beleber: ['heart'],
    v_hp: ['gem', 'r'], v_atk: ['gem', 'o'], v_def: ['shield', 'b'], v_spd: ['feather', 'c'], v_gift: ['thorn', 'p'], v_brand: ['flame'], v_laehmung: ['bolt'], v_betaeubt: ['stars'],
    v_blind: ['dust'], v_verwirrt: ['swirl', 'm'], v_bruch: ['crack'], rune: ['rune'], ei: ['egg'], knochen: ['bone'], kristall: ['gem', 'c'], glut: ['coal'], beere: ['berry'],
    feder: ['feather', 'g'], eis: ['ice'], muschel: ['shell'] };

  const cache = {};
  function zeichne(form, farbe) {
    const key = form + '|' + (farbe || ''), z = cache[key]; if (z) return z;
    const rows = SHAPES[form] || SHAPES.question, c = document.createElement('canvas'); c.width = c.height = 10;
    const g = c.getContext('2d'), f = FARBEN[farbe] || [PAL.r, PAL.R];
    rows.forEach((row, y) => { for (let x = 0; x < 10; x++) { const ch = row[x]; if (!ch || ch === '.') continue; g.fillStyle = ch === 'a' ? f[0] : ch === 'A' ? f[1] : PAL[ch] || '#f0f'; g.fillRect(x, y, 1, 1); } });
    return (cache[key] = { c, url: c.toDataURL() });
  }
  const html = (form, farbe, px) => { const z = zeichne(form, farbe); return '<img class="px" src="' + z.url + '" width="' + px + '" height="' + px + '" alt="">'; };
  const mach = (tab, px0) => (k, px) => { const e = tab[k]; return e ? html(e[0], e[1], px || px0) : ''; };
  const Icons = CAM.Icons = {
    html: (form, px, farbe) => html(form, farbe, px || 20),
    el: mach(EL, 14), st: mach(ST, 16), item: mach(ITEM, 24),
    canvas: (kind, k) => { const e = ({ st: ST, el: EL, item: ITEM }[kind] || {})[k]; return e ? zeichne(e[0], e[1]).c : null; },
  };

  // Menüpunkte: Beschriftung (ohne HTML) → Symbol. Gegenstände werden über ihren Namen erkannt.
  const REGELN = [[/^(Attacke|Angreifen)/, 'sword'], [/^Wechseln|^Gegenangebot|^Mit Teammitglied|^Ins Team/, 'swap'], [/^Beutel/, 'bag'], [/^Fangen/, 'ball'], [/^Fliehen/, 'boot'],
    [/^In Ruhe/, 'leaf', 'l'], [/^Mob-Buch|^Details|^Anleitung/, 'book', 'p'], [/^Karte/, 'map'], [/Party/, 'people'], [/^Spielstand/, 'disk'], [/^Optionen/, 'gear'], [/^Zum Titelmenü|^Gehen|^Tschüss/, 'door'],
    [/Zurück$|^Zurück$/, 'back', 'g'], [/Duell|^Herausfordern|^Raid/, 'swords'], [/^Überfallen/, 'bang'], [/^Abbrechen|^Ablehnen|^Nein/, 'x', 'r'], [/^Annehmen|^Ja$/, 'check', 'l'],
    [/^Alle heilen|^Mob zur Pflege/, 'heart'], [/^Mobs abholen/, 'ball', 'r'], [/^Zwinger/, 'box'], [/verkaufen$|^Zurückkaufen|^Mobs verkaufen/, 'coin'], [/^Abzeichen/, 'badge'],
    [/^Ton/, 'speaker'], [/^Wetter/, 'cloud'], [/^Link kopieren/, 'link'], [/^Umbenennen/, 'pen'], [/^Verbessern/, 'up', 'l'], [/^Online|^Welt /, 'globe'], [/^Bots/, 'robot'],
    [/^Kampf bestätigen|^Überfall bestätigen|^Preis bestätigen|^Einsatz bestätigen/, 'check', 'l'], [/^Raid starten/, 'swords']];
  Icons.fuerLabel = function (label) {
    if (/<img|<canvas/.test(label)) return '';
    const t = label.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();
    if (CAM.ITEMS) for (const k in ITEM) { const it = CAM.ITEMS[k]; if (it && t.indexOf(it.n) === 0) return Icons.item(k, 24); }
    for (const [re, form, farbe] of REGELN) if (re.test(t)) return html(form, farbe, 20);
    return '';
  };

  // ---------- Chips: kleine Marken mit Symbol, Zahl und Erklärung beim Darüberfahren (data-tip) ----------
  SHAPES.target = S('...kkkk...', '..krrrrk..', '.krwwwwrk.', 'krwkkkkwrk', 'krwkrrkwrk', 'krwkrrkwrk', 'krwkkkkwrk', '.krwwwwrk.', '..krrrrk..', '...kkkk...');
  CAM.STATUS_INFO = { gift: 'Verliert jede Runde 1/8 der LP.', brand: 'Verliert jede Runde 1/16 der LP und macht 20 % weniger Schaden.', schlaf: 'Schläft 1 bis 3 Züge und kann nichts tun.',
    furcht: 'Verpasst mit 30 % Chance den Zug (3 Runden).', betaeubt: 'Verliert den nächsten Zug.', laehmung: 'Verpasst mit 40 % Chance den Zug (3 Runden).', blind: 'Trifft 40 % schlechter (3 Runden).',
    schwaeche: 'Macht 30 % weniger Schaden (3 Runden).', verwirrt: 'Verletzt sich mit 35 % Chance selbst (3 Runden).', bruch: 'Erleidet 25 % mehr Schaden (3 Runden).' };
  const STAT = { atk: ['Angriff', 'sword', null, 20], def: ['Verteidigung', 'shield', 'b', 20], acc: ['Genauigkeit', 'target', null, 10] };
  const chip = (kl, ico, text, tip, farbe) => '<span class="chip ' + kl + '" data-tip="' + esc(tip) + '"' + (farbe ? ' style="color:' + farbe + '"' : '') + '>' + (ico || '') + text + '</span>';
  const vz = n => (n > 0 ? '+' : '−') + Math.abs(n);
  const stufeText = (w, n, wer) => {
    const [name, , , pro] = STAT[w], p = Math.abs(n) * pro, s = n < 0 ? '−' : '+', best = Math.min(4, Math.abs(n)) * pro;
    const wirkung = w === 'acc' ? (wer === 'ich' ? 'Deine Attacken treffen ' + p + ' Prozentpunkte ' + (n < 0 ? 'seltener' : 'öfter') + '.' : 'Seine Attacken treffen ' + p + ' Prozentpunkte ' + (n < 0 ? 'seltener' : 'öfter') + '.')
      : w === 'atk' ? (wer === 'ich' ? 'Dein Schaden ist ' + p + ' % ' + (n < 0 ? 'niedriger' : 'höher') + '.' : 'Sein Schaden ist ' + p + ' % ' + (n < 0 ? 'niedriger' : 'höher') + '.')
        : (wer === 'ich' ? 'Du erleidest ' + p + ' % ' + (n < 0 ? 'mehr' : 'weniger') + ' Schaden.' : 'Er erleidet ' + p + ' % ' + (n < 0 ? 'mehr' : 'weniger') + ' Schaden.');
    void best; return (wer === 'ich' ? (w === 'atk' ? 'Dein ' : 'Deine ') : (w === 'atk' ? 'Sein ' : 'Seine ')) + name + ' ' + s + p + ' %: ' + wirkung + ' Hält bis zum Kampfende oder Wechsel.';
  };
  // Eine Attacke als Marken: Stärke, Genauigkeit, Effekte. fx = Bonus auf Status-Chancen (Vorbereitung)
  CAM.moveChips = function (mv, bonus) {
    const I = Icons.html, o = [];
    if (mv.pow) o.push(chip('pow', I('sword', 14), mv.pow, 'Stärke ' + mv.pow + ': Grundschaden. Je höher, desto mehr Schaden.'));
    else if (mv.heal) o.push(chip('gut', I('heart', 14), 'Heilt ' + Math.round(mv.heal * 100) + ' %', 'Heilt ' + Math.round(mv.heal * 100) + ' % der maximalen LP.'));
    if (!mv.self) o.push(chip(mv.acc < 75 ? 'warn' : 'acc', I('target', 14), mv.acc + ' %', 'Genauigkeit ' + mv.acc + ' %: So oft trifft die Attacke.' + (mv.acc < 75 ? ' Sie geht oft daneben.' : '')));
    if (mv.multi) o.push(chip('', '', mv.multi[0] + '–' + mv.multi[1] + '×', 'Trifft ' + mv.multi[0] + ' bis ' + mv.multi[1] + ' Mal hintereinander.'));
    if (mv.st) o.push(chip('st', Icons.st(mv.st, 14), mv.p + ' %' + (bonus ? ' +' + bonus : ''), mv.p + ' % Chance auf ' + CAM.STATUS_NAME[mv.st] + ': ' + CAM.STATUS_INFO[mv.st]));
    (mv.stg || []).forEach(g => {
      const [name, form, farbe, pro] = STAT[g.w], wert = Math.abs(g.n) * pro, ich = g.z === 'self', gut = ich ? g.n > 0 : g.n < 0;
      const tip = (ich ? 'Du selbst: ' : 'Gegner: ') + name + ' ' + (g.n > 0 ? '+' : '−') + wert + ' %. ' + (g.w === 'acc' ? (ich ? 'Deine Attacken treffen' : 'Seine Attacken treffen') + (g.n > 0 ? ' öfter.' : ' seltener.')
        : g.w === 'atk' ? (ich ? 'Dein Schaden' : 'Sein Schaden') + (g.n > 0 ? ' steigt.' : ' sinkt.') : (ich ? 'Du erleidest' : 'Er erleidet') + (g.n > 0 ? ' weniger Schaden.' : ' mehr Schaden.')) + (g.p ? ' Nur mit ' + g.p + ' % Chance.' : ' Bis zu 4 Stufen möglich.');
      o.push(chip(gut ? 'gut' : 'schlecht', (ich ? '' : '<small>Gegner</small> ') + Icons.html(form, 14, farbe) + Icons.html(g.n > 0 ? 'up' : 'down', 10, g.n > 0 ? 'l' : 'r'), (g.n > 0 ? '+' : '−') + wert + ' %' + (g.p ? ' <small>(' + g.p + ' %)</small>' : ''), tip));
    });
    if (mv.boost) o.push(chip('st', '', 'Status +' + mv.boost.add + ' %', 'Vorbereitung: Die Status-Chancen deiner Attacken steigen um ' + mv.boost.add + ' % für ' + mv.boost.n + ' Züge.'));
    if (mv.wetter) o.push(chip('', Icons.html('cloud', 14), CAM.WETTER[mv.wetter], 'Ändert das Wetter auf ' + CAM.WETTER[mv.wetter] + '.'));
    if (mv.schutz) o.push(chip('gut', Icons.html('shield', 14, 'b'), 'Schutz', 'Schützt vor dem nächsten Treffer.'));
    if (mv.saug) o.push(chip('gut', Icons.html('heart', 14), Math.round(mv.saug * 100) + ' % Saug', 'Heilt ' + Math.round(mv.saug * 100) + ' % des angerichteten Schadens.'));
    if (mv.rueck) o.push(chip('schlecht', '', 'Rückstoss ' + Math.round(mv.rueck * 100) + ' %', 'Du verlierst ' + Math.round(mv.rueck * 100) + ' % des angerichteten Schadens als LP.'));
    if (mv.selbst) o.push(chip('schlecht', '', '−' + Math.round(mv.selbst * 100) + ' % LP', 'Kostet ' + Math.round(mv.selbst * 100) + ' % deiner maximalen LP.'));
    if (mv.krit) o.push(chip('', '', 'oft kritisch', 'Trifft häufiger kritisch (doppelter Schaden).'));
    if (mv.einmal) o.push(chip('warn', '', '1× pro Kampf', 'Kann nur einmal pro Kampf eingesetzt werden.'));
    if (mv.erschoepft) o.push(chip('warn', '', 'danach Pause', 'Danach muss der Mob 1 Zug aussetzen.'));
    if (mv.schlaf) o.push(chip('warn', Icons.st('schlaf', 14), 'schläft', 'Der Mob schläft danach ein.'));
    return o.join('');
  };
  // Veränderungen und Zustände eines Mobs im Kampf. ich = true: dein Mob. Negatives ist rot, Positives grün.
  CAM.stufenChips = function (b, m, ich) {
    const o = [];
    ['atk', 'def', 'acc'].forEach(w => {
      const n = b.stufe(m, w); if (!n) return;
      const [, form, farbe, pro] = STAT[w];
      o.push(chip(n < 0 ? 'schlecht' : 'gut', Icons.html(form, 14, farbe) + Icons.html(n > 0 ? 'up' : 'down', 10, n > 0 ? 'l' : 'r'), (n > 0 ? '+' : '−') + Math.abs(n) * pro + ' %', stufeText(w, n, ich ? 'ich' : 'er')));
    });
    if (m.status) o.push(chip('st', Icons.st(m.status.t, 14), CAM.STATUS_NAME[m.status.t], (ich ? 'Dein Mob: ' : 'Gegner: ') + CAM.STATUS_NAME[m.status.t] + '. ' + CAM.STATUS_INFO[m.status.t], CAM.STATUS_COL[m.status.t]));
    return o.join('');
  };

  // Die zwei Knöpfe unten links (Beutel, Team)
  const knopf = (id, form, farbe, k) => { const b = document.getElementById(id); if (b) b.innerHTML = html(form, farbe, 24) + '<kbd>' + k + '</kbd>'; };
  knopf('qBeutel', 'bag', null, 'I'); knopf('qTeam', 'ball', 'r', 'T');
})(window);
