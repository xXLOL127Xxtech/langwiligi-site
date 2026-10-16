// Minispiel „Jahrmarkt-Schiessen“: Scheiben in der Schiessbude abschiessen (Zeiger, nur online)
// Scheiben klappen an drei Schienen hoch, fahren seitlich und klappen wieder weg.
// Die Treffer wertet der Host mit der zuletzt bekannten Zeigerposition aus. Weil online etwa 50–150 ms
// Verzögerung dazukommen, zählt ein Schuss auch dann, wenn er die Scheibe an ihrer Position von kurz vorher trifft.
'use strict';
Minis.reg({
  id: 'zielscheiben', name: 'Jahrmarkt-Schiessen',
  text: 'Schiess die Scheiben ab, bevor sie wegklappen! Gold-Sterne geben 3 Punkte, Grimm-Scheiben kosten 2.',
  steuerung: { zeiger: 'Zielen mit dem Touchpad, Linksklick schiesst' },
  zeiger: true,
  formate: ['ffa', '2v2', '1v3', 'duell'],
  dauer: 30,
  // Schienen (y der Schiene, Fahrtrichtung). Die Scheibe sitzt STIEL px über der Schiene.
  SCHIENEN: [{ y: 340, dir: 1 }, { y: 530, dir: -1 }, { y: 720, dir: 1 }],
  STIEL: 72,
  NACHLADEN: .35,
  // Im Format 1 gegen 3 lädt der Einzelspieler schneller nach (er kämpft allein gegen drei Schützen um dieselben Scheiben)
  NACHLADEN_SOLO: .26,
  THEKE: 812,
  start(S, info) {
    S.sp = info.teilnehmer.map((p, k) => ({ p: 0, nl: 0, mX: 800, mY: 520, bz: 0, bw: 0 }));
    S.sch = []; S.id = 0; S.spawn = .3;
  },
  // Wie viel eine Scheibe wert ist
  wertVon(art) { return art === 'g' ? 3 : art === 'b' ? -2 : 1; },
  schritt(S, ein, dt, info) {
    // Neue Scheiben: anfangs gemütlich, gegen Ende schneller und häufiger
    S.spawn -= dt;
    const aktiv = S.sch.filter(s => s.st < 2).length;
    if (S.spawn <= 0 && aktiv < 11) {
      S.spawn = Math.max(.24, .38 - S.t * .005);
      const sch = wahl(this.SCHIENEN), r = Math.random();
      const art = r < .13 ? 'g' : r < .3 ? 'b' : 'n';
      const tempo = rnd(120, 200) * (1 + S.t / 50) * (art === 'g' ? 1.35 : 1);
      // Nicht direkt neben einer anderen Scheibe derselben Schiene hochklappen
      let x = 0;
      for (let v = 0; v < 6; v++) {
        x = sch.dir > 0 ? rnd(220, 1050) : rnd(550, 1380);
        if (!S.sch.some(s => s.ry === sch.y && Math.abs(s.x - x) < 130)) break;
      }
      S.sch.push({ id: ++S.id, x: Math.round(x), ry: sch.y, vx: sch.dir * Math.round(tempo), art, f: art === 'n' ? rndi(0, 2) : 0,
        r: art === 'g' ? 44 : 52, kY: 0, st: 0, lz: rnd(2.3, 3.6), tr: -1 });
    }
    for (const s of S.sch) {
      if (s.st === 0) { s.kY = Math.min(1, s.kY + dt * 5); if (s.kY >= 1) s.st = 1; }
      if (s.st < 2) {
        s.x += s.vx * dt; s.lz -= dt;
        if (s.lz <= 0 || s.x < 190 || s.x > 1410) { s.st = 2; Minis.ereignis(S, { typ: 'klapp' }); }
      } else { s.x += s.vx * dt * .3; s.kY = Math.max(0, s.kY - dt * (s.tr >= 0 ? 3 : 4.5)); }
    }
    S.sch = S.sch.filter(s => s.st < 2 || s.kY > 0);
    // Schüsse der Spieler
    // Reihenfolge wechselt jedes Bild, damit bei gleichzeitigen Schüssen niemand bevorzugt ist
    const n = S.sp.length; S.zug = ((S.zug || 0) + 1) % n;
    for (let i = 0; i < n; i++) {
      const k = (S.zug + i) % n, p = S.sp[k], e = ein[k];
      p.mX = Math.round(clamp(e.mx, 0, WELT_B)); p.mY = Math.round(clamp(e.my, 0, WELT_H));
      if (p.nl > 0) p.nl = Math.max(0, p.nl - dt);
      if (!e.cp || p.nl > 0) continue;
      p.nl = k === info.solo ? this.NACHLADEN_SOLO : this.NACHLADEN;
      // Vorderste getroffene Scheibe suchen, auch an ihrer Position vor 70 und 140 ms (Netz-Verzögerung)
      let ziel = null, best = 1e9;
      for (const s of S.sch) {
        if (s.st === 2 || s.kY < .5) continue;
        const cy = s.ry - this.STIEL;
        for (const zurueck of [0, .07, .14]) {
          const d = dist(e.mx, e.my, s.x - s.vx * zurueck, cy);
          if (d < s.r + 12 && d < best) { best = d; ziel = s; }
        }
      }
      if (!ziel) { Minis.ereignis(S, { typ: 'schuss', x: p.mX, y: p.mY, k }); continue; }
      const w = this.wertVon(ziel.art);
      ziel.tr = k; ziel.st = 2; p.p += w;
      Minis.ereignis(S, { typ: ziel.art === 'b' ? 'grimm' : 'treffer', x: Math.round(ziel.x), y: ziel.ry - this.STIEL, k, w, art: ziel.art });
    }
  },
  ki(S, k, stufe, info) {
    const p = S.sp[k];
    const B = [
      { tempo: 700, fehler: 34, reakt: .5, grimm: .3, vorhalt: 0 },
      { tempo: 1100, fehler: 20, reakt: .3, grimm: .08, vorhalt: .6 },
      { tempo: 1700, fehler: 9, reakt: .16, grimm: 0, vorhalt: 1 },
    ][stufe];
    const dt = 1 / 60;
    let ziel = S.sch.find(s => s.id === p.bz && s.st < 2);
    if (!ziel) {
      // Neues Ziel: nah am eigenen Zeiger, möglichst eines, das kein anderer Bot gerade anvisiert
      let best = 1e9;
      for (const s of S.sch) {
        if (s.st === 2 || s.kY < .2 || s.lz < .35) continue;
        // Ob ein Bot eine Grimm-Scheibe für eine normale hält, steht pro Scheibe fest
        if (s.art === 'b' && ((s.id * 37 + k * 11) % 100) / 100 >= B.grimm) continue;
        const d = dist(p.mX, p.mY, s.x, s.ry - this.STIEL);
        // Besetzt: ein anderer Bot zielt schon darauf und ist näher dran
        const besetzt = S.sp.some((q, j) => j !== k && q.bz === s.id && dist(q.mX, q.mY, s.x, s.ry - this.STIEL) < d);
        const wert = d / B.tempo + (besetzt ? .6 : 0) - (s.art === 'g' ? .35 : 0) + Math.random() * .25;
        if (wert < best) { best = wert; ziel = s; }
      }
      p.bz = ziel ? ziel.id : 0;
      p.bw = B.reakt * rnd(.7, 1.3);
      p.bfx = Math.round(rnd(-1, 1) * B.fehler); p.bfy = Math.round(rnd(-1, 1) * B.fehler);
    }
    if (!ziel) {
      // Nichts zu tun: Zeiger gemächlich zur Mitte des eigenen Bereichs
      const hx = 800 + Math.sin(S.t * .7 + k * 2) * 400, hy = 480;
      return { mx: p.mX + (hx - p.mX) * .03, my: p.mY + (hy - p.mY) * .03 };
    }
    const cy = ziel.ry - this.STIEL;
    const zx = ziel.x + ziel.vx * .12 * B.vorhalt + p.bfx, zy = cy + p.bfy;
    const d = dist(p.mX, p.mY, zx, zy), schritt = B.tempo * dt;
    const mx = d <= schritt ? zx : p.mX + (zx - p.mX) / d * schritt;
    const my = d <= schritt ? zy : p.mY + (zy - p.mY) / d * schritt;
    if (d < 60) p.bw -= dt;
    let cp = false;
    if (p.bw <= 0 && p.nl <= 0 && ziel.kY > .6 && dist(mx, my, ziel.x, cy) < ziel.r + 6) { cp = true; p.bz = 0; }
    return { mx, my, cp };
  },
  punkte(S) { return S.sp.map(p => p.p); },
  wert(S, k) { return S.sp[k].p; },
  // Zeigerposition: eigener Zeiger ohne Verzögerung, die anderen aus dem Zustand
  zeigerVon(S, A, k) { return k === A.ich ? { x: A.zeiger.x, y: A.zeiger.y } : { x: S.sp[k].mX, y: S.sp[k].mY }; },
  zeichne(g, S, A) {
    const t = A.t, n = S.sp.length;
    this.zeichneBude(g, t);
    // Schienen: dunkler Schlitz hinten, Scheiben, dann vordere Schienenleiste
    for (const sch of this.SCHIENEN) {
      g.fillStyle = 'rgba(20,6,10,.55)'; rundRechteck(g, 110, sch.y - 8, 1380, 26, 13); g.fill();
    }
    for (const s of S.sch) this.zeichneScheibe(g, s, A);
    for (const sch of this.SCHIENEN) this.zeichneSchiene(g, sch, t);
    // Theke mit den Schützen
    S.sp.forEach((p, k) => {
      const x = n === 1 ? 800 : 330 + k * (940 / Math.max(1, n - 1));
      A.figur(k, x, this.THEKE + 30, 38, { schatten: false, emo: p.nl > .2 ? 'froh' : 'normal', blick: (this.zeigerVon(S, A, k).x - x) / 600 });
    });
    this.zeichneTheke(g, S, A);
    // Fadenkreuze, das eigene zuoberst
    const reihe = [...S.sp.keys()].filter(k => k !== A.ich);
    if (A.ich >= 0 && A.ich < n) reihe.push(A.ich);
    for (const k of reihe) {
      const z = this.zeigerVon(S, A, k), p = S.sp[k];
      const nl = p.nl / (k === A.info.solo ? this.NACHLADEN_SOLO : this.NACHLADEN);
      this.fadenkreuz(g, z.x, z.y, A.farbe(k), A.teamFarbe(k), nl, k === A.ich, A.info.format);
    }
    for (const e of A.neu(S)) {
      if (e.typ === 'treffer') {
        Ton.spiel(e.art === 'g' ? 'stern' : 'treffer');
        A.funken(e.x, e.y, e.art === 'g' ? '#ffd23a' : A.farbe(e.k), e.art === 'g' ? 22 : 12, 300, 7);
        A.text3('+' + e.w, e.x, e.y - 60, e.art === 'g' ? '#ffd23a' : '#fff');
      } else if (e.typ === 'grimm') {
        Ton.spiel('boese'); A.funken(e.x, e.y, '#b23af0', 16, 280, 8); A.text3(String(e.w), e.x, e.y - 60, '#ff6b6b');
      } else if (e.typ === 'schuss') {
        if (e.k === A.ich) Ton.spiel('schuss');
        A.funken(e.x, e.y, 'rgba(255,240,220,.8)', 5, 120, 4);
      } else if (e.typ === 'klapp' && Math.random() < .5) Ton.spiel('weg');
    }
  },
  // Hintergrund: Samtwand, Holzrahmen, gestreiftes Vordach mit Glühbirnen
  zeichneBude(g, t) {
    const w = g.createLinearGradient(0, 0, 0, WELT_H);
    w.addColorStop(0, '#3a0d22'); w.addColorStop(.55, '#6e1530'); w.addColorStop(1, '#2a0716');
    g.fillStyle = w; g.fillRect(0, 0, WELT_B, WELT_H);
    // Samtfalten
    for (let x = 90; x < 1510; x += 70) {
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 36, 150, 22, 700);
      g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x + 6, 150, 16, 700);
    }
    // Lichtkegel von oben
    const l = g.createRadialGradient(800, 120, 50, 800, 300, 760);
    l.addColorStop(0, 'rgba(255,220,160,.28)'); l.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = l; g.fillRect(0, 0, WELT_B, WELT_H);
    // Plüsch-Sterne als Preise an den Seiten
    for (const [x, y, r, rot] of [[150, 230, 26, .2], [1450, 230, 26, -.2], [150, 640, 22, -.1], [1450, 640, 22, .15]]) {
      g.strokeStyle = 'rgba(255,230,180,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 160); g.lineTo(x, y - r); g.stroke();
      zeichneStern(g, x, y + Math.sin(t * 1.6 + x) * 4, r, rot + Math.sin(t * 1.3 + y) * .1);
    }
    // Holzpfosten links und rechts
    const holz = g.createLinearGradient(0, 0, 100, 0);
    holz.addColorStop(0, '#5b3317'); holz.addColorStop(.45, '#a9692f'); holz.addColorStop(1, '#6b3d19');
    g.fillStyle = holz;
    g.fillRect(0, 0, 96, WELT_H);
    g.save(); g.translate(WELT_B, 0); g.scale(-1, 1); g.fillRect(0, 0, 96, WELT_H); g.restore();
    g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 3;
    for (const x0 of [0, WELT_B - 96]) for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x0 + i * 24, 0); g.lineTo(x0 + i * 24, WELT_H); g.stroke(); }
    // Vordach mit Bogenkante
    const top = 72, unten = 150;
    for (let i = 0; i < 16; i++) {
      const x = i * 100;
      g.fillStyle = i % 2 ? '#fff4ea' : '#e2323f';
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + 100, top); g.lineTo(x + 100, unten);
      g.quadraticCurveTo(x + 50, unten + 34, x, unten); g.closePath(); g.fill();
    }
    const sch = g.createLinearGradient(0, top, 0, unten + 30);
    sch.addColorStop(0, 'rgba(0,0,0,.25)'); sch.addColorStop(.3, 'rgba(0,0,0,0)'); sch.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = sch; g.fillRect(0, top, WELT_B, unten + 30 - top);
    g.fillStyle = '#7a1420'; g.fillRect(0, top - 6, WELT_B, 10);
    // Glühbirnen, die abwechselnd blinken
    for (let i = 0; i < 16; i++) {
      const x = i * 100 + 50, y = unten + 24, an = ((t * 3 | 0) + i) % 3 !== 0;
      g.fillStyle = an ? '#fff2a8' : '#a08850';
      g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
      if (an) { g.fillStyle = 'rgba(255,230,120,.25)'; g.beginPath(); g.arc(x, y, 20, 0, TAU); g.fill(); }
    }
  },
  zeichneSchiene(g, sch, t) {
    const gr = g.createLinearGradient(0, sch.y + 6, 0, sch.y + 28);
    gr.addColorStop(0, '#d9dde6'); gr.addColorStop(.5, '#8a90a0'); gr.addColorStop(1, '#4b505e');
    g.fillStyle = gr; rundRechteck(g, 104, sch.y + 6, 1392, 20, 10); g.fill();
    // Nieten, die mit der Laufrichtung wandern
    g.fillStyle = 'rgba(40,44,56,.7)';
    const off = ((t * 60 * sch.dir) % 80 + 80) % 80;
    for (let x = 120 + off; x < 1490; x += 80) { g.beginPath(); g.arc(x, sch.y + 16, 3.5, 0, TAU); g.fill(); }
  },
  // Eine Scheibe am Stiel, klappt um die Schiene (kY 0..1)
  zeichneScheibe(g, s, A) {
    if (s.kY <= 0) return;
    const r = s.r, cy = -this.STIEL;
    g.save(); g.translate(s.x, s.ry + 10); g.scale(1, s.kY);
    // Stiel
    g.fillStyle = '#6b4a2b'; g.fillRect(-6, cy, 12, this.STIEL);
    if (s.art === 'g') {
      g.fillStyle = 'rgba(255,220,90,.28)'; g.beginPath(); g.arc(0, cy, r * 1.45, 0, TAU); g.fill();
      zeichneStern(g, 0, cy, r, Math.sin(A.t * 6 + s.id) * .15);
    } else if (s.art === 'b') {
      g.fillStyle = '#2b1240'; g.beginPath(); g.arc(0, cy, r, 0, TAU); g.fill();
      g.strokeStyle = '#f2c94c'; g.lineWidth = 5; g.stroke();
      g.save(); g.beginPath(); g.arc(0, cy, r - 3, 0, TAU); g.clip();
      zeichneGrimm(g, 0, cy + r * .78, r * .62, A.t, s.tr >= 0);
      g.restore();
    } else if (s.f === 1) {
      // Ente mit kleiner Zielscheibe auf dem Bauch
      g.fillStyle = '#ffcf33'; g.strokeStyle = '#b8860b'; g.lineWidth = 4;
      ellipse(g, 0, cy + 8, r, r * .7); g.fill(); g.stroke();
      const dir = Math.sign(s.vx) || 1;
      g.beginPath(); g.arc(dir * r * .55, cy - r * .55, r * .42, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(dir * r * .9, cy - r * .62); g.lineTo(dir * r * 1.3, cy - r * .5); g.lineTo(dir * r * .9, cy - r * .4); g.closePath(); g.fill();
      g.fillStyle = '#1a1a2a'; g.beginPath(); g.arc(dir * r * .66, cy - r * .66, 5, 0, TAU); g.fill();
      for (const [rr, f] of [[r * .42, '#e2323f'], [r * .28, '#fff'], [r * .14, '#e2323f']]) { g.fillStyle = f; g.beginPath(); g.arc(-dir * r * .15, cy + 10, rr, 0, TAU); g.fill(); }
    } else {
      // Klassische Scheibe, Variante 2 mit blauen Ringen
      const f1 = s.f === 2 ? '#2f7de1' : '#e2323f';
      g.fillStyle = '#6b4a2b'; g.beginPath(); g.arc(0, cy, r + 4, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#fff6ea' : f1; g.beginPath(); g.arc(0, cy, r * (1 - i * .19), 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.25)'; ellipse(g, -r * .35, cy - r * .4, r * .35, r * .18, -.5); g.fill();
    }
    // Wer getroffen hat: Farbklecks in Spielerfarbe
    if (s.tr >= 0) {
      g.strokeStyle = A.farbe(s.tr); g.lineWidth = 8; g.beginPath(); g.arc(0, cy, r + 8, 0, TAU); g.stroke();
      g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0, cy, 7, 0, TAU); g.fill();
    }
    g.restore();
  },
  zeichneTheke(g, S, A) {
    const y = this.THEKE, n = S.sp.length;
    const gr = g.createLinearGradient(0, y, 0, WELT_H);
    gr.addColorStop(0, '#c98a4a'); gr.addColorStop(.12, '#8a5426'); gr.addColorStop(1, '#4e2c12');
    g.fillStyle = gr; g.fillRect(0, y, WELT_B, WELT_H - y);
    g.fillStyle = '#e0a45e'; g.fillRect(0, y, WELT_B, 8);
    g.strokeStyle = 'rgba(40,20,5,.35)'; g.lineWidth = 2;
    for (let x = 0; x < WELT_B; x += 160) { g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x, WELT_H); g.stroke(); }
    // Namensschilder unter den Schützen
    S.sp.forEach((p, k) => {
      const x = n === 1 ? 800 : 330 + k * (940 / Math.max(1, n - 1));
      g.fillStyle = 'rgba(20,10,4,.6)'; rundRechteck(g, x - 70, y + 26, 140, 44, 22); g.fill();
      g.strokeStyle = A.teamFarbe(k); g.lineWidth = 4; g.stroke();
      g.fillStyle = A.farbe(k); g.beginPath(); g.arc(x - 46, y + 48, 10, 0, TAU); g.fill();
      A.text(String(p.p), x + 12, y + 49, 28, '#ffd23a');
    });
  },
  // Fadenkreuz mit Nachlade-Bogen; im Teamformat mit Ring in Teamfarbe
  fadenkreuz(g, x, y, farbe, team, nl, eigen, format) {
    const r = eigen ? 30 : 25;
    g.save(); g.translate(x, y); g.lineCap = 'round';
    if (format === '2v2' || format === '1v3') { g.strokeStyle = team; g.lineWidth = 4; g.globalAlpha = .8; g.beginPath(); g.arc(0, 0, r + 9, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    for (const [lw, f] of [[eigen ? 9 : 7, 'rgba(10,6,20,.75)'], [eigen ? 5 : 3.5, farbe]]) {
      g.strokeStyle = f; g.lineWidth = lw;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(dx * r * .45, dy * r * .45); g.lineTo(dx * r * 1.35, dy * r * 1.35); }
      g.stroke();
    }
    g.fillStyle = farbe; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    if (nl > 0) {
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - nl)); g.stroke();
    }
    g.restore();
  },
});
