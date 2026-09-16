import { AudioSystem } from '../systems/AudioSystem.js';
import { neonButton, Fonts } from '../systems/UI.js';
import { setupScene } from '../systems/SceneLifecycle.js';

const BEATS = {
  1: { title: 'PRIMEIRO COMMIT', text: 'O primeiro fragmento está seguro. Mas a Procrastinação bloqueou o próximo setor. Hora de seguir para Deadline Valley.', next: 'FASE 2 →' },
  2: { title: 'AMANHÃ É AGORA', text: 'A Procrastinação caiu. Dois fragmentos recuperados. O Deadline tomou conta de Production — e o relógio continua correndo.', next: 'FASE 3 →' },
  3: { title: 'DEPLOY AUTORIZADO', text: 'Production voltou a funcionar. Falta um fragmento. No coração de Legacy Code, o Ultimate Bug protege a última parte da festa.', next: 'FASE FINAL →' },
  4: { title: 'BUILD RESTAURADA', text: 'Os quatro fragmentos estão reunidos. O Ultimate Bug foi derrotado e o sistema está livre. A festa de Nicolas finalmente pode começar!', next: 'ABRIR A FESTA →' }
};
export class InterludeScene extends Phaser.Scene {
  constructor() { super('InterludeScene'); }
  init(data = {}) {
    this.level = [1,2,3,4].includes(Number(data.level)) ? Number(data.level) : 1;
    this.score = Number(data.score) || 0; this.coffees = Number(data.coffees) || 0; this.deaths = Number(data.deaths) || 0;
  }
  create() {
    setupScene(this);
    this.started = false; this.inputReady = false;
    const beat = BEATS[this.level];
    this.cameras.main.fadeIn(300);
    this.add.image(640, 360, `art_clear_${this.level}`).setDisplaySize(1280,720);
    this.add.rectangle(640, 575, 1280, 290, 0x040918, 0.95);
    this.add.text(52, 455, `FRAGMENTO ${this.level}/4 RECUPERADO`, { ...Fonts.MONO, fontSize: '19px', color: '#6ee7ff' });
    this.add.text(52, 491, beat.title, { ...Fonts.TITLE, fontSize: '31px', color: '#f3f5ff' });
    this.add.text(52, 545, beat.text, { ...Fonts.MONO, fontSize: '23px', color: '#c4d6ed', lineSpacing: 7, wordWrap: { width: 860 } });
    this.add.text(52, 668, `Bugs corrigidos: ${this.score}  ·  Cafés: ${this.coffees}  ·  Tentativas extras: ${this.deaths}`, { ...Fonts.MONO, fontSize: '19px', color: '#7ceab9' });
    neonButton(this, 1090, 646, beat.next, () => this.goNext(), 280, 20);
    this.add.text(1090, 689, 'ENTER ou toque no botão', { ...Fonts.MONO, fontSize: '15px', color: '#91a3bf' }).setOrigin(0.5);
    AudioSystem.playMusic(this, 'mus_victory', { fade: 200 });
    this.time.delayedCall(350, () => { this.inputReady = true; });
    const next = event => { if (!event.repeat) this.goNext(); };
    this.input.keyboard?.on('keydown-ENTER', next);
    this.input.keyboard?.on('keydown-SPACE', next);
  }
  goNext() {
    if (this.started || !this.inputReady) return;
    this.started = true;
    AudioSystem.sfx(this, 'sfx_transition');
    this.scene.start(this.level < 4 ? 'GameScene' : 'CompleteScene', { level: this.level + 1 });
  }
}
