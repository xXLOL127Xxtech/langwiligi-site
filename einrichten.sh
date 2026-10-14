#!/bin/bash
# Einmalige Einrichtung: GitHub-Schlüssel auf dem Server erlauben, Repository auf GitHub anlegen,
# Schlüssel als Secret hinterlegen. Danach stellt GitHub jedes angenommene Spiel selbst online.
# Kann gefahrlos mehrmals ausgeführt werden.
set -euo pipefail
cd "$(dirname "$0")"

SERVER="root@46.224.94.231"
KEY="$HOME/.ssh/langwiligi-github-deploy"
DEFAULT_REPO="langwiligi-site"

schritt() { printf '\n\033[1;33m== %s ==\033[0m\n' "$1"; }
ok()      { printf '\033[1;32m✓\033[0m %s\n' "$1"; }
fehler()  { printf '\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

# ---------- 1. Schlüssel ----------
schritt "1/4  GitHub-Schlüssel"
if [ ! -f "$KEY" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "github-actions@langwiligi.site" -f "$KEY"
fi
ok "Schlüssel: $KEY  ($(ssh-keygen -lf "$KEY.pub" | cut -d' ' -f2))"

# ---------- 2. Server ----------
schritt "2/4  Server vorbereiten"
scp -q -o BatchMode=yes server/langwiligi-deploy.sh "$SERVER:/usr/local/bin/langwiligi-deploy"
PUB="$(cut -d' ' -f1,2 "$KEY.pub")"
ssh -o BatchMode=yes "$SERVER" "
  set -e
  chmod 755 /usr/local/bin/langwiligi-deploy
  touch ~/.ssh/authorized_keys
  if ! grep -qF '$PUB' ~/.ssh/authorized_keys; then
    cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-\$(date +%F)
    echo 'command=\"/usr/local/bin/langwiligi-deploy\",restrict $PUB github-actions@langwiligi.site' >> ~/.ssh/authorized_keys
  fi
"
# Test: Mit dem GitHub-Schlüssel darf nur das Upload-Skript laufen. Ein leeres Paket wird abgelehnt, nichts ändert sich.
test_out="$(tar -czf - -T /dev/null | ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$KEY" "$SERVER" id 2>&1 || true)"
if [[ "$test_out" == *"fehlt die Startseite"* ]]; then
  ok "Server nimmt den GitHub-Schlüssel an, aber nur zum Hochladen der Webseite"
else
  fehler "Test fehlgeschlagen: $test_out"
fi

# ---------- 3. GitHub-Anmeldung ----------
schritt "3/4  Bei GitHub anmelden"
GH="$(command -v gh || true)"
[ -n "$GH" ] || { [ -x "/c/Program Files/GitHub CLI/gh.exe" ] && GH="/c/Program Files/GitHub CLI/gh.exe"; } || true
if [ -z "$GH" ]; then
  echo "Das GitHub-Programm (gh) fehlt. Es wird jetzt mit winget installiert ..."
  winget install --id GitHub.cli -e
  GH="/c/Program Files/GitHub CLI/gh.exe"
  [ -x "$GH" ] || fehler "gh nicht gefunden. Bitte https://cli.github.com installieren und einrichten.cmd nochmal starten."
fi
if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Gleich öffnet sich der Browser. Code eingeben, GitHub-Zugriff bestätigen."
  "$GH" auth login --hostname github.com --git-protocol https --web --scopes workflow
else
  # "workflow" wird gebraucht, um die automatischen Abläufe (.github/workflows) hochzuladen
  "$GH" auth status 2>&1 | grep -q "'workflow'" || "$GH" auth refresh --hostname github.com --scopes workflow
fi
"$GH" auth setup-git >/dev/null
LOGIN="$("$GH" api user --jq .login)"
USER_ID="$("$GH" api user --jq .id)"
ok "Angemeldet als $LOGIN"

# ---------- 4. Repository ----------
schritt "4/4  Repository auf GitHub"
if [ ! -d .git ]; then
  git init -q -b main
fi
git config user.name "$LOGIN"
git config user.email "$USER_ID+$LOGIN@users.noreply.github.com"

if git remote get-url origin >/dev/null 2>&1; then
  REPO="$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
else
  read -r -p "Name des Repositorys [$DEFAULT_REPO]: " NAME
  NAME="${NAME:-$DEFAULT_REPO}"
  REPO="$LOGIN/$NAME"
fi

git add -A
git diff --cached --quiet || git commit -q -m "Spiele-Server: Spiele, Startseite und Hochladen über GitHub"

if ! git remote get-url origin >/dev/null 2>&1; then
  if "$GH" repo view "$REPO" >/dev/null 2>&1; then
    git remote add origin "https://github.com/$REPO.git"
  else
    "$GH" repo create "$REPO" --public --source . --remote origin \
      --description "Browser-Spiele für 1 gegen 1 – lokal, online oder gegen Bots. Spiel mit: https://langwiligi.site" \
      --homepage "https://langwiligi.site"
  fi
fi

# Secret zuerst setzen, damit schon der erste Upload klappt
"$GH" secret set DEPLOY_SSH_KEY --repo "$REPO" < "$KEY"
ok "Schlüssel als Secret DEPLOY_SSH_KEY hinterlegt (nur GitHub Actions kann ihn lesen)"

git push -q -u origin main
"$GH" repo edit "$REPO" --add-topic browser-games,html5-games,multiplayer,javascript,game-development >/dev/null || true
ok "Hochgeladen"

cat <<EOF

Fertig!
  Repository:          https://github.com/$REPO
  Link für Freunde:    https://github.com/$REPO/blob/main/MITMACHEN.md
  Uploads ansehen:     https://github.com/$REPO/actions
  Webseite:            https://langwiligi.site/

Ab jetzt lädt hochladen.cmd deine Änderungen über GitHub hoch (inkl. Spiele deiner Freunde).
EOF
