// Sternen-Party – Anzeige über dem Brett (HTML): Spielerkarten, Dialoge, Sprechblasen, Roulette,
// Minispiel-Ansage, Ergebnisse und Siegerehrung. Alles wird aus Spiel.Z abgeleitet.
// Gesteuert wird mit dem Tastenblock des Spielers, der gerade gefragt wird (online: mit allen Tasten), oder per Klick.
'use strict';

const PORTRAITS = {};
function portrait(wer) {
  if (PORTRAITS[wer]) return PORTRAITS[wer];
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d'); g.scale(2, 2);
  const t = 1.3;
  if (wer === 'stella') zeichneStella(g, 48, 50, 34, t);
  else if (wer === 'grimm') zeichneGrimm(g, 48, 90, 34, t, true);
  else if (wer === 'gusti') zeichneGusti(g, 48, 50, 32, t);
  else if (wer === 'laden') { zeichneFigur(g, 2, 48, 88, 28, { t, emo: 'froh', schatten: false }); g.fillStyle = '#ff4f7a'; g.fillRect(28, 20, 40, 8); }
  else if (wer === 'bank') { zeichneMuenze(g, 48, 48, 30); }
  return (PORTRAITS[wer] = c.toDataURL());
}
function blockText(b) {
  if (b == null || b < 0) return '';
  const B = BLOECKE[b];
  return `<kbd>${B.tasten.join('</kbd><kbd>')}</kbd> + <kbd>${B.aktionText}</kbd>`;
}
function aktionTaste(b) { return b != null && b >= 0 ? `<kbd>${BLOECKE[b].aktionText}</kbd>` : '<kbd>Leertaste</kbd>'; }

const UI = {
  keys: {}, wahl: 0, anzeigeMuenzen: [0, 0, 0, 0], bannerT: 0, rouletteStart: 0,
  init() {
    Eingabe.hoere((block, rolle) => this.taste(block, rolle));
    $('dialog').addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      this.wahl = +b.dataset.i; this.bestaetigen(true);
    });
    $('meldung').addEventListener('click', () => this.infoWeiter(true));
    $('vollbild').addEventListener('click', e => {
      const b = e.target.closest('[data-bereit]');
      if (b) this.bereitMelden(+b.dataset.bereit, true);
    });
  },
  zuruecksetzen() {
    this.keys = {}; this.anzeigeMuenzen = [0, 0, 0, 0];
    for (const id of ['meldung', 'dialog', 'vollbild', 'roulette']) $(id).classList.add('hidden');
    $('banner').className = '';
  },
  // ---------- Wer darf gerade bedienen? ----------
  // Gibt zurück, ob dieser Rechner/Tastenblock die aktuelle Frage beantworten darf
  darf(block, klick) {
    const Z = Spiel.Z, f = Z && Z.frage;
    if (!f) return false;
    if (f.sp < 0) return f.typ === 'info' && (Z.modus === 'lokal' || Spiel.host) && this.irgendeinMensch(block, klick);
    const s = Z.spieler[f.sp];
    if (Z.modus === 'online') return s.art !== 'bot' && s.slot === Netz.you;
    if (s.art !== 'mensch') return false;
    return klick || block === -1 || s.block === block || Z.zeiger;
  },
  irgendeinMensch(block, klick) {
    const Z = Spiel.Z;
    if (Z.modus === 'online' || Z.zeiger) return true;
    return klick || block === -1 || Z.spieler.some(s => s.art === 'mensch' && s.block === block);
  },
  // ---------- Tasten ----------
  taste(block, rolle) {
    const Z = Spiel.Z;
    if (!Z || App.bildschirm !== 'spiel' || App.pause) return;
    // Erst nach diesem Tastendruck pausieren, sonst schliesst das Pausenmenü sofort wieder
    if (rolle === 'zurueck') { if (Z.modus === 'lokal') setTimeout(() => App.pausieren(true)); return; }
    if (Z.phase === 'mini-intro') { if (rolle === 'aktion') this.bereitTaste(block); return; }
    if (Z.phase === 'ende') return;
    const f = Z.frage;
    if (!f || !this.darf(block, false)) return;
    if (f.typ === 'info' || f.typ === 'wuerfel') { if (rolle === 'aktion') this.antworten(true); return; }
    const opts = f.optionen || [];
    if (rolle === 'aktion') { this.bestaetigen(false); return; }
    if (f.typ === 'weg') {
      // Richtungstaste wählt den Weg, der am besten in diese Richtung zeigt
      const von = Spiel.brett.felder[f.feld];
      const dir = { hoch: [0, -1], runter: [0, 1], links: [-1, 0], rechts: [1, 0] }[rolle];
      let best = this.wahl, bw = -2;
      opts.forEach((o, k) => {
        const n = Spiel.brett.felder[o.w]; const dx = n.x - von.x, dy = n.y - von.y, l = Math.hypot(dx, dy);
        const w = (dx * dir[0] + dy * dir[1]) / l; if (w > bw) { bw = w; best = k; }
      });
      this.wahlSetzen(best);
      return;
    }
    const spalten = f.typ === 'wunsch' ? 5 : 1;
    let k = this.wahl;
    const schritt = rolle === 'hoch' ? -spalten : rolle === 'runter' ? spalten : rolle === 'links' ? -1 : 1;
    for (let n = 0; n < opts.length; n++) {
      k = (k + schritt + opts.length) % opts.length;
      if (!opts[k].aus) break;
    }
    this.wahlSetzen(k);
  },
  wahlSetzen(k) {
    if (k === this.wahl) return;
    this.wahl = k; Ton.spiel('fokus');
    const f = Spiel.Z.frage;
    if (f && f.typ === 'weg') Ansicht.wahlFeld = f.optionen[k].w;
    $('dialog').querySelectorAll('[data-i]').forEach(b => b.classList.toggle('fokus', +b.dataset.i === k));
  },
  // Tasten prüfen die Berechtigung schon in taste(), Klicks hier
  bestaetigen(klick) {
    const f = Spiel.Z.frage;
    if (!f || (klick && !this.darf(-2, true))) return;
    const o = (f.optionen || [])[this.wahl];
    if (!o || o.aus) { Ton.spiel('fehler'); return; }
    Ton.spiel('klick');
    this.antworten(o.w);
  },
  infoWeiter(klick) {
    const f = Spiel.Z && Spiel.Z.frage;
    if (f && f.typ === 'info' && this.darf(-1, klick)) this.antworten(true);
  },
  antworten(w) {
    const f = Spiel.Z.frage;
    if (!f || this.gesendet === f.id) return;
    this.gesendet = f.id;
    if (Spiel.host) Spiel.antworte(f.id, w);
    else Netz.senden({ t: 'antwort', id: f.id, w });
  },
  bereitTaste(block) {
    const Z = Spiel.Z, m = Z.mini;
    if (Z.modus === 'online') { this.bereitMelden(-1); return; }
    const sp = Z.spieler.findIndex(s => s.art === 'mensch' && (s.block === block || Z.zeiger));
    if (sp >= 0 && m.teilnehmer.includes(sp)) Spiel.bereit(sp);
    else if (block === -1) Z.spieler.forEach((s, i) => { if (s.art === 'mensch' && Z.spieler.filter(x => x.art === 'mensch').length === 1) Spiel.bereit(i); });
  },
  bereitMelden(sp, klick) {
    const Z = Spiel.Z;
    if (Z.modus === 'online') {
      const ich = Z.spieler.findIndex(s => s.art !== 'bot' && s.slot === Netz.you);
      if (ich < 0) return;
      if (Spiel.host) Spiel.bereit(ich); else Netz.senden({ t: 'bereit' });
      return;
    }
    if (klick && sp >= 0 && Z.spieler[sp].art === 'mensch') Spiel.bereit(sp);
  },

  // ---------- Effekte als Banner ----------
  fx(e) {
    const Z = Spiel.Z;
    if (e.typ === 'dran') this.banner(`${esc(Z.spieler[e.sp].name)} ist dran!`, PLATZ_FARBEN[e.sp], figurBild(Z.spieler[e.sp].figur, 120, 'froh'));
    else if (e.typ === 'runde') this.banner(`Runde ${e.runde} <small>von ${e.runden}</small>`, '#ffd23a');
    else if (e.typ === 'letzte5') { this.banner('Die letzten 5 Runden!', '#ff4f7a'); Ton.spiel('fanfare'); }
  },
  banner(html, farbe, bild) {
    const b = $('banner');
    b.innerHTML = (bild ? `<img src="${bild}" alt="">` : '') + `<span>${html}</span>`;
    b.style.setProperty('--f', farbe);
    b.className = ''; void b.offsetWidth; b.className = 'zeigen';
  },

  // ---------- Jedes Bild: Anzeige an den Zustand anpassen ----------
  update(dt) {
    const Z = Spiel.Z;
    if (!Z) return;
    this.karten(dt);
    this.meldung();
    this.dialog();
    this.roulette();
    this.vollbild();
  },
  geaendert(name, key) { if (this.keys[name] === key) return false; this.keys[name] = key; return true; },
  karten(dt) {
    const Z = Spiel.Z;
    const sichtbar = !['mini', 'mini-intro', 'ende'].includes(Z.phase);
    $('hud').classList.toggle('hidden', !sichtbar);
    $('rundeAnz').innerHTML = `Runde <b>${Z.runde}</b>/${Z.runden}${Z.letzte5 ? ' <span class="heiss">×2</span>' : ''}`;
    const rang = Spiel.rangliste ? Spiel.rangliste.call(Spiel) : [];
    const key = JSON.stringify(Z.spieler.map(s => [s.name, s.figur, s.sterne, s.items, s.art])) + Z.aktiv + JSON.stringify(rang.map(r => r.platz));
    if (this.geaendert('karten', key)) {
      $('karten').innerHTML = Z.spieler.map((s, i) => {
        const platz = (rang.find(r => r.i === i) || {}).platz || 1;
        const art = s.art === 'bot' ? `Computer · ${['Leicht', 'Mittel', 'Schwer'][s.stufe]}` : Z.modus === 'lokal' && !Z.zeiger ? blockText(s.block) : Z.zeiger ? 'Du' : (s.slot === Netz.you ? 'Du' : 'Online');
        return `<div class="karte k${i}${Z.aktiv === i ? ' aktiv' : ''}" style="--f:${PLATZ_FARBEN[i]}">
          <div class="platz p${platz}">${platz}.</div>
          <img class="bild" src="${figurBild(s.figur, 96)}" alt="">
          <div class="info"><div class="name">${esc(s.name)}</div><div class="art">${art}</div>
          <div class="werte"><span class="stern">★ <b>${s.sterne}</b></span><span class="muenz"><i></i> <b class="mz" data-i="${i}">${Math.round(this.anzeigeMuenzen[i])}</b></span></div>
          <div class="items">${s.items.map(id => `<img src="${itemBild(id).toDataURL()}" title="${ITEMS[id].name}" alt="">`).join('')}</div></div></div>`;
      }).join('');
    }
    // Münzen zählen sichtbar hoch/runter
    Z.spieler.forEach((s, i) => {
      const a = this.anzeigeMuenzen[i];
      if (a === s.muenzen) return;
      const n = Math.abs(s.muenzen - a) < 1 ? s.muenzen : a + Math.sign(s.muenzen - a) * Math.max(dt * 14, Math.abs(s.muenzen - a) * dt * 3);
      this.anzeigeMuenzen[i] = (Math.sign(s.muenzen - a) !== Math.sign(s.muenzen - n)) ? s.muenzen : n;
      const el2 = $('karten').querySelector(`.mz[data-i="${i}"]`);
      if (el2) el2.textContent = Math.round(this.anzeigeMuenzen[i]);
    });
  },
  meldung() {
    const Z = Spiel.Z, m = Z.meldung;
    const box = $('meldung');
    const f = Z.frage;
    const hinweis = f && f.typ === 'info' && this.darf(-1, true) ? (Z.modus === 'lokal' && !Z.zeiger && f.sp >= 0 ? `${aktionTaste(Z.spieler[f.sp].block)} weiter` : 'Klick oder Aktion: weiter') : '';
    // Ist gleichzeitig ein Auswahl-Dialog offen, rückt die Sprechblase nach oben
    const oben = !!(f && f.typ !== 'info' && f.typ !== 'wuerfel');
    if (!this.geaendert('meldung', (m ? m.id : 0) + '|' + hinweis + '|' + Z.phase + '|' + oben)) return;
    if (!m || Z.phase === 'mini' || Z.phase === 'mini-intro') { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.className = 'wer-' + m.wer + (oben ? ' oben' : '');
    box.innerHTML = `<img src="${portrait(m.wer)}" alt=""><div><b>${esc(m.titel)}</b><p>${esc(m.text)}</p>${hinweis ? `<small>${hinweis}</small>` : ''}</div>`;
    box.classList.remove('neu'); void box.offsetWidth; box.classList.add('neu');
  },
  dialog() {
    const Z = Spiel.Z, f = Z.frage;
    const box = $('dialog');
    const zeigen = f && !['info'].includes(f.typ) && Z.phase !== 'mini' && Z.phase !== 'mini-intro';
    if (!this.geaendert('dialog', zeigen ? f.id + ':' + this.darf(-2, true) : 0)) return;
    Ansicht.wahlFeld = -1;
    if (!zeigen) { box.classList.add('hidden'); return; }
    const s = f.sp >= 0 ? Z.spieler[f.sp] : null;
    const ich = this.darf(-2, true);
    const opts = f.optionen || [];
    this.wahl = Math.max(0, opts.findIndex(o => !o.aus));
    if (f.typ === 'weg') {
      // Standard: der Weg zum Stern
      let best = 0, bd = Infinity;
      opts.forEach((o, k) => { const d = schritteBis(Spiel.brett, o.w, Z.sternFeld, Z.sternFeld); if (d < bd) { bd = d; best = k; } });
      this.wahl = best; Ansicht.wahlFeld = opts[best].w;
    }
    box.classList.remove('hidden');
    const steuer = s && Z.modus === 'lokal' && !Z.zeiger ? `Steuerung: ${blockText(s.block)}` : 'Pfeiltasten/WASD wählen, Aktion bestätigt, oder klicken';
    if (f.typ === 'wuerfel') {
      box.className = 'klein';
      box.innerHTML = ich ? `<div class="wtitel">Drück ${s && Z.modus === 'lokal' && !Z.zeiger ? aktionTaste(s.block) : '<kbd>Aktion</kbd>'} um den Würfel zu schlagen!</div>` : `<div class="wtitel">${esc(s ? s.name : '')} würfelt …</div>`;
      if (ich) box.innerHTML += `<button class="btn haupt" data-i="0">Würfeln</button>`;
      box.querySelectorAll('[data-i]').forEach(b => b.onclick = ev => { ev.stopPropagation(); this.antworten(true); });
      return;
    }
    box.className = f.typ === 'wunsch' ? 'raster' : '';
    box.innerHTML = `<div class="wtitel">${s ? `<img src="${figurBild(s.figur, 64)}" alt="">` : ''}${esc(f.titel || '')}</div>` +
      `<div class="optionen">${opts.map((o, k) => {
        const bild = f.typ === 'item' && ITEMS[o.w] ? `<img src="${itemBild(o.w).toDataURL()}" alt="">` : f.typ === 'laden' && ITEMS[o.w] ? `<img src="${itemBild(o.w).toDataURL()}" alt="">` : '';
        const preis = o.preis != null ? `<span class="preis"><i></i>${o.preis}</span>` : '';
        return `<button class="opt${k === this.wahl ? ' fokus' : ''}${o.aus ? ' aus' : ''}" data-i="${k}" ${ich ? '' : 'disabled'}>${bild}<span><b>${esc(o.t)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${preis}</button>`;
      }).join('')}</div>` +
      `<div class="hinweis">${ich ? steuer : `${esc(s ? s.name : '')} entscheidet …`}</div>`;
  },
  roulette() {
    const Z = Spiel.Z, r = Z.roulette;
    const box = $('roulette');
    if (this.geaendert('roulette', r ? r.id : 0)) {
      if (!r) { box.classList.add('hidden'); return; }
      this.rouletteStart = performance.now() / 1000;
      box.classList.remove('hidden');
      box.className = 'art-' + r.art;
      const titel = r.art === 'grimm' ? 'Grimms Glücksrad' : 'Welches Minispiel?';
      const fm = { ffa: 'Jeder gegen jeden', '2v2': '2 gegen 2', '1v3': '1 gegen 3', duell: 'Duell' }[r.format] || '';
      box.innerHTML = `<div class="rtitel">${titel}${fm ? `<small>${fm}</small>` : ''}</div><div class="fenster"><div class="band"></div></div>`;
      this.rouletteLast = -1;
    }
    if (!r) return;
    // Band dreht sich und bremst auf dem Ziel ab
    const n = r.liste.length, t = performance.now() / 1000 - this.rouletteStart, dauer = 2.6;
    const p = Math.min(1, t / dauer);
    const umdrehungen = 3;
    const pos = (umdrehungen * n + r.ziel) * Ease.outCubic(p);
    const idx = Math.round(pos);
    if (idx !== this.rouletteLast) {
      this.rouletteLast = idx;
      const band = box.querySelector('.band');
      band.innerHTML = [-1, 0, 1].map(d => `<div class="${d === 0 ? 'mitte' : ''}">${esc(r.liste[((idx + d) % n + n) % n])}</div>`).join('');
      if (p < 1) Ton.spiel('wuerfel'); else Ton.spiel('tusch');
    }
    box.classList.toggle('fertig', p >= 1);
  },
  // Ganze Bildschirme: Team-Aufteilung, Minispiel-Ansage, Ergebnis, Siegerehrung
  vollbild() {
    const Z = Spiel.Z, box = $('vollbild');
    const ph = Z.phase;
    const m = Z.mini;
    let key = ph;
    if (ph === 'teams' && Z.teams) key += JSON.stringify(Z.teams);
    else if (ph === 'mini-intro' && m) key += m.id + JSON.stringify(m.bereit);
    else if (ph === 'mini-ergebnis' && m && m.ergebnis) key += m.id + Z.v;
    else if (ph === 'ende') key += JSON.stringify(Z.ende && Z.ende.rang);
    if (!this.geaendert('vollbild', key)) return;
    const zeigen = ['teams', 'mini-intro', 'mini-ergebnis', 'ende'].includes(ph) && !(ph === 'mini-ergebnis' && !(m && m.ergebnis));
    box.classList.toggle('hidden', !zeigen);
    box.classList.toggle('durchsichtig', ph === 'mini-intro');
    if (!zeigen) return;
    if (ph === 'teams') box.innerHTML = this.htmlTeams();
    else if (ph === 'mini-intro') box.innerHTML = this.htmlIntro();
    else if (ph === 'mini-ergebnis') box.innerHTML = this.htmlErgebnis();
    else if (ph === 'ende') { box.innerHTML = this.htmlEnde(); this.endeKnoepfe(); }
  },
  htmlTeams() {
    const Z = Spiel.Z, t = Z.teams;
    const fm = { ffa: 'Jeder gegen jeden!', '2v2': '2 gegen 2!', '1v3': '1 gegen 3!' }[t.format] || 'Die Teams werden gelost …';
    return `<div class="panel mittel teams"><h2>Minispiel-Zeit!</h2>
      <div class="teamreihe">${Z.spieler.map((s, i) => `<div class="tkarte ${t.farben[i] || 'offen'}"><img src="${figurBild(s.figur, 110)}" alt=""><b>${esc(s.name)}</b><span>${t.farben[i] === 'blau' ? 'Blau' : t.farben[i] === 'rot' ? 'Rot' : '?'}</span></div>`).join('')}</div>
      <div class="format${t.fertig ? ' da' : ''}">${fm}</div>
      <p class="hinweis">Die Farbe des Feldes, auf dem du gelandet bist, bestimmt dein Team. Grüne Felder werden ausgelost.</p></div>`;
  },
  htmlIntro() {
    const Z = Spiel.Z, m = Z.mini, def = Minis.finde(m.id);
    const fm = { ffa: 'Jeder gegen jeden', '2v2': '2 gegen 2', '1v3': '1 gegen 3', duell: 'Duell' }[m.format];
    const online = Z.modus === 'online';
    const zeilen = m.teilnehmer.map((p, k) => {
      const s = Z.spieler[p];
      const team = m.format === '2v2' || m.format === '1v3' ? `<span class="tm" style="background:${TEAM_FARBEN[m.teams[k]]}"></span>` : '';
      const steuer = s.art === 'bot' ? 'Computer' : online ? (s.slot === Netz.you ? 'Du' : 'Online') : Z.zeiger ? 'Du' : blockText(s.block);
      return `<div class="tz${m.bereit[k] ? ' ok' : ''}" data-bereit="${p}">${team}<img src="${figurBild(s.figur, 64)}" alt=""><b>${esc(s.name)}</b><span class="st">${steuer}</span><span class="haken">${m.bereit[k] ? '✔ Bereit' : online || s.art === 'bot' ? 'wartet …' : Z.zeiger ? 'Aktion drücken' : `${aktionTaste(s.block)} drücken`}</span></div>`;
    }).join('');
    const st = def.steuerung || {};
    return `<div class="panel mittel intro"><div class="ikopf"><small>${fm}${def.zeiger ? ' · Touchpad-Spiel' : ''}</small><h2>${esc(def.name)}</h2></div>
      <p class="itext">${esc(def.text)}</p>
      <div class="steuerung">${st.tasten ? `<div><span class="lbl2">Tasten</span>${esc(st.tasten)}</div>` : ''}${st.zeiger ? `<div><span class="lbl2">Touchpad</span>${esc(st.zeiger)}</div>` : ''}</div>
      <div class="tliste">${zeilen}</div>
      <p class="hinweis">${online ? 'Drück <kbd>Aktion</kbd> (Leertaste, Enter, Q …) oder klick auf deine Zeile, wenn du bereit bist.' : 'Jeder drückt seine Aktionstaste, wenn er bereit ist. Im Hintergrund siehst du eine Vorschau.'}</p></div>`;
  },
  htmlErgebnis() {
    const Z = Spiel.Z, m = Z.mini, e = m.ergebnis, def = Minis.finde(m.id);
    const team = m.format === '2v2' || m.format === '1v3';
    let titel;
    if (!e.gewinner.length) titel = 'Unentschieden!';
    else if (team) titel = `Team ${m.teams[m.teilnehmer.indexOf(e.gewinner[0])] === 0 ? 'Blau' : 'Rot'} gewinnt!`;
    else titel = e.gewinner.map(i => esc(Z.spieler[i].name)).join(' & ') + (e.gewinner.length > 1 ? ' gewinnen!' : ' gewinnt!');
    const reihen = m.teilnehmer.map((p, k) => ({ p, k, platz: e.platz[k], punkte: e.punkte[k] })).sort((a, b) => a.platz - b.platz);
    const bonus = m.format !== 'duell';
    return `<div class="panel mittel ergebnis"><small class="mname">${esc(def.name)}</small><h2>${titel}</h2>
      <div class="erliste">${reihen.map(r => {
        const s = Z.spieler[r.p], gew = e.gewinner.includes(r.p);
        return `<div class="er${gew ? ' gew' : ''}" style="--f:${team ? TEAM_FARBEN[m.teams[r.k]] : PLATZ_FARBEN[r.p]}"><span class="pl">${r.platz}.</span><img src="${figurBild(s.figur, 80, gew ? 'froh' : 'traurig')}" alt=""><b>${esc(s.name)}</b><span class="pk">${Math.round(r.punkte * 10) / 10}</span>${gew && bonus ? '<span class="plus"><i></i>+10</span>' : ''}</div>`;
      }).join('')}</div></div>`;
  },
  htmlEnde() {
    const Z = Spiel.Z, rang = Z.ende.rang;
    const sieger = rang.filter(r => r.platz === 1).map(r => Z.spieler[r.i].name);
    const podest = rang.map(r => {
      const s = Z.spieler[r.i];
      return `<div class="pod p${r.platz}" style="--f:${PLATZ_FARBEN[r.i]}"><img src="${figurBild(s.figur, 150, r.platz === 1 ? 'froh' : r.platz === 4 ? 'traurig' : 'normal')}" alt="">
        <div class="sockel"><span class="pn">${r.platz}.</span><b>${esc(s.name)}</b><span>★ ${s.sterne} &nbsp; <i></i> ${s.muenzen}</span></div></div>`;
    }).join('');
    const host = Z.modus === 'lokal' || Spiel.host;
    return `<div class="panel breit ende"><h2>${sieger.map(esc).join(' & ')} ${sieger.length > 1 ? 'sind' : 'ist'} der Sternen-Champion!</h2>
      <div class="podest">${podest}</div>
      <div class="stats">${Z.spieler.map((s, i) => `<div><b style="color:${PLATZ_FARBEN[i]}">${esc(s.name)}</b><span>Minispiel-Münzen ${s.stat.miniMuenzen}</span><span>Höchststand ${s.stat.maxMuenzen}</span><span>?-Felder ${s.stat.ereignisse}</span></div>`).join('')}</div>
      <div class="row">${host ? '<button class="btn haupt" id="endeNochmal">Nochmal</button>' : ''}<button class="btn" id="endeMenue">Menü</button></div></div>`;
  },
  endeKnoepfe() {
    const n = $('endeNochmal'), m = $('endeMenue');
    if (n) { n.onclick = () => App.nochmal(); setTimeout(() => n.focus(), 80); }
    if (m) m.onclick = () => App.zumMenue();
  },
};
