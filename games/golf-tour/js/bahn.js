// Golf-Tour – Bahngenerator: Verlauf, Fairway, Grün, Bunker, Wasser, Gelände-Höhen, Bäume und Hindernisse
// Alles hängt nur von der Saat ab, damit online alle Spieler dieselbe Bahn bekommen.
'use strict';

const PAR_LAENGE = { 3: [105, 175], 4: [275, 345], 5: [420, 475] };

class Kurs {
  constructor(seed, nr, thema, par) {
    this.seed = seed; this.nr = nr; this.thema = thema; this.par = par;
    this.r = rng(seed);
    this.rs = rauschen(seed * 7 + 3);
    this.wind = { x: 0, z: 0 };
    this.params = BODEN.slice();
    if (thema.rough) this.params[U.ROUGH] = Object.assign({}, BODEN[U.ROUGH], thema.rough);
    this.verlauf();
    this.raster();
    this.masken();
    this.hoehen();
    this.lochSetzen();
    this.hindernisseSetzen();
    const r = this.r, w = thema.wind;
    const ws = w[0] + r() * (w[1] - w[0]), wa = r() * TAU;
    this.wind = { x: Math.sin(wa) * ws, z: Math.cos(wa) * ws };
    this.windStaerke = ws;
  }
  zufall() { return Math.random(); }

  // ---------- Verlauf der Bahn ----------
  verlauf() {
    const r = this.r, par = this.par, [la, lb] = PAR_LAENGE[par];
    const L = la + r() * (lb - la);
    const pt = (o, th, d) => ({ x: o.x + Math.sin(th) * d, z: o.z - Math.cos(th) * d });
    const T = { x: 0, z: 0 };
    let pts;
    if (par === 3) {
      const th = (r() - 0.5) * 0.35;
      const M = pt(T, th, L * 0.5); M.x += (r() - 0.5) * 12;
      pts = [T, M, pt(T, th, L)];
    } else if (par === 4) {
      const d1 = 205 + r() * 45, th1 = (r() - 0.5) * 0.25;
      const C = pt(T, th1, d1);
      const th2 = th1 + (r() < 0.5 ? -1 : 1) * (0.12 + r() * 0.5);
      pts = [T, pt(T, th1, d1 * 0.5), C, pt(C, th2, L - d1)];
    } else {
      const d1 = 225 + r() * 30, th1 = (r() - 0.5) * 0.3;
      const C1 = pt(T, th1, d1);
      const s1 = r() < 0.5 ? -1 : 1;
      const th2 = th1 + s1 * (0.15 + r() * 0.35);
      const d2 = 120 + r() * 50;
      const C2 = pt(C1, th2, d2);
      const th3 = th2 - s1 * (0.1 + r() * 0.45);
      pts = [T, pt(T, th1, d1 * 0.5), C1, C2, pt(C2, th3, L - d1 - d2)];
    }
    // Catmull-Rom glätten, alle 2 m ein Punkt
    const P = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    const roh = [];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      const seg = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const n = Math.max(2, Math.ceil(seg / 1));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        roh.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
      }
    }
    roh.push(pts[pts.length - 1]);
    const px = [], pz = [], ps = [];
    let s = 0, last = null;
    for (const p of roh) {
      if (last) { const d = Math.hypot(p.x - last.x, p.z - last.z); if (d < 2 && p !== roh[roh.length - 1]) continue; s += d; }
      px.push(p.x); pz.push(p.z); ps.push(s); last = p;
    }
    this.pfad = { x: px, z: pz, s: ps, n: px.length };
    this.laenge = s;
    this.abschlag = { x: 0, z: 0 };
    this.gruenM = { x: px[px.length - 1], z: pz[pz.length - 1] };
    const d0 = this.richtungBei(4);
    this.startYaw = Math.atan2(-d0.x, -d0.z);
    // Breite des Fairways entlang des Wegs
    this.fwBreite = 27 + r() * 12;
    this.fwPhase = r() * 10;
    this.fwStart = par === 3 ? s - 32 : 45 + r() * 35;
  }
  richtungBei(sZiel) {
    const P = this.pfad;
    let i = 0;
    while (i < P.n - 2 && P.s[i + 1] < sZiel) i++;
    const dx = P.x[i + 1] - P.x[i], dz = P.z[i + 1] - P.z[i], l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l, px: P.x[i], pz: P.z[i] };
  }
  punktBei(sZiel) {
    const P = this.pfad;
    let i = 0;
    while (i < P.n - 2 && P.s[i + 1] < sZiel) i++;
    const t = clamp((sZiel - P.s[i]) / ((P.s[i + 1] - P.s[i]) || 1), 0, 1);
    return { x: lerp(P.x[i], P.x[i + 1], t), z: lerp(P.z[i], P.z[i + 1], t) };
  }
  fwHalb(s) {
    const t = clamp((s - this.fwStart) / 30, 0, 1);
    return this.fwBreite * 0.5 * (0.75 + 0.25 * t) * (1 + 0.18 * Math.sin(s / 41 + this.fwPhase) + 0.1 * Math.sin(s / 17 + this.fwPhase * 2));
  }
  // nächster Pfadpunkt: Abstand, Bogenlänge, Seite (+ = rechts)
  amPfad(x, z) {
    const P = this.pfad;
    let best = 1e18, bi = 0;
    for (let i = 0; i < P.n; i += 3) { const dx = x - P.x[i], dz = z - P.z[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const a = Math.max(0, bi - 3), b = Math.min(P.n - 1, bi + 3);
    for (let i = a; i <= b; i++) { const dx = x - P.x[i], dz = z - P.z[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const j = Math.min(P.n - 1, bi + 1), k = j === bi ? bi - 1 : bi;
    const tx = P.x[j] - P.x[k], tz = P.z[j] - P.z[k];
    // Seite: Kreuzprodukt Richtung × Versatz (rechts = +1 in Spielrichtung)
    const cr = tx * (z - P.z[bi]) - tz * (x - P.x[bi]);
    return { d: Math.sqrt(best), s: P.s[bi], seite: cr < 0 ? 1 : -1, i: bi };
  }

  // ---------- Raster für Höhen und Untergrund ----------
  raster() {
    const P = this.pfad;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < P.n; i++) { x0 = Math.min(x0, P.x[i]); x1 = Math.max(x1, P.x[i]); z0 = Math.min(z0, P.z[i]); z1 = Math.max(z1, P.z[i]); }
    const m = 68;
    x0 -= m; x1 += m; z0 -= m; z1 += m - 18;
    this.x0 = x0; this.z0 = z0; this.br = x1 - x0; this.tf = z1 - z0;
    let c = 1.25;
    while ((this.br / c + 1) * (this.tf / c + 1) > 78000) c += 0.25;
    this.zelle = c;
    this.nx = Math.ceil(this.br / c) + 1; this.nz = Math.ceil(this.tf / c) + 1;
    this.br = (this.nx - 1) * c; this.tf = (this.nz - 1) * c;
    this.tRes = 0.33;
    this.tw = Math.ceil(this.br / this.tRes); this.th = Math.ceil(this.tf / this.tRes);
    while (this.tw * this.th > 1500000) { this.tRes += 0.03; this.tw = Math.ceil(this.br / this.tRes); this.th = Math.ceil(this.tf / this.tRes); }
    // Pfad-Info für jede Rasterecke
    const N = this.nx * this.nz;
    this.pd = new Float32Array(N); this.pS = new Float32Array(N); this.pSeite = new Int8Array(N);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const a = this.amPfad(x0 + i * c, z0 + j * c), k = j * this.nx + i;
      this.pd[k] = a.d; this.pS[k] = a.s; this.pSeite[k] = a.seite;
    }
  }
  imFeld(x, z) { return x > this.x0 + 1 && x < this.x0 + this.br - 1 && z > this.z0 + 1 && z < this.z0 + this.tf - 1; }

  // ---------- Formen zeichnen und Untergrund festlegen ----------
  masken() {
    const r = this.r, T = this.thema, par = this.par, L = this.laenge;
    const cv = document.createElement('canvas'); cv.width = this.tw; cv.height = this.th;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const tw = this.tw, th = this.th, tr = this.tRes, x0 = this.x0, z0 = this.z0;
    const maske = zeichne => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, tw, th);
      g.setTransform(1 / tr, 0, 0, 1 / tr, -x0 / tr, -z0 / tr);
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      zeichne(g);
      const d = g.getImageData(0, 0, tw, th).data, out = new Uint8Array(tw * th);
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3];
      return out;
    };
    const kreis = (g, x, z, rad) => { g.beginPath(); g.arc(x, z, Math.max(0.1, rad), 0, TAU); g.fill(); };
    const blob = (g, b, plus = 0) => { for (const k of b) kreis(g, k.x, k.z, k.r + plus); };
    const G = this.gruenM;
    // Grün: Hauptkreis + zwei Ausbuchtungen
    const gr = 10.5 + r() * 4.5;
    const gBlob = [{ x: G.x, z: G.z, r: gr }];
    for (let i = 0; i < 2; i++) {
      const a = r() * TAU, d = gr * (0.35 + r() * 0.3);
      gBlob.push({ x: G.x + Math.cos(a) * d, z: G.z + Math.sin(a) * d, r: gr * (0.5 + r() * 0.3) });
    }
    this.gruenR = gr; this.gBlob = gBlob;
    const dEnde = this.richtungBei(L - 3);   // Anspielrichtung aufs Grün
    const vor = { x: dEnde.x, z: dEnde.z }, rechts = { x: -dEnde.z, z: dEnde.x };
    this.anspiel = vor;
    // Bunker
    const bunker = [];
    const nB = 1 + Math.floor(r() * 3);
    const winkel = mischen([-2.4, -1.6, -0.8, 0.8, 1.6, 2.4, Math.PI], r).slice(0, nB);
    for (const w of winkel) {
      const br = 3 + r() * 2.5;
      const dir = { x: -vor.x * Math.cos(w) + rechts.x * Math.sin(w), z: -vor.z * Math.cos(w) + rechts.z * Math.sin(w) };
      const d = gr + br + 1.8;
      const c = { x: G.x + dir.x * d, z: G.z + dir.z * d };
      const b = [{ x: c.x, z: c.z, r: br }];
      for (let k = 0; k < 2; k++) b.push({ x: c.x + (r() - 0.5) * br * 1.6, z: c.z + (r() - 0.5) * br * 1.6, r: br * (0.5 + r() * 0.35) });
      bunker.push(b);
    }
    if (par >= 4) {
      const nF = 1 + Math.floor(r() * (par === 5 ? 3 : 2));
      for (let k = 0; k < nF; k++) {
        const s = clamp(185 + r() * 70 + (k === 2 ? 150 : 0), 60, L - 70);
        const p = this.punktBei(s), d = this.richtungBei(s);
        const sei = r() < 0.5 ? -1 : 1, br = 4 + r() * 4;
        const off = this.fwHalb(s) - 1 + br * 0.6;
        const c = { x: p.x - d.z * off * sei, z: p.z + d.x * off * sei };
        const b = [{ x: c.x, z: c.z, r: br }];
        for (let q = 0; q < 3; q++) b.push({ x: c.x + d.x * (q - 1) * br * 0.9, z: c.z + d.z * (q - 1) * br * 0.9, r: br * (0.55 + r() * 0.3) });
        bunker.push(b);
      }
    } else if (r() < 0.6) {
      const s = L - gr - 14 - r() * 20, p = this.punktBei(s);
      bunker.push([{ x: p.x + (r() - 0.5) * 10, z: p.z, r: 4 + r() * 2 }, { x: p.x + (r() - 0.5) * 12, z: p.z + (r() - 0.5) * 6, r: 3 }]);
    }
    this.bunker = bunker;
    // Wasser / Lava / Eis
    const gew = [];
    if (r() < T.gefahrChance) {
      let art = par === 3 ? (r() < 0.65 ? 'vorne' : 'seite') : (T.bach || r() < 0.35 ? 'bach' : r() < 0.6 ? 'seite' : 'gruen');
      if (T.meer && r() < 0.7) art = 'meer';
      if (art === 'vorne') {
        const s = L * (0.4 + r() * 0.25), p = this.punktBei(s), rr = 11 + r() * 8;
        const b = [{ x: p.x, z: p.z, r: rr }];
        for (let k = 0; k < 4; k++) b.push({ x: p.x + (r() - 0.5) * rr * 2, z: p.z + (r() - 0.5) * rr, r: rr * (0.5 + r() * 0.4) });
        gew.push({ form: 'blob', b });
      } else if (art === 'seite') {
        const s = par === 3 ? L * 0.6 : 150 + r() * Math.min(150, L - 220), p = this.punktBei(s), d = this.richtungBei(s);
        const sei = r() < 0.5 ? -1 : 1, rr = 12 + r() * 8, off = this.fwHalb(s) + rr * 0.85 + 3;
        const c = { x: p.x - d.z * off * sei, z: p.z + d.x * off * sei };
        const b = [];
        for (let k = 0; k < 4; k++) b.push({ x: c.x + d.x * (k - 1.5) * rr * 0.8, z: c.z + d.z * (k - 1.5) * rr * 0.8, r: rr * (0.6 + r() * 0.35) });
        gew.push({ form: 'blob', b });
      } else if (art === 'gruen') {
        const sei = r() < 0.5 ? -1 : 1, rr = 10 + r() * 6, off = gr + rr + 3;
        const c = { x: G.x + rechts.x * off * sei - vor.x * 6, z: G.z + rechts.z * off * sei - vor.z * 6 };
        const b = [{ x: c.x, z: c.z, r: rr }];
        for (let k = 0; k < 3; k++) b.push({ x: c.x - vor.x * (k + 1) * rr * 0.7, z: c.z - vor.z * (k + 1) * rr * 0.7, r: rr * (0.6 + r() * 0.3) });
        gew.push({ form: 'blob', b });
      } else if (art === 'bach') {
        const s = par === 5 ? 280 + r() * 40 : L - gr - 22 - r() * 30;
        const p = this.punktBei(Math.min(s, L - gr - 18)), d = this.richtungBei(s);
        const linie = [];
        for (let k = -9; k <= 9; k++) {
          const q = k * 16;
          linie.push({ x: p.x - d.z * q + d.x * Math.sin(k * 0.9 + r()) * 6, z: p.z + d.x * q + d.z * Math.sin(k * 0.9 + r()) * 6 });
        }
        gew.push({ form: 'linie', linie, breite: 6 + r() * 3 });
      } else if (art === 'meer') {
        gew.push({ form: 'meer', seite: r() < 0.5 ? -1 : 1, abst: 40 + r() * 10 });
      }
    }
    this.gew = gew;
    const gefTyp = T.gefahr === 'eis' ? U.EIS : T.gefahr === 'lava' ? U.LAVA : U.WASSER;
    this.gefTyp = gefTyp;
    // Weg für die Golfcarts
    const wegSeite = r() < 0.5 ? -1 : 1, mitWeg = par >= 4 && r() < 0.55;

    // Masken zeichnen
    const mFair = maske(g => {
      const s0 = this.fwStart, s1 = L - gr * 0.5;
      for (let s = s0; s <= s1; s += 2.5) {
        const p = this.punktBei(s), n = this.rs.n2(s / 23, 3.3) - 0.5, d = this.richtungBei(s);
        kreis(g, p.x - d.z * n * 6, p.z + d.x * n * 6, this.fwHalb(s));
      }
    });
    const mWeg = mitWeg ? maske(g => {
      g.lineWidth = 2.4; g.beginPath();
      for (let s = 8; s < L - 25; s += 4) {
        const p = this.punktBei(s), d = this.richtungBei(s), off = this.fwHalb(s) + 9 + Math.sin(s / 30) * 3;
        const x = p.x - d.z * off * wegSeite, z = p.z + d.x * off * wegSeite;
        if (s === 8) g.moveTo(x, z); else g.lineTo(x, z);
      }
      g.stroke();
    }) : null;
    const mTee = maske(g => {
      const d = this.richtungBei(3);
      g.save(); g.translate(0, 0); g.rotate(Math.atan2(d.z, d.x) + Math.PI / 2);
      g.beginPath(); g.roundRect ? g.roundRect(-4, -8, 8, 15, 1.5) : g.rect(-4, -8, 8, 15); g.fill(); g.restore();
    });
    const mVor = maske(g => blob(g, gBlob, 1.7));
    const mGruen = maske(g => blob(g, gBlob, 0));
    const mSand = maske(g => { for (const b of bunker) blob(g, b); });
    const mGef = gew.length ? maske(g => {
      for (const w of gew) {
        if (w.form === 'blob') blob(g, w.b);
        else if (w.form === 'linie') { g.lineWidth = w.breite; g.beginPath(); w.linie.forEach((p, i) => i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z)); g.stroke(); }
      }
    }) : null;
    // Meer: Seite + Abstand aus dem Raster
    let meerFn = null;
    if (gew.some(w => w.form === 'meer')) {
      const w = gew.find(w => w.form === 'meer');
      this.meer = w;
      meerFn = (px, pz) => {
        const gx = clamp(Math.round((px - this.x0) / this.zelle), 0, this.nx - 1), gz = clamp(Math.round((pz - this.z0) / this.zelle), 0, this.nz - 1);
        const k = gz * this.nx + gx;
        return this.pSeite[k] === w.seite && this.pd[k] > w.abst + 4 + 6 * this.rs.n2(px / 30, pz / 30);
      };
    }
    // Untergrund zusammensetzen
    const N = tw * th, typ = new Uint8Array(N);
    typ.fill(U.ROUGH);
    const ok = (m, i) => m && m[i] > 127;
    for (let j = 0; j < th; j++) {
      const pz = z0 + (j + 0.5) * tr;
      for (let i = 0; i < tw; i++) {
        const k = j * tw + i;
        let t = U.ROUGH;
        if (ok(mWeg, k)) t = U.WEG;
        if (ok(mFair, k)) t = U.FAIRWAY;
        if (ok(mSand, k)) t = U.SAND;
        if (ok(mGef, k)) t = gefTyp;
        if (meerFn && t === U.ROUGH && meerFn(x0 + (i + 0.5) * tr, pz)) t = U.WASSER;
        if (ok(mTee, k)) t = U.ABSCHLAG;
        if (ok(mVor, k)) t = U.VORGRUEN;
        if (ok(mGruen, k)) t = U.GRUEN;
        typ[k] = t;
      }
    }
    this.typ = typ;
  }
  boden(x, z) {
    const i = Math.floor((x - this.x0) / this.tRes), j = Math.floor((z - this.z0) / this.tRes);
    if (i < 0 || j < 0 || i >= this.tw || j >= this.th) return U.AUS;
    return this.typ[j * this.tw + i];
  }
  param(t) { return this.params[t] || BODEN[U.ROUGH]; }

  // ---------- Gelände ----------
  grundHoehe(x, z, d, s, seite) {
    const T = this.thema, rs = this.rs;
    const A = T.huegel;
    let h = A * (rs.fbm(x / 85, z / 85, 4) - 0.5) * 2.2 + A * 1.4 * (rs.n2(x / 260 + 7, z / 260 + 3) - 0.5) * 2;
    const korr = this.fwBreite * 0.5 + 18;
    const glatt = clamp((d - korr + 12) / 30, 0, 1);
    h *= lerp(0.4, 1, glatt);
    h += this.hProfil * smooth(clamp(s / this.laenge, 0, 1));
    const q = Math.max(0, d - korr - 10);
    h += Math.min(70, T.rand * Math.pow(q / 45, 1.5) * (0.7 + 0.6 * rs.n2(x / 70, z / 70)));
    if (this.meer && seite === this.meer.seite) {
      const w = smooth(clamp((d - this.meer.abst - 2) / 10, 0, 1));
      h = lerp(h, -11, w);
    }
    return h;
  }
  hoehen() {
    const r = this.r, T = this.thema, nx = this.nx, nz = this.nz, c = this.zelle, N = nx * nz;
    this.hProfil = (r() - 0.45) * 2 * T.huegel * (T.steil ? 2.2 : 1.3);
    const H = new Float32Array(N);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      H[k] = this.grundHoehe(this.x0 + i * c, this.z0 + j * c, this.pd[k], this.pS[k], this.pSeite[k]);
    }
    // Untergrund-Masken auf Rasterauflösung
    const ras = (pred) => {
      const m = new Float32Array(N);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const t = this.typ[clamp(Math.floor(j * c / this.tRes), 0, this.th - 1) * this.tw + clamp(Math.floor(i * c / this.tRes), 0, this.tw - 1)];
        m[j * nx + i] = pred(t) ? 1 : 0;
      }
      return m;
    };
    const blur = (m, rad) => {
      if (rad < 1) return m;
      const a = new Float32Array(N), b = new Float32Array(N), w = 2 * rad + 1;
      for (let j = 0; j < nz; j++) {
        let acc = 0;
        for (let i = -rad; i <= rad; i++) acc += m[j * nx + clamp(i, 0, nx - 1)];
        for (let i = 0; i < nx; i++) {
          a[j * nx + i] = acc / w;
          acc += m[j * nx + clamp(i + rad + 1, 0, nx - 1)] - m[j * nx + clamp(i - rad, 0, nx - 1)];
        }
      }
      for (let i = 0; i < nx; i++) {
        let acc = 0;
        for (let j = -rad; j <= rad; j++) acc += a[clamp(j, 0, nz - 1) * nx + i];
        for (let j = 0; j < nz; j++) {
          b[j * nx + i] = acc / w;
          acc += a[clamp(j + rad + 1, 0, nz - 1) * nx + i] - a[clamp(j - rad, 0, nz - 1) * nx + i];
        }
      }
      return b;
    };
    const rc = m => Math.max(1, Math.round(m / c));
    const at = (x, z) => H[clamp(Math.round((z - this.z0) / c), 0, nz - 1) * nx + clamp(Math.round((x - this.x0) / c), 0, nx - 1)];
    // Fairway sanft glätten
    const fw = blur(ras(t => t === U.FAIRWAY || t === U.VORGRUEN || t === U.GRUEN), rc(6));
    const glatt = blur(H, rc(5));
    for (let k = 0; k < N; k++) H[k] = lerp(H[k], glatt[k], fw[k] * 0.6);
    // Grün: geneigte Ebene mit leichten Wellen
    const G = this.gruenM, hG = at(G.x, G.z) + 0.25;
    const ga = r() * TAU, gs = 0.012 + r() * 0.026, gph = r() * 10;
    this.gruenNeigung = { x: Math.cos(ga) * gs, z: Math.sin(ga) * gs };
    const gm = blur(ras(t => t === U.GRUEN || t === U.VORGRUEN), rc(4));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, w = clamp(gm[k] * 1.7, 0, 1);
      if (w <= 0) continue;
      const x = this.x0 + i * c, z = this.z0 + j * c;
      const zielH = hG + (x - G.x) * this.gruenNeigung.x + (z - G.z) * this.gruenNeigung.z +
        0.16 * Math.sin(x / 4.7 + gph) * Math.cos(z / 5.9 + gph * 0.7) + 0.1 * Math.sin((x + z) / 3.3 + gph);
      H[k] = lerp(H[k], zielH, smooth(w));
    }
    // Abschlag: flaches Plateau
    const hT = at(0, 0) + 0.45;
    const tm = blur(ras(t => t === U.ABSCHLAG), rc(2.5));
    for (let k = 0; k < N; k++) { const w = clamp(tm[k] * 2.2, 0, 1); if (w > 0) H[k] = lerp(H[k], hT, smooth(w)); }
    // Bunker: Mulden mit Kante
    const sm = blur(ras(t => t === U.SAND), 1);
    for (let k = 0; k < N; k++) if (sm[k] > 0) H[k] -= 0.85 * smooth(clamp(sm[k] * 1.4, 0, 1));
    // Gewässer: pro zusammenhängendem Bereich eine eigene Wasserhöhe
    this.teiche = [];
    this.wasserStandRaster = null;
    const gefRoh = ras(t => t === this.gefTyp || t === U.WASSER);
    if (gefRoh.some(v => v > 0)) {
      // Bereiche finden (Flood Fill)
      const lab = new Int16Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (!gefRoh[k] || lab[k] >= 0) continue;
        const id = this.teiche.length, stack = [k];
        lab[k] = id;
        let minH = 1e9, cnt = 0, mx0 = 1e9, mx1 = -1e9, mz0 = 1e9, mz1 = -1e9, meer = false;
        while (stack.length) {
          const q = stack.pop(), qi = q % nx, qj = (q - qi) / nx;
          minH = Math.min(minH, H[q]); cnt++;
          mx0 = Math.min(mx0, qi); mx1 = Math.max(mx1, qi); mz0 = Math.min(mz0, qj); mz1 = Math.max(mz1, qj);
          const t = this.typ[clamp(Math.floor(qj * c / this.tRes), 0, this.th - 1) * this.tw + clamp(Math.floor(qi * c / this.tRes), 0, this.tw - 1)];
          if (t === U.WASSER && this.meer) meer = true;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = qi + di, nj = qj + dj;
            if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
            const n = nj * nx + ni;
            if (gefRoh[n] && lab[n] < 0) { lab[n] = id; stack.push(n); }
          }
        }
        // Ufer: auch die Ränder ringsum berücksichtigen
        for (let qj = Math.max(0, mz0 - 2); qj <= Math.min(nz - 1, mz1 + 2); qj++)
          for (let qi = Math.max(0, mx0 - 2); qi <= Math.min(nx - 1, mx1 + 2); qi++) {
            const q = qj * nx + qi;
            if (lab[q] === id) continue;
            let nah = false;
            for (let dj = -2; dj <= 2 && !nah; dj++) for (let di = -2; di <= 2; di++) {
              const ni = qi + di, nj = qj + dj;
              if (ni >= 0 && nj >= 0 && ni < nx && nj < nz && lab[nj * nx + ni] === id) { nah = true; break; }
            }
            if (nah) minH = Math.min(minH, H[q]);
          }
        const art = meer ? 'meer' : this.gefTyp === U.EIS ? 'eis' : this.gefTyp === U.LAVA ? 'lava' : 'wasser';
        const stand = meer ? -7.5 : minH - (art === 'eis' ? 0.12 : 0.35);
        this.teiche.push({ id, stand, art, x0: this.x0 + (mx0 - 2) * c, x1: this.x0 + (mx1 + 2) * c, z0: this.z0 + (mz0 - 2) * c, z1: this.z0 + (mz1 + 2) * c, n: cnt });
      }
      const wb = blur(gefRoh, 1);
      // nächster Teich für jede Rasterecke im Uferbereich (für Wasserhöhe)
      const wr = new Int16Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (lab[k] >= 0) wr[k] = lab[k];
      for (let pass = 0; pass < 4; pass++) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (wr[k] >= 0) continue;
        if (i > 0 && wr[k - 1] >= 0) wr[k] = wr[k - 1]; else if (j > 0 && wr[k - nx] >= 0) wr[k] = wr[k - nx];
        else if (i < nx - 1 && wr[k + 1] >= 0) wr[k] = wr[k + 1]; else if (j < nz - 1 && wr[k + nx] >= 0) wr[k] = wr[k + nx];
      }
      this.wasserStandRaster = wr;
      for (let k = 0; k < N; k++) {
        const id = lab[k] >= 0 ? lab[k] : -1;
        if (id < 0) continue;
        const t = this.teiche[id];
        const w = clamp((wb[k] - 0.3) / 0.45, 0, 1);
        if (t.art === 'eis') H[k] = lerp(H[k], t.stand, smooth(clamp(wb[k] * 1.6, 0, 1)));
        else if (t.art === 'meer') H[k] = Math.min(H[k], lerp(H[k], t.stand - 3, w));
        else H[k] = Math.min(H[k], lerp(H[k], t.stand - 1.3, smooth(w)));
      }
    }
    this.H = H;
    // Normalen
    const Nn = new Float32Array(N * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)];
      const hd = H[Math.max(0, j - 1) * nx + i], hu = H[Math.min(nz - 1, j + 1) * nx + i];
      const dx = (hr - hl) / ((Math.min(nx - 1, i + 1) - Math.max(0, i - 1)) * c), dz = (hu - hd) / ((Math.min(nz - 1, j + 1) - Math.max(0, j - 1)) * c);
      const l = Math.sqrt(dx * dx + dz * dz + 1);
      Nn[k * 3] = -dx / l; Nn[k * 3 + 1] = 1 / l; Nn[k * 3 + 2] = -dz / l;
    }
    this.Nn = Nn;
  }
  hoehe(x, z, o) {
    const c = this.zelle, nx = this.nx;
    let fx = (x - this.x0) / c, fz = (z - this.z0) / c;
    fx = clamp(fx, 0, this.nx - 1.0001); fz = clamp(fz, 0, this.nz - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const k = j * nx + i, H = this.H;
    const h00 = H[k], h10 = H[k + 1], h01 = H[k + nx], h11 = H[k + nx + 1];
    // gleiche Dreiecksteilung wie das Gelände-Mesh (Diagonale von (1,0) nach (0,1))
    let h;
    if (tx + tz <= 1) h = h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    else h = h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
    if (!o) return h;
    o.h = h;
    const Nn = this.Nn, a = k * 3, b = (k + 1) * 3, cc = (k + nx) * 3, d = (k + nx + 1) * 3;
    const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
    let nX = Nn[a] * w00 + Nn[b] * w10 + Nn[cc] * w01 + Nn[d] * w11;
    let nY = Nn[a + 1] * w00 + Nn[b + 1] * w10 + Nn[cc + 1] * w01 + Nn[d + 1] * w11;
    let nZ = Nn[a + 2] * w00 + Nn[b + 2] * w10 + Nn[cc + 2] * w01 + Nn[d + 2] * w11;
    const l = Math.sqrt(nX * nX + nY * nY + nZ * nZ) || 1;
    o.nx = nX / l; o.ny = nY / l; o.nz = nZ / l;
    return h;
  }
  gefahrStand(x, z) {
    if (!this.wasserStandRaster) return -999;
    const gx = clamp(Math.round((x - this.x0) / this.zelle), 0, this.nx - 1), gz = clamp(Math.round((z - this.z0) / this.zelle), 0, this.nz - 1);
    const id = this.wasserStandRaster[gz * this.nx + gx];
    return id >= 0 ? this.teiche[id].stand : -999;
  }

  // ---------- Loch ----------
  lochSetzen() {
    const r = this.r, G = this.gruenM;
    let best = null;
    for (let t = 0; t < 40; t++) {
      const a = r() * TAU, d = r() * this.gruenR * 0.6;
      const x = G.x + Math.cos(a) * d, z = G.z + Math.sin(a) * d;
      let ok = true;
      for (let q = 0; q < 8; q++) {
        const b = q / 8 * TAU;
        if (this.boden(x + Math.cos(b) * 2.5, z + Math.sin(b) * 2.5) !== U.GRUEN) { ok = false; break; }
      }
      if (ok) { best = { x, z }; break; }
    }
    if (!best) best = { x: G.x, z: G.z };
    this.loch = { x: best.x, y: this.hoehe(best.x, best.z), z: best.z };
    this.abschlagH = this.hoehe(0, 0);
    // Startpunkt des Balls: auf dem Abschlag
    const d = this.richtungBei(3);
    this.start = { x: d.x * 1.5, z: d.z * 1.5 };
  }

  // ---------- Bäume, Steine und andere Hindernisse ----------
  hindernisseSetzen() {
    const r = this.r, T = this.thema;
    this.deko = [];           // alles, was gezeichnet wird
    this.hind = [];           // Kollisionskörper
    const raster = new Map(), CZ = 8;
    this.hRaster = raster; this.hCZ = CZ;
    const belegt = [];        // für Mindestabstände
    const frei = (x, z, d) => { for (const b of belegt) if ((b.x - x) ** 2 + (b.z - z) ** 2 < (d + b.r) ** 2) return false; return true; };
    const G = this.gruenM;
    const plaetze = (versuche, pruef) => {
      const out = [];
      for (let t = 0; t < versuche; t++) {
        const x = this.x0 - 30 + r() * (this.br + 60), z = this.z0 - 30 + r() * (this.tf + 60);
        if (pruef(x, z)) out.push({ x, z });
      }
      return out;
    };
    const imRasterOk = (x, z) => {
      const typ = this.boden(x, z);
      return typ === U.ROUGH || typ === U.AUS;
    };
    const ap = (x, z) => this.amPfad(x, z);
    // Bäume
    const arten = T.baeume;
    const summe = arten.reduce((s, a) => s + a.anteil, 0);
    const waehle = () => { let q = r() * summe; for (const a of arten) { q -= a.anteil; if (q <= 0) return a; } return arten[0]; };
    const flaeche = (this.br + 60) * (this.tf + 60);
    const versuche = Math.round(flaeche / 55 * T.dichte);
    const baumListe = plaetze(versuche, (x, z) => {
      if (!imRasterOk(x, z)) return false;
      const a = ap(x, z), fh = this.fwHalb(a.s);
      if (a.d < fh + 4.5) return false;
      if (Math.hypot(x - G.x, z - G.z) < this.gruenR + 10) return false;
      if (Math.hypot(x, z) < 16) return false;
      // freie Schussbahn vom Abschlag
      if (a.s < 70 && a.d < 20) return false;
      const n = this.rs.n2(x / 38 + 11, z / 38 - 4);
      let p = clamp((a.d - fh - 6) / 34, 0.06, 1) * (n > 0.42 ? 1 : 0.25);
      if (x < this.x0 || x > this.x0 + this.br || z < this.z0 || z > this.z0 + this.tf) p = 0.9;
      return r() < p;
    });
    for (const p of baumListe) {
      const art = waehle();
      const s = 0.75 + r() * 0.6;
      const rad = { laub: 2.6, busch: 1.3, tanne: 2, kaktus: 1, palme: 2, tot: 1.2, kirsch: 2.4 }[art.art] * s;
      if (!frei(p.x, p.z, rad * 0.8)) continue;
      belegt.push({ x: p.x, z: p.z, r: rad * 0.8 });
      const y = this.hoehe(p.x, p.z);
      const b = { art: art.art, x: p.x, y, z: p.z, s, rot: r() * TAU, farbe: art.farbe[Math.floor(r() * art.farbe.length)], schnee: art.schnee };
      this.deko.push(b);
      this.baumKoerper(b);
    }
    // Steine
    const nSt = Math.round(T.steine * 26);
    for (let t = 0, n = 0; t < nSt * 8 && n < nSt; t++) {
      const x = this.x0 + r() * this.br, z = this.z0 + r() * this.tf;
      if (!imRasterOk(x, z)) continue;
      const a = ap(x, z);
      if (a.d < this.fwHalb(a.s) + 3 || Math.hypot(x - G.x, z - G.z) < this.gruenR + 6 || Math.hypot(x, z) < 15) continue;
      const rr = 0.5 + r() * r() * 2.2;
      if (!frei(x, z, rr)) continue;
      belegt.push({ x, z, r: rr });
      const y = this.hoehe(x, z);
      this.deko.push({ art: 'stein', x, y, z, s: rr, rot: r() * TAU, farbe: T.id === 'vulkan' ? '#2a2422' : T.id === 'wueste' ? '#b07a4a' : '#8a8580' });
      this.koerper({ typ: 'kugel', x, y: y + rr * 0.25, z, r: rr, e: 0.55, art: 'stein' });
      n++;
    }
    // Themen-Deko mit Kollision
    const sonder = { schneemann: 4, laterne: 6, kuh: 3, glut: 0, blumen: 0, mesa: 0, leuchtturm: 0, laub: 0 }[T.deko] || 0;
    for (let t = 0, n = 0; t < 200 && n < sonder; t++) {
      let x, z;
      if (T.deko === 'laterne') {
        // Laternen säumen das Grün und den Fairway-Rand
        const s = this.fwStart + r() * (this.laenge - this.fwStart);
        const p = this.punktBei(s), d = this.richtungBei(s), sei = r() < 0.5 ? -1 : 1, off = this.fwHalb(s) + 3 + r() * 4;
        x = p.x - d.z * off * sei; z = p.z + d.x * off * sei;
      } else { x = this.x0 + r() * this.br; z = this.z0 + r() * this.tf; }
      if (!imRasterOk(x, z)) continue;
      const a = ap(x, z);
      if (a.d < this.fwHalb(a.s) + 2.5 || Math.hypot(x - G.x, z - G.z) < this.gruenR + 4 || Math.hypot(x, z) < 15) continue;
      if (T.deko !== 'laterne' && a.d > 60) continue;
      if (!frei(x, z, 1.5)) continue;
      belegt.push({ x, z, r: 1.5 });
      const y = this.hoehe(x, z), rot = r() * TAU;
      this.deko.push({ art: T.deko, x, y, z, s: 1, rot });
      if (T.deko === 'schneemann') { this.koerper({ typ: 'kugel', x, y: y + 0.55, z, r: 0.6, e: 0.2, art: 'schnee' }); this.koerper({ typ: 'kugel', x, y: y + 1.35, z, r: 0.42, e: 0.2, art: 'schnee' }); }
      else if (T.deko === 'laterne') this.koerper({ typ: 'zyl', x, z, r: 0.38, y0: y - 1, y1: y + 1.7, e: 0.5, art: 'stein' });
      else if (T.deko === 'kuh') this.koerper({ typ: 'zyl', x, z, r: 0.85, y0: y - 1, y1: y + 1.5, e: 0.3, art: 'kuh' });
      n++;
    }
  }
  baumKoerper(b) {
    const s = b.s, y = b.y;
    switch (b.art) {
      case 'laub': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.35 * s, y0: y - 1, y1: y + 3.4 * s, art: 'holz' });
        this.koerper({ typ: 'kugel', x: b.x, y: y + 5 * s, z: b.z, r: 2.9 * s, weich: true }); break;
      case 'kirsch': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.3 * s, y0: y - 1, y1: y + 2.8 * s, art: 'holz' });
        this.koerper({ typ: 'kugel', x: b.x, y: y + 4 * s, z: b.z, r: 2.6 * s, weich: true }); break;
      case 'busch': this.koerper({ typ: 'kugel', x: b.x, y: y + 0.6 * s, z: b.z, r: 1.3 * s, weich: true }); break;
      case 'tanne': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.3 * s, y0: y - 1, y1: y + 2 * s, art: 'holz' });
        this.koerper({ typ: 'kugel', x: b.x, y: y + 3 * s, z: b.z, r: 2.1 * s, weich: true });
        this.koerper({ typ: 'kugel', x: b.x, y: y + 5.6 * s, z: b.z, r: 1.4 * s, weich: true }); break;
      case 'kaktus': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.38 * s, y0: y - 1, y1: y + 3.6 * s, e: 0.25, art: 'holz' }); break;
      case 'palme': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.25 * s, y0: y - 1, y1: y + 7 * s, art: 'holz' });
        this.koerper({ typ: 'kugel', x: b.x + 0.6 * s, y: y + 7.4 * s, z: b.z, r: 2.4 * s, weich: true }); break;
      case 'tot': this.koerper({ typ: 'zyl', x: b.x, z: b.z, r: 0.32 * s, y0: y - 1, y1: y + 5 * s, art: 'holz' }); break;
    }
  }
  koerper(o) {
    this.hind.push(o);
    const CZ = this.hCZ, rr = (o.r || 0) + 0.2;
    const i0 = Math.floor((o.x - rr) / CZ), i1 = Math.floor((o.x + rr) / CZ), j0 = Math.floor((o.z - rr) / CZ), j1 = Math.floor((o.z + rr) / CZ);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const key = i * 73856093 ^ j * 19349663;
      let l = this.hRaster.get(key);
      if (!l) { l = []; this.hRaster.set(key, l); }
      l.push(o);
    }
  }
  naheHindernisse(x, z) {
    const key = Math.floor(x / this.hCZ) * 73856093 ^ Math.floor(z / this.hCZ) * 19349663;
    return this.hRaster.get(key) || LEER;
  }
}
const LEER = [];

// Acht Bahnen für eine Runde: jede Umgebung einmal, Par-Mischung 3/4/5
function rundePlanen(seed) {
  const r = rng(seed);
  const themen = mischen(THEMEN.slice(), r);
  const pars = mischen([3, 3, 4, 4, 4, 5, 4, 5], r);
  return themen.map((t, i) => ({ seed: (seed * 31 + i * 7919 + 17) >>> 0, nr: i, thema: t, par: pars[i] }));
}
