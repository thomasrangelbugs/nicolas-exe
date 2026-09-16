#!/usr/bin/env python3
"""Recolor player sprites from a reference photo (irmao.jpg / nicolas.jpg).

The photo is NEVER used as a playable texture — only hair/skin colors are sampled.
Leather jacket / shoes stay black.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "reference"
SPR = ROOT / "assets" / "sprites" / "player"

CANDIDATES = [
    REF / "irmao.png", REF / "nicolas.png",
    REF / "irmao.jpg", REF / "irmao.jpeg",
    REF / "nicolas.jpg", REF / "nicolas.jpeg",
]


def find_photo():
    for p in CANDIDATES:
        if p.exists():
            return p
    for p in REF.glob("*.*"):
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and p.name.lower() != "readme.md":
            return p
    return None


def sample_colors(im: Image.Image):
    im = im.convert("RGB")
    w, h = im.size
    skins, hairs = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = im.getpixel((x, y))
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            ch = max(r, g, b) - min(r, g, b)
            if ch < 14:
                continue
            if 0.26 * h < y < 0.56 * h and 0.30 * w < x < 0.62 * w and 110 < lum < 200 and r > b:
                skins.append((r, g, b))
            if y < 0.40 * h and lum < 95:
                hairs.append((r, g, b))
    def avg(arr, fallback):
        if not arr:
            return fallback
        n = len(arr)
        return tuple(sum(c[i] for c in arr) // n for i in range(3))
    hair = avg(hairs, (48, 34, 30))
    skin = avg(skins, (186, 146, 132))
    hair = (min(hair[0], 58), min(hair[1], 44), min(hair[2], 40))
    return hair, skin


def recolor(im: Image.Image, hair, skin):
    px = im.load()
    out = im.copy()
    op = out.load()
    hair_limit_y = int(im.height * 0.36)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            ch = max(r, g, b) - min(r, g, b)
            # keep leather / shoes / outline
            if r < 30 and g < 30 and b < 30:
                continue
            if ch < 10:
                continue
            if y < hair_limit_y and r < 110 and g < 100 and b < 90 and r >= b - 8:
                op[x, y] = (hair[0], hair[1], hair[2], a)
            elif 120 < r < 245 and 90 < g < 210 and 70 < b < 200 and r >= g - 10:
                op[x, y] = (skin[0], skin[1], skin[2], a)
    return out


def main():
    photo = find_photo()
    if not photo:
        print("Nenhuma foto em /reference. Sprites permanecem com a paleta estilizada.")
        return
    print("Usando referência:", photo)
    hair, skin = sample_colors(Image.open(photo))
    print("Cabelo ~", hair, "pele ~", skin)
    for png in SPR.glob("*.png"):
        im = Image.open(png).convert("RGBA")
        recolor(im, hair, skin).save(png)
        print("recolor", png.name)
    print("Pronto. A foto não foi usada como textura jogável.")


if __name__ == "__main__":
    main()
