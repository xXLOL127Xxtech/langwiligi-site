// Minispiel „Grimms Fangspiel“: einer gegen drei auf der Palmeninsel (Draufsicht, Tasten)
// Der Einzelspieler trägt die Grimm-Maske und fängt. Wer gefangen wird, sitzt im Käfig.
// Fängt er alle drei innert 30 s, gewinnt er, sonst gewinnt das Team.
'use strict';
(() => {
  const XMIN = 200, XMAX = 1460, YMIN = 165, YMAX = 850;   // Laufbereich (Füsse)
  const PR = 22, PR_F = 30;                                // Kollisionsradien: Fliehende, Fänger
  const TEMPO = 290, TEMPO_F = 290;                        // Fänger ist etwas schneller
  const SATZ = .22, SATZ_X = 2.2, SATZ_CD = 4.0;           // Sprung-Satz des Fängers
  const ERHOLUNG = .4;                                     // nach dem Satz kurz langsamer
  const FANG = PR + PR_F + 6;
  const HINDERNISSE = [
    { x: 560, y: 400, r: 44, a: 'stein' }, { x: 1060, y: 590, r: 48, a: 'stein' }, { x: 760, y: 705, r: 36, a: 'stein' },
    { x: 1150, y: 330, r: 26, a: 'palme' }, { x: 470, y: 690, r: 26, a: 'palme' }, { x: 800, y: 300, r: 26, a: 'palme' },
    { x: 1340, y: 640, r: 26, a: 'palme' },
  ];

  function begrenzen(p, r) {
    for (const o of HINDERNISSE) {
      const d = dist(p.x, p.y, o.x, o.y), m = o.r + r;
      if (d < m && d > .01) { p.x = o.x + (p.x - o.x) / d * m; p.y = o.y + (p.y - o.y) / d * m; }
    }
    p.x = clamp(p.x, XMIN, XMAX); p.y = clamp(p.y, YMIN, YMAX);
  }
  // Strafe für Punkte am Rand, in Ecken oder in Hindernissen (für die Bots)
  function gefahr(x, y, r, randWeite) {
    let s = 0;
    const rand = Math.min(x - XMIN, XMAX - x, y - YMIN, YMAX - y);
    if (rand < randWeite) s += (randWeite - rand) * 2.2;
    if (rand < 0) s += 400;
    for (const o of HINDERNISSE) { const d = dist(x, y, o.x, o.y) - (o.r + r + 6); if (d < 0) s += 100 - d * 8; }
    return s;
  }
  // Versperrt ein Hindernis die Linie von a nach b?
  function verdeckt(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    for (const o of HINDERNISSE) {
      const u = clamp(((o.x - ax) * dx + (o.y - ay) * dy) / l2, 0, 1);
      if (dist(ax + dx * u, ay + dy * u, o.x, o.y) < o.r + 6) return true;
    }
    return false;
  }
  function besteRichtung(p, weite, bewerte) {
    let best = -1e9, bx = 0, by = 0;
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, x = Math.cos(a), y = Math.sin(a);
      const v = bewerte(p.x + x * weite, p.y + y * weite);
      if (v > best) { best = v; bx = x; by = y; }
    }
    return { x: bx, y: by };
  }

  Minis.reg({
    id: 'fangen', name: 'Grimms Fangspiel',
    text: 'Einer trägt die Grimm-Maske und muss alle drei anderen fangen, bevor die Zeit abläuft. Die anderen flüchten und verstecken sich hinter Felsen und Palmen!',
    steuerung: { tasten: 'Richtungstasten laufen, Fänger: Aktion Sprung-Satz' },
    formate: ['1v3'],
    dauer: 30,
    start(S, info) {
      S.solo = info.solo >= 0 ? info.solo : 0;
      const flucht = [[340, 260], [1280, 250], [1250, 780]];
      let i = 0;
      S.sp = info.teilnehmer.map((p, k) => {
        const f = k === S.solo, [x, y] = f ? [800, 490] : flucht[i++ % 3];
        return { x, y, vx: 0, vy: 0, blick: x < 800 ? 1 : -1, f, gef: false, satz: 0, cd: 1, gt: 0 };
      });
      S.endT = 0;
    },
    schritt(S, ein, dt) {
      if (S.endT > 0) { S.endT -= dt; if (S.endT <= 0) S.fertig = true; }
      S.sp.forEach((p, k) => {
        if (p.gef) return;
        const e = ein[k];
        let vx = e.x || 0, vy = e.y || 0;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }
        let v = p.f ? TEMPO_F : TEMPO;
        if (p.f) {
          p.cd = Math.max(0, p.cd - dt); p.satz = Math.max(0, p.satz - dt);
          if (e.ap && p.cd <= 0 && S.endT <= 0) {
            p.satz = SATZ; p.cd = SATZ_CD;
            // Ohne Richtung springt er in Blickrichtung
            if (l < .1) { const m = Math.hypot(p.vx, p.vy); p.sx = m > 20 ? p.vx / m : p.blick; p.sy = m > 20 ? p.vy / m : 0; }
            else { p.sx = vx; p.sy = vy; }
            Minis.ereignis(S, { typ: 'satz', x: p.x, y: p.y });
          }
          if (p.satz > 0) { vx = p.sx; vy = p.sy; v *= SATZ_X; }
          else if (p.cd > SATZ_CD - SATZ - ERHOLUNG) v *= .5;
        }
        p.vx = damp(p.vx, vx * v, p.satz > 0 ? 40 : 14, dt); p.vy = damp(p.vy, vy * v, p.satz > 0 ? 40 : 14, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.abs(vx) > .1) p.blick = Math.sign(vx);
        begrenzen(p, p.f ? PR_F : PR);
      });
      // Fliehende schieben sich auseinander
      for (let i = 0; i < S.sp.length; i++) for (let j = i + 1; j < S.sp.length; j++) {
        const a = S.sp[i], b = S.sp[j];
        if (a.f || b.f || a.gef || b.gef) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < PR * 2 && d > .01) {
          const s = (PR * 2 - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * s; a.y -= ny * s; b.x += nx * s; b.y += ny * s;
          begrenzen(a, PR); begrenzen(b, PR);
        }
      }
      // Fangen
      const f = S.sp[S.solo];
      if (S.endT <= 0) S.sp.forEach((p, k) => {
        if (p.f || p.gef || dist(p.x, p.y, f.x, f.y) > FANG) return;
        p.gef = true; p.gt = S.t; p.vx = p.vy = 0;
        Minis.ereignis(S, { typ: 'fang', x: p.x, y: p.y - 40, k });
        if (S.sp.every(q => q.f || q.gef)) { S.endT = 1.6; Minis.ereignis(S, { typ: 'alle' }); }
      });
    },
    ki(S, k, stufe) {
      const p = S.sp[k];
      if (p.gef) return {};
      const f = S.sp[S.solo];
      let r, ap = false;
      if (p.f) {
        // Fänger: nächste Beute jagen, beim Ziel bleiben, Schwer zielt mit Vorhalt
        let ziel = null, best = 1e9, neu = -1;
        if (stufe === 0 && p.zk != null && S.sp[p.zk] && !S.sp[p.zk].gef && S.t < p.zt) ziel = S.sp[p.zk];
        else S.sp.forEach((q, j) => {
          if (q.f || q.gef) return;
          let w = dist(p.x, p.y, q.x, q.y);
          if (stufe > 0 && j === p.zk) w -= 120;          // beim alten Ziel bleiben, nicht hin und her
          if (j === p.meide && S.t < p.meideT) w += 500;   // Schwer: wer sich lange hinter Deckung versteckt, wird kurz in Ruhe gelassen
          if (w < best) { best = w; ziel = q; neu = j; }
        });
        if (neu >= 0) p.zk = neu;
        if (!ziel) return {};
        // Schwer: läuft die Jagd nur noch im Kreis um ein Hindernis, das Ziel wechseln
        if (stufe === 2) {
          p.kreis = verdeckt(p.x, p.y, ziel.x, ziel.y) ? (p.kreis || 0) + 1 / 60 : Math.max(0, (p.kreis || 0) - 1 / 30);
          if (p.kreis > 1.3 && S.sp.filter(q => !q.f && !q.gef).length > 1) { p.meide = p.zk; p.meideT = S.t + 2.5; p.kreis = 0; }
        }
        if (stufe === 0 && S.t >= (p.zt || 0)) p.zt = S.t + 2.5;
        const vor = [0, .2, .2][stufe];
        const zx = ziel.x + ziel.vx * vor, zy = ziel.y + ziel.vy * vor;
        r = besteRichtung(p, 60, (x, y) => -dist(x, y, zx, zy) - gefahr(x, y, PR_F, 0));
        const d = dist(p.x, p.y, ziel.x, ziel.y);
        const reich = [110, 170, 175][stufe];
        const frei = !verdeckt(p.x, p.y, ziel.x, ziel.y);
        if (p.cd <= 0 && d < reich && frei) {
          // nur springen, wenn die Laufrichtung ungefähr zum Ziel zeigt
          const ausr = ((zx - p.x) * r.x + (zy - p.y) * r.y) / (Math.hypot(zx - p.x, zy - p.y) || 1);
          ap = stufe === 0 ? Math.random() < .06 : ausr > .75;
        }
      } else {
        // Fliehen: weg vom Fänger, Schwer versteckt sich hinter Hindernissen
        const vor = [0, .15, .15][stufe];
        const tx = f.x + f.vx * vor, ty = f.y + f.vy * vor;
        const weite = [90, 150, 150][stufe];
        const jetzt = dist(p.x, p.y, tx, ty);
        // Versteck: die vom Fänger abgewandte Seite des nächsten Hindernisses (um das man dann im Kreis läuft)
        let versteck = null;
        if (stufe > 0 && jetzt < 340) {
          let bo = null, bd = 260;
          for (const o of HINDERNISSE) { const d = dist(p.x, p.y, o.x, o.y) - o.r; if (d < bd) { bd = d; bo = o; } }
          if (bo) {
            const ox = bo.x - tx, oy = bo.y - ty, ol = Math.hypot(ox, oy) || 1, rr = bo.r + PR + 26;
            versteck = { x: bo.x + ox / ol * rr, y: bo.y + oy / ol * rr };
          }
        }
        r = besteRichtung(p, weite, (x, y) => {
          const dn = dist(x, y, tx, ty);
          let v = dn - gefahr(x, y, PR, [50, 90, 90][stufe]) * .7;
          if (versteck) v -= dist(x, y, versteck.x, versteck.y) * [0, .5, .55][stufe];
          // nicht dem Fänger entgegen laufen: Abstand der Strecke zum Fänger prüfen
          if (stufe > 0) {
            const dx = x - p.x, dy = y - p.y, u = clamp(((tx - p.x) * dx + (ty - p.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
            const ds = dist(p.x + dx * u, p.y + dy * u, tx, ty);
            if (ds < 110) v -= (110 - ds) * 3;
            if (jetzt < 300 && dn < jetzt) v -= (jetzt - dn);
          }
          v += Math.random() * [40, 25, 15][stufe];
          if (stufe > 0) S.sp.forEach((q, j) => { if (j !== k && !q.f && !q.gef) v -= Math.max(0, 160 - dist(x, y, q.x, q.y)) * .5; });
          return v;
        });
      }
      if (stufe === 0) {
        // Leicht: träge Richtungswechsel, etwas langsamer
        if (S.t >= (p.bz || 0)) {
          const a = Math.atan2(r.y, r.x) + rnd(-.5, .5);
          p.bx = Math.cos(a) * .85; p.by = Math.sin(a) * .85; p.bz = S.t + rnd(.3, .55);
        }
        return { x: p.bx, y: p.by, ap };
      }
      // Richtung kurz beibehalten (ruhigeres Laufen); Mittel reagiert langsamer als Schwer
      const halten = p.f ? [0, .26, .12][stufe] : [0, .14, 0][stufe];
      if (halten) {
        if (S.t >= (p.bz || 0)) { p.bx = r.x; p.by = r.y; p.bz = S.t + halten; }
        return { x: p.bx, y: p.by, ap };
      }
      return { x: r.x, y: r.y, ap };
    },
    // Alle drei gefangen: Fänger 100, Team 0. Sonst umgekehrt (Team-Durchschnitt 100).
    punkte(S) {
      const alle = S.sp.every(p => p.f || p.gef);
      return S.sp.map(p => p.f ? (alle ? 100 : 0) : (alle ? 0 : 100));
    },
    wert(S, k) {
      const p = S.sp[k];
      if (p.f) return S.sp.filter(q => q.gef).length + '/' + (S.sp.length - 1);
      return p.gef ? 'Käfig' : 'frei';
    },
    zeichne(g, S, A) {
      const t = A.t;
      // Meer, Insel mit Schaumrand
      const meer = g.createLinearGradient(0, 0, 0, WELT_H);
      meer.addColorStop(0, '#2bb7e0'); meer.addColorStop(1, '#1580c4');
      g.fillStyle = meer; g.fillRect(0, 0, WELT_B, WELT_H);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        const x = (i * 263 + t * 12) % (WELT_B + 100) - 50, y = 40 + (i * 131) % 840;
        g.beginPath(); g.arc(x, y, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
      const wellen = 6 + Math.sin(t * 1.5) * 4;
      g.fillStyle = 'rgba(255,255,255,.85)'; rundRechteck(g, 150 - wellen, 112 - wellen, 1360 + wellen * 2, 776 + wellen * 2, 130); g.fill();
      g.fillStyle = '#e9c98a'; rundRechteck(g, 150, 112, 1360, 776, 124); g.fill();
      const sand = g.createRadialGradient(830, 470, 80, 830, 500, 720);
      sand.addColorStop(0, '#ffeab4'); sand.addColorStop(1, '#f2d08c');
      g.fillStyle = sand; rundRechteck(g, 168, 128, 1324, 744, 112); g.fill();
      // Graspolster, Muscheln, Seesterne
      g.fillStyle = 'rgba(120,190,90,.55)';
      for (const [x, y, rx, ry] of [[620, 560, 130, 50], [980, 430, 120, 44], [380, 400, 80, 30], [1250, 470, 90, 34], [930, 800, 110, 28]]) { ellipse(g, x, y, rx, ry); g.fill(); }
      g.fillStyle = 'rgba(160,120,70,.18)';
      for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(200 + (i * 397) % 1260, 160 + (i * 233) % 690, 2.5, 0, TAU); g.fill(); }
      for (const [x, y, w] of [[260, 820, .3], [1420, 180, 1.2], [1410, 820, 2]]) {
        g.fillStyle = '#ff8a5c'; sternPfad(g, x, y, 16, 7, 5, w); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
      }
      for (const [x, y] of [[300, 180], [1180, 850], [640, 860]]) {
        g.fillStyle = '#fff1e6'; g.beginPath(); g.arc(x, y, 9, Math.PI, 0); g.closePath(); g.fill();
        g.strokeStyle = '#e7b9a0'; g.lineWidth = 1.5; for (const a of [-.6, 0, .6]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 9, y - Math.cos(a) * 9); g.stroke(); }
      }
      // Alles nach Tiefe sortiert zeichnen
      const dinge = HINDERNISSE.map(o => ({ y: o.y, o }));
      S.sp.forEach((p, k) => dinge.push({ y: p.y, k }));
      dinge.sort((a, b) => a.y - b.y);
      for (const d of dinge) {
        if (d.o) { this.hindernis(g, d.o, t); continue; }
        const k = d.k, p = S.sp[k], r = p.f ? 38 : 27;
        g.fillStyle = 'rgba(0,0,0,.25)'; ellipse(g, p.x, p.y, r * 1.1, r * .38); g.fill();
        g.strokeStyle = A.teamFarbe(k); g.lineWidth = 4; ellipse(g, p.x, p.y, r * 1.15, r * .42); g.stroke();
        if (p.f && p.satz > 0) {   // Bewegungsstreifen beim Sprung-Satz
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 5; g.lineCap = 'round';
          for (const o of [-14, 0, 14]) { g.beginPath(); g.moveTo(p.x - p.sx * 30 - p.sy * o, p.y - 30 - p.sx * o * .2 - p.sy * 30); g.lineTo(p.x - p.sx * 90 - p.sy * o, p.y - 30 - p.sy * 90); g.stroke(); }
        }
        const bewegt = Math.hypot(p.vx, p.vy) > 30;
        A.figur(k, p.x, p.y, r, {
          schatten: false, laufen: bewegt && !p.gef, blick: p.blick,
          emo: p.f ? (S.endT > 0 ? 'froh' : 'normal') : p.gef ? 'traurig' : dist(p.x, p.y, S.sp[S.solo].x, S.sp[S.solo].y) < 200 ? 'schock' : 'normal',
          huepf: p.f && p.satz > 0 ? -.5 : 0,
        });
        if (p.f) this.maske(g, p.x, p.y, r, p.blick, t);
        if (p.gef) this.kaefig(g, p.x, p.y, Math.min(1, (S.t - p.gt) / .25));
      }
      for (const o of HINDERNISSE) if (o.a === 'palme') this.krone(g, o, t, S);
      // Ladeanzeige für den Sprung-Satz
      const f = S.sp[S.solo];
      if (f.cd > 0) {
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 6; g.beginPath(); g.arc(f.x, f.y - 122, 11, 0, TAU); g.stroke();
        g.strokeStyle = '#ffd23a'; g.beginPath(); g.arc(f.x, f.y - 122, 11, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f.cd / SATZ_CD)); g.stroke();
      }
      if (S.endT > 0) A.text('Alle gefangen!', WELT_B / 2, 140, 46, '#ffd23a');
      for (const e of A.neu(S)) {
        if (e.typ === 'fang') { Ton.spiel('treffer'); A.funken(e.x, e.y, '#ffd23a', 16, 300, 7); A.text3('Gefangen!', e.x, e.y - 40, '#ff8a8a'); }
        else if (e.typ === 'satz') Ton.spiel('sprung');
        else if (e.typ === 'alle') Ton.spiel('boese');
      }
    },
    // Grimm-Maske: rote Augenmaske mit Hörnern und Krönchen über dem Gesicht
    maske(g, x, y, r, blick, t) {
      const cy = y - r * 1.02, ey = cy - r * .12;
      g.save(); g.lineJoin = 'round';
      g.fillStyle = '#f2e6c9'; g.strokeStyle = '#3a0a14'; g.lineWidth = r * .05;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x + s * r * .4, cy - r * .7); g.quadraticCurveTo(x + s * r * .95, cy - r * 1.15, x + s * r * .85, cy - r * 1.5);
        g.quadraticCurveTo(x + s * r * .6, cy - r * 1.05, x + s * r * .15, cy - r * .85); g.closePath(); g.fill(); g.stroke();
      }
      g.fillStyle = '#ffd23a'; g.strokeStyle = '#a36b00';
      g.beginPath(); g.moveTo(x - r * .3, cy - r * .86); g.lineTo(x - r * .32, cy - r * 1.12); g.lineTo(x - r * .15, cy - r * .98); g.lineTo(x, cy - r * 1.2);
      g.lineTo(x + r * .15, cy - r * .98); g.lineTo(x + r * .32, cy - r * 1.12); g.lineTo(x + r * .3, cy - r * .86); g.closePath(); g.fill(); g.stroke();
      const gr = g.createLinearGradient(0, ey - r * .3, 0, ey + r * .3);
      gr.addColorStop(0, '#ff5a5a'); gr.addColorStop(1, '#a3162a');
      g.fillStyle = gr; g.strokeStyle = '#3a0a14';
      g.beginPath();
      g.moveTo(x - r * .78, ey - r * .12); g.quadraticCurveTo(x - r * .4, ey - r * .42, x, ey - r * .2); g.quadraticCurveTo(x + r * .4, ey - r * .42, x + r * .78, ey - r * .12);
      g.quadraticCurveTo(x + r * .7, ey + r * .3, x + r * .3, ey + r * .26); g.quadraticCurveTo(x, ey + r * .12, x - r * .3, ey + r * .26);
      g.quadraticCurveTo(x - r * .7, ey + r * .3, x - r * .78, ey - r * .12); g.closePath(); g.fill(); g.stroke();
      const bx = clamp(blick || 0, -1, 1) * r * .05;
      for (const s of [-1, 1]) {
        g.fillStyle = '#ffe066'; ellipse(g, x + s * r * .32, ey, r * .15, r * .1, s * .3); g.fill();
        g.fillStyle = '#1a0008'; ellipse(g, x + s * r * .32 + bx, ey + r * .01, r * .04, r * .08); g.fill();
      }
      g.restore();
    },
    // Käfig aus goldenen Stäben, a = 0..1 fällt von oben herab
    kaefig(g, x, y, a) {
      const h = 92, w = 34, oy = (1 - Ease.outBack(a)) * -120;
      g.save(); g.translate(x, y + oy);
      g.fillStyle = 'rgba(160,220,255,.18)'; rundRechteck(g, -w, -h, w * 2, h, 18); g.fill();
      g.strokeStyle = '#c98a10'; g.lineWidth = 5; g.lineCap = 'round';
      for (let i = 0; i <= 4; i++) { const bx = -w + i * w / 2; g.beginPath(); g.moveTo(bx, -h + (i % 4 ? 4 : 14)); g.lineTo(bx, 0); g.stroke(); }
      g.strokeStyle = '#ffd23a'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(-w - 4, 0); g.lineTo(w + 4, 0); g.stroke();
      g.beginPath(); g.moveTo(-w, -h + 14); g.quadraticCurveTo(0, -h - 14, w, -h + 14); g.stroke();
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(0, -h - 4, 7, 0, TAU); g.fill();
      g.restore();
    },
    hindernis(g, o, t) {
      if (o.a === 'stein') {
        bodenSchatten(g, o.x + 6, o.y + o.r * .3, o.r * 1.15, .3);
        const gr = g.createLinearGradient(0, o.y - o.r * 1.4, 0, o.y + o.r * .4);
        gr.addColorStop(0, '#b9bfcc'); gr.addColorStop(1, '#5f6573');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(o.x - o.r * 1.05, o.y + o.r * .2); g.quadraticCurveTo(o.x - o.r * 1.15, o.y - o.r * .9, o.x - o.r * .3, o.y - o.r * 1.25);
        g.quadraticCurveTo(o.x + o.r * .6, o.y - o.r * 1.4, o.x + o.r * 1.05, o.y - o.r * .5); g.quadraticCurveTo(o.x + o.r * 1.2, o.y + o.r * .3, o.x, o.y + o.r * .35); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)'; ellipse(g, o.x - o.r * .35, o.y - o.r * .85, o.r * .3, o.r * .14, -.4); g.fill();
        return;
      }
      // Palme: geschwungener Stamm (die Krone kommt in einem eigenen Durchgang darüber)
      bodenSchatten(g, o.x + 40, o.y + 6, 70, .18);
      const kx = o.x + 26, ky = o.y - 150;
      g.lineCap = 'round';
      g.strokeStyle = '#8a5a30'; g.lineWidth = 24;
      g.beginPath(); g.moveTo(o.x, o.y - 6); g.quadraticCurveTo(o.x - 4, ky + 70, kx, ky); g.stroke();
      g.strokeStyle = '#b07c48'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(o.x - 3, o.y - 8); g.quadraticCurveTo(o.x - 7, ky + 70, kx - 3, ky); g.stroke();
      g.strokeStyle = 'rgba(70,40,20,.45)'; g.lineWidth = 2.5;
      for (let i = 1; i < 8; i++) {
        const u = i / 8, x = (1 - u) * (1 - u) * o.x + 2 * u * (1 - u) * (o.x - 4) + u * u * kx, y = (1 - u) * (1 - u) * (o.y - 6) + 2 * u * (1 - u) * (ky + 70) + u * u * ky;
        g.beginPath(); g.moveTo(x - 11, y + 2); g.quadraticCurveTo(x, y - 4, x + 11, y + 2); g.stroke();
      }
    },
    // Palmenkrone, halb durchsichtig wenn jemand darunter steht
    krone(g, o, t, S) {
      const kx = o.x + 26, ky = o.y - 150 + Math.sin(t * 1.2 + o.x) * 2;
      const drunter = S.sp.some(p => Math.abs(p.x - kx) < 100 && p.y < o.y && p.y > ky - 20);
      g.save(); g.globalAlpha = drunter ? .55 : 1;
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + Math.sin(t * 1.5 + i) * .05;
        g.save(); g.translate(kx, ky); g.rotate(a);
        g.fillStyle = i % 2 ? '#2f9a46' : '#45b65a';
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, -28, 92, 8); g.quadraticCurveTo(44, 6, 0, 0); g.fill();
        g.strokeStyle = 'rgba(0,60,20,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(44, -12, 90, 8); g.stroke();
        g.restore();
      }
      g.fillStyle = '#7a4a26';
      for (const [dx, dy] of [[-8, 6], [7, 8], [0, -2]]) { g.beginPath(); g.arc(kx + dx, ky + dy, 8, 0, TAU); g.fill(); }
      g.restore();
    },
  });
})();
