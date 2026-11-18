"""Blender 自動建模：FUTURE TECHNOLOGY HEADQUARTERS。

組件（皆為獨立、可編輯的 3D 網格物件，依 Collection 分類）：
  A. Main_Building : 十層樓板、樓板金屬收邊、結構柱、玻璃帷幕（實體厚度）、垂直窗框、水平遮陽/橫框、核心筒、屋頂
  B. Exoskeleton   : 4 條白色螺旋外骨骼（實際截面）、邊緣金屬飾條、徑向/斜向金屬支撐、球形節點、交錯連接夾具、屋頂冠環
  C. Spire         : 68 m 通訊尖塔（底座框架、桁架主桿、斜撐、多層環形平台與天線板、中心垂直支柱、頂端設備與避雷針）
  D. Base          : 基地鋪面、圓形基座、金屬收邊與裝飾葉片、斜向落地支撐腳、玻璃入口門廳與雨遮
"""
import math
import numpy as np
import bpy

from config import *  # noqa: F401,F403
import config as C
from meshkit import MeshBuilder, circle, rounded_rect_profile, TAU, _unit
import materials as MAT

NU = 192  # 平面輪廓取樣數


# ================================================================ helpers
def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def outline(z, extra=0.0, n=NU, a=None, b=None):
    """主體在高度 z 的逆時針平面輪廓（向外偏移 extra，沿徑向）。"""
    th = np.linspace(0, TAU, n, endpoint=False)
    if a is None:
        a, b = C.plan_axes(z)
    r = np.array([C.superellipse_r(t, a, b) for t in th]) + extra
    return np.stack([r * np.cos(th), r * np.sin(th), np.full(n, z)], 1)


def facade_point(theta, z, extra=0.0):
    r = C.facade_r(theta, min(max(z, 0.0), C.BODY_H)) + extra
    return np.array([r * math.cos(theta), r * math.sin(theta), z])


def facade_normal(theta, z):
    """超橢圓面的水平外向法線（數值微分）。"""
    e = 1e-3
    p0 = facade_point(theta - e, z)
    p1 = facade_point(theta + e, z)
    t = _unit(p1 - p0)
    return _unit(np.cross(t, [0, 0, 1.0]))


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def seg_point_dist(a, b, pts):
    """線段 ab 到點群的最短距離。"""
    a, b = np.asarray(a, float), np.asarray(b, float)
    ab = b - a
    t = np.clip(((pts - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    proj = a + t[:, None] * ab
    return np.linalg.norm(pts - proj, axis=1).min()


# ================================================================ exoskeleton math
def ribbon_frame(theta0_deg, direction, n=C.RIB_SAMPLES):
    """螺旋外骨骼中心線與掃掠座標框架。回傳 dict(P,N,B,T,t,theta,z,off)。"""
    t = np.linspace(0.0, 1.0, n)
    z = C.RIB_Z0 + (C.RIB_Z1 - C.RIB_Z0) * t
    th = math.radians(theta0_deg) + direction * C.RIB_TURNS * TAU * t
    off = (C.RIB_OFF_TOP + C.RIB_OFF_BASE * (1 - t) ** 2
           + C.RIB_BULGE * np.sin(math.pi * t ** 0.8))
    w = C.RIB_TAPER_W
    taper = 0.2 + 0.8 * smoothstep((t - w / 3) / w) * smoothstep((1 - w / 3 - t) / w)
    split = direction * C.RIB_SPLIT * taper
    R = np.array([C.facade_r(a, min(zz, C.BODY_H)) for a, zz in zip(th, z)])
    rr = R + off + split
    P = np.stack([rr * np.cos(th), rr * np.sin(th), z], 1)
    T = _unit(np.gradient(P, axis=0))
    rad = np.stack([np.cos(th), np.sin(th), np.zeros(n)], 1)
    N = _unit(rad - (np.sum(rad * T, 1))[:, None] * T)
    B = np.cross(T, N)
    return dict(P=P, N=N, B=B, T=T, t=t, theta=th, z=z, off=off, split=split, R=R)


def all_ribbons():
    return {name: ribbon_frame(th0, d) | {"dir": d} for name, th0, d in C.RIBBONS}


def ribbon_crossings(rib):
    """找出順/逆時針螺旋在同一 (θ, z) 交會的位置。"""
    out = []
    names = list(rib)
    for i, na in enumerate(names):
        for nb in names[i + 1:]:
            A, B = rib[na], rib[nb]
            if A["dir"] == B["dir"]:
                continue
            d = (A["theta"] - B["theta"] + math.pi) % TAU - math.pi
            for k in range(len(d) - 1):
                if d[k] == 0 or (d[k] * d[k + 1] < 0 and abs(d[k] - d[k + 1]) < 1.0):
                    f = d[k] / (d[k] - d[k + 1]) if d[k] != d[k + 1] else 0
                    out.append((na, nb, k, f))
    return out


# ================================================================ D. base
def build_base(col):
    M = MAT
    # 基地方形鋪面（圓角）
    site = MeshBuilder("Base_Site_Paving")
    sq = rounded_rect_profile(2 * C.SITE_HALF, 2 * C.SITE_HALF, n=8, seg=128)
    site.prism(sq, 0.0, 0.25)
    site.to_object(M.get("paving"), col)

    # 圓形基座（兩階）
    pod = MeshBuilder("Base_Podium")
    pod.prism(circle(C.PODIUM_R, 160), 0.25, 0.70, smooth_sides=True)
    pod.prism(circle(C.PODIUM_STEP_R, 160), 0.70, C.PODIUM_TOP, smooth_sides=True)
    pod.to_object(M.get("stone"), col)

    # 金屬收邊環＋裝飾葉片
    trim = MeshBuilder("Base_Metal_Trim")
    trim.ring_prism(circle(C.PODIUM_R + 0.12, 160), circle(C.PODIUM_R - 0.05, 160), 0.22, 0.74)
    trim.ring_prism(circle(C.PODIUM_STEP_R + 0.08, 160), circle(C.PODIUM_STEP_R - 0.05, 160), 0.68, C.PODIUM_TOP + 0.04)
    for i in range(96):
        a = TAU * i / 96
        if abs(((a + math.pi / 2 + math.pi) % TAU) - math.pi) < 0.32:  # 正面入口留空
            continue
        p = np.array([math.cos(a), math.sin(a), 0])
        tng = np.array([-math.sin(a), math.cos(a), 0])
        c = p * (C.PODIUM_R - 0.9) + [0, 0, 0.70 + 0.35]
        trim.box(c, p, tng, (0, 0, 1), 0.9, 0.06, 0.7)
    trim.ring_prism(circle(C.PODIUM_R - 0.3, 160), circle(C.PODIUM_R - 1.5, 160), 1.38, 1.46)
    trim.to_object(M.get("metal"), col)

    # 玻璃入口門廳（正面 -Y）
    yf = -C.facade_r(-math.pi / 2, 1.0)
    vest = MeshBuilder("Base_Entrance_Glass")
    vest.abox((0, yf - 2.0, C.PODIUM_TOP + 2.0), (9.0, 4.2, 4.0))
    vest.to_object(M.get("glass_lobby"), col)
    fr = MeshBuilder("Base_Entrance_Frame")
    for x in np.linspace(-4.5, 4.5, 7):
        fr.abox((x, yf - 4.1, C.PODIUM_TOP + 2.0), (0.12, 0.12, 4.0))
    for x in (-4.5, 4.5):
        fr.abox((x, yf - 2.0, C.PODIUM_TOP + 2.0), (0.12, 4.2, 0.12 + 3.88))
    fr.abox((0, yf - 2.0, C.PODIUM_TOP + 4.05), (9.2, 4.4, 0.18))
    # 入口雨遮與細柱
    fr.abox((0, yf - 4.6, C.PODIUM_TOP + 5.6), (15.0, 9.2, 0.32))
    for x in (-6.8, 6.8):
        fr.tube((x, yf - 8.6, C.PODIUM_TOP), (x, yf - 8.6, C.PODIUM_TOP + 5.45), 0.16, seg=16)
    fr.abox((0, yf - 9.15, C.PODIUM_TOP + 5.6), (15.2, 0.12, 0.5))
    # 旋轉門
    fr.tube((0, yf - 4.1, C.PODIUM_TOP), (0, yf - 4.1, C.PODIUM_TOP + 3.0), 1.3, seg=32, smooth=True)
    fr.to_object(M.get("metal"), col)
    door = MeshBuilder("Base_Entrance_Door_Glass")
    door.tube((0, yf - 4.1, C.PODIUM_TOP + 3.0), (0, yf - 4.1, C.PODIUM_TOP + 3.2), 1.35, seg=32)
    door.to_object(M.get("dark_metal"), col)


def build_base_legs(col, rib):
    """斜向落地支撐腳：自動挑選不與螺旋外骨骼干涉的角度。"""
    pts = np.vstack([r["P"] for r in rib.values()])
    legs = MeshBuilder("Base_Diagonal_Legs")
    nodes = MeshBuilder("Base_Leg_Nodes")
    chosen = []
    for i in range(32):
        a = TAU * (i + 0.5) / 32
        if abs(((a + math.pi / 2 + math.pi) % TAU) - math.pi) < 0.45:
            continue  # 正面入口
        foot = np.array([math.cos(a), math.sin(a), 0]) * (C.PODIUM_STEP_R - 1.2) + [0, 0, C.PODIUM_TOP]
        top = facade_point(a, C.LEG_TOP_Z, C.SLAB_EDGE)
        if seg_point_dist(foot, top, pts) < C.RIB_WIDTH / 2 + 0.9:
            continue
        if any(abs(((a - b + math.pi) % TAU) - math.pi) < TAU / 13 for b in chosen):
            continue
        chosen.append(a)
        legs.tube(foot, top, 0.42, 0.30, seg=20)
        # 第二支輔助斜撐（A 字形）
        top2 = facade_point(a, C.LEG_MID_Z, C.SLAB_EDGE if C.LEG_MID_Z % C.FLOOR_H < 1e-6 else 0.32)
        mid = foot + 0.45 * (top - foot)
        legs.tube(mid, top2, 0.18, seg=12)
        nodes.sphere(top, 0.55)
        nodes.sphere(mid, 0.3)
        nodes.box(foot + [0, 0, 0.25], np.array([math.cos(a), math.sin(a), 0]),
                  np.array([-math.sin(a), math.cos(a), 0]), (0, 0, 1), 1.6, 1.2, 0.5)
    legs.to_object(MAT.get("titanium"), col)
    nodes.to_object(MAT.get("metal"), col)
    return chosen


# ================================================================ A. main building
def louver_levels():
    """樓層中段水平遮陽板高度：每層 n 等分（5 m 樓層 → 中段 1 道；21.2 m 樓層 → 每 3.5 m 1 道）。"""
    n = max(2, 2 * round(C.FLOOR_H / 8.4))
    k0 = 0 if C.VARIANT == "tower500" else 1
    return [k * C.FLOOR_H + j * C.FLOOR_H / n for k in range(k0, C.FLOORS) for j in range(1, n)]


def strut_levels():
    """外骨骼支撐的落點：(高度, 距玻璃面)。每層樓板；樓層很高時加上樓層中段遮陽板。"""
    lv = [(k * C.FLOOR_H, C.SLAB_EDGE) for k in range(1, C.FLOORS)]
    if C.FLOOR_H > 8:
        lv += [(k * C.FLOOR_H + C.FLOOR_H / 2, 0.32) for k in range(0, C.FLOORS)]
    return sorted(lv)

def fin_thetas(n):
    th = np.linspace(0, TAU, 4000, endpoint=False)
    P = np.array([facade_point(t, 25.0) for t in th])
    seg = np.linalg.norm(np.roll(P, -1, 0) - P, axis=1)
    s = np.concatenate([[0], np.cumsum(seg)[:-1]])
    targets = np.linspace(0, seg.sum(), n, endpoint=False) + seg.sum() / (2 * n)
    return np.interp(targets, s, th)


def build_main(col):
    z0 = C.PODIUM_TOP
    # 樓板：內部混凝土＋金屬收邊環
    slabs = MeshBuilder("Main_Floor_Slabs_Interior")
    edges = MeshBuilder("Main_Floor_Slab_Edges")
    for k in range(1, C.FLOORS + 1):
        z = k * C.FLOOR_H
        top = z if k == C.FLOORS else z + 0.25
        bot = z - (0.6 if k == C.FLOORS else C.SLAB_T - 0.25)
        slabs.prism(outline(z, -0.2), bot + 0.05, top - 0.05)
        edges.ring_prism(outline(z, C.SLAB_EDGE), outline(z, -0.25), bot, top)
    slabs.to_object(MAT.get("interior_ceiling"), col)
    edges.to_object(MAT.get("metal"), col)

    # 玻璃帷幕（實體厚度 6 cm）：大廳層透明、2–10F 藍灰
    rows = [outline(z, 0.0) for z in np.linspace(C.FLOOR_H, C.BODY_H, max(46, int(C.BODY_H / 1.1)))]
    g = MeshBuilder("Main_Glass_Curtain_Wall")
    g.grid_surface(np.array(rows))
    g.to_object(MAT.get("glass"), col, solidify=0.06)
    rows = [outline(z, 0.0) for z in np.linspace(z0, C.FLOOR_H, 5)]
    g = MeshBuilder("Main_Glass_Lobby")
    g.grid_surface(np.array(rows))
    g.to_object(MAT.get("glass_lobby"), col, solidify=0.05)

    # 垂直金屬窗框＋結構柱
    fins = MeshBuilder("Main_Vertical_Mullions")
    cols_ = MeshBuilder("Main_Structural_Columns")
    for i, th in enumerate(fin_thetas(C.N_FINS)):
        n0, n1 = facade_normal(th, z0), facade_normal(th, C.BODY_H)
        if i % C.COLUMN_EVERY == 0:
            p0 = facade_point(th, z0) + n0 * 0.3
            p1 = facade_point(th, C.BODY_H) + n1 * 0.3
            cols_.box_between(p0, p1, 0.95, 0.55, (n0 + n1) / 2)
        else:
            p0 = facade_point(th, z0) + n0 * (C.FIN_DEPTH / 2 - 0.03)
            p1 = facade_point(th, C.BODY_H) + n1 * (C.FIN_DEPTH / 2 - 0.03)
            fins.box_between(p0, p1, C.FIN_DEPTH, 0.11, (n0 + n1) / 2)
    fins.to_object(MAT.get("titanium"), col)
    cols_.to_object(MAT.get("titanium"), col)

    # 水平分隔：樓層中段遮陽板＋玻璃橫框
    hz = MeshBuilder("Main_Horizontal_Louvers")
    for z in louver_levels():
        hz.ring_prism(outline(z, 0.32), outline(z, 0.02), z - 0.04, z + 0.04)
    hz.to_object(MAT.get("metal"), col)

    # 核心筒（玻璃後可見的室內量體）
    core = MeshBuilder("Main_Core")
    co = outline(0, 0, 96, a=5.8, b=4.2)[:, :2]
    core.prism(co, z0, C.BODY_H - 0.6, smooth_sides=True)
    core.to_object(MAT.get("concrete"), col)

    # 屋頂：女兒牆
    roof = MeshBuilder("Main_Roof_Parapet")
    roof.ring_prism(outline(C.BODY_H, 0.30), outline(C.BODY_H, 0.0), C.BODY_H, C.BODY_H + 1.2)
    roof.to_object(MAT.get("metal"), col)


# ================================================================ B. exoskeleton
def build_exoskeleton(col, rib):
    prof = rounded_rect_profile(C.RIB_THICK, C.RIB_WIDTH, n=5.0, seg=32)
    trim_prof = []
    for side in (-1, 1):
        cc = np.array([C.RIB_THICK / 2 - 0.02, side * (C.RIB_WIDTH / 2 - 0.25)])
        a = np.linspace(0, TAU, 10, endpoint=False)
        trim_prof.append(cc + 0.075 * np.stack([np.cos(a), np.sin(a)], 1))
    trims = MeshBuilder("Exo_Ribbon_Edge_Trims")
    for name, r in rib.items():
        m = MeshBuilder(name)
        m.sweep(r["P"], r["N"], r["B"], prof)
        m.to_object(MAT.get("white_ceramic"), col)
        for tp in trim_prof:
            sl = slice(6, -6)
            trims.sweep(r["P"][sl], r["N"][sl], r["B"][sl], tp)
    trims.to_object(MAT.get("metal"), col)

    # 屋頂冠環（螺旋終點收束處）
    crown = MeshBuilder("Exo_Crown_Ring")
    loop = outline(C.BODY_H, C.RIB_OFF_TOP, 240)
    loop[:, 2] = C.RIB_Z1
    crown.ring_sweep(loop, rounded_rect_profile(0.85, 2.1, n=5, seg=28))
    crown.to_object(MAT.get("white_ceramic"), col)

    struts = MeshBuilder("Exo_Metal_Struts")
    nodes = MeshBuilder("Exo_Connection_Nodes")
    clamps = MeshBuilder("Exo_Crossing_Clamps")
    allpts = {n: r["P"] for n, r in rib.items()}
    kept = skipped = 0
    for name, r in rib.items():
        others = np.vstack([p for n, p in allpts.items() if n != name])
        lv = strut_levels()
        for li, (zf, ext) in enumerate(lv):
            i = int(np.argmin(np.abs(r["z"] - zf)))
            P, N, th = r["P"][i], r["N"][i], r["theta"][i]
            inner = P - N * (C.RIB_THICK / 2)
            target = facade_point(th, zf, ext)
            cand = [(inner, target, 0.17)]
            if li >= 1:
                th2 = th - r["dir"] * 0.13
                cand.append((inner, facade_point(th2, lv[li - 1][0], lv[li - 1][1]), 0.12))
            for a, b, rad in cand:
                if seg_point_dist(a, b, others) < C.RIB_WIDTH / 2 + 0.45:
                    skipped += 1
                    continue
                struts.tube(a, b, rad, seg=14)
                nodes.sphere(b, rad * 2.1, seg=12, rings=8)
                kept += 1
            nodes.sphere(inner, 0.34, seg=14, rings=8)
            nodes.box(inner + N * 0.05, N, r["B"][i], np.cross(N, r["B"][i]), 0.12, 1.2, 1.2)
        # 冠環連接梁
    for a in np.linspace(0, TAU, 24, endpoint=False):
        p0 = facade_point(a, C.RIB_Z1 - 0.3, 0.25)
        p0[:2] = facade_point(a, C.BODY_H, 0.25)[:2]
        p1 = facade_point(a, C.BODY_H, C.RIB_OFF_TOP - 0.42)
        p1[2] = p0[2]
        struts.box_between(p0, p1, 0.35, 0.5, (0, 0, 1))

    # 交錯夾具：外層與內層螺旋交會處的鈦金屬連接
    for na, nb, k, f in ribbon_crossings(rib):
        A, B = rib[na], rib[nb]
        pa = A["P"][k] + f * (A["P"][k + 1] - A["P"][k])
        pb = B["P"][k] + f * (B["P"][k + 1] - B["P"][k])
        outer, inner = (A, B) if np.linalg.norm(pa[:2]) > np.linalg.norm(pb[:2]) else (B, A)
        po, pi_ = (pa, pb) if outer is A else (pb, pa)
        no, ni = outer["N"][k], inner["N"][k]
        a_ = pi_ + ni * C.RIB_THICK / 2
        b_ = po - no * C.RIB_THICK / 2
        clamps.tube(a_ - ni * 0.1, b_ + no * 0.1, 0.42, seg=20)
        clamps.tube(a_, a_ + ni * 0.12, 0.75, seg=24)
        clamps.tube(b_ - no * 0.12, b_, 0.75, seg=24)
        # 交錯點延伸到建築的拉桿
        zf = round(po[2] / C.FLOOR_H) * C.FLOOR_H
        if C.FLOOR_H <= zf <= C.BODY_H - C.FLOOR_H:
            th = math.atan2(po[1], po[0])
            t_ = facade_point(th, zf, C.SLAB_EDGE)
            s0 = pi_ - ni * C.RIB_THICK / 2
            struts.tube(s0, t_, 0.2, seg=14)
            nodes.sphere(t_, 0.4)
            nodes.sphere(s0, 0.36)
    # 螺旋底部固定座
    for r in rib.values():
        P, N, T = r["P"][0], r["N"][0], r["T"][0]
        clamps.box(P + [0, 0, 0.25], N, np.cross([0, 0, 1], N), (0, 0, 1), 1.6, 3.2, 0.9)
    struts.to_object(MAT.get("metal"), col)
    nodes.to_object(MAT.get("titanium"), col)
    clamps.to_object(MAT.get("titanium"), col)
    return kept, skipped


# ================================================================ C. roof crown + spire
def square_corners(hw, z):
    return [np.array([sx * hw, sy * hw, z]) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]


def lattice(legs, braces, z0, hw0, z1, hw1, nsec, leg_r0, leg_r1, br):
    zs = np.linspace(z0, z1, nsec + 1)
    hws = np.linspace(hw0, hw1, nsec + 1)
    lrs = np.linspace(leg_r0, leg_r1, nsec + 1)
    lv = [square_corners(h, z) for h, z in zip(hws, zs)]
    for s in range(nsec):
        for c in range(4):
            legs.tube(lv[s][c], lv[s + 1][c], lrs[s], lrs[s + 1], seg=12)
            c2 = (c + 1) % 4
            braces.tube(lv[s][c], lv[s + 1][c2], br, seg=8)
            braces.tube(lv[s][c2], lv[s + 1][c], br, seg=8)
            braces.tube(lv[s + 1][c], lv[s + 1][c2], br * 1.25, seg=8)
        # 內部水平斜撐
        braces.tube(lv[s + 1][0], lv[s + 1][2], br * 0.8, seg=6)
        braces.tube(lv[s + 1][1], lv[s + 1][3], br * 0.8, seg=6)
    return lambda z: np.interp(z, zs, hws)


def build_roof_and_spire(col_roof, col_spire):
    zb = C.BODY_H
    # --- 屋頂機房圓鼓（玻璃）＋金屬框＋觀景平台
    drum = MeshBuilder("Roof_Drum_Glass")
    rows = [outline(z, 0, 128, a=C.DRUM_A, b=C.DRUM_B) for z in np.linspace(zb, C.DRUM_TOP, 6)]
    drum.grid_surface(np.array(rows))
    drum.to_object(MAT.get("glass"), col_roof, solidify=0.06)
    frame = MeshBuilder("Roof_Drum_Frame")
    for th in np.linspace(0, TAU, 36, endpoint=False):
        r = C.superellipse_r(th, C.DRUM_A, C.DRUM_B) + 0.12
        p = np.array([r * math.cos(th), r * math.sin(th), 0])
        frame.box_between(p + [0, 0, zb], p + [0, 0, C.DRUM_TOP], 0.24, 0.12, p)
    deck_o = outline(0, 0, 160, a=C.DECK_A, b=C.DECK_B)
    frame.prism(deck_o, C.DRUM_TOP, C.SPIRE_BASE_Z, smooth_sides=True)
    frame.ring_prism(outline(0, 0, 128, a=C.DRUM_A + 0.15, b=C.DRUM_B + 0.15),
                     outline(0, 0, 128, a=C.DRUM_A - 0.3, b=C.DRUM_B - 0.3), zb + 2.45, zb + 2.6)
    rail = outline(0, -0.25, 160, a=C.DECK_A, b=C.DECK_B)
    rail[:, 2] = C.SPIRE_BASE_Z + 1.1
    frame.ring_sweep(rail, rounded_rect_profile(0.12, 0.12, n=2, seg=10))
    for p in rail[::5]:
        frame.tube(p - [0, 0, 1.1], p, 0.05, seg=6)
    # 屋頂設備
    for (x, y, sx, sy) in [(9.0, 0, 1.6, 4.0), (-9.0, 0, 1.6, 4.0), (0, 7.6, 4.5, 1.4),
                           (5.5, -6.0, 2.2, 1.4), (-5.5, -6.0, 2.2, 1.4)]:
        frame.abox((x, y, zb + 0.9), (sx, sy, 1.8))
    frame.to_object(MAT.get("metal"), col_roof)

    # 屋頂邊緣小型天線群
    ant = MeshBuilder("Roof_Antenna_Array")
    rng = np.random.default_rng(7)
    for i, th in enumerate(np.linspace(0, TAU, 28, endpoint=False) + 0.05):
        p = facade_point(th, zb, -1.1)
        h = 2.5 + 4.5 * rng.random()
        ant.tube(p, p + [0, 0, h], 0.11, 0.05, seg=8)
        ant.tube(p + [0, 0, h * 0.7] - [0.5, 0, 0], p + [0, 0, h * 0.7] + [0.5, 0, 0], 0.035, seg=6)
        if i % 3 == 0:
            n = facade_normal(th, zb)
            ant.box(p + [0, 0, h * 0.5] + n * 0.2, n, np.cross([0, 0, 1], n), (0, 0, 1), 0.12, 0.45, 1.3)
    ant.to_object(MAT.get("metal"), col_roof)

    # --- 尖塔
    SW, SK = C.SPIRE_SW, C.SPIRE_SK
    PL = C.SPIRE_POLE_TOP_Z - C.SPIRE_MAST_TOP_Z
    legs = MeshBuilder("Spire_Lattice_Legs")
    braces = MeshBuilder("Spire_Bracing")
    z0 = C.SPIRE_BASE_Z
    hw_base = lattice(legs, braces, z0, C.SPIRE_FOOT_HW, C.SPIRE_WAIST_Z, C.SPIRE_WAIST_HW,
                      C.SPIRE_NSEC_BASE, 0.48 * SW, 0.34 * SW, 0.10 * SW)
    hw_mast = lattice(legs, braces, C.SPIRE_WAIST_Z, C.SPIRE_WAIST_HW, C.SPIRE_MAST_TOP_Z,
                      C.SPIRE_MAST_TOP_HW, C.SPIRE_NSEC_MAST, 0.32 * SW, 0.16 * SW, 0.065 * SW)

    def hw(z):
        return hw_base(z) if z <= C.SPIRE_WAIST_Z else hw_mast(z)

    # 中央垂直主桿＋四向垂直支柱
    pole = MeshBuilder("Spire_Main_Pole")
    pole.tube((0, 0, zb), (0, 0, C.SPIRE_MAST_TOP_Z), 0.65 * SW, 0.4 * SW, seg=24)
    pole.tube((0, 0, C.SPIRE_MAST_TOP_Z), (0, 0, C.SPIRE_POLE_TOP_Z), 0.42 * SW, 0.16 * SW, seg=20)
    pole.tube((0, 0, C.SPIRE_POLE_TOP_Z), (0, 0, C.SPIRE_TOP_Z), 0.07, 0.025, seg=10)
    for f in (0.0, 3.5 / 10.4, 7.0 / 10.4):
        zc = C.SPIRE_MAST_TOP_Z + f * PL
        pole.tube((0, 0, zc - 0.3 * SW), (0, 0, zc + 0.3 * SW), (0.75 - f * 10.4 * 0.05) * SW, seg=24)
    for f, L in ((2.5 / 10.4, 3.0 * SW), (5.5 / 10.4, 2.2 * SW), (8.5 / 10.4, 1.5 * SW)):
        z = C.SPIRE_MAST_TOP_Z + f * PL
        pole.tube((-L, 0, z), (L, 0, z), 0.05, seg=8)
        pole.tube((0, -L, z), (0, L, z), 0.05, seg=8)
        for s in (-1, 1):
            pole.tube((s * L, 0, z - 0.6), (s * L, 0, z + 0.6), 0.04, seg=6)
            pole.tube((0, s * L, z - 0.6), (0, s * L, z + 0.6), 0.04, seg=6)
    # 尖塔底部固定座
    for c in square_corners(C.SPIRE_FOOT_HW, z0):
        pole.abox(c + [0, 0, 0.35], (2.0, 2.0, 0.7))
        pole.tube(c + [0, 0, 0.7], c + [0, 0, 1.5], 0.7, 0.5, seg=16)
    pole.to_object(MAT.get("titanium"), col_spire)

    beacon = MeshBuilder("Spire_Top_Beacon")
    beacon.sphere((0, 0, C.SPIRE_POLE_TOP_Z + 0.2), 0.24)
    beacon.sphere((0, 0, C.SPIRE_MAST_TOP_Z + 0.6), 0.2)
    beacon.to_object(MAT.get("beacon"), col_spire)

    # 多層環形天線平台
    rings = MeshBuilder("Spire_Ring_Platforms")
    panels = MeshBuilder("Spire_Antenna_Panels")
    white_rings = MeshBuilder("Spire_White_Halo_Rings")
    for (z, ro, npan) in C.SPIRE_RINGS:
        h = hw(z)
        ri = h * math.sqrt(2) + 0.35
        rings.ring_prism(circle(ro, 96), circle(ri, 96), z - 0.35, z)
        rail = circle(ro - 0.12, 96, z + 1.1)
        rings.ring_sweep(rail, rounded_rect_profile(0.12, 0.12, n=2, seg=10))
        for p in rail[::4]:
            rings.tube(p - [0, 0, 1.1], p, 0.045, seg=6)
        # 平台與桁架主腳之連接
        for c in square_corners(h, z - 0.2):
            d = _unit(c * [1, 1, 0])
            rings.tube(c, d * (ro - 0.3) + [0, 0, z - 0.2], 0.14, seg=10)
        for c, a in zip(square_corners(hw(z - 3.6), z - 3.6), range(4)):
            d = _unit(c * [1, 1, 0])
            rings.tube(c, d * (ro - 0.4) + [0, 0, z - 0.35], 0.12, seg=10)
            d2 = np.array([-d[1], d[0], 0])
            rings.tube(c, _unit(d + d2) * (ro - 0.4) + [0, 0, z - 0.35], 0.09, seg=8)
        white_rings.ring_sweep(circle(ro + 0.05, 128, z - 0.55), rounded_rect_profile(0.35, 0.7, n=5, seg=20))
        for a in np.linspace(0, TAU, npan, endpoint=False) + 0.1:
            d = np.array([math.cos(a), math.sin(a), 0])
            tg = np.array([-math.sin(a), math.cos(a), 0])
            c = d * (ro + 0.55) + [0, 0, z - 1.6]
            panels.box(c, d, tg, (0, 0, 1), 0.2 * SW, 0.7 * SW, 2.6 * SW)
            rings.tube(d * (ro + 0.2) + [0, 0, z - 0.8], d * (ro + 0.45) + [0, 0, z - 0.8], 0.05, seg=6)
            rings.tube(d * (ro + 0.2) + [0, 0, z - 2.4], d * (ro + 0.45) + [0, 0, z - 2.4], 0.05, seg=6)
    # 微波碟型天線
    for z in (C.BODY_H + 34.5 * SK, C.BODY_H + 45.0 * SK):
        for a in (0.3, 2.4, 4.5):
            d = np.array([math.cos(a), math.sin(a), 0])
            base = d * (hw(z) * 1.25) + [0, 0, z]
            panels.tube(base, base + d * 0.55 * SW, 0.75 * SW, seg=28)
            rings.tube(d * hw(z) * 0.9 + [0, 0, z], base, 0.08, seg=8)
    rings.to_object(MAT.get("metal"), col_spire)
    panels.to_object(MAT.get("white_ceramic"), col_spire)
    white_rings.to_object(MAT.get("white_ceramic"), col_spire)
    legs.to_object(MAT.get("titanium"), col_spire)
    braces.to_object(MAT.get("metal"), col_spire)


# ================================================================ entry
def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights,
                 bpy.data.worlds, bpy.data.collections):
        for b in list(coll):
            coll.remove(b)


def build():
    clear_scene()
    MAT.build_all()
    rib = all_ribbons()
    cols = {k: collection(v) for k, v in [("base", "D_Base"), ("main", "A_Main_Building"),
                                          ("exo", "B_Exoskeleton"), ("roof", "C1_Roof_Crown"),
                                          ("spire", "C2_Spire")]}
    build_base(cols["base"])
    legs = build_base_legs(cols["base"], rib)
    build_main(cols["main"])
    kept, skipped = build_exoskeleton(cols["exo"], rib)
    build_roof_and_spire(cols["roof"], cols["spire"])
    info = dict(base_leg_angles_deg=[round(math.degrees(a), 1) for a in legs],
                struts_kept=kept, struts_skipped_for_clearance=skipped,
                crossings=len(ribbon_crossings(rib)))
    print("[build]", info)
    return info


if __name__ == "__main__":
    build()
