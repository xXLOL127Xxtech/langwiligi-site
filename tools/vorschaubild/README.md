# Vorschaubild für geteilte Links

Wird `https://langwiligi.site` in WhatsApp, Discord, Instagram usw. geschickt, erscheint `startseite/vorschau.jpg` (1200 × 630) als grosses Bild mit dem Titel „KEI Langwiligi site – Best Browser Games!“. Die Tags dazu (`og:…`) stehen in `startseite/index.html`, `deploy.sh` lädt das Bild mit hoch.

Neu bauen (z.B. wenn viele neue Spiele dazugekommen sind):

```
node tools/vorschaubild/bauen.js
```

- Aussehen: `vorlage.html`
- Welche Cover vorne stehen: Liste `FAVORITEN` in `bauen.js`
- Braucht Playwright mit Chromium (falls nötig: `NODE_PATH=$(npm root -g) node tools/vorschaubild/bauen.js`)

WhatsApp merkt sich Vorschauen eine Weile. Ein Link, der schon einmal geschickt wurde, zeigt das neue Bild evtl. erst später.
