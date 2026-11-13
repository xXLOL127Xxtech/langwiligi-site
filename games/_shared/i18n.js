// Übersetzung Deutsch -> Englisch für die ganze Seite (Startseite, Updates-Seite und alle Spiele).
//
// So funktioniert es: Die Seiten bleiben auf Deutsch geschrieben. Wer «English» gewählt hat (localStorage "lw-lang" = "en"),
// bekommt jeden Text, der auf die Seite kommt, per Wörterbuch übersetzt: Textknoten, Attribute (title, placeholder, alt, aria-label ...),
// der Seitentitel und Text, der in ein <canvas> gezeichnet wird. Die Spiellogik sieht davon nichts (ihre Texte im Code bleiben deutsch).
//
// Wörterbücher (JSON, Schlüssel = deutscher Text, Wert = englischer Text) liegen in games/_shared/i18n/:
//   common.en.json      Texte, die auf allen Seiten vorkommen (Zurück-Knopf, Freunde, Bewertung, Namen der Spiele ...)
//   <seite>.en.json     Texte einer Seite: "start" (Startseite), "updates" (Updates-Seite) oder die Spiel-ID, z.B. "schach"
// Einträge im Wörterbuch:
//   "Spiel starten": "Start game"            ganzer Text; gilt auch als Textstück ("Du hast " + n + " Punkte" -> "Du hast" + "Punkte")
//   "Spieler {0} ist dran": "Player {0}'s turn"   Vorlage mit Platzhaltern {0} {1} ... (Zahlen/Namen bleiben, Rest wird übersetzt)
//   "_exact": { "Dame": "Checkers" }         nur wenn der ganze Text genau so lautet (z.B. Spielnamen, die auch normale Wörter sind)
//   "_names": { "Schach": "Chess" }          wie ein normaler Eintrag, aber die Gross-/Kleinschreibung bleibt immer wie angegeben (Namen)
// Gross-/Kleinschreibung: Deutsche Hauptwörter sind gross geschrieben, englische nicht. Steht ein Textstück mitten im Satz und der englische
// Wert hat nur den ersten Buchstaben gross ("Points"), wird er klein ("points"); am Satzanfang wird aus "points" wieder "Points".
// Neue Texte finden: auf der Seite  localStorage['lw-i18n-debug']='1'  setzen, neu laden, dann steht in  window.__lwMiss  jeder Text,
// der deutsch aussieht und nicht übersetzt wurde. Prüfen ohne Browser: tools/i18n/pruefen.js
(function (root) {
  'use strict';

  // ---------- Übersetzer (läuft auch in Node, für die Tests) ----------
  const WORD = '\\p{L}\\p{N}';
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function flex(s) { return esc(s).replace(/ +/g, '\\s+'); }

  function makeTranslator(dict) {
    const exact = new Map(), exactOnly = new Map(), frag = new Map(), fixedCase = new Set(), pats = [];
    function add(k, v, mode) {
      if (typeof k !== 'string' || typeof v !== 'string') return;
      const n = norm(k);
      if (!n) return;
      if (/\{\d+\}/.test(n)) {
        const parts = n.split(/\{\d+\}/);
        pats.push({ re: new RegExp('^' + parts.map(flex).join('(.+?)') + '$', 's'), to: v.trim(), len: n.length });
      } else if (mode === 'exact') exactOnly.set(n, v.trim());
      else {
        exact.set(n, v.trim());
        if (n.length >= 2) frag.set(n, v.trim());
        if (mode === 'name') fixedCase.add(n);
      }
    }
    for (const k of Object.keys(dict)) {
      if (k === '_exact' || k === '_names') for (const k2 of Object.keys(dict[k])) add(k2, dict[k][k2], k === '_exact' ? 'exact' : 'name');
      else add(k, dict[k], '');
    }
    pats.sort((a, b) => b.len - a.len);
    // Textstücke: längste zuerst, nur an Wortgrenzen (nie mitten in einem Wort)
    const keys = [...frag.keys()].sort((a, b) => b.length - a.length);
    let fragRe = null;
    if (keys.length) {
      const alts = keys.map(k => {
        const first = k[0], last = k[k.length - 1];
        return (/[\p{L}\p{N}]/u.test(first) ? '(?<![' + WORD + '])' : '') + flex(k) + (/[\p{L}\p{N}]/u.test(last) ? '(?![' + WORD + '])' : '');
      });
      fragRe = new RegExp(alts.join('|'), 'gu');
    }
    const cache = new Map();
    function tr(s, depth) {
      if (typeof s !== 'string' || s.length < 2 || s.length > 4000) return s;
      if (depth === undefined && cache.has(s)) return cache.get(s);
      let out = s;
      const n = norm(s);
      if (/\p{L}/u.test(n)) {
        let hit = exactOnly.get(n);
        if (hit === undefined) hit = exact.get(n);
        if (hit !== undefined) out = s.match(/^\s*/)[0] + hit + s.match(/\s*$/)[0];
        else {
          let done = false;
          for (const p of pats) {
            const m = p.re.exec(n);
            if (m) {
              out = s.match(/^\s*/)[0] + p.to.replace(/\{(\d+)\}/g, (_, i) => (m[+i + 1] === undefined ? '' : (depth > 1 ? m[+i + 1] : tr(m[+i + 1], (depth || 0) + 1)))) + s.match(/\s*$/)[0];
              done = true; break;
            }
          }
          if (!done && fragRe) out = s.replace(fragRe, (m, ...rest) => {
            const k = norm(m); let h = frag.get(k);
            if (h === undefined) return m;
            if (!fixedCase.has(k)) {
              const offset = rest[rest.length - 2], before = s.slice(0, offset);
              const start = offset === 0 || /(^|[.!?:•·\n]|[-–—]|[("„«])\s*$/.test(before);
              if (/^\p{Lu}[^\p{Lu}]*$/u.test(h) && /^\p{Lu}/u.test(k) && !start) h = h[0].toLowerCase() + h.slice(1);
              else if (/^\p{Ll}/u.test(h) && /^\p{Lu}/u.test(k) && start) h = h[0].toUpperCase() + h.slice(1);
            }
            return h;
          });
        }
      }
      if (depth === undefined) { if (cache.size > 30000) cache.clear(); cache.set(s, out); }
      return out;
    }
    return { t: tr, size: exact.size + exactOnly.size + pats.length };
  }

  // Sieht der Text deutsch aus? (für die Suche nach fehlenden Übersetzungen)
  const GER = /[äöüÄÖÜß]|(^|[^\p{L}])(der|Der|dem|Dem|des|Des|das|Das|und|Und|nicht|Nicht|du|Du|dein|Dein|deine|Deine|deinen|Deinen|deiner|Deiner|deinem|Deinem|ist|Ist|mit|Mit|auf|Auf|zu|Zu|zum|Zum|zur|Zur|ein|Ein|eine|Eine|einen|Einen|einer|Einer|eines|Eines|wird|Wird|werden|Werden|wurde|Wurde|wurden|Wurden|kannst|Kannst|kann|Kann|muss|Muss|soll|Soll|sollst|Sollst|darfst|Darfst|oder|Oder|noch|Noch|nur|Nur|wie|Wie|wenn|Wenn|wer|Wer|dich|Dich|dir|Dir|euch|Euch|uns|Uns|für|Für|von|Von|nach|Nach|bis|Bis|über|Über|unter|Unter|ohne|Ohne|gegen|Gegen|durch|Durch|beim|Beim|vom|Vom|schon|Schon|jetzt|Jetzt|hier|Hier|dort|Dort|wieder|Wieder|auch|Auch|sehr|Sehr|mehr|Mehr|alle|Alle|alles|Alles|jeder|Jeder|jede|Jede|jedes|Jedes|kein|Kein|keine|Keine|keinen|Keinen|sind|Sind|bist|Bist|seid|Seid|haben|Haben|hast|Hast|habt|Habt|Spieler|Runde|Runden|Gegner|Punkte|Spiel|Spiele|Zug|dran|Dran|gewinnt|Gewinnt|verloren|Verloren|weiter|Weiter|zurück|Zurück|Schliessen|Einstellungen|Beenden|Abbrechen|Wähle|Tippe|drücke|Drücke|Taste|Tasten|Leertaste|Pfeiltasten|bitte|Bitte|zuerst|Zuerst|ganz|Ganz|viel|Viel|viele|Viele|wenig|Wenig|dann|Dann|aber|Aber|weil|Weil|dass|Dass|gewinnen|Gewinnen|verlieren|Verlieren|treffen|Treffen|setzen|Setzen|ziehen|Ziehen|wählen|Wählen|starten|Starten|sammeln|Sammeln|bauen|Bauen|kaufen|Kaufen|spielen|Spielen|laufen|Laufen|springen|Springen|schiessen|Schiessen|rennen|Rennen|fahren|Fahren|Neu|Menü|Leben|Stufe|Feld|Felder|Brett|Stein|Steine|Reihe|Zeit|Sekunden|Gewinn|Sieg|Niederlage|Ziel|Welt|Karte|Waffe|Münzen|Schaden|Angriff|Verteidigung|Schwarz|Weiss|Rot|Blau|Gelb|Grün|einem|Einem)($|[^\p{L}])/u;
  function looksGerman(s) { return GER.test(s); }

  const api = { makeTranslator, looksGerman, norm };
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;

  // ---------- Im Browser ----------
  const LW = root.LW = root.LW || {};
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  const q = /[?&]l=(en|de)\b/.exec(location.search);
  const stored = get('lw-lang');
  LW.lang = stored === 'en' || stored === 'de' ? stored : (q ? q[1] : 'de');
  LW.langChosen = stored === 'en' || stored === 'de';
  LW.setLang = function (l) { set('lw-lang', l === 'en' ? 'en' : 'de'); location.reload(); };
  LW.t = function (s) { return s; };

  // Titel der Spiele (für Seiten, die den Namen anzeigen): in common.en.json unter "_exact"
  if (LW.lang !== 'en') return;

  document.documentElement.lang = 'en';
  const base = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^\/]*$/, '') : '/_shared/';
  })();
  const seg = location.pathname.split('/').filter(Boolean)[0] || '';
  const page = seg === '' ? 'start' : seg === 'updates' ? 'updates' : seg;
  function load(name) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', base + 'i18n/' + name + '.en.json', false);   // synchron, damit nichts Deutsches aufblitzt
      x.send();
      if (x.status === 200) return JSON.parse(x.responseText);
    } catch (e) { /* kein Wörterbuch: Seite bleibt deutsch */ }
    return {};
  }
  const common = load('common'), mine = page === 'common' ? {} : load(page);
  const extra = (page === 'start' || page === 'updates') ? load('verlauf') : {};   // Texte der Updates-Listen
  const dict = Object.assign({}, common, extra, mine);
  dict._exact = Object.assign({}, common._exact || {}, extra._exact || {}, mine._exact || {});
  dict._names = Object.assign({}, common._names || {}, extra._names || {}, mine._names || {});
  const T = makeTranslator(dict);
  const debug = get('lw-i18n-debug') === '1';
  const miss = root.__lwMiss = new Set();
  function tr(s) {
    const out = T.t(s);
    if (debug && out === s && typeof s === 'string' && looksGerman(s) && /\p{L}{3}/u.test(s)) miss.add(norm(s));
    return out;
  }
  LW.t = tr;
  LW.page = page;

  // Seitentitel: "Name – Beschreibung | KEI Langwiligi site" stückweise, den deutschen Suchbegriff in Klammern weglassen
  function trTitle(s) {
    const parts = s.split(/( – | \| )/);
    return parts.map((p, i) => {
      if (i % 2) return p;
      const m = /^(.*?)( \([^)]*\))$/.exec(p);
      if (m) { const b = tr(m[1]); if (b !== m[1]) return b; }
      return tr(p);
    }).join('');
  }

  const ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'data-text', 'data-tip'];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 0 };
  const last = new WeakMap();
  function fixText(n) {
    const p = n.parentNode;
    if (!p || SKIP[p.nodeName] || (p.closest && p.closest('[translate="no"]'))) return;
    const v = n.nodeValue;
    if (last.get(n) === v) return;
    const out = p.nodeName === 'TITLE' ? trTitle(v) : tr(v);
    if (out !== v) { n.nodeValue = out; last.set(n, out); }
  }
  function fixAttrs(el) {
    if (SKIP[el.nodeName]) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const out = tr(v); if (out !== v) el.setAttribute(a, out); }
    }
    if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) { const out = tr(el.value); if (out !== el.value) el.value = out; }
  }
  function walk(node) {
    if (node.nodeType === 3) return fixText(node);
    if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
    if (node.closest && node.closest('[translate="no"]')) return;
    fixAttrs(node);
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
  walk(document.documentElement);
  document.addEventListener('DOMContentLoaded', () => walk(document.documentElement));

  // Text im <canvas> (Spiele zeichnen viel selbst)
  const C = root.CanvasRenderingContext2D && root.CanvasRenderingContext2D.prototype;
  if (C) {
    ['fillText', 'strokeText', 'measureText'].forEach(fn => {
      const orig = C[fn];
      if (!orig) return;
      C[fn] = function (text) { const a = arguments; if (typeof text === 'string') { a[0] = tr(text); } return orig.apply(this, a); };
    });
  }
  // Eingebaute Dialoge
  ['alert', 'confirm', 'prompt'].forEach(fn => { const o = root[fn]; if (o) root[fn] = function (m) { const a = arguments; a[0] = tr(String(m)); return o.apply(root, a); }; });
})(typeof window !== 'undefined' ? window : globalThis);
