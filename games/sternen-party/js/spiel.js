// Sternen-Party – Spielablauf auf dem Brett
// Der Zustand Z ist reines JSON. Nur der Host (lokal: dieser Rechner, online: Platz 0) verändert ihn über die Regie.
// Alle Rechner zeichnen nur, was in Z steht. Entscheidungen laufen über Spiel.frage(): Bots antworten selbst,
// lokale Spieler über ihren Tastenblock, Online-Spieler per Nachricht an den Host.
'use strict';

const ITEMS = {
  doppel: { name: 'Doppelwürfel', preis: 5, text: 'Zwei Würfel auf einmal. Pasch gibt 10 Münzen.' },
  dreifach: { name: 'Dreifachwürfel', preis: 10, text: 'Drei Würfel auf einmal. Drilling gibt 30 Münzen.' },
  wunsch: { name: 'Wunschwürfel', preis: 8, text: 'Du bestimmst die Zahl von 1 bis 10.' },
  turbo: { name: 'Turbo-Schuh', preis: 4, text: 'Dein Wurf zählt 3 Felder mehr.' },
  kompass: { name: 'Sternen-Kompass', preis: 15, text: 'Bringt dich direkt vor den Stern.' },
  glocke: { name: 'Gusti-Glocke', preis: 10, text: 'Ruft Gusti das Gespenst zu dir.' },
};
const MAX_ITEMS = 3, STERN_PREIS = 20;

const GRIMM_TATEN = [
  { id: 'steuer', titel: 'Grimm-Steuer!', text: 'Grimm kassiert 10 Münzen von dir.' },
  { id: 'halb', titel: 'Halbe-Halbe!', text: 'Grimm nimmt dir die Hälfte deiner Münzen weg.' },
  { id: 'revolution', titel: 'Grimm-Revolution!', text: 'Alle Münzen werden gleichmässig unter allen verteilt.' },
  { id: 'alle', titel: 'Grimms Party!', text: 'Grimm feiert ein Fest, und alle zahlen den Eintritt: 5 Münzen pro Person!' },
  { id: 'sternraub', titel: 'Sternenraub!', text: 'Grimm schnappt sich einen deiner Sterne!' },
];

const Spiel = {
  Z: null, brett: null, host: false, lauf: null, vorschau: null,
  offeneFrage: null, fragenNr: 0, fxNr: 0, meldNr: 0,
  laeuft: false, abbruch: false,

  // ---------- Aufbau ----------
  // spieler: [{ name, figur, art: 'mensch'|'bot'|'netz', block, slot, stufe }]
  neu(spieler, opt) {
    this.brett = baueBrett(BRETT_DEF);
    BrettBild.vorbereiten(this.brett);
    this.host = true; this.abbruch = false;
    this.Z = {
      v: 0, modus: opt.modus, zeiger: !!opt.zeiger, phase: 'start', runde: 1, runden: opt.runden, zug: 0, bonus: opt.bonus !== false,
      reihenfolge: [0, 1, 2, 3], aktiv: -1, schritte: 0, wuerfel: null, frage: null, meldung: null,
      fx: [], kamera: { art: 'alle' }, mini: null, roulette: null, letzte5: false, ende: null,
      sternFeld: -1, bank: 0, sternWeg: -1,
      spieler: spieler.map(s => ({
        name: s.name, figur: s.figur, art: s.art, block: s.block, slot: s.slot, stufe: s.stufe,
        feld: 0, muenzen: 0, sterne: 0, items: [], farbe: null,
        stat: { miniMuenzen: 0, maxMuenzen: 0, ereignisse: 0 },
      })),
    };
  },
  // Online-Gast: Zustand vom Host übernehmen
  uebernehmen(Z) {
    if (!this.brett) { this.brett = baueBrett(BRETT_DEF); BrettBild.vorbereiten(this.brett); }
    this.host = false;
    this.Z = Z;
  },
  aktualisiere() { this.Z.v++; if (this.Z.modus === 'online' && this.host) Netz.zustandSenden(); },
  warte(ms) { return Uhr.warte(ms).then(() => { if (this.abbruch) throw new Error('abbruch'); }); },

  // ---------- Effekte für die Anzeige ----------
  fx(typ, daten = {}) {
    const e = Object.assign({ id: ++this.fxNr, typ }, daten);
    this.Z.fx.push(e);
    if (this.Z.fx.length > 30) this.Z.fx.shift();
  },
  muenzen(sp, wert, grund) {
    const s = this.Z.spieler[sp];
    const vorher = s.muenzen;
    s.muenzen = Math.max(0, s.muenzen + wert);
    const echt = s.muenzen - vorher;
    s.stat.maxMuenzen = Math.max(s.stat.maxMuenzen, s.muenzen);
    if (echt !== 0 || wert !== 0) this.fx('muenzen', { sp, wert: echt, grund });
    return echt;
  },
  sterne(sp, wert) {
    const s = this.Z.spieler[sp];
    const vorher = s.sterne;
    s.sterne = Math.max(0, s.sterne + wert);
    this.fx('sterne', { sp, wert: s.sterne - vorher });
    return s.sterne - vorher;
  },
  // Sprechblase mit Figur. Wartet ms (oder bis der aktive Mensch bestätigt).
  async sagen(wer, titel, text, ms = 2600, sp = this.Z.aktiv) {
    this.Z.meldung = { id: ++this.meldNr, wer, titel, text };
    this.aktualisiere();
    await this.frage(sp, 'info', { titel, text, zeit: ms });
    this.Z.meldung = null;
    this.aktualisiere();
  },

  // ---------- Fragen an Spieler ----------
  // typ: info | zug | item | wuerfel | weg | janein | laden | gusti | spieler | wunsch | einsatz
  frage(sp, typ, daten = {}) {
    const Z = this.Z;
    const id = ++this.fragenNr;
    const s = sp >= 0 ? Z.spieler[sp] : null;
    Z.frage = Object.assign({ id, sp, typ }, daten);
    this.aktualisiere();
    return new Promise(res => {
      const fertig = w => {
        if (!this.offeneFrage || this.offeneFrage.id !== id) return;
        this.offeneFrage = null;
        if (Z.frage && Z.frage.id === id) Z.frage = null;
        this.aktualisiere();
        res(w);
      };
      this.offeneFrage = { id, fertig, sp, typ };
      const bot = !s || s.art === 'bot';
      if (typ === 'info') {
        // Infos laufen nach Ablauf der Zeit von selbst weiter (bei Bots etwas schneller)
        Uhr.warte(bot ? daten.zeit * .75 : daten.zeit).then(() => fertig(true));
      } else if (bot) {
        const pause = typ === 'wuerfel' ? rnd(500, 1100) : rnd(600, 1300);
        Uhr.warte(pause).then(() => fertig(KI.entscheide(sp, typ, Z.frage || daten)));
      } else if (s.art === 'netz') {
        // Wer online nicht reagiert, bekommt nach 40 s eine Entscheidung vom Computer
        setTimeout(() => fertig(KI.entscheide(sp, typ, Z.frage || daten)), 40000);
      }
    });
  },
  // Antwort von UI oder Netz. Gibt nur nach, wenn die Frage noch offen ist und vom richtigen Spieler kommt.
  antworte(id, wert, vonSlot = null) {
    const f = this.offeneFrage;
    if (!f || f.id !== id || !this.Z.frage) return false;
    const s = f.sp >= 0 ? this.Z.spieler[f.sp] : null;
    if (vonSlot != null && (!s || s.art !== 'netz' || s.slot !== vonSlot)) return false;
    if (!this.gueltig(this.Z.frage, wert)) return false;
    f.fertig(wert);
    return true;
  },
  gueltig(fr, w) {
    if (fr.typ === 'info' || fr.typ === 'wuerfel') return true;
    if (fr.optionen) return fr.optionen.some(o => o.w === w && !o.aus);
    return false;
  },

  // ---------- Hauptablauf ----------
  async starten() {
    this.laeuft = true;
    try {
      await this.einleitung();
      const Z = this.Z;
      while (Z.runde <= Z.runden) {
        if (Z.runde === Z.runden - 4 && Z.runden >= 10) await this.letzteFuenf();
        Z.phase = 'brett';
        await this.rundenBanner();
        for (Z.zug = 0; Z.zug < 4; Z.zug++) await this.zug(Z.reihenfolge[Z.zug]);
        Z.aktiv = -1;
        await this.minispielRunde();
        Z.runde++;
      }
      Z.runde = Z.runden;
      await this.finale();
    } catch (e) {
      if (e.message !== 'abbruch') { console.error(e); throw e; }
    } finally { this.laeuft = false; }
  },
  beenden() {
    this.abbruch = true;
    if (this.offeneFrage) this.offeneFrage.fertig(null);
    Uhr.abbrechen();
    this.lauf = null;
  },
  async einleitung() {
    const Z = this.Z;
    Z.phase = 'brett'; Z.kamera = { art: 'alle' };
    await this.warte(900);
    await this.sagen('stella', 'Willkommen auf der Sternen-Insel!', `Ich bin Stella. Wer nach ${Z.runden} Runden die meisten Sterne hat, gewinnt. Sterne kosten ${STERN_PREIS} Münzen.`, 4200, -1);
    // Reihenfolge auswürfeln: jeder schlägt einen Würfel (Zahlen kommen nie doppelt vor)
    await this.sagen('stella', 'Wer fängt an?', 'Schlagt den Würfel! Die höchste Zahl beginnt.', 2400, -1);
    const zahlen = mischen([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4);
    const wurf = [];
    for (let i = 0; i < 4; i++) {
      Z.aktiv = i; Z.kamera = { art: 'sp', i };
      Z.wuerfel = { sp: i, n: 1, werte: [], rollt: true };
      await this.frage(i, 'wuerfel', { titel: 'Würfel schlagen' });
      Z.wuerfel.werte = [zahlen[i]]; Z.wuerfel.rollt = false;
      Ton.spiel('treffer');
      this.fx('wurf', { sp: i, wert: zahlen[i] });
      this.aktualisiere();
      await this.warte(900);
      wurf.push(zahlen[i]);
      Z.wuerfel = null;
    }
    Z.reihenfolge = [0, 1, 2, 3].sort((a, b) => wurf[b] - wurf[a]);
    Z.aktiv = -1; Z.kamera = { art: 'alle' };
    this.aktualisiere();
    await this.sagen('stella', 'Die Reihenfolge steht!', Z.reihenfolge.map((i, k) => `${k + 1}. ${Z.spieler[i].name}`).join('   '), 3000, -1);
    for (let i = 0; i < 4; i++) this.muenzen(i, 10, 'start');
    this.aktualisiere();
    await this.sagen('stella', 'Startgeld!', 'Jeder bekommt 10 Münzen. Und jetzt verstecke ich den ersten Stern …', 2600, -1);
    await this.sternVersetzen(true);
  },
  async rundenBanner() {
    const Z = this.Z;
    Z.kamera = { art: 'alle' };
    this.fx('runde', { runde: Z.runde, runden: Z.runden });
    this.aktualisiere();
    await this.warte(1500);
  },
  async letzteFuenf() {
    const Z = this.Z;
    Z.letzte5 = true; Z.kamera = { art: 'alle' };
    this.fx('letzte5');
    this.aktualisiere();
    await this.warte(1200);
    await this.sagen('stella', 'Die letzten 5 Runden!', 'Ab jetzt zählen blaue und rote Felder doppelt: +6 und −6 Münzen!', 3600, -1);
    const rang = this.rangliste();
    const letzter = rang[rang.length - 1].i;
    await this.sagen('stella', 'Aufholjagd!', `${Z.spieler[letzter].name} liegt hinten und bekommt 10 Münzen geschenkt.`, 3000, -1);
    this.muenzen(letzter, 10, 'geschenk');
    this.aktualisiere();
    await this.warte(900);
  },

  // ---------- Ein Zug ----------
  async zug(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    Z.aktiv = sp; Z.kamera = { art: 'sp', i: sp }; Z.schritte = 0;
    this.fx('dran', { sp });
    this.aktualisiere();
    await this.warte(700);
    let anzahl = 1, extra = 0, wunsch = 0;
    // Würfeln oder Item benutzen
    for (;;) {
      const opts = [{ w: 'wuerfeln', t: 'Würfeln' }, { w: 'item', t: 'Item benutzen', aus: !s.items.length }, { w: 'karte', t: 'Brett ansehen' }];
      const w = await this.frage(sp, 'zug', { titel: `${s.name} ist dran`, optionen: opts });
      if (w === 'karte') { Z.kamera = { art: 'alle' }; await this.frage(sp, 'info', { titel: 'Brett', text: 'Sieh dir das Brett an.', zeit: 2600 }); Z.kamera = { art: 'sp', i: sp }; continue; }
      if (w !== 'item') break;
      const it = await this.frage(sp, 'item', {
        titel: 'Welches Item?', optionen: s.items.map(id => ({ w: id, t: ITEMS[id].name, sub: ITEMS[id].text })).concat([{ w: 'zurueck', t: 'Zurück' }]),
      });
      if (it === 'zurueck') continue;
      s.items.splice(s.items.indexOf(it), 1);
      this.fx('item', { sp, item: it });
      Ton.spiel('item');
      this.aktualisiere();
      await this.warte(700);
      if (it === 'doppel') anzahl = 2;
      else if (it === 'dreifach') anzahl = 3;
      else if (it === 'turbo') extra = 3;
      else if (it === 'wunsch') {
        wunsch = await this.frage(sp, 'wunsch', { titel: 'Wunschwürfel', optionen: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ w: n, t: String(n), sub: this.wunschHinweis(sp, n) })) });
      } else if (it === 'kompass') {
        await this.kompass(sp);
      } else if (it === 'glocke') {
        await this.gusti(sp, true);
      }
      break;
    }
    // Würfel schlagen
    let werte;
    Z.wuerfel = { sp, n: anzahl, werte: [], rollt: true, wunsch: !!wunsch };
    if (wunsch) werte = [wunsch];
    else {
      werte = [];
      for (let k = 0; k < anzahl; k++) {
        Z.wuerfel.idx = k;
        await this.frage(sp, 'wuerfel', { titel: anzahl > 1 ? `Würfel ${k + 1} von ${anzahl}` : 'Würfel schlagen' });
        werte.push(rndi(1, 10));
        Z.wuerfel.werte = werte.slice();
        Ton.spiel('treffer');
        this.aktualisiere();
        await this.warte(450);
      }
    }
    Z.wuerfel.rollt = false; Z.wuerfel.werte = werte;
    let summe = werte.reduce((a, b) => a + b, 0) + extra;
    this.fx('wurf', { sp, wert: summe, werte, extra });
    this.aktualisiere();
    await this.warte(900);
    // Pasch-Bonus wie beim Original
    if (anzahl === 2 && werte[0] === werte[1]) { await this.warte(300); this.muenzen(sp, 10, 'pasch'); this.fx('text', { sp, text: 'Pasch!' }); this.aktualisiere(); await this.warte(900); }
    if (anzahl === 3 && werte[0] === werte[1] && werte[1] === werte[2]) { const b = werte[0] === 7 ? 50 : 30; this.muenzen(sp, b, 'pasch'); this.fx('text', { sp, text: 'Drilling!' }); this.aktualisiere(); await this.warte(1100); }
    Z.wuerfel = null;
    // Laufen
    await this.laufen(sp, summe);
    // Landen
    await this.landen(sp);
    Z.schritte = 0;
    this.aktualisiere();
    await this.warte(500);
  },
  wunschHinweis(sp, n) {
    const Z = this.Z;
    const bis = schritteBis(this.brett, Z.spieler[sp].feld, Z.sternFeld, Z.sternFeld);
    return bis === n ? 'genau bis zum Stern' : n > bis ? 'am Stern vorbei' : '';
  },
  async laufen(sp, schritte) {
    const Z = this.Z, s = Z.spieler[sp];
    Z.schritte = schritte;
    this.aktualisiere();
    while (Z.schritte > 0) {
      const f = this.brett.felder[s.feld];
      let ziel = f.weiter[0];
      if (f.weiter.length > 1) {
        ziel = await this.frage(sp, 'weg', {
          titel: 'Welcher Weg?', feld: f.i,
          optionen: f.weiter.map(w => ({ w, t: this.brett.felder[w].weg === f.weg ? 'Weiter auf dem ' + f.weg : this.brett.felder[w].weg, sub: this.wegHinweis(w) })),
        });
      }
      s.feld = ziel;
      this.fx('schritt', { sp, von: f.i, nach: ziel });
      this.aktualisiere();
      await this.warte(300);
      if (istStation(this.brett, ziel, Z.sternFeld)) { await this.station(sp, ziel); continue; }
      Z.schritte--;
      this.aktualisiere();
      // Vorbei an der Bank: 5 Münzen einzahlen
      if (Z.schritte > 0 && this.brett.felder[ziel].typ === 'K' && s.muenzen > 0) {
        const b = -this.muenzen(sp, -5, 'bank');
        Z.bank += b;
        this.fx('text', { sp, text: 'Bank +' + b });
        this.aktualisiere();
        await this.warte(700);
      }
    }
  },
  wegHinweis(w) {
    const d = schritteBis(this.brett, w, this.Z.sternFeld, this.Z.sternFeld);
    return isFinite(d) ? `Stern in ${d + 1} Feldern` : '';
  },
  // Stationen: Stern, Laden, Gusti
  async station(sp, i) {
    const Z = this.Z, s = Z.spieler[sp], typ = this.brett.felder[i].typ;
    if (i === Z.sternFeld) {
      Z.kamera = { art: 'sp', i: sp };
      if (s.muenzen >= STERN_PREIS) {
        Z.meldung = { id: ++this.meldNr, wer: 'stella', titel: 'Ein Stern!', text: `Möchtest du einen Stern für ${STERN_PREIS} Münzen kaufen?` };
        const w = await this.frage(sp, 'janein', { titel: `Stern für ${STERN_PREIS} Münzen kaufen?`, optionen: [{ w: 'ja', t: 'Ja, kaufen!' }, { w: 'nein', t: 'Nein danke' }] });
        Z.meldung = null;
        if (w === 'ja') {
          this.muenzen(sp, -STERN_PREIS, 'stern');
          this.sterne(sp, 1);
          Ton.spiel('stern');
          this.fx('sternKauf', { sp });
          this.aktualisiere();
          await this.warte(2200);
          await this.sagen('stella', 'Glückwunsch!', `${s.name} hat jetzt ${s.sterne} ${s.sterne === 1 ? 'Stern' : 'Sterne'}. Ich fliege zu einem neuen Platz …`, 2400);
          await this.sternVersetzen();
          Z.kamera = { art: 'sp', i: sp };
        }
      } else {
        await this.sagen('stella', 'Schade!', `Für einen Stern brauchst du ${STERN_PREIS} Münzen. Du hast erst ${s.muenzen}.`, 2400);
      }
    } else if (typ === 'L') await this.laden(sp);
    else if (typ === 'S') await this.gusti(sp, false);
    this.aktualisiere();
  },
  async sternVersetzen(erstes = false) {
    const Z = this.Z;
    const besetzt = new Set(Z.spieler.map(s => s.feld));
    let plaetze = this.brett.sternPlaetze.filter(i => i !== Z.sternFeld && !besetzt.has(i));
    if (!plaetze.length) plaetze = this.brett.sternPlaetze.filter(i => i !== Z.sternFeld);
    Z.sternWeg = Z.sternFeld;
    Z.sternFeld = wahl(plaetze);
    Z.kamera = { art: 'feld', i: Z.sternFeld };
    this.fx('sternNeu', { feld: Z.sternFeld });
    this.aktualisiere();
    await this.warte(erstes ? 2400 : 2000);
  },
  async laden(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    if (s.items.length >= MAX_ITEMS) { await this.sagen('laden', 'Laden', 'Deine Taschen sind voll (3 Items).', 1800); return; }
    const opts = Object.entries(ITEMS).map(([id, it]) => ({ w: id, t: it.name, sub: it.text, preis: it.preis, aus: it.preis > s.muenzen }));
    opts.push({ w: 'nichts', t: 'Nichts kaufen' });
    Z.meldung = { id: ++this.meldNr, wer: 'laden', titel: 'Willkommen im Laden!', text: 'Was darf es sein?' };
    const w = await this.frage(sp, 'laden', { titel: 'Laden', optionen: opts });
    Z.meldung = null;
    if (w && w !== 'nichts') {
      this.muenzen(sp, -ITEMS[w].preis, 'laden');
      s.items.push(w);
      Ton.spiel('item');
      this.fx('itemNeu', { sp, item: w });
      this.aktualisiere();
      await this.warte(1000);
    }
  },
  async gusti(sp, glocke) {
    const Z = this.Z, s = Z.spieler[sp];
    const andere = [0, 1, 2, 3].filter(i => i !== sp);
    const opts = [
      { w: 'muenzen', t: 'Münzen stehlen', sub: glocke ? 'gratis mit der Glocke' : 'kostet 5 Münzen', aus: !glocke && s.muenzen < 5 },
      { w: 'stern', t: 'Stern stehlen', sub: glocke ? 'kostet 30 Münzen' : 'kostet 50 Münzen', aus: s.muenzen < (glocke ? 30 : 50) || !andere.some(i => Z.spieler[i].sterne > 0) },
      { w: 'nichts', t: 'Nichts tun' },
    ];
    Z.meldung = { id: ++this.meldNr, wer: 'gusti', titel: 'Huhu, ich bin Gusti!', text: 'Soll ich für dich etwas stehlen? Hihihi …' };
    const w = await this.frage(sp, 'gusti', { titel: 'Gusti das Gespenst', optionen: opts });
    Z.meldung = null;
    if (!w || w === 'nichts') { this.aktualisiere(); return; }
    const ziele = andere.map(i => ({ w: i, t: Z.spieler[i].name, sub: `${Z.spieler[i].sterne} ★  ${Z.spieler[i].muenzen} Münzen`, aus: w === 'stern' ? Z.spieler[i].sterne < 1 : Z.spieler[i].muenzen < 1 }));
    if (!ziele.some(z => !z.aus)) { await this.sagen('gusti', 'Oh nein …', 'Bei niemandem gibt es etwas zu holen.', 1800); return; }
    const ziel = await this.frage(sp, 'spieler', { titel: 'Bei wem?', optionen: ziele });
    Z.kamera = { art: 'sp', i: ziel };
    Ton.spiel('weg');
    this.fx('gusti', { sp: ziel });
    this.aktualisiere();
    await this.warte(1400);
    if (w === 'stern') {
      this.muenzen(sp, glocke ? -30 : -50, 'gusti');
      this.sterne(ziel, -1); this.sterne(sp, 1);
      Ton.spiel('stern');
      await this.sagen('gusti', 'Hihihi!', `Gusti hat ${Z.spieler[ziel].name} einen Stern geklaut!`, 2400);
    } else {
      if (!glocke) this.muenzen(sp, -5, 'gusti');
      const n = Math.min(Z.spieler[ziel].muenzen, rndi(5, 15));
      this.muenzen(ziel, -n, 'gusti'); this.muenzen(sp, n, 'gusti');
      await this.sagen('gusti', 'Hihihi!', `Gusti hat ${n} Münzen von ${Z.spieler[ziel].name} geholt.`, 2400);
    }
    Z.kamera = { art: 'sp', i: sp };
    this.aktualisiere();
  },
  async kompass(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    // Feld direkt vor dem Stern (Stationen überspringen)
    let vor = this.brett.felder[Z.sternFeld].zurueck[0];
    while (FELD_INFO[this.brett.felder[vor].typ].station) vor = this.brett.felder[vor].zurueck[0];
    this.fx('teleport', { sp, von: s.feld, nach: vor });
    s.feld = vor;
    this.aktualisiere();
    await this.warte(1300);
  },

  // ---------- Feldwirkungen ----------
  async landen(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    const f = this.brett.felder[s.feld];
    const info = FELD_INFO[f.typ];
    s.farbe = info.team;
    this.fx('landen', { sp, feld: f.i });
    const doppelt = Z.letzte5 ? 2 : 1;
    switch (f.typ) {
      case 'A': case 'B': this.muenzen(sp, 3 * doppelt, 'blau'); Ton.spiel('muenze'); break;
      case 'R': this.muenzen(sp, -3 * doppelt, 'rot'); Ton.spiel('verlust'); break;
      case 'G': await this.glueck(sp); break;
      case '?': s.stat.ereignisse++; await this.ereignis(sp, f); break;
      case 'X': await this.grimm(sp); break;
      case 'I': await this.itemFeld(sp); break;
      case 'D': await this.duell(sp); break;
      case 'K': {
        if (Z.bank > 0) {
          const b = Z.bank; Z.bank = 0;
          await this.sagen('bank', 'Volltreffer in der Bank!', `${s.name} bekommt alle ${b} Münzen aus der Bank.`, 2200);
          this.muenzen(sp, b, 'bank');
        } else await this.sagen('bank', 'Die Bank ist leer', 'Wer vorbeiläuft, zahlt 5 Münzen ein. Wer genau hier landet, bekommt alles.', 2400);
        break;
      }
    }
    this.aktualisiere();
    await this.warte(700);
  },
  async glueck(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    Ton.spiel('glueck');
    const r = Math.random();
    if (r < .4) {
      const n = rndi(5, 10);
      await this.sagen('stella', 'Glücksfeld!', `Stella schenkt dir ${n} Münzen.`, 2000);
      this.muenzen(sp, n, 'glueck');
    } else if (r < .7 && s.items.length < MAX_ITEMS) {
      const it = wahl(['doppel', 'dreifach', 'wunsch', 'turbo', 'glocke']);
      await this.sagen('stella', 'Glücksfeld!', `Du bekommst gratis: ${ITEMS[it].name}!`, 2000);
      s.items.push(it); this.fx('itemNeu', { sp, item: it });
    } else {
      await this.sagen('stella', 'Glücksfeld!', 'Alle anderen geben dir je 3 Münzen!', 2200);
      for (let i = 0; i < 4; i++) if (i !== sp) { const n = -this.muenzen(i, -3, 'glueck'); this.muenzen(sp, n, 'glueck'); }
    }
    this.aktualisiere();
  },
  async ereignis(sp, f) {
    const Z = this.Z, s = Z.spieler[sp];
    const geeignet = () => this.brett.felder.filter(x => !FELD_INFO[x.typ].station && x.i !== Z.sternFeld && x.typ !== '?');
    switch (f.ereignis) {
      case 'seilbahn': {
        await this.sagen('stella', 'Die Seilbahn!', 'Eine Seilbahn bringt dich ans andere Ende der Insel.', 2200);
        const weit = geeignet().filter(x => dist(x.x, x.y, f.x, f.y) > 1300 && x.typ === 'B');
        const ziel = wahl(weit.length ? weit : geeignet());
        this.fx('teleport', { sp, von: s.feld, nach: ziel.i, art: 'seilbahn' });
        s.feld = ziel.i; Z.kamera = { art: 'sp', i: sp };
        break;
      }
      case 'strudel': {
        await this.sagen('stella', 'Ein Strudel!', 'Eine Riesenwelle spült dich irgendwohin …', 2200);
        const ziel = wahl(geeignet());
        this.fx('teleport', { sp, von: s.feld, nach: ziel.i, art: 'strudel' });
        s.feld = ziel.i;
        break;
      }
      case 'tausch': {
        const andere = [0, 1, 2, 3].filter(i => i !== sp);
        const o = wahl(andere);
        await this.sagen('stella', 'Platztausch!', `Du tauschst den Platz mit ${Z.spieler[o].name}!`, 2200);
        const a = s.feld, b = Z.spieler[o].feld;
        this.fx('teleport', { sp, von: a, nach: b }); this.fx('teleport', { sp: o, von: b, nach: a });
        s.feld = b; Z.spieler[o].feld = a;
        break;
      }
      case 'sternwechsel': {
        await this.sagen('stella', 'Sternen-Umzug!', 'Ups, der Stern zieht an einen anderen Platz um.', 2200);
        await this.sternVersetzen();
        break;
      }
      case 'kokos': {
        await this.sagen('stella', 'Kokosnuss-Ernte!', 'Die Palmen schütteln: Du bekommst 2 Münzen pro Mitspieler, alle anderen verlieren 2.', 2400);
        for (let i = 0; i < 4; i++) if (i !== sp) { const n = -this.muenzen(i, -2, 'kokos'); this.muenzen(sp, n, 'kokos'); }
        break;
      }
    }
    this.aktualisiere();
    await this.warte(1300);
    Z.kamera = { art: 'sp', i: sp };
  },
  async grimm(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    Ton.spiel('boese');
    this.fx('grimm', { sp });
    Z.meldung = { id: ++this.meldNr, wer: 'grimm', titel: 'Bwahaha!', text: 'Ich bin Graf Grimm! Mal sehen, was ich dir heute antue …' };
    this.aktualisiere();
    await this.warte(2200);
    let moegliche = GRIMM_TATEN.filter(t => t.id !== 'sternraub' || (s.sterne > 0 && Math.random() < .35));
    if (s.muenzen === 0) moegliche = moegliche.filter(t => t.id === 'revolution' || t.id === 'sternraub' || t.id === 'alle');
    const tat = wahl(moegliche);
    Z.roulette = { art: 'grimm', liste: GRIMM_TATEN.map(t => t.titel), ziel: GRIMM_TATEN.indexOf(tat), id: ++this.meldNr };
    this.aktualisiere();
    await this.warte(2600);
    Z.roulette = null;
    Z.meldung = { id: ++this.meldNr, wer: 'grimm', titel: tat.titel, text: tat.text };
    this.aktualisiere();
    await this.warte(1500);
    switch (tat.id) {
      case 'steuer': this.muenzen(sp, -10, 'grimm'); break;
      case 'halb': this.muenzen(sp, -Math.ceil(s.muenzen / 2), 'grimm'); break;
      case 'revolution': {
        const summe = Z.spieler.reduce((a, x) => a + x.muenzen, 0), je = Math.floor(summe / 4);
        Z.spieler.forEach((x, i) => this.muenzen(i, je - x.muenzen, 'grimm'));
        break;
      }
      case 'alle': for (let i = 0; i < 4; i++) this.muenzen(i, -5, 'grimm'); break;
      case 'sternraub': this.sterne(sp, -1); break;
    }
    Ton.spiel('verlust');
    this.aktualisiere();
    await this.frage(sp, 'info', { titel: tat.titel, text: tat.text, zeit: 2200 });
    Z.meldung = null;
  },
  async itemFeld(sp) {
    const s = this.Z.spieler[sp];
    if (s.items.length >= MAX_ITEMS) { await this.sagen('stella', 'Item-Feld', 'Deine Taschen sind schon voll.', 1800); return; }
    const it = wahl(['doppel', 'doppel', 'dreifach', 'wunsch', 'turbo', 'turbo', 'kompass', 'glocke']);
    s.items.push(it);
    Ton.spiel('item');
    this.fx('itemNeu', { sp, item: it });
    await this.sagen('stella', 'Item-Feld!', `Du findest: ${ITEMS[it].name}. ${ITEMS[it].text}`, 2400);
  },
  async duell(sp) {
    const Z = this.Z, s = Z.spieler[sp];
    Ton.spiel('tusch');
    const gegnerOpts = [0, 1, 2, 3].filter(i => i !== sp).map(i => ({ w: i, t: Z.spieler[i].name, sub: `${Z.spieler[i].sterne} ★  ${Z.spieler[i].muenzen} Münzen` }));
    Z.meldung = { id: ++this.meldNr, wer: 'stella', titel: 'Duell!', text: 'Fordere einen Gegner heraus. Wer gewinnt, holt sich den Einsatz.' };
    const g = await this.frage(sp, 'spieler', { titel: 'Wen forderst du heraus?', optionen: gegnerOpts });
    const max = Math.min(s.muenzen, Z.spieler[g].muenzen);
    const einsatzOpts = [5, 10, 20].map(n => ({ w: n, t: n + ' Münzen', aus: n > max })).concat([{ w: 0, t: 'Nur um die Ehre', aus: false }]);
    const einsatz = await this.frage(sp, 'einsatz', { titel: 'Einsatz?', optionen: einsatzOpts });
    Z.meldung = null;
    const pool = Minis.pool('duell', Z.modus === 'online' || Z.zeiger);
    const def = wahl(pool);
    const erg = await this.minispiel(def.id, [sp, g], 'duell', [0, 1], -1);
    Z.phase = 'brett'; Z.kamera = { art: 'sp', i: sp };
    this.aktualisiere();
    await this.warte(600);
    if (erg.gewinner.length === 1) {
      const sieger = erg.gewinner[0], verlierer = sieger === sp ? g : sp;
      const n = -this.muenzen(verlierer, -einsatz, 'duell');
      this.muenzen(sieger, n, 'duell');
      await this.sagen('stella', 'Duell entschieden!', `${Z.spieler[sieger].name} gewinnt${n ? ` und bekommt ${n} Münzen` : ''}!`, 2600);
    } else await this.sagen('stella', 'Unentschieden!', 'Niemand gewinnt das Duell.', 2000);
  },

  // ---------- Minispiele ----------
  async minispielRunde() {
    const Z = this.Z;
    Z.kamera = { art: 'alle' };
    // Grüne Felder werden zufällig blau oder rot
    const farben = Z.spieler.map(s => s.farbe === 'blau' || s.farbe === 'rot' ? s.farbe : null);
    Z.phase = 'teams';
    Z.teams = { farben: farben.slice(), fertig: false };
    this.aktualisiere();
    await this.warte(1400);
    for (let i = 0; i < 4; i++) {
      if (farben[i]) continue;
      farben[i] = Math.random() < .5 ? 'blau' : 'rot';
      Z.teams.farben = farben.slice();
      Ton.spiel('klick');
      this.aktualisiere();
      await this.warte(650);
    }
    const blau = [0, 1, 2, 3].filter(i => farben[i] === 'blau');
    let format, teams, solo = -1;
    if (blau.length === 0 || blau.length === 4) { format = 'ffa'; teams = [0, 1, 2, 3]; }
    else if (blau.length === 2) { format = '2v2'; teams = farben.map(f => f === 'blau' ? 0 : 1); }
    else {
      format = '1v3';
      const einzel = blau.length === 1 ? 'blau' : 'rot';
      solo = farben.indexOf(einzel);
      teams = farben.map(f => f === einzel ? 0 : 1);
    }
    Z.teams.format = format; Z.teams.fertig = true;
    this.aktualisiere();
    await this.warte(1800);
    // Roulette über den passenden Pool
    const pool = Minis.pool(format, Z.modus === 'online' || Z.zeiger);
    this.zuletzt = this.zuletzt || [];
    let auswahl = pool.filter(d => !this.zuletzt.includes(d.id));
    if (!auswahl.length) auswahl = pool;
    const def = wahl(auswahl);
    this.zuletzt.push(def.id); if (this.zuletzt.length > Math.max(1, Math.floor(pool.length / 2))) this.zuletzt.shift();
    Z.phase = 'roulette';
    Z.roulette = { art: 'mini', liste: pool.map(d => d.name), ziel: pool.indexOf(def), id: ++this.meldNr, format };
    this.aktualisiere();
    await this.warte(3600);
    Z.roulette = null;
    const erg = await this.minispiel(def.id, [0, 1, 2, 3], format, teams, solo);
    // Belohnung: 10 Münzen für jeden Gewinner
    Z.phase = 'mini-ergebnis';
    for (const k of erg.gewinner) { this.muenzen(k, 10, 'mini'); Z.spieler[k].stat.miniMuenzen += 10; }
    this.aktualisiere();
    await this.frage(-1, 'info', { zeit: 3800 });
    Z.mini = null; Z.teams = null;
    Z.phase = 'brett';
    for (const s of Z.spieler) s.farbe = null;
    this.aktualisiere();
  },
  // Startet ein Minispiel und gibt { gewinner: [Spieler-Indizes], ... } zurück
  async minispiel(id, teilnehmer, format, teams, solo) {
    const Z = this.Z;
    const def = Minis.finde(id);
    Z.mini = { id, format, teilnehmer, teams, solo: solo >= 0 ? teilnehmer.indexOf(solo) : -1, bereit: teilnehmer.map(p => Z.spieler[p].art === 'bot'), ergebnis: null };
    Z.phase = 'mini-intro';
    this.aktualisiere();
    // Warten, bis alle Menschen bereit sind (online: höchstens 40 s)
    const start = Uhr.zeit;
    while (!Z.mini.bereit.every(b => b)) {
      await this.warte(100);
      if (Z.modus === 'online' && Uhr.zeit - start > 40) Z.mini.bereit = Z.mini.bereit.map(() => true);
    }
    Z.phase = 'mini';
    this.aktualisiere();
    this.lauf = new MiniLauf(def, this.miniInfo(), 'host');
    while (!this.lauf.fertig) await this.warte(100);
    const e = this.lauf.ergebnis;
    const erg = { punkte: e.punkte, platz: e.platz, gewinner: e.gewinner.map(k => teilnehmer[k]) };
    Z.mini.ergebnis = erg;
    this.lauf = null;
    Z.phase = 'mini-ergebnis';
    this.aktualisiere();
    if (format === 'duell') await this.frage(-1, 'info', { zeit: 3200 });
    return erg;
  },
  // Infos für den Minispiel-Rahmen aus Sicht dieses Rechners
  miniInfo() {
    const Z = this.Z, m = Z.mini;
    return {
      teilnehmer: m.teilnehmer, teams: m.teams, format: m.format, solo: m.solo,
      figuren: m.teilnehmer.map(p => Z.spieler[p].figur), namen: m.teilnehmer.map(p => Z.spieler[p].name),
      farben: m.teilnehmer.map(p => PLATZ_FARBEN[p]),
      stufen: m.teilnehmer.map(p => Z.spieler[p].stufe),
      quellen: m.teilnehmer.map(p => {
        const s = Z.spieler[p];
        if (s.art === 'bot') return { art: 'bot' };
        // Gegen Computer: ein Mensch mit allen Tasten und dem Touchpad
        if (Z.modus === 'lokal') return Z.zeiger ? { art: 'selbst' } : { art: 'block', block: s.block };
        return s.slot === Netz.you ? { art: 'selbst' } : { art: 'netz', slot: s.slot };
      }),
      ich: Z.modus === 'online' ? m.teilnehmer.findIndex(p => Z.spieler[p].art !== 'bot' && Z.spieler[p].slot === Netz.you)
        : Z.zeiger ? m.teilnehmer.findIndex(p => Z.spieler[p].art === 'mensch') : -1,
    };
  },
  bereit(sp) {
    const m = this.Z.mini;
    if (!m || this.Z.phase !== 'mini-intro') return;
    const k = m.teilnehmer.indexOf(sp);
    if (k >= 0 && !m.bereit[k]) { m.bereit[k] = true; Ton.spiel('klick'); this.aktualisiere(); }
  },

  // ---------- Finale ----------
  rangliste() {
    const Z = this.Z;
    const liste = Z.spieler.map((s, i) => ({ i, sterne: s.sterne, muenzen: s.muenzen }));
    liste.sort((a, b) => b.sterne - a.sterne || b.muenzen - a.muenzen);
    let platz = 1;
    liste.forEach((e, k) => { if (k && (e.sterne !== liste[k - 1].sterne || e.muenzen !== liste[k - 1].muenzen)) platz = k + 1; e.platz = platz; });
    return liste;
  },
  async finale() {
    const Z = this.Z;
    Z.phase = 'brett'; Z.aktiv = -1; Z.kamera = { art: 'alle' };
    this.aktualisiere();
    await this.sagen('stella', 'Das war die letzte Runde!', 'Jetzt wird es spannend: Ich verteile noch die Bonus-Sterne …', 3200, -1);
    if (Z.bonus) {
      const boni = [
        { titel: 'Minispiel-Stern', text: 'für die meisten Münzen aus Minispielen', wert: s => s.stat.miniMuenzen },
        { titel: 'Münzen-Stern', text: 'für die meisten Münzen auf einmal', wert: s => s.stat.maxMuenzen },
        { titel: 'Ereignis-Stern', text: 'für die meisten ?-Felder', wert: s => s.stat.ereignisse },
      ];
      for (const b of boni) {
        const max = Math.max(...Z.spieler.map(b.wert));
        const sieger = [0, 1, 2, 3].filter(i => b.wert(Z.spieler[i]) === max);
        if (max <= 0) { await this.sagen('stella', b.titel, 'Diesen Stern hat sich niemand verdient.', 2400, -1); continue; }
        await this.sagen('stella', b.titel, `Der ${b.titel} ${b.text} geht an … `, 2600, -1);
        for (const i of sieger) { this.sterne(i, 1); Z.kamera = { art: 'sp', i }; }
        Ton.spiel('stern');
        await this.sagen('stella', b.titel, sieger.map(i => Z.spieler[i].name).join(' und ') + '!', 2600, -1);
      }
    }
    const rang = this.rangliste();
    Z.ende = { rang };
    Z.phase = 'ende';
    Z.kamera = { art: 'alle' };
    Ton.spiel('fanfare');
    this.aktualisiere();
    if (Z.modus === 'online') Netz.ergebnisMelden(rang);
    if (window.LW) LW.rundeFertig();
  },
};

// ---------- Computer-Entscheidungen auf dem Brett ----------
const KI = {
  entscheide(sp, typ, fr) {
    const Z = Spiel.Z, s = Z.spieler[sp], st = s.stufe;
    const brett = Spiel.brett;
    const bisStern = feld => schritteBis(brett, feld, Z.sternFeld, Z.sternFeld);
    const frei = (fr.optionen || []).filter(o => !o.aus);
    const erste = w => frei.some(o => o.w === w) ? w : (frei[0] && frei[0].w);
    switch (typ) {
      case 'zug': {
        if (!s.items.length || (st === 0 && Math.random() < .5)) return 'wuerfeln';
        return this.itemWahl(sp) ? 'item' : 'wuerfeln';
      }
      case 'item': return this.itemWahl(sp) || 'zurueck';
      case 'wunsch': {
        const d = bisStern(s.feld);
        if (d >= 1 && d <= 10 && s.muenzen >= STERN_PREIS) return d;
        return st === 0 ? rndi(5, 10) : 10;
      }
      case 'weg': {
        if (st === 0 && Math.random() < .45) return wahl(frei).w;
        let best = frei[0].w, bd = Infinity;
        for (const o of frei) { const d = bisStern(o.w); if (d < bd) { bd = d; best = o.w; } }
        // Wer wenig Münzen hat, meidet den gefährlichen Weg eher
        return best;
      }
      case 'janein': return s.muenzen >= STERN_PREIS ? 'ja' : 'nein';
      case 'laden': {
        const reserve = st === 2 ? STERN_PREIS : 8;
        const prio = st === 0 ? ['turbo', 'doppel', 'glocke'] : ['kompass', 'dreifach', 'doppel', 'glocke', 'turbo'];
        for (const id of prio) {
          const o = frei.find(x => x.w === id);
          if (o && s.muenzen - ITEMS[id].preis >= reserve * (id === 'kompass' ? 1 : .6)) return id;
        }
        return 'nichts';
      }
      case 'gusti': {
        if (frei.some(o => o.w === 'stern')) return 'stern';
        if (frei.some(o => o.w === 'muenzen') && (fr.optionen[0].sub.includes('gratis') || s.muenzen >= 12) && Math.random() < [.4, .7, .9][st]) return 'muenzen';
        return 'nichts';
      }
      case 'spieler': {
        // Den Führenden angreifen
        let best = frei[0].w, bw = -1;
        for (const o of frei) { const x = Z.spieler[o.w]; const w = x.sterne * 100 + x.muenzen + (st === 0 ? Math.random() * 60 : 0); if (w > bw) { bw = w; best = o.w; } }
        return best;
      }
      case 'einsatz': return erste(st === 2 ? 10 : 5) ?? 0;
      default: return frei.length ? frei[0].w : true;
    }
  },
  itemWahl(sp) {
    const Z = Spiel.Z, s = Z.spieler[sp];
    const d = schritteBis(Spiel.brett, s.feld, Z.sternFeld, Z.sternFeld);
    const genug = s.muenzen >= STERN_PREIS;
    const hat = id => s.items.includes(id);
    if (hat('kompass') && genug && d > 6) return 'kompass';
    if (hat('wunsch') && genug && d <= 10) return 'wunsch';
    if (hat('dreifach') && genug && d > 8 && d <= 30) return 'dreifach';
    if (hat('doppel') && genug && d > 5 && d <= 20) return 'doppel';
    if (hat('glocke') && s.muenzen >= 30 && Z.spieler.some((x, i) => i !== sp && x.sterne > 0)) return 'glocke';
    if (hat('turbo') && d > 3 && d <= 13) return 'turbo';
    if (s.items.length >= MAX_ITEMS) return s.items.find(id => id !== 'kompass' && id !== 'glocke') || null;
    return null;
  },
};
