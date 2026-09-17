import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { setupScene } from '../systems/SceneLifecycle.js';

export class CompleteScene extends Phaser.Scene {
  constructor() { super('CompleteScene'); }
  create() {
    setupScene(this);
    this.doneOnce = false;
    this.celebrating = false;
    SaveSystem.save({ completed: true, currentLevel: 4 });
    SaveSystem.unlockAchievement('birthday_build');
    const state = SaveSystem.load();
    this.cameras.main.fadeIn(500);
    this.add.image(640, 360, 'art_birthday').setDisplaySize(1280, 720);
    this.add.rectangle(640, 36, 1280, 56, 0x020714, 0.82);
    this.add.text(640, 36, 'MISSÃO CONCLUÍDA  /  RELEASE v24.0.0', { ...Fonts.MONO, fontSize: '18px', color: '#7ceab9' }).setOrigin(0.5);
    this.add.rectangle(640, 584, 1280, 272, 0x030916, 0.95);
    this.add.text(54, 471, '24 ANOS. UMA NOVA FASE COMEÇA.', { ...Fonts.MONO, fontSize: '25px', color: '#6ee7ff' });
    this.add.text(54, 515, 'Nem toda fase da vida vem com tutorial. Mas você nunca precisa enfrentar os bugs sozinho. Que o próximo ano venha com boas histórias, novas conquistas e muita gente ao seu lado.', { ...Fonts.MONO, fontSize: '23px', lineSpacing: 8, wordWrap: { width: 850 } });
    this.add.text(54, 637, 'Com carinho, do teu irmão Thomas Rangel Bugs.', { ...Fonts.MONO, fontSize: '22px', color: '#eda5d5' });
    this.add.text(54, 680, `4/4 fragmentos  ·  ${state.run.bugs} bugs corrigidos  ·  ${state.run.deaths} tentativas extras  ·  ${state.run.coffees} cafés`, { ...Fonts.MONO, fontSize: '18px', color: '#8fa9c9' });
    neonButton(this, 1090, 566, 'JOGAR NOVAMENTE', () => this.leave('IntroScene'), 280);
    neonButton(this, 1090, 630, 'CELEBRAR / MENU', () => this.openCelebration(), 280);
    this.input.keyboard?.on('keydown-ENTER', e => { if (!e.repeat) this.openCelebration(); });
    AudioSystem.playMusic(this, 'mus_ending');
    this.time.delayedCall(14000, () => {
      if (!this.celebrating) AudioSystem.playMusic(this, 'mus_ending_soft', { fade: 1500 });
    });
  }

  openCelebration() {
    if (this.doneOnce || this.celebrating) return;
    this.celebrating = true;
    AudioSystem.sfx(this, 'sfx_achievement');
    AudioSystem.playMusic(this, 'mus_ending_party', { fade: 400, volume: 0.6 });

    const layer = this.add.container(0, 0).setDepth(200);
    const photo = this.add.image(640, 360, 'art_birthday').setDisplaySize(1280, 720);
    layer.add(photo);

    const sub = this.add.text(640, 56, '24 ANOS  ·  PARTY MODE', {
      ...Fonts.MONO, fontSize: '22px', color: '#7cf5ff', backgroundColor: '#050914aa', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setAlpha(0);
    layer.add(sub);

    this.tweens.add({ targets: sub, alpha: 1, duration: 700, ease: 'Cubic.easeOut' });

    this.cameras.main.flash(220, 255, 220, 120);
    this.time.addEvent({
      delay: 480,
      repeat: 12,
      callback: () => {
        if (!this.celebrating || this.doneOnce) return;
        const tint = Phaser.Math.RND.pick([
          [255, 120, 180], [120, 220, 255], [255, 220, 100], [180, 120, 255], [120, 255, 180]
        ]);
        this.cameras.main.flash(160, tint[0], tint[1], tint[2]);
        this.spawnFirework(
          Phaser.Math.Between(140, 1140),
          Phaser.Math.Between(120, 420),
          Phaser.Display.Color.GetColor(tint[0], tint[1], tint[2])
        );
        AudioSystem.sfx(this, Phaser.Math.RND.pick(['sfx_special', 'sfx_levelup', 'sfx_explosion']), { volume: 0.32 });
      }
    });

    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(120 + i * 90, () => {
        if (this.doneOnce) return;
        this.spawnFirework(200 + i * 200, 180 + (i % 2) * 80, Phaser.Math.RND.pick([0xff6bb5, 0x6ee7ff, 0xffe566, 0xb58cff]));
      });
    }

    const hint = this.add.text(640, 660, 'ENTER · arquivo de bugs (estilo Mario)', {
      ...Fonts.MONO, fontSize: '20px', color: '#dce7ff', backgroundColor: '#050914cc', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setAlpha(0).setDepth(230);
    this.tweens.add({ targets: hint, alpha: 1, delay: 900, duration: 500 });

    const go = () => this.leave('BestiaryScene', { fromEnding: true });
    this.time.delayedCall(1400, () => {
      if (this.doneOnce) return;
      neonButton(this, 640, 600, 'VER OS BUGS', go, 320, 230);
      this.input.keyboard?.once('keydown-ENTER', go);
    });
  }

  spawnFirework(x, y, color) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const spark = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 0.95).setDepth(210);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * Phaser.Math.Between(60, 140),
        y: y + Math.sin(a) * Phaser.Math.Between(60, 140),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy()
      });
    }
    const core = this.add.circle(x, y, 10, 0xffffff, 0.9).setDepth(211);
    this.tweens.add({ targets: core, alpha: 0, scale: 2.4, duration: 280, onComplete: () => core.destroy() });
  }

  leave(target, data) {
    if (this.doneOnce) return;
    this.doneOnce = true;
    this.celebrating = false;
    AudioSystem.sfx(this, 'sfx_transition');
    this.scene.start(target, data);
  }
}
