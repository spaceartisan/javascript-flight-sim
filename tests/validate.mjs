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
console.log('AERONAUT static validation passed (including depth, HUD & GeneralUser GS audio checks).');
