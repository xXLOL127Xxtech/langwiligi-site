'use strict';
// Wanderlicht – besondere Orte: grosse Wahrzeichen-Schlösser, Höhlen, Feenlichtung, Ritterlager

// ---------- Hilfen für gotische Türme ----------
function gothicTower(mg, gps, x, y, z, rad, h, st, r, winCol, lit) {
  mg.add('cyl', M(x, y - 2, z, rad, h + 2, rad, 0, r() * 3, 0), st.stone, 0.1, r);
  mg.add('cyl', M(x, y + h - 1.2, z, rad * 1.16, 1.4, rad * 1.16), st.stone2, 0.08, r);
  for (let q = 0; q < 3; q++) mg.add('cyl', M(x, y + h * (0.25 + q * 0.22), z, rad * 1.04, 0.5, rad * 1.04), st.stone2, 0.06, r);
  const sp = rad * (4.2 + r() * 2.5);
  mg.add('cone', M(x, y + h, z, rad * 1.05, sp, rad * 1.05), st.roof, 0.06, r);
  mg.add('cyl6', M(x, y + h + sp - 0.3, z, 0.08, 3.5, 0.08), [0.5, 0.5, 0.55]);
  for (let q = 0; q < 4; q++) {
    const a = q / 4 * Math.PI * 2 + 0.4;
    mg.add('cone4', M(x + Math.cos(a) * rad * 1.12, y + h - 0.4, z + Math.sin(a) * rad * 1.12, 0.42, 3 + r() * 2, 0.42), st.roof, 0.06, r);
  }
  // Fensterreihen
  for (let wy = y + 5; wy < y + h - 2; wy += 4.2) {
    const n = 5;
    for (let q = 0; q < n; q++) {
      const a = q / n * Math.PI * 2 + wy * 0.3;
      const wx = x + Math.cos(a) * (rad + 0.05), wz = z + Math.sin(a) * (rad + 0.05);
      if (r() < lit) gps.add(wx, wy, wz, winCol, 0.7 + r() * 0.4);
      else mg.add('box', M(wx, wy, wz, 0.5, 1.3, 0.5, 0, -a, 0), DARK);
    }
  }
}

// ---------- Die drei grossen Schlösser ----------
const LM_STYLE = {
  abendschloss: { stone: [0.78, 0.68, 0.76], stone2: [0.62, 0.52, 0.66], roof: [0.4, 0.24, 0.55], win: [1, 0.75, 0.42], wallH: 15, tower: [30, 46], keep: 58, lit: 0.55, n: 7, aura: 0xc070ff },
  dunkelfeste: { stone: [0.11, 0.1, 0.13], stone2: [0.07, 0.06, 0.08], roof: [0.06, 0.05, 0.07], win: [1, 0.16, 0.1], wallH: 24, tower: [50, 84], keep: 110, lit: 0.4, n: 8, aura: 0x601020 },
  mondschloss: { stone: [0.7, 0.76, 0.9], stone2: [0.55, 0.62, 0.78], roof: [0.17, 0.2, 0.42], win: [0.78, 0.9, 1], wallH: 14, tower: [32, 54], keep: 70, lit: 0.6, n: 6, aura: 0x8fb4ff },
};
function buildLandmark(L, st) {
  if (L.kind === 'koloss') return buildColossus(L, st);
  const r = mulberry32(L.seed);
  const out = newBuilt(L);
  const S = LM_STYLE[L.kind];
  const mg = new Merger(), gps = new PointSet(), ps = new LeafSet();
  const cx = L.x, cz = L.z, y0 = L.baseH, R = L.R, n = S.n, ga = L.lakeAng;
  const dunkel = L.kind === 'dunkelfeste';
  // Mauerring mit Tor zur Seeseite
  const corners = [];
  for (let i = 0; i < n; i++) { const a = ga - Math.PI / n + i * Math.PI * 2 / n; corners.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const pieces = Math.max(3, Math.round(len / 4)), pl = len / pieces;
    for (let k = 0; k < pieces; k++) {
      const tm = (k + 0.5) / pieces;
      if (i === 0 && Math.abs(tm - 0.5) * len < 4) continue;
      const px = ax + (bx - ax) * tm, pz = az + (bz - az) * tm;
      mg.add('box', M(px, y0 + S.wallH / 2 - 2, pz, pl + 0.1, S.wallH + 4, 2.4, 0, -ang, 0), S.stone, 0.1, r);
      for (const o of [-0.25, 0.25]) mg.add('box', M(px + Math.cos(ang) * pl * o, y0 + S.wallH + 0.5, pz + Math.sin(ang) * pl * o, pl * 0.3, 1, 2.5, 0, -ang, 0), S.stone2, 0.08, r);
      if (k % 2 === 0) {
        // Strebepfeiler aussen
        const nx = Math.sin(ang), nz = -Math.cos(ang);
        mg.add('box', M(px + nx * 1.6, y0 + S.wallH * 0.35 - 2, pz + nz * 1.6, 1, S.wallH * 0.7 + 4, 1.4, 0, -ang, 0), S.stone2, 0.08, r);
      }
      if (r() < S.lit * 0.25) gps.add(px, y0 + S.wallH * 0.65, pz, S.win, 0.7);
    }
    const g0 = (len / 2 - 4) / len;
    if (i === 0) {
      segCollider(out, ax, az, ax + (bx - ax) * g0, az + (bz - az) * g0, 1.6);
      segCollider(out, ax + (bx - ax) * (1 - g0), az + (bz - az) * (1 - g0), bx, bz, 1.6);
    } else segCollider(out, ax, az, bx, bz, 1.6);
  }
  // Ecktürme
  for (const [tx, tz] of corners) {
    const h = S.tower[0] + r() * (S.tower[1] - S.tower[0]);
    gothicTower(mg, gps, tx, y0, tz, 3.6 + r() * 1.4, h, S, r, S.win, S.lit);
    circCollider(out, tx, tz, 4.8);
  }
  // Torhaus
  const gx = cx + Math.cos(ga) * R, gz = cz + Math.sin(ga) * R, tA = ga + Math.PI / 2;
  for (const sx of [-1, 1]) {
    const tx = gx + Math.cos(tA) * 5.5 * sx, tz = gz + Math.sin(tA) * 5.5 * sx;
    gothicTower(mg, gps, tx, y0, tz, 2.4, S.wallH + 12, S, r, S.win, S.lit);
    circCollider(out, tx, tz, 3);
  }
  mg.add('box', M(gx, y0 + S.wallH + 1, gz, 2.6, 4, 9, 0, -ga, 0), S.stone, 0.08, r);
  mg.add('cone4', M(gx, y0 + S.wallH + 3, gz, 2.2, 5, 6, 0, -ga + Math.PI / 4, 0), S.roof, 0.06, r);
  const gateGlow = makeGlow(dunkel ? 0xff3020 : L.kind === 'mondschloss' ? 0xbfd8ff : 0xffb070, 9, dunkel ? 0.35 : 0.6);
  gateGlow.position.set(gx, y0 + 3.5, gz); out.group.add(gateGlow);
  // Bergfried mit Turmspitze
  const kx = cx - Math.cos(ga) * R * 0.28, kz = cz - Math.sin(ga) * R * 0.28;
  const kw = dunkel ? 24 : 16, kh = S.keep, ka = -ga;
  mg.add('box', M(kx, y0 + kh / 2 - 2, kz, kw, kh + 4, kw * 0.85, 0, ka, 0), S.stone, 0.08, r);
  for (let q = 0; q < 4; q++) {
    const u = (q & 1 ? 1 : -1) * kw * 0.5, v = (q & 2 ? 1 : -1) * kw * 0.42, c = Math.cos(-ka), sn = Math.sin(-ka);
    const px = kx + u * c - v * sn, pz = kz + u * sn + v * c;
    gothicTower(mg, gps, px, y0, pz, 2.6, kh + 6 + r() * 10, S, r, S.win, S.lit);
  }
  mg.add('cone4', M(kx, y0 + kh, kz, kw * 0.72, kh * 0.55, kw * 0.62, 0, ka + Math.PI / 4, 0), S.roof, 0.05, r);
  mg.add('cyl', M(kx, y0 + kh + kh * 0.3, kz, 2.2, 10, 2.2), S.stone2, 0.08, r);
  mg.add('cone', M(kx, y0 + kh + kh * 0.3 + 10, kz, 2.6, 26 + (dunkel ? 30 : 0), 2.6), S.roof, 0.05, r);
  // Fenster des Bergfrieds
  for (let wy = y0 + 8; wy < y0 + kh - 4; wy += 5) {
    for (let q = -2; q <= 2; q++) {
      for (const side of [0, 1, 2, 3]) {
        const a = ga + side * Math.PI / 2, ext = side % 2 === 0 ? kw * 0.425 : kw * 0.5;
        const ox = Math.cos(a) * (ext + 0.1), oz = Math.sin(a) * (ext + 0.1), px = Math.cos(a + Math.PI / 2) * q * kw * 0.16, pz = Math.sin(a + Math.PI / 2) * q * kw * 0.16;
        if (r() < S.lit * 0.6) gps.add(kx + ox + px, wy, kz + oz + pz, S.win, 0.6 + r() * 0.5);
      }
    }
  }
  // Rosenfenster über dem Tor des Bergfrieds
  const rfx = kx + Math.cos(ga) * (kw * 0.425 + 0.2), rfz = kz + Math.sin(ga) * (kw * 0.425 + 0.2);
  for (let q = 0; q < 26; q++) { const a = q / 26 * Math.PI * 2, rr = q % 2 ? 2.4 : 1.2; gps.add(rfx + Math.cos(tA) * Math.cos(a) * rr, y0 + kh * 0.62 + Math.sin(a) * rr, rfz + Math.sin(tA) * Math.cos(a) * rr, S.win, 1); }
  boxCollider(out, kx, kz, kw + 0.6, kw * 0.85 + 0.6, ka);
  const front = [kx + Math.cos(ga) * (kw * 0.45 + 4), kz + Math.sin(ga) * (kw * 0.45 + 4)];
  // Hof: Truhen, Brunnen, Garten
  for (let k = 0; k < 2; k++) {
    const a = ga + (k ? 1 : -1) * (1.1 + r() * 0.6), d = R * 0.62;
    const key = L.key + ':c' + k, px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
    makeChest(out, key, px, pz, Math.atan2(cx - px, cz - pz), false, st.opened(key));
  }
  if (dunkel) {
    const key = L.key + ':boss';
    makeChest(out, key, front[0] + Math.cos(tA) * 3, front[1] + Math.sin(tA) * 3, -ga + Math.PI / 2, true, st.opened(key), !st.cleared(L.key));
    if (!st.cleared(L.key)) {
      const bt = pick(r, ['ritter', 'schatten', 'waechter']);
      out.spawns.push({ type: bt, x: (front[0] + gx) / 2, z: (front[1] + gz) / 2, boss: true, name: pick(r, BOSS_TITLES[bt]) });
      for (let k = 0; k < 4; k++) {
        const a = ga + (r() - 0.5) * 3, d = R * (0.4 + r() * 0.3);
        out.spawns.push({ type: pick(r, ['ritter', 'schatten']), x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, boss: false });
      }
    }
    // Krähen kreisen um die Spitze
    const crows = new PointSet(), cdat = [];
    for (let i = 0; i < 46; i++) { crows.add(0, 0, 0, [0.03, 0.02, 0.04]); cdat.push([18 + Math.random() * 40, 0.15 + Math.random() * 0.25, Math.random() * 6.28, y0 + kh * (0.7 + Math.random() * 0.8)]); }
    const cg = crows.build(), cp = new THREE.Points(cg, pointsMat(0.9, { sway: 0, farMul: 3.2 }));
    cp.frustumCulled = false; out.group.add(cp);
    out.updaters.push(dt => {
      const a = cg.attributes.position.array, t = U.uTime.value;
      for (let i = 0; i < cdat.length; i++) {
        const d = cdat[i], an = d[2] + t * d[1];
        a[i * 3] = kx + Math.cos(an) * d[0]; a[i * 3 + 1] = d[3] + Math.sin(t * 2 + i) * 2; a[i * 3 + 2] = kz + Math.sin(an) * d[0];
      }
      cg.attributes.position.needsUpdate = true;
    });
    const red = makeGlow(0xff2010, 110, 0.18); red.material.fog = false; red.position.set(kx, y0 + kh * 0.8, kz); out.group.add(red);
    out.updaters.push(() => { red.material.opacity = 0.12 + Math.max(0, Math.sin(U.uTime.value * 0.7)) * 0.1; });
  } else {
    // Brunnen der Ruhe
    const fx = (front[0] + gx) / 2, fz = (front[1] + gz) / 2;
    mg.add('cyl', M(fx, y0 - 0.2, fz, 2.6, 0.9, 2.6), S.stone2, 0.06, r);
    mg.add('cyl', M(fx, y0 + 0.5, fz, 0.4, 1.8, 0.4), S.stone, 0.06, r);
    const wcol = L.kind === 'mondschloss' ? [0.6, 0.85, 1] : [1, 0.7, 0.95];
    for (let q = 0; q < 40; q++) { const a = Math.random() * 6.28, d = Math.random() * 2.2; gps.add(fx + Math.cos(a) * d, y0 + 0.72, fz + Math.sin(a) * d, wcol, 0.5 + Math.random() * 0.5); }
    out.interact.push({ kind: 'rest', x: fx, z: fz, r: 3.5, label: 'Am Brunnen rasten' });
    circCollider(out, fx, fz, 2.7);
    // Garten aus Blütenbäumen
    const tree = L.kind === 'abendschloss'
      ? { tree: 'kirsch', trunkC: [0.3, 0.2, 0.25], canopyC: [[0.85, 0.55, 0.9], [0.6, 0.38, 0.72], [1, 0.82, 0.95]] }
      : { tree: 'weide', trunkC: [0.25, 0.27, 0.35], canopyC: [[0.7, 0.8, 1], [0.45, 0.52, 0.75], [0.92, 0.95, 1]] };
    for (let k = 0; k < 7; k++) {
      const a = r() * 6.28, d = R * (0.45 + r() * 0.35);
      const px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
      if (Math.hypot(px - kx, pz - kz) < kw * 0.75 || Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))) < 0.45) continue;
      buildTree(tree, px, y0, pz, r, mg, ps);
      circCollider(out, px, pz, 0.6);
    }
  }
  // Damm mit Laternen über den See
  if (L.lake) {
    for (let d = R + 4; d < L.dam; d += 9) {
      for (const sx of [-1, 1]) {
        const px = cx + Math.cos(ga) * d + Math.cos(tA) * 2.9 * sx, pz = cz + Math.sin(ga) * d + Math.sin(tA) * 2.9 * sx;
        const py = Math.max(0.9, heightAt(px, pz));
        mg.add('box', M(px, py + 1.2, pz, 0.22, 2.6, 0.22), [0.18, 0.16, 0.2]);
        mg.add('box', M(px, py + 2.6, pz, 0.45, 0.5, 0.45), [0.12, 0.1, 0.12]);
        gps.add(px, py + 2.6, pz, L.kind === 'mondschloss' ? [1, 0.88, 0.6] : [1, 0.72, 0.4], 1.1);
      }
    }
  }
  // Leuchtende Aura
  if (L.kind === 'abendschloss') {
    const a1 = makeGlow(S.aura, 230, 0.2), a2 = makeGlow(0xffa0c0, 120, 0.14);
    for (const a of [a1, a2]) { a.material.fog = false; a.position.set(kx, y0 + 40, kz); out.group.add(a); }
    risingMotes(out, 120, cx, y0, cz, R * 1.3, 50, [[1, 0.7, 0.95], [1, 0.85, 0.6], [0.85, 0.7, 1]], 1.4, 0.45);
    out.updaters.push(() => { const t = U.uTime.value; a1.material.opacity = 0.17 + Math.sin(t * 0.4) * 0.04; });
  } else if (L.kind === 'mondschloss') {
    const a1 = makeGlow(S.aura, 160, 0.22);
    a1.material.fog = false; a1.position.set(kx, y0 + 50, kz); out.group.add(a1);
    risingMotes(out, 80, cx, y0, cz, R * 1.2, 40, [[0.8, 0.9, 1], [1, 0.95, 0.8]], 0.8, 0.4);
    // Wer durch das Mondtor geht, wird gesegnet
    out.gate = { x: gx, z: gz, y0, nx: Math.cos(ga), nz: Math.sin(ga), tx: Math.cos(tA), tz: Math.sin(tA), prev: null, moon: true };
  }
  out.group.add(new THREE.Mesh(mg.build(), MAT.landmark));
  if (!gps.empty) out.group.add(new THREE.Points(gps.build(), MAT.landGlow));
  if (!ps.empty) out.group.add(leafObj(ps));
  out.front = front;
  out.updaters.push(dt => { updateFires(out, dt); updateChests(out, dt); });
  reflectable(out.group);
  return out;
}

// ---------- Höhlen ----------
const CAVE_Y = -400;
function caveDome(rad, hgt, cols, r, jit, cx, cy, cz) {
  const g = new THREE.SphereGeometry(rad, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (World.nD.noise(x * 0.15 + 3, z * 0.15 + y * 0.1) * 0.5 + (r() - 0.5) * 0.3) * jit;
    p.setXYZ(i, x * k, y * hgt / rad * k, z * k);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  const n = ng.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const c = cols[Math.floor(r() * cols.length)], f = 0.8 + r() * 0.4;
    for (let k = 0; k < 3; k++) col.set([c[0] * f, c[1] * f, c[2] * f], (i + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!MAT.caveRock) MAT.caveRock = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.BackSide });
  const m = new THREE.Mesh(ng, MAT.caveRock);
  m.position.set(cx, cy, cz);
  return m;
}
function buildCave(s, st) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = s.baseH;
  const mg = new Merger(), gps = new PointSet();
  const kristall = s.cave === 'kristall';
  const fa = r() * Math.PI * 2, fx = Math.cos(fa), fz = Math.sin(fa);
  // Eingang: Felshügel mit dunklem Maul
  const rock = BIOMES[s.biome].rockC;
  for (let k = 0; k < 14; k++) {
    const a = fa + Math.PI + (r() - 0.5) * 3.6, d = 2 + r() * 4;
    const sz = 2 + r() * 2.6;
    mg.add('ico', M(x + Math.cos(a) * d - fx * 2, y0 + sz * 0.5, z + Math.sin(a) * d - fz * 2, sz, sz * (0.8 + r() * 0.6), sz, r(), r() * 6, r()), rock, 0.2, r);
  }
  for (const sx of [-1, 1]) mg.add('ico', M(x + fz * 2.6 * sx, y0 + 1.8, z - fx * 2.6 * sx, 1.6, 2.6, 1.6, r() * 0.3, r() * 6, 0), rock.map(v => v * 0.85), 0.2, r);
  mg.add('ico', M(x - fx * 0.2, y0 + 4.2, z - fz * 0.2, 3.4, 1.4, 2.4, 0, -fa, 0), rock.map(v => v * 0.9), 0.2, r);
  mg.add('box', M(x - fx * 0.6, y0 + 1.5, z - fz * 0.6, 3.2, 3.2, 0.6, 0, -fa + Math.PI / 2, 0), [0.01, 0.01, 0.02]);
  const mc = kristall ? 0x9a70ff : 0xff7a30;
  const mouth = makeGlow(mc, 5, 0.55); mouth.position.set(x + fx * 0.3, y0 + 1.4, z + fz * 0.3); out.group.add(mouth);
  for (let q = 0; q < 30; q++) gps.add(x + fx * (r() * 3) + (r() - 0.5) * 3, y0 + 0.1, z + fz * (r() * 3) + (r() - 0.5) * 3, kristall ? [0.6, 0.5, 1] : [1, 0.5, 0.2], 0.4 + r() * 0.4);
  const ex = x + fx * 2.2, ez = z + fz * 2.2;
  out.interact.push({ kind: 'cave', x: ex, z: ez, r: 3.2, label: 'Die Höhle betreten' });
  circCollider(out, x - fx * 2.5, z - fz * 2.5, 3.2);
  out.mouth = { x: ex + fx * 1.5, z: ez + fz * 1.5, face: fa };
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!gps.empty) out.group.add(new THREE.Points(gps.build(), MAT.glow));
  out.updaters.push(() => { mouth.material.opacity = 0.45 + Math.sin(U.uTime.value * (kristall ? 7 : 2)) * 0.12 * (kristall ? Math.random() : 1); });

  // Innenraum (tief unter dem Eingang, eigene Welt)
  const inner = new THREE.Group();
  const cy = CAVE_Y, img = new Merger(), ips = new LeafSet(), ins = new LeafSet(true), igl = new PointSet();
  const cave = { x, z, y: cy, kind: s.cave, flick: 0, inner };
  out.cave = cave;
  if (kristall) {
    const RAD = 28;
    cave.R = 22; cave.ceil = 18; cave.floor = () => cy;
    inner.add(caveDome(RAD, 20, [[0.1, 0.08, 0.16], [0.07, 0.06, 0.12], [0.14, 0.1, 0.2]], r, 0.2, x, cy, z));
    img.add('cyl', M(x, cy - 1, z, RAD, 1, RAD), [0.2, 0.17, 0.27], 0.3, r);
    for (let k = 0; k < 40; k++) { const a = r() * 6.28, d = 3 + r() * 20; img.add('ico', M(x + Math.cos(a) * d, cy, z + Math.sin(a) * d, 0.4 + r(), 0.3 + r() * 0.5, 0.4 + r(), r(), r(), r()), [0.13, 0.11, 0.18], 0.2, r); }
    // Kristalle an den Wänden, in zwei Gruppen, die abwechselnd aufblitzen
    const cg = [new Merger(), new Merger()];
    const ccols = [[0.5, 0.9, 1], [0.85, 0.5, 1], [0.6, 0.6, 1], [1, 0.6, 0.9]];
    for (let k = 0; k < 70; k++) {
      const a = r() * 6.28, up = r(), d = RAD * (0.92 - up * 0.4) - 0.5;
      let da = Math.abs(Math.atan2(Math.sin(a - fa), Math.cos(a - fa)));
      if (da < 0.45 && up < 0.6) continue;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = cy + up * 15;
      const sz = 0.4 + r() * 1.1, c = pick(r, ccols);
      for (let q = 0; q < 3; q++) cg[k & 1].add('oct', M(px + (r() - 0.5), py + (r() - 0.5), pz + (r() - 0.5), sz * 0.35, sz * (1.4 + r()), sz * 0.35, (r() - 0.5) * 1.5, r() * 6, (r() - 0.5) * 1.5 + (up > 0.6 ? Math.PI : 0)), c, 0.2, r);
    }
    cave.crys = cg.map(m => { const mt = new THREE.MeshBasicMaterial({ vertexColors: true }); const me = new THREE.Mesh(m.build(), mt); inner.add(me); return mt; });
    // Neonbaum in der Mitte
    const neon = pick(r, [[0.2, 1, 0.9], [1, 0.3, 0.85], [0.5, 0.6, 1]]);
    const B = { tree: 'weide', trunkC: [0.12, 0.08, 0.16], canopyC: [neon, neon.map(v => v * 0.5), neon.map(v => Math.min(1, v * 0.5 + 0.5))] };
    buildTree(B, x, cy, z, r, img, ins);
    buildTree(Object.assign({}, B, { tree: 'kirsch' }), x + 0.5, cy + 2.5, z + 0.3, r, img, ins);
    circCollider(out, x, z, 0.9).cave = true;
    for (let q = 0; q < 60; q++) { const a = r() * 6.28, d = 1 + r() * 6; igl.add(x + Math.cos(a) * d, cy + 0.15, z + Math.sin(a) * d, neon, 0.6 + r() * 0.4); }
    inner.add(risingMotes(out, 60, x, cy, z, 9, 12, [neon, [1, 1, 1]], 0.6, 0.35));
    // Teich
    const pa = fa + 2.4, px = x + Math.cos(pa) * 11, pz = z + Math.sin(pa) * 11;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.6, 14), new THREE.MeshBasicMaterial({ color: 0x2a6080 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(px, cy + 0.04, pz); inner.add(pond);
    for (let q = 0; q < 20; q++) { const a = r() * 6.28, d = r() * 3.3; igl.add(px + Math.cos(a) * d, cy + 0.1, pz + Math.sin(a) * d, [0.5, 0.9, 1], 0.5); }
    cave.pond = pond.material;
    const ca = fa + Math.PI + 0.9, key = s.key + ':c0';
    makeChest(out, key, x + Math.cos(ca) * 14, z + Math.sin(ca) * 14, Math.atan2(-Math.cos(ca), -Math.sin(ca)), r() < 0.4, st.opened(key));
    out.chests[out.chests.length - 1].y = cy;
    cave.env = { amb: new THREE.Color(0.35, 0.28, 0.6), ground: new THREE.Color(0.08, 0.05, 0.12), ambI: 0.7, fog: new THREE.Color(0.05, 0.03, 0.09), far: 60, sat: 1.05, bloom: 1.1, fly: new THREE.Color(0.7, 0.8, 1) };
  } else {
    const RAD = 44, RI = 17, RO = 34, LAVA = cy - 44;
    cave.R = RO; cave.RI = RI; cave.ceil = 26; cave.floor = () => cy;
    inner.add(caveDome(RAD, 30, [[0.12, 0.07, 0.06], [0.08, 0.05, 0.05], [0.16, 0.09, 0.06]], r, 0.15, x, cy, z));
    // Felsband (Boden) als Ring
    const ring = new THREE.RingGeometry(RI, RAD, 40, 2);
    ring.rotateX(-Math.PI / 2);
    const rc = new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ color: 0x2a1c18 }));
    rc.position.set(x, cy, z); inner.add(rc);
    // Abgrund-Wand bis zur Lava
    const wall = new THREE.CylinderGeometry(RI, RI * 1.12, cy - LAVA, 30, 6, true);
    const wp = wall.attributes.position, wcol = new Float32Array(wp.count * 3);
    for (let i = 0; i < wp.count; i++) {
      const t = (wp.getY(i) + (cy - LAVA) / 2) / (cy - LAVA);
      const k = 1 + (r() - 0.5) * 0.16;
      wp.setXYZ(i, wp.getX(i) * k, wp.getY(i), wp.getZ(i) * k);
      const glow = Math.pow(1 - t, 2.2);
      wcol.set([0.12 + glow * 0.9, 0.07 + glow * 0.32, 0.06 + glow * 0.05], i * 3);
    }
    wall.setAttribute('color', new THREE.BufferAttribute(wcol, 3));
    const wm = new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    wm.position.set(x, (cy + LAVA) / 2, z); inner.add(wm);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(RI * 1.15, 30), new THREE.MeshBasicMaterial({ color: 0xff6018 }));
    lava.rotation.x = -Math.PI / 2; lava.position.set(x, LAVA, z); inner.add(lava);
    cave.lava = lava.material;
    const lg = makeGlow(0xff5010, 70, 0.5); lg.position.set(x, LAVA + 6, z); inner.add(lg);
    const lg2 = makeGlow(0xff7020, 46, 0.45); lg2.position.set(x, cy - 10, z); inner.add(lg2);
    inner.add(risingMotes(out, 140, x, LAVA, z, RI, cy - LAVA + 12, [[1, 0.5, 0.15], [1, 0.8, 0.3]], 4, 0.4));
    // Schienen rund um den Abgrund
    const RR = (RI + RO) / 2 + 1;
    for (let k = 0; k < 64; k++) {
      const a = k / 64 * 6.283, a2 = (k + 1) / 64 * 6.283, am = (a + a2) / 2;
      for (const off of [-0.55, 0.55]) {
        const ax = x + Math.cos(a) * (RR + off), az = z + Math.sin(a) * (RR + off), bx = x + Math.cos(a2) * (RR + off), bz = z + Math.sin(a2) * (RR + off);
        img.add('box', M((ax + bx) / 2, cy + 0.2, (az + bz) / 2, Math.hypot(bx - ax, bz - az) + 0.05, 0.1, 0.1, 0, -Math.atan2(bz - az, bx - ax), 0), [0.42, 0.4, 0.42]);
      }
      img.add('box', M(x + Math.cos(am) * RR, cy + 0.08, z + Math.sin(am) * RR, 1.7, 0.12, 0.35, 0, -am, 0), [0.3, 0.2, 0.14], 0.1, r);
    }
    // Loren, die im Kreis fahren
    cave.carts = [];
    for (let k = 0; k < 3; k++) {
      const cg = new THREE.Group(), cm = new Merger(), cps = new PointSet();
      cm.add('box', M(0, 0.85, 0, 1.4, 0.8, 1), [0.35, 0.25, 0.18], 0.1, r);
      cm.add('box', M(0, 1.28, 0, 1.5, 0.1, 1.1), [0.4, 0.4, 0.44]);
      for (const [ox, oz] of [[-0.45, 0.55], [0.45, 0.55], [-0.45, -0.55], [0.45, -0.55]]) cm.add('cyl', M(ox, 0.3, oz, 0.25, 0.1, 0.25, 0, 0, Math.PI / 2), [0.2, 0.2, 0.22]);
      for (let q = 0; q < 26; q++) cps.add((r() - 0.5) * 1.1, 1.35 + r() * 0.3, (r() - 0.5) * 0.8, r() < 0.4 ? [1, 0.6, 0.2] : [0.3, 0.25, 0.3], 1);
      cg.add(new THREE.Mesh(cm.build(), MAT.flat), new THREE.Points(cps.build(), MAT.glow));
      inner.add(cg);
      cave.carts.push({ g: cg, a: k * 2.09, sp: 0.18 });
    }
    // Zwerge bei der Arbeit
    cave.dwarves = [];
    for (let k = 0; k < 6; k++) {
      const a = fa + 0.7 + k * 0.95, d = k % 2 ? RO - 3 : RI + 2.2;
      const dw = makeDwarf(s.seed + k);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      dw.position.set(px, cy, pz);
      dw.rotation.y = Math.atan2(Math.cos(a) * (k % 2 ? 1 : -1), Math.sin(a) * (k % 2 ? 1 : -1));
      inner.add(dw);
      // Amboss oder Erzbrocken vor dem Zwerg
      const ox = px + Math.sin(dw.rotation.y) * 0.9, oz = pz + Math.cos(dw.rotation.y) * 0.9;
      if (k % 2) img.add('ico', M(ox, cy + 0.5, oz, 0.9, 0.8, 0.9, r(), r(), r()), [0.3, 0.2, 0.25], 0.2, r);
      else { img.add('box', M(ox, cy + 0.35, oz, 0.5, 0.7, 0.4), [0.2, 0.2, 0.22]); img.add('box', M(ox, cy + 0.75, oz, 0.9, 0.2, 0.4), [0.3, 0.3, 0.33]); }
      for (let q = 0; q < 6; q++) igl.add(ox + (r() - 0.5) * 0.9, cy + 0.9 + r() * 0.3, oz + (r() - 0.5) * 0.9, [1, 0.55, 0.2], 0.8);
      cave.dwarves.push({ g: dw, ph: r() * 6, ox, oz });
      circCollider(out, px, pz, 0.5).cave = true;
    }
    // ein Zwerg handelt mit Waffen
    const d0 = cave.dwarves[0];
    out.interact.push({ kind: 'shop', x: d0.g.position.x, z: d0.g.position.z, r: 2.8, name: 'Zwerg ' + pick(r, ['Borin', 'Grimma', 'Thrain', 'Dagna', 'Balduin']), cave: true });
    // Laternen
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.283 + 0.2, d = RO + 1.5;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      img.add('box', M(px, cy + 1.3, pz, 0.15, 2.6, 0.15), [0.3, 0.2, 0.14]);
      igl.add(px, cy + 2.6, pz, [1, 0.7, 0.35], 1);
    }
    const ca = fa + Math.PI + 0.5, key = s.key + ':c0';
    makeChest(out, key, x + Math.cos(ca) * (RO - 2), z + Math.sin(ca) * (RO - 2), Math.atan2(-Math.cos(ca), -Math.sin(ca)), true, st.opened(key));
    out.chests[out.chests.length - 1].y = cy;
    circCollider(out, x, z, RI + 0.8).cave = true;
    cave.env = { amb: new THREE.Color(0.85, 0.4, 0.22), ground: new THREE.Color(0.35, 0.12, 0.05), ambI: 0.6, fog: new THREE.Color(0.12, 0.04, 0.02), far: 110, sat: 1.0, bloom: 0.9, fly: new THREE.Color(1, 0.55, 0.2) };
  }
  // Ausgang am Eintrittspunkt
  cave.inX = x + fx * (cave.R - 5); cave.inZ = z + fz * (cave.R - 5);
  img.add('ico', M(x + fx * (cave.R + 5), cy + 2, z + fz * (cave.R + 5), 3, 3, 3), [0.05, 0.05, 0.06]);
  const exitG = makeGlow(0xd8e8ff, 5, 0.5); exitG.position.set(x + fx * (cave.R - 0.5), cy + 1.8, z + fz * (cave.R - 0.5)); inner.add(exitG);
  out.interact.push({ kind: 'caveExit', x: x + fx * (cave.R - 1.5), z: z + fz * (cave.R - 1.5), r: 3, label: 'Zurück ans Tageslicht', cave: true });
  out.colliders.push({ ring: true, x, z, r: cave.R, cave: true });
  if (!img.empty) inner.add(new THREE.Mesh(img.build(), MAT.flat));
  if (!ins.empty) inner.add(leafObj(ins));
  if (!igl.empty) inner.add(new THREE.Points(igl.build(), MAT.glowBig));
  // die Truhen der Höhle hängen am Innenraum
  for (const c of out.chests) if (c.y === cy) { c.lid.parent.position.y = cy; c.cave = true; }
  for (const it of out.interact) if (it.kind === 'chest' && it.chest.cave) it.cave = true;
  for (const c of out.colliders) if (!c.seg && !c.ring && c.r < 1.2 && out.chests.some(ch => ch.cave && ch.x === c.x && ch.z === c.z)) c.cave = true;
  out.group.add(inner);
  inner.visible = false;
  out.updaters.push(dt => {
    updateChests(out, dt);
    if (!inner.visible) return;
    const t = U.uTime.value;
    if (kristall) {
      // Blitze in den Kristallen
      cave.flick = Math.max(0, cave.flick - dt * 4);
      if (Math.random() < dt * 0.9) cave.flick = 1 + Math.random();
      for (let i = 0; i < 2; i++) {
        const f = 0.45 + Math.sin(t * (1.3 + i * 0.7) + i) * 0.12 + (cave.flick > 0 && (i === 0) === (Math.floor(t * 23) % 2 === 0) ? cave.flick * 0.9 : 0);
        cave.crys[i].color.setScalar(f);
      }
      cave.env.ambI = 0.65 + cave.flick * 0.6;
      cave.pond.color.setRGB(0.12, 0.3 + Math.sin(t * 2) * 0.05, 0.42);
    } else {
      cave.lava.color.setRGB(1, 0.36 + Math.sin(t * 1.3) * 0.06, 0.08);
      for (const c of cave.carts) {
        c.a += dt * c.sp;
        const RR = (cave.RI + cave.R) / 2 + 1;
        c.g.position.set(x + Math.cos(c.a) * RR, cy, z + Math.sin(c.a) * RR);
        c.g.rotation.y = -c.a;
      }
      for (const d of cave.dwarves) {
        const ph = t * 3 + d.ph, sw = Math.max(0, Math.sin(ph));
        animHumanoid(d.g, dt, { work: sw });
        if (Math.sin(ph - dt * 3) < 0.98 && Math.sin(ph) >= 0.98) {
          burst(d.ox, cy + 1, d.oz, 5, [1, 0.7, 0.3], 3, 0.1, 0.5, 6);
          if (out.onClink) out.onClink(d);
        }
      }
      cave.env.ambI = 0.55 + Math.sin(t * 0.9) * 0.05;
    }
  });
  return out;
}

// ---------- Lichtung mit dem Riesenbaum und Feen ----------
function buildClearing(s, st) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = s.baseH;
  const mg = new Merger(), ps = new LeafSet(), gps = new PointSet(), fl = new LeafSet();
  const B = BIOMES[s.biome];
  const bark = [0.3, 0.22, 0.18], leaf = [[0.32, 0.55, 0.3], [0.2, 0.36, 0.22], [0.7, 0.85, 0.45]];
  // Stamm, Wurzeln, Äste
  mg.add('taper', M(x, y0 - 1, z, 3.2, 22, 3.2, 0, r(), 0), bark, 0.08, r);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * 6.28 + r() * 0.4;
    mg.add('taper', M(x + Math.cos(a) * 1.5, y0 + 1.4, z + Math.sin(a) * 1.5, 0.9, 6 + r() * 3, 0.9, 0, Math.PI - a, 1.9 + r() * 0.3), bark.map(v => v * 0.9), 0.1, r);
  }
  const crowns = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * 6.28 + r(), L = 9 + r() * 5, tilt = 0.8 + r() * 0.35;
    const hy = y0 + 12 + r() * 6;
    mg.add('taper', M(x, hy, z, 0.9, L, 0.9, 0, Math.PI - a, tilt), bark, 0.08, r);
    const ex = x + Math.cos(a) * Math.sin(tilt) * L, ez = z + Math.sin(a) * Math.sin(tilt) * L, ey = hy + Math.cos(tilt) * L;
    crowns.push([ex, ey, ez]);
  }
  BLOB_MUL = 0.6;
  for (const [ex, ey, ez] of crowns) blob(ps, ex, ey + 1.5, ez, 6 + r() * 2, 3.2 + r(), 6 + r() * 2, leaf, r, 8);
  blob(ps, x, y0 + 26, z, 9, 5, 9, leaf, r, 8);
  BLOB_MUL = 1;
  // Leuchtende Früchte im Laub
  for (let q = 0; q < 140; q++) { const c = crowns[q % crowns.length]; gps.add(c[0] + (r() - 0.5) * 11, c[1] + (r() - 0.3) * 5, c[2] + (r() - 0.5) * 11, pick(r, [[1, 0.9, 0.55], [0.7, 1, 0.8], [1, 0.7, 0.9]]), 0.8); }
  circCollider(out, x, z, 3.6);
  // Blumen und Pilzringe
  for (let q = 0; q < 380; q++) {
    const a = r() * 6.28, d = 5 + Math.sqrt(r()) * 18, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    fl.add(px, groundY(px, pz) + 0.15 + r() * 0.2, pz, pick(r, [[1, 0.85, 0.95], [0.85, 0.85, 1], [1, 0.95, 0.6], [0.7, 0.95, 1]]), 0.9 + r() * 0.2);
  }
  for (let q = 0; q < 16; q++) { const a = q / 16 * 6.28, px = x + Math.cos(a) * 9, pz = z + Math.sin(a) * 9; gps.add(px, groundY(px, pz) + 0.2, pz, [0.5, 1, 0.85], 0.7); }
  // Lichtsäulen durch das Blätterdach
  const rayMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(1, 0.92, 0.7) }, uA: { value: 0.18 }, uTime: U.uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uA, uTime; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.7, vUv.y); gl_FragColor = vec4(uCol, a * uA * (0.8 + 0.2 * sin(uTime * 0.7 + vUv.y * 3.0))); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (let k = 0; k < 5; k++) {
    const a = r() * 6.28, d = 6 + r() * 9;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + r() * 2, 28), rayMat);
    m.position.set(x + Math.cos(a) * d, y0 + 12, z + Math.sin(a) * d);
    m.rotation.set(0, r() * 3, 0.35);
    out.group.add(m);
  }
  // Feen mit Leuchtspuren
  const NF = 34, TR = 5, fps = new PointSet(), fdat = [];
  for (let i = 0; i < NF; i++) {
    const c = pick(r, [[1, 0.9, 0.5], [0.6, 1, 0.9], [1, 0.6, 0.95], [0.75, 0.8, 1]]);
    for (let k = 0; k < TR; k++) fps.add(0, 0, 0, c, 1 - k / TR * 0.75);
    fdat.push({ rad: 4 + r() * 10, h: 1.5 + r() * 14, sp: (0.3 + r() * 0.5) * (r() < 0.5 ? -1 : 1), ph: r() * 6.28, bob: 0.5 + r() * 1.5, hist: [] });
  }
  const fg = fps.build(), fairy = new THREE.Points(fg, pointsMat(0.55, { emit: 1, additive: true, sway: 0 }));
  fairy.frustumCulled = false;
  out.group.add(fairy);
  out.updaters.push(() => {
    const a = fg.attributes.position.array, t = U.uTime.value;
    for (let i = 0; i < NF; i++) {
      const f = fdat[i];
      for (let k = 0; k < TR; k++) {
        const tt = t - k * 0.07, an = f.ph + tt * f.sp;
        const o = (i * TR + k) * 3;
        a[o] = x + Math.cos(an) * f.rad + Math.sin(tt * 1.7 + i) * 0.6;
        a[o + 1] = y0 + f.h + Math.sin(tt * f.bob + i) * 1.2;
        a[o + 2] = z + Math.sin(an) * f.rad + Math.cos(tt * 1.3 + i) * 0.6;
      }
    }
    fg.attributes.position.needsUpdate = true;
    rayMat.uniforms.uA.value = 0.1 + (1 - ATM.night) * 0.12;
  });
  out.interact.push({ kind: 'feen', x: x + 4.5, z, r: 6, label: 'Die Feen grüssen' });
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  out.group.add(leafObj(ps));
  out.group.add(new THREE.Points(gps.build(), MAT.glowBig));
  out.group.add(leafObj(fl));
  const halo = makeGlow(0xfff0b0, 46, 0.22); halo.position.set(x, y0 + 14, z); out.group.add(halo);
  const base = makeGlow(0xb0ffd8, 16, 0.3); base.position.set(x, y0 + 1.5, z); out.group.add(base);
  void B;
  return out;
}

// ---------- Wandernde Ritter am Lagerfeuer ----------
function buildKnights(s) {
  const r = mulberry32(s.seed);
  const out = newBuilt(s);
  const x = s.x, z = s.z, y0 = s.baseH;
  const mg = new Merger();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; mg.add('ico', M(x + Math.cos(a), y0 + 0.1, z + Math.sin(a), 0.3, 0.22, 0.3, r(), r(), r()), [0.42, 0.4, 0.44], 0.2, r); }
  for (let i = 0; i < 3; i++) mg.add('box', M(x, y0 + 0.2, z, 1.4, 0.18, 0.18, 0, i * 1.05, 0.15), [0.32, 0.2, 0.14]);
  addFire(out, x, y0 + 0.1, z, 0xff8a40, 1.1);
  const n = 3 + Math.floor(r() * 2), a0 = r() * 6.28;
  out.knights = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + k / n * 6.283, kx = x + Math.cos(a) * 2.5, kz = z + Math.sin(a) * 2.5;
    const kn = makeKnight(s.seed + k * 7, true);
    kn.position.set(kx, y0, kz); kn.rotation.y = Math.atan2(x - kx, z - kz);
    out.group.add(kn); out.knights.push(kn);
    mg.add('cyl', M(kx - Math.cos(a) * 0.15, y0 + 0.15, kz - Math.sin(a) * 0.15, 0.32, 0.32, 0.32), [0.3, 0.22, 0.16]);
    // Schwert im Boden und Schild daneben
    const sx = x + Math.cos(a + 0.35) * 3.6, sz = z + Math.sin(a + 0.35) * 3.6;
    mg.add('box', M(sx, y0 + 0.7, sz, 0.08, 1.4, 0.04, 0.1, a, 0.08), [0.75, 0.78, 0.85]);
    mg.add('box', M(sx, y0 + 1.25, sz, 0.42, 0.07, 0.07, 0, a, 0), [0.55, 0.45, 0.25]);
    mg.add('cyl', M(sx + Math.cos(a) * 0.4, y0 + 0.5, sz + Math.sin(a) * 0.4, 0.45, 0.06, 0.45, 1.3, a, 0), pick(r, [[0.55, 0.12, 0.14], [0.16, 0.22, 0.45], [0.7, 0.6, 0.25]]));
  }
  // Zelt mit Banner
  const ta = a0 + 0.5, tx = x + Math.cos(ta) * 6.5, tz = z + Math.sin(ta) * 6.5;
  const cloth = pick(r, [[0.6, 0.16, 0.18], [0.22, 0.28, 0.55], [0.85, 0.8, 0.7]]);
  mg.add('cone6', M(tx, y0 - 0.1, tz, 2.8, 4, 2.8), cloth, 0.06, r);
  mg.add('cyl6', M(tx, y0 + 3.8, tz, 0.06, 2.4, 0.06), WOOD);
  circCollider(out, tx, tz, 2.5);
  const bx = x + Math.cos(ta - 1.3) * 4.5, bz = z + Math.sin(ta - 1.3) * 4.5;
  mg.add('cyl6', M(bx, y0 - 0.2, bz, 0.07, 4.4, 0.07), WOOD);
  const flag = new THREE.Group(); flag.position.set(bx, y0 + 4, bz);
  const fm = new Merger(); fm.add('box', M(0.55, -0.7, 0, 1.0, 1.6, 0.04), cloth); fm.add('box', M(0.55, -0.6, 0.03, 0.4, 0.4, 0.02), [0.9, 0.8, 0.4]);
  flag.add(new THREE.Mesh(fm.build(), MAT.flat)); out.group.add(flag);
  // Pferd
  const hx = x + Math.cos(ta + 2.2) * 6, hz = z + Math.sin(ta + 2.2) * 6, hr = r() * 6;
  const hm = new Merger(), hc = pick(r, [[0.35, 0.24, 0.16], [0.85, 0.82, 0.78], [0.15, 0.12, 0.12]]);
  hm.add('box', M(0, 1.3, 0, 0.7, 0.75, 1.8), hc, 0.06, r);
  hm.add('box', M(0, 1.85, 1.05, 0.4, 0.9, 0.45, -0.6, 0, 0), hc);
  hm.add('box', M(0, 2.15, 1.45, 0.35, 0.35, 0.7, 0.3, 0, 0), hc);
  for (const [ox, oz] of [[-0.25, 0.7], [0.25, 0.7], [-0.25, -0.7], [0.25, -0.7]]) hm.add('box', M(ox, 0.5, oz, 0.18, 1.0, 0.18), hc.map(v => v * 0.8));
  hm.add('box', M(0, 1.72, 0, 0.75, 0.1, 0.8), cloth);
  const horse = new THREE.Mesh(hm.build(), MAT.flat); horse.position.set(hx, y0, hz); horse.rotation.y = hr; out.group.add(horse);
  circCollider(out, hx, hz, 1.2);
  out.group.add(new THREE.Mesh(mg.build(), MAT.flat));
  out.interact.push({ kind: 'npc', x, z, r: 4.2 });
  out.interact.push({ kind: 'fire', x, z, r: 2.2 });
  circCollider(out, x, z, 1.1);
  out.fireLight = [x, y0 + 1.2, z];
  out.updaters.push(dt => {
    updateFires(out, dt);
    const t = U.uTime.value, w = U.uWindDir.value;
    flag.rotation.y = Math.atan2(-w.y, w.x) + Math.sin(t * 3) * 0.2;
    out.knights.forEach(k => { if (k.userData.anim) k.userData.anim(dt); });
    horse.rotation.y = hr + Math.sin(t * 0.3) * 0.08;
  });
  return out;
}

// ---------- Ferne Silhouetten der Wahrzeichen (bis zum Horizont sichtbar) ----------
function buildImpostor(L) {
  if (L.kind === 'koloss') return buildColossusImpostor(L);
  const r = mulberry32(L.seed);
  const S = LM_STYLE[L.kind];
  const g = new THREE.Group(), mg = new Merger(), gps = new PointSet();
  const cx = L.x, cz = L.z, y0 = L.baseH, R = L.R, ga = L.lakeAng;
  for (let i = 0; i < S.n; i++) {
    const a = ga - Math.PI / S.n + i * Math.PI * 2 / S.n, tx = cx + Math.cos(a) * R, tz = cz + Math.sin(a) * R;
    const h = S.tower[0] + r() * (S.tower[1] - S.tower[0]), rad = 4.2;
    mg.add('cyl6', M(tx, y0 - 4, tz, rad, h + 4, rad), S.stone);
    mg.add('cone6', M(tx, y0 + h, tz, rad * 1.1, rad * 5.5, rad * 1.1), S.roof);
    for (let q = 0; q < 4; q++) gps.add(tx + (r() - 0.5) * rad, y0 + 6 + r() * h * 0.9, tz + (r() - 0.5) * rad, S.win, 0.8);
    const b = (i + 1) % S.n, bx = cx + Math.cos(a + Math.PI * 2 / S.n) * R, bz = cz + Math.sin(a + Math.PI * 2 / S.n) * R;
    mg.add('box', M((tx + bx) / 2, y0 + S.wallH / 2 - 3, (tz + bz) / 2, Math.hypot(bx - tx, bz - tz), S.wallH + 6, 2.5, 0, -Math.atan2(bz - tz, bx - tx), 0), S.stone);
    void b;
  }
  const kx = cx - Math.cos(ga) * R * 0.28, kz = cz - Math.sin(ga) * R * 0.28, kw = L.kind === 'dunkelfeste' ? 24 : 16, kh = S.keep;
  mg.add('box', M(kx, y0 + kh / 2 - 3, kz, kw, kh + 6, kw * 0.85, 0, -ga, 0), S.stone);
  mg.add('cone4', M(kx, y0 + kh, kz, kw * 0.72, kh * 0.55, kw * 0.62, 0, -ga + Math.PI / 4, 0), S.roof);
  mg.add('cyl6', M(kx, y0 + kh * 1.3, kz, 2.2, 10, 2.2), S.stone2);
  mg.add('cone6', M(kx, y0 + kh * 1.3 + 10, kz, 2.6, 26 + (L.kind === 'dunkelfeste' ? 30 : 0), 2.6), S.roof);
  for (let q = 0; q < 4; q++) { const u = (q & 1 ? 1 : -1) * kw * 0.5, v = (q & 2 ? 1 : -1) * kw * 0.42, c = Math.cos(ga), sn = Math.sin(ga); const px = kx + u * c - v * sn, pz = kz + u * sn + v * c, th = kh + 6 + r() * 10; mg.add('cyl6', M(px, y0, pz, 2.6, th, 2.6), S.stone); mg.add('cone6', M(px, y0 + th, pz, 2.8, 14, 2.8), S.roof); }
  for (let q = 0; q < 40; q++) gps.add(kx + (r() - 0.5) * kw, y0 + 8 + r() * (kh - 10), kz + (r() - 0.5) * kw, S.win, 0.9);
  g.add(new THREE.Mesh(mg.build(), MAT.landmark));
  g.add(new THREE.Points(gps.build(), MAT.landGlow));
  if (L.kind !== 'dunkelfeste') {
    const a = makeGlow(S.aura, L.kind === 'abendschloss' ? 230 : 160, L.kind === 'abendschloss' ? 0.28 : 0.18);
    a.material.fog = false; a.position.set(kx, y0 + 45, kz); g.add(a);
  } else {
    const a = makeGlow(0xff2010, 110, 0.14); a.material.fog = false; a.position.set(kx, y0 + kh * 0.8, kz); g.add(a);
  }
  reflectable(g);
  G.scene.add(g);
  return g;
}

// ---------- Der kniende Riese: ein gewaltiges Standbild ----------
function colossusParts(mg, L, r, moss) {
  const cx = L.x, cz = L.z, y0 = L.baseH, th = Math.PI / 2 - L.lakeAng;
  const cs = Math.cos(th), sn = Math.sin(th);
  const st = [0.43, 0.45, 0.43], dk = [0.3, 0.32, 0.31], hi = [0.52, 0.53, 0.5];
  // Teil im eigenen Koordinatensystem (z zeigt zum Tor) in die Welt setzen
  const P = (kind, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, c = st) => {
    const wx = cx + x * cs + z * sn, wz = cz - x * sn + z * cs;
    mg.add(kind, M(wx, y0 + y, wz, sx, sy, sz, rx, ry + th, rz), c, 0.12, r);
    if (moss && sy > 6) for (let q = 0; q < Math.min(90, sx * sz * 0.5); q++) moss(wx + (r() - 0.5) * sx, y0 + y + (r() - 0.2) * sy * 0.6, wz + (r() - 0.5) * sz);
  };
  const W = (x, z) => [cx + x * cs + z * sn, cz - x * sn + z * cs];
  // Sockel aus Trümmern
  for (let k = 0; k < 18; k++) { const a = r() * 6.283, d = 14 + r() * 14; P('ico', Math.cos(a) * d, 1, Math.sin(a) * d, 3 + r() * 5, 2 + r() * 3, 3 + r() * 5, r(), r() * 6, r(), dk); }
  // Beine: links aufgestellt, rechts kniend
  P('box', -6, 10, 14, 8, 22, 9, 0, 0, 0, st);
  P('box', -6, 23, 7, 9, 8, 17, 0.08, 0, 0, st);
  P('box', -6, 2, 17, 9, 4, 13, 0, 0, 0, dk);
  P('box', 6, 14, 2, 9, 22, 9, 0.35, 0, 0, st);
  P('box', 6, 4, -8, 8, 8, 22, 0, 0, 0, st);
  // Rumpf, Gürtel, Brustpanzer
  P('box', 0, 26, 0, 22, 6, 14, 0, 0, 0, dk);
  P('box', 0, 41, 1, 24, 26, 15, 0.08, 0, 0, st);
  P('box', 0, 44, 8.8, 14, 16, 2, 0.08, 0, 0, hi);
  // Umhang
  P('box', 0, 30, -9, 27, 44, 2.2, -0.16, 0, 0, dk);
  // Schultern (eine zerbrochen)
  P('ico', -15, 54, 0, 9, 7, 9, 0, 0, 0.2, hi);
  P('ico', 15, 52, 0, 7, 5, 8, 0.3, 0, -0.3, hi);
  // Arme stützen sich auf das Schwert
  P('box', -13, 44, 6, 6, 16, 6, 0.6, 0, 0.25, st);
  P('box', 13, 44, 6, 6, 16, 6, 0.6, 0, -0.25, st);
  P('box', -7, 35, 15, 5.5, 5.5, 14, 0.25, 0.5, 0, st);
  P('box', 7, 35, 15, 5.5, 5.5, 14, 0.25, -0.5, 0, st);
  P('ico', 0, 33, 21, 6, 5, 5, 0, 0, 0, st);
  // Helm mit Kamm, gesenkter Blick
  P('box', 0, 62, 3, 10, 12, 11, 0.35, 0, 0, st);
  P('box', 0, 61, 8.4, 7, 1.3, 1, 0.35, 0, 0, [0.04, 0.04, 0.05]);
  P('cone4', 0, 67, 1, 1.6, 9, 9, 0.2, 0, 0, dk);
  // Schwert im Boden
  P('box', 0, 13, 22, 3.6, 30, 1, 0, 0, 0, [0.5, 0.53, 0.58]);
  P('box', 0, 29, 22, 17, 1.8, 2.2, 0, 0, 0, hi);
  P('box', 0, 32, 22, 1.6, 5, 1.6, 0, 0, 0, dk);
  return { W, top: y0 + 72 };
}
function buildColossus(L, st) {
  const r = mulberry32(L.seed);
  const out = newBuilt(L);
  const mg = new Merger(), ps = new LeafSet(), gps = new PointSet();
  const moss = [[0.26, 0.38, 0.2], [0.18, 0.28, 0.15], [0.36, 0.5, 0.26]];
  const C = colossusParts(mg, L, r, (x, y, z) => ps.add(x, y, z, moss[Math.floor(r() * 3)], 0.8 + r() * 0.3));
  const y0 = L.baseH;
  // Ranken hängen vom Umhang und den Armen
  for (let k = 0; k < 40; k++) {
    const [x, z] = C.W((r() - 0.5) * 26, -10 + r() * 4);
    const top = y0 + 25 + r() * 25, len = 6 + r() * 16;
    for (let q = 0; q < len; q += 0.6) ps.add(x, top - q, z, moss[q % 3 > 1 ? 2 : 0], 0.9);
  }
  // Augen glimmen schwach
  for (const ex of [-2, 2]) { const [x, z] = C.W(ex, 8.6); gps.add(x, y0 + 61.4, z, [0.55, 0.8, 1], 1); }
  // Opfergaben und Kerzen am Schwert
  const [sx, sz] = C.W(0, 26);
  for (let q = 0; q < 14; q++) { const a = r() * 6.283, d = 2 + r() * 3; gps.add(sx + Math.cos(a) * d, y0 + 0.4, sz + Math.sin(a) * d, [1, 0.75, 0.4], 1); mg.add('cyl6', M(sx + Math.cos(a) * d, y0 - 0.1, sz + Math.sin(a) * d, 0.1, 0.5, 0.1), [0.9, 0.86, 0.75]); }
  out.interact.push({ kind: 'rest', x: sx, z: sz, r: 4, label: 'Dem Riesen zuhören' });
  const [kx, kz] = C.W(14, 20), key = L.key + ':c0';
  makeChest(out, key, kx, kz, Math.atan2(sx - kx, sz - kz), true, st.opened(key));
  // Kollision mit Beinen, Knie und Schwert
  for (const [lx, lz, rr] of [[-6, 14, 5.5], [-6, 18, 5], [6, 3, 5.5], [6, -8, 5], [6, -17, 4.5], [0, 22, 2.4], [0, -2, 8]]) { const [x, z] = C.W(lx, lz); circCollider(out, x, z, rr); }
  // Weisse Vögel kreisen um den Kopf
  const birds = new PointSet(), bd = [];
  const [hx, hz] = C.W(0, 3);
  for (let i = 0; i < 24; i++) { birds.add(0, 0, 0, [0.92, 0.92, 0.95]); bd.push([12 + Math.random() * 22, 0.2 + Math.random() * 0.3, Math.random() * 6.3, y0 + 55 + Math.random() * 25]); }
  const bg = birds.build(), bp = new THREE.Points(bg, pointsMat(0.7, { sway: 0, farMul: 3 }));
  bp.frustumCulled = false; out.group.add(bp);
  out.updaters.push(dt => {
    const a = bg.attributes.position.array, t = U.uTime.value;
    for (let i = 0; i < bd.length; i++) { const d = bd[i], an = d[2] + t * d[1]; a[i * 3] = hx + Math.cos(an) * d[0]; a[i * 3 + 1] = d[3] + Math.sin(t * 1.5 + i) * 1.5; a[i * 3 + 2] = hz + Math.sin(an) * d[0]; }
    bg.attributes.position.needsUpdate = true;
    updateChests(out, dt);
  });
  risingMotes(out, 50, sx, y0, sz, 6, 14, [[1, 0.8, 0.5], [0.8, 0.9, 1]], 0.7, 0.35);
  out.group.add(new THREE.Mesh(mg.build(), MAT.landmark));
  out.group.add(leafObj(ps));
  out.group.add(new THREE.Points(gps.build(), MAT.landGlow));
  reflectable(out.group);
  return out;
}
function buildColossusImpostor(L) {
  const r = mulberry32(L.seed), mg = new Merger(), g = new THREE.Group();
  colossusParts(mg, L, r, null);
  g.add(new THREE.Mesh(mg.build(), MAT.landmark));
  reflectable(g); G.scene.add(g);
  return g;
}
