# -*- coding: utf-8 -*-
import numpy as np
from PIL import Image

DL = r"C:\Users\Administrator\Downloads"
OUT = r"E:\李尚清\游戏大陆\assets\ui"
CW, CH = 1672, 941  # 画布

BASE = DL + r"\ChatGPT Image 2026年6月7日 16_46_28.png"
SRC = {
    "farm":     DL + r"\ChatGPT Image 2026年6月7日 16_40_05.png",
    "harbor":   DL + r"\ChatGPT Image 2026年6月7日 16_49_22.png",
    "town":     DL + r"\ChatGPT Image 2026年6月7日 16_52_36 (1).png",
    "mountain": DL + r"\ChatGPT Image 2026年6月7日 16_52_37 (2).png",
    "forest":   DL + r"\ChatGPT Image 2026年6月7日 16_52_37 (3).png",
}

# 摆放参数：w=宽度占画布比例, cx=中心X比例, by=底部Y比例(脚踩地面)
PLACE = {
    "mountain": dict(w=0.42, cx=0.70, by=0.56),
    "forest":   dict(w=0.30, cx=0.17, by=0.60),
    "town":     dict(w=0.32, cx=0.80, by=0.82),
    "farm":     dict(w=0.27, cx=0.49, by=0.84),
    "harbor":   dict(w=0.24, cx=0.13, by=0.93),
}
ORDER = ["mountain", "forest", "town", "farm", "harbor"]  # 后画的在前面

def key_magenta(path):
    im = Image.open(path).convert("RGB")
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 120) & (b > 110) & (g < 120) & (r - g > 70) & (b - g > 50)
    alpha = np.where(mag, 0, 255).astype(np.uint8)
    rgb = np.array(im).astype(int)
    spill = (~mag) & (r > g + 20) & (b > g + 20)
    rgb[..., 0] = np.where(spill, np.minimum(r, g + 25), r)
    rgb[..., 2] = np.where(spill, np.minimum(b, g + 25), b)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    img = Image.fromarray(out, "RGBA")
    ys, xs = np.where(alpha > 40)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

# 底图：中心裁成 16:9 再缩放
b = Image.open(BASE).convert("RGB")
bw, bh = b.size
tar = CW / CH
if bw / bh > tar:
    nw = int(bh * tar); b = b.crop(((bw - nw) // 2, 0, (bw - nw) // 2 + nw, bh))
else:
    nh = int(bw / tar); b = b.crop((0, (bh - nh) // 2, bw, (bh - nh) // 2 + nh))
b = b.resize((CW, CH), Image.LANCZOS)
b.save(OUT + r"\continent_base.png")
print("base saved", b.size)

# 各建筑：抠图→缩放→放到整画布透明层
for key in ORDER:
    sp = key_magenta(SRC[key])
    p = PLACE[key]
    tw = int(CW * p["w"]); th = int(sp.height * tw / sp.width)
    sp = sp.resize((tw, th), Image.LANCZOS)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = int(CW * p["cx"] - tw / 2)
    y = int(CH * p["by"] - th)
    canvas.alpha_composite(sp, (x, y))
    canvas.save(OUT + ("\\layer_%s.png" % key))
    print("%-9s placed at (%d,%d) size %dx%d" % (key, x, y, tw, th))

# 合成预览
comp = Image.open(OUT + r"\continent_base.png").convert("RGBA")
for key in ORDER:
    comp.alpha_composite(Image.open(OUT + ("\\layer_%s.png" % key)))
comp.convert("RGB").save(r"E:\李尚清\游戏大陆\_compose_preview.jpg", quality=84)
print("preview saved")
