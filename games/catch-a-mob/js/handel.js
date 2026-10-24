'use strict';
// Catch a Mob – Handelsfenster für Duelle: Beide Seiten setzen Gold und Fabelwesen, eine Fairness-Anzeige zeigt, wie ausgeglichen das Angebot ist.
// Bots (und online Mitspieler) nehmen an, lehnen ab oder machen Gegenangebote. Auch auf Angebote anderer kann man ein Gegenangebot setzen.
// Angebot aus Sicht von «ich»: { modus: 'fair'|'echt', goldMe, goldThem, mobMe: Mob|null, mobThem: Mob|'front'|null }
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc, S = CAM.S, A = CAM.A, Bots = CAM.Bots, H = A.h, ge = H.ge;
  const wert = m => (m && m !== 'front') ? CAM.mobWert(m) : 0;
  const rund5 = x => Math.max(0, Math.ceil(x / 5) * 5);

  // Fairness: erwarteter Gewinn für mich im Verhältnis zum gesamten Einsatz (-1 bis 1)
  A.fairness = function (o, p, wertFront) {
    const wt = o.mobThem === 'front' ? (wertFront || 120) : wert(o.mobThem);
    const gain = o.goldThem + wt, lose = o.goldMe + wert(o.mobMe), tot = gain + lose;
    return { f: tot ? (p * gain - (1 - p) * lose) / tot : 0, tot, gain, lose };
  };

  // ---------- Fenster ----------
  // cfg: { partner: { name, lv }, offer, p(modus) → 0..1 (meine Siegchance), mid (Stufe im fairen Kampf), meine: [{ m, ort, ok }], ihre: [{ m, ok }] | null (online: nur «vorderstes»),
  //        frontText (online: Name des vordersten Mobs der Gegenseite), wertFront, maxThem, text, annahme (Gegenangebot liegt vor), senden (Beschriftung) }
  A.handelFenster = function (cfg) {
    return new Promise(res => {
      const o = Object.assign({}, cfg.offer);
      const host = UI.openPanel('Handel mit ' + cfg.partner.name, '', true);
      const maxMe = S.save.gold, maxThem = cfg.maxThem === undefined ? 2000 : cfg.maxThem;
      let fertig = false;
      const mobOpt = (liste, aktuell, leer) => '<option value="-1">' + leer + '</option>' + liste.map((x, i) => '<option value="' + i + '"' + (x.m === aktuell ? ' selected' : '') + (x.ok === false ? ' disabled' : '') + '>' + esc(CAM.name(x.m)) + ' Lv ' + x.m.lv + ' · Wert ' + CAM.mobWert(x.m) + ' G' + (x.ort ? ' · ' + x.ort : '') + '</option>').join('');
      function draw() {
        const p = cfg.p(o.modus), fa = A.fairness(o, p, cfg.wertFront);
        const pos = Math.max(2, Math.min(98, 50 + fa.f * 50)), fair = Math.abs(fa.f) < 0.12;
        const urteil = fair ? 'Ausgeglichen' : fa.f > 0 ? 'Zu deinem Vorteil' : 'Zu deinem Nachteil';
        const farbe = fair ? '#5fd38a' : Math.abs(fa.f) < 0.35 ? '#ffd54a' : '#ff6b5e';
        const gold = (id, v, max) => '<div class="row" style="margin:4px 0;gap:4px;flex-wrap:nowrap">' + [-50, -10].map(d => '<button class="btn alt" style="padding:6px 8px;font-size:12px" data-g="' + id + ':' + d + '">' + d + '</button>').join('') +
          '<b style="min-width:62px;text-align:center" class="gold">' + v + ' G</b>' + [10, 50].map(d => '<button class="btn alt" style="padding:6px 8px;font-size:12px" data-g="' + id + ':' + d + '">+' + d + '</button>').join('') + '</div>';
        host.innerHTML =
          '<div style="margin:2px 0 10px"><div style="display:flex;justify-content:space-between;font-size:12px;color:#a9a59b"><span>Nachteil</span><b style="color:' + farbe + '">Fairness: ' + urteil + '</b><span>Vorteil</span></div>' +
          '<div style="position:relative;height:14px;border-radius:7px;background:linear-gradient(90deg,#ff6b5e,#ffd54a 30%,#5fd38a 42%,#5fd38a 58%,#ffd54a 70%,#ff6b5e)"><i style="position:absolute;top:-3px;width:6px;height:20px;border-radius:3px;background:#fff;box-shadow:0 0 4px #000;left:calc(' + pos + '% - 3px)"></i></div>' +
          '<div style="font-size:12px;color:#a9a59b;margin-top:4px">Deine Siegchance ca. ' + Math.round(p * 100) + ' % · Du riskierst ' + fa.lose + ' G, du kannst ' + fa.gain + ' G gewinnen</div></div>' +
          (cfg.text ? '<p style="margin:6px 0;padding:8px 10px;border-radius:9px;background:rgba(138,63,252,.18)">' + cfg.text + '</p>' : '') +
          '<div class="cols"><div><b>Dein Einsatz</b>' + gold('me', o.goldMe, maxMe) +
          '<select data-m="me" style="width:100%">' + mobOpt(cfg.meine, o.mobMe, 'kein Fabelwesen') + '</select></div>' +
          '<div><b>Einsatz von ' + esc(cfg.partner.name) + '</b>' + gold('them', o.goldThem, maxThem) +
          (cfg.ihre ? '<select data-m="them" style="width:100%">' + mobOpt(cfg.ihre, o.mobThem, 'kein Fabelwesen') + '</select>'
            : '<select data-m="them" style="width:100%"><option value="0">kein Fabelwesen</option><option value="1"' + (o.mobThem === 'front' ? ' selected' : '') + '>' + esc(cfg.frontText || 'sein vorderstes Fabelwesen') + '</option></select>') + '</div></div>' +
          '<div class="row"><b>Kampf:</b><select data-modus style="flex:1"><option value="fair"' + (o.modus === 'fair' ? ' selected' : '') + '>Fairer Kampf (alle auf Stufe ' + cfg.mid + ')</option><option value="echt"' + (o.modus === 'echt' ? ' selected' : '') + '>Echter Kampf (Stufen wie sie sind)</option></select></div>' +
          '<div class="row" style="margin-top:12px">' + (cfg.annahme ? '<button class="btn" data-act="annehmen">Angebot annehmen</button>' : '') +
          '<button class="btn' + (cfg.annahme ? ' alt' : '') + '" data-act="senden">' + (cfg.senden || 'Duell anfragen') + '</button><button class="btn alt" data-act="abbruch">Abbrechen</button></div>' +
          '<div class="foot">Mit den Knöpfen änderst du das Gold, mit den Listen wählst du Fabelwesen. Tab wechselt, Enter drückt, Esc bricht ab.</div>';
        host.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
          const [id, d] = b.dataset.g.split(':');
          if (id === 'me') o.goldMe = Math.max(0, Math.min(maxMe, o.goldMe + +d)); else o.goldThem = Math.max(0, Math.min(maxThem, o.goldThem + +d));
          UI.snd('tick'); draw(); const f = host.querySelector('[data-act="senden"]'); if (f) f.focus();
        });
        host.querySelectorAll('select[data-m]').forEach(sel => sel.onchange = () => {
          const v = +sel.value;
          if (sel.dataset.m === 'me') o.mobMe = v >= 0 ? cfg.meine[v].m : null;
          else o.mobThem = cfg.ihre ? (v >= 0 ? cfg.ihre[v].m : null) : (v ? 'front' : null);
          UI.snd('tick'); draw();
        });
        host.querySelector('[data-modus]').onchange = e => { o.modus = e.target.value; UI.snd('tick'); draw(); };
        host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => fin(b.dataset.act));
      }
      function fin(aktion) {
        if (fertig) return; fertig = true; UI.popKeys(key); UI.closePanel(); UI.snd('klick');
        res({ aktion, offer: o });
      }
      const key = e => { if (e.key === 'Escape') { fin('abbruch'); return true; } return false; };
      UI.pushKeys(key);
      draw();
      const b0 = host.querySelector('[data-act="' + (cfg.annahme ? 'annehmen' : 'senden') + '"]'); if (b0) b0.focus();
    });
  };

  // ---------- Bots verhandeln ----------
  // Rückgabe: { ok: true, text } | { ok: false, text } | { counter: Angebot, text }
  Bots.verhandeln = function (b, o, pMe) {
    const wB = m => (m ? CAM.mobWert(m) : 0);
    const ev = oo => { const pB = 1 - pMe(oo.modus), gain = oo.goldMe + wB(oo.mobMe), lose = oo.goldThem + wB(oo.mobThem), tot = gain + lose; return { pB, gain, lose, tot, f: tot ? (pB * gain - (1 - pB) * lose) / tot : 0 }; };
    const oo = Object.assign({}, o), notes = [];
    if (oo.goldThem > b.gold) { oo.goldThem = b.gold; notes.push('So viel Gold habe ich gar nicht, ' + b.gold + ' kann ich setzen.'); }
    if (oo.mobThem && b.team.length < 2) { oo.mobThem = null; notes.push('Mein letztes Fabelwesen setze ich nicht.'); }
    const e = ev(oo), t = -0.05 - 0.2 * b.ego;
    const klein = oo.goldMe <= 50 && oo.goldThem <= 50 && !oo.mobMe && !oo.mobThem;
    if (klein && !notes.length && oo.goldMe + oo.goldThem > 0 && Math.random() < 0.96) return { ok: true, text: e.pB < 0.4 ? 'Für so wenig Gold? Klar, versuchen wir es.' : 'Gerne, die paar Münzen sind es mir wert.' };
    if (!e.tot) return e.pB < 0.2 && Math.random() < 0.4 ? { ok: false, text: 'Das ist mir zu riskant, auch ohne Einsatz.' } : { ok: true, text: 'Okay, nur für die Ehre.' };
    if (e.f >= t) return notes.length ? { counter: oo, text: notes.join(' ') + ' Dann so?' } : { ok: true, text: e.pB < 0.4 ? 'Ich bin überzeugt, dass ich das schaffe. Los!' : e.pB > 0.62 ? 'Gerne, das sieht gut für mich aus.' : 'Okay, versuchen wir es.' };
    if (e.f < -0.75) return { ok: false, text: 'Das ist ein Witz, oder? So ein Angebot nehme ich nicht an.' };
    // Gegenangebot: 1. fairer Kampf, 2. du legst Gold drauf, 3. ich setze weniger
    if (oo.modus === 'echt') {
      const c = Object.assign({}, oo, { modus: 'fair' });
      if (ev(c).f >= t) return { counter: c, text: 'Echte Stufen sind mir zu unsicher. Lass uns fair kämpfen, dann bin ich dabei.' };
    }
    const pB = e.pB, nenner = pB - t;
    if (nenner > 0.05) {
      const x = rund5(((1 - pB) * e.lose - pB * e.gain + t * e.tot) / nenner);
      if (x > 0 && oo.goldMe + x <= S.save.gold && x <= Math.max(50, e.tot * 1.5)) return { counter: Object.assign({}, oo, { goldMe: oo.goldMe + x }), text: 'So ist es mir zu einseitig. Leg ' + x + ' Gold drauf, dann bin ich dabei.' };
    }
    const c = Object.assign({}, oo);
    if (c.mobThem) { c.mobThem = null; if (ev(c).f >= t) return { counter: c, text: 'Mein Fabelwesen gebe ich nicht her. Wie wäre es nur mit dem Gold?' }; }
    const gain = c.goldMe + wB(c.mobMe), L = Math.floor((e.pB * gain - t * gain) / ((1 - e.pB) + t));
    if (L >= 0 && L < c.goldThem) { c.goldThem = Math.floor(L / 5) * 5; return { counter: c, text: c.goldThem > 0 ? 'Mehr als ' + c.goldThem + ' Gold setze ich dagegen nicht.' : 'Ohne eigenen Einsatz von dir setze ich nichts dagegen.' }; }
    return { ok: false, text: e.pB < 0.35 ? 'Das ist mir zu riskant.' : 'Dieser Einsatz steht für mich in keinem guten Verhältnis.' };
  };

  // ---------- Handel mit einem Bot ----------
  A.botHandel = async function (b, start, text0) {
    const eigen = S.save.team, mid = CAM.lvlMitte(eigen, b.team);
    const pF = 100 - CAM.siegChance(b.team, eigen, mid), pE = 100 - CAM.siegChance(b.team, eigen, 0);
    const pMe = modus => (modus === 'fair' ? pF : pE) / 100;
    const meine = S.save.team.map(m => ({ m, ort: 'Team' })).concat(S.save.box.map(m => ({ m, ort: 'Zwinger' })));
    meine.forEach(x => { x.ok = !(x.ort === 'Team' && S.save.team.filter(y => y !== x.m && y.hp > 0).length === 0); });
    const ihre = b.team.map(m => ({ m, ok: b.team.length > 1 }));
    let offer = start || { modus: 'fair', goldMe: 0, goldThem: 0, mobMe: null, mobThem: null }, text = text0 || '', annahme = !!text0 && !!start && start.vomBot;
    for (let runde = 0; runde < 12; runde++) {
      const r = await A.handelFenster({ partner: { name: b.name, lv: b.lv }, offer, p: pMe, mid, meine, ihre, maxThem: b.gold, text, annahme });
      if (r.aktion === 'abbruch') return;
      offer = r.offer; delete offer.vomBot;
      let ok = r.aktion === 'annehmen';
      if (!ok) {
        const v = Bots.verhandeln(b, offer, pMe);
        if (v.counter) { offer = v.counter; text = '<b>' + esc(b.name) + ':</b> «' + esc(v.text) + '»<br><small>Gegenangebot, unten steht jetzt sein Vorschlag.</small>'; annahme = true; UI.snd('ruf'); continue; }
        if (!v.ok) { text = '<b>' + esc(b.name) + ':</b> «' + esc(v.text) + '» <small>(abgelehnt)</small>'; annahme = false; if (Math.random() < 0.15) b.ruheBis = Date.now() + 45000; continue; }
        await UI.info('<b>' + esc(b.name) + ':</b> «' + esc(v.text) + '»', 'Angenommen');
        ok = true;
      }
      if (b.gold < offer.goldThem) { text = esc(b.name) + ' hat nicht mehr genug Gold.'; annahme = false; continue; }
      const zus = (offer.goldMe ? 'Du: ' + offer.goldMe + ' G' : 'Du: kein Gold') + (offer.mobMe ? ' + ' + esc(CAM.name(offer.mobMe)) : '') + ' · ' + esc(b.name) + ': ' + (offer.goldThem ? offer.goldThem + ' G' : 'kein Gold') + (offer.mobThem ? ' + ' + esc(CAM.name(offer.mobThem)) : '');
      if (!await UI.confirm(esc(b.name) + ' ist einverstanden.<br><small>' + zus + '<br>' + (offer.modus === 'fair' ? 'Fairer Kampf auf Stufe ' + mid : 'Echter Kampf') + '</small><br>Kampf jetzt bestätigen?', 'Kampf bestätigen')) { annahme = false; text = ''; continue; }
      await A.botDuell(b, { modus: offer.modus, goldMe: offer.goldMe, goldThem: offer.goldThem, mobA: offer.mobMe, mobB: offer.mobThem }, offer.modus === 'fair' ? mid : 0);
      return;
    }
  };
})(window);
