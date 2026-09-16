import { Device } from './Device.js';
import { AudioSystem } from './AudioSystem.js';

export const VirtualPad = {
  left: false,
  right: false,
  run: false,
  jumpHeld: false,
  attackHeld: false,
  defendHeld: false,
  scene: null,
  _jump: false,
  _attack: false,
  _pause: false,
  bound: false,

  consume(name) {
    const key = `_${name}`;
    if (this[key]) {
      this[key] = false;
      return true;
    }
    return false;
  },

  reset() {
    this.left = this.right = this.run = false;
    this.jumpHeld = this.attackHeld = this.defendHeld = false;
    this._jump = this._attack = this._pause = false;
    document.querySelectorAll('[data-btn].active').forEach(b => b.classList.remove('active'));
  },

  setScene(scene) {
    this.reset();
    this.scene = scene;
    this.showForScene(scene);
  },

  refreshScale() {
    requestAnimationFrame(() => {
      try { Device.game?.scale.refresh(); } catch {}
    });
  },

  showForScene(scene) {
    const play = !!(Device.wantsTouchUI() && scene?.sys?.settings?.key === 'GameScene');
    const left = document.getElementById('rail-left');
    const right = document.getElementById('rail-right');
    const shell = document.getElementById('game-shell');
    const fs = document.getElementById('chrome-fs');
    if (!Device.wantsTouchUI()) {
      if (left) left.hidden = true;
      if (right) right.hidden = true;
      shell?.classList.remove('emu-layout');
      if (fs) fs.hidden = true;
      document.body.classList.add('is-desktop');
      document.body.classList.remove('is-touch');
      this.refreshScale();
      return;
    }
    if (left) left.hidden = !play;
    if (right) right.hidden = !play;
    shell?.classList.toggle('emu-layout', play);
    if (fs) fs.hidden = play || !Device.wantsTouchUI();
    this.refreshScale();
  },

  bind() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    const shell = document.getElementById('game-shell');
    if (!shell) return;

    const hold = (btn, on, off) => {
      const start = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        btn.setPointerCapture?.(ev.pointerId);
        btn.classList.add('active');
        on();
      };
      const end = (ev) => {
        ev.preventDefault();
        btn.classList.remove('active');
        off();
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('pointercancel', end);
      btn.addEventListener('lostpointercapture', end);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    const tap = (btn, fn) => {
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        btn.classList.add('active');
        fn();
      });
      btn.addEventListener('pointerup', () => btn.classList.remove('active'));
      btn.addEventListener('pointerleave', () => btn.classList.remove('active'));
      btn.addEventListener('pointercancel', () => btn.classList.remove('active'));
    };

    shell.querySelectorAll('[data-btn]').forEach((btn) => {
      const id = btn.dataset.btn;
      if (id === 'left') hold(btn, () => { this.left = true; }, () => { this.left = false; });
      else if (id === 'right') hold(btn, () => { this.right = true; }, () => { this.right = false; });
      else if (id === 'run') hold(btn, () => { this.run = true; }, () => { this.run = false; });
      else if (id === 'jump') {
        hold(btn, () => { this.jumpHeld = true; this._jump = true; }, () => { this.jumpHeld = false; });
      } else if (id === 'attack') {
        hold(btn, () => { this.attackHeld = true; this._attack = true; }, () => { this.attackHeld = false; });
      } else if (id === 'defend') {
        hold(btn, () => { this.defendHeld = true; }, () => { this.defendHeld = false; });
      } else if (id === 'pause') {
        tap(btn, () => {
          this._pause = true;
          this.scene?.togglePause?.();
        });
      } else if (id === 'mute') {
        tap(btn, () => {
          if (!this.scene) return;
          AudioSystem.toggleMute(this.scene);
          this.scene.muteBtn?.setText(AudioSystem.muted ? 'M' : '♪');
          btn.textContent = AudioSystem.muted ? 'M' : '♪';
        });
      } else if (id === 'fs') {
        tap(btn, () => Device.toggleFullscreen());
      }
    });

    document.getElementById('rotate-dismiss')?.addEventListener('click', () => {
      const hint = document.getElementById('rotate-hint');
      if (hint) {
        hint.dataset.dismissed = '1';
        hint.hidden = true;
      }
    });

    document.getElementById('chrome-fs')?.addEventListener('click', () => Device.toggleFullscreen());
  }
};
