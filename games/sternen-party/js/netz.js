// Sternen-Party – Online-Modus über GameHub
// Muster: Platz 0 (Gastgeber) rechnet das ganze Spiel und schickt den Zustand. Die anderen schicken nur
// Antworten (Dialoge), „bereit“ und ihre Minispiel-Eingaben (Tasten + Touchpad).
'use strict';

const Netz = {
  room: null, host: false, you: -1, code: '', lobby: null, eingaben: {},
  dirty: false, letztZ: 0, letztMs: 0, letztEin: 0, einGesendet: 0, einText: '', boardEl: null,
  aktiv() { return !!this.room; },

  // ---------- Verbindung ----------
  verbinden() {
    const room = HUB.connect(GAME_ID);
    room.on('msg', (d, von) => this.nachricht(d, von));
    room.on('peer-join', m => this.beigetreten(m));
    room.on('peer-left', m => this.weg(m.idx));
    room.on('close', () => this.verbindungWeg());
    room.on('leaderboard', rows => { if (this.boardEl) HUB.renderBoard(this.boardEl, rows, HUB.getName()); });
    return room;
  },
  async erstellen(name) {
    this.room = this.verbinden();
    const info = await this.room.create(name, 4);
    this.host = true; this.you = info.you; this.code = info.code;
    this.lobby = { spieler: [{ slot: this.you, name, figur: Einst.figuren[0] || 0 }], einst: { runden: Einst.runden, stufe: Einst.stufe, bonus: Einst.bonus }, laeuft: false };
    return info;
  },
  async beitreten(code, name) {
    this.room = this.verbinden();
    await this.room.join(code, name);
    this.host = false; this.you = this.room.you; this.code = this.room.code;
    this.lobby = null;
    this.senden({ t: 'hallo', name, figur: Einst.figuren[0] || 0 });
  },
  verlassen() {
    if (this.room) { try { this.room.close(); } catch (e) { } }
    this.room = null; this.host = false; this.lobby = null; this.eingaben = {};
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  },
  verbindungWeg() {
    if (!this.room) return;
    this.room = null;
    App.fehlerMenue('Die Verbindung zum Spiel-Server ist abgebrochen.');
  },
  senden(d) { if (this.room) this.room.send(d); },
  // Zahlen runden spart Bandbreite
  sendenKompakt(d) {
    if (!this.room) return;
    this.room.send(JSON.parse(JSON.stringify(d, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v)));
  },

  // ---------- Nachrichten ----------
  nachricht(d, von) {
    if (!d || typeof d !== 'object') return;
    if (this.host) {
      switch (d.t) {
        case 'hallo': {
          if (this.lobby.laeuft) { this.senden({ t: 'laeuft', an: von }); return; }
          const name = String(d.name || 'Gast').slice(0, 16);
          this.lobby.spieler = this.lobby.spieler.filter(s => s.slot !== von);
          this.lobby.spieler.push({ slot: von, name, figur: this.freieFigur(+d.figur) });
          this.lobbySenden();
          break;
        }
        case 'figur': {
          const s = this.lobby.spieler.find(x => x.slot === von);
          if (s && !this.lobby.laeuft && this.figurFrei(+d.f, von)) { s.figur = +d.f; this.lobbySenden(); }
          break;
        }
        case 'antwort': Spiel.antworte(d.id, d.w, von); break;
        case 'bereit': {
          const sp = Spiel.Z && Spiel.Z.spieler.findIndex(s => s.art === 'netz' && s.slot === von);
          if (sp >= 0) Spiel.bereit(sp);
          break;
        }
        case 'ein': if (d.e && typeof d.e === 'object') this.eingaben[von] = d.e; break;
      }
      return;
    }
    if (von !== 0) return;   // Gäste hören nur auf den Gastgeber
    switch (d.t) {
      case 'lobby': this.lobby = d.lobby; App.lobbyZeigen(); break;
      case 'laeuft': if (d.an === this.you) { this.verlassen(); App.fehlerMenue('Dieses Spiel läuft schon. Warte auf die nächste Partie.'); } break;
      case 'start': App.onlineSpielStart(d.z); break;
      case 'z': if (App.bildschirm === 'spiel') this.zustandEmpfangen(d.z); else App.onlineSpielStart(d.z); break;
      case 'ms': if (Spiel.lauf && Spiel.lauf.rolle === 'gast') Spiel.lauf.empfange(d.s); break;
      case 'lobbyZurueck': App.zurLobby(); break;
    }
  },
  zustandEmpfangen(z) {
    Spiel.uebernehmen(z);
    // Minispiel des Gasts starten/beenden
    if (z.phase === 'mini' && z.mini && !Spiel.lauf) Spiel.lauf = new MiniLauf(Minis.finde(z.mini.id), Spiel.miniInfo(), 'gast');
    else if (z.phase !== 'mini' && Spiel.lauf) Spiel.lauf = null;
  },
  beigetreten(m) { if (this.host) this.lobbySenden(); },
  weg(idx) {
    if (!this.room) return;
    if (!this.host) {
      if (idx === 0) { this.verlassen(); App.fehlerMenue('Der Gastgeber hat das Spiel verlassen.'); }
      return;
    }
    delete this.eingaben[idx];
    if (this.lobby) this.lobby.spieler = this.lobby.spieler.filter(s => s.slot !== idx);
    // Laufendes Spiel: der Computer übernimmt diesen Spieler
    const Z = Spiel.Z;
    if (Z && App.bildschirm === 'spiel') {
      const sp = Z.spieler.findIndex(s => s.art === 'netz' && s.slot === idx);
      if (sp >= 0) {
        const s = Z.spieler[sp];
        s.art = 'bot'; s.stufe = 1; s.name = s.name + ' (PC)';
        if (Spiel.lauf && Spiel.lauf.info.teilnehmer.includes(sp)) Spiel.lauf.info.quellen[Spiel.lauf.info.teilnehmer.indexOf(sp)] = { art: 'bot' };
        if (Z.mini && Z.phase === 'mini-intro') Spiel.bereit(sp);
        const f = Spiel.offeneFrage;
        if (f && f.sp === sp) f.fertig(KI.entscheide(sp, f.typ, Z.frage || {}));
        Spiel.aktualisiere();
      }
    } else this.lobbySenden();
  },

  // ---------- Lobby (Gastgeber) ----------
  figurFrei(f, slot) { return f >= 0 && f < FIGUREN.length && !this.lobby.spieler.some(s => s.slot !== slot && s.figur === f); },
  freieFigur(wunsch) {
    if (this.figurFrei(wunsch, -1)) return wunsch;
    for (let f = 0; f < FIGUREN.length; f++) if (this.figurFrei(f, -1)) return f;
    return 0;
  },
  lobbySenden() { if (this.host) { this.senden({ t: 'lobby', lobby: this.lobby }); App.lobbyZeigen(); } },
  figurWaehlen(f) {
    if (this.host) {
      const s = this.lobby.spieler.find(x => x.slot === this.you);
      if (s && this.figurFrei(f, this.you)) { s.figur = f; this.lobbySenden(); }
    } else this.senden({ t: 'figur', f });
  },
  // Spiel starten: Menschen der Lobby + Computer für leere Plätze
  spielStarten() {
    const L = this.lobby, e = L.einst;
    const spieler = L.spieler.slice(0, 4).map(s => ({ name: s.name, figur: s.figur, art: 'netz', slot: s.slot, block: -1, stufe: 1 }));
    const frei = [...Array(FIGUREN.length).keys()].filter(f => !spieler.some(s => s.figur === f));
    while (spieler.length < 4) {
      const f = frei.shift();
      spieler.push({ name: FIGUREN[f].name, figur: f, art: 'bot', slot: -1, block: -1, stufe: e.stufe });
    }
    L.laeuft = true;
    this.eingaben = {};
    Spiel.neu(spieler, { modus: 'online', runden: e.runden, bonus: e.bonus });
    this.senden({ t: 'start', z: Spiel.Z });
    this.room.roundStart();
    return true;
  },
  zustandSenden() { this.dirty = true; },
  ergebnisMelden(rang) {
    if (!this.host || !this.room) return;
    const Z = Spiel.Z;
    const erster = rang.filter(r => r.platz === 1);
    const s = Z.spieler[erster[0].i];
    this.room.result(erster.length === 1 && s.art === 'netz' ? s.slot : -1);
  },

  // ---------- Jedes Bild ----------
  tick() {
    if (!this.room || App.bildschirm !== 'spiel') return;
    const jetzt = performance.now();
    if (this.host) {
      if (this.dirty && jetzt - this.letztZ > 60) { this.dirty = false; this.letztZ = jetzt; this.sendenKompakt({ t: 'z', z: Spiel.Z }); }
      if (Spiel.lauf && jetzt - this.letztMs > 50) { this.letztMs = jetzt; this.sendenKompakt({ t: 'ms', s: Spiel.lauf.schnappschuss() }); }
    } else if (Spiel.lauf && Spiel.Z.phase === 'mini' && jetzt - this.letztEin > 50) {
      // Eingaben nur bei Änderung schicken, sonst alle 300 ms als Lebenszeichen
      this.letztEin = jetzt;
      const e = Eingabe.mitZeiger(Eingabe.alleBloecke());
      const txt = JSON.stringify(e);
      if (txt !== this.einText || jetzt - this.einGesendet > 300) { this.einText = txt; this.einGesendet = jetzt; this.senden({ t: 'ein', e }); }
    }
  },
};
