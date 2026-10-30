// Baut das Bild der Chill-Lounge für die Startseite: startseite/lounge.png (320 × 200, Pixel-Art, wird mit image-rendering: pixelated vergrössert)
// Aufruf: node tools/lounge-bild/bauen.js   (braucht Playwright mit Chromium)
// Aussehen: tools/lounge-bild/vorlage.html
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'startseite/lounge.png');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(__dirname, 'vorlage.html')).href);
  await page.waitForFunction(() => document.title === 'fertig');
  const url = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  await browser.close();
  console.log('geschrieben:', path.relative(ROOT, OUT), fs.statSync(OUT).size, 'Bytes');
})();
