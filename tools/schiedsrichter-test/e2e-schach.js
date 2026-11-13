// Ende-zu-Ende-Test: Zwei echte Browser spielen Schach (Narrenmatt) über den echten Server. Schwarz gewinnt, der Schiedsrichter erkennt das Matt selbst.
// Aufruf (als root, Port 80):  NODE_PATH=<Ordner mit ws>:$(npm root -g) node tools/schiedsrichter-test/e2e-schach.js
'use strict';
const { start } = require('./e2e-infra');
(async () => {
  const { player, leaderboard, stop, sleep, ok } = await start();
  const mk = async name => { const p = await player(name, '/schach/'); await p.click('#btn-on'); await p.fill('.ol-name', name); return p; };
  const A = await mk('Anna'), B = await mk('Bob');
  await A.click('.ol-create'); await A.waitForFunction(() => document.querySelector('.ol-big').textContent.trim().length === 4, null, { timeout: 8000 });
  const code = (await A.textContent('.ol-big')).trim(); ok(/^[A-Z0-9]{4}$/.test(code), 'Raum erstellt: ' + code);
  await B.fill('.ol-code', code); await B.click('.ol-join');
  await A.waitForSelector('#board .cell', { timeout: 8000 }); await sleep(800);
  const sq = (p, r, c) => p.locator('#board .cell[data-r="' + r + '"][data-c="' + c + '"]');
  const mv = async (p, fr, fc, tr, tc) => { await sq(p, fr, fc).click(); await sleep(150); await sq(p, tr, tc).click(); await sleep(400); };
  await mv(A, 6, 5, 5, 5);          // 1. f3
  await mv(B, 1, 4, 3, 4);          // 1... e5
  await mv(A, 6, 6, 4, 6);          // 2. g4
  await mv(B, 0, 3, 4, 7);          // 2... Dh4 matt
  await sleep(4500);
  const rows = await leaderboard('schach'); console.log(JSON.stringify(rows));
  const anna = rows.find(r => r.name === 'Anna'), bob = rows.find(r => r.name === 'Bob');
  ok(bob && bob.wins === 1 && bob.games === 1, 'Bob (Schwarz): 1 Sieg durch Matt');
  ok(anna && anna.wins === 0 && anna.games === 1, 'Anna: 0 Siege, 1 Spiel');
  await stop();
})().catch(e => { console.error(e); process.exit(1); });
