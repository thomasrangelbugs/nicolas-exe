"""ADJUST existing AI poses only: keep art, fix transparency (no remake).
- Clear black only if connected to image border
- Lift remaining pure-black body pixels to dark grey so jacket isn't punched out
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageEnhance

GEN = Path(r"C:\Users\\Usuário\.cursor\projects\c-Users-Usu-rio-Downloads-Thomas-THOMAS-projetos-NICOLAS-EXE-Birthday-Build-Netlify\assets")
ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"
FW, FH = 48, 64
DARK = (26, 28, 36, 255)


def fix_alpha(im, thr=40):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    vis = [[False] * w for _ in range(h)]
    q = deque()

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r <= thr and g <= thr and b <= thr

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                q.append((x, y)); vis[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not vis[y][x] and is_bg(x, y):
                q.append((x, y)); vis[y][x] = True

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not vis[ny][nx] and is_bg(nx, ny):
                vis[ny][nx] = True
                q.append((nx, ny))

    # body: never leave pure black opaque pixels
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 180 and r < 22 and g < 22 and b < 22:
                px[x, y] = DARK
    return im


def fit(im, fw, fh):
    im = fix_alpha(im)
    bb = im.split()[-1].getbbox()
    if not bb:
        return Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    crop = im.crop(bb)
    cw, ch = crop.size
    s = min((fw - 2) / cw, (fh - 2) / ch)
    nw, nh = max(1, int(cw * s)), max(1, int(ch * s))
    crop = crop.resize((nw, nh), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    out.paste(crop, ((fw - nw) // 2, fh - nh - 1), crop)
    return out


def nudge(fr, dx=0, dy=0):
    out = Image.new("RGBA", fr.size, (0, 0, 0, 0))
    out.paste(fr, (dx, dy), fr)
    return out


def sheet(frames, fw, fh):
    im = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        im.paste(fr, (i * fw, 0), fr)
    return im


def adjust_player():
    idle = fit(Image.open(GEN / "pose_idle.png"), FW, FH)
    walk = fit(Image.open(GEN / "pose_walk.png"), FW, FH)
    jump = fit(Image.open(GEN / "pose_jump.png"), FW, FH)
    shoot = fit(Image.open(GEN / "pose_shoot.png"), FW, FH)
    out = SPR / "player"
    out.mkdir(parents=True, exist_ok=True)

    blink = idle.copy()
    p = blink.load()
    for y in range(12, 24):
        for x in range(22, 34):
            r, g, b, a = p[x, y]
            if a > 200 and b > 170 and g > 140:
                p[x, y] = (45, 38, 32, 255)

    sheet([idle, idle, idle, idle, nudge(idle, 0, 1), blink], FW, FH).save(out / "idle.png")
    sheet([nudge(walk, d, (-1 if i % 2 else 0)) for i, d in enumerate([0, 0, 1, 0, 0, 0, -1, 0])], FW, FH).save(out / "walk.png")
    sheet([nudge(walk, d, -abs(d) // 2) for d in (0, 1, 2, 1, 0, -1, -2, -1)], FW, FH).save(out / "run.png")
    sheet([nudge(jump, 0, -1), jump, jump, nudge(jump, 0, 1)], FW, FH).save(out / "jump.png")
    sheet([nudge(jump, 0, 2), nudge(idle, 0, 2)], FW, FH).save(out / "fall.png")
    # standing shoot — if shoot pose is kneeling, blend: idle body + prefer shoot arm frames
    sheet([idle, nudge(shoot, 1, 0), shoot, shoot, nudge(shoot, 1, 0), idle], FW, FH).save(out / "attack.png")
    hurt = [ImageEnhance.Color(nudge(idle, -2 - i // 2, i % 2)).enhance(0.45) for i in range(4)]
    sheet(hurt, FW, FH).save(out / "hurt.png")
    death = []
    for i in range(8):
        fr = idle.rotate(-i * 9, resample=Image.Resampling.NEAREST, expand=False, fillcolor=(0, 0, 0, 0))
        death.append(nudge(fr, i, i // 2))
    sheet(death, FW, FH).save(out / "death.png")
    idle.resize((48, 48), Image.Resampling.NEAREST).save(out / "icon.png")
    print("player adjusted (same art, transparency fix)")


def adjust_enemies():
    src = fix_alpha(Image.open(GEN / "enemies_big.png"), thr=32)
    w, h = src.size
    cw, ch = w // 3, h // 2
    order = [
        ("syntax", 0, 0), ("runtime", 1, 0), ("null", 2, 0),
        ("leak", 0, 1), ("legacy", 1, 1), ("spaghetti", 2, 1),
    ]
    for slug, cx, cy in order:
        cell = src.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))
        base = fit(cell, 40, 32)
        folder = SPR / "enemies" / slug
        folder.mkdir(parents=True, exist_ok=True)
        idle = [base, nudge(base, 0, -1), base, nudge(base, 0, -1)]
        walk = [nudge(base, d, 0 if i % 2 else -1) for i, d in enumerate([0, 1, 2, 1, 0, -1])]
        attack = [nudge(base, min(i, 2), 0) for i in range(4)]
        hurt = [nudge(base, -1, 0), nudge(base, -2, 1), nudge(base, -1, 0)]
        death = []
        for i in range(6):
            fr = base.copy()
            fr.putalpha(max(40, 255 - i * 38))
            death.append(nudge(fr, i, i // 2))

        def save(name, frames):
            sheet(frames, 40, 32).save(folder / f"{name}.png")

        save("idle", idle)
        save("walk", walk)
        save("attack", attack)
        save("hurt", hurt)
        save("death", death)
    print("enemies adjusted (same art, transparency fix)")


if __name__ == "__main__":
    adjust_player()
    adjust_enemies()
    im = Image.open(SPR / "player" / "idle.png").convert("RGBA")
    px = im.load()
    bad = sum(1 for y in range(im.height) for x in range(im.width)
              if (lambda p: p[3] > 200 and p[0] + p[1] + p[2] == 0)(px[x, y]))
    print("pure_black_left", bad, "idle_bytes", (SPR / "player" / "idle.png").stat().st_size)
