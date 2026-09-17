import { SaveSystem } from './SaveSystem.js';

export const AudioSystem = {
  game: null,
  current: null,
  muted: false,
  musicVol: 0.45,
  sfxVol: 0.75,
  _fades: new Map(),

  init(game) {
    this.game = game;
    const s = SaveSystem.load().settings || {};
    this.musicVol = s.music ?? 0.45;
    this.sfxVol = s.sfx ?? 0.75;
    this.muted = !!s.muted;
    game.sound.mute = this.muted;
    try { game.sound.pauseOnBlur = true; } catch {}
  },

  unlock(scene) {
    try { scene.sound.unlock(); } catch {}
  },

  has(scene, key) {
    try {
      const cache = scene.cache?.audio;
      if (cache?.exists?.(key)) return true;
      if (cache?.has?.(key)) return true;
      return false;
    } catch {
      return false;
    }
  },

  _cancelFade(sound) {
    const job = this._fades.get(sound);
    if (!job) return;
    cancelAnimationFrame(job.raf);
    this._fades.delete(sound);
  },

  _fade(sound, to, duration, onComplete) {
    if (!sound) {
      onComplete?.();
      return;
    }
    this._cancelFade(sound);
    const from = typeof sound.volume === 'number' ? sound.volume : 0;
    if (!duration || duration <= 0) {
      try { sound.setVolume(to); } catch {}
      onComplete?.();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      if (!this._fades.has(sound)) return;
      const t = Math.min(1, (now - start) / duration);
      const vol = this.muted && sound === this.current ? 0 : from + (to - from) * t;
      try { sound.setVolume(vol); } catch {}
      if (t < 1) {
        const raf = requestAnimationFrame(step);
        const job = this._fades.get(sound);
        if (job) job.raf = raf;
      } else {
        this._fades.delete(sound);
        onComplete?.();
      }
    };
    this._fades.set(sound, { raf: requestAnimationFrame(step) });
  },

  playMusic(scene, key, { fade = 600, volume } = {}) {
    try {
      this.unlock(scene);
      if (!this.has(scene, key)) return;
      const target = this.muted ? 0 : (volume ?? this.musicVol);
      if (this.current?.key === key) {
        if (!this.current.isPlaying) this.current.play();
        this._fade(this.current, target, fade);
        return;
      }
      const prev = this.current;
      const next = scene.sound.add(key, { loop: true, volume: 0 });
      next.play();
      this._fade(next, target, fade);
      if (prev) {
        this._fade(prev, 0, fade, () => {
          try { prev.stop(); prev.destroy(); } catch {}
        });
      }
      this.current = next;
    } catch (err) {
      console.warn('[NICOLAS.EXE] música indisponível:', key, err?.message || err);
    }
  },

  sting(scene, key, { volume = 1 } = {}) {
    try {
      if (this.muted || !this.has(scene, key)) return;
      scene.sound.play(key, { volume: this.sfxVol * volume, loop: false });
    } catch {}
  },

  sfx(scene, key, { volume = 1, detune } = {}) {
    try {
      if (this.muted || !this.has(scene, key)) return;
      scene.sound.play(key, { volume: this.sfxVol * volume, detune });
    } catch {}
  },

  sfxExclusive(scene, key, opts = {}) {
    try { scene.sound.stopByKey(key); } catch {}
    this.sfx(scene, key, opts);
  },

  stopSfx(scene, key) {
    try { scene.sound.stopByKey(key); } catch {}
  },

  fadeOut(scene, fade = 400) {
    if (!this.current) return;
    const cur = this.current;
    this.current = null;
    this._fade(cur, 0, fade, () => {
      try { cur.stop(); cur.destroy(); } catch {}
    });
  },

  setMuted(scene, muted) {
    this.muted = muted;
    if (this.game?.sound) this.game.sound.mute = muted;
    SaveSystem.save({ settings: { ...SaveSystem.load().settings, muted } });
    if (this.current) {
      this._cancelFade(this.current);
      try { this.current.setVolume(muted ? 0 : this.musicVol); } catch {}
    }
  },

  toggleMute(scene) {
    this.setMuted(scene, !this.muted);
    return this.muted;
  }
};
