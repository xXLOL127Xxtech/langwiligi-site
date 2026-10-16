// Golf-Tour – Spieler: Zielen, Schläger, Drall, Kraftanzeige, Schlag, Ball-Darstellung, Vorschau und Kamera
'use strict';

const FARBEN = ['#4f8ff7', '#ef5350', '#43c463', '#ffb52e', '#b46cff', '#2ad4d4', '#ff7ac8', '#c9d14a'];
const MAX_SCHLAEGE = 10;
// Gesamtweite jedes Schlägers auf flachem Fairway (wird beim Start einmal simuliert)
const SCHL_WEITE = [];
const SCHL_CARRY = [];
function schlaegerWeitenRechnen() {
  const k = {
    hoehe(x, z, o) { if (o) { o.h = 0; o.nx = 0; o.ny = 1; o.nz = 0; } return 0; }, boden: () => U.FAIRWAY, param: t => BODEN[t],
    gefahrStand: () => -99, imFeld: () => true, naheHindernisse: () => LEER, loch: { x: 1e5, y: 0, z: 1e5 }, wind: { x: 0, z: 0 }, zufall: Math.random,
  };
  SCHLAEGER.forEach((sc, i) => {
    if (sc.putter) { SCHL_WEITE[i] = 0; SCHL_CARRY[i] = 0; return; }
    const b = new Ball(k); b.setze(0, 0);
    const sw = schlagWerte({ schl: i, kraft: 1, yaw: 0, typ: U.FAIRWAY });
    b.schlag(sw.v, sw.w, false);
    for (let t = 0; t < 60 && b.bewegt(); t += 0.05) b.update(0.05);
    SCHL_WEITE[i] = -b.p.z; SCHL_CARRY[i] = b.erstAufprall ? -b.erstAufprall.z : -b.p.z;
  });
}

// ---------- Ball-Darstellung ----------
const BallGrafik = {
  geo: null, mat: null, dellen: null,
  init() {
    this.geo = new THREE.SphereGeometry(PH.R, 28, 18);
    // Dellen als Bump-Textur
    const n = 128, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 16; i++) {
      const x = (i + (j % 2) * 0.5) * n / 16, y = (j + 0.5) * n / 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, 4.2);
      gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fill();
    }
    this.dellen = new THREE.CanvasTexture(cv);
    this.dellen.wrapS = this.dellen.wrapT = THREE.RepeatWrapping;
    this.ringTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const q = c.getContext('2d');
      const gr = q.createRadialGradient(32, 32, 8, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
  },
  // Eigener Ball: weiss und glänzend. Geist: halbtransparent in Spielerfarbe
  baue(farbHex, geist) {
    const mat = new THREE.MeshStandardMaterial({
      color: geist ? farbe(farbHex).lerp(farbe('#ffffff'), 0.35) : '#ffffff', roughness: 0.28, metalness: 0,
      bumpMap: this.dellen, bumpScale: 0.0006, transparent: !!geist, opacity: geist ? 0.42 : 1, depthWrite: !geist,
      emissive: geist ? farbe(farbHex) : farbe('#000000'), emissiveIntensity: geist ? 0.35 : 0,
    });
    const m = new THREE.Mesh(this.geo, mat);
    m.castShadow = !geist;
    // Leuchtring für die Fernsicht
    const sm = new THREE.SpriteMaterial({ map: this.ringTex, color: farbe(farbHex), transparent: true, depthWrite: false, opacity: geist ? 0.5 : 0.8, fog: false });
    const sp = new THREE.Sprite(sm);
    sp.scale.set(0.2, 0.2, 1);
    const g = new THREE.Group();
    g.add(m); g.add(sp);
    g.userData = { mesh: m, ring: sp, geist };
    return g;
  },
};

// ---------- Flugspur ----------
class Spur {
  constructor(farbHex, geist) {
    this.n = 160; this.pos = new Float32Array(this.n * 3); this.anz = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: geist ? farbHex : '#ffffff', transparent: true, opacity: geist ? 0.35 : 0.65 });
    this.linie = new THREE.Line(this.geo, this.mat);
    this.linie.frustumCulled = false;
    this.geo.setDrawRange(0, 0);
    this.t = 0;
  }
  leeren() { this.anz = 0; this.geo.setDrawRange(0, 0); this.mat.opacity = this.basis || this.mat.opacity; }
  punkt(p) {
    if (this.anz >= this.n) { this.pos.copyWithin(0, 3); this.anz = this.n - 1; }
    const o = this.anz * 3;
    this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
    this.anz++;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, this.anz);
  }
}

// ---------- Vorschau: gepunktete Flugbahn, Landering, Hangpfeile ----------
class Vorschau {
  constructor(szene, layer, farbHex) {
    this.szene = szene; this.layer = layer;
    const pg = new THREE.SphereGeometry(1, 8, 6);
    this.punktMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
    this.punkte = new THREE.InstancedMesh(pg, this.punktMat, 60);
    this.punkte.frustumCulled = false; this.punkte.count = 0;
    this.punkte.layers.set(layer);
    szene.add(this.punkte);
    const rg = new THREE.RingGeometry(0.82, 1, 40); rg.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: farbHex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(rg, this.ringMat);
    this.ring.layers.set(layer); this.ring.visible = false; this.ring.renderOrder = 3;
    szene.add(this.ring);
    const ig = new THREE.CircleGeometry(1, 40); ig.rotateX(-Math.PI / 2);
    this.innenMat = new THREE.MeshBasicMaterial({ color: farbHex, transparent: true, opacity: 0.18, depthWrite: false });
    this.innen = new THREE.Mesh(ig, this.innenMat);
    this.innen.layers.set(layer); this.innen.visible = false;
    szene.add(this.innen);
    // Zielpfeil am Ball
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, 0.06, 0, -0.9, 0.16, 0, -0.9, 0, 0, -1.25, -0.16, 0, -0.9, -0.06, 0, -0.9], 3));
    ag.setIndex([0, 1, 2, 0, 2, 6, 3, 4, 5, 6, 2, 4]);
    this.pfeilMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
    this.pfeil = new THREE.Mesh(ag, this.pfeilMat);
    this.pfeil.layers.set(layer); this.pfeil.visible = false;
    szene.add(this.pfeil);
    // Hangpfeile fürs Grün
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.32, 0.17, 0, 0.12, 0, 0, 0.02, -0.17, 0, 0.12], 3));
    hg.setIndex([0, 1, 2, 0, 2, 3]);
    this.hangMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.hang = new THREE.InstancedMesh(hg, this.hangMat, 400);
    this.hang.count = 0; this.hang.frustumCulled = false; this.hang.layers.set(layer);
    this.hang.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3);
    szene.add(this.hang);
    this.liste = [];
    this.schluessel = '';
    this.hangFuer = null;
  }
  verstecken() { this.punkte.count = 0; this.ring.visible = this.innen.visible = this.pfeil.visible = false; this.hang.count = 0; }
  entsorgen() {
    for (const o of [this.punkte, this.ring, this.innen, this.pfeil, this.hang]) { this.szene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
  hangpfeile(kurs, mitte, t) {
    const key = kurs.seed + ':' + Math.round(mitte.x) + ':' + Math.round(mitte.z);
    if (this.hangFuer !== key) {
      this.hangFuer = key;
      this.hangDaten = [];
      const hb = { h: 0, nx: 0, ny: 1, nz: 0 };
      const R = 13, st = 1.25;
      for (let z = -R; z <= R; z += st) for (let x = -R; x <= R; x += st) {
        if (x * x + z * z > R * R) continue;
        const px = mitte.x + x, pz = mitte.z + z;
        const typ = kurs.boden(px, pz);
        if (typ !== U.GRUEN && typ !== U.VORGRUEN) continue;
        kurs.hoehe(px, pz, hb);
        const gx = hb.nx, gz = hb.nz, gl = Math.hypot(gx, gz);
        if (gl < 0.002) continue;
        this.hangDaten.push({ x: px, z: pz, y: hb.h, a: Math.atan2(gx, gz), st: gl, nx: hb.nx, ny: hb.ny, nz: hb.nz });
        if (this.hangDaten.length >= 400) break;
      }
    }
    const d = new THREE.Object3D(), c = new THREE.Color();
    let i = 0;
    for (const p of this.hangDaten) {
      const ph = ((t * 0.6 + (p.x * 0.37 + p.z * 0.23)) % 1);
      const ofs = (ph - 0.5) * 0.5;
      d.position.set(p.x + Math.sin(p.a) * ofs, p.y + 0.02, p.z + Math.cos(p.a) * ofs);
      d.rotation.set(0, p.a + Math.PI, 0);
      const s = 0.6 + clamp(p.st * 18, 0, 1) * 0.6;
      d.scale.set(s, 1, s);
      d.updateMatrix();
      this.hang.setMatrixAt(i, d.matrix);
      // blau = flach, gelb = mittel, rot = steil
      const q = clamp(p.st / 0.05, 0, 1);
      c.setRGB(q < 0.5 ? q * 2 : 1, q < 0.5 ? 0.6 + q * 0.8 : 1 - (q - 0.5) * 1.6, q < 0.5 ? 1 - q * 2 : 0.1);
      this.hang.setColorAt(i, c);
      i++;
    }
    this.hang.count = i;
    this.hang.instanceMatrix.needsUpdate = true;
    if (this.hang.instanceColor) this.hang.instanceColor.needsUpdate = true;
  }
  zeigen(kurs, sp, kamPos, t) {
    const b = sp.ball, sc = SCHLAEGER[sp.schl];
    // Pfeil
    this.pfeil.visible = true;
    this.pfeil.position.set(b.p.x, b.p.y - PH.R + 0.015, b.p.z);
    this.pfeil.rotation.set(0, sp.yaw, 0);
    const pd = Math.hypot(kamPos.x - b.p.x, kamPos.z - b.p.z);
    this.pfeil.scale.setScalar(sc.putter ? 0.9 : clamp(pd * 0.25, 1, 4));
    // Bahn berechnen, wenn sich etwas geändert hat
    const kraft = sp.zustand === 'laden' ? sp.kraft : sc.putter ? sp.puttZiel() : 1;
    const key = [sp.schl, sp.yaw.toFixed(4), kraft.toFixed(3), sp.drall.x, sp.drall.y, b.p.x.toFixed(2), b.p.z.toFixed(2)].join('|');
    if (key !== this.schluessel) {
      this.schluessel = key;
      const sw = sp.schlagDaten(kraft, 0);
      const pts = [];
      this.erg = flugVorschau(kurs, b.p, sw, pts, 600);
      this.liste = pts;
    }
    const pts = this.liste, d = new THREE.Object3D();
    let n = 0;
    if (sc.putter) {
      if (Einst.putthilfe) {
        const bis = Math.floor(pts.length * 0.45);
        for (let i = 1; i < bis && n < 60; i += 2) {
          const p = pts[i];
          d.position.set(p.x, p.y - PH.R + 0.01, p.z); d.scale.setScalar(0.022); d.updateMatrix();
          this.punkte.setMatrixAt(n++, d.matrix);
        }
      }
      this.ring.visible = this.innen.visible = false;
      this.hangpfeile(kurs, { x: (b.p.x + kurs.loch.x) / 2, z: (b.p.z + kurs.loch.z) / 2 }, t);
    } else {
      this.hang.count = 0;
      const step = Math.max(1, Math.floor(pts.length / 45));
      for (let i = 0; i < pts.length && n < 60; i += step) {
        const p = pts[i];
        const ab = Math.hypot(kamPos.x - p.x, kamPos.y - p.y, kamPos.z - p.z);
        d.position.set(p.x, p.y, p.z); d.scale.setScalar(clamp(ab * 0.0042, 0.04, 1.2)); d.updateMatrix();
        this.punkte.setMatrixAt(n++, d.matrix);
      }
      const L = this.erg.lande;
      if (L.ok) {
        const hb = { h: 0, nx: 0, ny: 1, nz: 0 };
        kurs.hoehe(L.x, L.z, hb);
        const rad = clamp(Math.hypot(L.x - b.p.x, L.z - b.p.z) * 0.035, 1.2, 8);
        for (const m of [this.ring, this.innen]) {
          m.visible = true;
          m.position.set(L.x, hb.h + 0.06, L.z);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hb.nx, hb.ny, hb.nz));
          m.scale.setScalar(rad);
        }
        this.ringMat.opacity = 0.65 + Math.sin(t * 5) * 0.2;
      }
    }
    this.punktMat.opacity = sp.zustand === 'laden' ? 0.95 : 0.55;
    this.punkte.count = n;
    this.punkte.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Spieler ----------
class Spieler {
  constructor(idx, name, farbHex, blocks) {
    this.idx = idx; this.name = name; this.farbe = farbHex; this.blocks = blocks;
    this.karte = []; this.schlaege = 0; this.zustand = 'warten';
    this.yaw = 0; this.schl = 0; this.drall = { x: 0, y: 0 }; this.kraft = 0; this.kraftT = 0; this.drehT = 0;
    this.letzte = { x: 0, z: 0 }; this.strafeT = 0; this.meldung = null;
    this.ball = null; this.grafik = null; this.spur = null; this.vorschau = null;
    this.letzteKraft = null;
  }
  gesamt() { return this.karte.reduce((s, v) => s + (v || 0), 0); }
  // Neue Bahn
  aufBahn(kurs, welt, layer) {
    this.kurs = kurs;
    this.ball = new Ball(kurs);
    this.ball.setze(kurs.start.x, kurs.start.z);
    this.schlaege = 0; this.zustand = 'zielen'; this.fertig = false;
    this.drall = { x: 0, y: 0 }; this.kraft = 0;
    this.grafik = BallGrafik.baue(this.farbe, false);
    welt.szene.add(this.grafik);
    this.spur = new Spur(this.farbe, false);
    welt.szene.add(this.spur.linie);
    this.vorschau = new Vorschau(welt.szene, layer, this.farbe);
    this.layer = layer;
    this.autoWahl();
  }
  verlassen(welt) {
    if (this.vorschau) this.vorschau.entsorgen();
    if (this.grafik) { welt.szene.remove(this.grafik); this.grafik.userData.mesh.material.dispose(); this.grafik.userData.ring.material.dispose(); }
    if (this.spur) { welt.szene.remove(this.spur.linie); this.spur.geo.dispose(); this.spur.mat.dispose(); }
  }
  lochDist() { const L = this.kurs.loch; return Math.hypot(L.x - this.ball.p.x, L.z - this.ball.p.z); }
  lage() { return this.kurs.boden(this.ball.p.x, this.ball.p.z); }
  puttMax() { return clamp(this.lochDist() * 1.75 + 1.5, 3, 34); }
  // Kraft, bei der ein Putt auf flachem Grün genau bis zum Loch rollt
  puttZiel() { return clamp(this.lochDist() / this.puttMax(), 0.02, 1); }
  // Schlägerwahl und Zielrichtung automatisch vorschlagen
  autoWahl() {
    const k = this.kurs, d = this.lochDist(), typ = this.lage();
    let s;
    if (typ === U.GRUEN || (typ === U.VORGRUEN && d < 25) || (d < 14 && typ !== U.SAND && typ !== U.ROUGH) || (d < 7 && typ !== U.SAND)) s = SCHLAEGER.length - 1;
    else {
      s = 0;
      for (let i = SCHLAEGER.length - 2; i >= 0; i--) {
        if (SCHL_WEITE[i] * (BODEN[typ] ? BODEN[typ].lieV : 1) * 0.97 >= d) { s = i; break; }
      }
      if (typ === U.SAND && d < 70) s = 6;
    }
    this.schl = s;
    this.drall = { x: 0, y: 0 };
    this.zielAuto();
  }
  zielAuto() {
    const k = this.kurs, b = this.ball.p, L = k.loch, d = this.lochDist();
    let tx = L.x, tz = L.z;
    const weite = SCHLAEGER[this.schl].putter ? 0 : SCHL_WEITE[this.schl] * 0.95;
    if (weite && weite < d - 15) {
      // Pfadpunkt in Schlagweite anpeilen (bei Doglegs nicht durch den Wald)
      const P = k.pfad, a = k.amPfad(b.x, b.z);
      let best = null, bd = 1e9;
      for (let i = 0; i < P.n; i++) {
        if (P.s[i] < a.s) continue;
        const dd = Math.hypot(P.x[i] - b.x, P.z[i] - b.z);
        const f = Math.abs(dd - weite);
        if (f < bd) { bd = f; best = i; }
      }
      if (best != null) { tx = P.x[best]; tz = P.z[best]; }
    }
    this.yaw = Math.atan2(-(tx - b.x), -(tz - b.z));
  }
  hangInfo() {
    const hb = { h: 0, nx: 0, ny: 1, nz: 0 };
    this.kurs.hoehe(this.ball.p.x, this.ball.p.z, hb);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const auf = -(hb.nx * fx + hb.nz * fz) / hb.ny;
    const quer = -(hb.nx * -fz + hb.nz * fx) / hb.ny;
    return { auf, quer };
  }
  schlagDaten(kraft, zufall) {
    return schlagWerte({ schl: this.schl, kraft, yaw: this.yaw, drall: SCHLAEGER[this.schl].putter ? { x: 0, y: 0 } : this.drall,
      typ: this.lage(), hang: this.hangInfo(), puttMax: this.puttMax(), zufall });
  }
  // Steuerung im Zustand "zielen"/"laden"
  steuern(e, dt, maus) {
    const sc = SCHLAEGER[this.schl];
    if (this.zustand === 'zielen' || this.zustand === 'laden') {
      const dir = (e.rechts ? -1 : 0) + (e.links ? 1 : 0);
      if (dir) {
        this.drehT += dt;
        const basis = sc.putter ? 0.09 : 0.22;
        this.yaw += dir * basis * (1 + 4 * Math.min(1, this.drehT / 0.9)) * dt;
      } else this.drehT = 0;
      if (maus && maus.dx) this.yaw -= maus.dx * (sc.putter ? 0.0016 : 0.0035);
    }
    if (this.zustand === 'zielen') {
      if (e.schlAuf && this.schl > 0) { this.schl--; Ton.sfx('klick'); }
      if (e.schlAb && this.schl < SCHLAEGER.length - 1) { this.schl++; Ton.sfx('klick'); }
      if (!sc.putter) {
        if (e.drallL) this.drall.x = clamp(this.drall.x - 0.25, -1, 1);
        if (e.drallR) this.drall.x = clamp(this.drall.x + 0.25, -1, 1);
        if (e.drallRueck) this.drall.y = clamp(this.drall.y + 0.25, -1, 1);
        if (e.drallVor) this.drall.y = clamp(this.drall.y - 0.25, -1, 1);
      }
      if (e.kraftDruck) { this.zustand = 'laden'; this.kraftT = 0; this.kraft = 0; }
    } else if (this.zustand === 'laden') {
      this.kraftT += dt;
      // Kraft steigt bis 100 % und fällt danach wieder (Pendel)
      const per = 1.25, ph = (this.kraftT / per) % 2;
      this.kraft = ph < 1 ? ph : 2 - ph;
      this.kraft = Math.max(0.01, this.kraft);
      if (!e.kraft) {
        if (this.kraftT < 0.06) { this.zustand = 'zielen'; return null; }
        return this.schlagen();
      }
    }
    return null;
  }
  schlagen() {
    const sc = SCHLAEGER[this.schl];
    this.letzte = { x: this.ball.p.x, z: this.ball.p.z };
    const sw = this.schlagDaten(this.kraft, (Math.random() - 0.5) * 2);
    this.ball.schlag(sw.v, sw.w, sw.rollend);
    this.schlaege++;
    this.letzteKraft = this.kraft;
    this.zustand = 'unterwegs';
    this.vorschau.verstecken();
    this.spur.leeren();
    Ton.sfx(sc.putter ? 'putt' : 'schlag', sc.putter ? this.kraft : 0.4 + this.kraft * 0.6);
    return { typ: 'schlag', putter: !!sc.putter, kraft: this.kraft };
  }
  // Ball nach Strafe an die letzte Stelle legen
  zuruecklegen() {
    this.ball.setze(this.letzte.x, this.letzte.z);
    this.zustand = 'zielen';
    this.autoWahl();
  }
  // Ballgrafik an Physik anpassen (Grösse je nach Kameraabstand)
  grafikUpdate(kamPos, dt) {
    const b = this.ball, g = this.grafik;
    if (!g) return;
    let y = b.p.y;
    if (b.zustand === 'loch') { b.lochFall = Math.min(1, b.lochFall + dt * 3); y = this.kurs.loch.y + PH.R - b.lochFall * 0.12; }
    const ab = Math.hypot(kamPos.x - b.p.x, kamPos.y - y, kamPos.z - b.p.z);
    const s = Math.max(1, ab * 0.032);
    g.userData.mesh.scale.setScalar(s);
    g.position.set(b.p.x, y + PH.R * (s - 1) * (b.zustand === 'loch' ? 0 : 1), b.p.z);
    const rs = clamp(ab * 0.035, 0.12, 9) * (b.zustand === 'loch' ? 0 : 1);
    g.userData.ring.scale.set(rs, rs, 1);
    g.userData.ring.material.opacity = clamp((ab - 12) / 40, 0, 1) * 0.8;
    // Drehung des Balls
    const w = b.w, wl = Math.hypot(w.x, w.y, w.z);
    if (wl > 0.1 && b.bewegt()) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(w.x / wl, w.y / wl, w.z / wl), Math.min(wl * dt, 1.5));
      g.userData.mesh.quaternion.premultiply(q);
    }
  }
}

// ---------- Geist (Mitspieler online) ----------
class Geist {
  constructor(idx, name, farbHex) {
    this.idx = idx; this.name = name; this.farbe = farbHex;
    this.karte = []; this.schlaege = 0; this.fertig = false; this.weg = false;
    this.ziel = null; this.pos = null; this.bewegt = false;
    this.grafik = null; this.spur = null;
  }
  gesamt() { return this.karte.reduce((s, v) => s + (v || 0), 0); }
  aufBahn(kurs, welt) {
    this.kurs = kurs; this.schlaege = 0; this.fertig = false;
    const y = kurs.hoehe(kurs.start.x, kurs.start.z) + PH.R;
    this.ziel = { x: kurs.start.x, y, z: kurs.start.z }; this.pos = Object.assign({}, this.ziel);
    this.grafik = BallGrafik.baue(this.farbe, true);
    welt.szene.add(this.grafik);
    this.spur = new Spur(this.farbe, true);
    welt.szene.add(this.spur.linie);
  }
  verlassen(welt) {
    if (this.grafik) { welt.szene.remove(this.grafik); this.grafik.userData.mesh.material.dispose(); this.grafik.userData.ring.material.dispose(); this.grafik = null; }
    if (this.spur) { welt.szene.remove(this.spur.linie); this.spur.geo.dispose(); this.spur.mat.dispose(); this.spur = null; }
  }
  update(dt) {
    if (!this.pos || !this.ziel) return;
    const k = 1 - Math.exp(-dt * 10);
    const sprung = Math.hypot(this.ziel.x - this.pos.x, this.ziel.z - this.pos.z) > 60;
    if (sprung) Object.assign(this.pos, this.ziel);
    else { this.pos.x += (this.ziel.x - this.pos.x) * k; this.pos.y += (this.ziel.y - this.pos.y) * k; this.pos.z += (this.ziel.z - this.pos.z) * k; }
  }
  grafikUpdate(kamPos) {
    if (!this.grafik) return;
    const p = this.pos, ab = Math.hypot(kamPos.x - p.x, kamPos.y - p.y, kamPos.z - p.z);
    const s = Math.max(1, ab * 0.032);
    this.grafik.userData.mesh.scale.setScalar(s);
    this.grafik.position.set(p.x, p.y + PH.R * (s - 1), p.z);
    const rs = clamp(ab * 0.035, 0.12, 9);
    this.grafik.userData.ring.scale.set(rs, rs, 1);
    this.grafik.visible = !this.fertig && !this.weg;
  }
}

// ---------- Kamera einer Ansicht ----------
class Kamera {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.05, 6000);
    this.pos = new THREE.Vector3(0, 10, 10); this.blick = new THREE.Vector3();
    this.modus = 'ziel'; this.zoom = 1; this.ueber = false;
    this.flugRichtung = new THREE.Vector3(0, 0, -1);
    this.intro = null;
    this.orbitT = 0;
  }
  sofort() { this.springen = true; }
  // Kamera-Ziele berechnen und weich nachführen
  update(dt, sp, kurs, extra) {
    let zp, zb, k = 4;
    const b = sp && sp.ball ? sp.ball.p : kurs.start;
    const hb = { h: 0, nx: 0, ny: 1, nz: 0 };
    if (this.intro) {
      // Überflug vom Grün zum Abschlag
      this.intro.t += dt / this.intro.dauer;
      const t = smooth(clamp(this.intro.t, 0, 1));
      const s = kurs.laenge * (1 - t) - 10;
      const p = kurs.punktBei(Math.max(-25, s)), q = kurs.punktBei(Math.max(0, s + 50));
      const h = kurs.hoehe(p.x, p.z);
      zp = new THREE.Vector3(p.x, h + lerp(45, 6, t), p.z);
      zb = new THREE.Vector3(q.x, kurs.hoehe(q.x, q.z) + 2, q.z);
      if (this.intro.t <= 0.02) { this.pos.copy(zp); this.blick.copy(zb); }
      k = 6;
      if (this.intro.t >= 1) { this.intro = null; }
    } else if (!sp || sp.fertig || this.modus === 'orbit') {
      // Rundflug ums Grün
      this.orbitT += dt * 0.12;
      const L = kurs.loch;
      zp = new THREE.Vector3(L.x + Math.cos(this.orbitT) * 26, L.y + 9, L.z + Math.sin(this.orbitT) * 26);
      zb = new THREE.Vector3(L.x, L.y + 0.5, L.z);
      k = 1.5;
    } else if (sp.zustand === 'unterwegs' || sp.zustand === 'strafe') {
      const v = sp.ball.v, hv = Math.hypot(v.x, v.z);
      if (hv > 0.5) this.flugRichtung.set(v.x / hv, 0, v.z / hv);
      const L = kurs.loch, dl = Math.hypot(L.x - b.x, L.z - b.z);
      const putt = sp.ball.zustand === 'rollen' && dl < 25 && hv < 6;
      if (putt) {
        // beim Putten seitlich-hinten, Loch im Blick
        const dx = (L.x - sp.letzte.x), dz = (L.z - sp.letzte.z), l = Math.hypot(dx, dz) || 1;
        zp = new THREE.Vector3(b.x - dx / l * 3.2, b.y + 1.4, b.z - dz / l * 3.2);
        zb = new THREE.Vector3((b.x + L.x) / 2, L.y, (b.z + L.z) / 2);
        k = 2.5;
      } else {
        const f = this.flugRichtung, dist = clamp(8 + (b.y - kurs.hoehe(b.x, b.z)) * 0.25, 8, 20);
        zp = new THREE.Vector3(b.x - f.x * dist, b.y + 3 + dist * 0.15, b.z - f.z * dist);
        zb = new THREE.Vector3(b.x + f.x * 6, b.y, b.z + f.z * 6);
        k = 3.2;
      }
    } else {
      const sc = SCHLAEGER[sp.schl];
      const fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw);
      if (this.ueber) {
        const L = extra && extra.lande ? extra.lande : kurs.loch;
        const mx = (b.x + L.x) / 2, mz = (b.z + L.z) / 2, d = Math.hypot(L.x - b.x, L.z - b.z);
        const hoch = clamp(d * 0.75, 16, 260) * this.zoom;
        zp = new THREE.Vector3(mx - fx * hoch * 0.35, kurs.hoehe(mx, mz) + hoch, mz - fz * hoch * 0.35);
        zb = new THREE.Vector3(mx + fx * 2, kurs.hoehe(mx, mz), mz + fz * 2);
        k = 3;
      } else if (sc.putter) {
        const D = 2.4 * this.zoom;
        zp = new THREE.Vector3(b.x - fx * D, b.y + 0.75 * this.zoom + 0.15, b.z - fz * D);
        zb = new THREE.Vector3(b.x + fx * 3, b.y, b.z + fz * 3);
        k = 7;
      } else {
        const D = 5.2 * this.zoom;
        zp = new THREE.Vector3(b.x - fx * D, b.y + 1.9 * this.zoom, b.z - fz * D);
        zb = new THREE.Vector3(b.x + fx * 28, b.y + 3, b.z + fz * 28);
        k = 7;
      }
    }
    if (this.springen) { this.pos.copy(zp); this.blick.copy(zb); this.springen = false; }
    else { const a = 1 - Math.exp(-k * dt); this.pos.lerp(zp, a); this.blick.lerp(zb, Math.min(1, a * 1.4)); }
    // nie unter dem Boden
    kurs.hoehe(this.pos.x, this.pos.z, hb);
    const minH = hb.h + 0.35;
    if (this.pos.y < minH) this.pos.y = minH;
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.blick);
  }
}
