// Sternen-Party – App: Menüs, Spieler-Auswahl, Hauptschleife, Pause
'use strict';

const App = {
  bildschirm: 'menue', pause: false, cv: null, g: null, bw: 0, bh: 0, alt: 0,
  lokal: null,          // Auswahl im lokalen Menü: 4 Plätze
  letzteAuswahl: null,  // für „Nochmal“
  vorschauId: null,

  init() {
    this.cv = $('c'); this.g = this.cv.getContext('2d');
    addEventListener('resize', () => this.groesse());
    this.groesse();
    Eingabe.init();
    UI.init();
    this.zeiger();
    this.menues();
    Eingabe.hoere((block, rolle) => this.menueTaste(block, rolle));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.bildschirm === 'spiel' && Spiel.Z && Spiel.Z.modus === 'lokal') this.pausieren(true);
    });
    // Online-Spiel läuft weiter, auch wenn der Tab im Hintergrund ist (requestAnimationFrame schläft dann)
    setInterval(() => { if (document.hidden && Netz.aktiv() && this.bildschirm === 'spiel') this.schritt(performance.now()); }, 50);
    // Einladungslink #CODE
    const code = HUB ? HUB.cleanCode(location.hash) : '';
    if (code.length === 4) { this.zeige('sOnline'); $('oCode').value = code; this.onlineZeigen(); }
    else this.zeige('sMenue');
    requestAnimationFrame(t => this.loop(t));
  },
  groesse() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.bw = innerWidth; this.bh = innerHeight;
    this.cv.width = Math.round(this.bw * d); this.cv.height = Math.round(this.bh * d);
    this.g.setTransform(d, 0, 0, d, 0, 0);
  },
  // Touchpad-Zeiger in Minispiel-Koordinaten umrechnen
  zeiger() {
    const umrechnen = e => {
      const s = Spiel.lauf && Spiel.lauf.skala;
      if (!s) return;
      Eingabe.zeiger.x = clamp((e.clientX - s.ox) / s.sk, 0, WELT_B);
      Eingabe.zeiger.y = clamp((e.clientY - s.oy) / s.sk, 0, WELT_H);
    };
    this.cv.addEventListener('pointermove', umrechnen);
    this.cv.addEventListener('pointerdown', e => { umrechnen(e); if (e.button === 0) { Eingabe.zeiger.unten = true; Eingabe.zeiger.klicks++; } });
    addEventListener('pointerup', () => { Eingabe.zeiger.unten = false; });
    this.cv.addEventListener('contextmenu', e => e.preventDefault());
  },

  // ---------- Hauptschleife ----------
  loop(now) {
    this.schritt(now);
    requestAnimationFrame(t => this.loop(t));
  },
  schritt(now) {
    const dt = Math.min(.1, Math.max(0, (now - (this.alt || now)) / 1000));
    this.alt = now;
    const g = this.g, bw = this.bw, bh = this.bh;
    if (this.bildschirm === 'spiel' && Spiel.Z) {
      if (!this.pause) {
        Uhr.tick(dt);
        if (Spiel.host && Spiel.lauf) Spiel.lauf.tick(dt);
      }
      const Z = Spiel.Z;
      this.vorschauPflegen(dt);
      Ton.musikLaeuft = Z.phase === 'mini' ? 'mini' : 'brett';
      if (Z.phase === 'mini' && Spiel.lauf) Spiel.lauf.zeichne(g, bw, bh);
      else if (Z.phase === 'mini-intro' && Spiel.vorschau) { Spiel.vorschau.zeichne(g, bw, bh, true); g.fillStyle = 'rgba(8,10,20,.45)'; g.fillRect(0, 0, bw, bh); }
      else Ansicht.zeichne(g, bw, bh, dt);
      UI.update(dt);
      Netz.tick();
    } else {
      Ton.musikLaeuft = 'brett';
      this.menueHintergrund(g, bw, bh, now / 1000);
      if (this.lokal && $('sLokal').classList.contains('hidden') === false) this.lokalAnimation();
    }
    Ton.musikTick();
  },
  // Während der Minispiel-Ansage läuft im Hintergrund eine Vorschau mit Computerspielern
  vorschauPflegen(dt) {
    const Z = Spiel.Z;
    if (Z.phase === 'mini-intro' && Z.mini) {
      if (this.vorschauId !== Z.mini.id + ':' + Z.v) {
        if (!Spiel.vorschau || Spiel.vorschau.def.id !== Z.mini.id) {
          const info = Object.assign({}, Spiel.miniInfo());
          info.quellen = info.teilnehmer.map(() => ({ art: 'bot' })); info.ich = -1;
          info.stufen = info.teilnehmer.map(() => 1);
          Spiel.vorschau = new MiniLauf(Minis.finde(Z.mini.id), info, 'host', true);
        }
        this.vorschauId = Z.mini.id + ':' + Z.v;
      }
      if (!this.pause) Spiel.vorschau.tick(dt);
    } else Spiel.vorschau = null;
  },
  menueHintergrund(g, bw, bh, t) {
    const h = g.createLinearGradient(0, 0, 0, bh);
    h.addColorStop(0, '#2a1b5e'); h.addColorStop(.55, '#5a2a8a'); h.addColorStop(1, '#ff6fa8');
    g.fillStyle = h; g.fillRect(0, 0, bw, bh);
    // Funkelnde Sterne
    for (let i = 0; i < 40; i++) {
      const x = (i * 197.3 % 1) * bw || ((i * 0.618) % 1) * bw, y = ((i * 0.377) % 1) * bh * .7;
      const s = 2 + (Math.sin(t * 2 + i) + 1) * 2;
      g.fillStyle = `rgba(255,255,255,${.3 + .3 * Math.sin(t * 3 + i)})`;
      g.beginPath(); g.arc(((i * 0.618) % 1) * bw, y, s, 0, TAU); g.fill();
    }
    // Hügel und tanzende Figuren
    g.fillStyle = '#3c9a4a'; g.beginPath(); g.ellipse(bw / 2, bh + bh * .25, bw * .8, bh * .38, 0, 0, TAU); g.fill();
    g.fillStyle = '#5fbf45'; g.beginPath(); g.ellipse(bw / 2, bh + bh * .3, bw * .7, bh * .36, 0, 0, TAU); g.fill();
    const r = Math.min(bw, bh) * .045;
    for (let i = 0; i < FIGUREN.length; i++) {
      const x = bw * (.08 + i * .12), y = bh * .97 - Math.abs(Math.sin(t * 3 + i * .8)) * r * .9;
      zeichneFigur(g, i, x, y, r, { t: t + i, huepf: Math.max(0, -Math.cos(t * 6 + i * 1.6)) * .3, emo: 'froh', jubeln: Math.sin(t * 1.5 + i) > .6 });
    }
    zeichneStella(g, bw * .5, bh * .12 + Math.sin(t) * 6, Math.min(bw, bh) * .045, t);
  },

  // ---------- Menüs ----------
  zeige(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
    this.aktuellesMenue = id;
    setTimeout(() => { const b = id && $(id).querySelector('[data-start],.btn.haupt,.btn'); if (b && document.activeElement.tagName !== 'INPUT') b.focus(); }, 30);
  },
  menues() {
    $('mBots').onclick = () => this.lokalZeigen('bots');
    $('mLokal').onclick = () => this.lokalZeigen('zwei');
    $('mOnline').onclick = () => { this.zeige('sOnline'); this.onlineZeigen(); };
    $('mAnleitung').onclick = () => this.zeige('sAnleitung');
    $('mOnline').disabled = !HUB;
    if (!HUB) $('mOnline').querySelector('small').textContent = 'Nur auf langwiligi.site verfügbar';
    for (const b of document.querySelectorAll('[data-zurueck]')) b.onclick = () => { if (this.aktuellesMenue === 'sLobby') Netz.verlassen(); this.zeige('sMenue'); };
    $('lStart').onclick = () => this.lokalStarten();
    $('oErstellen').onclick = () => this.onlineErstellen();
    $('oBeitreten').onclick = () => this.onlineBeitreten();
    $('lbStart').onclick = () => { if (Netz.host && Netz.spielStarten()) this.spielZeigen(); };
    $('lbLink').onclick = () => {
      const url = location.origin + location.pathname + '#' + Netz.code;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { $('lbLink').textContent = 'Kopiert!'; }, () => { $('lbLink').textContent = url; });
      setTimeout(() => { $('lbLink').textContent = 'Link kopieren'; }, 2500);
    };
    // Einstellungen (Segment-Knöpfe)
    for (const seg of document.querySelectorAll('.seg[data-einst]')) {
      const key = seg.dataset.einst;
      const setzen = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(Einst[key]) === b.dataset.v));
      seg.querySelectorAll('button').forEach(b => b.onclick = () => {
        const v = b.dataset.v;
        Einst[key] = v === 'true' ? true : v === 'false' ? false : +v;
        einstSpeichern(); setzen();
        for (const s2 of document.querySelectorAll(`.seg[data-einst="${key}"]`)) s2.querySelectorAll('button').forEach(x => x.classList.toggle('on', String(Einst[key]) === x.dataset.v));
        if (key === 'stufe' && this.lokal) this.lokal.forEach(p => { if (p.art === 'bot') p.stufe = Einst.stufe; });
        if (Netz.host && Netz.lobby && ['runden', 'stufe', 'bonus'].includes(key)) { Netz.lobby.einst[key] = Einst[key]; Netz.lobbySenden(); }
        this.lokalRendern();
      });
      setzen();
    }
    const ton = $('tonKnopf');
    const tonSetzen = () => { ton.textContent = Einst.stumm ? '🔇' : '🔊'; ton.title = Einst.stumm ? 'Ton an' : 'Ton aus'; };
    ton.onclick = () => { Ton.init(); Ton.stumm(!Einst.stumm); tonSetzen(); ton.blur(); };
    tonSetzen();
    $('pauseKnopf').onclick = () => { if (Spiel.Z && Spiel.Z.modus === 'lokal') this.pausieren(true); else this.zeige('sPause'); };
    $('pWeiter').onclick = () => this.pausieren(false);
    $('pEnde').onclick = () => this.zumMenue();
  },
  // Menüs mit allen Tastenblöcken bedienen (Fokus wandern lassen, Aktion klickt)
  menueTaste(block, rolle) {
    if (this.bildschirm === 'spiel' && !this.pause && this.aktuellesMenue !== 'sPause') return;
    if (this.aktuellesMenue === 'sLokal' && block >= 0) { this.lokalTaste(block, rolle); return; }
    const tippt = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (tippt) return;
    if (rolle === 'zurueck') {
      if (this.aktuellesMenue === 'sPause') this.pausieren(false);
      else if (this.aktuellesMenue === 'sLokal' || this.aktuellesMenue === 'sAnleitung' || this.aktuellesMenue === 'sOnline') this.zeige('sMenue');
      return;
    }
    const menue = this.aktuellesMenue && $(this.aktuellesMenue);
    if (!menue) return;
    const knoepfe = [...menue.querySelectorAll('button:not([disabled]),input')].filter(b => b.offsetParent);
    if (!knoepfe.length) return;
    let i = knoepfe.indexOf(document.activeElement);
    // Aktion (auch Enter/Leertaste, deren Standardwirkung abgefangen wird) klickt den Knopf mit Fokus
    if (rolle === 'aktion') { if (i >= 0 && knoepfe[i].tagName === 'BUTTON') knoepfe[i].click(); return; }
    const d = rolle === 'hoch' || rolle === 'links' ? -1 : 1;
    i = i < 0 ? 0 : (i + d + knoepfe.length) % knoepfe.length;
    knoepfe[i].focus();
    Ton.spiel('fokus');
  },

  // ---------- Lokal: Beitreten mit der eigenen Aktionstaste ----------
  // art 'bots': 1 Mensch gegen 3 Computer, mit Touchpad-Minispielen. 'zwei': 2 Menschen an einer Tastatur + 2 Computer.
  lokalZeigen(art) {
    this.lokalArt = art || this.lokalArt || 'zwei';
    if (!this.lokal) this.lokal = [0, 1, 2, 3].map(i => ({ art: 'bot', block: -1, figur: -1, bereit: false, stufe: Einst.stufe }));
    // Zu viele Menschen für diesen Modus? Überzählige werden wieder Computer
    let n = 0;
    this.lokal.forEach((p, i) => { if (p.art === 'mensch' && ++n > this.maxMenschen()) this.lokal[i] = { art: 'bot', block: -1, figur: -1, bereit: false, stufe: Einst.stufe }; });
    this.lokal.forEach(p => { p.bereit = false; });
    const bots = this.lokalArt === 'bots';
    $('lTitel').textContent = bots ? 'Gegen Computer' : 'Lokal zu zweit';
    $('lText').innerHTML = bots
      ? 'Drück eine <b>Aktionstaste</b> (Q, R, U oder Enter), um mitzumachen. Du spielst gegen drei Computer und kannst in den Minispielen auch das Touchpad benutzen.'
      : 'Jeder nimmt sich einen Tastenblock und drückt seine <b>Aktionstaste</b>. Höchstens zwei Spieler, die anderen Plätze spielt der Computer.';
    this.figurenVerteilen();
    this.zeige('sLokal');
    this.lokalRendern();
  },
  figurenVerteilen() {
    const L = this.lokal;
    const vergeben = new Set(L.filter(p => p.art === 'mensch').map(p => p.figur));
    for (const p of L) {
      if (p.art === 'mensch') continue;
      p.figur = -1;
    }
    for (const p of L) {
      if (p.art === 'mensch') continue;
      let f = 0; while (vergeben.has(f)) f++;
      p.figur = f; vergeben.add(f);
    }
  },
  maxMenschen() { return this.lokalArt === 'bots' ? 1 : 2; },
  lokalTaste(block, rolle) {
    const L = this.lokal;
    // Gegen Computer: alle Tasten gehören dem einen Spieler
    if (this.lokalArt === 'bots' && block >= 0) { const m = L.find(p => p.art === 'mensch'); if (m) block = m.block; }
    let i = L.findIndex(p => p.art === 'mensch' && p.block === block);
    if (i < 0) {
      if (rolle !== 'aktion' || block < 0) return;
      if (L.filter(p => p.art === 'mensch').length >= this.maxMenschen()) return;
      // Beitreten: ersten Computer-Platz übernehmen
      i = L.findIndex(p => p.art === 'bot');
      if (i < 0) return;
      const belegt = new Set(L.filter(p => p.art === 'mensch').map(p => p.figur));
      let f = Einst.figuren[i] != null && !belegt.has(Einst.figuren[i]) ? Einst.figuren[i] : 0;
      while (belegt.has(f)) f = (f + 1) % FIGUREN.length;
      L[i] = { art: 'mensch', block, figur: f, bereit: false, stufe: 1 };
      this.figurenVerteilen();
      Ton.spiel('glueck');
    } else {
      const p = L[i];
      if (rolle === 'aktion') { if (!p.bereit) { p.bereit = true; Ton.spiel('treffer'); } }
      else if (rolle === 'runter') {
        if (p.bereit) p.bereit = false;
        else { L[i] = { art: 'bot', block: -1, figur: -1, bereit: false, stufe: Einst.stufe }; this.figurenVerteilen(); Ton.spiel('weg'); }
      } else if ((rolle === 'links' || rolle === 'rechts') && !p.bereit) {
        const belegt = new Set(L.filter((q, k) => k !== i && q.art === 'mensch').map(q => q.figur));
        let f = p.figur;
        do { f = (f + (rolle === 'links' ? -1 : 1) + FIGUREN.length) % FIGUREN.length; } while (belegt.has(f));
        p.figur = f; this.figurenVerteilen(); Ton.spiel('fokus');
      }
    }
    this.lokalRendern();
    this.autoStartPruefen();
  },
  autoStartPruefen() {
    const menschen = this.lokal.filter(p => p.art === 'mensch');
    clearTimeout(this.startTimer);
    $('lStatus').textContent = !menschen.length ? 'Drückt eure Aktionstaste zum Mitmachen!' : menschen.every(p => p.bereit) ? 'Alle bereit – los geht\'s!' : 'Wer mitmacht, drückt nochmals Aktion, wenn er bereit ist.';
    if (menschen.length && menschen.every(p => p.bereit)) this.startTimer = setTimeout(() => this.lokalStarten(), 1100);
  },
  lokalRendern() {
    if (!this.lokal) return;
    const L = this.lokal;
    const genutzt = new Set(L.filter(p => p.art === 'mensch').map(p => p.block));
    $('lPlaetze').innerHTML = L.map((p, i) => {
      const f = FIGUREN[p.figur];
      const kopf = p.art === 'mensch'
        ? `<div class="pkopf">Spieler ${i + 1}</div><div class="psteuer">${blockText(p.block)}</div>`
        : `<div class="pkopf">Computer</div><div class="psteuer">${['Leicht', 'Mittel', 'Schwer'][p.stufe]}</div>`;
      const fuss = p.art === 'mensch'
        ? (p.bereit ? `<div class="pbereit ok">✔ Bereit</div>` : `<div class="pbereit"><kbd>${BLOECKE[p.block].tasten[1]}</kbd><kbd>${BLOECKE[p.block].tasten[3]}</kbd> Figur · <kbd>${BLOECKE[p.block].aktionText}</kbd> bereit · <kbd>${BLOECKE[p.block].tasten[2]}</kbd> raus</div>`)
        : `<div class="pbereit frei">Frei – Aktionstaste drücken</div>`;
      return `<div class="pkarte${p.art === 'mensch' ? ' mensch' : ''}${p.bereit ? ' bereit' : ''}" style="--f:${PLATZ_FARBEN[i]}">${kopf}
        <canvas class="pfig" data-i="${i}" width="220" height="200"></canvas>
        <div class="pname">${f.name} <small>${f.tier}</small></div>${fuss}</div>`;
    }).join('');
    // Freie Tastenblöcke als Hinweis
    $('lBloecke').innerHTML = BLOECKE.map((b, k) => `<span class="${genutzt.has(k) ? 'weg' : ''}">${blockText(k)}</span>`).join('');
    const menschen = L.filter(p => p.art === 'mensch');
    $('lStart').textContent = menschen.length ? 'Starten' : 'Nur zuschauen (4 Computer)';
    $('lStart').disabled = menschen.length > 0 && !menschen.every(p => p.bereit);
  },
  lokalAnimation() {
    const t = performance.now() / 1000;
    for (const c of document.querySelectorAll('#lPlaetze .pfig')) {
      const p = this.lokal[+c.dataset.i];
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      const hops = p.bereit ? Math.abs(Math.sin(t * 6)) * 14 : 0;
      zeichneFigur(g, p.figur, 110, 182 - hops, 62, { t: t + +c.dataset.i, emo: p.bereit ? 'froh' : 'normal', jubeln: p.bereit, alpha: p.art === 'mensch' ? 1 : .75 });
    }
  },
  lokalStarten() {
    clearTimeout(this.startTimer);
    if (this.bildschirm === 'spiel') return;
    const L = this.lokal;
    const namenZaehler = {};
    const spieler = L.map((p, i) => ({
      name: p.art === 'mensch' ? `${FIGUREN[p.figur].name}` : FIGUREN[p.figur].name,
      figur: p.figur, art: p.art, block: p.block, slot: -1, stufe: p.stufe,
    }));
    for (const s of spieler) { namenZaehler[s.name] = (namenZaehler[s.name] || 0) + 1; }
    Einst.figuren = L.map(p => p.figur); einstSpeichern();
    this.letzteAuswahl = spieler;
    this.letzteOpt = { modus: 'lokal', runden: Einst.runden, bonus: Einst.bonus, zeiger: this.lokalArt === 'bots' };
    Spiel.neu(spieler, this.letzteOpt);
    this.spielZeigen();
  },
  spielZeigen() {
    Uhr.tempo = Einst.tempo || 1;
    Uhr.abbrechen();
    this.zeige(null);
    this.bildschirm = 'spiel'; this.pause = false;
    Ansicht.zuruecksetzen(); UI.zuruecksetzen();
    if (Spiel.host) Spiel.starten();
  },
  pausieren(an) {
    if (an && this.bildschirm !== 'spiel') return;
    this.pause = an && Spiel.Z && Spiel.Z.modus === 'lokal';
    if (an) this.zeige('sPause'); else { this.zeige(null); }
  },
  nochmal() {
    if (Spiel.Z.modus === 'lokal') {
      Spiel.beenden();
      Spiel.neu(this.letzteAuswahl, Object.assign({}, this.letzteOpt, { runden: Einst.runden, bonus: Einst.bonus }));
      this.spielZeigen();
    } else if (Netz.host) {
      Spiel.beenden();
      Netz.lobby.laeuft = false;
      Netz.senden({ t: 'lobbyZurueck' });
      this.zurLobby();
    }
  },
  zumMenue() {
    Spiel.beenden();
    Spiel.Z = null; Spiel.lauf = null; Spiel.vorschau = null;
    Netz.verlassen();
    this.bildschirm = 'menue'; this.pause = false;
    UI.zuruecksetzen();
    $('hud').classList.add('hidden');
    this.zeige('sMenue');
  },
  fehlerMenue(text) {
    if (this.bildschirm === 'spiel') { Spiel.beenden(); Spiel.Z = null; Spiel.lauf = null; }
    this.bildschirm = 'menue';
    UI.zuruecksetzen(); $('hud').classList.add('hidden');
    this.zeige('sOnline'); this.onlineZeigen();
    $('oFehler').textContent = text;
  },

  // ---------- Online ----------
  onlineZeigen() {
    $('oName').value = HUB ? HUB.getName() : '';
    $('oFehler').textContent = '';
    if (HUB) HUB.loadBoard(GAME_ID, $('oBoard'), HUB.getName());
    setTimeout(() => (($('oName').value ? ($('oCode').value ? $('oBeitreten') : $('oErstellen')) : $('oName'))).focus(), 60);
  },
  onlineName() {
    const n = $('oName').value.trim().slice(0, 16);
    if (!n) { $('oFehler').textContent = 'Bitte gib zuerst einen Namen ein.'; $('oName').focus(); return null; }
    HUB.setName(n);
    return n;
  },
  async onlineErstellen() {
    const n = this.onlineName(); if (!n) return;
    $('oFehler').textContent = 'Verbinde …';
    try { await Netz.erstellen(n); $('oFehler').textContent = ''; this.zurLobby(); }
    catch (e) { $('oFehler').textContent = HUB.errorText(e); Netz.verlassen(); }
  },
  async onlineBeitreten() {
    const n = this.onlineName(); if (!n) return;
    const code = HUB.cleanCode($('oCode').value);
    if (code.length !== 4) { $('oFehler').textContent = 'Der Code hat 4 Zeichen.'; return; }
    $('oFehler').textContent = 'Verbinde …';
    try { await Netz.beitreten(code, n); $('oFehler').textContent = ''; this.zurLobby(); }
    catch (e) { $('oFehler').textContent = HUB.errorText(e); Netz.verlassen(); }
  },
  zurLobby() {
    if (this.bildschirm === 'spiel') { Spiel.beenden(); Spiel.Z = null; Spiel.lauf = null; }
    this.bildschirm = 'menue';
    UI.zuruecksetzen(); $('hud').classList.add('hidden');
    this.zeige('sLobby');
    this.lobbyZeigen();
    Netz.boardEl = $('lbBoard');
  },
  lobbyZeigen() {
    if (this.aktuellesMenue !== 'sLobby') return;
    const L = Netz.lobby;
    $('lbCode').textContent = Netz.code || '····';
    if (!L) { $('lbSpieler').innerHTML = '<div class="hinweis">Warte auf den Gastgeber …</div>'; return; }
    $('lbSpieler').innerHTML = [0, 1, 2, 3].map(k => {
      const s = L.spieler[k];
      if (!s) return `<div class="lbz leer"><span>Freier Platz – wird vom Computer gespielt</span></div>`;
      return `<div class="lbz" style="--f:${PLATZ_FARBEN[k]}"><img src="${figurBild(s.figur, 64)}" alt=""><b>${esc(s.name)}</b><span>${FIGUREN[s.figur].name}${s.slot === 0 ? ' · Gastgeber' : ''}${s.slot === Netz.you ? ' · Du' : ''}</span></div>`;
    }).join('');
    const ich = L.spieler.find(s => s.slot === Netz.you);
    $('lbFiguren').innerHTML = FIGUREN.map((f, i) => {
      const weg = L.spieler.some(s => s.figur === i && s.slot !== Netz.you);
      return `<button class="fwahl${ich && ich.figur === i ? ' on' : ''}" data-f="${i}" ${weg ? 'disabled' : ''} title="${f.name} (${f.tier})"><img src="${figurBild(i, 72)}" alt=""><span>${f.name}</span></button>`;
    }).join('');
    $('lbFiguren').querySelectorAll('[data-f]').forEach(b => b.onclick = () => Netz.figurWaehlen(+b.dataset.f));
    const e = L.einst;
    $('lbEinst').classList.toggle('hidden', !Netz.host);
    $('lbEinstGast').classList.toggle('hidden', Netz.host);
    $('lbEinstGast').textContent = `${e.runden} Runden · Computer ${['Leicht', 'Mittel', 'Schwer'][e.stufe]} · Bonus-Sterne ${e.bonus ? 'an' : 'aus'}`;
    $('lbStart').classList.toggle('hidden', !Netz.host);
    $('lbWarte').classList.toggle('hidden', Netz.host);
  },
  onlineSpielStart(z) {
    Netz.eingaben = {};
    Spiel.uebernehmen(z);
    Spiel.lauf = null;
    this.spielZeigen();
    Netz.zustandEmpfangen(z);
  },
};

addEventListener('load', () => App.init());
