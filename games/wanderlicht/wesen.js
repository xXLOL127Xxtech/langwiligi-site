'use strict';
// Wanderlicht – Wesen: Spielfigur, Händler, Gegner, Bosse und Beute

const WEAPONS = [
  { name: 'Wanderstab', dmg: 8, price: 0, col: [0.48, 0.34, 0.22], len: 1.35, kind: 'stab' },
  { name: 'Kurzschwert', dmg: 14, price: 60, col: [0.74, 0.77, 0.84], len: 0.9, kind: 'schwert' },
  { name: 'Silberklinge', dmg: 22, price: 180, col: [0.9, 0.92, 1.0], len: 1.1, kind: 'schwert' },
  { name: 'Mondsichel', dmg: 33, price: 420, col: [0.66, 0.74, 1.0], len: 1.1, kind: 'sichel', glow: 0x8fa4ff },
  { name: 'Dämmerklinge', dmg: 46, price: 900, col: [0.86, 0.56, 0.96], len: 1.25, kind: 'schwert', glow: 0xc88cff },
  { name: 'Sternenklinge', dmg: 64, price: 1800, col: [1.0, 0.93, 0.7], len: 1.4, kind: 'schwert', glow: 0xfff0b0 },
];
const ARMORS = [
  { name: 'Wandermantel', def: 0, price: 0, col: [0.22, 0.24, 0.46] },
  { name: 'Lederweste', def: 0.15, price: 80, col: [0.46, 0.32, 0.24] },
  { name: 'Kettenhemd', def: 0.28, price: 240, col: [0.46, 0.5, 0.58] },
  { name: 'Mondharnisch', def: 0.4, price: 560, col: [0.34, 0.42, 0.74] },
  { name: 'Sternenmantel', def: 0.52, price: 1200, col: [0.62, 0.46, 0.84] },
];

// ---------- Schatten unter Figuren ----------
let SHADOW_GEO = null, SHADOW_MAT = null;
function makeShadow(r) {
  if (!SHADOW_GEO) {
    SHADOW_GEO = new THREE.CircleGeometry(1, 10); SHADOW_GEO.rotateX(-Math.PI / 2); SHADOW_GEO.userData.keep = true;
    SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  }
  const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  m.scale.set(r, 1, r); m.renderOrder = 1;
  return m;
}

// ---------- Spielfigur ----------
const SKIN = [0.96, 0.8, 0.68];
function addMesh(parent, mg, shadow = true) {
  const m = new THREE.Mesh(mg.build(), MAT.flat);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function makeWeaponMesh(tier) {
  const W = WEAPONS[tier], mg = new Merger();
  const hilt = [0.3, 0.2, 0.14], guard = [0.8, 0.66, 0.32];
  const r = mulberry32(5 + tier);
  if (W.kind === 'stab') {
    tube(mg, [[0, -0.35, 0], [0.01, 0.4, 0], [0, W.len * 0.9, 0.01], [-0.02, W.len + 0.05, 0.03]], [0.035, 0.032, 0.03, 0.04], W.col, 8, MT.wood, null, r);
    mg.add('sph', M(0, W.len + 0.14, 0.03, 0.09, 0.11, 0.09), [0.7, 0.55, 0.95], 0, r, MT.emit);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; mg.add('cone', M(Math.cos(a) * 0.07, W.len - 0.02, Math.sin(a) * 0.07 + 0.03, 0.02, 0.18, 0.02, 0.4 * Math.cos(a), 0, 0.4 * Math.sin(a)), [0.4, 0.3, 0.2], 0, r, MT.wood); }
  } else {
    mg.add('cyl6', M(0, -0.22, 0, 0.032, 0.3, 0.032), hilt, 0, r, MT.wood);
    for (let q = 0; q < 4; q++) mg.add('torus', M(0, -0.2 + q * 0.07, 0, 0.034, 0.034, 0.05, Math.PI / 2, 0, 0), [0.15, 0.1, 0.08], 0, r, MT.metal);
    mg.add('sph', M(0, -0.25, 0, 0.05, 0.05, 0.05), guard, 0, r, MT.gold);
    mg.add('box', M(0, 0.1, 0, 0.34, 0.05, 0.07), guard, 0, r, MT.gold);
    mg.add('sph', M(0.17, 0.1, 0, 0.04, 0.04, 0.04), guard, 0, r, MT.gold);
    mg.add('sph', M(-0.17, 0.1, 0, 0.04, 0.04, 0.04), guard, 0, r, MT.gold);
    if (W.kind === 'sichel') {
      const pts = [], rads = [];
      for (let i = 0; i <= 12; i++) { const a = i / 12 * 1.5; pts.push([0, 0.15 + Math.sin(a) * 0.62, Math.cos(a) * 0.4 - 0.4]); rads.push(0.045 * (1 - 0.6 * i / 12) + 0.01); }
      tube(mg, pts, rads, W.col, 8, MT.metal, null, r);
    } else {
      mg.add('box', M(0, 0.13 + W.len / 2, 0, 0.1, W.len, 0.022), W.col, 0, r, MT.metal);
      mg.add('box', M(0, 0.13 + W.len / 2, 0, 0.03, W.len * 0.96, 0.034), W.col.map(v => v * 0.8), 0, r, MT.metal);
      mg.add('cone4', M(0, 0.13 + W.len, 0, 0.073, 0.2, 0.016, 0, Math.PI / 4, 0), W.col, 0, r, MT.metal);
    }
  }
  const g = new THREE.Group();
  addMesh(g, mg);
  if (W.glow) { const s = makeGlow(W.glow, 1.1, 0.5); s.position.y = 0.25 + W.len * 0.6; g.add(s); }
  return g;
}

function makePlayerModel(armorTier) {
  const g = new THREE.Group();
  const root = new THREE.Group();   // Figur ohne Schatten (für Besen-Neigung)
  g.add(root);
  const parts = { root, phase: 0, blink: 3, flap: 0 };
  const hips = new THREE.Group(); hips.position.y = 0.78; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);   // dreht und neigt sich
  parts.hips = hips; parts.body = torso; parts.torso = torso;
  const mk = (par, x, y, z) => { const gr = new THREE.Group(); gr.position.set(x, y, z); par.add(gr); return gr; };

  // Beine
  const skin = SKIN, boot = [0.2, 0.13, 0.1], pants = [0.2, 0.18, 0.26];
  parts.legs = [];
  for (const sd of [-1, 1]) {
    const hip = mk(hips, sd * 0.13, 0, 0), knee = mk(hip, 0, -0.38, 0);
    const lm = new Merger(); tube(lm, [[0, 0, 0], [0, -0.2, 0.01], [0, -0.38, 0]], [0.085, 0.075, 0.065], pants, 8, MT.cloth, null, Math.random);
    addMesh(hip, lm);
    const sm = new Merger(); tube(sm, [[0, 0, 0], [0, -0.2, 0], [0, -0.4, 0]], [0.065, 0.06, 0.07], boot, 8, MT.cloth, null, Math.random);
    sm.add('sph', M(0, -0.45, 0.07, 0.075, 0.055, 0.14), boot.map(v => v * 0.85), 0, Math.random, MT.cloth);
    sm.add('sph', M(0, -0.4, -0.02, 0.085, 0.09, 0.085), boot, 0, Math.random, MT.cloth);
    addMesh(knee, sm);
    parts.legs.push({ hip, knee, sd });
  }

  // Körper
  const buildBody = tier => {
    if (parts.bodyGrp) { torso.remove(parts.bodyGrp); disposeObj(parts.bodyGrp); }
    const A = ARMORS[tier], bg = new THREE.Group(); torso.add(bg); parts.bodyGrp = bg;
    const mg = new Merger(), r = mulberry32(3);
    const rob = A.col, rob2 = rob.map(v => Math.min(1, v * 1.2)), rob3 = rob.map(v => v * 0.8);
    // langer Umhang-Rock
    tube(mg, [[0, -0.36, 0], [0, -0.2, 0], [0, 0.05, 0], [0, 0.3, 0], [0, 0.52, 0]], [0.46, 0.4, 0.3, 0.26, 0.23], rob3, 16, MT.cloth, rob, r);
    tube(mg, [[0, 0.5, 0], [0, 0.64, 0], [0, 0.72, 0]], [0.23, 0.29, 0.22], rob, 16, MT.cloth, rob2, r);
    mg.add('torus', M(0, 0.12, 0, 0.29, 0.29, 0.3, Math.PI / 2, 0, 0), [0.45, 0.3, 0.16], 0, r, MT.wood);
    mg.add('box', M(0, 0.12, 0.29, 0.1, 0.085, 0.03), [0.85, 0.7, 0.3], 0, r, MT.gold);
    mg.add('cyl', M(0, 0.7, 0, 0.17, 0.12, 0.17), [0.9, 0.9, 0.95], 0, r, MT.cloth);  // Kragen
    // Tasche
    mg.add('box', M(-0.22, 0.04, 0.15, 0.16, 0.2, 0.08, 0, 0.5, 0), [0.4, 0.3, 0.2], 0, r, MT.wood);
    if (tier >= 2) { for (const sd of [-1, 1]) mg.add('sph', M(0.28 * sd, 0.68, 0, 0.17, 0.1, 0.19), rob2.map(v => v * 1.2), 0, r, MT.metal); mg.add('box', M(0, 0.32, 0.2, 0.34, 0.4, 0.06), rob2.map(v => v * 1.1), 0, r, MT.metal); }
    if (tier >= 4) for (let q = 0; q < 6; q++) mg.add('oct', M((q - 2.5) * 0.08, 0.64, 0.21, 0.03, 0.05, 0.02), [1, 0.9, 0.5], 0, r, MT.emit);
    addMesh(bg, mg);
  };
  buildBody(armorTier);
  parts.setArmor = buildBody;

  // Kopf mit Hut
  const neck = mk(torso, 0, 0.78, 0); parts.head = neck;
  const hm = new Merger(), hr = mulberry32(9);
  hm.add('sph', M(0, 0.17, 0, 0.19, 0.2, 0.2), skin, 0, hr, MT.gen);
  hm.add('sph', M(0, 0.15, 0.185, 0.035, 0.05, 0.04), skin.map(v => v * 0.95), 0, hr, MT.gen);  // Nase
  for (const sd of [-1, 1]) {
    hm.add('sph', M(0.075 * sd, 0.2, 0.165, 0.038, 0.045, 0.03), [0.97, 0.97, 1], 0, hr, MT.gen);
    hm.add('sph', M(0.075 * sd, 0.2, 0.185, 0.02, 0.028, 0.015), [0.08, 0.06, 0.1], 0, hr, MT.gen);
    hm.add('sph', M(0.1 * sd, 0.12, 0.15, 0.04, 0.03, 0.02), [0.98, 0.65, 0.6], 0, hr, MT.gen);
    hm.add('box', M(0.075 * sd, 0.245, 0.17, 0.07, 0.012, 0.015, 0, 0, 0.15 * sd), [0.25, 0.15, 0.1], 0, hr, MT.gen);
  }
  hm.add('box', M(0, 0.09, 0.18, 0.06, 0.012, 0.012), [0.7, 0.3, 0.3], 0, hr, MT.gen);
  // Haare
  hm.add('sph', M(0, 0.2, -0.06, 0.2, 0.19, 0.17), [0.35, 0.2, 0.14], 0, hr, MT.gen);
  for (const sd of [-1, 1]) hm.add('sph', M(0.17 * sd, 0.12, -0.02, 0.06, 0.12, 0.08), [0.35, 0.2, 0.14], 0, hr, MT.gen);
  // Hut: breite Krempe, geneigte Spitze
  const hat = [0.17, 0.15, 0.3], hatL = hat.map(v => Math.min(1, v * 1.3));
  hm.add('cyl', M(0, 0.3, 0, 0.5, 0.035, 0.5), hat, 0, hr, MT.cloth);
  hm.add('torus', M(0, 0.32, 0, 0.5, 0.5, 0.5, Math.PI / 2, 0, 0), hat, 0, hr, MT.cloth);
  tube(hm, [[0, 0.3, 0], [0, 0.55, -0.02], [-0.04, 0.82, -0.12], [-0.1, 1.02, -0.3], [-0.12, 1.08, -0.5]], [0.25, 0.2, 0.14, 0.08, 0.02], hat, 14, MT.cloth, hatL, hr);
  hm.add('cyl', M(0, 0.33, 0, 0.255, 0.07, 0.255), [0.78, 0.3, 0.42], 0, hr, MT.cloth);
  hm.add('box', M(0, 0.36, 0.25, 0.08, 0.08, 0.02), [0.9, 0.75, 0.3], 0, hr, MT.gold);
  addMesh(neck, hm);
  parts.hatTip = null;

  // Arme
  parts.arms = [];
  const armCol = ARMORS[armorTier].col;
  for (const sd of [-1, 1]) {
    const sh = mk(torso, sd * 0.31, 0.7, 0), el = mk(sh, 0, -0.3, 0);
    const am = new Merger(), ar = mulberry32(12 + sd);
    const sleeve = armCol.map(v => v * 1.05);
    tube(am, [[0, 0.03, 0], [0, -0.15, 0], [0, -0.3, 0]], [0.1, 0.095, 0.1], sleeve, 10, MT.cloth, null, ar);
    addMesh(sh, am);
    const fm = new Merger();
    tube(fm, [[0, 0, 0], [0, -0.14, 0.01], [0, -0.28, 0.02]], [0.1, 0.12, 0.13], sleeve.map(v => v * 0.92), 10, MT.cloth, null, ar);
    fm.add('sph', M(0, -0.34, 0.03, 0.065, 0.07, 0.065), skin, 0, ar, MT.gen);
    addMesh(el, fm);
    const hand = mk(el, 0, -0.34, 0.03);
    parts.arms.push({ sh, el, hand, sd });
  }
  // Waffe in der rechten Hand (Figur-Rechte = x negativ)
  const handR = parts.arms[0].hand, handL = parts.arms[1].hand;
  const pivot = new THREE.Group(); handR.add(pivot); parts.pivot = pivot;
  parts.setWeapon = tier => {
    if (parts.weapon) { pivot.remove(parts.weapon); disposeObj(parts.weapon); }
    parts.weapon = makeWeaponMesh(tier);
    parts.weapon.rotation.x = 1.45;
    pivot.add(parts.weapon);
  };
  // Laterne in der linken Hand
  const lan = new THREE.Group(); handL.add(lan);
  const lmg = new Merger(), lr = mulberry32(2);
  lmg.add('cyl6', M(0, -0.22, 0, 0.012, 0.22, 0.012), [0.3, 0.3, 0.32], 0, lr, MT.metal);
  lmg.add('cyl', M(0, -0.28, 0, 0.07, 0.015, 0.07), [0.25, 0.22, 0.2], 0, lr, MT.metal);
  lmg.add('cyl', M(0, -0.265, 0, 0.055, 0.17, 0.055), [1, 0.85, 0.55], 0, lr, MT.emit);
  lmg.add('cone', M(0, -0.095, 0, 0.085, 0.07, 0.085), [0.2, 0.18, 0.22], 0, lr, MT.metal);
  lmg.add('torus', M(0, -0.03, 0, 0.04, 0.04, 0.05), [0.3, 0.3, 0.32], 0, lr, MT.metal);
  addMesh(lan, lmg, false);
  lan.position.set(0, -0.02, 0.02);
  parts.lantern = lan;
  parts.lanGlow = makeGlow(0xffb060, 1.7, 0.8); parts.lanGlow.position.set(0, -0.2, 0); lan.add(parts.lanGlow);

  // Schal mit wehenden Enden
  const scarf = mk(torso, 0, 0.7, 0);
  const sm = new Merger(), sr = mulberry32(4), sc = [0.88, 0.3, 0.4];
  sm.add('torus', M(0, 0, 0, 0.2, 0.2, 0.22, Math.PI / 2, 0, 0), sc, 0, sr, MT.cloth);
  sm.add('sph', M(0.12, -0.04, 0.12, 0.09, 0.09, 0.09), sc, 0, sr, MT.cloth);
  addMesh(scarf, sm);
  parts.scarfSegs = [];
  let par = mk(scarf, 0.09, -0.02, -0.16);
  parts.scarfTail = par;
  for (let i = 0; i < 4; i++) {
    const seg = i === 0 ? par : mk(par, 0, 0, -0.2);
    const gm = new Merger();
    gm.add('box', M(0, 0, -0.1, 0.12, 0.035, 0.22), sc.map(v => v * (1 - i * 0.05)), 0, sr, MT.cloth);
    addMesh(seg, gm, false);
    parts.scarfSegs.push(seg);
    par = seg;
  }
  // Mantel hinten (flatternd)
  parts.cape = [];
  let cp = mk(torso, 0, 0.62, -0.2);
  for (let i = 0; i < 3; i++) {
    const seg = i === 0 ? cp : mk(cp, 0, -0.3, 0);
    const cm = new Merger();
    cm.add('box', M(0, -0.15, -0.02, 0.44 - i * 0.03, 0.34, 0.035), ARMORS[armorTier].col.map(v => v * (0.72 - i * 0.04)), 0, sr, MT.cloth);
    addMesh(seg, cm, false);
    parts.cape.push(seg);
    cp = seg;
  }

  // Besen
  const broom = new THREE.Group(); broom.visible = false; root.add(broom);
  const bm = new Merger(), br = mulberry32(21);
  tube(bm, [[0, 0, -0.9], [0, 0, 0], [0, 0.02, 0.9], [0, 0.07, 1.25]], [0.03, 0.03, 0.028, 0.026], [0.5, 0.34, 0.2], 8, MT.wood, null, br);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * 6.2832 + br() * 0.3, rr = 0.03 + br() * 0.07;
    tube(bm, [[0, 0, -0.9], [Math.cos(a) * rr, Math.sin(a) * rr, -1.0], [Math.cos(a) * rr * 2.6, Math.sin(a) * rr * 2.6, -1.35 - br() * 0.2]], [0.025, 0.018, 0.004], [0.74 + br() * 0.1, 0.58, 0.3], 4, MT.cloth, [0.55, 0.4, 0.2], br);
  }
  bm.add('torus', M(0, 0, -0.95, 0.07, 0.07, 0.08, 0, 0, 0), [0.35, 0.22, 0.14], 0, br, MT.wood);
  bm.add('torus', M(0, 0, 0.3, 0.035, 0.035, 0.04), [0.35, 0.22, 0.14], 0, br, MT.wood);
  addMesh(broom, bm);
  const bglow = makeGlow(0xffd080, 1.8, 0.5); bglow.position.set(0, 0, -1.4); broom.add(bglow);
  parts.broom = broom; parts.broomGlow = bglow;

  parts.shadow = makeShadow(0.5); g.add(parts.shadow);
  g.userData.parts = parts;
  return g;
}

// Bewegungen: Atmen, Gehen, Rennen, Springen, Schlagen, Schwimmen, Rasten und Besenflug
const _ease = (a, b, k) => a + (b - a) * k;
function animatePlayer(dt, st) {
  const parts = playerModel.userData.parts, t = U.uTime.value;
  const k = Math.min(1, dt * 12), kk = Math.min(1, dt * 7);
  const mv = st.moving, sp = st.sprint ? 1.45 : 1;
  parts.phase += dt * (6.5 + mv * 4.5) * sp * (mv > 0.05 ? 1 : 0.2);
  const ph = parts.phase;
  const wind = U.uWindDir.value, ws = U.uWind.value;
  const root = parts.root, hips = parts.hips, torso = parts.torso;
  if (parts.shadow) parts.shadow.visible = !st.broom;
  const air = !st.onGround && !st.swim && !st.broom;
  let legSw = Math.sin(ph) * 0.8 * Math.min(1, mv * 1.2), legSw2 = -legSw;
  let knee1 = Math.max(0, -Math.sin(ph + 0.9)) * 0.9 * Math.min(1, mv * 1.3), knee2 = Math.max(0, Math.sin(ph + 0.9)) * 0.9 * Math.min(1, mv * 1.3);
  let armSw = Math.sin(ph) * 0.65 * Math.min(1, mv * 1.2);
  let lean = mv * 0.12 * sp, bob = mv > 0.1 ? Math.abs(Math.cos(ph)) * 0.07 * Math.min(1, mv) : 0;
  let hipsY = 0.78 + Math.sin(t * 1.6) * 0.006 * (1 - mv);
  let rootRx = 0, rootY = 0, twist = 0;
  const L = parts.legs, A = parts.arms;
  // Ziel-Haltungen
  const tg = { l0x: legSw, l1x: legSw2, k0: knee1, k1: knee2, a0x: -armSw, a1x: armSw, a0z: 0.08, a1z: -0.08, e0: 0.15, e1: 0.15, tx: lean, ty: twist, hx: 0, hipsY: hipsY + bob, rootY, rootRx, hd: 0 };
  // rechter Arm trägt die Waffe: nur leicht schwingen
  tg.a0x = -armSw * 0.5 - 0.1; tg.e0 = 0.45;
  if (air) {
    tg.l0x = -0.5 + st.vy * 0.02; tg.l1x = 0.3 + st.vy * 0.02; tg.k0 = 0.7; tg.k1 = 0.4; tg.a0x = -2.3; tg.a1x = -2.0; tg.a0z = 0.5; tg.a1z = -0.5; tg.e0 = 0.4; tg.e1 = 0.4; tg.tx = st.vy > 0 ? -0.05 : 0.12;
  }
  if (st.swim) {
    const sw = Math.sin(t * 4);
    tg.l0x = sw * 0.45; tg.l1x = -sw * 0.45; tg.k0 = 0.2; tg.k1 = 0.2; tg.a0x = -1.1 - sw * 0.9; tg.a1x = -1.1 + sw * 0.9; tg.tx = 0.35; tg.hipsY = 0.62; tg.e0 = 0.5; tg.e1 = 0.5;
  }
  if (st.resting) { tg.hipsY = 0.62; tg.l0x = -1.2; tg.l1x = -1.2; tg.k0 = 1.3; tg.k1 = 1.3; tg.a0x = -0.5; tg.a1x = -0.5; tg.tx = 0.15; }
  if (st.broom) {
    const bank = st.bank || 0;
    tg.hipsY = 0.62; tg.l0x = -0.95; tg.l1x = -0.55; tg.k0 = 0.45; tg.k1 = 0.9; tg.a0x = -0.2; tg.a1x = -1.35; tg.a0z = 0.45; tg.a1z = -0.05; tg.e0 = 0.9; tg.e1 = 0.3; tg.tx = -0.18; tg.ty = 0;
    tg.rootRx = clamp(-st.vy * 0.045, -0.6, 0.6) + 0.05; tg.rootY = 0.58 + Math.sin(t * 2.2) * 0.04;
    root.rotation.z += (bank - root.rotation.z) * k;
  } else root.rotation.z += (0 - root.rotation.z) * k;
  // Angriff überschreibt den rechten Arm
  let atk = null;
  if (st.atkT > 0) {
    const p = 1 - st.atkT / 0.34;
    const wind1 = p < 0.3 ? p / 0.3 : 1, swing = p < 0.3 ? 0 : Math.min(1, (p - 0.3) / 0.35);
    atk = { x: p < 0.3 ? _ease(-0.5, -2.7, wind1) : _ease(-2.7, 0.6, swing), z: p < 0.3 ? 0.35 : _ease(0.35, -0.5, swing), el: p < 0.3 ? 1.0 : _ease(1.0, 0.1, swing), twist: p < 0.3 ? -0.5 * wind1 : _ease(-0.5, 0.7, swing), lean: 0.15 + swing * 0.2 };
  }
  const setR = (o, key, v) => { o.rotation[key] += (v - o.rotation[key]) * k; };
  setR(L[0].hip, 'x', tg.l0x); setR(L[1].hip, 'x', tg.l1x);
  setR(L[0].knee, 'x', tg.k0); setR(L[1].knee, 'x', tg.k1);
  setR(A[1].sh, 'x', tg.a1x); setR(A[1].sh, 'z', -Math.abs(tg.a1z) - 0.08); setR(A[1].el, 'x', -tg.e1);
  if (atk) { setR(A[0].sh, 'x', atk.x); setR(A[0].sh, 'z', atk.z); setR(A[0].el, 'x', -atk.el); tg.ty = atk.twist; tg.tx = atk.lean; }
  else { setR(A[0].sh, 'x', tg.a0x); setR(A[0].sh, 'z', Math.abs(tg.a0z) + 0.08); setR(A[0].el, 'x', -tg.e0); }
  setR(torso, 'x', tg.tx); setR(torso, 'y', tg.ty);
  hips.position.y += (tg.hipsY - hips.position.y) * k;
  root.position.y += (tg.rootY - root.position.y) * kk;
  setR(root, 'x', tg.rootRx);
  // Atmen und Kopf
  parts.head.rotation.x = Math.sin(t * 1.6) * 0.02 - tg.tx * 0.5 + (st.broom ? 0.1 : 0);
  parts.head.rotation.y += ((st.lookY || 0) - parts.head.rotation.y) * kk;
  // Hut-Wippen, Schal und Mantel im Wind
  const windA = Math.atan2(-wind.y, wind.x);
  const sp2 = Math.min(1, mv + (st.broom ? 1.2 : 0));
  parts.scarfSegs.forEach((s, i) => {
    s.rotation.x = -0.2 - sp2 * 0.35 + Math.sin(t * 7 - i * 0.9) * 0.12 * (0.3 + sp2 + ws * 0.2) + (air ? 0.35 : 0) + (st.broom ? -0.15 : 0);
    s.rotation.y = Math.sin(t * 2.7 - i * 0.8) * (0.18 + ws * 0.1) + Math.sin(windA) * 0.05;
  });
  parts.cape.forEach((s, i) => {
    s.rotation.x = 0.15 + sp2 * 0.4 + Math.sin(t * 5 - i * 1.1) * 0.08 * (0.4 + sp2);
    s.rotation.z = Math.sin(t * 2 - i) * 0.05;
  });
  parts.lantern.rotation.x = Math.sin(t * 3.4) * 0.12 * (0.4 + mv) + (st.broom ? 0.7 : 0);
  parts.lantern.rotation.z = Math.sin(t * 2.3) * 0.08;
  parts.lanGlow.material.opacity = 0.2 + ATM.night * 0.75;
  parts.broom.visible = !!st.broom;
  if (st.broom) { parts.broom.position.set(0, 0.45, 0.1); parts.broomGlow.material.opacity = 0.35 + Math.sin(t * 9) * 0.1; }
}

// ---------- Gelenkige Figuren: Bausteine ----------
function jnt(par, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; }
// Kette aus Gliedern, die nach unten hängen (Arme, Beine, Tentakel); gibt die Gelenke zurück
function jchain(par, pos, lens, rads, col, mt = MT.cloth, seg = 8, shadow = true) {
  const joints = []; let p = par;
  lens.forEach((len, i) => {
    const j = jnt(p, i ? 0 : pos[0], i ? -lens[i - 1] : pos[1], i ? 0 : pos[2]);
    const mg = new Merger();
    tube(mg, [[0, 0, 0], [0, -len * 0.5, 0], [0, -len, 0]], [rads[i], (rads[i] + rads[i + 1]) * 0.5 * 1.04, rads[i + 1]], col, seg, mt, null, Math.random);
    addMesh(j, mg, shadow);
    joints.push(j); p = j;
  });
  return joints;
}
const HAIRS = [[0.35, 0.22, 0.14], [0.15, 0.12, 0.1], [0.75, 0.55, 0.25], [0.85, 0.85, 0.88], [0.55, 0.2, 0.12]];
const SKINS = [[0.96, 0.8, 0.68], [0.8, 0.62, 0.48], [0.6, 0.44, 0.34], [0.93, 0.76, 0.64]];

// Mensch (Händler, Wanderer, Ritter, Zwerge)
function buildHumanoid(o) {
  const r = mulberry32(o.seed || 1);
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const sc = o.scale || 1;
  body.scale.setScalar(sc);
  const skin = o.skin || pick(r, SKINS), hair = o.hair || pick(r, HAIRS);
  const cloth = o.robe || pick(r, [[0.55, 0.3, 0.32], [0.3, 0.42, 0.36], [0.6, 0.5, 0.3], [0.32, 0.3, 0.5], [0.5, 0.4, 0.55]]);
  const cloth2 = cloth.map(v => Math.min(1, v * 1.2)), cloth3 = cloth.map(v => v * 0.75);
  const mt = o.armor ? MT.metal : MT.cloth;
  const P = { body };
  const dw = o.dwarf ? 0.78 : 1;
  const legLen = o.sitting ? 0.4 : 0.42 * dw;
  const hipY = (o.dwarf ? 0.5 : 0.82) * (o.legs === false ? 0.6 : 1);
  const hips = jnt(body, 0, hipY, 0); P.hips = hips;
  P.legs = [];
  if (o.legs !== false) {
    for (const sd of [-1, 1]) {
      const [h, k] = jchain(hips, [sd * 0.12, 0, 0], [legLen, legLen], [0.085, 0.07, 0.06], o.armor ? o.armor : [0.22, 0.18, 0.2], o.armor ? MT.metal : MT.cloth, 8);
      const fm = new Merger(); fm.add('sph', M(0, -legLen - 0.03, 0.06, 0.075, 0.055, 0.13), [0.2, 0.13, 0.1], 0, r, MT.cloth);
      addMesh(k, fm);
      P.legs.push({ hip: h, knee: k, sd });
    }
  }
  const torso = jnt(hips, 0, 0, 0); P.torso = torso;
  // Rumpf / Robe
  const tm = new Merger();
  const H = o.dwarf ? 0.62 : 0.72;
  if (o.armor) {
    tube(tm, [[0, -0.1, 0], [0, 0.18, 0], [0, 0.45, 0], [0, 0.72, 0]], [0.3, 0.25, 0.28, 0.2], o.armor.map(v => v * 0.85), 14, MT.metal, o.armor, r);
    tm.add('sph', M(0, 0.42, 0.06, 0.28, 0.24, 0.22), o.armor, 0, r, MT.metal);
    tm.add('box', M(0, 0.09, 0, 0.5, 0.13, 0.36), cloth, 0, r, MT.cloth);
    // Rock
    tube(tm, [[0, -0.28, 0], [0, -0.1, 0], [0, 0.1, 0]], [0.42, 0.36, 0.27], cloth, 14, MT.cloth, cloth3, r);
  } else {
    tube(tm, [[0, o.dwarf ? -0.02 : -0.36, 0], [0, 0.0, 0], [0, 0.3, 0], [0, 0.55, 0], [0, H, 0]], [o.dwarf ? 0.3 : 0.44, o.dwarf ? 0.3 : 0.34, 0.3, 0.26, 0.2], cloth3, 14, MT.cloth, cloth, r);
    tm.add('torus', M(0, 0.18, 0, 0.29, 0.29, 0.3, Math.PI / 2, 0, 0), [0.4, 0.28, 0.16], 0, r, MT.wood);
  }
  if (o.pack) { tm.add('box', M(0, 0.4, -0.3, 0.46, 0.55, 0.28), [0.45, 0.32, 0.22], 0.08, r, MT.cloth); tm.add('cyl', M(0, 0.7, -0.3, 0.2, 0.3, 0.2, 0, 0, Math.PI / 2), [0.4, 0.38, 0.4], 0, r, MT.cloth); }
  if (o.cape) tm.add('box', M(0, 0.25, -0.24, 0.55, 0.95, 0.05), o.cape, 0, r, MT.cloth);
  addMesh(torso, tm);
  // Kopf
  const head = jnt(torso, 0, H + 0.05, 0); P.head = head;
  const hm = new Merger();
  const hs = o.dwarf ? 1.15 : 1;
  hm.add('sph', M(0, 0.15, 0, 0.18 * hs, 0.19 * hs, 0.19 * hs), skin, 0, r, MT.gen);
  hm.add('sph', M(0, 0.13, 0.17 * hs, 0.035 * hs, 0.05 * hs, 0.04), skin.map(v => v * 0.93), 0, r, MT.gen);
  for (const sd of [-1, 1]) {
    hm.add('sph', M(0.07 * sd, 0.18, 0.15 * hs, 0.032, 0.036, 0.025), [0.97, 0.97, 1], 0, r, MT.gen);
    hm.add('sph', M(0.07 * sd, 0.18, 0.168 * hs, 0.017, 0.022, 0.012), [0.08, 0.06, 0.1], 0, r, MT.gen);
  }
  if (!o.helm) hm.add('sph', M(0, 0.2, -0.05, 0.19 * hs, 0.17 * hs, 0.16 * hs), hair, 0, r, MT.gen);
  if (o.beard) { tube(hm, [[0, 0.08, 0.14 * hs], [0, -0.05, 0.16 * hs], [0, -0.2, 0.12 * hs]], [0.12, 0.1, 0.02], o.beard, 8, MT.gen, null, r); hm.add('sph', M(0, 0.09, 0.17 * hs, 0.08, 0.025, 0.04), o.beard, 0, r, MT.gen); }
  if (o.hat === 'wide') {
    const hc = o.hatCol || cloth3;
    hm.add('cyl', M(0, 0.27, 0, 0.5, 0.03, 0.5), hc, 0, r, MT.cloth);
    tube(hm, [[0, 0.27, 0], [0, 0.4, 0], [0, 0.5, 0]], [0.24, 0.2, 0.18], hc, 12, MT.cloth, null, r);
    hm.add('cyl', M(0, 0.3, 0, 0.255, 0.06, 0.255), cloth, 0, r, MT.cloth);
  } else if (o.hat === 'cone') {
    const hc = o.hatCol || cloth3;
    hm.add('cyl', M(0, 0.26, 0, 0.36, 0.03, 0.36), hc, 0, r, MT.cloth);
    tube(hm, [[0, 0.26, 0], [0, 0.45, -0.03], [-0.04, 0.68, -0.12], [-0.06, 0.78, -0.26]], [0.2, 0.15, 0.08, 0.015], hc, 12, MT.cloth, null, r);
  } else if (o.hat === 'hood') {
    tube(hm, [[0, 0.0, -0.04], [0, 0.22, -0.03], [0, 0.34, -0.06], [0, 0.4, -0.18]], [0.22, 0.23, 0.17, 0.02], cloth3, 12, MT.cloth, null, r);
  } else if (o.hat === 'dwarf') {
    hm.add('sph', M(0, 0.24, 0, 0.23, 0.17, 0.23), [0.55, 0.55, 0.58], 0, r, MT.metal);
    hm.add('box', M(0, 0.2, 0.2, 0.05, 0.14, 0.03), [0.5, 0.5, 0.52], 0, r, MT.metal);
    hm.add('cyl6', M(0, 0.3, 0.2, 0.05, 0.05, 0.05), [1, 0.85, 0.4], 0, r, MT.emit);
  }
  if (o.helm) {
    const hc = o.armor || [0.6, 0.62, 0.68];
    hm.add('sph', M(0, 0.18, -0.01, 0.215, 0.23, 0.215), hc, 0, r, MT.metal);
    hm.add('box', M(0, 0.2, 0.185, 0.3, 0.05, 0.05), [0.05, 0.05, 0.08], 0, r, MT.gen);
    hm.add('box', M(0, 0.12, 0.2, 0.03, 0.22, 0.03), [0.05, 0.05, 0.08], 0, r, MT.gen);
    if (o.plume) tube(hm, [[0, 0.38, 0], [0, 0.5, -0.1], [0, 0.46, -0.28], [0, 0.3, -0.4]], [0.02, 0.07, 0.06, 0.02], o.plume, 8, MT.cloth, null, r);
  }
  addMesh(head, hm);
  // Arme
  P.arms = [];
  for (const sd of [-1, 1]) {
    const arm = jchain(torso, [sd * (o.dwarf ? 0.31 : 0.3), H - 0.04, 0], [0.3 * dw, 0.28 * dw], [0.075, 0.062, 0.055], o.armor ? o.armor : cloth, mt, 8);
    const hand = jnt(arm[1], 0, -0.28 * dw, 0.02);
    const hmm = new Merger(); hmm.add('sph', M(0, -0.03, 0, 0.06, 0.065, 0.06), o.armor ? o.armor.map(v => v * 0.9) : skin, 0, r, o.armor ? MT.metal : MT.gen);
    addMesh(hand, hmm);
    if (o.armor) { const pm = new Merger(); pm.add('sph', M(0, 0.02, 0, 0.12, 0.08, 0.13), o.armor, 0, r, MT.metal); addMesh(arm[0], pm); }
    P.arms.push({ sh: arm[0], el: arm[1], hand, sd });
  }
  // Ausrüstung
  if (o.staff) { const sm = new Merger(); tube(sm, [[0, -0.9, 0], [0, 0.4, 0], [0.02, 1.0, 0]], [0.035, 0.03, 0.04], [0.42, 0.3, 0.2], 7, MT.wood, null, r); sm.add('sph', M(0.02, 1.06, 0, 0.07, 0.07, 0.07), [0.6, 0.5, 0.9], 0, r, MT.emit); addMesh(P.arms[0].hand, sm); }
  if (o.sword) { const sm = new Merger(); sm.add('box', M(0, 0.55, 0, 0.07, 1.0, 0.02), [0.85, 0.87, 0.92], 0, r, MT.metal); sm.add('box', M(0, 0.04, 0, 0.26, 0.04, 0.05), [0.7, 0.6, 0.3], 0, r, MT.gold); sm.add('cyl6', M(0, -0.12, 0, 0.025, 0.18, 0.025), [0.3, 0.2, 0.14], 0, r, MT.wood); const sg = jnt(P.arms[0].hand, 0, 0, 0); sg.rotation.x = -1.3; addMesh(sg, sm); P.sword = sg; }
  if (o.hammer) { const sm = new Merger(); sm.add('cyl6', M(0, -0.1, 0, 0.03, 0.8, 0.03, ), [0.42, 0.3, 0.2], 0, r, MT.wood); sm.add('box', M(0, 0.62, 0, 0.3, 0.17, 0.17), [0.5, 0.5, 0.55], 0, r, MT.metal); const sg = jnt(P.arms[0].hand, 0, 0, 0); sg.rotation.x = -1.2; addMesh(sg, sm); P.hammer = sg; }
  if (o.shield) { const sm = new Merger(); sm.add('sph', M(0, 0, 0, 0.32, 0.38, 0.05), o.shield, 0, r, MT.metal); sm.add('sph', M(0, 0, 0.04, 0.09, 0.09, 0.05), [0.85, 0.7, 0.3], 0, r, MT.gold); const sg = jnt(P.arms[1].el, 0.04, -0.2, 0.12); sg.rotation.y = 0.2; addMesh(sg, sm); }
  if (o.lantern) {
    const lg = jnt(P.arms[1].hand, 0, -0.04, 0.02); P.lantern = lg;
    const lm = new Merger();
    lm.add('cyl6', M(0, -0.18, 0, 0.012, 0.18, 0.012), [0.3, 0.3, 0.32], 0, r, MT.metal);
    lm.add('cyl', M(0, -0.25, 0, 0.065, 0.015, 0.065), [0.25, 0.22, 0.2], 0, r, MT.metal);
    lm.add('cyl', M(0, -0.235, 0, 0.05, 0.15, 0.05), [1, 0.85, 0.55], 0, r, MT.emit);
    lm.add('cone', M(0, -0.09, 0, 0.075, 0.06, 0.075), [0.2, 0.18, 0.22], 0, r, MT.metal);
    addMesh(lg, lm, false);
    const gl = makeGlow(0xffb060, 1.8, 0.8); gl.position.set(0, -0.2, 0); lg.add(gl); P.lanGlow = gl;
  }
  g.add(makeShadow(0.5 * sc));
  g.userData.parts = P;
  g.userData.humanoid = true;
  P.sit = !!o.sitting;
  return g;
}
// Ruhehaltungen und leichte Bewegung von Menschen
function animHumanoid(g, dt, st = {}) {
  const P = g.userData.parts, t = U.uTime.value, ph = (st.ph || 0);
  const k = Math.min(1, dt * 8);
  const S = (o, key, v) => { o.rotation[key] += (v - o.rotation[key]) * k; };
  const mv = st.mv || 0;
  const seed = (g.userData.seed || 0);
  if (P.sit) {
    for (const l of P.legs) { S(l.hip, 'x', -1.45); S(l.knee, 'x', 1.5); S(l.hip, 'z', l.sd * 0.15); }
    P.hips.position.y += (0.26 - P.hips.position.y) * k;
    S(P.torso, 'x', 0.08 + Math.sin(t * 0.9 + seed) * 0.02);
    S(P.arms[0].sh, 'x', -0.9); S(P.arms[0].el, 'x', -0.7); S(P.arms[1].sh, 'x', -0.9); S(P.arms[1].el, 'x', -0.9);
    S(P.head, 'y', Math.sin(t * 0.4 + seed) * 0.4);
    if (P.sword) P.sword.rotation.x = -0.4;
    return;
  }
  const sw = Math.sin(t * 7 * (0.6 + mv)) * Math.min(1, mv * 2);
  for (const l of P.legs) { S(l.hip, 'x', sw * 0.7 * l.sd); S(l.knee, 'x', Math.max(0, -sw * l.sd) * 0.7); }
  S(P.torso, 'x', mv * 0.1 + Math.sin(t * 1.5 + seed) * 0.012);
  S(P.torso, 'y', 0);
  S(P.arms[1].sh, 'x', -sw * 0.5 * 0.7 - (P.lantern ? 0.45 : 0)); S(P.arms[1].el, 'x', -0.2 - (P.lantern ? 0.5 : 0)); S(P.arms[1].sh, 'z', -0.1);
  if (st.work != null) { S(P.arms[0].sh, 'x', -1.2 + st.work * 1.5); S(P.arms[0].el, 'x', -0.4); }
  else if (st.wave) { S(P.arms[0].sh, 'z', 2.6 + Math.sin(t * 6) * 0.3); S(P.arms[0].sh, 'x', -0.1); S(P.arms[0].el, 'x', -0.3); }
  else { S(P.arms[0].sh, 'x', sw * 0.5 - (P.sword ? 0.2 : 0)); S(P.arms[0].el, 'x', -0.2 - (P.staff ? 0.2 : 0)); S(P.arms[0].sh, 'z', 0.1); }
  S(P.head, 'y', Math.sin(t * 0.5 + seed) * 0.35 * (1 - mv)); S(P.head, 'x', Math.sin(t * 0.8 + seed) * 0.04);
  if (P.lantern) P.lantern.rotation.x = Math.sin(t * 2.4 + seed) * 0.1;
  P.hips.position.y = P.hips.userData.base || (P.hips.userData.base = P.hips.position.y);
  P.hips.position.y += Math.sin(t * 1.5 + seed) * 0.004 + Math.abs(sw) * 0.03 * 0;
}

// ---------- Nicht-Spieler-Figuren ----------
function makePerson(opts) {
  const g = buildHumanoid({ seed: opts.seed, robe: opts.robe, hat: opts.wideHat ? 'wide' : 'cone', hatCol: opts.hat, beard: opts.beard ? [0.9, 0.9, 0.92] : null, pack: opts.pack, staff: opts.staff, lantern: opts.lantern, skin: opts.skin });
  g.userData.seed = (opts.seed || 1) % 17;
  g.userData.anim = (dt) => animHumanoid(g, dt, { wave: false });
  return g;
}
function makeKnight(seed, sitting) {
  const r = mulberry32(seed);
  const steel = pick(r, [[0.62, 0.64, 0.7], [0.5, 0.5, 0.55], [0.7, 0.66, 0.58]]);
  const cloth = pick(r, [[0.55, 0.12, 0.14], [0.16, 0.22, 0.45], [0.2, 0.36, 0.24], [0.45, 0.36, 0.14], [0.3, 0.16, 0.4]]);
  const g = buildHumanoid({ seed, armor: steel, robe: cloth, helm: true, plume: r() < 0.6 ? cloth.map(v => Math.min(1, v * 1.4)) : null, cape: cloth.map(v => v * 0.7), sitting, sword: !sitting, shield: !sitting ? cloth : null });
  g.userData.seed = seed % 13;
  g.userData.anim = (dt) => animHumanoid(g, dt);
  return g;
}
function makeDwarf(seed) {
  const r = mulberry32(seed);
  const coat = pick(r, [[0.45, 0.28, 0.18], [0.3, 0.32, 0.4], [0.5, 0.2, 0.18], [0.32, 0.4, 0.26]]);
  const beard = pick(r, [[0.85, 0.5, 0.25], [0.9, 0.88, 0.85], [0.4, 0.26, 0.16], [0.75, 0.3, 0.12]]);
  const g = buildHumanoid({ seed, dwarf: true, robe: coat, hat: 'dwarf', beard, hammer: true, skin: [0.92, 0.74, 0.6], scale: 1 });
  const P = g.userData.parts;
  g.userData.arm = P.arms[0].sh;
  g.userData.seed = seed % 11;
  const lamp = makeGlow(0xffa040, 1.1, 0.8); lamp.position.set(0, 0.95, 0.2); g.add(lamp);
  return g;
}

// ---------- Gegner ----------
function eyes(g, y, z, sep, col, size) {
  for (const sx of [-1, 1]) { const e = makeGlow(col, size, 1); e.position.set(sx * sep, y, z); g.add(e); }
}
// Material für durchscheinende Wesen
function ghostMat(col, emis, op) {
  const m = worldMat({ transparent: true, opacity: op, shine: 30, spec: 0x334466, emissive: emis });
  m.depthWrite = op > 0.95;
  return m;
}
function ghostMesh(par, mg, mat) { const m = new THREE.Mesh(mg.build(), mat); m.castShadow = false; par.add(m); return m; }

const ENEMY_TYPES = {
  schatten: {
    name: 'Schatten', hp: 26, dmg: 9, speed: 4.6, range: 1.7, aggro: 16, windup: 0.5, cool: 1.1, radius: 0.6, hover: 0.6, gold: [3, 7], col: [0.3, 0.2, 0.4],
    build(r) {
      const g = new THREE.Group(), body = jnt(g, 0, 0, 0);
      const dark = [0.1, 0.06, 0.18], dark2 = [0.04, 0.02, 0.09];
      const mat = MAT.wraith || (MAT.wraith = ghostMat(dark, 0x1c0a38, 0.9));
      const mg = new Merger();
      tube(mg, [[0, 0.35, 0], [0, 0.8, 0], [0, 1.25, 0.02], [0, 1.6, 0.06]], [0.04, 0.33, 0.4, 0.22], dark2, 16, MT.cloth, dark, r);
      // zerfetzter Saum
      for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28; mg.add('cone', M(Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28, 0.09, 0.4 + r() * 0.3, 0.09, Math.PI + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), dark2, 0, r, MT.cloth); }
      // Kopf mit Kapuze
      mg.add('sph', M(0, 1.88, 0.08, 0.24, 0.26, 0.25), dark, 0, r, MT.cloth);
      mg.add('sph', M(0, 1.86, 0.2, 0.17, 0.19, 0.12), [0.0, 0.0, 0.01], 0, r, MT.gen);
      tube(mg, [[0, 1.95, -0.1], [0, 2.1, -0.25], [0, 2.0, -0.5]], [0.17, 0.1, 0.01], dark, 8, MT.cloth, null, r);
      ghostMesh(body, mg, mat);
      // Tentakel am Saum
      const tent = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 6.28;
        const ch = jchain(body, [Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22], [0.32, 0.3, 0.28], [0.06, 0.045, 0.03, 0.005], dark2, MT.cloth, 6, false);
        ch.forEach(j => { j.children.forEach(c => { c.material = mat; }); });
        tent.push({ ch, ph: r() * 6, a });
      }
      // Arme mit Klauen
      const arms = [];
      for (const sd of [-1, 1]) {
        const ar = jchain(body, [sd * 0.4, 1.58, 0.05], [0.5, 0.55], [0.07, 0.05, 0.03], dark, MT.cloth, 7, false);
        ar.forEach(j => { j.children.forEach(c => { c.material = mat; }); });
        const cm = new Merger();
        for (let q = -1; q <= 1; q++) cm.add('cone', M(q * 0.035, -0.58, 0.02, 0.014, 0.17, 0.014, 0.2, 0, q * 0.25 + Math.PI), [0.55, 0.4, 0.7], 0, r, MT.gen);
        ghostMesh(ar[1], cm, mat);
        arms.push(ar);
      }
      eyes(g, 1.9, 0.3, 0.1, 0xff3030, 0.5);
      const aura = makeGlow(0x6020a0, 3.4, 0.18); aura.position.y = 1.1; g.add(aura);
      g.userData.anim = (dt, e) => {
        const t = U.uTime.value, wu = e.windup || 0;
        tent.forEach(tn => tn.ch.forEach((j, i) => { j.rotation.x = Math.sin(t * 2.2 + tn.ph - i * 0.8) * 0.35; j.rotation.z = Math.cos(t * 1.9 + tn.ph - i) * 0.35; }));
        arms.forEach((ar, k) => {
          const sd = k ? 1 : -1;
          ar[0].rotation.x = -0.4 - wu * 2.4 + Math.sin(t * 1.6 + k) * 0.15 + (e.moving ? -0.5 : 0);
          ar[0].rotation.z = sd * (0.35 + wu * 0.3 + Math.sin(t * 1.3 + k * 2) * 0.1);
          ar[1].rotation.x = -0.6 - wu * 0.5 - (e.recover ? 0.8 : 0);
        });
        body.rotation.x = e.recover ? 0.4 : -wu * 0.3;
        body.position.y = Math.sin(t * 1.4 + e.homeX) * 0.06;
      };
      return g;
    },
  },
  dornling: {
    name: 'Dornling', hp: 40, dmg: 11, speed: 3.8, range: 1.9, aggro: 13, windup: 0.55, cool: 1.3, radius: 0.8, hover: 0, gold: [4, 9], col: [0.45, 0.25, 0.4],
    build(r) {
      const g = new THREE.Group(), body = jnt(g, 0, 0.8, 0);
      const fur = [0.24, 0.17, 0.3], fur2 = [0.15, 0.1, 0.2], sp = [0.9, 0.45, 0.65];
      const mg = new Merger();
      mg.add('sph', M(0, 0, -0.05, 0.46, 0.44, 0.78), fur, 0.1, r, MT.cloth);
      mg.add('sph', M(0, -0.02, 0.42, 0.4, 0.4, 0.4), fur.map(v => v * 1.1), 0.1, r, MT.cloth);
      // Kopf mit Schnauze
      mg.add('sph', M(0, 0.12, 0.88, 0.3, 0.28, 0.3), fur.map(v => v * 1.2), 0, r, MT.cloth);
      mg.add('sph', M(0, 0.02, 1.12, 0.18, 0.14, 0.22), fur2, 0, r, MT.cloth);
      mg.add('sph', M(0, 0.02, 1.3, 0.05, 0.04, 0.03), [0.95, 0.4, 0.55], 0, r, MT.gen);
      for (const sd of [-1, 1]) {
        mg.add('cone', M(0.14 * sd, -0.06, 1.18, 0.035, 0.28, 0.035, 2.2, 0, sd * 0.3), [0.92, 0.88, 0.8], 0, r, MT.plaster);
        mg.add('cone', M(0.18 * sd, 0.32, 0.8, 0.07, 0.3, 0.07, -0.5, 0, sd * 0.5), [0.5, 0.3, 0.4], 0, r, MT.cloth);
      }
      // Rückendornen
      for (let i = 0; i < 12; i++) { const t = i / 11; mg.add('cone', M((r() - 0.5) * 0.4, 0.38 - Math.abs(t - 0.4) * 0.15, 0.55 - t * 1.2, 0.09, 0.4 + r() * 0.35, 0.09, (r() - 0.5) * 0.5, r(), (r() - 0.5) * 0.5), sp, 0, r, MT.gen); }
      // Schwanz mit Dorn
      tube(mg, [[0, 0.05, -0.75], [0, 0.2, -1.1], [0, 0.45, -1.3]], [0.09, 0.06, 0.03], fur2, 8, MT.cloth, null, r);
      mg.add('cone', M(0, 0.45, -1.3, 0.07, 0.3, 0.07, -0.7, 0, 0), sp, 0, r, MT.gen);
      addMesh(body, mg);
      // Beine
      const legs = [];
      for (const [x, z, sd] of [[-0.28, 0.45, 0], [0.28, 0.45, 1], [-0.28, -0.45, 1], [0.28, -0.45, 0]]) {
        const ch = jchain(body, [x, -0.2, z], [0.34, 0.36], [0.1, 0.07, 0.06], fur2, MT.cloth, 7);
        const fm = new Merger(); fm.add('sph', M(0, -0.38, 0.05, 0.075, 0.05, 0.11), [0.12, 0.08, 0.14], 0, r, MT.cloth);
        addMesh(ch[1], fm);
        legs.push({ ch, sd, z });
      }
      const ey = eyes(g, 1.0, 1.13, 0.15, 0xffd020, 0.4);
      void ey;
      const tipGl = new PointSet();
      g.userData.anim = (dt, e) => {
        const t = U.uTime.value, wu = e.windup || 0, ph = t * 9 * (e.moving ? 1 : 0.2);
        legs.forEach(l => { const s = Math.sin(ph + l.sd * 3.14) * (e.moving ? 0.7 : 0.05); l.ch[0].rotation.x = s - 0.1; l.ch[1].rotation.x = Math.max(0, -s) * 0.9 + 0.2; });
        body.rotation.x = -wu * 0.45 + (e.recover ? 0.2 : 0);
        body.position.y = 0.8 + (e.moving ? Math.abs(Math.sin(ph)) * 0.06 : Math.sin(t * 1.6) * 0.012) + wu * 0.15;
        body.rotation.z = Math.sin(ph) * (e.moving ? 0.05 : 0);
      };
      void tipGl;
      g.add(makeShadow(0.9));
      return g;
    },
  },
  waechter: {
    name: 'Steinwächter', hp: 75, dmg: 16, speed: 2.4, range: 2.3, aggro: 12, windup: 0.75, cool: 1.6, radius: 1.0, hover: 0, gold: [8, 15], col: [0.6, 0.62, 0.7],
    build(r) {
      const g = new THREE.Group(), body = jnt(g, 0, 0, 0);
      const c = [0.52, 0.54, 0.6], d = [0.38, 0.4, 0.46], mossC = [0.28, 0.42, 0.26];
      const hips = jnt(body, 0, 1.0, 0);
      const torso = jnt(hips, 0, 0, 0);
      const tm = new Merger();
      tm.add('rock', M(0, 0.55, 0, 0.78, 0.62, 0.55), c, 0.1, r);
      tm.add('rock', M(0, 0.2, 0, 0.5, 0.3, 0.38), d, 0.1, r);
      tm.add('rock', M(0, 1.28, 0.04, 0.34, 0.3, 0.32), c, 0.1, r);   // Kopf
      for (const sd of [-1, 1]) tm.add('rock', M(sd * 0.72, 0.98, 0, 0.34, 0.26, 0.34), c, 0.1, r);
      // Moos und Kristalle
      for (let i = 0; i < 7; i++) tm.add('ico', M((r() - 0.5) * 1.1, 1.0 + r() * 0.3, (r() - 0.5) * 0.6, 0.18, 0.07, 0.17), mossC, 0.1, r, MT.gen);
      tm.add('sph', M(0, 0.6, 0.45, 0.2, 0.2, 0.1), [1, 0.4, 0.15], 0, r, MT.emit);
      for (let q = 0; q < 5; q++) tm.add('oct', M((q - 2) * 0.22, 1.5, -0.1, 0.06, 0.22, 0.06, (r() - 0.5) * 0.4, r(), (r() - 0.5) * 0.4), [0.4, 0.8, 0.9], 0, r, MT.emit);
      addMesh(torso, tm);
      const core = makeGlow(0xff5020, 1.1, 0.9); core.position.set(0, 0.6, 0.55); torso.add(core);
      eyes(torso, 1.3, 0.34, 0.14, 0xff7020, 0.34);
      const arms = [];
      for (const sd of [-1, 1]) {
        const ar = jchain(torso, [sd * 0.78, 0.95, 0], [0.7, 0.7], [0.24, 0.2, 0.2], d, MT.stone, 8);
        const fm = new Merger(); fm.add('rock', M(0, -0.78, 0.03, 0.3, 0.28, 0.3), c, 0.1, r);
        addMesh(ar[1], fm); arms.push(ar);
      }
      const legs = [];
      for (const sd of [-1, 1]) {
        const lg = jchain(hips, [sd * 0.32, 0, 0], [0.5, 0.5], [0.24, 0.2, 0.2], d, MT.stone, 8);
        const fm = new Merger(); fm.add('rock', M(0, -0.55, 0.08, 0.28, 0.14, 0.36), c, 0.1, r);
        addMesh(lg[1], fm); legs.push({ lg, sd });
      }
      g.userData.anim = (dt, e) => {
        const t = U.uTime.value, wu = e.windup || 0, ph = t * 4.2 * (e.moving ? 1 : 0);
        legs.forEach(l => { const s = Math.sin(ph + (l.sd > 0 ? 0 : 3.14)) * 0.5; l.lg[0].rotation.x = s; l.lg[1].rotation.x = Math.max(0, -s) * 0.5; });
        arms.forEach((ar, k) => {
          const sd = k ? 1 : -1;
          ar[0].rotation.x = -Math.sin(ph + (k ? 0 : 3.14)) * 0.35 - wu * 2.9 + (e.slam ? -2.9 : 0) + (e.recover ? 0.6 : 0);
          ar[0].rotation.z = sd * 0.12;
          ar[1].rotation.x = -0.35 - wu * 0.3;
        });
        torso.rotation.x = wu * -0.2 + (e.recover ? 0.35 : 0);
        hips.position.y = 1.0 + (e.moving ? Math.abs(Math.sin(ph)) * 0.08 : Math.sin(t * 1.2) * 0.01);
      };
      g.add(makeShadow(1.1));
      return g;
    },
  },
  ritter: {
    name: 'Geisterritter', hp: 55, dmg: 14, speed: 3.4, range: 2.4, aggro: 14, windup: 0.6, cool: 1.3, radius: 0.7, hover: 0.15, gold: [6, 12], col: [0.6, 0.75, 1.0],
    build(r) {
      const g = new THREE.Group(), body = jnt(g, 0, 0, 0);
      const mat = MAT.ghost || (MAT.ghost = ghostMat([0.5, 0.65, 0.95], 0x203060, 0.8));
      const c = [0.55, 0.68, 0.95], d = [0.33, 0.43, 0.75];
      const torso = jnt(body, 0, 0.95, 0);
      const mg = new Merger();
      // wehender Unterkörper
      tube(mg, [[0, -0.9, 0], [0, -0.5, 0], [0, -0.1, 0], [0, 0.15, 0]], [0.04, 0.2, 0.34, 0.3], d, 14, MT.cloth, d, r);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mg.add('cone', M(Math.cos(a) * 0.18, -0.55, Math.sin(a) * 0.18, 0.08, 0.5, 0.08, Math.PI + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), d, 0, r, MT.cloth); }
      // Brustpanzer
      mg.add('sph', M(0, 0.45, 0, 0.4, 0.38, 0.28), c, 0, r, MT.metal);
      mg.add('torus', M(0, 0.18, 0, 0.3, 0.3, 0.3, Math.PI / 2, 0, 0), c.map(v => v * 0.8), 0, r, MT.metal);
      for (const sd of [-1, 1]) mg.add('sph', M(sd * 0.46, 0.72, 0, 0.2, 0.13, 0.22), c, 0, r, MT.metal);
      // Helm mit Federbusch
      mg.add('sph', M(0, 1.02, 0, 0.23, 0.26, 0.23), c, 0, r, MT.metal);
      mg.add('box', M(0, 1.04, 0.21, 0.3, 0.05, 0.05), [0.04, 0.04, 0.1], 0, r, MT.gen);
      mg.add('box', M(0, 0.96, 0.21, 0.04, 0.22, 0.04), [0.04, 0.04, 0.1], 0, r, MT.gen);
      tube(mg, [[0, 1.25, 0], [0, 1.45, -0.1], [0, 1.35, -0.32], [0, 1.1, -0.45]], [0.03, 0.09, 0.07, 0.02], [0.9, 0.4, 0.5], 8, MT.cloth, null, r);
      // Umhang
      mg.add('box', M(0, 0.0, -0.27, 0.64, 1.1, 0.04, 0.1, 0, 0), d.map(v => v * 0.8), 0, r, MT.cloth);
      ghostMesh(torso, mg, mat);
      const arms = [];
      for (const sd of [-1, 1]) {
        const ar = jchain(torso, [sd * 0.48, 0.7, 0], [0.34, 0.34], [0.09, 0.075, 0.07], c, MT.metal, 8, false);
        ar.forEach(j => j.children.forEach(cc => { cc.material = mat; }));
        arms.push(ar);
      }
      // Schwert und Schild
      const sm = new Merger();
      sm.add('box', M(0, 0.7, 0, 0.09, 1.3, 0.025), [0.85, 0.92, 1], 0, r, MT.emit);
      sm.add('box', M(0, 0.05, 0, 0.32, 0.05, 0.06), [0.8, 0.85, 1], 0, r, MT.metal);
      const sw = jnt(arms[0][1], 0, -0.36, 0.04); sw.rotation.x = -1.4;
      addMesh(sw, sm, false);
      const sh = new Merger(); sh.add('sph', M(0, 0, 0, 0.34, 0.42, 0.06), d, 0, r, MT.metal); sh.add('sph', M(0, 0, 0.05, 0.1, 0.1, 0.05), [0.9, 0.5, 0.6], 0, r, MT.emit);
      const shg = jnt(arms[1][1], 0.05, -0.2, 0.16); addMesh(shg, sh, false);
      eyes(g, 1.97, 0.22, 0.09, 0xff4040, 0.3);
      const aura = makeGlow(0x6080ff, 3.2, 0.25); aura.position.y = 1.3; g.add(aura);
      g.userData.anim = (dt, e) => {
        const t = U.uTime.value, wu = e.windup || 0;
        arms[0][0].rotation.x = -0.5 - wu * 2.2 + (e.recover ? 1.0 : 0) + Math.sin(t * 1.5) * 0.04;
        arms[0][1].rotation.x = -0.4 - wu * 0.3;
        arms[1][0].rotation.x = -0.9; arms[1][1].rotation.x = -0.9;
        torso.rotation.x = e.moving ? 0.12 : 0; torso.rotation.y = wu * -0.5 + (e.recover ? 0.5 : 0);
        body.position.y = Math.sin(t * 2 + e.homeX) * 0.03;
        mat.opacity = 0.8 + Math.sin(t * 7) * 0.04;
      };
      return g;
    },
  },
};
const BOSS_TITLES = {
  schatten: ['Die Nachtmutter', 'Der Schattenfürst', 'Die Leere'],
  dornling: ['Die Dornenkönigin', 'Der Uralte Dornling', 'Die Rosenbestie'],
  waechter: ['Der Bergwächter', 'Der Steinkönig', 'Der Ewige Wächter'],
  ritter: ['Der Aschenkönig', 'Der Letzte Ritter', 'Die Graue Herzogin'],
};

function initCreatureMats() {
  MAT.orb = new THREE.MeshBasicMaterial({ color: 0xe0a0ff });
  MAT.ring = new THREE.MeshBasicMaterial({ color: 0xff5a7a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  MAT.coin = new THREE.MeshPhongMaterial({ color: 0xffd060, emissive: 0x604010, shininess: 90, specular: 0xffffff });
}

class Enemy {
  constructor(type, x, z, level, opts = {}) {
    const D = ENEMY_TYPES[type];
    this.type = type; this.def = D; this.boss = !!opts.boss; this.site = opts.site || null;
    this.level = level;
    const r = mulberry32(opts.seed || Math.floor(Math.random() * 1e9));
    this.scale = this.boss ? 2.3 : 1;
    this.maxHp = Math.round(D.hp * (1 + (level - 1) * 0.5) * (this.boss ? 5 : 1));
    this.hp = this.maxHp;
    this.dmg = D.dmg * (1 + (level - 1) * 0.45) * (this.boss ? 1.5 : 1);
    this.speed = D.speed * (this.boss ? 0.9 : 1);
    this.range = D.range * (this.boss ? 1.6 : 1);
    this.radius = D.radius * this.scale;
    this.name = opts.name || D.name;
    this.x = x; this.z = z; this.y = groundY(x, z); this.vx = 0; this.vz = 0;
    this.homeX = opts.homeX != null ? opts.homeX : x; this.homeZ = opts.homeZ != null ? opts.homeZ : z;
    this.face = r() * Math.PI * 2;
    this.state = 'idle'; this.t = 0; this.idleT = r() * 3; this.wx = x; this.wz = z;
    this.flash = 0; this.dead = false; this.gone = false; this.deathT = 0; this.seen = false;
    this.specialT = 4 + r() * 3;
    this.model = D.build(r);
    this.model.scale.setScalar(this.scale);
    this.mats = [];
    this.model.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive) {
        const src = o.material;
        o.material = src.clone();
        o.material.onBeforeCompile = src.onBeforeCompile; o.material.customProgramCacheKey = src.customProgramCacheKey;
        this.mats.push(o.material);
      }
    });
    this.baseEmissive = this.mats.map(m => m.emissive.clone());
    // Lebensbalken
    this.bar = new THREE.Group();
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x140c18, depthTest: false, fog: false }));
    bg.scale.set(1.3, 0.13, 1); bg.center.set(0, 0.5); bg.position.x = -0.65;
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe0607a, depthTest: false, fog: false }));
    fg.scale.set(1.26, 0.09, 1); fg.center.set(0, 0.5); fg.position.x = -0.63;
    bg.renderOrder = 20; fg.renderOrder = 21;
    this.bar.add(bg, fg); this.barFg = fg;
    this.bar.visible = false;
    this.model.add(this.bar);
    this.bar.position.y = (type === 'waechter' ? 3.0 : type === 'ritter' ? 2.6 : 2.0);
    this.bar.scale.setScalar(1 / this.scale);
    G.scene.add(this.model);
  }
  hit(dmg, fromX, fromZ, ctx) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.18;
    const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const kb = this.boss ? 2 : 7;
    this.vx += dx / d * kb; this.vz += dz / d * kb;
    if (this.state === 'idle') this.state = 'chase';
    burst(this.x, this.y + 1.2 * this.scale, this.z, 10, this.def.col, 5, 0.22, 0.6);
    if (this.hp <= 0) {
      this.dead = true; this.deathT = 0;
      burst(this.x, this.y + 1 * this.scale, this.z, this.boss ? 90 : 28, this.def.col, this.boss ? 9 : 6, 0.3, 1.4, 2);
      burst(this.x, this.y + 1 * this.scale, this.z, this.boss ? 40 : 10, [1, 0.95, 0.8], 4, 0.18, 1.6, -1.5);
      ctx.onKill(this);
    }
  }
  update(dt, P, ctx) {
    if (this.dead) {
      this.deathT += dt;
      const s = Math.max(0, 1 - this.deathT * 1.8);
      this.model.scale.setScalar(this.scale * s);
      this.model.position.y = this.y + this.deathT * 1.2;
      if (s <= 0) { this.remove(); }
      return;
    }
    const D = this.def;
    const dx = P.x - this.x, dz = P.z - this.z;
    const dist = Math.hypot(dx, dz);
    const homeD = Math.hypot(this.x - this.homeX, this.z - this.homeZ);
    this.t -= dt;
    let mvx = 0, mvz = 0, sp = this.speed;
    const aggroR = D.aggro * (this.boss ? 1.6 : 1) * (P.sneak ? 0.7 : 1);
    if (P.dead || P.resting || (P.safe && !this.boss)) { if (this.state !== 'idle' && this.state !== 'home') this.state = 'home'; }
    switch (this.state) {
      case 'idle':
        this.idleT -= dt;
        if (this.idleT <= 0) { this.idleT = 2 + Math.random() * 4; const a = Math.random() * 6.28; this.wx = this.homeX + Math.cos(a) * 6; this.wz = this.homeZ + Math.sin(a) * 6; }
        { const ex = this.wx - this.x, ez = this.wz - this.z, el = Math.hypot(ex, ez); if (el > 0.5) { mvx = ex / el; mvz = ez / el; sp *= 0.35; } }
        if (dist < aggroR && !P.dead && !P.resting && !P.safe) { this.state = 'chase'; if (this.boss) ctx.onBossAggro(this); }
        break;
      case 'home': {
        const ex = this.homeX - this.x, ez = this.homeZ - this.z, el = Math.hypot(ex, ez);
        if (el > 1) { mvx = ex / el; mvz = ez / el; } else this.state = 'idle';
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.2);
        break;
      }
      case 'chase':
        if (homeD > (this.site ? 34 : 45) || dist > aggroR * 2.4) { this.state = 'home'; break; }
        if (dist > this.range * 0.8) { mvx = dx / dist; mvz = dz / dist; }
        if (dist < this.range) { this.state = 'windup'; this.t = D.windup * (this.boss ? 1.25 : 1); }
        if (this.boss) {
          this.specialT -= dt;
          if (this.specialT <= 0 && dist < 22) { this.specialT = 5 + Math.random() * 3; this.state = Math.random() < 0.5 ? 'slam' : 'orbs'; this.t = this.state === 'slam' ? 1.3 : 0.8; if (this.state === 'slam') ctx.spawnRing(this, 7.5, 1.3); }
        }
        break;
      case 'windup':
        if (this.t <= 0) {
          this.state = 'recover'; this.t = D.cool;
          const ang = Math.atan2(dx, dz);
          let da = ang - this.face; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
          if (dist < this.range * 1.3 && Math.abs(da) < 1.3 && Math.abs(P.y - this.y) < 3.2) ctx.hurtPlayer(this.dmg, this.x, this.z);
          ctx.sfx('swoosh', 0.5);
        }
        break;
      case 'slam':
        if (this.t <= 0) {
          this.state = 'recover'; this.t = 1.0;
          if (dist < 7.5 && P.y < this.y + 2.5) ctx.hurtPlayer(this.dmg * 1.2, this.x, this.z);
          burst(this.x, this.y + 0.3, this.z, 60, this.def.col, 10, 0.3, 0.8, 8, 3);
          ctx.sfx('slam'); ctx.shake(0.5);
        }
        break;
      case 'orbs':
        if (this.t <= 0) {
          this.state = 'recover'; this.t = 0.8;
          for (let k = -1; k <= 1; k++) {
            const a = Math.atan2(dx, dz) + k * 0.35;
            ctx.spawnOrb(this.x + Math.sin(a) * 1.5, this.y + 1.6 * this.scale, this.z + Math.cos(a) * 1.5, Math.sin(a) * 9, Math.cos(a) * 9, this.dmg * 0.7);
          }
          ctx.sfx('orb');
        }
        break;
      case 'recover':
        if (this.t <= 0) this.state = 'chase';
        break;
    }
    // Bewegung
    this.vx *= Math.max(0, 1 - dt * 6); this.vz *= Math.max(0, 1 - dt * 6);
    const moving = mvx || mvz;
    this.x += (mvx * sp + this.vx) * dt; this.z += (mvz * sp + this.vz) * dt;
    ctx.collide(this, this.radius);
    if (moving) {
      const ta = Math.atan2(mvx, mvz);
      let da = ta - this.face; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      this.face += da * Math.min(1, dt * 8);
    } else if (this.state === 'windup' || this.state === 'chase') {
      const ta = Math.atan2(dx, dz);
      let da = ta - this.face; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      this.face += da * Math.min(1, dt * 5);
    }
    const gy = walkY(this.x, this.z, this.y);
    this.y = Math.max(gy, WATER - 0.6);
    const tm = U.uTime.value;
    const bob = D.hover ? D.hover + Math.sin(tm * 2 + this.homeX) * 0.2 : (moving ? Math.abs(Math.sin(tm * 9)) * 0.08 : 0);
    this.model.position.set(this.x, this.y + bob, this.z);
    this.model.rotation.y = this.face;
    // Ausholen sichtbar machen
    const wind = this.state === 'windup' ? 1 - Math.max(0, this.t) / (D.windup * (this.boss ? 1.25 : 1)) : 0;
    if (this.model.userData.anim) this.model.userData.anim(dt, { windup: wind, moving: !!moving, recover: this.state === 'recover' && this.t > D.cool - 0.35, slam: this.state === 'slam', homeX: this.homeX });
    this.flash = Math.max(0, this.flash - dt);
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i];
      if (this.flash > 0) m.emissive.setRGB(0.9, 0.85, 1);
      else if (wind > 0) m.emissive.copy(this.baseEmissive[i]).lerp(_c1.setRGB(0.6, 0.15, 0.25), wind);
      else m.emissive.copy(this.baseEmissive[i]);
    }
    // Balken
    const show = !this.boss && (this.hp < this.maxHp || this.state !== 'idle');
    this.bar.visible = show;
    if (show) this.barFg.scale.x = 1.26 * Math.max(0, this.hp / this.maxHp);
  }
  remove() {
    if (this.gone) return;
    this.gone = true;
    disposeObj(this.model);
    for (const m of this.mats) m.dispose();
  }
}

// ---------- Geschosse und Bodenwellen der Bosse ----------
class Orb {
  constructor(x, y, z, vx, vz, dmg) {
    this.x = x; this.y = y; this.z = z; this.vx = vx; this.vz = vz; this.dmg = dmg; this.life = 3.5; this.gone = false;
    this.o = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), MAT.orb);
    this.o.add(core, makeGlow(0xc080ff, 2.2, 0.9));
    G.scene.add(this.o);
  }
  update(dt, P, ctx) {
    this.life -= dt;
    this.x += this.vx * dt; this.z += this.vz * dt;
    const gy = groundY(this.x, this.z) + 1.2;
    this.y += (gy - this.y) * Math.min(1, dt * 3);
    this.o.position.set(this.x, this.y, this.z);
    if (Math.hypot(P.x - this.x, P.z - this.z) < 0.9 && Math.abs(P.y + 0.8 - this.y) < 1.6 && !P.dead) {
      ctx.hurtPlayer(this.dmg, this.x - this.vx, this.z - this.vz); this.life = 0;
    }
    if (this.life <= 0) { burst(this.x, this.y, this.z, 14, [0.8, 0.55, 1], 4, 0.2, 0.6); this.remove(); }
  }
  remove() { if (!this.gone) { this.gone = true; disposeObj(this.o); } }
}
class Ring {
  constructor(x, z, r, time) {
    this.x = x; this.z = z; this.r = r; this.time = time; this.t = 0; this.gone = false;
    const g = new THREE.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2);
    this.o = new THREE.Mesh(g, MAT.ring);
    this.o.renderOrder = 2;
    this.o.position.set(x, groundY(x, z) + 0.15, z);
    G.scene.add(this.o);
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.time);
    this.o.scale.setScalar(Math.max(0.01, this.r * k));
    if (this.t >= this.time + 0.1) this.remove();
  }
  remove() { if (!this.gone) { this.gone = true; this.o.geometry.dispose(); if (this.o.parent) this.o.parent.remove(this.o); } }
}

// ---------- Beute ----------
let COIN_GEO = null;
class Pickup {
  constructor(kind, x, y, z, value) {
    this.kind = kind; this.value = value; this.x = x; this.y = y; this.z = z;
    const a = Math.random() * 6.28, s = 2 + Math.random() * 3;
    this.vx = Math.cos(a) * s; this.vz = Math.sin(a) * s; this.vy = 5 + Math.random() * 3;
    this.age = 0; this.gone = false;
    if (!COIN_GEO) { COIN_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 6); COIN_GEO.rotateX(Math.PI / 2); COIN_GEO.userData.keep = true; }
    this.o = new THREE.Group();
    if (kind === 'gold') {
      this.o.add(new THREE.Mesh(COIN_GEO, MAT.coin));
      if (value > 4) this.o.scale.setScalar(1.35);
    } else if (kind === 'trank') {
      const mg = new Merger();
      mg.add('ico', M(0, 0, 0, 0.2, 0.22, 0.2), [0.95, 0.3, 0.45]);
      mg.add('cyl6', M(0, 0.15, 0, 0.06, 0.15, 0.06), [0.85, 0.85, 0.9]);
      this.o.add(new THREE.Mesh(mg.build(), MAT.flat), makeGlow(0xff6080, 1.2, 0.7));
    } else {
      const mg = new Merger();
      mg.add('oct', M(0, 0, 0, 0.18, 0.32, 0.18), [0.85, 0.92, 1]);
      this.o.add(new THREE.Mesh(mg.build(), new THREE.MeshBasicMaterial({ vertexColors: true })), makeGlow(0xb0d0ff, 2, 0.9));
    }
    G.scene.add(this.o);
  }
  update(dt, P, ctx) {
    this.age += dt;
    const gy = Math.max(groundY(this.x, this.z), WATER) + 0.25;
    const d = Math.hypot(P.x - this.x, P.z - this.z);
    if (this.age > 0.55 && d < 7 && !P.dead) {
      const k = Math.min(1, dt * (5 + (7 - d) * 2));
      this.x += (P.x - this.x) * k; this.z += (P.z - this.z) * k; this.y += (P.y + 0.8 - this.y) * k;
      if (d < 0.9) { ctx.collect(this); this.remove(); return; }
    } else {
      this.vy -= 18 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      this.vx *= 1 - dt * 1.5; this.vz *= 1 - dt * 1.5;
      if (this.y < gy) { this.y = gy; this.vy = Math.abs(this.vy) * 0.35; if (this.vy < 1) this.vy = 0; }
    }
    this.o.position.set(this.x, this.y + Math.sin(this.age * 3) * 0.06, this.z);
    this.o.rotation.y += dt * 3;
    if (this.age > 90) this.remove();
  }
  remove() { if (!this.gone) { this.gone = true; this.o.traverse(c => { if (c.geometry && c.geometry !== COIN_GEO) c.geometry.dispose(); }); if (this.o.parent) this.o.parent.remove(this.o); } }
}
