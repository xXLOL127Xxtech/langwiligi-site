// Minispiel „Schubs-Scholle“: auf einer schmelzenden Eisscholle die anderen ins Meer schubsen (Draufsicht, Tasten)
'use strict';
Minis.reg({
  id: 'schubs-arena', name: 'Schubs-Scholle',
  text: 'Die Eisscholle schmilzt! Rutsch herum und schubs die anderen mit deinem Stoss ins Meer. Wer am längsten trocken bleibt, gewinnt.',
  steuerung: { tasten: 'Richtungen rutschen, Aktion Stoss-Sprint' },
  formate: ['ffa', '2v2', 'duell'],
  dauer: 45,
  CX: 800, CY: 540, K: .6,       // Mitte der Scholle auf dem Bildschirm, K staucht y (schräge Draufsicht)
  R0: 390, R1: 150,              // Radius der Scholle am Anfang und am Ende
  PR: 34,                        // Körperradius für Zusammenstösse
  DICKE: 30,                     // sichtbare Dicke der Scholle (Abstand Eis-Oberfläche bis Wasser)
  BESCHL: 860, BREMS: 2.7,       // Beschleunigung und Reibung (wenig Reibung = rutschig)
  SPRINT: 600, WUCHT: 110,       // Tempo beim Stoss-Sprint und Extra-Schwung für den Getroffenen
  radius(t) { return lerp(this.R0, this.R1, clamp((t - 4) / 34, 0, 1)); },
  teams(info) { return info.format === '2v2' || info.format === '1v3'; },
  // Form der Scholle: leicht unregelmässiger Rand (fest, damit alle Rechner das Gleiche sehen)
  rand(i) { return 1 + .035 * Math.sin(i * 3.7) + .025 * Math.cos(i * 5.3 + 1); },
  start(S, info) {
    const n = info.teilnehmer.length;
    S.R = this.R0; S.ende = 0;
    S.sp = info.teilnehmer.map((_, k) => {
      const a = -Math.PI * .75 + k * TAU / n;
      return { x: Math.cos(a) * 210, y: Math.sin(a) * 210, vx: 0, vy: 0, bx: -Math.cos(a), by: -Math.sin(a), sp: 0, cd: 0, hit: 0, aus: false, zeit: 0, z: 0 };
    });
  },
  schritt(S, ein, dt, info) {
    S.R = this.radius(S.t);
    const alle = S.sp;
    alle.forEach((p, k) => {
      if (p.aus) {
        // Im Wasser treiben, langsam vom Eis weg
        p.z = Math.min(1, p.z + dt * 2.6);
        const f = Math.exp(-2.5 * dt); p.vx *= f; p.vy *= f;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const d = Math.hypot(p.x, p.y) || 1, min = S.R + 60;
        if (d < min) { p.x *= min / d; p.y *= min / d; }
        p.x = clamp(p.x, -620, 620); p.y = clamp(p.y, -(this.CY - 210) / this.K, (WELT_H - 30 - this.CY) / this.K);
        return;
      }
      const e = ein[k];
      let ix = e.x || 0, iy = e.y || 0;
      const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      const il = Math.hypot(ix, iy);
      if (l > .2 && il > 0) { p.bx = ix / il; p.by = iy / il; }
      p.cd = Math.max(0, p.cd - dt); p.sp = Math.max(0, p.sp - dt); p.hit = Math.max(0, p.hit - dt);
      // Steuern: nach einem Treffer nur wenig Kontrolle
      const kontrolle = p.hit > 0 ? .25 : 1;
      p.vx += ix * this.BESCHL * kontrolle * dt; p.vy += iy * this.BESCHL * kontrolle * dt;
      // Stoss-Sprint
      if (e.ap && p.cd <= 0 && p.hit <= 0) {
        p.vx = p.bx * this.SPRINT + p.vx * .25; p.vy = p.by * this.SPRINT + p.vy * .25;
        p.sp = .3; p.cd = 1;
        Minis.ereignis(S, { typ: 'sprint', k });
      }
      const f = Math.exp(-this.BREMS * dt); p.vx *= f; p.vy *= f;
      p.x += p.vx * dt; p.y += p.vy * dt;
    });
    // Zusammenstösse zwischen allen, die noch auf dem Eis sind (auch Teamkollegen)
    for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) {
      const a = alle[i], b = alle[j];
      if (a.aus || b.aus) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= this.PR * 2 || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, ueber = this.PR * 2 - d;
      a.x -= nx * ueber / 2; a.y -= ny * ueber / 2; b.x += nx * ueber / 2; b.y += ny * ueber / 2;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel <= 0) continue;
      // Stoss bei gleicher Masse (etwas gedämpft, Eis ist nicht ganz elastisch)
      const im = rel * .85;
      a.vx -= im * nx; a.vy -= im * ny; b.vx += im * nx; b.vy += im * ny;
      const mx = this.CX + (a.x + b.x) / 2, my = this.CY + (a.y + b.y) / 2 * this.K - 40;
      if (a.sp > 0 && a.sp >= b.sp) {
        b.vx += nx * this.WUCHT; b.vy += ny * this.WUCHT; b.hit = .4; a.sp = 0; a.vx *= .4; a.vy *= .4;
        Minis.ereignis(S, { typ: 'stoss', x: mx, y: my });
      } else if (b.sp > 0) {
        a.vx -= nx * this.WUCHT; a.vy -= ny * this.WUCHT; a.hit = .4; b.sp = 0; b.vx *= .4; b.vy *= .4;
        Minis.ereignis(S, { typ: 'stoss', x: mx, y: my });
      } else if (rel > 180) Minis.ereignis(S, { typ: 'bump', x: mx, y: my });
    }
    // Wer über den Rand rutscht, fällt ins Wasser
    alle.forEach((p, k) => {
      if (p.aus) return;
      if (Math.hypot(p.x, p.y) > S.R * this.rand(0) + 6) {
        p.aus = true; p.zeit = r1(S.t); p.z = 0; p.sp = 0;
        // weiter nach aussen rutschen, damit die Figur sichtbar neben dem Eis landet
        const d = Math.hypot(p.x, p.y);
        p.vx += p.x / d * 120; p.vy += p.y / d * 120;
        Minis.ereignis(S, { typ: 'platsch', k, x: this.CX + p.x, y: this.CY + p.y * this.K + this.DICKE });
      }
    });
    // Ende: nur noch einer (bzw. ein Team) auf dem Eis
    const drin = alle.map((p, k) => k).filter(k => !alle[k].aus);
    let vorbei;
    if (this.teams(info)) vorbei = [0, 1].some(tm => !drin.some(k => info.teams[k] === tm));
    else vorbei = drin.length <= 1;
    if (vorbei) { S.ende += dt; if (S.ende > 1.3) S.fertig = true; }
  },
  ki(S, k, stufe, info) {
    const p = S.sp[k];
    if (!p || p.aus) return {};
    const R = S.R, team = this.teams(info);
    const pd = Math.hypot(p.x, p.y) || 1;
    // Wohin rutsche ich gerade? Gute Bots schauen voraus.
    const vor = [.1, .35, .55][stufe];
    const fx = p.x + p.vx * vor, fy = p.y + p.vy * vor;
    const fd = Math.hypot(fx, fy) || 1;
    const sicher = [60, 80, 100][stufe];
    // Ziel wählen: nahe Gegner, gute Bots bevorzugen solche am Rand; jeder Bot hat eine eigene Vorliebe
    let ziel = null, best = 1e9;
    S.sp.forEach((q, j) => {
      if (j === k || q.aus || (team && info.teams[j] === info.teams[k])) return;
      const d = dist(p.x, p.y, q.x, q.y);
      const randAbst = R - Math.hypot(q.x, q.y);
      const w = d + randAbst * [0, .7, 1.1][stufe] + ((j * 5 + k * 3) % 4) * 45;
      if (w < best) { best = w; ziel = q; }
    });
    let ix = 0, iy = 0, ap = false;
    if (ziel) {
      // Auf die Seite des Ziels, die zur Mitte zeigt, dann nach aussen stossen
      const zd = Math.hypot(ziel.x, ziel.y) || 1;
      const ox = ziel.x / zd, oy = ziel.y / zd;
      const hx = ziel.x - ox * 110, hy = ziel.y - oy * 110;
      const tx = hx - p.x, ty = hy - p.y, tl = Math.hypot(tx, ty) || 1;
      ix = tx / tl; iy = ty / tl;
      const dx = ziel.x - p.x, dy = ziel.y - p.y, dl = Math.hypot(dx, dy) || 1;
      const ausgerichtet = (dx / dl) * ox + (dy / dl) * oy;
      const reichweite = [170, 210, 240][stufe];
      if (dl < reichweite && (ausgerichtet > [-.3, .45, .6][stufe] || dl < 90)) {
        // Nach dem Stoss nicht selbst ins Wasser rutschen
        const nachX = p.x + dx / dl * 230, nachY = p.y + dy / dl * 230;
        if (Math.hypot(nachX, nachY) < R + 40 || dl < 100) {
          ix = dx / dl; iy = dy / dl;
          ap = Math.random() < [.04, .12, .5][stufe];
        }
      }
      if (stufe === 0) { const a = Math.sin(S.t * 1.7 + k * 2) * .9; const c = Math.cos(a), s = Math.sin(a); [ix, iy] = [ix * c - iy * s, ix * s + iy * c]; }
    }
    // Ausweichen, wenn ein Gegner auf mich zusprintet (nur Schwer)
    if (stufe === 2) S.sp.forEach((q, j) => {
      if (j === k || q.aus || q.sp <= 0 || (team && info.teams[j] === info.teams[k])) return;
      const dx = p.x - q.x, dy = p.y - q.y, dl = Math.hypot(dx, dy) || 1;
      const kommt = (q.vx * dx + q.vy * dy) / (dl * (Math.hypot(q.vx, q.vy) || 1));
      if (dl < 220 && kommt > .8) {
        // quer zur Stossrichtung ausweichen, und zwar auf die Seite zur Mitte hin
        let qx = -dy / dl, qy = dx / dl;
        if (qx * p.x + qy * p.y > 0) { qx = -qx; qy = -qy; }
        ix = qx; iy = qy; ap = false;
      }
    });
    // Zu nah am Rand: zurück zur Mitte
    if (fd > R - sicher) {
      const st = clamp((fd - (R - sicher)) / sicher, 0, 1) * [.8, 1, 1][stufe];
      ix = lerp(ix, -fx / fd, st); iy = lerp(iy, -fy / fd, st);
      if (stufe > 0) ap = ap && fd < R - 20;
    }
    if (pd > R - 30 && stufe === 2 && p.cd <= 0 && (p.vx * p.x + p.vy * p.y) > 0) { ix = -p.x / pd; iy = -p.y / pd; ap = true; }
    return { x: ix, y: iy, ap };
  },
  punkte(S) { return S.sp.map(p => p.aus ? p.zeit : r1(S.t) + 5); },
  wert(S, k) { return S.sp[k].aus ? 'raus' : ''; },
  zeichne(g, S, A) {
    const CX = this.CX, CY = this.CY, K = this.K, D = this.DICKE, t = A.t;
    // Himmel mit Horizont
    const h = g.createLinearGradient(0, 0, 0, 240);
    h.addColorStop(0, '#7ec8ff'); h.addColorStop(1, '#d9f2ff');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, 240);
    // Ferne Eisberge
    const berge = [[90, 210, 120, 70], [300, 215, 80, 45], [1180, 212, 140, 85], [1420, 214, 90, 55], [700, 218, 60, 30]];
    for (const [x, y, b, hh] of berge) {
      g.fillStyle = '#f4fbff';
      g.beginPath(); g.moveTo(x - b, y); g.lineTo(x - b * .35, y - hh); g.lineTo(x - b * .1, y - hh * .82); g.lineTo(x + b * .25, y - hh * 1.05); g.lineTo(x + b, y); g.closePath(); g.fill();
      g.fillStyle = '#bfe3f7';
      g.beginPath(); g.moveTo(x + b * .25, y - hh * 1.05); g.lineTo(x + b, y); g.lineTo(x + b * .1, y); g.closePath(); g.fill();
    }
    // Meer
    const m = g.createLinearGradient(0, 205, 0, WELT_H);
    m.addColorStop(0, '#5fb6dd'); m.addColorStop(.35, '#2b86c0'); m.addColorStop(1, '#16508c');
    g.fillStyle = m; g.fillRect(0, 205, WELT_B, WELT_H - 205);
    // Wellen
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const wy = 240 + ((i * 97) % 640), sk = .5 + (wy - 205) / 700;
      const wx = ((i * 211 + t * (14 + (i % 4) * 5)) % (WELT_B + 200)) - 100;
      g.beginPath(); g.moveTo(wx - 26 * sk, wy); g.quadraticCurveTo(wx - 13 * sk, wy - 7 * sk, wx, wy); g.quadraticCurveTo(wx + 13 * sk, wy + 7 * sk, wx + 26 * sk, wy); g.stroke();
    }
    // Kleine Eisstücke mit Deko (Pinguin-Zuschauer, Fisch)
    const stuecke = [[200, 330, 60], [1430, 300, 70], [230, 780, 55], [1390, 800, 64]];
    stuecke.forEach(([x, y, r], i) => {
      const yy = y + Math.sin(t * 1.3 + i) * 4;
      g.fillStyle = '#9fd3ee'; ellipse(g, x, yy + 9, r, r * .42); g.fill();
      g.fillStyle = '#f3fbff'; ellipse(g, x, yy, r, r * .4); g.fill();
      if (i % 2 === 0) {
        // Kleiner Zuschauer-Pinguin
        const px = x + 8, py = yy + 2;
        g.fillStyle = '#26324a'; ellipse(g, px, py - 22, 13, 20); g.fill();
        g.fillStyle = '#fff'; ellipse(g, px + 2, py - 18, 8, 14); g.fill();
        g.fillStyle = '#ff9a2e'; g.beginPath(); g.moveTo(px + 7, py - 32); g.lineTo(px + 16, py - 30); g.lineTo(px + 7, py - 27); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(px + 4, py - 34, 2, 0, TAU); g.fill();
        g.strokeStyle = '#26324a'; g.lineWidth = 4; g.beginPath(); g.moveTo(px - 11, py - 24); g.lineTo(px - 16, py - 12 + Math.sin(t * 6 + i) * 5); g.stroke();
      }
    });

    // Figuren im Wasser hinter der Scholle zuerst
    const schwimmer = S.sp.map((p, k) => ({ p, k })).filter(o => o.p.aus);
    const sy = p => CY + p.y * K;
    for (const o of schwimmer) if (sy(o.p) < CY) this.zeichneSchwimmer(g, o.p, o.k, A);

    // Scholle: Seitenwand, Schaum am Wasser, Oberfläche
    const R = S.R, N = 36;
    const pfad = (dy, rr) => {
      g.beginPath();
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, rad = rr * this.rand(i);
        const x = CX + Math.cos(a) * rad, y = CY + Math.sin(a) * rad * K + dy;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    };
    g.fillStyle = 'rgba(255,255,255,.35)'; pfad(D + 4, R + 16); g.fill();
    g.fillStyle = 'rgba(10,50,90,.25)'; pfad(D + 10, R + 4); g.fill();
    g.fillStyle = '#8ccbe8'; pfad(D, R); g.fill();
    g.fillStyle = '#b5e2f5'; pfad(D * .45, R); g.fill();
    const eis = g.createRadialGradient(CX - R * .3, CY - R * K * .4, R * .1, CX, CY, R * 1.05);
    eis.addColorStop(0, '#ffffff'); eis.addColorStop(.65, '#eaf8ff'); eis.addColorStop(1, '#c4e8f8');
    g.fillStyle = eis; pfad(0, R); g.fill();
    g.strokeStyle = 'rgba(120,190,225,.8)'; g.lineWidth = 2.5; g.stroke();
    // Risse und Schneeflecken (skalieren mit der Scholle)
    g.strokeStyle = 'rgba(110,175,215,.55)'; g.lineWidth = 2.5;
    for (const [a, l1, l2, kn] of [[.5, .25, .85, .3], [2.3, .15, .75, -.25], [3.9, .3, .95, .2], [5.2, .2, .7, -.3]]) {
      g.beginPath();
      g.moveTo(CX + Math.cos(a) * R * l1, CY + Math.sin(a) * R * l1 * K);
      const am = a + kn * .5, lm = (l1 + l2) / 2;
      g.lineTo(CX + Math.cos(am) * R * lm, CY + Math.sin(am) * R * lm * K);
      g.lineTo(CX + Math.cos(a) * R * l2, CY + Math.sin(a) * R * l2 * K);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (const [a, l, s] of [[1.2, .55, 40], [3.1, .45, 55], [4.6, .62, 34], [5.9, .35, 46]]) { ellipse(g, CX + Math.cos(a) * R * l, CY + Math.sin(a) * R * l * K, s * R / this.R0, s * R / this.R0 * K * .7); g.fill(); }
    // Warnsaum am Rand, wenn die Scholle schmilzt
    if (S.t > 3) { g.strokeStyle = `rgba(255,255,255,${.35 + .25 * Math.sin(t * 5)})`; g.lineWidth = 4; g.setLineDash([14, 12]); pfad(0, R - 12); g.stroke(); g.setLineDash([]); }

    // Figuren auf dem Eis und Schwimmer vorne, nach Tiefe sortiert
    const liste = S.sp.map((p, k) => ({ p, k })).filter(o => !o.p.aus || sy(o.p) >= CY).sort((a, b) => sy(a.p) - sy(b.p));
    for (const { p, k } of liste) {
      if (p.aus) { this.zeichneSchwimmer(g, p, k, A); continue; }
      const x = CX + p.x, y = sy(p);
      // Ring am Boden in Spieler- bzw. Teamfarbe, Bogen zeigt, wann der Stoss wieder bereit ist
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.18)'; ellipse(g, x, y + 2, 44, 44 * K); g.stroke();
      g.strokeStyle = A.teamFarbe(k); g.globalAlpha = .55; ellipse(g, x, y, 44, 44 * K); g.stroke(); g.globalAlpha = 1;
      if (p.cd < .99) {
        g.lineWidth = 6; g.beginPath(); g.ellipse(x, y, 44, 44 * K, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.cd)); g.stroke();
      }
      // Richtungspfeil
      const pa = Math.atan2(p.by * K, p.bx);
      g.fillStyle = A.teamFarbe(k);
      g.save(); g.translate(x + p.bx * 58, y + p.by * 58 * K); g.rotate(pa);
      g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -8); g.lineTo(-6, 8); g.closePath(); g.fill(); g.restore();
      // Tempo-Striche beim Sprint
      const v = Math.hypot(p.vx, p.vy);
      if (p.sp > 0 || v > 420) {
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4;
        for (let i = -1; i <= 1; i++) {
          const ux = -p.vx / v, uy = -p.vy / v * K;
          const ox = -uy * i * 16, oy = ux * i * 16;
          g.beginPath(); g.moveTo(x + ux * 40 + ox, y - 36 + uy * 40 + oy); g.lineTo(x + ux * (80 + Math.abs(i) * -10) + ox, y - 36 + uy * (80 + Math.abs(i) * -10) + oy); g.stroke();
        }
      }
      bodenSchatten(g, x, y, 34);
      const randNah = Math.hypot(p.x, p.y) > R - 50;
      A.figur(k, x, y, 38, {
        schatten: false, laufen: v > 60, blick: p.bx,
        emo: p.hit > 0 ? 'schock' : randNah ? 'schock' : 'normal',
        kipp: clamp(p.vx / 1400, -.25, .25) + (randNah ? Math.sin(t * 18) * .08 : 0), huepf: p.sp > 0 ? .5 : 0,
      });
    }
    // Ende: Text über der Scholle
    if (S.ende > 0) {
      const drin = S.sp.map((p, k) => k).filter(k => !S.sp[k].aus);
      if (drin.length === 1) A.text(A.name(drin[0]) + ' bleibt trocken!', CX, 130, 46, '#ffd23a');
    }

    for (const e of A.neu(S)) {
      if (e.typ === 'platsch') {
        Ton.spiel('platsch');
        A.funken(e.x, e.y - 10, '#ffffff', 22, 360, 8); A.funken(e.x, e.y - 10, '#7fd0ff', 14, 300, 7);
        A.text3('Platsch!', e.x, e.y - 110, '#bfeaff');
      } else if (e.typ === 'stoss') {
        Ton.spiel('treffer'); A.funken(e.x, e.y, '#ffd23a', 14, 300, 7); A.text3('Bumm!', e.x, e.y - 50, '#ffd23a');
      } else if (e.typ === 'bump') {
        Ton.spiel('pop'); A.funken(e.x, e.y, '#ffffff', 6, 180, 5);
      } else if (e.typ === 'sprint') Ton.spiel('weg');
    }
  },
  // Figur im Wasser: halb eingetaucht, mit Schwimmring
  zeichneSchwimmer(g, p, k, A) {
    const x = this.CX + p.x, wy = this.CY + p.y * this.K + this.DICKE;
    const z = clamp(p.z, 0, 1);
    const fussY = wy - this.DICKE * (1 - z) + 10 * z + Math.sin(A.t * 3 + k) * 3 * z;
    g.save();
    g.beginPath(); g.rect(x - 90, 0, 180, wy); g.clip();
    A.figur(k, x, fussY, 34, { schatten: false, emo: 'traurig', kipp: Math.sin(A.t * 2 + k) * .12 });
    g.restore();
    // Wellenring und Schwimmring
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    const wr = 46 + Math.sin(A.t * 3 + k) * 4;
    ellipse(g, x, wy, wr + 10, (wr + 10) * .32); g.stroke();
    if (z > .6) {
      g.globalAlpha = (z - .6) / .4;
      g.lineWidth = 11; g.strokeStyle = '#ffffff'; ellipse(g, x, wy - 4, 40, 13); g.stroke();
      g.strokeStyle = '#ef4646'; g.setLineDash([16, 16]); ellipse(g, x, wy - 4, 40, 13); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1;
    }
    g.lineWidth = 3; g.strokeStyle = A.teamFarbe(k); ellipse(g, x, wy + 6, 54, 17); g.stroke();
  },
});
