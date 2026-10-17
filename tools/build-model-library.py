#!/usr/bin/env python3
"""AERONAUT v0.2 / authored Blender asset kit. Blender 5.x headless.

Blender axes: X right, Y forward (gltf Three.js -Z), Z up.
Exports distinct browser-ready GLBs and an editable multi-scene .blend kit.
    blender -b -t 4 --python tools/build-model-library.py
"""
import bpy, math, os, random
from mathutils import Vector
from pathlib import Path
random.seed(93)
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets/models';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials,):
    for b in list(datablocks):datablocks.remove(b)

def mat(name,hexcolor,metal=0,rough=.7,alpha=1,emissive=0):
    h=hexcolor.lstrip('#'); rgb=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,alpha);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,alpha)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emissive:bs.inputs['Emission Color'].default_value=(*rgb,1);bs.inputs['Emission Strength'].default_value=emissive
    if alpha<1:bs.inputs['Alpha'].default_value=alpha;m.surface_render_method='DITHERED'
    return m
M={
 'steel':mat('F-27 | ceramic light grey','#9ba8ab',.57,.41),
 'wing':mat('F-27 | graphite coated wings','#7c8b94',.62,.39),
 'dark':mat('Rubberized graphite','#293841',.22,.69),
 'trim':mat('Satin titanium','#c1cbd0',.83,.29),
 'shadow':mat('Recessed anodized steel','#111f2a',.52,.55),
 'intake':mat('Intake cavity | black','#101d23',.34,.72),
 'glass':mat('Canopy | smoked sapphire','#174156',.41,.15,.66),
 'glass2':mat('Tower | blue reflective glazing','#2e687a',.39,.19),
 'glowblue':mat('Cool blue marker light','#5cdeef',.1,.29,1,2.5),
 'glowred':mat('Navigation red light','#fa5844',.1,.31,1,2.5),
 'glowgreen':mat('Navigation green light','#43edb3',.1,.31,1,2.5),
 'white':mat('White paint / enamel','#d8e3df',.08,.57),
 'mark':mat('F-27 | blue tactical marker','#26829d',.15,.5),
 'yellow':mat('Airport safety yellow','#dea94f',.13,.65),
 'orange':mat('Rescue / caution orange','#d77d32',.13,.67),
 'concrete':mat('Clad concrete','#889292',.04,.84),
 'roof':mat('Dark blue coated zinc roof','#415963',.43,.63),
 'hangar':mat('Aircraft hangar steel panelling','#66797e',.25,.71),
 'glass_dark':mat('Black window recess','#182e36',.29,.35),
 'green':mat('Ground service olive','#577e63',.18,.77),
 'rubber':mat('Aircraft tyres / carbon rubber','#182329',.02,.86),
 'earth':mat('Flat earth','#6e7964',.02,.94),
 'silver':mat('Hydraulic polished chrome','#b4bfc7',.92,.2),
 'flame':mat('Blue afterburner core','#3dbbff',.1,.25,.34,2),
}

def parent(obj,root):obj.parent=root;return obj

def root(name):
    ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob);return ob

def cube(name,loc,scale,material,par=None,bev=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);ob=bpy.context.object;ob.name=name
    ob.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material)
    if bev:
        mod=ob.modifiers.new('Machined edge radius','BEVEL');mod.width=bev;mod.segments=2
        mod.affect='EDGES'
        ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    if par:parent(ob,par)
    return ob

def cyl(name,loc,radius,depth,material,par=None,vertices=20,axis='Z',r2=None):
    if r2 is None:bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    else:bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=r2,depth=depth,location=loc)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(material)
    if axis=='Y':ob.rotation_euler.x=math.pi/2
    if axis=='X':ob.rotation_euler.y=math.pi/2
    if par:parent(ob,par)
    return ob

def torus(name,loc,major,minor,material,par=None,axis='Y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=loc,major_radius=major,minor_radius=minor)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(material)
    if axis=='Y':ob.rotation_euler.x=math.pi/2
    if par:parent(ob,par)
    return ob

def sphere(name,loc,scale,material,par=None,seg=18,rings=9):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc)
    ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    if par:parent(ob,par)
    return ob

def extruded(name,pts,z0,z1,material,par=None):
    n=len(pts);verts=[(x,y,z0) for x,y in pts]+[(x,y,z1) for x,y in pts]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    if par:parent(ob,par)
    return ob

def tube(name,points,radius,material,par=None):
    crv=bpy.data.curves.new(name,'CURVE');crv.dimensions='3D';crv.resolution_u=2;crv.bevel_resolution=2;crv.bevel_depth=radius
    poly=crv.splines.new('POLY');poly.points.add(len(points)-1)
    for p,co in zip(poly.points,points):p.co=(*co,1)
    ob=bpy.data.objects.new(name,crv);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
    if par:parent(ob,par)
    return ob

def text(name,txt,loc,size,material,par=None,rotation=(math.pi/2,0,0)):
    curve=bpy.data.curves.new(name,'FONT');curve.body=txt;curve.size=size;curve.extrude=.001
    ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=rotation;ob.data.materials.append(material)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    bpy.ops.object.convert(target='MESH');ob.select_set(False)
    if par:parent(ob,par)
    return ob

def export(which,filename):
    bpy.ops.object.select_all(action='DESELECT')
    nodes=[which]+list(which.children_recursive)
    for ob in nodes:ob.select_set(True)
    bpy.context.view_layer.objects.active=which
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_apply=False,export_materials='EXPORT',export_yup=True)
    print('EXPORTED',filename,os.stat(OUT/filename).st_size,'bytes',len(nodes),'objects')
    for ob in nodes:ob.hide_render=True;ob.hide_set(True)

# HERO AIRCRAFT -----------------------------------------------------
jet=root('KESTREL');rings=[(11.2,.03,.04,.04),(9.5,.20,.24,.0),(6.9,.62,.58,.04),(3.3,.95,.87,.11),(.0,1.17,.94,.06),(-3.3,1.11,.84,.03),(-6.2,.9,.77,-.02),(-9.25,.71,.61,-.08),(-10.8,.54,.55,-.08)]
steps=32;vertices=[]
for y,rx,rz,cz in rings:
 for i in range(steps):
  a=i*2*math.pi/steps;vertices.append((math.cos(a)*rx,y,math.sin(a)*rz+cz))
faces=[]
for k in range(len(rings)-1):
 for j in range(steps):a=k*steps+j;b=k*steps+(j+1)%steps;c=a+steps;d=b+steps;faces.append((a,b,d,c))
faces.append(tuple(range(steps-1,-1,-1)));faces.append(tuple(range((len(rings)-1)*steps,len(rings)*steps)))
mesh=bpy.data.meshes.new('Fuselage / aerodynamic loft');mesh.from_pydata(vertices,[],faces);mesh.update()
body=bpy.data.objects.new('Sculpted F27 fuselage',mesh);bpy.context.collection.objects.link(body);body.data.materials.append(M['steel']);parent(body,jet)
for face in body.data.polygons:face.use_smooth=True
cyl('Carbon black radome',(0,9.9,.04),.24,2.15,M['dark'],jet,24,'Y',.01)
for side in (-1,1):
 S=side
 wingpts=[(.45*S,2.75),(2.1*S,2.4),(7.95*S,-.18),(8.3*S,-1.0),(5.7*S,-2.15),(1.7*S,-3.65),(.50*S,-3.6)]
 extruded('Machined delta wing %s'%S,wingpts,-.10,.16,M['wing'],jet)
 extruded('Wing root reinforcement %s'%S,[(.6*S,1.8),(2.3*S,1.25),(3*S,.8),(.7*S,.95)],.16,.19,M['steel'],jet)
 extruded('Leading edge slat %s'%S,[(1.6*S,2.38),(7.75*S,-.16),(7.61*S,-.30),(1.52*S,2.16)],.17,.20,M['trim'],jet)
 extruded('Aileron panel %s'%S,[(5.35*S,-1.96),(7.92*S,-.92),(7.65*S,-1.30),(5.30*S,-2.12)],.16,.185,M['steel'],jet)
 extruded('Flap panel %s'%S,[(1.92*S,-3.4),(5.25*S,-2.11),(5.15*S,-2.26),(1.97*S,-3.56)],.16,.19,M['dark'],jet)
 extruded('Elevator %s'%S,[(.75*S,-5.55),(1.62*S,-5.67),(4.14*S,-7.5),(4.0*S,-8.18),(1.4*S,-7.95)],-.02,.15,M['wing'],jet)
 extruded('Elevator trailing inset %s'%S,[(2.9*S,-7.65),(4.05*S,-8.08),(3.91*S,-8.27),(2.8*S,-7.86)],.15,.18,M['dark'],jet)
 # lateral details
 cube('Wingtip lighting nacelle %s'%S,(8.17*S,-.84,.03),(.33,.33,.17),M['dark'],jet,.05)
 sphere('Tip nav marker %s'%S,(8.28*S,-.78,.03),(.11,.16,.10),M['glowgreen' if S==1 else 'glowred'],jet)
 # inlet cavity + ramp vanes
 cube('Deep rectangular intake %s'%S,(1.15*S,.15,-.23),(.60,1.75,.63),M['intake'],jet,.08)
 cube('Intake upper fairing %s'%S,(1.21*S,.35,.24),(.95,2.20,.12),M['steel'],jet,.09)
 cube('Intake splitter %s'%S,(.85*S,.55,-.18),(.09,2.2,.64),M['trim'],jet,.03)
 # engine / port and stbd exhaust detail
 cyl('Turbine sleeve %s'%S,(.48*S,-9.9,-.15),.52,2.5,M['dark'],jet,32,'Y')
 torus('Titanium iris nozzle rim %s'%S,(.48*S,-11.12,-.15),.46,.092,M['trim'],jet)
 for n in range(12):
  a=n*2*math.pi/12;cube('Nozzle petal %s %02d'%(S,n),(.48*S+math.cos(a)*.44,-11.16,-.15+math.sin(a)*.44),(.13,.6,.06),M['wing'],jet,.015)
 cyl('Deep exhaust interior %s'%S,(.48*S,-11.15,-.15),.32,.05,M['shadow'],jet,28,'Y')
 fl=root('Flame_%s'%('L' if S<0 else 'R'));parent(fl,jet)
 cyl('Exhaust core %s'%S,(.48*S,-11.64,-.15),.15,.95,M['flame'],fl,12,'Y',.27)
 # gear wells
 cube('Retracted wheel door %s'%S,(2.08*S,-1.44,-.20),(.78,1.4,.12),M['dark'],jet,.07)
 # Hardpoint pylons in explicit order aligned with runtime asset stations
 for a in (3.55,5.55):
  rootStore=root('Store_%d'%len([o for o in jet.children if o.name.startswith('Store_')]))
  rootStore.location=(a*S,1.0 if a<5 else .8,-.28);parent(rootStore,jet)
  cube('Pylon fairing',(.0,0,-.24),(.31,1.03,.52),M['dark'],rootStore,.05)
  cyl('Missile body',(0,.2,-.66),.17,2.55,M['white'],rootStore,16,'Y')
  cyl('IR dome',(0,1.64,-.66),.17,.35,M['dark'],rootStore,16,'Y',.01)
  for sign in (-1,1):
   extruded('Canard %d'%sign,[(0,.68),(.48*sign,.44),(.45*sign,.28),(0,.42)],-.68,-.65,M['trim'],rootStore)
   extruded('Fin %d'%sign,[(0,-.78),(.53*sign,-1.17),(.54*sign,-1.29),(0,-1.10)],-.68,-.65,M['wing'],rootStore)
# Vertical fin deliberately modeled as vertical mesh (not projected onto plane)
vmesh=bpy.data.meshes.new('Fin / swept vertical');vmesh.from_pydata([(0,-5.1,.48),(0,-7.0,3.65),(0,-9.5,.57),(.20,-5.1,.48),(.17,-7.0,3.65),(.2,-9.5,.57)],[],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);vmesh.update()
vfin=bpy.data.objects.new('Swept single tail fin',vmesh);bpy.context.collection.objects.link(vfin);vfin.data.materials.append(M['wing']);parent(vfin,jet)
extruded('Fin dorsal transition',[(0,-4.7),(.75,-5.8),(.53,-8.5)],.6,.69,M['steel'],jet)
cube('Fin marker',(0,-7.65,2.05),(.24,1.04,.16),M['mark'],jet,.02)
# Canopy shape with multiple concentric fairings, rim and framing
sphere('Panoramic fighter canopy',(0,4.08,.78),(.78,2.60,.63),M['glass'],jet,32,16)
tube('Canopy side rail port',[(-.75,1.85,.78),(-.79,3.55,.97),(-.64,5.25,.86),(-.35,6.35,.52)],.055,M['shadow'],jet)
tube('Canopy side rail starboard',[(.75,1.85,.78),(.79,3.55,.97),(.64,5.25,.86),(.35,6.35,.52)],.055,M['shadow'],jet)
tube('Canopy aft frame',[(-.78,1.96,.82),(0,1.92,1.40),(.78,1.96,.82)],.065,M['trim'],jet)
tube('Canopy center bow',[(-.75,3.55,.94),(0,3.55,1.38),(.75,3.55,.94)],.048,M['shadow'],jet)
cube('Canopy aft spine',(0,1.4,.79),(1.32,1.22,.2),M['steel'],jet,.12)
# panel details and subtle rivet track
for side in (-1,1):
 for j in range(6):
  cube('Fuselage vent row %s %s'%(side,j),(.84*side,-.35-j*.29,.64),(.04,.16,.045),M['shadow'],jet,.01)
 extruded('Forward service panel %s'%side,[(1.5*side,.45),(2.05*side,.65),(2.35*side,.45),(1.74*side,.29)],.168,.177,M['dark'],jet)
# pitot + blade antenna
tube('Nose pitot',[(0,11.1,.03),(0,11.72,.03)],.028,M['trim'],jet)
cube('IFF dorsal blade',(0,-3.0,1.02),(.08,.55,.33),M['dark'],jet,.014)
# Detailed gear bogies in own root
landing=root('Gear');parent(landing,jet)
for i,(x,y) in enumerate([(-2.1,-1.55),(2.1,-1.55),(0,7.0)]):
 cyl('Hydraulic strut %d'%i,(x,y,-1.12),.095,1.2,M['silver'],landing,12)
 cyl('Shock housing %d'%i,(x,y,-1.4),.145,.6,M['dark'],landing,12)
 cyl('Rubber wheel %d'%i,(x,y,-1.83),.43,.30,M['rubber'],landing,20,'X')
 cyl('Brushed hub %d'%i,(x,y,-1.83),.195,.325,M['trim'],landing,16,'X')
 cube('Landing fork %d'%i,(x,y,-1.53),(.11,.54,.12),M['dark'],landing,.02)
export(jet,'kestrel-hd.glb')

# TARGET UAV -------------------------------------------------------
drone=root('SKUA_UAV')
for y,rx,rz in [(4.0,.01,.03),(3,.26,.20),(.7,.48,.37),(-2.4,.47,.33),(-4.0,.28,.21)]:
 pass
sphere('Faceted drone composite fuselage',(0,0,.0),(.51,4.1,.36),M['dark'],drone,14,8)
extruded('Left UAV swept wing',[(0,2.4),(-.95,1.95),(-5.5,-.88),(-5.7,-1.35),(-2.45,-1.12),(-.5,-2.0)],-.12,.05,M['wing'],drone)
extruded('Right UAV swept wing',[(0,2.4),(.95,1.95),(5.5,-.88),(5.7,-1.35),(2.45,-1.12),(.5,-2.0)],-.12,.05,M['wing'],drone)
for sign in (-1,1):
 extruded('UAV angular tail %d'%sign,[(sign*.45,-2.25),(sign*2.18,-3.52),(sign*2.22,-3.95),(sign*.43,-3.34)],-.02,.16,M['dark'],drone)
 cube('UAV wing accent %d'%sign,(sign*3.55,-.52,.07),(1.4,.22,.026),M['mark'],drone,.01)
 cyl('Gimbaled sensor fairing %d'%sign,(sign*.42,2.3,-.1),.16,.56,M['trim'],drone,12,'Y')
cube('UAV dorsal avionics bay',(0,-.65,.39),(.72,2.05,.12),M['glass_dark'],drone,.08)
cyl('Ducted rear motor',(0,-3.87,.04),.36,.38,M['trim'],drone,24,'Y')
cyl('Motor black thrust opening',(0,-4.12,.04),.27,.03,M['shadow'],drone,22,'Y')
for sign in (-1,1):
 cube('Target designation paint %d'%sign,(sign*1.15,-1.10,.09),(.32,.60,.026),M['white'],drone,.01)
export(drone,'skua-drone-hd.glb')

# MISSILE ---------------------------------------------------------
missile=root('RAZOR9_IR')
cyl('RAZOR-9 motor casing',(0,0,0),.14,2.75,M['white'],missile,20,'Y')
cyl('RAZOR-9 ceramic IR seeker',(0,1.52,0),.145,.49,M['dark'],missile,20,'Y',.01)
cyl('Seeker collar',(0,1.30,0),.15,.12,M['trim'],missile,20,'Y')
cyl('Motor nozzle',(0,-1.44,0),.14,.19,M['dark'],missile,20,'Y')
cyl('Nozzle throat',(0,-1.56,0),.086,.03,M['shadow'],missile,16,'Y')
for k in range(4):
 a=k*math.pi/2
 # fin in local X/Y, rotate assembly around Y to make true radial set
 ob=extruded('Rear cruciform fin %s'%k,[(0,-.81),(.43,-1.03),(.42,-1.42),(0,-1.28)],-.023,.023,M['wing'],missile);ob.rotation_euler.y=a
 ob2=extruded('Forward canard %s'%k,[(0,.7),(.23,.58),(.21,.18),(0,.31)],-.018,.018,M['trim'],missile);ob2.rotation_euler.y=a
for y in (-.70,-.43,.94):torus('Casing index / joint',(0,y,0),.14,.009,M['mark'],missile)
export(missile,'razor9-missile-hd.glb')

# AIRFIELD KIT ---------------------------------------------------
kit=root('AIRFIELD_KIT')
# all modules parent to named empties; copies in Three.js are cheap

def module(name):r=root(name);parent(r,kit);return r

def child_cylinder(name,loc,r,depth,mt,rt,axis='Z'):return cyl(name,loc,r,depth,mt,rt,20,axis)

hangar=module('Hangar')
cube('Hangar foundation',(0,0,.43),(89,106,.86),M['concrete'],hangar,.12)
cube('Structural prefabricated volume',(0,0,13.7),(81,98,26.6),M['hangar'],hangar,.12)
cube('Angled roof crown',(0,0,28.0),(86,103,3.0),M['roof'],hangar,.25)
# front is positive Y, prominent articulated door
cube('Recessed hangar door',(0,49.16,12.45),(65,.28,22.6),M['shadow'],hangar,.07)
for j in range(1,11):cube('Sliding door seam',(-32.5+j*6.0,49.39,12.45),(.18,.08,22),M['trim'],hangar,.01)
for h in (5.5,11.4,17.3,23.2):cube('Hangar door cross rail',(0,49.47,h),(65,.09,.16),M['wing'],hangar)
for side in (-1,1):
 for i in range(5):
  cube('Exterior hangar buttress',(side*40.9,41-i*20,13),(1.15,1.25,25.6),M['roof'],hangar,.13)
 for z in (4.0,14.5,24.0):
  cube('Airfield hangar fascia stripe',(side*41,0,z),(.09,94,.25),M['trim'],hangar)
 cube('Rooftop vents',(side*20,8,30.7),(8,9,1.4),M['dark'],hangar,.13)
 for j in range(3):cube('Rooftop ventilation grille',(side*20-3+j*3,8,31.46),(.28,7,.05),M['trim'],hangar)
for i in range(8):
 cube('Roof rib',(0,-44+i*12.5,29.68),(83,.35,.12),M['trim'],hangar,.05)
cube('Hangar upper lintel',(0,49.4,26.2),(81,1.1,1.0),M['concrete'],hangar,.09)
text('Hangar code','HANGAR 0 7',(-35,49.65,27.0),2.1,M['white'],hangar,rotation=(math.pi/2,0,0))

# Tower center at 0; position during runtime
tower=module('Tower')
cube('Octagonal concrete base',(0,0,3.1),(21,21,6.2),M['concrete'],tower,.6)
cyl('Tower pedestal shaft',(0,0,35),5.3,66,M['concrete'],tower,8)
cyl('Tower collar',(0,0,68.9),8.0,1.8,M['roof'],tower,8)
cyl('360-degree glazed controller level',(0,0,73.9),11.3,9.0,M['glass2'],tower,8)
for i in range(8):
 a=i*2*math.pi/8
 cube('Tower vertical mullion',(math.cos(a)*10.72,math.sin(a)*10.72,73.4),(.48,.48,8),M['trim'],tower,.05)
cyl('Tower wide weather roof',(0,0,79.0),12.5,1.6,M['roof'],tower,8)
cyl('Antenna mount',(0,0,81.0),.55,2.5,M['trim'],tower,12)
tube('Radio mast',[(0,0,80),(0,0,96)],.13,M['silver'],tower)
for z in (90,93):tube('Aerial crossbeam',[(0,-2,z),(0,2,z)],.08,M['silver'],tower)
sphere('Red obstruction beacon',(0,0,96.6),(.56,.56,.56),M['glowred'],tower)
cube('Service door',(0,-10.61,2.8),(3.4,.08,4.7),M['dark'],tower,.08)

ops=module('Operations')
cube('Operations center plinth',(0,0,.36),(56,34,.72),M['concrete'],ops,.12)
cube('Operations center shell',(0,0,8.7),(54,32,16.7),M['hangar'],ops,.22)
cube('Clerestory roof',(0,0,17.6),(58,36,2.4),M['roof'],ops,.18)
for side in (-1,1):
 for i in range(7):
  cube('Office ribbon window',(side*27.08,-12+i*4,11.5),(.10,2.6,3.2),M['glass_dark'],ops,.05)
  cube('Facade sunshade',(side*27.23,-12+i*4,13.55),(.55,3.0,.25),M['trim'],ops,.05)
for i in range(8):
 cube('Office south windows',(-20+i*5.5,-16.12,11.5),(3.2,.12,3),M['glass2'],ops,.06)
cube('Office entrance',(0,-16.2,3.4),(6,.2,6.3),M['shadow'],ops,.08)
cube('Office entrance awning',(0,-18,7.2),(9,4,.45),M['roof'],ops,.11)

fuel=module('FuelTank')
cyl('Industrial fuel storage tank',(0,0,5.5),5.6,11,M['white'],fuel,32)
cyl('Storage tank crown',(0,0,11.3),5.76,.65,M['roof'],fuel,32)
torus('Tank mid ring',(0,0,7.2),5.64,.13,M['trim'],fuel,axis='Z')
torus('Tank lower ring',(0,0,2.5),5.64,.13,M['trim'],fuel,axis='Z')
for z in (2.8,5.7,8.6):tube('Service ladder side rail',[(5.65,-.7,z),(5.65,.7,z)],.06,M['silver'],fuel)
for i in range(13):
 z=1.2+i*.75;tube('Tank access ladder rung',[(5.73,-.6,z),(5.73,.6,z)],.045,M['silver'],fuel)

radar=module('RadarStation')
cube('Radar concrete foundation',(0,0,.6),(13,13,1.2),M['concrete'],radar,.15)
cyl('Rotary radar pedestal',(0,0,5),1.8,8,M['roof'],radar,16)
cube('Radar equipment trunk',(0,0,9.0),(4.0,3.7,3.2),M['dark'],radar,.4)
sphere('Hemispheric radar reflector',(0,.8,13.2),(5.3,.5,3.6),M['trim'],radar,24,12)
for x in (-3.7,-1.85,0,1.85,3.7):tube('Reflector vertical ribs',[(x,1.3,11),(x,1.4,15.3-abs(x)*.16)],.06,M['shadow'],radar)
tube('Reflector cross frame',[(-4.7,1.5,12.5),(4.7,1.5,12.5)],.075,M['shadow'],radar)
cyl('Radar receiver',(0,3.5,13.3),.48,3,M['dark'],radar,12,'Y')

service=module('ServiceCart')
cube('Tug equipment carriage',(0,0,1.0),(3.1,5.4,1.9),M['green'],service,.18)
cube('Electric drive cockpit',(0,1.2,2.0),(2.5,2.0,1.5),M['glass_dark'],service,.22)
cube('Tow bumper',(0,-3.2,.6),(2.7,1.3,.35),M['silver'],service,.05)
for x in (-1.5,1.5):
 for y in (-1.65,1.65):
  cyl('Service cart wheel',(x,y,.58),.52,.30,M['rubber'],service,12,'X')
  cyl('Wheel alloy hub',(x*1.08,y,.58),.21,.33,M['trim'],service,12,'X')
cube('Cart orange beacon',(0,1.75,3.0),(.30,.30,.3),M['orange'],service,.1)

crates=module('EquipmentPallet')
cube('Raised cargo pallet',(0,0,.32),(3.0,4.2,.5),M['dark'],crates,.06)
for x in (-.75,.75):
 for y in (-1.0,1.0):
  cube('Maintenance travel crate',(x,y,1.15),(1.28,1.70,1.45),M['green'],crates,.10)
  cube('Crate top catch',(x,y,1.96),(1.11,1.45,.12),M['trim'],crates,.03)

papi=module('PAPI')
cube('Runway VASI equipment',(0,0,.62),(3.5,.9,1.12),M['dark'],papi,.14)
for i in range(4):
 sphere('Precision approach light',(i*.8-1.2,-.47,.69),(.28,.08,.27),M['glowred' if i<2 else 'white'],papi,12,8)

sign=module('TaxiSign')
cube('Taxiway backlit sign',(0,0,1.08),(3.5,.24,1.65),M['yellow'],sign,.09)
cube('Sign black inset',(0,-.135,1.15),(3.18,.04,1.30),M['shadow'],sign,.07)
text('Taxi lettering','B / 36',(-1.35,-.17,.75),.73,M['yellow'],sign,rotation=(math.pi/2,0,0))
for x in (-1.15,1.15):cube('Sign bracket',(x,0,.25),(.12,.15,.48),M['silver'],sign)

# Terrain and taxiway dressing — Blender-authored source meshes.
rock=module('Rock')
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=2.1,location=(0,0,1.3))
r=bpy.context.object;r.name='Weathered fractured rock';r.scale=(1.3,1.1,.73);r.data.materials.append(M['concrete']);parent(r,rock)
for i in range(3):
 cube('Rock fissure facet',(i*.43-.5,-.2,1+i*.32),(.32,1.7,.10),M['earth'],rock,.02)
conifer=module('Conifer')
cyl('Pine trunk',(0,0,3.1),.36,6.2,M['dark'],conifer,9)
for z,r,dep in [(3.1,2.2,4.2),(5.2,1.7,3.9),(7.2,1.08,3.2)]:
 cyl('Conifer canopy crown',(0,0,z),r,dep,M['green'],conifer,9,'Z',0)
bush=module('Bush')
for x,y,z in [(-1.2,0,.8),(0,.7,1.1),(1.15,-.2,.85)]:
 sphere('Low vegetation tuft',(x,y,z),(1.5,1.2,1.1),M['earth'],bush,9,5)

# Export kit; individual modules are named empty transform nodes.
export(kit,'airfield-kit-hd.glb')
# Save entire editable source with all hidden objects restored.
for ob in bpy.data.objects:ob.hide_set(False);ob.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'aeronaut-assets.blend'))
print('AERONAUT Blender library complete')
