// Ende-zu-Ende-Test: Zwei echte Browser spielen "Fünf gewinnt" über den echten Server (mit Schiedsrichter) und prüfen die Rangliste.
// Aufruf (als root, Port 80):  NODE_PATH=<Ordner mit ws>:$(npm root -g) node tools/schiedsrichter-test/e2e-fuenf-gewinnt.js
'use strict';
const { start } = require('./e2e-infra');
(async () => {
  const { player, leaderboard, stop, sleep, ok } = await start();
  const mk = async name => { const p = await player(name, '/fuenf-gewinnt/'); await p.locator('.mode-card', { hasText: 'Online' }).click(); await p.fill('#nameInput', name); return p; };
  const A = await mk('Anna'), B = await mk('Bob');
  await A.click('#createBtn'); await A.waitForFunction(() => document.querySelector('#roomCode').textContent.trim() !== '----', null, { timeout: 8000 });
  const code = (await A.textContent('#roomCode')).trim(); ok(/^[A-Z0-9]{4}$/.test(code), 'Raum erstellt: ' + code);
  await B.fill('#codeInput', code); await B.click('#joinBtn');
  await A.waitForSelector('.gmk-cell', { timeout: 8000 }); await B.waitForSelector('.gmk-cell', { timeout: 8000 }); ok(true, 'Beide sehen das Brett');
  const N = Math.round(Math.sqrt(await A.locator('.gmk-cell').count())), mid = Math.floor(N / 2);
  const click = async (p, r, c) => { await p.locator('.gmk-cell').nth(r * N + c).click(); await sleep(250); };
  for (let i = 0; i < 4; i++) { await click(A, mid, i); await click(B, mid + 1, i); }
  await click(A, mid, 4);
  await sleep(4500);
  const rows = await leaderboard('fuenf-gewinnt'); console.log(JSON.stringify(rows));
  const anna = rows.find(r => r.name === 'Anna'), bob = rows.find(r => r.name === 'Bob');
  ok(anna && anna.wins === 1 && anna.games === 1, 'Anna: 1 Sieg in der Rangliste');
  ok(bob && bob.wins === 0 && bob.games === 1, 'Bob: 0 Siege, 1 Spiel');
  ok(/gewinnst|you win/i.test(await A.textContent('#resTitle').catch(() => '')), 'Anna sieht «Du gewinnst!»');
  await stop();
})().catch(e => { console.error(e); process.exit(1); });
