import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';

const ENEMIES = ['syntax', 'runtime', 'null', 'leak', 'legacy', 'spaghetti'];
const BOSSES = ['procrastination', 'deadline', 'ultimate'];
const PLAYER_ANIMS = [
  ['idle', 6, 8], ['walk', 10, 12], ['run', 10, 16], ['jump', 6, 10],
  ['fall', 4, 8], ['attack', 8, 16], ['defend', 4, 8], ['hurt', 4, 14], ['death', 8, 12]
];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.failed = [];
    this.cameras.main.setBackgroundColor('#050711');
    this.add.text(640, 250, 'NICOLAS.EXE', {
      fontFamily: 'Orbitron, monospace', fontSize: '42px', color: '#dce7ff'
    }).setOrigin(0.5);
    this.add.text(640, 310, 'BIRTHDAY BUILD  //  compiling assets...', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '18px', color: '#6ee7ff'
    }).setOrigin(0.5);
    this.add.rectangle(640, 400, 520, 22, 0x111830).setStrokeStyle(2, 0x4ce0ff);
    const bar = this.add.rectangle(380, 400, 0, 14, 0x4ce0ff).setOrigin(0, 0.5);
    this.status = this.add.text(640, 440, '0%', {
      fontFamily: 'VT323, monospace', fontSize: '22px', color: '#8aa0c8'
    }).setOrigin(0.5);

    this.load.on('progress', (p) => {
      bar.width = 520 * p;
      this.status.setText(`${Math.round(p * 100)}%`);
    });
    this.load.on('loaderror', (file) => {
      console.warn('[NICOLAS.EXE] falha ao carregar asset:', file.key, file.src || '');
      this.failed.push(file.key);
    });

    this.loadPack();
  }

  loadPack() {
    const A = './assets/';
    const img = (key, path) => this.load.image(key, A + path);
    const sheet = (key, path, w, h) => this.load.spritesheet(key, A + path, { frameWidth: w, frameHeight: h });
    const aud = (key, path) => this.load.audio(key, A + path);

    img('art_menu', 'art/menu_bg.png');
    img('art_intro', 'art/intro_bg.png');
    img('art_ending', 'art/ending_bg.png');
    img('art_gameover', 'art/gameover_bg.png');
    img('art_boss', 'art/boss_arena.png');
    img('art_lv1', 'art/level1_bg.png');
    img('art_lv2', 'art/level2_bg.png');
    img('art_lv3', 'art/level3_bg.png');
    img('art_lv4', 'art/level4_bg.png');
    img('art_clear_1', 'art/art_clear_1.png');
    img('art_clear_2', 'art/art_clear_2.png');
    img('art_clear_3', 'art/art_clear_3.png');
    img('art_clear_4', 'art/art_clear_4.png');
    img('art_birthday', 'art/art_birthday.png');
    img('portrait_nicolas', 'sprites/portraits/nicolas.png');
    img('portrait_dialog', 'sprites/portraits/nicolas_dialog.png');
    img('portrait_icon', 'sprites/portraits/nicolas_icon.png');

    // O passe visual novo usa quadros de 96×128 para manter o Nicolas legível
    // mesmo quando a câmera se aproxima em telas menores.
    PLAYER_ANIMS.forEach(([name]) => sheet(`player_${name}`, `sprites/player/${name}.png`, 96, 128));
    img('player_icon', 'sprites/player/icon.png');

    ENEMIES.forEach(slug => sheet(`en_${slug}`, `sprites/enemies/${slug}/atlas.png`, 128, 128));
    BOSSES.forEach(slug => sheet(`boss_${slug}`, `sprites/bosses/${slug}/atlas.png`, 256, 256));

    img('item_coffee', 'sprites/items/coffee.png');
    img('item_energy', 'sprites/items/energy.png');
    img('item_pizza', 'sprites/items/pizza.png');
    img('item_chocolate', 'sprites/items/chocolate.png');
    img('item_checkpoint', 'sprites/items/checkpoint.png');
    img('item_achievement', 'sprites/items/achievement.png');
    img('item_shard', 'sprites/items/shard.png');
    img('item_portal', 'sprites/items/portal.png');
    img('bullet', 'sprites/items/bullet.png');
    img('bullet_debug', 'sprites/items/bullet_debug.png');
    img('bullet_enemy', 'sprites/items/bullet_enemy.png');
    sheet('bullet_mega', 'sprites/items/bullet_mega_sheet.png', 48, 48);
    sheet('bullet_charged', 'sprites/items/bullet_charged.png', 32, 32);

    sheet('fx_impact', 'sprites/fx/impact.png', 32, 32);
    sheet('fx_explosion', 'sprites/fx/explosion.png', 48, 48);
    sheet('fx_boss_explode', 'sprites/fx/boss_explode.png', 64, 64);
    sheet('fx_pickup', 'sprites/fx/pickup.png', 32, 32);
    sheet('fx_checkpoint', 'sprites/fx/checkpoint.png', 32, 56);
    sheet('fx_glitch', 'sprites/fx/glitch.png', 48, 32);

    img('tile_platform', 'sprites/tiles/platform.png');
    img('tile_floor', 'sprites/tiles/floor.png');
    img('tile_code', 'sprites/tiles/code_block.png');
    img('tile_terminal', 'sprites/tiles/terminal.png');
    img('tile_chip', 'sprites/tiles/chip.png');
    img('tile_panel', 'sprites/tiles/panel.png');
    img('tile_circuit', 'sprites/tiles/circuit.png');

    img('px_stars', 'sprites/bg/stars.png');
    img('px_city', 'sprites/bg/city.png');
    img('px_grid', 'sprites/bg/grid.png');
    img('px_code', 'sprites/bg/code.png');
    img('px_fog', 'sprites/bg/fog.png');

    img('ui_panel', 'ui/panel.png');
    img('ui_button', 'ui/button.png');
    img('ui_button_hover', 'ui/button_hover.png');
    img('ui_dialog', 'ui/dialog.png');
    img('ui_pause', 'ui/pause.png');
    img('ui_gameover', 'ui/gameover.png');
    img('ui_hp', 'ui/hp_fill.png');
    img('ui_caf', 'ui/caf_fill.png');
    img('ui_xp', 'ui/xp_fill.png');
    img('ui_bar', 'ui/bar_back.png');

    aud('mus_menu', 'audio/music/menu.ogg');
    aud('mus_intro', 'audio/music/intro.wav');
    aud('mus_level1', 'audio/music/level1.mp3');
    aud('mus_level2', 'audio/music/level2.ogg');
    aud('mus_level3', 'audio/music/level3.mp3');
    aud('mus_level4', 'audio/music/level4.mp3');
    aud('mus_boss', 'audio/music/boss.ogg');
    aud('mus_boss_final', 'audio/music/boss_final.ogg');
    aud('mus_victory', 'audio/music/victory.ogg');
    aud('mus_ending', 'audio/music/ending.ogg');
    aud('mus_ending_soft', 'audio/music/ending_soft.wav');
    aud('mus_ending_party', 'audio/music/ending_party.mp3');

    const sfx = {
      sfx_jump: 'audio/sfx/jump.mp3',
      sfx_land: 'audio/sfx/land.mp3',
      sfx_attack: 'audio/sfx/attack.ogg',
      sfx_shoot: 'audio/sfx/shoot.wav',
      sfx_enemy_shot: 'audio/sfx/enemy_shot.wav',
      sfx_hit: 'audio/sfx/hit.ogg',
      sfx_hurt: 'audio/sfx/hurt.mp3',
      sfx_death: 'audio/sfx/death.ogg',
      sfx_enemy_death: 'audio/sfx/enemy_death.ogg',
      sfx_pickup: 'audio/sfx/pickup.mp3',
      sfx_checkpoint: 'audio/sfx/checkpoint.ogg',
      sfx_click: 'audio/sfx/click.ogg',
      sfx_hover: 'audio/sfx/hover.ogg',
      sfx_select: 'audio/sfx/select.ogg',
      sfx_achievement: 'audio/sfx/achievement.ogg',
      sfx_explosion: 'audio/sfx/explosion.ogg',
      sfx_boss_hit: 'audio/sfx/boss_hit.ogg',
      sfx_gameover: 'audio/sfx/gameover.ogg',
      sfx_transition: 'audio/sfx/transition.wav',
      sfx_glitch: 'audio/sfx/glitch.ogg',
      sfx_pause: 'audio/sfx/pause.ogg',
      sfx_resume: 'audio/sfx/resume.ogg',
      sfx_boss_shot: 'audio/sfx/boss_shot.ogg',
      sfx_levelup: 'audio/sfx/levelup.mp3',
      sfx_error: 'audio/sfx/error.ogg',
      sfx_typing: 'audio/sfx/typing.ogg',
      sfx_dialog: 'audio/sfx/dialog.ogg',
      sfx_impact: 'audio/sfx/impact.mp3',
      sfx_special: 'audio/sfx/special.ogg',
      sfx_confirm: 'audio/sfx/confirm.mp3',
      sfx_victory: 'audio/sfx/victory_sting.ogg'
    };
    Object.entries(sfx).forEach(([k, p]) => aud(k, p));
  }

  createFallbackTextures() {
    const make = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      draw(g, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    const sheet = (key, fw, fh, frames, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      for (let i = 0; i < frames; i++) {
        g.save();
        g.translateCanvas(i * fw, 0);
        draw(g, fw, fh, i);
        g.restore();
      }
      g.generateTexture(key, fw * frames, fh);
      g.destroy();
    };

    sheet('player_idle', 48, 64, 6, (g) => {
      g.fillStyle(0x182848); g.fillRoundedRect(10, 18, 28, 40, 6);
      g.fillStyle(0xd6a880); g.fillCircle(24, 16, 10);
      g.fillStyle(0x4ce0ff); g.fillRect(12, 28, 4, 16); g.fillRect(32, 28, 4, 16);
    });
    ['player_walk', 'player_run', 'player_jump', 'player_fall', 'player_attack', 'player_hurt', 'player_death']
      .forEach((k) => {
        if (this.textures.exists(k)) return;
        try {
          const src = this.textures.get('player_idle').getSourceImage();
          this.textures.addCanvas(k, src);
        } catch (err) {
          console.warn('[NICOLAS.EXE] fallback', k, err.message);
        }
      });

    make('bullet', 24, 12, (g, w, h) => { g.fillStyle(0x7cf5ff); g.fillRoundedRect(0, 0, w, h, 4); });
    make('bullet_enemy', 24, 12, (g, w, h) => { g.fillStyle(0xff5d7f); g.fillRoundedRect(0, 0, w, h, 4); });
    make('item_coffee', 32, 32, (g) => {
      g.fillStyle(0xffffff); g.fillRoundedRect(6, 10, 16, 16, 3);
      g.fillStyle(0x7c3f1d); g.fillRect(8, 12, 12, 10);
    });
    make('tile_platform', 128, 24, (g, w, h) => {
      g.fillStyle(0x111830); g.fillRoundedRect(0, 0, w, h, 6);
      g.lineStyle(2, 0x3ad8ff); g.strokeRoundedRect(0, 0, w, h, 6);
    });
    make('ui_panel', 96, 64, (g, w, h) => {
      g.fillStyle(0x0b1024); g.fillRoundedRect(0, 0, w, h, 8);
      g.lineStyle(2, 0x4ce0ff); g.strokeRoundedRect(1, 1, w - 2, h - 2, 8);
    });
    make('ui_button', 128, 48, (g, w, h) => {
      g.fillStyle(0x0e1530); g.fillRoundedRect(0, 0, w, h, 8);
      g.lineStyle(2, 0x2a7cff); g.strokeRoundedRect(1, 1, w - 2, h - 2, 8);
    });
  }

  create() {
    this.createFallbackTextures();
    this.createAnimations();
    // A arte raster nova tem antialias próprio; filtro linear evita serrilhado
    // quando o personagem é exibido em escala fracionária.
    PLAYER_ANIMS.forEach(([name]) => this.textures.get(`player_${name}`).setFilter(Phaser.Textures.FilterMode.NEAREST));
    AudioSystem.init(this.game);
    const state = SaveSystem.load();
    AudioSystem.musicVol = state.settings?.music ?? 0.45;
    AudioSystem.sfxVol = state.settings?.sfx ?? 0.75;
    if (this.failed.length) {
      console.warn('[NICOLAS.EXE] assets opcionais ausentes (' + this.failed.length + '). Fallbacks ativos.');
    }
    this.scene.start('MenuScene');
  }

  safeAnim(key, spriteKey, end, rate, repeat) {
    if (this.anims.exists(key) || !this.textures.exists(spriteKey)) return;
    const max = Math.max(0, (this.textures.get(spriteKey).frameTotal || 1) - 2);
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: Math.min(end, max) }),
      frameRate: rate,
      repeat
    });
  }

  createAnimations() {
    PLAYER_ANIMS.forEach(([name, count, rate]) => {
      const rep = ['jump', 'fall', 'attack', 'hurt', 'death'].includes(name) ? 0 : -1;
      this.safeAnim(`player-${name}`, `player_${name}`, count - 1, rate, rep);
    });

    const fromAtlas = (prefix, texture) => {
      const add = (pose, frames, rate, repeat) => {
        const key = `${prefix}-${pose}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: frames.map(frame => ({ key: texture, frame })), frameRate: rate, repeat });
      };
      add('idle', [0, 1, 0, 2], 3, -1);
      add('walk', [0, 1, 0, 2], 9, -1);
      add('intro', [0, 1, 0, 3], 5, 0);
      add('attack', [0, 3, 3, 0], 9, 0);
      add('special', [1, 3, 3, 0], 7, 0);
      add('hurt', [3, 0], 10, 0);
      add('death', [3, 0], 5, 0);
    };
    ENEMIES.forEach(slug => fromAtlas(`en-${slug}`, `en_${slug}`));
    BOSSES.forEach(slug => fromAtlas(`boss-${slug}`, `boss_${slug}`));

    this.safeAnim('fx-impact', 'fx_impact', 5, 18, 0);
    this.safeAnim('fx-explosion', 'fx_explosion', 7, 16, 0);
    this.safeAnim('fx-boss-explode', 'fx_boss_explode', 9, 14, 0);
    this.safeAnim('fx-pickup', 'fx_pickup', 5, 14, 0);
    this.safeAnim('fx-checkpoint', 'fx_checkpoint', 5, 10, -1);
    this.safeAnim('fx-glitch', 'fx_glitch', 5, 14, 0);
    this.safeAnim('bullet-charged', 'bullet_charged', 3, 14, -1);
    this.safeAnim('bullet-mega', 'bullet_mega', 3, 16, -1);
  }
}
