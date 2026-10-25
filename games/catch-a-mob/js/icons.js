'use strict';
// Catch a Mob – kleine Pixelart-Symbole (10 × 10) für Gegenstände, Elemente, Zustände und Menüpunkte.
// Jedes Symbol ist ein Raster aus Buchstaben, die Farbe pro Buchstabe steht in PAL. Mit `a`/`A` bekommt ein Symbol seine Hauptfarbe (hell/dunkel).
// Benutzung: CAM.Icons.html('sword', 20) gibt ein <img> zurück. Menüs (UI.choose) setzen das passende Symbol vor die Beschriftung selbst.
(function (G) {
  const CAM = G.CAM;
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
  // Die zwei Knöpfe unten links (Beutel, Team)
  const knopf = (id, form, farbe, k) => { const b = document.getElementById(id); if (b) b.innerHTML = html(form, farbe, 24) + '<kbd>' + k + '</kbd>'; };
  knopf('qBeutel', 'bag', null, 'I'); knopf('qTeam', 'ball', 'r', 'T');
})(window);
