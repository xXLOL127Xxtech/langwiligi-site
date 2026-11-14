// Vergleicht die Regel-Engines des Servers (server/game-hub.js, ENGINES) mit dem echten Spielcode.
// Das Spiel wird in Node mit einem Attrappen-DOM geladen, dann bekommen beide dieselben zufälligen Zugvorschläge.
// Beide müssen jeden Zug gleich annehmen oder ablehnen und am Ende denselben Sieger haben.
// Aufruf:  node tools/schiedsrichter-test/vergleich.js [spiel-id ...]
'use strict';
process.env.HUB_TEST = '1'; process.env.PORT = '0'; process.env.DATA_DIR = require('os').tmpdir() + '/hubtest-' + process.pid;
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', '..');
const { ENGINES } = require(path.join(root, 'server', 'game-hub.js'));

function stub() {
  const f = function () {};
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length' || k === 'childElementCount' || k === 'offsetWidth' || k === 'clientWidth') return 0;
      if (k === 'then') return undefined;
      if (k === 'getBoundingClientRect') return () => ({ width: 100, height: 100, left: 0, top: 0 });
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === 'style' || k === 'dataset') return new Proxy({}, { get: (o, kk) => (kk === 'setProperty' || kk === 'removeProperty' ? () => {} : o[kk]), set: (o, kk, v) => { o[kk] = v; return true; } });
      return p;
    },
    set() { return true; }, apply() { return p; }, construct() { return p; },
  });
  return p;
}
function loadGame(id) {
  const html = fs.readFileSync(path.join(root, 'games', id, 'index.html'), 'utf8');
  const timers = [];
  const sandbox = { console, Math, Date, JSON, Array, Object, Number, String, Set, Map, Promise, Symbol, Error, parseInt, parseFloat, isNaN, isFinite, Uint8Array, Float32Array, Int32Array,
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => Date.now() },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, location: { hash: '', search: '', pathname: '/', protocol: 'http:', hostname: 'x' }, history: stub(),
    navigator: stub(), document: stub(), AudioContext: stub(), webkitAudioContext: stub(), Image: stub(), Audio: stub(), matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, GameHub: undefined, alert() {}, getComputedStyle: () => stub(), ResizeObserver: stub(), MutationObserver: stub(), URLSearchParams, structuredClone };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const code of scripts) { try { vm.runInContext(code, sandbox, { timeout: 5000 }); } catch (e) { /* Attrappe reicht nicht überall, egal */ } }
  const reg = sandbox.GameRegistry && sandbox.GameRegistry.games && sandbox.GameRegistry.games[0];
  if (!reg) throw new Error('Spiel hat sich nicht registriert: ' + id);
  return { reg, sandbox, timers };
}

// Zugvorschläge pro Spiel (sollen oft legal sein, aber auch Unsinn enthalten)
const ri = n => Math.floor(Math.random() * n);
const PROPOSE = {
  'fuenf-gewinnt': (st) => ({ r: ri(st.size), c: ri(st.size) }),
  'vier-gewinnt': (st) => ri(st.cols),
  'tic-tac-turbo': (st) => Math.random() < .1 ? { b: ri(10) - 1, c: ri(9) } : (st.forced >= 0 && Math.random() < .8 ? { b: st.forced, c: ri(9) } : { b: ri(9), c: ri(9) }),
  'reversi': () => ({ r: ri(8), c: ri(8) }),
  'mancala': () => ri(14) - (Math.random() < .05 ? 1 : 0),
  'dame': (st) => {
    const mine = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (st.board[r][c] && st.board[r][c].p === st.turn) mine.push([r, c]);
    const from = Math.random() < .9 && mine.length ? mine[ri(mine.length)] : [ri(8), ri(8)];
    const d = [[-1, -1], [-1, 1], [1, -1], [1, 1]][ri(4)], k = 1 + ri(Math.random() < .5 ? 2 : 6);
    return { from, to: [from[0] + d[0] * k, from[1] + d[1] * k], cap: null };
  },
  'mauerbauer': (st) => {
    const me = st.pawns[st.turn], x = Math.random();
    if (x < .55) { const d = [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [-1, 1], [1, -1], [-1, -1], [1, 1]][ri(10)]; return { t: 'move', r: me.r + d[0], c: me.c + d[1] }; }
    return { t: 'wall', o: ['h', 'v'][ri(2)], r: ri(st.N), c: ri(st.N) };
  },
  'farbfalle': (st) => {
    const p = Math.random() < .03 ? 1 - st.turn : st.turn, n = st.pieces[p].length, idx = ri(n), pc = st.pieces[p][idx], dr = p === 0 ? -1 : 1, d = [[dr, 0], [dr, -1], [dr, 1]][ri(3)], k = 1 + ri(4);
    return { p, idx, to: [pc.r + d[0] * k, pc.c + d[1] * k] };
  },
  'laserlabyrinth': (st) => {
    const mine = []; st.b.forEach((p, i) => { if (p && p.type === 'mirror' && p.player === st.turn) mine.push(i); });
    const from = Math.random() < .9 ? mine[ri(mine.length)] : ri(64);
    if (Math.random() < .4) return { t: 'rotate', idx: from };
    const d = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1]][ri(5)];
    return { t: 'move', from, to: from + d[0] * 8 + d[1] };
  },
  'panzer-duell': (st) => {
    const pl = st.players[st.turn], x = Math.random(), N = st.N;
    if (x < .08) return { t: 'end' };
    if (x < .4) { const k = 1 + ri(3), d = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1]][ri(5)]; return { t: 'move', r: pl.r + d[0] * k, c: pl.c + d[1] * k }; }
    const kind = ['shoot', 'shoot', 'pierce', 'rocket', 'mine'][ri(5)];
    if (kind === 'mine') { const d = [[-1, 0], [1, 0], [0, -1], [0, 1]][ri(4)]; return { t: 'mine', r: pl.r + d[0], c: pl.c + d[1] }; }
    if (kind === 'rocket') return { t: 'rocket', r: Math.max(0, Math.min(N - 1, pl.r + ri(7) - 3)), c: Math.max(0, Math.min(N - 1, pl.c + ri(7) - 3)) };
    const foe = st.players[1 - st.turn];
    return Math.random() < .5 ? { t: kind, r: foe.r, c: foe.c } : { t: kind, r: pl.r, c: ri(N) };
  },
  'dreh-und-gewinn': () => ({ cell: ri(36), quad: ri(4), dir: ['cw', 'ccw'][ri(2)] }),
  'dots-and-boxes': (st) => Math.random() < .5 ? { type: 'h', r: ri(st.H + 1), c: ri(st.W) } : { type: 'v', r: ri(st.H), c: ri(st.W + 1) },
};
const OPTIONS = {
  'fuenf-gewinnt': [{ size: 9, need: 4 }, { size: 13, need: 5 }, { size: 9, need: 6 }],
  'vier-gewinnt': [{}, { cols: 5, rows: 5, need: 3 }, { cols: 9, rows: 8, need: 5 }],
  'tic-tac-turbo': [{}],
  'reversi': [{}],
  'mauerbauer': [{ size: 5 }, { size: 7 }, { size: 9 }],
  'farbfalle': [{ reihen: 2 }, { reihen: 1 }],
  'dreh-und-gewinn': [{}],
  'panzer-duell': [{}, { size: 9, map: 'dense', ap: 5, hp: 80 }, { size: 13, map: 'open', ap: 3, hp: 120 }],
  'laserlabyrinth': [{}],
  'mancala': [{}],
  'dame': [{ kings: 'standard' }, { kings: 'flying' }],
  'dots-and-boxes': [{ cols: 4, rows: 4, bonus: 'few' }, { cols: 5, rows: 3, bonus: 'many' }, { cols: 3, rows: 3, bonus: 'off' }],
};
const LENIENT = new Set(['dame', 'farbfalle', 'dreh-und-gewinn']);
const clone = o => JSON.parse(JSON.stringify(o));

function runOne(id, options, seedNum) {
  const { reg, sandbox, timers } = loadGame(id), E = ENGINES[id];
  const seed = (Math.random() * 4294967295) >>> 0 || 1;
  const calls = { n: 0, turn: null, scores: [0, 0], draw: false };
  const ctx = { options: Object.assign({}, options), isOnline: true, mySeat: 0, roomSeat: 0, firstSeat: 0, round: 1, vsAI: false, aiLevel: 'medium', boardEl: stub(),
    rng: sandbox.makeRng ? sandbox.makeRng(seed) : Math.random,
    setTurn(i) { calls.n++; calls.turn = i; }, setStatus(t) { calls.n++; if (/🤝/.test(t) && !/🎉/.test(t)) calls.draw = true; }, setNames() {},
    incScore(i) { calls.n++; calls.scores[i]++; }, decScore() {}, getScore(i) { return calls.scores[i]; }, sendMove() {}, sound() {}, t: x => x };
  const inst = reg.create(ctx);
  const st = E.init(Object.assign({}, options), seed);
  if (!st) throw new Error(id + ': Engine lehnt gültige Optionen ab: ' + JSON.stringify(options));
  let applied = 0, bad = null;
  for (let i = 0; i < 4000 && !E.result(st); i++) {
    const mv = PROPOSE[id](st);
    const before = calls.n;
    let okR = true;
    const mvE = clone(mv), okE = !!E.apply(st, mvE);
    // Spiele ohne Regelprüfung in applyMove (die Prüfung steckt im Klick): nur Züge, die die Engine annimmt, ans Spiel geben
    if (LENIENT.has(id) && !okE) continue;
    try { inst.applyMove(clone(LENIENT.has(id) ? mvE : mv), true); } catch (e) { okR = false; }
    while (timers.length) { try { timers.shift()(); } catch (e) { /* egal */ } }
    if (calls.n === before) okR = false;
    if (okE !== okR) { bad = `Zug ${JSON.stringify(mv)} (Nr. ${i}): Spiel ${okR ? 'nimmt an' : 'lehnt ab'}, Engine ${okE ? 'nimmt an' : 'lehnt ab'}`; break; }
    if (okE) {
      applied++;
      const over = !!E.result(st);
      if (over !== (calls.turn === -1)) { bad = `Ende uneinig nach Zug ${JSON.stringify(mv)}: Engine ${over}, Spiel ${calls.turn === -1}`; break; }
      if (!over && calls.turn !== E.turn(st)) { bad = `Spieler am Zug uneinig nach ${JSON.stringify(mv)}: Engine ${E.turn(st)}, Spiel ${calls.turn}`; break; }
    }
  }
  if (bad) return { ok: false, bad };
  const r = E.result(st);
  if (!r) return { ok: true, applied, unfinished: true };
  const gw = calls.draw ? -1 : calls.scores[0] > calls.scores[1] ? 0 : calls.scores[1] > calls.scores[0] ? 1 : -1;
  if (gw !== r.winner) return { ok: false, bad: `Sieger uneinig: Engine ${r.winner}, Spiel ${gw} (${calls.scores})` };
  return { ok: true, applied, winner: r.winner };
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENGINES);
let fail = 0;
for (const id of ids) {
  if (!ENGINES[id] || !PROPOSE[id]) { console.log('⏭️  ' + id + ': kein Test'); continue; }
  const stat = { runs: 0, finished: 0, w: [0, 0, 0], moves: 0 };
  let bad = null;
  for (const opt of OPTIONS[id]) for (let k = 0; k < 15 && !bad; k++) {
    let r; try { r = runOne(id, opt); } catch (e) { r = { ok: false, bad: 'Ausnahme: ' + e.stack.split('\n').slice(0, 3).join(' | ') }; }
    stat.runs++;
    if (!r.ok) { bad = r.bad + '  Optionen ' + JSON.stringify(opt); break; }
    stat.moves += r.applied; if (!r.unfinished) { stat.finished++; stat.w[r.winner < 0 ? 2 : r.winner]++; }
  }
  if (bad) { fail++; console.log('❌ ' + id + ': ' + bad); }
  else console.log('✅ ' + id + ': ' + stat.runs + ' Partien, ' + stat.moves + ' gleiche Züge, ' + stat.finished + ' beendet (Siege ' + stat.w[0] + '/' + stat.w[1] + ', remis ' + stat.w[2] + ')');
}
process.exit(fail ? 1 : 0);
