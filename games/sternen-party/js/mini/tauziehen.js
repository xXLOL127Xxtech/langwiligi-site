// Minispiel „Tauziehen am Vulkan“: im Takt am Seil ziehen, die Verlierer plumpsen in den Lavagraben (Seitenansicht, nur Aktion)
'use strict';
Minis.reg({
  id: 'tauziehen', name: 'Tauziehen am Vulkan',
  text: 'Zieht im Takt! Drück die Aktion, wenn der Zeiger im grünen Feld ist: das gibt einen starken Zug. Wer daneben drückt, stolpert. Die Verlierer plumpsen in den Lavagraben.',
  steuerung: { tasten: 'Aktion im Takt drücken (einmal pro Takt)' },
  formate: ['2v2', '1v3', 'duell'],
  ZEIT: 30,                      // danach entscheidet die Seilposition
  BODEN: 700,                    // Höhe der Felsplatten
  GRABEN: [680, 920],            // Lavagraben in der Mitte
  ZIEL: 140,                     // so weit muss die Seilmitte gezogen werden
  ZONE: .7,                      // Mitte des grünen Felds im Taktbalken
  IMPULS: 80,                    // Seiltempo pro perfektem Zug (pro volle Kraft einer Seite)
  // Seite eines Teilnehmers: 0 links, 1 rechts
  seite(k, info) { return info.format === 'duell' ? k % 2 : ((info.teams && info.teams[k]) || 0) % 2; },
  start(S, info) {
    const seiten = info.teilnehmer.map((_, k) => this.seite(k, info));
    const anzahl = [0, 1].map(s => seiten.filter(v => v === s).length);
    const index = [0, 0];
    S.sp = info.teilnehmer.map((_, k) => {
      const s = seiten[k], i = index[s]++;
      // Volle Kraft wird auf die Seite verteilt: der Einzelspieler bei 1 gegen 3 zieht 3× so stark wie jeder der drei
      return { s, i, kraft: 1 / Math.max(1, anzahl[s]), gedr: -1, art: '', stol: 0, zugY: 0, top: 0, x: 0, y: this.BODEN, z: 0, fall: 0 };
    });
    S.seilX = 0; S.v = 0;          // Verschiebung der Seilmitte (+ = nach rechts) und ihr Tempo
    S.ph = 0; S.zyk = 0;           // Takt: Phase 0..1 und Nummer des Takts
    S.sieg = -1; S.endT = 0;       // Sieger-Seite (-2 = unentschieden) und Zeit seit der Entscheidung
    S.kp = info.teilnehmer.map(() => this.ZONE); S.kz = info.teilnehmer.map(() => -1);
    this.positionen(S);
  },
  // Grundposition der Figuren (folgt dem Seil)
  grundX(p, S) { return (p.s === 0 ? 560 - p.i * 120 : 1040 + p.i * 120) + S.seilX; },
  positionen(S) { for (const p of S.sp) if (!p.fall) p.x = this.grundX(p, S); },
  schritt(S, ein, dt) {
    if (S.sieg === -1) {
      // Takt läuft, wird mit der Zeit schneller
      const periode = lerp(1.0, .68, clamp(S.t / this.ZEIT, 0, 1));
      const alt = S.ph;
      S.ph += dt / periode;
      if (alt < this.ZONE && S.ph >= this.ZONE) Minis.ereignis(S, { typ: 'takt' });
      if (S.ph >= 1) { S.ph -= 1; S.zyk++; }
      S.sp.forEach((p, k) => {
        p.stol = Math.max(0, p.stol - dt); p.zugY = Math.max(0, p.zugY - dt * 3);
        if (!ein[k].ap) return;
        if (p.stol > 0) return;
        let q, art;
        if (p.gedr === S.zyk) { q = 0; art = 'zuviel'; }      // zweimal im selben Takt = stolpern
        else {
          const d = Math.abs(S.ph - this.ZONE);
          if (d < .055) { q = 1; art = 'super'; p.top++; }
          else if (d < .12) { q = .6; art = 'gut'; }
          else if (d < .2) { q = .25; art = 'ok'; }
          else { q = 0; art = 'daneben'; }
        }
        p.gedr = S.zyk; p.art = art;
        if (q === 0) p.stol = .45;
        S.v += (p.s === 0 ? -1 : 1) * q * this.IMPULS * p.kraft;
        p.zugY = q;
        Minis.ereignis(S, { typ: 'zug', k, art, x: p.x, y: this.BODEN - 150 });
      });
      S.v *= Math.exp(-3 * dt);
      S.seilX = clamp(S.seilX + S.v * dt, -this.ZIEL - 10, this.ZIEL + 10);
      this.positionen(S);
      // Entschieden? Seil weit genug gezogen oder Zeit um
      if (Math.abs(S.seilX) >= this.ZIEL || S.t >= this.ZEIT) {
        S.sieg = S.seilX > 0 ? 1 : S.seilX < 0 ? 0 : -2;
        Minis.ereignis(S, { typ: 'sieg', s: S.sieg });
      }
      return;
    }
    // Nach der Entscheidung: Verlierer rutschen in den Lavagraben, Sieger jubeln
    S.endT += dt;
    S.sp.forEach(p => {
      if (S.sieg < 0 || p.s === S.sieg) return;
      const verz = p.i * .18;
      if (S.endT < verz) return;
      const zielX = p.s === 0 ? this.GRABEN[0] + 50 + p.i * 55 : this.GRABEN[1] - 50 - p.i * 55;
      // auch im Fallen weiter zur eigenen Stelle im Graben, damit sie nicht aufeinander landen
      p.x += Math.sign(zielX - p.x) * Math.min(Math.abs(zielX - p.x), 520 * dt);
      if (!p.fall) {
        if (p.x > this.GRABEN[0] + 10 && p.x < this.GRABEN[1] - 10) { p.fall = 1; p.z = 0; }
      } else {
        // Fallen bis in die Lava, dann hüpfen sie heiss-heiss herum
        p.z += 900 * dt * p.fall; p.fall = Math.min(3, p.fall + dt * 4);
        if (p.z >= 95 && !p.platsch) { p.z = 95; p.platsch = 1; Minis.ereignis(S, { typ: 'platsch', x: p.x, y: this.BODEN + 95 }); }
        if (p.platsch) p.z = 95 - Math.abs(Math.sin((S.endT - verz) * 9 + p.i)) * 40;
      }
    });
    if (S.endT > 2.2) S.fertig = true;
  },
  ki(S, k, stufe) {
    const p = S.sp[k];
    if (!p || S.sieg !== -1 || p.stol > 0 || p.gedr === S.zyk) return {};
    // Pro Takt einen Zeitpunkt planen: gute Bots treffen das grüne Feld genauer
    if (S.kz[k] !== S.zyk) {
      S.kz[k] = S.zyk;
      const sigma = [.11, .06, .028][stufe];
      S.kp[k] = Math.random() < [.15, .05, 0][stufe] ? 2 : clamp(this.ZONE + (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sigma, .02, .98);
    }
    return S.ph >= S.kp[k] ? { ap: true } : {};
  },
  punkte(S) { return S.sp.map(p => S.sieg === -2 ? 5 : p.s === S.sieg ? 10 + p.top * .01 : p.top * .01); },
  wert(S, k) { return S.sp[k].top + '★'; },
  zeichne(g, S, A) {
    const t = A.t, B = this.BODEN, [G0, G1] = this.GRABEN;
    // Glühender Himmel und Vulkan im Hintergrund
    const h = g.createLinearGradient(0, 0, 0, B);
    h.addColorStop(0, '#3a1640'); h.addColorStop(.6, '#a03a3a'); h.addColorStop(1, '#ff9a4a');
    g.fillStyle = h; g.fillRect(0, 0, WELT_B, B);
    g.fillStyle = '#4a1e2c';
    g.beginPath(); g.moveTo(420, B); g.lineTo(700, 250); g.lineTo(900, 250); g.lineTo(1180, B); g.closePath(); g.fill();
    g.fillStyle = '#ff7a2a'; ellipse(g, 800, 252, 100, 14); g.fill();
    g.strokeStyle = '#ff8a3a'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(760, 258); g.quadraticCurveTo(740, 330, 700, 380); g.stroke();
    g.beginPath(); g.moveTo(850, 258); g.quadraticCurveTo(870, 340, 905, 400); g.stroke();
    for (let i = 0; i < 6; i++) {
      const ph = (t * .22 + i / 6) % 1;
      g.fillStyle = `rgba(70,50,70,${.5 * (1 - ph)})`;
      g.beginPath(); g.arc(800 + Math.sin(i * 2.3 + t * .7) * 30 - ph * 80, 230 - ph * 150, 26 + ph * 50, 0, TAU); g.fill();
    }
    g.fillStyle = '#3a1826';
    g.beginPath(); g.moveTo(0, B); g.lineTo(0, 470); g.lineTo(160, 420); g.lineTo(330, 500); g.lineTo(470, B); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(1150, B); g.lineTo(1320, 450); g.lineTo(1470, 410); g.lineTo(1600, 470); g.lineTo(1600, B); g.closePath(); g.fill();

    // Lavagraben mit Blasen
    const lv = g.createLinearGradient(0, B + 60, 0, WELT_H);
    lv.addColorStop(0, '#ffd23a'); lv.addColorStop(.25, '#ff7a1a'); lv.addColorStop(1, '#c42a10');
    g.fillStyle = '#5a1a14'; g.fillRect(G0, B, G1 - G0, WELT_H - B);
    g.fillStyle = lv; g.fillRect(G0, B + 85, G1 - G0, WELT_H - B - 85);
    for (let i = 0; i < 6; i++) {
      const ph = (t * .8 + i * .37) % 1, bx = G0 + 30 + (i * 47) % (G1 - G0 - 60);
      g.fillStyle = `rgba(255,230,120,${1 - ph})`; g.beginPath(); g.arc(bx, B + 92 - ph * 6, 4 + ph * 10, Math.PI, 0); g.fill();
    }
    // Glühen am Grabenrand
    g.fillStyle = 'rgba(255,140,40,.25)'; g.fillRect(G0, B, G1 - G0, 85);
    // Felsplatten links und rechts
    const fels = g.createLinearGradient(0, B, 0, WELT_H);
    fels.addColorStop(0, '#6a4a4a'); fels.addColorStop(1, '#2e1c22');
    g.fillStyle = fels;
    g.beginPath(); g.moveTo(0, B); g.lineTo(G0, B); g.lineTo(G0 - 14, WELT_H); g.lineTo(0, WELT_H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(G1, B); g.lineTo(WELT_B, B); g.lineTo(WELT_B, WELT_H); g.lineTo(G1 + 14, WELT_H); g.closePath(); g.fill();
    g.fillStyle = '#8a6460'; g.fillRect(0, B, G0, 10); g.fillRect(G1, B, WELT_B - G1, 10);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[120, 760, 220, 800], [400, 820, 520, 780], [1100, 790, 1210, 840], [1400, 760, 1500, 810]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // Zielpfosten: wenn die Seilmitte einen Pfosten erreicht, gewinnt dessen Seite
    for (const s of [0, 1]) {
      const px = 800 + (s ? this.ZIEL : -this.ZIEL);
      const k = S.sp.findIndex(p => p.s === s);
      const farbe = k >= 0 ? A.teamFarbe(k) : '#fff';
      g.fillStyle = '#4a3030'; g.fillRect(px - 4, B - 120, 8, 120);
      g.fillStyle = farbe; g.beginPath(); g.moveTo(px + (s ? 4 : -4), B - 120); g.lineTo(px + (s ? 46 : -46), B - 106 + Math.sin(t * 5 + s) * 3); g.lineTo(px + (s ? 4 : -4), B - 92); g.closePath(); g.fill();
    }

    // Seil zwischen den hintersten Figuren
    const seilY = B - 44;
    const links = S.sp.filter(p => p.s === 0 && !p.fall), rechts = S.sp.filter(p => p.s === 1 && !p.fall);
    const xl = links.length ? Math.min(...links.map(p => p.x)) - 40 : G0, xr = rechts.length ? Math.max(...rechts.map(p => p.x)) + 40 : G1;
    const mitte = 800 + S.seilX;
    g.strokeStyle = '#7a5428'; g.lineWidth = 11; g.lineCap = 'round';
    g.beginPath(); g.moveTo(xl, seilY); g.quadraticCurveTo(mitte, seilY + (S.sieg === -1 ? 14 : 40), xr, seilY); g.stroke();
    g.strokeStyle = '#c9934a'; g.lineWidth = 5; g.setLineDash([10, 9]); g.stroke(); g.setLineDash([]);
    // Fahne an der Seilmitte
    const fy = seilY + (S.sieg === -1 ? 7 : 20);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(mitte - 16, fy); g.lineTo(mitte + 16, fy); g.lineTo(mitte + Math.sin(t * 6) * 4, fy + 50); g.closePath(); g.fill();
    g.strokeStyle = '#a36b00'; g.lineWidth = 2.5; g.stroke();

    // Figuren
    S.sp.forEach((p, k) => {
      const groesse = p.kraft > .99 && S.sp.length > 2 ? 46 : 38;
      const zurueck = p.s === 0 ? -1 : 1;
      if (p.fall) {
        // In der Lava: nur oberhalb der Oberfläche sichtbar
        g.save(); g.beginPath(); g.rect(p.x - 80, 0, 160, B + 88); g.clip();
        A.figur(k, p.x, B + p.z, groesse, { schatten: false, emo: 'schock', kipp: Math.sin(t * 14 + k) * .15 });
        g.restore();
        if (p.platsch) {
          g.fillStyle = 'rgba(120,110,120,.5)';
          for (let i = 0; i < 2; i++) { const ph = (t * 1.2 + i * .5 + k * .3) % 1; g.beginPath(); g.arc(p.x + (i ? 14 : -14), B - 10 - ph * 80 + (p.z - 95), 8 + ph * 14, 0, TAU); g.fill(); }
        }
        return;
      }
      const jubel = S.sieg >= 0 && p.s === S.sieg;
      const kipp = jubel ? 0 : zurueck * (.22 + p.zugY * .2) + (p.stol > 0 ? Math.sin(t * 25) * .15 : 0);
      bodenSchatten(g, p.x, B, groesse * .9);
      A.figur(k, p.x, B - (jubel ? Math.abs(Math.sin(t * 8 + k)) * 24 : 0), groesse, {
        schatten: false, kipp, blick: -zurueck, jubeln: jubel,
        emo: jubel ? 'froh' : p.stol > 0 ? 'schock' : S.sieg >= 0 ? 'schock' : 'normal', huepf: p.zugY > .5 ? .4 : 0,
      });
      // Taktbalken über dem Kopf
      if (S.sieg === -1) this.zeichneTakt(g, S, p, p.x, B - groesse * 2 - 58, A.teamFarbe(k));
    });

    // Restzeit als Steintafel über dem Graben
    if (S.sieg === -1) {
      const rest = Math.max(0, Math.ceil(this.ZEIT - S.t));
      g.fillStyle = 'rgba(30,14,24,.75)'; rundRechteck(g, 750, 92, 100, 54, 16); g.fill();
      A.text(String(rest), 800, 120, 34, rest <= 5 ? '#ff6b6b' : '#fff');
    } else if (S.sieg >= 0) {
      const k = S.sp.findIndex(p => p.s === S.sieg);
      const name = S.sp.filter(p => p.s === S.sieg).length > 1 ? 'Team ' + (S.sieg ? 'Rechts' : 'Links') : A.name(k);
      A.text(name + ' gewinnt!', 800, 130, 48, '#ffd23a');
    } else A.text('Unentschieden!', 800, 130, 48, '#fff');

    for (const e of A.neu(S)) {
      if (e.typ === 'takt') Ton.spiel('klick');
      else if (e.typ === 'zug') {
        const txt = 'Super!', farbe = '#7dff7a';
        if (e.art === 'super') { Ton.spiel('treffer'); A.funken(e.x, e.y + 40, '#7dff7a', 8, 200, 5); }
        else if (e.art === 'daneben' || e.art === 'zuviel') Ton.spiel('fehler');
        else Ton.spiel('schritt');
        if (e.art === 'super') A.text3(txt, e.x, e.y - 30, farbe);
      } else if (e.typ === 'sieg') Ton.spiel('fanfare');
      else if (e.typ === 'platsch') { Ton.spiel('platsch'); A.funken(e.x, e.y, '#ff8a2a', 18, 380, 8); A.funken(e.x, e.y, '#ffd23a', 10, 300, 6); A.text3('Heiss!', e.x, e.y - 120, '#ffb02e'); }
    }
  },
  // Taktbalken: Zeiger läuft von links nach rechts, grünes Feld = starker Zug
  zeichneTakt(g, S, p, x, y, farbe) {
    const W = 112, H = 22, x0 = x - W / 2;
    g.fillStyle = 'rgba(20,10,20,.7)'; rundRechteck(g, x0 - 4, y - 4, W + 8, H + 8, 10); g.fill();
    g.fillStyle = '#5a3a44'; rundRechteck(g, x0, y, W, H, 7); g.fill();
    const zone = (a, b, f) => { g.fillStyle = f; g.fillRect(x0 + W * clamp(a, 0, 1), y, W * (clamp(b, 0, 1) - clamp(a, 0, 1)), H); };
    zone(this.ZONE - .2, this.ZONE + .2, '#d9a62a');
    zone(this.ZONE - .12, this.ZONE + .12, '#a6d33a');
    zone(this.ZONE - .055, this.ZONE + .055, '#38d26a');
    g.strokeStyle = farbe; g.lineWidth = 3; rundRechteck(g, x0, y, W, H, 7); g.stroke();
    // Zeiger (grau, wenn in diesem Takt schon gedrückt oder beim Stolpern)
    const gesperrt = p.gedr === S.zyk || p.stol > 0;
    const mx = x0 + W * S.ph;
    g.fillStyle = gesperrt ? 'rgba(255,255,255,.35)' : '#ffffff';
    rundRechteck(g, mx - 3, y - 7, 6, H + 14, 3); g.fill();
    // Bewertung des letzten Zugs, blendet aus
    const fehl = p.art === 'daneben' || p.art === 'zuviel';
    const sicht = fehl ? clamp(p.stol / .45, 0, 1) : clamp(p.zugY * 1.5, 0, 1);
    if (p.art && p.art !== 'super' && sicht > 0) {
      g.globalAlpha = sicht;
      const txt = { gut: 'Gut', ok: 'Naja', daneben: 'Daneben!', zuviel: 'Zu oft!' }[p.art];
      textMitRand(g, txt, x, y - 22, 24, fehl ? '#ff6b6b' : p.art === 'gut' ? '#d6ff7a' : '#ffd23a');
      g.globalAlpha = 1;
    }
  },
});
