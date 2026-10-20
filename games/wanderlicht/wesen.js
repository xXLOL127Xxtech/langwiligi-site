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
function makeWeaponMesh(tier) {
  const W = WEAPONS[tier], mg = new Merger();
  const hilt = [0.3, 0.22, 0.16], guard = [0.75, 0.62, 0.3];
  if (W.kind === 'stab') {
    mg.add('cyl6', M(0, -0.25, 0, 0.045, W.len + 0.25, 0.045), W.col);
    mg.add('ico', M(0, W.len, 0, 0.1, 0.1, 0.1), [0.6, 0.5, 0.8]);
  } else {
    mg.add('cyl6', M(0, -0.2, 0, 0.04, 0.3, 0.04), hilt);
    mg.add('box', M(0, 0.1, 0, 0.32, 0.06, 0.08), guard);
    if (W.kind === 'sichel') {
      for (let i = 0; i < 6; i++) {
        const a = i / 5 * 1.4;
        mg.add('box', M(Math.sin(a) * 0.35, 0.15 + Math.sin(a) * 0.1 + i * 0.16, 0, 0.08, 0.2, 0.03, 0, 0, -a * 0.6), W.col);
      }
    } else {
      mg.add('box', M(0, 0.13 + W.len / 2, 0, 0.11, W.len, 0.03), W.col);
      mg.add('cone4', M(0, 0.13 + W.len, 0, 0.078, 0.18, 0.02, 0, Math.PI / 4, 0), W.col);
    }
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (W.glow) { const s = makeGlow(W.glow, 1.1, 0.55); s.position.y = 0.2 + W.len * 0.6; g.add(s); }
  return g;
}

function makePlayerModel(armorTier) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const parts = { body };
  const buildBody = tier => {
    if (parts.bodyMesh) { body.remove(parts.bodyMesh); parts.bodyMesh.geometry.dispose(); }
    const A = ARMORS[tier], mg = new Merger();
    mg.add('taper', M(0, 0, 0, 0.42, 1.18, 0.42), A.col);
    mg.add('taper', M(0, 0.55, 0, 0.3, 0.55, 0.3), A.col.map(v => v * 1.15));
    mg.add('ico', M(0, 1.33, 0, 0.21, 0.22, 0.21), [0.96, 0.83, 0.74]);
    mg.add('ico', M(0.075, 1.35, 0.17, 0.03, 0.04, 0.03), [0.1, 0.08, 0.12]);
    mg.add('ico', M(-0.075, 1.35, 0.17, 0.03, 0.04, 0.03), [0.1, 0.08, 0.12]);
    mg.add('cyl', M(0, 1.44, 0, 0.5, 0.04, 0.5), [0.15, 0.14, 0.26]);
    mg.add('cone', M(0, 1.46, -0.03, 0.33, 0.66, 0.33, -0.18, 0, 0.05), [0.15, 0.14, 0.26]);
    mg.add('cyl', M(0, 1.47, 0, 0.335, 0.07, 0.335), [0.75, 0.3, 0.4]);
    // Arme
    mg.add('taper', M(0.36, 0.62, 0.02, 0.09, 0.5, 0.09, 0, 0, 0.25), A.col.map(v => v * 0.9));
    mg.add('taper', M(-0.36, 0.62, 0.02, 0.09, 0.5, 0.09, 0, 0, -0.25), A.col.map(v => v * 0.9));
    if (tier >= 2) mg.add('box', M(0, 0.92, 0, 0.62, 0.12, 0.42), A.col.map(v => v * 1.3));
    parts.bodyMesh = new THREE.Mesh(mg.build(), MAT.flat);
    body.add(parts.bodyMesh);
  };
  buildBody(armorTier);
  parts.setArmor = buildBody;

  // Schal
  const scarf = new THREE.Group();
  scarf.position.set(0, 1.12, -0.05);
  const smg = new Merger();
  smg.add('box', M(0, 0, 0, 0.36, 0.1, 0.32), [0.86, 0.32, 0.4]);
  scarf.add(new THREE.Mesh(smg.build(), MAT.flat));
  const tail = new THREE.Group();
  tail.position.set(0.08, -0.02, -0.16);
  const tmg = new Merger();
  tmg.add('box', M(0, 0, -0.32, 0.1, 0.05, 0.64), [0.86, 0.32, 0.4]);
  tail.add(new THREE.Mesh(tmg.build(), MAT.flat));
  scarf.add(tail);
  body.add(scarf);
  parts.scarfTail = tail;

  // Laterne
  const lan = new THREE.Group();
  lan.position.set(-0.44, 0.62, 0.12);
  const lmg = new Merger();
  lmg.add('box', M(0, 0, 0, 0.14, 0.18, 0.14), [1, 0.82, 0.5]);
  lmg.add('cone4', M(0, 0.09, 0, 0.11, 0.08, 0.11, 0, Math.PI / 4, 0), [0.2, 0.18, 0.22]);
  lan.add(new THREE.Mesh(lmg.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  parts.lanGlow = makeGlow(0xffb060, 1.6, 0.8);
  lan.add(parts.lanGlow);
  body.add(lan);
  parts.lantern = lan;

  // Waffe
  const pivot = new THREE.Group();
  pivot.position.set(0.44, 0.62, 0.1);
  body.add(pivot);
  parts.pivot = pivot;
  parts.setWeapon = tier => {
    if (parts.weapon) { pivot.remove(parts.weapon); disposeObj(parts.weapon); }
    parts.weapon = makeWeaponMesh(tier);
    parts.weapon.rotation.x = 0.5;
    pivot.add(parts.weapon);
  };
  g.add(makeShadow(0.5));
  g.userData.parts = parts;
  return g;
}

// ---------- Nicht-Spieler-Figuren ----------
function makePerson(opts) {
  const r = mulberry32(opts.seed || 1);
  const g = new THREE.Group();
  const mg = new Merger();
  const robe = opts.robe || pick(r, [[0.55, 0.3, 0.32], [0.3, 0.42, 0.36], [0.6, 0.5, 0.3], [0.32, 0.3, 0.5], [0.5, 0.4, 0.55]]);
  const hat = opts.hat || robe.map(v => v * 0.6);
  mg.add('taper', M(0, 0, 0, 0.45, 1.2, 0.45), robe);
  mg.add('ico', M(0, 1.34, 0, 0.22, 0.23, 0.22), opts.skin || pick(r, [[0.95, 0.82, 0.72], [0.78, 0.6, 0.46], [0.58, 0.42, 0.32]]));
  if (opts.beard) mg.add('cone', M(0, 1.06, 0.12, 0.16, 0.3, 0.1, Math.PI, 0, 0), [0.9, 0.9, 0.92]);
  if (opts.wideHat) {
    mg.add('cyl', M(0, 1.47, 0, 0.62, 0.05, 0.62), hat);
    mg.add('cyl', M(0, 1.5, 0, 0.26, 0.22, 0.26), hat);
  } else {
    mg.add('cone', M(0, 1.3, -0.04, 0.3, 0.5, 0.3, -0.25, 0, 0), hat);
  }
  if (opts.pack) mg.add('box', M(0, 0.75, -0.42, 0.62, 0.8, 0.4), [0.45, 0.32, 0.22]);
  if (opts.staff) mg.add('cyl6', M(0.42, 0, 0.15, 0.04, 1.9, 0.04, 0, 0, 0.05), [0.42, 0.3, 0.2]);
  g.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (opts.lantern) {
    const l = makeGlow(0xffb060, 1.8, 0.8); l.position.set(-0.45, 0.7, 0.15); g.add(l);
    const lm = new Merger(); lm.add('box', M(-0.45, 0.7, 0.15, 0.14, 0.18, 0.14), [1, 0.82, 0.5]);
    g.add(new THREE.Mesh(lm.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  g.add(makeShadow(0.5));
  return g;
}

// ---------- Gegner ----------
function eyes(g, y, z, sep, col, size) {
  for (const sx of [-1, 1]) { const e = makeGlow(col, size, 1); e.position.set(sx * sep, y, z); g.add(e); }
}
const ENEMY_TYPES = {
  schatten: {
    name: 'Schatten', hp: 26, dmg: 9, speed: 4.6, range: 1.7, aggro: 16, windup: 0.5, cool: 1.1, radius: 0.6, hover: 0.6, gold: [3, 7], col: [0.3, 0.2, 0.4],
    build(r) {
      const g = new THREE.Group(), ps = new PointSet();
      const cols = [[0.08, 0.05, 0.12], [0.03, 0.02, 0.05], [0.25, 0.15, 0.35]];
      blob(ps, 0, 1.0, 0, 0.7, 0.9, 0.7, cols, r, 40, 1);
      for (let i = 0; i < 40; i++) ps.add((r() - 0.5) * 0.6, 0.2 + r() * 0.5, (r() - 0.5) * 0.6 - 0.3, cols[1]);
      const p = new THREE.Points(ps.build(), MAT.shadowPts);
      g.add(p);
      eyes(g, 1.15, 0.55, 0.2, 0xff3030, 0.45);
      return g;
    },
  },
  dornling: {
    name: 'Dornling', hp: 40, dmg: 11, speed: 3.8, range: 1.9, aggro: 13, windup: 0.55, cool: 1.3, radius: 0.8, hover: 0, gold: [4, 9], col: [0.45, 0.25, 0.4],
    build(r) {
      const g = new THREE.Group(), mg = new Merger();
      const c = [0.26, 0.2, 0.3], sp = [0.85, 0.45, 0.62];
      mg.add('box', M(0, 0.75, 0, 0.8, 0.6, 1.3), c, 0.15, r);
      mg.add('box', M(0, 0.95, 0.75, 0.55, 0.5, 0.5), c.map(v => v * 1.2), 0.1, r);
      for (const [x, z] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]]) mg.add('box', M(x, 0.25, z, 0.18, 0.55, 0.18), c.map(v => v * 0.8));
      for (let i = 0; i < 7; i++) mg.add('cone4', M((r() - 0.5) * 0.6, 1.0, (r() - 0.5) * 1.1, 0.12, 0.45 + r() * 0.3, 0.12, (r() - 0.5) * 0.6, r(), (r() - 0.5) * 0.6), sp);
      const m = new THREE.Mesh(mg.build(), MAT.flat);
      g.add(m);
      eyes(g, 1.02, 1.01, 0.15, 0xffd020, 0.38);
      g.add(makeShadow(0.9));
      return g;
    },
  },
  waechter: {
    name: 'Steinwächter', hp: 75, dmg: 16, speed: 2.4, range: 2.3, aggro: 12, windup: 0.75, cool: 1.6, radius: 1.0, hover: 0, gold: [8, 15], col: [0.6, 0.62, 0.7],
    build(r) {
      const g = new THREE.Group(), mg = new Merger();
      const c = [0.52, 0.54, 0.6], d = [0.38, 0.4, 0.46];
      mg.add('box', M(0, 1.5, 0, 1.3, 1.2, 0.9), c, 0.15, r);
      mg.add('box', M(0, 2.35, 0.05, 0.6, 0.5, 0.55), c, 0.15, r);
      mg.add('box', M(-0.9, 1.25, 0.1, 0.45, 1.3, 0.45, 0, 0, 0.1), d, 0.15, r);
      mg.add('box', M(0.9, 1.25, 0.1, 0.45, 1.3, 0.45, 0, 0, -0.1), d, 0.15, r);
      mg.add('box', M(-0.35, 0.45, 0, 0.45, 0.9, 0.5), d);
      mg.add('box', M(0.35, 0.45, 0, 0.45, 0.9, 0.5), d);
      for (let i = 0; i < 5; i++) mg.add('ico', M((r() - 0.5) * 1.1, 2.1 + r() * 0.2, (r() - 0.5) * 0.6, 0.18, 0.12, 0.18), [0.4, 0.55, 0.42]);
      g.add(new THREE.Mesh(mg.build(), MAT.flat));
      const core = makeGlow(0xff5020, 0.9, 0.9); core.position.set(0, 1.6, 0.48); g.add(core);
      eyes(g, 2.4, 0.34, 0.14, 0xff7020, 0.32);
      g.add(makeShadow(1.1));
      return g;
    },
  },
  ritter: {
    name: 'Geisterritter', hp: 55, dmg: 14, speed: 3.4, range: 2.4, aggro: 14, windup: 0.6, cool: 1.3, radius: 0.7, hover: 0.15, gold: [6, 12], col: [0.6, 0.75, 1.0],
    build(r) {
      const g = new THREE.Group(), mg = new Merger();
      const c = [0.55, 0.68, 0.95], d = [0.35, 0.45, 0.75];
      mg.add('taper', M(0, 0, 0, 0.5, 1.4, 0.5), d);
      mg.add('box', M(0, 1.45, 0, 0.75, 0.6, 0.45), c);
      mg.add('box', M(0, 1.95, 0, 0.38, 0.42, 0.4), c);
      mg.add('box', M(0, 1.95, 0.2, 0.3, 0.06, 0.02), [0.1, 0.1, 0.2]);
      mg.add('cone4', M(0, 2.16, 0, 0.12, 0.35, 0.12), [0.9, 0.4, 0.5]);
      mg.add('box', M(0.55, 1.3, 0.45, 0.07, 1.6, 0.14, 1.0, 0, 0), [0.85, 0.9, 1.0]);
      mg.add('box', M(-0.5, 1.3, 0.25, 0.1, 0.9, 0.7), d.map(v => v * 1.2));
      g.add(new THREE.Mesh(mg.build(), MAT.ghost));
      eyes(g, 1.97, 0.22, 0.09, 0xff4040, 0.3);
      const aura = makeGlow(0x6080ff, 3.2, 0.25); aura.position.y = 1.3; g.add(aura);
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
  MAT.shadowPts = pointsMat(0.34, { emit: 1, sway: 0 });
  MAT.ghost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, emissive: 0x203060 });
  MAT.orb = new THREE.MeshBasicMaterial({ color: 0xe0a0ff });
  MAT.ring = new THREE.MeshBasicMaterial({ color: 0xff5a7a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  MAT.coin = new THREE.MeshLambertMaterial({ color: 0xffd060, emissive: 0x604010 });
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
      if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); this.mats.push(o.material); }
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
          if (dist < this.range * 1.3 && Math.abs(da) < 1.3) ctx.hurtPlayer(this.dmg, this.x, this.z);
          ctx.sfx('swoosh', 0.5);
        }
        break;
      case 'slam':
        if (this.t <= 0) {
          this.state = 'recover'; this.t = 1.0;
          if (dist < 7.5) ctx.hurtPlayer(this.dmg * 1.2, this.x, this.z);
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
    const gy = groundY(this.x, this.z);
    this.y = Math.max(gy, WATER - 0.6);
    const tm = U.uTime.value;
    const bob = D.hover ? D.hover + Math.sin(tm * 2 + this.homeX) * 0.2 : (moving ? Math.abs(Math.sin(tm * 9)) * 0.08 : 0);
    this.model.position.set(this.x, this.y + bob, this.z);
    this.model.rotation.y = this.face;
    // Ausholen sichtbar machen
    const wind = this.state === 'windup' ? 1 - Math.max(0, this.t) / (D.windup * (this.boss ? 1.25 : 1)) : 0;
    this.model.rotation.x = this.state === 'windup' ? -wind * 0.35 : this.state === 'recover' && this.t > D.cool - 0.15 ? 0.3 : 0;
    this.flash = Math.max(0, this.flash - dt);
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i];
      if (this.flash > 0) m.emissive.setRGB(0.9, 0.85, 1);
      else if (wind > 0) m.emissive.copy(this.baseEmissive[i]).lerp(_c1.setRGB(0.6, 0.15, 0.25), wind);
      else m.emissive.copy(this.baseEmissive[i]);
    }
    if (this.type === 'schatten') this.model.children[0].material.uniforms.uAlpha.value = 1;
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
