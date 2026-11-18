"""幾何檢查：尺寸是否符合正式規格、樓層比例、螺旋外骨骼與建築/彼此的淨距、
金屬支撐是否穿插玻璃或其他螺旋（BVH 三角面相交測試）。輸出 JSON 報告。"""
import json
import math

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import config as C
from build_model import all_ribbons, ribbon_crossings


def world_verts(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ob.matrix_world
    v = np.array([(mw @ p.co)[:] for p in me.vertices])
    ev.to_mesh_clear()
    return v


def bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def coll_objects(name):
    return list(bpy.data.collections[name].objects)


def overlaps(obs_a, obs_b):
    n = 0
    for a in obs_a:
        ta = bvh(a)
        for b in obs_b:
            if a is b:
                continue
            n += len(ta.overlap(bvh(b)))
    return n


def run(report_path=None):
    R = {}
    allobs = [o for c in ("D_Base", "A_Main_Building", "B_Exoskeleton", "C1_Roof_Crown", "C2_Spire")
              for o in coll_objects(c)]
    zmax = max(world_verts(o)[:, 2].max() for o in allobs)
    body = [o for o in coll_objects("A_Main_Building")]
    body_top = max(world_verts(o)[:, 2].max() for o in body if o.name != "Main_Roof_Parapet")
    R["dimensions"] = {
        "total_height_m": round(float(zmax), 3),
        "body_roof_level_m": round(float(body_top), 3),
        "spire_height_above_roof_m": round(float(zmax - C.BODY_H), 3),
        "floors": C.FLOORS,
        "floor_height_m": C.FLOOR_H,
        "spec_ok": bool(abs(zmax - C.TOTAL_H) < 0.05 and abs(body_top - C.BODY_H) < 0.05),
    }
    th = np.linspace(0, 2 * math.pi, 2000, endpoint=False)
    def floor_area(z):
        a_, b_ = C.plan_axes(z)
        r = np.array([C.superellipse_r(t, a_, b_) for t in th])
        x, y = r * np.cos(th), r * np.sin(th)
        return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    R["dimensions"]["floor_area_ping_1F"] = round(floor_area(0.0) / C.PING, 1)
    R["dimensions"]["floor_area_ping_10F"] = round(floor_area((C.FLOORS - 1) * C.FLOOR_H) / C.PING, 1)
    v = world_verts(bpy.data.objects["Main_Floor_Slab_Edges"])
    R["dimensions"]["plan_width_x_m_at_ground"] = round(float(np.ptp(v[v[:, 2] < C.FLOOR_H + 1][:, 0])), 2)
    R["dimensions"]["plan_depth_y_m_at_ground"] = round(float(np.ptp(v[v[:, 2] < C.FLOOR_H + 1][:, 1])), 2)

    # 螺旋外骨骼與立面淨距（內側面到樓板外緣/結構柱）
    rib = all_ribbons()
    clear = []
    for name, r in rib.items():
        inner = r["off"] + r["split"] - C.RIB_THICK / 2
        clear.append(float(inner.min()))
    R["exoskeleton"] = {
        "ribbons": len(rib),
        "min_clearance_to_glass_m": round(min(clear), 3),
        "min_clearance_to_column_face_m": round(min(clear) - 0.78, 3),
        "crossings": len(ribbon_crossings(rib)),
    }
    # 螺旋與螺旋之間最近表面距離
    ribobs = [bpy.data.objects[n] for n in rib]
    pairs = {}
    for i, a in enumerate(ribobs):
        va = world_verts(a)
        for b in ribobs[i + 1:]:
            vb = world_verts(b)
            kd = KDTree(len(vb))
            for k, p in enumerate(vb):
                kd.insert(p, k)
            kd.balance()
            d = min(kd.find(p)[2] for p in va[::3])
            pairs[f"{a.name}~{b.name}"] = round(d, 3)
    R["exoskeleton"]["min_surface_gap_between_ribbons_m"] = pairs

    # 穿插檢查（三角面相交對數；0 = 無穿插）
    glass = [bpy.data.objects["Main_Glass_Curtain_Wall"], bpy.data.objects["Main_Glass_Lobby"]]
    struts = [bpy.data.objects["Exo_Metal_Struts"]]
    legs = [bpy.data.objects["Base_Diagonal_Legs"]]
    cols = [bpy.data.objects["Main_Structural_Columns"], bpy.data.objects["Main_Vertical_Mullions"]]
    R["intersections"] = {
        "ribbon_vs_ribbon": overlaps(ribobs, ribobs) // 2,
        "ribbon_vs_glass": overlaps(ribobs, glass),
        "ribbon_vs_columns_mullions": overlaps(ribobs, cols),
        "ribbon_vs_base_legs": overlaps(ribobs, legs),
        "struts_vs_glass": overlaps(struts, glass),
        "base_legs_vs_glass_lobby": overlaps(legs, glass[1:]),
    }
    R["intersections"]["clean"] = all(v == 0 for v in R["intersections"].values())

    stats = {"objects": len(allobs), "vertices": 0, "faces": 0}
    dg = bpy.context.evaluated_depsgraph_get()
    for o in allobs:
        me = o.evaluated_get(dg).to_mesh()
        stats["vertices"] += len(me.vertices)
        stats["faces"] += len(me.polygons)
        o.evaluated_get(dg).to_mesh_clear()
    R["mesh_stats"] = stats
    txt = json.dumps(R, indent=2, ensure_ascii=False)
    print("[validate]\n" + txt)
    if report_path:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(txt)
    return R
