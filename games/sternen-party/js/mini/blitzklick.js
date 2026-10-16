// Minispiel „Blitz-Klick“: Reaktionstest – wer den Stern zuerst anklickt, punktet (Zeiger, nur online)
// Ablauf pro Durchgang: warten ('w') -> Ziel sichtbar ('z') -> Ergebnis zeigen ('e').
// Fairness bei Netz-Verzögerung: Das Ziel bleibt mindestens 0.25 s offen, und alle Treffer, die innerhalb von
// 120 ms nach dem ersten gültigen Treffer beim Host ankommen, zählen gemeinsam.
'use strict';
Minis.reg({
  id: 'blitzklick', name: 'Blitz-Klick',
  text: 'Warte, bis der Stern auftaucht, und klick ihn schneller an als alle anderen! Wer zu früh oder daneben klickt, ist kurz gesperrt. Grimm nicht anklicken!',
  steuerung: { zeiger: 'Zeiger bewegen, Linksklick auf den Stern' },
  zeiger: true,
  formate: ['ffa', '2v2', 'duell'],
  RUNDEN: 8,          // Durchgänge mit Stern
  R: 88,              // Radius des Ziels
  SPERRE: 1.2,
  FENSTER: .12,       // gemeinsame Treffer nach dem ersten
  OFFEN: .25,         // so lange bleibt das Ziel mindestens sichtbar
  start(S, info) {
    S.sp = info.teilnehmer.map((p, k) => ({ p: 0, sp: 0, mX: 400 + k * 260, mY: 560, jub: 0 }));
    // Reihenfolge: 8 Sterne und 2–3 Grimm-Köpfe dazwischen (nie gleich zu Beginn)
    const folge = Array(this.RUNDEN).fill('s');
    for (let i = rndi(2, 3); i > 0; i--) folge.splice(rndi(1, folge.length - 1), 0, 'g');
    S.folge = folge.join(''); S.i = 0;
    S.ph = 'w'; S.pt = 0; S.warte = rnd(1.4, 2.4);
    S.zx = 800; S.zy = 420; S.zt = 0;      // Ziel: Position, Zeitpunkt des Erscheinens
    S.erst = -1; S.gew = [];               // Zeit des ersten Treffers, Gewinner dieses Durchgangs
    S.alt = null;                          // letztes Ziel (für verspätete Klicks)
    S.sterne = 0; S.seed = rndi(0, 9999);   // Zufall für die Bots, pro Spiel neu
  },
  schritt(S, ein, dt, info) {
    S.pt += dt;
    const art = S.folge[S.i];
    // Phasen weiterschalten
    if (S.ph === 'w' && S.pt >= S.warte) {
      S.ph = 'z'; S.pt = 0; S.zt = S.t; S.erst = -1; S.gew = [];
      // Zufällige Stelle, nicht hinter der Leiste oben, nicht am linken Rand, nicht auf den Figuren unten
      S.zx = Math.round(rnd(260, 1400)); S.zy = Math.round(rnd(210, 600));
      Minis.ereignis(S, { typ: art === 'g' ? 'grimm' : 'stern' });
    } else if (S.ph === 'z') {
      const offen = S.t - S.zt;
      const ende = art === 'g' ? offen >= 1.3
        : S.erst >= 0 ? S.t >= Math.max(S.erst + this.FENSTER, S.zt + this.OFFEN) : offen >= 3;
      if (ende) {
        if (art === 's') {
          S.sterne++;
          for (const k of S.gew) { S.sp[k].p++; S.sp[k].jub = 1.2; }
          Minis.ereignis(S, { typ: S.gew.length ? 'gewonnen' : 'entwischt', gew: S.gew.slice(), x: S.zx, y: S.zy });
        }
        S.alt = { x: S.zx, y: S.zy, t: S.t };
        S.ph = 'e'; S.pt = 0;
      }
    } else if (S.ph === 'e' && S.pt >= (art === 'g' ? .4 : 1.1)) {
      S.i++;
      if (S.i >= S.folge.length) { S.fertig = true; return; }
      S.ph = 'w'; S.pt = 0; S.warte = rnd(1.1, 2.6);
    }
    if (S.t > 58) S.fertig = true;
    // Klicks auswerten
    S.sp.forEach((p, k) => {
      const e = ein[k];
      p.mX = Math.round(clamp(e.mx, 0, WELT_B)); p.mY = Math.round(clamp(e.my, 0, WELT_H));
      if (p.sp > 0) p.sp = Math.max(0, p.sp - dt);
      if (p.jub > 0) p.jub = Math.max(0, p.jub - dt);
      if (!e.cp || p.sp > 0) return;
      const aufZiel = dist(e.mx, e.my, S.zx, S.zy) < this.R + 16;
      if (S.ph === 'z') {
        if (!aufZiel) return this.sperren(S, p, k);
        if (art === 'g') {
          p.p--; p.sp = this.SPERRE;
          Minis.ereignis(S, { typ: 'autsch', k, x: S.zx, y: S.zy });
        } else if (!S.gew.includes(k) && (S.erst < 0 || S.t <= S.erst + this.FENSTER)) {
          if (S.erst < 0) S.erst = S.t;
          S.gew.push(k);
          Minis.ereignis(S, { typ: 'klick', k, x: p.mX, y: p.mY });
        }
        return;
      }
      // Verspäteter Klick auf das eben verschwundene Ziel: keine Strafe (Netz-Verzögerung)
      if (S.alt && S.t - S.alt.t < .3 && dist(e.mx, e.my, S.alt.x, S.alt.y) < this.R + 30) return;
      this.sperren(S, p, k);
    });
  },
  sperren(S, p, k) {
    p.sp = this.SPERRE;
    Minis.ereignis(S, { typ: 'daneben', k, x: p.mX, y: p.mY });
  },
  ki(S, k, stufe) {
    const p = S.sp[k];
    const B = [
      { reakt: .5, tempo: 1500, fehler: 60, frueh: .003, grimm: .45 },
      { reakt: .36, tempo: 2300, fehler: 35, frueh: .002, grimm: .15 },
      { reakt: .25, tempo: 3200, fehler: 14, frueh: 0, grimm: .02 },
    ][stufe];
    const dt = 1 / 60;
    // Ruheplatz: jeder Bot wartet an einer anderen Stelle
    const [ox, oy] = [[-170, -70], [170, -70], [-170, 90], [170, 90]][k % 4];
    const rx = 830 + ox + Math.sin(S.t * .8 + k) * 40, ry = 410 + oy + Math.cos(S.t * .6 + k * 2) * 30;
    let zx = rx, zy = ry, cp = false, zielen = false;
    const art = S.folge[S.i];
    if (S.ph === 'z' && p.sp <= 0) {
      // Pro Durchgang und Bot fest: Reaktionszeit, Zielfehler, ob er auf Grimm hereinfällt
      const h = ((S.seed + S.i * 53 + k * 29) % 97) / 97, h2 = ((S.seed * 3 + S.i * 31 + k * 71) % 89) / 89;
      const reakt = B.reakt * (.8 + h * .5);
      const willKlicken = art === 's' || h2 < B.grimm;
      if (S.t - S.zt > reakt && willKlicken && !S.gew.includes(k)) {
        zx = S.zx + (h2 - .5) * 2 * B.fehler; zy = S.zy + (h - .5) * 2 * B.fehler; zielen = true;
      } else if (S.t - S.zt <= reakt) { zx = p.mX; zy = p.mY; }
    }
    const d = dist(p.mX, p.mY, zx, zy), sch = (S.ph === 'z' ? B.tempo : 500) * dt;
    const mx = d <= sch ? zx : p.mX + (zx - p.mX) / d * sch, my = d <= sch ? zy : p.mY + (zy - p.mY) / d * sch;
    if (zielen && d <= sch) cp = true;
    // Ungeduldige Bots klicken manchmal zu früh
    if (S.ph === 'w' && p.sp <= 0 && Math.random() < B.frueh) cp = true;
    return { mx, my, cp };
  },
  punkte(S) { return S.sp.map(p => p.p); },
  wert(S, k) { return S.sp[k].p; },
  zeigerVon(S, A, k) { return k === A.ich ? { x: A.zeiger.x, y: A.zeiger.y } : { x: S.sp[k].mX, y: S.sp[k].mY }; },
  zeichne(g, S, A) {
    const t = A.t, n = S.sp.length, art = S.folge[S.i] || 's';
    // Nachthimmel mit Sternenstaub und Hügeln
    const h = g.createLinearGradient(0, 0, 0, WELT_H);
    h.addColorStop(0, '#0d1240'); h.addColorStop(.6, '#2c2470'); h.addColorStop(1, '#5a3d8a');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, WELT_H);
    for (let i = 0; i < 70; i++) {
      const zx = Math.sin(i * 12.9898) * 43758.5453, zy = Math.sin(i * 78.233) * 12543.21;
      const x = (zx - Math.floor(zx)) * WELT_B, y = 80 + (zy - Math.floor(zy)) * 600, a = .35 + .35 * Math.sin(t * 2 + i);
      g.fillStyle = `rgba(255,255,230,${a})`; g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, TAU); g.fill();
    }
    // Mond
    g.fillStyle = 'rgba(255,245,200,.12)'; g.beginPath(); g.arc(1380, 190, 90, 0, TAU); g.fill();
    g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(1380, 190, 54, 0, TAU); g.fill();
    g.fillStyle = '#2c2a72'; g.beginPath(); g.arc(1404, 176, 48, 0, TAU); g.fill();
    // Hügel
    g.fillStyle = '#2a1f5c';
    g.beginPath(); g.moveTo(0, 760); for (let x = 0; x <= WELT_B; x += 40) g.lineTo(x, 720 - Math.sin(x * .004 + 1) * 50 - Math.sin(x * .011) * 18); g.lineTo(WELT_B, WELT_H); g.lineTo(0, WELT_H); g.fill();
    g.fillStyle = '#3d2b6e';
    g.beginPath(); g.moveTo(0, 820); for (let x = 0; x <= WELT_B; x += 40) g.lineTo(x, 790 - Math.sin(x * .006 + 3) * 26); g.lineTo(WELT_B, WELT_H); g.lineTo(0, WELT_H); g.fill();
    // Rundenanzeige
    const fertig = Math.min(S.sterne, this.RUNDEN);
    for (let i = 0; i < this.RUNDEN; i++) {
      const x = 800 - (this.RUNDEN - 1) * 22 + i * 44;
      g.globalAlpha = i < fertig ? 1 : .3;
      zeichneStern(g, x, 112, 15, 0);
    }
    g.globalAlpha = 1;
    // Figuren unten, jubeln beim Treffer, gesperrt = Schreck
    S.sp.forEach((p, k) => {
      const x = n === 1 ? 800 : 380 + k * (840 / Math.max(1, n - 1));
      const z = this.zeigerVon(S, A, k);
      A.figur(k, x, 872, 40, { emo: p.jub > 0 ? 'froh' : p.sp > 0 ? 'schock' : 'normal', huepf: p.jub > 0 ? Math.abs(Math.sin(t * 12)) * .6 : 0, blick: clamp((z.x - x) / 500, -1, 1), kipp: p.sp > 0 ? Math.sin(t * 18) * .08 : 0 });
      g.fillStyle = A.teamFarbe(k); g.beginPath(); g.moveTo(x - 12, 758); g.lineTo(x + 12, 758); g.lineTo(x, 772); g.closePath(); g.fill();
    });
    // Ziel
    if (S.ph === 'w') {
      const puls = .5 + .5 * Math.sin(t * 4);
      A.text('Achtung …', 800, 460, 54 + puls * 4, 'rgba(255,255,255,.75)');
    } else if (S.ph === 'z' || (S.ph === 'e' && S.pt < .5)) {
      const auf = S.ph === 'z' ? Ease.outBack(clamp((S.t - S.zt) / .12, 0, 1)) : 1 - S.pt / .5;
      const r = this.R * auf;
      if (r > 1) {
        if (art === 'g') {
          g.fillStyle = 'rgba(160,30,60,.35)'; g.beginPath(); g.arc(S.zx, S.zy, r * 1.35, 0, TAU); g.fill();
          zeichneGrimm(g, S.zx, S.zy + r * .95, r * .9, t, true);
        } else {
          // Strahlenkranz und grosser Stern
          g.save(); g.translate(S.zx, S.zy); g.rotate(t * 1.5);
          g.fillStyle = 'rgba(255,230,120,.22)';
          for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 1.7, -r * .16); g.lineTo(r * 1.7, r * .16); g.closePath(); g.fill(); }
          g.restore();
          g.fillStyle = 'rgba(255,240,170,.3)'; g.beginPath(); g.arc(S.zx, S.zy, r * 1.15, 0, TAU); g.fill();
          zeichneStern(g, S.zx, S.zy, r, Math.sin(t * 5) * .08);
        }
      }
    }
    // Ergebnis des Durchgangs
    if (S.ph === 'e' && art === 's') {
      const txt = S.gew.length ? S.gew.map(k => A.name(k)).join(' + ') + ' war am schnellsten!' : 'Zu langsam – der Stern ist weg!';
      A.text(txt, 800, 180, 40, S.gew.length ? '#ffd23a' : '#c9c4ff');
    }
    // Zeiger: gesperrt = grau, eigener zuoberst
    const reihe = [...S.sp.keys()].filter(k => k !== A.ich);
    if (A.ich >= 0 && A.ich < n) reihe.push(A.ich);
    for (const k of reihe) {
      const z = this.zeigerVon(S, A, k), p = S.sp[k];
      this.fadenkreuz(g, z.x, z.y, p.sp > 0 ? '#8a8a98' : A.farbe(k), A.teamFarbe(k), p.sp / this.SPERRE, k === A.ich, A.info.format);
    }
    for (const e of A.neu(S)) {
      if (e.typ === 'stern') Ton.spiel('glueck');
      else if (e.typ === 'grimm') Ton.spiel('boese');
      else if (e.typ === 'klick') { A.funken(e.x, e.y, A.farbe(e.k), 10, 240, 6); if (e.k === A.ich) Ton.spiel('klick'); }
      else if (e.typ === 'gewonnen') { Ton.spiel('stern'); A.funken(e.x, e.y, '#ffd23a', 26, 380, 8); for (const k of e.gew) A.text3('+1', e.x, e.y - 30 - e.gew.indexOf(k) * 34, A.farbe(k)); }
      else if (e.typ === 'entwischt') Ton.spiel('weg');
      else if (e.typ === 'autsch') { Ton.spiel('verlust'); A.funken(e.x, e.y, '#b23af0', 16, 300, 7); A.text3('-1', e.x, e.y - 40, '#ff6b6b'); }
      else if (e.typ === 'daneben') { if (e.k === A.ich) Ton.spiel('fehler'); A.funken(e.x, e.y, '#9a9aa8', 6, 140, 4); }
    }
  },
  // Fadenkreuz; im Teamformat mit Ring in Teamfarbe, Sperre als schrumpfender Bogen
  fadenkreuz(g, x, y, farbe, team, sperre, eigen, format) {
    const r = eigen ? 28 : 23;
    g.save(); g.translate(x, y); g.lineCap = 'round';
    if (format === '2v2') { g.strokeStyle = team; g.lineWidth = 4; g.globalAlpha = .8; g.beginPath(); g.arc(0, 0, r + 9, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    for (const [lw, f] of [[eigen ? 9 : 7, 'rgba(10,6,20,.75)'], [eigen ? 5 : 3.5, farbe]]) {
      g.strokeStyle = f; g.lineWidth = lw;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(dx * r * .45, dy * r * .45); g.lineTo(dx * r * 1.35, dy * r * 1.35); }
      g.stroke();
    }
    g.fillStyle = farbe; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    if (sperre > 0) {
      g.strokeStyle = 'rgba(255,90,90,.9)'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * sperre); g.stroke();
    }
    g.restore();
  },
});
