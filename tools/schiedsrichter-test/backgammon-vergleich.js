// Vergleicht den Backgammon-Schiedsrichter des Servers mit den echten Funktionen aus games/backgammon/index.html.
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
  let html = fs.readFileSync(path.join(root, 'games', 'backgammon', 'index.html'), 'utf8');
  html = html.replace('  window.userRoll = userRoll;', '  window.__bg = { resetGame, rollDice, doMove, undoMove, getLegalFirstMoves, st: function () { return { points: points, bar: bar, borneOff: borneOff, turn: turn, phase: phase, dice: dice, hist: moveHistory.length }; } };\n  window.userRoll = userRoll;');
  const sb = { console, Math, Date, JSON, Array, Object, Number, String, Set, Map, Promise, Symbol, Error, parseInt, parseFloat, isNaN,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {} }, location: { hash: '', search: '', pathname: '/', hostname: 'x' }, history: stub(), navigator: stub(), document: stub(),
    addEventListener() {}, removeEventListener() {}, alert() {}, getComputedStyle: () => stub(), ResizeObserver: stub() };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) { try { vm.runInContext(m[1], sb, { timeout: 5000 }); } catch (e) { /* Attrappe */ } }
  return sb.__bg;
}
const ri = n => Math.floor(Math.random() * n);
function same(g, ref) {
  const a = g.st(), b = ref.state();
  const pts = a.points.map(p => p.count + ':' + p.owner).join(','), pts2 = b.pts.map(p => p.count + ':' + p.owner).join(',');
  return pts === pts2 && a.bar[1] === b.bar[1] && a.bar[2] === b.bar[2] && a.borneOff[1] === b.off[1] && a.borneOff[2] === b.off[2] && a.turn === b.turn && (a.phase === b.phase || (a.phase === 'gameover' && b.phase === 'over')) &&
    JSON.stringify(a.dice.slice().sort()) === JSON.stringify(b.dice.slice().sort()) && a.hist === b.hist.length;
}
function runOne() {
  const g = load(); if (!g) throw new Error('Spiel nicht geladen');
  const ref = REFEREES.backgammon();
  g.resetGame(); ref.move(0, { t: 'start' });
  let steps = 0;
  for (; steps < 20000 && !ref.verdict(); steps++) {
    const s = g.st(), seat = s.turn === 1 ? 0 : 1;
    if (s.phase === 'roll') {
      const d = [1 + ri(6), 1 + ri(6)];
      if (Math.random() < .03) { if (ref.move(1 - seat, { t: 'roll', d })) return 'Wurf des falschen Spielers angenommen'; }
      if (Math.random() < .02) { if (ref.move(seat, { t: 'roll', d: [7, 1] })) return 'Wurf 7 angenommen'; }
      if (!ref.move(seat, { t: 'roll', d })) return 'Wurf abgelehnt';
      g.rollDice(d);
    } else if (s.phase === 'move') {
      const legal = g.getLegalFirstMoves(s.turn, s.dice), x = Math.random();
      if (x < .03 && s.hist > 0) { if (!ref.move(seat, { t: 'undo' })) return 'undo abgelehnt'; g.undoMove(); }
      else if (x < .15) {
        const bad = { t: 'mv', from: ri(26) === 25 ? 'bar' : 1 + ri(24), to: Math.random() < .1 ? 'off' : 1 + ri(24), die: 1 + ri(6) };
        const isLegal = legal.some(m => String(m.from) === String(bad.from) && String(m.to) === String(bad.to) && m.dieVal === bad.die);
        const ok = ref.move(seat, bad);
        if (ok !== isLegal) return `Zufallszug ${JSON.stringify(bad)}: Spiel ${isLegal}, Server ${ok}`;
        if (isLegal) g.doMove(legal.find(m => String(m.from) === String(bad.from) && String(m.to) === String(bad.to) && m.dieVal === bad.die));
      } else {
        const mv = legal[ri(legal.length)];
        if (!mv) return 'Phase move ohne legalen Zug';
        if (!ref.move(seat, { t: 'mv', from: mv.from, to: mv.to, die: mv.dieVal })) return 'legaler Zug abgelehnt ' + JSON.stringify(mv);
        g.doMove(mv);
      }
    } else break;
    if (!same(g, ref)) return 'Zustand uneinig nach Schritt ' + steps + ' (Phase ' + g.st().phase + ')';
  }
  const v = ref.verdict(), s = g.st();
  if (s.phase === 'gameover') { const w = s.borneOff[1] === 15 ? 0 : 1; if (!v || v.winner !== w) return 'Sieger uneinig'; return null; }
  return 'unfertig';
}
let fail = 0, ok = 0, un = 0;
for (let k = 0; k < 25; k++) { let r; try { r = runOne(); } catch (e) { r = 'Ausnahme ' + e.stack.split('\n').slice(0, 3).join(' | '); } if (r === 'unfertig') un++; else if (r) { fail++; console.log('❌ Backgammon: ' + r); } else ok++; }
console.log((fail ? '❌' : '✅') + ' backgammon: ' + ok + ' Partien bis zum Sieg identisch, ' + un + ' unfertig, ' + fail + ' Fehler');
process.exit(fail ? 1 : 0);
