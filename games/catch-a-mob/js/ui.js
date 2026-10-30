'use strict';
// Catch a Mob – Oberfläche: Fenster, Auswahlmenüs per Tastatur oder Touchpad-Klick, Meldungen, Ton.
(function (G) {
  const CAM = G.CAM;
  const $ = id => document.getElementById(id);
  const UI = CAM.UI = { stack: [], keysDown: {}, sayResolve: null, card: null, muted: false };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.esc = esc; UI.$ = $;

  // ---------- Tasten ----------
  UI.pushKeys = fn => UI.stack.push(fn);
  UI.popKeys = fn => { const i = UI.stack.lastIndexOf(fn); if (i >= 0) UI.stack.splice(i, 1); };
  UI.worldKey = null;       // setzt das Spiel
  const isField = e => e.target && e.target.matches && e.target.matches('input,textarea');
  document.addEventListener('keydown', e => {
    UI.entsperrenTon();
    if (isField(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (UI.stack.length) { const h = UI.stack[UI.stack.length - 1]; if (h(e) !== false) e.preventDefault(); return; }
    if (UI.sayResolve && (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E')) { e.preventDefault(); const r = UI.sayResolve; UI.sayResolve = null; r(); return; }
    const k = e.key.toLowerCase();
    UI.keysDown[k] = true;
    if (UI.worldKey && UI.worldKey(e, k)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { UI.keysDown[e.key.toLowerCase()] = false; });
  G.addEventListener('blur', () => { UI.keysDown = {}; });

  // Die Auswahl folgt dem Mauszeiger nur, wenn er wirklich bewegt wird. Öffnet sich ein Menü unter dem ruhenden Zeiger
  // (Touchpad liegt still), bleibt die vorgesehene Auswahl stehen, sonst würde Enter etwas anderes wählen als gedacht.
  UI.mausT = 0;
  document.addEventListener('mousemove', e => { if (e.movementX || e.movementY) UI.mausT = performance.now(); }, true);
  UI.mausSeit = t => UI.mausT > t;

  // ---------- Erklärung beim Darüberfahren (Elemente mit data-tip) ----------
  const tip = document.createElement('div'); tip.id = 'tip'; tip.className = 'hidden'; document.body.appendChild(tip);
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.classList.add('hidden'); return; }
    tip.textContent = t.getAttribute('data-tip'); tip.classList.remove('hidden');
    const r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(G.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = (r.top - h - 8 < 4 ? r.bottom + 8 : r.top - h - 8) + 'px';
  });
  document.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  UI.tipZeigen = (text, x, y) => { tip.textContent = text; tip.classList.remove('hidden'); const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(G.innerWidth - w - 8, x - w / 2)) + 'px'; tip.style.top = Math.max(4, y - h - 14) + 'px'; };
  UI.tipVerstecken = () => tip.classList.add('hidden');

  // ---------- Fenster ----------
  UI.openPanel = function (title, sub, wide) {
    const box = $('panel-box');
    box.className = wide ? 'wide' : '';
    box.innerHTML = (title ? '<h2>' + esc(title) + '</h2>' : '') + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '<div id="panel-body"></div>';
    $('panel').classList.remove('hidden');
    return $('panel-body');
  };
  UI.closePanel = function () { $('panel').classList.add('hidden'); $('panel-box').innerHTML = ''; };
  UI.panelOffen = () => !$('panel').classList.contains('hidden');

  // Auswahl: items = [{ label, sub, disabled }] -> Nummer oder -1 (Esc)
  UI.choose = function (items, opt) {
    opt = opt || {};
    return new Promise(res => {
      const host = opt.into || UI.openPanel(opt.title, opt.sub, opt.wide);
      host.innerHTML = opt.before || '';
      const list = document.createElement('div'); list.className = 'list' + (opt.cols === 2 ? ' two' : '');
      host.appendChild(list);
      let sel = Math.max(0, Math.min(items.length - 1, opt.start || 0));
      const t0 = performance.now();
      if (items[sel] && items[sel].disabled) sel = Math.max(0, items.findIndex(x => !x.disabled));
      const btns = items.map((it, i) => {
        const b = document.createElement('button');
        b.className = 'it' + (it.disabled ? ' dis' : '');
        b.innerHTML = '<span class="lb">' + (opt.numbers !== false && i < 9 && items.length <= 9 ? '<small style="color:#8e89a8">' + (i + 1) + '</small> ' : '') + (it.ico === undefined ? (CAM.Icons ? CAM.Icons.fuerLabel(it.label) : '') : it.ico) + it.label + '</span>' + (it.sub ? '<span class="sb">' + it.sub + '</span>' : '');
        b.onclick = () => { if (!it.disabled) { UI.snd('klick'); done(i); } };
        b.onmouseenter = b.onmousemove = () => { if (sel !== i && UI.mausSeit(t0)) setSel(i); };
        list.appendChild(b); return b;
      });
      if (opt.after) { const f = document.createElement('div'); f.className = 'foot'; f.innerHTML = opt.after; host.appendChild(f); }
      function setSel(i) { sel = i; btns.forEach((b, j) => b.classList.toggle('sel', j === sel)); if (btns[sel]) btns[sel].scrollIntoView({ block: 'nearest' }); if (opt.onSel) opt.onSel(sel); }
      function move(d) {
        if (!items.length) return;
        let n = sel;
        for (let k = 0; k < items.length; k++) { n = (n + d + items.length) % items.length; if (!items[n].disabled) break; }
        setSel(n);
        UI.snd('tick');
      }
      // Live-Anzeige (z. B. Zähler, die herunterlaufen): opt.live() liefert pro Eintrag { sub, disabled }
      let liveIv = null;
      if (opt.live) liveIv = setInterval(() => {
        const u = opt.live(); if (!u) return;
        u.forEach((x, i) => {
          if (!x || !items[i]) return;
          if (x.sub !== undefined && x.sub !== items[i].sub) { items[i].sub = x.sub; let sb = btns[i].querySelector('.sb'); if (!sb) { sb = document.createElement('span'); sb.className = 'sb'; btns[i].appendChild(sb); } sb.innerHTML = x.sub; }
          if (x.disabled !== undefined && x.disabled !== !!items[i].disabled) { items[i].disabled = x.disabled; btns[i].classList.toggle('dis', x.disabled); if (!x.disabled) UI.snd('heil'); }
        });
      }, 1000);
      function done(v) { if (liveIv) clearInterval(liveIv); UI.popKeys(h); if (!opt.into && !opt.keep) UI.closePanel(); res(v); }
      const h = e => {
        const k = e.key, two = opt.cols === 2;
        if (k === 'ArrowDown' || k === 's' || k === 'S') move(two ? 2 : 1);
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') move(two ? -2 : -1);
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
        else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') { if (items[sel] && !items[sel].disabled) { UI.snd('klick'); done(sel); } }
        else if ((k === 'Escape' || k === 'Backspace' || k === 'q' || k === 'Q') && !opt.nocancel) { done(-1); }
        else if (/^[1-9]$/.test(k) && items.length <= 9) { const i = +k - 1; if (items[i] && !items[i].disabled) done(i); }
        else if (opt.onKey && opt.onKey(e, sel, done) === false) return false;
        return true;
      };
      UI.pushKeys(h);
      setSel(sel);
      if (opt.abort) opt.abort(() => { if (UI.stack.includes(h)) done(-2); });
    });
  };
  UI.info = (text, title, btn) => UI.choose([{ label: btn || 'Weiter' }], { title: title || '', before: '<p>' + text + '</p>', nocancel: false, numbers: false }).then(() => {});
  UI.confirm = (text, title, yes, no) => UI.choose([{ label: yes || 'Ja' }, { label: no || 'Nein' }], { title: title || '', before: '<p>' + text + '</p>', numbers: false, start: 1 }).then(i => i === 0);

  // Grosse Schrift über dem Bildschirm (z. B. «ÜBERFALL!»), wartet bis sie wieder weg ist
  UI.banner = function (text, ms, farbe) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'banner'; d.textContent = text; if (farbe) d.style.color = farbe;
      document.body.appendChild(d); UI.snd('ruf');
      setTimeout(() => { d.remove(); res(); }, ms || 1400);
    });
  };

  UI.toast = function (text, ms) {
    const t = document.createElement('div'); t.textContent = text; $('toast').appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  };

  // Einladungskarten (J = ja, N = nein)
  UI.addCard = function (html, sekunden, onYes, onNo, onCounter) {
    const c = document.createElement('div'); c.className = 'card';
    const obj = { el: c, done: false, yes() { fin(true); }, no() { fin(false); }, counter: onCounter ? () => { if (obj.done) return; obj.done = true; clearInterval(iv); c.remove(); UI.cards = UI.cards.filter(x => x !== obj); onCounter(); } : null };
    function fin(v) { if (obj.done) return; obj.done = true; clearInterval(iv); c.remove(); UI.cards = UI.cards.filter(x => x !== obj); (v ? onYes : onNo) && (v ? onYes() : onNo()); }
    let left = sekunden;
    const draw = () => { c.innerHTML = html + ' <span style="color:#a9a59b">(' + left + ' s)</span><br><kbd>J</kbd> Ja &nbsp; <kbd>N</kbd> Nein' + (onCounter ? ' &nbsp; <kbd>G</kbd> Gegenangebot' : ''); };
    draw();
    const iv = setInterval(() => { left--; if (left <= 0) fin(false); else draw(); }, 1000);
    $('cards').appendChild(c); UI.cards.push(obj);
    return obj;
  };
  UI.cards = [];

  // ---------- Kampf-Text ----------
  UI.log = function (html, html2) {
    $('blog').innerHTML = '<div>' + html + '</div>' + (html2 ? '<div class="t2">' + html2 + '</div>' : '');
  };
  UI.say = function (text, ms, html2) {
    UI.log(esc(text), html2);
    return new Promise(res => {
      let t;
      const fin = () => { clearTimeout(t); if (UI.sayResolve === fin) UI.sayResolve = null; res(); };
      UI.sayResolve = fin;
      t = setTimeout(fin, ms || 1100);
    });
  };
  $('bbar').addEventListener('click', () => { if (UI.sayResolve) { const r = UI.sayResolve; UI.sayResolve = null; r(); } });

  // ---------- Ton ----------
  let ac = null;
  UI.entsperrenTon = function () { if (CAM.Musik) CAM.Musik.entsperren(); if (!ac) { try { ac = new (G.AudioContext || G.webkitAudioContext)(); } catch (e) { ac = false; } } else if (ac && ac.state === 'suspended') ac.resume(); };
  function ton(f, d, typ, vol, delay, glide) {
    if (!ac || UI.muted) return;
    const t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = typ || 'square'; o.frequency.setValueAtTime(f, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + d);
    g.gain.setValueAtTime((vol || 0.05), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02);
  }
  UI.snd = function (n) {
    switch (n) {
      case 'tick': ton(520, 0.04, 'square', 0.025); break;
      case 'klick': ton(760, 0.07, 'square', 0.04); break;
      case 'treffer': ton(160, 0.16, 'sawtooth', 0.07, 0, 60); break;
      case 'stark': ton(220, 0.22, 'sawtooth', 0.09, 0, 50); break;
      case 'heil': ton(440, 0.12, 'triangle', 0.06); ton(660, 0.16, 'triangle', 0.06, 0.1); break;
      case 'fang': [520, 660, 780, 1040].forEach((f, i) => ton(f, 0.14, 'triangle', 0.06, i * 0.12)); break;
      case 'stufe': [440, 554, 660, 880].forEach((f, i) => ton(f, 0.16, 'square', 0.05, i * 0.1)); break;
      case 'kampf': ton(200, 0.3, 'sawtooth', 0.06, 0, 400); ton(150, 0.3, 'sawtooth', 0.06, 0.12, 300); break;
      case 'sieg': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => ton(f, 0.18, 'square', 0.05, i * 0.13)); break;
      case 'niederlage': [330, 262, 196].forEach((f, i) => ton(f, 0.3, 'triangle', 0.07, i * 0.2)); break;
      case 'platsch': ton(260, 0.12, 'sine', 0.05, 0, 520); ton(180, 0.2, 'triangle', 0.04, 0.05, 90); break;
      case 'blubb': ton(420, 0.08, 'sine', 0.04, 0, 900); ton(520, 0.08, 'sine', 0.035, 0.09, 1000); break;
      case 'schritt': ton(90, 0.04, 'triangle', 0.02); break;
      case 'geld': ton(990, 0.06, 'square', 0.04); ton(1320, 0.1, 'square', 0.04, 0.06); break;
      case 'ruf': ton(880, 0.1, 'triangle', 0.05); ton(1175, 0.14, 'triangle', 0.05, 0.1); break;
      case 'schwung': ton(300, 0.16, 'sawtooth', 0.025, 0, 900); break;
      case 'beben': ton(70, 0.5, 'sawtooth', 0.09, 0, 35); ton(55, 0.5, 'square', 0.05, 0.05, 30); break;
      case 'status': ton(500, 0.12, 'triangle', 0.05, 0, 250); ton(300, 0.2, 'triangle', 0.05, 0.1, 150); break;
      case 'niederlage2': ton(260, 0.35, 'sawtooth', 0.06, 0, 70); break;
      case 'einsaugen': ton(1200, 0.4, 'sine', 0.05, 0, 250); break;
      case 'platzen': ton(200, 0.15, 'square', 0.06, 0, 900); ton(900, 0.2, 'triangle', 0.05, 0.05, 300); break;
      case 'el_Feuer': ton(180, 0.25, 'sawtooth', 0.08, 0, 520); ton(900, 0.1, 'square', 0.03, 0.03, 200); break;
      case 'el_Wasser': ton(700, 0.2, 'sine', 0.08, 0, 220); ton(350, 0.2, 'sine', 0.05, 0.05, 160); break;
      case 'el_Pflanze': ton(420, 0.09, 'triangle', 0.07); ton(300, 0.14, 'sawtooth', 0.05, 0.05, 140); break;
      case 'el_Erde': ton(95, 0.28, 'square', 0.1, 0, 45); break;
      case 'el_Luft': ton(1100, 0.2, 'triangle', 0.05, 0, 400); ton(700, 0.18, 'sine', 0.04, 0.05, 300); break;
      case 'el_Licht': ton(1320, 0.12, 'sine', 0.06); ton(1760, 0.2, 'sine', 0.05, 0.06); break;
      case 'el_Schatten': ton(140, 0.3, 'sawtooth', 0.08, 0, 60); ton(95, 0.3, 'triangle', 0.06, 0.1); break;
      case 'el_Normal': ton(170, 0.14, 'square', 0.09, 0, 70); break;
    }
  };
})(window);
