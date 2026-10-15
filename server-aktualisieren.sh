#!/bin/bash
# Doppelklick auf server-aktualisieren.cmd: bringt den Server auf den neusten Stand.
#  - Upload-Skript (/usr/local/bin/langwiligi-deploy), das GitHub beim Hochladen benutzt
#  - Spiel-Server (Online-Modus, Ranglisten, Bewertungen)
# Braucht deinen eigenen SSH-Zugang zum Server (wie deploy.sh). Kann gefahrlos mehrmals laufen.
set -euo pipefail
cd "$(dirname "$0")"
SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"

ok()     { printf '\033[1;32m✓\033[0m %s\n' "$1"; }
fehler() { printf '\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

echo "Verbinde mit dem Server ..."
ssh -o BatchMode=yes -o ConnectTimeout=15 "$SERVER" true 2>/dev/null \
  || fehler "Kein Zugang zum Server ($SERVER). Ist dein SSH-Schlüssel eingerichtet?"

scp -q -o BatchMode=yes server/langwiligi-deploy.sh "$SERVER:/usr/local/bin/langwiligi-deploy"
ssh -o BatchMode=yes "$SERVER" "chmod 755 /usr/local/bin/langwiligi-deploy"
ok "Upload-Skript aktualisiert"

scp -q -o BatchMode=yes server/game-hub.js "$SERVER:/tmp/game-hub.js"
ssh -o BatchMode=yes "$SERVER" "/usr/local/bin/langwiligi-deploy --hub /tmp/game-hub.js; rm -f /tmp/game-hub.js; rm -rf /var/www/games/.server"
ok "Spiel-Server geprüft"

if curl -fsS https://langwiligi.site/api/spiele >/dev/null 2>&1; then
  ok "Bewertungen sind aktiv: https://langwiligi.site/"
else
  fehler "Der Spiel-Server antwortet noch nicht auf /api/spiele. Bitte die Meldungen oben an Claude schicken."
fi
