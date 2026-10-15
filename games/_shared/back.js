// Wird von deploy.sh in jedes Spiel eingebunden:
//  - "Alle Spiele"-Knopf am linken Rand (zurück zur Startseite)
//  - zählt den Aufruf (für "Trendet" auf der Startseite)
//  - fragt nach der ersten Runde einmal nach einer Bewertung (1–5 Sterne)
// Spiele können das Rundenende selbst melden: if (window.LW) LW.rundeFertig();
(function () {
  if (document.getElementById('lw-back')) return;

  var HOME = 'langwiligi.site';
  var ONLINE = location.protocol === 'https:' && (location.hostname === HOME || location.hostname.slice(-HOME.length - 1) === '.' + HOME);
  var API = ONLINE ? '/api' : 'https://' + HOME + '/api';
  var parts = location.pathname.replace(/index\.html?$/, '').split('/').filter(Boolean);
  var GAME = (parts[parts.length - 1] || '').toLowerCase();

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function post(path, data) {
    if (!ONLINE) return Promise.reject(new Error('lokal'));
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data) });
  }

  var css = document.createElement('style');
  css.textContent =
    '#lw-back{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147483000;display:flex;align-items:center;gap:6px;' +
    'height:40px;padding:0 14px 0 9px;background:rgba(8,7,16,.86);border:1px solid rgba(34,228,255,.55);border-left:0;' +
    'clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);' +
    'color:#ecebf5;font:700 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;' +
    'white-space:nowrap;text-decoration:none;opacity:.92;transition:opacity .2s,background .2s,padding .2s;-webkit-tap-highlight-color:transparent}' +
    '#lw-back:hover,#lw-back:focus-visible{opacity:1;background:rgba(8,7,16,.97);padding-left:13px;outline:none}' +
    '#lw-back svg{width:18px;height:18px;flex:none;color:#22e4ff}' +
    '#lw-back span{display:inline-block;max-width:110px;overflow:hidden;transition:max-width .3s}' +
    // Kleine Bildschirme: Text nur kurz nach dem Laden und beim Drüberfahren, sonst nur der Pfeil (verdeckt sonst Spiel-Knöpfe)
    '@media (max-width:1099px),(max-height:649px){#lw-back:not(.lw-intro):not(:hover):not(:focus-visible){gap:0;padding-right:10px}' +
    '#lw-back:not(.lw-intro):not(:hover):not(:focus-visible) span{max-width:0}}' +
    // Bewertung
    '#lw-rate{position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(300px,calc(100vw - 32px));padding:14px 16px 12px;' +
    'background:rgba(8,7,16,.95);border:1px solid rgba(255,46,136,.6);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 18px 40px -12px rgba(255,46,136,.45);' +
    'clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));color:#ecebf5;' +
    'font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;transform:translateY(20px);opacity:0;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .35s}' +
    '#lw-rate.lw-in{transform:none;opacity:1}' +
    '#lw-rate .lw-k{font:700 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.18em;color:#ff2e88;text-transform:uppercase}' +
    '#lw-rate .lw-q{margin:6px 0 8px;font-weight:700}' +
    '#lw-rate .lw-s{display:flex;gap:2px}' +
    '#lw-rate .lw-s button{all:unset;cursor:pointer;font-size:30px;line-height:1;padding:0 2px;color:rgba(236,235,245,.22);transition:color .12s,transform .12s}' +
    '#lw-rate .lw-s button.lw-on{color:#ffe14d;text-shadow:0 0 12px rgba(255,225,77,.55)}' +
    '#lw-rate .lw-s button:focus-visible{outline:1px solid #22e4ff}' +
    '#lw-rate .lw-s button:active{transform:scale(.88)}' +
    '#lw-rate .lw-x{all:unset;position:absolute;top:8px;right:18px;cursor:pointer;color:#8e89a8;font-size:12px;letter-spacing:.06em}' +
    '#lw-rate .lw-x:hover{color:#ecebf5}' +
    '#lw-rate .lw-m{margin-top:6px;min-height:1.2em;color:#8e89a8;font-size:12.5px}';

  var a = document.createElement('a');
  a.id = 'lw-back';
  a.className = 'lw-intro';
  setTimeout(function () { a.className = ''; }, 4000);
  a.href = '../';
  a.title = 'Zurück zur Übersicht mit allen Spielen';
  a.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" stroke-linejoin="miter">' +
    '<path d="M16 10H5m4-4-4 4 4 4"/></svg><span>Alle Spiele</span>';
  // Klicks nicht ans Spiel weitergeben (z.B. Maus fangen bei Bogen-Duell)
  function stop(el) {
    ['mousedown', 'pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
      el.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
  }
  stop(a);

  // ---------- Bewertung ----------
  var rated = load('lw-rated', {});
  var startedAt = Date.now(), asked = false, box = null;

  function stars(n) {
    box.querySelectorAll('.lw-s button').forEach(function (b, i) { b.classList.toggle('lw-on', i < n); });
  }
  function close() {
    if (!box) return;
    box.classList.remove('lw-in');
    var b = box; box = null;
    setTimeout(function () { b.remove(); }, 400);
  }
  function ask() {
    if (asked || !GAME || rated[GAME]) return;
    asked = true;
    box = document.createElement('div');
    box.id = 'lw-rate';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Spiel bewerten');
    var name = String(document.title || 'dieses Spiel').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    box.innerHTML = '<div class="lw-k">// Bewertung</div><button class="lw-x" type="button">Später ✕</button>' +
      '<div class="lw-q">Wie gefällt dir ' + name + '?</div><div class="lw-s">' +
      [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" aria-label="' + n + ' Stern' + (n > 1 ? 'e' : '') + '">★</button>'; }).join('') +
      '</div><div class="lw-m" role="status"></div>';
    stop(box);
    box.querySelector('.lw-x').addEventListener('click', close);
    var btns = box.querySelectorAll('.lw-s button'), msg = box.querySelector('.lw-m'), busy = false;
    btns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { if (!busy) stars(i + 1); });
      b.addEventListener('click', function () {
        if (busy) return;
        busy = true; stars(i + 1); msg.textContent = 'Wird gespeichert …';
        var cid = load('lw-cid', '');
        if (!/^[a-z0-9]{8,64}$/.test(cid)) { cid = ''; for (var k = 0; k < 24; k++) cid += Math.floor(Math.random() * 36).toString(36); save('lw-cid', cid); }
        post('/bewertung', { game: GAME, stars: i + 1, cid: cid }).then(function (r) {
          if (r.status === 429) throw new Error('fast');
          if (!r.ok && r.status !== 409) throw new Error('http');
          rated[GAME] = i + 1; save('lw-rated', rated);
          msg.textContent = 'Danke! ' + (i + 1) + ' von 5 Sternen.';
          setTimeout(close, 1600);
        }).catch(function (e) {
          busy = false;
          msg.textContent = e.message === 'lokal' ? 'Nur auf langwiligi.site möglich.' :
            e.message === 'fast' ? 'Gerade zu viele Bewertungen, bitte später nochmal.' : 'Hat nicht geklappt. Später nochmal versuchen.';
        });
      });
    });
    box.querySelector('.lw-s').addEventListener('mouseleave', function () { if (!busy) stars(0); });
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add('lw-in'); }); });
  }
  // Nach dem Rundenende kurz warten, damit das Ergebnis zuerst zu sehen ist
  var pending = false;
  function roundDone() {
    if (asked || pending || rated[GAME]) return;
    pending = true;
    setTimeout(ask, Math.max(1800, startedAt + 15000 - Date.now()));
  }
  window.LW = { rundeFertig: roundDone, roundEnd: roundDone };

  // Rundenende erkennen, ohne dass jedes Spiel etwas einbauen muss:
  // 1. Ranglisten-Meldungen über GameHub, 2. ein "Nochmal"/"Revanche"-Knopf oder eine Sieg-Meldung erscheint,
  // 3. Notlösung: nach 4 Minuten Spielzeit
  if (window.GameHub) {
    var hub = window.GameHub, submit = hub.submitScore, connect = hub.connect;
    if (submit) hub.submitScore = function () { roundDone(); return submit.apply(hub, arguments); };
    if (connect) hub.connect = function () {
      var room = connect.apply(hub, arguments), result = room.result;
      room.result = function () { roundDone(); return result.apply(room, arguments); };
      return room;
    };
  }
  var END_BTN = /^\W*(nochmal|revanche|nochmals)\b/i;
  var END_TXT = /(gewinnt|gewonnen|verloren|unentschieden|game over|schachmatt|sieger)/i;
  function visible(el) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
    for (var p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).opacity === '0') return false;
    return true;
  }
  function scan() {
    var found = [];
    document.querySelectorAll('button, h1, h2, h3, [role="status"]').forEach(function (el) {
      if (el.closest('#lw-rate')) return;
      var t = (el.textContent || '').trim().slice(0, 60);
      if ((el.tagName === 'BUTTON' ? END_BTN : END_TXT).test(t) && visible(el)) found.push(el.tagName + t);
    });
    return found;
  }
  var baseline = null, scanTimer = null, played = 0, lastTick = Date.now();
  function check() {
    scanTimer = null;
    if (asked || rated[GAME]) return;
    var now = scan();
    if (now.some(function (k) { return baseline.indexOf(k) < 0; })) roundDone();
  }
  function startWatching() {
    baseline = scan();
    new MutationObserver(function () { if (!scanTimer && !asked) scanTimer = setTimeout(check, 700); })
      .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'], characterData: true });
    setInterval(function () {
      var t = Date.now();
      if (!document.hidden) played += t - lastTick;
      lastTick = t;
      if (played > 4 * 60000) roundDone();
    }, 5000);
  }

  function add() {
    document.head.appendChild(css);
    document.body.appendChild(a);
    if (!GAME) return;
    post('/aufruf', { game: GAME }).catch(function () {});
    if (!rated[GAME]) setTimeout(startWatching, 1500);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
