#!/usr/bin/env python3
"""Install better ending/victory music and distinct shoot SFX (original synth + CC0 downloads)."""
from __future__ import annotations

import math
import shutil
import struct
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MUS = ROOT / "assets" / "audio" / "music"
SFX = ROOT / "assets" / "audio" / "sfx"
DL = ROOT / "assets" / "audio" / "_dl"
SR = 44100


def write_wav(path: Path, buf: np.ndarray, sr: int = SR):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(buf, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    print("wrote", path.relative_to(ROOT), path.stat().st_size)


def env(n, a=0.01, d=0.08, s=0.55, r=0.2):
    e = np.zeros(n, dtype=np.float32)
    na, nd, nr = int(a * n), int(d * n), int(r * n)
    ns = max(0, n - na - nd - nr)
    i = 0
    if na:
        e[i:i + na] = np.linspace(0, 1, na); i += na
    if nd:
        e[i:i + nd] = np.linspace(1, s, nd); i += nd
    if ns:
        e[i:i + ns] = s; i += ns
    if nr:
        e[i:i + nr] = np.linspace(s, 0, nr)
    return e


def sine_sweep(f0, f1, dur, vol=0.35, a=0.002, d=0.05, s=0.35, r=0.2):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    freq = np.linspace(f0, f1, n)
    ph = np.cumsum(2 * np.pi * freq / SR)
    return (np.sin(ph) * env(n, a, d, s, r) * vol).astype(np.float32)


def noise_burst(dur, vol=0.2, band=0.3):
    n = max(1, int(dur * SR))
    rng = np.random.default_rng(42)
    noise = rng.uniform(-1, 1, n).astype(np.float32)
    # crude one-pole lowpass
    out = np.zeros_like(noise)
    lp = 0.0
    for i, x in enumerate(noise):
        lp = lp + band * (x - lp)
        out[i] = lp
    return out * env(n, 0.001, 0.04, 0.25, 0.35) * vol


def player_shoot():
    """Clean cyan-laser: bright sine chirp + soft click — not square-stack."""
    a = sine_sweep(1680, 920, 0.09, vol=0.42, a=0.001, d=0.03, s=0.25, r=0.35)
    b = sine_sweep(3200, 1800, 0.05, vol=0.18, a=0.001, d=0.02, s=0.15, r=0.25)
    click = sine_sweep(240, 90, 0.035, vol=0.22, a=0.001, d=0.02, s=0.1, r=0.2)
    n = max(len(a), len(b), len(click))
    buf = np.zeros(n, dtype=np.float32)
    buf[:len(a)] += a
    buf[:len(b)] += b
    buf[:len(click)] += click
    return buf


def enemy_shoot():
    """Harsh glitch zap — clearly different from player laser."""
    a = sine_sweep(420, 180, 0.11, vol=0.28, a=0.002, d=0.04, s=0.3, r=0.35)
    buzz_n = int(0.1 * SR)
    t = np.arange(buzz_n) / SR
    buzz = np.sign(np.sin(2 * np.pi * (380 + 60 * np.sin(2 * np.pi * 40 * t)) * t))
    buzz = (buzz * env(buzz_n, 0.002, 0.05, 0.35, 0.3) * 0.16).astype(np.float32)
    grit = noise_burst(0.08, vol=0.14, band=0.55)
    n = max(len(a), len(buzz), len(grit))
    buf = np.zeros(n, dtype=np.float32)
    buf[:len(a)] += a
    buf[:len(buzz)] += buzz
    buf[:len(grit)] += grit
    return buf


def soft_transition():
    """Warm whoosh for scene changes — single gesture, not beep stack."""
    whoosh = noise_burst(0.35, vol=0.22, band=0.12)
    tone = sine_sweep(220, 520, 0.28, vol=0.18, a=0.05, d=0.1, s=0.4, r=0.4)
    n = max(len(whoosh), len(tone))
    buf = np.zeros(n, dtype=np.float32)
    buf[:len(whoosh)] += whoosh
    buf[:len(tone)] += tone
    return buf


def pad_ending_soft(seconds=28.0):
    """Warm non-chiptune pad for birthday — few slow sine layers, no arps/drums."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    # slow evolving chords (Am – F – C – G feel via MIDI)
    chords = [
        [57, 60, 64],  # A3 C4 E4
        [53, 57, 60],  # F3 A3 C4
        [55, 59, 62],  # G3 B3 D4
        [52, 55, 60],  # E3 G3 C4
    ]
    buf = np.zeros(n, dtype=np.float32)
    seg = n // len(chords)
    fade = int(0.8 * SR)
    for ci, chord in enumerate(chords):
        start = ci * seg
        end = n if ci == len(chords) - 1 else (ci + 1) * seg
        sl = end - start
        local = np.zeros(sl, dtype=np.float32)
        tt = np.arange(sl) / SR
        for midi in chord:
            f = 440.0 * (2 ** ((midi - 69) / 12.0))
            # gentle vibrato
            vib = f * (1 + 0.003 * np.sin(2 * np.pi * 0.35 * tt))
            ph = np.cumsum(2 * np.pi * vib / SR)
            local += (np.sin(ph) * 0.11).astype(np.float32)
            # soft octave shimmer
            ph2 = np.cumsum(2 * np.pi * (vib * 2) / SR)
            local += (np.sin(ph2) * 0.035).astype(np.float32)
        # segment envelope
        env_seg = np.ones(sl, dtype=np.float32)
        env_seg[: min(fade, sl)] *= np.linspace(0, 1, min(fade, sl))
        env_seg[-min(fade, sl):] *= np.linspace(1, 0, min(fade, sl))
        buf[start:end] += local * env_seg
    # global edges for looping
    edge = int(0.15 * SR)
    buf[:edge] *= np.linspace(0, 1, edge)
    buf[-edge:] *= np.linspace(1, 0, edge)
    return np.clip(buf, -1, 1).astype(np.float32)


def install_music():
    backup = ROOT / "assets" / "audio" / "_music_backup"
    backup.mkdir(parents=True, exist_ok=True)

    def bak(name):
        src = MUS / name
        if src.exists() and not (backup / name).exists():
            shutil.copy2(src, backup / name)

    # Victory / interlude — happy end (CC0)
    if (DL / "happy_end.ogg").exists() and (DL / "happy_end.ogg").stat().st_size > 10000:
        bak("victory.ogg")
        shutil.copy2(DL / "happy_end.ogg", MUS / "victory.ogg")
        print("installed victory.ogg from happy_end (CC0)")
    # Birthday ending — orchestral emotional mix (CC0)
    if (DL / "fantasyorchestralthememix2.ogg").exists():
        bak("ending.mp3")
        # Boot loads ending.mp3 — keep filename or update BootScene.
        # Prefer converting path: copy as ending.ogg and update boot; also keep mp3 replaced by wav conversion.
        shutil.copy2(DL / "fantasyorchestralthememix2.ogg", MUS / "ending.ogg")
        print("installed ending.ogg (CC0 orchestral)")
    # Soft ending — prefer Diamond Dust good ending if present, else warm pad
    if (DL / "goodending.wav").exists() and (DL / "goodending.wav").stat().st_size > 10000:
        bak("ending_soft.wav")
        shutil.copy2(DL / "goodending.wav", MUS / "ending_soft.wav")
        print("installed ending_soft.wav from goodending (CC0)")
    else:
        bak("ending_soft.wav")
        write_wav(MUS / "ending_soft.wav", pad_ending_soft())


def main():
    install_music()
    write_wav(SFX / "shoot.wav", player_shoot())
    write_wav(SFX / "enemy_shot.wav", enemy_shoot())
    write_wav(SFX / "transition.wav", soft_transition())
    if not (MUS / "ending_soft.wav").exists() or (MUS / "ending_soft.wav").stat().st_size < 50000:
        write_wav(MUS / "ending_soft.wav", pad_ending_soft())
    print("audio install done")
    print("Update BootScene paths: shoot.wav, enemy_shot.wav, transition.wav, ending.ogg")


if __name__ == "__main__":
    main()
