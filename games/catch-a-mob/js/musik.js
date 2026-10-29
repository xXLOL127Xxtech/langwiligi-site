'use strict';
// Catch a Mob – Musik: jedes Gebiet hat seinen eigenen Dauerton, im Kampf wird es schneller und härter.
// Von klassisch (Wiesen, Wald) über Retro (Eis, Vulkan) bis Arcade (Kristallschlucht). Titelmusik im Menü.
// Dateien: musik/*.ogg (erzeugt mit tools/catch-a-mob-musik/compose.py). Läuft über normale Audio-Elemente, also auch lokal ohne Server.
(function (G) {
  const CAM = G.CAM, S = CAM.S;
  // Gebiet (Biom-Nummer) -> Musikstück
  const GEBIET = ['01_sonnenwiese', '04_wuestenwind', '02_fluesterwald', '05_eisgipfel', '03_kristallhoehle', '06_vulkan', '08_koenigsburg', '07_neonstadt'];
  const KAMPF = ['b01_kampf_wiese', 'b04_kampf_wueste', 'b02_kampf_wald', 'b05_kampf_eis', 'b03_kampf_hoehle', 'b06_kampf_vulkan', 'b08_kampf_boss', 'b07_kampf_neon'];
  const TITEL = '00_titel', BOSS = 'b08_kampf_boss';
  const LAUT = 0.5, SCHRITT = 0.05;       // Grundlautstärke, Schrittweite pro Takt (alle 100 ms)

  const M = CAM.Musik = { an: false };
  const spur = {};          // id -> { a: Audio, v: aktuelle Lautstärke, ziel: Ziel }
  let ziel = null, kampf = false, bereit = false, bio = -1, bioSeit = 0, titel = false, iv = null;
  let kannOgg = false;
  try { kannOgg = !!new Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) { /* kein Ton */ }

  function holen(id) {
    if (!spur[id]) {
      const a = new Audio('musik/' + id + '.ogg'); a.loop = true; a.preload = 'auto'; a.volume = 0;
      spur[id] = { a, v: 0, ziel: 0 };
    }
    return spur[id];
  }
  function takt() {
    const stumm = !!(CAM.UI && CAM.UI.muted);
    for (const id in spur) {
      const s = spur[id], z = stumm ? 0 : s.ziel;
      // Einblenden langsamer als Ausblenden, im Kampf geht es schnell
      const st = kampf || id === ziel ? SCHRITT * (kampf ? 3 : 1) : SCHRITT * 2;
      s.v = s.v < z ? Math.min(z, s.v + st * LAUT) : Math.max(z, s.v - st * LAUT * 1.5);
      try { s.a.volume = Math.max(0, Math.min(1, s.v)); } catch (e) { /* ignore */ }
      if (bereit && z > 0 && s.a.paused) { const p = s.a.play(); if (p && p.catch) p.catch(() => {}); }
      if (s.v <= 0 && z <= 0 && !s.a.paused) s.a.pause();
    }
  }
  function setze(id) {
    if (!kannOgg || id === ziel) return;
    ziel = id;
    for (const k in spur) spur[k].ziel = 0;
    if (id) { const s = holen(id); s.ziel = LAUT; if (s.a.paused && s.v <= 0) s.a.currentTime = 0; }
    if (!iv) iv = setInterval(takt, 100);
  }
  // Nach der ersten Taste oder dem ersten Klick darf der Browser Musik abspielen
  M.entsperren = function () {
    if (bereit) return; bereit = true; M.an = true;
    for (const id in spur) if (spur[id].a.paused && spur[id].ziel > 0) { const p = spur[id].a.play(); if (p && p.catch) p.catch(() => { bereit = false; }); }
    takt();
  };
  M.titel = function (ein) { titel = !!ein; if (titel) { kampf = false; bio = -1; bioSeit = 0; setze(TITEL); } else if (bio >= 0) setze(GEBIET[bio]); };
  // Jeden Takt aus der Spielschleife: Gebiet merken, erst nach 3 s im neuen Gebiet umblenden (Grenzen sind verwinkelt)
  M.update = function (dt, biom) {
    if (titel || kampf) return;
    if (biom !== bio) { bioSeit += dt; if (bio < 0 || bioSeit > 3) { bio = biom; bioSeit = 0; setze(GEBIET[bio]); } } else bioSeit = 0;
  };
  M.kampf = function (raid, biom) {
    kampf = true; setze(raid ? BOSS : (KAMPF[biom != null ? biom : bio] || KAMPF[0]));
  };
  M.kampfEnde = function () { kampf = false; if (!titel && bio >= 0) setze(GEBIET[bio]); };
})(window);
