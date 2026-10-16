// Golf-Tour – 3D-Welt einer Bahn: Gelände mit gemalter Textur, Himmel, Licht und Schatten, Wasser/Lava, Bäume, Fahne
'use strict';

// Farben aus Hex (sRGB) in den linearen Farbraum für die Beleuchtung umrechnen
const farbe = h => new THREE.Color(h).convertSRGBToLinear();
const farbeRoh = h => new THREE.Color(h);
function rgb(h) { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; }

// ---------- Gemeinsame Texturen (einmal erzeugt) ----------
const Tex = {
  detail: null, wellen: null, lava: null, wolke: null,
  init(renderer) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // Gras-Detail: feine Halme, hell um 1.0
    {
      const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n;
      const g = cv.getContext('2d'), img = g.createImageData(n, n), r = rng(99), rs = rauschen(5);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const v = 0.55 * rs.fbm(i / 9, j / 9, 3) + 0.45 * r();
        const s = 150 + v * 90;
        const k = (j * n + i) * 4;
        img.data[k] = s; img.data[k + 1] = s; img.data[k + 2] = s; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // kurze Halme
      for (let q = 0; q < 2600; q++) {
        const x = r() * n, y = r() * n, l = 2 + r() * 4, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
        g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      this.detail = t;
    }
    // Wasser-Normalen aus einer Höhenfunktion
    {
      const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n;
      const g = cv.getContext('2d'), img = g.createImageData(n, n);
      const h = (x, y) => Math.sin((x + y * 0.3) / n * TAU * 4) * 0.5 + Math.sin((x * 0.7 - y) / n * TAU * 6) * 0.35 + Math.sin((x * 1.3 + y * 1.1) / n * TAU * 9) * 0.2;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1);
        const k = (j * n + i) * 4;
        img.data[k] = 128 - dx * 90; img.data[k + 1] = 128 - dy * 90; img.data[k + 2] = 255; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.wellen = t;
    }
    // Lava: leuchtende Adern
    {
      const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n;
      const g = cv.getContext('2d'), img = g.createImageData(n, n), rs = rauschen(77);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const v = rs.fbm(i / 22, j / 22, 4);
        const ader = Math.pow(1 - Math.abs(v - 0.5) * 2, 6);
        const k = (j * n + i) * 4;
        img.data[k] = 120 + 135 * Math.min(1, ader * 1.4 + 0.2); img.data[k + 1] = 20 + 180 * ader * ader; img.data[k + 2] = 10 + 40 * ader * ader * ader; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      this.lava = t;
    }
    // Wolke
    {
      const n = 256, cv = document.createElement('canvas'); cv.width = n; cv.height = n / 2;
      const g = cv.getContext('2d'), r = rng(3);
      for (let q = 0; q < 26; q++) {
        const x = n * 0.18 + r() * n * 0.64, y = n * 0.2 + r() * n * 0.15, rad = 18 + r() * 26;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, n, n / 2);
      }
      const t = new THREE.CanvasTexture(cv);
      t.encoding = THREE.sRGBEncoding;
      this.wolke = t;
    }
  },
};

// Detail-Textur in ein Standard-Material einbauen (Weltmassstab, blendet mit Abstand aus)
function mitDetail(mat, wiederh) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.detailMap = { value: Tex.detail };
    sh.uniforms.detailRep = { value: wiederh };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform vec2 detailRep;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dAbst = length(vViewPosition);
        vec3 dt1 = texture2D(detailMap, vUv * detailRep).rgb;
        vec3 dt2 = texture2D(detailMap, vUv * detailRep * 0.23).rgb;
        float dMix = clamp(1.0 - dAbst / 140.0, 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), dt1 * 1.55, 0.75 * dMix) * mix(1.0, dt2.r * 1.5, 0.35);`);
  };
  return mat;
}

// ---------- Geometrie-Helfer für Bäume und Deko ----------
function teil(geo, farbHex, m, jitter = 0.06, rnd = Math.random) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (m) geo.applyMatrix4(m);
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = farbe(farbHex);
  for (let i = 0; i < n; i += 3) {
    const f = 1 + (rnd() - 0.5) * 2 * jitter;
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r * f; col[(i + k) * 3 + 1] = c.g * f; col[(i + k) * 3 + 2] = c.b * f; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function verbinde(teile) {
  let n = 0;
  for (const g of teile) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of teile) {
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return m;
};
function knubbel(r, detail, rnd, amp = 0.18) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = Math.round(p.getX(i) * 100) + ',' + Math.round(p.getY(i) * 100) + ',' + Math.round(p.getZ(i) * 100);
    if (!map.has(key)) map.set(key, 1 + (rnd() - 0.5) * 2 * amp);
    const f = map.get(key);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  return g;
}

// Jede Baumart besteht aus Teilen: 'fest' (eigene Farben) und 'laub' (Farbe pro Baum über instanceColor)
function baumTeile(art) {
  const r = rng(art.length * 17 + 3);
  const holz = '#6b4a2e', fest = [], laub = [];
  switch (art) {
    case 'laub':
      fest.push(teil(new THREE.CylinderGeometry(0.22, 0.38, 3.8, 7), holz, M4(0, 1.9, 0)));
      fest.push(teil(new THREE.CylinderGeometry(0.08, 0.14, 1.6, 5), holz, M4(0.5, 3.4, 0, 0, 0, -0.7)));
      for (const [x, y, z, s] of [[0, 5, 0, 2.3], [1.2, 4.4, 0.5, 1.6], [-1.1, 4.6, -0.4, 1.7], [0.2, 6.1, -0.3, 1.5], [-0.3, 4.2, 1.2, 1.5]])
        laub.push(teil(knubbel(s, 1, r), '#ffffff', M4(x, y, z), 0.12, r));
      break;
    case 'kirsch':
      fest.push(teil(new THREE.CylinderGeometry(0.16, 0.32, 3, 7), '#4a3326', M4(0, 1.5, 0, 0.1, 0, 0.12)));
      fest.push(teil(new THREE.CylinderGeometry(0.07, 0.12, 2, 5), '#4a3326', M4(-0.6, 2.8, 0, 0, 0, 0.8)));
      for (const [x, y, z, s] of [[0.3, 4, 0, 2.1], [1.4, 3.6, 0.4, 1.4], [-1.4, 3.7, -0.3, 1.5], [0, 4.9, -0.5, 1.4], [-0.4, 3.5, 1.3, 1.3]])
        laub.push(teil(knubbel(s, 1, r), '#ffffff', M4(x, y, z, 0, 0, 0, 1, 0.75, 1), 0.1, r));
      break;
    case 'busch':
      for (const [x, y, z, s] of [[0, 0.6, 0, 1.1], [0.8, 0.45, 0.3, 0.8], [-0.7, 0.5, -0.2, 0.85]])
        laub.push(teil(knubbel(s, 1, r), '#ffffff', M4(x, y, z, 0, 0, 0, 1, 0.8, 1), 0.12, r));
      break;
    case 'tanne':
      fest.push(teil(new THREE.CylinderGeometry(0.15, 0.3, 2.2, 6), holz, M4(0, 1.1, 0)));
      for (const [y, rad, h] of [[2.9, 2.3, 3], [4.5, 1.75, 2.6], [5.9, 1.15, 2.2], [7, 0.6, 1.4]])
        laub.push(teil(new THREE.ConeGeometry(rad, h, 8), '#ffffff', M4(0, y, 0, 0, r() * 2, 0), 0.08, r));
      break;
    case 'kaktus':
      laub.push(teil(new THREE.CylinderGeometry(0.33, 0.38, 3.6, 8), '#ffffff', M4(0, 1.8, 0)));
      laub.push(teil(new THREE.SphereGeometry(0.33, 8, 5, 0, TAU, 0, Math.PI / 2), '#ffffff', M4(0, 3.6, 0)));
      laub.push(teil(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 7), '#ffffff', M4(0.6, 1.6, 0, 0, 0, Math.PI / 2)));
      laub.push(teil(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 7), '#ffffff', M4(1.0, 2.2, 0)));
      laub.push(teil(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 7), '#ffffff', M4(-0.5, 2.2, 0, 0, 0, Math.PI / 2)));
      laub.push(teil(new THREE.CylinderGeometry(0.17, 0.18, 1, 7), '#ffffff', M4(-0.8, 2.7, 0)));
      break;
    case 'palme': {
      let x = 0, y = 0;
      for (let i = 0; i < 6; i++) {
        const a = 0.05 + i * 0.045, l = 1.25;
        fest.push(teil(new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, l, 7), '#8a6a44', M4(x + Math.sin(a) * l / 2, y + Math.cos(a) * l / 2, 0, 0, 0, -a)));
        x += Math.sin(a) * l; y += Math.cos(a) * l;
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        const blatt = new THREE.BoxGeometry(2.6, 0.06, 0.5);
        laub.push(teil(blatt, '#ffffff', new THREE.Matrix4().makeTranslation(x, y, 0).multiply(M4(0, 0, 0, 0, a, -0.35)).multiply(M4(1.3, 0, 0)), 0.1, r));
      }
      fest.push(teil(new THREE.SphereGeometry(0.16, 6, 4), '#5a3c1e', M4(x + 0.2, y - 0.2, 0.15)));
      fest.push(teil(new THREE.SphereGeometry(0.16, 6, 4), '#5a3c1e', M4(x - 0.1, y - 0.25, -0.18)));
      break;
    }
    case 'tot':
      laub.push(teil(new THREE.CylinderGeometry(0.15, 0.34, 5, 6), '#ffffff', M4(0, 2.5, 0)));
      laub.push(teil(new THREE.CylinderGeometry(0.06, 0.12, 2, 5), '#ffffff', M4(0.7, 3.6, 0, 0, 0, -0.9)));
      laub.push(teil(new THREE.CylinderGeometry(0.05, 0.1, 1.6, 5), '#ffffff', M4(-0.6, 4.1, 0.2, 0.2, 0, 0.8)));
      laub.push(teil(new THREE.CylinderGeometry(0.04, 0.08, 1.2, 5), '#ffffff', M4(0.2, 4.6, -0.5, -0.8, 0, 0)));
      break;
    case 'stein':
      laub.push(teil(knubbel(1, 0, r, 0.25), '#ffffff', M4(0, 0.2, 0, 0, 0, 0, 1, 0.7, 1), 0.1, r));
      break;
    case 'schneemann':
      fest.push(teil(new THREE.SphereGeometry(0.62, 12, 9), '#f4f7fb', M4(0, 0.55, 0)));
      fest.push(teil(new THREE.SphereGeometry(0.44, 12, 9), '#f4f7fb', M4(0, 1.35, 0)));
      fest.push(teil(new THREE.SphereGeometry(0.3, 10, 8), '#f4f7fb', M4(0, 1.95, 0)));
      fest.push(teil(new THREE.ConeGeometry(0.06, 0.35, 6), '#ff7a1a', M4(0, 1.95, 0.42, Math.PI / 2, 0, 0)));
      fest.push(teil(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), '#222222', M4(0, 2.3, 0)));
      fest.push(teil(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 12), '#222222', M4(0, 2.16, 0)));
      fest.push(teil(new THREE.TorusGeometry(0.4, 0.06, 5, 12), '#d23a3a', M4(0, 1.6, 0, Math.PI / 2, 0, 0)));
      break;
    case 'laterne':
      fest.push(teil(new THREE.CylinderGeometry(0.28, 0.38, 0.25, 6), '#8f8f88', M4(0, 0.12, 0)));
      fest.push(teil(new THREE.CylinderGeometry(0.11, 0.13, 0.8, 6), '#8f8f88', M4(0, 0.65, 0)));
      fest.push(teil(new THREE.BoxGeometry(0.5, 0.36, 0.5), '#ffd28a', M4(0, 1.22, 0)));
      fest.push(teil(new THREE.ConeGeometry(0.55, 0.38, 4), '#7d7d77', M4(0, 1.58, 0, 0, Math.PI / 4, 0)));
      fest.push(teil(new THREE.SphereGeometry(0.08, 6, 4), '#7d7d77', M4(0, 1.8, 0)));
      break;
    case 'kuh': {
      const w = '#f4f1ea', s = '#2a2420';
      fest.push(teil(new THREE.BoxGeometry(1.5, 0.7, 0.7), w, M4(0, 1.0, 0)));
      fest.push(teil(new THREE.BoxGeometry(0.5, 0.42, 0.72), s, M4(0.2, 1.12, 0)));
      fest.push(teil(new THREE.BoxGeometry(0.45, 0.45, 0.4), w, M4(0.95, 1.25, 0)));
      fest.push(teil(new THREE.BoxGeometry(0.2, 0.2, 0.36), '#e8a8a0', M4(1.2, 1.12, 0)));
      for (const [x, z] of [[0.55, 0.25], [0.55, -0.25], [-0.55, 0.25], [-0.55, -0.25]]) fest.push(teil(new THREE.BoxGeometry(0.16, 0.7, 0.16), w, M4(x, 0.35, z)));
      fest.push(teil(new THREE.ConeGeometry(0.05, 0.2, 5), '#ddd2b0', M4(0.95, 1.55, 0.15)));
      fest.push(teil(new THREE.ConeGeometry(0.05, 0.2, 5), '#ddd2b0', M4(0.95, 1.55, -0.15)));
      break;
    }
  }
  return { fest: fest.length ? verbinde(fest) : null, laub: laub.length ? verbinde(laub) : null };
}

// ---------- Welt einer Bahn ----------
class Welt {
  constructor(kurs, renderer) {
    this.kurs = kurs; this.T = kurs.thema; this.renderer = renderer;
    this.szene = new THREE.Scene();
    this.weg = [];                 // alles zum Aufräumen
    this.anim = [];                // Funktionen (dt, t)
    const T = this.T;
    this.szene.fog = new THREE.Fog(farbe(T.himmel.horizont), T.nebel[0] * 1.5, T.nebel[1] * 1.5);
    this.szene.background = farbeRoh(T.himmel.horizont);
    this.licht();
    this.himmel();
    this.gelaende();
    this.umland();
    this.gewaesser();
    this.baeume();
    this.fahne();
    this.abschlagMarker();
    this.berge();
  }
  merk(o) { this.weg.push(o); return o; }
  licht() {
    const T = this.T, s = T.sonne;
    const dir = new THREE.Vector3(Math.cos(s.richtung) * Math.cos(s.hoehe), Math.sin(s.hoehe), Math.sin(s.richtung) * Math.cos(s.hoehe)).normalize();
    this.sonneDir = dir;
    const sonne = new THREE.DirectionalLight(farbe(s.farbe), s.staerke * 0.52);
    sonne.castShadow = true;
    const q = Einst.grafik === 'hoch' ? 2048 : 1024;
    sonne.shadow.mapSize.set(q, q);
    const cam = sonne.shadow.camera;
    cam.left = -55; cam.right = 55; cam.top = 55; cam.bottom = -55; cam.near = 1; cam.far = 600;
    sonne.shadow.bias = -0.0004; sonne.shadow.normalBias = 0.04;
    this.szene.add(sonne); this.szene.add(sonne.target);
    this.sonne = sonne;
    const hemi = new THREE.HemisphereLight(farbe(T.hemi.oben), farbe(T.hemi.unten), T.hemi.staerke * 0.3);
    this.szene.add(hemi);
  }
  // Schatten folgen dem Bereich, auf den die Kamera schaut
  schattenZiel(x, y, z) {
    const d = this.sonneDir;
    this.sonne.position.set(x + d.x * 250, y + d.y * 250, z + d.z * 250);
    this.sonne.target.position.set(x, y, z);
    this.sonne.target.updateMatrixWorld();
  }
  himmel() {
    const T = this.T;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        oben: { value: farbeRoh(T.himmel.oben) }, hor: { value: farbeRoh(T.himmel.horizont) }, unten: { value: farbeRoh(T.himmel.unten) },
        sDir: { value: this.sonneDir }, sFarbe: { value: farbeRoh(T.himmel.sonne) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }',
      fragmentShader: `uniform vec3 oben; uniform vec3 hor; uniform vec3 unten; uniform vec3 sDir; uniform vec3 sFarbe; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); float h = d.y;
          vec3 c = h > 0.0 ? mix(hor, oben, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, unten, pow(clamp(-h*3.0,0.0,1.0), 0.6));
          float s = max(dot(d, sDir), 0.0);
          c += sFarbe * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const geo = new THREE.SphereGeometry(3000, 32, 16);
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10; sky.frustumCulled = false;
    this.szene.add(sky);
    this.himmelMesh = sky;
    this.merk(geo); this.merk(mat);
    // Umgebungslicht für Spiegelungen (Wasser, Ball): Himmelsverlauf als Panorama-Bild
    this.szene.environment = this.umgebung();
    // Wolken
    const r = rng(this.kurs.seed + 5);
    const wm = new THREE.SpriteMaterial({ map: Tex.wolke, fog: false, transparent: true, depthWrite: false, opacity: this.T.id === 'vulkan' ? 0.5 : 0.85 });
    if (this.T.id === 'vulkan') wm.color = farbe('#9a7070');
    this.merk(wm);
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU, d = 1300 + r() * 900;
      const sp = new THREE.Sprite(wm);
      sp.position.set(Math.cos(a) * d, 220 + r() * 380, Math.sin(a) * d);
      const s = 500 + r() * 700;
      sp.scale.set(s, s * 0.45, 1);
      sp.renderOrder = -9;
      this.szene.add(sp);
    }
  }

  umgebung() {
    const T = this.T, w = 256, h = 128;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, T.himmel.oben); gr.addColorStop(0.45, T.himmel.horizont); gr.addColorStop(0.52, T.f.fern); gr.addColorStop(1, T.f.rough);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const s = T.sonne, sx = ((Math.atan2(Math.sin(s.richtung), Math.cos(s.richtung)) / TAU + 1.25) % 1) * w, sy = (0.5 - s.hoehe / Math.PI) * h;
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 22);
    sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    let env = null;
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      env = pm.fromEquirectangular(tex).texture;
      pm.dispose();
    } catch (e) { env = null; }
    tex.dispose();
    if (env) this.merk(env);
    return env;
  }

  // ---------- Gelände ----------
  gelaendeTextur() {
    const k = this.kurs, T = this.T, tw = k.tw, th = k.th, tr = k.tRes;
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const g = cv.getContext('2d');
    const img = g.createImageData(tw, th), d = img.data;
    const F = {};
    F[U.ROUGH] = rgb(T.f.rough); F[U.FAIRWAY] = rgb(T.f.fairway); F[U.GRUEN] = rgb(T.f.gruen); F[U.VORGRUEN] = rgb(T.f.vorgruen);
    F[U.ABSCHLAG] = rgb(T.f.abschlag); F[U.SAND] = rgb(T.f.sand); F[U.WEG] = rgb(T.f.weg); F[U.WASSER] = rgb(T.f.grund); F[U.LAVA] = rgb('#2a1610');
    F[U.EIS] = rgb(T.f.eis || '#bfe2f2'); F[U.AUS] = F[U.ROUGH];
    const meerSand = rgb(T.f.sand);
    const rs = k.rs, fein = rauschen(k.seed + 11);
    // Hauptrichtung für Mähstreifen
    const ax = k.gruenM.x, az = k.gruenM.z, al = Math.hypot(ax, az) || 1, dx = ax / al, dz = az / al;
    const typ = k.typ;
    // grobes Rauschen vorab auf kleinem Raster
    const cw = Math.ceil(tw / 8) + 2, ch = Math.ceil(th / 8) + 2, grob = new Float32Array(cw * ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const x = k.x0 + i * 8 * tr, z = k.z0 + j * 8 * tr;
      grob[j * cw + i] = rs.fbm(x / 25, z / 25, 3);
    }
    const grobAt = (i, j) => {
      const fx = i / 8, fy = j / 8, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const a = grob[y0 * cw + x0], b = grob[y0 * cw + x0 + 1], c = grob[(y0 + 1) * cw + x0], e = grob[(y0 + 1) * cw + x0 + 1];
      return (a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty;
    };
    const rnd = rng(k.seed + 4);
    for (let j = 0; j < th; j++) {
      const z = k.z0 + (j + 0.5) * tr;
      for (let i = 0; i < tw; i++) {
        const x = k.x0 + (i + 0.5) * tr, q = j * tw + i, t = typ[q];
        let c = F[t] || F[U.ROUGH];
        if (t === U.WASSER && k.meer) c = meerSand;
        let f = 1;
        const gr = grobAt(i, j), n = rnd();
        switch (t) {
          case U.ROUGH: case U.AUS:
            f = 0.82 + gr * 0.36 + (n - 0.5) * 0.12;
            if (T.id === 'winter') f = 0.94 + gr * 0.08 + (n - 0.5) * 0.04;
            break;
          case U.FAIRWAY: {
            const u = x * dx + z * dz, st = (Math.floor(u / 7) & 1) ? 1.06 : 0.95;
            f = st * (0.93 + gr * 0.14) + (n - 0.5) * 0.05;
            break;
          }
          case U.GRUEN: {
            const u = x * dx + z * dz, v = -x * dz + z * dx;
            f = ((Math.floor(u / 3.2) & 1) ? 1.03 : 0.975) * (0.97 + gr * 0.06) + (n - 0.5) * 0.03;
            break;
          }
          case U.ABSCHLAG: { const u = -x * dz + z * dx; f = ((Math.floor(u / 1.4)) & 1 ? 1.05 : 0.96) + (n - 0.5) * 0.04; break; }
          case U.VORGRUEN: f = 0.97 + gr * 0.06 + (n - 0.5) * 0.04; break;
          case U.SAND: {
            f = 0.95 + (n - 0.5) * 0.12 + (fein.n2(x * 1.3, z * 1.3) - 0.5) * 0.1;
            // Rand des Bunkers dunkler
            let rand = 0;
            for (let o = 1; o <= 4; o++) {
              if (typ[q - o] !== U.SAND || typ[q + o] !== U.SAND || typ[q - o * tw] !== U.SAND || typ[q + o * tw] !== U.SAND) { rand = (5 - o) / 4; break; }
            }
            f *= 1 - rand * 0.28;
            break;
          }
          case U.WEG: f = 0.92 + (n - 0.5) * 0.14; break;
          case U.EIS: {
            const riss = Math.abs(fein.n2(x / 2.2, z / 2.2) - 0.5) < 0.012 || Math.abs(fein.n2(x / 5.1 + 9, z / 5.1) - 0.5) < 0.01;
            f = (riss ? 1.12 : 0.95 + gr * 0.1);
            break;
          }
          default: f = 0.9 + (n - 0.5) * 0.1;
        }
        // Übergang Fairway/Grün -> Rough: leichte Schattenkante
        if ((t === U.ROUGH) && i > 2 && j > 2 && i < tw - 3 && j < th - 3) {
          const nb = typ[q - 3] | typ[q + 3] | typ[q - 3 * tw] | typ[q + 3 * tw];
          if (nb !== t && T.id !== 'winter') f *= 0.9;
        }
        const o = q * 4;
        d[o] = clamp(c[0] * f, 0, 255); d[o + 1] = clamp(c[1] * f, 0, 255); d[o + 2] = clamp(c[2] * f, 0, 255); d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Blumen / Laub / Glut als Tupfer im Rough
    const tupfer = { blumen: ['#ffffff', '#ffe14a', '#ff7aa8', '#b48aff'], laub: ['#e07a2a', '#c94a28', '#e8b23a'], glut: ['#ff6a1a', '#ffb02a'], laterne: ['#f3a9c2', '#f7c4d6'] }[T.deko];
    if (tupfer) {
      const tg = g;
      for (let q = 0; q < tw * th / 160; q++) {
        const i = Math.floor(rnd() * tw), j = Math.floor(rnd() * th);
        const t = typ[j * tw + i];
        if (t !== U.ROUGH && !(T.deko === 'laterne' && t === U.FAIRWAY)) continue;
        if (fein.n2(i / 40, j / 40) < 0.45) continue;
        if (T.deko === 'laterne' && rnd() < 0.6) continue;
        tg.fillStyle = tupfer[Math.floor(rnd() * tupfer.length)];
        tg.globalAlpha = T.deko === 'laterne' ? 0.45 : 0.7;
        tg.fillRect(i, j, 1 + rnd(), 1 + rnd());
      }
      tg.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding; tex.flipY = false;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.merk(tex);
    this.texCanvas = cv;
    return tex;
  }
  gelaende() {
    const k = this.kurs, nx = k.nx, nz = k.nz, c = k.zelle, N = nx * nz;
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    const uMax = k.tw * k.tRes, vMax = k.th * k.tRes;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const q = j * nx + i;
      pos[q * 3] = k.x0 + i * c; pos[q * 3 + 1] = k.H[q]; pos[q * 3 + 2] = k.z0 + j * c;
      uv[q * 2] = (i * c) / uMax; uv[q * 2 + 1] = (j * c) / vMax;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let o = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
      idx[o++] = a; idx[o++] = cc; idx[o++] = b;
      idx[o++] = b; idx[o++] = cc; idx[o++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(k.Nn), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const tex = this.gelaendeTextur();
    const mat = mitDetail(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0, envMapIntensity: 0.55 }), new THREE.Vector2(uMax / 2.5, vMax / 2.5));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.szene.add(mesh);
    this.gelaendeMesh = mesh;
    this.merk(geo); this.merk(mat);
  }
  // Grobes Umland ausserhalb der Spielfläche
  umland() {
    const k = this.kurs, T = this.T, c = 9, m = 330;
    const x0 = k.x0 - m, z0 = k.z0 - m, nx = Math.ceil((k.br + 2 * m) / c) + 1, nz = Math.ceil((k.tf + 2 * m) / c) + 1;
    const pos = [], col = [], uv = [], ind = [];
    const cR = farbe(T.f.rough), cF = farbe(T.f.fern), cS = farbe(T.f.sand);
    const innen = (x, z, rand) => x > k.x0 + rand && x < k.x0 + k.br - rand && z > k.z0 + rand && z < k.z0 + k.tf - rand;
    const map = new Int32Array(nx * nz).fill(-1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * c, z = z0 + j * c;
      const a = k.amPfad(x, z);
      let h = k.grundHoehe(x, z, a.d, a.s, a.seite);
      if (innen(x, z, -1)) h = Math.min(h, k.hoehe(x, z)) - 0.6;
      const vi = pos.length / 3;
      map[j * nx + i] = vi;
      pos.push(x, h, z);
      const ferne = clamp((Math.max(Math.abs(x - (k.x0 + k.br / 2)) - k.br / 2, Math.abs(z - (k.z0 + k.tf / 2)) - k.tf / 2)) / 260, 0, 1);
      const n = k.rs.n2(x / 40, z / 40);
      const cc = cR.clone().lerp(cF, ferne * 0.8).multiplyScalar(0.85 + n * 0.3);
      if (h < -6) cc.copy(cS);
      col.push(cc.r, cc.g, cc.b);
      uv.push((x - x0) / 2.5, (z - z0) / 2.5);
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const xa = x0 + i * c, za = z0 + j * c;
      if (innen(xa, za, c) && innen(xa + c, za + c, c)) continue;
      const a = map[j * nx + i], b = map[j * nx + i + 1], cc = map[(j + 1) * nx + i], d = map[(j + 1) * nx + i + 1];
      ind.push(a, cc, b, b, cc, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(ind);
    geo.computeVertexNormals();
    const mat = mitDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), new THREE.Vector2(1, 1));
    // vUv braucht eine map: winzige weisse Textur
    mat.map = this.merk(new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.szene.add(mesh);
    this.merk(geo); this.merk(mat);
  }
  gewaesser() {
    const k = this.kurs, T = this.T;
    for (const t of k.teiche) {
      if (t.art === 'eis') continue;
      let geo, mat;
      if (t.art === 'meer') {
        geo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
      } else {
        geo = new THREE.PlaneGeometry(t.x1 - t.x0 + 4, t.z1 - t.z0 + 4, 1, 1);
      }
      geo.rotateX(-Math.PI / 2);
      if (t.art === 'lava') {
        const map = Tex.lava.clone(); map.needsUpdate = true;
        map.repeat.set((t.x1 - t.x0) / 18, (t.z1 - t.z0) / 18);
        mat = new THREE.MeshStandardMaterial({ color: farbe('#3a1a10'), emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 1.6, roughness: 0.6 });
        this.anim.push((dt, tt) => { map.offset.set(tt * 0.01, Math.sin(tt * 0.2) * 0.03); mat.emissiveIntensity = 1.4 + Math.sin(tt * 1.7) * 0.25; });
        this.merk(map);
      } else {
        const nm = Tex.wellen.clone(); nm.needsUpdate = true;
        const w = t.art === 'meer' ? 6000 : t.x1 - t.x0, h = t.art === 'meer' ? 6000 : t.z1 - t.z0;
        nm.repeat.set(w / 14, h / 14);
        mat = new THREE.MeshStandardMaterial({ color: farbe(T.wasser), roughness: 0.06, metalness: 0.05, transparent: true, opacity: t.art === 'meer' ? 0.92 : 0.84, normalMap: nm, envMapIntensity: 1.2 });
        mat.normalScale.set(0.35, 0.35);
        this.anim.push((dt, tt) => nm.offset.set(tt * 0.012, tt * 0.007));
        this.merk(nm);
      }
      const mesh = new THREE.Mesh(geo, mat);
      if (t.art === 'meer') mesh.position.set(k.x0 + k.br / 2, t.stand, k.z0 + k.tf / 2);
      else mesh.position.set((t.x0 + t.x1) / 2, t.stand, (t.z0 + t.z1) / 2);
      mesh.receiveShadow = t.art !== 'lava';
      this.szene.add(mesh);
      this.merk(geo); this.merk(mat);
      if (t.art === 'lava') {
        const pl = new THREE.PointLight('#ff6a20', 1.6, 60, 2);
        pl.position.set((t.x0 + t.x1) / 2, t.stand + 4, (t.z0 + t.z1) / 2);
        this.szene.add(pl);
      }
    }
  }
  baeume() {
    const k = this.kurs, gruppen = {};
    for (const d of k.deko) (gruppen[d.art] = gruppen[d.art] || []).push(d);
    const matFest = this.merk(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    const matLaub = this.merk(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (const art in gruppen) {
      const liste = gruppen[art], teile = baumTeile(art);
      for (const [geo, mat, mitFarbe] of [[teile.fest, matFest, false], [teile.laub, matLaub, true]]) {
        if (!geo) continue;
        this.merk(geo);
        const im = new THREE.InstancedMesh(geo, mat, liste.length);
        liste.forEach((b, i) => {
          dummy.position.set(b.x, b.y - 0.08, b.z);
          dummy.rotation.set(0, b.rot, 0);
          dummy.scale.setScalar(b.s);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          if (mitFarbe) { col.set(b.farbe || '#888888').convertSRGBToLinear(); im.setColorAt(i, col); }
        });
        im.castShadow = true; im.receiveShadow = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        this.szene.add(im);
      }
      // Schnee auf Tannen
      if (art === 'tanne' && liste.some(b => b.schnee)) {
        const r = rng(4), sg = [];
        for (const [y, rad, h] of [[3.5, 1.9, 1.6], [5.0, 1.4, 1.4], [6.3, 0.95, 1.1], [7.3, 0.45, 0.8]]) sg.push(teil(new THREE.ConeGeometry(rad, h, 8), '#f6f9ff', M4(0, y, 0, 0, r(), 0), 0.03, r));
        const geo = this.merk(verbinde(sg));
        const s = liste.filter(b => b.schnee);
        const im = new THREE.InstancedMesh(geo, matFest, s.length);
        s.forEach((b, i) => { dummy.position.set(b.x, b.y - 0.08, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.setScalar(b.s * 1.02); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.castShadow = true;
        this.szene.add(im);
      }
    }
  }
  fahne() {
    const k = this.kurs, L = k.loch;
    const g = new THREE.Group();
    g.position.set(L.x, L.y, L.z);
    // Loch: dunkle Scheibe mit weissem Rand
    const hb = { h: 0, nx: 0, ny: 1, nz: 0 }; k.hoehe(L.x, L.z, hb);
    const loch = new THREE.Group();
    const scheibe = new THREE.Mesh(this.merk(new THREE.CircleGeometry(PH.R_LOCH, 24)), this.merk(new THREE.MeshBasicMaterial({ color: farbe('#0b0d0a'), polygonOffset: true, polygonOffsetFactor: -4 })));
    const rand = new THREE.Mesh(this.merk(new THREE.RingGeometry(PH.R_LOCH * 0.92, PH.R_LOCH * 1.08, 24)), this.merk(new THREE.MeshStandardMaterial({ color: '#f2f2f2', polygonOffset: true, polygonOffsetFactor: -4 })));
    scheibe.rotation.x = rand.rotation.x = -Math.PI / 2;
    loch.add(scheibe, rand);
    loch.position.y = 0.006;
    loch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hb.nx, hb.ny, hb.nz));
    g.add(loch);
    // Stange
    const stange = new THREE.Mesh(this.merk(new THREE.CylinderGeometry(0.014, 0.014, PH.H_FAHNE, 8)), this.merk(new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 })));
    stange.position.y = PH.H_FAHNE / 2; stange.castShadow = true;
    g.add(stange);
    // Fahne mit Wellen
    const fg = this.merk(new THREE.PlaneGeometry(0.6, 0.4, 12, 6));
    fg.translate(0.3, 0, 0);
    const fm = this.merk(new THREE.MeshStandardMaterial({ color: farbe(this.T.id === 'vulkan' ? '#ffd23a' : this.T.id === 'kirsch' ? '#d81e3c' : '#ff3b2f'), side: THREE.DoubleSide, roughness: 0.7 }));
    const flagge = new THREE.Mesh(fg, fm);
    flagge.position.y = PH.H_FAHNE - 0.22; flagge.castShadow = true;
    g.add(flagge);
    const basis = fg.attributes.position.array.slice();
    const wind = k.wind, wa = Math.atan2(wind.z, wind.x), ws = Math.max(1.5, k.windStaerke);
    flagge.rotation.y = -wa;
    this.anim.push((dt, t) => {
      const p = fg.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const x = basis[i];
        p[i + 2] = Math.sin(x * 9 - t * (3 + ws)) * 0.05 * x * 2.4 + Math.sin(x * 5 - t * 2.3) * 0.02 * x;
      }
      fg.attributes.position.needsUpdate = true;
      fg.computeVertexNormals();
      flagge.rotation.y = -wa + Math.sin(t * 0.9) * 0.15;
    });
    this.szene.add(g);
    this.fahneGruppe = g;
  }
  abschlagMarker() {
    const k = this.kurs, d = k.richtungBei(3);
    const geo = this.merk(new THREE.SphereGeometry(0.09, 12, 8)), mat = this.merk(new THREE.MeshStandardMaterial({ color: farbe('#2a6cff'), roughness: 0.3 }));
    for (const s of [-1, 1]) {
      const x = k.start.x - d.z * 3 * s - d.x * 0.5, z = k.start.z + d.x * 3 * s - d.z * 0.5;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, k.hoehe(x, z) + 0.07, z); m.castShadow = true;
      this.szene.add(m);
    }
  }
  berge() {
    const T = this.T, k = this.kurs, B = T.berge, r = rng(k.seed + 9), rs = rauschen(k.seed + 21);
    const seg = 160, R = 2000, pos = [], col = [], ind = [];
    const cx = k.x0 + k.br / 2, cz = k.z0 + k.tf / 2;
    const hor = farbe(T.himmel.horizont), basis = farbe(B.farbe).lerp(hor, 0.35), weiss = farbe('#ffffff').lerp(hor, 0.2);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU;
      let h = B.hoehe * (0.35 + 0.65 * rs.fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5, 4));
      h *= 0.6 + 0.8 * Math.pow(rs.n2(a * 2.5, 1.7), 2);
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      pos.push(x, -30, z, x, h, z);
      col.push(basis.r, basis.g, basis.b);
      const top = B.schnee && h > B.hoehe * 0.55 ? weiss : basis.clone().multiplyScalar(1.08);
      col.push(top.r, top.g, top.b);
      if (i < seg) { const o = i * 2; ind.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const geo = this.merk(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(ind);
    const mat = this.merk(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -8;
    this.szene.add(m);
    // Besondere Kulissen
    if (B.vulkan) {
      const vg = this.merk(new THREE.CylinderGeometry(90, 520, 430, 24, 1, true));
      const vm = this.merk(new THREE.MeshBasicMaterial({ color: farbe('#2a1f1f').lerp(hor, 0.25), fog: false }));
      const v = new THREE.Mesh(vg, vm);
      const a = r() * TAU;
      v.position.set(cx + Math.cos(a) * 1500, 180, cz + Math.sin(a) * 1500);
      this.szene.add(v);
      const glut = new THREE.Sprite(this.merk(new THREE.SpriteMaterial({ map: Tex.wolke, color: '#ff7a2a', fog: false, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })));
      glut.position.set(v.position.x, 420, v.position.z); glut.scale.set(420, 200, 1);
      this.szene.add(glut);
    }
    if (T.deko === 'leuchtturm') {
      const lg = new THREE.Group();
      const ring = (y, h, rr, c) => { const mm = new THREE.Mesh(this.merk(new THREE.CylinderGeometry(rr * 0.85, rr, h, 14)), this.merk(new THREE.MeshStandardMaterial({ color: farbe(c) }))); mm.position.y = y + h / 2; mm.castShadow = true; lg.add(mm); };
      for (let i = 0; i < 5; i++) ring(i * 4, 4, 2.6 - i * 0.25, i % 2 ? '#d8352a' : '#f6f6f6');
      ring(20, 2.6, 1.6, '#ffe9a0');
      ring(22.6, 1.5, 1.9, '#333333');
      const sei = k.meer ? k.meer.seite : 1, d = k.richtungBei(k.laenge * 0.6), p = k.punktBei(k.laenge * 0.6);
      const off = (k.meer ? k.meer.abst : 60) + 4;
      const x = p.x - d.z * off * sei, z = p.z + d.x * off * sei;
      lg.position.set(x, k.hoehe(x, z), z);
      this.szene.add(lg);
    }
    if (T.deko === 'mesa') {
      const mg = this.merk(new THREE.CylinderGeometry(70, 95, 110, 9));
      const mm = this.merk(new THREE.MeshStandardMaterial({ color: farbe('#b5703f'), flatShading: true }));
      for (let i = 0; i < 4; i++) {
        const a = r() * TAU, d = 650 + r() * 400;
        const me = new THREE.Mesh(mg, mm);
        me.position.set(cx + Math.cos(a) * d, 30, cz + Math.sin(a) * d);
        me.scale.set(0.6 + r(), 0.5 + r() * 0.8, 0.6 + r());
        this.szene.add(me);
      }
    }
  }
  update(dt, t) { for (const f of this.anim) f(dt, t); }
  entsorgen() {
    for (const o of this.weg) { try { o.dispose(); } catch (e) { } }
    this.szene.traverse(o => { if (o.isInstancedMesh) { try { o.dispose(); } catch (e) { } } });
  }
}
