'use strict';
// Wanderlicht – Laub: Blattkarten mit Wind, Schatten und weicher Kugelbeleuchtung (nah) und Laubkugeln (fern)

const LEAF_KIND = { broad: 0, needle: 1, blossom: 2, strand: 3, fern: 4, petal: 5 };

// ---------- Blatt-Texturen (gezeichnet, 2x2 Varianten) ----------
const LEAF_TEX = [];
function leafTexture(kind) {
  if (LEAF_TEX[kind]) return LEAF_TEX[kind];
  const S = 512, C = S / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.004)'; x.fillRect(0, 0, S, S);
  const r = mulberry32(1000 + kind * 17);
  const shade = (a, b) => { const v = Math.round(255 * (a + (b - a) * r())); return `rgb(${v},${v},${Math.round(v * 0.98)})`; };
  const leaf = (cx, cy, len, wid, ang, tone) => {
    x.save(); x.translate(cx, cy); x.rotate(ang);
    x.beginPath();
    x.moveTo(0, -len);
    x.bezierCurveTo(wid * 1.1, -len * 0.55, wid * 0.9, len * 0.35, 0, len);
    x.bezierCurveTo(-wid * 0.9, len * 0.35, -wid * 1.1, -len * 0.55, 0, -len);
    const g = x.createLinearGradient(-wid, 0, wid, 0);
    g.addColorStop(0, shade(tone - 0.12, tone)); g.addColorStop(0.5, shade(tone, tone + 0.1)); g.addColorStop(1, shade(tone - 0.2, tone - 0.05));
    x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(0, -len * 0.9); x.lineTo(0, len * 0.95); x.stroke();
    x.restore();
  };
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell & 1) * C, oy = (cell >> 1) * C;
    x.save();
    x.beginPath(); x.rect(ox, oy, C, C); x.clip();
    x.translate(ox, oy);
    if (kind === LEAF_KIND.broad) {
      for (let i = 0; i < 14; i++) leaf(20 + r() * (C - 40), 20 + r() * (C - 40), 26 + r() * 22, 12 + r() * 9, r() * 6.28, 0.62 + r() * 0.38);
    } else if (kind === LEAF_KIND.needle) {
      for (let b = 0; b < 4; b++) {
        const bx = 30 + r() * (C - 60), by = 30 + r() * (C - 60), ba = r() * 6.28, bl = 60 + r() * 40;
        x.save(); x.translate(bx, by); x.rotate(ba);
        x.strokeStyle = shade(0.45, 0.6); x.lineWidth = 3; x.beginPath(); x.moveTo(-bl, 0); x.lineTo(bl, 0); x.stroke();
        for (let k = -bl; k < bl; k += 4.5) {
          for (const sd of [-1, 1]) {
            const nl = 16 + r() * 12;
            x.strokeStyle = shade(0.62, 1); x.lineWidth = 2.2;
            x.beginPath(); x.moveTo(k, 0); x.lineTo(k + nl * 0.5, sd * nl); x.stroke();
          }
        }
        x.restore();
      }
    } else if (kind === LEAF_KIND.blossom) {
      for (let i = 0; i < 9; i++) {
        const fx = 25 + r() * (C - 50), fy = 25 + r() * (C - 50), fr = 11 + r() * 9, fa = r() * 6.28;
        for (let p = 0; p < 5; p++) {
          const a = fa + p * 1.2566;
          x.fillStyle = shade(0.8, 1);
          x.beginPath(); x.ellipse(fx + Math.cos(a) * fr * 0.7, fy + Math.sin(a) * fr * 0.7, fr * 0.62, fr * 0.45, a, 0, 6.283); x.fill();
        }
        x.fillStyle = shade(0.4, 0.55); x.beginPath(); x.arc(fx, fy, fr * 0.28, 0, 6.283); x.fill();
      }
      for (let i = 0; i < 4; i++) leaf(20 + r() * (C - 40), 20 + r() * (C - 40), 22, 9, r() * 6.28, 0.5 + r() * 0.2);
    } else if (kind === LEAF_KIND.strand) {
      for (let i = 0; i < 9; i++) {
        const sx = 14 + i * (C - 28) / 8 + (r() - 0.5) * 8, sl = C * (0.55 + r() * 0.4);
        x.strokeStyle = shade(0.4, 0.55); x.lineWidth = 2.4; x.beginPath(); x.moveTo(sx, 2); x.lineTo(sx + (r() - 0.5) * 10, sl); x.stroke();
        for (let k = 10; k < sl; k += 11) leaf(sx + (r() - 0.5) * 5 + (r() < 0.5 ? -6 : 6), k, 11 + r() * 5, 4.5, (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.3), 0.65 + r() * 0.35);
      }
    } else if (kind === LEAF_KIND.fern) {
      for (let f = 0; f < 2; f++) {
        const fx = C * (0.28 + f * 0.44), len = C * 0.46;
        x.strokeStyle = shade(0.5, 0.6); x.lineWidth = 4; x.beginPath(); x.moveTo(fx, C - 6); x.quadraticCurveTo(fx + (f ? 18 : -18), C * 0.5, fx, C - 6 - len * 2); x.stroke();
        for (let k = 0; k < 16; k++) {
          const t = k / 16, yy = C - 14 - t * len * 1.9, wd = (1 - t) * 40 + 6;
          for (const sd of [-1, 1]) leaf(fx + sd * wd * 0.5 + (f ? 18 : -18) * Math.sin(t * 3) * 0.3, yy, wd * 0.52, 5 + (1 - t) * 3, sd * 1.25, 0.6 + r() * 0.4);
        }
      }
    } else {
      // Blüte, gross
      const fx = C / 2, fy = C / 2;
      for (let layer = 0; layer < 2; layer++) {
        for (let p = 0; p < 7; p++) {
          const a = p * 0.8976 + layer * 0.45;
          x.fillStyle = shade(layer ? 0.9 : 0.7, 1);
          x.beginPath(); x.ellipse(fx + Math.cos(a) * (50 - layer * 10), fy + Math.sin(a) * (50 - layer * 10), 40 - layer * 8, 22 - layer * 4, a, 0, 6.283); x.fill();
        }
      }
      x.fillStyle = shade(0.35, 0.45); x.beginPath(); x.arc(fx, fy, 22, 0, 6.283); x.fill();
    }
    x.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  LEAF_TEX[kind] = tex;
  return tex;
}

// ---------- Material für Blattkarten ----------
const LEAF_VERT = `
attribute vec4 iPos; attribute vec4 iNrm; attribute vec4 iCol;
uniform float uTime, uWind; uniform vec2 uWindDir;
varying vec3 vLC; varying vec3 vLWP; varying float vLSw;
float lhash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 leafPos(vec2 corner, out vec3 cardN) {
  cardN = normalize(iNrm.xyz);
  float h1 = lhash(iPos.xyz), h2 = lhash(iPos.zxy + 3.7), h3 = lhash(iPos.yzx + 9.1);
  vec3 rnd = normalize(vec3(h1 - 0.5, h2 - 0.5, h3 - 0.5) + vec3(0.0001));
  vec3 pn = normalize(mix(cardN, rnd, 0.62));
  vec3 t = normalize(cross(pn, abs(pn.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  float a = h3 * 6.2832; vec3 tt = t * cos(a) + cross(pn, t) * sin(a); vec3 bb = cross(pn, tt);
  vec3 p = iPos.xyz + (tt * corner.x + bb * corner.y) * iPos.w;
  float sw = iCol.a;
  float ph = uTime * 1.25 + iPos.x * 0.19 + iPos.z * 0.15 + h1 * 6.0;
  float gust = sin(uTime * 0.7 - dot(iPos.xz, uWindDir) * 0.04);
  vec2 wv = uWindDir * (sin(ph) * 0.45 + gust * 0.55 + 0.25) * uWind * sw * 0.55;
  p.xz += wv; p.y += sin(ph * 1.6 + h2 * 3.0) * 0.07 * uWind * sw;
  p += pn * sin(uTime * 2.6 + h1 * 40.0) * 0.045 * uWind;
  vLSw = sw;
  return p;
}
`;
function leafPatch(sh, depth) {
  sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uWindDir = U.uWindDir;
  sh.vertexShader = LEAF_VERT + sh.vertexShader
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(iNrm.xyz);')
    .replace('#include <begin_vertex>', 'vec3 cardN0; vec3 transformed = leafPos(position.xy, cardN0);\n vLC = iCol.rgb; vLWP = transformed;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\n vUv = (vUv + vec2(mod(floor((iNrm.w * 0.5 + 0.5) * 3.99), 2.0), floor(floor((iNrm.w * 0.5 + 0.5) * 3.99) / 2.0))) * 0.5;\n#endif');
  return sh;
}
const LEAF_MATS = {}, LEAF_DEPTH = {};
function leafMaterial(kind, neon) {
  const key = kind + (neon ? 'n' : '');
  if (LEAF_MATS[key]) return LEAF_MATS[key];
  const map = leafTexture(kind);
  const m = new THREE.MeshPhongMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.38, shininess: 6, specular: new THREE.Color(0x303830) });
  m.alphaToCoverage = QUALITY[G.quality].msaa > 0;
  const emit = { value: neon ? 1 : 0 };
  m.userData.emit = emit;
  const id = WORLD_MATS++;
  m.onBeforeCompile = sh => {
    leafPatch(sh);
    sh.uniforms.uEmitK = emit; sh.uniforms.uSunCol = U.uSunCol; sh.uniforms.uSunDirW = U.uSunDirW; sh.uniforms.uCam = U.uCam; sh.uniforms.uCDrift = U.uCDrift; sh.uniforms.uCShadow = U.uCShadow; sh.uniforms.uMistAmt = U.uMistAmt; sh.uniforms.uMistBase = U.uMistBase;
    sh.fragmentShader = 'varying vec3 vLC; varying vec3 vLWP; varying float vLSw; uniform float uEmitK; uniform vec3 uSunCol, uSunDirW, uCam;\n' + CLOUD_SH + sh.fragmentShader
      .replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vLC * (0.9 + 0.2 * dh2(floor(vLWP.xz * 3.0) + floor(vLWP.y * 3.0)));')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uEmitK * 0.9;')
      .replace('#include <envmap_fragment>', `
        vec3 lvd = normalize(vLWP - uCam);
        float trans = pow(max(dot(lvd, uSunDirW), 0.0), 3.0);
        outgoingLight += diffuseColor.rgb * uSunCol * trans * 0.55 * (0.5 + vLSw * 0.5);
        #include <envmap_fragment>`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= cloudSh(vLWP.xz);\n#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, aerialF(fogDepth, vLWP.y, fogNear, fogFar));\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('varying vec3 vLC;', SURF_LITE + 'varying vec3 vLC;');
  };
  m.customProgramCacheKey = () => 'leaf' + id;
  LEAF_MATS[key] = m;
  // Schattenwurf mit Blattform
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide });
  d.onBeforeCompile = sh => { leafPatch(sh); };
  d.customProgramCacheKey = () => 'leafdepth';
  LEAF_DEPTH[key] = d;
  return m;
}
// kleine Hilfsfunktion für den Blatt-Shader (Helligkeitsrauschen)
const SURF_LITE = 'float dh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n';

function initFoliageMats() {
  // Laubmasse in der Ferne: weich schattierte Kugeln mit Blattrauschen
  MAT.leafFar = worldMat({ shine: 2, spec: 0x000000 });
  MAT.leafFar.userData.far = true;
  MAT.leafNeon = { emit: 0 };
  MAT.shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
}

const _lq = new THREE.Quaternion();
let LEAF_QUAD = null;
function leafQuad() {
  if (LEAF_QUAD) return LEAF_QUAD;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.userData.keep = true;
  LEAF_QUAD = g;
  return g;
}

// ---------- Sammlung von Blättern eines Baumes oder Bauwerks ----------
class LeafSet {
  constructor(neon) {
    this.k = [[], [], [], [], [], []];   // pro Art: Karten
    this.far = [];                       // Laubkugeln (ferne Darstellung)
    this.neon = !!neon;
    this.sb = 0; this.sh = 10;
    this.budget = 1;
  }
  get empty() { return this.far.length === 0 && this.k.every(a => a.length === 0); }
  // einzelne Karte
  add(x, y, z, col, f = 1, nx = 0, ny = 1, nz = 0, size = 0.5, kind = 0, sway = null) {
    if (this.noCards) return;
    const sw = sway == null ? clamp01(0.25 + 0.75 * (y - this.sb) / Math.max(1, this.sh)) : sway;
    this.k[kind].push(x, y, z, size, nx, ny, nz, Math.floor(Math.random() * 4), col[0] * f, col[1] * f, col[2] * f, sw);
  }
  // Laubmasse als Ellipsoid aus vielen Karten
  clump(cx, cy, cz, rx, ry, rz, cols, rnd, opts = {}) {
    const kind = opts.kind || 0;
    const base = opts.size || Math.min(4.2, 0.9 + Math.max(rx, rz) * 0.19);
    const flat = opts.flat == null ? 0.35 : opts.flat;
    const area = 4 * Math.PI * Math.pow((Math.pow(rx * ry, 1.6) + Math.pow(rx * rz, 1.6) + Math.pow(ry * rz, 1.6)) / 3, 1 / 1.6);
    let n = Math.floor(area * (opts.cover || 1.4) * (opts.dens || 1) * QUALITY[G.quality].leaf / (base * base));
    n = Math.min(n, 2600);
    this.far.push([cx, cy, cz, rx, ry, rz, cols[0], cols[1], cols[2], opts.kind || 0]);
    if (this.noCards) return;
    for (let i = 0; i < n; i++) {
      let x, y, z, l;
      do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
      const inv = 1 / Math.sqrt(l);
      x *= inv; y *= inv; z *= inv;
      // Blätter sitzen auf der Hülle; der dunkle Kern darunter macht die Krone dicht
      const q = rnd(), s = opts.sparse ? 0.5 + 0.5 * Math.cbrt(q) : 0.84 + 0.2 * q;
      let py = y; if (py < -flat) py = -flat - (py + flat) * 0.3;
      const px = cx + x * rx * s, pyy = cy + py * ry * s, pz = cz + z * rz * s;
      // Kugelnormale mit Aufwärtstendenz
      let nx = x / rx, ny = y / ry + 0.18, nz = z / rz;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const top = y * 0.5 + 0.5;
      const c = top < 0.4 && rnd() < 0.7 ? cols[1] : top > 0.6 && rnd() < 0.5 ? cols[2] : cols[0];
      const ao = (0.5 + 0.5 * s) * (0.72 + 0.28 * top) * (0.88 + rnd() * 0.24);
      // nur die äusseren Blätter bewegen sich im Wind, das Innere bleibt ruhig
      const hg = clamp01(0.3 + 0.7 * (pyy - this.sb) / Math.max(1, this.sh));
      const sw = opts.sparse ? hg : (0.04 + 0.96 * q * q) * hg;
      this.add(px, pyy, pz, c, ao * 1.12, nx, ny, nz, base * (0.78 + rnd() * 0.5), kind, sw);
    }
  }
  // Kegelförmige Nadelmasse (Tannenstockwerk)
  cone(cx, cy, cz, rad, h, cols, rnd, opts = {}) {
    const base = opts.size || Math.min(2.6, 0.85 + rad * 0.14);
    const area = Math.PI * rad * Math.hypot(rad, h);
    let n = Math.floor(area * (opts.cover || 2.0) * QUALITY[G.quality].leaf / (base * base));
    n = Math.min(n, 1800);
    this.far.push([cx, cy, cz, rad, h, rad, cols[0], cols[1], cols[2], 100]);
    if (this.noCards) return;
    const slope = rad / h;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rnd(), 0.75);          // 0 = Spitze, 1 = Rand
      const a = rnd() * 6.2832;
      const rr = rad * t * (0.6 + 0.42 * Math.sqrt(rnd()));
      const yy = cy + h * (1 - t) - (rnd() * 0.2) * h * t * 0.3;
      let nx = Math.cos(a), nz = Math.sin(a), ny = slope * 0.9 - 0.15;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const c = rnd() < 0.2 ? cols[2] : rnd() < 0.5 ? cols[1] : cols[0];
      const ao = (0.55 + 0.45 * t) * (0.85 + rnd() * 0.3);
      const hg = clamp01(0.3 + 0.7 * (yy - this.sb) / Math.max(1, this.sh));
      this.add(cx + Math.cos(a) * rr, yy, cz + Math.sin(a) * rr, c, ao * 1.12, nx, ny, nz, base * (0.8 + rnd() * 0.5), 1, (0.05 + 0.95 * t * t) * hg);
    }
  }
  // Karten als Objekt
  meshNear() {
    const grp = new THREE.Group();
    for (let kind = 0; kind < 6; kind++) {
      const arr = this.k[kind], n = arr.length / 12;
      if (!n) continue;
      const g = new THREE.InstancedBufferGeometry();
      const q = leafQuad();
      g.setIndex(q.index.clone()); g.setAttribute('position', q.attributes.position.clone()); g.setAttribute('uv', q.attributes.uv.clone());
      const pos = new Float32Array(n * 4), nrm = new Int8Array(n * 4), col = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        const o = i * 12;
        pos[i * 4] = arr[o]; pos[i * 4 + 1] = arr[o + 1]; pos[i * 4 + 2] = arr[o + 2]; pos[i * 4 + 3] = arr[o + 3];
        nrm[i * 4] = Math.round(arr[o + 4] * 127); nrm[i * 4 + 1] = Math.round(arr[o + 5] * 127); nrm[i * 4 + 2] = Math.round(arr[o + 6] * 127); nrm[i * 4 + 3] = Math.round((arr[o + 7] / 3 * 2 - 1) * 127);
        col[i * 4] = Math.min(255, Math.round(arr[o + 8] * 255)); col[i * 4 + 1] = Math.min(255, Math.round(arr[o + 9] * 255)); col[i * 4 + 2] = Math.min(255, Math.round(arr[o + 10] * 255)); col[i * 4 + 3] = Math.round(arr[o + 11] * 255);
      }
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4));
      g.setAttribute('iNrm', new THREE.InstancedBufferAttribute(nrm, 4, true));
      g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 4, true));
      g.instanceCount = n;
      // Begrenzung aus den Punkten
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let i = 0; i < n; i++) { const x = pos[i * 4], y = pos[i * 4 + 1], z = pos[i * 4 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      g.boundingBox = new THREE.Box3(new THREE.Vector3(x0 - 3, y0 - 3, z0 - 3), new THREE.Vector3(x1 + 3, y1 + 3, z1 + 3));
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
      const mat = leafMaterial(kind, this.neon);
      const mesh = new THREE.Mesh(g, mat);
      mesh.customDepthMaterial = LEAF_DEPTH[kind + (this.neon ? 'n' : '')];
      mesh.castShadow = !!this.shadow; mesh.receiveShadow = true;
      grp.add(mesh);
    }
    return grp;
  }
  // Laubkugeln für die Ferne
  // core: in der Nähe nur der dichte Kern unter den Blattkarten (kleiner und dunkler)
  addFarTo(mg, core) {
    const k = core ? 0.86 : 1, dk = core ? 0.72 : 1;
    for (const f of this.far) {
      const c = f[6];
      if (f[9] === 100) {
        // Kegel
        mg.add('cone', M(f[0], f[1] + (core ? f[4] * 0.05 : 0), f[2], f[3] * (core ? 0.7 : 1), f[4] * (core ? 0.9 : 1), f[5] * (core ? 0.7 : 1)), c.map(v => v * 0.9 * dk), 0.15, Math.random, 13);
      } else {
        mg.add('ico', M(f[0], f[1], f[2], f[3] * 0.97 * k, f[4] * 0.95 * k, f[5] * 0.97 * k, 0, 0, 0), c.map(v => v * 0.92 * dk), 0.2, Math.random, 13);
      }
    }
  }
  clear() { for (const a of this.k) a.length = 0; this.far.length = 0; }
}

// Laub-Objekt aus einem LeafSet (Karten, bei Bedarf mit Laubkugeln als Ersatz in der Ferne)
function leafObj(ls) {
  const g = ls.meshNear();
  g.userData.leaf = true;
  return g;
}
