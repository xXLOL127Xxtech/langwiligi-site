// Prüft die Server-Würfel (Backgammon, Ur) über den echten Server mit zwei WebSocket-Spielern.
// Aufruf:  NODE_PATH=<Ordner mit ws> node tools/schiedsrichter-test/wuerfel-test.js
'use strict';
const WebSocket = require('ws'), { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'wuerfel-'));
for (const g of ['backgammon', 'koenigliches-ur']) { fs.mkdirSync(R + '/g/' + g, { recursive: true }); fs.writeFileSync(R + '/g/' + g + '/index.html', '<title>T</title>'); }
const srv = spawn('node', [path.join(__dirname, '..', '..', 'server', 'game-hub.js')], { env: Object.assign({}, process.env, { DATA_DIR: R + '/data', GAMES_DIR: R + '/g' }), stdio: 'inherit' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
const O = 'http://46.224.94.231', sec = n => 'abcdefghijklmnop' + n;
const cli = () => new Promise(res => { const ws = new WebSocket('ws://127.0.0.1:8090/ws', { headers: { Origin: O } }); ws.msgs = []; ws.on('message', d => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const S = (w, o) => w.send(JSON.stringify(o));
async function room(game) {
  const a = await cli(), b = await cli();
  S(a, { t: 'create', game, name: 'Anna' + game.length, max: 2, secret: sec(game.length + '1') }); await sleep(150);
  const code = a.msgs.find(m => m.t === 'joined').code;
  S(b, { t: 'join', game, code, name: 'Bob' + game.length, secret: sec(game.length + '2') }); await sleep(150);
  return [a, b];
}
(async () => {
  await sleep(800);
  for (const [game, n] of [['backgammon', 2], ['koenigliches-ur', 4]]) {
    const [a, b] = await room(game);
    S(a, { t: 'relay', d: { t: 'start', dice: 'server' } }); S(a, { t: 'round-start' }); await sleep(150);
    b.msgs.length = 0; a.msgs.length = 0;
    S(b, { t: 'dice' }); await sleep(150);
    ok(!a.msgs.some(m => m.t === 'dice') && !b.msgs.some(m => m.t === 'dice'), game + ': Spieler ohne Zug darf nicht würfeln');
    S(a, { t: 'dice' }); await sleep(150);
    const da = a.msgs.find(m => m.t === 'dice'), db = b.msgs.find(m => m.t === 'dice');
    ok(da && db && JSON.stringify(da.d) === JSON.stringify(db.d) && da.d.length === n && da.from === 0, game + ': beide bekommen denselben Wurf ' + JSON.stringify(da && da.d));
    ok(da && da.d.every(x => game === 'backgammon' ? x >= 1 && x <= 6 : x === 0 || x === 1), game + ': Werte im erlaubten Bereich');
    // selbst gemeldeter Wurf wird nicht mehr akzeptiert
    b.msgs.length = 0; S(a, { t: 'relay', d: { t: 'roll', d: n === 2 ? [6, 6] : [1, 1, 1, 1] } }); await sleep(150);
    ok(!b.msgs.some(m => m.t === 'relay' && m.d.t === 'roll'), game + ': selbst gemeldeter Wurf wird nicht weitergeleitet');
    // alte Seite (ohne Server-Würfel) darf weiter selbst melden
    const [c, d] = await room(game);
    S(c, { t: 'relay', d: { t: 'start' } }); S(c, { t: 'round-start' }); await sleep(150);
    d.msgs.length = 0; S(c, { t: 'relay', d: { t: 'roll', d: n === 2 ? [3, 4] : [1, 0, 1, 0] } }); await sleep(150);
    ok(d.msgs.some(m => m.t === 'relay' && m.d.t === 'roll'), game + ': alte Seite ohne Server-Würfel funktioniert weiter');
    S(c, { t: 'dice' }); await sleep(150);
    ok(!c.msgs.some(m => m.t === 'dice'), game + ': ohne Server-Würfel-Start würfelt der Server nicht');
  }
  srv.kill(); console.log(fail ? 'FEHLER' : 'ALLES OK'); process.exit(fail ? 1 : 0);
})();
