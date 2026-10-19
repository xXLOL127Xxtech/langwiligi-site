// Golf-Tour – Online über GameHub: Raum mit Code, Lobby, gleichzeitiges Spielen mit Geister-Bällen
// Jeder rechnet seinen eigenen Ball. Der Gastgeber (kleinster belegter Platz) entscheidet, wann es zur nächsten Bahn geht.
'use strict';

const Netz = {
  room: null, you: -1, code: null, liste: [], imSpiel: false, weiterGesendet: -1, boardEl: null,
  zeigen() {
    $('oName').value = HUB ? HUB.getName() : '';
    $('oFehler').textContent = '';
    if (HUB) HUB.loadBoard(GAME_ID, $('oBoard'), HUB.getName());
    $('oErstellen').onclick = () => this.erstellen();
    $('oBeitreten').onclick = () => this.beitreten();
    setTimeout(() => (($('oCode').value ? $('oName') : $('oErstellen'))).focus(), 50);
  },
  name() {
    const n = $('oName').value.trim().slice(0, 16);
    if (!n) { $('oFehler').textContent = 'Bitte gib zuerst einen Namen ein.'; $('oName').focus(); return null; }
    HUB.setName(n);
    return n;
  },
  verbinden() {
    const room = HUB.connect(GAME_ID);
    room.on('msg', (d, from) => this.nachricht(d, from));
    room.on('peer-join', m => this.beigetreten(m));
    room.on('peer-left', m => this.weg(m));
    room.on('close', () => this.verbindungWeg());
    room.on('leaderboard', rows => { if (this.boardEl) HUB.renderBoard(this.boardEl, rows, HUB.getName()); });
    return room;
  },
  listeAus(players) {
    const out = [];
    (players || []).forEach((p, i) => { if (p) out.push({ idx: i, name: typeof p === 'string' ? p : (p.name || 'Spieler ' + (i + 1)) }); });
    return out;
  },
  async erstellen() {
    const n = this.name(); if (!n) return;
    $('oFehler').textContent = 'Verbinde …';
    try {
      this.room = this.verbinden();
      const info = await this.room.create(n, 8);
      this.you = info.you; this.code = info.code;
      this.liste = this.listeAus(this.room.players);
      if (!this.liste.length) this.liste = [{ idx: this.you, name: n }];
      $('oFehler').textContent = '';
      this.lobby();
    } catch (e) { $('oFehler').textContent = HUB.errorText(e); }
  },
  async beitreten() {
    const n = this.name(); if (!n) return;
    const code = HUB.cleanCode($('oCode').value);
    if (code.length !== 4) { $('oFehler').textContent = 'Der Code hat 4 Zeichen.'; return; }
    $('oFehler').textContent = 'Verbinde …';
    try {
      this.room = this.verbinden();
      await this.room.join(code, n);
      this.you = this.room.you; this.code = this.room.code;
      this.liste = this.listeAus(this.room.players);
      if (!this.liste.some(p => p.idx === this.you)) this.liste.push({ idx: this.you, name: n });
      $('oFehler').textContent = '';
      this.lobby();
      this.sende({ t: 'hallo', name: n });
    } catch (e) { $('oFehler').textContent = HUB.errorText(e); }
  },
  verlassen() {
    if (this.room) { try { this.room.close(); } catch (e) { } }
    this.room = null; this.imSpiel = false;
    App.online = false;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  },
  verbindungWeg() {
    if (!this.room) return;
    this.room = null;
    App.online = false;
    App.zumMenue();
    Menue.zeige('sOnline');
    $('oFehler').textContent = 'Die Verbindung zum Spiel-Server ist abgebrochen.';
  },
  istHost() { const ids = this.liste.map(p => p.idx); return ids.length ? Math.min(...ids) === this.you : true; },
  beigetreten(m) {
    const name = m.name || (m.players && m.players[m.idx] && (m.players[m.idx].name || m.players[m.idx])) || 'Spieler ' + (m.idx + 1);
    if (!this.liste.some(p => p.idx === m.idx)) this.liste.push({ idx: m.idx, name: String(name) });
    this.liste.sort((a, b) => a.idx - b.idx);
    if (this.imSpiel && this.istHost()) this.sende({ t: 'laeuft' });
    this.lobbyListe();
  },
  weg(m) {
    this.liste = this.liste.filter(p => p.idx !== m.idx);
    const g = App.geister.find(g => g.idx === m.idx);
    if (g) { g.weg = true; if (g.grafik) g.grafik.visible = false; if (App.ansichten[0]) App.ansichten[0].anz.meldung(g.name + ' ist weg', '', '#ffb0a0', 2); }
    this.lobbyListe();
    this.pruefen();
  },
  sende(d) { if (this.room) this.room.send(d); },
  // ---------- Lobby ----------
  lobby() {
    App.online = true;
    this.imSpiel = false;
    $('lCode').textContent = this.code;
    $('lKopieren').onclick = () => {
      const url = (GameHub.SEITE + '/' + GAME_ID + '/') + '#' + this.code;
      const fertig = () => { $('lKopieren').textContent = 'Kopiert!'; setTimeout(() => $('lKopieren').textContent = 'Link kopieren', 1500); };
      try { navigator.clipboard.writeText(url).then(fertig, () => { $('lStatus').textContent = url; }); } catch (e) { $('lStatus').textContent = url; }
    };
    $('lVerlassen').onclick = () => { this.verlassen(); Menue.zeige('sTitel'); };
    $('lStart').onclick = () => this.starten();
    this.boardEl = $('lBoard');
    if (HUB) HUB.loadBoard(GAME_ID, this.boardEl, HUB.getName());
    this.lobbyListe();
    Menue.zeige('sLobby');
  },
  lobbyListe() {
    const el = $('lListe'); if (!el) return;
    el.innerHTML = this.liste.map(p => `<div class="lSpieler"><i style="background:${FARBEN[p.idx % 8]}"></i>${esc(p.name)}${p.idx === this.you ? ' <small>(du)</small>' : ''}${p.idx === Math.min(...this.liste.map(q => q.idx)) ? ' <small>· Gastgeber</small>' : ''}</div>`).join('');
    const host = this.istHost();
    $('lStart').classList.toggle('hidden', !host);
    $('lStatus').textContent = host ? (this.liste.length < 2 ? 'Warte auf Mitspieler … (du kannst auch allein starten)' : `${this.liste.length} Spieler bereit.`) : 'Warte, bis der Gastgeber startet …';
  },
  starten() {
    if (!this.istHost()) return;
    const seed = (Math.random() * 1e9) >>> 0;
    const liste = this.liste.slice();
    this.sende({ t: 'start', seed, liste });
    try { this.room.roundStart(); } catch (e) { }
    this.los(seed, liste);
  },
  los(seed, liste) {
    this.imSpiel = true; this.weiterGesendet = -1; this.endeGesendet = false;
    this.liste = liste.slice();
    App.starten('online', { seed, liste, ich: this.you });
  },
  // Gastgeber: Sind alle auf dieser Bahn fertig?
  pruefen() {
    if (!this.imSpiel || !this.istHost() || App.zustand !== 'spiel') return;
    const nr = App.nr;
    const ich = App.spieler[0];
    if (!ich || !ich.fertig) return;
    if (App.geister.some(g => !g.weg && !g.fertig)) return;
    if (this.weiterGesendet === nr) return;
    this.weiterGesendet = nr;
    setTimeout(() => {
      if (!this.room || App.nr !== nr) return;
      if (nr >= 7) {
        this.sende({ t: 'ende' });
        // Sieger: wenigste Schläge, bei Gleichstand niemand
        const alle = App.spieler.concat(App.geister.filter(g => !g.weg));
        const tot = alle.map(s => ({ idx: s.idx, t: s.gesamt() })).sort((a, b) => a.t - b.t);
        const sieger = tot.length > 1 && tot[0].t === tot[1].t ? -1 : tot[0].idx;
        try { if (alle.length >= 2) this.room.result(sieger); } catch (e) { }
        App.rundeEnde();
      } else {
        this.sende({ t: 'weiter', n: nr + 1 });
        Menue.zwischenOnline(nr, nr + 1);
      }
    }, 2600);
  },
  fertig(sp) {
    this.sende({ t: 'fertig', n: App.nr, s: sp.karte[App.nr], karte: sp.karte });
    const offen = App.geister.filter(g => !g.weg && !g.fertig).map(g => g.name);
    if (offen.length && App.ansichten[0]) setTimeout(() => { if (App.zustand === 'spiel') App.ansichten[0].anz.hinweis('Warte auf ' + offen.join(', ') + ' …'); }, 2500);
    this.pruefen();
  },
  nachricht(d, from) {
    if (!d || typeof d !== 'object') return;
    const g = App.geister.find(q => q.idx === from);
    switch (d.t) {
      case 'hallo':
        if (!this.liste.some(p => p.idx === from)) this.liste.push({ idx: from, name: String(d.name || 'Spieler').slice(0, 16) });
        else this.liste.find(p => p.idx === from).name = String(d.name || 'Spieler').slice(0, 16);
        this.liste.sort((a, b) => a.idx - b.idx);
        if (this.istHost()) this.sende({ t: 'lobby', liste: this.liste, imSpiel: this.imSpiel });
        this.lobbyListe();
        break;
      case 'lobby':
        if (Array.isArray(d.liste)) { this.liste = d.liste.filter(p => p && typeof p.idx === 'number').map(p => ({ idx: p.idx, name: String(p.name).slice(0, 16) })); }
        if (!this.imSpiel) this.lobbyListe();
        if (d.imSpiel && !this.imSpiel) $('lStatus').textContent = 'Das Spiel läuft schon. Du bist bei der nächsten Runde dabei.';
        break;
      case 'laeuft':
        if (!this.imSpiel) $('lStatus').textContent = 'Das Spiel läuft schon. Du bist bei der nächsten Runde dabei.';
        break;
      case 'start':
        if (typeof d.seed === 'number' && Array.isArray(d.liste) && d.liste.some(p => p.idx === this.you)) this.los(d.seed >>> 0, d.liste);
        break;
      case 'pos':
        if (g && d.n === App.nr && g.pos) {
          g.ziel = { x: +d.x || 0, y: +d.y || 0, z: +d.z || 0 };
          g.schlaege = d.s | 0;
          if (d.f && g.spur) g.spur.punkt(g.ziel);
        }
        break;
      case 'schlag':
        if (g && d.n === App.nr) { g.schlaege = d.s | 0; if (g.spur) g.spur.leeren(); }
        break;
      case 'fertig':
        if (g) {
          if (Array.isArray(d.karte)) g.karte = d.karte.map(v => v == null ? v : (v | 0));
          if (d.n === App.nr) {
            g.fertig = true;
            if (App.ansichten[0] && App.zustand === 'spiel') App.ansichten[0].anz.meldung(g.name + ': ' + scoreName(d.s | 0, App.kurs.par), '', g.farbe, 1.8);
            const offen = App.geister.filter(q => !q.weg && !q.fertig).map(q => q.name);
            if (App.spieler[0] && App.spieler[0].fertig && App.ansichten[0]) App.ansichten[0].anz.hinweis(offen.length ? 'Warte auf ' + offen.join(', ') + ' …' : '');
          }
        }
        this.pruefen();
        break;
      case 'weiter':
        if (typeof d.n === 'number' && d.n > App.nr && d.n < 8) Menue.zwischenOnline(App.nr, d.n);
        break;
      case 'ende':
        if (App.zustand !== 'ende') App.rundeEnde();
        break;
    }
  },
};
