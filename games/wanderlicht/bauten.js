'use strict';
// Wanderlicht – Bauten: Burgen, Wunder, Lager, Aussichtspunkte und Wanderer

const STONES = [[0.38, 0.38, 0.42], [0.32, 0.31, 0.35], [0.45, 0.43, 0.44], [0.28, 0.27, 0.3], [0.48, 0.46, 0.5], [0.42, 0.37, 0.35], [0.36, 0.38, 0.44]];
const ROOFS = [[0.18, 0.19, 0.25], [0.3, 0.15, 0.18], [0.15, 0.22, 0.26], [0.24, 0.18, 0.3], [0.14, 0.14, 0.17], [0.32, 0.24, 0.2]];
const DARK = [0.07, 0.06, 0.09];
const WOOD = [0.45, 0.3, 0.2];

function initBauten() {
  MAT.crystal = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a2a60, transparent: true, opacity: 0.9 });
  MAT.lichtLeaves = pointsMat(0.8, { emit: 0.85 });
  MAT.whale = pointsMat(1.15, { emit: 0.3, sway: 0 });
  MAT.fall = pointsMat(0.5, { emit: 0.6, sway: 0 });
  MAT.unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  G.fireLight = new THREE.PointLight(0xff9050, 0, 16, 2);
  G.scene.add(G.fireLight);
}

function newBuilt(s) {
  return { site: s, group: new THREE.Group(), colliders: [], interact: [], spawns: [], chests: [], fires: [], updaters: [], gate: null };
}
function segCollider(out, ax, az, bx, bz, r) { out.colliders.push({ seg: true, ax, az, bx, bz, r }); }
function circCollider(out, x, z, r) { const c = { seg: false, x, z, r }; out.colliders.push(c); return c; }
function boxCollider(out, cx, cz, w, d, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [cx + u * c - v * s, cz + u * s + v * c]);
  for (let i = 0; i < 4; i++) segCollider(out, pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], 0.3);
}

// Flackerndes Feuer
function addFire(out, x, y, z, col = 0xff9a50, size = 1) {
  const g1 = makeGlow(col, 3.2 * size, 0.9), g2 = makeGlow(0xffe0a0, 1.4 * size, 1);
  g1.position.set(x, y + 0.6 * size, z); g2.position.set(x, y + 0.45 * size, z);
  out.group.add(g1, g2);
  const f = { x, y, z, g1, g2, size, col: new THREE.Color(col), sparkT: Math.random() };
  out.fires.push(f);
  return f;
}
function updateFires(out, dt) {
  for (const f of out.fires) {
    const k = 0.85 + Math.random() * 0.3;
    f.g1.scale.setScalar(3.2 * f.size * k); f.g2.scale.setScalar(1.4 * f.size * (0.8 + Math.random() * 0.4));
    f.sparkT -= dt;
    if (f.sparkT <= 0) { f.sparkT = 0.15 + Math.random() * 0.3; burst(f.x, f.y + 0.5 * f.size, f.z, 1, f.col, 1.2, 0.12 * f.size, 1.4, -1.2, 0.4); }
  }
}

// ---------- Truhen ----------
function makeChest(out, key, x, z, rotY, big, opened, locked) {
  const y = groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rotY;
  const s = big ? 1.45 : 1;
  const wood = big ? [0.3, 0.2, 0.32] : [0.46, 0.29, 0.18], trim = big ? [0.75, 0.75, 0.95] : [0.86, 0.68, 0.3];
  const mg = new Merger();
  mg.add('box', M(0, 0.3 * s, 0, 1.0 * s, 0.6 * s, 0.66 * s), wood, 0.1);
  mg.add('box', M(-0.38 * s, 0.3 * s, 0, 0.08 * s, 0.62 * s, 0.7 * s), trim);
  mg.add('box', M(0.38 * s, 0.3 * s, 0, 0.08 * s, 0.62 * s, 0.7 * s), trim);
  g.add(new THREE.Mesh(mg.build(), MAT.flat));
  const lid = new THREE.Group();
  lid.position.set(0, 0.6 * s, -0.33 * s);
  const lm = new Merger();
  lm.add('box', M(0, 0.11 * s, 0.33 * s, 1.02 * s, 0.22 * s, 0.68 * s), wood.map(v => v * 1.1), 0.1);
  lm.add('box', M(-0.38 * s, 0.11 * s, 0.33 * s, 0.08 * s, 0.24 * s, 0.7 * s), trim);
  lm.add('box', M(0.38 * s, 0.11 * s, 0.33 * s, 0.08 * s, 0.24 * s, 0.7 * s), trim);
  lm.add('box', M(0, 0.02 * s, 0.68 * s, 0.16 * s, 0.2 * s, 0.06 * s), trim);
  lid.add(new THREE.Mesh(lm.build(), MAT.flat));
  if (opened) lid.rotation.x = -1.9;
  g.add(lid);
  const glow = makeGlow(big ? 0xa0b0ff : 0xffd080, 2.4 * s, 0.35);
  glow.position.y = 0.7 * s;
  glow.visible = !opened;
  g.add(glow);
  out.group.add(g);
  const c = { key, x, z, y, big, opened, locked: !!locked && !opened, lid, glow, open: 0 };
  out.chests.push(c);
  out.interact.push({ kind: 'chest', chest: c, x, z, r: 2.2 });
  circCollider(out, x, z, 0.6 * s);
  return c;
}
function updateChests(out, dt) {
  for (const c of out.chests) {
    if (c.opened && c.open < 1) { c.open = Math.min(1, c.open + dt * 2.5); c.lid.rotation.x = -1.9 * (1 - Math.pow(1 - c.open, 3)); }
    if (!c.opened) c.glow.material.opacity = (c.locked ? 0.12 : 0.3) + Math.sin(U.uTime.value * 3) * 0.08;
  }
}

// ---------- Burgen ----------
function buildCastle(s, st) {
  const r = mulberry32(s.seed);
  const B = BIOMES[s.biome];
  const out = newBuilt(s);
  const mg = new Merger(), ps = new PointSet();
  const stone = pick(r, STONES).map((v, i) => lerp(v, B.rockC[i], 0.25));
  const roof = pick(r, ROOFS);
  const R = s.radius, round = r() < 0.2, n = round ? 10 : 4 + Math.floor(r() * 4);
  const wallH = 6 + r() * 5, th = 1.6;
  const ruin = r() * 0.85;
  const rot0 = r() * Math.PI * 2, y0 = s.baseH, cx = s.x, cz = s.z;
  const boss = s.content === 'boss';
  const ivyCols = B.canopyC.map(c => c.map(v => v * 0.85));
  const corners = [];
  for (let i = 0; i < n; i++) { const a = rot0 + i / n * Math.PI * 2; corners.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
  // Tor liegt in der Mitte der ersten Seite
  const gateX = (corners[0][0] + corners[1][0]) / 2, gateZ = (corners[0][1] + corners[1][1]) / 2;
  const gA = Math.atan2(gateZ - cz, gateX - cx);
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const pieces = Math.max(2, Math.round(len / 3));
    const pl = len / pieces;
    const nx = Math.sin(ang), nz = -Math.cos(ang);
    let arch = false;
    for (let k = 0; k < pieces; k++) {
      const t0 = k / pieces, t1 = (k + 1) / pieces, tm = (t0 + t1) / 2;
      const px = ax + (bx - ax) * tm, pz = az + (bz - az) * tm;
      const isGate = i === 0 && Math.abs(tm - 0.5) * len < 2.7;
      const nearCorner = tm * len < 3.2 || (1 - tm) * len < 3.2;
      let h = wallH, present = true;
      if (isGate) present = false;
      else if (!nearCorner && r() < ruin * 0.45) present = false;
      else h = wallH * (1 - ruin * r() * 0.7);
      if (isGate && !arch) {
        arch = true;
        if (ruin < 0.55) {
          mg.add('box', M(gateX, y0 + wallH - 0.6, gateZ, 6, 1.6, th * 1.1, 0, -ang, 0), stone, 0.1, r);
          for (const sx of [-1, 1]) mg.add('box', M(gateX + Math.cos(ang) * 3 * sx, y0 + wallH / 2 - 1, gateZ + Math.sin(ang) * 3 * sx, 1.4, wallH + 2, th * 1.4, 0, -ang, 0), stone.map(v => v * 0.92), 0.1, r);
        }
      }
      if (!present) {
        if (!isGate) for (let q = 0; q < 3; q++) mg.add('box', M(px + (r() - 0.5) * 3, y0 + 0.2, pz + (r() - 0.5) * 3, 0.5 + r(), 0.5 + r() * 0.6, 0.5 + r(), r(), r() * 3, r()), stone, 0.15, r);
        continue;
      }
      mg.add('box', M(px, y0 + h / 2 - 1, pz, pl + 0.08, h + 2, th, 0, -ang, 0), stone, 0.12, r);
      if (h > wallH * 0.9) {
        for (const o of [-0.25, 0.25]) mg.add('box', M(px + Math.cos(ang) * pl * o, y0 + h + 0.3, pz + Math.sin(ang) * pl * o, pl * 0.32, 0.6, th * 1.05, 0, -ang, 0), stone, 0.1, r);
      }
      if (r() < 0.4) {
        for (let q = 0; q < 50; q++) {
          const tt = t0 + r() * (t1 - t0), side = r() < 0.5 ? 1 : -1, hh = Math.pow(r(), 1.5) * h * 0.9;
          const qx = ax + (bx - ax) * tt + nx * side * (th / 2 + 0.06), qz = az + (bz - az) * tt + nz * side * (th / 2 + 0.06);
          ps.add(qx, y0 + hh, qz, ivyCols[q % 3], 0.8 + r() * 0.3);
        }
      }
      const p0x = ax + (bx - ax) * t0, p0z = az + (bz - az) * t0, p1x = ax + (bx - ax) * t1, p1z = az + (bz - az) * t1;
      segCollider(out, p0x, p0z, p1x, p1z, th / 2 + 0.3);
    }
  }
  // Fackeln am Tor
  const torchCol = boss ? 0xb070ff : 0xff9a50;
  for (const sx of [-1, 1]) {
    const ax = gateX + Math.cos(gA - Math.PI / 2) * 3.6 * sx + Math.cos(gA) * 1.3, az = gateZ + Math.sin(gA - Math.PI / 2) * 3.6 * sx + Math.sin(gA) * 1.3;
    mg.add('cyl6', M(ax, y0 - 0.3, az, 0.1, 3, 0.1), WOOD);
    mg.add('cyl6', M(ax, y0 + 2.7, az, 0.25, 0.2, 0.25), [0.3, 0.28, 0.3]);
    addFire(out, ax, y0 + 2.8, az, torchCol, 0.55);
  }
  // Türme
  for (const [tx, tz] of corners) {
    const tr = 2.2 + r() * 1.3;
    let tH = wallH + 6 + r() * 15;
    const broken = r() < ruin * 0.8;
    if (broken) tH *= 0.45 + r() * 0.4;
    const square = r() < 0.3, rotT = r() * Math.PI;
    if (square) mg.add('box', M(tx, y0 + tH / 2 - 0.5, tz, tr * 1.7, tH + 1, tr * 1.7, 0, rotT, 0), stone, 0.12, r);
    else mg.add('cyl', M(tx, y0 - 1, tz, tr, tH + 1, tr, 0, rotT, 0), stone, 0.12, r);
    if (!broken && r() > 0.2) {
      const rh = tr * (2.4 + r() * 1.8) + r() * 4;
      if (square) {
        mg.add('cone4', M(tx, y0 + tH, tz, tr * 1.3, rh, tr * 1.3, 0, rotT + Math.PI / 4, 0), roof, 0.08, r);
        for (let q = 0; q < 4; q++) { const a = rotT + q * Math.PI / 2 + Math.PI / 4; mg.add('cone4', M(tx + Math.cos(a) * tr * 1.15, y0 + tH - 0.5, tz + Math.sin(a) * tr * 1.15, 0.35, 2.5 + r() * 1.5, 0.35), roof, 0.08, r); }
      } else mg.add('cone', M(tx, y0 + tH, tz, tr * 1.12, rh, tr * 1.12), roof, 0.08, r);
      if (r() < 0.5) {
        mg.add('cyl6', M(tx, y0 + tH + rh - 0.2, tz, 0.05, 2.2, 0.05), [0.3, 0.3, 0.32]);
        mg.add('box', M(tx + 0.55, y0 + tH + rh + 1.6, tz, 1.0, 0.55, 0.05), roof.map(v => Math.min(1, v * 1.5)));
      }
    } else {
      for (let q = 0; q < 6; q++) {
        if (broken && r() < 0.5) continue;
        const a = q / 6 * Math.PI * 2;
        mg.add('box', M(tx + Math.cos(a) * tr * 0.85, y0 + tH + 0.3, tz + Math.sin(a) * tr * 0.85, 0.7, 0.6, 0.7, 0, -a, 0), stone, 0.1, r);
      }
    }
    // Fenster
    const oa = Math.atan2(tz - cz, tx - cx);
    for (let q = 0; q < 2; q++) {
      const wy = y0 + 3 + q * 3.5;
      if (wy > y0 + tH - 1) break;
      const wx = tx + Math.cos(oa) * (tr * (square ? 0.86 : 0.98)), wz = tz + Math.sin(oa) * (tr * (square ? 0.86 : 0.98));
      mg.add('box', M(wx, wy, wz, 0.5, 1.0, 0.3, 0, -oa + Math.PI / 2, 0), DARK);
      if (boss ? r() < 0.6 : r() < 0.18) { const gw = makeGlow(boss ? 0xb080ff : pick(r, [0xffa040, 0xd8ff70]), 1.6, 0.7); gw.position.set(wx, wy, wz); out.group.add(gw); }
    }
    circCollider(out, tx, tz, tr + 0.3);
  }
  // Bergfried
  let keepFront = null;
  if (r() < 0.85) {
    const kx = cx - Math.cos(gA) * R * 0.3, kz = cz - Math.sin(gA) * R * 0.3;
    const kw = 5 + r() * 3.5, kd = 5 + r() * 3.5;
    let kh = 14 + r() * 16;
    if (ruin > 0.55) kh *= 0.6;
    const ka = -gA + Math.PI / 2;
    mg.add('box', M(kx, y0 + kh / 2 - 1, kz, kw, kh + 2, kd, 0, ka, 0), stone.map(v => v * 0.95), 0.1, r);
    if (ruin < 0.5) {
      mg.add('cone4', M(kx, y0 + kh, kz, kw * 0.74, 8 + r() * 9, kd * 0.74, 0, ka + Math.PI / 4, 0), roof, 0.08, r);
      for (let q = 0; q < 4; q++) {
        const u = (q & 1 ? 1 : -1) * kw * 0.48, v = (q & 2 ? 1 : -1) * kd * 0.48, c = Math.cos(-ka), sn = Math.sin(-ka);
        mg.add('cone4', M(kx + u * c - v * sn, y0 + kh - 1, kz + u * sn + v * c, 0.5, 4 + r() * 3, 0.5, 0, ka + Math.PI / 4, 0), roof, 0.08, r);
      }
    }
    else for (let q = 0; q < 8; q++) { if (r() < ruin * 0.6) continue; const a = q / 8 * Math.PI * 2; mg.add('box', M(kx + Math.cos(a) * kw * 0.45, y0 + kh + 0.3, kz + Math.sin(a) * kd * 0.45, 0.8, 0.6, 0.8, 0, ka, 0), stone, 0.1, r); }
    // Seitentürmchen
    if (r() < 0.6) {
      const sx = kx + Math.cos(-ka + 0.8) * kw * 0.6, sz = kz + Math.sin(-ka + 0.8) * kd * 0.6;
      const sh = kh + 6 + r() * 9;
      mg.add('cyl', M(sx, y0 - 1, sz, 1.3, sh + 1, 1.3), stone, 0.1, r);
      if (ruin < 0.6) mg.add('cone', M(sx, y0 + sh, sz, 1.5, 6 + r() * 5, 1.5), roof, 0.08, r);
    }
    const fx = kx + Math.cos(gA) * (kd / 2 + 0.05), fz = kz + Math.sin(gA) * (kd / 2 + 0.05);
    mg.add('box', M(fx, y0 + 1.2, fz, 2, 2.6, 0.3, 0, ka, 0), DARK);
    for (let q = 0; q < 3; q++) {
      const wy = y0 + 5 + q * 3.2; if (wy > y0 + kh - 1) break;
      for (const o of [-1, 1]) {
        const wx = fx + Math.cos(ka) * o * kw * 0.28, wz = fz - Math.sin(ka) * o * kw * 0.28;
        mg.add('box', M(wx, wy, wz, 0.55, 1.1, 0.3, 0, ka, 0), DARK);
      }
    }
    boxCollider(out, kx, kz, kw + 0.4, kd + 0.4, -ka);
    keepFront = [kx + Math.cos(gA) * (kd / 2 + 3), kz + Math.sin(gA) * (kd / 2 + 3)];
  }
  // Kisten, Fässer, Steine im Hof
  for (let q = 0; q < 4 + Math.floor(r() * 4); q++) {
    const a = r() * Math.PI * 2, d = R * (0.6 + r() * 0.25);
    const px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
    if (Math.abs(Math.atan2(Math.sin(a - gA), Math.cos(a - gA))) < 0.5) continue;
    if (r() < 0.5) mg.add('cyl', M(px, y0 - 0.1, pz, 0.45, 1.1, 0.45), WOOD.map(v => v * 0.9), 0.1, r);
    else mg.add('box', M(px, y0 + 0.4, pz, 1, 1, 1, 0, r() * 3, 0), WOOD, 0.1, r);
  }
  // Truhen
  const nCh = 1 + Math.floor(r() * 2);
  for (let k = 0; k < nCh; k++) {
    let a = gA + Math.PI * (0.45 + r() * 1.1) * (r() < 0.5 ? 1 : -1);
    const d = R * (0.5 + r() * 0.2);
    const px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
    const key = s.key + ':c' + k;
    makeChest(out, key, px, pz, Math.atan2(cx - px, cz - pz), false, st.opened(key));
  }
  if (boss) {
    const [bx, bz] = keepFront || [cx, cz];
    const key = s.key + ':boss';
    makeChest(out, key, bx, bz, Math.atan2(Math.cos(gA), Math.sin(gA)), true, st.opened(key), !st.cleared(s.key));
  }
  // Bewohner
  if (!st.cleared(s.key)) {
    const types = s.biome === 3 || s.biome === 0 ? ['ritter', 'schatten', 'waechter'] : ['waechter', 'ritter', 'dornling', 'schatten'];
    if (s.content === 'wachen') {
      const cnt = 2 + Math.floor(r() * 3);
      for (let k = 0; k < cnt; k++) {
        const a = r() * Math.PI * 2, d = R * (0.2 + r() * 0.4);
        out.spawns.push({ type: pick(r, types), x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, boss: false });
      }
    } else if (boss) {
      const bt = pick(r, types);
      const [bx, bz] = keepFront || [cx, cz];
      out.spawns.push({ type: bt, x: (bx + cx) / 2, z: (bz + cz) / 2, boss: true, name: pick(r, BOSS_TITLES[bt]) });
      const minions = Math.floor(r() * 3);
      for (let k = 0; k < minions; k++) {
        const a = r() * Math.PI * 2, d = R * 0.45;
        out.spawns.push({ type: bt === 'waechter' ? 'schatten' : 'waechter', x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, boss: false });
      }
    }
  }
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!ps.empty) out.group.add(new THREE.Points(ps.build(), MAT.leaves));
  out.updaters.push(dt => { updateFires(out, dt); updateChests(out, dt); });
  return out;
}

// ---------- Wunder ----------
function risingMotes(out, n, cx, cy, cz, rad, height, col, speed = 1.2, size = 0.5) {
  const ps = new PointSet();
  const data = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * rad;
    data.push([cx + Math.cos(a) * d, Math.random() * height, cz + Math.sin(a) * d, speed * (0.5 + Math.random())]);
    ps.add(0, 0, 0, Array.isArray(col[0]) ? col[i % col.length] : col, 0.8 + Math.random() * 0.4);
  }
  const g = ps.build();
  const mat = pointsMat(size, { emit: 1, additive: true, sway: 0 });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  out.group.add(pts);
  const arr = g.attributes.position.array;
  out.updaters.push(dt => {
    for (let i = 0; i < n; i++) {
      const d = data[i];
      d[1] += d[3] * dt;
      if (d[1] > height) d[1] = 0;
      const t = U.uTime.value;
      arr[i * 3] = d[0] + Math.sin(t * 0.7 + i) * 0.6; arr[i * 3 + 1] = cy + d[1]; arr[i * 3 + 2] = d[2] + Math.cos(t * 0.6 + i * 1.3) * 0.6;
    }
    g.attributes.position.needsUpdate = true;
  });
  return pts;
}

function buildWonder(s, st) {
  const r = mulberry32(s.seed);
  const B = BIOMES[s.biome];
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = s.baseH;
  const mg = new Merger(), ps = new PointSet();
  let psMat = MAT.leaves;
  switch (s.wonder) {
    case 'lichtbaum': {
      const bark = [0.24, 0.2, 0.3];
      mg.add('taper', M(x, y0 - 1, z, 1.8, 14, 1.8, 0, r(), 0), bark, 0.1, r);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + r() * 0.4; mg.add('taper', branchM(x + Math.cos(a) * 1.1, y0 - 0.4, z + Math.sin(a) * 1.1, 0.55, 4.5, a, 1.35), bark, 0.1, r); }
      const cols = s.biome === 2 ? [[1, 0.75, 0.9], [0.85, 0.5, 0.75], [1, 0.95, 1]] : [[0.62, 0.9, 1], [0.45, 0.6, 0.95], [0.92, 0.98, 1]];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 6.283 + r(), tilt = 0.7 + r() * 0.4, L = 7 + r() * 3, by = y0 + 9 + r() * 3;
        mg.add('taper', branchM(x, by, z, 0.5, L, a, tilt), bark, 0.1, r);
        const ex = x + Math.cos(a) * Math.sin(tilt) * L, ez = z + Math.sin(a) * Math.sin(tilt) * L, ey = by + Math.cos(tilt) * L;
        blob(ps, ex, ey + 1.2, ez, 4.2 + r() * 1.5, 2.2 + r(), 4.2 + r() * 1.5, cols, r, 7);
        for (let q = 0; q < 10; q++) {
          const ha = r() * 6.283, hd = r() * 4, hl = 3 + r() * 6;
          for (let k = 0; k < 10; k++) ps.add(ex + Math.cos(ha) * hd, ey - k / 10 * hl, ez + Math.sin(ha) * hd, k > 7 ? cols[2] : cols[0], 0.9);
        }
      }
      blob(ps, x, y0 + 21, z, 6, 3.4, 6, cols, r, 7);
      psMat = MAT.lichtLeaves;
      const halo = makeGlow(cols[0][2] > 0.95 ? 0x90d0ff : 0xffa0d8, 46, 0.16); halo.position.set(x, y0 + 17, z); out.group.add(halo);
      risingMotes(out, 160, x, y0, z, 16, 30, cols, 0.9, 0.35);
      circCollider(out, x, z, 2.2);
      break;
    }
    case 'inseln': {
      const cnt = 3 + Math.floor(r() * 3);
      for (let i = 0; i < cnt; i++) {
        const a = i / cnt * 6.283 + r(), d = 8 + r() * 22;
        const ix = x + Math.cos(a) * d, iz = z + Math.sin(a) * d, iy = y0 + 20 + r() * 32, rad = 4 + r() * 6;
        const ig = new THREE.Group(); ig.position.set(ix, iy, iz);
        const img = new Merger(), ips = new PointSet();
        img.add('cone6', M(0, 0, 0, rad, rad * 1.7, rad, Math.PI, r(), 0), B.rockC, 0.15, r);
        for (let q = 0; q < 4; q++) img.add('ico', M((r() - 0.5) * rad, -rad * (0.3 + r() * 0.6), (r() - 0.5) * rad, rad * 0.4, rad * 0.5, rad * 0.4, r(), r(), r()), B.rockC.map(v => v * 0.85), 0.2, r);
        img.add('cyl6', M(0, -0.5, 0, rad * 1.04, 0.8, rad * 1.04, 0, r(), 0), B.fieldC.map(v => Math.min(1, v * 1.15)), 0.1, r);
        const tb = BIOMES[B.tree === 'tot' ? 0 : s.biome];
        buildTree(tb, (r() - 0.5) * rad * 0.6, 0.2, (r() - 0.5) * rad * 0.6, r, img, ips);
        for (let q = 0; q < rad * 25; q++) { const qa = r() * 6.283, qd = Math.sqrt(r()) * rad * 0.95; ips.add(Math.cos(qa) * qd, 0.1 + r() * 0.5, Math.sin(qa) * qd, r() < 0.5 ? tb.tipC : tb.stemC, 1); }
        ig.add(new THREE.Mesh(img.build(), MAT.flat));
        ig.add(new THREE.Points(ips.build(), MAT.leaves));
        out.group.add(ig);
        const ph = r() * 6.283;
        // Wasserfall
        let fall = null;
        if (i < 2 || r() < 0.4) {
          const fa = r() * 6.283, fx = Math.cos(fa) * rad * 0.95, fz = Math.sin(fa) * rad * 0.95;
          const gy = groundY(ix + fx, iz + fz);
          const N = 260, fps = new PointSet();
          for (let k = 0; k < N; k++) fps.add(0, 0, 0, [0.75 + r() * 0.2, 0.85 + r() * 0.15, 1], 1);
          const fg = fps.build();
          const fp = new THREE.Points(fg, MAT.fall); fp.frustumCulled = false;
          out.group.add(fp);
          const mist = makeGlow(0xd0e8ff, 9, 0.35); mist.position.set(ix + fx, gy + 1, iz + fz); out.group.add(mist);
          const offs = Array.from({ length: N }, () => [Math.random(), (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9]);
          fall = { fx, fz, gy, fg, offs, mistT: 0 };
        }
        out.updaters.push(dt => {
          const t = U.uTime.value;
          ig.position.y = iy + Math.sin(t * 0.4 + ph) * 0.8;
          ig.rotation.y = Math.sin(t * 0.05 + ph) * 0.2;
          if (fall) {
            const top = ig.position.y - 0.3, H = top - fall.gy, arr = fall.fg.attributes.position.array;
            const c = Math.cos(ig.rotation.y), sn = Math.sin(ig.rotation.y);
            const wx = ix + fall.fx * c + fall.fz * sn, wz = iz - fall.fx * sn + fall.fz * c;
            for (let k = 0; k < fall.offs.length; k++) {
              const o = fall.offs[k];
              const p = (o[0] + t * 0.35) % 1;
              const yy = top - p * p * H;
              const spread = 1 + p * 2.2;
              arr[k * 3] = wx + o[1] * spread; arr[k * 3 + 1] = yy; arr[k * 3 + 2] = wz + o[2] * spread;
            }
            fall.fg.attributes.position.needsUpdate = true;
            fall.mistT -= dt;
            if (fall.mistT <= 0) { fall.mistT = 0.12; burst(wx, fall.gy + 0.4, wz, 2, [0.85, 0.92, 1], 2.5, 0.35, 1, 1, 1.5); }
          }
        });
      }
      break;
    }
    case 'wal': {
      const wg = new THREE.Group(), body = new PointSet();
      const back = [[0.24, 0.3, 0.46], [0.16, 0.2, 0.34], [0.34, 0.42, 0.6]], belly = [[0.74, 0.76, 0.86], [0.6, 0.62, 0.74], [0.86, 0.88, 0.96]];
      const n = 2600;
      for (let i = 0; i < n; i++) {
        let px, py, pz, l;
        do { px = r() * 2 - 1; py = r() * 2 - 1; pz = r() * 2 - 1; l = px * px + py * py + pz * pz; } while (l > 1 || l < 0.05);
        const k = 1 / Math.sqrt(l); px *= k; py *= k; pz *= k;
        const taper = pz < 0 ? 1 + pz * 0.55 : 1 - pz * pz * 0.25;
        const X = px * 6.5 * taper, Y = py * 5.5 * taper, Z = pz * 21;
        const cols = py < -0.25 ? belly : back;
        body.add(X, Y, Z, cols[Math.floor(r() * 3)], 0.9 + r() * 0.2);
        if (py < -0.3 && r() < 0.3) body.add(X * 0.98, Y, Z, [0.4, 0.42, 0.5], 1);
      }
      for (const sx of [-1, 1]) for (let i = 0; i < 160; i++) { const t = r(), u = r(); body.add(sx * (6 + t * 7), -2 - t * 2.5 + u * 0.6, 6 - t * 4 - u * 3, back[1], 1); }
      const tail = new THREE.Group(); tail.position.z = -18;
      const tps = new PointSet();
      for (let i = 0; i < 500; i++) { const t = r(), u = r() * 2 - 1; tps.add(u * (2.5 + t * 9), (r() - 0.5) * 0.8, -t * 9 + Math.abs(u) * 4 * t, back[Math.floor(r() * 3)], 1); }
      tail.add(new THREE.Points(tps.build(), MAT.whale));
      wg.add(new THREE.Points(body.build(), MAT.whale), tail);
      for (let i = 0; i < 26; i++) { const gw = makeGlow(0x9fe0ff, 1.4, 0.8); gw.position.set((r() - 0.5) * 10, 2 + r() * 3, (r() - 0.5) * 30); wg.add(gw); }
      for (const sx of [-1, 1]) { const e = makeGlow(0xe0f0ff, 1.6, 1); e.position.set(sx * 5.2, 0.5, 15); wg.add(e); }
      out.group.add(wg);
      const ph = r() * 6.283, rad = 55 + r() * 30, hh = y0 + 48 + r() * 20, dir = r() < 0.5 ? 1 : -1;
      let trailT = 0;
      out.updaters.push(dt => {
        const t = U.uTime.value, a = ph + t * 0.035 * dir;
        wg.position.set(x + Math.cos(a) * rad, hh + Math.sin(t * 0.25) * 5, z + Math.sin(a) * rad);
        wg.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        wg.rotation.z = Math.sin(t * 0.3) * 0.08 * dir - 0.1 * dir;
        wg.rotation.x = Math.cos(t * 0.25) * 0.08;
        tail.rotation.x = Math.sin(t * 0.9) * 0.28;
        trailT -= dt;
        if (trailT <= 0) {
          trailT = 0.25;
          _v.set(0, 0, -24).applyEuler(wg.rotation).add(wg.position);
          burst(_v.x, _v.y, _v.z, 2, [0.6, 0.9, 1], 0.6, 0.6, 4, 0.4, 2);
        }
      });
      s.whale = wg;
      break;
    }
    case 'kristalle': {
      const palette = [[0.5, 0.9, 1], [0.78, 0.6, 1], [1, 0.62, 0.86], [0.6, 1, 0.86]];
      const main = pick(r, palette);
      const n = 14 + Math.floor(r() * 12);
      const cmg = new Merger();
      const glows = [];
      for (let i = 0; i < n; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * 17;
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = groundY(px, pz);
        const h = 2.5 + r() * r() * 14 * (1 - d / 22), rad = 0.4 + h * 0.09;
        const tx = (r() - 0.5) * 0.7, tz = (r() - 0.5) * 0.7, ry = r() * 3;
        const col = r() < 0.7 ? main : pick(r, palette);
        cmg.add('cyl6', M(px, py - 0.6, pz, rad, h, rad, tx, ry, tz), col, 0.15, r);
        _e.set(tx, ry, tz, 'YXZ'); _v.set(0, h - 0.6, 0).applyEuler(_e);
        cmg.add('cone6', M(px + _v.x, py + _v.y, pz + _v.z, rad, rad * 2, rad, tx, ry, tz), col.map(v => Math.min(1, v * 1.15)), 0.1, r);
        if (h > 6) circCollider(out, px, pz, rad + 0.4);
        if (r() < 0.5) { const gw = makeGlow(new THREE.Color(col[0], col[1], col[2]), 2 + h * 0.5, 0.35); gw.position.set(px + _v.x * 0.5, py + _v.y * 0.5, pz + _v.z * 0.5); out.group.add(gw); glows.push([gw, r() * 6]); }
      }
      out.group.add(new THREE.Mesh(cmg.build(), MAT.crystal));
      risingMotes(out, 110, x, y0, z, 18, 14, [main, [1, 1, 1]], 0.5, 0.3);
      out.updaters.push(() => { const t = U.uTime.value; for (const [gw, p] of glows) gw.material.opacity = 0.25 + Math.sin(t * 1.3 + p) * 0.15; });
      break;
    }
    case 'saeule': {
      const st2 = pick(r, STONES);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 6.283, px = x + Math.cos(a) * 10, pz = z + Math.sin(a) * 10;
        const h = r() < 0.3 ? 2 + r() * 3 : 7 + r() * 3;
        mg.add('box', M(px, y0 + h / 2 - 1, pz, 1.2, h + 2, 1.2, 0, -a, 0), st2, 0.12, r);
        if (h > 6) mg.add('box', M(px, y0 + h + 0.3, pz, 1.7, 0.6, 1.7, 0, -a, 0), st2.map(v => v * 1.08));
        circCollider(out, px, pz, 1);
      }
      mg.add('cyl', M(x, y0 - 1, z, 4.6, 1.5, 4.6), st2.map(v => v * 0.9), 0.08, r);
      mg.add('cyl', M(x, y0 - 1, z, 3.2, 1.8, 3.2), st2.map(v => v * 1.1), 0.08, r);
      const beamMat = new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color(pick(r, [0xc8e0ff, 0xffd8f0, 0xe0d0ff, 0xd0fff0])) } },
        vertexShader: 'varying float vY; void main(){ vY = position.y + 300.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uTime; uniform vec3 uCol; varying float vY; void main(){ float a = (1.0 - smoothstep(0.0, 600.0, vY)) * (0.55 + 0.25 * sin(vY * 0.06 - uTime * 2.5)); gl_FragColor = vec4(uCol * a, 1.0); }',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 600, 12, 1, true), beamMat);
      beam.position.set(x, y0 + 300, z);
      beam.frustumCulled = false;
      out.group.add(beam);
      const base = makeGlow(beamMat.uniforms.uCol.value, 12, 0.6); base.position.set(x, y0 + 1.5, z); out.group.add(base);
      risingMotes(out, 120, x, y0 + 0.5, z, 3, 40, [1, 1, 1], 3, 0.3);
      circCollider(out, x, z, 4.8);
      break;
    }
    case 'steinkreis': {
      const rock = B.rockC.map(v => v * 1.05);
      const n = 9 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283, px = x + Math.cos(a) * 11, pz = z + Math.sin(a) * 11;
        const h = 3.5 + r() * 3;
        mg.add('box', M(px, y0 + h / 2 - 1, pz, 1.5 + r() * 0.6, h + 2, 0.9, (r() - 0.5) * 0.12, -a + Math.PI / 2, (r() - 0.5) * 0.12), rock, 0.15, r);
        blob(ps, px, y0 + h + 0.7, pz, 0.9, 0.25, 0.6, B.canopyC, r, 10, 0.2);
        const gw = makeGlow(0x80ffe0, 1.1, 0.7); gw.position.set(px - Math.cos(a) * 0.5, y0 + h * 0.55, pz - Math.sin(a) * 0.5); out.group.add(gw);
        circCollider(out, px, pz, 1.1);
      }
      mg.add('box', M(x, y0 + 0.4, z, 3.6, 0.8, 2.2, 0, r() * 3, 0), rock.map(v => v * 0.9), 0.1, r);
      const rune = new PointSet();
      for (let i = 0; i < 90; i++) { const a = i / 90 * 6.283; rune.add(x + Math.cos(a) * 3.4, y0 + 0.1, z + Math.sin(a) * 3.4, [0.5, 1, 0.9]); }
      const runePts = new THREE.Points(rune.build(), pointsMat(0.35, { emit: 1, additive: true, sway: 0 }));
      out.group.add(runePts);
      out.interact.push({ kind: 'rest', x, z, r: 4.5, heal: true, label: 'Im Steinkreis rasten' });
      break;
    }
    case 'riese': {
      const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = r() * 6.283;
      const lm = new Merger(), lps = new PointSet();
      const c = pick(r, STONES).map(v => v * 0.95), c2 = c.map(v => v * 0.82);
      lm.add('box', M(-1.6, 0.6, -1.8, 1.8, 1.5, 5), c2, 0.1, r);
      lm.add('box', M(-1.6, 3.0, 0.6, 1.9, 4.5, 2.0, -0.25, 0, 0), c, 0.1, r);
      lm.add('box', M(1.7, 2.4, 3.6, 1.8, 5.2, 1.8), c2, 0.1, r);
      lm.add('box', M(1.7, 5.0, 1.8, 2.0, 2.0, 4.2), c, 0.1, r);
      lm.add('box', M(0, 6.1, 0, 4.8, 2.2, 2.8), c2, 0.1, r);
      lm.add('box', M(0, 9.6, 0.4, 5.2, 6, 3.2, 0.15, 0, 0), c, 0.1, r);
      for (const sx of [-1, 1]) {
        lm.add('ico', M(sx * 3.2, 12.2, 0.6, 1.7, 1.4, 1.7), c, 0.1, r);
        lm.add('box', M(sx * 2.4, 10.4, 2.6, 1.3, 4.8, 1.3, -0.95, 0, sx * 0.35), c2, 0.1, r);
      }
      lm.add('box', M(0, 14.0, 1.0, 2.1, 2.5, 2.3), c, 0.1, r);
      lm.add('box', M(0, 14.0, 2.18, 1.6, 0.2, 0.1), DARK);
      lm.add('cone4', M(0, 15.2, 1.0, 0.5, 2.2, 1.4, 0, 0, 0), ROOFS[1]);
      lm.add('box', M(0, 2.5, 5.4, 0.9, 13, 0.26), [0.7, 0.72, 0.78], 0.05, r);
      lm.add('box', M(0, 9.1, 5.4, 4.2, 0.6, 0.8), [0.6, 0.5, 0.3]);
      lm.add('cyl6', M(0, 9.4, 5.4, 0.3, 2.2, 0.3), [0.35, 0.25, 0.2]);
      lm.add('ico', M(0, 11.8, 5.4, 0.5, 0.5, 0.5), [0.6, 0.5, 0.3]);
      for (const [px, py, pz, rx, rz] of [[-3.2, 13.4, 0.6, 1.6, 1.6], [3.2, 13.4, 0.6, 1.6, 1.6], [0, 15.4, 1, 1.2, 1.2], [1.7, 6.1, 1.8, 1.2, 2], [-1.6, 1.4, -1.8, 1, 2.4]]) blob(lps, px, py, pz, rx, 0.35, rz, B.canopyC, r, 14, 0.2);
      for (let i = 0; i < 300; i++) lps.add((r() - 0.5) * 5, 7 + r() * 5.5, 2.05 + r() * 0.1, B.canopyC[i % 3], 0.8);
      g.add(new THREE.Mesh(lm.build(), MAT.flat), new THREE.Points(lps.build(), MAT.leaves));
      for (const sx of [-1, 1]) { const e = makeGlow(0x90e0ff, 0.9, 0.9); e.position.set(sx * 0.45, 14.05, 2.25); g.add(e); }
      out.group.add(g);
      const ry = g.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
      for (const [lx, lz, rr] of [[-1.6, -1.8, 2.4], [-1.6, 0.6, 1.6], [1.7, 3.6, 1.4], [1.7, 1.8, 1.4], [0, 0, 2.8], [0, 5.4, 1.0]]) circCollider(out, x + lx * cs + lz * sn, z - lx * sn + lz * cs, rr);
      break;
    }
    case 'mondtor': {
      const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = r() * 6.283;
      const c = pick(r, STONES);
      const lm = new Merger();
      lm.add('torus', M(0, 11, 0, 10, 10, 12), c, 0.1, r);
      for (const sx of [-1, 1]) lm.add('box', M(sx * 9.2, 1.6, 0, 2.4, 6, 3.2), c.map(v => v * 0.9), 0.1, r);
      lm.add('box', M(0, 0.2, 0, 6, 1.2, 3.6), c.map(v => v * 0.85), 0.1, r);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; lm.add('oct', M(Math.cos(a) * 10, 11 + Math.sin(a) * 10, 0, 0.6, 0.6, 1.8), [0.85, 0.85, 1]); }
      g.add(new THREE.Mesh(lm.build(), MAT.flat));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(9.4, 40), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 9.4; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uTime; varying vec2 vP;
          void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
            float sw = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 1.3);
            vec3 c = mix(vec3(0.25, 0.3, 0.75), vec3(0.85, 0.7, 1.0), sw) * (0.35 + 0.35 * sw) * smoothstep(1.0, 0.6, r);
            c += vec3(0.9, 0.95, 1.0) * smoothstep(0.25, 0.0, r) * 0.5;
            gl_FragColor = vec4(c, 1.0); }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      disc.position.y = 11;
      g.add(disc);
      const sp = new PointSet();
      for (let i = 0; i < 200; i++) { const a = r() * 6.283, d = 9 + r() * 3; sp.add(Math.cos(a) * d, 11 + Math.sin(a) * d, (r() - 0.5) * 3, [0.85, 0.85, 1]); }
      const spP = new THREE.Points(sp.build(), pointsMat(0.3, { emit: 1, additive: true, sway: 0 }));
      g.add(spP);
      out.group.add(g);
      const ry = g.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
      for (const sx of [-1, 1]) circCollider(out, x + sx * 9.2 * cs, z - sx * 9.2 * sn, 1.9);
      out.gate = { x, z, y0, nx: sn, nz: cs, tx: cs, tz: -sn, prev: null };
      out.updaters.push(() => { spP.rotation.z = U.uTime.value * 0.05; });
      break;
    }
    case 'laternen': {
      // Steg
      const pa = r() * 6.283;
      for (let k = 0; k < 9; k++) {
        const d = 34 - k * 1.5, px = x + Math.cos(pa) * d, pz = z + Math.sin(pa) * d;
        mg.add('box', M(px, WATER + 0.35, pz, 1.4, 0.15, 2.6, 0, -pa + Math.PI / 2, 0), WOOD, 0.15, r);
        if (k % 3 === 0) for (const sx of [-1, 1]) mg.add('cyl6', M(px + Math.sin(pa) * 1.2 * sx, WATER - 2, pz - Math.cos(pa) * 1.2 * sx, 0.12, 3, 0.12), WOOD.map(v => v * 0.8));
      }
      const endX = x + Math.cos(pa) * 22, endZ = z + Math.sin(pa) * 22;
      mg.add('cyl6', M(endX, WATER, endZ, 0.08, 2.2, 0.08), WOOD);
      addFire(out, endX, WATER + 2.1, endZ, 0xffb060, 0.5);
      // Seerosen
      for (let k = 0; k < 40; k++) {
        const a = r() * 6.283, d = 6 + r() * 20, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        mg.add('cyl', M(px, WATER + 0.02, pz, 0.6 + r() * 0.5, 0.04, 0.6 + r() * 0.5), [0.2, 0.45, 0.35], 0.2, r);
        if (r() < 0.4) ps.add(px, WATER + 0.25, pz, [1, 0.75, 0.88]);
      }
      // Laternen
      const N = 46, lan = [];
      const lps = new PointSet();
      for (let i = 0; i < N; i++) lps.add(0, 0, 0, pick(r, [[1, 0.7, 0.4], [1, 0.82, 0.5], [1, 0.6, 0.45]]));
      const lg = lps.build();
      const lpts = new THREE.Points(lg, pointsMat(0.55, { emit: 1, sway: 0 }));
      lpts.frustumCulled = false;
      out.group.add(lpts);
      const glows = [];
      for (let i = 0; i < N; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * 22;
        lan.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y: r() * 90, sp: 0.6 + r() * 0.9, ph: r() * 6 });
        if (i < 16) { const gw = makeGlow(0xffa050, 3.5, 0.55); out.group.add(gw); glows.push(gw); }
      }
      out.addLantern = () => {
        const gw = makeGlow(0xffa050, 3.5, 0.75); out.group.add(gw);
        lan.push({ x: endX, z: endZ, y: 1.5, sp: 1.2, ph: Math.random() * 6, glow: gw });
      };
      out.updaters.push(dt => {
        const t = U.uTime.value, arr = lg.attributes.position.array;
        for (let i = 0; i < lan.length; i++) {
          const L = lan[i];
          L.y += L.sp * dt;
          if (L.y > 95) { if (i >= N) { if (L.glow.parent) L.glow.parent.remove(L.glow); lan.splice(i, 1); i--; continue; } L.y = 0; const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 22; L.x = x + Math.cos(a) * d; L.z = z + Math.sin(a) * d; }
          const px = L.x + Math.sin(t * 0.3 + L.ph) * (L.y * 0.05), pz = L.z + Math.cos(t * 0.25 + L.ph) * (L.y * 0.05), py = WATER + 0.4 + L.y;
          if (i < N) { arr[i * 3] = px; arr[i * 3 + 1] = py; arr[i * 3 + 2] = pz; }
          if (i < glows.length) glows[i].position.set(px, py, pz);
          else if (L.glow) L.glow.position.set(px, py, pz);
        }
        lg.attributes.position.needsUpdate = true;
      });
      out.interact.push({ kind: 'lantern', x: endX, z: endZ, r: 4, label: 'Eine Laterne steigen lassen' });
      break;
    }
    case 'bogen': {
      const ang = r() * 6.283, L = 34 + r() * 22, H = 20 + r() * 12;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const fA = heightAt(x - ca * L / 2, z - sa * L / 2), fB = heightAt(x + ca * L / 2, z + sa * L / 2);
      const rock = B.rockC.map(v => v * 1.08);
      for (let i = 0; i <= 28; i++) {
        const t = i / 28, px = x + ca * (t - 0.5) * L, pz = z + sa * (t - 0.5) * L;
        const base = lerp(fA, fB, t) - 1.5;
        const py = base + 4 * (H + 1.5) * t * (1 - t);
        const th = 3.2 + (1 - 4 * t * (1 - t)) * 2.4;
        mg.add('ico', M(px, py, pz, th * (0.9 + r() * 0.3), th * 0.8, th * (0.9 + r() * 0.3), r(), r() * 6, r()), rock, 0.15, r);
        if (t > 0.1 && t < 0.9) {
          blob(ps, px, py + th * 0.75, pz, th * 0.8, 0.3, th * 0.7, B.canopyC, r, 8, 0.2);
          if (r() < 0.6) { const vl = 2 + r() * 6; for (let k = 0; k < 10; k++) ps.add(px + (r() - 0.5) * th, py - th * 0.6 - k / 10 * vl, pz + (r() - 0.5) * th, B.canopyC[k % 3]); }
        }
        if (t < 0.12 || t > 0.88) circCollider(out, px, pz, th * 1.1);
      }
      break;
    }
    case 'drache': {
      // Ein Drachenskelett liegt eingerollt im Gras
      const bone = [0.82, 0.78, 0.68], bd = [0.62, 0.58, 0.5];
      const a0 = r() * 6.283, N = 44, spine = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = a0 + t * 2.6, rr = 20 - t * 9;
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        const py = y0 + 1.2 + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 7 * (1 - t * 0.6);
        spine.push([px, py, pz]);
      }
      for (let i = 0; i < N; i++) {
        const [ax, ay, az] = spine[i], [bx, by, bz] = spine[i + 1], t = i / N, th = 1.1 * (1 - t * 0.75) + 0.2;
        boneSeg(mg, ax, ay, az, bx, by, bz, th * 0.55, bd, r);
        mg.add('ico', M(ax, ay, az, th, th * 0.85, th, r(), r(), r()), bone, 0.1, r);
        mg.add('cone4', M(ax, ay + th * 0.5, az, th * 0.35, th * 2.2 * (1 - t * 0.5), th * 0.35, (r() - 0.5) * 0.3, 0, 0), bone, 0.1, r);
        // Rippen
        if (t > 0.12 && t < 0.55 && i % 2 === 0) {
          const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
          for (const sd of [-1, 1]) {
            let px = ax, py = ay, pz = az;
            const span = 6.5 * Math.sin((t - 0.12) / 0.43 * Math.PI) + 2.5;
            for (let k = 1; k <= 6; k++) {
              const u = k / 6, qx = ax + nx * sd * Math.sin(u * Math.PI * 0.62) * span, qz = az + nz * sd * Math.sin(u * Math.PI * 0.62) * span;
              const qy = ay + Math.sin(u * Math.PI * 0.4) * 2.5 - u * u * (ay - y0 + 2.2);
              boneSeg(mg, px, py, pz, qx, qy, qz, 0.28 * (1 - u * 0.4), bone, r);
              px = qx; py = qy; pz = qz;
            }
            circCollider(out, px, pz, 0.6);
          }
        }
      }
      // Schädel mit Hörnern
      const [hx, hy, hz] = spine[0], ha = a0 - Math.PI / 2;
      const fx = Math.cos(ha), fz = Math.sin(ha);
      mg.add('ico', M(hx + fx * 2.5, hy + 0.5, hz + fz * 2.5, 3.2, 2.4, 2.8, 0, -ha, 0), bone, 0.1, r);
      mg.add('box', M(hx + fx * 6, hy - 0.4, hz + fz * 6, 2, 1.2, 6.5, 0, -ha + Math.PI / 2, 0), bone, 0.1, r);
      mg.add('box', M(hx + fx * 5.5, hy - 2, hz + fz * 5.5, 1.6, 0.8, 5.5, 0.25, -ha + Math.PI / 2, 0), bd, 0.1, r);
      for (const sd of [-1, 1]) {
        const ox = -fz * sd, oz = fx * sd;
        boneSeg(mg, hx + ox * 1.6, hy + 2, hz + oz * 1.6, hx + ox * 4 - fx * 3, hy + 6, hz + oz * 4 - fz * 3, 0.55, bd, r);
        boneSeg(mg, hx + ox * 4 - fx * 3, hy + 6, hz + oz * 4 - fz * 3, hx + ox * 4.5 - fx * 7, hy + 7, hz + oz * 4.5 - fz * 7, 0.3, bd, r);
        mg.add('box', M(hx + fx * 4.2 + ox * 1.4, hy + 1.2, hz + fz * 4.2 + oz * 1.4, 0.9, 0.7, 0.9), [0.03, 0.03, 0.04]);
      }
      addFire(out, hx + fx * 3, hy + 0.2, hz + fz * 3, 0x60a0ff, 0.9);
      circCollider(out, hx + fx * 3, hz + fz * 3, 3.6);
      // Flügelknochen ragen in den Himmel
      const [wx, wy, wz] = spine[Math.round(N * 0.22)];
      for (const sd of [-1, 1]) {
        const [qx, qy, qz] = spine[Math.round(N * 0.22) + 1], dx = qx - wx, dz = qz - wz, l = Math.hypot(dx, dz), nx = -dz / l * sd, nz = dx / l * sd;
        const ex = wx + nx * 9, ey = wy + 13 + r() * 4, ez = wz + nz * 9;
        boneSeg(mg, wx, wy, wz, ex, ey, ez, 0.6, bone, r);
        for (let f = 0; f < 4; f++) {
          const fa = (f - 1.5) * 0.45, tx = ex + nx * Math.cos(fa) * 13 + dx / l * Math.sin(fa) * 13, tz = ez + nz * Math.cos(fa) * 13 + dz / l * Math.sin(fa) * 13, ty = ey - 6 - f * 2.5;
          boneSeg(mg, ex, ey, ez, tx, ty, tz, 0.3, bone, r);
          // zerrissene Flughaut
          for (let q = 0; q < 70; q++) { const u = r(), v = r() * 0.8; ps.add(lerp(ex, tx, u) * (1 - v * 0.3) + wx * v * 0.3, lerp(ey, ty, u) - v * 4, lerp(ez, tz, u) * (1 - v * 0.3) + wz * v * 0.3, pick(r, [[0.32, 0.16, 0.18], [0.22, 0.12, 0.14], [0.4, 0.22, 0.2]]), 0.8); }
        }
      }
      const ck = s.key + ':c0';
      makeChest(out, ck, hx + fx * 9, hz + fz * 9, -ha, r() < 0.5, st.opened(ck));
      break;
    }
    case 'ruinen': {
      // Säulen, Bögen und eine kopflose Statue einer vergessenen Stadt
      const stone = [0.62, 0.6, 0.56], st2 = [0.5, 0.48, 0.46], ivy = B.canopyC.map(c => c.map(v => v * 0.85));
      const ga = r() * 6.283, gc = Math.cos(ga), gs = Math.sin(ga);
      const P = (u, v) => [x + u * gc - v * gs, z + u * gs + v * gc];
      // Bodenplatten
      for (let q = 0; q < 70; q++) { const u = (r() - 0.5) * 50, v = (r() - 0.5) * 50; const [px, pz] = P(u, v); mg.add('box', M(px, groundY(px, pz) + 0.05, pz, 2.6, 0.25, 2.6, (r() - 0.5) * 0.12, ga, (r() - 0.5) * 0.12), r() < 0.5 ? stone : st2, 0.12, r); }
      // Säulengang
      for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) {
        const [px, pz] = P(k * 5.5, sd * 7), h = r() < 0.35 ? 2 + r() * 4 : 9 + r() * 2;
        const py = groundY(px, pz);
        mg.add('cyl', M(px, py - 0.5, pz, 0.85, h + 0.5, 0.85), stone, 0.08, r);
        mg.add('box', M(px, py + 0.2, pz, 2.1, 0.5, 2.1, 0, ga, 0), st2, 0.08, r);
        if (h > 8) mg.add('box', M(px, py + h + 0.25, pz, 2.1, 0.5, 2.1, 0, ga, 0), st2, 0.08, r);
        else { const fa = r() * 6.283; for (let q = 0; q < 3; q++) mg.add('cyl', M(px + Math.cos(fa) * (2 + q * 2.3), py + 0.4, pz + Math.sin(fa) * (2 + q * 2.3), 0.8, 2.1, 0.8, 0, -fa, Math.PI / 2 + (r() - 0.5) * 0.2), stone, 0.08, r); }
        for (let q = 0; q < 30; q++) ps.add(px + (r() - 0.5) * 2, py + r() * h, pz + (r() - 0.5) * 2, ivy[q % 3]);
        circCollider(out, px, pz, 1.1);
      }
      // Gebälk auf intakten Abschnitten
      for (const sd of [-1, 1]) for (let k = -4; k < 4; k += 2) { if (r() < 0.45) continue; const [px, pz] = P(k * 5.5 + 2.75, sd * 7); mg.add('box', M(px, groundY(px, pz) + 10.4, pz, 12, 1.2, 2.2, 0, -ga, 0), st2, 0.08, r); }
      // grosser Bogen am Ende
      const [ax, az] = P(27, 0), ay = groundY(ax, az);
      for (const sd of [-1, 1]) { const [px, pz] = P(27, sd * 6); mg.add('box', M(px, groundY(px, pz) + 8, pz, 3, 18, 3, 0, ga, 0), stone, 0.08, r); circCollider(out, px, pz, 2); }
      mg.add('box', M(ax, ay + 18, az, 3.4, 3, 15, 0, ga, 0), stone, 0.08, r);
      // kopflose Statue mit erhobenem Arm
      const [sx, sz] = P(-14, 0), sy = groundY(sx, sz);
      mg.add('box', M(sx, sy + 1.5, sz, 4, 3, 4, 0, ga, 0), st2, 0.08, r);
      mg.add('taper', M(sx, sy + 3, sz, 1.4, 6, 1.4), stone, 0.08, r);
      mg.add('box', M(sx, sy + 9.5, sz, 2.6, 3, 1.6, 0, ga, 0), stone, 0.08, r);
      mg.add('cyl', M(sx + 1.4, sy + 10.5, sz, 0.45, 4.5, 0.45, 0, 0, -0.5), stone, 0.08, r);
      circCollider(out, sx, sz, 2.6);
      // gestürzter Kopf
      const [hx, hz] = P(-10, 5); mg.add('ico1', M(hx, groundY(hx, hz) + 1, hz, 1.8, 1.9, 1.8, 0.4, r(), 0.9), stone, 0.08, r);
      const ck = s.key + ':c0', [cx2, cz2] = P(0, 0);
      makeChest(out, ck, cx2, cz2, ga, false, st.opened(ck));
      break;
    }
  }
  if (!mg.empty) out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!ps.empty) out.group.add(new THREE.Points(ps.build(), psMat));
  out.updaters.push(dt => { updateFires(out, dt); updateChests(out, dt); });
  return out;
}
// Knochen oder Stab zwischen zwei Punkten
const _up = new THREE.Vector3(0, 1, 0), _bdir = new THREE.Vector3(), _bq = new THREE.Quaternion(), _be = new THREE.Euler();
function boneSeg(mg, ax, ay, az, bx, by, bz, rad, col, r) {
  _bdir.set(bx - ax, by - ay, bz - az);
  const len = _bdir.length();
  if (len < 0.01) return;
  _bdir.multiplyScalar(1 / len);
  _bq.setFromUnitVectors(_up, _bdir);
  _be.setFromQuaternion(_bq, 'YXZ');
  mg.add('cyl6', M(ax, ay, az, rad, len, rad, _be.x, _be.y, _be.z), col, 0.1, r);
}

// ---------- Lager ----------
function buildCamp(s, st) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = s.baseH;
  const mg = new Merger(), ps = new PointSet();
  const a0 = r() * 6.283;
  // Feuerstelle
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; mg.add('ico', M(x + Math.cos(a) * 1.0, y0 + 0.1, z + Math.sin(a) * 1.0, 0.3, 0.22, 0.3, r(), r(), r()), [0.45, 0.43, 0.48], 0.2, r); }
  for (let i = 0; i < 3; i++) mg.add('box', M(x, y0 + 0.2, z, 1.4, 0.18, 0.18, 0, i * 1.05, 0.15), [0.32, 0.2, 0.14]);
  addFire(out, x, y0 + 0.1, z, 0xff9050, 1);
  out.fireLight = [x, y0 + 1.2, z];
  // Zelt
  const tx = x + Math.cos(a0) * 5.5, tz = z + Math.sin(a0) * 5.5;
  const canvas = pick(r, [[0.85, 0.75, 0.6], [0.7, 0.45, 0.42], [0.45, 0.55, 0.62], [0.62, 0.5, 0.72]]);
  mg.add('cone4', M(tx, y0 - 0.1, tz, 2.6, 3.2, 2.6, 0, -a0 + Math.PI / 4, 0), canvas, 0.08, r);
  mg.add('box', M(tx - Math.cos(a0) * 1.5, y0 + 0.8, tz - Math.sin(a0) * 1.5, 1.1, 1.6, 0.1, 0, -a0 + Math.PI / 2, 0), DARK);
  mg.add('cyl6', M(tx, y0 + 3, tz, 0.05, 0.8, 0.05), WOOD);
  circCollider(out, tx, tz, 2.2);
  // Wagen
  const ca = a0 + 2.1, wx = x + Math.cos(ca) * 6, wz = z + Math.sin(ca) * 6, wr = -ca + Math.PI / 2;
  mg.add('box', M(wx, y0 + 1.2, wz, 2.2, 0.9, 3.4, 0, wr, 0), WOOD, 0.1, r);
  for (const [ox, oz] of [[-1.15, 1], [1.15, 1], [-1.15, -1], [1.15, -1]]) {
    const c = Math.cos(wr), sn = Math.sin(wr);
    mg.add('cyl', M(wx + ox * c + oz * sn, y0 + 0.55, wz - ox * sn + oz * c, 0.55, 0.15, 0.55, 0, wr, Math.PI / 2), [0.3, 0.2, 0.15]);
  }
  for (let i = 0; i < 4; i++) mg.add('box', M(wx + (r() - 0.5) * 1.2, y0 + 1.9 + r() * 0.3, wz + (r() - 0.5) * 2, 0.6, 0.5, 0.6, 0, r() * 3, 0), pick(r, [[0.6, 0.4, 0.3], [0.5, 0.5, 0.6], [0.7, 0.6, 0.3]]), 0.1, r);
  circCollider(out, wx, wz, 2);
  // Bänke
  for (const a of [a0 + 1, a0 - 1.1, a0 + 3.4]) mg.add('cyl', M(x + Math.cos(a) * 2.6, y0 + 0.3, z + Math.sin(a) * 2.6, 0.35, 1.9, 0.35, 0, -a, Math.PI / 2), [0.38, 0.26, 0.18]);
  // Laternenpfahl
  const la = a0 - 2.2, lx = x + Math.cos(la) * 4.5, lz = z + Math.sin(la) * 4.5;
  mg.add('cyl6', M(lx, y0 - 0.2, lz, 0.08, 2.8, 0.08), WOOD);
  mg.add('box', M(lx, y0 + 2.5, lz, 0.25, 0.3, 0.25), [1, 0.85, 0.55]);
  const lg = makeGlow(0xffb060, 2.5, 0.8); lg.position.set(lx, y0 + 2.5, lz); out.group.add(lg);
  // Blumen
  for (let i = 0; i < 70; i++) { const a = r() * 6.283, d = 3 + r() * 6; ps.add(x + Math.cos(a) * d, groundY(x + Math.cos(a) * d, z + Math.sin(a) * d) + 0.2, z + Math.sin(a) * d, pick(r, [[1, 0.8, 0.9], [1, 0.95, 0.6], [0.8, 0.8, 1]])); }
  // Händler
  const ma = a0 + 1, mx = x + Math.cos(ma) * 3.2, mz = z + Math.sin(ma) * 3.2;
  const npc = makePerson({ seed: s.seed, wideHat: true, pack: true, lantern: true });
  npc.position.set(mx, y0, mz);
  npc.rotation.y = Math.atan2(x - mx, z - mz);
  out.group.add(npc);
  out.npc = npc;
  out.interact.push({ kind: 'shop', x: mx, z: mz, r: 2.8, name: s.merchant });
  out.interact.push({ kind: 'fire', x, z, r: 2.6 });
  circCollider(out, x, z, 1.1);
  circCollider(out, mx, mz, 0.5);
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  out.group.add(new THREE.Points(ps.build(), MAT.leaves));
  out.updaters.push(dt => {
    updateFires(out, dt);
    const t = U.uTime.value;
    npc.children[0].scale.y = 1 + Math.sin(t * 1.8) * 0.015;
  });
  return out;
}

// ---------- Aussichtspunkt ----------
function buildView(s) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = groundY(x, z);
  const mg = new Merger(), ps = new PointSet();
  // Blick in Richtung der tiefsten Stelle
  let best = 0, low = 1e9;
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, h = heightAt(x + Math.cos(a) * 70, z + Math.sin(a) * 70); if (h < low) { low = h; best = a; } }
  s.viewYaw = best;
  const fx = Math.cos(best), fz = Math.sin(best), ry = -best + Math.PI / 2;
  mg.add('box', M(x, y0 + 0.5, z, 2.2, 0.15, 0.6, 0, ry, 0), WOOD, 0.1, r);
  mg.add('box', M(x - fx * 0.3, y0 + 0.95, z - fz * 0.3, 2.2, 0.6, 0.1, 0, ry, 0), WOOD, 0.1, r);
  for (const sx of [-0.9, 0.9]) mg.add('box', M(x + Math.sin(best) * sx * -1, y0 + 0.2, z + Math.cos(best) * sx, 0.12, 0.6, 0.5, 0, ry, 0), WOOD.map(v => v * 0.8));
  // Steinmann
  const kx = x - fz * 2.5, kz = z + fx * 2.5;
  let ky = groundY(kx, kz);
  for (let i = 0; i < 5; i++) { const sz = 0.55 - i * 0.08; mg.add('ico', M(kx, ky + sz * 0.6, kz, sz, sz * 0.6, sz, r(), r(), r()), [0.6, 0.6, 0.65], 0.2, r); ky += sz * 1.0; }
  // Fahne
  const px = x + fz * 2.4, pz = z - fx * 2.4, py = groundY(px, pz);
  mg.add('cyl6', M(px, py - 0.2, pz, 0.05, 3.4, 0.05), WOOD);
  const flag = new THREE.Group(); flag.position.set(px, py + 3, pz);
  const fm = new Merger(); fm.add('box', M(0.6, 0, 0, 1.2, 0.6, 0.04), pick(r, ROOFS).map(v => Math.min(1, v * 1.5)));
  flag.add(new THREE.Mesh(fm.build(), MAT.flat));
  out.group.add(flag);
  for (let i = 0; i < 50; i++) { const a = r() * 6.283, d = 1.5 + r() * 4; ps.add(x + Math.cos(a) * d, groundY(x + Math.cos(a) * d, z + Math.sin(a) * d) + 0.18, z + Math.sin(a) * d, pick(r, [[1, 0.85, 0.95], [0.95, 0.95, 1], [1, 0.9, 0.6]])); }
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat), new THREE.Points(ps.build(), MAT.leaves));
  out.interact.push({ kind: 'view', x, z, r: 2.8, yaw: best });
  out.updaters.push(() => { const t = U.uTime.value, w = U.uWindDir.value; flag.rotation.y = Math.atan2(-w.y, w.x) + Math.sin(t * 3) * 0.25; flag.rotation.z = Math.sin(t * 5) * 0.05; });
  return out;
}

// ---------- Wanderer ----------
function buildWanderer(s) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = groundY(x, z);
  const npc = makePerson({ seed: s.seed, staff: true, beard: r() < 0.4, wideHat: r() < 0.4, lantern: r() < 0.5 });
  npc.position.set(x, y0, z);
  npc.rotation.y = r() * 6.283;
  out.group.add(npc);
  out.npc = npc;
  const mg = new Merger(), ps = new PointSet();
  const w = weightsAt(x, z, new Float32Array(NB));
  const B = BIOMES[dominantBiome(w)];
  const tx = x + 2.5, tz = z + 1.5;
  buildTree(B, tx, groundY(tx, tz), tz, r, mg, ps);
  mg.add('box', M(x - 1, y0 + 0.25, z + 0.6, 0.6, 0.5, 0.4, 0, r(), 0), [0.5, 0.36, 0.24]);
  if (!mg.empty) out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!ps.empty) out.group.add(new THREE.Points(ps.build(), MAT.leaves));
  out.interact.push({ kind: 'npc', x, z, r: 2.8 });
  circCollider(out, x, z, 0.5);
  out.updaters.push(() => { npc.children[0].scale.y = 1 + Math.sin(U.uTime.value * 1.6 + 1) * 0.015; });
  return out;
}

function buildSite(s, st) {
  let out;
  if (s.type === 'burg') out = buildCastle(s, st);
  else if (s.type === 'wunder') out = buildWonder(s, st);
  else if (s.type === 'lager') out = buildCamp(s, st);
  else if (s.type === 'aussicht') out = buildView(s);
  else if (s.type === 'wahrzeichen') out = buildLandmark(s, st);
  else if (s.type === 'hoehle') out = buildCave(s, st);
  else if (s.type === 'lichtung') out = buildClearing(s, st);
  else if (s.type === 'ritter') out = buildKnights(s, st);
  else out = buildWanderer(s);
  G.scene.add(out.group);
  return out;
}
