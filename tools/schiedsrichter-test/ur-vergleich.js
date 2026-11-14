// Vergleicht den Ur-Schiedsrichter des Servers mit den echten Funktionen aus games/ur/index.html.
'use strict';
process.env.HUB_TEST = '1'; process.env.PORT = '0'; process.env.DATA_DIR = require('os').tmpdir() + '/hubtest-' + process.pid;
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', '..');
const { REFEREES } = require(path.join(root, 'server', 'game-hub.js'));
function stub() {
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length' || k === 'offsetWidth' || k === 'clientWidth') return 0;
      if (k === 'then') return undefined;
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === 'style' || k === 'dataset') return new Proxy({}, { get: (o, kk) => (kk === 'setProperty' ? () => {} : o[kk]), set: (o, kk, v) => { o[kk] = v; return true; } });
      return p;
    }, set() { return true; }, apply() { return p; }, construct() { return p; } });
  return p;
}
function load() {
  const html = fs.readFileSync(path.join(root, 'games', 'ur', 'index.html'), 'utf8'), timers = [];
  const sb = { console, Math, Date, JSON, Array, Object, Number, String, Set, Map, Promise, Symbol, Error, parseInt, parseFloat, isNaN,
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {} }, location: { hash: '', search: '', pathname: '/', hostname: 'x' }, history: stub(), navigator: stub(), document: stub(),
    addEventListener() {}, removeEventListener() {}, alert() {}, getComputedStyle: () => stub(), ResizeObserver: stub() };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) { try { vm.runInContext(m[1], sb, { timeout: 5000 }); } catch (e) { /* Attrappe */ } }
  sb.__timers = timers; return sb;
}
const ri = n => Math.floor(Math.random() * n);
function same(g, ref) {
  const S = ref.state();
  return JSON.stringify(g.pieces) === JSON.stringify(S.pieces) && g.playerTurn === S.turn && (g.gameOver || g.phase === S.phase);
}
function runOne() {
  const g = load(), ref = REFEREES['ur']();
  if (typeof g.doRoll !== 'function') throw new Error('Spiel nicht geladen');
  g.online = false; g.aiMode = false; g.resetGame(); ref.move(0, { t: 'start' });
  const drain = () => { while (g.__timers.length) g.__timers.shift()(); };
  for (let steps = 0; steps < 4000 && !ref.verdict(); steps++) {
    const seat = g.playerTurn - 1;
    if (g.phase === 'roll') {
      const d = [0, 0, 0, 0].map(() => ri(2));
      if (Math.random() < .03 && ref.move(1 - seat, { t: 'roll', d })) return 'Wurf des falschen Spielers angenommen';
      if (!ref.move(seat, { t: 'roll', d })) return 'Wurf abgelehnt';
      g.doRoll(d); drain();
    } else {
      const moves = g.getValidMoves(g.playerTurn, g.diceValue);
      const bad = Math.random() < .12;
      let i = ri(7), to = bad ? ri(17) : null;
      if (!bad) { const m = moves[ri(moves.length)]; const idx = g.pieces[g.playerTurn].findIndex(p => p === m.from); i = idx; to = m.to; }
      const real = !bad ? true : (() => { const cur = g.pieces[g.playerTurn][i]; return moves.some(m => m.from === cur && m.to === to); })();
      const ok = ref.move(seat, { t: 'mv', i, to });
      if (ok !== real) return `Zug i=${i} to=${to}: Spiel ${real}, Server ${ok}`;
      if (real) g.executeMove(g.playerTurn, i, to);
    }
    if (!same(g, ref)) return 'Zustand uneinig nach Schritt ' + steps;
  }
  const v = ref.verdict();
  if (g.gameOver) { const w = g.pieces[1].every(p => p === 15) ? 0 : 1; return v && v.winner === w ? null : 'Sieger uneinig'; }
  return 'unfertig';
}
let fail = 0, ok = 0, un = 0;
for (let k = 0; k < 30; k++) { let r; try { r = runOne(); } catch (e) { r = 'Ausnahme ' + e.stack.split('\n').slice(0, 3).join(' | '); } if (r === 'unfertig') un++; else if (r) { fail++; console.log('❌ Ur: ' + r); } else ok++; }
console.log((fail ? '❌' : '✅') + ' ur: ' + ok + ' Partien bis zum Sieg identisch, ' + un + ' unfertig, ' + fail + ' Fehler');
process.exit(fail ? 1 : 0);
