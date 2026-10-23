'use strict';
// Catch a Mob – Spielzustand und Speichern (nur im Browser, Schlüssel beginnen mit der Spiel-ID).
(function (G) {
  const CAM = G.CAM;
  const KEY = 'catch-a-mob-spielstand';
  const S = CAM.S = {
    modus: 'titel',          // titel | welt
    online: false, idx: 0, name: 'Spieler',
    save: null, x: 0, y: 0, dir: 2, schritte: 0, letzteKachel: '',
    peers: new Map(), prot: {}, pt: -1, busy: false,
    trainerT: {}, teams: {}, bewegt: false, sendeT: 0, anim: 0,
    wetter: 'klar', biome: 0, hinweis: '', ziel: null, gest: null,
    qualitaet: 1, angebot: null,
  };
  const Save = CAM.Save = {
    neu() {
      const d = CAM.Welt.dorf[0];
      return { v: 1, gold: 300, items: { siegel1: 5, trank: 3 }, team: [], box: [], dex: {}, besucht: [0], x: d.x, y: d.y + 3, w: 0, l: 0, bossT: {}, verkauft: [], col: 0, name: '', start: false, ton: true, quali: 1 };
    },
    laden() { try { const j = G.localStorage.getItem(KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } },
    speichern() { try { if (S.save) { S.save.x = S.x; S.save.y = S.y; G.localStorage.setItem(KEY, JSON.stringify(S.save)); } } catch (e) {} },
    export() { return btoa(unescape(encodeURIComponent(JSON.stringify(S.save)))); },
    import(code) {
      try {
        const o = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
        if (!o || o.v !== 1 || !Array.isArray(o.team) || !Array.isArray(o.box) || typeof o.gold !== 'number') return null;
        o.team = o.team.filter(m => m && CAM.FAMILIEN[m.fam]).slice(0, 6); o.box = o.box.filter(m => m && CAM.FAMILIEN[m.fam]).slice(0, 100);
        o.team.concat(o.box).forEach(m => { m.lv = Math.max(1, Math.min(50, m.lv | 0)); CAM.neuBerechnen(m); m.hp = Math.max(0, Math.min(m.mhp, m.hp | 0)); m.status = null; });
        o.gold = Math.max(0, Math.min(9999999, o.gold | 0));
        o.items = o.items && typeof o.items === 'object' ? o.items : {};
        return o;
      } catch (e) { return null; }
    },
  };
  CAM.lebend = () => S.save && S.save.team.some(m => m.hp > 0);
  CAM.maxLv = () => S.save && S.save.team.length ? Math.max.apply(null, S.save.team.map(m => m.lv)) : 1;
  CAM.itemAnz = k => (S.save.items[k] || 0);
  CAM.itemAdd = (k, n) => { S.save.items[k] = Math.max(0, (S.save.items[k] || 0) + n); if (!S.save.items[k]) delete S.save.items[k]; };
})(window);
