"""材質設定：白色陶瓷複合外骨骼、藍灰建築玻璃、銀色拉絲金屬、鈦合金、混凝土、基座石材。
全部使用 Principled BSDF（可直接匯出為 glTF PBR / KHR_materials_*）。"""
import bpy

_CACHE = {}


def _principled(name, base, rough, metallic=0.0, coat=0.0, coat_rough=0.05,
                transmission=0.0, ior=1.45, spec=0.5, aniso=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        mat.use_nodes = True  # 5.x 預設即為節點材質
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    inp = bsdf.inputs
    inp["Base Color"].default_value = (*base, 1.0)
    inp["Roughness"].default_value = rough
    inp["Metallic"].default_value = metallic
    inp["IOR"].default_value = ior
    inp["Specular IOR Level"].default_value = spec
    inp["Coat Weight"].default_value = coat
    inp["Coat Roughness"].default_value = coat_rough
    inp["Transmission Weight"].default_value = transmission
    if "Anisotropic" in inp:
        inp["Anisotropic"].default_value = aniso
    inp["Alpha"].default_value = alpha
    mat.diffuse_color = (*base, 1.0)       # 視埠顏色
    mat.metallic = metallic
    mat.roughness = rough
    return mat


def build_all():
    M = {}
    # 高級白色陶瓷複合材質：微霧面＋清漆層 → 細緻反射、柔和高光
    M["white_ceramic"] = _principled("MAT_White_Ceramic_Composite", (0.90, 0.91, 0.92), 0.28,
                                     coat=0.55, coat_rough=0.12, spec=0.55)
    # 藍灰建築玻璃：低粗糙、部份穿透，搭配實體厚度（Solidify）→ 正確反射/折射
    M["glass"] = _principled("MAT_Glass_BlueGrey", (0.06, 0.12, 0.20), 0.02,
                             transmission=0.30, ior=1.52, spec=1.0, coat=0.3, coat_rough=0.02)
    M["glass_lobby"] = _principled("MAT_Glass_Lobby_Clear", (0.70, 0.80, 0.86), 0.02,
                                   transmission=0.95, ior=1.52, spec=0.6)
    # 銀色拉絲金屬（窗框、樓板收邊、支撐）
    M["metal"] = _principled("MAT_Metal_Brushed_Silver", (0.80, 0.81, 0.82), 0.27,
                             metallic=1.0, aniso=0.5)
    # 鈦合金（結構柱、節點、尖塔桁架）
    M["titanium"] = _principled("MAT_Metal_Titanium", (0.56, 0.57, 0.59), 0.33, metallic=1.0)
    M["dark_metal"] = _principled("MAT_Metal_Graphite", (0.16, 0.17, 0.19), 0.38, metallic=1.0)
    M["concrete"] = _principled("MAT_Interior_Concrete", (0.30, 0.31, 0.32), 0.85)
    M["interior_ceiling"] = _principled("MAT_Interior_Ceiling", (0.50, 0.51, 0.52), 0.7)
    M["stone"] = _principled("MAT_Podium_Stone", (0.80, 0.80, 0.79), 0.45, spec=0.4)
    M["paving"] = _principled("MAT_Site_Paving", (0.66, 0.67, 0.68), 0.7)
    M["beacon"] = _principled("MAT_Beacon_Red", (0.8, 0.05, 0.03), 0.3)
    bsdf = next(n for n in M["beacon"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.1, 0.05, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 2.0
    _CACHE.update(M)
    return M


def get(key):
    return _CACHE[key]
