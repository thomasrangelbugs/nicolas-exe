#!/usr/bin/env python3
"""Rebuild walk cycle from A/B/C poses and clean spaced jump sheet."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAYER = ROOT / "assets" / "sprites" / "player"
GEN = ROOT / "assets" / "sprites" / "_gen"
CURSOR = Path(
    r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-Downloads-Thomas-THOMAS-projetos-NICOLAS-EXE\assets"
)
FW, FH = 96, 128
GUTTER = 8


def solidify(im: Image.Image, thresh: int = 50) -> Image.Image:
    arr = np.array(im.convert("RGBA"), dtype=np.uint8)
    rgb = arr[..., :3].astype(np.int16)
    a = arr[..., 3]
    dark = rgb.max(axis=-1) < 28
    keep = (a >= thresh) & ~dark
    arr[~keep] = (0, 0, 0, 0)
    arr[keep, 3] = 255
    return Image.fromarray(arr, "RGBA")


def content_bbox(im: Image.Image, pad: int = 1):
    arr = np.array(im)
    ys, xs = np.where(arr[..., 3] > 20)
    if len(xs) == 0:
        return None
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + pad + 1),
        min(im.height, int(ys.max()) + pad + 1),
    )


def fit(src: Image.Image) -> Image.Image:
    src = solidify(src)
    bb = content_bbox(src)
    if not bb:
        return Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    char = src.crop(bb)
    max_w, max_h = FW - 2 * GUTTER, int(FH * 0.88)
    scale = min(max_w / char.width, max_h / char.height)
    nw, nh = max(1, int(char.width * scale)), max(1, int(char.height * scale))
    char = solidify(char.resize((nw, nh), Image.Resampling.LANCZOS), 55)
    canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    x = (FW - nw) // 2
    y = FH - nh - 4
    canvas.paste(char, (x, y), char)
    arr = np.array(canvas)
    arr[:, :GUTTER, 3] = 0
    arr[:, -GUTTER:, 3] = 0
    return Image.fromarray(arr, "RGBA")


def strip(frames: list[Image.Image]) -> Image.Image:
    fitted = [fit(f) for f in frames]
    out = Image.new("RGBA", (FW * len(fitted), FH), (0, 0, 0, 0))
    for i, fr in enumerate(fitted):
        out.paste(fr, (i * FW, 0), fr)
    return out


def load_pose(name: str) -> Image.Image:
    for base in (CURSOR, GEN, ROOT / "assets"):
        p = base / name
        if p.exists():
            (GEN / name).write_bytes(p.read_bytes())
            return solidify(Image.open(p))
    raise FileNotFoundError(name)


def split_spaced(im: Image.Image, expected: int) -> list[Image.Image]:
    arr = np.array(im)
    col = (arr[..., 3] > 20).any(axis=0)
    segs = []
    i, w = 0, len(col)
    while i < w:
        if not col[i]:
            i += 1
            continue
        j = i
        while j < w and col[j]:
            j += 1
        if j - i > 12:
            segs.append((i, j))
        i = j
    # Prefer largest expected segments
    if len(segs) > expected:
        segs = sorted(segs, key=lambda s: s[1] - s[0], reverse=True)[:expected]
        segs = sorted(segs, key=lambda s: s[0])
    frames = []
    for a, b in segs:
        crop = im.crop((a, 0, b, im.height))
        bb = content_bbox(crop, pad=2)
        if bb:
            frames.append(crop.crop(bb))
    return frames


def main():
    GEN.mkdir(parents=True, exist_ok=True)
    a = load_pose("walk_A.png")
    b = load_pose("walk_B.png")
    c = load_pose("walk_C.png")
    # Classic 2-step walk with contact: A C B C A C B C A B
    walk_cycle = [a, c, b, c, a, c, b, c, a, b]
    strip(walk_cycle).save(PLAYER / "walk.png")
    print("walk.png: A/C/B alternating cycle (10 frames)")

    # Light run: same opposite legs but we'll reuse A/B with C less often
    run_cycle = [a, a, b, b, a, c, b, b, a, b]
    strip(run_cycle).save(PLAYER / "run.png")
    print("run.png: stronger A/B alternation")

    jump_src = load_pose("jump_spaced.png")
    jumps = split_spaced(jump_src, 6)
    print("jump source frames:", len(jumps))
    if len(jumps) >= 4:
        # pad to 6 if needed
        while len(jumps) < 6:
            jumps.append(jumps[-1])
        jumps = jumps[:6]
        strip(jumps).save(PLAYER / "jump.png")
        # fall from mid-air poses
        fall = [jumps[2], jumps[3], jumps[min(4, len(jumps) - 1)], jumps[-1]]
        strip(fall).save(PLAYER / "fall.png")
        print("jump.png / fall.png rebuilt from spaced sheet")
    else:
        print("WARN: jump split failed, keeping existing")

    # Verify uniqueness
    import hashlib
    for name in ("walk", "run", "jump"):
        im = np.array(Image.open(PLAYER / f"{name}.png"))
        n = im.shape[1] // FW
        hs = [hashlib.md5(im[:, i * FW:(i + 1) * FW].tobytes()).hexdigest()[:8] for i in range(n)]
        print(name, "unique", len(set(hs)), "/", n, hs)


if __name__ == "__main__":
    main()
