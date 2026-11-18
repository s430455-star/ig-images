import sys,os
sys.path.insert(0,'src')
import bpy, build_model
build_model.build()
bpy.ops.object.select_all(action='DESELECT')
for c in ("D_Base","A_Main_Building","B_Exoskeleton","C1_Roof_Crown","C2_Spire"):
    for o in bpy.data.collections[c].objects:
        if o.name!="Base_Site_Paving": o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects["Main_Core"]
out=sys.argv[-1]
bpy.ops.export_scene.gltf(filepath=out,export_format='GLTF_SEPARATE',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
print("ok",os.path.getsize(out))
