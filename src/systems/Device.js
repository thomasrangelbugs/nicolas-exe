/** Device + viewport: fit game inside normal browser window (F11 optional). */

export const Device = {
  game: null,
  forceTouch: null,

  isMobileUA() {
    try {
      const ua = navigator.userAgent || '';
      if (/Android|iPhone|iPod|Mobile|IEMobile|BlackBerry/i.test(ua)) return true;
      if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
      return false;
    } catch {
      return false;
    }
  },

  wantsTouchUI() {
    if (this.forceTouch === true) return true;
    if (this.forceTouch === false) return false;
    return this.isMobileUA();
  },

  isPortrait() {
    return window.innerHeight > window.innerWidth;
  },

  applyScaleMode() {
    const g = this.game;
    if (!g?.scale) return;
    try {
      if (typeof g.scale.setScaleMode === 'function') g.scale.setScaleMode(Phaser.Scale.FIT);
      else g.scale.scaleMode = Phaser.Scale.FIT;
      g.scale.refresh();
    } catch (err) {
      console.warn('[NICOLAS.EXE] scale', err);
    }
  },

  install(game) {
    this.game = game;
    document.body.classList.add(this.wantsTouchUI() ? 'is-touch' : 'is-desktop');

    const refresh = () => {
      this.applyScaleMode();
      this.syncChrome();
    };

    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(refresh, 250), { passive: true });
    window.visualViewport?.addEventListener('resize', refresh, { passive: true });
    document.addEventListener('fullscreenchange', refresh);
    document.addEventListener('webkitfullscreenchange', refresh);

    const gameEl = document.getElementById('game');
    if (typeof ResizeObserver !== 'undefined' && gameEl) {
      new ResizeObserver(() => { try { game.scale.refresh(); } catch {} }).observe(gameEl);
    }

    const shell = document.getElementById('game-shell');
    shell?.addEventListener('touchmove', (ev) => {
      if (ev.target?.closest?.('button, a, input')) return;
      ev.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => {
      if (this.wantsTouchUI()) e.preventDefault();
    });

    game.events.once('ready', refresh);
    [0, 100, 400].forEach((ms) => setTimeout(refresh, ms));
    refresh();
  },

  syncChrome() {
    const touch = this.wantsTouchUI();
    document.body.classList.toggle('is-touch', touch);
    document.body.classList.toggle('is-desktop', !touch);
    document.body.classList.toggle('is-portrait', this.isPortrait());
    document.body.classList.toggle('is-landscape', !this.isPortrait());
    const hint = document.getElementById('rotate-hint');
    if (hint && !hint.dataset.dismissed) {
      hint.hidden = !(touch && this.isPortrait());
    }
    const playing = document.getElementById('game-shell')?.classList.contains('emu-layout');
    const fs = document.getElementById('chrome-fs');
    if (fs) fs.hidden = !!playing || !touch;
    if (!touch) {
      document.getElementById('rail-left')?.setAttribute('hidden', '');
      document.getElementById('rail-right')?.setAttribute('hidden', '');
      document.getElementById('game-shell')?.classList.remove('emu-layout');
    }
  },

  async toggleFullscreen() {
    const el = document.getElementById('game-shell') || document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      } else {
        await (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      }
    } catch (err) {
      console.warn('[NICOLAS.EXE] fullscreen indisponível.', err?.message || err);
    }
  }
};
