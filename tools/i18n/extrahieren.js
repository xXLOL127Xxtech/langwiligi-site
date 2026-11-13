// Zieht alle Texte, die auf der Seite erscheinen könnten, aus dem Quelltext eines Spiels (HTML-Text, Attribute, Textstücke aus JavaScript).
// Template-Strings werden an den ${...}-Stellen zerlegt, "a" + x + "b" ergibt zwei Stücke. So passen die Stücke zum Textstück-Übersetzer in games/_shared/i18n.js.
// Aufruf:
//   node tools/i18n/extrahieren.js <spiel-id> [--offen]    alle Texte (mit --offen: nur die, die noch nicht übersetzt sind)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const LIBS = /(\.min\.|-min\.|jquery|planck|melonJS|bundle\.js$|font-awesome|hammer|keypress|three)/i;

function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (!/^(res|node_modules|\.)/.test(f.name)) walk(p); }
      else if (/\.(js|html|mjs)$/.test(f.name) && !LIBS.test(f.name) && fs.statSync(p).size < 900000) out.push(p);
    }
  })(dir);
  return out;
}

// JavaScript zerlegen in Wörter/Zeichen und Texte. Daraus entstehen (1) alle Textstücke ('...', "...", Teile eines `...` zwischen ${})
// und (2) ganze Vorlagen mit Platzhaltern: `Spieler ${n} ist dran` und 'Spieler ' + n + ' ist dran' ergeben beide  "Spieler {0} ist dran".
function jsTokens(src) {
  const toks = []; let i = 0; const n = src.length;
  // Escape-Folge ab src[i] === '\\' lesen: gibt das Zeichen zurück und setzt i hinter die Folge
  function esc() {
    const c = src[i + 1];
    if (c === 'u') {
      const m = /^\\u(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))/.exec(src.slice(i, i + 12));
      if (m) { i += m[0].length; return String.fromCodePoint(parseInt(m[1] || m[2], 16)); }
    }
    if (c === 'x') { const m = /^\\x([0-9a-fA-F]{2})/.exec(src.slice(i, i + 4)); if (m) { i += 4; return String.fromCharCode(parseInt(m[1], 16)); } }
    i += 2; return c === 'n' ? '\n' : c === 't' ? '\t' : c || '';
  }
  function str(q) {
    i++; let cur = '';
    while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') cur += esc(); else cur += src[i++]; }
    i++; return cur;
  }
  function template() {   // i steht nach dem öffnenden `; gibt { parts, exprs } zurück (exprs = Tokenlisten der ${}-Teile)
    const parts = [], exprs = []; let cur = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { cur += esc(); continue; }
      if (c === '`') { i++; parts.push(cur); return { parts, exprs }; }
      if (c === '$' && src[i + 1] === '{') {
        parts.push(cur); cur = ''; i += 2; let depth = 1; const start = i;
        while (i < n && depth > 0) {
          const d = src[i];
          if (d === '{') depth++; else if (d === '}') { depth--; if (depth === 0) break; }
          else if (d === '"' || d === "'") { str(d); continue; }
          else if (d === '`') { i++; template(); continue; }
          i++;
        }
        exprs.push(jsTokens(src.slice(start, i))); i++; continue;
      }
      cur += c; i++;
    }
    parts.push(cur); return { parts, exprs };
  }
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { toks.push({ t: 's', v: str(c) }); continue; }
    if (c === '`') { i++; const tp = template(); toks.push(tp.exprs.length ? { t: 'T', parts: tp.parts, exprs: tp.exprs } : { t: 's', v: tp.parts[0] }); continue; }
    if (c === '/') {   // Regex-Literal oder Teilung?
      const prev = toks[toks.length - 1];
      if (!prev || (prev.t === 'p' && !/[)\]}]/.test(prev.v)) || (prev.t === 'w' && /^(return|typeof|case|in|of)$/.test(prev.v))) {
        i++; let cls = false;
        while (i < n && src[i] !== '\n') { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
        i++; while (/[a-z]/.test(src[i] || '')) i++; toks.push({ t: 'x' }); continue;
      }
    }
    if (/[A-Za-z0-9_$]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++; toks.push({ t: 'w', v: src.slice(i, j) }); i = j; continue; }
    toks.push({ t: 'p', v: c }); i++;
  }
  return toks;
}
function jsStrings(src, out) {
  const toks = jsTokens(src);
  const OPEN = '([{', CLOSE = ')]}', STOP = new Set([',', ';', ':', '?', '=', '&', '|', '<', '>', '!']);
  function matching(list, i) { let d = 0; for (let j = i; j < list.length; j++) { const x = list[j]; if (x.t === 'p' && OPEN.includes(x.v)) d++; else if (x.t === 'p' && CLOSE.includes(x.v)) { d--; if (d === 0) return j; } } return list.length - 1; }
  function chain(chunk) {   // a + b + c -> "A{0}C"
    const ops = []; let cur = [];
    for (let i = 0; i < chunk.length; i++) {
      const x = chunk[i];
      if (x.t === 'p' && OPEN.includes(x.v)) { const m = matching(chunk, i); for (let q = i; q <= m; q++) cur.push(chunk[q]); i = m; continue; }
      if (x.t === 'p' && x.v === '+') { ops.push(cur); cur = []; continue; }
      cur.push(x);
    }
    ops.push(cur);
    if (ops.length < 2 || !ops.some(o => o.length === 1 && (o[0].t === 's' || o[0].t === 'T'))) return;
    let tpl = '', ph = 0, txt = false;
    for (const o of ops) {
      if (o.length === 1 && o[0].t === 's') { tpl += o[0].v; if (/\p{L}/u.test(o[0].v)) txt = true; }
      else if (o.length === 1 && o[0].t === 'T') { tpl += o[0].parts.map((p, q) => p + (q < o[0].exprs.length ? '{' + (ph++) + '}' : '')).join(''); txt = true; }
      else tpl += '{' + (ph++) + '}';
    }
    if (txt && ph > 0 && /\p{L}{2}/u.test(tpl.replace(/\{\d+\}/g, ''))) push(tpl);
  }
  function level(list) {
    let from = 0;
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (x.t === 's') push(x.v);
      else if (x.t === 'T') {
        x.parts.forEach(push);
        if (x.parts.some(p => /\p{L}{2}/u.test(p))) push(x.parts.map((p, j) => p + (j < x.exprs.length ? '{' + j + '}' : '')).join(''));
        x.exprs.forEach(level);
      } else if (x.t === 'p' && OPEN.includes(x.v)) { const m = matching(list, i); level(list.slice(i + 1, m)); i = m; }
      else if (x.t === 'p' && STOP.has(x.v)) { chain(list.slice(from, i)); from = i + 1; }
    }
    chain(list.slice(from));
  }
  level(toks);
  function push(s) { if (/<\/?[a-zA-Z][^>]*>/.test(s)) htmlStrings(s, out); else out.add(s); }
}
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&hellip;/g, '…').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·').replace(/&rarr;/g, '→').replace(/&larr;/g, '←')
  .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)));

function htmlStrings(src, out) {
  // Skripte und Styles gesondert behandeln
  src = src.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, code) => { if (!/\bsrc=/.test(attrs) && !/type="(application\/ld\+json|importmap)"/.test(attrs)) jsStrings(code, out); return ' '; });
  src = src.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => { for (const x of css.matchAll(/content\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/g)) out.add(x[2].replace(/\\([0-9a-f]{1,6}) ?/gi, '')); return ' '; });
  src = src.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of src.matchAll(/\b(?:title|placeholder|alt|aria-label|value|data-tip|data-text)="([^"]*)"/g)) out.add(decode(m[1]));
  for (const m of src.matchAll(/\b(?:onclick|onchange|oninput)="([^"]*)"/g)) jsStrings(decode(m[1]), out);
  src = src.replace(/<[^>]*>/g, '\u0000');
  for (const t of src.split('\u0000')) { const s = decode(t).replace(/\s+/g, ' ').trim(); if (s) out.add(s); }
}

// Welche Texte sind für Menschen gedacht (und nicht Code, Farben, Dateinamen ...)?
const CODE = /^(?:[a-z0-9_$.\-:#\[\]\/=,()%@+*>~<!?'"` &|;{}\\^]*|\s*)$/;     // nur Kleinbuchstaben und Zeichen: id, Klasse, Ereignis, Selektor
function isText(s) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || !/\p{L}{2}/u.test(s)) return false;
  if (/^(https?:|\/|\.\.?\/|data:|#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|[a-z]+\([^)]*\)$)/i.test(s)) return false;
  if (/^[\w.\-/]+\.(png|jpe?g|webp|svg|gif|mp3|ogg|wav|json|js|css|html)$/i.test(s)) return false;
  if (/^[A-Za-z0-9_\-]+$/.test(s) && /^[a-z]/.test(s) && !/[äöüß]/.test(s)) return false;           // einzelnes kleingeschriebenes Wort ohne Umlaut: Schlüssel/ID
  if (/^[a-z][A-Za-z0-9]*$/.test(s)) return false;                                                  // camelCase
  if (/^[A-Z][A-Z0-9_]+$/.test(s)) return false;                                                    // KONSTANTE
  if (CODE.test(s) && !/[A-ZÄÖÜ]/.test(s) && !/ [a-zäöü]+ [a-zäöü]+/.test(s) && !/[äöüß]/.test(s)) return false;
  if (/^(?:[a-z]+-)+[a-z]+$/.test(s)) return false;                                                 // kebab-case
  if (/^(?:[A-Za-z0-9]+\.)+[A-Za-z0-9]+$/.test(s)) return false;                                    // a.b.c
  return true;
}

function extract(gameDir) {
  const out = new Set();
  for (const f of listFiles(gameDir)) {
    const src = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.html')) htmlStrings(src, out); else jsStrings(src, out);
  }
  const res = [];
  for (const s of out) { const t = s.replace(/\s+/g, ' ').replace(/^[\s.,:;!?)\]·•|\-–—]+|[\s(\[·•|:\-–—]+$/g, '').trim(); if (isText(t)) res.push(t); }
  return [...new Set(res)].sort((a, b) => a.localeCompare(b, 'de'));
}
module.exports = { extract, isText, jsStrings, htmlStrings };

if (require.main === module) {
  const id = process.argv[2];
  if (!id) { console.error('Aufruf: node tools/i18n/extrahieren.js <spiel-id> [--offen]'); process.exit(1); }
  const dir = path.join(root, 'games', id);
  let list = extract(dir);
  if (process.argv.includes('--offen')) {
    const { makeTranslator, looksGerman } = require(path.join(root, 'games', '_shared', 'i18n.js'));
    const read = f => { try { return JSON.parse(fs.readFileSync(path.join(root, 'games', '_shared', 'i18n', f + '.en.json'), 'utf8')); } catch (e) { return {}; } };
    const c = read('common'), g = read(id);
    const d = Object.assign({}, c, g); d._exact = Object.assign({}, c._exact || {}, g._exact || {}); d._names = Object.assign({}, c._names || {}, g._names || {});
    const T = makeTranslator(d);
    // Textstücke, die Teil einer übersetzten Vorlage sind ("Spieler {0} ist dran" deckt "Spieler" und "ist dran" ab), gelten als erledigt
    const cleanKey = x => x.replace(/\s+/g, ' ').replace(/^[\s.,:;!?)\]·•|\-–—]+|[\s(\[·•|:\-–—]+$/g, '').trim();
    const covered = new Set();
    const known = new Set([...Object.keys(d), ...Object.keys(d._exact || {}), ...Object.keys(d._names || {})].map(cleanKey));   // auch gleichlautende Einträge ("Game over!": "Game over!") gelten als erledigt
    Object.keys(d).forEach(k => { if (/\{\d+\}/.test(k)) k.split(/\{\d+\}/).forEach(part => covered.add(cleanKey(part))); });
    list = list.filter(s => { if (covered.has(s) || known.has(s)) return false; if (/\{\d+\}/.test(s)) { const x = s.replace(/\{\d+\}/g, '7'), t = T.t(x); return t === x ? looksGerman(x) : looksGerman(t) || /\{\d+\}/.test(t) && false; } const t = T.t(s); return t === s ? looksGerman(s) || /^\p{Lu}[\p{Ll}-]+( \p{L}+)*[.!?]?$/u.test(s) && !/^[A-Za-z]+$/.test(s) : looksGerman(t); });
  }
  process.stdout.write(list.join('\n') + '\n');
}
