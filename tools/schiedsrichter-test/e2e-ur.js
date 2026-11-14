// Ende-zu-Ende-Test: Zwei echte Browser spielen "Das Königliche Spiel von Ur" mit Server-Würfeln. Beide müssen immer denselben Wurf und dieselben Steine sehen.
// Aufruf (als root, Port 80):  NODE_PATH=<Ordner mit ws>:$(npm root -g) node tools/schiedsrichter-test/e2e-ur.js
'use strict';
const { start } = require('./e2e-infra');
(async () => {
  const { player, stop, sleep, ok } = await start();
  const mk = async name => { const p = await player(name, '/ur/'); await p.click('#mode-on'); await p.fill('.ol-name', name); return p; };
  const A = await mk('Anna'), B = await mk('Bob');
  await A.click('.ol-create'); await A.waitForFunction(() => document.querySelector('.ol-big').textContent.trim().length === 4, null, { timeout: 8000 });
  const code = (await A.textContent('.ol-big')).trim(); ok(/^[A-Z0-9]{4}$/.test(code), 'Raum erstellt: ' + code);
  await B.fill('.ol-code', code); await B.click('.ol-join'); await sleep(1500);
  const snap = p => p.evaluate(() => ({ total: document.getElementById('dice-total').textContent, dice: [...document.querySelectorAll('#dice-container .die')].map(d => d.classList.contains('marked') ? 1 : 0).join(''),
    pieces: [...document.querySelectorAll('#board .piece')].map(e => e.dataset.player + ':' + e.dataset.index + '@' + e.closest('.cell').dataset.row + ',' + e.closest('.cell').dataset.col).sort().join(' '),
    staging: [1, 2].map(n => document.querySelectorAll('#p' + n + '-staging .staging-piece').length).join('/'), scored: [1, 2].map(n => document.querySelectorAll('#p' + n + '-scored *').length).join('/') }));
  let moves = 0, rolls = 0, same = true, detail = '';
  for (let i = 0; i < 14; i++) {
    const rollerA = await A.isEnabled('#roll-btn'), rollerB = await B.isEnabled('#roll-btn');
    const R = rollerA ? A : rollerB ? B : null;
    if (!R) { await sleep(600); continue; }
    await R.click('#roll-btn'); rolls++; await sleep(500);
    const sa = await snap(A), sb = await snap(B);
    if (sa.dice !== sb.dice || sa.total !== sb.total) { same = false; detail = 'Wurf ' + JSON.stringify([sa.dice, sb.dice]); break; }
    const sel = R.locator('.piece.selectable, .staging-piece.selectable');
    if (await sel.count()) { await sel.first().click(); moves++; await sleep(500); const a2 = await snap(A), b2 = await snap(B); if (a2.pieces !== b2.pieces || a2.staging !== b2.staging || a2.scored !== b2.scored) { same = false; detail = 'Steine ' + JSON.stringify([a2, b2]); break; } }
    else await sleep(1500);   // 0 geworfen oder kein Zug: Spielerwechsel nach 1,2 s
  }
  ok(rolls >= 6 && moves >= 3, 'gespielt: ' + rolls + ' Würfe, ' + moves + ' Züge');
  ok(same, 'beide Seiten sehen immer denselben Wurf und dieselben Steine' + (detail ? ' (' + detail + ')' : ''));
  await stop();
})().catch(e => { console.error(e); process.exit(1); });
