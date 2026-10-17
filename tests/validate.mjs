import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),main=read('main.js'),world=read('world.js'),sim=read('sim.js'),css=read('styles.css'),audio=read('audio.js');
for(const f of ['main.js','sim.js','world.js','assets/mark.svg','assets/concrete.svg','tools/build-kestrel.py','tools/aeronaut-soundbank.csd'])assert(fs.existsSync(new URL('../'+f,import.meta.url)),'missing '+f);
for(const id of [...main.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1])){
 assert(html.includes('id="'+id+'"'), 'UI element missing in index.html: '+id);
}
assert(html.includes('three@0.168.0'),'pinned Three.js importmap missing');
for(const token of ['updateFlight','targetSolution','fireMissile','updateMissiles','MASS=10600','dynamic*WING*cl','flight.gear','flight.flaps'])assert(sim.includes(token),'simulation missing '+token);
for(const token of ['buildKestrel','new THREE.PlaneGeometry','function height','assets/concrete.svg'])assert(world.includes(token),'world missing '+token);
for(const token of ['flight-data','radar-panel','weapons-panel','overlay','@media(max-width:820px)'])assert(css.includes(token),'interface missing '+token);
// Depth precision and runway intersection regressions.
assert(world.includes('logarithmicDepthBuffer:true'),'log-depth buffer must remain enabled for distant terrain');
assert(/PerspectiveCamera\(69,innerWidth\/innerHeight,\.6,26000\)/.test(world),'camera clip planes reverted');
assert(world.includes('runwayPaint.polygonOffset=true'),'runway striping must have depth bias');
assert(world.includes('box(airport,171,.10,55,taxiConcrete,121,.135,560)'),'taxi link no longer outside runway');
{
 const runwayRightEdge=65/2;
 const taxiLeftEdge=121-171/2;
 assert(taxiLeftEdge>runwayRightEdge,'taxi meshes overlap runway pavement in plan view');
 const runwayTop=.065+.10/2,markingBottom=.14-.012/2;
 assert(markingBottom>runwayTop,'runway striping must sit above runway surface');
}
assert(world.includes('for(let i=0;i<22;i++)'),'cloud ribbon reduction regressed');
assert(html.includes('id="hudModeButton"')&&html.includes('hud hidden compact'),'compact HUD default control missing');
assert(main.includes("caution.dataset.warning=warning"),'single priority annunciator missing');
assert(main.includes("e.code==='F2'"),'HUD toggle hotkey missing');
assert(css.includes('.hud.compact .mission-panel')&&css.includes('.alerts.active'),'declutter styles missing');
// GeneralUser GS v2.0.3 asset and Web Audio integration regression checks.
assert(main.includes("import {sound} from './audio.js'"), 'Web Audio bank must be connected to flight controls');
assert(!main.includes('const sound={'),'Old standalone oscillator-only audio engine reintroduced');
for(const entry of ['engine-core','afterburner','air-rush','contact-select','seeker-lock',
                    'gear-action','missile-launch','impact','caution','mission-clear']){
 const file=new URL('../assets/audio/'+entry+'.ogg', import.meta.url);
 assert(fs.existsSync(file),'Missing GeneralUser audio sample '+entry);
 const b=fs.readFileSync(file);
 assert(b.toString('ascii',0,4)==='OggS','Not an Ogg file: '+entry);
 assert(b.byteLength>5000,'Suspiciously small SF2 sample: '+entry);
 assert(b.byteLength<200000,'Excessively large GitHub Pages sample: '+entry);
 assert(audio.includes("'"+entry+"'"),'Audio bank missing cue: '+entry);
}
assert(audio.includes('decodeAudioData')&&audio.includes('new URL('),'Audio must load assets relative to the deployed module');
assert(audio.includes('playbackRate.setTargetAtTime')&&audio.includes('filter.frequency.setTargetAtTime'),'Engine sample layers must respond to flight');
assert(audio.includes('this.makeFallback()'),'Procedural fallback should remain for unsupported browsers');
assert(sim.includes('effects.complete()')&&sim.includes('effects.gear()'),'Mission and gear sound triggers not connected');
assert(html.includes('Toggle sound'),'Help must document mute action');
assert(fs.existsSync(new URL('../tools/render-generaluser.py',import.meta.url)),'SF2 renderer source missing');
assert(fs.existsSync(new URL('../assets/audio/README.md',import.meta.url)),'SoundFont attribution missing');
// Real Blender model exports are runtime assets — verify the GLB containers and node contracts.
const models=read('models.js');
assert(html.includes('three/addons/'), 'Missing GLTFLoader import map');
assert(world.includes("import {loadBlenderModels} from './models.js'"),'World must load real Blender kit');
assert(world.includes('modelLoadStatus=loadBlenderModels'), 'Blender art not integrated into the scene');
assert(models.includes('new GLTFLoader()')&&models.includes('loadAsync'),'GLB loading must happen at runtime');
assert(models.includes('fallbackStructures.visible=false'),'Legacy buildings must hide after Blender kit loads');
assert(models.includes("source.getObjectByName('Gear')"),'Landing gear attachment not integrated');
assert(models.includes('aircraft.userData.flames=flames'),'Afterburner attach points not integrated');
assert(sim.includes('f.traverse(o=>'),'Blender flame groups not compatible with flight simulation');
const expected={
 'kestrel-hd.glb':['KESTREL','Gear','Store_0','Store_1','Store_2','Store_3','Flame_L','Flame_R'],
 'skua-drone-hd.glb':['SKUA_UAV'],
 'razor9-missile-hd.glb':['RAZOR9_IR'],
 'airfield-kit-hd.glb':['AIRFIELD_KIT','Hangar','Tower','Operations','FuelTank','RadarStation','ServiceCart','EquipmentPallet','PAPI','TaxiSign','Rock','Conifer','Bush']
};
for(const [filename,names] of Object.entries(expected)){
 const buffer=fs.readFileSync(new URL('../assets/models/'+filename, import.meta.url));
 assert.equal(buffer.toString('ascii',0,4),'glTF', 'invalid GLB signature: '+filename);
 assert.equal(buffer.readUInt32LE(4),2,'not glTF 2.0: '+filename);
 assert.equal(buffer.readUInt32LE(8),buffer.length,'GLB byte length mismatch: '+filename);
 assert.equal(buffer.toString('ascii',16,20),'JSON','first GLB chunk must be JSON: '+filename);
 const jsonLength=buffer.readUInt32LE(12);
 const scene=JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8'));
 const namesPresent=new Set(scene.nodes.map(n=>n.name||''));
 for(const name of names)assert(namesPresent.has(name),filename+' missing Blender object '+name);
 assert((scene.meshes||[]).length>8,filename+' appears to contain placeholder geometry');
}
assert(fs.existsSync(new URL('../assets/models/aeronaut-assets.blend',import.meta.url)),'Editable Blender source missing');
assert(fs.existsSync(new URL('../tools/build-model-library.py',import.meta.url)),'Reproducible Blender generator missing');
// v0.3: material maps and vector decals must be live in the shipped GLBs.
let textured=0, withDecals=0;
for (const filename of ['kestrel-hd.glb','skua-drone-hd.glb','razor9-missile-hd.glb','airfield-kit-hd.glb']) {
 const buffer=fs.readFileSync(new URL('../assets/models/'+filename,import.meta.url));
 const jsonLength=buffer.readUInt32LE(12);
 const obj=JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8'));
 assert((obj.images||[]).length>=2,filename+' lacks embedded material images');
 assert((obj.textures||[]).length>=2,filename+' lacks glTF texture objects');
 assert(obj.meshes.every(mesh=>mesh.primitives.some(p=>'TEXCOORD_0' in p.attributes)),filename+' has unwrapped geometry');
 assert(obj.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),filename+' has no PBR color texture');
 const names=obj.materials.map(m=>m.name||'');
 if(names.some(n=>n.includes('Inkscape vector decals')))withDecals++;
 textured++;
}
assert.equal(textured,4,'all four production GLBs must contain authored materials');
assert(withDecals>=2,'aircraft and airfield must carry decal atlas');
for(const path of ['assets/materials/texture-sources.zip.part01','assets/materials/texture-sources.zip.part02','assets/materials/README.md',
                   'tools/apply-materials.py','docs/previews/jet-material-pass.png','docs/previews/airfield-material-pass.png']) {
 assert(fs.existsSync(new URL('../'+path,import.meta.url)),'Missing authored material source: '+path);
}
const zipStart=fs.readFileSync(new URL('../assets/materials/texture-sources.zip.part01',import.meta.url));
assert.equal(zipStart.toString('ascii',0,2),'PK','Source materials must be a ZIP archive');
assert(zipStart.length>500_000,'Missing Krita layers, SVG decals or material maps');
const materialScript=fs.readFileSync(new URL('../tools/apply-materials.py',import.meta.url),'utf8');
assert(materialScript.includes("texture-sources.zip.part0"),'Blender rebuild must reassemble source archive');
assert(materialScript.includes('authored')||materialScript.includes('Authored'),'Blender material source integration missing');
console.log('AERONAUT validation passed: physics, GeneralUser audio, UV-mapped textured Blender GLBs, decals and source artwork.');
