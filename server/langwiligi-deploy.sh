#!/bin/bash
# Empfängt die fertige Webseite als tar.gz über stdin und tauscht /var/www/games in einem Schritt aus.
# deploy.sh schickt dieses Skript bei jedem Hochladen mit. Für den GitHub-Schlüssel ist es fest
# als einziger erlaubter Befehl eingetragen (command=... in /root/.ssh/authorized_keys, siehe einrichten.sh),
# dafür liegt eine Kopie in /usr/local/bin/langwiligi-deploy.
set -euo pipefail
REMOTE_DIR=/var/www/games

# Nie zwei Uploads gleichzeitig
exec 9>/run/lock/langwiligi-deploy.lock
flock 9

rm -rf "$REMOTE_DIR.new" && mkdir -p "$REMOTE_DIR.new"
tar --no-same-owner --no-same-permissions -xzf - -C "$REMOTE_DIR.new"
# Verknüpfungen könnten auf Dateien ausserhalb der Webseite zeigen
find "$REMOTE_DIR.new" -type l -delete
if [ ! -f "$REMOTE_DIR.new/index.html" ]; then
  echo "Fehler: Im Paket fehlt die Startseite (index.html), nichts geändert." >&2
  rm -rf "$REMOTE_DIR.new"
  exit 1
fi
chown -R www-data:www-data "$REMOTE_DIR.new"
find "$REMOTE_DIR.new" -type d -exec chmod 755 {} + && find "$REMOTE_DIR.new" -type f -exec chmod 644 {} +
rm -rf "$REMOTE_DIR.old"
[ -d "$REMOTE_DIR" ] && mv "$REMOTE_DIR" "$REMOTE_DIR.old"
mv "$REMOTE_DIR.new" "$REMOTE_DIR"
rm -rf "$REMOTE_DIR.old"
echo "Server: $(find "$REMOTE_DIR" -mindepth 2 -maxdepth 2 -name index.html | wc -l) Spiele online."
