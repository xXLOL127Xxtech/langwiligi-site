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
  uGrassFar: { value: 70 }, uNeon: { value: 0 }, uNearCut: { value: 0 }, uFarCut: { value: 0 },
  uSunDirW: { value: new THREE.Vector3(0, 1, 0) }, uCDrift: { value: new THREE.Vector2() }, uCShadow: { value: 0 },
};

const VIEW_SETTINGS = [
  { name: 'Nah', chunks: 3, far: 950, grass: 45, grassMax: 2300, farR: 650, ultraR: 2000 },
  { name: 'Mittel', chunks: 4, far: 1300, grass: 62, grassMax: 3300, farR: 900, ultraR: 3000 },
  { name: 'Weit', chunks: 5, far: 1700, grass: 80, grassMax: 4300, farR: 1150, ultraR: 4200 },
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
let BLOB_MUL = 1;
function blob(ps, cx, cy, cz, rx, ry, rz, cols, rnd, dens = 11, flatBottom = 0.35) {
  const n = Math.floor(dens * BLOB_MUL * (rx * rz + rx * ry + ry * rz));
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
// Luftperspektive: dünn in der Nähe, dicht in der Ferne, Gipfel ragen aus dem Dunst
const AERIAL = `
float aerialF(float d, float y, float n, float f) {
  float fd = max(d - n, 0.0) / max(f, 1.0);
  float a = 1.0 - exp(-(fd * fd * 2.2 + fd * 0.45));
  return a * mix(1.0, 0.42, smoothstep(6.0, 190.0, y));
}`;
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
}`;
const FOG_V = 'uniform float uFogNear; uniform float uFogFar; varying float vFog;' + AERIAL + CLOUD_SH;
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float fogDepth; varying float vFogY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n fogDepth = - mvPosition.z; vFogY = (modelMatrix * vec4(position, 1.0)).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float fogDepth; varying float vFogY; uniform float fogNear; uniform float fogFar;' + AERIAL + '\n#endif';
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, aerialF(fogDepth, vFogY, fogNear, fogFar));\n#endif';
const FOG_F = 'uniform vec3 uFogColor; varying float vFog;';

function pointsMat(size, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uSize: { value: size }, uEmit: { value: opts.emit || 0 }, uSway: { value: opts.sway == null ? 1 : opts.sway }, uAlpha: { value: 1 }, uFarMul: { value: opts.farMul || 1 }, uFogCap: { value: opts.fogCap || 1 }, uCut: { value: opts.cut ? 1 : 0 }, uMaxPt: { value: opts.maxPt || 30 } }),
    vertexShader: `
      ${FOG_V}
      uniform float uTime, uWind, uScale, uSize, uEmit, uSway, uFarMul, uCut, uNearCut, uMaxPt, uFogCap;
      uniform vec2 uWindDir; uniform vec3 uLight, uLanternPos, uLanternCol, uCam;
      attribute vec3 color; attribute float aRnd;
      varying vec3 vCol;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float sw = sin(uTime * 1.4 + wp.x * 0.35 + wp.z * 0.3 + aRnd * 3.0) * 0.09 * uWind * uSway;
        wp.xz += uWindDir * sw;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * (0.75 + 0.5 * aRnd) * uScale / -mv.z, 1.0, uMaxPt) * smoothstep(1.2, 5.0, -mv.z);
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
      void main(){ gl_FragColor = vec4(mix(vCol, uFogColor, vFog), uAlpha); }`,
    transparent: !!opts.additive || !!opts.transparent,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive,
  });
}

const MAT = {};
function initMaterials() {
  MAT.flat = farLambert(null, 1);
  MAT.leaves = pointsMat(0.62);
  MAT.leavesBig = pointsMat(0.9);
  MAT.glow = pointsMat(0.5, { emit: 1, additive: true });
  MAT.glowBig = pointsMat(1.3, { emit: 1, additive: true, sway: 0.3 });
  MAT.cloudPts = pointsMat(1.0, { emit: 0.25, sway: 0 });
  MAT.neonLeaves = pointsMat(0.62, { emit: 0 });
  MAT.neonGlow = pointsMat(0.32, { emit: 1, additive: true, sway: 0.4 });
  // Fernsicht: Wahrzeichen und fernes Gelände verschwinden erst viel später im Nebel
  MAT.landmark = farLambert(null, 0.86);
  MAT.farTerrain = farLambert(U.uNearCut, 1);
  MAT.ultraTerrain = farLambert(U.uFarCut, 1);
  MAT.farCanopy = pointsMat(5, { sway: 0, cut: true, maxPt: 4 });
  MAT.landGlow = pointsMat(0.9, { emit: 1, additive: true, sway: 0, farMul: 3.2, maxPt: 14, fogCap: 0.7 });
  MAT.grass = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      ${FOG_V}
      uniform float uTime, uWind, uGrassFar, uNeon;
      uniform vec2 uWindDir; uniform vec3 uLight, uSunCol, uLanternPos, uLanternCol, uCam, uSunDirW;
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
        // Gegenlicht: Rispen leuchten, wenn man in die tiefe Sonne schaut
        vec3 vd = normalize(p - uCam);
        float back = pow(max(dot(vd, uSunDirW), 0.0), 5.0) * smoothstep(0.45, 0.85, t);
        li += uSunCol * back * 1.6;
        // Windwellen laufen hell über die Wiese
        li *= 1.0 + max(gust, 0.0) * 0.16 * t * uWind;
        vCol = base * li * cloudSh(p.xz);
        float gl = iGlow * uNeon * smoothstep(0.5, 0.8, t) * (0.75 + 0.25 * sin(uTime * 2.0 + iPar.z * 3.0));
        vCol = mix(vCol, iTip * 1.25, gl);
        vFog = aerialF(-mv.z, p.y, uFogNear, uFogFar) * (1.0 - gl * 0.6);
      }`,
    fragmentShader: `
      ${FOG_F}
      varying vec3 vCol;
      void main(){ gl_FragColor = vec4(mix(vCol, uFogColor, vFog), 1.0); }`,
    side: THREE.DoubleSide,
  });
}

let FAR_MATS = 0;
function farLambert(cutU, cap) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const id = FAR_MATS++;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCam = U.uCam; sh.uniforms.uCut = cutU || { value: 0 };
    sh.uniforms.uCDrift = U.uCDrift; sh.uniforms.uCShadow = U.uCShadow;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP; uniform vec3 uCam; uniform float uCut;\n' + CLOUD_SH + sh.fragmentShader
      .replace('void main() {', 'void main() {\n' + (cutU ? ' if (distance(vWP.xz, uCam.xz) < uCut) discard;' : ''))
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= cloudSh(vWP.xz);\n#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, min(aerialF(fogDepth, vWP.y, fogNear, fogFar), ' + cap.toFixed(2) + '));\n#endif');
  };
  m.customProgramCacheKey = () => 'far' + id;
  return m;
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
  G.camera = new THREE.PerspectiveCamera(58, 1, 0.45, 5000);
  G.hemi = new THREE.HemisphereLight(0x8080c0, 0x202020, 0.6);
  G.sun = new THREE.DirectionalLight(0xffffff, 0.6);
  G.lantern = new THREE.PointLight(0xffb070, 0, 13, 2);
  G.scene.add(G.hemi, G.sun, G.sun.target, G.lantern);
  for (const l of [G.hemi, G.sun, G.lantern]) l.layers.enable(1);

  G.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  G.postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: G.rt.texture }, tBloom: { value: null }, tRays: { value: null }, uBloom: { value: 0.5 }, uRays: { value: 0 }, uRayCol: { value: new THREE.Color(1, 0.8, 0.6) },
      uShadowTint: { value: new THREE.Color(0.78, 0.8, 1.15) }, uHighTint: { value: new THREE.Color(0.22, 0.15, 0.05) }, uSat: { value: 0.38 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uFade: { value: 0 }, uLevels: { value: 15 }, uFadeCol: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse, tBloom, tRays; uniform float uFlash, uHurt, uFade, uLevels, uSat, uBloom, uRays; uniform vec3 uFadeCol, uRayCol, uShadowTint, uHighTint;
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
        vec3 bl = texture2D(tBloom, vUv).rgb;
        c += bl * uBloom * (1.0 - c * 0.5);
        // Lichtstrahlen von Sonne und Mond
        c += texture2D(tRays, vUv).rgb * uRayCol * uRays;
        // Farbgebung: kühle Schatten, warme Lichter, sanfte Schulter
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(c, c * uShadowTint, 1.0 - smoothstep(0.0, 0.5, lum));
        c += uHighTint * smoothstep(0.4, 1.0, lum) * 0.5;
        c = c * 1.06 / (1.0 + max(c - 0.85, 0.0) * 0.6);
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
  // Leuchten (Bloom): helle Stellen herausfiltern, verwischen, dazumischen
  const rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  G.rtB1 = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  G.rtB2 = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  G.postMat.uniforms.tBloom.value = G.rtB1.texture;
  G.postMat.uniforms.tRays.value = G.rtB2.texture;
  const qv = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  G.brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: G.rt.texture }, uPx: { value: new THREE.Vector2() } }, vertexShader: qv,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; varying vec2 vUv;
      vec3 br(vec2 o){ vec3 c = texture2D(tDiffuse, vUv + o).rgb; float l = max(c.r, max(c.g, c.b)); return c * smoothstep(0.55, 0.95, l); }
      void main(){ gl_FragColor = vec4((br(vec2(0.0)) + br(uPx * vec2(1.0, 0.0)) + br(uPx * vec2(0.0, 1.0)) + br(uPx)) * 0.25, 1.0); }`,
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
  initClouds();
  initWater();
  initWeatherFX();
  initBurst();
  initMist();
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
  const bw = Math.max(2, Math.round(G.w / 2)), bh = Math.max(2, Math.round(G.h / 2));
  G.rtB1.setSize(bw, bh); G.rtB2.setSize(bw, bh);
  G.brightMat.uniforms.uPx.value.set(1 / G.w, 1 / G.h);
  G.rtRefl.setSize(Math.max(2, Math.round(G.w / 2)), Math.max(2, Math.round(G.h / 2)));
  G.bloomPx = [1 / bw, 1 / bh];
  G.camera.aspect = G.w / G.h;
  G.camera.updateProjectionMatrix();
  U.uScale.value = G.h * 0.5 / Math.tan(G.camera.fov * Math.PI / 360) * 0.5;
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

// ---------- Himmel ----------
function initSky() {
  G.skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 1 }, uMoonSize: { value: 0.9905 }, uAurora: { value: 0 }, uTime: U.uTime, uFlash: { value: 0 }, uSunVis: { value: 1 }, uMoonVis: { value: 1 }, uCloudy: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uMoonDir;
      uniform float uStars, uTime, uFlash, uSunVis, uMoonVis, uCloudy, uMoonSize, uAurora;
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
        float ms = uMoonSize, mw = (1.0 - ms) * 0.11;
        float moon = smoothstep(ms, ms + mw, md);
        float md2 = dot(d, normalize(uMoonDir + vec3(0.075, 0.035, 0.0) * sqrt((1.0 - ms) / 0.0095)));
        moon *= 1.0 - smoothstep(ms, ms + mw, md2) * 0.92 * smoothstep(0.985, 0.99, ms);
        float spots = 0.82 + 0.18 * hash(floor(d * 160.0));
        float mv = uMoonVis * (1.0 - uCloudy * 0.6);
        col = mix(col, vec3(0.93, 0.9, 0.84) * spots, moon * mv);
        col += vec3(0.42, 0.38, 0.6) * (pow(max(md, 0.0), 14.0) * 0.22 + pow(max(md, 0.0), 120.0) * 0.25 + pow(max(md, 0.0), 30.0) * (1.0 - smoothstep(0.972, 0.99, ms)) * 0.5) * mv;
        vec3 q = floor(d * 240.0);
        float s = hash(q);
        float tw = 0.55 + 0.45 * sin(uTime * 2.3 + s * 90.0);
        float sv = uStars * smoothstep(0.03, 0.3, h) * (1.0 - uCloudy);
        col += vec3(0.92, 0.88, 1.0) * step(0.9972, s) * tw * sv;
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.45, 0.82))), 2.0) * 26.0) * smoothstep(0.0, 0.35, h);
        col += vec3(0.26, 0.17, 0.36) * band * sv * 0.4 * (0.55 + 0.45 * hash(floor(d * 80.0)));
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
        col += uFlash * vec3(0.42, 0.38, 0.6) * (0.35 + 0.65 * smoothstep(-0.1, 0.5, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), G.skyMat);
  G.sky.renderOrder = -10;
  G.sky.frustumCulled = false;
  G.sky.layers.enable(1);
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
  G.clouds.layers.enable(1);
  G.scene.add(G.clouds);
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
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(v.y, 0.0), 2.5);
        vec3 col = mix(uDeep, uSky, 0.3 + 0.6 * fres);
        if (uReflOn > 0.5) {
          vec4 rc = uReflVP * vec4(vW.x + sin(vW.z * 0.9 + uTime * 1.3) * 0.25, vW.y, vW.z + sin(vW.x * 0.7 + uTime) * 0.2, 1.0);
          vec2 ru = rc.xy / rc.w * 0.5 + 0.5;
          if (rc.w > 0.0 && ru.x > 0.0 && ru.x < 1.0 && ru.y > 0.0 && ru.y < 1.0) col = mix(col, texture2D(tRefl, ru).rgb * 0.92, 0.35 + 0.5 * fres);
        }
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
    r.setRenderTarget(G.rtRefl); r.render(G.scene, rc);
    G.sky.position.copy(sky);
    r.clippingPlanes = [];
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
  sm.uMoonSize.value = lerp(0.9905, 0.972, md.mond);
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
  G.sun.position.copy(cam).addScaledVector(ld, 100);
  G.sun.target.position.copy(cam);
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
  G.postMat.uniforms.uSat.value = cave ? cave.sat : clamp(1 - ATM.desat * 0.85 - ATM.night * 0.28 - stormE * 0.25 - fogE * 0.12 - md.dunkel * 0.4 + md.hell * 0.22 + md.feen * 0.25 + md.mond * 0.2, 0.2, 1.15);
  G.postMat.uniforms.uBloom.value = (cave ? cave.bloom : 0.5 + md.hell * 0.25 + md.mond * 0.45 + md.feen * 0.4 + ATM.night * 0.2);
  MAT.neonLeaves.uniforms.uEmit.value = cave ? 1 : ATM.night * 0.9;
  MAT.neonGlow.uniforms.uAlpha.value = cave ? 1 : 0.2 + ATM.night * 0.8;
  U.uNeon.value = cave ? 1 : (0.12 + ATM.night * 0.88) * (1 - md.dunkel * 0.85);
  U.uFogColor.value.copy(G.scene.fog.color); U.uFogNear.value = near; U.uFogFar.value = far;
  U.uWind.value = c.wind; U.uGrassFar.value = vs.grass;

  // Wolken
  G.clouds.visible = !cave;
  ATM.drift.x += U.uWindDir.value.x * dt * (2 + c.wind * 4); ATM.drift.y += U.uWindDir.value.y * dt * (2 + c.wind * 4);
  const cm = G.cloudMat.uniforms;
  cm.uDrift.value.copy(ATM.drift); cm.uCover.value = clamp01(cloudE * 1.05 + stormE * 0.1) * (1 - md.mond * 0.6);
  _c1.copy(ATM.hor).lerp(ATM.sunC, 0.35 * sunUp).lerp(ATM.zen, 0.2);
  cm.uLit.value.copy(_c1).multiplyScalar(1.15 - stormE * 0.4);
  cm.uDark.value.copy(ATM.zen).lerp(ATM.hor, 0.35).multiplyScalar(0.9 - stormE * 0.35);
  cm.uHorizon.value.copy(ATM.hor);
  cm.uFlash.value = G.flash;

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
  pm.uRayCol.value.copy(useMoon ? _c1.setRGB(0.7, 0.8, 1.0) : _c1.copy(ATM.sunC).lerp(_c2.setRGB(1, 0.9, 0.75), 0.4));
  // Farbstimmung je nach Ort
  const st = pm.uShadowTint.value, ht = pm.uHighTint.value;
  st.setRGB(0.8, 0.82, 1.12); ht.setRGB(0.2, 0.13, 0.04);
  st.lerp(_c1.setRGB(1.05, 0.72, 0.75), md.dunkel); ht.lerp(_c1.setRGB(0.25, 0.03, 0.0), md.dunkel);
  st.lerp(_c1.setRGB(0.72, 0.86, 1.3), Math.max(md.mond, ATM.night * 0.5)); ht.lerp(_c1.setRGB(0.08, 0.12, 0.25), md.mond);
  st.lerp(_c1.setRGB(1.05, 0.78, 1.15), md.hell); ht.lerp(_c1.setRGB(0.32, 0.12, 0.22), md.hell);
  if (cave) { st.copy(cave.amb).multiplyScalar(1.4).addScalar(0.3); ht.setRGB(0.1, 0.06, 0.12); }
}

// ---------- Gelände in Stücken ----------
const _tw = new Float32Array(NB), _tc = [0, 0, 0];
const PATH_C = [0.2, 0.16, 0.12];
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
  const segs = pathSegsNear(x0, z0, x0 + CHUNK, z0 + CHUNK);
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
    if (segs.length && (ay + by + cy) > 0.6) {
      // Trampelpfad: Erde und Kies
      const pd = pathDist(mx, mz, segs), k = smooth(2.9, 1.3, pd) * 0.85;
      if (k > 0) { const n = ((mx * 7.3 + mz * 3.1) % 1 + 1) % 1 * 0.06; for (let q = 0; q < 3; q++) _tc[q] = lerp(_tc[q], _tc[q] * 0.45 + PATH_C[q] + n, k); }
    }
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
  const chunk = { ci, cj, H, WW, group, segs };
  const psF = new PointSet(), treeXZ = [];
  const tries = 44;
  const bigL = bigNear(x0 + CHUNK / 2, z0 + CHUNK / 2, 330);
  for (let k = 0; k < tries; k++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
    const w = chunkWeights(chunk, x, z, _tw);
    let td = 0; for (let b = 0; b < NB; b++) td += w[b] * BIOMES[b].trees;
    const patch = World.nD.noise(x * 0.018 + 7, z * 0.018) * 0.5 + 0.5;
    // Wälder: dicht, aber begehbar; Wege bleiben frei
    const fo = forestAt(x, z) * Math.min(1, td * 1.5 + 0.1);
    const pOpen = td * (0.15 + patch * patch * 1.6) * 0.5 * 18 / tries;
    if (r() > Math.max(pOpen, fo * 0.62)) continue;
    const h = chunkHeight(chunk, x, z);
    if (h < 0.5 || h > 46 + r() * 26) continue;
    if (nearSite(x, z, 5)) continue;
    if (segs.length && pathDist(x, z, segs) < 4.2) continue;
    if (bigL && Math.hypot(x - bigL.x, z - bigL.z) < bigL.R + 10) continue;
    const inForest = fo > 0.35;
    treeXZ.push(x, z, inForest ? 3.4 : 2.8);
    BLOB_MUL = inForest ? 0.5 : 1;
    const tps = inForest ? psF : ps;
    const b = sampleBiome(w, r());
    const B0 = BIOMES[b];
    const dead = r() < 0.13 && B0.cold < 0.9 && B0.tree !== 'knorrig';
    if (!dead && B0.neon > 0 && r() < B0.neon * 0.3) {
      const nc = B0.neonCC[Math.floor(r() * 3)];
      buildTree(Object.assign({}, B0, { tree: B0.tree === 'knorrig' ? 'weide' : B0.tree, canopyC: [nc, nc.map(v => v * 0.55), nc.map(v => Math.min(1, v * 0.6 + 0.45))] }), x, h, z, r, mg, psN);
    } else buildTree(dead ? DEAD_TREE : inForest && B0.tree !== 'knorrig' && r() < 0.3 ? Object.assign({}, B0, { canopyC: B0.canopyC.map(c => c.map(v => v * 0.72)) }) : B0, x, h, z, r, mg, tps);
  }
  BLOB_MUL = 1;
  // weiche Schatten unter den Baumkronen
  for (let t = 0; t < treeXZ.length; t += 3) {
    const tx = treeXZ[t], tz = treeXZ[t + 1], rad = treeXZ[t + 2];
    const i0 = Math.max(0, Math.floor((tx - rad * 1.3 - x0) / S)), i1 = Math.min(N - 1, Math.floor((tx + rad * 1.3 - x0) / S));
    const j0 = Math.max(0, Math.floor((tz - rad * 1.3 - z0) / S)), j1 = Math.min(N - 1, Math.floor((tz + rad * 1.3 - z0) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = (j * N + i) * 18;
      for (let q = 0; q < 18; q += 3) {
        const d = Math.hypot(pos[b + q] - tx, pos[b + q + 2] - tz);
        const f = 1 - 0.45 * smooth(rad * 1.25, rad * 0.25, d);
        col[b + q] *= f; col[b + q + 1] *= f; col[b + q + 2] *= f;
      }
    }
  }
  if (treeXZ.length) g.attributes.color.needsUpdate = true;
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
          mg.add('box', M(x, h + 1.1, z, 0.16, 2.2, 0.16), [0.2, 0.15, 0.12], 0.1, r);
          mg.add('box', M(x + 0.25, h + 2.15, z, 0.55, 0.1, 0.1), [0.2, 0.15, 0.12], 0.1, r);
          mg.add('box', M(x + 0.48, h + 1.9, z, 0.24, 0.3, 0.24), [0.12, 0.1, 0.09], 0.1, r);
          wps.add(x + 0.48, h + 1.88, z, [1, 0.7, 0.35], 1);
        } else {
          mg.add('box', M(x, h + 0.5, z, 0.45, 1.2, 0.3, 0, r() * 3, (r() - 0.5) * 0.15), [0.42, 0.42, 0.46], 0.15, r);
          wps.add(x, h + 1.15, z, [0.55, 0.85, 1], 0.6);
        }
      }
    }
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
      else mg.add('ico', M(x, h + sz * 0.15, z, sz * (1 + r() * 0.7), sz * (0.5 + r() * 0.6), sz, r(), r() * 6, r()), c, 0.2, r);
    }
  }
  chunk.shrines = [];
  const gps = new PointSet();
  if (r() < 0.24) {
    const x = x0 + 8 + r() * (CHUNK - 16), z = z0 + 8 + r() * (CHUNK - 16), h = chunkHeight(chunk, x, z);
    if (h > 0.6 && !nearSite(x, z, 14)) buildDecor(pick(r, ['schwert', 'statue', 'schrein', 'graeber', 'schwert', 'schrein', 'statue']), x, h, z, r, mg, gps, chunk);
  }
  if (!mg.empty) group.add(new THREE.Mesh(mg.build(), MAT.flat));
  if (!ps.empty) group.add(new THREE.Points(ps.build(), MAT.leaves));
  if (!psF.empty) group.add(new THREE.Points(psF.build(), MAT.leavesBig));
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
  if (G.caveGround) { const y = G.caveGround(x, z); if (y != null) return y; }
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
      const n = Math.floor(140 * BLOB_MUL * s * s * (th / 7));
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
    if (h < 0.15 || h > 40 + r() * 14) continue;
    if (nearCampfire(x, z)) continue;
    if (ch.segs.length && pathDist(x, z, ch.segs) < (r() < 0.8 ? 1.7 : 0.8)) continue;
    if ((k & 3) === 0 && r() < forestAt(x, z) * 0.55) continue;
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
  const ready = need.length === 0 && gneed.length === 0;
  if (ready || performance.now() - t0 < budgetMs * 0.5) updateFar(px, pz, t0, budgetMs);
  return ready;
}

function clearChunks() {
  for (const [, ch] of G.chunks) disposeObj(ch.group);
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
  const N = lv.res, FAR = lv.size, S = FAR / N, V = N + 1, x0 = fi * FAR, z0 = fj * FAR;
  const H = new Float32Array(V * V), WW = new Float32Array(V * V * NB);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = x0 + i * S, z = z0 + j * S;
    const w = weightsAt(x, z, _fw);
    WW.set(w, (j * V + i) * NB);
    H[j * V + i] = heightAt(x, z, w) - lv.drop;
  }
  const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
  const wavg = new Float32Array(NB);
  let o = 0;
  const tri = (ia, ib, ic) => {
    const ax = x0 + (ia % V) * S, az = z0 + Math.floor(ia / V) * S, bx = x0 + (ib % V) * S, bz = z0 + Math.floor(ib / V) * S, cx = x0 + (ic % V) * S, cz = z0 + Math.floor(ic / V) * S;
    const ay = H[ia], by = H[ib], cy = H[ic];
    pos.set([ax, ay, az, bx, by, bz, cx, cy, cz], o);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const slope = 1 - Math.abs(ny) / Math.sqrt(nx * nx + ny * ny + nz * nz);
    for (let b = 0; b < NB; b++) wavg[b] = (WW[ia * NB + b] + WW[ib * NB + b] + WW[ic * NB + b]) / 3;
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, my = (ay + by + cy) / 3 + lv.drop;
    groundColor(mx, mz, my, slope * 2.2, wavg, _tc);
    {
      // Wälder als dunkle Flächen bis zum Horizont
      let td = 0; for (let b = 0; b < NB; b++) td += wavg[b] * BIOMES[b].trees;
      const fo = Math.max(forestAt(mx, mz) * Math.min(1, td * 1.5 + 0.1), td * 0.15) * (1 - smooth(40, 70, my)) * (my > 0.5 ? 1 : 0);
      const cc = BIOMES[dominantBiome(wavg)].canopyC[1];
      for (let q = 0; q < 3; q++) _tc[q] = lerp(_tc[q], cc[q] * 0.75, fo * 0.8);
    }
    for (let k = 0; k < 3; k++) col.set(_tc, o + k * 3);
    o += 9;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; tri(a, c, b); tri(b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, lv.ultra ? MAT.ultraTerrain : MAT.farTerrain));
  // Baumkronen: Wälder bilden dunkle Bänder bis zum Horizont
  const r = mulberry32(hash2(fi, fj, World.seed + 777)), ps = new PointSet();
  for (let k = 0; k < (lv.ultra ? 0 : 420); k++) {
    const x = x0 + r() * FAR, z = z0 + r() * FAR;
    const w = weightsAt(x, z, _fw);
    let td = 0; for (let b = 0; b < NB; b++) td += w[b] * BIOMES[b].trees;
    const fo = Math.max(forestAt(x, z) * Math.min(1, td * 1.5 + 0.1), td * 0.08);
    if (r() > fo) continue;
    const h = heightAt(x, z, w);
    if (h < 0.6 || h > 45 + r() * 25) continue;
    const B = BIOMES[sampleBiome(w, r())];
    const c = B.canopyC[r() < 0.6 ? 0 : 1];
    const tall = B.tree === 'tanne' || B.tree === 'schneetanne' ? 5 : 3.2;
    ps.add(x, h + tall, z, c, 0.8 + r() * 0.3);
    ps.add(x + (r() - 0.5) * 3, h + tall * 0.6, z + (r() - 0.5) * 3, B.canopyC[1], 0.7 + r() * 0.3);
  }
  if (!ps.empty) grp.add(new THREE.Points(ps.build(), MAT.farCanopy));
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
