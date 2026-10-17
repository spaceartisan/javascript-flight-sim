/**
 * AERONAUT input layer — all devices map into pitch/roll/yaw, throttle and brake.
 * Sign convention: pull stick DOWN = pitch UP, RIGHT = right roll, rudder RIGHT = yaw RIGHT.
 * Pure shaping helpers are also exported for deterministic tests.
 */
export const clamp=(n,a=-1,b=1)=>Math.max(a,Math.min(b,n));
export function shapeAxis(value,deadzone=.065,exponent=1.25){
 const n=clamp(Number(value)||0),m=Math.abs(n);
 if(m<=deadzone)return 0;
 return Math.sign(n)*Math.pow((m-deadzone)/(1-deadzone),exponent);
}
export const SETTINGS_KEY='aeronaut-controls-v1';
export const defaults=Object.freeze({invertPitch:false,sensitivity:1,deadzone:.075});
function readSettings(){
 try {
  const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
  return {
   invertPitch: saved.invertPitch===true,
   sensitivity: clamp(Number(saved.sensitivity)||1,.55,1.45),
   deadzone: clamp(Number(saved.deadzone)||.075,.02,.22)
  };
 }catch{return {...defaults}}
}
export const settings=readSettings();
export function updateSettings(patch){
 if(typeof patch.invertPitch==='boolean')settings.invertPitch=patch.invertPitch;
 if(Number.isFinite(patch.sensitivity))settings.sensitivity=clamp(patch.sensitivity,.55,1.45);
 if(Number.isFinite(patch.deadzone))settings.deadzone=clamp(patch.deadzone,.02,.22);
 try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{}
}
const touch={x:0,y:0,rudder:0,brake:false,active:false,rudderActive:false};
export function setTouchAxes(x,y,active=true){
 touch.x=clamp(x);touch.y=clamp(y);touch.active=active;
}
export function setTouchRudder(value,active=true){
 touch.rudder=clamp(value);touch.rudderActive=active;
}
export function setTouchBrake(pressed){touch.brake=Boolean(pressed)}
export function releaseTouch(){
 touch.x=0;touch.y=0;touch.rudder=0;touch.brake=false;touch.active=false;touch.rudderActive=false;
}
export const gamepad={connected:false,index:-1,axes:[],buttons:[],previous:[]};
export function pollGamepad(provider=()=>navigator.getGamepads?.()||[]){
 let pads=[];
 try{pads=Array.from(provider()||[])}catch{}
 const pad=pads.find(p=>p?.connected && p.mapping==='standard')||pads.find(p=>p?.connected);
 if(!pad){
  gamepad.connected=false;gamepad.index=-1;gamepad.axes=[];gamepad.buttons=[];
  gamepad.previous=[];return [];
 }
 const old=gamepad.index===pad.index?gamepad.buttons:[];
 const buttons=Array.from(pad.buttons||[],b=>typeof b==='number'?b:typeof b?.value==='number'?b.value:b?.pressed?1:0);
 const justPressed=buttons.map((v,i)=>v>.62&&!(old[i]>.62));
 gamepad.connected=true;gamepad.index=pad.index;gamepad.previous=old;gamepad.buttons=buttons;
 gamepad.axes=Array.from(pad.axes||[],v=>clamp(v));
 return justPressed;
}
function gpAxis(index){return shapeAxis(gamepad.axes[index]||0,settings.deadzone)}
function gpButton(index){return gamepad.buttons[index]||0}
function keyboardAxis(keys,pos,neg){return (keys.has(pos)?1:0)-(keys.has(neg)?1:0)}
export function readControls(keys){
 const gp=gamepad.connected;
 const gpPitch=gp?gpAxis(1):0, gpRoll=gp?gpAxis(0):0;
 const gpRudder=gp?gpAxis(2):0;
 const kbPitch=keyboardAxis(keys,'KeyS','KeyW')+keyboardAxis(keys,'ArrowDown','ArrowUp');
 const kbRoll=keyboardAxis(keys,'KeyD','KeyA')+keyboardAxis(keys,'ArrowRight','ArrowLeft');
 const kbRudder=keyboardAxis(keys,'KeyE','KeyQ');
 // Keyboard takes precedence while held; touch only overrides axes it owns.
 const pitchRaw=kbPitch|| (touch.active?touch.y:gpPitch);
 const rollRaw=kbRoll|| (touch.active?touch.x:gpRoll);
 const rudderRaw=kbRudder|| (touch.rudderActive?touch.rudder:gpRudder);
 const pitch=clamp((touch.active?shapeAxis(pitchRaw,settings.deadzone,1.32):pitchRaw)*settings.sensitivity);
 const roll=clamp((touch.active?shapeAxis(rollRaw,settings.deadzone,1.25):rollRaw)*settings.sensitivity);
 return {
  pitch:clamp(pitch*(settings.invertPitch?-1:1)),
  roll, rudder:clamp(rudderRaw*settings.sensitivity),
  brake:touch.brake||keys.has('Space')||(gp&&gpButton(2)>.35),
  throttleUp:keys.has('ShiftLeft')||keys.has('ShiftRight')||(gp&&gpButton(7)>.12),
  throttleDown:keys.has('ControlLeft')||keys.has('ControlRight')||(gp&&gpButton(6)>.12),
  throttleUpRate:gp?gpButton(7):0,
  throttleDownRate:gp?gpButton(6):0
 };
}
export function setThrottleStep(controls,dt){
 const up=controls.throttleUp?controls.throttleUpRate>.12?controls.throttleUpRate:1:0;
 const down=controls.throttleDown?controls.throttleDownRate>.12?controls.throttleDownRate:1:0;
 return clamp((up-down)*dt*.40,-1,1);
}
