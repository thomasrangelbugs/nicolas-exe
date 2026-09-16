import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { setupScene } from '../systems/SceneLifecycle.js';

export class CompleteScene extends Phaser.Scene {
  constructor() { super('CompleteScene'); }
  create() {
    setupScene(this);
    this.doneOnce = false;
    SaveSystem.save({ completed: true, currentLevel: 4 });
    SaveSystem.unlockAchievement('birthday_build');
    const state = SaveSystem.load();
    this.cameras.main.fadeIn(500);
    this.add.image(640, 360, 'art_birthday').setDisplaySize(1280, 720);
    this.add.rectangle(640, 67, 1280, 134, 0x020714, 0.9);
    this.add.text(640, 28, 'MISSÃO CONCLUÍDA  /  RELEASE v24.0.0', { ...Fonts.MONO, fontSize: '18px', color: '#7ceab9' }).setOrigin(0.5);
    this.add.text(640, 77, 'FELIZ ANIVERSÁRIO, NICOLAS!', { ...Fonts.TITLE, fontSize: '34px', color: '#f1edff' }).setOrigin(0.5);
    this.add.rectangle(640, 584, 1280, 272, 0x030916, 0.95);
    this.add.text(54, 471, '24 ANOS. UMA NOVA FASE COMEÇA.', { ...Fonts.MONO, fontSize: '25px', color: '#6ee7ff' });
    this.add.text(54, 515, 'Nem toda fase da vida vem com tutorial. Mas você nunca precisa enfrentar os bugs sozinho. Que o próximo ano venha com boas histórias, novas conquistas e muita gente ao seu lado.', { ...Fonts.MONO, fontSize: '23px', lineSpacing: 8, wordWrap: { width: 850 } });
    this.add.text(54, 637, 'Com carinho, do teu irmão Thomas Rangel Bugs.', { ...Fonts.MONO, fontSize: '22px', color: '#eda5d5' });
    this.add.text(54, 680, `4/4 fragmentos  ·  ${state.run.bugs} bugs corrigidos  ·  ${state.run.deaths} tentativas extras  ·  ${state.run.coffees} cafés`, { ...Fonts.MONO, fontSize: '18px', color: '#8fa9c9' });
    neonButton(this, 1090, 566, 'JOGAR NOVAMENTE', () => this.leave('IntroScene'), 280);
    neonButton(this, 1090, 630, 'MENU PRINCIPAL', () => this.leave('MenuScene'), 280);
    this.input.keyboard?.on('keydown-ENTER', e => { if (!e.repeat) this.leave('MenuScene'); });
    AudioSystem.playMusic(this, 'mus_ending');
    this.time.delayedCall(12000, () => AudioSystem.playMusic(this, 'mus_ending_soft', { fade: 1500 }));
  }
  leave(target) {
    if (this.doneOnce) return;
    this.doneOnce = true;
    AudioSystem.sfx(this, 'sfx_transition');
    this.scene.start(target);
  }
}
