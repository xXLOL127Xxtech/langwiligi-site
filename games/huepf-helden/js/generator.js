'use strict';
// =====================================================================
//  Level-Generator: baut aus Bausteinen jedes Mal ein neues Level
// =====================================================================
const SEG_WEIGHTS = {
  base:   { flat: 2.5, blocks: 4, pit: 3, step: 2, pillars: 2, stairs: 1.4, islands: 2, moving: 1.2, falling: .8, spring: .8, bees: 1, spikes: .8, group: 1.6, hidden: .5 },
  wiese:  {},
  hoehle: { tunnel: 2.2, spikes: 1.3, spring: .3 },
  wueste: { pillars: 3, spikes: 1.2, bees: 1.4 },
  wolken: { islands: 5, moving: 3, falling: 2.2, pit: 3.5, flat: 1, pillars: 1.4, step: 1, stairs: .6, spikes: .3 },
  schnee: { stairs: 2.2, pit: 3.2, step: 3, bees: .4 },
  abend:  { group: 2.2, spring: 1.4, bees: 1.4 },
  burg:   { crusher: 2.6, lavapit: 3, spikes: 1.5, pit: 2, moving: 1.5, stairs: 1.5, islands: 1, falling: 1.5, bees: 0, spring: .4, pillars: 1.2 },
};

function generateLevel({ themeKey, seed, diff, boss }) {
  const th = THEMES[themeKey];
  const rng = makeRng(seed);
  const H = 15, MAXW = 640;
  const g = new Uint8Array(MAXW * H);
  const L = {
    w: MAXW, h: H, g, theme: th, themeKey, seed, ents: [], deko: [], content: new Map(), stars: [],
    spawn: null, checkpoint: null, goal: null, arena: null,
  };
  const ceil = th.ceiling ? 2 : 0;
  const GY_MIN = th.ceiling ? 9 : 8, GY_MAX = 12;
  const set = (tx, ty, c) => { if (tx >= 0 && tx < MAXW && ty >= 0 && ty < H) g[ty * MAXW + tx] = c; };
  const get = (tx, ty) => (tx >= 0 && tx < MAXW && ty >= 0 && ty < H) ? g[ty * MAXW + tx] : 0;
  const ground = (tx, gy) => { for (let ty = gy; ty < H; ty++) set(tx, ty, TILE.G); };
  const pit = tx => { if (th.lava) { set(tx, H - 2, TILE.V); set(tx, H - 1, TILE.V); } };
  const coin = (tx, ty) => { if (ty > ceil && get(tx, ty) === 0) set(tx, ty, TILE.C); };
  const content = (tx, ty, what) => L.content.set(ty * MAXW + tx, what);
  const starSpot = (tx, ty, w = 1) => { if (ty > ceil) L.stars.push({ tx, ty, w }); };
  const enemyKinds = th.enemies;
  const enemy = (kind, tx, ty) => L.ents.push({ type: 'enemy', kind, x: tx * T + T / 2, y: ty * T });
  const pickEnemy = () => rng.weighted(enemyKinds);
  const groundEnemy = (tx, gy) => {
    let k = pickEnemy();
    if (k === 'hummel') { enemy('hummel', tx, gy - rng.i(2, 3)); return; }
    enemy(k, tx, gy);
  };
  const deko = (kind, x, y, extra = {}) => L.deko.push(Object.assign({ kind, x, y, h: rng.f(), s: 0.85 + rng.f() * 0.3 }, extra));
  const decorate = (x0, x1, gy) => {
    for (let tx = x0; tx < x1; tx++) {
      if (th.deko.back.length && rng.chance(.12)) deko(rng.pick(th.deko.back), tx * T + rng.f() * T, gy * T, { back: true, s: 0.8 + rng.f() * .5 });
      if (th.deko.front.length && rng.chance(.16)) {
        const k = rng.pick(th.deko.front);
        if ((k === 'fackel' || k === 'laterne')) { deko(k, tx * T + T / 2, gy * T, { dyn: true, s: 1 }); continue; }
        deko(k, tx * T + rng.f() * T, gy * T + 1);
      }
    }
  };
  const flatRun = (x, len, gy, opt = {}) => {
    for (let i = 0; i < len; i++) ground(x + i, gy);
    if (!opt.noDeko) decorate(x, x + len, gy);
    return x + len;
  };
  let powerGap = 0;
  const blockContent = () => {
    if (powerGap > 34 || rng.chance(.12 + diff * .05)) { powerGap = 0; return 'power'; }
    if (rng.chance(.02)) return 'stern';
    return 'coin';
  };

  // ---------------- Bausteine ----------------
  const S = {
    flat(x, gy) {
      const len = rng.i(5, 9);
      flatRun(x, len, gy);
      const ne = rng.i(0, Math.round(.6 + diff * 1.6));
      for (let i = 0; i < ne; i++) groundEnemy(x + rng.i(2, len - 1), gy);
      if (rng.chance(.4)) { const cy = gy - rng.i(2, 3), cx = x + rng.i(1, 2); for (let i = 0; i < rng.i(3, 5); i++) coin(cx + i, cy); }
      return [x + len, gy];
    },
    blocks(x, gy, force) {
      const len = rng.i(9, 13);
      flatRun(x, len, gy);
      const by = gy - 4;
      const pats = ['BQB', 'BQBQB', 'QQQ', 'BBQBB', 'Q', 'BQBB', 'QBQ'];
      const pat = force ? 'BQBQB' : rng.pick(pats);
      const bx = x + rng.i(2, Math.max(2, len - pat.length - 1));
      let mid = -1;
      for (let i = 0; i < pat.length; i++) {
        const t = pat[i] === 'Q' ? TILE.Q : TILE.B;
        set(bx + i, by, t);
        if (t === TILE.Q) {
          const c = (force && i === 1) ? 'power' : blockContent();
          if (c !== 'coin') content(bx + i, by, c);
          mid = bx + i;
        } else if (rng.chance(.1)) content(bx + i, by, 'multi');
      }
      // zweite Reihe weiter oben
      if (by - 4 > ceil && rng.chance(.4)) {
        const ux = bx + Math.floor(pat.length / 2);
        set(ux, by - 4, TILE.Q);
        content(ux, by - 4, rng.chance(.5) ? 'power' : 'coin');
        for (let i = -1; i <= 1; i += 2) if (rng.chance(.6)) set(ux + i, by - 4, TILE.B);
      } else if (rng.chance(.4)) for (let i = 0; i < pat.length; i++) coin(bx + i, by - 1);
      if (pat.length >= 3 && by - 3 > ceil) starSpot(bx + pat.length - 1, by - 3, 1);
      if (rng.chance(.5 + diff * .3)) groundEnemy(x + len - 2, gy);
      return [x + len, gy];
    },
    pit(x, gy) {
      const w = rng.i(2, Math.min(4, 2 + Math.round(diff * 1.8)));
      x = flatRun(x, w >= 4 ? 5 : 3, gy);
      for (let i = 0; i < w; i++) pit(x + i);
      // Münzbogen über dem Abgrund
      for (let i = -1; i <= w; i++) {
        const t = (i + 1) / (w + 1);
        coin(x + i, gy - 2 - Math.round(Math.sin(t * Math.PI) * 2));
      }
      if (w >= 3 && rng.chance(.35) && gy - 4 > ceil) { set(x + Math.floor(w / 2), gy - 4, TILE.Q); content(x + Math.floor(w / 2), gy - 4, blockContent()); }
      x += w;
      x = flatRun(x, rng.i(2, 4), gy);
      return [x, gy];
    },
    step(x, gy) {
      let ng = clamp(gy + rng.pick([-2, -1, 1, 2, -1, 1]), GY_MIN, GY_MAX);
      if (ng === gy) ng = gy > GY_MIN ? gy - 1 : gy + 1;
      const len = rng.i(4, 7);
      flatRun(x, len, ng);
      if (rng.chance(.4 + diff * .3)) groundEnemy(x + rng.i(2, len - 1), ng);
      return [x + len, ng];
    },
    pillars(x, gy) {
      x = flatRun(x, 2, gy);
      const n = rng.i(2, 4);
      let lastTop = gy;
      for (let k = 0; k < n; k++) {
        let top = clamp(gy - rng.i(1, 3), ceil + 4, gy - 1);
        if (Math.abs(top - lastTop) > 2) top = lastTop + sign(top - lastTop) * 2;
        for (let i = 0; i < 2; i++) ground(x + i, top);
        if (rng.chance(.5)) { coin(x, top - 1); coin(x + 1, top - 1); }
        if (k === n - 1 && top <= gy - 3) starSpot(x + 1, top - 4, 1);
        x += 2; lastTop = top;
        const gap = rng.i(2, 3);
        if (k < n - 1) {
          if (diff > .25 && rng.chance(.45)) { for (let i = 0; i < gap; i++) pit(x + i); }
          else { flatRun(x, gap, gy, { noDeko: true }); if (gap >= 3 && rng.chance(.5)) groundEnemy(x + 1, gy); }
          x += gap;
        }
      }
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    stairs(x, gy) {
      const n = rng.i(3, Math.min(5, gy - ceil - 4));
      x = flatRun(x, 2, gy);
      const up = tx => { for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h <= i; h++) set(x + i, gy - 1 - h, TILE.S); } x += n; };
      up();
      const gap = (diff > .2 && rng.chance(.55)) ? 2 : 0;
      if (gap) { for (let i = 0; i < gap; i++) pit(x + i); starSpot(x, gy - n - 3, 1); x += gap; }
      else { ground(x, gy); for (let h = 0; h < n; h++) set(x, gy - 1 - h, TILE.S); x++; }
      for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h < n - i; h++) set(x + i, gy - 1 - h, TILE.S); }
      x += n;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    islands(x, gy) {
      x = flatRun(x, 3, gy);
      const len = rng.i(8, 11 + Math.round(diff * 5));
      const end = x + len;
      let px = x + rng.i(0, 1), lastRow = gy;
      while (px < end - 3) {
        const pw = rng.i(2, 4);
        let row = clamp(gy - rng.i(0, 3), ceil + 4, gy);
        if (row < lastRow - 3) row = lastRow - 3;
        for (let i = 0; i < pw; i++) set(px + i, row, TILE.P);
        deko('stamm', (px + pw / 2) * T, row * T + 18, { back: true, s: 1, len: (H - row) * T });
        if (rng.chance(.5)) for (let i = 0; i < pw; i++) coin(px + i, row - 1);
        if (pw >= 3 && rng.chance(.3 + diff * .3)) enemy(rng.chance(.5) ? 'kaefer' : pickEnemy() === 'hummel' ? 'hummel' : 'kaefer', px + 1, row);
        if (row <= gy - 2 && rng.chance(.3)) starSpot(px + 1, row - 4, 1);
        lastRow = row;
        px += pw + rng.i(1, 3);
      }
      const stop = Math.max(px, end);
      for (let i = x; i < stop; i++) pit(i);
      x = stop;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    moving(x, gy) {
      x = flatRun(x, 3, gy);
      const len = rng.i(6, 9);
      for (let i = 0; i < len; i++) pit(x + i);
      const vert = rng.chance(.25) && gy - 6 > ceil;
      if (vert) {
        L.ents.push({ type: 'plat', mode: 'v', x: (x + len / 2 - 1.5) * T, y: (gy - 1) * T, y0: (gy - 5) * T, y1: (gy + 1) * T, w: 3 * T, speed: 70 + diff * 30 });
        for (let i = 0; i < 3; i++) coin(x + Math.floor(len / 2) - 1 + i, gy - 7);
      } else {
        L.ents.push({ type: 'plat', mode: 'h', x: (x + .3) * T, y: (gy - 1) * T, x0: (x + .3) * T, x1: (x + len - 3.3) * T, w: 3 * T, speed: 80 + diff * 50 });
        for (let i = 1; i < len - 1; i += 2) coin(x + i, gy - 3);
      }
      x += len;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    falling(x, gy) {
      x = flatRun(x, 3, gy);
      const n = rng.i(2, 3), len = n * 3 + 1;
      for (let i = 0; i < len; i++) pit(x + i);
      for (let k = 0; k < n; k++) {
        const row = gy - (k % 2 ? 2 : 1);
        L.ents.push({ type: 'plat', mode: 'fall', x: (x + k * 3 + 1) * T, y: row * T, w: 2 * T });
        coin(x + k * 3 + 1, row - 2); coin(x + k * 3 + 2, row - 2);
      }
      x += len;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    spring(x, gy) {
      const hgt = 5;
      if (gy - hgt - 4 <= ceil) return S.blocks(x, gy);
      x = flatRun(x, 4, gy);
      L.ents.push({ type: 'feder', x: (x - 2) * T + T / 2, y: gy * T });
      const plen = rng.i(4, 7);
      for (let i = 0; i < plen; i++) ground(x + i, gy - hgt);
      for (let i = 0; i < plen; i++) coin(x + i, gy - hgt - 1);
      starSpot(x + plen - 1, gy - hgt - 4, 2);
      if (rng.chance(.5)) { set(x + 1, gy - hgt - 4, TILE.Q); content(x + 1, gy - hgt - 4, 'power'); }
      decorate(x, x + plen, gy - hgt);
      x += plen;
      x = flatRun(x, 4, gy);
      return [x, gy];
    },
    bees(x, gy) {
      const len = rng.i(10, 14);
      flatRun(x, len, gy);
      const n = rng.i(2, 2 + Math.round(diff * 2));
      for (let i = 0; i < n; i++) enemy('hummel', x + 3 + Math.floor(i * (len - 4) / n), gy - rng.i(2, 4));
      return [x + len, gy];
    },
    spikes(x, gy) {
      const len = rng.i(9, 11);
      flatRun(x, len, gy, { noDeko: true });
      const sw = rng.i(2, 3), sx = x + rng.i(3, len - sw - 2);
      for (let i = 0; i < sw; i++) set(sx + i, gy - 1, TILE.X);
      for (let i = 0; i < sw; i++) coin(sx + i, gy - 4);
      if (rng.chance(.4) && gy - 5 > ceil) { set(sx + Math.floor(sw / 2), gy - 5, TILE.Q); content(sx + Math.floor(sw / 2), gy - 5, blockContent()); }
      return [x + len, gy];
    },
    group(x, gy) {
      const len = rng.i(12, 16);
      flatRun(x, len, gy);
      const n = rng.i(3, 3 + Math.round(diff * 2));
      for (let i = 0; i < n; i++) enemy(i === 0 && enemyKinds.schnecke ? 'schnecke' : rng.chance(.6) ? 'kaefer' : pickEnemy(), x + 4 + Math.floor(i * (len - 5) / n), gy);
      if (gy - 4 > ceil) { const bx = x + rng.i(3, 6); set(bx, gy - 4, TILE.B); set(bx + 1, gy - 4, TILE.Q); content(bx + 1, gy - 4, blockContent()); set(bx + 2, gy - 4, TILE.B); }
      return [x + len, gy];
    },
    hidden(x, gy) {
      const len = rng.i(6, 8);
      flatRun(x, len, gy);
      const hx = x + rng.i(2, len - 2);
      set(hx, gy - 4, TILE.H); content(hx, gy - 4, 'life');
      return [x + len, gy];
    },
    tunnel(x, gy) {
      const len = rng.i(8, 12);
      flatRun(x, len, gy, { noDeko: true });
      const low = gy - 4;
      for (let i = 0; i < len; i++) for (let ty = 0; ty <= low - 1; ty++) set(x + i, ty, TILE.G);
      for (let i = 1; i < len - 1; i++) coin(x + i, gy - 1);
      if (rng.chance(.6)) groundEnemy(x + len - 3, gy);
      return [x + len, gy];
    },
    crusher(x, gy) {
      const len = rng.i(10, 13);
      flatRun(x, len, gy);
      const n = rng.i(1, 2);
      for (let i = 0; i < n; i++) L.ents.push({ type: 'enemy', kind: 'crusher', x: (x + 3 + i * 5) * T + T, y: (ceil + 2) * T, floor: gy * T });
      for (let i = 2; i < len - 1; i += 2) coin(x + i, gy - 1);
      return [x + len, gy];
    },
    lavapit(x, gy) {
      x = flatRun(x, 3, gy);
      const len = rng.i(5, 7);
      for (let i = 0; i < len; i++) pit(x + i);
      // Steinsäulen aus der Lava
      const cols = [x + 2, x + len - 3];
      for (const cx of cols) for (let ty = gy - 1; ty < H - 2; ty++) set(cx, ty, TILE.S);
      L.ents.push({ type: 'enemy', kind: 'lavaball', x: (x + Math.floor(len / 2)) * T + T / 2, y: (H - 2) * T, top: (gy - 5) * T });
      if (len >= 7) L.ents.push({ type: 'enemy', kind: 'lavaball', x: (x + 1) * T + T / 2, y: (H - 2) * T, top: (gy - 4) * T, delay: 1 });
      for (const cx of cols) coin(cx, gy - 3);
      x += len;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
  };

  // ---------------- Zusammensetzen ----------------
  let x = 0, gy = 12;
  const weights = Object.assign({}, SEG_WEIGHTS.base, SEG_WEIGHTS[themeKey]);
  if (!th.ceiling) delete weights.tunnel;
  if (!th.lava) { delete weights.lavapit; delete weights.crusher; }
  x = flatRun(x, 10, gy);
  L.spawn = { x: 3 * T, y: gy * T };
  [x, gy] = S.blocks(x, gy, true);
  const target = 150 + Math.round(diff * 70) + (boss ? -30 : 0);
  let last = 'blocks';
  while (x < target) {
    if (!L.checkpoint && x > target * .48) {
      x = flatRun(x, 2, gy);
      L.checkpoint = { x: x * T + T / 2, y: gy * T };
      L.ents.push({ type: 'check', x: x * T + T / 2, y: gy * T });
      x = flatRun(x, 4, gy);
      continue;
    }
    let k;
    do { k = rng.weighted(weights); } while (k === last && rng.chance(.8));
    last = k;
    const px = x;
    [x, gy] = S[k](x, gy);
    powerGap += x - px;
  }
  if (boss) {
    gy = 12;
    x = flatRun(x, 6, gy);
    const ax = x, alen = 26;
    flatRun(x, alen, gy, { noDeko: true });
    for (const px of [ax + 5, ax + alen - 8]) for (let i = 0; i < 3; i++) set(px + i, gy - 4, TILE.P);
    for (let i = 0; i < 4; i++) L.deko.push({ kind: 'fackel', x: (ax + 3 + i * 7) * T, y: gy * T, dyn: true, s: 1, h: .5 });
    L.arena = { x0: ax * T, x1: (ax + alen) * T, gy };
    L.ents.push({ type: 'boss', x: (ax + alen - 6) * T, y: gy * T });
    x = ax + alen;
    for (let ty = 0; ty < H; ty++) set(x, ty, TILE.S);
    x++;
  } else {
    x = flatRun(x, 4, gy);
    // Schlusstreppe
    const n = Math.min(5, gy - ceil - 5);
    for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h <= i; h++) set(x + i, gy - 1 - h, TILE.S); }
    x += n;
    x = flatRun(x, 3, gy, { noDeko: true });
    L.goal = { x: x * T + T / 2, y: gy * T, top: Math.max(ceil + 1, gy - 10) * T };
    L.ents.push({ type: 'ziel', x: x * T + T / 2, y: gy * T, top: L.goal.top });
    x = flatRun(x, 16, gy, { noDeko: true });
    L.deko.push({ kind: 'tor', x: (x - 8) * T, y: gy * T, dyn: true, s: 1, h: .5 });
  }
  // Decke
  if (th.ceiling) for (let tx = 0; tx < x; tx++) for (let ty = 0; ty < ceil; ty++) set(tx, ty, TILE.G);
  if (th.ceiling) for (const d of L.deko) if (d.kind === 'kette') d.y = ceil * T;
  if (themeKey === 'burg') for (let tx = 6; tx < x; tx += rng.i(6, 12)) L.deko.push({ kind: 'kette', x: tx * T + T / 2, y: ceil * T, back: true, s: 1, len: rng.i(2, 4) * T, h: .5 });

  // Zuschneiden
  const W = x;
  const g2 = new Uint8Array(W * H);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) g2[ty * W + tx] = g[ty * MAXW + tx];
  const content2 = new Map();
  for (const [k, v] of L.content) { const ty = Math.floor(k / MAXW), tx = k % MAXW; if (tx < W) content2.set(ty * W + tx, v); }
  L.w = W; L.g = g2; L.content = content2;

  // Sternmünzen: je eine pro Drittel
  const picks = [];
  const valid = s => s.tx > 12 && s.tx < W - 4 && s.ty > ceil && g2[s.ty * W + s.tx] !== TILE.G && g2[s.ty * W + s.tx] !== TILE.S && g2[s.ty * W + s.tx] !== TILE.B && g2[s.ty * W + s.tx] !== TILE.Q;
  for (let k = 0; k < 3; k++) {
    const cand = L.stars.filter(s => valid(s) && s.tx >= W * k / 3 && s.tx < W * (k + 1) / 3);
    let s = cand.length ? rng.pick(cand) : null;
    if (!s) {
      // Notlösung: hoch über dem Boden in diesem Drittel
      const tx = Math.floor(W * (k + .5) / 3);
      let top = 0; while (top < H && g2[top * W + tx] === 0) top++;
      if (top <= ceil) top = 6;
      s = { tx, ty: Math.max(ceil + 1, top - 4) };
    }
    if (g2[s.ty * W + s.tx] === TILE.C) g2[s.ty * W + s.tx] = 0;
    picks.push(s);
  }
  picks.forEach((s, i) => L.ents.push({ type: 'sternmuenze', x: s.tx * T + T / 2, y: s.ty * T + T / 2, idx: i }));
  // Keine Gegner direkt am Start
  L.ents = L.ents.filter(e => e.type !== 'enemy' || e.x > 14 * T);
  return L;
}
