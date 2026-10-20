'use strict';
// =====================================================================
//  Helden, Prinzessin Lunara und Schattenkönig Morvax (Vektorgrafik)
// =====================================================================
const CHARS = [
  { id: 'flitz', name: 'Flitz', color: '#4f8ff7', kind: 'Fuchs',
    fur: '#5b9cff', furDark: '#2858b8', furLight: '#b8d6ff', muzzle: '#f4f8ff',
    outfit: '#24345e', outfitDark: '#141d3a', trim: '#ffffff', boots: '#3a2a22', glove: '#ffffff',
    speed: 1.1, jump: 1.0, special: 'dash', spName: 'Sprint',
    desc: 'Der Schnellste. Spezial: blitzschneller Sprint, auch mitten im Sprung.' },
  { id: 'rumpel', name: 'Rumpel', color: '#ef5350', kind: 'Stier',
    fur: '#d9483e', furDark: '#8a1e1c', furLight: '#ff9a88', muzzle: '#f2c9a0',
    outfit: '#3a3238', outfitDark: '#201a20', trim: '#ffc531', boots: '#2a1c18', glove: '#ffc9a0',
    speed: .97, jump: .98, special: 'ramm', spName: 'Rammstoss',
    desc: 'Stark wie ein Stier. Spezial: Rammstoss zerschmettert Blöcke und Gegner.' },
  { id: 'hops', name: 'Hops', color: '#3fbf5a', kind: 'Frosch',
    fur: '#4fcf5e', furDark: '#1f7a35', furLight: '#b8f5a0', muzzle: '#eaffd8',
    outfit: '#8a5a2e', outfitDark: '#5a3818', trim: '#ffe08a', boots: '#3a5a22', glove: '#eaffd8',
    speed: 1.0, jump: 1.08, special: 'zunge', spName: 'Zunge',
    desc: 'Springt am höchsten und doppelt. Spezial: Zunge schnappt Gegner und Münzen.' },
  { id: 'schwebi', name: 'Schwebi', color: '#ffc531', kind: 'Biene',
    fur: '#ffd04a', furDark: '#c47a0a', furLight: '#fff2a8', muzzle: '#fff8e0',
    outfit: '#2a2230', outfitDark: '#16121c', trim: '#ffd04a', boots: '#2a2230', glove: '#fff8e0',
    speed: 1.0, jump: 1.0, special: 'schweben', spName: 'Schweben',
    desc: 'Leicht wie eine Feder. Spezial: Taste halten und durch die Luft schweben.' },
];
const PLAYER_TAG = ['P1', 'P2', 'P3', 'P4'];
const OL = '#1c1428';     // Umrisslinie

function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function radial(g, x, y, r, c0, c1, c2) {
  const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1);
  gr.addColorStop(0, c0); gr.addColorStop(.55, c1); gr.addColorStop(1, c2 || c1);
  return gr;
}
function fs(g, fill, lw = 2.4) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); }
function limb(g, x1, y1, x2, y2, w, col, mx, my) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x1, y1);
  if (mx !== undefined) g.quadraticCurveTo(mx, my, x2, y2); else g.lineTo(x2, y2);
  g.strokeStyle = OL; g.lineWidth = w + 4.6; g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
// Farben je nach Verwandlung
function heroPal(ch, power) {
  const p = { fur: ch.fur, furDark: ch.furDark, furLight: ch.furLight, muzzle: ch.muzzle, outfit: ch.outfit, outfitDark: ch.outfitDark, trim: ch.trim, boots: ch.boots, glove: ch.glove };
  if (power === 2) Object.assign(p, { outfit: '#fff1e0', outfitDark: '#f0b880', trim: '#ff5a1a', boots: '#c83a10', glove: '#ffffff' });
  if (power === 3) Object.assign(p, { outfit: '#e6faff', outfitDark: '#8ccbe8', trim: '#2a9ae0', boots: '#2a6ab0', glove: '#ffffff' });
  if (power === 4) Object.assign(p, { trim: '#7ee05a' });
  return p;
}

// ---------------------------------------------------------------------
//  Held   o: x, y (Füsse), s, face, t, walk, state, power, blink, alpha,
//            star, rot, look, speed, sx, sy, carry
// ---------------------------------------------------------------------
function drawHero(g, ch, o) {
  const st = o.state || 'stand', ph = o.walk || 0, t = o.t || 0;
  const pal = heroPal(ch, o.power);
  g.save();
  g.translate(o.x, o.y);
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  g.scale(o.s * (o.sx || 1), o.s * (o.sy || 1));
  if (o.rot) { g.translate(0, -34); g.rotate(o.rot); g.translate(0, 34); }
  g.scale(o.face || 1, 1);
  if (st === 'slide') { g.translate(0, -2); g.rotate(1.25); g.translate(-6, 26); }
  const bob = st === 'run' ? -Math.abs(Math.sin(ph)) * 3 : st === 'stand' ? Math.sin(t * 2.4) * 1 : 0;
  const flap = Math.sin(t * 30);

  if (o.star) {
    const hue = (t * 400) % 360;
    const gl = g.createRadialGradient(0, -34, 10, 0, -34, 64);
    gl.addColorStop(0, `hsla(${hue},100%,70%,.55)`); gl.addColorStop(1, `hsla(${(hue + 90) % 360},100%,60%,0)`);
    g.fillStyle = gl; g.beginPath(); g.arc(0, -34, 64, 0, TAU); g.fill();
  } else if (o.power === 2 || o.power === 3) {
    const gl = g.createRadialGradient(0, -34, 14, 0, -34, 54);
    gl.addColorStop(0, o.power === 2 ? 'rgba(255,140,40,.3)' : 'rgba(120,220,255,.32)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, -34, 54, 0, TAU); g.fill();
  }

  // ----- Haltung -----
  let L1 = [-7, -3], L2 = [7, -3], A1 = [-16, -24], A2 = [17, -22], lean = 0;
  if (st === 'run') {
    const s1 = Math.sin(ph), c1 = Math.cos(ph);
    L1 = [-4 + s1 * 11, -3 - Math.max(0, c1) * 8]; L2 = [4 - s1 * 11, -3 - Math.max(0, -c1) * 8];
    A1 = [-6 - s1 * 12, -22 + Math.abs(s1) * 2]; A2 = [8 + s1 * 12, -22 + Math.abs(s1) * 2]; lean = .08;
  } else if (st === 'jump') { L1 = [-10, -10]; L2 = [8, -4]; A1 = [-14, -48]; A2 = [16, -50]; }
  else if (st === 'fall') { L1 = [-9, -2]; L2 = [10, -8]; A1 = [-20, -36]; A2 = [20, -38]; }
  else if (st === 'pound') { L1 = [-7, -14]; L2 = [7, -14]; A1 = [-14, -30]; A2 = [14, -30]; }
  else if (st === 'wall') { L1 = [-4, -5]; L2 = [12, -14]; A1 = [-16, -40]; A2 = [18, -42]; }
  else if (st === 'dash') { L1 = [-16, -8]; L2 = [-2, -5]; A1 = [-20, -28]; A2 = [22, -30]; lean = .25; }
  else if (st === 'float' || st === 'whirl') { L1 = [-8, -6]; L2 = [8, -6]; A1 = [-22, -36 + flap * 3]; A2 = [22, -36 - flap * 3]; }
  else if (st === 'swim') { const s1 = Math.sin(t * 9); L1 = [-12 + s1 * 6, -6]; L2 = [-12 - s1 * 6, -12]; A1 = [14 + s1 * 6, -40]; A2 = [22 - s1 * 6, -30]; lean = .6; }
  else if (st === 'carry') { A1 = [-9, -60]; A2 = [11, -60]; if (o.speed > .1) { const s1 = Math.sin(ph); L1 = [-4 + s1 * 9, -3 - Math.max(0, Math.cos(ph)) * 6]; L2 = [4 - s1 * 9, -3 - Math.max(0, -Math.cos(ph)) * 6]; } }
  else if (st === 'throw') { A1 = [-18, -30]; A2 = [26, -44]; }
  else if (st === 'goal') { A1 = [-16, -58]; A2 = [17, -60]; L1 = [-9, -4]; L2 = [9, -4]; }
  else if (st === 'dead') { A1 = [-20, -52]; A2 = [20, -52]; L1 = [-12, -6]; L2 = [12, -6]; }
  else if (st === 'slide') { A1 = [18, -34]; A2 = [22, -26]; L1 = [-10, -2]; L2 = [-4, -2]; }
  if (lean) { g.rotate(lean); }

  // ----- hinten: Schwanz, Umhang, Flügel -----
  if (ch.id === 'flitz' && o.power !== 5) {
    const wv = Math.sin(t * 6 + (st === 'run' ? ph : 0)) * 6;
    g.beginPath(); g.moveTo(-10, -22 + bob);
    g.bezierCurveTo(-30, -26 + wv, -40, -40 + wv, -30, -48 + wv);
    g.bezierCurveTo(-24, -40 + wv, -18, -30, -8, -18 + bob);
    fs(g, pal.fur);
    g.beginPath(); g.moveTo(-32, -45 + wv); g.bezierCurveTo(-36, -40 + wv, -34, -36 + wv, -30, -38 + wv); g.quadraticCurveTo(-26, -46 + wv, -30, -48 + wv); g.fillStyle = pal.muzzle; g.fill();
  }
  if (ch.id === 'flitz') {   // flatternder Schal
    const wv = Math.sin(t * 14) * 3 * (st === 'run' || st === 'dash' ? 1.8 : .6);
    g.beginPath(); g.moveTo(-6, -38 + bob); g.quadraticCurveTo(-20, -40 + wv, -34, -34 - wv); g.lineTo(-32, -28 - wv); g.quadraticCurveTo(-18, -32 + wv, -6, -32 + bob);
    fs(g, '#ffffff', 2);
  }
  if (ch.id === 'hops' && o.power !== 5) {   // Blätter-Umhang
    g.beginPath(); g.moveTo(-10, -38 + bob);
    g.quadraticCurveTo(-26, -22, -22, -8 + Math.sin(t * 5) * 2); g.lineTo(-14, -12); g.lineTo(-10, -6); g.lineTo(-4, -14); g.lineTo(2, -30 + bob); g.closePath();
    fs(g, '#5ab84a');
    g.strokeStyle = 'rgba(30,90,30,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, -34); g.lineTo(-18, -14); g.stroke();
  }
  if (ch.id === 'schwebi' || o.power === 4) {
    const big = ch.id === 'schwebi' ? 1 : 0;
    if (big) {
      const fl = (st === 'float' || st === 'fall' || st === 'jump') ? flap : Math.sin(t * 4) * .3;
      for (const k of [0, 1]) {
        g.save(); g.translate(-8, -36 + bob); g.rotate(-.6 - fl * .4 - k * .35);
        g.beginPath(); g.ellipse(-14, -4, 16, 8, 0, 0, TAU);
        g.fillStyle = k ? 'rgba(200,240,255,.5)' : 'rgba(230,250,255,.7)'; g.fill();
        g.lineWidth = 1.6; g.strokeStyle = 'rgba(40,40,80,.45)'; g.stroke();
        g.restore();
      }
    }
  }

  // ----- Beine und Stiefel -----
  const hipY = -17 + bob;
  const legCol = o.power === 5 ? '#f4f8ff' : pal.outfitDark;
  limb(g, -5, hipY, L1[0], L1[1] - 4, 7, legCol);
  limb(g, 5, hipY, L2[0], L2[1] - 4, 7, legCol);
  for (const [fx, fy] of [L1, L2]) {
    ell(g, fx + 3, fy - 1, 8.5, 5.5); fs(g, o.power === 5 ? '#d8e8f8' : pal.boots, 2.2);
    g.fillStyle = 'rgba(255,255,255,.25)'; ell(g, fx + 3, fy - 3.5, 4, 1.6); g.fill();
  }
  // ----- hinterer Arm -----
  const shY = -31 + bob;
  const armCol = o.power === 5 ? '#f4f8ff' : (ch.id === 'hops' || ch.id === 'schwebi' ? pal.fur : pal.outfit);
  limb(g, -8, shY, A1[0], A1[1] + bob, 6.5, armCol);
  g.beginPath(); g.arc(A1[0], A1[1] + bob, 5.2, 0, TAU); fs(g, pal.glove, 2.2);

  // ----- Körper -----
  if (o.power === 5) {   // Eisbär-Anzug
    g.beginPath(); g.ellipse(0, -25 + bob, 16, 15, 0, 0, TAU); fs(g, '#f6faff');
    g.fillStyle = '#9ad4ff'; ell(g, 3, -22 + bob, 9, 10); g.fill();
  } else {
    g.beginPath();
    g.moveTo(-13, -16 + bob); g.quadraticCurveTo(-15, -34 + bob, -9, -38 + bob); g.lineTo(9, -38 + bob); g.quadraticCurveTo(15, -34 + bob, 13, -16 + bob);
    g.quadraticCurveTo(0, -12 + bob, -13, -16 + bob); g.closePath();
    const tg = g.createLinearGradient(0, -38 + bob, 0, -14 + bob); tg.addColorStop(0, pal.outfit); tg.addColorStop(1, pal.outfitDark);
    fs(g, tg);
    if (ch.id === 'schwebi' && o.power < 2) {   // Streifen
      g.save(); g.clip(); g.fillStyle = pal.trim; g.fillRect(-16, -32 + bob, 32, 5); g.fillRect(-16, -24 + bob, 32, 5); g.restore();
    }
    // Gürtel
    g.fillStyle = ch.id === 'rumpel' ? '#5a3a1e' : pal.outfitDark; g.fillRect(-13, -21 + bob, 26, 4);
    g.fillStyle = pal.trim; rr(g, -3, -22.5 + bob, 7, 6.5, 2); g.fill();
    if (o.power === 2) { g.fillStyle = '#ff6a1a'; g.beginPath(); g.moveTo(1, -26 + bob); g.quadraticCurveTo(-5, -31 + bob, 0, -37 + bob); g.quadraticCurveTo(3, -32 + bob, 5, -34 + bob); g.quadraticCurveTo(8, -28 + bob, 1, -26 + bob); g.fill(); }
    if (o.power === 3) { g.strokeStyle = '#2a9ae0'; g.lineWidth = 1.8; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(1 + Math.cos(a) * 5, -31 + bob + Math.sin(a) * 5); g.lineTo(1 - Math.cos(a) * 5, -31 + bob - Math.sin(a) * 5); g.stroke(); } }
    if (ch.id === 'hops') { g.strokeStyle = '#5a3818'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -37 + bob); g.lineTo(11, -19 + bob); g.stroke(); }
  }

  // ----- Kopf -----
  const hx = 2, hy = -50 + bob;
  // Ohren / Hörner / Fühler hinten
  if (o.power === 5) {
    for (const ex of [-10, 12]) { g.beginPath(); g.arc(hx + ex, hy - 14, 6.5, 0, TAU); fs(g, '#f6faff'); g.fillStyle = '#ffc0d0'; g.beginPath(); g.arc(hx + ex, hy - 14, 3, 0, TAU); g.fill(); }
  } else if (ch.id === 'flitz') {
    for (const [ex, rot] of [[-9, -.4], [9, .3]]) {
      g.save(); g.translate(hx + ex, hy - 11); g.rotate(rot);
      g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(-4, -20, 1, -21); g.quadraticCurveTo(8, -10, 8, 4); fs(g, pal.fur);
      g.beginPath(); g.moveTo(-4, 2); g.quadraticCurveTo(-1, -13, 1, -14); g.quadraticCurveTo(4, -6, 4, 2); g.fillStyle = pal.furLight; g.fill();
      g.restore();
    }
  } else if (ch.id === 'rumpel') {
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(hx + dir * 10, hy - 10); g.quadraticCurveTo(hx + dir * 24, hy - 12, hx + dir * 24, hy - 26);
      g.quadraticCurveTo(hx + dir * 18, hy - 17, hx + dir * 8, hy - 15); g.closePath();
      fs(g, '#fff0d0', 2);
    }
  } else if (ch.id === 'schwebi') {
    g.strokeStyle = OL; g.lineWidth = 2.4; g.lineCap = 'round';
    for (const ex of [-5, 8]) {
      const sw = Math.sin(t * 5 + ex) * 3;
      g.beginPath(); g.moveTo(hx + ex, hy - 14); g.quadraticCurveTo(hx + ex + 3, hy - 26, hx + ex + 6 + sw, hy - 32); g.stroke();
      g.beginPath(); g.arc(hx + ex + 6 + sw, hy - 32, 4, 0, TAU); fs(g, '#ffe066', 2);
    }
  }
  // Kopfform
  g.beginPath(); g.arc(hx, hy, 17.5, 0, TAU);
  fs(g, o.power === 5 ? '#f6faff' : radial(g, hx, hy, 18, pal.furLight, pal.fur, pal.furDark));
  if (o.power === 5) { g.beginPath(); g.arc(hx + 3, hy + 2, 12.5, 0, TAU); g.fillStyle = pal.fur; g.fill(); }
  // Schnauze
  if (ch.id === 'flitz') { g.beginPath(); g.moveTo(hx + 4, hy + 2); g.quadraticCurveTo(hx + 22, hy + 3, hx + 22, hy + 8); g.quadraticCurveTo(hx + 12, hy + 15, hx + 2, hy + 12); g.closePath(); fs(g, pal.muzzle, 2); g.beginPath(); g.arc(hx + 21, hy + 5, 2.6, 0, TAU); g.fillStyle = OL; g.fill(); }
  else if (ch.id === 'rumpel') { g.beginPath(); g.ellipse(hx + 11, hy + 7, 10, 7.5, 0, 0, TAU); fs(g, pal.muzzle, 2); g.fillStyle = '#6a3a2a'; ell(g, hx + 9, hy + 6, 1.6, 2.2); g.fill(); ell(g, hx + 15, hy + 6, 1.6, 2.2); g.fill(); }
  else if (ch.id === 'hops') { g.beginPath(); g.ellipse(hx + 5, hy + 8, 13, 6, 0, 0, Math.PI); g.fillStyle = pal.muzzle; g.fill(); }
  else if (ch.id === 'schwebi') { g.fillStyle = '#2a2230'; g.beginPath(); g.arc(hx - 2, hy - 14, 9, Math.PI * 1.05, Math.PI * 1.95); g.fill(); }
  // Augen
  const look = clamp(o.look || 0, -1, 1);
  const blink = o.blink ? .14 : 1;
  const eyes = ch.id === 'hops' ? [[hx - 2, hy - 13, 7, 8], [hx + 12, hy - 12, 7, 8]] : [[hx + 1, hy - 3, 5, 6.6], [hx + 11, hy - 3, 5, 6.6]];
  if (ch.id === 'hops' && o.power !== 5) for (const [ex, ey] of eyes) { g.beginPath(); g.arc(ex, ey + 1, 9, 0, TAU); fs(g, pal.fur, 2); }
  for (const [ex, ey, rx, ry] of eyes) {
    g.fillStyle = '#ffffff'; ell(g, ex, ey, rx, ry * blink); g.fill();
    g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke();
    if (blink > .5) {
      if (st === 'dead') { g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 3, ey - 3); g.lineTo(ex + 3, ey + 3); g.moveTo(ex + 3, ey - 3); g.lineTo(ex - 3, ey + 3); g.stroke(); }
      else {
        g.fillStyle = ch.id === 'rumpel' ? '#3a1a10' : '#16122a'; ell(g, ex + 1.5 + look, ey + .6, rx * .58, ry * .66); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + 2.6 + look, ey - 1.6, 1.5, 0, TAU); g.fill();
      }
    }
  }
  // Brauen (entschlossen)
  g.strokeStyle = OL; g.lineWidth = 2.6; g.lineCap = 'round';
  if (ch.id !== 'hops') { g.beginPath(); g.moveTo(hx - 3, hy - 12); g.lineTo(hx + 5, hy - 10); g.moveTo(hx + 8, hy - 10); g.lineTo(hx + 15, hy - 12); g.stroke(); }
  // Schutzbrille (Flitz)
  if (ch.id === 'flitz' && o.power !== 5) {
    g.fillStyle = '#5a4a3a'; g.fillRect(hx - 16, hy - 17, 32, 4);
    for (const ex of [hx - 3, hx + 8]) { g.beginPath(); g.arc(ex, hy - 16, 4.2, 0, TAU); fs(g, '#ffb03a', 1.6); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(ex - 1, hy - 17, 1.4, 0, TAU); g.fill(); }
  }
  // Mund
  g.strokeStyle = OL; g.lineWidth = 2; g.lineCap = 'round';
  if (st === 'jump' || st === 'pound' || st === 'dead' || st === 'goal' || st === 'throw') {
    g.fillStyle = '#7a1e2e'; ell(g, hx + 10, hy + 9, 3.6, st === 'dead' ? 2 : 4.2); g.fill(); g.stroke();
  } else if (ch.id === 'hops') { g.beginPath(); g.moveTo(hx - 6, hy + 6); g.quadraticCurveTo(hx + 6, hy + 13, hx + 17, hy + 5); g.stroke(); }
  else if (ch.id === 'flitz') { g.beginPath(); g.moveTo(hx + 10, hy + 11); g.quadraticCurveTo(hx + 15, hy + 13, hx + 19, hy + 10); g.stroke(); }
  else { g.beginPath(); g.arc(hx + 9, hy + 5, 4.2, .25, Math.PI - .5); g.stroke(); }
  g.fillStyle = 'rgba(255,110,130,.45)'; ell(g, hx - 6, hy + 5, 3.4, 2.2); g.fill();
  // Kopfbedeckung je nach Kraft
  if (o.power === 4) {   // Wirbelhut mit drehenden Blättern
    g.beginPath(); g.ellipse(hx, hy - 15, 14, 5, 0, 0, TAU); fs(g, '#4fbf3a', 2);
    g.beginPath(); g.moveTo(hx - 9, hy - 16); g.quadraticCurveTo(hx, hy - 30, hx + 9, hy - 16); fs(g, '#7ee05a', 2);
    g.beginPath(); g.moveTo(hx, hy - 27); g.lineTo(hx, hy - 33); g.strokeStyle = OL; g.lineWidth = 2.5; g.stroke();
    const rs = (o.whirl ? 40 : 6) * t;
    for (let k = 0; k < 3; k++) { const a = rs + k * TAU / 3; g.save(); g.translate(hx, hy - 34); g.scale(1, .32); g.rotate(a); g.beginPath(); g.ellipse(12, 0, 12, 4.5, 0, 0, TAU); fs(g, '#ffe066', 2); g.restore(); }
  } else if (o.power === 2) {
    const f = Math.sin(t * 16) * 2;
    g.beginPath(); g.moveTo(hx - 6, hy - 16); g.quadraticCurveTo(hx - 6, hy - 28, hx + f, hy - 35); g.quadraticCurveTo(hx + 8, hy - 26, hx + 7, hy - 16); fs(g, '#ff7a1a', 1.6);
  } else if (o.power === 3) {
    g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .35; g.moveTo(hx + Math.cos(a) * 12, hy - 8 + Math.sin(a) * 12); g.lineTo(hx + Math.cos(a) * 22, hy - 8 + Math.sin(a) * 22); }
    g.strokeStyle = '#bfefff'; g.lineWidth = 3.5; g.stroke();
  }
  if (ch.id === 'hops' && o.power < 2) {   // Blatt auf dem Kopf
    g.save(); g.translate(hx + 4, hy - 20); g.rotate(-.2 + Math.sin(t * 3) * .1);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -14, 16, -8); g.quadraticCurveTo(8, -2, 0, 0); fs(g, '#7ee05a', 1.8);
    g.restore();
  }
  // ----- vorderer Arm -----
  limb(g, 8, shY, A2[0], A2[1] + bob, 6.5, armCol);
  g.beginPath(); g.arc(A2[0], A2[1] + bob, 5.4, 0, TAU); fs(g, pal.glove, 2.2);
  if (ch.id === 'rumpel' && o.power !== 5) { g.fillStyle = pal.trim; g.beginPath(); g.arc(A2[0] - 2, A2[1] + bob + 1, 2, 0, TAU); g.fill(); }
  g.restore();
}

// ---------------------------------------------------------------------
//  Prinzessin Lunara
// ---------------------------------------------------------------------
function drawPrincess(g, x, y, s, t, mood = 'froh', face = 1) {
  g.save(); g.translate(x, y); g.scale(s * face, s);
  const sway = Math.sin(t * 2) * 2;
  // Haare hinten
  g.beginPath(); g.moveTo(-14, -66); g.quadraticCurveTo(-28, -40, -20 + sway, -18); g.quadraticCurveTo(-8, -26, -6, -40); g.closePath(); fs(g, '#e8ecff');
  // Kleid
  g.beginPath(); g.moveTo(-10, -42); g.quadraticCurveTo(-30, -10, -26 + sway, 0); g.lineTo(26 + sway, 0); g.quadraticCurveTo(30, -10, 10, -42); g.closePath();
  const dg = g.createLinearGradient(0, -42, 0, 0); dg.addColorStop(0, '#c9a8ff'); dg.addColorStop(1, '#7a52d8'); fs(g, dg);
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-22 + sway, -6); g.quadraticCurveTo(0, -2, 22 + sway, -6); g.stroke();
  g.fillStyle = '#fff4c0'; for (let i = 0; i < 4; i++) { starPath(g, -14 + i * 9 + sway * .5, -14 + (i % 2) * 6, 2.6, 1.1); g.fill(); }
  // Oberkörper
  g.beginPath(); g.moveTo(-9, -44); g.lineTo(9, -44); g.lineTo(7, -30); g.lineTo(-7, -30); g.closePath(); fs(g, '#e2d0ff', 2);
  // Arme
  const up = mood === 'hilfe';
  limb(g, -8, -42, up ? -16 : -14, up ? -60 : -28, 4.5, '#ffe4d4');
  limb(g, 8, -42, up ? 16 : 14, up ? -60 : -28, 4.5, '#ffe4d4');
  // Kopf
  g.beginPath(); g.arc(0, -56, 12, 0, TAU); fs(g, '#ffe4d4');
  g.beginPath(); g.moveTo(-13, -56); g.quadraticCurveTo(-12, -72, 2, -70); g.quadraticCurveTo(14, -70, 13, -56); g.quadraticCurveTo(6, -64, -2, -62); g.quadraticCurveTo(-8, -60, -13, -56); fs(g, '#f2f4ff', 2);
  // Diadem mit Mond
  g.beginPath(); g.moveTo(-8, -67); g.lineTo(8, -67); g.lineTo(6, -72); g.lineTo(0, -70); g.lineTo(-6, -72); g.closePath(); fs(g, '#ffd23a', 1.6);
  g.beginPath(); g.arc(0, -77, 5, Math.PI * .3, Math.PI * 1.7); g.arc(2, -77, 3.8, Math.PI * 1.6, Math.PI * .4, true); fs(g, '#fff6c0', 1.4);
  // Gesicht
  const sad = mood === 'hilfe' || mood === 'traurig';
  g.fillStyle = '#2a1a4a'; ell(g, 4, -56, 1.8, sad ? 2.6 : 2.4); g.fill(); ell(g, -3, -56, 1.8, sad ? 2.6 : 2.4); g.fill();
  g.strokeStyle = OL; g.lineWidth = 1.4; g.beginPath();
  if (sad) g.arc(1, -48, 3, Math.PI + .4, -.4); else g.arc(1, -51, 3, .3, Math.PI - .3);
  g.stroke();
  g.fillStyle = 'rgba(255,120,150,.4)'; ell(g, 7, -52, 2.4, 1.6); g.fill(); ell(g, -6, -52, 2.4, 1.6); g.fill();
  g.restore();
}

// ---------------------------------------------------------------------
//  Morvax, der Schattenkönig
// ---------------------------------------------------------------------
function drawMorvax(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * (o.face || 1), s);
  const hurt = o.hurt && Math.floor(t * 20) % 2 === 0;
  const fl = Math.sin(t * 3) * 4;
  // Schattenaura
  const au = g.createRadialGradient(0, -90, 20, 0, -90, 130);
  au.addColorStop(0, 'rgba(120,40,200,.35)'); au.addColorStop(1, 'rgba(40,0,80,0)');
  g.fillStyle = au; g.beginPath(); g.arc(0, -90, 130, 0, TAU); g.fill();
  // Umhang
  g.beginPath(); g.moveTo(-30, -130); g.quadraticCurveTo(-80, -60, -70 + fl, 0); g.lineTo(-40, -10); g.lineTo(-20, 2); g.lineTo(0, -8); g.lineTo(20, 2); g.lineTo(40, -10); g.lineTo(70 - fl, 0); g.quadraticCurveTo(80, -60, 30, -130); g.closePath();
  const cg = g.createLinearGradient(0, -130, 0, 0); cg.addColorStop(0, '#3a1050'); cg.addColorStop(1, '#12051c'); fs(g, cg, 3);
  g.fillStyle = '#8a1a2a'; g.beginPath(); g.moveTo(-26, -126); g.quadraticCurveTo(-50, -70, -40, -14); g.lineTo(-30, -16); g.quadraticCurveTo(-34, -80, -18, -126); g.fill();
  // Körper / Rüstung
  g.beginPath(); g.moveTo(-28, -130); g.quadraticCurveTo(-36, -70, -22, -30); g.lineTo(22, -30); g.quadraticCurveTo(36, -70, 28, -130); g.closePath();
  const bg = g.createLinearGradient(-30, 0, 30, 0); bg.addColorStop(0, hurt ? '#ffffff' : '#4a3a5e'); bg.addColorStop(.5, hurt ? '#ffd0d0' : '#6a5a80'); bg.addColorStop(1, '#2a1e3a'); fs(g, bg, 3);
  g.fillStyle = '#c03aff'; g.beginPath(); g.arc(0, -86, 7, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-2, -88, 2, 0, TAU); g.fill();
  // Beine
  limb(g, -12, -32, -16, -4, 12, '#2a1e3a'); limb(g, 12, -32, 16, -4, 12, '#2a1e3a');
  // Arme mit Klauen
  const raise = o.cast ? -40 : 0;
  limb(g, -26, -118, -48, -76 + raise, 11, '#3a2a4e'); limb(g, 26, -118, 50, -80 + raise, 11, '#3a2a4e');
  for (const hxp of [[-48, -76 + raise], [50, -80 + raise]]) { g.beginPath(); g.arc(hxp[0], hxp[1], 8, 0, TAU); fs(g, '#5a2a6e', 2.5); }
  if (o.cast) { const gl = g.createRadialGradient(50, -120, 2, 50, -120, 30); gl.addColorStop(0, 'rgba(255,120,255,.9)'); gl.addColorStop(1, 'rgba(160,40,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(50, -120, 30, 0, TAU); g.fill(); }
  // Kopf
  g.beginPath(); g.ellipse(0, -150, 26, 28, 0, 0, TAU);
  fs(g, hurt ? '#ffffff' : radial(g, 0, -150, 28, '#6a5a7a', '#3a2a4a', '#1a1024'), 3);
  // Hörner-Krone
  g.beginPath(); g.moveTo(-24, -166); g.quadraticCurveTo(-46, -190, -38, -214); g.quadraticCurveTo(-32, -186, -14, -176); g.closePath(); fs(g, '#d8d0e0', 2.5);
  g.beginPath(); g.moveTo(24, -166); g.quadraticCurveTo(46, -190, 38, -214); g.quadraticCurveTo(32, -186, 14, -176); g.closePath(); fs(g, '#d8d0e0', 2.5);
  g.beginPath(); g.moveTo(-18, -172); g.lineTo(-12, -192); g.lineTo(-4, -178); g.lineTo(0, -196); g.lineTo(4, -178); g.lineTo(12, -192); g.lineTo(18, -172); g.closePath(); fs(g, '#7a1a9a', 2.5);
  // Augen
  const eg = o.angry ? '#ff2a2a' : '#ff6a3a';
  g.fillStyle = eg; g.shadowColor = eg; g.shadowBlur = 12;
  g.beginPath(); g.moveTo(-16, -152); g.lineTo(-4, -148); g.lineTo(-6, -144); g.lineTo(-16, -146); g.fill();
  g.beginPath(); g.moveTo(16, -152); g.lineTo(4, -148); g.lineTo(6, -144); g.lineTo(16, -146); g.fill();
  g.shadowBlur = 0;
  // Mund
  g.fillStyle = '#12051c'; g.beginPath(); g.moveTo(-12, -134); g.quadraticCurveTo(0, -126, 12, -134); g.quadraticCurveTo(0, -130, -12, -134); g.fill();
  g.fillStyle = '#fff'; for (const tx of [-7, 5]) { g.beginPath(); g.moveTo(tx, -133); g.lineTo(tx + 2, -128); g.lineTo(tx + 4, -133); g.fill(); }
  g.restore();
}

// Kopf allein (für Anzeigen)
function drawHeroIcon(g, ch, x, y, s, t = 0, power = 1) {
  drawHero(g, ch, { x, y: y + 40 * s, s, face: 1, t, state: 'stand', power });
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
