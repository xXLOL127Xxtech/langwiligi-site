// Minispiel „Ballon-Pumpe“: so schnell wie möglich auf den Blasebalg hüpfen, bis drei Ballone platzen (Seitenansicht, nur Aktion)
'use strict';
Minis.reg({
  id: 'ballon-pumpe', name: 'Ballon-Pumpe',
  text: 'Hämmer auf die Aktionstaste und pump deinen Ballon auf, bis er platzt! Wer zuerst drei Ballone zum Platzen bringt, gewinnt.',
  steuerung: { tasten: 'Aktion so schnell wie möglich drücken (gedrückt halten zählt nicht)' },
  formate: ['ffa', '2v2', 'duell'],
  dauer: 40,
  BODEN: 800,                    // Höhe der Wiese
  DUESE: 590,                    // Höhe, wo der Ballon am Ständer hängt
  STOESSE: 30,                   // so viele Drücke braucht ein Ballon bei einfacher Kraft
  ZIEL: 3,                       // so viele Ballone muss man platzen lassen
  teams(info) { return info.format === '2v2' || info.format === '1v3'; },
  start(S, info) {
    const n = info.teilnehmer.length;
    S.st = []; S.sp = [];
    if (this.teams(info)) {
      // Pro Team ein grosser Ballon, alle aus dem Team pumpen mit. Der Einzelspieler bei 1 gegen 3 pumpt 3× so stark.
      const gross = [0, 1].map(tm => info.teilnehmer.filter((_, k) => info.teams[k] === tm).length);
      const mitte = [440, 1160];
      for (const tm of [0, 1]) {
        const mitglieder = info.teilnehmer.map((_, k) => k).filter(k => info.teams[k] === tm);
        const versatz = mitglieder.length === 1 ? [-170] : mitglieder.length === 2 ? [-180, 180] : [-270, -140, 150];
        const kraftJe = Math.max(...gross) / mitglieder.length;
        S.st.push({ x: mitte[tm], f: 0, n: 0, need: this.STOESSE * Math.max(...gross), tm, gross: true, wackX: 0 });
        mitglieder.forEach((k, i) => { S.sp[k] = { st: tm, px: mitte[tm] + versatz[i], kraft: kraftJe, hubY: 0, druecke: 0 }; });
      }
    } else {
      const abst = n >= 4 ? 360 : n === 3 ? 440 : 560;
      for (let k = 0; k < n; k++) {
        const sx = 770 + (k - (n - 1) / 2) * abst;
        S.st.push({ x: sx + 50, f: 0, n: 0, need: this.STOESSE, tm: k, gross: false, wackX: 0 });
        S.sp[k] = { st: k, px: sx - 90, kraft: 1, hubY: 0, druecke: 0 };
      }
    }
    S.kt = info.teilnehmer.map(() => rnd(.05, .3));   // nächster Druck der Bots
    S.sieger = -1;
  },
  schritt(S, ein, dt, info) {
    // Ballone verlieren ganz langsam Luft
    for (const st of S.st) st.f = Math.max(0, st.f - .012 * dt);
    S.sp.forEach((p, k) => {
      p.hubY = Math.max(0, p.hubY - dt * 7);
      if (!ein[k].ap) return;           // nur neue Tastendrücke zählen, Halten bringt nichts
      const st = S.st[p.st];
      p.hubY = 1; p.druecke++;
      st.f += p.kraft / st.need;
      if (st.f >= 1) {
        st.f = 0; st.n++;
        Minis.ereignis(S, { typ: 'platzt', st: p.st, n: st.n });
        if (st.n >= this.ZIEL && S.sieger < 0) { S.sieger = p.st; S.fertig = true; }
      }
    });
  },
  ki(S, k, stufe) {
    // Bots drücken je nach Stufe etwa 5, 7 oder 9 Mal pro Sekunde, mit etwas Zufall und kurzen Pausen
    if (S.t < S.kt[k]) return {};
    const rate = [5, 7, 9][stufe];
    let pause = 1 / rate * rnd(.65, 1.35);
    if (Math.random() < [.05, .025, .01][stufe]) pause += rnd(.2, .5);   // Luft holen
    S.kt[k] = S.t + pause;
    return { ap: true };
  },
  // Punkte = Fortschritt: geplatzte Ballone plus Füllung des aktuellen
  punkte(S) { return S.sp.map(p => { const st = S.st[p.st]; return Math.round((st.n + Math.min(st.f, .99)) * 100) / 100; }); },
  wert(S, k) { return S.st[S.sp[k].st].n + '/' + this.ZIEL; },
  // Farbe eines Ballons: Team- oder Spielerfarbe
  ballonFarbe(st, A) {
    if (st.gross) return TEAM_FARBEN[st.tm];
    return A.farbe(st.tm);
  },
  ballonRadius(st) { return st.gross ? 36 + st.f * 124 : 30 + st.f * 112; },
  zeichne(g, S, A) {
    const t = A.t, B = this.BODEN;
    // Himmel, Hügel, Wiese
    const h = g.createLinearGradient(0, 0, 0, B);
    h.addColorStop(0, '#62b8ff'); h.addColorStop(.75, '#c5ecff'); h.addColorStop(1, '#fff3d6');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, B);
    g.fillStyle = '#fff8c8'; g.beginPath(); g.arc(1460, 170, 60, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,248,200,.35)'; g.beginPath(); g.arc(1460, 170, 90, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 430 + t * 12) % (WELT_B + 300)) - 150, y = 200 + (i % 2) * 70;
      for (const [dx, dy, r] of [[0, 0, 34], [36, -12, 44], [76, 0, 32]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#a5dc7a';
    g.beginPath(); g.moveTo(0, B); g.quadraticCurveTo(250, 560, 560, 700); g.quadraticCurveTo(820, 600, 1100, 690); g.quadraticCurveTo(1380, 580, 1600, 660); g.lineTo(1600, B); g.closePath(); g.fill();
    g.fillStyle = '#8acb5e';
    g.beginPath(); g.moveTo(0, B); g.quadraticCurveTo(400, 690, 800, 740); g.quadraticCurveTo(1200, 680, 1600, 730); g.lineTo(1600, B); g.closePath(); g.fill();
    const w = g.createLinearGradient(0, B, 0, WELT_H);
    w.addColorStop(0, '#6cc04a'); w.addColorStop(1, '#4c9a34');
    g.fillStyle = w; g.fillRect(0, B, WELT_B, WELT_H - B);
    // Wimpelketten
    const farben = ['#ff5a5a', '#ffd23a', '#4f8ff7', '#43c463', '#ff8fc4'];
    for (const [x0, x1, y0] of [[-20, 820, 100], [780, 1620, 100]]) {
      g.strokeStyle = '#7a5a3a'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + 70, x1, y0); g.stroke();
      for (let i = 1; i < 14; i++) {
        const u = i / 14, x = x0 + (x1 - x0) * u, y = y0 + 4 * u * (1 - u) * 70 * .5 * 2 * .5 + 2 * u * (1 - u) * 70;
        g.fillStyle = farben[i % farben.length];
        g.beginPath(); g.moveTo(x - 14, y - 2); g.lineTo(x + 14, y - 2); g.lineTo(x + Math.sin(t * 3 + i) * 3, y + 30); g.closePath(); g.fill();
      }
    }

    // Stationen: Ständer, Schlauch, Ballon
    S.st.forEach((st, i) => {
      const farbe = this.ballonFarbe(st, A);
      const pumper = S.sp.map((p, k) => ({ p, k })).filter(o => o.p.st === i);
      // Schläuche von jedem Blasebalg zum Ständer
      g.strokeStyle = '#3a3f4f'; g.lineWidth = 9; g.lineCap = 'round';
      for (const { p } of pumper) {
        g.beginPath(); g.moveTo(p.px + (st.x > p.px ? 34 : -34), B - 12);
        g.bezierCurveTo((p.px + st.x) / 2, B + 22, (p.px + st.x) / 2, B + 22, st.x, B - 6); g.stroke();
      }
      // Ständer
      g.fillStyle = '#8a8f9e'; rundRechteck(g, st.x - 7, this.DUESE + 6, 14, B - this.DUESE - 6, 6); g.fill();
      g.fillStyle = '#5c6070'; rundRechteck(g, st.x - 34, B - 14, 68, 18, 8); g.fill();
      g.fillStyle = '#c9ccd6'; rundRechteck(g, st.x - 15, this.DUESE - 2, 30, 16, 5); g.fill();
      // Ballon
      const r = this.ballonRadius(st);
      const spann = clamp((st.f - .75) / .25, 0, 1);
      const wx = st.x + Math.sin(t * 38 + i) * spann * 6;
      const cy = this.DUESE - r * 1.05 - 6;
      const gr = g.createRadialGradient(wx - r * .35, cy - r * .4, r * .08, wx, cy, r * 1.1);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.18, farbe); gr.addColorStop(1, this.dunkler(farbe));
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(wx, cy, r * (1 - spann * .03), r * (1.08 + spann * .05), Math.sin(t * 1.5 + i) * .05, 0, TAU); g.fill();
      // Knoten
      g.fillStyle = this.dunkler(farbe);
      g.beginPath(); g.moveTo(wx - 8, this.DUESE - 2); g.lineTo(wx + 8, this.DUESE - 2); g.lineTo(wx, this.DUESE - 14 - r * .02); g.closePath(); g.fill();
      // Glanzlicht
      g.fillStyle = 'rgba(255,255,255,.55)'; ellipse(g, wx - r * .42, cy - r * .45, r * .16, r * .28, .6); g.fill();
      // Gefahr: kurz vor dem Platzen
      if (spann > 0) { g.globalAlpha = spann; A.text('!', wx + r + 18, cy - r * .6, 46, '#ff5a5a'); g.globalAlpha = 1; }
      // Zähler: drei Ballon-Plätze im Gras
      for (let j = 0; j < this.ZIEL; j++) {
        const bx = st.x + (j - 1) * 34, by = B + 52;
        g.fillStyle = 'rgba(0,0,0,.18)'; ellipse(g, bx, by + 2, 14, 16); g.fill();
        if (j < st.n) { g.fillStyle = farbe; ellipse(g, bx, by, 13, 15); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; ellipse(g, bx - 4, by - 5, 3, 5); g.fill(); }
        else { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5; ellipse(g, bx, by, 12, 14); g.stroke(); }
      }
      if (st.gross && pumper.length === 1) A.text('3× Kraft', st.x, B + 86, 22, '#fff');
    });

    // Blasebälge mit den Figuren obendrauf
    S.sp.forEach((p, k) => {
      const hub = clamp(p.hubY, 0, 1);
      const hoehe = 50 - hub * 24;
      const x = p.px, oben = B - hoehe;
      bodenSchatten(g, x, B, 46, .25);
      // Holzplatte unten
      g.fillStyle = '#8a5a34'; rundRechteck(g, x - 42, B - 12, 84, 14, 5); g.fill();
      // Balg (Ziehharmonika)
      g.fillStyle = A.teamFarbe(k);
      g.beginPath();
      const falten = 4;
      g.moveTo(x - 36, B - 10);
      for (let i = 1; i <= falten; i++) { const y = B - 10 - (hoehe - 20) * i / falten; g.lineTo(i % 2 ? x - 30 : x - 38, y); }
      g.lineTo(x + 38, oben + 10);
      for (let i = falten - 1; i >= 0; i--) { const y = B - 10 - (hoehe - 20) * i / falten; g.lineTo(i % 2 ? x + 30 : x + 38, y); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
      g.fillStyle = A.teamFarbe(k); g.globalAlpha = .75; g.fill(); g.globalAlpha = 1;
      // Trittbrett oben
      g.fillStyle = '#a8703f'; rundRechteck(g, x - 44, oben - 2, 88, 14, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 38, oben, 76, 3);
      // Figur: hüpft bei jedem Druck kurz hoch und landet auf dem Brett
      const sprung = Math.sin(clamp(1 - hub, 0, 1) * Math.PI) * 18 * (hub > 0 ? 1 : 0);
      A.figur(k, x, oben - sprung, 38, {
        schatten: false, huepf: hub > .6 ? .5 : 0, blick: S.st[p.st].x > x ? .8 : -.8,
        emo: S.sieger === p.st ? 'froh' : S.st[p.st].f > .8 ? 'schock' : 'normal', jubeln: S.sieger === p.st,
      });
    });

    for (const e of A.neu(S)) {
      if (e.typ === 'platzt') {
        const st = S.st[e.st];
        const farbe = this.ballonFarbe(st, A);
        const y = this.DUESE - (st.gross ? 170 : 150);
        Ton.spiel('boom'); if (e.n >= this.ZIEL) Ton.spiel('stern'); else Ton.spiel('muenze');
        A.funken(st.x, y, farbe, 30, 520, 10);
        A.funken(st.x, y, '#ffd23a', 10, 400, 6); A.funken(st.x, y, '#ffffff', 10, 380, 6);
        A.text3(e.n >= this.ZIEL ? 'Sieg!' : 'Peng!', st.x, y - 80, '#ffd23a');
      }
    }
  },
  // Etwas dunklere Variante einer Hex-Farbe für Verlauf und Knoten
  dunkler(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    return `rgb(${r * .62 | 0},${gg * .62 | 0},${b * .62 | 0})`;
  },
});
