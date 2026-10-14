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
for dir in "$SRC"/*/; do
  [ -f "$dir/index.html" ] || continue
  slug="$(basename "$dir")"
  page="$dir/index.html"
  title="$({ grep -o -i -m1 '<title>[^<]*</title>' "$page" || true; } | sed -E 's/<\/?[Tt][Ii][Tt][Ll][Ee]>//g' | tr -d '\r')"
  [ -n "$title" ] || title="$slug"
  title="$(printf '%s' "$title" | html_escape)"
  desc="$(meta description "$page")"
  color="$(meta theme-color "$page")"
  [[ "$color" =~ ^#[0-9a-fA-F]{3,8}$ ]] || color="#ff7a3d"
  tags="$(meta spiel-tags "$page")"

  cover=""
  for ext in webp png jpg jpeg svg; do
    if [ -f "$dir/cover.$ext" ]; then cover="$slug/cover.$ext"; break; fi
  done
  if [ -n "$cover" ]; then
    img="<img src=\"$cover\" alt=\"\" decoding=\"async\">"
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

  # Spielmodi: alle vier immer anzeigen, vorhandene hervorgehoben
  modi=",$(meta spiel-modi "$page" | tr -d ' '),"
  modes=""
  filter="alle"
  for m in "Lokal|lokal|Lokal|2 Spieler an einem Gerät" "Online|online|Online|Online gegen Freunde" \
           "Bots|bots|Gegen Bots|Gegen Computer-Gegner" "Solo|solo|Solo|Allein spielen"; do
    IFS='|' read -r name key label hint <<< "$m"
    if [[ "$modi" == *",$name,"* ]]; then
      modes+="<li class=\"on\" title=\"$hint\">$label</li>"
      filter+=" $key"
    else
      modes+="<li title=\"$hint: nein\">$label</li>"
    fi
  done

  cards+="      <a class=\"card\" href=\"$slug/\" style=\"--c: $color\" data-filter=\"$filter\">
        <div class=\"cover\">$img<div class=\"pills\">$pills</div></div>
        <div class=\"info\">
          <h2>$title</h2>
          <p>$desc</p>
          <ul class=\"modes\" aria-label=\"Spielmodi\">$modes</ul>
          <span class=\"play\">Spielen <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\"><path d=\"M4 10h11m-4-4 4 4-4 4\"/></svg></span>
        </div>
      </a>
"
  count=$((count + 1))
done

{
cat <<'EOF'
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KEI Langwiligi site</title>
  <meta name="description" content="Online-Spiele mit 1v1 – lokal, online oder gegen Bots.">
  <meta name="theme-color" content="#0b0b12">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🎮%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap">
  <style>
    :root {
      --bg: #0b0b12; --card: #14141f; --line: rgba(255,255,255,.08);
      --text: #f4f1ea; --muted: #a19cae; --display: "Bricolage Grotesque", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body { margin: 0; min-height: 100vh; color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased;
      font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    /* Farbschimmer als eigene, fixierte Ebene: wird einmal gemalt statt bei jedem Scroll-Schritt neu */
    body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; transform: translateZ(0);
      background:
        radial-gradient(900px 500px at 12% -10%, rgba(255,95,162,.18), transparent 60%),
        radial-gradient(800px 500px at 95% 0%, rgba(79,168,255,.16), transparent 60%),
        radial-gradient(700px 400px at 50% 110%, rgba(255,183,3,.08), transparent 60%); }
    main { max-width: 1180px; margin: 0 auto; padding: 0 16px 64px; }

    header { padding: clamp(48px, 10vw, 96px) 0 clamp(28px, 5vw, 44px); }
    .brand { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; padding: 6px 14px 6px 8px; border: 1px solid var(--line);
      border-radius: 99px; background: rgba(255,255,255,.04); font-size: 14px; font-weight: 600; color: var(--muted); }
    .brand i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; font-style: normal;
      background: linear-gradient(135deg, #ff5fa2, #ffb703); }
    h1 { margin: 0; font: 800 clamp(40px, 8vw, 76px)/1 var(--display); letter-spacing: -.035em; }
    h1 span { background: linear-gradient(100deg, #ff5fa2 0%, #ffb703 45%, #5fd38a 75%, #4fa8ff 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent; }
    .lead { max-width: 560px; margin: 18px 0 0; font-size: clamp(16px, 2.2vw, 19px); color: var(--muted); }
    .lead b { color: var(--text); }

    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; }
    .filters button { font: 600 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--muted); background: rgba(255,255,255,.04);
      border: 1px solid var(--line); border-radius: 99px; padding: 10px 16px; cursor: pointer; transition: .15s; }
    .filters button:hover { color: var(--text); border-color: rgba(255,255,255,.2); }
    .filters button[aria-pressed="true"] { color: #12111a; background: var(--text); border-color: var(--text); }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 22px; }
    .card { --glow: color-mix(in srgb, var(--c) 55%, transparent);
      display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; background: var(--card);
      border: 1px solid var(--line); color: inherit; text-decoration: none; position: relative;
      transition: transform .25s cubic-bezier(.2,.8,.2,1), border-color .25s, box-shadow .25s; }
    .card:hover, .card:focus-visible { transform: translateY(-6px); border-color: var(--glow); outline: none;
      box-shadow: 0 24px 60px -24px var(--glow), 0 0 0 1px var(--glow); }
    .card[hidden] { display: none; }

    .cover { position: relative; aspect-ratio: 16 / 10; overflow: hidden;
      background: radial-gradient(circle at 30% 20%, var(--c), color-mix(in srgb, var(--c) 30%, #000)); }
    .cover img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .6s cubic-bezier(.2,.8,.2,1); }
    .card:hover .cover img, .card:focus-visible .cover img { transform: scale(1.06); }
    .cover::after { content: ""; position: absolute; inset: auto 0 0; height: 45%; pointer-events: none;
      background: linear-gradient(transparent, var(--card)); }
    .letter { display: grid; place-items: center; height: 100%; font: 800 96px/1 var(--display); color: rgba(255,255,255,.9); }
    .pills { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1; display: flex; flex-wrap: wrap; gap: 6px; }
    .pills span { font-size: 12px; font-weight: 700; letter-spacing: .02em; padding: 4px 10px; border-radius: 99px; color: #fff;
      background: rgba(10,10,16,.78); border: 1px solid rgba(255,255,255,.14); }

    .info { display: flex; flex-direction: column; flex: 1; padding: 0 20px 20px; margin-top: -14px; position: relative; z-index: 1; }
    .info h2 { margin: 0 0 6px; font: 800 24px/1.15 var(--display); letter-spacing: -.02em; }
    .info p { margin: 0 0 16px; color: var(--muted); font-size: 15px; flex: 1; }
    .modes { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 18px; padding: 0; list-style: none; }
    .modes li { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px 3px 6px; border-radius: 7px; font-size: 12.5px; font-weight: 600;
      color: rgba(255,255,255,.3); border: 1px dashed rgba(255,255,255,.14); }
    .modes li::before { content: "–"; width: 11px; text-align: center; }
    .modes li.on { color: var(--text); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
      background: color-mix(in srgb, var(--c) 16%, transparent); }
    .modes li.on::before { content: "✓"; color: var(--c); font-weight: 800; }
    .play { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px 10px 18px; border-radius: 99px;
      font-weight: 700; font-size: 15px; color: #0d0c12; background: var(--c); transition: gap .2s, filter .2s; }
    .play svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .card:hover .play { gap: 10px; filter: brightness(1.08); }

    .filters .tip-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; color: #12111a; border: 0;
      background: linear-gradient(100deg, #ffb703, #ff5fa2); }
    .filters .tip-btn:hover { color: #12111a; filter: brightness(1.08); }
    .tip-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    @media (max-width: 560px) { .filters .tip-btn { margin-left: 0; } }

    dialog { width: min(480px, calc(100% - 32px)); padding: 0; border: 1px solid var(--line); border-radius: 20px; color: var(--text);
      background: var(--card); box-shadow: 0 30px 80px -20px rgba(0,0,0,.7); }
    dialog::backdrop { background: rgba(5,5,10,.7); }
    dialog form { display: flex; flex-direction: column; gap: 14px; padding: 24px; }
    dialog h2 { margin: 0; font: 800 26px/1.1 var(--display); letter-spacing: -.02em; }
    dialog .hint { margin: -6px 0 0; color: var(--muted); font-size: 15px; }
    dialog label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; }
    dialog label small { color: var(--muted); font-weight: 400; }
    dialog input, dialog textarea { font: 16px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--text); background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 10px 12px; resize: vertical; }
    dialog input:focus, dialog textarea:focus { outline: 2px solid #ffb703; outline-offset: 1px; border-color: transparent; }
    dialog .row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
    dialog .row button { font: 700 15px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; border-radius: 99px; padding: 12px 18px; cursor: pointer;
      border: 1px solid var(--line); color: var(--text); background: rgba(255,255,255,.06); }
    dialog .row button[type="submit"] { border: 0; color: #12111a; background: linear-gradient(100deg, #ffb703, #ff5fa2); }
    dialog .row button:disabled { opacity: .5; cursor: default; }
    #tip-msg { margin: 0; min-height: 1.4em; font-size: 14px; color: var(--muted); }
    #tip-msg.ok { color: #5fd38a; } #tip-msg.err { color: #ff7a7a; }

    footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; text-align: center; }

    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><i>🎮</i>langwiligi.site</div>
      <h1><span>KEI</span> Langwiligi site</h1>
EOF
printf '      <p class="lead">Online-Spiele mit <b>1v1</b> – lokal, online oder gegen Bots. <b>%s Spiele</b> direkt im Browser, ohne Download.</p>\n' "$count"
cat <<'EOF'
    </header>
    <nav class="filters" aria-label="Spiele filtern">
      <button type="button" data-f="alle" aria-pressed="true">Alle</button>
      <button type="button" data-f="lokal" aria-pressed="false">Lokal</button>
      <button type="button" data-f="online" aria-pressed="false">Online</button>
      <button type="button" data-f="bots" aria-pressed="false">Gegen Bots</button>
      <button type="button" data-f="solo" aria-pressed="false">Solo</button>
      <button type="button" class="tip-btn" id="tip-open"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5a5.5 5.5 0 0 0-3.2-10ZM8 17h4"/></svg>Spiel empfehlen</button>
    </nav>
    <div class="grid">
EOF
printf '%s' "$cards"
cat <<'EOF'
    </div>
    <footer>Viel Spass! · langwiligi.site</footer>
  </main>
  <dialog id="tip">
    <form id="tip-form">
      <h2>Spiel empfehlen</h2>
      <p class="hint">Welches Spiel fehlt hier noch? Wir schauen uns jede Empfehlung an.</p>
      <label>Spiel oder Idee
        <input name="game" required maxlength="80" placeholder="z.B. Tischtennis 1 gegen 1" autocomplete="off"></label>
      <label><span>Was macht es lustig? <small>(optional, gern mit Link)</small></span>
        <textarea name="note" rows="3" maxlength="500" placeholder="Kurz beschreiben oder Link einfügen"></textarea></label>
      <label><span>Dein Name <small>(optional)</small></span>
        <input name="player" maxlength="16" autocomplete="off"></label>
      <p id="tip-msg" role="status"></p>
      <div class="row">
        <button type="button" id="tip-close">Schliessen</button>
        <button type="submit">Absenden</button>
      </div>
    </form>
  </dialog>
  <script>
    var buttons = document.querySelectorAll('.filters button[data-f]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.f;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn); });
        document.querySelectorAll('.card').forEach(function (card) {
          card.hidden = card.dataset.filter.split(' ').indexOf(f) < 0;
        });
      });
    });

    // Spiel empfehlen -> game-hub (/api/empfehlung)
    var API = location.protocol === 'https:' && /(^|\.)langwiligi\.site$/.test(location.hostname) ? '/api' : 'https://langwiligi.site/api';
    var tip = document.getElementById('tip'), form = document.getElementById('tip-form'), msg = document.getElementById('tip-msg');
    var send = form.querySelector('[type="submit"]');
    function say(text, cls) { msg.textContent = text; msg.className = cls || ''; }
    document.getElementById('tip-open').addEventListener('click', function () {
      try { if (!form.player.value) form.player.value = localStorage.getItem('lw-name') || ''; } catch (e) {}
      say(''); send.disabled = false; tip.showModal(); form.game.focus();
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
          say('Danke! Deine Empfehlung ist angekommen.', 'ok');
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
