// Startposition des Vogels: etwas weiter rechts, damit der "Alle Spiele"-Knopf am linken Rand ihn nicht verdeckt
var BIRD_X = 150;

var game = {
    data: {
        score : 0,
        steps: 0,
        start: false,
        newHiScore: false,
        muted: (function () { try { return localStorage.getItem("clumsy-bird-ton") === "aus"; } catch (e) { return false; } })()
    },

    resources: [
            // images
        {name: "bg", type:"image", src: "data/img/bg.png"},
        {name: "clumsy", type:"image", src: "data/img/clumsy.png"},
        {name: "pipe", type:"image", src: "data/img/pipe.png"},
        {name: "logo", type:"image", src: "data/img/logo.png"},
        {name: "ground", type:"image", src: "data/img/ground.png"},
        {name: "gameover", type:"image", src: "data/img/gameover.png"},
        {name: "gameoverbg", type:"image", src: "data/img/gameoverbg.png"},
        {name: "hit", type:"image", src: "data/img/hit.png"},
        {name: "getready", type:"image", src: "data/img/getready.png"},
        {name: "new", type:"image", src: "data/img/new.png"},
        // sounds
        {name: "theme", type: "audio", src: "data/bgm/"},
        {name: "hit", type: "audio", src: "data/sfx/"},
        {name: "lose", type: "audio", src: "data/sfx/"},
        {name: "wing", type: "audio", src: "data/sfx/"},

    ],

    "onload": function() {
        if (!me.video.init(900, 600, {
            wrapper: "screen",
            scale : "auto",
            scaleMethod: "fit"
        })) {
            document.getElementById("screen").textContent = "Dein Browser unterstützt leider kein HTML5-Canvas.";
            return;
        }
        me.audio.init("mp3");
        if (game.data.muted) me.audio.disable();
        // eigener Ladebildschirm statt dem melonJS-Standardbild
        me.state.set(me.state.LOADING, new game.LoadingScreen());
        me.loader.preload(game.resources, this.loaded.bind(this));
    },

    "loaded": function() {
        me.state.set(me.state.MENU, new game.TitleScreen());
        me.state.set(me.state.PLAY, new game.PlayScreen());
        me.state.set(me.state.GAME_OVER, new game.GameOverScreen());

        me.input.bindKey(me.input.KEY.SPACE, "fly", true);
        me.input.bindKey(me.input.KEY.M, "mute", true);
        me.input.bindPointer(me.input.KEY.SPACE);

        me.pool.register("clumsy", game.BirdEntity);
        me.pool.register("pipe", game.PipeEntity, true);
        me.pool.register("hit", game.HitEntity, true);
        me.pool.register("ground", game.Ground, true);

        me.state.change(me.state.MENU);
    },

    // Ton an/aus (Taste M oder Knopf oben rechts)
    toggleMute: function() {
        game.data.muted = !game.data.muted;
        if (game.data.muted) {
            me.audio.disable();
        } else {
            me.audio.enable();
            if (me.state.isCurrent(me.state.PLAY)) me.audio.play("theme", true);
        }
        try { localStorage.setItem("clumsy-bird-ton", game.data.muted ? "aus" : "an"); } catch (e) {}
        var btn = document.getElementById("ton");
        if (btn) btn.textContent = game.data.muted ? "🔇" : "🔊";
    }
};

// Ladebildschirm: Himmel in Spielfarbe, flatternder Vogel aus Kreisen und ein Ladebalken
game.LoadingScreen = me.ScreenObject.extend({
    onResetEvent: function() {
        me.game.world.addChild(new me.ColorLayer("ladehimmel", "#0099cc", 0), 0);
        var balken = new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, "init", [0, 0, me.game.viewport.width, me.game.viewport.height]);
                this.anchorPoint.set(0, 0);
                this.fortschritt = 0;
                this.zeit = 0;
                this.alwaysUpdate = true;
                this.font = new me.Font("system-ui, sans-serif", 28, "#ffffff", "center");
            },
            onProgressUpdate: function(p) {
                this.fortschritt = p;
                me.game.repaint();
            },
            update: function(dt) {
                this.zeit += dt;
                return true;
            },
            draw: function(renderer) {
                var w = me.game.viewport.width, h = me.game.viewport.height;
                var bw = 360, bh = 18, bx = (w - bw) / 2, by = h / 2 + 50;
                // fillArc erwartet die linke obere Ecke, nicht die Mitte
                var kreis = function(x, y, r) { renderer.fillArc(x - r, y - r, r, 0, Math.PI * 2); };
                // Vogel (gelber Kreis mit Flügel, wippt auf und ab)
                var vx = w / 2, vy = h / 2 - 40 + Math.sin(this.zeit / 180) * 8;
                renderer.setColor("#f7d51d");
                kreis(vx, vy, 26);
                renderer.setColor("#ffffff");
                kreis(vx + 10, vy - 8, 8);
                renderer.setColor("#000000");
                kreis(vx + 13, vy - 8, 3);
                renderer.setColor("#f26b21");
                renderer.fillRect(vx + 18, vy + 2, 16, 7);
                renderer.setColor("#e0b000");
                var fl = Math.sin(this.zeit / 70) * 7;
                renderer.fillRect(vx - 24, vy - 2 + fl, 20, 9);
                // Ladebalken
                renderer.setColor("#006f94");
                renderer.fillRect(bx, by, bw, bh);
                renderer.setColor("#7cc242");
                renderer.fillRect(bx, by, Math.max(2, bw * this.fortschritt), bh);
                this.font.draw(renderer, "Lädt …", w / 2, by + 34);
            }
        }))();
        this.handler = me.event.subscribe(me.event.LOADER_PROGRESS, balken.onProgressUpdate.bind(balken));
        me.game.world.addChild(balken, 1);
    },

    onDestroyEvent: function() {
        me.event.unsubscribe(this.handler);
        this.handler = null;
    }
});
