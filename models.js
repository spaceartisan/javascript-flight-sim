/* AERONAUT Blender asset integration: authored .blend -> optimized glTF/GLB.
   The models in assets/models are the live rendered geometry, not concept assets.
   Fallback geometry from world.js remains only if a particular model fails to load. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const asset = name => new URL('./assets/models/'+name, import.meta.url).href;
const modelLoader = new GLTFLoader();

function configure(root,{shadow=true}={}){
 root.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=shadow && /fuselage|wing|fin|hangar|tank|tower|office|jet|pedestal|canopy|roof|shaft|drone/i.test(o.name);
  o.receiveShadow=true;
  if(o.material && !Array.isArray(o.material))o.material.side=THREE.FrontSide;
 });
 return root;
}
function loadModel(name){return modelLoader.loadAsync(asset(name));}
function replaceChildren(target,source){
 while(target.children.length)target.remove(target.children[0]);
 target.add(configure(source));
}

export async function loadBlenderModels({scene,airport,aircraft,drones,height,fallbackStructures,onMissile}){
 const result={jet:false,drone:false,missile:false,airfield:false};
 // Each asset is independent. A failed GLB cannot make the core flight sim unplayable.
 const loads=[
  ['jet','kestrel-hd.glb',gltf=>{
   const source=gltf.scene;
   const oldStores=aircraft.userData.stores||[];
   const gearVisible=aircraft.userData.gear?.visible!==false;
   replaceChildren(aircraft,source);
   const gear=source.getObjectByName('Gear');
   if(gear){aircraft.userData.gear=gear;gear.visible=gearVisible}
   const flames=['Flame_L','Flame_R'].map(n=>source.getObjectByName(n)).filter(Boolean);
   flames.forEach(flame=>flame.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial){
     o.material.transparent=true;o.material.opacity=.28;o.material.emissive=new THREE.Color('#238de7');o.material.emissiveIntensity=1.7
   }}));
   aircraft.userData.flames=flames;
   // Visual stores arranged in launch sequence left-inner, right-inner, left-outer, right-outer.
   const storeIds=[0,2,1,3];
   aircraft.userData.stores=storeIds.map((id,i)=>{
    const node=source.getObjectByName('Store_'+id);
    if(node)node.visible=oldStores[i]?.model?.visible!==false;
    return {model:node||new THREE.Group()};
   });
  }],
  ['drone','skua-drone-hd.glb',gltf=>{
   const model=configure(gltf.scene);
   for(const drone of drones){
    replaceChildren(drone.model,model.clone(true));
   }
  }],
  ['missile','razor9-missile-hd.glb',gltf=>{
   onMissile(configure(gltf.scene));
  }],
  ['airfield','airfield-kit-hd.glb',gltf=>{
   const kit=gltf.scene.getObjectByName('AIRFIELD_KIT')||gltf.scene;
   const modules={};
   for(const ob of kit.children)modules[ob.name]=ob;
   const instantiate=(kind,x,z,rotation=0,scale=1)=>{
    if(!modules[kind]){console.warn('Missing Blender kit module',kind);return null}
    const ob=modules[kind].clone(true);
    ob.position.set(x,height(x,z),z);
    ob.rotation.y=rotation;ob.scale.setScalar(scale);
    configure(ob);airport.add(ob);return ob;
   };
   // Airfield / operations campus on eastern side of Sierra runway.
   for(let i=0;i<5;i++)instantiate('Hangar',380,970-i*190);
   instantiate('Tower',585,-85);
   instantiate('Operations',550,-475,Math.PI);
   instantiate('RadarStation',735,-165,.32);
   for(const [x,z] of [[450,-690],[466,-675],[480,-690],[620,930]])instantiate('FuelTank',x,z);
   for(const [x,z,r] of [[274,900,0],[268,650,.4],[300,290,Math.PI],[290,-380,Math.PI],[405,-610,0],[520,-130,1.1]])instantiate('ServiceCart',x,z,r);
   for(const [x,z] of [[255,860],[255,670],[264,488],[340,-450],[535,-535],[590,595]])instantiate('EquipmentPallet',x,z);
   for(const z of [1160,-1150]){instantiate('PAPI',-58,z);instantiate('PAPI',58,z);}
   for(const [x,z] of [[88,560],[91,-380],[200,900],[200,530],[165,-330]])instantiate('TaxiSign',x,z,.15);
   // Sparse authored terrain dressing with intentional airfield clear zones.
   for(let i=0;i<42;i++){
    const theta=i*2.3999632297,rad=1200+((i*191)%4700);
    const x=Math.cos(theta)*rad+1200,z=Math.sin(theta)*rad;
    if(Math.abs(x)<680&&Math.abs(z)<1500)continue;
    instantiate('Conifer',x,z,theta,.8+(i%5)*.10);
   }
   for(let i=0;i<46;i++){
    const theta=i*2.3999632297+.37,rad=890+((i*237)%5100);
    const x=Math.sin(theta)*rad,z=Math.cos(theta)*rad;
    if(Math.abs(x)<600&&Math.abs(z)<1460)continue;
    instantiate('Rock',x,z,theta,.7+(i%6)*.23);
   }
   for(let i=0;i<40;i++){
    const theta=i*2.3999632297+1.12,rad=550+((i*113)%3200);
    const x=Math.sin(theta)*rad,z=Math.cos(theta)*rad;
    if(Math.abs(x)<400&&Math.abs(z)<1350)continue;
    instantiate('Bush',x,z,theta,.66+(i%4)*.16);
   }
   if(fallbackStructures)fallbackStructures.visible=false;
  }]
 ];
 await Promise.all(loads.map(async([key,name,apply])=>{
  try{const gltf=await loadModel(name);apply(gltf);result[key]=true;console.info('[AERONAUT] Blender model loaded:',name)}
  catch(e){console.error('[AERONAUT] GLB unavailable; retained fallback:',name,e)}
 }));
 console.info('[AERONAUT] Blender art integration:',result);
 return result;
}
