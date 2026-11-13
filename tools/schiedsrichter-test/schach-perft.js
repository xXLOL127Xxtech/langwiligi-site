// Prüft die Schach-Engine des Servers mit bekannten Perft-Zahlen (Anzahl möglicher Zugfolgen, Standardwerte aus dem Schachprogrammieren).
// Aufruf:  node tools/schiedsrichter-test/schach-perft.js
'use strict';
process.env.HUB_TEST = '1'; process.env.PORT = '0'; process.env.DATA_DIR = require('os').tmpdir() + '/hubtest-' + process.pid;
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'server', 'game-hub.js')).ENGINES.schach;
function fromFen(fen) {
  const [pl, side, cas, ep] = fen.split(' '), b = Array.from({ length: 8 }, () => Array(8).fill(null));
  pl.split('/').forEach((row, r) => { let c = 0; for (const ch of row) { if (/\d/.test(ch)) c += +ch; else { b[r][c++] = { color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toUpperCase() }; } } });
  const st = { b, turn: side, cr: { wK: cas.includes('K'), wQ: cas.includes('Q'), bK: cas.includes('k'), bQ: cas.includes('q') }, ep: null, half: 0, hist: [], res: null };
  if (ep !== '-') st.ep = { r: 8 - +ep[1], c: ep.charCodeAt(0) - 97 };
  return st;
}
const clone = st => JSON.parse(JSON.stringify(st));
function perft(st, d) {
  if (d === 0) return 1;
  let n = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = st.b[r][c]; if (!p || p.color !== st.turn) continue;
    for (const m of E.legalMoves(st, r, c)) {
      for (const promo of (m.special === 'promote' ? ['Q', 'R', 'B', 'N'] : [''])) {
        const s2 = clone(st); s2.res = null;
        if (!E.apply(s2, [r, c, m.r, m.c, m.special || '', promo])) throw new Error('Engine lehnt eigenen legalen Zug ab');
        n += d === 1 ? 1 : perft(s2, d - 1);
      }
    }
  }
  return n;
}
const CASES = [
  ['Anfangsstellung', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', [20, 400, 8902, 197281]],
  ['Kiwipete (Rochade, en passant)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]],
  ['Endspiel (en passant-Fallen)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812, 43238]],
  ['Umwandlungen', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -', [6, 264, 9467]],
  ['Stellung 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -', [44, 1486, 62379]],
];
let fail = 0;
for (const [name, fen, want] of CASES) {
  const got = want.map((_, i) => perft(fromFen(fen), i + 1));
  const ok = got.every((g, i) => g === want[i]); if (!ok) fail++;
  console.log((ok ? '✅ ' : '❌ ') + name + ': ' + got.join(' / ') + (ok ? '' : '   erwartet ' + want.join(' / ')));
}
process.exit(fail ? 1 : 0);
