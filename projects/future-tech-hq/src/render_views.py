"""八角度渲染：同一個 3D 模型、同一組材質，只切換攝影機（主光與相機保持固定相對角度）。
渲染為透明底 16-bit PNG，再與乾淨的淺灰漸層背景合成，輸出 PNG 與 JPG。"""
import math
import os
import time

import bpy
import numpy as np
from PIL import Image

import scene_setup as S


def background(w, h):
    y = np.linspace(0, 1, h)[:, None]
    top = np.array([240, 242, 245], float)
    bot = np.array([222, 225, 229], float)
    g = top * (1 - y) + bot * y
    img = np.repeat(g[:, None, :], w, axis=1).reshape(h, w, 3)
    return Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")


def composite(raw_png, out_png, out_jpg):
    im = Image.open(raw_png)
    if im.mode != "RGBA":
        arr = np.asarray(im).astype(np.float32)
        if arr.max() > 255:
            arr = arr / 257.0
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA")
    # 輕度電影調色：提高建築本體對比與飽和（不影響背景）
    from PIL import ImageEnhance
    rgb, a = im.convert("RGB"), im.getchannel("A")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.14)
    rgb = ImageEnhance.Color(rgb).enhance(1.12)
    im = rgb.convert("RGBA")
    im.putalpha(a)
    bg = background(*im.size)
    out = Image.alpha_composite(bg, im).convert("RGB")
    out.save(out_png, optimize=True)
    out.save(out_jpg, quality=92, subsampling=0)


def render_all(scene, outdir, only=None):
    os.makedirs(os.path.join(outdir, "_raw"), exist_ok=True)
    results = []
    for view in S.VIEWS:
        name = view[0]
        if only and name not in only:
            continue
        cam = bpy.data.objects["CAM_" + name]
        scene.camera = cam
        S.setup_sun(scene, azimuth_deg=view[1] - 42.0, elevation_deg=46.0)
        raw = os.path.join(outdir, "_raw", name + "_rgba.png")
        scene.render.filepath = raw
        t = time.time()
        bpy.ops.render.render(write_still=True)
        composite(raw, os.path.join(outdir, name + ".png"), os.path.join(outdir, name + ".jpg"))
        dt = time.time() - t
        print(f"[render] {name}  {dt:.1f}s", flush=True)
        results.append((name, round(dt, 1)))
    return results
