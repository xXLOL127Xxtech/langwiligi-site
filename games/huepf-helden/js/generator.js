'use strict';
// =====================================================================
//  Level-Generator: baut aus Bausteinen ein Level (gleicher Seed = gleiches Level)
// =====================================================================
const SEG_WEIGHTS = {
  base:   { flat: 2, blocks: 4, pit: 3, step: 2, pillars: 2, stairs: 1.4, islands: 2, moving: 1.2, falling: .8, spring: .8, bees: .8, spikes: .8, group: 1.8, hidden: .5, urnen: .9, kanonen: .8, wichte: .8, pool: .7 },
  wiese:  { urnen: 1.2, pool: 1.2 },
  strand: { urnen: 1.4, islands: 2.5, bees: .4, pool: 2 },
  hoehle: { tunnel: 2.2, spikes: 1.3, spring: .3, urnen: 1.2, pool: 1 },
  wueste: { pillars: 3, spikes: 1.2, bees: 1.2, kanonen: 1.2, pool: 1.2 },
  wolken: { islands: 5, moving: 3, falling: 2.2, pit: 3.5, flat: 1, pillars: 1.4, step: 1, stairs: .6, spikes: .3, urnen: 0, kanonen: .5 },
  schnee: { stairs: 2.2, pit: 3.2, step: 3, bees: .4, kanonen: 1, pool: .5 },
  abend:  { group: 2.2, spring: 1.4, bees: 1.4 },
  nebel:  { wichte: 2.2, group: 2, urnen: 1.4, ghosts: 2, falling: 1.4, pool: 1 },
  spuk:   { ghosts: 4, falling: 2.5, moving: 2, spikes: 1.4, tunnel: 1.5, pit: 2, bees: 0, urnen: 0, kanonen: 0, islands: 1.4 },
  turm:   { crusher: 2.6, feuerkette: 3, lavapit: 2.4, spikes: 1.5, pit: 1.2, moving: 1.5, stairs: 1.5, falling: 1.5, bees: 0, spring: .3, wichte: 1.5, kanonen: 1.4, urnen: 0, islands: .5 },
  burg:   { crusher: 2.6, feuerkette: 2.6, lavapit: 3, spikes: 1.5, pit: 2, moving: 1.5, stairs: 1.5, islands: 1, falling: 1.5, bees: 0, spring: .4, pillars: 1.2, kanonen: 1.6, wichte: 1.4, urnen: 0 },
  schatten: { lavapit: 2.4, feuerkette: 1.6, kanonen: 2, wichte: 2.4, crusher: 1.2, ghosts: 1, islands: 1.6, falling: 1.6 },
  sterne: { islands: 4, moving: 3, falling: 2.5, pit: 3, kanonen: 1.6, wichte: 1, flat: .5, bees: 1.2, feuerkette: 1.2 },
  dschungel: { pillars: 2.6, bees: 2, spikes: 1.2, pool: 1.8, spring: 1.4, islands: 2.2, moving: 1.4, urnen: 1.2, kanonen: .4, wichte: .3 },
  vulkan: { lavapit: 3.2, feuerkette: 2, spikes: 1.4, pillars: 2.4, moving: 2.2, falling: 1.8, pit: 1.6, kanonen: 1.2, wichte: .6, islands: 1.6, bees: .5, urnen: 0 },
  zucker: { islands: 2.6, spring: 2.2, group: 2, bees: 1.2, pillars: 2.6, moving: 1.6, falling: 1.2, stairs: 1.8, pool: .8, spikes: .3, kanonen: .5, urnen: .6 },
  himmel: { islands: 5, moving: 3, falling: 2.2, pit: 3.5, flat: 1, pillars: 1.4, step: 1, stairs: .6, spikes: .3, spring: 1.4, urnen: 0, kanonen: 1 },
};
const WATER_WEIGHTS = { wflat: 2, wrocks: 3, wpillars: 2.5, wfish: 2.5, wjelly: 1.6, wurchin: 1.6, wblocks: 2, wpit: 1.4 };

function generateLevel({ themeKey, seed, diff, kind = 'normal', secret = false, tunnel = false, bossLook = 1 }) {
  const th = THEMES[themeKey];
  const rng = makeRng(seed);
  const H = 15, MAXW = 700;
  const g = new Uint8Array(MAXW * H);
  const L = {
    w: MAXW, h: H, g, theme: th, themeKey, seed, kind, ents: [], deko: [], content: new Map(), stars: [],
    spawn: null, checkpoint: null, arena: null, water: th.water ? 2 * T : null, pools: [],
    time: kind === 'burg' || kind === 'final' || kind === 'stern' ? 400 : 300,
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
  const enemy = (k, tx, ty, extra) => L.ents.push(Object.assign({ type: 'enemy', kind: k, x: tx * T + T / 2, y: ty * T }, extra));
  const kinds = th.enemies;
  const pickEnemy = () => rng.weighted(kinds);
  const groundEnemy = (tx, gy) => {
    const k = pickEnemy();
    if (k === 'hummel') return enemy('hummel', tx, gy - rng.i(2, 3));
    if (k === 'irrlicht') return enemy('irrlicht', tx, gy - rng.i(2, 4));
    if (k === 'pflanze') { if (!get(tx, gy - 1) && SOLID_GEN(get(tx, gy))) { set(tx, gy - 1, TILE.K); return enemy('pflanze', tx, gy - 1); } return enemy('kaefer', tx, gy); }
    if (k === 'fisch' || k === 'qualle' || k === 'seeigel') return enemy('kaefer', tx, gy);
    enemy(k, tx, gy);
  };
  const SOLID_GEN = c => c === TILE.G || c === TILE.S;
  const deko = (k, x, y, extra = {}) => L.deko.push(Object.assign({ kind: k, x, y, h: rng.f(), s: 0.85 + rng.f() * 0.3 }, extra));
  const decorate = (x0, x1, gy) => {
    for (let tx = x0; tx < x1; tx++) {
      if (th.deko.back.length && rng.chance(.12)) deko(rng.pick(th.deko.back), tx * T + rng.f() * T, gy * T, { back: true, s: 0.8 + rng.f() * .5 });
      if (th.deko.front.length && rng.chance(.16)) {
        const k = rng.pick(th.deko.front);
        if (k === 'fackel' || k === 'laterne' || k === 'kerze') { deko(k, tx * T + T / 2, gy * T, { dyn: true, s: 1 }); continue; }
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
    if (powerGap > 30 || rng.chance(.12 + diff * .04)) { powerGap = 0; return 'power'; }
    if (rng.chance(.02)) return 'stern';
    return 'coin';
  };
  const nEnemies = (a, b) => rng.i(a, b + Math.round(diff * 2));

  // ---------------- Bausteine an Land ----------------
  const S = {
    flat(x, gy) {
      const len = rng.i(5, 9);
      flatRun(x, len, gy);
      const ne = rng.i(0, Math.round(.8 + diff * 2));
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
      for (let i = 0; i < pat.length; i++) {
        const t = pat[i] === 'Q' ? TILE.Q : TILE.B;
        set(bx + i, by, t);
        if (t === TILE.Q) { const c = (force && i === 1) ? 'power' : blockContent(); if (c !== 'coin') content(bx + i, by, c); }
        else if (rng.chance(.1)) content(bx + i, by, 'multi');
      }
      if (by - 4 > ceil && rng.chance(.4)) {
        const ux = bx + Math.floor(pat.length / 2);
        set(ux, by - 4, TILE.Q); content(ux, by - 4, rng.chance(.5) ? 'power' : 'coin');
        for (let i = -1; i <= 1; i += 2) if (rng.chance(.6)) set(ux + i, by - 4, TILE.B);
      } else if (rng.chance(.4)) for (let i = 0; i < pat.length; i++) coin(bx + i, by - 1);
      if (pat.length >= 3 && by - 3 > ceil) starSpot(bx + pat.length - 1, by - 3, 1);
      if (rng.chance(.55 + diff * .3)) groundEnemy(x + len - 2, gy);
      if (rng.chance(diff * .5)) groundEnemy(x + 1, gy);
      return [x + len, gy];
    },
    pit(x, gy) {
      const w = rng.i(2, Math.min(4, 2 + Math.round(diff * 1.8)));
      x = flatRun(x, w >= 4 ? 5 : 3, gy);
      for (let i = 0; i < w; i++) pit(x + i);
      for (let i = -1; i <= w; i++) { const t = (i + 1) / (w + 1); coin(x + i, gy - 2 - Math.round(Math.sin(t * Math.PI) * 2)); }
      if (w >= 3 && rng.chance(.35) && gy - 4 > ceil) { set(x + Math.floor(w / 2), gy - 4, TILE.Q); content(x + Math.floor(w / 2), gy - 4, blockContent()); }
      if (kinds.flugkaefer && rng.chance(.35 + diff * .3)) enemy('flugkaefer', x + Math.floor(w / 2), gy - 3);
      x += w;
      x = flatRun(x, rng.i(2, 4), gy);
      return [x, gy];
    },
    step(x, gy) {
      let ng = clamp(gy + rng.pick([-2, -1, 1, 2, -1, 1]), GY_MIN, GY_MAX);
      if (ng === gy) ng = gy > GY_MIN ? gy - 1 : gy + 1;
      const len = rng.i(4, 7);
      flatRun(x, len, ng);
      if (rng.chance(.45 + diff * .3)) groundEnemy(x + rng.i(2, len - 1), ng);
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
        else if (kinds.pflanze && rng.chance(.3)) { set(x, top - 1, TILE.K); enemy('pflanze', x, top - 1); }
        if (k === n - 1 && top <= gy - 3) starSpot(x + 1, top - 4, 1);
        x += 2; lastTop = top;
        const gap = rng.i(2, 3);
        if (k < n - 1) {
          if (diff > .2 && rng.chance(.45)) { for (let i = 0; i < gap; i++) pit(x + i); }
          else { flatRun(x, gap, gy, { noDeko: true }); if (gap >= 3 && rng.chance(.6)) groundEnemy(x + 1, gy); }
          x += gap;
        }
      }
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    stairs(x, gy) {
      const n = rng.i(3, Math.min(5, gy - ceil - 4));
      x = flatRun(x, 2, gy);
      for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h <= i; h++) set(x + i, gy - 1 - h, TILE.S); }
      x += n;
      const gap = (diff > .15 && rng.chance(.55)) ? 2 : 0;
      if (gap) { for (let i = 0; i < gap; i++) pit(x + i); starSpot(x, gy - n - 3, 1); x += gap; }
      else { ground(x, gy); for (let h = 0; h < n; h++) set(x, gy - 1 - h, TILE.S); x++; }
      for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h < n - i; h++) set(x + i, gy - 1 - h, TILE.S); }
      x += n;
      x = flatRun(x, 3, gy);
      if (rng.chance(.4 + diff * .4)) groundEnemy(x - 2, gy);
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
        if (pw >= 3 && rng.chance(.3 + diff * .3)) enemy('kaefer', px + 1, row);
        if (row <= gy - 2 && rng.chance(.3)) starSpot(px + 1, row - 4, 1);
        if (kinds.flugkaefer && rng.chance(.25 + diff * .2)) enemy('flugkaefer', px + pw + 1, row - 2);
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
      if (rng.chance(.25) && gy - 6 > ceil) {
        L.ents.push({ type: 'plat', mode: 'v', x: (x + len / 2 - 1.5) * T, y: (gy - 1) * T, y0: (gy - 5) * T, y1: (gy + 1) * T, w: 3 * T, speed: 75 + diff * 35 });
        for (let i = 0; i < 3; i++) coin(x + Math.floor(len / 2) - 1 + i, gy - 7);
      } else {
        L.ents.push({ type: 'plat', mode: 'h', x: (x + .3) * T, y: (gy - 1) * T, x0: (x + .3) * T, x1: (x + len - 3.3) * T, w: 3 * T, speed: 85 + diff * 55 });
        for (let i = 1; i < len - 1; i += 2) coin(x + i, gy - 3);
        if (kinds.flugkaefer && rng.chance(diff)) enemy('flugkaefer', x + Math.floor(len / 2), gy - 4);
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
      if (gy - hgt - 4 <= ceil || L.secretX) return S.blocks(x, gy);
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
      for (let i = 0; i < n; i++) enemy(kinds.hummel ? 'hummel' : 'flugkaefer', x + 3 + Math.floor(i * (len - 4) / n), gy - rng.i(2, 4));
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
      const n = nEnemies(3, 3);
      for (let i = 0; i < n; i++) {
        const tx = x + 4 + Math.floor(i * (len - 5) / n);
        if (i === 0 && kinds.schnecke) enemy('schnecke', tx, gy); else groundEnemy(tx, gy);
      }
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
    // Wasserstelle: Becken im Boden, in dem man schwimmt (Sprungtaste = Schwimmzug)
    pool(x, gy) {
      const ng = gy > 10 ? gy - 2 : gy;
      x = flatRun(x, 3, ng);
      const w = rng.i(6, 9), floor = ng + 3;
      for (let i = 0; i < w; i++) ground(x + i, floor);
      L.pools.push({ x0: x * T, x1: (x + w) * T, y: ng * T + 10, floor });
      for (let i = 0; i < w; i++) { if (i % 2 === 0) coin(x + i, ng + 1 + (i % 4 === 0 ? 0 : 1)); }
      if (rng.chance(.5 + diff * .3)) enemy('fisch', x + 2, ng + 2);
      if (diff > .35 && rng.chance(.5)) enemy('qualle', x + w - 2, ng + 1);
      if (ng - 3 > ceil && rng.chance(.6)) { set(x + Math.floor(w / 2), ng - 3, TILE.Q); content(x + Math.floor(w / 2), ng - 3, blockContent()); }
      starSpot(x + Math.floor(w / 2), floor - 1, 2);
      x += w;
      x = flatRun(x, 3, ng);
      return [x, ng];
    },
    tunnel(x, gy) {
      const len = rng.i(8, 12);
      flatRun(x, len, gy, { noDeko: true });
      const low = gy - 4;
      for (let i = 0; i < len; i++) for (let ty = 0; ty <= low - 1; ty++) set(x + i, ty, TILE.G);
      for (let i = 1; i < len - 1; i++) coin(x + i, gy - 1);
      if (rng.chance(.7)) groundEnemy(x + len - 3, gy);
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
      const cols = [x + 2, x + len - 3];
      for (const cx of cols) for (let ty = gy - 1; ty < H - 2; ty++) set(cx, ty, TILE.S);
      if (th.lava) {
        enemy('lavaball', x + Math.floor(len / 2), H - 2, { top: (gy - 5) * T });
        if (len >= 7) enemy('lavaball', x + 1, H - 2, { top: (gy - 4) * T, delay: 1 });
      }
      for (const cx of cols) coin(cx, gy - 3);
      x += len;
      x = flatRun(x, 3, gy);
      return [x, gy];
    },
    feuerkette(x, gy) {
      const len = rng.i(9, 11);
      flatRun(x, len, gy, { noDeko: true });
      const bx = x + Math.floor(len / 2), by = gy - 3;
      set(bx, by, TILE.U);
      L.ents.push({ type: 'feuerkette', cx: bx * T + T / 2, cy: by * T + T / 2, n: rng.i(4, 5 + Math.round(diff)), speed: (rng.chance(.5) ? 1 : -1) * (1.5 + diff * .8), a: rng.f() * TAU });
      if (diff > .5 && rng.chance(.5)) groundEnemy(x + len - 2, gy);
      coin(bx - 2, gy - 1); coin(bx + 2, gy - 1);
      return [x + len, gy];
    },
    kanonen(x, gy) {
      const len = rng.i(10, 13);
      flatRun(x, len, gy, { noDeko: true });
      const n = rng.i(1, 2);
      for (let i = 0; i < n; i++) {
        const cx = x + 3 + i * 5, hgt = rng.i(1, 2);
        for (let h = 1; h <= hgt; h++) set(cx, gy - h, TILE.S);
        L.ents.push({ type: 'enemy', kind: 'kanone', x: cx * T + T / 2, y: (gy - hgt + 1) * T });
      }
      return [x + len, gy];
    },
    urnen(x, gy) {
      const len = rng.i(10, 13);
      flatRun(x, len, gy);
      const n = rng.i(2, 3);
      for (let i = 0; i < n; i++) {
        const ux = x + 2 + i * 4;
        set(ux, gy - 1, TILE.K);
        enemy('pflanze', ux, gy - 1);
      }
      for (let i = 0; i < n; i++) coin(x + 4 + i * 4, gy - 3);
      return [x + len, gy];
    },
    wichte(x, gy) {
      const len = rng.i(11, 14);
      flatRun(x, len, gy);
      const n = rng.i(1, 2 + Math.round(diff));
      for (let i = 0; i < n; i++) enemy('wicht', x + 4 + i * 4, gy);
      if (gy - 4 > ceil) { const bx = x + 2; set(bx, gy - 4, TILE.B); set(bx + 1, gy - 4, TILE.B); set(bx + 2, gy - 4, TILE.Q); content(bx + 2, gy - 4, blockContent()); }
      return [x + len, gy];
    },
    ghosts(x, gy) {
      const len = rng.i(12, 15);
      flatRun(x, len, gy);
      const n = rng.i(2, 3 + Math.round(diff));
      for (let i = 0; i < n; i++) enemy('irrlicht', x + 3 + i * 3, gy - rng.i(2, 5));
      for (let i = 2; i < len - 2; i += 3) coin(x + i, gy - 2);
      return [x + len, gy];
    },
  };

  // ---------------- Bausteine unter Wasser ----------------
  const WS = {
    wflat(x, gy) {
      const len = rng.i(7, 10);
      flatRun(x, len, gy);
      const cy = rng.i(4, gy - 2);
      for (let i = 0; i < 5; i++) coin(x + 2 + i, cy + Math.round(Math.sin(i) * 1));
      if (rng.chance(.5 + diff * .3)) enemy('fisch', x + len - 2, rng.i(4, gy - 2));
      return [x + len, gy];
    },
    wrocks(x, gy) {
      const len = rng.i(10, 13);
      flatRun(x, len, gy);
      const n = rng.i(1, 2);
      for (let k = 0; k < n; k++) {
        const rx = x + 2 + k * 6, ry = rng.i(5, gy - 4), rw = rng.i(2, 4);
        for (let i = 0; i < rw; i++) { set(rx + i, ry, TILE.G); if (rng.chance(.6)) set(rx + i, ry + 1, TILE.G); }
        for (let i = 0; i < rw; i++) coin(rx + i, ry - 1);
        if (rng.chance(.4)) starSpot(rx + rw - 1, ry + 2, 1);
        if (rng.chance(.4)) enemy('seeigel', rx + 1, ry);
      }
      if (rng.chance(.6)) enemy('fisch', x + len - 1, rng.i(4, gy - 2));
      return [x + len, gy];
    },
    wpillars(x, gy) {
      const len = rng.i(9, 12);
      flatRun(x, len, gy);
      for (let k = 0; k < 2; k++) {
        const px = x + 2 + k * 5;
        if (rng.chance(.5)) { const top = rng.i(gy - 6, gy - 3); for (let ty = top; ty < gy; ty++) set(px, ty, TILE.G); }
        else { const bot = rng.i(5, 7); for (let ty = 3; ty <= bot; ty++) set(px, ty, TILE.G); }
      }
      for (let i = 1; i < len; i += 2) coin(x + i, rng.i(5, gy - 2));
      return [x + len, gy];
    },
    wfish(x, gy) {
      const len = rng.i(10, 13);
      flatRun(x, len, gy);
      const n = rng.i(2, 3 + Math.round(diff * 2));
      for (let i = 0; i < n; i++) enemy('fisch', x + 2 + i * 3, rng.i(4, gy - 2));
      return [x + len, gy];
    },
    wjelly(x, gy) {
      const len = rng.i(8, 10);
      flatRun(x, len, gy);
      const n = rng.i(2, 3);
      for (let i = 0; i < n; i++) enemy('qualle', x + 2 + i * 3, rng.i(5, gy - 2));
      for (let i = 0; i < 3; i++) coin(x + 3 + i, 4);
      return [x + len, gy];
    },
    wurchin(x, gy) {
      const len = rng.i(9, 12);
      flatRun(x, len, gy);
      for (let i = 0; i < rng.i(2, 3); i++) enemy('seeigel', x + 2 + i * 3, gy);
      for (let i = 0; i < 5; i++) coin(x + 2 + i, gy - 3);
      return [x + len, gy];
    },
    wblocks(x, gy) {
      const len = rng.i(9, 11);
      flatRun(x, len, gy);
      const by = rng.i(6, gy - 4), bx = x + 3;
      set(bx, by, TILE.B); set(bx + 1, by, TILE.Q); content(bx + 1, by, blockContent()); set(bx + 2, by, TILE.B);
      starSpot(bx + 1, by + 2, 1);
      return [x + len, gy];
    },
    wpit(x, gy) {
      x = flatRun(x, 2, gy);
      const w = rng.i(3, 5);
      for (let i = 0; i < w; i++) coin(x + i, gy - 3);
      if (rng.chance(.5)) enemy('qualle', x + Math.floor(w / 2), gy - 1);
      x += w;
      x = flatRun(x, 2, gy);
      return [x, gy];
    },
  };

  // ---------------- Geheimer Ausgang ----------------
  // Brüchiger Boden -> darunter eine Sternfeder -> hoch oben ein versteckter Weg zum roten Ziel
  function secretPocket(x, gy) {
    const ng = Math.min(gy, 11);
    x = flatRun(x, 3, ng, { noDeko: true });
    const px = x;
    flatRun(x, 2, ng, { noDeko: true });
    set(px, ng, TILE.R); set(px + 1, ng, TILE.R);
    for (const tx of [px, px + 1]) { set(tx, ng + 1, 0); set(tx, ng + 2, 0); }
    const springY = (ng + 3) * T;
    const uRow = th.ceiling ? 5 : 2;
    const need = springY - uRow * T + 1.6 * T;
    L.ents.push({ type: 'feder', superf: true, x: (px + 1) * T, y: springY, power: Math.sqrt(2 * 2150 * need) });
    L.secretX = px; L.secretRow = uRow;
    x = flatRun(x + 2, 4, ng);
    return [x, ng];
  }
  function secretRoute(endX) {
    const sx = L.secretX, uRow = L.secretRow;
    for (let tx = sx - 3; tx <= endX; tx++) for (let ty = ceil; ty <= uRow + 1; ty++) { const c = get(tx, ty); if (c !== 0) set(tx, ty, 0); }
    for (let tx = sx - 2; tx <= sx + 3; tx++) set(tx, uRow, TILE.P);
    let px = sx + 4 + rng.i(1, 2);
    while (px < endX - 8) {
      const pw = rng.i(3, 5), row = uRow + (rng.chance(.3) ? 1 : 0);
      for (let i = 0; i < pw; i++) { set(px + i, row, TILE.P); coin(px + i, row - 1); }
      if (rng.chance(.35)) enemy(kinds.hummel ? 'hummel' : 'flugkaefer', px + pw, row - 1);
      px += pw + rng.i(1, 2);
    }
    const lx = Math.max(px, endX - 6);
    for (let tx = lx; tx < lx + 6; tx++) { set(tx, uRow, TILE.G); set(tx, uRow + 1, TILE.G); }
    L.ents.push({ type: 'ziel', secret: true, x: (lx + 3) * T + T / 2, y: uRow * T, top: Math.max(ceil + .5, uRow - 6) * T });
    starSpot(lx + 1, uRow - 2, 3);
  }

  // ---------------- Versteckter Tunnel (Toad-Haus) ----------------
  // Brüchiger Boden -> Gang unter der Erde mit Münzen und Tunnelschlüssel -> Schacht zurück nach oben
  function toadTunnel(x, gy) {
    const ng = Math.min(gy, 10), len = 10;
    x = flatRun(x, 3, ng, { noDeko: true });
    for (let i = 0; i < len + 2; i++) ground(x + i, ng);
    for (let tx = x; tx < x + len; tx++) for (let ty = ng + 1; ty <= ng + 2; ty++) set(tx, ty, 0);
    set(x, ng, TILE.R); set(x + 1, ng, TILE.R);
    set(x + len - 2, ng, 0); set(x + len - 1, ng, 0);
    for (let i = 2; i < len - 2; i += 2) coin(x + i, ng + 2);
    L.ents.push({ type: 'toad', x: (x + len - 4) * T + T / 2, y: (ng + 2) * T + T / 2 });
    L.tunnelX = x;
    for (let i = 0; i < len + 2; i++) if (rng.chance(.12)) deko('stein', (x + i) * T + T / 2, ng * T);
    x = flatRun(x + len + 2, 3, ng);
    return [x, ng];
  }

  // ---------------- Bossarena ----------------
  function arena(x, type) {
    const gy = 12;
    x = flatRun(x, 6, gy);
    const ax = x, alen = type === 'krax' ? 22 : type === 'morvax' ? 30 : 26;
    flatRun(x, alen, gy, { noDeko: true });
    const plats = type === 'morvax' ? [ax + 4, ax + 13, ax + alen - 7] : [ax + 5, ax + alen - 8];
    for (const px of plats) for (let i = 0; i < 3; i++) set(px + i, gy - 4, TILE.P);
    for (let i = 0; i < 4; i++) L.deko.push({ kind: 'fackel', x: (ax + 3 + i * Math.floor(alen / 4)) * T, y: gy * T, dyn: true, s: 1, h: .5 });
    L.arena = { x0: ax * T, x1: (ax + alen) * T, gy, type, look: bossLook };
    L.ents.push({ type: 'boss', boss: type === 'koloss' ? (BOSS_TYPE[bossLook] || 'koloss') : type, x: (ax + alen - 6) * T, y: gy * T, look: bossLook });
    x = ax + alen;
    for (let ty = 0; ty < H; ty++) set(x, ty, TILE.S);
    return x + 1;
  }

  // ---------------- Zusammensetzen ----------------
  let x = 0, gy = th.water ? 13 : 12;
  const water = !!th.water;
  const weights = water ? Object.assign({}, WATER_WEIGHTS) : Object.assign({}, SEG_WEIGHTS.base, SEG_WEIGHTS[themeKey] || {});
  if (!water) {
    if (th.lava || th.bottomless || th.ceiling && themeKey !== 'hoehle') delete weights.pool;
    if (!th.ceiling) delete weights.tunnel;
    if (!th.lava) { delete weights.lavapit; delete weights.crusher; }
    if (!th.ceiling && !th.lava) delete weights.feuerkette;
  }
  const segs = water ? WS : S;
  x = flatRun(x, 10, gy);
  L.spawn = { x: 3 * T, y: gy * T };
  if (water) [x, gy] = WS.wblocks(x, gy); else [x, gy] = S.blocks(x, gy, true);
  const boss = kind === 'turm' ? 'krax' : kind === 'burg' || kind === 'stern' ? 'koloss' : kind === 'final' ? 'morvax' : null;
  const target = (kind === 'turm' ? 120 : kind === 'normal' ? 165 : 190) + Math.round(diff * 50) + (boss ? -20 : 0);
  let last = 'blocks';
  while (x < target) {
    if (!L.checkpoint && x > target * .48) {
      x = flatRun(x, 2, gy);
      L.checkpoint = { x: x * T + T / 2, y: gy * T };
      L.ents.push({ type: 'check', x: x * T + T / 2, y: gy * T });
      x = flatRun(x, 4, gy);
      continue;
    }
    if (tunnel && !water && !L.tunnelX && x > target * .3) { [x, gy] = toadTunnel(x, gy); continue; }
    if (secret && !water && !L.secretX && x > target * .56) { [x, gy] = secretPocket(x, gy); continue; }
    let k;
    do { k = rng.weighted(weights); } while (k === last && rng.chance(.8));
    last = k;
    const px = x;
    [x, gy] = segs[k](x, gy);
    powerGap += x - px;
  }
  if (boss) {
    x = arena(x, boss);
  } else {
    x = flatRun(x, 4, gy);
    if (L.secretX) secretRoute(x - 2);
    const n = water ? 0 : Math.min(5, gy - ceil - 5);
    for (let i = 0; i < n; i++) { ground(x + i, gy); for (let h = 0; h <= i; h++) set(x + i, gy - 1 - h, TILE.S); }
    x += n;
    x = flatRun(x, 3, gy, { noDeko: true });
    const top = Math.max(ceil + 1, gy - 10) * T;
    L.ents.push({ type: 'ziel', x: x * T + T / 2, y: gy * T, top });
    x = flatRun(x, 16, gy, { noDeko: true });
    L.deko.push({ kind: 'tor', x: (x - 8) * T, y: gy * T, dyn: true, s: 1, h: .5 });
  }
  if (th.ceiling) for (let tx = 0; tx < x; tx++) for (let ty = 0; ty < ceil; ty++) set(tx, ty, TILE.G);
  if (themeKey === 'burg' || themeKey === 'turm') for (let tx = 6; tx < x; tx += rng.i(6, 12)) L.deko.push({ kind: 'kette', x: tx * T + T / 2, y: ceil * T, back: true, s: 1, len: rng.i(2, 4) * T, h: .5 });
  for (const d of L.deko) if (d.kind === 'kette') d.y = ceil * T;

  // Zuschneiden
  const W = x;
  const g2 = new Uint8Array(W * H);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) g2[ty * W + tx] = g[ty * MAXW + tx];
  const content2 = new Map();
  for (const [k, v] of L.content) { const ty = Math.floor(k / MAXW), tx = k % MAXW; if (tx < W && (g2[ty * W + tx] === TILE.Q || g2[ty * W + tx] === TILE.B || g2[ty * W + tx] === TILE.H)) content2.set(ty * W + tx, v); }
  L.w = W; L.g = g2; L.content = content2;

  // Sternmünzen: je eine pro Drittel, versteckter Weg bevorzugt
  const free = s => { const c = g2[s.ty * W + s.tx]; return s.tx > 12 && s.tx < W - 4 && s.ty > ceil && (c === 0 || c === TILE.C); };
  const picks = [];
  for (let k = 0; k < 3; k++) {
    const cand = L.stars.filter(s => free(s) && s.tx >= W * k / 3 && s.tx < W * (k + 1) / 3 && !picks.includes(s));
    const best = cand.filter(s => s.w >= 3);
    let s = best.length ? best[0] : cand.length ? rng.pick(cand) : null;
    if (!s) {
      const tx = Math.floor(W * (k + .5) / 3);
      let top = ceil; while (top < H && g2[top * W + tx] === 0) top++;
      s = { tx, ty: clamp(top - 4, ceil + 1, H - 2) };
      if (g2[s.ty * W + s.tx] !== 0 && g2[s.ty * W + s.tx] !== TILE.C) s.ty = ceil + 1;
    }
    if (g2[s.ty * W + s.tx] === TILE.C) g2[s.ty * W + s.tx] = 0;
    picks.push(s);
  }
  picks.forEach((s, i) => L.ents.push({ type: 'sternmuenze', x: s.tx * T + T / 2, y: s.ty * T + T / 2, idx: i }));
  L.ents = L.ents.filter(e => e.type !== 'enemy' || e.x > 14 * T || e.kind === 'pflanze' && e.x > 12 * T);
  return L;
}
