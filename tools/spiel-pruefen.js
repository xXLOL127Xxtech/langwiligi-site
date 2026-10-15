#!/usr/bin/env node
// Prüft Spiele gegen SPIEL-VORGABEN.md. Läuft automatisch bei jedem Pull Request (.github/workflows/spiel-pruefen.yml).
//
//   node tools/spiel-pruefen.js                      alle Spiele in games/ prüfen
//   node tools/spiel-pruefen.js games/panzer-pong    nur diese Ordner prüfen
//   node tools/spiel-pruefen.js --changed liste.txt  Spiele aus einer Liste geänderter Dateien prüfen (eine pro Zeile)
//
// Fehler (❌) lassen die Prüfung scheitern, Hinweise (⚠️) nicht.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES = path.join(ROOT, 'games');
const MODI = ['Lokal', 'Online', 'Bots', 'Solo'];
const ALLOWED_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'langwiligi.site'];
// Dateien, die nur der Besitzer der Webseite ändern sollte
const PROTECTED = [/^\.github\//, /^games\/_shared\//, /^server\//, /^tools\//, /^startseite\//, /^deploy\.sh$/, /^hochladen\./, /^einrichten\./, /^server-aktualisieren\./];
// Der Besitzer darf auch die Webseite selbst ändern (LW_BESITZER=1 setzt der Workflow)
const OWNER = process.env.LW_BESITZER === '1';
const MB = 1024 * 1024;

const results = [];   // { title, errors: [], warnings: [] }
function report(title) {
  const r = { title, errors: [], warnings: [] };
  results.push(r);
  return r;
}

// Datei liegt direkt in games/ statt in einem Spielordner (typisch beim Hochladen im Browser)
function strayMsg(f) {
  if (/\.zip$/i.test(f)) return `\`${f}\` ist eine ZIP-Datei. Bitte entpacken und den ganzen Spielordner hochladen.`;
  return `\`${f}\` liegt direkt in \`games/\`. Bitte den ganzen Spielordner hochladen, also z.B. \`games/panzer-pong/index.html\`.`;
}

// ---------- Welche Spiele prüfen? ----------
const args = process.argv.slice(2);
let slugs = [];
if (args[0] === '--changed') {
  const changed = fs.readFileSync(args[1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const outside = report('Dateien ausserhalb eines Spielordners');
  const set = new Set();
  for (const f of changed) {
    const m = f.match(/^games\/([^/]+)\/./);
    if (m && m[1] !== '_shared') { set.add(m[1]); continue; }
    if (/^games\/[^/]+$/.test(f)) {
      if (fs.existsSync(path.join(ROOT, f))) outside.errors.push(strayMsg(f));
      continue;
    }
    if (PROTECTED.some(re => re.test(f))) (OWNER ? outside.warnings : outside.errors).push(`\`${f}\` gehört zur Webseite selbst. Bitte nur Dateien in \`games/<dein-spiel>/\` ändern.`);
    else outside.warnings.push(`\`${f}\` liegt nicht in einem Spielordner.`);
  }
  slugs = [...set];
  for (const s of slugs) {
    if (!fs.existsSync(path.join(GAMES, s))) {
      report(`games/${s}/`).warnings.push('Dieser Ordner wird **gelöscht**. Das Spiel verschwindet dann von der Webseite.');
    }
  }
  slugs = slugs.filter(s => fs.existsSync(path.join(GAMES, s)));
  if (!changed.some(f => /^games\/[^/]+\//.test(f) && !f.startsWith('games/_shared/'))) {
    outside.warnings.push('Dieser Pull Request ändert kein Spiel.');
  }
} else if (args.length) {
  slugs = args.map(a => path.basename(path.resolve(a)));
} else {
  const stray = fs.readdirSync(GAMES, { withFileTypes: true }).filter(d => !d.isDirectory() && !d.name.startsWith('.'));
  if (stray.length) {
    const r = report('Dateien direkt in games/');
    for (const d of stray) r.errors.push(strayMsg(`games/${d.name}`));
  }
  slugs = fs.readdirSync(GAMES, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_shared' && !d.name.startsWith('.')).map(d => d.name);
}

// ---------- Hilfsfunktionen ----------
function walk(dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isSymbolicLink()) out.push({ p, link: true });
    else if (d.isDirectory()) walk(p, out);
    else out.push({ p, size: fs.statSync(p).size });
  }
  return out;
}
function meta(html, name) {
  const re = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : null;
}
function kb(n) { return n < MB ? `${Math.round(n / 1024)} KB` : `${(n / MB).toFixed(1)} MB`; }
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

// ---------- Ein Spiel prüfen ----------
function check(slug) {
  const dir = path.join(GAMES, slug);
  const rel = `games/${slug}`;
  const r = report(`${rel}/`);
  const err = (msg, file, line) => r.errors.push({ msg, file, line });
  const warn = (msg, file, line) => r.warnings.push({ msg, file, line });

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 40) {
    err(`Ordnername \`${slug}\` ist ungültig: nur Kleinbuchstaben, Ziffern und Bindestriche, höchstens 40 Zeichen (z.B. \`panzer-pong\`).`);
  }

  const files = walk(dir);
  for (const f of files) {
    const name = path.relative(dir, f.p).replace(/\\/g, '/');
    if (/\.zip$/i.test(name)) err(`\`${name}\` ist eine ZIP-Datei. Bitte entpackt hochladen.`, `${rel}/${name}`);
    if (f.link) err(`\`${name}\` ist eine Verknüpfung (Symlink). Bitte die echte Datei hochladen.`, `${rel}/${name}`);
    else if (/[^A-Za-z0-9._\-/]/.test(name)) warn(`Dateiname \`${name}\` enthält Leerzeichen, Umlaute oder Sonderzeichen. Das kann Links kaputt machen.`, `${rel}/${name}`);
  }
  const total = files.reduce((s, f) => s + (f.size || 0), 0);
  if (total > 20 * MB) err(`Der Ordner ist ${kb(total)} gross. Erlaubt sind höchstens 20 MB (besser unter 5 MB).`);
  else if (total > 5 * MB) warn(`Der Ordner ist ${kb(total)} gross. Bitte möglichst unter 5 MB bleiben.`);

  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    const other = files.map(f => path.relative(dir, f.p)).find(n => /\.html?$/i.test(n));
    err(`\`index.html\` fehlt direkt im Ordner${other ? ` (gefunden: \`${other.replace(/\\/g, '/')}\`, bitte umbenennen bzw. eine Ebene höher legen)` : ''}.`);
    return;
  }
  const html = fs.readFileSync(indexFile, 'utf8');
  const file = `${rel}/index.html`;

  // Pflicht-Kopf
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
  if (!title || !title.trim()) err('`<title>` fehlt. Daraus kommt der Name auf der Startseite.', file);
  if (!/<meta\s+name=["']viewport["']/i.test(html)) err('Viewport-Zeile fehlt: `<meta name="viewport" content="width=device-width, initial-scale=1">`', file);

  const desc = meta(html, 'description');
  if (!desc) warn('`<meta name="description" content="...">` fehlt. Ohne Beschreibung bleibt die Karte leer.', file);
  else if (desc.length > 140) warn(`Beschreibung ist ${desc.length} Zeichen lang, bitte höchstens ~110.`, file);

  const color = meta(html, 'theme-color');
  if (!color) warn('`<meta name="theme-color" content="#ff6b4a">` fehlt (Farbe der Karte).', file);
  else if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) err(`theme-color \`${color}\` ist keine Hex-Farbe wie \`#ff6b4a\`.`, file);

  const modi = meta(html, 'spiel-modi');
  if (!modi) err('`<meta name="spiel-modi" content="Lokal,Online,Bots,Solo">` fehlt (Auswahl daraus).', file);
  else {
    const bad = modi.split(',').map(s => s.trim()).filter(m => m && !MODI.includes(m));
    if (bad.length) err(`Unbekannte Spielmodi: ${bad.map(b => `\`${b}\``).join(', ')}. Erlaubt: ${MODI.join(', ')}.`, file);
  }
  if (!meta(html, 'spiel-tags')) warn('`<meta name="spiel-tags" content="1 gegen 1,3D">` fehlt (Schildchen auf dem Bild).', file);

  // Titelbild
  const cover = ['webp', 'png', 'jpg', 'jpeg', 'svg'].map(e => `cover.${e}`).find(n => fs.existsSync(path.join(dir, n)));
  if (!cover) err('Titelbild `cover.webp` fehlt (16:10, am besten 1280 × 800).');
  else {
    if (cover.endsWith('.svg')) warn('`cover.svg`: Lieber `cover.webp` verwenden, SVGs mit Effekten machen die Startseite ruckelig.');
    const size = fs.statSync(path.join(dir, cover)).size;
    if (size > 400 * 1024) warn(`\`${cover}\` ist ${kb(size)} gross. Bitte unter 100–200 KB bleiben (z.B. als WebP speichern).`);
  }

  // Externe Dateien und absolute Pfade
  const tagRe = /<(script|link|img|audio|video|source|iframe)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const url = m[2];
    const line = lineOf(html, m.index);
    const host = (url.match(/^(?:https?:)?\/\/([^/:]+)/i) || [])[1];
    if (host && !ALLOWED_HOSTS.includes(host.toLowerCase())) err(`Externe Datei von \`${host}\`. Erlaubt sind nur cdnjs.cloudflare.com und Google Fonts.`, file, line);
    else if (/^(\/(?!\/)|[a-z]:\\|file:)/i.test(url)) err(`Absoluter Pfad \`${url}\`. Bitte relativ einbinden (z.B. \`sprite.png\`).`, file, line);
  }
  const importRe = /(?:\bimport\b[^'"]*|\bimport\s*\(\s*)["'](https?:\/\/([^/"']+)[^"']*)["']/g;
  while ((m = importRe.exec(html))) {
    if (!ALLOWED_HOSTS.includes(m[2].toLowerCase())) err(`Externes Script \`${m[1]}\`. Erlaubt sind nur cdnjs.cloudflare.com und Google Fonts.`, file, lineOf(html, m.index));
  }

  // Spiel-ID im Code muss zum Ordner passen (sonst speichert der Server keine Ranglisten)
  const idRe = /\bGAME_ID\s*=\s*["']([^"']+)["']|GameHub\.(?:connect|submitScore|highscores|loadBoard)\(\s*["']([^"']+)["']/g;
  while ((m = idRe.exec(html))) {
    const id = m[1] || m[2];
    if (id !== slug) err(`Spiel-ID \`${id}\` im Code passt nicht zum Ordnernamen \`${slug}\`.`, file, lineOf(html, m.index));
  }

  // Empfehlungen
  const popRe = /(?<![\w.])(?:window\.)?(alert|confirm|prompt)\s*\(/g;
  if ((m = popRe.exec(html))) warn(`\`${m[1]}()\` gefunden. Bitte keine Browser-Popups, Meldungen gehören ins Spiel.`, file, lineOf(html, m.index));
  const ssIdx = html.search(/ß/);
  if (ssIdx >= 0) warn('„ß“ gefunden. Bitte Schweizer Schreibweise mit „ss“.', file, lineOf(html, ssIdx));
  const backIdx = html.search(/id=["']lw-back["']/);
  if (backIdx >= 0) warn('Die ID `lw-back` ist für den „Alle Spiele“-Knopf der Webseite reserviert.', file, lineOf(html, backIdx));
}

for (const s of slugs.sort()) check(s);

// ---------- Ausgabe ----------
const fmt = x => (typeof x === 'string' ? x : x.msg + (x.line ? ` (Zeile ${x.line})` : ''));
const shown = results.filter(r => r.errors.length || r.warnings.length || r.title.startsWith('games/'));
const errorCount = results.reduce((s, r) => s + r.errors.length, 0);
const warnCount = results.reduce((s, r) => s + r.warnings.length, 0);

let md = errorCount
  ? `## ❌ ${errorCount} Fehler – bitte korrigieren\n\n`
  : `## ✅ Alles in Ordnung${warnCount ? ` (${warnCount} Hinweis${warnCount > 1 ? 'e' : ''})` : ''}\n\n`;
if (!slugs.length && !errorCount && !warnCount) md += 'Keine Spiele zu prüfen.\n';
for (const r of shown) {
  md += `### ${r.errors.length ? '❌' : r.warnings.length ? '⚠️' : '✅'} \`${r.title}\`\n\n`;
  for (const e of r.errors) md += `- ❌ ${fmt(e)}\n`;
  for (const w of r.warnings) md += `- ⚠️ ${fmt(w)}\n`;
  if (!r.errors.length && !r.warnings.length) md += '- Alles gut.\n';
  md += '\n';
}
const repo = process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/blob/main/` : '';
md += `Die Regeln stehen in [SPIEL-VORGABEN.md](${repo}SPIEL-VORGABEN.md). Nach dem Korrigieren einfach die Dateien nochmal hochladen, die Prüfung läuft dann automatisch neu.\n`;

console.log(md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (process.env.GITHUB_ACTIONS) {
  // Anmerkungen direkt an den Dateien im Pull Request
  const esc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  for (const r of results) {
    for (const [level, list] of [['error', r.errors], ['warning', r.warnings]]) {
      for (const x of list) {
        const loc = x.file ? ` file=${x.file}${x.line ? `,line=${x.line}` : ''}` : '';
        console.log(`::${level}${loc}::${esc(fmt(x).replace(/`/g, ''))}`);
      }
    }
  }
}
process.exit(errorCount ? 1 : 0);
