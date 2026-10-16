// Golf-Tour – Anzeige (HUD) pro Bildschirmhälfte: Bahn-Info, Wind, Karte, Schläger, Kraftanzeige, Drall, Meldungen, Namensschilder
'use strict';

const SCORE_NAMEN = { '-4': 'Kondor!', '-3': 'Albatros!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Doppel-Bogey', '3': 'Triple-Bogey' };
function scoreName(schlaege, par) {
  if (schlaege === 1) return 'Hole-in-One!';
  const d = schlaege - par;
  return SCORE_NAMEN[d] || (d > 0 ? '+' + d : d);
}
function plusMinus(v) { return v === 0 ? 'E' : v > 0 ? '+' + v : String(v); }

class Anzeige {
  constructor(root, klein, tastenText) {
    this.root = root; this.klein = klein;
    root.classList.add('hud');
    if (klein) root.classList.add('klein');
    root.innerHTML = `
      <div class="hOben">
        <div class="bahnInfo"></div>
        <div class="spInfo"></div>
      </div>
      <div class="hWind"><div class="wPfeil"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2 L19 14 L14 12 L14 22 L10 22 L10 12 L5 14 Z" fill="currentColor"/></svg></div><span class="wText"></span></div>
      <canvas class="hKarte"></canvas>
      <div class="hUnten">
        <div class="hSchl">
          <div class="sReihe"><button class="sKnopf sVor" title="Längerer Schläger">◀</button><div class="sName"><b></b><small></small></div><button class="sKnopf sNach" title="Kürzerer Schläger">▶</button></div>
          <div class="lage"></div>
        </div>
        <div class="hKraft">
          <div class="kBar"><div class="kFill"></div><div class="kMarke"><span>Fahne</span></div><div class="kLetzte"></div><div class="kTicks"><i></i><i></i><i></i></div></div>
          <div class="kText"></div>
          <button class="kKnopf">Gedrückt halten zum Schlagen</button>
        </div>
        <div class="hDrall"><div class="dBall"><div class="dKreuz"></div><div class="dPunkt"></div></div><small class="dText">Drall</small></div>
      </div>
      <div class="hMeldung"><b></b><span></span></div>
      <div class="hMarken"></div>
      <div class="hHinweis"></div>`;
    const q = s => root.querySelector(s);
    this.el = {
      bahn: q('.bahnInfo'), sp: q('.spInfo'), wind: q('.hWind'), wPfeil: q('.wPfeil'), wText: q('.wText'), karte: q('.hKarte'),
      schl: q('.hSchl'), sName: q('.sName b'), sWeite: q('.sName small'), lage: q('.lage'), vor: q('.sVor'), nach: q('.sNach'),
      kraft: q('.hKraft'), fill: q('.kFill'), marke: q('.kMarke'), letzte: q('.kLetzte'), kText: q('.kText'), kKnopf: q('.kKnopf'),
      drall: q('.hDrall'), dBall: q('.dBall'), dPunkt: q('.dPunkt'), dText: q('.dText'),
      meld: q('.hMeldung'), meldB: q('.hMeldung b'), meldS: q('.hMeldung span'), marken: q('.hMarken'), hinweis: q('.hHinweis'), unten: q('.hUnten'),
    };
    this.tastenText = tastenText;
    // Knöpfe im HUD nehmen keinen Tastaturfokus (sonst lösen Leertaste/Enter sie zusätzlich aus)
    for (const b of root.querySelectorAll('button')) b.tabIndex = -1;
    root.addEventListener('mousedown', ev => ev.preventDefault());
    this.meldT = 0; this.markenPool = new Map(); this.cache = {};
    this.karteBasis = null;
  }
  // Knöpfe mit dem Spiel verbinden (Maus/Touchpad)
  verbinden(h) {
    const e = this.el;
    e.vor.onclick = ev => { ev.stopPropagation(); h.schl(-1); };
    e.nach.onclick = ev => { ev.stopPropagation(); h.schl(1); };
    e.kKnopf.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); e.kKnopf.setPointerCapture(ev.pointerId); h.kraft(true); });
    const los = ev => { ev.stopPropagation(); h.kraft(false); };
    e.kKnopf.addEventListener('pointerup', los);
    e.kKnopf.addEventListener('pointercancel', los);
    const drallSetzen = ev => {
      const r = e.dBall.getBoundingClientRect();
      const x = clamp(((ev.clientX - r.left) / r.width - 0.5) * 2, -1, 1), y = clamp(((ev.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      h.drall(Math.round(x * 4) / 4, Math.round(y * 4) / 4);
    };
    e.dBall.addEventListener('pointerdown', ev => { ev.stopPropagation(); e.dBall.setPointerCapture(ev.pointerId); drallSetzen(ev); e.dBall._zieh = true; });
    e.dBall.addEventListener('pointermove', ev => { if (e.dBall._zieh) drallSetzen(ev); });
    e.dBall.addEventListener('pointerup', () => { e.dBall._zieh = false; });
    for (const el of [e.schl, e.kraft, e.drall]) el.addEventListener('pointerdown', ev => ev.stopPropagation());
  }
  setze(el, key, wert, fn) { if (this.cache[key] !== wert) { this.cache[key] = wert; fn(el, wert); } }
  text(el, key, t) { this.setze(el, key, t, (e, v) => { e.textContent = v; }); }
  html(el, key, t) { this.setze(el, key, t, (e, v) => { e.innerHTML = v; }); }

  // ---------- Karte ----------
  karteBauen(kurs, welt) {
    const cv = this.el.karte, W = this.klein ? 92 : 128, H = this.klein ? 140 : 196;
    cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const G = kurs.gruenM;
    const phi = -Math.PI / 2 - Math.atan2(G.z, G.x);
    const C = { x: (kurs.start.x + G.x) / 2, z: (kurs.start.z + G.z) / 2 };
    const cs = Math.cos(phi), sn = Math.sin(phi);
    const rot = (x, z) => ({ x: (x - C.x) * cs - (z - C.z) * sn, z: (x - C.x) * sn + (z - C.z) * cs });
    // Ausschnitt: Pfad mit Rand
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    const P = kurs.pfad;
    for (let i = 0; i < P.n; i++) { const p = rot(P.x[i], P.z[i]); bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
    bx0 -= 45; bx1 += 45; bz0 -= 25; bz1 += 25;
    const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2;
    const s = Math.min(cv.width / (bx1 - bx0), cv.height / (bz1 - bz0));
    this.karteTrafo = (x, z) => { const p = rot(x, z); return { x: cv.width / 2 + (p.x - mx) * s, y: cv.height / 2 + (p.z - mz) * s }; };
    const b = document.createElement('canvas'); b.width = cv.width; b.height = cv.height;
    const g = b.getContext('2d');
    g.fillStyle = kurs.thema.f.rough; g.fillRect(0, 0, b.width, b.height);
    g.save();
    g.translate(cv.width / 2, cv.height / 2); g.scale(s, s); g.translate(-mx, -mz); g.rotate(phi); g.translate(-C.x, -C.z);
    g.drawImage(welt.texCanvas, kurs.x0, kurs.z0, kurs.tw * kurs.tRes, kurs.th * kurs.tRes);
    // Wasser darüber
    for (const t of kurs.teiche) if (t.art !== 'eis') {
      g.fillStyle = t.art === 'lava' ? 'rgba(255,90,20,0.85)' : 'rgba(40,120,170,0.8)';
      // Wasserflächen aus dem Untergrund nachzeichnen (grob)
      const st = 1.2;
      for (let z = t.z0; z < t.z1; z += st) for (let x = t.x0; x < t.x1; x += st) {
        const ty = kurs.boden(x, z);
        if (ty === U.WASSER || ty === U.LAVA) g.fillRect(x, z, st + 0.1, st + 0.1);
      }
    }
    g.fillStyle = 'rgba(15,40,15,0.55)';
    for (const d of kurs.deko) if (d.art !== 'stein') { g.beginPath(); g.arc(d.x, d.z, 2.4 * d.s, 0, TAU); g.fill(); }
    g.restore();
    this.karteBasis = b;
    this.karteKurs = kurs;
  }
  karteZeichnen(kurs, sp, andere, lande) {
    if (!this.karteBasis) return;
    const cv = this.el.karte, g = cv.getContext('2d'), T = this.karteTrafo;
    g.drawImage(this.karteBasis, 0, 0);
    const L = T(kurs.loch.x, kurs.loch.z);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(L.x, L.y); g.lineTo(L.x, L.y - 14); g.stroke();
    g.fillStyle = '#ff3b2f'; g.beginPath(); g.moveTo(L.x, L.y - 14); g.lineTo(L.x + 9, L.y - 11); g.lineTo(L.x, L.y - 8); g.fill();
    for (const a of andere) {
      if (!a.pos) continue;
      const p = T(a.pos.x, a.pos.z);
      g.fillStyle = a.farbe; g.globalAlpha = 0.75; g.beginPath(); g.arc(p.x, p.y, 4, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
    if (sp && sp.ball) {
      const p = T(sp.ball.p.x, sp.ball.p.z);
      if (lande) {
        const q = T(lande.x, lande.z);
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]);
        g.strokeStyle = sp.farbe; g.beginPath(); g.arc(q.x, q.y, 5, 0, TAU); g.stroke();
      }
      g.fillStyle = '#fff'; g.strokeStyle = sp.farbe; g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, 5, 0, TAU); g.fill(); g.stroke();
    }
  }

  // ---------- Meldungen ----------
  meldung(gross, klein, farbHex, dauer = 2.4) {
    const e = this.el;
    e.meldB.textContent = gross; e.meldS.textContent = klein || '';
    e.meldB.style.color = farbHex || '#ffffff';
    e.meld.classList.remove('an'); void e.meld.offsetWidth; e.meld.classList.add('an');
    this.meldT = dauer;
  }
  hinweis(t) { this.text(this.el.hinweis, 'hinweis', t || ''); this.el.hinweis.style.opacity = t ? 1 : 0; }

  // ---------- Namensschilder über 3D-Positionen ----------
  markenStart() { for (const m of this.markenPool.values()) m.benutzt = false; }
  marke(id, html, pos, cam, w, h, farbHex) {
    let m = this.markenPool.get(id);
    if (!m) {
      m = { el: document.createElement('div'), benutzt: false, html: '' };
      m.el.className = 'marke';
      this.el.marken.appendChild(m.el);
      this.markenPool.set(id, m);
    }
    m.benutzt = true;
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(cam);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { m.el.style.display = 'none'; return; }
    m.el.style.display = '';
    if (m.html !== html) { m.el.innerHTML = html; m.html = html; }
    if (farbHex) m.el.style.borderColor = farbHex;
    m.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
  }
  markenEnde() { for (const m of this.markenPool.values()) if (!m.benutzt) m.el.style.display = 'none'; }

  // ---------- Jedes Bild ----------
  update(dt, ctx) {
    const { sp, kurs, nr, kam, vorschau, andere, warten } = ctx;
    const e = this.el;
    if (this.meldT > 0) { this.meldT -= dt; if (this.meldT <= 0) e.meld.classList.remove('an'); }
    this.html(e.bahn, 'bahn', `<b>Bahn ${nr + 1}/8</b> · Par ${kurs.par} · ${Math.round(kurs.laenge)} m<span>${esc(kurs.thema.name)}</span>`);
    if (sp) {
      const ges = sp.karte.reduce((s, v, i) => s + (v != null ? v - (App.plan[i] ? App.plan[i].par : 0) : 0), 0);
      this.html(e.sp, 'sp', `<i style="background:${sp.farbe}"></i>${esc(sp.name)} · Schlag ${sp.schlaege + (sp.fertig ? 0 : 1)} · <b>${plusMinus(ges)}</b>`);
    }
    // Wind relativ zur Blickrichtung
    const f = new THREE.Vector3(); kam.cam.getWorldDirection(f);
    const fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
    const w = kurs.wind, ws = Math.hypot(w.x, w.z);
    const wa = Math.atan2(w.x * -fz + w.z * fx, w.x * fx + w.z * fz);
    e.wPfeil.style.transform = `rotate(${wa.toFixed(3)}rad)`;
    e.wPfeil.style.opacity = ws < 0.3 ? 0.3 : 1;
    this.text(e.wText, 'wind', ws < 0.3 ? 'Windstill' : ws.toFixed(1) + ' m/s');
    // Schläger und Lage
    const zielt = sp && (sp.zustand === 'zielen' || sp.zustand === 'laden') && !warten;
    this.root.classList.toggle('zielt', !!zielt);
    if (sp && sp.ball && !sp.fertig) {
      const sc = SCHLAEGER[sp.schl];
      this.text(e.sName, 'sName', sc.name);
      this.text(e.sWeite, 'sWeite', sc.putter ? 'bis ' + Math.round(sp.puttMax()) + ' m' : '≈ ' + Math.round(SCHL_WEITE[sp.schl]) + ' m');
      e.vor.disabled = sp.schl === 0 || !zielt; e.nach.disabled = sp.schl === SCHLAEGER.length - 1 || !zielt;
      const typ = sp.lage(), d = sp.lochDist();
      const hang = sp.hangInfo(), grad = Math.round(Math.atan(hang.auf) * 57.3);
      const dh = kurs.loch.y - (sp.ball.p.y - PH.R);
      const dtext = d < 10 ? d.toFixed(1) : Math.round(d);
      let lt = `${kurs.param(typ).name} · <b>${dtext} m</b> zur Fahne`;
      if (Math.abs(dh) >= 1) lt += ` · ${dh > 0 ? '▲' : '▼'} ${Math.abs(Math.round(dh))} m`;
      if (Math.abs(grad) >= 2 && zielt) lt += ` · ${grad > 0 ? 'bergauf' : 'bergab'} ${Math.abs(grad)}°`;
      this.html(e.lage, 'lage', lt);
      // Kraft
      const k = sp.zustand === 'laden' ? sp.kraft : 0;
      e.fill.style.width = (k * 100).toFixed(1) + '%';
      e.fill.classList.toggle('voll', k > 0.97);
      let marke = null;
      if (sc.putter) marke = sp.puttZiel();
      else if (SCHL_WEITE[sp.schl] > d) marke = clamp(d / SCHL_WEITE[sp.schl], 0, 1);
      e.marke.style.display = marke != null && zielt ? '' : 'none';
      if (marke != null) e.marke.style.left = (marke * 100).toFixed(1) + '%';
      e.letzte.style.display = sp.letzteKraft != null && zielt ? '' : 'none';
      if (sp.letzteKraft != null) e.letzte.style.left = (sp.letzteKraft * 100).toFixed(1) + '%';
      let kt;
      if (sp.zustand === 'laden') {
        if (sc.putter) kt = `<b>${Math.round(k * 100)} %</b> · rollt ≈ ${(k * sp.puttMax()).toFixed(1)} m`;
        else {
          const L = vorschau && vorschau.erg ? vorschau.erg.lande : null;
          const carry = L ? Math.hypot(L.x - sp.ball.p.x, L.z - sp.ball.p.z) : 0;
          kt = `<b>${Math.round(k * 100)} %</b> · fliegt ≈ ${Math.round(carry)} m`;
        }
      } else if (zielt) kt = this.tastenText;
      else if (sp.zustand === 'unterwegs') kt = `<span class="leise">${this.klein ? '' : 'Ball unterwegs … '}${sp.blocks.length > 1 ? 'Leertaste halten = schneller' : ''}</span>`;
      else kt = '';
      this.html(e.kText, 'kt', kt);
      // Drall
      e.drall.classList.toggle('aus', !!sc.putter);
      e.dPunkt.style.left = (50 + sp.drall.x * 38) + '%';
      e.dPunkt.style.top = (50 + sp.drall.y * 38) + '%';
      const dx = sp.drall.x, dy = sp.drall.y;
      let dt2 = [];
      if (dy > 0) dt2.push('Rückwärts'); else if (dy < 0) dt2.push('Vorwärts');
      if (dx < 0) dt2.push('Kurve links'); else if (dx > 0) dt2.push('Kurve rechts');
      this.text(e.dText, 'dt', sc.putter ? 'Kein Drall' : dt2.length ? dt2.join(' · ') : 'Kein Drall');
    }
    this.root.classList.toggle('fertig', !sp || !!sp.fertig || !!warten);
  }
}

// Scorekarte als Tabelle
function scoreTabelle(plan, spieler, bisLoch) {
  let h = '<table class="karte"><thead><tr><th>Bahn</th>';
  for (let i = 0; i < 8; i++) h += `<th class="${i === bisLoch ? 'jetzt' : ''}">${i + 1}</th>`;
  h += '<th>Total</th><th>±</th></tr><tr class="par"><td>Par</td>';
  let ps = 0;
  for (let i = 0; i < 8; i++) { h += `<td>${plan[i].par}</td>`; ps += plan[i].par; }
  h += `<td>${ps}</td><td></td></tr></thead><tbody>`;
  for (const s of spieler) {
    h += `<tr><td class="name"><i style="background:${s.farbe}"></i>${esc(s.name)}${s.weg ? ' <small>(weg)</small>' : ''}</td>`;
    let tot = 0, parBis = 0;
    for (let i = 0; i < 8; i++) {
      const v = s.karte[i];
      if (v != null) {
        tot += v; parBis += plan[i].par;
        const d = v - plan[i].par;
        h += `<td class="${v === 1 ? 'ass' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? '' : d === 1 ? 'bogey' : 'dbogey'}">${v}</td>`;
      } else h += '<td class="leer">–</td>';
    }
    h += `<td><b>${tot}</b></td><td><b>${plusMinus(tot - parBis)}</b></td></tr>`;
  }
  return h + '</tbody></table>';
}
