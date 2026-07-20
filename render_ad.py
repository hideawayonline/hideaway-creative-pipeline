#!/usr/bin/env python3
"""
Hideaway ad-replicate renderer — deterministic "ugly ad" dupe template.
Composites a REAL product cutout (never AI-generated) with brand colours,
rounded brand-style font (Quicksand ~ Made Tommy Soft) and frozen copy.
Faithful to the THEIRS/OURS dupe-comparison structure. Reflows across sizes.
"""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont

PINK   = (252, 118, 196)   # Sunset Sorbet
YELLOW = (255, 237, 153)   # Golden Daze
TEAL   = (81, 209, 216)    # Azure Cove
CHAR   = (48, 48, 48)      # Moon Tide
SAND   = (244, 238, 237)   # Serene Sands (slightly lifted)
WHITE  = (255, 255, 255)

VF = "assets/fonts/Quicksand-VF.ttf"
def f(size, weight="Bold"):
    fnt = ImageFont.truetype(VF, size)
    try: fnt.set_variation_by_name(weight)
    except Exception: pass
    return fnt

SIZES = {"4x5": (1080,1350), "1x1": (1080,1080), "9x16": (1080,1920), "1.91x1": (1200,628)}

def ctext(d, cx, y, t, fnt, fill, anchor="ma"):
    d.text((cx, y), t, font=fnt, fill=fill, anchor=anchor)

def fit(d, t, fnt, mw):
    out=[]; cur=""
    for w in t.split():
        s=(cur+" "+w).strip()
        if d.textlength(s, font=fnt)<=mw: cur=s
        else: out.append(cur); cur=w
    if cur: out.append(cur)
    return out

def load_cutout(p):
    im = Image.open(p).convert("RGBA")
    return im.crop(im.getbbox())

def tick(d, x, y, sz, color, w=4):
    # draw a checkmark centred-left at (x,y)
    d.line([(x, y+sz*0.1), (x+sz*0.38, y+sz*0.5), (x+sz, y-sz*0.5)], fill=color, width=w, joint="curve")

def render(cfg, key, out):
    W,H = SIZES[key]; s = W/1080.0
    img = Image.new("RGBA",(W,H),SAND+(255,)); d = ImageDraw.Draw(img)

    head_b = int(264*s)            # bottom of headline band
    bar_h  = int(150*s)            # claim bar height
    check_h= int(100*s)            # checklist band height
    panel_top, panel_bot = head_b, H-bar_h-check_h
    seam = int(W*0.55)

    # THEIRS dark panel (right) for contrast; OURS stays light (left)
    d.rounded_rectangle([seam, panel_top, W+40, panel_bot], radius=int(40*s), fill=CHAR+(255,))
    # joyful burst behind OURS bottle
    br=int(W*0.34); bx,by=int(W*0.27),int((panel_top+panel_bot)/2)
    d.ellipse([bx-br,by-br,bx+br,by+br], fill=YELLOW+(255,))

    # headline
    hf=f(int(54*s),"Bold")
    lines=fit(d,cfg["headline"],hf,int(W*0.9))
    ty=int(48*s)
    for ln in lines:
        ctext(d,W//2,ty,ln,hf,CHAR); ty+=int(62*s)

    # OURS / THEIRS labels + big prices at the TOP (clear of bottle bodies)
    ctext(d,int(W*0.25),panel_top+int(14*s),"OURS",f(int(28*s),"Bold"),PINK)
    ctext(d,int(W*0.80),panel_top+int(14*s),"THEIRS",f(int(28*s),"Bold"),WHITE)
    pf=f(int(80*s),"Bold")
    ctext(d,int(W*0.25),panel_top+int(44*s),cfg["ours_price"],pf,PINK)
    ctext(d,int(W*0.25),panel_top+int(132*s),cfg["ours_name"],f(int(23*s),"SemiBold"),CHAR)
    ctext(d,int(W*0.80),panel_top+int(44*s),cfg["theirs_price"],pf,WHITE)
    ctext(d,int(W*0.80),panel_top+int(132*s),cfg["theirs_name"],f(int(20*s),"SemiBold"),(205,205,205))

    # product cutout (both real bottles) below the prices
    cut=load_cutout(cfg["cutout"]); top=panel_top+int(186*s)
    avail_h=panel_bot-top-int(14*s); tw=int(W*0.62)
    r=min(tw/cut.width, avail_h/cut.height); cut=cut.resize((int(cut.width*r),int(cut.height*r)),Image.LANCZOS)
    px=(W-cut.width)//2; py=panel_bot-cut.height
    img.paste(cut,(px,py),cut)

    # VS badge on the seam, vertically centred on the bottles
    vr=int(44*s); vy=top+(panel_bot-top)//2
    d.ellipse([seam-vr,vy-vr,seam+vr,vy+vr],fill=TEAL+(255,))
    ctext(d,seam,vy,"VS",f(int(32*s),"Bold"),WHITE,anchor="mm")

    # checklist band (manual ticks — font has no check glyph)
    cy=panel_bot+int(check_h*0.5)
    cf=f(int(26*s),"SemiBold"); items=cfg["checklist"]; gap=W//len(items)
    for i,it in enumerate(items):
        x=gap*i+int(28*s)
        tick(d,x,cy,int(20*s),TEAL,w=int(5*s) or 3)
        d.text((x+int(30*s),cy),it,font=cf,fill=CHAR,anchor="lm")

    # bottom claim bar
    d.rectangle([0,H-bar_h,W,H],fill=CHAR+(255,))
    ctext(d,W//2,H-bar_h+int(26*s),cfg["claim"],f(int(44*s),"Bold"),WHITE)
    ctext(d,W//2,H-bar_h+int(86*s),cfg["proof"],f(int(23*s),"Medium"),YELLOW)

    os.makedirs(os.path.dirname(out),exist_ok=True)
    img.convert("RGB").save(out,"PNG")
    print("wrote",out,SIZES[key])

if __name__=="__main__":
    cfg=json.load(open(sys.argv[1])); key=sys.argv[2] if len(sys.argv)>2 else "4x5"
    out=sys.argv[3] if len(sys.argv)>3 else f"renders/{key}.png"
    render(cfg,key,out)
