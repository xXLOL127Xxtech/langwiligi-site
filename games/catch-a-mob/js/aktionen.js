'use strict';
// Catch a Mob – Dörfer, Menüs, Kämpfe und der Online-Teil (Duell, Überfall, Party, Raid).
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc, S = CAM.S, Welt = CAM.Welt, Netz = CAM.Netz, K = CAM.Kampf, Save = CAM.Save;
  const A = CAM.A = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const NACHT_STUFE = 10;                 // unter dieser Stufe kann man nicht überfallen werden
  const SCHUTZ_MS = 30 * 60 * 1000;       // Schutz nach einem Überfall
  const BOSS_PAUSE_MS = 8 * 60 * 1000;
  const TRAINER_PAUSE_MS = 10 * 60 * 1000;

  const ge = (n) => '<span class="gold">' + n + ' G</span>';
  const tagEl = el => '<span class="tag" style="background:' + CAM.EL_FARBE[el] + '">' + el + '</span>';
  const tagRar = r => '<span class="tag" style="background:' + CAM.RAR_FARBE[r] + '">' + CAM.RARITAET[r] + '</span>';
  function elTags(m) { return CAM.elemente(m).map(tagEl).join(''); }
  function mobNameFull(m) { return CAM.name(m) + (m.glanz ? ' ✦' : ''); }
  function mobZeile(m) { return esc(mobNameFull(m)) + ' <small style="color:#a9a59b">Lv ' + m.lv + '</small>'; }
  function lpText(m) { return m.hp <= 0 ? '<span style="color:#ff6b5e">besiegt</span>' : m.hp + '/' + m.mhp + ' LP'; }
  function spriteImg(m, px) { const c = CAM.spriteMit(m); return '<img src="' + c.toDataURL() + '" width="' + px + '" height="' + px + '" style="image-rendering:pixelated">'; }
  A.mobNameFull = mobNameFull;
  A.h = { ge, tagEl, tagRar, elTags, mobZeile, lpText, spriteImg, sleep };

  A.eingabe = function (titel, sub, start, ph) {
    return new Promise(res => {
      const host = UI.openPanel(titel, sub);
      host.innerHTML = '<input type="text" id="eing" maxlength="40" placeholder="' + esc(ph || '') + '" value="' + esc(start || '') + '"><div class="row"><button class="btn" id="eing-ok">OK</button><button class="btn alt" id="eing-no">Abbrechen</button></div>';
      const inp = $('eing'); inp.focus(); inp.select();
      const fin = v => { UI.closePanel(); res(v); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') fin(inp.value.trim()); else if (e.key === 'Escape') fin(null); e.stopPropagation(); });
      $('eing-ok').onclick = () => fin(inp.value.trim());
      $('eing-no').onclick = () => fin(null);
    });
  };

  // ---------- Hilfen ----------
  A.waehleMob = async function (titel, filter, nurTeam) {
    const t = S.save.team;
    const items = t.map(m => ({ label: mobZeile(m) + elTags(m), sub: lpText(m), disabled: filter && !filter(m) }));
    const r = await UI.choose(items, { title: titel, numbers: true, wide: false });
    return r;
  };
  function verlierGold() { const v = Math.floor(S.save.gold * 0.8); S.save.gold -= v; return v; }
  // Niederlage: 10 % der Erfahrung, die für die aktuelle Stufe nötig ist, gehen bei jedem Mob im Team verloren (nie unter 0, keine Stufe weniger)
  function verlierXp() { S.save.team.forEach(m => { m.xp = Math.max(0, (m.xp || 0) - Math.floor(CAM.xpBedarf(m.lv) * 0.1)); }); }

  A.heileTeam = function () { S.save.team.forEach(m => { m.hp = m.mhp; m.status = null; m.wunden = []; delete m.faintDone; }); };

  // ---------- Heilhaus ----------
  // Mobs werden in einem Heilhaus abgegeben (bezahlt wird sofort) und gepflegt, während du weiterziehst.
  // Fertige Mobs holst du im selben Dorf gratis ab oder in einem anderen Dorf gegen eine Transportgebühr (sie werden dorthin geschickt).
  // Dauer: Stufe 5 etwa 1 Sekunde, Stufe 100 etwa 3 Minuten.
  const dauerText = sek => sek >= 60 ? Math.floor(sek / 60) + ' Min ' + (sek % 60 ? (sek % 60) + ' s' : '') : sek + ' s';
  const hierDorf = () => { const d = Welt.dorfBei(S.x, S.y); if (d) return Welt.dorf.indexOf(d); let best = 0, bd = 1e9; Welt.dorf.forEach((d2, i) => { const dd = Math.hypot(d2.x - S.x, d2.y - S.y); if (dd < bd) { bd = dd; best = i; } }); return best; };
  const pflegeListe = () => S.save.pflege || (S.save.pflege = []);
  const transportGebuehr = (e, hier) => { if (e.dorf === hier) return 0; const a = Welt.dorf[e.dorf], b = Welt.dorf[hier]; return Math.max(5, Math.round(5 + Math.hypot(a.x - b.x, a.y - b.y) / 8 + e.m.lv * 1.5)); };
  A.pflegeFertig = () => pflegeListe().filter(e => e.ende <= Date.now()).length;
  A.heilhaus = async function () {
    let start = 0;
    for (;;) {
      const hier = hierDorf(), pf = pflegeListe(), jetzt = Date.now();
      const alle = S.save.team.map(m => ({ m, ort: 'Team' })).concat(S.save.box.map(m => ({ m, ort: 'Zwinger' })));
      const verletzt = alle.filter(o => CAM.heilInfo(o.m)).length;
      const fertig = pf.filter(e => e.ende <= jetzt).length;
      const plan = A.alleHeilenPlan();
      const r = await UI.choose([{ label: 'Alle heilen (' + (plan.liste.length ? plan.preis + ' G' : 'nichts zu tun') + ')', sub: plan.liste.length ? plan.liste.length + ' Mobs · längste Pflege ' + dauerText(plan.sek) + (plan.bleibt ? ' · ' + plan.bleibt + ' bleibt bei dir' : '') : 'alle gesund', disabled: !plan.liste.length || S.save.gold < plan.preis },
        { label: 'Mob zur Pflege geben', sub: verletzt ? verletzt + ' brauchen Pflege' : 'alle gesund' },
        { label: 'Mobs abholen', sub: pf.length ? fertig + ' fertig · ' + (pf.length - fertig) + ' in Pflege' : 'niemand in Pflege', disabled: !pf.length },
        { label: 'Zwinger öffnen', sub: S.save.box.length + ' / 100' }, { label: 'Tschüss' }],
        { title: 'Heilhaus ' + Welt.dorf[hier].name, sub: 'Du hast ' + S.save.gold + ' Gold.\nGib Mobs ab und zieh weiter: Sie werden gepflegt (Stufe 5: 1 Sekunde, Stufe 100: 3 Minuten). Abholen kannst du sie hier gratis oder in einem anderen Dorf gegen eine Transportgebühr.', start });
      if (r === 0) { start = 0; A.alleHeilen(hier, plan); }
      else if (r === 1) { start = 1; await A.mobHeilen(hier); }
      else if (r === 2) { start = 2; await A.mobAbholen(hier); }
      else if (r === 3) { start = 3; await A.zwinger(); }
      else return;
    }
  };
  // Alle verletzten Mobs auf einmal abgeben. Mindestens ein Mob bleibt im Team bei dir.
  A.alleHeilenPlan = function () {
    const alle = S.save.team.map(m => ({ m, ort: 'team' })).concat(S.save.box.map(m => ({ m, ort: 'box' })));
    let liste = alle.map(o => Object.assign(o, { h: CAM.heilInfo(o.m) })).filter(o => o.h);
    let bleibt = 0;
    if (liste.length && S.save.team.every(m => liste.some(o => o.m === m)) && !S.save.box.some(m => !liste.some(o => o.m === m))) {
      const teuer = liste.filter(o => o.ort === 'team').sort((a, b) => a.h.preis - b.h.preis)[0];   // der günstigste bleibt
      liste = liste.filter(o => o !== teuer); bleibt = 1;
    }
    return { liste, bleibt, preis: liste.reduce((s, o) => s + o.h.preis, 0), sek: liste.reduce((s, o) => Math.max(s, o.h.sek), 0) };
  };
  A.alleHeilen = function (hier, plan) {
    if (!plan.liste.length || S.save.gold < plan.preis) return;
    const jetzt = Date.now();
    for (const o of plan.liste) {
      if (o.ort === 'team') S.save.team.splice(S.save.team.indexOf(o.m), 1); else S.save.box.splice(S.save.box.indexOf(o.m), 1);
      pflegeListe().push({ m: o.m, dorf: hier, ende: jetzt + o.h.sek * 1000, preis: o.h.preis });
    }
    if (!S.save.team.length && S.save.box.length) S.save.team.push(S.save.box.shift());
    S.save.gold -= plan.preis; UI.snd('heil'); Save.speichern();
    UI.toast(plan.liste.length + ' Mobs in Pflege (' + dauerText(plan.sek) + ').', 2500);
  };
  A.mobHeilen = async function (hier) {
    let start = 0;
    if (hier === undefined) hier = hierDorf();
    for (;;) {
      const alle = S.save.team.map(m => ({ m, ort: 'Team' })).concat(S.save.box.map(m => ({ m, ort: 'Zwinger' })));
      const items = alle.map(o => {
        const h = CAM.heilInfo(o.m);
        return { label: mobZeile(o.m) + tagRar(CAM.FAMILIEN[o.m.fam].rar) + ' <small>' + o.ort + '</small>', sub: h ? lpText(o.m) + ' · ' + ge(h.preis) + ' · ' + dauerText(h.sek) : 'gesund', disabled: !h || S.save.gold < h.preis };
      });
      if (!alle.length) { await UI.info('Du hast keine Mobs.', 'Heilhaus'); return; }
      if (items.every(x => x.disabled)) {
        const nur = alle.some(o => CAM.heilInfo(o.m));
        await UI.info(nur ? 'Dir fehlt das Gold für die Pflege. Mit Heiltränken kannst du unterwegs selbst heilen.' : 'Alle deine Mobs sind gesund.', 'Heilhaus'); return;
      }
      const r = await UI.choose(items, { title: 'Welchen Mob abgeben?', sub: 'Du hast ' + S.save.gold + ' Gold. Bezahlt wird jetzt.', start, numbers: false, wide: true });
      if (r < 0) return;
      start = r;
      const o = alle[r], h = CAM.heilInfo(o.m);
      if (!h || S.save.gold < h.preis) continue;
      if (o.ort === 'Team' && S.save.team.length <= 1 && !S.save.box.length) { await UI.info('Dein letzter Mob muss bei dir bleiben. Nimm einen Heiltrank oder fang einen zweiten.', 'Heilhaus'); continue; }
      if (o.ort === 'Team') S.save.team.splice(S.save.team.indexOf(o.m), 1); else S.save.box.splice(S.save.box.indexOf(o.m), 1);
      if (!S.save.team.length && S.save.box.length) S.save.team.push(S.save.box.shift());
      S.save.gold -= h.preis;
      pflegeListe().push({ m: o.m, dorf: hier, ende: Date.now() + h.sek * 1000, preis: h.preis });
      UI.snd('heil'); Save.speichern();
      UI.toast(mobNameFull(o.m) + ' ist in Pflege (' + dauerText(h.sek) + ').', 2500);
    }
  };
  A.mobAbholen = async function (hier) {
    let start = 0;
    if (hier === undefined) hier = hierDorf();
    for (;;) {
      const pf = pflegeListe(), jetzt = Date.now();
      if (!pf.length) { await UI.info('Niemand ist in Pflege.', 'Heilhaus'); return; }
      const items = pf.map(e => {
        const rest = Math.ceil((e.ende - jetzt) / 1000), fee = transportGebuehr(e, hier), ort = Welt.dorf[e.dorf].name;
        const sub = rest > 0 ? 'noch ' + dauerText(rest) + ' · Heilhaus ' + ort : e.dorf === hier ? 'fertig · gratis abholen' : 'fertig in ' + ort + ' · Transport ' + ge(fee);
        return { label: mobZeile(e.m) + tagRar(CAM.FAMILIEN[e.m.fam].rar), sub, disabled: rest > 0 || S.save.gold < fee };
      });
      const r = await UI.choose(items, { title: 'Mobs abholen', sub: 'Du hast ' + S.save.gold + ' Gold. In einem anderen Dorf kostet der Transport extra.', start, numbers: false, wide: true });
      if (r < 0) return;
      start = r;
      const e = pf[r], fee = transportGebuehr(e, hier);
      if (e.ende > Date.now() || S.save.gold < fee) continue;
      const m = e.m; m.hp = m.mhp; m.status = null; m.wunden = []; delete m.faintDone;
      const wo = A.mobDazu(m);
      if (!wo) { await UI.info('Team und Zwinger sind voll.', 'Heilhaus'); continue; }
      pf.splice(r, 1); S.save.gold -= fee; UI.snd('heil'); Save.speichern();
      await UI.info(esc(mobNameFull(m)) + ' ist wieder fit' + (wo === 'box' ? ' und wartet im Zwinger' : '') + '.' + (fee ? ' Transport: ' + ge(fee) + '.' : ''), 'Abgeholt');
    }
  };

  // ---------- Fangkugel-Laden ----------
  A.laden = async function () {
    let start = 0;
    for (;;) {
      const items = CAM.SHOP.map(k => ({ label: CAM.ITEMS[k].n, sub: ge(CAM.ITEMS[k].preis) + ' · hast ' + CAM.itemAnz(k) }));
      items.push({ label: 'Gehen' });
      const r = await UI.choose(items, { title: 'Fangkugel-Laden', sub: 'Du hast ' + S.save.gold + ' Gold.\nEnter kauft ein Stück.', start });
      if (r < 0 || r === CAM.SHOP.length) return;
      start = r;
      const k = CAM.SHOP[r], it = CAM.ITEMS[k];
      if (S.save.gold < it.preis) { UI.snd('tick'); UI.toast('Nicht genug Gold.'); continue; }
      S.save.gold -= it.preis; CAM.itemAdd(k, 1); UI.snd('geld'); Save.speichern();
    }
  };

  // ---------- Mob-Händler ----------
  A.haendler = async function () {
    for (;;) {
      const r = await UI.choose([{ label: 'Mobs verkaufen' }, { label: 'Fundstücke verkaufen' }, { label: 'Zurückkaufen', sub: S.save.verkauft.length + ' angeboten' }, { label: 'Gehen' }],
        { title: 'Mob-Händler', sub: 'Du hast ' + S.save.gold + ' Gold. Die Jahreszeit (' + CAM.SAISONS[CAM.saison(Date.now())] + ') macht ' + CAM.SAISON_BONUS[CAM.saison(Date.now())] + '-Mobs gefragter.' });
      if (r === 0) await A.mobsVerkaufen();
      else if (r === 1) await A.fundeVerkaufen();
      else if (r === 2) await A.zurueckkaufen();
      else return;
    }
  };
  A.mobsVerkaufen = async function () {
    const sais = CAM.saison(Date.now());
    for (;;) {
      const alle = S.save.team.map(m => ({ m, ort: 'team' })).concat(S.save.box.map(m => ({ m, ort: 'box' })));
      if (!alle.length) { await UI.info('Du hast keine Mobs.', 'Mob-Händler'); return; }
      const items = alle.map(o => ({ label: mobZeile(o.m) + tagRar(CAM.FAMILIEN[o.m.fam].rar) + (o.ort === 'team' ? ' <small>Team</small>' : ''), sub: ge(CAM.preis(o.m, sais)) }));
      const r = await UI.choose(items, { title: 'Mobs verkaufen', sub: 'Du hast ' + S.save.gold + ' Gold.', numbers: false });
      if (r < 0) return;
      const o = alle[r], m = o.m, preis = CAM.preis(m, sais);
      if (o.ort === 'team' && S.save.team.length <= 1 && !S.save.box.length) { await UI.info('Der letzte Mob muss bei dir bleiben.', 'Mob-Händler'); continue; }
      if (o.ort === 'team' && S.save.team.filter(x => x !== m && x.hp > 0).length === 0 && S.save.box.length === 0) { await UI.info('Du brauchst mindestens einen kampffähigen Mob.', 'Mob-Händler'); continue; }
      const warn = CAM.FAMILIEN[m.fam].rar >= 2 ? '<br><b style="color:#ffb347">Achtung: ' + CAM.RARITAET[CAM.FAMILIEN[m.fam].rar] + '!</b>' : '';
      const ok = await UI.confirm(esc(mobNameFull(m)) + ' (Lv ' + m.lv + ') für ' + ge(preis) + ' verkaufen?' + warn + '<br><small>Du kannst ihn für das Dreifache zurückkaufen (die letzten 5).</small>', 'Verkaufen?');
      if (!ok) continue;
      if (o.ort === 'team') S.save.team.splice(S.save.team.indexOf(m), 1); else S.save.box.splice(S.save.box.indexOf(m), 1);
      S.save.gold += preis; S.save.verkauft.unshift({ m, preis: preis * 3 }); S.save.verkauft = S.save.verkauft.slice(0, 5);
      if (!S.save.team.length && S.save.box.length) S.save.team.push(S.save.box.shift());
      UI.snd('geld'); Save.speichern();
    }
  };
  A.fundeVerkaufen = async function () {
    const keys = Object.keys(S.save.items).filter(k => CAM.ITEMS[k] && CAM.ITEMS[k].fund);
    if (!keys.length) { await UI.info('Du hast keine Fundstücke. Die findest du nach Kämpfen.', 'Fundstücke'); return; }
    const items = keys.map(k => ({ label: CAM.ITEMS[k].n + ' × ' + S.save.items[k], sub: ge(CAM.ITEMS[k].preis * S.save.items[k]) }));
    items.push({ label: 'Alles verkaufen', sub: ge(keys.reduce((s, k) => s + CAM.ITEMS[k].preis * S.save.items[k], 0)) });
    const r = await UI.choose(items, { title: 'Fundstücke verkaufen' });
    if (r < 0) return;
    const ks = r === keys.length ? keys : [keys[r]];
    let sum = 0; ks.forEach(k => { sum += CAM.ITEMS[k].preis * S.save.items[k]; delete S.save.items[k]; });
    S.save.gold += sum; UI.snd('geld'); Save.speichern();
    await UI.info('Du bekommst ' + ge(sum) + '.', 'Verkauft');
  };
  A.zurueckkaufen = async function () {
    if (!S.save.verkauft.length) { await UI.info('Zur Zeit liegt nichts zum Zurückkaufen bereit.', 'Zurückkaufen'); return; }
    const items = S.save.verkauft.map(o => ({ label: mobZeile(o.m), sub: ge(o.preis), disabled: S.save.gold < o.preis }));
    const r = await UI.choose(items, { title: 'Zurückkaufen', sub: 'Du hast ' + S.save.gold + ' Gold.' });
    if (r < 0) return;
    const o = S.save.verkauft[r];
    S.save.gold -= o.preis; S.save.verkauft.splice(r, 1);
    A.mobDazu(o.m); UI.snd('geld'); Save.speichern();
  };
  // Neuen Mob ins Team oder in den Zwinger
  A.mobDazu = function (m) {
    delete m.faintDone; m.status = null; CAM.wundenVerbinden(m);
    if (S.save.team.length < CAM.TEAM_MAX) { S.save.team.push(m); return 'team'; }
    if (S.save.box.length < 100) { S.save.box.push(m); return 'box'; }
    return null;
  };

  // ---------- Wegstein ----------
  A.wegstein = async function () {
    const dorfs = S.save.besucht.map(i => Welt.dorf[i]);
    const items = dorfs.map(d => ({ label: d.name, sub: CAM.BIOME[d.biome].n }));
    const r = await UI.choose(items, { title: 'Wegstein', sub: 'Reise zu einem Dorf, das du schon besucht hast.' });
    if (r < 0) return;
    const d = dorfs[r];
    S.x = d.x + 0.5; S.y = d.y + 3.5; S.dir = 2; S.schritte = 0; Save.speichern();
    UI.snd('ruf');
  };
  A.dorfBesucht = function (d) {
    if (!S.save.besucht.includes(d.biome)) { S.save.besucht.push(d.biome); UI.toast('Neues Dorf entdeckt: ' + d.name + '. Der Wegstein dort führt jetzt hierher.', 4000); Save.speichern(); }
  };

  // ---------- Team, Zwinger, Beutel, Buch, Karte ----------
  A.mobDetails = async function (m) {
    const f = CAM.FAMILIEN[m.fam];
    const need = CAM.xpBedarf(m.lv);
    const moves = m.moves.map(id => CAM.MOVES[id]).map(mv => '<tr><td>' + esc(mv.n) + '</td><td>' + tagEl(mv.el) + '</td><td>' + (mv.pow ? 'Stärke ' + mv.pow : mv.heal ? 'Heilt' : '–') + '</td></tr>').join('');
    const html = '<div class="row" style="align-items:flex-start">' + spriteImg(m, 112) + '<div style="flex:1"><p><b style="font-size:17px">' + esc(mobNameFull(m)) + '</b> <small>Lv ' + m.lv + '</small><br>' + elTags(m) + tagRar(f.rar) + '</p>' +
      '<p>LP ' + m.hp + '/' + m.mhp + ' · Angriff ' + m.atk + ' · Verteidigung ' + m.def + ' · Tempo ' + m.spd + '</p>' +
      '<div class="bar"><i style="width:' + Math.min(100, Math.round(m.xp / need * 100)) + '%;background:#8a3ffc"></i></div><small style="color:#a9a59b">Erfahrung ' + m.xp + ' / ' + need + (f.stufen > 1 && m.stufe < 3 ? ' · entwickelt sich auf Stufe ' + CAM.EVO_LV[m.stufe - 1] : '') + '</small></div></div>' +
      '<table><tr><th>Attacke</th><th>Element</th><th>Wirkung</th></tr>' + moves + '</table>';
    await UI.info(html, 'Mob-Details');
  };
  A.teamMenue = async function () {
    let start = 0;
    for (;;) {
      const t = S.save.team;
      const items = t.map(m => ({ label: mobZeile(m) + elTags(m), sub: lpText(m) }));
      const r = await UI.choose(items, { title: 'Dein Team', sub: 'Enter: Details und Ordnen', start, wide: true });
      if (r < 0) return;
      start = r;
      const m = t[r];
      const w = await UI.choose([{ label: 'Details ansehen' }, { label: 'Nach vorne stellen', disabled: r === 0 }, { label: 'In den Zwinger', disabled: t.length <= 1 || S.save.box.length >= 100 }, { label: 'Zurück' }], { title: mobNameFull(m) });
      if (w === 0) await A.mobDetails(m);
      else if (w === 1) { t.splice(r, 1); t.unshift(m); start = 0; }
      else if (w === 2) { if (t.filter(x => x !== m && x.hp > 0).length) { t.splice(r, 1); S.save.box.push(m); start = 0; } else await UI.info('Du brauchst mindestens einen kampffähigen Mob im Team.'); }
    }
  };
  A.zwinger = async function () {
    let start = 0;
    for (;;) {
      const b = S.save.box;
      if (!b.length) { await UI.info('Der Zwinger ist leer. Gefangene Mobs landen hier, wenn dein Team voll ist (3 Plätze).', 'Zwinger'); return; }
      const items = b.map(m => ({ label: mobZeile(m) + tagRar(CAM.FAMILIEN[m.fam].rar), sub: lpText(m) }));
      const r = await UI.choose(items, { title: 'Zwinger', sub: b.length + ' von 100 Plätzen belegt', start, wide: true, numbers: false });
      if (r < 0) return;
      start = Math.min(r, b.length - 2 < 0 ? 0 : r);
      const m = b[r];
      const w = await UI.choose([{ label: 'Details ansehen' }, { label: S.save.team.length < CAM.TEAM_MAX ? 'Ins Team holen' : 'Mit Teammitglied tauschen' }, { label: 'Zurück' }], { title: mobNameFull(m) });
      if (w === 0) await A.mobDetails(m);
      else if (w === 1) {
        if (S.save.team.length < CAM.TEAM_MAX) { b.splice(r, 1); S.save.team.push(m); }
        else { const i = await A.waehleMob('Wen ersetzt er?'); if (i >= 0) { const alt = S.save.team[i]; S.save.team[i] = m; b[r] = alt; } }
      }
    }
  };
  A.beutelMenue = async function () {
    for (;;) {
      const keys = Object.keys(S.save.items).filter(k => CAM.ITEMS[k]);
      if (!keys.length) { await UI.info('Dein Beutel ist leer.', 'Beutel'); return; }
      const items = keys.map(k => { const it = CAM.ITEMS[k]; const nutz = it.heil || it.beleb || it.heilStatus; return { label: it.n + ' × ' + S.save.items[k], sub: it.info, disabled: !nutz }; });
      const r = await UI.choose(items, { title: 'Beutel', sub: 'Gold: ' + S.save.gold + '\nFangkugeln und Fundstücke brauchst du im Kampf und beim Händler.', numbers: false });
      if (r < 0) return;
      const k = keys[r], it = CAM.ITEMS[k];
      const i = await A.waehleMob(it.n + ' anwenden bei …', m => it.beleb ? m.hp <= 0 : it.heilStatus ? (m.hp > 0 && m.status) : (m.hp > 0 && m.hp < m.mhp));
      if (i < 0) continue;
      const m = S.save.team[i];
      if (it.heil) m.hp = Math.min(m.mhp, m.hp + it.heil); else if (it.beleb) { m.hp = Math.max(1, Math.floor(m.mhp * it.beleb)); delete m.faintDone; } else m.status = null;
      CAM.wundenAnpassen(m);
      CAM.itemAdd(k, -1); UI.snd('heil'); Save.speichern();
    }
  };
  A.buch = async function () {
    for (;;) {
      const dex = S.save.dex, F = CAM.FAMILIEN;
      const seen = Object.keys(dex).length, caught = Object.values(dex).filter(v => v >= 2).length;
      const items = F.map((f, i) => ({
        label: '<small style="color:#8e89a8">' + String(i + 1).padStart(2, '0') + '</small> ' + (f.spezial ? '<span style="color:#ffb36b">★</span> ' : '') + (dex[i] ? esc(f.n[f.n.length - 1] === f.n[0] ? f.n[0] : f.n.join(' › ')) : '???'),
        sub: dex[i] >= 2 ? '<span style="color:#5fd38a">gefangen</span>' : dex[i] ? 'gesehen' : '–',
      }));
      const r = await UI.choose(items, { title: 'Mob-Buch', sub: 'Gesehen ' + seen + ' / ' + F.length + ' · Gefangen ' + caught + ' / ' + F.length, numbers: false, wide: true });
      if (r < 0) return;
      if (!dex[r]) continue;
      const f = F[r];
      const orte = CAM.BIOME.filter(b => b.spawn.some(s => s[0] === r)).map(b => b.n).join(', ') || f.spezial || 'nur durch Riesen-Raids';
      const stufen = f.n.map((n, i) => spriteImg({ fam: r, stufe: i + 1 }, 72)).join('');
      await UI.info('<div class="row">' + stufen + '</div><p>' + f.n.join(' › ') + '<br>' + tagEl(f.el) + (f.el2 ? tagEl(f.el2) : '') + tagRar(f.rar) + '</p><p>Lebt in: ' + esc(orte) + (CAM.habText(f) ? '<br><small>Dort ' + esc(CAM.habText(f)) + '.</small>' : '') + '</p>', 'Mob-Buch');
    }
  };
  A.karte = function () {
    return new Promise(res => {
      const host = UI.openPanel('Weltkarte', S.online ? 'Gelb = Party, Weiss = du, Grau = Mitspieler' : 'Weiss = du', true);
      host.innerHTML = '<canvas id="kc" width="560" height="560" style="position:static;width:min(560px,60vh);height:min(560px,60vh);border-radius:8px;image-rendering:pixelated;display:block;margin:auto"></canvas><div class="foot">Schliessen mit M, Esc oder Enter</div>';
      const c = $('kc').getContext('2d');
      const sc = 560 / Welt.W;
      let alive = true;
      const draw = () => {
        if (!alive) return;
        c.imageSmoothingEnabled = false; c.drawImage(Welt.karte, 0, 0, 560, 560);
        c.font = '700 11px system-ui'; c.textAlign = 'center';
        for (const d of Welt.dorf) {
          const kn = S.save.besucht.includes(d.biome);
          c.fillStyle = kn ? '#ffd54a' : 'rgba(255,255,255,.35)'; c.fillRect(d.x * sc - 4, d.y * sc - 4, 8, 8);
          if (kn) { c.fillStyle = '#000'; c.fillText(d.name, d.x * sc + 1, d.y * sc - 8); c.fillStyle = '#fff'; c.fillText(d.name, d.x * sc, d.y * sc - 9); }
        }
        c.fillStyle = '#ff6a5e'; for (const b of Welt.boss) c.fillRect(b.x * sc - 3, b.y * sc - 3, 6, 6);
        for (const p of S.peers.values()) { c.fillStyle = (S.pt >= 0 && p.pt === S.pt) ? '#ffd54a' : '#9a96a8'; c.beginPath(); c.arc(p.x * sc, p.y * sc, 4, 0, 6.3); c.fill(); if (S.pt >= 0 && p.pt === S.pt) { c.fillStyle = '#fff'; c.fillText(p.name, p.x * sc, p.y * sc - 7); } }
        c.fillStyle = '#fff'; c.beginPath(); c.arc(S.x * sc, S.y * sc, 5, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.stroke();
        requestAnimationFrame(draw);
      };
      draw();
      const h = e => { if (['m', 'M', 'Escape', 'Enter', ' ', 'q'].includes(e.key)) { alive = false; UI.popKeys(h); UI.closePanel(); res(); } return true; };
      UI.pushKeys(h);
    });
  };
  A.spielstandCode = async function () {
    return new Promise(res => {
      const host = UI.openPanel('Spielstand-Code', 'Kopiere diesen Text und bewahre ihn auf. Auf einem anderen Gerät fügst du ihn unten ein.');
      host.innerHTML = '<textarea id="sc-t" spellcheck="false">' + (S.save ? Save.export() : '') + '</textarea><div class="row"><button class="btn" id="sc-cp">Kopieren</button><button class="btn alt" id="sc-im">Code einlesen</button><button class="btn alt" id="sc-x">Schliessen</button></div><div class="foot" id="sc-m"></div>';
      const msg = t => $('sc-m').textContent = t;
      $('sc-cp').onclick = () => { const t = $('sc-t'); t.select(); try { navigator.clipboard.writeText(t.value); msg('Kopiert.'); } catch (e) { document.execCommand && document.execCommand('copy'); msg('Kopiert.'); } };
      $('sc-im').onclick = () => {
        const o = Save.import($('sc-t').value);
        if (!o) { msg('Dieser Code ist ungültig.'); return; }
        S.save = o; S.x = o.x; S.y = o.y; Save.speichern(); msg('Spielstand geladen.'); setTimeout(() => { UI.closePanel(); res(true); }, 700);
      };
      $('sc-x').onclick = () => { UI.closePanel(); res(false); };
      const t = $('sc-t'); t.addEventListener('keydown', e => { if (e.key === 'Escape') { UI.closePanel(); res(false); } e.stopPropagation(); });
    });
  };
  A.partyListe = function () {
    if (S.pt < 0) return [];
    return Array.from(S.peers.values()).filter(p => p.pt === S.pt);
  };

  A.hauptmenue = async function () {
    for (;;) {
      const items = [{ label: 'Team' }, { label: 'Beutel' }, { label: 'Mob-Buch' }, { label: 'Karte', sub: 'M' }];
      if (S.online) { items.push({ label: 'Party' }, { label: 'Duell-Rangliste' }, { label: 'Welt-Einladung' }); }
      items.push({ label: 'Spielstand-Code' }, { label: 'Optionen' }, { label: 'Zum Titelmenü' });
      const labels = items.map(i => i.label);
      const r = await UI.choose(items, { title: 'Menü', sub: S.name + ' · ' + S.save.gold + ' Gold · ' + S.save.team.length + '/6 im Team', numbers: false });
      if (r < 0) return;
      const l = labels[r];
      if (l === 'Team') await A.teamMenue();
      else if (l === 'Beutel') await A.beutelMenue();
      else if (l === 'Mob-Buch') await A.buch();
      else if (l === 'Karte') await A.karte();
      else if (l === 'Party') await A.partyMenue();
      else if (l === 'Duell-Rangliste') await A.rangliste();
      else if (l === 'Welt-Einladung') await A.einladung();
      else if (l === 'Spielstand-Code') await A.spielstandCode();
      else if (l === 'Optionen') await A.optionen();
      else if (l === 'Zum Titelmenü') { const ok = await UI.confirm('Zurück zum Titelmenü? Dein Spielstand wird gespeichert.' + (S.online ? ' Du verlässt die Online-Welt.' : ''), 'Titelmenü'); if (ok) { A.zumTitel(); return; } }
    }
  };
  A.optionen = async function () {
    for (;;) {
      const r = await UI.choose([{ label: 'Ton', sub: UI.muted ? 'aus' : 'an' }, { label: 'Wetter-Effekte', sub: S.qualitaet ? 'volle Pracht' : 'Sparmodus' }, { label: 'Zurück' }], { title: 'Optionen', numbers: false });
      if (r === 0) { UI.muted = !UI.muted; S.save.ton = !UI.muted; Save.speichern(); }
      else if (r === 1) { S.qualitaet = S.qualitaet ? 0 : 1; S.save.quali = S.qualitaet; Save.speichern(); }
      else return;
    }
  };
  A.einladung = async function () {
    const link = Netz.link(), code = Netz.code();
    const r = await UI.choose([{ label: 'Link kopieren' }, { label: 'Zurück' }], { title: 'Freunde einladen', before: '<p>Welt-Code: <b style="font-size:22px;letter-spacing:.15em">' + esc(code) + '</b></p><p style="font-size:12px;color:#a9a59b;word-break:break-all">' + esc(link) + '</p><p>Oder über den Knopf <b>Freunde</b> am linken Rand.</p>' });
    if (r === 0) { try { await navigator.clipboard.writeText(link); UI.toast('Link kopiert.'); } catch (e) { UI.toast('Kopieren hat nicht geklappt.'); } }
  };
  A.rangliste = async function () {
    const rows = [{ n: S.name + ' (du)', w: S.save.w, l: S.save.l }].concat(Array.from(S.peers.values()).map(p => ({ n: p.name, w: p.w || 0, l: p.l || 0 })));
    rows.sort((a, b) => b.w - a.w || a.l - b.l);
    const html = '<table><tr><th>#</th><th>Name</th><th>Siege</th><th>Niederlagen</th></tr>' + rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.n) + '</td><td>' + r.w + '</td><td>' + r.l + '</td></tr>').join('') + '</table><p style="font-size:12px;color:#a9a59b">Zählt nur Duelle, zu denen beide zugestimmt haben. Überfälle zählen nicht.</p>';
    await UI.info(html, 'Duell-Rangliste dieser Welt');
  };
  A.partyMenue = async function () {
    for (;;) {
      const mit = A.partyListe();
      const items = [];
      if (S.pt >= 0) items.push({ label: 'Party verlassen' });
      items.push({ label: 'Zurück' });
      const html = S.pt >= 0 ? '<p>Deine Party:</p>' + ['<b>' + esc(S.name) + '</b> (du)'].concat(mit.map(p => esc(p.name))).map(x => '<p>• ' + x + '</p>').join('') : '<p>Du bist in keiner Party.<br>Stell dich neben eine Person, drück <b>E</b> und wähle «In die Party einladen».</p>';
      const r = await UI.choose(items, { title: 'Party', before: html, numbers: false });
      if (S.pt >= 0 && r === 0) { S.pt = -1; UI.toast('Du hast die Party verlassen.'); Netz.senden({ t: 'p', ...A.praesenz() }); return; }
      return;
    }
  };
  A.zumTitel = function () { A.beenden && A.beenden(); };

  // ---------- Wilde Mobs, Trainer, Riesen ----------
  A.wildMob = (x, y, now) => CAM.Wilde.wildMob(x, y, now);   // Auswahl nach Lebensraum: siehe wilde.js
  function trainerTeam(tr) {
    const rnd = CAM.mulberry32(tr.seed), B = CAM.BIOME[tr.biome];
    const team = [];
    for (let i = 0; i < tr.anz; i++) {
      let tot = 0; B.spawn.forEach(s => tot += s[1]);
      let r = rnd() * tot, fam = B.spawn[0][0];
      for (const [f, g] of B.spawn) { r -= g; if (r <= 0) { fam = f; break; } }
      team.push(CAM.neuerMob(fam, Math.max(2, tr.lv - 1 + Math.floor(rnd() * 3))));
    }
    return team;
  }
  function vorbereiten(team) { team.forEach(m => { delete m.faintDone; m.status = null; }); }
  function nachbereiten(team) { team.forEach(m => { delete m.faintDone; m.status = null; CAM.wundenVerbinden(m); }); }
  function aktuellesWetter() { return CAM.wetterBei(Welt.biomeAt(S.x, S.y), Date.now()); }
  function beutel() { return S.save.items; }
  function kampfBasis(art, extra) {
    return Object.assign({ kind: art, weather: aktuellesWetter(), biome: Welt.biomeAt(S.x, S.y), beutel, verbrauch: k => CAM.itemAdd(k, -1) }, extra);
  }

  async function xpVerteilen(b, la) {
    const lines = [];
    if (b.winner === 0) S.save.fangXp = (S.save.fangXp || 0) + 0.1;
    const pool = b.xpPool();
    if (pool <= 0) return lines;
    const nutzer = Array.from(la.used).map(i => la.team[i]).filter(m => m && m.hp > 0);
    if (!nutzer.length) return lines;
    const teil = Math.max(1, Math.floor(pool / nutzer.length));
    for (const m of nutzer) {
      lines.push(esc(mobNameFull(m)) + ' erhält ' + teil + ' Erfahrung.');
      m.xp += teil;
      while (m.xp >= CAM.xpBedarf(m.lv) && m.lv < 50) {
        m.xp -= CAM.xpBedarf(m.lv);
        const altS = m.stufe, altMhp = m.mhp, altAtk = m.atk, altDef = m.def, altSpd = m.spd, altN = CAM.name(m), altMoves = m.moves.slice();
        m.lv++; CAM.neuBerechnen(m);
        if (m.hp > 0) m.hp += m.mhp - altMhp;
        lines.push('<b style="color:#ffd54a">' + esc(altN) + ' steigt auf Stufe ' + m.lv + '!</b> <small style="color:#5fd38a">LP +' + (m.mhp - altMhp) + ' · Angriff +' + (m.atk - altAtk) + ' · Verteidigung +' + (m.def - altDef) + (m.spd > altSpd ? ' · Tempo +' + (m.spd - altSpd) : '') + '</small>');
        if (m.stufe > altS) lines.push('<b style="color:#c9a6ff">' + esc(altN) + ' entwickelt sich zu ' + esc(CAM.name(m)) + '!</b>');
        m.moves.filter(x => !altMoves.includes(x)).forEach(x => lines.push('Neue Attacke: ' + esc(CAM.MOVES[x].n)));
      }
    }
    return lines;
  }
  async function verloren(titelText) {
    const v = verlierGold(); verlierXp();
    // zum nächsten Dorf, Mobs heilen
    let best = null, bd = 1e9;
    for (const d of Welt.dorf) { const dd = Math.hypot(d.x - S.x, d.y - S.y); if (dd < bd) { bd = dd; best = d; } }
    A.heileTeam(); S.x = best.x + 0.5; S.y = best.y + 3.5; S.schritte = 0; Save.speichern();
    UI.snd('niederlage');
    await UI.info((titelText || 'Dein Team ist erschöpft.') + '<br>Du verlierst ' + ge(v) + ' (80 %) und 10 % Erfahrung und wachst im Heilhaus von <b>' + esc(best.name) + '</b> auf. Alle Mobs sind geheilt.', 'Niederlage');
  }
  function dexSet(fam, w) { S.save.dex[fam] = Math.max(S.save.dex[fam] || 0, w); }

  A.wildKampf = async function (mob, opt) {
    opt = opt || {};
    if (S.busy || !CAM.lebend()) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    vorbereiten(S.save.team);
    dexSet(mob.fam, 1);
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: S.save.team, fang: CAM.fangStufe(S.save.team, S.save.fangXp) };
    const wild = { id: 'w', name: 'Wild', side: 1, ctrl: 'ai', team: [mob] };
    const f = CAM.FAMILIEN[mob.fam];
    const intro = (opt.intro || ('Ein wilder ' + mobNameFull(mob) + ' (Lv ' + mob.lv + ') erscheint!')) + (mob.glanz ? ' Er glänzt ganz seltsam …' : '');
    const res = await K.starten(kampfBasis('wild', { actors: [lokal, wild], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, intro, erster: opt.erster }));
    const b = res.b; nachbereiten(S.save.team);
    const lines = [];
    if (b.result.caught) {
      const m = b.result.caught; delete m.faintDone; m.status = null;
      const wo = A.mobDazu(m); dexSet(m.fam, 2); S.save.fangXp = (S.save.fangXp || 0) + 0.15;
      lines.push('<b style="color:#5fd38a">' + esc(mobNameFull(m)) + ' gehört jetzt dir!</b> ' + (wo === 'team' ? '(ins Team aufgenommen)' : wo === 'box' ? '(in den Zwinger gebracht)' : '(Zwinger voll, er wurde freigelassen)'));
    } else if (b.result.fled) lines.push('Du bist entkommen.');
    else if (b.winner === 0) {
      UI.snd('sieg');
      lines.push(...await xpVerteilen(b, b.actor(lokal.id)));
      const gold = 5 + mob.lv * 3; S.save.gold += gold; lines.push('Du findest ' + gold + ' Gold.');
      if (Math.random() < 0.35) { const k = CAM.FUNDE[Welt.biomeAt(S.x, S.y)][Math.floor(Math.random() * 2)]; CAM.itemAdd(k, 1); lines.push('Fundstück: ' + CAM.ITEMS[k].n); }
    }
    if (opt.entity) {
      if (b.winner === 0) CAM.Wilde.entfernen(opt.entity);
      else opt.entity.ruheBis = Date.now() + (b.result.fled ? 9000 : 20000);
    }
    Save.speichern();
    S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.winner === 1 && !b.result.fled) { await verloren(); return; }
    if (lines.length) await UI.info(lines.join('<br>'), b.result.caught ? 'Gefangen!' : 'Kampf vorbei');
  };

  A.wildMenue = async function (w) {
    const m = w.mob, f = CAM.FAMILIEN[m.fam], boese = CAM.Wilde.boese(m);
    S.save.dex[m.fam] = Math.max(S.save.dex[m.fam] || 0, 1);
    const lust = boese ? '<b style="color:#ff6b5e">Bösartig:</b> Er greift Spieler an.' : 'Friedlich: Er greift nur an, wenn du es willst.';
    const r = await UI.choose([{ label: 'Angreifen', sub: CAM.lebend() ? '' : 'Dein Team ist erschöpft', disabled: !CAM.lebend() }, { label: 'In Ruhe lassen' }],
      { title: mobNameFull(m), sub: 'Stufe ' + m.lv + ' · ' + CAM.RARITAET[f.rar], before: '<div class="row">' + spriteImg(m, 96) + '<div>' + elTags(m) + '<p>' + lust + '</p></div></div>', numbers: false });
    if (r === 0) { await A.wildKampf(m, { entity: w, intro: 'Du forderst ' + mobNameFull(m) + ' (Lv ' + m.lv + ') heraus!' }); }
  };

  A.trainerKampf = async function (tr, opt) {
    opt = opt || {};
    if (S.busy || !CAM.lebend()) return false;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    vorbereiten(S.save.team);
    const team = trainerTeam(tr); team.forEach(m => dexSet(m.fam, 1));
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: S.save.team };
    const gegner = { id: 't', name: tr.name, side: 1, ctrl: 'ai', team };
    const res = await K.starten(kampfBasis('trainer', { actors: [lokal, gegner], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, intro: tr.name + ' fordert dich heraus!', erster: opt.erster }));
    const b = res.b; nachbereiten(S.save.team);
    const lines = [];
    if (b.winner === 0) {
      UI.snd('sieg'); S.trainerT[tr.id] = Date.now();
      lines.push(...await xpVerteilen(b, b.actor(lokal.id)));
      const gold = 30 + tr.lv * 10 * tr.anz; S.save.gold += gold; lines.push(tr.name + ' bezahlt dir ' + gold + ' Gold.');
    }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.winner === 1) { S.trainerT[tr.id] = Date.now() - TRAINER_PAUSE_MS + 60000; await verloren('Du wurdest von ' + esc(tr.name) + ' besiegt.'); return true; }
    if (lines.length) await UI.info(lines.join('<br>'), 'Sieg!');
    return true;
  };

  // ---------- Online: Hilfen ----------
  A.praesenz = function () {
    return { x: Math.round(S.x * 10) / 10, y: Math.round(S.y * 10) / 10, d: S.dir, pt: S.pt, bs: S.busy ? 1 : 0, lv: CAM.maxLv() };
  };
  A.hallo = function (an, antwort) {
    const m = { t: 'hi', n: S.name, c: S.save.col, w: S.save.w, l: S.save.l, re: !!antwort, ...A.praesenz() };
    if (an !== undefined) m.to = an;
    Netz.senden(m);
  };
  function peer(idx) { return S.peers.get(idx); }
  function duellTeam() {
    return S.save.team.slice(0, 3).map(m => { const c = CAM.kopie(m); c.lv = 30; CAM.neuBerechnen(c); c.hp = c.mhp; c.status = null; delete c.faintDone; c.xp = 0; return c; });
  }
  A.ueberfallGrund = function (p) {
    const now = Date.now();
    if (Welt.istSicher(S.x, S.y)) return 'Du stehst in einer sicheren Zone.';
    if (Welt.istSicher(p.x, p.y)) return p.name + ' steht in einer sicheren Zone.';
    if (p.lv < NACHT_STUFE) return p.name + ' ist noch unter Stufe ' + NACHT_STUFE + '.';
    if ((S.prot[p.idx] || 0) > now) return p.name + ' ist noch ' + Math.ceil((S.prot[p.idx] - now) / 60000) + ' Min. geschützt.';
    if (S.pt >= 0 && p.pt === S.pt) return 'Party-Mitglieder überfällt man nicht.';
    if (p.bs) return p.name + ' kämpft gerade.';
    if (!CAM.lebend()) return 'Dein Team ist erschöpft.';
    return '';
  };

  A.einsatzOnline = async function (p) {
    const eigen = S.save.team, mid = Math.max(1, Math.round((CAM.schnitt(eigen) + (p.lv || 1)) / 2));
    const mo = await UI.choose([{ label: 'Fairer Kampf', sub: 'alle auf Stufe ' + mid }, { label: 'Echter Kampf', sub: 'Stufen wie sie sind (deine Ø ' + Math.round(CAM.schnitt(eigen)) + ', seine höchste ' + (p.lv || '?') + ')' }, { label: '← Zurück' }], { title: 'Duell mit ' + p.name, sub: 'Du siehst: höchste Stufe ' + (p.lv || '?') + '. ' + p.name + ' kann annehmen oder ablehnen.' });
    if (mo < 0 || mo === 2) return null;
    const o = { fair: mo === 0 ? mid : 0, gold: 0, mob: 0 };
    const stufen = [25, 50, 100, 250, 500];
    const ei = [{ label: 'Kein Einsatz' }].concat(stufen.map(g => ({ label: g + ' Gold', disabled: g > S.save.gold })));
    ei.push({ label: 'Vorderstes Fabelwesen setzen', sub: 'Verlierer gibt seins ab', disabled: S.save.team.filter(m => m.hp > 0).length < 2 }); ei.push({ label: '← Zurück' });
    const e = await UI.choose(ei, { title: 'Einsatz', sub: 'Du hast ' + S.save.gold + ' Gold. Bei einer Mob-Wette setzen beide ihr vorderstes Team-Mitglied.', numbers: false });
    if (e < 0 || e === ei.length - 1) return null;
    if (e >= 1 && e <= stufen.length) o.gold = stufen[e - 1];
    if (e === ei.length - 2) { o.mob = 1; o.mA = CAM.name(S.save.team[0]) + ' Lv ' + S.save.team[0].lv; }
    return o;
  };

  // Menü bei einer anderen Person
  A.spielerMenue = async function (p) {
    if (S.busy) return;
    const grund = A.ueberfallGrund(p);
    const inParty = S.pt >= 0 && p.pt === S.pt;
    const items = [
      { label: 'Zum Duell herausfordern', sub: p.bs ? 'kämpft gerade' : '', disabled: !!p.bs || !CAM.lebend() },
      { label: 'Überfallen', sub: grund || 'Kampf ohne Vorwarnung', disabled: !!grund },
      { label: inParty ? 'Ist in deiner Party' : 'In die Party einladen', disabled: inParty || A.partyListe().length >= 3 },
      { label: 'Zurück' },
    ];
    const sch = (S.prot[p.idx] || 0) > Date.now() ? ' 🛡' : '';
    const r = await UI.choose(items, { title: p.name + sch, sub: 'Höchste Stufe: ' + p.lv + ' · Duelle ' + (p.w || 0) + ' Siege / ' + (p.l || 0) + ' Niederlagen' });
    if (r === 0) {
      const o = await A.einsatzOnline(p); if (!o) return;
      UI.toast('Duell-Anfrage an ' + p.name + ' gesendet …');
      A.angebot = { idx: p.idx, art: 'chal', t: Date.now(), o };
      Netz.senden({ t: 'chal', to: p.idx, from: S.idx, o });
      setTimeout(() => { if (A.angebot && A.angebot.art === 'chal' && Date.now() - A.angebot.t >= 15000) { A.angebot = null; UI.toast(p.name + ' hat nicht geantwortet.'); } }, 15500);
    } else if (r === 1) {
      Netz.senden({ t: 'amb', a: S.idx, b: p.idx });
      if (Netz.gastgeber() === S.idx) A.hostUeberfall({ a: S.idx, b: p.idx });
    } else if (r === 2) {
      if (S.pt < 0) S.pt = S.idx;
      Netz.senden({ t: 'pinv', to: p.idx, from: S.idx, gid: S.pt });
      UI.toast('Party-Einladung an ' + p.name + ' gesendet.');
      Netz.senden({ t: 'p', ...A.praesenz() });
    }
  };

  // ---------- Online: Nachrichten ----------
  A.nachricht = function (d, von) {
    switch (d.t) {
      case 'hi': {
        const p = S.peers.get(von) || { idx: von, x: d.x, y: d.y, tx: d.x, ty: d.y };
        Object.assign(p, { idx: von, name: String(d.n || 'Spieler').slice(0, 16), col: d.c | 0, w: d.w | 0, l: d.l | 0, tx: d.x, ty: d.y, dir: d.d | 0, pt: d.pt === undefined ? -1 : d.pt, bs: d.bs, lv: d.lv | 0, gest: '', gestT: 0 });
        if (p.x === undefined) { p.x = d.x; p.y = d.y; }
        S.peers.set(von, p);
        if (!d.re) A.hallo(von, true);
        break;
      }
      case 'p': {
        const p = S.peers.get(von); if (!p) { A.hallo(von, true); return; }
        p.tx = d.x; p.ty = d.y; p.dir = d.d; p.pt = d.pt; p.bs = d.bs; p.lv = d.lv; p.zeit = Date.now();
        break;
      }
      case 'gest': { const p = S.peers.get(von); if (p) { p.gest = CAM.GESTEN[d.g] ? CAM.GESTEN[d.g][0] : ''; p.gestT = Date.now(); } break; }
      case 'st': { const p = S.peers.get(von); if (p) { p.w = d.w | 0; p.l = d.l | 0; } break; }
      case 'act': K.eingang(d); break;
      case 'team': (S.teams[d.bid] = S.teams[d.bid] || {})[d.idx] = { team: d.team, gold: d.gold }; break;
      case 'chal': {
        const p = S.peers.get(von); if (!p) return;
        if (S.busy || !CAM.lebend()) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
        const o = d.o || {};
        if ((o.gold || 0) > S.save.gold) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
        const txt = (o.fair ? 'Fairer Kampf (alle auf Stufe ' + (o.fair | 0) + ')' : 'Echter Kampf') + ' · ' + (o.gold ? 'Einsatz ' + (o.gold | 0) + ' Gold' : 'ohne Gold') + (o.mob ? ' · Wette: ' + esc(String(o.mA || 'Mob')) + ' gegen dein vorderstes Fabelwesen (' + esc(S.save.team[0] ? CAM.name(S.save.team[0]) + ' Lv ' + S.save.team[0].lv : '–') + ')' : '') + ' · ' + esc(p.name) + ' hat höchste Stufe ' + (p.lv | 0);
        if (o.mob && S.save.team.filter(m => m.hp > 0).length < 2) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
        UI.addCard('<b>' + esc(p.name) + '</b> fordert dich zum Duell heraus!<br><small>' + txt + '</small>', 20, () => Netz.senden({ t: 'chalr', to: von, ok: true }), () => Netz.senden({ t: 'chalr', to: von, ok: false }));
        UI.snd('ruf');
        break;
      }
      case 'chalr': {
        if (!A.angebot || A.angebot.art !== 'chal' || A.angebot.idx !== von) return;
        A.angebotO = A.angebot.o; A.angebot = null;
        if (!d.ok) { UI.toast((S.peers.get(von) ? S.peers.get(von).name : 'Die Person') + ' lehnt das Duell ab.'); return; }
        const ao = A.angebotO || {}, pname = S.peers.get(von) ? S.peers.get(von).name : 'Die Person';
        const zus = (ao.fair ? 'Fairer Kampf auf Stufe ' + (ao.fair | 0) : 'Echter Kampf') + ' · ' + (ao.gold ? 'Einsatz ' + (ao.gold | 0) + ' Gold' : 'kein Gold') + (ao.mob ? ' · Wette: ' + esc(String(ao.mA || 'Mob')) + ' gegen sein vorderstes Fabelwesen' : '');
        UI.confirm(esc(pname) + ' hat angenommen.<br><small>' + zus + '</small><br>Kampf jetzt bestätigen?', 'Kampf bestätigen').then(ja => {
          if (!ja || S.busy || !CAM.lebend()) { Netz.senden({ t: 'duelno', to: von }); return; }
          const m = { t: 'duelgo', a: S.idx, b: von, seed: (Math.random() * 2 ** 31) | 0, amb: false, w: aktuellesWetter(), o: A.angebotO || null };
          Netz.senden(m); A.duellStart(m);
        });
        break;
      }
      case 'prize': { if (d.mob && CAM.FAMILIEN[d.mob.fam]) { const m = d.mob; CAM.neuBerechnen(m); m.hp = m.mhp; m.wunden = []; A.mobDazu(m); S.save.dex[m.fam] = 2; Save.speichern(); UI.toast('Du hast ' + CAM.name(m) + ' (Lv ' + m.lv + ') gewonnen!', 4000); } break; }
      case 'duelno': UI.toast((S.peers.get(von) ? S.peers.get(von).name : 'Die Person') + ' hat den Kampf doch nicht bestätigt.'); break;
      case 'duelgo': if (d.a === von && d.b === S.idx) A.duellStart(d); break;
      case 'amb': if (Netz.gastgeber() === S.idx) A.hostUeberfall(d); break;
      case 'ambno': if (d.a === S.idx) UI.toast(d.grund || 'Der Überfall ist nicht möglich.'); break;
      case 'ambok': A.ueberfallOk(d); break;
      case 'pinv': {
        const p = S.peers.get(von); if (!p) return;
        UI.addCard('<b>' + esc(p.name) + '</b> lädt dich in die Party ein.', 15, () => {
          const n = Array.from(S.peers.values()).filter(q => q.pt === d.gid).length;
          if (n >= 4) { UI.toast('Die Party ist schon voll.'); return; }
          S.pt = d.gid; UI.toast('Du bist jetzt in der Party von ' + p.name + '.'); Netz.senden({ t: 'p', ...A.praesenz() });
        }, () => {});
        UI.snd('ruf');
        break;
      }
      case 'raidreq': {
        const p = S.peers.get(von); if (!p) return;
        const boss = CAM.BOSS[d.boss];
        if (S.busy || !CAM.lebend()) { Netz.senden({ t: 'raidr', to: von, ok: false, bid: d.bid }); return; }
        UI.addCard('<b>' + esc(p.name) + '</b> startet einen Raid gegen <b>' + esc(boss.n) + '</b>. Mitkämpfen?', 15, () => { (A.raidZusagen = A.raidZusagen || {})[d.bid] = von; Netz.senden({ t: 'raidr', to: von, ok: true, bid: d.bid }); }, () => Netz.senden({ t: 'raidr', to: von, ok: false, bid: d.bid }));
        UI.snd('ruf');
        break;
      }
      case 'raidr': if (A.raidSammler && A.raidSammler.bid === d.bid) A.raidSammler.antworten[von] = !!d.ok; break;
      case 'raidgo': if (A.raidZusagen && A.raidZusagen[d.bid] === von && d.members.includes(S.idx)) A.raidStart(d); break;
    }
  };

  // Gastgeber prüft einen Überfall und gibt ihn frei
  A.hostUeberfall = function (d) {
    const now = Date.now();
    const pa = d.a === S.idx ? { idx: S.idx, x: S.x, y: S.y, lv: CAM.maxLv(), bs: S.busy ? 1 : 0, pt: S.pt, name: S.name } : S.peers.get(d.a);
    const pb = d.b === S.idx ? { idx: S.idx, x: S.x, y: S.y, lv: CAM.maxLv(), bs: S.busy ? 1 : 0, pt: S.pt, name: S.name } : S.peers.get(d.b);
    let grund = '';
    if (!pa || !pb) grund = 'Die Person ist nicht mehr da.';
    else if (Welt.istSicher(pa.x, pa.y)) grund = 'Ein Überfall aus der sicheren Zone ist nicht erlaubt.';
    else if (Welt.istSicher(pb.x, pb.y)) grund = pb.name + ' steht in einer sicheren Zone.';
    else if (pb.lv < NACHT_STUFE) grund = pb.name + ' ist noch unter Stufe ' + NACHT_STUFE + '.';
    else if ((S.prot[d.b] || 0) > now) grund = pb.name + ' ist noch geschützt.';
    else if (pa.pt >= 0 && pa.pt === pb.pt) grund = 'Party-Mitglieder überfällt man nicht.';
    else if (pb.bs || pa.bs) grund = 'Eine der Personen kämpft gerade.';
    else if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 6) grund = 'Zu weit weg.';
    if (grund) { if (d.a === S.idx) UI.toast(grund); else Netz.senden({ t: 'ambno', to: d.a, a: d.a, grund }); return; }
    const m = { t: 'ambok', a: d.a, b: d.b, seed: (Math.random() * 2 ** 31) | 0, until: now + SCHUTZ_MS, w: aktuellesWetter() };
    Netz.senden(m); A.ueberfallOk(m);
  };
  A.ueberfallOk = function (d) {
    S.prot[d.b] = d.until;
    if (d.a === S.idx || d.b === S.idx) A.duellStart({ a: d.a, b: d.b, seed: d.seed, amb: true, w: d.w });
  };

  async function warteAuf(fn, ms) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await sleep(80); } return true; }

  // ---------- Duell (3 gegen 3, Stufe 30) ----------
  const gewonnen0 = (b, seite) => b.over && b.winner === seite;
  A.duellStart = async function (d) {
    if (S.busy || !CAM.lebend()) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    const andere = d.a === S.idx ? d.b : d.a, bid = 'd' + d.seed;
    const o = d.o || null, lvl = o ? (o.fair | 0) : 30, stake = o && o.mob ? S.save.team[0] : null;
    const mein = CAM.duellKopien(S.save.team, lvl), goldStart = S.save.gold;
    Netz.senden({ t: 'team', bid, idx: S.idx, team: mein, gold: goldStart });
    UI.toast(d.amb ? 'Überfall!' : 'Duell beginnt …', 1500);
    const ok = await warteAuf(() => S.teams[bid] && S.teams[bid][andere], 10000);
    if (!ok) { S.busy = false; UI.toast('Das Duell konnte nicht starten.'); delete S.teams[bid]; return; }
    const gegnerTeam = S.teams[bid][andere];
    const lo = Math.min(S.idx, andere), hi = Math.max(S.idx, andere);
    const pn = i => i === S.idx ? S.name : ((S.peers.get(i) || {}).name || 'Gegner');
    const teams = { [S.idx]: mein, [andere]: gegnerTeam.team };
    const actors = [lo, hi].map((i, side) => ({ id: 'p' + i, name: pn(i), side, ctrl: i === S.idx ? 'local' : 'remote', team: teams[i], fleeFirst: d.amb && i === d.b }));
    const res = await K.starten({
      kind: 'duel', actors, erster: d.amb ? (d.a === lo ? 0 : 1) : null, localId: 'p' + S.idx, seed: d.seed, weather: d.w || 'klar', biome: Welt.biomeAt(S.x, S.y), bid, timer: 40, ueberfall: d.amb,
      senden: m => Netz.senden(m), beutel, verbrauch: () => {},
      intro: d.amb ? pn(d.a) + ' überfällt ' + pn(d.b) + '!' : 'Duell: ' + pn(lo) + ' gegen ' + pn(hi),
    });
    const b = res.b;
    delete S.teams[bid];
    const meineSeite = S.idx === lo ? 0 : 1;
    const lines = [];
    const anwenden = [];
    if (b.over) {
      const gewonnen = b.winner === meineSeite;
      // Überfall: Wer überfällt und gewinnt, klaut 100 Gold (hat das Opfer unter 150 Gold, klaut er 70 %). Sonst gibt es keine Beute.
      const klau = g => g < 150 ? Math.floor(g * 0.7) : 100;
      if (o && o.gold) { const g = o.gold | 0; if (gewonnen) { lines.push('Einsatz: Du bekommst ' + ge(g) + '.'); anwenden.push(() => { S.save.gold += g; }); } else { const z = Math.min(g, S.save.gold); lines.push('Einsatz: Du zahlst ' + ge(z) + '.'); anwenden.push(() => { S.save.gold -= z; }); } }
      if (stake && !gewonnen) { const i = S.save.team.indexOf(stake); if (i >= 0 && S.save.team.length > 1) { lines.push('<b style="color:#ff6b5e">' + esc(CAM.name(stake)) + ' geht an ' + esc(pn(andere)) + '.</b>'); anwenden.push(() => { const k = S.save.team.indexOf(stake); if (k >= 0 && S.save.team.length > 1) { S.save.team.splice(k, 1); Netz.senden({ t: 'prize', to: andere, mob: CAM.kopie(stake) }); } }); } }
      if (stake && gewonnen) lines.push('Als Preis bekommst du das Fabelwesen von ' + esc(pn(andere)) + '.');
      if (gewonnen) { lines.push('<b style="color:#5fd38a">Du hast gewonnen!</b>'); UI.snd('sieg'); }
      else { lines.push('<b style="color:#ff6b5e">Du hast verloren.</b>'); UI.snd('niederlage'); }
      if (d.amb) {
        const angreifer = d.a === S.idx;
        if (angreifer && gewonnen) { const g = klau(gegnerTeam.gold); if (g > 0) { lines.push('Beute: Du klaust ' + ge(g) + '.'); anwenden.push(() => { S.save.gold += g; }); } }
        else if (!angreifer && !gewonnen) { const g = klau(goldStart); if (g > 0) { lines.push('Du wirst bestohlen: ' + ge(g) + ' sind weg.'); anwenden.push(() => { S.save.gold = Math.max(0, S.save.gold - g); }); } }
      }
      if (!d.amb) { if (gewonnen) S.save.w++; else S.save.l++; Netz.senden({ t: 'st', w: S.save.w, l: S.save.l }); }
      else lines.push('<small>Überfälle zählen nicht für die Rangliste.</small>');
      if (d.amb && d.b === S.idx) lines.push('<small>Du bist jetzt 30 Minuten vor Überfällen geschützt.</small>');
    }
    if (anwenden.length) { lines.push('<br><small>Mit OK bestätigst du den Preis.</small>'); await UI.info(lines.join('<br>'), gewonnen0(b, meineSeite) ? 'Preis bestätigen' : 'Einsatz bestätigen'); anwenden.forEach(f => f()); lines.length = 0; }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (lines.length) await UI.info(lines.join('<br>'), 'Duell vorbei');
  };

  // ---------- Riesen-Gegner ----------
  A.runeMenue = async function (rune) {
    const bs = Welt.boss.find(b => b.x === rune.x && b.y === rune.y); if (!bs) return;
    const boss = CAM.BOSS[bs.idx], f = CAM.FAMILIEN[boss.fam];
    const rest = (S.save.bossT[bs.idx] || 0) + BOSS_PAUSE_MS - Date.now();
    const party = A.partyListe().filter(p => !p.bs && Math.hypot(p.x - S.x, p.y - S.y) < 30);
    const sub = 'Stufe ' + bs.lv + ' · ' + f.el + (f.el2 ? '/' + f.el2 : '') + '\nEmpfohlen: 3–4 Spieler. Wetter und Elemente entscheiden.' + (rest > 0 ? '\nDer Riese erholt sich noch ' + Math.ceil(rest / 60000) + ' Min.' : '');
    const items = [{ label: 'Raid starten', sub: party.length ? 'mit ' + party.length + ' aus der Party' : 'allein (schwer!)', disabled: rest > 0 || !CAM.lebend() }, { label: 'Abbrechen' }];
    const r = await UI.choose(items, { title: '⚠ ' + boss.n, sub, before: '<div class="row">' + spriteImg({ fam: boss.fam, stufe: 1 }, 96) + '</div>' });
    if (r !== 0) return;
    if (party.length) await A.raidAnfrage(bs, party); else await A.raidStart({ bid: 'r' + ((Math.random() * 2 ** 31) | 0), boss: bs.idx, members: [S.idx], seed: (Math.random() * 2 ** 31) | 0, w: aktuellesWetter(), lv: bs.lv });
  };
  A.raidAnfrage = async function (bs, party) {
    const bid = 'r' + ((Math.random() * 2 ** 31) | 0);
    A.raidSammler = { bid, antworten: {} };
    party.forEach(p => Netz.senden({ t: 'raidreq', to: p.idx, bid, boss: bs.idx }));
    UI.toast('Raid-Einladung an die Party gesendet …', 3000);
    S.busy = true;
    await warteAuf(() => party.every(p => bid && A.raidSammler.antworten[p.idx] !== undefined), 16000);
    S.busy = false;
    const members = [S.idx].concat(party.filter(p => A.raidSammler.antworten[p.idx]).map(p => p.idx)).sort((x, y) => x - y);
    A.raidSammler = null;
    const m = { t: 'raidgo', bid, boss: bs.idx, members, seed: (Math.random() * 2 ** 31) | 0, w: aktuellesWetter(), lv: bs.lv };
    members.forEach(i => { if (i !== S.idx) Netz.senden(Object.assign({ to: i }, m)); });
    await A.raidStart(m);
  };
  A.raidStart = async function (d) {
    if (K.aktiv) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    const bs = Welt.boss.find(b => b.idx === d.boss), bossDef = CAM.BOSS[d.boss], f = CAM.FAMILIEN[bossDef.fam];
    const lv = d.lv || bs.lv;
    vorbereiten(S.save.team);
    const members = d.members.slice().sort((a, b) => a - b);
    let teams = { [S.idx]: S.save.team };
    if (members.length > 1) {
      Netz.senden({ t: 'team', bid: d.bid, idx: S.idx, team: S.save.team.map(CAM.kopie), gold: 0 });
      UI.toast('Raid beginnt …', 1500);
      const ok = await warteAuf(() => members.every(i => i === S.idx || (S.teams[d.bid] && S.teams[d.bid][i])), 12000);
      if (!ok) { S.busy = false; UI.toast('Der Raid konnte nicht starten.'); return; }
      members.forEach(i => { if (i !== S.idx) teams[i] = S.teams[d.bid][i].team; });
    }
    delete S.teams[d.bid];
    const boss = CAM.neuerMob(bossDef.fam, lv);
    const n = members.length;
    boss.mhp = Math.floor(boss.mhp * 4 * (1 + 0.85 * (n - 1))); boss.hp = boss.mhp; boss.atk = Math.floor(boss.atk * 1.1);
    boss.moves = boss.moves.filter(id => !CAM.MOVES[id].heal).slice(0, 3).concat([CAM.EL_ZORN[f.el]]);
    dexSet(bossDef.fam, 1);
    const pn = i => i === S.idx ? S.name : ((S.peers.get(i) || {}).name || 'Spieler');
    const actors = members.map(i => ({ id: 'p' + i, name: pn(i), side: 0, ctrl: i === S.idx ? 'local' : 'remote', team: teams[i] }));
    actors.push({ id: 'boss', name: bossDef.n, side: 1, ctrl: 'ai', team: [boss], boss: true });
    const res = await K.starten({
      kind: 'raid', actors, localId: 'p' + S.idx, seed: d.seed, weather: d.w || 'klar', biome: bs.biome, bid: d.bid, timer: 40,
      senden: m => Netz.senden(m), beutel, verbrauch: k => CAM.itemAdd(k, -1),
      intro: bossDef.n + ' (Stufe ' + lv + ') erhebt sich!',
    });
    const b = res.b; nachbereiten(S.save.team);
    const lines = [];
    if (b.over && b.winner === 0) {
      UI.snd('sieg');
      S.save.bossT[d.boss] = Date.now();
      const la = b.actor('p' + S.idx);
      lines.push('<b style="color:#ffd54a">' + esc(bossDef.n) + ' ist besiegt!</b>');
      lines.push(...await xpVerteilen(b, la));
      const gold = 150 + lv * 25; S.save.gold += gold; lines.push('Beute: ' + ge(gold));
      CAM.itemAdd('siegel2', 2); lines.push('2 × Starke Fangkugel');
      if (Math.random() < 0.3) { CAM.itemAdd('ei', 1); lines.push('<b style="color:#ffb36b">Ein Drachenei!</b> Trag es 600 Schritte mit dir, dann schlüpft etwas.'); }
      if (Math.random() < 0.12) { CAM.itemAdd('siegel3', 1); lines.push('<b>Meister-Fangkugel!</b>'); }
      if (Math.random() < 0.25) {
        const z = CAM.neuerMob(bossDef.fam, Math.max(10, lv - 4)); const wo = A.mobDazu(z); dexSet(bossDef.fam, 2);
        lines.push('<b style="color:#c9a6ff">' + esc(bossDef.n) + ' lässt sich zähmen und schliesst sich dir an!</b> ' + (wo === 'box' ? '(im Zwinger)' : wo ? '' : '(Zwinger voll)'));
      }
    }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.over && b.winner === 1) { await verloren('Der Riese war zu stark.'); return; }
    if (lines.length) await UI.info(lines.join('<br>'), 'Raid geschafft!');
  };
})(window);
