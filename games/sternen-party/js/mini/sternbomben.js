// Minispiel „Sternbomben“: einer gegen drei, aber mit verschiedenen Aufgaben (Draufsicht, Tasten)
// Der Einzelspieler sitzt auf der Wolke und lässt Sternbomben fallen. Die drei anderen weichen aus.
// Jeder Läufer hat 2 Herzen. Sind alle drei draussen, gewinnt der Einzelspieler, sonst das Team.
'use strict';
(() => {
  const XMIN = 190, XMAX = 1410, YMIN = 250, YMAX = 850;   // Laufbereich (Füsse)
  const TEMPO = 270, ZIEL_TEMPO = 600;                     // Läufer, Zielkreuz
  const FALL = .8, RADIUS = 100, CD = .6, MAX_BOMBEN = 3; // Fallzeit, Explosionsradius, Nachladen
  const HERZEN = 2, SCHUTZ = 1.4;                          // Treffer pro Läufer, unverwundbar nach Treffer

  const lebend = S => S.sp.filter(p => !p.w && p.h > 0);

  Minis.reg({
    id: 'sternbomben', name: 'Sternbomben',
    text: 'Einer sitzt auf der Wolke und wirft Sternbomben, die anderen drei weichen aus. Der Schatten zeigt, wo es knallt. Jeder Läufer hat zwei Herzen – sind alle drei draussen, gewinnt der Werfer!',
    steuerung: { tasten: 'Richtungstasten laufen bzw. Zielkreuz bewegen, Werfer: Aktion lässt eine Bombe fallen' },
    formate: ['1v3'],
    dauer: 30,
    start(S, info) {
      S.solo = info.solo >= 0 ? info.solo : 0;
      const plaetze = [[420, 560], [800, 700], [1180, 560]];
      let i = 0;
      S.sp = info.teilnehmer.map((p, k) => {
        if (k === S.solo) return { w: true, x: 800, y: 520, cd: .6, blick: 1 };
        const [x, y] = plaetze[i++ % 3];
        return { w: false, x, y, vx: 0, vy: 0, h: HERZEN, un: 0, blick: x < 800 ? 1 : -1, ht: -9 };
      });
      S.bomben = [];
      S.nr = 0;
      S.endT = 0;
    },
    schritt(S, ein, dt) {
      if (S.endT > 0) { S.endT -= dt; if (S.endT <= 0) S.fertig = true; }
      S.sp.forEach((p, k) => {
        const e = ein[k];
        let vx = e.x || 0, vy = e.y || 0;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }
        if (p.w) {
          // Zielkreuz
          p.x = clamp(p.x + vx * ZIEL_TEMPO * dt, XMIN, XMAX);
          p.y = clamp(p.y + vy * ZIEL_TEMPO * dt, YMIN, YMAX);
          if (Math.abs(vx) > .1) p.blick = Math.sign(vx);
          p.cd = Math.max(0, p.cd - dt);
          if (e.ap && p.cd <= 0 && S.endT <= 0 && S.bomben.length < MAX_BOMBEN) {
            p.cd = CD;
            S.bomben.push({ id: ++S.nr, x: p.x, y: p.y, t: FALL });
            Minis.ereignis(S, { typ: 'wurf', x: p.x });
          }
          return;
        }
        if (p.h <= 0) return;
        p.un = Math.max(0, p.un - dt);
        p.vx = damp(p.vx, vx * TEMPO, 14, dt); p.vy = damp(p.vy, vy * TEMPO, 14, dt);
        p.x = clamp(p.x + p.vx * dt, XMIN, XMAX); p.y = clamp(p.y + p.vy * dt, YMIN, YMAX);
        if (Math.abs(vx) > .1) p.blick = Math.sign(vx);
      });
      // Läufer schieben sich auseinander
      const L = lebend(S);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j], d = dist(a.x, a.y, b.x, b.y);
        if (d < 46 && d > .01) { const s = (46 - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d; a.x -= nx * s; a.y -= ny * s; b.x += nx * s; b.y += ny * s; }
      }
      // Bomben fallen und explodieren
      for (const b of S.bomben) {
        b.t -= dt;
        if (b.t > 0) continue;
        b.weg = true;
        Minis.ereignis(S, { typ: 'boom', x: b.x, y: b.y });
        S.sp.forEach((p, k) => {
          if (p.w || p.h <= 0 || p.un > 0) return;
          if (dist(p.x, p.y - 10, b.x, b.y) > RADIUS + 18) return;
          p.h--; p.un = SCHUTZ; p.ht = S.t;
          Minis.ereignis(S, { typ: 'treffer', x: p.x, y: p.y - 60, k, raus: p.h <= 0 });
        });
      }
      S.bomben = S.bomben.filter(b => !b.weg);
      if (S.endT <= 0 && !lebend(S).length) { S.endT = 1.6; Minis.ereignis(S, { typ: 'alle' }); }
    },
    ki(S, k, stufe) {
      const p = S.sp[k];
      if (p.w) {
        // Werfer: Ziel mit Vorhalt anpeilen, Leicht ungenau und zögerlich
        const ziele = lebend(S).filter(q => q.un < FALL);
        const kandidaten = ziele.length ? ziele : lebend(S);
        if (!kandidaten.length) return {};
        let z = kandidaten[0], bd = 1e9;
        for (const q of kandidaten) { const d = dist(p.x, p.y, q.x, q.y) + q.h * 60; if (d < bd) { bd = d; z = q; } }
        const vor = [0, .55, .85][stufe] * FALL;
        if (S.t >= (p.ft || 0)) { p.fx = rnd(-1, 1) * [70, 35, 14][stufe]; p.fy = rnd(-1, 1) * [70, 35, 14][stufe]; p.ft = S.t + .6; }
        const tx = clamp(z.x + z.vx * vor + p.fx, XMIN, XMAX), ty = clamp(z.y + z.vy * vor + p.fy, YMIN, YMAX);
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const ap = d < [45, 55, 60][stufe] && Math.random() < [.1, .35, 1][stufe];
        return { x: d > 6 ? dx / d : 0, y: d > 6 ? dy / d : 0, ap };
      }
      if (p.h <= 0) return {};
      // Läufer: Schatten meiden (je knapper die Fallzeit, desto gefährlicher), nicht in Ecken, nicht unters Zielkreuz
      const w = S.sp[S.solo];
      // Reaktionszeit: einen frischen Schatten sieht auch ein Computer nicht sofort
      const reakt = [.42, .36, .31][stufe];
      let best = -1e9, bx = 0, by = 0;
      for (let i = 0; i <= 16; i++) {
        const a = i * TAU / 16, sx = i === 16 ? 0 : Math.cos(a), sy = i === 16 ? 0 : Math.sin(a);
        let v = 0;
        for (const b of S.bomben) {
          if (FALL - b.t < reakt) continue;
          const x = p.x + sx * TEMPO * b.t, y = p.y + sy * TEMPO * b.t;
          const d = dist(x, y - 10, b.x, b.y);
          if (d < RADIUS + 40) v -= (RADIUS + 40 - d) * 6;
        }
        const x = p.x + sx * 120, y = p.y + sy * 120;
        const rand = Math.min(x - XMIN, XMAX - x, y - YMIN, YMAX - y);
        if (rand < 90) v -= (90 - rand) * 2.5;
        v += Math.min(dist(x, y, w.x, w.y), 320) * [.1, .35, .5][stufe];
        S.sp.forEach((q, j) => { if (j !== k && !q.w && q.h > 0) v -= Math.max(0, 140 - dist(x, y, q.x, q.y)) * .6; });
        v += Math.random() * [60, 20, 8][stufe];
        if (v > best) { best = v; bx = sx; by = sy; }
      }
      if (stufe === 0) {
        if (S.t >= (p.bz || 0)) { p.bx = bx; p.by = by; p.bz = S.t + rnd(.25, .45); }
        return { x: p.bx, y: p.by };
      }
      return { x: bx, y: by };
    },
    // Alle drei draussen: Werfer 100, Team 0. Sonst umgekehrt.
    punkte(S) {
      const alle = !lebend(S).length;
      return S.sp.map(p => p.w ? (alle ? 100 : 0) : (alle ? 0 : 100));
    },
    wert(S, k) {
      const p = S.sp[k];
      if (p.w) return S.sp.filter(q => !q.w && q.h <= 0).length + '/' + (S.sp.length - 1);
      return p.h > 0 ? '❤'.repeat(p.h) : 'raus';
    },
    zeichne(g, S, A) {
      const t = A.t;
      // Wiese mit Blumen, oben Himmel mit der Wolke des Werfers
      const himmel = g.createLinearGradient(0, 0, 0, 230);
      himmel.addColorStop(0, '#6ec8ff'); himmel.addColorStop(1, '#bfe8ff');
      g.fillStyle = himmel; g.fillRect(0, 0, WELT_B, 230);
      const wiese = g.createLinearGradient(0, 200, 0, WELT_H);
      wiese.addColorStop(0, '#7fd06a'); wiese.addColorStop(1, '#4fae4a');
      g.fillStyle = wiese; g.fillRect(0, 200, WELT_B, WELT_H - 200);
      g.fillStyle = 'rgba(255,255,255,.2)'; rundRechteck(g, XMIN - 30, YMIN - 40, XMAX - XMIN + 60, YMAX - YMIN + 60, 40); g.fill();
      for (let i = 0; i < 70; i++) {
        const x = 120 + (i * 389) % 1380, y = 240 + (i * 211) % 630;
        g.fillStyle = ['#fff', '#ffd23a', '#ff8fb5', '#b38cff'][i % 4]; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
        g.fillStyle = '#ffe36a'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = (i * 360 + t * 18) % (WELT_B + 300) - 150, y = 60 + (i % 3) * 40;
        g.fillStyle = 'rgba(255,255,255,.75)';
        for (const [dx, dy, r] of [[0, 0, 34], [36, 8, 26], [-34, 10, 24]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
      }
      const w = S.sp[S.solo];
      // Schatten der fallenden Bomben (wachsen, je näher der Einschlag)
      for (const b of S.bomben) {
        const u = clamp(1 - b.t / FALL, 0, 1);
        g.fillStyle = `rgba(40,0,40,${.15 + u * .3})`; ellipse(g, b.x, b.y, RADIUS * (.35 + .65 * u), RADIUS * (.35 + .65 * u) * .45); g.fill();
        g.strokeStyle = `rgba(255,60,90,${.4 + u * .5})`; g.lineWidth = 3; ellipse(g, b.x, b.y, RADIUS, RADIUS * .45); g.stroke();
      }
      // Läufer nach Tiefe sortiert
      const reihe = S.sp.map((p, k) => k).filter(k => !S.sp[k].w).sort((a, b) => S.sp[a].y - S.sp[b].y);
      for (const k of reihe) {
        const p = S.sp[k], r = 27;
        if (p.h <= 0) {
          g.globalAlpha = .45; A.figur(k, p.x, p.y, r, { schatten: true, emo: 'traurig', blick: p.blick }); g.globalAlpha = 1;
          continue;
        }
        if (p.un > 0 && Math.floor(t * 12) % 2) continue;
        g.strokeStyle = A.teamFarbe(k); g.lineWidth = 4; ellipse(g, p.x, p.y, r * 1.15, r * .42); g.stroke();
        const nah = S.bomben.some(b => dist(p.x, p.y, b.x, b.y) < RADIUS + 30);
        A.figur(k, p.x, p.y, r, { schatten: true, laufen: Math.hypot(p.vx, p.vy) > 30, blick: p.blick, emo: nah ? 'schock' : 'normal' });
        for (let i = 0; i < HERZEN; i++) {
          g.fillStyle = i < p.h ? '#ff4d6d' : 'rgba(0,0,0,.25)';
          const hx = p.x - 10 + i * 20, hy = p.y - 86;
          g.beginPath(); g.arc(hx - 4, hy, 5, 0, TAU); g.arc(hx + 4, hy, 5, 0, TAU); g.moveTo(hx - 9, hy + 2); g.lineTo(hx, hy + 11); g.lineTo(hx + 9, hy + 2); g.fill();
        }
      }
      // fallende Sternbomben (von der Wolke herab)
      for (const b of S.bomben) {
        const u = clamp(1 - b.t / FALL, 0, 1), y = 150 + (b.y - 150) * u * u;
        g.fillStyle = '#ffd23a'; sternPfad(g, b.x, y - 20, 18, 8, 5, t * 6); g.fill();
        g.strokeStyle = '#a36b00'; g.lineWidth = 2; g.stroke();
      }
      // Wolke mit Werfer, folgt dem Zielkreuz in x
      const wx = w.x, wy = 120 + Math.sin(t * 2) * 6;
      A.figur(S.solo, wx, wy + 20, 30, { schatten: false, blick: w.blick, emo: S.endT > 0 ? 'froh' : 'normal' });
      g.fillStyle = '#fff';
      for (const [dx, dy, r] of [[0, 30, 46], [-48, 36, 32], [48, 36, 32], [-22, 18, 30], [24, 16, 30]]) { g.beginPath(); g.arc(wx + dx, wy + dy, r, 0, TAU); g.fill(); }
      g.strokeStyle = A.teamFarbe(S.solo); g.lineWidth = 4; ellipse(g, wx, wy + 62, 70, 12); g.stroke();
      // Zielkreuz
      g.strokeStyle = w.cd > 0 ? 'rgba(255,255,255,.55)' : '#ff3b6b'; g.lineWidth = 4;
      g.beginPath(); g.arc(w.x, w.y, 26, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(w.x - 38, w.y); g.lineTo(w.x - 14, w.y); g.moveTo(w.x + 14, w.y); g.lineTo(w.x + 38, w.y);
      g.moveTo(w.x, w.y - 38); g.lineTo(w.x, w.y - 14); g.moveTo(w.x, w.y + 14); g.lineTo(w.x, w.y + 38); g.stroke();
      if (w.cd > 0) { g.strokeStyle = '#ffd23a'; g.beginPath(); g.arc(w.x, w.y, 32, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - w.cd / CD)); g.stroke(); }
      if (S.endT > 0) A.text('Alle getroffen!', WELT_B / 2, 300, 46, '#ffd23a');
      for (const e of A.neu(S)) {
        if (e.typ === 'wurf') Ton.spiel('weg');
        else if (e.typ === 'boom') { Ton.spiel('boom'); A.funken(e.x, e.y, '#ffd23a', 18, 320, 7); }
        else if (e.typ === 'treffer') { Ton.spiel('treffer'); A.text3(e.raus ? 'Raus!' : 'Autsch!', e.x, e.y, '#ff8a8a'); }
        else if (e.typ === 'alle') Ton.spiel('boese');
      }
    },
  });
})();
