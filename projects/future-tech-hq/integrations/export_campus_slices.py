"""把園區版本（HQ_VARIANT=tower800 或 tower500）切成 10 個樓層切片，匯出給園區頁面使用的 glTF JSON。

用法（在 projects/future-tech-hq 底下）：
  HQ_VARIANT=tower800 python integrations/export_campus_slices.py <輸出資料夾>

輸出（每個檔案 < 16 MB，可直接當 artifact 的 .json 檔發布）：
  future-hq-{tag}-a.gltf.json  1F–5F 切片（物件名稱 F00__… ~ F04__…）
  future-hq-{tag}-b.gltf.json  6F–10F 切片（F05__… ~ F09__…）
  future-hq-{tag}-c.gltf.json  屋頂冠部、通訊尖塔、基座（原名）

切片規則：第 k 層 = 高度 [k·FH − 0.4, (k+1)·FH − 0.4]，樓板跟著它上方的樓層；
外骨骼切開處自動封面，樓層滑出時看不到空心斷面。
"""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "src"))
os.environ.setdefault("HQ_VARIANT", "tower800")

import bpy  # noqa: E402
import bmesh  # noqa: E402  (需在 bpy 之後匯入)

import build_model  # noqa: E402
import config as C  # noqa: E402

TAG = C.VARIANT.replace("tower", "")   # 500 / 800

SLICE_COLS = ("A_Main_Building", "B_Exoskeleton")
OTHER_COLS = ("C1_Roof_Crown", "C2_Spire", "D_Base")
FILL = ("Exo_",)  # 封面：外骨骼、支撐、節點


def apply_modifiers(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def slice_object(ob, z0, z1, name, fill):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for co, no, key in ((z0, (0, 0, 1), "clear_inner"), (z1, (0, 0, 1), "clear_outer")):
        if abs(co) > 1e8:
            continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, co), plane_no=no, dist=1e-5, **{key: True})
    if not bm.faces:
        bm.free()
        return None
    if fill:
        bnd = [e for e in bm.edges if e.is_boundary]
        if bnd:
            bmesh.ops.holes_fill(bm, edges=bnd, sides=0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(ob.data.materials[0])
    nob = bpy.data.objects.new(name, me)
    bpy.data.collections["SLICES"].objects.link(nob)
    return nob


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    tmp = path + ".tmp.gltf"
    bpy.ops.export_scene.gltf(filepath=tmp, export_format="GLTF_SEPARATE", use_selection=True,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
    g = json.load(open(tmp))
    d = os.path.dirname(tmp)
    for b in g["buffers"]:
        f = os.path.join(d, b["uri"])
        b["uri"] = "data:application/octet-stream;base64," + base64.b64encode(open(f, "rb").read()).decode()
        os.remove(f)
    os.remove(tmp)
    json.dump(g, open(path, "w"), separators=(",", ":"))
    print(f"[export] {os.path.basename(path)}  {len(objs)} objects  {os.path.getsize(path)/1e6:.1f} MB")


def main(out):
    os.makedirs(out, exist_ok=True)
    build_model.build()
    col = bpy.data.collections.new("SLICES")
    bpy.context.scene.collection.children.link(col)
    FH = C.FLOOR_H
    bounds = [-1e9] + [k * FH - 0.4 for k in range(1, C.FLOORS)] + [1e9]
    floors = {i: [] for i in range(C.FLOORS)}
    for cname in SLICE_COLS:
        for ob in list(bpy.data.collections[cname].objects):
            apply_modifiers(ob)
            fill = ob.name.startswith(FILL)
            for i in range(C.FLOORS):
                s = slice_object(ob, bounds[i], bounds[i + 1], f"F{i:02d}__{ob.name}", fill)
                if s:
                    floors[i].append(s)
            bpy.data.objects.remove(ob, do_unlink=True)
    others = [o for c in OTHER_COLS for o in bpy.data.collections[c].objects if o.name != "Base_Site_Paving"]
    half = C.FLOORS // 2
    export([o for i in range(half) for o in floors[i]], os.path.join(out, f"future-hq-{TAG}-a.gltf.json"))
    export([o for i in range(half, C.FLOORS) for o in floors[i]], os.path.join(out, f"future-hq-{TAG}-b.gltf.json"))
    export(others, os.path.join(out, f"future-hq-{TAG}-c.gltf.json"))


if __name__ == "__main__":
    main(sys.argv[-1])
