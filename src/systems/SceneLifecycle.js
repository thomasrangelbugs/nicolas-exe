import { VirtualPad } from './VirtualPad.js';

/** Each Scene is reused by Phaser, including its Clock and input keys. */
export function setupScene(scene) {
  scene.time.paused = false;
  scene.cameras.main.resetFX();
  scene.cameras.main.setAlpha(1);
  VirtualPad.setScene(null);
  scene.events.once('shutdown', () => {
    scene.input.keyboard?.removeAllListeners();
    scene.input.keyboard?.removeAllKeys(true);
    scene.time.paused = false;
    if (VirtualPad.scene === scene) VirtualPad.setScene(null);
  });
}
