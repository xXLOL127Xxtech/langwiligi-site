// Freunde, Online-Status und Einladungen. Wird von deploy.sh in jedes Spiel und in die Startseite eingebaut.
//  - Link links am Rand ("Freunde"), öffnet das Panel im Cyberpunk-Stil der Webseite (nicht im Spiel-Look)
//  - Freunde per Code hinzufügen, sehen wer online ist und was gespielt wird
//  - Wurde im Spiel ein Online-Raum erstellt, klappt das Panel auf: Einladungslink (mit Vorschaubild), Freunde und Leute aus
//    der Lobby desselben Spiels einladen
//  - Einladungen von anderen kommen als Karte oben in der Mitte an, auch auf dem Startbildschirm des Spiels
// Das Spiel muss nichts tun: Räume erkennt das Skript über GameHub.connect(). Der Server dazu steht in server/game-hub.js.
(function () {
  'use strict';
  if (window.__lwFreunde) return;
  window.__lwFreunde = true;

  var HOME = 'langwiligi.site';
  // Solange langwiligi.site gesperrt ist, läuft die Seite direkt über die IP des Servers (ohne HTTPS)
  var IP = '46.224.94.231';
  var BEI_UNS = /^https?:$/.test(location.protocol) && (location.hostname === IP || location.hostname === HOME || location.hostname.slice(-HOME.length - 1) === '.' + HOME);
  if (!BEI_UNS) return;   // lokal beim Entwickeln gibt es keinen Freunde-Dienst
  var SEITE = location.origin;
  var WS_URL = SEITE.replace(/^http/, 'ws') + '/ws';
  var parts = location.pathname.replace(/index\.html?$/, '').split('/').filter(Boolean);
  var GAME = (parts[parts.length - 1] || '').toLowerCase();   // leer = Startseite
  var ON_START = !GAME;

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || root).querySelector(sel); }

  // ---------- Zustand ----------
  var settings = { visible: true, onlyFriends: false };
  try { var st = JSON.parse(load('lw-fr-set', '{}')); if (st && typeof st === 'object') { settings.visible = st.visible !== false; settings.onlyFriends = !!st.onlyFriends; } } catch (e) {}
  function secret() {
    var s = load('lw-pid', '');
    if (!/^[A-Za-z0-9]{16,64}$/.test(s)) {
      var a = new Uint8Array(24), c = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      (window.crypto || window.msCrypto).getRandomValues(a);
      s = ''; for (var i = 0; i < a.length; i++) s += c[a[i] % c.length];
      save('lw-pid', s);
    }
    return s;
  }
  function myName() { return (load('lw-name', '') || '').trim().slice(0, 16); }
  var S = { me: null, feat: 0, connected: false, friends: [], requests: [], sent: [], lobby: [], room: null, invited: {}, open: false, autoOpened: false };
  var friendsLoaded = false;

  // ---------- Verbindung ----------
  var ws = null, retry = 0, retryTimer = null, dead = false;
  function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function connect() {
    if (dead) return;
    try { ws = new WebSocket(WS_URL); } catch (e) { return; }
    var mine = ws;
    ws.onopen = function () {
      retry = 0;
      mine.send(JSON.stringify({ t: 'hello', secret: secret(), name: myName(), game: GAME, visible: settings.visible, onlyFriends: settings.onlyFriends }));
    };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onerror = function () {};
    ws.onclose = function () {
      if (ws !== mine) return;
      S.connected = false; S.lobby = []; draw();
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, Math.min(60000, 3000 * Math.pow(2, retry++)));
    };
  }
  function onMsg(m) {
    switch (m.t) {
      case 'me':
        S.me = { code: m.code, name: m.name }; S.feat = m.feat | 0; S.connected = true;
        adoptName(m.name);
        if (S.room) wsSend({ t: 'status', room: S.room.code });
        mount();
        draw();
        break;
      case 'friends':
        S.friends = m.list || []; S.requests = m.requests || []; S.sent = m.sent || [];
        friendsLoaded = true;
        draw();
        break;
      case 'friend': {
        var f = m.f, i = S.friends.findIndex(function (x) { return x.code === f.code; });
        if (i >= 0) { S.friends[i] = f; draw(); }
        break;
      }
      case 'lobby': if (m.game === GAME) { S.lobby = m.list || []; draw(); } break;
      case 'invite': showInvite(m); break;
      case 'friend-request':
        toast({ kicker: 'Freundschaft', html: '<b>' + esc(m.name) + '</b> möchte dein Freund sein.', ttl: 60000, actions: [
          { label: 'Annehmen', cls: 'go', fn: function () { wsSend({ t: 'friend-accept', code: m.code }); } },
          { label: 'Später', fn: function () {} }] });
        pulse();
        break;
      case 'friend-new': msg('', ''); toast({ kicker: 'Freundschaft', html: 'Du und <b>' + esc(m.name) + '</b> seid jetzt Freunde.', ttl: 5000 }); break;
      case 'name-ok': adoptName(m.name); msg('Name gespeichert. Du heisst jetzt ' + m.name + '.', 'ok'); break;
      case 'name-error':
        adoptName(m.name);
        msg(m.msg === 'taken' ? 'Der Name «' + m.wanted + '» ist schon vergeben. Du bleibst ' + m.name + '.' : m.msg === 'too-fast' ? 'Bitte kurz warten.' : 'Dieser Name geht nicht. Er braucht mindestens 2 Zeichen.', 'err');
        break;
      case 'friend-sent': msg('Anfrage an ' + m.name + ' geschickt. Sobald er oder sie annimmt, seid ihr Freunde.', 'ok'); break;
      case 'friend-error': msg(FRIEND_ERR[m.msg] || 'Hat nicht geklappt.', 'err'); break;
      case 'invite-sent': S.invited[m.to] = Date.now(); setTimeout(draw, 10100); draw(); break;
      case 'invite-error': msg(INVITE_ERR[m.msg] || 'Einladung hat nicht geklappt.', 'err'); break;
    }
  }
  // Der Server ist die Quelle für den Namen (jeder Name gibt es nur einmal)
  function adoptName(n) {
    if (!n) return;
    if (myName() !== n) { save('lw-name', n); }
    lastName = n;
    var el = mounted && $('#lw-fr-name'); if (el && document.activeElement !== el) el.value = n;
    var nm = mounted && $('#lw-fr-myname'); if (nm) nm.textContent = n;
    if (mounted) draw();
  }
  var FRIEND_ERR = { self: 'Das bist du selbst.', 'not-found': 'Diesen Benutzernamen gibt es nicht. Bitte nochmal prüfen.', already: 'Ihr seid schon Freunde.',
    limit: 'Zu viele Freunde oder Anfragen.', 'too-fast': 'Bitte kurz warten und nochmal versuchen.' };
  var INVITE_ERR = { 'no-room': 'Du bist in keinem offenen Raum.', 'not-found': 'Diese Person gibt es nicht mehr.', 'too-fast': 'Du hast gerade schon eingeladen. Kurz warten.',
    offline: 'Ist gerade offline gegangen.', denied: 'Nimmt nur Einladungen von Freunden an.' };
  function status(extra) { wsSend(Object.assign({ t: 'status' }, extra)); }

  // ---------- Räume erkennen: GameHub.connect() umhüllen ----------
  // Sobald das Spiel einen Raum erstellt oder betritt, wissen wir den Code und können einladen.
  function trackRoom(api, m, created) {
    var count = function () { return (api.players || []).filter(Boolean).length; };
    var room = { api: api, code: m.code, max: m.max || Math.max(2, (m.players || []).length), count: count() };
    S.room = room;
    status({ room: m.code });
    function update() {
      if (S.room !== room) return;
      var was = room.count; room.count = count();
      if (room.count >= room.max && was < room.max && S.open && S.autoOpened) { toast({ kicker: 'Einladen', html: 'Alle sind da. Viel Spass!', ttl: 3000 }); setOpen(false); }
      status({ room: m.code });
      draw();
    }
    api.on('peer-join', update);
    api.on('peer-left', update);
    api.on('close', function () { if (S.room === room) { S.room = null; status({ room: '' }); draw(); } });
    if (created && room.count < room.max) setTimeout(function () { if (S.room === room && S.connected) { S.autoOpened = true; setOpen(true); } }, 500);
    draw();
  }
  function wrapHub() {
    var hub = window.GameHub;
    if (!hub || !hub.connect || hub.__lwFr) return !!hub;
    hub.__lwFr = true;
    var orig = hub.connect;
    hub.connect = function () {
      var api = orig.apply(hub, arguments);
      ['create', 'join', 'quick'].forEach(function (k) {
        var f = api[k];
        if (!f) return;
        api[k] = function () { return f.apply(api, arguments).then(function (m) { trackRoom(api, m, k !== 'join'); if (k === 'join') inviteDone(m.code); return m; }); };
      });
      var close = api.close;
      api.close = function () { if (S.room && S.room.api === api) { S.room = null; status({ room: '' }); draw(); } return close.apply(api, arguments); };
      return api;
    };
    return true;
  }
  if (!wrapHub()) { var tries = 0, iv = setInterval(function () { if (wrapHub() || ++tries > 40) clearInterval(iv); }, 250); }

  // ---------- Hilfen ----------
  function inviteLink() {
    var r = S.room; if (!r) return '';
    // Mit dem neuen Server gibt es eine Seite mit Vorschaubild (WhatsApp, Discord, ...), sonst den schlichten Link
    return S.feat >= 2 ? SEITE + '/api/e/' + GAME + '/' + r.code + (myName() ? '?von=' + encodeURIComponent(myName()) : '') : SEITE + '/' + GAME + '/#' + r.code;
  }
  function copy(text) {
    function fallback() {
      return new Promise(function (ok, no) {
        var t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(t); t.select();
        var done = false; try { done = document.execCommand('copy'); } catch (e) {}
        t.remove(); done ? ok() : no();
      });
    }
    return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).catch(fallback) : fallback();
  }
  function fmtCode(c) { return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }
  function go(game, code) {
    var url = new URL((ON_START ? './' : '../') + game + '/', location.href);
    url.hash = code || '';
    if (game === GAME) { location.hash = code; location.reload(); } else location.assign(url.href);
  }
  function whereIs(f) {
    if (!f.online) return 'offline';
    if (!f.game) return 'auf der Startseite';
    if (f.game === GAME && !f.inRoom) return 'in der Lobby von ' + f.gameName;
    return (f.inRoom ? 'spielt ' : 'schaut ') + f.gameName;
  }

  // ---------- Aussehen ----------
  var css = document.createElement('style');
  css.textContent =
    '#lw-fr,#lw-fr *{box-sizing:border-box}' +
    '#lw-fr{position:fixed;inset:0;z-index:2147483002;pointer-events:none;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#ecebf5}' +
    '#lw-fr button,#lw-fr input{font:inherit;color:inherit}' +
    // Knopf am Rand
    '#lw-fr-btn{pointer-events:auto;position:fixed;left:0;top:calc(50% + 26px);display:none;align-items:center;gap:7px;height:38px;padding:0 14px 0 9px;cursor:pointer;' +
    'background:rgba(8,7,16,.86);border:1px solid rgba(255,46,136,.6);border-left:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);' +
    'font:700 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;opacity:.92;transition:opacity .2s,background .2s}' +
    '#lw-fr-btn.lw-on{display:flex}#lw-fr-btn:hover,#lw-fr-btn:focus-visible{opacity:1;background:rgba(8,7,16,.97);outline:none}' +
    '#lw-fr-btn svg{width:18px;height:18px;flex:none;color:#ff2e88}' +
    '#lw-fr-btn .lw-n{min-width:18px;padding:3px 5px 2px;background:#8cff5a;color:#07060d;font:700 11px/1 ui-monospace,Consolas,monospace;text-align:center}' +
    '#lw-fr-btn .lw-n:empty{display:none}' +
    '#lw-fr-btn.lw-ping{animation:lw-frping 1.1s ease-in-out 4}@keyframes lw-frping{50%{background:rgba(255,46,136,.55)}}' +
    '#lw-fr.lw-start #lw-fr-btn{top:auto;bottom:24px}' +
    '@media (max-width:1099px),(max-height:649px){#lw-fr-btn:not(:hover):not(:focus-visible) .lw-t{display:none}#lw-fr-btn:not(:hover):not(:focus-visible){padding-right:10px}}' +
    // Panel
    '#lw-fr-panel{pointer-events:auto;position:fixed;left:0;top:0;bottom:0;width:min(360px,calc(100vw - 24px));display:flex;flex-direction:column;' +
    'background:linear-gradient(180deg,rgba(15,13,26,.985),rgba(7,6,13,.985));border-right:1px solid rgba(34,228,255,.6);' +
    'box-shadow:0 0 0 1px rgba(0,0,0,.5),12px 0 50px -10px rgba(34,228,255,.35);transform:translateX(-104%);transition:transform .32s cubic-bezier(.2,.8,.2,1);visibility:hidden}' +
    '#lw-fr-panel.lw-in{transform:none;visibility:visible}' +
    '#lw-fr-panel::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(transparent 0 2px,rgba(0,0,0,.16) 2px 3px)}' +
    '#lw-fr-panel header{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;border-bottom:1px solid #2a2540}' +
    '#lw-fr-panel header h2{margin:0;flex:1;font:700 17px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}' +
    '#lw-fr-panel header h2 i{font:700 11px/1 ui-monospace,Consolas,monospace;font-style:normal;letter-spacing:.18em;color:#ff2e88;display:block;margin-bottom:5px}' +
    '#lw-fr-x{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border:1px solid #3d3660;color:#8e89a8;font-size:15px}#lw-fr-x:hover{color:#ecebf5;border-color:#22e4ff}' +
    '#lw-fr-body{flex:1;overflow:auto;padding:4px 14px 18px;overscroll-behavior:contain}' +
    '#lw-fr-body h3{margin:18px 0 8px;font:700 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:#22e4ff;display:flex;gap:8px;align-items:center}' +
    '#lw-fr-body h3::after{content:"";flex:1;height:1px;background:#2a2540}' +
    '#lw-fr-body h3 b{color:#8cff5a;font-weight:700}' +
    '.lw-fr-m{margin:6px 0;color:#8e89a8;font-size:13px}' +
    '.lw-fr-m b{color:#ecebf5}' +
    '.lw-fr-code{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #3d3660;background:#0a0814;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}' +
    '.lw-fr-code strong{font:700 26px/1 ui-monospace,Consolas,monospace;letter-spacing:.22em;color:#ffe14d;flex:1}' +
    '.lw-fr-code.lw-small strong{font-size:17px;letter-spacing:.14em;color:#ecebf5}' +
    '.lw-fr-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '#lw-fr button.lw-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-block;padding:7px 11px;border:1px solid #3d3660;font:700 11.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;text-align:center}' +
    '#lw-fr button.lw-b:hover,#lw-fr button.lw-b:focus-visible{border-color:#22e4ff;color:#22e4ff;outline:none}' +
    '#lw-fr button.lw-b.lw-go{background:#22e4ff;border-color:#22e4ff;color:#07060d}#lw-fr button.lw-b.lw-go:hover{background:#7df0ff;color:#07060d}' +
    '#lw-fr button.lw-b.lw-pk{background:#ff2e88;border-color:#ff2e88;color:#07060d}#lw-fr button.lw-b.lw-pk:hover{background:#ff6aa9;color:#07060d}' +
    '#lw-fr button.lw-b.lw-ghost{border-color:transparent;color:#8e89a8;padding:7px 8px}' +
    '#lw-fr button.lw-b[disabled],#lw-fr button.lw-b.lw-done{opacity:.55;cursor:default;pointer-events:none}' +
    '.lw-fr-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}' +
    '.lw-fr-row:first-of-type{border-top:0}' +
    '.lw-fr-dot{width:9px;height:9px;flex:none;background:#3d3660;transform:rotate(45deg)}.lw-fr-row.lw-on .lw-fr-dot{background:#8cff5a;box-shadow:0 0 9px #8cff5a}' +
    '.lw-fr-row.lw-off{opacity:.5}' +
    '.lw-fr-who{flex:1;min-width:0}.lw-fr-who b{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lw-fr-who small{display:block;color:#8e89a8;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lw-fr-who small em{font-style:normal;color:#ffe14d}' +
    '.lw-fr-act{display:flex;gap:5px;flex:none}' +
    '.lw-fr-add{display:flex;gap:6px}.lw-fr-add input{flex:1;min-width:0;padding:8px 10px;background:#07060d;border:1px solid #3d3660;outline:none;user-select:text;-webkit-user-select:text}' +
    '.lw-fr-add input:focus{border-color:#22e4ff}' +
    '.lw-fr-set label{display:flex;align-items:flex-start;gap:8px;margin:7px 0;color:#c9c6dc;font-size:13px;cursor:pointer}.lw-fr-set input[type=checkbox]{margin-top:2px;accent-color:#22e4ff}' +
    '.lw-fr-set .lw-fr-name{display:flex;gap:6px;margin-bottom:8px}.lw-fr-name input{flex:1;min-width:0;padding:8px 10px;background:#07060d;border:1px solid #3d3660;outline:none;user-select:text;-webkit-user-select:text}.lw-fr-name input:focus{border-color:#22e4ff}' +
    '#lw-fr-msg{min-height:1.3em;margin:10px 0 0;font-size:13px;color:#8e89a8}#lw-fr-msg.lw-ok{color:#8cff5a}#lw-fr-msg.lw-err{color:#ff6aa9}' +
    '#lw-fr-conn{display:none;padding:7px 14px;background:rgba(255,46,136,.16);border-bottom:1px solid rgba(255,46,136,.5);font-size:12.5px;color:#ffb3d3}#lw-fr-conn.lw-on{display:block}' +
    // Einladungs-Karten oben in der Mitte
    '#lw-fr-toasts{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:10px;width:min(420px,calc(100vw - 24px));pointer-events:none}' +
    '.lw-fr-toast{pointer-events:auto;position:relative;padding:13px 16px 12px;background:rgba(8,7,16,.97);border:1px solid rgba(255,46,136,.7);' +
    'box-shadow:0 0 0 1px rgba(0,0,0,.5),0 18px 40px -12px rgba(255,46,136,.5);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));' +
    'transform:translateY(-14px);opacity:0;transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s}' +
    '.lw-fr-toast.lw-in{transform:none;opacity:1}' +
    '.lw-fr-toast .lw-k{font:700 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.18em;color:#ff2e88;text-transform:uppercase}' +
    '.lw-fr-toast .lw-q{margin:7px 0 0;font-size:15px}.lw-fr-toast .lw-q b{color:#22e4ff}.lw-fr-toast .lw-q small{display:block;margin-top:3px;color:#8e89a8;font-size:12px}' +
    '.lw-fr-toast .lw-fr-btns{margin-top:10px}' +
    '@media (prefers-reduced-motion:reduce){#lw-fr-panel,.lw-fr-toast{transition:none}#lw-fr-btn.lw-ping{animation:none}}';

  var root = document.createElement('div');
  root.id = 'lw-fr';
  if (ON_START) root.className = 'lw-start';
  root.innerHTML =
    '<button type="button" id="lw-fr-btn" aria-label="Freunde und Einladungen" title="Freunde und Einladungen">' +
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><circle cx="7.5" cy="6.5" r="3"/><path d="M1.5 16.5c0-3.4 2.7-5.5 6-5.5s6 2.1 6 5.5"/><path d="M13.5 4.2a3 3 0 0 1 0 5.6M15.5 11.6c1.7.7 3 2.2 3 4.9"/></svg>' +
      '<span class="lw-t">Freunde</span><span class="lw-n"></span></button>' +
    '<aside id="lw-fr-panel" role="dialog" aria-label="Freunde und Einladungen" aria-hidden="true">' +
      '<header><h2><i>// Freunde</i><span id="lw-fr-title">Einladen</span></h2><button type="button" id="lw-fr-x" aria-label="Schliessen">✕</button></header>' +
      '<div id="lw-fr-conn" role="status">Keine Verbindung. Ich versuche es nochmal …</div>' +
      '<div id="lw-fr-body">' +
        '<section id="lw-fr-room"></section>' +
        '<section id="lw-fr-reqs"></section>' +
        '<h3 id="lw-fr-h-friends">Freunde</h3><div id="lw-fr-friends"></div>' +
        '<div id="lw-fr-lobbybox"><h3 id="lw-fr-h-lobby">In der Lobby</h3><div id="lw-fr-lobby"></div></div>' +
        '<h3>Freund hinzufügen</h3>' +
        '<p class="lw-fr-m">Gib den Benutzernamen deiner Freundin oder deines Freundes ein. Dein eigener Name: <b id="lw-fr-myname">–</b></p>' +
        '<form class="lw-fr-add" id="lw-fr-add"><input id="lw-fr-code-in" maxlength="16" placeholder="Benutzername" autocomplete="off" spellcheck="false" aria-label="Benutzername"><button type="submit" class="lw-b lw-go">Hinzufügen</button></form>' +
        '<div class="lw-fr-btns"><button type="button" class="lw-b" data-a="copy-flink">Freundes-Link kopieren</button></div>' +
        '<p id="lw-fr-msg" role="status"></p>' +
        '<h3>Einstellungen</h3>' +
        '<div class="lw-fr-set"><div class="lw-fr-name"><input id="lw-fr-name" maxlength="16" placeholder="Dein Benutzername" autocomplete="off" aria-label="Dein Benutzername"><button type="button" class="lw-b" data-a="save-name">Ändern</button></div>' +
        '<p class="lw-fr-m" style="margin:0 0 8px">Jeder Name gibt es nur einmal und gilt in allen Spielen.</p>' +
        '<label><input type="checkbox" id="lw-fr-vis"> <span>Für andere Online-Spieler sichtbar<br><small style="color:#8e89a8">Sonst sehen dich nur Freunde als online. Aus = unsichtbar.</small></span></label>' +
        '<label><input type="checkbox" id="lw-fr-only"> <span>Einladungen nur von Freunden</span></label></div>' +
      '</div>' +
    '</aside>' +
    '<div id="lw-fr-toasts" aria-live="polite"></div>';

  // Klicks und Tasten bleiben im Panel und gelangen nicht ins Spiel (z.B. Mausfang beim Bogen-Duell)
  function isolate(el) {
    ['mousedown', 'pointerdown', 'touchstart', 'keydown', 'keyup', 'keypress', 'wheel', 'click', 'mouseup', 'pointerup', 'contextmenu'].forEach(function (ev) {
      el.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
  }

  var btn, panel, mounted = false, drawQueued = false;
  function mount() {
    if (mounted) return;
    mounted = true;
    document.head.appendChild(css);
    document.body.appendChild(root);
    btn = $('#lw-fr-btn'); panel = $('#lw-fr-panel');
    btn.classList.add('lw-on');
    isolate(btn); isolate(panel); isolate($('#lw-fr-toasts'));
    btn.addEventListener('click', function () { S.autoOpened = false; setOpen(!S.open); });
    $('#lw-fr-x').addEventListener('click', function () { setOpen(false); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    panel.addEventListener('click', onClick);
    $('#lw-fr-add').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#lw-fr-code-in'), n = input.value.trim();
      if (n.length < 2) return msg('Bitte den Benutzernamen eingeben.', 'err');
      wsSend({ t: 'friend-add', name: n }); input.value = '';
    });
    $('#lw-fr-name').value = myName();
    var vis = $('#lw-fr-vis'), only = $('#lw-fr-only');
    vis.checked = settings.visible; only.checked = settings.onlyFriends;
    function saveSet() {
      settings.visible = vis.checked; settings.onlyFriends = only.checked;
      save('lw-fr-set', JSON.stringify(settings));
      status({ visible: settings.visible, onlyFriends: settings.onlyFriends });
    }
    vis.addEventListener('change', saveSet); only.addEventListener('change', saveSet);
    // Beim Wechsel in den Vollbildmodus muss das Panel mit, sonst bleibt es unsichtbar hinter dem Spiel
    document.addEventListener('fullscreenchange', function () {
      var fs = document.fullscreenElement;
      (fs && fs.tagName !== 'CANVAS' && fs.tagName !== 'VIDEO' ? fs : document.body).appendChild(root);
    });
    // Freundes-Link: https://langwiligi.site/?freund=K7QD93MX
    var m = ON_START && /[?&]freund=([A-Za-z0-9-]+)/.exec(location.search);
    if (m) {
      var c = m[1].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
      if (c.length === 8 && S.me && c !== S.me.code) { $('#lw-fr-code-in').value = c; setOpen(true); msg('Freund hinzufügen? Tippe auf „Hinzufügen“.', 'ok'); }
    }
  }

  function setOpen(open) {
    if (!mounted) return;
    S.open = open;
    panel.classList.toggle('lw-in', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      $('#lw-fr-name').value = myName();
    }
    draw();
  }
  function pulse() {
    if (!btn) return;
    btn.classList.remove('lw-ping'); void btn.offsetWidth; btn.classList.add('lw-ping');
  }
  function msg(text, kind) {
    var el = $('#lw-fr-msg');
    if (!el) return;
    el.textContent = text; el.className = kind === 'err' ? 'lw-err' : kind === 'ok' ? 'lw-ok' : '';
    clearTimeout(msg.t);
    msg.t = setTimeout(function () { el.textContent = ''; el.className = ''; }, 7000);
    if (kind === 'err' && !S.open) toast({ kicker: 'Hinweis', html: esc(text), ttl: 4000 });
  }

  // ---------- Karten oben (Einladungen und Freundschaftsanfragen) ----------
  function toast(o) {
    if (!mounted) { document.head.appendChild(css); document.body.appendChild(root); }
    var box = $('#lw-fr-toasts'), el = document.createElement('div');
    el.className = 'lw-fr-toast'; el.setAttribute('role', 'alert');
    el.innerHTML = '<div class="lw-k">// ' + esc(o.kicker) + '</div><p class="lw-q">' + o.html + '</p>' + (o.actions ? '<div class="lw-fr-btns"></div>' : '');
    function close() { el.classList.remove('lw-in'); setTimeout(function () { el.remove(); }, 350); }
    (o.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lw-b' + (a.cls ? ' lw-' + a.cls : ''); b.textContent = a.label;
      b.addEventListener('click', function () { close(); a.fn(); });
      el.querySelector('.lw-fr-btns').appendChild(b);
    });
    while (box.children.length >= 3) box.firstChild.remove();   // nie mehr als 3 Karten auf einmal (Schutz vor Einladungs-Spam)
    box.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('lw-in'); }); });
    if (o.ttl) setTimeout(close, o.ttl);
    return close;
  }
  var shownInvites = {};
  function showInvite(m) {
    var key = m.from.code + '|' + m.room;
    if (shownInvites[key] && Date.now() - shownInvites[key] < 20000) return;
    shownInvites[key] = Date.now();
    var leaving = S.room && S.room.count > 1;
    toast({ kicker: 'Einladung', ttl: 60000, html: '<b>' + esc(m.from.name) + '</b> lädt dich zu <b>' + esc(m.gameName) + '</b> ein.' +
      '<small>Lobby ' + esc(m.room) + (m.free ? ' · noch ' + m.free + (m.free === 1 ? ' Platz' : ' Plätze') + ' frei' : '') +
      (leaving ? ' · Du verlässt dein laufendes Spiel' : '') + '</small>', actions: [
      { label: 'Beitreten', cls: 'go', fn: function () { go(m.game, m.room); } },
      { label: 'Ablehnen', fn: function () {} }] });
    pulse();
  }

  // ---------- Panel zeichnen ----------
  function draw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; render(); });
  }
  function friendRow(f) {
    var mineRoom = S.room && f.room && f.room.code === S.room.code;
    var open = S.room && S.room.count < S.room.max;
    var acts = '';
    if (f.online) {
      if (mineRoom) acts = '<button class="lw-b lw-done" disabled>Im Raum</button>';
      else if (open && S.invited[f.code] && Date.now() - S.invited[f.code] < 10000) acts = '<button class="lw-b lw-done" disabled>Eingeladen ✓</button>';
      else if (open) acts = '<button class="lw-b lw-go" data-a="invite" data-c="' + f.code + '">Einladen</button>';
      if (f.room && !mineRoom) acts += '<button class="lw-b lw-pk" data-a="join" data-g="' + esc(f.game) + '" data-r="' + f.room.code + '">Mitspielen</button>';
    }
    acts += '<button class="lw-b lw-ghost" data-a="remove" data-c="' + f.code + '" title="Freund entfernen" aria-label="' + esc(f.name) + ' entfernen">✕</button>';
    var sub = esc(whereIs(f)) + (f.room && !mineRoom ? ' · <em>Raum offen</em>' : '');
    return '<div class="lw-fr-row ' + (f.online ? 'lw-on' : 'lw-off') + '"><i class="lw-fr-dot"></i><div class="lw-fr-who"><b>' + esc(f.name) + '</b><small>' + sub +
      '</small></div><div class="lw-fr-act">' + acts + '</div></div>';
  }
  function render() {
    if (!mounted) return;
    var room = S.room, open = room && room.count < room.max;
    var online = S.friends.filter(function (f) { return f.online; });
    $('#lw-fr-conn').classList.toggle('lw-on', !S.connected);
    // Knopf: Zahl der Freunde online
    $('#lw-fr-btn .lw-n').textContent = online.length ? String(online.length) : '';
    $('#lw-fr-title').textContent = room ? 'Spieler einladen' : 'Freunde';
    var mn = $('#lw-fr-myname'); if (mn && S.me) mn.textContent = S.me.name;
    if (!S.open) return;

    // Raum + Link
    var rh = '';
    if (room && GAME) {
      rh = '<h3>Dein Raum</h3><div class="lw-fr-code"><strong>' + esc(room.code) + '</strong><span class="lw-fr-m" style="margin:0">' + room.count + ' / ' + room.max + ' Plätze</span></div>' +
        (open ? '<div class="lw-fr-btns"><button class="lw-b lw-go" data-a="copy-link">Einladungslink kopieren</button>' +
          '<button class="lw-b lw-pk" data-a="whatsapp">WhatsApp</button></div>' +
          '<p class="lw-fr-m">Der Link zeigt ein Vorschaubild und bringt deine Freunde direkt in den Raum. Oder gib ihnen den Code <b>' + esc(room.code) + '</b>.</p>'
          : '<p class="lw-fr-m"><b>Der Raum ist voll.</b> Viel Spass!</p>');
    } else if (GAME) {
      rh = '<p class="lw-fr-m" style="margin-top:14px">Erstelle im Spiel einen <b>Online-Raum</b>, dann kannst du hier Freunde und Leute aus der Lobby einladen. Einladungen von anderen erscheinen oben auf dem Bildschirm.</p>';
    }
    $('#lw-fr-room').innerHTML = rh;

    // Anfragen
    $('#lw-fr-reqs').innerHTML = S.requests.length ? '<h3>Anfragen <b>' + S.requests.length + '</b></h3>' + S.requests.map(function (r) {
      return '<div class="lw-fr-row lw-on"><i class="lw-fr-dot" style="background:#ff2e88;box-shadow:0 0 9px #ff2e88"></i><div class="lw-fr-who"><b>' + esc(r.name) + '</b><small>möchte dein Freund sein</small></div>' +
        '<div class="lw-fr-act"><button class="lw-b lw-go" data-a="accept" data-c="' + r.code + '">Annehmen</button><button class="lw-b lw-ghost" data-a="decline" data-c="' + r.code + '" aria-label="Ablehnen">✕</button></div></div>';
    }).join('') : '';

    // Freunde: online zuerst
    var list = S.friends.slice().sort(function (a, b) { return (b.online - a.online) || a.name.localeCompare(b.name); });
    $('#lw-fr-h-friends').innerHTML = 'Freunde' + (S.friends.length ? ' <b>' + online.length + ' online</b>' : '');
    var sentHtml = S.sent.map(function (s) {
      return '<div class="lw-fr-row lw-off"><i class="lw-fr-dot"></i><div class="lw-fr-who"><b>' + esc(s.name) + '</b><small>Anfrage offen</small></div>' +
        '<div class="lw-fr-act"><button class="lw-b lw-ghost" data-a="decline-sent" data-c="' + s.code + '" aria-label="Anfrage zurückziehen">✕</button></div></div>';
    }).join('');
    $('#lw-fr-friends').innerHTML = list.map(friendRow).join('') + sentHtml ||
      '<p class="lw-fr-m">' + (friendsLoaded ? 'Noch keine Freunde. Gib unten den Code deines Freundes ein oder schick ihm deinen.' : 'Lade …') + '</p>';

    // Lobby: nur auf Spiel-Seiten
    // Online-Spieler zeigt die Lobby nur, solange man im Raum des Spiels wartet
    $('#lw-fr-lobbybox').style.display = GAME && room ? '' : 'none';
    if (GAME && room) {
      var pending = {}; S.sent.forEach(function (s) { pending[s.code] = 1; });
      var lobby = S.lobby.filter(function (p) { return !p.friend; });   // Freunde stehen schon oben in der Freundesliste
      $('#lw-fr-h-lobby').innerHTML = 'Online-Spieler' + (lobby.length ? ' <b>' + lobby.length + '</b>' : '');
      $('#lw-fr-lobby').innerHTML = lobby.length ? lobby.map(function (p) {
        var acts = '';
        if (open) {
          if (S.invited[p.code] && Date.now() - S.invited[p.code] < 10000) acts += '<button class="lw-b lw-done" disabled>Eingeladen ✓</button>';
          else if (p.onlyFriends && !p.friend) acts += '<button class="lw-b lw-done" disabled title="Nimmt nur Einladungen von Freunden an">Nur Freunde</button>';
          else acts += '<button class="lw-b lw-go" data-a="invite" data-c="' + p.code + '">Einladen</button>';
        }
        if (pending[p.code]) acts += '<button class="lw-b lw-done" disabled>Angefragt</button>';
        else acts += '<button class="lw-b" data-a="befriend" data-c="' + p.code + '" title="Freundschaft anfragen">+ Freund</button>';
        return '<div class="lw-fr-row lw-on"><i class="lw-fr-dot"></i><div class="lw-fr-who"><b>' + esc(p.name) + '</b><small>online in diesem Spiel</small></div><div class="lw-fr-act">' + acts + '</div></div>';
      }).join('') : '<p class="lw-fr-m">Gerade ist sonst niemand in diesem Spiel online. Wer es öffnet, erscheint hier.</p>';
    }
  }

  var removing = null;
  function onClick(e) {
    var b = e.target.closest('button[data-a]');
    if (!b) return;
    var a = b.dataset.a, c = b.dataset.c;
    if (a === 'invite') { wsSend({ t: 'invite', to: c, room: S.room && S.room.code }); }
    else if (a === 'join') go(b.dataset.g, b.dataset.r);
    else if (a === 'accept') wsSend({ t: 'friend-accept', code: c });
    else if (a === 'decline' || a === 'decline-sent') wsSend({ t: a === 'decline' ? 'friend-decline' : 'friend-remove', code: c });
    else if (a === 'befriend') wsSend({ t: 'friend-add', code: c });
    else if (a === 'remove') {
      if (removing !== c) {   // zweiter Klick nötig, damit nichts aus Versehen verschwindet
        removing = c; b.textContent = 'Entfernen?'; b.classList.remove('lw-ghost');
        setTimeout(function () { if (removing === c) { removing = null; draw(); } }, 3000);
      } else { removing = null; wsSend({ t: 'friend-remove', code: c }); }
    }
    else if (a === 'copy-link') copy(inviteLink()).then(function () { msg('Link kopiert. Jetzt in WhatsApp, Discord & Co. einfügen.', 'ok'); }, function () { msg('Kopieren hat nicht geklappt.', 'err'); });
    else if (a === 'whatsapp') {
      var text = 'Spiel mit mir ' + (document.title.replace(/( \([^)]*\))? – [^|]*\| KEI Langwiligi site$/, '') || 'ein Spiel') + '! ' + inviteLink();
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
    else if (a === 'copy-flink') S.me && copy(SEITE + '/?freund=' + S.me.code).then(function () { msg('Freundes-Link kopiert. Wer ihn öffnet, kann dich direkt hinzufügen.', 'ok'); }, function () { msg('Kopieren hat nicht geklappt.', 'err'); });
    else if (a === 'save-name') {
      var n = $('#lw-fr-name').value.trim().slice(0, 16);
      if (!n) return msg('Bitte einen Namen eingeben.', 'err');
      if (n === myName()) return msg('Das ist schon dein Name.', 'ok');
      status({ name: n });   // der Server prüft, ob er frei ist, und antwortet mit name-ok / name-error
    }
  }

  // Spielername wurde im Spiel geändert: dem Server mitteilen
  var lastName = myName();
  setInterval(function () { var n = myName(); if (n !== lastName) { lastName = n; if (n && S.me && n !== S.me.name) status({ name: n }); } }, 3000);

  // ---------- Einladung annehmen: direkt in den Raum ----------
  // Der Einladungslink (und der Knopf „Beitreten“ auf der Einladungskarte) öffnet das Spiel mit #CODE. Die Spiele tragen den Code nur ins Feld ein.
  // Hier tippen wir für die Person auf „Beitreten“ (und tragen den Namen ein), damit sie sofort im Raum landet.
  var inviteCode = ON_START ? '' : (/^#[A-Za-z0-9]{4}$/.test(location.hash) ? location.hash.slice(1).toUpperCase() : '');
  var inviteJoined = false;
  function inviteDone(code) {
    if (!inviteCode || code !== inviteCode) return;
    inviteJoined = true;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function visible(el) {
    if (!el.getClientRects().length) return false;
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false; }
    return true;
  }
  function codeOf(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4); }
  function findJoin() {
    var btns = document.querySelectorAll('button, [role=button], input[type=button], input[type=submit]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], t = String(b.textContent || b.value || '').replace(/[^A-Za-zÄÖÜäöüß\s]/g, '').trim().toLowerCase();
      if (!/^((raum|spiel|jetzt|online) )?beitreten$|^mitspielen$/.test(t) || b.disabled || !visible(b)) continue;
      for (var sc = b.parentElement, d = 0; sc && d < 7; sc = sc.parentElement, d++) {
        var ins = sc.querySelectorAll('input'), ci = null;
        for (var k = 0; k < ins.length; k++) if ((ins[k].type === 'text' || !ins[k].type) && codeOf(ins[k].value) === inviteCode && ins[k].value.length <= 12) { ci = ins[k]; break; }
        if (ci) return { btn: b, input: ci, scope: sc };
      }
    }
    return null;
  }
  function autoJoin() {
    if (!inviteCode) return;
    var tries = 0, clicks = 0, last = 0;
    var iv = setInterval(function () {
      if (inviteJoined || ++tries > 80) return clearInterval(iv);
      if (Date.now() - last < 4000) return;   // dem Beitritt Zeit lassen
      var f = findJoin();
      if (!f) return;
      var name = (window.GameHub && GameHub.getName && GameHub.getName()) || myName();
      var ins = f.scope.querySelectorAll('input');
      for (var k = 0; k < ins.length; k++) {
        var el = ins[k];
        if (el !== f.input && (el.type === 'text' || !el.type) && !el.value && name && el.offsetParent !== null) { el.value = name; el.dispatchEvent(new Event('input', { bubbles: true })); }
      }
      last = Date.now();
      if (++clicks > 2) return clearInterval(iv);
      f.btn.click();
    }, 300);
  }
  autoJoin();

  window.LW = window.LW || {};
  window.LW.freunde = { open: function () { setOpen(true); }, close: function () { setOpen(false); } };

  connect();
})();
