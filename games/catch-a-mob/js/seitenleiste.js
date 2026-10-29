'use strict';
// Catch a Mob – Seitenleiste: Rangliste rechts (Abzeichen, höchste Stufe, gefangene Mobs) und kleine Karte unten rechts.
(function (G) {
  const CAM = G.CAM, S = CAM.S, Welt = CAM.Welt, A = CAM.A, Icons = CAM.Icons, esc = CAM.UI.esc;
  const Seite = CAM.Seite = {};
  const ZEILEN = 8, RADIUS = 48, MINI = 168;

  // Rangliste
  const rang = document.createElement('div'); rang.id = 'rang'; rang.className = 'hbox hidden';
  const mini = document.createElement('div'); mini.id = 'mini'; mini.className = 'hbox hidden';
  mini.innerHTML = '<canvas width="' + MINI + '" height="' + MINI + '"></canvas><div class="leg"><i style="background:#fff"></i>du <i style="background:#5fd38a"></i>online <i style="background:#ffd54a"></i>Party <i style="background:#ff9f1c"></i>Dorf</div>';
  document.body.appendChild(rang); document.body.appendChild(mini);
  const tab = document.createElement('button'); tab.id = 'rangTab'; tab.className = 'hidden'; tab.title = 'Rangliste öffnen (R)'; tab.innerHTML = Icons.html('trophy', 16) + 'Rangliste <kbd style="font-size:10px">R</kbd>';
  document.body.appendChild(tab);
  let zu = false; try { zu = localStorage.getItem('cam-rang-zu') === '1'; } catch (e) { /* ohne Speicher */ }
  Seite.umschalten = () => { zu = !zu; try { localStorage.setItem('cam-rang-zu', zu ? '1' : '0'); } catch (e) { /* ohne Speicher */ } tR = 0; Seite.zeigen(Seite.an, performance.now()); };
  tab.onclick = Seite.umschalten;
  rang.addEventListener('click', e => { if (e.target.closest && e.target.closest('.x')) Seite.umschalten(); });
  const cv = mini.querySelector('canvas'), c = cv.getContext('2d');

  // Wie viele Mobs hat jemand gefangen? Eigene Zahl aus dem Spielstand, Bots grob nach ihrer Stufe (sie fangen nicht wirklich).
  const dexGefangen = () => Object.values(S.save.dex || {}).filter(v => v >= 2).length;
  A.gefangen = () => Math.max(S.save.gef | 0, dexGefangen());
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const botFang = b => Math.min(CAM.FAMILIEN.length * 3, Math.round(b.lv * 1.1 + (hash(b.id) % 7)));
  const botMaske = b => CAM.ARENEN.reduce((m, d, i) => m | (d.lv <= b.lv - 1 ? (1 << i) : 0), 0);
  const zaehle = m => { let n = 0; for (let i = 0; i < 8; i++) if (m & (1 << i)) n++; return n; };

  function eintraege() {
    const l = [{ name: S.name, abz: zaehle(CAM.abzMaske(S.save.abz || [])), lv: CAM.maxLv(), fg: A.gefangen(), ich: true, col: S.save.col }];
    for (const p of S.peers.values()) l.push({ name: p.name, abz: zaehle(p.ab | 0), lv: p.lv | 0, fg: p.fg | 0, col: p.col });
    for (const b of CAM.Bots.liste) l.push({ name: b.name, abz: zaehle(botMaske(b)), lv: b.lv, fg: botFang(b), bot: true, col: b.col });
    l.sort((a, b) => b.abz - a.abz || b.lv - a.lv || b.fg - a.fg || (b.ich ? 1 : 0) - (a.ich ? 1 : 0));
    return l;
  }
  const zeile = (e, i) => '<tr' + (e.ich ? ' class="ich"' : '') + '><td>' + (i + 1) + '</td><td class="nm"><i style="background:' + (CAM.FARBEN[e.col] || '#999') + '"></i>' + esc(e.name) + '' + '</td><td>' + e.abz + '</td><td>' + e.lv + '</td><td>' + e.fg + '</td></tr>';
  function rangZeichnen() {
    const l = eintraege(), ich = l.findIndex(e => e.ich), top = l.slice(0, ZEILEN);
    let h = '<b class="ti">Rangliste</b><button class="x" title="Schliessen (R)">✕</button><table><tr><th>#</th><th>Name</th><th>' + Icons.html('badge', 14) + '</th><th>Lv</th><th>' + Icons.html('ball', 14, 'r') + '</th></tr>' + top.map(zeile).join('');
    if (ich >= ZEILEN) h += '<tr><td colspan="5" class="pt">…</td></tr>' + zeile(l[ich], ich);
    rang.innerHTML = h + '</table><div class="leg">Abzeichen · höchste Stufe · gefangen</div>';
  }

  // Karte
  const miniBild = document.createElement('canvas'); miniBild.width = miniBild.height = RADIUS * 2;
  function miniZeichnen() {
    if (!Welt.bereit) return;
    const sc = MINI / (RADIUS * 2), x0 = Math.floor(S.x) - RADIUS, y0 = Math.floor(S.y) - RADIUS;
    const mc = miniBild.getContext('2d'), img = mc.createImageData(RADIUS * 2, RADIUS * 2), dd = img.data;
    for (let j = 0; j < RADIUS * 2; j++) for (let i = 0; i < RADIUS * 2; i++) {
      const col = Welt.farbe(Welt.get(x0 + i, y0 + j), Welt.biomeAt(x0 + i, y0 + j)), k = (j * RADIUS * 2 + i) * 4;
      dd[k] = col[0]; dd[k + 1] = col[1]; dd[k + 2] = col[2]; dd[k + 3] = 255;
    }
    mc.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(miniBild, 0, 0, MINI, MINI);
    const px = x => (x - x0) * sc, py = y => (y - y0) * sc, drin = (x, y) => x >= x0 && y >= y0 && x < x0 + RADIUS * 2 && y < y0 + RADIUS * 2;
    for (const d of Welt.alleDoerfer()) if (drin(d.x, d.y)) { c.fillStyle = '#ff9f1c'; c.fillRect(px(d.x) - 3, py(d.y) - 3, 6, 6); c.strokeStyle = '#000'; c.strokeRect(px(d.x) - 3, py(d.y) - 3, 6, 6); }
    for (const p of S.peers.values()) if (drin(p.x, p.y)) { c.fillStyle = (S.pt >= 0 && p.pt === S.pt) ? '#ffd54a' : '#5fd38a'; c.fillRect(px(p.x) - 3, py(p.y) - 3, 6, 6); c.strokeStyle = '#000'; c.strokeRect(px(p.x) - 3, py(p.y) - 3, 6, 6); }
    c.fillStyle = '#fff'; c.fillRect(px(S.x) - 3, py(S.y) - 3, 6, 6); c.strokeStyle = '#000'; c.strokeRect(px(S.x) - 3, py(S.y) - 3, 6, 6);
  }

  let tR = 0, tM = 0;
  Seite.zeigen = function (an, now) {
    Seite.an = an; rang.classList.toggle('hidden', !an || zu); tab.classList.toggle('hidden', !an || !zu); mini.classList.toggle('hidden', !an);
    if (!an) return;
    if (!zu && now - tR > 1000) { tR = now; rangZeichnen(); }
    if (now - tM > 100) { tM = now; miniZeichnen(); }
  };
})(window);
