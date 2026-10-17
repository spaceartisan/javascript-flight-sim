/* Mobile and gamepad UI. Inputs are transient and safety-reset on blur, pause or release. */
import {clamp,settings,defaults,updateSettings,setTouchAxes,setTouchRudder,setTouchBrake,releaseTouch,pollGamepad,gamepad} from './controls.js';
const $=id=>document.getElementById(id);

export function installControlUI({flight,keys,fireMissile,selectTarget,toggleGear,cycleFlaps,cycleView,togglePause,restart,openHelp,notify}){
 const zone=$('stickZone'),ring=$('stickRing'),knob=$('stickKnob');
 const slider=$('mobileThrottle'),throttleOut=$('mobileThrottleValue');
 const left=$('rudderLeft'),right=$('rudderRight'),brake=$('mobileBrake');
 let stickId=null,origin={x:0,y:0},lastThrottle=-1,step=0;
 const rudderPointers=new Map(),brakePointers=new Set();
 function visualStick(x,y,active=false){
  if(active){
   const rect=zone.getBoundingClientRect();
   ring.style.left=(origin.x-rect.left)+'px';
   ring.style.top=(origin.y-rect.top)+'px';
  }else{
   ring.style.left='42%';ring.style.top='55%';
  }
  ring.classList.toggle('active',active);
  knob.style.transform=`translate3d(${x*47}px,${y*47}px,0)`;
 }
 function flightMove(e){
  if(e.pointerId!==stickId)return;
  const dx=e.clientX-origin.x,dy=e.clientY-origin.y;
  const n=Math.hypot(dx,dy),length=64;
  const fraction=Math.min(1,n/length);
  const x=n>0?(dx/n)*fraction:0,y=n>0?(dy/n)*fraction:0;
  setTouchAxes(x,y,true);visualStick(x,y,true);
 }
 zone.addEventListener('pointerdown',e=>{
  if(stickId!==null||!flight.started||flight.paused)return;
  e.preventDefault();stickId=e.pointerId;
  origin={x:e.clientX,y:e.clientY};
  zone.setPointerCapture(e.pointerId);
  setTouchAxes(0,0,true);
  flightMove(e);
 });
 zone.addEventListener('pointermove',e=>{if(stickId===e.pointerId){e.preventDefault();flightMove(e)}});
 function releaseStick(e){
  if(stickId!==e.pointerId)return;
  stickId=null;setTouchAxes(0,0,false);visualStick(0,0,false);
 }
 zone.addEventListener('pointerup',releaseStick);
 zone.addEventListener('pointercancel',releaseStick);
 zone.addEventListener('lostpointercapture',releaseStick);
 function updateRudder(){
  const values=[...rudderPointers.values()];
  const sum=values.reduce((a,b)=>a+b,0);
  setTouchRudder(clamp(sum),values.length>0);
  left.classList.toggle('pressed',values.includes(-1));
  right.classList.toggle('pressed',values.includes(1));
 }
 for(const [button,value] of [[left,-1],[right,1]]){
  button.addEventListener('pointerdown',e=>{
   if(!flight.started||flight.paused)return;
   e.preventDefault();button.setPointerCapture(e.pointerId);
   rudderPointers.set(e.pointerId,value);updateRudder();
  });
  const release=e=>{if(rudderPointers.delete(e.pointerId))updateRudder()};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
 }
 function updateBrake(){setTouchBrake(brakePointers.size>0);brake.classList.toggle('pressed',brakePointers.size>0)}
 brake.addEventListener('pointerdown',e=>{
  if(!flight.started||flight.paused)return;
  e.preventDefault();brake.setPointerCapture(e.pointerId);brakePointers.add(e.pointerId);updateBrake();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])brake.addEventListener(type,e=>{brakePointers.delete(e.pointerId);updateBrake()});
 function syncThrottle(force=false){
  const power=Math.round(flight.throttle*100);
  if(!force&&power===lastThrottle)return;
  lastThrottle=power;slider.value=String(power);throttleOut.textContent=power+'%';
  $('mobileAB').classList.toggle('pressed',power>83);
 }
 slider.addEventListener('input',()=>{flight.throttle=clamp(Number(slider.value)/100,0,1);syncThrottle(true)});
 $('mobileIdle').addEventListener('click',()=>{flight.throttle=0;syncThrottle(true);notify('THROTTLE IDLE')});
 $('mobileAB').addEventListener('click',()=>{flight.throttle=1;syncThrottle(true);notify('AFTERBURNER SELECTED')});
 $('mobileFire').addEventListener('click',()=>{if(!flight.paused)fireMissile()});
 $('mobileTarget').addEventListener('click',()=>{if(!flight.paused)selectTarget()});
 $('mobileGear').addEventListener('click',toggleGear);
 $('mobileFlaps').addEventListener('click',cycleFlaps);
 $('mobileView').addEventListener('click',cycleView);
 $('mobilePause').addEventListener('click',()=>togglePause());
 $('resumeFlight').addEventListener('click',()=>togglePause(false));
 $('restartFlight').addEventListener('click',()=>{restart();togglePause(false);syncThrottle(true);notify('NEW SORTIE — READY')});
 $('pauseHelp').addEventListener('click',openHelp);
 $('mobileFullscreen').addEventListener('click',async()=>{
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
   else notify('FULL SCREEN NOT AVAILABLE');
  }catch{notify('FULL SCREEN NOT AVAILABLE')}
 });
 const inv=$('invertPitch'),sens=$('sensitivity'),dead=$('deadzone');
 function refreshSettings(){
  inv.checked=settings.invertPitch;
  sens.value=String(settings.sensitivity);
  dead.value=String(settings.deadzone);
  $('sensitivityValue').textContent=Math.round(settings.sensitivity*100)+'%';
  $('deadzoneValue').textContent=Math.round(settings.deadzone*100)+'%';
 }
 inv.addEventListener('change',()=>{updateSettings({invertPitch:inv.checked});refreshSettings()});
 sens.addEventListener('input',()=>{updateSettings({sensitivity:Number(sens.value)});refreshSettings()});
 dead.addEventListener('input',()=>{updateSettings({deadzone:Number(dead.value)});refreshSettings()});
 $('resetControls').addEventListener('click',()=>{updateSettings(defaults);refreshSettings()});
 refreshSettings();
 function resetTransient(){
  releaseTouch();rudderPointers.clear();brakePointers.clear();stickId=null;visualStick(0,0,false);
  brake.classList.remove('pressed');left.classList.remove('pressed');right.classList.remove('pressed');
 }
 window.addEventListener('blur',resetTransient);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTransient()});
 // Gamepad and keyboard action dispatch are both edge-triggered; there is no button-repeat spam.
 function tickGamepad(){
  const edges=pollGamepad();
  $('controllerStatus').textContent=gamepad.connected?'GAMEPAD CONNECTED · LEFT STICK FLIGHT / TRIGGERS THROTTLE':'KEYBOARD / TOUCH READY';
  if(!flight.started)return;
  if(edges[9])togglePause();
  if(flight.paused)return;
  if(edges[0])fireMissile();
  if(edges[1])selectTarget();
  if(edges[3])toggleGear();
  if(edges[4])cycleFlaps();
  if(edges[5])cycleView();
  if(edges[8])openHelp();
  if(edges[12])flight.throttle=clamp(flight.throttle+.1,0,1);
  if(edges[13])flight.throttle=clamp(flight.throttle-.1,0,1);
 }
 function tick(){
  // Gamepad APIs are frame-sampled; avoid polling in the physics integrator at 90Hz.
  tickGamepad();
  if(!flight.started)return;
  syncThrottle();
  $('mobileGear').textContent=flight.gear?'GEAR ↓':'GEAR ↑';
  $('mobileFlaps').textContent='FLAPS '+[0,12,25][flight.flaps]+'°';
  $('mobileTargetInfo').textContent='CONTACT '+(flight.selected+1)+' · '+(3-flight.kills)+' LIVE';
  const lock=$('mobileLockInfo');
  lock.textContent=flight.kills===3?'AIRSPACE CLEAR':flight.lock?'● LOCKED':'○ SEARCHING';
  lock.classList.toggle('locked',flight.lock);
  $('mobileFire').classList.toggle('armed',flight.lock);
  $('mobileBrake').classList.toggle('braking',flight.brake);
  $('mobilePause').textContent=flight.paused?'▶ RESUME':'Ⅱ PAUSE';
  $('pauseScreen').classList.toggle('hidden',!flight.paused);
 }
 return {tick,resetTransient,syncThrottle};
}
