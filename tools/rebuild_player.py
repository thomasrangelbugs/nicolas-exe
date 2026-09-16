"""Solid opaque Nicolas player spritesheets with real pose variation.
Uses near-black greys for clothing (never #000) so nothing looks punched-out.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "sprites" / "player"
FW, FH = 48, 64

# Never pure black on body — #000 only as transparent bg via alpha
SKIN = (242, 206, 176, 255)
SKIN2 = (218, 168, 138, 255)
HAIR = (88, 54, 36, 255)
HAIR2 = (124, 80, 50, 255)
JKT = (28, 30, 40, 255)      # dark grey, not #000
JKT2 = (48, 52, 68, 255)
CYAN = (90, 230, 255, 255)
CYAN2 = (45, 155, 195, 255)
PANT = (32, 36, 48, 255)
SHOE = (24, 26, 34, 255)
EYE = (30, 34, 48, 255)


def blank():
    return Image.new("RGBA", (FW, FH), (0, 0, 0, 0))


def box(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def draw_nicolas(pose="idle", frame=0):
    im = blank()
    d = ImageDraw.Draw(im)

    # pose offsets
    bob = 0
    legL = legR = 0
    armB = armF = 0
    bodyX = 0
    shoot = 0
    crouch = 0

    if pose == "idle":
        bob = 0 if frame < 4 else (1 if frame == 4 else 0)
        blink = frame == 5
    elif pose == "walk":
        cycle = [
            (0, -3, 3, 2, -2),
            (-1, -1, 1, 1, -1),
            (0, 2, -2, -2, 2),
            (-1, 4, -4, -1, 1),
            (0, 2, -2, -2, 2),
            (-1, -1, 1, 1, -1),
            (0, -3, 3, 2, -2),
            (-1, -4, 4, 1, -1),
        ][frame % 8]
        bob, legL, legR, armB, armF = cycle
        blink = False
    elif pose == "run":
        cycle = [
            (0, -5, 5, 3, -3),
            (-2, -2, 2, 2, -2),
            (0, 4, -4, -3, 3),
            (-2, 6, -6, -2, 2),
            (0, 4, -4, -3, 3),
            (-2, -2, 2, 2, -2),
            (0, -5, 5, 3, -3),
            (-2, -6, 6, 2, -2),
        ][frame % 8]
        bob, legL, legR, armB, armF = cycle
        bodyX = 1
        blink = False
    elif pose == "jump":
        bob = -6
        legL, legR = -4, 5
        armB, armF = -5, -4
        blink = False
    elif pose == "fall":
        bob = 2
        legL, legR = 3, -3
        armB, armF = 4, 5
        blink = False
    elif pose == "attack":
        # windup → fire → recover
        stages = [(0, 0, 0, -1, 2), (0, 0, 0, -1, 6), (0, 0, 0, -1, 10),
                  (0, 0, 0, -1, 12), (0, 0, 0, -1, 8), (0, 0, 0, -1, 3)]
        bob, legL, legR, armB, armF = stages[frame % 6]
        shoot = min(frame, 3) * 2
        blink = False
    elif pose == "hurt":
        bob = 2
        bodyX = -3
        armB, armF = -2, -2
        blink = False
    elif pose == "death":
        # collapse to the right over frames
        t = frame / 7
        # draw fallen pose late
        if frame >= 4:
            y = 38
            box(d, 4, y, 38, 12, JKT)
            box(d, 6, y + 1, 34, 3, JKT2)
            box(d, 6, y - 8, 14, 10, SKIN)
            box(d, 2, y - 14, 22, 12, HAIR)
            box(d, 4, y - 12, 8, 6, HAIR2)
            box(d, 8, y + 12, 10, 4, SHOE)
            box(d, 28, y + 12, 10, 4, SHOE)
            box(d, 8, y + 14, 10, 2, CYAN)
            box(d, 28, y + 14, 10, 2, CYAN)
            return im
        bob = int(t * 8)
        bodyX = int(t * 6)
        armB = armF = int(t * 4)
        blink = False
    else:
        blink = False

    y = 4 + bob
    x = 2 + bodyX

    # --- hair (opaque curls) ---
    box(d, x + 12, y + 0, 24, 12, HAIR)
    box(d, x + 10, y + 6, 28, 12, HAIR)
    box(d, x + 8, y + 10, 12, 14, HAIR)
    box(d, x + 28, y + 8, 12, 14, HAIR)
    box(d, x + 14, y + 2, 10, 8, HAIR2)
    box(d, x + 22, y + 4, 8, 6, HAIR2)
    box(d, x + 16, y + 10, 6, 6, HAIR2)

    # --- head ---
    box(d, x + 16, y + 12, 16, 14, SKIN)
    box(d, x + 17, y + 13, 14, 2, SKIN2)
    if blink:
        box(d, x + 26, y + 17, 4, 2, HAIR)
    else:
        box(d, x + 26, y + 16, 4, 4, CYAN)
        box(d, x + 27, y + 17, 2, 2, EYE)
    box(d, x + 28, y + 19, 3, 2, SKIN2)  # nose
    box(d, x + 22, y + 21, 8, 2, HAIR)   # mustache
    box(d, x + 24, y + 23, 4, 2, SKIN2)  # mouth

    # --- torso jacket (fully filled, no holes) ---
    box(d, x + 14, y + 26, 20, 20, JKT)
    box(d, x + 15, y + 27, 18, 4, JKT2)
    box(d, x + 16, y + 32, 16, 12, JKT)  # fill mid
    # cyan trim (accent only on edges, not speckles)
    box(d, x + 14, y + 28, 2, 16, CYAN2)
    box(d, x + 32, y + 28, 2, 16, CYAN2)
    box(d, x + 16, y + 26, 12, 2, CYAN)

    # --- back arm ---
    box(d, x + 10, y + 28 + armB, 6, 12, JKT)
    box(d, x + 10, y + 39 + armB, 5, 4, SKIN)

    # --- front arm / shoot ---
    if pose == "attack" and shoot > 0:
        box(d, x + 30, y + 30, 8 + shoot, 6, JKT)
        box(d, x + 36 + shoot, y + 31, 6, 4, CYAN)
        box(d, x + 40 + shoot, y + 32, 4, 2, (255, 255, 255, 255))
    else:
        box(d, x + 32, y + 28 + armF, 6, 12, JKT)
        box(d, x + 33, y + 39 + armF, 5, 4, SKIN)

    # --- legs ---
    ly = y + 46
    box(d, x + 16, ly + legL // 2, 7, 12, PANT)
    box(d, x + 25, ly + legR // 2, 7, 12, PANT)
    # fill crotch so no gap
    box(d, x + 18, ly - 2, 12, 6, PANT)

    # shoes
    sx1 = x + 14 + min(legL, 0)
    sx2 = x + 24 + min(legR, 0)
    sy = ly + 11
    box(d, sx1, sy, 10, 5, SHOE)
    box(d, sx2, sy, 10, 5, SHOE)
    box(d, sx1, sy + 3, 10, 2, CYAN)
    box(d, sx2, sy + 3, 10, 2, CYAN)

    if pose == "hurt":
        box(d, x + 20, y + 14, 6, 6, (255, 90, 130, 255))

    return im


def save_sheet(name, frames, pose):
    sheet = Image.new("RGBA", (FW * frames, FH), (0, 0, 0, 0))
    for i in range(frames):
        fr = draw_nicolas(pose, i)
        sheet.paste(fr, (i * FW, 0), fr)
    sheet.save(OUT / f"{name}.png")
    print(f"  {name}.png ({frames} frames)")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    save_sheet("idle", 6, "idle")
    save_sheet("walk", 8, "walk")
    save_sheet("run", 8, "run")
    save_sheet("jump", 4, "jump")
    save_sheet("fall", 2, "fall")
    save_sheet("attack", 6, "attack")
    save_sheet("hurt", 4, "hurt")
    save_sheet("death", 8, "death")
    icon = draw_nicolas("idle", 0).crop((0, 8, 48, 56)).resize((48, 48), Image.NEAREST)
    icon.save(OUT / "icon.png")
    print("player sprites rebuilt (opaque + animated)")


if __name__ == "__main__":
    main()
