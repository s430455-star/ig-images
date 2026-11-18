"""輕量幾何建構工具：以 numpy 產生真實 3D 網格（管件、掃掠、稜柱、球體、方塊），
並以一致的外向面法線寫入 Blender。每個 MeshBuilder 對應一個可編輯的 Blender 物件。"""
import math
import numpy as np
import bpy

TAU = 2.0 * math.pi


def _unit(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def _perp(d):
    a = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = _unit(np.cross(d, a))
    v = np.cross(d, u)
    return u, v


def circle(r, seg, z=0.0):
    a = np.linspace(0, TAU, seg, endpoint=False)
    return np.stack([r * np.cos(a), r * np.sin(a), np.full(seg, z)], 1)


def rounded_rect_profile(w_x, w_y, n=6.0, seg=24):
    """以超橢圓近似的圓角矩形截面（逆時針），x/y 為全寬。"""
    a = np.linspace(0, TAU, seg, endpoint=False)
    c, s = np.cos(a), np.sin(a)
    e = 2.0 / n
    x = 0.5 * w_x * np.sign(c) * np.abs(c) ** e
    y = 0.5 * w_y * np.sign(s) * np.abs(s) ** e
    return np.stack([x, y], 1)


class MeshBuilder:
    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.smooth = []
        self.nv = 0

    # ------------------------------------------------------------ core
    def add(self, V, F, smooth=True):
        V = np.asarray(V, float).reshape(-1, 3)
        base = self.nv
        self.verts.append(V)
        for f in F:
            self.faces.append([int(i) + base for i in f])
            self.smooth.append(smooth)
        self.nv += len(V)
        return base

    @property
    def vertex_count(self):
        return self.nv

    def all_verts(self):
        return np.vstack(self.verts) if self.verts else np.zeros((0, 3))

    # ------------------------------------------------------------ primitives
    def tube(self, p1, p2, r1, r2=None, seg=12, caps=True, smooth=True):
        p1, p2 = np.asarray(p1, float), np.asarray(p2, float)
        r2 = r1 if r2 is None else r2
        d = p2 - p1
        L = np.linalg.norm(d)
        if L < 1e-6:
            return
        d /= L
        u, v = _perp(d)
        a = np.linspace(0, TAU, seg, endpoint=False)
        c = np.cos(a)[:, None] * u + np.sin(a)[:, None] * v
        V = np.vstack([p1 + r1 * c, p2 + r2 * c])
        F = [[j, (j + 1) % seg, seg + (j + 1) % seg, seg + j] for j in range(seg)]
        self.add(V, F, smooth)
        if caps:
            self.add(np.vstack([p1 + r1 * c, p1[None]]),
                     [[seg, (j + 1) % seg, j] for j in range(seg)], False)
            self.add(np.vstack([p2 + r2 * c, p2[None]]),
                     [[seg, j, (j + 1) % seg] for j in range(seg)], False)

    def sphere(self, c, r, seg=14, rings=8, smooth=True):
        c = np.asarray(c, float)
        V = [c + [0, 0, r]]
        for i in range(1, rings):
            th = math.pi * i / rings
            for j in range(seg):
                ph = TAU * j / seg
                V.append(c + r * np.array([math.sin(th) * math.cos(ph),
                                           math.sin(th) * math.sin(ph), math.cos(th)]))
        V.append(c - [0, 0, r])
        idx = lambda i, j: 1 + (i - 1) * seg + (j % seg)
        F = [[0, idx(1, j), idx(1, j + 1)] for j in range(seg)]
        for i in range(1, rings - 1):
            for j in range(seg):
                F.append([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)])
        s = len(V) - 1
        F += [[s, idx(rings - 1, j + 1), idx(rings - 1, j)] for j in range(seg)]
        self.add(V, F, smooth)

    def box(self, center, ex, ey, ez, sx, sy, sz):
        """方向盒：ex,ey,ez 為右手座標軸單位向量，s* 為全尺寸。"""
        c = np.asarray(center, float)
        ex, ey, ez = (np.asarray(e, float) for e in (ex, ey, ez))
        P = []
        for (i, j, k) in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                          (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]:
            P.append(c + 0.5 * (i * sx * ex + j * sy * ey + k * sz * ez))
        F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
        self.add(P, F, False)

    def abox(self, center, size):
        self.box(center, (1, 0, 0), (0, 1, 0), (0, 0, 1), *size)

    def box_between(self, p1, p2, wx, wy, xhint):
        """沿 p1→p2 的長方桿件；截面 wx（沿 xhint）× wy。"""
        p1, p2 = np.asarray(p1, float), np.asarray(p2, float)
        d = p2 - p1
        L = np.linalg.norm(d)
        if L < 1e-6:
            return
        ez = d / L
        xh = np.asarray(xhint, float)
        ex = _unit(xh - np.dot(xh, ez) * ez)
        ey = np.cross(ez, ex)
        self.box((p1 + p2) / 2, ex, ey, ez, wx, wy, L)

    def sweep(self, P, N, B, profile, closed=False, caps=True, smooth=True):
        """沿路徑 P 掃掠 2D 截面；截面點 (x,y) → P + x·N + y·B，(N,B,T) 右手。"""
        P, N, B = (np.asarray(a, float) for a in (P, N, B))
        prof = np.asarray(profile, float)
        M, n = len(prof), len(P)
        rings = P[:, None, :] + prof[None, :, 0, None] * N[:, None, :] + prof[None, :, 1, None] * B[:, None, :]
        V = rings.reshape(-1, 3)
        F = []
        last = n if closed else n - 1
        for i in range(last):
            i2 = (i + 1) % n
            for j in range(M):
                j2 = (j + 1) % M
                F.append([i * M + j, i * M + j2, i2 * M + j2, i2 * M + j])
        self.add(V, F, smooth)
        if caps and not closed:
            self.add(np.vstack([rings[0], P[0][None]]), [[M, (j + 1) % M, j] for j in range(M)], False)
            self.add(np.vstack([rings[-1], P[-1][None]]), [[M, j, (j + 1) % M] for j in range(M)], False)

    def ring_sweep(self, loop_xyz, profile, smooth=True):
        """沿水平封閉迴圈（逆時針）掃掠截面；x=外向徑向，y=向下。"""
        P = np.asarray(loop_xyz, float)
        T = _unit(np.roll(P, -1, 0) - np.roll(P, 1, 0))
        up = np.array([0.0, 0.0, 1.0])
        N = _unit(np.cross(T, up))      # 逆時針迴圈 → 外向
        B = np.cross(T, N)
        self.sweep(P, N, B, profile, closed=True, caps=False, smooth=smooth)

    def prism(self, outline, z0, z1, smooth_sides=False):
        """逆時針平面輪廓擠出成實心稜柱（頂/底為 n-gon）。"""
        o = np.asarray(outline, float)[:, :2]
        n = len(o)
        V = np.vstack([np.c_[o, np.full(n, z0)], np.c_[o, np.full(n, z1)]])
        F = [[j, (j + 1) % n, n + (j + 1) % n, n + j] for j in range(n)]
        self.add(V, F, smooth_sides)
        self.add(V, [list(range(n, 2 * n)), list(range(n - 1, -1, -1))], False)

    def ring_prism(self, outer, inner, z0, z1):
        """環形實心（外、內輪廓同點數、皆逆時針）。"""
        o = np.asarray(outer, float)[:, :2]
        i_ = np.asarray(inner, float)[:, :2]
        n = len(o)
        V = np.vstack([np.c_[o, np.full(n, z0)], np.c_[o, np.full(n, z1)],
                       np.c_[i_, np.full(n, z0)], np.c_[i_, np.full(n, z1)]])
        O0, O1, I0, I1 = 0, n, 2 * n, 3 * n
        F = []
        for j in range(n):
            k = (j + 1) % n
            F.append([O0 + j, O0 + k, O1 + k, O1 + j])      # 外牆
            F.append([I0 + k, I0 + j, I1 + j, I1 + k])      # 內牆
            F.append([O1 + j, O1 + k, I1 + k, I1 + j])      # 頂
            F.append([O0 + k, O0 + j, I0 + j, I0 + k])      # 底
        self.add(V, F, False)

    def grid_surface(self, rows, closed_u=True, smooth=True):
        """rows: (nz, nu, 3) 由下而上、逆時針的點陣列 → 外向曲面。"""
        R = np.asarray(rows, float)
        nz, nu = R.shape[:2]
        V = R.reshape(-1, 3)
        F = []
        for k in range(nz - 1):
            for j in range(nu if closed_u else nu - 1):
                j2 = (j + 1) % nu
                F.append([k * nu + j, k * nu + j2, (k + 1) * nu + j2, (k + 1) * nu + j])
        self.add(V, F, smooth)

    # ------------------------------------------------------------ output
    def to_object(self, material=None, collection=None, solidify=None):
        V = self.all_verts()
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(V.tolist(), [], self.faces)
        mesh.polygons.foreach_set("use_smooth", self.smooth)
        mesh.validate(clean_customdata=False)
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        (collection or bpy.context.scene.collection).objects.link(obj)
        if material is not None:
            mesh.materials.append(material)
        if solidify:
            m = obj.modifiers.new("Solidify", "SOLIDIFY")
            m.thickness = solidify
            m.offset = -1.0
            m.use_even_offset = True
        return obj
