// Faust-Duell: Kampf-Engine, basierend auf mk.js von Minko Gechev (MIT-Lizenz, siehe LIZENZ.txt).
// Angepasst für langwiligi.site: eigene Figuren (figuren.js) statt Bild-Sprites, gemeinsames Eingabe-Modul
// für Tastatur/Touch/Bot, Online-Übertragung über GameHub, Darstellung per requestAnimationFrame.
;(function () {

  var mk = {};

  mk.callbacks = {
    ATTACK  : 'attack',
    GAME_END: 'game-end'
  };

  mk.config = {
    STEP_DURATION: 80,
    FLOOR        : 372,                       // Boden der Arena (y)
    PLAYER_TOP   : 372 - Figuren.H,          // Oberkante eines stehenden Kämpfer-Bildes
    BLOCK_DAMAGE : 0.2,
    REACH        : 95,                        // Reichweite für Treffer (Abstand der Körpermitten)
    BODY         : 46,                        // Körperbreite (so nah kommen sich die Kämpfer)
    START_X      : [115, 335]                 // Startposition (linke Bildkante) der beiden Kämpfer
  };

  mk.controllers = {};

  mk.controllers.Base = function (options) {
    if (!options)
      return;

    this._callbacks = options.callbacks || {};

    this._initializeFighters(options.fighters);

    var a = options.arena;
    this.arena = new mk.arenas.Arena({
      fighters: this.fighters,
      arena: a.arena,
      width: a.width,
      height: a.height,
      container: a.container,
      game: this
    });
  };

  mk.reset = function () {
    var game = this.game;
    if (typeof game.reset === 'function')
        game.reset();
    game.fighters.forEach(function (f) {
      f.getMove().stop();
    });
    game.fighters = null;
    game._opponents = null;
    game.arena.destroy();
    game.arena = null;
    game._callbacks = null;
    this.game = null;
  };

  mk.controllers.Base.prototype._initializeFighters = function (fighters) {
    var current;

    this.fighters = [];
    this._opponents = {};

    for (var i = 0; i < fighters.length; i += 1) {
      current = fighters[i];
      var orientation = (i === 0) ?
                mk.fighters.orientations.LEFT :
                mk.fighters.orientations.RIGHT;
      this.fighters.push(new mk.fighters.Fighter({
        name: current.name,
        arena: this.arena,
        orientation: orientation,
        game: this
      }));
    }
    this._opponents[this.fighters[0].getName()] = this.fighters[1];
    this._opponents[this.fighters[1].getName()] = this.fighters[0];
  };

  mk.controllers.Base.prototype.getOpponent = function (f) {
    return this._opponents[f.getName(name)];
  };

  mk.controllers.Base.prototype.init = function (promise) {
    var current = 0,
      total = this.fighters.length,
      self = this,
      f;
    for (var i = 0; i < this.fighters.length; i += 1) {
      f = this.fighters[i];
      (function (f) {
        f.init(function () {
          f.setMove(mk.moves.types.STAND);
          current += 1;
          if (current === total) {
            self.arena.init();
            self._setFighersArena();
            self._initialize();
            promise._initialized();
          }
        });
      }(f));
    }
  };

  mk.controllers.Base.prototype._initialize = function () {
    throw '_initialize is not implemented for this controller!';
  };

  mk.controllers.Base.prototype._setFighersArena = function () {
    var f;
    for (var i = 0; i < this.fighters.length; i += 1) {
      f = this.fighters[i];
      f.setArena(this.arena);
      f._position.x = mk.config.START_X[i];
    }
    this.arena._setFightersOrientation(this.fighters[0], this.fighters[1]);
  };

  mk.controllers.Base.prototype.fighterAttacked = function (fighter, damage) {
    var opponent = this.getOpponent(fighter),
      opponentLife = opponent.getLife(),
      callback = this._callbacks[mk.callbacks.ATTACK];
    if (this._requiredDistance(fighter, opponent) &&
      this._attackCompatible(fighter.getMove().type, opponent.getMove().type)) {
      opponent.endureAttack(damage, fighter.getMove().type);
      if (typeof callback === 'function') {
        callback.call(null, fighter, opponent, opponentLife - opponent.getLife());
      }
    }
  };

  mk.controllers.Base.prototype._attackCompatible = function (attack, opponentStand) {
    var m = mk.moves.types;
    if (opponentStand === m.SQUAT) {
      if (attack !== m.LOW_PUNCH && attack !== m.LOW_KICK) {
        return false;
      }
    }
    return true;
  };

  /**
   * Checks wheter the attacker is in the required distance to his opponent
   *
   * @private
   * @param {Fighter} attacker The fighter who attacks
   * @param {Fighter} opponent The fighter who will endure the attack
   * @return {boolean} true/false depending on the distance between the fighters
   */
  mk.controllers.Base.prototype._requiredDistance = function (attacker, opponent) {
    var fMiddle = attacker.getX() + attacker.getWidth() / 2,
      oMiddle = opponent.getX() + opponent.getWidth() / 2,
      distance = Math.abs(fMiddle - oMiddle),
      m = mk.moves.types,
      type = attacker.getMove().type,
      width = opponent.getWidth();
    if (distance <= width) {
      return true;
    }
    if (type === m.UPPERCUT &&
      distance <= width * 1.2) {
      return true;
    }
    if ((type === m.BACKWARD_JUMP_KICK ||
      type === m.FORWARD_JUMP_KICK ||
      type === m.FORWARD_JUMP_PUNCH ||
      type === m.BACKWARD_JUMP_PUNCH) &&
      distance <= width * 1.5) {
      return true;
    }
    return false;
  };

  mk.controllers.Base.prototype.fighterDead = function (fighter) {
    var opponent = this.getOpponent(fighter),
      callback = this._callbacks[mk.callbacks.GAME_END];
    opponent.getMove().stop();
    opponent.setMove(mk.moves.types.WIN);
    if (typeof callback === 'function') {
      callback.call(null, fighter);
    }
  };

  // Aktionen, die ein Spieler auslösen kann
  mk.controllers.keys = {
    RIGHT: 'RIGHT', LEFT: 'LEFT', UP: 'UP', DOWN: 'DOWN', BLOCK: 'BLOCK',
    HP: 'HP', LP: 'LP', LK: 'LK', HK: 'HK'
  };

  // Gemeinsames Eingabe-Modul: Tastatur, Touch-Knöpfe und Bot drücken hier "Tasten" pro Spieler
  mk.input = {
    // Spieler 1: WASD, R/T oben (Schlag/Tritt), F/G unten, Q oder Shift links = Block
    // Spieler 2: Pfeile, I/O oben, K/L unten, J oder Shift rechts = Block (auch Ziffernblock)
    bindings: {
      KeyD: [0, 'RIGHT'], KeyA: [0, 'LEFT'], KeyW: [0, 'UP'], KeyS: [0, 'DOWN'],
      KeyR: [0, 'HP'], KeyT: [0, 'HK'], KeyF: [0, 'LP'], KeyG: [0, 'LK'], KeyQ: [0, 'BLOCK'], ShiftLeft: [0, 'BLOCK'],
      ArrowRight: [1, 'RIGHT'], ArrowLeft: [1, 'LEFT'], ArrowUp: [1, 'UP'], ArrowDown: [1, 'DOWN'],
      KeyI: [1, 'HP'], KeyO: [1, 'HK'], KeyK: [1, 'LP'], KeyL: [1, 'LK'], KeyJ: [1, 'BLOCK'], ShiftRight: [1, 'BLOCK'],
      Numpad8: [1, 'HP'], Numpad9: [1, 'HK'], Numpad5: [1, 'LP'], Numpad6: [1, 'LK'], Numpad0: [1, 'BLOCK']
    },
    single: -1,             // >= 0: alle Tasten steuern diesen Spieler (Bot- und Online-Modus)
    enabled: true,
    state: [{}, {}],
    _listeners: [],
    on: function (fn) { this._listeners.push(fn); },
    off: function (fn) { this._listeners = this._listeners.filter(function (l) { return l !== fn; }); },
    _emit: function (p) { var st = this.state[p]; this._listeners.slice().forEach(function (l) { l(p, st); }); },
    press: function (p, a) {
      if (!this.enabled || this.state[p][a]) return;
      this.state[p][a] = true; this._emit(p);
    },
    release: function (p, a) {
      if (!this.state[p][a]) return;
      delete this.state[p][a]; this._emit(p);
    },
    clear: function () {
      for (var p = 0; p < 2; p++) { if (Object.keys(this.state[p]).length) { this.state[p] = {}; this._emit(p); } }
    },
    _map: function (code) {
      var b = this.bindings[code];
      if (!b) return null;
      return [this.single >= 0 ? this.single : b[0], b[1]];
    }
  };
  document.addEventListener('keydown', function (e) {
    var m = mk.input._map(e.code);
    if (!m || !mk.game) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) mk.input.press(m[0], m[1]);
  });
  document.addEventListener('keyup', function (e) {
    var m = mk.input._map(e.code);
    if (m) mk.input.release(m[0], m[1]);
  });
  window.addEventListener('blur', function () { mk.input.clear(); });

  mk.controllers.Basic = function (options) {
    mk.controllers.Base.call(this, options);
  };

  mk.controllers.Basic.prototype = new mk.controllers.Base();

  mk.controllers.Basic.prototype._initialize = function () {
    this._player = this._player || 0;
    this._addHandlers();
  };

  // Steuert nur den eigenen Kämpfer (this._player)
  mk.controllers.Basic.prototype._addHandlers = function () {
    var self = this;
    this._inputHandler = function (p, pressed) {
      if (p !== self._player || !self.fighters) return;
      var f = self.fighters[p];
      self._moveFighter(f, self._getMove(pressed, mk.controllers.keys, p));
    };
    mk.input.on(this._inputHandler);
  };

  mk.controllers.Basic.prototype.reset = function () {
    if (this._inputHandler) mk.input.off(this._inputHandler);
    this._inputHandler = null;
  };

  mk.controllers.Basic.prototype._moveFighter = function (f, m) {
    if (m) {
      f.setMove(m);
    }
  };

  mk.controllers.Basic.prototype._getMove = function (pressed, k, p) {
    var m = mk.moves.types,
      f = this.fighters[p],
      leftOrient = mk.fighters.orientations.LEFT,
      rightOrient = mk.fighters.orientations.RIGHT,
      orient = f.getOrientation(),
      self = this;

    if (f.getMove().type === m.SQUAT && !pressed[k.DOWN]) {
      return m.STAND_UP;
    }
    if (f.getMove().type === m.BLOCK && !pressed[k.BLOCK]) {
      return m.STAND;
    }
    if (Object.keys(pressed).length === 0) {
      return m.STAND;
    }
    if (pressed[k.BLOCK]) {
      return m.BLOCK;
    } else if (pressed[k.LEFT]) {
      if (pressed[k.UP]) {
        return m.BACKWARD_JUMP;
      } else if (pressed[k.HK] && orient === leftOrient) {
        return m.SPIN_KICK;
      }
      return m.WALK_BACKWARD;
    } else if (pressed[k.RIGHT]) {
      if (pressed[k.UP]) {
        return m.FORWARD_JUMP;
      } else if (pressed[k.HK] && orient === rightOrient) {
        return m.SPIN_KICK;
      }
      return m.WALK;
    } else if (pressed[k.DOWN]) {
      if (pressed[k.HP]) {
        return m.UPPERCUT;
      } else if (pressed[k.LK]) {
        return m.SQUAT_LOW_KICK;
      } else if (pressed[k.HK]) {
        return m.SQUAT_HIGH_KICK;
      } else if (pressed[k.LP]) {
        return m.SQUAT_LOW_PUNCH;
      }
      return m.SQUAT;
    } else if (pressed[k.HK]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_KICK;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_KICK;
      }
      return m.HIGH_KICK;
    } else if (pressed[k.UP]) {
      return m.JUMP;
    } else if (pressed[k.LK]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_KICK;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_KICK;
      }
      return m.LOW_KICK;
    } else if (pressed[k.LP]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_PUNCH;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_PUNCH;
      }
      return m.LOW_PUNCH;
    } else if (pressed[k.HP]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_PUNCH;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_PUNCH;
      }
      return m.HIGH_PUNCH;
    }
  };

  mk.controllers.Multiplayer = function (options) {
    mk.controllers.Basic.call(this, options);
  };

  mk.controllers.Multiplayer.prototype = new mk.controllers.Basic();

  mk.controllers.Multiplayer.prototype._initialize = function () {
    this._addHandlers();
  };

  // Beide Kämpfer an einem Gerät
  mk.controllers.Multiplayer.prototype._addHandlers = function () {
    var self = this;
    this._inputHandler = function (p, pressed) {
      if (!self.fighters) return;
      self._moveFighter(self.fighters[p], self._getMove(pressed, mk.controllers.keys, p));
    };
    mk.input.on(this._inputHandler);
  };

  mk.controllers.Multiplayer.prototype._moveFighter = function (fighter, move) {
    if (move) {
      fighter.setMove(move);
    }
  };

  mk.controllers.Network = function (options) {
    mk.controllers.Basic.call(this, options);
    this._isHost = options.isHost;
    this._gameName = options.gameName;
    this._transport = options.transport;
    this._timers = [];
  };

  mk.callbacks.PLAYER_CONNECTED = 'player-connected';

  mk.controllers.Network.prototype = new mk.controllers.Basic();

  mk.controllers.Network.prototype.Requests = {
    CREATE_GAME: 'create-game',
    JOIN_GAME  : 'join-game'
  };

  mk.controllers.Network.prototype.Responses = {
    SUCCESS        : 0,
    GAME_EXISTS    : 1,
    GAME_NOT_EXISTS: 2,
    GAME_FULL      : 3
  };

  mk.controllers.Network.prototype.Messages = {
    EVENT           : 'event',
    LIFE_UPDATE     : 'life-update',
    POSITION_UPDATE : 'position-update',
    PLAYER_CONNECTED: 'player-connected'
  };

  mk.controllers.Network.prototype._createGame = function (game) {
    this._transport.emit(this.Requests.CREATE_GAME, this._gameName);
    this._addSocketHandlers();
  };

  mk.controllers.Network.prototype._addSocketHandlers = function () {
    var opponent = this.fighters[+!this._player],
      f = this.fighters[this._player],
      m = this.Messages,
      self = this;
    this._transport.on(m.EVENT, function (move) {
      if (!self.fighters || !(move in opponent.moves)) return;
      opponent.unlock();
      opponent.setMove(move);
    });
    this._transport.on(m.LIFE_UPDATE, function (data) {
      if (self.fighters && typeof data === 'number') opponent.setLife(data);
    });
    this._transport.on(m.POSITION_UPDATE, function (data) {
      if (!self.fighters || !data) return;
      opponent._position.x = +data.x || 0;
      opponent.setY(+data.y || mk.config.PLAYER_TOP);
      self.arena._setFightersOrientation(opponent, f);
    });
    this._timers.push(setInterval(function () {
      if (self.fighters) self._transport.emit(m.LIFE_UPDATE, f.getLife());
    }, 1000));
    this._timers.push(setInterval(function () {
      if (self.fighters && !f.isJumping()) {
        self._transport.emit(m.POSITION_UPDATE, {
          x: f.getX(),
          y: f.getY()
        });
      }
    }, 250));
    if (this._isHost) {
      this._transport.on(this.Messages.PLAYER_CONNECTED, function (data) {
        var c = self._callbacks[mk.callbacks.PLAYER_CONNECTED];
        if (typeof c  === 'function') {
          c();
        }
      });
    }
  };

  // Nur Bewegungen senden, die lokal auch ausgeführt wurden (sonst bricht z.B. "stehen" einen Schlag ab)
  mk.controllers.Network.prototype._moveFighter = function (f, m) {
    if (m) {
      var vorher = f.getMove();
      f.setMove(m);
      if (f.getMove() !== vorher && f.getMove().type === m) this._transport.emit('event', m);
    }
  };

  mk.controllers.Network.prototype._joinGame = function (game) {
    this._transport.emit(this.Requests.JOIN_GAME, this._gameName);
    this._addSocketHandlers();
  };

  mk.controllers.Network.prototype._initialize = function () {
    var self = this;
    // Host spielt links (Spieler 0), Gast rechts (Spieler 1). Das Leben des Gegners kommt von dessen Gerät.
    this._player = this._isHost ? 0 : 1;
    this.fighters[1 - this._player]._remote = true;
    this._addHandlers();
    this._transport.init();
    this._transport.on('connect', function () {
      if (self._isHost) {
        self._createGame(self._gameName);
      } else {
        self._joinGame(self._gameName);
      }
    });
  };

  mk.controllers.Network.prototype.reset = function () {
    mk.controllers.Basic.prototype.reset.call(this);
    this._timers.forEach(clearInterval);
    this._timers = [];
  };

  mk.start = function (options) {
    var type = options.gameType || 'basic',
      promise = new mk.Promise();
    type = type.toLowerCase();
    switch (type) {
      case 'basic':
        mk.game = new mk.controllers.Basic(options);
        break;
      case 'network':
        mk.game = new mk.controllers.Network(options);
        break;
      case 'bot':
        mk.game = new mk.controllers.Basic(options);
        break;
      case 'multiplayer':
        mk.game = new mk.controllers.Multiplayer(options);
        break;
      default:
        mk.game = new mk.controllers.Basic(options);
    }
    mk.game.init(promise);
    return promise;
  };

  mk.Promise = function () {
    this.callbacks = [];
  };

  mk.Promise.prototype._initialized = function () {
    this.done = true;
    this.callbacks.forEach(function (c) {
      if (typeof c === 'function') {
        c();
      }
    });
  };

  // Die Figuren werden sofort gezeichnet, init ist also oft schon fertig, bevor ready() aufgerufen wird
  mk.Promise.prototype.ready = function (callback) {
    if (this.done) setTimeout(callback, 0);
    else this.callbacks.push(callback);
  };


  mk.arenas = {
    types: {
      DOJO : 0,
      DACH : 1
    }
  };

  mk.arenas.Arena = function (options) {
    this.width = options.width || 600;
    this.height = options.height || 400;
    this.arena = options.arena || mk.arenas.types.DOJO;
    this.effects = [];
    this.shake = 0;
    this.fighters = options.fighters;
    this._container = options.container;
    this._game = options.game;
  };

  mk.arenas.Arena.prototype.init = function () {
    var canvas = document.createElement('canvas'), self = this;
    this.scale = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * Math.min(window.innerWidth / this.width, window.innerHeight / this.height)));
    canvas.width = Math.round(this.width * this.scale);
    canvas.height = Math.round(this.height * this.scale);
    this._container.appendChild(canvas);
    this._context = canvas.getContext('2d');
    this._canvas = canvas;
    this.texture = Arenen.zeichne(this.arena, this.width, this.height, this.scale);
    this._last = performance.now();
    var loop = function (now) {
      if (!self._context) return;
      self._draw(Math.min(0.05, (now - self._last) / 1000));
      self._last = now;
      self._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  };

  mk.arenas.Arena.prototype.destroy = function () {
    cancelAnimationFrame(this._raf);
    if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
    this._canvas = undefined;
    this._context = undefined;
    this._container = undefined;
    this._game = undefined;
    this.fighters = undefined;
    this.arena = undefined;
  };

  // Treffer-Funken (blocked = abgewehrt)
  mk.arenas.Arena.prototype.hit = function (x, y, blocked, strong) {
    var n = blocked ? 6 : 12;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * (strong ? 220 : 140);
      this.effects.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.35 + Math.random() * 0.2, t: 0,
        c: blocked ? '#9fd8ff' : (Math.random() < 0.5 ? '#ffd23f' : '#ff7a3d') });
    }
    this.effects.push({ ring: true, x: x, y: y, t: 0, life: 0.22, c: blocked ? '#9fd8ff' : '#fff3b0' });
    if (!blocked) this.shake = Math.max(this.shake, strong ? 0.28 : 0.14);
  };

  mk.arenas.Arena.prototype.refresh = function () {};

  mk.arenas.Arena.prototype._draw = function (dt) {
    var ctx = this._context, s = this.scale, f, st, i;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    var sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      sx = (Math.random() - 0.5) * 10 * this.shake / 0.28; sy = (Math.random() - 0.5) * 6 * this.shake / 0.28;
    }
    ctx.drawImage(this.texture, 0, 0, this.width, this.height);
    ctx.translate(sx, sy);
    for (i = 0; i < this.fighters.length; i += 1) {
      f = this.fighters[i];
      st = f.getState();
      if (!st) continue;
      // Schatten am Boden
      var lift = Math.max(0, mk.config.PLAYER_TOP - f.getY());
      var r = Math.max(14, 30 - lift * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0.12, 0.35 - lift * 0.002) + ')';
      ctx.beginPath(); ctx.ellipse(f.getX() + Figuren.AX, mk.config.FLOOR - 2, r, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (i = 0; i < this.fighters.length; i += 1) {
      f = this.fighters[i];
      st = f.getState();
      if (st) ctx.drawImage(st.img, f.getX(), f.getY(), st.width, st.height);
    }
    // Funken
    var keep = [];
    for (i = 0; i < this.effects.length; i++) {
      var e = this.effects[i];
      e.t += dt;
      if (e.t >= e.life) continue;
      keep.push(e);
      var k = 1 - e.t / e.life;
      ctx.globalAlpha = k;
      if (e.ring) {
        ctx.strokeStyle = e.c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, 8 + (1 - k) * 26, 0, Math.PI * 2); ctx.stroke();
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 500 * dt;
        ctx.fillStyle = e.c;
        ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
    this.effects = keep;
  };

  mk.arenas.Arena.prototype.moveFighter = function (fighter, pos) {
    var opponent = this._game.getOpponent(fighter),
      op = { x: opponent.getX(), y: opponent.getY() },
      isOver = pos.y + fighter.getVisibleHeight() <= op.y;

    var pad = Figuren.AX - 26;
    if (pos.x <= -pad) {
      pos.x = -pad;
    }
    if (pos.x >= this.width - Figuren.W + pad) {
      pos.x = this.width - Figuren.W + pad;
    }

    if (!isOver) {
      if (fighter.getOrientation() === mk.fighters.orientations.LEFT) {
        if (pos.x + fighter.getVisibleWidth() > op.x) {
          pos = this._synchronizeFighters(pos, fighter, opponent);
        }
      } else {
        if (pos.x < op.x + opponent.getVisibleWidth()) {
          pos = this._synchronizeFighters(pos, fighter, opponent);
        }
      }
    }

    this._setFightersOrientation(fighter, opponent);
    return pos;
  };

  mk.arenas.Arena.prototype._synchronizeFighters = function (pos, fighter, opponent) {
    if (fighter.getMove().type === mk.moves.types.FORWARD_JUMP ||
      fighter.getMove().type === mk.moves.types.BACKWARD_JUMP) {
      pos.x = fighter.getX();
      return pos;
    }
    var diff;
    if (fighter.getOrientation() === mk.fighters.orientations.LEFT) {
      diff = Math.min(this.width -
              (opponent.getX() + opponent.getVisibleWidth() +
              fighter.getVisibleWidth()),
              pos.x - fighter.getX());

      pos.x = fighter.getX() + diff;
      if (diff > 0) {
        opponent.setX(opponent.getX() + diff);
      }
    } else {
      diff = Math.min(opponent.getX(), fighter.getX() - pos.x);
      if (diff > 0) {
        pos.x = fighter.getX() - diff;
        opponent.setX(opponent.getX() - diff);
        if (opponent.getX() + opponent.getVisibleWidth() > pos.x) {
          pos.x = opponent.getX() + opponent.getVisibleWidth();
        }
      } else {
        pos.x = fighter.getX();
        if (opponent.getX() + opponent.getVisibleWidth() > pos.x) {
          pos.x = opponent.getX() + opponent.getVisibleWidth();
        }
      }
    }
    return pos;
  };

  mk.arenas.Arena.prototype._setFightersOrientation = function (f1, f2) {
    if (f1.getX() < f2.getX()) {
      f1.setOrientation(mk.fighters.orientations.LEFT);
      f2.setOrientation(mk.fighters.orientations.RIGHT);
    } else {
      f1.setOrientation(mk.fighters.orientations.RIGHT);
      f2.setOrientation(mk.fighters.orientations.LEFT);
    }
  };


/* * * * * * * * * * * * * * * * Definition of all movements * * * * * * * * * * * * * * * */

  mk.moves = {};

  mk.moves.types = {
    STAND              : 'stand',
    WALK               : 'walking',
    WALK_BACKWARD      : 'walking-backward',
    SQUAT              : 'squating',
    STAND_UP           : 'stand-up',
    HIGH_KICK          : 'high-kick',
    JUMP               : 'jumping',
    FORWARD_JUMP       : 'forward-jump',
    BACKWARD_JUMP      : 'backward-jump',
    LOW_KICK           : 'low-kick',
    LOW_PUNCH          : 'low-punch',
    HIGH_PUNCH         : 'high-punch',
    FALL               : 'fall',
    WIN                : 'win',
    ENDURE             : 'endure',
    SQUAT_ENDURE       : 'squat-endure',
    UPPERCUT           : 'uppercut',
    SQUAT_LOW_KICK     : 'squat-low-kick',
    SQUAT_HIGH_KICK    : 'squat-high-kick',
    SQUAT_LOW_PUNCH    : 'squat-low-punch',
    KNOCK_DOWN         : 'knock-down',
    ATTRACTIVE_STAND_UP: 'attractive-stand-up',
    SPIN_KICK          : 'spin-kick',
    BLOCK              : 'blocking',
    FORWARD_JUMP_KICK  : 'forward-jump-kick',
    BACKWARD_JUMP_KICK : 'backward-jump-kick',
    BACKWARD_JUMP_PUNCH: 'backward-jump-punch',
    FORWARD_JUMP_PUNCH : 'forward-jump-punch'
  };

  /**
   * Base constructor for all movements
   *
   * @constructor
   * @param {Fighter} owner Owner of the movement
   * @param {string} type Type of the movement
   * @param {number} stepDuration Duration between the movements steps
   */
  mk.moves.Move = function (owner, type, stepDuration) {
    this.owner = owner;
    this.type = type;
    this._stepDuration = stepDuration || 80;
    this._interval = -1;
    this._currentStep = 0;
    this._actionPending = [];
  };

  mk.moves.Move.prototype.go = function (step) {
    var self = this;
    if (typeof this._beforeGo === 'function')
      this._beforeGo();
    this._currentStep = step || 0;
    this._nextStep(this._action);
    this._interval = setInterval(function () {
      self._nextStep(self._action);
    }, this._stepDuration);
  };

  mk.moves.Move.prototype._action = function () {};

  mk.moves.Move.prototype._nextStep = function (callback) {
    var steps = this._steps[this.owner.getOrientation()],
      img = steps[Math.max(0, Math.min(steps.length - 1, this._currentStep))];
    this.owner.setState(img);
    callback.apply(this);
    this.owner.refresh();
    this._moveNextStep();
  };

  mk.moves.Move.prototype.init = function (callback) {
    var o = mk.fighters.orientations;
    this._steps = {};
    this._steps[o.RIGHT] = [];
    this._steps[o.LEFT] = [];
    for (var i = 0; i < this._totalSteps; i += 1) {
      for (var orientation in o) {
        this._steps[o[orientation]].push(Figuren.frame(this.owner.getName(), o[orientation], this.type, i, this._totalSteps));
      }
    }
    if (typeof this.addHandlers === 'function') {
      this.addHandlers();
    }
    callback.apply(this);
  };

  mk.moves.Move.prototype.stop = function (callback) {

    if (typeof this._beforeStop === 'function')
      this._beforeStop();

    clearInterval(this._interval);

    if (typeof this._actionPending === 'function') {
      var func = this._actionPending;
      this._actionPending = null;
      func();
    }

    this._shouldStop = false;
  };

  mk.moves.CycleMove = function (options) {
    options = options || {};
    mk.moves.Move.call(this, options.owner, options.type, options.duration);
    this._totalSteps = options.steps;
  };

  mk.moves.CycleMove.prototype = new mk.moves.Move();

  mk.moves.CycleMove.prototype._moveNextStep = function () {
    this._currentStep += 1;
    this._currentStep = this._currentStep % this._totalSteps;
  };

  mk.moves.Stand = function (owner) {
    mk.moves.CycleMove.call(this, {
      owner: owner,
      type: mk.moves.types.STAND,
      steps: 9
    });
  };

  mk.moves.Stand.prototype = new mk.moves.CycleMove();

  mk.moves.Stand.prototype._beforeGo = function () {
    this.owner.setY(mk.config.PLAYER_TOP);
  };

  mk.moves.Walk = function (owner) {
    mk.moves.CycleMove.call(this, {
      owner: owner,
      type: mk.moves.types.WALK,
      steps: 9
    });
  };

  mk.moves.Walk.prototype = new mk.moves.CycleMove();

  mk.moves.Walk.prototype._action = function () {
    this.owner.setX(this.owner.getX() + 10);
    this.owner.setY(mk.config.PLAYER_TOP);
  };

  mk.moves.WalkBack = function (owner) {
    mk.moves.CycleMove.call(this, {
      owner: owner,
      type: mk.moves.types.WALK_BACKWARD,
      steps: 9
    });
  };

  mk.moves.WalkBack.prototype = new mk.moves.CycleMove();

  mk.moves.WalkBack.prototype._action = function () {
    this.owner.setX(this.owner.getX() - 10);
    this.owner.setY(mk.config.PLAYER_TOP);
  };

  mk.moves.FiniteMove = function (owner, type, duration) {
    mk.moves.Move.call(this, owner, type, duration);
    this._bottom = undefined;
  };

  mk.moves.FiniteMove.prototype = new mk.moves.Move();

  mk.moves.FiniteMove.prototype._moveNextStep = function () {
    if (this._currentStep >= this._totalSteps - 1) {
      this._currentStep = this._totalSteps - 1;
    } else {
      this._currentStep = this._currentStep + 1;
    }
  };

  mk.moves.FiniteMove.prototype._beforeGo = function () {
    this._bottom = this.owner.getBottom();
    this.owner.lock();
  };

  mk.moves.FiniteMove.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.FiniteMove.prototype.keepDistance = function () {
    var currentBottom = this.owner.getBottom();
    if (currentBottom > this._bottom) {
      this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
    }
    if (currentBottom < this._bottom) {
      this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
    }
  };

  mk.moves.Fall = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.FALL, 100);
    this._totalSteps = 7;
  };

  mk.moves.Fall.prototype = new mk.moves.FiniteMove();

  mk.moves.Fall.prototype._action = function () {
    this.keepDistance();
  };

  mk.moves.Win = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.WIN, 100);
    this._totalSteps = 10;
  };

  mk.moves.Win.prototype = new mk.moves.FiniteMove();

  mk.moves.Win.prototype._action = function () {
    this.keepDistance();
  };

  mk.moves.Win.prototype._beforeGo = function () {
    this.owner.lock();
    this.owner.setY(mk.config.PLAYER_TOP);
    this._bottom = this.owner.getBottom();
  };

  mk.moves.Squat = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.SQUAT, 40);
    this._totalSteps = 3;
  };

  mk.moves.Squat.prototype = new mk.moves.FiniteMove();

  mk.moves.Squat.prototype._action = function () {
    this.keepDistance();
    if (this._currentStep === 2) {
      this.stop();
    }
  };

  mk.moves.Block = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.BLOCK, 40);
    this._totalSteps = 3;
  };

  mk.moves.Block.prototype = new mk.moves.FiniteMove();

  mk.moves.Block.prototype._action = function () {
    this.keepDistance();
    if (this._currentStep === 2) {
      this.stop();
    }
  };

  mk.moves.StandUp = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.STAND_UP, 100);
    this._totalSteps = 3;
  };

  mk.moves.StandUp.prototype = new mk.moves.FiniteMove();

  mk.moves.StandUp.prototype._action = function () {
    if (this._currentStep === 2) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
      this.owner.setY(mk.config.PLAYER_TOP);
    }
    this.keepDistance();
  };

  mk.moves.AttractiveStandUp = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.ATTRACTIVE_STAND_UP, 100);
    this._totalSteps = 4;
  };

  mk.moves.AttractiveStandUp.prototype = new mk.moves.FiniteMove();

  mk.moves.AttractiveStandUp.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
    } else {
      this.keepDistance();
    }
  };

  mk.moves.AttractiveStandUp.prototype._beforeStop = function () {
    this.owner.unlock();
    this.owner.setY(mk.config.PLAYER_TOP);
  };

  mk.moves.Endure = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.ENDURE);
    this._totalSteps = 3;
  };

  mk.moves.Endure.prototype = new mk.moves.Move();

  mk.moves.Endure.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
    }
  };

  mk.moves.Endure.prototype._beforeGo = function () {
    this.owner.lock();
  };

  mk.moves.Endure.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.Endure.prototype._moveNextStep = function () {
    this._currentStep += 1;
  };

  mk.moves.KnockDown = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.KNOCK_DOWN, 80);
    this._totalSteps = 10;
  };

  mk.moves.KnockDown.prototype = new mk.moves.Move();

  mk.moves.KnockDown.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.ATTRACTIVE_STAND_UP);
    } else {
      var xDisplacement = 25;
      if (this.owner.getOrientation() === mk.fighters.orientations.LEFT) {
        xDisplacement = -xDisplacement;
      }
      if (this._currentStep < 5) {
        this.owner.setX(this.owner.getX() + xDisplacement);
      }
    }
  };

  mk.moves.KnockDown.prototype._beforeGo = function () {
    this.owner.lock();
  };

  mk.moves.KnockDown.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.KnockDown.prototype._moveNextStep = function () {
    this._currentStep += 1;
  };

  mk.moves.SquatEndure = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.SQUAT_ENDURE);
    this._totalSteps = 3;
  };

  mk.moves.SquatEndure.prototype = new mk.moves.Move();

  mk.moves.SquatEndure.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.SQUAT);
    }
    this.keepDistance();
  };

  mk.moves.SquatEndure.prototype._beforeGo = function () {
    this.owner.lock();
    if (this._bottom === undefined)
      this._bottom = this.owner.getBottom();
  };

  mk.moves.SquatEndure.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.SquatEndure.prototype._moveNextStep = function () {
    this._currentStep += 1;
  };

  mk.moves.SquatEndure.prototype.keepDistance = function () {
    var currentBottom = this.owner.getBottom();
    if (currentBottom > this._bottom) {
      this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
    }
    if (currentBottom < this._bottom) {
      this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
    }
  };


  mk.moves.Jump = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.JUMP, 60);
    this._totalSteps = 6;
    this._moveBack = false;
  };

  mk.moves.Jump.prototype = new mk.moves.Move();

  mk.moves.Jump.prototype._moveNextStep = function () {
    if (!this._moveBack) {
      this._currentStep += 1;
    }
    if (this._moveBack) {
      this._currentStep -= 1;
      if (this._currentStep <= 0) {
        this.stop();
        this.owner.setMove(mk.moves.types.STAND);
      }
    }
    if (this._currentStep >= this._totalSteps) {
      this._moveBack = true;
      this._currentStep -= 1;
    }
  };

  mk.moves.Jump.prototype._action = function () {
    if (!this._moveBack) {
      if (this._currentStep === 0) {
        this.owner.setY(this.owner.getY() + 20);
      } else {
        this.owner.setY(this.owner.getY() - 20);
      }
    } else {
      if (this._currentStep === this._totalSteps - 1) {
        this.owner.setY(this.owner.getY() - 20);
      } else {
        this.owner.setY(this.owner.getY() + 25);
      }
    }
  };

  mk.moves.Jump.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.Jump.prototype._beforeGo = function () {
    this._moveBack = false;
    this.owner.lock();
  };

  mk.moves.ForwardJump = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.FORWARD_JUMP, 80);
    this._totalSteps = 8;
    this._ownerHeight = owner.getVisibleHeight();
  };

  mk.moves.ForwardJump.prototype = new mk.moves.Move();

  mk.moves.ForwardJump.prototype._beforeStop = function () {
    this.owner.unlock();
    this.owner.setHeight(this._ownerHeight);
  };

  mk.moves.ForwardJump.prototype._beforeGo = function () {
    this.owner.lock();
    this.owner.setHeight(this._ownerHeight / 2);
  };

  mk.moves.ForwardJump.prototype._moveNextStep = function () {
    this._currentStep += 1;
    if (this._currentStep >= this._totalSteps) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
    }
  };

  mk.moves.ForwardJump.prototype._action = function () {
    if (this._currentStep > (this._totalSteps - 1) / 2) { //Move down
      this.owner.setY(this.owner.getY() + 26);
      this.owner.setX(this.owner.getX() + 23);
    } else { //Move up
      this.owner.setY(this.owner.getY() - 26);
      this.owner.setX(this.owner.getX() + 23);
    }
  };

  mk.moves.BackwardJump = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.BACKWARD_JUMP, 80);
    this._totalSteps = 8;
    this._ownerHeight = owner.getVisibleHeight();
  };

  mk.moves.BackwardJump.prototype = new mk.moves.Move();

  mk.moves.BackwardJump.prototype._beforeStop = function () {
    this.owner.unlock();
    this.owner.setHeight(this._ownerHeight);
  };

  mk.moves.BackwardJump.prototype._beforeGo = function () {
    this.owner.lock();
    this.owner.setHeight(this._ownerHeight / 2);
  };

  mk.moves.BackwardJump.prototype._moveNextStep = function () {
    this._currentStep += 1;
    if (this._currentStep >= this._totalSteps) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
    }
  };

  mk.moves.BackwardJump.prototype._action = function () {
    if (this._currentStep > (this._totalSteps - 1) / 2) { //Move down
      this.owner.setY(this.owner.getY() + 26);
      this.owner.setX(this.owner.getX() - 23);
    } else { //Move up
      this.owner.setY(this.owner.getY() - 26);
      this.owner.setX(this.owner.getX() - 23);
    }
  };

/* * * * * * * * * * * * * * Standard attacks * * * * * * * * * * * * * * * */

  mk.moves.Attack = function (options) {
    options = options || {};
    mk.moves.Move.call(this,
      options.owner,
      options.type,
      options.duration || 40);
    this._damage = options.damage;
    this._totalSteps = options.steps;
    this._moveBack = false;
    this._hitPassed = false;
    this._returnStand = options.returnStand || mk.moves.types.STAND;
    this._returnStandStep = options.returnStandStep || 0;
  };

  mk.moves.Attack.prototype = new mk.moves.Move();

  mk.moves.Attack.prototype._moveNextStep = function () {
    if (!this._moveBack) {
      this._currentStep += 1;
    }
    if (this._moveBack) {
      this._currentStep -= 1;
      if (this._currentStep <= 0) {
        this.stop();
        this.owner.setMove(this._returnStand, this._returnStandStep);
      }
    }
    if (this._currentStep >= this._totalSteps) {
      if (this._dontReturn) {
        this.stop();
        this.owner.setMove(this._returnStand);
      } else {
        this._moveBack = true;
        this._currentStep -= 1;
      }
    }
  };

  mk.moves.Attack.prototype._action = function () {
    this.keepDistance();
    if (!this._hitPassed &&
      this._currentStep === Math.round(this._totalSteps / 2)) {
      this.owner.attack(this.getDamage());
      this._hitPassed = true;
    }
  };

  mk.moves.Attack.prototype.getDamage = function () {
    return this._damage;
  };

  mk.moves.Attack.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.Attack.prototype._beforeGo = function () {
    this._moveBack = false;
    this._hitPassed = false;
    this.owner.lock();
    this._bottom = this.owner.getBottom();
  };

  mk.moves.Attack.prototype.keepDistance = function () {
    var currentBottom = this.owner.getBottom();
    if (currentBottom > this._bottom) {
      this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
    }
    if (currentBottom < this._bottom) {
      this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
    }
  };

  mk.moves.HighKick = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.HIGH_KICK,
      steps: 7,
      damage: 10
    });
  };

  mk.moves.HighKick.prototype = new mk.moves.Attack();


  mk.moves.LowKick = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.LOW_KICK,
      steps: 6,
      damage: 6
    });
  };

  mk.moves.LowKick.prototype = new mk.moves.Attack();

  mk.moves.LowPunch = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.LOW_PUNCH,
      steps: 5,
      damage: 5
    });
  };

  mk.moves.LowPunch.prototype = new mk.moves.Attack();


  mk.moves.HighPunch = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.HIGH_PUNCH,
      steps: 5,
      damage: 8
    });
  };

  mk.moves.HighPunch.prototype = new mk.moves.Attack();


  mk.moves.Uppercut = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.UPPERCUT,
      steps: 5,
      damage: 13,
      duration: 60
    });
  };

  mk.moves.Uppercut.prototype = new mk.moves.Attack();

  mk.moves.Uppercut.prototype._beforeStop = function () {
    this.owner.unlock();
    this.keepDistance();
  };

  mk.moves.Uppercut.prototype._action = function () {
    this.keepDistance();
    if (!this._hitPassed &&
      this._currentStep === Math.round(this._totalSteps / 2)) {
      this.owner.attack(this.getDamage());
      this._hitPassed = true;
    }
  };

  mk.moves.SquatLowKick = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_LOW_KICK,
      owner: owner,
      steps: 3,
      damage: 4,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatLowKick.prototype = new mk.moves.Attack();

  mk.moves.SquatHighKick = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_HIGH_KICK,
      owner: owner,
      steps: 4,
      damage: 6,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatHighKick.prototype = new mk.moves.Attack();

  mk.moves.SquatLowPunch = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_LOW_PUNCH,
      owner: owner,
      steps: 3,
      damage: 4,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatLowPunch.prototype = new mk.moves.Attack();

  mk.moves.SpinKick = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.SPIN_KICK,
      steps: 8,
      damage: 13,
      duration: 60,
      returnStand: mk.moves.types.STAND
    });
    this._dontReturn = true;
  };

  mk.moves.SpinKick.prototype = new mk.moves.Attack();

  mk.moves.JumpAttack = function (owner, type, damage, isForward) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: type,
      steps: 3,   //to be overriden by the fighter
      damage: damage,
      duration: 80
    });
    this._offset = {
      x: -23,
      y: 26
    };
    if (isForward) {
      this._offset = {
        x: 23,
        y: 26
      };
    }
    this._totalPics = 2;
    this._counter = 0;
  };

  mk.moves.JumpAttack.prototype = new mk.moves.Attack();

  mk.moves.JumpAttack.prototype._moveNextStep = function () {
    this._currentStep += 1;
    this._counter += 1;
    if (this._totalPics <= this._currentStep) {
      this._currentStep = this._totalPics;
    }
    if (this._counter >= this._totalSteps) {
      if (this.owner.getMove().type !== mk.moves.types.WIN) {
        this.stop();
        this.owner.setMove(mk.moves.types.STAND);
        this.owner.setY(mk.config.PLAYER_TOP);
      }
    }
  };

  mk.moves.JumpAttack.prototype._action = function () {
    if (!this._hitPassed &&
      this._currentStep === this._totalPics) {
      this.owner.attack(this.getDamage());
      this._hitPassed = true;
    }
    this.owner.setY(this.owner.getY() + this._offset.y);
    this.owner.setX(this.owner.getX() + this._offset.x);
  };

  mk.moves.JumpAttack.prototype._beforeGo = function () {
    this._hitPassed = false;
    this._counter = 0;
    this.owner.lock();
  };

  mk.moves.JumpKick = function (owner, isForward) {
    var type = mk.moves.types.BACKWARD_JUMP_KICK;
    if (isForward) {
      type = mk.moves.types.FORWARD_JUMP_KICK;
    }
    mk.moves.JumpAttack.call(this, owner, type, 10, isForward);
  };

  mk.moves.JumpKick.prototype = new mk.moves.JumpAttack();

  mk.moves.JumpPunch = function (owner, isForward) {
    var type = mk.moves.types.BACKWARD_JUMP_PUNCH;
    if (isForward) {
      type = mk.moves.types.FORWARD_JUMP_PUNCH;
    }
    mk.moves.JumpAttack.call(this, owner, type, 9, isForward);
  };

  mk.moves.JumpPunch.prototype = new mk.moves.JumpAttack();




/* * * * * * * * * * * * * * End of the standard attacks * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * End of the movements definition * * * * * * * * * * * * * * */



  mk.fighters = {};

  mk.fighters.list = {
    'blitz': true,
    'glut': true
  };

  mk.fighters.orientations = {
    LEFT: 'left',
    RIGHT: 'right'
  };

  mk.fighters.Fighter = function (options) {
    var name = options.name.toLowerCase();
    if (!mk.fighters.list[name]) {
      throw 'Invalid fighter name!';
    }
    this._name = name;
    this._arena = options.arena;
    this._game = options.game;
    this._life = 100;
    this._orientation = options.orientation;
    this._width = mk.config.BODY;
    this._height = 60;
    this._locked = false;
    this._position = {
      x: 50,
      y: mk.config.PLAYER_TOP
    };
    this.init();
  };

  mk.fighters.Fighter.prototype.init = function (callback) {
    this.moves = {};
    this.moves[mk.moves.types.STAND] = new mk.moves.Stand(this);
    this.moves[mk.moves.types.WALK] = new mk.moves.Walk(this);
    this.moves[mk.moves.types.WALK_BACKWARD] = new mk.moves.WalkBack(this);
    this.moves[mk.moves.types.SQUAT] = new mk.moves.Squat(this);
    this.moves[mk.moves.types.BLOCK] = new mk.moves.Block(this);
    this.moves[mk.moves.types.STAND_UP] = new mk.moves.StandUp(this);
    this.moves[mk.moves.types.ATTRACTIVE_STAND_UP] = new mk.moves.AttractiveStandUp(this);
    this.moves[mk.moves.types.HIGH_KICK] = new mk.moves.HighKick(this);
    this.moves[mk.moves.types.LOW_KICK] = new mk.moves.LowKick(this);
    this.moves[mk.moves.types.SPIN_KICK] = new mk.moves.SpinKick(this);
    this.moves[mk.moves.types.LOW_PUNCH] = new mk.moves.LowPunch(this);
    this.moves[mk.moves.types.HIGH_PUNCH] = new mk.moves.HighPunch(this);
    this.moves[mk.moves.types.UPPERCUT] = new mk.moves.Uppercut(this);
    this.moves[mk.moves.types.SQUAT_LOW_KICK] = new mk.moves.SquatLowKick(this);
    this.moves[mk.moves.types.SQUAT_HIGH_KICK] = new mk.moves.SquatHighKick(this);
    this.moves[mk.moves.types.SQUAT_LOW_PUNCH] = new mk.moves.SquatLowPunch(this);
    this.moves[mk.moves.types.FALL] = new mk.moves.Fall(this);
    this.moves[mk.moves.types.KNOCK_DOWN] = new mk.moves.KnockDown(this);
    this.moves[mk.moves.types.WIN] = new mk.moves.Win(this);
    this.moves[mk.moves.types.JUMP] = new mk.moves.Jump(this);
    this.moves[mk.moves.types.FORWARD_JUMP_KICK] = new mk.moves.JumpKick(this, true);
    this.moves[mk.moves.types.BACKWARD_JUMP_KICK] = new mk.moves.JumpKick(this, false);
    this.moves[mk.moves.types.FORWARD_JUMP_PUNCH] = new mk.moves.JumpPunch(this, true);
    this.moves[mk.moves.types.BACKWARD_JUMP_PUNCH] = new mk.moves.JumpPunch(this, false);
    this.moves[mk.moves.types.ENDURE] = new mk.moves.Endure(this);
    this.moves[mk.moves.types.SQUAT_ENDURE] = new mk.moves.SquatEndure(this);
    this.moves[mk.moves.types.FORWARD_JUMP] = new mk.moves.ForwardJump(this);
    this.moves[mk.moves.types.BACKWARD_JUMP] = new mk.moves.BackwardJump(this);

    var self = this,
      initialized = 0,
      total = Object.keys(this.moves).length;

    for (var move in this.moves) {
      this.moves[move].init(function () {
        initialized += 1;
        if (initialized === total) {
          if (typeof callback === 'function') {
            callback();
          }
        }
      });
    }
  };

  mk.fighters.Fighter.prototype.isJumping = function () {
    if (!this._currentMove) return false;
    var move = this._currentMove.type,
      m = mk.moves.types;
    if (move === m.JUMP || move === m.BACKWARD_JUMP ||
      move === m.FORWARD_JUMP || move === m.FORWARD_JUMP_KICK ||
      move === m.BACKWARD_JUMP_KICK || move === m.FORWARD_JUMP_PUNCH ||
      move === m.BACKWARD_JUMP_PUNCH) {
      return true;
    }
    return false;
  };

  mk.fighters.Fighter.prototype.getName = function () {
    return this._name;
  };

  mk.fighters.Fighter.prototype.setArena = function (arena) {
    this._arena = arena;
  };

  mk.fighters.Fighter.prototype.getWidth = function () {
    return mk.config.REACH;
  };

  mk.fighters.Fighter.prototype.getVisibleWidth = function () {
    return this._width;
  };

  mk.fighters.Fighter.prototype.getVisibleHeight = function () {
    if (this._currentState && this._currentState.height) {
      return this._currentState.height;
    }
    return this._height;
  };

  mk.fighters.Fighter.prototype.getVisibleHeight = function () {
    return this._height;
  };

  mk.fighters.Fighter.prototype.setHeight = function (height) {
    this._height = height;
  };

  mk.fighters.Fighter.prototype.setWidth = function (width) {
    this._width = width;
  };

  mk.fighters.Fighter.prototype.setOrientation = function (orientation) {
    this._orientation = orientation;
  };

  mk.fighters.Fighter.prototype.getOrientation = function (orientation) {
    return this._orientation;
  };

  mk.fighters.Fighter.prototype.refresh = function () {};

  mk.fighters.Fighter.prototype.getX = function () {
    return this._position.x;
  };

  mk.fighters.Fighter.prototype.lock = function () {
    this._locked = true;
  };

  mk.fighters.Fighter.prototype.unlock = function () {
    this._locked = false;
    // Gehaltene Tasten nach einer Animation neu auswerten (z.B. Ducken + Schlag = Uppercut)
    var self = this, g = this._game;
    if (!g || this._remote || !g._inputHandler) return;
    clearTimeout(this._recheck);
    this._recheck = setTimeout(function () {
      if (!g.fighters || self._locked) return;
      var i = g.fighters.indexOf(self);
      if (i >= 0 && g._inputHandler) g._inputHandler(i, mk.input.state[i]);
    }, 0);
  };

  mk.fighters.Fighter.prototype.getY = function () {
    return this._position.y;
  };

  mk.fighters.Fighter.prototype.setX = function (x) {
    if (!this._arena || !this._arena.moveFighter) { this._position.x = x; return; }
    this._position.x = this._arena.moveFighter(this, { x: x, y: this.getY() }).x;
  };

  mk.fighters.Fighter.prototype.setY = function (y) {
    this._position.y = y;
  };

  mk.fighters.Fighter.prototype.setState = function (state) {
    this._currentState = state;
  };

  mk.fighters.Fighter.prototype.getState = function () {
    return this._currentState;
  };

  mk.fighters.Fighter.prototype.attack = function (damage) {
    this._game.fighterAttacked(this, damage);
  };

  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    var m = mk.moves.types;
    if (this._remote) damage = 0;

    if (this.getMove().type === m.BLOCK) {
      damage *= mk.config.BLOCK_DAMAGE;
    } else {
      this.unlock();
      if (this.getMove().type === m.SQUAT) {
        this.setMove(m.SQUAT_ENDURE);
      } else {
        if (attackType === m.UPPERCUT ||
          attackType === m.SPIN_KICK) {
          this.setMove(m.KNOCK_DOWN);
        } else {
          this.setMove(m.ENDURE);
        }
      }
    }
    this.setLife(this.getLife() - damage);
    if (this.getLife() === 0 && !this._dead) {
      this._dead = true;
      this._game.fighterDead(this);
      this.unlock();
      this.setMove(mk.moves.types.FALL);
    }
    return this.getLife();
  };

  mk.fighters.Fighter.prototype.setLife = function (life) {
    this._life = Math.max(life, 0);
  };

  mk.fighters.Fighter.prototype.getLife = function () {
    return this._life;
  };

  mk.fighters.Fighter.prototype.getBottom = function () {
    var bottomY = (this._currentState ? this._currentState.height : Figuren.H) + this.getY();
    return 400 - bottomY;
  };

  mk.fighters.Fighter.prototype.setMove = function (move, step) {
    step = step || 0;
    var m = mk.moves.types,
      currentMove = this._currentMove;

    if (!(move in this.moves))
      throw 'This player does not has the move - ' + move;

    if (this._currentMove && this._currentMove.type === move)
      return;

    if (move === m.FORWARD_JUMP_KICK || move === m.BACKWARD_JUMP_KICK ||
      move === m.FORWARD_JUMP_PUNCH || move === m.BACKWARD_JUMP_PUNCH) {
      if (currentMove._currentStep >= currentMove._totalSteps / 2) {
        this._currentMove.stop();
        this.unlock();
        this._currentMove = this.moves[move];
        this._currentMove._totalSteps = currentMove._totalSteps - currentMove._currentStep;
      }
    }

    if (this._locked && move !== m.WIN)
      return;

    if (this._currentMove && typeof this._currentMove.stop === 'function')
      this._currentMove.stop();

    this._currentMove = this.moves[move];
    this._currentMove.go(step);
  };

  mk.fighters.Fighter.prototype.getMove = function () {
    return this._currentMove;
  };

  window.mk = mk;

}());
