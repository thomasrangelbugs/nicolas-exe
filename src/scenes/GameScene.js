import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { VirtualPad } from '../systems/VirtualPad.js';
import { Device } from '../systems/Device.js';
import { setupScene } from '../systems/SceneLifecycle.js';

const LEVELS = {
  1: { name: 'HELLO WORLD', subtitle: 'Recupere o primeiro fragmento da Birthday Build.', theme: 0x071126, accent: 0x37d8ff, goal: 11, boss: false, art: 'art_lv1', music: 'mus_level1' },
  2: { name: 'DEADLINE VALLEY', subtitle: 'Derrote a Procrastinação e recupere o segundo fragmento.', theme: 0x160c1f, accent: 0xff7c55, goal: 14, boss: 'PROCRASTINATION', art: 'art_lv2', music: 'mus_level2', bossKey: 'procrastination' },
  3: { name: 'PRODUCTION', subtitle: 'Vença o Deadline e libere o caminho para o núcleo.', theme: 0x07161b, accent: 0x46f0bd, goal: 16, boss: 'DEADLINE', art: 'art_lv3', music: 'mus_level3', bossKey: 'deadline' },
  4: { name: 'LEGACY CODE', subtitle: 'Destrua o Ultimate Bug e restaure a festa de Nicolas.', theme: 0x17130a, accent: 0xd7b464, goal: 18, boss: 'THE ULTIMATE BUG', art: 'art_lv4', music: 'mus_level4', bossKey: 'ultimate', bossMusic: 'mus_boss_final' }
};

const TYPE_SLUG = {
  Syntax: 'syntax', Runtime: 'runtime', 'Null Pointer': 'null',
  'Memory Leak': 'leak', Legacy: 'legacy', Spaghetti: 'spaghetti'
};

/** Distinct kits: HP, speed, melee, bar color, combat style. */
const ENEMY_KITS = {
  syntax: {
    hpMul: 1.0, speed: 68, sprintMul: 1.55, melee: 10,
    color: 0x6ee7ff, barW: 38, style: 'ranged'
  },
  runtime: {
    hpMul: 0.78, speed: 148, sprintMul: 1.65, melee: 17,
    color: 0xff7c55, barW: 34, style: 'melee'
  },
  null: {
    hpMul: 0.92, speed: 88, sprintMul: 1.7, melee: 19,
    color: 0xbba2ff, barW: 36, style: 'tele_melee'
  },
  leak: {
    hpMul: 1.12, speed: 46, sprintMul: 1.85, melee: 11,
    color: 0x47e899, barW: 40, style: 'platform'
  },
  legacy: {
    hpMul: 1.85, speed: 36, sprintMul: 1.45, melee: 22,
    color: 0xd7b464, barW: 48, style: 'tank'
  },
  spaghetti: {
    hpMul: 0.98, speed: 102, sprintMul: 1.75, melee: 14,
    color: 0xff6b9d, barW: 36, style: 'chaos'
  }
};

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    const level = Number(data?.level);
    this.level = [1, 2, 3, 4].includes(level) ? level : 1;
  }

  create() {
    setupScene(this);
    // Phaser reuses Scene instances. Never retain objects destroyed by shutdown.
    this.checkpoints = null; this.bossArt = null; this.pauseLayer = null;
    this.bossLabel = null; this.bossHp = null; this.bossHpBack = null;
    this.stars = null; this.city = null; this.codeLayer = null;
    this.exitOpen = false; this.bossDefeated = false; this.checkpointPoint = { x: 120, y: 590 };
    this.lastChargeReadySfx = 0; this.toastText = null;
    this.physics.resume();
    this.time.paused = false;
    this.cfg = LEVELS[this.level] || LEVELS[1];
    this.score = 0; this.coffees = 0; this.deaths = 0; this.checkpoint = 0;
    SaveSystem.save({ currentLevel: this.level });
    this.finished = false; this.bossSpawned = false; this.paused = false; this.playerDying = false;
    this.maxHp = 100; this.hp = 100; this.caffeine = 100; this.xp = 0; this.fireCooldown = 0; this.wasOnGround = true;
    this.coyote = 0; this.jumpBuffer = 0; this.airJumps = 1; this.lastBlockSfx = 0; this.lastBlockPush = 0;
    this.airJumpUntil = 0;
    this.chargeMs = 0; this.charging = false; this.attackHeldPrev = false;
    this.physics.world.setBounds(0, 0, 3600, 720);
    this.cameras.main.setBackgroundColor(this.cfg.theme);
    try {
      this.cameras.main.resetFX();
      this.cameras.main.setAlpha(1);
    } catch {}
    this.cameras.main.fadeIn(400, 5, 7, 17);

    this.buildParallax();
    this.buildWorld();
    this.createPlayer();
    this.createGroups();
    this.spawnEnemies();
    this.createHud();
    this.createExit();
    this.setupInput();
    this.setupCollisions();
    this.setupDebug();
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
    this.cameras.main.setBounds(0, 0, 3600, 720);
    // Keep Nicolas inside the visible playfield (esp. mobile rails)
    this.cameras.main.setDeadzone(Device.wantsTouchUI() ? 60 : 140, 48);
    this.cameras.main.setFollowOffset(0, 28);
    this.showLevelTitle();
    AudioSystem.stopSfx(this, 'sfx_typing');
    AudioSystem.playMusic(this, this.cfg.music);
    this.time.addEvent({ delay: 11000, loop: true, callback: () => this.ambientGlitch() });
    VirtualPad.setScene(this);
    Device.applyScaleMode();
    this.events.once('shutdown', () => {
      this.time.paused = false;
      this.anims.resumeAll();
      if (VirtualPad.scene === this) VirtualPad.setScene(null);
    });
  }

  tex(key) { return this.textures.exists(key); }

  playSafe(sprite, key) {
    if (!sprite?.active || !this.anims.exists(key)) return;
    if (sprite.anims?.currentAnim?.key === key && sprite.anims.isPlaying) return;
    sprite.play(key, true);
  }

  spawnFx(x, y, anim, texture) {
    if (!this.anims.exists(anim)) return;
    const s = this.add.sprite(x, y, texture).setDepth(25);
    s.play(anim);
    s.once('animationcomplete', () => s.destroy());
  }

  buildParallax() {
    if (this.tex(this.cfg.art)) {
      this.add.image(640, 360, this.cfg.art).setScrollFactor(0).setDisplaySize(1280, 720).setAlpha(0.82).setDepth(-30);
    }
    // Soft top veil so HUD never fights neon code windows in the art
    this.add.rectangle(640, 56, 1280, 112, 0x050711, 0.55).setScrollFactor(0).setDepth(-5);
    if (this.tex('px_stars')) {
      this.stars = this.add.tileSprite(640, 180, 1280, 256, 'px_stars').setScrollFactor(0).setDepth(-25).setAlpha(0.55);
    }
    if (this.tex('px_city')) {
      this.city = this.add.tileSprite(640, 560, 1280, 180, 'px_city').setScrollFactor(0).setDepth(-24).setAlpha(0.75);
    }
    if (this.tex('px_fog')) {
      this.add.tileSprite(640, 620, 1280, 128, 'px_fog').setScrollFactor(0.12).setDepth(-23).setAlpha(0.4);
    }
    if (this.tex('px_code')) {
      this.codeLayer = this.add.tileSprite(640, 300, 1280, 64, 'px_code').setScrollFactor(0).setDepth(-22).setAlpha(0.18);
    }
    if (this.tex('px_grid')) {
      this.add.tileSprite(640, 360, 1280, 720, 'px_grid').setScrollFactor(0).setDepth(35).setAlpha(0.04);
    }
  }

  buildWorld() {
    this.platforms = this.physics.add.staticGroup();
    const floor = this.tex('tile_floor')
      ? this.add.tileSprite(1800, 704, 3600, 32, 'tile_floor')
      : this.add.rectangle(1800, 690, 3600, 60, 0x10162a);
    floor.isEnemyGround = true;
    this.enemyGround = floor;
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);
    if (floor.body?.updateFromGameObject) floor.body.updateFromGameObject();

    const plats = [
      [320, 560, 260], [720, 475, 250], [1110, 560, 280], [1450, 435, 220],
      [1810, 540, 300], [2200, 410, 250], [2600, 560, 300], [3030, 455, 260], [3380, 560, 260]
    ];
    // Spots for platform-only leaks (skip the first ledge near spawn).
    // halfW keeps feet inside the ledge so they never walk off the edge.
    this.platformSpots = plats
      .filter(([x]) => x >= 700)
      .map(([x, y, w]) => ({ x, y: y - 42, halfW: Math.max(28, w * 0.28) }));
    plats.forEach(([x, y, w], idx) => {
      const p = this.tex('tile_platform')
        ? this.add.tileSprite(x, y, w, 24, 'tile_platform')
        : this.add.rectangle(x, y, w, 24, 0x111830).setStrokeStyle(2, this.cfg.accent, 0.7);
      this.physics.add.existing(p, true);
      this.platforms.add(p);
      if (p.body?.updateFromGameObject) p.body.updateFromGameObject();
      if (idx === 2 || idx === 5 || idx === 7) this.addCheckpoint(x, y - 42, idx);
    });

    const deco = [260, 980, 1680, 2480, 3200];
    deco.forEach((x, i) => {
      const keys = ['tile_terminal', 'tile_chip', 'tile_code', 'tile_panel', 'tile_circuit'];
      const k = keys[i % keys.length];
      if (this.tex(k)) {
        this.add.image(x, 640, k)
          .setDisplaySize(64, 64)
          .setDepth(-1)
          .setAlpha(0.9);
      }
    });

    // Hint only as short toast — not permanent world text that overlaps enemies
    if (this.level === 1 && !Device.wantsTouchUI()) {
      this.time.delayedCall(400, () => this.toast('E: tiro  •  segure E: carga  •  ESPAÇO 2x: pulo duplo'));
    } else if (this.level > 1) {
      this.time.delayedCall(400, () => this.toast('Elimine os bugs, derrote o chefe e alcance o portal.'));
    }
  }

  addCheckpoint(x, y, id) {
    const key = this.tex('item_checkpoint') ? 'item_checkpoint' : 'tile_platform';
    const cp = this.physics.add.staticImage(x, y, key);
    cp.cpId = id;
    if (!this.checkpoints) this.checkpoints = this.physics.add.staticGroup();
    this.checkpoints.add(cp);
    this.add.text(x, y - 40, 'git', { ...Fonts.PIXEL, fontSize: '8px', color: '#6ee7ff' }).setOrigin(0.5);
    if (this.anims.exists('fx-checkpoint')) {
      this.add.sprite(x, y, 'fx_checkpoint').setAlpha(0.5).play('fx-checkpoint');
    }
  }

  createPlayer() {
    const tex = this.tex('player_idle') ? 'player_idle' : (this.tex('player_icon') ? 'player_icon' : 'item_coffee');
    this.player = this.physics.add.sprite(120, 580, tex, 0);
    this.player.setCollideWorldBounds(true).setDragX(900).setMaxVelocity(380, 900);
    this.physics.world.setBoundsCollision(true, true, true, false);
    const source = this.textures.get(tex)?.getSourceImage?.();
    const polishedPlayer = !!source && source.height >= 128;
    this.player.setScale(polishedPlayer ? 0.92 : 2.1);
    this.player.body
      .setSize(polishedPlayer ? 52 : 20, polishedPlayer ? 104 : 44)
      .setOffset(polishedPlayer ? 22 : 14, polishedPlayer ? 17 : 18);
    this.playSafe(this.player, 'player-idle');
    this.player.setDepth(10);
    this.player.setAlpha(1);
    // Soft body aura for charge — not a hand circle
    this.chargeFx = this.add.container(this.player.x, this.player.y).setDepth(9).setVisible(false);
    this.chargeGlow = this.add.ellipse(0, 8, 70, 110, 0x4ce0ff, 0.22);
    this.chargeGlow2 = this.add.ellipse(0, 4, 48, 78, 0xbca5ff, 0.18);
    this.chargeCore = this.add.ellipse(0, 0, 28, 44, 0xffffff, 0.12);
    this.chargeFx.add([this.chargeGlow, this.chargeGlow2, this.chargeCore]);
    for (let i = 0; i < 10; i++) {
      const spark = this.add.circle(0, 0, i < 4 ? 2.4 : 1.6, i % 2 ? 0xe8d6ff : 0x7cf5ff, 0.95);
      spark.orbit = i;
      this.chargeFx.add(spark);
    }
  }

  createGroups() {
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.pickups = this.physics.add.group({ allowGravity: false });
    this.enemyBullets = this.physics.add.group({ allowGravity: false });
  }

  spawnEnemies() {
    const types = Object.keys(TYPE_SLUG).filter(t => t !== 'Memory Leak');
    const floorSpots = [
      [780, 640], [980, 640], [1280, 640], [1580, 640], [1880, 640],
      [2180, 640], [2480, 640], [2780, 640], [3080, 640], [3380, 640]
    ];
    const platSpots = this.platformSpots || [];
    // Late phases soak more hits — weak shots take longer, charged still pays off
    const baseHp = Math.round(88 * (1 + (this.level - 1) * 0.48));

    // 1) Memory Leak (verde) — glued to floating platforms only (never drops to floor)
    platSpots.forEach((spot, i) => {
      const e = this.spawnBug(spot.x, spot.y, baseHp, 'Memory Leak');
      e.onPlatform = true;
      e.patrolMin = spot.x - spot.halfW;
      e.patrolMax = spot.x + spot.halfW;
      e.homeX = spot.x;
      e.homeY = spot.y;
      e.dir = i % 2 === 0 ? 1 : -1;
      e.setBounce(0);
      e.body.setAllowGravity(false);
      e.setVelocity(0, 0);
      e.setPosition(spot.x, spot.y);
    });

    // 2) Floor bugs — never near spawn, never Memory Leak (those stay up top)
    const floorCount = Math.max(6, this.cfg.goal - platSpots.length);
    for (let i = 0; i < floorCount; i++) {
      const [x, y] = floorSpots[i % floorSpots.length];
      const type = types[i % types.length];
      const e = this.spawnBug(x + (i * 37) % 80, y, baseHp, type);
      e.onPlatform = false;
    }

    const loot = [
      [870, 350, 'item_coffee', 'coffee'],
      [1540, 390, 'item_coffee', 'coffee'],
      [3180, 500, 'item_coffee', 'coffee'],
      [1920, 440, 'item_energy', 'energy'],
      [2740, 350, 'item_pizza', 'pizza'],
      [1280, 390, 'item_chocolate', 'chocolate'],
      [2400, 300, 'item_shard', 'shard']
    ];
    loot.forEach(([x, y, key, kind]) => {
      const c = this.pickups.create(x, y, this.tex(key) ? key : 'item_coffee');
      c.setImmovable(true);
      c.setScale(0.78);
      c.kind = kind;
      c.floatTween = this.tweens.add({ targets: c, y: y - 8, duration: 900, yoyo: true, repeat: -1 });
    });
  }

  spawnBug(x, y, hp = 70, type) {
    type = type || Phaser.Math.RND.pick(Object.keys(TYPE_SLUG));
    const slug = TYPE_SLUG[type] || 'syntax';
    const kit = ENEMY_KITS[slug] || ENEMY_KITS.syntax;
    const tex = `en_${slug}`;
    const e = this.enemies.create(x, y, tex);
    e.setBounce(0.05).setCollideWorldBounds(true);
    e.setScale(1.12);
    e.body.setSize(86, 82).setOffset(21, 39);
    e.homeX = x; e.homeY = y; e.defeated = false;
    e.type = type; e.slug = slug; e.role = slug;
    e.lastShot = 0; e.nextSpecial = 0;
    e.nextSprint = 0; e.sprinting = false; e.sprintUntil = 0;
    e.lungeUntil = 0; e.meleeReady = 0;
    e.speed = kit.speed + this.level * (slug === 'runtime' ? 10 : slug === 'legacy' ? 3 : 7);
    e.sprintMul = kit.sprintMul;
    e.meleeDamage = kit.melee + this.level;
    e.hpColor = kit.color;
    e.barW = kit.barW;
    e.style = kit.style;
    e.hp = Math.round(hp * kit.hpMul);
    e.maxHp = e.hp;
    e.dir = Phaser.Math.RND.pick([-1, 1]);
    this.playSafe(e, `en-${slug}-walk`);
    this.attachEnemyHp(e);
    return e;
  }

  createHud() {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(80);
    this.objectiveText = this.add.text(640, 24, '', { ...Fonts.MONO, fontSize: '17px', color: '#aeefff', backgroundColor: '#070c19dd', padding: { x: 10, y: 7 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(80);
    const panel = this.tex('ui_panel')
      ? this.add.image(220, 78, 'ui_panel').setDisplaySize(400, 120)
      : this.add.rectangle(215, 76, 390, 110, 0x050914, 0.92).setStrokeStyle(1, this.cfg.accent, 0.65);
    this.hud.add(panel);
    // Right stats panel — avoids BUGS text sitting on green code art
    const right = this.tex('ui_panel')
      ? this.add.image(1088, 70, 'ui_panel').setDisplaySize(340, 110)
      : this.add.rectangle(1088, 70, 320, 100, 0x050914, 0.92).setStrokeStyle(1, this.cfg.accent, 0.55);
    this.hud.add(right);
    if (this.tex('portrait_icon')) this.hud.add(this.add.image(52, 70, 'portrait_icon').setDisplaySize(52, 52));
    this.hpText = this.add.text(86, 28, 'HP 100/100', { ...Fonts.MONO, fontSize: '18px', color: '#eaf1ff' });
    this.hud.add(this.hpText);
    this.hpBack = this.tex('ui_bar')
      ? this.add.image(86, 58, 'ui_bar').setOrigin(0, 0.5).setDisplaySize(300, 14)
      : this.add.rectangle(86, 58, 300, 14, 0x1a2238).setOrigin(0, 0.5);
    this.hpBar = this.add.rectangle(88, 58, 296, 10, 0x47e899).setOrigin(0, 0.5);
    this.hpFill = this.tex('ui_hp') ? this.add.image(88, 58, 'ui_hp').setOrigin(0, 0.5).setDisplaySize(296, 10) : null;
    this.cafBack = this.add.rectangle(86, 78, 300, 8, 0x1a2238).setOrigin(0, 0.5);
    this.cafBar = this.add.rectangle(86, 78, 300, 8, 0xe8c99a).setOrigin(0, 0.5);
    this.cafFill = this.tex('ui_caf') ? this.add.image(86, 78, 'ui_caf').setOrigin(0, 0.5).setDisplaySize(300, 8) : null;
    this.xpBack = this.add.rectangle(86, 92, 300, 6, 0x1a2238).setOrigin(0, 0.5);
    this.xpBar = this.add.rectangle(86, 92, 0, 6, 0x9b6cff).setOrigin(0, 0.5);
    this.xpFill = this.tex('ui_xp') ? this.add.image(86, 92, 'ui_xp').setOrigin(0, 0.5).setDisplaySize(1, 6) : null;
    this.hud.add([this.hpBack, this.hpBar, this.cafBack, this.cafBar, this.xpBack, this.xpBar]);
    if (this.hpFill) this.hud.add(this.hpFill);
    if (this.cafFill) this.hud.add(this.cafFill);
    if (this.xpFill) this.hud.add(this.xpFill);
    this.cafText = this.add.text(86, 102, 'CAFFEINE 100', { ...Fonts.MONO, fontSize: '14px', color: '#e8c99a' });
    this.hud.add(this.cafText);
    this.levelText = this.add.text(1088, 38, `${this.level}/4`, {
      ...Fonts.MONO, fontSize: '16px', color: '#dbe8ff'
    }).setOrigin(0.5);
    this.hud.add(this.levelText);
    this.levelNameText = this.add.text(1088, 58, this.cfg.name, {
      ...Fonts.MONO, fontSize: '15px', color: '#9fdfff'
    }).setOrigin(0.5);
    this.hud.add(this.levelNameText);
    this.statText = this.add.text(1088, 86, `BUGS 0/${this.cfg.goal}`, {
      ...Fonts.MONO, fontSize: '16px', color: '#79e9ff'
    }).setOrigin(0.5);
    this.hud.add(this.statText);
    this.muteBtn = this.add.text(1240, 24, AudioSystem.muted ? 'M' : '♪', {
      ...Fonts.MONO, fontSize: '20px', color: '#8aa0c8'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.hud.add(this.muteBtn);
    this.muteBtn.setVisible(!Device.wantsTouchUI());
    this.muteBtn.on('pointerdown', () => {
      AudioSystem.toggleMute(this);
      this.muteBtn.setText(AudioSystem.muted ? 'M' : '♪');
    });
  }

  setupInput() {
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys({
        left: 'A', right: 'D', up: 'W', down: 'S',
        jump: 'SPACE', attack: 'E', defend: 'F',
        shift: 'SHIFT', pause: 'ESC', mute: 'M'
      });
      this.cursors = kb.createCursorKeys();
      this.keys.pause.on('down', () => this.togglePause());
      this.keys.mute.on('down', () => {
        AudioSystem.toggleMute(this);
        this.muteBtn?.setText(AudioSystem.muted ? 'M' : '♪');
      });
    } else {
      this.keys = {};
      this.cursors = {};
    }
  }

  held(key) { return !!(key && key.isDown); }
  just(key) { return !!(key && Phaser.Input.Keyboard.JustDown(key)); }

  setupDebug() {
    const debug = new URLSearchParams(location.search).get('debug') === 'true';
    if (!debug || !this.input.keyboard) return;
    this.input.keyboard.on('keydown-F1', () => this.completeLevel());
    this.input.keyboard.on('keydown-F2', () => this.hp = 9999);
    this.input.keyboard.on('keydown-F3', () => this.spawnBug(this.player.x + 240, this.player.y - 100, 40));
    this.input.keyboard.on('keydown-F4', () => this.livingEnemies().forEach(e => this.hitEnemy({ active: true, damage: e.hp, hitSet: new Set(), destroy() {} }, e)));
    this.input.keyboard.on('keydown-F5', () => this.spawnBoss());
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    // Main floor: everyone except platform leaks. Bosses MUST stand on this floor.
    if (this.enemyGround) {
      this.physics.add.collider(this.enemies, this.enemyGround, null, (a, b) => {
        const enemy = a?.slug !== undefined || a?.isBoss || a?.onPlatform !== undefined ? a : b;
        return !enemy?.onPlatform;
      });
    }
    // Floating platforms only: regular floor bugs. Bosses pass through; leaks are pinned.
    this.physics.add.collider(this.enemies, this.platforms, null, (a, b) => {
      const enemy = a?.isBoss !== undefined || a?.slug !== undefined ? a : b;
      if (enemy?.isBoss || enemy?.onPlatform) return false;
      // Skip the main floor object here — it already has its own collider above
      if (b === this.enemyGround || a === this.enemyGround) return false;
      return true;
    });
    this.physics.add.collider(this.pickups, this.platforms);
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.hitEnemy(b, e));
    this.physics.add.overlap(this.player, this.enemies, (_, e) => {
      if (e.defeated || this.finished || this.paused || this.playerDying) return;
      if (this.isBlocking()) this.blockHit(e.x);
      else this.damagePlayer(e.meleeDamage || 12, e.x);
    });
    this.physics.add.overlap(this.player, this.enemyBullets, (_, b) => {
      if (this.finished || this.paused || this.playerDying) return;
      const sourceX = b.x, damage = b.damage || 10;
      b.destroy();
      if (this.isBlocking()) this.blockHit(sourceX);
      else this.damagePlayer(damage, sourceX);
    });
    this.physics.add.overlap(this.player, this.pickups, (_, c) => this.collect(c));
    if (this.checkpoints) this.physics.add.overlap(this.player, this.checkpoints, (_, cp) => this.activateCheckpoint(cp));
  }

  collect(c) {
    if (!c.active) return;
    const kind = c.kind || 'coffee';
    c.destroy();
    this.spawnFx(this.player.x, this.player.y - 20, 'fx-pickup', 'fx_pickup');
    AudioSystem.sfx(this, 'sfx_pickup');
    if (kind === 'coffee') {
      this.caffeine = Math.min(100, this.caffeine + 45);
      this.coffees++;
      this.toast('☕ +45 CAFFEINE');
      if (this.coffees >= 3 || SaveSystem.load().coffees + this.coffees >= 3) {
        this.achievement('coffee_addict', 'COFFEE ADDICT');
      }
    }
    else if (kind === 'energy') { this.caffeine = Math.min(100, this.caffeine + 30); this.hp = Math.min(this.maxHp, this.hp + 10); this.toast('⚡ ENERGY +CAFFEINE +HP'); }
    else if (kind === 'pizza') { this.hp = Math.min(this.maxHp, this.hp + 24); this.toast('🍕 +24 HP'); }
    else if (kind === 'chocolate') { this.hp = Math.min(this.maxHp, this.hp + 15); this.caffeine = Math.min(100, this.caffeine + 15); this.toast('🍫 +HP +CAFFEINE'); }
    else { this.caffeine = Math.min(100, this.caffeine + 20); this.toast('◆ ENERGY SHARD'); }
  }

  update(time, delta) {
    if (this.finished || this.paused || this.playerDying) return;
    if (this.stars) this.stars.tilePositionX = this.cameras.main.scrollX * 0.08;
    if (this.city) this.city.tilePositionX = this.cameras.main.scrollX * 0.22;
    if (this.codeLayer) this.codeLayer.tilePositionX = this.cameras.main.scrollX * 0.4;

    const blocking = this.isBlocking();
    const left = this.held(this.keys.left) || this.held(this.cursors.left) || VirtualPad.left;
    const right = this.held(this.keys.right) || this.held(this.cursors.right) || VirtualPad.right;
    const running = !blocking && (this.held(this.keys.shift) || VirtualPad.run) && this.caffeine > 0;
    const speed = blocking ? 110 : (running ? 330 : 230);
    this.player.setMaxVelocity(speed, 900);
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) {
      this.coyote = 110;
      this.airJumps = 1;
    } else {
      this.coyote = Math.max(0, this.coyote - delta);
    }

    if (left) { this.player.setAccelerationX(-speed * 5); this.player.setFlipX(true); }
    else if (right) { this.player.setAccelerationX(speed * 5); this.player.setFlipX(false); }
    else this.player.setAccelerationX(0);

    const jumpPressed = this.just(this.keys.jump) || this.just(this.keys.up) || this.just(this.cursors.up) || VirtualPad.consume('jump');
    if (jumpPressed) this.jumpBuffer = 140;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.doJump(-540, false);
      this.jumpBuffer = 0;
      this.coyote = 0;
    } else if (this.jumpBuffer > 0 && this.airJumps > 0 && !onGround) {
      this.doJump(-500, true);
      this.jumpBuffer = 0;
      this.airJumps = 0;
      this.airJumpUntil = time + 220;
    }
    const jumpHeld = this.held(this.keys.jump) || this.held(this.keys.up) || this.held(this.cursors.up) || VirtualPad.jumpHeld;
    if (!onGround && !jumpHeld && this.player.body.velocity.y < -180 && time >= this.airJumpUntil) {
      this.player.setVelocityY(-180);
    }
    if (!this.wasOnGround && onGround) AudioSystem.sfx(this, 'sfx_land', { volume: 0.45 });
    this.wasOnGround = onGround;

    this.updateShield(blocking);
    this.updateChargeShot(time, delta, blocking);

    this.pullPickups();

    if (blocking) this.caffeine = Math.max(0, this.caffeine - 6 * delta / 1000);
    else if (running && (left || right)) this.caffeine = Math.max(0, this.caffeine - 9 * delta / 1000);
    else this.caffeine = Math.min(100, this.caffeine + 5 * delta / 1000);

    if (!this.player.hurtLock && !blocking) this.updatePlayerAnim(left || right, running, onGround);

    this.updateBulletTrails(delta);
    this.enemies.children.iterate((e) => this.updateEnemy(e, time));
    this.updateHud();
    if (this.player.y > 760) this.killPlayer();
    this.checkProgress();
  }

  doJump(vy, extra) {
    this.player.setVelocityY(vy);
    AudioSystem.sfx(this, 'sfx_jump', { volume: extra ? 0.85 : 0.7, detune: extra ? 320 : 0 });
    if (this.anims.exists('player-jump')) this.player.play('player-jump', true);
    // O pulo duplo não cria mais o anel que aparecia sob o personagem.
  }

  isBlocking() {
    if (this.playerDying || this.caffeine < 6) return false;
    return this.held(this.keys.defend) || this.held(this.keys.down) || this.held(this.cursors.down) || VirtualPad.defendHeld;
  }

  updateShield(on) {
    if (!this.player?.active) return;
    if (on) {
      this.playSafe(this.player, 'player-defend');
      this.player.setTint(0xffd48a);
      // Defense aura: warm gold diamond (different from cyan charge oval)
      if (!this.defendAura) {
        this.defendAura = this.add.container(0, 0).setDepth(9);
        const diamond = this.add.polygon(0, 4, [0, -52, 34, 0, 0, 52, -34, 0], 0xffb347, 0.16)
          .setStrokeStyle(2, 0xffe566, 0.85);
        const inner = this.add.polygon(0, 4, [0, -28, 18, 0, 0, 28, -18, 0], 0xfff0a8, 0.12);
        const sparkL = this.add.circle(-22, -8, 2.2, 0xffe566, 0.9);
        const sparkR = this.add.circle(22, 10, 2.2, 0xffc14d, 0.9);
        this.defendAura.add([diamond, inner, sparkL, sparkR]);
        this.defendAura._diamond = diamond;
        this.defendAura._inner = inner;
        this.defendAura._sparks = [sparkL, sparkR];
      }
      this.defendAura.setVisible(true);
      this.defendAura.setPosition(this.player.x, this.player.y);
      const pulse = 0.92 + Math.sin(this.time.now / 100) * 0.08;
      this.defendAura.setScale(pulse);
      this.defendAura.setAlpha(0.75 + Math.sin(this.time.now / 140) * 0.15);
      if (this.defendAura._sparks) {
        this.defendAura._sparks.forEach((s, i) => {
          const a = this.time.now / 160 + i * Math.PI;
          s.x = Math.cos(a) * 26;
          s.y = Math.sin(a * 1.3) * 34;
        });
      }
    } else {
      this.defendAura?.setVisible(false);
      if (!this.player.hurtLock && !this.player.attacking) this.player.clearTint();
    }
  }

  blockHit(sourceX) {
    const now = this.time.now;
    if (now - this.lastBlockSfx > 160) {
      this.lastBlockSfx = now;
      AudioSystem.sfx(this, 'sfx_special', { volume: 0.45 });
      this.popup(this.player.x, this.player.y - 28, 'BLOCK', '#7cf5ff');
    }
    if (now - this.lastBlockPush > 220) {
      this.lastBlockPush = now;
      this.player.setVelocityX(this.player.x < sourceX ? -140 : 140);
    }
  }

  updatePlayerAnim(moving, running, onGround) {
    if (this.player.attacking) return;
    if (this.isBlocking()) {
      this.playSafe(this.player, 'player-defend');
      return;
    }
    if (!onGround) this.playSafe(this.player, this.player.body.velocity.y < 0 ? 'player-jump' : 'player-fall');
    else if (moving && running) this.playSafe(this.player, 'player-run');
    else if (moving) this.playSafe(this.player, 'player-walk');
    else this.playSafe(this.player, 'player-idle');
  }

  /** Mega Man style: tap = rapid pellets, hold = charge, release = big piercing orb. */
  updateChargeShot(time, delta, blocking) {
    if (blocking) {
      if (this.charging) {
        this.charging = false;
        this.chargeMs = 0;
        this.updateChargeAura(false);
      }
      this.attackHeldPrev = false;
      return;
    }

    const held = this.held(this.keys.attack) || VirtualPad.attackHeld;

    if (held) {
      if (!this.charging) {
        this.charging = true;
        this.chargeMs = 0;
      }
      this.chargeMs = Math.min(1600, this.chargeMs + delta);
      this.updateChargeAura(true);
      // Soft charge hum near full
      if (this.chargeMs >= 1500 && time - (this.lastChargeReadySfx || 0) > 900) {
        this.lastChargeReadySfx = time;
        AudioSystem.sfx(this, 'sfx_special', { volume: 0.35 });
        this.cameras.main.flash(60, 120, 200, 255);
      }
    } else if (this.charging) {
      // Released — fire by charge level
      const level = this.chargeMs >= 1400 ? 2 : this.chargeMs >= 450 ? 1 : 0;
      this.fireEnergy(time, level);
      this.charging = false;
      this.chargeMs = 0;
      this.updateChargeAura(false);
    } else {
      this.updateChargeAura(false);
    }

    this.attackHeldPrev = held;
  }

  updateChargeAura(on) {
    if (!this.chargeFx || !this.player?.active) return;
    this.chargeFx.setPosition(this.player.x, this.player.y);
    if (!on || this.chargeMs < 120) {
      this.chargeFx.setVisible(false);
      return;
    }
    const t = Phaser.Math.Clamp(this.chargeMs / 1600, 0, 1);
    const pulse = 0.85 + Math.sin(this.time.now / 90) * 0.12;
    this.chargeFx.setVisible(true);
    this.chargeFx.setScale(0.9 + t * 0.55);
    this.chargeFx.setAlpha(0.35 + t * 0.55);
    if (this.chargeGlow) {
      this.chargeGlow.setFillStyle(t > 0.7 ? 0xb58cff : 0x4ce0ff, 0.16 + t * 0.22);
      this.chargeGlow.setScale(pulse);
    }
    if (this.chargeGlow2) this.chargeGlow2.setScale(1.05 + Math.sin(this.time.now / 70) * 0.08);
    if (this.chargeCore) this.chargeCore.setAlpha(0.08 + t * 0.22);
    this.chargeFx.list.forEach((spark) => {
      if (spark === this.chargeGlow || spark === this.chargeGlow2 || spark === this.chargeCore) return;
      const i = spark.orbit ?? 0;
      const a = (i / 10) * Math.PI * 2 + this.time.now / (140 + i * 18);
      const r = (22 + t * 28) * (0.7 + (i % 3) * 0.18);
      spark.x = Math.cos(a) * r * 0.55;
      spark.y = Math.sin(a) * r - 4;
      spark.alpha = 0.35 + t * 0.55;
      spark.setScale(0.7 + t * 0.8);
    });
  }

  spawnMuzzleFlash(x, y, dir, level = 0) {
    const tint = level >= 2 ? 0xc7a5ff : level === 1 ? 0x75f6ff : 0xd8ffff;
    const flash = this.add.container(x + dir * 5, y).setDepth(24);
    const core = this.add.circle(0, 0, level >= 2 ? 11 : level === 1 ? 8 : 5, tint, 0.95);
    const halo = this.add.circle(0, 0, level >= 2 ? 18 : 12, tint, 0.35);
    const ray = this.add.rectangle(dir * (level >= 2 ? 22 : 14), 0, level >= 2 ? 42 : 26, level >= 2 ? 5 : 3, tint, 0.9);
    const ray2 = this.add.rectangle(dir * 14, -6, 18, 2, 0xffffff, 0.95).setAngle(dir * 28);
    const ray3 = this.add.rectangle(dir * 14, 6, 18, 2, 0xffffff, 0.85).setAngle(dir * -28);
    flash.add([halo, core, ray, ray2, ray3]);
    this.tweens.add({
      targets: flash, alpha: 0, scale: level >= 2 ? 2.1 : level === 1 ? 1.7 : 1.4,
      duration: level >= 2 ? 280 : level === 1 ? 180 : 120,
      ease: 'Cubic.easeOut', onComplete: () => flash.destroy()
    });
  }

  fireEnergy(time, level) {
    if (time < this.fireCooldown && level === 0) return;
    // Rapid fire is weaker DPS; charged shots are the real payoff
    this.fireCooldown = time + (level === 0 ? 190 : 320);

    const dir = this.player.flipX ? -1 : 1;
    const scale = this.player.scaleX || 1;
    const muzzleX = this.player.x + dir * (26 * scale);
    const muzzleY = this.player.y - (6 * scale);

    let key = 'bullet';
    let bScale = 1.25;
    let speed = 560;
    let damage = 12;
    let pierce = 0;
    let life = 1000;

    if (level === 1) {
      key = this.tex('bullet_charged') ? 'bullet_charged' : 'bullet';
      bScale = 1.55;
      speed = 500;
      damage = 48;
      pierce = 1;
      life = 1400;
      this.cameras.main.shake(110, 0.006);
    } else if (level === 2) {
      key = this.tex('bullet_mega') ? 'bullet_mega' : (this.tex('bullet_charged') ? 'bullet_charged' : 'bullet');
      bScale = 1.85;
      speed = 460;
      damage = 125;
      pierce = 4;
      life = 1800;
      this.caffeine = Math.max(0, this.caffeine - 6);
      this.cameras.main.shake(220, 0.012);
      this.cameras.main.flash(90, 160, 210, 255);
    }

    if (!this.tex(key)) key = this.tex('bullet') ? 'bullet' : 'bullet_enemy';

    const b = this.bullets.create(muzzleX, muzzleY, key);
    b.setDepth(20);
    b.setScale(bScale);
    b.setAlpha(1);
    b.body.setAllowGravity(false);
    const bw = Math.max(14, (b.displayWidth || 16) * 0.55);
    const bh = Math.max(14, (b.displayHeight || 16) * 0.55);
    b.body.setSize(bw / (b.scaleX || 1), bh / (b.scaleY || 1));
    b.setVelocityX(dir * speed);
    b.damage = damage;
    b.pierce = pierce;
    b.hitSet = new Set();
    b.level = level;
    b.trailAcc = 0;
    this.spawnMuzzleFlash(muzzleX, muzzleY, dir, level);
    if (level >= 2 && this.anims.exists('bullet-mega') && key === 'bullet_mega') b.play('bullet-mega');
    else if (level >= 1 && this.anims.exists('bullet-charged') && key === 'bullet_charged') b.play('bullet-charged');
    else if (level === 0) {
      // Soft pulse on basic orb
      this.tweens.add({ targets: b, scaleX: bScale * 1.15, scaleY: bScale * 1.15, yoyo: true, duration: 90, repeat: 2 });
    }

    this.player.attacking = true;
    this.playSafe(this.player, 'player-attack');
    this.time.delayedCall(480, () => { if (this.player.active) this.player.attacking = false; });

    AudioSystem.sfxExclusive(this, level >= 2 ? 'sfx_attack' : 'sfx_shoot', { volume: level >= 1 ? 0.75 : 0.5 });
    this.time.delayedCall(life, () => b.active && b.destroy());
  }

  // legacy alias
  shoot(time) { this.fireEnergy(time, 0); }

  updateBulletTrails(delta) {
    this.bullets?.children?.iterate?.((b) => {
      if (!b?.active) return;
      b.trailAcc = (b.trailAcc || 0) + delta;
      const every = b.level >= 2 ? 28 : b.level >= 1 ? 36 : 48;
      if (b.trailAcc < every) return;
      b.trailAcc = 0;
      const tint = b.level >= 2 ? 0xc7a5ff : b.level >= 1 ? 0x62efff : 0xb8ffff;
      const spark = this.add.circle(b.x, b.y, b.level >= 2 ? 5 : b.level >= 1 ? 3.5 : 2.2, tint, 0.75).setDepth(19);
      this.tweens.add({
        targets: spark,
        alpha: 0,
        scale: 0.2,
        x: spark.x - Math.sign(b.body?.velocity?.x || 1) * 10,
        duration: b.level >= 1 ? 220 : 140,
        onComplete: () => spark.destroy()
      });
    });
  }

  updateEnemy(e, time) {
    if (!e || !e.active || e.defeated || !e.body?.enable) return;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.y > 750 || e.y < -100) {
      const hx = e.homeX || 3100;
      const hy = e.onPlatform && Number.isFinite(e.homeY) ? e.homeY : Math.min(e.homeY || 580, 580);
      e.body.reset(hx, hy);
      e.setVelocity(0, 0);
    }
    this.syncEnemyHp(e);
    if (e.isBoss) { this.updateBoss(e, time); return; }

    const dist = this.player.x - e.x;
    const abs = Math.abs(dist);
    const onCam = this.cameras.main.worldView.contains(e.x, e.y);
    const role = e.role || e.slug || 'syntax';
    const cur = e.anims?.currentAnim?.key || '';
    const busy = e.anims.isPlaying && (cur.includes('attack') || cur.includes('hurt') || cur.includes('death'));

    // Platform Memory Leaks — lob green rain + occasional scare sprint on the ledge
    if (e.onPlatform || role === 'leak') {
      e.onPlatform = true;
      e.body.setAllowGravity(false);
      const minX = Number.isFinite(e.patrolMin) ? e.patrolMin : (e.homeX || e.x) - 40;
      const maxX = Number.isFinite(e.patrolMax) ? e.patrolMax : (e.homeX || e.x) + 40;
      const homeY = Number.isFinite(e.homeY) ? e.homeY : e.y;
      if (e.x <= minX + 2) e.dir = 1;
      if (e.x >= maxX - 2) e.dir = -1;
      // Face player when raining
      if (onCam && abs < 520) e.dir = Math.sign(dist) || e.dir;
      this.tickEnemySprint(e, time, abs, { chance: 6, minDist: 80, maxDist: 560, dur: [320, 520] });
      const vx = (!onCam && abs > 720) ? 0 : e.dir * this.enemyMoveSpeed(e);
      e.setVelocity(vx, 0);
      e.setPosition(Phaser.Math.Clamp(e.x, minX, maxX), homeY);
      e.setFlipX(e.dir < 0);
      if (!busy) this.playSafe(e, `en-${e.slug || 'leak'}-walk`);
      const rainGap = 2800 - this.level * 80;
      if (onCam && abs < 640 && time - e.lastShot > rainGap) {
        e.lastShot = time;
        const aimX = this.player.x - e.x;
        const shotVx = Phaser.Math.Clamp(aimX * 0.6, -240, 240);
        this.fireEnemyShot(e, dist, Math.abs(shotVx) < 40 ? 90 : Math.abs(shotVx), -300, {
          gravityY: 800, damage: 12 + this.level, scale: 1.15, tint: 0x7dff6a
        });
        this.fireEnemyShot(e, dist, Math.abs(shotVx) < 40 ? 140 : Math.abs(shotVx) + 50, -210, {
          gravityY: 780, damage: 10 + this.level, scale: 0.95, tint: 0xb8ff7a
        });
      }
      return;
    }

    if (!onCam && abs > 740) { e.setVelocityX(0); return; }
    if ((e.body.blocked.left && e.dir < 0) || (e.body.blocked.right && e.dir > 0)) e.dir *= -1;

    if (role === 'runtime') {
      // Pure melee hunter — no shots, closes in and lunges
      if (abs < 780) e.dir = Math.sign(dist) || 1;
      this.tickEnemySprint(e, time, abs, { chance: 12, minDist: 90, maxDist: 520, dur: [420, 680] });
      if (onCam && abs > 70 && abs < 220 && time > e.lungeUntil && time > e.nextSpecial) {
        e.nextSpecial = time + 3000;
        e.lungeUntil = time + 420;
        e.sprinting = true;
        e.sprintUntil = e.lungeUntil;
        this.playSafe(e, `en-${e.slug}-attack`);
        AudioSystem.sfx(this, 'sfx_glitch', { volume: 0.28 });
      }
      const boost = time < e.lungeUntil ? 1.35 : 1;
      e.setVelocityX(e.dir * this.enemyMoveSpeed(e) * boost);
    } else if (role === 'null') {
      // Teleport assassin — only hits up close, never shoots
      e.dir = Math.sign(dist) || e.dir;
      this.tickEnemySprint(e, time, abs, { chance: 5, minDist: 60, maxDist: 300, dur: [280, 420] });
      if (time < e.lungeUntil) {
        e.setVelocityX(e.dir * this.enemyMoveSpeed(e) * 1.4);
      } else {
        e.setVelocityX(e.dir * this.enemyMoveSpeed(e) * 0.55);
      }
      if (onCam && abs < 560 && time > e.nextSpecial) {
        e.nextSpecial = time + Phaser.Math.Between(3000, 4200);
        const side = Math.sign(dist || 1) || 1;
        const nx = Phaser.Math.Clamp(this.player.x - side * Phaser.Math.Between(48, 78), 50, 3550);
        e.setPosition(nx, Math.min(e.y, this.player.y + 10));
        e.dir = Math.sign(this.player.x - e.x) || e.dir;
        e.lungeUntil = time + 520;
        e.setAlpha(0.25);
        this.tweens.add({ targets: e, alpha: 1, duration: 180 });
        this.playSafe(e, `en-${e.slug}-attack`);
        AudioSystem.sfx(this, 'sfx_glitch', { volume: 0.32 });
        this.spawnFx(e.x, e.y - 10, 'fx-glitch', 'fx_glitch');
      }
    } else if (role === 'legacy') {
      // Tank — fat HP, slow bolts, rare stomp-rush
      if (abs < 620) e.dir = Math.sign(dist) || 1;
      this.tickEnemySprint(e, time, abs, { chance: 4, minDist: 120, maxDist: 400, dur: [320, 500] });
      e.setVelocityX(e.dir * this.enemyMoveSpeed(e));
      if (onCam && abs < 460 && time - e.lastShot > 3400 - this.level * 60) {
        e.lastShot = time;
        const b = this.fireEnemyShot(e, dist, 150 + this.level * 8, 0, {
          damage: 15 + this.level, scale: 1.7, tint: 0xd7b464, life: 3200
        });
        if (b) b.setTint(0xe8c878);
      }
      if (onCam && abs < 280 && abs > 90 && time > e.nextSpecial) {
        e.nextSpecial = time + 4200;
        e.sprinting = true;
        e.sprintUntil = time + 500;
        this.playSafe(e, `en-${e.slug}-special`);
        AudioSystem.sfx(this, 'sfx_enemy_shot', { volume: 0.35 });
      }
    } else if (role === 'spaghetti') {
      // Chaos — zig-zag + scatter bolts + panic dash
      if (time > e.nextSpecial) {
        e.nextSpecial = time + Phaser.Math.Between(260, 480);
        e.dir = Phaser.Math.RND.pick([-1, 1]);
        if (abs < 340 && Phaser.Math.Between(0, 100) < 40) e.dir = Math.sign(dist) || e.dir;
        if (Phaser.Math.Between(0, 100) < 30) e.y = e.homeY - Phaser.Math.Between(12, 34);
      }
      e.y += (e.homeY - e.y) * 0.1;
      this.tickEnemySprint(e, time, abs, { chance: 8, minDist: 100, maxDist: 480, dur: [360, 580] });
      e.setVelocityX(e.dir * this.enemyMoveSpeed(e));
      if (onCam && abs < 360 && time - e.lastShot > 2600 - this.level * 50) {
        e.lastShot = time;
        [-70, 0, 70].forEach((ang, i) => {
          const rad = Phaser.Math.DegToRad(ang);
          this.spawnEnemyProjectile(
            e.x, e.y,
            Math.sign(dist || 1) * (190 + i * 20) * Math.cos(rad * 0.4),
            Math.sin(rad) * 140 + Phaser.Math.Between(-40, 40),
            { damage: 11 + this.level, scale: 0.85, tint: 0xff6b9d, life: 2400 }
          );
        });
        this.playSafe(e, `en-${e.slug}-attack`);
        AudioSystem.sfx(this, 'sfx_enemy_shot', { volume: 0.4 });
      }
    } else {
      // Syntax — classic mid-range shooter, keeps distance, scare-rush sometimes
      if (abs < 560) {
        if (abs < 160) e.dir = -Math.sign(dist) || e.dir; // back off
        else if (abs > 300) e.dir = Math.sign(dist) || 1;
      }
      this.tickEnemySprint(e, time, abs, { chance: 7, minDist: 150, maxDist: 500, dur: [360, 560] });
      e.setVelocityX(e.dir * this.enemyMoveSpeed(e));
      const fireGap = this.level === 1 ? 3000 : 2600 - this.level * 50;
      if (onCam && abs < 380 && abs > 70 && time - e.lastShot > fireGap) {
        e.lastShot = time;
        this.fireEnemyShot(e, dist, 230 + this.level * 10, 0, {
          damage: 11 + this.level, tint: 0x6ee7ff
        });
      }
    }

    e.setFlipX(e.dir < 0);
    if (!busy) this.playSafe(e, `en-${e.slug}-walk`);
  }

  enemyMoveSpeed(e) {
    const base = e.speed || 70;
    if (e.sprinting && this.time.now < e.sprintUntil) return base * (e.sprintMul || 1.55);
    return base;
  }

  tickEnemySprint(e, time, abs, opts = {}) {
    if (e.sprinting && time >= e.sprintUntil) e.sprinting = false;
    if (e.sprinting) return;
    const chance = opts.chance ?? 10;
    const minD = opts.minDist ?? 120;
    const maxD = opts.maxDist ?? 480;
    if (abs < minD || abs > maxD || time < e.nextSprint) return;
    if (Phaser.Math.Between(0, 100) > chance) {
      e.nextSprint = time + 400;
      return;
    }
    const [d0, d1] = opts.dur || [400, 650];
    e.sprinting = true;
    e.sprintUntil = time + Phaser.Math.Between(d0, d1);
    e.nextSprint = time + Phaser.Math.Between(3200, 5200);
    e.setTintFill(0xffffff);
    this.time.delayedCall(70, () => e.active && !e.defeated && e.clearTint());
  }

  spawnEnemyProjectile(x, y, vx, vy, options = {}) {
    const key = this.tex(options.texture || 'bullet_enemy') ? (options.texture || 'bullet_enemy') : 'bullet_enemy';
    const b = this.enemyBullets.create(x, y, key);
    const gravityY = options.gravityY || 0;
    b.body.setAllowGravity(gravityY !== 0);
    if (gravityY) b.body.setGravityY(gravityY);
    b.setVelocity(vx, vy);
    b.setScale(options.scale || 1);
    if (options.tint) b.setTint(options.tint);
    b.damage = options.damage || 10;
    const bw = Math.max(10, (b.width || 18) * 0.58);
    const bh = Math.max(8, (b.height || 12) * 0.58);
    b.body.setSize(bw, bh).setOffset((b.width - bw) / 2, (b.height - bh) / 2);
    this.time.delayedCall(options.life || 3000, () => b.active && b.destroy());
    return b;
  }

  fireEnemyShot(e, dist, speedX, speedY, options = {}) {
    this.playSafe(e, `en-${e.slug}-attack`);
    AudioSystem.sfx(this, 'sfx_enemy_shot', { volume: 0.45 });
    return this.spawnEnemyProjectile(e.x, e.y, Math.sign(dist || 1) * speedX, speedY || 0, options);
  }

  hitEnemy(b, e) {
    if (this.finished || this.paused || !b?.active || !e?.active || e.defeated || !e.body?.enable) return;
    if (!b.hitSet) b.hitSet = new Set();
    if (b.hitSet.has(e)) return;
    b.hitSet.add(e);

    const baseDamage = b.damage || 12;
    const shotLv = b.level || 0;
    // Bosses shrug off weak pellets; fully charged hits hard
    let mult = 1;
    if (e.isBoss) {
      if (shotLv <= 0) mult = 0.32;
      else if (shotLv === 1) mult = 0.75;
      else mult = 1.2;
      if (e.vulnerable) mult *= 1.25;
    } else if (shotLv <= 0) {
      mult = 0.85; // regular bugs still tank spam a bit
    } else if (shotLv >= 2) {
      mult = 1.15;
    }
    const dmg = Math.max(1, Math.round(baseDamage * mult));
    e.hp -= dmg;
    this.popup(e.x, e.y - 26, `-${dmg}`, e.isBoss && e.vulnerable ? '#fff0a8' : (shotLv >= 2 ? '#e0b0ff' : '#7cf5ff'));
    this.showEnemyHp(e);
    this.spawnFx(e.x, e.y, 'fx-impact', 'fx_impact');
    AudioSystem.sfx(this, e.isBoss ? 'sfx_boss_hit' : 'sfx_hit', { volume: 0.6 });
    this.playSafe(e, e.isBoss ? `boss-${e.bossKey}-hurt` : `en-${e.slug}-hurt`);
    e.setTintFill(0xffffff);
    this.time.delayedCall(70, () => e.active && e.clearTint());
    this.cameras.main.shake(b.level >= 2 ? 90 : 50, b.level >= 2 ? 0.004 : 0.002);

    const pierce = b.pierce || 0;
    if (pierce > 0) {
      b.pierce = pierce - 1;
    } else {
      b.destroy();
    }

    if (e.hp <= 0) {
      e.defeated = true;
      e.setVelocity(0, 0);
      const boss = e.isBoss;
      this.spawnFx(e.x, e.y, boss ? 'fx-boss-explode' : 'fx-explosion', boss ? 'fx_boss_explode' : 'fx_explosion');
      AudioSystem.sfx(this, boss ? 'sfx_explosion' : 'sfx_enemy_death');
      this.playSafe(e, boss ? `boss-${e.bossKey}-death` : `en-${e.slug}-death`);
      e.body.enable = false;
      e.hpBar?.destroy();
      e.hpBarBg?.destroy();
      this.tweens.add({ targets: e, alpha: 0, y: e.y + 15, duration: boss ? 700 : 350, onComplete: () => e.active && e.destroy() });
      this.score++; this.xp = Math.min(100, this.xp + (boss ? 40 : 12));
      this.toast(boss ? 'BOSS FIXED' : `${e.type || 'Bug'} fixed.`);
      if (this.score === 1) this.achievement('first_bug', 'FIRST BUG');
      if (boss) {
        if (e.bossKey === 'ultimate') this.achievement('debugger', 'THE DEBUGGER');
        this.bossDefeated = true;
        this.enemyBullets.clear(true, true);
        this.bossHp?.setVisible(false); this.bossHpBack?.setVisible(false); this.bossLabel?.setVisible(false);
        this.time.delayedCall(800, () => this.openExit());
      }
    }
  }

  damagePlayer(amount, sourceX) {
    if (this.finished || this.paused || this.player.invuln || this.playerDying) return;
    if (this.isBlocking()) {
      this.blockHit(sourceX);
      return;
    }
    this.hp -= amount;
    this.player.invuln = true;
    this.player.hurtLock = true;
    this.playSafe(this.player, 'player-hurt');
    this.player.setTintFill(0xff5577);
    this.player.setVelocityX(this.player.x < sourceX ? -300 : 300);
    this.cameras.main.shake(120, 0.006);
    AudioSystem.sfx(this, 'sfx_hurt');
    // O flash vermelho e o knockback já comunicam o dano sem um anel no chão.
    this.time.delayedCall(900, () => {
      if (this.player.active) { this.player.invuln = false; this.player.hurtLock = false; this.player.clearTint(); }
    });
    if (this.hp <= 0) this.killPlayer();
  }

  killPlayer() {
    if (this.playerDying || this.finished) return;
    this.playerDying = true;
    this.charging = false; this.chargeMs = 0; this.updateChargeAura(false);
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    this.player.body.enable = false;
    this.enemyBullets.clear(true, true);
    VirtualPad.reset();
    this.defendAura?.setVisible(false);
    this.chargeFx?.setVisible(false);
    this.deaths++;
    SaveSystem.save({ deaths: SaveSystem.load().deaths + 1 });
    this.playSafe(this.player, 'player-death');
    AudioSystem.sfx(this, AudioSystem.has(this, 'sfx_death') ? 'sfx_death' : 'sfx_gameover');
    this.showGameOverFlash();
    this.time.delayedCall(900, () => {
      this.hp = this.maxHp;
      this.player.body.enable = true;
      this.player.body.reset(this.checkpointPoint.x, this.checkpointPoint.y);
      this.player.setVelocity(0, 0).setAcceleration(0, 0);
      this.player.hurtLock = false; this.player.clearTint();
      this.player.invuln = true; this.caffeine = Math.max(60, this.caffeine);
      this.time.delayedCall(1600, () => { if (this.player.active) this.player.invuln = false; });
      this.playerDying = false;
      this.playSafe(this.player, 'player-idle');
      this.toast(Phaser.Math.RND.pick(['SEGMENTATION FAULT', 'UNHANDLED EXCEPTION', 'TASK FAILED SUCCESSFULLY', 'NICOLAS.EXE STOPPED WORKING']));
    });
  }

  showGameOverFlash() {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(90);
    if (this.tex('art_gameover')) overlay.add(this.add.image(640, 360, 'art_gameover').setDisplaySize(1280, 720).setAlpha(0.55));
    else if (this.tex('ui_gameover')) overlay.add(this.add.image(640, 360, 'ui_gameover').setDisplaySize(640, 280).setAlpha(0.9));
    overlay.add(this.add.text(640, 320, 'EXCEPTION', { ...Fonts.PIXEL, fontSize: '22px', color: '#ff7ea0' }).setOrigin(0.5));
    this.tweens.add({ targets: overlay, alpha: 0, delay: 500, duration: 400, onComplete: () => overlay.destroy() });
  }

  activateCheckpoint(cp) {
    if (cp.used) return;
    cp.used = true;
    this.checkpoint = cp.x;
    this.checkpointPoint = { x: cp.x, y: cp.y - 52 };
    AudioSystem.sfx(this, 'sfx_checkpoint');
    this.spawnFx(cp.x, cp.y, 'fx-pickup', 'fx_pickup');
    this.toast('git commit -m "checkpoint reached"');
    const used = this.children.list.filter((o) => o.cpId !== undefined && o.used).length;
    if (used >= 3) this.achievement('git_good', 'GIT GOOD');
  }

  spawnBoss() {
    if (this.bossSpawned || !this.cfg.boss || this.finished) return;
    this.bossSpawned = true;
    this.hp = Math.max(this.hp, 70);
    this.caffeine = Math.max(this.caffeine, 70);
    if (this.tex('art_boss') && !this.bossArt) {
      this.bossArt = this.add.image(640, 360, 'art_boss').setScrollFactor(0).setDisplaySize(1280, 720).setAlpha(0).setDepth(-20);
      this.tweens.add({ targets: this.bossArt, alpha: 0.55, duration: 500 });
    }
    const key = this.cfg.bossKey || 'ultimate';
    const tex = `boss_${key}`;
    const worldW = this.physics.world.bounds.width;
    const x = Phaser.Math.Clamp(this.player.x + (this.player.x > 2700 ? -460 : 460), 220, worldW - 240);
    const e = this.enemies.create(x, 560, tex);
    e.homeX = x; e.homeY = 560; e.defeated = false;
    e.isBoss = true; e.bossKey = key;
    // Distinct boss HP pools — later bosses soak more charged shots
    const bossHp = {
      procrastination: 480 + this.level * 90,
      deadline: 620 + this.level * 110,
      ultimate: 820 + this.level * 140
    };
    e.hp = bossHp[key] || 600 + this.level * 120;
    e.maxHp = e.hp;
    e.speed = (key === 'deadline' ? 72 : key === 'ultimate' ? 64 : 48) + this.level * 8;
    e.meleeDamage = key === 'ultimate' ? 24 : key === 'deadline' ? 20 : 16;
    e.hpColor = key === 'deadline' ? 0x46f0bd : key === 'ultimate' ? 0xd7b464 : 0xff7c55;
    e.lastShot = this.time.now + 1100;
    e.nextJump = 0;
    e.nextSprint = 0;
    e.sprinting = false;
    e.sprintUntil = 0;
    e.sprintMul = 1.5;
    e.attackPattern = 0;
    e.attackOpenUntil = 0;
    e.vulnerable = false;
    e.dir = -1;
    e.setCollideWorldBounds(true);
    e.body.setAllowGravity(true);
    e.setBounce(0);
    e.setScale(0.88);
    // Feet sit on the main floor; keep hitbox readable for player shots
    e.body.setSize(140, 160).setOffset(58, 72);
    this.playSafe(e, `boss-${key}-intro`);
    this.time.delayedCall(700, () => this.playSafe(e, `boss-${key}-idle`));
    AudioSystem.playMusic(this, this.cfg.bossMusic || 'mus_boss');
    AudioSystem.sfx(this, 'sfx_special');
    this.toast(`BOSS: ${this.cfg.boss}`);
    this.bossLabel = this.add.text(640, 110, this.cfg.boss, {
      ...Fonts.PIXEL, fontSize: '14px', color: '#ff7ea0', backgroundColor: '#070914aa', padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60);
    this.bossHpBack = this.add.rectangle(640, 148, 420, 10, 0x1a2238).setScrollFactor(0).setDepth(60);
    this.bossHp = this.add.rectangle(430, 148, 420, 10, e.hpColor).setOrigin(0, 0.5).setScrollFactor(0).setDepth(61);
    this.cameras.main.flash(250, 180, 40, 80);
    this.cameras.main.shake(200, 0.008);
  }

  fireBossPattern(e, time) {
    const key = e.bossKey || 'ultimate';
    this.playSafe(e, `boss-${key}-attack`);
    AudioSystem.sfx(this, 'sfx_boss_shot', { volume: 0.5 });
    if (key === 'procrastination') this.bossKitProcrastination(e, time);
    else if (key === 'deadline') this.bossKitDeadline(e, time);
    else this.bossKitUltimate(e, time);

    e.attackOpenUntil = time + (key === 'deadline' ? 620 : key === 'ultimate' ? 700 : 820);
    e.vulnerable = true;
    e.setTint(0x9ffcff);
    this.time.delayedCall(e.attackOpenUntil - time, () => {
      if (e.active && !e.defeated) { e.vulnerable = false; e.clearTint(); }
    });
  }

  bossKitProcrastination(e, time) {
    // Lazy delay, then a messy cone — “amanhã eu faço”
    const pattern = e.attackPattern++ % 3;
    if (pattern === 0) {
      this.time.delayedCall(280, () => {
        if (!e.active || e.defeated) return;
        const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
        for (let i = -2; i <= 2; i++) {
          const a = angle + i * 0.2;
          this.spawnEnemyProjectile(e.x, e.y, Math.cos(a) * 220, Math.sin(a) * 220, {
            texture: 'bullet_debug', damage: 11, scale: 1.0, tint: 0xff7c55
          });
        }
      });
    } else if (pattern === 1) {
      // Slow “I’ll get to it” lob toward player
      for (let i = 0; i < 2; i++) {
        this.spawnEnemyProjectile(e.x, e.y, (this.player.x - e.x) * 0.35 + (i ? 40 : -40), -360 - i * 40, {
          texture: 'bullet_charged', gravityY: 480, damage: 13, scale: 1.05, tint: 0xff9a6b, life: 3600
        });
      }
    } else {
      // Sudden “ok fine” dash window + side bolts
      e.sprinting = true;
      e.sprintUntil = time + 560;
      [-1, 1].forEach(side => this.spawnEnemyProjectile(e.x, e.y, side * 260, 40, {
        texture: 'bullet_enemy', damage: 12, scale: 1.0, tint: 0xff7c55
      }));
    }
  }

  bossKitDeadline(e, time) {
    // Aggressive clock pressure — rain + rapid bursts
    const pattern = e.attackPattern++ % 3;
    const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
    if (pattern === 0) {
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 110, () => {
          if (!e.active || e.defeated) return;
          const a = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
          this.spawnEnemyProjectile(e.x, e.y, Math.cos(a) * 340, Math.sin(a) * 340, {
            texture: i === 2 ? 'bullet_mega' : 'bullet_enemy', damage: 14, scale: i === 2 ? 1.2 : 0.85, tint: 0x46f0bd
          });
        });
      }
    } else if (pattern === 1) {
      [-160, -60, 60, 160].forEach((offset, i) => {
        this.spawnEnemyProjectile(e.x, e.y, Phaser.Math.Clamp((this.player.x + offset - e.x) * 0.48, -280, 280), -430 - i * 25, {
          texture: 'bullet_charged', gravityY: 560, damage: 13, scale: 0.9, tint: 0x7affd0, life: 3600
        });
      });
    } else {
      // Closing pressure: ring + chase sprint
      for (let i = 0; i < 6; i++) {
        const a = angle + (i / 6) * Math.PI * 2;
        this.spawnEnemyProjectile(e.x, e.y, Math.cos(a) * 210, Math.sin(a) * 210, {
          texture: 'bullet_debug', damage: 12, scale: 0.8, tint: 0x46f0bd
        });
      }
      e.sprinting = true;
      e.sprintUntil = time + 640;
    }
  }

  bossKitUltimate(e, time) {
    // Mix of everything — the bug that outlived every commit
    const pattern = e.attackPattern++ % 4;
    const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
    if (pattern === 0) {
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.16;
        this.spawnEnemyProjectile(e.x, e.y, Math.cos(a) * 270, Math.sin(a) * 270, {
          texture: 'bullet_debug', damage: 13, scale: i === 0 ? 1.3 : 0.9, tint: 0xff6c9d
        });
      }
    } else if (pattern === 1) {
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 140, () => {
          if (!e.active || e.defeated) return;
          const a = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
          this.spawnEnemyProjectile(e.x, e.y, Math.cos(a) * 330, Math.sin(a) * 330, {
            texture: i === 1 ? 'bullet_mega' : 'bullet_enemy', damage: 15, scale: i === 1 ? 1.2 : 0.85, tint: 0xd7b464
          });
        });
      }
    } else if (pattern === 2) {
      [-120, 0, 120].forEach((offset, i) => {
        this.spawnEnemyProjectile(e.x, e.y, Phaser.Math.Clamp((this.player.x + offset - e.x) * 0.42, -260, 260), -420 - i * 30, {
          texture: 'bullet_charged', gravityY: 520, damage: 14, scale: 0.95, tint: 0x76f5ff, life: 3600
        });
      });
      // Tele-stomp near player
      this.time.delayedCall(380, () => {
        if (!e.active || e.defeated) return;
        const nx = Phaser.Math.Clamp(this.player.x + Phaser.Math.RND.pick([-90, 90]), 180, 3400);
        const ny = e.homeY || 560;
        e.body.reset(nx, ny);
        e.setVelocity(0, 0);
        e.sprinting = true;
        e.sprintUntil = time + 700;
        this.playSafe(e, `boss-${e.bossKey}-special`);
        AudioSystem.sfx(this, 'sfx_glitch', { volume: 0.4 });
      });
    } else {
      [-1, 1].forEach(side => this.spawnEnemyProjectile(e.x, e.y, side * 300, 0, {
        texture: 'bullet_mega', damage: 14, scale: 1.1, tint: 0xb58cff
      }));
      this.spawnEnemyProjectile(e.x, e.y, Math.cos(angle) * 300, Math.sin(angle) * 300, {
        texture: 'bullet_debug', damage: 14, scale: 1.0, tint: 0xff6c9d
      });
    }
  }

  updateBoss(e, time) {
    const dist = this.player.x - e.x;
    const abs = Math.abs(dist);
    const key = e.bossKey || 'ultimate';
    this.tickEnemySprint(e, time, abs, {
      chance: key === 'deadline' ? 10 : key === 'ultimate' ? 8 : 5,
      minDist: 120, maxDist: 480, dur: [360, 560]
    });
    const canMove = time >= e.attackOpenUntil;
    let vx = 0;
    if (canMove) {
      if (abs > 150) vx = Math.sign(dist) * this.enemyMoveSpeed(e);
      else if (key === 'deadline' && abs > 80) vx = Math.sign(dist) * this.enemyMoveSpeed(e) * 0.7;
    }
    e.setVelocityX(vx);
    e.setFlipX(dist < 0);
    // Stay planted on the main floor — never force Y (that desynced hitboxes)
    if (e.body) {
      if (e.y > 620) {
        e.y = 600;
        e.body.reset(e.x, e.y);
        e.setVelocityY(0);
      }
      if (e.body.blocked.down || e.body.touching.down) e.homeY = e.y;
    }
    if (this.bossHp && e.maxHp) this.bossHp.width = 420 * Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);

    const fireGap = key === 'deadline'
      ? 2200 - this.level * 50
      : key === 'ultimate'
        ? 2500 - this.level * 40
        : 2800 - this.level * 40;
    if (canMove && time - e.lastShot > fireGap) {
      e.lastShot = time;
      this.fireBossPattern(e, time);
      if (abs < 150) {
        this.playSafe(e, `boss-${key}-special`);
        AudioSystem.sfx(this, 'sfx_glitch', { volume: 0.35 });
      }
    }
    if (time < e.attackOpenUntil) this.playSafe(e, `boss-${key}-idle`);
    else if (!e.anims.isPlaying) this.playSafe(e, `boss-${key}-idle`);
  }

  livingEnemies() {
    return this.enemies?.getChildren().filter(e => e.active && !e.defeated && e.hp > 0 && e.body?.enable) || [];
  }

  createExit() {
    this.exit = this.add.container(3490, 620).setDepth(5);
    this.exit.add(this.add.rectangle(0, 0, 72, 128, 0x091c32, 0.85).setStrokeStyle(3, 0x375069));
    this.exitPortal = this.tex('item_portal')
      ? this.add.image(0, 0, 'item_portal').setDisplaySize(82, 123).setAlpha(0.3)
      : null;
    if (this.exitPortal) this.exit.add(this.exitPortal);
    this.exitGlow = this.add.ellipse(0, 0, 52, 108, 0x55e8ff, 0.12).setStrokeStyle(2, 0x55e8ff, 0.2);
    this.exit.add(this.exitGlow);
    this.exitLabel = this.add.text(0, -86, 'PORTAL BLOQUEADO', { ...Fonts.MONO, fontSize: '16px', color: '#8194aa' }).setOrigin(0.5);
    this.exit.add(this.exitLabel);
  }

  openExit() {
    if (this.exitOpen || this.finished) return;
    this.exitOpen = true;
    this.exitLabel.setText('SAÍDA →').setColor('#82ffce');
    if (this.exitPortal) {
      this.exitPortal.setAlpha(0.92);
      this.tweens.add({ targets: this.exitPortal, alpha: 0.62, scaleX: 0.96, scaleY: 0.97, duration: 820, yoyo: true, repeat: -1 });
    }
    this.exitGlow.setFillStyle(0x55e8ff, 0.65).setStrokeStyle(3, 0xa4fff0);
    this.tweens.add({ targets: this.exitGlow, alpha: 0.45, scaleY: 0.9, duration: 700, yoyo: true, repeat: -1 });
    this.toast('Fragmento recuperado! Alcance o portal à direita.');
    AudioSystem.sfx(this, 'sfx_checkpoint');
  }

  checkProgress() {
    if (this.finished || this.playerDying || this.paused) return;
    if (this.livingEnemies().length === 0) {
      if (this.cfg.boss && !this.bossSpawned) this.spawnBoss();
      else if (!this.cfg.boss || this.bossDefeated) this.openExit();
    }
    if (this.exitOpen && this.player.x > 3420 && this.player.y > 510) this.completeLevel();
  }

  completeLevel() {
    if (this.finished) return;
    this.finished = true;
    const state = SaveSystem.load();
    SaveSystem.save({
      unlockedLevel: Math.min(4, Math.max(state.unlockedLevel, this.level + 1)),
      bugsFixed: state.bugsFixed + this.score,
      coffees: state.coffees + this.coffees,
      currentLevel: Math.min(4, this.level + 1),
      completed: this.level === 4 || state.completed,
      run: { bugs: state.run.bugs + this.score, coffees: state.run.coffees + this.coffees, deaths: state.run.deaths + this.deaths, chapters: Math.max(state.run.chapters, this.level) }
    });
    if (this.deaths === 0) this.achievement('works_machine', 'IT WORKS ON MY MACHINE');
    this.physics.pause();
    AudioSystem.sfx(this, 'sfx_levelup');
    AudioSystem.sting(this, 'sfx_victory');
    this.scene.start('InterludeScene', {
      level: this.level, score: this.score, coffees: this.coffees, deaths: this.deaths
    });
  }

  togglePause() {
    if (this.finished || this.playerDying) return;
    if (this.pauseLayer) {
      this.resumeGame();
      return;
    }
    this.paused = true;
    this.physics.pause();
    this.time.paused = true;
    this.anims.pauseAll();
    this.tweens.pauseAll();
    VirtualPad.reset();
    this.charging = false; this.chargeMs = 0; this.updateChargeAura(false);
    AudioSystem.sfx(this, 'sfx_pause');
    this.pauseLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
    this.pauseLayer.add(this.add.rectangle(640, 360, 1280, 720, 0x050711, 0.72));
    if (this.tex('ui_pause')) this.pauseLayer.add(this.add.image(640, 360, 'ui_pause').setDisplaySize(560, 360));
    this.pauseLayer.add(this.add.text(640, 250, 'PAUSED', { ...Fonts.MONO, fontSize: '28px', color: '#fff' }).setOrigin(0.5));
    this.pauseLayer.add(this.add.text(640, 300, Device.wantsTouchUI()
      ? 'II resume  •  X defesa  •  B pulo'
      : 'ESC resume  •  ver CONFIG no menu', {
      ...Fonts.MONO, fontSize: '18px', color: '#9fdfff'
    }).setOrigin(0.5));
    const { bg, tx } = neonButton(this, 640, 390, 'RESUME', () => this.resumeGame(), 320);
    const b2 = neonButton(this, 640, 458, 'MENU', () => {
      VirtualPad.setScene(null);
      this.scene.start('MenuScene');
    }, 320);
    this.pauseLayer.add([bg, tx, b2.bg, b2.tx]);
  }

  resumeGame() {
    if (!this.pauseLayer) return;
    AudioSystem.sfx(this, 'sfx_resume');
    this.pauseLayer.destroy(true);
    this.pauseLayer = null;
    this.paused = false;
    this.time.paused = false;
    this.anims.resumeAll();
    this.tweens.resumeAll();
    this.physics.resume();
  }

  ambientGlitch() {
    if (this.paused || this.finished || SaveSystem.load().settings?.reducedFx) return;
    this.cameras.main.shake(70, 0.0018);
    this.spawnFx(this.cameras.main.scrollX + Phaser.Math.Between(200, 1000), Phaser.Math.Between(80, 280), 'fx-glitch', 'fx_glitch');
  }

  updateHud() {
    const hp = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const caf = Phaser.Math.Clamp(this.caffeine / 100, 0, 1);
    const xp = Phaser.Math.Clamp(this.xp / 100, 0, 1);
    this.hpText.setText(`HP ${Math.max(0, Math.round(this.hp))}/${this.maxHp}`);
    this.hpBar.width = 296 * hp;
    this.cafBar.width = 300 * caf;
    this.xpBar.width = 300 * xp;
    if (this.hpFill) this.hpFill.setDisplaySize(Math.max(1, 296 * hp), 10);
    if (this.cafFill) this.cafFill.setDisplaySize(Math.max(1, 300 * caf), 8);
    if (this.xpFill) this.xpFill.setDisplaySize(Math.max(1, 300 * xp), 6);
    this.cafText.setText(`CAFFEINE ${Math.round(this.caffeine)}   XP ${Math.round(this.xp)}`);
    const alive = this.livingEnemies();
    this.statText.setText(this.exitOpen ? 'PORTAL LIBERADO →' : `BUGS ${this.score}   RESTAM ${alive.length}`);
    if (this.objectiveText) {
      const nearest = alive.reduce((best, e) => !best || Math.abs(e.x - this.player.x) < Math.abs(best.x - this.player.x) ? e : best, null);
      this.objectiveText.setText(this.exitOpen ? 'FRAGMENTO RECUPERADO · Vá até o portal à direita →' : nearest ? `${nearest.x < this.player.x ? '←' : '→'} ${nearest.isBoss ? 'DERROTE O CHEFE' : 'ELIMINE OS BUGS'} · ${nearest.isBoss ? this.cfg.boss : nearest.type}` : 'Restaurando o fragmento…');
    }
  }

  pullPickups() {
    this.pickups?.children.iterate((c) => {
      if (!c?.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < 110 && d > 8) {
        if (c.floatTween) { c.floatTween.stop(); c.floatTween = null; }
        c.x += (this.player.x - c.x) * 0.12;
        c.y += (this.player.y - c.y) * 0.12;
      }
    });
  }

  attachEnemyHp(e) {
    const w = e.barW || 36;
    const color = e.hpColor || 0xff4f72;
    e.hpBarBg = this.add.rectangle(e.x, e.y - 42, w + 2, 7, 0x070b16, 0.9).setDepth(29);
    e.hpBar = this.add.rectangle(e.x - w / 2, e.y - 42, w, 5, color).setOrigin(0, 0.5).setDepth(30);
  }

  syncEnemyHp(e) {
    if (!e?.active) return;
    if (!e.hpBar || !e.hpBar.active) this.attachEnemyHp(e);
    const w = e.barW || 36;
    const ratio = Phaser.Math.Clamp(e.hp / Math.max(1, e.maxHp), 0, 1);
    e.hpBarBg?.setPosition(e.x, e.y - 42);
    e.hpBar.width = Math.max(2, w * ratio);
    e.hpBar.setPosition(e.x - w / 2, e.y - 42);
    if (e.hpColor) e.hpBar.setFillStyle(e.hpColor);
  }

  showEnemyHp(e) {
    this.syncEnemyHp(e);
  }

  popup(x, y, msg, color) {
    const t = this.add.text(x, y, msg, { ...Fonts.PIXEL, fontSize: '8px', color }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 520, onComplete: () => t.destroy() });
  }

  showLevelTitle() {
    const box = this.add.container(640, 300).setScrollFactor(0).setDepth(90);
    if (this.tex('ui_dialog')) box.add(this.add.image(0, 0, 'ui_dialog').setDisplaySize(640, 160));
    if (this.tex('portrait_dialog')) box.add(this.add.image(-250, 0, 'portrait_dialog').setDisplaySize(88, 88));
    box.add(this.add.text(20, -24, this.cfg.name, { ...Fonts.PIXEL, fontSize: '16px', color: '#fff' }).setOrigin(0.5));
    box.add(this.add.text(20, 18, this.cfg.subtitle, { ...Fonts.MONO, fontSize: '17px', color: '#9fdfff', wordWrap: { width: 440 }, align: 'center' }).setOrigin(0.5));
    AudioSystem.sfx(this, 'sfx_dialog', { volume: 0.5 });
    this.tweens.add({ targets: box, alpha: 0, duration: 650, delay: 1900, onComplete: () => box.destroy() });
  }

  toast(msg) {
    if (this.toastText?.active) { this.tweens.killTweensOf(this.toastText); this.toastText.destroy(); }
    const t = this.add.text(640, 168, msg, {
      ...Fonts.MONO, fontSize: '20px', color: '#fff', backgroundColor: '#0b1124dd', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80);
    this.toastText = t;
    this.tweens.add({ targets: t, y: 140, alpha: 0, duration: 1200, delay: 800, onComplete: () => t.destroy() });
  }

  achievement(id, name) {
    if (SaveSystem.unlockAchievement(id)) {
      AudioSystem.sfx(this, 'sfx_achievement');
      this.toast(`ACHIEVEMENT UNLOCKED: ${name}`);
    }
  }
}
