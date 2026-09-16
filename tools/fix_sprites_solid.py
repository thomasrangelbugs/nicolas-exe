"""Solid opaque player + clear enemy sheets. Never use pure #000 on body pixels."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"

SKIN = (242, 206, 176, 255)
SKIN2 = (218, 168, 138, 255)
HAIR = (96, 60, 40, 255)
HAIR2 = (130, 85, 55, 255)
JKT = (32, 36, 48, 255)   # NEVER (0,0,0)
JKT2 = (50, 56, 72, 255)
CYAN = (90, 230, 255, 255)
CYAN2 = (50, 160, 200, 255)
PANT = (40, 44, 58, 255)
SHOE = (28, 30, 40, 255)
WHITE = (240, 248, 255, 255)


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def box(d, x, y, w, h, c):
    d.rectangle([int(x), int(y), int(x + w - 1), int(y + h - 1)], fill=c)


def draw_player(pose="idle", frame=0):
    im = blank(48, 64)
    d = ImageDraw.Draw(im)
    bob = legL = legR = armB = armF = shoot = 0
    blink = False

    if pose == "idle":
        bob = 1 if frame == 4 else 0
        blink = frame == 5
    elif pose == "walk":
        cyc = [(-3, 3, 2, -2), (-1, 1, 1, -1), (3, -3, -2, 2), (4, -4, -1, 1),
               (2, -2, -2, 2), (-1, 1, 1, -1), (-3, 3, 2, -2), (-4, 4, 1, -1)]
        legL, legR, armB, armF = cyc[frame % 8]
        bob = -1 if frame % 2 else 0
    elif pose == "run":
        cyc = [(-5, 5, 3, -3), (-2, 2, 2, -2), (4, -4, -3, 3), (6, -6, -2, 2),
               (3, -3, -3, 3), (-2, 2, 2, -2), (-5, 5, 3, -3), (-6, 6, 2, -2)]
        legL, legR, armB, armF = cyc[frame % 8]
        bob = -2 if frame % 2 else 0
    elif pose == "jump":
        bob, legL, legR, armB, armF = -6, -4, 5, -5, -4
    elif pose == "fall":
        bob, legL, legR, armB, armF = 2, 3, -3, 4, 5
    elif pose == "attack":
        stages = [(0, 0, -1, 4, 0), (0, 0, -1, 8, 2), (0, 0, -1, 12, 4),
                  (0, 0, -1, 14, 6), (0, 0, -1, 10, 4), (0, 0, -1, 4, 1)]
        legL, legR, armB, armF, shoot = stages[frame % 6]
    elif pose == "hurt":
        bob, armB, armF = 2, -2, -2
    elif pose == "death":
        if frame >= 3:
            box(d, 4, 42, 38, 12, JKT)
            box(d, 6, 34, 14, 10, SKIN)
            box(d, 2, 28, 22, 12, HAIR)
            box(d, 6, 54, 10, 4, SHOE)
            box(d, 28, 54, 10, 4, SHOE)
            box(d, 6, 56, 10, 2, CYAN)
            return im
        bob = frame * 2

    y = 4 + bob
    x = 4

    # hair
    box(d, x + 10, y, 24, 12, HAIR)
    box(d, x + 8, y + 6, 28, 12, HAIR)
    box(d, x + 6, y + 10, 12, 14, HAIR)
    box(d, x + 26, y + 8, 12, 14, HAIR)
    box(d, x + 12, y + 2, 10, 8, HAIR2)
    box(d, x + 20, y + 4, 8, 6, HAIR2)

    # head
    box(d, x + 14, y + 12, 16, 14, SKIN)
    box(d, x + 15, y + 13, 14, 2, SKIN2)
    if blink:
        box(d, x + 24, y + 17, 4, 2, HAIR)
    else:
        box(d, x + 24, y + 16, 4, 4, CYAN)
        box(d, x + 25, y + 17, 2, 2, (30, 34, 48, 255))
    box(d, x + 26, y + 19, 3, 2, SKIN2)
    box(d, x + 20, y + 21, 8, 2, HAIR)

    # torso filled solid
    box(d, x + 12, y + 26, 20, 20, JKT)
    box(d, x + 13, y + 27, 18, 4, JKT2)
    box(d, x + 14, y + 32, 16, 12, JKT)
    box(d, x + 12, y + 28, 2, 16, CYAN2)
    box(d, x + 30, y + 28, 2, 16, CYAN2)
    box(d, x + 14, y + 26, 12, 2, CYAN)

    # back arm
    box(d, x + 8, y + 28 + armB, 6, 12, JKT)
    box(d, x + 8, y + 39 + armB, 5, 4, SKIN)

    # front arm / shoot from HAND
    if pose == "attack" and shoot > 0:
        box(d, x + 28, y + 28, 6 + shoot, 6, JKT)
        box(d, x + 32 + shoot, y + 29, 5, 4, SKIN)  # hand
        box(d, x + 36 + shoot, y + 30, 6, 3, CYAN)  # muzzle flash
        box(d, x + 40 + shoot, y + 30, 3, 2, WHITE)
    else:
        box(d, x + 30, y + 28 + armF, 6, 12, JKT)
        box(d, x + 31, y + 39 + armF, 5, 4, SKIN)

    # legs solid
    ly = y + 46
    box(d, x + 14, ly + legL // 2, 7, 12, PANT)
    box(d, x + 23, ly + legR // 2, 7, 12, PANT)
    box(d, x + 16, ly - 2, 12, 6, PANT)
    sx1 = x + 12 + min(legL, 0)
    sx2 = x + 22 + min(legR, 0)
    box(d, sx1, ly + 11, 10, 5, SHOE)
    box(d, sx2, ly + 11, 10, 5, SHOE)
    box(d, sx1, ly + 14, 10, 2, CYAN)
    box(d, sx2, ly + 14, 10, 2, CYAN)

    if pose == "hurt":
        box(d, x + 18, y + 14, 6, 6, (255, 90, 130, 255))
    return im


def save_player():
    out = SPR / "player"
    out.mkdir(parents=True, exist_ok=True)
    specs = [("idle", 6), ("walk", 8), ("run", 8), ("jump", 4), ("fall", 2),
             ("attack", 6), ("hurt", 4), ("death", 8)]
    for name, n in specs:
        sheet = blank(48 * n, 64)
        for i in range(n):
            sheet.paste(draw_player(name, i), (i * 48, 0), draw_player(name, i))
        sheet.save(out / f"{name}.png")
    draw_player("idle", 0).crop((0, 8, 48, 56)).resize((48, 48), Image.NEAREST).save(out / "icon.png")
    print("player ok")


PAL = {
    "syntax": ((60, 200, 255, 255), (180, 255, 255, 255), (20, 50, 70, 255)),
    "runtime": ((255, 120, 60, 255), (255, 200, 120, 255), (70, 30, 10, 255)),
    "null": ((160, 100, 255, 255), (60, 30, 100, 255), (255, 90, 200, 255)),
    "leak": ((70, 230, 140, 255), (30, 130, 70, 255), (15, 55, 35, 255)),
    "legacy": ((210, 175, 80, 255), (130, 95, 40, 255), (55, 40, 15, 255)),
    "spaghetti": ((255, 95, 165, 255), (255, 180, 220, 255), (90, 25, 50, 255)),
}


def draw_enemy(slug, pose, frame):
    im = blank(40, 32)
    d = ImageDraw.Draw(im)
    body, core, eye = PAL[slug]
    if pose == "death":
        for i in range(5):
            box(d, 4 + i * 7, 8 + (i + frame) % 6, 4, 4, (*body[:3], 160))
        return im
    if pose == "hurt":
        body = (255, 255, 255, 255)
    bob = (frame % 2) if pose == "walk" else 0

    if slug == "syntax":
        box(d, 4, 4 + bob, 7, 24, body)
        box(d, 29, 4 + bob, 7, 24, body)
        box(d, 10, 8 + bob, 20, 16, core)
        box(d, 14, 12 + bob, 4, 4, eye)
        box(d, 22, 12 + bob, 4, 4, eye)
        if pose == "attack":
            box(d, 34, 12, 6, 4, CYAN)
    elif slug == "runtime":
        box(d, 6, 8 + bob, 28, 16, body)
        for sx in range(4, 36, 8):
            box(d, sx, 2 + bob, 5, 7, body)
        box(d, 12, 12 + bob, 4, 4, eye)
        box(d, 22, 12 + bob, 4, 4, eye)
        box(d, 8, 24 + bob, 8, 6, body)
        box(d, 24, 24 + bob, 8, 6, body)
    elif slug == "null":
        box(d, 16, 2 + bob, 8, 6, body)
        box(d, 8, 8 + bob, 24, 16, body)
        box(d, 14, 12 + bob, 12, 10, core)
        box(d, 18, 15 + bob, 4, 4, eye)
    elif slug == "leak":
        box(d, 6, 6 + bob, 28, 16, body)
        box(d, 10, 10 + bob, 20, 8, core)
        box(d, 12, 12 + bob, 3, 3, eye)
        box(d, 22, 12 + bob, 3, 3, eye)
        h = 4 + (frame % 4) * 3
        box(d, 16, 22, 5, h, body)
    elif slug == "legacy":
        box(d, 2, 6 + bob, 36, 20, body)
        box(d, 4, 8 + bob, 32, 4, core)
        box(d, 8, 14 + bob, 6, 6, eye)
        box(d, 24, 14 + bob, 6, 6, eye)
        box(d, 6, 26 + bob, 10, 5, body)
        box(d, 24, 26 + bob, 10, 5, body)
    else:
        for i, yy in enumerate((6, 12, 18, 22)):
            box(d, 4 + ((i + frame) % 4), yy + bob, 30 - i * 2, 5, body)
        box(d, 14, 10 + bob, 12, 10, core)
        box(d, 16, 13 + bob, 3, 3, eye)
        box(d, 22, 13 + bob, 3, 3, eye)
    return im


def save_enemies():
    for slug in PAL:
        out = SPR / "enemies" / slug
        out.mkdir(parents=True, exist_ok=True)
        for pose, n in [("idle", 4), ("walk", 6), ("attack", 4), ("hurt", 3), ("death", 6)]:
            sheet = blank(40 * n, 32)
            for i in range(n):
                fr = draw_enemy(slug, pose, i)
                sheet.paste(fr, (i * 40, 0), fr)
            sheet.save(out / f"{pose}.png")
    print("enemies ok")


if __name__ == "__main__":
    save_player()
    save_enemies()
    # verify no pure black in opaque pixels
    im = Image.open(SPR / "player" / "idle.png").convert("RGBA")
    px = im.load()
    bad = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 200 and r + g + b == 0:
                bad += 1
    print("pure_black_in_player", bad)
    print("done")
