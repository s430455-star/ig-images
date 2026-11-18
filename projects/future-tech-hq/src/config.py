"""FUTURE TECHNOLOGY HEADQUARTERS — 正式建築尺寸與造型參數（單位：公尺，Z 軸朝上，正面朝 -Y）。

兩種版本（以環境變數 HQ_VARIANT 選擇）：
  預設（正式規格，不可擅自修改）：
    主體 10 層、主體高度 50 m（每層 5 m）；通訊尖塔 68 m；總高 118 m
  HQ_VARIANT=tower500：主體 10 層 × 21.2 m = 212 m；尖塔 288 m；總高 500 m；每層 100 坪
  HQ_VARIANT=tower150（阿川的園區專案目前版本）：
    主體 30 層 × 3 m = 90 m；通訊尖塔 60 m；總高 150 m；每層 100 坪
  HQ_VARIANT=tower110：
    主體 10 層 × 3 m = 30 m；通訊尖塔 80 m；總高 110 m；每層 100 坪
  HQ_VARIANT=tower200p：
    由 80 m 版本等比例拉高：主體 25 層 × 3 m = 75 m；通訊尖塔 125 m；總高 200 m；每層 100 坪
  HQ_VARIANT=tower80：
    主體 10 層 × 3 m = 30 m；通訊尖塔 50 m；總高 80 m；每層 100 坪
  HQ_VARIANT=tower200：
    主體 10 層 × 15 m = 150 m；通訊尖塔 50 m；總高 200 m；每層 100 坪
  HQ_VARIANT=tower114：
    主體 114 層 × 3.5 m = 399 m；屋頂機房基座 1 m；通訊尖塔 100 m；總高 500 m；每層 100 坪
  HQ_VARIANT=tower800：
    主體 10 層 × 5 m = 50 m；通訊尖塔 750 m；總高 800 m；
    每層樓地板固定 100 坪（330.58 m²），塔身上下等寬；尖塔重新配置比例（加寬底座、6 層環形平台）
"""
import math
import os

VARIANT = os.environ.get("HQ_VARIANT", "default")
PING = 3.305785                    # 1 坪 = 3.305785 m²

# ---------------------------------------------------------------- 正式尺寸
FLOORS = {"tower114": 114, "tower200p": 25, "tower150": 30}.get(VARIANT, 10)
FLOOR_H = {"tower500": 21.2, "tower114": 3.5, "tower200": 15.0, "tower80": 3.0, "tower200p": 3.0, "tower110": 3.0, "tower150": 3.0}.get(VARIANT, 5.0)
BODY_H = FLOORS * FLOOR_H          # 50.0 / 212.0  主體屋頂結構面
ROOF_BASE_H = 1.0 if VARIANT == "tower114" else 0.0   # 屋頂機房基座（尖塔從其頂面起算）
SPIRE_H = {"tower500": 288.0, "tower800": 750.0, "tower114": 100.0, "tower200": 50.0, "tower80": 50.0, "tower200p": 125.0, "tower110": 80.0, "tower150": 60.0}.get(VARIANT, 68.0) + ROOF_BASE_H
TOTAL_H = BODY_H + SPIRE_H         # 118 / 500 / 800 地面至尖塔頂
UNIFORM_100 = VARIANT in ("tower500", "tower800", "tower114", "tower200", "tower80", "tower200p", "tower110", "tower150")
TALL_FLOORS = FLOOR_H > 8          # 挑高樓層：樓層中段加遮陽板與外骨骼支撐
if VARIANT == "tower500":
    assert abs(TOTAL_H - 500.0) < 1e-9
elif VARIANT == "tower800":
    assert abs(BODY_H - 50.0) < 1e-9 and abs(TOTAL_H - 800.0) < 1e-9
elif VARIANT == "tower150":
    assert abs(BODY_H - 90.0) < 1e-9 and abs(TOTAL_H - 150.0) < 1e-9
elif VARIANT == "tower110":
    assert abs(BODY_H - 30.0) < 1e-9 and abs(TOTAL_H - 110.0) < 1e-9
elif VARIANT == "tower200p":
    assert abs(BODY_H - 75.0) < 1e-9 and abs(TOTAL_H - 200.0) < 1e-9
elif VARIANT == "tower80":
    assert abs(BODY_H - 30.0) < 1e-9 and abs(TOTAL_H - 80.0) < 1e-9
elif VARIANT == "tower200":
    assert abs(BODY_H - 150.0) < 1e-9 and abs(TOTAL_H - 200.0) < 1e-9
elif VARIANT == "tower114":
    assert abs(BODY_H - 399.0) < 1e-9 and abs(TOTAL_H - 500.0) < 1e-9
else:
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
if UNIFORM_100:
    # 超橢圓面積 = 4ab·Γ(1+1/n)²/Γ(1+2/n)；n=3、a/b=1.25 → 每層 100 坪
    _k_area = 4 * math.gamma(1 + 1 / PLAN_N) ** 2 / math.gamma(1 + 2 / PLAN_N)
    _b = math.sqrt(100 * PING / (_k_area * 1.25))
    PLAN_A0 = PLAN_A1 = 1.25 * _b      # ≈ 10.82 m（寬 21.6 m）
    PLAN_B0 = PLAN_B1 = _b             # ≈ 8.65 m（深 17.3 m）

SLAB_EDGE = 0.55                   # 樓板外緣突出玻璃面
SLAB_T = 0.6
FIN_DEPTH = 0.42
N_FINS = 70                        # 垂直窗框數（沿周長均分）
COLUMN_EVERY = 7                   # 每 N 支窗框設一支結構柱

# ---------------------------------------------------------------- 白色螺旋外骨骼
RIB_Z0 = PODIUM_TOP                # 起點：基座頂
RIB_Z1 = BODY_H + 1.0              # 終點：屋頂冠環
RIB_TURNS = 0.75                   # 每條螺旋繞行圈數
RIB_WIDTH = 2.9                    # 帶寬
RIB_THICK = 0.8                    # 實際截面厚度
RIB_OFF_TOP = 2.3                  # 屋頂處距玻璃面
RIB_OFF_BASE = 3.2                 # 底部額外外擴
RIB_BULGE = 3.8                   # 中下段外鼓
RIB_SPLIT = 0.78                   # 交錯處內外層分離（± 公尺）
RIB_SAMPLES = 420
RIB_TAPER_W = 0.09                 # 兩端內外層分離的收斂長度（比例）
if VARIANT == "tower500":
    RIB_TURNS, RIB_WIDTH, RIB_THICK = 2.25, 4.2, 1.1
    RIB_OFF_TOP, RIB_OFF_BASE, RIB_BULGE, RIB_SPLIT = 2.6, 4.0, 5.0, 1.1
    RIB_SAMPLES = 1600
    RIB_TAPER_W = 0.012
if VARIANT == "tower150":
    RIB_TURNS, RIB_WIDTH, RIB_THICK = 1.2, 3.2, 0.85
    RIB_OFF_TOP, RIB_OFF_BASE, RIB_BULGE, RIB_SPLIT = 2.4, 3.6, 4.3, 0.85
    RIB_SAMPLES = 800
    RIB_TAPER_W = 0.035
if VARIANT == "tower200p":
    RIB_TURNS, RIB_WIDTH, RIB_THICK = 1.1, 3.1, 0.85
    RIB_OFF_TOP, RIB_OFF_BASE, RIB_BULGE, RIB_SPLIT = 2.4, 3.5, 4.2, 0.85
    RIB_SAMPLES = 700
    RIB_TAPER_W = 0.04
if VARIANT == "tower200":
    RIB_TURNS, RIB_WIDTH, RIB_THICK = 1.4, 3.6, 0.95
    RIB_OFF_TOP, RIB_OFF_BASE, RIB_BULGE, RIB_SPLIT = 2.5, 3.8, 4.6, 0.95
    RIB_SAMPLES = 1000
    RIB_TAPER_W = 0.02
if VARIANT == "tower114":
    RIB_TURNS, RIB_WIDTH, RIB_THICK = 4.25, 4.4, 1.15
    RIB_OFF_TOP, RIB_OFF_BASE, RIB_BULGE, RIB_SPLIT = 2.6, 4.2, 5.5, 1.15
    RIB_SAMPLES = 1900
    RIB_TAPER_W = 0.0065
    RIB_PROF_SEG, RIB_TRIM_SEG = 20, 6
    PLAN_NU = 112                  # 網頁版：平面取樣減量
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
CROWN_Z = BODY_H
DRUM_A, DRUM_B = 7.6, 6.6
DRUM_TOP = BODY_H + 5.0
DECK_A, DECK_B = 9.6, 8.6
DECK_T = 0.6
SPIRE_BASE_Z = DRUM_TOP + DECK_T   # 55.6 尖塔框架落點

# ---------------------------------------------------------------- 通訊尖塔（自屋頂起算 SPIRE_H）
SPIRE_SK = SPIRE_H / 68.0          # 高度比例（預設 1）
SPIRE_SW = {"tower500": 1.5, "tower800": 2.1, "tower114": 1.25, "tower200p": 1.3, "tower110": 1.1, "tower150": 1.05}.get(VARIANT, 1.0)   # 桁架寬度比例
SPIRE_TOP_Z = TOTAL_H              # 118.0 / 500.0
SPIRE_FOOT_HW = 6.0                # 尖塔底部框架半寬
SPIRE_WAIST_Z = BODY_H + 18.0 * SPIRE_SK
SPIRE_WAIST_HW = 2.4 * SPIRE_SW
SPIRE_MAST_TOP_Z = BODY_H + 56.0 * SPIRE_SK
SPIRE_MAST_TOP_HW = 0.7 * SPIRE_SW
SPIRE_POLE_TOP_Z = BODY_H + 66.4 * SPIRE_SK
SPIRE_NSEC_BASE = 8 if VARIANT == "tower500" else 4
SPIRE_NSEC_MAST = 36 if VARIANT == "tower500" else 12
SPIRE_RINGS = [  # (z, 外半徑, 天線板數)
    (BODY_H + 18.0 * SPIRE_SK, 6.4 * SPIRE_SW, 20),
    (BODY_H + 29.5 * SPIRE_SK, 4.8 * SPIRE_SW, 16),
    (BODY_H + 40.5 * SPIRE_SK, 3.5 * SPIRE_SW, 14),
    (BODY_H + 49.5 * SPIRE_SK, 2.5 * SPIRE_SW, 10),
]
SPIRE_DISH_Z = [BODY_H + 34.5 * SPIRE_SK, BODY_H + 45.0 * SPIRE_SK]
if VARIANT == "tower800":
    # 750 m 尖塔：不能單純拉長 → 底座加寬貼滿屋頂、腰部提高、桁架分段加密、6 層環形平台遞減
    SPIRE_FOOT_HW = 6.6
    SPIRE_WAIST_Z, SPIRE_WAIST_HW = 215.0, 3.9
    SPIRE_MAST_TOP_Z, SPIRE_MAST_TOP_HW = 700.0, 1.6
    SPIRE_POLE_TOP_Z = 784.0
    SPIRE_NSEC_BASE, SPIRE_NSEC_MAST = 14, 72
    SPIRE_RINGS = [(215.0, 11.0, 28), (315.0, 9.4, 24), (415.0, 7.8, 22),
                   (510.0, 6.4, 18), (595.0, 5.2, 16), (665.0, 4.0, 12)]
    SPIRE_DISH_Z = [265.0, 365.0, 465.0, 555.0, 630.0]

# ---------------------------------------------------------------- 斜向落地支撐腳的頂點
LEG_TOP_Z = {"tower500": FLOOR_H, "tower200": FLOOR_H, "tower114": 3 * FLOOR_H, "tower80": 2 * FLOOR_H, "tower200p": 3 * FLOOR_H, "tower110": 2 * FLOOR_H, "tower150": 3 * FLOOR_H}.get(VARIANT, 10.0)
LEG_MID_Z = {"tower500": FLOOR_H / 2, "tower200": FLOOR_H / 2, "tower114": 1.5 * FLOOR_H, "tower80": 1.5 * FLOOR_H, "tower200p": 1.5 * FLOOR_H, "tower110": 1.5 * FLOOR_H, "tower150": 1.5 * FLOOR_H}.get(VARIANT, 5.0)
STRUT_EVERY = {"tower114": 3, "tower80": 2, "tower200p": 2, "tower110": 2, "tower150": 2}.get(VARIANT, 1)   # 外骨骼支撐每幾層一組


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
