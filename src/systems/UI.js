import { AudioSystem } from './AudioSystem.js';
import { Device } from './Device.js';

const TITLE = { fontFamily: 'Orbitron, sans-serif', color: '#e8f0ff' };
const PIXEL = { fontFamily: '"Press Start 2P", monospace', color: '#d7e4ff' };
const MONO = { fontFamily: '"Share Tech Mono", VT323, monospace', color: '#c5d4f5' };
const TERM = { fontFamily: 'VT323, monospace', color: '#76f7b0' };

export const Fonts = { TITLE, PIXEL, MONO, TERM };

export function addPanel(scene, x, y, w, h, key = 'ui_panel') {
  const img = scene.add.image(x, y, scene.textures.exists(key) ? key : 'ui_panel');
  img.setDisplaySize(w, h);
  return img;
}

/** Menu/action buttons — Share Tech Mono avoids Press Start 2P glyph clipping on long labels. */
export function neonButton(scene, x, y, label, onClick, width = 420, depth = 12) {
  const hoverKey = scene.textures.exists('ui_button_hover') ? 'ui_button_hover' : 'ui_button';
  const key = scene.textures.exists('ui_button') ? 'ui_button' : null;
  const h = Device.wantsTouchUI() ? 50 : 48;
  const hitW = width;
  const bg = key
    ? scene.add.image(x, y, key).setDisplaySize(hitW, h).setInteractive({ useHandCursor: true })
    : scene.add.rectangle(x, y, hitW, h, 0x0e1530, 0.92).setStrokeStyle(2, 0x4ce0ff).setInteractive({ useHandCursor: true });
  const fontSize = Device.wantsTouchUI() ? '22px' : '24px';
  const tx = scene.add.text(x, y, label, {
    ...MONO, fontSize, color: '#d7e4ff'
  }).setOrigin(0.5);
  const z = Number.isFinite(depth) ? depth : 12;
  bg.setDepth(z); tx.setDepth(z + 1);
  bg.on('pointerover', () => {
    if (bg.setTexture && key) bg.setTexture(hoverKey);
    else if (bg.setFillStyle) bg.setFillStyle(0x17224a);
    tx.setColor('#7cf5ff');
    AudioSystem.sfx(scene, AudioSystem.has(scene, 'sfx_select') ? 'sfx_select' : 'sfx_hover');
  });
  bg.on('pointerout', () => {
    if (bg.setTexture && key) bg.setTexture(key);
    else if (bg.setFillStyle) bg.setFillStyle(0x0e1530);
    tx.setColor('#d7e4ff');
  });
  bg.on('pointerdown', () => {
    AudioSystem.sfx(scene, AudioSystem.has(scene, 'sfx_confirm') ? 'sfx_confirm' : 'sfx_click');
    onClick();
  });
  return { bg, tx };
}

export function dialogBox(scene, x, y, w, h, portraitKey) {
  const panel = addPanel(scene, x, y, w, h, 'ui_dialog').setDepth(80);
  let portrait = null;
  if (portraitKey && scene.textures.exists(portraitKey)) {
    portrait = scene.add.image(x - w / 2 + 58, y, portraitKey).setDisplaySize(88, 88).setDepth(81);
  }
  return { panel, portrait };
}

export function glitchTitle(scene, x, y, text, style) {
  const main = scene.add.text(x, y, text, style).setOrigin(0.5);
  // Soft chromatic ghost — no frantic tween that makes glyphs vanish
  const ghost = scene.add.text(x + 2, y, text, { ...style, color: '#ff4f9a' }).setOrigin(0.5).setAlpha(0.22);
  const ghost2 = scene.add.text(x - 2, y, text, { ...style, color: '#4ce0ff' }).setOrigin(0.5).setAlpha(0.22);
  scene.tweens.add({
    targets: [ghost, ghost2],
    alpha: { from: 0.12, to: 0.28 },
    duration: 1400,
    yoyo: true,
    repeat: -1
  });
  scene.tweens.add({
    targets: main,
    alpha: { from: 0.92, to: 1 },
    duration: 1600,
    yoyo: true,
    repeat: -1
  });
  return main;
}
