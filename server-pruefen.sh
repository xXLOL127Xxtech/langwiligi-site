#!/bin/bash
# Doppelklick auf server-pruefen.cmd: schaut nach, warum langwiligi.site langsam oder nicht erreichbar ist
# (Server überlastet, Speicher oder Festplatte voll, Dienst abgestürzt, viele Anfragen von wenigen Adressen).
# Ändert nichts, liest nur. Das Ergebnis öffnet sich am Schluss im Editor: alles kopieren und an Claude schicken.
set -uo pipefail
cd "$(dirname "$0")"
SERVER="${DEPLOY_SERVER:-root@46.224.94.231}"
IP="${SERVER#*@}"
OUT="${TEMP:-/tmp}/langwiligi-pruefung.txt"

exec > >(tee "$OUT") 2>&1
titel() { printf '\n== %s ==\n' "$1"; }

echo "Prüfung vom $(date '+%d.%m.%Y %H:%M:%S')"

titel "Von deinem Laptop aus (000 = keine Antwort)"
for u in https://langwiligi.site/ https://langwiligi.site/schach/ https://langwiligi.site/api/spiele; do
  printf '%-36s %s\n' "$u" "$(curl -s -o /dev/null -m 20 -w '%{http_code} in %{time_total}s' "$u")"
done
# Direkt an die Server-Adresse, ohne Namensauflösung: klappt das, aber oben nicht, liegt es am Domainnamen (DNS)
printf '%-36s %s\n' "direkt an $IP" \
  "$(curl -s -o /dev/null -m 20 --resolve "langwiligi.site:443:$IP" -w '%{http_code} in %{time_total}s' https://langwiligi.site/)"
titel "Wohin zeigt langwiligi.site?"
nslookup langwiligi.site 2>&1 | tail -n 4

titel "Server per SSH"
if ! ssh -o BatchMode=yes -o ConnectTimeout=30 "$SERVER" true 2>/dev/null; then
  echo "Kein SSH-Zugang zum Server ($SERVER)."
  echo "Wenn auch oben überall 000 steht: Server ist aus, hängt oder wurde vom Anbieter gesperrt."
  echo "Dann in der Konsole deines Server-Anbieters nachsehen (läuft er? E-Mail wegen Sperre?) und ihn neu starten."
else
  ssh -o BatchMode=yes "$SERVER" 'bash -s' <<'EOF'
titel() { printf '\n== %s ==\n' "$1"; }
LOG=/var/log/nginx/access.log
WEB="( sport = :443 or sport = :80 )"

titel "Laufzeit und Last (Last über ~2 bei 1-2 Kernen = überlastet)"
uptime; echo "Kerne: $(nproc)"
titel "Arbeitsspeicher (MB)"
free -m
titel "Festplatte"
df -h / /var 2>/dev/null | uniq
titel "Dienste"
for s in nginx game-hub; do printf '%-9s %s\n' "$s" "$(systemctl is-active "$s")"; done
titel "Programme mit der meisten Rechenzeit"
ps aux --sort=-%cpu | head -n 8 | cut -c1-150

titel "Offene Verbindungen zur Webseite"
ss -Htn state established "$WEB" | wc -l
titel "Adressen mit den meisten offenen Verbindungen"
ss -Htn state established "$WEB" | awk '{print $4}' | sed 's/:[0-9]*$//' | sort | uniq -c | sort -rn | head -n 10

if [ -r "$LOG" ]; then
  titel "Anfragen pro Minute (letzte 20 Minuten im Protokoll)"
  tail -n 100000 "$LOG" | awk '{print substr($4,2,17)}' | uniq -c | tail -n 20
  titel "Adressen mit den meisten Anfragen (letzte 100000)"
  tail -n 100000 "$LOG" | awk '{print $1}' | sort | uniq -c | sort -rn | head -n 15
  titel "Meistgefragte Seiten"
  tail -n 100000 "$LOG" | awk '{print $7}' | cut -d'?' -f1 | sort | uniq -c | sort -rn | head -n 15
  titel "Häufigste Browser bzw. Bots"
  tail -n 100000 "$LOG" | awk -F'"' '{print $6}' | cut -c1-110 | sort | uniq -c | sort -rn | head -n 12
  titel "Antwort-Codes"
  tail -n 100000 "$LOG" | awk '{print $9}' | sort | uniq -c | sort -rn | head -n 8
else
  echo "Kein Zugriffsprotokoll unter $LOG gefunden."
fi

titel "Letzte Fehler von nginx"
tail -n 15 /var/log/nginx/error.log 2>/dev/null | cut -c1-220
titel "Letzte Meldungen vom Spiel-Server"
journalctl -u game-hub -n 15 --no-pager 2>/dev/null | cut -c1-220
titel "Speicher voll? (Programme, die das System beenden musste, letzte 2 Tage)"
journalctl -k --since "-2 days" --no-pager 2>/dev/null | grep -i -E "out of memory|oom-kill|killed process" | tail -n 8 | cut -c1-220
echo "(fertig)"
EOF
fi

echo
echo "Ergebnis gespeichert in: $OUT"
# Im Editor öffnen, damit es sich leicht kopieren lässt
command -v notepad.exe >/dev/null && notepad.exe "$(cygpath -w "$OUT" 2>/dev/null || echo "$OUT")" &
