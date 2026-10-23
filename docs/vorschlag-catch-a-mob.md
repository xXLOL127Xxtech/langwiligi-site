# Vorschlagdossier: «Catch a Mob» (Version 2)

Ein Online-Sammel- und Kampfspiel in einer riesigen Dark-Fantasy-Welt für bis zu 20 Spieler gleichzeitig: Mobs fangen, mit der Party losziehen, gemeinsam gegen übermächtige Gegner kämpfen, im Duell gegeneinander antreten und überzählige Mobs verkaufen.

Änderungen gegenüber der ersten Fassung («Fabelfänger»): neuer Name, nur Online und Bots, eine gemeinsame Welt für 20 Spieler, Party und Freunde-Tab, Biome mit Jahreszeiten und Wetter, Dark-Fantasy-Monster, Verkauf von Mobs.

| | |
|---|---|
| **Spiel-ID** | `catch-a-mob` |
| **Modi (`spiel-modi`)** | `Online`, `Bots` (kein Solo-Modus) |
| **Typ (`spiel-typ`)** | `Pixel-Art`, `Strategie`, `Aufbau` |
| **Tags** | `Sammeln`, `Offene Welt`, `Koop` |
| **Akzentfarbe** | `#8a3ffc` (Violett) oder `#c0392b` (Blutrot), passt zu Dark Fantasy |
| **Plattform** | Laptop mit Touchpad und Tastatur |
| **Spielerzahl** | bis 20 pro Welt |

---

## 1. Die Idee

Du bist ein Mob-Jäger in einer düsteren Fantasy-Welt. Wilde Mobs (Schattenwölfe, Knochendrachen, Sumpfgeister …) streifen durch Wälder, Moore, Vulkane und Gebirge. Du fängst sie mit Fangsiegeln, trainierst sie und ziehst mit deiner Party los. In der Welt laufen bis zu 20 echte Spieler gleichzeitig herum. Man sieht sich, kämpft zusammen gegen Riesen-Bosse, fordert sich zu Duellen heraus und handelt.

## 2. Modi: Online und Bots

| Modus | Was passiert |
|---|---|
| **Online** | Gemeinsame Welt mit bis zu 20 Spielern. Man betritt die offene Welt über die Spielliste oder per Einladung. |
| **Bots** | Dieselbe Welt, aber nur du, dazu Computer-Trainer (Bot-Spieler), die herumlaufen, kämpfen und Party-Mitglieder sein können. Gut zum Üben und für Leute ohne Freunde online. |

Technisch ist es dieselbe Welt: «Bots» ist eine Welt, die nur du betrittst und die mit Bot-Trainern gefüllt ist. So muss nur ein Spiel gebaut werden.

## 3. Eine Welt für alle (20 Spieler)

- **Eine gemeinsame, sehr grosse Welt.** Alle Online-Spieler befinden sich in derselben Karte und sehen einander als Figuren mit Namen.
- **Grösse:** rund 400 × 400 Kacheln (ca. 160'000), etwa 1 bis 1,5 Minuten Laufzeit von einem Ende zum anderen. Dazu **Wegsteine** (Schnellreise zwischen besuchten Dörfern), damit die Welt gross wirkt, aber nicht mühsam ist.
- **Dieselbe Karte für alle:** Die Welt entsteht aus einer festen Zahl (Seed) plus von Hand gesetzten Orten (Dörfer, Dungeons, Boss-Arenen). Alle Clients zeichnen daraus dieselbe Karte, ohne dass die Karte übertragen werden muss.
- **Welten füllen sich:** Sind 20 Plätze belegt, öffnet sich automatisch «Welt 2», «Welt 3» usw.

### 3.1 Party und Freunde-Tab

- Die Seite hat bereits den **Freunde-Tab** (linker Rand, Knopf «Freunde»). Darüber lädt man Freunde in die eigene Welt ein, das übernimmt die Webseite.
- **Party (bis 4 Spieler):** Im Spiel schlägt man eine Person an (Taste `E` oder Klick) und wählt «In die Party einladen». Der Chef der Party ist die Person, die einlädt.
- **Man sieht, wo der andere ist:** Party-Mitglieder erscheinen mit Namen und Pfeil am Bildschirmrand, wenn sie ausser Sichtweite sind, und als farbige Punkte auf der Weltkarte (`M`). Mit `Z` läuft man zu einem Party-Mitglied hin (Schnellreise-Sprung zum nächstgelegenen Wegstein bei dieser Person).
- Alle anderen Spieler sehen sich, aber nicht ihre Karte.
- **Kein freier Chat:** Nachrichten laufen über Schnell-Gesten (Winken, Herz, Hilfe!, Kampf?). Das spart Moderation.

### 3.2 Wichtig: Was dafür auf der Seite angepasst werden muss

Die vorhandene Online-Technik kann das noch nicht ganz. Das sind zwei kleine Änderungen am Server (`server/game-hub.js`), die der Besitzer der Seite machen müsste:

1. **Räume sind heute auf höchstens 8 Spieler begrenzt** (`Math.min(8, …)`). Für 20 Spieler müsste der Wert auf 20 erhöht werden.
2. **Nachrichten gehen heute immer an alle im Raum.** Bei 20 Spielern mit Positionsmeldungen wären das zu viele Nachrichten. Besser wäre `room.sendTo(idx, daten)`, also eine Nachricht an eine einzelne Person (für Duelle, Tausch, Party). Ohne diese Änderung geht es, aber nur mit Einschränkungen: weniger Positionsmeldungen pro Sekunde (ca. 5), nur Aufnahme bei Bewegung.

Zusätzlich: Die Welt wird von **Spieler 0 (Host) verwaltet**. Geht der Host weg, muss die Welt jemand anderes übernehmen (Host-Wechsel durch automatische Neuwahl, der Platz mit der kleinsten Nummer übernimmt). Das muss sauber gebaut werden und ist der heikelste Teil des Spiels (siehe Risiken). Ohne Serverumbau wäre die ehrliche Alternative: **8 Spieler pro Welt**.

### 3.3 So wenig Netzwerkverkehr wie möglich

Damit 20 Spieler flüssig laufen:
- **Wilde Kämpfe sind privat** und laufen nur im eigenen Browser. Niemand muss etwas weitermelden.
- **Wetter, Tageszeit und Jahreszeit sind aus der Uhrzeit des Hosts berechnet**, nicht gesendet. Alle sehen automatisch dasselbe.
- **Nur gesendet wird:** Position (ca. 5 Mal pro Sekunde, nur bei Bewegung), Name und Aussehen beim Betreten, Party-Nachrichten, Duell-/Raid-Aktionen.
- Spieler weit weg werden nicht gezeichnet.

## 4. Die Welt: Biome, Jahreszeiten und Wetter

Eine klassische, abwechslungsreiche Welt wie in den Monsterfänger-Spielen, aber düsterer. Jedes Biom hat eigene Optik, eigene Mobs und eigene Wetterlaunen.

| Biom | Jahreszeit-Look | Typische Mobs | Wetter |
|---|---|---|---|
| **Blütenwiesen** (Startgebiet) | Frühling, rosa Blüten | Moosgeister, Dornhasen | Regen, Sonne |
| **Sonnenküste** | Sommer, Strand, Palmen | Krabbenwächter, Salzgeister | Hitze, Gewitter |
| **Herbstwald** | Herbst, rotes Laub | Rabenfürsten, Pilzritter | Nebel, Wind |
| **Frostgipfel** | Winter, Schnee | Eiswölfe, Frostwyrm | Schneesturm, Hagel |
| **Nebelmoor** | Düster, Sumpf | Moorleichen, Irrlichter | Dauernebel, Giftdunst |
| **Aschegipfel** | Vulkan, Lavafelder | Glutdämonen, Magmaschlangen | Ascheregen, Hitzewelle |
| **Knochenfriedhof** | Nacht, Totenland | Knochendrachen, Wiedergänger | Blutmond, Gewitter |
| **Kristallhöhlen** | Dungeon | Edelstein-Golems | Echo, Stille |

- **Tag und Nacht:** Rund 20 Minuten für einen ganzen Tag. In der Nacht erscheinen seltene Mobs.
- **Jahreszeiten:** Jedes Biom steht in seiner Jahreszeit. Zusätzlich dreht sich ein langsamer **Welt-Zyklus** (z. B. alle 2 Stunden ein Jahreszeitenwechsel), der Mob-Auftreten, Preise und Farbstimmung leicht verändert. So lohnt es sich, später wiederzukommen.
- **Wetter beeinflusst den Kampf:** Regen stärkt Wasser-Attacken, Hitze die Feuer-Attacken, Nebel senkt die Treffsicherheit, Blutmond stärkt Schatten-Mobs. Das Wetter steht gross im Kampfbildschirm.
- **Gefahr:** In hohem Gras, Sumpf und Dunkelwald tauchen wilde Mobs auf, Wege und Dörfer sind sicher.

## 5. Die Mobs im Dark-Fantasy-Stil

Stil: düster, aber nicht schockierend. Verwitterte, leuchtende Augen, Knochen, Nebel, Runen. Leuchtfarben als Kontrast zum dunklen Hintergrund. Altersfreigabe wie ein Märchen mit Gruselnote.

| Mob (Beispiel) | Element | Idee |
|---|---|---|
| Glutfunke → Aschewolf → Infernhund | Feuer | Wolf, aus Glut und Asche |
| Moorblase → Sumpfgeist → Leichenfürst | Wasser/Schatten | Geist aus dem Moor |
| Dornling → Knochenranke → Waldwürger | Pflanze | Von Ranken überwucherter Hirschschädel |
| Steinzahn → Gruftbär → Berghüter | Erde | Mit Runen verzierter Steinbär |
| Rabenkind → Nachtkrähe → Unheilsfürst | Luft/Schatten | Rabe mit zerrissenen Flügeln |
| Lichtwisp → Irrlicht → Seelenlaterne | Licht | Flamme in einer alten Laterne |
| Knochenei → Wyrmling → Knochendrache | Schatten/Luft | Seltener Entwicklungsstar |

**Bosse:** Der **Aschekönig**, die **Moorkrake**, der **Frostwyrm** und der **Totenlord** sind riesig und füllen halbe Bildschirme.

- Ziel: **60 Arten** zum Start (20 Reihen à 3 Stufen), später erweiterbar.
- **Seltenheit** (Gewöhnlich, Selten, Episch, Legendär) und **Glanz-Varianten** (leuchtende Version, sehr selten) als Sammelreiz.
- **Rechtliches:** Eigene Wesen, keine Figuren aus Pokémon oder anderen Marken. Name «Catch a Mob» ist frei gewählt und dem Genre angelehnt, ohne Markenbezug.

## 6. Kampf

Rundenbasiert und mit Tastatur wie Touchpad gut bedienbar (`1`–`4` für Attacken, Pfeile und `Enter`).

- **Aktionen:** Attacke (4 Fähigkeiten), Wechseln, Gegenstand, Fangsiegel (nur Wilde), Fliehen.
- **Elemente (6):** Feuer, Wasser, Pflanze, Erde, Luft, Licht/Schatten. Stärken und Schwächen wie in der Elementtabelle im Spiel.
- **Werte:** Lebenspunkte, Angriff, Verteidigung, Tempo. **Statuseffekte:** Schlaf, Gift, Brand, Furcht.
- **Wetter-Bonus** (siehe 4).
- **Kampfarten:**

| Art | Beschreibung |
|---|---|
| **Wild** | 1 gegen 1, mit Fangmöglichkeit, privat |
| **Trainer (Bot)** | 3 gegen 3, Bot-Stufen Leicht/Mittel/Schwer, Zwischenbosse pro Biom |
| **Riesen-Raid** | Party mit 2–4 Spielern gegen einen Boss mit mehreren Phasen |
| **Duell** | 3 gegen 3 gegen einen anderen Spieler in der Welt, Rangliste |
| **Weltboss** | Alle in der Nähe können mitkämpfen (bis 20!) gegen einen riesigen Gegner, der zu bestimmten Zeiten an einem bekannten Ort erscheint. Ein Highlight für das Gemeinschaftsgefühl |

Duelle gleichen die Stufen auf 30 an, damit nicht nur Spielstunden zählen. Zählt für die Online-Rangliste.

## 7. Fangen, Team und Fortschritt

- **Fangsiegel** statt Bälle: einfach, stark, Meister. Je tiefer die Lebenspunkte, desto höher die Fangchance.
- Team bis **6 Mobs**, der Rest wohnt im **Zwinger** (Lager für 100).
- Stufen 1–50, neue Attacken, Entwicklungen ab bestimmten Stufen.
- **Mob-Buch** mit allen gesehenen und gefangenen Arten.
- **Spielstand:** `localStorage` (Schlüssel `catch-a-mob-…`) und ein **Spielstand-Code** zum Sichern oder auf einen anderen Laptop mitnehmen.

## 8. Läden, Heilung und Verkauf

| Ort | Was es gibt |
|---|---|
| **Siegel-Laden** | Fangsiegel, Tränke, Wiederbeleber, Gegengifte, Wetterschutz |
| **Heilhaus** | Alle Mobs im Team gratis heilen |
| **Mob-Händler (neu)** | **Mobs verkaufen** gegen Gold. Preis nach Seltenheit, Stufe, Glanz-Variante und Jahreszeit |
| **Fundstück-Händler** | Verkauf von Beeren, Kristallen und Knochen |

Regeln für den Verkauf (damit er Spass macht und nicht zur Abkürzung wird):
- Verkauf **nur an den Händler**, nicht von Spieler zu Spieler. Das verhindert Betrug und Beschwerden.
- **Bestätigung** im Spiel (kein Popup), mit Wiederkaufspreis (3×) für Notfälle.
- Der letzte Mob im Team kann nicht verkauft werden, **Legendäre** nur mit zusätzlicher Warnung.
- Preise schwanken mit der Jahreszeit (Winter: Eiswölfe teuer, Sommer: billig), was zum Spekulieren einlädt.
- Die Wirtschaft ist lokal gespeichert. Mogeln ist im Browser technisch möglich, schadet aber nur dem eigenen Spiel, weil Gold nicht an andere übertragen wird.

**Tauschen** bleibt möglich (beide bestätigen), aber ohne Gold.

## 9. Technik

- **Eine `index.html`** mit Canvas. Pixel-Art-Stil, Kachelkarte in Stücken (Chunks) für die grosse Welt, nur sichtbarer Bereich gezeichnet.
- **Weltkarte** aus Seed plus handgesetzten Orten. Alle Clients bauen dieselbe Karte.
- **Mob-Grafik:** Wesen werden aus Formen und Paletten im Code gezeichnet (Körper, Hörner, Augen, Schwanz). Klein (KB statt MB), viele Varianten möglich, rechtlich sauber. Zusätzlich 8 bis 10 von Hand gezeichnete Sprites für die Bosse, falls nötig.
- **Wetter:** Partikel (Regen, Schnee, Asche, Nebel) per Canvas, in Qualitätsstufen (für schwache Laptops ein Sparmodus).
- **Ton:** kleine Effekte per Web Audio, Stumm-Knopf, Start erst nach erster Eingabe.
- **Seitenregeln:** linker Rand frei, kein Zurück-Knopf, keine Popups, nur Deutsch ohne ß, `LW.rundeFertig()` nach Kämpfen, Start auch ohne GameHub (dann nur Bots-Modus).
- **Prüfung:** `node tools/spiel-pruefen.js games/catch-a-mob` vor jedem Commit.
- **Steuerung:** Pfeile/WASD, `Leertaste`/`Enter`, `E` (Interagieren, Party), `M` (Karte), `Esc` (Menü). Alles auch per Touchpad-Klick.
- **Grösse:** Ziel unter 10 MB.

## 10. Etappen

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| **1. Kern** | Kampf, Fangen, Team, 12 Mobs, 2 Biome, Bots-Modus, Speichern | Spielbar gegen Bots |
| **2. Offene Welt** | Grosse Karte, alle Biome, Tag/Nacht, Wetter, Jahreszeiten, Läden, Heilhaus, Verkauf | Komplette Welt allein mit Bots |
| **3. Online** | Welt mit mehreren Spielern (zuerst 8), Namen, Positionen, Duelle, Rangliste | Mit Freunden |
| **4. Party** | Party, Standortanzeige, Karte, Riesen-Raids, Tauschen | Zusammen stark |
| **5. 20 Spieler** | Serveranpassung, Host-Wechsel, Weltbosse, mehrere Welten | Grosse Gemeinschaft |
| **6. Feinschliff** | Balancing, Ton, Barrierefreiheit, neue Mobs | Dauerhaft pflegbar |

Jede Etappe wird einzeln gebaut, geprüft und als Pull Request abgegeben.

## 11. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Server erlaubt nur 8 Spieler pro Raum | Zuerst mit 8 starten (Etappe 3), Erhöhung auf 20 als eigene kleine Serveränderung (Etappe 5) |
| Host verlässt die Welt | Automatischer Host-Wechsel; alle halten den wichtigen Zustand lokal, der Host verwaltet nur Wetterzeit, Weltboss und Zusammenführung |
| Zu viele Nachrichten bei 20 Spielern | Wenige Positionsmeldungen, private Kämpfe, berechnetes Wetter; ideal mit Einzelnachricht (`sendTo`) |
| Spielstand geht verloren | Spielstand-Code |
| Mogeln (Gold, Stufen) | Stufen im Duell angeglichen, Gold nicht übertragbar, Rangliste nur mit Duell |
| Sehr grosser Umfang | Etappen, Datentabellen, früh veröffentlichen |
| Schwache Laptops | Wetter-Sparmodus, nur sichtbare Kacheln, wenige Partikel |
| Urheberrecht | Eigene Mobs und Namen |

## 12. Noch offen

1. **Serveränderung:** Darf der Besitzer der Seite den Server auf 20 Spieler pro Raum (und Einzelnachrichten) anpassen? Ohne das sind es 8.
2. **Weltboss:** Soll es einen festen Zeitplan geben (z. B. jede Stunde) oder zufällig?
3. **Altersfreigabe:** Düster ja, aber ohne Blut und Gewalt gegen Menschen (nur Mob gegen Mob). Einverstanden?
4. **Mob-Verkauf:** Soll es ein Verkaufslimit pro Tag geben, damit man nicht alles sofort verscherbelt?
5. **Start:** Mit Etappe 1 beginnen?
