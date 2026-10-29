'use strict';
// Catch a Mob – Bot-Spieler: laufen in der Welt herum, haben ein Team, nehmen Duelle mit Einsatz an oder lehnen sie ab
// und fordern dich manchmal selbst heraus. Ihr Team (auch gewonnene und verlorene Mobs) bleibt im Spielstand erhalten.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc, S = CAM.S, Welt = CAM.Welt, K = CAM.Kampf, A = CAM.A, Save = CAM.Save;
  const H = A.h, ge = H.ge, sleep = H.sleep;
  const Bots = CAM.Bots = { liste: [] };
  const ANZAHL = 22, CHAMPIONS = 4, WEITE = 16, SUCHE = 32;

  // ---------- Hilfen für faire Duelle ----------
  const lebende = team => team.filter(m => m.hp > 0);
  const top3 = team => lebende(team).slice().sort((a, b) => b.lv - a.lv).slice(0, 3);
  CAM.schnitt = team => { const t = top3(team); return t.length ? t.reduce((s, m) => s + m.lv, 0) / t.length : 1; };
  CAM.lvlMitte = (a, b) => Math.max(1, Math.round((CAM.schnitt(a) + CAM.schnitt(b)) / 2));
  // Kampfkopien: lvl > 0 = alle auf dieses Level (fairer Kampf), sonst echte Stufen. Immer volle LP, höchstens 3 Mobs.
  CAM.duellKopien = function (team, lvl) {
    return top3(team).map(m => { const c = CAM.kopie(m); if (lvl > 0) c.lv = lvl; CAM.neuBerechnen(c); c.hp = c.mhp; c.status = null; c.wunden = []; c.xp = 0; delete c.faintDone; return c; });
  };
  // Siegchance der Seite A in Prozent (viele Probekämpfe der Kampfregeln, Computer gegen Computer)
  CAM.siegChance = function (teamA, teamB, lvl, n) {
    n = n || 240; let w = 0;
    for (let i = 0; i < n; i++) {
      // Tagesform: Jeder Mob ist pro Probekampf bis zu 12 % stärker oder schwächer (Taktik, Reihenfolge, Glück), sonst gewinnt immer der Höhere
      const rnd = CAM.mulberry32(77 + i * 131), form = t => { t.forEach(m => { const f = () => 0.88 + rnd() * 0.24; m.atk = Math.round(m.atk * f()); m.def = Math.round(m.def * f()); m.spd = Math.round(m.spd * f()); m.mhp = Math.round(m.mhp * f()); m.hp = m.mhp; }); return t; };
      const b = new CAM.Battle({ kind: 'duel', seed: 1000 + i * 7919, actors: [
        { id: 'a', name: 'a', side: 0, ctrl: 'ai', team: form(CAM.duellKopien(teamA, lvl)) }, { id: 'b', name: 'b', side: 1, ctrl: 'ai', team: form(CAM.duellKopien(teamB, lvl)) }] });
      let g = 0; while (!b.over && g++ < 70) b.resolve();
      if (b.winner === 0) w++; else if (b.winner == null) w += 0.5;
    }
    // geglättet (Laplace) und nie ganz 0 oder 100: Auch ein klarer Favorit kann durch Treffer, Kritische und Fehlgriffe verlieren
    // Rohwert s (0 bis 1) aus den Probekämpfen, dann abgeflacht: Gleich starke Teams ergeben etwa 50 %, ein klarer Favorit höchstens 80 % und ein klarer Aussenseiter nie unter 10 %,
    // denn ein Kampf hat Glück (Treffer, Kritische, Fehlgriffe) und wer die besseren Elemente hat, hat es leichter. Gute Mobs beim Gegner drücken deine Chance spürbar.
    const sr = (w + 1) / (n + 2);
    return Math.round(10 + 70 * Math.pow(sr, 0.8));
  };
  const wert = m => CAM.preis(m) * (CAM.FAMILIEN[m.fam].spezial ? 4 : 1);
  CAM.mobWert = wert;

  // ---------- Erzeugen ----------
  function gehbar(x, y) { return !(Welt.blockiert(x - 0.3, y - 0.2) || Welt.blockiert(x + 0.3, y - 0.2) || Welt.blockiert(x - 0.3, y + 0.25) || Welt.blockiert(x + 0.3, y + 0.25)); }
  function teamFuer(rnd, hx, hy, champ) {
    const bi = Welt.biomeAt(hx, hy), B = CAM.BIOME[bi], lv = Welt.wildLevel(hx, hy, rnd());
    const n = CAM.TEAM_MAX, team = [];   // so viele Mobs wie du (Team-Maximum)
    if (champ) team.push(CAM.neuerMob(27, Math.min(100, lv + 4)));
    while (team.length < n) {
      let tot = 0; B.spawn.forEach(s => tot += s[1]);
      let r = rnd() * tot, fam = B.spawn[0][0];
      for (const [f, g] of B.spawn) { r -= g; if (r <= 0) { fam = f; break; } }
      team.push(CAM.neuerMob(fam, Math.max(5, lv - 1 + Math.floor(rnd() * 3))));
    }
    return team;
  }
  function neu(i, rnd, champ) {
    let hx = 0, hy = 0;
    for (let v = 0; v < 400; v++) {
      const a = rnd() * 6.283, d = champ ? 170 + rnd() * 260 : 10 + Math.pow(rnd(), 1.8) * 420;
      hx = Welt.START.x + Math.cos(a) * d; hy = Welt.START.y + Math.sin(a) * d;
      if (hx > 12 && hy > 12 && hx < Welt.W - 12 && hy < Welt.H - 12 && gehbar(hx, hy) && !Welt.dorfBei(hx, hy) && (Welt.get(hx, hy) === Welt.T.BODEN || Welt.get(hx, hy) === Welt.T.GRAS)) break;
    }
    const team = teamFuer(rnd, hx, hy, champ);
    const lv = Math.max.apply(null, team.map(m => m.lv));
    return { id: 'b' + i, name: CAM.TRAINER_VORNAMEN[(i * 7 + 3) % CAM.TRAINER_VORNAMEN.length] + (champ ? ' der Champion' : ''), col: Math.floor(rnd() * CAM.FARBEN.length), champ,
      hx, hy, x: hx, y: hy, team, gold: Math.round((60 + lv * 25) * (champ ? 3 : 1) * (0.7 + rnd() * 0.6)), ego: -0.1 + rnd() * 0.4 + (champ ? 0.15 : 0), mut: rnd() };
  }
  function laufzeit(b) { Object.assign(b, { dir: 2, geht: false, z: 'ruhe', t: 1 + Math.random() * 3, tx: b.x, ty: b.y, ruheBis: 0, provBis: Date.now() + 8000 + Math.random() * 30000, alarm: 0 }); b.lv = Math.max.apply(null, b.team.map(m => m.lv)); return b; }

  Bots.erzeugen = function () {
    Bots.liste = [];
    const gespeichert = S.save && S.save.bots;
    if (gespeichert && gespeichert.length) {
      Bots.liste = gespeichert.slice(0, ANZAHL).map(b => laufzeit({ id: b.id, name: b.name, col: b.col, champ: b.champ, hx: b.hx, hy: b.hy, x: b.hx, y: b.hy, team: b.team, gold: b.gold, ego: b.ego, mut: b.mut }));
      Bots.liste.forEach(b => { while (b.team.length < CAM.TEAM_MAX) { const m = CAM.neuerMob(CAM.FAMILIEN[b.team[0] ? b.team[0].fam : 0].id, Math.max(5, b.lv - 2)); b.team.push(m); } });   // alte Spielstände: auf 3 Mobs auffüllen
      return;
    }
    const rnd = CAM.mulberry32(Welt.seed * 31 + 7);
    for (let i = 0; i < ANZAHL; i++) Bots.liste.push(laufzeit(neu(i, rnd, i < CHAMPIONS)));
  };
  Bots.speichern = () => Bots.liste.map(b => ({ id: b.id, name: b.name, col: b.col, champ: b.champ, hx: b.hx, hy: b.hy, team: b.team, gold: b.gold, ego: b.ego, mut: b.mut }));
  Bots.naechster = function (x, y, rad) { let best = null, bd = rad; for (const b of Bots.liste) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } } return best; };
  const auffuellen = b => { while (b.team.length < CAM.TEAM_MAX) b.team.push(CAM.neuerMob(CAM.FAMILIEN[b.team[0] ? b.team[0].fam : 0].id, Math.max(5, b.lv - 2))); b.team.forEach(m => { m.hp = m.mhp; m.status = null; m.wunden = []; }); b.lv = Math.max.apply(null, b.team.map(m => m.lv)); };

  // ---------- Bewegung ----------
  function schritt(b, dx, dy) {
    let ok = false;
    if (gehbar(b.x + dx, b.y)) { b.x += dx; ok = true; }
    if (gehbar(b.x, b.y + dy)) { b.y += dy; ok = true; }
    return ok;
  }

  // ---------- Wegfindung (A* auf dem Feldraster) ----------
  // Nur wer auf dich zuläuft, sucht sich einen Weg um Hindernisse (Wasser, Bäume, Felsen, Mauern). Es jagt immer höchstens ein NPC gleichzeitig.
  const feldFrei = (x, y, trainer) => !Welt.blockiert(x + 0.5, y + 0.5) && !(trainer && Welt.istSicher(x + 0.5, y + 0.5, 1));
  function sucheWeg(sx, sy, tx, ty, trainer) {
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    const key = (x, y) => x * 4096 + y, h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const start = { x: sx, y: sy, g: 0, f: h(sx, sy), p: null }, offen = [start], zu = new Map([[key(sx, sy), start]]), lim = SUCHE + 16;
    let best = start, n = 0;
    while (offen.length && n++ < 3000) {
      let bi = 0; for (let i = 1; i < offen.length; i++) if (offen[i].f < offen[bi].f) bi = i;
      const c = offen.splice(bi, 1)[0];
      if (h(c.x, c.y) < h(best.x, best.y)) best = c;
      if (c.x === tx && c.y === ty) { best = c; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx, y = c.y + dy, k = key(x, y);
        if (Math.abs(x - sx) > lim || Math.abs(y - sy) > lim || !imBotGebiet(x, y)) continue;
        if (!(x === tx && y === ty) && !feldFrei(x, y, trainer)) continue;
        const g = c.g + 1, alt = zu.get(k);
        if (alt && alt.g <= g) continue;
        const nd = { x, y, g, f: g + h(x, y), p: c };
        zu.set(k, nd); offen.push(nd);
      }
    }
    const weg = []; for (let c = best; c && c.p; c = c.p) weg.unshift([c.x + 0.5, c.y + 0.5]);
    return weg;
  }
  // Richtung zum nächsten Wegpunkt (neu berechnet alle 0.7 s oder wenn sich das Ziel bewegt hat)
  function lenke(n, x, y, tx, ty, now, trainer) {
    if (!n.pfad || now - n.pfadT > 700 || Math.hypot(n.pfadZ[0] - tx, n.pfadZ[1] - ty) > 2) { n.pfad = sucheWeg(x, y, tx, ty, trainer); n.pfadT = now; n.pfadZ = [tx, ty]; }
    while (n.pfad.length && Math.hypot(n.pfad[0][0] - x, n.pfad[0][1] - y) < 0.3) n.pfad.shift();
    const wp = n.pfad.length ? n.pfad[0] : [tx, ty], dd = Math.hypot(wp[0] - x, wp[1] - y) || 1;
    return [(wp[0] - x) / dd, (wp[1] - y) / dd];
  }
  // Nur ein Jäger auf einmal, danach eine Pause
  // Weit draussen gibt es keine NPC-Spieler mehr: Bots bleiben im Umkreis BOT_R um den Start
  const imBotGebiet = (x, y) => Math.hypot(x - Welt.START.x, y - Welt.START.y) < Welt.BOT_R;
  const imKreis = (x, y) => { const dx = x - Welt.START.x, dy = y - Welt.START.y, d = Math.hypot(dx, dy), r = Welt.BOT_R - 10; return d <= r ? [x, y] : [Welt.START.x + dx / d * r, Welt.START.y + dy / d * r]; };
  const jagdFrei = now => now > (Bots.jagdPause || 0) && !(Bots.jaeger && Bots.jaeger.z === 'prov');
  function jagdStart(n, now) { Bots.jaeger = n; n.pfad = null; }
  function jagdEnde(now, pause) { Bots.jaeger = null; Bots.jagdPause = now + (pause || 25000) + Math.random() * 15000; }

  Bots.update = function (dt, now, frei) {
    if (S.modus !== 'welt') return;
    for (const b of Bots.liste) {
      const d = Math.hypot(b.x - S.x, b.y - S.y);
      if (d > 70 && b.z !== 'geht') continue;          // weit weg: stehen sie still (spart Rechenzeit)
      b.geht = false;
      if (b.halt) continue;                             // fordert gerade heraus oder verhandelt: bleibt stehen
      let vx = 0, vy = 0, tempo = 0;
      const ziel = frei && CAM.lebend() && !Welt.istSicher(S.x, S.y) && !Welt.dorfBei(b.x, b.y) && now > b.provBis && now > b.ruheBis;
      if (b.z === 'prov') {
        // läuft auf dich zu und fordert dich heraus
        if (!frei || !CAM.lebend() || Welt.istSicher(S.x, S.y) || d > SUCHE + 12) { b.z = 'ruhe'; b.t = 2; jagdEnde(now, 5000); }
        else if (now - b.alarm < 600) { /* kurz erschrecken */ }
        else if (d > 1.5) { [vx, vy] = lenke(b, b.x, b.y, S.x, S.y, now, false); tempo = 3.9; }
        else { b.z = 'ruhe'; b.t = 3; b.provBis = now + 60000 + Math.random() * 90000; jagdEnde(now); A.botProvokation(b); continue; }
      } else if (ziel && jagdFrei(now) && d < SUCHE && d > 3 && Math.random() < dt * 0.3 && b.lv >= CAM.maxLv() * 0.5 && b.lv <= CAM.maxLv() * 2 + 4) {
        b.z = 'prov'; b.alarm = now; jagdStart(b, now); UI.snd('ruf');
      } else {
        b.t -= dt;
        if (b.z === 'ruhe' && b.t <= 0) {
          const a = Math.random() * 6.283, r = 2 + Math.random() * 6;
          if (Math.random() < 0.12) {
            // Wanderer: zieht in eine neue Gegend (manchmal in die Nähe des Spielers oder eines Dorfs) und bleibt dort
            const dorf = Welt.dorf[Math.floor(Math.random() * Welt.dorf.length)];
            const nah = Math.random() < 0.4 && d < 90;
            const cx = nah ? S.x : dorf.x, cy = nah ? S.y : dorf.y, rr = 8 + Math.random() * 20;
            [b.hx, b.hy] = imKreis(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            b.tx = b.hx; b.ty = b.hy; b.z = 'geht'; b.t = 40;
          } else {
            [b.tx, b.ty] = imKreis(b.hx + (Math.random() - 0.5) * 2 * WEITE + Math.cos(a) * r * 0.3, b.hy + (Math.random() - 0.5) * 2 * WEITE + Math.sin(a) * r * 0.3);
            b.z = 'geht'; b.t = 5 + Math.random() * 6;
          }
        } else if (b.z === 'geht') {
          const dd = Math.hypot(b.tx - b.x, b.ty - b.y);
          if (dd < 0.3 || b.t <= 0) { b.z = 'ruhe'; b.t = 2 + Math.random() * 5; }
          else { vx = (b.tx - b.x) / dd; vy = (b.ty - b.y) / dd; tempo = b.t > 12 ? 2.6 : 1.7; }
        } else if (b.z !== 'ruhe') b.z = 'ruhe';
      }
      if (tempo) {
        const ok = schritt(b, vx * tempo * dt, vy * tempo * dt);
        b.geht = ok;
        if (!ok && b.z === 'geht') { b.z = 'ruhe'; b.t = 0.6; }
        if (b.z === 'prov') {
          // hängt er an einer Wand fest, probiert er seitlich vorbeizukommen und gibt nach 2.5 s auf
          if (!ok) { b.stuck = (b.stuck || 0) + dt; if (!schritt(b, -vy * tempo * dt, vx * tempo * dt)) schritt(b, vy * tempo * dt, -vx * tempo * dt); if (b.stuck > 2.5) { b.z = 'ruhe'; b.t = 2; b.stuck = 0; b.provBis = now + 20000; jagdEnde(now, 5000); } }
          else b.stuck = Math.max(0, (b.stuck || 0) - dt);
        }
        if (Math.abs(vx) > Math.abs(vy)) b.dir = vx > 0 ? 1 : 3; else b.dir = vy > 0 ? 2 : 0;
      }
    }
  };

  // ---------- Trainer (NPCs) laufen auch herum und gehen manche auf dich los ----------
  // tr.px/py = Position (Mitte des Feldes), tr.hx/hy = Heimatfeld. Trainer mit id % 5 < 2 sind angriffslustig: Sie sehen dich auf 11 Felder, laufen her und fordern dich heraus.
  // Ein Trainer sieht dich und rennt los, um dich zu überfallen (nur ein Jäger auf einmal)
  Bots.trainerJagd = function (tr, now) {
    if (tr.z === 'prov' || !jagdFrei(now) || now < (tr.provBis || 0)) return;
    tr.z = 'prov'; tr.pa = now; jagdStart(tr, now); UI.snd('ruf');
  };
  Bots.trainerUpdate = function (dt, now, frei) {
    if (S.modus !== 'welt') return;
    for (const tr of Welt.trainer) {
      if (tr.px === undefined) Object.assign(tr, { px: tr.x + 0.5, py: tr.y + 0.5, hx: tr.x + 0.5, hy: tr.y + 0.5, z: 'ruhe', t: Math.random() * 3, tx: 0, ty: 0, provBis: 0, geht: false });
      const d = Math.hypot(tr.px - S.x, tr.py - S.y);
      if (d > 60 || tr.halt) { tr.geht = false; continue; }   // halt: kämpft oder verhandelt gerade, bleibt stehen
      const aus = S.trainerT[tr.id] && now - S.trainerT[tr.id] < 10 * 60 * 1000;
      let vx = 0, vy = 0, tempo = 0;
      const wild = tr.id % 5 < 2;
      if (wild && !aus && frei && CAM.lebend() && !Welt.istSicher(S.x, S.y) && now > tr.provBis && d < 11 && tr.z !== 'prov' && jagdFrei(now)) { tr.z = 'prov'; tr.pa = now; jagdStart(tr, now); UI.snd('ruf'); }
      if (tr.z === 'prov') {
        if (aus || !frei || !CAM.lebend() || Welt.istSicher(S.x, S.y) || d > 16) { tr.z = 'ruhe'; tr.t = 2; jagdEnde(now, 5000); }
        else if (now - tr.pa < 600) { /* kurz erschrecken */ }
        else if (d > 1.4) { [vx, vy] = lenke(tr, tr.px, tr.py, S.x, S.y, now, true); tempo = 3.4; }
        else { tr.z = 'ruhe'; tr.t = 3; tr.provBis = now + 90000; jagdEnde(now); tr.halt = true; Promise.resolve(A.trainerKampf(tr, { erster: 1 })).finally(() => { tr.halt = false; }); continue; }
      } else {
        tr.t -= dt;
        if (tr.z === 'ruhe' && tr.t <= 0) {
          const heim = Math.hypot(tr.px - tr.hx, tr.py - tr.hy) > 5, a = Math.random() * 6.283, r = 1 + Math.random() * 3;
          tr.tx = heim ? tr.hx : tr.hx + Math.cos(a) * r * 1.6; tr.ty = heim ? tr.hy : tr.hy + Math.sin(a) * r * 1.6; tr.z = 'geht'; tr.t = 4 + Math.random() * 4;
        } else if (tr.z === 'geht') {
          const dd = Math.hypot(tr.tx - tr.px, tr.ty - tr.py);
          if (dd < 0.25 || tr.t <= 0) { tr.z = 'ruhe'; tr.t = 1.5 + Math.random() * 4; }
          else { vx = (tr.tx - tr.px) / dd; vy = (tr.ty - tr.py) / dd; tempo = 1.3; }
        } else if (tr.z !== 'ruhe') tr.z = 'ruhe';
      }
      tr.geht = false;
      if (tempo) {
        const ok = trSchritt(tr, vx * tempo * dt, vy * tempo * dt);
        tr.geht = ok;
        if (!ok && tr.z === 'geht') { tr.z = 'ruhe'; tr.t = 0.6; }
        if (tr.z === 'prov') {
          if (!ok) { tr.stuck = (tr.stuck || 0) + dt; if (!trSchritt(tr, -vy * tempo * dt, vx * tempo * dt)) trSchritt(tr, vy * tempo * dt, -vx * tempo * dt); if (tr.stuck > 2.5) { tr.z = 'ruhe'; tr.t = 2; tr.stuck = 0; tr.provBis = now + 20000; jagdEnde(now, 5000); } }
          else tr.stuck = Math.max(0, (tr.stuck || 0) - dt);
        }
        if (Math.abs(vx) > Math.abs(vy)) tr.dir = vx > 0 ? 1 : 3; else tr.dir = vy > 0 ? 2 : 0;
      }
    }
  };
  function trGehbar(x, y) { return gehbar(x, y) && !Welt.istSicher(x, y, 1); }
  function trSchritt(tr, dx, dy) {
    let ok = false;
    if (trGehbar(tr.px + dx, tr.py)) { tr.px += dx; ok = true; }
    if (trGehbar(tr.px, tr.py + dy)) { tr.py += dy; ok = true; }
    return ok;
  }

  // ---------- Entscheidung des Bots ----------
  // offer: { modus: 'fair'|'echt', gold, mobA (dein Mob), mobB (Mob des Bots) }; p = Siegchance des Bots in Prozent
  Bots.entscheide = function (b, offer, p) {
    const gain = offer.gold + (offer.mobA ? wert(offer.mobA) : 0), lose = offer.gold + (offer.mobB ? wert(offer.mobB) : 0);
    if (offer.gold > b.gold) return { ok: false, text: 'So viel Gold habe ich gar nicht.' };
    if (offer.mobB && b.team.length < 2) return { ok: false, text: 'Das ist mein letztes Fabelwesen, das setze ich nicht.' };
    // Kleiner Einsatz (höchstens 50 Gold, kein Mob): fast immer ja, solange er das Gold hat
    if (offer.gold > 0 && offer.gold <= 50 && !offer.mobA && !offer.mobB && Math.random() < 0.96) return { ok: true, text: p < 40 ? 'Für so wenig Gold? Klar, versuchen wir es.' : 'Gerne, die paar Münzen sind es mir wert.' };
    let score = (p / 100 - 0.5) * 2 + b.ego + (Math.random() - 0.5) * 0.3;
    if (gain + lose > 0) score += (gain - lose) / (gain + lose) * 0.5 - (lose > b.gold * 0.5 ? 0.25 : 0);
    if (offer.mobB && CAM.FAMILIEN[offer.mobB.fam].spezial) score -= 0.35;
    const schwelle = gain + lose > 0 ? 0.08 : -0.4;
    if (score > schwelle) {
      const text = p < 40 ? 'Ich bin überzeugt, dass ich das schaffe. Los!' : p > 62 ? 'Gerne, das sieht gut für mich aus.' : 'Okay, versuchen wir es.';
      return { ok: true, text };
    }
    return { ok: false, text: p < 40 ? 'Das ist mir zu riskant.' : lose > gain * 1.4 ? 'Dieser Einsatz steht für mich in keinem guten Verhältnis.' : 'Heute nicht, vielleicht später.' };
  };

  // ---------- Menüs ----------
  function staerkeText(team) { return 'Ø Stufe ' + Math.round(CAM.schnitt(team)) + ' · ' + team.length + ' Mobs'; }
  function relFarbe(lv) { const m = CAM.maxLv(); return lv > m + 3 ? '#ff8a7a' : lv < m - 3 ? '#8fe3a0' : '#ffe680'; }
  Bots.farbe = relFarbe;

  A.botMenue = async function (b) {
    if (S.busy) return;
    b.halt = true;
    try { await botMenue(b); } finally { b.halt = false; }
  };
  async function botMenue(b) {
    for (;;) {
      const grund = !CAM.lebend() ? 'Dein Team ist erschöpft' : Welt.istSicher(S.x, S.y) ? 'In einer sicheren Zone nicht erlaubt' : Welt.istSicher(b.x, b.y) ? b.name + ' steht in einer sicheren Zone' : b.team.length < 1 ? 'Kein Team' : '';
      const r = await UI.choose([{ label: 'Zum Duell herausfordern', sub: CAM.lebend() ? 'mit Einsatz' : 'Dein Team ist erschöpft', disabled: !CAM.lebend() || Date.now() < b.ruheBis }, { label: 'Team ansehen' },
        { label: 'Überfallen', sub: grund || 'Du schlägst zuerst zu · gewinnst du, klaust du ' + (b.gold < 150 ? '70 %' : '100 Gold'), disabled: !!grund }, { label: 'Zurück' }],
        { title: b.name + ' (Bot)', sub: 'Höchste Stufe ' + b.lv + ' · ' + staerkeText(b.team) + '\n' + b.gold + ' Gold' + (b.champ ? ' · Champion' : '') + (Date.now() < b.ruheBis ? '\nMöchte gerade nicht kämpfen.' : '') });
      if (r === 0) { await A.einsatzDuell(b); return; }
      if (r === 1) await botTeamAnsehen(b);
      else if (r === 2) {
        if (!await UI.confirm('Du überfällst ' + esc(b.name) + ' ohne Vorwarnung. Du schlägst zuerst zu, es gibt keinen Einsatz. Gewinnst du, klaust du ' + (b.gold < 150 ? '70 % seines Goldes' : '100 Gold') + '.<br><small>Stufe ' + b.lv + ' · ' + staerkeText(b.team) + '</small>', 'Überfall bestätigen', 'Überfallen', 'Abbrechen')) continue;
        b.ruheBis = 0; await UI.banner('ÜBERFALL!'); await A.botDuell(b, { modus: 'echt', gold: 0, mobA: null, mobB: null, klau: true }, 0, 0); return;
      } else return;
    }
  };
  async function botTeamAnsehen(b) {
    const items = b.team.map(m => ({ label: H.mobZeile(m) + H.tagRar(CAM.FAMILIEN[m.fam].rar) + (CAM.FAMILIEN[m.fam].spezial ? ' <span style="color:#ffb36b">★</span>' : ''), sub: H.elTags(m) }));
    items.push({ label: '← Zurück' });
    await UI.choose(items, { title: 'Team von ' + b.name, numbers: false });
  }

  // Handelsfenster: siehe handel.js
  A.einsatzDuell = b => A.botHandel(b);

  // Der Bot fordert dich heraus
  A.botProvokation = async function (b) {
    if (S.busy || UI.stack.length || K.aktiv || !CAM.lebend()) return;
    S.busy = true; b.halt = true;   // bleibt stehen, bis Herausforderung, Handel und Kampf vorbei sind
    try {
      UI.snd('ruf');
      const eigen = S.save.team, fair = Math.random() < 0.7, mid = CAM.lvlMitte(eigen, b.team), lvl = fair ? mid : 0;
      const p = CAM.siegChance(eigen, b.team, lvl);
      const gMax = Math.min(S.save.gold, b.gold);
      const gold = Math.random() < 0.4 || gMax < 20 ? 0 : Math.max(10, Math.round(gMax * [0.05, 0.1, 0.2][Math.floor(Math.random() * 3)] / 5) * 5);
      const offer = { modus: fair ? 'fair' : 'echt', gold, mobA: null, mobB: null };
      const r = await UI.choose([{ label: 'Annehmen', sub: 'Deine Chance ca. ' + p + ' %' }, { label: 'Gegenangebot', sub: 'Handelsfenster öffnen und selbst setzen' }, { label: 'Ablehnen', sub: 'kostet nichts' }],
        { title: b.name + ' fordert dich heraus!', before: '<p>«Lust auf einen Kampf?»<br><small>' + (fair ? 'Fairer Kampf: alle Mobs auf Stufe ' + mid : 'Echter Kampf mit den echten Stufen') + ' · ' + (gold ? 'Einsatz ' + gold + ' Gold' : 'kein Einsatz') + '<br>Er: ' + staerkeText(b.team) + ' (Höchste Stufe ' + b.lv + ')</small></p>', numbers: false, start: 2, nocancel: true });
      if (r === 1) {
        S.busy = false;
        await A.botHandel(b, { modus: offer.modus, goldMe: gold, goldThem: gold, mobMe: null, mobThem: null, vomBot: true }, '<b>' + esc(b.name) + ':</b> «Das ist mein Vorschlag. Setz selbst, was du willst.»');
        b.ruheBis = Date.now() + 90000; return;
      }
      if (r !== 0) { b.ruheBis = Date.now() + 240000; UI.toast(b.name + ' zieht enttäuscht ab.'); return; }
      S.busy = false;
      await A.botDuell(b, offer, lvl, 1);
    } finally { S.busy = false; b.halt = false; }
  };

  // Kampf Spieler gegen Bot und Auszahlung des Einsatzes
  A.botDuell = async function (b, offer, lvl, erster) {
    offer.goldMe = offer.goldMe !== undefined ? offer.goldMe : (offer.gold || 0); offer.goldThem = offer.goldThem !== undefined ? offer.goldThem : (offer.gold || 0);
    S.busy = true; CAM.Netz.senden({ t: 'p', ...A.praesenz() });
    const mein = CAM.duellKopien(S.save.team, lvl), seine = CAM.duellKopien(b.team, lvl);
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: mein };
    const gegner = { id: 'bot', name: b.name, side: 1, ctrl: 'ai', team: seine };
    const res = await K.starten({ kind: 'duel', actors: [lokal, gegner], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, weather: CAM.wetterBei(Welt.biomeAt(S.x, S.y), Date.now()), biome: Welt.biomeAt(S.x, S.y), erster,
      beutel: () => ({}), verbrauch() {}, intro: offer.klau ? S.name + ' überfällt ' + b.name + '!' : b.name + ' kämpft gegen ' + S.name + (offer.modus === 'fair' ? ' (fair, Stufe ' + lvl + ')' : '') + '!' });
    const bt = res.b, lines = [];
    const gewonnen = bt.over && bt.winner === 0;
    if (bt.over && (offer.goldMe || offer.goldThem || offer.mobA || offer.mobB)) {
      const was = [(gewonnen ? offer.goldThem : offer.goldMe) ? ge(gewonnen ? offer.goldThem : offer.goldMe) : '', gewonnen ? (offer.mobB ? esc(CAM.name(offer.mobB)) : '') : (offer.mobA ? esc(CAM.name(offer.mobA)) : '')].filter(Boolean).join(' und ');
      await UI.info((gewonnen ? '<b style="color:#5fd38a">Du hast gewonnen!</b><br>Dein Preis: ' : '<b style="color:#ff6b5e">' + esc(b.name) + ' hat gewonnen.</b><br>Dein Einsatz geht an ' + esc(b.name) + ': ') + was + '<br><small>Mit OK bestätigst du den Preis.</small>', gewonnen ? 'Preis bestätigen' : 'Einsatz bestätigen');
    }
    if (bt.over) {
      if (gewonnen) {
        UI.snd('sieg'); lines.push('<b style="color:#5fd38a">Du hast gegen ' + esc(b.name) + ' gewonnen!</b>');
        if (offer.goldThem) { S.save.gold += offer.goldThem; b.gold = Math.max(0, b.gold - offer.goldThem); lines.push('Du bekommst ' + ge(offer.goldThem) + '.'); }
        if (offer.klau) { const g = b.gold < 150 ? Math.floor(b.gold * 0.7) : 100; S.save.gold += g; b.gold = Math.max(0, b.gold - g); lines.push('Beute: Du klaust ' + ge(g) + '.'); }
        if (offer.mobB) {
          const i = b.team.indexOf(offer.mobB);
          if (i >= 0) { b.team.splice(i, 1); const m = offer.mobB; m.hp = m.mhp; m.status = null; m.wunden = []; const wo = A.mobDazu(m); S.save.dex[m.fam] = 2; lines.push('<b style="color:#c9a6ff">' + esc(CAM.name(m)) + ' (Lv ' + m.lv + ') gehört jetzt dir!</b>' + (wo === 'box' ? ' (im Zwinger)' : wo ? '' : ' (Zwinger voll, er ist weg)')); }
        }
        b.gold += 15 + b.lv;
      } else {
        UI.snd('niederlage'); lines.push('<b style="color:#ff6b5e">' + esc(b.name) + ' hat gewonnen.</b>');
        A.duellVerloren(); lines.push('<small>Deine Mobs haben nur noch die Hälfte der LP.</small>');
        if (offer.goldMe) { const g = Math.min(offer.goldMe, S.save.gold); S.save.gold -= g; b.gold += g; lines.push('Du zahlst ' + ge(g) + '.'); }
        if (offer.mobA) {
          let i = S.save.team.indexOf(offer.mobA);
          if (i >= 0) S.save.team.splice(i, 1); else { i = S.save.box.indexOf(offer.mobA); if (i >= 0) S.save.box.splice(i, 1); }
          b.team.push(offer.mobA); lines.push('<b style="color:#ff6b5e">' + esc(CAM.name(offer.mobA)) + ' geht an ' + esc(b.name) + '.</b>');
          if (!S.save.team.length && S.save.box.length) S.save.team.push(S.save.box.shift());
        }
      }
      b.ruheBis = Date.now() + 90000;
      auffuellen(b);
    }
    Save.speichern(); S.busy = false; CAM.Netz.senden({ t: 'p', ...A.praesenz() });
    if (lines.length) await UI.info(lines.join('<br>'), 'Duell vorbei');
  };
})(window);
