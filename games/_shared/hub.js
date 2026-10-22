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

  function getName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function setName(n) {
    n = String(n || '').trim().slice(0, 16);
    try { if (n) localStorage.setItem(NAME_KEY, n); } catch (e) {}
    return n;
  }
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
      body: JSON.stringify(Object.assign({}, extra, { game, name, score })) });
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
      create(name, max = 2) { return open({ t: 'create', game, name, max }); },
      join(code, name) { return open({ t: 'join', game, code: cleanCode(code), name }); },
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
            case 'joined':
              api.code = m.code; api.you = m.you; api.players = m.players; api.max = m.max;
              clearTimeout(timer); if (pending) { pending.resolve(m); pending = null; }
              break;
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
    'wrong-game': 'Dieser Code gehört zu einem anderen Spiel.', 'timeout': 'Der Server antwortet nicht.' };
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
