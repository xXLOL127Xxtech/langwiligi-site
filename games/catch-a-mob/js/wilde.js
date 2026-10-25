'use strict';
// Catch a Mob – wilde Mobs laufen in der Welt herum. Friedliche greift man nur an, wenn man will,
// bösartige jagen dich. Manchmal springt auch einer aus dem hohen Gras.
// Wer wo auftaucht, richtet sich nach dem Lebensraum (hab in daten.js): Rehe und Raupen auf Wiesen, Frösche am Wasser,
// Eulen und Fledermäuse nachts bei Bäumen. Tiere mit herde kommen in Gruppen, die dem Anführer folgen. Es wimmelt aber genug, dass man in jeder Wiese etwas findet.
(function (G) {
  const CAM = G.CAM, S = CAM.S, Welt = CAM.Welt, T = Welt.T;
  const W = CAM.Wilde = { liste: [], sp: null, nextId: 1, nextHerde: 1, spawnT: 4, fuell: 0 };
  const MAX_WASSER = 3, MAX_SICHT = 2, MAX_GRUPPEN = 3, MAX_TIERE = 4, LEBEN = 300000;   // sehr wenige: höchstens 3 im Bild, 6 in der Umgebung (4 Bildschirme)
  const RAR_FAKTOR = [1, 0.45, 0.14, 0.04];   // seltene Mobs tauchen entsprechend seltener auf

  function gehbar(x, y) {
    if (Welt.blockiert(x - 0.3, y - 0.2) || Welt.blockiert(x + 0.3, y - 0.2) || Welt.blockiert(x - 0.3, y + 0.25) || Welt.blockiert(x + 0.3, y + 0.25)) return false;
    if (Welt.istSicher(x, y, 2)) return false;   // Dörfer betreten wilde Mobs nicht
    return true;
  }
  const imLand = w => CAM.FAMILIEN[w.mob.fam].lebt !== 'wasser';   // Wassertiere zählen nicht gegen die Grenzen für Landtiere
  W.boese = m => !!CAM.FAMILIEN[m.fam].bos;
  // Wassertiere (nur im Wasser) sieht und trifft man erst, wenn man selbst schwimmt
  W.sichtbar = w => CAM.FAMILIEN[w.mob.fam].lebt !== 'wasser' || !!S.schwimmt;
  // Wo darf diese Familie stehen? land: nur Land, wasser: nur Wasser, beide: Land und Wasser
  W.kannStehen = function (f, x, y) {
    if (Welt.istSicher(x, y, 2)) return false;
    const punkte = [[x - 0.3, y - 0.2], [x + 0.3, y - 0.2], [x - 0.3, y + 0.25], [x + 0.3, y + 0.25]];
    for (const [px, py] of punkte) {
      const nass = Welt.istWasser(px, py);
      if (f.lebt === 'wasser') { if (!nass) return false; }
      else if (f.lebt === 'beide') { if (!nass && Welt.blockiert(px, py)) return false; }
      else if (Welt.blockiert(px, py)) return false;
    }
    return true;
  };

  // Was gibt es rund um einen Punkt? (Wasser, Bäume, Felsen … im Umkreis von 3 Feldern)
  function ort(x, y) {
    const c = { wasser: 0, baum: 0, fels: 0, lava: 0, grab: 0, kristall: 0 }, x0 = Math.floor(x), y0 = Math.floor(y);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const t = Welt.get(x0 + dx, y0 + dy);
      if (t === T.WASSER) c.wasser++; else if (t === T.BAUM) c.baum++; else if (t === T.FELS) c.fels++; else if (t === T.LAVA) c.lava++;
      else if (t === T.GRAB) { c.grab++; c.baum++; } else if (t === T.KRISTALL) { c.kristall++; c.fels++; }
    }
    return { tile: Welt.get(x0, y0) === T.GRAS ? 'gras' : 'boden', c };
  }
  // Wie gut passt der Ort, die Tageszeit und das Wetter zu diesem Mob? 0 = gar nicht
  function passt(f, o, nacht, wetter) {
    const h = f.hab || {};
    let m = RAR_FAKTOR[f.rar] || 1;
    if (h.tile && h.tile !== o.tile) return 0;
    if (h.nah) {
      const l = [].concat(h.nah);
      if (!l.some(n => o.c[n] >= (h.min || (n === 'baum' ? 2 : 1)))) return 0;
    }
    if (h.zeit === 'nacht') m *= nacht ? 3 : (h.streng ? 0 : 0.2);
    else if (h.zeit === 'tag') m *= nacht ? (h.streng ? 0 : 0.25) : 1.5;
    if (h.wetter) m *= h.wetter.includes(wetter) ? 4 : (h.streng ? 0 : 0.15);
    return m;
  }
  // Welche Familie lebt hier? null, wenn am Ort niemand passt (dann taucht auch nichts auf)
  W.waehle = function (x, y, now, opt) {
    const bi = Welt.biomeAt(x, y), B = CAM.BIOME[bi], o = ort(x, y);
    if (opt && opt.tile) o.tile = opt.tile;
    const sais = CAM.saison(now), nacht = CAM.tageslicht(now) < 0.35, w = CAM.wetterBei(bi, now);
    let tot = 0;
    const l = B.spawn.map(([fam, g0]) => {
      const f = CAM.FAMILIEN[fam]; let g = f.lebt === 'wasser' ? 0 : g0 * passt(f, o, nacht, w);   // reine Wassertiere gibt es nicht an Land
      if (f.el === CAM.SAISON_BONUS[sais]) g *= 1.5;
      if (nacht && !(f.hab && f.hab.zeit) && (f.el === 'Schatten' || f.el === 'Licht' || f.el2 === 'Schatten')) g *= 1.8;
      if (w === 'gewitter' && f.el === 'Luft') g *= 1.8;
      if (w === 'regen' && f.el === 'Wasser') g *= 1.5;
      tot += g; return [fam, g];
    });
    if (tot <= 0) return null;
    let r = Math.random() * tot, fam = l[0][0];
    for (const [f, g] of l) { r -= g; if (r <= 0) { fam = f; break; } }
    // Spezial-Mobs: nur unter besonderen Umständen
    if (nacht && w === 'klar' && Math.random() < 0.012) fam = 24;
    else if (w === 'blutmond' && Math.random() < 0.05) fam = 25;
    return fam;
  };
  // Ein wilder Mob passend zum Ort (Stufe richtet sich nach der Entfernung zum Start)
  W.wildMob = function (x, y, now, fam, lv) {
    if (fam == null) {
      fam = W.waehle(x, y, now);
      if (fam == null) { const sp = CAM.BIOME[Welt.biomeAt(x, y)].spawn.filter(e => CAM.FAMILIEN[e[0]].lebt !== 'wasser'); fam = sp[Math.floor(Math.random() * sp.length)][0]; }
    }
    return CAM.neuerMob(fam, lv || Welt.wildLevel(x, y, Math.random()), { glanz: Math.random() < 1 / 64 });
  };

  function neu(mob, x, y, now, herde, fuehrer) {
    const f = CAM.FAMILIEN[mob.fam], sc = f.hab && f.hab.scheu;
    const w = { id: W.nextId++, mob, x, y, dir: Math.floor(Math.random() * 4), z: 'ruhe', t: 1 + Math.random() * 3, tx: x, ty: y, geboren: now, ruheBis: 0, scheu: sc === undefined ? Math.random() < 0.45 || !!f.spezial : (!!sc || !!f.spezial), geht: false, huepf: 0, herde, fuehrer, lauf: Math.random() * 4 };
    W.liste.push(w);
    return w;
  }
  // Bildschirmgrösse in Feldern (S.sicht wird in spiel.js gesetzt)
  const sicht = () => S.sicht || { w: 24, h: 15 };
  const imBild = (x, y, rand) => { const v = sicht(); return Math.abs(x - S.x) < v.w / 2 + (rand || 0) && Math.abs(y - S.y) < v.h / 2 + (rand || 0); };
  const umgebung = (x, y) => { const v = sicht(); return Math.abs(x - S.x) < v.w && Math.abs(y - S.y) < v.h; };
  W.neuAn = function (mob, x, y, now) { return neu(mob, x, y, now, W.nextHerde++, true); };
  // Neue Mobs tauchen nur ausserhalb des Bildes auf (im Ring knapp daneben), nie vor deinen Augen
  W.spawnen = function (now) {
    const v = sicht();
    if (W.liste.filter(w => imLand(w) && imBild(w.x, w.y)).length >= MAX_SICHT) return false;
    const frei = MAX_TIERE - W.liste.filter(w => imLand(w) && umgebung(w.x, w.y)).length;
    if (frei <= 0) return false;
    for (let versuch = 0; versuch < 40; versuch++) {
      const a = Math.random() * 6.283, rmin = Math.hypot(v.w / 2, v.h / 2) + 1.5, r = rmin + Math.random() * 9;
      const x = S.x + Math.cos(a) * r, y = S.y + Math.sin(a) * r;
      if (imBild(x, y, 1.5)) continue;
      if (x < 6 || y < 6 || x > Welt.W - 6 || y > Welt.H - 6) continue;
      const t = Welt.get(x, y);
      if ((t !== T.BODEN && t !== T.GRAS) || !gehbar(x, y)) continue;
      const fam = W.waehle(x, y, now);
      if (fam == null) continue;
      const f = CAM.FAMILIEN[fam], h = f.hab || {};
      // bösartige Mobs gibt es nachts öfter
      if (f.bos && CAM.tageslicht(now) > 0.6 && Math.random() < 0.4) continue;
      const lv = Welt.wildLevel(x, y, Math.random());
      const n = h.herde ? Math.min(frei, h.herde[0] + Math.floor(Math.random() * (h.herde[1] - h.herde[0] + 1))) : 1;
      const id = W.nextHerde++;
      neu(W.wildMob(x, y, now, fam, lv), x, y, now, id, true);
      for (let i = 1; i < n; i++) {
        for (let k = 0; k < 6; k++) {
          const b = Math.random() * 6.283, d = 0.9 + Math.random() * 1.8, hx = x + Math.cos(b) * d, hy = y + Math.sin(b) * d;
          const ht = Welt.get(hx, hy);
          if ((ht !== T.BODEN && ht !== T.GRAS) || !gehbar(hx, hy)) continue;
          neu(W.wildMob(hx, hy, now, fam, Math.max(2, lv + Math.floor(Math.random() * 3) - 1)), hx, hy, now, id, false);
          break;
        }
      }
      return true;
    }
    return false;
  };
  W.entfernen = w => { W.liste = W.liste.filter(x => x !== w); };
  W.naechster = function (x, y, rad) {
    let best = null, bd = rad;
    for (const w of W.liste) { if (!W.sichtbar(w)) continue; const d = Math.hypot(w.x - x, w.y - y); if (d < bd) { bd = d; best = w; } }
    return best;
  };

  function schritt(w, dx, dy) {
    let bewegt = false;
    const f = CAM.FAMILIEN[w.mob.fam], geh = f.lebt === 'land' ? gehbar : (x, y) => W.kannStehen(f, x, y);
    if (geh(w.x + dx, w.y)) { w.x += dx; bewegt = true; }
    if (geh(w.x, w.y + dy)) { w.y += dy; bewegt = true; }
    return bewegt;
  }
  // Neue Wassertiere tauchen nur auf, solange du schwimmst (sie sind dann auch zu sehen)
  W.spawnenWasser = function (now) {
    const hier = W.liste.filter(w => CAM.FAMILIEN[w.mob.fam].lebt !== 'land' && Welt.istWasser(w.x, w.y) && umgebung(w.x, w.y)).length;
    if (hier >= MAX_WASSER) return false;
    const kand = CAM.FAMILIEN.filter(f => f.lebt === 'wasser' || f.lebt === 'beide');
    for (let versuch = 0; versuch < 30; versuch++) {
      const a = Math.random() * 6.283, r = 3 + Math.random() * 15, x = S.x + Math.cos(a) * r, y = S.y + Math.sin(a) * r;
      if (x < 6 || y < 6 || x > Welt.W - 6 || y > Welt.H - 6 || !Welt.istWasser(x, y)) continue;
      let tot = 0; const gew = kand.map(f => { let g = (RAR_FAKTOR[f.rar] || 1) * (f.lebt === 'wasser' ? 2 : 1); if (f.bos && CAM.tageslicht(now) > 0.6) g *= 0.6; tot += g; return g; });
      let q = Math.random() * tot, f = kand[0];
      for (let i = 0; i < kand.length; i++) { q -= gew[i]; if (q <= 0) { f = kand[i]; break; } }
      if (f.lebt === 'beide' && imBild(x, y, 1.5)) continue;   // sichtbare Tiere tauchen nie vor deinen Augen auf
      if (!W.kannStehen(f, x, y)) continue;
      const m = W.wildMob(x, y, now, f.id, Welt.wildLevel(x, y, Math.random()));
      const e = neu(m, x, y, now, W.nextHerde++, true); e.scheu = false;
      return true;
    }
    return false;
  };

  W.update = function (dt, now, frei) {
    // Neue nachspawnen: selten, nur ausserhalb des Bildes und nie über das Limit
    if (W.fuell > 0 && S.modus === 'welt' && !Welt.dorfBei(S.x, S.y)) { W.fuell--; W.spawnen(now); }
    W.spawnT -= dt;
    if (W.spawnT <= 0) {
      W.spawnT = 6 + Math.random() * 8;
      const gruppen = new Set(W.liste.filter(imLand).map(w => w.herde)).size;
      if (gruppen < MAX_GRUPPEN && Math.random() < 0.65 && S.modus === 'welt' && !Welt.dorfBei(S.x, S.y)) W.spawnen(now);
    }
    // Wassertiere: Die Gegend ist von Anfang an gefüllt (auch wenn man sie von Land aus nicht sieht) und füllt sich nach einem Fang langsam wieder
    if (S.modus === 'welt' && !Welt.dorfBei(S.x, S.y)) {
      if (S.schwimmt && !W.warImWasser) { W.warImWasser = true; for (let i = 0; i < MAX_WASSER; i++) if (!W.spawnenWasser(now)) break; }   // beim Eintauchen sofort alle da
      if (!S.schwimmt) W.warImWasser = false;
      W.wasserT = (W.wasserT || 0) - dt;
      if (W.wasserT <= 0) { W.wasserT = 3; W.spawnenWasser(now); }
    }
    const fuehrer = {};
    for (const w of W.liste) if (w.fuehrer) fuehrer[w.herde] = w;
    for (const w of W.liste) if (!fuehrer[w.herde]) { w.fuehrer = true; fuehrer[w.herde] = w; }   // Anführer weg: der nächste übernimmt
    const sicher = Welt.istSicher(S.x, S.y);
    for (const w of W.liste.slice()) {
      const d = Math.hypot(w.x - S.x, w.y - S.y);
      if (d > Math.hypot(sicht().w, sicht().h) * 1.15 || now - w.geboren > LEBEN) { W.entfernen(w); continue; }
      if (d < 6 && !w.gesehen) { w.gesehen = true; if (!S.save.dex[w.mob.fam]) { S.save.dex[w.mob.fam] = 1; } }
      w.huepf = Math.max(0, w.huepf - dt);
      const boese = W.boese(w.mob), kann = frei && CAM.lebend() && !sicher && now > w.ruheBis && W.sichtbar(w);
      let vx = 0, vy = 0, tempo = 0;
      if (boese && kann && d < 7.5 && !S.sp) {
        // Jagd
        if (w.z !== 'jagt') { w.z = 'jagt'; w.alarm = now; w.huepf = 0.35; CAM.UI.snd('ruf'); }
        const ux = (S.x - w.x) / (d || 1), uy = (S.y - w.y) / (d || 1);
        if (now - w.alarm > 450) { vx = ux; vy = uy; tempo = 3.4; }
        if (d < 0.95 && now - w.alarm > 450) {
          w.z = 'ruhe'; w.t = 2;
          for (const o of W.liste) if (o.herde === w.herde && o !== w) { o.ruheBis = now + 15000; o.z = 'ruhe'; }   // der Rest der Gruppe wartet den Kampf ab
          CAM.A.wildKampf(w.mob, { intro: 'Ein bösartiger ' + CAM.name(w.mob) + ' (Lv ' + w.mob.lv + ') greift dich an!', entity: w, erster: 1 });
          continue;
        }
      } else if (w.z === 'jagt') { w.z = 'ruhe'; w.t = 1.5; }
      else if (!boese && w.scheu && d < 3.2 && frei && W.sichtbar(w)) {
        // scheue Mobs weichen aus
        w.z = 'flieht'; vx = (w.x - S.x) / (d || 1); vy = (w.y - S.y) / (d || 1); tempo = 2.6;
      } else {
        w.t -= dt;
        const fu = fuehrer[w.herde], folgt = fu && fu !== w;
        if (w.z === 'flieht') w.z = 'ruhe';
        if (folgt && w.z !== 'geht' && Math.hypot(fu.x - w.x, fu.y - w.y) > 4.5) {
          // zu weit vom Anführer weg: aufholen
          w.tx = fu.x + (Math.random() - 0.5) * 2; w.ty = fu.y + (Math.random() - 0.5) * 2; w.z = 'geht'; w.t = 4; w.eilt = true;
        } else if (w.z === 'ruhe' && w.t <= 0) {
          const a = Math.random() * 6.283, r = folgt ? 0.8 + Math.random() * 2.2 : 1.5 + Math.random() * 4;
          const bx = folgt ? fu.x : w.x, by = folgt ? fu.y : w.y;
          w.tx = bx + Math.cos(a) * r; w.ty = by + Math.sin(a) * r; w.z = 'geht'; w.t = 2 + Math.random() * 3; w.eilt = false;
        } else if (w.z === 'geht') {
          const dd = Math.hypot(w.tx - w.x, w.ty - w.y);
          if (dd < 0.2 || w.t <= 0) { w.z = 'ruhe'; w.t = folgt ? 1 + Math.random() * 3 : 2 + Math.random() * 5; w.eilt = false; }
          else { vx = (w.tx - w.x) / dd; vy = (w.ty - w.y) / dd; tempo = w.eilt ? 1.9 : 1.1; }
        }
      }
      if (w.fest && (w.z === 'geht' || w.z === 'flieht')) { w.z = 'ruhe'; vx = vy = tempo = 0; }
      w.geht = false;
      if (tempo) {
        const ok = schritt(w, vx * tempo * dt, vy * tempo * dt);
        w.geht = ok;
        if (ok) w.lauf = (w.lauf + Math.min(11, tempo * 4.6) * dt) % 4;   // Laufbild folgt der Geschwindigkeit
        if (!ok && w.z === 'geht') { w.z = 'ruhe'; w.t = 0.5; }
        if (Math.abs(vx) > Math.abs(vy)) w.dir = vx > 0 ? 1 : 3; else w.dir = vy > 0 ? 2 : 0;
      }
    }
  };

  // Ein Mob springt aus dem hohen Gras
  function gehbarFuerSprung(x, y) { return !(Welt.blockiert(x - 0.3, y - 0.2) || Welt.blockiert(x + 0.3, y - 0.2) || Welt.blockiert(x - 0.3, y + 0.25) || Welt.blockiert(x + 0.3, y + 0.25)); }
  W.sprung = function (now) {
    if (S.sp || S.busy || !CAM.lebend()) return false;
    const grass = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && Welt.get(S.x + dx, S.y + dy) === T.GRAS) grass.push([Math.floor(S.x) + dx + 0.5, Math.floor(S.y) + dy + 0.5]);
    const start = grass.length ? grass[Math.floor(Math.random() * grass.length)] : [S.x + 1, S.y];
    const fam = W.waehle(S.x, S.y, now, { tile: 'gras' });
    const mob = W.wildMob(S.x, S.y, now, fam);
    S.sp = { mob, x0: start[0], y0: start[1], t0: performance.now(), dauer: 900 };
    S.busy = true; CAM.UI.snd('ruf');
    setTimeout(() => {
      const sp = S.sp; S.sp = null; S.busy = false;
      if (sp) {
        // Der Mob steht danach dort, wo er herausgesprungen ist (auch wenn man flieht)
        const ex = S.x + [0, 1.3, 0, -1.3][S.dir], ey = S.y + [-1.3, 0, 1.3, 0][S.dir];
        const ok = gehbarFuerSprung(ex, ey), px = ok ? ex : sp.x0, py = ok ? ey : sp.y0;
        const ent = W.neuAn(sp.mob, px, py, Date.now());
        ent.fest = true; ent.scheu = false; ent.dir = (S.dir + 2) % 4;
        CAM.A.wildKampf(sp.mob, { intro: 'Ein ' + CAM.name(sp.mob) + ' (Lv ' + sp.mob.lv + ') springt aus dem Gebüsch!', erster: 1, hinterhalt: true, entity: ent });
      }
    }, S.sp.dauer + 150);
    return true;
  };
})(window);
