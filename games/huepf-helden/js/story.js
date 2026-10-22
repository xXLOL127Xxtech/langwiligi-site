'use strict';
// =====================================================================
//  Geschichte: Zwischensequenzen mit Schreibmaschinen-Text
// =====================================================================
const Story = {
  scenes: [], i: 0, t: 0, chars: 0, done: null,
  play(scenes, done) {
    this.scenes = scenes; this.i = 0; this.t = 0; this.chars = 0; this.done = done;
    G.mode = 'story';
    Music.play(composeSong(991 + scenes.length, { scale: 'moll', root: 57, bpm: 84, lead: 'sine', comp: 'pad', legato: 1.6, drums: false }));
  },
  next() {
    const sc = this.scenes[this.i];
    if (!sc) return;
    if (this.chars < sc.text.length) { this.chars = sc.text.length; return; }
    this.i++; this.t = 0; this.chars = 0; SFX.select();
    if (this.i >= this.scenes.length) this.finish();
  },
  finish() { Music.stop(); const d = this.done; this.done = null; if (d) d(); },
  update(dt) {
    this.t += dt;
    const sc = this.scenes[this.i]; if (!sc) return;
    this.chars = Math.min(sc.text.length, this.chars + dt * 38);
    const inp = readInput([...KB_SCHEMES, 'solo', 'pad0', 'pad1', 'pad2', 'pad3']);
    if (inp.jP || inp.aP || anyPressed(['Space', 'Enter'])) this.next();
    if (anyPressed(['Escape']) || pads.some(p => p.sP)) { this.i = this.scenes.length; this.finish(); }
  },
  render() {
    const g = ctx, sc = this.scenes[this.i];
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!sc) return;
    const W = SW, H = SH;
    g.save();
    sc.draw(g, this.t, W, H * .78);
    g.restore();
    // Kinobalken und Textfeld
    g.fillStyle = '#05030a'; g.fillRect(0, H * .78, W, H * .22);
    const a = Math.min(1, this.t * 2);
    g.fillStyle = `rgba(0,0,0,${1 - a})`; g.fillRect(0, 0, W, H);
    g.font = `${Math.round(clamp(H / 34, 16, 26))}px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center';
    const text = sc.text.slice(0, Math.floor(this.chars));
    wrapText(g, text, W / 2, H * .78 + 38, Math.min(W - 120, 900), clamp(H / 26, 22, 34));
    g.font = '12px system-ui'; g.fillStyle = 'rgba(255,255,255,.5)';
    g.fillText('Springen / Leertaste / Klick: weiter · Esc: überspringen', W / 2, H - 16);
    for (let k = 0; k < this.scenes.length; k++) { g.fillStyle = k === this.i ? '#ffd23a' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(W / 2 - (this.scenes.length - 1) * 9 + k * 18, H - 38, 4, 0, TAU); g.fill(); }
  },
};
modeHandlers.story = { update: dt => Story.update(dt), render: dt => Story.render(dt) };
function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

// ---------------------------------------------------------------------
//  Bühnenbilder
// ---------------------------------------------------------------------
function skyGrad(g, W, H, c0, c1) { const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, c0); s.addColorStop(1, c1); g.fillStyle = s; g.fillRect(0, 0, W, H); }
function drawSonnenschloss(g, x, y, s, dark) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const wall = dark ? '#3a3448' : '#f4ead8', roof = dark ? '#4a2a5a' : '#e06a4a';
  for (const [tx, h] of [[-120, 160], [-40, 220], [40, 190], [110, 150]]) {
    rr(g, tx - 30, -h, 60, h, 4); fs(g, wall, 3);
    g.beginPath(); g.moveTo(tx - 38, -h); g.lineTo(tx, -h - 70); g.lineTo(tx + 38, -h); g.closePath(); fs(g, roof, 3);
    g.fillStyle = dark ? 'rgba(255,80,80,.5)' : 'rgba(255,220,120,.9)'; rr(g, tx - 8, -h + 30, 16, 24, [8, 8, 0, 0]); g.fill();
  }
  rr(g, -150, -90, 300, 90, 4); fs(g, wall, 3);
  rr(g, -22, -60, 44, 60, [22, 22, 0, 0]); fs(g, '#6a4a2a', 3);
  g.restore();
}
function drawHill(g, W, H, col, y0) { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); g.lineTo(0, y0); g.quadraticCurveTo(W * .3, y0 - 60, W * .55, y0 - 10); g.quadraticCurveTo(W * .8, y0 + 30, W, y0 - 20); g.lineTo(W, H); g.fill(); }
function heroLine(g, x, y, s, t, state = 'stand', power = 1) {
  CHARS.forEach((ch, i) => drawHero(g, ch, { x: x + (i - 1.5) * 90 * s, y: y - Math.max(0, Math.sin(t * 3 + i)) * (state === 'goal' ? 20 : 0), s, face: 1, t: t + i, state, power }));
}
const STORY = {
  intro: () => [
    { text: 'Im Sonnenreich feiern alle das Lichterfest. Prinzessin Lunara lässt den Sonnenkristall erstrahlen, damit das Land nie dunkel wird.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#ff9a6a', '#ffe0a8');
        g.fillStyle = 'rgba(255,240,180,.8)'; g.beginPath(); g.arc(W * .8, H * .25, 60, 0, TAU); g.fill();
        drawHill(g, W, H, '#5ab84a', H * .78);
        drawSonnenschloss(g, W * .5, H * .78, Math.min(1.2, H / 500), false);
        const kx = W * .5, ky = H * .78 - Math.min(1.2, H / 500) * 330;
        const gl = g.createRadialGradient(kx, ky, 4, kx, ky, 120); gl.addColorStop(0, 'rgba(255,250,200,.95)'); gl.addColorStop(1, 'rgba(255,220,100,0)'); g.fillStyle = gl; g.beginPath(); g.arc(kx, ky, 120, 0, TAU); g.fill();
        drawPrincess(g, W * .2, H * .97, Math.min(2.2, H / 260), t, 'froh');
        for (let i = 0; i < 12; i++) { const x = (i * 137 + t * 30) % W, y = H * .2 + Math.sin(t * 2 + i) * 30 + (i % 3) * 40; g.fillStyle = ['#ffd23a', '#ff7aa8', '#7fd8ff'][i % 3]; starPath(g, x, y, 6, 2.6); g.fill(); }
      } },
    { text: 'Doch plötzlich zieht ein eisiger Schatten über das Land. Die Lichter erlöschen, eins nach dem anderen …',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#1a1030', '#5a3a5a');
        for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(30,10,50,.75)'; g.beginPath(); g.ellipse((i * 220 + t * 60) % (W + 300) - 150, H * .2 + (i % 3) * 50, 180, 60, 0, 0, TAU); g.fill(); }
        drawHill(g, W, H, '#2a3a2a', H * .78);
        drawSonnenschloss(g, W * .5, H * .78, Math.min(1.2, H / 500), true);
        if (Math.sin(t * 3) > .95) { g.fillStyle = 'rgba(220,220,255,.6)'; g.fillRect(0, 0, W, H); }
      } },
    { text: 'Morvax, der Schattenkönig, entführt Lunara und raubt den Sonnenkristall. „Ohne Licht gehört das Reich mir!“',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#06030c', '#3a1236');
        g.fillStyle = '#ff6a8a'; g.beginPath(); g.arc(W * .75, H * .22, 50, 0, TAU); g.fill();
        drawMorvax(g, W * .42, H * 1.02 + Math.sin(t * 2) * 6, Math.min(2.2, H / 300), t, { angry: true, cast: true });
        const ox = W * .68, oy = H * .45 + Math.sin(t * 1.5) * 12;
        drawPrincess(g, ox, oy + 40, Math.min(1.1, H / 600), t, 'hilfe');
        const gl = g.createRadialGradient(ox, oy, 20, ox, oy, 90); gl.addColorStop(0, 'rgba(120,40,200,.15)'); gl.addColorStop(1, 'rgba(200,120,255,.7)');
        g.fillStyle = gl; g.beginPath(); g.arc(ox, oy, 90, 0, TAU); g.fill();
      } },
    { text: 'Flitz, Rumpel, Hops und Schwebi zögern keine Sekunde. Acht Welten trennen sie von der Schattenburg. Das Abenteuer beginnt!',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#2a3a6a', '#ff9a6a');
        drawHill(g, W, H, '#3a7a3a', H * .8);
        heroLine(g, W / 2, H * .82, Math.min(2.2, H / 240), t);
      } },
  ],
  castle: (n) => [
    { text: `${(BOSS_LOOK[n] || BOSS_LOOK[1]).name} ist besiegt! Doch Lunara ist nicht hier … Ein Schattenwicht flieht mit einer Botschaft in Richtung ${WORLD_SPECS[n].name}.`,
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#2a1a2a', '#6a3a3a');
        drawHill(g, W, H, '#3a2a2a', H * .8);
        heroLine(g, W * .38, H * .82, Math.min(1.8, H / 300), t, 'goal');
        const wx = W * .75 + t * 80;
        drawEnemy(g, { kind: 'wicht', x: wx, y: H * .82 - Math.abs(Math.sin(t * 10)) * 12, dir: 1, walk: t * 10 }, t);
        g.save(); g.translate(wx + 30, H * .82 - 70); g.rotate(Math.sin(t * 4) * .2); rr(g, -14, -10, 28, 20, 3); fs(g, '#f4e6c8', 2); g.restore();
      } },
    { text: n === 4 ? 'Aus der Ferne hallt Lunaras Stimme: „Haltet durch! Morvax wird mit jeder Welt stärker – aber ihr auch!“' : 'Die Helden schöpfen neuen Mut. Weiter geht es – die nächste Welt wartet!',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#1a1a3a', '#4a3a6a');
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(hash2(i, 3) * W, hash2(i, 4) * H * .6, 2, 2); }
        drawHill(g, W, H, '#2a2a4a', H * .8);
        heroLine(g, W / 2, H * .82, Math.min(1.8, H / 300), t);
        if (n === 4) { g.globalAlpha = .5 + Math.sin(t * 2) * .2; drawPrincess(g, W * .5, H * .4, Math.min(1.3, H / 500), t, 'hilfe'); g.globalAlpha = 1; }
      } },
  ],
  ending: (w9) => [
    { text: 'Mit Morvax’ Niederlage zerfallen die Schatten zu Staub. Der Sonnenkristall leuchtet wieder – das Licht kehrt zurück!',
      draw(g, t, W, H) {
        const k = Math.min(1, t / 4);
        skyGrad(g, W, H, k > .5 ? '#5ab4ff' : '#2a1a4a', k > .5 ? '#ffe0a8' : '#6a3a6a');
        const gl = g.createRadialGradient(W / 2, H * .4, 10, W / 2, H * .4, 80 + k * W); gl.addColorStop(0, 'rgba(255,250,210,.95)'); gl.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = gl; g.fillRect(0, 0, W, H);
        drawHill(g, W, H, '#5ab84a', H * .8);
      } },
    { text: '„Danke, ihr vier! Ohne euren Mut wäre das Sonnenreich für immer im Dunkeln versunken.“',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#5ab4ff', '#ffe0a8');
        drawHill(g, W, H, '#5ab84a', H * .8);
        drawSonnenschloss(g, W * .78, H * .8, Math.min(.8, H / 700), false);
        drawPrincess(g, W * .62, H * .82, Math.min(2, H / 280), t, 'froh', -1);
        heroLine(g, W * .3, H * .82, Math.min(1.6, H / 320), t, 'goal');
      } },
    { text: w9 ? 'Das Sonnenreich feiert seine Helden. ENDE. … Und da ihr jede Sternmünze gefunden habt, öffnet sich ein geheimes Tor zur Sternenwelt!' : 'Das Sonnenreich feiert seine Helden. ENDE. … Man munkelt: Wer in allen acht Welten jede Sternmünze findet, öffnet die geheime Sternenwelt.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#0a0a2a', '#3a2a6a');
        for (let i = 0; i < 6; i++) {
          const ft = (t * .8 + i * .37) % 2, fx = W * (.15 + (i * .17) % .7), fy = H * (.2 + (i % 3) * .1);
          if (ft < 1) for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; g.fillStyle = ['#ffd23a', '#ff7aa8', '#7fd8ff', '#7ef08a'][(i + k) % 4]; g.globalAlpha = 1 - ft; g.beginPath(); g.arc(fx + Math.cos(a) * ft * 90, fy + Math.sin(a) * ft * 90, 4, 0, TAU); g.fill(); }
          g.globalAlpha = 1;
        }
        drawHill(g, W, H, '#1a3a2a', H * .82);
        heroLine(g, W * .42, H * .84, Math.min(1.6, H / 320), t, 'goal');
        drawPrincess(g, W * .78, H * .86, Math.min(1.8, H / 300), t, 'froh', -1);
      } },
    { text: 'Doch am Nachthimmel zieht ein Komet seine Bahn. Sein Schweif weckt vier neue Länder: Dschungeltal, Glutkrater, Zuckerland und das Himmelsreich. Das Abenteuer geht weiter!',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#05061a', '#2a2a6a');
        for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(hash2(i, 5) * W, hash2(i, 6) * H * .7, 2, 2); }
        const k = (t * .25) % 1, cx = W * (1.1 - k * 1.3), cy = H * (.1 + k * .35);
        const tail = g.createLinearGradient(cx, cy, cx + 260, cy - 110); tail.addColorStop(0, 'rgba(255,240,170,.9)'); tail.addColorStop(1, 'rgba(255,200,100,0)');
        g.strokeStyle = tail; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 260, cy - 110); g.stroke();
        g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fill();
        drawHill(g, W, H, '#14243a', H * .84);
        heroLine(g, W * .5, H * .86, Math.min(1.6, H / 320), t);
      } },
  ],
  castleNeu: (n) => [
    { text: `${(BOSS_LOOK[n] || BOSS_LOOK[1]).name} ist besiegt! Ein Splitter des Kometen leuchtet auf und zeigt den Weg nach ${WORLD_SPECS[nextWorldOf(n) - 1].name}.`,
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#10163a', '#4a3a7a');
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(hash2(i, 3) * W, hash2(i, 4) * H * .6, 2, 2); }
        drawHill(g, W, H, '#1e2a44', H * .82);
        const px = W * .5, py = H * .3 + Math.sin(t * 2) * 8;
        const gl = g.createRadialGradient(px, py, 4, px, py, 90); gl.addColorStop(0, 'rgba(255,245,180,.95)'); gl.addColorStop(1, 'rgba(255,220,100,0)'); g.fillStyle = gl; g.beginPath(); g.arc(px, py, 90, 0, TAU); g.fill();
        starPath(g, px, py, 24, 10); g.fillStyle = '#ffe066'; g.fill();
        heroLine(g, W * .5, H * .84, Math.min(1.7, H / 310), t, 'goal');
      } },
  ],
  ende9: () => [
    { text: 'Der Sternenkönig zerfällt zu glitzerndem Staub. Aus ihm steigen tausend kleine Sterne auf und malen neue Bilder an den Himmel.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#02020e', '#2a1a5e');
        for (let i = 0; i < 70; i++) { const tw = .5 + .5 * Math.sin(t * 3 + i); g.fillStyle = `rgba(255,240,170,${.3 + tw * .6})`; starPath(g, hash2(i, 1) * W, (hash2(i, 2) * H * .75 - t * 14 * (.4 + hash2(i, 3)) + H) % (H * .8), 3 + hash2(i, 4) * 5, 1.4); g.fill(); }
        drawHill(g, W, H, '#14143a', H * .84);
        heroLine(g, W * .5, H * .86, Math.min(1.7, H / 310), t, 'goal');
      } },
    { text: 'Die Sternenwelt ist gerettet. Ihr seid jetzt echte Sternenhelden! Wer noch nicht alle Geheimwege gefunden hat, sucht weiter – und die neuen Welten warten auch.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#0a0a2a', '#4a3a8a');
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(hash2(i, 3) * W, hash2(i, 4) * H * .6, 2, 2); }
        drawHill(g, W, H, '#1a1a4a', H * .84);
        heroLine(g, W * .5, H * .86, Math.min(1.7, H / 310), t);
      } },
  ],
  ende13: () => [
    { text: 'Der Himmels-Koloss löst sich in Wolken auf. Über allen Reichen geht die Sonne auf, und auch der letzte Winkel erstrahlt in goldenem Licht.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#3a8cf0', '#fff6d8');
        const gl = g.createRadialGradient(W / 2, H * .35, 10, W / 2, H * .35, W * .6); gl.addColorStop(0, 'rgba(255,250,210,.95)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 6; i++) { g.drawImage(getCloudSprite(), (i * 280 + t * 20) % (W + 300) - 150, H * (.15 + (i % 3) * .18), 200, 94); }
        drawHill(g, W, H, '#ffffff', H * .86);
        heroLine(g, W * .5, H * .88, Math.min(1.7, H / 310), t, 'goal');
      } },
    { text: 'Dschungel, Vulkan, Zuckerland, Himmel – alles ist wieder friedlich. Prinzessin Lunara lädt zum grössten Fest, das das Sonnenreich je gesehen hat!',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#ffb36b', '#ffe0a8');
        drawHill(g, W, H, '#5ab84a', H * .82);
        drawSonnenschloss(g, W * .75, H * .82, Math.min(.8, H / 700), false);
        drawPrincess(g, W * .58, H * .86, Math.min(2, H / 280), t, 'froh', -1);
        heroLine(g, W * .28, H * .86, Math.min(1.6, H / 320), t, 'goal');
        for (let i = 0; i < 14; i++) { const x = (i * 131 + t * 24) % W, y = H * .15 + Math.sin(t * 2 + i) * 26 + (i % 3) * 36; g.fillStyle = ['#ffd23a', '#ff7aa8', '#7fd8ff', '#7ef08a'][i % 4]; starPath(g, x, y, 6, 2.6); g.fill(); }
      } },
    { text: 'ENDE – danke fürs Spielen! Sammelt weiter alle Sternmünzen, findet jeden Geheimweg und holt euch Gold in jedem Level.',
      draw(g, t, W, H) {
        skyGrad(g, W, H, '#0a0a2a', '#3a2a6a');
        for (let i = 0; i < 6; i++) {
          const ft = (t * .8 + i * .37) % 2, fx = W * (.15 + (i * .17) % .7), fy = H * (.2 + (i % 3) * .1);
          if (ft < 1) for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; g.fillStyle = ['#ffd23a', '#ff7aa8', '#7fd8ff', '#7ef08a'][(i + k) % 4]; g.globalAlpha = 1 - ft; g.beginPath(); g.arc(fx + Math.cos(a) * ft * 90, fy + Math.sin(a) * ft * 90, 4, 0, TAU); g.fill(); }
          g.globalAlpha = 1;
        }
        drawHill(g, W, H, '#1a3a2a', H * .84);
        heroLine(g, W * .5, H * .86, Math.min(1.6, H / 320), t, 'goal');
      } },
  ],
};
