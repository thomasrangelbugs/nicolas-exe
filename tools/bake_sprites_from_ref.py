"""Build Phaser spritesheets from generated high-quality pixel references."""
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
GEN = Path(r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-Downloads-Thomas-THOMAS-projetos-NICOLAS-EXE-Birthday-Build-Netlify\assets")
SPR = ROOT / "assets" / "sprites"
T = (0, 0, 0, 0)


def strip_bg(im, thr=28):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < thr and g < thr and b < thr:
                px[x, y] = T
    return im


def bbox_content(im):
    a = im.split()[-1]
    bb = a.getbbox()
    return bb or (0, 0, im.width, im.height)


def fit_frame(im, fw, fh, pad=2):
    im = strip_bg(im)
    bb = bbox_content(im)
    crop = im.crop(bb)
    # scale to fit
    cw, ch = crop.size
    scale = min((fw - pad * 2) / cw, (fh - pad * 2) / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    crop = crop.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (fw, fh), T)
    out.paste(crop, ((fw - nw) // 2, fh - nh - 1), crop)
    return out


def sheet_from_frames(frames, fw, fh):
    im = Image.new("RGBA", (fw * len(frames), fh), T)
    for i, fr in enumerate(frames):
        im.paste(fr, (i * fw, 0), fr)
    return im


def wobble(frame, dx=0, dy=0):
    out = Image.new("RGBA", frame.size, T)
    out.paste(frame, (dx, dy), frame)
    return out


def make_player():
    src = Image.open(GEN / "nicolas_hero_ref.png")
    base = fit_frame(src, 48, 64, pad=1)
    out = SPR / "player"
    out.mkdir(parents=True, exist_ok=True)

    idle = [base, base, base, base, base, wobble(base, 0, 1)]
    # blink: darken eye-ish region roughly
    blink = base.copy()
    px = blink.load()
    for y in range(16, 22):
        for x in range(26, 32):
            r, g, b, a = px[x, y]
            if a > 200 and g > 180 and b > 180:
                px[x, y] = (40, 30, 30, 255)
    idle[5] = blink

    walk = []
    for i, (dx, dy) in enumerate([(0, 0), (0, -1), (1, 0), (0, -1), (0, 0), (0, -1), (-1, 0), (0, -1)]):
        walk.append(wobble(base, dx, dy))

    run = []
    for i, (dx, dy) in enumerate([(0, 0), (1, -2), (2, 0), (1, -2), (0, 0), (-1, -2), (-2, 0), (-1, -2)]):
        run.append(wobble(base, dx, dy))

    jump = [wobble(base, 0, -4), wobble(base, 0, -5), wobble(base, 0, -4), wobble(base, 0, -3)]
    fall = [wobble(base, 0, 1), wobble(base, 0, 2)]
    attack = []
    for i in range(6):
        attack.append(wobble(base, min(i, 3), 0))
    hurt = [wobble(base, -2, 1), wobble(base, -3, 2), wobble(base, -2, 1), wobble(base, -1, 0)]
    # tint hurt red
    for i, fr in enumerate(hurt):
        enh = ImageEnhance.Color(fr)
        hurt[i] = enh.enhance(0.5)

    death = []
    for i in range(8):
        fr = wobble(base, 0, min(i, 4))
        fr = fr.rotate(-i * 8, resample=Image.NEAREST, expand=False, fillcolor=T)
        death.append(fr)

    sheet_from_frames(idle, 48, 64).save(out / "idle.png")
    sheet_from_frames(walk, 48, 64).save(out / "walk.png")
    sheet_from_frames(run, 48, 64).save(out / "run.png")
    sheet_from_frames(jump, 48, 64).save(out / "jump.png")
    sheet_from_frames(fall, 48, 64).save(out / "fall.png")
    sheet_from_frames(attack, 48, 64).save(out / "attack.png")
    sheet_from_frames(hurt, 48, 64).save(out / "hurt.png")
    sheet_from_frames(death, 48, 64).save(out / "death.png")
    base.resize((48, 48), Image.NEAREST).save(out / "icon.png")
    print("player from ref ok")


def make_enemies():
    src = strip_bg(Image.open(GEN / "enemies_ref_sheet.png"))
    w, h = src.size
    # 2x3 grid
    cell_w, cell_h = w // 3, h // 2
    order = [
        ("syntax", 0, 0), ("runtime", 1, 0), ("null", 2, 0),
        ("leak", 0, 1), ("legacy", 1, 1), ("spaghetti", 2, 1),
    ]
    for slug, cx, cy in order:
        cell = src.crop((cx * cell_w, cy * cell_h, (cx + 1) * cell_w, (cy + 1) * cell_h))
        base = fit_frame(cell, 40, 32, pad=1)
        folder = SPR / "enemies" / slug
        folder.mkdir(parents=True, exist_ok=True)
        idle = [base, wobble(base, 0, -1), base, wobble(base, 0, -1)]
        walk = [wobble(base, d, 0 if i % 2 else -1) for i, d in enumerate([0, 1, 2, 1, 0, -1])]
        attack = [wobble(base, min(i, 2), 0) for i in range(4)]
        hurt = [wobble(base, -1, 0), wobble(base, -2, 1), wobble(base, -1, 0)]
        death = []
        for i in range(6):
            fr = base.copy()
            fr.putalpha(max(40, 255 - i * 40))
            death.append(wobble(fr, i, i // 2))
        sheet_from_frames(idle, 40, 32).save(folder / "idle.png")
        sheet_from_frames(walk, 40, 32).save(folder / "walk.png")
        sheet_from_frames(attack, 40, 32).save(folder / "attack.png")
        sheet_from_frames(hurt, 40, 32).save(folder / "hurt.png")
        sheet_from_frames(death, 40, 32).save(folder / "death.png")
    print("enemies from ref ok")


if __name__ == "__main__":
    make_player()
    make_enemies()
    print("done")
