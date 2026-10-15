// Turbo-Kart – Grafik: Renderer, Kameras, geteilter Bildschirm, HUD und Minikarte
'use strict';

class Kamera {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(72, 1, 0.3, 2600);
    this.yaw = 0; this.pos = new THREE.Vector3(); this.blick = new THREE.Vector3();
    this.wackel = 0; this.fovPlus = 0; this.init = false; this.zielModus = 0;
  }
  folge(k, dt, rueck, r) {
    const fertigSicht = k.fertig && !r.welt.istArena;
    let yawZiel = k.yaw + k.driftVis * 0.45;
    if (k.raketeT > 0) yawZiel = k.yaw;
    if (!this.init) { this.yaw = yawZiel; }
    this.yaw = wrapA(this.yaw + wrapA(yawZiel - this.yaw) * (1 - Math.exp(-(k.treffer ? 2 : 6.5) * dt)));
    const boost = k.boostT > 0 || k.raketeT > 0 ? 1 : 0;
    const groesse = k.raketeT > 0 ? 1.7 : k.kleinT > 0 ? 0.75 : 1;
    let dist = (5.4 + boost * 0.7) * groesse, hoch = 2.35 * groesse;
    let yaw = this.yaw + (rueck ? Math.PI : 0);
    if (fertigSicht) { this.zielModus = Math.min(1, this.zielModus + dt * 0.5); yaw += smooth(this.zielModus) * (Math.PI * 0.85); dist += this.zielModus * 1.5; }
    else this.zielModus = 0;
    const tx = k.pos.x - Math.sin(yaw) * dist, tz = k.pos.z - Math.cos(yaw) * dist;
    const ty = k.pos.y + hoch;
    if (!this.init) { this.pos.set(tx, ty, tz); this.init = true; }
    this.pos.x = damp(this.pos.x, tx, 14, dt); this.pos.z = damp(this.pos.z, tz, 14, dt);
    this.pos.y = damp(this.pos.y, ty, k.luft ? 4 : 9, dt);
    // Nicht in den Boden
    const w = r.welt;
    if (!w.istArena && this.P) {
      w.proj(this.P, this.pos.x, this.pos.y, this.pos.z);
      if (Math.abs(this.P.d) < this.P.lim + 2 && this.pos.y < this.P.bodenY + 1.2) this.pos.y = this.P.bodenY + 1.2;
    } else this.P = {};
    this.blick.set(k.pos.x + Math.sin(yaw) * 3, k.pos.y + 1.25 * groesse, k.pos.z + Math.cos(yaw) * 3);
    const c = this.cam;
    c.position.copy(this.pos);
    if (this.wackel > 0) {
      this.wackel = Math.max(0, this.wackel - dt * 2.2);
      const a = this.wackel * 0.5;
      c.position.x += (Math.random() - 0.5) * a; c.position.y += (Math.random() - 0.5) * a;
    }
    c.lookAt(this.blick);
    this.fovPlus = damp(this.fovPlus, boost * 9 + clamp((Math.abs(k.v) - 20) / 15, 0, 1) * 4, 4, dt);
    c.fov = 68 + this.fovPlus;
    c.updateProjectionMatrix();
  }
  intro(r, t) {
    const w = r.welt;
    let p, z;
    if (w.istArena) {
      const a = t * 0.35;
      p = new THREE.Vector3(Math.sin(a) * w.gr * 1.1, 26 - t * 3, Math.cos(a) * w.gr * 1.1);
      z = new THREE.Vector3(0, 0, 0);
    } else {
      const f = clamp(t / 3.2, 0, 1);
      const s = w.startS + lerp(150, 25, smooth(f));
      p = w.punkt(s, 0).clone(); p.y += lerp(34, 10, smooth(f));
      const seite = w.S[w.idx(s)].rh;
      p.addScaledVector(seite, lerp(8, 3, f));
      z = w.punkt(w.startS - 15, 0).clone(); z.y += 1;
    }
    this.cam.position.copy(p); this.cam.lookAt(z); this.cam.fov = 60; this.cam.updateProjectionMatrix();
    this.init = false;
  }
  demo(r, k, dt, t) {
    // Kinoperspektive für den Hintergrund im Menü
    const art = Math.floor(t / 7) % 3;
    const yaw = k.yaw;
    let tp;
    if (art === 0) tp = new THREE.Vector3(k.pos.x - Math.sin(yaw) * 9, k.pos.y + 3.5, k.pos.z - Math.cos(yaw) * 9);
    else if (art === 1) tp = new THREE.Vector3(k.pos.x + Math.sin(yaw + 1.2) * 8, k.pos.y + 2, k.pos.z + Math.cos(yaw + 1.2) * 8);
    else tp = new THREE.Vector3(k.pos.x + Math.sin(yaw) * 10, k.pos.y + 2.5, k.pos.z + Math.cos(yaw) * 10);
    if (!this.init || this.letzteArt !== art) { this.pos.copy(tp); this.init = true; this.letzteArt = art; }
    this.pos.lerp(tp, 1 - Math.exp(-5 * dt));
    this.cam.position.copy(this.pos);
    this.cam.lookAt(k.pos.x, k.pos.y + 1, k.pos.z);
    this.cam.fov = 62; this.cam.updateProjectionMatrix();
  }
}

const Anzeige = {
  r: null, renderer: null, szene: null, vps: [], qual: 'hoch',
  init() {
    const c = $('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.szene = new THREE.Scene();
    this.setzeQual();
    addEventListener('resize', () => this.groesse());
    this.groesse();
    this.speedBild = this.baueSpeedBild();
  },
  setzeQual() {
    let q = Einst.qual;
    if (q === 'auto') q = this.autoQual || 'hoch';
    this.qual = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(q === 'hoch' ? Math.min(dpr, 1.5) : q === 'mittel' ? Math.min(dpr, 1) : 0.75);
    this.renderer.shadowMap.enabled = q !== 'niedrig';
    this.groesse();
  },
  groesse() {
    if (!this.renderer) return;
    this.W = innerWidth; this.H = innerHeight;
    this.renderer.setSize(this.W, this.H, false);
    this.layout();
  },
  layout() {
    const n = this.vps.length, W = this.W, H = this.H;
    const rects = n <= 1 ? [[0, 0, W, H]] : n === 2 ? [[0, 0, W, H / 2], [0, H / 2, W, H / 2]] : [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2]];
    this.vps.forEach((v, i) => {
      const [x, y, w, h] = rects[i];
      v.x = x; v.y = y; v.w = w; v.h = h;
      v.kam.cam.aspect = w / h; v.kam.cam.updateProjectionMatrix();
      const el = v.el;
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
      // Platz für den "Alle Spiele"-Knopf links in der Mitte freihalten
      const mitte = H / 2;
      el.classList.toggle('frei-unten', x < 10 && Math.abs(y + h - mitte) < 60);
      el.classList.toggle('frei-oben', x < 10 && Math.abs(y - mitte) < 60);
      el.classList.toggle('klein', h < 500 || w < 700);
      el.classList.toggle('mini', h < 330 || w < 520);
    });
    if (this.leerFeld) {
      this.leerFeld.classList.toggle('hidden', n !== 3);
      this.leerFeld.style.left = W / 2 + 'px'; this.leerFeld.style.top = H / 2 + 'px'; this.leerFeld.style.width = W / 2 + 'px'; this.leerFeld.style.height = H / 2 + 'px';
    }
  },
  // Neues Rennen: Ansichten erstellen
  starte(r) {
    this.r = r;
    const hud = $('hud');
    hud.innerHTML = '';
    this.vps = [];
    const lokale = r.demo ? [null] : r.lokale;
    lokale.forEach((k, i) => {
      const el = document.createElement('div');
      el.className = 'vp' + (r.welt.istArena ? ' arena' : '') + (r.demo ? ' demo' : '');
      el.innerHTML = `
        <div class="h-item"><div class="h-item-box"><img alt=""><i class="h-anz"></i><div class="h-gold"><b></b></div></div></div>
        <div class="h-unten-links"><div class="h-muenzen"><i class="coin"></i><span>0</span></div><div class="h-runde"><small>Runde</small> <b>1</b><small>/${r.runden}</small></div><div class="h-ballons"></div></div>
        <div class="h-zeit">0:00.00</div>
        <div class="h-liste"></div>
        <div class="h-platz"><b>1</b><small>.</small></div>
        <canvas class="h-karte" width="220" height="220"></canvas>
        <div class="h-speed"></div>
        <div class="h-tinte"></div>
        <div class="h-blitz"></div>
        <div class="h-falsch">Falsche Richtung!</div>
        <div class="h-gross"></div>
        <div class="h-toasts"></div>
        <div class="h-name">${k ? esc(k.name) : ''}</div>`;
      hud.appendChild(el);
      const v = {
        el, k, kam: new Kamera(), x: 0, y: 0, w: 1, h: 1,
        img: el.querySelector('.h-item-box img'), anz: el.querySelector('.h-anz'), box: el.querySelector('.h-item-box'), gold: el.querySelector('.h-gold'),
        muenz: el.querySelector('.h-muenzen span'), runde: el.querySelector('.h-runde b'), zeit: el.querySelector('.h-zeit'),
        liste: el.querySelector('.h-liste'), platz: el.querySelector('.h-platz'), platzB: el.querySelector('.h-platz b'), karte: el.querySelector('.h-karte'),
        speed: el.querySelector('.h-speed'), tinteEl: el.querySelector('.h-tinte'), blitzEl: el.querySelector('.h-blitz'), falsch: el.querySelector('.h-falsch'),
        gross: el.querySelector('.h-gross'), toasts: el.querySelector('.h-toasts'), ballons: el.querySelector('.h-ballons'),
        letztesItem: null, rouletteT: 0, listeKey: '',
      };
      v.speed.style.backgroundImage = `url(${this.speedBild})`;
      v.kam.P = {};
      this.vps.push(v);
    });
    this.leerFeld = document.createElement('div');
    this.leerFeld.className = 'leerfeld hidden';
    this.leerFeld.innerHTML = '<canvas width="300" height="300"></canvas>';
    hud.appendChild(this.leerFeld);
    this.karteVorbereiten(r);
    this.layout();
    // Schattengrösse passend zur Qualität
    r.fx.skala(this.H * this.renderer.getPixelRatio() * 0.9);
  },
  // ---------- Minikarte ----------
  karteVorbereiten(r) {
    const w = r.welt;
    const c = document.createElement('canvas'); c.width = c.height = 220;
    const g = c.getContext('2d');
    const b = w.box;
    const span = Math.max(b.mxx - b.mnx, b.mxz - b.mnz) + 40;
    const sk = 200 / span;
    this.karteT = { cx: b.cx, cz: b.cz, sk };
    const P = (x, z) => [110 + (x - b.cx) * sk, 110 + (z - b.cz) * sk];
    if (w.istArena) {
      g.fillStyle = 'rgba(255,255,255,.25)'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
      const [x0, y0] = P(-w.gr, -w.gr); g.fillRect(x0, y0, w.gr * 2 * sk, w.gr * 2 * sk); g.strokeRect(x0, y0, w.gr * 2 * sk, w.gr * 2 * sk);
      g.fillStyle = 'rgba(0,0,0,.45)';
      for (const h of w.hind) { const [x, y] = P(h.x - h.hw, h.z - h.hd); g.fillRect(x, y, h.hw * 2 * sk, h.hd * 2 * sk); }
    } else {
      const pfad = () => { g.beginPath(); w.S.forEach((s, i) => { const [x, y] = P(s.p.x, s.p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
      g.lineJoin = 'round';
      pfad(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 13; g.stroke();
      pfad(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 8; g.stroke();
      pfad(); g.strokeStyle = r.welt.def.thema === 'all' ? '#c08aff' : 'rgba(90,100,120,.9)'; g.lineWidth = 5; g.stroke();
      const [sx, sy] = P(w.punkt(w.startS, 0).x, w.punkt(w.startS, 0).z);
      g.fillStyle = '#fff'; g.fillRect(sx - 5, sy - 5, 10, 10); g.fillStyle = '#111'; g.fillRect(sx - 5, sy - 5, 5, 5); g.fillRect(sx, sy, 5, 5);
    }
    this.karteBild = c;
  },
  karteZeichnen(cv, r, ich) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 220, 220);
    g.drawImage(this.karteBild, 0, 0);
    const T = this.karteT;
    const P = (x, z) => [110 + (x - T.cx) * T.sk, 110 + (z - T.cz) * T.sk];
    for (const it of r.items.liste) {
      const [x, y] = P(it.pos.x, it.pos.z);
      g.fillStyle = it.typ === 'banane' ? '#ffd92e' : it.typ === 'gruen' ? '#2ccf4a' : it.typ === 'rot' ? '#ff3a30' : it.typ === 'blau' ? '#3a7aff' : it.typ === 'bombe' ? '#222' : '#ff8a8a';
      const s = it.typ === 'blau' ? 7 : 4;
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    const sorted = [...r.karts].sort((a, b) => (a === ich) - (b === ich) || b.platz - a.platz);
    for (const k of sorted) {
      if (r.welt.istArena && k.ballons <= 0 && k.ballonsZurueck === undefined) continue;
      const [x, y] = P(k.pos.x, k.pos.z);
      const gross = k === ich ? 8 : k.istMensch() ? 6.5 : 5;
      g.beginPath(); g.arc(x, y, gross, 0, TAU);
      g.fillStyle = k.farbe; g.fill();
      g.lineWidth = k === ich ? 3 : 2; g.strokeStyle = k === ich ? '#fff' : 'rgba(0,0,0,.7)'; g.stroke();
      if (k === ich) {
        g.beginPath(); g.moveTo(x + Math.sin(k.yaw) * 13, y + Math.cos(k.yaw) * 13);
        g.lineTo(x + Math.sin(k.yaw + 2.5) * 7, y + Math.cos(k.yaw + 2.5) * 7); g.lineTo(x + Math.sin(k.yaw - 2.5) * 7, y + Math.cos(k.yaw - 2.5) * 7);
        g.closePath(); g.fillStyle = '#fff'; g.fill();
      }
    }
  },
  baueSpeedBild() {
    const c = Tex.canvas(512, 512, (g, w, h) => {
      const R = rng(3);
      g.translate(w / 2, h / 2);
      for (let i = 0; i < 70; i++) {
        const a = R() * TAU, r0 = 150 + R() * 60, r1 = r0 + 60 + R() * 120;
        g.strokeStyle = `rgba(255,255,255,${0.25 + R() * 0.45})`; g.lineWidth = 1 + R() * 2.5;
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
      }
    });
    return c.toDataURL();
  },
  // ---------- Ereignisse vom Rennen ----------
  vp(lokal) { return this.vps.find(v => v.k && v.k.lokal === lokal); },
  toast(lokal, text) {
    const v = this.vp(lokal); if (!v) return;
    const d = document.createElement('div'); d.textContent = text;
    v.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2000);
    while (v.toasts.children.length > 3) v.toasts.firstChild.remove();
  },
  gross(lokal, text, klasse) {
    const vs = lokal === -1 ? this.vps : [this.vp(lokal)];
    for (const v of vs) {
      if (!v) continue;
      v.gross.className = 'h-gross ' + (klasse || '');
      v.gross.textContent = text;
      void v.gross.offsetWidth;
      v.gross.classList.add('pop');
      clearTimeout(v.grossT);
      v.grossT = setTimeout(() => { v.gross.textContent = ''; }, klasse === 'ziel' ? 4000 : 1600);
    }
  },
  countdown(n) { this.gross(-1, n ? String(n) : 'LOS!', n ? 'cd' : 'cd los'); },
  ziel(lokal, k) {
    this.gross(lokal, 'ZIEL!', 'ziel');
    const v = this.vp(lokal);
    if (v) v.el.classList.add('fertig');
  },
  platzWechsel(lokal) {
    const v = this.vp(lokal); if (!v) return;
    v.platz.classList.remove('hupf'); void v.platz.offsetWidth; v.platz.classList.add('hupf');
  },
  tinte(lokal) {
    const v = this.vp(lokal); if (!v) return;
    const R = Math.random;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const x = 10 + R() * 80, y = 15 + R() * 70, s = 18 + R() * 22;
      html += `<i style="left:${x}%;top:${y}%;width:${s}vmin;height:${s}vmin;transform:translate(-50%,-50%) rotate(${R() * 360}deg);background-image:url(${this.tintenBild(i % 3)})"></i>`;
    }
    v.tinteEl.innerHTML = html;
    v.tinteEl.classList.remove('weg'); void v.tinteEl.offsetWidth;
    v.tinteEl.classList.add('an');
    clearTimeout(v.tinteT);
    v.tinteT = setTimeout(() => { v.tinteEl.classList.remove('an'); v.tinteEl.classList.add('weg'); }, 4200);
  },
  tintenBild(n) {
    this.tinten = this.tinten || [];
    if (this.tinten[n]) return this.tinten[n];
    const R = rng(50 + n);
    const c = Tex.canvas(256, 256, g => {
      g.fillStyle = '#0a0a10';
      g.beginPath(); g.arc(128, 128, 70, 0, TAU); g.fill();
      for (let i = 0; i < 14; i++) {
        const a = R() * TAU, d = 50 + R() * 40, r = 10 + R() * 26;
        g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, 0, TAU); g.fill();
        // Spritzer
        const d2 = d + r + 8 + R() * 20;
        g.beginPath(); g.arc(128 + Math.cos(a) * d2, 128 + Math.sin(a) * d2, 3 + R() * 7, 0, TAU); g.fill();
      }
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(100 + R() * 40, 100 + R() * 30, 22, 12, -0.6, 0, TAU); g.fill(); }
    });
    return (this.tinten[n] = c.toDataURL());
  },
  blitz() {
    for (const v of this.vps) { v.blitzEl.classList.remove('an'); void v.blitzEl.offsetWidth; v.blitzEl.classList.add('an'); }
  },
  wackeln(lokal, st) { const v = this.vp(lokal); if (v) v.kam.wackel = Math.max(v.kam.wackel, st); },
  stoss(lokal) { const v = this.vp(lokal); if (v) v.kam.fovPlus += 6; },
  ereignis(typ, k, d) {
    const r = this.r;
    if (!r) return;
    switch (typ) {
      case 'blitz': this.blitz(); Ton.sfx('blitz'); for (const l of r.lokale) if (l !== k && !r.gleichesTeam(l, k)) Ton.sfx('schrumpf'); break;
      case 'treffer':
        if (d && d.quelle && d.quelle.lokal >= 0 && d.quelle !== k) this.toast(d.quelle.lokal, 'Treffer: ' + k.name + '!');
        break;
      case 'stern': if (k.lokal >= 0) this.toast(k.lokal, 'Superstern!'); break;
      case 'rakete': if (k.lokal >= 0) this.toast(k.lokal, 'Rakete!'); break;
      case 'tinte': if (k.lokal < 0) Ton.sfx('tinte', 0.5); break;
      case 'hupe': Ton.sfx('hupe', k.lokal >= 0 ? 1 : 0.6); break;
    }
  },
  // ---------- Pro Bild ----------
  render(r, dt) {
    const R = this.renderer;
    R.setScissorTest(true);
    const pr = R.getPixelRatio();
    for (const v of this.vps) {
      const k = v.k;
      if (r.demo) {
        if (!this.demoK || this.demoWechsel <= 0) { this.demoK = r.karts[(Math.random() * r.karts.length) | 0]; this.demoWechsel = 7; v.kam.init = false; }
        this.demoWechsel -= dt;
        v.kam.demo(r, this.demoK, dt, r.zeit);
      } else if (r.phase === 'intro') v.kam.intro(r, r.phaseT);
      else v.kam.folge(k, dt, k.inp && Eingabe.spieler && this.rueckblick(k), r);
      if (window.DEBUG_KAMERA) { const d = window.DEBUG_KAMERA; v.kam.cam.position.set(d[0], d[1], d[2]); v.kam.cam.lookAt(d[3], d[4], d[5]); v.kam.cam.fov = d[6] || 60; v.kam.cam.far = 5000; v.kam.cam.updateProjectionMatrix(); }
      const fokus = r.demo ? this.demoK : k;
      if (fokus) r.sonneAuf(fokus.pos);
      const y = this.H - v.y - v.h;
      R.setViewport(v.x, y, v.w, v.h);
      R.setScissor(v.x, y, v.w, v.h);
      R.clear();
      r.fx.skala(v.h * pr * 0.9);
      R.render(this.szene, v.kam.cam);
      if (!r.demo) this.hud(v, r, dt);
    }
    R.setScissorTest(false);
    if (this.leerFeld && this.vps.length === 3) this.leerfeldZeichnen(r);
  },
  rueckblick(k) {
    if (k.lokal < 0) return false;
    const set = Eingabe.lokal === 1 ? TASTEN.solo : k.lokal === 0 ? TASTEN.p1 : k.lokal === 1 ? TASTEN.p2 : null;
    return set ? Eingabe.any(set.zurueck) : false;
  },
  hud(v, r, dt) {
    const k = v.k;
    const arena = r.welt.istArena;
    // Item
    const zeigeItem = k.roulette > 0 ? '?' : (k.item || (k.gehalten ? null : null));
    if (k.roulette > 0) {
      v.rouletteT -= dt;
      if (v.rouletteT <= 0) {
        v.rouletteT = 0.075;
        const keys = r.welt.istArena ? SCHLACHT_ITEMS : Object.keys(ITEM_TABELLE);
        v.img.src = Ikon.bild(keys[(Math.random() * keys.length) | 0]);
        if (k.lokal >= 0) Ton.sfx('roulette', 0.6);
      }
      v.box.classList.add('dreht'); v.letztesItem = '?';
    } else {
      v.box.classList.remove('dreht');
      const it = k.item;
      if (it !== v.letztesItem) {
        v.letztesItem = it;
        if (it) { v.img.src = Ikon.bild(it); v.img.style.visibility = 'visible'; v.box.classList.remove('neu'); void v.box.offsetWidth; v.box.classList.add('neu'); }
        else v.img.style.visibility = 'hidden';
      }
      v.img.style.visibility = it ? 'visible' : 'hidden';
    }
    if (k.roulette > 0) v.img.style.visibility = 'visible';
    const anz = k.item && (k.item === 'nitro3') ? k.anzahl : 0;
    v.anz.textContent = anz > 1 ? '×' + anz : '';
    v.gold.style.display = k.item === 'goldnitro' && k.goldT > 0 ? 'block' : 'none';
    if (k.item === 'goldnitro') v.gold.firstChild.style.width = (k.goldT / 7.5 * 100) + '%';
    // Münzen, Runde, Zeit
    v.muenz.textContent = k.muenzen;
    if (!arena) v.runde.textContent = clamp(k.runde, 1, r.runden);
    if (arena) {
      const t = Math.max(0, r.schlachtZeit);
      v.zeit.textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
      v.zeit.classList.toggle('knapp', t < 20);
      let bh = '';
      for (let i = 0; i < 3; i++) bh += `<i class="ballon ${i < k.ballons ? '' : 'leer'}" style="--f:${k.farbe}"></i>`;
      if (v.ballonsKey !== bh) { v.ballons.innerHTML = bh; v.ballonsKey = bh; }
    } else v.zeit.textContent = fmtZeit(k.fertig ? k.zielZeit : r.rennZeit);
    // Platz
    if (arena) v.platzB.textContent = k.punkte;
    else v.platzB.textContent = k.platz;
    v.platz.dataset.p = arena ? 'p' : Math.min(k.platz, 4);
    // Rangliste
    const liste = [...r.karts].sort((a, b) => a.platz - b.platz);
    const key = liste.map(x => x.idx + ':' + (arena ? x.punkte : '')).join(',');
    if (key !== v.listeKey) {
      v.listeKey = key;
      v.liste.innerHTML = liste.map(x => `<div class="${x === k ? 'ich' : ''} ${x.istMensch() ? 'mensch' : ''}" style="--f:${x.farbe}"><b>${x.platz}</b><img src="${Portraet.bild(x.fi)}" alt="">${arena ? `<span>${x.punkte}</span>` : ''}</div>`).join('');
    }
    // Karte
    v.kartenT = (v.kartenT || 0) - dt;
    if (v.kartenT <= 0) { v.kartenT = 1 / 20; this.karteZeichnen(v.karte, r, k); }
    // Effekte
    v.speed.classList.toggle('an', (k.boostT > 0 || k.raketeT > 0) && r.phase === 'rennen');
    v.falsch.classList.toggle('an', k.falschT > 1.2 && !k.fertig);
  },
  leerfeldZeichnen(r) {
    const cv = this.leerFeld.querySelector('canvas');
    this.karteZeichnen(cv, r, null);
  },
  ende() {
    this.vps = [];
    $('hud').innerHTML = '';
    this.r = null;
  },
};
