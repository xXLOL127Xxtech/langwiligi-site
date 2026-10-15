#!/bin/bash
# Empfängt die fertige Webseite als tar.gz über stdin und tauscht /var/www/games in einem Schritt aus.
# deploy.sh schickt dieses Skript bei jedem Hochladen mit. Für den GitHub-Schlüssel ist es fest
# als einziger erlaubter Befehl eingetragen (command=... in /root/.ssh/authorized_keys, siehe einrichten.sh),
# dafür liegt eine Kopie in /usr/local/bin/langwiligi-deploy.
#
# Liegt im Paket .server/game-hub.js, wird der Spiel-Server damit aktualisiert (nur wenn er sich geändert hat).
# Nur Spiel-Server aktualisieren (mit eigenem Zugang, nicht über den GitHub-Schlüssel):
#   langwiligi-deploy --hub /tmp/game-hub.js
set -euo pipefail
REMOTE_DIR=/var/www/games

# Spiel-Server austauschen. Startet er danach nicht, kommt die alte Version zurück.
update_hub() {
  local new="$1" exec_line js wd node
  exec_line="$(systemctl show -p ExecStart --value game-hub 2>/dev/null || true)"
  js="$(printf '%s' "$exec_line" | grep -oE '[^ ;=]+\.js' | head -1 || true)"
  if [ -n "$js" ] && [ "${js#/}" = "$js" ]; then
    wd="$(systemctl show -p WorkingDirectory --value game-hub 2>/dev/null || true)"
    js="${wd:-/}/$js"
  fi
  if [ -z "$js" ] || [ ! -f "$js" ]; then
    echo "Hinweis: Dienst game-hub nicht gefunden, Spiel-Server nicht aktualisiert." >&2
    return 0
  fi
  if cmp -s "$new" "$js"; then return 0; fi
  node="$(printf '%s' "$exec_line" | grep -oE '[^ ;=]*/node\b' | head -1 || true)"
  node="${node:-$(command -v node || true)}"
  if [ -n "$node" ]; then
    # node --check verlangt eine Datei mit Endung .js
    local chk
    chk="$(mktemp --suffix=.js)"
    cp "$new" "$chk"
    if ! "$node" --check "$chk"; then
      rm -f "$chk"
      echo "Fehler: game-hub.js hat einen Syntaxfehler, Spiel-Server nicht aktualisiert." >&2
      return 0
    fi
    rm -f "$chk"
  fi
  cp -p "$js" "$js.bak"
  install -m 644 "$new" "$js"
  systemctl restart game-hub
  sleep 2
  if systemctl is-active --quiet game-hub; then
    echo "Server: Spiel-Server aktualisiert."
  else
    echo "Fehler: Neuer Spiel-Server startet nicht, alte Version wiederhergestellt." >&2
    install -m 644 "$js.bak" "$js"
    systemctl restart game-hub || true
  fi
}

# Nie zwei Uploads gleichzeitig
exec 9>/run/lock/langwiligi-deploy.lock
flock 9

if [ "${1:-}" = "--hub" ]; then
  update_hub "${2:?Datei fehlt}"
  exit 0
fi

rm -rf "$REMOTE_DIR.new" && mkdir -p "$REMOTE_DIR.new"
tar --no-same-owner --no-same-permissions -xzf - -C "$REMOTE_DIR.new"
# Verknüpfungen könnten auf Dateien ausserhalb der Webseite zeigen
find "$REMOTE_DIR.new" -type l -delete
if [ ! -f "$REMOTE_DIR.new/index.html" ]; then
  echo "Fehler: Im Paket fehlt die Startseite (index.html), nichts geändert." >&2
  rm -rf "$REMOTE_DIR.new"
  exit 1
fi
# Spiel-Server gehört nicht auf die Webseite
HUB_TMP=""
if [ -f "$REMOTE_DIR.new/.server/game-hub.js" ]; then
  HUB_TMP="$(mktemp --suffix=.js)"
  mv "$REMOTE_DIR.new/.server/game-hub.js" "$HUB_TMP"
fi
rm -rf "$REMOTE_DIR.new/.server"
chown -R www-data:www-data "$REMOTE_DIR.new"
find "$REMOTE_DIR.new" -type d -exec chmod 755 {} + && find "$REMOTE_DIR.new" -type f -exec chmod 644 {} +
rm -rf "$REMOTE_DIR.old"
[ -d "$REMOTE_DIR" ] && mv "$REMOTE_DIR" "$REMOTE_DIR.old"
mv "$REMOTE_DIR.new" "$REMOTE_DIR"
rm -rf "$REMOTE_DIR.old"
echo "Server: $(find "$REMOTE_DIR" -mindepth 2 -maxdepth 2 -name index.html | wc -l) Spiele online."
if [ -n "$HUB_TMP" ]; then
  update_hub "$HUB_TMP"
  rm -f "$HUB_TMP"
fi
