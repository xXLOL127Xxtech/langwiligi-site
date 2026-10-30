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
  const tagEl = el => '<span class="tag" style="background:' + CAM.EL_FARBE[el] + '">' + (CAM.Icons ? CAM.Icons.el(el, 12) : '') + el + '</span>';
  const tagRar = r => '<span class="tag" style="background:' + CAM.RAR_FARBE[r] + '">' + CAM.RARITAET[r] + '</span>';
  function elTags(m) { return CAM.elemente(m).map(tagEl).join(''); }
  function mobNameFull(m) { return CAM.name(m) + (m.glanz ? ' ✦' : ''); }
  // Kleines Bild des Mobs vor dem Namen (überall in Listen)
  function mobBild(m, px) { const c = CAM.spriteMit(m); return '<img src="' + (c._url || (c._url = c.toDataURL())) + '" width="' + px + '" height="' + px + '" style="image-rendering:pixelated;vertical-align:middle;margin:-6px 8px -6px 0">'; }
  function mobZeile(m) { return mobBild(m, 36) + esc(mobNameFull(m)) + ' <small style="color:#a9a59b">Lv ' + m.lv + '</small>'; }
  function lpText(m) { return m.hp <= 0 ? '<span style="color:#ff6b5e">besiegt</span>' : m.hp + '/' + m.mhp + ' LP'; }
  function spriteImg(m, px) { const c = CAM.spriteMit(m); return '<img src="' + (c._url || (c._url = c.toDataURL())) + '" width="' + px + '" height="' + px + '" style="image-rendering:pixelated">'; }
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
  // Anfängerschutz: Bis Stufe 10 verlierst du bei einer Niederlage nur 20 % des Goldes und keine Erfahrung
  const ANFAENGER = 10;
  const anfaenger = () => CAM.maxLv() < ANFAENGER;
  function verlierGold() { const v = Math.floor(S.save.gold * (anfaenger() ? 0.2 : 0.8)); S.save.gold -= v; return v; }
  // Überfall: Der Räuber nimmt 100 Gold (hat das Opfer unter 150 Gold, 70 % davon)
  const raub = g => g < 150 ? Math.floor(g * 0.7) : 100;
  // Niederlage: 10 % der Erfahrung, die für die aktuelle Stufe nötig ist, gehen bei jedem Mob im Team verloren (nie unter 0, keine Stufe weniger)
  function verlierXp() { S.save.team.forEach(m => { m.xp = Math.max(0, (m.xp || 0) - Math.floor(CAM.xpBedarf(m.lv) * 0.1)); }); }

  // Duelle laufen mit Kopien. Wer verliert, hat danach nur noch die Hälfte der LP.
  A.duellVerloren = function () { S.save.team.forEach(m => { m.hp = Math.min(m.hp, Math.max(1, Math.ceil(m.mhp / 2))); }); };
  A.heileTeam = function () { S.save.team.forEach(m => { m.hp = m.mhp; m.status = null; m.wunden = []; delete m.faintDone; }); };

  // ---------- Heilhaus ----------
  // Mobs werden in einem Heilhaus abgegeben (bezahlt wird sofort) und gepflegt, während du weiterziehst.
  // Fertige Mobs holst du im selben Dorf gratis ab oder in einem anderen Dorf gegen eine Transportgebühr (sie werden dorthin geschickt).
  // Dauer: Stufe 5 etwa 1 Sekunde, Stufe 100 etwa 3 Minuten.
  const dauerText = sek => sek >= 60 ? Math.floor(sek / 60) + ' Min ' + (sek % 60 ? (sek % 60) + ' s' : '') : sek + ' s';
  const hierDorf = () => { const d = Welt.dorfBei(S.x, S.y); if (d) return d.nr; let best = 0, bd = 1e9; Welt.alleDoerfer().forEach(d2 => { const dd = Math.hypot(d2.x - S.x, d2.y - S.y); if (dd < bd) { bd = dd; best = d2.nr; } }); return best; };
  const pflegeListe = () => S.save.pflege || (S.save.pflege = []);
  const transportGebuehr = (e, hier) => { if (e.dorf === hier) return 0; const a = Welt.dorfNr(e.dorf), b = Welt.dorfNr(hier); return Math.max(5, Math.round(5 + Math.hypot(a.x - b.x, a.y - b.y) / 8 + e.m.lv * 1.5)); };
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
        { label: 'Mobs abholen', sub: abholText(pf, jetzt), disabled: !pf.length },
        { label: 'Zwinger öffnen', sub: S.save.box.length + ' / 100' }, { label: 'Tschüss' }],
        { title: 'Heilhaus ' + Welt.dorfNr(hier).name, sub: 'Du hast ' + S.save.gold + ' Gold.\nAbholen: hier gratis, in einem anderen Dorf gegen Gebühr.', start,
          live: () => { const p2 = pflegeListe(); return [null, null, { sub: abholText(p2, Date.now()), disabled: !p2.length }]; } });
      if (r === 0) { start = 0; A.alleHeilen(hier, plan); }
      else if (r === 1) { start = 1; await A.mobHeilen(hier); }
      else if (r === 2) { start = 2; await A.mobAbholen(hier); }
      else if (r === 3) { start = 3; await A.zwinger(); }
      else return;
    }
  };
  // Alle verletzten Mobs auf einmal abgeben. Mindestens ein Mob bleibt im Team bei dir.
  // Text für «Mobs abholen»: läuft live herunter, sobald jemand fertig ist, steht es da
  function abholText(pf, jetzt) {
    if (!pf.length) return 'niemand in Pflege';
    const fertig = pf.filter(e => e.ende <= jetzt).length, offen = pf.filter(e => e.ende > jetzt).map(e => Math.ceil((e.ende - jetzt) / 1000));
    const naechster = offen.length ? 'nächster in ' + dauerText(Math.min.apply(null, offen)) : '';
    return (fertig ? '<b style="color:#7ee08f">' + fertig + ' fertig, zum Entnehmen wählen</b>' : '') + (fertig && naechster ? ' · ' : '') + naechster;
  }
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
    // Das Team mit gesunden Mobs aus dem Zwinger auffüllen, damit du weiterziehen kannst
    for (let i = 0; i < S.save.box.length && S.save.team.length < CAM.TEAM_MAX;) { if (S.save.box[i].hp > 0) S.save.team.push(S.save.box.splice(i, 1)[0]); else i++; }
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
      const r = await UI.choose(items, { title: 'Welchen Mob abgeben?', sub: 'Du hast ' + S.save.gold + ' Gold.', start, numbers: false, wide: true });
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
      const info = e => {
        const jetzt2 = Date.now(), rest = Math.ceil((e.ende - jetzt2) / 1000), fee = transportGebuehr(e, hier), ort = Welt.dorfNr(e.dorf).name;
        const sub = rest > 0 ? '<span class="chip warn">noch ' + dauerText(rest) + '</span> Heilhaus ' + ort : e.dorf === hier ? '<span class="chip gut">fertig</span> gratis entnehmen' : '<span class="chip gut">fertig</span> in ' + ort + ' · Transport ' + ge(fee);
        return { sub, disabled: rest > 0 || S.save.gold < fee };
      };
      const items = pf.map(e => Object.assign({ label: mobZeile(e.m) + tagRar(CAM.FAMILIEN[e.m.fam].rar) }, info(e)));
      const r = await UI.choose(items, { title: 'Mobs abholen', sub: 'Du hast ' + S.save.gold + ' Gold. Anderes Dorf: mit Transportgebühr.', start, numbers: false, wide: true, live: () => pf.map(info) });
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
    if (S.save.gold < o.preis) { UI.toast('Nicht genug Gold.'); return; }
    if (S.save.team.length >= CAM.TEAM_MAX && S.save.box.length >= 100) { await UI.info('Team und Zwinger sind voll.', 'Zurückkaufen'); return; }
    S.save.gold -= o.preis; S.save.verkauft.splice(r, 1);
    const wo = A.mobDazu(o.m); UI.snd('geld'); Save.speichern();
    UI.toast(mobNameFull(o.m) + (wo === 'box' ? ' wartet im Zwinger.' : ' ist wieder im Team.'), 2500);
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
    const dorfs = S.save.besucht.map(i => Welt.dorfNr(i));
    const items = dorfs.map(d => ({ label: d.name, sub: CAM.BIOME[d.biome].n }));
    const r = await UI.choose(items, { title: 'Wegstein', sub: 'Reise zu einem Dorf, das du schon besucht hast.' });
    if (r < 0) return;
    const d = dorfs[r];
    S.x = d.x + 0.5; S.y = d.y + 3.5; S.dir = 2; S.schritte = 0; Save.speichern();
    UI.snd('ruf');
  };
  A.dorfBesucht = function (d) {
    if (!S.save.besucht.includes(d.nr)) { S.save.besucht.push(d.nr); UI.toast('Neues Dorf entdeckt: ' + d.name + '. Der Wegstein dort führt jetzt hierher.', 4000); Save.speichern(); }
  };

  // ---------- Team, Zwinger, Beutel, Buch, Karte ----------
  A.mobDetails = async function (m) {
    const f = CAM.FAMILIEN[m.fam];
    const need = CAM.xpBedarf(m.lv);
    const moves = CAM.alleAttacken(m).map(x => { const mv = CAM.moveFuer(m, x.id); return x.ok ? '<tr><td>' + esc(mv.n) + '</td><td>' + tagEl(mv.el) + '</td><td>' + (CAM.moveChips(mv) || '–') + '</td></tr>' : '<tr style="opacity:.38"><td>' + esc(mv.n) + '</td><td>' + tagEl(mv.el) + '</td><td><span style="color:#ff5c5c">ab Stufe ' + x.lv + '</span> · ' + (CAM.moveChips(mv) || '–') + '</td></tr>'; }).join('');
    const html = '<div class="row" style="align-items:flex-start">' + spriteImg(m, 112) + '<div style="flex:1"><p><b style="font-size:17px">' + esc(mobNameFull(m)) + '</b> <small>Lv ' + m.lv + (m.nick ? ' · ' + esc(CAM.artName(m)) : '') + '</small><br>' + elTags(m) + tagRar(f.rar) + '</p>' +
      '<p>LP ' + m.hp + '/' + m.mhp + ' · Angriff ' + m.atk + ' · Verteidigung ' + m.def + ' · Tempo ' + m.spd + '</p>' + (A.bonusText(m) ? '<p style="color:#c9a6ff"><small>Verbessert: ' + esc(A.bonusText(m)) + '</small></p>' : '') +
      '<div class="bar"><i style="width:' + Math.min(100, Math.round(m.xp / need * 100)) + '%;background:#8a3ffc"></i></div><small style="color:#a9a59b">Erfahrung ' + m.xp + ' / ' + need + (f.stufen > 1 && m.stufe < 3 ? ' · entwickelt sich auf Stufe ' + CAM.EVO_LV[m.stufe - 1] : '') + '</small></div></div>' +
      '<table><tr><th>Attacke</th><th>Element</th><th>Wirkung</th></tr>' + moves + '</table>' + (() => { const n = CAM.naechsteAttacke(m); return '<p><small style="color:#a9a59b">' + (n ? 'Nächste Attacke bei Stufe ' + n.lv + ' · ' : '') + m.moves.length + ' von höchstens 6 Attacken' + (CAM.runeMoeglich(m) ? '' : '') + '</small></p>'; })();
    await UI.info(html, 'Mob-Details');
  };
  // Eigenen Namen für einen Mob vergeben (leer lassen = wieder der Name der Art)
  A.umbenennen = function (m) {
    return new Promise(res => {
      const host = UI.openPanel('Mob umbenennen', 'Art: ' + CAM.artName(m) + ' · höchstens 14 Zeichen. Leer lassen für den Originalnamen.');
      host.innerHTML = '<div style="text-align:center;margin:6px 0">' + spriteImg(m, 96) + '</div><input type="text" id="nm-t" maxlength="14" spellcheck="false" style="width:100%;box-sizing:border-box" value="' + esc(m.nick || '') + '" placeholder="' + esc(CAM.artName(m)) + '"><div class="row" style="margin-top:12px"><button class="btn" id="nm-ok">Speichern</button><button class="btn alt" id="nm-x">Abbrechen</button></div>';
      const t = $('nm-t'); t.focus(); t.select();
      const fertig = ok => {
        if (ok) { const v = t.value.replace(/[<>&"]/g, '').trim().slice(0, 14); if (v && v !== CAM.artName(m)) m.nick = v; else delete m.nick; Save.speichern(); }
        UI.closePanel(); res();
      };
      $('nm-ok').onclick = () => fertig(true); $('nm-x').onclick = () => fertig(false);
      t.addEventListener('keydown', e => { if (e.key === 'Enter') fertig(true); else if (e.key === 'Escape') fertig(false); e.stopPropagation(); });
    });
  };
  A.teamMenue = async function () {
    let start = 0;
    for (;;) {
      const t = S.save.team;
      const items = t.map(m => ({ label: mobZeile(m) + elTags(m), sub: lpText(m) }));
      const r = await UI.choose(items, { title: 'Dein Team', sub: (() => { const sy = CAM.synergien(t).liste; return sy.length ? 'Teamgeist: ' + sy.map(x => x.n + ' (' + x.text + ')').join(' · ') : 'Teamgeist: keiner. Mische Elemente, z. B. Feuer + Pflanze.'; })(), start, wide: true });
      if (r < 0) return;
      start = r;
      const m = t[r];
      const w = await UI.choose([{ label: 'Details ansehen' }, { label: 'Umbenennen' }, { label: 'Verbessern', sub: CAM.UPG.some(k => S.save.items[k]) ? '' : 'keine Veredler' }, { label: 'Nach vorne stellen', disabled: r === 0 }, { label: 'In den Zwinger', disabled: t.length <= 1 || S.save.box.length >= 100 }, { label: 'Zurück' }], { title: mobNameFull(m) });
      if (w === 0) await A.mobDetails(m);
      else if (w === 1) await A.umbenennen(m);
      else if (w === 2) await A.veredeln(m);
      else if (w === 3) { t.splice(r, 1); t.unshift(m); start = 0; }
      else if (w === 4) { if (t.filter(x => x !== m && x.hp > 0).length) { t.splice(r, 1); S.save.box.push(m); start = 0; } else await UI.info('Du brauchst mindestens einen kampffähigen Mob im Team.'); }
    }
  };
  // Zwinger: links die Mobs im Zwinger, rechts dein Team. Mob wählen (Enter), dann in der anderen Spalte Enter drücken: tauschen oder verschieben.
  A.zwinger = function () {
    return new Promise(res => {
      const MAX = CAM.TEAM_MAX; let host = UI.openPanel('Zwinger', '', true);
      let col = S.save.box.length ? 0 : 1, cur = [0, 0], pick = null, toast = '';
      const t0 = performance.now();
      const box = () => S.save.box, team = () => S.save.team;
      const laenge = c => c === 0 ? box().length + 1 : MAX;   // links: Mobs + «Hier ablegen», rechts: feste Plätze
      const mobAt = (c, i) => c === 0 ? box()[i] : team()[i];
      const kann = () => team().some(m => m.hp > 0);
      function aktion() {
        const m = mobAt(col, cur[col]);
        if (!pick) { if (m) pick = { col, i: cur[col] }; else toast = 'Wähle zuerst einen Mob aus.'; return; }
        if (pick.col === col) {
          if (pick.i === cur[col]) pick = null; else if (m) pick = { col, i: cur[col] };
          return;
        }
        const bi = pick.col === 0 ? pick.i : cur[0], ti = pick.col === 1 ? pick.i : cur[1];
        const bm = box()[bi], tm = team()[ti];
        const alt = { box: box().slice(), team: team().slice() };
        if (bm && tm) { team()[ti] = bm; box()[bi] = tm; }                                       // tauschen
        else if (bm && !tm) { team().push(bm); box().splice(bi, 1); }                              // in einen freien Platz
        else if (!bm && tm) { if (team().length <= 1) { toast = 'Dein letzter Mob muss im Team bleiben.'; pick = null; return; } team().splice(ti, 1); box().push(tm); }   // in den Zwinger
        if (!kann()) { S.save.box = alt.box; S.save.team = alt.team; toast = 'Dein Team braucht mindestens einen kampffähigen Mob.'; pick = null; return; }
        pick = null; UI.snd('heil'); Save.speichern(); toast = '';
        cur[0] = Math.min(cur[0], Math.max(0, box().length)); cur[1] = Math.min(cur[1], MAX - 1);
      }
      function zeichne() {
        const spalte = c => {
          let h = '';
          const n = c === 0 ? box().length : MAX;
          for (let i = 0; i < n; i++) {
            const m = mobAt(c, i), cl = ['it'];
            if (c === col && cur[c] === i) cl.push('sel'); else if (cur[c] === i) cl.push('cur');
            if (pick && pick.col === c && pick.i === i) cl.push('gew');
            h += '<button class="' + cl.join(' ') + '" data-c="' + c + '" data-i="' + i + '">' + (m
              ? '<span class="lb">' + (c === 1 ? '<small style="color:#8e89a8">' + (i + 1) + '</small> ' : '') + mobZeile(m) + elTags(m) + (pick && pick.col === c && pick.i === i ? ' <span class="chip warn">gewählt</span>' : '') + '</span><span class="sb">' + lpText(m) + (c === 1 && i === 0 ? ' · <b style="color:#ffd54a">vorne</b>' : '') + '</span>'
              : '<span class="lb" style="color:#8e89a8">' + (c === 1 ? '<small>' + (i + 1) + '</small> freier Platz' : '') + '</span>') + '</button>';
          }
          if (c === 0) { const i = n, cl = ['it', 'leer']; if (c === col && cur[0] === i) cl.push('sel'); else if (cur[0] === i) cl.push('cur'); h += '<button class="' + cl.join(' ') + '" data-c="0" data-i="' + i + '"><span class="lb" style="color:#cfc9e0">' + CAM.Icons.html('box', 20) + (pick && pick.col === 1 ? '<b>Hier in den Zwinger legen</b>' : (box().length ? '+ Teammitglied in den Zwinger legen' : 'Zwinger ist leer: Teammitglied hier ablegen')) + '</span></button>'; }
          return h;
        };
        host.innerHTML = '<div class="zw"><div class="zc"><h3>' + CAM.Icons.html('box', 20) + 'Zwinger <small>' + box().length + ' / 100</small></h3><div class="zl" id="zl0">' + spalte(0) + '</div></div>' +
          '<div class="zc"><h3>' + CAM.Icons.html('ball', 20, 'r') + 'Team <small>' + team().length + ' / ' + MAX + '</small></h3><div class="zl" id="zl1">' + spalte(1) + '</div></div></div>' +
          '<div class="zt">' + (toast ? '<span class="chip schlecht">' + esc(toast) + '</span>' : (pick ? 'Jetzt in der <b>' + (pick.col === 0 ? 'Team-Spalte (rechts)' : 'Zwinger-Spalte (links)') + '</b> Enter drücken: ' + (pick.col === 0 ? 'in einen Platz oder mit einem Teammitglied tauschen' : 'mit einem Zwinger-Mob tauschen oder ablegen') + '.' : 'Mob mit <kbd>Enter</kbd> wählen, dann in der anderen Spalte <kbd>Enter</kbd> zum Tauschen. Zum Ablegen ein Teammitglied wählen und unten links «in den Zwinger legen» wählen.')) + '</div>' +
          '<div class="zt"><kbd>←</kbd><kbd>→</kbd> Spalte · <kbd>↑</kbd><kbd>↓</kbd> Mob · <kbd>I</kbd> Details · <kbd>U</kbd> Umbenennen · <kbd>Esc</kbd> Zurück</div>';
        host.querySelectorAll('.it').forEach(b => {
          b.onmouseenter = b.onmousemove = () => { if (!UI.mausSeit(t0) || (col === +b.dataset.c && cur[col] === +b.dataset.i)) return; col = +b.dataset.c; cur[col] = +b.dataset.i; markiere(); };
          b.onclick = () => { col = +b.dataset.c; cur[col] = +b.dataset.i; UI.snd('klick'); aktion(); zeichne(); };
        });
        const s = host.querySelector('.it.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
      }
      function markiere() { host.querySelectorAll('.it').forEach(b => { const c = +b.dataset.c, i = +b.dataset.i; b.classList.toggle('sel', c === col && cur[c] === i); b.classList.toggle('cur', !(c === col && cur[c] === i) && cur[c] === i); }); }
      const h = async e => {
        const k = e.key;
        if (k === 'ArrowDown' || k === 's' || k === 'S') { cur[col] = (cur[col] + 1) % laenge(col); UI.snd('tick'); toast = ''; zeichne(); }
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') { cur[col] = (cur[col] + laenge(col) - 1) % laenge(col); UI.snd('tick'); toast = ''; zeichne(); }
        else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'A' || k === 'd' || k === 'D' || k === 'Tab') { col = 1 - col; UI.snd('tick'); zeichne(); }
        else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') { UI.snd('klick'); aktion(); zeichne(); }
        else if (k === 'Escape' || k === 'Backspace' || k === 'q' || k === 'Q') { if (pick) { pick = null; zeichne(); } else { UI.popKeys(h); UI.closePanel(); res(); } }
        else if (k === 'i' || k === 'I' || k === 'u' || k === 'U') {
          const m = mobAt(col, cur[col]); if (!m) return true;
          UI.popKeys(h);
          if (k === 'i' || k === 'I') await A.mobDetails(m); else await A.umbenennen(m);
          Save.speichern(); host = UI.openPanel('Zwinger', '', true); UI.pushKeys(h); zeichne();
        }
        return true;
      };
      UI.pushKeys(h); zeichne();
    });
  };
  A.beutelMenue = async function () {
    for (;;) {
      const keys = Object.keys(S.save.items).filter(k => CAM.ITEMS[k]);
      if (!keys.length) { await UI.info('Dein Beutel ist leer.', 'Beutel'); return; }
      const items = keys.map(k => { const it = CAM.ITEMS[k]; const nutz = it.heil || it.beleb || it.heilStatus || it.upg || it.rune; return { label: it.n + ' × ' + S.save.items[k], sub: it.info, disabled: !nutz }; });
      const r = await UI.choose(items, { title: 'Beutel', sub: 'Gold: ' + S.save.gold, numbers: false });
      if (r < 0) return;
      const k = keys[r], it = CAM.ITEMS[k];
      if (it.upg) { await A.veredeln(); continue; }
      if (it.rune) { await A.rune(); continue; }
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
        label: '<small style="color:#8e89a8">' + String(i + 1).padStart(2, '0') + '</small> ' + (f.spezial ? '<span style="color:#ffb36b">★</span> ' : '') + (dex[i] ? mobBild({ fam: i, stufe: 1 }, 36) + esc(f.n[f.n.length - 1] === f.n[0] ? f.n[0] : f.n.join(' › ')) : '???'),
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
      const host = UI.openPanel('Weltkarte', 'Orange = Arena (grün = Abzeichen), Rot = Riese, Gelb = besuchtes Dorf, grüne Punkte = Spieler in der Nähe, Weiss = du', true);
      host.innerHTML = '<canvas id="kc" width="560" height="560" style="position:static;width:min(560px,60vh);height:min(560px,60vh);border-radius:8px;image-rendering:pixelated;display:block;margin:auto"></canvas><div class="foot">Plus / Minus oder Klick = Zoom · Schliessen mit M, Esc oder Enter<br>Nur was du schon gesehen hast, ist eingezeichnet.</div>';
      const cv = $('kc'), c = cv.getContext('2d');
      const SPANNEN = [1024, 2048, Welt.W];
      let si = 0, alive = true;
      const draw = () => {
        if (!alive) return;
        const span = SPANNEN[si], sc = 560 / span, k = Welt.karte.width / Welt.W;
        const x0 = Math.max(0, Math.min(Welt.W - span, S.x - span / 2)), y0 = Math.max(0, Math.min(Welt.H - span, S.y - span / 2));
        const px = x => (x - x0) * sc, py = y => (y - y0) * sc, drin = (x, y) => x >= x0 - 8 && y >= y0 - 8 && x < x0 + span + 8 && y < y0 + span + 8;
        c.fillStyle = '#0b0a14'; c.fillRect(0, 0, 560, 560);
        c.imageSmoothingEnabled = false; c.drawImage(Welt.karte, x0 * k, y0 * k, span * k, span * k, 0, 0, 560, 560);
        c.font = '700 11px system-ui'; c.textAlign = 'center';
        const doerfer = new Map(); Welt.alleDoerfer().forEach(d => doerfer.set(d.nr, d)); S.save.besucht.forEach(i => doerfer.set(i, Welt.dorfNr(i)));
        for (const d of doerfer.values()) {
          if (!drin(d.x, d.y)) continue;
          const kn = S.save.besucht.includes(d.nr), g = span > 2500 ? 3 : 4;
          if (!kn && d.aussen) continue;
          c.fillStyle = kn ? '#ffd54a' : 'rgba(255,255,255,.35)'; c.fillRect(px(d.x) - g, py(d.y) - g, g * 2, g * 2);
          if (kn && span < 2500) { c.fillStyle = '#000'; c.fillText(d.name, px(d.x) + 1, py(d.y) - 8); c.fillStyle = '#fff'; c.fillText(d.name, px(d.x), py(d.y) - 9); }
        }
        c.fillStyle = '#ff6a5e'; for (const b of Welt.boss) if (drin(b.x, b.y)) c.fillRect(px(b.x) - 3, py(b.y) - 3, 6, 6);
        for (const a of Welt.arena) { if (!drin(a.cx, a.cy)) continue; c.fillStyle = (S.save.abz || []).includes(a.idx) ? '#5fd38a' : '#ff9f1c'; c.fillRect(px(a.cx) - 4, py(a.cy) - 4, 8, 8); c.strokeStyle = '#000'; c.strokeRect(px(a.cx) - 4, py(a.cy) - 4, 8, 8); }
        c.fillStyle = '#5fd38a'; for (const b of CAM.Bots.liste) if (drin(b.x, b.y) && Math.hypot(b.x - S.x, b.y - S.y) < 200) { c.beginPath(); c.arc(px(b.x), py(b.y), 3, 0, 6.3); c.fill(); }
        for (const p of S.peers.values()) { if (!drin(p.x, p.y)) continue; c.fillStyle = (S.pt >= 0 && p.pt === S.pt) ? '#ffd54a' : '#9a96a8'; c.beginPath(); c.arc(px(p.x), py(p.y), 4, 0, 6.3); c.fill(); if (S.pt >= 0 && p.pt === S.pt) { c.fillStyle = '#fff'; c.fillText(p.name, px(p.x), py(p.y) - 7); } }
        c.fillStyle = '#fff'; c.beginPath(); c.arc(px(S.x), py(S.y), 5, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.stroke();
        c.fillStyle = 'rgba(8,6,16,.7)'; c.fillRect(6, 6, 120, 20); c.fillStyle = '#f2efe8'; c.textAlign = 'left'; c.fillText('Ausschnitt ' + span + ' Felder', 12, 20); c.textAlign = 'center';
        requestAnimationFrame(draw);
      };
      draw();
      cv.addEventListener('click', () => { si = (si + 1) % SPANNEN.length; });
      const h = e => {
        if (['m', 'M', 'Escape', 'Enter', ' ', 'q'].includes(e.key)) { alive = false; UI.popKeys(h); UI.closePanel(); res(); }
        else if (e.key === '+' || e.key === '=') si = Math.max(0, si - 1);
        else if (e.key === '-' || e.key === '_') si = Math.min(SPANNEN.length - 1, si + 1);
        return true;
      };
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
      // Team (T) und Beutel (I) haben unten links eigene Knöpfe
      const items = [{ label: 'Mob-Buch' }, { label: 'Karte', sub: 'M' }];
      if (S.online) items.push({ label: 'Party' });
      items.push({ label: 'Spielstand-Code' }, { label: 'Optionen' }, { label: 'Zum Titelmenü' });
      const labels = items.map(i => i.label);
      const r = await UI.choose(items, { title: 'Menü', sub: S.name + ' · ' + S.save.gold + ' Gold · ' + S.save.team.length + '/' + CAM.TEAM_MAX + ' im Team', numbers: false });
      if (r < 0) return;
      const l = labels[r];
      if (l === 'Mob-Buch') await A.buch();
      else if (l === 'Karte') await A.karte();
      else if (l === 'Party') await A.partyMenue();
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
    const anz = Math.max(tr.anz, Math.min(CAM.TEAM_MAX, S.save.team.length));   // gleich viele Mobs wie du, mindestens seine eigenen
    for (let i = 0; i < anz; i++) {
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
      while (m.xp >= CAM.xpBedarf(m.lv) && m.lv < 100) {
        m.xp -= CAM.xpBedarf(m.lv);
        const altS = m.stufe, altMhp = m.mhp, altAtk = m.atk, altDef = m.def, altSpd = m.spd, altN = CAM.name(m), altMoves = m.moves.slice(), altGel = CAM.gelernt(m);
        m.lv++; CAM.neuBerechnen(m);
        if (m.hp > 0) m.hp += m.mhp - altMhp;
        lines.push('<b style="color:#ffd54a">' + esc(altN) + ' steigt auf Stufe ' + m.lv + '!</b> <small style="color:#5fd38a">LP +' + (m.mhp - altMhp) + ' · Angriff +' + (m.atk - altAtk) + ' · Verteidigung +' + (m.def - altDef) + (m.spd > altSpd ? ' · Tempo +' + (m.spd - altSpd) : '') + '</small>');
        if (m.stufe > altS) lines.push('<b style="color:#c9a6ff">' + esc(altN) + ' entwickelt sich zu ' + esc(CAM.name(m)) + '!</b>');
        CAM.gelernt(m).filter(x => !altGel.includes(x)).forEach(x => lines.push('Neue Attacke: ' + esc(CAM.MOVES[x].n) + ''));
      }
    }
    return lines;
  }
  // modus: 'voll' (Mobs, die du angreifst oder die dich angreifen, Riesen): 80 % Gold (Anfänger 20 %), 10 % Erfahrung (Anfänger keine), Heilhaus.
  //         'mild' (Duell oder Kampf mit Einverständnis, Arena): nichts geht verloren, deine Mobs haben noch 5 LP.
  //         'raub' (Überfall durch NPC): nur die Beute geht verloren (höchstens 100 Gold), deine Mobs haben noch 5 LP.
  async function verloren(titelText, modus) {
    if (modus === 'mild' || modus === 'raub') {
      let text = titelText || 'Dein Team ist erschöpft.';
      if (modus === 'raub') { const g = Math.min(S.save.gold, raub(S.save.gold)); S.save.gold -= g; text += '<br>' + (g ? 'Du wirst bestohlen: ' + ge(g) + ' sind weg.' : 'Du hattest zum Glück nichts dabei.'); }
      S.save.team.forEach(m => { if (m.hp < 5) m.hp = Math.min(5, m.mhp); m.status = null; delete m.faintDone; });
      Save.speichern(); UI.snd('niederlage');
      await UI.info(text + '<br><small>Deine Mobs haben noch 5 LP. Heile sie im Heilhaus.</small>', 'Niederlage');
      return;
    }
    const neu = anfaenger(), v = verlierGold(); if (!neu) verlierXp();
    // zum nächsten Dorf, Mobs heilen
    let best = null, bd = 1e9;
    for (const d of Welt.alleDoerfer()) { const dd = Math.hypot(d.x - S.x, d.y - S.y); if (dd < bd) { bd = dd; best = d; } }
    A.heileTeam(); S.x = best.x + 0.5; S.y = best.y + 3.5; S.schritte = 0; Save.speichern();
    UI.snd('niederlage');
    await UI.info((titelText || 'Dein Team ist erschöpft.') + '<br>Du verlierst ' + ge(v) + (neu ? ' (20 %, Anfängerschutz bis Stufe ' + ANFAENGER + ')' : ' (80 %) und 10 % Erfahrung') + ' und wachst im Heilhaus von <b>' + esc(best.name) + '</b> auf. Alle Mobs sind geheilt.', 'Niederlage');
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
    // Wassertiere, die ganz unter Wasser leben: Du tauchst ab, der Kampf findet unter Wasser statt und die Luft reicht nur 2 Minuten
    const unter = f.lebt === 'wasser' && !!S.schwimmt;
    if (unter) { S.tauch = { t0: performance.now(), dauer: 1300 }; UI.snd('platsch'); await sleep(1500); }
    const res = await K.starten(kampfBasis('wild', { actors: [lokal, wild], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, intro: unter ? intro + ' Du tauchst ab!' : intro, erster: opt.erster, unterwasser: unter }));
    S.tauch = null;
    const b = res.b; nachbereiten(S.save.team);
    if (res.ertrunken) {
      if (opt.entity) opt.entity.ruheBis = Date.now() + 20000;
      A.zumUfer(); Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
      await verloren('Dir ist die Luft ausgegangen! Du tauchst in letzter Sekunde auf und rettest dich ans Ufer.', 'mild');
      return;
    }
    const lines = [];
    if (b.result.caught) {
      const m = b.result.caught; delete m.faintDone; m.status = null;
      const wo = A.mobDazu(m); dexSet(m.fam, 2); S.save.fangXp = (S.save.fangXp || 0) + 0.15; S.save.gef = (S.save.gef | 0) + 1;
      lines.push('<b style="color:#5fd38a">' + esc(mobNameFull(m)) + ' gehört jetzt dir!</b> ' + (wo === 'team' ? '(ins Team aufgenommen)' : wo === 'box' ? '(in den Zwinger gebracht)' : '(Zwinger voll, er wurde freigelassen)'));
    } else if (b.result.fled) lines.push('Du bist entkommen.');
    else if (b.winner === 0) {
      UI.snd('sieg');
      lines.push(...await xpVerteilen(b, b.actor(lokal.id)));
      const gold = 5 + mob.lv * 3; S.save.gold += gold; lines.push('Du findest ' + gold + ' Gold.');
      if (Math.random() < 0.35) { const k = CAM.FUNDE[Welt.biomeAt(S.x, S.y)][Math.floor(Math.random() * 2)]; CAM.itemAdd(k, 1); lines.push('Fundstück: ' + CAM.Icons.item(k, 20) + CAM.ITEMS[k].n); }
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

  // Nächstes Ufer suchen (nach dem Ertrinken)
  A.zumUfer = function () {
    for (let r = 1; r < 60; r++) for (let k = 0; k < 24; k++) {
      const a = k / 24 * 6.2832, x = Math.floor(S.x + Math.cos(a) * r) + 0.5, y = Math.floor(S.y + Math.sin(a) * r) + 0.5;
      if (!Welt.blockiert(x, y) && !Welt.blockiert(x - 0.3, y - 0.2) && !Welt.blockiert(x + 0.3, y + 0.3)) { S.x = x; S.y = y; S.schwimmt = false; return; }
    }
  };

  A.wildMenue = async function (w) {
    const m = w.mob, f = CAM.FAMILIEN[m.fam], boese = CAM.Wilde.boese(m);
    S.save.dex[m.fam] = Math.max(S.save.dex[m.fam] || 0, 1);
    const lust = boese ? '<b style="color:#ff6b5e">Bösartig</b>' : 'Friedlich';
    const r = await UI.choose([{ label: 'Angreifen', sub: CAM.lebend() ? '' : 'Dein Team ist erschöpft', disabled: !CAM.lebend() }, { label: 'In Ruhe lassen' }],
      { title: mobNameFull(m), sub: 'Stufe ' + m.lv + ' · ' + CAM.RARITAET[f.rar], before: '<div class="row">' + spriteImg(m, 96) + '<div>' + elTags(m) + '<p>' + lust + '</p></div></div>', numbers: false });
    if (r === 0) { await A.wildKampf(m, { entity: w, intro: 'Du forderst ' + mobNameFull(m) + ' (Lv ' + m.lv + ') heraus!' }); }
  };

  // Ansprechen eines Trainers (E): erst anschauen, dann entscheiden. Überfälle durch angriffslustige Trainer laufen weiter direkt ohne Menü.
  A.trainerMenue = async function (tr) {
    const anz = Math.max(tr.anz, Math.min(CAM.TEAM_MAX, S.save.team.length)), gold = 30 + tr.lv * 10 * tr.anz;
    const r = await UI.choose([{ label: 'Zum Kampf herausfordern', sub: CAM.lebend() ? 'Belohnung bei Sieg ' + gold + ' Gold' : 'Dein Team ist erschöpft', disabled: !CAM.lebend() }, { label: 'Zurück' }],
      { title: tr.name + ' (Bot)', sub: 'Computer-Trainer · Stufe ' + tr.lv + ' · ' + anz + ' Mobs · kein Einsatz', numbers: false });
    if (r === 0) await A.trainerKampf(tr);
  };

  A.trainerKampf = async function (tr, opt) {
    opt = opt || {};
    if (S.busy || !CAM.lebend()) return false;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    vorbereiten(S.save.team);
    const team = trainerTeam(tr); team.forEach(m => dexSet(m.fam, 1));
    if (opt.erster === 1) await UI.banner('ÜBERFALL!');
    const lokal = { id: 'p' + S.idx, name: S.name, side: 0, ctrl: 'local', team: S.save.team };
    const gegner = { id: 't', name: tr.name, side: 1, ctrl: 'ai', team };
    const res = await K.starten(kampfBasis('trainer', { actors: [lokal, gegner], localId: lokal.id, seed: (Math.random() * 2 ** 31) | 0, intro: opt.erster === 1 ? tr.name + ' überfällt dich!' : tr.name + ' fordert dich heraus!', erster: opt.erster }));
    const b = res.b; nachbereiten(S.save.team);
    const lines = [];
    if (b.winner === 0) {
      UI.snd('sieg'); S.trainerT[tr.id] = Date.now();
      lines.push(...await xpVerteilen(b, b.actor(lokal.id)));
      const gold = 30 + tr.lv * 10 * tr.anz; S.save.gold += gold; lines.push(tr.name + ' bezahlt dir ' + gold + ' Gold.');
    }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.winner === 1) { S.trainerT[tr.id] = Date.now() - TRAINER_PAUSE_MS + 60000; await verloren(opt.erster === 1 ? esc(tr.name) + ' hat dich überfallen und besiegt.' : 'Du wurdest von ' + esc(tr.name) + ' besiegt.', opt.erster === 1 ? 'raub' : 'mild'); return true; }
    if (lines.length) await UI.info(lines.join('<br>'), 'Sieg!');
    return true;
  };

  // ---------- Online: Hilfen ----------
  A.praesenz = function () {
    return { x: Math.round(S.x * 10) / 10, y: Math.round(S.y * 10) / 10, d: S.dir, pt: S.pt, bs: S.busy ? 1 : 0, lv: CAM.maxLv(), ab: CAM.abzMaske(S.save.abz), fg: A.gefangen ? A.gefangen() : 0 };
  };
  A.hallo = function (an, antwort) {
    const m = { t: 'hi', n: S.name, c: S.save.col, w: S.save.w, l: S.save.l, re: !!antwort, ...A.praesenz() };
    if (an !== undefined) m.to = an;
    Netz.senden(m);
  };
  function peer(idx) { return S.peers.get(idx); }
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

  // Online: Handelsfenster. Von der anderen Person kennt man nur die höchste Stufe, ihr Fabelwesen-Einsatz ist immer das vorderste im Team.
  const pOnline = (p) => modus => modus === 'fair' ? 0.5 : Math.max(0.08, Math.min(0.92, 1 / (1 + Math.exp(-(CAM.schnitt(S.save.team) - (p.lv || 1)) * 0.5))));
  const midOnline = p => Math.max(1, Math.round((CAM.schnitt(S.save.team) + (p.lv || 1)) / 2));
  const frontMob = () => S.save.team[0];
  const meineVorne = () => { const m = frontMob(); return m ? [{ m, ort: 'vorderstes im Team', ok: S.save.team.filter(x => x.hp > 0).length >= 2 }] : []; };
  const nachDraht = (o, p) => ({ fair: o.modus === 'fair' ? midOnline(p) : 0, gm: o.goldMe | 0, gt: o.goldThem | 0, mm: o.mobMe ? 1 : 0, mt: o.mobThem ? 1 : 0, mA: o.mobMe ? CAM.name(o.mobMe) + ' Lv ' + o.mobMe.lv : '' });
  const vonDraht = (w, p) => ({ modus: w.fair ? 'fair' : 'echt', goldMe: w.gt | 0, goldThem: w.gm | 0, mobMe: w.mt ? frontMob() : null, mobThem: w.mm ? 'front' : null });
  A.einsatzOnline = async function (p, vorlage, text, annahme) {
    const r = await A.handelFenster({ partner: { name: p.name, lv: p.lv }, offer: vorlage || { modus: 'fair', goldMe: 0, goldThem: 0, mobMe: null, mobThem: null }, p: pOnline(p), mid: midOnline(p), meine: meineVorne(), ihre: null,
      frontText: 'sein vorderstes Fabelwesen', wertFront: 40 + (p.lv || 5) * 12, maxThem: 2000, text: text || ('Höchste Stufe von ' + esc(p.name) + ': ' + (p.lv || '?') + '. ' + esc(p.name) + ' kann annehmen, ablehnen oder ein Gegenangebot machen.'), annahme: !!annahme, senden: vorlage ? 'Gegenangebot senden' : 'Duell anfragen' });
    if (r.aktion === 'abbruch') return null;
    const o = r.offer;
    if (o.goldMe > S.save.gold) { UI.toast('Du hast nicht genug Gold.'); return null; }
    return nachDraht(o, p);
  };

  A.chalSenden = function (idx, o) {
    const t0 = Date.now(), p = S.peers.get(idx);
    A.angebot = { idx, art: 'chal', t: t0, o };
    Netz.senden({ t: 'chal', to: idx, from: S.idx, o });
    setTimeout(() => { if (A.angebot && A.angebot.art === 'chal' && A.angebot.t === t0) { A.angebot = null; UI.toast((p ? p.name : 'Die Person') + ' hat nicht geantwortet.'); } }, 30500);
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
      A.chalSenden(p.idx, o);
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
        Object.assign(p, { idx: von, name: String(d.n || 'Spieler').slice(0, 16), col: d.c | 0, w: d.w | 0, l: d.l | 0, tx: d.x, ty: d.y, dir: d.d | 0, pt: d.pt === undefined ? -1 : d.pt, bs: d.bs, lv: d.lv | 0, ab: d.ab | 0, fg: d.fg | 0, gest: '', gestT: 0 });
        if (p.x === undefined) { p.x = d.x; p.y = d.y; }
        S.peers.set(von, p);
        if (!d.re) A.hallo(von, true);
        break;
      }
      case 'p': {
        const p = S.peers.get(von); if (!p) { A.hallo(von, true); return; }
        p.tx = d.x; p.ty = d.y; p.dir = d.d; p.pt = d.pt; p.bs = d.bs; p.lv = d.lv; p.ab = d.ab | 0; p.fg = d.fg | 0; p.zeit = Date.now();
        break;
      }
      case 'gest': { const p = S.peers.get(von); if (p) { p.gest = CAM.GESTEN[d.g] ? CAM.GESTEN[d.g][0] : ''; p.gestT = Date.now(); } break; }
      case 'st': { const p = S.peers.get(von); if (p) { p.w = d.w | 0; p.l = d.l | 0; } break; }
      case 'act': K.eingang(d); break;
      case 'team': (S.teams[d.bid] = S.teams[d.bid] || {})[d.idx] = { team: d.team, gold: d.gold }; break;
      case 'chal': {
        const p = S.peers.get(von); if (!p) return;
        if (S.busy || !CAM.lebend()) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
        const o = d.o || {}, mein = vonDraht(o, p);
        if (A.angebot && A.angebot.idx === von) A.angebot = null;   // sein Gegenangebot ersetzt mein altes Angebot
        if (mein.goldMe > S.save.gold || (mein.mobMe && S.save.team.filter(m => m.hp > 0).length < 2)) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
        const fa = A.fairness(mein, pOnline(p)(mein.modus), 40 + (p.lv || 5) * 12);
        const txt = (o.fair ? 'Fairer Kampf (alle auf Stufe ' + (o.fair | 0) + ')' : 'Echter Kampf') + '<br>Du setzt: ' + (mein.goldMe ? mein.goldMe + ' Gold' : 'kein Gold') + (mein.mobMe ? ' + ' + esc(CAM.name(S.save.team[0])) : '') +
          ' · ' + esc(p.name) + ' setzt: ' + (mein.goldThem ? mein.goldThem + ' Gold' : 'kein Gold') + (o.mm ? ' + ' + esc(String(o.mA || 'ein Fabelwesen')) : '') +
          '<br>Fairness: ' + (Math.abs(fa.f) < 0.12 ? 'ausgeglichen' : fa.f > 0 ? 'zu deinem Vorteil' : 'zu deinem Nachteil') + ' · ' + esc(p.name) + ' hat höchste Stufe ' + (p.lv | 0);
        const card = UI.addCard('<b>' + esc(p.name) + '</b> fordert dich zum Duell heraus!<br><small>' + txt + '</small>', 30, () => Netz.senden({ t: 'chalr', to: von, ok: true }), () => Netz.senden({ t: 'chalr', to: von, ok: false }), async () => {
          const w = await A.einsatzOnline(p, mein, '<b>' + esc(p.name) + '</b> macht dir diesen Vorschlag.');
          if (!w) { Netz.senden({ t: 'chalr', to: von, ok: false }); return; }
          A.chalSenden(von, w);
        });
        UI.snd('ruf');
        break;
      }
      case 'chalr': {
        if (!A.angebot || A.angebot.art !== 'chal' || A.angebot.idx !== von) return;
        A.angebotO = A.angebot.o; A.angebot = null;
        if (!d.ok) { UI.toast((S.peers.get(von) ? S.peers.get(von).name : 'Die Person') + ' lehnt das Duell ab.'); return; }
        const ao = A.angebotO || {}, pname = S.peers.get(von) ? S.peers.get(von).name : 'Die Person';
        const zus = (ao.fair ? 'Fairer Kampf auf Stufe ' + (ao.fair | 0) : 'Echter Kampf') + ' · Du setzt ' + (ao.gm ? (ao.gm | 0) + ' Gold' : 'kein Gold') + (ao.mm ? ' + ' + esc(String(ao.mA || 'Mob')) : '') + ' · ' + esc(pname) + ' setzt ' + (ao.gt ? (ao.gt | 0) + ' Gold' : 'kein Gold') + (ao.mt ? ' + sein vorderstes Fabelwesen' : '');
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

  // ---------- Duell (3 gegen 3): fairer Kampf = alle auf die vereinbarte Stufe, sonst und beim Überfall echte Stufen ----------
  const gewonnen0 = (b, seite) => b.over && b.winner === seite;
  A.duellStart = async function (d) {
    if (S.busy || !CAM.lebend()) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    const andere = d.a === S.idx ? d.b : d.a, bid = 'd' + d.seed;
    const o = d.o || null, lvl = o ? (o.fair | 0) : 0, ichBinA = d.a === S.idx;
    const meinGold = o ? (ichBinA ? o.gm : o.gt) | 0 : 0, seinGold = o ? (ichBinA ? o.gt : o.gm) | 0 : 0, stake = o && (ichBinA ? o.mm : o.mt) ? S.save.team[0] : null, seinStake = !!(o && (ichBinA ? o.mt : o.mm));
    const mein = CAM.duellKopien(S.save.team, lvl), goldStart = S.save.gold;
    Netz.senden({ t: 'team', bid, idx: S.idx, team: mein, gold: goldStart });
    if (d.amb) await UI.banner('ÜBERFALL!'); else UI.toast('Duell beginnt …', 1500);
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
      if (o && (gewonnen ? seinGold : meinGold)) { if (gewonnen) { const g = seinGold; lines.push('Einsatz: Du bekommst ' + ge(g) + '.'); anwenden.push(() => { S.save.gold += g; }); } else { const z = Math.min(meinGold, S.save.gold); lines.push('Einsatz: Du zahlst ' + ge(z) + '.'); anwenden.push(() => { S.save.gold -= z; }); } }
      if (stake && !gewonnen) { const i = S.save.team.indexOf(stake); if (i >= 0 && S.save.team.length > 1) { lines.push('<b style="color:#ff6b5e">' + esc(CAM.name(stake)) + ' geht an ' + esc(pn(andere)) + '.</b>'); anwenden.push(() => { const k = S.save.team.indexOf(stake); if (k >= 0 && S.save.team.length > 1) { S.save.team.splice(k, 1); Netz.senden({ t: 'prize', to: andere, mob: CAM.kopie(stake) }); } }); } }
      if (seinStake && gewonnen) lines.push('Als Preis bekommst du das Fabelwesen von ' + esc(pn(andere)) + '.');
      if (gewonnen) { lines.push('<b style="color:#5fd38a">Du hast gewonnen!</b>'); UI.snd('sieg'); }
      else { lines.push('<b style="color:#ff6b5e">Du hast verloren.</b><br><small>Deine Mobs haben nur noch die Hälfte der LP.</small>'); UI.snd('niederlage'); }
      if (d.amb) {
        const angreifer = d.a === S.idx;
        if (angreifer && gewonnen) { const g = klau(gegnerTeam.gold); if (g > 0) { lines.push('Beute: Du klaust ' + ge(g) + '.'); anwenden.push(() => { S.save.gold += g; }); } }
        else if (!angreifer && !gewonnen) { const g = klau(goldStart); if (g > 0) { lines.push('Du wirst bestohlen: ' + ge(g) + ' sind weg.'); anwenden.push(() => { S.save.gold = Math.max(0, S.save.gold - g); }); } }
      }
      if (!gewonnen) A.duellVerloren();
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
    const rest = (S.save.bossT[bs.key] || 0) + BOSS_PAUSE_MS - Date.now();
    const party = A.partyListe().filter(p => !p.bs && Math.hypot(p.x - S.x, p.y - S.y) < 30);
    const sub = 'Stufe ' + bs.lv + ' · ' + f.el + (f.el2 ? '/' + f.el2 : '') + '' + (rest > 0 ? '\nDer Riese erholt sich noch ' + Math.ceil(rest / 60000) + ' Min.' : '');
    const items = [{ label: 'Raid starten', sub: party.length ? 'mit ' + party.length + ' aus der Party' : 'allein (schwer!)', disabled: rest > 0 || !CAM.lebend() }, { label: 'Abbrechen' }];
    const r = await UI.choose(items, { title: '⚠ ' + boss.n, sub, before: '<div class="row">' + spriteImg({ fam: boss.fam, stufe: 1 }, 96) + '</div>' });
    if (r !== 0) return;
    if (party.length) await A.raidAnfrage(bs, party); else await A.raidStart({ bid: 'r' + ((Math.random() * 2 ** 31) | 0), boss: bs.idx, bk: bs.key, bm: bs.biome, members: [S.idx], seed: (Math.random() * 2 ** 31) | 0, w: aktuellesWetter(), lv: bs.lv });
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
    const m = { t: 'raidgo', bid, boss: bs.idx, bk: bs.key, bm: bs.biome, members, seed: (Math.random() * 2 ** 31) | 0, w: aktuellesWetter(), lv: bs.lv };
    members.forEach(i => { if (i !== S.idx) Netz.senden(Object.assign({ to: i }, m)); });
    await A.raidStart(m);
  };
  A.raidStart = async function (d) {
    if (K.aktiv) return;
    S.busy = true; Netz.senden({ t: 'p', ...A.praesenz() });
    const bs = Welt.boss.find(b => b.key === d.bk) || null, bossDef = CAM.BOSS[d.boss], f = CAM.FAMILIEN[bossDef.fam];
    const lv = d.lv || (bs && bs.lv) || 10;
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
    boss.moves = f.sig.filter(id => !CAM.MOVES[id].heal).slice(0, 3).concat([CAM.EL_ZORN[f.el]]);   // Riesen setzen von Anfang an alle ihre Attacken ein
    dexSet(bossDef.fam, 1);
    const pn = i => i === S.idx ? S.name : ((S.peers.get(i) || {}).name || 'Spieler');
    const actors = members.map(i => ({ id: 'p' + i, name: pn(i), side: 0, ctrl: i === S.idx ? 'local' : 'remote', team: teams[i] }));
    actors.push({ id: 'boss', name: bossDef.n, side: 1, ctrl: 'ai', team: [boss], boss: true });
    const res = await K.starten({
      kind: 'raid', actors, localId: 'p' + S.idx, seed: d.seed, weather: d.w || 'klar', biome: d.bm !== undefined ? d.bm : (bs ? bs.biome : 0), bid: d.bid, timer: 40,
      senden: m => Netz.senden(m), beutel, verbrauch: k => CAM.itemAdd(k, -1),
      intro: bossDef.n + ' (Stufe ' + lv + ') erhebt sich!',
    });
    const b = res.b; nachbereiten(S.save.team);
    const lines = [];
    if (b.over && b.winner === 0) {
      UI.snd('sieg');
      S.save.bossT[d.bk !== undefined ? d.bk : d.boss] = Date.now();
      const la = b.actor('p' + S.idx);
      lines.push('<b style="color:#ffd54a">' + esc(bossDef.n) + ' ist besiegt!</b>');
      lines.push(...await xpVerteilen(b, la));
      const gold = 150 + lv * 25; S.save.gold += gold; lines.push('Beute: ' + ge(gold));
      CAM.itemAdd('siegel2', 2); lines.push('2 × Starke Fangkugel');
      { const uk = CAM.UPG[Math.floor(Math.random() * CAM.UPG.length)]; CAM.itemAdd(uk, 1); lines.push('<b style="color:#c9a6ff">' + CAM.Icons.item(uk, 20) + 'Veredler: ' + esc(CAM.ITEMS[uk].n) + '</b> <small>(' + esc(CAM.ITEMS[uk].info) + ')</small>'); }
      if (Math.random() < 0.3) { CAM.itemAdd('ei', 1); lines.push('<b style="color:#ffb36b">Ein Drachenei!</b> Trag es 600 Schritte mit dir, dann schlüpft etwas.'); }
      if (Math.random() < 0.12) { CAM.itemAdd('siegel3', 1); lines.push('<b>Meister-Fangkugel!</b>'); }
      if (Math.random() < 0.06) { CAM.itemAdd('rune', 1); lines.push('<b style="color:#ffb36b">Eine Attackenrune!</b> Sehr selten: Ein Mob lernt damit eine zusätzliche Attacke.'); }
      if (Math.random() < 0.25) {
        const z = CAM.neuerMob(bossDef.fam, Math.max(10, lv - 4)); const wo = A.mobDazu(z); dexSet(bossDef.fam, 2);
        lines.push('<b style="color:#c9a6ff">' + esc(bossDef.n) + ' lässt sich zähmen und schliesst sich dir an!</b> ' + (wo === 'box' ? '(im Zwinger)' : wo ? '' : '(Zwinger voll)'));
      }
    }
    Save.speichern(); S.busy = false; Netz.senden({ t: 'p', ...A.praesenz() });
    if (b.over && b.winner === 1) { await verloren('Der Riese war zu stark.', 'voll'); return; }
    if (lines.length) await UI.info(lines.join('<br>'), 'Raid geschafft!');
  };
  A.intern = { vorbereiten, nachbereiten, kampfBasis, xpVerteilen, verloren, dexSet };
})(window);
