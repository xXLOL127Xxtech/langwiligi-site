// Online-Rangliste für dieses Solo-Spiel (über GameHub von langwiligi.site).
// Läuft auch ohne GameHub (lokal per Doppelklick): dann wird nur der lokale Rekord gezeigt.
//
//   Rangliste.init({ game: '2048', el: element, einheit: 'Punkte' });
//   Rangliste.rundeFertig(punkte, fortschritt);   // am Ende jeder Runde
(function () {
  var cfg = null, offen = null, sende = false, nameMem = '', letzte = null, jetzt = 0;
  var hub = function () { return window.GameHub && window.GameHub.submitScore ? window.GameHub : null; };

  var css = document.createElement('style');
  css.textContent =
    '.rl{font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#ecebf5;text-align:left}' +
    '.rl-kopf{font-weight:700;font-size:15px;margin-bottom:8px;letter-spacing:.02em}' +
    '.rl-zeile{display:flex;gap:6px;margin-bottom:8px}' +
    '.rl-zeile input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);' +
    'background:rgba(0,0,0,.35);color:inherit;font:inherit}' +
    '.rl-zeile button{padding:8px 12px;border-radius:8px;border:0;background:var(--rl-akzent,#edc22e);color:#1a1405;' +
    'font:700 14px system-ui,sans-serif;cursor:pointer}' +
    '.rl-zeile button[hidden]{display:none}' +
    '.rl-info{min-height:1.4em;font-size:13px;opacity:.85;margin-bottom:6px}' +
    '.rl-live{font-size:13px;margin:0 0 6px;padding:6px 9px;border-radius:8px;background:rgba(237,194,46,.12)}.rl-live:empty{display:none}.rl-live b{color:var(--rl-akzent,#edc22e)}';
  document.head.appendChild(css);

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function name() {
    var inp = cfg && cfg.el.querySelector('input');
    var n = inp ? inp.value.trim().slice(0, 16) : '';
    if (n) { nameMem = n; if (hub()) window.GameHub.setName(n); }
    return n;
  }
  function info(t) { var el = cfg && cfg.el.querySelector('.rl-info'); if (el) el.innerHTML = t; }
  function knopf(sichtbar) { var b = cfg && cfg.el.querySelector('button'); if (b) b.hidden = !sichtbar; }
  function liste(rows) {
    var el = cfg.el.querySelector('.rl-liste');
    letzte = rows || []; live();
    window.GameHub.renderScores(el, rows, nameMem, { cols: [['score', cfg.einheit]], empty: 'Noch keine Einträge – sei der Erste!' });
  }
  // Live während dem Spielen: auf welchem Platz wäre die aktuelle Punktzahl?
  function live() {
    var el = cfg && cfg.el.querySelector('.rl-live');
    if (!el) return;
    if (!letzte || jetzt <= 0) { el.innerHTML = ''; return; }
    var platz = 1;
    for (var i = 0; i < letzte.length; i++) if (letzte[i].score >= jetzt && String(letzte[i].name).toLowerCase() !== nameMem.toLowerCase()) platz++;
    el.innerHTML = 'Jetzt: <b>' + jetzt + '</b> ' + esc(cfg.einheit) + ' → ' + (platz > letzte.length && letzte.length >= 50 ? 'noch nicht in den Top 50' : 'Platz <b>' + platz + '</b>');
  }
  function laden() {
    if (!hub()) { info('Die Online-Rangliste gibt es auf langwiligi.site.'); return; }
    window.GameHub.highscores(cfg.game).then(liste, function () { info('Rangliste gerade nicht erreichbar.'); });
  }
  function senden() {
    if (!offen || sende) return;
    var n = name();
    if (!n) { info('Gib einen Namen ein, um <b>' + offen.punkte + '</b> ' + esc(cfg.einheit) + ' einzutragen.'); knopf(true); return; }
    if (!hub()) { info('Eintragen geht nur online auf langwiligi.site.'); offen = null; knopf(false); return; }
    var r = offen; sende = true; knopf(false); info('Trage ein …');
    window.GameHub.submitScore(cfg.game, n, r.punkte, { jumps: r.fortschritt }).then(function (res) {
      sende = false; offen = null;
      liste(res.rows);
      info(res.rank ? 'Platz <b>' + res.rank + '</b> von ' + res.total + ' · dein Bestwert: <b>' + res.best + '</b>' : 'Eingetragen.');
    }, function () {
      sende = false; knopf(true);
      info('Eintragen hat nicht geklappt. Nochmal versuchen?');
    });
  }

  window.Rangliste = {
    init: function (opts) {
      cfg = { game: opts.game, el: opts.el, einheit: opts.einheit || 'Punkte' };
      nameMem = hub() ? window.GameHub.getName() : '';
      cfg.el.innerHTML = '<div class="rl"><div class="rl-kopf">🏆 Rangliste</div>' +
        '<div class="rl-zeile"><input maxlength="16" placeholder="Dein Name" aria-label="Dein Name" value="' + esc(nameMem) + '">' +
        '<button type="button" hidden>Eintragen</button></div><div class="rl-info"></div><div class="rl-live"></div><div class="rl-liste"></div></div>';
      var inp = cfg.el.querySelector('input');
      // Tasten im Namensfeld nicht ans Spiel weitergeben
      ['keydown', 'keyup', 'keypress'].forEach(function (ev) { inp.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') senden(); }); });
      ['touchstart', 'touchend', 'mousedown', 'pointerdown'].forEach(function (ev) { cfg.el.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      inp.addEventListener('change', name);
      cfg.el.querySelector('button').addEventListener('click', senden);
      laden();
    },
    // Aktuelle Punktzahl während dem Spielen (für die Live-Anzeige)
    punkte: function (p) { jetzt = Math.max(0, Math.floor(p || 0)); live(); },
    // Am Ende jeder Runde: Ergebnis melden (nur wenn > 0) und der Webseite das Rundenende sagen
    rundeFertig: function (punkte, fortschritt) {
      if (window.LW && window.LW.rundeFertig) window.LW.rundeFertig();
      punkte = Math.max(0, Math.min(10000000, Math.floor(punkte || 0)));
      if (!cfg || punkte <= 0) return;
      offen = { punkte: punkte, fortschritt: Math.max(0, Math.floor(fortschritt || 0)) };
      senden();
    }
  };
})();
