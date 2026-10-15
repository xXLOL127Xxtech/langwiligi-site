# Formenfabrik bauen

`games/formenfabrik/` ist die fertig gebaute Web-Version von [shapez](https://github.com/tobspr-games/shapez.io)
(tobspr Games, GPL-3.0), angepasst für langwiligi.site. Den Spielordner nicht von Hand ändern, sondern hier anpassen und neu bauen:

```bash
bash tools/formenfabrik/bauen.sh            # Arbeitsordner in /tmp
bash tools/formenfabrik/bauen.sh ~/shapez   # Arbeitsordner behalten (schneller beim nächsten Mal)
```

Braucht Linux (oder WSL) mit `git`, `curl`, `python3`, `ffmpeg` und Java. Node 16 lädt das Skript selbst. Dauer: ca. 5 Minuten.

| Datei | Inhalt |
|---|---|
| `bauen.sh` | Holt shapez auf festem Stand, passt es an, baut die Web-Version und kopiert sie nach `games/formenfabrik/` |
| `anpassen.py` | Alle Änderungen am Original (Vollversion, kein Tracking, keine Werbung, Deutsch, relative Pfade usw.) |

`cover.webp` und `LIZENZ.md` im Spielordner bleiben beim Neubauen erhalten.
Die GPL verlangt, dass der geänderte Quellcode verfügbar bleibt: Original-Stand + `anpassen.py` sind genau das, also beides nicht löschen.
