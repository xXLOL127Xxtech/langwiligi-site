# Hinweise für KI-Assistenten

- Regeln für Spiele: [SPIEL-VORGABEN.md](SPIEL-VORGABEN.md). Gespielt wird am **Laptop mit Touchpad** (ohne Maus), Handys werden nicht unterstützt.
- Qualität: Vor der Abgabe die [QUALITAET-CHECKLISTE.md](QUALITAET-CHECKLISTE.md) durchgehen (Spielgefühl, Touchpad, Online, Leistung usw.).
- Prüfen vor jedem Commit: `node tools/spiel-pruefen.js games/<spiel-id>`. Bei ❌ nicht abgeben.
- **Nach dem Bauen oder Ändern eines Spiels immer sofort committen, pushen und einen Pull Request erstellen**, ohne extra nachzufragen.
- **Updates-Liste**: Bei jeder Änderung, die Spieler sehen, in `startseite/updates.json` oben einen Eintrag ergänzen oder den von heute erweitern (`d` Datum, `t` Titel, `tag` Neu/Update/Intern, `p` Stichpunkte). Die Startseite zeigt sie im Fenster «Updates».
- **Updates-Verlauf (Unterseite `/updates/`)**: Bei **jeder** Änderung, auch der kleinsten, zusätzlich in `startseite/verlauf.json` oben einen Eintrag ergänzen: `d` Datum, `z` Uhrzeit (HH:MM), `a` Bereich (z.B. Spielname, Startseite, Server), `t` kurzer Text ohne viele Details, `tag` Neu/Update/Intern, `k` Art des Updates (Neues Spiel, Spielmechanik, Balance, Grafik, Sound, Oberfläche, Lobby, Online, Freunde, Startseite, Fehlerbehebung, Server, Suchmaschinen, Admin, Doku), `pr` Nummer des Pull Requests (oder `null`), `b` Branch ohne `claude/`. Neueste Einträge zuerst. Die Seite baut `deploy.sh` nach `/updates/`.
- Texte auf Deutsch in Schweizer Schreibweise (kein „ß“).
- Fertig gebaute Open-Source-Spiele: nur das Ergebnis in `games/<spiel-id>/`, Bauskript und Anpassungen in `tools/<spiel-id>/` (Beispiel: `tools/formenfabrik/`). Lizenz und Quelle in `games/<spiel-id>/LIZENZ.md`.
