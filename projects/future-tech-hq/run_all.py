"""FUTURE TECHNOLOGY HEADQUARTERS — 一鍵管線。

兩種執行方式皆可：
  python run_all.py [選項]                       # 使用 pip 安裝的 bpy 模組（Blender 5.3）
  blender -b -P run_all.py -- [選項]             # 使用完整版 Blender

選項：
  --stage build,validate,save,export,render     （預設全部）
  --samples 256 --res 1600x2000                  渲染品質
  --preview                                      快速預覽（低解析度、低取樣）
  --views 01_front,08_low_angle                  只渲染指定視角
"""
import argparse
import os
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))

import bpy  # noqa: E402

import build_model  # noqa: E402
import scene_setup  # noqa: E402


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="build,validate,save,export,render")
    ap.add_argument("--samples", type=int, default=256)
    ap.add_argument("--res", default="1600x2000")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--views", default="")
    ap.add_argument("--out", default=os.path.join(ROOT, "renders"))
    return ap.parse_args(argv)


def main():
    a = parse()
    stages = set(a.stage.split(","))
    res = tuple(int(x) for x in a.res.lower().split("x"))
    if a.preview:
        res, a.samples = (res[0] // 4, res[1] // 4), min(a.samples, 24)
    t0 = time.time()
    build_model.build()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene_setup.setup_all(scene, a.samples, res, a.preview)
    if "validate" in stages:
        import validate
        validate.run(os.path.join(ROOT, "reports", "geometry_report.json"))
    if "save" in stages:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "future_tech_hq.blend"),
                                    compress=True)
    if "export" in stages:
        import export_glb
        export_glb.export_glb(os.path.join(ROOT, "model", "future_tech_hq.glb"))
    if "render" in stages:
        import render_views
        only = [v for v in a.views.split(",") if v] or None
        render_views.render_all(scene, a.out, only)
    print(f"[done] {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
