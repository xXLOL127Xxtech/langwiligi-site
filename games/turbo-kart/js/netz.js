// Turbo-Kart – Online-Spiel über GameHub: Raum, Lobby, Abgleich während des Rennens
// Muster: Platz 0 (Gastgeber) rechnet Computerfahrer, Items und Treffer. Jeder Spieler steuert sein eigenes Kart selbst.
'use strict';

const Netz = {
  room: null, host: false, you: -1, code: null, imRennen: false,
  spieler: [], cfg: null, gp: null, sendT: 0, boardEl: null,
  standardCfg() { return { modus: 'vs', cc: 150, items: 'normal', teams: false, runden: 3, gesamt: 8, ki: 1, strecke: 0, cup: 0, arena: 0 }; },
  ich() { return { fi: (Einst.wahl[0] || { f: 0 }).f, ki: (Einst.wahl[0] || { k: 0 }).k, team: 0 }; },
  // ---------- Bildschirm "Online" ----------
  onlineZeigen() {
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
  async erstellen() {
    const n = this.name(); if (!n) return;
    $('oFehler').textContent = 'Verbinde …';
    try {
      this.room = this.verbinden();
      const info = await this.room.create(n, 8);
      this.host = true; this.you = info.you; this.code = info.code;
      this.cfg = Object.assign(this.standardCfg(), this.cfg || {});
      this.spieler = [];
      this.spieler[this.you] = Object.assign({ slot: this.you, name: n }, this.ich());
      $('oFehler').textContent = '';
      this.lobbyZeigen();
    } catch (e) { $('oFehler').textContent = HUB.errorText(e); }
  },
  async beitreten() {
    const n = this.name(); if (!n) return;
    const code = HUB.cleanCode($('oCode').value);
    if (code.length !== 4) { $('oFehler').textContent = 'Der Code hat 4 Zeichen.'; return; }
    $('oFehler').textContent = 'Verbinde …';
    try {
      this.room = this.verbinden();
      const info = await this.room.join(code, n);
      this.host = false; this.you = this.room.you; this.code = this.room.code;
      this.spieler = [];
      this.spieler[this.you] = Object.assign({ slot: this.you, name: n }, this.ich());
      this.cfg = this.standardCfg();
      $('oFehler').textContent = '';
      this.lobbyZeigen();
      this.sendeIch();
    } catch (e) { $('oFehler').textContent = HUB.errorText(e); }
  },
  verlassen() {
    if (this.room) { try { this.room.close(); } catch (e) { } }
    this.room = null; this.host = false; this.imRennen = false; this.gp = null;
    App.online = false;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  },
  verbindungWeg() {
    if (!this.room) return;
    this.room = null;
    App.online = false;
    App.zumMenue();
    App.zeige('sOnline');
    $('oFehler').textContent = 'Die Verbindung zum Spiel-Server ist abgebrochen.';
  },
  beigetreten(m) {
    if (this.host) { this.sendeLobby(); }
    this.lobbyListe();
  },
  weg(m) {
    if (m.idx === 0 && !this.host) {
      this.verlassen();
      App.zumMenue();
      App.zeige('sOnline');
      $('oFehler').textContent = 'Der Gastgeber hat das Spiel verlassen.';
      return;
    }
    delete this.spieler[m.idx];
    if (this.host) {
      // Kart übernimmt ein Computerfahrer
      const r = App.rennen;
      if (this.imRennen && r) for (const k of r.karts) if (k.slot === m.idx && k.typ === 'netz') { k.typ = 'bot'; k.bot = new Bot(k, 1); k.name += ' (KI)'; }
      this.sendeLobby();
    }
    this.lobbyListe();
  },
  sende(d) { if (this.room) this.room.send(d); },
  sendeIch() { const s = this.spieler[this.you]; this.sende({ t: 'ich', name: s.name, fi: s.fi, ki: s.ki, team: s.team }); },
  sendeLobby() { if (this.host) this.sende({ t: 'lobby', spieler: this.spieler, cfg: this.cfg }); },
  // ---------- Lobby ----------
  lobbyZeigen() {
    App.online = true;
    this.imRennen = false;
    $('lCode').textContent = this.code;
    $('lKopieren').onclick = () => {
      const url = (location.protocol === 'https:' && location.hostname.endsWith('langwiligi.site') ? location.origin + location.pathname : 'https://langwiligi.site/turbo-kart/') + '#' + this.code;
      const fertig = () => { $('lKopieren').textContent = 'Kopiert!'; setTimeout(() => $('lKopieren').textContent = 'Link kopieren', 1500); };
      try { navigator.clipboard.writeText(url).then(fertig, () => { $('lStatus').textContent = url; }); } catch (e) { $('lStatus').textContent = url; }
    };
    $('lVerlassen').onclick = () => { this.verlassen(); App.zumMenue(); };
    $('lStart').onclick = () => this.starten();
    this.lobbyFahrer();
    this.lobbyListe();
    this.lobbyRegeln();
    App.verlauf = ['sTitel'];
    App.zeige('sLobby', false);
  },
  lobbyListe() {
    const el = $('lListe'); if (!el) return;
    const liste = this.spieler.filter(Boolean);
    el.innerHTML = liste.map(s => `<div><img src="${Portraet.bild(s.fi)}" alt="">${esc(s.name)}${this.cfg && this.cfg.teams ? ` <span style="color:${TEAMFARBEN[s.team]}">●</span>` : ''}<em>${s.slot === 0 ? 'Gastgeber' : s.slot === this.you ? 'Du' : ''}</em></div>`).join('');
    const n = liste.length;
    $('lStatus').textContent = this.host ? (n < 2 ? 'Warte auf Mitspieler … Schick ihnen den Code oder den Link.' : `${n} Spieler im Raum. Freie Plätze füllen Computerfahrer.`) : 'Der Gastgeber wählt die Regeln und startet das Rennen.';
    $('lStart').classList.toggle('hidden', !this.host);
    $('lStart').disabled = n < 2;
  },
  lobbyRegeln() {
    const c = this.cfg, h = this.host;
    const seg = (key, label, opts) => `<span class="lbl">${label}</span><div class="seg" data-key="${key}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(v) === String(c[key]) ? 'on' : ''}" ${h ? '' : 'disabled'}>${n}</button>`).join('')}</div>`;
    let html = seg('modus', 'Modus', [['gp', 'Grand Prix'], ['vs', 'VS-Rennen'], ['schlacht', 'Ballon-Schlacht']]);
    if (c.modus !== 'schlacht') html += seg('cc', 'Klasse', [[50, '50'], [100, '100'], [150, '150'], [200, '200 ccm']]);
    html += seg('gesamt', 'Fahrer insgesamt', [[2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10'], [12, '12']]);
    html += seg('ki', 'Computer', [[0, 'Leicht'], [1, 'Mittel'], [2, 'Schwer']]);
    if (c.modus !== 'gp') {
      html += seg('teams', 'Teams', [[false, 'Aus'], [true, 'Rot gegen Blau']]);
      html += seg('items', 'Items', ITEM_MODI.filter(x => !(c.modus === 'schlacht' && x[0] === 'aus')));
    }
    if (c.modus === 'vs') html += seg('runden', 'Runden', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]);
    if (c.modus === 'gp') html += seg('cup', 'Cup', CUPS.map((cu, i) => [i, cu.name]));
    if (c.modus === 'vs') html += seg('strecke', 'Strecke', STRECKEN.map((s, i) => [i, s.name]));
    if (c.modus === 'schlacht') html += seg('arena', 'Arena', ARENEN.map((s, i) => [i, s.name]));
    $('lRegeln').innerHTML = html;
    if (h) $('lRegeln').querySelectorAll('.seg').forEach(s => s.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = s.dataset.key; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v)) v = +v;
      c[k] = v;
      Ton.sfx('wahl');
      this.lobbyRegeln(); this.lobbyListe(); this.lobbyFahrer();
      this.sendeLobby();
    });
  },
  lobbyFahrer() {
    const s = this.spieler[this.you];
    if (!s) return;
    const teams = this.cfg && this.cfg.teams && this.cfg.modus !== 'gp';
    $('lFahrer').innerHTML = `<div class="sp" style="--pc:var(--gelb)"><canvas width="340" height="260"></canvas><div class="info">
      <div class="nm">${esc(FIGUREN[s.fi].name)}</div>
      <div class="wahl">${FIGUREN.map((f, i) => `<button data-f="${i}" class="${i === s.fi ? 'on' : ''}" style="padding:2px"><img src="${Portraet.bild(i)}" alt="" style="width:40px;height:40px;display:block;border-radius:7px"></button>`).join('')}</div>
      <div class="wahl">${KARTS.map((k, i) => `<button data-k="${i}" class="${i === s.ki ? 'on' : ''}">${k.name}</button>`).join('')}</div>
      ${teams ? `<div class="wahl"><button class="t0 ${s.team === 0 ? 'on' : ''}" data-t="0">Team Rot</button><button class="t1 ${s.team === 1 ? 'on' : ''}" data-t="1">Team Blau</button></div>` : ''}
    </div></div>`;
    Vorschau.plaetze = [{ canvas: $('lFahrer').querySelector('canvas'), fi: s.fi, ki: s.ki, team: teams ? s.team : -1 }];
    $('lFahrer').querySelectorAll('button').forEach(b => b.onclick = () => {
      const s = this.spieler[this.you];
      if (!s) return;
      if (b.dataset.f !== undefined) s.fi = +b.dataset.f;
      if (b.dataset.k !== undefined) s.ki = +b.dataset.k;
      if (b.dataset.t !== undefined) s.team = +b.dataset.t;
      Einst.wahl[0] = { f: s.fi, k: s.ki }; einstSpeichern();
      Ton.sfx('wahl');
      this.lobbyFahrer(); this.lobbyListe();
      if (this.host) this.sendeLobby(); else this.sendeIch();
    });
  },
  // ---------- Start ----------
  starten() {
    if (!this.host) return;
    const c = this.cfg;
    const menschen = this.spieler.filter(Boolean);
    if (c.modus === 'gp') {
      const strecken = STRECKEN.map((s, i) => [s, i]).filter(([s]) => s.cup === c.cup).map(([, i]) => i);
      const fahrer = this.baueFahrer(menschen, c, false);
      this.gp = { cup: c.cup, nr: 0, strecken, fahrer, punkte: Object.fromEntries(fahrer.map(f => [f.id, 0])) };
      this.gpRennen();
    } else {
      const fahrer = this.baueFahrer(menschen, c, c.teams);
      const ord = c.modus === 'schlacht' ? fahrer : [...fahrer.filter(f => f.slot < 0), ...fahrer.filter(f => f.slot >= 0)];
      this.gp = null;
      this.sendeStart({ modus: c.modus, strecke: c.modus === 'schlacht' ? c.arena : c.strecke, cc: c.modus === 'schlacht' ? 100 : c.cc, ki: c.ki, items: c.items, teams: c.teams, runden: c.runden, fahrer: ord });
    }
  },
  baueFahrer(menschen, c, teams) {
    const liste = menschen.map(s => ({ id: 's' + s.slot, fi: s.fi, ki: s.ki, name: s.name, team: teams ? s.team : -1, slot: s.slot }));
    const belegt = new Set(liste.map(f => f.fi));
    const frei = FIGUREN.map((f, i) => i).filter(i => !belegt.has(i)).sort(() => Math.random() - 0.5);
    const tz = [liste.filter(f => f.team === 0).length, liste.filter(f => f.team === 1).length];
    const gesamt = Math.max(c.gesamt, liste.length);
    while (liste.length < gesamt) {
      const fi = frei.length ? frei.pop() : (Math.random() * FIGUREN.length) | 0;
      let team = -1; if (teams) { team = tz[0] <= tz[1] ? 0 : 1; tz[team]++; }
      liste.push({ id: 'b' + liste.length, fi, ki: (Math.random() * KARTS.length) | 0, name: FIGUREN[fi].name, team, slot: -1 });
    }
    return liste;
  },
  gpRennen() {
    const gp = this.gp, c = this.cfg;
    let ord;
    if (gp.nr === 0) ord = [...gp.fahrer.filter(f => f.slot < 0), ...gp.fahrer.filter(f => f.slot >= 0)];
    else ord = [...gp.fahrer].sort((a, b) => gp.punkte[b.id] - gp.punkte[a.id]);
    this.sendeStart({ modus: 'gp', strecke: gp.strecken[gp.nr], cc: c.cc, ki: c.ki, items: 'normal', teams: false, runden: 3, fahrer: ord });
  },
  sendeStart(cfg) {
    this.rennId = (this.rennId || 0) + 1;
    const msg = { t: 'start', cfg, rid: this.rennId, gp: this.gp ? { cup: this.gp.cup, nr: this.gp.nr } : null };
    this.sende(msg);
    this.rennenStarten(msg);
  },
  rennenStarten(msg) {
    const cfg = JSON.parse(JSON.stringify(msg.cfg));
    cfg.fahrer = cfg.fahrer.map(f => Object.assign(f, {
      typ: f.slot === this.you ? 'spieler' : (this.host && f.slot < 0 ? 'bot' : 'netz'),
      lokal: f.slot === this.you ? 0 : -1,
    }));
    cfg.netz = this.adapter();
    cfg.introDauer = 4;
    this.imRennen = true;
    this.rennId = msg.rid || 0;
    this.gpInfo = msg.gp;
    this.sendT = 0;
    App.anzahl = 1;
    App.starteRennen(cfg);
  },
  // Schnittstelle für Rennen/Items
  adapter() {
    const N = this;
    return {
      host: this.host,
      box(i, k) { if (!N.host && k.typ === 'spieler') N.sende({ t: 'box', i }); },
      muenze(i, k) { if (!N.host && k.typ === 'spieler') N.sende({ t: 'mz', i }); },
      aktion(k, art, rueck, typ) { N.sende({ t: 'a', art, r: rueck ? 1 : 0, typ }); },
      treffer(o, art, quelle, extra) { N.sende({ t: 'hit', k: o.idx, art, q: quelle ? quelle.idx : -1, kl: extra && extra.klein }); },
      ereignis(typ, k, d) {
        if (!N.host) return;
        if (typ === 'blitz' || typ === 'hupe' || typ === 'tinte') N.sende({ t: 'fx', e: typ, k: k ? k.idx : -1 });
        if (typ === 'explo') N.sende({ t: 'fx', e: 'explo', p: [r2(d.pos.x), r2(d.pos.y), r2(d.pos.z)], r: d.radius });
        if (typ === 'ballon') N.sende({ t: 'fx', e: 'ballon', k: k.idx });
      },
      rundeStart() { if (N.room) N.room.roundStart(); },
      fertig() { },
      ende(erg) { },
    };
  },
  // ---------- Abgleich pro Bild ----------
  frame(dt) {
    const r = App.rennen;
    if (!this.room || !this.imRennen || !r || r.demo || !r.netz || r.netzRid !== this.rennId) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    if (this.host) {
      this.sendT = 1 / 15;
      this.sende({
        t: 's', rid: this.rennId, ph: r.phase, cd: r2(r.cd), rz: r2(r.rennZeit), sz: r2(r.schlachtZeit),
        k: r.karts.map(k => k.zustand().concat(this.extra(k), [k.platz, k.ballons, k.punkte])),
        g: r.items.netzZustand(),
        b: r.items.boxen.map(b => b.aktiv ? 1 : 0).join(''), m: r.items.muenzen.map(m => m.aktiv ? 1 : 0).join(''),
      });
    } else {
      this.sendT = 1 / 20;
      const k = r.lokale[0];
      if (k) this.sende({ t: 'k', rid: this.rennId, z: k.zustand().concat(this.extra(k)) });
    }
  },
  extra(k) { return [k.gehalten ? ITEM_CODE.indexOf(k.gehalten) : -1, k.orbit.length ? ITEM_CODE.indexOf(k.orbit[0].typ) : -1, k.orbit.length]; },
  setzeExtra(k, a, o) {
    k.gehalten = a[o] >= 0 ? ITEM_CODE[a[o]] : null;
    const n = a[o + 2] || 0;
    if (k.orbit.length !== n) k.orbit = Array.from({ length: n }, () => ({ typ: ITEM_CODE[a[o + 1]] }));
  },
  nachricht(d, from) {
    if (!d || typeof d !== 'object') return;
    let r = App.rennen && App.rennen.netz ? App.rennen : null;
    // Nachrichten aus einem alten Rennen ignorieren
    if (r && (d.t === 's' || d.t === 'k') && d.rid !== undefined && d.rid !== this.rennId) r = null;
    if (r && r.netzRid !== undefined && r.netzRid !== this.rennId) r = null;
    switch (d.t) {
      // Lobby
      case 'ich':
        if (this.host) { this.spieler[from] = { slot: from, name: String(d.name || 'Gast').slice(0, 16), fi: clamp(d.fi | 0, 0, FIGUREN.length - 1), ki: clamp(d.ki | 0, 0, KARTS.length - 1), team: d.team ? 1 : 0 }; this.sendeLobby(); this.lobbyListe(); }
        break;
      case 'lobby':
        if (from !== 0) break;
        this.cfg = d.cfg;
        const ich = this.spieler[this.you];
        this.spieler = d.spieler || [];
        if (ich) this.spieler[this.you] = Object.assign({}, this.spieler[this.you] || {}, ich, { slot: this.you });
        if (d.zurueck || App.screen === 'sLobby') {
          if (App.screen !== 'sLobby') { this.zurLobbyLokal(); }
          else { this.lobbyRegeln(); this.lobbyListe(); }
        }
        break;
      case 'start':
        if (from !== 0) break;
        this.rennenStarten(d);
        break;
      // Rennen
      case 's': {
        if (!r || this.host || from !== 0) break;
        if (r.phase !== d.ph) {
          const alt = r.phase;
          r.phase = d.ph; r.phaseT = 0;
          if (d.ph === 'countdown') r.cd = d.cd;
          if (d.ph === 'rennen' && alt !== 'rennen') { r.phase = 'countdown'; r.los(); }
        }
        if (d.ph === 'countdown') r.cd = d.cd;
        if (Math.abs(r.rennZeit - d.rz) > 0.3) r.rennZeit = d.rz;
        r.schlachtZeit = d.sz;
        d.k.forEach((a, i) => {
          const k = r.karts[i]; if (!k) return;
          if (k.typ !== 'spieler') { k.setzeZustand(a); this.setzeExtra(k, a, 13); }
          k.platz = a[16]; k.ballons = a[17]; k.punkte = a[18];
        });
        r.items.netzSetzen(d.g || []);
        const bb = d.b || '';
        r.items.boxen.forEach((b, i) => {
          const an = bb[i] === '1';
          if (!an && b.aktiv) r.items.boxNehmen(b, null, true);
          if (an && !b.aktiv) { b.aktiv = true; }
        });
        const mm = d.m || '';
        r.items.muenzen.forEach((m, i) => { const an = mm[i] === '1'; if (!an && m.aktiv) r.items.muenzeNehmen(m, null, true); if (an) m.aktiv = true; });
        break;
      }
      case 'k': {
        if (!r || !this.host) break;
        const k = r.karts.find(x => x.slot === from);
        if (!k || k.typ !== 'netz' || !Array.isArray(d.z)) break;
        k.setzeZustand(d.z);
        this.setzeExtra(k, d.z, 13);
        if (k.fertig && k.zielReihe === undefined) { k.zielReihe = r.zielReihe++; if (r.ersterFertig < 0) r.ersterFertig = r.rennZeit; }
        break;
      }
      case 'a': {
        if (!r || !this.host) break;
        const k = r.karts.find(x => x.slot === from);
        if (k && ['wurf', 'orbit', 'blau', 'blitz', 'tinte', 'hupe'].includes(d.art)) r.items.ausfuehren(k, d.art, !!d.r, ITEMS[d.typ] ? d.typ : 'banane');
        break;
      }
      case 'box': if (r && this.host) { const b = r.items.boxen[d.i | 0]; if (b && b.aktiv) r.items.boxNehmen(b, null, true); } break;
      case 'mz': if (r && this.host) { const m = r.items.muenzen[d.i | 0]; if (m && m.aktiv) r.items.muenzeNehmen(m, null, true); } break;
      case 'hit': {
        if (!r || from !== 0) break;
        const k = r.karts[d.k];
        if (!k || k.typ !== 'spieler') break;
        const q = r.karts[d.q] || null;
        if (d.art === 'tinte') { k.tinteT = 5; Anzeige.tinte(k.lokal); Ton.sfx('tinte'); break; }
        if (d.art === 'blitz') { k.schutzT = 0; k.treffer = null; }
        const ok = k.getroffen(d.art, q);
        if (ok && d.art === 'blitz') { k.kleinT = d.kl || 5; k.gehalten = null; k.orbit = []; }
        break;
      }
      case 'fx': {
        if (!r || from !== 0) break;
        const k = r.karts[d.k];
        if (d.e === 'explo') { const p = new THREE.Vector3(d.p[0], d.p[1], d.p[2]); r.fx.explosion(p, d.r); r.kameraWackelnAlle(p, 1); Ton.sfx('explo', 0.9); }
        if (d.e === 'blitz') Anzeige.ereignis('blitz', k);
        if (d.e === 'hupe' && k) { r.fx.welle(k.pos, 11); Anzeige.ereignis('hupe', k); }
        if (d.e === 'tinte' && k) Anzeige.ereignis('tinte', k);
        if (d.e === 'ballon' && k) { r.fx.glitzer(k.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), k.farbe, 20); Ton.sfx('ballon', k.lokal >= 0 ? 1 : 0.5); }
        break;
      }
      case 'ende': {
        if (!r || from !== 0) break;
        r.phase = 'ende';
        this.gp = d.gp || null;
        App.ergebnisZeigen(d.erg, { host: false, gp: this.gp });
        if (window.LW) try { LW.rundeFertig(); } catch (e) { }
        break;
      }
      case 'sieger': if (from === 0 && d.gp) { this.gp = d.gp; App.siegerehrung(d.gp); this.siegerKnoepfe(); } break;
    }
  },
  // ---------- Ende ----------
  rennEnde(erg) {
    if (!this.host) return;
    const r = App.rennen;
    if (this.gp && r.modus === 'gp') erg.forEach(e => { const f = r.cfg.fahrer[e.idx]; this.gp.punkte[f.id] = (this.gp.punkte[f.id] || 0) + e.punkte; });
    // Rangliste: bester Mensch gewinnt
    const mensch = erg.find(e => e.slot >= 0);
    try { if (this.room && mensch) this.room.result(mensch.slot); } catch (e) { }
    this.sende({ t: 'ende', erg, gp: this.gp });
    setTimeout(() => App.ergebnisZeigen(erg, { host: true, gp: this.gp }), 800);
  },
  weiter() {
    if (!this.host || !this.gp) return;
    if (this.gp.nr < 3) { this.gp.nr++; this.gpRennen(); }
    else { this.sende({ t: 'sieger', gp: this.gp }); App.siegerehrung(this.gp); this.siegerKnoepfe(); }
  },
  siegerKnoepfe() {
    $('siegerMenue').textContent = this.host ? 'Zurück in den Raum' : 'Raum verlassen';
    $('siegerMenue').onclick = () => { if (this.host) this.zurLobby(); else { this.verlassen(); App.zumMenue(); } $('siegerMenue').onclick = () => App.zumMenue(); $('siegerMenue').textContent = 'Menü'; };
  },
  zurLobby() {
    if (!this.host) return;
    this.sende({ t: 'lobby', spieler: this.spieler, cfg: this.cfg, zurueck: true });
    this.zurLobbyLokal();
  },
  zurLobbyLokal() {
    this.imRennen = false;
    Ton.motorStop();
    App.demo();
    this.lobbyZeigen();
  },
};
