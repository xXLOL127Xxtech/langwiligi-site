// Ende-zu-Ende-Test: Einladungslink. Anna (Deutsch) macht einen Raum, Bob (Englisch) öffnet den Link und muss OHNE weiteren Klick im Raum landen.
// Geprüft für Turbo-Kart (eigene Lobby) und Schach (allgemeiner Auto-Beitritt in freunde.js). Bob ist absichtlich englisch: gemischte Sprachen.
// Aufruf (als root, Port 80):  NODE_PATH=<Ordner mit ws>:$(npm root -g) node tools/schiedsrichter-test/e2e-einladung.js
'use strict';
const { start } = require('./e2e-infra');
(async () => {
  const { player, stop, sleep, ok } = await start();
  // --- Turbo-Kart ---
  const A = await player('Anna', '/turbo-kart/', 'de');
  await A.waitForSelector('#btnOnline:not([disabled])', { timeout: 15000 }); await A.click('#btnOnline');
  await A.fill('#oName', 'Anna'); await A.click('#oErstellen');
  await A.waitForFunction(() => document.querySelector('#lCode') && document.querySelector('#lCode').textContent.trim().length === 4, null, { timeout: 10000 });
  const code = (await A.textContent('#lCode')).trim(); ok(/^[A-Z0-9]{4}$/.test(code), 'Turbo-Kart: Raum erstellt: ' + code);
  const B = await player('Bob', '/turbo-kart/#' + code, 'en');
  const t0 = Date.now(); for (let i = 0; i < 14 && process.env.E2E_TRACE; i++) { await sleep(1000); console.log(i + 1, await B.evaluate(() => [App.screen, document.querySelector('#oFehler').textContent, !!Netz.room, document.querySelector('#oBeitreten').disabled, document.querySelector('#oName').value]).catch(e => 'nav')); }
  let drin = false; for (let i = 0; i < 40 && !drin; i++) { await sleep(500); drin = await B.evaluate(() => App.screen === 'sLobby').catch(() => false); }
  console.log('Bob in der Lobby nach ' + (Date.now() - t0) + ' ms');
  if (!drin) { const t1 = Date.now(); await B.waitForFunction(() => App.screen === 'sLobby', null, { timeout: 30000, polling: 300 }).catch(() => {}); console.log('erst nach +' + (Date.now() - t1) + ' ms'); console.log('Bob nach 6 s mehr:', await B.evaluate(() => [App.screen, document.querySelector('#oFehler').textContent, !!Netz.room])); }
  if (!drin) console.log('Bob-Bildschirm:', await B.evaluate(() => [App.screen, document.querySelector('#oFehler').textContent, !!Netz.room]));
  ok(drin, 'Turbo-Kart: Bob (Englisch) ist per Link direkt in der Lobby');
  await sleep(800);
  const liste = await A.textContent('#lListe'); ok(/Bob|[A-Za-z]+\d+/.test(liste) && (await A.locator('#lListe > div').count()) === 2, 'Turbo-Kart: Anna sieht 2 Fahrer in der Lobby');
  // --- Schach ---
  const C = await player('Cora', '/schach/', 'de'); await C.click('#btn-on'); await C.fill('.ol-name', 'Cora'); await C.click('.ol-create');
  await C.waitForFunction(() => document.querySelector('.ol-big').textContent.trim().length === 4, null, { timeout: 8000 });
  const code2 = (await C.textContent('.ol-big')).trim();
  const D = await player('Dan', '/schach/#' + code2, 'en');
  let da = true; try { await D.waitForSelector('#board .cell', { timeout: 12000 }); } catch (e) { da = false; }
  ok(da, 'Schach: Dan (Englisch) ist per Link direkt im Spiel');
  await stop();
})().catch(e => { console.error(e); process.exit(1); });
