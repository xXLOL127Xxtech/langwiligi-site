// Prüft die Startseite im Browser: Sprachwahl nach der Intro-Animation, englische Texte, übersetzte Spielnamen. Baut zuerst mit deploy.sh --lokal.
// Aufruf:  NODE_PATH=$(npm root -g) node tools/i18n/seite-testen.js [Ordner-für-Screenshots]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..', '..'), out = process.argv[2] || require('os').tmpdir() + '/i18n-seite';
fs.mkdirSync(out, { recursive: true });
const build = out + '/build'; execSync('bash deploy.sh --lokal ' + JSON.stringify(build), { cwd: root, stdio: 'ignore' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const web = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); if (u.pathname.startsWith('/api/')) { res.writeHead(404); return res.end(); }
  let f = path.join(build, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(build) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
(async () => {
  await new Promise(r => web.listen(8123, r));
  const { chromium } = require('playwright'), br = await chromium.launch({ args: ['--no-proxy-server'] });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
  page.on('pageerror', e => console.log('Seitenfehler:', e.message));
  await page.goto('http://127.0.0.1:8123/');
  ok(!(await page.locator('#lang').evaluate(d => d.open)), 'Sprachfenster ist während der Intro-Animation noch zu');
  await page.waitForFunction(() => document.querySelector('#lang').open, null, { timeout: 8000 }); ok(true, 'Sprachfenster erscheint nach der Animation');
  await page.screenshot({ path: out + '/01-sprachwahl.png' });
  await Promise.all([page.waitForNavigation(), page.click('#lang [data-l="en"]')]); await sleep(1500);
  ok(await page.evaluate(() => localStorage.getItem('lw-lang')) === 'en', 'Wahl gespeichert (lw-lang = en)');
  ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'html lang = en');
  const txt = await page.evaluate(() => document.body.innerText);
  ok(/KEI\s+LANGWILIGI/i.test(txt), 'Hauptname «KEI LANGWILIGI site» bleibt');
  ok(/No boring site/.test(txt) && /translated from Swiss German/.test(txt), 'Übersetzung «No boring site (translated from Swiss German)» steht unter dem Namen');
  const titles = await page.$$eval('.card h2', els => els.map(e => e.textContent.trim()));
  console.log('Titel:', titles.join(' | '));
  ok(titles.includes('Five in a Row') && titles.includes('Chess') && titles.includes('Connect Four') && !titles.includes('Schach'), 'Spieltitel sind englisch');
  ok(await page.evaluate(() => document.title) === 'KEI Langwiligi site – Online games for two, free & ad-free', 'Seitentitel: ' + await page.title());
  await page.screenshot({ path: out + '/02-startseite-en.png' });
  await page.screenshot({ path: out + '/03-startseite-en-voll.png', fullPage: true });
  const open = await page.evaluate(() => (window.__lwMiss ? [...window.__lwMiss] : null)); if (open) console.log('Fehlende Texte:', open);
  // Schalter DE zurück
  await Promise.all([page.waitForNavigation(), page.click('#lang-switch [data-l="de"]')]); await sleep(1000);
  ok((await page.evaluate(() => document.documentElement.lang)).startsWith('de') && /Schach/.test(await page.textContent('body')), 'Zurück auf Deutsch über den Schalter');
  // zweiter Besuch: keine Frage mehr
  const p2 = await ctx.newPage(); await p2.goto('http://127.0.0.1:8123/'); await sleep(4500);
  ok(!(await p2.locator('#lang').evaluate(d => d.open)), 'Beim nächsten Besuch keine erneute Frage');
  await br.close(); web.close(); console.log(fail ? 'FEHLER' : 'ALLES OK'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
