# Dein Spiel auf langwiligi.site 🎮

Du hast ein Browser-Spiel gebaut (oder willst eins bauen)? So kommt es auf **[langwiligi.site](https://langwiligi.site/)**.
Du brauchst nur einen Browser und ein kostenloses GitHub-Konto. Kein Git, keine Kommandozeile.

---

## 1. Spiel vorbereiten

Dein Spiel ist **ein Ordner** mit diesem Inhalt:

```
panzer-pong/          ← Ordnername = Link: langwiligi.site/panzer-pong/
├── index.html        ← das Spiel (Startdatei)
├── cover.webp        ← Titelbild, 16:10, z.B. 1280 × 800, ohne Text
└── ...               ← Bilder, Sounds usw. (optional)
```

- **Ordnername**: nur Kleinbuchstaben, Ziffern und Bindestriche (`panzer-pong`, nicht `Panzer Pong`).
- **Oben in `index.html`**, direkt unter `<title>`:

  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Panzer-Pong</title>
  <meta name="description" content="Ein Satz, der Lust aufs Spiel macht.">
  <meta name="theme-color" content="#ff6b4a">
  <meta name="spiel-modi" content="Lokal,Online,Bots">
  <meta name="spiel-tags" content="1 gegen 1,3D">
  ```

  `spiel-modi` ist eine Auswahl aus `Lokal`, `Online`, `Bots`, `Solo`.
- **Testen**: `index.html` doppelklicken. Läuft es? Dann passt es.

Alle Regeln (Online-Modus, Ranglisten, Stil) stehen in **[SPIEL-VORGABEN.md](SPIEL-VORGABEN.md)**.

> 💡 **Tipp:** Hilft dir jemand beim Bauen? Gib die Datei [SPIEL-VORGABEN.md](SPIEL-VORGABEN.md) mit,
> dann passt das Spiel von Anfang an.

---

## 2. Hochladen (im Browser)

1. **GitHub-Konto** erstellen, falls du noch keins hast: [github.com/signup](https://github.com/signup) (kostenlos).
2. Auf dieser Seite oben in den Ordner **[`games`](games)** klicken.
3. Oben rechts **„Add file“ → „Upload files“**.
4. Deinen **ganzen Spielordner** (z.B. `panzer-pong`) aus dem Explorer/Finder ins Browserfenster ziehen.
   Die Liste muss danach Einträge wie `panzer-pong/index.html` zeigen, nicht nur `index.html`.
   *(Klappt in Chrome, Edge und Firefox. Auf dem Handy geht's nicht, nimm den Computer.)*
5. Unten bei „Commit changes“ kurz reinschreiben, was es ist, z.B. `Neues Spiel: Panzer-Pong`.
6. **„Propose changes“** klicken, auf der nächsten Seite **„Create pull request“** und nochmal **„Create pull request“**.

Fertig! Das nennt sich *Pull Request*: ein Vorschlag, dein Spiel aufzunehmen.

---

## 3. Was danach passiert

1. **Automatische Prüfung** (ca. 20 Sekunden): Unten im Pull Request erscheint
   - ✅ **Alles in Ordnung** – super, nichts zu tun.
   - ❌ **Fehler** – auf **„Details“** klicken, dort steht auf Deutsch, was fehlt.
     Korrigieren und die geänderten Dateien nochmal hochladen (siehe unten), die Prüfung läuft dann neu.

   Beim allerersten Mal steht dort evtl. *„Workflow awaiting approval“*. Das ist normal, der Besitzer gibt die Prüfung frei.
2. **Der Besitzer schaut sich dein Spiel an** und klickt auf „Merge“.
3. **Ca. 1 Minute später ist dein Spiel online**: `https://langwiligi.site/panzer-pong/`
   Es erscheint automatisch mit Bild und Beschreibung auf der Startseite.

---

## Spiel ändern oder korrigieren

- **Pull Request ist noch offen:** Im Pull Request oben auf deinen Branch-Namen klicken (z.B. `dein-name:patch-1`),
  in `games/panzer-pong/` gehen, „Add file → Upload files“, geänderte Dateien reinziehen (gleicher Name = wird ersetzt),
  **„Commit changes“**. Der Pull Request aktualisiert sich von selbst.
- **Spiel ist schon online:** Einfach wieder wie in Schritt 2 hochladen, aber in den Ordner `games/panzer-pong/` hineingehen
  und dort die Dateien reinziehen. Das gibt einen neuen Pull Request.
- Steht oben *„This branch is … commits behind“*: zuerst **„Sync fork“ → „Update branch“** klicken.

---

## Ohne GitHub?

Schick deinen Spielordner als **ZIP** direkt an den Besitzer der Seite. Der lädt ihn für dich hoch.

## Für Profis (Git)

```bash
# Repository forken, dann:
git clone https://github.com/<dein-name>/<repo>.git
cd <repo>
git switch -c panzer-pong
# Spiel nach games/panzer-pong/ legen
node tools/spiel-pruefen.js games/panzer-pong     # gleiche Prüfung wie auf GitHub
git add games/panzer-pong && git commit -m "Neues Spiel: Panzer-Pong" && git push -u origin panzer-pong
# dann auf GitHub den Pull Request erstellen
```

**Bitte nur Dateien in deinem eigenen Spielordner ändern.** Änderungen an der Webseite selbst
(`games/_shared/`, `deploy.sh`, `server/`, `.github/`) bitte vorher mit dem Besitzer absprechen.
