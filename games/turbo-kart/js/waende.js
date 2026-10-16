// Turbo-Kart – Wände entlang der Strecke: ein Querschnitt (Profil) läuft der Strecke nach,
// dazu Pfosten, Zinnen, Fackeln, Markierstangen usw.
'use strict';

// Weiches Pseudo-Rauschen für Felsen und Schnee (gleiche Werte bei gleichen Koordinaten)
function rausch(x, y, z) {
  return Math.sin(x * 0.37 + z * 0.21 + 1.3) * 0.4 + Math.sin(x * 0.13 - z * 0.31 + y * 0.55) * 0.3 + Math.sin(x * 0.83 + y * 1.1 + z * 0.61) * 0.18
    + Math.sin(x * 2.3 - y * 1.7 + z * 1.9) * 0.12;
}

// Profile: [aussen, hoch] ab der Innenkante der Wand. h = Wandhöhe (skaliert die Profilhöhe)
const WAND_STILE = {
  bande: { h: 1.05, teile: [{ profil: [[0, -0.4], [0, 0.82], [0.05, 0.97], [0.2, 1.05], [0.4, 1.0], [0.5, 0.86], [0.5, -0.4]], mat: 'bande', uLen: 8 }] },
  holz: {
    h: 1.15, pfosten: { abst: 2.4, geo: [0.24, 1.5, 0.24], y: 0.45, x: 0.07, mat: 'pfosten' },
    teile: [
      { profil: [[0, 0.32], [0.13, 0.32], [0.13, 0.56], [0, 0.56]], zu: true, mat: 'brett', uLen: 3 },
      { profil: [[0, 0.82], [0.13, 0.82], [0.13, 1.06], [0, 1.06]], zu: true, mat: 'brett', uLen: 3 },
    ],
  },
  tempel: {
    h: 1.6, deko: { abst: 26, art: 'laterne' },
    teile: [
      { profil: [[0, -0.5], [0, 1.3], [0.08, 1.44], [0.92, 1.44], [1.0, 1.3], [1.0, -0.5]], mat: 'tempel', uLen: 4 },
      { profil: [[-0.03, 1.44], [0.3, 1.62], [0.75, 1.6], [1.03, 1.44]], mat: 'moos', uLen: 4, rausch: 0.08 },
    ],
  },
  fels: { h: 7, fels: true, teile: [{ profil: [[0, -0.6], [0.1, 0.8], [0.25, 1.6], [0.05, 2.4], [0.2, 3.2], [0.45, 3.9], [0.15, 4.6], [0.3, 5.3], [0.75, 6.0], [1.1, 6.7], [1.9, 7.1], [3.2, 7.4], [4.4, 7.0], [5.6, 6.3], [6.8, 5], [7.8, 3.4], [8.7, 1.6], [9.5, -0.6]], mat: 'fels', rausch: 1.5 }] },
  schnee: {
    h: 1.25, stangen: { abst: 16 },
    teile: [{ profil: [[0, -0.5], [0.05, 0.45], [0.35, 0.95], [0.85, 1.22], [1.45, 1.05], [2.0, 0.5], [2.4, -0.5]], mat: 'schnee', rausch: 0.35 }],
  },
  beton: {
    h: 1.06,
    teile: [
      { profil: [[0, -0.3], [0, 0.22], [0.17, 0.45], [0.21, 1.0], [0.43, 1.0], [0.47, 0.45], [0.64, 0.22], [0.64, -0.3]], mat: 'beton', uLen: 6 },
      { profil: [[0.19, 1.0], [0.45, 1.0], [0.45, 1.07], [0.19, 1.07]], zu: true, mat: 'neon' },
    ],
  },
  burg: { h: 2.5, zinnen: { abst: 2.4 }, fackeln: { abst: 26 }, teile: [{ profil: [[0, -0.5], [0, 1], [1.0, 1], [1.0, -0.5]], hoch: true, mat: 'burg', uLen: 4 }] },
  leucht: {
    h: 1.1, pfosten: { abst: 5, geo: [0.12, 1.15, 0.12], y: 0.55, x: 0.1, mat: 'leucht' },
    teile: [
      { profil: [[0.04, 0.5], [0.16, 0.5], [0.16, 0.6], [0.04, 0.6]], zu: true, mat: 'leucht' },
      { profil: [[0.04, 1.0], [0.16, 1.0], [0.16, 1.1], [0.04, 1.1]], zu: true, mat: 'leucht' },
    ],
  },
};

const Waende = {
  // Materialien pro Strecke (einmal erstellt)
  mats(w) {
    if (w._wandMats) return w._wandMats;
    const nacht = w.th.nacht;
    const tex = (stil, rx = 1) => { const t = Tex.wand(stil).clone(); t.needsUpdate = true; t.repeat.set(rx, 1); return t; };
    const m = {
      bande: new THREE.MeshLambertMaterial({ map: tex('bande') }),
      brett: new THREE.MeshLambertMaterial({ map: tex('holz'), color: '#e8d2b0' }),
      pfosten: Mat.lam('#7a5232'),
      tempel: new THREE.MeshLambertMaterial({ map: tex('burg'), color: '#c8c6a0' }),
      moos: Mat.lam('#4f9a3a', { flatShading: true }),
      fels: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
      schnee: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0 }),
      beton: new THREE.MeshLambertMaterial({ map: tex('beton') }),
      neon: new THREE.MeshBasicMaterial({ color: '#2ff0ff' }),
      burg: new THREE.MeshLambertMaterial({ map: tex('burg'), color: nacht ? '#d8d0dc' : '#ffffff' }),
      leucht: new THREE.MeshBasicMaterial({ color: '#7af0ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      flamme: new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    m.neon.userData.anim = true;
    w.anim.push(t => {
      m.leucht.color.setHSL((t * 0.1) % 1, 0.9, 0.62);
      m.neon.color.setHSL((0.5 + Math.sin(t * 0.4) * 0.12 + 1) % 1, 1, 0.55);
      m.flamme.opacity = 0.75 + Math.sin(t * 23) * 0.12 + Math.sin(t * 37) * 0.08;
    });
    return (w._wandMats = m);
  },
  // Farbe der Felsschichten
  // Gesteinsschichten: rot, ocker und dunkle Bänder, oben heller
  felsFarbe(y, n, out) {
    const F = this._fels || (this._fels = ['#9a4a26', '#b8683a', '#cf8c52', '#7a3c20', '#c07840', '#a85a30'].map(c => new THREE.Color(c)));
    const band = Math.floor(y * 1.3 + n * 1.5 + 10) % F.length;
    out.copy(F[band]).lerp(F[(band + 1) % F.length], clamp(n * 0.5 + 0.5, 0, 1) * 0.35);
    if (y < 0.6) out.multiplyScalar(0.8);
    return out;
  },
  schneeFarbe(y, n, out) {
    const a = this._s1 || (this._s1 = new THREE.Color('#ffffff')), b = this._s2 || (this._s2 = new THREE.Color('#bcd4f0'));
    return out.copy(a).lerp(b, clamp(0.35 - n * 0.6 + (y < 0.3 ? 0.3 : 0), 0, 0.8));
  },
  // Einen zusammenhängenden Wandabschnitt bauen.
  // pk: [{ x, y, z, ax, az, s }] – Fusspunkt der Innenkante, Richtung nach aussen (waagrecht), Länge entlang der Strecke
  lauf(w, g, pk, stilName, opt = {}) {
    if (pk.length < 2) return;
    const stil = WAND_STILE[stilName] || WAND_STILE.bande;
    const M_ = this.mats(w);
    const hs = (opt.h || stil.h) / stil.h;
    const c = new THREE.Color();
    for (const teil of stil.teile) {
      const pr = teil.profil, np = pr.length;
      const pos = [], uv = [], col = [], idx = [];
      // Profillänge für v
      const pl = [0]; for (let j = 1; j < np; j++) pl.push(pl[j - 1] + Math.hypot(pr[j][0] - pr[j - 1][0], (pr[j][1] - pr[j - 1][1]) * hs));
      const plT = pl[np - 1] || 1;
      for (let i = 0; i < pk.length; i++) {
        const q = pk[i];
        for (let j = 0; j < np; j++) {
          let px = pr[j][0], py = pr[j][1];
          if (teil.hoch) py = py > 0.5 ? (opt.h || stil.h) : py; else py *= hs;
          let x = q.x + q.ax * px, y = q.y + py, z = q.z + q.az * px;
          const n = teil.rausch ? rausch(x * 0.8, py * 1.3, z * 0.8) : 0;
          if (teil.rausch) {
            const st = teil.rausch;
            // nach innen nur oben ausbeulen, damit die Karts nicht in den Fels fahren
            const dx = n * st * (py < 3 ? (n > 0 ? 1 : 0) : 1) * (j === 0 || j === np - 1 ? 0 : 1);
            x += q.ax * dx; z += q.az * dx;
            if (j > 0 && j < np - 1) y += rausch(z * 0.9, x * 0.9, py) * st * 0.45;
          }
          pos.push(x, y, z);
          uv.push(q.s / (teil.uLen || 4), pl[j] / plT);
          if (teil.mat === 'fels') { this.felsFarbe(py, n, c); col.push(c.r, c.g, c.b); }
          else if (teil.mat === 'schnee') { this.schneeFarbe(py, n, c); col.push(c.r, c.g, c.b); }
        }
      }
      const segs = teil.zu ? np : np - 1;
      for (let i = 0; i < pk.length - 1; i++) for (let j = 0; j < segs; j++) {
        const a = i * np + j, b = i * np + (j + 1) % np, a2 = a + np, b2 = b + np;
        idx.push(a, a2, b2, a, b2, b);
      }
      // Deckel an beiden Enden
      if (!opt.zu) for (const i of [0, pk.length - 1]) for (let j = 1; j < np - 1; j++) idx.push(i * np, i * np + j, i * np + j + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (col.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = M_[teil.mat];
      mat.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = teil.mat !== 'leucht' && teil.mat !== 'neon';
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    // Zubehör entlang der Wand
    const entlang = (abst, fn) => {
      let naechst = Math.ceil(pk[0].s / abst) * abst;
      for (let i = 0; i < pk.length - 1; i++) {
        const a = pk[i], b = pk[i + 1];
        while (naechst <= b.s && naechst >= a.s) {
          const f = (naechst - a.s) / Math.max(1e-6, b.s - a.s);
          fn({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), ax: lerp(a.ax, b.ax, f), az: lerp(a.az, b.az, f), s: naechst });
          naechst += abst;
        }
      }
    };
    const dreh = q => Math.atan2(q.ax, q.az);
    if (stil.pfosten) {
      const P = stil.pfosten, pl = [];
      entlang(P.abst, q => pl.push({ x: q.x + q.ax * P.x, y: q.y + P.y * hs, z: q.z + q.az * P.x, s: 1, sy: hs, r: dreh(q) }));
      streuen(g, [{ geo: G.box(P.geo[0], P.geo[1], P.geo[2]), mat: M_[P.mat] }], pl, P.mat !== 'leucht');
    }
    if (stil.zinnen) {
      const h = opt.h || stil.h, pl = [];
      entlang(stil.zinnen.abst, q => pl.push({ x: q.x + q.ax * 0.5, y: q.y + h + 0.42, z: q.z + q.az * 0.5, s: 1, r: dreh(q) }));
      streuen(g, [{ geo: G.box(1.0, 0.85, 1.1), mat: M_.burg }], pl);
    }
    if (stil.fackeln) {
      const h = opt.h || stil.h, pl = [];
      entlang(stil.fackeln.abst, q => pl.push({ x: q.x - q.ax * 0.25, y: q.y + h - 0.6, z: q.z - q.az * 0.25, s: 1, r: dreh(q) }));
      streuen(g, [{ geo: G.box(0.14, 0.5, 0.14), mat: Mat.lam('#3a2a20'), y: 0 }, { geo: G.box(0.3, 0.18, 0.3), mat: Mat.lam('#2a2228'), y: 0.3 }], pl);
      streuen(g, [{ geo: G.kegel(0.2, 0.55, 6), mat: M_.flamme, y: 0.62 }, { geo: G.kugel(0.16, 6, 4), mat: M_.flamme, y: 0.45 }], pl, false);
    }
    if (stil.stangen) {
      const pl = [];
      entlang(stil.stangen.abst, q => pl.push({ x: q.x + q.ax * 0.7, y: q.y + 1.0, z: q.z + q.az * 0.7, s: 1, r: dreh(q) }));
      streuen(g, [{ geo: G.zyl(0.05, 0.05, 0.6, 5), mat: Mat.lam('#e8322f'), y: 0.3 }, { geo: G.zyl(0.05, 0.05, 0.6, 5), mat: Mat.lam('#ffffff'), y: 0.9 }, { geo: G.zyl(0.05, 0.05, 0.5, 5), mat: Mat.lam('#e8322f'), y: 1.45 }], pl);
    }
    if (stil.deko && stil.deko.art === 'laterne') {
      const pl = [];
      entlang(stil.deko.abst, q => pl.push({ x: q.x + q.ax * 0.5, y: q.y + 1.6, z: q.z + q.az * 0.5, s: 1, r: dreh(q) }));
      const st = Mat.lam('#9a9878', { flatShading: true });
      streuen(g, [{ geo: G.box(0.5, 0.7, 0.5), mat: st, y: 0.35 }, { geo: G.box(0.34, 0.3, 0.34), mat: Mat.leucht('#ffd070', 0.9), y: 0.85 }, { geo: G.kegel(0.45, 0.45, 4), mat: st, y: 1.2, ry: Math.PI / 4 }], pl);
    }
  },
  // Wandverlauf einer Seite in zusammenhängende Stücke teilen. teile: Array von { pk, stil } oder null (Lücke)
  stuecke(proben) {
    const out = [];
    let akt = null;
    for (const p of proben) {
      if (!p) { if (akt) out.push(akt); akt = null; continue; }
      if (akt && akt.stil !== p.stil) { akt.pk.push(p); out.push(akt); akt = null; }
      if (!akt) akt = { stil: p.stil, h: p.h, pk: [] };
      akt.pk.push(p);
    }
    if (akt) out.push(akt);
    return out;
  },
};
