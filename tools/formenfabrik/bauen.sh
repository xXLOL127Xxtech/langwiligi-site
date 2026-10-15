#!/bin/bash
# Baut games/formenfabrik/ aus dem Quellcode von shapez (tobspr Games, GPL-3.0) neu.
#
#   bash tools/formenfabrik/bauen.sh [ARBEITSORDNER]
#
# Braucht: git, curl, python3, ffmpeg und Java (für den Texture-Packer). Node 16 lädt das Skript selbst.
# Ablauf: shapez auf festem Stand holen → anpassen.py → Musik entfernen → Web-Version bauen
#         → Ergebnis nach games/formenfabrik/ kopieren (cover.webp und LIZENZ.md bleiben).
set -euo pipefail

SHAPEZ_REPO="https://github.com/tobspr-games/shapez.io.git"
SHAPEZ_COMMIT="8a79de5255fb6756f3a1d26579b1e9bc36e0c811"
NODE_VERSION="16.20.2"

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ZIEL="$ROOT/games/formenfabrik"
if [ -n "${1:-}" ]; then
  mkdir -p "$1" && WORK="$(cd "$1" && pwd)"
else
  WORK="$(mktemp -d)"
fi
SRC="$WORK/shapez"

for t in git curl python3 ffmpeg java; do
  command -v "$t" >/dev/null || { echo "Fehler: $t fehlt." >&2; exit 1; }
done

echo "== shapez holen ($SHAPEZ_COMMIT)"
if [ ! -d "$SRC/.git" ]; then
  git init -q "$SRC"
  git -C "$SRC" remote add origin "$SHAPEZ_REPO"
fi
git -C "$SRC" fetch -q --depth 1 origin "$SHAPEZ_COMMIT"
git -C "$SRC" checkout -q -f FETCH_HEAD
git -C "$SRC" clean -q -fdx -e node_modules -e src/js/core/config.local.js

echo "== Anpassen"
python3 -I "$HERE/anpassen.py" "$SRC"
# Ohne Musik: die Rechte am Soundtrack (Peppsen) sind nicht eindeutig GPL
git -C "$SRC" rm -rq res_raw/sounds/music

echo "== Node $NODE_VERSION"
NODE_DIR="$WORK/node-v$NODE_VERSION-linux-x64"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C "$WORK"
  "$NODE_DIR/bin/npm" install -g --silent yarn@1.22.19
fi
export PATH="$NODE_DIR/bin:$PATH"

echo "== Bauen"
(cd "$SRC" && yarn --frozen-lockfile --silent)
(cd "$SRC/gulp" && yarn --frozen-lockfile --silent && yarn -s gulp localConfig.findOrCreate && yarn -s gulp build.web-shapezio)

echo "== Nach games/formenfabrik/ kopieren"
B="$SRC/build"
# Nur für die chinesische bzw. WeGame-Version
rm -rf "$B/res/ui/interactive_tutorial.cn.noinline"
rm -f "$B"/res/logo_cn.png "$B"/res/logo_wegame.png "$B"/res/logo_demo.png "$B"/res/ui/*zh-*.png
cp "$SRC/electron/favicon.ico" "$B/favicon.ico"

mkdir -p "$ZIEL"
for f in index.html bundle.js main.css async-resources.css favicon.ico res; do
  rm -rf "${ZIEL:?}/$f"
  cp -r "$B/$f" "$ZIEL/$f"
done
echo "Fertig: $ZIEL ($(du -sh "$ZIEL" | cut -f1))"
