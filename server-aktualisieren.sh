#!/bin/bash
# Doppelklick auf server-aktualisieren.cmd: bringt den Server auf den neusten Stand.
#  - Upload-Skript (/usr/local/bin/langwiligi-deploy), das GitHub beim Hochladen benutzt
#  - Spiel-Server (Online-Modus, Ranglisten, Bewertungen)
#  - nginx: Webseite auch direkt über die IP (server/nginx-ip.conf), solange langwiligi.site gesperrt ist
# Braucht deinen eigenen SSH-Zugang zum Server (wie deploy.sh). Kann gefahrlos mehrmals laufen.
# Alles läuft über eine einzige SSH-Verbindung: Viele Verbindungen kurz hintereinander
# sperrt der Server (Schutz gegen Angriffe, z.B. "ufw limit"), das gibt "Connection abort".
set -euo pipefail
cd "$(dirname "$0")"
SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"
IP=46.224.94.231

ok()     { printf '\033[1;32m✓\033[0m %s\n' "$1"; }
fehler() { printf '\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

# Läuft auf dem Server. Die Dateien kommen als tar über stdin.
read -r -d '' AUF_DEM_SERVER <<'SKRIPT' || true
set -u
ok()     { echo "✓ $1"; }
fehler() { echo "✗ $1" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -xf - -C "$tmp" || fehler "Dateien sind nicht vollständig angekommen."

install -m 755 "$tmp/server/langwiligi-deploy.sh" /usr/local/bin/langwiligi-deploy
ok "Upload-Skript aktualisiert"

/usr/local/bin/langwiligi-deploy --hub "$tmp/server/game-hub.js"
rm -rf /var/www/games/.server
if ! systemctl is-active --quiet game-hub; then
  echo "Spiel-Server (game-hub) lief nicht, wird neu gestartet ..."
  systemctl restart game-hub; sleep 2
fi
if ! systemctl is-active --quiet game-hub; then
  journalctl -u game-hub -n 20 --no-pager >&2
  fehler "Spiel-Server startet nicht."
fi
ok "Spiel-Server läuft"

# Webseite über die IP: neue nginx-Einstellung nur behalten, wenn nginx sie akzeptiert
ziel=/etc/nginx/conf.d/langwiligi-ip.conf
[ -f "$ziel" ] && cp -p "$ziel" "$tmp/alt.conf"
install -m 644 "$tmp/server/nginx-ip.conf" "$ziel"
if nginx -t 2>"$tmp/nginx-test.txt"; then
  systemctl reload nginx
  sleep 1
else
  cat "$tmp/nginx-test.txt" >&2
  if [ -f "$tmp/alt.conf" ]; then install -m 644 "$tmp/alt.conf" "$ziel"; else rm -f "$ziel"; fi
  fehler "nginx hat die Einstellung für die IP nicht akzeptiert."
fi
ok "nginx für die IP eingerichtet"

api=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: __IP__" http://127.0.0.1/api/spiele)
ws=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 -H "Host: __IP__" -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" http://127.0.0.1/ws)
echo "Auf dem Server: /api -> $api, /ws -> $ws"
if [ "$api" != 200 ] || [ "$ws" != 101 ]; then
  echo "--- nginx-Einstellungen ---" >&2
  nginx -T 2>/dev/null | grep -nE "^# configuration file|listen|server_name|location|proxy_pass|return" >&2
  fehler "/api oder /ws klappt auf dem Server noch nicht."
fi
ok "Lobbys laufen auf dem Server"
SKRIPT
AUF_DEM_SERVER="${AUF_DEM_SERVER//__IP__/$IP}"

echo "Verbinde mit dem Server ..."
for versuch in 1 2 3; do
  status=0
  tar -cf - server/langwiligi-deploy.sh server/game-hub.js server/nginx-ip.conf \
    | ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=10 "$SERVER" "$AUF_DEM_SERVER" || status=$?
  [ "$status" = 0 ] && break
  # 255 = Verbindung kam nicht zustande oder brach ab; alles andere = Fehler auf dem Server
  [ "$status" = 255 ] || fehler "Auf dem Server hat etwas nicht geklappt (siehe oben). Bitte alle Meldungen kopieren und an den Betreiber der Seite schicken."
  [ "$versuch" = 3 ] && fehler "Keine Verbindung zum Server ($SERVER). Ist dein SSH-Schlüssel eingerichtet? Bitte alle Meldungen kopieren und an den Betreiber der Seite schicken."
  echo "Verbindung abgebrochen, neuer Versuch in 40 Sekunden ..."
  sleep 40
done

# Und von hier aus (über das Internet)?
api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$IP/api/spiele" || true)"
ws="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "http://$IP/ws" || true)"
if [ "$api" = 200 ] && [ "$ws" = 101 ]; then
  ok "Lobbys und Bewertungen funktionieren: http://$IP/"
else
  fehler "Der Server ist bereit, aber von hier aus kommt nichts an (/api -> $api, /ws -> $ws). Vermutlich blockiert dein Netzwerk (z.B. Schule) die Verbindung."
fi
