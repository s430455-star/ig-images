"""燈光、環境、攝影機與 Cycles 渲染設定。

• 自然日光：Sun（角直徑 1.2° → 清晰但柔和的陰影邊緣）
• 真實環境光：天頂藍 → 地平白的天空漸層世界光，提供玻璃/金屬反射
• 乾淨中性背景：透明底片＋陰影捕捉地面，最後與淺灰漸層背景合成
• 色彩管理：AgX（電影級高動態範圍色調映射）
"""
import math
import bpy
from mathutils import Vector

import config as C

# 八個固定視角：(檔名, 方位角°(相機位於目標的方向, -90=正面), 仰角°, 距離 m, 焦距 mm, 目標高度 m, 相機高度覆寫)
VIEWS = [
    ("01_front",            -90.0,  5.5, 300.0, 50.0, 57.0, None),
    ("02_left_front_45",   -135.0,  5.5, 300.0, 50.0, 57.0, None),
    ("03_right_front_45",   -45.0,  5.5, 300.0, 50.0, 57.0, None),
    ("04_left_side",        180.0,  5.5, 300.0, 50.0, 57.0, None),
    ("05_right_side",         0.0,  5.5, 300.0, 50.0, 57.0, None),
    ("06_back",              90.0,  5.5, 300.0, 50.0, 57.0, None),
    ("07_aerial_45",       -122.0, 45.0, 315.0, 50.0, 46.0, None),
    ("08_low_angle",       -108.0,  0.0,  74.0, 15.0, 56.0, 1.6),
]


def setup_render(scene, samples=128, res=(1600, 2000), preview=False):
    scene.render.engine = "CYCLES"
    cy = scene.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02 if preview else 0.008
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.max_bounces = 12
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 5
    cy.transmission_bounces = 10
    cy.transparent_max_bounces = 8
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 0.5
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    vs = scene.view_settings
    try:
        vs.view_transform = "AgX"
    except TypeError:
        vs.view_transform = "Filmic"
    vs.exposure = 0.0
    vs.gamma = 1.0


def setup_world(scene):
    w = bpy.data.worlds.new("World_Daylight_Studio")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.92, 0.94, 0.97, 1)    # 地平線：明亮白霧
    cr.elements[1].position = 0.55
    cr.elements[1].color = (0.36, 0.52, 0.80, 1)    # 天頂：自然藍
    e = cr.elements.new(0.12)
    e.color = (0.80, 0.86, 0.94, 1)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.85
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_sun(scene, azimuth_deg=-130.0, elevation_deg=48.0, strength=5.0):
    sun = bpy.data.objects.get("Sun_Key")
    if sun is None:
        ld = bpy.data.lights.new("Sun_Key", "SUN")
        sun = bpy.data.objects.new("Sun_Key", ld)
        studio_collection().objects.link(sun)
    sun.data.energy = strength
    sun.data.angle = math.radians(1.2)
    sun.data.color = (1.0, 0.975, 0.94)
    a, e = math.radians(azimuth_deg), math.radians(elevation_deg)
    to_sun = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    return sun


def studio_collection():
    col = bpy.data.collections.get("Z_Studio")
    if col is None:
        col = bpy.data.collections.new("Z_Studio")
        bpy.context.scene.collection.children.link(col)
    return col


def setup_ground():
    if bpy.data.objects.get("Studio_Shadow_Catcher"):
        return
    me = bpy.data.meshes.new("Studio_Shadow_Catcher")
    s = 1500.0
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new("Studio_Shadow_Catcher", me)
    ob.is_shadow_catcher = True
    studio_collection().objects.link(ob)


def make_camera(view):
    name, az, el, dist, lens, tz, cam_z = view
    cd = bpy.data.cameras.get("CAM_" + name) or bpy.data.cameras.new("CAM_" + name)
    cd.lens = lens
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = 24.0
    cd.sensor_width = 36.0
    cd.clip_start = 0.5
    cd.clip_end = 5000
    cam = bpy.data.objects.get("CAM_" + name)
    if cam is None:
        cam = bpy.data.objects.new("CAM_" + name, cd)
        studio_collection().objects.link(cam)
    a, e = math.radians(az), math.radians(el)
    target = Vector((0, 0, tz))
    pos = target + dist * Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    if cam_z is not None:
        pos.z = cam_z
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()
    return cam


def setup_all(scene, samples=128, res=(1600, 2000), preview=False):
    setup_render(scene, samples, res, preview)
    setup_world(scene)
    setup_sun(scene)
    setup_ground()
    cams = [make_camera(v) for v in VIEWS]
    scene.camera = cams[0]
    return cams
