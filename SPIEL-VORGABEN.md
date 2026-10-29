# Vorgaben für neue Spiele – KEI Langwiligi site

Diese Datei beschreibt alles, was ein HTML-Spiel braucht, damit es auf **https://langwiligi.site/** läuft.
Du brauchst keinen Zugriff auf die Webseite. Halte dich an diese Regeln und liefere am Ende einen Ordner ab (siehe Abschnitt 9).

---

## 1. Grundregeln (Pflicht)

| Regel | Details |
|---|---|
| **Ein Ordner pro Spiel** | Der Ordnername ist die **Spiel-ID** und wird Teil des Links: `https://langwiligi.site/<spiel-id>/`. Nur Kleinbuchstaben, Ziffern und Bindestriche, keine Umlaute oder Leerzeichen, höchstens 40 Zeichen. Beispiel: `panzer-pong`. |
| **Startdatei `index.html`** | Das Spiel startet mit `<spiel-id>/index.html`. Am besten steckt alles in dieser einen Datei (HTML, CSS, JS). |
| **Nur relative Pfade** | Bilder und Sounds liegen im selben Ordner und werden relativ eingebunden (`sprite.png`, nicht `/sprite.png` oder `C:\...`). |
| **Reines Frontend** | Kein eigener Server, kein PHP, kein Node, kein Build-Schritt (kein npm, Vite, Webpack). Die Datei muss direkt im Browser laufen, auch per Doppelklick lokal. Ausnahme: Fertig gebaute Open-Source-Spiele (z.B. die Formenfabrik). Dann liegt nur das gebaute Ergebnis im Spielordner und das Bauskript in `tools/<spiel-id>/`. Das richtet der Besitzer der Seite ein. |
| **Externe Bibliotheken** | Nur von `https://cdnjs.cloudflare.com/` mit fester Versionsnummer, z.B. `three.js/r128/three.min.js` oder `planck-js/1.4.3/planck.min.js`. Google Fonts sind erlaubt. Sonst nichts von fremden Servern. |
| **Sprache** | Alle Texte auf Deutsch, Schweizer Schreibweise **ohne ß** (also „Spass“, „schiess“, „gross“). |
| **Laptop mit Touchpad** | Gespielt wird am Laptop, oft **ohne Maus**. Das Spiel muss komplett mit Tastatur und Touchpad spielbar sein: Linksklick, Ziehen mit gedrückter Taste und Scrollen mit zwei Fingern (kommt im Spiel wie ein Mausrad an). Kein Mittelklick nötig. Rechtsklick und Mausrad nur, wenn es dafür auch eine Taste gibt. Handys müssen nicht unterstützt werden. |
| **Grösse** | Höchstens **100 MB** pro Spielordner und **25 MB** pro Datei (grössere Dateien lädt GitHub im Browser nicht hoch). Am besten bleibt das ganze Spiel unter 30 MB, damit es schnell lädt. |
| **Keine Werbung oder Tracking** | Keine Analytics, keine Cookies, keine Werbung, keine Logins und keine Abfrage von persönlichen Daten ausser einem Spielernamen. |
| **Keine Popups** | Kein `alert()`, `confirm()` oder `prompt()`. Meldungen gehören ins eigene Spiel-UI. |

## 2. Pflicht-Kopf in `index.html`

Direkt nach `<title>` stehen diese Zeilen. Daraus baut die Startseite automatisch die Spielkarte.

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Panzer-Pong</title>
<meta name="description" content="Ein Satz, max. ~110 Zeichen, der Lust aufs Spiel macht.">
<meta name="theme-color" content="#ff6b4a">
<meta name="spiel-modi" content="Lokal,Online,Bots">
<meta name="spiel-tags" content="1 gegen 1,3D">
<meta name="spiel-typ" content="Action,3D">
```

- **`<title>`**: Name des Spiels, so wie er auf der Startseite stehen soll.
- **`description`**: Kurzbeschreibung unter dem Namen auf der Karte.
- **`theme-color`**: Akzentfarbe der Karte als Hex-Wert. Nimm eine kräftige Farbe, die gut auf dunklem Hintergrund wirkt.
- **`spiel-modi`**: Eine Auswahl aus genau diesen vier Wörtern, durch Komma getrennt:
  - `Lokal`: 2 Spieler an einem Gerät
  - `Online`: gegen Freunde über das Internet (siehe Abschnitt 6)
  - `Bots`: gegen Computer-Gegner
  - `Solo`: allein spielen, z.B. auf Punkte oder Level
- **`spiel-typ`**: 1–3 Typen für den Typ-Filter der Startseite, durch Komma getrennt. Erlaubt sind genau diese Wörter:
  `3D`, `Pixel-Art`, `Action`, `Strategie`, `Klassiker`, `Denkspiel`, `Geschick`, `Physik`, `Rennen`, `Party`, `Aufbau`, `Chill`. `Chill` kommt in die «Chill-Lounge» der Startseite: ruhige Spiele ohne Zeitdruck und ohne Action (Brettspiele, Knobeln, Aufbau).
- **`spiel-tags`**: Freie Schildchen auf dem Bild, höchstens 2–3 kurze Begriffe (z.B. `1 gegen 1`, `3D`, `Rangliste`, `Strategie`). Die Modi aus `spiel-modi` gehören hier **nicht** hinein.
- **`spiel-suche`** (freiwillig, aber empfohlen): Wörter, die Leute bei Google eintippen, wenn sie so ein Spiel suchen, durch Komma getrennt, z.B. `<meta name="spiel-suche" content="Käsekästchen, Kästchenspiel">`. Das erste Wort kommt für Google in den Seitentitel (`Dots and Boxes (Käsekästchen) – online zu zweit spielen …`). Keine Markennamen anderer Spiele.

## 3. Titelbild (Pflicht)

- Dateiname **`cover.webp`** im Spielordner (`cover.png` oder `cover.jpg` gehen auch).
- Format **16:10**, am besten **1280 × 800** Pixel, möglichst unter 100 KB.
- **Kein Text im Bild**, denn Name und Schildchen setzt die Startseite selbst darüber.
- Oben links legen sich Schildchen über das Bild, unten blendet es in die Karte über. Das Wichtigste gehört deshalb in die Mitte.
- Kräftig, bunt und klar erkennbar, worum es im Spiel geht. Ein Spiel-Screenshot oder eine Illustration ist beides in Ordnung.
- Kein SVG mit vielen Unschärfe- oder Leuchteffekten, sonst ruckelt die Startseite.

## 4. Reservierte Bereiche und Namen (nicht verwenden)

- **Linker Rand, vertikal in der Mitte (ca. 130 × 50 px)**: Hier blendet die Webseite automatisch einen „← Alle Spiele“-Knopf ein (auf kleinen Bildschirmen nach 4 Sekunden nur noch ca. 50 × 50 px). Dort keine wichtigen Knöpfe oder Anzeigen platzieren.
- **Keinen eigenen Zurück-zur-Startseite-Knopf bauen.** Ein eigener „Menü“-Knopf innerhalb des Spiels ist erlaubt.
- Diese Namen sind von der Webseite belegt:
  - ID `lw-back`
  - CSS-Klassen, die mit `lw-` beginnen
  - die globalen Variablen `window.GameHub` und `window.LW`
- **Freunde und Einladungen** übernimmt die Webseite komplett (`games/_shared/freunde.js`): Unter dem „Alle Spiele“-Knopf (linker Rand, Mitte) sitzt ein „Freunde“-Knopf. Sobald das Spiel über `GameHub.connect()` einen Online-Raum erstellt, klappt links ein Panel auf (Einladungslink mit Vorschaubild, Freunde, Leute aus der Lobby). Einladungen von anderen erscheinen als Karte oben in der Mitte. Das Spiel muss dafür nichts einbauen und diesen Bereich frei lassen.
- **Unten rechts** blendet die Webseite am Ende einer Runde eine kleine Bewertung (1–5 Sterne und ein Textfeld) ein. Sobald wieder gespielt wird, verschwindet sie.
- **localStorage**: Eigene Schlüssel beginnen immer mit der Spiel-ID, z.B. `panzer-pong-settings`. Der Schlüssel `lw-name` gehört allen Spielen gemeinsam. Lies und schreib ihn nur über `GameHub.getName()` und `GameHub.setName()`.
- Das Spiel darf nicht die ganze Seite neu laden oder auf andere Domains umleiten.

## 5. Gemeinsame Online-Funktionen: `GameHub`

Für Online-Modus, Spielername und Ranglisten gibt es eine fertige Bibliothek. Sie liegt auf der Webseite eine Ordnerebene höher und wird so eingebunden:

```html
<script src="../_shared/hub.js"></script>
```

Lokal beim Entwickeln fehlt diese Datei. Das Spiel muss deshalb auch **ohne GameHub** starten. Prüfe vorher mit `if (window.GameHub) { ... }` und blende Online-Funktionen sonst aus. Die Webseiten-Betreiber testen den Online-Teil nach dem Hochladen.

```js
const GAME_ID = 'panzer-pong';        // muss exakt dem Ordnernamen entsprechen!
```

**Spielername:**
- `GameHub.getName()` liefert den gespeicherten Namen oder `''`.
- `GameHub.setName(name)` speichert den Namen, höchstens 16 Zeichen.

Der Name gilt für alle Spiele. Fülle das Namensfeld damit vor.

**Fehlertexte:** `GameHub.errorText(err)` übersetzt Server-Fehler in deutsche Sätze für die Anzeige.

## 6. Online-Modus (nur wenn `spiel-modi` „Online“ enthält)

Der Server ist ein reiner **Nachrichten-Verteiler**: Er leitet Nachrichten zwischen den Spielern eines Raums weiter. Die Spiellogik läuft komplett im Browser. Bewährtes Muster: **Spieler 0 (Host) rechnet das Spiel**, die anderen schicken nur Eingaben und zeigen den Zustand des Hosts an.

```js
const room = GameHub.connect(GAME_ID);

// Raum erstellen (2–20 Plätze) -> 4-stelliger Code, z.B. "K7QD"
const info = await room.create(GameHub.getName(), 2);   // info.code, info.you (= 0)
// oder beitreten
await room.join('K7QD', GameHub.getName());              // room.you = eigener Platz (0..19)
// oder offene Welt: alle, die "mitspielen" wählen, landen im selben öffentlichen Raum (bis 20).
// Ist er voll, öffnet sich automatisch der nächste. Für Spiele, in denen alle Online-Spieler zusammen spielen.
await room.quick(GameHub.getName(), 20);                // room.code = Code der Welt, room.you = eigener Platz

room.on('peer-join', m => { /* m.idx, m.name, m.players */ });
room.on('peer-left', m => { /* m.idx – Gegner weg, Spiel pausieren/beenden */ });
room.on('msg', (data, from) => { /* Nachricht von Platz "from" */ });
room.on('close', () => { /* Verbindung verloren */ });

room.send({ type: 'input', x: 1 });   // an alle anderen im Raum (JSON, max. 256 KB, sparsam ~20–30/s)
room.close();
```

- **Einladungslink**: `GameHub.SEITE + '/<spiel-id>/#' + code` (ergibt z.B. `https://langwiligi.site/<spiel-id>/#K7QD`). Die Adresse nie fest eintippen. Beim Laden prüft das Spiel `location.hash`, setzt den Code mit `GameHub.cleanCode(location.hash)` ins Beitreten-Feld und fragt nach dem Namen. Biete einen Knopf „Link kopieren“ an.
- Mögliche Fehler beim Beitreten: `not-found`, `full`, `wrong-game`, `timeout`. Zeig sie mit `GameHub.errorText(e)` an.
- Räume werden gelöscht, sobald alle draussen sind, spätestens nach 6 Stunden. Offene Welten (`room.quick`) laufen weiter, solange jemand drin ist.
- **Plätze:** 2 bis höchstens **20** pro Raum. Bei vielen Spielern die Nachrichten sparsam halten (Positionen höchstens ca. 5 Mal pro Sekunde, nur bei Bewegung), denn jede Nachricht geht an alle anderen im Raum.
- **Zusammen spielen:** Wenn es in einem Spiel um eine gemeinsame Welt geht (statt einzelner Duelle), nimm `room.quick`, damit alle in derselben Lobby landen. Ein Code zum Beitreten ist trotzdem nötig, damit Einladungslinks funktionieren: Der Einladungslink der Welt führt in genau diesen Raum.

**Online-Rangliste für Duelle (Siege/Spiele):**
```js
room.roundStart();          // NUR der Host (room.you === 0), beim Start jeder Runde
room.result(winnerIdx);     // NUR der Host, am Rundenende: Platz des Gewinners, -1 = unentschieden
room.on('leaderboard', rows => GameHub.renderBoard(el, rows, GameHub.getName()));
GameHub.loadBoard(GAME_ID, el, GameHub.getName());  // Rangliste im Menü anzeigen (Top 10)
```
Ein Ergebnis zählt nur, wenn mindestens 2 Spieler im Raum sind und vorher `roundStart()` kam. Spiele gegen Bots oder lokale Spiele kommen **nicht** in die Rangliste.

## 7. Highscores für Solo-Spiele (optional)

```js
// Ergebnis melden -> { rows, rank, total, best }
const res = await GameHub.submitScore(GAME_ID, GameHub.getName(), punkte, { jumps: fortschritt });
GameHub.renderScores(el, res.rows, GameHub.getName(), { cols: [['score', 'Punkte']] });
// Liste nur anzeigen:
GameHub.renderScores(el, await GameHub.highscores(GAME_ID), GameHub.getName());
```

Regeln des Servers, sonst wird das Ergebnis abgelehnt:
- `punkte` ist eine ganze Zahl zwischen 0 und 10'000'000.
- **Plausibilitätsprüfung:** `punkte ≤ (jumps + 1) × 450`. Gib als `jumps` einen Fortschrittswert mit, der zu deinen Punkten passt (z.B. Sprünge, Level, gefahrene Meter / 10). Bei sehr hohen Punktzahlen pro Aktion skalierst du die Punkte entsprechend.
- Pro Name höchstens 1 Meldung alle 2 Sekunden. Gespeichert wird nur der beste Wert pro Name.
- Pro Spiel behält der Server höchstens 1000 Einträge.
- Die Spiel-ID muss online als Ordner existieren. Lokal schlägt das Melden deshalb fehl, das Spiel darf dabei nicht abstürzen.

## 8. Qualität und Stil (empfohlen)

- **Ablauf**: Startbildschirm mit Spielname, kurzer Anleitung (Steuerung für Tastatur und Touchpad) und Moduswahl (z.B. „Gegen Bot“, „2 Spieler – 1 Tastatur“, „Online“), dann Spiel, dann Ergebnis mit „Nochmal“ und „Menü“.
- **Optik der anderen Spiele**: dunkler Hintergrund (z.B. `#0d0f13`), halbtransparente Panels mit runden Ecken, `system-ui` als Schrift, eine kräftige Akzentfarbe (dieselbe wie `theme-color`), Spieler 1 blau (`#4f8ff7`), Spieler 2 rot (`#ef5350`).
- **Vollbild**: Das Canvas füllt das Fenster und reagiert auf `resize`. `devicePixelRatio` höchstens 2, damit es flüssig bleibt.
- **Leistung**: `requestAnimationFrame`, keine Endlosschleifen, flüssig auf normalen Laptops ohne eigene Grafikkarte, auch im Akkubetrieb.
- **Ton**: optional, mit Stumm-Knopf. Starte ihn erst nach der ersten Eingabe (Browser-Regel).
- **Pause**: Wird der Tab verlassen (`visibilitychange`), pausiert das Spiel, ausser online.
- **Bots** (falls vorhanden): mehrere Stufen (Leicht/Mittel/Schwer), die sich spürbar unterscheiden.
- **Grösse**: Der ganze Ordner bleibt möglichst unter 30 MB. Bilder als WebP, Musik als MP3/OGG mit niedriger Bitrate.

### Rundenende melden (empfohlen)

Die Webseite fragt erst am Ende einer Runde (Sieg, Niederlage, Game Over) nach einer Bewertung, nie mitten im Spiel.
Sie erkennt das Rundenende meist selbst („Nochmal“-Knopf, Sieg-Meldung, Rangliste). Sicherer ist es, wenn das Spiel es meldet:

```js
if (window.LW) LW.rundeFertig();   // am Ende jeder Runde aufrufen, egal ob gewonnen oder verloren
```

## 9. Abgabe

Hochladen über GitHub (Schritt für Schritt in [MITMACHEN.md](MITMACHEN.md)) oder als ZIP an den Besitzer der Seite.
Bei GitHub prüft eine automatische Kontrolle die Punkte unten und sagt dir, was noch fehlt.

**Sobald ein Spiel fertig gebaut oder geändert ist, sofort einen Pull Request erstellen**, nicht erst sammeln.
Ablauf: Spiel bauen → testen → committen → pushen → Pull Request.

Liefere einen **Ordner `<spiel-id>/`** mit:
1. `index.html` mit dem Pflicht-Kopf aus Abschnitt 2,
2. `cover.webp` (16:10),
3. allen weiteren Dateien, die das Spiel braucht (Bilder, Sounds, alles im selben Ordner).

**Checkliste vor der Abgabe**
- [ ] Ordnername = Spiel-ID: klein, ohne Umlaute und Leerzeichen, identisch mit `GAME_ID` im Code
- [ ] `<title>`, `description`, `theme-color`, `spiel-modi`, `spiel-typ`, `spiel-tags` vorhanden
- [ ] `cover.webp` im 16:10-Format ohne Text
- [ ] Startet lokal per Doppelklick ohne Fehler in der Konsole (F12)
- [ ] Läuft auch ohne `GameHub` (Online-Teil wird dann ausgeblendet)
- [ ] Komplett mit Touchpad und Tastatur spielbar (ohne Maus), auf kleinen Laptops (1366 × 768) nichts abgeschnitten
- [ ] Ordner höchstens 100 MB, keine Datei über 25 MB
- [ ] Linker Rand in der Mitte frei, kein eigener Zurück-zur-Startseite-Knopf
- [ ] localStorage-Schlüssel beginnen mit der Spiel-ID
- [ ] Keine externen Dateien ausser cdnjs und Google Fonts, kein Tracking, keine Popups
- [ ] Alle Texte auf Deutsch, ohne ß

**Updates-Verlauf pflegen:** Bei jeder Änderung (auch jeder kleinen) einen Eintrag oben in `startseite/verlauf.json` ergänzen (`d` Datum, `z` Uhrzeit, `a` Bereich, `t` kurzer Text, `tag` Neu/Update/Intern, `k` Art des Updates, `pr`, `b`). Daraus entsteht die Unterseite `/updates/`. Bei sichtbaren Änderungen zusätzlich `startseite/updates.json`.
