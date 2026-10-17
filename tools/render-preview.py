import bpy,sys,math
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
which=sys.argv[-1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/models'/('kestrel-hd.glb' if which=='jet' else 'airfield-kit-hd.glb')))
if which=='airfield':
 kit=bpy.data.objects.get('AIRFIELD_KIT');
 for o in list(kit.children):
  pos={'Hangar':(-50,0,0),'Tower':(88,-32,0),'Operations':(80,48,0),'RadarStation':(28,66,0),'FuelTank':(6,-64,0),'ServiceCart':(-10,-65,0),'TaxiSign':(-28,67,0),'EquipmentPallet':(15,-42,0),'PAPI':(50,-20,0)}
  if o.name in pos:o.location=pos[o.name]
  else: print('UNMATCHED',o.name)
 camloc=(175,170,140);target=(18,0,17);scale=260
else:camloc=(24,25,14);target=(0,0,0);scale=29
bpy.ops.object.camera_add(location=camloc);camera=bpy.context.object;direction=Vector(target)-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=scale;bpy.context.scene.camera=camera
# ground backdrop
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-2.7 if which=='jet' else -.7));floor=bpy.context.object;floor.scale=(200,200,1)
mt=bpy.data.materials.new('Muted studio slate floor');mt.diffuse_color=(.15,.20,.22,1);mt.use_nodes=True;mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.11,.16,.18,1);floor.data.materials.append(mt)
world=bpy.data.worlds.new('Cold daylight');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.24,.35,.44,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
bpy.ops.object.light_add(type='AREA',location=(30,20,75));key=bpy.context.object;key.data.energy=5500;key.data.shape='DISK';key.data.size=75
bpy.ops.object.light_add(type='AREA',location=(-28,-25,60));fill=bpy.context.object;fill.data.energy=3600;fill.data.size=60
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1250;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/'previews'/(which+'-preview.png'))
bpy.ops.render.render(write_still=True)
print('RENDER DONE',scene.render.filepath)
