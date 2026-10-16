// Gitterkrieg – das dynamische Hintergrundgitter: Massepunkte mit Federn, verformt durch Kräfte (mit Tiefe z)
'use strict';

const Gitter = (() => {
  const SP = 40;
  const C = Math.round(AW / SP) + 1, RW = Math.round(AH / SP) + 1, N = C * RW;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  const ax = new Float32Array(N), ay = new Float32Array(N), az = new Float32Array(N);
  const rx = new Float32Array(N), ry = new Float32Array(N);
  const damp = new Float32Array(N);
  const sx = new Float32Array(N), sy = new Float32Array(N), en = new Float32Array(N);   // projiziert + Energie
  // Federn zwischen Nachbarn
  const springs = [];
  // Anker: Punkt zieht zur Ruheposition
  const anchors = [];
  for (let j = 0; j < RW; j++) for (let i = 0; i < C; i++) {
    const k = j * C + i;
    px[k] = rx[k] = i * SP; py[k] = ry[k] = j * SP; damp[k] = 0.98;
    if (i > 0) springs.push(k - 1, k);
    if (j > 0) springs.push(k - C, k);
    if (i === 0 || j === 0 || i === C - 1 || j === RW - 1) anchors.push(k, 0.1, 0.1);
    else if (i % 3 === 0 && j % 3 === 0) anchors.push(k, 0.002, 0.02);
  }
  const SPR = new Int32Array(springs), NS = SPR.length / 2;
  const SL = SP * 0.95, SK = 0.28, SD = 0.06;
  const ANC = Float32Array.from(anchors), NA = ANC.length / 3;

  function step() {
    for (let s = 0; s < NS; s++) {
      const a = SPR[s * 2], b = SPR[s * 2 + 1];
      const dx = px[a] - px[b], dy = py[a] - py[b], dz = pz[a] - pz[b];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len <= SL) continue;
      const f = (len - SL) / len;
      const fx = SK * dx * f - (vx[b] - vx[a]) * SD;
      const fy = SK * dy * f - (vy[b] - vy[a]) * SD;
      const fz = SK * dz * f - (vz[b] - vz[a]) * SD;
      ax[a] -= fx; ay[a] -= fy; az[a] -= fz;
      ax[b] += fx; ay[b] += fy; az[b] += fz;
    }
    for (let s = 0; s < NA; s++) {
      const k = ANC[s * 3], st = ANC[s * 3 + 1], sd = ANC[s * 3 + 2];
      ax[k] -= (px[k] - rx[k]) * st + vx[k] * sd;
      ay[k] -= (py[k] - ry[k]) * st + vy[k] * sd;
      az[k] -= pz[k] * st + vz[k] * sd;
    }
    for (let k = 0; k < N; k++) {
      let x = vx[k] + ax[k], y = vy[k] + ay[k], z = vz[k] + az[k];
      ax[k] = ay[k] = az[k] = 0;
      px[k] += x; py[k] += y; pz[k] += z;
      const v2 = x * x + y * y + z * z;
      if (v2 < 1e-6) { x = y = z = 0; }
      else if (v2 > 784) { const f = 28 / Math.sqrt(v2); x *= f; y *= f; z *= f; }   // Tempolimit, damit nichts zerreisst
      if (pz[k] > 500) pz[k] = 500; else if (pz[k] < -700) pz[k] = -700;
      const d = damp[k];
      vx[k] = x * d; vy[k] = y * d; vz[k] = z * d;
      damp[k] = 0.98;
    }
  }

  // Indexbereich der Punkte im Umkreis
  function range(x, y, r, fn) {
    const i0 = Math.max(0, Math.floor((x - r) / SP) - 1), i1 = Math.min(C - 1, Math.ceil((x + r) / SP) + 1);
    const j0 = Math.max(0, Math.floor((y - r) / SP) - 1), j1 = Math.min(RW - 1, Math.ceil((y + r) / SP) + 1);
    const r2 = r * r;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * C + i;
      const dx = px[k] - x, dy = py[k] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) fn(k, dx, dy, d2);
    }
  }

  // gerichtete Kraft (z.B. Schiffe, Geschosse)
  function directed(fx, fy, fz, x, y, r) {
    range(x, y, r, (k, dx, dy, d2) => {
      const m = 10 / (10 + Math.sqrt(d2));
      ax[k] += fx * m; ay[k] += fy * m; az[k] += fz * m;
    });
  }
  // Sog (Schwarze Löcher)
  function implosive(force, x, y, r, z) {
    z = z || 0;
    range(x, y, r, (k, dx, dy, d2) => {
      const dz = pz[k] - z;
      const m = 10 * force / (100 + d2 + dz * dz);
      ax[k] -= dx * m; ay[k] -= dy * m; az[k] -= dz * m;
      damp[k] *= 0.6;
    });
  }
  // Druckwelle (Explosionen, Bomben)
  function explosive(force, x, y, r, z) {
    z = z === undefined ? -60 : z;
    range(x, y, r, (k, dx, dy, d2) => {
      const dz = pz[k] - z;
      const m = 100 * force / (10000 + d2 + dz * dz);
      ax[k] += dx * m; ay[k] += dy * m; az[k] += dz * m;
      damp[k] *= 0.6;
    });
  }

  function reset() {
    for (let k = 0; k < N; k++) { px[k] = rx[k]; py[k] = ry[k]; pz[k] = vx[k] = vy[k] = vz[k] = 0; }
  }

  // Zeichnen: Hauptlinien, jede dritte heller, dazu feine Zwischenlinien
  const BASE = [0.12, 0.13, 0.62], HOT = [0.5, 0.65, 1.7];
  function draw(camX, camY) {
    const v = R.view;
    for (let k = 0; k < N; k++) {
      const f = clamp((pz[k] + 2000) / 2000, 0.65, 1.25);
      sx[k] = camX + (px[k] - camX) * f;
      sy[k] = camY + (py[k] - camY) * f;
      const dx = px[k] - rx[k], dy = py[k] - ry[k];
      en[k] = Math.min(1, (Math.sqrt(dx * dx + dy * dy) + Math.abs(pz[k]) * 0.6) / 45);
    }
    const i0 = Math.max(0, Math.floor(v[0] / SP) - 2), i1 = Math.min(C - 1, Math.ceil(v[2] / SP) + 2);
    const j0 = Math.max(0, Math.floor(v[1] / SP) - 2), j1 = Math.min(RW - 1, Math.ceil(v[3] / SP) + 2);
    const line = (a, b, thick, alpha) => {
      const e = (en[a] + en[b]) * 0.5;
      const cr = BASE[0] + (HOT[0] - BASE[0]) * e, cg = BASE[1] + (HOT[1] - BASE[1]) * e, cb = BASE[2] + (HOT[2] - BASE[2]) * e;
      R.seg(sx[a], sy[a], sx[b], sy[b], thick ? 2.2 : 1.5, cr, cg, cb, alpha * (1 + e * 2.2));
    };
    for (let j = j0; j <= j1; j++) {
      const thick = j % 3 === 0;
      for (let i = i0; i < i1; i++) { const k = j * C + i; line(k, k + 1, thick, thick ? 0.27 : 0.15); }
    }
    for (let i = i0; i <= i1; i++) {
      const thick = i % 3 === 0;
      for (let j = j0; j < j1; j++) { const k = j * C + i; line(k, k + C, thick, thick ? 0.27 : 0.15); }
    }
    // Zwischenlinien (Mittelpunkte der Nachbarzellen)
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const k = j * C + i;
        const mx1 = (sx[k] + sx[k + C]) * 0.5, my1 = (sy[k] + sy[k + C]) * 0.5;
        const mx2 = (sx[k + 1] + sx[k + 1 + C]) * 0.5, my2 = (sy[k + 1] + sy[k + 1 + C]) * 0.5;
        const e = (en[k] + en[k + 1] + en[k + C] + en[k + 1 + C]) * 0.25;
        R.seg(mx1, my1, mx2, my2, 1.1, BASE[0] + 0.4 * e, BASE[1] + 0.5 * e, BASE[2] + 0.8 * e, 0.07 + e * 0.35);
        const nx1 = (sx[k] + sx[k + 1]) * 0.5, ny1 = (sy[k] + sy[k + 1]) * 0.5;
        const nx2 = (sx[k + C] + sx[k + C + 1]) * 0.5, ny2 = (sy[k + C] + sy[k + C + 1]) * 0.5;
        R.seg(nx1, ny1, nx2, ny2, 1.1, BASE[0] + 0.4 * e, BASE[1] + 0.5 * e, BASE[2] + 0.8 * e, 0.07 + e * 0.35);
      }
    }
  }

  return { step, directed, implosive, explosive, reset, draw };
})();
