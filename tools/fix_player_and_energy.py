#!/usr/bin/env python3
"""Fix player sheets: opaque pixels, no frame bleed, no ghost blends; pack defend + energy orbs."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "assets" / "sprites" / "_gen"
PLAYER = ROOT / "assets" / "sprites" / "player"
ITEMS = ROOT / "assets" / "sprites" / "items"
CURSOR_ASSETS = Path(
    r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-Downloads-Thomas-THOMAS-projetos-NICOLAS-EXE\assets"
)
FW, FH = 96, 128


def to_rgba(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")


def solidify(im: Image.Image, thresh: int = 40) -> Image.Image:
    """Kill soft/ghost alpha — opaque character or fully transparent."""
    arr = np.array(to_rgba(im), dtype=np.uint8)
    a = arr[..., 3]
    keep = a >= thresh
    arr[~keep] = (0, 0, 0, 0)
    # Boost remaining alpha to fully solid
    arr[keep, 3] = 255
    # Dark near-black fringe often looks like haze — punch it if very dark + was soft-ish
    rgb = arr[..., :3].astype(np.int16)
    fringe = keep & (rgb.max(axis=-1) < 22)
    arr[fringe] = (0, 0, 0, 0)
    return Image.fromarray(arr, "RGBA")


def punch_studio_bg(im: Image.Image) -> Image.Image:
    arr = np.array(to_rgba(im), dtype=np.uint8)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    dark = (r < 30) & (g < 30) & (b < 30)
    purple = (r > 55) & (b > 55) & (g < r * 0.75) & (g < b * 0.85) & ((r.astype(int) + b) > 150)
    arr[dark | purple, 3] = 0
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


def split_columns(im: Image.Image, expected: int | None = None) -> list[Image.Image]:
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
        if j - i > 8:
            segs.append((i, j))
        i = j
    if expected and len(segs) > expected:
        segs = sorted(segs, key=lambda s: s[1] - s[0], reverse=True)[:expected]
        segs = sorted(segs, key=lambda s: s[0])
    if expected and len(segs) < expected:
        bb = content_bbox(im)
        if bb:
            x0, _, x1, _ = bb
            sw = (x1 - x0) / expected
            segs = [(int(x0 + k * sw), int(x0 + (k + 1) * sw)) for k in range(expected)]
    frames = []
    for a, b in segs:
        crop = im.crop((a, 0, b, im.height))
        bb = content_bbox(crop)
        if bb:
            frames.append(crop.crop(bb))
    return frames


def fit_frame(src: Image.Image, fw=FW, fh=FH, margin=0.88) -> Image.Image:
    src = solidify(src)
    bb = content_bbox(src)
    if not bb:
        return Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    char = src.crop(bb)
    max_w, max_h = int(fw * margin), int(fh * 0.90)
    scale = min(max_w / max(1, char.width), max_h / max(1, char.height))
    nw, nh = max(1, int(char.width * scale)), max(1, int(char.height * scale))
    char = char.resize((nw, nh), Image.Resampling.LANCZOS)
    char = solidify(char, thresh=50)
    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    x = (fw - nw) // 2
    y = fh - nh - max(2, int(fh * 0.04))
    canvas.paste(char, (x, y), char)
    # Clear 3px gutters so neighbors never bleed in Phaser
    arr = np.array(canvas)
    arr[:, :3, 3] = 0
    arr[:, -3:, 3] = 0
    return Image.fromarray(arr, "RGBA")


def expand_no_blend(frames: list[Image.Image], count: int) -> list[Image.Image]:
    """Expand using ping-pong / duplication — never Image.blend (causes ghosts)."""
    if not frames:
        raise ValueError("no frames")
    if len(frames) == count:
        return list(frames)
    if len(frames) > count:
        idxs = [int(round(i * (len(frames) - 1) / (count - 1))) for i in range(count)]
        return [frames[i] for i in idxs]
    # Ping-pong then trim/pad
    if len(frames) >= 2:
        cycle = list(frames) + list(reversed(frames[1:-1]))
    else:
        cycle = list(frames)
    out = []
    i = 0
    while len(out) < count:
        out.append(cycle[i % len(cycle)])
        i += 1
    return out


def strip(frames: list[Image.Image]) -> Image.Image:
    fitted = [fit_frame(f) for f in frames]
    sheet = Image.new("RGBA", (FW * len(fitted), FH), (0, 0, 0, 0))
    for i, fr in enumerate(fitted):
        sheet.paste(fr, (i * FW, 0), fr)
    return solidify(sheet, thresh=40)


def load_gen(name: str) -> Image.Image:
    for base in (GEN, CURSOR_ASSETS, ROOT / "assets"):
        p = base / name
        if p.exists():
            return punch_studio_bg(Image.open(p))
    raise FileNotFoundError(name)


def solidify_existing_sheet(path: Path, fw=FW, fh=FH):
    im = solidify(Image.open(path))
    # Re-center each frame with gutters
    n = im.width // fw
    frames = []
    for i in range(n):
        fr = im.crop((i * fw, 0, (i + 1) * fw, fh))
        bb = content_bbox(fr)
        if not bb:
            frames.append(Image.new("RGBA", (fw, fh), (0, 0, 0, 0)))
            continue
        char = fr.crop(bb)
        frames.append(char)
    path.write_bytes(strip(expand_no_blend(frames, n)).tobytes() if False else b"")  # noqa placeholder


def rewrite_from_gen():
    print("Rebuilding player strips without ghost blends…")
    walk = split_columns(load_gen("nicolas_walk_varied.png"), 5)
    run = split_columns(load_gen("nicolas_run_varied.png"), 5)
    jump = split_columns(load_gen("nicolas_jump_sheet.png"), 6)
    fall = split_columns(load_gen("nicolas_fall_sheet.png"), 4)
    atk = split_columns(load_gen("nicolas_attack_sheet.png"), 6)
    print("  counts", len(walk), len(run), len(jump), len(fall), len(atk))

    strip(expand_no_blend(walk, 10)).save(PLAYER / "walk.png")
    strip(expand_no_blend(run, 10)).save(PLAYER / "run.png")
    strip(expand_no_blend(jump, 6)).save(PLAYER / "jump.png")
    if len(fall) < 3 and len(jump) >= 4:
        fall = [jump[2], jump[3], jump[min(4, len(jump) - 1)], jump[-1]]
    strip(expand_no_blend(fall, 4)).save(PLAYER / "fall.png")
    strip(expand_no_blend(atk, 8)).save(PLAYER / "attack.png")

    # Idle: solidify existing (keep original art)
    idle = Image.open(PLAYER / "idle.png")
    n = idle.width // FW
    frames = [idle.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(n)]
    # Prefer unique solid frames from original; just solidify each cell
    out_frames = []
    for fr in frames:
        fr = solidify(fr)
        bb = content_bbox(fr)
        out_frames.append(fr.crop(bb) if bb else fr)
    strip(expand_no_blend(out_frames, 6)).save(PLAYER / "idle.png")

    # Hurt / death solidify in place
    for name in ("hurt", "death"):
        p = PLAYER / f"{name}.png"
        if not p.exists():
            continue
        im = Image.open(p)
        n = im.width // FW
        frames = []
        for i in range(n):
            fr = solidify(im.crop((i * FW, 0, (i + 1) * FW, FH)))
            bb = content_bbox(fr)
            frames.append(fr.crop(bb) if bb else fr)
        strip(expand_no_blend(frames, n)).save(p)

    # Defend — single pose sheet (4 subtle duplicates for breathing-ish hold)
    try:
        defend_src = load_gen("nicolas_defend.png")
    except FileNotFoundError:
        defend_src = punch_studio_bg(Image.open(CURSOR_ASSETS / "nicolas_defend.png"))
    dframes = split_columns(defend_src, 1)
    if not dframes:
        bb = content_bbox(defend_src)
        dframes = [defend_src.crop(bb)] if bb else [defend_src]
    strip(expand_no_blend(dframes, 4)).save(PLAYER / "defend.png")
    print("  wrote defend.png")


def pack_orb_grid(src_name: str, out_path: Path, frame: int, cols=2, rows=2):
    im = punch_studio_bg(Image.open(CURSOR_ASSETS / src_name if (CURSOR_ASSETS / src_name).exists() else GEN / src_name))
    im = solidify(im, thresh=25)
    cw, ch = im.width // cols, im.height // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            bb = content_bbox(cell)
            if not bb:
                continue
            char = cell.crop(bb)
            canvas = Image.new("RGBA", (frame, frame), (0, 0, 0, 0))
            scale = min((frame * 0.9) / char.width, (frame * 0.9) / char.height)
            nw, nh = max(1, int(char.width * scale)), max(1, int(char.height * scale))
            char = solidify(char.resize((nw, nh), Image.Resampling.LANCZOS), 30)
            canvas.paste(char, ((frame - nw) // 2, (frame - nh) // 2), char)
            frames.append(canvas)
    if not frames:
        raise RuntimeError(f"no orb frames from {src_name}")
    # Ensure 4 frames
    while len(frames) < 4:
        frames.append(frames[-1])
    frames = frames[:4]
    sheet = Image.new("RGBA", (frame * 4, frame), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * frame, 0), fr)
    sheet.save(out_path)
    print("  wrote", out_path.name, sheet.size)


def pack_energy():
    print("Packing energy orbs…")
    pack_orb_grid("energy_orb_sheet.png", ITEMS / "bullet_charged.png", 32)
    pack_orb_grid("energy_mega_sheet.png", ITEMS / "bullet_mega_sheet.png", 48)
    # Also single-frame mega for current Boot loader (image not sheet)
    mega = Image.open(ITEMS / "bullet_mega_sheet.png")
    mega.crop((0, 0, 48, 48)).save(ITEMS / "bullet_mega.png")
    # Pretty basic bullet from first charged frame scaled down
    orb = Image.open(ITEMS / "bullet_charged.png").crop((0, 0, 32, 32)).resize((20, 20), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    canvas.paste(orb, (2, 2), orb)
    solidify(canvas, 30).save(ITEMS / "bullet.png")
    print("  wrote bullet.png / bullet_mega.png")


def main():
    GEN.mkdir(parents=True, exist_ok=True)
    # Copy new gens into _gen
    for name in ("nicolas_defend.png", "energy_orb_sheet.png", "energy_mega_sheet.png"):
        src = CURSOR_ASSETS / name
        if src.exists():
            (GEN / name).write_bytes(src.read_bytes())
    rewrite_from_gen()
    pack_energy()
    # Stats
    for name in ("idle", "walk", "run", "jump", "fall", "attack", "defend"):
        p = PLAYER / f"{name}.png"
        if not p.exists():
            continue
        a = np.array(Image.open(p))
        soft = ((a[..., 3] > 0) & (a[..., 3] < 250)).sum()
        print(f"  {name}: soft_alpha={int(soft)}")


if __name__ == "__main__":
    main()
