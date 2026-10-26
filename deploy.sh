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
#   <meta name="spiel-typ" content="Action,3D">       Typen für den Typ-Filter (Liste in tools/spiel-pruefen.js)
#   cover.svg / cover.png / cover.jpg / cover.webp    Bild (16:10, z.B. 640x400)
# "Neu" auf der Startseite = Datum, an dem games/<name>/index.html zum ersten Mal in Git auftaucht.
# Aussehen der Startseite: startseite/ (index.html mit Platzhaltern, start.css, start.js)
#
# Nur Startseite lokal bauen (ohne Hochladen):  bash deploy.sh --lokal ZIELORDNER
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"
SITE="https://langwiligi.site"
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
FREUNDE_V="$(version "$SRC/_shared/freunde.js")"
# data-v = Version des Spiels (Tag der letzten Änderung). Ändert sie sich, fragt die Bewertung nochmal nach.
game_version() {
  local t=""
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    t="$(git -C "$ROOT" log -1 --format=%cs -- "games/$1" 2>/dev/null)"
  fi
  printf '%s' "${t:-$(version "$SRC/$1/index.html")}"
}
html_unescape() { sed -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g'; }
html_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
# Text als JSON-Zeichenkette (für die strukturierten Daten, die Google liest)
json_str() { printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g' | tr -d '\n')"; }
# Wert eines Meta-Tags: meta_raw ohne, meta mit HTML-Maskierung
meta_raw() { { grep -o -i -m1 "<meta name=\"$1\" content=\"[^\"]*\"" "$2" || true; } | sed 's/.*content="//; s/"$//' | tr -d '\r' | html_unescape; }
meta() { meta_raw "$1" "$2" | html_escape; }
title_raw() { { grep -o -i -m1 '<title>[^<]*</title>' "$1" || true; } | sed -E 's/<\/?[Tt][Ii][Tt][Ll][Ee]>//g' | tr -d '\r' | html_unescape; }
trim() { sed 's/^ *//; s/ *$//'; }
cover_of() {
  local ext
  for ext in webp png jpg jpeg svg; do
    if [ -f "$1/cover.$ext" ]; then printf 'cover.%s?v=%s' "$ext" "$(version "$1/cover.$ext")"; return; fi
  done
}

for f in "$BUILD"/*/index.html; do
  slug="$(basename "$(dirname "$f")")"
  src="$SRC/$slug/index.html"
  name="$(title_raw "$src")"
  [ -n "$name" ] || name="$slug"
  grep -q '_shared/back.js' "$f" || printf '\n<script src="../_shared/back.js?v=%s" data-v="%s" data-name="%s"></script>\n' "$BACK_V" "$(game_version "$slug")" "$(printf '%s' "$name" | html_escape)" >> "$f"
  # Freunde, Online-Status und Einladungen (games/_shared/freunde.js)
  grep -q '_shared/freunde.js' "$f" || printf '<script src="../_shared/freunde.js?v=%s"></script>\n' "$FREUNDE_V" >> "$f"
  # Für Google: Suchbegriffe in Titel und Beschreibung, die Hauptadresse (canonical), damit die IP nicht als zweite Seite zählt,
  # Vorschau für geteilte Links und strukturierte Daten (schema.org). Der Name auf der Startseite bleibt kurz,
  # er kommt aus games/ und nicht aus dieser Kopie.
  grep -qi 'rel="canonical"' "$f" && continue
  url="$SITE/$slug/"
  modi=",$(meta_raw spiel-modi "$src" | tr -d ' '),"
  # spiel-suche: Wörter, die Leute bei Google für dieses Spiel eintippen (z.B. "Käsekästchen"). Das erste kommt in den Titel.
  suche="$(meta_raw spiel-suche "$src")"
  first="$(printf '%s' "${suche%%,*}" | trim)"
  gname="$name"
  # Nicht doppelt: "Schach" + "Schach online" bleibt "Schach", "Bottle-Flip" + "Bottle Flip" bleibt "Bottle-Flip"
  n_low="$(printf '%s' "$name" | tr '[:upper:]-' '[:lower:] ')"
  f_low="$(printf '%s' "$first" | tr '[:upper:]-' '[:lower:] ')"
  if [ -n "$first" ] && [[ " $n_low " != *" $f_low "* && "$f_low " != "$n_low "* ]]; then gname="$name ($first)"; fi
  case "$modi" in
    *,Lokal,*|*,Online,*) wie="online zu zweit spielen, kostenlos" ;;
    *) wie="kostenlos online spielen" ;;
  esac
  wege=()
  [[ "$modi" == *",Lokal,"* ]] && wege+=("zu zweit an einem Laptop")
  [[ "$modi" == *",Online,"* ]] && wege+=("online mit Freunden")
  [[ "$modi" == *",Bots,"* ]] && wege+=("gegen Bots")
  [[ "$modi" == *",Solo,"* ]] && wege+=("allein")
  extra="Gratis im Browser spielen"
  if [ "${#wege[@]}" -gt 0 ]; then
    w="${wege[0]}"
    for ((k = 1; k < ${#wege[@]}; k++)); do
      if [ "$k" -eq $((${#wege[@]} - 1)) ]; then w+=" oder ${wege[$k]}"; else w+=", ${wege[$k]}"; fi
    done
    extra+=": $w"
  fi
  extra+=". Ohne Download, ohne Werbung."
  desc="$(meta_raw description "$src")"
  full_desc="$(printf '%s %s' "$desc" "$extra" | trim)"
  cover="$(cover_of "$SRC/$slug")"
  img_url=""
  [ -n "$cover" ] && img_url="$url$cover"

  alt="" sep=""
  if [ -n "$suche" ]; then
    IFS=',' read -ra words <<< "$suche"
    for w in "${words[@]}"; do
      w="$(printf '%s' "$w" | trim)"
      [ -n "$w" ] && alt+="$sep$(json_str "$w")" && sep=","
    done
  fi
  genre="" sep=""
  IFS=',' read -ra words <<< "$(meta_raw spiel-typ "$src")"
  for w in "${words[@]}"; do
    w="$(printf '%s' "$w" | trim)"
    [ -n "$w" ] && genre+="$sep$(json_str "$w")" && sep=","
  done
  play=""
  [[ "$modi" == *",Solo,"* || "$modi" == *",Bots,"* ]] && play+='"SinglePlayer"'
  [[ "$modi" == *",Lokal,"* || "$modi" == *",Online,"* ]] && play+="${play:+,}\"MultiPlayer\""
  ld='{"@context":"https://schema.org","@graph":[{"@type":"VideoGame","name":'"$(json_str "$name")"
  [ -n "$alt" ] && ld+=',"alternateName":['"$alt"']'
  ld+=',"description":'"$(json_str "$full_desc")"',"url":'"$(json_str "$url")"
  [ -n "$img_url" ] && ld+=',"image":'"$(json_str "$img_url")"
  [ -n "$genre" ] && ld+=',"genre":['"$genre"']'
  [ -n "$play" ] && ld+=',"playMode":['"$play"']'
  ld+=',"gamePlatform":"Webbrowser","applicationCategory":"GameApplication","operatingSystem":"Windows, macOS, Linux, ChromeOS","inLanguage":"de-CH","isAccessibleForFree":true,"offers":{"@type":"Offer","price":"0","priceCurrency":"CHF"}'
  ld+=',"isPartOf":{"@type":"WebSite","name":"KEI Langwiligi site","url":"'"$SITE"'/"}}'
  ld+=',{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"KEI Langwiligi site","item":"'"$SITE"'/"},{"@type":"ListItem","position":2,"name":'"$(json_str "$name")"',"item":'"$(json_str "$url")"'}]}]}'

  t_html="$(printf '%s – %s | KEI Langwiligi site' "$gname" "$wie" | html_escape)"
  d_html="$(printf '%s' "$full_desc" | html_escape)"
  og_title="$(printf '%s – %s' "$gname" "$wie" | html_escape)"
  head="<link rel=\"canonical\" href=\"$url\">"
  head+="<meta property=\"og:type\" content=\"website\"><meta property=\"og:site_name\" content=\"KEI Langwiligi site\">"
  head+="<meta property=\"og:url\" content=\"$url\"><meta property=\"og:title\" content=\"$og_title\">"
  head+="<meta property=\"og:description\" content=\"$d_html\"><meta property=\"og:locale\" content=\"de_CH\">"
  if [ -n "$img_url" ]; then
    head+="<meta property=\"og:image\" content=\"$(printf '%s' "$img_url" | html_escape)\"><meta name=\"twitter:card\" content=\"summary_large_image\">"
  fi
  head+="<script type=\"application/ld+json\">$ld</script>"
  T="$t_html" D="$d_html" HEAD="$head" awk '
    !done_t && (i = index(tolower($0), "<title>")) > 0 && (j = index(tolower($0), "</title>")) > i {
      $0 = substr($0, 1, i + 6) ENVIRON["T"] "</title>" ENVIRON["HEAD"] substr($0, j + 8); done_t = 1
    }
    !done_d && (i = index($0, "name=\"description\" content=\"")) > 0 {
      a = substr($0, 1, i + 27); rest = substr($0, i + 28)
      if ((j = index(rest, "\"")) > 0) { $0 = a ENVIRON["D"] substr(rest, j); done_d = 1 }
    }
    { print }
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"

  # Lesbarer Text für Google: Die Spiele zeichnen fast alles per JavaScript, im HTML steht sonst kaum Text.
  # Darum kommt vor </body> ein kurzer Infoblock (optisch ausgeblendet, kein Einfluss aufs Layout)
  # mit Beschreibung, Spielmodi und Links zu verwandten Spielen. Die Links helfen auch, dass Google alle Spiele findet.
  rel="" nrel=0
  typ1="$(meta_raw spiel-typ "$src" | cut -d, -f1 | trim)"
  for other in "$SRC"/*/index.html; do
    oslug="$(basename "$(dirname "$other")")"
    [ "$oslug" = "$slug" ] && continue
    if [ -n "$typ1" ] && ! meta_raw spiel-typ "$other" | tr ',' '\n' | trim | grep -qxF "$typ1"; then continue; fi
    rel+="<li><a href=\"../$oslug/\">$(title_raw "$other" | html_escape)</a></li>"
    nrel=$((nrel + 1))
    [ "$nrel" -ge 6 ] && break
  done
  info="<section class=\"lw-seo\" aria-label=\"Über dieses Spiel\" style=\"position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0\">"
  info+="<h2>$(printf '%s' "$gname" | html_escape): $(printf '%s' "$wie" | html_escape)</h2>"
  info+="<p>$d_html</p>"
  info+="<p>$(printf '%s' "$name" | html_escape) läuft direkt im Browser auf Windows, Mac, Linux und Chromebook, gesteuert mit Tastatur und Touchpad. Kein Download, kein Login, keine Werbung.</p>"
  [ -n "$rel" ] && info+="<h3>Ähnliche Spiele</h3><ul>$rel</ul>"
  info+="<p><a href=\"../\">Alle Spiele auf KEI Langwiligi site</a></p></section>"
  INFO="$info" awk '
    { lines[NR] = $0 }
    /<\/body>/ { last = NR }
    END { for (i = 1; i <= NR; i++) { if (i == last) { j = index(lines[i], "</body>"); print substr(lines[i], 1, j - 1) ENVIRON["INFO"] substr(lines[i], j) } else print lines[i] } }
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
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
items=""
top_titles=()
: > "$TMP/spiele.txt"
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
  # Typen als Schlüssel: "Pixel-Art,3D" -> "pixel-art 3d"
  typ="$(meta spiel-typ "$page" | tr '[:upper:]' '[:lower:]' | tr ',' ' ' | tr -s ' ' | sed 's/^ *//; s/ *$//' | tr -cd 'a-z0-9 -')"
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
      <a class="card" href="$slug/" style="--c: $color" data-filter="$filter" data-typ="$typ" data-slug="$slug" data-added="$when" data-title="$title">
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
  printf '%s %s %s\n' "$when" "$slug" "$title" >> "$TMP/spiele.txt"
  items+="${items:+,}{\"@type\":\"ListItem\",\"position\":$count,\"url\":\"$SITE/$slug/\",\"name\":$(json_str "$(title_raw "$page")")}"
done

# Spiele in der Beschreibung für Google: die meistgespielten der letzten 7 Tage (vom Spiel-Server),
# aufgefüllt mit den neusten. Ist der Server nicht erreichbar, nur die neusten.
top=""
if command -v node >/dev/null 2>&1; then
  for base in "$SITE" "http://46.224.94.231"; do
    stats="$(curl -fsS --max-time 10 "$base/api/spiele" 2>/dev/null)" || continue
    top="$(printf '%s' "$stats" | node -e '
      let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
        try { const o = JSON.parse(s); console.log(Object.keys(o).filter(k => o[k].week > 0).sort((a, b) => o[b].week - o[a].week).join(" ")); } catch (e) {}
      })')"
    break
  done
fi
picked=()
for s in $top $(sort -rn "$TMP/spiele.txt" | cut -d' ' -f2); do
  t="$(awk -v s="$s" '$2 == s { sub(/^[^ ]+ [^ ]+ /, ""); print; exit }' "$TMP/spiele.txt")"
  [ -n "$t" ] || continue   # Spiel gibt es nicht mehr
  [[ " ${picked[*]-} " == *" $s "* ]] && continue
  picked+=("$s")
  top_titles+=("$t")
  [ "${#picked[@]}" -ge 4 ] && break
done
top_games="$(printf '%s, ' "${top_titles[@]}")"
top_games="${top_games%, }"

ticker="<span>$count Spiele</span><span>1 gegen 1</span><span>Lokal · Online · Bots</span>"
[ -n "$newest_title" ] && ticker+="<span>Neu: $newest_title</span>"
ticker+="<span>Kein Download</span><span>Kein Login</span><span>Keine Langeweile</span>"

# Für Suchmaschinen: Liste aller Seiten (sitemap.xml, in der Google Search Console einreichen) und robots.txt
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  echo "  <url><loc>$SITE/</loc></url>"
  for dir in "$SRC"/*/; do
    [ -f "$dir/index.html" ] || continue
    slug="$(basename "$dir")"
    d="$(game_version "$slug")"
    if [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      echo "  <url><loc>$SITE/$slug/</loc><lastmod>$d</lastmod></url>"
    else
      echo "  <url><loc>$SITE/$slug/</loc></url>"
    fi
  done
  echo '</urlset>'
} > "$BUILD/sitemap.xml"
# /api/e/ = Einladungsseiten mit Vorschaubild, die WhatsApp, Discord & Co. lesen dürfen müssen
printf 'User-agent: *\nAllow: /api/e/\nDisallow: /api/\n\nSitemap: %s/sitemap.xml\n' "$SITE" > "$BUILD/robots.txt"
# Bestätigungs-Dateien für Google Search Console und Bing Webmaster Tools (z.B. startseite/google1234abcd.html, startseite/BingSiteAuth.xml)
for v in "$START"/google*.html "$START"/BingSiteAuth.xml; do
  [ -f "$v" ] && cp "$v" "$BUILD/"
done
# IndexNow: meldet Bing, Ecosia, DuckDuckGo, Yandex & Co. nach jedem Hochladen die Startseite und alle Spiele,
# die seit gestern geändert wurden (Google liest die sitemap.xml). Unveränderte Seiten nicht jedes Mal melden, sonst wird gebremst.
# Der Schlüssel aus startseite/indexnow.txt muss dafür als <schlüssel>.txt auf der Webseite liegen.
INDEXNOW_KEY=""
if [ -f "$START/indexnow.txt" ]; then
  INDEXNOW_KEY="$(tr -cd 'a-zA-Z0-9-' < "$START/indexnow.txt")"
  [ -n "$INDEXNOW_KEY" ] && printf '%s' "$INDEXNOW_KEY" > "$BUILD/$INDEXNOW_KEY.txt"
fi

# Startseite aus der Vorlage zusammensetzen
mkdir -p "$BUILD/_start"
cp "$START/start.css" "$START/start.js" "$START/updates.json" "$START/verlauf.js" "$START/verlauf.json" "$BUILD/_start/"
# Logo im Browser-Tab (favicon.ico gilt auch für alle Spiele, die kein eigenes Symbol haben).
# Eigenes Bild: startseite/logo.png (quadratisch, z.B. 512 × 512) hochladen, dann wird es statt favicon.svg verwendet.
if [ -f "$START/logo.png" ]; then
  cp "$START/logo.png" "$BUILD/favicon.png"
  cp "$START/logo.png" "$BUILD/apple-touch-icon.png"
  icon_v="$(version "$START/logo.png")"
  icons="<link rel=\"icon\" href=\"favicon.png?v=$icon_v\" type=\"image/png\"><link rel=\"apple-touch-icon\" href=\"apple-touch-icon.png?v=$icon_v\">"
  if command -v convert >/dev/null 2>&1; then
    convert "$START/logo.png" -define icon:auto-resize=48,32,16 "$BUILD/favicon.ico" 2>/dev/null || cp "$START/favicon.ico" "$BUILD/"
  else
    cp "$START/favicon.ico" "$BUILD/"
  fi
else
  cp "$START/favicon.svg" "$START/favicon.ico" "$START/apple-touch-icon.png" "$BUILD/"
  icon_v="$(version "$START/favicon.svg")"
  icons="<link rel=\"icon\" href=\"favicon.svg?v=$icon_v\" type=\"image/svg+xml\"><link rel=\"alternate icon\" href=\"favicon.ico\" sizes=\"48x48\"><link rel=\"apple-touch-icon\" href=\"apple-touch-icon.png?v=$icon_v\">"
fi
# Vorschaubild für geteilte Links (og:image); neu bauen mit: node tools/vorschaubild/bauen.js
cp "$START/vorschau.jpg" "$BUILD/"
bild_v="$(version "$START/vorschau.jpg")"
ver="$(cat "$START/start.css" "$START/start.js" "$START/updates.json" "$START/verlauf.js" "$START/verlauf.json" | cksum | cut -d' ' -f1)"
CARDS="$CARDS" ITEMS="$items" N="$count" TOP="$top_games" VER="$ver" TICKER="$ticker" ICONS="$icons" BILDV="$bild_v" FREUNDEV="$FREUNDE_V" awk '
  # Ersetzen ohne Regex-Sonderzeichen (Titel können & enthalten)
  function put(s, pat, rep,   i, out) {
    out = ""
    while ((i = index(s, pat)) > 0) { out = out substr(s, 1, i - 1) rep; s = substr(s, i + length(pat)) }
    return out s
  }
  /<!--SPIELE-->/ { while ((getline line < ENVIRON["CARDS"]) > 0) print line; next }
  { $0 = put($0, "<!--ANZAHL-->", ENVIRON["N"]); $0 = put($0, "<!--TOP-SPIELE-->", ENVIRON["TOP"]); $0 = put($0, "<!--VERSION-->", ENVIRON["VER"]); $0 = put($0, "<!--ICONS-->", ENVIRON["ICONS"]); $0 = put($0, "<!--BILD-V-->", ENVIRON["BILDV"]); $0 = put($0, "<!--FREUNDE-V-->", ENVIRON["FREUNDEV"]); $0 = put($0, "<!--SPIELE-LISTE-->", ENVIRON["ITEMS"]); print put($0, "<!--TICKER-->", ENVIRON["TICKER"]) }
' "$START/index.html" > "$BUILD/index.html"
# Unterseite /updates/: alle Änderungen mit Datum und Uhrzeit (startseite/verlauf.html + verlauf.json)
mkdir -p "$BUILD/updates"
sed -e "s|<!--VERSION-->|$ver|g" -e "s|<!--ICONS-->|$(printf '%s' "$icons" | sed -e 's/href="\([a-z-]*\.[a-z]*\)/href="..\/\1/g' -e 's/[&|]/\\&/g')|" "$START/verlauf.html" > "$BUILD/updates/index.html"

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

if [ -n "$INDEXNOW_KEY" ] && command -v curl >/dev/null 2>&1; then
  # Ohne GNU date (z.B. macOS) nur die heute geänderten Spiele
  since="$(date -u -d '1 day ago' +%F 2>/dev/null || date -u +%F)"
  urls="$(SINCE="$since" HOME_URL="$SITE/" awk '
    match($0, /<loc>[^<]*<\/loc>/) {
      url = substr($0, RSTART + 5, RLENGTH - 11); mod = ""
      if (match($0, /<lastmod>[^<]*<\/lastmod>/)) mod = substr($0, RSTART + 9, RLENGTH - 19)
      if (url == ENVIRON["HOME_URL"] || mod >= ENVIRON["SINCE"]) printf "%s\"%s\"", (n++ ? "," : ""), url
    }
  ' "$BUILD/sitemap.xml")"
  if curl -fsS --max-time 20 -o /dev/null -H 'Content-Type: application/json; charset=utf-8' \
       -d "{\"host\":\"langwiligi.site\",\"key\":\"$INDEXNOW_KEY\",\"keyLocation\":\"$SITE/$INDEXNOW_KEY.txt\",\"urlList\":[$urls]}" \
       https://api.indexnow.org/indexnow; then
    echo "Suchmaschinen über IndexNow benachrichtigt: $(printf '%s' "$urls" | tr -cd ',' | wc -c | awk '{ print $1 + 1 }') Seiten."
  else
    echo "Hinweis: IndexNow nicht erreichbar, Suchmaschinen finden die Seiten trotzdem über sitemap.xml." >&2
  fi
fi
