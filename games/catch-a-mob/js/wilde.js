'use strict';
// Catch a Mob – wilde Mobs laufen in der Welt herum. Friedliche greift man nur an, wenn man will,
// bösartige jagen dich. Manchmal springt auch einer aus dem hohen Gras.
(function (G) {
  const CAM = G.CAM, S = CAM.S, Welt = CAM.Welt, T = Welt.T;
  const W = CAM.Wilde = { liste: [], sp: null, nextId: 1, spawnT: 0 };
  const MAX = 15, RAD_MIN = 9, RAD_MAX = 22, DESPAWN = 36, LEBEN = 240000;

  function gehbar(x, y) {
    if (Welt.blockiert(x - 0.3, y - 0.2) || Welt.blockiert(x + 0.3, y - 0.2) || Welt.blockiert(x - 0.3, y + 0.25) || Welt.blockiert(x + 0.3, y + 0.25)) return false;
    if (Welt.istSicher(x, y, 2)) return false;   // Dörfer betreten wilde Mobs nicht
    return true;
  }
  W.boese = m => !!CAM.FAMILIEN[m.fam].bos;

  W.spawnen = function (now) {
    const bi = Welt.biomeAt(S.x, S.y);
    for (let versuch = 0; versuch < 8; versuch++) {
      const a = Math.random() * 6.283, r = RAD_MIN + Math.random() * (RAD_MAX - RAD_MIN);
      const x = S.x + Math.cos(a) * r, y = S.y + Math.sin(a) * r;
      if (x < 6 || y < 6 || x > Welt.W - 6 || y > Welt.H - 6) continue;
      const t = Welt.get(x, y);
      if ((t !== T.BODEN && t !== T.GRAS) || !gehbar(x, y)) continue;
      const mob = CAM.A.wildMob(x, y, now);
      // bösartige Mobs gibt es nachts öfter
      if (W.boese(mob) && CAM.tageslicht(now) > 0.6 && Math.random() < 0.4) continue;
      W.liste.push({ id: W.nextId++, mob, x, y, dir: Math.floor(Math.random() * 4), z: 'ruhe', t: 1 + Math.random() * 3, tx: x, ty: y, geboren: now, ruheBis: 0, scheu: Math.random() < 0.45, geht: false, huepf: 0 });
      return;
    }
  };
  W.entfernen = w => { W.liste = W.liste.filter(x => x !== w); };
  W.naechster = function (x, y, rad) {
    let best = null, bd = rad;
    for (const w of W.liste) { const d = Math.hypot(w.x - x, w.y - y); if (d < bd) { bd = d; best = w; } }
    return best;
  };

  function schritt(w, dx, dy) {
    let bewegt = false;
    if (gehbar(w.x + dx, w.y)) { w.x += dx; bewegt = true; }
    if (gehbar(w.x, w.y + dy)) { w.y += dy; bewegt = true; }
    return bewegt;
  }

  W.update = function (dt, now, frei) {
    // Neue nachspawnen
    W.spawnT -= dt;
    if (W.spawnT <= 0) {
      W.spawnT = 0.8;
      if (W.liste.length < MAX && S.modus === 'welt' && !Welt.dorfBei(S.x, S.y)) W.spawnen(now);
    }
    const sicher = Welt.istSicher(S.x, S.y);
    for (const w of W.liste.slice()) {
      const d = Math.hypot(w.x - S.x, w.y - S.y);
      if (d > DESPAWN || now - w.geboren > LEBEN) { W.entfernen(w); continue; }
      if (d < 6 && !w.gesehen) { w.gesehen = true; if (!S.save.dex[w.mob.fam]) { S.save.dex[w.mob.fam] = 1; } }
      w.huepf = Math.max(0, w.huepf - dt);
      const boese = W.boese(w.mob), kann = frei && CAM.lebend() && !sicher && now > w.ruheBis;
      let vx = 0, vy = 0, tempo = 0;
      if (boese && kann && d < 7.5 && !S.sp) {
        // Jagd
        if (w.z !== 'jagt') { w.z = 'jagt'; w.alarm = now; w.huepf = 0.35; CAM.UI.snd('ruf'); }
        const ux = (S.x - w.x) / (d || 1), uy = (S.y - w.y) / (d || 1);
        if (now - w.alarm > 450) { vx = ux; vy = uy; tempo = 3.4; }
        if (d < 0.95 && now - w.alarm > 450) {
          w.z = 'ruhe'; w.t = 2;
          CAM.A.wildKampf(w.mob, { intro: 'Ein bösartiger ' + CAM.name(w.mob) + ' (Lv ' + w.mob.lv + ') greift dich an!', entity: w });
          continue;
        }
      } else if (w.z === 'jagt') { w.z = 'ruhe'; w.t = 1.5; }
      else if (!boese && w.scheu && d < 3.2 && frei) {
        // scheue Mobs weichen aus
        w.z = 'flieht'; vx = (w.x - S.x) / (d || 1); vy = (w.y - S.y) / (d || 1); tempo = 2.6;
      } else {
        w.t -= dt;
        if (w.z === 'flieht') w.z = 'ruhe';
        if (w.z === 'ruhe' && w.t <= 0) {
          const a = Math.random() * 6.283, r = 1.5 + Math.random() * 4;
          w.tx = w.x + Math.cos(a) * r; w.ty = w.y + Math.sin(a) * r; w.z = 'geht'; w.t = 2 + Math.random() * 3;
        } else if (w.z === 'geht') {
          const dd = Math.hypot(w.tx - w.x, w.ty - w.y);
          if (dd < 0.2 || w.t <= 0) { w.z = 'ruhe'; w.t = 1.5 + Math.random() * 4; }
          else { vx = (w.tx - w.x) / dd; vy = (w.ty - w.y) / dd; tempo = 1.1; }
        }
      }
      w.geht = false;
      if (tempo) {
        const ok = schritt(w, vx * tempo * dt, vy * tempo * dt);
        w.geht = ok;
        if (!ok && w.z === 'geht') { w.z = 'ruhe'; w.t = 0.5; }
        if (Math.abs(vx) > Math.abs(vy)) w.dir = vx > 0 ? 1 : 3; else w.dir = vy > 0 ? 2 : 0;
      }
    }
  };

  // Ein Mob springt aus dem hohen Gras
  W.sprung = function (now) {
    if (S.sp || S.busy || !CAM.lebend()) return false;
    const grass = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && Welt.get(S.x + dx, S.y + dy) === T.GRAS) grass.push([Math.floor(S.x) + dx + 0.5, Math.floor(S.y) + dy + 0.5]);
    const start = grass.length ? grass[Math.floor(Math.random() * grass.length)] : [S.x + 1, S.y];
    const mob = CAM.A.wildMob(S.x, S.y, now);
    S.sp = { mob, x0: start[0], y0: start[1], t0: performance.now(), dauer: 900 };
    S.busy = true; CAM.UI.snd('ruf');
    setTimeout(() => {
      const sp = S.sp; S.sp = null; S.busy = false;
      if (sp) CAM.A.wildKampf(sp.mob, { intro: 'Ein ' + CAM.name(sp.mob) + ' (Lv ' + sp.mob.lv + ') springt aus dem Gebüsch!' });
    }, S.sp.dauer + 150);
    return true;
  };
})(window);
