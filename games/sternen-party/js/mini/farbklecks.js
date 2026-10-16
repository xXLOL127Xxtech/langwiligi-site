// Minispiel „Farbklecks“: Kacheln in der eigenen Farbe anmalen (Draufsicht, Tasten)
// Wer läuft, färbt die Kachel unter sich. Die Farbbombe färbt 3 × 3 Kacheln auf einmal.
// Das Gitter liegt kompakt als String in S.g: '.' = leer, '0'..'3' = Besitzer (Spieler oder Team).
'use strict';
(() => {
  const SP = 20, ZE = 11, K = 66;            // Spalten, Zeilen, Kachelgrösse
  const X0 = 166, Y0 = 118;                  // linke obere Ecke des Feldes
  const B = SP * K, H = ZE * K;              // Feldgrösse in Pixeln
  const TEMPO = 330, BOMBE_CD = 4;
  const SOLO_TEMPO = 1.35, SOLO_CD = 2.5;    // 1 gegen 3: der Einzelspieler ist schneller, lädt schneller
  const SOLO_FAKTOR = 2.8;                   // und malt grössere Kleckse; seine Kacheln zählen mehr, damit es fair bleibt

  const teamModus = info => info.format === '2v2' || info.format === '1v3';
  const spalte = x => clamp(Math.floor((x - X0) / K), 0, SP - 1);
  const zeile = y => clamp(Math.floor((y - Y0) / K), 0, ZE - 1);
  const mitteX = c => X0 + c * K + K / 2, mitteY = r => Y0 + r * K + K / 2;

  // Anzahl Kacheln pro Besitzer-Zeichen
  function zaehle(g) {
    const n = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < g.length; i++) if (g[i] !== '.') n[g[i]]++;
    return n;
  }
  // Punkte pro Teilnehmer (auch für die Anzeige oben)
  function punkteVon(S) {
    const n = zaehle(S.g);
    return S.sp.map((p, k) => {
      const v = n[S.own[k]];
      return S.mod === '1v3' && k === S.solo ? Math.round(v * SOLO_FAKTOR) : v;
    });
  }

  // Zeichen-Zwischenspeicher für die Kachel-Animation (nur Optik, pro Rechner)
  let altG = '', geaendert = new Float64Array(SP * ZE);
  const kleckse = [];

  Minis.reg({
    id: 'farbklecks', name: 'Farbklecks',
    text: 'Lauf übers Feld und färbe die Kacheln in deiner Farbe. Die Farbbombe färbt alles rund um dich. Wer am Schluss die meisten Kacheln hat, gewinnt!',
    steuerung: { tasten: 'Richtungstasten laufen, Aktion Farbbombe (alle 4 s)' },
    formate: ['ffa', '2v2', 'duell'],
    dauer: 30,
    start(S, info) {
      const n = info.teilnehmer.length;
      S.mod = info.format === '1v3' ? '1v3' : teamModus(info) ? 'team' : 'ffa';
      S.solo = info.solo;
      S.own = info.teilnehmer.map((p, k) => String(teamModus(info) ? info.teams[k] : k));
      S.g = '.'.repeat(SP * ZE);
      // Startkacheln: Ecken, bei Teams nach Seiten getrennt
      let pos;
      if (info.format === '1v3') {
        const rechts = [[16, 2], [16, 5], [16, 8]]; let i = 0;
        pos = info.teilnehmer.map((p, k) => k === info.solo ? [3, 5] : rechts[i++]);
      } else if (info.format === '2v2') {
        const seite = [[[2, 2], [2, 8]], [[17, 2], [17, 8]]], z = [0, 0];
        pos = info.teilnehmer.map((p, k) => seite[info.teams[k]][z[info.teams[k]]++]);
      } else pos = [[2, 2], [17, 8], [17, 2], [2, 8]].slice(0, n);
      S.sp = pos.map(([c, r], k) => ({
        x: mitteX(c), y: mitteY(r) + 20, cd: 1, blick: c < 10 ? 1 : -1, zi: -1, zt: 0,
        tempo: info.format === '1v3' && k === info.solo ? SOLO_TEMPO : 1,
        cdMax: info.format === '1v3' && k === info.solo ? SOLO_CD : BOMBE_CD,
        br: info.format === '1v3' && k === info.solo ? 2 : 1,      // Klecks-Radius in Kacheln
      }));
    },
    schritt(S, ein, dt) {
      const g = S.g.split('');
      S.sp.forEach((p, k) => {
        const e = ein[k];
        let vx = e.x || 0, vy = e.y || 0;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }
        p.x = clamp(p.x + vx * TEMPO * p.tempo * dt, X0 + 20, X0 + B - 20);
        p.y = clamp(p.y + vy * TEMPO * p.tempo * dt, Y0 + 26, Y0 + H - 6);
        if (Math.abs(vx) > .1) p.blick = Math.sign(vx);
        p.lauf = l > .1 ? 1 : 0;
        // Kachel unter den Füssen färben
        const c = spalte(p.x), r = zeile(p.y - 10);
        g[r * SP + c] = S.own[k];
        // Farbbombe
        p.cd = Math.max(0, p.cd - dt);
        if (e.ap && p.cd <= 0) {
          p.cd = p.cdMax;
          for (let dr = -p.br; dr <= p.br; dr++) for (let dc = -p.br; dc <= p.br; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < ZE && cc >= 0 && cc < SP) g[rr * SP + cc] = S.own[k];
          }
          Minis.ereignis(S, { typ: 'klecks', x: mitteX(c), y: mitteY(r), k, br: p.br });
        }
      });
      // Figuren schieben sich sanft auseinander
      for (let i = 0; i < S.sp.length; i++) for (let j = i + 1; j < S.sp.length; j++) {
        const a = S.sp[i], b = S.sp[j], d = dist(a.x, a.y, b.x, b.y);
        if (d < 40 && d > .01) {
          const s = (40 - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * s; a.y -= ny * s; b.x += nx * s; b.y += ny * s;
        }
      }
      S.g = g.join('');
    },
    ki(S, k, stufe) {
      const p = S.sp[k], own = S.own[k];
      const c0 = spalte(p.x), r0 = zeile(p.y - 10);
      const fremd = i => S.g[i] !== own;
      // Wert einer Kachel als Ziel: fremde Kacheln ringsum, Entfernung, andere Figuren in der Nähe
      const wertVon = (c, r) => {
        let v = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= ZE || cc < 0 || cc >= SP) continue;
          const z = S.g[rr * SP + cc];
          if (z !== own) v += z === '.' ? 1 : 1.5;
        }
        v -= Math.hypot(c - c0, r - r0) * .8;
        S.sp.forEach((q, j) => {
          if (j === k) return;
          const d = Math.hypot(spalte(q.x) - c, zeile(q.y - 10) - r);
          if (d < 3) v -= (3 - d) * (S.own[j] === own ? 2.5 : 1);
          if (q.zi >= 0 && S.own[j] === own) { const dz = Math.hypot(q.zi % SP - c, Math.floor(q.zi / SP) - r); if (dz < 3) v -= (3 - dz) * 1.5; }
        });
        return v;
      };
      // Steckt die Figur fest (z.B. an einer anderen Figur)? Dann ein anderes Ziel wählen.
      const bewegt = dist(p.x, p.y, p.lx || 0, p.ly || 0);
      p.lx = p.x; p.ly = p.y;
      p.st = bewegt < 1.5 && p.zi >= 0 && dist(p.x, p.y, mitteX(p.zi % SP), mitteY(Math.floor(p.zi / SP)) + 10) > 8 ? (p.st || 0) + 1 : 0;
      if (p.st > 15) {
        // Ausweichen: irgendeine fremde Kachel weiter weg, eine Weile dabei bleiben
        const kand = [];
        for (let i = 0; i < SP * ZE; i++) if (fremd(i) && Math.abs(i % SP - c0) + Math.abs(Math.floor(i / SP) - r0) > 3) kand.push(i);
        p.zi = kand.length ? wahl(kand) : rndi(0, SP * ZE - 1); p.zt = S.t + 1.5; p.st = 0;
      }
      const neuDenken = p.zi < 0 || !fremd(p.zi) || S.t > p.zt;
      if (neuDenken) {
        if (stufe === 0) {
          // Leicht: irgendeine fremde Kachel in der Nähe, lange dabei bleiben
          const kand = [];
          for (let r = Math.max(0, r0 - 4); r <= Math.min(ZE - 1, r0 + 4); r++)
            for (let c = Math.max(0, c0 - 5); c <= Math.min(SP - 1, c0 + 5); c++) if (fremd(r * SP + c)) kand.push(r * SP + c);
          p.zi = kand.length ? wahl(kand) : rndi(0, SP * ZE - 1);
          p.zt = S.t + rnd(1.2, 2.4);
        } else {
          let best = -1e9, bi = -1;
          for (let r = 0; r < ZE; r++) for (let c = 0; c < SP; c++) {
            const i = r * SP + c;
            if (!fremd(i)) continue;
            const v = wertVon(c, r) + (stufe === 2 ? 0 : Math.random() * 4);
            if (v > best) { best = v; bi = i; }
          }
          p.zi = bi >= 0 ? bi : rndi(0, SP * ZE - 1);
          p.zt = S.t + (stufe === 2 ? .35 : .8);
        }
      }
      const zx = mitteX(p.zi % SP), zy = mitteY(Math.floor(p.zi / SP)) + 10;
      const dx = zx - p.x, dy = zy - p.y, d = Math.hypot(dx, dy) || 1;
      const tempo = [.8, .95, 1][stufe];
      let x = dx / d, y = dy / d;
      // Anderen Figuren auf dem Weg seitlich ausweichen
      const x0 = x, y0 = y;
      S.sp.forEach((q, j) => {
        if (j === k) return;
        const ox = q.x - p.x, oy = q.y - p.y, od = Math.hypot(ox, oy);
        if (od > 80 || od < .01 || (ox * x0 + oy * y0) / od < .3) return;
        const px = -y0, py = x0;                 // immer rechts vorbei, so weichen beide in Gegenrichtung aus
        x += px * .9; y += py * .9;
      });
      const xl = Math.hypot(x, y) || 1;
      x = x / xl * tempo; y = y / xl * tempo;
      if (d < 6) { x = 0; y = 0; }
      if (stufe === 0 && Math.sin(S.t * 1.7 + k * 2) > .75) { x *= .2; y *= .2; }   // trödelt manchmal
      // Farbbombe: wann lohnt sie sich?
      let ap = false;
      if (p.cd <= 0) {
        if (stufe === 0) ap = Math.random() < .01;
        else {
          let v = 0;
          for (let dr = -p.br; dr <= p.br; dr++) for (let dc = -p.br; dc <= p.br; dc++) {
            const rr = r0 + dr, cc = c0 + dc;
            if (rr >= 0 && rr < ZE && cc >= 0 && cc < SP && fremd(rr * SP + cc)) v += S.g[rr * SP + cc] === '.' ? 1 : 1.4;
          }
          ap = v >= (stufe === 2 ? 6.5 : 5) * p.br * p.br;
        }
      }
      return { x, y, ap };
    },
    punkte(S) { return punkteVon(S); },
    wert(S, k) { return punkteVon(S)[k]; },
    zeichne(g, S, A) {
      const team = teamModus(A.info);
      const farbe = ch => team ? TEAM_FARBEN[+ch] : A.farbe(+ch);
      // Hintergrund: Malatelier im Garten – Wiese mit Blumen und Farbtöpfen
      const h = g.createLinearGradient(0, 0, 0, WELT_H);
      h.addColorStop(0, '#8fdc6a'); h.addColorStop(1, '#5fb548');
      g.fillStyle = h; g.fillRect(0, 0, WELT_B, WELT_H);
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let i = 0; i < 9; i++) { ellipse(g, (i * 271) % WELT_B + 60, (i * 157) % WELT_H + 40, 160, 60); g.fill(); }
      const blumen = ['#ff6fae', '#ffe14d', '#ffffff', '#b98cff'];
      for (let i = 0; i < 26; i++) {
        const x = (i * 613 + 40) % WELT_B, y = (i * 389 + 90) % WELT_H;
        if (x > X0 - 30 && x < X0 + B + 30 && y > Y0 - 30 && y < Y0 + H + 30) continue;
        g.fillStyle = blumen[i % 4];
        for (let b = 0; b < 5; b++) { const a = b * TAU / 5; g.beginPath(); g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, TAU); g.fill(); }
        g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
      }
      // Farbtöpfe an den Ecken
      const toepfe = [[70, 150, '#ef5350'], [1556, 150, '#4f8ff7'], [1556, 850, '#43c463'], [70, 850, '#ffb52e']];
      for (const [x, y, f] of toepfe) {
        bodenSchatten(g, x, y + 22, 30, .25);
        g.fillStyle = '#c9ced8'; rundRechteck(g, x - 26, y - 20, 52, 44, 10); g.fill();
        g.fillStyle = '#e8ecf3'; ellipse(g, x, y - 20, 26, 9); g.fill();
        g.fillStyle = f; ellipse(g, x, y - 20, 21, 6.5); g.fill();
        g.fillStyle = f; rundRechteck(g, x - 26, y - 14, 10, 22, 5); g.fill();
      }
      // Holzrahmen und Feld
      g.fillStyle = 'rgba(0,0,0,.18)'; rundRechteck(g, X0 - 14, Y0 - 6, B + 28, H + 30, 22); g.fill();
      const rahmen = g.createLinearGradient(0, Y0 - 16, 0, Y0 + H + 16);
      rahmen.addColorStop(0, '#d9a066'); rahmen.addColorStop(1, '#9c6332');
      g.fillStyle = rahmen; rundRechteck(g, X0 - 16, Y0 - 16, B + 32, H + 32, 22); g.fill();
      g.fillStyle = '#f7f1e6'; g.fillRect(X0, Y0, B, H);
      // Kacheln: geänderte Kacheln „ploppen“ kurz auf
      if (S.g.length !== altG.length) { altG = S.g; geaendert.fill(-9); }
      for (let i = 0; i < S.g.length; i++) if (S.g[i] !== altG[i]) geaendert[i] = A.t;
      altG = S.g;
      for (let r = 0; r < ZE; r++) for (let c = 0; c < SP; c++) {
        const i = r * SP + c, x = X0 + c * K, y = Y0 + r * K, z = S.g[i];
        if (z === '.') {
          g.fillStyle = (r + c) % 2 ? '#efe7d8' : '#f8f3ea';
          g.fillRect(x, y, K, K);
          continue;
        }
        const a = clamp((A.t - geaendert[i]) / .25, 0, 1), s = .55 + .45 * Ease.outBack(a);
        const w = (K - 4) * s, o = (K - w) / 2;
        g.fillStyle = farbe(z); rundRechteck(g, x + o, y + o, w, w, 14 * s); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)'; rundRechteck(g, x + o + 6 * s, y + o + 5 * s, w - 12 * s, w * .32, 8 * s); g.fill();
        g.fillStyle = 'rgba(0,0,0,.12)'; rundRechteck(g, x + o + 4 * s, y + o + w * .78, w - 8 * s, w * .14, 5 * s); g.fill();
      }
      g.strokeStyle = 'rgba(120,90,50,.18)'; g.lineWidth = 1;
      g.beginPath();
      for (let c = 1; c < SP; c++) { g.moveTo(X0 + c * K, Y0); g.lineTo(X0 + c * K, Y0 + H); }
      for (let r = 1; r < ZE; r++) { g.moveTo(X0, Y0 + r * K); g.lineTo(X0 + B, Y0 + r * K); }
      g.stroke();
      // Aufspritzende Farbkleckse (nur Optik)
      for (let i = kleckse.length - 1; i >= 0; i--) {
        const kl = kleckse[i], a = (A.t - kl.t) / .5;
        if (a >= 1) { kleckse.splice(i, 1); continue; }
        g.globalAlpha = 1 - a; g.strokeStyle = kl.f; g.lineWidth = 12 * (1 - a);
        g.beginPath(); g.arc(kl.x, kl.y, (40 + a * 110) * (kl.br > 1 ? 1.6 : 1), 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
      // Figuren, von hinten nach vorne
      const reihe = S.sp.map((p, k) => k).sort((a, b) => S.sp[a].y - S.sp[b].y);
      for (const k of reihe) {
        const p = S.sp[k], f = farbe(S.own[k]);
        g.fillStyle = 'rgba(0,0,0,.25)'; ellipse(g, p.x, p.y, 30, 10); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 7; ellipse(g, p.x, p.y, 32, 12); g.stroke();
        g.strokeStyle = f; g.lineWidth = 4; ellipse(g, p.x, p.y, 32, 12); g.stroke();
        A.figur(k, p.x, p.y, S.mod === '1v3' && k === S.solo ? 30 : 26, { schatten: false, laufen: p.lauf, blick: p.blick });
        // Farbbombe bereit? kleiner Farbtropfen über dem Kopf, sonst Ladebogen
        const ty = p.y - 78;
        if (p.cd <= 0) {
          const hp = Math.sin(A.t * 6 + k) * 3;
          g.fillStyle = f; g.strokeStyle = '#fff'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(p.x, ty - 14 + hp); g.quadraticCurveTo(p.x + 11, ty + hp, p.x, ty + 8 + hp); g.quadraticCurveTo(p.x - 11, ty + hp, p.x, ty - 14 + hp); g.fill(); g.stroke();
        } else {
          g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 5; g.beginPath(); g.arc(p.x, ty, 9, 0, TAU); g.stroke();
          g.strokeStyle = f; g.beginPath(); g.arc(p.x, ty, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.cd / p.cdMax)); g.stroke();
        }
      }
      for (const e of A.neu(S)) {
        if (e.typ === 'klecks') {
          const f = farbe(S.own[e.k]);
          Ton.spiel('platsch'); A.funken(e.x, e.y, f, 22, 380, 9);
          kleckse.push({ x: e.x, y: e.y, f, t: A.t, br: e.br || 1 });
        }
      }
    },
  });
})();
