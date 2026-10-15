// Golf-Tour – Ballphysik: Flug mit Luftwiderstand, Magnus-Effekt (Drall) und Wind,
// Aufprall mit Spin-Reibung (Rückwärtsdrall bremst, Vorwärtsdrall rollt weiter), Rollen auf Schräglagen, Loch und Hindernisse.
// Läuft ohne Three.js (auch in Node zum Testen).
'use strict';

const PH = {
  G: 9.81,
  R: 0.02135,          // Ballradius (m)
  M: 0.04593,          // Ballmasse (kg)
  RHO: 1.2,            // Luftdichte
  R_LOCH: 0.054,       // Lochradius
  R_FAHNE: 0.0125,     // Fahnenstange
  H_FAHNE: 2.3,
  DT: 1 / 240,
};
PH.A = Math.PI * PH.R * PH.R;
PH.LUFT = 0.5 * PH.RHO * PH.A / PH.M;

// Untergründe: e = Rückprall, mu = Reibung beim Aufprall, mr = Rollwiderstand, k = Gras-Bremse (proportional zur Geschwindigkeit),
// lieV/lieS = Faktor für Ballgeschwindigkeit/Drall beim Schlag aus dieser Lage, streu = Streuung in Grad
const U = { ROUGH: 0, FAIRWAY: 1, GRUEN: 2, VORGRUEN: 3, ABSCHLAG: 4, SAND: 5, WASSER: 6, EIS: 7, LAVA: 8, AUS: 9, WEG: 10 };
const BODEN = [];
BODEN[U.ROUGH] = { name: 'Rough', e: 0.2, mu: 0.62, mr: 0.32, k: 0.9, lieV: 0.84, lieS: 0.55, streu: 1.2 };
BODEN[U.FAIRWAY] = { name: 'Fairway', weich: 0.8, e: 0.30, mu: 0.5, mr: 0.17, k: 0.32, lieV: 1, lieS: 1, streu: 0 };
BODEN[U.GRUEN] = { name: 'Grün', e: 0.30, mu: 0.42, mr: 0.062, k: 0.02, lieV: 1, lieS: 1, streu: 0 };
BODEN[U.VORGRUEN] = { name: 'Vorgrün', e: 0.28, mu: 0.46, mr: 0.11, k: 0.12, lieV: 1, lieS: 0.95, streu: 0 };
BODEN[U.ABSCHLAG] = { name: 'Abschlag', weich: 0.8, e: 0.30, mu: 0.5, mr: 0.17, k: 0.32, lieV: 1, lieS: 1, streu: 0 };
BODEN[U.SAND] = { name: 'Bunker', weich: 0, e: 0.05, mu: 0.85, mr: 0.9, k: 1.6, lieV: 0.7, lieS: 0.45, streu: 2.2 };
BODEN[U.WASSER] = { name: 'Wasser', e: 0, mu: 1, mr: 5, k: 5, lieV: 0.5, lieS: 0.5, streu: 3, gefahr: true };
BODEN[U.EIS] = { name: 'Eis', weich: 0, e: 0.5, mu: 0.08, mr: 0.018, k: 0.0, lieV: 0.95, lieS: 0.6, streu: 0.8 };
BODEN[U.LAVA] = { name: 'Lava', e: 0, mu: 1, mr: 5, k: 5, lieV: 0.5, lieS: 0.5, streu: 3, gefahr: true };
BODEN[U.AUS] = { name: 'Aus', e: 0.2, mu: 0.6, mr: 0.35, k: 0.6, lieV: 0.8, lieS: 0.5, streu: 1.5 };
BODEN[U.WEG] = { name: 'Weg', weich: 0.1, e: 0.55, mu: 0.35, mr: 0.08, k: 0.01, lieV: 0.95, lieS: 0.9, streu: 0.3 };

// Schläger: v = Ballgeschwindigkeit bei voller Kraft (m/s), loft = Abflugwinkel (°), rpm = Rückwärtsdrall
const SCHLAEGER = [
  { id: 'D', name: 'Driver', kurz: 'Dr', v: 70, loft: 11, rpm: 2600 },
  { id: 'H3', name: 'Holz 3', kurz: 'H3', v: 61, loft: 14.5, rpm: 3500 },
  { id: 'E4', name: 'Eisen 4', kurz: 'E4', v: 55, loft: 18, rpm: 4600 },
  { id: 'E6', name: 'Eisen 6', kurz: 'E6', v: 50, loft: 23, rpm: 5900 },
  { id: 'E8', name: 'Eisen 8', kurz: 'E8', v: 44.5, loft: 30, rpm: 7400 },
  { id: 'PW', name: 'Pitching Wedge', kurz: 'PW', v: 39.5, loft: 37, rpm: 8600 },
  { id: 'SW', name: 'Sand Wedge', kurz: 'SW', v: 33, loft: 47, rpm: 9800 },
  { id: 'P', name: 'Putter', kurz: 'Pt', v: 0, loft: 0, rpm: 0, putter: true },
];

// ---------- kleine Vektor-Helfer (Objekte {x,y,z}) ----------
const V3 = {
  neu: (x = 0, y = 0, z = 0) => ({ x, y, z }),
  set: (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; },
  kopie: (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; },
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  len: a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  kreuz: (o, a, b) => { const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x; o.x = x; o.y = y; o.z = z; return o; },
};

// Treffer aus der Höhenabfrage (wiederverwendet)
const _hb = { h: 0, nx: 0, ny: 1, nz: 0 };
const _t1 = V3.neu(), _t2 = V3.neu(), _t3 = V3.neu();

// kurs muss liefern: hoehe(x,z,out) -> out.h + Normale, boden(x,z) -> Typ, param(typ) -> BODEN-Eintrag,
// gefahrStand(x,z) -> Höhe der Wasser-/Lavafläche, imFeld(x,z), naheHindernisse(x,z) -> Liste, loch {x,y,z}, wind {x,z}
class Ball {
  constructor(kurs) {
    this.kurs = kurs;
    this.p = V3.neu(); this.v = V3.neu(); this.w = V3.neu();
    this.zustand = 'ruhe';   // ruhe | flug | rollen | loch | gefahr | aus
    this.t = 0; this.flugT = 0; this.lochSperre = 0; this.inKrone = null;
    this.ereignisse = [];
    this.lochFall = 0;
    this.maxH = 0; this.erstAufprall = null;
  }
  setze(x, z) {
    this.kurs.hoehe(x, z, _hb);
    V3.set(this.p, x, _hb.h + PH.R, z);
    V3.set(this.v, 0, 0, 0); V3.set(this.w, 0, 0, 0);
    this.zustand = 'ruhe';
  }
  // v, w: Startgeschwindigkeit und Drall (rad/s, Weltachsen); rollend: Putt
  schlag(v, w, rollend) {
    V3.kopie(this.v, v); V3.kopie(this.w, w);
    this.zustand = rollend ? 'rollen' : 'flug';
    this.t = 0; this.flugT = 0; this.lochSperre = 0; this.inKrone = null;
    this.maxH = this.p.y; this.erstAufprall = null;
    this.ruheT = 0;
    if (!rollend) this.p.y += 0.002;
  }
  ev(typ, d) { this.ereignisse.push(Object.assign({ typ }, d || {})); }
  bewegt() { return this.zustand === 'flug' || this.zustand === 'rollen'; }
  // Mehrere feste Teilschritte
  update(dt) {
    if (!this.bewegt()) return;
    let n = Math.min(40, Math.ceil(dt / PH.DT));
    const h = dt / n;
    while (n-- > 0 && this.bewegt()) this.schritt(h);
  }
  schritt(dt) {
    this.t += dt;
    if (this.zustand === 'flug') this.flug(dt);
    else if (this.zustand === 'rollen') this.rollen(dt);
    if (!this.bewegt()) return;
    this.hindernisse(dt);
    this.pruefeLoch();
    if (!this.bewegt()) return;
    const k = this.kurs, p = this.p;
    if (!k.imFeld(p.x, p.z)) { this.zustand = 'aus'; this.ev('aus'); return; }
    const typ = k.boden(p.x, p.z);
    if (k.param(typ).gefahr) {
      const st = k.gefahrStand(p.x, p.z);
      if (p.y - PH.R * 0.5 < st) { p.y = st; this.zustand = 'gefahr'; this.ev('gefahr', { u: typ }); return; }
    }
    if (this.t > 45) this.ruhe();
  }
  ruhe() { V3.set(this.v, 0, 0, 0); V3.set(this.w, 0, 0, 0); this.zustand = 'ruhe'; this.ev('ruhe'); }

  flug(dt) {
    const v = this.v, w = this.w, p = this.p, wind = this.kurs.wind;
    this.flugT += dt;
    // Wind wirkt mit der Höhe über Boden etwas stärker
    const rx = v.x - wind.x, ry = v.y, rz = v.z - wind.z;
    const s = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1e-6;
    const om = V3.len(w);
    const S = PH.R * om / s;                       // Spin-Faktor
    const cd = 0.225 + 0.25 * Math.min(S, 0.3);
    const cl = Math.min(0.34, 1.55 * S);
    const fd = PH.LUFT * cd * s;
    let ax = -fd * rx, ay = -PH.G - fd * ry, az = -fd * rz;
    if (om > 1) {
      // Magnus: Richtung w × v
      const mx = w.y * rz - w.z * ry, my = w.z * rx - w.x * rz, mz = w.x * ry - w.y * rx;
      const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
      const fm = PH.LUFT * cl * s * s / ml;
      ax += mx * fm; ay += my * fm; az += mz * fm;
    }
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    const abn = Math.exp(-dt / 22);
    w.x *= abn; w.y *= abn; w.z *= abn;
    if (p.y > this.maxH) this.maxH = p.y;
    // Boden
    const k = this.kurs;
    k.hoehe(p.x, p.z, _hb);
    if (p.y - PH.R < _hb.h) {
      const typ = k.boden(p.x, p.z);
      const par = k.param(typ);
      if (par.gefahr) return;                     // fällt ins Wasser, wird in schritt() erkannt
      p.y = _hb.h + PH.R;
      this.aufprall(_hb, typ, par);
    }
  }

  aufprall(hb, typ, par) {
    const v = this.v, w = this.w;
    const n = _t1; V3.set(n, hb.nx, hb.ny, hb.nz);
    if (V3.dot(v, n) >= 0) return;
    // Einschlagkrater (nach Penner): weicher Rasen gibt nach, die wirksame Fläche kippt gegen die Flugrichtung.
    // Dadurch bremst ein steil landender Ball mit viel Rückwärtsdrall stark ab oder zieht sogar zurück.
    const weich = par.weich == null ? 1 : par.weich;
    if (weich > 0) {
      const vs = V3.len(v);
      const vd = V3.dot(v, n);
      let tx = v.x - vd * n.x, ty = v.y - vd * n.y, tz = v.z - vd * n.z;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tl > 0.05) {
        const th = Math.min(0.42, 0.016 * vs * weich);
        const c = Math.cos(th), s = Math.sin(th);
        n.x = n.x * c - tx / tl * s; n.y = n.y * c - ty / tl * s; n.z = n.z * c - tz / tl * s;
      }
    }
    const vn = V3.dot(v, n);
    if (vn >= 0) return;
    const avn = -vn;
    // Weicher Rasen schluckt bei harten Landungen mehr Energie
    let e = par.e / (1 + 0.035 * avn);
    if (typ === U.SAND && avn > 3) e *= 0.3;
    // Tangentiale Geschwindigkeit
    const vt = _t2; V3.set(vt, v.x - vn * n.x, v.y - vn * n.y, v.z - vn * n.z);
    // Geschwindigkeit des Kontaktpunkts: vt + w × (-R n)
    const c = _t3; V3.kreuz(c, w, n);
    const slip = { x: vt.x - PH.R * c.x, y: vt.y - PH.R * c.y, z: vt.z - PH.R * c.z };
    const sn = V3.dot(slip, n);
    slip.x -= sn * n.x; slip.y -= sn * n.y; slip.z -= sn * n.z;
    const sl = V3.len(slip);
    if (sl > 1e-6) {
      const J = Math.min(par.mu * (1 + e) * avn, (2 / 7) * sl);
      const dv = { x: -slip.x / sl * J, y: -slip.y / sl * J, z: -slip.z / sl * J };
      vt.x += dv.x; vt.y += dv.y; vt.z += dv.z;
      // Drehimpuls: dw = 5/(2R) * (-n × dv)
      const f = 5 / (2 * PH.R);
      const tx = -(n.y * dv.z - n.z * dv.y), ty = -(n.z * dv.x - n.x * dv.z), tz = -(n.x * dv.y - n.y * dv.x);
      w.x += f * tx; w.y += f * ty; w.z += f * tz;
    }
    // Seitendrall verpufft beim Aufprall grösstenteils
    const wn = V3.dot(w, n);
    w.x -= wn * n.x * 0.6; w.y -= wn * n.y * 0.6; w.z -= wn * n.z * 0.6;
    const raus = e * avn;
    if (!this.erstAufprall) this.erstAufprall = { x: this.p.x, z: this.p.z };
    this.ev('aufprall', { st: avn, u: typ });
    if (raus < 0.45) {
      V3.kopie(v, vt);
      this.zustand = 'rollen';
    } else {
      v.x = vt.x + raus * n.x; v.y = vt.y + raus * n.y; v.z = vt.z + raus * n.z;
    }
  }

  rollen(dt) {
    const k = this.kurs, p = this.p, v = this.v;
    k.hoehe(p.x, p.z, _hb);
    const typ = k.boden(p.x, p.z), par = k.param(typ);
    const nx = _hb.nx, ny = _hb.ny, nz = _hb.nz;
    // Hangabtrieb einer rollenden Vollkugel: 5/7 g sin(a)
    const gx = PH.G * ny * nx, gy = -PH.G + PH.G * ny * ny, gz = PH.G * ny * nz;
    const f57 = 5 / 7;
    let ax = gx * f57, ay = gy * f57, az = gz * f57;
    const s = V3.len(v);
    const bremse = par.mr * PH.G * ny + par.k * s;
    const gHang = Math.sqrt(gx * gx + gy * gy + gz * gz) * f57;
    if (s < 0.07 && gHang < par.mr * PH.G * 1.25) { this.ruheT += dt; if (this.ruheT > 0.12) { this.ruhe(); return; } }
    else this.ruheT = 0;
    if (s > 1e-5) {
      const db = bremse * dt;
      if (db >= s) { v.x = v.y = v.z = 0; }
      else { const q = (s - db) / s; v.x *= q; v.y *= q; v.z *= q; }
    }
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    // Seitendrall wird beim Rollen schnell abgebaut, Rollbewegung für die Anzeige
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    k.hoehe(p.x, p.z, _hb);
    const luecke = p.y - PH.R - _hb.h;
    const vnn = v.x * _hb.nx + v.y * _hb.ny + v.z * _hb.nz;
    if (luecke > 0.012 && vnn > -0.2) {
      // Kuppe: Ball hebt ab
      this.zustand = 'flug';
      V3.set(this.w, 0, 0, 0);
      return;
    }
    if (vnn < -2.2) {
      // Harter Aufprall an einem steilen Gegenhang
      p.y = _hb.h + PH.R;
      this.zustand = 'flug';
      this.aufprall(_hb, typ, par);
      return;
    }
    p.y = _hb.h + PH.R;
    // Geschwindigkeit in die neue Tangentialebene drehen (Betrag behalten)
    const sv = V3.len(v);
    v.x -= vnn * _hb.nx; v.y -= vnn * _hb.ny; v.z -= vnn * _hb.nz;
    const sn = V3.len(v);
    if (sn > 1e-6) { const q = sv / sn; v.x *= q; v.y *= q; v.z *= q; }
    // Rolldrall: w = (n × v) / R
    this.w.x = (_hb.ny * v.z - _hb.nz * v.y) / PH.R;
    this.w.y = (_hb.nz * v.x - _hb.nx * v.z) / PH.R;
    this.w.z = (_hb.nx * v.y - _hb.ny * v.x) / PH.R;
  }

  hindernisse(dt) {
    const p = this.p, v = this.v;
    const liste = this.kurs.naheHindernisse(p.x, p.z);
    let krone = null;
    for (let i = 0; i < liste.length; i++) {
      const o = liste[i];
      if (o.typ === 'zyl') {
        if (p.y < o.y0 || p.y > o.y1) continue;
        const dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz, rr = o.r + PH.R;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d;
        p.x = o.x + nx * rr; p.z = o.z + nz * rr;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          const e = o.e == null ? 0.45 : o.e;
          v.x -= (1 + e) * vn * nx; v.z -= (1 + e) * vn * nz;
          v.x *= 0.85; v.z *= 0.85; v.y *= 0.85;
          this.ev('stoss', { st: -vn, art: o.art || 'holz' });
          if (this.zustand === 'rollen' && -vn > 1.5) { /* bleibt rollend */ }
        }
      } else if (o.typ === 'kugel') {
        const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d2 = dx * dx + dy * dy + dz * dz;
        const rr = o.r + PH.R;
        if (d2 >= rr * rr) continue;
        if (o.weich) { krone = o; continue; }
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, ny = dy / d, nz = dz / d;
        p.x = o.x + nx * rr; p.y = o.y + ny * rr; p.z = o.z + nz * rr;
        const vn = v.x * nx + v.y * ny + v.z * nz;
        if (vn < 0) {
          const e = o.e == null ? 0.5 : o.e;
          v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; v.z -= (1 + e) * vn * nz;
          v.x *= 0.9; v.y *= 0.9; v.z *= 0.9;
          if (this.zustand === 'rollen' && ny < 0.7) this.zustand = 'flug';
          this.ev('stoss', { st: -vn, art: o.art || 'stein' });
        }
      }
    }
    // Baumkrone: Blätter bremsen und lenken zufällig ab
    if (krone && this.zustand === 'flug') {
      const q = Math.exp(-dt * 4.5);
      const s = V3.len(v);
      v.x = v.x * q + (this.kurs.zufall() - 0.5) * s * dt * 5;
      v.z = v.z * q + (this.kurs.zufall() - 0.5) * s * dt * 5;
      v.y = v.y * q;
      this.w.x *= q; this.w.y *= q; this.w.z *= q;
      if (this.inKrone !== krone) this.ev('blaetter', { st: s });
    }
    this.inKrone = krone;
  }

  pruefeLoch() {
    const L = this.kurs.loch, p = this.p, v = this.v;
    const dx = p.x - L.x, dz = p.z - L.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 9) return;
    const d = Math.sqrt(d2);
    // Fahnenstange (nur im Flug)
    if (this.zustand === 'flug' && p.y - L.y < PH.H_FAHNE && d < PH.R + PH.R_FAHNE && d > 1e-5) {
      const nx = dx / d, nz = dz / d, vn = v.x * nx + v.z * nz;
      if (vn < 0) {
        v.x -= 1.3 * vn * nx; v.z -= 1.3 * vn * nz;
        v.x *= 0.5; v.z *= 0.5;
        this.ev('fahne', { st: -vn });
      }
    }
    if (d >= PH.R_LOCH) { this.lochSperre = 0; return; }
    const hs = Math.sqrt(v.x * v.x + v.z * v.z);
    const unter = p.y - PH.R - L.y;
    if (this.zustand === 'flug') {
      if (unter < 0.06 && v.y < 0 && hs < 3.2 && d < PH.R_LOCH - PH.R * 0.2) this.eingelocht();
      return;
    }
    // Rollend: Einfangen abhängig von Tempo und wie mittig der Ball kommt
    if (this.lochSperre) return;
    const mitte = 1 - d / PH.R_LOCH;
    const vmax = 0.45 + 1.35 * Math.sqrt(Math.max(0, mitte));
    if (hs < vmax) { this.eingelocht(); return; }
    // Lip-out: Richtung wird abgelenkt, Tempo sinkt
    this.lochSperre = 1;
    const quer = (dx * v.z - dz * v.x) / (hs || 1);   // seitlicher Versatz
    const a = Math.max(-0.9, Math.min(0.9, -quer / PH.R_LOCH * 0.9));
    const c = Math.cos(a), s = Math.sin(a);
    const nx = v.x * c - v.z * s, nz = v.x * s + v.z * c;
    v.x = nx * 0.7; v.z = nz * 0.7;
    this.ev('lippe', {});
  }
  eingelocht() {
    const L = this.kurs.loch;
    this.zustand = 'loch';
    this.p.x = L.x; this.p.z = L.z;
    this.lochFall = 0;
    V3.set(this.v, 0, 0, 0); V3.set(this.w, 0, 0, 0);
    this.ev('loch', {});
  }
}

// Startwerte für einen Schlag berechnen
// opt: { schl, kraft (0..1), yaw (rad, 0 = -z), drall {x: seitlich -1..1, y: rück(+)/vor(-) -1..1}, typ (Untergrund), hang {auf, quer} (Gefälle), puttMax }
function schlagWerte(opt) {
  const sc = SCHLAEGER[opt.schl];
  const lie = BODEN[opt.typ] || BODEN[U.FAIRWAY];
  const dx = -Math.sin(opt.yaw), dz = -Math.cos(opt.yaw);   // Vorwärtsrichtung
  const rx = -dz, rz = dx;                                     // rechts
  const hang = opt.hang || { auf: 0, quer: 0 };
  if (sc.putter) {
    // Putt: Tempo so, dass der Ball auf flachem Grün puttMax*kraft weit rollt
    const mr = BODEN[U.GRUEN].mr;
    const ziel = Math.max(0.05, (opt.puttMax || 12) * opt.kraft);
    // grobe Umkehrung inkl. geschwindigkeitsabhängiger Bremse
    const vs = puttTempo(ziel, BODEN[opt.typ] && !BODEN[opt.typ].gefahr ? opt.typ : U.GRUEN);
    const steig = Math.atan(hang.auf || 0);
    const ch = Math.cos(steig);
    return {
      v: { x: dx * vs * ch, y: Math.sin(steig) * vs, z: dz * vs * ch },
      w: { x: 0, y: 0, z: 0 }, rollend: true, tempo: vs,
    };
  }
  const k = Math.max(0.03, opt.kraft);
  let tempo = sc.v * Math.pow(k, 0.62) * (opt.schl === 6 && opt.typ === U.SAND ? 0.95 : lie.lieV);
  // Loft: bei Teilschlägen etwas höher, Hanglage verändert den Abflugwinkel
  const dy = opt.drall ? opt.drall.y : 0, sx = opt.drall ? opt.drall.x : 0;
  let loft = sc.loft + (1 - k) * 4 + dy * 2.5 + Math.atan(hang.auf || 0) * 57.3 * 0.75;
  loft = Math.max(2, Math.min(70, loft));
  const lr = loft * Math.PI / 180;
  // Streuung aus schlechter Lage
  const st = (opt.zufall != null ? opt.zufall : 0) * lie.streu * Math.PI / 180;
  const yaw = opt.yaw + st + (hang.quer || 0) * 0.35;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const v = { x: fx * Math.cos(lr) * tempo, y: Math.sin(lr) * tempo, z: fz * Math.cos(lr) * tempo };
  const rpm = sc.rpm * (0.35 + 0.65 * k) * lie.lieS * (1 + 0.6 * dy);
  const om = rpm * Math.PI / 30;
  // Rückwärtsdrall um die Rechts-Achse, Seitendrall um die Hochachse (+ = Kurve nach links)
  const rxx = -fz, rzz = fx;
  const seite = -sx * om * 0.26;
  const w = { x: rxx * om, y: seite, z: rzz * om };
  return { v, w, rollend: false, tempo };
}

// Anfangstempo, damit ein Putt auf flachem Untergrund etwa s Meter rollt (Lösung von v' = -(mr g + k v))
function puttTempo(s, typ) {
  const p = BODEN[typ] || BODEN[U.GRUEN];
  const a = p.mr * PH.G, k = p.k;
  if (k < 1e-4) return Math.sqrt(2 * a * s);
  // Weg bis Stillstand: s(v0) = v0/k - a/k² ln(1 + k v0 / a)  -> Bisektion
  let lo = 0, hi = 40;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    const sm = m / k - a / (k * k) * Math.log(1 + k * m / a);
    if (sm < s) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// Flugbahn vorausberechnen (bis zum ersten Bodenkontakt), Wind wird ignoriert
function flugVorschau(kurs, start, sw, punkte, maxPunkte) {
  const b = new Ball(kurs);
  const windAlt = kurs.wind;
  kurs.wind = { x: 0, z: 0 };
  V3.kopie(b.p, start);
  b.schlag(sw.v, sw.w, sw.rollend);
  let n = 0, i = 0;
  const lande = { x: start.x, y: start.y, z: start.z, ok: false, roll: 0 };
  try {
    if (sw.rollend) {
      // Putt: Rollweg simulieren
      while (b.zustand === 'rollen' && i < 4000) {
        b.rollen(PH.DT * 2); i++;
        if (i % 12 === 0 && n < maxPunkte) { punkte[n++] = { x: b.p.x, y: b.p.y, z: b.p.z }; }
      }
      V3.kopie(lande, b.p); lande.ok = true;
    } else {
      b.ereignisse.length = 0;
      while (b.zustand === 'flug' && i < 3000) {
        b.flug(PH.DT * 2); i++;
        if (i % 6 === 0 && n < maxPunkte) punkte[n++] = { x: b.p.x, y: b.p.y, z: b.p.z };
        if (b.ereignisse.length || !kurs.imFeld(b.p.x, b.p.z)) break;
        const typ = kurs.boden(b.p.x, b.p.z);
        if (kurs.param(typ).gefahr && b.p.y < kurs.gefahrStand(b.p.x, b.p.z)) break;
      }
      lande.x = b.p.x; lande.y = b.p.y; lande.z = b.p.z; lande.ok = true;
      if (n < maxPunkte) punkte[n++] = { x: b.p.x, y: b.p.y, z: b.p.z };
    }
  } finally { kurs.wind = windAlt; }
  return { n, lande, maxH: b.maxH };
}

if (typeof module !== 'undefined') module.exports = { PH, U, BODEN, SCHLAEGER, V3, Ball, schlagWerte, flugVorschau, puttTempo };
