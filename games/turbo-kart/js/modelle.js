// Turbo-Kart – Texturen, Figuren, Karts, Items und Symbole (alles aus Code gebaut, keine Bilddateien)
'use strict';

// ---------- Texturen aus Canvas ----------
const Tex = {
  cache: {},
  canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; },
  aus(c, rep) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  },
  holen(key, fn) { return this.cache[key] || (this.cache[key] = fn()); },
  rauschen(g, w, h, farben, n, smin, smax, R) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = farben[(R() * farben.length) | 0];
      const s = smin + R() * (smax - smin);
      g.globalAlpha = 0.25 + R() * 0.5;
      g.fillRect(R() * w, R() * h, s, s);
    }
    g.globalAlpha = 1;
  },
  flecken(g, w, h, farben, n, rmin, rmax, R, alpha = 0.18) {
    for (let i = 0; i < n; i++) {
      const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const f = farben[(R() * farben.length) | 0];
      gr.addColorStop(0, f); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha; g.fillStyle = gr;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    g.globalAlpha = 1;
  },
  strasse(stil) {
    return this.holen('strasse-' + stil, () => {
      const R = rng(11);
      const c = this.canvas(256, 256, (g, w, h) => {
        const S = {
          asphalt: ['#5a5d66', ['#4a4d55', '#6b6e78', '#53565e', '#777a84'], '#f4f4f4'],
          sand: ['#9a6a44', ['#8a5c3a', '#a8784e', '#7f5434', '#b08058'], '#fff3d6'],
          schnee: ['#5e6b82', ['#566279', '#68758c', '#7a879c', '#e8eef8'], '#ffffff'],
          stadt: ['#3c3f48', ['#33363e', '#474a54', '#2c2e35'], '#ffd94a'],
          burg: ['#6e6460', ['#5d5450', '#7d7370', '#665c58'], '#ffcf6b'],
          dschungel: ['#7a6248', ['#6a5440', '#8a7056', '#5f4b39'], '#f6e7c4'],
        }[stil] || ['#5a5d66', ['#4a4d55', '#6b6e78'], '#fff'];
        g.fillStyle = S[0]; g.fillRect(0, 0, w, h);
        this.flecken(g, w, h, S[1], 40, 20, 60, R, 0.22);
        this.rauschen(g, w, h, S[1], 2600, 1, 1.6, R);
        if (stil === 'burg') {
          g.strokeStyle = 'rgba(40,30,28,.5)'; g.lineWidth = 2;
          for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 32 % 2) * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
        }
        // Randlinien
        g.fillStyle = S[2];
        g.fillRect(6, 0, 6, h); g.fillRect(w - 12, 0, 6, h);
        if (stil === 'stadt') { for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y, 6, 36); }
      });
      return this.aus(c);
    });
  },
  regenbogen() {
    return this.holen('regenbogen', () => {
      const c = this.canvas(256, 256, (g, w, h) => {
        const cols = ['#ff3d6e', '#ff8a3d', '#ffe23d', '#4dff6a', '#3dd8ff', '#5a6bff', '#c33dff'];
        for (let i = 0; i < cols.length; i++) { g.fillStyle = cols[i]; g.fillRect(i * w / cols.length, 0, w / cols.length + 1, h); }
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.35)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const R = rng(5);
        for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + R() * 0.7) + ')'; const s = R() * 3 + 1; g.fillRect(R() * w, R() * h, s, s); }
        g.fillStyle = '#fff'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
      });
      return this.aus(c);
    });
  },
  randstein(a = '#e8322f', b = '#ffffff') {
    return this.holen('rand' + a + b, () => this.aus(this.canvas(64, 64, (g, w, h) => {
      g.fillStyle = a; g.fillRect(0, 0, w, h / 2); g.fillStyle = b; g.fillRect(0, h / 2, w, h / 2);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 6, h);
    })));
  },
  boden(stil) {
    return this.holen('boden-' + stil, () => {
      const R = rng(hashStr(stil));
      const S = {
        gras: ['#4fae3a', ['#3f9a2e', '#5dbf45', '#468f33', '#6acb4f'], ['#2f7d24', '#7bd75a']],
        sand: ['#e6c78c', ['#d9b679', '#f0d49b', '#cfa96a'], ['#c99d5c', '#f7e0ad']],
        schnee: ['#eef4fb', ['#dfe9f5', '#ffffff', '#d5e1ef'], ['#c8d6e8', '#ffffff']],
        stadt: ['#2a2d33', ['#24272c', '#30343a', '#1f2126'], ['#1a1c20', '#383c43']],
        lava: ['#3a1d14', ['#2c140e', '#4a2418', '#22100b'], ['#5a2a16', '#1a0b07']],
        dschungel: ['#3f8f2f', ['#347a27', '#4ea13a', '#2c6b21'], ['#25591c', '#5bb544']],
        erde: ['#8a6a48', ['#7a5c3e', '#9a7a56'], ['#6a4e33', '#a8886a']],
        mond: ['#9a9aa8', ['#8a8a98', '#a8a8b6', '#7c7c8a'], ['#6e6e7c', '#b4b4c2']],
      }[stil] || ['#4fae3a', ['#3f9a2e'], ['#2f7d24']];
      const c = this.canvas(256, 256, (g, w, h) => {
        g.fillStyle = S[0]; g.fillRect(0, 0, w, h);
        this.flecken(g, w, h, S[2], 30, 20, 70, R, 0.3);
        this.rauschen(g, w, h, S[1], 6000, 1, 3, R);
        if (stil === 'gras' || stil === 'dschungel') {
          for (let i = 0; i < 900; i++) {
            g.strokeStyle = S[1][(R() * S[1].length) | 0]; g.globalAlpha = 0.6; g.lineWidth = 1;
            const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 2 - 1, y - 3 - R() * 4); g.stroke();
          }
          g.globalAlpha = 1;
        }
        if (stil === 'mond') {
          for (let i = 0; i < 14; i++) {
            const x = R() * w, y = R() * h, r = 4 + R() * 16;
            g.strokeStyle = 'rgba(60,60,70,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
            g.fillStyle = 'rgba(70,70,80,.2)'; g.fill();
          }
        }
      });
      return this.aus(c);
    });
  },
  lava() {
    return this.holen('lava', () => this.aus(this.canvas(256, 256, (g, w, h) => {
      const R = rng(7);
      g.fillStyle = '#ff5a00'; g.fillRect(0, 0, w, h);
      this.flecken(g, w, h, ['#ffd23a', '#ffae00'], 30, 10, 40, R, 0.6);
      this.flecken(g, w, h, ['#a01800', '#5a0a00'], 40, 15, 50, R, 0.55);
    })));
  },
  wasser() {
    return this.holen('wasser', () => this.aus(this.canvas(256, 256, (g, w, h) => {
      const R = rng(9);
      g.fillStyle = '#0f7fa8'; g.fillRect(0, 0, w, h);
      this.flecken(g, w, h, ['#3ab8d8', '#0a6488', '#5fd0e8'], 50, 10, 40, R, 0.35);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4, x + 16, y); g.stroke(); }
    })));
  },
  zielflagge() {
    return this.holen('ziel', () => this.aus(this.canvas(64, 64, (g, w, h) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
    })));
  },
  turbo() {
    return this.holen('turbo', () => this.aus(this.canvas(64, 128, (g, w, h) => {
      g.fillStyle = '#ff8a00'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2; k++) {
        const y0 = k * 64;
        const gr = g.createLinearGradient(0, y0 + 60, 0, y0 + 4);
        gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#ffd000');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(8, y0 + 56); g.lineTo(32, y0 + 22); g.lineTo(56, y0 + 56); g.lineTo(44, y0 + 56); g.lineTo(32, y0 + 38); g.lineTo(20, y0 + 56); g.fill();
      }
      g.strokeStyle = '#c24d00'; g.lineWidth = 4; g.strokeRect(2, -2, w - 4, h + 4);
    })));
  },
  wand(stil) {
    return this.holen('wand-' + stil, () => {
      const R = rng(hashStr(stil) + 3);
      return this.aus(this.canvas(128, 64, (g, w, h) => {
        if (stil === 'bande') {
          for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2f6fe0'; g.fillRect(i * 32, 0, 32, h); }
          g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 8, w, 8); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, 0, w, 4);
        } else if (stil === 'fels') {
          g.fillStyle = '#b8743f'; g.fillRect(0, 0, w, h);
          this.flecken(g, w, h, ['#8e5530', '#d4925a', '#a8653a'], 30, 6, 22, R, 0.5);
          g.strokeStyle = 'rgba(80,40,20,.4)'; g.lineWidth = 2;
          for (let y = 8; y < h; y += 14) { g.beginPath(); g.moveTo(0, y + R() * 4); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + R() * 5); g.stroke(); }
        } else if (stil === 'schnee') {
          const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c8d8ee');
          g.fillStyle = gr; g.fillRect(0, 0, w, h); this.rauschen(g, w, h, ['#dfe9f7', '#b8cae2', '#ffffff'], 900, 1, 2.5, R);
        } else if (stil === 'beton') {
          g.fillStyle = '#9ea3ad'; g.fillRect(0, 0, w, h); this.rauschen(g, w, h, ['#8a8f99', '#b1b6bf'], 800, 1, 2, R);
          for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffd23a' : '#222'; g.save(); g.translate(i * 32, 0); g.transform(1, 0, -0.6, 1, 0, 0); g.fillRect(0, h - 14, 22, 14); g.restore(); }
        } else if (stil === 'burg') {
          g.fillStyle = '#5b5560'; g.fillRect(0, 0, w, h);
          g.strokeStyle = 'rgba(25,20,30,.6)'; g.lineWidth = 2;
          for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 16 % 2) * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
          this.rauschen(g, w, h, ['#6b6570', '#4a4450'], 600, 1, 3, R);
        } else if (stil === 'holz') {
          g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#8a5c32' : '#a87446'; g.fillRect(i * 16, 0, 15, h); }
          g.fillStyle = '#5a3a1e'; g.fillRect(0, 10, w, 4); g.fillRect(0, h - 14, w, 4);
        } else {
          g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h);
        }
      }));
    });
  },
  fragezeichen(umgekehrt) {
    return this.holen('frage' + (umgekehrt ? 'u' : ''), () => {
      const c = this.canvas(128, 128, (g, w, h) => {
        g.translate(w / 2, h / 2); if (umgekehrt) g.rotate(Math.PI);
        g.font = '900 104px "Lilita One", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = 'rgba(120,60,0,.9)'; g.strokeText('?', 0, 6);
        const gr = g.createLinearGradient(0, -50, 0, 50); gr.addColorStop(0, '#fff8c0'); gr.addColorStop(1, '#ffc400');
        g.fillStyle = gr; g.fillText('?', 0, 6);
      });
      const t = new THREE.CanvasTexture(c); return t;
    });
  },
  punkt() {
    return this.holen('punkt', () => {
      const c = this.canvas(64, 64, (g, w, h) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      return new THREE.CanvasTexture(c);
    });
  },
  wolke() {
    return this.holen('wolke', () => {
      const R = rng(21);
      const c = this.canvas(256, 128, (g, w, h) => {
        for (let i = 0; i < 26; i++) {
          const x = 40 + R() * 176, y = 50 + R() * 40, r = 18 + R() * 30;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
      });
      return new THREE.CanvasTexture(c);
    });
  },
  streifen(farbe, hint) {
    return this.holen('streifen' + farbe + hint, () => this.aus(this.canvas(128, 128, (g, w, h) => {
      g.fillStyle = hint; g.fillRect(0, 0, w, h);
      g.fillStyle = farbe;
      const R = rng(4);
      for (let i = 0; i < 7; i++) {
        const x = i * 19 + R() * 6;
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 10, h / 2, x - 2, h); g.lineTo(x + 8, h); g.quadraticCurveTo(x + 18, h / 2, x + 9, 0); g.fill();
      }
    })));
  },
  fenster(farbe) {
    return this.holen('fenster' + farbe, () => this.aus(this.canvas(64, 128, (g, w, h) => {
      g.fillStyle = farbe; g.fillRect(0, 0, w, h);
      const R = rng(hashStr(farbe));
      for (let y = 6; y < h - 4; y += 12) for (let x = 5; x < w - 4; x += 14) {
        const an = R() < 0.55;
        g.fillStyle = an ? (R() < 0.5 ? '#ffe9a0' : '#9fe3ff') : 'rgba(0,0,0,.45)';
        g.fillRect(x, y, 8, 7);
      }
    })));
  },
};

// ---------- Materialien ----------
const Mat = {
  cache: {},
  std(farbe, o = {}) {
    const k = 's' + farbe + JSON.stringify(o);
    if (this.cache[k]) return this.cache[k];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(farbe), roughness: 0.5, metalness: 0.05 }, o));
    return (this.cache[k] = m);
  },
  lam(farbe, o = {}) {
    const k = 'l' + farbe + JSON.stringify(o);
    if (this.cache[k]) return this.cache[k];
    // r128: Lambert kennt kein flatShading, dafür Phong ohne Glanz
    if (o.flatShading) return (this.cache[k] = new THREE.MeshPhongMaterial(Object.assign({ color: new THREE.Color(farbe), shininess: 0, specular: new THREE.Color('#000000') }, o)));
    return (this.cache[k] = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(farbe) }, o)));
  },
  glanz(farbe) { return this.std(farbe, { roughness: 0.25, metalness: 0.15 }); },
  chrom() { return this.std('#d8dde6', { roughness: 0.18, metalness: 0.9 }); },
  gummi() { return this.std('#1d1d22', { roughness: 0.85 }); },
  leucht(farbe, st = 1) { return this.std(farbe, { emissive: new THREE.Color(farbe), emissiveIntensity: st, roughness: 0.4 }); },
};

// Hilfsfunktion: Mesh erstellen und platzieren
function M(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
const G = {
  cache: {},
  kugel(r = 1, ws = 20, hs = 14) { const k = 'k' + r + ws + hs; return this.cache[k] || (this.cache[k] = new THREE.SphereGeometry(r, ws, hs)); },
  box(x, y, z) { const k = 'b' + x + y + z; return this.cache[k] || (this.cache[k] = new THREE.BoxGeometry(x, y, z)); },
  zyl(rt, rb, h, s = 16) { const k = 'z' + rt + rb + h + s; return this.cache[k] || (this.cache[k] = new THREE.CylinderGeometry(rt, rb, h, s)); },
  kegel(r, h, s = 12) { const k = 'c' + r + h + s; return this.cache[k] || (this.cache[k] = new THREE.ConeGeometry(r, h, s)); },
  torus(r, t, a = TAU, rs = 10, ts = 20) { const k = 't' + r + t + a + rs + ts; return this.cache[k] || (this.cache[k] = new THREE.TorusGeometry(r, t, rs, ts, a)); },
  rund(w, h, d, r) {
    const k = 'r' + w + h + d + r;
    if (this.cache[k]) return this.cache[k];
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: Math.min(0.08, r * 0.6), bevelSize: Math.min(0.08, r * 0.6), bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -d / 2);
    return (this.cache[k] = g);
  },
};

// ---------- Figuren ----------
// Klassen: Gewicht bestimmt Grundwerte, jede Figur hat kleine Abweichungen
const KLASSEN = {
  leicht: { tempo: 2.75, beschl: 4.25, handling: 4.25, gewicht: 1.75 },
  mittel: { tempo: 3.5, beschl: 3.25, handling: 3.25, gewicht: 3.0 },
  schwer: { tempo: 4.25, beschl: 2.5, handling: 2.5, gewicht: 4.25 },
};
const FIGUREN = [
  { id: 'fredi', name: 'Fredi', art: 'Fuchs', klasse: 'mittel', f1: '#ff7a1f', f2: '#2fa35a', haut: '#ff7a1f', bauch: '#fff3e2' },
  { id: 'mira', name: 'Mira', art: 'Katze', klasse: 'leicht', f1: '#c88cff', f2: '#ff6fae', haut: '#b98ae6', bauch: '#f6e8ff' },
  { id: 'bruno', name: 'Bruno', art: 'Bär', klasse: 'schwer', f1: '#a0603a', f2: '#e23b3b', haut: '#9a5f3a', bauch: '#e8c49a' },
  { id: 'pino', name: 'Pino', art: 'Pinguin', klasse: 'leicht', f1: '#2f4bd8', f2: '#ffcf33', haut: '#22252e', bauch: '#ffffff' },
  { id: 'robo', name: 'Robo R7', art: 'Roboter', klasse: 'mittel', f1: '#8fa3b8', f2: '#22d3ee', haut: '#b9c6d4', bauch: '#58687a' },
  { id: 'hoppel', name: 'Hoppel', art: 'Hase', klasse: 'leicht', f1: '#ff9ec7', f2: '#7ad7ff', haut: '#f7f3f0', bauch: '#ffd6e6' },
  { id: 'draki', name: 'Draki', art: 'Drache', klasse: 'schwer', f1: '#2fbf5a', f2: '#ffb300', haut: '#35b856', bauch: '#ffe08a' },
  { id: 'quaki', name: 'Quaki', art: 'Frosch', klasse: 'leicht', f1: '#7ed957', f2: '#ff5d5d', haut: '#7ed957', bauch: '#e9ffd0' },
  { id: 'luna', name: 'Luna', art: 'Eule', klasse: 'mittel', f1: '#6a4fc9', f2: '#ffd54a', haut: '#7d64d6', bauch: '#e6dcff' },
  { id: 'gorbo', name: 'Gorbo', art: 'Gorilla', klasse: 'schwer', f1: '#3c3f4a', f2: '#ff8c1a', haut: '#3a3d47', bauch: '#c9a68a' },
  { id: 'kiki', name: 'Kiki', art: 'Koala', klasse: 'mittel', f1: '#9aa6b2', f2: '#38c172', haut: '#9aa6b2', bauch: '#eef2f6' },
  { id: 'tiko', name: 'Tiko', art: 'Tiger', klasse: 'schwer', f1: '#ff9a1f', f2: '#1f6fe0', haut: '#ff9a1f', bauch: '#fff6e6' },
];
FIGUREN.forEach((f, i) => {
  const k = KLASSEN[f.klasse];
  const R = rng(i * 97 + 5);
  const j = () => (R() < 0.5 ? -0.25 : 0.25) * (R() < 0.5 ? 0 : 1);
  f.stat = { tempo: k.tempo + j(), beschl: k.beschl + j(), handling: k.handling + j(), gewicht: k.gewicht };
  f.idx = i;
});

const KARTS = [
  { id: 'standard', name: 'Standard', mod: { tempo: 0, beschl: 0, handling: 0, gewicht: 0, gelaende: 0 } },
  { id: 'flitzer', name: 'Flitzer', mod: { tempo: 0.5, beschl: -0.5, handling: 0.5, gewicht: -0.5, gelaende: -0.25 } },
  { id: 'buggy', name: 'Buggy', mod: { tempo: -0.5, beschl: 0.75, handling: 0, gewicht: 0, gelaende: 1 } },
  { id: 'brummer', name: 'Brummer', mod: { tempo: 0.75, beschl: -0.5, handling: -0.5, gewicht: 1, gelaende: 0 } },
];
function werte(fi, ki) {
  const s = FIGUREN[fi].stat, m = KARTS[ki].mod;
  return {
    tempo: clamp(s.tempo + m.tempo, 1, 5.5), beschl: clamp(s.beschl + m.beschl, 1, 5.5),
    handling: clamp(s.handling + m.handling, 1, 5.5), gewicht: clamp(s.gewicht + m.gewicht, 1, 5.5), gelaende: m.gelaende,
  };
}

function auge(mat, x, y, z, s = 1, gruppe) {
  const w = M(G.kugel(0.11, 14, 10), Mat.std('#ffffff', { roughness: 0.2 }), x, y, z, 0, 0, 0, s, s * 1.25, s * 0.6);
  const p = M(G.kugel(0.065, 12, 8), mat || Mat.std('#141418', { roughness: 0.15 }), x, y, z + 0.06 * s, 0, 0, 0, s, s * 1.2, s * 0.5);
  const l = M(G.kugel(0.022, 8, 6), Mat.std('#ffffff', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.6 }), x + 0.025 * s, y + 0.04 * s, z + 0.09 * s);
  w.castShadow = p.castShadow = l.castShadow = false;
  gruppe.add(w, p, l);
}

// Baut die Figur (sitzend), Ursprung = Sitzfläche. Gibt { gruppe, kopf, armL, armR } zurück.
function baueFigur(fi) {
  const f = FIGUREN[fi];
  const g = new THREE.Group();
  const haut = Mat.std(f.haut, { roughness: 0.65 });
  const bauch = Mat.std(f.bauch, { roughness: 0.7 });
  const kleid = Mat.std(f.f1, { roughness: 0.55 });
  const kleid2 = Mat.std(f.f2, { roughness: 0.5 });
  const dunkel = Mat.std('#141418', { roughness: 0.4 });
  // Körper
  const koerper = M(G.kugel(0.36, 18, 12), f.art === 'Roboter' ? Mat.std(f.f1, { roughness: 0.3, metalness: 0.6 }) : kleid, 0, 0.36, 0, 0, 0, 0, 1, 1.05, 0.9);
  g.add(koerper);
  const brust = M(G.kugel(0.3, 16, 10), bauch, 0, 0.36, 0.1, 0, 0, 0, 0.85, 0.95, 0.75);
  g.add(brust);
  // Arme (zeigen zum Lenkrad)
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [a, s] of [[armL, 1], [armR, -1]]) {
    a.position.set(0.3 * s, 0.52, 0.02);
    const ob = M(G.zyl(0.085, 0.075, 0.42, 10), f.art === 'Roboter' ? Mat.chrom() : kleid, 0, 0, 0.17, Math.PI / 2 - 0.35, 0, 0);
    const hand = M(G.kugel(0.1, 12, 8), f.art === 'Roboter' ? Mat.std('#5c6b7c', { metalness: 0.6, roughness: 0.3 }) : (f.art === 'Pinguin' ? Mat.std('#22252e') : Mat.std('#ffffff', { roughness: 0.6 })), 0, -0.07, 0.38);
    a.add(ob, hand); a.rotation.y = -0.25 * s;
    g.add(a);
  }
  // Kopf
  const kopf = new THREE.Group();
  kopf.position.set(0, 0.95, 0);
  g.add(kopf);
  const kr = 0.42;
  let kopfMat = haut;
  if (f.art === 'Tiger') kopfMat = new THREE.MeshStandardMaterial({ map: Tex.streifen('#2a1a10', f.haut), roughness: 0.6 });
  if (f.art === 'Roboter') kopfMat = Mat.std(f.haut, { roughness: 0.25, metalness: 0.7 });
  const kopfK = M(f.art === 'Roboter' ? G.rund(0.78, 0.68, 0.66, 0.16) : G.kugel(kr, 24, 18), kopfMat, 0, 0, 0);
  if (f.art !== 'Roboter') kopfK.scale.set(1.05, 0.98, 0.98);
  kopf.add(kopfK);
  const ex = 0.15, ey = 0.06, ez = 0.36;
  switch (f.art) {
    case 'Fuchs':
    case 'Katze':
    case 'Tiger': {
      const spitz = f.art !== 'Tiger';
      for (const s of [1, -1]) {
        const ohr = spitz ? M(G.kegel(0.15, 0.32, 4), haut, 0.25 * s, 0.38, -0.02, 0, Math.PI / 4, -0.35 * s) : M(G.kugel(0.13, 12, 8), haut, 0.3 * s, 0.34, -0.03, 0, 0, 0, 1, 1, 0.6);
        const inn = spitz ? M(G.kegel(0.08, 0.2, 4), Mat.std('#ffc2d6'), 0.24 * s, 0.36, 0.03, 0, Math.PI / 4, -0.35 * s) : M(G.kugel(0.07, 10, 8), Mat.std('#ffc2d6'), 0.3 * s, 0.34, 0.03, 0, 0, 0, 1, 1, 0.5);
        kopf.add(ohr, inn);
      }
      const schnauze = M(G.kugel(0.2, 16, 12), bauch, 0, -0.1, 0.32, 0, 0, 0, f.art === 'Fuchs' ? 1.1 : 1.2, 0.75, f.art === 'Fuchs' ? 1.1 : 0.8);
      const nase = M(G.kugel(0.06, 10, 8), Mat.std(f.art === 'Katze' ? '#ff6fa8' : '#1a1a1f', { roughness: 0.2 }), 0, -0.04, f.art === 'Fuchs' ? 0.53 : 0.47);
      kopf.add(schnauze, nase);
      auge(null, ex, ey, ez, 1, kopf); auge(null, -ex, ey, ez, 1, kopf);
      if (f.art === 'Katze') {
        const schleife = new THREE.Group();
        schleife.add(M(G.kegel(0.1, 0.18, 4), kleid2, 0.09, 0, 0, 0, 0, Math.PI / 2), M(G.kegel(0.1, 0.18, 4), kleid2, -0.09, 0, 0, 0, 0, -Math.PI / 2), M(G.kugel(0.05), kleid2));
        schleife.position.set(-0.22, 0.36, 0.1); schleife.rotation.z = 0.4; kopf.add(schleife);
        for (const s of [1, -1]) for (const dy of [-0.02, -0.08]) kopf.add(M(G.box(0.22, 0.012, 0.012), dunkel, 0.28 * s, dy - 0.06, 0.38, 0, 0, s * (dy + 0.05) * 2));
      }
      if (f.art === 'Fuchs') {
        const schal = M(G.torus(0.3, 0.08, TAU, 8, 20), kleid2, 0, 0.66, 0, Math.PI / 2, 0, 0);
        g.add(schal);
        const schwanz = M(G.kugel(0.18, 12, 10), haut, 0, 0.25, -0.42, -0.6, 0, 0, 0.9, 0.9, 1.8);
        const spitze = M(G.kugel(0.12, 10, 8), bauch, 0, 0.42, -0.66, 0, 0, 0, 1, 1, 1);
        g.add(schwanz, spitze);
      }
      if (f.art === 'Tiger') {
        const stirn = M(G.box(0.05, 0.14, 0.02), dunkel, 0, 0.3, 0.37, -0.3, 0, 0);
        kopf.add(stirn);
      }
      break;
    }
    case 'Bär':
    case 'Koala':
    case 'Gorilla': {
      const gross = f.art === 'Koala' ? 0.2 : 0.13;
      for (const s of [1, -1]) {
        kopf.add(M(G.kugel(gross, 14, 10), haut, (f.art === 'Koala' ? 0.36 : 0.3) * s, 0.3, -0.02, 0, 0, 0, 1, 1, 0.55));
        kopf.add(M(G.kugel(gross * 0.6, 10, 8), bauch, (f.art === 'Koala' ? 0.36 : 0.3) * s, 0.3, 0.04, 0, 0, 0, 1, 1, 0.4));
      }
      if (f.art === 'Gorilla') {
        kopf.add(M(G.kugel(0.3, 16, 12), bauch, 0, -0.06, 0.25, 0, 0, 0, 1.1, 0.85, 0.7));
        kopf.add(M(G.box(0.5, 0.08, 0.2), haut, 0, 0.16, 0.32));
        auge(null, 0.12, 0.08, 0.38, 0.9, kopf); auge(null, -0.12, 0.08, 0.38, 0.9, kopf);
        kopf.add(M(G.kugel(0.035), dunkel, 0.05, -0.02, 0.48), M(G.kugel(0.035), dunkel, -0.05, -0.02, 0.48));
        const kr2 = M(G.box(0.14, 0.4, 0.04), kleid2, 0, 0.42, 0.28, 0.2, 0, 0);
        g.add(kr2);
      } else {
        const sn = M(G.kugel(0.18, 14, 10), bauch, 0, -0.1, 0.32, 0, 0, 0, 1.1, 0.8, 0.85);
        kopf.add(sn);
        const nase = f.art === 'Koala' ? M(G.kugel(0.1, 12, 10), dunkel, 0, -0.02, 0.45, 0, 0, 0, 0.9, 1.3, 0.8) : M(G.kugel(0.07, 10, 8), dunkel, 0, -0.03, 0.48, 0, 0, 0, 1.2, 0.9, 1);
        kopf.add(nase);
        auge(null, ex, ey + 0.04, ez, 0.85, kopf); auge(null, -ex, ey + 0.04, ez, 0.85, kopf);
      }
      if (f.art === 'Bär') {
        const kappe = M(G.kugel(0.44, 18, 10, 0, TAU), kleid2, 0, 0.12, -0.02, 0, 0, 0, 1.02, 0.6, 1.02);
        const schirm = M(G.zyl(0.28, 0.28, 0.04, 18), kleid2, 0, 0.2, 0.32, 0.25, 0, 0, 1, 1, 0.9);
        kopf.add(kappe, schirm);
      }
      if (f.art === 'Koala') {
        const blatt = M(G.kugel(0.1, 8, 6), Mat.std('#3fae4a'), 0.12, 0.38, 0.12, 0, 0, 0.5, 1.6, 0.25, 0.8);
        kopf.add(blatt);
      }
      break;
    }
    case 'Pinguin': {
      kopf.add(M(G.kugel(0.3, 16, 12), bauch, 0, -0.05, 0.2, 0, 0, 0, 1.15, 1, 0.9));
      kopf.add(M(G.kegel(0.09, 0.26, 10), Mat.std('#ffa020'), 0, -0.04, 0.5, Math.PI / 2, 0, 0));
      auge(null, 0.13, 0.08, 0.37, 0.9, kopf); auge(null, -0.13, 0.08, 0.37, 0.9, kopf);
      const muetze = M(G.kegel(0.32, 0.4, 16), kleid, 0, 0.42, -0.02, -0.2, 0, 0);
      const bommel = M(G.kugel(0.09), Mat.std('#ffffff'), 0, 0.62, -0.08);
      const rand = M(G.torus(0.33, 0.06, TAU, 8, 20), kleid2, 0, 0.27, 0, Math.PI / 2 - 0.2, 0, 0);
      kopf.add(muetze, bommel, rand);
      break;
    }
    case 'Roboter': {
      const visier = M(G.rund(0.6, 0.2, 0.08, 0.08), Mat.std('#0b0f14', { roughness: 0.1, metalness: 0.3 }), 0, 0.04, 0.33);
      kopf.add(visier);
      const lm = Mat.leucht(f.f2, 2);
      kopf.add(M(G.kugel(0.06, 10, 8), lm, 0.13, 0.04, 0.38, 0, 0, 0, 1.4, 0.8, 0.5), M(G.kugel(0.06, 10, 8), lm, -0.13, 0.04, 0.38, 0, 0, 0, 1.4, 0.8, 0.5));
      kopf.add(M(G.zyl(0.02, 0.02, 0.3, 6), Mat.chrom(), 0, 0.48, 0), M(G.kugel(0.07, 10, 8), Mat.leucht('#ff4040', 1.5), 0, 0.65, 0));
      for (const s of [1, -1]) kopf.add(M(G.zyl(0.12, 0.12, 0.08, 14), Mat.chrom(), 0.42 * s, 0, 0, 0, 0, Math.PI / 2));
      kopf.add(M(G.box(0.3, 0.04, 0.02), Mat.std('#2c3540'), 0, -0.18, 0.34));
      break;
    }
    case 'Hase': {
      for (const s of [1, -1]) {
        const o = M(G.kugel(0.11, 12, 10), haut, 0.13 * s, 0.6, -0.05, -0.15, 0, -0.18 * s, 1, 3.2, 0.6);
        const i = M(G.kugel(0.06, 10, 8), Mat.std('#ffb3cf'), 0.13 * s, 0.6, 0.0, -0.15, 0, -0.18 * s, 1, 3.4, 0.4);
        kopf.add(o, i);
      }
      kopf.add(M(G.kugel(0.16, 14, 10), bauch, 0, -0.11, 0.32, 0, 0, 0, 1.2, 0.75, 0.75));
      kopf.add(M(G.kugel(0.05, 10, 8), Mat.std('#ff6f9e'), 0, -0.03, 0.46));
      kopf.add(M(G.box(0.1, 0.08, 0.03), Mat.std('#ffffff'), 0, -0.2, 0.42));
      auge(Mat.std('#3a2a6a', { roughness: 0.2 }), ex, ey + 0.03, ez, 1, kopf); auge(Mat.std('#3a2a6a', { roughness: 0.2 }), -ex, ey + 0.03, ez, 1, kopf);
      break;
    }
    case 'Drache': {
      kopf.add(M(G.kugel(0.24, 16, 12), bauch, 0, -0.1, 0.3, 0, 0, 0, 1.1, 0.7, 1.1));
      kopf.add(M(G.kugel(0.035), dunkel, 0.07, -0.02, 0.55), M(G.kugel(0.035), dunkel, -0.07, -0.02, 0.55));
      for (const s of [1, -1]) kopf.add(M(G.kegel(0.07, 0.3, 8), Mat.std('#fff4d0', { roughness: 0.4 }), 0.2 * s, 0.38, -0.08, -0.4, 0, -0.3 * s));
      for (let i = 0; i < 3; i++) kopf.add(M(G.kegel(0.07, 0.16, 6), kleid2, 0, 0.36 - i * 0.16, -0.32 - i * 0.08, -0.6 - i * 0.4, 0, 0));
      auge(null, ex, ey + 0.08, ez - 0.02, 1, kopf); auge(null, -ex, ey + 0.08, ez - 0.02, 1, kopf);
      for (let i = 0; i < 3; i++) g.add(M(G.kegel(0.08, 0.18, 6), kleid2, 0, 0.66 - i * 0.18, -0.3 - i * 0.04, -0.3, 0, 0));
      g.add(M(G.kugel(0.16, 12, 10), haut, 0, 0.18, -0.42, -0.9, 0, 0, 0.8, 0.8, 2));
      break;
    }
    case 'Frosch': {
      for (const s of [1, -1]) {
        kopf.add(M(G.kugel(0.17, 16, 12), haut, 0.17 * s, 0.32, 0.12));
        kopf.add(M(G.kugel(0.12, 14, 10), Mat.std('#ffffff', { roughness: 0.2 }), 0.17 * s, 0.34, 0.22, 0, 0, 0, 1, 1, 0.7));
        kopf.add(M(G.kugel(0.065, 10, 8), dunkel, 0.17 * s, 0.34, 0.3, 0, 0, 0, 1, 1.2, 0.6));
        kopf.add(M(G.kugel(0.03, 8, 6), Mat.std('#ffffff'), 0.19 * s, 0.38, 0.33));
        kopf.add(M(G.kugel(0.07, 10, 8), Mat.std('#ff8fb0', { roughness: 0.8 }), 0.27 * s, -0.08, 0.3, 0, 0, 0, 1, 0.6, 0.4));
      }
      kopf.add(M(G.torus(0.22, 0.025, Math.PI, 6, 16), Mat.std('#b8325a'), 0, -0.04, 0.34, Math.PI, 0, 0, 1, 0.6, 1));
      const krone = new THREE.Group();
      krone.add(M(G.zyl(0.17, 0.17, 0.1, 12, 1, true), Mat.std('#ffd23a', { metalness: 0.7, roughness: 0.25 })));
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; krone.add(M(G.kegel(0.05, 0.12, 4), Mat.std('#ffd23a', { metalness: 0.7, roughness: 0.25 }), Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15)); }
      krone.position.set(0, 0.42, -0.12); krone.rotation.x = -0.2; kopf.add(krone);
      break;
    }
    case 'Eule': {
      for (const s of [1, -1]) {
        kopf.add(M(G.kugel(0.17, 16, 12), bauch, 0.15 * s, 0.05, 0.27, 0, 0, 0, 1, 1, 0.6));
        auge(Mat.std('#2a1a40', { roughness: 0.2 }), 0.15 * s, 0.06, 0.36, 1.4, kopf);
        kopf.add(M(G.kegel(0.09, 0.26, 6), haut, 0.28 * s, 0.4, -0.02, 0, 0, -0.45 * s));
      }
      kopf.add(M(G.kegel(0.06, 0.16, 6), Mat.std('#ffb020'), 0, -0.12, 0.43, Math.PI / 2 + 0.6, 0, 0));
      const hut = new THREE.Group();
      hut.add(M(G.zyl(0.3, 0.3, 0.03, 20), kleid2), M(G.zyl(0.16, 0.2, 0.22, 16), kleid2, 0, 0.12, 0));
      hut.position.set(0, 0.42, 0); hut.rotation.z = 0.15; kopf.add(hut);
      break;
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { gruppe: g, kopf, armL, armR };
}

// ---------- Karts ----------
// Baut das Kart mit Fahrer. Ursprung = Bodenmitte, vorne = +Z
function baueKart(fi, ki, teamFarbe) {
  const f = FIGUREN[fi];
  const farbe = teamFarbe || f.f1;
  const root = new THREE.Group();          // Position + Richtung
  const neig = new THREE.Group();          // Neigung zum Boden
  const koerper = new THREE.Group();       // Federn, Drehen, Überschlag
  root.add(neig); neig.add(koerper);
  const lack = Mat.std(farbe, { roughness: 0.28, metalness: 0.25 });
  const lack2 = Mat.std(teamFarbe ? '#ffffff' : f.f2, { roughness: 0.35, metalness: 0.2 });
  const dunkel = Mat.std('#24262d', { roughness: 0.6 });
  const chrom = Mat.chrom();
  const typ = KARTS[ki].id;
  const raeder = [];
  let radR = [0.33, 0.38], spur = [0.78, 0.82], achse = [0.85, -0.75], sitzZ = -0.15, sitzY = 0.42;
  const auspuff = [];
  const licht = Mat.leucht('#fff6c0', 1.3);
  const sitz = (y, z) => {
    koerper.add(M(G.rund(0.62, 0.62, 0.12, 0.1), dunkel, 0, y + 0.32, z - 0.28, -0.22, 0, 0));
    koerper.add(M(G.rund(0.62, 0.1, 0.5, 0.05), dunkel, 0, y + 0.02, z - 0.05));
  };
  if (typ === 'standard') {
    // flacher Boden, runde Haube, Seitenkästen, Motor hinten
    koerper.add(M(G.rund(1.24, 0.18, 2.2, 0.08), lack, 0, 0.3, 0.0));
    koerper.add(M(G.kugel(0.62, 20, 12), lack, 0, 0.36, 0.78, 0, 0, 0, 0.92, 0.42, 0.95));
    koerper.add(M(G.rund(1.5, 0.12, 0.26, 0.06), lack2, 0, 0.26, 1.3));
    for (const s2 of [1, -1]) {
      koerper.add(M(G.rund(0.3, 0.28, 1.15, 0.12), lack2, 0.74 * s2, 0.36, -0.05));
      koerper.add(M(G.kugel(0.075, 10, 8), licht, 0.32 * s2, 0.5, 1.28));
    }
    sitz(0.4, -0.12);
    koerper.add(M(G.rund(0.86, 0.36, 0.5, 0.12), dunkel, 0, 0.52, -0.86));
    koerper.add(M(G.box(0.7, 0.08, 0.36), chrom, 0, 0.74, -0.86));
    for (const s2 of [1, -1]) { koerper.add(M(G.zyl(0.09, 0.11, 0.42, 12), chrom, 0.26 * s2, 0.58, -1.12, Math.PI / 2 + 0.25, 0, 0)); auspuff.push(new THREE.Vector3(0.26 * s2, 0.63, -1.34)); }
  } else if (typ === 'flitzer') {
    radR = [0.3, 0.34]; spur = [0.8, 0.84]; achse = [0.98, -0.82]; sitzY = 0.34;
    koerper.add(M(G.rund(1.0, 0.16, 2.4, 0.07), lack, 0, 0.27, 0.0));
    const nase = M(G.kegel(0.5, 1.3, 4), lack, 0, 0.36, 1.05, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.42);
    koerper.add(nase);
    koerper.add(M(G.rund(1.75, 0.05, 0.36, 0.03), lack2, 0, 0.24, 1.6));
    for (const s2 of [1, -1]) koerper.add(M(G.box(0.05, 0.2, 0.36), lack2, 0.86 * s2, 0.3, 1.6));
    koerper.add(M(G.rund(1.55, 0.06, 0.42, 0.03), lack2, 0, 1.02, -1.1));
    for (const s2 of [1, -1]) koerper.add(M(G.box(0.05, 0.5, 0.32), dunkel, 0.5 * s2, 0.78, -1.08));
    for (const s2 of [1, -1]) koerper.add(M(G.rund(0.28, 0.2, 1.3, 0.09), lack2, 0.62 * s2, 0.32, -0.05));
    sitz(0.32, -0.12);
    koerper.add(M(G.rund(0.76, 0.3, 0.5, 0.1), dunkel, 0, 0.45, -0.82));
    for (const s2 of [1, -1]) { koerper.add(M(G.zyl(0.08, 0.1, 0.36, 12), chrom, 0.22 * s2, 0.5, -1.1, Math.PI / 2 + 0.15, 0, 0)); auspuff.push(new THREE.Vector3(0.22 * s2, 0.53, -1.3)); }
  } else if (typ === 'buggy') {
    radR = [0.42, 0.48]; spur = [0.88, 0.92]; achse = [0.9, -0.82]; sitzY = 0.56;
    koerper.add(M(G.rund(1.0, 0.24, 1.9, 0.1), lack, 0, 0.52, 0.0));
    koerper.add(M(G.rund(1.05, 0.26, 0.62, 0.12), lack2, 0, 0.66, 0.92, -0.32, 0, 0));
    koerper.add(M(G.torus(0.55, 0.06, Math.PI, 8, 16), dunkel, 0, 0.92, -0.62));
    for (const s2 of [1, -1]) {
      koerper.add(M(G.zyl(0.05, 0.05, 1.7, 8), dunkel, 0.55 * s2, 0.6, 0.05, Math.PI / 2, 0, 0));
      koerper.add(M(G.kugel(0.1, 10, 8), licht, 0.3 * s2, 0.86, 1.14));
      koerper.add(M(G.rund(0.45, 0.06, 0.55, 0.03), lack, 0.86 * s2, 0.98, achse[0]));
      koerper.add(M(G.rund(0.5, 0.06, 0.6, 0.03), lack, 0.9 * s2, 1.06, achse[1]));
    }
    sitz(0.56, -0.14);
    koerper.add(M(G.rund(0.8, 0.4, 0.5, 0.12), dunkel, 0, 0.78, -0.86));
    koerper.add(M(G.box(0.9, 0.12, 0.12), chrom, 0, 0.46, 1.24));
    for (const s2 of [1, -1]) { koerper.add(M(G.zyl(0.08, 0.1, 0.5, 12), chrom, 0.3 * s2, 1.05, -1.0, 0.5, 0, 0)); auspuff.push(new THREE.Vector3(0.3 * s2, 1.27, -1.12)); }
  } else {
    radR = [0.38, 0.44]; spur = [0.88, 0.92]; achse = [0.92, -0.86]; sitzY = 0.5;
    koerper.add(M(G.rund(1.42, 0.3, 2.35, 0.14), lack, 0, 0.4, 0.0));
    koerper.add(M(G.rund(1.25, 0.42, 0.8, 0.18), lack, 0, 0.62, 0.82));
    koerper.add(M(G.rund(1.0, 0.3, 0.06, 0.04), chrom, 0, 0.6, 1.25));
    for (let i = 0; i < 4; i++) koerper.add(M(G.box(0.86, 0.03, 0.06), dunkel, 0, 0.5 + i * 0.065, 1.29));
    for (const s2 of [1, -1]) koerper.add(M(G.kugel(0.09, 10, 8), licht, 0.48 * s2, 0.68, 1.25));
    sitz(0.5, -0.12);
    koerper.add(M(G.rund(1.1, 0.5, 0.7, 0.15), lack2, 0, 0.75, -0.82));
    for (const s2 of [1, -1]) { koerper.add(M(G.zyl(0.12, 0.14, 0.5, 12), chrom, 0.45 * s2, 0.84, -1.15, Math.PI / 2 + 0.3, 0, 0)); auspuff.push(new THREE.Vector3(0.45 * s2, 0.9, -1.42)); }
    koerper.add(M(G.box(0.12, 0.25, 0.12), chrom, 0, 0.92, 1.0));
  }
  // Lenkrad
  const lenkrad = new THREE.Group();
  lenkrad.add(M(G.torus(0.17, 0.035, TAU, 6, 18), dunkel), M(G.box(0.3, 0.04, 0.03), dunkel));
  lenkrad.position.set(0, sitzY + 0.5, 0.48); lenkrad.rotation.x = -0.9;
  koerper.add(lenkrad);
  koerper.add(M(G.zyl(0.03, 0.03, 0.5, 6), dunkel, 0, sitzY + 0.33, 0.62, -0.9, 0, 0));
  // Startnummer-Scheibe
  const schild = M(G.zyl(0.17, 0.17, 0.03, 18), Mat.std('#ffffff', { roughness: 0.4 }), 0, typ === 'flitzer' ? 0.45 : typ === 'buggy' ? 0.78 : 0.56, typ === 'flitzer' ? 0.75 : typ === 'buggy' ? 1.05 : 1.12, Math.PI / 2 - 0.5, 0, 0);
  koerper.add(schild);
  // Räder
  const reifen = Mat.gummi();
  const felge = Mat.std(teamFarbe ? '#e8ecf2' : '#e8ecf2', { roughness: 0.2, metalness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const vorne = i < 2, s = i % 2 ? -1 : 1;
    const r = radR[vorne ? 0 : 1], b = vorne ? 0.3 : 0.38;
    const piv = new THREE.Group();
    piv.position.set(spur[vorne ? 0 : 1] * s, r, achse[vorne ? 0 : 1]);
    const rad = new THREE.Group();
    const reif = M(G.zyl(r, r, b, 20), reifen, 0, 0, 0, 0, 0, Math.PI / 2);
    const f1 = M(G.zyl(r * 0.6, r * 0.6, b + 0.02, 12), felge, 0, 0, 0, 0, 0, Math.PI / 2);
    const nabe = M(G.zyl(r * 0.22, r * 0.22, b + 0.05, 8), lack, 0, 0, 0, 0, 0, Math.PI / 2);
    // Profil-Streifen, damit man die Drehung sieht
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; rad.add(M(G.box(b + 0.01, 0.05, 0.08), Mat.std('#33343b'), 0, Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99, a, 0, 0)); }
    rad.add(reif, f1, nabe);
    piv.add(rad);
    koerper.add(piv);
    raeder.push({ piv, rad, vorne });
  }
  // Fahrer
  const fig = baueFigur(fi);
  fig.gruppe.position.set(0, sitzY, sitzZ);
  fig.gruppe.scale.setScalar(1.08);
  koerper.add(fig.gruppe);
  koerper.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Ankerpunkte für Effekte
  const hinten = new THREE.Object3D(); hinten.position.set(0, 0.2, -1.2); koerper.add(hinten);
  const ballons = new THREE.Group(); ballons.position.set(0, 1.0, -0.9); koerper.add(ballons);
  return { root, neig, koerper, raeder, fig, lenkrad, auspuff, hinten, ballons, schild, lack };
}

// ---------- Item-Würfel ----------
const WuerfelMat = new THREE.ShaderMaterial({
  uniforms: { zeit: { value: 0 } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vP = position; vN = normalize(mat3(modelMatrix)*normal);
      vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform float zeit; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    vec3 hsv(float h){ vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0); vec3 p = abs(fract(vec3(h)+k)*6.0-3.0); return clamp(p-1.0,0.0,1.0); }
    void main(){ float fr = pow(1.0-abs(dot(normalize(vN),vV)),1.6);
      float h = zeit*0.25 + vP.y*0.35 + vP.x*0.2 + fr*0.6;
      vec3 c = mix(hsv(h), vec3(1.0), 0.25);
      vec3 a = abs(vP); float kante = max(max(min(a.x,a.y), min(a.y,a.z)), min(a.x,a.z));
      float rand = smoothstep(0.82, 0.98, kante/1.0);
      float alpha = 0.32 + fr*0.5 + rand*0.5;
      gl_FragColor = vec4(c*(1.1+rand*0.6), clamp(alpha,0.0,0.95)); }`,
});
const FalleMat = WuerfelMat.clone();
FalleMat.fragmentShader = FalleMat.fragmentShader.replace('vec3 c = mix(hsv(h), vec3(1.0), 0.25);', 'vec3 c = mix(vec3(1.0,0.25,0.2)+hsv(h)*0.25, vec3(1.0), 0.15);');
function baueWuerfel(falle) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(G.rund(1.7, 1.7, 1.7, 0.25), falle ? FalleMat : WuerfelMat);
  w.geometry.computeBoundingBox();
  g.add(w);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.fragezeichen(falle), transparent: true, depthWrite: false }));
  sp.scale.set(1.3, 1.3, 1);
  g.add(sp);
  g.userData.wuerfel = w;
  return g;
}

// ---------- Item-Modelle in der Welt ----------
function baueItemModell(typ) {
  const g = new THREE.Group();
  if (typ === 'banane') {
    const gelb = Mat.std('#ffd92e', { roughness: 0.45 });
    g.add(M(G.torus(0.42, 0.15, Math.PI * 0.9, 10, 16), gelb, 0, 0.5, 0, 0, 0, Math.PI * 1.05));
    g.add(M(G.zyl(0.05, 0.07, 0.14, 6), Mat.std('#6b4a1e'), 0.4, 0.62, 0, 0, 0, -0.5));
    for (const s of [1, -1]) g.add(M(G.kugel(0.13, 8, 6), gelb, 0.18 * s - 0.05, 0.2, 0.12 * s, 0, 0, 0, 1.6, 0.4, 0.7));
  } else if (typ === 'gruen' || typ === 'rot') {
    const farbe = typ === 'gruen' ? '#2ccf4a' : '#e8302c';
    const dom = new THREE.SphereGeometry(0.5, 18, 10, 0, TAU, 0, Math.PI / 2);
    g.add(M(dom, Mat.std(farbe, { roughness: 0.25 }), 0, 0.2, 0, 0, 0, 0, 1, 0.85, 1));
    g.add(M(G.torus(0.5, 0.08, TAU, 8, 20), Mat.std('#ffffff', { roughness: 0.3 }), 0, 0.2, 0, Math.PI / 2, 0, 0));
    g.add(M(G.zyl(0.48, 0.42, 0.14, 18), Mat.std('#fff4d8', { roughness: 0.5 }), 0, 0.12, 0));
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(M(G.zyl(0.11, 0.13, 0.05, 6), Mat.std('#ffffff', { roughness: 0.3 }), Math.cos(a) * 0.26, 0.48, Math.sin(a) * 0.26, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6)); }
    g.add(M(G.zyl(0.13, 0.13, 0.05, 6), Mat.std('#ffffff'), 0, 0.62, 0));
  } else if (typ === 'blau') {
    const blau = Mat.std('#2f6bff', { roughness: 0.25, emissive: new THREE.Color('#1030a0'), emissiveIntensity: 0.4 });
    g.add(M(G.kugel(0.6, 18, 12), blau, 0, 0.6, 0, 0, 0, 0, 1, 0.8, 1));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(M(G.kegel(0.12, 0.35, 6), Mat.std('#ffffff'), Math.cos(a) * 0.45, 0.85, Math.sin(a) * 0.45, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7)); }
    g.add(M(G.kegel(0.14, 0.4, 6), Mat.std('#ffffff'), 0, 1.15, 0));
    for (const s of [1, -1]) g.add(M(G.kugel(0.3, 10, 8), Mat.std('#ffffff', { roughness: 0.3 }), 0.65 * s, 0.75, -0.1, 0, 0, 0.5 * s, 1.4, 0.18, 0.8));
  } else if (typ === 'bombe') {
    g.add(M(G.kugel(0.55, 18, 14), Mat.std('#22232a', { roughness: 0.3, metalness: 0.3 }), 0, 0.6, 0));
    g.add(M(G.zyl(0.12, 0.12, 0.2, 10), Mat.std('#9aa0aa', { metalness: 0.6, roughness: 0.3 }), 0, 1.15, 0));
    g.add(M(G.zyl(0.03, 0.03, 0.25, 6), Mat.std('#e8d8b0'), 0.05, 1.32, 0, 0, 0, -0.4));
    g.add(M(G.kugel(0.08, 8, 6), Mat.leucht('#ffcc33', 3), 0.12, 1.45, 0));
    auge(null, 0.17, 0.75, 0.48, 1.1, g); auge(null, -0.17, 0.75, 0.48, 1.1, g);
    for (const s of [1, -1]) g.add(M(G.kugel(0.16, 10, 8), Mat.std('#ffb020'), 0.28 * s, 0.1, 0.1, 0, 0, 0, 1, 0.6, 1.4));
  } else if (typ === 'falle') {
    const w = baueWuerfel(true); w.position.y = 1.2; g.add(w); g.userData.wuerfel = w;
  } else if (typ === 'muenze') {
    g.add(M(G.zyl(0.5, 0.5, 0.12, 22), Mat.std('#ffcc1a', { metalness: 0.6, roughness: 0.25, emissive: new THREE.Color('#a86a00'), emissiveIntensity: 0.55 }), 0, 0, 0, Math.PI / 2, 0, 0));
    g.add(M(G.box(0.12, 0.5, 0.14), Mat.std('#ffe680', { metalness: 0.6, roughness: 0.2, emissive: new THREE.Color('#a87a00'), emissiveIntensity: 0.5 }), 0, 0, 0));
  } else if (typ === 'rakete') {
    const dunkel = Mat.std('#2a2c33', { roughness: 0.35, metalness: 0.4 });
    g.add(M(G.zyl(1.1, 1.1, 2.4, 20), dunkel, 0, 1.2, -0.3, Math.PI / 2, 0, 0));
    g.add(M(G.kugel(1.1, 20, 14), dunkel, 0, 1.2, 0.9, 0, 0, 0, 1, 1, 0.9));
    g.add(M(G.zyl(1.15, 1.15, 0.3, 20), Mat.std('#e23b3b'), 0, 1.2, -1.4, Math.PI / 2, 0, 0));
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; g.add(M(G.box(0.1, 0.9, 0.8), Mat.std('#e23b3b'), Math.cos(a) * 1.2, 1.2 + Math.sin(a) * 1.2, -1.2, 0, 0, a + Math.PI / 2)); }
    auge(null, 0.42, 1.55, 1.62, 2.4, g); auge(null, -0.42, 1.55, 1.62, 2.4, g);
    for (const s of [1, -1]) g.add(M(G.box(0.35, 0.06, 0.05), Mat.std('#111'), 0.42 * s, 1.92, 1.68, 0, 0, -0.35 * s));
  }
  return g;
}

// ---------- Item-Symbole für die Anzeige ----------
const ITEMS = {
  nitro: { name: 'Nitro' }, nitro3: { name: '3× Nitro' }, banane: { name: 'Bananenschale' }, banane3: { name: '3× Bananen' },
  gruen: { name: 'Grüne Kugel' }, gruen3: { name: '3× Grüne Kugeln' }, rot: { name: 'Rote Kugel' }, rot3: { name: '3× Rote Kugeln' },
  blau: { name: 'Stachelkugel' }, bombe: { name: 'Bombe' }, stern: { name: 'Superstern' }, blitz: { name: 'Blitz' },
  tinte: { name: 'Tintenfisch' }, rakete: { name: 'Rakete' }, falle: { name: 'Falscher Würfel' }, hupe: { name: 'Schock-Hupe' },
  muenze: { name: 'Münzen' }, goldnitro: { name: 'Gold-Nitro' },
};
const Ikon = {
  cache: {},
  bild(typ) {
    if (this.cache[typ]) return this.cache[typ];
    const c = Tex.canvas(128, 128, (g, w, h) => this.male(g, typ));
    return (this.cache[typ] = c.toDataURL());
  },
  male(g, typ) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const umriss = (lw = 6, col = 'rgba(0,0,0,.55)') => { g.lineWidth = lw; g.strokeStyle = col; g.stroke(); };
    const lin = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
    const mehrfach = (n, fn) => { const offs = n === 3 ? [[-22, 14, 0.62], [22, 14, 0.62], [0, -12, 0.62]] : [[0, 0, 1]]; for (const [dx, dy, s] of offs) { g.save(); g.translate(64 + dx, 64 + dy); g.scale(s, s); g.translate(-64, -64); fn(); g.restore(); } };
    switch (typ) {
      case 'nitro': case 'nitro3': case 'goldnitro':
        mehrfach(typ === 'nitro3' ? 3 : 1, () => {
          const gold = typ === 'goldnitro';
          g.beginPath(); g.roundRect ? g.roundRect(38, 30, 52, 76, 14) : g.rect(38, 30, 52, 76);
          g.fillStyle = lin(30, 106, gold ? '#fff2a0' : '#ff6a4a', gold ? '#d99a00' : '#c41c1c'); g.fill(); umriss();
          g.fillStyle = gold ? '#fffbe0' : '#f2f4f8'; g.fillRect(38, 52, 52, 26);
          g.fillStyle = gold ? '#c98a00' : '#e02a2a'; g.font = '900 24px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', 64, 66);
          g.beginPath(); g.rect(54, 18, 20, 14); g.fillStyle = '#9aa3b0'; g.fill(); umriss(4);
          g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(44, 34, 6, 64);
        });
        break;
      case 'banane': case 'banane3':
        mehrfach(typ === 'banane3' ? 3 : 1, () => {
          g.beginPath(); g.moveTo(30, 40); g.quadraticCurveTo(36, 100, 100, 96); g.quadraticCurveTo(64, 84, 48, 40); g.closePath();
          g.fillStyle = lin(30, 100, '#fff27a', '#f5b800'); g.fill(); umriss();
          g.beginPath(); g.moveTo(30, 40); g.lineTo(28, 26); g.lineTo(42, 30); g.closePath(); g.fillStyle = '#6b4a1e'; g.fill(); umriss(4);
        });
        break;
      case 'gruen': case 'gruen3': case 'rot': case 'rot3':
        mehrfach(typ.endsWith('3') ? 3 : 1, () => {
          const gr = typ.startsWith('gruen');
          g.beginPath(); g.ellipse(64, 80, 44, 16, 0, 0, TAU); g.fillStyle = '#fff4d8'; g.fill(); umriss();
          g.beginPath(); g.ellipse(64, 74, 42, 38, 0, Math.PI, TAU); g.closePath(); g.fillStyle = lin(36, 76, gr ? '#7dff8a' : '#ff8a7a', gr ? '#16a832' : '#c4161c'); g.fill(); umriss();
          g.fillStyle = 'rgba(255,255,255,.9)';
          for (const [x, y] of [[64, 48], [44, 62], [84, 62]]) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 7); } g.closePath(); g.fill(); }
          g.beginPath(); g.ellipse(64, 76, 44, 6, 0, 0, TAU); g.fillStyle = '#fff'; g.fill();
        });
        break;
      case 'blau':
        g.fillStyle = '#fff';
        for (const s of [1, -1]) { g.beginPath(); g.ellipse(64 + 40 * s, 62, 26, 12, -0.4 * s, 0, TAU); g.fill(); umriss(4); }
        g.beginPath(); g.arc(64, 70, 34, 0, TAU); g.fillStyle = lin(36, 104, '#7ab0ff', '#1f4fe0'); g.fill(); umriss();
        g.fillStyle = '#fff';
        for (let k = 0; k < 7; k++) { const a = Math.PI + k / 6 * Math.PI; g.beginPath(); g.moveTo(64 + Math.cos(a - 0.2) * 30, 70 + Math.sin(a - 0.2) * 30); g.lineTo(64 + Math.cos(a) * 48, 70 + Math.sin(a) * 48); g.lineTo(64 + Math.cos(a + 0.2) * 30, 70 + Math.sin(a + 0.2) * 30); g.fill(); umriss(3); }
        break;
      case 'bombe':
        g.beginPath(); g.arc(60, 72, 36, 0, TAU); g.fillStyle = lin(36, 108, '#5a5c66', '#121318'); g.fill(); umriss();
        g.beginPath(); g.arc(48, 60, 9, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
        g.fillStyle = '#9aa0aa'; g.fillRect(52, 28, 18, 12);
        g.beginPath(); g.moveTo(62, 28); g.quadraticCurveTo(72, 12, 86, 18); umriss(5, '#d8c8a0');
        g.beginPath(); g.arc(88, 16, 8, 0, TAU); g.fillStyle = '#ffcc33'; g.fill();
        break;
      case 'stern': {
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * TAU, r = k % 2 ? 22 : 50; g.lineTo(64 + Math.cos(a) * r, 68 + Math.sin(a) * r); }
        g.closePath(); g.fillStyle = lin(18, 118, '#fff7a0', '#ffb400'); g.fill(); umriss();
        g.fillStyle = '#222'; g.fillRect(54, 58, 6, 14); g.fillRect(68, 58, 6, 14);
        break;
      }
      case 'blitz':
        g.beginPath(); g.moveTo(74, 10); g.lineTo(34, 70); g.lineTo(60, 70); g.lineTo(48, 118); g.lineTo(96, 52); g.lineTo(68, 52); g.closePath();
        g.fillStyle = lin(10, 118, '#fff7a0', '#ffc400'); g.fill(); umriss();
        break;
      case 'tinte':
        g.beginPath(); g.ellipse(64, 50, 30, 36, 0, 0, TAU); g.fillStyle = lin(14, 86, '#ffffff', '#c8d0e0'); g.fill(); umriss();
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(42 + k * 14, 80); g.quadraticCurveTo(38 + k * 14 + (k % 2 ? 8 : -8), 100, 44 + k * 14, 116); umriss(9, '#c8d0e0'); }
        g.fillStyle = '#111'; g.beginPath(); g.ellipse(52, 52, 6, 9, 0, 0, TAU); g.ellipse(76, 52, 6, 9, 0, 0, TAU); g.fill();
        break;
      case 'rakete':
        g.save(); g.translate(64, 64); g.rotate(-0.5);
        g.beginPath(); g.moveTo(-40, -26); g.lineTo(18, -26); g.quadraticCurveTo(52, -26, 52, 0); g.quadraticCurveTo(52, 26, 18, 26); g.lineTo(-40, 26); g.closePath();
        g.fillStyle = lin(-26, 26, '#5a5d68', '#17181d'); g.fill(); umriss();
        g.fillStyle = '#e23b3b'; g.fillRect(-48, -30, 12, 60);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(26, -8, 7, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(28, -7, 3.5, 5, 0, 0, TAU); g.fill();
        g.restore();
        break;
      case 'falle':
        g.save(); g.translate(64, 64); g.rotate(0.2);
        g.beginPath(); g.rect(-38, -38, 76, 76); g.fillStyle = 'rgba(255,90,80,.75)'; g.fill(); umriss(6, '#fff');
        g.rotate(Math.PI); g.font = '900 60px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('?', 0, 2);
        g.restore();
        break;
      case 'hupe':
        g.beginPath(); g.moveTo(24, 52); g.lineTo(52, 52); g.lineTo(96, 24); g.lineTo(96, 104); g.lineTo(52, 76); g.lineTo(24, 76); g.closePath();
        g.fillStyle = lin(24, 104, '#ffe27a', '#e09a00'); g.fill(); umriss();
        for (const r of [14, 26]) { g.beginPath(); g.arc(98, 64, r, -0.7, 0.7); umriss(5, '#fff'); }
        break;
      case 'muenze':
        for (const [x, y] of [[50, 70], [78, 58]]) {
          g.beginPath(); g.ellipse(x, y, 26, 32, 0, 0, TAU); g.fillStyle = lin(y - 32, y + 32, '#fff27a', '#e0a000'); g.fill(); umriss();
          g.fillStyle = '#fff6b0'; g.fillRect(x - 4, y - 16, 8, 32);
        }
        break;
    }
  },
};

// ---------- Porträts (für Auswahl und Anzeige) ----------
const Portraet = {
  r: null, szene: null, cam: null, cache: {},
  init() {
    if (this.r) return;
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setSize(128, 128, false);
    this.szene = new THREE.Scene();
    this.szene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.0));
    const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(1, 2, 3); this.szene.add(d);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  },
  bild(fi) {
    if (this.cache[fi]) return this.cache[fi];
    this.init();
    const f = baueFigur(fi);
    this.szene.add(f.gruppe);
    f.gruppe.rotation.y = -0.35;
    this.cam.position.set(0.55, 1.1, 2.7); this.cam.lookAt(0, 0.85, 0);
    this.r.render(this.szene, this.cam);
    const url = this.r.domElement.toDataURL();
    this.szene.remove(f.gruppe);
    return (this.cache[fi] = url);
  },
};
