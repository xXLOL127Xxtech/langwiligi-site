// Minispiel „Sternbild nachfahren“: Ein Sternbild mit gedrückter Taste möglichst genau nachziehen (Zeiger, nur online)
// Jeder zeichnet in seinem eigenen Feld (2 nebeneinander oder 2×2). Gewertet wird pro Runde:
// Abdeckung der Strecke (50) + Genauigkeit (30, mal Abdeckung) + Zeit, falls der Ziel-Stern erreicht wurde (20).
// Die Zeichenspur wird kompakt gespeichert: nur alle 18 px ein Punkt, ganze Zahlen relativ zum Feld, höchstens 150 Punkte.
'use strict';
Minis.reg({
  id: 'nachfahren', name: 'Sternbild nachfahren',
  text: 'Fahr das Sternbild in deinem Feld vom grünen Start bis zum goldenen Ziel-Stern nach – schnell und genau!',
  steuerung: { zeiger: 'Taste gedrückt halten und ziehen (Touchpad), loslassen ist erlaubt' },
  zeiger: true,
  formate: ['ffa', '2v2', 'duell'],
  RUNDEN: 3,
  ZEIT: 15,           // Sekunden pro Runde
  ZEIG: 1.3,          // Sternbild erscheint
  WERT: 2.4,          // Rundenwertung anzeigen
  ABSTAND: 18,        // Mindestabstand der gespeicherten Spurpunkte
  MAXPUNKTE: 150,
  TOL: 26,            // so nah muss die Spur einer Stelle des Pfads kommen, damit sie als abgedeckt gilt
  // Vorlagen in Einheitskoordinaten (0..1)
  VORLAGEN: [
    { name: 'Grosser Wagen', p: [[.05, .3], [.2, .22], [.36, .3], [.5, .42], [.56, .78], [.86, .86], [.94, .5], [.62, .42]] },
    { name: 'Kassiopeia', p: [[.04, .22], [.27, .8], [.5, .36], [.73, .82], [.96, .2]] },
    { name: 'Herz', p: [[.5, .95], [.12, .55], [.08, .22], [.3, .06], [.5, .28], [.7, .06], [.92, .22], [.86, .58]] },
    { name: 'Blitz', p: [[.78, .02], [.4, .36], [.62, .42], [.3, .75], [.48, .78], [.2, .98]] },
    { name: 'Drache', p: [[.04, .6], [.2, .2], [.38, .7], [.56, .25], [.74, .75], [.96, .35]] },
    { name: 'Haus', p: [[.15, .95], [.15, .42], [.5, .06], [.85, .42], [.85, .95], [.4, .95]] },
    { name: 'Funkelstern', p: [[.2, .95], [.5, .05], [.8, .95], [.05, .38], [.95, .38]] },
  ],
  start(S, info) {
    S.sp = info.teilnehmer.map((p, k) => ({ p: 0, rp: 0, c: 0, a: 0, z: 0, f: 0, spur: [], mX: 800, mY: 480, md: 0, bd: -1 }));
    S.runde = 0; S.benutzt = [];
    this.neueRunde(S);
  },
  neueRunde(S) {
    let i;
    do i = rndi(0, this.VORLAGEN.length - 1); while (S.benutzt.includes(i));
    S.benutzt.push(i); S.vi = i;
    const spiegeln = Math.random() < .5;
    S.pts = this.VORLAGEN[i].p.map(([u, v]) => [spiegeln ? 1 - u : u, v]);
    S.ph = 'zeig'; S.pt = 0; S.runde++;
    for (const p of S.sp) { p.spur = []; p.f = 0; p.rp = 0; p.bd = -1; p.ab = 1; }
    Minis.ereignis(S, { typ: 'runde' });
  },
  // Feld von Teilnehmer k (Weltkoordinaten); links bleibt Platz für den Rand der Webseite
  feld(n, k) {
    const x0 = 160, y0 = 132, b = 1430, h = 760, sp = 18;
    if (n <= 2) { const w = (b - sp) / 2; return { x: x0 + k * (w + sp), y: y0, w, h }; }
    const w = (b - sp) / 2, hh = (h - sp) / 2;
    return { x: x0 + (k % 2) * (w + sp), y: y0 + Math.floor(k / 2) * (hh + sp), w, h: hh };
  },
  // Sternbild-Punkte im Feld f
  pfad(S, f) {
    const bh = f.h - 100, bw = Math.min(f.w - 90, bh * 1.8);
    const bx = f.x + (f.w - bw) / 2, by = f.y + 60;
    return S.pts.map(([u, v]) => [bx + u * bw, by + v * bh]);
  },
  // Abstand Punkt–Strecke
  dSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  },
  dPfad(P, x, y) {
    let m = 1e9;
    for (let i = 1; i < P.length; i++) m = Math.min(m, this.dSeg(x, y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]));
    return m;
  },
  // Spur in Striche (Weltkoordinaten) zerlegen; -1,-1 trennt Striche
  striche(spur, f) {
    const out = []; let akt = [];
    for (let i = 0; i < spur.length; i += 2) {
      if (spur[i] < 0) { if (akt.length) out.push(akt); akt = []; continue; }
      akt.push([spur[i] + f.x, spur[i + 1] + f.y]);
    }
    if (akt.length) out.push(akt);
    return out;
  },
  // Abdeckung (0..1) und Genauigkeit (0..1) einer Spur
  bewerte(S, k) {
    const f = this.feld(S.sp.length, k), P = this.pfad(S, f), striche = this.striche(S.sp[k].spur, f);
    const pkte = striche.flat();
    if (!pkte.length) return { c: 0, a: 0 };
    let n = 0, gedeckt = 0;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1], [bx, by] = P[i], l = dist(ax, ay, bx, by), m = Math.max(1, Math.round(l / 10));
      for (let j = 0; j <= m; j++) {
        if (j === m && i < P.length - 1) continue;
        const sx = lerp(ax, bx, j / m), sy = lerp(ay, by, j / m);
        n++;
        let ok = false;
        for (const s of striche) {
          if (s.length === 1) { if (dist(sx, sy, s[0][0], s[0][1]) < this.TOL) { ok = true; break; } continue; }
          for (let q = 1; q < s.length && !ok; q++) if (this.dSeg(sx, sy, s[q - 1][0], s[q - 1][1], s[q][0], s[q][1]) < this.TOL) ok = true;
          if (ok) break;
        }
        if (ok) gedeckt++;
      }
    }
    let summe = 0;
    for (const [x, y] of pkte) summe += this.dPfad(P, x, y);
    const mittel = summe / pkte.length;
    return { c: gedeckt / n, a: clamp(1 - (mittel - 6) / 34, 0, 1) };
  },
  schritt(S, ein, dt, info) {
    S.pt += dt;
    const n = S.sp.length;
    if (S.t > 59) { S.fertig = true; return; }
    if (S.ph === 'zeig' && S.pt >= this.ZEIG) { S.ph = 'lauf'; S.pt = 0; Minis.ereignis(S, { typ: 'los' }); }
    else if (S.ph === 'lauf' && (S.pt >= this.ZEIT || S.sp.every(p => p.f))) {
      // Rundenwertung
      S.sp.forEach((p, k) => {
        const b = this.bewerte(S, k);
        p.c = Math.round(b.c * 100); p.a = Math.round(b.a * 100);
        const zeit = p.f ? clamp((this.ZEIT - p.z) / this.ZEIT, 0, 1) : 0;
        p.rp = Math.round(50 * b.c + 30 * b.a * b.c + 20 * zeit);
        p.p += p.rp;
      });
      S.ph = 'wert'; S.pt = 0;
      Minis.ereignis(S, { typ: 'wertung' });
    } else if (S.ph === 'wert' && S.pt >= this.WERT) {
      if (S.runde >= this.RUNDEN) { S.fertig = true; return; }
      this.neueRunde(S);
    }
    S.sp.forEach((p, k) => {
      const e = ein[k];
      p.mX = Math.round(clamp(e.mx, 0, WELT_B)); p.mY = Math.round(clamp(e.my, 0, WELT_H)); p.md = e.md ? 1 : 0;
      if (S.ph !== 'lauf' || p.f) return;
      const f = this.feld(n, k);
      const drin = e.mx > f.x && e.mx < f.x + f.w && e.my > f.y && e.my < f.y + f.h;
      if (!e.md || !drin) { p.ab = 1; return; }
      const rx = Math.round(e.mx - f.x), ry = Math.round(e.my - f.y), s = p.spur, L = s.length;
      if (L >= this.MAXPUNKTE * 2) return;
      if (p.ab) {
        // Neuer Strich (nach Loslassen): Trennzeichen, ausser ganz am Anfang
        if (L && s[L - 2] >= 0) s.push(-1, -1);
        s.push(rx, ry); p.ab = 0;
      } else if (dist(rx, ry, s[L - 2], s[L - 1]) >= this.ABSTAND) s.push(rx, ry);
      else return;
      // Ziel-Stern erreicht? Dann nur, wenn genug von der Strecke abgefahren ist
      const P = this.pfad(S, f), Z = P[P.length - 1];
      if (dist(e.mx, e.my, Z[0], Z[1]) < 34 && this.bewerte(S, k).c >= .6) {
        p.f = 1; p.z = Math.round(S.pt * 10) / 10;
        Minis.ereignis(S, { typ: 'fertig', k, x: Math.round(Z[0]), y: Math.round(Z[1]) });
      }
    });
  },
  ki(S, k, stufe) {
    const p = S.sp[k], dt = 1 / 60, n = S.sp.length;
    const B = [{ tempo: 95, rauschen: 26, absetzen: .012 }, { tempo: 150, rauschen: 12, absetzen: .004 }, { tempo: 215, rauschen: 4, absetzen: 0 }][stufe];
    const f = this.feld(n, k);
    const zu = (zx, zy, v) => {
      const d = dist(p.mX, p.mY, zx, zy), s = v * dt;
      return d <= s ? [zx, zy] : [p.mX + (zx - p.mX) / d * s, p.mY + (zy - p.mY) / d * s];
    };
    if (S.ph !== 'lauf' || p.f) {
      const [mx, my] = zu(f.x + f.w / 2, f.y + f.h / 2, 300);
      return { mx, my, md: false };
    }
    const P = this.pfad(S, f);
    if (p.bd < 0) {
      // Erst zum Start-Stern
      const [mx, my] = zu(P[0][0], P[0][1], 1100);
      if (dist(mx, my, P[0][0], P[0][1]) < 3) p.bd = 0;
      return { mx, my, md: false };
    }
    // Den Pfad entlang, mit weichem Zittern je nach Stufe
    if (Math.random() < B.absetzen) p.bp = S.t + .25;
    if (S.t < p.bp) return { mx: p.mX, my: p.mY, md: false };
    p.bd += B.tempo * dt * (stufe === 0 ? .7 + .5 * Math.abs(Math.sin(S.t * 1.3 + k)) : 1);
    let rest = p.bd, x = P[P.length - 1][0], y = P[P.length - 1][1];
    for (let i = 1; i < P.length; i++) {
      const l = dist(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]);
      if (rest <= l) { x = lerp(P[i - 1][0], P[i][0], rest / l); y = lerp(P[i - 1][1], P[i][1], rest / l); break; }
      rest -= l;
    }
    const zit = Math.min(1, p.bd / 40);
    x += Math.sin(S.t * 2.3 + k * 1.9) * B.rauschen * zit; y += Math.cos(S.t * 1.9 + k * 2.7) * B.rauschen * zit;
    return { mx: x, my: y, md: true };
  },
  punkte(S) { return S.sp.map(p => p.p); },
  wert(S, k) { return S.sp[k].p; },
  zeigerVon(S, A, k) { return k === A.ich ? { x: A.zeiger.x, y: A.zeiger.y } : { x: S.sp[k].mX, y: S.sp[k].mY }; },
  zeichne(g, S, A) {
    const t = A.t, n = S.sp.length;
    // Nachthimmel
    const h = g.createLinearGradient(0, 0, 0, WELT_H);
    h.addColorStop(0, '#070a24'); h.addColorStop(.6, '#16164a'); h.addColorStop(1, '#2c1d5c');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, WELT_H);
    for (let i = 0; i < 90; i++) {
      const zx = Math.sin(i * 12.9898) * 43758.5453, zy = Math.sin(i * 78.233) * 12543.21;
      g.fillStyle = `rgba(255,255,240,${.25 + .3 * Math.sin(t * 1.5 + i)})`;
      g.beginPath(); g.arc((zx - Math.floor(zx)) * WELT_B, (zy - Math.floor(zy)) * WELT_H, 1 + (i % 3) * .7, 0, TAU); g.fill();
    }
    // Milchstrasse als weicher Schleier
    const m = g.createLinearGradient(0, 900, 1600, 0);
    m.addColorStop(.3, 'rgba(160,140,255,0)'); m.addColorStop(.5, 'rgba(170,150,255,.12)'); m.addColorStop(.7, 'rgba(160,140,255,0)');
    g.fillStyle = m; g.fillRect(0, 0, WELT_B, WELT_H);
    for (let k = 0; k < n; k++) this.zeichneFeld(g, S, A, k);
    // Mitte oben: Runde und Restzeit
    const rest = S.ph === 'lauf' ? Math.max(0, this.ZEIT - S.pt) : S.ph === 'zeig' ? this.ZEIT : 0;
    const txt = 'Runde ' + S.runde + '/' + this.RUNDEN + (S.ph === 'wert' ? '' : '  ·  ' + Math.ceil(rest) + ' s');
    g.fillStyle = 'rgba(10,12,30,.8)'; rundRechteck(g, 875 - 150, 84, 300, 40, 20); g.fill();
    A.text(txt, 875, 105, 24, rest < 4.5 && S.ph === 'lauf' ? '#ff8a8a' : '#fff');
    // Zeiger: eigener zuoberst, andere als kleine Leuchtpunkte
    const reihe = [...S.sp.keys()].filter(k => k !== A.ich);
    if (A.ich >= 0 && A.ich < n) reihe.push(A.ich);
    for (const k of reihe) {
      const z = this.zeigerVon(S, A, k), eigen = k === A.ich, unten = eigen ? A.zeiger.unten : S.sp[k].md;
      g.fillStyle = 'rgba(10,10,30,.7)'; g.beginPath(); g.arc(z.x, z.y, eigen ? 13 : 10, 0, TAU); g.fill();
      g.fillStyle = A.farbe(k); g.beginPath(); g.arc(z.x, z.y, eigen ? 9 : 7, 0, TAU); g.fill();
      if (unten) { g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(z.x, z.y, eigen ? 17 : 13, 0, TAU); g.stroke(); }
    }
    for (const e of A.neu(S)) {
      if (e.typ === 'runde') Ton.spiel('glueck');
      else if (e.typ === 'los') Ton.spiel('los');
      else if (e.typ === 'fertig') { Ton.spiel('stern'); A.funken(e.x, e.y, '#ffd23a', 20, 300, 7); }
      else if (e.typ === 'wertung') Ton.spiel('tusch');
    }
  },
  zeichneFeld(g, S, A, k) {
    const f = this.feld(S.sp.length, k), p = S.sp[k], eigen = k === A.ich, t = A.t;
    const team = A.info.format === '2v2';
    // Feld mit leicht hellerem Grund
    g.fillStyle = eigen ? 'rgba(60,70,150,.45)' : 'rgba(20,24,60,.55)';
    rundRechteck(g, f.x, f.y, f.w, f.h, 22); g.fill();
    g.strokeStyle = team ? A.teamFarbe(k) : A.farbe(k); g.lineWidth = eigen ? 6 : 3;
    g.globalAlpha = eigen ? 1 : .7; g.stroke(); g.globalAlpha = 1;
    if (eigen) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; rundRechteck(g, f.x - 6, f.y - 6, f.w + 12, f.h + 12, 26); g.stroke(); }
    // Kopf: Figur, Name, Status
    A.figur(k, f.x + 34, f.y + 52, 18, { schatten: false, emo: p.f ? 'froh' : 'normal', huepf: p.f ? Math.abs(Math.sin(t * 8)) * .4 : 0 });
    A.text(A.name(k) + (eigen ? '  (dein Feld)' : ''), f.x + 62, f.y + 30, 22, '#fff', 'left');
    if (p.f) A.text('Geschafft!', f.x + f.w - 20, f.y + 30, 22, '#ffd23a', 'right');
    const P = this.pfad(S, f);
    // Sternbild: beim Zeigen nach und nach aufgebaut
    const anteil = S.ph === 'zeig' ? clamp(S.pt / (this.ZEIG * .8), 0, 1) : 1;
    const sichtbar = anteil * (P.length - 1);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(150,180,255,.22)'; g.lineWidth = 22;
    this.linie(g, P, sichtbar); g.stroke();
    g.setLineDash([4, 10]); g.strokeStyle = 'rgba(210,225,255,.8)'; g.lineWidth = 3;
    this.linie(g, P, sichtbar); g.stroke();
    g.restore();
    P.forEach(([x, y], i) => {
      if (i > sichtbar + .01) return;
      const funkel = 1 + Math.sin(t * 4 + i * 1.7) * .12;
      if (i === 0) { g.fillStyle = 'rgba(80,230,140,.3)'; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill(); sternPfad(g, x, y, 15 * funkel, 7, 5); g.fillStyle = '#5be38f'; g.fill(); }
      else if (i === P.length - 1) { g.fillStyle = 'rgba(255,220,90,.3)'; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); zeichneStern(g, x, y, 20 * funkel, t * .8); }
      else { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); g.fillStyle = '#fff'; sternPfad(g, x, y, 8 * funkel, 3.5, 4); g.fill(); }
    });
    // Eigene Spur in Spielerfarbe
    const striche = this.striche(p.spur, f);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [lw, farbe, alpha] of [[12, A.farbe(k), .3], [5, A.farbe(k), 1]]) {
      g.strokeStyle = farbe; g.lineWidth = lw; g.globalAlpha = alpha;
      for (const s of striche) {
        g.beginPath(); g.moveTo(s[0][0], s[0][1]);
        for (let i = 1; i < s.length; i++) g.lineTo(s[i][0], s[i][1]);
        if (s.length === 1) g.lineTo(s[0][0] + .1, s[0][1]);
        g.stroke();
      }
    }
    g.restore();
    // Rundenwertung
    if (S.ph === 'wert') {
      const sk = Ease.outBack(clamp(S.pt / .4, 0, 1));
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2 + 10;
      g.fillStyle = 'rgba(10,10,30,.78)'; rundRechteck(g, cx - 170, cy - 62, 340, 124, 24); g.fill();
      A.text('+' + p.rp, cx, cy - 22, 50 * sk, '#ffd23a');
      A.text('Strecke ' + p.c + '%  ·  Genau ' + p.a + '%' + (p.f ? '  ·  Ziel ✓' : ''), cx, cy + 30, 20, '#dfe4ff');
    }
  },
  // Linienzug bis zum (gebrochenen) Index bis
  linie(g, P, bis) {
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) {
      if (i <= bis) g.lineTo(P[i][0], P[i][1]);
      else { const r = bis - (i - 1); if (r > 0) g.lineTo(lerp(P[i - 1][0], P[i][0], r), lerp(P[i - 1][1], P[i][1], r)); break; }
    }
  },
});
