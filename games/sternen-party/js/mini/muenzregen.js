// Minispiel „Münzregen“: Münzen fangen, Bomben ausweichen (Seitenansicht, Tasten)
'use strict';
Minis.reg({
  id: 'muenzregen', name: 'Münzregen',
  text: 'Vom Himmel regnet es Münzen! Fang so viele wie möglich. Bomben betäuben dich und kosten 3 Münzen.',
  steuerung: { tasten: 'Links/Rechts laufen, Aktion springen' },
  formate: ['ffa', '2v2', 'duell'],
  dauer: 30,
  BODEN: 790,
  start(S, info) {
    const n = info.teilnehmer.length;
    S.sp = info.teilnehmer.map((p, k) => ({ x: 300 + k * (1000 / Math.max(1, n - 1)), y: this.BODEN, vy: 0, m: 0, betaeubt: 0, blick: 1 }));
    if (n === 1) S.sp[0].x = 800;
    S.dinge = []; S.id = 0; S.spawn = 0;
  },
  schritt(S, ein, dt) {
    // Neue Münzen und Bomben, gegen Ende immer mehr
    S.spawn -= dt;
    if (S.spawn <= 0) {
      S.spawn = Math.max(.12, .38 - S.t * .007);
      const bombe = Math.random() < .16 + S.t * .004;
      const gold = !bombe && Math.random() < .08;
      S.dinge.push({ id: ++S.id, x: rnd(80, WELT_B - 80), y: -30, vy: rnd(220, 340) + S.t * 6, art: bombe ? 'b' : gold ? 'g' : 'm' });
    }
    for (const d of S.dinge) { d.y += d.vy * dt; d.w = (d.w || 0) + dt * 4; }
    S.sp.forEach((p, k) => {
      const e = ein[k];
      if (p.betaeubt > 0) p.betaeubt -= dt;
      else {
        p.x = clamp(p.x + e.x * 520 * dt, 40, WELT_B - 40);
        if (e.x) p.blick = e.x;
        if (e.ap && p.y >= this.BODEN) { p.vy = -760; Minis.ereignis(S, { typ: 'sprung' }); }
      }
      p.vy += 2100 * dt; p.y = Math.min(this.BODEN, p.y + p.vy * dt);
      if (p.y >= this.BODEN) p.vy = 0;
      for (const d of S.dinge) {
        if (d.weg || Math.abs(d.x - p.x) > 52 || d.y < p.y - 120 || d.y > p.y + 10) continue;
        d.weg = true;
        if (d.art === 'b') {
          p.betaeubt = 1.4; p.m = Math.max(0, p.m - 3);
          Minis.ereignis(S, { typ: 'boom', x: d.x, y: d.y });
        } else {
          const w = d.art === 'g' ? 5 : 1; p.m += w;
          Minis.ereignis(S, { typ: 'muenze', x: d.x, y: d.y, w });
        }
      }
    });
    S.dinge = S.dinge.filter(d => !d.weg && d.y < WELT_H + 40);
  },
  ki(S, k, stufe) {
    const p = S.sp[k];
    const reakt = [180, 90, 30][stufe];
    // Ziel: nächste erreichbare Münze, Bomben in der Nähe meiden
    let ziel = null, best = 1e9;
    for (const d of S.dinge) {
      if (d.art === 'b') continue;
      const zeitBis = (p.y - 60 - d.y) / d.vy;
      if (zeitBis < 0) continue;
      const kosten = Math.abs(d.x - p.x) / 520 - zeitBis + (d.art === 'g' ? -.5 : 0);
      if (kosten < best && Math.abs(d.x - p.x) < 520 * zeitBis + reakt) { best = kosten; ziel = d; }
    }
    let x = ziel ? Math.sign(ziel.x - p.x) * (Math.abs(ziel.x - p.x) > 12 ? 1 : 0) : 0;
    if (stufe > 0) for (const d of S.dinge) {
      if (d.art === 'b' && Math.abs(d.x - p.x) < 80 && d.y > p.y - 360 && d.y < p.y - 40) x = d.x > p.x ? -1 : 1;
    }
    if (stufe === 0 && Math.random() < .3) x = 0;
    const springen = ziel && Math.abs(ziel.x - p.x) < 40 && ziel.y > p.y - 260 && ziel.y < p.y - 140 && Math.random() < [.05, .3, .8][stufe];
    return { x, ap: springen };
  },
  punkte(S) { return S.sp.map(p => p.m); },
  wert(S, k) { return S.sp[k].m; },
  zeichne(g, S, A) {
    // Himmel und Wiese
    const h = g.createLinearGradient(0, 0, 0, WELT_H);
    h.addColorStop(0, '#5ec3ff'); h.addColorStop(.7, '#bfe9ff'); h.addColorStop(1, '#e8f8ff');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, WELT_H);
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 330 + A.t * 18) % (WELT_B + 300)) - 150, y = 150 + (i % 3) * 70;
      for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 50], [86, 0, 38]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#7fcf5a'; g.fillRect(0, this.BODEN, WELT_B, WELT_H - this.BODEN);
    g.fillStyle = '#5fb042'; g.fillRect(0, this.BODEN, WELT_B, 14);
    for (const d of S.dinge) {
      if (d.art === 'b') {
        g.fillStyle = '#25232f'; g.beginPath(); g.arc(d.x, d.y, 26, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(d.x - 8, d.y - 9, 7, 0, TAU); g.fill();
        g.strokeStyle = '#7a5a3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(d.x + 12, d.y - 20); g.quadraticCurveTo(d.x + 22, d.y - 34, d.x + 30, d.y - 30); g.stroke();
        g.fillStyle = (A.t * 10 | 0) % 2 ? '#ffde3a' : '#ff6a2a'; g.beginPath(); g.arc(d.x + 31, d.y - 31, 6, 0, TAU); g.fill();
      } else if (d.art === 'g') {
        zeichneStern(g, d.x, d.y, 30, d.w * .5);
      } else zeichneMuenze(g, d.x, d.y, 22, d.w || 0);
    }
    S.sp.forEach((p, k) => {
      const luft = this.BODEN - p.y;
      bodenSchatten(g, p.x, this.BODEN, 40 * clamp(1 - luft / 500, .4, 1));
      A.figur(k, p.x, p.y, 40, { schatten: false, laufen: true, blick: p.blick, emo: p.betaeubt > 0 ? 'schock' : 'normal', huepf: p.vy < 0 ? -.4 : 0, kipp: p.betaeubt > 0 ? Math.sin(A.t * 20) * .2 : 0 });
      g.fillStyle = A.teamFarbe(k); g.beginPath(); g.moveTo(p.x - 12, p.y - 112); g.lineTo(p.x + 12, p.y - 112); g.lineTo(p.x, p.y - 98); g.closePath(); g.fill();
    });
    for (const e of A.neu(S)) {
      if (e.typ === 'muenze') { Ton.spiel('muenze'); A.funken(e.x, e.y, '#ffd23a', 8, 200, 6); A.text3('+' + e.w, e.x, e.y - 30); }
      else if (e.typ === 'boom') { Ton.spiel('boom'); A.funken(e.x, e.y, '#ff7a2a', 24, 380, 9); A.text3('-3', e.x, e.y - 40, '#ff6b6b'); }
      else if (e.typ === 'sprung') Ton.spiel('sprung');
    }
  },
});
