// Startseite: Intro, Filter, Sortierung, Bewertungen, Spotlight, "Spiel empfehlen"
(function () {
  'use strict';
  // Solange langwiligi.site gesperrt ist, läuft die Seite direkt über die IP des Servers (ohne HTTPS)
  var API = /^https?:$/.test(location.protocol) && /(^|\.)langwiligi\.site$|^46\.224\.94\.231$/.test(location.hostname) ? '/api' : 'http://46.224.94.231/api';
  var NEW_COUNT = 3;   // so viele zuletzt hochgeladene Spiele gelten als "Neu"
  var $ = function (id) { return document.getElementById(id); };
  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var grid = $('grid');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var stats = {};   // slug -> { avg, count, week }

  cards.forEach(function (c, i) { c.style.setProperty('--i', Math.min(i, 14)); });
  // Nur die zuletzt hochgeladenen Spiele bekommen das "Neu"-Schild
  cards.slice().sort(byNew).slice(0, NEW_COUNT).forEach(function (c) { c.classList.add('is-new'); });

  // ---------- Intro ----------
  var intro = $('intro');
  if (document.documentElement.classList.contains('intro-on')) {
    var end = function () {
      intro.classList.add('done');
      document.documentElement.classList.remove('intro-on');
    };
    var timer = setTimeout(end, 3250);
    var skip = function () {
      clearTimeout(timer);
      intro.classList.add('skipped');
      cards.forEach(function (c) { c.style.animationDelay = '0s'; });
      setTimeout(end, 260);
      removeEventListener('keydown', skip);
    };
    intro.addEventListener('click', skip);
    addEventListener('keydown', skip);
  }

  // ---------- Filter (Modus + Typ, je ein Ausklapp-Menü) + Sortierung ----------
  // Typen: gleiche Liste wie in tools/spiel-pruefen.js. Schlüssel = Name klein geschrieben.
  var TYPEN = ['3D', 'Pixel-Art', 'Action', 'Strategie', 'Klassiker', 'Denkspiel', 'Geschick', 'Physik', 'Rennen', 'Party', 'Aufbau'];
  var MODI = { alle: 'Alle', lokal: 'Lokal', online: 'Online', bots: 'Gegen Bots', solo: 'Solo' };
  var filter = load('lw-filter', 'alle'), typ = load('lw-typ', 'alle'), sort = load('lw-sort', 'neu');
  var sortBtns = document.querySelectorAll('.sort button[data-s]');
  var dds = Array.prototype.slice.call(document.querySelectorAll('.filters .dd'));
  var ddMode = document.querySelector('.dd[data-key="f"]'), ddTyp = document.querySelector('.dd[data-key="t"]');
  function typesOf(c) { return (c.dataset.typ || '').split(' ').filter(Boolean); }
  function modeOk(c, f) { return c.dataset.filter.split(' ').indexOf(f) >= 0; }
  function typOk(c, t) { return t === 'alle' || typesOf(c).indexOf(t) >= 0; }
  // Typ-Menü aus den vorhandenen Spielen bauen (nur Typen, die es auch gibt)
  (function () {
    var menu = ddTyp.querySelector('.dd-menu'), have = {};
    cards.forEach(function (c) { typesOf(c).forEach(function (t) { have[t] = 1; }); });
    var html = '<button type="button" role="menuitemradio" data-v="alle">Alle Typen</button>';
    TYPEN.forEach(function (name) { var k = name.toLowerCase(); if (have[k]) html += '<button type="button" role="menuitemradio" data-v="' + k + '">' + name + '</button>'; });
    menu.innerHTML = html;
  })();
  function typName(k) { for (var i = 0; i < TYPEN.length; i++) if (TYPEN[i].toLowerCase() === k) return TYPEN[i]; return 'Alle'; }
  if (!MODI[filter]) filter = 'alle';
  if (typ !== 'alle' && !ddTyp.querySelector('[data-v="' + typ + '"]')) typ = 'alle';
  if (sort !== 'neu' && sort !== 'top') sort = 'neu';

  // Menüs auf- und zuklappen
  function openDd(dd, open, focus) {
    var btn = dd.querySelector('.dd-btn'), menu = dd.querySelector('.dd-menu');
    btn.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    dd.classList.toggle('open', open);
    if (open && focus) { var cur = menu.querySelector('[aria-checked="true"]') || menu.querySelector('button'); cur.focus(); }
  }
  function closeAll(except) { dds.forEach(function (d) { if (d !== except) openDd(d, false); }); }
  dds.forEach(function (dd) {
    var btn = dd.querySelector('.dd-btn'), menu = dd.querySelector('.dd-menu');
    btn.addEventListener('click', function () { var o = menu.hidden; closeAll(dd); openDd(dd, o, false); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeAll(dd); openDd(dd, true, true); }
    });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b) return;
      if (dd === ddMode) { filter = b.dataset.v; save('lw-filter', filter); } else { typ = b.dataset.v; save('lw-typ', typ); }
      openDd(dd, false); btn.focus();
      apply(true);
    });
    menu.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('button')), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { openDd(dd, false); btn.focus(); }
      else if (e.key === 'Tab') openDd(dd, false);
    });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) closeAll(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  $('reset').addEventListener('click', function () { filter = 'alle'; typ = 'alle'; save('lw-filter', filter); save('lw-typ', typ); apply(true); });

  // Häkchen, Anzahl pro Eintrag und Beschriftung der Menüknöpfe
  function updateMenus() {
    ddMode.querySelectorAll('.dd-menu button').forEach(function (b) {
      var v = b.dataset.v, n = cards.filter(function (c) { return modeOk(c, v) && typOk(c, typ); }).length;
      b.setAttribute('aria-checked', v === filter);
      b.dataset.n = n; b.disabled = !n && v !== filter;
    });
    ddTyp.querySelectorAll('.dd-menu button').forEach(function (b) {
      var v = b.dataset.v, n = cards.filter(function (c) { return modeOk(c, filter) && typOk(c, v); }).length;
      b.setAttribute('aria-checked', v === typ);
      b.dataset.n = n; b.disabled = !n && v !== typ;
    });
    ddMode.querySelector('.dd-v').textContent = MODI[filter];
    ddTyp.querySelector('.dd-v').textContent = typ === 'alle' ? 'Alle' : typName(typ);
    ddMode.classList.toggle('set', filter !== 'alle');
    ddTyp.classList.toggle('set', typ !== 'alle');
    $('reset').hidden = filter === 'alle' && typ === 'alle';
  }

  function score(slug) {
    // Mittelwert mit "Vorschuss": wenige Bewertungen zählen weniger stark als viele
    var s = stats[slug];
    if (!s || !s.count) return -1;
    return (s.avg * s.count + 3.5 * 3) / (s.count + 3);
  }
  function byNew(a, b) { return (+b.dataset.added || 0) - (+a.dataset.added || 0) || a.dataset.title.localeCompare(b.dataset.title, 'de'); }
  function byTop(a, b) { return score(b.dataset.slug) - score(a.dataset.slug) || byNew(a, b); }

  function apply(animate) {
    updateMenus();
    sortBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.s === sort); });
    // Positionen merken, umsortieren, dann sanft an den neuen Platz gleiten (FLIP)
    var before = animate ? cards.map(function (c) { return c.hidden ? null : c.getBoundingClientRect(); }) : null;
    var shown = 0;
    cards.forEach(function (c) {
      c.hidden = !modeOk(c, filter) || !typOk(c, typ);
      if (!c.hidden) shown++;
    });
    cards.slice().sort(sort === 'top' ? byTop : byNew).forEach(function (c) { grid.appendChild(c); });
    $('count').textContent = '// ' + shown + (shown === 1 ? ' Spiel' : ' Spiele') +
      (filter !== 'alle' ? ' · ' + MODI[filter] : '') + (typ !== 'alle' ? ' · ' + typName(typ) : '') +
      (sort === 'top' ? ' · nach Bewertung' : ' · neueste zuerst');
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cards.forEach(function (c, i) {
      var r0 = before[i];
      if (!r0 || c.hidden) return;
      var r1 = c.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (!dx && !dy) return;
      c.style.animation = 'none';
      c.style.transition = 'none';
      c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () {
        c.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
        c.style.transform = '';
        setTimeout(function () { c.style.transition = ''; }, 520);
      });
    });
  }
  sortBtns.forEach(function (b) {
    b.addEventListener('click', function () { if (sort === b.dataset.s) return; sort = b.dataset.s; save('lw-sort', sort); apply(true); });
  });
  apply(false);

  // Werkzeugleiste bekommt eine Linie, sobald sie oben klebt
  var bar = document.querySelector('.toolbar');
  if ('IntersectionObserver' in window) {
    var mark = document.createElement('div');
    bar.parentNode.insertBefore(mark, bar);
    new IntersectionObserver(function (e) { bar.classList.toggle('stuck', !e[0].isIntersecting); }).observe(mark);
  }

  // ---------- Bewertungen auf den Karten ----------
  function showRatings() {
    cards.forEach(function (c) {
      var s = stats[c.dataset.slug], el = c.querySelector('.rating');
      if (!el) return;
      if (s && s.count) {
        el.innerHTML = '<span class="stars" style="--r:' + s.avg + '"></span><b>' + s.avg.toFixed(1) + '</b><span>(' + s.count + ')</span>';
        el.setAttribute('aria-label', s.avg.toFixed(1) + ' von 5 Sternen, ' + s.count + ' Bewertungen');
      } else {
        el.innerHTML = '<span class="stars"></span><span>Noch keine Bewertung</span>';
      }
    });
  }

  // ---------- Spotlight: neu, trendet oder top bewertet, wechselt alle paar Sekunden ----------
  var spot = $('spot'), slides = [], cur = -1, spotTimer = null, paused = false, SPOT_MS = 6500;
  function slug(c) { return c.dataset.slug; }
  function buildSlides() {
    var bySlug = {}, out = [], seen = {};
    cards.forEach(function (c) { bySlug[slug(c)] = c; });
    function add(c, tag) { if (c && !seen[slug(c)]) { seen[slug(c)] = 1; out.push({ card: c, tag: tag }); } }
    var newest = cards.slice().sort(byNew);
    var fresh = newest.filter(function (c) { return c.classList.contains('is-new'); });
    var trend = Object.keys(stats).filter(function (k) { return bySlug[k] && stats[k].week >= 3; })
      .sort(function (a, b) { return stats[b].week - stats[a].week; }).slice(0, 3);
    var top = Object.keys(stats).filter(function (k) { return bySlug[k] && stats[k].count >= 3 && stats[k].avg >= 3.5; })
      .sort(function (a, b) { return score(b) - score(a); }).slice(0, 2);
    // abwechselnd mischen: neu, trendet, top, neu, ...
    for (var i = 0; i < 3; i++) {
      add(fresh[i], 'Neu');
      add(bySlug[trend[i]], 'Trendet');
      add(bySlug[top[i]], 'Top bewertet');
    }
    // Zu wenig? Mit neuesten und zufälligen Spielen auffüllen
    newest.slice(0, 3).forEach(function (c) { add(c, 'Neu'); });
    var rest = cards.filter(function (c) { return !seen[slug(c)]; });
    while (out.length < 5 && rest.length) add(rest.splice(Math.floor(Math.random() * rest.length), 1)[0], 'Entdecken');
    return out.slice(0, 7);
  }
  function show(i, instant) {
    if (!slides.length) return;
    cur = (i + slides.length) % slides.length;
    var s = slides[cur], c = s.card;
    var img = c.querySelector('.cover img');
    var put = function () {
      spot.style.setProperty('--c', c.style.getPropertyValue('--c'));
      $('spot-tag').textContent = s.tag;
      $('spot-link').href = c.getAttribute('href');
      $('spot-title').textContent = c.dataset.title;
      $('spot-desc').textContent = c.querySelector('.info p').textContent;
      var si = $('spot-img');
      if (img) { si.src = img.getAttribute('src'); si.hidden = false; } else { si.removeAttribute('src'); si.hidden = true; }
      Array.prototype.forEach.call($('spot-dots').children, function (d, k) { d.setAttribute('aria-current', k === cur); });
      spot.classList.remove('switching');
      restartBar();
    };
    if (instant) return put();
    spot.classList.add('switching');
    // Bild vorladen, damit beim Einblenden nichts springt
    var pre = new Image();
    var go = function () { setTimeout(put, 320); };
    if (img) { pre.onload = pre.onerror = go; pre.src = img.getAttribute('src'); } else go();
  }
  var barEl = $('spot-bar'), barAnim = null;
  function restartBar() {
    clearTimeout(spotTimer);
    if (barAnim) barAnim.cancel();
    if (barEl.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      barAnim = barEl.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: SPOT_MS, easing: 'linear', fill: 'forwards' });
      if (paused) barAnim.pause();
      barAnim.onfinish = function () { show(cur + 1); };
    } else {
      spotTimer = setTimeout(function () { show(cur + 1); }, SPOT_MS);
    }
  }
  function startSpot() {
    slides = buildSlides();
    if (!slides.length) return;
    var dots = $('spot-dots');
    dots.innerHTML = '';
    slides.forEach(function (s, k) {
      var d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', s.card.dataset.title);
      d.addEventListener('click', function () { show(k); });
      dots.appendChild(d);
    });
    spot.hidden = false;
    // Jeder Besuch startet woanders, damit nicht immer dasselbe Spiel vorne steht
    show(Math.floor(Math.random() * slides.length), true);
  }
  spot.addEventListener('mouseenter', function () { paused = true; if (barAnim) barAnim.pause(); });
  spot.addEventListener('mouseleave', function () { paused = false; if (barAnim) barAnim.play(); });
  document.addEventListener('visibilitychange', function () {
    if (!barAnim) return;
    if (document.hidden) barAnim.pause(); else if (!paused) barAnim.play();
  });

  // Zahlen vom Server holen. Klappt das nicht, läuft alles trotzdem (Spotlight dann mit neuen/zufälligen Spielen).
  var done = false;
  function ready() { if (done) return; done = true; showRatings(); if (sort === 'top') apply(false); startSpot(); }
  setTimeout(ready, 2500);
  fetch(API + '/spiele', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) { if (d && typeof d === 'object') stats = d; }, function () {})
    .then(function () { if (done) { showRatings(); if (sort === 'top') apply(true); } else ready(); });

  // ---------- Besuch zählen (nur eine Zahl pro Tag, keine Cookies) -> /api/aufruf ----------
  if (API === '/api') {
    fetch(API + '/aufruf', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ seite: 'start' }) }).catch(function () {});
  }

  // ---------- Spiel empfehlen -> /api/empfehlung ----------
  // ---------- Updates: Liste aus _start/updates.json, "neu"-Marke solange das neuste Datum noch nicht gesehen wurde ----------
  (function () {
    var dlg = $('upd'), list = $('upd-list'), mark = $('upd-new'), data = null, KEY = 'lw-upd-seen';
    if (!dlg) return;
    var MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    function fmt(d) { var p = d.split('-'); return +p[2] + '. ' + MON[+p[1] - 1] + ' ' + p[0]; }
    function ago(d) {
      var n = Math.round((new Date(new Date().toISOString().slice(0, 10)) - new Date(d)) / 864e5);
      return n <= 0 ? 'heute' : n === 1 ? 'gestern' : 'vor ' + n + ' Tagen';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function show() {
      list.innerHTML = data.map(function (u) {
        return '<article class="upd-e"><div class="upd-h"><span class="upd-d">' + esc(fmt(u.d)) + '</span><span class="upd-ago">' + esc(ago(u.d)) + '</span>' +
          '<span class="upd-g ' + esc((u.tag || '').toLowerCase()) + '">' + esc(u.tag || 'Update') + '</span></div>' +
          '<div class="upd-t">' + esc(u.t) + '</div><ul>' + u.p.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></article>';
      }).join('');
    }
    function laden() {
      return data ? Promise.resolve(data) : fetch('_start/updates.json?v=' + VER, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { data = j; return j; });
    }
    var VER = (document.querySelector('script[src*="start.js"]').src.split('v=')[1] || '1');
    function gesehen() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
    laden().then(function (j) { if (j.length && j[0].d > gesehen()) mark.hidden = false; }, function () {});
    $('upd-open').addEventListener('click', function () {
      dlg.showModal();
      laden().then(function () { show(); if (data.length) { try { localStorage.setItem(KEY, data[0].d); } catch (e) {} mark.hidden = true; } },
        function () { list.innerHTML = '<p class="upd-load">&gt; fehler: Updates konnten nicht geladen werden.</p>'; });
    });
    $('upd-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  })();

  var tip = $('tip'), form = $('tip-form'), msg = $('tip-msg');
  var send = form.querySelector('[type="submit"]');
  function say(text, cls) { msg.textContent = text; msg.className = cls || ''; }
  $('tip-open').addEventListener('click', function () {
    try { if (!form.player.value) form.player.value = localStorage.getItem('lw-name') || ''; } catch (e) {}
    say(''); send.disabled = false; tip.showModal(); form.game.focus();
  });
  $('tip-close').addEventListener('click', function () { tip.close(); });
  tip.addEventListener('click', function (e) { if (e.target === tip) tip.close(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = { game: form.game.value.trim(), note: form.note.value.trim(), name: form.player.value.trim() };
    if (!data.game) return say('Bitte gib ein Spiel oder eine Idee ein.', 'err');
    send.disabled = true; say('Wird gesendet …');
    fetch(API + '/empfehlung', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data) })
      .then(function (r) {
        if (r.status === 429) throw new Error('fast');
        if (!r.ok) throw new Error('http');
        form.game.value = ''; form.note.value = '';
        say('Danke! Dein Wunsch ist angekommen.', 'ok');
        send.disabled = false;
      })
      .catch(function (err) {
        say(err.message === 'fast' ? 'Kurz warten, dann nochmal versuchen.' : 'Hat nicht geklappt. Bitte später nochmal versuchen.', 'err');
        send.disabled = false;
      });
  });
})();
