// Seite /updates/: alle Änderungen aus verlauf.json (neueste oben), durchsuchbar und nach Art filterbar
(function () {
  'use strict';
    var $ = function (id) { return document.getElementById(id); };
  var MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var en = window.LW && window.LW.lang === 'en';
  if (en) {
    MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    WT = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }
  var tr = function (s) { return en && window.LW.t ? window.LW.t(s) : s; };
  var wort = function (n) { return en ? (n === 1 ? 'change' : 'changes') : (n === 1 ? 'Änderung' : 'Änderungen'); };
  var data = [], tag = '', q = '';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(d) { var p = d.split('-'), w = new Date(d + 'T12:00:00').getDay(); return en ? WT[w] + ', ' + MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : WT[w] + ', ' + (+p[2]) + '. ' + MON[+p[1] - 1] + ' ' + p[0]; }

  function render() {
    var low = q.toLowerCase();
    var rows = data.filter(function (u) {
      return (!tag || u.tag === tag) && (!low || (u.a + ' ' + u.t + ' ' + (u.k || '')).toLowerCase().indexOf(low) >= 0);
    });
    $('vl-count').textContent = '// ' + rows.length + ' ' + wort(rows.length);
    if (!rows.length) { $('vl-list').innerHTML = '<p class="upd-load">&gt; ' + (en ? 'nothing found.' : 'nichts gefunden.') + '</p>'; return; }
    var html = '', day = '';
    rows.forEach(function (u) {
      if (u.d !== day) {
        if (day) html += '</ol></section>';
        day = u.d;
        var n = rows.filter(function (r) { return r.d === day; }).length;
        html += '<section class="vl-day"><h2><span>' + esc(fmt(day)) + '</span><small>' + n + ' ' + wort(n) + '</small></h2><ol>';
      }
      html += '<li class="vl-e"><time class="vl-z">' + esc(u.z) + '</time><span class="upd-g ' + esc(u.tag.toLowerCase()) + '">' + esc(u.tag) + '</span>' +
        '<p>' + (u.a ? '<b>' + esc(tr(u.a)) + '</b> ' : '') + esc(tr(u.t)) + '</p>' +
        '<span class="vl-meta">' + esc(tr(u.k || '')) + '</span></li>';
    });
    $('vl-list').innerHTML = html + '</ol></section>';
  }

  fetch('../_start/verlauf.json?v=' + (document.querySelector('script[src*="verlauf.js"]').src.split('v=')[1] || '1'), { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      data = j;
      var tage = {}, spiele = {}, prs = {};
      j.forEach(function (u) { tage[u.d] = 1; if (u.tag === 'Neu' && /^Neues Spiel/.test(u.t)) spiele[u.a] = 1; if (u.pr) prs[u.pr] = 1; });
      $('vl-hud').innerHTML = '<li><b>' + j.length + '</b><span>' + (en ? 'Changes' : 'Änderungen') + '</span></li><li><b>' + Object.keys(prs).length + '</b><span>Pull Requests</span></li><li><b>' + Object.keys(tage).length + '</b><span>' + (en ? 'Days' : 'Tage') + '</span></li>';
      render();
    }, function () { $('vl-list').innerHTML = '<p class="upd-load">&gt; ' + (en ? 'error: history could not be loaded.' : 'fehler: Verlauf konnte nicht geladen werden.') + '</p>'; });

  $('vl-q').addEventListener('input', function () { q = this.value.trim(); render(); });
  $('vl-tags').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]'); if (!b) return;
    tag = b.dataset.t;
    Array.prototype.forEach.call($('vl-tags').children, function (c) { c.setAttribute('aria-pressed', c === b); });
    render();
  });
  $('vl-up').addEventListener('click', function (e) { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });
  $('yr').textContent = new Date().getFullYear();
})();
