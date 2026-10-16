// Minispiel „Heisse Bombe“: die Bombe durch Berühren weitergeben, bevor sie platzt (Draufsicht, Tasten)
// Die Zündschnur brennt 6–12 s (geheim), nur die Funken werden schneller. Wer sie beim Knall hat, ist raus.
// Bei zwei Spielern: wer zuerst zwei Runden gewinnt.
'use strict';
(() => {
  const CX = 820, CY = 500, RX = 640, RY = 335;   // Lichtung (Ellipse)
  const PR = 24;                                  // Kollisionsradius einer Figur
  const TEMPO = 300, TRAEGER = 1.12;              // Bombenträger ist etwas schneller
  const SPRINT = .3, SPRINT_X = 1.9, SPRINT_CD = 2.5;
  const SCHUTZ = 1.0;                             // so lange kann man die Bombe nicht zurückbekommen
  const HINDERNISSE = [
    { x: 560, y: 380, r: 42, a: 'busch' }, { x: 1090, y: 370, r: 44, a: 'stein' }, { x: 830, y: 655, r: 40, a: 'stumpf' },
    { x: 1250, y: 630, r: 36, a: 'busch' }, { x: 430, y: 630, r: 34, a: 'stein' },
  ];

  // Punkt in die Lichtung zurückholen und aus Hindernissen schieben
  function begrenzen(p) {
    for (const o of HINDERNISSE) {
      const d = dist(p.x, p.y, o.x, o.y), m = o.r + PR;
      if (d < m && d > .01) { p.x = o.x + (p.x - o.x) / d * m; p.y = o.y + (p.y - o.y) / d * m; }
    }
    const dx = (p.x - CX) / (RX - PR), dy = (p.y - CY) / (RY - PR), q = dx * dx + dy * dy;
    if (q > 1) { const s = 1 / Math.sqrt(q); p.x = CX + (p.x - CX) * s; p.y = CY + (p.y - CY) * s; }
  }
  // Strafe für Punkte nahe am Rand oder in Hindernissen (für die Bots)
  function gefahr(x, y, randAb = .55) {
    const dx = (x - CX) / (RX - PR), dy = (y - CY) / (RY - PR), q = dx * dx + dy * dy;
    let s = q > randAb ? (q - randAb) * 700 : 0;
    if (q > 1) s += 400;
    for (const o of HINDERNISSE) { const d = dist(x, y, o.x, o.y) - (o.r + PR + 8); if (d < 0) s += 100 - d * 8; }
    return s;
  }
  // Beste von 16 Richtungen nach einer Bewertungsfunktion (höher = besser)
  function besteRichtung(p, weite, bewerte) {
    let best = -1e9, bx = 0, by = 0;
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, x = Math.cos(a), y = Math.sin(a);
      const v = bewerte(p.x + x * weite, p.y + y * weite);
      if (v > best) { best = v; bx = x; by = y; }
    }
    return { x: bx, y: by };
  }
  const zweier = S => S.sp.length === 2;

  function aufstellen(S) {
    const pos = startPunkte(S.sp.length, CX, CY, 250);
    S.sp.forEach((p, k) => {
      Object.assign(p, { x: pos[k].x, y: pos[k].y * .85 + CY * .15, vx: 0, vy: 0, spr: 0, cd: 0, schutz: 0 });
      begrenzen(p);
    });
  }
  function neueBombe(S) {
    const lebend = S.sp.map((p, k) => k).filter(k => !S.sp[k].raus);
    S.bombe = wahl(lebend); S.zuend = rnd(6, 12); S.lunte = 0; S.wt = .4;
    Minis.ereignis(S, { typ: 'neu', k: S.bombe });
  }

  // Nur Optik: Druckwellen der Explosionen
  const wellen = [];

  Minis.reg({
    id: 'bomben-tausch', name: 'Heisse Bombe',
    text: 'Eine Bombe mit geheimer Zündschnur! Berühre jemanden, um sie loszuwerden. Wer sie beim Knall hat, ist raus. Die Funken werden immer schneller …',
    steuerung: { tasten: 'Richtungstasten laufen, Aktion kurzer Sprint' },
    formate: ['ffa', 'duell'],
    start(S, info) {
      S.sp = info.teilnehmer.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, blick: 1, raus: false, aus: -1, siege: 0, spr: 0, cd: 0, schutz: 0 }));
      aufstellen(S);
      S.bombe = -1; S.zuend = 9; S.lunte = 0; S.wt = 0; S.pause = .9; S.ausN = 0; S.runde = 1; S.endT = 0; S.aufstellenIn = 0;
    },
    schritt(S, ein, dt) {
      if (S.endT > 0) { S.endT -= dt; if (S.endT <= 0) S.fertig = true; }
      if (S.t > 80) S.fertig = true;                     // Sicherheitsnetz
      // Duell: nach einer Runde alle wieder an den Start
      if (S.aufstellenIn > 0) { S.aufstellenIn -= dt; if (S.aufstellenIn <= 0) aufstellen(S); }
      for (const p of S.sp) if (p.russ > 0) p.russ = Math.max(0, p.russ - dt);
      // Bewegung
      S.sp.forEach((p, k) => {
        if (p.raus) return;
        const e = ein[k];
        let vx = e.x || 0, vy = e.y || 0;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }
        p.cd = Math.max(0, p.cd - dt); p.spr = Math.max(0, p.spr - dt); p.schutz = Math.max(0, p.schutz - dt);
        if (e.ap && p.cd <= 0 && S.endT <= 0) { p.spr = SPRINT; p.cd = SPRINT_CD; Minis.ereignis(S, { typ: 'sprint', x: p.x, y: p.y }); }
        const v = TEMPO * (S.bombe === k ? TRAEGER : 1) * (p.spr > 0 ? SPRINT_X : 1);
        // weiche Beschleunigung, damit es sich nicht hölzern anfühlt
        p.vx = damp(p.vx, vx * v, 14, dt); p.vy = damp(p.vy, vy * v, 14, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.abs(vx) > .1) p.blick = Math.sign(vx);
        begrenzen(p);
      });
      // Figuren schieben sich auseinander
      for (let i = 0; i < S.sp.length; i++) for (let j = i + 1; j < S.sp.length; j++) {
        const a = S.sp[i], b = S.sp[j];
        if (a.raus || b.raus) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < PR * 2 && d > .01) {
          const s = (PR * 2 - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * s; a.y -= ny * s; b.x += nx * s; b.y += ny * s;
          begrenzen(a); begrenzen(b);
        }
      }
      // Bombe verteilen, weitergeben, platzen lassen
      if (S.bombe < 0) {
        if (S.endT <= 0) { S.pause -= dt; if (S.pause <= 0) neueBombe(S); }
        return;
      }
      const c = S.sp[S.bombe];
      S.lunte += dt; S.wt = Math.max(0, S.wt - dt);
      if (S.wt <= 0) {
        let ziel = -1, best = PR * 2 + 6;
        S.sp.forEach((q, j) => {
          if (j === S.bombe || q.raus || q.schutz > 0) return;
          const d = dist(c.x, c.y, q.x, q.y);
          if (d < best) { best = d; ziel = j; }
        });
        if (ziel >= 0) {
          c.schutz = SCHUTZ; S.wt = .25;
          Minis.ereignis(S, { typ: 'pass', x: (c.x + S.sp[ziel].x) / 2, y: (c.y + S.sp[ziel].y) / 2 - 40, k: ziel });
          S.bombe = ziel;
        }
      }
      if (S.lunte >= S.zuend) {
        const k = S.bombe, p = S.sp[k];
        Minis.ereignis(S, { typ: 'boom', x: p.x, y: p.y - 40, k });
        S.bombe = -1;
        if (zweier(S)) {
          // Runde verloren: der andere bekommt einen Sieg
          S.sp.forEach((q, j) => { if (j !== k) q.siege++; });
          p.russ = 1.6;
          if (S.sp.some(q => q.siege >= 2)) S.endT = 1.8;
          else { S.runde++; S.pause = 2; S.aufstellenIn = 1.4; }
        } else {
          p.raus = true; p.aus = S.ausN++;
          if (S.sp.filter(q => !q.raus).length <= 1) S.endT = 1.8;
          else S.pause = 1.6;
        }
      }
    },
    ki(S, k, stufe) {
      const p = S.sp[k];
      if (p.raus) return {};
      const traeger = S.bombe === k, c = S.bombe >= 0 ? S.sp[S.bombe] : null;
      // Leicht: Richtung nur ab und zu neu überlegen
      if (stufe === 0 && S.t < (p.bz || 0)) return { x: p.bx || 0, y: p.by || 0, ap: false };
      let r, ap = false;
      if (traeger) {
        // Jagen: nächste Figur ohne Schutz, Schwer sagt die Laufrichtung voraus
        let ziel = null, best = 1e9;
        S.sp.forEach((q, j) => {
          if (j === k || q.raus) return;
          const d = dist(p.x, p.y, q.x, q.y) + (q.schutz > 0 ? 400 : 0);
          if (d < best) { best = d; ziel = q; }
        });
        if (!ziel) return {};
        const vor = [0, .15, .35][stufe];
        const zx = ziel.x + ziel.vx * vor, zy = ziel.y + ziel.vy * vor;
        r = besteRichtung(p, 60, (x, y) => -dist(x, y, zx, zy) - gefahr(x, y, 2));
        const nah = [110, 160, 210][stufe];
        ap = p.cd <= 0 && best < nah && (stufe > 0 || Math.random() < .05);
      } else if (c) {
        // Fliehen: weg vom Träger, nicht in Ecken und Hindernisse, nicht zu den anderen
        const vor = [0, .1, .3][stufe];
        const tx = c.x + c.vx * vor, ty = c.y + c.vy * vor;
        const weite = [90, 140, 200][stufe];
        r = besteRichtung(p, weite, (x, y) => {
          let v = dist(x, y, tx, ty) - gefahr(x, y, [.8, .6, .5][stufe]);
          if (stufe > 0) S.sp.forEach((q, j) => { if (j !== k && j !== S.bombe && !q.raus) v -= Math.max(0, 140 - dist(x, y, q.x, q.y)) * .6; });
          return v;
        });
        const dc = dist(p.x, p.y, c.x, c.y);
        // Weit weg? Dann ruhig bleiben (Schwer) statt in eine Ecke zu laufen
        if (stufe === 2 && dc > 420) { r.x *= .4; r.y *= .4; }
        ap = p.cd <= 0 && dc < [70, 120, 150][stufe] && (stufe > 0 || Math.random() < .1);
      } else {
        // Keine Bombe unterwegs: verteilt in der Mitte bereithalten
        const ang = k * TAU / S.sp.length;
        const zx = CX + Math.cos(ang) * 260, zy = CY + Math.sin(ang) * 150;
        const d = dist(p.x, p.y, zx, zy);
        r = d > 20 ? { x: (zx - p.x) / d * .6, y: (zy - p.y) / d * .6 } : { x: 0, y: 0 };
      }
      if (stufe === 0) {
        const a = Math.atan2(r.y, r.x) + rnd(-.6, .6), m = Math.hypot(r.x, r.y) * .85;
        p.bx = Math.cos(a) * m; p.by = Math.sin(a) * m; p.bz = S.t + rnd(.25, .5);
        return { x: p.bx, y: p.by, ap };
      }
      return { x: r.x, y: r.y, ap };
    },
    punkte(S) {
      const n = S.sp.length;
      if (zweier(S)) return S.sp.map(p => p.siege);
      return S.sp.map(p => p.raus ? p.aus : n - 1);
    },
    wert(S, k) {
      const p = S.sp[k];
      if (zweier(S)) return p.siege + ' / 2';
      return p.raus ? (S.sp.length - p.aus) + '.' : '';
    },
    zeichne(g, S, A) {
      const t = A.t;
      // Dschungel ringsum
      g.fillStyle = '#1f5a2e'; g.fillRect(0, 0, WELT_B, WELT_H);
      const lichtung = g.createRadialGradient(CX, CY - 60, 60, CX, CY, RX + 40);
      lichtung.addColorStop(0, '#b6e07a'); lichtung.addColorStop(.7, '#8ccb5c'); lichtung.addColorStop(1, '#5d9e3c');
      g.fillStyle = '#2f7a3b'; ellipse(g, CX, CY + 8, RX + 34, RY + 30); g.fill();
      g.fillStyle = lichtung; ellipse(g, CX, CY, RX + 22, RY + 20); g.fill();
      // Erdflecken und Grasbüschel
      g.fillStyle = 'rgba(150,110,60,.22)';
      for (const [x, y, rx, ry] of [[700, 470, 150, 60], [1010, 560, 120, 45], [600, 560, 90, 32], [960, 290, 110, 36]]) { ellipse(g, x, y, rx, ry); g.fill(); }
      g.strokeStyle = '#5f9a3a'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 40; i++) {
        const a = i * 2.39, rr = .2 + (i * .618 % 1) * .7;
        const x = CX + Math.cos(a) * RX * rr, y = CY + Math.sin(a) * RY * rr;
        g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 9, y - 12); g.moveTo(x, y); g.lineTo(x, y - 15); g.moveTo(x + 6, y); g.lineTo(x + 10, y - 11); g.stroke();
      }
      // Grosse Blätter am Rand der Lichtung
      const gruen = ['#2e8b3e', '#3fa34d', '#24753a', '#4bb35a'];
      for (let i = 0; i < 46; i++) {
        const a = i * TAU / 46 + (i % 2) * .05;
        const x = CX + Math.cos(a) * (RX + 40), y = CY + Math.sin(a) * (RY + 36);
        const w = Math.atan2(CY - y, CX - x) + Math.sin(t * .8 + i) * .05;
        g.save(); g.translate(x, y); g.rotate(w);
        g.fillStyle = gruen[i % 4];
        g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(30, -34, 78 + (i % 3) * 14, 0); g.quadraticCurveTo(30, 34, -10, 0); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 0); g.lineTo(70 + (i % 3) * 14, 0); g.stroke();
        g.restore();
      }
      // Hibiskusblüten im Dschungel
      for (const [x, y] of [[90, 200], [1530, 250], [1480, 860], [200, 860], [1500, 560], [60, 640]]) {
        g.fillStyle = '#ff4f6d';
        for (let b = 0; b < 5; b++) { const a = b * TAU / 5 + t * .2; ellipse(g, x + Math.cos(a) * 12, y + Math.sin(a) * 12, 13, 9, a); g.fill(); }
        g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
      }
      // Hindernisse und Figuren nach Tiefe sortiert
      const dinge = HINDERNISSE.map(o => ({ y: o.y, o }));
      S.sp.forEach((p, k) => { if (!p.raus) dinge.push({ y: p.y, k }); });
      dinge.sort((a, b) => a.y - b.y);
      for (const d of dinge) {
        if (d.o) { this.hindernis(g, d.o); continue; }
        const k = d.k, p = S.sp[k], traeger = S.bombe === k;
        const ring = traeger ? (Math.sin(t * 12) > 0 ? '#ff3b3b' : '#ffd23a') : A.farbe(k);
        g.fillStyle = 'rgba(0,0,0,.25)'; ellipse(g, p.x, p.y, 30, 10); g.fill();
        g.strokeStyle = ring; g.lineWidth = 4; ellipse(g, p.x, p.y, 32, 12); g.stroke();
        if (p.spr > 0) {    // Staubwolke beim Sprint
          g.fillStyle = 'rgba(255,255,255,.5)';
          for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(p.x - p.vx * .03 * i, p.y - p.vy * .03 * i - 6, 12 - i * 2, 0, TAU); g.fill(); }
        }
        const schock = traeger && S.lunte / S.zuend > .6;
        A.figur(k, p.x, p.y, 28, {
          schatten: false, laufen: Math.hypot(p.vx, p.vy) > 30, blick: p.blick, alpha: p.schutz > 0 ? .75 : 1,
          emo: p.russ > 0 ? 'traurig' : traeger ? (schock ? 'schock' : 'normal') : 'froh',
          kipp: traeger ? Math.sin(t * 18) * .05 : 0,
        });
        if (p.schutz > 0) {
          g.strokeStyle = 'rgba(140,220,255,.7)'; g.lineWidth = 3;
          g.beginPath(); g.arc(p.x, p.y - 30, 42, 0, TAU); g.stroke();
        }
        if (traeger) this.bombe(g, p.x + 6, p.y - 86, S.lunte / S.zuend, t, A);
      }
      // Druckwellen
      for (let i = wellen.length - 1; i >= 0; i--) {
        const w = wellen[i], a = (t - w.t) / .7;
        if (a >= 1) { wellen.splice(i, 1); continue; }
        g.globalAlpha = (1 - a) * .9;
        g.fillStyle = '#fff4c0'; g.beginPath(); g.arc(w.x, w.y, 30 + a * 60, 0, TAU); g.fill();
        g.strokeStyle = '#ff8a2a'; g.lineWidth = 16 * (1 - a); g.beginPath(); g.arc(w.x, w.y, 40 + a * 220, 0, TAU); g.stroke();
        if (a < .2) { g.globalAlpha = (.2 - a) * 2.5; g.fillStyle = '#fff'; g.fillRect(0, 0, WELT_B, WELT_H); }
        g.globalAlpha = 1;
      }
      // Bank der Ausgeschiedenen unten rechts
      const raus = S.sp.map((p, k) => k).filter(k => S.sp[k].raus).sort((a, b) => S.sp[a].aus - S.sp[b].aus);
      if (raus.length) {
        g.fillStyle = '#7a4a26'; rundRechteck(g, 1290, 862, 60 + raus.length * 62, 18, 9); g.fill();
        raus.forEach((k, i) => A.figur(k, 1330 + i * 62, 866, 20, { emo: 'traurig', schatten: false }));
        A.text('Raus', 1290 + (60 + raus.length * 62) / 2, 820, 22, '#ffd0d0');
      }
      // Ansagen
      if (S.bombe < 0 && S.endT <= 0) {
        const txt = S.t < 1 ? 'Wer kriegt die Bombe?' : zweier(S) ? 'Runde ' + S.runde : 'Neue Bombe kommt …';
        A.text(txt, CX, 130, 40, '#fff');
      }
      if (zweier(S)) {
        S.sp.forEach((p, k) => {
          for (let i = 0; i < 2; i++) {
            const x = k ? 1460 - i * 44 : 200 + i * 44;
            if (i < p.siege) zeichneStern(g, x, 110, 18, 0);
            else { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; sternPfad(g, x, 110, 18, 9); g.stroke(); }
          }
        });
      }
      for (const e of A.neu(S)) {
        if (e.typ === 'pass') { Ton.spiel('pop'); A.funken(e.x, e.y, '#ffd23a', 10, 220, 6); A.text3('Weg damit!', e.x, e.y - 20, '#fff'); }
        else if (e.typ === 'boom') { Ton.spiel('boom'); wellen.push({ x: e.x, y: e.y, t }); A.funken(e.x, e.y, '#ff7a2a', 26, 460, 10); A.funken(e.x, e.y, '#3a3440', 16, 300, 12); }
        else if (e.typ === 'neu') { Ton.spiel('item'); const p = S.sp[e.k]; if (p) A.text3('Bombe!', p.x, p.y - 130, '#ff6b6b'); }
        else if (e.typ === 'sprint') Ton.spiel('weg');
      }
    },
    // Bombe mit Zündschnur; u = 0..1 wie weit die Lunte heruntergebrannt ist
    bombe(g, x, y, u, t, A) {
      const r = 22;
      const gr = g.createRadialGradient(x - 8, y - 8, 2, x, y, r);
      gr.addColorStop(0, '#6b6f80'); gr.addColorStop(.5, '#2b2d38'); gr.addColorStop(1, '#14151c');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)'; ellipse(g, x - 8, y - 9, 6, 4, -.6); g.fill();
      g.fillStyle = '#4a4c58'; g.fillRect(x - 6, y - r - 6, 12, 8);
      g.strokeStyle = '#a07a4a'; g.lineWidth = 4; g.lineCap = 'round';
      const fx = x + 14, fy = y - r - 14;
      g.beginPath(); g.moveTo(x, y - r - 4); g.quadraticCurveTo(x + 4, y - r - 18, fx, fy); g.stroke();
      // Funken: je näher der Knall, desto schneller und grösser
      const tempo = 8 + 40 * u * u, puls = .6 + .4 * Math.sin(t * tempo);
      const fr = 7 + 6 * u * puls;
      g.fillStyle = '#ffef7a'; sternPfad(g, fx, fy, fr * 1.4, fr * .5, 6, t * tempo * .3); g.fill();
      g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(fx, fy, fr * .45, 0, TAU); g.fill();
      if (Math.random() < .08 + .5 * u) A.funken(fx, fy, Math.random() < .5 ? '#ffd23a' : '#ff8a2a', 1, 120 + 160 * u, 3);
    },
    hindernis(g, o) {
      bodenSchatten(g, o.x, o.y + o.r * .35, o.r * 1.1, .3);
      if (o.a === 'busch') {
        for (const [dx, dy, rr, f] of [[-.45, -.1, .65, '#2e8b3e'], [.45, -.05, .62, '#2e8b3e'], [0, -.45, .7, '#3fa34d'], [0, .1, .6, '#3a9a48']]) {
          g.fillStyle = f; g.beginPath(); g.arc(o.x + dx * o.r, o.y + dy * o.r - o.r * .3, rr * o.r, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(o.x - o.r * .2, o.y - o.r * .95, o.r * .3, 0, TAU); g.fill();
        g.fillStyle = '#e23b5a';
        for (const [dx, dy] of [[-.4, -.5], [.3, -.2], [.1, -.85], [-.1, .05]]) { g.beginPath(); g.arc(o.x + dx * o.r, o.y + dy * o.r - o.r * .3, 4.5, 0, TAU); g.fill(); }
      } else if (o.a === 'stein') {
        const gr = g.createLinearGradient(0, o.y - o.r * 1.3, 0, o.y + o.r * .4);
        gr.addColorStop(0, '#c7ccd6'); gr.addColorStop(1, '#6d7380');
        g.fillStyle = gr; ellipse(g, o.x, o.y - o.r * .4, o.r * 1.05, o.r * .85); g.fill();
        g.fillStyle = '#6fae45'; ellipse(g, o.x - o.r * .3, o.y - o.r * 1.05, o.r * .45, o.r * .16); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)'; ellipse(g, o.x - o.r * .35, o.y - o.r * .7, o.r * .25, o.r * .12, -.4); g.fill();
      } else {
        g.fillStyle = '#7a4a26'; g.fillRect(o.x - o.r * .85, o.y - o.r * .9, o.r * 1.7, o.r * .95);
        ellipse(g, o.x, o.y + o.r * .05, o.r * .85, o.r * .35); g.fill();
        g.fillStyle = '#d9a466'; ellipse(g, o.x, o.y - o.r * .9, o.r * .85, o.r * .35); g.fill();
        g.strokeStyle = '#a97a44'; g.lineWidth = 2;
        for (const s of [.6, .35]) { ellipse(g, o.x, o.y - o.r * .9, o.r * .85 * s, o.r * .35 * s); g.stroke(); }
      }
    },
  });
})();
