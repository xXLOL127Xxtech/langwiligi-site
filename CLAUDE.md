# Hinweise für KI-Assistenten

- Regeln für Spiele: [SPIEL-VORGABEN.md](SPIEL-VORGABEN.md). Gespielt wird am **Laptop mit Touchpad** (ohne Maus), Handys werden nicht unterstützt.
- Prüfen vor jedem Commit: `node tools/spiel-pruefen.js games/<spiel-id>`. Bei ❌ nicht abgeben.
- **Nach dem Bauen oder Ändern eines Spiels immer sofort committen, pushen und einen Pull Request erstellen**, ohne extra nachzufragen.
- **Updates-Liste**: Bei jeder Änderung, die Spieler sehen, in `startseite/updates.json` oben einen Eintrag ergänzen oder den von heute erweitern (`d` Datum, `t` Titel, `tag` Neu/Update/Intern, `p` Stichpunkte). Die Startseite zeigt sie im Fenster «Updates».
- Texte auf Deutsch in Schweizer Schreibweise (kein „ß“).
- Fertig gebaute Open-Source-Spiele: nur das Ergebnis in `games/<spiel-id>/`, Bauskript und Anpassungen in `tools/<spiel-id>/` (Beispiel: `tools/formenfabrik/`). Lizenz und Quelle in `games/<spiel-id>/LIZENZ.md`.
