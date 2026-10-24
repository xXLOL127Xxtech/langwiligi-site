'use strict';
// Catch a Mob – Hauptschleife: Titelbild, Laufen in der Welt, Mitspieler zeichnen, Eingaben.
(function (G) {
  const CAM = G.CAM, UI = CAM.UI, $ = UI.$, esc = UI.esc, S = CAM.S, Welt = CAM.Welt, Netz = CAM.Netz, K = CAM.Kampf, A = CAM.A, Save = CAM.Save;
  const T = Welt.T;
  const SEED = 4711;
  const cv = $('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, TS = 40, last = 0, hudT = 0;
  const lerp = (a, b, t) => a + (b - a) * t;

  function resize() {
    dpr = Math.min(2, G.devicePixelRatio || 1);
    W = G.innerWidth; H = G.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    TS = Math.max(30, Math.min(56, Math.round(Math.min(W / 21, H / 12.5))));
  }
  G.addEventListener('resize', resize);

  // ---------- Figuren ----------
  function person(c, x, y, ts, col, dir, gehen, name, tick, extra) {
    const u = ts / 16;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y - u, 5.5 * u, 2 * u, 0, 0, 6.3); c.fill();
    CAM.zeichneMensch(c, x, y - 0.6 * u, ts, col, dir, gehen, tick, CAM.lookVon(extra && extra.look || name));
    if (extra && extra.lv) name = name + ' · Lv ' + extra.lv;
    if (name) {
      c.font = '700 ' + Math.max(11, Math.round(ts * 0.3)) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const tw = c.measureText(name).width + 8;
      c.fillStyle = 'rgba(8,6,16,.7)'; c.fillRect(x - tw / 2, y - 25 * u - ts * 0.22, tw, ts * 0.34);
      c.fillStyle = extra && extra.farbe || '#f2efe8'; c.fillText(name, x, y - 25 * u + ts * 0.03);
    }
    if (extra && extra.blase) { c.font = Math.round(ts * 0.6) + 'px system-ui,"Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(extra.blase, x, y - 30 * u - ts * 0.3); }
  }

  // ---------- Update ----------
  function blockiertBox(x, y) { return Welt.blockiert(x - 0.28, y - 0.18) || Welt.blockiert(x + 0.28, y - 0.18) || Welt.blockiert(x - 0.28, y + 0.3) || Welt.blockiert(x + 0.28, y + 0.3); }

  function update(dt, now, tick) {
    const welt = S.modus === 'welt';
    S.anim += dt;
    const frei = welt && !UI.stack.length && !S.busy && !K.aktiv;
    S.bewegt = false;
    if (frei) {
      const kd = UI.keysDown;
      let dx = (kd.d || kd.arrowright ? 1 : 0) - (kd.a || kd.arrowleft ? 1 : 0), dy = (kd.s || kd.arrowdown ? 1 : 0) - (kd.w || kd.arrowup ? 1 : 0);
      if (dx || dy) {
        const n = Math.hypot(dx, dy), sp = 5.4 * dt * (kd.shift ? 1.5 : 1);
        dx = dx / n * sp; dy = dy / n * sp;
        if (!blockiertBox(S.x + dx, S.y)) S.x += dx;
        if (!blockiertBox(S.x, S.y + dy)) S.y += dy;
        S.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        S.bewegt = true;
        S.x = Math.max(1, Math.min(Welt.W - 1, S.x)); S.y = Math.max(1, Math.min(Welt.H - 1, S.y));
        const kk = Math.floor(S.x) + ',' + Math.floor(S.y);
        if (kk !== S.letzteKachel) {
          S.letzteKachel = kk; S.schritte++;
          if (S.save.items.ei) { S.save.eiS = (S.save.eiS || 0) + 1; if (S.save.eiS >= 600) { S.save.eiS = 0; CAM.itemAdd('ei', -1); const z = CAM.neuerMob(26, Math.max(5, Math.floor(CAM.maxLv() * 0.8))); const wo = A.mobDazu(z); S.save.dex[26] = 2; UI.snd('fang'); UI.toast('Das Drachenei ist geschlüpft: ' + CAM.name(z) + (wo === 'box' ? ' (im Zwinger)' : '') + '!', 4000); } }
          const t = Welt.get(S.x, S.y);
          if (t === T.GRAS && S.schritte >= 14 && !Welt.istSicher(S.x, S.y) && CAM.lebend() && Math.random() < 0.012) {
            S.schritte = 0;
            CAM.Wilde.sprung(now);
          }
        }
      }
      // Dorf betreten
      const d = Welt.dorfBei(S.x, S.y);
      if (d && S.imDorf !== d.biome) { S.imDorf = d.biome; A.dorfBesucht(d); UI.toast(d.name + ' – hier bist du sicher.', 2500); }
      else if (!d) S.imDorf = null;
      // Trainer
      for (const tr of Welt.trainer) {
        const aus = S.trainerT[tr.id] && now - S.trainerT[tr.id] < 10 * 60 * 1000;
        if (aus || !CAM.lebend()) { tr.alarm = 0; continue; }
        const ox = [0, 1, 0, -1][tr.dir], oy = [-1, 0, 1, 0][tr.dir];
        let sieht = false;
        for (let k = 1; k <= 5; k++) {
          const tx = tr.x + ox * k, ty = tr.y + oy * k;
          if (Welt.blockiert(tx, ty)) break;
          if (Math.floor(S.x) === tx && Math.floor(S.y) === ty) { sieht = true; break; }
        }
        if (sieht && !Welt.istSicher(S.x, S.y)) {
          if (!tr.alarm) { tr.alarm = now; UI.snd('ruf'); }
          else if (now - tr.alarm > 700) { tr.alarm = 0; A.trainerKampf(tr, { erster: 1 }); break; }
        } else tr.alarm = 0;
      }
    }
    CAM.Wilde.update(dt, now, frei);
    CAM.Bots.update(dt, now, frei);
    // Biome, Wetter
    S.biome = Welt.biomeAt(S.x, S.y);
    S.wetter = CAM.wetterBei(S.biome, now);
    CAM.WetterAnzeige.aktualisieren(dt, S.wetter);
    // Ziel zum Ansprechen
    S.ziel = null;
    if (frei) {
      const z = Welt.ansprechbar(S.x, S.y, S.dir);
      if (z) S.ziel = { typ: 'bau', z };
      let best = null, bd = 2.0;
      for (const tr of Welt.trainer) { const d = Math.hypot(tr.x + 0.5 - S.x, tr.y + 0.5 - S.y); if (d < bd && !(S.trainerT[tr.id] && now - S.trainerT[tr.id] < 10 * 60 * 1000)) { bd = d; best = tr; } }
      if (best && !S.ziel) S.ziel = { typ: 'trainer', tr: best };
      const bm = !S.online ? CAM.Bots.naechster(S.x, S.y, 1.9) : null;
      if (bm && !S.ziel) S.ziel = { typ: 'bot', b: bm };
      const wm = CAM.Wilde.naechster(S.x, S.y, 1.9);
      if (wm && !S.ziel) S.ziel = { typ: 'mob', w: wm };
      if (S.online && !S.ziel) {
        let bp = null, pd = 1.9;
        for (const p of S.peers.values()) { const d = Math.hypot(p.x - S.x, p.y - S.y); if (d < pd) { pd = d; bp = p; } }
        if (bp) S.ziel = { typ: 'spieler', p: bp };
      }
    }
    // Mitspieler gleiten
    for (const p of S.peers.values()) { p.x = lerp(p.x, p.tx, Math.min(1, dt * 9)); p.y = lerp(p.y, p.ty, Math.min(1, dt * 9)); p.geht = Math.hypot(p.tx - p.x, p.ty - p.y) > 0.05; }
    // Senden
    if (S.online && welt) {
      S.sendeT -= dt;
      if (S.sendeT <= 0) { Netz.senden({ t: 'p', ...A.praesenz() }); S.sendeT = S.bewegt ? 0.2 : 1.5; }
    }
    if (welt && now - (S.speicherT || 0) > 20000) { S.speicherT = now; Save.speichern(); }
  }

  // ---------- Zeichnen ----------
  function hexRgba(h, a) { return 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',' + a + ')'; }

  function zeichneWelt(now, tick, camx, camy) {
    const vx = camx - W / 2 / TS, vy = camy - H / 2 / TS;
    Welt.zeichnen(ctx, vx, vy, W, H, TS, tick);
    const sx = x => (x - vx) * TS, sy = y => (y - vy) * TS;
    const liste = [];
    for (const tr of Welt.trainer) {
      if (tr.x < vx - 2 || tr.x > vx + W / TS + 2 || tr.y < vy - 2 || tr.y > vy + H / TS + 2) continue;
      const aus = S.trainerT[tr.id] && now - S.trainerT[tr.id] < 10 * 60 * 1000;
      liste.push({ y: tr.y + 1, f: () => { ctx.globalAlpha = aus ? 0.55 : 1; person(ctx, sx(tr.x + 0.5), sy(tr.y + 1), TS, tr.farbe, tr.dir, false, aus ? '' : tr.name, tick, { farbe: '#ffb4a8', blase: tr.alarm ? '❗' : '' }); ctx.globalAlpha = 1; } });
    }
    if (!S.online) for (const b of CAM.Bots.liste) {
      if (b.x < vx - 2 || b.x > vx + W / TS + 2 || b.y < vy - 2 || b.y > vy + H / TS + 2) continue;
      liste.push({ y: b.y + 0.5, f: () => person(ctx, sx(b.x), sy(b.y + 0.5), TS, CAM.FARBEN[b.col] || '#999', b.dir, b.geht, b.name, tick, { farbe: CAM.Bots.farbe(b.lv), lv: b.lv, blase: b.z === 'prov' ? '❗' : '' }) });
    }
    for (const w of CAM.Wilde.liste) {
      if (w.x < vx - 2 || w.x > vx + W / TS + 2 || w.y < vy - 2 || w.y > vy + H / TS + 2) continue;
      liste.push({ y: w.y + 0.45, f: () => wilderMob(w, sx(w.x), sy(w.y + 0.45), now, tick) });
    }
    if (S.sp) {
      const sp = S.sp, q = Math.min(1, (performance.now() - sp.t0) / sp.dauer), ex = S.x + [0, 1.3, 0, -1.3][S.dir], ey = S.y + [-1.3, 0, 1.3, 0][S.dir];
      // Das Gras raschelt, dann springt der Mob heraus
      if (q < 0.45) { ctx.fillStyle = 'rgba(120,200,110,.8)'; for (let i = 0; i < 6; i++) ctx.fillRect(sx(sp.x0) + Math.sin(tick / 25 + i * 2) * TS * 0.4, sy(sp.y0) - TS * 0.2 + Math.cos(tick / 30 + i * 3) * TS * 0.3, 4, 4); }
      else {
        const f = (q - 0.45) / 0.55, bx = sp.x0 + (ex - sp.x0) * f, by = sp.y0 + (ey - sp.y0) * f, hoch = Math.sin(f * Math.PI) * 1.6;
        liste.push({ y: by + 0.5, f: () => wilderMob({ mob: sp.mob, x: bx, y: by - hoch, dir: (S.dir + 2) % 4, z: 'jagt', geht: true, huepf: 0 }, sx(bx), sy(by + 0.45) - hoch * TS, now, tick, true) });
      }
      if (q > 0.35) { ctx.font = Math.round(TS * 0.9) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6b5e'; ctx.fillText('❗', sx(S.x), sy(S.y) - TS * 1.8); }
    }
    for (const p of S.peers.values()) {
      if (p.x < vx - 2 || p.x > vx + W / TS + 2 || p.y < vy - 2 || p.y > vy + H / TS + 2) continue;
      const bl = p.gestT && now - p.gestT < 3500 ? p.gest : '';
      const prot = (S.prot[p.idx] || 0) > now;
      liste.push({ y: p.y + 0.5, f: () => person(ctx, sx(p.x), sy(p.y + 0.5), TS, CAM.FARBEN[p.col] || '#999', p.dir, p.geht, p.name + (prot ? ' 🛡' : '') + (p.bs ? ' ⚔' : ''), tick, { lv: p.lv, look: p.name, farbe: (S.pt >= 0 && p.pt === S.pt) ? '#ffd54a' : CAM.Bots.farbe(p.lv), blase: bl }) });
    }
    const bl = S.gest && now - S.gest.t < 3500 ? S.gest.z : '';
    liste.push({ y: S.y + 0.5, f: () => person(ctx, sx(S.x), sy(S.y + 0.5), TS, CAM.FARBEN[S.save.col] || '#4f8ff7', S.dir, S.bewegt, S.name, tick, { farbe: '#c9a6ff', blase: bl }) });
    liste.sort((a, b) => a.y - b.y).forEach(o => o.f());
    // Pfeile zu Party-Mitgliedern ausserhalb des Bildes
    if (S.online && S.pt >= 0) {
      for (const p of S.peers.values()) {
        if (p.pt !== S.pt) continue;
        const px = sx(p.x), py = sy(p.y);
        if (px > 20 && px < W - 20 && py > 70 && py < H - 70) continue;
        const cx = Math.max(150, Math.min(W - 40, px)), cy = Math.max(80, Math.min(H - 90, py));
        const a = Math.atan2(py - H / 2, px - W / 2);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.fill(); ctx.restore();
        ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        const dist = Math.round(Math.hypot(p.x - S.x, p.y - S.y));
        ctx.strokeText(p.name + ' · ' + dist, cx, cy - 16); ctx.fillText(p.name + ' · ' + dist, cx, cy - 16);
      }
    }
    // Wetter, Nacht
    const dunkel = 1 - CAM.tageslicht(now);
    CAM.WetterAnzeige.zeichnen(ctx, W, H, tick, dunkel, S.biome, S.qualitaet);
  }

  function wilderMob(w, x, y, now, tick, ohneName) {
    const m = w.mob, f = CAM.FAMILIEN[m.fam], boese = CAM.Wilde.boese(m);
    const gr = TS * (f.legend ? 3.2 : [2.0, 2.4, 2.8][m.stufe - 1]);
    // Laufbild: 4 Schritte, die zur Geschwindigkeit passen (ohne eigene Zählung, z. B. beim Sprung aus dem Gras, nach der Uhr)
    const ph = w.geht ? Math.floor(w.lauf !== undefined ? w.lauf : tick / 90) % 4 : -1;
    const schwebt = !!f.fliegt, schweb = schwebt ? TS * 0.34 + Math.sin(tick / 300 + w.id * 1.7) * TS * 0.07 : 0;
    const hop = (w.geht && !schwebt ? Math.abs(Math.sin((w.lauf || 0) * Math.PI / 2)) * TS * 0.04 : 0) + (w.huepf > 0 ? Math.sin((1 - w.huepf / 0.35) * Math.PI) * TS * 0.5 : 0) + schweb;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, gr * 0.36 * (1 - schweb / TS * 0.4), gr * 0.08, 0, 0, 6.3); ctx.fill();
    if (boese) { ctx.fillStyle = 'rgba(255,50,40,' + (0.14 + 0.08 * Math.sin(tick / 200)) + ')'; ctx.beginPath(); ctx.ellipse(x, y, gr * 0.55, gr * 0.16, 0, 0, 6.3); ctx.fill(); }
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y - hop); ctx.scale(w.dir === 3 ? -1 : 1, 1);   // Bilder schauen nach rechts
    const atmen = ph < 0 ? 1 + Math.sin(tick / 520 + w.id) * 0.012 : 1;   // im Stehen atmet er leicht
    ctx.scale(1, atmen);
    ctx.drawImage(CAM.spriteMit(m, ph), -gr / 2, -gr * 0.94, gr, gr);
    ctx.restore();
    const d = Math.hypot(w.x - S.x, w.y - S.y);
    if (!ohneName && d < 8) {
      const txt = (boese ? '☠ ' : '') + CAM.name(m) + ' Lv ' + m.lv;
      ctx.font = '700 ' + Math.max(11, Math.round(TS * 0.28)) + 'px system-ui,sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(txt).width + 8;
      ctx.globalAlpha = Math.min(1, (8 - d) / 2.5);
      ctx.fillStyle = 'rgba(8,6,16,.72)'; ctx.fillRect(x - tw / 2, y - gr - TS * 0.32, tw, TS * 0.36);
      ctx.fillStyle = boese ? '#ff8a7a' : (f.rar >= 2 ? '#c9a6ff' : '#e8ffe0'); ctx.fillText(txt, x, y - gr - TS * 0.04);
      ctx.globalAlpha = 1;
    }
    if (w.z === 'jagt' && !ohneName) { ctx.font = Math.round(TS * 0.7) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6b5e'; ctx.fillText('❗', x, y - gr - TS * 0.5); }
  }

  function hud(now) {
    if (S.modus !== 'welt' || K.aktiv) { $('hud').classList.add('hidden'); $('hint').classList.add('hidden'); $('keys').classList.add('hidden'); return; }
    $('hud').classList.remove('hidden'); $('keys').classList.remove('hidden');
    const B = CAM.BIOME[S.biome], uhr = CAM.tageszeit(now), sais = CAM.SAISONS[CAM.saison(now)];
    const dorf = Welt.dorfBei(S.x, S.y);
    $('hudL').innerHTML = '<b>' + esc(dorf ? dorf.name : B.n) + '</b>' + (dorf ? ' <small>(sicher)</small>' : '') + '<br>' +
      esc(CAM.WETTER[S.wetter]) + ' · ' + uhr + ' · ' + sais + '<br><span class="gold">' + S.save.gold + ' Gold</span> · Team ' + S.save.team.filter(m => m.hp > 0).length + '/' + S.save.team.length +
      (S.online && S.pt >= 0 ? '<div class="party">Party: ' + A.partyListe().map(p => '<span><i style="background:' + (CAM.FARBEN[p.col] || '#999') + '"></i>' + esc(p.name) + '</span>').join(' ') + (A.partyListe().length ? '' : 'nur du') + '</div>' : '');
    const prot = (S.prot[S.idx] || 0) - now;
    $('hudR').innerHTML = S.online ? 'Welt <b>' + esc(Netz.code()) + '</b><br>' + (S.peers.size + 1) + ' von ' + Netz.max + ' Spielern' + (prot > 0 ? '<br>🛡 Geschützt ' + Math.floor(prot / 60000) + ':' + String(Math.floor(prot / 1000) % 60).padStart(2, '0') : '') : 'Bots-Modus<br><small>allein in der Welt</small>';
    const z = S.ziel; let h = '';
    if (z && z.typ === 'bau') h = z.z.meta === 4 ? 'Wegstein' : z.z.meta === 5 ? 'Riesen-Gegner herausfordern' : ['', 'Heilhaus', 'Fangkugel-Laden', 'Mob-Händler'][z.z.meta];
    else if (z && z.typ === 'trainer') h = 'Mit ' + z.tr.name + ' kämpfen';
    else if (z && z.typ === 'mob') h = CAM.name(z.w.mob) + ' ansprechen' + (CAM.Wilde.boese(z.w.mob) ? ' (bösartig!)' : '');
    else if (z && z.typ === 'spieler') h = z.p.name + ': Duell, Überfall, Party';
    else if (z && z.typ === 'bot') h = z.b.name + ' (Bot, Lv ' + z.b.lv + '): Duell mit Einsatz';
    if (h) { $('hint').classList.remove('hidden'); $('hint').innerHTML = '<div class="hbox"><b>E</b> · ' + esc(h) + '</div>'; } else $('hint').classList.add('hidden');
    $('keys').innerHTML = '<kbd>W A S D</kbd> laufen · <kbd>E</kbd> ansprechen · <kbd>M</kbd> Karte · <kbd>Esc</kbd> Menü' + (S.online ? ' · <kbd>1</kbd>–<kbd>4</kbd> Gesten' : '');
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    if (document.hidden && !S.online) return;
    const now = Date.now();
    if (!Welt.tiles) return;
    update(dt, now, ts);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    if (K.aktiv) {
      K.zeichnen(ctx, W, H, now, ts);
      CAM.WetterAnzeige.zeichnen(ctx, W, H, ts, 0, S.biome, S.qualitaet);
    } else if (S.modus === 'welt') zeichneWelt(now, ts, S.x, S.y + 0.2);
    else {
      const d = Welt.dorf[0], t = ts / 9000;
      zeichneWelt(now, ts, d.x + Math.sin(t) * 5, d.y - 1 + Math.cos(t * 0.7) * 2);
      ctx.fillStyle = 'rgba(10,6,20,.55)'; ctx.fillRect(0, 0, W, H);
    }
    if (ts - hudT > 200) { hudT = ts; hud(now); }
  }

  // ---------- Eingaben ----------
  let menueOffen = false;
  async function menue() {
    if (menueOffen || S.busy || K.aktiv) return;
    menueOffen = true; await A.hauptmenue(); menueOffen = false; Save.speichern();
  }
  async function aktion() {
    const z = S.ziel; if (!z || S.busy || menueOffen) return;
    menueOffen = true;
    try {
      if (z.typ === 'bau') {
        const m = z.z.meta;
        if (m === 1) await A.heilhaus(); else if (m === 2) await A.laden(); else if (m === 3) await A.haendler(); else if (m === 4) await A.wegstein(); else if (m === 5) await A.runeMenue(z.z);
      } else if (z.typ === 'trainer') { menueOffen = false; await A.trainerKampf(z.tr); }
      else if (z.typ === 'mob') await A.wildMenue(z.w);
      else if (z.typ === 'spieler') await A.spielerMenue(z.p);
      else if (z.typ === 'bot') await A.botMenue(z.b);
    } finally { menueOffen = false; Save.speichern(); }
  }
  UI.worldKey = function (e, k) {
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (UI.cards.length && (k === 'j' || k === 'n')) { const c = UI.cards[0]; k === 'j' ? c.yes() : c.no(); return true; }
    if (S.modus !== 'welt') return false;
    if (k === 'escape') { menue(); return true; }
    if (k === 'e' || k === 'enter' || k === ' ') { aktion(); return true; }
    if (k === 'm') { if (!S.busy && !menueOffen) { menueOffen = true; A.karte().then(() => { menueOffen = false; }); } return true; }
    if (S.online && /^[1-4]$/.test(k)) { const g = +k - 1; S.gest = { z: CAM.GESTEN[g][0], t: Date.now() }; Netz.senden({ t: 'gest', g }); UI.snd('ruf'); return true; }
    return false;
  };

  // ---------- Titelbild ----------
  async function anleitung() {
    await UI.info('<p><b>Laufen:</b> W A S D oder Pfeiltasten (mit Shift schneller).<br><b>Ansprechen:</b> E oder Enter bei Türen, Trainern und Mitspielern.<br><b>Menü:</b> Esc · <b>Karte:</b> M · <b>Gesten:</b> 1–4 (online).<br>Menüs bedienst du mit Pfeiltasten und Enter oder per Klick mit dem Touchpad.</p>' +
      '<p><b>Bots:</b> Bot-Spieler laufen herum. Sprich sie mit E an: Du siehst ihre Stufe und deine Siegchance, wählst «Fairer Kampf» (alle Mobs auf die mittlere Stufe) oder «Echter Kampf» und setzt Gold oder ein Fabelwesen. Der Bot nimmt an oder lehnt ab. Manche fordern dich auch selbst heraus.</p><p><b>Ziel:</b> Fang Mobs im hohen Gras, trainiere sie und besiege die Riesen an den roten Runen. Wetter, Tageszeit und Jahreszeit verändern Kämpfe und Preise.</p>' +
      '<p><b>Online:</b> Alle in derselben Welt. Lade Freunde über den Knopf «Freunde» ein, bildet eine Party (E bei einer Person) und besiegt zusammen die Riesen. Duelle gibt es mit Einverständnis oder als Überfall: Wer überfallen wurde, ist 30 Minuten geschützt. In Dörfern und unter Stufe 10 ist man sicher.</p>', 'Anleitung');
  }

  async function starterWahl() {
    const fam = CAM.STARTER;
    const bilder = fam.map(f => '<div style="text-align:center">' + '<img src="' + CAM.spriteFam(f, 1).toDataURL() + '" width="96" height="96" style="image-rendering:pixelated"><br>' + esc(CAM.FAMILIEN[f].n[0]) + '</div>').join('');
    const r = await UI.choose(fam.map(f => ({ label: CAM.FAMILIEN[f].n[0], sub: CAM.FAMILIEN[f].el })), { title: 'Wähle deinen ersten Mob', sub: 'Er begleitet dich ab jetzt. Weitere fängst du in der Wildnis.', before: '<div class="row" style="justify-content:space-around">' + bilder + '</div>', nocancel: true });
    const m = CAM.neuerMob(fam[r], 5); S.save.team.push(m); S.save.dex[fam[r]] = 2; S.save.start = true;
  }

  function wartePanel(text) { const h = UI.openPanel('', ''); h.innerHTML = '<p>' + esc(text) + '</p>'; }

  let titelLaeuft = false;
  async function titel() {
    if (titelLaeuft) return; titelLaeuft = true;
    S.modus = 'titel'; $('start').classList.remove('hidden'); $('bbar').classList.add('hidden');
    const hashCode = G.GameHub ? G.GameHub.cleanCode(location.hash) : '';
    S.save = S.save || Save.laden() || Save.neu();
    let name = (G.GameHub ? G.GameHub.getName() : '') || S.save.name || '';   // der Benutzername gilt in allen Spielen
    let col = S.save.col || 0;
    // Einladung angenommen: direkt in die Welt der Freundin oder des Freundes
    if (hashCode.length === 4 && Netz.verfuegbar() && name) {
      try {
        wartePanel('Verbinde mit Welt ' + hashCode + ' …');
        const info = await Netz.beitreten(hashCode, name);
        UI.closePanel();
        name = (info.players && info.players[info.you]) || name;
        S.name = name; S.save.name = name; S.save.col = col; S.online = true;
        if (!S.save.start) await starterWahl();
        titelLaeuft = false;
        betreten();
        return;
      } catch (e) {
        UI.closePanel(); Netz.schliessen();
        await UI.info(esc(G.GameHub.errorText(e)), 'Einladung hat nicht geklappt');
      }
    }
    for (;;) {
      const gh = Netz.verfuegbar();
      const items = [];
      if (hashCode && gh) items.push({ label: 'Welt ' + hashCode + ' beitreten', sub: 'Einladung' });
      items.push({ label: 'Online – mit allen zusammen spielen', sub: gh ? 'eine gemeinsame Welt, bis 20 Spieler' : 'nur auf der Webseite', disabled: !gh });
      items.push({ label: 'Bots – allein spielen', sub: S.save.start ? S.save.team.length + ' Mobs · ' + S.save.gold + ' Gold' : 'neues Spiel' });
      items.push({ label: 'Spielstand-Code' });
      items.push({ label: 'Anleitung' });
      const labels = items.map(i => i.label);
      const fHtml = '<div class="fld">Dein Name<input type="text" id="nm" maxlength="16" value="' + esc(name) + '" placeholder="Name eingeben"></div><div class="fld">Farbe</div><div class="farben">' + CAM.FARBEN.map((c, i) => '<button data-c="' + i + '" style="background:' + c + '" class="' + (i === col ? 'on' : '') + '"></button>').join('') + '</div>';
      const p = UI.choose(items, { into: $('start-body'), nocancel: true, before: fHtml, numbers: false, start: gh ? 0 : 1 });
      const inp = $('nm');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'Escape') { inp.blur(); e.preventDefault(); } e.stopPropagation(); });
      inp.addEventListener('input', () => { name = inp.value; });
      document.querySelectorAll('.farben button').forEach(b => b.onclick = () => { col = +b.dataset.c; document.querySelectorAll('.farben button').forEach(x => x.classList.toggle('on', x === b)); });
      const r = await p;
      name = (inp.value || '').trim().slice(0, 16);
      const lab = labels[r];
      if (lab === 'Anleitung') { await anleitung(); continue; }
      if (lab === 'Spielstand-Code') { await A.spielstandCode(); continue; }
      if (!name) { UI.toast('Bitte gib zuerst einen Namen ein.'); continue; }
      S.name = name; S.save.col = col; if (G.GameHub) name = G.GameHub.setName(name) || name; S.name = name; S.save.name = name;
      try {
        if (lab === 'Bots – allein spielen') { S.online = false; }
        else if (lab.startsWith('Online – mit allen')) { wartePanel('Verbinde mit der Welt …'); await Netz.mitspielen(name); UI.closePanel(); S.online = true; }
        else if (lab.startsWith('Welt ')) { wartePanel('Verbinde …'); await Netz.beitreten(hashCode, name); UI.closePanel(); S.online = true; }
      } catch (e) {
        UI.closePanel(); await UI.info(esc(G.GameHub ? G.GameHub.errorText(e) : String(e)), 'Das hat nicht geklappt'); continue;
      }
      if (G.GameHub && S.online) { S.name = S.save.name = G.GameHub.getName(); }   // der Server kann einen anderen (freien) Namen vergeben haben
      if (!S.save.start) await starterWahl();
      titelLaeuft = false;
      betreten();
      return;
    }
  }

  function betreten() {
    S.modus = 'welt'; S.idx = S.online ? Netz.idx : 0; S.pt = -1; S.peers.clear(); S.prot = {}; S.busy = false; S.trainerT = {}; S.teams = {};
    UI.cards.forEach(c => { c.done = true; c.el.remove(); }); UI.cards = [];
    if (S.save.welt !== 2) { S.save.welt = 2; const d0 = Welt.dorf[0]; S.save.x = d0.x + 0.5; S.save.y = d0.y + 3.5; S.save.besucht = [0]; UI.toast('Die Welt ist grösser geworden! Du stehst im Startdorf.', 4500); }
    S.x = S.save.x; S.y = S.save.y;
    if (Welt.blockiert(S.x, S.y)) { const d = Welt.dorf[0]; S.x = d.x + 0.5; S.y = d.y + 3.5; }
    S.x = Math.floor(S.x) + 0.5; S.y = Math.floor(S.y) + 0.5;
    S.letzteKachel = ''; S.schritte = 0; S.imDorf = null; S.sp = null; CAM.Wilde.liste = []; CAM.Wilde.spawnT = 3; CAM.Wilde.fuell = 3;
    CAM.Bots.erzeugen();
    UI.muted = S.save.ton === false; S.qualitaet = S.save.quali === 0 ? 0 : 1;
    S.save.team.concat(S.save.box).forEach(m => { delete m.faintDone; m.status = null; CAM.angleichen(m); });
    $('start').classList.add('hidden'); UI.closePanel();
    if (S.online) {
      A.hallo();
      if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
    }
    if (!CAM.lebend()) UI.toast('Dein Team ist erschöpft. Im Heilhaus werden alle Mobs geheilt.', 4000);
    UI.toast(S.online ? 'Willkommen in der Welt ' + Netz.code() + '!' : 'Viel Spass im Bots-Modus!', 2500);
  }

  A.beenden = function () {
    Save.speichern(); S.modus = 'titel'; S.busy = false;
    if (Netz.online || Netz.room) Netz.schliessen();
    S.online = false; S.peers.clear(); S.pt = -1;
    UI.cards.forEach(c => { c.done = true; c.el.remove(); }); UI.cards = [];
    UI.closePanel(); titelLaeuft = false; titel();
  };

  // ---------- Netz ----------
  Netz.on('msg', (d, von) => A.nachricht(d, von));
  Netz.on('peer-join', m => { UI.toast((m.name || 'Jemand') + ' ist der Welt beigetreten.'); });
  Netz.on('peer-left', m => {
    const p = S.peers.get(m.idx); if (p) UI.toast(p.name + ' hat die Welt verlassen.');
    S.peers.delete(m.idx); K.spielerWeg(m.idx);
    delete S.prot[m.idx];
  });
  Netz.on('close', () => { if (S.modus === 'welt') { K.abbrechen(); UI.toast('Verbindung zur Welt verloren.', 4000); setTimeout(() => A.beenden(), 600); } });
  G.addEventListener('beforeunload', () => Save.speichern());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Save.speichern(); });

  // ---------- Start ----------
  resize();
  Welt.erzeugen(SEED);
  S.save = Save.laden();
  if (S.save) { S.x = S.save.x; S.y = S.save.y; }
  G.__cam = { S, Welt, A, K, CAM };   // zum Ausprobieren in der Konsole
  requestAnimationFrame(frame);
  titel();
})(window);
