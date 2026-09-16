"""Richer side-view player + distinct enemy sprites for Phaser sheets."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"
T = (0, 0, 0, 0)

SKIN = (240, 204, 174)
SKIN2 = (220, 170, 140)
HAIR = (86, 52, 34)
HAIR2 = (120, 78, 48)
JKT = (22, 24, 32)
JKT2 = (42, 46, 60)
CYAN = (90, 230, 255)
CYAN2 = (40, 150, 190)
PANT = (18, 20, 28)
SHOE = (12, 12, 18)


def sheet(n, fw, fh):
    im = Image.new("RGBA", (n * fw, fh), T)
    return im, ImageDraw.Draw(im)


def box(d, x, y, w, h, c):
    if len(c) == 3:
        c = (*c, 255)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def player_frame(d, ox, frame, pose):
    # Side-view facing right. ox is frame origin.
    bob = 0
    legL = legR = 0
    arm = 0
    if pose == "walk":
        bob = [0, -1, 0, -1, 0, -1, 0, -1][frame % 8]
        legL = [-3, -1, 2, 4, 2, -1, -3, -4][frame % 8]
        legR = -legL
        arm = -legL // 2
    elif pose == "run":
        bob = [0, -2, 0, -2, 0, -2, 0, -2][frame % 8]
        legL = [-5, -2, 3, 6, 3, -2, -5, -6][frame % 8]
        legR = -legL
        arm = -legL // 2
    elif pose == "jump":
        bob = -4
        legL, legR = -2, 3
        arm = -4
    elif pose == "fall":
        bob = 1
        legL, legR = 2, -2
        arm = 3
    elif pose == "attack":
        arm = 8 + min(frame, 3)
    elif pose == "hurt":
        bob = 2
        arm = -2
    elif pose == "death":
        # lying
        box(d, ox + 6, 40, 36, 10, JKT)
        box(d, ox + 8, 34, 14, 10, SKIN)
        box(d, ox + 4, 28, 20, 12, HAIR)
        box(d, ox + 6, 50, 10, 4, SHOE)
        box(d, ox + 28, 50, 10, 4, SHOE)
        box(d, ox + 6, 52, 10, 2, CYAN)
        return
    elif pose == "idle":
        bob = 0 if frame < 5 else 0
        arm = 0

    y = 2 + bob

    # hair (curly volume, side)
    box(d, ox + 14, y + 2, 22, 10, HAIR)
    box(d, ox + 12, y + 6, 26, 10, HAIR)
    box(d, ox + 10, y + 10, 10, 12, HAIR)
    box(d, ox + 30, y + 8, 10, 12, HAIR)
    box(d, ox + 16, y + 4, 8, 6, HAIR2)
    box(d, ox + 24, y + 6, 6, 5, HAIR2)

    # head
    box(d, ox + 18, y + 12, 14, 12, SKIN)
    box(d, ox + 19, y + 13, 12, 2, SKIN2)
    # eye
    if not (pose == "idle" and frame == 5):
        box(d, ox + 26, y + 16, 3, 3, CYAN)
    else:
        box(d, ox + 26, y + 17, 3, 1, HAIR)
    # nose / mustache
    box(d, ox + 28, y + 19, 2, 2, SKIN2)
    box(d, ox + 24, y + 21, 6, 2, HAIR)

    # torso jacket
    box(d, ox + 16, y + 26, 16, 18, JKT)
    box(d, ox + 17, y + 27, 14, 3, JKT2)
    box(d, ox + 16, y + 28, 2, 14, CYAN2)
    box(d, ox + 30, y + 28, 2, 14, CYAN2)
    box(d, ox + 18, y + 26, 10, 2, CYAN)

    # back arm
    box(d, ox + 12, y + 28 + arm // 2, 5, 11, JKT)
    box(d, ox + 12, y + 38 + arm // 2, 4, 3, SKIN)
    # front arm / attack
    if pose == "attack":
        box(d, ox + 30, y + 30, 12, 5, JKT)
        box(d, ox + 40, y + 31, 6, 3, CYAN)
    else:
        box(d, ox + 30, y + 28 - arm // 2, 5, 11, JKT)
        box(d, ox + 31, y + 38 - arm // 2, 4, 3, SKIN)

    # legs
    box(d, ox + 17, y + 44 + legL // 3, 6, 12, PANT)
    box(d, ox + 25, y + 44 + legR // 3, 6, 12, PANT)
    box(d, ox + 15 + min(legL, 0), y + 55, 9, 4, SHOE)
    box(d, ox + 24 + min(legR, 0), y + 55, 9, 4, SHOE)
    box(d, ox + 15 + min(legL, 0), y + 57, 9, 2, CYAN)
    box(d, ox + 24 + min(legR, 0), y + 57, 9, 2, CYAN)

    if pose == "hurt":
        box(d, ox + 22, y + 14, 5, 5, (255, 90, 130))


def save_player():
    out = SPR / "player"
    out.mkdir(parents=True, exist_ok=True)
    for name, n in [("idle", 6), ("walk", 8), ("run", 8), ("jump", 4), ("fall", 2), ("attack", 6), ("hurt", 4), ("death", 8)]:
        im, d = sheet(n, 48, 64)
        for i in range(n):
            player_frame(d, i * 48, i, name)
        im.save(out / f"{name}.png")
    icon = Image.new("RGBA", (48, 48), T)
    player_frame(ImageDraw.Draw(icon), 0, 0, "idle")
    icon.save(out / "icon.png")
    print("player ok")


PAL = {
    "syntax": ((60, 200, 255), (180, 255, 255), (8, 40, 60)),
    "runtime": ((255, 110, 60), (255, 200, 120), (60, 20, 8)),
    "null": ((150, 90, 255), (50, 20, 90), (255, 80, 200)),
    "leak": ((70, 230, 140), (30, 120, 70), (10, 50, 30)),
    "legacy": ((210, 175, 80), (120, 90, 35), (50, 35, 10)),
    "spaghetti": ((255, 85, 160), (255, 180, 220), (80, 15, 45)),
}


def enemy_frame(d, ox, slug, frame, pose):
    body, core, eye = PAL[slug]
    if pose == "death":
        for i in range(5):
            box(d, ox + 4 + i * 7, 8 + (i + frame) % 6, 4, 4, (*body[:3], 140))
        return
    if pose == "hurt":
        body = (255, 255, 255)
    bob = (frame % 2) if pose == "walk" else 0

    if slug == "syntax":
        # {} bug
        box(d, ox + 4, 4 + bob, 7, 24, body)
        box(d, ox + 29, 4 + bob, 7, 24, body)
        box(d, ox + 10, 8 + bob, 20, 16, core)
        box(d, ox + 14, 12 + bob, 4, 4, eye)
        box(d, ox + 22, 12 + bob, 4, 4, eye)
        if pose == "attack":
            box(d, ox + 34, 12, 6, 4, CYAN)
    elif slug == "runtime":
        box(d, ox + 6, 8 + bob, 28, 16, body)
        for sx in range(4, 36, 8):
            box(d, ox + sx, 2 + bob, 5, 7, body)
        box(d, ox + 12, 12 + bob, 4, 4, eye)
        box(d, ox + 22, 12 + bob, 4, 4, eye)
        box(d, ox + 8, 24 + bob, 8, 6, body)
        box(d, ox + 24, 24 + bob, 8, 6, body)
    elif slug == "null":
        box(d, ox + 16, 2 + bob, 8, 6, body)
        box(d, ox + 8, 8 + bob, 24, 16, body)
        box(d, ox + 14, 12 + bob, 12, 10, core)
        box(d, ox + 18, 15 + bob, 4, 4, eye)
        if frame % 2 == 0:
            box(d, ox + 2, 12, 6, 6, (*body[:3], 100))
            box(d, ox + 32, 12, 6, 6, (*body[:3], 100))
    elif slug == "leak":
        box(d, ox + 6, 6 + bob, 28, 16, body)
        box(d, ox + 10, 10 + bob, 20, 8, core)
        box(d, ox + 12, 12 + bob, 3, 3, eye)
        box(d, ox + 22, 12 + bob, 3, 3, eye)
        h = 4 + (frame % 4) * 3
        box(d, ox + 16, 22, 5, h, body)
        box(d, ox + 26, 22, 4, max(2, h - 2), body)
    elif slug == "legacy":
        box(d, ox + 2, 6 + bob, 36, 20, body)
        box(d, ox + 4, 8 + bob, 32, 4, core)
        box(d, ox + 8, 14 + bob, 6, 6, eye)
        box(d, ox + 24, 14 + bob, 6, 6, eye)
        box(d, ox + 6, 26 + bob, 10, 5, body)
        box(d, ox + 24, 26 + bob, 10, 5, body)
    else:
        for i, yy in enumerate((6, 12, 18, 22)):
            box(d, ox + 4 + ((i + frame) % 4), yy + bob, 30 - i * 2, 5, body)
        box(d, ox + 14, 10 + bob, 12, 10, core)
        box(d, ox + 16, 13 + bob, 3, 3, eye)
        box(d, ox + 22, 13 + bob, 3, 3, eye)


def save_enemies():
    for slug in PAL:
        out = SPR / "enemies" / slug
        out.mkdir(parents=True, exist_ok=True)
        for pose, n in [("idle", 4), ("walk", 6), ("attack", 4), ("hurt", 3), ("death", 6)]:
            im, d = sheet(n, 40, 32)
            for i in range(n):
                enemy_frame(d, i * 40, slug, i, pose)
            im.save(out / f"{pose}.png")
    print("enemies ok")


def save_tiles():
    out = SPR / "tiles"
    out.mkdir(parents=True, exist_ok=True)
    plat = Image.new("RGBA", (128, 24), T)
    d = ImageDraw.Draw(plat)
    d.rounded_rectangle([0, 2, 127, 23], radius=3, fill=(12, 18, 40, 255))
    d.rectangle([0, 2, 127, 6], fill=(70, 220, 255, 255))
    d.rectangle([0, 6, 127, 8], fill=(140, 245, 255, 160))
    for x in range(6, 122, 14):
        d.rectangle([x, 11, x + 8, 19], fill=(28, 40, 70, 220))
        d.point((x + 2, 13), fill=(70, 220, 255, 200))
    plat.save(out / "platform.png")

    floor = Image.new("RGBA", (64, 32), T)
    d = ImageDraw.Draw(floor)
    d.rectangle([0, 6, 63, 31], fill=(10, 14, 28, 255))
    d.rectangle([0, 6, 63, 10], fill=(70, 220, 255, 255))
    for x in range(0, 64, 8):
        d.line([(x, 12), (x + 3, 30)], fill=(36, 48, 78, 200))
    floor.save(out / "floor.png")
    print("tiles ok")


if __name__ == "__main__":
    save_player()
    save_enemies()
    save_tiles()
    print("done")
