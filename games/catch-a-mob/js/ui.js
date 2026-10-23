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
      if (items[sel] && items[sel].disabled) sel = Math.max(0, items.findIndex(x => !x.disabled));
      const btns = items.map((it, i) => {
        const b = document.createElement('button');
        b.className = 'it' + (it.disabled ? ' dis' : '');
        b.innerHTML = '<span class="lb">' + (opt.numbers !== false && i < 9 && items.length <= 9 ? '<small style="color:#8e89a8">' + (i + 1) + '</small> ' : '') + it.label + '</span>' + (it.sub ? '<span class="sb">' + it.sub + '</span>' : '');
        b.onclick = () => { if (!it.disabled) { UI.snd('klick'); done(i); } };
        b.onmouseenter = () => setSel(i);
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
      function done(v) { UI.popKeys(h); if (!opt.into && !opt.keep) UI.closePanel(); res(v); }
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

  UI.toast = function (text, ms) {
    const t = document.createElement('div'); t.textContent = text; $('toast').appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  };

  // Einladungskarten (J = ja, N = nein)
  UI.addCard = function (html, sekunden, onYes, onNo) {
    const c = document.createElement('div'); c.className = 'card';
    const obj = { el: c, done: false, yes() { fin(true); }, no() { fin(false); } };
    function fin(v) { if (obj.done) return; obj.done = true; clearInterval(iv); c.remove(); UI.cards = UI.cards.filter(x => x !== obj); (v ? onYes : onNo) && (v ? onYes() : onNo()); }
    let left = sekunden;
    const draw = () => { c.innerHTML = html + ' <span style="color:#a9a59b">(' + left + ' s)</span><br><kbd>J</kbd> Ja &nbsp; <kbd>N</kbd> Nein'; };
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
  UI.entsperrenTon = function () { if (!ac) { try { ac = new (G.AudioContext || G.webkitAudioContext)(); } catch (e) { ac = false; } } else if (ac && ac.state === 'suspended') ac.resume(); };
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
      case 'schritt': ton(90, 0.04, 'triangle', 0.02); break;
      case 'geld': ton(990, 0.06, 'square', 0.04); ton(1320, 0.1, 'square', 0.04, 0.06); break;
      case 'ruf': ton(880, 0.1, 'triangle', 0.05); ton(1175, 0.14, 'triangle', 0.05, 0.1); break;
    }
  };
})(window);
