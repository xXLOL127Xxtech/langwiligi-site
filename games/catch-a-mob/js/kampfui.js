'use strict';
// Catch a Mob – Kampfbildschirm: zeichnet die Szene, fragt Aktionen ab, spielt die Ereignisse der Kampfregeln ab
// und gleicht bei Duellen und Raids die Eingaben mit den anderen Spielern ab.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc;
  const K = CAM.Kampf = { aktiv: null };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let BS = null;
  const BAR_H = 205;

  function mobName(m) { return CAM.name(m) + (m.glanz ? ' ✦' : ''); }

  // ---------- Starten ----------
  // cfg: { kind, actors, localId, seed, weather, biome, bid, senden(msg), timer (Sekunden), intro }
  K.starten = async function (cfg) {
    const b = new CAM.Battle({ kind: cfg.kind, seed: cfg.seed, weather: cfg.weather, actors: cfg.actors });
    BS = { b, cfg, local: cfg.localId, shown: {}, floats: [], proj: null, puffer: {}, weg: new Set(), abbruch: null, t0: performance.now(), ball: null, wartet: false, ende: false };
    K.aktiv = BS;
    K.vorab = (K.vorab || []).filter(m => m.bid === cfg.bid);
    for (const a of b.actors) {
      const m = b.cur(a);
      BS.shown[a.id] = { i: a.active, hp: m.hp, ziel: m.hp, st: m.status ? m.status.t : null, shake: 0, blink: 0, tot: false, fang: 0 };
    }
    $('bbar').classList.remove('hidden');
    $('bmenu').innerHTML = '';
    UI.snd('kampf');
    if (cfg.intro) await UI.say(cfg.intro, 1500);
    try {
      while (!b.over) {
        if (BS.ende) break;
        const la = b.actor(BS.local);
        pump();
        if (b.phase === 'action') {
          if (b.pending().includes(BS.local)) {
            const act = await frageAktion(la);
            b.submit(BS.local, act);
            if (cfg.senden) cfg.senden({ t: 'act', bid: cfg.bid, turn: b.turn, k: 'a', id: BS.local, act });
            if (act.t === 'item' || act.t === 'catch') cfg.verbrauch && cfg.verbrauch(act.item);
          }
        } else if (b.pending().includes(BS.local)) {
          const i = await frageErsatz(la);
          b.submitReplace(BS.local, i);
          if (cfg.senden) cfg.senden({ t: 'act', bid: cfg.bid, turn: b.turn, k: 'r', id: BS.local, act: { t: 'switch', i } });
        }
        await warteBereit();
        if (BS.ende) break;
        const ev = b.resolve();
        await abspielen(ev);
      }
    } finally {
      $('bbar').classList.add('hidden'); $('bmenu').innerHTML = '';
      K.aktiv = null;
    }
    const res = { b, abgebrochen: BS.ende && !b.over };
    BS = null;
    return res;
  };

  // Aktionen anderer Spieler
  K.eingang = function (m) {
    if (!BS || m.bid !== BS.cfg.bid) { (K.vorab = K.vorab || []).push(m); return; }
    BS.puffer[m.turn + ':' + m.k + ':' + m.id] = m.act;
    pump();
  };
  K.spielerWeg = function (idx) { if (BS) BS.weg.add('p' + idx); };
  K.abbrechen = function () { if (BS) { BS.ende = true; if (BS.abbruch) BS.abbruch(); const r = UI.sayResolve; if (r) { UI.sayResolve = null; r(); } } };

  function pump() {
    if (!BS) return;
    const b = BS.b, k = b.phase === 'replace' ? 'r' : 'a';
    if (BS.cfg.bid && K.vorab && K.vorab.length) {
      K.vorab = K.vorab.filter(m => { if (m.bid === BS.cfg.bid) { BS.puffer[m.turn + ':' + m.k + ':' + m.id] = m.act; return false; } return Date.now() - (m.zeit || 0) < 60000 || true; });
    }
    for (const id of b.pending()) {
      if (id === BS.local) continue;
      const key = b.turn + ':' + k + ':' + id;
      if (BS.puffer[key]) { if (k === 'a') b.submit(id, BS.puffer[key]); else b.submitReplace(id, BS.puffer[key].i); delete BS.puffer[key]; }
      else if (BS.weg.has(id)) { if (k === 'a') b.submit(id, { t: 'gone' }); else b.submitReplace(id, -1); }
    }
  }
  async function warteBereit() {
    const b = BS.b; let n = 0;
    while (!b.ready() && !BS.ende) {
      pump(); if (b.ready()) break;
      if (n === 6) { const w = b.pending().map(id => (b.actor(id) || {}).name).filter(Boolean).join(', '); UI.log('Warte auf ' + esc(w) + ' …'); BS.wartet = true; }
      n++; await sleep(100);
    }
    BS.wartet = false;
  }

  // ---------- Abfrage der Aktion ----------
  function gegner(b, a) { return b.foes(a).find(f => f.team[f.active] && f.team[f.active].hp > 0) || b.foes(a)[0]; }
  function effText(mv, tm) {
    if (!mv.pow) return '';
    const e = CAM.effekt(mv.el, CAM.elemente(tm));
    return e > 1 ? ' <b style="color:#5fd38a">sehr effektiv</b>' : e < 1 ? ' <span style="color:#ff6b5e">schwach</span>' : '';
  }
  function tagEl(el) { return '<span class="tag" style="background:' + CAM.EL_FARBE[el] + '">' + el + '</span>'; }

  async function frageAktion(a) {
    const b = BS.b, cfg = BS.cfg;
    const me = b.cur(a), foeA = gegner(b, a), tm = foeA.team[foeA.active];
    let tele = '';
    if (foeA.boss && foeA.plan && foeA.plan.t === 'move') {
      const mv = CAM.MOVES[tm.moves[foeA.plan.i]];
      tele = '⚠ ' + CAM.name(tm) + ' holt zu <b>' + esc(mv.n) + '</b> aus' + (mv.aoe ? ' (trifft alle!)' : '') + '.';
    }
    const wet = b.weather !== 'klar' ? CAM.WETTER[b.weather] + (CAM.WETTER_INFO[b.weather] ? ' – ' + CAM.WETTER_INFO[b.weather] : '') : '';
    let deadline = cfg.timer ? Date.now() + cfg.timer * 1000 : 0, iv = null;
    const zeigeLog = () => {
      const rest = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
      UI.log('Was soll <b>' + esc(mobName(me)) + '</b> tun?' + (deadline ? ' <span id="timer">' + rest + ' s</span>' : ''), [tele, wet && 'Wetter: ' + esc(wet)].filter(Boolean).join('<br>'));
    };
    zeigeLog();
    if (deadline) iv = setInterval(() => { if (Date.now() >= deadline) { if (BS.abbruch) BS.abbruch(); } else if (!BS.sub) zeigeLog(); }, 500);
    const standard = () => ({ t: 'move', i: Math.max(0, me.moves.findIndex(id => CAM.MOVES[id].pow)), target: foeA.id });
    try {
      for (;;) {
        BS.sub = false;
        const items = [{ label: 'Attacke' }, { label: 'Wechseln', disabled: a.team.filter((m, i) => m.hp > 0 && i !== a.active).length === 0 }, { label: 'Beutel', disabled: b.noItems }];
        const fangen = b.kind === 'wild';
        const fliehen = b.kind === 'wild' || (a.fleeFirst && b.turn === 1);
        if (fangen) items.push({ label: 'Fangen' });
        if (fliehen) items.push({ label: 'Fliehen' });
        const labels = items.map(x => x.label);
        const w = await UI.choose(items, { into: $('bmenu'), nocancel: true, cols: 2, abort: f => { BS.abbruch = f; } });
        BS.abbruch = null;
        if (w === -2) return standard();
        const lab = labels[w];
        BS.sub = true;
        if (lab === 'Attacke') {
          const mi = me.moves.map(id => { const mv = CAM.MOVES[id]; return { label: esc(mv.n) + ' ' + tagEl(mv.el), sub: (mv.pow ? 'Stärke ' + mv.pow : mv.heal ? 'Heilt' : '') + effText(mv, tm) }; });
          mi.push({ label: '← Zurück' });
          const r = await UI.choose(mi, { into: $('bmenu'), abort: f => { BS.abbruch = f; } });
          BS.abbruch = null;
          if (r === -2) return standard();
          if (r >= 0 && r < me.moves.length) return { t: 'move', i: r, target: foeA.id };
        } else if (lab === 'Wechseln') {
          const r = await frageMob(a, 'Wer soll kämpfen?', m => m.hp > 0 && m !== me);
          if (r === -2) return standard();
          if (r >= 0) return { t: 'switch', i: r };
        } else if (lab === 'Beutel') {
          const verfuegbar = Object.keys(CAM.ITEMS).filter(k => !CAM.ITEMS[k].fund && !CAM.ITEMS[k].fang && (cfg.beutel()[k] || 0) > 0);
          if (!verfuegbar.length) { UI.log('Du hast nichts Brauchbares im Beutel.'); await sleep(900); zeigeLog(); continue; }
          const ii = verfuegbar.map(k => ({ label: CAM.ITEMS[k].n, sub: '× ' + cfg.beutel()[k] + ' · ' + CAM.ITEMS[k].info }));
          ii.push({ label: '← Zurück' });
          const r = await UI.choose(ii, { into: $('bmenu'), abort: f => { BS.abbruch = f; } });
          BS.abbruch = null;
          if (r === -2) return standard();
          if (r >= 0 && r < verfuegbar.length) {
            const it = CAM.ITEMS[verfuegbar[r]];
            const t = await frageMob(a, 'Bei wem anwenden?', m => it.beleb ? m.hp <= 0 : it.heilStatus ? (m.hp > 0 && m.status) : (m.hp > 0 && m.hp < m.mhp), true);
            if (t === -2) return standard();
            if (t >= 0) return { t: 'item', item: verfuegbar[r], i: t };
          }
        } else if (lab === 'Fangen') {
          const siegel = Object.keys(CAM.ITEMS).filter(k => CAM.ITEMS[k].fang && (cfg.beutel()[k] || 0) > 0);
          if (!siegel.length) { UI.log('Du hast keine Fangsiegel mehr!'); await sleep(900); zeigeLog(); continue; }
          const ii = siegel.map(k => ({ label: CAM.ITEMS[k].n, sub: '× ' + cfg.beutel()[k] }));
          ii.push({ label: '← Zurück' });
          const r = await UI.choose(ii, { into: $('bmenu'), abort: f => { BS.abbruch = f; } });
          BS.abbruch = null;
          if (r === -2) return standard();
          if (r >= 0 && r < siegel.length) return { t: 'catch', item: siegel[r] };
        } else if (lab === 'Fliehen') return { t: 'flee' };
        zeigeLog();
      }
    } finally { if (iv) clearInterval(iv); BS.sub = false; $('bmenu').innerHTML = ''; }
  }

  async function frageMob(a, titel, ok, auchTot) {
    const items = a.team.map((m, i) => ({ label: esc(mobName(m)) + ' <small>Lv ' + m.lv + '</small>' + (m.hp <= 0 ? ' <span style="color:#ff6b5e">besiegt</span>' : ''), sub: m.hp + '/' + m.mhp + ' LP', disabled: !ok(m) }));
    items.push({ label: '← Zurück' });
    UI.log(esc(titel));
    const r = await UI.choose(items, { into: $('bmenu'), abort: f => { BS.abbruch = f; } });
    BS.abbruch = null;
    if (r === -2) return -2;
    return r >= 0 && r < a.team.length ? r : -1;
  }
  async function frageErsatz(a) {
    for (;;) {
      UI.log('<b>' + esc(mobName(BS.b.cur(a))) + '</b> ist besiegt. Wen schickst du als Nächstes?');
      const r = await frageMob(a, 'Wen schickst du als Nächstes?', m => m.hp > 0);
      if (r >= 0) { $('bmenu').innerHTML = ''; return r; }
      if (r === -2) return a.team.findIndex(m => m.hp > 0);
    }
  }

  // ---------- Ereignisse abspielen ----------
  async function abspielen(ev) {
    const b = BS.b;
    for (const e of ev) {
      if (BS.ende) return;
      const s = e.a != null ? BS.shown[e.a] : null;
      switch (e.k) {
        case 'msg':
          if (e.anim) BS.proj = { von: e.anim.a, nach: e.anim.to, el: CAM.MOVES[e.anim.move].el, t0: performance.now(), dauer: 420 };
          await UI.say(e.t, e.anim ? 800 : 1000);
          break;
        case 'hp':
          if (s && s.i === e.i) {
            s.ziel = e.hp;
            if (e.dmg) { s.shake = 420; BS.floats.push({ id: e.a, text: '-' + e.dmg, t0: performance.now(), farbe: '#ff8a7a' }); UI.snd(e.dmg > 40 ? 'stark' : 'treffer'); }
            if (e.t) await UI.say(e.t, 800);
            await sleep(420);
          }
          break;
        case 'heal':
          if (s) { if (s.i === e.i) { s.ziel = e.hp; BS.floats.push({ id: e.a, text: '+', t0: performance.now(), farbe: '#7dffa0' }); } UI.snd('heil'); }
          await UI.say(e.t, 900); await sleep(200);
          break;
        case 'status':
          if (s && s.i === e.i) s.st = e.st;
          await UI.say(e.t, 900);
          break;
        case 'faint':
          if (s && s.i === e.i) { s.tot = true; s.ziel = 0; }
          await UI.say(e.t, 1100);
          break;
        case 'switch': {
          if (s) { s.i = e.i; s.hp = s.ziel = e.hp; s.st = e.st; s.tot = false; s.blink = 600; }
          UI.snd('ruf');
          await UI.say(e.t, 900);
          break;
        }
        case 'shake': {
          BS.ball = { t0: performance.now(), n: e.n, ok: e.ok };
          const foe = b.actors.find(a => a.side === 1);
          await sleep(900 + e.n * 650);
          BS.ball = null;
          if (e.ok) { UI.snd('fang'); const fs = BS.shown[foe.id]; if (fs) fs.fang = 1; }
          break;
        }
        case 'end': break;
      }
    }
  }

  // ---------- Zeichnen ----------
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function platte(c, x, y, w, name, m, s, gross, farbe) {
    const h = gross ? 54 : 40;
    c.fillStyle = 'rgba(14,10,24,.88)'; roundRect(c, x, y, w, h, 9); c.fill();
    c.strokeStyle = farbe || 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#f2efe8'; c.font = '700 ' + (gross ? 15 : 13) + 'px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(name, x + 10, y + 18);
    c.fillStyle = '#c9a6ff'; c.textAlign = 'right'; c.fillText('Lv ' + m.lv, x + w - 10, y + 18);
    const bw = w - 20, p = Math.max(0, Math.min(1, s.hp / m.mhp));
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 10, y + 25, bw, 8);
    c.fillStyle = p > 0.5 ? '#5fd38a' : p > 0.2 ? '#ffd54a' : '#ff6b5e'; c.fillRect(x + 10, y + 25, bw * p, 8);
    if (s.st) { c.fillStyle = '#9a5cf0'; c.font = '700 10px system-ui'; c.textAlign = 'left'; c.fillText(CAM.STATUS_KURZ[s.st], x + 10, y + 46); }
    if (gross) { c.fillStyle = '#cfc9e0'; c.font = '12px system-ui'; c.textAlign = 'right'; c.fillText(Math.ceil(s.hp) + ' / ' + m.mhp, x + w - 10, y + 47); }
    return h;
  }

  K.zeichnen = function (c, w, h, t, tick) {
    if (!BS) return;
    const b = BS.b, area = h - BAR_H, cfg = BS.cfg;
    const pal = CAM.BIOME[cfg.biome || 0].P;
    // Hintergrund
    const g = c.createLinearGradient(0, 0, 0, area);
    g.addColorStop(0, '#120c22'); g.addColorStop(0.55, '#2a1c3c'); g.addColorStop(0.56, pal.g1); g.addColorStop(1, pal.g2);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 30; i++) c.fillRect((i * 97 + 13) % w, area * 0.56 + ((i * 53) % (area * 0.44)), 24 + (i % 4) * 8, 3);
    // dunkler Mond
    c.fillStyle = 'rgba(220,210,250,0.55)'; c.beginPath(); c.arc(w * 0.82, area * 0.17, Math.min(40, area * 0.1), 0, 6.3); c.fill();
    c.fillStyle = '#120c22'; c.beginPath(); c.arc(w * 0.82 + 12, area * 0.17 - 6, Math.min(34, area * 0.088), 0, 6.3); c.fill();

    for (const a of b.actors) { const s = BS.shown[a.id]; s.hp += (s.ziel - s.hp) * 0.12; if (Math.abs(s.ziel - s.hp) < 0.3) s.hp = s.ziel; s.shake = Math.max(0, s.shake - 16); s.blink = Math.max(0, s.blink - 16); }
    const feinde = b.actors.filter(a => a.side === 1), eig = b.actors.filter(a => a.side === 0);
    const lokal = b.actor(BS.local);
    // Gegner
    const fz = Math.min(area * 0.58, w * 0.3);
    feinde.forEach((a, k) => {
      const s = BS.shown[a.id], m = a.team[s.i];
      const big = a.boss; const sz = big ? Math.min(area * 0.8, w * 0.36) : fz;
      const x = w * (big ? 0.6 : 0.62) + (k ? 90 : 0), y = area * 0.52 - sz * 0.92 + (big ? area * 0.05 : 0);
      const ox = s.shake ? (Math.random() - 0.5) * 10 : 0;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + sz / 2, area * 0.52 + 6, sz * 0.4, sz * 0.06, 0, 0, 6.3); c.fill();
      if (!s.tot || s.fang) {
        c.globalAlpha = s.fang ? 0.0 : 1; if (s.blink && Math.floor(s.blink / 80) % 2) c.globalAlpha = 0.3;
        CAM.zeichneMob(c, m, x + ox, y, sz, true, tick);
        c.globalAlpha = 1;
      } else if (s.tot) {
        // ausblenden: nichts zeichnen
      }
      if (BS.ball && a === feinde[0]) {
        const bt = (performance.now() - BS.ball.t0);
        const r = 16; let bx = x + sz / 2, by = y + sz / 2;
        if (bt < 400) { bx = w * 0.3 + (x + sz / 2 - w * 0.3) * (bt / 400); by = area * 0.7 - Math.sin(bt / 400 * Math.PI) * 120 + (y + sz / 2 - area * 0.7) * (bt / 400); }
        else by = y + sz * 0.78;
        bx += bt > 400 ? Math.sin(bt / 90) * 5 * (((bt - 400) % 650) < 300 ? 1 : 0) : 0;
        c.fillStyle = '#c9a6ff'; c.beginPath(); c.arc(bx, by, r, 0, 6.3); c.fill(); c.fillStyle = '#2a1c3c'; c.fillRect(bx - r, by - 2, r * 2, 4); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 4, 0, 6.3); c.fill();
      }
      const plw = Math.min(250, w * 0.3);
      platte(c, Math.max(150, x - plw * 0.2 - (big ? 0 : 20)), 14 + (big ? 56 : 0) * 0 + 50, plw, mobName(m) + (big ? '  ' + 'RIESE' : ''), m, s, true, big ? '#ff6b5e' : null);
    });
    // Eigene
    const n = eig.length;
    eig.forEach((a, k) => {
      const s = BS.shown[a.id], m = a.team[s.i]; const mine = a === lokal;
      if (a.out && !mine) return;
      const sz = n > 1 ? (mine ? Math.min(area * 0.5, w * 0.22) : Math.min(area * 0.3, w * 0.12)) : Math.min(area * 0.62, w * 0.3);
      let x, y;
      if (mine) { x = w * 0.18; y = area * 0.96 - sz; }
      else { const j = eig.filter(q => q !== lokal).indexOf(a); x = w * 0.04 + j * (sz + 10) + (j ? 0 : 0); y = area * 0.45 - sz * 0.2 + (j % 2) * 24; }
      if (!mine) x = Math.max(150, x);
      const ox = s.shake ? (Math.random() - 0.5) * 10 : 0;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + sz / 2, y + sz * 0.95, sz * 0.4, sz * 0.06, 0, 0, 6.3); c.fill();
      if (!s.tot) { c.globalAlpha = (s.blink && Math.floor(s.blink / 80) % 2) ? 0.3 : 1; CAM.zeichneMob(c, m, x + ox, y, sz, false, tick); c.globalAlpha = 1; }
      if (mine) platte(c, w - Math.min(270, w * 0.34) - 14, area * 0.62, Math.min(270, w * 0.34), mobName(m), m, s, true, '#8a3ffc');
      else { c.font = '700 11px system-ui'; platte(c, x - 4, y + sz + 2, Math.max(sz + 8, 120), a.name + ': ' + mobName(m), m, s, false); }
      BS.pos = BS.pos || {}; BS.pos[a.id] = [x + sz / 2, y + sz / 2];
    });
    for (const a of feinde) { const s = BS.shown[a.id]; const sz = a.boss ? Math.min(area * 0.8, w * 0.36) : fz; BS.pos = BS.pos || {}; BS.pos[a.id] = [w * (a.boss ? 0.6 : 0.62) + sz / 2, area * 0.52 - sz * 0.45]; }
    // Geschoss
    if (BS.proj) {
      const p = BS.proj, f = (performance.now() - p.t0) / p.dauer;
      if (f >= 1) BS.proj = null;
      else {
        const von = BS.pos && BS.pos[p.von];
        for (const zid of p.nach) {
          const zu = BS.pos && BS.pos[zid];
          if (!von || !zu) continue;
          const x = von[0] + (zu[0] - von[0]) * f, y = von[1] + (zu[1] - von[1]) * f - Math.sin(f * Math.PI) * 30;
          c.fillStyle = CAM.EL_FARBE[p.el]; c.globalAlpha = 0.9; c.beginPath(); c.arc(x, y, 12 + Math.sin(f * 20) * 3, 0, 6.3); c.fill();
          c.globalAlpha = 0.4; c.beginPath(); c.arc(x - (zu[0] - von[0]) * 0.05, y, 18, 0, 6.3); c.fill(); c.globalAlpha = 1;
        }
      }
    }
    // Schadenszahlen
    BS.floats = BS.floats.filter(f => performance.now() - f.t0 < 900);
    for (const f of BS.floats) {
      const p = BS.pos && BS.pos[f.id]; if (!p) continue;
      const a = (performance.now() - f.t0) / 900;
      c.globalAlpha = 1 - a * a; c.fillStyle = f.farbe; c.font = '700 26px system-ui,sans-serif'; c.textAlign = 'center';
      c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeText(f.text, p[0], p[1] - 20 - a * 50); c.fillText(f.text, p[0], p[1] - 20 - a * 50); c.globalAlpha = 1;
    }
    // Kopfzeile
    c.fillStyle = 'rgba(10,8,18,.72)'; roundRect(c, w / 2 - 150, 10, 300, 30, 9); c.fill();
    c.fillStyle = '#e8e0ff'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const titel = { wild: 'Wilder Kampf', trainer: 'Trainer-Kampf', duel: cfg.ueberfall ? 'Überfall!' : 'Duell', raid: 'Riesen-Raid' }[b.kind];
    c.fillText(titel + ' · Runde ' + b.turn, w / 2, 26);
    c.textBaseline = 'alphabetic';
  };
})(window);
