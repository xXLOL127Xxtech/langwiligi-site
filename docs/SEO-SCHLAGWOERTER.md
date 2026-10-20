# Bei Google gefunden werden – Schlagwörter für langwiligi.site

Stand: Oktober 2026

## 1. Ausgangslage

- Eine Websuche nach **„langwiligi site“** und **„langwiligi“** findet die Seite noch **gar nicht**, nur ähnlich klingende Wörter
  (Langkawi, Llangwyllog, …). Die Seite ist also noch nicht oder kaum im Suchindex. **Das ist das grösste Problem, nicht die Schlagwörter.**
- Positiv: Das Wort „Langwiligi“ hat fast keine Konkurrenz. Sobald Google die Seite kennt, landet sie bei dieser Suche fast sicher auf Platz 1.

## 2. Welche Begriffe lohnen sich?

### Rot: grosse Begriffe, kaum zu gewinnen

`online spiele`, `browserspiele`, `kostenlose spiele`, `2 spieler spiele`, `spiele ohne anmeldung`.
Dort stehen Poki, SpielAffe, Playgama, GIGA und Co. mit Tausenden Spielen und vielen Links.
Diese Wörter stehen trotzdem im Titel und Text (sie schaden nicht), aber Besucher kommen über die gelben und grünen Begriffe.

### Gelb: mittlere Konkurrenz, mit Geduld machbar

| Begriff | Warum |
|---|---|
| `online spiele zu zweit ohne werbung` | Viele fragen in Foren genau danach (z.B. mydealz). Fast alle grossen Seiten haben Werbung, langwiligi.site nicht. |
| `spiele zu zweit an einem laptop` | Lange Suche, wenige Seiten passen genau. |
| `<klassiker> online gegen freund` (Schach, Dame, Backgammon, Reversi, Vier gewinnt) | Konkurrenz durch grosse Schach-/Brettspielseiten, aber „zu zweit“ + „ohne Anmeldung“ grenzt ab. |
| `tower defense online koop` | Kronenwacht |

### Grün: kaum Konkurrenz (hier kann die Seite schnell nach oben)

| Begriff | Spiel | Was die Suche ergab |
|---|---|---|
| `langwiligi site`, `langwiligi`, `kei langwiligi`, `langwiligi spiele` | Startseite | Keine einzige passende Seite |
| `mir isch langwilig` + `spiele` / `was mache` | Startseite | Nur Treffer zu einem koreanischen Online-Rollenspiel |
| `käsekästchen online zu zweit` / `gegen freund` | Dots and Boxes | Nur Ausmal-PDFs und ein Spiel gegen den Computer, **kein** Online-Duell auf Deutsch |
| `königliches spiel von ur online deutsch` | Ur | Nur englische/französische Seiten und Apps |
| `ultimate tic tac toe deutsch online zu zweit` | Tic-Tac-Turbo | Nur englische Apps |
| `kalaha online zu zweit` / `bohnenspiel online` | Mancala | Wenige deutsche Seiten |
| `laser schach online` | Laserlabyrinth | Kaum deutsche Treffer |
| `gomoku online zu zweit` / `fünf in einer reihe online` | Fünf gewinnt | Wenige deutsche Seiten |
| `sbb spiel` / `zug spiel schweiz` | SBB Runner | Schweizer Nische |
| `schweizer brettspiel online` / `schweizer strassen brettspiel` | Strassenbaron | Schweizer Nische |
| `browserspiele schweiz` / `online spiele schweiz` | Startseite | Keine Schweizer Treffer |
| `detektivspiel online zu zweit` | Nebelvilla | Wenige deutsche Seiten |

Bewusst **nicht** verwendet: Markennamen anderer Spiele (Monopoly, Mario Kart, Angry Birds, Cluedo, Pentago, Quoridor …) wegen Markenrecht,
und „unblocked games“-Begriffe (die zielen auf das Umgehen von Schulsperren).

## 3. Was schon eingebaut ist (passiert automatisch beim Hochladen)

- **Startseite**: Titel `KEI Langwiligi site – Online Spiele zu zweit, gratis & ohne Werbung`, Beschreibung mit „ohne Werbung“,
  Sprache `de-CH`, sichtbarer Text „Über die Seite“ mit den grünen Begriffen und 4 Fragen & Antworten.
- **Strukturierte Daten (schema.org)**: Name der Seite mit Varianten („Langwiligi site“, „Langwiligi“, „langwiligi.site“), Logo,
  Liste aller Spiele. So zeigt Google eher „KEI Langwiligi site“ als Seitennamen.
- **Jedes Spiel** bekommt beim Hochladen (`deploy.sh`):
  - Titel mit Suchbegriff, z.B. `Dots and Boxes (Käsekästchen) – online zu zweit spielen, kostenlos | KEI Langwiligi site`
    (Suchbegriff aus `<meta name="spiel-suche">`, siehe SPIEL-VORGABEN.md)
  - längere Beschreibung: „Gratis im Browser spielen: zu zweit an einem Laptop, online mit Freunden oder gegen Bots. Ohne Download, ohne Werbung.“
  - Vorschau für geteilte Links (WhatsApp, Discord …) mit dem Titelbild des Spiels
  - strukturierte Daten als Spiel (VideoGame) und Brotkrumen-Pfad `KEI Langwiligi site › Spiel`
- **IndexNow**: Nach jedem Hochladen bekommen Bing, Ecosia, DuckDuckGo, Yandex & Co. automatisch die Startseite und alle Spiele,
  die seit gestern neu sind oder geändert wurden. Unveränderte Spiele werden nicht jedes Mal gemeldet, sonst wird die Seite gebremst.
  Schlüssel in `startseite/indexnow.txt` (darf öffentlich sein).
- `sitemap.xml` und `robots.txt` gab es schon.

## 4. Was nur du machen kannst (wichtig!)

1. **Google Search Console** (am wichtigsten, 10 Minuten): https://search.google.com/search-console
   - „Property hinzufügen“ → **Domain** `langwiligi.site` → TXT-Eintrag beim Domain-Anbieter eintragen.
     Oder „URL-Präfix“ `https://langwiligi.site/` → Methode „HTML-Datei“ → die Datei (z.B. `google1234abcd.html`) in den Ordner
     `startseite/` legen und hochladen. `deploy.sh` kopiert sie automatisch an die richtige Stelle.
   - Danach unter **Sitemaps** `https://langwiligi.site/sitemap.xml` einreichen.
   - Unter **URL-Prüfung** die Startseite eingeben → „Indexierung beantragen“. Das gleiche für 3–5 wichtige Spiele.
2. **Bing Webmaster Tools**: https://www.bing.com/webmasters → „Aus Google Search Console importieren“.
   Bing liefert auch die Ergebnisse für Ecosia, DuckDuckGo und Yahoo.
3. **Links von anderen Seiten** (Google vertraut einer Seite, auf die andere verlinken):
   - itch.io: Ein paar Spiele als Browser-Spiel hochladen, mit Link „Mehr Spiele auf langwiligi.site“.
   - Reddit (r/Switzerland, r/BrowserGames, r/WebGames), Discord-Server, Klassen-Chats, Instagram/TikTok-Clips von Spielen.
   - LinkedIn-Beitrag (Vorlage in `docs/linkedin/`).
   - Auf GitHub beim Repository unter „About“ die Webseite eintragen und Themen (Topics) setzen:
     `browser-games`, `html5-games`, `multiplayer`, `deutsch`, `schweiz`.
   - Spiele-Verzeichnisse für HTML5-Spiele, auf denen man eigene Seiten eintragen kann.
4. **Geduld**: Neue Seiten brauchen bei Google meist 1–4 Wochen. In der Search Console unter „Leistung“ sieht man,
   mit welchen Wörtern die Leute kommen. Diese Wörter dann in `spiel-suche` und im Text verstärken.

## 5. Neue Spiele

Bei jedem neuen Spiel ein `<meta name="spiel-suche" content="…">` setzen. Vorgehen:
Überleg, wie jemand das Spiel bei Google suchen würde, der den Namen nicht kennt (z.B. „Kalaha“ statt „Mancala“).
Am besten ein deutsches Wort, das wenige andere Seiten haben.
