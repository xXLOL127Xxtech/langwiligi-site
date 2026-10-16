// Golf-Tour – Spielablauf: Modi (Solo, abwechselnd, Splitscreen, Online), Bahnen laden, Ereignisse, Partikel, Rendering
'use strict';

// ---------- Partikel (Sand, Wasser, Blätter, Konfetti) ----------
class Partikel {
  constructor() {
    this.pool = []; this.szene = null;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    this.tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 220; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
      sp.visible = false;
      this.pool.push({ sp, v: new THREE.Vector3(), t: 0, dauer: 1, g: 9.8, s: 0.1, aktiv: false });
    }
  }
  inSzene(szene) { this.szene = szene; for (const p of this.pool) { p.aktiv = false; p.sp.visible = false; szene.add(p.sp); } }
  los(pos, n, farben, o = {}) {
    let k = 0;
    for (const p of this.pool) {
      if (p.aktiv) continue;
      if (k++ >= n) break;
      p.aktiv = true; p.t = 0; p.dauer = (o.dauer || 1) * (0.6 + Math.random() * 0.8);
      p.sp.visible = true;
      p.sp.position.set(pos.x + (Math.random() - 0.5) * (o.streu || 0.2), pos.y + (o.hoch || 0), pos.z + (Math.random() - 0.5) * (o.streu || 0.2));
      const a = Math.random() * TAU, sp = (o.tempo || 2) * (0.4 + Math.random() * 0.8);
      p.v.set(Math.cos(a) * sp * (o.flach || 1), (o.auf || 3) * (0.5 + Math.random()), Math.sin(a) * sp * (o.flach || 1));
      p.g = o.g == null ? 9.8 : o.g;
      p.s = (o.gr || 0.12) * (0.6 + Math.random() * 0.8);
      p.sp.material.color.set(farben[Math.floor(Math.random() * farben.length)]);
      p.sp.material.opacity = 1;
      p.sp.material.blending = o.leucht ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.aktiv) continue;
      p.t += dt;
      if (p.t >= p.dauer) { p.aktiv = false; p.sp.visible = false; continue; }
      p.v.y -= p.g * dt; p.v.multiplyScalar(Math.exp(-dt * 1.2));
      p.sp.position.addScaledVector(p.v, dt);
      const q = p.t / p.dauer;
      p.sp.material.opacity = 1 - q * q;
      const s = p.s * (1 + q * 0.8);
      p.sp.scale.set(s, s, 1);
    }
  }
}

// ---------- Ansicht: Kamera + HUD für einen Bildschirmbereich ----------
class Ansicht {
  constructor(i, n, sp, tastenText) {
    this.i = i; this.n = n; this.sp = sp;
    this.kamera = new Kamera();
    this.root = document.createElement('div');
    this.root.className = 'ansicht';
    $('hudBox').appendChild(this.root);
    this.anz = new Anzeige(this.root, n > 1, tastenText);
    this.maus = { dx: 0 };
    this.lage();
  }
  lage() {
    const W = innerWidth, H = innerHeight;
    this.rect = this.n === 1 ? { x: 0, y: 0, w: W, h: H } : { x: this.i * Math.floor(W / 2), y: 0, w: Math.floor(W / 2), h: H };
    Object.assign(this.root.style, { left: this.rect.x + 'px', top: '0px', width: this.rect.w + 'px', height: this.rect.h + 'px' });
  }
  layers(einzeln) {
    const l = this.kamera.cam.layers;
    l.set(0);
    if (einzeln) { l.enable(1); l.enable(2); } else l.enable(this.i + 1);
  }
  weg() { this.root.remove(); }
}

const App = {
  renderer: null, uhr: null, zeit: 0, partikel: null,
  modus: null, plan: null, nr: 0, kurs: null, welt: null, seed: 0,
  spieler: [], geister: [], ansichten: [], aktiv: 0,
  zustand: 'menue', pausiert: false, online: false,
  wechselT: 0, endeT: 0, sendT: 0,

  init() {
    const r = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = Einst.grafik !== 'niedrig';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.groesse();
    Tex.init(r);
    BallGrafik.init();
    schlaegerWeitenRechnen();
    this.partikel = new Partikel();
    this.uhr = new THREE.Clock();
    Eingabe.init();
    addEventListener('resize', () => this.groesse());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.zustand === 'spiel' && !this.online) Menue.pause(true); });
    this.zeiger();
    this.hintergrund();
    requestAnimationFrame(() => this.frame());
  },
  groesse() {
    const pr = Einst.grafik === 'hoch' ? Math.min(2, devicePixelRatio || 1) : Einst.grafik === 'mittel' ? Math.min(1.25, devicePixelRatio || 1) : 0.85;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    for (const a of this.ansichten) a.lage();
  },
  // Zeiger: Ziehen = zielen, Mausrad/Zwei-Finger-Scrollen = Zoom
  zeiger() {
    const c = $('c');
    let zieh = null;
    const ansichtBei = x => this.ansichten.find(a => x >= a.rect.x && x < a.rect.x + a.rect.w) || this.ansichten[0];
    c.addEventListener('pointerdown', ev => {
      Ton.init();
      if (this.introLaeuft()) { this.introUeberspringen(); return; }
      zieh = { x: ev.clientX, a: ansichtBei(ev.clientX), id: ev.pointerId };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', ev => {
      if (!zieh || zieh.id !== ev.pointerId) return;
      zieh.a.maus.dx += ev.clientX - zieh.x; zieh.x = ev.clientX;
    });
    const ende = () => { zieh = null; };
    c.addEventListener('pointerup', ende); c.addEventListener('pointercancel', ende);
    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      const a = ansichtBei(ev.clientX);
      if (a) a.kamera.zoom = clamp(a.kamera.zoom * Math.exp(ev.deltaY * 0.0012), 0.45, 2.6);
    }, { passive: false });
  },

  // Hintergrund für das Menü: eine zufällige Bahn mit Kamerafahrt
  hintergrund() {
    const seed = (Math.random() * 1e9) >>> 0;
    const plan = rundePlanen(seed);
    const p = plan[0];
    this.planMenue = plan;
    this.ladeWelt(new Kurs(p.seed, 0, p.thema, p.par));
    this.menueKam = new Kamera();
    this.menueKam.modus = 'orbit';
    this.menueKam.cam.layers.set(0);
  },
  ladeWelt(kurs) {
    if (this.welt) {
      for (const s of this.spieler) s.verlassen(this.welt);
      for (const g of this.geister) g.verlassen(this.welt);
      this.welt.entsorgen();
    }
    this.renderer.shadowMap.enabled = Einst.grafik !== 'niedrig';
    this.kurs = kurs;
    this.welt = new Welt(kurs, this.renderer);
    this.renderer.toneMappingExposure = kurs.thema.belichtung;
    this.partikel.inSzene(this.welt.szene);
    Ton.wind(kurs.windStaerke);
  },

  // ---------- Runde starten ----------
  // modus: 'solo' | 'abw' | 'split' | 'online'; o: { seed, namen, liste (online), ich }
  starten(modus, o = {}) {
    this.modus = modus; this.online = modus === 'online';
    this.seed = o.seed != null ? o.seed : (Math.random() * 1e9) >>> 0;
    this.plan = rundePlanen(this.seed);
    for (const a of this.ansichten) a.weg();
    this.ansichten = [];
    if (this.welt) { for (const s of this.spieler) s.verlassen(this.welt); for (const g of this.geister) g.verlassen(this.welt); }
    this.spieler = []; this.geister = [];
    const namen = o.namen || ['Spieler 1', 'Spieler 2'];
    const tA = '<span class="taste">Leertaste</span> halten zum Schlagen · <span class="taste">A</span><span class="taste">D</span> zielen · <span class="taste">W</span><span class="taste">S</span> Schläger · <span class="taste">C</span> Übersicht';
    const tB = '<span class="taste">Enter</span> halten zum Schlagen · <span class="taste">←</span><span class="taste">→</span> zielen · <span class="taste">↑</span><span class="taste">↓</span> Schläger · <span class="taste">-</span> Übersicht';
    const tAlle = '<span class="taste">Leertaste</span> halten, loslassen = Schlag · <span class="taste">←</span><span class="taste">→</span> zielen · <span class="taste">↑</span><span class="taste">↓</span> Schläger · <span class="taste">C</span> Übersicht';
    if (modus === 'solo') {
      this.spieler.push(new Spieler(0, namen[0], FARBEN[0], ['a', 'b']));
      this.ansichten.push(new Ansicht(0, 1, this.spieler[0], tAlle));
    } else if (modus === 'abw') {
      this.spieler.push(new Spieler(0, namen[0], FARBEN[0], ['a', 'b']), new Spieler(1, namen[1], FARBEN[1], ['a', 'b']));
      this.ansichten.push(new Ansicht(0, 1, this.spieler[0], tAlle));
    } else if (modus === 'split') {
      this.spieler.push(new Spieler(0, namen[0], FARBEN[0], ['a']), new Spieler(1, namen[1], FARBEN[1], ['b']));
      this.ansichten.push(new Ansicht(0, 2, this.spieler[0], tA), new Ansicht(1, 2, this.spieler[1], tB));
    } else if (modus === 'online') {
      const ich = o.ich;
      for (const p of o.liste) {
        if (p.idx === ich) this.spieler.push(new Spieler(p.idx, p.name, FARBEN[p.idx % 8], ['a', 'b']));
        else this.geister.push(new Geist(p.idx, p.name, FARBEN[p.idx % 8]));
      }
      this.ansichten.push(new Ansicht(0, 1, this.spieler[0], tAlle));
    }
    this.ansichten.forEach(a => a.layers(this.ansichten.length === 1));
    for (const a of this.ansichten) {
      const sp = () => a.sp;
      a.anz.verbinden({
        schl: d => { const s = sp(); if (this.darfSteuern(s) && s.zustand === 'zielen') { s.schl = clamp(s.schl + d, 0, SCHLAEGER.length - 1); Ton.sfx('klick'); } },
        kraft: an => { const s = sp(); if (!s) return; s.virt = s.virt || {}; if (an && !s.virt.kraft) s.virt.druck = true; s.virt.kraft = an; },
        drall: (x, y) => { const s = sp(); if (this.darfSteuern(s) && s.zustand === 'zielen' && !SCHLAEGER[s.schl].putter) { s.drall.x = x; s.drall.y = y; Ton.sfx('klick'); } },
      });
    }
    this.aktiv = 0;
    Eingabe.aktiv = true;
    this.bahnLaden(0);
  },
  darfSteuern(sp) {
    if (!sp || this.zustand !== 'spiel' || this.pausiert && !this.online) return false;
    if (this.modus === 'abw') return this.spieler[this.aktiv] === sp;
    return true;
  },
  bahnLaden(nr) {
    this.nr = nr;
    this.zustand = 'laden';
    Menue.zeige(null);
    const p = this.plan[nr];
    $('laden').classList.remove('hidden');
    $('ladenText').textContent = `Bahn ${nr + 1} von 8 · ${p.thema.name}`;
    setTimeout(() => {
      const kurs = new Kurs(p.seed, nr, p.thema, p.par);
      this.ladeWelt(kurs);
      this.spieler.forEach((s, i) => s.aufBahn(kurs, this.welt, this.modus === 'split' ? i + 1 : 1 + (i % 2)));
      for (const g of this.geister) g.aufBahn(kurs, this.welt);
      if (this.modus === 'abw') {
        this.aktiv = 0;
        this.spieler.forEach((s, i) => { if (i !== 0) s.zustand = 'warten'; });
        this.ansichten[0].sp = this.spieler[0];
      }
      for (const a of this.ansichten) {
        a.anz.karteBauen(kurs, this.welt);
        a.kamera.intro = { t: 0, dauer: 4.2 };
        a.kamera.ueber = false; a.kamera.modus = 'ziel';
        a.kamera.springen = true;
      }
      $('laden').classList.add('hidden');
      this.zustand = 'spiel';
      Eingabe.aktiv = true;
      $('hudBox').classList.remove('hidden');
      for (const a of this.ansichten) a.anz.hinweis('');
      this.titelKarte(kurs);
      this.alleFertigT = 0;
    }, 40);
  },
  titelKarte(kurs) {
    const el = $('bahnTitel');
    el.innerHTML = `<small>Bahn ${kurs.nr + 1} von 8</small><b>${esc(kurs.thema.name)}</b><span>Par ${kurs.par} · ${Math.round(kurs.laenge)} m · Wind ${kurs.windStaerke.toFixed(1)} m/s</span><em>${esc(kurs.thema.ort)}</em>`;
    el.classList.remove('an'); void el.offsetWidth; el.classList.add('an');
  },
  introLaeuft() { return this.zustand === 'spiel' && this.ansichten.some(a => a.kamera.intro); },
  introUeberspringen() {
    for (const a of this.ansichten) { a.kamera.intro = null; a.kamera.springen = true; }
    $('bahnTitel').classList.remove('an');
  },

  // ---------- Ereignisse eines Balls ----------
  ereignisse(sp, ans) {
    const b = sp.ball, T = this.kurs.thema;
    for (const ev of b.ereignisse) {
      switch (ev.typ) {
        case 'aufprall': {
          if (ev.u === U.SAND) { Ton.sfx('sand'); this.partikel.los(b.p, 14, [T.f.sand, '#ffffff'], { tempo: 1.4, auf: 2.2, gr: 0.18, dauer: 0.9 }); }
          else if (ev.u === U.EIS) Ton.sfx('eis');
          else {
            Ton.sfx('aufprall', ev.st);
            if (ev.st > 4) this.partikel.los(b.p, T.id === 'winter' && ev.u === U.ROUGH ? 10 : 5, T.id === 'winter' && ev.u === U.ROUGH ? ['#ffffff'] : [T.f.fairway, T.f.rough], { tempo: 0.8, auf: 1.5, gr: 0.08, dauer: 0.6 });
          }
          break;
        }
        case 'stoss': Ton.sfx(ev.art === 'stein' || ev.art === 'schnee' ? 'stein' : 'holz'); break;
        case 'blaetter': Ton.sfx('blaetter'); this.partikel.los(b.p, 10, ['#3f7a2a', '#6b9a34', '#d9822b'], { tempo: 1.5, auf: 0.5, g: 2.5, gr: 0.15, dauer: 1.6 }); break;
        case 'fahne': Ton.sfx('fahne'); break;
        case 'lippe': Ton.sfx('lippe'); break;
        case 'loch': this.eingelocht(sp, ans); break;
        case 'gefahr': {
          const lava = ev.u === U.LAVA;
          Ton.sfx(lava ? 'zisch' : 'platsch');
          this.partikel.los(b.p, 26, lava ? ['#ff6a1a', '#ffb02a', '#ff3a0a'] : ['#ffffff', '#cfefff'], { tempo: 1.6, auf: 4, gr: 0.22, dauer: 1, leucht: lava });
          this.strafe(sp, ans, lava ? 'Lava!' : 'Wasser!');
          break;
        }
        case 'aus': Ton.sfx('aus'); this.strafe(sp, ans, 'Aus!'); break;
        case 'ruhe': this.inRuhe(sp, ans); break;
      }
    }
    b.ereignisse.length = 0;
  },
  strafe(sp, ans, titel) {
    sp.schlaege += 1;
    sp.zustand = 'strafe'; sp.strafeT = 1.8;
    ans.anz.meldung(titel, '+1 Strafschlag · zurück zur letzten Lage', '#ff8a6a', 2);
    this.netzSchlag(sp);
  },
  inRuhe(sp, ans) {
    const typ = sp.lage();
    if (this.kurs.param(typ).gefahr) { Ton.sfx('platsch'); this.strafe(sp, ans, 'Wasser!'); return; }
    if (sp.schlaege >= MAX_SCHLAEGE) { this.aufheben(sp, ans); return; }
    sp.autoWahl();
    const d = sp.lochDist();
    if (d < 0.6 && d > 0.08 && SCHLAEGER[sp.schl].putter && sp.letzteKraft != null) ans.anz.meldung('Knapp!', d.toFixed(2) + ' m zum Loch', '#ffffff', 1.3);
    this.netzPos(sp, true);
    if (this.modus === 'abw') { sp.zustand = 'warten'; this.wechselT = 1.1; }
    else sp.zustand = 'zielen';
  },
  eingelocht(sp, ans) {
    sp.karte[this.nr] = sp.schlaege;
    sp.fertig = true; sp.zustand = 'fertig';
    const name = scoreName(sp.schlaege, this.kurs.par), d = sp.schlaege - this.kurs.par;
    const farb = sp.schlaege === 1 || d <= -2 ? '#ffd23a' : d === -1 ? '#7ee07e' : d === 0 ? '#ffffff' : '#ffb0a0';
    const text = this.modus === 'solo' || this.modus === 'online' ? name : sp.name + ': ' + name;
    ans.anz.meldung(text, `${sp.schlaege} ${sp.schlaege === 1 ? 'Schlag' : 'Schläge'} · Par ${this.kurs.par}`, farb, 3.2);
    Ton.sfx('loch');
    setTimeout(() => Ton.sfx('jubel', d < 0 || sp.schlaege === 1 ? 1 : 0.4), 350);
    if (d < 0 || sp.schlaege === 1) setTimeout(() => Ton.sfx('fanfare'), 500);
    const L = this.kurs.loch;
    this.partikel.los({ x: L.x, y: L.y + 0.2, z: L.z }, d < 0 ? 60 : 24, ['#ffd23a', '#ff5a7a', '#4f8ff7', '#43c463', '#ffffff'], { tempo: 2.2, auf: 5.5, g: 6, gr: 0.09, dauer: 2.2, streu: 0.1 });
    if (this.online) Netz.fertig(sp);
    if (this.modus === 'abw') this.wechselT = 1.4;
  },
  aufheben(sp, ans) {
    sp.schlaege = MAX_SCHLAEGE;
    sp.karte[this.nr] = MAX_SCHLAEGE;
    sp.fertig = true; sp.zustand = 'fertig';
    sp.ball.zustand = 'loch'; sp.ball.lochFall = 1;
    ans.anz.meldung('Aufgehoben', `Maximal ${MAX_SCHLAEGE} Schläge pro Bahn`, '#ffb0a0', 2.5);
    if (this.online) Netz.fertig(sp);
    if (this.modus === 'abw') this.wechselT = 1.2;
  },
  // Abwechselnd: nächster Spieler, der noch nicht eingelocht hat
  naechster() {
    const n = this.spieler.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.aktiv + k) % n, s = this.spieler[i];
      if (!s.fertig) {
        const wechsel = i !== this.aktiv;
        this.aktiv = i;
        s.zustand = 'zielen';
        s.autoWahl();
        const a = this.ansichten[0];
        a.sp = s; a.kamera.ueber = false;
        if (wechsel) a.anz.meldung(s.name + ' ist dran', `Schlag ${s.schlaege + 1} · ${Math.round(s.lochDist())} m zur Fahne`, s.farbe, 1.6);
        return;
      }
    }
  },
  alleFertig() {
    if (!this.spieler.every(s => s.fertig)) return false;
    if (this.online) return false;
    return true;
  },
  lochEnde() {
    this.zustand = 'zwischen';
    const letzte = this.nr >= 7;
    if (letzte) return this.rundeEnde();
    Menue.zwischen(this.nr);
  },
  naechsteBahn() { if (this.nr < 7) this.bahnLaden(this.nr + 1); },
  rundeEnde(alle) {
    this.zustand = 'ende';
    Eingabe.aktiv = false;
    const liste = (alle || this.spieler.concat(this.geister)).slice();
    Menue.ende(liste);
    try { if (window.LW) LW.rundeFertig(); } catch (e) { }
  },
  zumMenue() {
    if (this.online) Netz.verlassen();
    this.zustand = 'menue'; this.pausiert = false; Eingabe.aktiv = false;
    for (const a of this.ansichten) a.weg();
    if (this.welt) { for (const s of this.spieler) s.verlassen(this.welt); for (const g of this.geister) g.verlassen(this.welt); }
    this.ansichten = []; this.spieler = []; this.geister = [];
    this.hintergrund();
    Menue.zeige('sTitel');
  },

  // ---------- Online-Abgleich ----------
  netzPos(sp, sofort) {
    if (!this.online) return;
    const now = this.zeit;
    if (!sofort && now - this.sendT < 0.1) return;
    this.sendT = now;
    Netz.sende({ t: 'pos', n: this.nr, x: +sp.ball.p.x.toFixed(2), y: +sp.ball.p.y.toFixed(2), z: +sp.ball.p.z.toFixed(2), s: sp.schlaege, f: sp.ball.zustand === 'flug' ? 1 : 0 });
  },
  netzSchlag(sp) { if (this.online) Netz.sende({ t: 'schlag', n: this.nr, s: sp.schlaege }); },

  // ---------- Hauptschleife ----------
  frame() {
    requestAnimationFrame(() => this.frame());
    const dt = Math.min(0.05, this.uhr.getDelta());
    this.zeit += dt;
    try { this.schritt(dt); } catch (e) { console.error(e); }
    try { this.zeichnen(dt); } catch (e) { console.error(e); }
    Eingabe.endFrame();
  },
  schritt(dt) {
    if (Eingabe.hit.has('Escape') && (this.zustand === 'spiel' || this.pausiert)) Menue.pause(!this.pausiert);
    if (Eingabe.hit.has('KeyM')) { Einst.stumm = !Einst.stumm; Ton.lautstaerke(); einstSpeichern(); Menue.tonKnopf(); }
    if (this.welt) this.welt.update(dt, this.zeit);
    this.partikel.update(dt);
    if (this.zustand !== 'spiel') return;
    if (this.pausiert && !this.online) return;
    if (this.introLaeuft()) {
      if (Eingabe.hit.size && !Eingabe.hit.has('Escape')) this.introUeberspringen();
      for (const a of this.ansichten) a.maus.dx = 0;
      return;
    }
    // Abwechselnd: Spielerwechsel nach kurzer Pause
    if (this.modus === 'abw' && this.wechselT > 0) { this.wechselT -= dt; if (this.wechselT <= 0) this.naechster(); }
    for (const a of this.ansichten) {
      const sp = a.sp;
      const darf = this.darfSteuern(sp) && !this.pausiert;
      let e = darf ? Eingabe.lies(sp.blocks) : Eingabe.lies([]);
      if (darf && sp.virt) { e.kraft = e.kraft || sp.virt.kraft; e.kraftDruck = e.kraftDruck || sp.virt.druck; sp.virt.druck = false; }
      if (e.kamera && (sp.zustand === 'zielen' || sp.zustand === 'laden')) a.kamera.ueber = !a.kamera.ueber;
      if (sp.zustand === 'zielen' || sp.zustand === 'laden') {
        const vorher = sp.zustand;
        const res = sp.steuern(e, dt, darf ? a.maus : null);
        if (vorher === 'zielen' && sp.zustand === 'laden') Ton.sfx('klick');
        if (res) { a.kamera.ueber = false; this.netzSchlag(sp); }
      }
      a.maus.dx = 0;
      if (sp.zustand === 'unterwegs') {
        const tempo = (e.kraft && darf) ? 3 : 1;
        sp.ball.update(dt * tempo);
        if (sp.ball.zustand === 'flug' || sp.ball.zustand === 'rollen') { sp.spurT = (sp.spurT || 0) + dt * tempo; if (sp.spurT > 0.04) { sp.spurT = 0; sp.spur.punkt(sp.ball.p); } }
        this.netzPos(sp, false);
        this.ereignisse(sp, a);
      } else if (sp.zustand === 'strafe') {
        sp.strafeT -= dt;
        if (sp.strafeT <= 0) {
          if (sp.schlaege >= MAX_SCHLAEGE) this.aufheben(sp, a);
          else { sp.zuruecklegen(); this.netzPos(sp, true); if (this.modus === 'abw') { sp.zustand = 'warten'; this.wechselT = 0.4; } }
        }
      }
      // Spur langsam ausblenden
      if (sp.spur && sp.zustand !== 'unterwegs') sp.spur.mat.opacity = Math.max(0, sp.spur.mat.opacity - dt * 0.4);
      else if (sp.spur) sp.spur.mat.opacity = 0.65;
    }
    for (const g of this.geister) g.update(dt);
    // Alle eingelocht?
    if (this.alleFertig()) {
      this.alleFertigT += dt;
      if (this.alleFertigT > 3) this.lochEnde();
    }
  },
  zeichnen(dt) {
    const r = this.renderer, W = innerWidth, H = innerHeight;
    if (!this.welt) return;
    if (this.zustand === 'menue' || !this.ansichten.length) {
      const k = this.menueKam;
      k.update(dt, null, this.kurs);
      k.cam.aspect = W / H; k.cam.updateProjectionMatrix();
      this.welt.schattenZiel(k.blick.x, k.blick.y, k.blick.z);
      r.setScissorTest(false);
      r.setViewport(0, 0, W, H);
      r.render(this.welt.szene, k.cam);
      return;
    }
    r.setScissorTest(this.ansichten.length > 1);
    for (const a of this.ansichten) {
      const sp = a.sp, k = a.kamera;
      const vorschauAn = sp && (sp.zustand === 'zielen' || sp.zustand === 'laden') && !k.intro && this.zustand === 'spiel' && (this.modus !== 'abw' || this.spieler[this.aktiv] === sp);
      const lande = vorschauAn && sp.vorschau.erg && !SCHLAEGER[sp.schl].putter ? sp.vorschau.erg.lande : null;
      k.update(dt, sp, this.kurs, { lande });
      // Vorschau für den Spieler dieser Ansicht
      for (const s of this.spieler) {
        if (!s.vorschau) continue;
        if (s === sp) { if (vorschauAn) s.vorschau.zeigen(this.kurs, s, k.cam.position, this.zeit); else s.vorschau.verstecken(); }
        else if (this.ansichten.length === 1) s.vorschau.verstecken();
      }
      for (const s of this.spieler) s.grafikUpdate(k.cam.position, dt / this.ansichten.length);
      for (const g of this.geister) g.grafikUpdate(k.cam.position);
      k.cam.aspect = a.rect.w / a.rect.h; k.cam.updateProjectionMatrix();
      this.welt.schattenZiel(k.blick.x, k.blick.y, k.blick.z);
      const y = H - a.rect.y - a.rect.h;
      r.setViewport(a.rect.x, y, a.rect.w, a.rect.h);
      r.setScissor(a.rect.x, y, a.rect.w, a.rect.h);
      r.render(this.welt.szene, k.cam);
      // HUD
      const andere = this.spieler.filter(s => s !== sp).map(s => ({ pos: s.ball.p, farbe: s.farbe, name: s.name, fertig: s.fertig }))
        .concat(this.geister.filter(g => !g.weg && !g.fertig).map(g => ({ pos: g.pos, farbe: g.farbe, name: g.name })));
      a.anz.update(dt, { sp, kurs: this.kurs, nr: this.nr, kam: k, vorschau: sp && sp.vorschau, andere, warten: this.modus === 'abw' && this.spieler[this.aktiv] !== sp });
      a.anz.karteZeichnen(this.kurs, sp, andere.filter(o => !o.fertig), lande);
      a.anz.markenStart();
      if (!k.intro) {
        const L = this.kurs.loch;
        const d = sp && sp.ball ? Math.hypot(L.x - sp.ball.p.x, L.z - sp.ball.p.z) : 0;
        if (d > 4) a.anz.marke('fahne', `⚑ ${d < 100 ? d.toFixed(0) : Math.round(d)} m`, { x: L.x, y: L.y + PH.H_FAHNE + 0.3, z: L.z }, k.cam, a.rect.w, a.rect.h, '#ff3b2f');
        for (const o of andere) {
          if (!o.pos || o.fertig) continue;
          a.anz.marke('n' + o.name, esc(o.name), { x: o.pos.x, y: o.pos.y + 0.25, z: o.pos.z }, k.cam, a.rect.w, a.rect.h, o.farbe);
        }
      }
      a.anz.markenEnde();
    }
    r.setScissorTest(false);
  },
};
