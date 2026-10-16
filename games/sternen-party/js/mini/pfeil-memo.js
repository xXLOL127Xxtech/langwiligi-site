// Minispiel „Pfeil-Gedächtnis“: Stella zeigt Pfeile, alle tippen die Folge gleichzeitig nach (Tasten)
// Wie beim Spiel „Simon“: Die Folge bleibt gleich und wird jede Runde um einen Pfeil länger.
// Jeder sieht von den anderen nur den Fortschritt (Häkchen), nie die gedrückten Richtungen.
'use strict';
(() => {
  const START_L = 3, MAX_L = 12;
  const RICHTUNG = ['hoch', 'rechts', 'runter', 'links'];        // 0..3, Winkel = i · 90° – 90°
  const TOENE = [523, 659, 392, 330];                              // jede Richtung hat ihren Ton
  const FARBEN = [['#7ee0ff', '#1f8ee0'], ['#ffe36b', '#e8a300'], ['#8af59a', '#23a845'], ['#ff9ac4', '#e0457f']];
  const zeigTakt = L => Math.max(.27, .46 - L * .02);              // Sekunden pro Pfeil beim Zeigen
  const zeigDauer = L => .45 + L * zeigTakt(L) + .2;
  const eingabeZeit = L => 1.6 + L * .45;
  const PAUSE = .75;

  // Lage der Spieler-Tafeln unten
  function tafeln(n) {
    const abst = 24, w = Math.min(340, (1420 - (n - 1) * abst) / n), total = n * w + (n - 1) * abst;
    const x0 = WELT_B / 2 - total / 2;
    return [...Array(n)].map((_, k) => ({ x: x0 + k * (w + abst), y: 560, w, h: 316 }));
  }

  // Ein dicker Pfeil mit Verlauf, Richtung d (0 hoch, 1 rechts, 2 runter, 3 links)
  function pfeil(g, x, y, gr, d, farben, alpha = 1) {
    g.save(); g.translate(x, y); g.rotate(d * Math.PI / 2); g.globalAlpha *= alpha;
    g.beginPath();
    g.moveTo(0, -gr); g.lineTo(gr * .78, -gr * .05); g.lineTo(gr * .3, -gr * .05); g.lineTo(gr * .3, gr * .85);
    g.lineTo(-gr * .3, gr * .85); g.lineTo(-gr * .3, -gr * .05); g.lineTo(-gr * .78, -gr * .05); g.closePath();
    const v = g.createLinearGradient(0, -gr, 0, gr);
    v.addColorStop(0, '#ffffff'); v.addColorStop(.25, farben[0]); v.addColorStop(1, farben[1]);
    g.fillStyle = v; g.lineJoin = 'round'; g.strokeStyle = 'rgba(20,10,50,.85)'; g.lineWidth = gr * .1;
    g.stroke(); g.fill();
    g.restore();
  }

  let letzteAnzeige = -1;          // welcher Pfeil zuletzt gezeigt wurde (für den Ton)

  Minis.reg({
    id: 'pfeil-memo', name: 'Pfeil-Gedächtnis',
    text: 'Stella zeigt eine Folge von Pfeilen. Merk sie dir und tipp sie danach mit deinen Richtungstasten nach! Jede Runde kommt ein Pfeil dazu. Ein Fehler und du bist raus.',
    steuerung: { tasten: 'Richtungstasten: Folge nachtippen' },
    formate: ['ffa', '2v2', 'duell'],
    start(S, info) {
      S.ph = 'start'; S.pt = 0; S.L = START_L;
      S.folge = [...Array(MAX_L)].map(() => rndi(0, 3));
      // keine drei gleichen Pfeile hintereinander, das wäre langweilig
      for (let i = 2; i < MAX_L; i++) if (S.folge[i] === S.folge[i - 1] && S.folge[i] === S.folge[i - 2]) S.folge[i] = (S.folge[i] + rndi(1, 3)) % 4;
      S.sp = info.teilnehmer.map(() => ({ pos: 0, raus: false, len: 0, zeit: 0, fertig: false, wie: '', bk: -1, bt: 0 }));
    },
    schritt(S, ein, dt) {
      S.pt += dt;
      if (S.ph === 'start') {
        if (S.pt > 1.1) { S.ph = 'zeigen'; S.pt = 0; }
        return;
      }
      if (S.ph === 'zeigen') {
        if (S.pt > zeigDauer(S.L)) { S.ph = 'eingabe'; S.pt = 0; }
        return;
      }
      if (S.ph === 'eingabe') {
        S.sp.forEach((p, k) => {
          if (p.raus || p.fertig) return;
          const e = ein[k];
          const d = e.hp ? 0 : e.rep ? 1 : e.rp ? 2 : e.lp ? 3 : -1;
          if (d < 0) return;
          if (d === S.folge[p.pos]) {
            p.pos++;
            if (p.pos >= S.L) {
              p.fertig = true; p.len = S.L; p.zeit += S.pt;
              Minis.ereignis(S, { typ: 'fertig', k });
            } else Minis.ereignis(S, { typ: 'ok', k, d });
          } else {
            p.raus = true; p.wie = 'Falsch!';
            Minis.ereignis(S, { typ: 'falsch', k });
          }
        });
        const offen = S.sp.filter(p => !p.raus && !p.fertig);
        if (S.pt > eingabeZeit(S.L) || !offen.length) {
          for (const p of offen) { p.raus = true; p.wie = 'Zu langsam'; Minis.ereignis(S, { typ: 'falsch', k: S.sp.indexOf(p) }); }
          S.ph = 'pause'; S.pt = 0;
        }
        return;
      }
      if (S.ph === 'pause' && S.pt > PAUSE) {
        if (S.sp.every(p => p.raus) || S.L >= MAX_L) { S.fertig = true; return; }
        S.L++; S.ph = 'zeigen'; S.pt = 0;
        for (const p of S.sp) { p.pos = 0; p.fertig = false; }
        Minis.ereignis(S, { typ: 'runde' });
      }
    },
    ki(S, k, stufe) {
      const p = S.sp[k];
      if (S.ph !== 'eingabe' || p.raus || p.fertig) return {};
      // Pro Pfeil eine Bedenkzeit, danach drücken – manchmal falsch
      const key = S.L * 100 + p.pos;
      if (p.bk !== key) {
        p.bk = key;
        const basis = [[.38, .6], [.26, .4], [.16, .26]][stufe];
        p.bt = S.pt + rnd(basis[0], basis[1]) + (p.pos === 0 ? [.45, .3, .2][stufe] : 0);
      }
      if (S.pt < p.bt) return {};
      const fehler = [.035 + S.L * .007, .015 + S.L * .004, .004 + S.L * .002][stufe];
      let d = S.folge[p.pos];
      if (Math.random() < fehler) d = (d + rndi(1, 3)) % 4;
      return { hp: d === 0, rep: d === 1, rp: d === 2, lp: d === 3 };
    },
    // Erreichte Länge zählt; bei Gleichstand gewinnt, wer insgesamt schneller getippt hat
    punkte(S) { return S.sp.map(p => p.len * 1000 + (p.len ? Math.max(0, 999 - Math.round(p.zeit * 10)) : 0)); },
    wert(S, k) { return S.sp[k].len; },
    zeichne(g, S, A) {
      const n = S.sp.length, t = A.t;
      // Abendhimmel mit Sternen
      const h = g.createLinearGradient(0, 0, 0, 560);
      h.addColorStop(0, '#1d1450'); h.addColorStop(.55, '#5b3aa8'); h.addColorStop(1, '#f08bb8');
      g.fillStyle = h; g.fillRect(0, 0, WELT_B, 560);
      for (let i = 0; i < 48; i++) {
        const x = (i * 337 + 50) % WELT_B, y = 80 + (i * 211) % 380;
        const a = .35 + .65 * Math.abs(Math.sin(t * 1.3 + i * 1.7));
        g.globalAlpha = a; g.fillStyle = '#fff6d0';
        g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      // Hügel am Horizont
      g.fillStyle = '#3d2672';
      g.beginPath(); g.moveTo(0, 560);
      for (let x = 0; x <= WELT_B; x += 80) g.lineTo(x, 500 - Math.sin(x * .004) * 40 - Math.sin(x * .011 + 1) * 18);
      g.lineTo(WELT_B, 560); g.closePath(); g.fill();
      // Bühnenboden
      const b = g.createLinearGradient(0, 520, 0, WELT_H);
      b.addColorStop(0, '#8a4fc0'); b.addColorStop(1, '#3b1d6e');
      g.fillStyle = b; g.fillRect(0, 530, WELT_B, WELT_H - 530);
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
      for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(800 + i * 60, 530); g.lineTo(800 + i * 210, WELT_H); g.stroke(); }
      // Scheinwerfer-Kegel auf die Tafel
      const kegel = g.createRadialGradient(800, 270, 40, 800, 270, 420);
      kegel.addColorStop(0, 'rgba(255,240,180,.28)'); kegel.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = kegel; g.fillRect(380, 0, 840, 560);

      // Anzeigetafel in der Mitte
      const tx = 560, ty = 105, tw = 480, th = 330;
      g.fillStyle = 'rgba(0,0,0,.3)'; rundRechteck(g, tx + 6, ty + 10, tw, th, 36); g.fill();
      const tg = g.createLinearGradient(0, ty, 0, ty + th);
      tg.addColorStop(0, '#2c2470'); tg.addColorStop(1, '#14103a');
      g.fillStyle = tg; rundRechteck(g, tx, ty, tw, th, 36); g.fill();
      g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2; rundRechteck(g, tx + 12, ty + 12, tw - 24, th - 24, 26); g.stroke();
      const cx = tx + tw / 2;
      if (S.ph === 'start') {
        A.text('Merk dir die Pfeile!', cx, ty + 150, 40, '#fff');
        A.text('Länge ' + S.L, cx, ty + 210, 30, '#ffd23a');
      } else if (S.ph === 'zeigen') {
        const takt = zeigTakt(S.L), z = S.pt - .45, i = Math.floor(z / takt), anteil = z / takt - i;
        const sichtbar = z >= 0 && i < S.L && anteil < .78;
        if (sichtbar) {
          const d = S.folge[i], key = S.L * 100 + i;
          if (key !== letzteAnzeige) { letzteAnzeige = key; Ton.note(TOENE[d], .22, 'triangle', .22); }
          const s = Ease.outBack(clamp(anteil / .25, 0, 1));
          const glanz = g.createRadialGradient(cx, ty + 140, 10, cx, ty + 140, 130);
          glanz.addColorStop(0, FARBEN[d][0] + '88'); glanz.addColorStop(1, FARBEN[d][0] + '00');
          g.fillStyle = glanz; g.beginPath(); g.arc(cx, ty + 140, 130, 0, TAU); g.fill();
          pfeil(g, cx, ty + 140, 95 * s, d, FARBEN[d]);
        } else A.text('…', cx, ty + 140, 60, 'rgba(255,255,255,.4)');
        // Punkte: der wievielte Pfeil gerade kommt
        const pa = Math.min(34, 400 / S.L);
        for (let j = 0; j < S.L; j++) {
          const px = cx + (j - (S.L - 1) / 2) * pa;
          g.fillStyle = j < i || (j === i && sichtbar) ? '#ffd23a' : 'rgba(255,255,255,.22)';
          g.beginPath(); g.arc(px, ty + 280, j === i && sichtbar ? 10 : 7, 0, TAU); g.fill();
        }
      } else if (S.ph === 'eingabe') {
        A.text('Jetzt ihr!', cx, ty + 105, 58, '#fff');
        A.text(S.L + ' Pfeile nachtippen', cx, ty + 175, 30, '#ffd23a');
        const rest = clamp(1 - S.pt / eingabeZeit(S.L), 0, 1);
        g.fillStyle = 'rgba(255,255,255,.15)'; rundRechteck(g, tx + 50, ty + 245, tw - 100, 26, 13); g.fill();
        g.fillStyle = rest < .3 ? '#ff6b6b' : '#7ee08a'; rundRechteck(g, tx + 50, ty + 245, Math.max(26, (tw - 100) * rest), 26, 13); g.fill();
      } else {
        const weiter = S.sp.filter(p => !p.raus).length;
        if (S.L >= MAX_L && weiter) A.text('Alles geschafft!', cx, ty + 150, 44, '#ffd23a');
        else if (!weiter) A.text('Alle sind raus!', cx, ty + 150, 44, '#ff8a8a');
        else { A.text('Richtig!', cx, ty + 130, 52, '#7ee08a'); A.text('Nächste Runde: ' + (S.L + 1) + ' Pfeile', cx, ty + 200, 30, '#fff'); }
      }
      // Stella schwebt neben der Tafel
      zeichneStella(g, 1190, 250, 70, t);
      zeichneStella(g, 410, 300, 34, t + 1.3);

      // Spieler-Tafeln
      const tf = tafeln(n);
      S.sp.forEach((p, k) => {
        const r = tf[k], mx = r.x + r.w / 2;
        g.fillStyle = 'rgba(0,0,0,.25)'; rundRechteck(g, r.x + 4, r.y + 8, r.w, r.h, 28); g.fill();
        g.fillStyle = p.raus ? 'rgba(40,24,70,.85)' : 'rgba(255,255,255,.14)'; rundRechteck(g, r.x, r.y, r.w, r.h, 28); g.fill();
        g.strokeStyle = A.teamFarbe(k); g.lineWidth = 5; g.stroke();
        // Podest und Figur
        const pod = g.createLinearGradient(0, r.y + 170, 0, r.y + 200);
        pod.addColorStop(0, '#ffe58a'); pod.addColorStop(1, '#d99a1a');
        g.fillStyle = pod; ellipse(g, mx, r.y + 182, 70, 18); g.fill();
        const froh = p.fertig && S.ph !== 'zeigen';
        A.figur(k, mx, r.y + 180, 50, {
          schatten: false, emo: p.raus ? 'traurig' : froh ? 'froh' : S.ph === 'zeigen' ? 'normal' : 'schock',
          jubeln: froh, kipp: p.raus ? -.12 : 0, huepf: froh ? Math.max(0, Math.sin(t * 10)) * .5 : 0,
          alpha: p.raus ? .55 : 1,
        });
        A.text(A.name(k), mx, r.y + 30, 24, '#fff');
        // Fortschritt: Häkchen für jeden richtigen Pfeil
        const slots = S.L, sg = Math.min(24, (r.w - 40) / slots - 4), sa = sg + 4;
        const sy = r.y + 240;
        for (let j = 0; j < slots; j++) {
          const sx = mx + (j - (slots - 1) / 2) * sa;
          const ok = j < p.pos || (p.fertig);
          g.fillStyle = ok ? '#43c463' : 'rgba(255,255,255,.2)';
          g.beginPath(); g.arc(sx, sy, sg / 2, 0, TAU); g.fill();
          if (ok) {
            g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, sg * .14); g.lineCap = 'round';
            g.beginPath(); g.moveTo(sx - sg * .22, sy); g.lineTo(sx - sg * .05, sy + sg * .18); g.lineTo(sx + sg * .24, sy - sg * .18); g.stroke();
          }
        }
        let info = '', farbe = '#fff';
        if (p.raus) { info = p.wie + ' – Länge ' + p.len; farbe = '#ff8a8a'; }
        else if (p.fertig && S.ph !== 'zeigen') { info = 'Geschafft!'; farbe = '#7ee08a'; }
        else if (S.ph === 'eingabe') info = p.pos + ' / ' + S.L;
        else info = 'Bestleistung: ' + p.len;
        A.text(info, mx, r.y + 285, 24, farbe);
      });

      for (const e of A.neu(S)) {
        const r = tf[e.k];
        if (e.typ === 'ok') Ton.note(TOENE[e.d], .12, 'triangle', .12);
        else if (e.typ === 'fertig') { Ton.spiel('glueck'); A.funken(r.x + r.w / 2, r.y + 120, '#ffd23a', 18, 300, 7); }
        else if (e.typ === 'falsch') { Ton.spiel('fehler'); A.funken(r.x + r.w / 2, r.y + 120, '#ff5a6a', 14, 260, 7); A.text3('Raus!', r.x + r.w / 2, r.y + 70, '#ff8a8a'); }
        else if (e.typ === 'runde') Ton.spiel('item');
      }
    },
  });
})();
