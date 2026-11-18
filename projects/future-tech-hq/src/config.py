"""FUTURE TECHNOLOGY HEADQUARTERS — 正式建築尺寸與造型參數（單位：公尺，Z 軸朝上，正面朝 -Y）。

正式規格（不可擅自修改）：
  主體 10 層、主體高度 50 m（每層 5 m）
  通訊尖塔自身高度 68 m（自主體屋頂 z=50 向上延伸）
  地面至尖塔頂端總高度 118 m
"""
import math

# ---------------------------------------------------------------- 正式尺寸
FLOORS = 10
FLOOR_H = 5.0
BODY_H = FLOORS * FLOOR_H          # 50.0  主體屋頂結構面
SPIRE_H = 68.0                     # 尖塔自身高度
TOTAL_H = BODY_H + SPIRE_H         # 118.0 地面至尖塔頂
assert abs(BODY_H - 50.0) < 1e-9 and abs(TOTAL_H - 118.0) < 1e-9

# ---------------------------------------------------------------- 基座
SITE_HALF = 38.0                   # 方形鋪面基地半寬
PODIUM_R = 25.0                    # 圓形基座外半徑
PODIUM_STEP_R = 22.0
PODIUM_TOP = 1.0                   # 基座頂（大廳地坪）

# ---------------------------------------------------------------- 主體平面（超橢圓，下寬上窄）
PLAN_A0, PLAN_B0 = 15.0, 12.0      # z=0 半軸（寬 30 m × 深 24 m）
PLAN_A1, PLAN_B1 = 11.0, 9.0       # z=50 半軸（寬 22 m × 深 18 m）
PLAN_N = 3.0                       # 超橢圓指數（>2 = 圓角矩形）

SLAB_EDGE = 0.55                   # 樓板外緣突出玻璃面
SLAB_T = 0.6
FIN_DEPTH = 0.42
N_FINS = 70                        # 垂直窗框數（沿周長均分）
COLUMN_EVERY = 7                   # 每 N 支窗框設一支結構柱

# ---------------------------------------------------------------- 白色螺旋外骨骼
RIB_Z0 = PODIUM_TOP                # 起點：基座頂
RIB_Z1 = 51.0                      # 終點：屋頂冠環
RIB_TURNS = 0.75                   # 每條螺旋繞行圈數
RIB_WIDTH = 2.9                    # 帶寬
RIB_THICK = 0.8                    # 實際截面厚度
RIB_OFF_TOP = 2.3                  # 屋頂處距玻璃面
RIB_OFF_BASE = 3.2                 # 底部額外外擴
RIB_BULGE = 3.8                   # 中下段外鼓
RIB_SPLIT = 0.78                   # 交錯處內外層分離（± 公尺）
RIB_SAMPLES = 420
# 4 條螺旋：兩條順時針、兩條逆時針；第一組在正面 (θ=-90°) 中段交叉
_k = RIB_TURNS * 360.0
_tc = 0.5
RIBBONS = [
    # name, theta0 (deg), direction(+1 ccw / -1 cw)
    ("Exo_Ribbon_A1", -90.0 - _k * _tc, +1),
    ("Exo_Ribbon_A2", 90.0 - _k * _tc, +1),
    ("Exo_Ribbon_B1", -90.0 + _k * _tc, -1),
    ("Exo_Ribbon_B2", 90.0 + _k * _tc, -1),
]

# ---------------------------------------------------------------- 屋頂冠部
CROWN_Z = 50.0
DRUM_A, DRUM_B = 7.6, 6.6
DRUM_TOP = 55.0
DECK_A, DECK_B = 9.6, 8.6
DECK_T = 0.6
SPIRE_BASE_Z = DRUM_TOP + DECK_T   # 55.6 尖塔框架落點

# ---------------------------------------------------------------- 通訊尖塔（自 z=50 起算 68 m）
SPIRE_TOP_Z = TOTAL_H              # 118.0
SPIRE_FOOT_HW = 6.0                # 尖塔底部框架半寬
SPIRE_WAIST_Z = 68.0
SPIRE_WAIST_HW = 2.4
SPIRE_MAST_TOP_Z = 106.0
SPIRE_MAST_TOP_HW = 0.7
SPIRE_POLE_TOP_Z = 116.4
SPIRE_RINGS = [  # (z, 外半徑, 天線板數)
    (68.0, 6.4, 20),
    (79.5, 4.8, 16),
    (90.5, 3.5, 14),
    (99.5, 2.5, 10),
]


def lerp(a, b, t):
    return a + (b - a) * t


def plan_axes(z):
    t = min(max(z / BODY_H, 0.0), 1.0)
    return lerp(PLAN_A0, PLAN_A1, t), lerp(PLAN_B0, PLAN_B1, t)


def superellipse_r(theta, a, b, n=PLAN_N):
    c, s = abs(math.cos(theta)), abs(math.sin(theta))
    return (((c / a) ** n) + ((s / b) ** n)) ** (-1.0 / n)


def facade_r(theta, z):
    """玻璃帷幕面在角度 theta、高度 z 的平面半徑。"""
    a, b = plan_axes(z)
    return superellipse_r(theta, a, b)
