'use strict';
// Wanderlicht – Bäume: Baumarten mit Stamm, Ästen und Blattkarten, Riesenbäume, Wälder, Unterholz und Waldfunde

// ---------- Röhren (Stämme und Äste) ----------
function tube(mg, pts, rads, col, seg = 8, mt = MT.bark, col2 = null, rnd = Math.random) {
  const n = pts.length;
  if (n < 2) return;
  const ring = [];
  let ux = 0, uy = 0, uz = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    if (i === 0) {
      // beliebige Senkrechte
      const rx = Math.abs(ty) < 0.9 ? 0 : 1, ry = Math.abs(ty) < 0.9 ? 1 : 0;
      ux = ty * 0 - tz * ry; uy = tz * rx - tx * 0; uz = tx * ry - ty * rx;
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    } else {
      const d = ux * tx + uy * ty + uz * tz;
      ux -= tx * d; uy -= ty * d; uz -= tz * d;
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    }
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
    const pr = rads[Math.max(0, i - 1)], nr = rads[Math.min(n - 1, i + 1)];
    const sl = (pr - nr) / (tl || 1) * 0.5;
    ring.push({ p: pts[i], u: [ux, uy, uz], v: [vx, vy, vz], t: [tx, ty, tz], r: rads[i], sl });
  }
  const verts = [];
  for (let i = 0; i < n; i++) {
    const R = ring[i], row = [];
    const k = i / (n - 1);
    const c = col2 ? [col[0] + (col2[0] - col[0]) * k, col[1] + (col2[1] - col[1]) * k, col[2] + (col2[2] - col[2]) * k] : col;
    const f = 0.92 + rnd() * 0.16;
    for (let j = 0; j < seg; j++) {
      const a = j / seg * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
      const dx = R.u[0] * ca + R.v[0] * sa, dy = R.u[1] * ca + R.v[1] * sa, dz = R.u[2] * ca + R.v[2] * sa;
      let nx = dx + R.t[0] * R.sl, ny = dy + R.t[1] * R.sl, nz = dz + R.t[2] * R.sl;
      const nl = Math.hypot(nx, ny, nz) || 1;
      row.push({ p: [R.p[0] + dx * R.r, R.p[1] + dy * R.r, R.p[2] + dz * R.r], n: [nx / nl, ny / nl, nz / nl], c: [c[0] * f, c[1] * f, c[2] * f], u: j / seg * 6.2832 * Math.max(0.15, R.r) });
    }
    verts.push(row);
  }
  const tr = (A, B, C) => {
    const ex = B.p[0] - A.p[0], ey = B.p[1] - A.p[1], ez = B.p[2] - A.p[2], fx = C.p[0] - A.p[0], fy = C.p[1] - A.p[1], fz = C.p[2] - A.p[2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    if (cx * A.n[0] + cy * A.n[1] + cz * A.n[2] < 0) mg.tri(A.p, C.p, B.p, A.n, C.n, B.n, A.c, C.c, B.c, mt, A.u, C.u, B.u);
    else mg.tri(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c, mt, A.u, B.u, C.u);
  };
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const j2 = (j + 1) % seg;
    const wrap0 = j2 === 0 ? 6.2832 * Math.max(0.15, ring[i].r) : 0, wrap1 = j2 === 0 ? 6.2832 * Math.max(0.15, ring[i + 1].r) : 0;
    const a = verts[i][j], b = j2 === 0 ? { ...verts[i][j2], u: verts[i][j2].u + wrap0 } : verts[i][j2], c = verts[i + 1][j], d = j2 === 0 ? { ...verts[i + 1][j2], u: verts[i + 1][j2].u + wrap1 } : verts[i + 1][j2];
    tr(a, c, b); tr(b, c, d);
  }
}
const _tp = [0, 0, 0];
function nrm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }

// Ast: gekrümmter Weg, am Ende Laub oder Kinder
function limb(c, p, d, len, rad, depth, o) {
  const r = c.r, pts = [p.slice()], rads = [rad];
  const dir = d.slice(); nrm3(dir);
  const q = p.slice();
  const steps = c.near ? 5 : 3;
  for (let k = 1; k <= steps; k++) {
    dir[0] += (r() - 0.5) * o.wander; dir[2] += (r() - 0.5) * o.wander; dir[1] += o.up / steps - (o.droop || 0) * k / steps; nrm3(dir);
    q[0] += dir[0] * len / steps; q[1] += dir[1] * len / steps; q[2] += dir[2] * len / steps;
    pts.push(q.slice()); rads.push(rad * (1 - 0.62 * k / steps));
  }
  if (c.near || depth >= o.farDepth) tube(c.mg, pts, rads, c.bark, c.near ? (rad > 0.4 ? 9 : 6) : 5, MT.bark, c.bark2, c.rc);
  const tip = pts[pts.length - 1];
  if (depth > 0) {
    const n = (o.kids || 2) + (r() < 0.35 ? 1 : 0);
    const yaw0 = Math.atan2(dir[2], dir[0]);
    for (let i = 0; i < n; i++) {
      const at = pts[Math.max(1, Math.floor(steps * (0.55 + 0.45 * (i / Math.max(1, n - 1)) * (n > 1 ? 1 : 0))))] || tip;
      const a = yaw0 + (i - (n - 1) / 2) * (1.0 + r() * 0.5) + (r() - 0.5) * 0.5;
      const sp = 0.35 + r() * 0.45;
      const nd = [Math.cos(a) * (1 - sp * 0.4), dir[1] * 0.5 + sp * 0.55 + o.up * 0.5, Math.sin(a) * (1 - sp * 0.4)];
      limb(c, at, nd, len * (0.62 + r() * 0.22), rad * 0.56, depth - 1, o);
    }
    if (o.midClump && depth === 1) {
      const m = pts[Math.floor(steps / 2) + 1] || tip;
      const cr = c.cr * (0.55 + r() * 0.25);
      c.ls.clump(m[0], m[1] + cr * 0.15, m[2], cr, cr * 0.7, cr, c.cols, c.rc, { kind: c.kind, flat: 0.3 });
    }
  } else {
    const cr = c.cr * (0.85 + r() * 0.35);
    c.ls.clump(tip[0], tip[1] + cr * 0.25, tip[2], cr * (o.wide || 1), cr * (o.tall || 0.78), cr * (o.wide || 1), c.cols, c.rc, { kind: c.kind, flat: o.flat == null ? 0.3 : o.flat });
  }
}

// Wurzelanläufe
function roots(c, x, y, z, rad, n, len) {
  const r = c.r;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832 + r() * 0.5, cs = Math.cos(a), sn = Math.sin(a), l = len * (0.7 + r() * 0.6);
    const pts = [[x + cs * rad * 0.4, y + rad * 1.5, z + sn * rad * 0.4], [x + cs * (rad * 0.9 + l * 0.4), y + rad * 0.55, z + sn * (rad * 0.9 + l * 0.4)], [x + cs * (rad + l * 0.8), y + rad * 0.1, z + sn * (rad + l * 0.8)], [x + cs * (rad + l * 1.2), y - rad * 0.25, z + sn * (rad + l * 1.2)]];
    if (c.near) tube(c.mg, pts, [rad * 0.55, rad * 0.4, rad * 0.22, rad * 0.1], c.bark, 6, MT.bark, c.bark, c.rc);
  }
}
function trunkPath(c, x, y, z, H, r0, r1, lean, rings, o = {}) {
  const r = c.r, pts = [], rads = [];
  const la = r() * 6.2832, bend = o.bend == null ? 0.5 : o.bend;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const sway = Math.sin(t * 3.1 + la) * bend * 0.3 * H * 0.05 * (o.wob || 1);
    pts.push([x + Math.cos(la) * lean * t * t * H + sway, y - 0.4 + t * (H + 0.4), z + Math.sin(la) * lean * t * t * H + Math.cos(t * 2.7 + la) * bend * 0.12 * H * 0.05 * (o.wob || 1)]);
    const flare = 1 + (o.flare == null ? 0.55 : o.flare) * Math.exp(-t * H / (r0 * 2.2 + 0.4));
    rads.push((r0 + (r1 - r0) * Math.pow(t, o.taper || 0.9)) * flare);
  }
  if (c.near || o.always) tube(c.mg, pts, rads, c.bark, c.near ? (r0 > 1 ? 14 : 9) : 6, MT.bark, c.bark2, c.rc);
  else tube(c.mg, pts, rads, c.bark, 5, MT.bark, c.bark2, c.rc);
  return { pts, rads };
}

// ---------- Baumarten ----------
// Rückgabe: Kronenradius, Höhe, Stammradius (für Kollision und Abstand)
const SPECIES = {
  eiche: { crown: 5.2, h: 10, trunk: 0.5 },
  birke: { crown: 3.2, h: 11, trunk: 0.22 },
  kirsch: { crown: 4.6, h: 7, trunk: 0.36 },
  schirm: { crown: 5, h: 9, trunk: 0.3 },
  akazie: { crown: 5.4, h: 8, trunk: 0.32 },
  baobab: { crown: 6, h: 9, trunk: 1.5 },
  tanne: { crown: 3.4, h: 14, trunk: 0.38 },
  schneetanne: { crown: 3.4, h: 14, trunk: 0.38 },
  weide: { crown: 5.2, h: 8, trunk: 0.5 },
  tot: { crown: 3.6, h: 7, trunk: 0.4 },
  knorrig: { crown: 4.4, h: 8, trunk: 0.55 },
};

function makeTree(spec, mg, ls, near) {
  const B = spec.B, sp = spec.sp, S = spec.s, g = spec.giant;
  const r = mulberry32(spec.seed), rc = mulberry32(spec.seed ^ 0x9e37);
  const tcl = B.trunkC.map(v => Math.min(0.6, v * 1.9 + 0.07));
  let bark = tcl.map(v => v * (0.9 + r() * 0.25)), bark2 = bark.map(v => Math.min(1, v * 1.15));
  const cv = (a, k) => a.map(v => Math.min(1, v * k));
  let cols = B.canopyC.map(c => c.slice());
  if (spec.tint) cols = cols.map(c => c.map((v, i) => clamp01(v * spec.tint[i])));
  const c = { mg, ls, r, rc, near, bark, bark2, cols, cr: 2, kind: 0, x: spec.x, y: spec.y, z: spec.z };
  const x = spec.x, y = spec.y, z = spec.z;
  ls.sb = y; ls.sh = SPECIES[sp].h * S;
  switch (sp) {
    case 'eiche': case 'kirsch': case 'schirm': case 'akazie': case 'birke': {
      let th, tr0, nl, llen, wide = 1, tall = 0.78, up = 0.7, depth = 2, wander = 0.35, flat = 0.3, kind = 0;
      if (g) {
        // Riesenbäume: mächtiger Stamm, weit ausladende Äste
        th = 20 + r() * 8; tr0 = 2.2 + r() * 0.8; nl = 9; llen = 12 + r() * 4; up = sp === 'birke' ? 0.9 : 0.55; wide = 1.15; tall = 0.8;
        if (sp === 'kirsch') kind = 2;
        c.cr = 8 + r() * 2.2;
      } else {
        if (sp === 'eiche') { th = 3.6 * S * (0.9 + r() * 0.3); tr0 = 0.34 * S; nl = 5; llen = 5.2 * S; up = 0.5; }
        else if (sp === 'birke') { th = 5.5 * S * (0.9 + r() * 0.25); tr0 = 0.18 * S; nl = 6; llen = 3.6 * S; up = 1.1; wander = 0.5; tall = 0.7; }
        else if (sp === 'kirsch') { th = 2.6 * S; tr0 = 0.28 * S; nl = 5; llen = 3.6 * S; up = 0.45; kind = 2; wide = 1.15; tall = 0.7; }
        else if (sp === 'akazie') { th = 4.4 * S; tr0 = 0.24 * S; nl = 4; llen = 4.2 * S; up = 0.35; wide = 1.5; tall = 0.5; flat = 0.5; depth = 1; }
        else { th = 5 * S; tr0 = 0.26 * S; nl = 4; llen = 4 * S; up = 0.85; wide = 1.25; tall = 0.6; flat = 0.5; depth = 1; }
        c.cr = (sp === 'birke' ? 1.9 : sp === 'kirsch' ? 2.6 : sp === 'akazie' ? 2.4 : 2.9) * S;
      }
      if (sp === 'birke') { bark = [0.86, 0.85, 0.8]; bark2 = [0.8, 0.8, 0.76]; c.bark = bark; c.bark2 = bark2; cols = cols.map(cc => [cc[0] * 1.15 + 0.06, cc[1] * 1.12 + 0.04, cc[2] * 0.95]); c.cols = cols; }
      c.kind = kind;
      const rings = near ? Math.max(5, Math.round(th / 1.3)) : 4;
      const tp = trunkPath(c, x, y, z, th, tr0 * 1.12, tr0 * 0.72, (r() - 0.5) * (sp === 'schirm' ? 0.4 : 0.12), rings, { bend: sp === 'birke' ? 1.2 : 0.7 });
      if (g || sp === 'eiche') roots(c, x, y, z, tr0 * 1.05, g ? 7 : 4, tr0 * (g ? 2.4 : 1.6));
      const top = tp.pts[tp.pts.length - 1];
      for (let i = 0; i < nl; i++) {
        const a = i / nl * 6.2832 + r() * 0.8;
        const start = tp.pts[Math.max(1, tp.pts.length - 1 - Math.floor(r() * 3))] || top;
        const out = 0.9;
        limb(c, start, [Math.cos(a) * out, up * (0.5 + r() * 0.7), Math.sin(a) * out], llen * (0.8 + r() * 0.4), tr0 * (g ? 0.5 : 0.55), depth, { wander, up: up * 0.35, kids: 2, farDepth: 0, midClump: g || (sp !== 'akazie' && sp !== 'schirm'), wide, tall, flat, droop: sp === 'birke' ? 0.35 : 0 });
      }
      c.ls.clump(top[0], top[1] + c.cr * 0.5, top[2], c.cr * 1.1 * wide, c.cr * 0.8 * tall / 0.78, c.cr * 1.1 * wide, c.cols, c.rc, { kind, flat });
      break;
    }
    case 'baobab': {
      const th = 6.5 * S, tr0 = 1.4 * S;
      c.cr = 2.3 * S; c.kind = 0;
      const tp = trunkPath(c, x, y, z, th, tr0 * 1.1, tr0 * 0.8, 0.05, near ? 8 : 4, { flare: 0.25, taper: 1.4 });
      const top = tp.pts[tp.pts.length - 1];
      const nl = 6 + (g ? 4 : 0);
      for (let i = 0; i < nl; i++) {
        const a = i / nl * 6.2832 + r();
        limb(c, top, [Math.cos(a), 0.55 + r() * 0.3, Math.sin(a)], 3.6 * S * (0.8 + r() * 0.5), tr0 * 0.28, 1, { wander: 0.3, up: 0.3, kids: 2, farDepth: 0, wide: 1.2, tall: 0.55, flat: 0.5 });
      }
      break;
    }
    case 'tanne': case 'schneetanne': {
      const snow = sp === 'schneetanne';
      let th = (g ? 56 + r() * 22 : 9 + r() * 5) * (g ? 1 : S * 0.9);
      const tr0 = (g ? 2.2 : 0.32) * (g ? 1 + r() * 0.4 : S);
      const rings = near ? Math.max(6, Math.round(th / 2)) : 4;
      trunkPath(c, x, y, z, th, tr0 * 1.1, tr0 * 0.18, (r() - 0.5) * 0.06, rings, { bend: 0.5, flare: g ? 0.6 : 0.4, taper: 0.8 });
      if (g) roots(c, x, y, z, tr0 * 1.05, 8, tr0 * 1.8);
      const bareH = g ? th * 0.28 : th * 0.12 + 0.8;
      const tiers = g ? 18 : 6 + Math.floor(r() * 3);
      const maxR = (g ? 9.5 : 2.4 * S) * (0.85 + r() * 0.3);
      const cc = snow ? [cols[1], cols[0], cols[2]] : cols;
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const yy = y + bareH + t * (th - bareH) * 0.94;
        const rad = maxR * Math.pow(1 - t, 0.82) * (0.78 + r() * 0.3) + 0.35;
        const hh = (th - bareH) / tiers * 2.15;
        ls.cone(x + (r() - 0.5) * 0.4, yy, z + (r() - 0.5) * 0.4, rad, hh, snow ? [cc[1], cc[0], cc[2]] : cc, rc, { size: g ? 1.7 : undefined });
        if (near && rad > 1.4 && !g) {
          // sichtbare Äste unter den Nadeln
          for (let q = 0; q < 4; q++) { const a = r() * 6.28; tube(mg, [[x, yy + hh * 0.35, z], [x + Math.cos(a) * rad * 0.5, yy + hh * 0.3, z + Math.sin(a) * rad * 0.5], [x + Math.cos(a) * rad * 0.9, yy + hh * 0.1, z + Math.sin(a) * rad * 0.9]], [0.07 * S, 0.05 * S, 0.02], bark, 5, MT.bark, bark, rc); }
        }
      }
      ls.cone(x, y + th * 0.9, z, maxR * 0.2 + 0.2, th * 0.14, cc, rc, { size: 0.6 });
      break;
    }
    case 'weide': {
      const th = (g ? 9 : 3.4) * S, tr0 = (g ? 1.4 : 0.38) * S;
      c.cr = (g ? 6 : 2.8) * S; c.kind = 0;
      const tp = trunkPath(c, x, y, z, th, tr0 * 1.15, tr0 * 0.7, 0.18, near ? 6 : 4, { bend: 1.5 });
      const top = tp.pts[tp.pts.length - 1];
      const nl = g ? 9 : 5;
      const crownR = (g ? 10 : 3.6) * S;
      for (let i = 0; i < nl; i++) {
        const a = i / nl * 6.2832 + r();
        limb(c, top, [Math.cos(a), 0.9 + r() * 0.4, Math.sin(a)], crownR * 0.75, tr0 * 0.5, 1, { wander: 0.35, up: 0.2, droop: 0.55, kids: 2, farDepth: 0, wide: 1.2, tall: 0.7 });
      }
      // hängende Zweige
      const strands = Math.floor((g ? 150 : 36) * (QUALITY[G.quality].leaf));
      if (near) for (let i = 0; i < strands; i++) {
        const a = rc() * 6.2832, d = crownR * (0.35 + rc() * 0.6), sy = y + th + 0.6 * S + (1 - d / crownR) * 1.6 * S;
        const len = (1.6 + rc() * 1.6) * (g ? 2.4 : S);
        ls.add(x + Math.cos(a) * d, sy - len * 0.45, z + Math.sin(a) * d, cols[rc() < 0.3 ? 2 : 0], 0.8 + rc() * 0.3, Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8, len, 3, 0.7);
      }
      break;
    }
    case 'tot': case 'knorrig': {
      const big = sp === 'knorrig' ? 1.2 : 0.9;
      const th = (g ? 14 : 3 + r() * 2.6) * S * big, tr0 = (g ? 1.8 : 0.34) * S * big;
      c.cr = 1.2 * S; c.kind = 1;
      const tp = trunkPath(c, x, y, z, th, tr0 * 1.15, tr0 * 0.5, 0.35, near ? 7 : 4, { bend: 2.4, wob: 3 });
      if (g) roots(c, x, y, z, tr0, 8, tr0 * 2.2);
      const top = tp.pts[tp.pts.length - 1];
      const nl = g ? 8 : 4 + Math.floor(r() * 2);
      const leafy = sp === 'knorrig' && r() < 0.45;
      for (let i = 0; i < nl; i++) {
        const a = r() * 6.2832, start = tp.pts[Math.max(2, tp.pts.length - 1 - Math.floor(r() * 4))] || top;
        limb(c, start, [Math.cos(a), 0.5 + r() * 0.9, Math.sin(a)], (g ? 7 : 2.6) * S * (0.7 + r() * 0.6), tr0 * 0.48, g ? 3 : 2, { wander: 0.9, up: 0.3, kids: 2, farDepth: 0, wide: 0.9, tall: 0.6, flat: 0.5, ...{ midClump: false } });
        if (!leafy) { /* kahl */ }
      }
      break;
    }
  }
  // Tote Äste tragen kein Laub
  if (sp === 'tot' || (sp === 'knorrig' && !spec.leafy)) { ls.k.forEach(a => { a.length = 0; }); ls.far.length = 0; }
}

// ---------- Äußere Aufrufe (alte Schnittstelle) ----------
function blob(ls, cx, cy, cz, rx, ry, rz, cols, rnd, dens = 10, flat = 0.35) {
  if (ls.clump) { ls.clump(cx, cy, cz, rx, ry, rz, cols, rnd, { dens: dens / 10, flat }); return; }
  // Punktwolke (Schatten-Wesen)
  const n = Math.floor(dens * (rx * rz + rx * ry + ry * rz));
  for (let i = 0; i < n; i++) {
    let x, y, z, l;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
    const s = (0.62 + 0.38 * Math.cbrt(rnd())) / Math.sqrt(l);
    x *= s; y *= s; z *= s;
    if (y < -flat) y = -flat - (y + flat) * 0.25;
    const top = y * 0.5 + 0.5;
    let c = cols[0];
    if (top < 0.42 && rnd() < 0.7) c = cols[1]; else if (top > 0.62 && rnd() < 0.45) c = cols[2];
    ls.add(cx + x * rx, cy + y * ry, cz + z * rz, c, 0.82 + rnd() * 0.3);
  }
}
let BLOB_MUL = 1;
function buildTree(B, x, y, z, r, mg, ls) {
  const sp = B.tree;
  const spec = { B, sp, x, y, z, s: 0.8 + r() * 0.5, seed: Math.floor(r() * 1e9), giant: false, leafy: true };
  makeTree(spec, mg, ls, true);
}

// ---------- Baumwahl nach Biom ----------
const TREE_TABLE = [
  [['schirm', 3], ['birke', 2], ['eiche', 2.5], ['kirsch', 0.3]],
  [['akazie', 4], ['baobab', 0.8], ['eiche', 1]],
  [['kirsch', 5], ['birke', 1.5], ['eiche', 1.2]],
  [['tanne', 5], ['birke', 1.2], ['eiche', 0.8]],
  [['schneetanne', 6], ['tot', 0.5]],
  [['tot', 3], ['akazie', 0.4]],
  [['weide', 5], ['eiche', 1], ['tot', 0.5]],
  [['knorrig', 5], ['tot', 2]],
];
const GIANT_OF = ['eiche', 'baobab', 'kirsch', 'tanne', 'schneetanne', 'tot', 'weide', 'knorrig'];
function pickSpecies(bi, r) {
  const t = TREE_TABLE[bi]; let sum = 0; for (const e of t) sum += e[1];
  let v = r() * sum; for (const e of t) { v -= e[1]; if (v <= 0) return e[0]; }
  return t[0][0];
}

// ---------- Riesenwälder: Gebiete, in denen fast nur gewaltige Bäume stehen ----------
function giantZone(x, z) {
  return smooth(-0.12, 0.2, fbm(World.nD, x * 0.0021 + 1300, z * 0.0021 - 700, 3));
}

// ---------- Wälder: Planung je Geländestück ----------
function planTrees(ch, r, segs, bigL) {
  const x0 = ch.ci * CHUNK, z0 = ch.cj * CHUNK;
  ch.trees = []; ch.col = []; ch.under = null;
  const tries = 175;
  const placed = [];
  const w = new Float32Array(NB);
  for (let k = 0; k < tries; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    chunkWeights(ch, x, z, w);
    let td = 0; for (let b = 0; b < NB; b++) td += w[b] * BIOMES[b].trees;
    const patch = World.nD.noise(x * 0.018 + 7, z * 0.018) * 0.5 + 0.5;
    const fo = forestAt(x, z) * Math.min(1, td * 1.5 + 0.1);
    const pOpen = td * (0.12 + patch * patch * 1.3) * 0.2;
    const gz = giantZone(x, z) * smooth(0.22, 0.55, fo);
    if (r() > Math.max(pOpen, Math.max(fo * 0.72, gz * 0.9) + 0.03 * td)) continue;
    const h = chunkHeight(ch, x, z);
    if (h < 0.5 || h > 46 + r() * 26) continue;
    if (nearSite(x, z, 5)) continue;
    if (segs.length && pathDist(x, z, segs) < 4.6) continue;
    if (bigL && Math.hypot(x - bigL.x, z - bigL.z) < bigL.R + 10) continue;
    const bi = sampleBiome(w, r());
    const B = BIOMES[bi];
    const inForest = fo > 0.3;
    let giant = r() < (inForest ? 0.03 + gz * 0.6 : 0.012) * Math.min(1, B.trees * 1.4) && x > x0 + 7 && x < x0 + CHUNK - 7 && z > z0 + 7 && z < z0 + CHUNK - 7;
    let sp = giant ? GIANT_OF[bi] : pickSpecies(bi, r);
    if (giant && bi === 5) { giant = false; sp = pickSpecies(bi, r); }
    const dead = r() < 0.1 && B.cold < 0.9 && B.tree !== 'knorrig' && !giant;
    if (dead) sp = 'tot';
    const sz = giant ? 2.6 + r() * 1.5 : (0.82 + r() * 0.5) * 1.75;
    const info = SPECIES[sp];
    const crown = info.crown * (giant ? (sp === 'tanne' || sp === 'schneetanne' ? 2.5 : 2.8) * sz / 2.6 * 1.3 : sz);
    const trunk = giant ? (sp === 'tanne' || sp === 'schneetanne' ? 2.2 : sp === 'baobab' ? 3.6 : sp === 'weide' ? 1.9 : 2.6) * (sz / 3) * 1.1 : info.trunk * sz;
    // Abstand zu bereits gesetzten Bäumen
    let ok = true;
    for (const p of placed) { const d = Math.hypot(p.x - x, p.z - z); if (d < (p.trunk + trunk) * 1.3 + 1.6 || (d < (p.crown + crown) * 0.28 && (p.giant || giant))) { ok = false; break; } }
    if (!ok) continue;
    const neon = !dead && !giant && B.neon > 0 && r() < B.neon * 0.3;
    let tint = null;
    if (neon) { const nc = B.neonCC[Math.floor(r() * 3)]; tint = null; var neonCols = [nc, nc.map(v => v * 0.55), nc.map(v => Math.min(1, v * 0.6 + 0.45))]; }
    const spec = { B: neon ? Object.assign({}, B, { canopyC: neonCols }) : B, sp, x, y: h, z, s: sz, seed: Math.floor(r() * 1e9), giant, neon, tint, crown, trunk, height: info.h * sz * (giant ? 3.2 : 1) * (sp === 'tanne' || sp === 'schneetanne' ? 1.3 : 1), leafy: r() < 0.45 };
    if (!giant && !neon && inForest && B.tree !== 'knorrig' && r() < 0.3) spec.tint = [0.72, 0.72, 0.72];
    if (!giant && (spec.sp === 'tanne' || spec.sp === 'schneetanne')) spec.height = (11 + 5 * r()) * sz * 0.9;
    if (giant && (sp === 'tanne' || sp === 'schneetanne')) spec.height = 68;
    placed.push({ x, z, trunk, crown, giant });
    ch.trees.push(spec);
    ch.col.push({ x, z, r: Math.max(0.28, trunk * 0.92), top: h + spec.height });
  }
}

// ---------- Baumschicht eines Stücks (fern: Stämme + Laubkugeln, nah: Karten) ----------
function buildTreeLayer(ch, near) {
  const grp = new THREE.Group();
  if (!ch.trees.length) return grp;
  const mg = new Merger(), fmg = new Merger();
  const ls = new LeafSet(false), lsN = new LeafSet(true);
  ls.noCards = lsN.noCards = !near;
  for (const spec of ch.trees) makeTree(spec, mg, spec.neon ? lsN : ls, near);
  ls.addFarTo(fmg, near); lsN.addFarTo(fmg, near);
  if (!mg.empty) for (const g of mg.buildBuckets(64)) { const m = new THREE.Mesh(g, MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  if (!fmg.empty) {
    for (const g of fmg.buildBuckets(64)) {
      // Laubkugeln: in der Ferne die ganze Krone, in der Nähe der dichte Kern unter den Blattkarten
      const m = new THREE.Mesh(g, MAT.leafFar);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
    }
  }
  if (near) { if (!ls.empty) grp.add(leafObj(ls)); if (!lsN.empty) grp.add(leafObj(lsN)); }
  return grp;
}

// ---------- Unterholz: Büsche, Farne, Pilze, Blumen, Baumstämme, Findlinge ----------
const FLOWER_COLS = [[1, 0.86, 0.95], [1, 0.95, 0.55], [0.82, 0.82, 1], [1, 0.62, 0.5], [0.9, 0.55, 0.9], [0.6, 0.85, 1]];
function planUnderwood(ch, r, segs) {
  const x0 = ch.ci * CHUNK, z0 = ch.cj * CHUNK;
  const items = [], w = new Float32Array(NB);
  const castles = castlesNear(x0 + CHUNK / 2, z0 + CHUNK / 2);
  const tries = Math.round(62 * QUALITY[G.quality].leaf);
  for (let k = 0; k < tries; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const h = chunkHeight(ch, x, z);
    if (h < 0.6 || h > 52) continue;
    if (nearSite(x, z, 2) || inCastle(castles, x, z)) continue;
    if (segs.length && pathDist(x, z, segs) < 2.2) continue;
    chunkWeights(ch, x, z, w);
    const bi = sampleBiome(w, r()), B = BIOMES[bi];
    const fo = forestAt(x, z) * Math.min(1, B.trees * 1.5 + 0.1);
    const moist = B.cold < 0.5 && B.id !== 'duenen' && B.id !== 'gold';
    let t = r(), type = null;
    if (fo > 0.25) {
      if (t < 0.3) type = 'busch'; else if (t < 0.56 && moist) type = 'farn'; else if (t < 0.62) type = 'pilz'; else if (t < 0.68 && B.grass > 0.3) type = 'blume';
      else if (t < 0.7) type = 'stumpf'; else if (t < 0.72) type = 'stamm'; else if (t < 0.75) type = 'findling'; else if (t < 0.78 && (B.neon > 0.4 || B.id === 'toten')) type = 'riesenpilz';
    } else {
      if (t < 0.3 && B.grass > 0.3) type = 'blume'; else if (t < 0.5 && B.trees > 0.1) type = 'busch'; else if (t < 0.56) type = 'findling'; else if (t < 0.6) type = 'pilz'; else if (t < 0.65 && moist) type = 'farn';
    }
    if (!type) continue;
    const s = type === 'riesenpilz' ? 1.6 + r() * 1.2 : type === 'stamm' ? 3 + r() * 5 : 0.7 + r() * 0.9;
    const rad = type === 'stamm' ? 0.5 : type === 'riesenpilz' ? s * 0.5 : type === 'findling' ? s * 0.9 : type === 'stumpf' ? 0.5 : 0.8;
    let ok = true;
    for (const c of ch.col) { if (c.seg) continue; if (Math.hypot(c.x - x, c.z - z) < c.r + rad + 0.4) { ok = false; break; } }
    if (!ok) continue;
    const it = { type, x, z, y: h, s, B, bi, seed: Math.floor(r() * 1e9), fo, ang: r() * 6.28 };
    items.push(it);
    if (type === 'riesenpilz') ch.col.push({ x, z, r: s * 0.3, top: h + s * 2.2 });
    else if (type === 'stumpf') ch.col.push({ x, z, r: 0.55, top: h + 1 });
    else if (type === 'findling') ch.col.push({ x, z, r: s * 0.85, top: h + s * 0.8 });
    else if (type === 'stamm') {
      const L = s, a = it.ang;
      ch.col.push({ seg: true, ax: x - Math.cos(a) * L / 2, az: z - Math.sin(a) * L / 2, bx: x + Math.cos(a) * L / 2, bz: z + Math.sin(a) * L / 2, r: 0.55, top: h + 1.1 });
    }
  }
  ch.under = items;
  planFinds(ch, r, segs);
}

function buildUnderwood(ch) {
  const grp = new THREE.Group();
  const mg = new Merger(), ls = new LeafSet(), gl = new PointSet();
  for (const it of ch.under) {
    const r = mulberry32(it.seed), rc = mulberry32(it.seed ^ 0x51);
    const { x, z, y, s, B } = it;
    ls.sb = y; ls.sh = 2;
    switch (it.type) {
      case 'busch': {
        const cols = B.canopyC.map(c => c.map(v => v * 0.8));
        if (B.tree === 'knorrig' || B.id === 'toten') cols[0] = [0.3, 0.3, 0.2];
        const n = 1 + (r() < 0.5 ? 1 : 0);
        for (let q = 0; q < n; q++) {
          const ox = (r() - 0.5) * s, oz = (r() - 0.5) * s, ss = s * (0.7 + r() * 0.5);
          ls.clump(x + ox, y + 0.45 * ss, z + oz, 0.95 * ss, 0.62 * ss, 0.95 * ss, cols, rc, { size: 0.42, dens: 0.9, flat: 0.05 });
        }
        mg.add('cyl6', M(x, y - 0.1, z, 0.05, 0.5, 0.05), [0.2, 0.14, 0.1], 0, r, MT.bark);
        break;
      }
      case 'farn': {
        const cols = [B.stemC.map(v => Math.min(1, v * 1.5)), B.stemC.map(v => v * 0.9), B.tipC.map(v => v * 0.8)];
        for (let q = 0; q < 3; q++) ls.clump(x + (r() - 0.5) * 0.7, y + 0.38, z + (r() - 0.5) * 0.7, 0.62 * s, 0.38 * s, 0.62 * s, cols, rc, { kind: 4, size: 0.95 * s, dens: 0.28, flat: 0.1 });
        break;
      }
      case 'blume': {
        const n = 7 + Math.floor(r() * 9), pal = FLOWER_COLS[Math.floor(r() * FLOWER_COLS.length)], alt = FLOWER_COLS[Math.floor(r() * FLOWER_COLS.length)];
        for (let q = 0; q < n; q++) {
          const a = r() * 6.28, d = Math.sqrt(r()) * 1.5, fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d, fy = chunkHeight(ch, fx, fz);
          const hh = 0.28 + r() * 0.34, c = r() < 0.8 ? pal : alt;
          mg.add('cone4', M(fx, fy - 0.02, fz, 0.012, hh, 0.012), [0.2, 0.4, 0.14], 0, r, MT.gen);
          mg.add('oct', M(fx, fy + hh, fz, 0.07, 0.03, 0.07, (r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5), c, 0.1, r, MT.gen);
        }
        break;
      }
      case 'pilz': {
        const glow = B.neon > 0.4 && r() < 0.7;
        const nc = B.neonCC[Math.floor(r() * 3)];
        const cap = glow ? nc : pick(r, [[0.78, 0.16, 0.12], [0.8, 0.52, 0.24], [0.86, 0.82, 0.72], [0.5, 0.3, 0.52], [0.62, 0.44, 0.28]]);
        const n = 2 + Math.floor(r() * 5);
        for (let q = 0; q < n; q++) {
          const a = r() * 6.28, d = r() * 0.5, fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d, fy = chunkHeight(ch, fx, fz);
          const rs = (0.08 + r() * 0.12) * (0.8 + s * 0.4), hs = rs * (1.6 + r() * 1.4);
          mg.add('cone4', M(fx, fy - 0.02, fz, rs * 0.4, hs, rs * 0.4), [0.88, 0.85, 0.76], 0, r, MT.plaster);
          mg.add('sphS', M(fx, fy + hs, fz, rs, rs * 0.55, rs), cap, 0.05, r, glow ? MT.emit : MT.gen);
          if (!glow && cap[0] > 0.7 && cap[1] < 0.2) for (let sp = 0; sp < 4; sp++) { const sa = r() * 6.28, sr = rs * 0.62 * Math.sqrt(r()); mg.add('sphS', M(fx + Math.cos(sa) * sr, fy + hs + rs * 0.5 * Math.sqrt(Math.max(0, 1 - (sr / rs) ** 2)), fz + Math.sin(sa) * sr, rs * 0.14, rs * 0.07, rs * 0.14), [0.96, 0.95, 0.9], 0, r, MT.gen); }
          if (glow) gl.add(fx, fy + hs + rs * 0.3, fz, nc, 0.6);
        }
        break;
      }
      case 'riesenpilz': {
        const glow = B.neon > 0.3;
        const nc = B.neonCC[Math.floor(r() * 3)];
        const cap = glow ? nc.map(v => v * 0.85) : [0.7, 0.3, 0.18];
        const hs = s * (1.7 + r() * 0.5), rs = s * 1.05;
        tube(mg, [[x, y - 0.2, z], [x + (r() - 0.5) * 0.3, y + hs * 0.5, z], [x, y + hs, z]], [s * 0.38, s * 0.28, s * 0.26], [0.85, 0.82, 0.74], 10, MT.plaster, [0.8, 0.78, 0.7], r);
        mg.add('sph', M(x, y + hs, z, rs, rs * 0.5, rs), cap, 0.05, r, glow ? MT.emit : MT.gen);
        mg.add('cyl', M(x, y + hs - 0.05, z, rs * 0.95, 0.12, rs * 0.95), [0.6, 0.55, 0.5], 0, r, MT.plaster);
        for (let q = 0; q < 9; q++) { const a = r() * 6.28, d = rs * 0.7 * Math.sqrt(r()); mg.add('sphS', M(x + Math.cos(a) * d, y + hs + rs * 0.5 * Math.sqrt(Math.max(0, 1 - (d / rs) ** 2)) * 0.95, z + Math.sin(a) * d, rs * 0.1, rs * 0.04, rs * 0.1), glow ? [1, 1, 1] : [0.95, 0.9, 0.8], 0, r, MT.gen); }
        if (glow) { for (let q = 0; q < 16; q++) { const a = r() * 6.28, d = rs * Math.sqrt(r()); gl.add(x + Math.cos(a) * d, y + hs - 0.1, z + Math.sin(a) * d, nc, 0.9); } }
        break;
      }
      case 'stumpf': {
        const rr = 0.4 + r() * 0.5, hh = 0.4 + r() * 0.7;
        tube(mg, [[x, y - 0.3, z], [x + (r() - 0.5) * 0.1, y + hh * 0.5, z], [x, y + hh, z]], [rr * 1.25, rr * 1.05, rr], B.trunkC.map(v => v * 1.1), 11, MT.bark, null, r);
        mg.add('cyl', M(x, y + hh - 0.02, z, rr * 0.98, 0.05, rr * 0.98), [0.62, 0.48, 0.32], 0, r, MT.wood);
        mg.add('ico', M(x + rr * 0.3, y + hh * 0.9, z, rr * 0.6, 0.12, rr * 0.5), B.stemC.map(v => v * 0.8), 0, r, MT.gen);
        for (let q = 0; q < 3; q++) { const a = r() * 6.28; mg.add('sphS', M(x + Math.cos(a) * rr * 1.1, y + 0.08, z + Math.sin(a) * rr * 1.1, 0.06, 0.05, 0.06), [0.9, 0.55, 0.3], 0, r, MT.gen); }
        break;
      }
      case 'stamm': {
        const L = s, a = it.ang, rr = 0.36 + r() * 0.2, pts = [], rads = [];
        for (let q = 0; q <= 6; q++) {
          const t = q / 6 - 0.5, px = x + Math.cos(a) * L * t, pz = z + Math.sin(a) * L * t;
          pts.push([px, chunkHeight(ch, px, pz) + rr * 0.85, pz]); rads.push(rr * (1 - 0.18 * (t + 0.5)));
        }
        tube(mg, pts, rads, B.trunkC.map(v => v * 1.15), 10, MT.bark, null, r);
        mg.add('ico', M(x, y + rr * 1.6, z, L * 0.35, rr * 0.35, rr * 0.8, 0, -a, 0), B.stemC.map(v => v * 0.75), 0, r, MT.gen);
        if (r() < 0.6) { const q = x + Math.cos(a) * L * 0.2; mg.add('sph', M(q, y + rr * 1.8, z + Math.sin(a) * L * 0.2, 0.14, 0.07, 0.14), [0.85, 0.5, 0.25], 0, r, MT.gen); }
        break;
      }
      case 'findling': {
        const c = B.rockC.map(v => v * (0.85 + r() * 0.3));
        mg.add('rock', M(x, y + s * 0.28, z, s, s * 0.7, s * 0.85, 0, it.ang, 0), c, 0.15, r);
        if (r() < 0.5) mg.add('ico', M(x, y + s * 0.78, z, s * 0.75, s * 0.18, s * 0.65, 0, 0, 0), B.stemC.map(v => v * 0.75), 0.1, r, MT.gen);
        break;
      }
    }
  }
  if (!mg.empty) for (const g of mg.buildBuckets(64)) { const m = new THREE.Mesh(g, MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  if (!ls.empty) grp.add(leafObj(ls));
  if (!gl.empty) grp.add(new THREE.Points(gl.build(), MAT.glow));
  if (ch.finds && ch.finds.length) buildFinds(ch, grp);
  return grp;
}

// ---------- Überraschungen im Wald ----------
function planFinds(ch, r, segs) {
  ch.finds = [];
  const x0 = ch.ci * CHUNK, z0 = ch.cj * CHUNK;
  const giants = ch.trees.filter(t => t.giant && t.sp !== 'tot');
  const cx = x0 + CHUNK / 2, cz = z0 + CHUNK / 2;
  const fo = forestAt(cx, cz);
  const roll = r();
  const chance = 0.1 + fo * 0.3;
  if (roll > chance) return;
  const w = new Float32Array(NB);
  const place = (rad) => {
    for (let k = 0; k < 30; k++) {
      const x = x0 + 8 + r() * (CHUNK - 16), z = z0 + 8 + r() * (CHUNK - 16);
      const h = chunkHeight(ch, x, z);
      if (h < 0.9 || h > 40 || nearSite(x, z, 12) || inCastle(castlesNear(x, z), x, z)) continue;
      if (segs.length && pathDist(x, z, segs) < 5) continue;
      let ok = true;
      for (const c of ch.col) { if (c.seg) continue; if (Math.hypot(c.x - x, c.z - z) < c.r + rad) { ok = false; break; } }
      if (!ok) continue;
      chunkWeights(ch, x, z, w);
      return { x, z, y: h, B: BIOMES[sampleBiome(w, r())] };
    }
    return null;
  };
  let type;
  const v = r();
  if (giants.length && v < 0.55) type = r() < 0.6 ? 'wurzelhoehle' : 'baumhaus';
  else type = pick(r, ['pilzring', 'lagerruine', 'steinbogen', 'quelle', 'pilzring', 'lagerruine']);
  const f = { type, seed: Math.floor(r() * 1e9), idx: ch.finds.length };
  if (type === 'wurzelhoehle' || type === 'baumhaus') {
    const t = giants[Math.floor(r() * giants.length)];
    f.tree = t; f.x = t.x; f.z = t.z; f.y = t.y; f.B = t.B; f.ang = r() * 6.28;
  } else {
    const p = place(4);
    if (!p) return;
    Object.assign(f, p);
    f.ang = r() * 6.28;
    if (type === 'steinbogen') { ch.col.push({ x: f.x + Math.cos(f.ang) * 2.2, z: f.z + Math.sin(f.ang) * 2.2, r: 0.7, top: f.y + 5 }, { x: f.x - Math.cos(f.ang) * 2.2, z: f.z - Math.sin(f.ang) * 2.2, r: 0.7, top: f.y + 5 }); }
    if (type === 'quelle') ch.col.push({ x: f.x, z: f.z, r: 1.45, top: f.y + 1.1 });
    if (type === 'pilzring') ch.col.push({ x: f.x, z: f.z, r: 0.6, top: f.y + 0.5 });
  }
  ch.finds.push(f);
}

function buildFinds(ch, grp) {
  const dist = Math.hypot(ch.ci * CHUNK - World.spawnX, ch.cj * CHUNK - World.spawnZ);
  const site = { key: 'F' + ch.ci + ',' + ch.cj, type: 'fund', content: 'leer', level: 1 + dist / 700, x: ch.ci * CHUNK + CHUNK / 2, z: ch.cj * CHUNK + CHUNK / 2, seed: 1 };
  const out = newBuilt(site);
  ch.out = out;
  const mg = new Merger(), gl = new PointSet();
  const warm = [1, 0.7, 0.35];
  for (const f of ch.finds) {
    const r = mulberry32(f.seed), { x, z, y, B } = f;
    const stone = B.rockC.map(v => Math.min(1, v * 1.1));
    const key = site.key + ':' + f.idx;
    switch (f.type) {
      case 'wurzelhoehle': {
        const t = f.tree, tr = t.trunk, a = f.ang, ca = Math.cos(a), sa = Math.sin(a);
        const dx = x + ca * tr * 0.92, dz = z + sa * tr * 0.92, gy = chunkHeight(ch, dx, dz);
        mg.add('sph', M(dx, gy + 1.0, dz, 0.85, 1.25, 0.8, 0, -a + Math.PI / 2, 0), [0.015, 0.012, 0.02], 0, r, MT.gen);
        for (const sd of [-1, 1]) {
          const px = -sa * sd, pz = ca * sd;
          tube(mg, [[x + ca * tr * 0.7 + px * 0.5, gy + 2.6, z + sa * tr * 0.7 + pz * 0.5], [x + ca * (tr + 0.5) + px * 1.1, gy + 1.6, z + sa * (tr + 0.5) + pz * 1.1], [x + ca * (tr + 1.0) + px * 1.5, gy + 0.2, z + sa * (tr + 1.0) + pz * 1.5], [x + ca * (tr + 1.3) + px * 1.7, gy - 0.3, z + sa * (tr + 1.3) + pz * 1.7]], [0.4, 0.34, 0.26, 0.14], t.B.trunkC, 8, MT.bark, null, r);
        }
        const cx = x + ca * (tr + 1.7), cz = z + sa * (tr + 1.7);
        makeChest(out, key, cx, cz, Math.atan2(-ca, -sa), false, !!S.opened[key], false);
        const lg = makeGlow(0xffb060, 3.4, 0.55); lg.position.set(dx - ca * 0.2, gy + 1.0, dz - sa * 0.2); out.group.add(lg);
        for (let q = 0; q < 6; q++) gl.add(dx + (r() - 0.5) * 1.2, gy + 0.2 + r() * 1.6, dz + (r() - 0.5) * 0.6, warm, 0.8);
        break;
      }
      case 'baumhaus': {
        const t = f.tree, tr = t.trunk, ph = Math.min(13, Math.max(8, t.height * 0.34)), py = y + ph, a = f.ang, ca = Math.cos(a), sa = Math.sin(a);
        const wood = [0.42, 0.28, 0.17];
        const R = tr + 2.6;
        mg.add('cyl', M(x, py - 0.25, z, R, 0.3, R), wood, 0.1, r, MT.wood);
        for (let q = 0; q < 14; q++) { const b = q / 14 * 6.2832; mg.add('cyl6', M(x + Math.cos(b) * R * 0.98, py, z + Math.sin(b) * R * 0.98, 0.06, 1.0, 0.06), wood, 0, r, MT.wood); }
        mg.add('cyl', M(x, py + 0.95, z, R * 0.99, 0.08, R * 0.99), wood, 0, r, MT.wood);
        // Hütte
        const hx = x + ca * (tr + 1.2), hz = z + sa * (tr + 1.2), ry = -a + Math.PI / 2;
        mg.add('box', M(hx, py + 1.7, hz, 2.4, 2.8, 2.2, 0, ry, 0), wood.map(v => v * 1.15), 0.1, r, MT.wood);
        mg.add('cone4', M(hx, py + 3.1, hz, 2.15, 1.5, 2.15, 0, ry + Math.PI / 4, 0), [0.35, 0.2, 0.16], 0, r, MT.roof);
        mg.add('box', M(hx + ca * 1.2, py + 1.5, hz + sa * 1.2, 0.05, 0.9, 0.7, 0, ry, 0), [1, 0.78, 0.4], 0, r, MT.emit);
        const lg = makeGlow(0xffb060, 5, 0.6); lg.position.set(hx + ca * 1.4, py + 1.5, hz + sa * 1.4); out.group.add(lg);
        // Strickleiter
        const la = a + 2.4, lx = x + Math.cos(la) * (tr + 0.5), lz = z + Math.sin(la) * (tr + 0.5);
        for (const o of [-0.25, 0.25]) tube(mg, [[lx - Math.sin(la) * o, py, lz + Math.cos(la) * o], [lx - Math.sin(la) * o, y, lz + Math.cos(la) * o]], [0.03, 0.03], [0.5, 0.4, 0.28], 5, MT.wood, null, r);
        for (let q = 0; q < ph / 0.5; q++) mg.add('cyl6', M(lx, y + q * 0.5 + 0.3, lz, 0.025, 0.55, 0.025, 0, 0, Math.PI / 2, ), wood, 0, r, MT.wood);
        for (let q = 0; q < 8; q++) gl.add(lx + (r() - 0.5) * 3, py + 1.5 + r() * 2, lz + (r() - 0.5) * 3, warm, 0.7);
        break;
      }
      case 'pilzring': {
        const glow = B.neon > 0.2 || r() < 0.5;
        const nc = glow ? (B.neon > 0.2 ? B.neonCC[Math.floor(r() * 3)] : [0.5, 0.85, 1]) : [0.8, 0.2, 0.15];
        const n = 11;
        for (let q = 0; q < n; q++) {
          const a = q / n * 6.2832 + (r() - 0.5) * 0.2, d = 2.3 + (r() - 0.5) * 0.3, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = chunkHeight(ch, px, pz);
          const rs = 0.14 + r() * 0.12, hs = rs * (1.6 + r());
          mg.add('cone4', M(px, py - 0.02, pz, rs * 0.4, hs, rs * 0.4), [0.9, 0.88, 0.8], 0, r, MT.plaster);
          mg.add('sphS', M(px, py + hs, pz, rs, rs * 0.55, rs), nc, 0.05, r, glow ? MT.emit : MT.gen);
          gl.add(px, py + hs + 0.1, pz, nc, 0.9);
        }
        mg.add('cyl', M(x, y - 0.1, z, 0.5, 0.45, 0.5), stone, 0.1, r, MT.stone);
        mg.add('cyl', M(x, y + 0.34, z, 0.38, 0.05, 0.38), nc.map(v => v * 0.9), 0, r, MT.emit);
        for (let q = 0; q < 20; q++) { const a = r() * 6.28, d = r() * 2.2; gl.add(x + Math.cos(a) * d, y + 0.15 + r() * 0.5, z + Math.sin(a) * d, nc, 0.6); }
        out.interact.push({ kind: 'ring', x, z, r: 3.1, key, y, col: nc });
        break;
      }
      case 'lagerruine': {
        const a = f.ang;
        for (let q = 0; q < 8; q++) { const b = q / 8 * 6.28; const px = x + Math.cos(b) * 0.85, pz = z + Math.sin(b) * 0.85; mg.add('rock', M(px, chunkHeight(ch, px, pz) + 0.12, pz, 0.28, 0.2, 0.28, 0, r() * 6, 0), [0.32, 0.3, 0.32], 0.2, r); }
        for (let q = 0; q < 3; q++) mg.add('cyl6', M(x, y + 0.14, z, 0.07, 1.2, 0.07, 0, q * 1.05, Math.PI / 2 - 0.1), [0.08, 0.06, 0.06], 0, r, MT.bark);
        mg.add('cone4', M(x + Math.cos(a) * 4, y - 0.1, z + Math.sin(a) * 4, 2.4, 1.6, 2.4, 0.3, -a, 0.35), [0.55, 0.5, 0.42], 0.1, r, MT.cloth);
        mg.add('cyl6', M(x + Math.cos(a) * 4 + 1.1, y - 0.1, z + Math.sin(a) * 4, 0.05, 2.3, 0.05, 0.1, 0, 0.6), [0.4, 0.3, 0.2], 0, r, MT.wood);
        for (let q = 0; q < 4; q++) mg.add('cyl', M(x + Math.cos(a + 2) * 3 + (r() - 0.5), y + 0.3, z + Math.sin(a + 2) * 3 + (r() - 0.5), 0.3, 0.7, 0.3), [0.36, 0.25, 0.16], 0.1, r, MT.wood);
        const cx = x + Math.cos(a + 1.3) * 2.6, cz = z + Math.sin(a + 1.3) * 2.6;
        makeChest(out, key, cx, cz, Math.atan2(x - cx, z - cz), false, !!S.opened[key], false);
        ch.col.push({ x: x + Math.cos(a) * 4, z: z + Math.sin(a) * 4, r: 1.4, top: y + 2 });
        const lg = makeGlow(0xffb060, 2.2, 0.35); lg.position.set(x, y + 0.5, z); out.group.add(lg);
        break;
      }
      case 'steinbogen': {
        const a = f.ang, ca = Math.cos(a), sa = Math.sin(a);
        for (const sd of [-1, 1]) {
          const px = x + ca * 2.2 * sd, pz = z + sa * 2.2 * sd, py = chunkHeight(ch, px, pz);
          mg.add('cyl', M(px, py - 0.4, pz, 0.7, 4.8 - (sd > 0 ? 1.4 : 0), 0.7), stone, 0.05, r, MT.stone);
          mg.add('box', M(px, py + 4.6 - (sd > 0 ? 1.4 : 0), pz, 1.1, 0.35, 1.1, 0, -a, 0), stone.map(v => v * 0.9), 0.05, r, MT.stone);
          mg.add('ico', M(px, py + 1.0, pz, 0.8, 0.55, 0.8), B.stemC.map(v => v * 0.8), 0, r, MT.gen);
        }
        mg.add('box', M(x - ca * 1.0, y + 4.55, z - sa * 1.0, 3.4, 0.6, 1.0, 0, -a, 0.05), stone, 0.05, r, MT.stone);
        mg.add('box', M(x + ca * 0.6, y + 0.4, z + sa * 0.6, 1.4, 0.4, 0.9, 0.1, -a + 0.3, 0.1), stone.map(v => v * 0.85), 0.1, r, MT.stone);
        const nc = [0.4, 0.9, 1];
        mg.add('box', M(x - ca * 2.2, y + 2.4, z - sa * 2.2, 0.05, 1.0, 0.25, 0, -a, 0), nc, 0, r, MT.emit);
        const lg = makeGlow(0x70d0ff, 3, 0.4); lg.position.set(x - ca * 2.2, y + 2.4, z - sa * 2.2); out.group.add(lg);
        for (let q = 0; q < 14; q++) gl.add(x + (r() - 0.5) * 4.5, y + 0.5 + r() * 4, z + (r() - 0.5) * 2, nc, 0.7);
        break;
      }
      case 'quelle': {
        for (let q = 0; q < 12; q++) { const b = q / 12 * 6.28, px = x + Math.cos(b) * 1.3, pz = z + Math.sin(b) * 1.3; mg.add('rock', M(px, y + 0.35, pz, 0.42, 0.42, 0.42, 0, r() * 6, 0), stone, 0.15, r); }
        mg.add('cyl', M(x, y + 0.05, z, 1.2, 0.5, 1.2), [0.2, 0.55, 0.75], 0, r, MT.emit);
        mg.add('cyl', M(x, y - 0.1, z, 1.55, 0.35, 1.55), stone.map(v => v * 0.8), 0, r, MT.stone);
        const lg = makeGlow(0x70c8ff, 4.5, 0.45); lg.position.set(x, y + 0.7, z); out.group.add(lg);
        for (let q = 0; q < 22; q++) { const b = r() * 6.28, d = r() * 1.2; gl.add(x + Math.cos(b) * d, y + 0.5 + r() * 1.1, z + Math.sin(b) * d, [0.6, 0.85, 1], 0.8); }
        out.interact.push({ kind: 'quelle', x, z, r: 3, key, y });
        break;
      }
    }
  }
  if (!mg.empty) for (const g of mg.buildBuckets(64)) { const m = new THREE.Mesh(g, MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  if (!gl.empty) grp.add(new THREE.Points(gl.build(), MAT.glowBig));
  grp.add(out.group);
  // Truhen und Feuerstellen am Leben halten
  out.updaters.push(dt => updateChests(out, dt));
}
