# Catch a Mob – Musik

`compose.py` komponiert und rendert alle Stücke (selbst erzeugt, keine fremden Aufnahmen, keine Lizenz nötig).
Nur das Ergebnis (`*.ogg`) liegt in `games/catch-a-mob/musik/`.

```bash
CAM_OUT=games/catch-a-mob/musik CAM_OGG_Q=3 CAM_FORMATS=ogg python3 tools/catch-a-mob-musik/compose.py 0 b0
```

Braucht `python3`, `numpy` und `ffmpeg`. Akkorde, Instrumente und Tempo stehen im Abschnitt `TRACKS`.
Zuordnung Gebiet → Stück steht in `games/catch-a-mob/js/musik.js`.
