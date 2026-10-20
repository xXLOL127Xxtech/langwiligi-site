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
function drawLavaball(g, e, t) {
  const r = e.kind === 'magma' ? 12 : 17;
  const up = (e.vy || 0) < 0;
  g.save(); if (!up) { g.scale(1, -1); g.translate(0, 36); }
  const fl = Math.sin(t * 20) * 3;
  g.fillStyle = 'rgba(255,120,30,.5)';
  g.beginPath(); g.moveTo(-r * .8, -16); g.quadraticCurveTo(-8 + fl, 12, 0, 22); g.quadraticCurveTo(8 - fl, 12, r * .8, -16); g.fill();
  g.restore();
  const gl = g.createRadialGradient(0, -18, 4, 0, -18, r * 2);
  gl.addColorStop(0, 'rgba(255,200,80,.6)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, -18, r * 2, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, -18, r, 0, TAU); fs(g, radial(g, 0, -18, r, '#fff6b0', '#ffa21a', '#d0300a'), 2);
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
  const p = Math.sin(t * 3);
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
  1: { name: 'Magma-Koloss', body: ['#7a6a72', '#4a3a42', '#241a20'], glow: [255, 140, 40], crown: '#ffcc33' },
  2: { name: 'Sand-Koloss', body: ['#e0c08a', '#a8804a', '#5a3a1a'], glow: [255, 220, 90], crown: '#ff9a2a' },
  3: { name: 'Frost-Koloss', body: ['#c8e8ff', '#6aa0d0', '#2a4a7a'], glow: [120, 230, 255], crown: '#e8f8ff' },
  4: { name: 'Korallen-Koloss', body: ['#ff9ab0', '#c84a6a', '#5a1a30'], glow: [120, 255, 220], crown: '#ffd23a' },
  5: { name: 'Sturm-Koloss', body: ['#9aa8c8', '#4a5878', '#1a2238'], glow: [255, 255, 120], crown: '#c0c8ff' },
  6: { name: 'Kristall-Koloss', body: ['#c8a8ff', '#6a4aa8', '#2a1a58'], glow: [255, 130, 230], crown: '#7fe8ff' },
  7: { name: 'Moor-Koloss', body: ['#7a9a6a', '#3a5a32', '#14240e'], glow: [190, 255, 60], crown: '#c8a85a' },
};
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
  const arm = b.state === 'throw' ? -1 : Math.sin(t * 3) * .3;
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
