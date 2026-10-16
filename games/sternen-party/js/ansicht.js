// Sternen-Party – Brett-Ansicht: Kamera, Figuren mit Hüpf-Animation, Würfelblock, Stern und Effekte
// Liest nur Spiel.Z und zeichnet daraus ein flüssiges Bild (auf jedem Rechner gleich, auch online).
'use strict';

const Ansicht = {
  cam: { x: 1500, y: 1000, z: .5 }, figur: [], fxGesehen: 0, effekte: [], wahlFeld: -1,
  sternAnim: null, zeit: 0,
  zuruecksetzen() {
    this.figur = []; this.fxGesehen = Spiel.Z ? Math.max(0, ...Spiel.Z.fx.map(f => f.id), 0) : 0; this.effekte = []; this.sternAnim = null;
    this.camInit = false;
  },
  // Position eines Feldes, mit Versatz wenn mehrere Figuren darauf stehen
  platz(i) {
    const Z = Spiel.Z, f = Spiel.brett.felder[Z.spieler[i].feld];
    const da = Z.spieler.map((s, k) => k).filter(k => Z.spieler[k].feld === Z.spieler[i].feld);
    if (da.length < 2) return { x: f.x, y: f.y };
    const k = da.indexOf(i), a = -Math.PI / 2 + k * TAU / da.length + Math.PI / 4;
    return { x: f.x + Math.cos(a) * 30, y: f.y + Math.sin(a) * 18 };
  },
  // Figuren-Animation an den Zustand angleichen
  figurenNachziehen(dt) {
    const Z = Spiel.Z, felder = Spiel.brett.felder;
    Z.spieler.forEach((s, i) => {
      let a = this.figur[i];
      if (!a) a = this.figur[i] = { feld: s.feld, x: felder[s.feld].x, y: felder[s.feld].y, hop: null, h: 0, jubel: 0, traurig: 0 };
      if (!a.hop && a.feld !== s.feld) {
        const von = felder[a.feld], nach = felder[s.feld];
        const nachbar = von.weiter.includes(nach.i);
        a.hop = { vx: a.x, vy: a.y, nach: s.feld, t: 0, dauer: nachbar ? .26 / Uhr.tempo : 1.1, weit: !nachbar };
        a.feld = s.feld;
        if (!nachbar) Ton.spiel('weg');
      }
      const ziel = this.platz(i);
      if (a.hop) {
        const h = a.hop;
        h.t += dt / h.dauer;
        const t = Math.min(1, h.t);
        const e = h.weit ? Ease.inOut(t) : t;
        a.x = lerp(h.vx, ziel.x, e); a.y = lerp(h.vy, ziel.y, e);
        a.h = h.weit ? Math.sin(t * Math.PI) * 320 : Math.sin(t * Math.PI) * 46;
        if (h.t >= 1) { a.hop = null; a.h = 0; a.landung = .2; if (!h.weit) Ton.spiel('schritt'); }
      } else {
        a.x = damp(a.x, ziel.x, 10, dt); a.y = damp(a.y, ziel.y, 10, dt);
      }
      a.landung = Math.max(0, (a.landung || 0) - dt);
      a.jubel = Math.max(0, a.jubel - dt); a.traurig = Math.max(0, a.traurig - dt);
    });
  },
  // Neue Effekte aus Z.fx abspielen
  effekteLesen() {
    const Z = Spiel.Z;
    for (const e of Z.fx) {
      if (e.id <= this.fxGesehen) continue;
      this.fxGesehen = e.id;
      const fig = e.sp != null ? this.figur[e.sp] : null;
      switch (e.typ) {
        case 'muenzen':
          if (!fig) break;
          if (e.wert > 0) { Ton.spiel('muenze'); fig.jubel = 1.2; } else if (e.wert < 0) { Ton.spiel('verlust'); fig.traurig = 1.6; }
          this.effekte.push({ art: 'muenzen', sp: e.sp, wert: e.wert, t: 0, dauer: 1.6 });
          break;
        case 'sterne':
          if (!fig) break;
          this.effekte.push({ art: 'sterne', sp: e.sp, wert: e.wert, t: 0, dauer: 2 });
          if (e.wert > 0) fig.jubel = 2.5; else fig.traurig = 2.5;
          break;
        case 'wurf': this.effekte.push({ art: 'wurf', sp: e.sp, wert: e.wert, t: 0, dauer: 1.2 }); break;
        case 'text': this.effekte.push({ art: 'text', sp: e.sp, text: e.text, t: 0, dauer: 1.6 }); break;
        case 'sternKauf': this.effekte.push({ art: 'funken', sp: e.sp, t: 0, dauer: 2.2 }); break;
        case 'sternNeu': this.sternAnim = { t: 0, von: e.feld }; Ton.spiel('glueck'); break;
        case 'landen': if (fig) fig.landung = .25; break;
        case 'itemNeu': case 'item': this.effekte.push({ art: 'item', sp: e.sp, item: e.item, t: 0, dauer: 1.6, benutzt: e.typ === 'item' }); break;
        case 'gusti': this.effekte.push({ art: 'gusti', sp: e.sp, t: 0, dauer: 2 }); break;
        case 'grimm': this.effekte.push({ art: 'beben', t: 0, dauer: 1.2 }); break;
      }
      UI.fx(e);
    }
  },
  zeichne(g, bw, bh, dt) {
    const Z = Spiel.Z;
    if (!Z || !Spiel.brett) return;
    this.zeit += dt;
    const t = this.zeit;
    this.figurenNachziehen(dt);
    this.effekteLesen();
    const def = Spiel.brett.def;
    // Kamera
    const basis = Math.min(bw / 1600, bh / 900);
    let zx = def.breite / 2, zy = def.hoehe / 2, zz = Math.min(bw / (def.breite + 120), bh / (def.hoehe + 180));
    const k = Z.kamera || { art: 'alle' };
    if (k.art === 'sp' && this.figur[k.i]) { zx = this.figur[k.i].x; zy = this.figur[k.i].y - 60; zz = basis * 1.05; }
    else if (k.art === 'feld') { const f = Spiel.brett.felder[k.i]; zx = f.x; zy = f.y - 60; zz = basis * .95; }
    if (Z.frage && Z.frage.typ === 'weg') zz = basis * .85;
    if (!this.camInit) { this.cam = { x: zx, y: zy, z: zz }; this.camInit = true; }
    const c = this.cam;
    c.x = damp(c.x, zx, 3.2, dt); c.y = damp(c.y, zy, 3.2, dt); c.z = damp(c.z, zz, 2.6, dt);
    // Kamera nicht zu weit über den Rand schieben
    const halbB = bw / 2 / c.z, halbH = bh / 2 / c.z;
    const cx = halbB * 2 > def.breite ? def.breite / 2 : clamp(c.x, halbB - 100, def.breite - halbB + 100);
    const cy = halbH * 2 > def.hoehe ? def.hoehe / 2 : clamp(c.y, halbH - 100, def.hoehe - halbH + 100);
    let beben = 0;
    for (const e of this.effekte) if (e.art === 'beben') beben = Math.max(beben, (1 - e.t / e.dauer) * 12);
    // Meer
    const meer = g.createLinearGradient(0, 0, 0, bh);
    meer.addColorStop(0, '#1fa3d6'); meer.addColorStop(1, '#0b5fa0');
    g.fillStyle = meer; g.fillRect(0, 0, bw, bh);
    g.save();
    g.translate(bw / 2 + (beben ? rnd(-beben, beben) : 0), bh / 2 + (beben ? rnd(-beben, beben) : 0));
    g.scale(c.z, c.z);
    g.translate(-cx, -cy);
    this.sicht = { x0: cx - halbB, y0: cy - halbH, x1: cx + halbB, y1: cy + halbH };
    this.wellen(g, t, def);
    // Insel aus dem Zwischenspeicher
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const q = clamp(Math.round(basis * 1.05 * dpr * 4) / 4, .5, 1.25);
    const bild = BrettBild.hintergrund(Spiel.brett, q);
    g.drawImage(bild, 0, 0, def.breite, def.hoehe);
    this.felder(g, t);
    this.stern(g, t, dt);
    this.figuren(g, t);
    this.wuerfelUndSchritte(g, t);
    this.effekteZeichnen(g, dt);
    g.restore();
  },
  wellen(g, t, def) {
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 4;
    for (let r = 0; r < 14; r++) {
      const y = r * 160 - 80;
      g.beginPath();
      for (let x = -200; x <= def.breite + 200; x += 40) {
        const yy = y + Math.sin(x * .01 + t * 1.2 + r) * 10;
        x === -200 ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
    }
  },
  sichtbar(x, y, rand = 120) { const s = this.sicht; return x > s.x0 - rand && x < s.x1 + rand && y > s.y0 - rand && y < s.y1 + rand; },
  felder(g, t) {
    const Z = Spiel.Z;
    const weg = Z.frage && Z.frage.typ === 'weg' ? Z.frage : null;
    for (const f of Spiel.brett.felder) {
      if (!this.sichtbar(f.x, f.y)) continue;
      if (f.i === Z.sternFeld && !(this.sternAnim && this.sternAnim.t < 1)) {
        // Sternplatz: goldene Plattform statt normalem Feld
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(f.x, f.y + 8, 42, 24, 0, 0, TAU); g.fill();
        const gr = g.createLinearGradient(f.x, f.y - 24, f.x, f.y + 24);
        gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#e8a800');
        g.fillStyle = gr; g.beginPath(); g.ellipse(f.x, f.y, 40, 25, 0, 0, TAU); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
        continue;
      }
      BrettBild.feld(g, f, t, weg && weg.feld === f.i);
    }
    // Wegpfeile an einer Gabelung
    if (weg) {
      const von = Spiel.brett.felder[weg.feld];
      weg.optionen.forEach((o, k) => {
        const nach = Spiel.brett.felder[o.w];
        const a = Math.atan2(nach.y - von.y, nach.x - von.x);
        const aktiv = this.wahlFeld === o.w;
        const d = 80 + Math.sin(t * 6) * 8;
        g.save(); g.translate(von.x + Math.cos(a) * d, von.y + Math.sin(a) * d - 30); g.rotate(a);
        g.fillStyle = aktiv ? '#ffd23a' : 'rgba(255,255,255,.75)'; g.strokeStyle = '#3a2400'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(34, 0); g.lineTo(-6, -30); g.lineTo(-6, -13); g.lineTo(-34, -13); g.lineTo(-34, 13); g.lineTo(-6, 13); g.lineTo(-6, 30); g.closePath();
        g.fill(); g.stroke();
        g.restore();
      });
    }
  },
  stern(g, t, dt) {
    const Z = Spiel.Z;
    if (Z.sternFeld < 0) return;
    const f = Spiel.brett.felder[Z.sternFeld];
    let x = f.x, y = f.y - 95, alpha = 1;
    if (this.sternAnim) {
      const a = this.sternAnim;
      a.t += dt / 1.8;
      const von = a.von != null && Z.sternWeg >= 0 ? Spiel.brett.felder[Z.sternWeg] : null;
      const e = Ease.inOut(Math.min(1, a.t));
      if (von) { x = lerp(von.x, f.x, e); y = lerp(von.y, f.y, e) - 95 - Math.sin(e * Math.PI) * 300; }
      else { alpha = e; y -= (1 - e) * 200; }
      if (a.t >= 1) this.sternAnim = null;
    }
    if (!this.sichtbar(x, y, 200)) return;
    g.save(); g.globalAlpha = alpha;
    // Lichtsäule
    const sl = g.createLinearGradient(0, y - 120, 0, f.y);
    sl.addColorStop(0, 'rgba(255,240,150,0)'); sl.addColorStop(1, 'rgba(255,240,150,.45)');
    g.fillStyle = sl; g.beginPath(); g.moveTo(x - 30, y - 60); g.lineTo(x + 30, y - 60); g.lineTo(x + 50, f.y); g.lineTo(x - 50, f.y); g.fill();
    zeichneStella(g, x, y, 40, t);
    for (let k = 0; k < 5; k++) {
      const a = t * 1.3 + k * TAU / 5;
      zeichneStern(g, x + Math.cos(a) * 70, y + Math.sin(a) * 26 + 10, 8, t);
    }
    g.restore();
  },
  figuren(g, t) {
    const Z = Spiel.Z;
    const reihe = Z.spieler.map((s, i) => i).sort((a, b) => this.figur[a].y - this.figur[b].y);
    for (const i of reihe) {
      const a = this.figur[i], s = Z.spieler[i];
      if (!this.sichtbar(a.x, a.y)) continue;
      const aktiv = Z.aktiv === i;
      // Farbring am Boden
      g.strokeStyle = PLATZ_FARBEN[i]; g.lineWidth = 5; g.globalAlpha = .9;
      g.beginPath(); g.ellipse(a.x, a.y + 2, 30, 14, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      if (aktiv) {
        g.fillStyle = `rgba(255,255,255,${.18 + .12 * Math.sin(t * 5)})`;
        g.beginPath(); g.ellipse(a.x, a.y + 2, 44, 22, 0, 0, TAU); g.fill();
      }
      bodenSchatten(g, a.x, a.y + 2, 30 * (1 - a.h / 500), .25);
      const huepf = a.landung > 0 ? a.landung * 2 : (a.hop ? -.3 : Math.max(0, Math.sin(t * 3 + i)) * .06);
      const emo = a.jubel > 0 ? 'froh' : a.traurig > 0 ? 'traurig' : 'normal';
      zeichneFigur(g, s.figur, a.x, a.y - a.h, 34, { t: t + i, huepf, emo, jubeln: a.jubel > 0, schatten: false, laufen: !!a.hop });
      // Platz-Nummer über dem Kopf
      if (!aktiv || !Z.wuerfel) {
        g.fillStyle = PLATZ_FARBEN[i];
        g.beginPath(); g.moveTo(a.x - 9, a.y - a.h - 96); g.lineTo(a.x + 9, a.y - a.h - 96); g.lineTo(a.x, a.y - a.h - 84); g.closePath(); g.fill();
      }
    }
  },
  // Würfelblock über dem Kopf, danach die Restschritte
  wuerfelUndSchritte(g, t) {
    const Z = Spiel.Z;
    const w = Z.wuerfel;
    if (w) {
      const a = this.figur[w.sp];
      const n = w.n, abst = 104;
      for (let k = 0; k < n; k++) {
        const x = a.x + (k - (n - 1) / 2) * abst, y = a.y - a.h - 170 + Math.sin(t * 4 + k) * 6;
        const fertig = k < w.werte.length;
        const zahl = fertig ? w.werte[k] : (w.rollt ? 1 + Math.floor((t * 22 + k * 3) % 10) : null);
        wuerfelBlock(g, x, y, 42, zahl, fertig, t, w.wunsch);
      }
      if (!w.rollt && w.werte.length > 1) textMitRand(g, '= ' + w.werte.reduce((p, q) => p + q, 0), a.x, a.y - a.h - 240, 40, '#ffd23a');
    } else if (Z.schritte > 0 && Z.aktiv >= 0) {
      const a = this.figur[Z.aktiv];
      const x = a.x, y = a.y - a.h - 140;
      g.fillStyle = 'rgba(20,24,44,.85)'; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
      g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.stroke();
      textMitRand(g, String(Z.schritte), x, y + 2, 38, '#fff');
    }
  },
  effekteZeichnen(g, dt) {
    this.effekte = this.effekte.filter(e => (e.t += dt) < e.dauer);
    for (const e of this.effekte) {
      const a = e.sp != null ? this.figur[e.sp] : null;
      const p = e.t / e.dauer;
      if (!a) continue;
      const x = a.x, y = a.y - a.h - 130 - p * 60;
      g.globalAlpha = clamp((1 - p) * 3, 0, 1);
      if (e.art === 'muenzen') {
        zeichneMuenze(g, x - 34, y, 20, e.t * 6);
        textMitRand(g, (e.wert > 0 ? '+' : '') + e.wert, x + 14, y, 40, e.wert >= 0 ? '#ffe066' : '#ff7a7a', 'left');
      } else if (e.art === 'sterne') {
        zeichneStern(g, x - 34, y - 10, 30, e.t);
        textMitRand(g, (e.wert > 0 ? '+' : '') + e.wert, x + 6, y - 10, 46, e.wert >= 0 ? '#ffe066' : '#ff7a7a', 'left');
      } else if (e.art === 'wurf') {
        const s = Ease.outBack(Math.min(1, e.t * 3));
        textMitRand(g, String(e.wert), x, a.y - a.h - 190, 80 * s, '#fff');
      } else if (e.art === 'text') {
        textMitRand(g, e.text, x, y - 30, 40, '#ffd23a');
      } else if (e.art === 'item') {
        g.drawImage(itemBild(e.item), x - 36, y - 60, 72, 72);
      } else if (e.art === 'funken') {
        for (let k = 0; k < 10; k++) {
          const w = k * TAU / 10 + e.t, r = 40 + e.t * 160;
          zeichneStern(g, a.x + Math.cos(w) * r, a.y - 60 + Math.sin(w) * r * .6, 14 * (1 - p) + 2, e.t * 3);
        }
      } else if (e.art === 'gusti') {
        g.globalAlpha = Math.sin(p * Math.PI);
        zeichneGusti(g, a.x + Math.sin(e.t * 8) * 40, a.y - 110, 34, e.t * 3);
      }
      g.globalAlpha = 1;
    }
  },
};

// Würfelblock im eigenen Stil: türkiser Würfel mit Sternen-Ecken
function wuerfelBlock(g, x, y, r, zahl, fertig, t, wunsch) {
  g.save(); g.translate(x, y);
  const wackel = fertig ? 0 : Math.sin(t * 12) * .05;
  g.rotate(wackel);
  g.fillStyle = 'rgba(0,0,0,.25)'; rundRechteck(g, -r + 6, -r + 8, r * 2, r * 2, 16); g.fill();
  const gr = g.createLinearGradient(0, -r, 0, r);
  if (wunsch) { gr.addColorStop(0, '#ffb0f0'); gr.addColorStop(1, '#b03aa0'); }
  else if (fertig) { gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#f0a000'); }
  else { gr.addColorStop(0, '#7ff0ff'); gr.addColorStop(1, '#1a8fd6'); }
  g.fillStyle = gr; rundRechteck(g, -r, -r, r * 2, r * 2, 16); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; rundRechteck(g, -r + 6, -r + 6, r * 2 - 12, r * .7, 10); g.fill();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) zeichneStern(g, sx * (r - 10), sy * (r - 10), 6, 0);
  if (zahl != null) {
    g.font = `900 ${r * 1.15}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(10,30,60,.8)'; g.strokeText(zahl, 0, 3); g.fillStyle = '#fff'; g.fillText(zahl, 0, 3);
  }
  g.restore();
}

// Item-Symbole (einmal gezeichnet, dann als Bild verwendet)
const _itemBilder = {};
function itemBild(id) {
  if (_itemBilder[id]) return _itemBilder[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.scale(2, 2);
  const kreis = (f1, f2) => { const gr = g.createLinearGradient(0, 4, 0, 60); gr.addColorStop(0, f1); gr.addColorStop(1, f2); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 29, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); };
  const mini = (x, y, s, f) => { g.fillStyle = f; rundRechteck(g, x - s, y - s, s * 2, s * 2, s * .4); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); };
  switch (id) {
    case 'doppel': kreis('#7ff0ff', '#1a8fd6'); mini(24, 36, 11, '#ffcf3a'); mini(40, 26, 11, '#ffcf3a'); break;
    case 'dreifach': kreis('#ffb0b0', '#d63a3a'); mini(20, 38, 9, '#ffcf3a'); mini(32, 22, 9, '#ffcf3a'); mini(44, 38, 9, '#ffcf3a'); break;
    case 'wunsch': kreis('#ffb0f0', '#b03aa0'); mini(32, 32, 14, '#fff'); g.fillStyle = '#b03aa0'; g.font = '900 18px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 33); break;
    case 'turbo': {
      kreis('#a0ffb0', '#22a33a');
      g.fillStyle = '#ff4f4f'; g.beginPath(); g.moveTo(14, 40); g.quadraticCurveTo(16, 22, 30, 22); g.lineTo(34, 30); g.quadraticCurveTo(48, 32, 50, 42); g.lineTo(14, 44); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(14, 42, 37, 5);
      g.strokeStyle = '#fff'; g.lineWidth = 3; for (const yy of [26, 32, 38]) { g.beginPath(); g.moveTo(4, yy); g.lineTo(11, yy); g.stroke(); }
      break;
    }
    case 'kompass': {
      kreis('#fff3a0', '#e0a000');
      g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 18, 0, TAU); g.fill();
      g.fillStyle = '#e03a3a'; g.beginPath(); g.moveTo(32, 14); g.lineTo(38, 32); g.lineTo(26, 32); g.fill();
      g.fillStyle = '#556'; g.beginPath(); g.moveTo(32, 50); g.lineTo(38, 32); g.lineTo(26, 32); g.fill();
      zeichneStern(g, 50, 14, 8, 0);
      break;
    }
    case 'glocke': {
      kreis('#d0d6ff', '#6a6fd6');
      g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(18, 44); g.quadraticCurveTo(20, 16, 32, 16); g.quadraticCurveTo(44, 16, 46, 44); g.closePath(); g.fill();
      g.fillStyle = '#c99000'; g.beginPath(); g.arc(32, 46, 5, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(32, 14, 4, 0, TAU); g.stroke();
      break;
    }
  }
  return (_itemBilder[id] = c);
}
