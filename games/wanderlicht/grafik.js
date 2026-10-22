'use strict';
// Wanderlicht – Grafik: Renderer in voller Auflösung mit Kantenglättung, Schatten, Himmel, Wetter, Wasser, Gelände

const G = {
  renderer: null, scene: null, camera: null, rt: null, postScene: null, postCam: null, postMat: null,
  hemi: null, sun: null, lantern: null, torches: [],
  quality: 2, view: 1, w: 1, h: 1, scale: 1,
  chunks: new Map(), grass: new Map(),
  flash: 0, hurt: 0, fade: 0,
};

// Gemeinsame Uniforms aller eigenen Shader
const U = {
  uTime: { value: 0 }, uWind: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.9, 0.4) },
  uLight: { value: new THREE.Color(1, 1, 1) }, uSunCol: { value: new THREE.Color(0, 0, 0) },
  uFogColor: { value: new THREE.Color() }, uFogNear: { value: 30 }, uFogFar: { value: 220 },
  uScale: { value: 150 }, uPx: { value: 3 }, uCam: { value: new THREE.Vector3() },
  uLanternPos: { value: new THREE.Vector3() }, uLanternCol: { value: new THREE.Color(0, 0, 0) },
  uGrassFar: { value: 70 }, uNeon: { value: 0 }, uNearCut: { value: 0 }, uFarCut: { value: 0 },
  uSunDirW: { value: new THREE.Vector3(0, 1, 0) }, uCDrift: { value: new THREE.Vector2() }, uCShadow: { value: 0 },
  uPlayer: { value: new THREE.Vector3() }, uLDir: { value: new THREE.Vector3(0, 1, 0) },
  uAmb: { value: new THREE.Color() }, uAmbG: { value: new THREE.Color() }, uSunL: { value: new THREE.Color() },
};

const VIEW_SETTINGS = [
  { name: 'Nah', chunks: 3, far: 950, grass: 45, grassMax: 2600, farR: 650, ultraR: 2000, leaf: 70 },
  { name: 'Mittel', chunks: 4, far: 1300, grass: 62, grassMax: 3600, farR: 900, ultraR: 3000, leaf: 90 },
  { name: 'Weit', chunks: 5, far: 1700, grass: 80, grassMax: 4600, farR: 1150, ultraR: 4200, leaf: 110 },
];
// Bildqualität: Auflösung, Schatten und Kantenglättung
const QUALITY = [
  { name: 'Niedrig', scale: 0.7, shadow: 0, msaa: 0, grass: 0.5, leaf: 0.7 },
  { name: 'Mittel', scale: 1, shadow: 1024, msaa: 2, grass: 0.8, leaf: 0.8 },
  { name: 'Hoch', scale: 1.25, shadow: 2048, msaa: 4, grass: 1, leaf: 1 },
];

// Oberflächen-Kennungen für die Shader (Mauerwerk, Holz, Rinde, ...)
const MT = { gen: 0, stone: 1, wood: 2, bark: 3, ground: 4, cloth: 5, metal: 6, roof: 7, flag: 8, emit: 9, plaster: 10, marble: 11, gold: 12 };

// ---------- Hilfen für zusammengefügte Geometrie ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _n3 = new THREE.Matrix3(), _vn = new THREE.Vector3();
function M(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}
function smoothGeo(g) {
  const n = g.index ? g.toNonIndexed() : g;
  return { p: n.attributes.position.array, n: n.attributes.normal.array };
}
function flatGeo(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return { p: n.attributes.position.array, n: n.attributes.normal.array }; }
// Felsbrocken: unregelmässige, glatt schattierte Kugel
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const rn = new Simplex(7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + rn.noise(x * 1.6 + 5, y * 1.6 + z * 0.7) * 0.28 + rn.noise(x * 4 + 1, z * 4 - y * 3) * 0.1;
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  const m = mergeVerts(g);
  m.computeVertexNormals();
  return smoothGeo(m);
}
// Nähte schliessen, damit Normalen glatt werden
function mergeVerts(g) {
  const pos = g.attributes.position, map = new Map(), idx = [], out = [];
  const src = g.index ? g.index.array : null, n = src ? src.length : pos.count;
  for (let i = 0; i < n; i++) {
    const vi = src ? src[i] : i;
    const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
    const key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
    let id = map.get(key);
    if (id === undefined) { id = out.length / 3; map.set(key, id); out.push(x, y, z); }
    idx.push(id);
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  ng.setIndex(idx);
  return ng;
}
const BASE = {
  box: flatGeo(new THREE.BoxGeometry(1, 1, 1)),
  cyl: smoothGeo(new THREE.CylinderGeometry(1, 1, 1, 14)),
  cyl6: smoothGeo(new THREE.CylinderGeometry(1, 1, 1, 8)),
  taper: smoothGeo(new THREE.CylinderGeometry(0.55, 1, 1, 12)),
  cone: smoothGeo(new THREE.ConeGeometry(1, 1, 14)),
  cone4: flatGeo(new THREE.ConeGeometry(1, 1, 4)),
  cone6: smoothGeo(new THREE.ConeGeometry(1, 1, 8)),
  ico: smoothGeo(new THREE.IcosahedronGeometry(1, 2)),
  ico0: flatGeo(new THREE.IcosahedronGeometry(1, 0)),
  sph: smoothGeo(new THREE.SphereGeometry(1, 16, 12)),
  oct: flatGeo(new THREE.OctahedronGeometry(1, 0)),
  torus: smoothGeo(new THREE.TorusGeometry(1, 0.12, 8, 28)),
  dodec: flatGeo(new THREE.DodecahedronGeometry(1, 0)),
  rock: rockGeo(),
};
// Kegel und Zylinder stehen auf dem Boden (y 0..1) statt mittig
for (const k of ['cyl', 'cyl6', 'taper', 'cone', 'cone4', 'cone6']) {
  const p = BASE[k].p; for (let i = 1; i < p.length; i += 3) p[i] += 0.5;
}

class Merger {
  constructor() { this.p = []; this.n = []; this.c = []; this.t = []; this.mat = 0; }
  add(kind, m, col, jit = 0, rnd = Math.random, mt = this.mat) {
    const B = BASE[kind], p = B.p, n = B.n;
    _n3.getNormalMatrix(m);
    const e = m.elements;
    jit *= 0.4;
    for (let i = 0; i < p.length; i += 9) {
      const f = 1 + (rnd() - 0.5) * jit;
      for (let k = 0; k < 9; k += 3) {
        const x = p[i + k], y = p[i + k + 1], z = p[i + k + 2];
        this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        _vn.set(n[i + k], n[i + k + 1], n[i + k + 2]).applyMatrix3(_n3).normalize();
        this.n.push(_vn.x, _vn.y, _vn.z);
        this.c.push(col[0] * f, col[1] * f, col[2] * f);
        this.t.push(mt);
      }
    }
  }
  // beliebige Geometrie (mit Normalen) einfügen
  addGeo(geo, m, col, mt = this.mat, jit = 0, rnd = Math.random) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    _n3.getNormalMatrix(m);
    const e = m.elements;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      _vn.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_n3).normalize();
      this.n.push(_vn.x, _vn.y, _vn.z);
      const f = jit ? 1 + (rnd() - 0.5) * jit : 1;
      this.c.push(col[0] * f, col[1] * f, col[2] * f);
      this.t.push(mt);
    }
  }
  // einzelnes Dreieck mit eigenen Eckfarben und Normalen
  tri(a, b, c, na, nb, nc, ca, cb, cc, mt = this.mat) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    this.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    this.t.push(mt, mt, mt);
  }
  get empty() { return this.p.length === 0; }
  geo(ix) {
    const g = new THREE.BufferGeometry();
    const P = [], N = [], C = [], T = [];
    for (const i of ix) { P.push(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); N.push(this.n[i * 3], this.n[i * 3 + 1], this.n[i * 3 + 2]); C.push(this.c[i * 3], this.c[i * 3 + 1], this.c[i * 3 + 2]); T.push(this.t[i]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(T, 1));
    g.computeBoundingSphere();
    return g;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.t, 1));
    g.computeBoundingSphere();
    return g;
  }
  // In Raster-Stücke teilen, damit nur Sichtbares gezeichnet wird (grosse Bauwerke)
  buildBuckets(cell = 40) {
    const buckets = new Map();
    const nt = this.p.length / 9;
    for (let t = 0; t < nt; t++) {
      const cx = (this.p[t * 9] + this.p[t * 9 + 3] + this.p[t * 9 + 6]) / 3, cy = (this.p[t * 9 + 1] + this.p[t * 9 + 4] + this.p[t * 9 + 7]) / 3, cz = (this.p[t * 9 + 2] + this.p[t * 9 + 5] + this.p[t * 9 + 8]) / 3;
      const key = Math.floor(cx / cell) + ',' + Math.floor(cy / (cell * 1.5)) + ',' + Math.floor(cz / cell);
      let b = buckets.get(key); if (!b) { b = []; buckets.set(key, b); }
      b.push(t * 3, t * 3 + 1, t * 3 + 2);
    }
    return [...buckets.values()].map(ix => this.geo(ix));
  }
}

// Punktwolken (Leuchtpunkte, Glühwürmchen, Funken)
class PointSet {
  constructor() { this.p = []; this.c = []; this.r = []; }
  add(x, y, z, col, f = 1) { this.p.push(x, y, z); this.c.push(col[0] * f, col[1] * f, col[2] * f); this.r.push(Math.random()); }
  get empty() { return this.p.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aRnd', new THREE.Float32BufferAttribute(this.r, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Shader ----------
// Luftperspektive: dünn in der Nähe, dicht in der Ferne, Gipfel ragen aus dem Dunst
const AERIAL = `
float aerialF(float d, float y, float n, float f) {
  float fd = max(d - n, 0.0) / max(f, 1.0);
  float a = 1.0 - exp(-(fd * fd * 2.2 + fd * 0.45));
  return a * mix(1.0, 0.42, smoothstep(6.0, 190.0, y));
}
`;
// Wolkenschatten, die über das Land ziehen
const CLOUD_SH = `
uniform vec2 uCDrift; uniform float uCShadow;
float csH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float csN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(csH(i), csH(i + vec2(1.0, 0.0)), f.x), mix(csH(i + vec2(0.0, 1.0)), csH(i + vec2(1.0, 1.0)), f.x), f.y); }
float cloudSh(vec2 xz) {
  if (uCShadow < 0.01) return 1.0;
  float n = csN(xz * 0.0042 - uCDrift) * 0.65 + csN(xz * 0.011 - uCDrift * 2.6) * 0.35;
  return 1.0 - uCShadow * smoothstep(0.42, 0.68, n);
}
`;
// Oberflächen: Mauerwerk, Holz, Rinde, Boden ... rein berechnet, ohne Bilddateien
const SURF = `
float dh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 surf(vec3 c, vec3 wp, vec3 n, float m, float dist) {
  float detail = 1.0 - smoothstep(30.0, 140.0, dist);
  float g = dn(wp * 1.3) * 0.5 + dn(wp * 4.7) * 0.3 + dn(wp * 15.0) * 0.2 * detail;
  float k = 0.82 + 0.36 * g;
  if (m < 0.5) return c * k;
  float wall = 1.0 - smoothstep(0.45, 0.8, abs(n.y));
  vec2 tg = normalize(vec2(-n.z, n.x) + vec2(1e-4, 0.0));
  if (m < 1.5 || (m > 7.5 && m < 8.5)) {
    // Mauerwerk (Wand) und Steinplatten (Boden)
    float isStone = step(m, 1.5);
    vec2 uv = mix(wp.xz * vec2(1.0, 1.0), vec2(dot(wp.xz, tg), wp.y), wall);
    float bh = mix(1.5, 0.52, wall) * mix(1.0, 1.0, isStone), bw = mix(1.5, 1.25, wall);
    float row = floor(uv.y / bh);
    vec2 q = vec2(uv.x + mod(row, 2.0) * 0.5 * bw + dh2(vec2(row, 3.0)) * 3.0, uv.y) / vec2(bw, bh);
    vec2 id = floor(q), f = fract(q);
    float tint = dh2(id + 11.0 * wall);
    float edge = min(min(f.x, 1.0 - f.x) * bw, min(f.y, 1.0 - f.y) * bh);
    float mortar = 1.0 - smoothstep(0.015, 0.06 + 0.02 * (1.0 - detail), edge);
    float bevel = 0.72 + 0.28 * smoothstep(0.0, 0.2, edge);
    float chip = dn(vec3(uv * 9.0, id.x + id.y)) * detail;
    return c * k * (0.8 + 0.34 * tint) * bevel * (1.0 - 0.5 * mortar) * (0.92 + 0.14 * chip);
  }
  if (m < 2.5) {
    // Holzbretter
    float horiz = smoothstep(0.6, 0.85, abs(n.y));
    float u = mix(dot(wp.xz, tg), wp.z, horiz), v = mix(wp.y, wp.x, horiz);
    float pl = floor(u / 0.28);
    float seam = smoothstep(0.012, 0.0, abs(fract(u / 0.28) - 0.0) * 0.28) + smoothstep(0.012, 0.0, abs(1.0 - fract(u / 0.28)) * 0.28);
    float grain = dn(vec3(u * 3.0, v * 0.5, pl * 1.7)) * 0.6 + dn(vec3(u * 14.0, v * 1.2, pl)) * 0.4;
    return c * (0.8 + 0.3 * dh2(vec2(pl, 5.0))) * (0.78 + 0.4 * grain) * (1.0 - 0.45 * seam);
  }
  if (m < 3.5) {
    // Rinde: senkrechte Furchen
    float u = dot(wp.xz, tg);
    float f1 = dn(vec3(u * 5.5, wp.y * 0.45, 0.7)), f2 = dn(vec3(u * 13.0, wp.y * 1.1, 2.3));
    float ridge = smoothstep(0.25, 0.7, f1 * 0.65 + f2 * 0.35);
    return c * (0.55 + 0.6 * ridge) * (0.9 + 0.2 * dn(wp * 3.0));
  }
  if (m < 4.5) {
    float f = dn(wp * 0.35) * 0.5 + dn(wp * 1.7) * 0.3 + dn(wp * 9.0) * 0.2 * detail;
    return c * (0.8 + 0.4 * f);
  }
  if (m < 5.5) {
    // Stoff: feines Gewebe
    float wv = sin(wp.x * 90.0 + wp.z * 90.0) * sin(wp.y * 90.0 - wp.z * 70.0);
    return c * k * (0.94 + 0.06 * wv * detail);
  }
  if (m < 6.5) return c * (0.85 + 0.3 * dn(vec3(wp.x * 40.0, wp.y * 2.0, wp.z * 40.0)));
  if (m < 7.5) {
    // Dachziegel in versetzten Reihen
    float u = dot(wp.xz, tg), v = wp.y * 1.6;
    float row = floor(v / 0.5);
    vec2 q = vec2(u + mod(row, 2.0) * 0.45, v) / vec2(0.9, 0.5);
    vec2 f = fract(q), id = floor(q);
    float sc = smoothstep(0.0, 0.18, f.y) * (0.75 + 0.25 * smoothstep(0.0, 0.1, min(f.x, 1.0 - f.x)));
    return c * k * (0.8 + 0.3 * dh2(id)) * sc;
  }
  if (m < 9.5) return c;
  if (m < 10.5) return c * (0.9 + 0.15 * dn(wp * 6.0));
  if (m < 11.5) {
    float vein = abs(sin(wp.x * 2.0 + wp.z * 1.3 + dn(wp * 1.7) * 7.0));
    return c * (0.92 + 0.14 * smoothstep(0.0, 0.25, vein) - 0.1 * (1.0 - smoothstep(0.0, 0.08, vein)));
  }
  if (m > 12.5) {
    float f = dn(wp * 1.6) * 0.5 + dn(wp * 5.5) * 0.3 + dn(wp * 17.0) * 0.2 * detail;
    return c * (0.62 + 0.75 * f);
  }
  return c * (0.9 + 0.2 * dn(wp * 12.0));
}
`;
const FOG_V = 'uniform float uFogNear; uniform float uFogFar; varying float vFog;' + AERIAL + CLOUD_SH;
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float fogDepth; varying float vFogY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n fogDepth = - mvPosition.z; vFogY = cameraPosition.y + dot(mvPosition.xyz, viewMatrix[1].xyz);\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float fogDepth; varying float vFogY; uniform float fogNear; uniform float fogFar;' + AERIAL + '\n#endif';
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, aerialF(fogDepth, vFogY, fogNear, fogFar));\n#endif';
const FOG_F = 'uniform vec3 uFogColor; varying float vFog;';

// Weiche, runde Leuchtpunkte
function pointsMat(size, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uSize: { value: size }, uEmit: { value: opts.emit || 0 }, uSway: { value: opts.sway == null ? 1 : opts.sway }, uAlpha: { value: 1 }, uFarMul: { value: opts.farMul || 1 }, uFogCap: { value: opts.fogCap || 1 }, uCut: { value: opts.cut ? 1 : 0 }, uMaxPt: { value: opts.maxPt || 30 } }),
    vertexShader: `
      ${FOG_V}
      uniform float uTime, uWind, uScale, uPx, uSize, uEmit, uSway, uFarMul, uCut, uNearCut, uMaxPt, uFogCap;
      uniform vec2 uWindDir; uniform vec3 uLight, uLanternPos, uLanternCol, uCam;
      attribute vec3 color; attribute float aRnd;
      varying vec3 vCol;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float sw = sin(uTime * 1.4 + wp.x * 0.35 + wp.z * 0.3 + aRnd * 3.0) * 0.09 * uWind * uSway;
        wp.xz += uWindDir * sw;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * (0.75 + 0.5 * aRnd) * uScale / -mv.z, 1.5, uMaxPt * uPx) * smoothstep(1.2, 5.0, -mv.z);
        if (uCut > 0.5 && distance(wp.xz, uCam.xz) < uNearCut) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        float ld = distance(wp.xyz, uLanternPos);
        vec3 li = uLight + uLanternCol * pow(max(0.0, 1.0 - ld / 13.0), 2.0);
        vCol = color * mix(li * cloudSh(wp.xz), vec3(1.0), uEmit);
        vFog = aerialF(-mv.z / uFarMul, wp.y, uFogNear, uFogFar) * uFogCap;
      }`,
    fragmentShader: `
      ${FOG_F}
      uniform float uAlpha;
      varying vec3 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(${opts.additive ? '0.0' : '0.72'}, 1.0, d);
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vCol, uFogColor, vFog), uAlpha * ${opts.additive ? 'a * a' : 'a'});
      }`,
    transparent: !!opts.additive || !!opts.transparent,
    alphaToCoverage: !opts.additive && !opts.transparent,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive,
  });
}

let WORLD_MATS = 0;
// Standard-Material der Welt: pro Pixel beleuchtet, Schatten, Oberflächenmuster, Dunst
function worldMat(o = {}) {
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: o.shine == null ? 10 : o.shine, specular: new THREE.Color(o.spec == null ? 0x161616 : o.spec), side: o.side || THREE.FrontSide });
  if (o.transparent) { m.transparent = true; m.opacity = o.opacity == null ? 0.9 : o.opacity; }
  if (o.emissive) m.emissive = new THREE.Color(o.emissive);
  const cutU = o.cut || null, cap = o.cap == null ? 1 : o.cap, id = WORLD_MATS++;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCam = U.uCam; sh.uniforms.uCut = cutU || { value: 0 };
    sh.uniforms.uCDrift = U.uCDrift; sh.uniforms.uCShadow = U.uCShadow;
    sh.uniforms.uSunDirW = U.uSunDirW;
    sh.vertexShader = 'attribute float aMat; varying float vMat; varying vec3 vWP; varying vec3 vWN;' + (o.path ? 'attribute float aPath; varying float vPath;' : '') + '\n' + sh.vertexShader
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vMat = aMat;' + (o.path ? ' vPath = aPath;' : ''));
    sh.fragmentShader = 'varying float vMat; varying vec3 vWP; varying vec3 vWN; uniform vec3 uCam; uniform float uCut;' + (o.path ? 'varying float vPath;' : '') + '\n' + CLOUD_SH + SURF + sh.fragmentShader
      .replace('void main() {', 'void main() {\n' + (cutU ? ' if (distance(vWP.xz, uCam.xz) < uCut) discard;' : ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = surf(diffuseColor.rgb, vWP, normalize(vWN), vMat, distance(vWP, uCam));' + (o.path ? `
 float pk = smoothstep(2.9, 1.2, vPath + (dn(vWP * 2.3) - 0.5) * 1.5) * 0.85;
 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.4 + vec3(0.2, 0.16, 0.12) * (0.8 + 0.4 * dn(vWP * 11.0)), pk);` : ''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * step(8.5, vMat) * step(vMat, 9.5) * 1.25;')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= cloudSh(vWP.xz);\n#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, min(aerialF(fogDepth, vWP.y, fogNear, fogFar), ' + cap.toFixed(2) + '));\n#endif');
  };
  m.customProgramCacheKey = () => 'world' + id;
  return m;
}

const MAT = {};
function initMaterials() {
  MAT.flat = worldMat();
  MAT.glow = pointsMat(0.5, { emit: 1, additive: true });
  MAT.glowBig = pointsMat(1.3, { emit: 1, additive: true, sway: 0.3 });
  MAT.neonGlow = pointsMat(0.32, { emit: 1, additive: true, sway: 0.4 });
  MAT.cloudPts = pointsMat(1.0, { emit: 0.25, sway: 0 });
  // Fernsicht: Wahrzeichen und fernes Gelände verschwinden erst viel später im Nebel
  MAT.landmark = worldMat({ cap: 0.86 });
  MAT.farTerrain = worldMat({ cut: U.uNearCut, shine: 2 });
  MAT.ultraTerrain = worldMat({ cut: U.uFarCut, shine: 2 });
  MAT.ground = worldMat({ shine: 2, spec: 0x0a0a0a, path: true });
  MAT.grass = makeGrassMat();
  MAT.farCanopy = pointsMat(5, { sway: 0, cut: true, maxPt: 6 });
  MAT.landGlow = pointsMat(0.9, { emit: 1, additive: true, sway: 0, farMul: 3.2, maxPt: 14, fogCap: 0.7 });
  initFoliageMats();
}

// ---------- Renderer und Nachbearbeitung ----------
function makeTargets() {
  const W = G.w, H = G.h, qs = QUALITY[G.quality];
  const gl2 = G.renderer.capabilities.isWebGL2;
  if (G.rt) G.rt.dispose();
  if (gl2 && qs.msaa > 0) { G.rt = new THREE.WebGLMultisampleRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true }); G.rt.samples = qs.msaa; }
  else G.rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  if (G.postMat) { G.postMat.uniforms.tDiffuse.value = G.rt.texture; G.brightMat.uniforms.tDiffuse.value = G.rt.texture; }
}
function applyQuality() {
  const qs = QUALITY[G.quality], r = G.renderer;
  const on = qs.shadow > 0;
  if (r.shadowMap.enabled !== on) { r.shadowMap.enabled = on; }
  G.sun.castShadow = on;
  for (const k in LEAF_MATS) LEAF_MATS[k].alphaToCoverage = qs.msaa > 0;
  for (const k in MAT) if (MAT[k] && MAT[k].isShaderMaterial && MAT[k].userData.a2c) MAT[k].alphaToCoverage = qs.msaa > 0;
  if (on && G.sun.shadow.mapSize.x !== qs.shadow) {
    G.sun.shadow.mapSize.set(qs.shadow, qs.shadow);
    if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; }
  }
  resizeGraphics();
  makeTargets();
}

function initGraphics(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  r.setPixelRatio(1);
  r.autoClear = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0x202040, 30, 220);
  G.camera = new THREE.PerspectiveCamera(58, 1, 0.3, 5000);
  G.hemi = new THREE.HemisphereLight(0x8080c0, 0x202020, 0.6);
  G.sun = new THREE.DirectionalLight(0xffffff, 0.6);
  const sh = G.sun.shadow;
  sh.camera.left = -75; sh.camera.right = 75; sh.camera.top = 75; sh.camera.bottom = -75; sh.camera.near = 5; sh.camera.far = 420;
  sh.bias = -0.0004; sh.normalBias = 0.35; sh.radius = 2.2;
  G.lantern = new THREE.PointLight(0xffb070, 0, 13, 2);
  G.scene.add(G.hemi, G.sun, G.sun.target, G.lantern);
  // Fackeln und Feuer in Hallen: ein paar bewegliche Lichter
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff9a50, 0, 18, 2); G.torches.push(l); G.scene.add(l); }
  for (const l of [G.hemi, G.sun, G.lantern, ...G.torches]) l.layers.enable(1);

  const qv = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  G.postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, tRays: { value: null }, uBloom: { value: 0.5 }, uRays: { value: 0 }, uRayCol: { value: new THREE.Color(1, 0.8, 0.6) }, uTime: U.uTime,
      uShadowTint: { value: new THREE.Color(0.78, 0.8, 1.15) }, uHighTint: { value: new THREE.Color(0.22, 0.15, 0.05) }, uSat: { value: 1 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: qv,
    fragmentShader: `
      uniform sampler2D tDiffuse, tBloom, tRays; uniform float uFlash, uHurt, uFade, uSat, uBloom, uRays, uTime; uniform vec3 uFadeCol, uRayCol, uShadowTint, uHighTint;
      varying vec2 vUv;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec3 bl = texture2D(tBloom, vUv).rgb;
        c += bl * uBloom * (1.0 - c * 0.5);
        // Lichtstrahlen von Sonne und Mond
        c += texture2D(tRays, vUv).rgb * uRayCol * uRays;
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(vec3(lum), c, uSat);
        // Farbgebung: kühle Schatten, warme Lichter
        c = mix(c, c * uShadowTint, 1.0 - smoothstep(0.0, 0.5, lum));
        c += uHighTint * smoothstep(0.4, 1.0, lum) * 0.5;
        // weiche Schulter für helle Stellen, sanfte Kontraste
        c = mix(c * 1.04 / (1.0 + max(c - 0.8, 0.0) * 0.55), aces(c * 1.05), 0.4);
        c = pow(max(c, 0.0), vec3(1.04));
        c += uFlash * vec3(0.32, 0.3, 0.42);
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.7;
        c = mix(c, vec3(dot(c, vec3(0.5, 0.3, 0.2))) * vec3(1.4, 0.45, 0.5), uHurt);
        c += (hsh(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) / 200.0;
        c = mix(c, uFadeCol, uFade);
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  // Leuchten (Bloom): helle Stellen herausfiltern, verwischen, dazumischen
  const rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  G.rtB1 = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  G.rtB2 = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  G.postMat.uniforms.tBloom.value = G.rtB1.texture;
  G.postMat.uniforms.tRays.value = G.rtB2.texture;
  G.brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uPx: { value: new THREE.Vector2() } }, vertexShader: qv,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; varying vec2 vUv;
      vec3 br(vec2 o){ vec3 c = texture2D(tDiffuse, vUv + o).rgb; float l = max(c.r, max(c.g, c.b)); return c * smoothstep(0.66, 1.0, l); }
      void main(){ gl_FragColor = vec4((br(uPx * vec2(-1.0, -1.0)) + br(uPx * vec2(1.0, -1.0)) + br(uPx * vec2(-1.0, 1.0)) + br(uPx)) * 0.25, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  G.rayMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uLen: { value: 0.9 } }, vertexShader: qv,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uLight; uniform float uLen; varying vec2 vUv;
      void main(){
        vec2 dl = (uLight - vUv) * uLen / 36.0, uv = vUv;
        vec3 s = vec3(0.0); float w = 1.0;
        for (int i = 0; i < 36; i++) { s += texture2D(tDiffuse, uv).rgb * w; w *= 0.95; uv += dl; }
        gl_FragColor = vec4(s / 15.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  G.blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: qv,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2;
        c += (texture2D(tDiffuse, vUv + uDir * 1.4).rgb + texture2D(tDiffuse, vUv - uDir * 1.4).rgb) * 0.24;
        c += (texture2D(tDiffuse, vUv + uDir * 3.3).rgb + texture2D(tDiffuse, vUv - uDir * 3.3).rgb) * 0.12;
        c += (texture2D(tDiffuse, vUv + uDir * 5.5).rgb + texture2D(tDiffuse, vUv - uDir * 5.5).rgb) * 0.04;
        gl_FragColor = vec4(c * 1.05, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  G.postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), G.postMat);
  quad.frustumCulled = false;
  G.postScene.add(quad);
  G.quad = quad;
  G.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  initMaterials();
  initSky();
  initWater();
  initWeatherFX();
  initBurst();
  initMist();
  initCloudSea();
  G.bolts = new THREE.Group();
  G.scene.add(G.bolts);
  applyQuality();
}

function resizeGraphics() {
  const qs = QUALITY[G.quality];
  const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
  const dpr = window.devicePixelRatio || 1;
  const sc = Math.min(dpr, 2) * qs.scale / Math.max(1, dpr > 1.5 ? dpr / 1.5 : 1);
  G.scale = sc;
  G.w = Math.max(320, Math.round(W * sc)); G.h = Math.max(200, Math.round(H * sc));
  G.renderer.setSize(G.w, G.h, false);
  if (G.rt) G.rt.setSize(G.w, G.h);
  const bw = Math.max(2, Math.round(G.w / 2)), bh = Math.max(2, Math.round(G.h / 2));
  G.rtB1.setSize(bw, bh); G.rtB2.setSize(bw, bh);
  G.brightMat.uniforms.uPx.value.set(1 / G.w, 1 / G.h);
  G.rtRefl.setSize(Math.max(2, Math.round(G.w / 2)), Math.max(2, Math.round(G.h / 2)));
  G.bloomPx = [1.6 / bw, 1.6 / bh];
  G.camera.aspect = G.w / G.h;
  G.camera.updateProjectionMatrix();
  U.uScale.value = G.h * 0.5 / Math.tan(G.camera.fov * Math.PI / 360) * 0.5;
  U.uPx.value = G.h / 270;
}

function renderFrame() {
  G.postMat.uniforms.uFlash.value = G.flash;
  G.postMat.uniforms.uHurt.value = G.hurt;
  G.postMat.uniforms.uFade.value = G.fade;
  const r = G.renderer;
  if (G.reflectFn) G.reflectFn();
  r.setRenderTarget(G.rt);
  r.render(G.scene, G.camera);
  if (G.postMat.uniforms.uBloom.value > 0.01) {
    const q = G.quad, px = G.bloomPx;
    q.material = G.brightMat; r.setRenderTarget(G.rtB1); r.render(G.postScene, G.postCam);
    q.material = G.blurMat; G.blurMat.uniforms.tDiffuse.value = G.rtB1.texture; G.blurMat.uniforms.uDir.value.set(px[0], 0);
    r.setRenderTarget(G.rtB2); r.render(G.postScene, G.postCam);
    G.blurMat.uniforms.tDiffuse.value = G.rtB2.texture; G.blurMat.uniforms.uDir.value.set(0, px[1]);
    r.setRenderTarget(G.rtB1); r.render(G.postScene, G.postCam);
    if (G.postMat.uniforms.uRays.value > 0.01) {
      q.material = G.rayMat; G.rayMat.uniforms.tDiffuse.value = G.rtB1.texture;
      r.setRenderTarget(G.rtB2); r.render(G.postScene, G.postCam);
    }
    q.material = G.postMat;
  }
  r.setRenderTarget(null);
  r.render(G.postScene, G.postCam);
}

// ---------- Himmel mit Wolken, Sternen, Mond ----------
const SKY_NOISE = `
float shh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float svn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(shh(i), shh(i + vec2(1.0, 0.0)), f.x), mix(shh(i + vec2(0.0, 1.0)), shh(i + vec2(1.0, 1.0)), f.x), f.y); }
float sfb(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * svn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float svn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function initSky() {
  G.skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 1 }, uMoonSize: { value: 0.9905 }, uAurora: { value: 0 }, uMoonCol: { value: new THREE.Color(0.93, 0.9, 0.84) }, uMoonGlow: { value: new THREE.Color(0.42, 0.38, 0.6) }, uTime: U.uTime, uFlash: { value: 0 }, uSunVis: { value: 1 }, uMoonVis: { value: 1 }, uCloudy: { value: 0 },
      uCover: { value: 0.3 }, uDrift: { value: new THREE.Vector2() }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudDark: { value: new THREE.Color(0.5, 0.5, 0.6) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uMoonDir, uMoonCol, uMoonGlow, uCloudLit, uCloudDark;
      uniform float uStars, uTime, uFlash, uSunVis, uMoonVis, uCloudy, uMoonSize, uAurora, uCover;
      uniform vec2 uDrift;
      varying vec3 vDir;
      ${SKY_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
        col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 60.0) * 0.45) * uSunVis;
        col = mix(col, uSunCol * 1.5 + 0.25, smoothstep(0.9986, 0.9992, sd) * uSunVis * (1.0 - uCloudy * 0.85));
        float md = dot(d, uMoonDir);
        float ms = uMoonSize, mw = (1.0 - ms) * 0.11;
        float moon = smoothstep(ms, ms + mw, md);
        float md2 = dot(d, normalize(uMoonDir + vec3(0.075, 0.035, 0.0) * sqrt((1.0 - ms) / 0.0095)));
        moon *= 1.0 - smoothstep(ms, ms + mw, md2) * 0.92 * smoothstep(0.985, 0.99, ms);
        float spots = 0.8 + 0.2 * svn3(d * 55.0) + 0.08 * svn3(d * 150.0);
        float mv = uMoonVis * (1.0 - uCloudy * 0.6);
        col = mix(col, uMoonCol * spots, moon * mv);
        col += uMoonGlow * (pow(max(md, 0.0), 14.0) * 0.22 + pow(max(md, 0.0), 120.0) * 0.25 + pow(max(md, 0.0), 30.0) * (1.0 - smoothstep(0.972, 0.99, ms)) * 0.5) * mv;
        // Sterne: runde, weiche Punkte
        vec3 q = d * 120.0, id = floor(q), f = fract(q) - 0.5;
        float s = hash(id);
        vec3 off = vec3(hash(id + 3.1), hash(id + 7.7), hash(id + 1.3)) - 0.5;
        float star = smoothstep(0.2, 0.0, length(f - off * 0.55)) * step(0.955, s) * (0.4 + 0.6 * hash(id + 9.0));
        float tw = 0.65 + 0.35 * sin(uTime * 2.3 + s * 90.0);
        float sv = uStars * smoothstep(0.03, 0.3, h) * (1.0 - uCloudy);
        col += vec3(0.92, 0.88, 1.0) * star * tw * sv * 1.5;
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.45, 0.82))), 2.0) * 26.0) * smoothstep(0.0, 0.35, h);
        col += vec3(0.26, 0.17, 0.36) * band * sv * 0.4 * (0.5 + 0.5 * svn3(d * 60.0));
        // Polarlicht: wehende Vorhänge
        if (uAurora > 0.01 && h > 0.02) {
          float az = atan(d.z, d.x);
          float bnd = 0.3 + sin(az * 2.0 + uTime * 0.03) * 0.07 + sin(az * 5.0 - uTime * 0.05) * 0.03;
          float cur = smoothstep(-0.16, 0.0, h - bnd) * smoothstep(0.3, 0.0, h - bnd);
          float rr = 0.5 + 0.5 * sin(az * 46.0 + sin(az * 6.0 + uTime * 0.25) * 5.0 + uTime * 0.35);
          rr = 0.25 + pow(rr, 3.0) * 0.75;
          vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(bnd - 0.05, bnd + 0.25, h));
          col += ac * cur * rr * uAurora * (1.0 - uCloudy) * 0.55;
        }
        // Sternschnuppen
        float sl = floor(uTime / 5.0), sp = fract(uTime / 5.0);
        if (uStars > 0.2 && hash(vec3(sl, 7.0, 3.0)) < 0.45 && sp < 0.22) {
          vec3 s0 = normalize(vec3(hash(vec3(sl, 1.0, 2.0)) - 0.5, 0.45 + hash(vec3(sl, 3.0, 4.0)) * 0.4, hash(vec3(sl, 5.0, 6.0)) - 0.5));
          vec3 dir = normalize(cross(s0, vec3(0.0, 1.0, 0.0)) * (hash(vec3(sl, 9.0, 1.0)) < 0.5 ? 1.0 : -1.0) + vec3(0.0, -0.45, 0.0));
          vec3 head = normalize(s0 + dir * sp * 1.6);
          vec3 v = d - head; float al = dot(v, dir); float pp = length(v - dir * al);
          float st = smoothstep(0.0028, 0.0, pp) * smoothstep(-0.16, 0.0, al) * step(al, 0.002) * (1.0 - sp / 0.22);
          col += vec3(0.95, 0.9, 1.0) * st * uStars * (1.0 - uCloudy) * 1.4;
        }
        // Wolken: weiche, von der Sonne beleuchtete Schichten
        if (h > 0.005 && uCover > 0.02) {
          vec2 cp = d.xz / (h * 0.85 + 0.09) * 0.5 + uDrift;
          float n = sfb(cp);
          float n2 = sfb(cp + uSunDir.xz * 0.2);
          float thr = 1.0 - uCover * 0.92;
          float dens = smoothstep(thr, thr + 0.2, n);
          float lit = clamp(0.58 + (n - n2) * 3.4, 0.0, 1.0);
          float thick = smoothstep(thr + 0.05, thr + 0.5, n);
          vec3 cc = mix(uCloudDark, uCloudLit, lit * (1.0 - 0.4 * thick));
          cc += uSunCol * pow(sd, 5.0) * (1.0 - thick * 0.6) * 0.55 * uSunVis;
          cc += uFlash * vec3(0.55, 0.5, 0.8);
          cc = mix(cc, uHorizon, (1.0 - smoothstep(0.0, 0.4, h)) * 0.7);
          col = mix(col, cc, dens * smoothstep(0.0, 0.14, h));
        }
        col += uFlash * vec3(0.42, 0.38, 0.6) * (0.35 + 0.65 * smoothstep(-0.1, 0.5, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 28), G.skyMat);
  G.sky.renderOrder = 100;
  G.sky.frustumCulled = false;
  G.sky.layers.enable(1);
  G.scene.add(G.sky);
}

// ---------- Wasser ----------
function initWater() {
  G.waterMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uDeep: { value: new THREE.Color(0.08, 0.1, 0.2) }, uSky: { value: new THREE.Color() }, uGlintDir: { value: new THREE.Vector3(0, 1, 0) }, uGlintCol: { value: new THREE.Color() },
      tRefl: { value: null }, uReflVP: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } }),
    vertexShader: `
      ${FOG_V}
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; vFog = aerialF(-mv.z, 0.0, uFogNear, uFogFar); }`,
    fragmentShader: `
      ${FOG_F}
      uniform vec3 uDeep, uSky, uGlintDir, uGlintCol, uLanternPos, uLanternCol; uniform float uTime, uReflOn;
      uniform sampler2D tRefl; uniform mat4 uReflVP;
      varying vec3 vW;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }
      float wave(vec2 p, float t){ return wn(p * 0.23 + vec2(t * 0.05, t * 0.03)) + wn(p * 0.71 - vec2(t * 0.09, -t * 0.06)) * 0.5 + wn(p * 2.3 + vec2(t * 0.22, t * 0.17)) * 0.22 + wn(p * 5.7 - vec2(t * 0.3, t * 0.2)) * 0.08; }
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        float amp = 1.1 * (1.0 - smoothstep(40.0, 320.0, dist));
        float e = 0.12, h0 = wave(vW.xz, uTime);
        vec3 N = normalize(vec3(-(wave(vW.xz + vec2(e, 0.0), uTime) - h0) / e * amp * 0.5, 1.0, -(wave(vW.xz + vec2(0.0, e), uTime) - h0) / e * amp * 0.5));
        float fres = pow(1.0 - max(dot(v, N), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.28 + 0.62 * fres);
        if (uReflOn > 0.5) {
          vec4 rc = uReflVP * vec4(vW + vec3(N.x, 0.0, N.z) * 1.4, 1.0);
          vec2 ru = rc.xy / rc.w * 0.5 + 0.5;
          if (rc.w > 0.0 && ru.x > 0.0 && ru.x < 1.0 && ru.y > 0.0 && ru.y < 1.0) col = mix(col, texture2D(tRefl, ru).rgb * 0.92 + uDeep * 0.08, 0.5 + 0.42 * fres);
        }
        vec3 r = reflect(-v, N);
        float spec = pow(max(dot(r, uGlintDir), 0.0), 140.0) * 2.2 + pow(max(dot(r, uGlintDir), 0.0), 18.0) * 0.18;
        col += uGlintCol * spec;
        float ld = distance(vW, uLanternPos);
        col += uLanternCol * pow(max(0.0, 1.0 - ld / 12.0), 2.0) * 0.5;
        gl_FragColor = vec4(mix(col, uFogColor, vFog), 0.86);
      }`,
    transparent: true, depthWrite: false,
  });
  G.water = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), G.waterMat);
  G.water.rotation.x = -Math.PI / 2;
  G.water.position.y = WATER;
  G.water.renderOrder = 2;
  G.water.frustumCulled = false;
  G.scene.add(G.water);
  // Spiegelung: eine zweite Kamera unter der Wasserfläche sieht nur Ebene 1 (Himmel, Burgen, Ferne)
  G.rtRefl = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  G.waterMat.uniforms.tRefl.value = G.rtRefl.texture;
  G.reflCam = new THREE.PerspectiveCamera(58, 1, 0.45, 5000);
  G.reflCam.layers.set(1);
  G.reflPlane = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER + 0.05)];
  G.reflOn = false;
  G.reflectFn = () => {
    const wm = G.waterMat.uniforms;
    wm.uReflOn.value = G.reflOn && G.water.visible ? 1 : 0;
    if (!wm.uReflOn.value) return;
    const c = G.camera, rc = G.reflCam;
    rc.fov = c.fov; rc.aspect = c.aspect; rc.near = c.near; rc.far = c.far; rc.updateProjectionMatrix();
    rc.position.set(c.position.x, 2 * WATER - c.position.y, c.position.z);
    c.getWorldDirection(_v); _v.y = -_v.y;
    rc.lookAt(_s.copy(rc.position).add(_v));
    rc.updateMatrixWorld();
    wm.uReflVP.value.multiplyMatrices(rc.projectionMatrix, rc.matrixWorldInverse);
    const r = G.renderer;
    r.clippingPlanes = G.reflPlane;
    const sky = G.sky.position.clone();
    G.sky.position.copy(rc.position);
    const sm = r.shadowMap.enabled; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(G.rtRefl); r.render(G.scene, rc);
    r.shadowMap.autoUpdate = true;
    G.sky.position.copy(sky);
    r.clippingPlanes = [];
    void sm;
  };
}
function reflectable(o) { o.traverse(c => c.layers.enable(1)); return o; }


// ---------- Wetter-Teilchen rund um die Kamera ----------
function wrapMat(opts) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, {
      uOrigin: { value: new THREE.Vector3() }, uOffset: { value: new THREE.Vector3() }, uBox: { value: opts.box.clone() },
      uAmt: { value: 0 }, uColor: { value: new THREE.Color(opts.color) }, uSize: { value: opts.size || 0.2 },
      uVel: { value: new THREE.Vector3() }, uMode: { value: opts.mode || 0 },
    }),
    vertexShader: `
      ${FOG_V}
      uniform vec3 uOrigin, uOffset, uBox, uColor, uVel, uLight;
      uniform float uAmt, uSize, uScale, uTime, uMode;
      attribute float aRnd; attribute float aEnd;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = mod(position * uBox + uOffset, uBox) - uBox * 0.5 + uOrigin;
        float blink = 1.0;
        if (uMode > 0.5 && uMode < 1.5) {
          p += vec3(sin(uTime * 0.7 + aRnd * 20.0), sin(uTime * 0.9 + aRnd * 13.0) * 0.5, cos(uTime * 0.6 + aRnd * 17.0)) * 1.4;
          blink = smoothstep(0.1, 0.9, sin(uTime * 1.6 + aRnd * 40.0));
        } else if (uMode > 1.5 && uMode < 2.5) {
          p.x += sin(uTime * 1.7 + aRnd * 40.0) * 0.5; p.z += cos(uTime * 1.3 + aRnd * 30.0) * 0.5;
        }
        p += uVel * aEnd * 0.05;
        vec3 rel = (p - uOrigin) / (uBox * 0.5);
        float edge = 1.0 - smoothstep(0.75, 1.0, max(max(abs(rel.x), abs(rel.z)), abs(rel.y)));
        float show = step(aRnd, uAmt) * edge;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uScale / -mv.z, 1.0, uMode > 0.5 && uMode < 1.5 ? 4.0 : 3.0) * show * blink;
        vCol = uMode > 0.5 && uMode < 1.5 ? uColor : uColor * (0.45 + 0.55 * uLight);
        vA = show * blink;
        vFog = aerialF(-mv.z, p.y, uFogNear, uFogFar);
      }`,
    fragmentShader: `
      ${FOG_F}
      varying vec3 vCol; varying float vA;
      void main(){ if (vA < 0.05) discard; gl_FragColor = vec4(mix(vCol, uFogColor, vFog * 0.7), vA * ${opts.alpha || '1.0'}); }`,
    transparent: !!opts.transparent || !!opts.additive,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
}
function wrapPoints(n, opts) {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n), end = new Float32Array(n);
  for (let i = 0; i < n * 3; i++) pos[i] = Math.random();
  for (let i = 0; i < n; i++) rnd[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const o = new THREE.Points(g, wrapMat(opts));
  o.frustumCulled = false; o.renderOrder = 3;
  G.scene.add(o);
  return o;
}
function initWeatherFX() {
  // Regen als Striche
  const n = 2600;
  const pos = new Float32Array(n * 6), rnd = new Float32Array(n * 2), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random(), r = Math.random();
    pos.set([x, y, z, x, y, z], i * 6); rnd[i * 2] = rnd[i * 2 + 1] = r; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  G.rain = new THREE.LineSegments(g, wrapMat({ box: new THREE.Vector3(70, 40, 70), color: 0xb8b8e8, transparent: true, alpha: '0.55' }));
  G.rain.frustumCulled = false; G.rain.renderOrder = 3;
  G.scene.add(G.rain);
  G.snow = wrapPoints(2400, { box: new THREE.Vector3(60, 36, 60), color: 0xffffff, size: 0.22, mode: 2 });
  G.petals = wrapPoints(700, { box: new THREE.Vector3(50, 22, 50), color: 0xffffff, size: 0.2, mode: 2 });
  G.flies = wrapPoints(600, { box: new THREE.Vector3(48, 8, 48), color: 0xfff0a0, size: 0.34, mode: 1, additive: true });
  G.dust = wrapPoints(500, { box: new THREE.Vector3(46, 16, 46), color: 0xffe0a0, size: 0.12, mode: 2, transparent: true, alpha: '0.6' });
  G.fx = [G.rain, G.snow, G.petals, G.flies, G.dust];
}

// ---------- Kurze Teilchen (Treffer, Funken, Münzglanz) ----------
const BURST_N = 700;
function initBurst() {
  const g = new THREE.BufferGeometry();
  G.bPos = new Float32Array(BURST_N * 3); G.bCol = new Float32Array(BURST_N * 3); G.bSize = new Float32Array(BURST_N);
  G.bVel = new Float32Array(BURST_N * 3); G.bLife = new Float32Array(BURST_N); G.bMax = new Float32Array(BURST_N); G.bGrav = new Float32Array(BURST_N);
  g.setAttribute('position', new THREE.BufferAttribute(G.bPos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(G.bCol, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(G.bSize, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: U.uScale },
    vertexShader: 'uniform float uScale; attribute vec3 color; attribute float aSize; varying vec3 vCol; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize > 0.0 ? clamp(aSize * uScale / -mv.z, 1.0, 30.0) : 0.0; vCol = color; }',
    fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }',
  });
  G.burst = new THREE.Points(g, mat);
  G.burst.frustumCulled = false;
  G.burst.renderOrder = 4;
  G.scene.add(G.burst);
  G.bNext = 0;
}
function burst(x, y, z, n, col, speed = 4, size = 0.25, life = 0.8, grav = 6, spread = 0.3) {
  const c = col.r != null ? [col.r, col.g, col.b] : col;
  for (let k = 0; k < n; k++) {
    const i = G.bNext; G.bNext = (G.bNext + 1) % BURST_N;
    G.bPos[i * 3] = x + (Math.random() - 0.5) * spread; G.bPos[i * 3 + 1] = y + (Math.random() - 0.5) * spread; G.bPos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.8);
    const q = Math.sqrt(1 - u * u);
    G.bVel[i * 3] = Math.cos(a) * q * s; G.bVel[i * 3 + 1] = Math.abs(u) * s * 0.9 + speed * 0.3; G.bVel[i * 3 + 2] = Math.sin(a) * q * s;
    const f = 0.85 + Math.random() * 0.3;
    G.bCol[i * 3] = c[0] * f; G.bCol[i * 3 + 1] = c[1] * f; G.bCol[i * 3 + 2] = c[2] * f;
    G.bLife[i] = G.bMax[i] = life * (0.6 + Math.random() * 0.6);
    G.bSize[i] = size; G.bGrav[i] = grav;
  }
}
function updateBurst(dt) {
  for (let i = 0; i < BURST_N; i++) {
    if (G.bLife[i] <= 0) { G.bSize[i] = 0; continue; }
    G.bLife[i] -= dt;
    G.bVel[i * 3 + 1] -= G.bGrav[i] * dt;
    const drag = 1 - dt * 1.5;
    G.bVel[i * 3] *= drag; G.bVel[i * 3 + 2] *= drag;
    G.bPos[i * 3] += G.bVel[i * 3] * dt; G.bPos[i * 3 + 1] += G.bVel[i * 3 + 1] * dt; G.bPos[i * 3 + 2] += G.bVel[i * 3 + 2] * dt;
    if (G.bLife[i] <= 0) G.bSize[i] = 0;
    else G.bSize[i] = Math.max(0.05, G.bSize[i] * (0.4 + 0.6 * G.bLife[i] / G.bMax[i]) / (0.4 + 0.6 * (G.bLife[i] + dt) / G.bMax[i]));
  }
  const a = G.burst.geometry.attributes;
  a.position.needsUpdate = true; a.color.needsUpdate = true; a.aSize.needsUpdate = true;
}

// ---------- Leuchtsprites ----------
let GLOW_TEX = null;
function glowTex() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  GLOW_TEX = new THREE.CanvasTexture(c);
  return GLOW_TEX;
}
function makeGlow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity, fog: true }));
  s.scale.set(size, size, 1);
  return s;
}

// ---------- Blitze ----------
function boltPath(a, b, depth, rough, out) {
  if (depth === 0) { out.push(a, b); return; }
  const m = a.clone().lerp(b, 0.5);
  const len = a.distanceTo(b);
  m.x += (Math.random() - 0.5) * len * rough; m.y += (Math.random() - 0.5) * len * rough * 0.6; m.z += (Math.random() - 0.5) * len * rough;
  boltPath(a, m, depth - 1, rough, out);
  boltPath(m, b, depth - 1, rough, out);
}
function spawnBolt(cam, yaw) {
  const pts = [];
  const ang = yaw + Math.PI + (Math.random() - 0.5) * 1.6;
  const dist = 230 + Math.random() * 130;
  const cx = cam.x + Math.sin(ang) * dist, cz = cam.z + Math.cos(ang) * dist;
  const horizontal = Math.random() < 0.45;
  let a, b;
  if (horizontal) {
    const side = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
    const y = cam.y + 95 + Math.random() * 50, half = 50 + Math.random() * 70;
    a = new THREE.Vector3(cx, y, cz).addScaledVector(side, -half);
    b = new THREE.Vector3(cx, y - 10 + Math.random() * 20, cz).addScaledVector(side, half);
  } else {
    a = new THREE.Vector3(cx, cam.y + 110 + Math.random() * 40, cz);
    b = new THREE.Vector3(cx + (Math.random() - 0.5) * 60, cam.y - 20, cz + (Math.random() - 0.5) * 60);
  }
  const main = [];
  boltPath(a, b, 6, 0.32, main);
  for (const p of main) pts.push(p);
  const nb = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k < nb; k++) {
    const i = Math.floor(Math.random() * (main.length / 2)) * 2;
    const s = main[i];
    const dir = b.clone().sub(a).normalize();
    const e = s.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, -10 - Math.random() * 30, (Math.random() - 0.5) * 40).addScaledVector(dir, 15));
    const br = [];
    boltPath(s, e, 4, 0.4, br);
    for (const p of br) pts.push(p);
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xece4ff, transparent: true, opacity: 1, fog: false });
  const line = new THREE.LineSegments(g, mat);
  line.frustumCulled = false;
  line.userData = { life: 0.35 + Math.random() * 0.25, t: 0 };
  G.bolts.add(line);
  G.flash = Math.max(G.flash, 0.55 + Math.random() * 0.25);
  return dist;
}
function updateBolts(dt) {
  for (let i = G.bolts.children.length - 1; i >= 0; i--) {
    const l = G.bolts.children[i];
    l.userData.t += dt;
    const k = l.userData.t / l.userData.life;
    l.material.opacity = k < 1 ? (Math.random() < 0.25 ? 0.25 : 1) * (1 - k * 0.6) : 0;
    if (k >= 1) { G.bolts.remove(l); l.geometry.dispose(); l.material.dispose(); }
  }
}

// ---------- Tageszeit und Wetter ----------
const SKY_KEYS = [
  // t, Zenit, Horizont, Sonne, Himmelslicht, Bodenlicht, Lichtfarbe, Licht, Himmelslicht-Stärke
  [0.00, 0x07070f, 0x2c2650, 0x000000, 0x2e2e5a, 0x100e16, 0x8890c8, 0.42, 0.55],
  [0.20, 0x0b0b1a, 0x342a58, 0x000000, 0x32305e, 0x120e18, 0x8890c8, 0.38, 0.55],
  [0.25, 0x30306c, 0xd08890, 0xff9070, 0x6a5a8a, 0x30202c, 0xff9a70, 0.45, 0.6],
  [0.30, 0x4f6eb0, 0xf0b890, 0xffb070, 0x8a90b8, 0x40343a, 0xffc090, 0.75, 0.66],
  [0.40, 0x4a86d8, 0xbcd8f0, 0xfff0d0, 0xa8c0e0, 0x50483e, 0xfff0dc, 0.98, 0.72],
  [0.55, 0x3f7fd6, 0xc8e0f6, 0xfff4e0, 0xb0c8e8, 0x54503e, 0xfff4e4, 1.05, 0.74],
  [0.67, 0x5a72b8, 0xf4d4a4, 0xffd090, 0xa8a8c8, 0x504034, 0xffd8a0, 0.9, 0.68],
  [0.735, 0x40408a, 0xf09070, 0xff7a4a, 0x8a6a98, 0x40283a, 0xff9060, 0.62, 0.62],
  [0.785, 0x24204e, 0x8c4c82, 0xc05070, 0x5c4280, 0x281a2c, 0xc08090, 0.4, 0.58],
  [0.86, 0x0a0a1c, 0x30285a, 0x000000, 0x32325e, 0x120e18, 0x8890c8, 0.42, 0.55],
  [1.00, 0x07070f, 0x2c2650, 0x000000, 0x2e2e5a, 0x100e16, 0x8890c8, 0.42, 0.55],
].map(k => [k[0], ...k.slice(1, 7).map(c => new THREE.Color(c)), k[7], k[8]]);

const WEATHERS = [
  { id: 'klar', name: 'Klarer Himmel', cloud: 0.18, rain: 0, fog: 0, storm: 0, wind: 0.7 },
  { id: 'wolken', name: 'Ziehende Wolken', cloud: 0.62, rain: 0, fog: 0.1, storm: 0, wind: 1.1 },
  { id: 'regen', name: 'Sanfter Regen', cloud: 0.88, rain: 0.75, fog: 0.3, storm: 0, wind: 1.2 },
  { id: 'gewitter', name: 'Gewitter', cloud: 0.92, rain: 0.45, fog: 0.15, storm: 1, wind: 1.7 },
  { id: 'nebel', name: 'Nebel', cloud: 0.4, rain: 0, fog: 0.85, storm: 0, wind: 0.3 },
  { id: 'leuchten', name: 'Wetterleuchten', cloud: 0.4, rain: 0, fog: 0.05, storm: 0.65, wind: 0.9 },
];

const ATM = {
  zen: new THREE.Color(), hor: new THREE.Color(), sunC: new THREE.Color(), hSky: new THREE.Color(), hGround: new THREE.Color(), lightC: new THREE.Color(),
  lightI: 0.5, hemiI: 0.6, night: 0, biomeFog: 0, tintW: 0, fogTint: new THREE.Color(), flyC: new THREE.Color(), desat: 0, cur: { cloud: 0.3, rain: 0, fog: 0, storm: 0, wind: 1 },
  boltT: 3, drift: new THREE.Vector2(), offs: {}, tint: [0, 0, 0], fxAmt: { rain: 0, snow: 0, petals: 0, flies: 0, dust: 0 }, petalC: new THREE.Color(),
  sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(),
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _gray = new THREE.Color();

function skyAt(t, o = ATM) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const k = (t - a[0]) / (b[0] - a[0]);
  o.zen.copy(a[1]).lerp(b[1], k); o.hor.copy(a[2]).lerp(b[2], k); o.sunC.copy(a[3]).lerp(b[3], k);
  o.hSky.copy(a[4]).lerp(b[4], k); o.hGround.copy(a[5]).lerp(b[5], k); o.lightC.copy(a[6]).lerp(b[6], k);
  o.lightI = lerp(a[7], b[7], k); o.hemiI = lerp(a[8], b[8], k);
}
const SKYTMP = { zen: new THREE.Color(), hor: new THREE.Color(), sunC: new THREE.Color(), hSky: new THREE.Color(), hGround: new THREE.Color(), lightC: new THREE.Color(), lightI: 0, hemiI: 0 };
// Himmel in Richtung einer anderen Tageszeit ziehen (Stimmung eines Ortes)
function blendSky(t, w) {
  if (w <= 0.001) return;
  skyAt(t, SKYTMP);
  for (const k of ['zen', 'hor', 'sunC', 'hSky', 'hGround', 'lightC']) ATM[k].lerp(SKYTMP[k], w);
  ATM.lightI = lerp(ATM.lightI, SKYTMP.lightI, w); ATM.hemiI = lerp(ATM.hemiI, SKYTMP.hemiI, w);
}
const NO_MOOD = { hell: 0, dunkel: 0, mond: 0, fogBank: 0, feen: 0, hellDir: new THREE.Vector3(1, 0.1, 0), mondDir: new THREE.Vector3(1, 0.3, 0) };

// Wetter, Tageszeit und Biom an der Kamera auf Himmel, Licht und Teilchen anwenden
function updateAtmosphere(dt, dayT, target, bw, cam, yaw, player, lanternOn, onThunder, env = {}) {
  const c = ATM.cur, k = Math.min(1, dt * 0.025);
  for (const key of ['cloud', 'rain', 'fog', 'storm', 'wind']) c[key] += (target[key] - c[key]) * k;
  const md = env.mood || NO_MOOD, cave = env.cave || null;
  skyAt(dayT);
  // Orte färben das Licht: Abendrot-Schloss, Mondschloss, dunkle Feste
  blendSky(0.75, md.hell * 0.92);
  blendSky(0.97, md.mond * 0.88);
  blendSky(0.8, md.dunkel * 0.55);
  const stormE = clamp01(c.storm + md.dunkel * 0.8), cloudE = Math.max(c.cloud, md.dunkel * 0.85);

  // Biom-Färbung
  let tr = 0, tg = 0, tb = 0, cold = 0, pet = 0, fl = 0, du = 0, fogAdd = 0, tw = 0, desat = 0;
  ATM.flyC.setRGB(0, 0, 0);
  _c1.setRGB(0, 0, 0); ATM.fogTint.setRGB(0, 0, 0);
  for (let i = 0; i < NB; i++) {
    const B = BIOMES[i], w = bw[i];
    tr += w * B.sky[0]; tg += w * B.sky[1]; tb += w * B.sky[2];
    cold += w * B.cold; pet += w * B.petalAmt; fl += w * B.flies; du += w * B.dust;
    _c1.r += w * B.petalC[0]; _c1.g += w * B.petalC[1]; _c1.b += w * B.petalC[2];
    fogAdd += w * B.fogAdd; desat += w * B.desat;
    ATM.flyC.r += w * B.flyC[0]; ATM.flyC.g += w * B.flyC[1]; ATM.flyC.b += w * B.flyC[2];
    if (B.fogTintC) { const k = w * B.fogAdd; tw += k; ATM.fogTint.r += k * B.fogTintC[0]; ATM.fogTint.g += k * B.fogTintC[1]; ATM.fogTint.b += k * B.fogTintC[2]; }
  }
  if (tw > 0) ATM.fogTint.multiplyScalar(1 / tw);
  ATM.biomeFog += (fogAdd - ATM.biomeFog) * Math.min(1, dt * 0.5);
  ATM.tintW += (tw - ATM.tintW) * Math.min(1, dt * 0.5);
  ATM.petalC.copy(_c1);
  ATM.hor.r = clamp01(ATM.hor.r + tr); ATM.hor.g = clamp01(ATM.hor.g + tg); ATM.hor.b = clamp01(ATM.hor.b + tb);

  // Bewölkung und Sturm dämpfen Farben
  const gloom = cloudE * 0.45 + stormE * 0.35 + c.rain * 0.2;
  for (const col of [ATM.zen, ATM.hor]) {
    const l = col.r * 0.3 + col.g * 0.5 + col.b * 0.2;
    _gray.setRGB(l * 0.85, l * 0.82, l * 1.05);
    col.lerp(_gray, clamp01(gloom * 0.9)).multiplyScalar(1 - stormE * 0.35 - c.rain * 0.15);
  }
  // Nebel macht den Horizont milchig, die Nebelwand vor dem Mondschloss ebenso
  const fogE = clamp01(c.fog + ATM.biomeFog * 0.85 + md.fogBank * 0.95 + md.dunkel * 0.3);
  const fogL = ATM.hor.r * 0.3 + ATM.hor.g * 0.5 + ATM.hor.b * 0.2;
  _gray.setRGB(fogL * 1.1 + 0.04, fogL * 1.08 + 0.04, fogL * 1.15 + 0.06);
  ATM.hor.lerp(_gray, clamp01(c.fog + md.fogBank) * 0.55);
  ATM.zen.lerp(ATM.hor, clamp01(c.fog + md.fogBank * 0.8) * 0.5);
  if (ATM.tintW > 0.01) { _gray.copy(ATM.fogTint).multiplyScalar(1.05 - ATM.night * 0.2); ATM.hor.lerp(_gray, clamp01(ATM.tintW * 1.7)); }
  if (md.dunkel > 0.01) { _gray.setRGB(0.16, 0.09, 0.11); ATM.hor.lerp(_gray, md.dunkel * 0.85); ATM.zen.lerp(_gray.multiplyScalar(0.35), md.dunkel * 0.75); }
  if (md.hell > 0.01) { _gray.setRGB(0.95, 0.5, 0.75); ATM.hor.lerp(_gray, md.hell * 0.25); }
  // Blutmond
  const blood = (env.blood || 0) * (1 - smooth(-0.05, 0.1, Math.sin((dayT - 0.25) * Math.PI * 2)));
  ATM.blood = blood;
  if (blood > 0.01) { _gray.setRGB(0.32, 0.05, 0.07); ATM.hor.lerp(_gray, blood * 0.55); ATM.zen.lerp(_gray.multiplyScalar(0.3), blood * 0.4); }

  const ang = (dayT - 0.25) * Math.PI * 2;
  ATM.sunDir.set(Math.cos(ang) * 0.85, Math.sin(ang), 0.42).normalize();
  ATM.moonDir.set(-Math.cos(ang) * 0.75, 0.09 + 0.3 * Math.max(-Math.sin(ang), 0), -0.62).normalize();
  // die Sonne steht tief hinter dem Abendrot-Schloss, der Mond hinter dem Mondschloss
  if (md.hell > 0.01) ATM.sunDir.lerp(md.hellDir, md.hell).normalize();
  if (md.mond > 0.01) ATM.moonDir.lerp(md.mondDir, smooth(0, 0.7, md.mond)).normalize();
  const sunUp = smooth(-0.08, 0.05, ATM.sunDir.y);
  ATM.night = Math.max(1 - smooth(-0.1, 0.12, ATM.sunDir.y), md.mond * 0.95, md.dunkel * 0.6);

  const sm = G.skyMat.uniforms;
  sm.uZenith.value.copy(ATM.zen); sm.uHorizon.value.copy(ATM.hor);
  sm.uSunDir.value.copy(ATM.sunDir); sm.uMoonDir.value.copy(ATM.moonDir);
  sm.uSunCol.value.copy(ATM.sunC); sm.uSunVis.value = sunUp * (1 - md.mond);
  sm.uMoonVis.value = Math.max(1 - smooth(0.02, 0.3, ATM.sunDir.y), md.mond);
  sm.uMoonSize.value = lerp(0.9905, 0.972, Math.max(md.mond, blood * 0.42));
  sm.uMoonCol.value.setRGB(0.93, 0.9, 0.84).lerp(_c1.setRGB(1, 0.22, 0.12), blood);
  sm.uMoonGlow.value.setRGB(0.42, 0.38, 0.6).lerp(_c1.setRGB(0.8, 0.1, 0.08), blood);
  sm.uStars.value = ATM.night * (1 - fogE * 0.8);
  let coldNow = 0; for (let i = 0; i < NB; i++) coldNow += bw[i] * BIOMES[i].cold;
  const aur = ATM.night * clamp01(coldNow * 1.3 + md.mond * 0.9 + md.feen * 0.3 + 0.45 * smooth(0.2, 1, Math.sin(U.uTime.value * 0.0035 + World.seed % 7))) * (1 - cloudE * 0.85) * (1 - md.dunkel);
  ATM.aur = lerp(ATM.aur || 0, aur, Math.min(1, dt * 0.3));
  sm.uAurora.value = ATM.aur;
  sm.uCloudy.value = clamp01(cloudE * 0.7 + fogE * 0.3 + stormE * 0.2) * (1 - md.mond * 0.7);
  sm.uFlash.value = G.flash;

  // Licht
  const dim = (1 - gloom * 0.4) * (1 - md.dunkel * 0.7);
  G.hemi.color.copy(ATM.hSky); G.hemi.groundColor.copy(ATM.hGround);
  G.hemi.intensity = ATM.hemiI * (1 - stormE * 0.15) * (1 - md.dunkel * 0.6) + G.flash * 0.9;
  G.sun.color.copy(ATM.lightC);
  G.sun.intensity = ATM.lightI * dim * (1 - cloudE * 0.35) * (1 + md.mond * 0.4);
  if (md.feen > 0.01) { G.hemi.color.lerp(_c1.setRGB(1, 0.85, 0.55), md.feen * 0.35); G.hemi.intensity += md.feen * (0.15 + ATM.night * 0.3); }
  let ld = ATM.sunDir.y > -0.02 && md.mond < 0.5 ? ATM.sunDir : ATM.moonDir;
  // Höhle: kein Himmelslicht, nur Glühen
  if (cave) {
    G.hemi.color.copy(cave.amb); G.hemi.groundColor.copy(cave.ground); G.hemi.intensity = cave.ambI + G.flash * 1.4;
    G.sun.intensity = 0;
  }
  // Schatten folgen der Figur; nie zu flach, damit sie nicht ins Unendliche laufen
  _v.copy(ld); if (_v.y < 0.2) { _v.y = 0.2; _v.normalize(); }
  const sx = Math.round(player.x / 4) * 4, sz = Math.round(player.z / 4) * 4, sy = Math.round((player.y || 0) / 4) * 4;
  G.sun.target.position.set(sx, sy, sz);
  G.sun.position.set(sx + _v.x * 220, sy + _v.y * 220, sz + _v.z * 220);
  G.sun.target.updateMatrixWorld();
  U.uLDir.value.copy(_v);
  U.uAmb.value.copy(G.hemi.color).multiplyScalar(G.hemi.intensity);
  U.uAmbG.value.copy(G.hemi.groundColor).multiplyScalar(G.hemi.intensity);
  U.uSunL.value.copy(G.sun.color).multiplyScalar(G.sun.intensity);
  U.uLight.value.copy(G.hemi.color).multiplyScalar(G.hemi.intensity * 0.85).add(_c2.copy(G.sun.color).multiplyScalar(G.sun.intensity * 0.55));
  U.uSunCol.value.copy(ATM.sunC).multiplyScalar(sunUp * (1 - cloudE * 0.6) * (cave ? 0 : 1));
  U.uSunDirW.value.copy(ATM.sunDir);
  U.uCDrift.value.set(ATM.drift.x * 0.0042, ATM.drift.y * 0.0042);
  U.uCShadow.value = cave ? 0 : sunUp * smooth(0.25, 0.7, cloudE) * 0.38 * (1 - c.rain * 0.5);

  // Laterne
  const lan = lanternOn ? (cave ? 1 : clamp01(ATM.night * 1.2 + stormE * 0.3 + fogE * 0.3)) : 0;
  G.lantern.intensity = lan * 1.6;
  G.lantern.position.set(player.x, player.y + 1.6, player.z);
  U.uLanternPos.value.copy(G.lantern.position);
  U.uLanternCol.value.setRGB(1.0, 0.68, 0.38).multiplyScalar(lan * 0.9);

  // Nebel: auf Hügeln sieht man weiter
  const vs = VIEW_SETTINGS[G.view];
  const elevMult = 1 + clamp((env.elev || 0) / 22, 0, 1.7);
  let far = vs.far * elevMult * (1 - fogE * 0.72) * (1 - c.rain * 0.15) * (1 - ATM.night * 0.12);
  let near = 6 + 30 * (1 - fogE);
  G.scene.fog.color.copy(ATM.hor).lerp(ATM.zen, 0.15);
  if (cave) { G.scene.fog.color.copy(cave.fog); near = 6; far = cave.far; }
  G.scene.fog.near = near; G.scene.fog.far = far;
  U.uNearCut.value = (vs.chunks - 0.6) * CHUNK;
  U.uFarCut.value = vs.farR - 140;
  if (Math.abs(G.camera.far - (vs.ultraR + 700)) > 1) { G.camera.far = vs.ultraR + 700; G.camera.updateProjectionMatrix(); }
  // Bodennebel
  const mm = G.mistMats;
  G.mistBase += (player.y - 0.7 - G.mistBase) * Math.min(1, dt * 0.25);
  const mist = cave ? 0 : clamp01(0.06 + c.fog * 0.6 + ATM.biomeFog * 0.8 + ATM.night * 0.25 + md.fogBank * 0.8 + md.dunkel * 0.5 + md.hell * 0.25);
  for (let i = 0; i < G.mists.length; i++) {
    const m = G.mists[i];
    m.position.set(Math.round(cam.x / 4) * 4, G.mistBase + 0.5 + i * 1.25, Math.round(cam.z / 4) * 4);
    m.visible = mist > 0.01;
    mm[i].uniforms.uMist.value = mist * (1 - i * 0.22);
    mm[i].uniforms.uMistCol.value.copy(G.scene.fog.color).lerp(_c2.setRGB(0.8, 0.8, 0.85), 0.12);
  }
  ATM.desat += (desat - ATM.desat) * Math.min(1, dt * 0.5);
  G.postMat.uniforms.uSat.value = cave ? cave.sat : clamp(1.08 - ATM.desat * 0.7 - ATM.night * 0.2 - stormE * 0.2 - fogE * 0.1 - md.dunkel * 0.35 + md.hell * 0.18 + md.feen * 0.2 + md.mond * 0.15, 0.35, 1.3);
  G.postMat.uniforms.uBloom.value = (cave ? cave.bloom * 0.7 : 0.34 + md.hell * 0.2 + md.mond * 0.35 + md.feen * 0.3 + ATM.night * 0.16);
  { const ev = cave ? 1 : ATM.night * 0.9; for (const k in LEAF_MATS) if (k.endsWith('n')) LEAF_MATS[k].userData.emit.value = ev; }
  MAT.neonGlow.uniforms.uAlpha.value = cave ? 1 : 0.2 + ATM.night * 0.8;
  U.uNeon.value = cave ? 1 : (0.12 + ATM.night * 0.88) * (1 - md.dunkel * 0.85);
  U.uFogColor.value.copy(G.scene.fog.color); U.uFogNear.value = near; U.uFogFar.value = far;
  U.uWind.value = c.wind; U.uGrassFar.value = vs.grass;

  // Wolkenmeer, wenn man hoch oben steht (morgens und bei Nebel besonders dicht)
  const morning = smooth(0.18, 0.28, dayT) * (1 - smooth(0.36, 0.46, dayT));
  const seaAmt = cave ? 0 : smooth(SEA_Y + 12, SEA_Y + 50, cam.y) * clamp01(0.45 + morning * 0.5 + c.fog * 0.6 + cloudE * 0.3);
  G.sea.visible = seaAmt > 0.01;
  if (G.sea.visible) {
    G.seaMat.uniforms.uAmt.value = seaAmt;
    G.sea.position.x = Math.round(cam.x / 50) * 50; G.sea.position.z = Math.round(cam.z / 50) * 50;
    G.seaMat.uniforms.uLit.value.copy(ATM.hor).lerp(ATM.sunC, 0.45 * sunUp).multiplyScalar(1.1 - ATM.night * 0.4);
    G.seaMat.uniforms.uShade.value.copy(ATM.zen).lerp(ATM.hor, 0.4).multiplyScalar(0.8);
  }

  // Wolken (im Himmels-Shader)
  ATM.drift.x += U.uWindDir.value.x * dt * (2 + c.wind * 4); ATM.drift.y += U.uWindDir.value.y * dt * (2 + c.wind * 4);
  const cm = G.skyMat.uniforms;
  cm.uDrift.value.set(ATM.drift.x * 0.0011, ATM.drift.y * 0.0011);
  cm.uCover.value = cave ? 0 : clamp01(cloudE * 1.05 + stormE * 0.1) * (1 - md.mond * 0.6);
  _c1.copy(ATM.hor).lerp(ATM.sunC, 0.35 * sunUp).lerp(ATM.zen, 0.2);
  cm.uCloudLit.value.copy(_c1).multiplyScalar(1.2 - stormE * 0.45);
  cm.uCloudDark.value.copy(ATM.zen).lerp(ATM.hor, 0.35).multiplyScalar(0.85 - stormE * 0.35);

  // Wasser
  const wm = G.waterMat.uniforms;
  wm.uSky.value.copy(ATM.hor).lerp(ATM.zen, 0.35);
  wm.uDeep.value.copy(ATM.zen).multiplyScalar(0.45).lerp(_c1.setRGB(0.05, 0.12, 0.16), 0.4);
  wm.uGlintDir.value.copy(ld);
  wm.uGlintCol.value.copy(ATM.sunDir.y > -0.02 && md.mond < 0.5 ? ATM.sunC : _c1.setRGB(0.85, 0.85, 1)).multiplyScalar(1 - cloudE * 0.6);
  G.water.position.x = Math.round(cam.x / 10) * 10; G.water.position.z = Math.round(cam.z / 10) * 10;
  G.water.visible = !cave;

  // Teilchen
  const A = ATM.fxAmt, out = cave ? 0 : 1;
  A.rain = c.rain * (1 - cold) * out;
  A.snow = (c.rain * cold + cold * 0.12 * cloudE) * out;
  A.petals = clamp01(pet * 0.75 * (1 - c.rain) * (0.4 + c.wind * 0.6) + md.hell * 0.4) * out;
  A.flies = cave ? 0.7 : clamp01(fl * (ATM.night * 1.1 + c.fog * 0.3) * (1 - c.rain) * (1 - stormE * 0.4) + md.feen * 0.8 + md.mond * 0.3);
  G.flies.material.uniforms.uColor.value.copy(cave ? cave.fly : md.feen > 0.3 ? _c1.setRGB(1, 0.85, 0.5) : ATM.flyC);
  A.dust = clamp01(du * (1 - ATM.night) * 0.8) * out;
  const wd = U.uWindDir.value, ws = c.wind;
  const setFx = (o, amt, vel, origin) => {
    const u = o.material.uniforms;
    u.uAmt.value = amt; u.uVel.value.copy(vel); u.uOrigin.value.copy(origin);
    if (amt > 0.001) {
      u.uOffset.value.addScaledVector(vel, dt);
      const b = u.uBox.value;
      u.uOffset.value.set(((u.uOffset.value.x % b.x) + b.x) % b.x, ((u.uOffset.value.y % b.y) + b.y) % b.y, ((u.uOffset.value.z % b.z) + b.z) % b.z);
    }
    o.visible = amt > 0.001;
  };
  const o = _v.copy(cam);
  setFx(G.rain, A.rain, _s.set(wd.x * ws * 6, -32, wd.y * ws * 6), o);
  setFx(G.snow, A.snow, _s.set(wd.x * ws * 2, -2.6, wd.y * ws * 2), o);
  G.petals.material.uniforms.uColor.value.copy(md.hell > 0.4 ? _c1.setRGB(1, 0.75, 0.9) : ATM.petalC);
  setFx(G.petals, A.petals, _s.set(wd.x * (1 + ws * 3), -0.7, wd.y * (1 + ws * 3)), o);
  setFx(G.flies, A.flies, _s.set(0.2, 0.05, 0.1), _v.set(player.x, player.y + 2.2, player.z));
  setFx(G.dust, A.dust, _s.set(wd.x * ws * 2, 0.2, wd.y * ws * 2), _v.set(cam.x, cam.y, cam.z));

  // Blitze (an der dunklen Feste besonders oft)
  G.flash = Math.max(0, G.flash - dt * 3.2);
  if (stormE > 0.15 && !cave) {
    ATM.boltT -= dt * stormE * (1 + md.dunkel);
    if (ATM.boltT <= 0) {
      ATM.boltT = 2 + Math.random() * 6;
      const d = spawnBolt(cam, md.dunkel > 0.3 && env.dunkelYaw != null && Math.random() < 0.7 ? env.dunkelYaw + Math.PI : yaw);
      if (onThunder) onThunder(d);
    }
  }
  updateBolts(dt);

  // Lichtstrahlen: Richtung der stärksten Lichtquelle auf dem Bildschirm
  const pm = G.postMat.uniforms;
  const useMoon = !(ATM.sunDir.y > -0.03 && md.mond < 0.5);
  const L = useMoon ? ATM.moonDir : ATM.sunDir;
  G.camera.getWorldDirection(_s);
  const face = smooth(0.25, 0.85, _s.dot(L));
  _v.copy(G.camera.position).addScaledVector(L, 900).project(G.camera);
  G.rayMat.uniforms.uLight.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
  const low = 1 - smooth(0.05, 0.5, L.y);
  let rs = useMoon ? sm.uMoonVis.value * (0.45 + md.mond * 0.6) : sunUp * (0.35 + low * 0.55 + md.hell * 0.4);
  rs *= face * (1 - stormE * 0.6) * (1 - clamp01(fogE - 0.5) * 0.8) * (cave ? 0 : 1) * (L.y > -0.05 ? 1 : 0);
  ATM.rays = lerp(ATM.rays || 0, rs, Math.min(1, dt * 3));
  pm.uRays.value = ATM.rays;
  pm.uRayCol.value.copy(useMoon ? _c1.setRGB(0.7, 0.8, 1.0).lerp(_c2.setRGB(1, 0.2, 0.15), ATM.blood) : _c1.copy(ATM.sunC).lerp(_c2.setRGB(1, 0.9, 0.75), 0.4));
  // Farbstimmung je nach Ort
  const st = pm.uShadowTint.value, ht = pm.uHighTint.value;
  st.setRGB(0.8, 0.82, 1.12); ht.setRGB(0.2, 0.13, 0.04);
  st.lerp(_c1.setRGB(1.05, 0.72, 0.75), md.dunkel); ht.lerp(_c1.setRGB(0.25, 0.03, 0.0), md.dunkel);
  st.lerp(_c1.setRGB(0.72, 0.86, 1.3), Math.max(md.mond, ATM.night * 0.5)); ht.lerp(_c1.setRGB(0.08, 0.12, 0.25), md.mond);
  st.lerp(_c1.setRGB(1.05, 0.78, 1.15), md.hell); ht.lerp(_c1.setRGB(0.32, 0.12, 0.22), md.hell);
  st.lerp(_c1.setRGB(1.2, 0.6, 0.62), ATM.blood); ht.lerp(_c1.setRGB(0.3, 0.02, 0.02), ATM.blood);
  if (cave) { st.copy(cave.amb).multiplyScalar(1.4).addScalar(0.3); ht.setRGB(0.1, 0.06, 0.12); }
}

// ---------- Gelände in Stücken ----------
const _tw = new Float32Array(NB), _tc = [0, 0, 0];
const PATH_C = [0.2, 0.16, 0.12];
function buildChunk(ci, cj) {
  const N = CHUNK_RES, S = CHUNK / N, x0 = ci * CHUNK, z0 = cj * CHUNK;
  const V = N + 1, VV = N + 3;
  const H = new Float32Array(V * V), WW = new Float32Array(V * V * NB), HH = new Float32Array(VV * VV);
  for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) {
    const x = x0 + i * S, z = z0 + j * S;
    const w = weightsAt(x, z, _tw);
    const h = heightAt(x, z, w);
    HH[(j + 1) * VV + i + 1] = h;
    if (i >= 0 && i <= N && j >= 0 && j <= N) { H[j * V + i] = h; WW.set(w, (j * V + i) * NB); }
  }
  const segs = pathSegsNear(x0, z0, x0 + CHUNK, z0 + CHUNK);
  const pos = new Float32Array(V * V * 3), nor = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), pth = new Float32Array(V * V), mat = new Float32Array(V * V).fill(MT.ground);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const idx = j * V + i, x = x0 + i * S, z = z0 + j * S, h = H[idx];
    const hl = HH[(j + 1) * VV + i], hr = HH[(j + 1) * VV + i + 2], hd = HH[j * VV + i + 1], hu = HH[(j + 2) * VV + i + 1];
    let nx = (hl - hr) / (2 * S), nz = (hd - hu) / (2 * S), ny = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    pos[idx * 3] = x; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = z;
    nor[idx * 3] = nx; nor[idx * 3 + 1] = ny; nor[idx * 3 + 2] = nz;
    groundColor(x, z, h, (1 - ny) * 2.2, WW.subarray(idx * NB, idx * NB + NB), _tc);
    col[idx * 3] = _tc[0]; col[idx * 3 + 1] = _tc[1]; col[idx * 3 + 2] = _tc[2];
    pth[idx] = segs.length && h > 0.3 ? Math.min(8, pathDist(x, z, segs)) : 9;
  }
  const idxs = new Uint32Array(N * N * 6);
  let o = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    idxs[o++] = a; idxs[o++] = c; idxs[o++] = b; idxs[o++] = b; idxs[o++] = c; idxs[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1));
  g.setAttribute('aPath', new THREE.BufferAttribute(pth, 1));
  g.setIndex(new THREE.BufferAttribute(idxs, 1));
  g.computeBoundingSphere();
  const ground = new THREE.Mesh(g, MAT.ground);
  ground.receiveShadow = true;
  const group = new THREE.Group();
  group.add(ground);

  const r = mulberry32(hash2(ci, cj, World.seed + 99));
  const mg = new Merger();
  const chunk = { ci, cj, H, WW, group, segs, col: [], trees: [], interact: [], shrines: [], layerFar: null, layerNear: null, near: false, out: null };
  const bigL = bigNear(x0 + CHUNK / 2, z0 + CHUNK / 2, 330);
  planTrees(chunk, r, segs, bigL);
  // weiche Schatten unter den Baumkronen (in der Ferne, wo es keine echten Schatten gibt)
  for (const t of chunk.trees) {
    const rad = Math.min(14, t.crown * 0.8);
    const i0 = Math.max(0, Math.floor((t.x - rad * 1.3 - x0) / S)), i1 = Math.min(N, Math.ceil((t.x + rad * 1.3 - x0) / S));
    const j0 = Math.max(0, Math.floor((t.z - rad * 1.3 - z0) / S)), j1 = Math.min(N, Math.ceil((t.z + rad * 1.3 - z0) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = (j * V + i) * 3;
      const d = Math.hypot(pos[b] - t.x, pos[b + 2] - t.z);
      const f = 1 - 0.4 * smooth(rad * 1.25, rad * 0.2, d);
      col[b] *= f; col[b + 1] *= f; col[b + 2] *= f;
    }
  }
  if (chunk.trees.length) g.attributes.color.needsUpdate = true;
  // Wegweiser: Laternenpfähle und Wegsteine am Pfad
  const wps = new PointSet();
  if (segs.length && r() < 0.5) {
    const sg = segs[Math.floor(r() * segs.length)], t = r();
    const ex = sg[2] - sg[0], ez = sg[3] - sg[1], l = Math.hypot(ex, ez) || 1, side = r() < 0.5 ? -1 : 1;
    const x = sg[0] + ex * t - ez / l * 2.8 * side, z = sg[1] + ez * t + ex / l * 2.8 * side;
    if (x > x0 && x < x0 + CHUNK && z > z0 && z < z0 + CHUNK) {
      const h = chunkHeight(chunk, x, z);
      if (h > 0.6 && !nearSite(x, z, 3)) {
        if (r() < 0.6) {
          mg.add('cyl6', M(x, h - 0.2, z, 0.09, 2.4, 0.09), [0.2, 0.15, 0.12], 0.1, r, MT.wood);
          mg.add('box', M(x + 0.25, h + 2.15, z, 0.55, 0.1, 0.1), [0.2, 0.15, 0.12], 0.1, r, MT.wood);
          mg.add('box', M(x + 0.48, h + 1.9, z, 0.24, 0.3, 0.24), [0.12, 0.1, 0.09], 0.1, r, MT.metal);
          wps.add(x + 0.48, h + 1.88, z, [1, 0.7, 0.35], 1);
          chunk.col.push({ x, z, r: 0.25, top: h + 2.4 });
        } else {
          mg.add('rock', M(x, h + 0.5, z, 0.3, 0.65, 0.2, 0, r() * 3, (r() - 0.5) * 0.15), [0.42, 0.42, 0.46], 0.15, r);
          wps.add(x, h + 1.15, z, [0.55, 0.85, 1], 0.6);
          chunk.col.push({ x, z, r: 0.35, top: h + 1.2 });
        }
      }
    }
  }
  for (let k = 0; k < 5; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const h = chunkHeight(chunk, x, z);
    if (r() < 0.45 || nearSite(x, z, 3)) continue;
    const w = chunkWeights(chunk, x, z, _tw);
    const B = BIOMES[sampleBiome(w, r())];
    const s = 0.5 + r() * r() * 2.6;
    const rc = B.rockC.map(v => v * (0.85 + r() * 0.25));
    mg.add('rock', M(x, h + s * 0.25, z, s * (1 + r() * 0.5), s * (0.6 + r() * 0.5), s, 0, r() * 6, 0), rc, 0.18, r);
    if (r() < 0.45) mg.add('rock', M(x + s, h + s * 0.1, z + s * 0.4, s * 0.5, s * 0.4, s * 0.5, 0, r() * 6, 0), rc, 0.2, r);
    // Moos auf Felsen in feuchten Biomen
    if (B.grass > 0.4) mg.add('ico', M(x, h + s * 0.62, z, s * 0.8, s * 0.2, s * 0.7, 0, 0, 0), B.stemC.map(v => v * 0.7), 0.1, r, MT.gen);
    chunk.col.push({ x, z, r: s * 0.95, top: h + s * 0.9 });
  }
  // Gebirge: Felsbrocken, Zacken und verschneite Blöcke
  const hMid = H[(N >> 1) * V + (N >> 1)];
  if (hMid > 22) {
    const nR = Math.round(4 + smooth(22, 90, hMid) * 12);
    for (let k = 0; k < nR; k++) {
      const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK, h = chunkHeight(chunk, x, z);
      if (nearSite(x, z, 4)) continue;
      const w = chunkWeights(chunk, x, z, _tw), B = BIOMES[sampleBiome(w, r())];
      const sc = smooth(40, 110, h), c = h > 60 + r() * 30 && r() < 0.6 ? [0.86, 0.88, 0.95] : B.rockC.map(v => v * (0.8 + r() * 0.3));
      const sz = 0.9 + r() * r() * (2 + sc * 3);
      if (r() < 0.12 + sc * 0.18) mg.add('cone6', M(x, h - sz * 0.4, z, sz * 0.75, sz * (1.6 + r() * 1.8), sz * 0.65, (r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3), c, 0.2, r);
      else mg.add('rock', M(x, h + sz * 0.2, z, sz * (1 + r() * 0.7), sz * (0.5 + r() * 0.6), sz, 0, r() * 6, 0), c, 0.2, r);
      chunk.col.push({ x, z, r: sz * 0.85, top: h + sz });
    }
  }
  chunk.shrines = [];
  const gps = new PointSet();
  if (r() < 0.2) {
    const x = x0 + 8 + r() * (CHUNK - 16), z = z0 + 8 + r() * (CHUNK - 16), h = chunkHeight(chunk, x, z);
    if (h > 0.6 && !nearSite(x, z, 14)) buildDecor(pick(r, ['schwert', 'statue', 'schrein', 'graeber', 'schwert', 'schrein', 'statue']), x, h, z, r, mg, gps, chunk);
  }
  if (!mg.empty) for (const gg of mg.buildBuckets(64)) { const m = new THREE.Mesh(gg, MAT.flat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (!wps.empty) group.add(new THREE.Points(wps.build(), MAT.glowBig));
  // Leuchtpilze und Leuchtblumen
  const gpsN = new PointSet();
  for (let k = 0; k < 7; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const w = chunkWeights(chunk, x, z, _tw), B = BIOMES[sampleBiome(w, r())];
    if (r() > B.neon * 0.8) continue;
    const h = chunkHeight(chunk, x, z);
    if (h < 0.3) continue;
    const nc = B.neonCC[Math.floor(r() * 3)], n = 5 + Math.floor(r() * 10);
    for (let q = 0; q < n; q++) { const qx = x + (r() - 0.5) * 2.5, qz = z + (r() - 0.5) * 2.5; gpsN.add(qx, chunkHeight(chunk, qx, qz) + 0.12 + r() * 0.35, qz, nc, 0.7 + r() * 0.3); }
  }
  if (!gps.empty) group.add(new THREE.Points(gps.build(), MAT.glow));
  if (!gpsN.empty) group.add(new THREE.Points(gpsN.build(), MAT.neonGlow));
  // Baumschicht (fern) und Bodenbewuchs
  chunk.layerFar = buildTreeLayer(chunk, false);
  group.add(chunk.layerFar);
  planUnderwood(chunk, r, segs);
  G.scene.add(group);
  return chunk;
}

function nearSite(x, z, extra) {
  const s = siteAt(Math.floor(x / CELL), Math.floor(z / CELL));
  if (!s) return false;
  const R = s.type === 'burg' ? s.flatR + extra : s.type === 'wanderer' ? 0 : s.flatR ? s.flatR * 0.8 + extra : 0;
  return R > 0 && Math.hypot(x - s.x, z - s.z) < R;
}

function chunkHeight(ch, x, z) {
  const S = CHUNK / CHUNK_RES, V = CHUNK_RES + 1;
  let fx = (x - ch.ci * CHUNK) / S, fz = (z - ch.cj * CHUNK) / S;
  fx = clamp(fx, 0, CHUNK_RES - 1e-4); fz = clamp(fz, 0, CHUNK_RES - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const H = ch.H, a = H[j * V + i], b = H[j * V + i + 1], c = H[(j + 1) * V + i], d = H[(j + 1) * V + i + 1];
  // gleiche Dreiecksteilung wie das Gitter (a,c,b) und (b,c,d)
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
function chunkWeights(ch, x, z, out) {
  const S = CHUNK / CHUNK_RES, V = CHUNK_RES + 1;
  const fx = clamp((x - ch.ci * CHUNK) / S, 0, CHUNK_RES - 1e-4), fz = clamp((z - ch.cj * CHUNK) / S, 0, CHUNK_RES - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const W = ch.WW, a = (j * V + i) * NB, b = a + NB, c = a + V * NB, d = c + NB;
  for (let k = 0; k < NB; k++) out[k] = (W[a + k] * (1 - u) + W[b + k] * u) * (1 - v) + (W[c + k] * (1 - u) + W[d + k] * u) * v;
  return out;
}
// Höhe des Bodens; in Bauwerken zusätzlich begehbare Böden (siehe walkY)
function groundY(x, z) {
  if (G.caveGround) { const y = G.caveGround(x, z); if (y != null) return y; }
  const ch = G.chunks.get(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
  if (ch) return chunkHeight(ch, x, z);
  return heightAt(x, z);
}

// ---------- Gras: Büschel aus mehreren Halmen mit Wind, Schatten und Platz für die Figur ----------
function makeGrassTuft() {
  const r = mulberry32(77), pos = [], info = [], idx = [];
  const NBL = 6, SEG = 3;
  for (let b = 0; b < NBL; b++) {
    const ang = b / NBL * 6.2832 + r() * 0.9, d = 0.03 + r() * 0.13;
    const ox = Math.cos(ang + 1.1) * d, oz = Math.sin(ang + 1.1) * d;
    const bh = 0.6 + r() * 0.55, bw = 0.026 + r() * 0.014, f = r() * 6.2832, lean = 0.1 + r() * 0.35;
    const seed = r();
    const base = pos.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const cx = ox + Math.cos(ang) * lean * t * t * bh, cz = oz + Math.sin(ang) * lean * t * t * bh, cy = t * bh - lean * lean * t * t * bh * 0.3;
      const w = bw * (1 - Math.pow(t, 1.7) * 0.92);
      if (k === SEG) { pos.push(cx, cy, cz); info.push(seed, t, f, 0); }
      else {
        pos.push(cx + Math.cos(f) * w, cy, cz + Math.sin(f) * w); info.push(seed, t, f, 1);
        pos.push(cx - Math.cos(f) * w, cy, cz - Math.sin(f) * w); info.push(seed, t, f, -1);
      }
    }
    for (let k = 0; k < SEG - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const L0 = base + (SEG - 1) * 2; idx.push(L0, L0 + 1, base + SEG * 2);
  }
  return { pos: new Float32Array(pos), info: new Float32Array(info), idx };
}
const GRASS_TUFT = makeGrassTuft();
function makeGrassMat() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, { uPlayerR: { value: 1.8 }, uLDir: { value: new THREE.Vector3(0, 1, 0) }, uAmb: { value: new THREE.Color() }, uAmbG: { value: new THREE.Color() }, uSunL: { value: new THREE.Color() } }]);
  for (const k of ['uTime', 'uWind', 'uWindDir', 'uFogColor', 'uFogNear', 'uFogFar', 'uCam', 'uPlayer', 'uGrassFar', 'uNeon', 'uCDrift', 'uCShadow', 'uLanternPos', 'uLanternCol']) uniforms[k] = U[k];
  uniforms.uLDir = U.uLDir; uniforms.uAmb = U.uAmb; uniforms.uAmbG = U.uAmbG; uniforms.uSunL = U.uSunL;
  return new THREE.ShaderMaterial({
    uniforms, lights: true, side: THREE.DoubleSide,
    vertexShader: `
      #include <common>
      #include <shadowmap_pars_vertex>
      ${FOG_V}
      uniform float uTime, uWind, uGrassFar, uNeon, uPlayerR;
      uniform vec2 uWindDir; uniform vec3 uCam, uPlayer, uLDir, uAmb, uAmbG, uSunL, uLanternPos, uLanternCol;
      attribute vec4 aInfo; attribute vec3 iPos; attribute vec4 iPar; attribute vec3 iTip; attribute vec3 iStem; attribute float iGlow;
      varying vec3 vAmb; varying vec3 vSun;
      void main(){
        float t = aInfo.y;
        float d = distance(iPos.xz, uCam.xz);
        float thin = mix(1.0, 0.22, smoothstep(uGrassFar * 0.3, uGrassFar * 0.85, d));
        if (iPar.w > thin || d > uGrassFar) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vFog = 1.0; vAmb = vec3(0.0); vSun = vec3(0.0); return; }
        float hg = iPar.x * (1.0 - smoothstep(uGrassFar * 0.72, uGrassFar, d)) * (0.85 + 0.15 * thin);
        vec3 p = iPos + vec3(position.x * iPar.y, position.y * hg, position.z * iPar.y);
        float ph = uTime * 1.9 + iPos.x * 0.23 + iPos.z * 0.19 + iPar.z + aInfo.x * 2.0;
        float gust = sin(uTime * 0.8 - dot(iPos.xz, uWindDir) * 0.05) + 0.5 * sin(uTime * 1.7 - dot(iPos.xz, uWindDir.yx * vec2(1.0, -1.0)) * 0.11);
        float sway = (sin(ph) * 0.2 + gust * 0.3 + 0.14) * uWind * t * t * hg * 0.5;
        sway += sin(uTime * 4.6 + iPos.x * 1.9 + aInfo.x * 30.0) * 0.035 * uWind * t * t * hg;
        p.xz += uWindDir * sway; p.y -= abs(sway) * 0.3 * t;
        // die Figur streift das Gras zur Seite
        vec2 dp = p.xz - uPlayer.xz; float dl = length(dp);
        float near = (1.0 - smoothstep(0.0, uPlayerR, dl)) * (1.0 - smoothstep(1.5, 4.5, abs(iPos.y - uPlayer.y)));
        p.xz += dp / (dl + 0.05) * near * 0.6 * t * t * hg; p.y -= near * 0.4 * t * hg;
        vec4 worldPosition = vec4(p, 1.0);
        vec3 transformedNormal = normalMatrix * vec3(0.0, 1.0, 0.0);
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <shadowmap_vertex>
        vec3 base = mix(iStem, iTip, smoothstep(0.3, 0.95, t)) * (0.78 + 0.3 * t) * (0.88 + 0.24 * aInfo.x);
        base *= mix(0.5, 1.0, smoothstep(0.0, 0.55, t));
        vec3 fc = vec3(-sin(aInfo.z), 0.0, cos(aInfo.z));
        vec3 vd = normalize(p - uCam);
        fc *= sign(dot(fc, -vd) + 0.0001);
        vec3 n = normalize(vec3(0.0, 1.0, 0.0) + fc * 0.45);
        float dif = max(dot(n, uLDir), 0.0) * 0.8 + 0.2;
        float back = pow(max(dot(vd, uLDir), 0.0), 4.0) * smoothstep(0.2, 0.9, t);
        float gl = iGlow * uNeon * smoothstep(0.5, 0.8, t) * (0.75 + 0.25 * sin(uTime * 2.0 + iPar.z * 3.0));
        float cs = cloudSh(p.xz);
        float ld = distance(p, uLanternPos);
        vec3 lan = uLanternCol * pow(max(0.0, 1.0 - ld / 12.0), 2.0) * 1.2;
        vAmb = base * (mix(uAmbG, uAmb, 0.45 + 0.55 * t) * 0.95 + lan);
        vSun = base * (uSunL * dif + uSunL * vec3(1.0, 0.95, 0.7) * back * 1.1) * cs;
        vAmb *= cs;
        vAmb = mix(vAmb, iTip * 1.25, gl);
        vSun *= 1.0 + max(gust, 0.0) * 0.12 * t * uWind;
        vFog = aerialF(-mvPosition.z, p.y, uFogNear, uFogFar) * (1.0 - gl * 0.6);
      }`,
    fragmentShader: `
      #include <common>
      #include <packing>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      uniform vec3 uFogColor; varying float vFog;
      varying vec3 vAmb; varying vec3 vSun;
      void main(){
        float sm = getShadowMask();
        gl_FragColor = vec4(mix(vAmb + vSun * sm, uFogColor, vFog), 1.0);
      }`,
  });
}

function buildGrass(ch) {
  const r = mulberry32(hash2(ch.ci, ch.cj, World.seed + 5));
  const max = Math.floor(VIEW_SETTINGS[G.view].grassMax * QUALITY[G.quality].grass);
  const x0 = ch.ci * CHUNK, z0 = ch.cj * CHUNK;
  const iPos = [], iPar = [], iTip = [], iStem = [], iGlow = [];
  const w = new Float32Array(NB);
  for (let k = 0; k < max; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    chunkWeights(ch, x, z, w);
    let dens = 0; for (let b = 0; b < NB; b++) dens += w[b] * BIOMES[b].grass;
    const patch = World.nD.noise(x * 0.03, z * 0.03) * 0.5 + 0.5;
    if (r() > dens * (0.4 + patch * 0.9)) continue;
    const h = chunkHeight(ch, x, z);
    if (h < 0.15 || h > 40 + r() * 14) continue;
    if (nearCampfire(x, z)) continue;
    if (ch.segs.length && pathDist(x, z, ch.segs) < (r() < 0.8 ? 1.8 : 0.9)) continue;
    // unter dichtem Wald wächst weniger
    const fo = forestAt(x, z);
    if (r() < fo * 0.45) continue;
    if (grassBlocked(ch, x, z)) continue;
    const B = BIOMES[sampleBiome(w, r())];
    const hh = B.grassH * 0.62 * (0.55 + r() * 0.65) * (0.7 + patch * 0.55);
    iPos.push(x, h - 0.04, z);
    iPar.push(hh, 0.8 + r() * 0.7, r() * 6.28, r());
    const f = 0.82 + r() * 0.3, alt = r() < 0.06 ? 1.15 : 1;
    if (r() < B.neon * 0.22) {
      const nc = B.neonCC[Math.floor(r() * 3)];
      iTip.push(nc[0], nc[1], nc[2]); iGlow.push(1);
    } else {
      // Halme bleiben grün, die Spitzen tragen die Farbe des Bioms
      const gm = 0.55;
      iTip.push(Math.min(1, lerp(B.stemC[0] * 1.15, B.tipC[0], gm) * f * alt), Math.min(1, lerp(B.stemC[1] * 1.15, B.tipC[1], gm) * f * alt), Math.min(1, lerp(B.stemC[2] * 1.15, B.tipC[2], gm) * f * alt)); iGlow.push(0);
    }
    const fs = 0.75 + r() * 0.35;
    iStem.push(B.stemC[0] * fs, B.stemC[1] * fs, B.stemC[2] * fs);
  }
  if (!iPos.length) return null;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(GRASS_TUFT.pos, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(GRASS_TUFT.info, 4));
  g.setIndex(GRASS_TUFT.idx);
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(iPos), 3));
  g.setAttribute('iPar', new THREE.InstancedBufferAttribute(new Float32Array(iPar), 4));
  g.setAttribute('iTip', new THREE.InstancedBufferAttribute(new Float32Array(iTip), 3));
  g.setAttribute('iStem', new THREE.InstancedBufferAttribute(new Float32Array(iStem), 3));
  g.setAttribute('iGlow', new THREE.InstancedBufferAttribute(new Float32Array(iGlow), 1));
  g.instanceCount = iPos.length / 3;
  const m = new THREE.Mesh(g, MAT.grass);
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.userData.cx = x0 + CHUNK / 2; m.userData.cz = z0 + CHUNK / 2;
  G.scene.add(m);
  return m;
}
// Kein Gras direkt an Stämmen, Felsen und Findlingen
function grassBlocked(ch, x, z) {
  for (const c of ch.col) {
    if (c.seg) continue;
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < (c.r + 0.15) * (c.r + 0.15)) return true;
  }
  return false;
}
function nearCampfire(x, z) {
  const s = siteAt(Math.floor(x / CELL), Math.floor(z / CELL));
  return s && s.type === 'lager' && Math.hypot(x - s.x, z - s.z) < 4.5;
}

function disposeObj(o) {
  o.traverse(c => {
    if (c.isSprite) { if (c.material) c.material.dispose(); return; }
    if (c.geometry && !c.geometry.userData.keep) c.geometry.dispose();
  });
  if (o.parent) o.parent.remove(o);
}

// Stücke rund um den Spieler laden und entfernen; gibt true zurück, wenn alles Nahe da ist
function updateChunks(px, pz, budgetMs) {
  const vs = VIEW_SETTINGS[G.view];
  const R = vs.chunks;
  const pci = Math.floor(px / CHUNK), pcj = Math.floor(pz / CHUNK);
  const t0 = performance.now();
  const need = [];
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (i * i + j * j > (R + 0.5) * (R + 0.5)) continue;
    const key = (pci + i) + ',' + (pcj + j);
    if (!G.chunks.has(key)) need.push([i * i + j * j, pci + i, pcj + j, key]);
  }
  need.sort((a, b) => a[0] - b[0]);
  for (const [, ci, cj, key] of need) {
    if (performance.now() - t0 > budgetMs) break;
    G.chunks.set(key, buildChunk(ci, cj));
  }
  for (const [key, ch] of G.chunks) {
    const di = ch.ci - pci, dj = ch.cj - pcj;
    if (di * di + dj * dj > (R + 2) * (R + 2)) { disposeChunk(ch); if (G.grass.has(key)) { const gm = G.grass.get(key); if (gm) disposeObj(gm); G.grass.delete(key); } G.chunks.delete(key); }
  }
  // Gras und nahes Laub
  const GR = vs.grass + CHUNK * 0.75, LR = vs.leaf * QUALITY[G.quality].leaf + CHUNK * 0.5;
  const gneed = [], lneed = [];
  for (const [key, ch] of G.chunks) {
    const cx = ch.ci * CHUNK + CHUNK / 2, cz = ch.cj * CHUNK + CHUNK / 2;
    const d = Math.hypot(cx - px, cz - pz);
    const has = G.grass.has(key);
    if (d < GR && !has) gneed.push([d, key, ch]);
    else if (d > GR + 30 && has) { const gm = G.grass.get(key); if (gm) disposeObj(gm); G.grass.delete(key); }
    if (d < LR && !ch.layerNear) lneed.push([d, ch]);
    else if (ch.layerNear) {
      const wantNear = d < LR + (ch.near ? 14 : 0);
      if (wantNear !== ch.near) setChunkNear(ch, wantNear);
      if (!wantNear && d > LR + 90) { disposeObj(ch.layerNear); ch.layerNear = null; if (ch.underObj) { disposeObj(ch.underObj); ch.underObj = null; } }
    }
  }
  lneed.sort((a, b) => a[0] - b[0]);
  for (const [, ch] of lneed) {
    if (performance.now() - t0 > budgetMs) break;
    buildChunkNear(ch);
  }
  gneed.sort((a, b) => a[0] - b[0]);
  for (const [, key, ch] of gneed) {
    if (performance.now() - t0 > budgetMs) break;
    G.grass.set(key, buildGrass(ch));
  }
  const ready = need.length === 0 && gneed.length === 0 && lneed.length === 0;
  if (ready || performance.now() - t0 < budgetMs * 0.5) updateFar(px, pz, t0, budgetMs);
  return ready;
}
function disposeChunk(ch) {
  disposeObj(ch.group);
  if (ch.layerNear) disposeObj(ch.layerNear);
  if (ch.underObj) disposeObj(ch.underObj);
}
function buildChunkNear(ch) {
  ch.layerNear = buildTreeLayer(ch, true);
  ch.group.add(ch.layerNear);
  if (ch.under) { ch.underObj = buildUnderwood(ch); if (ch.underObj) ch.group.add(ch.underObj); }
  setChunkNear(ch, true);
}
function setChunkNear(ch, near) {
  ch.near = near;
  if (ch.layerNear) ch.layerNear.visible = near;
  if (ch.layerFar) ch.layerFar.visible = !near;
  if (ch.underObj) ch.underObj.visible = near;
}

function clearChunks() {
  for (const [, ch] of G.chunks) disposeChunk(ch);
  for (const [, gm] of G.grass) if (gm) disposeObj(gm);
  for (const [, ft] of G.far) disposeObj(ft);
  G.chunks.clear(); G.grass.clear(); G.far.clear();
}


// ---------- Fernes Gelände: grobe Kacheln bis zum Horizont, mit Baumkronen als Punkten ----------
const FAR = 192, FAR_RES = 12;
G.far = new Map();
const _fw = new Float32Array(NB);
const FAR_LV = [
  { size: 192, res: 12, drop: 1.1, ultra: false },
  { size: 640, res: 14, drop: 3.5, ultra: true },
];
function buildFarTile(fi, fj, lv = FAR_LV[0]) {
  const N = lv.res, FAR = lv.size, S = FAR / N, V = N + 1, VV = N + 3, x0 = fi * FAR, z0 = fj * FAR;
  const HH = new Float32Array(VV * VV), WW = new Float32Array(V * V * NB);
  for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) {
    const x = x0 + i * S, z = z0 + j * S;
    const w = weightsAt(x, z, _fw);
    HH[(j + 1) * VV + i + 1] = heightAt(x, z, w) - lv.drop;
    if (i >= 0 && i <= N && j >= 0 && j <= N) WW.set(w, (j * V + i) * NB);
  }
  const pos = new Float32Array(V * V * 3), nor = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), mat = new Float32Array(V * V).fill(MT.ground);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const idx = j * V + i, x = x0 + i * S, z = z0 + j * S, h = HH[(j + 1) * VV + i + 1];
    const hl = HH[(j + 1) * VV + i], hr = HH[(j + 1) * VV + i + 2], hd = HH[j * VV + i + 1], hu = HH[(j + 2) * VV + i + 1];
    let nx = (hl - hr) / (2 * S), nz = (hd - hu) / (2 * S), ny = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    pos[idx * 3] = x; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = z;
    nor[idx * 3] = nx; nor[idx * 3 + 1] = ny; nor[idx * 3 + 2] = nz;
    const wv = WW.subarray(idx * NB, idx * NB + NB), my = h + lv.drop;
    groundColor(x, z, my, (1 - ny) * 2.2, wv, _tc);
    // Wälder als dunkle Flächen bis zum Horizont
    let td = 0; for (let b = 0; b < NB; b++) td += wv[b] * BIOMES[b].trees;
    const fo = Math.max(forestAt(x, z) * Math.min(1, td * 1.5 + 0.1), td * 0.15) * (1 - smooth(40, 70, my)) * (my > 0.5 ? 1 : 0);
    const cc = BIOMES[dominantBiome(wv)].canopyC[1];
    for (let q = 0; q < 3; q++) _tc[q] = lerp(_tc[q], cc[q] * 0.75, fo * 0.8);
    col[idx * 3] = _tc[0]; col[idx * 3 + 1] = _tc[1]; col[idx * 3 + 2] = _tc[2];
  }
  const idxs = new Uint32Array(N * N * 6);
  let o = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; idxs[o++] = a; idxs[o++] = c; idxs[o++] = b; idxs[o++] = b; idxs[o++] = c; idxs[o++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1));
  g.setIndex(new THREE.BufferAttribute(idxs, 1));
  g.computeBoundingSphere();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, lv.ultra ? MAT.ultraTerrain : MAT.farTerrain));
  // Baumkronen: Wälder bilden dunkle Bänder bis zum Horizont
  const r = mulberry32(hash2(fi, fj, World.seed + 777)), fm = new Merger();
  for (let k = 0; k < (lv.ultra ? 0 : 110); k++) {
    const x = x0 + r() * FAR, z = z0 + r() * FAR;
    const w = weightsAt(x, z, _fw);
    let td = 0; for (let b = 0; b < NB; b++) td += w[b] * BIOMES[b].trees;
    const fo = Math.max(forestAt(x, z) * Math.min(1, td * 1.5 + 0.1), td * 0.08);
    if (r() > fo * 1.6) continue;
    const h = heightAt(x, z, w) - lv.drop * 0.4;
    if (h < 0.6 || h > 45 + r() * 25) continue;
    const B = BIOMES[sampleBiome(w, r())];
    const c = B.canopyC[r() < 0.6 ? 0 : 1];
    const conif = B.tree === 'tanne' || B.tree === 'schneetanne';
    const giant = r() < 0.08;
    const hh = (conif ? 14 : 9) * (giant ? 3 : 1) * (0.8 + r() * 0.5), rr = (conif ? 3.6 : 6) * (giant ? 2.2 : 1) * (0.8 + r() * 0.5);
    if (conif) fm.add('cone', M(x, h + hh * 0.18, z, rr, hh * 0.86, rr), c.map(v => v * 0.8), 0.15, r, 13);
    else fm.add('ico', M(x, h + hh * 0.72, z, rr, hh * 0.42, rr), c.map(v => v * 0.8), 0.15, r, 13);
  }
  if (!fm.empty) grp.add(new THREE.Mesh(fm.build(), MAT.leafFar));
  reflectable(grp);
  G.scene.add(grp);
  return grp;
}
function updateFar(px, pz, t0, budgetMs) {
  const vs = VIEW_SETTINGS[G.view];
  const need = [];
  for (let l = 0; l < FAR_LV.length; l++) {
    const lv = FAR_LV[l], F = lv.size, R = l ? vs.ultraR : vs.farR;
    const fi0 = Math.floor((px - R) / F), fi1 = Math.floor((px + R) / F), fj0 = Math.floor((pz - R) / F), fj1 = Math.floor((pz + R) / F);
    for (let i = fi0; i <= fi1; i++) for (let j = fj0; j <= fj1; j++) {
      const d = Math.hypot((i + 0.5) * F - px, (j + 0.5) * F - pz);
      if (d > R + F * 0.5 || (l && d < vs.farR - F)) continue;
      const key = l + ':' + i + ',' + j;
      // ferne Stufe erst laden, wenn die nahe Ferne steht
      if (!G.far.has(key)) need.push([d + l * 600, i, j, key, lv]);
    }
  }
  need.sort((a, b) => a[0] - b[0]);
  for (const [, i, j, key, lv] of need) {
    if (performance.now() - t0 > budgetMs) break;
    G.far.set(key, buildFarTile(i, j, lv));
  }
  for (const [key, ft] of G.far) {
    const l = +key[0], [i, j] = key.slice(2).split(',').map(Number), F = FAR_LV[l].size;
    const d = Math.hypot((i + 0.5) * F - px, (j + 0.5) * F - pz);
    if (d > (l ? vs.ultraR : vs.farR) + F * 1.6 || (l && d < vs.farR - F * 2.2)) { disposeObj(ft); G.far.delete(key); }
  }
}

// ---------- Bodennebel ----------
function initMist() {
  G.mists = []; G.mistMats = []; G.mistBase = 0;
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMist: { value: 0 }, uMistCol: { value: new THREE.Color() }, uLayer: { value: i }, uLanternPos: U.uLanternPos, uLanternCol: U.uLanternCol },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        uniform float uTime, uMist, uLayer; uniform vec3 uMistCol, uLanternPos, uLanternCol;
        varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
        void main(){
          vec2 q = vW.xz + uLayer * 37.0;
          float n = vn(q * 0.035 + vec2(uTime * 0.03, uTime * 0.012)) * 0.6 + vn(q * 0.11 - vec2(uTime * 0.05, -uTime * 0.02)) * 0.4;
          float d = distance(vW.xz, cameraPosition.xz);
          float a = smoothstep(0.3, 0.78, n) * uMist * smoothstep(3.0, 16.0, d) * (1.0 - smoothstep(120.0, 170.0, d));
          float ld = distance(vW, uLanternPos);
          vec3 col = uMistCol + uLanternCol * pow(max(0.0, 1.0 - ld / 10.0), 2.0) * 0.6;
          gl_FragColor = vec4(col, a * 0.5);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 5 + i;
    m.frustumCulled = false;
    G.scene.add(m);
    G.mists.push(m); G.mistMats.push(mat);
  }
}


// ---------- Wolkenmeer: von hohen Gipfeln sieht man auf ein Meer aus Wolken ----------
const SEA_Y = 54;
function initCloudSea() {
  G.seaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uAmt: { value: 0 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uFogColor: U.uFogColor, uCam: U.uCam, uSunDirW: U.uSunDirW },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uTime, uAmt; uniform vec3 uLit, uShade, uFogColor, uCam, uSunDirW; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fb(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += n(p) * a; p *= 2.1; a *= 0.5; } return v; }
      void main(){
        vec2 p = vW.xz * 0.004 + vec2(uTime * 0.004, uTime * 0.002);
        float c = fb(p);
        float a = smoothstep(0.32, 0.62, c) * uAmt;
        float d = distance(vW.xz, uCam.xz);
        a *= smoothstep(4200.0, 2400.0, d);
        if (a < 0.02) discard;
        float lit = smoothstep(0.35, 0.8, c) * (0.6 + 0.4 * max(uSunDirW.y, 0.0));
        vec3 col = mix(uShade, uLit, lit);
        col = mix(col, uFogColor, smoothstep(600.0, 3600.0, d) * 0.85);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  G.sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), G.seaMat);
  G.sea.rotation.x = -Math.PI / 2;
  G.sea.position.y = SEA_Y;
  G.sea.renderOrder = 3;
  G.sea.frustumCulled = false;
  G.sea.visible = false;
  G.scene.add(G.sea);
}

// ---------- Knorrige, tote Bäume ----------
function twig(mg, x, y, z, a, tilt, len, rad, depth, r, col, ps, cols, leaves) {
  mg.add('taper', branchM(x, y, z, rad, len, a, tilt), col, 0.12, r);
  const st = Math.sin(tilt);
  const ex = x + Math.cos(a) * st * len, ey = y + Math.cos(tilt) * len, ez = z + Math.sin(a) * st * len;
  if (depth <= 0) {
    if (leaves) for (let k = 0; k < 7; k++) ps.add(ex + (r() - 0.5) * 1.2, ey + (r() - 0.5) * 0.6, ez + (r() - 0.5) * 1.2, cols[k % 3], 0.8 + r() * 0.3);
    return;
  }
  const n = depth >= 3 ? 2 + (r() < 0.5 ? 1 : 0) : 2 + (r() < 0.3 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const na = a + (r() - 0.5) * 2.6, nt = clamp(tilt + 0.2 + (r() - 0.4) * 1.0, 0.12, 1.8);
    twig(mg, ex, ey, ez, na, nt, len * (0.58 + r() * 0.28), rad * 0.6, depth - 1, r, col, ps, cols, leaves);
  }
}
function branchM(x, y, z, rad, len, a, tilt) { return M(x, y, z, rad, len, rad, 0, Math.PI - a, tilt); }

// ---------- Fundstücke am Wegesrand ----------
function buildDecor(kind, x, y, z, r, mg, gps, chunk) {
  const stone = [0.42, 0.42, 0.45], ry = r() * 6.283;
  switch (kind) {
    case 'schwert': {
      const tx = (r() - 0.5) * 0.3, tz = (r() - 0.5) * 0.3;
      mg.add('box', M(x, y + 0.7, z, 0.26, 2.8, 0.06, tx, ry, tz), [0.55, 0.57, 0.62]);
      _e.set(tx, ry, tz, 'YXZ'); _v.set(0, 2.15, 0).applyEuler(_e);
      mg.add('box', M(x + _v.x, y + _v.y, z + _v.z, 1.0, 0.13, 0.16, tx, ry, tz), [0.45, 0.38, 0.25]);
      _v.set(0, 2.55, 0).applyEuler(_e);
      mg.add('cyl6', M(x + _v.x, y + _v.y - 0.3, z + _v.z, 0.06, 0.6, 0.06, tx, ry, tz), [0.25, 0.18, 0.14]);
      mg.add('box', M(x + _v.x * 0.9 + 0.12, y + _v.y * 0.75, z + _v.z * 0.9, 0.04, 0.9, 0.34, 0, ry, 0.15), [0.42, 0.16, 0.18]);
      mg.add('ico', M(x + 0.9, y + 0.15, z - 0.4, 0.28, 0.24, 0.3, 0.4, r(), 0.2), [0.48, 0.5, 0.55]);
      for (let k = 0; k < 4; k++) mg.add('ico', M(x + (r() - 0.5) * 2, y + 0.05, z + (r() - 0.5) * 2, 0.2, 0.15, 0.2, r(), r(), r()), stone, 0.2, r);
      break;
    }
    case 'statue': {
      mg.add('box', M(x, y + 0.3, z, 1.7, 0.9, 1.7, 0, ry, 0), stone, 0.1, r);
      const c = Math.cos(ry), sn = Math.sin(ry);
      for (const o of [-0.3, 0.3]) mg.add('box', M(x + o * c, y + 1.4, z - o * sn, 0.42, 1.5, 0.5, 0, ry, 0), stone, 0.12, r);
      const lx = x + c * 2.4, lz = z - sn * 2.4;
      mg.add('box', M(lx, y + 0.35, lz, 1.2, 0.7, 1.6, 0, ry + 0.4, 0.1), stone, 0.12, r);
      mg.add('ico', M(lx + 1.3, y + 0.3, lz + 0.8, 0.42, 0.45, 0.42, 0.5, r(), 0), stone, 0.12, r);
      mg.add('box', M(lx - 0.5, y + 0.12, lz + 1.4, 0.3, 0.3, 1.1, 0, r(), 0), stone, 0.12, r);
      break;
    }
    case 'schrein': {
      mg.add('box', M(x, y + 0.25, z, 1.3, 0.6, 0.9, 0, ry, 0), stone, 0.1, r);
      const c = Math.cos(ry), sn = Math.sin(ry);
      const bx = x - sn * 0.3, bz = z - c * 0.3;
      mg.add('box', M(bx, y + 1.2, bz, 1.3, 1.6, 0.25, 0, ry, 0), stone.map(v => v * 0.9), 0.1, r);
      mg.add('cone4', M(bx, y + 2.0, bz, 1.0, 0.7, 0.55, 0, ry + Math.PI / 4, 0), [0.3, 0.26, 0.28]);
      mg.add('ico', M(bx + sn * 0.2, y + 1.15, bz + c * 0.2, 0.22, 0.32, 0.18), [0.7, 0.68, 0.62]);
      for (const o of [-0.4, 0, 0.4]) {
        const cx = x + o * c + sn * 0.2, cz = z - o * sn + c * 0.2;
        mg.add('cyl6', M(cx, y + 0.55, cz, 0.05, 0.18 + r() * 0.12, 0.05), [0.9, 0.86, 0.75]);
        gps.add(cx, y + 0.82, cz, [1, 0.7, 0.3]);
      }
      chunk.shrines.push({ x, z, y, key: Math.round(x) + ':' + Math.round(z) });
      break;
    }
    case 'graeber': {
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const gx = x + (k % 3) * 1.6 + (r() - 0.5) * 0.4, gz = z + Math.floor(k / 3) * 2.2;
        const gy = y + 0.4, tx = (r() - 0.5) * 0.35, tz = (r() - 0.5) * 0.25;
        if (r() < 0.4) {
          mg.add('box', M(gx, gy + 0.2, gz, 0.14, 1.3, 0.14, tx, ry, tz), [0.3, 0.27, 0.27]);
          mg.add('box', M(gx, gy + 0.55, gz, 0.6, 0.12, 0.14, tx, ry, tz), [0.3, 0.27, 0.27]);
        } else mg.add('box', M(gx, gy, gz, 0.6, 1.0, 0.15, tx, ry, tz), stone, 0.15, r);
        mg.add('box', M(gx, y + 0.05, gz + 0.8, 0.7, 0.12, 1.3, 0, ry, 0), [0.3, 0.28, 0.26]);
      }
      if (r() < 0.5) gps.add(x + 0.3, y + 0.35, z + 0.6, [1, 0.6, 0.25]);
      break;
    }
  }
}
