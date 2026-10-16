"""AERONAUT F-27 Kestrel source-model generator.
Run: blender --background --python tools/build-kestrel.py
Exports build/kestrel.blend and build/kestrel.glb.
Designed in Blender's X/right, Y/longitudinal (-Y nose), Z/up coordinates.
"""
import bpy, math, pathlib
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
root=pathlib.Path(__file__).resolve().parents[1]
out=root/"build"
out.mkdir(parents=True,exist_ok=True)

def material(name,color,metal=.3,rough=.5,alpha=1):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,alpha);m.use_nodes=True
 principled=m.node_tree.nodes.get("Principled BSDF")
 principled.inputs["Base Color"].default_value=(*color,alpha)
 principled.inputs["Metallic"].default_value=metal
 principled.inputs["Roughness"].default_value=rough
 return m
hull=material("Titanium grey / ceramic coating",(.34,.44,.49),.65,.38)
panel=material("Dark avionics graphite",(.075,.13,.17),.5,.48)
leading=material("Brushed nickel leading edges",(.64,.74,.77),.78,.27)
canopy=material("Blue smoked canopy",(.026,.18,.24),.35,.16,.62)
tire=material("Vulcanized carbon",(.025,.031,.033),.05,.89)
white=material("RAZOR-9 composite casing",(.74,.8,.78),.32,.45)
red=material("Flight surface insignia",(.56,.16,.10),.34,.45)

def mesh(name,verts,faces,mat):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 obj=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
 for p in m.polygons:p.use_smooth=True
 modifier=obj.modifiers.new("Weighted normals","WEIGHTED_NORMAL")
 return obj

rings=[(-11,.05,.06),(-9.5,.36,.32),(-7,.68,.63),(-4,1.03,.80),(0,1.14,.86),(3.3,1.06,.80),(6.7,.78,.67),(9.1,.72,.66),(11.1,.3,.33)]
segments=24
verts=[]
for longitudinal,rx,rz in rings:
 for j in range(segments):
  a=2*math.pi*j/segments
  verts.append((math.cos(a)*rx,longitudinal,math.sin(a)*rz))
faces=[]
for r in range(len(rings)-1):
 for j in range(segments):
  a=r*segments+j;b=r*segments+(j+1)%segments;c=(r+1)*segments+j;d=(r+1)*segments+(j+1)%segments
  faces.append((a,c,d,b))
faces.extend([tuple(reversed(tuple(range(segments)))),tuple(range((len(rings)-1)*segments,len(rings)*segments))])
mesh("F27 / Continuous lofted fuselage",verts,faces,hull)

def slab(name,pts,z,thickness,mat):
 n=len(pts)
 verts=[(x,y,z-thickness*.5) for x,y in pts]+[(x,y,z+thickness*.5) for x,y in pts]
 faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
 for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
 return mesh(name,verts,faces,mat)

for side in (-1,1):
 wing=[(0,-3.5),(side*1.8,-2.8),(side*7.95,1.95),(side*8.28,2.65),(side*5.9,2.47),(side*2.25,2.1),(side*.8,2.2)]
 slab("Swept clipped-delta wing "+str(side),wing,0,.18,hull)
 stab=[(side*.7,5.7),(side*1.5,5.5),(side*4.4,8.15),(side*4.3,8.6),(side*1.35,8.05)]
 slab("All-moving horizontal tail "+str(side),stab,0,.12,hull)
 slab("Wingtip red ID "+str(side),[(side*5.9,2.3),(side*7.4,2.3),(side*7.4,2.42)],.11,.03,red)
 for station in (3.55,5.55):
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.14,depth=2.5,location=(side*station,1.2,-.59))
  obj=bpy.context.object;obj.name="RAZOR-9 / "+str(side*station);obj.rotation_euler[0]=math.pi/2;obj.data.materials.append(white)
  bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.14,radius2=0,depth=.45,location=(side*station,-.2,-.59))
  bpy.context.object.rotation_euler[0]=math.pi/2;bpy.context.object.data.materials.append(leading)

slab("Swept vertical stabilizer",[(0,5.3),(0,7.4),(0,10.1)],.4,.16,panel)
# Canopy: stretched hemisphere with a separate canopy rail.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(0,-4.1,.78))
obj=bpy.context.object;obj.name="Panoramic blue smoke canopy";obj.scale=(.79,2.7,.68);obj.data.materials.append(canopy)

for side in (-1,1):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.48,depth=2.1,location=(side*.47,9.4,-.12))
 obj=bpy.context.object;obj.name="Variable nozzle / engine "+str(side);obj.rotation_euler[0]=math.pi/2;obj.data.materials.append(panel)
for i,(x,y) in enumerate([(-2.15,2),(2.15,2),(0,-6.4)]):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.40,depth=.34,location=(x,y,-1.8))
 obj=bpy.context.object;obj.name="Landing wheel "+str(i);obj.rotation_euler[1]=math.pi/2;obj.data.materials.append(tire)
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.10,depth=1.2,location=(x,y,-1.12))
 bpy.context.object.data.materials.append(leading)

bpy.ops.wm.save_as_mainfile(filepath=str(out/"kestrel.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"kestrel.glb"),export_format='GLB',export_apply=True)
print("AERONAUT aircraft: exported Blender source and GLB to",out)
