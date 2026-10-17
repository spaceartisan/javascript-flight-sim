import assert from 'node:assert/strict';
import {shapeAxis,defaults,settings,updateSettings,gamepad,pollGamepad,
 setTouchAxes,setTouchRudder,setTouchBrake,releaseTouch,readControls,setThrottleStep} from '../controls.js';

const near=(a,b=.0,t=.00001)=>assert(Math.abs(a-b)<t,`Expected ${a} ≈ ${b}`);
assert.equal(shapeAxis(0),0);
assert.equal(shapeAxis(.04),0);
assert.equal(shapeAxis(-.05),0);
assert(shapeAxis(.9)>.7);
assert(shapeAxis(-.9)<-.7);
assert.equal(shapeAxis(4),1);
assert.equal(shapeAxis(-4),-1);

const noKeys=new Set();
updateSettings({invertPitch:false,sensitivity:1,deadzone:.075});
let input=readControls(noKeys);
near(input.pitch);near(input.roll);near(input.rudder);
assert.equal(input.brake,false);
setTouchAxes(-.6,.82,true);
input=readControls(noKeys);
assert(input.pitch>.65,'pulling DOWN must raise nose');
assert(input.roll<-.35,'left touch must bank left');
updateSettings({invertPitch:true});
assert(readControls(noKeys).pitch<0,'inverted pitch must reverse stick');
updateSettings({invertPitch:false});
let kb=new Set(['KeyS','KeyD','KeyE','Space','ShiftLeft']);
input=readControls(kb);
assert.equal(input.pitch,1);assert.equal(input.roll,1);
assert.equal(input.rudder,1);assert.equal(input.brake,true);
assert.equal(input.throttleUp,true);
assert(setThrottleStep(input,.2)>.05);
setTouchRudder(-1,true);setTouchBrake(true);
kb.clear();input=readControls(kb);
assert.equal(input.rudder,-1);assert.equal(input.brake,true);
releaseTouch();
input=readControls(kb);
near(input.pitch);near(input.roll);near(input.rudder);assert(!input.brake);

// Edge-triggered buttons; pad disconnect must remove all live analog values.
const pad=(axes,pressed=[])=>({
 connected:true,index:0,mapping:'standard',axes,
 buttons:Array.from({length:17},(_,i)=>({value:pressed.includes(i)?1:0,pressed:pressed.includes(i)}))
});
let edges=pollGamepad(()=>[pad([.4,-.7,.6],[0,2,7])]);
assert(edges[0]&&edges[2]&&edges[7]);
edges=pollGamepad(()=>[pad([.4,-.7,.6],[0,2,7])]);
assert(!edges[0]&&!edges[2]&&!edges[7],'must not repeat while held');
input=readControls(noKeys);
assert(input.pitch<-.5,'negative pad Y pitches down');
assert(input.roll>.2,'gamepad roll analog active');
assert(input.rudder>.4,'gamepad rudder analog active');
assert(input.brake,'X maps to wheel brake');
assert(input.throttleUp,'right trigger maps to thrust');
assert(setThrottleStep(input,.1)>0);
edges=pollGamepad(()=>[pad([0,0,0],[])]);
assert(!edges[0]);assert(!readControls(noKeys).brake);
edges=pollGamepad(()=>[pad([0,0,0],[0])]);
assert(edges[0],'released then repressed must fire again');
pollGamepad(()=>[]);
assert(!gamepad.connected);near(readControls(noKeys).roll);
updateSettings(defaults);
console.log('Input regression tests passed: keyboard, touch, dead zones, inversion, throttle, gamepad, disconnect.');
