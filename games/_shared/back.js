// Wird von deploy.sh in jedes Spiel eingebunden:
//  - "Alle Spiele"-Knopf am linken Rand (zurück zur Startseite)
//  - zählt den Aufruf (für "Trendet" auf der Startseite)
//  - fragt am Ende einer Runde nach einer Bewertung (1–5 Sterne + Verbesserungsvorschlag), nach Änderungen am Spiel erneut
// Spiele können das Rundenende selbst melden: if (window.LW) LW.rundeFertig();
(function () {
  if (document.getElementById('lw-back')) return;

  var HOME = 'langwiligi.site';
  // Solange langwiligi.site gesperrt ist, läuft die Seite direkt über die IP des Servers (ohne HTTPS)
  var IP = '46.224.94.231';
  var ONLINE = /^https?:$/.test(location.protocol) && (location.hostname === IP || location.hostname === HOME || location.hostname.slice(-HOME.length - 1) === '.' + HOME);
  var API = ONLINE ? '/api' : 'http://' + IP + '/api';
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
    '#lw-rate .lw-m{margin-top:6px;min-height:1.2em;color:#8e89a8;font-size:12.5px}' +
    '#lw-rate .lw-f{margin:10px 0 0;display:flex;flex-direction:column;gap:6px}#lw-rate .lw-f[hidden]{display:none}' +
    '#lw-rate .lw-f label{font-size:13px;font-weight:700}#lw-rate .lw-f small{font-weight:400;color:#8e89a8}' +
    '#lw-rate textarea{box-sizing:border-box;width:100%;resize:vertical;min-height:58px;font:14px/1.4 system-ui,sans-serif;color:#ecebf5;' +
    'background:#07060d;border:1px solid #3d3660;padding:7px 9px;outline:none;user-select:text;-webkit-user-select:text}' +
    '#lw-rate textarea:focus{border-color:#22e4ff}' +
    '#lw-rate .lw-row{display:flex;justify-content:flex-end;gap:8px}' +
    '#lw-rate .lw-row button{all:unset;cursor:pointer;font:700 12px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;border:1px solid #3d3660}' +
    '#lw-rate .lw-row .lw-go{background:#ff2e88;border-color:#ff2e88;color:#07060d}' +
    '#lw-rate .lw-row button:focus-visible{outline:1px solid #22e4ff}' +
    '#lw-rate,#lw-rate *{pointer-events:auto}';

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
  // Gefragt wird nur am Ende einer Runde (Sieg, Niederlage, Game Over), nie mitten im Spiel.
  // deploy.sh schreibt die Version des Spiels (Datum der letzten Änderung) in data-v. Wurde das Spiel
  // seit der letzten Bewertung geändert, fragen wir nochmal. Der Server ersetzt dann die alte Bewertung dieses Geräts.
  var me = document.currentScript || document.querySelector('script[src*="_shared/back.js"]');
  var VERSION = (me && me.getAttribute('data-v')) || '';
  var rated = load('lw-rated', {});
  function ratedNow() {
    var r = rated[GAME];
    // Alte Einträge (nur Sternzahl, ohne Version) zählen als "ältere Version": einmal neu fragen
    return !!r && (!VERSION || (typeof r === 'object' && r.v === VERSION));
  }
  function oldRating() { var r = rated[GAME]; return r ? (typeof r === 'number' ? r : r.s) : 0; }
  var startedAt = Date.now(), asked = false, tries = 0, box = null, shownAt = 0, endMark = null;

  function stars(n) {
    if (!box) return;
    box.querySelectorAll('.lw-s button').forEach(function (b, i) { b.classList.toggle('lw-on', i < n); });
  }
  function close() {
    if (!box) return;
    box.classList.remove('lw-in');
    var b = box; box = null;
    setTimeout(function () { b.remove(); }, 400);
  }
  function cid() {
    var c = load('lw-cid', '');
    if (!/^[a-z0-9]{8,64}$/.test(c)) { c = ''; for (var k = 0; k < 24; k++) c += Math.floor(Math.random() * 36).toString(36); save('lw-cid', c); }
    return c;
  }
  // Fetch mit Zeitlimit, sonst bleibt der Kasten bei schlechtem Netz für immer "beschäftigt"
  function send(data) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    if (!ONLINE) { clearTimeout(t); return Promise.reject(new Error('lokal')); }
    return fetch(API + '/bewertung', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data), signal: ctrl && ctrl.signal })
      .then(function (r) {
        clearTimeout(t);
        if (r.status === 429) throw new Error('fast');
        if (!r.ok && r.status !== 409) throw new Error('http');
        return r;
      }, function (e) { clearTimeout(t); throw e; });
  }
  function errText(e) {
    return e.message === 'lokal' ? 'Nur auf langwiligi.site möglich.' :
      e.message === 'fast' ? 'Gerade zu viele Bewertungen, bitte später nochmal.' : 'Hat nicht geklappt. Bitte nochmal tippen.';
  }
  // Wo hängen wir den Kasten ein? Im Vollbild oder bei einem offenen modalen Dialog wäre er sonst unsichtbar bzw. nicht klickbar.
  function host() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && fs.tagName !== 'CANVAS' && fs.tagName !== 'VIDEO') return fs;
    var dlg = null;
    try { dlg = document.querySelector('dialog[open]:modal'); } catch (e) {}
    return dlg || document.body;
  }
  function onTap(el, fn) {
    // click UND pointerup: manche Spiele fangen Klicks auf dem ganzen Fenster ab
    var last = 0;
    function go(e) { var t = Date.now(); if (t - last < 400) return; last = t; e.preventDefault(); fn(e); }
    el.addEventListener('click', go);
    el.addEventListener('pointerup', function (e) { if (e.button === 0) go(e); });
  }
  function ask() {
    if (box || asked || !GAME || ratedNow()) return;
    tries++;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    box = document.createElement('div');
    box.id = 'lw-rate';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Spiel bewerten');
    // deploy.sh schreibt den kurzen Namen in data-name und hängt für Google Suchbegriffe an den Titel
    var name = String((me && me.getAttribute('data-name')) || document.title.replace(/( \([^)]*\))? – [^|]*\| KEI Langwiligi site$/, '') || 'dieses Spiel').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    var again = oldRating() > 0;
    box.innerHTML = '<div class="lw-k">// Bewertung</div><button class="lw-x" type="button">Später ✕</button>' +
      '<div class="lw-q">' + (again ? 'Wir haben an ' + name + ' gearbeitet. Wie gefällt es dir jetzt?' : 'Wie gefällt dir ' + name + '?') + '</div><div class="lw-s">' +
      [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" aria-label="' + n + ' Stern' + (n > 1 ? 'e' : '') + '">★</button>'; }).join('') +
      '</div><form class="lw-f" hidden><label for="lw-note">Was soll verbessert werden? <small>(optional)</small></label>' +
      '<textarea id="lw-note" rows="3" maxlength="500" placeholder="z.B. zu schwer, Fehler, Idee …"></textarea>' +
      '<div class="lw-row"><button type="button" class="lw-skip">Fertig</button><button type="submit" class="lw-go">Senden</button></div></form>' +
      '<div class="lw-m" role="status"></div>';
    stop(box);
    ['keyup', 'keypress', 'wheel', 'click', 'mouseup', 'pointerup'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    onTap(box.querySelector('.lw-x'), function () { asked = true; close(); });
    var btns = box.querySelectorAll('.lw-s button'), msg = box.querySelector('.lw-m'), form = box.querySelector('.lw-f');
    var note = form.querySelector('textarea'), chosen = 0, busy = false;
    btns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { if (!busy) stars(i + 1); });
      onTap(b, function () {
        if (busy) return;
        busy = true; chosen = i + 1; stars(chosen); msg.textContent = 'Wird gespeichert …';
        send({ game: GAME, stars: chosen, cid: cid(), v: VERSION }).then(function () {
          busy = false;
          rated[GAME] = { s: chosen, v: VERSION }; save('lw-rated', rated);
          msg.textContent = 'Danke! ' + chosen + ' von 5 Sternen.';
          form.hidden = false;
          note.focus();
        }).catch(function (e) { busy = false; msg.textContent = errText(e); });
      });
    });
    box.querySelector('.lw-s').addEventListener('mouseleave', function () { if (!busy) stars(chosen); });
    onTap(form.querySelector('.lw-skip'), function () { asked = true; close(); });
    function submit() {
      var text = note.value.trim();
      if (!text) { asked = true; return close(); }
      if (busy) return;
      busy = true; msg.textContent = 'Wird gesendet …';
      send({ game: GAME, stars: chosen, cid: cid(), v: VERSION, note: text }).then(function () {
        asked = true;
        form.hidden = true;
        msg.textContent = 'Danke für dein Feedback!';
        setTimeout(close, 1600);
      }).catch(function (e) { busy = false; msg.textContent = errText(e); });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    onTap(form.querySelector('.lw-go'), submit);
    host().appendChild(box);
    shownAt = Date.now();
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add('lw-in'); }); });
  }

  // Rundenende: kurz warten, damit das Ergebnis zuerst zu sehen ist. Startet in der Zwischenzeit schon
  // die nächste Runde (Ende-Knopf wieder weg), warten wir aufs nächste Rundenende.
  var pending = null;
  function roundDone(mark) {
    if (box || asked || pending || ratedNow() || tries >= 3) return;
    endMark = mark || null;
    pending = setTimeout(function () {
      pending = null;
      if (endMark && !stillThere(endMark)) return;
      ask();
    }, Math.max(1500, startedAt + 15000 - Date.now()));
  }
  window.LW = { rundeFertig: function () { roundDone(); }, roundEnd: function () { roundDone(); } };

  // Sobald wieder gespielt wird (Taste oder Klick ausserhalb des Kastens), Kasten weg: er soll nie im Spiel stören.
  // Wer noch nicht bewertet hat, wird beim nächsten Rundenende nochmal gefragt (höchstens 3-mal pro Besuch).
  function backToGame(e) {
    if (!box || Date.now() - shownAt < 700) return;
    if (box.contains(e.target)) return;
    if (e.type === 'keydown' && (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab')) return;
    close();
  }
  addEventListener('keydown', backToGame, true);
  addEventListener('pointerdown', backToGame, true);

  // Rundenende erkennen, ohne dass jedes Spiel etwas einbauen muss:
  // 1. Ranglisten-Meldungen über GameHub, 2. ein "Nochmal"/"Revanche"-Knopf oder eine Sieg-Meldung erscheint
  if (window.GameHub) {
    var hub = window.GameHub, submit = hub.submitScore, connect = hub.connect;
    if (submit) hub.submitScore = function () { roundDone(); return submit.apply(hub, arguments); };
    if (connect) hub.connect = function () {
      var room = connect.apply(hub, arguments), result = room.result;
      room.result = function () { roundDone(); return result.apply(room, arguments); };
      return room;
    };
  }
  var END_BTN = /^\W*(nochmal|revanche|nochmals|neues spiel|weiterspielen)\b/i;
  var END_TXT = /(gewinnt!|gewonnen|verloren|unentschieden|game over|schachmatt|sieger|du hast)/i;
  // Nur sichtbare Knöpfe/Meldungen zählen. checkVisibility prüft auch Eltern mit opacity 0.
  function visible(el) {
    if (!el.isConnected) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
    for (var p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).opacity === '0') return false;
    return true;
  }
  function stillThere(list) { return list.some(function (el) { return visible(el); }); }
  function scan() {
    var found = [];
    var els = document.querySelectorAll('button, h1, h2, h3, [role="status"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], t = (el.textContent || '').trim().slice(0, 60);
      // zuerst nur Text prüfen (billig), Sichtbarkeit nur bei Treffern
      if ((el.tagName === 'BUTTON' ? END_BTN : END_TXT).test(t) && !el.closest('#lw-rate') && visible(el)) found.push(el);
    }
    return found;
  }
  // Läuft nur, wenn der Browser zwischen zwei Bildern nichts zu tun hat. So stört das Nachschauen das Spiel nicht
  // (früher: bei jeder DOM-Änderung, das erzwang mitten im Spiel Layout-Berechnungen und liess das Bild zucken).
  var idle = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 2000 }); } : function (f) { setTimeout(f, 0); };
  var seen = [], poll = null, busyScan = false;
  function check() {
    busyScan = false;
    if (asked || ratedNow() || tries >= 3) { clearInterval(poll); return; }
    var now = scan(), fresh = now.filter(function (el) { return seen.indexOf(el) < 0; });
    // Ende-Anzeige wieder verschwunden: nächstes Mal zählt sie wieder als neu
    seen = now;
    if (fresh.length && !box) roundDone(fresh);
  }
  function startWatching() {
    seen = scan();
    poll = setInterval(function () {
      if (!document.hidden && !busyScan) { busyScan = true; idle(check); }
    }, 1500);
  }

  // Spielzeit: zählt nur Sekunden, in denen der Tab sichtbar ist, und meldet sie beim Verlassen oder Wegwechseln (nur eine Zahl, keine Cookies)
  function startTimer() {
    var sek = 0, since = document.hidden ? 0 : Date.now();
    function stop() { if (since) { sek += (Date.now() - since) / 1000; since = 0; } }
    function send() {
      stop();
      var s = Math.round(sek); sek = 0;
      if (s < 5 || !ONLINE) return;
      var body = JSON.stringify({ game: GAME, sek: Math.min(s, 14400) });
      try { if (navigator.sendBeacon && navigator.sendBeacon(API + '/spielzeit', body)) return; } catch (e) {}
      try { fetch(API + '/spielzeit', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }); } catch (e) {}
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) send(); else since = Date.now(); });
    addEventListener('pagehide', send);
  }

  function add() {
    document.head.appendChild(css);
    document.body.appendChild(a);
    if (!GAME) return;
    post('/aufruf', { game: GAME }).catch(function () {});
    startTimer();
    if (!ratedNow()) setTimeout(startWatching, 1500);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
