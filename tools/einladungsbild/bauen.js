// Baut für jedes Spiel das Vorschaubild für Einladungslinks (WhatsApp, Discord, ...): games/_shared/einladung/<spiel-id>.jpg (1200 × 630)
// Aufruf: node tools/einladungsbild/bauen.js [spiel-id ...]   (ohne Angabe alle Spiele; braucht Playwright mit Chromium)
// Aussehen: tools/einladungsbild/vorlage.html. Cover und Name kommen aus games/<spiel>/. Nach neuen Spielen einmal ausführen und die Bilder einchecken.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const GAMES = path.join(ROOT, 'games');
const OUT = path.join(GAMES, '_shared', 'einladung');

const all = fs.readdirSync(GAMES).filter(s => !s.startsWith('_') && fs.existsSync(path.join(GAMES, s, 'index.html')));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;
const cover = s => ['webp', 'png', 'jpg', 'jpeg', 'svg'].map(e => path.join(GAMES, s, 'cover.' + e)).find(f => fs.existsSync(f));
function info(s) {
  const html = fs.readFileSync(path.join(GAMES, s, 'index.html'), 'utf8').slice(0, 8000);
  const un = t => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
  const color = (html.match(/<meta name="theme-color" content="(#[0-9a-fA-F]{3,8})"/i) || [])[1];
  return { name: un(title || s).trim(), color: color || '#22e4ff' };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(__dirname, 'vorlage.html')).href, { waitUntil: 'networkidle' });
  let n = 0;
  for (const s of slugs) {
    if (!all.includes(s)) { console.error('Kein Spiel: ' + s); continue; }
    const c = cover(s), { name, color } = info(s);
    await page.evaluate(({ src, name, color }) => {
      const url = src ? 'url("' + src + '")' : 'none';
      document.getElementById('bg').style.backgroundImage = url;
      document.getElementById('shot').style.backgroundImage = url;
      document.body.style.setProperty('--c', color);
      const h = document.getElementById('name');
      h.textContent = name;
      h.className = name.length > 18 ? 'xl' : name.length > 11 ? 'l' : '';
      const items = [name, 'Online mit Freunden', 'Kein Download', 'Kein Login', 'Keine Langeweile'];
      document.getElementById('ticker').innerHTML = items.concat(items, items).map(t => '<span>' + t + '</span>').join('');
      return Promise.all([...[new Image()].map(() => (src ? new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = src; }) : null)), document.fonts.ready]);
    }, { src: c ? pathToFileURL(c).href : '', name, color });
    await page.screenshot({ path: path.join(OUT, s + '.jpg'), type: 'jpeg', quality: 82 });
    n++;
  }
  await browser.close();
  console.log(n + ' Einladungsbilder gebaut in ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024) + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
