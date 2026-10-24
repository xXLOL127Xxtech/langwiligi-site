// GameHub – gemeinsame Online-Funktionen für alle Spiele:
// Räume mit Code, Nachrichten zwischen Spielern, Rangliste und gespeicherter Spielername.
// Einbinden mit:  <script src="../_shared/hub.js"></script>
(function () {
  'use strict';
  const HOME = 'langwiligi.site';
  // Solange langwiligi.site gesperrt ist, läuft die Seite direkt über die IP des Servers (ohne HTTPS)
  const IP = '46.224.94.231';
  const BEI_UNS = /^https?:$/.test(location.protocol) && (location.hostname === IP || location.hostname === HOME || location.hostname.endsWith('.' + HOME));
  // Adresse der Webseite (für Einladungslinks), z.B. http://46.224.94.231
  const SEITE = BEI_UNS ? location.origin : 'http://' + IP;
  const WS_URL = SEITE.replace(/^http/, 'ws') + '/ws';
  const API = SEITE + '/api';
  const NAME_KEY = 'lw-name';

  // Ohne HTTPS gibt es navigator.clipboard nicht: Ersatz, damit "Link kopieren" trotzdem geht
  if (!navigator.clipboard) {
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText(text) {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(t); t.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        t.remove();
        return ok ? Promise.resolve() : Promise.reject(new Error('Kopieren nicht möglich'));
      } } });
    } catch (e) {}
  }

  // ---------- Benutzername ----------
  // Jeder Name gibt es nur einmal (der Server prüft das) und er gilt in allen Spielen. Wer keinen hat, bekommt einen Zufallsnamen.
  const TIERE = ['Fuchs', 'Luchs', 'Dachs', 'Igel', 'Hase', 'Rabe', 'Wolf', 'Otter', 'Falke', 'Kauz', 'Biber', 'Marder', 'Specht', 'Molch', 'Gecko',
    'Panda', 'Lama', 'Puma', 'Kiwi', 'Adler', 'Hirsch', 'Frosch', 'Krebs', 'Bär', 'Pinguin', 'Delfin'];
  function randomName() { return TIERE[Math.floor(Math.random() * TIERE.length)] + (10 + Math.floor(Math.random() * 990)); }
  function cleanLocal(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim(); }
  function secret() {
    let s = '';
    try { s = localStorage.getItem('lw-pid') || ''; } catch (e) {}
    if (!/^[A-Za-z0-9]{16,64}$/.test(s)) {
      const a = new Uint8Array(24), c = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      (window.crypto || window.msCrypto).getRandomValues(a);
      s = ''; for (let i = 0; i < a.length; i++) s += c[a[i] % c.length];
      try { localStorage.setItem('lw-pid', s); } catch (e) {}
    }
    return s;
  }
  function stored() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function store(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  let memName = '';
  function getName() {
    let n = stored() || memName;
    if (!n) { n = randomName(); memName = n; store(n); }
    return n;
  }
  // Hinweis unten in der Mitte (z.B. "Name schon vergeben")
  let noteEl = null, noteTimer = 0;
  function note(text) {
    if (!document.body) return;
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.className = 'lw-namenote'; noteEl.setAttribute('role', 'status');
      noteEl.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(460px,calc(100vw - 24px));z-index:2147483001;' +
        'padding:11px 16px;background:#0b0a14;color:#ecebf5;border:1px solid #ff2e88;font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;' +
        'box-shadow:0 12px 30px rgba(0,0,0,.55);pointer-events:none;transition:opacity .25s';
      document.body.appendChild(noteEl);
    }
    noteEl.textContent = text; noteEl.style.opacity = '1';
    clearTimeout(noteTimer); noteTimer = setTimeout(() => { noteEl.style.opacity = '0'; }, 6000);
  }
  // Der Server hat einen anderen Namen vergeben als eingegeben: speichern und in allen Namensfeldern nachtragen
  function adopt(name, typed) {
    store(name); memName = name;
    if (typed && typed !== name) {
      document.querySelectorAll('input').forEach(i => { if ((i.type === 'text' || !i.type) && i.value === typed) i.value = name; });
    }
    try { window.dispatchEvent(new CustomEvent('lw-name', { detail: { name } })); } catch (e) {}
  }
  const claimQueue = { busy: false, next: null };
  // Name beim Server eintragen. Ist er vergeben, bleibt der alte (oder, beim ersten Mal, wird ein freier vergeben).
  function claim(wanted, silent) {
    if (!BEI_UNS) return Promise.resolve({ ok: true, name: wanted });
    return fetch(API + '/name', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ secret: secret(), name: wanted }) })
      .then(r => r.json()).then(r => {
        if (!r || !r.name) return { ok: true, name: wanted };
        if (r.ok) { if (r.name !== getName()) adopt(r.name, wanted); return r; }
        adopt(r.name, wanted);
        if (!silent) note(r.error === 'taken' ? 'Der Name «' + wanted + '» ist schon vergeben. Du bleibst «' + r.name + '».' : 'Dieser Name geht nicht. Du bleibst «' + r.name + '».');
        return r;
      }, () => ({ ok: true, name: wanted }));
  }
  function setName(n) {
    n = cleanLocal(n);
    const old = getName();
    if (!n || n === old) return old;
    store(n); memName = n;
    claim(n, false);
    return n;
  }
  // Beim Laden: Name beim Server anmelden. War er schon vergeben, gibt es einen freien (mit Hinweis).
  setTimeout(() => {
    const n = getName();
    claim(n, true).then(r => {
      if (r && r.ok === false && r.name && r.name !== n) {
        note(r.error === 'taken' ? 'Der Name «' + n + '» war schon vergeben. Du heisst jetzt «' + r.name + '». Ändern kannst du ihn jederzeit.' : 'Du heisst jetzt «' + r.name + '».');
      }
    });
  }, 0);
  function cleanCode(v) {
    v = String(v || '').trim();
    if (v.includes('#')) v = v.split('#').pop();
    return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  async function leaderboard(game) {
    const r = await fetch(API + '/leaderboard?game=' + encodeURIComponent(game), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).rows || [];
  }
  // Rangliste als HTML-Tabelle in ein Element schreiben
  function renderBoard(el, rows, me) {
    if (!el) return;
    if (!rows || !rows.length) { el.innerHTML = '<div class="lw-empty">Noch keine Siege – sei der Erste!</div>'; return; }
    const meL = String(me || '').toLowerCase();
    el.innerHTML = '<table class="lw-board"><thead><tr><th>#</th><th>Name</th><th>Siege</th><th>Spiele</th></tr></thead><tbody>' +
      rows.slice(0, 10).map((r, i) => `<tr class="${r.name.toLowerCase() === meL ? 'lw-me' : ''}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>` +
        `<td>${esc(r.name)}</td><td>${r.wins}</td><td>${r.games}</td></tr>`).join('') + '</tbody></table>';
  }
  function loadBoard(game, el, me) {
    if (el) el.innerHTML = '<div class="lw-empty">Lade Rangliste …</div>';
    return leaderboard(game).then(rows => { renderBoard(el, rows, me); return rows; },
      () => { if (el) el.innerHTML = '<div class="lw-empty">Rangliste gerade nicht erreichbar.</div>'; return []; });
  }

  // ---------- Highscores für Einzelspieler-Spiele (bester Punktestand pro Name) ----------
  async function highscores(game) {
    const r = await fetch(API + '/highscores?game=' + encodeURIComponent(game), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).rows || [];
  }
  // Ergebnis melden -> { rows, rank, total, best }. text/plain spart den CORS-Preflight.
  async function submitScore(game, name, score, extra) {
    const r = await fetch(API + '/score', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(Object.assign({}, extra, { game, name, score, secret: secret() })) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  // opts: { cols: [[feld, Überschrift], ...], limit, empty }
  function renderScores(el, rows, me, opts) {
    if (!el) return;
    opts = opts || {};
    const cols = opts.cols || [['score', 'Punkte']];
    if (!rows || !rows.length) { el.innerHTML = '<div class="lw-empty">' + esc(opts.empty || 'Noch keine Einträge – sei der Erste!') + '</div>'; return; }
    const meL = String(me || '').toLowerCase();
    el.innerHTML = '<table class="lw-board"><thead><tr><th>#</th><th>Name</th>' + cols.map(c => `<th>${esc(c[1])}</th>`).join('') +
      '</tr></thead><tbody>' + rows.slice(0, opts.limit || 10).map((r, i) =>
        `<tr class="${String(r.name).toLowerCase() === meL ? 'lw-me' : ''}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>` +
        `<td>${esc(r.name)}</td>` + cols.map(c => `<td>${esc(r[c[0]] == null ? '' : r[c[0]])}</td>`).join('') + '</tr>').join('') +
      '</tbody></table>';
  }

  // Verbindung zu einem Raum. Ereignisse: msg(data, from), peer-join({idx,name,players}), peer-left({idx}), leaderboard(rows), close()
  function connect(game) {
    const handlers = {};
    const emit = (ev, ...a) => (handlers[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
    let ws = null, pending = null, closedByMe = false;
    const api = {
      game, code: null, you: -1, players: [], max: 0,
      on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); return api; },
      create(name, max = 2) { return open({ t: 'create', game, name, max, secret: secret() }); },
      // Offene Welt: alle landen im selben öffentlichen Raum (bei Bedarf wird ein neuer geöffnet)
      quick(name, max = 2) { return open({ t: 'quick', game, name, max, secret: secret() }); },
      join(code, name) { return open({ t: 'join', game, code: cleanCode(code), name, secret: secret() }); },
      send(d) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'relay', d })); },
      roundStart() { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'round-start' })); },
      result(winner) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'result', winner })); },
      close() { closedByMe = true; if (ws) ws.close(); ws = null; },
      get open() { return !!ws && ws.readyState === 1; },
    };
    function open(first) {
      return new Promise((resolve, reject) => {
        if (ws) { closedByMe = true; ws.close(); }
        closedByMe = false;
        ws = new WebSocket(WS_URL);
        pending = { resolve, reject };
        const timer = setTimeout(() => { if (pending) { pending.reject(new Error('timeout')); pending = null; } }, 10000);
        ws.onopen = () => ws.send(JSON.stringify(first));
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          switch (m.t) {
            case 'joined': {
              api.code = m.code; api.you = m.you; api.players = m.players; api.max = m.max;
              // Der Server nimmt den Namen des Kontos. Wer einen vergebenen Namen eingegeben hat, spielt unter seinem eigenen weiter.
              const mine = m.players && m.players[m.you];
              if (mine && mine !== getName()) {
                const typed = first.name;
                adopt(mine, typed);
                if (typed && typed !== mine && String(typed).toLowerCase() !== mine.toLowerCase()) note('Der Name «' + typed + '» ist schon vergeben. Du spielst als «' + mine + '».');
              }
              clearTimeout(timer); if (pending) { pending.resolve(m); pending = null; }
              break;
            }
            case 'error':
              clearTimeout(timer); if (pending) { pending.reject(new Error(m.msg)); pending = null; }
              break;
            case 'relay': emit('msg', m.d, m.from); break;
            case 'peer-join': api.players = m.players; emit('peer-join', m); break;
            case 'peer-left': if (api.players) api.players[m.idx] = null; emit('peer-left', m); break;
            case 'leaderboard': emit('leaderboard', m.rows); break;
          }
        };
        ws.onerror = () => {};
        ws.onclose = () => {
          clearTimeout(timer);
          if (pending) { pending.reject(new Error('Keine Verbindung zum Spiel-Server')); pending = null; }
          if (!closedByMe) emit('close');
        };
      });
    }
    return api;
  }

  const ERR = { 'not-found': 'Kein Spiel mit diesem Code gefunden.', 'full': 'Das Spiel ist schon voll.',
    'wrong-game': 'Dieser Code gehört zu einem anderen Spiel.', 'timeout': 'Der Server antwortet nicht.',
    'busy': 'Der Server ist gerade ausgelastet. Bitte gleich nochmal versuchen.' };
  function errorText(e) { return ERR[e && e.message] || (e && e.message) || 'Unbekannter Fehler'; }

  // Basis-Stil für die Rangliste (Spiele können ihn überschreiben)
  const css = document.createElement('style');
  css.textContent = `.lw-board{width:100%;border-collapse:collapse;font-size:14px}
.lw-board th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.65;font-weight:600;text-align:left;padding:4px 6px}
.lw-board td{padding:5px 6px;border-top:1px solid rgba(255,255,255,.08)}
.lw-board td:nth-child(3),.lw-board td:nth-child(4),.lw-board th:nth-child(3),.lw-board th:nth-child(4){text-align:right;font-variant-numeric:tabular-nums}
.lw-board tr.lw-me td{color:#ffcb7a;font-weight:700}
.lw-empty{font-size:13px;opacity:.7;padding:6px 0}`;
  document.head.appendChild(css);

  window.GameHub = { SEITE, connect, leaderboard, loadBoard, renderBoard, highscores, submitScore, renderScores,
    getName, setName, cleanCode, errorText };
})();
