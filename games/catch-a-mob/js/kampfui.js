'use strict';
// Catch a Mob – Kampfbildschirm: zeichnet die Szene, spielt jeden Angriff als Animation ab (Schlag, Biss, Schuss, Peitsche …),
// fragt Aktionen ab und gleicht bei Duellen und Raids die Eingaben mit den anderen Spielern ab.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc;
  const K = CAM.Kampf = { aktiv: null };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => 1 - (1 - t) * (1 - t);
  const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let BS = null;
  const BAR_H = 205;

  function mobName(m) { return CAM.name(m) + (m.glanz ? ' ✦' : ''); }

  // Zeitablauf: ruft fn(t) mit t = 0..1 auf (läuft auch, wenn der Tab im Hintergrund ist)
  function ani(dur, fn) {
    return new Promise(res => {
      const t0 = performance.now();
      (function schritt() {
        if (!BS) return res();
        const t = Math.min(1, (performance.now() - t0) / dur);
        fn(t);
        if (t < 1) setTimeout(schritt, 16); else res();
      })();
    });
  }

  // ---------- Angriffs-Animationen je Attacke ----------
  const ANIM = {
    rammen: { t: 'lunge', deco: 'schlag' }, glutbiss: { t: 'lunge', deco: 'biss' }, schattenbiss: { t: 'lunge', deco: 'biss' },
    aschesturm: { t: 'proj', n: 3 }, infernoschrei: { t: 'welle' }, moorspritzer: { t: 'proj', n: 4 }, tiefenwoge: { t: 'welle' }, flutgrab: { t: 'regen' },
    dornenpeitsche: { t: 'peitsche' }, wuergeranke: { t: 'peitsche' }, waldfluch: { t: 'regen' },
    steinwurf: { t: 'proj', n: 1 }, beben: { t: 'beben' }, bergsturz: { t: 'regen' },
    krallenhieb: { t: 'hieb' }, sturmschwinge: { t: 'proj', n: 3 }, todesboe: { t: 'welle' },
    lichtblitz: { t: 'strahl' }, reinigung: { t: 'heilen' }, strahlenlanze: { t: 'strahl', dick: true },
    albtraum: { t: 'proj', n: 5, langsam: true }, seelenriss: { t: 'hieb', gross: true }, verderben: { t: 'welle' }, genesung: { t: 'heilen' },
  };
  function animFuer(id) { const mv = CAM.MOVES[id]; if (mv && mv.anim) return mv.anim; return ANIM[id] || (id && id.startsWith('zorn_') ? { t: 'welle' } : { t: 'lunge', deco: 'schlag' }); }

  // Luft-Anzeige (nur Kämpfe unter Wasser)
  function luftEl() {
    let el = $('luft');
    if (!el) { el = document.createElement('div'); el.id = 'luft'; el.className = 'hbox hidden'; el.innerHTML = '<span>' + CAM.Icons.html('drop', 18, 'c') + 'Luft <b>2:00</b></span><div class="bar"><i></i></div>'; document.body.appendChild(el); }
    return el;
  }

  // ---------- Starten ----------
  K.starten = async function (cfg) {
    const b = new CAM.Battle({ kind: cfg.kind, seed: cfg.seed, weather: cfg.weather, actors: cfg.actors, erster: cfg.erster });
    BS = { b, cfg, local: cfg.localId, shown: {}, off: {}, lay: {}, fx: [], parts: [], floats: [], puffer: {}, weg: new Set(), abbruch: null, ball: null,
      wartet: false, ende: false, shake: 0, letzt: performance.now(), intro: performance.now(), erste: true, lastEl: 'Normal' };
    K.aktiv = BS;
    K.vorab = (K.vorab || []).filter(m => m.bid === cfg.bid);
    for (const a of b.actors) {
      const m = b.cur(a);
      BS.shown[a.id] = { i: a.active, hp: m.hp, ziel: m.hp, st: m.status ? m.status.t : null, shake: 0, blink: 0, tot: false, totT: 0, fang: 0, flash: 0, alpha: 1, hup: 0 };
      BS.off[a.id] = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };
    }
    $('bbar').classList.remove('hidden');
    $('bmenu').innerHTML = '';
    let luftIv = null;
    if (cfg.unterwasser) {   // Unter Wasser reicht die Luft nur 2 Minuten
      BS.luftEnde = performance.now() + 120000;
      const el = luftEl(); el.classList.remove('hidden');
      const aktual = () => {
        if (!BS) return;
        const rest = Math.max(0, BS.luftEnde - performance.now()), s = Math.ceil(rest / 1000);
        el.querySelector('b').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        el.querySelector('i').style.width = (rest / 1200) + '%';
        el.classList.toggle('knapp', rest < 20000);
        if (rest <= 0 && !BS.ertrunken) { BS.ertrunken = true; BS.ende = true; if (BS.abbruch) BS.abbruch(); const r = UI.sayResolve; if (r) { UI.sayResolve = null; r(); } }
      };
      aktual(); luftIv = setInterval(aktual, 250);
    }
    UI.snd('kampf');
    UI.log(esc(cfg.intro || ''));
    await sleep(1000);
    if (cfg.intro) await UI.say(cfg.intro, 1400);
    try {
      while (!b.over) {
        if (BS.ende) break;
        const la = b.actor(BS.local);
        pump();
        if (b.phase === 'action') {
          // Beginnt der Gegner die Runde, greift er jetzt an, erst danach wählst du
          const vor = b.vorspiel();
          if (vor.length) { await abspielen(vor); continue; }
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
      if (!BS.ende) await sleep(500);
    } finally {
      if (luftIv) { clearInterval(luftIv); luftEl().classList.add('hidden'); }
      $('bbar').classList.add('hidden'); $('bmenu').innerHTML = '';
      K.aktiv = null;
    }
    const res = { b, abgebrochen: BS.ende && !b.over, ertrunken: !!BS.ertrunken };
    BS = null;
    return res;
  };

  // Maus über einem Schild neben dem Namen: Erklärung zeigen
  K.maus = function (e) {
    if (!BS || !BS.w || !BS.pillen) { UI.tipVerstecken(); return; }
    const cv = e.currentTarget, r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * BS.w / r.width, y = (e.clientY - r.top) * BS.h / r.height;
    const p = BS.pillen.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (p) UI.tipZeigen(p.tip, r.left + (p.x + p.w / 2) * r.width / BS.w, r.top + p.y * r.height / BS.h); else UI.tipVerstecken();
  };
  $('cv').addEventListener('mousemove', K.maus);
  $('cv').addEventListener('mouseleave', () => UI.tipVerstecken());

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
      K.vorab = K.vorab.filter(m => { if (m.bid === BS.cfg.bid) { BS.puffer[m.turn + ':' + m.k + ':' + m.id] = m.act; return false; } return true; });
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
  function stufenInfo() { return ''; }   // Effekte stehen als Schilder neben dem Namen der Mobs (mit Erklärung beim Darüberfahren)
  function effText(mv, tm) {
    if (!mv.pow) return '';
    const e = CAM.effekt(mv.el, CAM.elemente(tm));
    return e > 1 ? '<span class="chip gut" data-tip="Das Element ist gegen den Gegner stark: mehr Schaden.">▲ sehr effektiv</span>' : e < 1 ? '<span class="chip schlecht" data-tip="Das Element ist gegen den Gegner schwach: weniger Schaden.">▼ schwach</span>' : '';
  }
  function tagEl(el) { return '<span class="tag" style="background:' + CAM.EL_FARBE[el] + '">' + (CAM.Icons ? CAM.Icons.el(el, 12) : '') + el + '</span>'; }

  async function frageAktion(a) {
    const b = BS.b, cfg = BS.cfg;
    const me = b.cur(a), foeA = gegner(b, a), tm = foeA.team[foeA.active];
    let tele = '';
    if (foeA.boss && foeA.plan && foeA.plan.t === 'move') {
      const mv = CAM.MOVES[tm.moves[foeA.plan.i]];
      tele = '⚠ ' + CAM.name(tm) + ' holt zu <b>' + esc(mv.n) + '</b> aus' + (mv.aoe ? ' (trifft alle!)' : '') + '.';
      BS.warnung = !!mv.aoe;
    } else BS.warnung = false;
    const wet = b.weather !== 'klar' ? CAM.WETTER[b.weather] + (CAM.WETTER_INFO[b.weather] ? ' – ' + CAM.WETTER_INFO[b.weather] : '') : '';
    let deadline = cfg.timer ? Date.now() + cfg.timer * 1000 : 0, iv = null;
    const zeigeLog = () => {
      const rest = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
      UI.log('Was soll <b>' + esc(mobName(me)) + '</b> <span class="lvl">Lv ' + me.lv + ' · ' + Math.max(0, Math.ceil(me.hp)) + '/' + me.mhp + ' LP</span> tun?' + (deadline ? ' <span id="timer">' + rest + ' s</span>' : ''), [tele, wet && 'Wetter: ' + esc(wet) + (b.wetterN ? ' (' + b.wetterN + ' Züge)' : ''), stufenInfo(b, me, tm)].filter(Boolean).join('<br>'));
    };
    zeigeLog();
    if (deadline) iv = setInterval(() => { if (Date.now() >= deadline) { if (BS && BS.abbruch) BS.abbruch(); } else if (BS && !BS.sub) zeigeLog(); }, 500);
    const standard = () => ({ t: 'move', i: Math.max(0, me.moves.findIndex(id => CAM.MOVES[id].pow)), target: foeA.id });
    try {
      for (;;) {
        BS.sub = false;
        const items = b.turn === 0 ? [{ label: 'Attacke' }] : [{ label: 'Attacke' }, { label: 'Wechseln', disabled: a.team.filter((m, i) => m.hp > 0 && i !== a.active).length === 0 }, { label: 'Beutel', disabled: b.noItems }];
        const fangen = b.kind === 'wild' && b.turn > 0;
        const fliehen = b.turn > 0 && b.kind === 'wild' || (a.fleeFirst && b.turn === 1);
        if (fangen) items.push({ label: 'Fangen' });
        if (fliehen) items.push({ label: 'Fliehen' });
        const labels = items.map(x => x.label);
        const w = await UI.choose(items, { into: $('bmenu'), nocancel: true, cols: 2, abort: f => { BS.abbruch = f; } });
        BS.abbruch = null;
        if (w === -2) return standard();
        const lab = labels[w];
        BS.sub = true;
        if (lab === 'Attacke') {
          const bo = b.boost.get(me);
          const mi = me.moves.map(id => { const mv = CAM.moveFuer(me, id); const weg = mv.einmal && b.einmalGenutzt(me, id); return { label: esc(mv.n) + ' ' + tagEl(mv.el), sub: (weg ? '<span class="chip warn">schon benutzt</span>' : CAM.moveChips(mv, bo && (!bo.st || bo.st === mv.st) ? bo.add : 0)) + effText(mv, tm), disabled: weg }; });
          // Noch nicht gelernte Attacken stehen ausgegraut darunter (nicht wählbar)
          if (CAM.alleAttacken) CAM.alleAttacken(me).filter(x => !x.ok).forEach(x => { const mv = CAM.moveFuer(me, x.id); mi.push({ label: esc(mv.n) + ' ' + tagEl(mv.el), sub: '<span class="chip schlecht">ab Stufe ' + x.lv + '</span>' + CAM.moveChips(mv), disabled: true }); });
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
          const verfuegbar = Object.keys(CAM.ITEMS).filter(k => !CAM.ITEMS[k].fund && !CAM.ITEMS[k].nurBeute && !CAM.ITEMS[k].fang && (cfg.beutel()[k] || 0) > 0);
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
          const kugeln = Object.keys(CAM.ITEMS).filter(k => CAM.ITEMS[k].fang && (cfg.beutel()[k] || 0) > 0);
          if (!kugeln.length) { UI.log('Du hast keine Fangkugeln mehr!'); await sleep(900); zeigeLog(); continue; }
          const ii = kugeln.map(k => ({ label: CAM.ITEMS[k].n + ' <small>(' + CAM.chanceText(CAM.fangChance(a.fang || 1, tm, CAM.ITEMS[k])) + ' Chance)</small>', sub: '× ' + cfg.beutel()[k] }));
          ii.push({ label: '← Zurück' });
          const r = await UI.choose(ii, { into: $('bmenu'), abort: f => { BS.abbruch = f; } });
          BS.abbruch = null;
          if (r === -2) return standard();
          if (r >= 0 && r < kugeln.length) return { t: 'catch', item: kugeln[r] };
        } else if (lab === 'Fliehen') return { t: 'flee' };
        zeigeLog();
      }
    } finally { if (iv) clearInterval(iv); if (BS) BS.sub = false; $('bmenu').innerHTML = ''; }
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

  // ---------- Effekte ----------
  function mitte(id) { const l = BS.lay[id]; return l ? [l.cx, l.cy] : [BS.w / 2, BS.h / 3]; }
  function burst(x, y, col, n, v, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = (0.3 + Math.random()) * (v || 160);
      BS.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: 0.35 + Math.random() * 0.45, col, size: 2 + Math.random() * 4, grav: grav === undefined ? 220 : grav });
    }
  }
  function addFx(dur, draw) { const f = { t0: performance.now(), dur, draw }; BS.fx.push(f); return f; }
  K.h = { ani, sleep, ease, easeIO, mitte, burst, addFx, BS: () => BS };
  function schwebe(id, text, farbe, gross) { const p = mitte(id); BS.floats.push({ x: p[0], y: p[1] - 60, text, t0: performance.now(), farbe, gross }); }

  // Der Angreifer holt aus und bewegt sich zum Ziel
  async function lunge(aid, tid, deco, gross, cfg) {
    const A = mitte(aid), T = mitte(tid), o = BS.off[aid];
    const dx = T[0] - A[0], dy = T[1] - A[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    UI.snd('schwung');
    await ani(240, t => { o.x = -ux * 26 * ease(t); o.y = -uy * 14 * ease(t) + 4 * ease(t); o.sx = 1 + 0.08 * t; o.sy = 1 - 0.1 * t; });
    const ziel = Math.max(0, d - BS.lay[aid].sz * 0.45 - BS.lay[tid].sz * 0.2);
    await ani(150, t => { const e = easeIO(t); o.x = -ux * 26 * (1 - e) + ux * ziel * e; o.y = -uy * 14 * (1 - e) + uy * ziel * e; o.sx = 1.1 - 0.1 * t; o.sy = 0.9 + 0.1 * t; });
    dekoration(deco, T, ux, uy, gross, (cfg && cfg.cols) || [CAM.EL_FARBE[BS.lastEl] || '#fff', '#fff']);
    ani(380, t => { const e = easeIO(t); o.x = ux * ziel * (1 - e); o.y = uy * ziel * (1 - e); o.sx = 1; o.sy = 1; });
  }
  function dekoration(deco, T, ux, uy, gross, cols) {
    const c0 = cols[0], c1 = cols[1] || '#ffffff', G = gross ? 1.5 : 1;
    if (deco === 'biss') {
      addFx(420, (c, p) => {
        const s = (BS.lay.s0 || 60) * G, o = (1 - Math.min(1, p * 3)) * s * 0.5;
        c.save(); c.translate(T[0], T[1]); c.fillStyle = '#fff'; c.strokeStyle = '#1a0f24'; c.lineWidth = 2;
        for (const dir of [-1, 1]) {
          c.beginPath(); c.moveTo(-s * 0.5, dir * (s * 0.1 + o)); for (let i = 0; i < 6; i++) { c.lineTo(-s * 0.5 + i * s * 0.2 + s * 0.1, dir * (s * 0.1 + o) + dir * s * 0.18); c.lineTo(-s * 0.5 + (i + 1) * s * 0.2, dir * (s * 0.1 + o)); }
          c.fill(); c.stroke();
        }
        if (p > 0.3) { c.globalAlpha = 1 - p; c.strokeStyle = c0; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s * 0.5 * p + 8, 0, 6.3); c.stroke(); }
        c.restore();
      });
    } else if (deco === 'kralle') {
      addFx(520, (c, p) => {
        c.save(); c.translate(T[0], T[1]); c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const q = Math.max(0, Math.min(1, (p * 520 - i * 60) / 150)); if (q <= 0) continue;
          const fade = Math.max(0, 1 - (p * 520 - i * 60 - 150) / 280), ox = (i - 1) * 24 * G, len = 70 * G * q;
          c.globalAlpha = fade; c.strokeStyle = '#1a0f24'; c.lineWidth = 11 * G; c.beginPath(); c.moveTo(ox - len * 0.45, -len * 0.7); c.lineTo(ox + len * 0.45, len * 0.7); c.stroke();
          c.strokeStyle = c0; c.lineWidth = 6 * G; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        }
        c.restore();
      });
    } else if (deco === 'horn') {
      addFx(480, (c, p) => {
        const q = Math.min(1, p / 0.3), fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5, l = 90 * G * ease(q);
        c.save(); c.translate(T[0] - ux * 70 * G, T[1] - uy * 70 * G); c.rotate(Math.atan2(uy, ux)); c.globalAlpha = fade;
        c.fillStyle = c0; c.strokeStyle = '#1a0f24'; c.lineWidth = 3; c.beginPath(); c.moveTo(l, 0); c.lineTo(0, -18 * G); c.lineTo(0, 18 * G); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = c1; c.beginPath(); c.moveTo(l * 0.9, 0); c.lineTo(l * 0.1, -9 * G); c.lineTo(l * 0.1, 0); c.closePath(); c.fill();
        if (q >= 1) { c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * 1.047; c.beginPath(); c.moveTo(l + Math.cos(a) * 10, Math.sin(a) * 10); c.lineTo(l + Math.cos(a) * (22 + p * 30), Math.sin(a) * (22 + p * 30)); c.stroke(); } }
        c.restore();
      });
    } else if (deco === 'stampf') {
      BS.shake = Math.max(BS.shake, 14); UI.snd('beben');
      addFx(600, (c, p) => { c.save(); c.translate(T[0], T[1] + 36); c.globalAlpha = 1 - p; c.strokeStyle = '#2a2018'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, p * 150 * G, p * 36 * G, 0, 0, 6.3); c.stroke(); c.strokeStyle = c0; c.lineWidth = 2.5; c.stroke(); c.restore(); });
      for (let i = 0; i < 10; i++) BS.parts.push({ x: T[0] + (Math.random() - 0.5) * 100, y: T[1] + 36, vx: (Math.random() - 0.5) * 200, vy: -100 - Math.random() * 150, life: 0, max: 0.6, col: i % 2 ? '#8a7a62' : '#b8a888', size: 4 + Math.random() * 5, grav: 420 });
    } else if (deco === 'schweif') {
      addFx(520, (c, p) => {
        const q = Math.min(1, p / 0.45), fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
        c.save(); c.translate(T[0], T[1]); c.globalAlpha = fade; c.lineCap = 'round';
        const a0 = -2.2 * (ux < 0 ? -1 : 1) + (ux < 0 ? Math.PI : 0), da = 3.4 * q * (ux < 0 ? -1 : 1);
        for (const [w, col] of [[22 * G, c0], [11 * G, c1]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(0, 0, 56 * G, a0, a0 + da, ux < 0); c.stroke(); }
        c.restore();
      });
    } else if (deco === 'zange') {
      addFx(560, (c, p) => {
        const zu = p < 0.3 ? ease(p / 0.3) : 1, fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4, s = 54 * G;
        c.save(); c.translate(T[0], T[1]); c.globalAlpha = fade; c.lineJoin = 'round';
        for (const dir of [-1, 1]) {
          const off = (1 - zu) * 60 + 4;
          c.fillStyle = c0; c.strokeStyle = '#1a0f24'; c.lineWidth = 3; c.beginPath();
          c.moveTo(dir * (s * 0.9 + off), -s * 0.5); c.quadraticCurveTo(dir * (s * 0.2 + off), -s * 0.7, dir * off, -s * 0.15); c.lineTo(dir * (off + 4), 0); c.quadraticCurveTo(dir * (s * 0.3 + off), -s * 0.35, dir * (s * 0.9 + off), -s * 0.2); c.closePath(); c.fill(); c.stroke();
        }
        if (p > 0.3) { c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = i * 1.256 - 1.9; c.beginPath(); c.moveTo(Math.cos(a) * 16, Math.sin(a) * 16 - 8); c.lineTo(Math.cos(a) * 32, Math.sin(a) * 32 - 8); c.stroke(); } }
        c.restore();
      });
    } else if (deco === 'schnabel') {
      for (let i = 0; i < 3; i++) setTimeout(() => {
        if (!BS) return; const ox = (i - 1) * 22 * G, oy = ((i * 37) % 3 - 1) * 14;
        BS.parts.push(...Array.from({ length: 5 }, () => ({ x: T[0] + ox, y: T[1] + oy, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0, max: 0.3, col: c0, size: 3 + Math.random() * 3, grav: 0 })));
        addFx(240, (c, p) => { c.save(); c.translate(T[0] + ox, T[1] + oy); c.globalAlpha = 1 - p; c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 8; k++) { const r = (k % 2 ? 4 : 13 + p * 8); c.lineTo(Math.cos(k * 0.785) * r, Math.sin(k * 0.785) * r); } c.fill(); c.restore(); });
        UI.snd('tick');
      }, i * 110);
    } else if (deco === 'kopfnuss') {
      BS.shake = Math.max(BS.shake, 8);
      addFx(620, (c, p) => { c.save(); c.translate(T[0], T[1] - 50); c.globalAlpha = 1 - p * p; for (let i = 0; i < 4; i++) { const a = p * 9 + i * 1.57; c.fillStyle = i % 2 ? '#ffd54a' : c0; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 10; c.lineTo(Math.cos(a) * 36 + Math.cos(k * 0.628) * r, Math.sin(a) * 14 + Math.sin(k * 0.628) * r); } c.fill(); } c.restore(); });
      dekoration('schlag', T, ux, uy, gross, cols);
    } else if (deco === 'faust') {
      BS.shake = Math.max(BS.shake, 12);
      addFx(480, (c, p) => {
        c.save(); c.translate(T[0], T[1]); c.globalAlpha = 1 - p;
        c.fillStyle = c0; c.strokeStyle = '#1a0f24'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, (20 + p * 40) * G, 0, 6.3); c.fill(); c.stroke();
        c.fillStyle = c1; c.beginPath(); c.arc(-6, -6, (10 + p * 18) * G, 0, 6.3); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 4; for (let i = 0; i < 10; i++) { const a = i * 0.628; c.beginPath(); c.moveTo(Math.cos(a) * (30 + p * 40) * G, Math.sin(a) * (30 + p * 40) * G); c.lineTo(Math.cos(a) * (48 + p * 60) * G, Math.sin(a) * (48 + p * 60) * G); c.stroke(); }
        c.restore();
      });
    } else if (deco === 'umarmung') {
      addFx(760, (c, p) => {
        const zu = p < 0.4 ? ease(p / 0.4) : 1, fade = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        c.save(); c.translate(T[0], T[1]); c.globalAlpha = fade; c.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const a0 = k * 1.57 + 0.4; c.strokeStyle = '#120a1c'; c.lineWidth = 14; c.beginPath();
          for (let i = 0; i <= 14; i++) { const q = i / 14 * zu, a = a0 + q * 5.2, r = (110 - 70 * zu) * (1 - q * 0.35) * G; const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
          c.stroke(); c.strokeStyle = c0; c.lineWidth = 7; c.stroke();
          c.fillStyle = c1; for (let i = 3; i <= 12; i += 3) { const q = i / 14 * zu, a = a0 + q * 5.2, r = (110 - 70 * zu) * (1 - q * 0.35) * G; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.75, 3, 0, 6.3); c.fill(); }
        }
        c.restore();
      });
    } else {
      addFx(300, (c, p) => {
        c.save(); c.translate(T[0], T[1]); c.globalAlpha = 1 - p; c.strokeStyle = '#fff'; c.lineWidth = 5 - 3 * p;
        const r = 14 + p * 40; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke();
        c.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.2; c.beginPath(); c.moveTo(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5)); c.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12)); c.stroke(); }
        c.restore();
      });
    }
  }

  function zeichneGeschoss(c, el, x, y, p, i, vx, vy) {
    const col = CAM.EL_FARBE[el], t = performance.now();
    c.save(); c.translate(x, y);
    switch (el) {
      case 'Feuer':
        c.fillStyle = '#ffdf6a'; c.beginPath(); c.arc(0, 0, 9, 0, 6.283); c.fill();
        c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.arc(0, 0, 15 + Math.sin(t / 40 + i) * 2, 0, 6.283); c.fill();
        c.fillStyle = '#ff3b1a'; c.globalAlpha = 0.5; c.beginPath(); c.arc(-vx * 0.04, -vy * 0.04, 20, 0, 6.283); c.fill(); break;
      case 'Wasser':
        c.fillStyle = col; c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(11, 4, 0, 11); c.quadraticCurveTo(-11, 4, 0, -14); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-3, -2, 3, 6); break;
      case 'Erde':
        c.rotate(t / 90 + i); c.fillStyle = '#7a6a52'; c.beginPath(); c.moveTo(-14, -6); c.lineTo(-4, -15); c.lineTo(13, -8); c.lineTo(12, 9); c.lineTo(-6, 13); c.closePath(); c.fill();
        c.fillStyle = '#9a8a70'; c.beginPath(); c.moveTo(-4, -15); c.lineTo(13, -8); c.lineTo(2, 0); c.closePath(); c.fill(); break;
      case 'Luft':
        c.rotate(Math.atan2(vy, vx)); c.strokeStyle = '#e8f6ff'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, 14, -1.2, 1.2); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(-6, 0, 10, -1, 1); c.stroke(); break;
      case 'Licht':
        c.fillStyle = '#fff6b0'; c.shadowColor = col; c.shadowBlur = 16; c.beginPath();
        for (let k = 0; k < 8; k++) { const a = k * 0.785 + t / 200, r = k % 2 ? 6 : 15; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); break;
      case 'Schatten':
        c.fillStyle = 'rgba(70,20,130,.9)'; c.beginPath(); c.arc(0, 0, 12 + Math.sin(t / 60 + i) * 2, 0, 6.283); c.fill();
        c.fillStyle = col; c.globalAlpha = 0.6; c.beginPath(); c.arc(-vx * 0.03, -vy * 0.03, 18, 0, 6.283); c.fill();
        c.fillStyle = '#e0c0ff'; c.globalAlpha = 1; c.fillRect(-4, -3, 3, 3); c.fillRect(2, -3, 3, 3); break;
      case 'Pflanze':
        c.rotate(t / 120 + i); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 14, 6, 0, 0, 6.283); c.fill();
        c.fillStyle = '#2f6a2f'; c.fillRect(-12, -1, 24, 2); break;
      default:
        c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 10, 0, 6.283); c.fill();
    }
    c.restore();
  }

  // Führt die Animation einer Attacke aus. Kehrt zurück, sobald der Treffer passiert.
  async function spieleAngriff(an) {
    const mv = CAM.MOVES[an.move], cfg = animFuer(an.move), el = mv.el, A = mitte(an.a), col = CAM.EL_FARBE[el];
    BS.lastEl = el;
    const ziele = an.to.filter(id => BS.lay[id]);
    const T = ziele.length ? mitte(ziele[0]) : A;
    const o = BS.off[an.a];
    const dx = T[0] - A[0], dy = T[1] - A[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (K.anim && K.anim[cfg.t]) { await K.anim[cfg.t]({ an, cfg, mv, el, col, A, T, o, ux, uy, d, ziele }); return; }
    switch (cfg.t) {
      case 'lunge': await lunge(an.a, ziele[0] || an.a, cfg.deco, cfg.gross, cfg); if (el !== 'Normal') burst(T[0], T[1], col, 10, 160); break;
      case 'hieb': {
        UI.snd('schwung');
        await ani(220, t => { o.x = -ux * 16 * ease(t); o.sx = 1 + 0.06 * t; o.sy = 1 - 0.06 * t; });
        const n = cfg.x ? 2 : cfg.gross ? 4 : 3, hc = cfg.cols || [cfg.gross ? col : '#fff', '#fff'];
        for (const zid of ziele.length ? ziele : [an.a]) {
          const Z = mitte(zid);
          addFx(520, (c, p) => {
            c.save(); c.translate(Z[0], Z[1]); c.lineCap = 'round';
            for (let i = 0; i < n; i++) {
              const q = Math.max(0, Math.min(1, (p * 520 - i * 70) / 180)); if (q <= 0) continue;
              const fade = Math.max(0, 1 - (p * 520 - i * 70 - 180) / 220);
              c.globalAlpha = fade; const len = 60 * q * (cfg.gross ? 1.3 : 1), ox = cfg.x ? 0 : (i - (n - 1) / 2) * 22, fl = cfg.x && i ? -1 : 1;
              c.strokeStyle = '#1a0f24'; c.lineWidth = (cfg.gross ? 14 : 10) * (1 - q * 0.4); c.beginPath(); c.moveTo(ox - fl * len * 0.5, -len * 0.7); c.lineTo(ox + fl * len * 0.5, len * 0.7); c.stroke();
              c.strokeStyle = hc[0]; c.lineWidth = (cfg.gross ? 9 : 6) * (1 - q * 0.4); c.stroke();
              c.strokeStyle = hc[1]; c.lineWidth = 2; c.stroke();
            }
            c.restore();
          });
        }
        ani(300, t => { const e = easeIO(t); o.x = -ux * 16 * (1 - e) + ux * 30 * Math.sin(Math.PI * e); o.sx = 1; o.sy = 1; });
        await sleep(300); burst(T[0], T[1], col, 14, 200, 120);
        break;
      }
      case 'proj': {
        UI.snd('schwung');
        await ani(cfg.langsam ? 360 : 200, t => { o.y = -10 * ease(t); o.sy = 1 + 0.06 * t; o.sx = 1 - 0.04 * t; });
        const n = cfg.n || 1, flug = cfg.langsam ? 620 : 420;
        const fertig = [];
        for (let i = 0; i < n; i++) {
          const tgt = mitte(ziele[i % Math.max(1, ziele.length)] || an.a), sx = A[0] + ux * 30, sy = A[1] + uy * 30 - 16;
          const bog = (n === 1 && el !== 'Erde') ? 10 : 40 + Math.random() * 30, st = i * (cfg.langsam ? 90 : 110);
          const jit = [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30];
          let letztX = sx, letztY = sy;
          fertig.push(ani(flug + st, t0 => {
            const t = Math.max(0, Math.min(1, (t0 * (flug + st) - st) / flug)); if (t0 * (flug + st) < st) return;
            const x = sx + (tgt[0] + jit[0] - sx) * t, y = sy + (tgt[1] + jit[1] - sy) * t - Math.sin(t * Math.PI) * bog;
            const vx = x - letztX, vy = y - letztY; letztX = x; letztY = y;
            if (Math.random() < 0.7) BS.parts.push({ x, y, vx: -vx * 6 + (Math.random() - 0.5) * 30, vy: -vy * 6 + (Math.random() - 0.5) * 30, life: 0, max: 0.3, col, size: 2 + Math.random() * 3, grav: 0 });
            BS.proj = BS.proj || [];
            BS.proj.push({ el, x, y, p: t, i, vx: vx * 60, vy: vy * 60, ende: performance.now() + 24 });
            if (t >= 1 && !BS['b' + i + an.a]) { BS['b' + i + an.a] = true; burst(tgt[0] + jit[0], tgt[1] + jit[1], col, 8, 150); }
          }));
        }
        ani(300, t => { o.y = -10 * (1 - ease(t)); o.sy = 1; o.sx = 1; });
        await Promise.all(fertig);
        for (let i = 0; i < n; i++) delete BS['b' + i + an.a];
        break;
      }
      case 'strahl': {
        UI.snd('schwung');
        await ani(240, t => { o.y = -6 * ease(t); o.sx = 1 + 0.05 * t; o.sy = 1 - 0.05 * t; });
        const dick = cfg.dick ? 26 : 14;
        let hit = false;
        for (const zid of ziele.length ? ziele : [an.a]) {
          const Z = mitte(zid), sx = A[0] + ux * 30, sy = A[1] - 14;
          addFx(600, (c, p) => {
            const l = Math.min(1, p / 0.3), a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3, ex = sx + (Z[0] - sx) * l, ey = sy + (Z[1] - sy) * l;
            c.save(); c.globalAlpha = a; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 24;
            if (cfg.prisma) {   // Regenbogen: sieben Farbstrahlen, die sich im Ziel treffen
              const bunt = ['#ff4a4a', '#ff9f43', '#ffe14d', '#5fd38a', '#4f8ff7', '#8a3ffc', '#ff7ad9'];
              bunt.forEach((cl, k) => { const off = (k - 3) * 9 * (1 - l); c.strokeStyle = cl; c.lineWidth = dick * 0.45; c.beginPath(); c.moveTo(sx, sy + off); c.lineTo(ex, ey); c.stroke(); });
            } else { c.strokeStyle = col; c.lineWidth = dick * (1 + Math.sin(p * 40) * 0.1); c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); }
            c.strokeStyle = '#fff'; c.lineWidth = dick * 0.4; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
            c.restore();
          });
        }
        ani(500, t => { o.y = -6 * (1 - ease(t)); o.sx = 1; o.sy = 1; });
        await sleep(170); burst(T[0], T[1], col, 16, 220); break;
      }
      case 'peitsche': {
        UI.snd('schwung');
        await ani(220, t => { o.x = -ux * 18 * ease(t); });
        const sx = A[0] + ux * 30, sy = A[1] - 8;
        for (const zid of ziele.length ? ziele : [an.a]) {
          const Z = mitte(zid);
          addFx(620, (c, p) => {
            const l = p < 0.45 ? ease(p / 0.45) : 1 - ease((p - 0.45) / 0.55), ex = sx + (Z[0] - sx) * l, ey = sy + (Z[1] - sy) * l;
            c.save(); const pc = cfg.cols || [el === 'Pflanze' ? '#3f9a3f' : col, '#a6e8a0']; c.strokeStyle = pc[0]; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
            const seg = 18;
            for (let i = 0; i <= seg; i++) {
              const q = i / seg, x = sx + (ex - sx) * q, y = sy + (ey - sy) * q + Math.sin(q * 9 - p * 28) * 22 * (1 - q) * (p < 0.45 ? 1 : 0.5) - Math.sin(q * Math.PI) * 30 * (1 - l * 0.5);
              if (i) c.lineTo(x, y); else c.moveTo(x, y);
            }
            c.stroke();
            c.strokeStyle = pc[1]; c.lineWidth = 2; c.stroke();
            if (cfg.dornen) { c.fillStyle = '#e8e0b0'; for (let i = 2; i < seg; i += 3) { const q = i / seg, x = sx + (ex - sx) * q, y = sy + (ey - sy) * q + Math.sin(q * 9 - p * 28) * 22 * (1 - q) * (p < 0.45 ? 1 : 0.5) - Math.sin(q * Math.PI) * 30 * (1 - l * 0.5); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 9); c.lineTo(x + 6, y); c.fill(); } }
            if (p > 0.38 && p < 0.55) { c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * 0.785, r = k % 2 ? 6 : 18; c.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r); } c.fill(); }
            c.restore();
          });
        }
        ani(320, t => { const e = easeIO(t); o.x = -ux * 18 * (1 - e) + ux * 22 * Math.sin(Math.PI * e); });
        await sleep(300); burst(T[0], T[1], col, 14, 200, 80); break;
      }
      case 'regen': {
        UI.snd('schwung');
        await ani(300, t => { o.y = -14 * ease(t); o.sy = 1 + 0.08 * t; o.sx = 1 - 0.05 * t; });
        const n = 9;
        const fertig = [];
        for (const zid of ziele.length ? ziele : [an.a]) {
          const Z = mitte(zid);
          for (let i = 0; i < n; i++) {
            const x = Z[0] + (Math.random() - 0.5) * 120, st = i * 70;
            fertig.push(ani(300 + st, t0 => {
              const t = Math.max(0, (t0 * (300 + st) - st) / 300); if (t0 * (300 + st) < st) return;
              const y = Z[1] - 280 + (280 - 10) * Math.min(1, t * t);
              BS.proj = BS.proj || []; BS.proj.push({ el, x, y, p: t, i, vx: 0, vy: 300, ende: performance.now() + 24 });
              if (t >= 1 && !BS['r' + i + zid]) { BS['r' + i + zid] = true; burst(x, Z[1] - 10, col, 4, 120); }
            }));
          }
        }
        ani(300, t => { o.y = -14 * (1 - ease(t)); o.sy = 1; o.sx = 1; });
        await Promise.all(fertig); BS.parts.length < 400 && burst(T[0], T[1], col, 10, 180);
        Object.keys(BS).filter(k => /^r\d/.test(k)).forEach(k => delete BS[k]);
        break;
      }
      case 'welle': {
        UI.snd('schwung');
        await ani(300, t => { o.y = -8 * ease(t); o.sx = 1 + 0.1 * t; o.sy = 1 - 0.08 * t; });
        const reich = Math.max(...ziele.map(id => Math.abs(mitte(id)[0] - A[0])), 200) + 100;
        addFx(700, (c, p) => {
          c.save(); c.translate(A[0], A[1]); c.shadowColor = col; c.shadowBlur = 20;
          for (let k = 0; k < 3; k++) {
            const q = Math.max(0, p - k * 0.08), r = q * reich, a = (1 - q) * 0.8; if (q <= 0) continue;
            c.globalAlpha = a; c.strokeStyle = k ? col : '#fff'; c.lineWidth = 10 - k * 3;
            c.beginPath(); c.ellipse(0, 0, r * 0.7, r * 0.45, 0, -0.9 + (ux < 0 ? Math.PI : 0), 0.9 + (ux < 0 ? Math.PI : 0)); c.stroke();
          }
          c.restore();
        });
        ani(400, t => { o.y = -8 * (1 - ease(t)); o.sx = 1; o.sy = 1; });
        BS.shake = Math.max(BS.shake, 8);
        await sleep(520);
        for (const id of ziele) { const Z = mitte(id); burst(Z[0], Z[1], col, 14, 220); }
        break;
      }
      case 'beben': {
        UI.snd('beben');
        await ani(260, t => { o.y = -16 * ease(t); o.sy = 1 + 0.1 * t; });
        ani(220, t => { o.y = -16 * (1 - t) + 6 * Math.sin(Math.PI * t); });
        BS.shake = Math.max(BS.shake, 16);
        for (const zid of ziele) {
          const Z = mitte(zid), l = BS.lay[zid];
          addFx(650, (c, p) => {
            c.save(); c.strokeStyle = '#1a0f24'; c.lineWidth = 4; c.globalAlpha = 1 - p * p;
            const by = l.cy + l.sz * 0.42; c.beginPath(); c.moveTo(Z[0] - 140 * Math.min(1, p * 3), by);
            for (let i = 0; i < 10; i++) c.lineTo(Z[0] - 140 * Math.min(1, p * 3) + i * 30 * Math.min(1, p * 3), by + (i % 2 ? 8 : -8));
            c.stroke(); c.restore();
          });
          for (let i = 0; i < 7; i++) setTimeout(() => { if (BS) BS.parts.push({ x: Z[0] + (Math.random() - 0.5) * 120, y: l.cy + l.sz * 0.4, vx: (Math.random() - 0.5) * 80, vy: -200 - Math.random() * 160, life: 0, max: 0.8, col: '#8a7a62', size: 5 + Math.random() * 5, grav: 520 }); }, i * 40);
        }
        await sleep(440); break;
      }
      case 'heilen': {
        UI.snd('heil');
        await ani(650, t => {
          o.y = -6 * Math.sin(Math.PI * t);
          if (Math.random() < 0.5) BS.parts.push({ x: A[0] + (Math.random() - 0.5) * 80, y: A[1] + 30, vx: 0, vy: -60 - Math.random() * 40, life: 0, max: 0.8, col: el === 'Licht' ? '#fff3a0' : '#9affb0', size: 3 + Math.random() * 3, grav: -20 });
        });
        o.y = 0; break;
      }
    }
  }

  // Treffer: Aufleuchten, Rückstoss, Funken, Zahl
  function treffer(id, dmg, hpNach) {
    const s = BS.shown[id]; if (!s) return;
    const P = mitte(id), col = CAM.EL_FARBE[BS.lastEl] || '#fff', l = BS.lay[id], m = BS.b.actor(id).team[s.i];
    s.flash = 200; s.shake = 380; s.hup = 320;
    if (m) {   // Wunden: je nach Schaden und übrigen LP neue Verletzungen, schwere Treffer zerfetzen Verbände
      const sev = dmg / m.mhp;
      if (sev >= 0.2) CAM.verbandZerfetzen(m);
      if (sev >= 0.05 || Math.random() < 0.5) CAM.wundeNeu(m, sev, BS.lastEl);
      CAM.wundenMindestens(m, Math.random, hpNach != null ? hpNach / m.mhp : null);
    }
    burst(P[0], P[1], col, 8 + Math.min(14, Math.floor(dmg / 3)), 180);
    BS.shake = Math.max(BS.shake, Math.min(14, 3 + dmg / 6));
    BS.floats.push({ x: P[0], y: P[1] - (l ? l.sz * 0.3 : 30), text: '-' + dmg, t0: performance.now(), farbe: '#ffb4a8', gross: dmg >= (m ? m.mhp * 0.25 : 30) });
    UI.snd('el_' + BS.lastEl);
  }
  function ausweichen(id) { const o = BS.off[id]; return ani(420, t => { o.x = Math.sin(t * Math.PI) * 50 * (id.startsWith('p') || id === BS.local ? -1 : 1); o.y = -Math.sin(t * Math.PI) * 20; }); }

  // ---------- Ereignisse abspielen ----------
  async function abspielen(ev) {
    const b = BS.b; let erstes = true;
    for (let k = 0; k < ev.length; k++) {
      const e = ev[k];
      if (BS.ende) return;
      const s = e.a != null ? BS.shown[e.a] : null;
      switch (e.k) {
        case 'msg':
          if (e.anim) {
            if (!erstes) await sleep(650);   // Der Gegner wartet kurz, bevor er zurückschlägt
            erstes = false;
            UI.log('<b>' + esc(e.t) + '</b>');
            await spieleAngriff(e.anim);
            // Folgt kein Schaden (Daneben), weicht das Ziel aus
            const nxt = ev[k + 1];
            if (nxt && nxt.k === 'msg' && nxt.t === 'Die Attacke geht daneben!') { ausweichen(e.anim.to[0]); BS.lastFloat = e.anim.to[0]; schwebe(e.anim.to[0], 'DANEBEN!', '#cfc9e0', true); UI.snd('tick'); }
          } else {
            const ziel = e.t.indexOf('Sehr effektiv') === 0 ? '#5fd38a' : e.t.indexOf('Kritisch') === 0 ? '#ffd54a' : '';
            if (ziel && BS.lastFloat) { const krit = e.t.indexOf('Kritisch') === 0; schwebe(BS.lastFloat, krit ? 'KRITISCH!' : e.t.replace('!', '').replace(' ...', ''), ziel, krit); if (krit) { BS.shake = Math.max(BS.shake, 12); UI.snd('treffer'); } }
            await UI.say(e.t, e.t.length > 50 ? 1500 : 1000);
          }
          break;
        case 'hp':
          if (s && s.i === e.i) {
            s.ziel = e.hp;
            if (e.dmg) { treffer(e.a, e.dmg, e.hp); BS.lastFloat = e.a; if (e.dmg > (b.actor(e.a).team[e.i].mhp * 0.3)) await sleep(90); }
            if (e.t) UI.log(esc(e.t));
            await sleep(e.dmg ? 650 : 400);
          }
          break;
        case 'heal':
          if (s) { if (s.i === e.i) { const mo = b.actor(e.a).team[e.i]; if (mo) CAM.wundenAnpassen(mo, e.hp); s.ziel = e.hp; schwebe(e.a, '+', '#7dffa0', true); burst(mitte(e.a)[0], mitte(e.a)[1], '#9affb0', 10, 100, -40); } UI.snd('heil'); }
          await UI.say(e.t, 900); await sleep(250);
          break;
        case 'status': {
          if (s && s.i === e.i) {
            s.st = e.st;
            if (e.st) { const P = mitte(e.a), col = CAM.STATUS_COL[e.st]; burst(P[0], P[1], col, 14, 90, -30); schwebe(e.a, CAM.STATUS_KURZ[e.st], col, true); UI.snd('status'); }
          }
          await UI.say(e.t, 900);
          break;
        }
        case 'faint':
          if (s && s.i === e.i) { s.tot = true; s.totT = performance.now(); s.ziel = 0; UI.snd('niederlage2'); const P = mitte(e.a); burst(P[0], P[1], '#cfc9e0', 16, 120, -60); }
          await sleep(500);
          await UI.say(e.t, 1100);
          break;
        case 'switch': {
          if (s) { s.i = e.i; s.hp = s.ziel = e.hp; s.st = e.st; s.tot = false; s.alpha = 1; s.blink = 0; s.einT = performance.now(); const P = mitte(e.a); burst(P[0], P[1], '#c9a6ff', 14, 140, 0); }
          UI.snd('ruf');
          await UI.say(e.t, 900);
          break;
        }
        case 'shake': await fangAnimation(e.n, e.ok); break;
        case 'end': break;
      }
    }
  }

  // Fangen: Die Fangkugel fliegt, saugt den Mob ein, wackelt und rastet ein oder zerspringt
  async function fangAnimation(n, ok) {
    const b = BS.b, foe = b.actors.find(a => a.side === 1), fs = BS.shown[foe.id];
    const von = mitte(BS.local), ziel = mitte(foe.id);
    const ball = BS.ball = { x: von[0], y: von[1], rot: 0, sc: 1, vis: true, glow: 0 };
    UI.snd('schwung');
    await ani(520, t => { ball.x = von[0] + (ziel[0] - von[0]) * t; ball.y = von[1] + (ziel[1] - von[1]) * t - Math.sin(t * Math.PI) * 120; ball.rot = t * 12; });
    // einsaugen
    UI.snd('einsaugen');
    const l = BS.lay[foe.id];
    burst(ziel[0], ziel[1], '#ffffff', 16, 160, 0);
    await ani(420, t => { fs.alpha = 1 - t; const o = BS.off[foe.id]; o.sx = 1 - 0.9 * t; o.sy = 1 - 0.9 * t; o.x = (ball.x - ziel[0]) * t * 0.0; o.y = (ball.y - ziel[1]) * t * 0.6 * 0; ball.glow = t; });
    fs.fang = 1;
    const boden = (l ? l.cy + l.sz * 0.32 : ziel[1]);
    const y0 = ball.y;
    await ani(420, t => { const f = Math.abs(Math.cos(t * Math.PI * 1.5)) * (1 - t); ball.y = y0 + (boden - y0) * Math.min(1, t * 1.6) - f * 28; });
    ball.y = boden; ball.glow = 0;
    // Die Kugel wackelt langsam und wird spannender: erst Stille, dann Wackeln mit leuchtender Kugel
    for (let i = 0; i < n; i++) {
      await ani(650 + i * 150, t => { ball.glow = 0.15 * (0.5 + 0.5 * Math.sin(t * Math.PI * (4 + i * 2))); });
      UI.snd('tick');
      await ani(820, t => { ball.rot = Math.sin(t * Math.PI * 2) * (0.55 + i * 0.12) * (1 - 0.25 * t); ball.glow = 0.25 * Math.sin(t * Math.PI); });
      ball.rot = 0; ball.glow = 0;
    }
    // Der Moment der Wahrheit: die Kugel schimmert, dann klickt sie oder zerspringt
    await ani(900, t => { ball.glow = 0.3 + 0.5 * Math.abs(Math.sin(t * Math.PI * 3)); ball.sc = 1 + 0.06 * Math.sin(t * Math.PI * 6); });
    ball.sc = 1; ball.glow = 0;
    await sleep(500);
    if (ok) {
      UI.snd('fang');
      burst(ball.x, ball.y, '#ffe680', 22, 200, 40); burst(ball.x, ball.y, '#c9a6ff', 18, 160, 0);
      await ani(500, t => { ball.glow = Math.sin(t * Math.PI); });
      await sleep(350);
      ball.vis = false; BS.ball = null;
    } else {
      UI.snd('platzen');
      burst(ball.x, ball.y, '#ffffff', 22, 220, 30);
      ball.vis = false; BS.ball = null; fs.fang = 0;
      const o = BS.off[foe.id];
      await ani(380, t => { fs.alpha = t; o.sx = 0.1 + 0.9 * ease(t); o.sy = 0.1 + 0.9 * ease(t); });
      o.sx = 1; o.sy = 1; fs.alpha = 1;
    }
  }

  // ---------- Zeichnen ----------
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function platte(c, x, y, w, name, m, s, gross, farbe, xp) {
    const h = gross ? 58 : 40;
    c.fillStyle = 'rgba(14,10,24,.9)'; roundRect(c, x, y, w, h, 9); c.fill();
    c.strokeStyle = farbe || 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#f2efe8'; c.font = '700 ' + (gross ? 15 : 13) + 'px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(name, x + 10, y + 18);
    c.fillStyle = '#c9a6ff'; c.textAlign = 'right'; c.fillText('Lv ' + m.lv, x + w - 10, y + 18);
    const bw = w - 20, p = Math.max(0, Math.min(1, s.hp / m.mhp)), pz = Math.max(0, Math.min(1, s.ziel / m.mhp));
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 10, y + 25, bw, 8);
    if (pz < p) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 10, y + 25, bw * p, 8); }
    c.fillStyle = pz > 0.5 ? '#5fd38a' : pz > 0.2 ? '#ffd54a' : '#ff6b5e'; c.fillRect(x + 10, y + 25, bw * Math.min(p, pz) + (pz > p ? bw * (pz - p) * 0 : 0), 8);
    if (s.hup > 0) { c.fillStyle = 'rgba(255,255,255,' + (s.hup / 320 * 0.6) + ')'; c.fillRect(x + 10, y + 25, bw * p, 8); }
    // Schilder neben dem Namen: Zustand (z. B. GIF) und Veränderungen (z. B. Zielscheibe −20 %). Mit dem Mauszeiger darüber erscheint die Erklärung.
    { let sx = x + 10; const ich = !!(BS.b && BS.b.actors.some(a => a.side === 0 && a.team[a.active] === m && a.id === BS.local)), P = [];
      if (s.st) P.push({ ico: CAM.Icons.canvas('st', s.st), txt: CAM.STATUS_KURZ[s.st], col: CAM.STATUS_COL[s.st], tip: CAM.statusTip(s.st, ich) });
      ['atk', 'def', 'acc'].forEach(wk => { const n = BS.b.stufe(m, wk); if (!n) return; const si = CAM.STAT_ICON[wk]; P.push({ ico: CAM.Icons.form(si[0], si[1]), txt: (n > 0 ? '+' : '−') + Math.abs(n) * si[2] + '%', col: n > 0 ? '#2f7a45' : '#8a2a32', tip: CAM.stufeTip(wk, n, ich) }); });
      P.forEach(q => {
        c.font = '700 10px system-ui'; const pw = 22 + c.measureText(q.txt).width;
        c.fillStyle = q.col; roundRect(c, sx, y + 38, pw, 14, 7); c.fill();
        c.imageSmoothingEnabled = false; c.drawImage(q.ico, sx + 4, y + 39, 12, 12);
        c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(q.txt, sx + 18, y + 48.5);
        (BS.pillen = BS.pillen || []).push({ x: sx, y: y + 38, w: pw, h: 14, tip: q.tip });
        sx += pw + 4;
      }); }
    if (gross) {
      c.fillStyle = '#cfc9e0'; c.font = '12px system-ui'; c.textAlign = 'right'; c.fillText(Math.ceil(s.hp) + ' / ' + m.mhp, x + w - 10, y + 49);
      if (xp) { const need = CAM.xpBedarf(m.lv); c.fillStyle = 'rgba(138,63,252,.25)'; c.fillRect(x + 10, y + 53, bw, 3); c.fillStyle = '#8a3ffc'; c.fillRect(x + 10, y + 53, bw * Math.min(1, m.xp / need), 3); }
    }
  }

  const tintCv = document.createElement('canvas');
  function zeichneMobFx(c, m, l, flip, tick, s, o, ein) {
    const img = CAM.spriteMit(m), sz = l.sz, iw = img.width, k = sz / iw;
    const breath = 1 + Math.sin(tick / (m.hp > 0 && m.hp < m.mhp * 0.25 ? 260 : 420) + m.fam) * 0.018;
    c.save(); c.imageSmoothingEnabled = false;
    c.translate(l.x + sz / 2 + o.x + ein, l.y + sz + o.y + (s.tot ? Math.min(1, (performance.now() - s.totT) / 650) * sz * 0.18 : 0));
    const sx = (o.sx || 1) * breath, sy = (o.sy || 1) / breath;
    c.scale(flip ? -sx : sx, sy);
    c.translate(0, -sz / 2); if (o.rot) c.rotate(o.rot); c.translate(-sz / 2, -sz / 2);
    let al = s.alpha;
    if (s.tot) al = Math.max(0, 1 - (performance.now() - s.totT) / 650);
    if (s.blink && Math.floor(s.blink / 80) % 2) al *= 0.35;
    c.globalAlpha = al;
    c.drawImage(img, 0, 0, sz, sz);
    if (s.flash > 0) {
      tintCv.width = iw; tintCv.height = iw;
      const t = tintCv.getContext('2d'); t.imageSmoothingEnabled = false; t.drawImage(img, 0, 0, iw, iw);
      t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(255,255,255,' + Math.min(0.9, s.flash / 140) + ')'; t.fillRect(0, 0, iw, iw); t.globalCompositeOperation = 'source-over';
      c.drawImage(tintCv, 0, 0, sz, sz);
    }
    // frisches Blut tropft aus offenen Schnitt- und Rissstellen
    if (m.wunden && !s.tot && m.hp < m.mhp * 0.75) {
      for (const w of m.wunden) {
        if (w.v === 1 || (w.t !== 'riss' && w.t !== 'schnitt')) continue;
        const ph = ((tick / 1100) + w.x * 0.137 + w.y * 0.071) % 1;
        c.globalAlpha = al * (1 - ph * 0.7); c.fillStyle = '#b01c24';
        c.fillRect((w.x + 1) * k, (w.y + 3) * k + ph * 12 * k, 1.6 * k, (2 + ph * 3) * k);
        c.fillStyle = '#e04a52'; c.fillRect((w.x + 1) * k, (w.y + 3) * k + ph * 12 * k, 0.7 * k, 1.2 * k);
      }
    }
    c.restore();
  }

  // Unter Wasser: Licht von oben, Sandboden, Seetang, aufsteigende Blasen
  function unterwasserBild(c, w, area, tick) {
    const g = c.createLinearGradient(0, 0, 0, area);
    g.addColorStop(0, '#2b8fd0'); g.addColorStop(0.35, '#14609e'); g.addColorStop(0.72, '#0b3463'); g.addColorStop(1, '#071a38');
    c.fillStyle = g; c.fillRect(-20, -20, w + 40, area + 60);
    for (let i = 0; i < 6; i++) {   // Lichtstrahlen
      const x = ((i * w / 5 + tick * 0.015) % (w + 300)) - 150;
      c.fillStyle = 'rgba(190,240,255,' + (0.06 + 0.03 * Math.sin(tick / 900 + i)) + ')';
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 70, 0); c.lineTo(x + 280, area * 0.8); c.lineTo(x + 150, area * 0.8); c.closePath(); c.fill();
    }
    const fy = area * 0.6, sg = c.createLinearGradient(0, fy, 0, area + 40);   // Sandboden
    sg.addColorStop(0, '#d2bc82'); sg.addColorStop(1, '#6e5f3e');
    c.fillStyle = sg; c.beginPath(); c.moveTo(-20, fy + 8); for (let x = -20; x <= w + 40; x += 40) c.lineTo(x, fy + Math.sin(x * 0.02) * 6 + 4); c.lineTo(w + 40, area + 60); c.lineTo(-20, area + 60); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 26; i++) c.fillRect((i * 97 + 13) % w, fy + 18 + ((i * 53) % (area * 0.36)), 22 + (i % 4) * 8, 3);
    c.lineWidth = 5; c.lineCap = 'round';
    for (let k = 0; k < 9; k++) {   // Seetang
      const x = (k * 137 + 50) % w, h2 = 50 + (k % 4) * 26, by = fy + 16 + (k % 3) * 14;
      c.strokeStyle = k % 2 ? '#2f9a5a' : '#1f7a4a'; c.beginPath(); c.moveTo(x, by);
      c.bezierCurveTo(x + Math.sin(tick / 700 + k) * 14, by - h2 * 0.4, x - Math.sin(tick / 800 + k * 2) * 14, by - h2 * 0.75, x + Math.sin(tick / 600 + k) * 10, by - h2); c.stroke();
    }
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(225,246,255,.55)'; c.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {   // Blasen
      const t = ((tick / 4200 + i * 0.137) % 1), x = ((i * 83 + 20) % w) + Math.sin(tick / 500 + i) * 7, y = area * (1.02 - t), r = 2 + (i % 4) * 1.4;
      c.globalAlpha = Math.min(1, t * 4) * (1 - t * 0.6); c.beginPath(); c.arc(x, y, r, 0, 6.3); c.stroke();
    }
    c.globalAlpha = 1;
  }

  K.zeichnen = function (c, w, h, t, tick) {
    if (!BS) return;
    const now = performance.now(), dt = Math.min(0.05, (now - BS.letzt) / 1000); BS.letzt = now;
    BS.w = w; BS.h = h; BS.pillen = [];
    const b = BS.b, area = h - BAR_H, cfg = BS.cfg;
    const pal = CAM.BIOME[cfg.biome || 0].P;
    // Kamerawackeln
    BS.shake = Math.max(0, BS.shake - dt * 30);
    c.save();
    if (BS.shake > 0.3) c.translate((Math.random() - 0.5) * BS.shake, (Math.random() - 0.5) * BS.shake);
    // Hintergrund
    if (cfg.unterwasser) unterwasserBild(c, w, area, tick); else {
    const g = c.createLinearGradient(0, 0, 0, area);
    g.addColorStop(0, '#120c22'); g.addColorStop(0.55, '#2a1c3c'); g.addColorStop(0.56, pal.g1); g.addColorStop(1, pal.g2);
    c.fillStyle = g; c.fillRect(-20, -20, w + 40, h + 40);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 30; i++) c.fillRect((i * 97 + 13) % w, area * 0.56 + ((i * 53) % (area * 0.44)), 24 + (i % 4) * 8, 3);
    c.fillStyle = 'rgba(220,210,250,0.55)'; c.beginPath(); c.arc(w * 0.82, area * 0.17, Math.min(40, area * 0.1), 0, 6.3); c.fill();
    c.fillStyle = '#120c22'; c.beginPath(); c.arc(w * 0.82 + 12, area * 0.17 - 6, Math.min(34, area * 0.088), 0, 6.3); c.fill();
    }

    for (const a of b.actors) {
      const s = BS.shown[a.id];
      s.hp += (s.ziel - s.hp) * Math.min(1, dt * 7); if (Math.abs(s.ziel - s.hp) < 0.3) s.hp = s.ziel;
      s.shake = Math.max(0, s.shake - dt * 1000); s.blink = Math.max(0, s.blink - dt * 1000); s.flash = Math.max(0, s.flash - dt * 1000); s.hup = Math.max(0, s.hup - dt * 1000);
    }
    const feinde = b.actors.filter(a => a.side === 1), eig = b.actors.filter(a => a.side === 0);
    const lokal = b.actor(BS.local);
    const ip = Math.min(1, (now - BS.intro) / 900), einF = (1 - ease(ip)) * w * 0.5, einE = -(1 - ease(ip)) * w * 0.5;
    const fz = Math.min(area * 0.58, w * 0.3);
    // Layout bestimmen
    feinde.forEach((a, k) => {
      const big = a.boss; const sz = big ? Math.min(area * 0.8, w * 0.36) : fz;
      const x = w * (big ? 0.6 : 0.62) + (k ? 90 : 0), y = area * 0.52 - sz * 0.92 + (big ? area * 0.05 : 0);
      BS.lay[a.id] = { x, y, sz, cx: x + sz / 2, cy: y + sz * 0.5 };
    });
    const n = eig.length;
    eig.forEach(a => {
      const mine = a === lokal;
      const sz = n > 1 ? (mine ? Math.min(area * 0.5, w * 0.22) : Math.min(area * 0.3, w * 0.12)) : Math.min(area * 0.62, w * 0.3);
      let x, y;
      if (mine) { x = w * 0.18; y = area * 0.96 - sz; }
      else { const j = eig.filter(q => q !== lokal).indexOf(a); x = Math.max(150, w * 0.04 + j * (sz + 10)); y = area * 0.45 - sz * 0.2 + (j % 2) * 24; }
      BS.lay[a.id] = { x, y, sz, cx: x + sz / 2, cy: y + sz * 0.5 };
    });
    BS.lay.s0 = fz * 0.7;
    // Plattformen, Gegner
    for (const a of feinde) {
      const l = BS.lay[a.id], s = BS.shown[a.id], m = a.team[s.i], o = BS.off[a.id];
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(l.x + l.sz / 2 + einE * 0, l.y + l.sz + 6, l.sz * 0.42, l.sz * 0.07, 0, 0, 6.3); c.fill();
      if (a.boss && BS.warnung) {
        const p = 0.5 + Math.sin(now / 120) * 0.5; c.fillStyle = 'rgba(255,60,40,' + (0.12 + p * 0.14) + ')'; c.beginPath(); c.ellipse(l.cx, l.cy, l.sz * 0.7, l.sz * 0.62, 0, 0, 6.3); c.fill();
      }
      if (!s.fang || s.alpha > 0.02) zeichneMobFx(c, m, l, true, tick, s, o, einE);
      const plw = Math.min(250, w * 0.3);
      platte(c, Math.max(150, l.x - plw - 24), 64, plw, mobName(m) + (a.boss ? '  RIESE' : ''), m, s, true, a.boss ? '#ff6b5e' : null);
    }
    // Eigene
    for (const a of eig) {
      const l = BS.lay[a.id], s = BS.shown[a.id], m = a.team[s.i], mine = a === lokal, o = BS.off[a.id];
      if (a.out && !mine) continue;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(l.x + l.sz / 2, l.y + l.sz * 0.97, l.sz * 0.42, l.sz * 0.07, 0, 0, 6.3); c.fill();
      zeichneMobFx(c, m, l, false, tick, s, o, einF);
      if (mine) platte(c, w - Math.min(270, w * 0.34) - 14, area * 0.62, Math.min(270, w * 0.34), mobName(m), m, s, true, '#8a3ffc', true);
      else platte(c, l.x - 4, l.y + l.sz + 2, Math.max(l.sz + 8, 120), a.name + ': ' + mobName(m), m, s, false);
    }
    // Fangkugel
    if (BS.ball && BS.ball.vis) {
      const bl = BS.ball; c.save(); c.translate(bl.x, bl.y); c.rotate(bl.rot); c.scale(bl.sc || 1, bl.sc || 1);
      if (bl.glow > 0) { c.fillStyle = 'rgba(255,240,170,' + (bl.glow * 0.5) + ')'; c.beginPath(); c.arc(0, 0, 30 + bl.glow * 8, 0, 6.3); c.fill(); }
      // Fangkugel: dunkle Kugel mit violettem Äquatorband, Knopf und Glanzpunkt
      const kg = c.createRadialGradient(-5, -6, 2, 0, 0, 18); kg.addColorStop(0, '#6a4aa0'); kg.addColorStop(0.55, '#2a1f3d'); kg.addColorStop(1, '#120a1e');
      c.fillStyle = kg; c.beginPath(); c.arc(0, 0, 17, 0, 6.283); c.fill();
      c.strokeStyle = '#0a0612'; c.lineWidth = 2; c.stroke();
      c.save(); c.beginPath(); c.arc(0, 0, 16, 0, 6.283); c.clip();
      c.fillStyle = '#8a3ffc'; c.fillRect(-18, -3, 36, 6); c.fillStyle = '#c9a6ff'; c.fillRect(-18, -3, 36, 1.5); c.restore();
      c.fillStyle = '#e8d8ff'; c.beginPath(); c.arc(0, 0, 5, 0, 6.283); c.fill(); c.strokeStyle = '#0a0612'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#8a3ffc'; c.beginPath(); c.arc(0, 0, 2.2, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-7, -9, 4, 2.2, -0.6, 0, 6.283); c.fill();
      c.restore();
    }
    // Effekte
    BS.fx = BS.fx.filter(f => now - f.t0 < f.dur);
    for (const f of BS.fx) f.draw(c, (now - f.t0) / f.dur);
    // Geschosse (pro Bild neu)
    if (BS.proj) { for (const p of BS.proj) { if (p.fn) { c.save(); p.fn(c); c.restore(); } else zeichneGeschoss(c, p.el, p.x, p.y, p.p, p.i, p.vx, p.vy); } BS.proj = BS.proj.filter(p => now < p.ende - 8); BS.proj = []; }
    // Partikel
    for (const p of BS.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
      const a = 1 - p.life / p.max; if (a <= 0) continue;
      c.globalAlpha = Math.max(0, a); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;
    BS.parts = BS.parts.filter(p => p.life < p.max);
    if (BS.parts.length > 500) BS.parts.splice(0, BS.parts.length - 500);
    // Zahlen
    BS.floats = BS.floats.filter(f => now - f.t0 < 1000);
    for (const f of BS.floats) {
      const a = (now - f.t0) / 1000, pop = a < 0.12 ? 1 + (0.12 - a) * 6 : 1;
      c.globalAlpha = a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3; c.fillStyle = f.farbe; c.font = '800 ' + Math.round((f.gross ? 34 : 24) * pop) + 'px system-ui,sans-serif'; c.textAlign = 'center';
      c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText(f.text, f.x, f.y - a * 46); c.fillText(f.text, f.x, f.y - a * 46); c.globalAlpha = 1;
    }
    c.restore();
    // Kopfzeile
    c.fillStyle = 'rgba(10,8,18,.72)'; roundRect(c, w / 2 - 150, 10, 300, 30, 9); c.fill();
    c.fillStyle = '#e8e0ff'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const titel = { wild: 'Wilder Kampf', trainer: 'Trainer-Kampf', duel: cfg.ueberfall ? 'Überfall!' : 'Duell', raid: 'Riesen-Raid' }[b.kind];
    c.fillText(titel + (b.turn > 0 ? ' · Runde ' + b.turn : ' · Eröffnung'), w / 2, 26);
    c.textBaseline = 'alphabetic';
  };
})(window);
