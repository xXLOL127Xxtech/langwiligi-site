'use strict';
// =====================================================================
//  Figuren, Gegner, Gegenstände – alles als Vektorgrafik gezeichnet
// =====================================================================
const CHARS = [
  { id: 'flitz', name: 'Flitz', color: '#4f8ff7', dark: '#2456b8', light: '#a9c9ff', belly: '#e8f1ff', acc: 'ohren',
    speed: 1.12, jump: 1.0, special: 'dash', spName: 'Sprint',
    desc: 'Der Schnellste. Spezial: blitzschneller Sprint, auch mitten im Sprung.' },
  { id: 'rumpel', name: 'Rumpel', color: '#ef5350', dark: '#a8262a', light: '#ffb0a8', belly: '#ffe9e0', acc: 'hoerner',
    speed: 0.97, jump: 0.98, special: 'ramm', spName: 'Rammstoss',
    desc: 'Stark wie ein Stier. Spezial: Rammstoss zerschmettert Blöcke und Gegner.' },
  { id: 'hops', name: 'Hops', color: '#3fbf5a', dark: '#1f7a35', light: '#a6f0a8', belly: '#f0ffe0', acc: 'blatt',
    speed: 1.0, jump: 1.08, special: 'zunge', spName: 'Zunge',
    desc: 'Springt am höchsten und doppelt. Spezial: Zunge schnappt Gegner und Münzen.' },
  { id: 'schwebi', name: 'Schwebi', color: '#ffc531', dark: '#c47a0a', light: '#fff0a0', belly: '#fffbe8', acc: 'fuehler',
    speed: 1.0, jump: 1.0, special: 'schweben', spName: 'Schweben',
    desc: 'Leicht wie eine Feder. Spezial: Taste halten und durch die Luft schweben.' },
];
const PLAYER_TAG = ['P1', 'P2', 'P3', 'P4'];

function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function radial(g, x, y, r, c0, c1, c2) {
  const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1);
  gr.addColorStop(0, c0); gr.addColorStop(.55, c1); gr.addColorStop(1, c2 || c1);
  return gr;
}

// ---------------------------------------------------------------------
//  Held  (o: x, y = Füsse, s = Grösse, face, t, walk, state, power, ...)
// ---------------------------------------------------------------------
function drawHero(g, ch, o) {
  const st = o.state || 'stand';
  const moving = st === 'run' ? Math.min(1, o.speed || 1) : 0;
  const ph = o.walk || 0;
  g.save();
  g.translate(o.x, o.y);
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  g.scale(o.s * (o.sx || 1), o.s * (o.sy || 1));
  if (o.rot) { g.translate(0, -34); g.rotate(o.rot); g.translate(0, 34); }
  g.scale(o.face || 1, 1);
  const fire = o.power === 2, wing = o.power === 3;
  const main = ch.color, dark = ch.dark, light = ch.light;
  const belly = fire ? '#ffd9a8' : ch.belly;
  const bob = moving ? Math.abs(Math.sin(ph)) * -3 : (st === 'stand' ? Math.sin(o.t * 2.4) * 1.2 : 0);

  if (o.star) {   // Sternenkraft: Regenbogen-Schein
    const hue = (o.t * 400) % 360;
    const gl = g.createRadialGradient(0, -34, 10, 0, -34, 62);
    gl.addColorStop(0, `hsla(${hue},100%,70%,.55)`); gl.addColorStop(1, `hsla(${(hue + 90) % 360},100%,60%,0)`);
    g.fillStyle = gl; g.beginPath(); g.arc(0, -34, 62, 0, TAU); g.fill();
  }
  if (fire) {
    const gl = g.createRadialGradient(0, -34, 14, 0, -34, 54);
    gl.addColorStop(0, 'rgba(255,150,40,.32)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, -34, 54, 0, TAU); g.fill();
  }
  // Schatten-Kontur für bessere Lesbarkeit
  const flap = (st === 'float' || (wing && st === 'fall')) ? Math.sin(o.t * 28) : Math.sin(o.t * 4) * .3;
  // Flügel hinten
  if (wing || ch.acc === 'fuehler') {
    const big = wing ? 1.25 : .8;
    g.save(); g.translate(-10, -30 + bob);
    for (const k of [0, 1]) {
      g.save(); g.rotate(-.5 - flap * .45 - k * .25); g.scale(big, big);
      g.fillStyle = wing ? (k ? '#dfe9ff' : '#ffffff') : (k ? 'rgba(200,240,255,.55)' : 'rgba(230,250,255,.75)');
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-26, -24, -34, -6); g.quadraticCurveTo(-24, 6, 0, 4); g.fill();
      if (wing) { g.strokeStyle = 'rgba(140,160,210,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-26, -8); g.moveTo(-6, 2); g.lineTo(-22, 2); g.stroke(); }
      g.restore();
    }
    g.restore();
  }
  // Füsse
  let fL = [-9, -5], fR = [9, -5];
  if (st === 'run') { fL = [-8 + Math.sin(ph) * 8, -5 - Math.max(0, Math.cos(ph)) * 6]; fR = [8 - Math.sin(ph) * 8, -5 - Math.max(0, -Math.cos(ph)) * 6]; }
  else if (st === 'jump' || st === 'float') { fL = [-10, -9]; fR = [8, -3]; }
  else if (st === 'fall') { fL = [-9, -4]; fR = [10, -7]; }
  else if (st === 'pound') { fL = [-7, -14]; fR = [7, -14]; }
  else if (st === 'wall') { fL = [-6, -6]; fR = [12, -12]; }
  else if (st === 'dash') { fL = [-14, -8]; fR = [-4, -6]; }
  const shoe = fire ? '#e0461e' : dark;
  for (const [fx, fy] of [fL, fR]) {
    g.fillStyle = shoe; ell(g, fx + 2, fy, 9, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; ell(g, fx + 1, fy - 2.5, 4.5, 2); g.fill();
  }
  // Körper
  g.fillStyle = radial(g, 0, -24 + bob, 18, light, main, dark);
  ell(g, 0, -24 + bob, 16, 17); g.fill();
  g.fillStyle = belly; ell(g, 3, -21 + bob, 9.5, 11); g.fill();
  if (fire) {   // Flammen-Abzeichen
    g.fillStyle = '#ff6a1a';
    g.beginPath(); g.moveTo(3, -14 + bob); g.quadraticCurveTo(-4, -20 + bob, 2, -30 + bob); g.quadraticCurveTo(4, -24 + bob, 7, -27 + bob); g.quadraticCurveTo(11, -19 + bob, 3, -14 + bob); g.fill();
    g.fillStyle = '#ffd23a'; ell(g, 3.5, -18 + bob, 2.5, 3.5); g.fill();
  }
  // Arme
  let aB = [-13, -27], aF = [14, -25];
  if (st === 'run') { aB = [-13 - Math.sin(ph) * 5, -27 + Math.cos(ph) * 2]; aF = [13 + Math.sin(ph) * 5, -26 - Math.cos(ph) * 2]; }
  else if (st === 'jump') { aB = [-15, -40]; aF = [15, -42]; }
  else if (st === 'float') { aB = [-18, -34 + flap * 3]; aF = [18, -34 - flap * 3]; }
  else if (st === 'dash') { aB = [-17, -28]; aF = [18, -30]; }
  else if (st === 'goal') { aB = [-16, -44]; aF = [16, -46]; }
  g.fillStyle = main;
  ell(g, aB[0], aB[1] + bob, 6, 6.5); g.fill();
  // Kopf
  const hx = 2, hy = -48 + bob;
  // Zubehör hinten
  if (ch.acc === 'ohren') {
    for (const [ex, rot] of [[-10, -.45], [8, .25]]) {
      g.save(); g.translate(hx + ex, hy - 12); g.rotate(rot);
      g.fillStyle = main; g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(-3, -22, 2, -20); g.quadraticCurveTo(8, -10, 8, 4); g.fill();
      g.fillStyle = light; g.beginPath(); g.moveTo(-4, 2); g.quadraticCurveTo(-1, -14, 2, -13); g.quadraticCurveTo(4, -6, 4, 2); g.fill();
      g.restore();
    }
  } else if (ch.acc === 'hoerner') {
    for (const [ex, dir] of [[-12, -1], [12, 1]]) {
      g.fillStyle = '#fff3d6';
      g.beginPath(); g.moveTo(hx + ex - 4, hy - 10); g.quadraticCurveTo(hx + ex + dir * 10, hy - 16, hx + ex + dir * 9, hy - 26); g.quadraticCurveTo(hx + ex + dir * 2, hy - 18, hx + ex + 5 * -dir * -1, hy - 8); g.fill();
      g.strokeStyle = 'rgba(160,120,80,.5)'; g.lineWidth = 1.2; g.stroke();
    }
  } else if (ch.acc === 'fuehler') {
    g.strokeStyle = dark; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const ex of [-6, 8]) {
      const sw = Math.sin(o.t * 5 + ex) * 3;
      g.beginPath(); g.moveTo(hx + ex, hy - 16); g.quadraticCurveTo(hx + ex + 4, hy - 28, hx + ex + 6 + sw, hy - 34); g.stroke();
      g.fillStyle = '#fff7b0'; g.beginPath(); g.arc(hx + ex + 6 + sw, hy - 34, 4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,120,.4)'; g.beginPath(); g.arc(hx + ex + 6 + sw, hy - 34, 8, 0, TAU); g.fill();
    }
  }
  g.fillStyle = radial(g, hx, hy, 20, light, main, dark);
  g.beginPath(); g.arc(hx, hy, 19.5, 0, TAU); g.fill();
  // Wangen / Gesicht
  const look = clamp(o.look || 0, -1, 1);
  const eyeY = hy - 1;
  const blink = o.blink ? .12 : 1;
  const eyes = ch.acc === 'blatt' ? [[hx + 1, hy - 13], [hx + 13, hy - 12]] : [[hx + 2, eyeY], [hx + 12, eyeY]];
  if (ch.acc === 'blatt') {   // Froschaugen oben auf dem Kopf
    for (const [ex, ey] of eyes) { g.fillStyle = main; g.beginPath(); g.arc(ex, ey + 2, 8.5, 0, TAU); g.fill(); }
  }
  for (const [ex, ey] of eyes) {
    g.fillStyle = '#ffffff'; ell(g, ex, ey, 5.6, 7.2 * blink); g.fill();
    if (blink > .5) {
      if (st === 'dead') {
        g.strokeStyle = '#1a1a2a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(ex - 3, ey - 3); g.lineTo(ex + 3, ey + 3); g.moveTo(ex + 3, ey - 3); g.lineTo(ex - 3, ey + 3); g.stroke();
      } else {
        g.fillStyle = '#1b1b2e'; ell(g, ex + 1.6 + look, ey + .5, 3, 4.2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + 2.6 + look, ey - 1.5, 1.4, 0, TAU); g.fill();
      }
    }
  }
  if (ch.acc === 'hoerner') {   // buschige Brauen
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(hx - 3, eyeY - 10); g.lineTo(hx + 7, eyeY - 8); g.lineTo(hx + 6, eyeY - 5.5); g.lineTo(hx - 3, eyeY - 7); g.fill();
    g.beginPath(); g.moveTo(hx + 8, eyeY - 8); g.lineTo(hx + 17, eyeY - 10); g.lineTo(hx + 17, eyeY - 7); g.lineTo(hx + 9, eyeY - 5.5); g.fill();
  }
  g.fillStyle = 'rgba(255,120,140,.45)'; ell(g, hx + 15, hy + 7, 4, 2.6); g.fill(); ell(g, hx - 3, hy + 7, 3.4, 2.4); g.fill();
  // Mund
  g.strokeStyle = '#3a1a24'; g.lineWidth = 1.8; g.lineCap = 'round';
  if (st === 'jump' || st === 'pound' || st === 'dead' || st === 'goal') {
    g.fillStyle = '#7a1e2e'; ell(g, hx + 9, hy + 9, 3.5, st === 'dead' ? 2 : 4); g.fill();
  } else if (ch.acc === 'blatt') {
    g.beginPath(); g.moveTo(hx, hy + 6); g.quadraticCurveTo(hx + 8, hy + 12, hx + 17, hy + 5); g.stroke();
  } else {
    g.beginPath(); g.arc(hx + 8, hy + 5, 4.5, .2, Math.PI - .4); g.stroke();
  }
  // Zubehör vorne
  if (ch.acc === 'ohren') {   // Stirnband mit flatternden Enden
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(hx - 19, hy - 7); g.quadraticCurveTo(hx, hy - 14, hx + 19, hy - 9); g.lineTo(hx + 19, hy - 4); g.quadraticCurveTo(hx, hy - 9, hx - 19, hy - 2); g.fill();
    const wv = Math.sin(o.t * 14) * 3 * (st === 'run' || st === 'dash' ? 1.6 : .5);
    g.beginPath(); g.moveTo(hx - 18, hy - 6); g.quadraticCurveTo(hx - 28, hy - 10 + wv, hx - 36, hy - 4 - wv); g.lineTo(hx - 34, hy); g.quadraticCurveTo(hx - 26, hy - 4 - wv, hx - 18, hy - 2); g.fill();
    g.fillStyle = '#ff5a6e'; ell(g, hx - 18, hy - 4, 3, 3.5); g.fill();
  } else if (ch.acc === 'blatt') {
    g.save(); g.translate(hx - 4, hy - 18); g.rotate(-.3 + Math.sin(o.t * 3) * .1);
    g.strokeStyle = '#2f7a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.stroke();
    g.fillStyle = '#7ee05a'; g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(-12, -14, -16, -6); g.quadraticCurveTo(-8, -2, 0, -7); g.fill();
    g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(10, -18, 15, -11); g.quadraticCurveTo(8, -5, 0, -7); g.fill();
    g.restore();
  } else if (ch.acc === 'fuehler') {
    g.fillStyle = '#ff7aa8';   // Halstuch
    g.beginPath(); g.moveTo(hx - 14, hy + 13); g.quadraticCurveTo(hx, hy + 22, hx + 14, hy + 13); g.lineTo(hx + 10, hy + 19); g.quadraticCurveTo(hx, hy + 25, hx - 10, hy + 19); g.fill();
  }
  if (fire) {   // kleine Flamme auf dem Kopf
    const f = Math.sin(o.t * 16) * 2;
    g.fillStyle = '#ff7a1a';
    g.beginPath(); g.moveTo(hx - 6, hy - 17); g.quadraticCurveTo(hx - 6, hy - 28, hx + f, hy - 36); g.quadraticCurveTo(hx + 8, hy - 26, hx + 7, hy - 17); g.fill();
    g.fillStyle = '#ffe07a'; g.beginPath(); g.moveTo(hx - 2, hy - 17); g.quadraticCurveTo(hx - 2, hy - 23, hx + f * .6, hy - 28); g.quadraticCurveTo(hx + 4, hy - 22, hx + 3, hy - 17); g.fill();
  }
  // vorderer Arm
  g.fillStyle = main; ell(g, aF[0], aF[1] + bob, 6.2, 6.6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, aF[0] - 1.5, aF[1] - 2 + bob, 2.5, 2); g.fill();
  g.restore();
}

// Kopf allein (für Anzeigen)
function drawHeroIcon(g, ch, x, y, s, t = 0) {
  drawHero(g, ch, { x, y: y + 40 * s, s, face: 1, t, state: 'stand', power: 1 });
}

// ---------------------------------------------------------------------
//  Gegner
// ---------------------------------------------------------------------
function drawEnemy(g, e, t) {
  g.save();
  g.translate(e.x, e.y);
  const dir = e.dir || 1;
  if (e.dead === 'flip') { g.translate(0, -18); g.rotate(Math.PI); g.translate(0, 18); }
  switch (e.kind) {
    case 'kaefer': {
      if (e.squash) {
        g.fillStyle = '#5a2a6a'; ell(g, 0, -6, 24, 7); g.fill();
        g.fillStyle = '#fff'; ell(g, 6 * dir, -8, 3, 1.5); g.fill(); ell(g, 13 * dir, -8, 3, 1.5); g.fill();
        break;
      }
      const w = e.walk || 0;
      g.strokeStyle = '#2a1430'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const lx = -12 + i * 12, sw = Math.sin(w + i * 2) * 4;
        g.beginPath(); g.moveTo(lx, -8); g.lineTo(lx + sw - 3, 0); g.stroke();
      }
      g.scale(dir, 1);
      g.fillStyle = radial(g, -2, -18, 22, '#c08ad8', '#7a3a9a', '#3d1650');
      ell(g, -2, -17, 22, 16); g.fill();
      g.strokeStyle = 'rgba(30,0,40,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-2, -32); g.lineTo(-2, -3); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, -10, -25, 7, 4, -.4); g.fill();
      g.fillStyle = '#3d1650'; g.beginPath(); g.arc(17, -12, 11, 0, TAU); g.fill();
      g.fillStyle = '#fff'; ell(g, 19, -15, 3.8, 4.8); g.fill(); ell(g, 27, -14, 3.2, 4.4); g.fill();
      g.fillStyle = '#1b0b1e'; ell(g, 20.5, -14, 2, 3); g.fill(); ell(g, 28, -13, 1.8, 2.8); g.fill();
      g.strokeStyle = '#1b0b1e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(15, -21); g.lineTo(22, -19); g.moveTo(25, -19); g.lineTo(30, -20); g.stroke();
      g.strokeStyle = '#3d1650'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(16, -22); g.quadraticCurveTo(18, -32, 24, -34); g.stroke();
      break;
    }
    case 'schnecke': {
      if (e.shell) { drawShell(g, e, t); break; }
      g.scale(dir, 1);
      const w = Math.sin((e.walk || 0) * 1.5) * 2;
      g.fillStyle = radial(g, 8, -10, 26, '#b8f08a', '#6cc048', '#3a8a2a');
      g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-26, -10, -12, -10); g.lineTo(14, -10 + w * .3);
      g.quadraticCurveTo(20, -14, 18, -28); g.quadraticCurveTo(26, -34, 30, -22); g.quadraticCurveTo(32, -6, 26, 0); g.closePath(); g.fill();
      g.strokeStyle = '#3a8a2a'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(22, -30); g.lineTo(20 + w, -42); g.moveTo(27, -29); g.lineTo(30 + w, -40); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(20 + w, -43, 4.5, 0, TAU); g.arc(30 + w, -41, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#1b1b2e'; g.beginPath(); g.arc(21.5 + w, -43, 2.2, 0, TAU); g.arc(31.5 + w, -41, 2.2, 0, TAU); g.fill();
      g.strokeStyle = '#2a5a1a'; g.lineWidth = 1.6; g.beginPath(); g.arc(26, -20, 3.5, .3, Math.PI - .3); g.stroke();
      drawShellShape(g, -6, -22, 18, 0);
      break;
    }
    case 'igel': {
      g.scale(dir, 1);
      const w = e.walk || 0;
      g.fillStyle = '#5a3a22';
      for (const lx of [-10, 8]) { ell(g, lx + Math.sin(w + lx) * 3, -3, 6, 4); g.fill(); }
      // Stacheln
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + .15 + i * (Math.PI - .3) / 8;
        const bx = -2 + Math.cos(a) * 18, by = -16 + Math.sin(a) * 15;
        const tx = -2 + Math.cos(a) * 32, ty = -16 + Math.sin(a) * 28;
        g.fillStyle = '#4a2c18';
        g.beginPath(); g.moveTo(bx - Math.sin(a) * 6, by + Math.cos(a) * 6); g.lineTo(tx, ty); g.lineTo(bx + Math.sin(a) * 6, by - Math.cos(a) * 6); g.fill();
        g.fillStyle = '#f2e0c0'; g.beginPath(); g.arc(tx, ty, 2, 0, TAU); g.fill();
      }
      g.fillStyle = radial(g, -2, -16, 20, '#b07a4a', '#7a4a28', '#4a2c18');
      ell(g, -2, -14, 20, 14); g.fill();
      g.fillStyle = '#f0d0a0'; ell(g, 14, -10, 10, 8); g.fill();
      g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(23, -11, 3, 0, TAU); g.fill();
      g.fillStyle = '#1b1b2e'; ell(g, 11, -17, 2.4, 3.2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(11.8, -18.2, 1, 0, TAU); g.fill();
      break;
    }
    case 'hummel': {
      g.scale(dir, 1);
      const flap = Math.sin(t * 40);
      g.fillStyle = 'rgba(230,245,255,.75)';
      ell(g, -4, -34, 10, 16 * (.5 + Math.abs(flap) * .5), -.4); g.fill();
      ell(g, 6, -34, 9, 14 * (.5 + Math.abs(flap) * .5), .3); g.fill();
      g.save();
      ell(g, 0, -18, 21, 16); g.clip();
      g.fillStyle = radial(g, 0, -18, 22, '#fff2a0', '#ffc61a', '#d88a00'); g.fillRect(-22, -36, 44, 36);
      g.fillStyle = '#2a2030'; g.fillRect(-10, -36, 7, 36); g.fillRect(2, -36, 6, 36);
      g.restore();
      g.fillStyle = '#2a2030'; g.beginPath(); g.moveTo(-20, -18); g.lineTo(-30, -15); g.lineTo(-20, -12); g.fill();
      g.fillStyle = '#fff'; ell(g, 13, -22, 4.5, 5.5); g.fill();
      g.fillStyle = '#1b1b2e'; ell(g, 14.5, -21.5, 2.4, 3.4); g.fill();
      g.strokeStyle = '#2a2030'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, -28); g.lineTo(17, -26); g.stroke();
      g.beginPath(); g.moveTo(14, -32); g.quadraticCurveTo(18, -42, 24, -42); g.stroke();
      break;
    }
    case 'lavaball': {
      const up = (e.vy || 0) < 0;
      g.save(); if (!up) g.scale(1, -1), g.translate(0, 36);
      const fl = Math.sin(t * 20) * 3;
      g.fillStyle = 'rgba(255,120,30,.5)';
      g.beginPath(); g.moveTo(-14, -16); g.quadraticCurveTo(-8 + fl, 12, 0, 22); g.quadraticCurveTo(8 - fl, 12, 14, -16); g.fill();
      g.restore();
      const gl = g.createRadialGradient(0, -18, 4, 0, -18, 34);
      gl.addColorStop(0, 'rgba(255,200,80,.6)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, -18, 34, 0, TAU); g.fill();
      g.fillStyle = radial(g, 0, -18, 18, '#fff6b0', '#ffa21a', '#d0300a');
      g.beginPath(); g.arc(0, -18, 17, 0, TAU); g.fill();
      g.fillStyle = '#5a0a00'; ell(g, -6, -20, 2.5, 4); g.fill(); ell(g, 6, -20, 2.5, 4); g.fill();
      break;
    }
    case 'crusher': {
      const w = e.w, h = e.h;
      g.translate(0, -h);
      const grd = g.createLinearGradient(-w / 2, 0, w / 2, h);
      grd.addColorStop(0, '#9a96a8'); grd.addColorStop(1, '#4a4656');
      g.fillStyle = grd; rr(g, -w / 2, 0, w, h, 14); g.fill();
      g.fillStyle = 'rgba(255,255,255,.15)'; rr(g, -w / 2 + 6, 5, w - 12, 8, 4); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-w / 2 + 10, 14); g.lineTo(-w / 2 + 20, 30); g.lineTo(-w / 2 + 14, 44); g.moveTo(w / 2 - 12, h - 30); g.lineTo(w / 2 - 22, h - 18); g.stroke();
      const angry = e.state === 'fall' || e.state === 'wait';
      g.fillStyle = '#fff'; ell(g, -18, h / 2 - 6, 10, angry ? 6 : 9); g.fill(); ell(g, 18, h / 2 - 6, 10, angry ? 6 : 9); g.fill();
      g.fillStyle = '#1b1b2e'; g.beginPath(); g.arc(-16, h / 2 - 5, 4.5, 0, TAU); g.arc(16, h / 2 - 5, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#3a3646';
      g.beginPath(); g.moveTo(-32, h / 2 - 22); g.lineTo(-8, h / 2 - 12); g.lineTo(-8, h / 2 - 16); g.lineTo(-30, h / 2 - 26); g.fill();
      g.beginPath(); g.moveTo(32, h / 2 - 22); g.lineTo(8, h / 2 - 12); g.lineTo(8, h / 2 - 16); g.lineTo(30, h / 2 - 26); g.fill();
      g.fillStyle = '#fff'; rr(g, -18, h / 2 + 14, 36, 12, 4); g.fill();
      g.strokeStyle = '#3a3646'; g.lineWidth = 2; g.beginPath();
      for (let i = -12; i <= 12; i += 8) { g.moveTo(i, h / 2 + 14); g.lineTo(i, h / 2 + 26); } g.stroke();
      break;
    }
  }
  g.restore();
}
function drawShellShape(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = radial(g, 0, 0, r, '#ffd08a', '#f07a2a', '#9a3a10');
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#7a2a08'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < 4.6 * Math.PI; a += .2) { const rr2 = r * .9 * (1 - a / (5 * Math.PI)); const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, -r * .35, -r * .45, r * .35, r * .2, -.5); g.fill();
  g.restore();
}
function drawShell(g, e, t) {
  const rot = e.vx ? (e.spin || 0) : 0;
  const peek = e.wake > 0 && e.wake < 1.6 && !e.vx;
  if (peek) {
    g.fillStyle = '#6cc048';
    const sh = Math.sin(t * 30) * 2;
    ell(g, sh, -4, 16, 5); g.fill();
  }
  drawShellShape(g, 0, -17, 17, rot);
}

// Boss: der Magma-Koloss
function drawBoss(g, b, t) {
  g.save();
  g.translate(b.x, b.y);
  g.scale(b.dir, 1);
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
  const sq = b.squash || 0;
  g.scale(1 + sq * .2, 1 - sq * .25);
  const step = Math.sin(b.walk || 0);
  // Beine
  g.fillStyle = '#3a2a2e';
  ell(g, -28, -14 - Math.max(0, step) * 8, 22, 16); g.fill();
  ell(g, 28, -14 - Math.max(0, -step) * 8, 22, 16); g.fill();
  // Körper
  const body = g.createRadialGradient(-20, -110, 10, 0, -80, 90);
  body.addColorStop(0, hurt ? '#ffffff' : '#7a6a72'); body.addColorStop(.6, hurt ? '#ffd0d0' : '#4a3a42'); body.addColorStop(1, '#241a20');
  g.fillStyle = body; ell(g, 0, -78, 72, 66); g.fill();
  // Glühende Risse
  const glow = .6 + Math.sin(t * 5) * .3;
  g.strokeStyle = `rgba(255,${120 + glow * 80},40,${.7 + glow * .3})`; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-40, -40); g.lineTo(-24, -60); g.lineTo(-34, -84); g.moveTo(10, -26); g.lineTo(26, -48); g.lineTo(18, -70); g.lineTo(34, -96); g.moveTo(-6, -120); g.lineTo(4, -132); g.stroke();
  // Bauch-Glut
  const bg = g.createRadialGradient(10, -60, 4, 10, -60, 34);
  bg.addColorStop(0, 'rgba(255,220,120,.9)'); bg.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = bg; ell(g, 10, -60, 34, 30); g.fill();
  // Arme
  const arm = b.state === 'throw' ? -1 : Math.sin(t * 3) * .3;
  g.fillStyle = '#4a3a42';
  g.save(); g.translate(56, -80); g.rotate(arm); ell(g, 14, 10, 22, 20); g.fill(); g.restore();
  // Gesicht
  g.fillStyle = '#ffdf6a'; ell(g, 18, -104, 11, b.angry ? 7 : 10); g.fill(); ell(g, 46, -100, 10, b.angry ? 6 : 9); g.fill();
  g.fillStyle = '#5a0a00'; g.beginPath(); g.arc(21, -103, 4.5, 0, TAU); g.arc(48, -99, 4, 0, TAU); g.fill();
  g.fillStyle = '#241a20';
  g.beginPath(); g.moveTo(4, -122); g.lineTo(30, -110); g.lineTo(30, -116); g.lineTo(6, -128); g.fill();
  g.beginPath(); g.moveTo(58, -116); g.lineTo(36, -108); g.lineTo(36, -114); g.lineTo(56, -122); g.fill();
  g.fillStyle = '#2a0a08'; rr(g, 16, -84, 34, 12, 5); g.fill();
  g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(19 + i * 8, -84); g.lineTo(23 + i * 8, -78); g.lineTo(27 + i * 8, -84); g.fill(); }
  // Krone
  g.fillStyle = '#ffcc33';
  g.beginPath(); g.moveTo(-26, -138); g.lineTo(-30, -164); g.lineTo(-14, -150); g.lineTo(-2, -172); g.lineTo(10, -150); g.lineTo(26, -164); g.lineTo(22, -138); g.closePath(); g.fill();
  g.fillStyle = '#ff4a6a'; g.beginPath(); g.arc(-2, -150, 4, 0, TAU); g.fill();
  g.restore();
}

// ---------------------------------------------------------------------
//  Gegenstände
// ---------------------------------------------------------------------
function drawItem(g, it, t) {
  g.save();
  g.translate(it.x, it.y);
  const bob = it.kind === 'feder' ? 0 : 0;
  switch (it.kind) {
    case 'beere': {
      g.fillStyle = radial(g, 0, -18, 18, '#ff9ad0', '#e0287a', '#8a0a44');
      g.beginPath(); g.arc(0, -17, 17, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)';
      for (const [dx, dy] of [[-7, -20], [3, -24], [8, -14], [-3, -10], [-9, -12], [6, -28]]) { g.beginPath(); g.arc(dx, dy, 3.5, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.75)'; ell(g, -6, -26, 5, 3, -.5); g.fill();
      g.fillStyle = '#4fbf3a';
      for (let i = 0; i < 4; i++) { g.save(); g.translate(0, -33); g.rotate(-1.2 + i * .8); ell(g, 0, -5, 3.5, 7); g.fill(); g.restore(); }
      break;
    }
    case 'bluete': {
      g.strokeStyle = '#2f9a3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -18); g.stroke();
      g.fillStyle = '#4fbf3a'; ell(g, -8, -6, 8, 4, -.4); g.fill(); ell(g, 8, -8, 8, 4, .4); g.fill();
      const fl = Math.sin(t * 10) * .1;
      for (let i = 0; i < 6; i++) {
        g.save(); g.translate(0, -28); g.rotate(i * TAU / 6 + fl);
        g.fillStyle = i % 2 ? '#ff7a1a' : '#ffb02a';
        g.beginPath(); g.moveTo(-6, -4); g.quadraticCurveTo(-5, -16, 0, -20); g.quadraticCurveTo(5, -16, 6, -4); g.fill();
        g.restore();
      }
      g.fillStyle = radial(g, 0, -28, 9, '#ffffff', '#fff07a', '#ffb02a'); g.beginPath(); g.arc(0, -28, 8, 0, TAU); g.fill();
      break;
    }
    case 'feder': {
      g.translate(0, -20); g.rotate(Math.sin(t * 4) * .25);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(-4, 18); g.quadraticCurveTo(-18, -2, 2, -22); g.quadraticCurveTo(14, -4, -4, 18); g.fill();
      g.fillStyle = '#cfe0ff';
      g.beginPath(); g.moveTo(-4, 18); g.quadraticCurveTo(8, 0, 2, -22); g.quadraticCurveTo(14, -4, -4, 18); g.fill();
      g.strokeStyle = '#e0a020'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-6, 22); g.quadraticCurveTo(0, 0, 2, -20); g.stroke();
      break;
    }
    case 'stern': {
      g.translate(0, -18); g.rotate(Math.sin(t * 6) * .2);
      const hue = (t * 300) % 360;
      const gl = g.createRadialGradient(0, 0, 4, 0, 0, 34);
      gl.addColorStop(0, `hsla(${hue},100%,75%,.6)`); gl.addColorStop(1, 'hsla(0,0%,100%,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
      starPath(g, 0, 0, 19, 9);
      g.fillStyle = radial(g, 0, 0, 19, '#fffbe0', '#ffd23a', '#ff9a1a'); g.fill();
      g.strokeStyle = '#d8781a'; g.lineWidth = 2; g.stroke();
      break;
    }
    case 'herz': {
      g.translate(0, -18);
      g.fillStyle = radial(g, 0, 0, 18, '#c0ffd0', '#3fd07a', '#1a8a4a');
      g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-26, -2, -14, -24, 0, -10); g.bezierCurveTo(14, -24, 26, -2, 0, 14); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, -8, -8, 4, 3, -.6); g.fill();
      break;
    }
  }
  g.restore();
}
function starPath(g, x, y, r1, r2, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

// Münze: einmal fein vorgezeichnet, dann nur noch gestaucht gezeichnet (dreht sich)
let coinSprite = null;
function getCoinSprite() {
  if (coinSprite) return coinSprite;
  const S = 64, r = 26, c = document.createElement('canvas');
  c.width = S; c.height = S * 1.2;
  const g = c.getContext('2d');
  g.translate(S / 2, S * .6);
  g.fillStyle = '#d08a08'; ell(g, 0, 0, r, r * 1.18); g.fill();
  g.fillStyle = radial(g, 0, 0, r, '#fff6b8', '#ffd23a', '#f0a810'); ell(g, 0, 0, r - 4.4, r * 1.18 - 4.4); g.fill();
  g.strokeStyle = 'rgba(200,120,0,.55)'; g.lineWidth = 4; ell(g, 0, 0, r - 12, r * 1.18 - 12); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, -r * .3, -r * .45, r * .2, r * .35, .3); g.fill();
  coinSprite = c; return c;
}
function drawCoin(g, x, y, t, r = 13) {
  const sx = Math.cos(t * 3.2 + x * .013);
  const w = Math.max(.12, Math.abs(sx));
  const sp = getCoinSprite(), k = r / 26;
  g.drawImage(sp, x - 32 * k * w, y - 38.4 * k, 64 * k * w, 76.8 * k);
}
function drawStarCoin(g, x, y, t, got, noGlow) {
  const sx = Math.cos(t * 2.4);
  g.save(); g.translate(x, y);
  if (!got && !noGlow) {
    const gl = g.createRadialGradient(0, 0, 10, 0, 0, 44);
    gl.addColorStop(0, 'rgba(255,230,120,.5)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill();
  }
  g.scale(Math.max(.1, Math.abs(sx)), 1);
  g.globalAlpha *= got ? .35 : 1;
  g.fillStyle = '#c47e00'; g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
  g.fillStyle = radial(g, 0, 0, 23, '#fff6b8', '#ffd23a', '#e89a10'); g.beginPath(); g.arc(0, 0, 22.5, 0, TAU); g.fill();
  starPath(g, 0, 1, 14, 6.5);
  g.fillStyle = sx > 0 ? '#ffb01a' : '#e8960a'; g.fill();
  g.strokeStyle = 'rgba(160,90,0,.6)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, -9, -11, 4, 6, .4); g.fill();
  g.restore();
}

// Blöcke: Ziegel, Sternblock, leerer Block
function drawBlock(g, c, x, y, t, th) {
  if (c === TILE.B) {
    const [c1, c2] = th.brick;
    const grd = g.createLinearGradient(0, y, 0, y + T); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 6); g.fill();
    g.strokeStyle = 'rgba(60,20,0,.35)'; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x + 2, y + T / 2); g.lineTo(x + T - 2, y + T / 2);
    g.moveTo(x + T / 2, y + 2); g.lineTo(x + T / 2, y + T / 2);
    g.moveTo(x + T / 4, y + T / 2); g.lineTo(x + T / 4, y + T - 2);
    g.moveTo(x + T * .75, y + T / 2); g.lineTo(x + T * .75, y + T - 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, x + 4, y + 4, T - 8, 4, 2); g.fill();
  } else if (c === TILE.Q || c === TILE.H) {
    const pulse = .5 + .5 * Math.sin(t * 4 + x * .05);
    const grd = g.createLinearGradient(x, y, x, y + T);
    grd.addColorStop(0, '#fff09a'); grd.addColorStop(.45, '#ffc21a'); grd.addColorStop(1, '#d0800a');
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 8); g.fill();
    g.strokeStyle = '#a85a00'; g.lineWidth = 2; rr(g, x + 2, y + 2, T - 4, T - 4, 7); g.stroke();
    g.fillStyle = '#b86a00';
    for (const [dx, dy] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); }
    starPath(g, x + T / 2, y + T / 2 + 1, 13 + pulse * 1.5, 6);
    g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = 'rgba(180,90,0,.6)'; g.lineWidth = 1.5; g.stroke();
    // Glanz-Streifen
    const sh = ((t * .6 + x * .002) % 2.4);
    if (sh < 1) {
      g.save(); rr(g, x + 2, y + 2, T - 4, T - 4, 7); g.clip();
      g.fillStyle = 'rgba(255,255,255,.45)';
      const sx = x - 20 + sh * (T + 40);
      g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + 10, y); g.lineTo(sx - 6, y + T); g.lineTo(sx - 16, y + T); g.fill();
      g.restore();
    }
  } else if (c === TILE.U) {
    const grd = g.createLinearGradient(x, y, x, y + T);
    grd.addColorStop(0, '#c49a6a'); grd.addColorStop(1, '#7a5634');
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 8); g.fill();
    g.strokeStyle = 'rgba(60,30,10,.5)'; g.lineWidth = 2; rr(g, x + 2, y + 2, T - 4, T - 4, 7); g.stroke();
    g.fillStyle = '#5a3a1e';
    for (const [dx, dy] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); }
  }
}

// Bewegliche Plattform
function drawPlatform(g, p, th) {
  const x = p.x, y = p.y, w = p.w;
  const shake = p.mode === 'fall' && p.state === 'shake' ? Math.sin(p.t * 60) * 2 : 0;
  g.save(); g.translate(shake, 0);
  if (th.plat === 'wolke') {
    g.fillStyle = 'rgba(150,180,230,.35)'; ell(g, x + w / 2, y + 22, w / 2 + 6, 9); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i <= w / 24; i++) g.arc(x + 12 + i * 24, y + 10 - (i % 2) * 4, 14, 0, TAU);
    g.fill(); ell(g, x + w / 2, y + 15, w / 2 + 4, 9); g.fill();
  } else {
    const cols = { holz: ['#e0a050', '#8c5222'], stein: ['#e8b77a', '#a8743f'], kristall: ['#a888ff', '#4e2fae'], eis: ['#c8eeff', '#5ea9d6'], gitter: ['#9a96a8', '#3d3a48'] }[th.plat];
    const grd = g.createLinearGradient(0, y, 0, y + 22); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]);
    g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, x + 4, y + 18, w - 8, 8, 4); g.fill();
    g.fillStyle = grd; rr(g, x, y, w, 22, 10); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, x + 6, y + 3, w - 12, 4, 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < w / T; i++) g.fillRect(x + i * T - 1, y + 6, 2, 12);
    if (p.mode === 'fall') { g.fillStyle = '#ff6a4a'; g.beginPath(); g.arc(x + w / 2, y + 12, 4, 0, TAU); g.fill(); }
  }
  g.restore();
}

function drawSpring(g, s) {
  const c = s.comp || 0;
  const h = 34 - c * 16;
  g.save(); g.translate(s.x, s.y);
  g.fillStyle = '#4a4a5a'; rr(g, -20, -8, 40, 8, 3); g.fill();
  g.strokeStyle = '#c0c4d4'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath();
  const n = 4;
  for (let i = 0; i <= n * 2; i++) { const yy = -8 - (h - 16) * i / (n * 2); const xx = i % 2 ? 13 : -13; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
  g.stroke();
  const grd = g.createLinearGradient(0, -h - 8, 0, -h + 4); grd.addColorStop(0, '#ff8a6a'); grd.addColorStop(1, '#c8301a');
  g.fillStyle = grd; rr(g, -22, -h - 6, 44, 12, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, -16, -h - 4, 32, 3, 2); g.fill();
  g.restore();
}

function drawCheckpoint(g, c, t) {
  g.save(); g.translate(c.x, c.y);
  g.fillStyle = '#5a5a6a'; rr(g, -16, -10, 32, 10, 4); g.fill();
  g.fillStyle = '#d8dce8'; rr(g, -3, -110, 6, 102, 3); g.fill();
  const col = c.on ? ['#ffd23a', '#ff9a1a'] : ['#b0b4c4', '#7a7e90'];
  const wv = Math.sin(t * 5) * 4;
  const grd = g.createLinearGradient(0, -108, 0, -70); grd.addColorStop(0, col[0]); grd.addColorStop(1, col[1]);
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(3, -108); g.quadraticCurveTo(24, -112 + wv, 46, -104 + wv); g.lineTo(46, -78 + wv); g.quadraticCurveTo(24, -86 + wv, 3, -80); g.closePath(); g.fill();
  starPath(g, 24, -93 + wv * .6, 8, 3.6);
  g.fillStyle = c.on ? '#ffffff' : 'rgba(255,255,255,.5)'; g.fill();
  g.fillStyle = c.on ? '#fff3a0' : '#cfd3e0'; g.beginPath(); g.arc(0, -112, 6, 0, TAU); g.fill();
  g.restore();
}

function drawGoal(g, z, t) {
  const top = z.top;
  g.save();
  g.fillStyle = '#5a5a6a'; rr(g, z.x - 24, z.y - 22, 48, 22, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, z.x - 20, z.y - 20, 40, 4, 2); g.fill();
  const grd = g.createLinearGradient(z.x - 5, 0, z.x + 5, 0); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#9aa0b8');
  g.fillStyle = grd; rr(g, z.x - 5, top, 10, z.y - 22 - top, 5); g.fill();
  // Leuchtkugel oben
  if (!z.taken) {
    const by = top - 14 + Math.sin(t * 3) * 4;
    const gl = g.createRadialGradient(z.x, by, 4, z.x, by, 50);
    gl.addColorStop(0, 'rgba(255,240,150,.7)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(z.x, by, 50, 0, TAU); g.fill();
    g.save(); g.translate(z.x, by); g.rotate(t * .8);
    starPath(g, 0, 0, 20, 9);
    g.fillStyle = radial(g, 0, 0, 20, '#ffffff', '#ffe066', '#ffaa1a'); g.fill();
    g.restore();
  }
  // Wimpel, der am Mast hängt
  const fy = z.flagY !== undefined ? z.flagY : top + 10;
  const wv = Math.sin(t * 6) * 3;
  g.fillStyle = '#4f8ff7';
  g.beginPath(); g.moveTo(z.x - 5, fy); g.lineTo(z.x - 52, fy + 14 + wv); g.lineTo(z.x - 5, fy + 30); g.fill();
  g.fillStyle = '#ffffff'; starPath(g, z.x - 22, fy + 15 + wv * .5, 6, 2.6); g.fill();
  g.restore();
}

// Ziel-Torbogen am Levelende
function drawTor(g, d, t) {
  const x = d.x, y = d.y;
  g.save();
  const grd = g.createLinearGradient(x - 90, 0, x + 90, 0); grd.addColorStop(0, '#c8b89a'); grd.addColorStop(1, '#8a7a5e');
  g.fillStyle = grd;
  rr(g, x - 96, y - 200, 40, 200, 8); g.fill(); rr(g, x + 56, y - 200, 40, 200, 8); g.fill();
  g.beginPath(); g.moveTo(x - 100, y - 190); g.quadraticCurveTo(x, y - 290, x + 100, y - 190); g.lineTo(x + 100, y - 160); g.quadraticCurveTo(x, y - 250, x - 100, y - 160); g.closePath(); g.fill();
  // Girlande
  const cols = ['#4f8ff7', '#ef5350', '#3fbf5a', '#ffc531'];
  for (let i = 0; i < 9; i++) {
    const a = i / 8, px = x - 80 + a * 160, py = y - 175 - Math.sin(a * Math.PI) * 52 + 14;
    g.fillStyle = cols[i % 4];
    g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px + 8, py); g.lineTo(px, py + 16 + Math.sin(t * 4 + i) * 2); g.fill();
  }
  g.restore();
}

function drawBubble(g, x, y, r, t, ch, power) {
  g.save();
  drawHero(g, ch, { x, y: y + 22, s: .55, face: 1, t, state: 'float', power });
  const gr = g.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.85, 'rgba(180,230,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,.55)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)'; ell(g, x - r * .4, y - r * .45, r * .18, r * .1, -.7); g.fill();
  g.restore();
}
