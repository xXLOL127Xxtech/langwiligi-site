// Wie spiele-crawl.js, klickt aber zusätzlich bis zu 4 Mal auf einen Start-/Bot-/Solo-Knopf, damit auch Texte aus dem laufenden Spiel erscheinen.
// Aufruf: NODE_PATH=$(npm root -g) node tools/i18n/spiele-crawl-ingame.js [Build-Ordner] [Screenshot-Ordner]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const build = process.argv[2] || '/tmp/i18n-seite/build', out = process.argv[3] || '/tmp/i18n-crawl-ingame';
fs.mkdirSync(out, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const srv = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); if (u.pathname.startsWith('/api/')) { r.writeHead(404); return r.end(); }
  let f = path.join(build, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(build) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const games = fs.readdirSync(build).filter(n => !n.startsWith('_') && fs.existsSync(path.join(build, n, 'index.html')) && fs.existsSync(path.join(__dirname, '..', '..', 'games', n)));
const START = /bot|solo|play|start|alone|campaign|new game|local|same|continue|ok|go\b|begin|easy|medium/i;
srv.listen(8127, async () => {
  const { chromium } = require('playwright'), br = await chromium.launch({ args: ['--no-proxy-server'] });
  let bad = 0;
  for (const g of games) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } }), p = await ctx.newPage(), errs = [];
    await p.addInitScript(() => { localStorage.setItem('lw-lang', 'en'); localStorage.setItem('lw-i18n-debug', '1'); });
    p.on('pageerror', e => errs.push(e.message));
    try {
      await p.goto('http://127.0.0.1:8127/' + g + '/', { timeout: 15000 }); await p.waitForTimeout(1200);
      for (let i = 0; i < 4; i++) {
        const b = p.locator('button:visible, [role=button]:visible, .btn:visible, a.btn:visible').filter({ hasText: START }).first();
        if (!(await b.count())) break;
        await b.click({ timeout: 1500, force: true }).catch(() => {}); await p.waitForTimeout(900);
      }
      await p.keyboard.press('Enter'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
    } catch (e) { errs.push('goto: ' + e.message); }
    const miss = await p.evaluate(() => window.__lwMiss ? [...window.__lwMiss] : null).catch(() => null);
    await p.screenshot({ path: out + '/' + g + '.png' }).catch(() => {});
    const flag = errs.length || (miss && miss.length); if (flag) bad++;
    console.log((flag ? '⚠️  ' : '✅ ') + g + (errs.length ? ' | FEHLER: ' + errs.slice(0, 2).join(' / ') : '') + (miss && miss.length ? ' | offen(' + miss.length + '): ' + miss.slice(0, 8).join(' • ') : ''));
    await ctx.close();
  }
  await br.close(); srv.close(); console.log(bad + ' von ' + games.length + ' mit Auffälligkeiten');
});
