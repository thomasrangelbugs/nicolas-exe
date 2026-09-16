import { setupScene } from '../systems/SceneLifecycle.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, glitchTitle, Fonts } from '../systems/UI.js';
import { Device } from '../systems/Device.js';

const ACHIEVEMENTS = {
  first_bug: 'FIRST BUG',
  coffee_addict: 'COFFEE ADDICT',
  git_good: 'GIT GOOD',
  debugger: 'THE DEBUGGER',
  birthday_build: 'BIRTHDAY BUILD',
  works_machine: 'IT WORKS ON MY MACHINE'
};

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    setupScene(this);
    this.state = SaveSystem.load();
    this.achLayer = null;
    this.settingsLayer = null;
    this.leaving = false;
    this.resetArmed = false;
    this.menuButtons = [];
    Device.applyScaleMode();
    this.cameras.main.fadeIn(500, 5, 7, 17);
    this.drawBackdrop();

    if (this.textures.exists('portrait_nicolas')) {
      this.add.image(1080, 210, 'portrait_nicolas').setDisplaySize(220, 220).setAlpha(0.95);
      this.add.rectangle(1080, 210, 228, 228).setStrokeStyle(2, 0x4ce0ff, 0.7);
    }

    glitchTitle(this, 520, 120, 'NICOLAS.EXE', {
      ...Fonts.TITLE, fontSize: '64px', fontStyle: 'bold', stroke: '#6f4cff', strokeThickness: 4
    });
    this.add.text(520, 180, 'BIRTHDAY BUILD', { ...Fonts.PIXEL, fontSize: '14px', color: '#6ee7ff' }).setOrigin(0.5);
    this.add.text(520, 214, this.state.completed
      ? 'v24.0.0  //  24 AND RUNNING'
      : 'version 2026  //  bugs are a family tradition', {
      ...Fonts.MONO, fontSize: '18px', color: '#8892b0'
    }).setOrigin(0.5);

    const done = !!this.state.completed;
    const touch = Device.wantsTouchUI();
    const step = done ? 53 : 60;
    let y = done ? 294 : 318;
    this.menuButtons.push(neonButton(this, 520, y, 'NOVA AVENTURA', () => this.go('IntroScene')));
    y += step;
    this.menuButtons.push(neonButton(this, 520, y, 'CONTINUAR', () => {
      const lv = [1, 2, 3, 4].includes(this.state.currentLevel) ? this.state.currentLevel : 1;
      this.go('GameScene', { level: lv });
    }));
    y += step;
    if (done) {
      this.menuButtons.push(neonButton(this, 520, y, 'REVER FINAL', () => this.go('CompleteScene')));
      y += step;
    }
    this.menuButtons.push(neonButton(this, 520, y, 'CONQUISTAS', () => this.showAchievements()));
    y += step;
    this.menuButtons.push(neonButton(this, 520, y, 'CONFIG', () => this.showSettings()));
    y += step;
    this.menuButtons.push(neonButton(this, 520, y, 'CRÉDITOS', () => this.go('CreditsScene')));
    y += step;
    this.menuButtons.push(neonButton(this, 520, y, 'APAGAR PROGRESSO', () => {
      if (this.resetArmed) { SaveSystem.reset(); this.scene.restart(); return; }
      this.resetArmed = true;
      this.menuButtons.at(-1).tx.setText('CONFIRMAR EXCLUSÃO');
      this.time.delayedCall(4000, () => { this.resetArmed = false; this.menuButtons.at(-1)?.tx.setText('APAGAR PROGRESSO'); });
    }, 420));

    this.muteLabel = this.add.text(1180, 36, AudioSystem.muted ? 'MUTED' : 'AUDIO', {
      ...Fonts.MONO, fontSize: '18px', color: '#8aa0c8'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.muteLabel.on('pointerdown', () => {
      const m = AudioSystem.toggleMute(this);
      this.muteLabel.setText(m ? 'MUTED' : 'AUDIO');
    });

    this.add.text(640, 698, touch
      ? 'toque nos botões  •  no jogo use o controle virtual'
      : 'veja CONFIG para os controles  •  ESC pausa  •  M mudo', {
      ...Fonts.MONO, fontSize: '16px', color: '#6f7895'
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => AudioSystem.unlock(this));
    AudioSystem.playMusic(this, 'mus_menu');
    this.input.keyboard?.on('keydown-M', () => {
      const m = AudioSystem.toggleMute(this);
      this.muteLabel.setText(m ? 'MUTED' : 'AUDIO');
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.hideAchievements();
      this.hideSettings();
    });
  }

  setMenuInteractive(on) {
    this.menuButtons.forEach(({ bg }) => {
      if (on) bg.setInteractive({ useHandCursor: true });
      else bg.disableInteractive();
    });
  }

  go(scene, data) {
    if (this.achLayer || this.settingsLayer || this.leaving) return;
    this.leaving = true;
    AudioSystem.sfx(this, 'sfx_transition');
    this.cameras.main.fadeOut(350, 5, 7, 17);
    this.time.delayedCall(360, () => this.scene.start(scene, data));
  }

  drawBackdrop() {
    if (this.textures.exists('art_menu')) {
      this.add.image(640, 360, 'art_menu').setDisplaySize(1280, 720).setAlpha(0.9);
    } else {
      this.cameras.main.setBackgroundColor('#050711');
    }
    if (this.textures.exists('px_stars')) {
      const stars = this.add.tileSprite(640, 200, 1280, 256, 'px_stars').setScrollFactor(0).setAlpha(0.55);
      this.tweens.add({ targets: stars, tilePositionX: 120, duration: 28000, repeat: -1 });
    }
    if (this.textures.exists('px_grid')) {
      this.add.tileSprite(640, 360, 1280, 720, 'px_grid').setAlpha(0.07);
    }
    const veil = this.add.rectangle(400, 360, 820, 720, 0x050711, 0.55);
    this.tweens.add({ targets: veil, alpha: { from: 0.45, to: 0.62 }, duration: 2400, yoyo: true, repeat: -1 });
  }

  showAchievements() {
    if (this.achLayer || this.settingsLayer) return;
    this.setMenuInteractive(false);
    this.achLayer = this.add.container(0, 0).setDepth(200);

    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x020307, 0.86).setInteractive();
    blocker.on('pointerdown', () => this.hideAchievements());
    this.achLayer.add(blocker);

    const panel = this.textures.exists('ui_panel')
      ? this.add.image(640, 360, 'ui_panel').setDisplaySize(780, 560)
      : this.add.rectangle(640, 360, 760, 540, 0x050914, 0.96).setStrokeStyle(2, 0x4ce0ff);
    panel.setInteractive();
    this.achLayer.add(panel);
    this.achLayer.add(this.add.text(640, 130, 'CONQUISTAS', {
      ...Fonts.MONO, fontSize: '28px', color: '#bba2ff'
    }).setOrigin(0.5));

    const ids = this.state.achievements || [];
    Object.entries(ACHIEVEMENTS).forEach(([id, name], i) => {
      const unlocked = ids.includes(id);
      const y = 190 + i * 52;
      const row = this.add.rectangle(640, y, 640, 44, unlocked ? 0x12203a : 0x0b1224, 0.9)
        .setStrokeStyle(1, unlocked ? 0x4ce0ff : 0x2a3550, 0.55);
      this.achLayer.add(row);
      if (unlocked && this.textures.exists('item_achievement')) {
        this.achLayer.add(this.add.image(360, y, 'item_achievement').setDisplaySize(28, 28));
      }
      this.achLayer.add(this.add.text(400, y, `${unlocked ? '>' : '·'}  ${name}`, {
        ...Fonts.MONO, fontSize: '22px', color: unlocked ? '#dce7ff' : '#667088'
      }).setOrigin(0, 0.5));
    });

    const close = neonButton(this, 640, 620, 'FECHAR', () => this.hideAchievements(), 280, 200);
    this.achLayer.add([close.bg, close.tx]);
  }

  hideAchievements() {
    if (!this.achLayer) return;
    this.achLayer.destroy(true);
    this.achLayer = null;
    this.setMenuInteractive(true);
  }

  showSettings() {
    if (this.settingsLayer || this.achLayer) return;
    this.setMenuInteractive(false);
    this.settingsLayer = this.add.container(0, 0).setDepth(200);

    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x020307, 0.86).setInteractive();
    blocker.on('pointerdown', () => this.hideSettings());
    this.settingsLayer.add(blocker);

    const panel = this.textures.exists('ui_panel')
      ? this.add.image(640, 360, 'ui_panel').setDisplaySize(720, 480)
      : this.add.rectangle(640, 360, 700, 460, 0x050914, 0.96).setStrokeStyle(2, 0x4ce0ff);
    panel.setInteractive();
    this.settingsLayer.add(panel);

    this.settingsLayer.add(this.add.text(640, 160, 'CONFIG', {
      ...Fonts.MONO, fontSize: '28px', color: '#6ee7ff'
    }).setOrigin(0.5));

    const lines = Device.wantsTouchUI()
      ? [
          'CELULAR / TABLET',
          'Use o controle nas faixas pretas.',
          'B = pulo  •  A = ataque (segurar = carga)',
          'Y = correr  •  X = defender',
          'II pausa  •  ♪ mudo'
        ]
      : [
          'TECLADO (PC)',
          'A / D  —  mover',
          'W / ESPAÇO / ↑  —  pular (2x)',
          'S / F / ↓  —  defender',
          'E  —  tiro de energia (toque = rápido)',
          'segure E  —  carregar bola maior',
          'SHIFT  —  correr',
          'ESC  —  pausar   •   M  —  mudo'
        ];

    lines.forEach((line, i) => {
      this.settingsLayer.add(this.add.text(640, 220 + i * 36, line, {
        ...Fonts.MONO,
        fontSize: i === 0 ? '22px' : '20px',
        color: i === 0 ? '#bba2ff' : '#dce7ff'
      }).setOrigin(0.5));
    });

    const close = neonButton(this, 640, 540, 'FECHAR', () => this.hideSettings(), 280, 200);
    this.settingsLayer.add([close.bg, close.tx]);
  }

  hideSettings() {
    if (!this.settingsLayer) return;
    this.settingsLayer.destroy(true);
    this.settingsLayer = null;
    this.setMenuInteractive(true);
  }
}
