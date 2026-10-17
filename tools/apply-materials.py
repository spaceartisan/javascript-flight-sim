"""Blender PBR texture and decal pipeline. Run with blender --background --python source/apply-materials.py"""
import bpy,math,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/models/aeronaut-assets.blend'
OUT=ROOT/'assets/models';OUT.mkdir(parents=True,exist_ok=True)
TEX=ROOT/'assets/materials'
if not (TEX/'airframe_base.jpg').exists:
 from zipfile import ZipFile
 from io import BytesIO
 packed=b''.join((TEX/('texture-sources.zip.part0'+str(i))).read_bytes() for i in (1,2))
 with ZipFile(BytesIO(packed)) as sources: sources.extractall(TEX)
bpy.ops.wm.open_mainfile(filepath=str(SRC))
# Keep source as Blender file with packed textures and layered vector-linked decals.
CHANNELS={
 'F-27 | ceramic light grey':'airframe',
 'F-27 | graphite coated wings':'airframe',
 'Rubberized graphite':'darkmetal',
 'Recessed anodized steel':'darkmetal',
 'Intake cavity | black':'darkmetal',
 'Aircraft hangar steel panelling':'hangar',
 'Dark blue coated zinc roof':'roof',
 'Clad concrete':'concrete',
 'Ground service olive':'olive',
 'Flat earth':'stone',
 'Aircraft tyres / carbon rubber':'darkmetal',
 'White paint / enamel':'airframe'
}
CACHE={}
def texture(key,channel,color='sRGB'):
 tag=f'{key}_{channel}';
 if tag in CACHE:return CACHE[tag]
 path=TEX/(tag+'.jpg');img=bpy.data.images.load(str(path),check_existing=True)
 img.colorspace_settings.name=color;img.pack();CACHE[tag]=img;return img
for m in bpy.data.materials:
 key=CHANNELS.get(m.name)
 if not key:continue
 m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links;principled=n.get('Principled BSDF')
 # Preserve original material tint so service olive and the fighter coating stay distinctive.
 img=n.new('ShaderNodeTexImage');img.name='Authored albedo – Krita / GIMP surface pass';img.image=texture(key,'base');img.interpolation='Linear';img.extension='REPEAT'
 tint=n.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=.20
 # Slightly color-correct against the original paint, retaining real texture detail.
 tint.inputs[1].default_value=principled.inputs['Base Color'].default_value
 links.new(img.outputs['Color'],tint.inputs[2]);links.new(tint.outputs['Color'],principled.inputs['Base Color'])
 rough=n.new('ShaderNodeTexImage');rough.name='Authored surface roughness';rough.image=texture(key,'rough','Non-Color');rough.extension='REPEAT';links.new(rough.outputs['Color'],principled.inputs['Roughness'])
 if key in ('hangar','roof','concrete','stone','airframe','darkmetal'):
  normal=n.new('ShaderNodeTexImage');normal.name='Baked surface relief';normal.image=texture(key,'normal','Non-Color');normal.extension='REPEAT'
  nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.30 if key=='airframe' else (.65 if key in ('hangar','roof') else .45)
  links.new(normal.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],principled.inputs['Normal'])
 print('TEXTURED MATERIAL',m.name,'using',key)
# Consistent planal (per-loop) UV coordinates based on polygon normal; avoids 1k object smart-unwrap.
# Repeat .jpg materials at sensible real-world texel size; decal geometry uses explicit atlas UVs.
for ob in bpy.data.objects:
 if ob.type!='MESH':continue
 mesh=ob.data
 if not mesh.polygons:continue
 uv=mesh.uv_layers.active or mesh.uv_layers.new(name='Physical material UV')
 # Stable local-coordinate planar projection per mesh face.
 for face in mesh.polygons:
  normal=face.normal
  mode=max(range(3),key=lambda i:abs(normal[i]))
  for loop_id in face.loop_indices:
   co=mesh.vertices[mesh.loops[loop_id].vertex_index].co
   if mode==2:uv.data[loop_id].uv=((co.x+.5)*.18,(co.y+.5)*.18)
   elif mode==0:uv.data[loop_id].uv=((co.y+.5)*.16,(co.z+.5)*.16)
   else:uv.data[loop_id].uv=((co.x+.5)*.16,(co.z+.5)*.16)
# Detailed vector decals rendered by actual Inkscape CLI.
atlas=bpy.data.images.load(str(TEX/'aeronaut_decals.png'),check_existing=True);atlas.pack()
decal=bpy.data.materials.new('AERONAUT / Inkscape vector decals');decal.use_nodes=True
nodes=decal.node_tree.nodes;principled=nodes.get('Principled BSDF')
color=nodes.new('ShaderNodeTexImage');color.image=atlas;color.interpolation='Linear'
decal.node_tree.links.new(color.outputs['Color'],principled.inputs['Base Color'])
decal.node_tree.links.new(color.outputs['Alpha'],principled.inputs['Alpha'])
principled.inputs['Metallic'].default_value=.05;principled.inputs['Roughness'].default_value=.54
decal.surface_render_method='DITHERED'
# Selection: atlas image quadrants bottom-left UV origin; inset 1px to prevent sampling bleeding.
REGIONS={'roundel':(.003,.503,.497,.997),'stencil':(.503,.503,.997,.997),'hangar':(.003,.003,.497,.497),'fuel':(.503,.003,.997,.497)}
def quad(name,origin,uvec,vvec,kind,root):
 origin=Vector(origin);U=Vector(uvec);V=Vector(vvec)
 verts=[origin-U*.5-V*.5,origin+U*.5-V*.5,origin+U*.5+V*.5,origin-U*.5+V*.5]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[[0,1,2,3]]);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(decal);ob.parent=root
 uv=mesh.uv_layers.new(name='Decal atlas UV');umin,vmin,umax,vmax=REGIONS[kind]
 for lid,pair in enumerate(((umin,vmin),(umax,vmin),(umax,vmax),(umin,vmax))):uv.data[lid].uv=pair
 return ob
jet=bpy.data.objects.get('KESTREL');assert jet
# Roundels on wings where the top surface is visible in chase camera.
for side in [-1,1]:
 quad(f'Inkscape Kestrel wing insignia {side}',(side*4,-1.1,.257),(side*2.15,0,0),(0,2.15,0),'roundel',jet)
# Matte top fuselage serial aft canopy, forward of dorsal tail.
quad('AERONAUT aircraft serial', (0,-4.25,1.06),(1.05,0,0),(0,1.12,0),'stencil',jet)
kit=bpy.data.objects.get('AIRFIELD_KIT');assert kit
hangar=bpy.data.objects.get('Hangar');tank=bpy.data.objects.get('FuelTank');ops=bpy.data.objects.get('Operations')
assert hangar and tank and ops
quad('Hangar 07 / air operations signage',(0,49.73,16.4),(22,0,0),(0,0,12),'hangar',hangar)
quad('Hangar side insignia',(-41.6,5,16.7),(0,-15,0),(0,0,14),'hangar',hangar)
quad('Hazard / JP8 fuel warning',(0,-5.79,5.7),(4.3,0,0),(0,0,4.3),'fuel',tank)
quad('Ops tactical placard',(0,-16.32,12.3),(8.5,0,0),(0,0,5.5),'stencil',ops)
# Export exactly matching existing filenames / source node hierarchy.
def export(root,file):
 bpy.ops.object.select_all(action='DESELECT')
 objs=[root]+list(root.children_recursive)
 for o in objs:o.hide_set(False);o.hide_render=False;o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=False,export_materials='EXPORT',export_yup=True)
 print('GLB EXPORTED',file,(OUT/file).stat().st_size,'objects',len(objs))
 bpy.ops.object.select_all(action='DESELECT')
for name,file in [('KESTREL','kestrel-hd.glb'),('SKUA_UAV','skua-drone-hd.glb'),('RAZOR9_IR','razor9-missile-hd.glb'),('AIRFIELD_KIT','airfield-kit-hd.glb')]:export(bpy.data.objects[name],file)
for ob in bpy.data.objects:ob.hide_set(False);ob.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'aeronaut-assets.blend'))
print('TEXTURE AND MATERIAL PASS COMPLETE: packed editable .blend and four textured GLBs')
