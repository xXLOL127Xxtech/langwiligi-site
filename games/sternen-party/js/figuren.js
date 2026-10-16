// Sternen-Party – Figuren: acht eigene Spielfiguren und die Nebenfiguren, alles als Vektorgrafik gezeichnet
'use strict';

const FIGUREN = [
  { name: 'Flix', tier: 'Fuchs', farbe: '#ff8a3d', hell: '#ffc08a', dunkel: '#b8501c', bauch: '#fff4e6', ohren: 'spitz', innen: '#5a2b16', gesicht: 'fuchs', schwanz: 'fuchs' },
  { name: 'Mira', tier: 'Katze', farbe: '#a875f0', hell: '#d2b4ff', dunkel: '#6a3fb0', bauch: '#f3eaff', ohren: 'spitz', innen: '#ff9ccf', gesicht: 'katze', schwanz: 'katze' },
  { name: 'Bruno', tier: 'Bär', farbe: '#b77b4f', hell: '#dcab80', dunkel: '#7a4826', bauch: '#f2d6b8', ohren: 'rund', innen: '#e9b48d', gesicht: 'baer' },
  { name: 'Pino', tier: 'Pinguin', farbe: '#3f63b8', hell: '#7d9de6', dunkel: '#203a78', bauch: '#ffffff', ohren: 'keine', gesicht: 'pinguin' },
  { name: 'Kiki', tier: 'Küken', farbe: '#ffd23a', hell: '#fff09a', dunkel: '#c9920a', bauch: '#fff8d6', ohren: 'kamm', gesicht: 'schnabel' },
  { name: 'Rocco', tier: 'Frosch', farbe: '#4cc85a', hell: '#9df0a2', dunkel: '#23803a', bauch: '#d9ffd0', ohren: 'frosch', gesicht: 'frosch' },
  { name: 'Luna', tier: 'Hase', farbe: '#ff8fc4', hell: '#ffd0e6', dunkel: '#c9558e', bauch: '#fff0f7', ohren: 'lang', innen: '#ff5f9e', gesicht: 'hase', schwanz: 'hase' },
  { name: 'Nori', tier: 'Panda', farbe: '#f4f4f7', hell: '#ffffff', dunkel: '#9aa0b2', bauch: '#ffffff', ohren: 'rund', ohrFarbe: '#24262e', innen: '#3a3d48', gesicht: 'panda' },
];

function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); }

// Weicher Schatten auf dem Boden
function bodenSchatten(g, x, y, r, alpha = .28) {
  g.fillStyle = `rgba(0,0,0,${alpha})`;
  ellipse(g, x, y, r * .9, r * .28); g.fill();
}

// Zeichnet Figur idx mit den Füssen bei (x, y). r = Körperradius in Pixeln.
// o: { t: Zeit in s, huepf: 0..1 (Stauchen), blick: -1..1, emo: 'normal'|'froh'|'traurig'|'schock', kipp: Winkel, schatten, alpha, spiegeln }
function zeichneFigur(g, idx, x, y, r, o = {}) {
  const f = FIGUREN[((idx % FIGUREN.length) + FIGUREN.length) % FIGUREN.length];
  const t = o.t != null ? o.t : performance.now() / 1000;
  const squash = o.huepf || 0;
  const emo = o.emo || 'normal';
  const rx = r * (1 + squash * .12), ry = r * (1 - squash * .12);
  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (o.schatten !== false) bodenSchatten(g, x, y, r);
  g.translate(x, y);
  if (o.kipp) g.rotate(o.kipp);
  if (o.spiegeln) g.scale(-1, 1);
  const cy = -ry * 1.02;               // Mittelpunkt des Körpers
  const lw = Math.max(1.2, r * .07);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = f.dunkel; g.lineWidth = lw;

  // Füsse
  const fussFarbe = f.gesicht === 'pinguin' || f.gesicht === 'schnabel' ? '#ff9a2e' : f.ohrFarbe || f.dunkel;
  const schritt = o.laufen ? Math.sin(t * 14) * r * .12 : 0;
  g.fillStyle = fussFarbe;
  for (const s of [-1, 1]) {
    ellipse(g, s * rx * .42 + (s > 0 ? schritt : -schritt), -r * .1, r * .3, r * .17); g.fill();
  }

  // Schwanz
  if (f.schwanz === 'fuchs') {
    g.save(); g.translate(-rx * .78, cy + ry * .45); g.rotate(-.7 + Math.sin(t * 3) * .12);
    const gr = g.createLinearGradient(0, 0, -r * .9, 0); gr.addColorStop(0, f.farbe); gr.addColorStop(.7, f.farbe); gr.addColorStop(.72, '#fff'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; ellipse(g, -r * .45, 0, r * .55, r * .26); g.fill(); g.stroke(); g.restore();
  } else if (f.schwanz === 'katze') {
    g.save(); g.strokeStyle = f.dunkel; g.lineWidth = r * .2;
    g.beginPath(); g.moveTo(-rx * .7, cy + ry * .55);
    g.quadraticCurveTo(-rx * 1.35, cy + ry * .2 + Math.sin(t * 2.5) * r * .1, -rx * 1.15, cy - ry * .35); g.stroke();
    g.strokeStyle = f.farbe; g.lineWidth = r * .13; g.stroke(); g.restore();
  } else if (f.schwanz === 'hase') {
    g.fillStyle = '#fff'; ellipse(g, -rx * .9, cy + ry * .5, r * .2, r * .2); g.fill(); g.stroke();
  }

  // Ohren (hinter dem Kopf)
  const ohrF = f.ohrFarbe || f.farbe;
  if (f.ohren === 'spitz') {
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * rx * .52, cy - ry * .72); g.rotate(s * .35 + Math.sin(t * 2 + s) * .04);
      g.fillStyle = ohrF;
      g.beginPath(); g.moveTo(-r * .3, r * .15); g.quadraticCurveTo(-r * .12, -r * .5, 0, -r * .62); g.quadraticCurveTo(r * .12, -r * .5, r * .3, r * .15); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = f.innen;
      g.beginPath(); g.moveTo(-r * .16, r * .08); g.quadraticCurveTo(-r * .06, -r * .3, 0, -r * .42); g.quadraticCurveTo(r * .06, -r * .3, r * .16, r * .08); g.closePath(); g.fill();
      g.restore();
    }
  } else if (f.ohren === 'rund') {
    for (const s of [-1, 1]) {
      g.fillStyle = ohrF; ellipse(g, s * rx * .66, cy - ry * .72, r * .3, r * .3); g.fill(); g.stroke();
      g.fillStyle = f.innen; ellipse(g, s * rx * .66, cy - ry * .72, r * .16, r * .16); g.fill();
    }
  } else if (f.ohren === 'lang') {
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * rx * .32, cy - ry * .78); g.rotate(s * .18 + Math.sin(t * 2.2 + s) * .06 + (emo === 'traurig' ? s * .9 : 0));
      g.fillStyle = f.farbe; ellipse(g, 0, -r * .55, r * .2, r * .62); g.fill(); g.stroke();
      g.fillStyle = f.innen; ellipse(g, 0, -r * .55, r * .09, r * .45); g.fill();
      g.restore();
    }
  } else if (f.ohren === 'kamm') {
    g.fillStyle = '#ff7a2e';
    for (const k of [-1, 0, 1]) {
      g.save(); g.translate(k * r * .16, cy - ry * .9); g.rotate(k * .4 + Math.sin(t * 3 + k) * .08);
      ellipse(g, 0, -r * .18, r * .1, r * .24); g.fill(); g.strokeStyle = '#c4501a'; g.stroke(); g.restore();
    }
  }

  // Ärmchen
  const arm = o.jubeln ? -1 : Math.sin(t * 2.4) * .15;
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * rx * .86, cy + ry * .2); g.rotate(s * (.5 + arm * (o.jubeln ? 1.6 : 1)));
    g.fillStyle = f.gesicht === 'pinguin' ? f.dunkel : f.farbe;
    ellipse(g, 0, r * .18, r * .17, r * .3); g.fill(); g.stroke(); g.restore();
  }

  // Körper
  const gr = g.createRadialGradient(-rx * .35, cy - ry * .45, r * .1, 0, cy, r * 1.15);
  gr.addColorStop(0, f.hell); gr.addColorStop(.55, f.farbe); gr.addColorStop(1, f.dunkel);
  g.fillStyle = gr;
  ellipse(g, 0, cy, rx, ry); g.fill(); g.stroke();

  // Bauch / Gesichtsfeld
  g.save(); ellipse(g, 0, cy, rx - lw / 2, ry - lw / 2); g.clip();
  if (f.gesicht === 'pinguin') {
    g.fillStyle = f.bauch; ellipse(g, 0, cy + ry * .18, rx * .72, ry * .86); g.fill();
  } else if (f.gesicht !== 'panda') {
    g.fillStyle = f.bauch; g.globalAlpha *= .9; ellipse(g, 0, cy + ry * .78, rx * .6, ry * .45); g.fill(); g.globalAlpha /= .9;
  }
  // Glanz
  g.fillStyle = 'rgba(255,255,255,.35)'; ellipse(g, -rx * .38, cy - ry * .55, rx * .28, ry * .14, -.5); g.fill();
  g.restore();

  // Gesicht
  const ex = rx * .32, eyY = cy - ry * .12 - (f.gesicht === 'frosch' ? ry * .55 : 0);
  if (f.ohren === 'frosch') {
    for (const s of [-1, 1]) {
      g.fillStyle = f.farbe; ellipse(g, s * rx * .38, cy - ry * .78, r * .3, r * .26); g.fill(); g.stroke();
    }
  }
  if (f.gesicht === 'panda') {
    g.fillStyle = '#24262e';
    for (const s of [-1, 1]) { ellipse(g, s * ex, eyY + r * .03, r * .22, r * .27, s * -.4); g.fill(); }
  }
  if (f.gesicht === 'fuchs' || f.gesicht === 'baer') {
    g.fillStyle = f.gesicht === 'fuchs' ? '#fff' : f.bauch;
    ellipse(g, 0, cy + ry * .28, r * .42, r * .28); g.fill();
  }
  // Augen
  const blinzeln = o.zu || ((t + idx * .7) % 3.7) < .12;
  const bx = clamp(o.blick || 0, -1, 1) * r * .06;
  for (const s of [-1, 1]) {
    const axp = s * ex, ayp = f.ohren === 'frosch' ? cy - ry * .8 : eyY;
    if (emo === 'froh' || blinzeln) {
      g.strokeStyle = '#1d1b26'; g.lineWidth = r * .07;
      g.beginPath();
      if (emo === 'froh') g.arc(axp, ayp + r * .06, r * .12, Math.PI * 1.15, Math.PI * 1.85);
      else { g.moveTo(axp - r * .12, ayp); g.lineTo(axp + r * .12, ayp); }
      g.stroke();
      continue;
    }
    g.fillStyle = '#fff'; ellipse(g, axp, ayp, r * .16, r * .2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = r * .025; g.stroke();
    const pr = emo === 'schock' ? .07 : .11;
    g.fillStyle = '#1d1b26'; ellipse(g, axp + bx, ayp + r * .03, r * pr, r * (pr + .03)); g.fill();
    g.fillStyle = '#fff'; ellipse(g, axp + bx + r * .04, ayp - r * .04, r * .04, r * .04); g.fill();
    if (emo === 'traurig') {
      g.strokeStyle = '#1d1b26'; g.lineWidth = r * .05;
      g.beginPath(); g.moveTo(axp - s * r * .14, ayp - r * .3); g.lineTo(axp + s * r * .1, ayp - r * .2); g.stroke();
    }
  }
  // Wangen
  g.fillStyle = 'rgba(255,90,120,.35)';
  for (const s of [-1, 1]) { ellipse(g, s * rx * .55, cy + ry * .14, r * .13, r * .08); g.fill(); }
  // Nase / Schnabel / Mund
  const my = cy + ry * .25;
  g.strokeStyle = '#2a1f24'; g.lineWidth = r * .05;
  const mund = () => {
    g.beginPath();
    if (emo === 'froh' || o.jubeln) { g.fillStyle = '#7a1f3a'; g.moveTo(-r * .16, my + r * .05); g.quadraticCurveTo(0, my + r * .32, r * .16, my + r * .05); g.closePath(); g.fill(); g.stroke(); }
    else if (emo === 'traurig') { g.moveTo(-r * .12, my + r * .18); g.quadraticCurveTo(0, my + r * .06, r * .12, my + r * .18); g.stroke(); }
    else if (emo === 'schock') { g.fillStyle = '#7a1f3a'; ellipse(g, 0, my + r * .14, r * .08, r * .11); g.fill(); g.stroke(); }
    else { g.moveTo(-r * .12, my + r * .08); g.quadraticCurveTo(-r * .06, my + r * .16, 0, my + r * .08); g.quadraticCurveTo(r * .06, my + r * .16, r * .12, my + r * .08); g.stroke(); }
  };
  switch (f.gesicht) {
    case 'pinguin': case 'schnabel': {
      g.fillStyle = '#ff9a2e'; g.strokeStyle = '#c4601a';
      g.beginPath(); g.moveTo(-r * .15, my - r * .05); g.quadraticCurveTo(0, my - r * .14, r * .15, my - r * .05); g.lineTo(0, my + (emo === 'froh' ? r * .24 : r * .16)); g.closePath(); g.fill(); g.stroke();
      if (emo === 'froh' || emo === 'schock') { g.fillStyle = '#c4381a'; ellipse(g, 0, my + r * .05, r * .06, r * .04); g.fill(); }
      break;
    }
    case 'frosch': {
      g.strokeStyle = '#1d4a24'; g.lineWidth = r * .06;
      g.beginPath();
      if (emo === 'traurig') g.arc(0, my + r * .25, r * .3, Math.PI * 1.2, Math.PI * 1.8);
      else g.arc(0, my - r * .2, r * .42, Math.PI * .2, Math.PI * .8);
      g.stroke();
      if (emo === 'froh') { g.fillStyle = '#ff6b8a'; ellipse(g, 0, my + r * .2, r * .12, r * .06); g.fill(); }
      break;
    }
    default: {
      g.fillStyle = f.gesicht === 'katze' || f.gesicht === 'hase' ? '#ff5f8f' : '#2a1f24';
      ellipse(g, 0, my - r * .02, r * .08, r * .055); g.fill();
      mund();
      if (f.gesicht === 'katze') {
        g.strokeStyle = 'rgba(40,20,60,.6)'; g.lineWidth = r * .025;
        for (const s of [-1, 1]) for (const k of [-1, 1]) { g.beginPath(); g.moveTo(s * r * .25, my + k * r * .03); g.lineTo(s * r * .55, my + k * r * .1 - r * .02); g.stroke(); }
      }
      if (f.gesicht === 'hase' && emo !== 'froh') { g.fillStyle = '#fff'; g.strokeStyle = '#c9558e'; g.lineWidth = r * .02; g.fillRect(-r * .05, my + r * .1, r * .1, r * .09); g.strokeRect(-r * .05, my + r * .1, r * .1, r * .09); }
    }
  }
  g.restore();
}

// ---------- Nebenfiguren ----------
// Stella, die Sternenfee (verkauft die Sterne)
function zeichneStella(g, x, y, r, t = 0) {
  g.save(); g.translate(x, y + Math.sin(t * 2.5) * r * .08);
  g.rotate(Math.sin(t * 1.7) * .08);
  // Glanz
  const halo = g.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.8);
  halo.addColorStop(0, 'rgba(255,240,150,.55)'); halo.addColorStop(1, 'rgba(255,240,150,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 1.8, 0, TAU); g.fill();
  sternPfad(g, 0, 0, r, r * .52, 5, -Math.PI / 2);
  const gr = g.createRadialGradient(-r * .3, -r * .35, r * .05, 0, 0, r);
  gr.addColorStop(0, '#fffbe0'); gr.addColorStop(.5, '#ffd84a'); gr.addColorStop(1, '#f0a10a');
  g.fillStyle = gr; g.fill(); g.strokeStyle = '#b36a00'; g.lineWidth = r * .07; g.lineJoin = 'round'; g.stroke();
  // Gesicht
  const blinz = (t % 3.3) < .12;
  for (const s of [-1, 1]) {
    if (blinz) { g.strokeStyle = '#3a2400'; g.lineWidth = r * .06; g.beginPath(); g.moveTo(s * r * .22 - r * .08, -r * .02); g.lineTo(s * r * .22 + r * .08, -r * .02); g.stroke(); }
    else { g.fillStyle = '#3a2400'; ellipse(g, s * r * .2, -r * .02, r * .07, r * .11); g.fill(); g.fillStyle = '#fff'; ellipse(g, s * r * .2 + r * .025, -r * .06, r * .025, r * .03); g.fill(); }
  }
  g.fillStyle = 'rgba(255,100,80,.4)'; for (const s of [-1, 1]) { ellipse(g, s * r * .36, r * .14, r * .1, r * .06); g.fill(); }
  g.strokeStyle = '#3a2400'; g.lineWidth = r * .05; g.beginPath(); g.arc(0, r * .12, r * .1, .2, Math.PI - .2); g.stroke();
  g.restore();
}

// Graf Grimm, der Bösewicht vom Vulkan
function zeichneGrimm(g, x, y, r, t = 0, lacht = false) {
  g.save(); g.translate(x, y);
  bodenSchatten(g, 0, 0, r * 1.1, .35);
  const cy = -r;
  g.lineJoin = 'round'; g.strokeStyle = '#3a0a14'; g.lineWidth = r * .06;
  // Umhang
  g.fillStyle = '#2b1240';
  g.beginPath(); g.moveTo(-r * .9, cy - r * .2); g.quadraticCurveTo(-r * 1.4, cy + r * .9, -r * 1.05, -r * .02 + Math.sin(t * 3) * r * .04);
  g.lineTo(r * 1.05, -r * .02 + Math.sin(t * 3 + 1) * r * .04); g.quadraticCurveTo(r * 1.4, cy + r * .9, r * .9, cy - r * .2); g.closePath(); g.fill(); g.stroke();
  // Hörner
  g.fillStyle = '#f2e6c9';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * r * .45, cy - r * .7); g.quadraticCurveTo(s * r * .95, cy - r * 1.2, s * r * .85, cy - r * 1.55); g.quadraticCurveTo(s * r * .6, cy - r * 1.1, s * r * .2, cy - r * .85); g.closePath(); g.fill(); g.stroke();
  }
  // Körper
  const gr = g.createRadialGradient(-r * .35, cy - r * .45, r * .1, 0, cy, r * 1.1);
  gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(.6, '#c42a3a'); gr.addColorStop(1, '#6e0f1e');
  g.fillStyle = gr; ellipse(g, 0, cy, r * .95, r); g.fill(); g.stroke();
  // Krone
  g.fillStyle = '#ffd23a'; g.strokeStyle = '#a36b00';
  g.beginPath(); g.moveTo(-r * .38, cy - r * .82); g.lineTo(-r * .4, cy - r * 1.15); g.lineTo(-r * .2, cy - r * .98); g.lineTo(0, cy - r * 1.25); g.lineTo(r * .2, cy - r * .98); g.lineTo(r * .4, cy - r * 1.15); g.lineTo(r * .38, cy - r * .82); g.closePath(); g.fill(); g.stroke();
  // Augen
  for (const s of [-1, 1]) {
    g.fillStyle = '#ffe066'; ellipse(g, s * r * .3, cy - r * .18, r * .17, r * .14, s * .3); g.fill();
    g.fillStyle = '#1a0008'; ellipse(g, s * r * .3, cy - r * .16, r * .05, r * .1); g.fill();
    g.strokeStyle = '#3a0a14'; g.lineWidth = r * .08; g.beginPath(); g.moveTo(s * r * .52, cy - r * .42); g.lineTo(s * r * .12, cy - r * .3); g.stroke();
  }
  // Mund mit Zähnen
  g.fillStyle = '#3a0a14'; g.beginPath();
  if (lacht) { g.moveTo(-r * .4, cy + r * .2); g.quadraticCurveTo(0, cy + r * (.75 + Math.sin(t * 20) * .05), r * .4, cy + r * .2); g.closePath(); }
  else { g.moveTo(-r * .35, cy + r * .28); g.quadraticCurveTo(0, cy + r * .45, r * .35, cy + r * .28); g.quadraticCurveTo(0, cy + r * .36, -r * .35, cy + r * .28); }
  g.fill();
  g.fillStyle = '#fff';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * .22, cy + r * .27); g.lineTo(s * r * .15, cy + r * .43); g.lineTo(s * r * .08, cy + r * .3); g.closePath(); g.fill(); }
  g.restore();
}

// Gusti, das Gespenst (stiehlt gegen Bezahlung)
function zeichneGusti(g, x, y, r, t = 0) {
  g.save(); g.translate(x, y + Math.sin(t * 2) * r * .12);
  g.globalAlpha *= .94;
  const gr = g.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r * 1.2);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c9d2f0');
  g.fillStyle = gr; g.strokeStyle = '#8890b8'; g.lineWidth = r * .06;
  g.beginPath(); g.arc(0, -r * .1, r, Math.PI, 0);
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const px = r - (2 * r) * i / n, py = r * .7 + (i % 2 ? -r * .2 : 0) + Math.sin(t * 4 + i) * r * .06;
    g.lineTo(px, py);
  }
  g.closePath(); g.fill(); g.stroke();
  for (const s of [-1, 1]) { g.fillStyle = '#26203a'; ellipse(g, s * r * .32, -r * .15, r * .12, r * .17); g.fill(); }
  g.fillStyle = '#26203a'; ellipse(g, 0, r * .25, r * .15, r * .12 + Math.sin(t * 3) * r * .03); g.fill();
  g.fillStyle = 'rgba(255,120,160,.4)'; for (const s of [-1, 1]) { ellipse(g, s * r * .55, r * .08, r * .12, r * .07); g.fill(); }
  g.restore();
}

// Stern-Form
function sternPfad(g, x, y, ra, ri, n = 5, start = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = start + i * Math.PI / n, rr = i % 2 ? ri : ra;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
function zeichneStern(g, x, y, r, rot = 0) {
  sternPfad(g, x, y, r, r * .5, 5, -Math.PI / 2 + rot);
  const gr = g.createRadialGradient(x - r * .3, y - r * .35, r * .05, x, y, r);
  gr.addColorStop(0, '#fffbe0'); gr.addColorStop(.5, '#ffd84a'); gr.addColorStop(1, '#f0a10a');
  g.fillStyle = gr; g.fill(); g.strokeStyle = '#b36a00'; g.lineWidth = Math.max(1, r * .1); g.lineJoin = 'round'; g.stroke();
}
function zeichneMuenze(g, x, y, r, dreh = 0) {
  const sx = Math.abs(Math.cos(dreh)) * .85 + .15;
  g.save(); g.translate(x, y); g.scale(sx, 1);
  const gr = g.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
  gr.addColorStop(0, '#fff6b0'); gr.addColorStop(.6, '#ffc61a'); gr.addColorStop(1, '#d88a00');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#a86400'; g.lineWidth = Math.max(1, r * .12); g.stroke();
  g.strokeStyle = 'rgba(168,100,0,.6)'; g.lineWidth = Math.max(1, r * .14);
  g.beginPath(); g.moveTo(0, -r * .45); g.lineTo(0, r * .45); g.stroke();
  g.restore();
}

// Figur als Bild für HTML (Auswahl, Anzeigen). Wird zwischengespeichert.
const _figurBilder = {};
function figurBild(idx, groesse = 96, emo = 'normal') {
  const key = idx + ':' + groesse + ':' + emo;
  if (_figurBilder[key]) return _figurBilder[key];
  const c = document.createElement('canvas');
  const s = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(groesse * s);
  const g = c.getContext('2d'); g.scale(s, s);
  zeichneFigur(g, idx, groesse / 2, groesse * .93, groesse * .3, { t: 1.5, emo, schatten: false });
  return (_figurBilder[key] = c.toDataURL());
}
