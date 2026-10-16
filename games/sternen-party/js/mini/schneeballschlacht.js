// Minispiel „Schneeballschlacht“: Draufsicht, laufen mit Tasten, zielen und werfen mit dem Zeiger (nur online)
// Schneemauern und Tannen geben Deckung. Wer getroffen wird, ist kurz eingefroren und danach 1 s geschützt.
// Treffer wertet der Host aus; die Bälle fliegen sichtbar und eher langsam, so fällt die Netz-Verzögerung kaum auf.
'use strict';
Minis.reg({
  id: 'schneeballschlacht', name: 'Schneeballschlacht',
  text: 'Triff die anderen mit Schneebällen und versteck dich hinter den Schneemauern! Jeder Treffer gibt Punkte, Getroffene frieren kurz ein.',
  steuerung: { tasten: 'WASD oder Pfeile laufen', zeiger: 'Zielen mit dem Touchpad, Linksklick wirft' },
  zeiger: true,
  formate: ['ffa', '2v2', '1v3', 'duell'],
  dauer: 40,
  TEMPO: 330,         // Laufgeschwindigkeit
  BALL_V: 900,        // Schneeball-Geschwindigkeit
  REICHWEITE: 1000,
  PR: 30,             // Radius einer Figur (Kollision)
  NACHLADEN: .5,
  EINGEFROREN: .8,
  SCHUTZ: 1,          // unverwundbar nach dem Auftauen
  // Einzelspieler bei 1 gegen 3: wirft doppelt so schnell und bleibt nach einem Treffer länger geschützt.
  // Er hat drei Ziele, die drei anderen teilen sich eines: darum zählt ein Treffer der Dreiergruppe 4 Punkte
  // (Team-Wertung über den Durchschnitt, laut Bot-Simulation so etwa ausgeglichen).
  SOLO: { nachladen: .25, schutz: 1.4, gruppenWert: 4 },
  RAND: { x0: 40, y0: 95, x1: 1560, y1: 875 },
  // Hindernisse: m = Schneemauer, t = Tannengruppe (beide halten Bälle auf)
  MAUERN: [
    { x: 40, y: 360, b: 150, h: 210, a: 't' }, { x: 1410, y: 360, b: 150, h: 210, a: 't' },
    { x: 775, y: 405, b: 50, h: 160, a: 'm' },
    { x: 680, y: 230, b: 240, h: 44, a: 'm' }, { x: 680, y: 700, b: 240, h: 44, a: 'm' },
    { x: 410, y: 165, b: 46, h: 165, a: 'm' }, { x: 1144, y: 165, b: 46, h: 165, a: 'm' },
    { x: 410, y: 640, b: 46, h: 165, a: 'm' }, { x: 1144, y: 640, b: 46, h: 165, a: 'm' },
    { x: 300, y: 462, b: 150, h: 44, a: 'm' }, { x: 1150, y: 462, b: 150, h: 44, a: 'm' },
  ],
  feind(info, k, j) {
    if (j === k) return false;
    if (info.format === '2v2' || info.format === '1v3') return info.teams[k] !== info.teams[j];
    return true;
  },
  start(S, info) {
    const n = info.teilnehmer.length;
    let pos;
    if (info.format === '2v2') {
      const seiten = [[[130, 170], [130, 800]], [[1470, 170], [1470, 800]]], z = [0, 0];
      pos = info.teams.map(tm => seiten[tm][z[tm]++]);
    } else if (info.format === '1v3') {
      const rest = [[1470, 170], [1355, 485], [1470, 800]]; let z = 0;
      pos = info.teilnehmer.map((p, k) => k === info.solo ? [245, 485] : rest[z++]);
    } else {
      // Ecken zufällig verteilen; zu zweit immer schräg gegenüber
      const ecken = mischen([[[130, 170], [1470, 800]], [[1470, 170], [130, 800]]]).flat();
      pos = n === 2 ? ecken.slice(0, 2) : mischen(ecken).slice(0, n);
    }
    S.sp = pos.map(([x, y], k) => ({ x, y, vx: 0, vy: 0, p: 0, nl: 0, fr: 0, un: 0, bl: x < 800 ? 1 : -1, mX: 800, mY: 485, bv: 0 }));
    S.b = []; S.id = 0;
  },
  // Kreis (x, y, r) aus allen Hindernissen und dem Rand schieben
  schieben(p, r) {
    const R = this.RAND;
    p.x = clamp(p.x, R.x0 + r, R.x1 - r); p.y = clamp(p.y, R.y0 + r, R.y1 - r);
    for (const m of this.MAUERN) {
      const nx = clamp(p.x, m.x, m.x + m.b), ny = clamp(p.y, m.y, m.y + m.h);
      const dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d > 0) { p.x = nx + dx / d * r; p.y = ny + dy / d * r; }
      else {
        // Mittelpunkt steckt in der Mauer: kürzester Weg hinaus
        const l = p.x - m.x, re = m.x + m.b - p.x, o = p.y - m.y, u = m.y + m.h - p.y, mn = Math.min(l, re, o, u);
        if (mn === l) p.x = m.x - r; else if (mn === re) p.x = m.x + m.b + r; else if (mn === o) p.y = m.y - r; else p.y = m.y + m.h + r;
      }
    }
  },
  inMauer(x, y, rand = 0) {
    for (const m of this.MAUERN) if (x > m.x - rand && x < m.x + m.b + rand && y > m.y - rand && y < m.y + m.h + rand) return m;
    return null;
  },
  // Freie Sicht zwischen zwei Punkten (in Schritten von 18 px geprüft)
  sicht(ax, ay, bx, by) {
    const d = dist(ax, ay, bx, by), n = Math.ceil(d / 18);
    for (let i = 1; i < n; i++) if (this.inMauer(lerp(ax, bx, i / n), lerp(ay, by, i / n), 8)) return false;
    return true;
  },
  schritt(S, ein, dt, info) {
    S.sp.forEach((p, k) => {
      const e = ein[k];
      p.mX = Math.round(clamp(e.mx, 0, WELT_B)); p.mY = Math.round(clamp(e.my, 0, WELT_H));
      if (p.nl > 0) p.nl = Math.max(0, p.nl - dt);
      if (p.un > 0) p.un = Math.max(0, p.un - dt);
      if (p.fr > 0) { p.fr = Math.max(0, p.fr - dt); p.vx = p.vy = 0; return; }
      // Laufen (diagonal nicht schneller)
      let ex = e.x || 0, ey = e.y || 0;
      const l = Math.hypot(ex, ey); if (l > 1) { ex /= l; ey /= l; }
      const ax = p.x, ay = p.y;
      p.x += ex * this.TEMPO * dt; p.y += ey * this.TEMPO * dt;
      this.schieben(p, this.PR);
      p.vx = Math.round((p.x - ax) / dt); p.vy = Math.round((p.y - ay) / dt);
      if (Math.abs(e.mx - p.x) > 20) p.bl = e.mx > p.x ? 1 : -1;
      // Werfen in Richtung Zeiger
      if (e.cp && p.nl <= 0) {
        const dx = e.mx - p.x, dy = e.my - p.y, d = Math.hypot(dx, dy) || 1;
        p.nl = k === info.solo ? this.SOLO.nachladen : this.NACHLADEN;
        S.b.push({ id: ++S.id, x: Math.round(p.x + dx / d * 34), y: Math.round(p.y - 10 + dy / d * 34), vx: dx / d * this.BALL_V, vy: dy / d * this.BALL_V, k, l: this.REICHWEITE });
        Minis.ereignis(S, { typ: 'wurf', k });
      }
    });
    // Schneebälle fliegen lassen
    for (const b of S.b) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.l -= this.BALL_V * dt;
      if (b.l <= 0 || b.x < 0 || b.x > WELT_B || b.y < 80 || b.y > WELT_H || this.inMauer(b.x, b.y, 6)) {
        b.weg = true; Minis.ereignis(S, { typ: 'platsch', x: Math.round(b.x), y: Math.round(b.y) }); continue;
      }
      for (let j = 0; j < S.sp.length; j++) {
        const q = S.sp[j];
        if (!this.feind(info, b.k, j) || q.un > 0) continue;
        if (dist(b.x, b.y, q.x, q.y - 12) > this.PR + 14) continue;
        b.weg = true;
        const solo = j === info.solo;
        q.fr = this.EINGEFROREN; q.un = this.EINGEFROREN + (solo ? this.SOLO.schutz : this.SCHUTZ);
        const w = info.format === '1v3' && b.k !== info.solo ? this.SOLO.gruppenWert : 1;
        S.sp[b.k].p += w;
        Minis.ereignis(S, { typ: 'treffer', x: Math.round(q.x), y: Math.round(q.y - 30), k: b.k, j, w });
        break;
      }
    }
    S.b = S.b.filter(b => !b.weg);
    for (const b of S.b) { b.x = Math.round(b.x); b.y = Math.round(b.y); }
  },
  ki(S, k, stufe, info) {
    const p = S.sp[k], dt = 1 / 60;
    const B = [
      { vorhalt: 0, fehler: 110, deckung: .25, ausweichen: 0, wurfRate: .03, geduld: 0 },
      { vorhalt: .6, fehler: 34, deckung: .6, ausweichen: .3, wurfRate: .25, geduld: .5 },
      { vorhalt: 1, fehler: 12, deckung: .6, ausweichen: .35, wurfRate: 1, geduld: 1 },
    ][stufe];
    // Ziel: nächster Gegner, geschützte Gegner nur zur Not
    let ziel = null, best = 1e9;
    S.sp.forEach((q, j) => {
      if (!this.feind(info, k, j)) return;
      const d = dist(p.x, p.y, q.x, q.y) + (q.un > .3 ? 600 : 0) + (this.sicht(p.x, p.y, q.x, q.y) ? 0 : 250);
      if (d < best) { best = d; ziel = q; }
    });
    if (!ziel) return {};
    // Zielpunkt mit Vorhalt und Streuung (pro Bot langsam wandernd, nicht zappelig)
    const flug = dist(p.x, p.y, ziel.x, ziel.y) / this.BALL_V;
    const st = Math.sin(S.t * 1.7 + k * 2.1), st2 = Math.cos(S.t * 1.3 + k);
    const ax = ziel.x + ziel.vx * flug * B.vorhalt + st * B.fehler, ay = ziel.y - 12 + ziel.vy * flug * B.vorhalt + st2 * B.fehler;
    // Zeiger weich zum Zielpunkt bewegen
    const zd = dist(p.mX, p.mY, ax, ay), zs = 2600 * dt;
    const mx = zd <= zs ? ax : p.mX + (ax - p.mX) / zd * zs, my = zd <= zs ? ay : p.mY + (ay - p.mY) / zd * zs;
    const frei = this.sicht(p.x, p.y - 10, ax, ay);
    let cp = false;
    if (p.nl <= 0 && frei && zd < 60 && (ziel.un <= flug || Math.random() > B.geduld) && Math.random() < B.wurfRate) {
      cp = true; p.bv = S.t + rnd(.4, 1.1) * B.deckung;
    }
    // Laufen: nach dem Wurf hinter Deckung, sonst Sicht auf den Gegner suchen
    let zx, zy;
    if (S.t < p.bv) {
      let bestM = 1e9; zx = p.x; zy = p.y;
      for (const m of this.MAUERN) {
        const cx = m.x + m.b / 2, cy = m.y + m.h / 2;
        const dx = cx - ziel.x, dy = cy - ziel.y, d = Math.hypot(dx, dy) || 1;
        const versatz = Math.max(m.b, m.h) / 2 + 40;
        const sx = cx + dx / d * versatz, sy = cy + dy / d * versatz;
        const R = this.RAND;
        if (m.a === 't' || sx < R.x0 + 40 || sx > R.x1 - 40 || sy < R.y0 + 40 || sy > R.y1 - 40 || this.inMauer(sx, sy, this.PR)) continue;
        const kosten = dist(p.x, p.y, sx, sy) + (dist(sx, sy, ziel.x, ziel.y) < 260 ? 400 : 0);
        if (kosten < bestM) { bestM = kosten; zx = sx; zy = sy; }
      }
    } else if (!this.sicht(p.x, p.y, ziel.x, ziel.y) || dist(p.x, p.y, ziel.x, ziel.y) > 650) {
      // Um die Deckung herum auf den Gegner zu, leicht seitlich versetzt
      const dx = ziel.x - p.x, dy = ziel.y - p.y, d = Math.hypot(dx, dy) || 1, s = (k % 2 ? 1 : -1) * 160;
      zx = ziel.x - dx / d * 300 - dy / d * s; zy = ziel.y - dy / d * 300 + dx / d * s;
    } else {
      // Freie Sicht: seitlich hin und her pendeln, Abstand halten
      const dx = ziel.x - p.x, dy = ziel.y - p.y, d = Math.hypot(dx, dy) || 1, s = Math.sin(S.t * 2 + k * 1.7) * 120;
      zx = p.x - dy / d * s + (d < 380 ? -dx / d * 80 : 0); zy = p.y + dx / d * s + (d < 380 ? -dy / d * 80 : 0);
    }
    zx = clamp(zx, this.RAND.x0 + 60, this.RAND.x1 - 60); zy = clamp(zy, this.RAND.y0 + 60, this.RAND.y1 - 60);
    let x = zx - p.x, y = zy - p.y;
    const l = Math.hypot(x, y);
    if (l < 12) { x = 0; y = 0; } else { x /= l; y /= l; }
    // Festgefahren an einer Mauer: eine Weile quer ausweichen
    if (l >= 12 && p.fr <= 0 && Math.hypot(p.vx, p.vy) < 60 && !(S.t < p.bu)) { p.bu = S.t + rnd(.5, 1); p.bs = Math.random() < .5 ? 1 : -1; }
    if (S.t < p.bu) { const qx = -y * p.bs, qy = x * p.bs; x = qx * .85 + x * .15; y = qy * .85 + y * .15; }
    // Anfliegenden Bällen seitlich ausweichen
    if (B.ausweichen > 0) for (const b of S.b) {
      if (!this.feind(info, b.k, k)) continue;
      const rx = p.x - b.x, ry = p.y - b.y, vor = (rx * b.vx + ry * b.vy) / this.BALL_V;
      if (vor < 0 || vor > 260) continue;
      const quer = (rx * b.vy - ry * b.vx) / this.BALL_V;
      if (Math.abs(quer) < 50 && ((b.id * 7 + k) % 10) / 10 < B.ausweichen) { const s = quer >= 0 ? 1 : -1; x = b.vy / this.BALL_V * s; y = -b.vx / this.BALL_V * s; }
    }
    return { x, y, mx, my, cp };
  },
  punkte(S) { return S.sp.map(p => p.p); },
  wert(S, k) { return S.sp[k].p; },
  zeigerVon(S, A, k) { return k === A.ich ? { x: A.zeiger.x, y: A.zeiger.y } : { x: S.sp[k].mX, y: S.sp[k].mY }; },
  zeichne(g, S, A) {
    const t = A.t, info = A.info;
    this.zeichneBoden(g);
    // Mauern und Tannen nach unten sortiert, Figuren dazwischen
    const dinge = [];
    for (const m of this.MAUERN) dinge.push({ y: m.y + m.h, m });
    S.sp.forEach((p, k) => dinge.push({ y: p.y + 22, k }));
    dinge.sort((a, b) => a.y - b.y);
    // Schatten der Bälle liegen auf dem Boden, unter allem anderen
    for (const b of S.b) {
      g.fillStyle = 'rgba(40,70,120,.22)'; ellipse(g, b.x, b.y + 16, 10, 4); g.fill();
    }
    for (const d of dinge) {
      if (d.m) { d.m.a === 't' ? this.zeichneTannen(g, d.m) : this.zeichneMauer(g, d.m); continue; }
      const k = d.k, p = S.sp[k];
      const blink = p.un > 0 && p.fr <= 0 && (t * 10 | 0) % 2;
      // Ring am Boden in Team- bzw. Spielerfarbe
      g.strokeStyle = A.teamFarbe(k); g.lineWidth = 5; ellipse(g, p.x, p.y + 22, 34, 11); g.stroke();
      bodenSchatten(g, p.x, p.y + 22, 30);
      const laeuft = Math.hypot(p.vx, p.vy) > 40;
      A.figur(k, p.x, p.y + 22, 28, { schatten: false, alpha: blink ? .45 : 1, blick: p.bl, laufen: laeuft,
        huepf: laeuft ? Math.abs(Math.sin(t * 14 + k)) * .25 : 0, emo: p.fr > 0 ? 'schock' : 'normal' });
      if (p.fr > 0) {
        // Eisblock
        g.fillStyle = 'rgba(170,220,255,.55)'; rundRechteck(g, p.x - 36, p.y - 50, 72, 78, 14); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(p.x - 24, p.y - 38); g.lineTo(p.x - 10, p.y - 44); g.stroke();
      }
      // Nachlade-Balken unter der Figur
      const nl = p.nl / (k === info.solo ? this.SOLO.nachladen : this.NACHLADEN);
      if (nl > 0) {
        g.fillStyle = 'rgba(20,30,60,.45)'; rundRechteck(g, p.x - 22, p.y + 38, 44, 7, 3.5); g.fill();
        g.fillStyle = '#fff'; rundRechteck(g, p.x - 22, p.y + 38, 44 * (1 - nl), 7, 3.5); g.fill();
      }
    }
    // Schneebälle mit Flugbogen
    for (const b of S.b) {
      const z = Math.sin(clamp(1 - b.l / this.REICHWEITE, 0, 1) * Math.PI) * 26 + 10;
      const gr = g.createRadialGradient(b.x - 4, b.y - z - 4, 2, b.x, b.y - z, 13);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b9d4f0');
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y - z, 12, 0, TAU); g.fill();
      g.strokeStyle = A.farbe(b.k); g.lineWidth = 2.5; g.stroke();
    }
    // Zielhilfe für den eigenen Spieler, Fadenkreuze für alle
    if (A.ich >= 0 && A.ich < S.sp.length) {
      const p = S.sp[A.ich], z = A.zeiger;
      g.save(); g.setLineDash([10, 12]); g.strokeStyle = 'rgba(40,70,140,.35)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(p.x, p.y - 12); g.lineTo(z.x, z.y); g.stroke(); g.restore();
    }
    const reihe = [...S.sp.keys()].filter(k => k !== A.ich);
    if (A.ich >= 0 && A.ich < S.sp.length) reihe.push(A.ich);
    for (const k of reihe) {
      const z = this.zeigerVon(S, A, k);
      this.fadenkreuz(g, z.x, z.y, A.farbe(k), k === A.ich);
    }
    for (const e of A.neu(S)) {
      if (e.typ === 'wurf') { if (e.k === A.ich) Ton.spiel('weg'); }
      else if (e.typ === 'platsch') A.funken(e.x, e.y, '#f4f9ff', 7, 160, 5);
      else if (e.typ === 'treffer') {
        Ton.spiel('treffer'); A.funken(e.x, e.y, '#ffffff', 16, 280, 7); A.funken(e.x, e.y, '#9fd3ff', 6, 200, 5);
        A.text3('+' + (e.w || 1), e.x, e.y - 40, A.farbe(e.k));
      }
    }
  },
  zeichneBoden(g) {
    const h = g.createLinearGradient(0, 0, 0, WELT_H);
    h.addColorStop(0, '#dfeefc'); h.addColorStop(1, '#f6fbff');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, WELT_H);
    // Sanfte Schneewellen
    g.fillStyle = 'rgba(150,185,230,.16)';
    for (let i = 0; i < 18; i++) {
      const zx = Math.sin(i * 12.9898) * 43758.5453, zy = Math.sin(i * 78.233) * 12543.21;
      ellipse(g, (zx - Math.floor(zx)) * WELT_B, 110 + (zy - Math.floor(zy)) * 760, 110 + (i % 4) * 30, 26 + (i % 3) * 8); g.fill();
    }
    // Gefrorener Teich in der Mitte (nur Deko, begehbar)
    const t = g.createLinearGradient(700, 420, 900, 560);
    t.addColorStop(0, 'rgba(150,210,245,.55)'); t.addColorStop(1, 'rgba(110,170,230,.55)');
    g.fillStyle = t; ellipse(g, 800, 485, 200, 70); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(690, 470); g.lineTo(740, 455); g.moveTo(860, 515); g.lineTo(910, 498); g.stroke();
    // Spielfeldrand: kleine Schneehügel
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let x = 0; x <= WELT_B; x += 80) { g.beginPath(); g.arc(x, WELT_H + 10, 46, 0, TAU); g.fill(); }
  },
  zeichneMauer(g, m) {
    // Vorderseite (schattiert) und Oberseite (hell), dazu Schneeblöcke
    const vorne = 20;
    g.fillStyle = '#9fbfe0'; rundRechteck(g, m.x - 4, m.y + 6, m.b + 8, m.h + vorne - 2, 12); g.fill();
    const gr = g.createLinearGradient(0, m.y - 6, 0, m.y + m.h);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dbe9f8');
    g.fillStyle = gr; rundRechteck(g, m.x - 4, m.y - 6, m.b + 8, m.h + 4, 12); g.fill();
    g.strokeStyle = 'rgba(120,160,210,.45)'; g.lineWidth = 2;
    const quer = m.b > m.h;
    g.beginPath();
    if (quer) for (let x = m.x + 40; x < m.x + m.b - 10; x += 44) { g.moveTo(x, m.y - 2); g.lineTo(x, m.y + m.h - 6); }
    else for (let y = m.y + 40; y < m.y + m.h - 10; y += 44) { g.moveTo(m.x + 2, y); g.lineTo(m.x + m.b - 2, y); }
    g.stroke();
  },
  zeichneTannen(g, m) {
    const baeume = [[.3, .25, 1], [.72, .4, .85], [.35, .7, .95], [.75, .88, .8]];
    for (const [fx, fy, s] of baeume) {
      const x = m.x + m.b * fx, y = m.y + m.h * fy + 30, r = 62 * s;
      g.fillStyle = 'rgba(60,90,140,.22)'; ellipse(g, x + 10, y + 8, r * .8, r * .3); g.fill();
      g.fillStyle = '#6b4a2b'; g.fillRect(x - 6, y - 14, 12, 20);
      for (let i = 0; i < 3; i++) {
        const yy = y - 12 - i * r * .42, br = r * (1 - i * .25);
        g.fillStyle = i % 2 ? '#2f8a57' : '#257048';
        g.beginPath(); g.moveTo(x - br * .75, yy); g.lineTo(x, yy - r * .75); g.lineTo(x + br * .75, yy); g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(x - br * .3, yy - r * .45); g.lineTo(x, yy - r * .75); g.lineTo(x + br * .3, yy - r * .45);
        g.quadraticCurveTo(x, yy - r * .38, x - br * .3, yy - r * .45); g.fill();
      }
    }
  },
  fadenkreuz(g, x, y, farbe, eigen) {
    const r = eigen ? 22 : 17;
    g.save(); g.translate(x, y); g.lineCap = 'round'; g.globalAlpha = eigen ? 1 : .75;
    for (const [lw, f] of [[eigen ? 8 : 6, 'rgba(20,30,60,.7)'], [eigen ? 4.5 : 3, farbe]]) {
      g.strokeStyle = f; g.lineWidth = lw;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(dx * r * .5, dy * r * .5); g.lineTo(dx * r * 1.4, dy * r * 1.4); }
      g.stroke();
    }
    g.restore();
  },
});
