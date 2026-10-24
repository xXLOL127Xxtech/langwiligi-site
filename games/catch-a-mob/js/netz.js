'use strict';
// Catch a Mob – Verbindung zu den anderen Spielern (über GameHub). Ohne GameHub bleibt nur der Bots-Modus.
(function (G) {
  const CAM = G.CAM;
  const GAME_ID = 'catch-a-mob';
  const MAX_SPIELER = 20;      // der Server begrenzt aktuell auf 8 und passt das Ergebnis an
  const N = CAM.Netz = { GAME_ID, room: null, idx: -1, max: MAX_SPIELER, handlers: {}, namen: {}, online: false };

  N.verfuegbar = () => !!G.GameHub && typeof G.GameHub.connect === 'function';
  N.on = (t, fn) => { (N.handlers[t] = N.handlers[t] || []).push(fn); };
  const emit = (t, ...a) => (N.handlers[t] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } });

  function verbinden() {
    const room = G.GameHub.connect(GAME_ID);
    room.on('msg', (d, from) => { if (d && typeof d === 'object') { if (d.to !== undefined && d.to !== room.you) return; emit('msg', d, from); } });
    room.on('peer-join', m => emit('peer-join', m));
    room.on('peer-left', m => emit('peer-left', m));
    room.on('close', () => { N.online = false; emit('close'); });
    N.room = room;
    return room;
  }
  N.erstellen = async function (name) {
    const room = verbinden();
    const info = await room.create(name, MAX_SPIELER);
    N.idx = room.you; N.online = true; N.max = info.max || room.max || 8;
    return info;
  };
  // Offene Welt: alle Online-Spieler landen automatisch im selben Raum (bis 20), danach öffnet sich der nächste
  N.mitspielen = async function (name) {
    const room = verbinden();
    const info = await room.quick(name, MAX_SPIELER);
    N.idx = room.you; N.online = true; N.max = info.max || room.max || 8;
    return info;
  };
  N.beitreten = async function (code, name) {
    const room = verbinden();
    const info = await room.join(code, name);
    N.idx = room.you; N.online = true; N.max = info.max || room.max || 8;
    return info;
  };
  N.senden = function (d) { if (N.room && N.online) N.room.send(d); };
  N.schliessen = function () { if (N.room) { N.room.close(); N.room = null; } N.online = false; N.idx = -1; };
  N.spieler = function () { return N.room && N.room.players ? N.room.players : []; };
  N.link = function () { return G.GameHub ? G.GameHub.SEITE + '/' + GAME_ID + '/#' + N.room.code : ''; };
  N.code = () => N.room ? N.room.code : '';
  // Gastgeber der Welt = kleinster besetzter Platz (wechselt automatisch, wenn jemand geht)
  N.gastgeber = function () {
    const p = N.spieler();
    for (let i = 0; i < p.length; i++) if (p[i]) return i;
    return N.idx;
  };
})(window);
