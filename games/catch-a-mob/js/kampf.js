'use strict';
// Catch a Mob – Kampfregeln (ohne Oberfläche).
// Der Kampf ist deterministisch: gleiche Startwerte + gleicher Seed + gleiche Aktionen = gleicher Verlauf.
// Darum können sich Duelle und Riesen-Raids online ohne Server-Rechner abgleichen: jeder Browser rechnet dasselbe.
(function (G) {
  const CAM = G.CAM;
  const MOVES = CAM.MOVES;

  class Battle {
    // o: { kind: 'wild'|'trainer'|'duel'|'raid', seed, weather, actors: [{ id, name, side, ctrl: 'local'|'remote'|'ai', team: [mob], boss, fleeFirst }] }
    constructor(o) {
      this.kind = o.kind;
      this.rng = CAM.mulberry32(o.seed | 0);
      this.weather = o.weather || 'klar';
      this.turn = 1;
      this.phase = 'action';
      this.over = false;
      this.winner = null;        // Seite 0 oder 1
      this.result = {};          // { fled, caught }
      this.defeated = [];        // besiegte Mobs der Seite 1 (für Erfahrung)
      this.noItems = o.kind === 'duel';
      this.erster = o.erster == null ? null : o.erster;   // Seite, die den Kampf eröffnet (überfällt, anspringt, herausfordert): Runde 0 gehört nur ihr, sie schlägt zu, bevor die andere Seite wählt
      if (this.erster != null) this.turn = 0;
      this.actors = o.actors.map(a => ({
        id: a.id, name: a.name, side: a.side, ctrl: a.ctrl, team: a.team, fang: a.fang || 1, boss: !!a.boss, fleeFirst: !!a.fleeFirst,
        active: Math.max(0, a.team.findIndex(m => m.hp > 0)), out: false, chosen: null, plan: null, used: new Set(), enraged: false, gone: false,
      }));
      this.actors.forEach(a => a.used.add(a.active));
      this.needRep = [];
      this.lastSide = null;        // Seite, die zuletzt wirklich gehandelt hat: Es wird strikt abwechselnd gehandelt, nie zweimal dieselbe Seite hintereinander
      this.fortsetzen = false;     // Ersatz mitten in der Runde (nach einem Vorspiel des Gegners): danach wählt der Spieler seine Aktion
      this.rundeErste = this.erster != null ? this.erster : this.bestimmeErste();
      this.planAll();
    }

    // Wer beginnt, wenn noch niemand gehandelt hat? Im Duell der Schnellere, sonst die Spieler (Seite 0).
    bestimmeErste() {
      if (this.kind !== 'duel') return 0;
      let best = 0, bs = -1, br = 0;
      for (const a of this.actors) { const m = a.team[a.active], v = m ? m.spd : 0, r = this.rnd(); if (v > bs || (v === bs && r > br)) { bs = v; br = r; best = a.side; } }
      return best;
    }

    actor(id) { return this.actors.find(a => a.id === id); }
    cur(a) { return a.team[a.active]; }
    foes(a) { return this.actors.filter(x => x.side !== a.side && !x.out); }
    living(a) { return a.team.some(m => m.hp > 0); }
    rnd() { return this.rng(); }

    // ----- KI-Planung (gleich auf allen Rechnern, weil sie den Zufall des Kampfes nutzt) -----
    planAll() {
      for (const a of this.actors) if (!a.out && a.ctrl === 'ai') a.plan = this.aiChoose(a);
    }
    aiChoose(a) {
      const me = this.cur(a);
      const foes = this.foes(a).filter(f => f.team[f.active] && f.team[f.active].hp > 0);
      if (!me || me.hp <= 0 || !foes.length) return { t: 'pass' };
      const target = foes[Math.floor(this.rnd() * foes.length)];
      const tm = target.team[target.active];
      if (a.boss) {
        // Riesen-Gegner: jede dritte Runde ein Flächenangriff, sonst eine seiner Attacken
        const aoe = me.moves.findIndex(id => MOVES[id].aoe);
        if (aoe >= 0 && this.turn % 3 === 0) return { t: 'move', i: aoe, target: target.id };
        const non = me.moves.map((id, i) => i).filter(i => !MOVES[me.moves[i]].aoe);
        return { t: 'move', i: non[Math.floor(this.rnd() * non.length)], target: target.id };
      }
      // normale Gegner: meist die beste Attacke, manchmal eine zufällige
      let best = 0, bestV = -1;
      me.moves.forEach((id, i) => {
        const mv = MOVES[id];
        let v = mv.pow ? mv.pow * CAM.effekt(mv.el, CAM.elemente(tm)) * (CAM.elemente(me).includes(mv.el) ? 1.25 : 1) : (me.hp < me.mhp * 0.4 ? 40 : 0);
        v *= 0.8 + this.rnd() * 0.4;
        if (v > bestV) { bestV = v; best = i; }
      });
      if (this.rnd() < 0.2) best = Math.floor(this.rnd() * me.moves.length);
      return { t: 'move', i: best, target: target.id };
    }

    // ----- Eingaben -----
    pending() {
      if (this.over) return [];
      if (this.phase === 'replace') return this.needRep.filter(id => { const a = this.actor(id); return a.ctrl !== 'ai' && a.chosen == null; });
      return this.actors.filter(a => !a.out && a.ctrl !== 'ai' && !a.chosen && !a.acted && (this.turn > 0 || a.side === this.erster)).map(a => a.id);
    }
    submit(id, act) { const a = this.actor(id); if (a && !a.out) a.chosen = act; }
    submitReplace(id, idx) { const a = this.actor(id); if (a) a.chosen = { t: 'switch', i: idx }; }
    ready() { return !this.over && this.pending().length === 0; }

    // ----- Runde auswerten -----
    // Strikt abwechselnd: Die Seite, die zuletzt gehandelt hat, ist in der nächsten Runde als Zweite dran (siehe startTurn).
    // Innerhalb einer Seite gehen Wechseln, Gegenstand, Fangen und Fliehen vor Angriffen, dann entscheidet das Tempo.
    // Runde 0 (Eröffnung): nur die Seite, die den Kampf beginnt, greift an.
    sortiere(list) {
      const fs = this.rundeErste;
      const prio = x => (x.act.t === 'move' || x.act.t === 'pass') ? 0 : 1;
      const spd = x => { const m = this.cur(x.a); return m ? m.spd : 0; };
      list.sort((p, q) => ((p.a.side === fs ? 0 : 1) - (q.a.side === fs ? 0 : 1)) || prio(q) - prio(p) || spd(q) - spd(p) || p.r - q.r);
    }
    // Eine Aktion ausführen; zählt nur dann als «gehandelt», wenn der Zug auch wirklich stattfindet (ein besiegter Mob kann nicht angreifen)
    handle(a, act, ev) {
      const me = this.cur(a);
      const echt = act.t !== 'pass' && !(act.t === 'move' && (!me || me.hp <= 0));
      this.doAction(a, act, ev);
      a.acted = true;
      if (echt) this.lastSide = a.side;
      this.checkFaints(ev);
    }
    // Vorspiel: Beginnt in dieser Runde ein Gegner (nur Computer), handelt er sofort, noch bevor du deine Aktion wählst
    vorspiel() {
      const ev = [];
      if (this.over || this.phase !== 'action' || this.turn === 0) return ev;
      const seite = this.actors.filter(a => !a.out && a.side === this.rundeErste);
      if (!seite.length || seite.some(a => a.ctrl !== 'ai')) return ev;
      const list = seite.filter(a => !a.acted).map(a => ({ a, act: a.plan || { t: 'pass' }, r: this.rnd() }));
      if (!list.length) return ev;
      this.sortiere(list);
      for (const x of list) { if (this.over) break; if (x.a.out) continue; this.handle(x.a, x.act, ev); }
      if (this.over) return ev;
      // Wurde einer von uns besiegt? Dann zuerst Ersatz wählen, danach geht die Runde mit deiner Aktion weiter
      this.needRep = [];
      for (const a of this.actors) {
        if (a.out) continue;
        const m = this.cur(a);
        if (m && m.hp > 0) continue;
        if (!this.living(a)) { a.out = true; continue; }
        if (a.ctrl === 'ai') this.doSwitch(a, a.team.findIndex(x => x.hp > 0), ev); else this.needRep.push(a.id);
      }
      if (this.needRep.length) { this.phase = 'replace'; this.fortsetzen = true; }
      return ev;
    }
    resolve() {
      const ev = [];
      if (this.over) return ev;
      if (this.phase === 'replace') { this.doReplace(ev); return ev; }
      const list = [];
      for (const a of this.actors) {
        if (a.out || a.acted || (this.turn === 0 && a.side !== this.erster)) continue;
        let act = a.ctrl === 'ai' ? a.plan : a.chosen;
        if (this.turn === 0 && (!act || act.t !== 'move')) act = null;
        list.push({ a, act: act || { t: 'pass' }, r: this.rnd() });
      }
      this.sortiere(list);
      for (const x of list) {
        if (this.over) break;
        if (x.a.out) continue;
        this.handle(x.a, x.act, ev);
      }
      if (!this.over && this.turn > 0) this.endOfTurn(ev);
      for (const a of this.actors) a.chosen = null;
      if (!this.over) this.afterTurn(ev);
      return ev;
    }

    doAction(a, act, ev) {
      const me = this.cur(a);
      if (act.t === 'gone') {
        a.gone = true; a.team.forEach(m => { m.hp = 0; }); ev.push({ k: 'msg', t: a.name + ' hat die Verbindung verloren.' });
        ev.push({ k: 'hp', a: a.id, i: a.active, hp: 0 }); return;
      }
      if (act.t === 'pass') return;
      if (act.t === 'switch') return this.doSwitch(a, act.i, ev);
      if (act.t === 'item') return this.doItem(a, act, ev);
      if (act.t === 'catch') return this.doCatch(a, act, ev);
      if (act.t === 'flee') return this.doFlee(a, ev);
      if (act.t === 'move') {
        if (!me || me.hp <= 0) return;
        this.doMove(a, act, ev);
      }
    }

    doSwitch(a, i, ev) {
      const m = a.team[i];
      if (!m || m.hp <= 0 || i === a.active) return;
      const old = this.cur(a);
      if (old) old.status = old.status && old.status.t !== 'furcht' ? old.status : null;
      a.active = i; a.used.add(i);
      ev.push({ k: 'switch', a: a.id, i, hp: m.hp, st: m.status ? m.status.t : null, t: a.name + ' ruft ' + CAM.name(m) + '!' });
    }

    doItem(a, act, ev) {
      const it = CAM.ITEMS[act.item]; const m = a.team[act.i];
      if (!it || !m) return;
      if (it.heil && m.hp > 0) {
        const before = m.hp; m.hp = Math.min(m.mhp, m.hp + it.heil);
        ev.push({ k: 'heal', a: a.id, i: act.i, hp: m.hp, t: CAM.name(m) + ' erholt sich um ' + (m.hp - before) + ' LP.' });
      } else if (it.beleb && m.hp <= 0) {
        m.hp = Math.max(1, Math.floor(m.mhp * it.beleb)); m.status = null; m.faintDone = false;
        ev.push({ k: 'heal', a: a.id, i: act.i, hp: m.hp, t: CAM.name(m) + ' ist wieder auf den Beinen!' });
      } else if (it.heilStatus && m.hp > 0 && m.status) {
        m.status = null; ev.push({ k: 'status', a: a.id, i: act.i, st: null, t: CAM.name(m) + ' ist wieder gesund.' });
      } else ev.push({ k: 'msg', t: 'Das hatte keine Wirkung.' });
    }

    doCatch(a, act, ev) {
      const foeA = this.foes(a)[0]; const tm = foeA && foeA.team[foeA.active];
      const it = CAM.ITEMS[act.item];
      if (!tm || !it || this.kind !== 'wild') return;
      ev.push({ k: 'msg', t: a.name + ' wirft ein ' + it.n + '!' });
      const f = CAM.FAMILIEN[tm.fam];
      const rate = CAM.fangChance(a.fang || 1, tm, it);
      const ok = this.rnd() < rate;
      let shakes = ok ? 3 : 1 + Math.floor(this.rnd() * 3);
      ev.push({ k: 'shake', n: shakes, ok });
      if (ok) {
        ev.push({ k: 'msg', t: CAM.name(tm) + ' wurde gefangen!' });
        this.over = true; this.winner = a.side; this.result = { caught: CAM.kopie(tm) };
        ev.push({ k: 'end' });
      } else ev.push({ k: 'msg', t: CAM.name(tm) + ' befreit sich!' });
    }

    doFlee(a, ev) {
      const foeA = this.foes(a)[0]; const me = this.cur(a);
      if (!foeA) return;
      const fm = this.cur(foeA);
      if (this.kind === 'wild' || (a.fleeFirst && this.turn === 1)) {
        const ok = me.spd >= fm.spd || this.rnd() < 0.5;
        if (ok) {
          ev.push({ k: 'msg', t: a.name + ' ist geflohen!' });
          this.over = true; this.winner = foeA.side; this.result = { fled: a.id }; ev.push({ k: 'end' });
        } else ev.push({ k: 'msg', t: 'Die Flucht ist missglückt!' });
      } else ev.push({ k: 'msg', t: 'Hier gibt es kein Entkommen!' });
    }

    wFx(el) { const w = CAM.WETTER_FX[this.weather]; return (w && w[el]) || 1; }

    doMove(a, act, ev) {
      const me = this.cur(a); const mv = CAM.moveFuer(me, me.moves[act.i]);
      if (!mv) return;
      // Status vor dem Zug
      const blind = !!(me.status && me.status.t === 'blind'), schwach = !!(me.status && me.status.t === 'schwaeche');
      if (me.status) {
        const st = me.status;
        if (st.t === 'schlaf') {
          st.n--;
          if (st.n > 0) { ev.push({ k: 'msg', t: CAM.name(me) + ' schläft tief.' }); return; }
          me.status = null; ev.push({ k: 'status', a: a.id, i: a.active, st: null, t: CAM.name(me) + ' wacht auf!' });
        } else if (st.t === 'furcht') {
          st.n--;
          if (st.n <= 0) me.status = null;
          if (this.rnd() < 0.3) { ev.push({ k: 'msg', t: CAM.name(me) + ' ist vor Angst wie gelähmt.' }); return; }
        } else if (st.t === 'betaeubt') {
          me.status = null; ev.push({ k: 'status', a: a.id, i: a.active, st: null, t: CAM.name(me) + ' ist betäubt und verliert den Zug!' }); return;
        } else if (st.t === 'laehmung') {
          st.n--;
          if (st.n <= 0) me.status = null;
          if (this.rnd() < 0.4) { ev.push({ k: 'msg', t: CAM.name(me) + ' ist gelähmt und kann sich nicht bewegen!' }); return; }
        } else if (st.t === 'blind' || st.t === 'schwaeche') {
          st.n--;
          if (st.n <= 0) { me.status = null; ev.push({ k: 'status', a: a.id, i: a.active, st: null, t: CAM.name(me) + ' ist wieder ganz bei sich.' }); }
        }
      }
      // Ziele bestimmen
      let targets;
      const foes = this.foes(a).filter(f => f.team[f.active] && f.team[f.active].hp > 0);
      if (!mv.heal) {
        if (!foes.length) return;
        if (mv.aoe) targets = foes;
        else {
          let t = foes.find(f => f.id === act.target);
          if (!t) t = foes[Math.floor(this.rnd() * foes.length)];
          targets = [t];
        }
      }
      ev.push({ k: 'msg', t: CAM.name(me) + ' setzt ' + mv.n + ' ein!', anim: { a: a.id, move: mv.id, to: mv.heal ? [a.id] : targets.map(t => t.id) } });
      // Selbstheilung
      if (mv.heal) {
        const before = me.hp; me.hp = Math.min(me.mhp, me.hp + Math.floor(me.mhp * mv.heal));
        ev.push({ k: 'heal', a: a.id, i: a.active, hp: me.hp, t: CAM.name(me) + ' heilt sich um ' + (me.hp - before) + ' LP.' });
        return;
      }
      const accMul = ((CAM.WETTER_FX[this.weather] && CAM.WETTER_FX[this.weather].acc) || 1) * (blind ? 0.6 : 1);
      for (const t of targets) {
        const tm = t.team[t.active];
        if (this.rnd() * 100 >= mv.acc * accMul * 0.9) { ev.push({ k: 'msg', t: 'Die Attacke geht daneben!' }); continue; }   // Grundchance zu verfehlen: 10 % (schwächere Attacken öfter)
        const eff = CAM.effekt(mv.el, CAM.elemente(tm));
        const stab = CAM.elemente(me).includes(mv.el) ? 1.25 : 1;
        const crit = this.rnd() < 1 / 8 ? 1.5 : 1;
        const rand = 0.85 + this.rnd() * 0.15;
        const atk = me.atk * (me.status && me.status.t === 'brand' ? 0.8 : 1) * (schwach ? 0.7 : 1) * (a.enraged ? 1.25 : 1);
        let dmg = Math.floor(((2 * me.lv / 5 + 2) * mv.pow * atk / tm.def) / 50 + 2);
        dmg = Math.max(1, Math.floor(dmg * stab * eff * crit * rand * this.wFx(mv.el) * (mv.aoe ? 0.8 : 1)));
        tm.hp = Math.max(0, tm.hp - dmg);
        ev.push({ k: 'hp', a: t.id, i: t.active, hp: tm.hp, dmg, hit: true });
        if (crit > 1) ev.push({ k: 'msg', t: 'Kritisch! Ein Volltreffer!' });
        if (eff > 1) ev.push({ k: 'msg', t: 'Sehr effektiv!' });
        else if (eff < 1) ev.push({ k: 'msg', t: 'Das ist nicht sehr effektiv ...' });
        if (tm.hp > 0 && mv.st && !tm.status && this.rnd() * 100 < mv.p) {
          tm.status = { t: mv.st, n: mv.st === 'schlaf' ? 1 + Math.floor(this.rnd() * 3) : mv.st === 'betaeubt' ? 1 : 3 };
          ev.push({ k: 'status', a: t.id, i: t.active, st: mv.st, t: CAM.name(tm) + ' ist ' + CAM.STATUS[mv.st] + '!' });
        }
      }
    }

    checkFaints(ev) {
      for (const a of this.actors) {
        if (a.out) continue;
        const m = this.cur(a);
        if (m && m.hp <= 0 && !m.faintDone) {
          m.faintDone = true; m.status = null;
          ev.push({ k: 'faint', a: a.id, i: a.active, t: CAM.name(m) + ' ist besiegt!' });
          if (a.side === 1) this.defeated.push({ fam: m.fam, lv: m.lv, boss: a.boss });
        }
      }
      // Seite ausgeschieden?
      for (const side of [0, 1]) {
        const as = this.actors.filter(x => x.side === side);
        if (as.every(x => x.out || !this.living(x)) && !this.over) {
          as.forEach(x => { if (!this.living(x)) x.out = true; });
          this.over = true; this.winner = 1 - side;
          ev.push({ k: 'end' });
        }
      }
    }

    endOfTurn(ev) {
      for (const a of this.actors) {
        const m = this.cur(a);
        if (a.out || !m || m.hp <= 0) continue;
        if (m.status && (m.status.t === 'gift' || m.status.t === 'brand')) {
          const d = Math.max(1, Math.floor(m.mhp / (m.status.t === 'gift' ? 8 : 16)));
          m.hp = Math.max(0, m.hp - d);
          ev.push({ k: 'hp', a: a.id, i: a.active, hp: m.hp, dmg: d, t: CAM.name(m) + (m.status.t === 'gift' ? ' leidet unter dem Gift.' : ' verbrennt.') });
        }
        if (a.boss && !a.enraged && m.hp > 0 && m.hp < m.mhp / 2) {
          a.enraged = true; ev.push({ k: 'msg', t: CAM.name(m) + ' gerät in Rage!' });
        }
      }
      this.checkFaints(ev);
    }

    afterTurn(ev) {
      // Wer einen gefallenen Mob hat, braucht Ersatz
      this.needRep = [];
      for (const a of this.actors) {
        if (a.out) continue;
        const m = this.cur(a);
        if (!m || m.hp > 0) continue;
        if (!this.living(a)) { a.out = true; continue; }
        if (a.ctrl === 'ai') {
          const i = a.team.findIndex(x => x.hp > 0);
          this.doSwitch(a, i, ev);
        } else this.needRep.push(a.id);
      }
      if (this.needRep.length) { this.phase = 'replace'; return; }
      this.startTurn();
    }

    doReplace(ev) {
      for (const id of this.needRep) {
        const a = this.actor(id); const c = a.chosen;
        if (c && c.t === 'switch') this.doSwitch(a, c.i, ev);
        else { const i = a.team.findIndex(x => x.hp > 0); this.doSwitch(a, i, ev); }
        a.chosen = null;
      }
      this.needRep = []; this.phase = 'action';
      if (this.fortsetzen) { this.fortsetzen = false; this.checkFaints(ev); return; }   // Ersatz mitten in der Runde: Der Spieler wählt jetzt seine Aktion
      this.startTurn();
    }

    startTurn() {
      this.phase = 'action';
      this.turn++;
      for (const a of this.actors) a.acted = false;
      this.rundeErste = this.lastSide == null ? this.bestimmeErste() : 1 - this.lastSide;
      this.planAll();
    }

    // Erfahrung, die ein Mob der Seite 0 bekommt (nur Mobs, die mitgekämpft haben und noch leben)
    xpPool() {
      let sum = 0;
      for (const d of this.defeated) {
        const f = CAM.FAMILIEN[d.fam];
        const basis = 40 + f.base.reduce((x, y) => x + y, 0) / 4 + f.rar * 25;
        sum += Math.floor(basis * d.lv / 5 * (this.kind === 'trainer' ? 1.5 : d.boss ? 3 : 1));
      }
      return sum;
    }
  }

  CAM.Battle = Battle;
})(typeof window !== 'undefined' ? window : globalThis);
