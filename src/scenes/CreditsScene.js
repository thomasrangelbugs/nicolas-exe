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

    this.add.text(640, 70, 'CREDITS', { ...Fonts.PIXEL, fontSize: '22px', color: '#bba2ff' }).setOrigin(0.5);
    this.add.text(640, 118, 'Feito por Thomas Rangel Bugs', {
      ...Fonts.PIXEL, fontSize: '12px', color: '#6ee7ff'
    }).setOrigin(0.5);
    const body = [
      'NICOLAS.EXE — Birthday Build',
      'Um jogo-presente. Feito com café, bugs e amor de irmão.',
      '',
      'ÁUDIO CC0',
      'Kenney.nl — interface, sci-fi e digital SFX',
      'mrpoly — tEcHNo gEeK',
      'Fupi — Synthwave House Loop',
      'Tarush Singhal — Cyberpunk Beauty',
      'cinameng — Dark City',
      'Centurion_of_war — Techno_Chiptale / Last One Standing',
      'Tsorthan Grove — Corrupt Data Stream',
      '',
      'FONTES OFL',
      'Press Start 2P  •  VT323  •  Share Tech Mono  •  Orbitron',
      '',
      'ARTE',
      'Inimigos e chefes: novas artes geradas para este projeto.',
      'Retrato e fundos cinematográficos estilizados (não fotográficos).',
      'Protagonista, retratos e cenários preservados da versão original.',
      '',
      'Motor: Phaser 3   •   Pronto para Netlify'
    ].join('\n');
    this.add.text(640, 360, body, {
      ...Fonts.MONO, fontSize: '18px', color: '#dce7ff', align: 'center', lineSpacing: 2
    }).setOrigin(0.5);

    neonButton(this, 640, 660, 'VOLTAR', () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.start('MenuScene');
    }, 280);
  }
}
