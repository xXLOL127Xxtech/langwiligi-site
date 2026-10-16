// Turbo-Kart – Menüs, Spielablauf (Grand Prix, VS, Schlacht, Zeitfahren) und Hauptschleife
'use strict';

const MODI = {
  gp: { name: 'Grand Prix', text: 'Vier Rennen, Punkte sammeln und den Pokal holen.', farbe: ['#ff9a2e', '#d4400f'], icon: 'stern' },
  vs: { name: 'VS-Rennen', text: 'Eigene Regeln: Teams, Items, Runden und Gegner.', farbe: ['#4f9aff', '#1c4fc8'], icon: 'gruen3' },
  schlacht: { name: 'Ballon-Schlacht', text: 'Platz die Ballons der anderen in der Arena!', farbe: ['#ff5a8a', '#b81c4a'], icon: 'bombe' },
  zeit: { name: 'Zeitfahren', text: 'Allein gegen die Uhr – mit 3 Nitros.', farbe: ['#3fd07a', '#16884a'], icon: 'nitro3' },
};
const ITEM_MODI = [['normal', 'Normal'], ['nitro', 'Nur Nitro'], ['kugeln', 'Nur Kugeln'], ['chaos', 'Chaos'], ['aus', 'Keine']];
const SPIELER_FARBEN = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

// ---------- Vorschau der Fahrer (eigener kleiner Renderer) ----------
const Vorschau = {
  r: null, plaetze: [],
  init() {
    if (this.r) return;
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.r.setPixelRatio(1);
    this.r.setSize(340, 260, false);
    this.szene = new THREE.Scene();
    this.szene.add(new THREE.HemisphereLight('#ffffff', '#6a7a9a', 0.95));
    const d = new THREE.DirectionalLight('#ffffff', 0.95); d.position.set(3, 5, 4); this.szene.add(d);
    const r2 = new THREE.DirectionalLight('#9fd2ff', 0.5); r2.position.set(-4, 2, -3); this.szene.add(r2);
    const boden = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: '#2a3040', roughness: 0.6 }));
    boden.rotation.x = -Math.PI / 2; this.szene.add(boden);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.65, 48), new THREE.MeshBasicMaterial({ color: '#ffd23a' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; this.szene.add(ring);
    this.cam = new THREE.PerspectiveCamera(32, 340 / 260, 0.1, 50);
    this.cam.position.set(0, 2.6, 6.4); this.cam.lookAt(0, 0.8, 0);
  },
  render(dt) {
    this.init();
    const t = performance.now() / 1000;
    for (const p of this.plaetze) {
      if (!p.canvas.isConnected) continue;
      const key = p.fi + ':' + p.ki + ':' + p.team;
      if (p.key !== key) {
        if (p.m) this.szene.remove(p.m.root);
        p.m = baueKart(p.fi, p.ki, p.team >= 0 ? TEAMFARBEN[p.team] : null);
        p.key = key; p.dreh = p.dreh || 0;
        p.m.root.scale.setScalar(1.1);
      }
      this.szene.add(p.m.root);
      p.dreh += dt * (p.bereit ? 2.2 : 0.9);
      p.m.root.rotation.y = p.dreh;
      const jubel = p.bereit;
      p.m.fig.armL.rotation.x = jubel ? -2.5 + Math.sin(t * 8) * 0.3 : 0;
      p.m.fig.armR.rotation.x = jubel ? -2.5 + Math.cos(t * 8) * 0.3 : 0;
      p.m.root.position.y = jubel ? Math.abs(Math.sin(t * 6)) * 0.15 : 0;
      for (const rad of p.m.raeder) rad.rad.rotation.x += dt * 3;
      this.r.render(this.szene, this.cam);
      this.szene.remove(p.m.root);
      const g = p.canvas.getContext('2d');
      g.clearRect(0, 0, p.canvas.width, p.canvas.height);
      g.drawImage(this.r.domElement, 0, 0, p.canvas.width, p.canvas.height);
    }
  },
};

// ---------- Streckenbilder ----------
const StreckenBild = {
  cache: {},
  bild(def, arena) {
    const key = def.id;
    if (this.cache[key]) return this.cache[key];
    const th = THEMEN[def.thema];
    const c = Tex.canvas(320, 200, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, th.himmel[1]); gr.addColorStop(1, th.himmel[0]);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const bodenFarbe = { gras: '#4fae3a', sand: '#e6c78c', schnee: '#eef4fb', stadt: '#2a2d33', lava: '#ff5a00', dschungel: '#3f8f2f', mond: '#9a9aa8' }[th.boden] || null;
      if (bodenFarbe) { g.globalAlpha = 0.85; g.fillStyle = bodenFarbe; g.beginPath(); g.ellipse(w / 2, h / 2 + 4, w * 0.47, h * 0.44, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
      if (arena) {
        const s = 150 / def.gr / 2;
        g.save(); g.translate(w / 2, h / 2 + 4);
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-def.gr * s, -def.gr * s, def.gr * 2 * s, def.gr * 2 * s);
        g.fillStyle = '#d8c9a8'; g.fillRect(-def.gr * s + 3, -def.gr * s + 3, def.gr * 2 * s - 6, def.gr * 2 * s - 6);
        for (const hh of def.hindernisse) { g.fillStyle = ['#ff5a4a', '#4a8aff', '#ffd23a', '#4acf6a'][(hh[0] + hh[1] + 400) % 4 | 0]; g.fillRect((hh[0] - hh[2] / 2) * s, (hh[1] - hh[3] / 2) * s, hh[2] * s, hh[3] * s); }
        g.restore();
      } else {
        const st = Strecken.welt(STRECKEN.indexOf(def));
        const b = st.box, sk = Math.min(280 / (b.mxx - b.mnx), 160 / (b.mxz - b.mnz));
        const P = s => [w / 2 + (s.p.x - b.cx) * sk, h / 2 + (s.p.z - b.cz) * sk];
        const pfad = () => { g.beginPath(); st.S.forEach((s, i) => { const [x, y] = P(s); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
        g.lineJoin = 'round';
        pfad(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 15; g.stroke();
        pfad(); g.strokeStyle = '#fff'; g.lineWidth = 10; g.stroke();
        pfad(); g.strokeStyle = def.thema === 'all' ? '#ff7ae0' : def.thema === 'stadt' ? '#3a3f4a' : '#6a6e78'; g.lineWidth = 6; g.stroke();
        const [sx, sy] = P(st.S[st.idx(st.startS)]);
        g.fillStyle = '#fff'; g.fillRect(sx - 6, sy - 6, 12, 12); g.fillStyle = '#111'; g.fillRect(sx - 6, sy - 6, 6, 6); g.fillRect(sx, sy, 6, 6);
      }
    });
    return (this.cache[key] = c.toDataURL());
  },
};
const Strecken = {
  cache: {},
  welt(i) { return this.cache[i] || (this.cache[i] = new Strecke(STRECKEN[i])); },
};

// ---------- App ----------
const App = {
  screen: null, verlauf: [], anzahl: 1, modus: 'gp', rennen: null, pausiert: false, online: false,
  wahl: [], gp: null, letzteCfg: null,
  init() {
    Eingabe.init();
    Anzeige.init();
    this.knoepfe();
    this.tasten();
    Wahl.init();
    if (!HUB) $('btnOnline').disabled = true;
    $('laden').classList.add('hidden');
    this.demo();
    this.zeige('sTitel', false);
    if (location.hash && HUB) {
      const code = HUB.cleanCode(location.hash);
      if (code) { this.zeige('sOnline'); $('oCode').value = code; $('oName').focus(); }
    }
    let last = performance.now();
    const frame = t => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); last = t;
      this.frame(dt);
    };
    requestAnimationFrame(frame);
  },
  // ---------- Bildschirme ----------
  zeige(id, merken = true) {
    if (merken && this.screen && this.screen !== id) this.verlauf.push(this.screen);
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (id) $(id).classList.remove('hidden');
    this.screen = id;
    // Während des Rennens keine Knöpfe oben rechts (dort steht die Rangliste)
    $('topbar').classList.toggle('hidden', !id && !!this.rennen && !this.rennen.demo);
    $('btnPause').classList.toggle('hidden', id !== 'sPause');
    if (id) {
      if (id === 'sEinst') this.einstAnzeigen();
      const el = $(id).querySelector('.btn.haupt:not(:disabled), .karte:not(:disabled), button:not(:disabled)');
      if (el && !(id === 'sOnline')) setTimeout(() => el.focus({ preventScroll: true }), 30);
    }
    Eingabe.aktiv = !id;
  },
  zurueck() {
    Ton.sfx('zurueck');
    if (this.screen === 'sEinst' && this.pausiert) { this.zeige('sPause', false); return; }
    if (this.screen === 'sLobby') { Netz.verlassen(); }
    const z = this.verlauf.pop();
    if (z) this.zeige(z, false); else this.zeige('sTitel', false);
  },
  knoepfe() {
    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      Ton.init();
      if (b.dataset.back !== undefined) { this.zurueck(); return; }
      if (b.dataset.go) {
        Ton.sfx('klick');
        const g = b.dataset.go;
        if (g === 'einzel') { this.anzahl = 1; this.online = false; this.modusZeigen(); }
        if (g === 'mehr') { this.zeige('sMehr'); this.padInfo(); }
        if (g === 'online') { this.zeige('sOnline'); Netz.onlineZeigen(); }
        if (g === 'einst') this.zeige('sEinst');
        if (g === 'hilfe') this.zeige('sHilfe');
      }
      if (b.dataset.anz) { Ton.sfx('klick'); this.anzahl = +b.dataset.anz; this.online = false; this.modusZeigen(); }
    });
    $('btnTon').onclick = () => this.stumm();
    $('btnVoll').onclick = () => this.vollbild();
    $('btnPause').onclick = () => this.pauseUmschalten();
    $('regelnWeiter').onclick = () => { Ton.sfx('ok'); this.fahrerZeigen(); };
    $('fahrerWeiter').onclick = () => { Wahl.alleBereit(); };
    $('pWeiter').onclick = () => this.pauseUmschalten(false);
    $('pNeu').onclick = () => { this.pausiert = false; if (this.letzteCfg) this.starteRennen(this.letzteCfg); };
    $('pEinst').onclick = () => this.zeige('sEinst', false);
    $('pMenue').onclick = () => { this.pausiert = false; if (this.online) Netz.verlassen(); this.zumMenue(); };
    $('siegerMenue').onclick = () => this.zumMenue();
    $('siegerNochmal').onclick = () => { Ton.sfx('ok'); this.gpStart(this.gp.cup); };
    // Einstellungen
    $('eQual').onclick = e => { const b = e.target.closest('button'); if (!b) return; Einst.qual = b.dataset.v; einstSpeichern(); Anzeige.autoQual = null; Anzeige.setzeQual(); this.schattenNeu(); this.einstAnzeigen(); };
    $('eGas').onclick = e => { const b = e.target.closest('button'); if (!b) return; Einst.autogas = b.dataset.v === '1'; einstSpeichern(); this.einstAnzeigen(); };
    $('eMusik').oninput = e => { Einst.musik = +e.target.value; einstSpeichern(); Ton.lautstaerke(); };
    $('eSfx').oninput = e => { Einst.sfx = +e.target.value; einstSpeichern(); Ton.lautstaerke(); };
  },
  einstAnzeigen() {
    document.querySelectorAll('#eQual button').forEach(b => b.classList.toggle('on', b.dataset.v === Einst.qual));
    document.querySelectorAll('#eGas button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!Einst.autogas));
    $('eMusik').value = Einst.musik; $('eSfx').value = Einst.sfx;
  },
  schattenNeu() {
    Anzeige.szene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  },
  padInfo() {
    const n = Eingabe.pads().length;
    $('padInfo').textContent = n ? `${n} Gamepad${n > 1 ? 's' : ''} verbunden.` : 'Kein Gamepad erkannt – drück eine Taste am Gamepad, damit es erscheint.';
    document.querySelectorAll('#sMehr [data-anz]').forEach(b => { const a = +b.dataset.anz; b.disabled = a > 2 && n < a - 2; });
  },
  stumm() { Einst.stumm = !Einst.stumm; einstSpeichern(); Ton.init(); Ton.lautstaerke(); $('btnTon').textContent = Einst.stumm ? '🔇' : '🔊'; },
  vollbild() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { }
  },
  // ---------- Modus & Regeln ----------
  modusZeigen() {
    const box = $('modusKarten');
    box.innerHTML = '';
    for (const [id, m] of Object.entries(MODI)) {
      if (this.online && id === 'zeit') continue;
      const b = document.createElement('button');
      b.className = 'karte';
      b.style.setProperty('--k1', m.farbe[0]); b.style.setProperty('--k2', m.farbe[1]);
      b.innerHTML = `<b>${m.name}</b><span>${m.text}</span><img src="${Ikon.bild(m.icon)}" alt="">`;
      if (id === 'zeit' && this.anzahl > 1) { b.disabled = true; b.querySelector('span').textContent = 'Nur für einen Spieler.'; }
      b.onclick = () => { Ton.sfx('ok'); this.modus = id; this.regelnZeigen(); };
      box.appendChild(b);
    }
    this.zeige('sModus');
  },
  regelnZeigen() {
    const m = this.modus;
    $('regelnTitel').textContent = MODI[m].name;
    const teile = [];
    const seg = (key, label, opts, wert) => `<span class="lbl">${label}</span><div class="seg" data-key="${key}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(v) === String(wert) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (m !== 'schlacht') teile.push(seg('cc', 'Klasse', [[50, '50 ccm'], [100, '100 ccm'], [150, '150 ccm'], [200, '200 ccm']], Einst.cc));
    if (m !== 'zeit') {
      teile.push(seg('ki', 'Computerfahrer', [[0, 'Leicht'], [1, 'Mittel'], [2, 'Schwer']], Einst.ki));
      const min = this.anzahl;
      const opts = [2, 4, 6, 8, 10, 12].filter(x => x >= Math.max(2, min)).map(x => [x, x]);
      const ges = clamp(Einst.gesamt || (m === 'schlacht' ? 6 : 8), Math.max(2, min), 12);
      teile.push(seg('gesamt', m === 'schlacht' ? 'Kämpfer insgesamt' : 'Fahrer insgesamt', opts, opts.some(o => o[0] === ges) ? ges : opts[opts.length - 1][0]));
    }
    if (m === 'vs' || m === 'schlacht') {
      teile.push(seg('teams', 'Teams', [[0, 'Jeder gegen jeden'], [1, 'Team Rot gegen Blau']], Einst.teams ? 1 : 0));
      teile.push(seg('items', 'Items', ITEM_MODI.filter(x => !(m === 'schlacht' && x[0] === 'aus')), Einst.items));
    }
    if (m === 'vs') teile.push(seg('runden', 'Runden', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], Einst.runden));
    $('regelnInhalt').innerHTML = teile.join('');
    $('regelnInhalt').querySelectorAll('.seg').forEach(s => s.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      Ton.sfx('wahl');
      s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      const k = s.dataset.key, v = b.dataset.v;
      if (k === 'cc' || k === 'ki' || k === 'runden' || k === 'gesamt') Einst[k] = +v;
      if (k === 'teams') Einst.teams = v === '1';
      if (k === 'items') Einst.items = v;
      einstSpeichern();
    });
    // Standardwerte merken
    $('regelnInhalt').querySelectorAll('.seg').forEach(s => { const on = s.querySelector('.on') || s.querySelector('button'); on.classList.add('on'); const k = s.dataset.key; if (k === 'gesamt') Einst.gesamt = +on.dataset.v; });
    this.zeige('sRegeln');
  },
  teamsAn() { return (this.modus === 'vs' || this.modus === 'schlacht') && Einst.teams; },
  fahrerZeigen() {
    Wahl.start(this.anzahl, this.teamsAn());
    this.zeige('sFahrer');
  },
  // ---------- Strecke ----------
  streckeZeigen() {
    const m = this.modus;
    const box = $('streckeInhalt');
    const karte = (def, i, arena, extra) => `<button class="st" data-i="${i}"><img src="${StreckenBild.bild(def, arena)}" alt=""><span>${esc(def.name)}</span>${extra ? `<em>${extra}</em>` : ''}</button>`;
    if (m === 'gp') {
      $('streckeTitel').textContent = 'Wähle einen Cup';
      box.innerHTML = CUPS.map((c, ci) => `<div class="cupzeile"><img src="${Ikon.bild(c.symbol)}" alt=""><b>${c.name}</b><button class="btn haupt" data-cup="${ci}">Los!</button></div>
        <div class="strecken">${STRECKEN.map((s, i) => [s, i]).filter(([s]) => s.cup === ci).map(([s, i]) => karte(s, i, false)).join('')}</div>`).join('');
      box.querySelectorAll('[data-cup]').forEach(b => b.onclick = () => { Ton.sfx('ok'); this.gpStart(+b.dataset.cup); });
      box.querySelectorAll('.st').forEach(b => b.onclick = () => { Ton.sfx('ok'); this.gpStart(STRECKEN[+b.dataset.i].cup); });
    } else if (m === 'schlacht') {
      $('streckeTitel').textContent = 'Wähle eine Arena';
      box.innerHTML = `<div class="strecken" style="grid-template-columns:repeat(2,1fr);max-width:640px;margin:auto">${ARENEN.map((a, i) => karte(a, i, true)).join('')}</div>`;
      box.querySelectorAll('.st').forEach(b => b.onclick = () => { Ton.sfx('ok'); this.einzelStart(+b.dataset.i); });
    } else {
      $('streckeTitel').textContent = m === 'zeit' ? 'Zeitfahren: Strecke wählen' : 'Wähle eine Strecke';
      box.innerHTML = `<div class="strecken">${STRECKEN.map((s, i) => {
        let extra = '';
        if (m === 'zeit') { const r = Rekorde[s.id + '-' + Einst.cc]; extra = r ? '⏱ ' + fmtZeit(r.zeit) : ''; }
        return karte(s, i, false, extra);
      }).join('')}</div>` + (m === 'vs' ? '<button class="btn" id="zufallStrecke" style="max-width:260px;margin:10px auto 0">🎲 Zufällige Strecke</button>' : '');
      box.querySelectorAll('.st').forEach(b => b.onclick = () => { Ton.sfx('ok'); this.einzelStart(+b.dataset.i); });
      const z = $('zufallStrecke'); if (z) z.onclick = () => { Ton.sfx('ok'); this.einzelStart((Math.random() * STRECKEN.length) | 0); };
    }
    // Geschichte der Strecke unter den Karten anzeigen
    const story = $('streckeStory');
    const zeigeStory = def => { story.innerHTML = def && def.story ? `<b>${esc(def.name)}</b>${esc(def.story)}` : (m === 'schlacht' ? 'Platz die Ballons der anderen – wer am Ende die meisten Punkte hat, gewinnt.' : 'Zeig auf eine Strecke, um ihre Geschichte zu lesen.'); };
    zeigeStory(m === 'schlacht' ? null : STRECKEN[0]);
    box.querySelectorAll('.st').forEach(b => {
      const def = m === 'schlacht' ? null : STRECKEN[+b.dataset.i];
      b.addEventListener('mouseenter', () => zeigeStory(def));
      b.addEventListener('focus', () => zeigeStory(def));
    });
    this.zeige('sStrecke');
  },
  // ---------- Fahrerlisten ----------
  baueFahrer(gesamt, teams) {
    const liste = [];
    const belegt = new Set();
    this.wahl.forEach((w, i) => {
      liste.push({ id: 'p' + i, fi: w.fi, ki: w.ki, name: this.anzahl > 1 ? 'Spieler ' + (i + 1) : (HUB && HUB.getName()) || FIGUREN[w.fi].name, team: teams ? w.team : -1, typ: 'spieler', lokal: i });
      belegt.add(w.fi);
    });
    const frei = FIGUREN.map((f, i) => i).filter(i => !belegt.has(i)).sort(() => Math.random() - 0.5);
    let teamZ = [liste.filter(f => f.team === 0).length, liste.filter(f => f.team === 1).length];
    while (liste.length < gesamt) {
      const fi = frei.length ? frei.pop() : (Math.random() * FIGUREN.length) | 0;
      let team = -1;
      if (teams) { team = teamZ[0] <= teamZ[1] ? 0 : 1; teamZ[team]++; }
      liste.push({ id: 'b' + liste.length, fi, ki: (Math.random() * KARTS.length) | 0, name: FIGUREN[fi].name, team, typ: 'bot' });
    }
    return liste;
  },
  gpStart(cup) {
    const strecken = STRECKEN.map((s, i) => [s, i]).filter(([s]) => s.cup === cup).map(([, i]) => i);
    const fahrer = this.baueFahrer(Einst.gesamt || 8, false);
    this.gp = { cup, nr: 0, strecken, fahrer, punkte: Object.fromEntries(fahrer.map(f => [f.id, 0])) };
    this.gpRennen();
  },
  gpRennen() {
    const gp = this.gp;
    // Startaufstellung: im ersten Rennen stehen die Menschen hinten, danach nach Punkten
    let ord;
    if (gp.nr === 0) ord = [...gp.fahrer.filter(f => f.typ === 'bot'), ...gp.fahrer.filter(f => f.typ !== 'bot')];
    else ord = [...gp.fahrer].sort((a, b) => gp.punkte[b.id] - gp.punkte[a.id]);
    this.starteRennen({ modus: 'gp', strecke: gp.strecken[gp.nr], cc: Einst.cc, ki: Einst.ki, items: 'normal', teams: false, runden: 3, fahrer: ord.map(f => Object.assign({}, f)) });
  },
  einzelStart(strecke) {
    const m = this.modus;
    let fahrer;
    if (m === 'zeit') fahrer = this.baueFahrer(1, false);
    else fahrer = this.baueFahrer(Einst.gesamt || 8, this.teamsAn());
    if (m !== 'schlacht' && m !== 'zeit') fahrer = [...fahrer.filter(f => f.typ === 'bot'), ...fahrer.filter(f => f.typ !== 'bot')];
    this.letzteStrecke = strecke;
    this.starteRennen({
      modus: m, strecke, cc: m === 'schlacht' ? 100 : Einst.cc, ki: Einst.ki, items: m === 'zeit' ? 'normal' : (Einst.items || 'normal'),
      teams: this.teamsAn(), runden: m === 'vs' ? Einst.runden : 3, fahrer,
    });
  },
  // ---------- Rennen starten ----------
  starteRennen(cfg) {
    this.letzteCfg = cfg;
    const ub = $('uebergang');
    ub.classList.add('an');
    Ton.sfx('ok');
    setTimeout(() => {
      this.baueRennen(cfg);
      ub.classList.remove('an');
    }, 380);
  },
  baueRennen(cfg) {
    if (this.rennen) { this.rennen.entsorgen(); Anzeige.ende(); }
    cfg.qual = Anzeige.qual;
    const r = new Rennen(cfg, Anzeige.szene, cfg.demo ? null : Anzeige);
    if (cfg.netz) r.netzRid = Netz.rennId;
    this.rennen = r;
    Anzeige.starte(r);
    const n = cfg.demo ? 0 : r.lokale.length;
    Eingabe.lokal = Math.max(1, n);
    Eingabe.prev = [{}, {}, {}, {}];
    this.pausiert = false;
    if (cfg.modus === 'zeit') { const k = r.lokale[0]; k.item = 'nitro3'; k.anzahl = 3; }
    if (!cfg.demo) {
      this.zeige(null);
      Ton.motorStart(n);
      Ton.spieleMusik(r.welt.th.musik);
      Ton.tempo(1);
      this.fpsMessung = { t: 0, n: 0 };
    } else {
      Ton.motorStop();
    }
    r.onEnde = erg => this.rennEnde(erg);
  },
  demo() {
    const i = (Math.random() * STRECKEN.length) | 0;
    const fahrer = [];
    const fs = FIGUREN.map((f, k) => k).sort(() => Math.random() - 0.5).slice(0, 8);
    fs.forEach((fi, k) => fahrer.push({ fi, ki: k % KARTS.length, typ: 'bot', name: FIGUREN[fi].name }));
    this.baueRennen({ modus: 'vs', strecke: i, cc: 100, ki: 2, items: 'normal', runden: 99, fahrer, demo: true });
    Ton.spieleMusik({ seed: 4242, bpm: 140, root: 62, skala: 'dur', prog: [0, 5, 3, 4, 0, 5, 1, 4], stil: 'pop', lead: 'triangle' });
  },
  zumMenue() {
    Ton.motorStop();
    this.verlauf = [];
    this.online = false;
    this.demo();
    this.zeige('sTitel', false);
  },
  // ---------- Ende ----------
  rennEnde(erg) {
    Ton.tempo(1);
    if (window.LW) try { LW.rundeFertig(); } catch (e) { }
    if (this.online) { Netz.rennEnde(erg); return; }
    setTimeout(() => this.ergebnisZeigen(erg), 800);
  },
  ergebnisZeigen(erg, onlineInfo) {
    const r = this.rennen, m = r.modus;
    Ton.motorStop();
    const istGp = m === 'gp';
    const gp = istGp ? (onlineInfo && onlineInfo.gp) || this.gp : null;
    if (istGp && !onlineInfo) {
      erg.forEach(e => { const f = r.cfg.fahrer[e.idx]; gp.punkte[f.id] = (gp.punkte[f.id] || 0) + e.punkte; });
    }
    $('ergTitel').textContent = m === 'schlacht' ? 'Schlacht vorbei!' : m === 'zeit' ? (r.neuerRekord ? 'Neuer Rekord!' : 'Zeitfahren') : istGp ? `${CUPS[gp.cup].name} – Rennen ${gp.nr + 1}/4` : 'Ergebnis';
    let teamHtml = '';
    if (r.teams) {
      const sum = [0, 0];
      for (const e of erg) if (e.team >= 0) sum[e.team] += e.punkte;
      const sieg = sum[0] === sum[1] ? -1 : sum[0] > sum[1] ? 0 : 1;
      teamHtml = `<div class="teamstand"><div class="t0"><small>Team Rot${sieg === 0 ? ' gewinnt!' : ''}</small>${sum[0]}</div><div class="t1"><small>Team Blau${sieg === 1 ? ' gewinnt!' : ''}</small>${sum[1]}</div></div>`;
      if (sieg === -1) teamHtml += '<p class="sub">Unentschieden!</p>';
    }
    $('ergTeams').innerHTML = teamHtml;
    let rows = '';
    if (m === 'zeit') {
      const e = erg[0], k = r.karts[0];
      const rek = Rekorde[r.welt.def.id + '-' + r.cc];
      rows = `<tr><td>Gesamtzeit</td><td class="num"><b>${fmtZeit(e.zeit)}</b></td></tr>` +
        k.rundenZeiten.map((z, i) => `<tr><td>Runde ${i + 1}</td><td class="num">${fmtZeit(z)}</td></tr>`).join('') +
        (rek ? `<tr class="mensch"><td>Rekord (${CC[r.cc].name})</td><td class="num">${fmtZeit(rek.zeit)}</td></tr>` : '');
    } else if (istGp) {
      const liste = erg.map(e => { const f = r.cfg.fahrer[e.idx]; return { e, f, ges: gp.punkte[f.id] }; }).sort((a, b) => b.ges - a.ges || a.e.platz - b.e.platz);
      rows = liste.map((x, i) => `<tr class="${x.e.typ !== 'bot' ? 'mensch' : ''}"><td class="pl">${i + 1}</td><td><img src="${Portraet.bild(x.e.fi)}" alt=""> ${esc(x.e.name)}</td><td class="num">${x.e.platz}. Platz</td><td class="plus">+${x.e.punkte}</td><td class="num"><b>${x.ges}</b></td></tr>`).join('');
    } else {
      rows = erg.map(e => `<tr class="${e.typ !== 'bot' ? 'mensch' : ''} ${e.team >= 0 ? 't' + e.team : ''}"><td class="pl">${e.platz}</td><td><img src="${Portraet.bild(e.fi)}" alt=""> ${esc(e.name)}</td><td class="num">${m === 'schlacht' ? e.punkte + ' Punkte' : e.zeit !== null ? fmtZeit(e.zeit) : '–'}</td>${r.teams && m !== 'schlacht' ? `<td class="plus">+${e.punkte}</td>` : ''}</tr>`).join('');
    }
    $('ergTabelle').innerHTML = rows;
    $('ergBoard').innerHTML = '';
    const kn = $('ergKnoepfe');
    kn.innerHTML = '';
    const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'btn' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.sfx('ok'); fn(); }; kn.appendChild(b); return b; };
    if (onlineInfo) {
      if (onlineInfo.host) {
        if (istGp && gp.nr < 3) knopf('Nächstes Rennen', true, () => Netz.weiter());
        else if (istGp) knopf('Siegerehrung', true, () => Netz.weiter());
        else knopf('Zurück in den Raum', true, () => Netz.zurLobby());
      } else { const b = knopf('Warte auf den Gastgeber …', false, () => { }); b.disabled = true; }
      knopf('Raum verlassen', false, () => { Netz.verlassen(); this.zumMenue(); });
      if (HUB) { $('ergBoard').innerHTML = '<span class="lbl">Rangliste</span><div></div>'; Netz.boardEl = $('ergBoard').lastChild; HUB.loadBoard(GAME_ID, Netz.boardEl, HUB.getName()); }
    } else if (istGp) {
      if (gp.nr < 3) knopf('Nächstes Rennen', true, () => { gp.nr++; this.gpRennen(); });
      else knopf('Siegerehrung', true, () => this.siegerehrung());
      knopf('Aufgeben', false, () => this.zumMenue());
    } else {
      knopf('Nochmal', true, () => this.starteRennen(this.letzteCfg));
      knopf(m === 'schlacht' ? 'Andere Arena' : 'Andere Strecke', false, () => { this.verlauf = ['sTitel']; this.streckeZeigen(); });
      knopf('Menü', false, () => this.zumMenue());
    }
    this.zeige('sErgebnis', false);
    this.verlauf = [];
  },
  siegerehrung(onlineGp) {
    const gp = onlineGp || this.gp;
    const liste = [...gp.fahrer].sort((a, b) => gp.punkte[b.id] - gp.punkte[a.id]);
    const top = liste.slice(0, 3);
    const ord = [top[1], top[0], top[2]];
    $('podest').innerHTML = ord.map((f, i) => f ? `<div class="p${[2, 1, 3][i]}"><img src="${Portraet.bild(f.fi)}" alt=""><div>${esc(f.name)}</div><i>${[2, 1, 3][i]}</i></div>` : '').join('');
    const mensch = liste.findIndex(f => f.typ !== 'bot');
    $('siegerTitel').textContent = CUPS[gp.cup].name;
    $('pokal').textContent = mensch === 0 ? '🏆' : mensch === 1 ? '🥈' : mensch === 2 ? '🥉' : '🏁';
    const pokalName = ['Gold-Pokal', 'Silber-Pokal', 'Bronze-Pokal'][mensch];
    $('siegerText').textContent = mensch <= 2 ? `Glückwunsch! ${liste[mensch].name} gewinnt den ${pokalName} (${CC[this.rennen.cc].name}).` : 'Diesmal kein Pokal – versuch es nochmal!';
    Ton.sfx(mensch <= 2 ? 'ziel' : 'verloren');
    $('siegerNochmal').classList.toggle('hidden', !!onlineGp);
    this.zeige('sSieger', false);
  },
  // ---------- Pause ----------
  pauseUmschalten(an) {
    const r = this.rennen;
    if (!r || r.demo) return;
    if (an === undefined) an = !this.pausiert && this.screen !== 'sPause';
    if (an) {
      if (this.screen && this.screen !== 'sPause') return;
      this.pausiert = !this.online;
      $('pNeu').classList.toggle('hidden', this.online || r.modus === 'gp' && false);
      this.zeige('sPause', false);
      Ton.motorStop();
    } else {
      this.pausiert = false;
      this.zeige(null, false);
      Ton.motorStart(r.lokale.length);
    }
  },
  // ---------- Tastatur in Menüs ----------
  tasten() {
    addEventListener('keydown', e => {
      if (e.code === 'KeyM' && !this.imText()) { this.stumm(); return; }
      if (e.code === 'KeyF' && !this.imText() && !this.screen) { this.vollbild(); return; }
      if (!this.screen) {
        if ((e.code === 'Escape' || e.code === 'KeyP') && this.rennen && !this.rennen.demo && this.rennen.phase !== 'ende') { e.preventDefault(); this.pauseUmschalten(true); }
        return;
      }
      if (this.screen === 'sFahrer' && Wahl.taste(e)) { e.preventDefault(); return; }
      if (this.imText()) { if (e.code === 'Escape') document.activeElement.blur(); if (e.code === 'Enter' && document.activeElement.id === 'oCode') $('oBeitreten').click(); return; }
      if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        if (this.screen === 'sPause') this.pauseUmschalten(false);
        else if (this.screen === 'sTitel' || this.screen === 'sErgebnis' || this.screen === 'sSieger') { }
        else this.zurueck();
        return;
      }
      const richt = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
      if (richt) { e.preventDefault(); this.fokusBewegen(richt[0], richt[1]); return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        const a = document.activeElement;
        if (!a || a === document.body || !$(this.screen).contains(a)) { e.preventDefault(); this.fokusBewegen(0, 1); }
      }
    });
  },
  imText() { const a = document.activeElement; return a && (a.tagName === 'INPUT' && a.type === 'text'); },
  fokusBewegen(dx, dy) {
    const s = $(this.screen);
    const els = [...s.querySelectorAll('button:not(:disabled), input')].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const a = document.activeElement;
    if (!a || !s.contains(a)) { els[0].focus(); return; }
    // Schieberegler: links/rechts ändert den Wert
    if (a.type === 'range' && dx) { a.value = +a.value + dx * 0.05; a.dispatchEvent(new Event('input')); return; }
    const r0 = a.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bd = 1e9;
    for (const el of els) {
      if (el === a) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const ddx = x - cx, ddy = y - cy;
      const vor = dx ? ddx * dx : ddy * dy;
      if (vor <= 4) continue;
      const quer = dx ? Math.abs(ddy) : Math.abs(ddx);
      const d = vor + quer * 2.2;
      if (d < bd) { bd = d; best = el; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); Ton.sfx('wahl', 0.4); }
  },
  // Gamepad in Menüs
  padMenue() {
    const pads = Eingabe.pads();
    this.padVorher = this.padVorher || {};
    pads.forEach((p, pi) => {
      const b = k => p.buttons[k] && p.buttons[k].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const z = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, a: b(0), b: b(1), start: b(9) };
      const v = this.padVorher[pi] || {};
      const neu = k => z[k] && !v[k];
      this.padVorher[pi] = z;
      if (!this.screen) { if (neu('start') && this.rennen && !this.rennen.demo) this.pauseUmschalten(true); return; }
      if (this.screen === 'sFahrer') {
        const spieler = this.padSpieler(pi);
        if (spieler >= 0) {
          if (neu('up')) Wahl.aktion(spieler, 'hoch'); if (neu('down')) Wahl.aktion(spieler, 'runter');
          if (neu('left')) Wahl.aktion(spieler, 'links'); if (neu('right')) Wahl.aktion(spieler, 'rechts');
          if (neu('a')) Wahl.aktion(spieler, 'ok'); if (neu('b')) Wahl.aktion(spieler, 'abbruch');
        }
        return;
      }
      if (neu('up')) this.fokusBewegen(0, -1); if (neu('down')) this.fokusBewegen(0, 1);
      if (neu('left')) this.fokusBewegen(-1, 0); if (neu('right')) this.fokusBewegen(1, 0);
      if (neu('a')) { const a = document.activeElement; if (a && a.tagName === 'BUTTON') a.click(); else this.fokusBewegen(0, 1); }
      if (neu('b')) { if (this.screen === 'sPause') this.pauseUmschalten(false); else if (!['sTitel', 'sErgebnis', 'sSieger'].includes(this.screen)) this.zurueck(); }
      if (neu('start') && this.screen === 'sPause') this.pauseUmschalten(false);
    });
  },
  padSpieler(pi) {
    const n = this.anzahl;
    for (let i = 0; i < n; i++) { const p = Eingabe.padFuer(i, n); if (p && p.index === Eingabe.pads()[pi].index) return i; }
    return -1;
  },
  // ---------- Hauptschleife ----------
  frame(dt) {
    this.padMenue();
    const r = this.rennen;
    if (r) {
      if (!this.pausiert) r.update(dt);
      Anzeige.render(r, dt);
      if (!r.demo && Einst.qual === 'auto' && this.fpsMessung && r.phase === 'rennen') this.autoQualitaet(dt);
    }
    if (this.screen === 'sFahrer' || this.screen === 'sLobby') Vorschau.render(dt);
    if (this.screen === 'sFahrer') Wahl.frame(dt);
    Netz.frame(dt);
    Eingabe.endFrame();
  },
  autoQualitaet(dt) {
    const f = this.fpsMessung;
    f.t += dt; f.n++;
    if (f.t > 4) {
      const fps = f.n / f.t;
      f.t = 0; f.n = 0;
      if (fps < 38 && Anzeige.qual !== 'niedrig') {
        Anzeige.autoQual = Anzeige.qual === 'hoch' ? 'mittel' : 'niedrig';
        Anzeige.setzeQual(); this.schattenNeu();
        this.rennen.fx.skala(Anzeige.H * Anzeige.renderer.getPixelRatio() * 0.9);
      } else if (fps > 55) this.fpsMessung = null;
    }
  },
};

// ---------- Fahrerwahl ----------
const Wahl = {
  sp: [], n: 1, teams: false,
  init() {
    const g = $('fahrerGitter');
    g.innerHTML = FIGUREN.map((f, i) => `<button class="fz" data-f="${i}" style="--f1:${f.f1};--f2:${f.f2}"><img src="${Portraet.bild(i)}" alt=""><div class="mk"></div><div class="nm">${esc(f.name)}</div></button>`).join('');
    g.onclick = e => {
      const b = e.target.closest('.fz'); if (!b) return;
      const fi = +b.dataset.f;
      const s = this.sp.find(x => x.stufe === 0) || this.sp[0];
      s.cur = fi; this.aktion(this.sp.indexOf(s), 'ok', true);
    };
  },
  start(n, teams) {
    this.n = n; this.teams = teams;
    const alt = Einst.wahl || [];
    this.sp = [];
    for (let i = 0; i < n; i++) {
      const w = alt[i] || { f: i * 2, k: 0 };
      this.sp.push({ cur: w.f % FIGUREN.length, ki: w.k % KARTS.length, team: i % 2, stufe: 0 });
    }
    const box = $('spielerPanels');
    box.style.gridTemplateColumns = n > 2 ? '1fr 1fr' : n === 2 ? '1fr 1fr' : '1fr';
    Vorschau.plaetze = [];
    box.innerHTML = this.sp.map((s, i) => `<div class="sp" style="--pc:${SPIELER_FARBEN[i]}" data-s="${i}">
      <canvas width="340" height="260"></canvas>
      <div class="info"><div class="wer">${n > 1 ? 'Spieler ' + (i + 1) : 'Du'}</div><div class="nm"></div><div class="kl"></div>
      <div class="bars"></div>
      <div class="wahl kartwahl">${KARTS.map((k, ki) => `<button data-k="${ki}">${k.name}</button>`).join('')}</div>
      ${teams ? `<div class="wahl teamwahl"><button class="t0" data-t="0">Team Rot</button><button class="t1" data-t="1">Team Blau</button></div>` : ''}
      <div class="tasten">${this.tastenText(i)}</div></div><div class="bereit">BEREIT!</div></div>`).join('');
    box.querySelectorAll('.sp').forEach((el, i) => {
      Vorschau.plaetze.push({ canvas: el.querySelector('canvas'), fi: 0, ki: 0, team: -1 });
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { this.sp[i].ki = +b.dataset.k; if (this.sp[i].stufe === 0) this.sp[i].stufe = 1; Ton.sfx('wahl'); this.zeichne(); });
      el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { this.sp[i].team = +b.dataset.t; Ton.sfx('wahl'); this.zeichne(); });
    });
    this.zeichne();
  },
  tastenText(i) {
    if (this.n === 1) return 'Pfeile/WASD wählen · Enter/Leertaste bestätigen · Esc zurück';
    if (i === 0) return 'WASD wählen · E/Leertaste bestätigen · Q zurück';
    if (i === 1) return 'Pfeile wählen · Enter bestätigen · Rücktaste zurück';
    return 'Gamepad: Steuerkreuz wählen · A bestätigen · B zurück';
  },
  zeichne() {
    document.querySelectorAll('#fahrerGitter .fz').forEach((b, fi) => {
      b.className = 'fz';
      const mk = [];
      this.sp.forEach((s, i) => { if (s.cur === fi) { b.classList.add('c' + i); mk.push(`<i style="background:${SPIELER_FARBEN[i]}">${this.n > 1 ? 'S' + (i + 1) : 'Du'}</i>`); } });
      b.querySelector('.mk').innerHTML = mk.join('');
    });
    document.querySelectorAll('#spielerPanels .sp').forEach((el, i) => {
      const s = this.sp[i], f = FIGUREN[s.cur];
      el.classList.toggle('ok', s.stufe === 2);
      el.querySelector('.nm').textContent = f.name;
      el.querySelector('.kl').textContent = `${f.art} · ${f.klasse === 'leicht' ? 'Leichtgewicht' : f.klasse === 'schwer' ? 'Schwergewicht' : 'Mittelgewicht'} · ${KARTS[s.ki].name}`;
      const w = werte(s.cur, s.ki);
      const bar = (n, v) => `<span>${n}</span><i><b style="width:${clamp(v / 5.5, 0.05, 1) * 100}%"></b></i>`;
      el.querySelector('.bars').innerHTML = bar('Tempo', w.tempo) + bar('Beschleunigung', w.beschl) + bar('Handling', w.handling) + bar('Gewicht', w.gewicht) + bar('Gelände', 2.5 + w.gelaende * 2);
      el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', +b.dataset.k === s.ki));
      el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', +b.dataset.t === s.team));
      el.querySelector('.kartwahl').style.outline = s.stufe === 1 ? '2px dashed rgba(255,255,255,.4)' : 'none';
      el.querySelector('.kartwahl').style.borderRadius = '10px';
      const p = Vorschau.plaetze[i];
      p.fi = s.cur; p.ki = s.ki; p.team = this.teams ? s.team : -1; p.bereit = s.stufe === 2;
    });
  },
  spielerVonTaste(code) {
    if (this.n === 1) {
      const m = { ArrowUp: 'hoch', KeyW: 'hoch', ArrowDown: 'runter', KeyS: 'runter', ArrowLeft: 'links', KeyA: 'links', ArrowRight: 'rechts', KeyD: 'rechts', Enter: 'ok', Space: 'ok', KeyE: 'ok', Escape: 'abbruch', Backspace: 'abbruch', KeyQ: 'abbruch' }[code];
      return m ? [0, m] : null;
    }
    const p1 = { KeyW: 'hoch', KeyS: 'runter', KeyA: 'links', KeyD: 'rechts', KeyE: 'ok', Space: 'ok', ShiftLeft: 'ok', KeyQ: 'abbruch' }[code];
    if (p1) return [0, p1];
    const p2 = { ArrowUp: 'hoch', ArrowDown: 'runter', ArrowLeft: 'links', ArrowRight: 'rechts', Enter: 'ok', ShiftRight: 'ok', Backspace: 'abbruch' }[code];
    if (p2) return [1, p2];
    return null;
  },
  taste(e) {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && e.code === 'Enter' && document.activeElement.id === 'fahrerWeiter') return false;
    if (e.code === 'Escape') {
      if (this.sp.every(s => s.stufe === 0)) return false;
      this.sp.forEach(s => s.stufe = Math.max(0, s.stufe - 1)); Ton.sfx('zurueck'); this.zeichne(); return true;
    }
    const m = this.spielerVonTaste(e.code);
    if (!m) return false;
    if (e.repeat && m[1] === 'ok') return true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.aktion(m[0], m[1]);
    return true;
  },
  aktion(i, a, maus) {
    const s = this.sp[i];
    if (!s) return;
    if (s.stufe === 0) {
      const c = s.cur, cols = 6;
      if (a === 'links') s.cur = (c + FIGUREN.length - 1) % FIGUREN.length;
      if (a === 'rechts') s.cur = (c + 1) % FIGUREN.length;
      if (a === 'hoch') s.cur = (c + FIGUREN.length - cols) % FIGUREN.length;
      if (a === 'runter') s.cur = (c + cols) % FIGUREN.length;
      if (a === 'ok') {
        const belegt = this.sp.some((o, j) => j !== i && o.stufe > 0 && o.cur === s.cur);
        if (belegt) { Ton.sfx('zurueck'); return; }
        s.stufe = 1; Ton.sfx('ok');
      } else if (a === 'abbruch') { if (this.sp.every(x => x.stufe === 0)) { App.zurueck(); return; } }
      else Ton.sfx('wahl', 0.5);
    } else if (s.stufe === 1) {
      if (a === 'links') s.ki = (s.ki + KARTS.length - 1) % KARTS.length;
      if (a === 'rechts') s.ki = (s.ki + 1) % KARTS.length;
      if ((a === 'hoch' || a === 'runter') && this.teams) s.team = 1 - s.team;
      if (a === 'ok') { s.stufe = 2; Ton.sfx('ok'); }
      else if (a === 'abbruch') { s.stufe = 0; Ton.sfx('zurueck'); }
      else Ton.sfx('wahl', 0.5);
    } else {
      if (a === 'abbruch') { s.stufe = 1; Ton.sfx('zurueck'); }
      if (a === 'ok' && this.sp.every(x => x.stufe === 2)) this.fertig();
    }
    this.zeichne();
    if (this.sp.every(x => x.stufe === 2)) { clearTimeout(this.weiterT); this.weiterT = setTimeout(() => { if (App.screen === 'sFahrer' && this.sp.every(x => x.stufe === 2)) this.fertig(); }, 700); }
  },
  alleBereit() {
    const belegt = new Set();
    for (const s of this.sp) { while (belegt.has(s.cur)) s.cur = (s.cur + 1) % FIGUREN.length; belegt.add(s.cur); s.stufe = 2; }
    this.zeichne();
    this.fertig();
  },
  fertig() {
    clearTimeout(this.weiterT);
    if (App.screen !== 'sFahrer') return;
    App.wahl = this.sp.map(s => ({ fi: s.cur, ki: s.ki, team: s.team }));
    Einst.wahl = this.sp.map(s => ({ f: s.cur, k: s.ki }));
    einstSpeichern();
    Ton.sfx('ok');
    App.streckeZeigen();
  },
  frame(dt) { },
};

addEventListener('load', () => {
  try { App.init(); }
  catch (e) { console.error(e); $('laden').innerHTML = '<div>Leider konnte das Spiel nicht starten.</div><div style="font:14px system-ui;opacity:.7">' + esc(e.message) + '</div>'; }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && App.rennen && !App.rennen.demo && !App.online && !App.screen) App.pauseUmschalten(true);
});
