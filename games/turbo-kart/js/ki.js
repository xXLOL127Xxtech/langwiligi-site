// Turbo-Kart – Computerfahrer
'use strict';

const KI_STUFEN = [
  // aufhol: Tempo-Plus, wenn weit hinter dem besten Menschen; vorne: Tempo-Minus, wenn weit davor; abk: Lust auf Abkürzungen
  { name: 'Leicht', tempo: 0.88, fehler: 0.32, drift: 1, reakt: [1.5, 4], treff: 0.5, aufhol: 0.07, vorne: 0.18, abk: 0.15 },
  { name: 'Mittel', tempo: 0.955, fehler: 0.18, drift: 2, reakt: [0.8, 2.5], treff: 0.75, aufhol: 0.1, vorne: 0.14, abk: 0.4 },
  { name: 'Schwer', tempo: 1.0, fehler: 0.07, drift: 3, reakt: [0.3, 1.3], treff: 0.95, aufhol: 0.13, vorne: 0.1, abk: 0.8 },
];

class Bot {
  constructor(k, stufe) {
    this.k = k; this.st = KI_STUFEN[stufe];
    this.bias = 0; this.zielBias = 0; this.biasT = 0;
    this.itemT = 1; this.haltT = 0; this.halten = false; this.vorher = { drift: false, item: false };
    this.driftCD = 0; this.gegenT = 0; this.steckT = 0; this.rueckT = 0;
    this.ziel = null; this.zielT = 0;
    this.wackel = Math.random() * 10;
  }
  input(dt) {
    const k = this.k, r = k.r;
    const inp = { gas: 1, bremse: 0, lenk: 0, drift: false, item: false };
    if (r.welt.istArena) this.arena(dt, inp); else this.strecke(dt, inp);
    // Tinte: Sicht weg, leicht wackeln
    if (k.tinteT > 0) { this.wackel += dt * 3; inp.lenk = clamp(inp.lenk + Math.sin(this.wackel) * 0.5, -1, 1); }
    inp.driftDruck = inp.drift && !this.vorher.drift;
    inp.itemDruck = inp.item && !this.vorher.item;
    inp.itemLos = !inp.item && this.vorher.item;
    this.vorher = { drift: inp.drift, item: inp.item };
    return inp;
  }
  strecke(dt, inp) {
    const k = this.k, r = k.r, w = r.welt, P = k.P, st = this.st;
    if (P.si === undefined) return;
    // Fahrspur wechseln
    this.biasT -= dt;
    if (this.biasT <= 0) { this.biasT = 2 + Math.random() * 4; this.zielBias = (Math.random() * 2 - 1) * st.fehler * P.w; }
    this.bias = damp(this.bias, this.zielBias, 0.8, dt);
    const la = 9 + Math.max(k.v, 0) * 0.42;
    const s2 = P.s + la;
    const S2 = w.S[w.idx(s2)];
    let d = S2.ideal * (1 - st.fehler) + this.bias;
    // Hindernissen ausweichen
    for (const g of r.items.liste) {
      if (g.typ === 'blau' || g.besitzer === k && g.t < 1) continue;
      if (!g.P || g.P.s === undefined) continue;
      let ds = g.P.s - P.s; if (ds < -w.L / 2) ds += w.L; if (ds > w.L / 2) ds -= w.L;
      if (ds > 2 && ds < 30 && Math.abs(g.P.d - d) < 3 && Math.random() < st.treff + 0.2) d = g.P.d + (g.P.d > d ? -4 : 4);
    }
    for (const o of r.karts) {
      if (o === k) continue;
      let ds = o.fortschritt - k.fortschritt;
      if (ds > 1 && ds < 14 && Math.abs(o.P.d - d) < 2.4 && o.v < k.v) d = o.P.d + (o.P.d > 0 ? -3.5 : 3.5);
    }
    // Pfützen und Pylonen: gute Fahrer weichen aus
    for (const b of w.bremsen || []) {
      let ds = b.s - P.s; if (ds < -w.L / 2) ds += w.L; if (ds > w.L / 2) ds -= w.L;
      if (ds > 0 && ds < 32 && Math.abs(b.d - d) < b.b + 1.6 && (this.pfT === b ? this.pfJa : (this.pfT = b, this.pfJa = Math.random() < st.treff))) d = b.d + (b.d > d ? -(b.b + 2) : b.b + 2);
    }
    for (const h of w.huetchen || []) {
      if (h.weg) continue;
      let ds = h.s - P.s; if (ds < -w.L / 2) ds += w.L; if (ds > w.L / 2) ds -= w.L;
      if (ds > 0 && ds < 26 && Math.abs(h.d - d) < 1.8 && (this.pfT === h.reihe ? this.pfJa : (this.pfT = h.reihe, this.pfJa = Math.random() < st.treff))) d = h.d + (h.d > d ? -2.2 : 2.2);
    }
    // Steinblöcken ausweichen
    for (const sb of w.steine) {
      let ds = sb.s - P.s; if (ds < -w.L / 2) ds += w.L; if (ds > w.L / 2) ds -= w.L;
      if (ds > -2 && ds < 30 && Math.abs(sb.d - d) < sb.hw + 1.8 && (this.stT === sb ? this.stJa : (this.stT = sb, this.stJa = Math.random() < st.treff + 0.1))) d = sb.d + (sb.d > d || (sb.d === d && k.idx % 2) ? -(sb.hw + 2.4) : sb.hw + 2.4);
    }
    d = clamp(d, -S2.w * 0.85, S2.w * 0.85);
    if (S2.fall || w.S[w.idx(P.s + 5)].fall) d = clamp(d * 0.6, -S2.w * 0.55, S2.w * 0.55);
    // Abkürzung: dem Weg folgen statt der Strecke
    const abk = this.abkWahl(P, w);
    const tp = abk ? this.abkZiel(abk, P, w, la) : w.punkt(s2, d, _v1);
    const soll = Math.atan2(tp.x - k.pos.x, tp.z - k.pos.z);
    const diff = wrapA(soll - k.yaw);
    inp.lenk = clamp(-diff * 3.2, -1, 1);
    // Driften
    this.driftCD -= dt;
    const kv = w.S[w.idx(P.s + 12)].k, kJetzt = w.S[w.idx(P.s + 3)].k;
    const dir = -Math.sign(kv);
    if (abk && (P.ab >= 0 || k.drift.an)) {
      // auf der Abkürzung wird nicht gedriftet
      inp.drift = false;
    } else if (!k.drift.an) {
      if (st.drift > 0 && !abk && Math.abs(kv) > 0.013 && k.v > 14 && !k.luft && this.driftCD <= 0 && Math.abs(P.d) < P.w * 0.8) {
        inp.drift = true; inp.lenk = dir;
        this.driftCD = 0.6;
      }
      if (k.hop) { inp.drift = true; inp.lenk = this.letzteDir || dir; }
      if (inp.drift) this.letzteDir = dir;
    } else {
      inp.drift = true;
      const dd = k.drift.dir;
      if (inp.lenk * dd < -0.75) this.gegenT += dt; else this.gegenT = 0;
      const kurveVorbei = Math.abs(kJetzt) < 0.005 && Math.abs(kv) < 0.007;
      if ((k.drift.stufe >= st.drift && kurveVorbei) || (kurveVorbei && k.drift.t > 0.4 && k.drift.stufe >= 1) || this.gegenT > 0.25 || Math.abs(P.d) > P.w + 0.5 || (k.drift.stufe >= 3)) {
        if (!(k.drift.stufe >= 3 && !kurveVorbei && Math.abs(P.d) < P.w * 0.6 && this.gegenT < 0.25)) inp.drift = false;
      }
      if (Math.abs(P.d) > P.w + 0.5 || this.gegenT > 0.25) inp.drift = false;
    }
    // Wenn verkehrt herum: wenden
    if (Math.abs(diff) > 2.2 && k.v < 6) { inp.bremse = 1; inp.gas = 0; inp.lenk = diff > 0 ? 1 : -1; }
    // Feststecken
    if (r.phase === 'rennen' && k.v < 2 && !k.treffer && k.rettung <= 0) this.steckT += dt; else this.steckT = 0;
    if (this.steckT > 1.2) { this.rueckT = 0.9; this.steckT = 0; }
    if (this.rueckT > 0) { this.rueckT -= dt; inp.gas = 0; inp.bremse = 1; inp.lenk = -inp.lenk; inp.drift = false; }
    this.items(dt, inp);
  }
  // Hat der Bot etwas, um durchs hohe Gras zu rauschen?
  turboBereit() {
    const k = this.k;
    return k.boostT > 0.6 || k.sternT > 1 || (k.roulette <= 0 && ['nitro', 'nitro3', 'goldnitro', 'stern'].includes(k.item));
  }
  // Abkürzung wählen: pro Runde und Abkürzung wird einmal entschieden. Ohne Turbo fast nie.
  abkWahl(P, w) {
    if (!w.abk.length) return null;
    if (P.ab >= 0) return (this.abk = w.abk[P.ab]);
    const k = this.k;
    if (this.abk) {
      let ds = P.s - this.abk.s1; ds = ((ds % w.L) + w.L) % w.L;
      if (ds > Math.max(0, this.abk.ein) + 10 && ds < w.L - 80) this.abk = null;   // vorbei oder verpasst
      return this.abk;
    }
    this.gewuerfelt = this.gewuerfelt || {};
    for (const A of w.abk) {
      let ds = A.s1 - P.s; ds = ((ds % w.L) + w.L) % w.L;
      if (ds > 12 && ds < 50 && this.gewuerfelt[A.nr] !== k.runde) {
        this.gewuerfelt[A.nr] = k.runde;
        if (Math.random() < this.st.abk * (this.turboBereit() ? 1 : 0.08)) return (this.abk = A);
      }
    }
    return null;
  }
  abkZiel(A, P, w, la) {
    let sl;
    if (P.ab === A.nr) sl = P.abS + la;
    else { let ds = A.s1 - P.s; ds = ((ds % w.L) + w.L) % w.L; if (ds > w.L / 2) ds -= w.L; sl = la - ds; }
    return w.abkPunkt(A, sl, 0, _v1);
  }
  arena(dt, inp) {
    const k = this.k, r = k.r, w = r.welt;
    this.zielT -= dt;
    if (this.zielT <= 0 || !this.ziel) {
      this.zielT = 1 + Math.random();
      const brauchtItem = !k.item && k.roulette <= 0 && !k.gehalten && !k.orbit.length;
      let best = null, bd = 1e9;
      if (brauchtItem) {
        for (const b of r.items.boxen) if (b.aktiv) { const dd = b.pos.distanceTo(k.pos); if (dd < bd) { bd = dd; best = { pos: b.pos }; } }
      }
      if (!best || Math.random() < 0.3) {
        for (const o of r.karts) {
          if (o === k || r.gleichesTeam(o, k) || o.tot) continue;
          const dd = o.pos.distanceTo(k.pos) * (0.7 + Math.random() * 0.6);
          if (dd < bd) { bd = dd; best = { kart: o, pos: o.pos }; }
        }
      }
      this.ziel = best;
    }
    if (!this.ziel) return;
    const tp = this.ziel.pos;
    let soll = Math.atan2(tp.x - k.pos.x, tp.z - k.pos.z);
    // Hindernisse vermeiden
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    for (const ab of [5, 10]) {
      if (w.wand(k.pos.x + fx * ab, k.pos.z + fz * ab, 1.4)) {
        const l = !w.wand(k.pos.x + Math.sin(k.yaw + 0.7) * ab, k.pos.z + Math.cos(k.yaw + 0.7) * ab, 1.4);
        const rr = !w.wand(k.pos.x + Math.sin(k.yaw - 0.7) * ab, k.pos.z + Math.cos(k.yaw - 0.7) * ab, 1.4);
        soll = k.yaw + (l && !rr ? 1.2 : !l && rr ? -1.2 : (this.k.idx % 2 ? 1.2 : -1.2));
        break;
      }
    }
    const diff = wrapA(soll - k.yaw);
    inp.lenk = clamp(-diff * 2.5, -1, 1);
    if (Math.abs(diff) > 1.6 && k.v > 12) inp.gas = 0.6;
    if (r.phase === 'rennen' && k.v < 2 && !k.treffer) this.steckT += dt; else this.steckT = 0;
    if (this.steckT > 1.0) { this.rueckT = 1.0; this.steckT = 0; }
    if (this.rueckT > 0) { this.rueckT -= dt; inp.gas = 0; inp.bremse = 1; inp.lenk = -inp.lenk; }
    this.items(dt, inp);
  }
  // Ziel vor bzw. hinter dem Bot?
  gegnerVorne(maxD, maxW) {
    const k = this.k, r = k.r;
    for (const o of r.karts) {
      if (o === k || r.gleichesTeam(o, k) || o.tot) continue;
      const dx = o.pos.x - k.pos.x, dz = o.pos.z - k.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > maxD || d < 2) continue;
      if (Math.abs(wrapA(Math.atan2(dx, dz) - k.yaw)) < maxW) return o;
    }
    return null;
  }
  gegnerHinten(maxD) {
    const k = this.k, r = k.r;
    for (const o of r.karts) {
      if (o === k || r.gleichesTeam(o, k)) continue;
      const dx = o.pos.x - k.pos.x, dz = o.pos.z - k.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < maxD && Math.abs(wrapA(Math.atan2(dx, dz) - k.yaw)) > 2.2) return o;
    }
    return null;
  }
  items(dt, inp) {
    const k = this.k, r = k.r, st = this.st;
    // Gehaltenes Item: weiter halten bis zum passenden Moment
    if (k.gehalten) {
      this.haltT -= dt;
      let los = this.haltT <= 0;
      if (k.gehalten === 'gruen' && this.gegnerVorne(35, 0.12)) los = Math.random() < st.treff * dt * 6 || los;
      if (k.gehalten === 'rot' && (r.welt.istArena ? this.gegnerVorne(45, 0.6) : this.gegnerVorne(80, 1.2))) los = Math.random() < st.treff * dt * 4 || los;
      if ((k.gehalten === 'banane' || k.gehalten === 'falle') && this.gegnerHinten(12)) los = true;
      if (k.gehalten === 'bombe' && (this.gegnerVorne(35, 0.4) || this.gegnerHinten(10))) los = true;
      inp.item = !los;
      if (los && (k.gehalten === 'gruen' || k.gehalten === 'rot') && !this.gegnerVorne(80, 1.2) && this.gegnerHinten(30)) inp.bremse = 1;
      if (los && k.gehalten === 'bombe' && this.gegnerHinten(10)) inp.bremse = 1;
      return;
    }
    if (k.orbit.length) {
      this.itemT -= dt;
      const vorne = k.orbit[0].typ === 'banane' ? this.gegnerHinten(12) : this.gegnerVorne(k.orbit[0].typ === 'rot' ? 70 : 30, k.orbit[0].typ === 'rot' ? 1.2 : 0.15);
      if ((vorne && Math.random() < st.treff * dt * 3) || this.itemT < -10) { inp.item = !this.vorher.item; this.itemT = 0.5; }
      return;
    }
    if (!k.item || k.roulette > 0) { this.itemT = st.reakt[0] + Math.random() * (st.reakt[1] - st.reakt[0]); return; }
    this.itemT -= dt;
    if (this.itemT > 0) return;
    const t = k.item;
    const w = r.welt;
    const gerade = w.istArena || Math.abs(w.S[w.idx(k.P.s + 20)].k) < 0.008;
    // Auf der Abkürzung: Turbo im hohen Gras zünden
    const imGras = this.abk && k.P.ab === this.abk.nr && k.P.abS < this.abk.grasBis;
    let benutzen = false;
    switch (t) {
      case 'nitro': case 'nitro3': case 'goldnitro': benutzen = imGras || (gerade && !k.drift.an && !this.abk); break;
      case 'stern': benutzen = imGras || !this.abk; break;
      case 'hupe': benutzen = !!this.gegnerVorne(10, 3.2) || r.items.liste.some(g => g.typ === 'blau' && g.pos.distanceTo(k.pos) < 25) || this.itemT < -12; break;
      case 'banane': case 'falle': case 'bombe': case 'gruen': case 'rot':
        benutzen = true; this.haltT = 3 + Math.random() * 10; break;
      default: benutzen = true;
    }
    if (benutzen) { inp.item = !this.vorher.item; if (inp.item && !k.gehalten) this.itemT = 0.7; }
  }
}
