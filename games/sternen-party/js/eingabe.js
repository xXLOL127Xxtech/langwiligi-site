// Sternen-Party – Eingabe
// Lokal teilen sich bis zu 4 Spieler eine Tastatur: jeder hat einen eigenen Tastenblock (Richtungen + Aktion).
// e.code ist die Position der Taste, funktioniert also auch auf Schweizer Tastaturen (QWERTZ).
// Online kommt zusätzlich das Touchpad dazu (Zeiger in Weltkoordinaten der Minispiele).
'use strict';

const BLOECKE = [
  { name: 'WASD', hoch: ['KeyW'], runter: ['KeyS'], links: ['KeyA'], rechts: ['KeyD'], aktion: ['KeyQ', 'KeyE'],
    tasten: ['W', 'A', 'S', 'D'], aktionText: 'Q' },
  { name: 'TFGH', hoch: ['KeyT'], runter: ['KeyG'], links: ['KeyF'], rechts: ['KeyH'], aktion: ['KeyR'],
    tasten: ['T', 'F', 'G', 'H'], aktionText: 'R' },
  { name: 'IJKL', hoch: ['KeyI'], runter: ['KeyK'], links: ['KeyJ'], rechts: ['KeyL'], aktion: ['KeyU', 'KeyO'],
    tasten: ['I', 'J', 'K', 'L'], aktionText: 'U' },
  { name: 'Pfeile', hoch: ['ArrowUp', 'Numpad8'], runter: ['ArrowDown', 'Numpad5', 'Numpad2'], links: ['ArrowLeft', 'Numpad4'],
    rechts: ['ArrowRight', 'Numpad6'], aktion: ['Enter', 'NumpadEnter', 'Numpad0', 'ControlRight', 'Slash', 'Period'],
    tasten: ['↑', '←', '↓', '→'], aktionText: 'Enter' },
];
// Welcher Block gehört zu einer Taste? (für Menüs und das Beitreten)
const TASTE_ZU_BLOCK = {};
BLOECKE.forEach((b, i) => ['hoch', 'runter', 'links', 'rechts', 'aktion'].forEach(r => b[r].forEach(k => { TASTE_ZU_BLOCK[k] = { block: i, rolle: r }; })));

const Eingabe = {
  unten: new Set(),
  // Zähler pro Block und Rolle: wie oft wurde die Taste gedrückt? So geht über das Netz kein Druck verloren.
  zaehler: BLOECKE.map(() => ({ hoch: 0, runter: 0, links: 0, rechts: 0, aktion: 0 })),
  hoerer: [],           // Funktionen (block, rolle, code) für Menüs und Dialoge
  zeiger: { x: WELT_B / 2, y: WELT_H / 2, unten: false, klicks: 0, aufBild: false },
  sperre: false,        // true, solange ein Textfeld den Fokus hat
  init() {
    addEventListener('keydown', e => {
      Ton.init();
      const tippt = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (tippt) return;
      const z = TASTE_ZU_BLOCK[e.code];
      if (z || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.unten.add(e.code);
      if (z) {
        this.zaehler[z.block][z.rolle]++;
        for (const h of this.hoerer.slice()) h(z.block, z.rolle, e.code);
      } else if (e.code === 'Space') {
        this.leertaste++;
        for (const h of this.hoerer.slice()) h(-1, 'aktion', e.code);
      } else if (e.code === 'Escape') {
        for (const h of this.hoerer.slice()) h(-1, 'zurueck', e.code);
      }
    });
    addEventListener('keyup', e => this.unten.delete(e.code));
    addEventListener('blur', () => this.unten.clear());
    addEventListener('pointerdown', () => Ton.init());
  },
  hoere(f) { this.hoerer.push(f); return () => { this.hoerer = this.hoerer.filter(h => h !== f); }; },
  gedrueckt(liste) { for (const k of liste) if (this.unten.has(k)) return true; return false; },
  // Zustand eines Blocks als Minispiel-Eingabe
  block(i) {
    const b = BLOECKE[i], z = this.zaehler[i];
    const x = (this.gedrueckt(b.rechts) ? 1 : 0) - (this.gedrueckt(b.links) ? 1 : 0);
    const y = (this.gedrueckt(b.runter) ? 1 : 0) - (this.gedrueckt(b.hoch) ? 1 : 0);
    return { x, y, a: this.gedrueckt(b.aktion), an: z.aktion, hn: z.hoch, rn: z.runter, ln: z.links, ren: z.rechts };
  },
  // Online: alle Blöcke gehören demselben Spieler (zusammengefasst), dazu der Zeiger
  alleBloecke() {
    let x = 0, y = 0, a = false, an = 0, hn = 0, rn = 0, ln = 0, ren = 0;
    for (let i = 0; i < BLOECKE.length; i++) {
      const e = this.block(i);
      x += e.x; y += e.y; a = a || e.a; an += e.an; hn += e.hn; rn += e.rn; ln += e.ln; ren += e.ren;
    }
    if (this.unten.has('Space')) a = true;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), a, an: an + this.leertaste, hn, rn, ln, ren };
  },
  leertaste: 0,
  mitZeiger(e) {
    const z = this.zeiger;
    e.mx = Math.round(z.x); e.my = Math.round(z.y); e.md = z.unten; e.cn = z.klicks;
    return e;
  },
};

// Leere Eingabe (z.B. für abwesende Spieler)
function leereEingabe() { return { x: 0, y: 0, a: false, an: 0, hn: 0, rn: 0, ln: 0, ren: 0, mx: WELT_B / 2, my: WELT_H / 2, md: false, cn: 0 }; }
