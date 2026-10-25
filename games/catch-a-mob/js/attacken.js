'use strict';
// Catch a Mob – wer welche Attacken lernt und welche Spezialeffekte es gibt.
// Regeln:
//  - Jeder Mob startet mit 1 bis 3 Attacken und lernt später neue (meist bei Stufe 10, 15 und 30). Höchstens 6.
//  - Gewöhnliche Mobs starten mit 3 schwachen Attacken, lernen aber bis Stufe 30 drei weitere und am Ende die beste. Das Hochleveln lohnt sich.
//  - Je seltener ein Mob, desto weniger, aber stärkere Attacken mit besseren Effekten. Manche haben nur 1 Attacke am Start, eine zweite bei Stufe 30, und bleiben dann bei 2.
//  - Nicht jeder Mob hat einen Spezialeffekt. Die zehn Effekte (Gift, Brand, Schlaf, Angst, Betäubung, Lähmung, Blendung, Schwäche, Verwirrung, Zerbrechlichkeit) sind unterschiedlich verteilt.
(function (G) {
  const CAM = G.CAM, F = CAM.FAMILIEN, M = CAM.MOVES;

  // Spezialeffekte der eigenen Attacken: Familie → [Nummer der Attacke (0 = schwächste), Effekt, Chance in %]
  const SIG_FX = {
    0: [[2, 'brand', 25]], 1: [[3, 'schwaeche', 30]], 2: [[1, 'gift', 25]], 4: [[3, 'furcht', 25]], 5: [[2, 'blind', 30]],
    6: [[2, 'furcht', 30], [3, 'betaeubt', 25]], 7: [[2, 'gift', 25]], 10: [[0, 'gift', 25], [3, 'verwirrt', 30]],
    11: [[1, 'laehmung', 20], [3, 'bruch', 30]], 12: [[2, 'brand', 30], [3, 'verwirrt', 35]], 13: [[2, 'brand', 30]],
    14: [[2, 'blind', 30], [3, 'bruch', 35]], 15: [[2, 'furcht', 25], [3, 'schwaeche', 30]],
    16: [[1, 'gift', 30], [2, 'bruch', 35]], 17: [[1, 'verwirrt', 30], [2, 'betaeubt', 30]], 18: [[1, 'blind', 30], [2, 'furcht', 35]],
    19: [[1, 'bruch', 30], [2, 'laehmung', 35]], 20: [[1, 'blind', 30], [2, 'schlaf', 30]], 21: [[1, 'brand', 30], [2, 'schwaeche', 35]],
    22: [[1, 'furcht', 30], [2, 'schlaf', 30]], 23: [[1, 'blind', 30], [2, 'verwirrt', 35]],
    24: [[2, 'blind', 30], [3, 'schlaf', 25]], 25: [[2, 'furcht', 30], [3, 'schwaeche', 35]], 26: [[2, 'brand', 30], [3, 'bruch', 30]], 27: [[2, 'brand', 30], [3, 'verwirrt', 30]],
    28: [[2, 'schlaf', 25]], 30: [[1, 'blind', 25]], 31: [[1, 'gift', 30]], 33: [[1, 'gift', 30]], 35: [[0, 'gift', 25], [3, 'verwirrt', 30]],
    36: [[1, 'blind', 25], [2, 'gift', 30]], 37: [[1, 'laehmung', 25], [2, 'gift', 35]], 38: [[1, 'verwirrt', 25], [3, 'schlaf', 25]], 39: [[2, 'schlaf', 30]],
    40: [[2, 'betaeubt', 25], [3, 'gift', 35]], 41: [[2, 'laehmung', 30]], 43: [[1, 'brand', 25]], 44: [[1, 'brand', 30], [3, 'brand', 35]],
    46: [[2, 'verwirrt', 30], [3, 'schlaf', 30]], 47: [[1, 'blind', 25], [3, 'schwaeche', 30]],
  };
  // Familien, die mit nur einer starken Attacke starten und die zweite erst bei Stufe 30 lernen (danach für immer nur zwei)
  const EINE = [6, 12, 14];

  F.forEach((f, i) => {
    f.sig.forEach(id => { delete M[id].st; delete M[id].p; });
    (SIG_FX[i] || []).forEach(([k, st, p]) => { const mv = M[f.sig[k]]; if (mv) { mv.st = st; mv.p = p; } });
    f.effekt = !!SIG_FX[i];
  });

  // Lernplan: [[Stufe, Attacke], ...]
  function techs(f) {
    const els = [f.el].concat(f.el2 ? [f.el2] : []);
    const ok = t => f.effekt || !M[t.id].st;   // Mobs ohne Spezialeffekt lernen auch keine Technik mit Effekt
    const haupt = CAM.TECH.filter(t => t.el === f.el && ok(t)).sort((a, b) => a.lv - b.lv).map(t => t.id);
    const zweit = f.el2 ? CAM.TECH.filter(t => t.el === f.el2 && ok(t)).sort((a, b) => a.lv - b.lv).map(t => t.id) : [];
    const normal = CAM.TECH.filter(t => t.el === 'Normal' && ok(t)).sort((a, b) => a.lv - b.lv).map(t => t.id);
    return haupt.concat(zweit, normal).filter((id, k, l) => l.indexOf(id) === k);
  }
  F.forEach((f, i) => {
    const s = f.sig, t = techs(f), tA = t[0], tB = t[1];
    let plan;
    if (f.rar >= 3) plan = [[1, s[1]], [30, s[2]]];
    else if (EINE.includes(i)) plan = [[1, s[2]], [30, s[3]]];
    else if (f.rar === 2) plan = [[1, s[1]], [1, s[2]], [10, tB], [30, s[3]]];
    else if (f.rar === 1) plan = [[1, s[1]], [1, tA], [10, tB], [15, s[2]], [30, s[3]]];
    else plan = [[1, s[0]], [1, s[1]], [1, tA], [10, tB], [15, s[2]], [30, s[3]]];
    f.lern = plan.filter(x => x[1]).filter((x, k, l) => l.findIndex(y => y[1] === x[1]) === k);
  });

  CAM.MOVE_SLOTS = () => 6;
  CAM.gelernt = function (m) {
    const f = F[m.fam];
    const got = f.lern.filter(([lv]) => m.lv >= lv).map(x => x[1]);
    if (m.extra && M[m.extra] && !got.includes(m.extra)) got.push(m.extra);
    return got.slice(0, 6);
  };
  // Alle Attacken sind fix: Was ein Mob gelernt hat, setzt er im Kampf ein (keine Auswahl)
  CAM.attackenFuer = function (fam, lv, m) { return CAM.gelernt(m || { fam, lv, stufe: CAM.stufeFuer(fam, lv) }); };
  // Alle Attacken dieses Mobs für die Anzeige, auch die noch nicht gelernten: [{ id, lv, ok }]
  CAM.alleAttacken = function (m) {
    const l = F[m.fam].lern.map(([lv, id]) => ({ id, lv, ok: m.lv >= lv }));
    if (m.extra && M[m.extra] && !l.some(x => x.id === m.extra)) l.push({ id: m.extra, lv: 0, ok: true });
    return l;
  };
  // Nächste Attacke, die dieser Mob lernt: { lv, id } oder null
  CAM.naechsteAttacke = function (m) {
    const n = F[m.fam].lern.find(([lv]) => m.lv < lv);
    return n ? { lv: n[0], id: n[1] } : null;
  };
  // Attacken, die eine Attackenrune diesem Mob beibringen könnte (Techniken seiner Elemente, noch nicht bekannt)
  CAM.runeAuswahl = function (m) {
    const f = F[m.fam], els = CAM.elemente(m);
    return CAM.TECH.filter(t => (t.el === 'Normal' || els.includes(t.el)) && !f.lern.some(x => x[1] === t.id) && !M[t.id].einmal).map(t => t.id);
  };
  // Eine Rune geht nur, wenn der Mob nach dem Lernen aller Attacken noch unter 6 liegt und noch keine Rune bekam
  CAM.runeMoeglich = m => !m.extra && F[m.fam].lern.length < 6;
})(window);
