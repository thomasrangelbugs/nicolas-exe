#!/usr/bin/env python3
"""Generate original CC0-equivalent soundtrack loops (created for this project)."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MUS = ROOT / "assets" / "audio" / "music"
SFX = ROOT / "assets" / "audio" / "sfx"
SR = 22050


def midi(n):
    return 440.0 * (2 ** ((n - 69) / 12.0))


def env(n, a=0.01, d=0.08, s=0.6, r=0.12):
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


def osc(kind, freq, n):
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 * np.abs(2 * (t * freq % 1) - 1) - 1
    if kind == "square":
        return np.sign(np.sin(ph) + 1e-9)
    if kind == "saw":
        return 2 * (t * freq % 1) - 1
    if kind == "noise":
        return np.random.default_rng(n).uniform(-1, 1, n)
    return np.sin(ph)


def note(kind, freq, dur, vol=0.2, **e):
    n = max(1, int(dur * SR))
    return (osc(kind, freq, n) * env(n, **e) * vol).astype(np.float32)


def mix_at(buf, pos, sig):
    end = min(len(buf), pos + len(sig))
    sl = end - pos
    if sl > 0:
        buf[pos:end] += sig[:sl]


def render_loop(seconds, bpm, seq, bass, arp, drums=True, mood="cyber"):
    n = int(seconds * SR)
    buf = np.zeros(n, dtype=np.float32)
    beat = 60.0 / bpm
    step = beat / 4.0
    rng = np.random.default_rng(2026)
    t = 0.0
    i = 0
    while t < seconds - 0.05:
        pos = int(t * SR)
        degree = seq[i % len(seq)]
        freq = midi(degree)
        kind = "tri" if mood == "soft" else "square"
        mix_at(buf, pos, note(kind, freq, step * 1.6, 0.09 if mood == "soft" else 0.07, a=0.01, d=0.05, s=0.4, r=0.2))
        bf = midi(bass[i % len(bass)])
        mix_at(buf, pos, note("sine", bf, step * 2.2, 0.14, a=0.01, d=0.08, s=0.5, r=0.2))
        mix_at(buf, pos, note("sine", bf / 2, step * 2.2, 0.08))
        af = midi(arp[i % len(arp)])
        mix_at(buf, pos, note("tri", af, step * 0.7, 0.05, a=0.005, d=0.04, s=0.2, r=0.1))
        if drums:
            if i % 4 == 0:
                mix_at(buf, pos, note("sine", 70, 0.12, 0.22, a=0.001, d=0.05, s=0.2, r=0.08))
            if i % 4 == 2:
                ns = osc("noise", 0, int(0.08 * SR)) * env(int(0.08 * SR), 0.001, 0.03, 0.1, 0.05) * 0.08
                mix_at(buf, pos, ns.astype(np.float32))
            if i % 2 == 0:
                mix_at(buf, pos, note("sine", 1800, 0.02, 0.03, a=0.001, d=0.01, s=0.1, r=0.01))
        i += 1
        t += step
    # gentle fade edges for looping
    fade = int(0.04 * SR)
    buf[:fade] *= np.linspace(0, 1, fade)
    buf[-fade:] *= np.linspace(1, 0, fade)
    buf = np.clip(buf, -1, 1)
    return buf


def write_wav(path, buf):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (buf * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wav", path.name, path.stat().st_size)


def write_if_missing(name, buf):
    mp3 = MUS / name.replace(".wav", ".mp3")
    ogg = MUS / name.replace(".wav", ".ogg")
    wav = MUS / name
    if mp3.exists() and mp3.stat().st_size > 10000:
        print("keep", mp3.name)
        return
    if ogg.exists() and ogg.stat().st_size > 10000:
        print("keep", ogg.name)
        return
    write_wav(wav, buf)


def sfx_tone(path, kind, f0, f1, dur, vol=0.3):
    n = int(dur * SR)
    t = np.linspace(0, dur, n)
    freq = np.linspace(f0, f1, n)
    ph = np.cumsum(2 * np.pi * freq / SR)
    sig = np.sin(ph) if kind == "sine" else np.sign(np.sin(ph))
    sig *= env(n, 0.005, 0.08, 0.4, 0.2) * vol
    write_wav(path, np.clip(sig, -1, 1).astype(np.float32))


def main():
    MUS.mkdir(parents=True, exist_ok=True)
    # Original extra tracks (used if OGA file is missing, and always for intro/victory/ending soft)
    write_if_missing("intro.wav", render_loop(18, 72, [57, 60, 64, 60], [45, 45, 43, 45], [72, 76, 79, 76], drums=False, mood="soft"))
    write_if_missing("victory.wav", render_loop(12, 110, [60, 64, 67, 72, 67, 64], [48, 48, 50, 52], [72, 76, 79, 84], True, "cyber"))
    write_if_missing("ending_soft.wav", render_loop(24, 68, [64, 67, 71, 67, 64, 62], [40, 43, 45, 43], [76, 79, 83, 79], drums=False, mood="soft"))
    # backups for any failed downloads
    write_if_missing("menu.wav", render_loop(20, 90, [57, 60, 64, 62], [45, 45, 48, 45], [69, 72, 76, 72], True, "cyber"))
    write_if_missing("level1.wav", render_loop(16, 112, [60, 62, 64, 67], [48, 48, 45, 48], [72, 76, 79, 76], True, "cyber"))
    write_if_missing("level2.wav", render_loop(16, 118, [56, 59, 63, 66], [44, 44, 47, 44], [68, 71, 75, 71], True, "cyber"))
    write_if_missing("level3.wav", render_loop(16, 124, [59, 62, 66, 69], [47, 47, 50, 47], [71, 74, 78, 74], True, "cyber"))
    write_if_missing("level4.wav", render_loop(18, 96, [53, 56, 60, 58], [41, 41, 44, 41], [65, 68, 72, 68], True, "cyber"))
    write_if_missing("boss.wav", render_loop(16, 140, [52, 55, 58, 61, 58, 55], [40, 40, 38, 40], [64, 67, 70, 73], True, "cyber"))
    write_if_missing("boss_final.wav", render_loop(16, 148, [49, 52, 56, 59, 56, 52], [37, 37, 40, 37], [61, 64, 68, 71], True, "cyber"))
    write_if_missing("ending.wav", render_loop(24, 68, [64, 67, 71, 67, 64, 62], [40, 43, 45, 43], [76, 79, 83, 79], drums=False, mood="soft"))
    print("audio extra ok")


if __name__ == "__main__":
    main()
