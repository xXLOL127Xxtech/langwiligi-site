# 🎮 KEI Langwiligi site

**Browser-Spiele für 1 gegen 1 – lokal, online oder gegen Bots. Direkt im Browser, ohne Download.**

👉 **Jetzt spielen: [langwiligi.site](https://langwiligi.site/)**

[![Startseite von langwiligi.site](startseite-vorschau.png)](https://langwiligi.site/)

## Spiele

| Spiel | Modi | Worum geht's? |
|---|---|---|
| [Backgammon](https://langwiligi.site/backgammon/) | Lokal · Bots | Würfeln, ziehen, abtragen – der Brettspiel-Klassiker. |
| [Berg-Bastler](https://langwiligi.site/berg-bastler/) | Solo | Bau dein eigenes Auto und bezwinge den Berg. |
| [Billard-Duell](https://langwiligi.site/billard-duell/) | Lokal · Online | Billard im Duell mit Power-ups. |
| [Blasen-Arena](https://langwiligi.site/blasen-arena/) | Bots | Team gegen Bots: Gegner in Blasen fangen, 8 Level. |
| [Blech-Duell](https://langwiligi.site/blech-duell/) | Lokal · Online · Bots | Zwei Karren, eine Arena, jede Menge Kanonen. |
| [Bogen-Duell](https://langwiligi.site/bogen-duell/) | Online · Bots | 1 gegen 1 mit Pfeil und Bogen in 3D. |
| [Bubble-Duell](https://langwiligi.site/bubble-duell/) | Online · Bots | Bubble-Shooter im Duell. |
| [Dame](https://langwiligi.site/dame/) | Lokal · Online · Bots | Springen, schlagen, zur Dame werden. |
| [Dead Maze](https://langwiligi.site/dead-maze/) | Solo | Tower-Defense gegen Zombie-Horden. |
| [Dreh-Duell](https://langwiligi.site/dreh-duell/) | Lokal · Online · Bots | Kugel setzen, Brettviertel drehen, fünf in eine Reihe. |
| [Farben-Duell](https://langwiligi.site/farben-duell/) | Lokal · Online · Bots | Deine Zielfarbe bestimmt den Zug des Gegners. |
| [Festungs-Duell](https://langwiligi.site/festungs-duell/) | Lokal · Online | Truppen schicken, Türme bauen, Festung zerstören – in Echtzeit. |
| [Flaschen-Flip](https://langwiligi.site/flaschen-flip/) | Solo | Flip die Flasche und lande sie aufrecht. |
| [Fünf gewinnt](https://langwiligi.site/fuenf-gewinnt/) | Lokal · Online · Bots | X gegen O auf dem grossen Brett. |
| [Go](https://langwiligi.site/go/) | Lokal · Bots | Das Umzingelungs-Spiel auf 9×9, 13×13 und 19×19. |
| [Käsekästchen](https://langwiligi.site/kaesekaestchen/) | Lokal · Online · Bots | Linien ziehen, Kästchen schliessen, Extrazüge holen. |
| [Katapult-Krieg](https://langwiligi.site/katapult-krieg/) | Lokal · Online · Bots | Schiess die Burg deines Gegners in Trümmer. |
| [Das Königliche Spiel von Ur](https://langwiligi.site/koenigliches-ur/) | Lokal · Bots | 4500 Jahre altes Würfel-Rennspiel. |
| [Laser-Duell](https://langwiligi.site/laser-duell/) | Lokal · Online · Bots | Spiegel drehen, bis der Laser den Kern trifft. |
| [Mancala](https://langwiligi.site/mancala/) | Lokal · Online · Bots | Das uralte Säspiel mit Steinen und Mulden. |
| [Mauer-Duell](https://langwiligi.site/mauer-duell/) | Lokal · Online · Bots | Ans Ziel rennen und dem Gegner den Weg verbauen. |
| [Panzer-Taktik](https://langwiligi.site/panzer-taktik/) | Lokal · Online | Rundenbasiertes Panzer-Duell mit Minen und Raketen. |
| [Reversi](https://langwiligi.site/reversi/) | Lokal · Online · Bots | Steine einschliessen und umdrehen. |
| [SBB Runner](https://langwiligi.site/sbb-runner/) | Solo · Bots · Lokal · Online | Renn über Schweizer Gleise und häng den Kontrolleur ab. |
| [Schach](https://langwiligi.site/schach/) | Lokal · Bots | Gegen einen Bot mit vier Stärken und drei Stilen. |
| [Schlangen-Arena](https://langwiligi.site/schlangen-arena/) | Online · Bots | Friss Kugeln, werde lang, schneide den anderen den Weg ab. |
| [Schleuder-Duell](https://langwiligi.site/schleuder-duell/) | Lokal · Online | Schleuder, Wind und TNT-Fässer. |
| [Ultimate Tic-Tac-Toe](https://langwiligi.site/ultimate-tic-tac-toe/) | Lokal · Online · Bots | Tic-Tac-Toe im Tic-Tac-Toe. |
| [Vier gewinnt](https://langwiligi.site/vier-gewinnt/) | Lokal · Online · Bots | Steine fallen lassen, vier in eine Reihe bringen. |

## Eigenes Spiel hochladen

Jeder kann mitmachen – auch ohne Programmier-Erfahrung mit Git.
**Anleitung: [MITMACHEN.md](MITMACHEN.md)** · Regeln für Spiele: [SPIEL-VORGABEN.md](SPIEL-VORGABEN.md)

Kurz: Spielordner auf GitHub hochladen → automatische Prüfung → nach dem OK ist das Spiel in ca. 1 Minute auf langwiligi.site.

## Wie es funktioniert

```
Freund lädt games/<spiel>/ hoch ──► Pull Request ──► Prüfung (tools/spiel-pruefen.js)
                                         │
                              Besitzer klickt "Merge"
                                         ▼
                 GitHub Actions baut die Startseite (deploy.sh) ──SSH──► Server (nginx)
```

- **Spiele**: reines HTML/CSS/JavaScript, eine `index.html` pro Ordner, kein Build-Schritt.
- **Startseite**: wird beim Hochladen aus `<title>` und den `<meta>`-Angaben jedes Spiels gebaut (`deploy.sh`).
- **Online-Modus & Ranglisten**: eigener kleiner Node.js-Server mit WebSockets (`server/game-hub.js`), im Browser über `games/_shared/hub.js`.
- **Hochladen**: GitHub Actions mit einem SSH-Schlüssel, der auf dem Server nur die Webseite austauschen darf (`server/langwiligi-deploy.sh`).
- **Server**: Ubuntu, nginx, HTTPS mit Let's Encrypt.

## Ordner

| Pfad | Inhalt |
|---|---|
| `games/<spiel-id>/` | Ein Spiel: `index.html`, `cover.webp`, Bilder, Sounds |
| `games/_shared/` | Gemeinsamer Code für alle Spiele (Zurück-Knopf, Online-Funktionen) |
| `server/` | Spiel-Server und Upload-Skript für den Server |
| `tools/spiel-pruefen.js` | Automatische Prüfung neuer Spiele |
| `.github/workflows/` | Prüfung bei Pull Requests, Online-Stellen bei `main` |
