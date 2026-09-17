import { setupScene } from '../systems/SceneLifecycle.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';

export class CreditsScene extends Phaser.Scene {
  constructor() { super('CreditsScene'); }

  create() {
    setupScene(this);
    this.leaving = false;
    this.cameras.main.fadeIn(400, 5, 7, 17);
    if (this.textures.exists('art_menu')) {
      this.add.image(640, 360, 'art_menu').setDisplaySize(1280, 720).setAlpha(0.45);
    }
    this.add.rectangle(640, 360, 1280, 720, 0x050711, 0.55);
    AudioSystem.playMusic(this, 'mus_menu');

    this.add.text(640, 90, 'CRÉDITOS', { ...Fonts.PIXEL, fontSize: '22px', color: '#bba2ff' }).setOrigin(0.5);

    const body = [
      'NICOLAS.EXE — Birthday Build',
      '',
      'Feito por Thomas Rangel Bugs',
      'para Nicolas Daniel Bugs.',
      '',
      'Um jogo-presente de aniversário,',
      'feito com carinho, café e muitos bugs.',
      '',
      'Motor: Phaser 3',
      '',
      'Áudio e fontes de uso livre (CC0 / OFL).',
      'Arte e jogo montados para esta celebração.'
    ].join('\n');

    this.add.text(640, 340, body, {
      ...Fonts.MONO, fontSize: '22px', color: '#dce7ff', align: 'center', lineSpacing: 6
    }).setOrigin(0.5);

    neonButton(this, 640, 640, 'VOLTAR', () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.start('MenuScene');
    }, 280);
  }
}
