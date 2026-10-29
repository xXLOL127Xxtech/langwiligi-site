# Qualitäts-Checkliste für alle Spiele – KEI Langwiligi site

Diese Liste gilt für **jedes** Spiel auf https://langwiligi.site/, neu oder geändert. Sie ergänzt [SPIEL-VORGABEN.md](SPIEL-VORGABEN.md) (Regeln) um das, was ein Skript nicht prüfen kann: Wie fühlt sich das Spiel an?

**So benutzt du sie:** Kopiere die Liste in den Pull Request und hake ab. Ein Punkt, der nicht zutrifft (z.B. «Online» bei einem Solo-Spiel), wird mit «–» markiert. Mit 🤖 markierte Punkte prüft `node tools/spiel-pruefen.js games/<spiel-id>` automatisch. Bei ❌ nicht abgeben.

Getestet wird so, wie gespielt wird: **Laptop, Touchpad, keine Maus**, Fenster auch auf 1366 × 768.

---

## 1. Technik und Abgabe 🤖

- [ ] Ordnername = Spiel-ID = `GAME_ID` im Code (klein, ohne Umlaute und Leerzeichen, höchstens 40 Zeichen)
- [ ] `index.html` direkt im Ordner, nur relative Pfade
- [ ] Pflicht-Kopf komplett: `<title>`, `description` (höchstens ~110 Zeichen), `theme-color`, `spiel-modi`, `spiel-typ`, `spiel-tags`; `spiel-suche` empfohlen
- [ ] `spiel-modi` und `spiel-typ` nutzen nur erlaubte Wörter; Modi stehen nicht in `spiel-tags`
- [ ] `cover.webp` 16:10 (1280 × 800), ohne Text, unter 100 KB, Wichtiges in der Mitte
- [ ] Ordner höchstens 100 MB (besser unter 30 MB), keine Datei über 25 MB
- [ ] Externe Dateien nur von cdnjs (feste Version) oder Google Fonts, kein Tracking, keine Werbung
- [ ] Kein `alert()`, `confirm()`, `prompt()`
- [ ] Keine Reservierungen verletzt: kein `lw-back`, keine `lw-`-Klassen, kein `window.GameHub`/`window.LW` überschrieben
- [ ] localStorage-Schlüssel beginnen mit der Spiel-ID
- [ ] Texte auf Deutsch, Schweizer Schreibweise (kein «ß»)

## 2. Start und Konsole

- [ ] Spiel öffnet per Doppelklick lokal **ohne** Fehler in der Konsole (F12)
- [ ] Spiel startet auch ohne `GameHub` (Online-Teile werden dann ausgeblendet)
- [ ] Spiel öffnet auf der Webseite ohne Fehler, auch nach Neuladen (F5) und mit Einladungslink `#CODE`
- [ ] Ladezeit auf normalem WLAN unter ca. 3 Sekunden, bei grossen Spielen Ladeanzeige
- [ ] Keine 404-Meldungen im Netzwerk-Tab (fehlende Bilder, Sounds, Schriften)
- [ ] Spiel lädt die ganze Seite nie neu und leitet nicht auf andere Domains um

## 3. Steuerung (Laptop mit Touchpad)

- [ ] Komplett spielbar mit **Tastatur und Touchpad**, ohne Maus
- [ ] Nur Linksklick, Ziehen mit gedrückter Taste und Zwei-Finger-Scrollen nötig; kein Mittelklick
- [ ] Rechtsklick und Mausrad nur, wenn es dafür auch eine Taste gibt
- [ ] Steuerung steht auf dem Startbildschirm (Tastatur **und** Touchpad)
- [ ] Keine Eingabe hängt: Taste loslassen, Fenster verlassen oder zwei Tasten gleichzeitig lässt nichts «kleben»
- [ ] Bei 2 Spielern an einer Tastatur stören sich die Tastenblöcke nicht (Ghosting auf Laptops bedenken)
- [ ] Pfeiltasten, Leertaste und Scrollen verschieben nicht die Seite
- [ ] Zeiger-Ziele (Knöpfe, Felder) sind gross genug für ein Touchpad

## 4. Bildschirm und Layout

- [ ] Auf **1366 × 768** ist nichts abgeschnitten, nichts überlappt, kein Scrollbalken im Spiel
- [ ] Auf grossen Bildschirmen (1920 × 1080 und mehr) sieht es sauber aus
- [ ] Fenstergrösse ändern (`resize`) und Browser-Zoom 90–125 % zerstören nichts
- [ ] Linker Rand in der Mitte (ca. 130 × 50 px) frei, unten rechts Platz für die Bewertung
- [ ] Kein eigener «Zurück zur Startseite»-Knopf; ein «Menü»-Knopf im Spiel ist erlaubt
- [ ] Texte gut lesbar (Kontrast, Schriftgrösse), nichts läuft aus dem Kasten
- [ ] Optik passt zur Seite: dunkler Hintergrund, runde Panels, Akzentfarbe = `theme-color`, Spieler 1 blau, Spieler 2 rot

## 5. Spielablauf

- [ ] Startbildschirm mit Name, kurzer Anleitung und Moduswahl
- [ ] Jeder Modus aus `spiel-modi` ist vorhanden **und** funktioniert (Lokal, Online, Bots, Solo)
- [ ] Ziel und Siegbedingung sind ohne Vorwissen klar
- [ ] Rundenende mit klarem Ergebnis, «Nochmal» und «Menü» funktionieren, auch mehrmals hintereinander
- [ ] Nach «Nochmal» ist alles zurückgesetzt (Punkte, Timer, Gegner, Tasten, Effekte)
- [ ] `LW.rundeFertig()` wird am Ende jeder Runde aufgerufen (Sieg, Niederlage, Game Over)
- [ ] Pause beim Verlassen des Tabs (`visibilitychange`), ausser online
- [ ] Es gibt keine Sackgassen: Man kommt aus jedem Bildschirm zurück ins Menü
- [ ] Mindestens 5 Minuten am Stück gespielt, ohne Absturz, Hänger oder unmögliche Lage («Softlock»)

## 6. Spielgefühl und Balance

- [ ] Reaktion auf Eingaben ohne spürbare Verzögerung
- [ ] Beide Seiten haben fair gleiche Chancen (kein klarer Vorteil für Spieler 1/2 oder den Host)
- [ ] Kein Spiel gewinnt man mit einer einzigen Dauer-Taktik (Spammen, Verstecken, Campen)
- [ ] Schwierigkeit steigt langsam; der Einstieg ist für Neulinge schaffbar
- [ ] Feedback bei Treffern, Punkten, Fehlern (Bewegung, Farbe oder Ton)
- [ ] Kollisionen und Hitboxen fühlen sich korrekt an, nichts bleibt in Wänden stecken oder fällt durch den Boden
- [ ] Zufall ist fair (kein unlösbares Level, keine unmöglichen Startlagen)

## 7. Bots (falls vorhanden)

- [ ] Mehrere Stufen (Leicht/Mittel/Schwer), die sich **spürbar** unterscheiden
- [ ] «Leicht» ist für Anfänger schlagbar, «Schwer» fordert, ist aber nicht unfair (kein Hellsehen, keine Aimbot-Treffer)
- [ ] Bots bleiben nicht stehen, laufen nicht gegen Wände und lösen sich aus Sackgassen
- [ ] Bot-Spiele zählen **nicht** in die Online-Rangliste

## 8. Online (falls `Online` in `spiel-modi`)

- [ ] Raum erstellen, Code anzeigen, Link kopieren funktioniert
- [ ] Beitreten per Code **und** per Einladungslink `…/<spiel-id>/#CODE` (Name wird abgefragt)
- [ ] Fehler `not-found`, `full`, `wrong-game`, `timeout` zeigen deutsche Texte (`GameHub.errorText`)
- [ ] Mit **zwei echten Browsern/Geräten** gespielt, ein ganzes Spiel bis zum Ende
- [ ] `peer-left` und `close` werden abgefangen: Meldung statt Absturz oder Endlos-Warten
- [ ] Host rechnet, Gäste zeigen an; Gast und Host sehen dasselbe Ergebnis
- [ ] Nachrichten sparsam (ca. 20–30 pro Sekunde, bei vielen Spielern höchstens ~5 Positionen pro Sekunde)
- [ ] Bei Spielen mit gemeinsamer Welt: `room.quick`, Einladungslink führt in dieselbe Welt
- [ ] Rangliste: `roundStart()` und `result()` nur vom Host, Unentschieden = `-1`
- [ ] Verzögerung (Lag) ist spielbar, Gast kann nicht schummeln, indem er Host-Zustand ändert (soweit zumutbar)

## 9. Highscores (falls Solo-Rangliste)

- [ ] `submitScore` mit passendem `jumps`-Wert (Punkte ≤ (jumps + 1) × 450)
- [ ] Lokal schlägt das Melden fehl, ohne dass das Spiel abstürzt
- [ ] Rangliste wird nach dem Spiel und im Menü angezeigt, eigener Name ist hervorgehoben

## 10. Ton

- [ ] Ton startet erst nach der ersten Eingabe
- [ ] Stumm-Knopf vorhanden, Einstellung bleibt erhalten
- [ ] Lautstärke angenehm und gleichmässig; keine Knackser, keine Endlosschleifen mit Sprung
- [ ] Spiel ist auch **ohne Ton** vollständig verständlich

## 11. Leistung

- [ ] Flüssig (~60 FPS) auf einem normalen Laptop **ohne** eigene Grafikkarte, auch im Akkubetrieb
- [ ] `requestAnimationFrame` statt `setInterval` für die Grafik; Zeit mit Delta-Zeit statt Bildzahl, damit es auf 30/60/120 Hz gleich schnell läuft
- [ ] `devicePixelRatio` höchstens 2
- [ ] Kein Speicherleck: nach 10 Runden gleich flüssig wie am Anfang
- [ ] Hintergrund-Tab verbraucht keine Rechenzeit (Pause)

## 12. Barrierefreiheit und Fairness

- [ ] Wichtige Infos nicht nur über Farbe (zusätzlich Form, Symbol oder Text); rot/grün allein genügt nicht
- [ ] Keine schnellen Blitze oder flackernden Vollbild-Effekte
- [ ] Texte kurz und verständlich, auch für Kinder; keine Beleidigungen, kein Namens-Filter vergessen bei Online-Namen (höchstens 16 Zeichen)
- [ ] Keine persönlichen Daten ausser dem Spielernamen

## 13. Startseite und Auffindbarkeit

- [ ] Karte auf der Startseite prüfen: Titelbild, Name, Beschreibung, Schildchen und Farbe sehen gut aus
- [ ] Typ-Filter stimmt (`Chill` nur für ruhige Spiele ohne Zeitdruck und Action)
- [ ] `spiel-suche` mit echten Suchwörtern gesetzt, ohne fremde Markennamen
- [ ] Bei Open-Source-Spielen: `LIZENZ.md` mit Quelle und Lizenz, Bauskript in `tools/<spiel-id>/`

## 14. Abschluss vor dem Commit

- [ ] `node tools/spiel-pruefen.js games/<spiel-id>` ohne ❌
- [ ] Eintrag oben in `startseite/verlauf.json` (immer) und in `startseite/updates.json` (bei sichtbaren Änderungen)
- [ ] Committet, gepusht, Pull Request erstellt
- [ ] Nach dem Veröffentlichen: Spiel auf https://langwiligi.site/ einmal kurz anspielen, bei Online mit einem Freund

---

## Regelmässiger Gesamtcheck (alle Spiele)

Etwa einmal im Monat und nach jeder Änderung an `games/_shared/` (`hub.js`, `freunde.js`, `back.js`) oder am Server:

- [ ] `node tools/spiel-pruefen.js` (ohne Pfad = alle Spiele) ohne ❌, Hinweise (⚠️) durchgehen
- [ ] Jedes Spiel einmal öffnen: Startet es? Konsole sauber? «Alle Spiele»-Knopf und Freunde-Knopf sichtbar und nicht verdeckt?
- [ ] Je ein Online-Spiel pro Typ (Duell, offene Welt, Rangliste) mit zwei Geräten testen
- [ ] Bewertungen und Rückmeldungen der Spieler lesen und als Aufgaben festhalten
- [ ] Startseite: Filter, Chill-Lounge, Suche, Updates-Fenster und `/updates/` prüfen
- [ ] Gesamtgrösse der Webseite im Blick behalten (jeder Upload schickt alles auf den Server)
