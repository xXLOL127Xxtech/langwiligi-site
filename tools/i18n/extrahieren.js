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

// JavaScript: Textstücke aus '...', "..." und `...` (Template-Strings werden an ${} getrennt, Ausdrücke darin werden selbst durchsucht)
function jsStrings(src, out) {
  let i = 0; const n = src.length;
  function readTemplate() {   // i steht nach dem öffnenden `
    let cur = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { cur += unesc(src[i + 1]); i += 2; continue; }
      if (c === '`') { i++; push(cur); return; }
      if (c === '$' && src[i + 1] === '{') {
        push(cur); cur = ''; i += 2;
        let depth = 1; const start = i;
        while (i < n && depth > 0) {
          const d = src[i];
          if (d === '{') depth++; else if (d === '}') { depth--; if (depth === 0) break; }
          else if (d === '"' || d === "'") { skipString(d); continue; }
          else if (d === '`') { i++; readTemplate(); continue; }
          i++;
        }
        i++;
        continue;
      }
      cur += c; i++;
    }
  }
  function skipString(q) {
    i++; let cur = '';
    while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { cur += unesc(src[i + 1]); i += 2; } else cur += src[i++]; }
    i++; push(cur);
  }
  function unesc(c) { return c === 'n' ? '\n' : c === 't' ? '\t' : c === 'u' || c === 'x' ? '' : c || ''; }
  function push(s) { if (/<\/?[a-zA-Z][^>]*>/.test(s)) htmlStrings(s, out); else out.add(s); }
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { skipString(c); continue; }
    if (c === '`') { i++; readTemplate(); continue; }
    if (c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(src.slice(Math.max(0, i - 3), i)) || (c === '/' && /(^|[=(,:;!&|?{}\[])\s*$/.test(src.slice(Math.max(0, i - 40), i)))) {   // Regex-Literal überspringen
      i++; let cls = false;
      while (i < n && src[i] !== '\n') { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
      i++; continue;
    }
    i++;
  }
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
    list = list.filter(s => T.t(s) === s);
  }
  process.stdout.write(list.join('\n') + '\n');
}
