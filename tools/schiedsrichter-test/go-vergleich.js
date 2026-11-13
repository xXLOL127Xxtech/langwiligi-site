// Vergleicht den Go-Schiedsrichter des Servers mit den echten Go-Funktionen aus games/go/index.html (zufällige Partien inkl. Wertungsphase).
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
  const html = fs.readFileSync(path.join(root, 'games', 'go', 'index.html'), 'utf8');
  const sb = { console, Math, Date, JSON, Array, Object, Number, String, Set, Map, Promise, Symbol, Error, parseInt, parseFloat, isNaN,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {} }, location: { hash: '', search: '', pathname: '/', hostname: 'x' }, history: stub(), navigator: stub(), document: stub(),
    addEventListener() {}, removeEventListener() {}, alert() {}, getComputedStyle: () => stub(), ResizeObserver: stub() };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) { try { vm.runInContext(m[1], sb, { timeout: 5000 }); } catch (e) { /* Attrappe */ } }
  return sb;
}
const ri = n => Math.floor(Math.random() * n), clone = o => JSON.parse(JSON.stringify(o));
function runOne(size) {
  const g = load(), ref = REFEREES.go();
  if (typeof g.tryMove !== 'function') throw new Error('Go-Funktionen nicht gefunden');
  g.boardSize = size; g.cellSize = 10; g.resetGame();
  if (!ref.move(0, { t: 'start', settings: { size } })) throw new Error('start abgelehnt');
  const same = () => { const S = ref.state(); return JSON.stringify(g.board) === JSON.stringify(S.b) && g.currentPlayer === S.cur && g.scoringMode === S.scoring && g.consecutivePasses === S.passes; };
  let conf = {}, steps = 0;
  for (; steps < 3000 && !ref.verdict(); steps++) {
    const S = ref.state();
    if (g.scoringMode) {
      const x = Math.random(), seat = ri(2);
      if (x < .45) {
        const stones = []; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g.board[r][c]) stones.push([r, c]);
        if (!stones.length) continue;
        const [r, c] = stones[ri(stones.length)], on = Math.random() < .7;
        if (!ref.move(seat, { t: 'dead', r, c, on })) return 'dead abgelehnt';
        g.setDeadGroup(r, c, on); conf = {};
        const want = new Set(Object.keys(g.deadStones).filter(k => g.deadStones[k])); if (want.size !== S.dead.size || [...want].some(k => !S.dead.has(k))) return 'tote Steine uneinig';
      } else if (x < .93) {
        const stale = Math.random() < .1, v = stale ? g.scoreVer - 1 : g.scoreVer;
        ref.move(seat, { t: 'confirm', v });
        if (!stale) { conf[seat] = true; if (conf[0] && conf[1]) { g.finishScore(); const sc = g.calculateScore(g.board); const w = sc.blackTotal > sc.whiteTotal ? 0 : sc.whiteTotal > sc.blackTotal ? 1 : -1; const vd = ref.verdict(); if (!vd || vd.winner !== w) return 'Wertung uneinig: Spiel ' + w + ' Server ' + JSON.stringify(vd); return null; } }
      } else { if (!ref.move(seat, { t: 'resume' })) return 'resume abgelehnt'; g.resumePlay(); }
      if (!same()) return 'Zustand uneinig in Wertung';
      continue;
    }
    const cur = g.currentPlayer, seat = cur === 1 ? 0 : 1, x = Math.random();
    if (x < .04 || (steps > 400 && x < .3)) { if (!ref.move(seat, { t: 'pass' })) return 'pass abgelehnt'; g.doPass(cur); }
    else {
      const r = ri(size + 1) - (Math.random() < .02 ? 1 : 0), c = ri(size), legalReal = r >= 0 && r < size && g.isLegalMove(r, c, cur);
      const wrong = Math.random() < .05, who = wrong ? 1 - seat : seat;
      const ok = ref.move(who, { t: 'mv', r, c });
      if (wrong) { if (ok) return 'Zug des falschen Spielers angenommen'; continue; }
      if (ok !== legalReal) return `Zug ${r},${c}: Spiel ${legalReal ? 'legal' : 'illegal'}, Server ${ok ? 'nimmt an' : 'lehnt ab'}`;
      if (legalReal) g.playMove(r, c, cur);
    }
    if (!same()) return 'Zustand uneinig nach Schritt ' + steps;
  }
  return ref.verdict() ? null : 'unfertig';
}
let fail = 0, done = 0, unfinished = 0;
for (const size of [9, 9, 9, 13, 19]) for (let k = 0; k < 6; k++) {
  let r; try { r = runOne(size); } catch (e) { r = 'Ausnahme ' + e.stack.split('\n').slice(0, 3).join(' | '); }
  if (r === 'unfertig') unfinished++; else if (r) { fail++; console.log('❌ Go ' + size + ': ' + r); } else done++;
}
console.log((fail ? '❌' : '✅') + ' go: ' + done + ' Partien bis zur Wertung identisch, ' + unfinished + ' unfertig, ' + fail + ' Fehler');
process.exit(fail ? 1 : 0);
