'use strict';
// Wanderlicht – Grafik: Pixel-Renderer, Himmel, Wetter, Blitze, Wasser, Gelände mit Gras und Bäumen

const G = {
  renderer: null, scene: null, camera: null, rt: null, postScene: null, postCam: null, postMat: null,
  hemi: null, sun: null, lantern: null,
  pixel: 3, view: 2, w: 1, h: 1,
  chunks: new Map(), grass: new Map(),
  flash: 0, hurt: 0, fade: 0,
};

// Gemeinsame Uniforms aller eigenen Shader
const U = {
  uTime: { value: 0 }, uWind: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.9, 0.4) },
  uLight: { value: new THREE.Color(1, 1, 1) }, uSunCol: { value: new THREE.Color(0, 0, 0) },
  uFogColor: { value: new THREE.Color() }, uFogNear: { value: 30 }, uFogFar: { value: 220 },
  uScale: { value: 150 }, uCam: { value: new THREE.Vector3() },
  uLanternPos: { value: new THREE.Vector3() }, uLanternCol: { value: new THREE.Color(0, 0, 0) },
  uGrassFar: { value: 70 }, uNeon: { value: 0 },
};

const VIEW_SETTINGS = [
  { name: 'Nah', chunks: 3, far: 150, grass: 45, grassMax: 2300 },
  { name: 'Mittel', chunks: 4, far: 195, grass: 62, grassMax: 3300 },
  { name: 'Weit', chunks: 5, far: 245, grass: 80, grassMax: 4300 },
];

// ---------- Hilfen für zusammengefügte Geometrie ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _n3 = new THREE.Matrix3(), _vn = new THREE.Vector3();
function M(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}
function flatGeo(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return { p: n.attributes.position.array, n: n.attributes.normal.array }; }
const BASE = {
  box: flatGeo(new THREE.BoxGeometry(1, 1, 1)),
  cyl: flatGeo(new THREE.CylinderGeometry(1, 1, 1, 8)),
  cyl6: flatGeo(new THREE.CylinderGeometry(1, 1, 1, 6)),
  taper: flatGeo(new THREE.CylinderGeometry(0.55, 1, 1, 6)),
  cone: flatGeo(new THREE.ConeGeometry(1, 1, 8)),
  cone4: flatGeo(new THREE.ConeGeometry(1, 1, 4)),
  cone6: flatGeo(new THREE.ConeGeometry(1, 1, 6)),
  ico: flatGeo(new THREE.IcosahedronGeometry(1, 0)),
  ico1: flatGeo(new THREE.IcosahedronGeometry(1, 1)),
  oct: flatGeo(new THREE.OctahedronGeometry(1, 0)),
  torus: flatGeo(new THREE.TorusGeometry(1, 0.12, 5, 24)),
  dodec: flatGeo(new THREE.DodecahedronGeometry(1, 0)),
};
// Kegel und Zylinder stehen auf dem Boden (y 0..1) statt mittig
for (const k of ['cyl', 'cyl6', 'taper', 'cone', 'cone4', 'cone6']) {
  const p = BASE[k].p; for (let i = 1; i < p.length; i += 3) p[i] += 0.5;
}

class Merger {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(kind, m, col, jit = 0, rnd = Math.random) {
    const B = BASE[kind], p = B.p, n = B.n;
    _n3.getNormalMatrix(m);
    const e = m.elements;
    for (let i = 0; i < p.length; i += 9) {
      const f = 1 + (rnd() - 0.5) * jit;
      for (let k = 0; k < 9; k += 3) {
        const x = p[i + k], y = p[i + k + 1], z = p[i + k + 2];
        this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        _vn.set(n[i + k], n[i + k + 1], n[i + k + 2]).applyMatrix3(_n3).normalize();
        this.n.push(_vn.x, _vn.y, _vn.z);
        this.c.push(col[0] * f, col[1] * f, col[2] * f);
      }
    }
  }
  get empty() { return this.p.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Punktwolken (Laub, Wolken aus Pixeln, Leuchtpunkte)
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
// Punkte in einem Ellipsoid, eher an der Oberfläche
function blob(ps, cx, cy, cz, rx, ry, rz, cols, rnd, dens = 11, flatBottom = 0.35) {
  const n = Math.floor(dens * (rx * rz + rx * ry + ry * rz));
  for (let i = 0; i < n; i++) {
    let x, y, z, l;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
    const s = (0.62 + 0.38 * Math.cbrt(rnd())) / Math.sqrt(l);
    x *= s; y *= s; z *= s;
    if (y < -flatBottom) y = -flatBottom - (y + flatBottom) * 0.25;
    const top = y * 0.5 + 0.5;
    let c = cols[0];
    if (top < 0.42 && rnd() < 0.7) c = cols[1];
    else if (top > 0.62 && rnd() < 0.45) c = cols[2];
    ps.add(cx + x * rx, cy + y * ry, cz + z * rz, c, 0.82 + rnd() * 0.3);
  }
}

// ---------- Shader ----------
const FOG_V = 'uniform float uFogNear; uniform float uFogFar; varying float vFog;';
const FOG_F = 'uniform vec3 uFogColor; varying float vFog;';

function pointsMat(size, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uSize: { value: size }, uEmit: { value: opts.emit || 0 }, uSway: { value: opts.sway == null ? 1 : opts.sway }, uAlpha: { value: 1 } }),
    vertexShader: `
      ${FOG_V}
      uniform float uTime, uWind, uScale, uSize, uEmit, uSway;
      uniform vec2 uWindDir; uniform vec3 uLight, uLanternPos, uLanternCol;
      attribute vec3 color; attribute float aRnd;
      varying vec3 vCol;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float sw = sin(uTime * 1.4 + wp.x * 0.35 + wp.z * 0.3 + aRnd * 3.0) * 0.09 * uWind * uSway;
        wp.xz += uWindDir * sw;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * (0.75 + 0.5 * aRnd) * uScale / -mv.z, 1.0, 30.0) * smoothstep(1.2, 5.0, -mv.z);
        float ld = distance(wp.xyz, uLanternPos);
        vec3 li = uLight + uLanternCol * pow(max(0.0, 1.0 - ld / 13.0), 2.0);
        vCol = color * mix(li, vec3(1.0), uEmit);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
      }`,
    fragmentShader: `
      ${FOG_F}
      uniform float uAlpha;
      varying vec3 vCol;
      void main(){ gl_FragColor = vec4(mix(vCol, uFogColor, vFog), uAlpha); }`,
    transparent: !!opts.additive || !!opts.transparent,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive,
  });
}

const MAT = {};
function initMaterials() {
  MAT.flat = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.leaves = pointsMat(0.62);
  MAT.leavesBig = pointsMat(0.9);
  MAT.glow = pointsMat(0.5, { emit: 1, additive: true });
  MAT.glowBig = pointsMat(1.3, { emit: 1, additive: true, sway: 0.3 });
  MAT.cloudPts = pointsMat(1.0, { emit: 0.25, sway: 0 });
  MAT.neonLeaves = pointsMat(0.62, { emit: 0 });
  MAT.neonGlow = pointsMat(0.32, { emit: 1, additive: true, sway: 0.4 });
  MAT.grass = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      ${FOG_V}
      uniform float uTime, uWind, uGrassFar, uNeon;
      uniform vec2 uWindDir; uniform vec3 uLight, uSunCol, uLanternPos, uLanternCol, uCam;
      attribute vec3 iPos; attribute vec4 iPar; attribute vec3 iTip; attribute vec3 iStem; attribute float iGlow;
      varying vec3 vCol;
      void main(){
        float t = position.y;
        float d = distance(iPos.xz, uCam.xz);
        float fade = 1.0 - smoothstep(uGrassFar * 0.6, uGrassFar, d);
        float hgt = iPar.x * fade;
        vec3 toCam = uCam - iPos;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(0.0001, 0.0, 0.0));
        float ph = uTime * 1.9 + iPos.x * 0.23 + iPos.z * 0.19 + iPar.z;
        float gust = sin(uTime * 0.8 - (iPos.x * uWindDir.x + iPos.z * uWindDir.y) * 0.05);
        float sway = (sin(ph) * 0.2 + gust * 0.32 + 0.12) * uWind * t * t * hgt * 0.45;
        vec3 p = iPos + right * position.x * iPar.y * (0.6 + hgt * 0.45) + vec3(0.0, t * hgt, 0.0);
        p.xz += uWindDir * sway;
        p.y -= abs(sway) * 0.35 * t;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec3 base = mix(iStem, iTip, smoothstep(0.44, 0.6, t)) * (0.85 + 0.25 * smoothstep(0.5, 1.0, t));
        float ld = distance(p, uLanternPos);
        vec3 li = uLight * (0.6 + 0.4 * t) + uSunCol * 0.35 * t * iPar.w + uLanternCol * pow(max(0.0, 1.0 - ld / 12.0), 2.0) * 1.2;
        vCol = base * li;
        float gl = iGlow * uNeon * smoothstep(0.5, 0.8, t) * (0.75 + 0.25 * sin(uTime * 2.0 + iPar.z * 3.0));
        vCol = mix(vCol, iTip * 1.25, gl);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z) * (1.0 - gl * 0.6);
      }`,
    fragmentShader: `
      ${FOG_F}
      varying vec3 vCol;
      void main(){ gl_FragColor = vec4(mix(vCol, uFogColor, vFog), 1.0); }`,
    side: THREE.DoubleSide,
  });
}

// Gras-Halm mit Rispe (Kamera-zugewandte Fläche)
function makeGrassBlade() {
  const rows = [[0, 0.022], [0.42, 0.018], [0.52, 0.055], [0.72, 0.075], [0.88, 0.05], [1.0, 0.0]];
  const pos = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const [y0, w0] = rows[i], [y1, w1] = rows[i + 1];
    pos.push(-w0, y0, 0, w0, y0, 0, w1, y1, 0, -w0, y0, 0, w1, y1, 0, -w1, y1, 0);
  }
  return new Float32Array(pos);
}
const GRASS_BLADE = makeGrassBlade();

// ---------- Renderer und Nachbearbeitung ----------
function initGraphics(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  r.setPixelRatio(1);
  r.autoClear = true;
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0x202040, 30, 220);
  G.camera = new THREE.PerspectiveCamera(58, 1, 0.3, 1500);
  G.hemi = new THREE.HemisphereLight(0x8080c0, 0x202020, 0.6);
  G.sun = new THREE.DirectionalLight(0xffffff, 0.6);
  G.lantern = new THREE.PointLight(0xffb070, 0, 13, 2);
  G.scene.add(G.hemi, G.sun, G.sun.target, G.lantern);

  G.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  G.postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: G.rt.texture }, uSat: { value: 0.38 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uFade: { value: 0 }, uLevels: { value: 15 }, uFadeCol: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uFlash, uHurt, uFade, uLevels, uSat; uniform vec3 uFadeCol;
      varying vec2 vUv;
      float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
        float keep = smoothstep(0.32, 0.72, sat) * smoothstep(0.28, 0.72, mx);
        vec3 gr = vec3(dot(c, vec3(0.3, 0.55, 0.15))) * vec3(0.9, 0.96, 1.1);
        c = mix(gr, c, mix(uSat, 1.0, keep));
        c = pow(max(c, 0.0), vec3(1.08));
        c += vec3(0.01, 0.015, 0.035) * (1.0 - c);
        c += uFlash * vec3(0.32, 0.3, 0.42);
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.75;
        c = mix(c, vec3(dot(c, vec3(0.5, 0.3, 0.2))) * vec3(1.4, 0.45, 0.5), uHurt);
        float d = bayer(gl_FragCoord.xy) - 0.5;
        c = floor(c * uLevels + 0.5 + d * 0.9) / uLevels;
        c = mix(c, uFadeCol, uFade);
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  G.postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), G.postMat);
  quad.frustumCulled = false;
  G.postScene.add(quad);
  G.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  initMaterials();
  initSky();
  initClouds();
  initWater();
  initWeatherFX();
  initBurst();
  initMist();
  initBackdrop();
  G.bolts = new THREE.Group();
  G.scene.add(G.bolts);
  resizeGraphics();
}

function resizeGraphics() {
  const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
  // Pixelgrösse an Bildschirmhöhe anpassen, damit es überall ähnlich aussieht
  const px = Math.max(1, G.pixel * Math.min(2, window.devicePixelRatio || 1) / (window.devicePixelRatio || 1) * Math.max(0.75, H / 800));
  G.w = Math.max(160, Math.round(W / px)); G.h = Math.max(100, Math.round(H / px));
  G.renderer.setSize(G.w, G.h, false);
  G.rt.setSize(G.w, G.h);
  G.camera.aspect = G.w / G.h;
  G.camera.updateProjectionMatrix();
  U.uScale.value = G.h * 0.5 / Math.tan(G.camera.fov * Math.PI / 360) * 0.5;
}

function renderFrame() {
  G.postMat.uniforms.uFlash.value = G.flash;
  G.postMat.uniforms.uHurt.value = G.hurt;
  G.postMat.uniforms.uFade.value = G.fade;
  G.renderer.setRenderTarget(G.rt);
  G.renderer.render(G.scene, G.camera);
  G.renderer.setRenderTarget(null);
  G.renderer.render(G.postScene, G.postCam);
}

// ---------- Himmel ----------
function initSky() {
  G.skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 1 }, uTime: U.uTime, uFlash: { value: 0 }, uSunVis: { value: 1 }, uMoonVis: { value: 1 }, uCloudy: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uMoonDir;
      uniform float uStars, uTime, uFlash, uSunVis, uMoonVis, uCloudy;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
        col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 60.0) * 0.45) * uSunVis;
        col = mix(col, uSunCol * 1.5 + 0.25, smoothstep(0.9986, 0.999, sd) * uSunVis * (1.0 - uCloudy * 0.85));
        float md = dot(d, uMoonDir);
        float moon = smoothstep(0.9905, 0.9915, md);
        float md2 = dot(d, normalize(uMoonDir + vec3(0.075, 0.035, 0.0)));
        moon *= 1.0 - smoothstep(0.9905, 0.9915, md2) * 0.92;
        float spots = 0.82 + 0.18 * hash(floor(d * 160.0));
        float mv = uMoonVis * (1.0 - uCloudy * 0.6);
        col = mix(col, vec3(0.93, 0.9, 0.84) * spots, moon * mv);
        col += vec3(0.42, 0.38, 0.6) * (pow(max(md, 0.0), 14.0) * 0.22 + pow(max(md, 0.0), 120.0) * 0.25) * mv;
        vec3 q = floor(d * 240.0);
        float s = hash(q);
        float tw = 0.55 + 0.45 * sin(uTime * 2.3 + s * 90.0);
        float sv = uStars * smoothstep(0.03, 0.3, h) * (1.0 - uCloudy);
        col += vec3(0.92, 0.88, 1.0) * step(0.9972, s) * tw * sv;
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.45, 0.82))), 2.0) * 26.0) * smoothstep(0.0, 0.35, h);
        col += vec3(0.26, 0.17, 0.36) * band * sv * 0.4 * (0.55 + 0.45 * hash(floor(d * 80.0)));
        col += uFlash * vec3(0.42, 0.38, 0.6) * (0.35 + 0.65 * smoothstep(-0.1, 0.5, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), G.skyMat);
  G.sky.renderOrder = -10;
  G.sky.frustumCulled = false;
  G.scene.add(G.sky);
}

// ---------- Wolken aus Pixeln ----------
const CLOUD_FIELD = 1200;
function initClouds() {
  const pos = [], cen = [], inf = [], rnd = [];
  const r = mulberry32(4242);
  const NC = 46;
  for (let c = 0; c < NC; c++) {
    const cx = r() * CLOUD_FIELD, cz = r() * CLOUD_FIELD, cy = 115 + r() * 70;
    const thr = r() * 0.92;
    const len = 30 + r() * 60, lumps = 3 + Math.floor(r() * 5);
    const parts = [];
    for (let l = 0; l < lumps; l++) {
      const t = l / Math.max(1, lumps - 1) - 0.5;
      const rad = (8 + r() * 10) * (1 - Math.abs(t) * 0.9);
      parts.push([t * len + (r() - 0.5) * 8, rad * 0.25, (r() - 0.5) * 16, rad * 1.3, rad * 0.7, rad]);
    }
    for (const [px, py, pz, rx, ry, rz] of parts) {
      const n = Math.floor(rx * rz * 0.55);
      for (let i = 0; i < n; i++) {
        let x, y, z, l;
        do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1);
        if (y < -0.3) y = -0.3;
        const yy = py + y * ry;
        pos.push(px + x * rx, yy, pz + z * rz);
        cen.push(cx, cy, cz);
        inf.push(thr, clamp01((y + 0.3) / 1.3));
        rnd.push(r());
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(inf, 2));
  g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
  G.cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      uCam: U.uCam, uScale: U.uScale, uTime: U.uTime, uDrift: { value: new THREE.Vector2() }, uCover: { value: 0.3 },
      uLit: { value: new THREE.Color(1, 1, 1) }, uDark: { value: new THREE.Color(0.5, 0.5, 0.6) }, uHorizon: { value: new THREE.Color() },
      uFlash: { value: 0 }, uField: { value: CLOUD_FIELD },
    },
    vertexShader: `
      uniform vec3 uCam, uLit, uDark, uHorizon; uniform vec2 uDrift; uniform float uCover, uScale, uField, uFlash, uTime;
      attribute vec3 aCenter; attribute vec2 aInfo; attribute float aRnd;
      varying vec3 vCol;
      void main(){
        vec3 c = aCenter;
        c.xz = mod(c.xz + uDrift - uCam.xz + uField * 0.5, uField) - uField * 0.5 + uCam.xz;
        float dist = length(c.xz - uCam.xz);
        float vis = smoothstep(aInfo.x, aInfo.x + 0.12, uCover) * (1.0 - smoothstep(uField * 0.36, uField * 0.48, dist));
        vec3 p = c + position;
        p.y += sin(uTime * 0.3 + aRnd * 6.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(15.0 * (0.7 + 0.6 * aRnd) * uScale / -mv.z, 60.0) * vis;
        vec3 col = mix(uDark, uLit, aInfo.y * (0.8 + 0.3 * aRnd));
        col += uFlash * vec3(0.55, 0.5, 0.8) * (0.4 + aRnd);
        vCol = mix(col, uHorizon, smoothstep(uField * 0.12, uField * 0.46, dist) * 0.8);
      }`,
    fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }',
    fog: false,
  });
  G.clouds = new THREE.Points(g, G.cloudMat);
  G.clouds.frustumCulled = false;
  G.clouds.renderOrder = -5;
  G.scene.add(G.clouds);
}

// ---------- Wasser ----------
function initWater() {
  G.waterMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uDeep: { value: new THREE.Color(0.08, 0.1, 0.2) }, uSky: { value: new THREE.Color() }, uGlintDir: { value: new THREE.Vector3(0, 1, 0) }, uGlintCol: { value: new THREE.Color() } }),
    vertexShader: `
      ${FOG_V}
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; vFog = smoothstep(uFogNear, uFogFar, -mv.z); }`,
    fragmentShader: `
      ${FOG_F}
      uniform vec3 uDeep, uSky, uGlintDir, uGlintCol, uLanternPos, uLanternCol; uniform float uTime;
      varying vec3 vW;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(v.y, 0.0), 2.5);
        vec3 col = mix(uDeep, uSky, 0.3 + 0.6 * fres);
        vec2 g = floor(vW.xz * 1.2);
        float n = hash(vec3(g, floor(uTime * 2.5 + hash(vec3(g, 3.0)) * 9.0)));
        vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
        float spec = pow(max(dot(r, uGlintDir), 0.0), 14.0);
        col += uGlintCol * step(0.965 - spec * 0.25, n) * (0.15 + spec * 1.3);
        col *= 0.95 + 0.05 * sin(vW.x * 0.45 + vW.z * 0.31 + uTime * 0.8);
        float ld = distance(vW, uLanternPos);
        col += uLanternCol * pow(max(0.0, 1.0 - ld / 12.0), 2.0) * 0.5;
        gl_FragColor = vec4(mix(col, uFogColor, vFog), 0.84);
      }`,
    transparent: true, depthWrite: false,
  });
  G.water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), G.waterMat);
  G.water.rotation.x = -Math.PI / 2;
  G.water.position.y = WATER;
  G.water.renderOrder = 2;
  G.water.frustumCulled = false;
  G.scene.add(G.water);
}

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
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
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

function skyAt(t) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const k = (t - a[0]) / (b[0] - a[0]);
  ATM.zen.copy(a[1]).lerp(b[1], k); ATM.hor.copy(a[2]).lerp(b[2], k); ATM.sunC.copy(a[3]).lerp(b[3], k);
  ATM.hSky.copy(a[4]).lerp(b[4], k); ATM.hGround.copy(a[5]).lerp(b[5], k); ATM.lightC.copy(a[6]).lerp(b[6], k);
  ATM.lightI = lerp(a[7], b[7], k); ATM.hemiI = lerp(a[8], b[8], k);
}

// Wetter, Tageszeit und Biom an der Kamera auf Himmel, Licht und Teilchen anwenden
function updateAtmosphere(dt, dayT, target, bw, cam, yaw, player, lanternOn, onThunder) {
  const c = ATM.cur, k = Math.min(1, dt * 0.025);
  for (const key of ['cloud', 'rain', 'fog', 'storm', 'wind']) c[key] += (target[key] - c[key]) * k;
  skyAt(dayT);

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
  const gloom = c.cloud * 0.45 + c.storm * 0.35 + c.rain * 0.2;
  for (const col of [ATM.zen, ATM.hor]) {
    const l = col.r * 0.3 + col.g * 0.5 + col.b * 0.2;
    _gray.setRGB(l * 0.85, l * 0.82, l * 1.05);
    col.lerp(_gray, clamp01(gloom * 0.9)).multiplyScalar(1 - c.storm * 0.35 - c.rain * 0.15);
  }
  // Nebel macht den Horizont milchig
  const fogL = ATM.hor.r * 0.3 + ATM.hor.g * 0.5 + ATM.hor.b * 0.2;
  _gray.setRGB(fogL * 1.1 + 0.04, fogL * 1.08 + 0.04, fogL * 1.15 + 0.06);
  ATM.hor.lerp(_gray, c.fog * 0.55);
  ATM.zen.lerp(ATM.hor, c.fog * 0.5);
  // giftig leuchtender oder kalter Biom-Nebel
  if (ATM.tintW > 0.01) { _gray.copy(ATM.fogTint).multiplyScalar(1.05 - ATM.night * 0.2); ATM.hor.lerp(_gray, clamp01(ATM.tintW * 1.7)); }

  const ang = (dayT - 0.25) * Math.PI * 2;
  ATM.sunDir.set(Math.cos(ang) * 0.85, Math.sin(ang), 0.42).normalize();
  ATM.moonDir.set(-Math.cos(ang) * 0.75, 0.09 + 0.3 * Math.max(-Math.sin(ang), 0), -0.62).normalize();
  const sunUp = smooth(-0.08, 0.05, ATM.sunDir.y);
  ATM.night = 1 - smooth(-0.1, 0.12, ATM.sunDir.y);

  const sm = G.skyMat.uniforms;
  sm.uZenith.value.copy(ATM.zen); sm.uHorizon.value.copy(ATM.hor);
  sm.uSunDir.value.copy(ATM.sunDir); sm.uMoonDir.value.copy(ATM.moonDir);
  sm.uSunCol.value.copy(ATM.sunC); sm.uSunVis.value = sunUp;
  sm.uMoonVis.value = 1 - smooth(0.02, 0.3, ATM.sunDir.y); sm.uStars.value = ATM.night * (1 - c.fog * 0.8);
  sm.uCloudy.value = clamp01(c.cloud * 0.7 + c.fog * 0.3 + c.storm * 0.2);
  sm.uFlash.value = G.flash;

  // Licht
  const dim = 1 - gloom * 0.4;
  G.hemi.color.copy(ATM.hSky); G.hemi.groundColor.copy(ATM.hGround);
  G.hemi.intensity = ATM.hemiI * (1 - c.storm * 0.15) + G.flash * 0.9;
  G.sun.color.copy(ATM.lightC);
  G.sun.intensity = ATM.lightI * dim * (1 - c.cloud * 0.35);
  const ld = ATM.sunDir.y > -0.02 ? ATM.sunDir : ATM.moonDir;
  G.sun.position.copy(cam).addScaledVector(ld, 100);
  G.sun.target.position.copy(cam);
  U.uLight.value.copy(ATM.hSky).multiplyScalar(G.hemi.intensity * 0.85).add(_c2.copy(ATM.lightC).multiplyScalar(G.sun.intensity * 0.55));
  U.uSunCol.value.copy(ATM.sunC).multiplyScalar(sunUp * (1 - c.cloud * 0.6));

  // Laterne
  const lan = lanternOn ? clamp01(ATM.night * 1.2 + c.storm * 0.3 + c.fog * 0.3) : 0;
  G.lantern.intensity = lan * 1.6;
  G.lantern.position.set(player.x, player.y + 1.6, player.z);
  U.uLanternPos.value.copy(G.lantern.position);
  U.uLanternCol.value.setRGB(1.0, 0.68, 0.38).multiplyScalar(lan * 0.9);

  // Nebel
  const vs = VIEW_SETTINGS[G.view];
  const fogE = clamp01(c.fog + ATM.biomeFog * 0.85);
  const far = vs.far * (1 - fogE * 0.66) * (1 - c.rain * 0.15) * (1 - ATM.night * 0.18);
  G.scene.fog.near = 6 + 28 * (1 - fogE);
  G.scene.fog.far = far;
  G.scene.fog.color.copy(ATM.hor).lerp(ATM.zen, 0.15);
  // Bodennebel und ferne Kulissen
  const mm = G.mistMats;
  G.mistBase += (player.y - 0.7 - G.mistBase) * Math.min(1, dt * 0.25);
  const mist = clamp01(0.06 + c.fog * 0.6 + ATM.biomeFog * 0.8 + ATM.night * 0.25);
  for (let i = 0; i < G.mists.length; i++) {
    const m = G.mists[i];
    m.position.set(Math.round(cam.x / 4) * 4, G.mistBase + 0.5 + i * 1.25, Math.round(cam.z / 4) * 4);
    mm[i].uniforms.uMist.value = mist * (1 - i * 0.22);
    mm[i].uniforms.uMistCol.value.copy(G.scene.fog.color).lerp(_c2.setRGB(0.8, 0.8, 0.85), 0.12);
  }
  updateBackdrop(cam);
  ATM.desat += (desat - ATM.desat) * Math.min(1, dt * 0.5);
  G.postMat.uniforms.uSat.value = clamp(1 - ATM.desat * 0.85 - ATM.night * 0.3 - c.storm * 0.25 - fogE * 0.12, 0.25, 1);
  MAT.neonLeaves.uniforms.uEmit.value = ATM.night * 0.9;
  MAT.neonGlow.uniforms.uAlpha.value = 0.2 + ATM.night * 0.8;
  U.uNeon.value = 0.12 + ATM.night * 0.88;
  U.uFogColor.value.copy(G.scene.fog.color); U.uFogNear.value = G.scene.fog.near; U.uFogFar.value = far;
  U.uWind.value = c.wind; U.uGrassFar.value = vs.grass;

  // Wolken
  ATM.drift.x += U.uWindDir.value.x * dt * (2 + c.wind * 4); ATM.drift.y += U.uWindDir.value.y * dt * (2 + c.wind * 4);
  const cm = G.cloudMat.uniforms;
  cm.uDrift.value.copy(ATM.drift); cm.uCover.value = clamp01(c.cloud * 1.05 + c.storm * 0.1);
  _c1.copy(ATM.hor).lerp(ATM.sunC, 0.35 * sunUp).lerp(ATM.zen, 0.2);
  cm.uLit.value.copy(_c1).multiplyScalar(1.15 - c.storm * 0.4);
  cm.uDark.value.copy(ATM.zen).lerp(ATM.hor, 0.35).multiplyScalar(0.9 - c.storm * 0.35);
  cm.uHorizon.value.copy(ATM.hor);
  cm.uFlash.value = G.flash;

  // Wasser
  const wm = G.waterMat.uniforms;
  wm.uSky.value.copy(ATM.hor).lerp(ATM.zen, 0.35);
  wm.uDeep.value.copy(ATM.zen).multiplyScalar(0.45).lerp(_c1.setRGB(0.05, 0.12, 0.16), 0.4);
  wm.uGlintDir.value.copy(ld);
  wm.uGlintCol.value.copy(ATM.sunDir.y > -0.02 ? ATM.sunC : _c1.setRGB(0.85, 0.85, 1)).multiplyScalar(1 - c.cloud * 0.6);
  G.water.position.x = Math.round(cam.x / 10) * 10; G.water.position.z = Math.round(cam.z / 10) * 10;

  // Teilchen
  const A = ATM.fxAmt;
  A.rain = c.rain * (1 - cold);
  A.snow = c.rain * cold + cold * 0.12 * c.cloud;
  A.petals = clamp01(pet * 0.75 * (1 - c.rain) * (0.4 + c.wind * 0.6));
  A.flies = clamp01(fl * (ATM.night * 1.1 + c.fog * 0.3) * (1 - c.rain) * (1 - c.storm * 0.4));
  G.flies.material.uniforms.uColor.value.copy(ATM.flyC);
  A.dust = clamp01(du * (1 - ATM.night) * 0.8);
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
  G.petals.material.uniforms.uColor.value.copy(ATM.petalC);
  setFx(G.petals, A.petals, _s.set(wd.x * (1 + ws * 3), -0.7, wd.y * (1 + ws * 3)), o);
  setFx(G.flies, A.flies, _s.set(0.2, 0.05, 0.1), _v.set(player.x, player.y + 2.2, player.z));
  setFx(G.dust, A.dust, _s.set(wd.x * ws * 2, 0.2, wd.y * ws * 2), _v.set(cam.x, cam.y, cam.z));

  // Blitze
  G.flash = Math.max(0, G.flash - dt * 3.2);
  if (c.storm > 0.15) {
    ATM.boltT -= dt * c.storm;
    if (ATM.boltT <= 0) {
      ATM.boltT = 2 + Math.random() * 6;
      const d = spawnBolt(cam, yaw);
      if (onThunder) onThunder(d);
    }
  }
  updateBolts(dt);
}

// ---------- Gelände in Stücken ----------
const _tw = new Float32Array(NB), _tc = [0, 0, 0];
const DEAD_TREE = { tree: 'tot', trunkC: [0.12, 0.11, 0.13], canopyC: [[0.2, 0.2, 0.18], [0.1, 0.1, 0.1], [0.3, 0.28, 0.2]] };
function buildChunk(ci, cj) {
  const N = CHUNK_RES, S = CHUNK / N, x0 = ci * CHUNK, z0 = cj * CHUNK;
  const V = N + 1;
  const H = new Float32Array(V * V), WW = new Float32Array(V * V * NB);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = x0 + i * S, z = z0 + j * S;
    const w = weightsAt(x, z, _tw);
    WW.set(w, (j * V + i) * NB);
    H[j * V + i] = heightAt(x, z, w);
  }
  const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
  let o = 0;
  const wavg = new Float32Array(NB);
  const tri = (ia, ib, ic) => {
    const ax = x0 + (ia % V) * S, az = z0 + Math.floor(ia / V) * S;
    const bx = x0 + (ib % V) * S, bz = z0 + Math.floor(ib / V) * S;
    const cx = x0 + (ic % V) * S, cz = z0 + Math.floor(ic / V) * S;
    const ay = H[ia], by = H[ib], cy = H[ic];
    pos.set([ax, ay, az, bx, by, bz, cx, cy, cz], o);
    // Neigung aus der Flächennormalen
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const slope = 1 - Math.abs(ny) / Math.sqrt(nx * nx + ny * ny + nz * nz);
    for (let b = 0; b < NB; b++) wavg[b] = (WW[ia * NB + b] + WW[ib * NB + b] + WW[ic * NB + b]) / 3;
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
    groundColor(mx, mz, (ay + by + cy) / 3, slope * 2.2, wavg, _tc);
    for (let k = 0; k < 3; k++) col.set(_tc, o + k * 3);
    o += 9;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    tri(a, c, b); tri(b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const ground = new THREE.Mesh(g, MAT.flat);
  const group = new THREE.Group();
  group.add(ground);

  // Bäume und Felsen
  const r = mulberry32(hash2(ci, cj, World.seed + 99));
  const mg = new Merger(), ps = new PointSet(), psN = new PointSet();
  const chunk = { ci, cj, H, WW, group };
  const tries = 18;
  for (let k = 0; k < tries; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const w = chunkWeights(chunk, x, z, _tw);
    let td = 0; for (let b = 0; b < NB; b++) td += w[b] * BIOMES[b].trees;
    const patch = World.nD.noise(x * 0.018 + 7, z * 0.018) * 0.5 + 0.5;
    if (r() > td * (0.15 + patch * patch * 1.6) * 0.5) continue;
    const h = chunkHeight(chunk, x, z);
    if (h < 0.5) continue;
    if (nearSite(x, z, 5)) continue;
    const b = sampleBiome(w, r());
    const B0 = BIOMES[b];
    const dead = r() < 0.13 && B0.cold < 0.9 && B0.tree !== 'knorrig';
    if (!dead && B0.neon > 0 && r() < B0.neon * 0.3) {
      const nc = B0.neonCC[Math.floor(r() * 3)];
      buildTree(Object.assign({}, B0, { tree: B0.tree === 'knorrig' ? 'weide' : B0.tree, canopyC: [nc, nc.map(v => v * 0.55), nc.map(v => Math.min(1, v * 0.6 + 0.45))] }), x, h, z, r, mg, psN);
    } else buildTree(dead ? DEAD_TREE : B0, x, h, z, r, mg, ps);
  }
  for (let k = 0; k < 4; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const h = chunkHeight(chunk, x, z);
    if (r() < 0.55 || nearSite(x, z, 3)) continue;
    const w = chunkWeights(chunk, x, z, _tw);
    const B = BIOMES[sampleBiome(w, r())];
    const s = 0.6 + r() * r() * 3;
    mg.add('ico', M(x, h + s * 0.2, z, s * (1 + r() * 0.6), s * (0.6 + r() * 0.5), s, r(), r() * 6, r()), B.rockC, 0.18, r);
    if (r() < 0.4) mg.add('ico', M(x + s, h, z + s * 0.4, s * 0.5, s * 0.4, s * 0.5, r(), r() * 6, r()), B.rockC, 0.2, r);
  }
  chunk.shrines = [];
  const gps = new PointSet();
  if (r() < 0.24) {
    const x = x0 + 8 + r() * (CHUNK - 16), z = z0 + 8 + r() * (CHUNK - 16), h = chunkHeight(chunk, x, z);
    if (h > 0.6 && !nearSite(x, z, 14)) buildDecor(pick(r, ['schwert', 'statue', 'schrein', 'graeber', 'schwert', 'schrein', 'statue']), x, h, z, r, mg, gps, chunk);
  }
  if (!mg.empty) group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!ps.empty) group.add(new THREE.Points(ps.build(), MAT.leaves));
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
  if (!psN.empty) group.add(new THREE.Points(psN.build(), MAT.neonLeaves));
  if (!gpsN.empty) group.add(new THREE.Points(gpsN.build(), MAT.neonGlow));
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
function groundY(x, z) {
  const ch = G.chunks.get(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
  if (ch) return chunkHeight(ch, x, z);
  return heightAt(x, z);
}

// ---------- Bäume ----------
function buildTree(B, x, y, z, r, mg, ps) {
  const s = 0.75 + r() * 0.6;
  const tc = B.trunkC, cols = B.canopyC;
  const lean = (r() - 0.5) * 0.25, rot = r() * Math.PI * 2;
  switch (B.tree) {
    case 'schirm': {
      const th = 3.2 * s;
      mg.add('taper', M(x, y - 0.3, z, 0.32 * s, th + 0.3, 0.32 * s, lean, rot, lean * 0.5), tc, 0.1, r);
      const tx = x + Math.sin(lean * 0.5) * th, tz = z;
      const nb = 3 + Math.floor(r() * 3);
      for (let i = 0; i < nb; i++) {
        const a = rot + i / nb * Math.PI * 2 + r() * 0.5, L = (2.2 + r() * 1.6) * s;
        const bx = tx + Math.cos(a) * L * 0.75, bz = tz + Math.sin(a) * L * 0.75, by = y + th + L * 0.45;
        mg.add('taper', M(tx, y + th * 0.85, tz, 0.13 * s, L, 0.13 * s, 0, Math.PI - a, 0.95), tc, 0.1, r);
        blob(ps, bx, by + 0.6 * s, bz, (2.2 + r() * 1.3) * s, (1.0 + r() * 0.6) * s, (2.2 + r() * 1.3) * s, cols, r, 10);
      }
      blob(ps, tx, y + th + 1.8 * s, tz, 2.6 * s, 1.3 * s, 2.6 * s, cols, r, 10);
      break;
    }
    case 'kirsch': {
      const th = 2.4 * s;
      mg.add('taper', M(x, y - 0.3, z, 0.28 * s, th + 0.3, 0.28 * s, lean, rot, 0), tc, 0.1, r);
      const nb = 3 + Math.floor(r() * 2);
      for (let i = 0; i < nb; i++) {
        const a = rot + i / nb * Math.PI * 2, L = (1.6 + r()) * s;
        mg.add('taper', M(x, y + th * 0.8, z, 0.1 * s, L, 0.1 * s, 0, Math.PI - a, 0.7), tc, 0.1, r);
        blob(ps, x + Math.cos(a) * L * 0.65, y + th + L * 0.7, z + Math.sin(a) * L * 0.65, (1.5 + r() * 0.7) * s, (1.2 + r() * 0.5) * s, (1.5 + r() * 0.7) * s, cols, r, 12);
      }
      blob(ps, x, y + th + 1.9 * s, z, 1.8 * s, 1.4 * s, 1.8 * s, cols, r, 12);
      break;
    }
    case 'akazie': {
      const th = 4.2 * s;
      mg.add('taper', M(x, y - 0.3, z, 0.22 * s, th * 0.6, 0.22 * s, lean, rot, 0), tc, 0.1, r);
      for (let i = 0; i < 2; i++) {
        const a = rot + i * Math.PI + 0.3;
        mg.add('taper', M(x, y + th * 0.5, z, 0.12 * s, th * 0.6, 0.12 * s, 0, Math.PI - a, 0.45), tc, 0.1, r);
      }
      blob(ps, x, y + th, z, 3.8 * s, 0.55 * s, 3.4 * s, cols, r, 9, 0.6);
      break;
    }
    case 'tanne':
    case 'schneetanne': {
      const th = (5.5 + r() * 3) * s;
      mg.add('taper', M(x, y - 0.3, z, 0.25 * s, th * 0.5, 0.25 * s, 0, rot, 0), tc, 0.1, r);
      const snow = B.tree === 'schneetanne';
      const n = Math.floor(140 * s * s * (th / 7));
      for (let i = 0; i < n; i++) {
        const t = Math.pow(r(), 0.8);
        const yy = y + 1.2 * s + t * th;
        const rad = (1 - t) * 2.3 * s * (0.75 + 0.25 * Math.sin(t * 22)) * Math.sqrt(0.35 + 0.65 * r());
        const a = r() * Math.PI * 2;
        const top = r() < 0.5;
        let c = cols[0];
        if (snow) c = top ? cols[1] : cols[r() < 0.5 ? 0 : 2];
        else c = r() < 0.25 ? cols[2] : r() < 0.5 ? cols[1] : cols[0];
        ps.add(x + Math.cos(a) * rad, yy, z + Math.sin(a) * rad, c, 0.85 + r() * 0.3);
      }
      break;
    }
    case 'weide': {
      const th = 3 * s;
      mg.add('taper', M(x, y - 0.3, z, 0.35 * s, th + 0.3, 0.35 * s, lean, rot, 0), tc, 0.1, r);
      blob(ps, x, y + th + 1, z, 2.6 * s, 1.4 * s, 2.6 * s, cols, r, 9);
      const strands = Math.floor(26 * s);
      for (let i = 0; i < strands; i++) {
        const a = r() * Math.PI * 2, rad = (1.8 + r() * 0.9) * s;
        const len = (1.5 + r() * 2.2) * s;
        for (let k = 0; k < 9; k++) ps.add(x + Math.cos(a) * rad, y + th + 0.8 - k / 9 * len, z + Math.sin(a) * rad, k > 6 ? cols[2] : cols[0], 0.85 + r() * 0.3);
      }
      break;
    }
    case 'tot':
    case 'knorrig': {
      const big = B.tree === 'knorrig' ? 1.25 : 0.9;
      twig(mg, x, y - 0.4, z, rot, 0.08 + r() * 0.25, (2.0 + r() * 1.6) * s * big, 0.36 * s * big, 3, r, tc, ps, cols, B.tree === 'knorrig' && r() < 0.45);
      break;
    }
  }
}

// ---------- Gras-Stücke ----------
function buildGrass(ch) {
  const r = mulberry32(hash2(ch.ci, ch.cj, World.seed + 5));
  const max = VIEW_SETTINGS[G.view].grassMax;
  const x0 = ch.ci * CHUNK, z0 = ch.cj * CHUNK;
  const iPos = [], iPar = [], iTip = [], iStem = [], iGlow = [];
  const w = new Float32Array(NB);
  const tries = max;
  for (let k = 0; k < tries; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    chunkWeights(ch, x, z, w);
    let dens = 0; for (let b = 0; b < NB; b++) dens += w[b] * BIOMES[b].grass;
    const patch = World.nD.noise(x * 0.03, z * 0.03) * 0.5 + 0.5;
    if (r() > dens * (0.35 + patch * 0.9)) continue;
    const h = chunkHeight(ch, x, z);
    if (h < 0.15) continue;
    if (nearCampfire(x, z)) continue;
    const B = BIOMES[sampleBiome(w, r())];
    const hh = B.grassH * (0.55 + r() * 0.6) * (0.7 + patch * 0.5);
    iPos.push(x, h - 0.05, z);
    iPar.push(hh, 0.8 + r() * 0.6, r() * 6.28, 0.5 + r() * 0.5);
    const f = 0.82 + r() * 0.3, alt = r() < 0.06 ? 1.15 : 1;
    if (r() < B.neon * 0.22) {
      const nc = B.neonCC[Math.floor(r() * 3)];
      iTip.push(nc[0], nc[1], nc[2]); iGlow.push(1);
    } else {
      iTip.push(Math.min(1, B.tipC[0] * f * alt), Math.min(1, B.tipC[1] * f * alt), Math.min(1, B.tipC[2] * f * alt)); iGlow.push(0);
    }
    const fs = 0.75 + r() * 0.35;
    iStem.push(B.stemC[0] * fs, B.stemC[1] * fs, B.stemC[2] * fs);
  }
  if (!iPos.length) return null;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(GRASS_BLADE, 3));
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(iPos), 3));
  g.setAttribute('iPar', new THREE.InstancedBufferAttribute(new Float32Array(iPar), 4));
  g.setAttribute('iTip', new THREE.InstancedBufferAttribute(new Float32Array(iTip), 3));
  g.setAttribute('iStem', new THREE.InstancedBufferAttribute(new Float32Array(iStem), 3));
  g.setAttribute('iGlow', new THREE.InstancedBufferAttribute(new Float32Array(iGlow), 1));
  g.instanceCount = iPos.length / 3;
  const m = new THREE.Mesh(g, MAT.grass);
  m.frustumCulled = false;
  m.userData.cx = x0 + CHUNK / 2; m.userData.cz = z0 + CHUNK / 2;
  G.scene.add(m);
  return m;
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
    if (di * di + dj * dj > (R + 2) * (R + 2)) { disposeObj(ch.group); if (G.grass.has(key)) { const gm = G.grass.get(key); if (gm) disposeObj(gm); G.grass.delete(key); } G.chunks.delete(key); }
  }
  // Gras
  const GR = vs.grass + CHUNK * 0.75;
  const gneed = [];
  for (const [key, ch] of G.chunks) {
    const cx = ch.ci * CHUNK + CHUNK / 2, cz = ch.cj * CHUNK + CHUNK / 2;
    const d = Math.hypot(cx - px, cz - pz);
    const has = G.grass.has(key);
    if (d < GR && !has) gneed.push([d, key, ch]);
    else if (d > GR + 30 && has) { const gm = G.grass.get(key); if (gm) disposeObj(gm); G.grass.delete(key); }
  }
  gneed.sort((a, b) => a[0] - b[0]);
  for (const [, key, ch] of gneed) {
    if (performance.now() - t0 > budgetMs) break;
    G.grass.set(key, buildGrass(ch));
  }
  return need.length === 0 && gneed.length === 0;
}

function clearChunks() {
  for (const [, ch] of G.chunks) disposeObj(ch.group);
  for (const [, gm] of G.grass) if (gm) disposeObj(gm);
  G.chunks.clear(); G.grass.clear();
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

// ---------- Ferne Kulissen (Parallax): Bergketten und riesige Burgen ----------
function initBackdrop() {
  G.backdrop = [];
  const layers = [
    { r: 520, f: 0.9, k: 0.5, hMin: 25, hMax: 95, castles: 0, seed: 11 },
    { r: 840, f: 0.975, k: 0.3, hMin: 50, hMax: 170, castles: 3, seed: 23 },
  ];
  for (const L of layers) {
    const r = mulberry32(L.seed);
    const N = 160, pos = [];
    const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
    const hAt = a => {
      let v = Math.sin(a * 3 + ph[0]) * 0.35 + Math.sin(a * 7 + ph[1]) * 0.25 + Math.sin(a * 17 + ph[2]) * 0.15 + Math.sin(a * 41 + ph[3]) * 0.08;
      v = 0.5 + v * 0.8;
      return L.hMin + (L.hMax - L.hMin) * Math.max(0, v);
    };
    const hs = [];
    for (let i = 0; i <= N; i++) hs.push(hAt(i / N * Math.PI * 2) + (r() - 0.5) * (L.hMax - L.hMin) * 0.12);
    hs[N] = hs[0];
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      const x0 = Math.cos(a0) * L.r, z0 = Math.sin(a0) * L.r, x1 = Math.cos(a1) * L.r, z1 = Math.sin(a1) * L.r;
      pos.push(x0, -120, z0, x1, -120, z1, x1, hs[i + 1], z1, x0, -120, z0, x1, hs[i + 1], z1, x0, hs[i], z0);
    }
    const mg = new Merger(), win = [];
    for (let c = 0; c < L.castles; c++) {
      const a = (c / L.castles + r() * 0.2) * Math.PI * 2, rr = L.r * 0.97;
      const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, base = hAt(a) - 20;
      const sc = 1.6 + r() * 0.9, ry = -a + Math.PI / 2;
      const ca = Math.cos(-ry), sa = Math.sin(-ry);
      const put = (lx, ly, lz) => [cx + lx * ca, base + ly, cz + lx * sa];
      // Hauptbau mit Türmen und Spitzen (gotische Silhouette)
      mg.add('box', M(...put(0, 40 * sc, 0), 46 * sc, 80 * sc, 30 * sc, 0, ry, 0), [1, 1, 1]);
      mg.add('cone4', M(...put(0, 80 * sc, 0), 30 * sc, 45 * sc, 18 * sc, 0, ry + Math.PI / 4, 0), [1, 1, 1]);
      const nt = 5 + Math.floor(r() * 4);
      for (let t = 0; t < nt; t++) {
        const lx = (t / (nt - 1) - 0.5) * 120 * sc + (r() - 0.5) * 10, th = (40 + r() * 110) * sc * (1 - Math.abs(lx) / (110 * sc) * 0.5), tw = (5 + r() * 7) * sc;
        const [px, py, pz] = put(lx, 0, (r() - 0.5) * 20);
        mg.add('cyl', M(px, py - 10, pz, tw, th + 10, tw), [1, 1, 1]);
        mg.add('cone', M(px, py + th, pz, tw * 1.25, tw * (3 + r() * 3), tw * 1.25), [1, 1, 1]);
        for (let w = 0; w < 3; w++) if (r() < 0.35) win.push(px + (r() - 0.5) * tw, py + th * (0.3 + r() * 0.6), pz);
      }
      for (let b = 0; b < 2; b++) { const [px, py, pz] = put((b ? 1 : -1) * 75 * sc, 0, 0); mg.add('box', M(px, py + 15 * sc, pz, 50 * sc, 30 * sc, 8, 0, ry, 0), [1, 1, 1]); }
      for (let w = 0; w < 6; w++) { const [px, py, pz] = put((r() - 0.5) * 40 * sc, (20 + r() * 50) * sc, 0); win.push(px, py, pz); }
    }
    const g = new THREE.BufferGeometry();
    const extra = mg.empty ? [] : mg.p;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos.concat(extra), 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0x101018, fog: false, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = L.f > 0.95 ? -9 : -8;
    mesh.frustumCulled = false;
    const grp = new THREE.Group(); grp.add(mesh);
    let winMat = null;
    if (win.length) {
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(win, 3));
      winMat = new THREE.PointsMaterial({ color: 0xffa040, size: 2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true });
      const wp = new THREE.Points(wg, winMat); wp.renderOrder = mesh.renderOrder + 0.5; wp.frustumCulled = false;
      grp.add(wp);
    }
    G.scene.add(grp);
    G.backdrop.push({ grp, mat, winMat, L, anchor: null });
  }
}
function updateBackdrop(cam) {
  for (const B of G.backdrop) {
    if (!B.anchor) B.anchor = new THREE.Vector2(cam.x, cam.z);
    const k = 1 - B.L.f, maxOff = B.L.r * 0.2;
    let ox = (cam.x - B.anchor.x) * k, oz = (cam.z - B.anchor.y) * k;
    const ol = Math.hypot(ox, oz);
    if (ol > maxOff) { ox *= maxOff / ol; oz *= maxOff / ol; B.anchor.set(cam.x - ox / k, cam.z - oz / k); }
    B.grp.position.set(cam.x - ox, cam.y - 30, cam.z - oz);
    B.mat.color.copy(G.scene.fog.color).lerp(_c1.copy(ATM.zen).multiplyScalar(0.3), clamp01(B.L.k + ATM.night * 0.4)).addScalar(G.flash * 0.12);
    if (B.winMat) B.winMat.opacity = 0.25 + ATM.night * 0.75;
  }
}
function resetBackdrop() { if (G.backdrop) for (const B of G.backdrop) B.anchor = null; }

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
