import { setupScene } from '../systems/SceneLifecycle.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { Device } from '../systems/Device.js';
import { BESTIARY } from '../data/Bestiary.js';

/**
 * Mario-style enemy gallery: one bug/boss at a time, flip sideways.
 * From ending (after celebrate) or menu when the game is completed.
 */
export class BestiaryScene extends Phaser.Scene {
  constructor() { super('BestiaryScene'); }

  init(data = {}) {
    this.fromEnding = !!data.fromEnding;
    this.index = 0;
    this.busy = false;
    this.leaving = false;
  }

  create() {
    setupScene(this);
    this.cameras.main.fadeIn(400, 5, 7, 17);
    if (this.textures.exists('art_menu')) {
      this.add.image(640, 360, 'art_menu').setDisplaySize(1280, 720).setAlpha(0.35);
    }
    this.add.rectangle(640, 360, 1280, 720, 0x050711, 0.72);
    if (this.textures.exists('px_stars')) {
      const stars = this.add.tileSprite(640, 180, 1280, 220, 'px_stars').setAlpha(0.4);
      this.tweens.add({ targets: stars, tilePositionX: 80, duration: 22000, repeat: -1 });
    }

    this.add.text(640, 48, 'ARQUIVO DE BUGS', {
      ...Fonts.TITLE, fontSize: '34px', color: '#f1edff'
    }).setOrigin(0.5);
    this.add.text(640, 92, this.fromEnding
      ? 'Os vilões da Birthday Build — um por um'
      : 'Relatório pós-release · quem te atrapalhou', {
      ...Fonts.MONO, fontSize: '18px', color: '#8892b0'
    }).setOrigin(0.5);

    // Stage frame
    this.stage = this.add.rectangle(640, 300, 420, 280, 0x0a1228, 0.95).setStrokeStyle(2, 0x4ce0ff, 0.65);
    this.glow = this.add.rectangle(640, 300, 428, 288).setStrokeStyle(2, 0xff4f9a, 0.25);
    this.tweens.add({
      targets: this.glow,
      alpha: { from: 0.35, to: 0.85 },
      duration: 1600,
      yoyo: true,
      repeat: -1
    });

    this.sprite = this.add.sprite(640, 300, BESTIARY[0].texture).setOrigin(0.5);
    this.kindBadge = this.add.text(640, 158, '', {
      ...Fonts.PIXEL, fontSize: '11px', color: '#6ee7ff'
    }).setOrigin(0.5);
    this.nameText = this.add.text(640, 470, '', {
      ...Fonts.TITLE, fontSize: '28px', color: '#e8f0ff'
    }).setOrigin(0.5);
    this.blurbText = this.add.text(640, 530, '', {
      ...Fonts.MONO, fontSize: '20px', color: '#c5d4f5', align: 'center',
      wordWrap: { width: 900 }, lineSpacing: 4
    }).setOrigin(0.5, 0);
    this.tipText = this.add.text(640, 612, '', {
      ...Fonts.MONO, fontSize: '17px', color: '#7ceab9', align: 'center',
      wordWrap: { width: 880 }
    }).setOrigin(0.5);
    this.counter = this.add.text(640, 660, '', {
      ...Fonts.MONO, fontSize: '16px', color: '#6f7895'
    }).setOrigin(0.5);

    const touch = Device.wantsTouchUI();
    this.prevBtn = neonButton(this, 180, 300, touch ? '◀' : '◀  A', () => this.flip(-1), touch ? 100 : 140);
    this.nextBtn = neonButton(this, 1100, 300, touch ? '▶' : 'D  ▶', () => this.flip(1), touch ? 100 : 140);

    const leaveLabel = this.fromEnding ? 'IR AO MENU' : 'VOLTAR';
    neonButton(this, 640, 688, leaveLabel, () => this.leave(), 280);

    this.add.text(640, 128, touch
      ? 'toque nas setas · um monstro por vez'
      : '← →  ou  A / D  ·  um monstro por vez', {
      ...Fonts.MONO, fontSize: '15px', color: '#5a6688'
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-LEFT', e => { if (!e.repeat) this.flip(-1); });
    this.input.keyboard?.on('keydown-RIGHT', e => { if (!e.repeat) this.flip(1); });
    this.input.keyboard?.on('keydown-A', e => { if (!e.repeat) this.flip(-1); });
    this.input.keyboard?.on('keydown-D', e => { if (!e.repeat) this.flip(1); });
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.input.keyboard?.on('keydown-ENTER', e => {
      if (!e.repeat && this.fromEnding && this.index >= BESTIARY.length - 1) this.leave();
    });

    AudioSystem.playMusic(this, 'mus_victory', { fade: 500, volume: 0.55 });
    this.showEntry(0, true);
  }

  showEntry(i, instant = false) {
    const entry = BESTIARY[i];
    if (!entry) return;
    this.index = i;

    const apply = () => {
      if (this.textures.exists(entry.texture)) {
        this.sprite.setTexture(entry.texture);
        const boss = entry.kind.includes('CHEFE');
        this.sprite.setDisplaySize(boss ? 168 : 140, boss ? 168 : 140);
        if (this.anims.exists(entry.anim)) this.sprite.play(entry.anim);
        else this.sprite.stop();
      }
      this.kindBadge.setText(`// ${entry.kind}`).setColor(entry.accent);
      this.nameText.setText(entry.name).setColor(entry.accent);
      this.blurbText.setText(entry.blurb);
      this.tipText.setText(`dica · ${entry.tip}`);
      this.counter.setText(`${i + 1} / ${BESTIARY.length}`);
      this.stage.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(entry.accent).color, 0.7);
    };

    if (instant) {
      apply();
      return;
    }

    this.tweens.add({
      targets: [this.sprite, this.nameText, this.blurbText, this.tipText, this.kindBadge],
      alpha: 0,
      duration: 120,
      onComplete: () => {
        apply();
        this.tweens.add({
          targets: [this.sprite, this.nameText, this.blurbText, this.tipText, this.kindBadge],
          alpha: 1,
          duration: 180
        });
      }
    });
  }

  flip(dir) {
    if (this.busy || this.leaving) return;
    const next = (this.index + dir + BESTIARY.length) % BESTIARY.length;
    if (next === this.index) return;
    this.busy = true;
    AudioSystem.sfx(this, AudioSystem.has(this, 'sfx_select') ? 'sfx_select' : 'sfx_hover');

    const outX = dir > 0 ? -220 : 1500;
    const inFrom = dir > 0 ? 1500 : -220;

    this.tweens.add({
      targets: this.sprite,
      x: outX,
      alpha: 0.2,
      duration: 180,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.showEntry(next, true);
        this.sprite.setX(inFrom).setAlpha(0.2);
        this.tweens.add({
          targets: this.sprite,
          x: 640,
          alpha: 1,
          duration: 220,
          ease: 'Cubic.easeOut',
          onComplete: () => { this.busy = false; }
        });
        this.tweens.add({
          targets: [this.nameText, this.blurbText, this.tipText, this.kindBadge],
          alpha: { from: 0.3, to: 1 },
          duration: 200
        });
      }
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    AudioSystem.sfx(this, 'sfx_transition');
    this.cameras.main.fadeOut(320, 5, 7, 17);
    this.time.delayedCall(340, () => this.scene.start('MenuScene'));
  }
}
