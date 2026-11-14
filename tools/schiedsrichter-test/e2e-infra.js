// Gemeinsame Hilfe für die Ende-zu-Ende-Tests: lokaler Hub + kleine Webseite auf Port 80 + Chromium ohne System-Proxy.
// Aufruf (als root, weil Port 80 gebraucht wird):  NODE_PATH=<ordner mit ws> node tools/schiedsrichter-test/e2e-fuenf-gewinnt.js
// WICHTIG: --no-proxy-server, sonst geht Chromium über den System-Proxy auf die ECHTE Seite langwiligi.site.
// Braucht playwright (global installiert) und Chromium. Die Seite läuft unter http://langwiligi.site (per host-resolver auf 127.0.0.1).
'use strict';
const http = require('http'), net = require('net'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..', '..'), games = path.join(root, 'games');
const tmp = require('os').tmpdir() + '/e2e-' + process.pid; fs.mkdirSync(tmp, { recursive: true });
const hub = spawn('node', [path.join(root, 'server', 'game-hub.js')], { env: Object.assign({}, process.env, { DATA_DIR: tmp, GAMES_DIR: games }), stdio: 'inherit' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
const web = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (process.env.E2E_LOG) console.log('HTTP', req.method, req.headers.host, req.url);
  if (u.pathname.startsWith('/api/')) {
    const p = http.request({ host: '127.0.0.1', port: 8090, path: req.url, method: req.method, headers: Object.assign({}, req.headers, { 'x-real-ip': '10.0.0.' + (1 + Math.floor(Math.random() * 200)) }) }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    return req.pipe(p);
  }
  let f = path.join(games, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(games) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let ipN = 0;
web.on('upgrade', (req, sock, head) => {
  if (process.env.E2E_LOG) console.log('UPGRADE', req.headers.host, req.url, req.headers.origin);
  const up = net.connect(8090, '127.0.0.1', () => {
    up.write(req.method + ' ' + req.url + ' HTTP/1.1\r\n' + Object.entries(Object.assign({}, req.headers, { 'x-real-ip': '10.1.0.' + (++ipN) })).map(([k, v]) => k + ': ' + v).join('\r\n') + '\r\n\r\n');
    up.write(head); sock.pipe(up); up.pipe(sock);
  });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
async function start() {
  await new Promise(r => web.listen(80, r)); await sleep(800);
  const { chromium } = require('playwright');
  const br = await chromium.launch({ args: ['--no-proxy-server', '--host-resolver-rules=MAP langwiligi.site 127.0.0.1, MAP *.langwiligi.site 127.0.0.1, EXCLUDE 127.0.0.1'] });
  // Neuer Spieler: eigener Browser-Speicher (= eigenes Konto), WebSocket wird an den lokalen Hub weitergereicht
  const player = async (name, url, lang) => {
    const ctx = await br.newContext(), page = await ctx.newPage();
    if ((lang || process.env.E2E_LANG) === 'en') await page.addInitScript(() => { try { localStorage.setItem('lw-lang', 'en'); } catch (e) {} });   // Test mit englischer Seite
    await page.routeWebSocket(/\/ws$/, route => {
      const WS = require('ws'), up = new WS('ws://127.0.0.1:8090/ws', { headers: { Origin: 'http://langwiligi.site', 'X-Real-IP': '10.2.0.' + (++ipN) } });
      const queue = []; let open = false;
      up.on('open', () => { open = true; queue.forEach(m => up.send(m)); });
      up.on('message', (d, bin) => route.send(bin ? d : d.toString()));
      up.on('close', (c) => route.close({ code: c && c >= 1000 && c < 5000 && c !== 1005 && c !== 1006 ? c : 1000 }));
      route.onMessage(m => { if (open) up.send(m); else queue.push(m); });
      route.onClose(() => up.close());
    });
    page.on('console', m => { if (m.type() === 'error' || process.env.E2E_LOG) console.log('Konsole (' + name + '):', m.text()); });
    page.on('pageerror', e => console.log('Seitenfehler (' + name + '):', e.message));
    await page.goto('http://langwiligi.site' + url);
    return page;
  };
  const leaderboard = async game => (await (await fetch('http://127.0.0.1:80/api/leaderboard?game=' + game)).json()).rows;
  const stop = async () => { await br.close(); hub.kill(); web.close(); console.log(fail ? 'FEHLER' : 'ALLES OK'); process.exit(fail ? 1 : 0); };
  return { player, leaderboard, stop, sleep, ok };
}
module.exports = { start, sleep, ok };
