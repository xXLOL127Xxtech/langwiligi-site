// Seite /updates/: alle Änderungen aus verlauf.json (neueste oben), durchsuchbar und nach Art filterbar
(function () {
  'use strict';
  var REPO = 'https://github.com/xXLOL127Xxtech/langwiligi-site/pull/';
  var $ = function (id) { return document.getElementById(id); };
  var MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var data = [], tag = '', q = '';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(d) { var p = d.split('-'), w = new Date(d + 'T12:00:00').getDay(); return WT[w] + ', ' + (+p[2]) + '. ' + MON[+p[1] - 1] + ' ' + p[0]; }

  function render() {
    var low = q.toLowerCase();
    var rows = data.filter(function (u) {
      return (!tag || u.tag === tag) && (!low || (u.a + ' ' + u.t + ' ' + (u.b || '')).toLowerCase().indexOf(low) >= 0);
    });
    $('vl-count').textContent = '// ' + rows.length + (rows.length === 1 ? ' Änderung' : ' Änderungen');
    if (!rows.length) { $('vl-list').innerHTML = '<p class="upd-load">&gt; nichts gefunden.</p>'; return; }
    var html = '', day = '';
    rows.forEach(function (u) {
      if (u.d !== day) {
        if (day) html += '</ol></section>';
        day = u.d;
        var n = rows.filter(function (r) { return r.d === day; }).length;
        html += '<section class="vl-day"><h2><span>' + esc(fmt(day)) + '</span><small>' + n + (n === 1 ? ' Änderung' : ' Änderungen') + '</small></h2><ol>';
      }
      html += '<li class="vl-e"><time class="vl-z">' + esc(u.z) + '</time><span class="upd-g ' + esc(u.tag.toLowerCase()) + '">' + esc(u.tag) + '</span>' +
        '<p>' + (u.a ? '<b>' + esc(u.a) + '</b> ' : '') + esc(u.t) + '</p>' +
        '<span class="vl-meta">' + (u.pr ? '<a href="' + REPO + u.pr + '" target="_blank" rel="noopener">PR ' + u.pr + '</a>' : '<span>nur Branch</span>') +
        (u.b ? '<span class="vl-b">' + esc(u.b) + '</span>' : '') + '</span></li>';
    });
    $('vl-list').innerHTML = html + '</ol></section>';
  }

  fetch('../_start/verlauf.json?v=' + (document.querySelector('script[src*="verlauf.js"]').src.split('v=')[1] || '1'), { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      data = j;
      var tage = {}, spiele = {}, prs = {};
      j.forEach(function (u) { tage[u.d] = 1; if (u.tag === 'Neu' && /^Neues Spiel/.test(u.t)) spiele[u.a] = 1; if (u.pr) prs[u.pr] = 1; });
      $('vl-hud').innerHTML = '<li><b>' + j.length + '</b><span>Änderungen</span></li><li><b>' + Object.keys(prs).length + '</b><span>Pull Requests</span></li><li><b>' + Object.keys(tage).length + '</b><span>Tage</span></li>';
      render();
    }, function () { $('vl-list').innerHTML = '<p class="upd-load">&gt; fehler: Verlauf konnte nicht geladen werden.</p>'; });

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
