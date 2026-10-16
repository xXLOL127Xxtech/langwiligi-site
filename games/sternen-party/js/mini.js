// Sternen-Party – Rahmen für alle Minispiele
//
// Ein Minispiel meldet sich mit Minis.reg({...}) an. Felder:
//   id, name, text (Anleitung, 1–2 Sätze), steuerung: { tasten: '…', zeiger: '…' (nur Online-Spiele) }
//   zeiger: true      -> braucht Touchpad/Maus, nur im Online-Modus
//   formate: ['ffa','2v2','1v3','duell']   -> welche Aufteilungen das Spiel kann (ffa/duell: jeder für sich, 2–4 Teilnehmer)
//   dauer: Sekunden   -> optional, danach endet das Spiel automatisch (Zeitanzeige oben)
//   start(S, info)          Anfangszustand in S schreiben (nur Host)
//   schritt(S, ein, dt, info)  60× pro Sekunde (nur Host). S.fertig = true beendet das Spiel.
//   zeichne(g, S, A)        zeichnet in Weltkoordinaten 1600 × 900 (alle Rechner)
//   ki(S, k, stufe, info)   Eingabe für Computer-Teilnehmer k, stufe 0/1/2 (Leicht/Mittel/Schwer)
//   punkte(S, info)         Array mit Punkten pro Teilnehmer, höher = besser
//   wert(S, k)              optional: Text/Zahl für die Anzeige oben (z.B. Punktestand)
//
// S muss JSON sein (keine Funktionen, keine Klassen), denn online wird S an alle geschickt.
// Online-Gäste bekommen S etwa 20× pro Sekunde. Dazwischen werden nur die Felder x, y, w (Winkel), r, z
// sowie Felder mit Endung X, Y oder W weich überblendet. Ereignisse für Töne und Partikel gehören in S.ev
// (Minis.ereignis(S, {...})), in zeichne() holt man neue Ereignisse mit A.neu(S).
//
// Eingabe ein[k]: { x, y: -1..1, a: Aktion gehalten, ap: Aktion gerade gedrückt,
//                   hp/rp/lp/rep: hoch/runter/links/rechts gerade gedrückt,
//                   mx, my: Zeiger in Weltkoordinaten, md: Zeiger gedrückt, cp: gerade geklickt }
'use strict';

const TEAM_FARBEN = ['#4f8ff7', '#ef5350'];

const Minis = {
  liste: [],
  reg(def) { this.liste.push(def); },
  finde(id) { return this.liste.find(d => d.id === id); },
  // Spiele, die zu Format und Modus passen. Online gibt es den erweiterten Pool mit Zeiger-Spielen.
  pool(format, online) { return this.liste.filter(d => d.formate.includes(format) && (online || !d.zeiger)); },
  ereignis(S, e) {
    S.ev = S.ev || []; S.evn = (S.evn || 0) + 1;
    e.id = S.evn; S.ev.push(e);
    if (S.ev.length > 24) S.ev.shift();
  },
};

// Punkte -> Platzierung und Gewinner. Teams werden über den Durchschnitt ihrer Mitglieder gewertet.
function miniAuswertung(punkte, info) {
  const n = punkte.length;
  let wert = punkte.slice();
  if (info.format === '2v2' || info.format === '1v3') {
    const summe = [0, 0], anzahl = [0, 0];
    info.teams.forEach((tm, k) => { summe[tm] += punkte[k]; anzahl[tm]++; });
    const team = summe.map((s, i) => anzahl[i] ? s / anzahl[i] : -Infinity);
    wert = info.teams.map(tm => team[tm]);
  }
  const max = Math.max(...wert);
  const gewinner = [];
  for (let k = 0; k < n; k++) if (wert[k] === max) gewinner.push(k);
  // Unentschieden zwischen Teams: niemand gewinnt
  if ((info.format === '2v2' || info.format === '1v3') && gewinner.length === n) gewinner.length = 0;
  const sortiert = [...new Set(wert)].sort((a, b) => b - a);
  const platz = wert.map(v => sortiert.indexOf(v) + 1);
  return { punkte, wert, gewinner, platz };
}

// Weiche Überblendung zwischen zwei Zuständen (nur für Online-Gäste)
const MIX_FELD = /^(x|y|w|r|z)$|[XYW]$/;
function mixZustand(a, b, t, key) {
  if (typeof b === 'number') {
    if (typeof a !== 'number' || !MIX_FELD.test(key || '')) return b;
    if (key === 'w' || /W$/.test(key)) {
      let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      return a + d * t;
    }
    return Math.abs(b - a) > 260 ? b : a + (b - a) * t;
  }
  if (Array.isArray(b)) {
    if (!Array.isArray(a)) return b;
    return b.map((v, i) => {
      let av = a[i];
      if (v && typeof v === 'object' && v.id !== undefined && (!av || av.id !== v.id)) av = a.find(o => o && o.id === v.id);
      return av === undefined ? v : mixZustand(av, v, t, key);
    });
  }
  if (b && typeof b === 'object') {
    if (!a || typeof a !== 'object') return b;
    const o = {};
    for (const k in b) o[k] = k === 'ev' ? b[k] : mixZustand(a[k], b[k], t, k);
    return o;
  }
  return b;
}

// Ein laufendes Minispiel. rolle 'host' rechnet (lokal oder Online-Gastgeber), 'gast' zeigt nur an.
// info: { teilnehmer, teams, format, solo, figuren, namen, farben, quellen, stufen, ich }
//   quellen[k]: { art: 'block', block } | { art: 'bot' } | { art: 'netz', slot } | { art: 'selbst' }
class MiniLauf {
  constructor(def, info, rolle, vorschau = false) {
    this.def = def; this.info = info; this.rolle = rolle; this.vorschau = vorschau;
    this.phase = vorschau ? 'spiel' : 'countdown';
    this.pt = 0;               // Zeit in der aktuellen Phase
    this.S = null; this.alt = null; this.neuT = 0; this.intervall = .05;
    this.vorher = info.teilnehmer.map(() => leereEingabe());
    this.akku = 0; this.fertig = false; this.ergebnis = null;
    this.gesehen = 0;          // höchste bereits gezeigte Ereignis-Nummer
    this.partikel = [];
    if (rolle === 'host') {
      this.S = { t: 0, ev: [], evn: 0 };
      def.start(this.S, info);
    }
  }
  // Eingabe aller Teilnehmer für einen Schritt holen und Tastendrücke erkennen
  eingaben() {
    const out = [];
    this.info.teilnehmer.forEach((p, k) => {
      const q = this.info.quellen[k];
      let e;
      if (q.art === 'bot' || this.vorschau) {
        e = Object.assign(leereEingabe(), this.def.ki(this.S, k, this.info.stufen[k], this.info) || {});
        e.bot = true;
      } else if (q.art === 'block') e = Object.assign(leereEingabe(), Eingabe.block(q.block));
      else if (q.art === 'selbst') e = Eingabe.mitZeiger(Eingabe.alleBloecke());
      else e = Object.assign(leereEingabe(), (Netz.eingaben[q.slot] || {}));
      if (!e.bot) {
        const v = this.vorher[k];
        e.ap = e.an > v.an; e.hp = e.hn > v.hn; e.rp = e.rn > v.rn; e.lp = e.ln > v.ln; e.rep = e.ren > v.ren; e.cp = e.cn > v.cn;
        this.vorher[k] = e;
      }
      out.push(e);
    });
    return out;
  }
  // Host: Zeit voranbringen (feste Schritte von 1/60 s)
  tick(dt) {
    if (this.rolle !== 'host' || this.fertig) return;
    this.pt += dt;
    if (this.phase === 'countdown') {
      // Schon während des Countdowns Eingaben lesen, damit frühe Tastendrücke nicht später zählen
      this.eingaben();
      if (this.pt >= 3.2) { this.phase = 'spiel'; this.pt = 0; }
      return;
    }
    if (this.phase === 'ende') {
      if (this.pt >= 1.8) this.beenden();
      return;
    }
    this.akku = Math.min(this.akku + dt, .25);
    const h = 1 / 60;
    while (this.akku >= h && this.phase === 'spiel') {
      this.akku -= h;
      this.S.t += h;
      this.def.schritt(this.S, this.eingaben(), h, this.info);
      if (this.def.dauer && this.S.t >= this.def.dauer) this.S.fertig = true;
      if (this.S.fertig) {
        if (this.vorschau) { this.S = { t: 0, ev: [], evn: 0 }; this.def.start(this.S, this.info); continue; }
        this.phase = 'ende'; this.pt = 0; Ton.spiel('pfiff');
      }
    }
  }
  beenden() {
    this.fertig = true;
    this.ergebnis = miniAuswertung(this.def.punkte(this.S, this.info), this.info);
  }
  // Was online verschickt wird
  schnappschuss() { return { ph: this.phase, pt: this.pt, s: this.S }; }
  // Gast: neuer Zustand vom Host
  empfange(snap) {
    const jetzt = performance.now() / 1000;
    if (this.S) this.intervall = clamp(jetzt - this.neuT, .03, .2);
    this.alt = this.S ? this.anzeigeZustand() : snap.s;
    this.S = snap.s; this.neuT = jetzt;
    if (snap.ph !== this.phase) { if (snap.ph === 'ende') Ton.spiel('pfiff'); this.phase = snap.ph; }
    this.pt = snap.pt;
  }
  anzeigeZustand() {
    if (this.rolle === 'host' || !this.alt) return this.S;
    const t = clamp((performance.now() / 1000 - this.neuT) / this.intervall, 0, 1);
    return t >= 1 ? this.S : mixZustand(this.alt, this.S, t);
  }
  // Zeichnen: Spielwelt mit schwarzen Rändern, darüber Anzeige, Countdown und Abpfiff
  zeichne(g, bw, bh, dunkel = false) {
    const S = this.anzeigeZustand();
    g.fillStyle = '#0b0d14'; g.fillRect(0, 0, bw, bh);
    if (!S) return;
    const sk = Math.min(bw / WELT_B, bh / WELT_H);
    const ox = (bw - WELT_B * sk) / 2, oy = (bh - WELT_H * sk) / 2;
    this.skala = { sk, ox, oy };
    g.save(); g.translate(ox, oy); g.scale(sk, sk);
    g.beginPath(); g.rect(0, 0, WELT_B, WELT_H); g.clip();
    const A = this.ansicht(g, S);
    this.def.zeichne(g, S, A);
    this.zeichnePartikel(g);
    g.restore();
    if (dunkel || this.vorschau) return;
    g.save(); g.translate(ox, oy); g.scale(sk, sk);
    this.zeichneAnzeige(g, S);
    const ph = this.phase;
    if (ph === 'countdown') {
      const rest = 3 - this.pt;
      const zahl = rest > 0 ? Math.ceil(rest) : 0;
      if (zahl !== this._letzteZahl) { this._letzteZahl = zahl; Ton.spiel(zahl > 0 ? 'zaehl' : 'los'); }
      const frac = rest > 0 ? rest - Math.floor(rest) : 1 - (this.pt - 3) / .2;
      g.fillStyle = 'rgba(8,10,18,.35)'; g.fillRect(0, 0, WELT_B, WELT_H);
      grossText(g, zahl > 0 ? String(zahl) : 'Los!', WELT_B / 2, WELT_H / 2, 170 + (1 - frac) * 40, zahl > 0 ? '#fff' : '#ffd23a', 1);
    } else if (ph === 'ende') {
      const k = Ease.outBack(clamp(this.pt / .4, 0, 1));
      grossText(g, 'Ende!', WELT_B / 2, WELT_H / 2, 160 * k, '#ffd23a', 1);
    }
    g.restore();
  }
  ansicht(g, S) {
    const info = this.info, lauf = this;
    return {
      info, ich: info.ich, t: performance.now() / 1000, S,
      zeiger: Eingabe.zeiger,
      figur(k, x, y, r, o = {}) { zeichneFigur(g, info.figuren[k], x, y, r, o); },
      farbe(k) { return info.farben[k]; },
      teamFarbe(k) { return info.format === '2v2' || info.format === '1v3' ? TEAM_FARBEN[info.teams[k]] : info.farben[k]; },
      name(k) { return info.namen[k]; },
      text(s, x, y, groesse, farbe = '#fff', align = 'center') { textMitRand(g, s, x, y, groesse, farbe, align); },
      // Neue Ereignisse seit dem letzten Bild (für Töne und Partikel)
      neu(S2) {
        const out = [];
        for (const e of (S2.ev || [])) if (e.id > lauf.gesehen) out.push(e);
        if (out.length) lauf.gesehen = out[out.length - 1].id;
        return lauf.vorschau ? [] : out;
      },
      // Partikel nur zur Zierde, laufen auf jedem Rechner selbst
      funken(x, y, farbe, n = 14, tempo = 260, groesse = 7) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = tempo * (.4 + Math.random() * .8);
          lauf.partikel.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - tempo * .3, l: 1, f: farbe, g: groesse * (.6 + Math.random() * .8) });
        }
      },
      text3(s, x, y, farbe = '#ffd23a') { lauf.partikel.push({ x, y, vx: 0, vy: -70, l: 1.4, f: farbe, txt: s }); },
    };
  }
  zeichnePartikel(g) {
    const jetzt = performance.now() / 1000;
    const dt = Math.min(.05, jetzt - (this._pz || jetzt)); this._pz = jetzt;
    this.partikel = this.partikel.filter(p => (p.l -= dt * (p.txt ? .8 : 1.6)) > 0);
    for (const p of this.partikel) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.txt) p.vy += 600 * dt;
      g.globalAlpha = clamp(p.l, 0, 1);
      if (p.txt) textMitRand(g, p.txt, p.x, p.y, 34, p.f);
      else { g.fillStyle = p.f; g.beginPath(); g.arc(p.x, p.y, p.g * p.l, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  // Leiste oben: Teilnehmer mit Name und Wert, dazu die Restzeit
  zeichneAnzeige(g, S) {
    const info = this.info, n = info.teilnehmer.length;
    const bw = 250, abst = 14, total = n * bw + (n - 1) * abst;
    let x0 = WELT_B / 2 - total / 2;
    const zeit = this.def.dauer ? Math.max(0, this.def.dauer - S.t) : null;
    if (zeit != null) x0 -= 60;
    for (let k = 0; k < n; k++) {
      const x = x0 + k * (bw + abst), y = 12;
      g.fillStyle = 'rgba(10,12,22,.72)';
      rundRechteck(g, x, y, bw, 52, 26); g.fill();
      g.strokeStyle = (info.format === '2v2' || info.format === '1v3') ? TEAM_FARBEN[info.teams[k]] : info.farben[k];
      g.lineWidth = 3; g.stroke();
      if (info.ich === k) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; rundRechteck(g, x - 4, y - 4, bw + 8, 60, 30); g.stroke(); }
      zeichneFigur(g, info.figuren[k], x + 30, y + 49, 17, { schatten: false, t: performance.now() / 1000 });
      g.font = '700 20px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = '#fff'; g.fillText(kuerzen(g, info.namen[k], 120), x + 58, y + 26);
      if (this.def.wert) {
        const w = this.def.wert(S, k);
        g.textAlign = 'right'; g.font = '800 24px system-ui,sans-serif'; g.fillStyle = '#ffd23a';
        g.fillText(String(w), x + bw - 16, y + 27);
      }
    }
    if (zeit != null) {
      const x = x0 + total + 20, y = 12;
      g.fillStyle = zeit < 5.5 ? 'rgba(200,40,40,.85)' : 'rgba(10,12,22,.72)';
      rundRechteck(g, x, y, 100, 52, 26); g.fill();
      g.font = '800 28px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText(Math.ceil(zeit), x + 50, y + 27);
    }
  }
}

// ---------- Zeichen-Helfer, auch für die Minispiele ----------
function rundRechteck(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function textMitRand(g, s, x, y, groesse, farbe = '#fff', align = 'center') {
  g.font = `800 ${groesse}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(10,8,24,.85)'; g.lineWidth = Math.max(3, groesse * .16); g.strokeText(s, x, y);
  g.fillStyle = farbe; g.fillText(s, x, y);
}
function grossText(g, s, x, y, groesse, farbe, alpha = 1) {
  if (groesse <= 1) return;
  g.save(); g.globalAlpha = alpha;
  g.font = `${groesse}px "Lilita One",system-ui,sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = '#2a1050'; g.lineWidth = groesse * .14; g.strokeText(s, x, y + groesse * .05);
  g.fillStyle = farbe; g.fillText(s, x, y);
  g.restore();
}
function kuerzen(g, s, max) {
  if (g.measureText(s).width <= max) return s;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
// Startpositionen für n Teilnehmer gleichmässig verteilt
function startPunkte(n, cx, cy, rad) {
  const out = [];
  for (let k = 0; k < n; k++) { const a = -Math.PI * .75 + k * TAU / n; out.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad }); }
  return out;
}
