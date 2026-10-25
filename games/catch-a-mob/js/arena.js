'use strict';
// Catch a Mob – Arenen mit Abzeichen, Veredler zum Verbessern der Mobs, Rangliste und Wegweiser.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, esc = UI.esc, S = CAM.S, Welt = CAM.Welt, A = CAM.A, K = CAM.Kampf, Netz = CAM.Netz, Save = CAM.Save, H = A.h, ge = H.ge;
  const abz = () => S.save.abz || (S.save.abz = []);
  const RICHT = [['Osten', '→'], ['Südosten', '↘'], ['Süden', '↓'], ['Südwesten', '↙'], ['Westen', '←'], ['Nordwesten', '↖'], ['Norden', '↑'], ['Nordosten', '↗']];
  const richtung = (dx, dy) => RICHT[Math.round(((Math.atan2(dy, dx) + 6.2832) % 6.2832) / 0.7854) % 8];

  // ---------- Wegweiser ----------
  A.wegweiser = async function () {
    const l = Welt.dorf.slice().sort((a, b) => Math.hypot(a.x - S.x, a.y - S.y) - Math.hypot(b.x - S.x, b.y - S.y)).slice(0, 2);
    const zeilen = l.map((d, i) => { const dx = d.x - S.x, dy = d.y - S.y, r = richtung(dx, dy); return '<p>' + (i ? 'Danach: ' : '<b>Nächstes Dorf:</b> ') + '<b>' + esc(d.name) + '</b><br>' + Math.round(Math.hypot(dx, dy)) + ' Felder nach ' + r[0] + ' <span style="font-size:22px">' + r[1] + '</span></p>'; });
    await UI.info(zeilen.join(''), 'Wegweiser');
  };

  // ---------- Rangliste ----------
  const botMaske = b => CAM.ARENEN.reduce((m, d, i) => m | (d.lv <= b.lv - 1 ? (1 << i) : 0), 0);
  const zaehle = m => { let n = 0; for (let i = 0; i < 8; i++) if (m & (1 << i)) n++; return n; };
  A.rangliste = async function () {
    const eintraege = [{ name: S.name, maske: CAM.abzMaske(abz()), ich: true }];
    for (const p of S.peers.values()) eintraege.push({ name: p.name, maske: p.ab | 0 });
    for (const b of CAM.Bots.liste) eintraege.push({ name: b.name, maske: botMaske(b), bot: true });
    eintraege.forEach(e => e.n = zaehle(e.maske));
    eintraege.sort((a, b) => b.n - a.n || (b.ich ? 1 : 0) - (a.ich ? 1 : 0) || a.name.localeCompare(b.name));
    const zeige = eintraege.slice(0, 14), ich = eintraege.findIndex(e => e.ich);
    if (ich >= 14) zeige.push(eintraege[ich]);
    const kopf = '<tr><th>#</th><th>Name</th><th>' + CAM.ARENEN.map(d => d.sym).join(' ') + '</th><th>Anz.</th></tr>';
    const zeilen = zeige.map(e => '<tr' + (e.ich ? ' style="background:rgba(138,63,252,.3)"' : '') + '><td>' + (eintraege.indexOf(e) + 1) + '</td><td>' + esc(e.name) + (e.bot ? ' <small style="color:#a9a59b">Bot</small>' : '') + '</td><td style="white-space:nowrap">' +
      CAM.ARENEN.map((d, i) => '<span title="' + esc(d.abz) + '" style="opacity:' + ((e.maske & (1 << i)) ? 1 : 0.18) + '">' + d.sym + '</span>').join(' ') + '</td><td><b>' + e.n + '</b></td></tr>').join('');
    await UI.info('<table>' + kopf + zeilen + '</table>', 'Rangliste der Abzeichen');
  };

  // ---------- Arena ----------
  function arenaTeam(a) {
    const def = CAM.ARENEN[a.idx], rnd = CAM.mulberry32(a.seed);
    let pool = CAM.FAMILIEN.filter(f => !f.legend && !f.spezial && (f.el === def.el || f.el2 === def.el));
    if (pool.length < 3) pool = CAM.FAMILIEN.filter(f => !f.legend && !f.spezial && f.rar < 2);
    const wahl = [];
    while (wahl.length < 3) { const f = pool[Math.floor(rnd() * pool.length)]; if (!wahl.includes(f) || pool.length < 3) wahl.push(f); }
    return wahl.map((f, i) => CAM.neuerMob(f.id, a.lv + (i === 2 ? 2 : 0)));
  }
  A.arena = async function (z) {
    const a = Welt.arena.find(x => x.x === z.x && x.y === z.y); if (!a) return;
    const def = CAM.ARENEN[a.idx];
    for (;;) {
      const hat = abz().includes(a.idx);
      const r = await UI.choose([{ label: 'Herausfordern', sub: 'Stufe ' + a.lv + ' bis ' + (a.lv + 2) + ' · 3 Mobs', disabled: !CAM.lebend() }, { label: 'Abzeichen ansehen' }, { label: 'Zurück' }],
        { title: 'Arena · ' + def.el, sub: hat ? def.sym + ' ' + def.abz + ' hast du schon' : 'Besiege Arenaleitung ' + a.leitung + ' für das ' + def.abz + ' ' + def.sym });
      if (r === 0) { await A.arenaKampf(a); return; }
      if (r === 1) await A.abzeichen(); else return;
    }
  };
  A.abzeichen = async function () {
    const zeilen = CAM.ARENEN.map((d, i) => '<tr style="opacity:' + (abz().includes(i) ? 1 : 0.4) + '"><td style="font-size:20px">' + d.sym + '</td><td>' + esc(d.abz) + '</td><td>' + d.el + ' · Stufe ' + d.lv + '</td><td>' + (abz().includes(i) ? '✔' : '–') + '</td></tr>').join('');
    await UI.info('<table>' + zeilen + '</table>', 'Deine Abzeichen (' + abz().length + ' von 8)');
  };
  A.arenaKampf = async function (a) {
    const I = A.intern, def = CAM.ARENEN[a.idx];
    if (S.busy || !CAM.lebend()) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    I.vorbereiten(S.save.team);
    const team = arenaTeam(a); team.forEach(m => I.dexSet(m.fam, 1));
    const name = 'Arenaleitung ' + a.leitung;
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: S.save.team, fang: CAM.fangStufe(S.save.team, S.save.fangXp) };
    const gegner = { id: 't', name, side: 1, ctrl: 'ai', team };
    const res = await K.starten(I.kampfBasis('trainer', { actors: [lokal, gegner], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, intro: name + ' tritt an!' }));
    const b = res.b; I.nachbereiten(S.save.team);
    const lines = [];
    if (b.winner === 0) {
      UI.snd('sieg');
      lines.push('<b style="color:#ffd54a">' + esc(name) + ' ist besiegt!</b>');
      lines.push(...await I.xpVerteilen(b, b.actor(lokal.id)));
      if (!abz().includes(a.idx)) {
        abz().push(a.idx);
        const gold = 100 + a.lv * 20; S.save.gold += gold;
        lines.push('<b style="color:#c9a6ff">' + def.sym + ' ' + esc(def.abz) + '!</b> Du bekommst ' + ge(gold) + ' und:');
        for (let i = 0; i < 3; i++) { const k = CAM.UPG[Math.floor(Math.random() * CAM.UPG.length)]; CAM.itemAdd(k, 1); lines.push('· ' + esc(CAM.ITEMS[k].n) + ' <small>(' + esc(CAM.ITEMS[k].info) + ')</small>'); }
        if (Math.random() < 0.04) { CAM.itemAdd('rune', 1); lines.push('· <b style="color:#ffb36b">Attackenrune</b> <small>(sehr selten: ein Mob lernt eine zusätzliche Attacke)</small>'); }
        lines.push('<small>Verbessern: Menü, Team, Mob, «Verbessern».</small>');
      } else { const gold = 20 + a.lv * 5; S.save.gold += gold; lines.push('Du bekommst ' + ge(gold) + '.'); }
    }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.winner === 1) { await I.verloren('Die Arenaleitung war zu stark.', 'mild'); return; }
    if (lines.length) await UI.info(lines.join('<br>'), 'Arena geschafft!');
  };

  // ---------- Verbessern mit Veredlern ----------
  const MAX_BONUS = { hp: 30, atk: 12, def: 12, spd: 12 }, FX_START = 15, FX_MAX = 40;
  A.veredeln = async function (m0) {
    for (;;) {
      const keys = CAM.UPG.filter(k => (S.save.items[k] || 0) > 0);
      if (!keys.length) { await UI.info('Du hast keine Veredler. Die gibt es von Arenen und Riesen.', 'Verbessern'); return; }
      const r = await UI.choose(keys.map(k => ({ label: esc(CAM.ITEMS[k].n) + ' × ' + S.save.items[k], sub: CAM.ITEMS[k].info })), { title: 'Verbessern', sub: m0 ? CAM.name(m0) + ' Lv ' + m0.lv : 'Welchen Veredler?', numbers: false });
      if (r < 0) return;
      const k = keys[r], it = CAM.ITEMS[k];
      let m = m0;
      if (!m) {
        const alle = S.save.team.concat(S.save.box);
        const i = await UI.choose(alle.map(x => ({ label: H.mobZeile(x), sub: bonusText(x) })), { title: esc(it.n) + ' bei wem?', numbers: false, wide: true });
        if (i < 0) continue; m = alle[i];
      }
      if (await anwenden(m, k, it)) { CAM.itemAdd(k, -1); UI.snd('stufe'); Save.speichern(); if (!m0) continue; }
    }
  };
  async function anwenden(m, k, it) {
    if (it.upg === 'fx') {
      const moves = m.moves.filter(id => CAM.MOVES[id].pow > 0);
      const i = await UI.choose(moves.map(id => { const mv = CAM.moveFuer(m, id); return { label: esc(mv.n), sub: mv.st ? CAM.fxText(mv) : 'noch kein Effekt' }; }), { title: it.n + ': welche Attacke?', numbers: false });
      if (i < 0) return false;
      const id = moves[i], cur = CAM.moveFuer(m, id);
      m.fx = m.fx || {};
      if (cur.st === it.st) { if (cur.p >= FX_MAX) { await UI.info('Dieser Effekt ist schon am Maximum (' + FX_MAX + ' %).', 'Verbessern'); return false; } m.fx[id] = { st: it.st, p: Math.min(FX_MAX, cur.p + 5) }; }
      else m.fx[id] = { st: it.st, p: FX_START };
      await UI.info(esc(CAM.name(m)) + ': ' + esc(CAM.MOVES[id].n) + ' hat jetzt ' + CAM.fxText(CAM.moveFuer(m, id)) + '.', 'Verbessert');
      return true;
    }
    m.bon = m.bon || {};
    m.bonV = 2;
    const max = MAX_BONUS[it.upg], cur = m.bon[it.upg] || 0;
    if (cur >= max) { await UI.info('Dieser Wert ist schon am Maximum (+' + max + ').', 'Verbessert'); return false; }
    const plus = Math.min(max - cur, it.zufall[0] + Math.floor(Math.random() * (it.zufall[1] - it.zufall[0] + 1)));
    const alt = m.mhp; m.bon[it.upg] = cur + plus; CAM.neuBerechnen(m);
    if (it.upg === 'hp' && m.hp > 0) m.hp += m.mhp - alt;
    await UI.info(esc(CAM.name(m)) + ': +' + plus + ' ' + NAMEN[it.upg] + ' (insgesamt +' + m.bon[it.upg] + ').', 'Verbessert');
    return true;
  }
  // Attackenrune: bringt einem Mob mit weniger als 6 möglichen Attacken eine zusätzliche Technik seines Elements bei
  A.rune = async function () {
    const alle = S.save.team.concat(S.save.box).filter(m => CAM.runeMoeglich(m));
    if (!alle.length) { await UI.info('Kein Mob kann damit noch eine Attacke lernen. Mobs mit schon 6 möglichen Attacken oder mit einer Rune gehen nicht.', 'Attackenrune'); return; }
    const i = await UI.choose(alle.map(x => ({ label: H.mobZeile(x), sub: x.moves.length + ' Attacken' })), { title: 'Attackenrune: bei wem?', numbers: false, wide: true });
    if (i < 0) return;
    const m = alle[i], ids = CAM.runeAuswahl(m);
    const j = await UI.choose(ids.map(id => { const mv = CAM.MOVES[id]; return { label: esc(mv.n) + ' <small>' + esc(mv.el) + '</small>', sub: CAM.moveText(mv) }; }), { title: 'Welche Attacke?', sub: esc(CAM.name(m)) + ' lernt sie für immer.', numbers: false, wide: true });
    if (j < 0) return;
    m.extra = ids[j]; m.wahl = null; CAM.neuBerechnen(m); CAM.itemAdd('rune', -1); UI.snd('stufe'); Save.speichern();
    await UI.info(esc(CAM.name(m)) + ' kann jetzt ' + esc(CAM.MOVES[ids[j]].n) + '!', 'Attackenrune');
  };
  const NAMEN = { hp: 'LP', atk: 'Angriff', def: 'Verteidigung', spd: 'Tempo' };
  function bonusText(m) { const t = Object.keys(m.bon || {}).filter(k => m.bon[k]).map(k => '+' + m.bon[k] + ' ' + NAMEN[k]); return t.length ? t.join(' · ') : 'noch nichts verbessert'; }
  A.bonusText = m => { const t = bonusText(m), fx = Object.keys(m.fx || {}).filter(id => CAM.MOVES[id]).map(id => CAM.MOVES[id].n + ': ' + CAM.fxText(CAM.moveFuer(m, id))); return (t.indexOf('noch nichts') < 0 ? t : '') + (fx.length ? (t.indexOf('noch nichts') < 0 ? ' · ' : '') + fx.join(' · ') : ''); };
})(window);
