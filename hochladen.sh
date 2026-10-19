#!/bin/bash
# Doppelklick auf hochladen.cmd:
#  - mit GitHub (nach einrichten.cmd): Änderungen speichern, Spiele der Freunde holen, zu GitHub schicken.
#    GitHub stellt die Webseite dann selbst online (.github/workflows/online-stellen.yml).
#  - ohne GitHub: wie früher direkt auf den Server laden (deploy.sh).
set -euo pipefail
cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  exec bash deploy.sh
fi

REPO="$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
git add -A
if ! git diff --cached --quiet; then
  echo "Geändert:"
  git diff --cached --stat | sed 's/^/  /'
  git commit -q -m "Spiele aktualisiert ($(date '+%d.%m.%Y %H:%M'))"
fi
echo "Hole Spiele deiner Freunde ..."
if ! git pull -q --rebase origin main; then
  git rebase --abort 2>/dev/null || true
  echo "Konflikt: Jemand hat auf GitHub dieselbe Datei geändert wie du. Nichts hochgeladen."
  echo "Mit 'git status' nachsehen, welche Datei betroffen ist."
  exit 1
fi
if [ "$(git rev-list --count origin/main..HEAD)" = "0" ]; then
  echo "Nichts Neues zum Hochladen. Online: http://46.224.94.231/"
  exit 0
fi
git push -q origin main
echo "Zu GitHub geschickt. In ca. 1 Minute online: http://46.224.94.231/"
echo "Fortschritt: https://github.com/$REPO/actions"
