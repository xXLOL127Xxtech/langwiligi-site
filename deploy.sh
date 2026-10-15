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
# "Neu" auf der Startseite = Datum, an dem games/<name>/index.html zum ersten Mal in Git auftaucht.
# Aussehen der Startseite: startseite/ (index.html mit Platzhaltern, start.css, start.js)
#
# Nur Startseite lokal bauen (ohne Hochladen):  bash deploy.sh --lokal ZIELORDNER
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/games"
START="$ROOT/startseite"

LOCAL=""
if [ "${1:-}" = "--lokal" ]; then
  LOCAL="${2:?Zielordner fehlt}"
  rm -rf "$LOCAL" && mkdir -p "$LOCAL"
  BUILD="$(cd "$LOCAL" && pwd)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
else
  BUILD="$(mktemp -d)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$BUILD" "$TMP"' EXIT
fi

cp -r "$SRC"/. "$BUILD"/
# Versteckte Ordner/Dateien nicht hochladen
find "$BUILD" -mindepth 1 -name '.*' -prune -exec rm -rf {} +
# Verknüpfungen (Symlinks) nie hochladen
find "$BUILD" -type l -delete
# Lose Dateien direkt in games/ (z.B. versehentlich hochgeladene index.html oder ZIPs) gehören zu keinem Spiel
find "$BUILD" -mindepth 1 -maxdepth 1 -type f -delete

version() { cksum "$1" | cut -d' ' -f1; }
# Zurück-Knopf und Bewertung (games/_shared/back.js) in jedes Spiel einbauen
BACK_V="$(version "$SRC/_shared/back.js")"
for f in "$BUILD"/*/index.html; do
  grep -q '_shared/back.js' "$f" || printf '\n<script src="../_shared/back.js?v=%s"></script>\n' "$BACK_V" >> "$f"
done

html_unescape() { sed -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g'; }
html_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
meta() { { grep -o -i -m1 "<meta name=\"$1\" content=\"[^\"]*\"" "$2" || true; } | sed 's/.*content="//; s/"$//' | tr -d '\r' | html_unescape | html_escape; }
# Wann kam das Spiel dazu? (Unix-Zeit des ersten Commits; ohne Git bzw. noch nicht eingecheckt: jetzt)
added() {
  local t=""
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    t="$(git -C "$ROOT" log --diff-filter=A --follow --format=%ct -- "games/$1/index.html" 2>/dev/null | tail -1)"
  fi
  printf '%s' "${t:-$(date +%s)}"
}

CARDS="$TMP/cards.html"
: > "$CARDS"
count=0
newest_t=0
newest_title=""
for dir in "$SRC"/*/; do
  [ -f "$dir/index.html" ] || continue
  slug="$(basename "$dir")"
  page="$dir/index.html"
  title="$({ grep -o -i -m1 '<title>[^<]*</title>' "$page" || true; } | sed -E 's/<\/?[Tt][Ii][Tt][Ll][Ee]>//g' | tr -d '\r')"
  [ -n "$title" ] || title="$slug"
  title="$(printf '%s' "$title" | html_unescape | html_escape)"
  desc="$(meta description "$page")"
  color="$(meta theme-color "$page")"
  [[ "$color" =~ ^#[0-9a-fA-F]{3,8}$ ]] || color="#ff2e88"
  tags="$(meta spiel-tags "$page")"
  when="$(added "$slug")"
  if [ "$when" -gt "$newest_t" ]; then newest_t="$when"; newest_title="$title"; fi

  cover=""
  for ext in webp png jpg jpeg svg; do
    if [ -f "$dir/cover.$ext" ]; then cover="$slug/cover.$ext?v=$(version "$dir/cover.$ext")"; break; fi
  done
  if [ -n "$cover" ]; then
    img="<img src=\"$cover\" alt=\"\" loading=\"lazy\" decoding=\"async\">"
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
           "Bots|bots|Bots|Gegen Computer-Gegner" "Solo|solo|Solo|Allein spielen"; do
    IFS='|' read -r name key label hint <<< "$m"
    if [[ "$modi" == *",$name,"* ]]; then
      modes+="<li class=\"on\" title=\"$hint\">$label</li>"
      filter+=" $key"
    else
      modes+="<li title=\"$hint: nein\">$label</li>"
    fi
  done

  cat >> "$CARDS" <<EOF
      <a class="card" href="$slug/" style="--c: $color" data-filter="$filter" data-slug="$slug" data-added="$when" data-title="$title">
        <div class="frame"><div class="body">
          <div class="cover">$img<div class="pills">$pills</div><span class="badge-new">Neu</span></div>
          <div class="info">
            <h2>$title</h2>
            <p>$desc</p>
            <div class="rating"></div>
            <ul class="modes" aria-label="Spielmodi">$modes</ul>
            <span class="play">Spielen <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4"/></svg></span>
          </div>
        </div></div>
      </a>
EOF
  count=$((count + 1))
done

ticker="<span>$count Spiele</span><span>1 gegen 1</span><span>Lokal · Online · Bots</span>"
[ -n "$newest_title" ] && ticker+="<span>Neu: $newest_title</span>"
ticker+="<span>Kein Download</span><span>Kein Login</span><span>Keine Langeweile</span>"

# Startseite aus der Vorlage zusammensetzen
mkdir -p "$BUILD/_start"
cp "$START/start.css" "$START/start.js" "$BUILD/_start/"
ver="$(cat "$START/start.css" "$START/start.js" | cksum | cut -d' ' -f1)"
CARDS="$CARDS" N="$count" VER="$ver" TICKER="$ticker" awk '
  # Ersetzen ohne Regex-Sonderzeichen (Titel können & enthalten)
  function put(s, pat, rep,   i, out) {
    out = ""
    while ((i = index(s, pat)) > 0) { out = out substr(s, 1, i - 1) rep; s = substr(s, i + length(pat)) }
    return out s
  }
  /<!--SPIELE-->/ { while ((getline line < ENVIRON["CARDS"]) > 0) print line; next }
  { $0 = put($0, "<!--ANZAHL-->", ENVIRON["N"]); $0 = put($0, "<!--VERSION-->", ENVIRON["VER"]); print put($0, "<!--TICKER-->", ENVIRON["TICKER"]) }
' "$START/index.html" > "$BUILD/index.html"

# Spiel-Server (Online-Modus, Ranglisten, Bewertungen) wird mitgeschickt; der Server spielt ihn nur ein, wenn er sich geändert hat
mkdir -p "$BUILD/.server"
cp "$ROOT/server/game-hub.js" "$BUILD/.server/game-hub.js"

if [ -n "$LOCAL" ]; then
  rm -rf "$BUILD/.server"
  echo "Startseite gebaut: $BUILD/index.html ($count Spiele)"
  exit 0
fi

echo "Lade $count Spiele hoch ..."
# Das Empfangs-Skript wird mitgeschickt. Beim GitHub-Schlüssel ignoriert der Server diesen Befehl
# und führt seine feste Kopie /usr/local/bin/langwiligi-deploy aus.
tar -czf - -C "$BUILD" . | ssh -o BatchMode=yes "$SERVER" "$(cat "$ROOT/server/langwiligi-deploy.sh")"
echo "Fertig: https://langwiligi.site/"
