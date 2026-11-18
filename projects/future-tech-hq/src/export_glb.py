"""GLB / glTF 匯出：只匯出建築物件（排除攝影機、燈光、陰影捕捉地面），套用 Solidify 修改器。"""
import bpy

BUILDING_COLLECTIONS = ("D_Base", "A_Main_Building", "B_Exoskeleton", "C1_Roof_Crown", "C2_Spire")


def export_glb(path):
    bpy.ops.object.select_all(action="DESELECT")
    n = 0
    for cname in BUILDING_COLLECTIONS:
        for ob in bpy.data.collections[cname].objects:
            ob.select_set(True)
            n += 1
    bpy.context.view_layer.objects.active = bpy.data.collections["A_Main_Building"].objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=False,
    )
    print(f"[export] {n} objects → {path}")
    return n
