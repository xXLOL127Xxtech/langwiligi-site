game.BirdEntity = me.Entity.extend({
    init: function(x, y) {
        var settings = {};
        settings.image = 'clumsy';
        settings.width = 85;
        settings.height = 60;

        this._super(me.Entity, 'init', [x, y, settings]);
        this.alwaysUpdate = true;
        this.body.gravity = 0.2;
        this.maxAngleRotation = Number.prototype.degToRad(-30);
        this.maxAngleRotationDown = Number.prototype.degToRad(35);
        this.renderable.addAnimation("flying", [0, 1, 2]);
        this.renderable.addAnimation("idle", [0]);
        this.renderable.setCurrentAnimation("flying");
        //this.renderable.anchorPoint = new me.Vector2d(0.1, 0.5);
        this.body.removeShapeAt(0);
        this.body.addShape(new me.Ellipse(5, 5, 71, 51));

        // Flugphysik: Geschwindigkeit statt Sprung-Tween, damit der Vogel weich nach oben schwingt
        this.velY = 0;
        this.GRAVITY = 0.5;       // Zunahme der Fallgeschwindigkeit pro Bild
        this.FLAP = -8.6;         // Geschwindigkeit nach einem Flügelschlag (nach oben)
        this.MAX_FALL = 11;
        this.currentAngle = 0;
        this.baseY = y;
        this.zeit = 0;

        // end animation tween
        this.endTween = null;

        // collision shape
        this.collided = false;
    },

    update: function(dt) {
        this.pos.x = BIRD_X;
        if (!game.data.start) {
            // vor dem Start leicht auf und ab schweben (nicht während der Absturz-Animation)
            if (!this.endTween) {
                this.zeit += dt;
                this.pos.y = this.baseY + Math.sin(this.zeit / 260) * 8;
            }
            return this._super(me.Entity, 'update', [dt]);
        }
        var tick = Math.min(me.timer.tick, 3);
        if (me.input.isKeyPressed('fly')) {
            me.audio.play('wing');
            this.velY = this.FLAP;
            this.renderable.setAnimationFrame(0);
        } else {
            this.velY = Math.min(this.MAX_FALL, this.velY + this.GRAVITY * tick);
        }
        this.pos.y += this.velY * tick;

        // Neigung folgt der Geschwindigkeit: steigend nach oben, beim Fallen langsam nach unten kippen
        var ziel = this.velY < 1 ?
            this.maxAngleRotation :
            Math.min(this.maxAngleRotationDown, (this.velY - 1) / 6 * this.maxAngleRotationDown);
        var rate = ziel < this.currentAngle ? 0.35 : 0.08;
        this.currentAngle += (ziel - this.currentAngle) * Math.min(1, rate * tick);
        this.renderable.currentTransform.identity();
        this.renderable.currentTransform.rotate(this.currentAngle);
        me.Rect.prototype.updateBounds.apply(this);

        var hitSky = -80; // bird height + 20px
        if (this.pos.y <= hitSky || this.collided) {
            game.data.start = false;
            me.audio.play("lose");
            this.endAnimation();
            return false;
        }
        me.collision.check(this);
        return true;
    },

    onCollision: function(response) {
        var obj = response.b;
        if (obj.type === 'pipe' || obj.type === 'ground') {
            me.device.vibrate(500);
            this.collided = true;
        }
        // remove the hit box
        if (obj.type === 'hit') {
            me.game.world.removeChildNow(obj);
            game.data.steps++;
            me.audio.play('hit');
        }
    },

    endAnimation: function() {
        me.game.viewport.fadeOut("#fff", 100);
        var currentPos = this.pos.y;
        this.endTween = new me.Tween(this.pos);
        this.endTween.easing(me.Tween.Easing.Exponential.InOut);

        this.renderable.currentTransform.identity();
        this.renderable.currentTransform.rotate(Number.prototype.degToRad(90));
        var finalPos = me.game.viewport.height - this.renderable.width/2 - 96;
        this.endTween
            .to({y: currentPos}, 1000)
            .to({y: finalPos}, 1000)
            .onComplete(function() {
                me.state.change(me.state.GAME_OVER);
            });
        this.endTween.start();
    }

});


game.PipeEntity = me.Entity.extend({
    init: function(x, y) {
        var settings = {};
        settings.image = this.image = me.loader.getImage('pipe');
        settings.width = 148;
        settings.height= 1664;
        settings.framewidth = 148;
        settings.frameheight = 1664;

        this._super(me.Entity, 'init', [x, y, settings]);
        this.alwaysUpdate = true;
        this.body.gravity = 0;
        this.body.vel.set(-5, 0);
        this.type = 'pipe';
    },

    update: function(dt) {
        // mechanics
        if (!game.data.start) {
            return this._super(me.Entity, 'update', [dt]);
        }
        this.pos.add(this.body.vel);
        if (this.pos.x < -this.image.width) {
            me.game.world.removeChild(this);
        }
        me.Rect.prototype.updateBounds.apply(this);
        this._super(me.Entity, 'update', [dt]);
        return true;
    },

});

game.PipeGenerator = me.Renderable.extend({
    init: function() {
        this._super(me.Renderable, 'init', [0, me.game.viewport.width, me.game.viewport.height, 92]);
        this.alwaysUpdate = true;
        this.generate = 0;
        this.pipeFrequency = 92;
        this.pipeHoleSize = 1240;
        this.posX = me.game.viewport.width;
    },

    update: function(dt) {
        if (this.generate++ % this.pipeFrequency == 0) {
            var posY = Number.prototype.random(
                    me.video.renderer.getHeight() - 100,
                    200
            );
            var posY2 = posY - me.game.viewport.height - this.pipeHoleSize;
            var pipe1 = new me.pool.pull('pipe', this.posX, posY);
            var pipe2 = new me.pool.pull('pipe', this.posX, posY2);
            var hitPos = posY - 100;
            var hit = new me.pool.pull("hit", this.posX, hitPos);
            pipe1.renderable.currentTransform.scaleY(-1);
            me.game.world.addChild(pipe1, 10);
            me.game.world.addChild(pipe2, 10);
            me.game.world.addChild(hit, 11);
        }
        this._super(me.Entity, "update", [dt]);
    },

});

game.HitEntity = me.Entity.extend({
    init: function(x, y) {
        var settings = {};
        settings.image = this.image = me.loader.getImage('hit');
        settings.width = 148;
        settings.height= 60;
        settings.framewidth = 148;
        settings.frameheight = 60;

        this._super(me.Entity, 'init', [x, y, settings]);
        this.alwaysUpdate = true;
        this.body.gravity = 0;
        this.updateTime = false;
        this.renderable.alpha = 0;
        this.body.accel.set(-5, 0);
        this.body.removeShapeAt(0);
        this.body.addShape(new me.Rect(0, 0, settings.width - 30, settings.height - 30));
        this.type = 'hit';
    },

    update: function(dt) {
        // mechanics
        this.pos.add(this.body.accel);
        if (this.pos.x < -this.image.width) {
            me.game.world.removeChild(this);
        }
        me.Rect.prototype.updateBounds.apply(this);
        this._super(me.Entity, "update", [dt]);
        return true;
    },

});

game.Ground = me.Entity.extend({
    init: function(x, y) {
        var settings = {};
        settings.image = me.loader.getImage('ground');
        settings.width = 900;
        settings.height= 96;
        this._super(me.Entity, 'init', [x, y, settings]);
        this.alwaysUpdate = true;
        this.body.gravity = 0;
        this.body.vel.set(-4, 0);
        this.type = 'ground';
    },

    update: function(dt) {
        // mechanics
        this.pos.add(this.body.vel);
        if (this.pos.x < -this.renderable.width) {
            this.pos.x = me.video.renderer.getWidth() - 10;
        }
        me.Rect.prototype.updateBounds.apply(this);
        return this._super(me.Entity, 'update', [dt]);
    },

});
