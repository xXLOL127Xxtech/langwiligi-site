// Turbo-Kart – Items: Würfel, Münzen, Wurfgeschosse, Effekte der Items
'use strict';

// Gewichte je nach Platz (vorne, Mitte, hinten)
const ITEM_TABELLE = {
  banane: [30, 8, 0], banane3: [6, 6, 0], gruen: [24, 12, 3], gruen3: [4, 10, 4], rot: [0, 16, 8], rot3: [0, 6, 10],
  falle: [10, 3, 0], muenze: [18, 6, 0], hupe: [4, 4, 2], nitro: [0, 12, 10], nitro3: [0, 6, 14], goldnitro: [0, 0, 7],
  bombe: [0, 6, 4], tinte: [0, 6, 3], stern: [0, 2, 12], blitz: [0, 1, 12], blau: [0, 3, 5], rakete: [0, 0, 10],
};
const SCHLACHT_ITEMS = ['banane', 'banane3', 'gruen', 'gruen3', 'rot', 'rot3', 'bombe', 'nitro', 'stern', 'falle', 'hupe', 'tinte'];
const ITEM_CODE = Object.keys(ITEMS);

class Items {
  constructor(r) {
    this.r = r;
    this.liste = [];
    this.id = 1;
    this.boxen = []; this.muenzen = [];
    this.gehaltenMesh = new Map();
    this.blitzCD = 0;
    this.gast = false;
  }
  aufbauen() {
    const r = this.r, w = r.welt;
    if (r.itemModus !== 'aus') {
      for (const p of w.boxPlaetze) {
        const g = baueWuerfel(false);
        g.position.copy(p);
        r.szene.add(g);
        this.boxen.push({ pos: p.clone(), g, aktiv: true, t: 0, ph: Math.random() * 6 });
      }
    }
    for (const p of w.muenzPlaetze) {
      const g = baueItemModell('muenze');
      g.position.copy(p);
      r.szene.add(g);
      this.muenzen.push({ pos: p.clone(), g, aktiv: true, t: 0 });
    }
  }
  // ---------- Würfel und Münzen ----------
  boxenSchritt(dt, zeit) {
    const r = this.r;
    for (const b of this.boxen) {
      if (!b.aktiv) {
        b.t -= dt;
        if (b.t <= 0 && !this.gast) { b.aktiv = true; }
      }
      const s = b.aktiv ? (b.g.scale.x < 1 ? Math.min(1, b.g.scale.x + dt * 2.5) : 1) : 0.001;
      b.g.scale.setScalar(s);
      b.g.visible = s > 0.01;
      b.g.position.y = b.pos.y + Math.sin(zeit * 2 + b.ph) * 0.2;
      b.g.userData.wuerfel.rotation.set(zeit * 0.7 + b.ph, zeit * 1.1 + b.ph, 0);
      if (!b.aktiv || b.g.scale.x < 0.6) continue;
      for (const k of r.karts) {
        if (!this.darfSammeln(k)) continue;
        const dx = k.pos.x - b.pos.x, dz = k.pos.z - b.pos.z, dy = k.pos.y + 0.8 - b.pos.y;
        if (dx * dx + dz * dz < 5.5 && Math.abs(dy) < 2.5) { this.boxNehmen(b, k); break; }
      }
    }
    for (const m of this.muenzen) {
      if (!m.aktiv) { m.t -= dt; if (m.t <= 0 && !this.gast) m.aktiv = true; }
      m.g.visible = m.aktiv;
      m.g.rotation.y = zeit * 3;
      if (!m.aktiv || r.welt.istArena) continue;
      for (const k of r.karts) {
        if (!this.darfSammeln(k) || k.treffer) continue;
        const dx = k.pos.x - m.pos.x, dz = k.pos.z - m.pos.z, dy = k.pos.y + 0.8 - m.pos.y;
        if (dx * dx + dz * dz < 4 && Math.abs(dy) < 2.5) { this.muenzeNehmen(m, k); break; }
      }
    }
  }
  darfSammeln(k) {
    if (k.rettung > 0) return false;
    // Im Netz sammelt jeder nur für seine eigenen Karts
    if (this.r.netz) return k.typ === 'spieler' || (k.typ === 'bot' && !this.gast);
    return true;
  }
  boxNehmen(b, k, vonNetz) {
    b.aktiv = false; b.t = this.r.welt.istArena ? 1.4 : 2.2; b.g.scale.setScalar(0.001);
    this.r.fx.boxBruch(b.pos);
    if (k && k.lokal >= 0) Ton.sfx('box');
    if (k && !vonNetz) {
      if (!k.item && k.roulette <= 0 && !k.gehalten && !k.orbit.length) {
        k.rouletteItem = this.ziehen(k);
        k.roulette = k.typ === 'bot' ? 1.0 : 1.45;
      }
      if (this.r.netz) this.r.netz.box(this.boxen.indexOf(b), k);
    }
  }
  muenzeNehmen(m, k, vonNetz) {
    m.aktiv = false; m.t = 12;
    if (k && !vonNetz) {
      k.muenzen = Math.min(10, k.muenzen + 1);
      if (k.lokal >= 0) Ton.sfx('muenze', 0.8);
      if (this.r.netz) this.r.netz.muenze(this.muenzen.indexOf(m), k);
    }
    this.r.fx.glitzer(m.pos, '#ffd23a', 10);
  }
  ziehen(k) {
    const r = this.r;
    const modus = r.itemModus;
    if (modus === 'nitro') return 'nitro';
    if (r.modus === 'zeit') return 'nitro3';
    const R = Math.random;
    let liste;
    if (r.welt.istArena) liste = SCHLACHT_ITEMS.map(t => [t, t === 'stern' ? 3 : t.endsWith('3') ? 6 : 10]);
    else if (modus === 'kugeln') liste = [['gruen', 10], ['gruen3', 6], ['rot', 8], ['rot3', 5], ['blau', 1]];
    else if (modus === 'chaos') liste = Object.keys(ITEM_TABELLE).map(t => [t, 10]);
    else {
      const n = r.karts.length;
      // Platz plus etwas Abstand zum Ersten: wer weit zurückliegt, bekommt bessere Items (Blitz, Rakete, Stern)
      const erster = Math.max(...r.karts.map(o => o.fortschritt));
      const pf = n > 1 ? clamp((k.platz - 1) / (n - 1) + clamp((erster - k.fortschritt - 60) / 600, 0, 0.25), 0, 1) : 0.5;
      liste = Object.entries(ITEM_TABELLE).map(([t, w]) => [t, pf < 0.5 ? lerp(w[0], w[1], pf * 2) : lerp(w[1], w[2], (pf - 0.5) * 2)]);
    }
    // Einschränkungen
    liste = liste.filter(([t]) => !(t === 'blau' && (this.liste.some(g => g.typ === 'blau') || r.karts.some(x => x.item === 'blau'))) && !(t === 'blitz' && this.blitzCD > 0) && !(r.teams && t === 'blau' && false));
    if (r.modus === 'zeit') liste = [['nitro', 1]];
    let sum = 0; for (const [, w] of liste) sum += w;
    let x = R() * sum;
    for (const [t, w] of liste) { x -= w; if (x <= 0) return t; }
    return liste.length ? liste[0][0] : 'nitro';
  }
  // ---------- Benutzen ----------
  steuerung(k, inp) {
    const r = this.r;
    if (r.phase !== 'rennen' || k.tot || k.fertig && !r.welt.istArena) return;
    if (k.treffer || k.rettung > 0) return;
    if (k.item === 'goldnitro' && k.goldT <= 0 && k.goldBenutzt) { k.item = null; k.goldBenutzt = false; }
    if (k.orbit.length && inp.itemDruck) { this.orbitFeuern(k, inp.bremse); return; }
    if (k.gehalten) { if (!inp.item) this.loslassen(k, inp.bremse); return; }
    if (!k.item || k.roulette > 0) return;
    if (inp.itemDruck) this.benutze(k, inp);
  }
  benutze(k, inp) {
    const t = k.item;
    const fertig = () => { k.anzahl--; if (k.anzahl <= 0) { k.item = null; k.anzahl = 0; } };
    switch (t) {
      case 'nitro': case 'nitro3': k.boost(1.4, 'nitro'); fertig(); this.r.fx.text(k, 'Nitro!'); break;
      case 'goldnitro':
        if (k.goldT <= 0 && !k.goldBenutzt) { k.goldT = 7.5; k.goldBenutzt = true; }
        k.boost(1.1, 'nitro');
        break;
      case 'banane': case 'gruen': case 'rot': case 'bombe': case 'falle':
        k.gehalten = t; k.item = null; k.anzahl = 0;
        if (!inp.item) this.loslassen(k, inp.bremse);
        break;
      case 'banane3': case 'gruen3': case 'rot3':
        k.orbit = [{ typ: t.slice(0, -1) }, { typ: t.slice(0, -1) }, { typ: t.slice(0, -1) }];
        k.item = null; k.anzahl = 0;
        break;
      case 'stern': k.sternT = 7.5; k.item = null; if (k.lokal >= 0) Ton.sfx('stern'); this.r.ereignis('stern', k); break;
      case 'rakete': k.raketeT = 6.5; k.item = null; k.driftEnde(false); if (k.lokal >= 0) Ton.sfx('rakete'); this.r.ereignis('rakete', k); break;
      case 'muenze': k.muenzen = Math.min(10, k.muenzen + 2); k.item = null; if (k.lokal >= 0) { Ton.sfx('muenze'); setTimeout(() => Ton.sfx('muenze'), 140); } this.r.fx.glitzer(k.pos, '#ffd23a', 16); break;
      case 'blau': k.item = null; this.aktion(k, 'blau'); break;
      case 'blitz': k.item = null; this.aktion(k, 'blitz'); break;
      case 'tinte': k.item = null; this.aktion(k, 'tinte'); break;
      case 'hupe': k.item = null; this.aktion(k, 'hupe'); break;
      default: k.item = null;
    }
  }
  // Aktionen, die den Host brauchen (im Netz schickt der Gast sie)
  aktion(k, art, rueck, typ) {
    if (this.gast && k.typ === 'spieler') { this.r.netz.aktion(k, art, rueck, typ); return; }
    this.ausfuehren(k, art, rueck, typ);
  }
  ausfuehren(k, art, rueck, typ) {
    const r = this.r;
    switch (art) {
      case 'wurf': this.wirf(k, typ, rueck); break;
      case 'blau': {
        const g = this.spawn('blau', k.pos.clone().add(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(), k);
        g.s = k.P.s;
        Ton.sfx('wurf');
        break;
      }
      case 'blitz': {
        this.blitzCD = 12;
        const n = r.karts.length;
        for (const o of r.karts) {
          if (o === k || r.gleichesTeam(o, k)) continue;
          if (o.sternT > 0 || o.raketeT > 0) continue;
          const pf = n > 1 ? (o.platz - 1) / (n - 1) : 0;
          r.trifft(o, 'blitz', k, { klein: 4 + (1 - pf) * 4 });
        }
        r.ereignis('blitz', k);
        break;
      }
      case 'tinte': {
        for (const o of r.karts) {
          if (o === k || r.gleichesTeam(o, k)) continue;
          if (r.welt.istArena || o.platz < k.platz) r.trifft(o, 'tinte', k);
        }
        r.ereignis('tinte', k);
        break;
      }
      case 'hupe': {
        r.fx.welle(k.pos, 11);
        for (const o of r.karts) {
          if (o === k || r.gleichesTeam(o, k)) continue;
          if (o.pos.distanceTo(k.pos) < 11) r.trifft(o, 'salto', k);
        }
        for (const g of this.liste) if (g.pos.distanceTo(k.pos) < 12 && g.besitzer !== k) this.zerstoere(g, true);
        r.ereignis('hupe', k);
        break;
      }
      case 'orbit': this.orbitWurf(k, typ, rueck); break;
    }
  }
  loslassen(k, rueck) {
    const t = k.gehalten; k.gehalten = null;
    this.aktion(k, 'wurf', rueck, t);
  }
  orbitFeuern(k, rueck) {
    const o = k.orbit.shift();
    if (!o) return;
    this.aktion(k, 'orbit', rueck, o.typ);
  }
  orbitWurf(k, typ, rueck) { this.wirf(k, typ, rueck); }
  entferneGehalten(k) { k.gehalten = null; }
  entferneOrbit(k) { k.orbit = []; }
  // Wurf in Fahrtrichtung oder nach hinten
  wirf(k, typ, rueck) {
    const r = this.r;
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    const nachHinten = (typ === 'banane' || typ === 'falle') ? !rueck : !!rueck;
    const pos = k.pos.clone();
    const vel = new THREE.Vector3();
    Ton.sfx('wurf', k.lokal >= 0 ? 1 : 0.4);
    if (typ === 'banane' || typ === 'falle' || typ === 'bombe') {
      if (nachHinten) {
        pos.x -= fx * 2.6; pos.z -= fz * 2.6; pos.y += 0.6;
        vel.set(-fx * 3, 2, -fz * 3);
      } else {
        pos.x += fx * 2.2; pos.z += fz * 2.2; pos.y += 1.2;
        const v = Math.max(k.v, 0) + 14;
        vel.set(fx * v, 9, fz * v);
      }
      const g = this.spawn(typ, pos, vel, k);
      g.luft = true;
      if (typ === 'bombe') g.zuender = 3;
    } else if (typ === 'gruen' || typ === 'rot') {
      const sp = 48 * (CC[r.cc].max / 29) ** 0.5;
      const dir = nachHinten ? -1 : 1;
      pos.x += fx * 2.4 * dir; pos.z += fz * 2.4 * dir;
      vel.set(fx * sp * dir, 0, fz * sp * dir);
      const g = this.spawn(typ, pos, vel, k);
      if (typ === 'rot' && !nachHinten) g.ziel = this.rotZiel(k);
    }
  }
  rotZiel(k) {
    const r = this.r;
    if (r.welt.istArena) {
      let best = null, bd = 1e9;
      for (const o of r.karts) {
        if (o === k || r.gleichesTeam(o, k) || o.tot) continue;
        const dx = o.pos.x - k.pos.x, dz = o.pos.z - k.pos.z;
        const ang = Math.abs(wrapA(Math.atan2(dx, dz) - k.yaw));
        const d = Math.hypot(dx, dz) * (1 + ang);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    let best = null;
    for (const o of r.karts) {
      if (o === k || r.gleichesTeam(o, k) || o.fertig) continue;
      if (o.fortschritt > k.fortschritt && (!best || o.fortschritt < best.fortschritt)) best = o;
    }
    return best;
  }
  spawn(typ, pos, vel, besitzer) {
    const g = { id: this.id++, typ, pos, vel, besitzer, t: 0, P: {}, luft: false, liegt: false, prall: 0, ziel: null };
    g.mesh = baueItemModell(typ);
    g.mesh.position.copy(pos);
    this.r.szene.add(g.mesh);
    this.r.welt.proj(g.P, pos.x, pos.y, pos.z);
    if (besitzer) g.P.si = besitzer.P.si;
    this.liste.push(g);
    return g;
  }
  zerstoere(g, effekt) {
    if (g.weg) return;
    g.weg = true;
    this.r.szene.remove(g.mesh);
    if (effekt) {
      if (g.typ === 'bombe' || g.typ === 'blau') this.explosion(g.pos, g.besitzer, g.typ === 'blau' ? 7 : 8);
      else this.r.fx.truemmer(g.pos, g.typ === 'gruen' ? '#2ccf4a' : g.typ === 'rot' ? '#e8302c' : g.typ === 'banane' ? '#ffd92e' : '#ff6a5a');
    }
  }
  explosion(pos, besitzer, radius) {
    const r = this.r;
    r.fx.explosion(pos, radius);
    for (const o of r.karts) {
      if (besitzer && r.gleichesTeam(o, besitzer) && o !== besitzer) continue;
      if (o.pos.distanceTo(pos) < radius) r.trifft(o, 'salto', besitzer);
    }
    r.kameraWackelnAlle(pos, 1.0);
    Ton.sfx('explo', 0.9);
    r.ereignis('explo', null, { pos, radius });
  }
  // ---------- Bewegung der Geschosse ----------
  schritt(dt) {
    const r = this.r, w = r.welt;
    if (this.blitzCD > 0) this.blitzCD -= dt;
    if (this.gast) return;
    const g0 = SCHWERKRAFT * (w.schwer || 1);
    for (const g of this.liste) {
      if (g.weg) continue;
      g.t += dt;
      switch (g.typ) {
        case 'banane': case 'falle': case 'bombe': {
          if (g.luft) {
            g.vel.y -= g0 * dt;
            g.pos.addScaledVector(g.vel, dt);
            w.proj(g.P, g.pos.x, g.pos.y, g.pos.z);
            const aus = !w.istArena && Math.abs(g.P.d) > g.P.lim;
            if (!aus && g.pos.y <= g.P.bodenY) { g.pos.y = g.P.bodenY; g.luft = false; g.vel.set(g.vel.x * 0.3, 0, g.vel.z * 0.3); }
            if (!w.istArena && Math.abs(g.P.d) > g.P.lim - 0.5 && !g.P.fall) { g.pos.x -= g.P.hx * Math.sign(g.P.d) * 0.5; g.pos.z -= g.P.hz * Math.sign(g.P.d) * 0.5; g.vel.x *= -0.3; g.vel.z *= -0.3; }
            if (w.istArena) { const ww = w.wand(g.pos.x, g.pos.z, 0.6); if (ww) { g.pos.x += ww.x; g.pos.z += ww.z; g.vel.x *= -0.3; g.vel.z *= -0.3; } }
            if (g.pos.y < (w.todY || -40)) { this.zerstoere(g); continue; }
          } else if (g.vel.lengthSq() > 0.01) {
            g.pos.addScaledVector(g.vel, dt);
            g.vel.multiplyScalar(Math.exp(-4 * dt));
            w.proj(g.P, g.pos.x, g.pos.y, g.pos.z);
            g.pos.y = g.P.bodenY;
          }
          if (g.typ === 'bombe') {
            g.zuender -= dt;
            let nah = false;
            if (!g.luft && g.t > 0.6) for (const k of r.karts) if (k.pos.distanceToSquared(g.pos) < 12) nah = true;
            if (g.zuender <= 0 || nah) { this.zerstoere(g, true); continue; }
          }
          if (g.t > 90 && g.typ !== 'bombe') this.zerstoere(g);
          break;
        }
        case 'gruen': case 'rot': {
          if (g.typ === 'rot' && g.ziel && !g.ziel.fertig && g.t > 0.15) {
            const z = g.ziel;
            const dist = Math.hypot(z.pos.x - g.pos.x, z.pos.z - g.pos.z);
            let tx, tz;
            if (dist < 28 || w.istArena) { tx = z.pos.x; tz = z.pos.z; }
            else {
              const p = g.P.ab >= 0 ? w.abkPunkt(w.abk[g.P.ab], g.P.abS + 16, 0, _v1) : w.punkt(g.P.s + 16, clamp(z.P.ab >= 0 ? 0 : z.P.d, -6, 6), _v1);
              tx = p.x; tz = p.z;
            }
            const soll = Math.atan2(tx - g.pos.x, tz - g.pos.z);
            const ist = Math.atan2(g.vel.x, g.vel.z);
            const sp = Math.hypot(g.vel.x, g.vel.z);
            const neu = ist + clamp(wrapA(soll - ist), -7 * dt, 7 * dt);
            g.vel.x = Math.sin(neu) * sp; g.vel.z = Math.cos(neu) * sp;
          }
          g.pos.x += g.vel.x * dt; g.pos.z += g.vel.z * dt;
          w.proj(g.P, g.pos.x, g.pos.y, g.pos.z);
          if (w.istArena) {
            const ww = w.wand(g.pos.x, g.pos.z, 0.55);
            if (ww) { g.pos.x += ww.x; g.pos.z += ww.z; const l = Math.hypot(ww.x, ww.z); const nx = ww.x / l, nz = ww.z / l; const vn = g.vel.x * nx + g.vel.z * nz; g.vel.x -= 2 * vn * nx; g.vel.z -= 2 * vn * nz; g.prall++; }
          } else if (Math.abs(g.P.d) > g.P.lim - 0.6) {
            if (g.P.fall) { g.vel.y = (g.vel.y || 0) - g0 * dt; g.pos.y += g.vel.y * dt; if (g.pos.y < g.P.bodenY - 10) { this.zerstoere(g); continue; } break; }
            const sgn = Math.sign(g.P.d);
            const nx = -g.P.hx * sgn, nz = -g.P.hz * sgn;
            g.pos.x += nx * (Math.abs(g.P.d) - g.P.lim + 0.6); g.pos.z += nz * (Math.abs(g.P.d) - g.P.lim + 0.6);
            const vn = g.vel.x * nx + g.vel.z * nz;
            if (vn < 0) { g.vel.x -= 2 * vn * nx; g.vel.z -= 2 * vn * nz; g.prall++; }
          }
          g.pos.y = damp(g.pos.y, g.P.bodenY, 20, dt);
          if (g.t > (g.typ === 'rot' ? 12 : 10) || g.prall > (g.typ === 'rot' ? 2 : 6)) { this.zerstoere(g, true); continue; }
          break;
        }
        case 'blau': {
          // Fliegt über die Strecke zum Ersten
          let erster = null;
          for (const k of r.karts) if (!k.fertig && (!erster || k.fortschritt > erster.fortschritt)) erster = k;
          if (!erster) { this.zerstoere(g, true); continue; }
          if (!g.sturz) {
            g.s += 62 * dt;
            const p = w.punkt(g.s, 0, _v1);
            g.pos.set(p.x, p.y + 4.5, p.z);
            let ds = erster.P.s - g.s; ds = ((ds % w.L) + w.L) % w.L;
            if (ds < 14 || ds > w.L - 6 || g.t > 30) { g.sturz = 0.01; }
          } else {
            g.sturz += dt;
            g.pos.lerp(_v1.copy(erster.pos).add(_v2.set(0, 1.5 + Math.max(0, 0.9 - g.sturz) * 8, 0)), 1 - Math.exp(-10 * dt));
            if (g.sturz > 0.95) { this.zerstoere(g, true); continue; }
          }
          break;
        }
      }
      // Treffer mit Karts
      if (g.typ !== 'blau') {
        for (const k of r.karts) {
          if (k.rettung > 0) continue;
          if (k === g.besitzer && g.t < (g.typ === 'gruen' || g.typ === 'rot' ? 0.5 : 0.8)) continue;
          if (g.besitzer && k !== g.besitzer && r.gleichesTeam(k, g.besitzer)) continue;
          const dx = k.pos.x - g.pos.x, dz = k.pos.z - g.pos.z, dy = k.pos.y - g.pos.y;
          const rad = k.sternT > 0 ? 2.4 : 1.7;
          if (dx * dx + dz * dz < rad * rad && Math.abs(dy) < 2.2) {
            // Schutz durch gehaltenes Item hinten
            if ((k.gehalten || k.orbit.length) && (g.typ === 'gruen' || g.typ === 'rot')) {
              const hinten = Math.cos(wrapA(Math.atan2(-dx, -dz) - k.yaw)) < -0.2;
              if (hinten || k.orbit.length) { if (k.orbit.length) k.orbit.shift(); else k.gehalten = null; this.zerstoere(g, true); break; }
            }
            if (g.typ === 'bombe') { this.zerstoere(g, true); break; }
            if (k.sternT <= 0 && k.raketeT <= 0) r.trifft(k, g.typ === 'banane' ? 'dreh' : 'salto', g.besitzer);
            this.zerstoere(g, true);
            break;
          }
        }
      }
    }
    // Geschosse untereinander
    const L = this.liste;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.weg || a.typ === 'blau') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.weg || b.typ === 'blau') continue;
        if (!(a.typ === 'gruen' || a.typ === 'rot' || b.typ === 'gruen' || b.typ === 'rot')) continue;
        if (a.pos.distanceToSquared(b.pos) < 1.6) { this.zerstoere(a, true); this.zerstoere(b, true); }
      }
      // gegen gehaltene/kreisende Items anderer Karts
      if (a.weg || !(a.typ === 'gruen' || a.typ === 'rot')) continue;
      for (const k of r.karts) {
        if (k === a.besitzer && a.t < 0.6) continue;
        for (const p of this.schutzPunkte(k)) {
          if (a.pos.distanceToSquared(p.pos) < 1.4) {
            if (p.orbit) k.orbit.splice(k.orbit.indexOf(p.orbit), 1); else k.gehalten = null;
            this.zerstoere(a, true);
            break;
          }
        }
        if (a.weg) break;
      }
    }
    // Kreisende Kugeln treffen andere Karts
    for (const k of r.karts) {
      if (!k.orbit.length || k.orbit[0].typ === 'banane') continue;
      for (const p of this.schutzPunkte(k)) {
        for (const o of r.karts) {
          if (o === k || r.gleichesTeam(o, k) || o.rettung > 0) continue;
          if (o.pos.distanceToSquared(p.pos) < 2.6) {
            k.orbit.splice(k.orbit.indexOf(p.orbit), 1);
            r.trifft(o, 'salto', k);
            r.fx.truemmer(p.pos, p.orbit.typ === 'gruen' ? '#2ccf4a' : '#e8302c');
            break;
          }
        }
      }
    }
    this.liste = this.liste.filter(g => !g.weg);
  }
  // Positionen der gehaltenen bzw. kreisenden Items eines Karts
  schutzPunkte(k) {
    const out = [];
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    if (k.gehalten) out.push({ pos: new THREE.Vector3(k.pos.x - fx * 2.0, k.pos.y + 0.2, k.pos.z - fz * 2.0) });
    const z = this.r.zeit;
    k.orbit.forEach((o, i) => {
      let p;
      if (o.typ === 'banane') p = new THREE.Vector3(k.pos.x - fx * (2.0 + i * 1.3), k.pos.y + 0.1, k.pos.z - fz * (2.0 + i * 1.3));
      else { const a = z * 5 + i / k.orbit.length * TAU; p = new THREE.Vector3(k.pos.x + Math.sin(a) * 2.2, k.pos.y + 0.4, k.pos.z + Math.cos(a) * 2.2); }
      out.push({ pos: p, orbit: o });
    });
    return out;
  }
  // ---------- Darstellung ----------
  darstellen(dt, zeit) {
    for (const g of this.liste) {
      if (g.gastZiel) { g.pos.lerp(g.gastZiel, 1 - Math.exp(-14 * dt)); }
      g.mesh.position.copy(g.pos);
      if (g.typ === 'gruen' || g.typ === 'rot') g.mesh.rotation.y += dt * 14;
      else if (g.typ === 'blau') { g.mesh.rotation.y += dt * 8; g.mesh.position.y += Math.sin(zeit * 10) * 0.1; }
      else if (g.typ === 'falle') { const w = g.mesh.userData.wuerfel; if (w) { w.rotation.y = zeit * 1.2; w.userData.wuerfel.rotation.set(zeit * 0.7, zeit * 1.1, 0); } }
      else if (g.typ === 'bombe') { g.mesh.scale.setScalar(g.zuender !== undefined && g.zuender < 1 ? 1 + Math.sin(zeit * 40) * 0.08 : 1); }
      if (g.typ === 'blau' && Math.random() < 0.5) this.r.fx.spur(g.pos, '#4f8fff');
    }
    // Gehaltene und kreisende Items
    const benutzt = new Set();
    for (const k of this.r.karts) {
      const pts = this.schutzPunkte(k);
      const typen = [];
      if (k.gehalten) typen.push(k.gehalten);
      for (const o of k.orbit) typen.push(o.typ);
      pts.forEach((p, i) => {
        const key = k.idx + ':' + i + ':' + typen[i];
        benutzt.add(key);
        let m = this.gehaltenMesh.get(key);
        if (!m) { m = baueItemModell(typen[i]); m.scale.setScalar(0.85); this.r.szene.add(m); this.gehaltenMesh.set(key, m); }
        m.position.copy(p.pos);
        m.position.y -= 0.1;
        m.rotation.y = k.yaw + (p.orbit && p.orbit.typ !== 'banane' ? zeit * 8 : 0);
        if (typen[i] === 'falle' && m.userData.wuerfel) m.userData.wuerfel.userData.wuerfel.rotation.set(zeit, zeit * 1.3, 0);
      });
    }
    for (const [key, m] of this.gehaltenMesh) if (!benutzt.has(key)) { this.r.szene.remove(m); this.gehaltenMesh.delete(key); }
  }
  // ---------- Netz ----------
  netzZustand() {
    return this.liste.map(g => [g.id, ITEM_CODE.indexOf(g.typ), r2(g.pos.x), r2(g.pos.y), r2(g.pos.z)]);
  }
  netzSetzen(arr) {
    const da = new Map(this.liste.map(g => [g.id, g]));
    const neu = [];
    for (const [id, tc, x, y, z] of arr) {
      let g = da.get(id);
      if (!g) {
        g = { id, typ: ITEM_CODE[tc], pos: new THREE.Vector3(x, y, z), P: {}, t: 0 };
        g.mesh = baueItemModell(g.typ); g.mesh.position.copy(g.pos); this.r.szene.add(g.mesh);
      }
      g.gastZiel = new THREE.Vector3(x, y, z);
      da.delete(id);
      neu.push(g);
    }
    for (const g of da.values()) { this.r.szene.remove(g.mesh); if (g.typ === 'gruen' || g.typ === 'rot' || g.typ === 'banane' || g.typ === 'falle') this.r.fx.truemmer(g.pos, '#fff'); }
    this.liste = neu;
  }
}
