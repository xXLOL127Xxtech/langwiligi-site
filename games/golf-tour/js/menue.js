// Golf-Tour – Menüs: Titel, Namen, Online, Pause, Zwischenstand, Endergebnis, Einstellungen
'use strict';

const Menue = {
  aktuell: 'sTitel', lokalModus: null,
  zeige(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
    this.aktuell = id;
    Eingabe.aktiv = !id && App.zustand === 'spiel';
    $('hudBox').classList.toggle('hidden', !App.ansichten.length || ['sTitel', 'sOnline', 'sLobby', 'sEnde', 'sNamen'].includes(id));
    if (id) setTimeout(() => { const b = $(id).querySelector('.btn.haupt:not(.hidden), .btn:not(.hidden)'); if (b && document.activeElement.tagName !== 'INPUT') b.focus(); }, 30);
  },
  init() {
    $('mSolo').onclick = () => { Ton.sfx('wahl'); App.starten('solo', { namen: [HUB && HUB.getName() || Einst.namen[0] || 'Du'] }); };
    $('mAbw').onclick = () => this.lokal('abw');
    $('mSplit').onclick = () => this.lokal('split');
    $('mOnline').onclick = () => { Ton.sfx('wahl'); this.zeige('sOnline'); Netz.zeigen(); };
    if (!HUB) { $('mOnline').disabled = true; $('mOnline').innerHTML = 'Online mit Freunden <small>(nur auf langwiligi.site)</small>'; }
    $('mHilfe').onclick = () => { this.hilfeZurueck = 'sTitel'; this.zeige('sHilfe'); };
    $('hZurueck').onclick = () => this.zeige(this.hilfeZurueck || 'sTitel');
    $('oZurueck').onclick = () => this.zeige('sTitel');
    $('nZurueck').onclick = () => this.zeige('sTitel');
    $('nLos').onclick = () => {
      const a = $('nName1').value.trim().slice(0, 16) || 'Spieler 1', b = $('nName2').value.trim().slice(0, 16) || 'Spieler 2';
      Einst.namen = [a, b]; einstSpeichern();
      Ton.sfx('wahl');
      App.starten(this.lokalModus, { namen: [a, b] });
    };
    for (const id of ['nName1', 'nName2']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('nLos').click(); });
    $('oCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('oBeitreten').click(); });
    $('oName').addEventListener('keydown', e => { if (e.key === 'Enter') ($('oCode').value ? $('oBeitreten') : $('oErstellen')).click(); });
    // Pause
    $('pWeiter').onclick = () => this.pause(false);
    $('pAufgeben').onclick = () => {
      for (const s of App.spieler) if (!s.fertig) App.aufheben(s, App.ansichten.find(a => a.sp === s) || App.ansichten[0]);
      this.pause(false);
    };
    $('pHilfe').onclick = () => { this.hilfeZurueck = 'sPause'; this.zeige('sHilfe'); };
    $('pMenue').onclick = () => { this.pause(false); App.zumMenue(); };
    // Zwischenstand und Ende
    $('zWeiter').onclick = () => App.naechsteBahn();
    $('eNochmal').onclick = () => {
      if (App.online) { if (Netz.istHost()) Netz.starten(); }
      else App.starten(App.modus, { namen: App.spieler.map(s => s.name) });
    };
    $('eMenue').onclick = () => App.zumMenue();
    // Einstellungen
    $('tGrafik').onclick = () => {
      Einst.grafik = { hoch: 'mittel', mittel: 'niedrig', niedrig: 'hoch' }[Einst.grafik] || 'hoch';
      einstSpeichern(); App.groesse(); this.einstText();
    };
    $('tTon').onclick = () => { Einst.stumm = !Einst.stumm; Ton.init(); Ton.lautstaerke(); einstSpeichern(); this.einstText(); };
    $('tPutt').onclick = () => { Einst.putthilfe = !Einst.putthilfe; einstSpeichern(); this.einstText(); };
    $('pTon').onclick = () => $('tTon').click();
    this.einstText();
    // Einladungslink
    if (location.hash && HUB) {
      const code = HUB.cleanCode(location.hash);
      if (code.length === 4) { $('oCode').value = code; this.zeige('sOnline'); Netz.zeigen(); setTimeout(() => $('oName').focus(), 80); return; }
    }
    this.zeige('sTitel');
  },
  einstText() {
    $('tGrafik').textContent = 'Grafik: ' + { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' }[Einst.grafik];
    $('tTon').textContent = 'Ton: ' + (Einst.stumm ? 'Aus' : 'An');
    $('tPutt').textContent = 'Putt-Hilfe: ' + (Einst.putthilfe ? 'An' : 'Aus');
    this.tonKnopf();
  },
  tonKnopf() { const t = 'Ton: ' + (Einst.stumm ? 'Aus' : 'An') + ' (M)'; if ($('pTon')) $('pTon').textContent = t; if ($('tTon')) $('tTon').textContent = 'Ton: ' + (Einst.stumm ? 'Aus' : 'An'); },
  lokal(modus) {
    Ton.sfx('wahl');
    this.lokalModus = modus;
    $('nTitel').textContent = modus === 'abw' ? '2 Spieler · abwechselnd' : '2 Spieler · Splitscreen';
    $('nInfo').innerHTML = modus === 'abw'
      ? 'Ihr spielt am selben Bildschirm und schlagt <b>abwechselnd</b>, Schlag für Schlag. Beide benutzen dieselben Tasten.'
      : 'Der Bildschirm wird geteilt und ihr spielt <b>gleichzeitig</b>.<br><b style="color:#4f8ff7">Links:</b> A/D zielen, W/S Schläger, Q/E/R/F Drall, Leertaste schlagen, C Übersicht.<br><b style="color:#ef5350">Rechts:</b> ←/→ zielen, ↑/↓ Schläger, J/L/I/K Drall, Enter schlagen, - Übersicht.';
    $('nName1').value = Einst.namen[0] || 'Spieler 1';
    $('nName2').value = Einst.namen[1] || 'Spieler 2';
    this.zeige('sNamen');
    setTimeout(() => $('nLos').focus(), 40);
  },
  pause(an) {
    if (an && App.zustand !== 'spiel') return;
    App.pausiert = !!an;
    $('pAufgeben').classList.toggle('hidden', App.spieler.every(s => s.fertig));
    $('pInfo').textContent = App.online ? 'Online läuft das Spiel weiter.' : '';
    if (an) { for (const s of App.spieler) if (s.zustand === 'laden') s.zustand = 'zielen'; this.zeige('sPause'); }
    else this.zeige(null);
  },
  zwischen(nr) {
    const alle = App.spieler.concat(App.geister);
    $('zTitel').textContent = `Bahn ${nr + 1} geschafft`;
    $('zKarte').innerHTML = scoreTabelle(App.plan, alle, nr);
    const n = App.plan[nr + 1];
    $('zNaechste').innerHTML = `Nächste Bahn: <b>${esc(n.thema.name)}</b> · Par ${n.par}`;
    $('zWeiter').classList.remove('hidden');
    $('zCount').textContent = '';
    this.zeige('sZwischen');
  },
  zwischenOnline(nr, naechste) {
    if (App.zustand === 'zwischen' && this.countdown) return;
    App.zustand = 'zwischen';
    this.zwischen(nr);
    $('zWeiter').classList.add('hidden');
    let t = 6;
    const tick = () => {
      if (App.zustand !== 'zwischen') { this.countdown = null; return; }
      $('zCount').textContent = `Weiter in ${t} …`;
      if (t-- <= 0) { this.countdown = null; App.bahnLaden(naechste); return; }
      this.countdown = setTimeout(tick, 1000);
    };
    tick();
  },
  ende(liste) {
    const alle = liste.filter(s => s.karte.some(v => v != null));
    const sortiert = alle.slice().sort((a, b) => a.gesamt() - b.gesamt());
    const par = App.plan.reduce((s, p) => s + p.par, 0);
    let titel;
    if (sortiert.length === 1) {
      const d = sortiert[0].gesamt() - par;
      titel = d < 0 ? `Super Runde! ${plusMinus(d)} unter Par` : d === 0 ? 'Genau Par – stark!' : `Runde beendet: ${plusMinus(d)}`;
    } else if (sortiert.length > 1 && sortiert[0].gesamt() === sortiert[1].gesamt()) titel = 'Unentschieden!';
    else titel = `🏆 ${sortiert[0] ? sortiert[0].name : ''} gewinnt!`;
    $('eTitel').textContent = titel;
    const rang = sortiert.map(s => sortiert.findIndex(q => q.gesamt() === s.gesamt()));
    $('ePodest').innerHTML = sortiert.map((s, i) => `<div class="pPlatz"><span>${['🥇', '🥈', '🥉'][rang[i]] || (rang[i] + 1) + '.'}</span><i style="background:${s.farbe}"></i><b>${esc(s.name)}</b><em>${s.gesamt()} (${plusMinus(s.gesamt() - par)})</em></div>`).join('');
    $('eKarte').innerHTML = scoreTabelle(App.plan, sortiert, -1);
    $('eNochmal').classList.toggle('hidden', App.online && !Netz.istHost());
    $('eInfo').textContent = App.online && !Netz.istHost() ? 'Der Gastgeber kann eine neue Runde starten.' : '';
    if (App.online && HUB) { this.boardZiel = $('eBoard'); Netz.boardEl = $('eBoard'); HUB.loadBoard(GAME_ID, $('eBoard'), HUB.getName()); $('eBoard').classList.remove('hidden'); }
    else $('eBoard').classList.add('hidden');
    Ton.sfx('fanfare');
    this.zeige('sEnde');
  },
};

addEventListener('load', () => {
  try { App.init(); } catch (e) { console.error(e); $('laden').classList.remove('hidden'); $('ladenText').textContent = 'WebGL konnte nicht gestartet werden. Bitte einen aktuellen Browser verwenden.'; return; }
  Menue.init();
});
