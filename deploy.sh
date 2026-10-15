#!/bin/bash
# Lädt alle Spiele aus games/ auf den Server und baut die Startseite neu.
# Neues Spiel: Ordner games/<name>/ mit einer index.html anlegen, dann dieses Skript ausführen.
#
# Startseite (pro Spiel, alles optional):
#   <title>…</title>                                  Name
#   <meta name="description" content="…">             Kurzbeschreibung
#   <meta name="theme-color" content="#ffb703">       Akzentfarbe der Karte
#   <meta name="spiel-modi" content="Lokal,Online,Bots,Solo">  Spielmodi (Häkchen auf der Karte + Filter)
#   <meta name="spiel-tags" content="1 gegen 1,3D">   Schildchen auf dem Bild
#   cover.svg / cover.png / cover.jpg / cover.webp    Bild (16:10, z.B. 640x400)
#
# Nur Startseite lokal bauen (ohne Hochladen):  bash deploy.sh --lokal ZIELORDNER
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/games"

LOCAL=""
if [ "${1:-}" = "--lokal" ]; then
  LOCAL="${2:?Zielordner fehlt}"
  rm -rf "$LOCAL" && mkdir -p "$LOCAL"
  BUILD="$(cd "$LOCAL" && pwd)"
else
  BUILD="$(mktemp -d)"
  trap 'rm -rf "$BUILD"' EXIT
fi

cp -r "$SRC"/. "$BUILD"/
# Versteckte Ordner/Dateien (z.B. .claude) nicht hochladen
find "$BUILD" -mindepth 1 -name '.*' -prune -exec rm -rf {} +
# Verknüpfungen (Symlinks) nie hochladen
find "$BUILD" -type l -delete
# Zurück-Knopf (games/_shared/back.js) in jedes Spiel einbauen
for f in "$BUILD"/*/index.html; do
  grep -q '_shared/back.js' "$f" || printf '\n<script src="../_shared/back.js"></script>\n' >> "$f"
done

html_unescape() { sed -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g'; }
html_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
meta() { { grep -o -i -m1 "<meta name=\"$1\" content=\"[^\"]*\"" "$2" || true; } | sed 's/.*content="//; s/"$//' | tr -d '\r' | html_unescape | html_escape; }

cards=""
count=0
n_lokal=0; n_online=0; n_bots=0; n_solo=0
for dir in "$SRC"/*/; do
  [ -f "$dir/index.html" ] || continue
  slug="$(basename "$dir")"
  page="$dir/index.html"
  title="$({ grep -o -i -m1 '<title>[^<]*</title>' "$page" || true; } | sed -E 's/<\/?[Tt][Ii][Tt][Ll][Ee]>//g' | tr -d '\r')"
  [ -n "$title" ] || title="$slug"
  title="$(printf '%s' "$title" | html_escape)"
  desc="$(meta description "$page")"
  color="$(meta theme-color "$page")"
  [[ "$color" =~ ^#[0-9a-fA-F]{3,8}$ ]] || color="#e2311d"
  tags="$(meta spiel-tags "$page")"
  count=$((count + 1))
  nr="$(printf '%02d' "$count")"

  # Die ersten Bilder sofort laden, den Rest erst beim Hinscrollen
  lazy=""
  [ "$count" -gt 6 ] && lazy=' loading="lazy"'
  cover=""
  for ext in webp png jpg jpeg svg; do
    if [ -f "$dir/cover.$ext" ]; then cover="$slug/cover.$ext"; break; fi
  done
  if [ -n "$cover" ]; then
    img="<img src=\"$cover\" alt=\"\" decoding=\"async\"$lazy>"
  else
    letter="$(printf '%s' "$title" | cut -c1 | tr '[:lower:]' '[:upper:]')"
    img="<span class=\"letter\">$letter</span>"
  fi

  pills=""
  if [ -n "$tags" ]; then
    IFS=',' read -ra tag_list <<< "$tags"
    for t in "${tag_list[@]}"; do
      t="$(printf '%s' "$t" | sed 's/^ *//; s/ *$//')"
      [ -n "$t" ] && pills+="<span>$t</span>"
    done
  fi

  # Spielmodi: nur die vorhandenen, als Text ("Lokal · Online · Bots")
  modi=",$(meta spiel-modi "$page" | tr -d ' '),"
  modes=""
  filter="alle"
  for m in "Lokal|lokal|2 Spieler an einem Gerät" "Online|online|Online gegen Kollegen" \
           "Bots|bots|Gegen Computer-Gegner" "Solo|solo|Allein spielen"; do
    IFS='|' read -r name key hint <<< "$m"
    if [[ "$modi" == *",$name,"* ]]; then
      [ -n "$modes" ] && modes+="<i>·</i>"
      modes+="<span title=\"$hint\">$name</span>"
      filter+=" $key"
      case "$key" in
        lokal) n_lokal=$((n_lokal + 1)) ;; online) n_online=$((n_online + 1)) ;;
        bots) n_bots=$((n_bots + 1)) ;; solo) n_solo=$((n_solo + 1)) ;;
      esac
    fi
  done

  cards+="      <a class=\"card\" href=\"$slug/\" style=\"--c: $color\" data-filter=\"$filter\">
        <div class=\"cover\">$img<div class=\"pills\">$pills</div></div>
        <div class=\"info\">
          <div class=\"meta\"><span class=\"nr\">$nr</span><span class=\"modes\" aria-label=\"Spielmodi\">$modes</span></div>
          <h2>$title</h2>
          <p>$desc</p>
        </div>
      </a>
"
done

{
cat <<'EOF'
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KEI Langwiligi site</title>
  <meta name="description" content="Spiele für zwei im Browser: am gleichen Gerät, online gegen Kollegen oder gegen Bots. Nichts zu installieren.">
  <meta name="theme-color" content="#f0ece2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#12110f" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='2' width='28' height='28' rx='6' fill='%23e2311d'/%3E%3Ccircle cx='11' cy='11' r='3.2' fill='%23fff'/%3E%3Ccircle cx='21' cy='21' r='3.2' fill='%23fff'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap">
  <script>
    // Intro nur beim ersten Besuch pro Tab zeigen (nicht nach "Alle Spiele" aus einem Spiel zurück)
    try {
      if (!sessionStorage.getItem('lw-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('intro');
        sessionStorage.setItem('lw-intro', '1');
      }
    } catch (e) {}
  </script>
  <style>
    :root {
      --paper: #f0ece2; --card: #faf8f3; --ink: #17150f; --muted: #655f54; --line: #17150f; --red: #e2311d;
      --font: "Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color-scheme: light;
    }
    @media (prefers-color-scheme: dark) {
      :root { --paper: #12110f; --card: #1b1a17; --ink: #eee8da; --muted: #9d968a; --line: #45413a; --red: #ff5541; color-scheme: dark; }
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); }
    body { margin: 0; min-height: 100vh; color: var(--ink); background: var(--paper); -webkit-font-smoothing: antialiased;
      font: 400 16px/1.5 var(--font); }
    /* Leichtes Papierkorn hinter allem */
    body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: .5;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .45 0 0 0 0 .4 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    main { max-width: 1200px; margin: 0 auto; padding: 0 16px 48px; }
    a { color: inherit; }

    .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; font-size: 14px; font-weight: 600; }
    .logo { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; font-weight: 800; font-size: 16px; }
    .logo svg { width: 26px; height: 26px; }
    .top a:not(.logo) { text-decoration-thickness: 2px; text-underline-offset: 3px; }
    .top a:not(.logo):hover { color: var(--red); }

    .hero { padding: clamp(32px, 5vw, 56px) 0 clamp(32px, 5vw, 48px); border-top: 2px solid var(--ink); }
    h1 { margin: 0; font-weight: 900; font-stretch: 70%; text-transform: uppercase; letter-spacing: -.005em;
      font-size: clamp(60px, 13vw, 160px); line-height: .84; }
    .stamp { display: inline-block; position: relative; top: -.08em; margin-right: .1em; padding: .06em .1em .02em; font-size: .5em; line-height: 1;
      color: var(--red); border: .065em solid currentColor; border-radius: .05em; transform: rotate(-7deg); }
    @media (prefers-color-scheme: light) { .stamp { mix-blend-mode: multiply; } }
    .lead { max-width: 34ch; margin: 24px 0 0; font-size: clamp(19px, 2.4vw, 23px); line-height: 1.35; font-weight: 500; }
    .hero-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; }

    .btn { display: inline-flex; align-items: center; gap: 10px; padding: 13px 18px; border: 2px solid var(--ink); border-radius: 4px; cursor: pointer;
      font: 700 16px/1 var(--font); color: var(--paper); background: var(--ink); text-decoration: none; transition: transform .1s, box-shadow .1s; }
    .btn:hover, .btn:focus-visible { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 var(--red); outline: none; }
    .btn:active { transform: none; box-shadow: none; }
    .btn.ghost { color: var(--ink); background: transparent; }
    .btn svg { width: 20px; height: 20px; }

    .bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: stretch; margin: 0 0 28px; background: var(--paper);
      border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); overflow-x: auto; scrollbar-width: none; }
    .bar::-webkit-scrollbar { display: none; }
    .bar button { flex: none; padding: 13px 14px; border: 0; border-radius: 0; cursor: pointer; white-space: nowrap;
      font: 600 15px/1 var(--font); color: var(--ink); background: none; }
    .bar button:hover { color: var(--red); }
    .bar button sup { margin-left: 3px; font-size: 11px; font-weight: 700; color: var(--muted); }
    .bar button[aria-pressed="true"] { color: var(--paper); background: var(--ink); }
    .bar button[aria-pressed="true"] sup { color: inherit; opacity: .65; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr)); gap: 28px 22px; }
    .card { display: flex; flex-direction: column; border: 2px solid var(--line); border-radius: 4px; background: var(--card);
      color: inherit; text-decoration: none; transition: transform .12s ease-out, box-shadow .12s ease-out; }
    .card:hover, .card:focus-visible { transform: translate(-4px, -4px); box-shadow: 6px 6px 0 var(--c); outline: none; }
    .card:active { transform: translate(-1px, -1px); box-shadow: 2px 2px 0 var(--c); }
    .card[hidden] { display: none; }

    .cover { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-bottom: 2px solid var(--line); border-radius: 2px 2px 0 0;
      background: var(--c); }
    .cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .letter { display: grid; place-items: center; height: 100%; font: 900 96px/1 var(--font); font-stretch: 70%; color: #fff; }
    .pills { position: absolute; left: 8px; bottom: 8px; right: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
    .pills span { padding: 4px 6px 3px; border-radius: 2px; font-size: 11px; font-weight: 700; line-height: 1; text-transform: uppercase; letter-spacing: .04em;
      color: #17150f; background: #faf8f3; }

    .info { display: flex; flex-direction: column; flex: 1; padding: 12px 16px 18px; }
    .meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-variant-numeric: tabular-nums; }
    .nr { display: inline-flex; align-items: center; gap: 6px; }
    .nr::before { content: ""; width: 9px; height: 9px; background: var(--c); }
    .modes i { font-style: normal; margin: 0 4px; opacity: .6; }
    .info h2 { margin: 0 0 6px; font-weight: 800; font-stretch: 85%; font-size: 25px; line-height: 1.05; letter-spacing: -.01em; }
    .info p { margin: 0; font-size: 15px; line-height: 1.45; color: var(--muted); }

    footer { margin-top: 72px; padding-top: 32px; border-top: 2px solid var(--ink); }
    .foot { display: grid; grid-template-columns: repeat(2, minmax(0, 440px)); gap: 32px 48px; }
    @media (max-width: 700px) { .foot { grid-template-columns: 1fr; } }
    footer h2 { margin: 0 0 6px; font-weight: 900; font-stretch: 75%; font-size: 32px; line-height: 1; text-transform: uppercase; }
    footer p { margin: 0 0 16px; max-width: 40ch; color: var(--muted); }
    .sign { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 48px 0 0;
      font-size: 13px; color: var(--muted); }

    dialog { width: min(480px, calc(100% - 32px)); padding: 0; border: 2px solid var(--ink); border-radius: 4px; color: var(--ink);
      background: var(--card); box-shadow: 8px 8px 0 var(--red); }
    dialog::backdrop { background: rgba(23, 21, 15, .6); }
    dialog form { display: flex; flex-direction: column; gap: 14px; padding: 24px; }
    dialog h2 { margin: 0; font-weight: 900; font-stretch: 75%; font-size: 34px; line-height: 1; text-transform: uppercase; }
    dialog .hint { margin: -4px 0 0; color: var(--muted); font-size: 15px; }
    dialog label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 700; }
    dialog label small { color: var(--muted); font-weight: 400; }
    dialog input, dialog textarea { font: 16px/1.4 var(--font); color: var(--ink); background: var(--paper);
      border: 2px solid var(--line); border-radius: 3px; padding: 10px 12px; resize: vertical; }
    dialog input:focus, dialog textarea:focus { outline: 2px solid var(--red); outline-offset: 1px; }
    dialog .row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
    dialog .btn:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }
    #tip-msg { margin: 0; min-height: 1.4em; font-size: 14px; color: var(--muted); }
    #tip-msg.ok { color: #2f8a4a; } #tip-msg.err { color: var(--red); }

    /* Intro: "LANGWILIG" fällt rein, Stempel "KEI" knallt drauf, Vorhang geht hoch (ca. 1.7 s) */
    #intro { display: none; }
    .intro #intro { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; cursor: pointer;
      color: #f0ece2; background: #17150f; border-bottom: 10px solid #e2311d;
      animation: intro-out .5s cubic-bezier(.76, 0, .24, 1) 1.2s forwards; }
    .intro-word { position: relative; display: flex; font-weight: 900; font-stretch: 70%; text-transform: uppercase;
      font-size: clamp(64px, 19vw, 260px); line-height: .9; animation: thud .22s ease-out .8s; }
    .intro-word b { display: inline-block; font-weight: inherit; animation: drop .4s cubic-bezier(.2, 1.5, .4, 1) calc(var(--i) * 35ms) both; }
    .intro-stamp { position: absolute; left: -.3em; top: -.6em; padding: .06em .12em .02em; font-size: .42em; line-height: 1;
      color: #ff4b36; border: .065em solid currentColor; border-radius: .05em; transform: rotate(-9deg);
      animation: stamp .18s cubic-bezier(.55, 0, .9, .45) .62s both; }
    @keyframes drop { from { opacity: 0; transform: translateY(-70%); } }
    @keyframes stamp { from { opacity: 0; transform: scale(3.2) rotate(-26deg); } }
    @keyframes thud { 30% { transform: translate(4px, 3px); } 60% { transform: translate(-3px, -1px); } }
    @keyframes intro-out { to { transform: translateY(-100%); } }
    .intro .hero .stamp { animation: stamp-page .2s cubic-bezier(.55, 0, .9, .45) 1.5s both; }
    @keyframes stamp-page { from { opacity: 0; transform: scale(2.6) rotate(-22deg); } }

    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } .intro #intro { display: none; } }
  </style>
</head>
<body>
  <div id="intro" aria-hidden="true">
    <div class="intro-word"><span class="intro-stamp">Kei</span><b style="--i:0">L</b><b style="--i:1">a</b><b style="--i:2">n</b><b style="--i:3">g</b><b style="--i:4">w</b><b style="--i:5">i</b><b style="--i:6">l</b><b style="--i:7">i</b><b style="--i:8">g</b></div>
  </div>
  <main>
    <div class="top">
      <a class="logo" href="./"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="6" fill="#e2311d"/><circle cx="11" cy="11" r="3.2" fill="#fff"/><circle cx="21" cy="21" r="3.2" fill="#fff"/></svg>langwiligi.site</a>
      <a href="https://github.com/xXLOL127Xxtech/langwiligi-site/blob/main/MITMACHEN.md">Eigenes Spiel hochladen</a>
    </div>
    <header class="hero">
      <h1><span class="stamp">Kei</span>Langwiligi site</h1>
      <div class="hero-row">
EOF
printf '        <p class="lead">%s Spiele für zwei: am gleichen Gerät, online gegen Kollegen oder gegen Bots, wenn grad niemand Zeit hat. Läuft im Browser.</p>\n' "$count"
cat <<'EOF'
        <div class="actions">
          <button type="button" class="btn" id="random"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/></svg>Zufallsspiel</button>
          <button type="button" class="btn ghost tip-open">Spiel empfehlen</button>
        </div>
      </div>
    </header>
    <nav class="bar" aria-label="Spiele filtern">
EOF
printf '      <button type="button" data-f="alle" aria-pressed="true">Alle<sup>%s</sup></button>\n' "$count"
printf '      <button type="button" data-f="lokal" aria-pressed="false">Am gleichen Gerät<sup>%s</sup></button>\n' "$n_lokal"
printf '      <button type="button" data-f="online" aria-pressed="false">Online<sup>%s</sup></button>\n' "$n_online"
printf '      <button type="button" data-f="bots" aria-pressed="false">Gegen Bots<sup>%s</sup></button>\n' "$n_bots"
printf '      <button type="button" data-f="solo" aria-pressed="false">Allein<sup>%s</sup></button>\n' "$n_solo"
cat <<'EOF'
    </nav>
    <div class="grid">
EOF
printf '%s' "$cards"
cat <<'EOF'
    </div>
    <footer>
      <div class="foot">
      <div>
        <h2>Selber eins gebaut?</h2>
        <p>Lad dein Spiel auf GitHub hoch. Nach der Prüfung ist es etwa eine Minute später hier drauf.</p>
        <a class="btn" href="https://github.com/xXLOL127Xxtech/langwiligi-site/blob/main/MITMACHEN.md">So geht's</a>
      </div>
      <div>
        <h2>Fehlt ein Spiel?</h2>
        <p>Schreib uns, was du hier gern spielen würdest. Wir lesen alles.</p>
        <button type="button" class="btn ghost tip-open">Spiel empfehlen</button>
      </div>
      </div>
      <p class="sign"><span>langwiligi.site</span><span>Viel Spass!</span></p>
    </footer>
  </main>
  <dialog id="tip">
    <form id="tip-form">
      <h2>Spiel empfehlen</h2>
      <p class="hint">Welches Spiel fehlt hier noch?</p>
      <label>Spiel oder Idee
        <input name="game" required maxlength="80" placeholder="z.B. Tischtennis 1 gegen 1" autocomplete="off"></label>
      <label><span>Was macht es lustig? <small>(optional, gern mit Link)</small></span>
        <textarea name="note" rows="3" maxlength="500" placeholder="Kurz beschreiben oder Link einfügen"></textarea></label>
      <label><span>Dein Name <small>(optional)</small></span>
        <input name="player" maxlength="16" autocomplete="off"></label>
      <p id="tip-msg" role="status"></p>
      <div class="row">
        <button type="button" class="btn ghost" id="tip-close">Schliessen</button>
        <button type="submit" class="btn">Absenden</button>
      </div>
    </form>
  </dialog>
  <script>
    // Intro: nach 1.9 s weg, Klick oder Taste überspringt es
    (function () {
      var root = document.documentElement;
      if (!root.classList.contains('intro')) return;
      function done() { root.classList.remove('intro'); removeEventListener('keydown', done); }
      document.getElementById('intro').addEventListener('click', done);
      addEventListener('keydown', done);
      setTimeout(done, 1900);
    })();

    var buttons = document.querySelectorAll('.bar button[data-f]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.f;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn); });
        document.querySelectorAll('.card').forEach(function (card) {
          card.hidden = card.dataset.filter.split(' ').indexOf(f) < 0;
        });
      });
    });

    // Zufallsspiel: eines der gerade sichtbaren Spiele öffnen
    document.getElementById('random').addEventListener('click', function () {
      var cards = [].filter.call(document.querySelectorAll('.card'), function (c) { return !c.hidden; });
      if (cards.length) location.href = cards[Math.floor(Math.random() * cards.length)].href;
    });

    // Spiel empfehlen -> game-hub (/api/empfehlung)
    var API = location.protocol === 'https:' && /(^|\.)langwiligi\.site$/.test(location.hostname) ? '/api' : 'https://langwiligi.site/api';
    var tip = document.getElementById('tip'), form = document.getElementById('tip-form'), msg = document.getElementById('tip-msg');
    var send = form.querySelector('[type="submit"]');
    function say(text, cls) { msg.textContent = text; msg.className = cls || ''; }
    document.querySelectorAll('.tip-open').forEach(function (b) {
      b.addEventListener('click', function () {
        try { if (!form.player.value) form.player.value = localStorage.getItem('lw-name') || ''; } catch (e) {}
        say(''); send.disabled = false; tip.showModal(); form.game.focus();
      });
    });
    document.getElementById('tip-close').addEventListener('click', function () { tip.close(); });
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
          say('Danke! Ist angekommen.', 'ok');
          send.disabled = false;
        })
        .catch(function (err) {
          say(err.message === 'fast' ? 'Kurz warten, dann nochmal versuchen.' : 'Hat nicht geklappt. Bitte später nochmal versuchen.', 'err');
          send.disabled = false;
        });
    });
  </script>
</body>
</html>
EOF
} > "$BUILD/index.html"

if [ -n "$LOCAL" ]; then
  echo "Startseite gebaut: $BUILD/index.html ($count Spiele)"
  exit 0
fi

echo "Lade $count Spiele hoch ..."
# Das Empfangs-Skript wird mitgeschickt. Beim GitHub-Schlüssel ignoriert der Server diesen Befehl
# und führt seine feste Kopie /usr/local/bin/langwiligi-deploy aus.
tar -czf - -C "$BUILD" . | ssh -o BatchMode=yes "$SERVER" "$(cat "$ROOT/server/langwiligi-deploy.sh")"
echo "Fertig: https://langwiligi.site/"
