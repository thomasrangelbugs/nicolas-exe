import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CompleteScene } from './scenes/CompleteScene.js';
import { InterludeScene } from './scenes/InterludeScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { Device } from './systems/Device.js';
import { VirtualPad } from './systems/VirtualPad.js';

const testMode = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('test');
const config = {
  type: testMode && new URLSearchParams(location.search).get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#050711',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
    parent: 'game',
    fullscreenTarget: 'game-shell',
    expandParent: false,
    autoRound: true,
    min: { width: 320, height: 180 },
    max: { width: 3840, height: 2160 }
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1150 }, debug: false }
  },
  input: {
    activePointers: 4,
    touch: { capture: true }
  },
  render: { antialias: true, pixelArt: false, roundPixels: true },
  audio: { disableWebAudio: false },
  scene: [BootScene, MenuScene, IntroScene, GameScene, InterludeScene, CompleteScene, CreditsScene]
};

const game = new Phaser.Game(config);
Device.install(game);
VirtualPad.bind();
Device.applyScaleMode();
game.events.on('hidden', () => {
  const scene = game.scene.getScene('GameScene');
  if (scene?.sys.isActive() && !scene.paused && !scene.finished && !scene.playerDying) scene.togglePause();
  VirtualPad.reset();
  try { game.sound.pauseAll(); } catch {}
});
game.events.on('visible', () => { try { game.sound.resumeAll(); } catch {} });

// Test harness receives this event only when explicitly enabled on localhost.
if (testMode) {
  window.__game = game;
  import('../tests/browser-harness.js').then(m => m.install(game));
}
