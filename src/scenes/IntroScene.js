import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { setupScene } from '../systems/SceneLifecycle.js';

export class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }
  create() {
    setupScene(this);
    this.started = false;
    this.cameras.main.fadeIn(350);
    this.add.image(640, 360, 'art_intro').setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1080, 600, 0x020714, 0.92).setStrokeStyle(1, 0x4ce0ff, 0.7);
    this.add.text(160, 104, 'PRÓLOGO  /  UMA FESTA EM PERIGO', { ...Fonts.MONO, fontSize: '24px', color: '#6ee7ff' });
    const output = this.add.text(160, 162, '', { ...Fonts.MONO, fontSize: '25px', lineSpacing: 13, wordWrap: { width: 940 } });
    const lines = [
      '> Inicializando NICOLAS.EXE v24.0.0…',
      '> Aniversário detectado. Preparando a festa…',
      '> ERRO: o Ultimate Bug corrompeu a Birthday Build!',
      '',
      'Quatro fragmentos do sistema foram espalhados.',
      'Nicolas precisa recuperá-los antes de liberar a festa.',
      '',
      'Elimine os bugs de cada fase. Enfrente os chefes.',
      'Quando o portal acender, atravesse para continuar.'
    ];
    let i = 0;
    AudioSystem.unlock(this);
    AudioSystem.playMusic(this, 'mus_intro');
    this.timer = this.time.addEvent({ delay: 270, repeat: lines.length - 1, callback: () => {
      output.setText(lines.slice(0, ++i).join('\n'));
      AudioSystem.sfxExclusive(this, 'sfx_typing', { volume: 0.18 });
    }});
    neonButton(this, 640, 612, 'INICIAR MISSÃO', () => this.begin(), 360);
    this.add.text(640, 664, 'ENTER para começar  ·  Controles no menu CONFIG', { ...Fonts.MONO, fontSize: '18px', color: '#97a8c7' }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ENTER', event => { if (!event.repeat) this.begin(); });
  }
  begin() {
    if (this.started) return;
    this.started = true;
    this.timer?.remove(false);
    SaveSystem.beginRun();
    AudioSystem.sfx(this, 'sfx_transition');
    this.scene.start('GameScene', { level: 1 });
  }
}
