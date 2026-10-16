// Turbo-Kart – Wahrzeichen der Strecken: Bauwerke, die zur Geschichte jeder Strecke gehören.
// Tore und Tunnel überspannen die Fahrbahn, alles andere steht daneben.
'use strict';

const Wahrzeichen = {
  baue(w) {
    this._liste = [];
    for (const e of w.def.wahrzeichen || []) {
      const us = Array.isArray(e.u) ? e.u : [e.u];
      us.forEach((u, i) => { if (this[e.typ]) this[e.typ](w, Object.assign({}, e, { u, nr: i })); });
    }
    // Unbewegte Teile pro Material zusammenfassen: viel weniger Zeichenaufrufe
    verschmelzen(this._liste, w.gruppe);
    this._liste = [];
  },
  // ---------- Hilfen ----------
  ort(w, u, d = 0) {
    const s = (u || 0) * w.L + w.startS, A = w.S[w.idx(s)];
    return { s, A, p: w.punkt(s, d), h: A.h };
  },
  boden(w) { const b = w.bodenY(); return b === null ? 0 : b; },
  // Freier Platz neben der Strecke (Radius r), bevorzugt auf Seite sd; gibt { x, y, z, sd, blick } zurück
  neben(w, u, ab, r, sd) {
    const { s, A } = this.ort(w, u);
    const seiten = sd ? [sd, -sd] : [1, -1];
    for (const extra of [0, 8, 16, 28, 45, 70]) for (const q of seiten) {
      const d = A.lim + ab + extra + r;
      const x = A.p.x + A.rh.x * d * q, z = A.p.z + A.rh.z * d * q;
      if (!this.platzFrei(w, x, z, r)) continue;
      return { x, y: this.boden(w), z, sd: q, blick: Math.atan2(A.p.x - x, A.p.z - z), s };
    }
    return null;
  },
  platzFrei(w, x, z, r) {
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (!w.frei(x + dx, z + dz)) return false;
    // nicht über anderen Streckenteilen (z.B. unter einer Brücke)
    for (let i = 0; i < w.n; i += 3) { const p = w.S[i].p; if ((p.x - x) ** 2 + (p.z - z) ** 2 < (w.S[i].lim + r + 2) ** 2) return false; }
    return true;
  },
  belegen(w, x, z, r) {
    const c = 6;
    for (let dx = -r; dx <= r; dx += 3) for (let dz = -r; dz <= r; dz += 3) if (dx * dx + dz * dz <= r * r) w.raster.set(Math.floor((x + dx) / c) + ',' + Math.floor((z + dz) / c), 1);
  },
  gruppe(w, x, y, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; w.gruppe.add(g);
    if (this._liste) this._liste.push(g);
    return g;
  },
  lebt(o) { o.userData.lebt = true; return o; },
  schatten(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; },
  // Etwas über der Fahrbahn an Position u: lokale Achsen x = quer, z = Fahrtrichtung
  ueber(w, u) {
    const { s, A, p } = this.ort(w, u);
    const g = this.gruppe(w, p.x, p.y, p.z, A.h);
    return { g, A, s, breit: A.lim + 0.15 };
  },
  // Tunnel entlang der Strecke: Seitenwände und Dach als Stücke, die der Kurve folgen
  _tunnel(w, u, laenge, teile) {
    const s0 = u * w.L + w.startS - laenge / 2;
    const n = Math.max(2, Math.round(laenge / 4));
    for (let i = 0; i <= n; i++) {
      const s = s0 + i * laenge / n, A = w.S[w.idx(s)], p = w.punkt(s, 0);
      const g = this.gruppe(w, p.x, p.y, p.z, A.h);
      teile(g, A.lim + 0.15, i, n, laenge / n);
    }
  },
  // ---------- Sonnenwiesen-Ring ----------
  girlanden(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const holz = Mat.lam('#8a5a32');
    for (let k = -1; k <= 1; k++) {
      const z = k * 12;
      for (const sd of [-1, 1]) g.add(M(G.zyl(0.18, 0.22, 10, 7), holz, sd * (breit + 1.2), 5, z));
      const n = 22, farben = ['#ff4a5a', '#ffd23a', '#3a8aff', '#2ccf8a', '#ff8a3a', '#c07aff'];
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n, x = lerp(-breit - 1.2, breit + 1.2, f), y = 9.4 - Math.sin(f * Math.PI) * 1.8;
        const fa = M(G.kegel(0.55, 1.1, 3), Mat.lam(farben[(i + k) % farben.length], { side: THREE.DoubleSide }), x, y - 0.55, z, Math.PI, 0, 0, 1, 1, 0.12);
        g.add(fa);
      }
      const seil = M(G.box((breit + 1.2) * 2, 0.05, 0.05), Mat.lam('#eeeeee'), 0, 8.6, z);
      g.add(seil);
    }
    this.schatten(g);
  },
  windmuehle(w, e) {
    const o = this.neben(w, e.u, 10, 8, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 10);
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    const weiss = Mat.lam('#f2efe6', { flatShading: true }), rot = Mat.lam('#c8322a', { flatShading: true }), holz = Mat.lam('#7a5232');
    g.add(M(G.zyl(3.2, 4.6, 16, 8), weiss, 0, 8, 0));
    g.add(M(G.kegel(4.2, 5, 8), rot, 0, 18.5, 0));
    g.add(M(G.box(1.6, 2.6, 0.3), holz, 0, 1.3, 4.4));
    for (const y of [6, 11]) g.add(M(G.box(1, 1.2, 0.2), Mat.lam('#4a6a9a'), 0, y, 4.0 - (y - 6) * 0.12));
    const nabe = this.lebt(new THREE.Group()); nabe.position.set(0, 15, 4.3); g.add(nabe);
    nabe.add(M(G.zyl(0.6, 0.6, 1, 10), holz, 0, 0, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 4; i++) {
      const fl = new THREE.Group(); fl.rotation.z = i * Math.PI / 2;
      fl.add(M(G.box(0.35, 11, 0.2), holz, 0, 5.8, 0.3));
      fl.add(M(G.box(2.2, 8, 0.08), Mat.lam('#f6f0dc', { side: THREE.DoubleSide }), 1.25, 6.5, 0.35));
      nabe.add(fl);
    }
    this.schatten(g);
    w.anim.push(t => { nabe.rotation.z = -t * 0.9; });
  },
  scheune(w, e) {
    const rot = Mat.lam('#b8322a'), weiss = Mat.lam('#f4f0e6'), dach = Mat.lam('#5a3a2a', { flatShading: true }), holz = Mat.lam('#8a5a32');
    const laenge = 28;
    this._tunnel(w, e.u, laenge, (g, b, i, n, st) => {
      for (const sd of [-1, 1]) g.add(M(G.box(1.4, 9, st + 0.3), rot, sd * (b + 0.9), 4.5, 0));
      // Satteldach
      for (const sd of [-1, 1]) g.add(M(G.box(b + 3.2, 0.5, st + 0.3), dach, sd * (b + 3.2) / 2 * 0.98, 11.2, 0, 0, 0, -sd * 0.42));
      if (i === 0 || i === n) {
        // Giebel mit weissem Rahmen
        const z = i === 0 ? -st / 2 : st / 2;
        const giebel = new THREE.Shape();
        giebel.moveTo(-b - 1.6, 9); giebel.lineTo(b + 1.6, 9); giebel.lineTo(0, 15); giebel.lineTo(-b - 1.6, 9);
        g.add(M(new THREE.ShapeGeometry(giebel), Mat.lam('#b8322a', { side: THREE.DoubleSide }), 0, 0, z));
        g.add(M(G.box(b * 2 + 3.6, 0.5, 0.5), weiss, 0, 9, z));
        for (const sd of [-1, 1]) g.add(M(G.box(0.5, 9, 0.5), weiss, sd * (b + 0.2), 4.5, z));
        // offene Tore mit weissem X
        for (const sd of [-1, 1]) {
          const tor = new THREE.Group(); tor.position.set(sd * (b + 1.6), 0, z); tor.rotation.y = sd * (i === 0 ? 1.2 : -1.2);
          tor.add(M(G.box(5, 7.5, 0.25), rot, sd * 2.5, 3.75, 0));
          tor.add(M(G.box(5.6, 0.35, 0.3), weiss, sd * 2.5, 3.75, 0, 0, 0, 0.98));
          tor.add(M(G.box(5.6, 0.35, 0.3), weiss, sd * 2.5, 3.75, 0, 0, 0, -0.98));
          g.add(tor);
        }
      }
      if (i % 2 === 0) g.add(M(G.box(0.6, 0.3, 0.6), Mat.leucht('#fff1c0', 1.2), 0, 9.6, 0));
      for (const sd of [-1, 1]) if (i % 3 === 1) g.add(M(G.box(0.3, 0.3, 2.5), holz, sd * b * 0.5, 9.3, 0));
      this.schatten(g);
    });
    // Heuboden-Duft: Heuballen vor der Scheune
    const { A, s } = this.ort(w, e.u);
    for (const k of [-1, 1]) for (const sd of [-1, 1]) {
      const p = w.punkt(s + k * (laenge / 2 + 6), (A.lim + 4) * sd);
      this.ballen(w, p.x, this.boden(w), p.z, A.h, 1);
    }
  },
  ballen(w, x, y, z, r, n) {
    const heu = Mat.lam('#e3c25a', { flatShading: true }), band = Mat.lam('#b08a30');
    for (let i = 0; i < n; i++) {
      const g = this.gruppe(w, x + i * 2.6 * Math.cos(r), y, z - i * 2.6 * Math.sin(r), r + Math.PI / 2);
      g.add(M(G.zyl(1.2, 1.2, 1.6, 10), heu, 0, 1.2, 0, 0, 0, Math.PI / 2));
      g.add(M(G.zyl(1.22, 1.22, 0.15, 10), band, 0.4, 1.2, 0, 0, 0, Math.PI / 2));
      this.schatten(g);
    }
  },
  heuballen(w, e) {
    const o = this.neben(w, e.u, 3, 3, e.nr % 2 ? 1 : -1); if (!o) return;
    this.belegen(w, o.x, o.z, 4);
    this.ballen(w, o.x, o.y, o.z, o.blick, 2);
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    g.add(M(G.zyl(1.2, 1.2, 1.6, 10), Mat.lam('#e3c25a', { flatShading: true }), 1.3, 3.5, 0, 0, 0, Math.PI / 2));
    this.schatten(g);
  },
  kuh(w, x, y, z, r) {
    const g = this.gruppe(w, x, y, z, r);
    const fell = Mat.lam('#f6f4ee'), fleck = Mat.lam('#2a2624'), rosa = Mat.lam('#f0a8a8');
    g.add(M(G.box(1.5, 1.2, 2.6), fell, 0, 1.6, 0));
    g.add(M(G.box(1.52, 0.7, 0.9), fleck, 0, 1.8, 0.4));
    g.add(M(G.box(0.9, 0.6, 0.7), fleck, 0.31, 1.5, -0.7));
    g.add(M(G.box(0.9, 0.9, 1.0), fell, 0, 2.1, 1.6));
    g.add(M(G.box(0.8, 0.45, 0.4), rosa, 0, 1.85, 2.15));
    for (const sx of [-1, 1]) g.add(M(G.kegel(0.12, 0.45, 5), Mat.lam('#eee0c0'), sx * 0.4, 2.7, 1.5, 0, 0, -sx * 0.6));
    for (const [lx, lz] of [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]) g.add(M(G.box(0.3, 1.1, 0.3), fell, lx, 0.55, lz));
    g.add(M(G.box(0.12, 0.8, 0.12), fell, 0, 1.6, -1.4, 0.5, 0, 0));
    this.schatten(g);
    return g;
  },
  kuehe(w, e) {
    const R = rng(77);
    for (let i = 0; i < 7; i++) {
      const o = this.neben(w, e.u + (R() - 0.5) * 0.12, 6 + R() * 18, 2, R() < 0.5 ? 1 : -1); if (!o) continue;
      this.belegen(w, o.x, o.z, 3);
      const kuh = this.kuh(w, o.x, o.y, o.z, o.blick + (R() - 0.5) * 1.5);
      const kopf = this.lebt(kuh.children[3]);
      const ph = R() * 10;
      w.anim.push(t => { kopf.rotation.x = Math.sin(t * 1.3 + ph) * 0.15; });
    }
  },
  vogelscheuche(w, e) {
    const o = this.neben(w, e.u, 4, 2, e.seite); if (!o) return;
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    const holz = Mat.lam('#7a5232');
    g.add(M(G.zyl(0.12, 0.12, 4, 6), holz, 0, 2, 0));
    g.add(M(G.zyl(0.1, 0.1, 3, 6), holz, 0, 3.1, 0, 0, 0, Math.PI / 2));
    g.add(M(G.box(1.1, 1.3, 0.5), Mat.lam('#3a6ab8'), 0, 3, 0));
    g.add(M(G.box(3.2, 0.4, 0.45), Mat.lam('#c84a3a'), 0, 3.3, 0));
    g.add(M(G.kugel(0.45, 10, 8), Mat.lam('#e8c890'), 0, 4.1, 0));
    g.add(M(G.zyl(0.9, 0.9, 0.1, 10), Mat.lam('#c8a050'), 0, 4.45, 0));
    g.add(M(G.kegel(0.45, 0.6, 10), Mat.lam('#c8a050'), 0, 4.75, 0));
    this.schatten(g);
  },
  // ---------- Palmenstrand ----------
  piratentor(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const holz = Mat.lam('#6a4a2a', { flatShading: true }), seil = Mat.lam('#d8c08a');
    for (const sd of [-1, 1]) {
      for (const dz of [-0.9, 0.9]) g.add(M(G.zyl(0.5, 0.6, 12, 7), holz, sd * (breit + 1.4), 6, dz));
      g.add(M(G.kegel(0.9, 1.4, 7), holz, sd * (breit + 1.4), 12.7, 0));
    }
    g.add(M(G.box(breit * 2 + 4, 1.2, 1.2), holz, 0, 11, 0));
    g.add(M(G.box(breit * 2 + 4, 0.25, 0.25), seil, 0, 10.1, 0.7));
    // Schild mit Totenkopf
    const schild = Tex.holen('piratenschild', () => Tex.aus(Tex.canvas(256, 96, (c, W, H) => {
      c.fillStyle = '#1a1412'; c.fillRect(0, 0, W, H); c.strokeStyle = '#c8a050'; c.lineWidth = 6; c.strokeRect(4, 4, W - 8, H - 8);
      c.fillStyle = '#f4ead0'; c.font = '900 40px "Lilita One", system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PIRATENBUCHT', W / 2, H / 2 + 2);
    })));
    g.add(M(G.box(14, 4, 0.4), [holz, holz, holz, holz, new THREE.MeshLambertMaterial({ map: schild }), new THREE.MeshLambertMaterial({ map: schild })], 0, 13.6, 0));
    for (const sd of [-1, 1]) {
      const f = this.lebt(M(new THREE.PlaneGeometry(3, 2), Mat.lam('#141414', { side: THREE.DoubleSide }), sd * (breit + 1.4) + sd * 1.6, 14.8, 0));
      g.add(f);
      w.anim.push(t => { f.rotation.y = Math.sin(t * 3 + sd) * 0.25; });
      g.add(M(G.zyl(0.08, 0.08, 4, 5), holz, sd * (breit + 1.4), 15, 0));
    }
    this.schatten(g);
  },
  piratenschiff(w, e) {
    const o = this.neben(w, e.u, 22, 14, e.seite); if (!o) return;
    const g = this.gruppe(w, o.x, w.th.wasser ? -1.6 : o.y, o.z, o.blick + 1.2);
    g.rotation.z = 0.18; g.rotation.x = -0.05;
    const holz = Mat.lam('#5a3a22', { flatShading: true }), dunkel = Mat.lam('#3a2616', { flatShading: true }), segel = Mat.lam('#e8dcc0', { side: THREE.DoubleSide });
    g.add(M(G.box(7, 4, 22), holz, 0, 2, 0));
    g.add(M(G.box(6, 1.2, 5), holz, 0, 4.5, -8.5));
    g.add(M(G.kegel(3.5, 6, 4), holz, 0, 2, 13.5, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.6));
    for (const [z, h] of [[-3, 16], [5, 13]]) {
      g.add(M(G.zyl(0.35, 0.45, h, 7), dunkel, 0, 4 + h / 2, z));
      const sg = M(new THREE.PlaneGeometry(8, h * 0.45, 4, 3), segel, 0, 4 + h * 0.6, z + 0.4);
      const pos = sg.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.6) * 0.5 + (Math.random() - 0.5) * 0.4);
      sg.geometry.computeVertexNormals();
      g.add(sg);
    }
    const flagge = this.lebt(M(new THREE.PlaneGeometry(2.4, 1.5), Mat.lam('#111111', { side: THREE.DoubleSide }), 0, 21, -3));
    g.add(flagge);
    g.add(M(G.kugel(0.35, 8, 6), Mat.lam('#f4f0e0'), 0.05, 21.1, -2.95));
    w.anim.push(t => { flagge.rotation.y = Math.sin(t * 2.5) * 0.4; });
    this.schatten(g);
    // Schatztruhe am Ufer
    const tr = this.gruppe(w, o.x + Math.sin(o.blick) * 18, this.boden(w) + 0.6, o.z + Math.cos(o.blick) * 18, o.blick);
    tr.add(M(G.box(2, 1.2, 1.3), Mat.lam('#7a4a22'), 0, 0.6, 0));
    tr.add(M(G.box(2.05, 0.2, 1.35), Mat.std('#e0b030', { metalness: 0.6, roughness: 0.3 }), 0, 1.0, 0));
    tr.add(M(G.box(1.6, 0.4, 1.0), Mat.leucht('#ffd23a', 0.9), 0, 1.4, 0));
    this.schatten(tr);
  },
  leuchtturm(w, e) {
    const o = this.neben(w, e.u, 25, 6, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 8);
    const g = this.gruppe(w, o.x, o.y, o.z, 0);
    g.add(M(G.zyl(6, 7, 3, 10), Mat.lam('#9a8a7a', { flatShading: true }), 0, 1.5, 0));
    for (let i = 0; i < 5; i++) g.add(M(G.zyl(2.6 - i * 0.25, 2.8 - i * 0.25, 5, 14), Mat.lam(i % 2 ? '#e8322f' : '#ffffff'), 0, 5.5 + i * 5, 0));
    g.add(M(G.zyl(1.7, 1.7, 2.6, 10), Mat.leucht('#fff4a0', 1.2), 0, 29.3, 0));
    g.add(M(G.kegel(2.3, 2.6, 10), Mat.lam('#e8322f'), 0, 31.9, 0));
    const strahl = M(new THREE.ConeGeometry(4, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 20, Math.PI / 2, 0, 0);
    const dreh = this.lebt(new THREE.Group()); dreh.position.y = 29.3; dreh.add(strahl); g.add(dreh);
    strahl.castShadow = false;
    w.anim.push(t => { dreh.rotation.y = t * 0.8; });
    this.schatten(g); strahl.castShadow = false; strahl.receiveShadow = false;
  },
  strandkorb(w, e) {
    const o = this.neben(w, e.u, 4, 4, e.nr % 2 ? 1 : -1); if (!o) return;
    const farben = ['#ff4a5a', '#3a8aff', '#ffd23a', '#2ccf8a'];
    for (let i = 0; i < 3; i++) {
      const g = this.gruppe(w, o.x + (i - 1) * 3.5 * Math.cos(o.blick), o.y, o.z - (i - 1) * 3.5 * Math.sin(o.blick), o.blick);
      const f = farben[(e.nr + i) % 4];
      g.add(M(G.zyl(0.06, 0.06, 3.2, 5), Mat.lam('#eeeeee'), 0, 1.6, 0));
      g.add(M(G.kegel(1.9, 0.8, 8), Mat.lam(f), 0, 3.2, 0));
      g.add(M(G.box(1.1, 0.06, 2.2), Mat.lam(i % 2 ? '#ffffff' : f), 0.9, 0.05, 0.6));
      this.schatten(g);
    }
  },
  // ---------- Wüstenschlucht ----------
  felsbogen(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const fels = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const R = breit + 4;
    const geo = new THREE.TorusGeometry(R, 4.2, 7, 22, Math.PI);
    const pos = geo.attributes.position, col = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = rausch(x * 0.4, y * 0.4, z * 0.4 + e.nr * 7);
      pos.setXYZ(i, x + n * 1.2, y + n * 0.8, z + rausch(y * 0.5, z, x * 0.5) * 1.5);
      Waende.felsFarbe(y * 0.35, n, c); col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const bogen = new THREE.Mesh(geo, fels);
    bogen.scale.set(1, 0.62, 1); bogen.position.y = -1;
    g.add(bogen);
    for (const sd of [-1, 1]) {
      const fuss = new THREE.Mesh(new THREE.DodecahedronGeometry(5.5, 1), fels);
      const fp = fuss.geometry.attributes.position, fc = [];
      for (let i = 0; i < fp.count; i++) { const n = rausch(fp.getX(i) + sd * 9, fp.getY(i), fp.getZ(i)); fp.setY(i, fp.getY(i) * 1.3 + n); Waende.felsFarbe(fp.getY(i) * 0.3 + 1, n, c); fc.push(c.r, c.g, c.b); }
      fuss.geometry.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fuss.geometry.computeVertexNormals();
      fuss.position.set(sd * (R + 1), 2, 0);
      g.add(fuss);
    }
    this.schatten(g);
  },
  sphinx(w, e) {
    const o = this.neben(w, e.u, 18, 14, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 18);
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    const st = Mat.lam('#d8b070', { flatShading: true }), dunkel = Mat.lam('#b08850', { flatShading: true }), blau = Mat.lam('#2a5aa8', { flatShading: true });
    g.add(M(G.box(14, 2, 26), dunkel, 0, 1, -2));
    g.add(M(G.box(9, 7, 16), st, 0, 5.5, -5));
    for (const sx of [-1, 1]) g.add(M(G.box(2.6, 2.2, 9), st, sx * 3.2, 3.1, 7));
    g.add(M(G.box(6.5, 8, 6), st, 0, 12, 2.5));
    g.add(M(G.box(5, 6, 4.5), Mat.lam('#e6c082', { flatShading: true }), 0, 12.5, 4.4));
    for (let i = 0; i < 6; i++) g.add(M(G.box(6.7, 0.5, 6.1), i % 2 ? blau : Mat.lam('#e0b030'), 0, 9 + i * 1.2, 2.4));
    for (const sx of [-1, 1]) g.add(M(G.box(0.8, 0.4, 0.2), Mat.lam('#3a2a1a'), sx * 1.2, 13.4, 6.7));
    g.add(M(G.box(0.8, 3, 0.6), Mat.lam('#e0b030'), 0, 8.5, 6.6));
    this.schatten(g);
  },
  skarabaeus(w, e) {
    const o = this.neben(w, e.u, 4, 4, e.seite); if (!o) return;
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    const gold = Mat.std('#f0c030', { metalness: 0.8, roughness: 0.25, emissive: new THREE.Color('#5a3a00'), emissiveIntensity: 0.4 });
    g.add(M(G.box(3.2, 3, 3.2), Mat.lam('#c89a5a', { flatShading: true }), 0, 1.5, 0));
    const k = this.lebt(new THREE.Group()); k.position.y = 4; g.add(k);
    k.add(M(G.kugel(1.3, 12, 8), gold, 0, 0, 0, 0, 0, 0, 1, 0.55, 1.4));
    k.add(M(G.kugel(0.6, 10, 8), gold, 0, 0.1, 1.6, 0, 0, 0, 1, 0.6, 0.8));
    for (const sx of [-1, 1]) for (const z of [-0.6, 0.2, 1]) k.add(M(G.box(1.4, 0.12, 0.14), gold, sx * 1.1, -0.3, z, 0, 0, sx * 0.4));
    w.anim.push(t => { k.rotation.y = t * 0.8; k.position.y = 4 + Math.sin(t * 2) * 0.2; });
    this.schatten(g);
  },
  // ---------- Dschungeltempel ----------
  tempeltor(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const st = Mat.lam('#a8a07a', { flatShading: true }), moos = Mat.lam('#4f9a3a', { flatShading: true });
    for (const sd of [-1, 1]) {
      g.add(M(G.box(3.6, 13, 3.6), st, sd * (breit + 2), 6.5, 0));
      g.add(M(G.box(4.4, 1, 4.4), st, sd * (breit + 2), 13.4, 0));
      g.add(M(G.box(3.8, 0.6, 3.8), moos, sd * (breit + 2), 1, 0));
    }
    g.add(M(G.box(breit * 2 + 8, 3, 4), st, 0, 15, 0));
    g.add(M(G.box(breit * 2 + 6, 0.5, 4.2), moos, 0, 16.7, 0));
    // Affenkopf
    const kopf = new THREE.Group(); kopf.position.set(0, 20, 0); g.add(kopf);
    kopf.add(M(G.kugel(3.4, 10, 8), st, 0, 0, 0));
    for (const sx of [-1, 1]) kopf.add(M(G.kugel(1.3, 8, 6), st, sx * 3.4, 0.4, 0, 0, 0, 0, 0.5, 1, 1));
    kopf.add(M(G.kugel(2.2, 10, 8), Mat.lam('#c8b890', { flatShading: true }), 0, -0.8, -2.2, 0, 0, 0, 1.2, 0.8, 0.6));
    for (const sx of [-1, 1]) kopf.add(M(G.kugel(0.55, 8, 6), Mat.leucht('#3affb0', 1.6), sx * 1.2, 0.8, -2.9));
    for (const sx of [-1, 1]) kopf.add(M(G.kugel(0.55, 8, 6), Mat.leucht('#3affb0', 1.6), sx * 1.2, 0.8, 2.9));
    // Lianen
    const liane = Mat.lam('#2f7a2a');
    for (let i = 0; i < 9; i++) g.add(M(G.zyl(0.08, 0.08, 2 + (i % 3) * 1.5, 4), liane, -breit + i * breit / 4, 13.4 - (i % 3) * 0.75, 2.1));
    this.schatten(g);
  },
  wasserfall(w, e) {
    const o = this.neben(w, e.u, 10, 12, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 14);
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick + Math.PI);
    const fels = Mat.lam('#6a7a6a', { flatShading: true });
    g.add(M(new THREE.DodecahedronGeometry(9, 1), fels, 0, 6, 4, 0, 0, 0, 1.4, 1.6, 0.8));
    for (const sx of [-1, 1]) g.add(M(new THREE.DodecahedronGeometry(5, 0), fels, sx * 9, 3, 1));
    const tex = Tex.holen('wasserfall', () => { const t = Tex.aus(Tex.canvas(64, 256, (c, W, H) => {
      c.fillStyle = '#7ad0f0'; c.fillRect(0, 0, W, H);
      const R = rng(4); for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.5})`; c.fillRect(R() * W, R() * H, 2 + R() * 4, 10 + R() * 30); }
    })); return t; });
    const wf = M(new THREE.PlaneGeometry(6, 16), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85 }), 0, 8, -2.2);
    wf.castShadow = false; g.add(wf);
    w.anim.push(t => { tex.offset.y = t * 1.2; });
    const becken = M(G.zyl(7, 7, 0.3, 16), new THREE.MeshLambertMaterial({ color: '#3a9ad0', transparent: true, opacity: 0.85 }), 0, 0.15, -5);
    becken.castShadow = false; g.add(becken);
    this.schatten(g); wf.castShadow = false; becken.castShadow = false;
  },
  affenstatue(w, e) {
    const o = this.neben(w, e.u, 3, 3, e.nr % 2 ? 1 : -1); if (!o) return;
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick);
    const st = Mat.lam('#9a9470', { flatShading: true });
    g.add(M(G.box(3, 1.4, 3), st, 0, 0.7, 0));
    g.add(M(G.kugel(1.2, 8, 6), st, 0, 2.6, 0, 0, 0, 0, 1, 1.1, 0.9));
    g.add(M(G.kugel(0.85, 8, 6), st, 0, 4.1, 0));
    for (const sx of [-1, 1]) { g.add(M(G.kugel(0.35, 6, 4), st, sx * 0.85, 4.2, 0)); g.add(M(G.box(0.35, 1.4, 0.35), st, sx * 0.8, 3, 0.6, -1.0, 0, 0)); }
    g.add(M(G.kugel(0.2, 6, 4), Mat.leucht('#3affb0', 1.4), -0.3, 4.2, 0.75)); g.add(M(G.kugel(0.2, 6, 4), Mat.leucht('#3affb0', 1.4), 0.3, 4.2, 0.75));
    this.schatten(g);
  },
  // ---------- Eisgipfel ----------
  seilbahn(w) {
    // Talstation beim Start, Bergstation beim höchsten Punkt
    let hoch = 0; for (let i = 0; i < w.n; i++) if (w.S[i].p.y > w.S[hoch].p.y) hoch = i;
    const uTal = 0.97, uBerg = (((w.S[hoch].s - w.startS) / w.L) % 1 + 1) % 1;
    const a = this.neben(w, uTal, 16, 7), b = this.neben(w, uBerg, 16, 7);
    if (!a || !b) return;
    a.y = this.boden(w); b.y = w.S[hoch].p.y - 2;
    const holz = Mat.lam('#7a5232'), dach = Mat.lam('#3a4a6a', { flatShading: true }), stahl = Mat.lam('#8a90a0');
    for (const st of [a, b]) {
      this.belegen(w, st.x, st.z, 9);
      const g = this.gruppe(w, st.x, st.y, st.z, Math.atan2(b.x - a.x, b.z - a.z));
      g.add(M(G.box(8, 6, 10), holz, 0, 3, 0));
      g.add(M(G.box(9, 0.6, 11), Mat.lam('#ffffff'), 0, 6.3, 0));
      g.add(M(G.kegel(7, 3, 4), dach, 0, 8, 0, 0, Math.PI / 4, 0));
      this.schatten(g);
    }
    const A = new THREE.Vector3(a.x, a.y + 12, a.z), B = new THREE.Vector3(b.x, b.y + 12, b.z);
    const dist = A.distanceTo(B), n = Math.max(1, Math.round(dist / 70));
    // Stützen
    for (let i = 1; i < n; i++) {
      const p = A.clone().lerp(B, i / n);
      p.y += Math.sin(i / n * Math.PI) * 8;
      let unten = this.boden(w); const P = {}; w.proj(P, p.x, p.y, p.z);
      if (Math.abs(P.d) < P.lim + 3) continue;
      if (P.bodenY > -1e8 && Math.abs(P.d) < P.lim + 30) unten = Math.max(unten, P.bodenY - 3);
      const g = this.gruppe(w, p.x, unten, p.z, Math.atan2(b.x - a.x, b.z - a.z));
      g.add(M(G.box(1.2, p.y - unten + 1, 1.2), stahl, 0, (p.y - unten + 1) / 2, 0));
      g.add(M(G.box(6, 0.6, 0.8), stahl, 0, p.y - unten + 1, 0));
      this.schatten(g);
    }
    // Seile
    const kurve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const p = A.clone().lerp(B, i / 8); p.y += Math.sin(i / 8 * Math.PI) * 8 - Math.sin(i / 8 * Math.PI * n) * 0.8; return p; }));
    for (const sd of [-1.4, 1.4]) {
      const versatz = new THREE.Vector3(Math.cos(Math.atan2(b.x - a.x, b.z - a.z)) * sd, 0, -Math.sin(Math.atan2(b.x - a.x, b.z - a.z)) * sd);
      const pts = kurve.getPoints(60).map(p => p.add(versatz));
      w.gruppe.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.08, 4), Mat.lam('#333333')));
    }
    // Gondeln fahren hin und her
    const farben = ['#e8322f', '#ffd23a', '#2f6fe8', '#2ccf8a'];
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i < 4; i++) {
      const gd = new THREE.Group();
      gd.add(M(G.box(2.6, 2.4, 3.2), Mat.lam(farben[i]), 0, -2.4, 0));
      gd.add(M(G.box(2.7, 0.9, 3.3), Mat.std('#bfe6ff', { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 }), 0, -1.9, 0));
      gd.add(M(G.zyl(0.06, 0.06, 1.4, 4), stahl, 0, -0.6, 0));
      w.gruppe.add(gd);
      const sd = i % 2 ? 1.4 : -1.4, versatz = new THREE.Vector3(Math.cos(yaw) * sd, 0, -Math.sin(yaw) * sd);
      w.anim.push(t => {
        let f = ((t * 0.018 + i * 0.25) % 1); if (i % 2) f = 1 - f;
        gd.position.copy(kurve.getPoint(f)).add(versatz); gd.rotation.y = yaw;
      });
    }
  },
  skihuette(w, e) {
    const o = this.neben(w, e.u, 8, 9, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 11);
    const y = Math.max(o.y, w.S[w.idx(o.s)].p.y - 1.5);
    const g = this.gruppe(w, o.x, y, o.z, o.blick);
    const holz = Mat.lam('#8a5a32'), dunkel = Mat.lam('#5a3a22'), schnee = Mat.lam('#ffffff', { flatShading: true });
    g.add(M(G.box(14, 1, 12), Mat.lam('#7a7a80', { flatShading: true }), 0, -0.2, 0));
    g.add(M(G.box(12, 6, 10), holz, 0, 3, 0));
    for (let i = 0; i < 6; i++) g.add(M(G.box(12.2, 0.18, 10.2), dunkel, 0, 0.8 + i, 0));
    for (const sd of [-1, 1]) g.add(M(G.box(7.6, 0.6, 12), schnee, sd * 3.4, 8.2, 0, 0, 0, -sd * 0.6));
    for (const sx of [-3.5, 0, 3.5]) g.add(M(G.box(1.8, 1.6, 0.2), Mat.leucht('#ffd890', 0.8), sx, 3.6, 5.05));
    g.add(M(G.box(1.2, 4, 1.2), Mat.lam('#7a6a60', { flatShading: true }), 3.5, 9, -2));
    g.add(M(G.box(2.4, 3.4, 0.3), dunkel, 0, 1.7, 5.1));
    // Ski an der Wand
    for (let i = 0; i < 4; i++) g.add(M(G.box(0.15, 3.4, 0.08), Mat.lam(['#e8322f', '#2f6fe8', '#ffd23a', '#2ccf8a'][i]), -5.5 + i * 0.4, 2, 5.2, 0, 0, 0.12));
    this.schatten(g);
    // Rauch
    const rauch = [];
    for (let i = 0; i < 5; i++) { const r = this.lebt(M(G.kugel(0.8, 8, 6), new THREE.MeshLambertMaterial({ color: '#dddddd', transparent: true, opacity: 0.5 }), 3.5, 11 + i * 1.5, -2)); r.castShadow = false; g.add(r); rauch.push(r); }
    w.anim.push(t => rauch.forEach((r, i) => { const f = (t * 0.3 + i / 5) % 1; r.position.y = 11 + f * 7; r.position.x = 3.5 + f * 2; r.scale.setScalar(0.6 + f * 1.6); r.material.opacity = 0.55 * (1 - f); }));
  },
  eishoehle(w, e) {
    const eis = new THREE.MeshStandardMaterial({ color: '#a8e0ff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88, flatShading: true });
    const eisD = new THREE.MeshStandardMaterial({ color: '#6ab8e8', roughness: 0.2, metalness: 0.1, flatShading: true });
    const R = rng(91);
    this._tunnel(w, e.u, 40, (g, b, i, n, st) => {
      for (const sd of [-1, 1]) {
        g.add(M(new THREE.DodecahedronGeometry(3.4, 0), eisD, sd * (b + 2.2), 3 + R(), 0, R(), R(), R(), 1, 1.6, 1.2));
        g.add(M(new THREE.DodecahedronGeometry(3, 0), eis, sd * (b - 2), 9.5 + R(), 0, R(), R(), R(), 2.2, 0.9, 1.2));
      }
      g.add(M(new THREE.DodecahedronGeometry(4, 0), eis, 0, 12 + R(), 0, R(), R(), R(), 3, 0.8, 1.2));
      for (let k = 0; k < 3; k++) { const x = (R() - 0.5) * b * 1.6; g.add(M(G.kegel(0.35 + R() * 0.3, 1.5 + R() * 2.5, 5), eis, x, 9.2 - R(), (R() - 0.5) * st, Math.PI, 0, 0)); }
      if (i % 3 === 0) g.add(M(new THREE.OctahedronGeometry(0.6, 0), Mat.leucht('#7af0ff', 1.6), (R() - 0.5) * b, 10, 0));
      this.schatten(g);
    });
  },
  // ---------- Neonstadt ----------
  tunnel(w, e) {
    const beton = Mat.lam('#6a6e78'), neonA = new THREE.MeshBasicMaterial({ color: '#ff2fa8' }), neonB = new THREE.MeshBasicMaterial({ color: '#2ff0ff' });
    w.anim.push(t => { neonA.color.setHSL((0.9 + Math.sin(t) * 0.05 + 1) % 1, 1, 0.55); });
    this._tunnel(w, e.u, e.laenge || 60, (g, b, i, n, st) => {
      for (const sd of [-1, 1]) g.add(M(G.box(1.5, 8.5, st + 0.2), beton, sd * (b + 0.9), 4.25, 0));
      g.add(M(G.box(b * 2 + 3.2, 1.2, st + 0.2), beton, 0, 8.9, 0));
      for (const sd of [-1, 1]) g.add(M(G.box(0.15, 0.25, st + 0.2), sd < 0 ? neonA : neonB, sd * (b + 0.12), 6.5, 0));
      if (i % 2 === 0) g.add(M(G.box(b * 1.2, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: '#fff2c0' }), 0, 8.25, 0));
      if (i === 0 || i === n) {
        const z = i === 0 ? -st / 2 : st / 2;
        g.add(M(G.box(b * 2 + 6, 3, 1.2), beton, 0, 10.5, z));
        g.add(M(G.box(b * 1.6, 0.6, 0.2), neonB, 0, 10.5, z + (i === 0 ? -0.65 : 0.65)));
      }
      this.schatten(g);
    });
  },
  riesenrad(w, e) {
    const o = this.neben(w, e.u, 14, 20, e.seite); if (!o) return;
    this.belegen(w, o.x, o.z, 22);
    const g = this.gruppe(w, o.x, o.y, o.z, o.blick + Math.PI / 2);
    const stahl = Mat.lam('#c8ccd8');
    for (const sz of [-3, 3]) for (const sx of [-1, 1]) g.add(M(G.box(0.8, 26, 0.8), stahl, sx * 6, 12, sz, 0, 0, sx * 0.25));
    const rad = this.lebt(new THREE.Group()); rad.position.y = 24; g.add(rad);
    const licht = new THREE.MeshBasicMaterial({ color: '#ff2fa8' });
    for (const sz of [-2.5, 2.5]) { rad.add(M(G.torus(18, 0.35, TAU, 6, 40), stahl, 0, 0, sz)); rad.add(M(G.torus(18.2, 0.2, TAU, 4, 40), licht, 0, 0, sz)); }
    rad.add(M(G.zyl(1.2, 1.2, 6, 10), stahl, 0, 0, 0, Math.PI / 2, 0, 0));
    const gondeln = [], farben = ['#ff4a5a', '#ffd23a', '#3a8aff', '#2ccf8a', '#c07aff', '#ff8a3a'];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      rad.add(M(G.box(0.3, 18, 0.3), stahl, Math.cos(a) * 9, Math.sin(a) * 9, 0, 0, 0, a + Math.PI / 2));
      const gd = new THREE.Group(); gd.add(M(G.box(2.4, 2.2, 3.2), Mat.lam(farben[i % 6]), 0, -1.6, 0)); gd.add(M(G.box(2.5, 0.8, 3.3), new THREE.MeshBasicMaterial({ color: '#fff2c0' }), 0, -1.2, 0));
      rad.add(gd); gondeln.push([gd, a]);
    }
    w.anim.push(t => {
      rad.rotation.z = t * 0.12;
      for (const [gd, a] of gondeln) { gd.position.set(Math.cos(a) * 18, Math.sin(a) * 18, 0); gd.rotation.z = -rad.rotation.z; }
      licht.color.setHSL((t * 0.15) % 1, 1, 0.6);
    });
  },
  neonbogen(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const farbe = ['#ff2fa8', '#2ff0ff', '#ffe02f', '#7a5aff'][e.nr % 4];
    const m = new THREE.MeshBasicMaterial({ color: farbe });
    const bogen = M(G.torus(breit + 1, 0.35, Math.PI, 8, 40), m, 0, 0, 0);
    bogen.scale.set(1, 0.6, 1); bogen.castShadow = false;
    g.add(bogen);
    for (const sd of [-1, 1]) g.add(M(G.box(1.2, 1.2, 1.2), Mat.lam('#33363e'), sd * (breit + 1), 0.6, 0));
    w.anim.push(t => { m.color.setHSL(((e.nr * 0.25 + t * 0.2) % 1), 1, 0.6); });
  },
  // ---------- Lavaburg ----------
  turm(g, x, z, h, st, dach) {
    g.add(M(G.zyl(3, 3.4, h, 10), st, x, h / 2, z));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(M(G.box(1.1, 1, 1.1), st, x + Math.cos(a) * 2.9, h + 0.5, z + Math.sin(a) * 2.9, 0, -a, 0)); }
    if (dach) g.add(M(G.kegel(3.8, 5, 10), dach, x, h + 3.2, z));
  },
  burgtor(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const st = new THREE.MeshLambertMaterial({ map: Tex.wand('burg'), color: '#d8d0dc' }), dach = Mat.lam('#6a1a1a', { flatShading: true });
    for (const sd of [-1, 1]) this.turm(g, sd * (breit + 3.2), 0, 18, st, dach);
    g.add(M(G.box(breit * 2 + 2, 5, 5), st, 0, 13.5, 0));
    for (let i = 0; i < 9; i++) g.add(M(G.box(1.2, 1.1, 5.2), st, -breit + i * breit / 4, 16.5, 0));
    // Fallgitter oben
    const gitter = Mat.lam('#2a2228');
    for (let i = -6; i <= 6; i++) g.add(M(G.box(0.25, 3.5, 0.25), gitter, i * breit / 7, 12.6, -2.6));
    for (let k = 0; k < 3; k++) g.add(M(G.box(breit * 1.85, 0.2, 0.25), gitter, 0, 11.2 + k * 1.3, -2.6));
    // Banner
    for (const sd of [-1, 1]) {
      const b = M(new THREE.PlaneGeometry(2.6, 7), Mat.lam('#a8141a', { side: THREE.DoubleSide }), sd * (breit * 0.55), 7.5, -2.8);
      g.add(b);
      g.add(M(G.kugel(0.7, 8, 6), Mat.leucht('#ffb030', 1), sd * (breit * 0.55), 9.5, -2.95));
    }
    this.schatten(g);
  },
  thronsaal(w, e) {
    const st = new THREE.MeshLambertMaterial({ map: Tex.wand('burg'), color: '#c8c0cc' });
    const teppichRot = Mat.lam('#a8141a'), gold = Mat.std('#e0b030', { metalness: 0.7, roughness: 0.3 });
    const flamme = new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    w.anim.push(t => { flamme.opacity = 0.75 + Math.sin(t * 19) * 0.15; });
    this._tunnel(w, e.u, e.laenge || 80, (g, b, i, n, st2) => {
      for (const sd of [-1, 1]) g.add(M(G.box(2, 11, st2 + 0.2), st, sd * (b + 1.1), 5.5, 0));
      g.add(M(G.box(b * 2 + 4.4, 1.5, st2 + 0.2), st, 0, 11.6, 0));
      if (i % 3 === 0) for (const sd of [-1, 1]) {
        g.add(M(G.zyl(1, 1.2, 11, 8), st, sd * (b - 0.6), 5.5, 0));
        g.add(M(G.box(1.8, 6, 0.1), teppichRot, sd * (b - 0.02), 6.5, 0, 0, sd * Math.PI / 2, 0));
        g.add(M(G.kugel(0.45, 6, 4), flamme, sd * (b - 1.2), 8.6, 0));
      }
      if (i % 4 === 2) {
        const leuchter = M(G.torus(2, 0.15, TAU, 4, 16), gold, 0, 9.4, 0, Math.PI / 2, 0, 0); g.add(leuchter);
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.add(M(G.kegel(0.18, 0.5, 5), flamme, Math.cos(a) * 2, 9.8, Math.sin(a) * 2)); }
      }
      if (i === n) {
        // Thron am Ende über dem Ausgang
        g.add(M(G.box(6, 4, 2), gold, 0, 14.5, st2 / 2));
        g.add(M(G.box(3.4, 2.4, 2.2), teppichRot, 0, 14, st2 / 2 + 0.2));
      }
      this.schatten(g);
    });
  },
  zugbruecke(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const kette = Mat.std('#5a5860', { metalness: 0.7, roughness: 0.4 }), st = new THREE.MeshLambertMaterial({ map: Tex.wand('burg'), color: '#d8d0dc' });
    for (const z of [-14, 14]) for (const sd of [-1, 1]) {
      g.add(M(G.box(2.2, 9, 2.2), st, sd * (breit + 1.4), 4.5 - 1, z));
      g.add(M(G.box(0.18, 0.18, 15), kette, sd * (breit + 0.4), 5, z * 0.5, Math.atan2(7, 14) * (z > 0 ? 1 : -1), 0, 0));
    }
    this.schatten(g);
  },
  lavafontaene(w, e) {
    const o = this.neben(w, e.u, 8, 4, e.nr % 2 ? 1 : -1); if (!o) return;
    const g = this.gruppe(w, o.x, this.boden(w), o.z, 0);
    g.add(M(new THREE.DodecahedronGeometry(3.5, 0), Mat.lam('#2a1a16', { flatShading: true }), 0, -0.5, 0, 0, 0, 0, 1, 0.5, 1));
    const lava = new THREE.MeshBasicMaterial({ color: '#ff7a10' });
    const strahl = this.lebt(M(G.zyl(0.6, 1.4, 1, 8), lava, 0, 0.5, 0)); strahl.castShadow = false; g.add(strahl);
    const tropfen = [];
    for (let i = 0; i < 6; i++) { const tp = this.lebt(M(G.kugel(0.5, 6, 4), lava, 0, 0, 0)); tp.castShadow = false; g.add(tp); tropfen.push(tp); }
    const ph = e.nr * 1.7;
    w.anim.push(t => {
      const x = ((t + ph) % 6) / 6, an = x < 0.35 ? Math.sin(x / 0.35 * Math.PI) : 0;
      strahl.scale.set(1, 0.01 + an * 14, 1); strahl.position.y = an * 7;
      tropfen.forEach((tp, i) => { const a = i / 6 * TAU; tp.visible = an > 0.05; tp.position.set(Math.cos(a) * an * 3, an * (12 + i), Math.sin(a) * an * 3); });
    });
  },
  // ---------- Regenbogenbahn ----------
  sternentor(w, e) {
    const { g, breit } = this.ueber(w, e.u);
    const m = new THREE.MeshBasicMaterial({ color: '#ff7ae0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = M(G.torus(breit + 3, 0.5, TAU, 8, 48), m, 0, 2, 0); ring.castShadow = false; g.add(ring);
    const sterne = this.lebt(new THREE.Group()); g.add(sterne); sterne.position.y = 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const s = M(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: '#fff6a0' }), Math.cos(a) * (breit + 3), Math.sin(a) * (breit + 3), 0); s.castShadow = false; sterne.add(s); }
    w.anim.push(t => { m.color.setHSL((e.nr * 0.2 + t * 0.12) % 1, 1, 0.65); sterne.rotation.z = t * 0.6 * (e.nr % 2 ? 1 : -1); });
  },
  raumstation(w, e) {
    const { p, A } = this.ort(w, e.u);
    const g = this.lebt(this.gruppe(w, p.x + A.rh.x * 90, p.y + 30, p.z + A.rh.z * 90, A.h));
    const weiss = Mat.std('#e8ecf4', { metalness: 0.4, roughness: 0.35 }), panel = Mat.std('#2a4aa8', { metalness: 0.6, roughness: 0.3, emissive: new THREE.Color('#0a1a5a'), emissiveIntensity: 0.6 });
    const ring = new THREE.Group(); g.add(ring);
    ring.add(M(G.torus(22, 2.2, TAU, 10, 48), weiss));
    for (let i = 0; i < 4; i++) ring.add(M(G.box(0.8, 44, 0.8), weiss, 0, 0, 0, 0, 0, i * Math.PI / 4));
    g.add(M(G.zyl(5, 5, 14, 16), weiss, 0, 0, 0, Math.PI / 2, 0, 0));
    for (const sd of [-1, 1]) g.add(M(G.box(30, 0.3, 8), panel, sd * 28, 0, 0));
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ring.add(M(G.box(1, 1, 1), Mat.leucht(i % 2 ? '#7af0ff' : '#ff7ae0', 1.5), Math.cos(a) * 22, Math.sin(a) * 22, 2.3)); }
    w.anim.push(t => { ring.rotation.z = t * 0.15; g.position.y = p.y + 30 + Math.sin(t * 0.4) * 2; });
  },
};

// Statische Meshes mehrerer Gruppen pro Material (und Schattenart) zu je einem Mesh zusammenfassen.
// Bewegte Teile (userData.lebt bei sich oder einem Vorfahren) bleiben, wie sie sind.
function verschmelzen(gruppen, ziel) {
  const toepfe = new Map();
  ziel.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(ziel.matrixWorld).invert();
  const lebt = (o, wurzel) => { for (let p = o; p; p = p.parent) { if (p.userData && p.userData.lebt) return true; if (p === wurzel) break; } return false; };
  for (const wurzel of gruppen) {
    const weg = [];
    wurzel.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || lebt(o, wurzel)) return;
      const key = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'e' : '');
      if (!toepfe.has(key)) toepfe.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      toepfe.get(key).geos.push(g);
      weg.push(o);
    });
    for (const o of weg) o.parent.remove(o);
  }
  for (const t of toepfe.values()) {
    const farbig = !!t.mat.vertexColors;
    let n = 0; for (const g of t.geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = farbig ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const g of t.geos) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (col) { if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); }
      o += c;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, t.mat);
    m.castShadow = t.cast; m.receiveShadow = t.recv;
    ziel.add(m);
  }
}
