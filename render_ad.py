#!/usr/bin/env python3
"""
Hideaway ad-replicate renderer — deterministic "ugly ad" dupe template.

Composites a REAL product cutout (never AI-generated) with brand-accurate
colours, fonts and copy. Reflows the same content across ad sizes.
"""
import sys, json
from PIL import Image, ImageDraw, ImageFont

# ---- Brand ----
PINK   = (252, 118, 196)   # Sunset Sorbet
YELLOW = (255, 237, 153)   # Golden Daze
TEAL   = (81, 209, 216)    # Azure Cove
CHAR   = (48, 48, 48)      # Moon Tide
SAND   = (238, 231, 230)   # Serene Sands
WHITE  = (255, 255, 255)

FONTS = "assets/fonts"
def f(weight, size): return ImageFont.truetype(f"{FONTS}/Poppins-{weight}.ttf", size)

SIZES = {
    "4x5":    (1080, 1350),
    "1x1":    (1080, 1080),
    "9x16":   (1080, 1920),
    "1.91x1": (1200, 628),
}

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def text_center(draw, cx, y, txt, font, fill, anchor="ma"):
    draw.text((cx, y), txt, font=font, fill=fill, anchor=anchor)

def fit_lines(draw, txt, font, max_w):
    words = txt.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if draw.textlength(t, font=font) <= max_w: cur=t
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines

def load_cutout(path):
    im = Image.open(path).convert("RGBA")
    return im.crop(im.getbbox())

def render(cfg, size_key, out_path):
    W, H = SIZES[size_key]
    s = W / 1080.0  # scale factor from 4x5 baseline
    img = Image.new("RGBA", (W, H), SAND + (255,))
    d = ImageDraw.Draw(img)

    # joyful colour burst behind product
    burst_r = int(W*0.46)
    cx, cy = W//2, int(H*0.46)
    d.ellipse([cx-burst_r, cy-int(burst_r*0.9), cx+burst_r, cy+int(burst_r*0.9)],
              fill=YELLOW + (255,))

    # headline
    hl_font = f("ExtraBold", int(60*s))
    lines = fit_lines(d, cfg["headline"], hl_font, int(W*0.86))
    y = int(54*s)
    for ln in lines:
        text_center(d, W//2, y, ln, hl_font, CHAR); y += int(66*s)

    # product cutout
    cut = load_cutout(cfg["cutout"])
    target_w = int(W*0.74)
    ratio = target_w / cut.width
    cut = cut.resize((target_w, int(cut.height*ratio)), Image.LANCZOS)
    px = (W - cut.width)//2
    py = int(H*0.30)
    img.paste(cut, (px, py), cut)

    # bottle x-anchors within the cutout (Hideaway ~0.27, designer ~0.77)
    ours_x  = px + int(cut.width*0.22)
    theirs_x = px + int(cut.width*0.82)
    tag_y = py - int(56*s)  # sit in the burst, just above the bottles

    # THEIRS price tag (designer, right)
    big = f("ExtraBold", int(70*s)); sm = f("SemiBold", int(20*s))
    text_center(d, theirs_x, tag_y, "THEIRS", f("Bold", int(26*s)), CHAR)
    text_center(d, theirs_x, tag_y+int(30*s), cfg["theirs_price"], big, CHAR)
    text_center(d, theirs_x, tag_y+int(104*s), cfg["theirs_name"], sm, CHAR)

    # OURS price tag (Hideaway, left)
    text_center(d, ours_x, tag_y, "OURS", f("Bold", int(26*s)), PINK)
    text_center(d, ours_x, tag_y+int(30*s), cfg["ours_price"], big, PINK)
    text_center(d, ours_x, tag_y+int(104*s), cfg["ours_name"], sm, CHAR)

    # VS badge
    vr = int(46*s)
    d.ellipse([cx-vr, cy-vr, cx+vr, cy+vr], fill=TEAL+(255,))
    text_center(d, cx, cy, "VS", f("ExtraBold", int(34*s)), WHITE, anchor="mm")

    # bottom claim bar
    bar_h = int(180*s)
    d.rectangle([0, H-bar_h, W, H], fill=CHAR+(255,))
    text_center(d, W//2, H-bar_h+int(34*s), cfg["claim"], f("Bold", int(40*s)), WHITE)
    text_center(d, W//2, H-bar_h+int(96*s), cfg["proof"], f("Medium", int(24*s)), YELLOW)
    text_center(d, W//2, H-int(34*s), "hideaway.", f("ExtraBold", int(30*s)), PINK, anchor="ms")

    img.convert("RGB").save(out_path, "PNG", quality=95)
    print("wrote", out_path, SIZES[size_key])

if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1]))
    size_key = sys.argv[2] if len(sys.argv) > 2 else "4x5"
    out = sys.argv[3] if len(sys.argv) > 3 else f"renders/{size_key}.png"
    import os; os.makedirs(os.path.dirname(out), exist_ok=True)
    render(cfg, size_key, out)
