'use strict';
// Catch a Mob – Bot-Spieler: laufen in der Welt herum, haben ein Team, nehmen Duelle mit Einsatz an oder lehnen sie ab
// und fordern dich manchmal selbst heraus. Ihr Team (auch gewonnene und verlorene Mobs) bleibt im Spielstand erhalten.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc, S = CAM.S, Welt = CAM.Welt, K = CAM.Kampf, A = CAM.A, Save = CAM.Save;
  const H = A.h, ge = H.ge, sleep = H.sleep;
  const Bots = CAM.Bots = { liste: [] };
  const ANZAHL = 18, CHAMPIONS = 3, WEITE = 16, SUCHE = 32;

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
    n = n || 20; let w = 0;
    for (let i = 0; i < n; i++) {
      const b = new CAM.Battle({ kind: 'duel', seed: 1000 + i * 7919, actors: [
        { id: 'a', name: 'a', side: 0, ctrl: 'ai', team: CAM.duellKopien(teamA, lvl) }, { id: 'b', name: 'b', side: 1, ctrl: 'ai', team: CAM.duellKopien(teamB, lvl) }] });
      let g = 0; while (!b.over && g++ < 70) b.resolve();
      if (b.winner === 0) w++; else if (b.winner == null) w += 0.5;
    }
    return Math.round(w / n * 100);
  };
  const wert = m => CAM.preis(m) * (CAM.FAMILIEN[m.fam].spezial ? 4 : 1);
  CAM.mobWert = wert;

  // ---------- Erzeugen ----------
  function gehbar(x, y) { return !(Welt.blockiert(x - 0.3, y - 0.2) || Welt.blockiert(x + 0.3, y - 0.2) || Welt.blockiert(x - 0.3, y + 0.25) || Welt.blockiert(x + 0.3, y + 0.25)); }
  function teamFuer(rnd, hx, hy, champ) {
    const bi = Welt.biomeAt(hx, hy), B = CAM.BIOME[bi], lv = Welt.wildLevel(hx, hy, rnd());
    const n = 2 + (lv > 12 ? 1 : 0) + (lv > 25 ? 1 : 0), team = [];
    if (champ) team.push(CAM.neuerMob(27, Math.min(50, lv + 4)));
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
      const a = rnd() * 6.283, d = champ ? 170 + rnd() * 260 : 14 + Math.pow(rnd(), 1.3) * 430;
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
      Bots.liste = gespeichert.map(b => laufzeit({ id: b.id, name: b.name, col: b.col, champ: b.champ, hx: b.hx, hy: b.hy, x: b.hx, y: b.hy, team: b.team, gold: b.gold, ego: b.ego, mut: b.mut }));
      return;
    }
    const rnd = CAM.mulberry32(Welt.seed * 31 + 7);
    for (let i = 0; i < ANZAHL; i++) Bots.liste.push(laufzeit(neu(i, rnd, i < CHAMPIONS)));
  };
  Bots.speichern = () => Bots.liste.map(b => ({ id: b.id, name: b.name, col: b.col, champ: b.champ, hx: b.hx, hy: b.hy, team: b.team, gold: b.gold, ego: b.ego, mut: b.mut }));
  Bots.naechster = function (x, y, rad) { let best = null, bd = rad; for (const b of Bots.liste) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } } return best; };
  const auffuellen = b => { while (b.team.length < 2) b.team.push(CAM.neuerMob(CAM.FAMILIEN[b.team[0] ? b.team[0].fam : 0].id, Math.max(5, b.lv - 2))); b.team.forEach(m => { m.hp = m.mhp; m.status = null; m.wunden = []; }); b.lv = Math.max.apply(null, b.team.map(m => m.lv)); };

  // ---------- Bewegung ----------
  function schritt(b, dx, dy) {
    let ok = false;
    if (gehbar(b.x + dx, b.y)) { b.x += dx; ok = true; }
    if (gehbar(b.x, b.y + dy)) { b.y += dy; ok = true; }
    return ok;
  }
  Bots.update = function (dt, now, frei) {
    if (S.modus !== 'welt' || S.online) return;
    for (const b of Bots.liste) {
      const d = Math.hypot(b.x - S.x, b.y - S.y);
      if (d > 70 && b.z !== 'geht') continue;          // weit weg: stehen sie still (spart Rechenzeit)
      b.geht = false;
      let vx = 0, vy = 0, tempo = 0;
      const ziel = frei && CAM.lebend() && !Welt.istSicher(S.x, S.y) && !Welt.dorfBei(b.x, b.y) && now > b.provBis && now > b.ruheBis;
      if (b.z === 'prov') {
        // läuft auf dich zu und fordert dich heraus
        if (!frei || !CAM.lebend() || Welt.istSicher(S.x, S.y) || d > SUCHE + 12) { b.z = 'ruhe'; b.t = 2; }
        else if (now - b.alarm < 600) { /* kurz erschrecken */ }
        else if (d > 1.5) { vx = (S.x - b.x) / d; vy = (S.y - b.y) / d; tempo = 3.9; }
        else { b.z = 'ruhe'; b.t = 3; b.provBis = now + 60000 + Math.random() * 90000; A.botProvokation(b); continue; }
      } else if (ziel && d < SUCHE && d > 3 && Math.random() < dt * 0.12 && b.lv >= CAM.maxLv() * 0.5 && b.lv <= CAM.maxLv() * 2 + 4) {
        b.z = 'prov'; b.alarm = now; UI.snd('ruf');
      } else {
        b.t -= dt;
        if (b.z === 'ruhe' && b.t <= 0) {
          const a = Math.random() * 6.283, r = 2 + Math.random() * 6;
          if (Math.random() < 0.12) {
            // Wanderer: zieht in eine neue Gegend (manchmal in die Nähe des Spielers oder eines Dorfs) und bleibt dort
            const dorf = Welt.dorf[Math.floor(Math.random() * Welt.dorf.length)];
            const nah = Math.random() < 0.4 && d < 90;
            const cx = nah ? S.x : dorf.x, cy = nah ? S.y : dorf.y, rr = 8 + Math.random() * 20;
            b.hx = Math.max(12, Math.min(Welt.W - 12, cx + Math.cos(a) * rr)); b.hy = Math.max(12, Math.min(Welt.H - 12, cy + Math.sin(a) * rr));
            b.tx = b.hx; b.ty = b.hy; b.z = 'geht'; b.t = 40;
          } else {
            b.tx = Math.max(2, Math.min(Welt.W - 2, b.hx + (Math.random() - 0.5) * 2 * WEITE + Math.cos(a) * r * 0.3)); b.ty = Math.max(2, Math.min(Welt.H - 2, b.hy + (Math.random() - 0.5) * 2 * WEITE + Math.sin(a) * r * 0.3));
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
        if (Math.abs(vx) > Math.abs(vy)) b.dir = vx > 0 ? 1 : 3; else b.dir = vy > 0 ? 2 : 0;
      }
    }
  };

  // ---------- Entscheidung des Bots ----------
  // offer: { modus: 'fair'|'echt', gold, mobA (dein Mob), mobB (Mob des Bots) }; p = Siegchance des Bots in Prozent
  Bots.entscheide = function (b, offer, p) {
    const gain = offer.gold + (offer.mobA ? wert(offer.mobA) : 0), lose = offer.gold + (offer.mobB ? wert(offer.mobB) : 0);
    if (offer.gold > b.gold) return { ok: false, text: 'So viel Gold habe ich gar nicht.' };
    if (offer.mobB && b.team.length < 2) return { ok: false, text: 'Das ist mein letztes Fabelwesen, das setze ich nicht.' };
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
    for (;;) {
      const r = await UI.choose([{ label: 'Zum Duell herausfordern', sub: CAM.lebend() ? 'mit Einsatz' : 'Dein Team ist erschöpft', disabled: !CAM.lebend() || Date.now() < b.ruheBis }, { label: 'Team ansehen' }, { label: 'Zurück' }],
        { title: b.name + ' (Bot)', sub: 'Höchste Stufe ' + b.lv + ' · ' + staerkeText(b.team) + '\n' + b.gold + ' Gold' + (b.champ ? ' · Champion' : '') + (Date.now() < b.ruheBis ? '\nMöchte gerade nicht kämpfen.' : '') });
      if (r === 0) { await A.einsatzDuell(b); return; }
      if (r === 1) await botTeamAnsehen(b); else return;
    }
  };
  async function botTeamAnsehen(b) {
    const items = b.team.map(m => ({ label: H.mobZeile(m) + H.tagRar(CAM.FAMILIEN[m.fam].rar) + (CAM.FAMILIEN[m.fam].spezial ? ' <span style="color:#ffb36b">★</span>' : ''), sub: H.elTags(m) }));
    items.push({ label: '← Zurück' });
    await UI.choose(items, { title: 'Team von ' + b.name, numbers: false });
  }

  // Wählt Modus und Einsatz, fragt den Bot und startet das Duell
  A.einsatzDuell = async function (b) {
    const eigen = S.save.team, mid = CAM.lvlMitte(eigen, b.team);
    const pFair = 100 - CAM.siegChance(b.team, eigen, mid), pEcht = 100 - CAM.siegChance(b.team, eigen, 0);
    const mo = await UI.choose([
      { label: 'Fairer Kampf', sub: 'alle auf Stufe ' + mid + ' · deine Chance ca. ' + pFair + ' %' },
      { label: 'Echter Kampf', sub: 'Ø ' + Math.round(CAM.schnitt(eigen)) + ' gegen Ø ' + Math.round(CAM.schnitt(b.team)) + ' · deine Chance ca. ' + pEcht + ' %' },
      { label: '← Zurück' }], { title: 'Wie wollt ihr kämpfen?', sub: 'Im fairen Kampf werden beide Teams auf die Stufe in der Mitte gesetzt, damit nur Wahl und Taktik zählen.' });
    if (mo < 0 || mo === 2) return;
    const offer = { modus: mo === 0 ? 'fair' : 'echt', gold: 0, mobA: null, mobB: null };
    const lvl = mo === 0 ? mid : 0;
    const maxG = Math.min(S.save.gold, b.gold);
    const stufen = [25, 50, 100, 250, 500, 1000];
    const ei = [{ label: 'Kein Einsatz', sub: 'nur für die Ehre' }].concat(stufen.map(g => ({ label: g + ' Gold', sub: g > maxG ? (g > S.save.gold ? 'du hast zu wenig' : b.name + ' hat zu wenig') : '', disabled: g > maxG })));
    ei.push({ label: 'Fabelwesen setzen', sub: 'Wer verliert, gibt seinen Mob ab' }); ei.push({ label: '← Zurück' });
    const e = await UI.choose(ei, { title: 'Einsatz', sub: 'Du hast ' + S.save.gold + ' Gold, ' + b.name + ' hat ' + b.gold + ' Gold.', numbers: false });
    if (e < 0 || e === ei.length - 1) return;
    if (e >= 1 && e <= stufen.length) offer.gold = stufen[e - 1];
    if (e === ei.length - 2) {
      const alle = S.save.team.map(m => ({ m, ort: 'Team' })).concat(S.save.box.map(m => ({ m, ort: 'Zwinger' })));
      const frei = o => !(o.ort === 'Team' && S.save.team.filter(x => x !== o.m && x.hp > 0).length === 0);
      const a = await UI.choose(alle.map(o => ({ label: H.mobZeile(o.m) + H.tagRar(CAM.FAMILIEN[o.m.fam].rar), sub: o.ort + ' · Wert ' + wert(o.m) + ' G', disabled: !frei(o) })), { title: 'Welches Fabelwesen setzt du?', sub: 'Verlierst du, gehört es dem Gegner.', numbers: false, wide: true });
      if (a < 0) return;
      offer.mobA = alle[a].m;
      const bb = await UI.choose(b.team.map(m => ({ label: H.mobZeile(m) + H.tagRar(CAM.FAMILIEN[m.fam].rar) + (CAM.FAMILIEN[m.fam].spezial ? ' <span style="color:#ffb36b">★</span>' : ''), sub: 'Wert ' + wert(m) + ' G', disabled: b.team.length < 2 })), { title: 'Welches Fabelwesen verlangst du von ' + b.name + '?', sub: 'Gewinnst du, bekommst du es.', numbers: false, wide: true });
      if (bb < 0) return;
      offer.mobB = b.team[bb];
    }
    const pBot = 100 - (offer.modus === 'fair' ? pFair : pEcht);
    const antw = Bots.entscheide(b, offer, pBot);
    const zus = (offer.gold ? offer.gold + ' Gold' : '') + (offer.mobA ? (offer.gold ? ' und ' : '') + CAM.name(offer.mobA) + ' gegen ' + CAM.name(offer.mobB) : '') || 'kein Einsatz';
    await UI.info('<b>' + esc(b.name) + ':</b> «' + esc(antw.text) + '»<br><small>Einsatz: ' + esc(zus) + ' · ' + (offer.modus === 'fair' ? 'Fairer Kampf auf Stufe ' + mid : 'Echter Kampf') + '</small>', antw.ok ? 'Angenommen' : 'Abgelehnt');
    if (!antw.ok) { if (Math.random() < 0.3) b.ruheBis = Date.now() + 60000; return; }
    await A.botDuell(b, offer, lvl);
  };

  // Der Bot fordert dich heraus
  A.botProvokation = async function (b) {
    if (S.busy || UI.stack.length || K.aktiv || !CAM.lebend()) return;
    S.busy = true;
    try {
      UI.snd('ruf');
      const eigen = S.save.team, fair = Math.random() < 0.7, mid = CAM.lvlMitte(eigen, b.team), lvl = fair ? mid : 0;
      const p = 100 - CAM.siegChance(b.team, eigen, lvl);
      const gMax = Math.min(S.save.gold, b.gold);
      const gold = Math.random() < 0.4 || gMax < 20 ? 0 : Math.max(10, Math.round(gMax * [0.05, 0.1, 0.2][Math.floor(Math.random() * 3)] / 5) * 5);
      const offer = { modus: fair ? 'fair' : 'echt', gold, mobA: null, mobB: null };
      const r = await UI.choose([{ label: 'Annehmen', sub: 'Deine Chance ca. ' + p + ' %' }, { label: 'Ablehnen', sub: 'kostet nichts' }],
        { title: b.name + ' fordert dich heraus!', before: '<p>«Lust auf einen Kampf?»<br><small>' + (fair ? 'Fairer Kampf: alle Mobs auf Stufe ' + mid : 'Echter Kampf mit den echten Stufen') + ' · ' + (gold ? 'Einsatz ' + gold + ' Gold' : 'kein Einsatz') + '<br>Er: ' + staerkeText(b.team) + ' (Höchste Stufe ' + b.lv + ')</small></p>', numbers: false, start: 1, nocancel: true });
      if (r !== 0) { b.ruheBis = Date.now() + 240000; UI.toast(b.name + ' zieht enttäuscht ab.'); return; }
      S.busy = false;
      await A.botDuell(b, offer, lvl);
    } finally { S.busy = false; }
  };

  // Kampf Spieler gegen Bot und Auszahlung des Einsatzes
  A.botDuell = async function (b, offer, lvl) {
    S.busy = true; CAM.Netz.senden({ t: 'p', ...A.praesenz() });
    const mein = CAM.duellKopien(S.save.team, lvl), seine = CAM.duellKopien(b.team, lvl);
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: mein };
    const gegner = { id: 'bot', name: b.name, side: 1, ctrl: 'ai', team: seine };
    const res = await K.starten({ kind: 'duel', actors: [lokal, gegner], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, weather: CAM.wetterBei(Welt.biomeAt(S.x, S.y), Date.now()), biome: Welt.biomeAt(S.x, S.y),
      beutel: () => ({}), verbrauch() {}, intro: b.name + ' kämpft gegen ' + S.name + (offer.modus === 'fair' ? ' (fair, Stufe ' + lvl + ')' : '') + '!' });
    const bt = res.b, lines = [];
    const gewonnen = bt.over && bt.winner === 0;
    if (bt.over) {
      if (gewonnen) {
        UI.snd('sieg'); lines.push('<b style="color:#5fd38a">Du hast gegen ' + esc(b.name) + ' gewonnen!</b>');
        if (offer.gold) { S.save.gold += offer.gold; b.gold = Math.max(0, b.gold - offer.gold); lines.push('Du bekommst ' + ge(offer.gold) + '.'); }
        if (offer.mobB) {
          const i = b.team.indexOf(offer.mobB);
          if (i >= 0) { b.team.splice(i, 1); const m = offer.mobB; m.hp = m.mhp; m.status = null; m.wunden = []; const wo = A.mobDazu(m); S.save.dex[m.fam] = 2; lines.push('<b style="color:#c9a6ff">' + esc(CAM.name(m)) + ' (Lv ' + m.lv + ') gehört jetzt dir!</b>' + (wo === 'box' ? ' (im Zwinger)' : wo ? '' : ' (Zwinger voll, er ist weg)')); }
        }
        b.gold += 15 + b.lv;
      } else {
        UI.snd('niederlage'); lines.push('<b style="color:#ff6b5e">' + esc(b.name) + ' hat gewonnen.</b>');
        if (offer.gold) { const g = Math.min(offer.gold, S.save.gold); S.save.gold -= g; b.gold += g; lines.push('Du zahlst ' + ge(g) + '.'); }
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
