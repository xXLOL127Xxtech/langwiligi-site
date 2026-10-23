# Vorschlagdossier: «Fabelfänger» (Arbeitstitel)

Ein Fantasy-Sammel- und Kampfspiel für langwiligi.site: Tierchen fangen, mit Freunden losziehen, gemeinsam gegen starke Gegner kämpfen und sich im Duell messen.

| | |
|---|---|
| **Vorgeschlagene Spiel-ID** | `fabel-faenger` |
| **Modi (`spiel-modi`)** | `Solo`, `Online`, `Bots` |
| **Typ (`spiel-typ`)** | `Pixel-Art`, `Strategie`, `Aufbau` |
| **Tags** | `Sammeln`, `Koop`, `Rangliste` |
| **Akzentfarbe** | `#7c5cff` (Violett, gut auf dunklem Grund) |
| **Plattform** | Laptop mit Touchpad und Tastatur, kein Handy |
| **Umfang** | 1 Datei `index.html` plus Bilder/Sound, geschätzt unter 10 MB |

---

## 1. Die Idee in drei Sätzen

Du erwachst als junge Fabelfängerin oder junger Fabelfänger in einer kleinen Fantasiewelt, fängst wilde Tierchen mit Fangkugeln und trainierst sie. Unterwegs trifft man auf Freunde (online), zieht gemeinsam gegen übermächtige Riesen-Gegner und tritt in Duellen gegeneinander an. In den Dörfern gibt es Läden für Fangkugeln und Tränke sowie ein Heilhaus für müde Tierchen.

## 2. Wichtiger Punkt vorab: Urheberrecht

Das Spielprinzip (Monster fangen, rundenbasierte Kämpfe, Elemente) ist frei verwendbar. **Namen, Figuren, Musik und Grafiken von Pokémon dürfen wir nicht übernehmen.** Darum:

- Eigene Welt, eigene Wesen, eigene Namen (Fantasy-Tierchen, siehe Abschnitt 5).
- Nicht «Pokémon», «Pokéball», «Pikachu» usw. verwenden, auch nicht im Quelltext oder in `spiel-suche`.
- Alle Grafiken und Töne selber erzeugen (Code oder frei lizenziert, Quelle dann in `LIZENZ.md`).

Das schützt auch die Seite vor Abmahnungen. Das Spielgefühl bleibt trotzdem vertraut.

## 3. Spielablauf

### 3.1 Start
1. Name eingeben (aus `GameHub.getName()` vorbefüllt), Aussehen der Spielfigur wählen (4–6 Varianten).
2. Eines von drei Starter-Tierchen wählen (Feuer, Wasser, Pflanze).
3. Kurze Anleitung (Tastatur und Touchpad), dann ab in die Welt.

### 3.2 Die Welt (Solo-Abenteuer)
- Draufsicht in Pixel-Art, Kacheln wie in den klassischen Rollenspielen.
- **Steuerung:** Pfeiltasten oder WASD zum Laufen, `Leertaste`/`Enter` für Ja/Interagieren, `Esc` für Menü. Alle Knöpfe zusätzlich per Touchpad-Klick bedienbar.
- 5 Gebiete, verbunden durch Wege: Wiesental → Flüsterwald → Kristallhöhle → Nebelsee → Wolkengipfel.
- **Hohes Gras / Höhlenboden / Wasserstellen:** hier tauchen wilde Tierchen zufällig auf.
- **Dörfer** mit Laden und Heilhaus (siehe 3.4).
- **Trainer-NPCs** (das sind unsere «Bots»): fordern zum Kampf heraus, pro Gebiet ein Anführer als Zwischenboss.
- Ziel der Geschichte: die vier Elementarsiegel sammeln und den **Sturmriesen** auf dem Wolkengipfel besiegen.

### 3.3 Fangen und Team
- Wilde Tierchen werden im Kampf geschwächt und dann mit einer **Fangkugel** gefangen. Je tiefer die Lebenspunkte, desto höher die Chance. Bessere Kugeln fangen leichter.
- Team: bis **6 Tierchen**, der Rest wohnt in der **Tierhütte** (Lager, Platz für 60).
- Tierchen sammeln Erfahrung, steigen auf (Stufe 1–50), lernen neue Attacken und **entwickeln sich** ab bestimmten Stufen.
- Das **Fabelbuch** zeigt alle bisher gesehenen und gefangenen Arten (Sammelanreiz, Fortschritt in Prozent).

### 3.4 Läden und Heilhaus
| Ort | Was es gibt |
|---|---|
| **Fangkugel-Laden** | Fangkugeln (einfach, gross, Meister), Tränke, Wiederbeleber, Gegengifte |
| **Heilhaus** | Alle Tierchen im Team gratis heilen (Fortschritt der Geschichte verlangsamt sich nicht, der Weg ist nur weit) |
| **Tauschmarkt** | Verkauf von Fundstücken (Beeren, Kristalle) gegen Münzen |

Münzen gibt es durch Trainer-Kämpfe, Fundstücke und Aufgaben der Dorfbewohner.

## 4. Kampfsystem

Rundenbasiert, einfach zu lernen, mit Tiefgang durch Elemente. Funktioniert perfekt per Tastatur (`1`–`4` für Attacken, Pfeiltasten + `Enter`) und Touchpad-Klick.

- **Aktionen pro Zug:** Attacke (4 Fähigkeiten), Tierchen wechseln, Gegenstand, Fangkugel (nur gegen Wilde), Fliehen.
- **Elemente (6):** Feuer, Wasser, Pflanze, Erde, Luft, Licht/Schatten. Jedes Element ist gegen eines stark und gegen eines schwach (Kreis plus Licht/Schatten als Gegenpaar). Die Tabelle passt auf ein einziges Bild im Spiel.
- **Werte:** Lebenspunkte, Angriff, Verteidigung, Tempo. Wer schneller ist, greift zuerst an.
- **Statuseffekte:** Schlaf, Gift, Brand, Betäubt (wenige, klar erkennbar).
- **Zufall mit Mass:** leichte Schwankung beim Schaden und kritische Treffer, sonst vorhersehbar.

### 4.1 Kampfarten
| Art | Beschreibung |
|---|---|
| **Wild** | 1 gegen 1, mit Fangmöglichkeit |
| **Trainer (Bot)** | 3 gegen 3, Bot-Stufen Leicht/Mittel/Schwer je nach Gebiet |
| **Riesen-Raid (Koop)** | 2–4 Freunde gegen einen riesigen Gegner |
| **Freundesduell** | 3 gegen 3 online, Rangliste |

## 5. Die Tierchen (Beispiele, eigene Fantasiewesen)

Ziel zum Start: **48 Arten** in 16 Entwicklungsreihen à 3 Stufen, später erweiterbar.

| Name (Beispiel) | Element | Idee |
|---|---|---|
| Flammfux → Glutfuchs → Infernix | Feuer | Fuchs mit Schwanz aus Flammen |
| Plätschling → Wellenotter → Tidalon | Wasser | Verspielter Otter |
| Moosel → Blattbock → Waldregent | Pflanze | Hirsch mit Moos-Geweih |
| Felsling → Steinbär → Gebirgskoloss | Erde | Gemütlicher Felsbär |
| Wolkenpuff → Windfalk → Sturmschwinge | Luft | Fluffiger Vogel |
| Glimmerchen → Lichtmotte → Sonnenfalter | Licht | Leuchtende Motte |
| Schattenschleicher → Nachtkatze → Dunkelpanther | Schatten | Scheue Katze |
| Drachenei → Funkenwurm → Himmelsdrache | Feuer/Luft | Seltener Entwicklungs-Star |

Bosse und Riesen (z. B. **Sturmriese**, **Kristallwurm**, **Nebelkrake**) sind 3–5 Mal so gross wie normale Tierchen.

**Wie bekommen wir so viele Bilder klein und günstig?** Siehe Abschnitt 8: Wesen werden aus Formen im Code gezeichnet (Körper, Ohren, Schwanz, Augen, Farbe) und in Pixel-Optik gerendert. Das ist klein (wenige KB), lässt sich leicht um Varianten ergänzen und ist rechtlich sauber.

## 6. Mit Freunden spielen (Online)

Nutzt den vorhandenen `GameHub` (Räume mit 4-stelligem Code, Einladungslink, Freunde-Panel der Seite). Der Server leitet nur Nachrichten weiter, **der Host (Platz 0) rechnet den Kampf**, die anderen schicken ihre Eingaben.

### 6.1 Freunde in der Welt treffen
- Beim Start «Online» gewählt: Raum erstellen (bis 4 Plätze) oder per Link beitreten.
- Alle Spieler laufen **gemeinsam in der Host-Welt** und sehen sich als Figuren mit Namen. Sie müssen nicht zeitgleich dieselben Orte besuchen: Der Raum ist ein gemeinsamer Ausflug in ein Gebiet, das alle freigeschaltet haben.
- Kleine Gesten statt freiem Chat (Winken, Herz, Daumen hoch) per Taste `1`–`4`. Das schützt vor Beleidigungen und erspart Moderation.

### 6.2 Gemeinsam gegen starke Gegner (Riesen-Raid)
- Ein Riese mit grossem Lebensbalken, mehreren Phasen und Spezialattacken (z. B. Flächenschaden alle 3 Runden).
- Jeder Spieler kämpft mit **einem Tierchen seines Teams** und kann wechseln. Alle wählen ihre Aktion, dann läuft die Runde ab (kurze Zeitbegrenzung, damit niemand alle aufhält).
- Elemente werden zur Teamarbeit: Wasser löscht das Feuer des Riesen, danach trifft Luft stärker.
- Belohnung für alle: Erfahrung, Münzen, seltene Fangkugeln und die Chance, den Riesen als Verbündeten zu **zähmen**.

### 6.3 Freundesduell
- 3 gegen 3, beide wählen verdeckt, dann Auflösung (kein Warten auf Animationen des anderen).
- Zählt für die Online-Rangliste (`room.roundStart()` / `room.result()`).
- Fairness: Duell-Tierchen werden auf **Stufe 30 angeglichen**, damit auch Neulinge mithalten. So zählt Taktik, nicht Spielstunden.

### 6.4 Tauschen
Zwei Spieler im selben Raum tauschen je ein Tierchen (beide bestätigen). Entwicklungen, die nur durch Tausch möglich sind, geben einen Grund zum Treffen.

## 7. Speichern und Fortschritt

- Alles in `localStorage` mit Schlüsseln wie `fabel-faenger-spielstand` (kein Login, keine Konten).
- Zusätzlich **«Spielstand-Code»**: Export/Import als kurzer Text, damit man auf einem anderen Laptop weiterspielen kann.
- Im Online-Raum schickt jeder Spieler beim Beitritt sein Team (Stufen, Attacken) an den Host.
- **Ehrlicher Hinweis:** Weil alles im Browser läuft, kann man mogeln (Stufen ändern). Das ist bei einem Spiel unter Freunden vertretbar. Die Rangliste ist nur durch die Angleichung der Stufen (6.3) gegen Teamstärke-Betrug geschützt.

## 8. Technische Umsetzung

- **Einzelne `index.html`**, Canvas-Rendering, Pixel-Look mit `image-rendering: pixelated`, kein Build-Schritt.
- **Aufbau im Code:** Module als Abschnitte im Skript: `Welt` (Karte, Bewegung), `Kampf` (Regeln, deterministisch aus Host-Zufall), `Daten` (Arten, Attacken, Gegenstände als Tabellen), `Online`, `Speichern`, `UI`.
- **Daten als Tabellen:** Arten, Attacken und Items stehen in JSON-ähnlichen Listen. Neue Tierchen hinzufügen heisst Zeilen ergänzen.
- **Grafik:** Wesen und Karten werden prozedural aus Farbpaletten und Formen gezeichnet; Kacheln aus einer kleinen Tilemap. Cover (`cover.webp`) wird einmalig als Illustration erstellt, ohne Text.
- **Ton:** kleine synthetische Soundeffekte per Web Audio (kein Download), Musik optional als leichte Schleife, Stumm-Knopf Pflicht. Ton startet erst nach erster Eingabe.
- **Seitenregeln:** linker Rand mittig frei, kein Zurück-Knopf, keine Popups, nur deutsche Texte ohne ß, `window.LW.rundeFertig()` am Kampfende, Spielstart auch ohne GameHub (Online-Teil dann ausgeblendet).
- **Leistung:** feste Zeitschritte, Kacheln nur im sichtbaren Bereich zeichnen, `devicePixelRatio` höchstens 2. Soll auf einem Büro-Laptop im Akkubetrieb flüssig laufen.
- **Prüfung:** `node tools/spiel-pruefen.js games/fabel-faenger` vor jedem Commit.

## 9. Plan in Etappen

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| **1. Kern** | Startbildschirm, Kampfsystem mit 12 Tierchen, Fangen, Team, Wiesental, erster Laden und Heilhaus, Speichern | Solo spielbar, erste Veröffentlichung |
| **2. Welt** | 5 Gebiete, 48 Tierchen, Trainer-Bots, Fabelbuch, Entwicklung, Geschichte bis zum Sturmriesen | Komplettes Solo-Abenteuer |
| **3. Freunde** | Online-Raum, gemeinsam laufen, Freundesduell mit Rangliste, Tauschen | Mit Freunden spielbar |
| **4. Gemeinsam stark** | Riesen-Raids mit 2–4 Spielern, Zähmen, tägliche Herausforderung | Das Highlight für die Gruppe |
| **5. Feinschliff** | Balancing, Ton, Barrierefreiheit (grosse Schrift, Farbblind-Symbole), neue Arten | Dauerhaft pflegbar |

Wichtig: Jede Etappe wird einzeln gebaut, geprüft und als Pull Request abgegeben. Schon nach Etappe 1 ist das Spiel nutzbar.

## 10. Risiken und Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| Der Umfang ist gross (mehrere Spiele in einem) | Etappen, Daten als Tabellen, früh veröffentlichen und Rückmeldungen holen |
| Urheberrecht | Eigene Welt und Namen, keine Fremdgrafiken (Abschnitt 2) |
| Online-Synchronisation bei Kämpfen | Rundenbasiert: Nachrichten nur pro Zug, nicht pro Bild; Host entscheidet |
| Spielstand geht verloren (Browser-Daten gelöscht) | Spielstand-Code zum Sichern |
| Mogeln | Stufen-Angleichung im Duell, kein Preis ausser Rangliste |
| Touchpad-Bedienung | Alle Menüs auch per Tastatur; grosse Klickflächen |
| Ladezeit | Prozedurale Grafik, kleine Dateien, Ziel unter 10 MB |

## 11. Offene Fragen an dich

1. **Name:** «Fabelfänger» ok, oder lieber etwas anderes (z. B. «Wunderwesen», «Tierchen-Tour»)?
2. **Stil der Wesen:** niedlich (rund, grosse Augen), cool (kantig) oder gemischt?
3. **Kampf online:** Freundesduell zuerst (einfacher) oder zuerst der gemeinsame Riesen-Raid (das Highlight)?
4. **Wer darf tauschen und online beitreten?** Nur mit Einladungslink oder auch über die Lobby der Seite?
5. **Schwierigkeit:** eher locker für Gelegenheitsspieler oder fordernd?
6. **Mit welcher Etappe sollen wir starten?** Empfehlung: Etappe 1, dann nach dem ersten Feedback weiter.

## 12. Empfehlung

Spiel bauen, **mit Etappe 1 starten** und früh veröffentlichen. Der Reiz (Sammeln, Freunde, gemeinsam gegen Riesen) passt gut zur Seite, die Technik (GameHub, Räume, Rangliste) ist vorhanden, und die rundenbasierten Kämpfe sind für Online und Touchpad ideal.
