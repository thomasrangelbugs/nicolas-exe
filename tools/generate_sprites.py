#!/usr/bin/env python3
"""Generate transparent PNG sprites, UI, tiles, FX and parallax for NICOLAS.EXE."""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
ART = OUT / "art"
SPR = OUT / "sprites"
UI = OUT / "ui"
REF = ROOT / "reference"

SCALE = 2  # draw at 1x, scale nearest-neighbor

# Palette inspired by the reference photo (curly dark hair, warm skin, black leather)
C = {
    "void": (0, 0, 0, 0),
    "outline": (8, 8, 12, 255),
    "hair": (48, 34, 30, 255),
    "hair_h": (92, 68, 52, 255),
    "hair_s": (28, 20, 18, 255),
    "skin": (186, 146, 132, 255),
    "skin_s": (148, 110, 100, 255),
    "skin_h": (210, 172, 156, 255),
    "brow": (42, 30, 26, 255),
    "eye": (36, 24, 20, 255),
    "eye_w": (236, 228, 220, 255),
    "stache": (40, 28, 24, 255),
    "jacket": (38, 34, 40, 255),
    "jacket_h": (72, 64, 70, 255),
    "jacket_d": (18, 16, 20, 255),
    "shirt": (12, 12, 14, 255),
    "hoodie": (22, 20, 22, 255),
    "hoodie_d": (10, 10, 12, 255),
    "hoodie_h": (52, 46, 48, 255),
    "cyan": (76, 232, 255, 255),
    "cyan_d": (32, 140, 180, 255),
    "purple": (155, 108, 255, 255),
    "pants": (24, 24, 32, 255),
    "pants_h": (42, 42, 56, 255),
    "shoe": (12, 12, 14, 255),
    "white": (236, 244, 255, 255),
}


def apply_photo_palette():
    """Tint hair/skin from /reference photo without using it as a texture."""
    photo = None
    for name in ("nicolas.png", "irmao.png", "nicolas.jpg", "irmao.jpg"):
        p = REF / name
        if p.exists():
            photo = p
            break
    if not photo:
        return
    im = Image.open(photo).convert("RGB")
    w, h = im.size
    skins, hairs = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = im.getpixel((x, y))
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            ch = max(r, g, b) - min(r, g, b)
            if ch < 14:
                continue
            if 0.26 * h < y < 0.56 * h and 0.30 * w < x < 0.62 * w and 110 < lum < 200 and r > b and r >= g - 8:
                skins.append((r, g, b))
            if y < 0.40 * h and lum < 95 and r >= b - 8:
                hairs.append((r, g, b))
    if skins:
        n = len(skins)
        avg = tuple(sum(c[i] for c in skins) // n for i in range(3))
        C["skin"] = (*avg, 255)
        C["skin_s"] = (max(0, avg[0] - 36), max(0, avg[1] - 34), max(0, avg[2] - 30), 255)
        C["skin_h"] = (min(255, avg[0] + 24), min(255, avg[1] + 22), min(255, avg[2] + 18), 255)
    if hairs:
        n = len(hairs)
        avg = tuple(sum(c[i] for c in hairs) // n for i in range(3))
        # keep hair dark even if the selfie compresses it towards grey
        dark = (min(avg[0], 58), min(avg[1], 44), min(avg[2], 40))
        C["hair"] = (*dark, 255)
        C["hair_s"] = (max(0, dark[0] - 16), max(0, dark[1] - 14), max(0, dark[2] - 12), 255)
        C["hair_h"] = (min(255, dark[0] + 38), min(255, dark[1] + 28), min(255, dark[2] + 18), 255)
        C["stache"] = C["hair_s"]
        C["brow"] = C["hair"]



def ensure():
    for p in [
        SPR / "player", SPR / "enemies", SPR / "bosses", SPR / "items",
        SPR / "fx", SPR / "tiles", SPR / "bg", SPR / "portraits", UI, ART, REF
    ]:
        p.mkdir(parents=True, exist_ok=True)


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def pset(im, x, y, col):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((int(x), int(y)), col)


def box(im, x, y, w, h, col):
    for i in range(int(w)):
        for j in range(int(h)):
            pset(im, x + i, y + j, col)


def circ(im, cx, cy, r, col):
    r2 = r * r
    for i in range(-r - 1, r + 2):
        for j in range(-r - 1, r + 2):
            if i * i + j * j <= r2:
                pset(im, cx + i, cy + j, col)


def outline_sprite(im, col=None):
    col = col or C["outline"]
    src = im.copy()
    out = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            a = src.getpixel((x, y))[3]
            if a == 0:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < im.width and 0 <= ny < im.height:
                        if src.getpixel((nx, ny))[3] > 0:
                            pset(out, x, y, col)
                            break
    return out


def glow(im, thresh=180):
    """Soft neon bloom under opaque bright pixels."""
    bloom = new(im.width, im.height)
    px = im.load()
    bp = bloom.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 0 and (g > thresh or (b > thresh and r < 180)):
                bp[x, y] = (min(255, r + 40), min(255, g + 40), min(255, b + 20), 140)
    bloom = bloom.filter(ImageFilter.GaussianBlur(1.4))
    base = new(im.width, im.height)
    base.alpha_composite(bloom)
    base.alpha_composite(im)
    return base


def scale(im, s=SCALE):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)


def strip(frames):
    w, h = frames[0].size
    img = new(w * len(frames), h)
    for i, fr in enumerate(frames):
        img.paste(fr, (i * w, 0), fr)
    return img


def save(im, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")
    return path


# ---------- Nicolas (stylized pixel protagonist) ----------
def draw_nicolas(pose="idle", t=0, facing=1):
    """24x32 stylized pixel Nicolas: curly hair, mustache, leather jacket."""
    im = new(24, 32)
    bob = 0
    blink = False
    lean = 0
    arm_l = 0
    arm_r = 0
    leg_l = 0
    leg_r = 0
    head_y = 4
    dead = False
    hurt = False
    atk = 0
    curl = 0

    if pose == "idle":
        bob = 1 if (t // 2) % 2 == 0 else 0
        blink = t % 6 == 5
        curl = t % 2
    elif pose == "walk":
        cycle = [0, 1, 2, 1, 0, -1, -2, -1]
        leg_l = cycle[t % 8]
        leg_r = -cycle[t % 8]
        arm_l = -leg_l
        arm_r = -leg_r
        bob = 1 if t % 2 == 0 else 0
        curl = t % 2
    elif pose == "run":
        cycle = [0, 2, 3, 1, 0, -2, -3, -1]
        leg_l = cycle[t % 8]
        leg_r = -cycle[t % 8]
        arm_l = -int(leg_l * 1.2)
        arm_r = -int(leg_r * 1.2)
        lean = 1
        bob = 1 if t % 2 == 0 else 0
    elif pose == "jump":
        leg_l, leg_r = -2, -1
        arm_l, arm_r = -3, -2
        head_y = 3
        curl = 1
    elif pose == "fall":
        leg_l, leg_r = 1, 2
        arm_l, arm_r = 2, 3
        head_y = 5
    elif pose == "attack":
        atk = min(t, 5)
        arm_r = -4 if atk < 3 else 3
        lean = 1 if atk >= 2 else 0
        bob = 0
    elif pose == "hurt":
        hurt = True
        lean = -1
        head_y = 5
        arm_l, arm_r = 2, 2
    elif pose == "death":
        dead = True
        fall = min(t, 7)
        head_y = 4 + fall
        lean = fall // 2
        arm_l = fall
        arm_r = -fall
        leg_l = fall // 2
        leg_r = fall

    ox = 1 + lean
    oy = bob

    # shoes
    box(im, ox + 6, 28 + oy + leg_l, 5, 3, C["shoe"])
    box(im, ox + 13, 28 + oy + leg_r, 5, 3, C["shoe"])
    box(im, ox + 6, 30 + oy + leg_l, 5, 1, C["cyan"])
    box(im, ox + 13, 30 + oy + leg_r, 5, 1, C["cyan"])

    # jeans
    box(im, ox + 7, 22 + oy, 4, 7 + max(0, leg_l), C["pants"])
    box(im, ox + 13, 22 + oy, 4, 7 + max(0, leg_r), C["pants"])
    box(im, ox + 8, 23 + oy, 2, 4, C["pants_h"])

    # black t-shirt
    box(im, ox + 8, 15 + oy, 8, 8, C["shirt"])

    # leather jacket
    box(im, ox + 5, 13 + oy, 14, 10, C["jacket"])
    box(im, ox + 6, 14 + oy, 4, 8, C["jacket_h"])
    box(im, ox + 14, 14 + oy, 4, 8, C["jacket_d"])
    box(im, ox + 8, 16 + oy, 8, 6, C["shirt"])  # shirt peek
    # lapels
    box(im, ox + 7, 13 + oy, 3, 3, C["jacket_h"])
    box(im, ox + 14, 13 + oy, 3, 3, C["jacket_h"])
    # cyan circuit stitch on collar (game identity, not from the photo)
    pset(im, ox + 7, 13 + oy, C["cyan"])
    pset(im, ox + 16, 13 + oy, C["cyan"])

    # left sleeve
    box(im, ox + 2, 14 + oy + arm_l, 4, 8, C["jacket"])
    box(im, ox + 2, 21 + oy + arm_l, 4, 2, C["skin"])
    if pose == "attack" and atk >= 2:
        box(im, ox + 16, 14 + oy, 7, 4, C["jacket"])
        box(im, ox + 22, 14 + oy, 2, 3, C["skin"])
        box(im, ox + 22, 13 + oy, 2, 2, C["cyan"])
    else:
        box(im, ox + 18, 14 + oy + arm_r, 4, 8, C["jacket"])
        box(im, ox + 18, 21 + oy + arm_r, 4, 2, C["skin"])

    # head
    hx, hy = ox + 8, head_y + oy
    box(im, hx, hy + 1, 8, 8, C["skin"])
    box(im, hx + 1, hy, 6, 1, C["skin_h"])
    box(im, hx + 1, hy + 8, 6, 1, C["skin_s"])
    pset(im, hx + 1, hy + 3, C["skin_h"])
    pset(im, hx + 6, hy + 3, C["skin_s"])

    # voluminous curly hair — the main likeness cue
    curls = [
        (hx - 3, hy - 2, 6, 4), (hx + 4, hy - 3, 7, 4), (hx, hy - 2, 8, 3),
        (hx - 4, hy + 1, 5, 6), (hx + 8, hy, 5, 7), (hx - 3, hy + 5, 4, 4),
        (hx + 9, hy + 5, 4, 5), (hx - 1, hy - 1, 5, 3), (hx + 5, hy - 1, 5, 3),
        (hx + 2, hy - 3, 4, 2),
    ]
    for (cx, cy, cw, ch) in curls:
        box(im, cx, cy + curl, cw, ch, C["hair"])
    box(im, hx + 1, hy - 2 + curl, 3, 2, C["hair_h"])
    box(im, hx + 6, hy - 1 + curl, 3, 2, C["hair_h"])
    pset(im, hx - 2, hy + 3 + curl, C["hair_h"])
    pset(im, hx + 11, hy + 2 + curl, C["hair_s"])
    pset(im, hx - 3, hy + 2 + curl, C["hair_s"])
    pset(im, hx + 10, hy + 6 + curl, C["hair_h"])
    # fringe over forehead
    box(im, hx - 1, hy + 1, 10, 2, C["hair"])
    box(im, hx + 2, hy + 1, 3, 1, C["hair_h"])

    # brows
    box(im, hx + 1, hy + 3, 2, 1, C["brow"])
    box(im, hx + 5, hy + 3, 2, 1, C["brow"])
    if blink:
        box(im, hx + 1, hy + 5, 2, 1, C["brow"])
        box(im, hx + 5, hy + 5, 2, 1, C["brow"])
    else:
        pset(im, hx + 2, hy + 5, C["eye_w"])
        pset(im, hx + 6, hy + 5, C["eye_w"])
        pset(im, hx + 2, hy + 5, C["eye"])
        pset(im, hx + 6, hy + 5, C["eye"])
        pset(im, hx + 3, hy + 5, C["cyan"])
        pset(im, hx + 7, hy + 5, C["cyan"])

    # mustache + mouth
    box(im, hx + 2, hy + 7, 4, 1, C["stache"])
    pset(im, hx + 1, hy + 7, C["stache"])
    pset(im, hx + 6, hy + 7, C["stache"])
    pset(im, hx + 3, hy + 6, C["stache"])
    pset(im, hx + 4, hy + 6, C["stache"])
    if hurt:
        box(im, hx + 3, hy + 8, 2, 1, C["skin_s"])
    elif not dead:
        pset(im, hx + 4, hy + 8, C["skin_s"])

    if dead and t >= 5:
        for i in range(8):
            pset(im, (t * 3 + i * 5) % 24, 10 + (i * 3 + t) % 18, C["cyan"] if i % 2 == 0 else C["purple"])

    im = outline_sprite(im)
    im = glow(im)
    return scale(im)


def player_icon():
    fr = draw_nicolas("idle", 0)
    # crop a bit / already 48x64
    return fr


def make_player():
    anims = {
        "idle": ("idle", 6),
        "walk": ("walk", 8),
        "run": ("run", 8),
        "jump": ("jump", 4),
        "fall": ("fall", 2),
        "attack": ("attack", 6),
        "hurt": ("hurt", 4),
        "death": ("death", 8),
    }
    for name, (pose, n) in anims.items():
        frames = [draw_nicolas(pose, i) for i in range(n)]
        save(strip(frames), SPR / "player" / f"{name}.png")
    save(draw_nicolas("idle", 0), SPR / "player" / "icon.png")


# ---------- Enemies ----------
BUG_PAL = {
    "Syntax": ((255, 72, 110, 255), (255, 160, 190, 255), "<>"),
    "Runtime": ((255, 140, 60, 255), (255, 210, 120, 255), "!"),
    "Null Pointer": ((90, 70, 200, 255), (180, 160, 255, 255), "0"),
    "Memory Leak": ((60, 210, 140, 255), (160, 255, 200, 255), "~"),
    "Legacy": ((210, 170, 70, 255), (240, 220, 140, 255), "#"),
    "Spaghetti": ((200, 140, 70, 255), (255, 200, 120, 255), "&"),
}


def draw_bug(kind="Syntax", pose="idle", t=0):
    im = new(20, 16)
    main, lite, glyph = BUG_PAL[kind]
    dark = (max(0, main[0] - 80), max(0, main[1] - 80), max(0, main[2] - 80), 255)
    bob = 1 if pose == "idle" and t % 2 == 0 else 0
    step = (t % 2) if pose in ("idle", "walk", "attack") else 0
    if pose == "death":
        bob = t
    oy = bob
    # body
    circ(im, 10, 8 + oy, 5, main)
    circ(im, 10, 8 + oy, 3, lite)
    # eyes
    if pose != "death" or t < 3:
        pset(im, 8, 7 + oy, C["outline"])
        pset(im, 12, 7 + oy, C["outline"])
        pset(im, 8, 7 + oy - 0, C["cyan"] if pose != "hurt" else (255, 80, 80, 255))
        pset(im, 12, 7 + oy, C["cyan"] if pose != "hurt" else (255, 80, 80, 255))
    # legs
    legs = [(-6, -3), (-7, 0), (-5, 3), (6, -3), (7, 0), (5, 3)]
    for i, (lx, ly) in enumerate(legs):
        wob = 1 if (i + step) % 2 == 0 else 0
        pset(im, 10 + lx, 8 + ly + oy + wob, main)
        pset(im, 10 + lx + (1 if lx > 0 else -1), 8 + ly + oy + wob, dark)
    # glyph
    if glyph == "<>":
        pset(im, 6, 10 + oy, lite)
        pset(im, 14, 10 + oy, lite)
    elif glyph == "0":
        box(im, 9, 10 + oy, 3, 2, dark)
    elif glyph == "~":
        pset(im, 9, 12 + oy, lite)
        pset(im, 11, 13 + oy, lite)
    elif glyph == "#":
        box(im, 9, 10 + oy, 3, 2, dark)
    if pose == "attack":
        box(im, 16, 7 + oy, 3, 2, C["cyan"] if kind != "Runtime" else main)
    if pose == "hurt":
        for i in range(4):
            pset(im, 2 + i * 4, 2, (255, 255, 255, 200))
    if pose == "death" and t > 2:
        for i in range(6):
            pset(im, (t * 2 + i * 3) % 20, (i * 2 + t) % 16, C["cyan"] if i % 2 else main)
    im = outline_sprite(im)
    return glow(scale(im))


def make_enemies():
    poses = {"idle": 4, "walk": 6, "attack": 4, "hurt": 3, "death": 6}
    keys = {
        "Syntax": "syntax",
        "Runtime": "runtime",
        "Null Pointer": "null",
        "Memory Leak": "leak",
        "Legacy": "legacy",
        "Spaghetti": "spaghetti",
    }
    for kind, slug in keys.items():
        d = SPR / "enemies" / slug
        d.mkdir(parents=True, exist_ok=True)
        for pose, n in poses.items():
            frames = [draw_bug(kind, pose, i) for i in range(n)]
            save(strip(frames), d / f"{pose}.png")


# ---------- Bosses ----------
def draw_boss(name, pose="idle", t=0):
    im = new(56, 48)
    palettes = {
        "procrastination": ((120, 80, 200, 255), (200, 160, 255, 255), (40, 24, 70, 255)),
        "deadline": ((200, 50, 70, 255), (255, 140, 90, 255), (70, 16, 24, 255)),
        "ultimate": ((80, 255, 160, 255), (255, 70, 120, 255), (12, 20, 18, 255)),
    }
    a, b, d = palettes[name]
    oy = 0 if pose in ("hurt", "death") else (t % 2)
    if pose == "intro":
        oy = 6 - min(t, 6)
    if pose == "death":
        oy = t

    # body
    box(im, 10, 10 + oy, 36, 28, d)
    box(im, 12, 12 + oy, 32, 24, a)
    box(im, 16, 14 + oy, 24, 8, b)

    if name == "procrastination":
        # sleepy clock face
        circ(im, 22, 20 + oy, 5, C["white"])
        circ(im, 34, 20 + oy, 5, C["white"])
        pset(im, 21, 20 + oy, C["outline"])
        pset(im, 33, 20 + oy, C["outline"])
        box(im, 24, 28 + oy, 8, 2, C["outline"])  # mouth
        # Zzz
        if pose in ("idle", "intro"):
            pset(im, 44, 8 + oy - t % 3, C["cyan"])
    elif name == "deadline":
        # hourglass / calendar eyes
        box(im, 18, 16 + oy, 6, 8, C["white"])
        box(im, 32, 16 + oy, 6, 8, C["white"])
        box(im, 20, 18 + oy, 2, 4, (220, 30, 40, 255))
        box(im, 34, 18 + oy, 2, 4, (220, 30, 40, 255))
        box(im, 22, 30 + oy, 12, 3, C["cyan"])
    else:
        # ultimate bug: many eyes
        for ex, ey in ((18, 18), (28, 16), (38, 18), (23, 24), (33, 24)):
            circ(im, ex, ey + oy, 3, C["white"])
            pset(im, ex, ey + oy, C["eye"])
            pset(im, ex + 1, ey + oy - 1, C["cyan"])
        # mandibles
        box(im, 20, 32 + oy, 4, 4, b)
        box(im, 32, 32 + oy, 4, 4, b)

    # claws
    if pose == "attack":
        box(im, 2, 22 + oy, 10, 4, b)
        box(im, 44, 22 + oy, 10, 4, b)
    else:
        box(im, 6, 30 + oy, 6, 4, a)
        box(im, 44, 30 + oy, 6, 4, a)

    if pose == "special":
        for i in range(8):
            ang = (t * 40 + i * 45) * math.pi / 180
            pset(im, int(28 + math.cos(ang) * (14 + t)), int(24 + math.sin(ang) * (10 + t)), C["cyan"] if i % 2 else b)

    if pose == "hurt":
        for i in range(10):
            pset(im, 8 + i * 4, 8, (255, 255, 255, 220))

    if pose == "death" and t > 3:
        for i in range(20):
            pset(im, (t * 5 + i * 7) % 56, (i * 3 + t * 2) % 48, C["cyan"] if i % 2 else b)

    im = outline_sprite(im)
    return glow(scale(im), thresh=160)


def make_bosses():
    poses = {"intro": 6, "idle": 4, "attack": 6, "hurt": 3, "special": 6, "death": 8}
    for name in ("procrastination", "deadline", "ultimate"):
        d = SPR / "bosses" / name
        d.mkdir(parents=True, exist_ok=True)
        for pose, n in poses.items():
            frames = [draw_boss(name, pose, i) for i in range(n)]
            save(strip(frames), d / f"{pose}.png")


# ---------- Projectiles / FX / items / tiles / UI ----------
def make_projectiles():
    # bullet 12x6 -> 24x12
    b = new(12, 6)
    box(b, 0, 1, 10, 4, C["cyan"])
    box(b, 2, 2, 8, 2, C["white"])
    pset(b, 11, 2, C["purple"])
    pset(b, 11, 3, C["purple"])
    save(glow(scale(outline_sprite(b))), SPR / "items" / "bullet.png")
    frames = []
    for i in range(4):
        fr = new(12, 6)
        box(fr, i, 1, 9, 4, C["cyan"])
        box(fr, 2 + i, 2, 6, 2, C["white"])
        frames.append(glow(scale(outline_sprite(fr))))
    save(strip(frames), SPR / "items" / "bullet_charged.png")
    db = new(12, 8)
    box(db, 1, 2, 10, 4, C["purple"])
    box(db, 3, 3, 6, 2, C["cyan"])
    save(glow(scale(outline_sprite(db))), SPR / "items" / "bullet_debug.png")
    eb = new(12, 6)
    box(eb, 1, 1, 10, 4, (255, 80, 120, 255))
    box(eb, 3, 2, 6, 2, (255, 200, 210, 255))
    save(glow(scale(outline_sprite(eb))), SPR / "items" / "bullet_enemy.png")


def make_items():
    def cup():
        im = new(16, 16)
        box(im, 3, 6, 8, 8, C["white"])
        box(im, 4, 7, 6, 6, (90, 48, 24, 255))
        box(im, 11, 8, 3, 4, C["white"])
        box(im, 5, 4, 2, 2, (200, 200, 210, 180))
        box(im, 7, 3, 2, 2, (200, 200, 210, 120))
        return glow(scale(outline_sprite(im)))

    def energy():
        im = new(16, 16)
        box(im, 5, 2, 6, 12, (40, 220, 120, 255))
        box(im, 6, 3, 4, 10, (20, 40, 30, 255))
        box(im, 7, 5, 2, 5, C["cyan"])
        return glow(scale(outline_sprite(im)))

    def pizza():
        im = new(16, 16)
        circ(im, 8, 9, 6, (230, 180, 70, 255))
        circ(im, 8, 9, 4, (210, 60, 50, 255))
        pset(im, 6, 8, (240, 220, 90, 255))
        pset(im, 10, 10, (240, 220, 90, 255))
        return glow(scale(outline_sprite(im)))

    def choco():
        im = new(16, 16)
        box(im, 3, 6, 10, 6, (92, 48, 28, 255))
        box(im, 4, 7, 8, 2, (140, 80, 40, 255))
        box(im, 3, 5, 10, 1, (180, 60, 90, 255))
        return glow(scale(outline_sprite(im)))

    def git():
        im = new(16, 28)
        box(im, 6, 4, 4, 22, (20, 36, 48, 255))
        box(im, 5, 2, 6, 5, C["cyan"])
        box(im, 7, 0, 2, 3, C["cyan"])
        return glow(scale(outline_sprite(im)))

    def ach():
        im = new(16, 16)
        circ(im, 8, 8, 6, (240, 200, 70, 255))
        circ(im, 8, 8, 4, (80, 50, 10, 255))
        box(im, 7, 6, 2, 5, (240, 200, 70, 255))
        return glow(scale(outline_sprite(im)))

    def shard():
        im = new(16, 16)
        box(im, 6, 4, 4, 8, C["cyan"])
        box(im, 7, 5, 2, 6, C["white"])
        return glow(scale(outline_sprite(im)))

    save(cup(), SPR / "items" / "coffee.png")
    save(energy(), SPR / "items" / "energy.png")
    save(pizza(), SPR / "items" / "pizza.png")
    save(choco(), SPR / "items" / "chocolate.png")
    save(git(), SPR / "items" / "checkpoint.png")
    save(ach(), SPR / "items" / "achievement.png")
    save(shard(), SPR / "items" / "energy_pickup.png")


def burst(size, n, color_fn):
    frames = []
    for t in range(n):
        im = new(size, size)
        cx = cy = size // 2
        r = 2 + t * (size // (2 * n) + 1)
        for a in range(0, 360, 20):
            rad = math.radians(a + t * 12)
            x = int(cx + math.cos(rad) * r)
            y = int(cy + math.sin(rad) * (r * 0.8))
            col = color_fn(t)
            circ(im, x, y, max(1, 3 - t // 2), col)
        circ(im, cx, cy, max(1, 4 - t), C["white"])
        frames.append(glow(scale(im)))
    return strip(frames)


def make_fx():
    save(burst(16, 6, lambda t: C["cyan"] if t % 2 == 0 else C["white"]), SPR / "fx" / "impact.png")
    save(burst(24, 8, lambda t: (255, 120, 60, 255) if t < 4 else C["purple"]), SPR / "fx" / "explosion.png")
    save(burst(32, 10, lambda t: C["purple"] if t % 2 else C["cyan"]), SPR / "fx" / "boss_explode.png")
    frames = []
    for t in range(6):
        im = new(16, 16)
        circ(im, 8, 8 - t, 2, C["cyan"])
        pset(im, 8, 4, C["white"])
        frames.append(glow(scale(im)))
    save(strip(frames), SPR / "fx" / "pickup.png")
    frames = []
    for t in range(6):
        im = new(16, 28)
        box(im, 6, 4, 4, 22, C["cyan"] if t % 2 == 0 else C["white"])
        frames.append(glow(scale(outline_sprite(im))))
    save(strip(frames), SPR / "fx" / "checkpoint.png")
    frames = []
    for t in range(6):
        im = new(24, 16)
        for i in range(12):
            pset(im, (i * 3 + t * 5) % 24, (i * 2 + t) % 16, C["cyan"] if i % 2 else C["purple"])
            box(im, (t * 4) % 20, 4, 6, 2, (255, 80, 120, 180))
        frames.append(scale(im))
    save(strip(frames), SPR / "fx" / "glitch.png")


def make_tiles():
    plat = new(64, 12)
    box(plat, 0, 2, 64, 10, (16, 24, 48, 255))
    box(plat, 0, 2, 64, 2, C["cyan"])
    for x in range(0, 64, 8):
        box(plat, x + 2, 6, 4, 1, C["cyan_d"])
        pset(plat, x + 4, 8, C["purple"])
    save(glow(scale(plat)), SPR / "tiles" / "platform.png")

    floor = new(64, 16)
    box(floor, 0, 4, 64, 12, (12, 18, 36, 255))
    box(floor, 0, 4, 64, 2, C["cyan_d"])
    for x in range(0, 64, 6):
        pset(floor, x, 10, C["cyan"])
    save(glow(scale(floor)), SPR / "tiles" / "floor.png")

    block = new(16, 16)
    box(block, 1, 1, 14, 14, (18, 28, 52, 255))
    box(block, 1, 1, 14, 2, C["cyan"])
    box(block, 3, 5, 10, 2, C["purple"])
    box(block, 3, 9, 7, 2, C["cyan_d"])
    save(glow(scale(outline_sprite(block))), SPR / "tiles" / "code_block.png")

    term = new(20, 16)
    box(term, 1, 2, 18, 12, (10, 16, 24, 255))
    box(term, 3, 4, 14, 8, (8, 40, 28, 255))
    box(term, 4, 5, 6, 1, (80, 255, 160, 255))
    box(term, 4, 7, 10, 1, (80, 255, 160, 200))
    save(glow(scale(outline_sprite(term))), SPR / "tiles" / "terminal.png")

    chip = new(16, 12)
    box(chip, 2, 2, 12, 8, (40, 48, 70, 255))
    box(chip, 4, 4, 8, 4, C["cyan"])
    for i in range(4):
        pset(chip, 1, 3 + i * 2, C["white"])
        pset(chip, 14, 3 + i * 2, C["white"])
    save(glow(scale(outline_sprite(chip))), SPR / "tiles" / "chip.png")

    panel = new(20, 14)
    box(panel, 1, 1, 18, 12, (20, 24, 48, 255))
    box(panel, 3, 3, 14, 2, C["cyan"])
    box(panel, 3, 7, 8, 2, C["purple"])
    save(glow(scale(outline_sprite(panel))), SPR / "tiles" / "panel.png")

    circuit = new(32, 16)
    box(circuit, 0, 8, 32, 1, C["cyan_d"])
    box(circuit, 8, 2, 1, 12, C["cyan_d"])
    circ(circuit, 8, 8, 2, C["cyan"])
    circ(circuit, 24, 8, 2, C["purple"])
    save(glow(scale(circuit)), SPR / "tiles" / "circuit.png")


def make_ui():
    def panel(w, h, border, fill):
        im = new(w, h)
        box(im, 0, 0, w, h, fill)
        box(im, 2, 2, w - 4, h - 4, (8, 12, 28, 230))
        box(im, 0, 0, w, 3, border)
        box(im, 0, h - 3, w, 3, border)
        box(im, 0, 0, 3, h, border)
        box(im, w - 3, 0, 3, h, border)
        pset(im, 4, 4, C["cyan"])
        pset(im, w - 5, 4, C["purple"])
        return im

    save(panel(96, 64, C["cyan"], (10, 16, 36, 255)), UI / "panel.png")
    save(panel(128, 48, C["cyan"], (12, 20, 42, 255)), UI / "button.png")
    save(panel(128, 48, C["purple"], (28, 20, 60, 255)), UI / "button_hover.png")
    save(panel(160, 80, C["cyan"], (8, 12, 26, 255)), UI / "dialog.png")
    save(panel(120, 72, C["purple"], (8, 10, 22, 255)), UI / "pause.png")
    save(panel(160, 90, (255, 80, 110, 255), (18, 8, 16, 255)), UI / "gameover.png")

    hp = new(128, 12)
    box(hp, 0, 0, 128, 12, (20, 24, 36, 255))
    box(hp, 2, 2, 124, 8, (40, 220, 130, 255))
    save(hp, UI / "hp_fill.png")
    caf = new(128, 10)
    box(caf, 0, 0, 128, 10, (20, 24, 36, 255))
    box(caf, 2, 2, 124, 6, (230, 170, 80, 255))
    save(caf, UI / "caf_fill.png")
    xp = new(128, 8)
    box(xp, 0, 0, 128, 8, (20, 24, 36, 255))
    box(xp, 2, 2, 124, 4, C["purple"])
    save(xp, UI / "xp_fill.png")
    bar = new(132, 16)
    box(bar, 0, 0, 132, 16, (6, 10, 22, 255))
    box(bar, 1, 1, 130, 14, C["cyan_d"])
    box(bar, 3, 3, 126, 10, (8, 12, 24, 255))
    save(bar, UI / "bar_back.png")


def make_parallax():
    # stars
    stars = new(512, 256)
    import random
    rng = random.Random(2026)
    for _ in range(120):
        x, y = rng.randint(0, 511), rng.randint(0, 255)
        col = C["cyan"] if rng.random() > 0.7 else C["white"]
        pset(stars, x, y, (*col[:3], rng.randint(80, 220)))
        if rng.random() > 0.85:
            pset(stars, x + 1, y, (*C["purple"][:3], 120))
    save(stars, SPR / "bg" / "stars.png")

    city = new(512, 180)
    rng = random.Random(42)
    h_base = 180
    x = 0
    while x < 512:
        w = rng.randint(18, 40)
        h = rng.randint(40, 140)
        col = (12, 18, 40, 220)
        box(city, x, h_base - h, w, h, col)
        for wy in range(h_base - h + 6, h_base - 8, 8):
            for wx in range(x + 3, x + w - 3, 5):
                if rng.random() > 0.45:
                    pset(city, wx, wy, C["cyan"] if rng.random() > 0.3 else C["purple"])
        x += w + rng.randint(2, 8)
    save(city, SPR / "bg" / "city.png")

    grid = new(256, 256)
    for i in range(0, 256, 16):
        for j in range(256):
            pset(grid, i, j, (*C["cyan"][:3], 28))
            pset(grid, j, i, (*C["purple"][:3], 22))
    save(grid, SPR / "bg" / "grid.png")

    code = new(400, 80)
    rng = random.Random(7)
    for i in range(18):
        x = rng.randint(0, 360)
        y = rng.randint(4, 60)
        w = rng.randint(20, 70)
        col = C["cyan"] if i % 2 == 0 else (80, 255, 160, 180)
        box(code, x, y, w, 2, (*col[:3], 100))
    save(code, SPR / "bg" / "code.png")

    fog = new(512, 128)
    for y in range(128):
        a = int(40 * (y / 128))
        for x in range(512):
            pset(fog, x, y, (80, 40, 140, a))
    save(fog, SPR / "bg" / "fog.png")


def make_portrait_frame():
    src_path = ART / "nicolas_portrait.png"
    if not src_path.exists():
        # fallback portrait from sprite
        save(draw_nicolas("idle", 0).resize((256, 320), Image.NEAREST), SPR / "portraits" / "nicolas.png")
        return
    src = Image.open(src_path).convert("RGBA")
    src = src.resize((256, 256), Image.LANCZOS)
    # hex-ish rounded frame with transparency outside
    mask = Image.new("L", (256, 256), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((8, 8, 248, 248), radius=28, fill=255)
    framed = new(256, 256)
    framed.paste(src, (0, 0))
    framed.putalpha(mask)
    # neon border
    border = new(256, 256)
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle((8, 8, 248, 248), radius=28, outline=(76, 232, 255, 255), width=4)
    bd.rounded_rectangle((14, 14, 242, 242), radius=24, outline=(155, 108, 255, 180), width=2)
    framed.alpha_composite(border)
    save(framed, SPR / "portraits" / "nicolas.png")
    # smaller dialog portrait
    save(framed.resize((96, 96), Image.LANCZOS), SPR / "portraits" / "nicolas_dialog.png")
    # menu icon
    save(framed.resize((64, 64), Image.LANCZOS), SPR / "portraits" / "nicolas_icon.png")


def make_reference_readme():
    (REF / "README.md").write_text(
        """# Referência visual do Nicolas

Coloque aqui a foto do seu irmão para guiar o visual do protagonista:

- `reference/irmao.jpg`
- `reference/nicolas.jpg`
- `reference/irmao.png`

A foto **não** é usada como sprite jogável. Ela serve só de referência
(cabelo cacheado, tom de pele, bigode, jaqueta) para o personagem pixel art.

Depois de adicionar a foto, rode:

```bash
python tools/apply_reference.py
```

Isso recolore os sprites do jogador com base nas cores amostradas da foto.
""",
        encoding="utf-8",
    )


def main():
    ensure()
    apply_photo_palette()
    print("palette hair", C["hair"], "skin", C["skin"])
    print("player...")
    make_player()
    print("enemies...")
    make_enemies()
    print("bosses...")
    make_bosses()
    print("projectiles/items/fx/tiles/ui/bg...")
    make_projectiles()
    make_items()
    make_fx()
    make_tiles()
    make_ui()
    make_parallax()
    make_portrait_frame()
    make_reference_readme()
    print("OK sprites em", SPR)


if __name__ == "__main__":
    main()
