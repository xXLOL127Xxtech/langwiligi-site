// Turbo-Kart – Kart: Fahrphysik, Driften, Treffer, Darstellung
'use strict';

const CC = {
  50: { max: 21, acc: 0.9, name: '50 ccm' },
  100: { max: 25, acc: 1.0, name: '100 ccm' },
  150: { max: 29, acc: 1.08, name: '150 ccm' },
  200: { max: 35, acc: 1.2, name: '200 ccm' },
};
const SCHWERKRAFT = 30;
const DRIFT_STUFEN = [0.7, 1.6, 2.7];          // Ladezeit für Blau, Orange, Lila
const DRIFT_BOOST = [0, 0.85, 1.5, 2.3];       // Turbodauer je Stufe
const FUNKEN_FARBEN = [null, new THREE.Color('#4fc8ff'), new THREE.Color('#ffa21f'), new THREE.Color('#d86bff')];
const TEAMFARBEN = ['#e8352f', '#2f6fe8'];
const TEAMNAMEN = ['Rot', 'Blau'];

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

class Kart {
  constructor(r, idx, cfg) {
    this.r = r; this.idx = idx;
    this.fi = cfg.fi; this.ki = cfg.ki; this.name = cfg.name || FIGUREN[cfg.fi].name;
    this.team = cfg.team === undefined ? -1 : cfg.team;
    this.typ = cfg.typ;              // 'spieler' | 'bot' | 'netz'
    this.lokal = cfg.lokal === undefined ? -1 : cfg.lokal;
    this.slot = cfg.slot === undefined ? -1 : cfg.slot;
    this.botStufe = cfg.botStufe === undefined ? 1 : cfg.botStufe;
    this.w = werte(this.fi, this.ki);
    this.m = baueKart(this.fi, this.ki, this.team >= 0 ? TEAMFARBEN[this.team] : null);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.mYaw = 0;
    this.v = 0; this.ix = 0; this.iz = 0; this.vy = 0; this.luft = false;
    this.P = {}; this.n = new THREE.Vector3(0, 1, 0);
    this.runde = 0; this.fortschritt = 0; this.platz = idx + 1; this.fertig = false; this.zielZeit = 0; this.rundenZeiten = []; this.rundeStart = 0;
    this.drift = { an: false, dir: 0, t: 0, stufe: 0 }; this.hop = false; this.hopT = 0;
    this.boostT = 0; this.sternT = 0; this.kleinT = 0; this.tinteT = 0; this.schutzT = 0; this.raketeT = 0; this.goldT = 0;
    this.treffer = null;
    this.item = null; this.anzahl = 0; this.roulette = 0; this.rouletteItem = null;
    this.gehalten = null; this.orbit = [];
    this.muenzen = 0; this.ballons = 3; this.punkte = 0; this.tot = false;
    this.rettung = 0; this.sicher = { si: 0, yaw: 0 };
    this.sprungTrick = false; this.trick = 0;
    this.lenk = 0; this.anzeigeYaw = 0; this.driftVis = 0; this.federY = 0; this.federV = 0;
    this.falschT = 0; this.wandT = 0;
    this.startGas = -1; this.abgewuergt = 0;
    this.inp = { gas: 0, bremse: 0, lenk: 0, drift: false, item: false };
    this.flammen = [];
    for (const a of this.m.auspuff) {
      const fl = new THREE.Mesh(G.kegel(0.13, 0.7, 10), new THREE.MeshBasicMaterial({ color: '#ffb640', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.rotation.x = -Math.PI / 2; fl.position.copy(a).add(new THREE.Vector3(0, 0, -0.32));
      fl.visible = false; this.m.koerper.add(fl); this.flammen.push(fl);
      const kern = new THREE.Mesh(G.kegel(0.07, 0.38, 8), new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      kern.position.y = -0.12; fl.add(kern);
    }
    // Schattenfleck (sieht auch ohne Schattenberechnung gut aus)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ map: Tex.punkt(), color: '#000', transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
    this.schatten = sh;
    this.baueBallons();
    // Rettungs-Drohne (holt abgestürzte Karts zurück)
    const dr = new THREE.Group();
    const wolke = Mat.lam('#ffffff');
    for (const [x, y, z, r] of [[0, 0, 0, 0.75], [0.6, -0.1, 0.1, 0.55], [-0.6, -0.1, -0.05, 0.55], [0.1, 0.35, -0.2, 0.5]]) dr.add(M(G.kugel(r, 12, 8), wolke, x, y, z));
    dr.add(M(G.box(0.08, 0.5, 0.08), Mat.std('#555'), 0, 0.85, 0));
    const prop = M(G.box(1.6, 0.04, 0.16), Mat.std('#e23b3b'), 0, 1.1, 0); dr.add(prop);
    dr.add(M(G.zyl(0.025, 0.025, 2.4, 5), Mat.std('#dddddd'), 0, -1.6, 0));
    dr.add(M(G.torus(0.18, 0.04, Math.PI * 1.5, 6, 12), Mat.std('#9aa0aa', { metalness: 0.6 }), 0.1, -2.9, 0, 0, 0, Math.PI));
    auge(null, 0.22, 0.12, 0.66, 1.1, dr); auge(null, -0.22, 0.12, 0.66, 1.1, dr);
    dr.visible = false; dr.userData.prop = prop;
    this.drohne = dr; this.drohneT = 0;
  }
  get farbe() { return this.team >= 0 ? TEAMFARBEN[this.team] : FIGUREN[this.fi].f1; }
  istMensch() { return this.typ === 'spieler' || this.typ === 'netz'; }
  baueBallons() {
    const g = this.m.ballons;
    g.clear();
    this.ballonMeshes = [];
    const f = this.farbe;
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const kugel = M(G.kugel(0.42, 14, 10), Mat.std(f, { roughness: 0.25, emissive: new THREE.Color(f), emissiveIntensity: 0.15 }), 0, 1.3, 0, 0, 0, 0, 1, 1.15, 1);
      const faden = M(G.zyl(0.015, 0.015, 1.0, 4), Mat.std('#ffffff'), 0, 0.5, 0);
      b.add(kugel, faden);
      b.position.set((i - 1) * 0.42, 0, -0.05 * Math.abs(i - 1));
      b.rotation.z = (1 - i) * 0.3;
      g.add(b); this.ballonMeshes.push(b);
    }
    g.visible = false;
  }
  setzeStart(pos, yaw) {
    this.pos.copy(pos); this.yaw = this.mYaw = this.anzeigeYaw = yaw;
    this.v = 0; this.vy = 0; this.ix = this.iz = 0; this.luft = false;
    this.P.si = undefined;
    this.r.welt.proj(this.P, pos.x, pos.y + 1, pos.z);
    this.pos.y = this.P.bodenY;
    this.sicher = { si: this.P.si, yaw };
    this.m.root.position.copy(this.pos);
  }
  // ---------- Physik ----------
  schritt(dt, inp) {
    const r = this.r, welt = r.welt, cc = CC[r.cc];
    this.inp = inp;
    // Zeitgeber
    for (const k of ['boostT', 'sternT', 'kleinT', 'tinteT', 'schutzT', 'raketeT', 'goldT', 'abgewuergt', 'wandT', 'matschT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.roulette > 0) {
      this.roulette -= dt;
      if (this.roulette <= 0) { this.item = this.rouletteItem; this.anzahl = /3$/.test(this.item) ? 3 : 1; if (this.item === 'goldnitro') this.goldT = 0; if (this.lokal >= 0) Ton.sfx('itemda'); }
    }
    if (this.rettung > 0) { this.rettungSchritt(dt); return; }
    if (this.treffer) {
      this.treffer.t += dt;
      if (this.treffer.t >= this.treffer.dauer) { this.treffer = null; this.schutzT = Math.max(this.schutzT, 1.2); }
    }
    const lenkbar = !this.treffer && !this.tot && r.phase === 'rennen' && this.abgewuergt <= 0;
    let gas = lenkbar ? inp.gas || 0 : 0, bremse = lenkbar ? inp.bremse || 0 : 0, lenk = lenkbar ? inp.lenk || 0 : 0;
    if (this.raketeT > 0) { gas = 1; bremse = 0; }
    this.lenk = damp(this.lenk, lenk, 16, dt);
    // Beim Driften wird die Lenkung geglättet, damit Tastatur-Lenken nicht ruckelt
    this.driftLenk = damp(this.driftLenk || 0, lenk, 13, dt);
    // Höchstgeschwindigkeit
    const P = this.P;
    let vmax = cc.max * (0.93 + this.w.tempo * 0.02) * (1 + Math.min(this.muenzen, 10) * 0.005);
    if (this.typ === 'bot') vmax *= this.botTempo || 1;
    if (this.kleinT > 0) vmax *= 0.72;
    const gelaende = !this.luft && P.flaeche === 'gelaende';
    if (gelaende && this.boostT <= 0 && this.sternT <= 0 && this.raketeT <= 0) vmax *= clamp(0.5 + this.w.gelaende * 0.12, 0.4, 0.66);
    // Pfütze (Matsch, Sand, Öl …): bremst wie Gelände, Buggys kommen besser durch
    const matsch = this.matschT > 0 && !this.luft && this.boostT <= 0 && this.sternT <= 0 && this.raketeT <= 0;
    if (matsch) vmax *= clamp(0.52 + this.w.gelaende * 0.1, 0.45, 0.65);
    let vZiel = vmax;
    if (this.sternT > 0) vZiel = vmax * 1.16;
    if (this.boostT > 0) vZiel = Math.max(vZiel, vmax * 1.36);
    if (this.raketeT > 0) vZiel = cc.max * 1.55;
    const beschl = (9.5 + this.w.beschl * 2.9) * cc.acc;
    if (this.treffer) {
      this.v *= Math.exp(-2.6 * dt);
    } else if (this.boostT > 0 || this.raketeT > 0 || (this.sternT > 0 && gas)) {
      if (this.v < vZiel) this.v = Math.min(vZiel, this.v + 45 * dt);
      else this.v = damp(this.v, vZiel, 2, dt);
    } else if (gas && !bremse) {
      if (this.v < 0) this.v += 30 * dt;
      else if (this.v < vZiel) this.v = Math.min(vZiel, this.v + beschl * dt * (1 - 0.6 * this.v / vZiel));
      else this.v = damp(this.v, vZiel, gelaende || matsch ? 3.5 : 1.5, dt);
    } else if (bremse) {
      if (this.v > 0.5) this.v -= 32 * dt;
      else this.v = Math.max(-9, this.v - 14 * dt);
    } else {
      this.v = damp(this.v, 0, gelaende ? 1.8 : 0.8, dt);
    }
    if (this.luft && !this.treffer) this.v *= Math.exp(-0.04 * dt);
    // Lenken & Driften
    const handl = 1.35 + this.w.handling * 0.13;
    const va = Math.abs(this.v);
    const vf = clamp(va / 7, 0, 1) * (1 - 0.22 * clamp((va - cc.max * 0.55) / cc.max, 0, 1));
    let dreh = 0;
    const d = this.drift;
    if (inp.driftDruck && lenkbar && !this.luft && this.raketeT <= 0) {
      this.vy = 4.3; this.luft = true; this.hop = true;
      if (this.lokal >= 0) Ton.sfx('hop', 0.7);
    }
    if (d.an) {
      if (!inp.drift || va < 8 || this.treffer || !lenkbar || bremse) this.driftEnde(lenkbar && !bremse);
    } else if (inp.drift && lenkbar && va > 10 && Math.abs(lenk) > 0.3 && this.raketeT <= 0 && this.hop) {
      d.an = true; d.dir = Math.sign(lenk); d.t = 0; d.stufe = 0;
    }
    if (d.an) {
      const eng = clamp((this.driftLenk * d.dir + 1) / 2, 0, 1);
      // eng (in die Kurve lenken) bis weit (dagegen lenken): grosser Spielraum wie bei Mario Kart
      dreh = -d.dir * handl * (0.4 + 1.05 * eng) * vf;
      d.t += dt * (0.65 + 0.85 * eng) * (this.luft ? 0.3 : 1);
      const st = d.t > DRIFT_STUFEN[2] ? 3 : d.t > DRIFT_STUFEN[1] ? 2 : d.t > DRIFT_STUFEN[0] ? 1 : 0;
      if (st > d.stufe) { d.stufe = st; if (this.lokal >= 0) Ton.sfx('funke' + st, 0.8); }
    } else {
      dreh = -lenk * handl * vf * (this.v < 0 ? -1 : 1);
    }
    if (this.raketeT > 0) dreh = 0;
    if (P.eis && !this.luft) dreh *= 0.75;
    if (this.luft) dreh *= 0.6;
    this.yaw = wrapA(this.yaw + dreh * dt);
    this.driftVis = damp(this.driftVis, d.an ? -d.dir * 0.36 : 0, 8, dt);
    // Bewegungsrichtung folgt der Nase mit Haftung
    const haft = this.luft ? 1.2 : P.eis ? 2.4 : d.an ? 7.5 : 18;
    this.mYaw = wrapA(this.yaw + wrapA(this.mYaw - this.yaw) * Math.exp(-haft * dt));
    if (d.an && !this.luft) {
      // leichtes Rutschen nach aussen
      this.ix += -Math.cos(this.mYaw) * d.dir * 1.6 * dt * -1;
      this.iz += Math.sin(this.mYaw) * d.dir * 1.6 * dt * -1;
    }
    // Rakete fährt allein der Strecke nach
    if (this.raketeT > 0 && !welt.istArena) {
      const tp = welt.punkt(P.s + 18, welt.S[welt.idx(P.s + 18)].ideal * 0.3, _v1);
      const soll = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
      this.yaw = this.mYaw = wrapA(this.yaw + wrapA(soll - this.yaw) * Math.min(1, 6 * dt));
    }
    // Bewegen
    const sx = Math.sin(this.mYaw), sz = Math.cos(this.mYaw);
    this.pos.x += (sx * this.v + this.ix) * dt;
    this.pos.z += (sz * this.v + this.iz) * dt;
    const ab = Math.exp(-5 * dt); this.ix *= ab; this.iz *= ab;
    // Boden
    welt.proj(P, this.pos.x, this.pos.y, this.pos.z);
    let bodenY = P.bodenY;
    // Schanzen heben den Boden an
    let schanze = -1;
    if (!welt.istArena) for (const rp of welt.rampen) {
      let ds = P.s - rp.s; if (ds > welt.L / 2) ds -= welt.L; if (ds < -welt.L / 2) ds += welt.L;
      if (ds > -3 && ds < 3 && Math.abs(P.d) < rp.w) { bodenY += (ds + 3) / 6 * 0.9; schanze = ds; }
    }
    let ueberRand = false;
    if (!welt.istArena && Math.abs(P.d) > P.lim) {
      if (P.fall) { ueberRand = true; bodenY = -1e9; }
    }
    // Wände
    if (welt.istArena) {
      const w = welt.wand(this.pos.x, this.pos.z, 1.15);
      if (w) this.wandStoss(w.x, w.z);
    } else if (!P.fall) {
      const grenze = P.lim - 1.1;
      if (Math.abs(P.d) > grenze) {
        const sgn = Math.sign(P.d), push = Math.abs(P.d) - grenze;
        this.wandStoss(-P.hx * sgn * push, -P.hz * sgn * push);
      }
    }
    const g = SCHWERKRAFT * (welt.schwer || 1);
    if (!this.luft) {
      if (ueberRand) { this.luft = true; this.vy = 0; }
      else if (this.pos.y - bodenY > 0.8 && va > 15) { this.luft = true; this.vy = Math.min(this.vy, 0); }
      else this.pos.y = bodenY;
    }
    if (this.luft) {
      this.vy -= g * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= bodenY) {
        this.pos.y = bodenY;
        const hart = this.vy < -9;
        this.luft = false; this.vy = 0;
        if (this.hop) {
          this.hop = false;
          if (!d.an && inp.drift && lenkbar && va > 10 && Math.abs(lenk) > 0.3) { d.an = true; d.dir = Math.sign(lenk); d.t = 0; d.stufe = 0; }
        }
        if (this.trick > 0) { this.boost(0.9, 'trick'); this.trick = 0; }
        if (hart) { this.federV = -3; if (this.lokal >= 0) Ton.sfx('land', 0.7); }
      }
    }
    // Sicherer Punkt / Absturz
    if (!this.luft && !ueberRand && P.flaeche !== 'gelaende' && !welt.istArena) this.sicher = { si: P.si, yaw: this.yaw };
    if (this.pos.y < (welt.todY !== undefined ? welt.todY : -40) || (ueberRand && this.pos.y < P.bodenY - 14)) this.starteRettung();
    // Strecken-Elemente
    if (!welt.istArena && !this.luft) {
      for (const b of welt.boosts) {
        let ds = P.s - b.s; if (ds > welt.L / 2) ds -= welt.L; if (ds < -welt.L / 2) ds += welt.L;
        if (ds > -b.l && ds < b.l && Math.abs(P.d - b.d) < b.b + 0.6) { if (this.boostT < 0.9) this.boost(1.1, 'feld'); }
      }
      for (const b of welt.bremsen || []) {
        let ds = P.s - b.s; if (ds > welt.L / 2) ds -= welt.L; if (ds < -welt.L / 2) ds += welt.L;
        if (ds > -b.l && ds < b.l && Math.abs(P.d - b.d) < b.b) {
          if (!(this.matschT > 0) && this.lokal >= 0 && va > 6 && this.boostT <= 0 && this.sternT <= 0) Ton.sfx('land', 0.5);
          this.matschT = 0.2;
        }
      }
      for (const h of welt.huetchen || []) {
        if (h.weg) continue;
        const dx = this.pos.x - h.p.x, dz = this.pos.z - h.p.z;
        if (dx * dx + dz * dz < 1.5 * 1.5 && Math.abs(this.pos.y - h.p.y) < 2) {
          welt.huetchenTreffer(h, this);
          if (this.sternT <= 0 && this.raketeT <= 0) this.v *= 0.7;
          if (this.lokal >= 0) { Ton.sfx('wand', 0.5); this.r.kameraWackeln(this.lokal, 0.15); }
        }
      }
      if (schanze > 2.2 && this.v > 8) {
        this.luft = true; this.vy = 6 + this.v * 0.22; this.sprungTrick = true; this.trickFenster = 0.35;
      }
    }
    if (this.sprungTrick && this.luft) {
      this.trickFenster -= dt;
      if (inp.driftDruck && this.trickFenster > -0.15 && this.trick === 0 && lenkbar) { this.trick = 1; this.trickAnim = 0; if (this.lokal >= 0) Ton.sfx('trick'); this.r.fx.text(this, 'Trick!'); }
      if (!this.luft) this.sprungTrick = false;
    } else if (!this.luft) this.sprungTrick = false;
    if (this.trick > 0) this.trickAnim = (this.trickAnim || 0) + dt;
    // Runden
    if (!welt.istArena) this.rundenCheck();
    // Bodennormale glätten
    const zielN = this.luft ? UP : _v2.set(P.nx, P.ny, P.nz);
    this.n.lerp(zielN, 1 - Math.exp(-10 * dt)).normalize();
    // Falsche Richtung
    if (!welt.istArena && r.phase === 'rennen' && !this.fertig) {
      const hd = welt.S[P.si].h;
      if (Math.abs(wrapA(this.yaw - hd)) > 2.1 && va > 3) this.falschT += dt; else this.falschT = Math.max(0, this.falschT - dt * 2);
    }
  }
  wandStoss(px, pz) {
    this.pos.x += px; this.pos.z += pz;
    const l = Math.hypot(px, pz) || 1;
    const nx = px / l, nz = pz / l;
    const vx = Math.sin(this.mYaw) * this.v + this.ix, vz = Math.cos(this.mYaw) * this.v + this.iz;
    const vn = vx * nx + vz * nz;
    if (vn < 0) {
      const tempo = Math.hypot(vx, vz) || 1;
      const stoss = -vn / tempo;
      const nvx = vx - 1.35 * vn * nx, nvz = vz - 1.35 * vn * nz;
      let nl = Math.hypot(nvx, nvz) * (1 - 0.45 * stoss);
      if (this.raketeT > 0 || this.sternT > 0) nl = Math.max(nl, tempo * 0.9);
      if (this.v >= 0) { this.mYaw = Math.atan2(nvx, nvz); this.v = nl; } else { this.mYaw = Math.atan2(-nvx, -nvz); this.v = -nl; }
      this.ix = 0; this.iz = 0;
      this.yaw = wrapA(this.yaw + wrapA(this.mYaw - this.yaw) * 0.5);
      if (stoss > 0.25 && tempo > 8 && this.wandT <= 0) {
        this.wandT = 0.3;
        if (this.lokal >= 0) { Ton.sfx('wand', Math.min(1, stoss * 1.5)); this.r.kameraWackeln(this.lokal, 0.3 * stoss); }
        this.r.fx.funken(this.pos, nx, nz);
        if (this.drift.an && stoss > 0.5) this.driftEnde(false);
      }
    }
  }
  driftEnde(boost) {
    const d = this.drift;
    if (boost && d.stufe > 0) {
      this.boost(DRIFT_BOOST[d.stufe], 'drift' + d.stufe);
    }
    d.an = false; d.t = 0; d.stufe = 0; d.dir = 0;
  }
  boost(dauer, art) {
    this.boostT = Math.max(this.boostT, dauer);
    this.v = Math.max(this.v, CC[this.r.cc].max * 0.95);
    if (this.lokal >= 0) { Ton.sfx(art && art.startsWith('drift') ? 'mini1' : 'boost', 0.9); this.r.kameraStoss(this.lokal); }
  }
  rundenCheck() {
    const w = this.r.welt, L = w.L;
    let s = this.P.s - w.startS; s = ((s % L) + L) % L;
    const alt = this.relS === undefined ? s : this.relS;
    if (alt > L * 0.75 && s < L * 0.25) {
      this.runde++;
      this.r.rundeGeschafft(this);
    } else if (alt < L * 0.25 && s > L * 0.75) this.runde--;
    this.relS = s;
    this.fortschritt = this.runde * L + s;
  }
  starteRettung() {
    if (this.rettung > 0) return;
    this.rettung = 1.8; this.driftEnde(false);
    this.v = 0; this.boostT = 0;
    if (this.lokal >= 0) Ton.sfx('falle');
    this.verliereMuenzen(2);
    this.r.ereignis('rettung', this);
  }
  rettungSchritt(dt) {
    const alt = this.rettung;
    this.rettung -= dt;
    if (alt > 0.9 && this.rettung <= 0.9) {
      // Zurück auf die Strecke setzen
      const w = this.r.welt;
      if (w.istArena) { this.pos.set(0, 0, 0); }
      else {
        const s = w.S[(this.sicher.si - 4 + w.n) % w.n];
        this.pos.set(s.p.x, s.p.y + 5, s.p.z);
        this.yaw = this.mYaw = s.h;
        this.P.si = (this.sicher.si - 4 + w.n) % w.n;
      }
      if (this.lokal >= 0) Ton.sfx('rettung');
    }
    if (this.rettung <= 0.9) {
      const w = this.r.welt;
      w.proj(this.P, this.pos.x, this.pos.y, this.pos.z);
      this.pos.y = this.P.bodenY + Math.max(0, this.rettung) * 5;
    }
    if (this.rettung <= 0) { this.rettung = 0; this.schutzT = 1.5; this.luft = false; this.v = 0; this.vy = 0; }
    this.v = 0;
  }
  // Treffer: art 'dreh' (Banane), 'salto' (Kugel/Bombe), 'platt' (zerquetscht), 'blitz'
  getroffen(art, quelle) {
    if (this.rettung > 0) return false;
    if (this.sternT > 0 || this.raketeT > 0) return false;
    if (this.schutzT > 0 && art !== 'blitz') return false;
    if (this.treffer && art !== 'blitz') return false;
    this.driftEnde(false);
    this.boostT = 0;
    const dauer = art === 'dreh' ? 1.15 : art === 'salto' ? 1.35 : art === 'platt' ? 1.6 : 1.0;
    this.treffer = { art, t: 0, dauer };
    if (art === 'salto') { this.vy = 7; this.luft = true; this.v *= 0.3; }
    if (art === 'dreh') this.v *= 0.6;
    if (art === 'platt') this.v *= 0.3;
    this.verliereMuenzen(art === 'dreh' ? 2 : 3);
    // Gehaltene Items fallen weg
    if (this.gehalten) { this.r.items.entferneGehalten(this); }
    if (this.orbit.length && art !== 'dreh') this.r.items.entferneOrbit(this);
    if (this.lokal >= 0) { Ton.sfx(art === 'dreh' ? 'dreh' : 'treffer'); this.r.kameraWackeln(this.lokal, 0.6); }
    this.r.ereignis('treffer', this, { art, quelle });
    return true;
  }
  verliereMuenzen(n) {
    if (this.r.welt.istArena) return;
    const weg = Math.min(n, this.muenzen);
    this.muenzen -= weg;
    if (weg > 0) this.r.fx.muenzenWeg(this.pos, weg);
  }
  // ---------- Darstellung ----------
  darstellen(dt, zeit) {
    const m = this.m;
    // Tiefe beim Rettungsflug
    m.root.visible = !(this.rettung > 0.9);
    m.root.position.copy(this.pos);
    // Federung
    this.federV += (-this.federY * 120 - this.federV * 10) * dt;
    this.federY += this.federV * dt;
    // Ausrichtung: Normale * Richtung
    _q1.setFromUnitVectors(UP, this.n);
    const tr = this.treffer;
    this.anzeigeYaw = this.yaw + this.driftVis;
    _q2.setFromAxisAngle(UP, this.anzeigeYaw);
    m.root.quaternion.copy(_q1).multiply(_q2);
    // Körper: Schaukeln, Treffer-Animationen
    const k = m.koerper;
    k.position.set(0, this.federY * 0.3 + (this.drift.an ? Math.sin(zeit * 30) * 0.02 : 0), 0);
    let rx = 0, ry = 0, rz = -this.lenk * 0.06 * clamp(this.v / 15, 0, 1);
    if (tr) {
      const f = tr.t / tr.dauer;
      if (tr.art === 'dreh') ry = smooth(Math.min(1, f * 1.1)) * TAU * 2;
      if (tr.art === 'salto') { rx = -smooth(Math.min(1, f * 1.25)) * TAU; ry = Math.sin(f * Math.PI) * 0.6; }
      if (tr.art === 'blitz') ry = f * TAU * 1.5;
    }
    if (this.trick > 0 || (this.trickAnim && this.trickAnim < 0.5)) {
      const f = clamp((this.trickAnim || 0) / 0.45, 0, 1);
      rz += Math.sin(f * Math.PI) * 0.5; ry += smooth(f) * TAU * (this.idx % 2 ? 1 : -1) * (f < 1 ? 1 : 0);
      if (f >= 1 && this.trick === 0) this.trickAnim = 1;
    }
    k.rotation.set(rx, ry, rz);
    let sk = this.kleinT > 0 ? 0.55 : 1;
    if (this.kleinT > 0 && this.kleinT < 0.4) sk = lerp(1, 0.55, this.kleinT / 0.4);
    const platt = tr && tr.art === 'platt' ? 0.25 : 1;
    m.koerper.scale.set(sk, sk * platt, sk);
    // Räder
    for (const rad of m.raeder) {
      rad.rad.rotation.x += this.v * dt / 0.38;
      if (rad.vorne) rad.piv.rotation.y = -this.lenk * 0.45;
    }
    m.lenkrad.rotation.z = this.lenk * 1.4;
    // Fahrer
    const fg = m.fig;
    fg.gruppe.rotation.z = -this.lenk * 0.18 * clamp(this.v / 10, 0, 1);
    fg.kopf.rotation.y = -this.lenk * 0.35;
    const jubel = this.fertig && this.platz <= 3 && !this.r.welt.istArena;
    fg.armL.rotation.x = jubel ? -2.6 + Math.sin(zeit * 8) * 0.3 : 0;
    fg.armR.rotation.x = jubel ? -2.6 + Math.cos(zeit * 8) * 0.3 : 0;
    fg.kopf.position.y = 0.95 + Math.sin(zeit * 9 + this.idx) * 0.012 * clamp(this.v / 10, 0, 1);
    // Turbo-Flammen
    const fl = this.boostT > 0 || this.raketeT > 0;
    for (const f of this.flammen) {
      f.visible = fl || (this.drift.an && this.drift.stufe > 0);
      if (f.visible) {
        const st = fl ? 1 : 0.45;
        const s = st * (0.85 + Math.random() * 0.4);
        f.scale.set(s, s * (fl ? 1.4 : 0.8), s);
        f.material.color.set(fl ? (this.boostT > 1.5 ? '#c070ff' : '#ffaa30') : FUNKEN_FARBEN[this.drift.stufe]);
      }
    }
    // Stern: Regenbogenfarben
    if (this.sternT > 0) {
      m.lack.emissive = m.lack.emissive || new THREE.Color();
      m.lack.color.setHSL((zeit * 2) % 1, 1, 0.55);
      m.lack.emissive.setHSL((zeit * 2 + 0.5) % 1, 1, 0.35);
      this._stern = true;
    } else if (this._stern) {
      this._stern = false;
      m.lack.color.set(this.farbe); m.lack.emissive.set('#000');
    }
    // Blinken bei Schutz
    m.koerper.visible = !(this.schutzT > 0 && !this.treffer && Math.floor(zeit * 16) % 2 === 0 && this.rettung <= 0);
    // Ballons
    if (this.r.welt.istArena) {
      m.ballons.visible = true;
      this.ballonMeshes.forEach((b, i) => { b.visible = i < this.ballons; b.children[0].position.y = 1.3 + Math.sin(zeit * 3 + i) * 0.06; });
    }
    // Rettungs-Drohne
    const dr = this.drohne;
    if (this.rettung > 0 && this.rettung <= 0.9) { this.drohneT = 0.7; dr.position.set(this.pos.x, this.pos.y + 4.0, this.pos.z); dr.rotation.y = this.yaw; }
    else if (this.drohneT > 0) { this.drohneT -= dt; dr.position.y += dt * 9; }
    dr.visible = (this.rettung > 0 && this.rettung <= 0.9) || this.drohneT > 0;
    if (dr.visible) dr.userData.prop.rotation.y += dt * 30;
    // Schatten
    const sh = this.schatten;
    sh.position.set(this.pos.x, (this.luft ? this.P.bodenY : this.pos.y) + 0.06, this.pos.z);
    sh.rotation.z = this.anzeigeYaw;
    sh.material.opacity = this.rettung > 0.9 || this.P.bodenY < -1e8 ? 0 : 0.45 * clamp(1 - (this.pos.y - this.P.bodenY) / 8, 0, 1);
    sh.visible = m.root.visible;
  }
  hinterradPos(i, out) {
    const r = this.m.raeder[2 + i];
    r.piv.getWorldPosition(out);
    out.y -= 0.3;
    return out;
  }
  // ---------- Netz ----------
  zustand() {
    const f = (this.drift.an ? 1 : 0) | (this.drift.dir > 0 ? 2 : 0) | (this.drift.stufe << 2) | (this.boostT > 0 ? 16 : 0) | (this.sternT > 0 ? 32 : 0) |
      (this.kleinT > 0 ? 64 : 0) | (this.raketeT > 0 ? 128 : 0) | (this.luft ? 256 : 0) | (this.rettung > 0.9 ? 512 : 0) | (this.fertig ? 1024 : 0) |
      (this.schutzT > 0 ? 2048 : 0) | (this.boostT > 1.5 ? 4096 : 0);
    const tr = this.treffer ? ['dreh', 'salto', 'platt', 'blitz'].indexOf(this.treffer.art) + 1 : 0;
    return [r2(this.pos.x), r2(this.pos.y), r2(this.pos.z), r2(this.yaw), r2(this.v), f, tr, this.treffer ? r2(this.treffer.t) : 0, this.runde, r2(this.fortschritt), r2(this.zielZeit), r2(this.lenk), this.muenzen];
  }
  setzeZustand(a, sofort) {
    this.ziel = this.ziel || new THREE.Vector3();
    this.ziel.set(a[0], a[1], a[2]);
    this.zielYaw = a[3];
    if (sofort || this.pos.distanceToSquared(this.ziel) > 400) { this.pos.copy(this.ziel); this.yaw = a[3]; }
    this.v = a[4];
    const f = a[5];
    this.drift.an = !!(f & 1); this.drift.dir = f & 2 ? 1 : -1; this.drift.stufe = (f >> 2) & 3;
    if (!this.drift.an) this.drift.dir = 0;
    this.boostT = f & 16 ? (f & 4096 ? 2 : 0.5) : 0;
    this.sternT = f & 32 ? 1 : 0; this.kleinT = f & 64 ? 1 : 0; this.raketeT = f & 128 ? 1 : 0;
    this.luft = !!(f & 256); this.rettung = f & 512 ? 1.5 : 0; this.schutzT = f & 2048 ? 0.5 : 0;
    const fertigNeu = !!(f & 1024);
    const tr = a[6];
    if (tr) { const art = ['dreh', 'salto', 'platt', 'blitz'][tr - 1]; if (!this.treffer || this.treffer.art !== art) this.treffer = { art, t: a[7], dauer: art === 'dreh' ? 1.15 : art === 'salto' ? 1.35 : art === 'platt' ? 1.6 : 1.0 }; }
    else this.treffer = null;
    this.runde = a[8]; this.fortschritt = a[9];
    if (fertigNeu && !this.fertig) { this.fertig = true; this.zielZeit = a[10]; }
    this.lenkNetz = a[11];
    this.muenzen = a[12] || 0;
  }
  // Fremdes Kart weich nachführen
  netzSchritt(dt) {
    if (!this.ziel) return;
    // Vorhersage: Ziel mit Geschwindigkeit weiterschieben
    this.ziel.x += Math.sin(this.zielYaw) * this.v * dt;
    this.ziel.z += Math.cos(this.zielYaw) * this.v * dt;
    this.pos.lerp(this.ziel, 1 - Math.exp(-12 * dt));
    this.yaw = wrapA(this.yaw + wrapA(this.zielYaw - this.yaw) * (1 - Math.exp(-12 * dt)));
    this.mYaw = this.yaw;
    this.lenk = damp(this.lenk, this.lenkNetz || 0, 10, dt);
    this.driftVis = damp(this.driftVis, this.drift.an ? -this.drift.dir * 0.42 : 0, 8, dt);
    this.r.welt.proj(this.P, this.pos.x, this.pos.y, this.pos.z);
    this.n.lerp(this.luft ? UP : _v2.set(this.P.nx, this.P.ny, this.P.nz), 1 - Math.exp(-10 * dt)).normalize();
    if (this.treffer) this.treffer.t = Math.min(this.treffer.dauer, this.treffer.t + dt);
  }
}
