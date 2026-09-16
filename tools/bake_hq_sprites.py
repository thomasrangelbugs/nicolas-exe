"""Bake player/enemy sheets from AI poses. Only remove black connected to edges (keeps dark jacket)."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageEnhance

GEN = Path(r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-Downloads-Thomas-THOMAS-projetos-NICOLAS-EXE-Birthday-Build-Netlify\assets")
ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"
FW, FH = 48, 64


def flood_clear_bg(im, thr=36):
    """Make near-black pixels transparent ONLY if connected to image border."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    vis = [[False] * w for _ in range(h)]
    q = deque()

    def dark(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r <= thr and g <= thr and b <= thr

    for x in range(w):
        for y in (0, h - 1):
            if dark(x, y):
                q.append((x, y)); vis[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if dark(x, y) and not vis[y][x]:
                q.append((x, y)); vis[y][x] = True

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not vis[ny][nx] and dark(nx, ny):
                vis[ny][nx] = True
                q.append((nx, ny))

    # harden near-black clothing to dark grey so it never keys as void
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 200 and r < 18 and g < 18 and b < 18:
                px[x, y] = (22, 24, 32, 255)
    return im


def fit_frame(im, fw=FW, fh=FH):
    im = flood_clear_bg(im)
    bb = im.split()[-1].getbbox()
    if not bb:
        return Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    crop = im.crop(bb)
    cw, ch = crop.size
    scale = min((fw - 2) / cw, (fh - 2) / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    crop = crop.resize((nw, nh), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    out.paste(crop, ((fw - nw) // 2, fh - nh - 1), crop)
    return out


def sheet(frames):
    im = Image.new("RGBA", (FW * len(frames), FH), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        im.paste(fr, (i * FW, 0), fr)
    return im


def nudge(fr, dx=0, dy=0):
    out = Image.new("RGBA", fr.size, (0, 0, 0, 0))
    out.paste(fr, (dx, dy), fr)
    return out


def make_player():
    idle = fit_frame(Image.open(GEN / "pose_idle.png"))
    walk = fit_frame(Image.open(GEN / "pose_walk.png"))
    jump = fit_frame(Image.open(GEN / "pose_jump.png"))
    shoot = fit_frame(Image.open(GEN / "pose_shoot.png"))
    out = SPR / "player"
    out.mkdir(parents=True, exist_ok=True)

    idle_frames = [idle, idle, idle, idle, nudge(idle, 0, 1), idle]
    # blink last
    blink = idle.copy()
    p = blink.load()
    for y in range(14, 22):
        for x in range(24, 34):
            r, g, b, a = p[x, y]
            if a > 200 and b > 180 and g > 150:
                p[x, y] = (50, 40, 35, 255)
    idle_frames[5] = blink

    walk_frames = []
    for i, (dx, dy) in enumerate([(0, 0), (0, -1), (1, 0), (0, -1), (0, 0), (0, -1), (-1, 0), (0, -1)]):
        base = walk if i % 2 == 0 else idle
        # alternate walk/idle for stride feel, prefer walk pose
        base = walk
        walk_frames.append(nudge(base, dx, dy))

    run_frames = [nudge(walk, d, -abs(d) // 2) for d in (0, 1, 2, 1, 0, -1, -2, -1)]
    jump_frames = [nudge(jump, 0, -1), jump, jump, nudge(jump, 0, 1)]
    fall_frames = [nudge(jump, 0, 2), nudge(idle, 0, 2)]
    attack_frames = [idle, nudge(shoot, 1, 0), shoot, shoot, nudge(shoot, 1, 0), idle]
    hurt_frames = []
    for i in range(4):
        fr = nudge(idle, -2 - i // 2, i % 2)
        hurt_frames.append(ImageEnhance.Color(fr).enhance(0.4))
    death_frames = []
    for i in range(8):
        fr = idle.rotate(-i * 10, resample=Image.Resampling.NEAREST, expand=False, fillcolor=(0, 0, 0, 0))
        death_frames.append(nudge(fr, i, i // 2))

    sheet(idle_frames).save(out / "idle.png")
    sheet(walk_frames).save(out / "walk.png")
    sheet(run_frames).save(out / "run.png")
    sheet(jump_frames).save(out / "jump.png")
    sheet(fall_frames).save(out / "fall.png")
    sheet(attack_frames).save(out / "attack.png")
    sheet(hurt_frames).save(out / "hurt.png")
    sheet(death_frames).save(out / "death.png")
    idle.resize((48, 48), Image.Resampling.NEAREST).save(out / "icon.png")
    print("player baked")


def make_enemies():
    src = flood_clear_bg(Image.open(GEN / "enemies_big.png"), thr=30)
    w, h = src.size
    cw, ch = w // 3, h // 2
    order = [
        ("syntax", 0, 0), ("runtime", 1, 0), ("null", 2, 0),
        ("leak", 0, 1), ("legacy", 1, 1), ("spaghetti", 2, 1),
    ]
    for slug, cx, cy in order:
        cell = src.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))
        # enemies taller — fit into 40x48 then we'll use 40x32... use 40x40 sheet? Boot expects 40x32
        # Keep 40x32 but fill height better
        base = fit_frame(cell, 40, 32)
        folder = SPR / "enemies" / slug
        folder.mkdir(parents=True, exist_ok=True)
        idle = [base, nudge(base, 0, -1), base, nudge(base, 0, -1)]
        walk = [nudge(base, d, 0 if i % 2 else -1) for i, d in enumerate([0, 1, 2, 1, 0, -1])]
        attack = [nudge(base, min(i, 2), 0) for i in range(4)]
        hurt = [nudge(base, -1, 0), nudge(base, -2, 1), nudge(base, -1, 0)]
        death = []
        for i in range(6):
            fr = base.copy()
            fr.putalpha(max(30, 255 - i * 40))
            death.append(nudge(fr, i, i // 2))

        def save(name, frames, fw=40, fh=32):
            im = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                im.paste(fr, (i * fw, 0), fr)
            im.save(folder / f"{name}.png")

        save("idle", idle)
        save("walk", walk)
        save("attack", attack)
        save("hurt", hurt)
        save("death", death)
    print("enemies baked")


if __name__ == "__main__":
    make_player()
    make_enemies()
    print("done")
