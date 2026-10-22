'use strict';
// =====================================================================
//  Gegner und Bosse (Vektorgrafik mit Umrisslinien)
// =====================================================================
function drawEnemy(g, e, t) {
  g.save();
  g.translate(e.x, e.y);
  const dir = e.dir || 1;
  if (e.dead === 'flip') { g.translate(0, -18); g.rotate(Math.PI); g.translate(0, 18); }
  switch (e.kind) {
    case 'kaefer': case 'flugkaefer': drawKaefer(g, e, t, dir); break;
    case 'schnecke': if (e.shell) drawShell(g, e, t); else drawSchnecke(g, e, t, dir); break;
    case 'igel': drawIgel(g, e, t, dir); break;
    case 'hummel': drawHummel(g, e, t, dir); break;
    case 'lavaball': case 'magma': drawLavaball(g, e, t); break;
    case 'crusher': drawCrusher(g, e, t); break;
    case 'kugel': drawKugel(g, e, t, dir); break;
    case 'kanone': drawKanone(g, e, t); break;
    case 'pflanze': drawPflanze(g, e, t); break;
    case 'wicht': drawWicht(g, e, t, dir); break;
    case 'stein': g.rotate(t * 8); g.beginPath(); g.arc(0, -10, 10, 0, TAU); fs(g, '#8a7a72', 2); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(-3, -13, 3, 0, TAU); g.fill(); break;
    case 'irrlicht': drawIrrlicht(g, e, t, dir); break;
    case 'fisch': drawFisch(g, e, t, dir); break;
    case 'qualle': drawQualle(g, e, t); break;
    case 'seeigel': drawSeeigel(g, e, t); break;
    case 'saeule': drawSaeule(g, e, t); break;
    case 'zapfen': drawZapfen(g, e, t); break;
    case 'welle': drawWelle(g, e, t); break;
    case 'wolke': drawGiftwolke(g, e, t); break;
    case 'scherbe': drawScherbe(g, e, t); break;
    case 'flamme': drawFlamme(g, e, t); break;
  }
  g.restore();
}

function drawKaefer(g, e, t, dir) {
  const dark = e.shadow ? ['#5a4a7a', '#2a1a3e', '#140a20'] : ['#c08ad8', '#7a3a9a', '#3d1650'];
  if (e.squash) {
    ell(g, 0, -6, 24, 7); fs(g, dark[1]);
    g.fillStyle = '#fff'; ell(g, 6 * dir, -8, 3, 1.5); g.fill(); ell(g, 13 * dir, -8, 3, 1.5); g.fill();
    return;
  }
  const w = e.walk || 0;
  if (e.kind === 'flugkaefer') {
    const f = Math.sin(t * 30);
    g.save(); g.scale(dir, 1);
    for (const k of [0, 1]) { g.save(); g.translate(-6 + k * 6, -30); g.rotate(-.7 - f * .5 - k * .2); ell(g, -12, 0, 15, 7); fs(g, 'rgba(240,250,255,.85)', 1.8); g.restore(); }
    g.restore();
  }
  g.strokeStyle = OL; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const lx = -12 + i * 12, sw = Math.sin(w + i * 2) * 4;
    g.beginPath(); g.moveTo(lx, -8); g.lineTo(lx + sw - 3, 0); g.stroke();
  }
  g.scale(dir, 1);
  ell(g, -2, -17, 22, 16); fs(g, radial(g, -2, -18, 22, dark[0], dark[1], dark[2]));
  g.strokeStyle = 'rgba(10,0,20,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-2, -32); g.lineTo(-2, -3); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, -10, -25, 7, 4, -.4); g.fill();
  g.beginPath(); g.arc(17, -12, 11, 0, TAU); fs(g, dark[2]);
  g.fillStyle = '#fff'; ell(g, 19, -15, 3.8, 4.8); g.fill(); ell(g, 27, -14, 3.2, 4.4); g.fill();
  g.fillStyle = e.shadow ? '#ff3a3a' : '#1b0b1e'; ell(g, 20.5, -14, 2, 3); g.fill(); ell(g, 28, -13, 1.8, 2.8); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(15, -21); g.lineTo(22, -18); g.moveTo(25, -18); g.lineTo(31, -20); g.stroke();
  g.strokeStyle = OL; g.lineWidth = 2;
  g.beginPath(); g.moveTo(16, -22); g.quadraticCurveTo(18, -32, 24, -34); g.stroke();
}
function drawSchnecke(g, e, t, dir) {
  g.scale(dir, 1);
  const w = Math.sin((e.walk || 0) * 1.5) * 2;
  g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-26, -10, -12, -10); g.lineTo(14, -10 + w * .3);
  g.quadraticCurveTo(20, -14, 18, -28); g.quadraticCurveTo(26, -34, 30, -22); g.quadraticCurveTo(32, -6, 26, 0); g.closePath();
  fs(g, radial(g, 8, -10, 26, '#b8f08a', '#6cc048', '#3a8a2a'));
  g.strokeStyle = OL; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(22, -30); g.lineTo(20 + w, -42); g.moveTo(27, -29); g.lineTo(30 + w, -40); g.stroke();
  g.beginPath(); g.arc(20 + w, -43, 4.5, 0, TAU); fs(g, '#fff', 1.6); g.beginPath(); g.arc(30 + w, -41, 4.5, 0, TAU); fs(g, '#fff', 1.6);
  g.fillStyle = '#1b1b2e'; g.beginPath(); g.arc(21.5 + w, -43, 2.2, 0, TAU); g.arc(31.5 + w, -41, 2.2, 0, TAU); g.fill();
  drawShellShape(g, -6, -22, 18, 0);
}
function drawShellShape(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); fs(g, radial(g, 0, 0, r, '#ffd08a', '#f07a2a', '#9a3a10'));
  g.strokeStyle = '#7a2a08'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < 4.6 * Math.PI; a += .2) { const r2 = r * .9 * (1 - a / (5 * Math.PI)); const px = Math.cos(a) * r2, py = Math.sin(a) * r2; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, -r * .35, -r * .45, r * .35, r * .2, -.5); g.fill();
  g.restore();
}
function drawShell(g, e, t) {
  const rot = e.vx ? (e.spin || 0) : 0;
  if (e.wake > 0 && e.wake < 1.6 && !e.vx) { g.fillStyle = '#6cc048'; ell(g, Math.sin(t * 30) * 2, -4, 16, 5); g.fill(); }
  drawShellShape(g, 0, -17, 17, rot);
}
function drawIgel(g, e, t, dir) {
  g.scale(dir, 1);
  const w = e.walk || 0;
  g.fillStyle = OL;
  for (const lx of [-10, 8]) { ell(g, lx + Math.sin(w + lx) * 3, -3, 6, 4); g.fill(); }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + .15 + i * (Math.PI - .3) / 8;
    const bx = -2 + Math.cos(a) * 18, by = -16 + Math.sin(a) * 15;
    const tx = -2 + Math.cos(a) * 33, ty = -16 + Math.sin(a) * 29;
    g.beginPath(); g.moveTo(bx - Math.sin(a) * 6, by + Math.cos(a) * 6); g.lineTo(tx, ty); g.lineTo(bx + Math.sin(a) * 6, by - Math.cos(a) * 6);
    fs(g, '#4a2c18', 1.6);
    g.fillStyle = '#f2e0c0'; g.beginPath(); g.arc(tx, ty, 2, 0, TAU); g.fill();
  }
  ell(g, -2, -14, 20, 14); fs(g, radial(g, -2, -16, 20, '#b07a4a', '#7a4a28', '#4a2c18'));
  ell(g, 14, -10, 10, 8); fs(g, '#f0d0a0', 2);
  g.fillStyle = OL; g.beginPath(); g.arc(23, -11, 3, 0, TAU); g.fill();
  g.fillStyle = '#1b1b2e'; ell(g, 11, -17, 2.4, 3.2); g.fill();
  g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(7, -22); g.lineTo(14, -20); g.stroke();
}
function drawHummel(g, e, t, dir) {
  g.scale(dir, 1);
  const flap = Math.sin(t * 40);
  g.fillStyle = 'rgba(230,245,255,.75)';
  ell(g, -4, -34, 10, 16 * (.5 + Math.abs(flap) * .5), -.4); g.fill();
  ell(g, 6, -34, 9, 14 * (.5 + Math.abs(flap) * .5), .3); g.fill();
  g.save(); ell(g, 0, -18, 21, 16); g.clip();
  g.fillStyle = radial(g, 0, -18, 22, '#fff2a0', '#ffc61a', '#d88a00'); g.fillRect(-22, -36, 44, 36);
  g.fillStyle = '#2a2030'; g.fillRect(-10, -36, 7, 36); g.fillRect(2, -36, 6, 36);
  g.restore();
  ell(g, 0, -18, 21, 16); g.lineWidth = 2.4; g.strokeStyle = OL; g.stroke();
  g.beginPath(); g.moveTo(-20, -18); g.lineTo(-31, -15); g.lineTo(-20, -12); fs(g, '#2a2030', 1.5);
  g.fillStyle = '#fff'; ell(g, 13, -22, 4.5, 5.5); g.fill();
  g.fillStyle = '#c01a1a'; ell(g, 14.5, -21.5, 2.4, 3.4); g.fill();
  g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(9, -28); g.lineTo(18, -25); g.stroke();
  g.beginPath(); g.moveTo(14, -32); g.quadraticCurveTo(18, -42, 24, -42); g.stroke();
}
const SHOT_COL = {
  lava: ['#fff6b0', '#ffa21a', '#d0300a', 'rgba(255,200,80,.6)', 'rgba(255,80,20,0)', 'rgba(255,120,30,.5)'],
  eis: ['#ffffff', '#a8e8ff', '#3a8ad0', 'rgba(200,245,255,.7)', 'rgba(120,200,255,0)', 'rgba(170,230,255,.5)'],
  gift: ['#f0ffb0', '#8ad03a', '#3a7a1a', 'rgba(190,255,60,.6)', 'rgba(90,160,30,0)', 'rgba(150,220,60,.5)'],
  wasser: ['#ffffff', '#7fd8ff', '#2a8ad0', 'rgba(150,230,255,.6)', 'rgba(40,140,220,0)', 'rgba(120,210,255,.5)'],
  zucker: ['#ffffff', '#ff9ad0', '#e8408a', 'rgba(255,170,220,.6)', 'rgba(255,80,160,0)', 'rgba(255,150,210,.5)'],
  stern: ['#ffffff', '#ffe066', '#c8902a', 'rgba(255,240,150,.6)', 'rgba(255,200,60,0)', 'rgba(255,230,120,.5)'],
};
function drawLavaball(g, e, t) {
  const r = e.kind === 'magma' ? 12 : 17;
  const col = SHOT_COL[e.col] || SHOT_COL.lava;
  const up = (e.vy || 0) < 0;
  g.save(); if (!up) { g.scale(1, -1); g.translate(0, 36); }
  const fl = Math.sin(t * 20) * 3;
  g.fillStyle = col[5];
  g.beginPath(); g.moveTo(-r * .8, -16); g.quadraticCurveTo(-8 + fl, 12, 0, 22); g.quadraticCurveTo(8 - fl, 12, r * .8, -16); g.fill();
  g.restore();
  const gl = g.createRadialGradient(0, -18, 4, 0, -18, r * 2);
  gl.addColorStop(0, col[3]); gl.addColorStop(1, col[4]);
  g.fillStyle = gl; g.beginPath(); g.arc(0, -18, r * 2, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, -18, r, 0, TAU); fs(g, radial(g, 0, -18, r, col[0], col[1], col[2]), 2);
  g.fillStyle = '#5a0a00'; ell(g, -r * .35, -20, 2.5, 4); g.fill(); ell(g, r * .35, -20, 2.5, 4); g.fill();
}
function drawCrusher(g, e, t) {
  const w = e.w, h = e.h;
  g.translate(0, -h);
  const grd = g.createLinearGradient(-w / 2, 0, w / 2, h);
  grd.addColorStop(0, '#8a86a0'); grd.addColorStop(1, '#3a3648');
  rr(g, -w / 2, 0, w, h, 14); fs(g, grd, 3);
  g.fillStyle = 'rgba(255,255,255,.15)'; rr(g, -w / 2 + 6, 5, w - 12, 8, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(-w / 2 + 10, 14); g.lineTo(-w / 2 + 20, 30); g.lineTo(-w / 2 + 14, 44); g.moveTo(w / 2 - 12, h - 30); g.lineTo(w / 2 - 22, h - 18); g.stroke();
  const angry = e.state === 'fall' || e.state === 'wait';
  g.fillStyle = '#fff'; ell(g, -18, h / 2 - 6, 10, angry ? 6 : 9); g.fill(); ell(g, 18, h / 2 - 6, 10, angry ? 6 : 9); g.fill();
  g.fillStyle = angry ? '#c01a1a' : '#1b1b2e'; g.beginPath(); g.arc(-16, h / 2 - 5, 4.5, 0, TAU); g.arc(16, h / 2 - 5, 4.5, 0, TAU); g.fill();
  g.fillStyle = '#2a2636';
  g.beginPath(); g.moveTo(-32, h / 2 - 22); g.lineTo(-8, h / 2 - 12); g.lineTo(-8, h / 2 - 16); g.lineTo(-30, h / 2 - 26); g.fill();
  g.beginPath(); g.moveTo(32, h / 2 - 22); g.lineTo(8, h / 2 - 12); g.lineTo(8, h / 2 - 16); g.lineTo(30, h / 2 - 26); g.fill();
  g.fillStyle = '#fff'; rr(g, -18, h / 2 + 14, 36, 12, 4); g.fill();
  g.strokeStyle = '#2a2636'; g.lineWidth = 2; g.beginPath();
  for (let i = -12; i <= 12; i += 8) { g.moveTo(i, h / 2 + 14); g.lineTo(i, h / 2 + 26); } g.stroke();
}
function drawKugel(g, e, t, dir) {
  g.scale(dir, 1);
  // Rauchspur
  g.fillStyle = 'rgba(80,70,90,.35)';
  for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(-18 - i * 12, -20 + Math.sin(t * 10 + i) * 2, 9 - i * 2, 0, TAU); g.fill(); }
  g.beginPath(); g.arc(0, -20, 20, 0, TAU); fs(g, radial(g, 0, -20, 20, '#8a8698', '#3a3646', '#16141e'), 2.6);
  g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, -6, -30, 6, 3.5, -.4); g.fill();
  g.fillStyle = '#fff'; ell(g, 7, -24, 5, 6); g.fill(); ell(g, 15, -23, 4, 5.5); g.fill();
  g.fillStyle = '#c01a1a'; g.beginPath(); g.arc(8.5, -23, 2.6, 0, TAU); g.arc(16, -22, 2.3, 0, TAU); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(2, -32); g.lineTo(11, -29); g.moveTo(13, -29); g.lineTo(20, -31); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, -11); g.lineTo(16, -12); g.stroke();
}
function drawKanone(g, e, t) {
  // Sockel ist eine Kachel, hier nur das Rohr
  const a = e.aim || 0;
  g.translate(0, -T * .55);
  g.beginPath(); g.arc(0, 0, 22, 0, TAU); fs(g, radial(g, 0, 0, 22, '#7a7690', '#3a3648', '#1a1824'), 2.6);
  g.save(); g.rotate(a);
  rr(g, 2, -12, 30, 24, 6); fs(g, '#2a2836', 2.6);
  rr(g, 26, -15, 10, 30, 4); fs(g, '#4a4658', 2.4);
  g.restore();
  g.fillStyle = '#ffcc33'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
  if (e.flash > 0) { g.fillStyle = `rgba(255,230,140,${e.flash * 3})`; g.beginPath(); g.arc(Math.cos(a) * 42, Math.sin(a) * 42, 18, 0, TAU); g.fill(); }
}
function drawPflanze(g, e, t) {
  // Kopf kommt aus dem Krug (Krug ist Kachel darunter)
  const up = e.up || 0;
  if (up <= .02) return;
  g.save();
  g.beginPath(); g.rect(-40, -200, 80, 200); g.clip();
  g.translate(0, (1 - up) * 70);
  const sw = Math.sin(t * 3) * 4;
  limb(g, 0, 0, sw, -38, 7, '#2f8a3a');
  g.fillStyle = '#4fbf3a'; ell(g, -12, -16, 11, 5, -.5); g.fill(); g.stroke(); ell(g, 12, -22, 11, 5, .5); g.fill();
  g.translate(sw, -48);
  const bite = Math.abs(Math.sin(t * 8)) * .45;
  for (const s of [-1, 1]) {
    g.save(); g.rotate(s * bite);
    g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-22 * 1, -20 * s, 0, -30 * s); g.quadraticCurveTo(24, -20 * s, 6, 0); g.closePath();
    fs(g, radial(g, 0, -14 * s, 22, '#e86ab8', '#a82a7a', '#5a0a3a'));
    g.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 5 - 2, -4 * s); g.lineTo(i * 5, -10 * s); g.lineTo(i * 5 + 2, -4 * s); g.fill(); }
    if (s < 0) { g.fillStyle = 'rgba(255,255,255,.5)'; for (const [dx, dy] of [[-8, 18], [6, 22], [0, 12]]) { g.beginPath(); g.arc(dx, dy, 2.5, 0, TAU); g.fill(); } }
    g.restore();
  }
  g.restore();
}
function drawWicht(g, e, t, dir) {
  g.scale(dir, 1);
  const w = e.walk || 0, hop = e.vy && !e.onGround ? 1 : 0;
  limb(g, -5, -12, -8 + Math.sin(w) * 4, -2, 5, '#2a1a3e');
  limb(g, 5, -12, 8 - Math.sin(w) * 4, -2, 5, '#2a1a3e');
  // Kapuzenmantel
  g.beginPath(); g.moveTo(-16, -10); g.quadraticCurveTo(-18, -40, 0, -50); g.quadraticCurveTo(18, -40, 16, -10); g.quadraticCurveTo(0, -4, -16, -10); g.closePath();
  fs(g, radial(g, 0, -30, 24, '#6a4a8a', '#3a2252', '#1a0e28'));
  g.beginPath(); g.moveTo(-4, -50); g.quadraticCurveTo(-14, -62, -22, -58); g.quadraticCurveTo(-10, -52, -8, -46); fs(g, '#3a2252', 2);
  g.fillStyle = '#0e0616'; ell(g, 5, -32, 11, 10); g.fill();
  g.fillStyle = '#ffe24a'; g.shadowColor = '#ffe24a'; g.shadowBlur = 8;
  ell(g, 2, -34, 2.6, 3.4); g.fill(); ell(g, 10, -34, 2.6, 3.4); g.fill(); g.shadowBlur = 0;
  // Arm mit Stein
  const raise = e.throwT > 0 ? -1 : 0;
  limb(g, 8, -28, 18, raise ? -48 : -20, 5, '#3a2252');
  if (e.throwT > 0 || e.hold) { g.beginPath(); g.arc(18, raise ? -54 : -16, 8, 0, TAU); fs(g, '#8a7a72', 2); }
}
function drawIrrlicht(g, e, t, dir) {
  g.scale(dir, 1);
  const a = .75 + Math.sin(t * 4) * .15;
  g.globalAlpha *= e.shy ? .45 : a;
  const gl = g.createRadialGradient(0, -24, 4, 0, -24, 40);
  gl.addColorStop(0, 'rgba(170,240,255,.6)'); gl.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, -24, 40, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-18, -24); g.quadraticCurveTo(-18, -48, 0, -48); g.quadraticCurveTo(18, -48, 18, -24);
  for (let i = 0; i < 4; i++) { const x0 = 18 - i * 12, wv = Math.sin(t * 8 + i) * 4; g.quadraticCurveTo(x0 - 3, -4 + wv, x0 - 9, -10 + wv); }
  g.closePath();
  fs(g, 'rgba(225,248,255,.95)', 2);
  g.fillStyle = '#1a2a4a'; ell(g, 2, -30, 4, 6); g.fill(); ell(g, 11, -30, 3.5, 5.5); g.fill();
  g.beginPath(); g.ellipse(7, -20, 4, 3, 0, 0, TAU); g.fill();
}
function drawFisch(g, e, t, dir) {
  g.scale(dir, 1);
  const sw = Math.sin(t * 10) * .3;
  g.save(); g.translate(-18, -16); g.rotate(sw);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, -12); g.lineTo(-12, 0); g.lineTo(-16, 12); g.closePath(); fs(g, '#ff7a4a', 2);
  g.restore();
  ell(g, 0, -16, 22, 15); fs(g, radial(g, 0, -18, 22, '#ffd0a0', '#ff8a3a', '#c0400a'));
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-12 + i * 6, -29); g.lineTo(-10 + i * 6, -38); g.lineTo(-7 + i * 6, -29); fs(g, '#f0f0f8', 1.4); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(11, -20, 5, 0, TAU); g.fill();
  g.fillStyle = '#1a0a1a'; g.beginPath(); g.arc(12.5, -20, 2.6, 0, TAU); g.fill();
  g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(14, -10); g.lineTo(21, -12); g.stroke();
}
function drawQualle(g, e, t) {
  const p = e.pulse !== undefined ? e.pulse * 2 - 1 : Math.sin(t * 3);
  g.strokeStyle = 'rgba(255,170,230,.8)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 6, -22); g.quadraticCurveTo(i * 6 + Math.sin(t * 5 + i) * 6, -10, i * 6, 4 + p * 4); g.stroke(); }
  g.beginPath(); g.moveTo(-20, -22); g.quadraticCurveTo(-20 - p * 2, -46, 0, -46); g.quadraticCurveTo(20 + p * 2, -46, 20, -22); g.quadraticCurveTo(0, -16, -20, -22);
  fs(g, 'rgba(255,170,230,.85)', 2);
  g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, -7, -36, 5, 3, -.4); g.fill();
  g.fillStyle = '#5a1a4a'; g.beginPath(); g.arc(-5, -30, 2.2, 0, TAU); g.arc(5, -30, 2.2, 0, TAU); g.fill();
}
function drawSeeigel(g, e, t) {
  g.translate(0, -20);
  g.rotate(t * .5);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.beginPath(); g.moveTo(Math.cos(a - .2) * 12, Math.sin(a - .2) * 12); g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); g.lineTo(Math.cos(a + .2) * 12, Math.sin(a + .2) * 12); fs(g, '#3a1a4a', 1.4); }
  g.beginPath(); g.arc(0, 0, 14, 0, TAU); fs(g, radial(g, 0, 0, 14, '#a86ad8', '#5a2a8a', '#2a0a4a'));
  g.rotate(-t * .5);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, -2, 3.5, 0, TAU); g.arc(5, -2, 3.5, 0, TAU); g.fill();
  g.fillStyle = '#1a0a1a'; g.beginPath(); g.arc(-4.5, -1.5, 1.8, 0, TAU); g.arc(5.5, -1.5, 1.8, 0, TAU); g.fill();
}
// Feuerkette (dreht sich um einen Block)
function drawFeuerkette(g, f, t) {
  for (let i = 0; i < f.n; i++) {
    const r = i * 19, x = f.cx + Math.cos(f.a) * r, y = f.cy + Math.sin(f.a) * r;
    const gl = g.createRadialGradient(x, y, 2, x, y, 18);
    gl.addColorStop(0, 'rgba(255,220,120,.7)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.fill();
    g.fillStyle = radial(g, x, y, 9, '#fffbe0', '#ffb02a', '#e04a10'); g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
  }
}
// Eingefrorener Gegner
function drawEisblock(g, b, t) {
  g.save();
  const melt = b.timer < 2 ? Math.sin(t * 30) * 1.5 : 0;
  g.translate(b.x + melt, b.y);
  if (b.kind) { g.save(); g.globalAlpha *= .55; drawEnemy(g, { kind: b.kind, x: 0, y: -4, dir: b.dir || 1, walk: 0 }, 0); g.restore(); }
  const grd = g.createLinearGradient(-b.w / 2, -b.h, b.w / 2, 0);
  grd.addColorStop(0, 'rgba(220,250,255,.75)'); grd.addColorStop(1, 'rgba(110,200,240,.6)');
  rr(g, -b.w / 2, -b.h, b.w, b.h, 8); g.fillStyle = grd; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = '#2a7ab0'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath(); g.moveTo(-b.w / 2 + 6, -12); g.lineTo(-b.w / 2 + 16, -b.h + 6); g.lineTo(-b.w / 2 + 22, -b.h + 6); g.lineTo(-b.w / 2 + 12, -12); g.fill();
  g.restore();
}

// ---------------------------------------------------------------------
//  Bosse
// ---------------------------------------------------------------------
const BOSS_LOOK = {
  // atk = Spezialangriffe (neben Springen, Werfen und Rammen), pil/wave/fall = Aussehen der Angriffe
  1: { name: 'Drachenkönig Ignaz', body: ['#8ad050', '#3a8a2a', '#143a10'], glow: [255, 140, 40], crown: '#ffcc33', shot: 'lava', belly: '#f4d890' },
  2: { name: 'Sand-Koloss', body: ['#e0c08a', '#a8804a', '#5a3a1a'], glow: [255, 220, 90], crown: '#ff9a2a', atk: ['wellen', 'zapfen'], wave: 'sand', fall: 'fels', deco: 'horn' },
  3: { name: 'Eishexe Frosta', body: ['#d8f0ff', '#6aa0d0', '#2a4a7a'], glow: [120, 230, 255], crown: '#e8f8ff', shot: 'eis', hat: '#3a5a9a' },
  4: { name: 'Seedrache Glubb', body: ['#7ae8d8', '#2a9ab0', '#0a3a5a'], glow: [120, 255, 220], crown: '#ffd23a', shot: 'wasser', belly: '#d8fff4' },
  5: { name: 'Sturm-Koloss', body: ['#9aa8c8', '#4a5878', '#1a2238'], glow: [255, 255, 120], crown: '#c0c8ff', atk: ['blitze', 'wellen'], wave: 'wind', deco: 'wolke' },
  6: { name: 'Kristall-Koloss', body: ['#c8a8ff', '#6a4aa8', '#2a1a58'], glow: [255, 130, 230], crown: '#7fe8ff', atk: ['scherben', 'eruption'], pil: 'kristall', shot: 'kristall', deco: 'eis' },
  7: { name: 'Moorhexe Gruselda', body: ['#b0e078', '#4a6a2a', '#14240e'], glow: [190, 255, 60], crown: '#c8a85a', shot: 'gift', hat: '#2a1a3a' },
  9: { name: 'Sternenkönig', body: ['#8a7ae0', '#3a2a8a', '#120a3a'], glow: [255, 230, 110], crown: '#ffe066', atk: ['eruption', 'wellen', 'zapfen', 'blitze', 'scherben', 'gift', 'flut'], pil: 'stern', wave: 'wind', fall: 'stern', shot: 'stern', deco: 'stern' },
  10: { name: 'Urwald-Rex', body: ['#d8b060', '#7a5a22', '#2a1a0a'], glow: [255, 240, 80], crown: '#ff8a3a', shot: 'gift', belly: '#f8e8b0' },
  11: { name: 'Lavaspeier Brutus', body: ['#ff8a4a', '#a82a0a', '#3a0a04'], glow: [255, 200, 40], crown: '#ffdd55', shot: 'lava', belly: '#ffd080' },
  12: { name: 'Zuckerhexe Bonbonella', body: ['#ffc0e0', '#e86aa8', '#8a2a5a'], glow: [255, 255, 255], crown: '#7fe8ff', shot: 'zucker', hat: '#c82a7a' },
  13: { name: 'Himmels-Koloss', body: ['#fff4c8', '#e8c060', '#8a6a1a'], glow: [255, 255, 180], crown: '#ffffff', atk: ['blitze', 'flut', 'scherben'], pil: 'blitz', wave: 'wind', shot: 'stern', deco: 'wolke' },
};
// Zusätzlicher Rückenschmuck je nach Boss
// Welcher Boss in welcher Welt kämpft (Rest: Koloss mit eigenen Angriffen)
const BOSS_TYPE = { 1: 'drache', 3: 'hexe', 4: 'speier', 7: 'hexe', 10: 'drache', 11: 'speier', 12: 'hexe' };
function drawKolossDeco(g, look, t) {
  const c = look.crown;
  g.save();
  switch (look.deco) {
    case 'eis': for (let i = 0; i < 5; i++) { const x = -52 + i * 18; g.beginPath(); g.moveTo(x - 7, -108 + Math.abs(i - 2) * 9); g.lineTo(x, -150 + Math.abs(i - 2) * 12 - (i % 2) * 14); g.lineTo(x + 7, -108 + Math.abs(i - 2) * 9); g.closePath(); fs(g, c, 2); } break;
    case 'horn': for (const dx of [-1, 1]) { g.beginPath(); g.moveTo(dx * 36 - 8, -128); g.quadraticCurveTo(dx * 58, -150, dx * 44, -178); g.quadraticCurveTo(dx * 36, -150, dx * 36 + 8, -128); g.closePath(); fs(g, look.body[2], 2.5); } break;
    case 'koralle': for (let i = 0; i < 4; i++) { const x = -44 + i * 24; g.strokeStyle = c; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, -128); g.quadraticCurveTo(x + 8, -150, x - 4, -168 - i % 2 * 10); g.moveTo(x + 4, -146); g.lineTo(x + 18, -156); g.stroke(); } break;
    case 'ranken': g.strokeStyle = '#2f8a3a'; g.lineWidth = 5; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-50 + i * 38, -130); g.bezierCurveTo(-60 + i * 38, -100, -30 + i * 38, -80, -48 + i * 38, -50); g.stroke(); g.fillStyle = '#6ad04a'; g.beginPath(); g.ellipse(-50 + i * 38, -108, 9, 4, .6, 0, TAU); g.fill(); } break;
    case 'wolke': g.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y, r] of [[-40, -142, 18], [-18, -152, 22], [10, -146, 20], [34, -138, 16]]) { g.beginPath(); g.arc(x, y + Math.sin(t * 2 + x) * 2, r, 0, TAU); g.fill(); } break;
    case 'zucker': for (let i = 0; i < 4; i++) { const x = -46 + i * 26; g.strokeStyle = i % 2 ? '#ffffff' : '#ff4a8a'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, -128); g.quadraticCurveTo(x + 10, -156, x - 6, -170); g.stroke(); } break;
    case 'stern': for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .5, r = 120 + Math.sin(t * 3 + i) * 6; g.save(); g.translate(Math.cos(a) * r * .55, -90 + Math.sin(a) * r * .9); g.rotate(t + i); starPath(g, 0, 0, 12, 5); fs(g, '#ffe066', 2); g.restore(); } break;
  }
  g.restore();
}
function drawKoloss(g, b, t) {
  const look = BOSS_LOOK[b.look] || BOSS_LOOK[1];
  g.save();
  g.translate(b.x, b.y);
  g.scale(b.dir, 1);
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
  const sq = b.squash || 0;
  g.scale(1 + sq * .2, 1 - sq * .25);
  const step = Math.sin(b.walk || 0);
  ell(g, -28, -14 - Math.max(0, step) * 8, 22, 16); fs(g, look.body[2], 3);
  ell(g, 28, -14 - Math.max(0, -step) * 8, 22, 16); fs(g, look.body[2], 3);
  const body = g.createRadialGradient(-20, -110, 10, 0, -80, 90);
  body.addColorStop(0, hurt ? '#ffffff' : look.body[0]); body.addColorStop(.6, hurt ? '#ffd0d0' : look.body[1]); body.addColorStop(1, look.body[2]);
  ell(g, 0, -78, 72, 66); fs(g, body, 3.5);
  const [r0, g0, b0] = look.glow, gp = .6 + Math.sin(t * 5) * .3;
  g.strokeStyle = `rgba(${r0},${g0},${b0},${.7 + gp * .3})`; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-40, -40); g.lineTo(-24, -60); g.lineTo(-34, -84); g.moveTo(10, -26); g.lineTo(26, -48); g.lineTo(18, -70); g.lineTo(34, -96); g.moveTo(-6, -120); g.lineTo(4, -132); g.stroke();
  const bg = g.createRadialGradient(10, -60, 4, 10, -60, 34);
  bg.addColorStop(0, `rgba(${r0},${g0},${b0},.9)`); bg.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
  g.fillStyle = bg; ell(g, 10, -60, 34, 30); g.fill();
  drawKolossDeco(g, look, t);
  const arm = b.state === 'throw' || b.atk ? -1.2 + Math.sin(t * 14) * .15 : Math.sin(t * 3) * .3;
  g.save(); g.translate(56, -80); g.rotate(arm); ell(g, 14, 10, 22, 20); fs(g, look.body[1], 3); g.restore();
  g.fillStyle = `rgb(${r0},${g0},${b0})`; ell(g, 18, -104, 11, b.angry ? 7 : 10); g.fill(); ell(g, 46, -100, 10, b.angry ? 6 : 9); g.fill();
  g.fillStyle = '#1a0a08'; g.beginPath(); g.arc(21, -103, 4.5, 0, TAU); g.arc(48, -99, 4, 0, TAU); g.fill();
  g.fillStyle = look.body[2];
  g.beginPath(); g.moveTo(4, -122); g.lineTo(30, -110); g.lineTo(30, -116); g.lineTo(6, -128); g.fill();
  g.beginPath(); g.moveTo(58, -116); g.lineTo(36, -108); g.lineTo(36, -114); g.lineTo(56, -122); g.fill();
  g.fillStyle = '#1a0a08'; rr(g, 16, -84, 34, 12, 5); g.fill();
  g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(19 + i * 8, -84); g.lineTo(23 + i * 8, -78); g.lineTo(27 + i * 8, -84); g.fill(); }
  g.beginPath(); g.moveTo(-26, -138); g.lineTo(-30, -164); g.lineTo(-14, -150); g.lineTo(-2, -172); g.lineTo(10, -150); g.lineTo(26, -164); g.lineTo(22, -138); g.closePath(); fs(g, look.crown, 2.5);
  g.fillStyle = '#ff4a6a'; g.beginPath(); g.arc(-2, -150, 4, 0, TAU); g.fill();
  g.restore();
}
// Turm-Wächter: Panzerkäfer Krax
function drawKrax(g, b, t) {
  g.save(); g.translate(b.x, b.y); g.scale(b.dir, 1);
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
  const shell = b.state === 'spin';
  if (shell) {
    g.translate(0, -40); g.rotate(b.spin || 0);
    g.beginPath(); g.arc(0, 0, 40, 0, TAU); fs(g, radial(g, 0, 0, 40, '#8a9ab8', '#3a4a6a', '#141a2a'), 3.5);
    g.strokeStyle = '#ffcc33'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, 26, k * 2.1, k * 2.1 + 1); g.stroke(); }
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.beginPath(); g.moveTo(Math.cos(a) * 36, Math.sin(a) * 36); g.lineTo(Math.cos(a + .2) * 50, Math.sin(a + .2) * 50); g.lineTo(Math.cos(a + .35) * 38, Math.sin(a + .35) * 38); fs(g, '#e8e8f0', 2); }
    g.restore(); return;
  }
  const w = b.walk || 0;
  g.strokeStyle = OL; g.lineWidth = 6; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const lx = -34 + i * 30, sw = Math.sin(w + i * 2) * 8; g.beginPath(); g.moveTo(lx, -20); g.lineTo(lx + sw - 6, 0); g.stroke(); }
  ell(g, -6, -46, 58, 40); fs(g, radial(g, -6, -50, 58, hurt ? '#ffffff' : '#8a9ab8', hurt ? '#ffd0d0' : '#3a4a6a', '#141a2a'), 3.5);
  g.strokeStyle = '#ffcc33'; g.lineWidth = 4; g.beginPath(); g.moveTo(-6, -84); g.lineTo(-6, -8); g.stroke();
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-50 + k * 26, -76 + Math.abs(k - 1.5) * 8); g.lineTo(-44 + k * 26, -96 + Math.abs(k - 1.5) * 8); g.lineTo(-38 + k * 26, -76 + Math.abs(k - 1.5) * 8); fs(g, '#e8e8f0', 2); }
  g.beginPath(); g.arc(48, -30, 24, 0, TAU); fs(g, '#1e2638', 3);
  g.beginPath(); g.moveTo(62, -46); g.quadraticCurveTo(90, -60, 96, -40); g.quadraticCurveTo(80, -46, 66, -36); fs(g, '#e8e8f0', 2.5);
  g.fillStyle = '#ff3a2a'; g.shadowColor = '#ff3a2a'; g.shadowBlur = 10;
  ell(g, 50, -36, 5, b.angry ? 3 : 5); g.fill(); ell(g, 63, -34, 4, b.angry ? 2.5 : 4.5); g.fill(); g.shadowBlur = 0;
  g.restore();
}

// ---------------------------------------------------------------------
//  Boss-Gefahren: Säulen, Zapfen, Wellen, Giftwolken, Splitter
// ---------------------------------------------------------------------
const PIL_COL = {
  lava: ['#fff0a0', '#ff8a1a', '#c02a0a'], eis: ['#ffffff', '#a8e8ff', '#4a9ad8'], kristall: ['#ffd0ff', '#c86aff', '#6a2aa8'],
  dorn: ['#d8ff9a', '#6ac03a', '#2a6a1a'], zucker: ['#ffffff', '#ff6aa8', '#c82a6a'], stern: ['#ffffff', '#ffe066', '#e8a020'], blitz: ['#ffffff', '#fff6a0', '#7aa8ff'],
};
function drawSaeule(g, e, t) {
  const c = PIL_COL[e.style] || PIL_COL.lava, w = e.w;
  if (e.warn > 0) {
    const k = 1 - e.warn / e.warn0, pu = .5 + .5 * Math.sin(t * 30);
    if (e.style === 'blitz') {
      g.strokeStyle = `rgba(255,255,200,${.25 + .4 * k})`; g.lineWidth = 3 + k * 8; g.setLineDash([14, 10]);
      g.beginPath(); g.moveTo(0, -700); g.lineTo(0, 0); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = `rgba(${e.style === 'eis' ? '160,230,255' : e.style === 'dorn' ? '120,220,60' : e.style === 'blitz' ? '255,255,160' : '255,110,30'},${.25 + .45 * pu * k})`;
    ell(g, 0, 0, w * (.6 + .5 * k), 8 + 6 * k); g.fill();
    g.strokeStyle = c[1]; g.lineWidth = 3; ell(g, 0, 0, w * .6, 9); g.stroke();
    return;
  }
  const h = e.h * Math.min(1, (e.hotT || 0) / .12 + .15);
  if (e.style === 'blitz') {
    const gl = g.createLinearGradient(-w, 0, w, 0); gl.addColorStop(0, 'rgba(180,200,255,0)'); gl.addColorStop(.5, 'rgba(255,255,220,.85)'); gl.addColorStop(1, 'rgba(180,200,255,0)');
    g.fillStyle = gl; g.fillRect(-w, -700, w * 2, 700);
    g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineJoin = 'round'; g.shadowColor = '#bfe0ff'; g.shadowBlur = 18;
    g.beginPath(); g.moveTo(0, -700); for (let y = -660; y < 0; y += 44) g.lineTo(((y / 44) % 2 ? 14 : -14) + Math.sin(y + e.t * 40) * 4, y); g.lineTo(0, 0); g.stroke(); g.shadowBlur = 0;
    return;
  }
  if (e.style === 'lava' || e.style === 'stern') {
    const gr = g.createLinearGradient(0, 0, 0, -h); gr.addColorStop(0, c[2]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[0]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(-w / 2, 0);
    for (let i = 0; i <= 6; i++) g.lineTo(-w / 2 + w * i / 6 + (i % 2 ? 3 : -3), -h + (i % 2) * 22 + Math.sin(t * 14 + i) * 5);
    g.lineTo(w / 2, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-w * .12, -h * .85, w * .24, h * .85);
    return;
  }
  // Spitzen: Eis, Kristall, Dornen, Zuckerstangen
  const n = 3;
  for (let i = 0; i < n; i++) {
    const x = (i - 1) * w * .32, hh = h * (i === 1 ? 1 : .72), ww = w * .24;
    g.beginPath(); g.moveTo(x - ww, 0); g.lineTo(x - ww * .3, -hh + 10); g.lineTo(x, -hh); g.lineTo(x + ww * .3, -hh + 10); g.lineTo(x + ww, 0); g.closePath();
    const gr = g.createLinearGradient(x - ww, 0, x + ww, 0); gr.addColorStop(0, c[2]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[0]);
    fs(g, e.style === 'zucker' ? (i % 2 ? '#ffffff' : '#ff6aa8') : gr, 2);
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(x - ww * .5, -6); g.lineTo(x - ww * .2, -hh + 14); g.lineTo(x, -hh + 4); g.lineTo(x - ww * .1, -6); g.fill();
  }
}
function drawZapfen(g, e, t) {
  const c = e.fall === 'fels' ? ['#e8d0a0', '#a8804a', '#5a3a1a'] : e.fall === 'zucker' ? ['#ffffff', '#ff6aa8', '#c82a6a'] : e.fall === 'stern' ? ['#ffffff', '#ffe066', '#c8902a'] : ['#ffffff', '#a8e8ff', '#4a9ad8'];
  if (e.warn > 0) {
    const k = 1 - e.warn / e.warn0, A = G.L.arena, fy = A ? A.gy * T - e.y : 0;
    g.save(); g.translate(0, fy); g.fillStyle = `rgba(255,70,50,${.3 + .5 * Math.abs(Math.sin(t * 16))})`;
    g.beginPath(); g.moveTo(-14, -4); g.lineTo(14, -4); g.lineTo(0, -22 - 10 * k); g.closePath(); g.fill(); g.restore();
    g.globalAlpha = .5 + .5 * k;
  }
  if (e.fall === 'stern') { g.translate(0, -22); g.rotate(t * 6); starPath(g, 0, 0, 20, 9); fs(g, c[1], 2.5); return; }
  g.beginPath();
  if (e.fall === 'fels') { g.moveTo(-14, -40); g.lineTo(14, -44); g.lineTo(18, -16); g.lineTo(0, 0); g.lineTo(-17, -16); }
  else { g.moveTo(-11, -46); g.lineTo(11, -46); g.lineTo(0, 2); }
  g.closePath();
  fs(g, e.fall === 'zucker' ? c[1] : radial(g, 0, -26, 28, c[0], c[1], c[2]), 2.5);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(-6, -40); g.lineTo(-2, -40); g.lineTo(-3, -12); g.fill();
}
const WAVE_COL = { wasser: ['#d8f6ff', '#4ab4f0', '#1a6ab8'], sand: ['#fff0c0', '#e8b860', '#a8742a'], lava: ['#fff0a0', '#ff8a1a', '#c02a0a'], zucker: ['#ffffff', '#ff9ad0', '#e8408a'], wind: ['#ffffff', '#d8e8ff', '#8aa8e0'] };
function drawWelle(g, e, t) {
  const c = WAVE_COL[e.wave] || WAVE_COL.wasser, w = e.w, h = e.h, dir = e.dir || 1;
  if (e.warn > 0) {   // Warnpfeil am Rand
    const A = G.L.arena, fy = A.gy * T - e.y;
    g.save(); g.translate(-dir * 0, fy - 40); g.fillStyle = `rgba(255,80,60,${.4 + .5 * Math.abs(Math.sin(t * 14))})`;
    g.beginPath(); g.moveTo(dir * 26, 0); g.lineTo(-dir * 10, -22); g.lineTo(-dir * 10, 22); g.closePath(); g.fill();
    g.font = '28px ' + FONT; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('!', -dir * 36, 10); g.restore();
    return;
  }
  g.save(); g.scale(dir, 1);
  const wob = Math.sin(t * 12) * 3;
  g.beginPath(); g.moveTo(-w / 2, 0);
  g.bezierCurveTo(-w / 2, -h * .35, -w * .12, -h * .6, w * .1, -h - wob);
  g.bezierCurveTo(w * .42, -h * .95, w * .5, -h * .3, w / 2, 0); g.closePath();
  const gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, c[1]); gr.addColorStop(1, c[2]);
  fs(g, gr, 3);
  g.strokeStyle = c[0]; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-w * .1, -h * .78); g.quadraticCurveTo(w * .12, -h * 1.02 - wob, w * .32, -h * .72); g.stroke();
  g.fillStyle = c[0]; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-w * .3 + i * w * .22, -h * .3 - Math.sin(t * 9 + i) * 4, 3 + (i % 2), 0, TAU); g.fill(); }
  g.restore();
}
function drawGiftwolke(g, e, t) {
  const a = Math.min(1, (e.age || 0) * 2) * Math.min(1, e.life / .8);
  g.globalAlpha = a * .85;
  for (const [x, y, r, col] of [[-26, -18, 24, '#6a9a2a'], [0, -26, 30, '#8ac03a'], [26, -18, 24, '#6a9a2a'], [0, -10, 28, '#9ad84a']]) { g.fillStyle = col; g.beginPath(); g.arc(x + Math.sin(t * 2 + x) * 3, y + Math.cos(t * 2.4 + x) * 2, r, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(40,70,10,.6)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-30 + i * 15, -30 - ((t * 20 + i * 13) % 34), 3, 0, TAU); g.fill(); }
  g.fillStyle = '#d8ff80'; g.beginPath(); g.arc(-8, -28, 3.5, 0, TAU); g.arc(8, -28, 3.5, 0, TAU); g.fill();
  g.globalAlpha = 1;
}
function drawScherbe(g, e, t) {
  const c = SHOT_COL[e.col] || SHOT_COL.stern;
  g.translate(0, -13); g.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
  const gl = g.createRadialGradient(0, 0, 2, 0, 0, 26); gl.addColorStop(0, c[3]); gl.addColorStop(1, c[4]);
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(0, -17); g.lineTo(8, 0); g.lineTo(0, 15); g.lineTo(-8, 0); g.closePath(); fs(g, radial(g, 0, 0, 14, c[0], c[1], c[2]), 2);
}

function drawFlamme(g, e, t) {
  const L = e.w, dir = e.dir || 1, k = Math.min(1, (e.age || 0) / .15) * Math.min(1, e.life / .25);
  g.scale(dir, 1);
  for (let layer = 0; layer < 3; layer++) {
    const h = (46 - layer * 12) * k, len = L * (1 - layer * .12) * k;
    g.fillStyle = ['rgba(255,90,20,.85)', 'rgba(255,170,40,.9)', 'rgba(255,245,170,.95)'][layer];
    g.beginPath(); g.moveTo(-L / 2, 0);
    for (let i = 0; i <= 8; i++) { const x = -L / 2 + len * i / 8; g.lineTo(x, -h * (1 - i / 8 * .6) - Math.sin(t * 24 + i * 1.7 + layer) * 5 * (i / 8)); }
    g.lineTo(-L / 2 + len, 0); g.closePath(); g.fill();
  }
}
// ---------------------------------------------------------------------
//  Boss: Drachenkönig (Bowser-Art): Feuer, Hämmer, Sprung
// ---------------------------------------------------------------------
function drawDrache(g, b, t) {
  const look = BOSS_LOOK[b.look] || BOSS_LOOK[1], c = look.body;
  g.save(); g.translate(b.x, b.y); g.scale(b.dir, 1);
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0, sq = b.squash || 0;
  g.scale(1 + sq * .2, 1 - sq * .25);
  const step = Math.sin(b.walk || 0), mouth = b.state === 'feuer';
  // Schwanz
  g.beginPath(); g.moveTo(-40, -44); g.quadraticCurveTo(-90, -50 + step * 4, -96, -86); g.quadraticCurveTo(-68, -64, -38, -78); g.closePath(); fs(g, c[1], 3);
  // Beine
  ell(g, -26, -14 - Math.max(0, step) * 7, 22, 15); fs(g, c[1], 3);
  ell(g, 30, -14 - Math.max(0, -step) * 7, 22, 15); fs(g, c[1], 3);
  // Panzer mit Stacheln
  ell(g, -14, -80, 56, 58); fs(g, radial(g, -20, -100, 70, hurt ? '#fff' : look.crown, c[1], c[2]), 3.5);
  for (let i = 0; i < 5; i++) { const a = -2.7 + i * .55, cx = -14 + Math.cos(a) * 54, cy = -80 + Math.sin(a) * 56; g.beginPath(); g.moveTo(cx - 9, cy + 6); g.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); g.lineTo(cx + 9, cy + 6); g.closePath(); fs(g, '#f4f0e0', 2.5); }
  // Bauch und Arm
  ell(g, 12, -62, 38, 44); fs(g, hurt ? '#fff' : (look.belly || '#f4d890'), 3);
  const arm = b.state === 'haemmer' ? -1.3 + Math.sin(t * 16) * .3 : Math.sin(t * 3) * .3;
  g.save(); g.translate(40, -70); g.rotate(arm); ell(g, 14, 8, 20, 14); fs(g, hurt ? '#fff' : c[0], 3); g.restore();
  // Kopf
  g.save(); g.translate(30, -118);
  ell(g, 0, 0, 40, 34); fs(g, hurt ? '#ffffff' : radial(g, -6, -10, 44, c[0], c[1], c[2]), 3.5);
  g.beginPath(); g.moveTo(-26, -24); g.lineTo(-40, -58); g.lineTo(-10, -34); g.closePath(); fs(g, '#f4f0e0', 2.5);
  g.beginPath(); g.moveTo(10, -30); g.lineTo(22, -64); g.lineTo(32, -26); g.closePath(); fs(g, '#f4f0e0', 2.5);
  g.fillStyle = look.crown; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-30 + i * 14, -26); g.lineTo(-24 + i * 14, -46 - (i % 2) * 8); g.lineTo(-18 + i * 14, -26); g.fill(); }
  ell(g, 34, 8, 26, 17); fs(g, hurt ? '#fff' : c[0], 3);
  if (mouth) { g.fillStyle = '#4a0a04'; ell(g, 44, 12, 18, 10 + Math.sin(t * 30) * 2); g.fill(); const gl = g.createRadialGradient(54, 12, 2, 54, 12, 26); gl.addColorStop(0, 'rgba(255,230,120,.95)'); gl.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gl; g.beginPath(); g.arc(54, 12, 26, 0, TAU); g.fill(); }
  else { g.fillStyle = '#1a0a08'; rr(g, 26, 14, 30, 6, 3); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(30 + i * 9, 14); g.lineTo(33 + i * 9, 20); g.lineTo(36 + i * 9, 14); g.fill(); } }
  g.fillStyle = '#fff'; ell(g, 10, -6, 10, b.angry ? 6 : 9); g.fill(); g.fillStyle = '#c81a0a'; ell(g, 12, -6, 5, b.angry ? 5 : 7); g.fill();
  g.strokeStyle = '#1a0a08'; g.lineWidth = 4; g.beginPath(); g.moveTo(-2, -16); g.lineTo(22, -8); g.stroke();
  g.restore();
  g.restore();
}
// ---------------------------------------------------------------------
//  Boss: Hexe auf dem Besen
// ---------------------------------------------------------------------
function drawHexe(g, b, t) {
  const look = BOSS_LOOK[b.look] || BOSS_LOOK[3], c = look.body, hat = look.hat || '#2a1a3a';
  g.save(); g.translate(b.x, b.y); g.scale(b.dir, 1);
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0, tired = b.state === 'erschoepft';
  const bob = tired ? 0 : Math.sin(t * 5) * 3;
  if (b.state === 'sturz' && b.dive !== true) { g.translate(Math.sin(t * 60) * 3, 0); }
  // Besen
  g.save(); g.translate(0, -18 + bob); g.rotate(tired ? .25 : -.12);
  g.fillStyle = '#7a5226'; rr(g, -56, -4, 100, 8, 4); g.fill(); g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#d8b050'; g.beginPath(); g.moveTo(-50, -2); for (let i = 0; i < 6; i++) g.lineTo(-84 + Math.sin(t * 14 + i) * 4, -14 + i * 6); g.lineTo(-50, 8); g.closePath(); fs(g, '#d8b050', 2);
  g.restore();
  // Umhang
  g.beginPath(); g.moveTo(-18, -66 + bob); g.quadraticCurveTo(-44 - Math.sin(t * 6) * 5, -34 + bob, -30, -14 + bob); g.lineTo(18, -14 + bob); g.quadraticCurveTo(26, -44 + bob, 12, -66 + bob); g.closePath();
  fs(g, hurt ? '#fff' : radial(g, 0, -40 + bob, 40, c[0], c[1], c[2]), 3);
  // Kopf
  g.save(); g.translate(2, -78 + bob);
  ell(g, 0, 0, 20, 18); fs(g, hurt ? '#fff' : '#9ad868', 3);
  g.beginPath(); g.moveTo(14, 2); g.quadraticCurveTo(30, 6, 24, 16); g.quadraticCurveTo(20, 8, 12, 8); g.closePath(); fs(g, '#8ac858', 2);
  g.fillStyle = '#fff'; ell(g, 4, -4, 7, tired ? 2 : 6); g.fill(); g.fillStyle = tired ? '#1a0a08' : '#c81a8a'; if (!tired) { ell(g, 6, -4, 3, 4); g.fill(); }
  if (tired) { g.strokeStyle = '#1a0a08'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -8); g.lineTo(9, 0); g.moveTo(9, -8); g.lineTo(0, 0); g.stroke(); }
  g.fillStyle = '#1a0a08'; g.beginPath(); g.moveTo(-2, 10); g.quadraticCurveTo(6, 16, 14, 10); g.lineTo(12, 12); g.quadraticCurveTo(6, 17, -2, 12); g.fill();
  // Hut
  g.beginPath(); g.ellipse(0, -14, 34, 8, 0, 0, TAU); fs(g, hat, 3);
  g.beginPath(); g.moveTo(-18, -16); g.quadraticCurveTo(-8, -50, 14, -70 + Math.sin(t * 4) * 3); g.quadraticCurveTo(8, -40, 20, -16); g.closePath(); fs(g, hat, 3);
  g.fillStyle = look.crown; rr(g, -16, -26, 34, 7, 2); g.fill();
  g.restore();
  // Zauberstab-Glühen
  if (b.state === 'zauber' || b.state === 'sturz') { const gl = g.createRadialGradient(34, -50 + bob, 2, 34, -50 + bob, 30); gl.addColorStop(0, `rgba(${look.glow[0]},${look.glow[1]},${look.glow[2]},.95)`); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(34, -50 + bob, 30, 0, TAU); g.fill(); }
  if (tired) { for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; g.save(); g.translate(Math.cos(a) * 30, -120 + Math.sin(a) * 8); starPath(g, 0, 0, 7, 3); fs(g, '#ffe066', 1.5); g.restore(); } }
  g.restore();
}
// ---------------------------------------------------------------------
//  Boss: Feuerspeier (Drachenkopf an der Wand)
// ---------------------------------------------------------------------
function drawSpeier(g, b, t) {
  const look = BOSS_LOOK[b.look] || BOSS_LOOK[4], c = look.body, A = G.L.arena;
  const hurt = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
  // Hals von der Wand zum Kopf
  const wx = A.x1 + 20, wy = A.gy * T - 70;
  const hx = b.x, hy = b.y - 56;
  for (let i = 0; i <= 14; i++) {
    const k = i / 14, x = wx + (hx - wx) * k, y = wy + (hy - wy) * k + Math.sin(k * Math.PI) * -26 + Math.sin(t * 3 + i) * 3, r = 30 - k * 8;
    g.beginPath(); g.arc(x, y, r, 0, TAU); fs(g, hurt ? '#fff' : radial(g, x - 6, y - 8, r, c[0], c[1], c[2]), 3);
  }
  // Warnmarke für den Biss
  if (b.state === 'beissen' && b.phase === 'ziel') { g.fillStyle = `rgba(255,70,50,${.4 + .5 * Math.abs(Math.sin(t * 16))})`; g.beginPath(); g.moveTo(b.biteX - 18, A.gy * T - 4); g.lineTo(b.biteX + 18, A.gy * T - 4); g.lineTo(b.biteX, A.gy * T - 34); g.closePath(); g.fill(); }
  g.save(); g.translate(b.x, b.y); g.scale(-1, 1);
  const open = b.state === 'speien' ? .5 + .5 * Math.sin(t * 12) : b.state === 'erschoepft' ? 0 : b.state === 'beissen' ? .8 : .12;
  // Unterkiefer
  g.save(); g.translate(-10, -30); g.rotate(open * .5); ell(g, 36, 10, 46, 14); fs(g, hurt ? '#fff' : c[1], 3.5); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10 + i * 18, 2); g.lineTo(16 + i * 18, -10); g.lineTo(22 + i * 18, 2); g.fill(); } g.restore();
  // Kopf
  ell(g, 0, -62, 50, 42); fs(g, hurt ? '#fff' : radial(g, -10, -76, 56, c[0], c[1], c[2]), 3.5);
  ell(g, 40, -48, 30, 20); fs(g, hurt ? '#fff' : c[0], 3);
  g.fillStyle = '#1a0a08'; g.beginPath(); g.arc(58, -54, 3, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-18, -92); g.lineTo(-30, -124); g.lineTo(-2, -98); g.closePath(); fs(g, look.crown, 2.5);
  g.beginPath(); g.moveTo(14, -100); g.lineTo(18, -130); g.lineTo(32, -96); g.closePath(); fs(g, look.crown, 2.5);
  g.fillStyle = '#fff'; ell(g, 14, -72, 12, b.state === 'erschoepft' ? 3 : 9); g.fill(); g.fillStyle = '#c81a0a'; if (b.state !== 'erschoepft') { ell(g, 17, -72, 5, 8); g.fill(); }
  if (b.state === 'speien' || (b.state === 'beissen' && b.phase === 'ziel')) { const gl = g.createRadialGradient(70, -44, 2, 70, -44, 34); gl.addColorStop(0, `rgba(${look.glow[0]},${look.glow[1]},${look.glow[2]},.95)`); gl.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gl; g.beginPath(); g.arc(70, -44, 34, 0, TAU); g.fill(); }
  if (b.state === 'erschoepft') { for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; g.save(); g.translate(Math.cos(a) * 34, -126 + Math.sin(a) * 8); starPath(g, 0, 0, 7, 3); fs(g, '#ffe066', 1.5); g.restore(); } }
  g.restore();
}
