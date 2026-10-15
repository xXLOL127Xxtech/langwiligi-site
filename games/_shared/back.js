// "Alle Spiele"-Knopf am linken Rand: führt zurück zur Startseite (wird von deploy.sh in jedes Spiel eingebunden)
(function () {
  if (document.getElementById('lw-back')) return;
  var css = document.createElement('style');
  css.textContent =
    '#lw-back{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147483000;display:flex;align-items:center;gap:6px;' +
    'height:40px;padding:0 13px 0 9px;border-radius:0 4px 4px 0;background:rgba(23,21,15,.86);border:2px solid rgba(240,236,226,.5);' +
    'border-left:0;box-shadow:0 4px 18px rgba(0,0,0,.35);color:#f0ece2;font:700 14px system-ui,-apple-system,"Segoe UI",sans-serif;' +
    'white-space:nowrap;text-decoration:none;opacity:.92;transition:opacity .2s,background .2s,padding .2s;-webkit-tap-highlight-color:transparent}' +
    '#lw-back:hover,#lw-back:focus-visible{opacity:1;background:rgba(23,21,15,.97);padding-left:13px;outline:none}' +
    '#lw-back svg{width:18px;height:18px;flex:none;color:#ff5541}' +
    '#lw-back span{display:inline-block;max-width:90px;overflow:hidden;transition:max-width .3s}' +
    // Kleine Bildschirme: Text nur kurz nach dem Laden und beim Drüberfahren, sonst nur der Pfeil (verdeckt sonst Spiel-Knöpfe)
    '@media (max-width:1099px),(max-height:649px){#lw-back:not(.lw-intro):not(:hover):not(:focus-visible){gap:0;padding-right:10px}' +
    '#lw-back:not(.lw-intro):not(:hover):not(:focus-visible) span{max-width:0}}';
  var a = document.createElement('a');
  a.id = 'lw-back';
  a.className = 'lw-intro';
  setTimeout(function () { a.className = ''; }, 4000);
  a.href = '../';
  a.title = 'Zurück zur Übersicht mit allen Spielen';
  a.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M16 10H5m4-4-4 4 4 4"/></svg><span>Alle Spiele</span>';
  // Klicks nicht ans Spiel weitergeben (z.B. Maus fangen bei Bogen-Duell)
  ['mousedown', 'pointerdown', 'touchstart'].forEach(function (ev) {
    a.addEventListener(ev, function (e) { e.stopPropagation(); });
  });
  function add() { document.head.appendChild(css); document.body.appendChild(a); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
