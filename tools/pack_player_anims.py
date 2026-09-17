#!/usr/bin/env python3
"""Pack AI-generated Nicolas action sheets into 96x128 game strips."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "assets" / "sprites" / "_gen"
OUT = ROOT / "assets" / "sprites" / "player"
BACKUP = ROOT / "assets" / "sprites" / "player_backup_pre_anim"
FW, FH = 96, 128


def to_rgba(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")


def punch_bg(im: Image.Image) -> Image.Image:
    """Make near-black / solid purple studio backdrops transparent."""
    arr = np.array(to_rgba(im), dtype=np.uint8)
    rgb = arr[..., :3].astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dark = (r < 28) & (g < 28) & (b < 28)
    # magenta / purple studio backdrops from some gens
    purple = (r > 60) & (b > 60) & (g < r * 0.72) & (g < b * 0.85) & ((r + b) > 160)
    # flat near-solid dark purple
    flat_purple = (np.abs(r.astype(int) - b) < 40) & (g < 50) & (r > 40) & (r < 160) & (b > 40)
    mask = dark | purple | flat_purple
    arr[mask, 3] = 0
    return Image.fromarray(arr, "RGBA")


def content_bbox(im: Image.Image, pad: int = 2) -> tuple[int, int, int, int] | None:
    arr = np.array(im)
    a = arr[..., 3]
    ys, xs = np.where(a > 18)
    if len(xs) == 0:
        return None
    x0, x1 = int(xs.min()) - pad, int(xs.max()) + pad + 1
    y0, y1 = int(ys.min()) - pad, int(ys.max()) + pad + 1
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(im.width, x1), min(im.height, y1)
    return x0, y0, x1, y1


def split_columns(im: Image.Image, expected: int | None = None) -> list[Image.Image]:
    arr = np.array(im)
    alpha = arr[..., 3] > 18
    col = alpha.any(axis=0)
    segments: list[tuple[int, int]] = []
    i, w = 0, len(col)
    while i < w:
        if not col[i]:
            i += 1
            continue
        j = i
        while j < w and col[j]:
            j += 1
        if j - i > 8:
            segments.append((i, j))
        i = j
    if not segments:
        return []

    # Merge tiny gap splits if we got too many pieces
    if expected and len(segments) > expected * 1.5:
        merged: list[tuple[int, int]] = []
        gap_limit = max(6, im.width // (expected * 18))
        cur_a, cur_b = segments[0]
        for a, b in segments[1:]:
            if a - cur_b <= gap_limit:
                cur_b = b
            else:
                merged.append((cur_a, cur_b))
                cur_a, cur_b = a, b
        merged.append((cur_a, cur_b))
        segments = merged

    # If still too many, keep the largest N by width
    if expected and len(segments) > expected:
        segments = sorted(segments, key=lambda s: s[1] - s[0], reverse=True)[:expected]
        segments = sorted(segments, key=lambda s: s[0])

    # If too few, equal-slice the full content bbox
    if expected and len(segments) < expected:
        bb = content_bbox(im)
        if bb:
            x0, y0, x1, y1 = bb
            slice_w = (x1 - x0) / expected
            segments = [(int(x0 + k * slice_w), int(x0 + (k + 1) * slice_w)) for k in range(expected)]

    frames = []
    for a, b in segments:
        crop = im.crop((a, 0, b, im.height))
        bb = content_bbox(crop)
        if not bb:
            continue
        frames.append(crop.crop(bb))
    return frames


def fit_frame(src: Image.Image, fw: int = FW, fh: int = FH) -> Image.Image:
    """Scale character into frame; feet near bottom, horizontally centered."""
    src = to_rgba(src)
    bb = content_bbox(src, pad=1)
    if not bb:
        return Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    char = src.crop(bb)
    # leave ~6% headroom top, ~4% foot padding
    max_w, max_h = int(fw * 0.92), int(fh * 0.90)
    scale = min(max_w / char.width, max_h / char.height)
    nw, nh = max(1, int(char.width * scale)), max(1, int(char.height * scale))
    char = char.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    x = (fw - nw) // 2
    y = fh - nh - max(2, int(fh * 0.03))
    canvas.paste(char, (x, y), char)
    return canvas


def normalize_pair(a: Image.Image, b: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Fit both into the same canvas so Image.blend can interpolate."""
    a, b = to_rgba(a), to_rgba(b)
    w = max(a.width, b.width)
    h = max(a.height, b.height)
    ca = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cb = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ca.paste(a, ((w - a.width) // 2, h - a.height), a)
    cb.paste(b, ((w - b.width) // 2, h - b.height), b)
    return ca, cb


def blend(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    ca, cb = normalize_pair(a, b)
    return Image.blend(ca, cb, t)


def expand_cycle(frames: list[Image.Image], count: int) -> list[Image.Image]:
    if not frames:
        raise ValueError("no frames")
    if len(frames) == count:
        return frames
    if len(frames) > count:
        idxs = [int(round(i * (len(frames) - 1) / (count - 1))) for i in range(count)]
        return [frames[i] for i in idxs]
    # Prefer duplicating key poses over ghostly crossfades when gap is large
    if count <= len(frames) * 2:
        out = [frames[0]]
        need = count - len(frames)
        gaps = max(1, len(frames) - 1)
        extras = [need // gaps] * gaps
        for i in range(need % gaps):
            extras[i] += 1
        for i in range(gaps):
            for e in range(extras[i]):
                t = (e + 1) / (extras[i] + 1)
                out.append(blend(frames[i], frames[i + 1], t))
            out.append(frames[i + 1])
        return out[:count]
    # Fallback: sample with wrap for walk/run feel
    out = []
    for i in range(count):
        t = i / count * len(frames)
        i0 = int(t) % len(frames)
        i1 = (i0 + 1) % len(frames)
        out.append(blend(frames[i0], frames[i1], t - int(t)))
    return out


def strip(frames: list[Image.Image]) -> Image.Image:
    fitted = [fit_frame(f) for f in frames]
    sheet = Image.new("RGBA", (FW * len(fitted), FH), (0, 0, 0, 0))
    for i, fr in enumerate(fitted):
        sheet.paste(fr, (i * FW, 0), fr)
    return sheet


def load_split(name: str, expected: int) -> list[Image.Image]:
    path = GEN / name
    im = punch_bg(Image.open(path))
    frames = split_columns(im, expected=expected)
    print(f"  {name}: {len(frames)} frames (wanted ~{expected})")
    return frames


def backup_player():
    BACKUP.mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("*.png"):
        if p.name.startswith("_"):
            continue
        dest = BACKUP / p.name
        if not dest.exists():
            dest.write_bytes(p.read_bytes())


def main():
    backup_player()
    print("Packing player animation sheets…")

    walk = load_split("nicolas_walk_varied.png", 5)
    if len(walk) < 4:
        walk = load_split("nicolas_walk_sheet2.png", 5)
    walk_frames = expand_cycle(walk, 10)
    strip(walk_frames).save(OUT / "walk.png")
    print("  wrote walk.png (10)")

    run = load_split("nicolas_run_varied.png", 5)
    if len(run) < 4:
        run = load_split("nicolas_run_sheet.png", 5)
    run_frames = expand_cycle(run, 10)
    strip(run_frames).save(OUT / "run.png")
    print("  wrote run.png (10)")

    jump = load_split("nicolas_jump_sheet.png", 6)
    jump_frames = expand_cycle(jump, 6)
    strip(jump_frames).save(OUT / "jump.png")
    print("  wrote jump.png (6)")

    fall = load_split("nicolas_fall_sheet.png", 4)
    # Prefer mid-air-ish frames from jump if fall split is weak
    if len(fall) < 3 and len(jump) >= 4:
        fall = [jump[2], jump[3], jump[min(4, len(jump) - 1)], jump[-1]]
    fall_frames = expand_cycle(fall, 4)
    strip(fall_frames).save(OUT / "fall.png")
    print("  wrote fall.png (4)")

    atk = load_split("nicolas_attack_sheet.png", 6)
    atk_frames = expand_cycle(atk, 8)
    strip(atk_frames).save(OUT / "attack.png")
    print("  wrote attack.png (8)")

    # Subtle idle: reuse original idle first frame with tiny vertical breathing via copies
    idle_path = OUT / "idle.png"
    idle = Image.open(idle_path).convert("RGBA")
    base = idle.crop((0, 0, FW, FH))
    idle_frames = []
    for i, dy in enumerate([0, -1, -2, -1, 0, 1]):
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        canvas.paste(base, (0, dy), base)
        idle_frames.append(canvas)
    strip(idle_frames).save(OUT / "idle.png")
    print("  wrote idle.png (6 subtle)")

    print("Done. Backup at", BACKUP)


if __name__ == "__main__":
    main()
