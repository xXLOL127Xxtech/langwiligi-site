// Turbo-Kart – Effekte (Partikel) und der Ablauf eines Rennens bzw. einer Schlacht
'use strict';

// ---------- Partikel ----------
class Partikel {
  constructor(szene, n, additiv) {
    this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3);
    this.c = new Float32Array(n * 3); this.s = new Float32Array(n); this.a = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('farbe', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('groesse', new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { skala: { value: 600 }, tex: { value: Tex.punkt() } },
      transparent: true, depthWrite: false, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 farbe; attribute float groesse; attribute float alpha; uniform float skala; varying vec3 vC; varying float vA;
        void main(){ vC = farbe; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = groesse*skala/max(-mv.z,0.1); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D tex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); if (gl_FragColor.a < 0.01) discard; }`,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = additiv ? 5 : 4;
    szene.add(this.pts);
    for (let i = 0; i < n; i++) this.p[i * 3 + 1] = -9999;
  }
  neu(x, y, z, vx, vy, vz, farbe, leben, s0, s1, grav = 0, drag = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = farbe.r; this.c[i * 3 + 1] = farbe.g; this.c[i * 3 + 2] = farbe.b;
    this.life[i] = leben; this.max[i] = leben; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.drag[i] = drag;
  }
  schritt(dt) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.a[i] = 0; continue; }
      this.life[i] -= dt;
      const f = 1 - this.life[i] / this.max[i];
      const k = i * 3;
      this.v[k + 1] -= this.grav[i] * dt;
      if (this.drag[i]) { const d = Math.exp(-this.drag[i] * dt); this.v[k] *= d; this.v[k + 1] *= d; this.v[k + 2] *= d; }
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * f;
      this.a[i] = this.life[i] > 0 ? Math.min(1, (1 - f) * 1.6) : 0;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.farbe.needsUpdate = true;
    this.geo.attributes.groesse.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }
}

// Reifenspuren beim Driften (Ringpuffer aus Vierecken)
class Spuren {
  constructor(szene, n) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 4 * 3);
    this.alpha = new Float32Array(n * 4);
    const idx = [];
    for (let q = 0; q < n; q++) { const v = q * 4; idx.push(v, v + 1, v + 2, v, v + 2, v + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.06, 0.06, 0.07, vA * 0.55); }',
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    szene.add(this.mesh);
    this.letzte = new Map();
    this.dirty = false;
  }
  punkt(key, x, y, z, yaw, an) {
    const l = this.letzte.get(key);
    if (!an) { if (l) this.letzte.delete(key); return; }
    if (l && (x - l.x) ** 2 + (z - l.z) ** 2 < 0.4) return;
    if (l && (x - l.x) ** 2 + (z - l.z) ** 2 < 25) {
      const b = 0.16, cx = Math.cos(yaw) * b, sz = -Math.sin(yaw) * b;
      const lcx = Math.cos(l.yaw) * b, lsz = -Math.sin(l.yaw) * b;
      const q = this.i; this.i = (this.i + 1) % this.n;
      const P = this.pos, o = q * 12;
      P[o] = l.x - lcx; P[o + 1] = l.y + 0.05; P[o + 2] = l.z - lsz;
      P[o + 3] = l.x + lcx; P[o + 4] = l.y + 0.05; P[o + 5] = l.z + lsz;
      P[o + 6] = x + cx; P[o + 7] = y + 0.05; P[o + 8] = z + sz;
      P[o + 9] = x - cx; P[o + 10] = y + 0.05; P[o + 11] = z - sz;
      for (let k = 0; k < 4; k++) this.alpha[q * 4 + k] = 1;
      this.dirty = true;
    }
    this.letzte.set(key, { x, y, z, yaw });
  }
  schritt(dt) {
    // langsam ausblenden
    const a = this.alpha, f = dt * 0.12;
    for (let i = 0; i < a.length; i++) if (a[i] > 0) { a[i] = Math.max(0, a[i] - f); }
    this.geo.attributes.alpha.needsUpdate = true;
    if (this.dirty) { this.geo.attributes.position.needsUpdate = true; this.dirty = false; }
  }
}

const _c = new THREE.Color();
class Effekte {
  constructor(r) {
    this.r = r;
    const viel = r.qual === 'niedrig' ? 0.5 : 1;
    this.viel = viel;
    this.add = new Partikel(r.szene, Math.round(2600 * viel), true);
    this.nor = new Partikel(r.szene, Math.round(1600 * viel), false);
    this.spuren = new Spuren(r.szene, r.qual === 'niedrig' ? 300 : 900);
    this.meshes = [];
  }
  skala(h) { this.add.mat.uniforms.skala.value = h; this.nor.mat.uniforms.skala.value = h; }
  farbe(f) { return typeof f === 'string' ? _c.set(f) : f; }
  funken(pos, nx, nz) {
    for (let i = 0; i < 14 * this.viel; i++) {
      this.add.neu(pos.x - nx * 1.1, pos.y + 0.5, pos.z - nz * 1.1, nx * 4 + (Math.random() - 0.5) * 10, 3 + Math.random() * 5, nz * 4 + (Math.random() - 0.5) * 10, this.farbe('#ffc040'), 0.35 + Math.random() * 0.2, 0.16, 0.03, 18);
    }
  }
  glitzer(pos, farbe, n) {
    const f = this.farbe(farbe).clone();
    for (let i = 0; i < n * this.viel; i++) {
      const a = Math.random() * TAU, v = 3 + Math.random() * 5;
      this.add.neu(pos.x, pos.y, pos.z, Math.cos(a) * v, Math.random() * 6, Math.sin(a) * v, f, 0.5 + Math.random() * 0.3, 0.32, 0.05, 8, 2);
    }
  }
  muenzenWeg(pos, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.add.neu(pos.x, pos.y + 1, pos.z, Math.cos(a) * 5, 8, Math.sin(a) * 5, this.farbe('#ffd23a'), 0.8, 0.55, 0.3, 22);
    }
  }
  boxBruch(pos) {
    for (let i = 0; i < 26 * this.viel; i++) {
      const a = Math.random() * TAU, v = 4 + Math.random() * 8;
      _c.setHSL(Math.random(), 1, 0.65);
      this.add.neu(pos.x, pos.y, pos.z, Math.cos(a) * v, Math.random() * 8 - 1, Math.sin(a) * v, _c, 0.6 + Math.random() * 0.4, 0.42, 0.05, 6, 2);
    }
    for (let i = 0; i < 8; i++) {
      _c.setHSL(Math.random(), 0.9, 0.6);
      const m = new THREE.Mesh(G.box(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: _c.clone(), transparent: true, opacity: 0.85 }));
      m.position.copy(pos);
      const a = Math.random() * TAU, v = 5 + Math.random() * 6;
      this.mesh(m, new THREE.Vector3(Math.cos(a) * v, 4 + Math.random() * 6, Math.sin(a) * v), 0.8, 25);
    }
  }
  truemmer(pos, farbe) {
    const f = this.farbe(farbe).clone();
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(G.box(0.3, 0.12, 0.3), new THREE.MeshLambertMaterial({ color: f, transparent: true }));
      m.position.copy(pos); m.position.y += 0.4;
      const a = Math.random() * TAU, v = 3 + Math.random() * 4;
      this.mesh(m, new THREE.Vector3(Math.cos(a) * v, 5 + Math.random() * 4, Math.sin(a) * v), 0.9, 25);
    }
    this.glitzer(pos, '#ffffff', 8);
  }
  mesh(m, vel, leben, grav) {
    this.r.szene.add(m);
    this.meshes.push({ m, vel, leben, max: leben, grav, rot: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0) });
  }
  explosion(pos, radius) {
    const kugel = new THREE.Mesh(G.kugel(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffb030', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    kugel.position.copy(pos); kugel.position.y += 1;
    this.r.szene.add(kugel);
    this.meshes.push({ m: kugel, vel: new THREE.Vector3(), leben: 0.6, max: 0.6, grav: 0, explo: radius });
    for (let i = 0; i < 60 * this.viel; i++) {
      const a = Math.random() * TAU, b = Math.random() * Math.PI, v = 6 + Math.random() * 14;
      _c.setHSL(0.02 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.3);
      this.add.neu(pos.x, pos.y + 1, pos.z, Math.cos(a) * Math.sin(b) * v, Math.cos(b) * v * 0.6 + 4, Math.sin(a) * Math.sin(b) * v, _c, 0.5 + Math.random() * 0.5, 1.6, 0.3, 2, 2.5);
    }
    for (let i = 0; i < 24 * this.viel; i++) {
      const a = Math.random() * TAU, v = 2 + Math.random() * 5;
      _c.setRGB(0.25, 0.22, 0.22);
      this.nor.neu(pos.x, pos.y + 1, pos.z, Math.cos(a) * v, 3 + Math.random() * 4, Math.sin(a) * v, _c, 1.4 + Math.random(), 2.5, 6, -1, 1.5);
    }
  }
  welle(pos, radius) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff6a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(pos); ring.position.y += 0.8;
    this.r.szene.add(ring);
    this.meshes.push({ m: ring, vel: new THREE.Vector3(), leben: 0.5, max: 0.5, grav: 0, welle: radius });
  }
  spur(pos, farbe) {
    this.add.neu(pos.x, pos.y + 0.6, pos.z, 0, 0.5, 0, this.farbe(farbe), 0.5, 0.7, 0.1);
  }
  text(k, s) { if (k.lokal >= 0 && this.r.anzeige) this.r.anzeige.toast(k.lokal, s); }
  // Laufende Effekte an den Karts
  kart(k, dt) {
    if (!k.m.root.visible) return;
    const v = this.viel;
    const spur = k.drift.an && !k.luft && k.P.flaeche !== 'gelaende';
    for (let i = 0; i < 2; i++) {
      if (spur) k.hinterradPos(i, _v1);
      this.spuren.punkt(k.idx * 2 + i, _v1.x, _v1.y - 0.06, _v1.z, k.anzeigeYaw, spur && isFinite(_v1.x + _v1.y + _v1.z));
    }
    if (k.drift.an && !k.luft) {
      const st = k.drift.stufe;
      for (let i = 0; i < 2; i++) {
        k.hinterradPos(i, _v1);
        if (st > 0) {
          const f = FUNKEN_FARBEN[st];
          for (let j = 0; j < (st === 3 ? 3 : 2) * v; j++)
            this.add.neu(_v1.x, _v1.y + 0.15, _v1.z, (Math.random() - 0.5) * 6 - Math.sin(k.yaw) * 3, 1 + Math.random() * 4, (Math.random() - 0.5) * 6 - Math.cos(k.yaw) * 3, f, 0.16 + Math.random() * 0.14, 0.2, 0.04, 10);
          if (Math.random() < 0.35) this.add.neu(_v1.x, _v1.y + 0.25, _v1.z, 0, 0.5, 0, f, 0.1, 0.55, 0.3);
        } else if (Math.random() < 0.5 * v) {
          this.nor.neu(_v1.x, _v1.y + 0.1, _v1.z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, this.farbe('#e8e8f0'), 0.5, 0.6, 1.8, -0.5, 1);
        }
      }
    }
    if (k.boostT > 0 || k.raketeT > 0) {
      for (const a of k.m.auspuff) {
        _v1.copy(a); _v1.z -= 0.6;
        k.m.koerper.localToWorld(_v1);
        if (Math.random() < 0.8 * v) if (Math.random() < 0.5) this.add.neu(_v1.x, _v1.y, _v1.z, -Math.sin(k.yaw) * 4 + (Math.random() - 0.5) * 2, 1 + Math.random(), -Math.cos(k.yaw) * 4 + (Math.random() - 0.5) * 2, this.farbe(k.boostT > 1.5 ? '#c070ff' : '#ff9a20'), 0.2, 0.45, 0.1);
      }
    }
    if (k.P.flaeche === 'gelaende' && !k.luft && Math.abs(k.v) > 6 && Math.random() < 0.6 * v) {
      const th = this.r.welt.th.boden;
      const col = th === 'schnee' ? '#ffffff' : th === 'sand' ? '#e8c890' : th === 'stadt' ? '#808088' : '#9a7a50';
      k.hinterradPos(Math.random() < 0.5 ? 0 : 1, _v1);
      this.nor.neu(_v1.x, _v1.y + 0.2, _v1.z, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, this.farbe(col), 0.7, 0.8, 2.4, 1, 1);
    }
    if (k.sternT > 0 && Math.random() < 0.9 * v) {
      _c.setHSL(Math.random(), 1, 0.65);
      this.add.neu(k.pos.x + (Math.random() - 0.5) * 2.5, k.pos.y + Math.random() * 2, k.pos.z + (Math.random() - 0.5) * 2.5, 0, 2, 0, _c, 0.5, 0.4, 0.05);
    }
    if (k.abgewuergt > 0 && Math.random() < 0.6) {
      this.nor.neu(k.pos.x, k.pos.y + 1, k.pos.z, (Math.random() - 0.5), 2, (Math.random() - 0.5), this.farbe('#555'), 1, 0.8, 2.5, -1, 1);
    }
  }
  schritt(dt) {
    this.add.schritt(dt); this.nor.schritt(dt); this.spuren.schritt(dt);
    for (const e of this.meshes) {
      e.leben -= dt;
      const f = 1 - e.leben / e.max;
      if (e.explo) { e.m.scale.setScalar(1 + f * e.explo); e.m.material.opacity = 0.9 * (1 - f); }
      else if (e.welle) { e.m.scale.setScalar(1 + f * e.welle); e.m.material.opacity = 0.9 * (1 - f); }
      else {
        e.vel.y -= e.grav * dt;
        e.m.position.addScaledVector(e.vel, dt);
        e.m.rotation.x += e.rot.x * dt; e.m.rotation.y += e.rot.y * dt;
        if (e.m.material.transparent) e.m.material.opacity = Math.min(1, (1 - f) * 2);
      }
      if (e.leben <= 0) { this.r.szene.remove(e.m); e.m.material.dispose(); }
    }
    this.meshes = this.meshes.filter(e => e.leben > 0);
  }
}

// ---------- Rennen ----------
const GP_PUNKTE = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];

class Rennen {
  // cfg: { modus, strecke, cc, ki, items, teams, runden, fahrer: [...], demo, netz, qual }
  constructor(cfg, szene, anzeige) {
    this.cfg = cfg; this.szene = szene; this.anzeige = anzeige;
    this.modus = cfg.modus; this.cc = cfg.cc || 150; this.itemModus = cfg.items || 'normal';
    this.teams = !!cfg.teams; this.runden = cfg.runden || 3; this.demo = !!cfg.demo;
    this.netz = cfg.netz || null; this.qual = cfg.qual || 'hoch';
    this.welt = this.modus === 'schlacht' ? new Arena(ARENEN[cfg.strecke]) : new Strecke(STRECKEN[cfg.strecke]);
    this.welt.baue(this.qual);
    szene.add(this.welt.gruppe);
    this.licht();
    this.fx = new Effekte(this);
    this.items = new Items(this);
    this.items.gast = !!(this.netz && !this.netz.host);
    this.items.aufbauen();
    this.karts = cfg.fahrer.map((f, i) => new Kart(this, i, Object.assign({ botStufe: cfg.ki }, f)));
    for (const k of this.karts) {
      szene.add(k.m.root); szene.add(k.schatten); szene.add(k.drohne);
      if (k.typ === 'bot') k.bot = new Bot(k, k.botStufe);
    }
    this.lokale = this.karts.filter(k => k.typ === 'spieler').sort((a, b) => a.lokal - b.lokal);
    this.startAufstellung();
    this.zeit = 0; this.rennZeit = 0;
    this.phase = this.demo ? 'rennen' : 'intro';
    this.phaseT = 0; this.cd = 3.0;
    this.zielReihe = 0; this.endeT = -1; this.ersterFertig = -1;
    this.schlachtZeit = 150;
    this.letzteRundeGespielt = false;
    this.ergebnis = null;
    if (this.demo) for (const k of this.karts) k.v = 20;
  }
  licht() {
    const th = this.welt.th, s = this.szene;
    this.hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2] * 0.72);
    s.add(this.hemi);
    const amb = new THREE.AmbientLight('#ffffff', th.nacht ? 0.25 : 0.1); s.add(amb);
    this.sonne = new THREE.DirectionalLight(th.sonne, th.sonneI * 0.82);
    this.sonne.position.set(60, 100, 40);
    const sch = this.qual !== 'niedrig';
    this.sonne.castShadow = sch;
    if (sch) {
      const gr = this.qual === 'hoch' ? 2048 : 1024;
      this.sonne.shadow.mapSize.set(gr, gr);
      const c = this.sonne.shadow.camera;
      c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 260;
      this.sonne.shadow.bias = -0.0008;
      this.sonne.shadow.normalBias = 0.02;
    }
    s.add(this.sonne); s.add(this.sonne.target);
    s.fog = new THREE.Fog(th.nebel[0], th.nebel[1], th.nebel[2]);
    s.background = new THREE.Color(th.himmel[1]);
    this.sonnenRichtung = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    // Spiegelungen für glänzende Teile (Chrom, Lack, Münzen)
    try {
      const es = new THREE.Scene();
      const sg = new THREE.SphereGeometry(10, 32, 16);
      const oben = new THREE.Color(th.himmel[0]), mitte = new THREE.Color(th.himmel[1]), unten = new THREE.Color(th.nacht ? '#1a1a24' : '#6a6658');
      const sonnenDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
      const cols = [], pos = sg.attributes.position, tmp = new THREE.Vector3(), cc = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i).normalize();
        const h = tmp.y;
        if (h > 0) cc.copy(mitte).lerp(oben, h); else cc.copy(mitte).lerp(unten, Math.min(1, -h * 3));
        const sd = tmp.dot(sonnenDir);
        if (sd > 0.93) cc.multiplyScalar(1 + (sd - 0.93) * 40);
        cols.push(cc.r, cc.g, cc.b);
      }
      sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const kug = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
      es.add(kug);
      const pm = new THREE.PMREMGenerator(Anzeige.renderer);
      this.envTex = pm.fromScene(es, 0.02).texture;
      s.environment = this.envTex;
      pm.dispose();
    } catch (e) { }
  }
  sonneAuf(p) {
    this.sonne.position.set(p.x + this.sonnenRichtung.x * 120, p.y + this.sonnenRichtung.y * 120, p.z + this.sonnenRichtung.z * 120);
    this.sonne.target.position.copy(p);
  }
  startAufstellung() {
    const w = this.welt;
    if (w.istArena) {
      const n = this.karts.length;
      this.karts.forEach((k, i) => {
        const a = i / n * TAU + Math.PI / 4;
        const rr = w.gr * 0.78;
        let x = Math.sin(a) * rr, z = Math.cos(a) * rr;
        k.setzeStart(new THREE.Vector3(x, 0, z), wrapA(a + Math.PI));
        k.ballons = 3;
      });
      return;
    }
    this.karts.forEach((k, i) => {
      const s = w.startS - 7 - i * 4.6;
      const A = w.S[w.idx(s)];
      const d = (i % 2 ? 1 : -1) * A.w * 0.42;
      k.setzeStart(w.punkt(s, d), A.h);
      k.relS = undefined; k.runde = 0;
      k.rundenCheck();
      k.runde = 0;
    });
  }
  gleichesTeam(a, b) { return this.teams && a && b && a.team >= 0 && a.team === b.team; }
  // ---------- Hauptschleife ----------
  update(dt) {
    this.zeit += dt;
    this.phaseT += dt;
    const gast = this.netz && !this.netz.host;
    // Ablauf
    if (!gast) {
      if (this.phase === 'intro') {
        if (this.phaseT > (this.cfg.introDauer || 3.2) || (Eingabe.hit.size && !this.netz)) { this.phase = 'countdown'; this.phaseT = 0; this.cd = 3.0; }
      } else if (this.phase === 'countdown') {
        this.cd -= dt;
        if (this.cd <= 0) this.los();
      }
    } else if (this.phase === 'countdown') this.cd -= dt;
    if (this.phase === 'countdown') this.countdownSchritt();
    if (this.phase === 'rennen' || this.phase === 'ende') this.rennZeit += this.phase === 'rennen' ? dt : 0;
    // Eingaben
    const eingaben = new Map();
    for (const k of this.karts) {
      if (k.typ === 'spieler') {
        let inp = Eingabe.spieler(k.lokal);
        if ((k.fertig && !this.welt.istArena) || this.phase === 'ende') { if (!k.bot) k.bot = new Bot(k, 1); inp = k.bot.input(dt); }
        if (this.phase !== 'rennen') { inp.driftDruck = inp.driftDruck && false; }
        eingaben.set(k, inp);
      } else if (k.typ === 'bot' && !gast) {
        eingaben.set(k, this.phase === 'rennen' || this.phase === 'ende' ? k.bot.input(dt) : { gas: 0, bremse: 0, lenk: 0 });
      }
    }
    // Gummiband für Computer
    if (!gast && this.phase === 'rennen' && !this.welt.istArena) this.gummiband();
    // Physik in kleinen Schritten
    const n = Math.max(1, Math.ceil(dt / (1 / 90)));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      for (const k of this.karts) {
        const inp = eingaben.get(k);
        if (inp) {
          k.schritt(h, s === 0 ? inp : Object.assign({}, inp, { driftDruck: false, itemDruck: false, itemLos: false }));
        } else k.netzSchritt(h);
      }
      this.kollisionen();
    }
    // Items benutzen
    if (this.phase === 'rennen') for (const [k, inp] of eingaben) this.items.steuerung(k, inp);
    this.items.schritt(dt);
    this.items.boxenSchritt(dt, this.zeit);
    // Plätze
    this.plaetze();
    // Schlacht-Zeit
    if (this.welt.istArena && this.phase === 'rennen' && !gast) {
      this.schlachtZeit -= dt;
      for (const k of this.karts) if (k.ballonsZurueck !== undefined) { k.ballonsZurueck -= dt; if (k.ballonsZurueck <= 0) { k.ballons = 3; k.ballonsZurueck = undefined; k.schutzT = 2; } }
      if (this.schlachtZeit <= 0) { this.schlachtZeit = 0; this.beenden(); }
    }
    // Ende des Rennens
    if (!gast && this.phase === 'rennen' && !this.welt.istArena && !this.demo) {
      const menschen = this.karts.filter(k => k.istMensch());
      if (menschen.length && menschen.every(k => k.fertig)) { if (this.endeT < 0) this.endeT = 2.5; }
      if (this.ersterFertig >= 0 && this.rennZeit - this.ersterFertig > 45) this.endeT = 0.01;
      if (this.endeT > 0) { this.endeT -= dt; if (this.endeT <= 0) this.beenden(); }
    }
    // Demo: Runden zählen spielt keine Rolle
    if (this.demo) for (const k of this.karts) if (k.runde > 50) k.runde = 1;
    // Darstellung
    for (const k of this.karts) { k.darstellen(dt, this.zeit); if (this.phase !== 'intro') this.fx.kart(k, dt); }
    this.items.darstellen(dt, this.zeit);
    this.fx.schritt(dt);
    for (const f of this.welt.anim) f(this.zeit);
    WuerfelMat.uniforms.zeit.value = this.zeit;
    FalleMat.uniforms.zeit.value = this.zeit;
    this.ampel();
    // Ton
    this.lokale.forEach((k, i) => {
      const max = CC[this.cc].max;
      Ton.motor(i, clamp(Math.abs(k.v) / max, 0, 1.3), k.boostT > 0 || k.raketeT > 0, k.drift.an && !k.luft, this.phase !== 'intro' && k.rettung <= 0);
    });
  }
  countdownSchritt() {
    // Raketenstart: Gas im richtigen Moment drücken
    const t = this.cd;
    const sek = Math.ceil(t);
    if (sek !== this.letzteSek && sek >= 1 && sek <= 3) { this.letzteSek = sek; Ton.sfx('drei'); if (this.anzeige) this.anzeige.countdown(sek); }
    for (const k of this.karts) {
      if (k.typ !== 'spieler') continue;
      const gas = Eingabe.spieler(k.lokal).gas && !Einst.autogas ? 1 : 0;
      if (gas && k.startGas < 0) k.startGas = t;
      if (!gas) k.startGas = -1;
    }
  }
  los() {
    this.phase = 'rennen'; this.phaseT = 0; this.rennZeit = 0;
    Ton.sfx('los');
    if (this.anzeige) this.anzeige.countdown(0);
    for (const k of this.karts) {
      k.rundeStart = 0;
      if (k.typ === 'spieler') {
        if (k.startGas > 0.95 && k.startGas < 1.75) { k.boost(1.2, 'start'); this.fx.text(k, 'Raketenstart!'); }
        else if (k.startGas >= 2.25) { k.abgewuergt = 0.9; this.fx.text(k, 'Abgewürgt!'); }
      } else if (k.typ === 'bot' && Math.random() < [0.15, 0.35, 0.6][k.botStufe]) k.boost(1.0, 'start');
    }
    if (this.netz && this.netz.host) this.netz.rundeStart();
  }
  ampel() {
    const L = this.welt.ampelLichter;
    if (!L) return;
    const t = this.phase === 'countdown' ? this.cd : -1;
    L.forEach((l, i) => {
      let an = false, farbe = '#ff2a2a';
      if (this.phase === 'countdown') an = t <= 3 - i && t > 0;
      if (this.phase === 'rennen' && this.rennZeit < 2.5) { an = true; farbe = '#2aff4a'; }
      l.material.color.set(an ? farbe : '#333');
      l.material.emissive.set(an ? farbe : '#000');
      l.material.emissiveIntensity = an ? 2 : 0;
    });
  }
  gummiband() {
    let best = -1e9;
    for (const k of this.karts) if (k.istMensch() && !k.fertig) best = Math.max(best, k.fortschritt);
    if (best < -1e8) best = Math.max(...this.karts.map(k => k.fortschritt));
    for (const k of this.karts) {
      if (k.typ !== 'bot') continue;
      const st = KI_STUFEN[k.botStufe];
      const diff = best - k.fortschritt;
      k.botTempo = st.tempo * (1 + clamp(diff / 350, -0.6, 1) * st.gummi);
    }
  }
  kollisionen() {
    const K = this.karts;
    for (let i = 0; i < K.length; i++) {
      const a = K[i];
      if (a.rettung > 0) continue;
      for (let j = i + 1; j < K.length; j++) {
        const b = K[j];
        if (b.rettung > 0) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
        if (Math.abs(dy) > 2.5) continue;
        const ra = a.kleinT > 0 ? 0.7 : 1.2, rb = b.kleinT > 0 ? 0.7 : 1.2;
        const rr = ra + rb;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = rr - d;
        const aStark = a.sternT > 0 || a.raketeT > 0, bStark = b.sternT > 0 || b.raketeT > 0;
        if (!this.netz || this.netz.host) {
          if (aStark && !bStark && !this.gleichesTeam(a, b)) this.trifft(b, 'salto', a);
          if (bStark && !aStark && !this.gleichesTeam(a, b)) this.trifft(a, 'salto', b);
          if (a.kleinT > 0 && b.kleinT <= 0 && !aStark) this.trifft(a, 'platt', b);
          if (b.kleinT > 0 && a.kleinT <= 0 && !bStark) this.trifft(b, 'platt', a);
        }
        let ma = a.w.gewicht + (aStark ? 20 : 0) + (a.kleinT > 0 ? -1 : 0), mb = b.w.gewicht + (bStark ? 20 : 0) + (b.kleinT > 0 ? -1 : 0);
        ma = Math.max(0.5, ma); mb = Math.max(0.5, mb);
        const aFrei = a.typ !== 'netz', bFrei = b.typ !== 'netz';
        const wa = aFrei ? (bFrei ? mb / (ma + mb) : 1) : 0, wb = bFrei ? (aFrei ? ma / (ma + mb) : 1) : 0;
        a.pos.x -= nx * ov * wa; a.pos.z -= nz * ov * wa;
        b.pos.x += nx * ov * wb; b.pos.z += nz * ov * wb;
        const vax = Math.sin(a.mYaw) * a.v + a.ix, vaz = Math.cos(a.mYaw) * a.v + a.iz;
        const vbx = Math.sin(b.mYaw) * b.v + b.ix, vbz = Math.cos(b.mYaw) * b.v + b.iz;
        const vrel = (vbx - vax) * nx + (vbz - vaz) * nz;
        if (vrel < 0) {
          const imp = -vrel * 1.5 + 3;
          if (aFrei) { a.ix -= nx * imp * wa; a.iz -= nz * imp * wa; }
          if (bFrei) { b.ix += nx * imp * wb; b.iz += nz * imp * wb; }
          if ((a.lokal >= 0 || b.lokal >= 0) && -vrel > 4) { Ton.sfx('rempel', Math.min(1, -vrel / 15)); }
        }
      }
    }
  }
  plaetze() {
    if (this.netz && !this.netz.host) return;
    const K = [...this.karts];
    if (this.welt.istArena) {
      K.sort((a, b) => (b.punkte - a.punkte) || (b.ballons - a.ballons) || (a.idx - b.idx));
    } else {
      K.sort((a, b) => {
        if (a.fertig && b.fertig) return (a.zielZeit - b.zielZeit) || (a.zielReihe - b.zielReihe);
        if (a.fertig) return -1; if (b.fertig) return 1;
        return b.fortschritt - a.fortschritt;
      });
    }
    K.forEach((k, i) => { if (k.platz !== i + 1 && k.lokal >= 0 && this.anzeige) this.anzeige.platzWechsel(k.lokal); k.platz = i + 1; });
  }
  rundeGeschafft(k) {
    if (this.demo || this.phase === 'intro') return;
    if (k.runde >= 2) { k.rundenZeiten.push(this.rennZeit - k.rundeStart); }
    k.rundeStart = this.rennZeit;
    if (k.runde > this.runden && !k.fertig) {
      k.fertig = true; k.zielZeit = this.rennZeit; k.zielReihe = this.zielReihe++;
      if (this.ersterFertig < 0 && k.istMensch()) this.ersterFertig = this.rennZeit;
      if (k.lokal >= 0) {
        Ton.sfx(k.platz <= Math.max(3, Math.ceil(this.karts.length / 2)) ? 'ziel' : 'verloren');
        if (this.anzeige) this.anzeige.ziel(k.lokal, k);
        if (this.modus === 'zeit') this.zeitRekord(k);
      }
      if (this.netz && this.netz.host) this.netz.fertig(k);
      return;
    }
    if (k.lokal >= 0 && k.runde >= 2 && k.runde <= this.runden) {
      if (k.runde === this.runden) {
        if (this.anzeige) this.anzeige.gross(k.lokal, 'Letzte Runde!', 'letzte');
        if (!this.letzteRundeGespielt) { this.letzteRundeGespielt = true; Ton.sfx('letzte'); setTimeout(() => Ton.tempo(1.06), 1500); setTimeout(() => Ton.tempo(1), 16000); }
      } else {
        Ton.sfx('runde');
        if (this.anzeige) this.anzeige.gross(k.lokal, 'Runde ' + k.runde, 'runde');
      }
    }
  }
  zeitRekord(k) {
    const id = this.welt.def.id + '-' + this.cc;
    const alt = Rekorde[id];
    const bestRunde = Math.min(...k.rundenZeiten);
    const neu = !alt || k.zielZeit < alt.zeit;
    if (neu) { Rekorde[id] = { zeit: k.zielZeit, runde: bestRunde, fi: k.fi }; rekordSpeichern(); }
    this.neuerRekord = neu;
  }
  // Zentrale Treffer-Stelle (Host bzw. offline)
  trifft(o, art, quelle, extra) {
    if (!o || o.rettung > 0) return;
    if (this.netz && !this.netz.host) return;
    if (art === 'tinte') {
      if (o.typ === 'netz') this.netz.treffer(o, 'tinte', quelle);
      else { o.tinteT = 5; if (o.lokal >= 0 && this.anzeige) { this.anzeige.tinte(o.lokal); Ton.sfx('tinte'); } }
      return;
    }
    // Prüfen ob der Treffer zählt
    if (o.sternT > 0 || o.raketeT > 0) return;
    if (art !== 'blitz' && (o.schutzT > 0 || o.treffer)) return;
    if (o.typ === 'netz') {
      this.netz.treffer(o, art, quelle, extra);
      o.treffer = { art, t: 0, dauer: 1.2 };
      if (art === 'blitz' && extra) o.kleinT = extra.klein;
    } else {
      const ok = o.getroffen(art, quelle);
      if (!ok) return;
      if (art === 'blitz' && extra) { o.kleinT = extra.klein; o.gehalten = null; o.orbit = []; if (o.item && o.lokal < 0) o.item = null; }
    }
    if (this.welt.istArena) this.ballonWeg(o, quelle);
  }
  ballonWeg(o, quelle) {
    if (o.ballons <= 0) return;
    o.ballons--;
    this.fx.glitzer(o.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), o.farbe, 20);
    Ton.sfx('ballon', o.lokal >= 0 ? 1 : 0.5);
    if (quelle && quelle !== o && !this.gleichesTeam(o, quelle)) {
      quelle.punkte++;
      if (quelle.lokal >= 0 && this.anzeige) this.anzeige.toast(quelle.lokal, '+1 Punkt!');
    }
    if (o.ballons <= 0) {
      o.punkte = Math.max(0, o.punkte - 1);
      o.ballonsZurueck = 2.5;
      if (o.lokal >= 0 && this.anzeige) this.anzeige.toast(o.lokal, 'Alle Ballons weg! −1 Punkt');
    }
    if (this.netz && this.netz.host) this.netz.ereignis('ballon', o);
  }
  ereignis(typ, k, daten) {
    if (this.anzeige) this.anzeige.ereignis(typ, k, daten);
    if (this.netz) this.netz.ereignis(typ, k, daten);
  }
  kameraWackeln(lokal, st) { if (this.anzeige) this.anzeige.wackeln(lokal, st); }
  kameraWackelnAlle(pos, st) { for (const k of this.lokale) { const d = k.pos.distanceTo(pos); if (d < 30) this.kameraWackeln(k.lokal, st * (1 - d / 30)); } }
  kameraStoss(lokal) { if (this.anzeige) this.anzeige.stoss(lokal); }
  beenden() {
    if (this.phase === 'ende') return;
    this.phase = 'ende'; this.phaseT = 0;
    this.plaetze();
    const liste = [...this.karts].sort((a, b) => a.platz - b.platz);
    this.ergebnis = liste.map((k, i) => ({
      idx: k.idx, name: k.name, fi: k.fi, team: k.team, typ: k.typ, lokal: k.lokal, slot: k.slot,
      platz: i + 1, zeit: k.fertig ? k.zielZeit : null, punkte: this.welt.istArena ? k.punkte : GP_PUNKTE[i] || 0,
      bestRunde: k.rundenZeiten.length ? Math.min(...k.rundenZeiten) : null,
    }));
    if (this.netz && this.netz.host) this.netz.ende(this.ergebnis);
    if (this.onEnde) this.onEnde(this.ergebnis);
  }
  entsorgen() {
    this.szene.traverse(o => {
      if (o.isMesh || o.isPoints || o.isSprite) {
        if (o.geometry && !Object.values(G.cache).includes(o.geometry)) o.geometry.dispose();
      }
    });
    while (this.szene.children.length) this.szene.remove(this.szene.children[0]);
    this.szene.fog = null;
    if (this.envTex) { this.envTex.dispose(); this.szene.environment = null; }
  }
}
