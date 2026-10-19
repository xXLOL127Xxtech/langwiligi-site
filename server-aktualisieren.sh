#!/bin/bash
# Doppelklick auf server-aktualisieren.cmd: bringt den Server auf den neusten Stand.
#  - Upload-Skript (/usr/local/bin/langwiligi-deploy), das GitHub beim Hochladen benutzt
#  - Spiel-Server (Online-Modus, Ranglisten, Bewertungen)
#  - nginx: Webseite auch direkt über die IP (server/nginx-ip.conf), solange langwiligi.site gesperrt ist
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

# Webseite über die IP: neue nginx-Einstellung nur behalten, wenn nginx sie akzeptiert
scp -q -o BatchMode=yes server/nginx-ip.conf "$SERVER:/tmp/langwiligi-ip.conf"
ssh -o BatchMode=yes "$SERVER" 'set -e
  ziel=/etc/nginx/conf.d/langwiligi-ip.conf
  [ -f "$ziel" ] && cp -p "$ziel" "$ziel.bak"
  mv /tmp/langwiligi-ip.conf "$ziel"
  if nginx -t 2>/tmp/nginx-test.txt; then
    systemctl reload nginx
  else
    cat /tmp/nginx-test.txt >&2
    if [ -f "$ziel.bak" ]; then mv "$ziel.bak" "$ziel"; else rm -f "$ziel"; fi
    exit 1
  fi' || fehler "nginx hat die Einstellung für die IP nicht akzeptiert (siehe oben). Bitte die Meldungen an Claude schicken."
ok "Webseite über die IP eingerichtet"

# Läuft alles auf dem Server? (Spiel-Server, /api und /ws über nginx)
WS_KOPF=(-H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==')
ssh -o BatchMode=yes "$SERVER" '
  if ! systemctl is-active --quiet game-hub; then
    echo "Spiel-Server (game-hub) lief nicht, wird neu gestartet ..."
    systemctl restart game-hub; sleep 2
  fi
  if ! systemctl is-active --quiet game-hub; then
    journalctl -u game-hub -n 20 --no-pager >&2
    echo "FEHLER: Spiel-Server startet nicht." >&2; exit 1
  fi
  api=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: 46.224.94.231" http://127.0.0.1/api/spiele)
  ws=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 -H "Host: 46.224.94.231" -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" http://127.0.0.1/ws || true)
  echo "Auf dem Server: /api -> $api, /ws -> $ws"
  if [ "$api" != 200 ] || [ "$ws" != 101 ]; then
    echo "--- nginx-Einstellungen für Port 80 ---" >&2
    nginx -T 2>/dev/null | grep -nE "^# configuration file|listen|server_name|location|proxy_pass|return" >&2
    exit 1
  fi' || fehler "Auf dem Server klappt /api oder /ws noch nicht. Bitte die Meldungen oben an Claude schicken."
ok "Spiel-Server und Lobbys laufen auf dem Server"

# Und von hier aus (über das Internet)?
api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://46.224.94.231/api/spiele || true)"
ws="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${WS_KOPF[@]}" http://46.224.94.231/ws || true)"
if [ "$api" = 200 ] && [ "$ws" = 101 ]; then
  ok "Lobbys und Bewertungen funktionieren: http://46.224.94.231/"
else
  fehler "Der Server ist bereit, aber von hier aus kommt nichts an (/api -> $api, /ws -> $ws). Vermutlich blockiert dein Netzwerk (z.B. Schule) die Verbindung."
fi
