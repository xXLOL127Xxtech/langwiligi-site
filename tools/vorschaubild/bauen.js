// Baut das Vorschaubild für geteilte Links (WhatsApp, Discord, ...): startseite/vorschau.jpg (1200 × 630)
// Aufruf: node tools/vorschaubild/bauen.js   (braucht Playwright mit Chromium)
// Aussehen: tools/vorschaubild/vorlage.html. Die Cover kommen aus games/<spiel>/cover.*
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const GAMES = path.join(ROOT, 'games');
const OUT = path.join(ROOT, 'startseite/vorschau.jpg');

// Diese Spiele stehen vorne (gut erkennbar, bunt); danach kommen die übrigen
const FAVORITEN = ['turbo-kart', 'sternen-party', 'billard-duell', 'schach', 'golf-tour', 'bubble-duell', 'kopf-voraus',
  'laser-duell', 'panzer-taktik', 'nebelvilla', 'sbb-runner', 'vier-gewinnt', 'katapult-krieg', 'weltenbrand', 'hextris', 'bogen-duell'];

const slugs = fs.readdirSync(GAMES).filter(s => !s.startsWith('_') && fs.existsSync(path.join(GAMES, s, 'index.html')));
const cover = s => ['webp', 'png', 'jpg', 'jpeg', 'svg'].map(e => path.join(GAMES, s, 'cover.' + e)).find(f => fs.existsSync(f));
const order = [...FAVORITEN.filter(s => slugs.includes(s)), ...slugs.filter(s => !FAVORITEN.includes(s))].filter(cover);
const count = slugs.length;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(__dirname, 'vorlage.html')).href, { waitUntil: 'networkidle' });
  await page.evaluate(({ srcs, count }) => {
    // Gerundet auf Zehner ("40+"), damit das Bild nicht bei jedem neuen Spiel veraltet
    const n = count >= 20 ? Math.floor(count / 10) * 10 + '+' : String(count);
    document.querySelector('.chips b').textContent = n;
    const items = [n + ' Spiele', '1 gegen 1', 'Lokal · Online · Bots', 'Kein Download', 'Kein Login', 'Keine Langeweile'];
    document.querySelector('.ticker').innerHTML = items.concat(items).map(t => '<span>' + t + '</span>').join('');
    // Cover-Wand: 4 Spalten zu 5 Bildern, Favoriten in die Mitte der sichtbaren Spalten
    const wall = document.getElementById('wall');
    const cols = [[], [], [], []];
    const slots = [1, 2, 0, 3];
    srcs.slice(0, 20).forEach((src, i) => cols[slots[i % 4]].push(src));
    cols.forEach((list, c) => {
      const col = document.createElement('div');
      col.className = 'col';
      list.forEach((src, r) => {
        const img = document.createElement('img');
        img.src = src;
        if (c === 1 && r === 2) img.className = 'hi';
        if (c === 2 && r === 1) img.className = 'hi2';
        col.appendChild(img);
      });
      wall.appendChild(col);
    });
    return Promise.all([...document.images].map(i => i.decode().catch(() => {}))).then(() => document.fonts.ready);
  }, { srcs: order.map(s => pathToFileURL(cover(s)).href), count });
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 84 });
  await browser.close();
  console.log('Vorschaubild gebaut: ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
