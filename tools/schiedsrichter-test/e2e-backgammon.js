// Ende-zu-Ende-Test: Zwei echte Browser spielen Backgammon mit Server-Würfeln. Beide müssen immer dieselben Würfel und dasselbe Brett sehen.
// Aufruf (als root, Port 80):  NODE_PATH=<Ordner mit ws>:$(npm root -g) node tools/schiedsrichter-test/e2e-backgammon.js
'use strict';
const { start } = require('./e2e-infra');
(async () => {
  const { player, stop, sleep, ok } = await start();
  const mk = async name => { const p = await player(name, '/backgammon/'); await p.click('.mode-btn:last-child'); await p.fill('.ol-name', name); return p; };
  const A = await mk('Anna'), B = await mk('Bob');
  await A.click('.ol-create'); await A.waitForFunction(() => document.querySelector('.ol-big').textContent.trim().length === 4, null, { timeout: 8000 });
  const code = (await A.textContent('.ol-big')).trim(); ok(/^[A-Z0-9]{4}$/.test(code), 'Raum erstellt: ' + code);
  await B.fill('.ol-code', code); await B.click('.ol-join'); await sleep(1500);
  const snap = p => p.evaluate(() => ({
    dice: [...document.querySelectorAll('#dice-area .die')].map(d => d.textContent + (d.classList.contains('used') ? 'x' : '')).join(','),
    board: [...document.querySelectorAll('.point-col')].map(c => c.querySelectorAll('.checker.p1').length + 'w' + c.querySelectorAll('.checker.p2').length + 'b' + (c.querySelector('.count-badge') ? c.querySelector('.count-badge').textContent : '')).sort().join(' '),
    bar: [...document.querySelectorAll('.bar-checker')].map(c => c.className).sort().join(' '),
    off: [...document.querySelectorAll('.tray-count')].map(c => c.textContent).join('|') }));
  let rolls = 0, moves = 0, same = true, detail = '';
  for (let i = 0; i < 40 && same; i++) {
    const R = (await A.isEnabled('#roll-btn')) ? A : (await B.isEnabled('#roll-btn')) ? B : null;
    if (R) { await R.click('#roll-btn'); rolls++; await sleep(500); }
    else {
      // Zug machen: Quelle anklicken, dann Ziel
      const P = (await A.locator('.point-col.highlight').count()) ? A : (await B.locator('.point-col.highlight').count()) ? B : null;
      if (!P) { await sleep(700); continue; }
      await P.locator('.point-col.highlight').first().click(); await sleep(200);
      const dest = P.locator('.point-col.dest-highlight');
      if (await dest.count()) await dest.first().click(); else await P.locator('.tray').last().click().catch(() => {});
      moves++; await sleep(500);
    }
    const sa = await snap(A), sb = await snap(B);
    if (sa.dice !== sb.dice || sa.board !== sb.board || sa.off !== sb.off) { same = false; detail = JSON.stringify([sa, sb]).slice(0, 400); }
  }
  ok(rolls >= 6 && moves >= 6, 'gespielt: ' + rolls + ' Würfe, ' + moves + ' Züge');
  ok(same, 'beide Seiten sehen immer dieselben Würfel und dasselbe Brett' + (detail ? ' (' + detail + ')' : ''));
  await stop();
})().catch(e => { console.error(e); process.exit(1); });
