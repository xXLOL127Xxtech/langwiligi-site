// Eigene Kämpfer-Grafik für Faust-Duell: jede Bewegung wird aus einer Skelett-Pose per Canvas gezeichnet.
// Ersetzt die Bild-Sprites von mk.js. Ein Bild ist { img: Canvas, width, height } in Spiel-Pixeln.
//
// Winkel in Grad: 0 = nach unten, 90 = nach vorne (Blickrichtung), 180 = nach oben, -90 = nach hinten.
(function () {
  'use strict';

  var W = 150, H = 160, AX = 75;          // Bildgrösse und Körpermitte (x)
  var RES = 2;                              // Auflösung der vorgezeichneten Bilder
  var THIGH = 30, SHIN = 30, FOOT = 11, TORSO = 40, UARM = 22, FARM = 21, HEAD = 10;

  var STIL = {
    blitz: { gi: '#3f7ee8', giDunkel: '#2a5cb5', rand: '#14244a', haut: '#e8b48a', hautDunkel: '#c98f63',
             haar: '#1b1b22', band: '#ffd23f', gurt: '#16161c' },
    glut:  { gi: '#e0473f', giDunkel: '#a8302b', rand: '#3d0f0d', haut: '#c98d62', hautDunkel: '#a06a43',
             haar: '#3a1a10', band: '#ffd23f', gurt: '#16161c' }
  };

  function rad(d) { return d * Math.PI / 180; }
  function dir(d) { return { x: Math.sin(rad(d)), y: Math.cos(rad(d)) }; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- Posen ----------
  // Pose: { hx, hy (Hüfte über Boden), t (Rumpf-Neigung), rot (ganzer Körper), a1/a2: [Schulter, Ellbogen],
  //         l1/l2: [Oberschenkel, Knie] oder { ik: [fussX, fussHöhe] } }
  // a1/l1 = vorderer Arm/vorderes Bein, a2/l2 = hinten.
  function ik(hx, hy, fx, fy) {
    var dx = fx - hx, dy = hy - fy;                     // dy: nach unten positiv
    var d = Math.min(Math.sqrt(dx * dx + dy * dy), THIGH + SHIN - 0.5);
    var base = Math.atan2(dx, dy) * 180 / Math.PI;
    var a = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d)) * 180 / Math.PI;
    return [base + a, -2 * a];
  }
  function resolve(p) {
    var r = {};
    for (var k in p) r[k] = p[k];
    ['l1', 'l2'].forEach(function (k) {
      if (p[k] && p[k].ik) r[k] = ik(p.hx || 0, p.hy, p[k].ik[0], p[k].ik[1]);
    });
    r.hx = r.hx || 0; r.t = r.t || 0; r.rot = r.rot || 0; r.dy = r.dy || 0;
    return r;
  }
  function mix(a, b, t) {
    a = resolve(a); b = resolve(b);
    var r = {};
    ['hx', 'hy', 't', 'rot', 'dy'].forEach(function (k) { r[k] = lerp(a[k], b[k], t); });
    ['a1', 'a2', 'l1', 'l2'].forEach(function (k) { r[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)]; });
    return r;
  }
  // Keyframes gleichmässig auf n Bilder verteilen
  function seq(keys, n, i) {
    if (n <= 1) return resolve(keys[0]);
    var pos = i / (n - 1) * (keys.length - 1), k = Math.floor(pos);
    if (k >= keys.length - 1) return resolve(keys[keys.length - 1]);
    var t = pos - k;
    t = t * t * (3 - 2 * t);
    return mix(keys[k], keys[k + 1], t);
  }

  var STANCE = { hx: 0, hy: 55, t: 10, a1: [48, 95], a2: [25, 115], l1: { ik: [15, 0] }, l2: { ik: [-15, 0] } };
  var GUARD_HI = { hx: 0, hy: 55, t: 4, a1: [120, 50], a2: [110, 60], l1: { ik: [13, 0] }, l2: { ik: [-15, 0] } };
  var SQUAT = { hx: -2, hy: 30, t: 22, a1: [55, 90], a2: [35, 105], l1: { ik: [18, 0] }, l2: { ik: [-16, 0] } };
  var LIE = { hx: 0, hy: 8, t: -90, a1: [-75, 0], a2: [-95, 0], l1: [88, -6], l2: [84, -12] };
  var TUCK = { hx: 0, hy: 70, t: 12, a1: [60, 100], a2: [30, 110], l1: [95, -120], l2: [60, -130] };

  function P(o) { var r = {}; for (var k in STANCE) r[k] = STANCE[k]; for (var j in o) r[j] = o[j]; return r; }
  function S(o) { var r = {}; for (var k in SQUAT) r[k] = SQUAT[k]; for (var j in o) r[j] = o[j]; return r; }

  var MOVES = {
    'stand': function (i, n) {
      var b = Math.sin(i / n * Math.PI * 2);
      return resolve(P({ hy: 55 + b * 1.5, a1: [48 + b * 3, 95], a2: [25 - b * 2, 115] }));
    },
    'walking': function (i, n) { return walk(i, n, 1); },
    'walking-backward': function (i, n) { return walk(i, n, -1); },
    'squating': function (i, n) { return seq([STANCE, S({ hy: 42 }), SQUAT], n, i); },
    'stand-up': function (i, n) { return seq([SQUAT, S({ hy: 42 }), STANCE], n, i); },
    'blocking': function (i, n) { return seq([STANCE, GUARD_HI], n, i); },
    'high-punch': function (i, n) {
      return seq([STANCE, P({ t: 16, a1: [70, 60], hx: 3 }), P({ t: 22, hx: 6, a1: [105, -5], a2: [20, 120], l1: { ik: [22, 0] } })], n, i);
    },
    'low-punch': function (i, n) {
      return seq([STANCE, P({ t: 20, hx: 4, a1: [85, 0], a2: [25, 125], l1: { ik: [20, 0] } })], n, i);
    },
    'high-kick': function (i, n) {
      return seq([STANCE, P({ t: -5, l1: [80, -110], a1: [60, 80] }), P({ t: -22, hx: -4, l1: [118, -5], a1: [40, 90], a2: [-20, 80] })], n, i);
    },
    'low-kick': function (i, n) {
      return seq([STANCE, P({ t: -8, l1: [55, -70] }), P({ t: -14, hx: -2, l1: [78, -2], a1: [40, 90] })], n, i);
    },
    'uppercut': function (i, n) {
      return seq([SQUAT, S({ hy: 42, a1: [10, 60], t: 25 }), P({ hy: 58, t: -4, a1: [150, 15], a2: [10, 100], l1: { ik: [12, 0] } })], n, i);
    },
    'squat-low-kick': function (i, n) {
      return seq([SQUAT, S({ hy: 26, t: 5, l1: [88, -4], l2: { ik: [-14, 0] } })], n, i);
    },
    'squat-high-kick': function (i, n) {
      return seq([SQUAT, S({ hy: 30, t: -12, l1: [95, -60] }), S({ hy: 32, t: -24, l1: [130, -8], l2: { ik: [-12, 0] } })], n, i);
    },
    'squat-low-punch': function (i, n) {
      return seq([SQUAT, S({ t: 26, hx: 3, a1: [88, 0], a2: [30, 110] })], n, i);
    },
    'spin-kick': function (i, n) {
      // Drehtritt: eindrehen, Bein von hinten nach vorne hoch durchziehen
      return seq([
        STANCE,
        P({ t: 30, hx: 2, a1: [20, 120], a2: [-30, 100], l1: [-50, -60] }),
        P({ t: 10, a1: [-60, 40], a2: [-90, 30], l1: [20, -80] }),
        P({ t: -28, hx: -4, a1: [40, 80], a2: [-50, 60], l1: [118, -5] }),
        P({ t: -22, hx: -3, a1: [50, 85], a2: [-30, 70], l1: [105, -15] }),
        STANCE
      ], n, i);
    },
    'jumping': function (i, n) { return seq([P({ hy: 48 }), TUCK, TUCK], n, i); },
    'forward-jump': function (i, n) { return flip(i, n, 1); },
    'backward-jump': function (i, n) { return flip(i, n, -1); },
    'forward-jump-kick': function (i, n) { return seq([TUCK, { hx: 0, hy: 70, t: -15, a1: [60, 90], a2: [10, 90], l1: [105, -5], l2: [40, -120] }], n, i); },
    'backward-jump-kick': function (i, n) { return seq([TUCK, { hx: 0, hy: 70, t: -15, a1: [60, 90], a2: [10, 90], l1: [105, -5], l2: [40, -120] }], n, i); },
    'forward-jump-punch': function (i, n) { return seq([TUCK, { hx: 0, hy: 70, t: 20, a1: [110, 0], a2: [20, 110], l1: [70, -110], l2: [30, -120] }], n, i); },
    'backward-jump-punch': function (i, n) { return seq([TUCK, { hx: 0, hy: 70, t: 20, a1: [110, 0], a2: [20, 110], l1: [70, -110], l2: [30, -120] }], n, i); },
    'endure': function (i, n) {
      return seq([STANCE, P({ t: -18, hx: -4, a1: [20, 60], a2: [-10, 60], l1: { ik: [18, 0] } }), P({ t: -10, hx: -2 })], n, i);
    },
    'squat-endure': function (i, n) { return seq([SQUAT, S({ t: 0, hx: -4, a1: [30, 60] }), SQUAT], n, i); },
    'knock-down': function (i, n) {
      // nach hinten geschleudert, landet auf dem Rücken
      return seq([
        P({ t: -25, a1: [20, 40], a2: [-20, 40] }),
        { hx: -4, hy: 62, t: -45, a1: [150, 20], a2: [130, 20], l1: [50, -40], l2: [30, -60] },
        { hx: -6, hy: 44, t: -65, a1: [-160, 10], a2: [-140, 10], l1: [70, -30], l2: [55, -50] },
        { hx: -6, hy: 18, t: -85, a1: [-110, 0], a2: [-120, 0], l1: [85, -15], l2: [78, -25] },
        LIE, LIE
      ], n, i);
    },
    'attractive-stand-up': function (i, n) {
      return seq([
        LIE,
        { hx: -4, hy: 16, t: 20, a1: [-20, 0], a2: [-35, 0], l1: { ik: [22, 0] }, l2: { ik: [-6, 0] } },
        SQUAT, STANCE
      ], n, i);
    },
    'fall': function (i, n) {
      return seq([
        P({ t: -20, a1: [10, 30], a2: [-10, 30] }),
        { hx: -4, hy: 34, t: -10, a1: [-20, 20], a2: [-30, 20], l1: { ik: [20, 0] }, l2: { ik: [-4, 0] } },
        { hx: -6, hy: 20, t: -60, a1: [-140, 10], a2: [-120, 10], l1: [60, -60], l2: [45, -70] },
        LIE
      ], n, i);
    },
    'win': function (i, n) {
      var up = { hx: 0, hy: 60, t: -3, a1: [150, 25], a2: [-25, 30], l1: { ik: [10, 0] }, l2: { ik: [-12, 0] } };
      return seq([STANCE, P({ t: 0, hy: 58 }), up, up], n, i);
    }
  };

  function walk(i, n, d) {
    var ph = i / n * Math.PI * 2, s = Math.sin(ph) * d, c = Math.cos(ph);
    return resolve(P({
      hy: 55 + Math.abs(c) * 1.5,
      l1: { ik: [15 * s + 2, Math.max(0, c) * 7] },
      l2: { ik: [-15 * s - 2, Math.max(0, -c) * 7] },
      a1: [48 - s * 6, 95], a2: [25 + s * 6, 115]
    }));
  }
  function flip(i, n, d) {
    // Salto vorwärts bzw. rückwärts
    var t = i / (n - 1);
    if (t < 0.1 || t > 0.92) return resolve(P({ hy: 48 }));
    var p = resolve(TUCK);
    p.rot = d * (t - 0.1) / 0.82 * 360;
    return p;
  }

  // ---------- Zeichnen ----------
  function seg(ctx, x1, y1, x2, y2, w, fill, edge) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = edge; ctx.lineWidth = w + 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function dot(ctx, x, y, r, fill, edge) {
    ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fillStyle = edge; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }

  function draw(ctx, p, st) {
    // Ursprung: Hüfte. Körper zeigt nach rechts (+x).
    var hip = { x: 0, y: 0 };
    var up = dir(180 - p.t);                          // Rumpf-Richtung (nach oben, vorgeneigt)
    var sh = { x: up.x * TORSO, y: up.y * TORSO };
    var hc = { x: sh.x + up.x * (HEAD + 4), y: sh.y + up.y * (HEAD + 4) };

    function limb(base, a, l1, l2, w1, w2, colA, colB, end) {
      var d1 = dir(a[0]), d2 = dir(a[0] + a[1]);
      var j = { x: base.x + d1.x * l1, y: base.y + d1.y * l1 };
      var e = { x: j.x + d2.x * l2, y: j.y + d2.y * l2 };
      seg(ctx, base.x, base.y, j.x, j.y, w1, colA, st.rand);
      seg(ctx, j.x, j.y, e.x, e.y, w2, colB, st.rand);
      if (end) end(e, a[0] + a[1]);
      return e;
    }
    function fist(col) { return function (e) { dot(ctx, e.x, e.y, 5.5, col, st.rand); }; }
    function foot(col) {
      return function (e, ang) {
        var g = dir(ang + 90);                          // senkrecht zum Schienbein, nach vorne
        seg(ctx, e.x, e.y, e.x + g.x * FOOT, e.y + g.y * FOOT, 7, col, st.rand);
      };
    }

    // hinteres Bein und Arm (dunkler)
    limb(hip, p.l2, THIGH, SHIN, 13, 11, st.giDunkel, st.giDunkel, foot(st.hautDunkel));
    limb(sh, p.a2, UARM, FARM, 10, 8, st.giDunkel, st.hautDunkel, fist(st.hautDunkel));
    // Rumpf
    seg(ctx, hip.x, hip.y, sh.x, sh.y, 24, st.gi, st.rand);
    // Brust-Ausschnitt (V) und Gurt
    var mid = { x: up.x * 6, y: up.y * 6 };
    ctx.strokeStyle = st.gurt; ctx.lineWidth = 5; ctx.lineCap = 'butt';
    var side = dir(90 - p.t);
    ctx.beginPath();
    ctx.moveTo(mid.x - side.x * 12, mid.y - side.y * 12); ctx.lineTo(mid.x + side.x * 12, mid.y + side.y * 12); ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(mid.x + side.x * 8, mid.y + side.y * 8);
    ctx.lineTo(mid.x + side.x * 6 + dir(30 - p.t).x * 9, mid.y + side.y * 6 + dir(30 - p.t).y * 9); ctx.stroke();
    var v1 = { x: sh.x - up.x * 3, y: sh.y - up.y * 3 }, v2 = { x: sh.x - up.x * 15 + side.x * 2, y: sh.y - up.y * 15 + side.y * 2 };
    ctx.strokeStyle = st.haut; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(v1.x + side.x * 5, v1.y + side.y * 5); ctx.lineTo(v2.x, v2.y); ctx.stroke();
    // vorderes Bein
    limb(hip, p.l1, THIGH, SHIN, 14, 12, st.gi, st.gi, foot(st.haut));
    // Kopf
    dot(ctx, hc.x, hc.y, HEAD, st.haut, st.rand);
    // Haare hinten
    ctx.fillStyle = st.haar;
    ctx.beginPath(); ctx.arc(hc.x, hc.y, HEAD + 0.5, Math.PI * 0.8 + rad(p.t), Math.PI * 1.72 + rad(p.t)); ctx.closePath(); ctx.fill();
    // Stirnband mit flatternden Enden
    var bandA = { x: hc.x + side.x * -2 + up.x * 3, y: hc.y + side.y * -2 + up.y * 3 };
    ctx.strokeStyle = st.band; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hc.x - side.x * HEAD + up.x * 3, hc.y - side.y * HEAD + up.y * 3);
    ctx.lineTo(hc.x + side.x * HEAD + up.x * 3, hc.y + side.y * HEAD + up.y * 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bandA.x - side.x * 8, bandA.y - side.y * 8);
    ctx.lineTo(bandA.x - side.x * 16 + up.x * -4, bandA.y - side.y * 16 + up.y * -4); ctx.stroke();
    // Auge
    ctx.fillStyle = st.rand;
    ctx.beginPath(); ctx.arc(hc.x + side.x * 5 + up.x * 1, hc.y + side.y * 5 + up.y * 1, 1.6, 0, Math.PI * 2); ctx.fill();
    // vorderer Arm
    limb(sh, p.a1, UARM, FARM, 11, 9, st.gi, st.haut, fist(st.haut));
  }

  // Tiefster Punkt einer Pose (für die Bodenhöhe)
  function lowest(p) {
    var pts = [];
    function chain(b, a, l1, l2) {
      var d1 = dir(a[0]), d2 = dir(a[0] + a[1]);
      var j = { x: b.x + d1.x * l1, y: b.y + d1.y * l1 };
      pts.push(j, { x: j.x + d2.x * l2, y: j.y + d2.y * l2 });
    }
    var up = dir(180 - p.t), sh = { x: up.x * TORSO, y: up.y * TORSO };
    chain({ x: 0, y: 0 }, p.l1, THIGH, SHIN); chain({ x: 0, y: 0 }, p.l2, THIGH, SHIN);
    chain(sh, p.a1, UARM, FARM); chain(sh, p.a2, UARM, FARM);
    pts.push(sh, { x: sh.x + up.x * (HEAD * 2 + 4), y: sh.y + up.y * (HEAD * 2 + 4) });
    var c = Math.cos(rad(p.rot)), s = Math.sin(rad(p.rot)), m = -1e9;
    pts.forEach(function (q) { m = Math.max(m, q.x * s + q.y * c); });
    return m;
  }

  var cache = {};
  function frame(name, orientation, type, i, total) {
    var key = name + '|' + orientation + '|' + type + '|' + i + '|' + total;
    if (cache[key]) return cache[key];
    var st = STIL[name] || STIL.blitz;
    var gen = MOVES[type] || MOVES.stand;
    var p = gen(i, total);
    var c = document.createElement('canvas');
    c.width = W * RES; c.height = H * RES;
    var ctx = c.getContext('2d');
    ctx.scale(RES, RES);
    if (orientation === 'right') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    // Bodenkontakt: bei Posen am Boden den tiefsten Punkt auf den Boden setzen
    var hy = p.hy;
    var onGround = !/jump|jumping/.test(type);
    if (onGround) {
      var low = lowest(p);
      if (low > hy) hy = low;
    }
    ctx.translate(AX + (p.hx || 0), H - hy - 1);
    ctx.rotate(rad(p.rot || 0));
    draw(ctx, p, st);
    var f = { img: c, width: W, height: H };
    cache[key] = f;
    return f;
  }

  window.Figuren = { frame: frame, W: W, H: H, AX: AX, moves: Object.keys(MOVES) };
})();
