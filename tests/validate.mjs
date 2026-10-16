import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),main=read('main.js'),world=read('world.js'),sim=read('sim.js'),css=read('styles.css');
for(const f of ['main.js','sim.js','world.js','assets/mark.svg','assets/concrete.svg','tools/build-kestrel.py','tools/aeronaut-soundbank.csd'])assert(fs.existsSync(new URL('../'+f,import.meta.url)),'missing '+f);
for(const id of [...main.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1])){
 assert(html.includes('id="'+id+'"'), 'UI element missing in index.html: '+id);
}
assert(html.includes('three@0.168.0'),'pinned Three.js importmap missing');
for(const token of ['updateFlight','targetSolution','fireMissile','updateMissiles','MASS=10600','dynamic*WING*cl','flight.gear','flight.flaps'])assert(sim.includes(token),'simulation missing '+token);
for(const token of ['buildKestrel','new THREE.PlaneGeometry','function height','assets/concrete.svg'])assert(world.includes(token),'world missing '+token);
for(const token of ['flight-data','radar-panel','weapons-panel','overlay','@media(max-width:820px)'])assert(css.includes(token),'interface missing '+token);
console.log('AERONAUT static validation passed.');
