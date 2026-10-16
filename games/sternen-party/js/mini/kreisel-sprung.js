// Minispiel „Kreisel-Sprung“: über Grimms kreisenden Feuerstab springen (schräge Seitenansicht, nur Aktion)
'use strict';
Minis.reg({
  id: 'kreisel-sprung', name: 'Kreisel-Sprung',
  text: 'Graf Grimm dreht seinen Feuerstab im Kreis, immer schneller! Spring im richtigen Moment darüber. Wer getroffen wird, fliegt raus.',
  steuerung: { tasten: 'Aktion springen' },
  formate: ['ffa', '2v2', '1v3', 'duell'],
  dauer: 50,
  CX: 800, CY: 575, K: .42,      // Mitte der Arena auf dem Bildschirm, K staucht die Tiefe
  RAD: 330,                      // Abstand der Spieler von der Mitte
  LANG: 440,                     // Länge des Feuerstabs
  BUEHNE: 470,                   // Radius der Steinbühne
  SPRUNG: 470, SCHWER: 2000,     // Absprung-Tempo und Schwerkraft (Flugzeit knapp 0.5 s)
  TREFF: 24,                     // unter dieser Höhe trifft der Stab
  teams(info) { return info.format === '2v2' || info.format === '1v3'; },
  // Bildschirm-Position zu Winkel und Abstand von der Mitte
  bp(a, r) { return [this.CX + Math.cos(a) * r, this.CY + Math.sin(a) * r * this.K]; },
  start(S, info) {
    const n = info.teilnehmer.length;
    const P = Math.PI;
    const winkel = n === 2 ? [0, P] : n === 3 ? [P / 2, P * 7 / 6, P * 11 / 6] : [P / 4, P * 3 / 4, P * 5 / 4, P * 7 / 4];
    S.sp = info.teilnehmer.map((_, k) => {
      const a = winkel[k % winkel.length];
      const [x, y] = this.bp(a, this.RAD);
      return { a, x, y, z: 0, vz: 0, lag: 0, aus: false, zeit: 0, w: 0, vx: 0, vy: 0, wv: 0, lieg: false };
    });
    S.w = winkel[0] - P / n;        // Winkel des Stabs (wird online weich überblendet)
    S.om = 0; S.dir = 1;            // Drehtempo und -richtung
    S.wechsel = rnd(13, 17);        // nächster Richtungswechsel
    S.warn = 0; S.zwei = false; S.lach = 0; S.ende = 0;
    S.kz = info.teilnehmer.map(() => .23);   // Sprung-Plan der Bots
  },
  tempo(t) { return Math.min(4.6, 1.75 + t * .062); },
  schritt(S, ein, dt, info) {
    // Richtungswechsel ankündigen und ausführen
    if (S.t >= S.wechsel - .8 && S.warn <= 0 && S.t < S.wechsel) { S.warn = .8; Minis.ereignis(S, { typ: 'warn' }); }
    if (S.t >= S.wechsel) { S.dir *= -1; S.wechsel = S.t + rnd(6, 10); }
    S.warn = Math.max(0, S.warn - dt);
    // Ab 24 s brennt auch das andere Ende des Stabs
    if (!S.zwei && S.t >= 24) { S.zwei = true; Minis.ereignis(S, { typ: 'zwei' }); }
    const ziel = S.dir * this.tempo(S.t);
    S.om += clamp(ziel - S.om, -5.5 * dt, 5.5 * dt);
    const w0 = S.w, w1 = S.w + S.om * dt;
    S.w = w1;
    if (S.w > Math.PI * 4) S.w -= TAU * 2;
    if (S.w < -Math.PI * 4) S.w += TAU * 2;
    S.lach = Math.max(0, S.lach - dt);
    const enden = S.zwei ? [0, Math.PI] : [0];
    const wrap = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

    S.sp.forEach((p, k) => {
      if (p.aus) {
        // Weggeschleudert: Flugbahn mit Drehung, dann liegen bleiben
        if (!p.lieg) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.w += p.wv * dt;
          p.vz -= this.SCHWER * .8 * dt; p.z += p.vz * dt;
          if (p.x < 170 || p.x > 1500) p.vx *= -.5;
          p.x = clamp(p.x, 170, 1500); p.y = clamp(p.y, 330, 860);
          if (p.z <= 0) { p.z = 0; p.lieg = true; p.w = p.vx > 0 ? 1.45 : -1.45; Minis.ereignis(S, { typ: 'plumps', x: p.x, y: p.y }); }
        }
        return;
      }
      const e = ein[k];
      p.lag = Math.max(0, p.lag - dt);
      if (e.ap && p.z <= 0 && p.lag <= 0) { p.vz = this.SPRUNG; Minis.ereignis(S, { typ: 'sprung', k }); }
      if (p.z > 0 || p.vz > 0) {
        p.vz -= this.SCHWER * dt; p.z += p.vz * dt;
        if (p.z <= 0) { p.z = 0; p.vz = 0; p.lag = .12; }   // kurze Landepause: Dauerhüpfen hilft nicht
      }
      // Trifft eines der brennenden Enden die Figur?
      for (const off of enden) {
        const d0 = wrap(p.a - (w0 + off)), d1 = wrap(p.a - (w1 + off));
        if (Math.abs(d0) < 1.2 && Math.sign(d0) !== Math.sign(d1) && p.z < this.TREFF) {
          p.aus = true; p.zeit = r1(S.t);
          // in Drehrichtung und nach aussen wegschleudern
          const s = Math.sign(S.om) || 1;
          const tx = -Math.sin(p.a) * s, ty = Math.cos(p.a) * s;
          p.vx = Math.cos(p.a) * 300 + tx * 260; p.vy = (Math.sin(p.a) * 300 + ty * 260) * this.K;
          p.vz = 720; p.z = Math.max(p.z, 1); p.wv = s * 9;
          S.lach = 1.2;
          Minis.ereignis(S, { typ: 'treffer', k, x: p.x, y: p.y - 40 });
          break;
        }
      }
    });
    // Ende: nur noch einer (bzw. ein Team) übrig
    const drin = S.sp.map((p, k) => k).filter(k => !S.sp[k].aus);
    const vorbei = this.teams(info) ? [0, 1].some(tm => !drin.some(k => info.teams[k] === tm)) : drin.length <= 1;
    if (vorbei) { S.ende += dt; if (S.ende > 1.4) S.fertig = true; }
  },
  ki(S, k, stufe) {
    const p = S.sp[k];
    if (!p || p.aus) return {};
    // Zeit, bis ein brennendes Ende hier ist
    let T = 9;
    const om = S.om;
    if (Math.abs(om) > .15) for (const off of (S.zwei ? [0, Math.PI] : [0])) {
      let d = om > 0 ? (p.a - (S.w + off)) : ((S.w + off) - p.a);
      d = ((d % TAU) + TAU) % TAU;
      T = Math.min(T, d / Math.abs(om));
    }
    if (p.z <= 0 && p.lag <= 0 && T < S.kz[k]) {
      // Nächsten Sprung planen: gute Bots treffen das Zeitfenster genauer
      // Je schneller der Stab, desto ungenauer
      const sigma = [.1, .06, .035][stufe] * (1 + (Math.abs(om) - 1.75) * .45);
      let plan = .23 + (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sigma;
      if (Math.random() < [.05, .015, 0][stufe]) plan = .02;      // verschlafen
      S.kz[k] = clamp(plan, .02, .7);
      return { ap: true };
    }
    return {};
  },
  punkte(S) { return S.sp.map(p => p.aus ? p.zeit : r1(S.t) + 5); },
  wert(S, k) { return S.sp[k].aus ? 'raus' : ''; },
  zeichne(g, S, A) {
    const CX = this.CX, CY = this.CY, K = this.K, t = A.t;
    // Abendhimmel über dem Vulkan
    const h = g.createLinearGradient(0, 0, 0, 380);
    h.addColorStop(0, '#2a1a4f'); h.addColorStop(.55, '#7a2f5c'); h.addColorStop(1, '#f08a4b');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, 380);
    // Sterne
    g.fillStyle = 'rgba(255,240,220,.7)';
    for (let i = 0; i < 30; i++) { const x = (i * 263) % WELT_B, y = 90 + (i * 71) % 150; g.globalAlpha = .4 + .4 * Math.sin(t * 2 + i); g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    // Vulkan mit glühendem Krater und Rauch
    g.fillStyle = '#3b1e2e';
    g.beginPath(); g.moveTo(980, 380); g.lineTo(1180, 170); g.lineTo(1290, 162); g.lineTo(1500, 380); g.closePath(); g.fill();
    g.fillStyle = '#ff7a2a'; ellipse(g, 1235, 168, 56, 9); g.fill();
    g.strokeStyle = '#ff9a3a'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(1215, 172); g.quadraticCurveTo(1200, 230, 1170, 260); g.stroke();
    g.beginPath(); g.moveTo(1258, 172); g.quadraticCurveTo(1275, 220, 1300, 245); g.stroke();
    for (let i = 0; i < 5; i++) {
      const ph = (t * .25 + i / 5) % 1;
      g.fillStyle = `rgba(90,70,90,${.55 * (1 - ph)})`;
      g.beginPath(); g.arc(1235 + Math.sin(i * 2 + t) * 20 + ph * 60, 150 - ph * 120, 22 + ph * 40, 0, TAU); g.fill();
    }
    g.fillStyle = '#2e1a2a';
    g.beginPath(); g.moveTo(0, 380); g.lineTo(0, 300); g.lineTo(140, 250); g.lineTo(260, 300); g.lineTo(390, 270); g.lineTo(560, 380); g.closePath(); g.fill();
    // Vulkan-Boden
    const b = g.createLinearGradient(0, 360, 0, WELT_H);
    b.addColorStop(0, '#4a2a35'); b.addColorStop(1, '#2a1620');
    g.fillStyle = b; g.fillRect(0, 370, WELT_B, WELT_H - 370);
    // Glühende Lavaspalten im Boden
    g.strokeStyle = '#ff6a2a'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha = .65 + .25 * Math.sin(t * 2);
    for (const pts of [[[60, 640], [150, 680], [200, 760], [300, 800]], [[1350, 450], [1440, 520], [1560, 540]], [[1250, 860], [1340, 800], [1480, 810]], [[250, 430], [330, 470], [380, 455]]]) {
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    }
    g.globalAlpha = 1;

    // Steinbühne: Seitenwand und Deckfläche
    const RB = this.BUEHNE;
    g.fillStyle = '#5b4a5a'; ellipse(g, CX, CY + 30, RB, RB * K); g.fill();
    g.fillStyle = '#463645'; g.fillRect(CX - RB, CY, RB * 2, 30);
    const st = g.createRadialGradient(CX - 120, CY - 60, 40, CX, CY, RB);
    st.addColorStop(0, '#a99aa6'); st.addColorStop(1, '#6e5e6c');
    g.fillStyle = st; ellipse(g, CX, CY, RB, RB * K); g.fill();
    g.strokeStyle = 'rgba(50,30,50,.35)'; g.lineWidth = 3;
    for (const r of [140, 260, 400]) { ellipse(g, CX, CY, r, r * K); g.stroke(); }
    // Platten-Fugen
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const [x0, y0] = this.bp(a, 140), [x1, y1] = this.bp(a, RB);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    // Plätze der Spieler
    S.sp.forEach((p, k) => {
      const [x, y] = this.bp(p.a, this.RAD);
      g.fillStyle = 'rgba(0,0,0,.18)'; ellipse(g, x, y, 54, 54 * K); g.fill();
      g.strokeStyle = A.teamFarbe(k); g.lineWidth = 5; g.globalAlpha = p.aus ? .3 : .9; ellipse(g, x, y, 50, 50 * K); g.stroke(); g.globalAlpha = 1;
    });
    // Schatten des Stabs auf dem Boden (zeigt genau, wo er ist)
    const enden = S.zwei ? [0, Math.PI] : [0];
    g.strokeStyle = 'rgba(20,0,10,.4)'; g.lineWidth = 16; g.lineCap = 'round';
    for (const off of enden) { const [x, y] = this.bp(S.w + off, this.LANG); g.beginPath(); g.moveTo(CX, CY + 4); g.lineTo(x, y + 4); g.stroke(); }

    // Alles mit Tiefe sortieren: Stab-Stücke, Grimm, Spieler
    const dinge = [];
    const N = 7;
    for (const off of [0, Math.PI]) {
      const brennt = off === 0 || S.zwei;
      const lang = brennt ? this.LANG : 120;
      for (let i = 0; i < N; i++) {
        const r0 = 30 + (lang - 30) * i / N, r2 = 30 + (lang - 30) * (i + 1) / N;
        const a = S.w + off;
        dinge.push({ y: CY + Math.sin(a) * (r0 + r2) / 2 * K, f: () => this.zeichneStab(g, a, r0, r2, brennt, i, t) });
      }
    }
    dinge.push({ y: CY + 1, f: () => {
      zeichneGrimm(g, CX, CY + 8, 52, t, S.lach > 0);
      if (S.warn > 0) { A.text('!', CX + 70, CY - 170, 64, '#ffd23a'); }
    } });
    S.sp.forEach((p, k) => dinge.push({ y: p.y + (p.aus && !p.lieg ? 1000 : 0), f: () => this.zeichneSpieler(g, S, p, k, A) }));
    dinge.sort((a, b) => a.y - b.y).forEach(d => d.f());

    if (S.zwei && S.t < 26.5) A.text('Doppelt heiss!', CX, 140, 44, '#ffb02e');
    if (S.warn > 0) A.text('Andersrum!', CX, 140, 44, '#ffd23a');

    for (const e of A.neu(S)) {
      if (e.typ === 'treffer') { Ton.spiel('boom'); A.funken(e.x, e.y, '#ff8a2a', 22, 380, 8); A.funken(e.x, e.y, '#ffd23a', 10, 260, 6); A.text3('Autsch!', e.x, e.y - 60, '#ff8a6a'); }
      else if (e.typ === 'sprung') Ton.spiel('sprung');
      else if (e.typ === 'plumps') { Ton.spiel('pop'); A.funken(e.x, e.y, '#9a8a90', 8, 160, 6); }
      else if (e.typ === 'warn') Ton.spiel('fehler');
      else if (e.typ === 'zwei') { Ton.spiel('boese'); A.funken(CX, CY - 20, '#ff7a2a', 30, 420, 8); }
    }
  },
  // Ein Stück des Feuerstabs (von r0 bis r2), etwas über dem Boden
  zeichneStab(g, a, r0, r2, brennt, i, t) {
    const H = 16;
    const [x0, y0] = this.bp(a, r0), [x1, y1] = this.bp(a, r2);
    g.lineCap = 'round';
    g.strokeStyle = '#3a1a1a'; g.lineWidth = 15;
    g.beginPath(); g.moveTo(x0, y0 - H); g.lineTo(x1, y1 - H); g.stroke();
    if (!brennt) { g.strokeStyle = '#6a3a2a'; g.lineWidth = 6; g.stroke(); return; }
    g.strokeStyle = '#ff5a1a'; g.lineWidth = 11; g.stroke();
    g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.stroke();
    // Flammenzungen
    const fl = 16 + 8 * Math.sin(t * 13 + i * 2.1);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - H;
    g.fillStyle = 'rgba(255,120,30,.85)';
    g.beginPath(); g.moveTo(mx - 11, my); g.quadraticCurveTo(mx - 7, my - fl * .7, mx + Math.sin(t * 9 + i) * 4, my - fl - 6); g.quadraticCurveTo(mx + 8, my - fl * .6, mx + 11, my); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,90,.95)';
    g.beginPath(); g.moveTo(mx - 5, my); g.quadraticCurveTo(mx - 3, my - fl * .5, mx, my - fl * .7); g.quadraticCurveTo(mx + 3, my - fl * .4, mx + 5, my); g.closePath(); g.fill();
  },
  zeichneSpieler(g, S, p, k, A) {
    const t = A.t;
    if (p.aus) {
      bodenSchatten(g, p.x, p.y, 30, .3);
      A.figur(k, p.x, p.y - p.z, 34, { schatten: false, emo: 'traurig', kipp: p.w });
      if (p.lieg) {
        // Kreisende Sternchen über dem Kopf
        for (let i = 0; i < 3; i++) {
          const a = t * 4 + i * TAU / 3;
          zeichneStern(g, p.x + Math.sign(p.w) * 30 + Math.cos(a) * 26, p.y - 40 + Math.sin(a) * 8, 9, t * 3);
        }
      }
      return;
    }
    const sk = clamp(1 - p.z / 220, .55, 1);
    bodenSchatten(g, p.x, p.y, 34 * sk, .32 * sk);
    A.figur(k, p.x, p.y - p.z, 38, {
      schatten: false, blick: CXrel(p.x), emo: p.z > 0 ? 'froh' : 'normal',
      huepf: p.lag > 0 ? .6 : p.vz > 0 ? -.35 : 0, jubeln: p.z > 30,
    });
    // Pfeil in Team- bzw. Spielerfarbe über dem Kopf
    g.fillStyle = A.teamFarbe(k);
    const py = p.y - p.z - 104 + Math.sin(t * 4 + k) * 3;
    g.beginPath(); g.moveTo(p.x - 12, py); g.lineTo(p.x + 12, py); g.lineTo(p.x, py + 14); g.closePath(); g.fill();
    function CXrel(x) { return clamp((800 - x) / 300, -1, 1); }
  },
});
