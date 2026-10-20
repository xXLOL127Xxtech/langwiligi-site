'use strict';
// =====================================================================
//  Welten, Weltkarten-Aufbau, Spielstand und Fortschritt
// =====================================================================
// Jede Welt: Hauptweg Start → 1 → 2 → 3 → Turm → 4 → 5 → Burg
//   nach Level 2: rotes Bonushaus (Memory)
//   Level 3 hat einen geheimen Ausgang → Geheimlevel → Kanone (bzw. grünes Haus)
//   nach Level 4: Sternmünzen-Tor → grünes Bonushaus (Ballons)
const WORLD_SPECS = [
  { name: 'Sonnenwiese', map: 'wiese', themes: ['wiese', 'wiese', 'hoehle', 'wiese', 'wiese'], geheim: 'wiese', burg: 'burg', warp: 3, gate: 5,
    sky: ['#5ab4ff', '#c4ecff'], land: ['#7ad65a', '#4caa3c'], path: '#f6e3b0' },
  { name: 'Dünenmeer', map: 'wueste', themes: ['wueste', 'wueste', 'hoehle', 'wueste', 'wueste'], geheim: 'wueste', burg: 'burg', warp: 4, gate: 6,
    sky: ['#ff9a5a', '#ffe0a8'], land: ['#f0c27a', '#d0984a'], path: '#fff3d0' },
  { name: 'Frostgipfel', map: 'schnee', themes: ['schnee', 'schnee', 'spuk', 'schnee', 'schnee'], geheim: 'schnee', burg: 'burg', warp: 5, gate: 7,
    sky: ['#7fb2e5', '#e4f0fb'], land: ['#e8f4ff', '#a8c8e8'], path: '#9ab8d8' },
  { name: 'Korallenküste', map: 'strand', themes: ['strand', 'see', 'strand', 'see', 'strand'], geheim: 'see', burg: 'burg', warp: 6, gate: 8,
    sky: ['#3fa8f0', '#bfeaff'], land: ['#ffe6a8', '#e8c27a'], path: '#ffffff', sea: true },
  { name: 'Wolkenpfad', map: 'wolken', themes: ['wolken', 'wolken', 'wiese', 'wolken', 'wolken'], geheim: 'wolken', burg: 'burg', warp: 7, gate: 9,
    sky: ['#6ec3ff', '#ffffff'], land: ['#ffffff', '#d6e6ff'], path: '#ffd96a' },
  { name: 'Kristallhöhle', map: 'hoehle', themes: ['hoehle', 'hoehle', 'spuk', 'hoehle', 'see'], geheim: 'hoehle', burg: 'burg', warp: 8, gate: 10,
    sky: ['#1a1236', '#3a2a5e'], land: ['#5d4c80', '#3a2c58'], path: '#9fe8e0' },
  { name: 'Nebelwald', map: 'nebel', themes: ['nebel', 'spuk', 'nebel', 'nebel', 'spuk'], geheim: 'nebel', burg: 'burg', warp: 0, gate: 11,
    sky: ['#0c0f1e', '#3e4660'], land: ['#2e4a36', '#1a2a22'], path: '#a8a090' },
  { name: 'Schattenreich', map: 'schatten', themes: ['schatten', 'schatten', 'spuk', 'schatten', 'schatten'], geheim: 'schatten', burg: 'burg', warp: 0, gate: 12, final: true,
    sky: ['#06030c', '#4a1236'], land: ['#3a2a3e', '#1a0e20'], path: '#c03aff' },
  { name: 'Sternenwelt', map: 'sterne', themes: ['sterne', 'sterne', 'wolken', 'sterne', 'schatten', 'sterne', 'see', 'sterne'], secretWorld: true,
    sky: ['#02020e', '#2a1a5e'], land: ['#3a3a8a', '#1a1a4a'], path: '#ffe066' },
];
const WORLD_COUNT = 9;

// Weltkarte einer Welt aufbauen (Knoten und Wege)
function buildWorld(n) {
  const spec = WORLD_SPECS[n - 1];
  const nodes = [], edges = [];
  const node = (id, type, extra) => { const o = Object.assign({ id, type, world: n }, extra); nodes.push(o); return o; };
  const edge = (a, b, req = 'clear') => edges.push({ a, b, req });
  if (spec.secretWorld) {
    node(n + '-S', 'start', { title: 'Start' });
    let prev = n + '-S';
    spec.themes.forEach((th, i) => { const id = n + '-' + (i + 1); node(id, 'level', { theme: th, title: `${n}-${i + 1}`, num: i + 1 }); edge(prev, id); prev = id; });
  } else {
    node(n + '-S', 'start', { title: 'Start' });
    const main = [
      [n + '-1', 'level', 0], [n + '-2', 'level', 1], [n + '-3', 'level', 2], [n + '-T', 'turm'], [n + '-4', 'level', 3], [n + '-5', 'level', 4], [n + '-B', 'burg'],
    ];
    let prev = n + '-S';
    for (const [id, type, ti] of main) {
      node(id, type, type === 'level' ? { theme: spec.themes[ti], title: id, num: ti + 1, secret: ti === 2 } : { title: type === 'turm' ? 'Turm' : (spec.final ? 'Schattenburg' : 'Burg') });
      edge(prev, id); prev = id;
    }
    node(n + '-HR', 'haus', { variant: 'rot', title: 'Memory-Haus' });
    edge(n + '-2', n + '-HR');
    node(n + '-G', 'level', { theme: spec.geheim, title: n + '-?', num: 6, geheim: true });
    edge(n + '-3', n + '-G', 'secret');
    if (spec.warp) { node(n + '-K', 'kanone', { target: spec.warp, title: 'Kanone' }); edge(n + '-G', n + '-K'); }
    else { node(n + '-HG2', 'haus', { variant: 'gruen', title: 'Ballon-Haus' }); edge(n + '-G', n + '-HG2'); }
    node(n + '-Z', 'tor', { cost: spec.gate, title: 'Sternentor' });
    edge(n + '-4', n + '-Z');
    node(n + '-HG', 'haus', { variant: 'gruen', title: 'Ballon-Haus' });
    edge(n + '-Z', n + '-HG', 'paid');
  }
  layoutWorld(nodes, edges, n);
  return { n, spec, nodes, edges, byId: Object.fromEntries(nodes.map(o => [o.id, o])) };
}
// Positionen in einer 1000×560-Karte
function layoutWorld(nodes, edges, n) {
  const main = [];
  const byId = Object.fromEntries(nodes.map(o => [o.id, o]));
  let cur = nodes[0]; main.push(cur);
  const isMain = o => o.type === 'start' || o.type === 'turm' || o.type === 'burg' || (o.type === 'level' && !o.geheim);
  while (true) {
    const e = edges.find(e => e.a === cur.id && isMain(byId[e.b]) && !main.includes(byId[e.b]));
    if (!e) break; cur = byId[e.b]; main.push(cur);
  }
  const M = main.length;
  main.forEach((o, i) => {
    o.x = 80 + i * (840 / (M - 1));
    o.y = 300 + Math.sin(i * 1.25 + n * .7) * 120;
  });
  // Seitenzweige
  const placed = new Set(main.map(o => o.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const a = byId[e.a], b = byId[e.b];
      if (placed.has(e.a) && !placed.has(e.b)) {
        const up = a.y > 280 ? -1 : 1;
        const chain = !main.includes(a);
        b.x = a.x + (chain ? 110 : 30); b.y = a.y + (chain ? 0 : up * 140);
        b.y = clamp(b.y, 70, 500); b.x = clamp(b.x, 60, 950);
        placed.add(e.b); changed = true;
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Spielstand (3 Speicherplätze im localStorage)
// ---------------------------------------------------------------------
function newSave() {
  return {
    v: 2, created: Date.now(), saved: Date.now(), seed: (Math.random() * 2 ** 31) >>> 0,
    lives: 5, inv: { beere: 1, bluete: 0, frost: 0, wirbel: 0, eisbaer: 0, stern: 0 },
    world: 1, at: {}, done: {}, paid: {}, unlocked: [1], beaten: [], spent: 0, houses: {}, clears: 0,
    story: { intro: false, ending: false }, score: 0, playMs: 0,
  };
}
function loadSlot(i) { const s = store('spielstand-' + i); return s && s.v === 2 ? s : null; }
function writeSlot(i, s) { s.saved = Date.now(); store('spielstand-' + i, s); }
function deleteSlot(i) { try { localStorage.removeItem(GAME_ID + '-spielstand-' + i); } catch (e) { } }

const Prog = {
  save: null, slot: 0, worlds: {},
  world(n) { return this.worlds[n] || (this.worlds[n] = buildWorld(n)); },
  rec(id) { return this.save.done[id] || (this.save.done[id] = { c: 0, s: 0, stars: [0, 0, 0] }); },
  beaten(id) { const r = this.save.done[id]; return !!(r && (r.c || r.s)); },
  // Ist eine Kante begehbar?
  edgeOpen(W, e) {
    const a = W.byId[e.a], r = this.save.done[e.a];
    if (a.type === 'start') return true;
    if (e.req === 'secret') return !!(r && r.s);
    if (e.req === 'paid') return !!this.save.paid[e.a];
    if (a.type === 'tor') return !!this.save.paid[e.a];
    if (a.type === 'haus' || a.type === 'kanone') return true;
    return !!(r && r.c);
  },
  reachable(W, id) {
    if (W.nodes[0].id === id) return true;
    return W.edges.some(e => (e.b === id && this.edgeOpen(W, e)) || (e.a === id && this.edgeOpen(W, e) && this.reachable2(W, e.a)));
  },
  reachable2(W, id) { return W.edges.some(e => e.b === id && this.edgeOpen(W, e)) || W.nodes[0].id === id; },
  neighbours(W, id) {
    const out = [];
    for (const e of W.edges) {
      if (!this.edgeOpen(W, e)) continue;
      if (e.a === id) out.push(e.b); else if (e.b === id) out.push(e.a);
    }
    return out;
  },
  path(W, from, to) {
    const prev = { [from]: null }, q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const nb of this.neighbours(W, c)) if (!(nb in prev)) { prev[nb] = c; q.push(nb); } }
    if (!(to in prev)) return null;
    const p = []; for (let c = to; c; c = prev[c]) p.unshift(c); return p;
  },
  starsTotal() { let n = 0; for (const k in this.save.done) for (const v of this.save.done[k].stars || []) n += v ? 1 : 0; return n; },
  starsWorld(n) { let got = 0, all = 0; for (const nd of this.world(n).nodes) if (nd.type === 'level' || nd.type === 'turm' || nd.type === 'burg') { all += 3; const r = this.save.done[nd.id]; if (r) got += r.stars.filter(Boolean).length; } return [got, all]; },
  starsFree() { return this.starsTotal() - this.save.spent; },
  allStarsMain() { for (let n = 1; n <= 8; n++) { const [g, a] = this.starsWorld(n); if (g < a) return false; } return true; },
  w9Open() { return this.save.beaten.includes(8) && this.allStarsMain(); },
  // Level abgeschlossen
  levelDone(id, how, stars) {
    const r = this.rec(id);
    if (how === 'secret') r.s = 1; else r.c = 1;
    stars.forEach((v, i) => { if (v) r.stars[i] = 1; });
    this.save.clears++;
    const W = this.world(+id.split('-')[0]), nd = W.byId[id];
    if (nd && nd.type === 'burg') {
      const n = W.n;
      if (!this.save.beaten.includes(n)) this.save.beaten.push(n);
      if (n < 8 && !this.save.unlocked.includes(n + 1)) this.save.unlocked.push(n + 1);
    }
    if (this.w9Open() && !this.save.unlocked.includes(9)) this.save.unlocked.push(9);
  },
  houseReady(id) { const last = this.save.houses[id]; return last === undefined || last < this.save.clears; },
  levelSeed(id) { let h = this.save.seed; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0; return h; },
  levelDiff(nd) {
    const w = nd.world, base = (w - 1) / 8 + (nd.num ? (nd.num - 1) * .02 : 0) + (nd.type === 'turm' ? .05 : nd.type === 'burg' ? .1 : 0) + (nd.geheim ? .08 : 0);
    const off = G.diffSet === 'locker' ? -.18 : G.diffSet === 'knifflig' ? .2 : 0;
    return clamp(base + off + .12, 0, 1);
  },
};
