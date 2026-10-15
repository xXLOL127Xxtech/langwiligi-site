// Eigene Hintergründe für Faust-Duell (per Canvas gezeichnet, keine fremden Bilder).
(function () {
  'use strict';

  // Fester Zufall, damit die Arena jedes Mal gleich aussieht
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function dojo(ctx, w, h) {
    var r = rnd(7);
    // Himmel bei Sonnenuntergang
    var g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, '#2b1f4f'); g.addColorStop(0.45, '#b2456e'); g.addColorStop(0.8, '#ff9a4d'); g.addColorStop(1, '#ffc56b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Sonne
    var sg = ctx.createRadialGradient(300, 215, 10, 300, 215, 120);
    sg.addColorStop(0, 'rgba(255,240,190,1)'); sg.addColorStop(0.35, 'rgba(255,200,120,0.55)'); sg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = sg; ctx.fillRect(160, 80, 280, 260);
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(300, 215, 42, 0, Math.PI * 2); ctx.fill();
    // Berge
    function berge(y, amp, col, seed) {
      var rr = rnd(seed);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 20) ctx.lineTo(x, y - Math.abs(Math.sin(x / 90 + seed)) * amp - rr() * amp * 0.25);
      ctx.lineTo(w, h); ctx.fill();
    }
    berge(250, 70, '#7a3a68', 3);
    berge(275, 45, '#5a2a55', 11);
    // Pagode in der Ferne
    ctx.fillStyle = '#3d1d3f';
    var px = 470, py = 268;
    ctx.fillRect(px - 6, py - 70, 12, 70);
    for (var k = 0; k < 4; k++) {
      var yy = py - k * 20, ww = 46 - k * 9;
      ctx.beginPath(); ctx.moveTo(px - ww, yy - 6); ctx.quadraticCurveTo(px, yy - 18, px + ww, yy - 6);
      ctx.lineTo(px + ww - 6, yy - 2); ctx.lineTo(px - ww + 6, yy - 2); ctx.fill();
      ctx.fillRect(px - ww * 0.55, yy - 2, ww * 1.1, 8);
    }
    // Hintere Wand des Dojos
    ctx.fillStyle = '#4a2a22'; ctx.fillRect(0, 300, w, 30);
    ctx.fillStyle = '#5d3529'; ctx.fillRect(0, 300, w, 4);
    // Holzboden mit Perspektive
    var fg = ctx.createLinearGradient(0, 330, 0, h);
    fg.addColorStop(0, '#8a5432'); fg.addColorStop(1, '#5a3220');
    ctx.fillStyle = fg; ctx.fillRect(0, 330, w, h - 330);
    ctx.strokeStyle = 'rgba(40,20,10,0.45)'; ctx.lineWidth = 1;
    for (var i = -12; i <= 12; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 34, 330); ctx.lineTo(w / 2 + i * 70, h); ctx.stroke();
    }
    [345, 362, 384].forEach(function (y) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
    ctx.fillStyle = 'rgba(255,200,140,0.10)'; ctx.fillRect(0, 330, w, 6);
    // Säulen links und rechts
    [[0, 30], [w - 30, 30]].forEach(function (c) {
      var pg = ctx.createLinearGradient(c[0], 0, c[0] + c[1], 0);
      pg.addColorStop(0, '#3a160f'); pg.addColorStop(0.5, '#8f2f1f'); pg.addColorStop(1, '#3a160f');
      ctx.fillStyle = pg; ctx.fillRect(c[0], 0, c[1], 340);
    });
    // Dachbalken
    ctx.fillStyle = '#2a120c'; ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = '#7d2a1c'; ctx.fillRect(0, 22, w, 6);
    // Laternen
    [120, 480].forEach(function (x) {
      ctx.strokeStyle = '#2a120c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x, 62); ctx.stroke();
      var lg = ctx.createRadialGradient(x, 82, 4, x, 82, 60);
      lg.addColorStop(0, 'rgba(255,190,90,0.55)'); lg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 60, 22, 120, 120);
      ctx.fillStyle = '#e8462f'; ctx.beginPath(); ctx.ellipse(x, 82, 15, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,10,5,0.5)'; ctx.lineWidth = 1.5;
      [-8, 0, 8].forEach(function (d) { ctx.beginPath(); ctx.ellipse(x, 82 + d, 15 * Math.sqrt(1 - (d / 21) * (d / 21)), 1, 0, 0, Math.PI * 2); ctx.stroke(); });
      ctx.fillStyle = '#2a120c'; ctx.fillRect(x - 8, 59, 16, 4); ctx.fillRect(x - 8, 101, 16, 4);
    });
    // Ein paar Blätter in der Luft
    for (var b = 0; b < 14; b++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,170,190,0.8)' : 'rgba(255,215,160,0.7)';
      ctx.beginPath(); ctx.ellipse(40 + r() * 520, 40 + r() * 230, 3, 1.6, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function dach(ctx, w, h) {
    var r = rnd(42);
    var g = ctx.createLinearGradient(0, 0, 0, 330);
    g.addColorStop(0, '#060a1c'); g.addColorStop(0.7, '#16204a'); g.addColorStop(1, '#2c2f6b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Sterne
    for (var i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')';
      ctx.fillRect(r() * w, r() * 200, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1);
    }
    // Mond
    var mg = ctx.createRadialGradient(470, 70, 10, 470, 70, 90);
    mg.addColorStop(0, 'rgba(220,235,255,0.5)'); mg.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(380, 0, 180, 170);
    ctx.fillStyle = '#eef3ff'; ctx.beginPath(); ctx.arc(470, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,195,230,0.6)';
    [[462, 62, 5], [478, 78, 4], [474, 58, 2.5]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill(); });
    // Skyline (zwei Ebenen)
    function stadt(base, col, minH, maxH, win, seed) {
      var rr = rnd(seed), x = 0;
      while (x < w) {
        var bw = 26 + rr() * 50, bh = minH + rr() * (maxH - minH);
        ctx.fillStyle = col; ctx.fillRect(x, base - bh, bw, bh + 2);
        if (win) {
          for (var wy = base - bh + 8; wy < base - 6; wy += 11) {
            for (var wx = x + 5; wx < x + bw - 6; wx += 9) {
              if (rr() < 0.35) { ctx.fillStyle = rr() < 0.7 ? 'rgba(255,214,120,0.85)' : 'rgba(140,220,255,0.8)'; ctx.fillRect(wx, wy, 4, 5); }
            }
          }
        }
        if (rr() < 0.25) { ctx.fillStyle = col; ctx.fillRect(x + bw / 2 - 1, base - bh - 18, 2, 18); }
        x += bw + 2;
      }
    }
    stadt(318, '#1b2150', 60, 150, false, 5);
    stadt(325, '#0d1130', 40, 110, true, 9);
    // Neon-Leuchtschild (ohne Text) und Wassertank
    ctx.save();
    ctx.shadowColor = '#ff3d8b'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 3;
    ctx.strokeRect(70, 196, 92, 40);
    ctx.shadowColor = '#3de0ff'; ctx.strokeStyle = '#7ae8ff';
    ctx.beginPath(); ctx.arc(116, 216, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#121633';
    ctx.fillRect(470, 238, 70, 60); ctx.fillRect(476, 298, 6, 32); ctx.fillRect(528, 298, 6, 32);
    ctx.beginPath(); ctx.moveTo(466, 240); ctx.lineTo(505, 218); ctx.lineTo(544, 240); ctx.fill();
    // Dachkante und Boden
    ctx.fillStyle = '#3b3f5c'; ctx.fillRect(0, 326, w, 8);
    var fg = ctx.createLinearGradient(0, 334, 0, h);
    fg.addColorStop(0, '#4a4e6b'); fg.addColorStop(1, '#262839');
    ctx.fillStyle = fg; ctx.fillRect(0, 334, w, h - 334);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (var j = -10; j <= 10; j++) { ctx.beginPath(); ctx.moveTo(w / 2 + j * 40, 334); ctx.lineTo(w / 2 + j * 80, h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 358); ctx.lineTo(w, 358); ctx.stroke();
    // Lichtschein von den Neons auf dem Boden
    var lg = ctx.createRadialGradient(116, 345, 5, 116, 345, 140);
    lg.addColorStop(0, 'rgba(255,95,162,0.22)'); lg.addColorStop(1, 'rgba(255,95,162,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 300, 300, 100);
  }

  function zeichne(type, w, h, scale) {
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    (type === 1 ? dach : dojo)(ctx, w, h);
    return c;
  }

  window.Arenen = { zeichne: zeichne, namen: ['Dojo', 'Dach'] };
})();
