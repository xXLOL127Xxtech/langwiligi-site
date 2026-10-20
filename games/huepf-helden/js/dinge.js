'use strict';
// =====================================================================
//  Gegenstände, Blöcke, Münzen, Plattformen, Ziel
// =====================================================================
const ITEM_INFO = {
  beere:  { name: 'Kraftbeere', power: 1, desc: 'Macht gross und stark.' },
  bluete: { name: 'Glutblüte', power: 2, desc: 'Feuerbälle mit der Spezial-Taste.' },
  frost:  { name: 'Frostblüte', power: 3, desc: 'Eiskugeln frieren Gegner zu Eisblöcken ein.' },
  wirbel: { name: 'Wirbelhut', power: 4, desc: 'Spezial-Taste: hoch hinauf wirbeln und langsam gleiten.' },
  eisbaer:{ name: 'Eisbär-Anzug', power: 5, desc: 'Rutscht auf dem Bauch, schwimmt schnell, wirft Eis und rutscht nie aus.' },
  stern:  { name: 'Funkelstern', power: -1, desc: 'Kurze Zeit unverwundbar.' },
};
const POWER_ITEM = { 1: 'beere', 2: 'bluete', 3: 'frost', 4: 'wirbel', 5: 'eisbaer' };

function drawItem(g, it, t) {
  g.save();
  g.translate(it.x, it.y);
  drawItemIcon(g, it.kind, t);
  g.restore();
}
// Gegenstand mit Fusspunkt (0,0)
function drawItemIcon(g, kind, t) {
  switch (kind) {
    case 'beere': {
      g.beginPath(); g.arc(0, -17, 16, 0, TAU); fs(g, radial(g, 0, -18, 18, '#ff9ad0', '#e0287a', '#8a0a44'));
      g.fillStyle = 'rgba(255,255,255,.25)';
      for (const [dx, dy] of [[-7, -20], [3, -24], [8, -14], [-3, -10], [-9, -12], [6, -28]]) { g.beginPath(); g.arc(dx, dy, 3.5, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.75)'; ell(g, -6, -26, 5, 3, -.5); g.fill();
      for (let i = 0; i < 4; i++) { g.save(); g.translate(0, -33); g.rotate(-1.2 + i * .8); ell(g, 0, -5, 3.5, 7); fs(g, '#4fbf3a', 1.4); g.restore(); }
      break;
    }
    case 'bluete': case 'frost': {
      const fire = kind === 'bluete';
      limb(g, 0, 0, 0, -18, 4, '#2f9a3a');
      g.fillStyle = '#4fbf3a'; ell(g, -8, -6, 8, 4, -.4); g.fill(); ell(g, 8, -8, 8, 4, .4); g.fill();
      const fl = Math.sin(t * 10) * .1;
      for (let i = 0; i < 6; i++) {
        g.save(); g.translate(0, -28); g.rotate(i * TAU / 6 + fl);
        g.beginPath(); g.moveTo(-6, -4); g.quadraticCurveTo(-5, -16, 0, -20); g.quadraticCurveTo(5, -16, 6, -4); g.closePath();
        fs(g, fire ? (i % 2 ? '#ff7a1a' : '#ffb02a') : (i % 2 ? '#7fd8ff' : '#e0f8ff'), 1.6);
        g.restore();
      }
      g.beginPath(); g.arc(0, -28, 8, 0, TAU); fs(g, radial(g, 0, -28, 9, '#ffffff', fire ? '#fff07a' : '#c0f0ff', fire ? '#ffb02a' : '#5ac0f0'), 1.6);
      break;
    }
    case 'wirbel': {
      g.translate(0, -16);
      g.beginPath(); g.ellipse(0, 6, 17, 6, 0, 0, TAU); fs(g, '#4fbf3a', 2);
      g.beginPath(); g.moveTo(-11, 5); g.quadraticCurveTo(0, -16, 11, 5); fs(g, '#7ee05a', 2);
      limb(g, 0, -10, 0, -16, 2, '#3a3a3a');
      const a = t * 18;
      for (let k = 0; k < 3; k++) { g.save(); g.translate(0, -17); g.scale(1, .32); g.rotate(a + k * TAU / 3); ell(g, 12, 0, 12, 4.5); fs(g, '#ffe066', 2); g.restore(); }
      break;
    }
    case 'eisbaer': {
      g.translate(0, -18);
      g.beginPath(); g.arc(0, 0, 16, 0, TAU); fs(g, '#f6faff');
      for (const ex of [-11, 11]) { g.beginPath(); g.arc(ex, -12, 6, 0, TAU); fs(g, '#f6faff', 2); g.fillStyle = '#ffc0d0'; g.beginPath(); g.arc(ex, -12, 2.6, 0, TAU); g.fill(); }
      g.fillStyle = '#9ad4ff'; ell(g, 0, 5, 9, 7); g.fill();
      g.fillStyle = OL; g.beginPath(); g.arc(-5, -3, 2, 0, TAU); g.arc(5, -3, 2, 0, TAU); g.fill(); ell(g, 0, 2, 3, 2); g.fill();
      break;
    }
    case 'stern': {
      g.translate(0, -18); g.rotate(Math.sin(t * 6) * .2);
      const hue = (t * 300) % 360;
      const gl = g.createRadialGradient(0, 0, 4, 0, 0, 34);
      gl.addColorStop(0, `hsla(${hue},100%,75%,.6)`); gl.addColorStop(1, 'hsla(0,0%,100%,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
      starPath(g, 0, 0, 19, 9); fs(g, radial(g, 0, 0, 19, '#fffbe0', '#ffd23a', '#ff9a1a'), 2.2);
      g.fillStyle = OL; ell(g, -4, -2, 1.8, 3.2); g.fill(); ell(g, 4, -2, 1.8, 3.2); g.fill();
      break;
    }
    case 'herz': {
      g.translate(0, -18);
      g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-26, -2, -14, -24, 0, -10); g.bezierCurveTo(14, -24, 26, -2, 0, 14);
      fs(g, radial(g, 0, 0, 18, '#c0ffd0', '#3fd07a', '#1a8a4a'), 2.2);
      g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, -8, -8, 4, 3, -.6); g.fill();
      g.fillStyle = '#fff'; g.font = '11px ' + (typeof FONT !== 'undefined' ? FONT : 'sans-serif'); g.textAlign = 'center'; g.fillText('1UP', 0, 5);
      break;
    }
  }
}

// Münze: einmal fein vorgezeichnet, dann gestaucht gezeichnet (dreht sich)
let coinSprite = null;
function getCoinSprite() {
  if (coinSprite) return coinSprite;
  const S = 64, r = 26, c = document.createElement('canvas');
  c.width = S; c.height = S * 1.2;
  const g = c.getContext('2d');
  g.translate(S / 2, S * .6);
  g.fillStyle = '#a86400'; ell(g, 0, 0, r + 1.5, r * 1.18 + 1.5); g.fill();
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
  g.fillStyle = '#8a5000'; g.beginPath(); g.arc(0, 0, 26.5, 0, TAU); g.fill();
  g.fillStyle = '#c47e00'; g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
  g.fillStyle = radial(g, 0, 0, 23, '#fff6b8', '#ffd23a', '#e89a10'); g.beginPath(); g.arc(0, 0, 22.5, 0, TAU); g.fill();
  starPath(g, 0, 1, 14, 6.5);
  g.fillStyle = sx > 0 ? '#ffb01a' : '#e8960a'; g.fill();
  g.strokeStyle = 'rgba(160,90,0,.6)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, -9, -11, 4, 6, .4); g.fill();
  g.restore();
}

// Blöcke
function drawBlock(g, c, x, y, t, th) {
  if (c === TILE.B) {
    const [c1, c2] = th.brick;
    const grd = g.createLinearGradient(0, y, 0, y + T); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 6); g.fill();
    g.strokeStyle = 'rgba(40,10,0,.4)'; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x + 2, y + T / 2); g.lineTo(x + T - 2, y + T / 2);
    g.moveTo(x + T / 2, y + 2); g.lineTo(x + T / 2, y + T / 2);
    g.moveTo(x + T / 4, y + T / 2); g.lineTo(x + T / 4, y + T - 2);
    g.moveTo(x + T * .75, y + T / 2); g.lineTo(x + T * .75, y + T - 2);
    g.stroke();
    g.strokeStyle = OL; g.lineWidth = 2; rr(g, x + 1, y + 1, T - 2, T - 2, 6); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, x + 4, y + 4, T - 8, 4, 2); g.fill();
  } else if (c === TILE.Q) {
    const pulse = .5 + .5 * Math.sin(t * 4 + x * .05);
    const grd = g.createLinearGradient(x, y, x, y + T);
    grd.addColorStop(0, '#fff09a'); grd.addColorStop(.45, '#ffc21a'); grd.addColorStop(1, '#d0800a');
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 8); g.fill();
    g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(168,90,0,.7)'; g.lineWidth = 2; rr(g, x + 4, y + 4, T - 8, T - 8, 6); g.stroke();
    g.fillStyle = '#b86a00';
    for (const [dx, dy] of [[8, 8], [T - 8, 8], [8, T - 8], [T - 8, T - 8]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); }
    starPath(g, x + T / 2, y + T / 2 + 1, 13 + pulse * 1.5, 6);
    g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = 'rgba(160,80,0,.8)'; g.lineWidth = 1.6; g.stroke();
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
    grd.addColorStop(0, '#b08a62'); grd.addColorStop(1, '#6a4a2e');
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 8); g.fill();
    g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#4a2e18';
    for (const [dx, dy] of [[8, 8], [T - 8, 8], [8, T - 8], [T - 8, T - 8]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); }
  } else if (c === TILE.R) {
    // brüchiger Boden – Hinweis auf ein Geheimnis
    const [c1, c2] = th.stone;
    const grd = g.createLinearGradient(x, y, x, y + T); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; rr(g, x + 1, y + 1, T - 2, T - 2, 6); g.fill();
    g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(20,10,30,.75)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x + 8, y + 6); g.lineTo(x + 18, y + 20); g.lineTo(x + 12, y + 30); g.lineTo(x + 22, y + 42);
    g.moveTo(x + 18, y + 20); g.lineTo(x + 34, y + 16); g.lineTo(x + 40, y + 26); g.moveTo(x + 30, y + 30); g.lineTo(x + 38, y + 44); g.stroke();
  } else if (c === TILE.K) {
    // Tonkrug (daraus kommen Schnappkräuter)
    g.save(); g.translate(x + T / 2, y + T);
    g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(-24, -24, -14, -38); g.lineTo(-17, -46); g.lineTo(17, -46); g.lineTo(14, -38); g.quadraticCurveTo(24, -24, 18, 0); g.closePath();
    const kg = g.createLinearGradient(-20, 0, 20, 0); kg.addColorStop(0, '#d98a52'); kg.addColorStop(1, '#8a4a22'); fs(g, kg, 2.4);
    g.strokeStyle = 'rgba(255,230,180,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -22); g.quadraticCurveTo(0, -18, 18, -22); g.stroke();
    g.fillStyle = '#1a0e08'; ell(g, 0, -45, 15, 3.5); g.fill();
    g.restore();
  }
}

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
    const cols = { holz: ['#e0a050', '#8c5222'], stein: ['#e8b77a', '#a8743f'], kristall: ['#a888ff', '#4e2fae'], eis: ['#c8eeff', '#5ea9d6'], gitter: ['#9a96a8', '#3d3a48'], koralle: ['#ff9ab0', '#b84a6a'], schatten: ['#7a5a9a', '#2a1a3e'] }[th.plat] || ['#e0a050', '#8c5222'];
    const grd = g.createLinearGradient(0, y, 0, y + 22); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]);
    g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, x + 4, y + 18, w - 8, 8, 4); g.fill();
    rr(g, x, y, w, 22, 10); fs(g, grd, 2.2);
    g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, x + 6, y + 3, w - 12, 4, 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < w / T; i++) g.fillRect(x + i * T - 1, y + 6, 2, 12);
    if (p.mode === 'fall') { g.fillStyle = '#ff6a4a'; g.beginPath(); g.arc(x + w / 2, y + 12, 4, 0, TAU); g.fill(); }
  }
  g.restore();
}

function drawSpring(g, s, t) {
  const c = s.comp || 0;
  const h = 34 - c * 16;
  g.save(); g.translate(s.x, s.y);
  if (s.superf) {
    const gl = g.createRadialGradient(0, -20, 4, 0, -20, 60);
    gl.addColorStop(0, 'rgba(255,240,150,.55)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, -20, 60, 0, TAU); g.fill();
  }
  rr(g, -20, -8, 40, 8, 3); fs(g, '#4a4a5a', 2);
  g.strokeStyle = OL; g.lineWidth = 7; g.lineCap = 'round';
  const path = () => { g.beginPath(); for (let i = 0; i <= 8; i++) { const yy = -8 - (h - 16) * i / 8; const xx = i % 2 ? 13 : -13; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); } };
  path(); g.stroke(); g.strokeStyle = '#d0d4e4'; g.lineWidth = 4; path(); g.stroke();
  const grd = g.createLinearGradient(0, -h - 8, 0, -h + 4);
  if (s.superf) { grd.addColorStop(0, '#fff6a0'); grd.addColorStop(1, '#ffaa1a'); } else { grd.addColorStop(0, '#ff8a6a'); grd.addColorStop(1, '#c8301a'); }
  rr(g, -22, -h - 6, 44, 12, 6); fs(g, grd, 2.2);
  if (s.superf) { starPath(g, 0, -h, 5, 2.2); g.fillStyle = '#fff'; g.fill(); }
  g.restore();
}

function drawCheckpoint(g, c, t) {
  g.save(); g.translate(c.x, c.y);
  rr(g, -16, -10, 32, 10, 4); fs(g, '#5a5a6a', 2);
  rr(g, -3, -112, 6, 104, 3); fs(g, '#d8dce8', 2);
  const col = c.on ? ['#ffd23a', '#ff9a1a'] : ['#7a7488', '#4a4458'];
  const wv = Math.sin(t * 5) * 4;
  const grd = g.createLinearGradient(0, -108, 0, -70); grd.addColorStop(0, col[0]); grd.addColorStop(1, col[1]);
  g.beginPath(); g.moveTo(3, -108); g.quadraticCurveTo(24, -112 + wv, 50, -104 + wv); g.lineTo(50, -76 + wv); g.quadraticCurveTo(24, -84 + wv, 3, -78); g.closePath(); fs(g, grd, 2.2);
  if (c.on) { starPath(g, 26, -92 + wv * .6, 9, 4); g.fillStyle = '#ffffff'; g.fill(); }
  else { g.fillStyle = '#c03aff'; g.beginPath(); g.arc(26, -92 + wv * .6, 7, 0, TAU); g.fill(); g.fillStyle = '#2a0a3a'; g.beginPath(); g.arc(26, -92 + wv * .6, 3, 0, TAU); g.fill(); }
  g.beginPath(); g.arc(0, -114, 6, 0, TAU); fs(g, c.on ? '#fff3a0' : '#9a96a8', 2);
  if (c.on) { const gl = g.createRadialGradient(0, -114, 2, 0, -114, 30); gl.addColorStop(0, 'rgba(255,240,150,.6)'); gl.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, -114, 30, 0, TAU); g.fill(); }
  g.restore();
}

// Zielmast (normal: blau mit Stern; geheim: rot)
function drawGoal(g, z, t) {
  const top = z.top;
  g.save();
  rr(g, z.x - 24, z.y - 22, 48, 22, 6); fs(g, '#5a5a6a', 2.4);
  g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, z.x - 20, z.y - 20, 40, 4, 2); g.fill();
  const grd = g.createLinearGradient(z.x - 5, 0, z.x + 5, 0); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#9aa0b8');
  rr(g, z.x - 5, top, 10, z.y - 22 - top, 5); fs(g, grd, 2);
  if (!z.taken) {
    const by = top - 14 + Math.sin(t * 3) * 4;
    const gc = z.secret ? '255,90,90' : '255,240,150';
    const gl = g.createRadialGradient(z.x, by, 4, z.x, by, 50);
    gl.addColorStop(0, `rgba(${gc},.7)`); gl.addColorStop(1, `rgba(${gc},0)`);
    g.fillStyle = gl; g.beginPath(); g.arc(z.x, by, 50, 0, TAU); g.fill();
    g.save(); g.translate(z.x, by); g.rotate(t * .8);
    starPath(g, 0, 0, 20, 9);
    fs(g, z.secret ? radial(g, 0, 0, 20, '#ffffff', '#ff7a7a', '#c01a2a') : radial(g, 0, 0, 20, '#ffffff', '#ffe066', '#ffaa1a'), 2);
    g.restore();
  }
  const fy = z.flagY !== undefined ? z.flagY : top + 10;
  const wv = Math.sin(t * 6) * 3;
  g.beginPath(); g.moveTo(z.x - 5, fy); g.lineTo(z.x - 54, fy + 15 + wv); g.lineTo(z.x - 5, fy + 32);
  fs(g, z.secret ? '#e0283a' : '#4f8ff7', 2);
  g.fillStyle = '#ffffff'; starPath(g, z.x - 22, fy + 16 + wv * .5, 6, 2.6); g.fill();
  g.restore();
}
function drawTor(g, d, t) {
  const x = d.x, y = d.y;
  g.save();
  const grd = g.createLinearGradient(x - 90, 0, x + 90, 0); grd.addColorStop(0, '#c8b89a'); grd.addColorStop(1, '#8a7a5e');
  rr(g, x - 96, y - 200, 40, 200, 8); fs(g, grd, 2.5); rr(g, x + 56, y - 200, 40, 200, 8); fs(g, grd, 2.5);
  g.beginPath(); g.moveTo(x - 100, y - 190); g.quadraticCurveTo(x, y - 290, x + 100, y - 190); g.lineTo(x + 100, y - 160); g.quadraticCurveTo(x, y - 250, x - 100, y - 160); g.closePath(); fs(g, grd, 2.5);
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
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)'; ell(g, x - r * .4, y - r * .45, r * .18, r * .1, -.7); g.fill();
  g.restore();
}
// Lichtkugel am Ende eines Bosskampfs
function drawOrb(g, it, t) {
  const gl = g.createRadialGradient(it.x, it.y, 6, it.x, it.y, 70);
  gl.addColorStop(0, 'rgba(255,240,150,.8)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(it.x, it.y, 70, 0, TAU); g.fill();
  g.save(); g.translate(it.x, it.y); g.rotate(t);
  starPath(g, 0, 0, 30, 13); fs(g, radial(g, 0, 0, 30, '#ffffff', '#ffe066', '#ffaa1a'), 2.4);
  g.restore();
}
function drawShot(g, f, t) {
  const ice = f.ice;
  const gl = g.createRadialGradient(f.x, f.y - 9, 2, f.x, f.y - 9, 20);
  gl.addColorStop(0, ice ? 'rgba(200,245,255,.8)' : 'rgba(255,220,120,.7)'); gl.addColorStop(1, ice ? 'rgba(120,200,255,0)' : 'rgba(255,100,20,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(f.x, f.y - 9, 20, 0, TAU); g.fill();
  g.save(); g.translate(f.x, f.y - 9); g.rotate(t * 20);
  if (ice) { starPath(g, 0, 0, 10, 4, 6); fs(g, '#e8faff', 1.6); }
  else { g.beginPath(); g.arc(0, 0, 9, 0, TAU); fs(g, radial(g, 0, 0, 9, '#fffbe0', '#ffb02a', '#e04a10'), 1.6); }
  g.restore();
}
