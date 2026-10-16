import {THREE,V,UP,FWD,renderer,scene,camera,sky,aircraft,drones} from './world.js';
import {flight,keys,effects,setStick,toggleGear,cycleFlaps,selectTarget,getTarget,targetSolution,fireMissile,updateMissiles,updateDrones,updateFlight,resetFlight} from './sim.js';
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp,KTS=1.943844,FT=3.28084,DEG=180/Math.PI;
const sound={
 ctx:null,engine1:null,engine2:null,wind:null,filter:null,
 init(){
  if(this.ctx)return;
  const ctx=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  const master=ctx.createGain();master.gain.value=.36;master.connect(ctx.destination);this.master=master;
  const tone=(type,frequency,volume)=>{
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=type;osc.frequency.value=frequency;gain.gain.value=volume;osc.connect(gain).connect(master);osc.start();return {osc,gain};
  };
  this.engine1=tone('sawtooth',39,.0001);this.engine2=tone('triangle',83,.0001);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=260;
  const wind=ctx.createGain();wind.gain.value=.0001;source.connect(filter).connect(wind).connect(master);source.start();
  this.wind=wind;this.filter=filter;
 },
 update(){
  if(!this.ctx)return;const t=this.ctx.currentTime,p=flight.spool,s=flight.airspeed;
  this.engine1.osc.frequency.setTargetAtTime(33+p*79,t,.085);this.engine2.osc.frequency.setTargetAtTime(76+p*241,t,.085);
  this.engine1.gain.gain.setTargetAtTime(.015+p*.13,t,.12);this.engine2.gain.gain.setTargetAtTime(.007+p*.085,t,.12);
  this.wind.gain.setTargetAtTime(Math.min(.22,s/1000),t,.2);
  this.filter.frequency.setTargetAtTime(250+s*6,t,.2);
 },
 chirp(freq=900,time=.15,type='sine',volume=.17){
  if(!this.ctx)return;const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.61),t+time);
  g.gain.setValueAtTime(Math.max(.001,volume),t);g.gain.exponentialRampToValueAtTime(.001,t+time);
  o.connect(g).connect(this.master);o.start(t);o.stop(t+time+.04);
 },
 boom(){this.chirp(110,.75,'sawtooth',.38);this.chirp(48,.95,'triangle',.3)},
 launch(){this.chirp(480,.42,'sawtooth',.25);this.chirp(1200,.19,'square',.08)}
};
let toastAt=0,lastAlert='',lastNotice='',cameraMode=0,uiTimer=0;
const cameraModes=['CHASE','COCKPIT','WING','TOWER'],cameraFocus=V();
function notify(message){
 const now=performance.now();
 // Avoid filling the view with repeated warnings or short-lived messages.
 if(lastNotice===message&&now-toastAt<2200)return;
 lastNotice=message;
 $('toast').textContent=message;
 $('toast').classList.add('show');
 toastAt=now;
}
effects.notify=notify;effects.chirp=(...args)=>sound.chirp(...args);effects.boom=()=>sound.boom();effects.launch=()=>sound.launch();
function cycleView(){cameraMode=(cameraMode+1)%4;notify('CAMERA / '+cameraModes[cameraMode]);$('cameraName').textContent=cameraModes[cameraMode]}
function toggleHUD(){
 const compact=$('hud').classList.toggle('compact');
 $('hudModeButton').textContent=compact?'▣ FULL HUD':'▤ COMPACT HUD';
 notify(compact?'COMPACT HUD / F2 TO EXPAND':'FULL INSTRUMENTS / F2 TO COMPACT');
}
function updateCamera(dt){
 const q=flight.q,pos=flight.pos,desired=new THREE.Vector3(),focus=pos.clone();
 if(cameraMode===0){desired.copy(pos).add(V(0,6,27).applyQuaternion(q));focus.add(V(0,1.4,-26).applyQuaternion(q))}
 if(cameraMode===1){desired.copy(pos).add(V(0,1.28,-3.7).applyQuaternion(q));focus.copy(desired).add(FWD.clone().applyQuaternion(q).multiplyScalar(130))}
 if(cameraMode===2){desired.copy(pos).add(V(13,2.7,6.5).applyQuaternion(q));focus.add(V(0,.3,-22).applyQuaternion(q))}
 if(cameraMode===3){desired.set(120,45,1080);focus.copy(pos)}
 camera.position.lerp(desired,cameraMode===1?1:1-Math.exp(-dt*5));
 cameraFocus.lerp(focus,cameraMode===1?1:1-Math.exp(-dt*7));
 camera.up.copy(cameraMode===3?UP:UP.clone().applyQuaternion(q));
 camera.lookAt(cameraFocus);
 camera.fov=cameraMode===1?76:cameraMode===3?58:69;camera.updateProjectionMatrix();
 aircraft.visible=cameraMode!==1;
}
function angle360(x){return ((Math.round(x)%360)+360)%360}
function drawRadar(){
 const c=$('radar'),ctx=c.getContext('2d'),w=c.width,h=c.height,r=w*.45,cx=w/2,cy=h/2;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(5,30,34,.52)';
 ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='rgba(128,232,195,.23)';ctx.lineWidth=1;
 for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(cx,cy,r*i/4,0,Math.PI*2);ctx.stroke()}
 ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.stroke();
 ctx.fillStyle='rgba(120,231,193,.07)';ctx.beginPath();ctx.moveTo(cx,cy);
 ctx.arc(cx,cy,r,-Math.PI/2+flight.clock*.65,-Math.PI/2+flight.clock*.65+.55);ctx.closePath();ctx.fill();
 const hdir=FWD.clone().applyQuaternion(flight.q),az=Math.atan2(-hdir.x,-hdir.z);
 for(const d of drones){
  if(!d.alive)continue;
  const dif=d.model.position.clone().sub(flight.pos),range=Math.hypot(dif.x,dif.z);
  const dir=Math.atan2(-dif.x,-dif.z)-az,rr=Math.min(r,range/18520*r);
  const px=cx+Math.sin(dir)*rr,py=cy-Math.cos(dir)*rr;
  ctx.strokeStyle=d.index===flight.selected?'#a4ffcf':'#ffb67b';ctx.lineWidth=2;
  ctx.strokeRect(px-5,py-5,10,10);ctx.font='11px monospace';
  ctx.fillStyle=d.index===flight.selected?'#b8ffda':'#ffce93';ctx.fillText('T'+(d.index+1),px+8,py-7);
 }
 ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx-7,cy+8);ctx.lineTo(cx+7,cy+8);ctx.closePath();
 ctx.fillStyle='#b1ffe3';ctx.fill();ctx.font='10px monospace';ctx.fillText('N',cx-4,13);
}
function updateHUD(){
 const speed=Math.max(0,Math.round(flight.airspeed*KTS)),alt=Math.max(0,Math.round(flight.pos.y*FT));
 const fw=FWD.clone().applyQuaternion(flight.q),hdg=angle360(Math.atan2(-fw.x,-fw.z)*DEG);
 $('speed').textContent=String(speed).padStart(3,'0');$('alt').textContent=String(alt).padStart(5,'0');
 $('heading').textContent=String(hdg).padStart(3,'0')+'°';
 $('speedBar').style.width=Math.min(100,speed/620*100)+'%';
 const climb=Math.round(flight.verticalSpeed*FT*60/100)*100;
 $('vsi').textContent='V/S '+(climb>=0?'+':'')+climb;
 $('gforce').textContent=(flight.gload>=0?'+':'')+flight.gload.toFixed(1);
 $('aoa').textContent='AOA '+flight.aoa.toFixed(1)+'°';
 $('engineN1').textContent=Math.round(flight.spool*100)+'%';$('engineBar').style.width=flight.spool*100+'%';
 $('fuelText').textContent=Math.round(flight.fuel)+'%';$('fuelBar').style.width=flight.fuel+'%';
 $('gearBadge').innerHTML='GEAR <b '+(!flight.gear?'class="warn"':'')+'>'+(flight.gear?'DOWN':'UP')+'</b>';
 $('flapsBadge').innerHTML='FLAPS <b>'+[0,12,25][flight.flaps]+'°</b>';
 $('brakeBadge').innerHTML='BRAKE <b class="'+(flight.brake?'warn':'')+'">'+(flight.brake?'ON':'OFF')+'</b>';
 $('ammo').textContent=String(flight.missiles).padStart(2,'0')+' / 04 MISSILES';
 $('kills').textContent=String(flight.kills).padStart(2,'0');
 $('hostiles').textContent=String(3-flight.kills).padStart(2,'0');
 $('contacts').textContent=String(3-flight.kills).padStart(2,'0')+' CONTACTS';
 $('progressFill').style.width=flight.kills/3*100+'%';
 $('flightPhase').textContent=flight.phase;
 $('horizonStatus').textContent=flight.assist?'STABILITY ASSIST / ON':'STABILITY ASSIST / OFF';
 $('mode').textContent=flight.kills===3?'RTB / LAND SIERRA':flight.airborne?'TACTICAL SORTIE':'FREE FLIGHT';
 const e=new THREE.Euler().setFromQuaternion(flight.q,'YXZ');
 $('horizon').style.transform='rotate('+(-e.z*DEG).toFixed(2)+'deg) translateY('+(e.x*DEG*4).toFixed(1)+'px)';
 $('flightPath').style.marginLeft=clamp(flight.vel.x*.85,-65,65)+'px';
 $('flightPath').style.marginTop=clamp(-flight.vel.y*.85,-40,40)+'px';
 $('hdgCurrent').textContent=String(hdg).padStart(3,'0');
 for(const [id,offset] of [['hdgLeft',-60],['hdgCenter',-30],['hdgRight',30],['hdgFar',60]])
  $(id).textContent=String(angle360(hdg+offset)).padStart(3,'0');
 const d=getTarget(),sol=targetSolution(d);flight.lock=sol.lock;
 if(d){
  $('targetInfo').innerHTML='<span>CONTACT '+String(d.index+1).padStart(2,'0')+' / UAV</span><b>'+(sol.range/1000).toFixed(2)+' KM</b>';
  $('lockStatus').textContent=sol.lock?'● IR LOCK ACQUIRED':sol.angle<60?'SEEKER ALIGNING':'TARGET OUTSIDE FOV';
  $('lockStatus').classList.toggle('locked',sol.lock);
  $('weaponState').textContent=sol.lock?'ARMED':'STANDBY';
 }else{
  $('targetInfo').innerHTML='<span>NO CONTACTS REMAIN</span><b>— — —</b>';
  $('lockStatus').textContent='AIRSPACE CLEAR';$('lockStatus').classList.remove('locked');
  $('weaponState').textContent='SAFE';
 }
 const warnings=[];
 if(flight.crashed)warnings.push('AIRCRAFT LOST / ENTER TO RESTART');
 else{
  if(flight.airspeed>45&&Math.abs(flight.aoa)>19)warnings.push('STALL • LOWER NOSE');
  if(speed>670)warnings.push('OVERSPEED');
  if(flight.pos.y<140&&flight.airborne&&!flight.gear)warnings.push('TERRAIN • GEAR UP');
  if(flight.fuel<15)warnings.push('LOW FUEL');
  if(flight.gload>7)warnings.push('HIGH G LOAD');
 }
 // The caution area is a single priority annunciator, never a stack of banners.
 const warning=warnings[0]||'';
 const caution=$('alerts');
 if(caution.dataset.warning!==warning){
  caution.dataset.warning=warning;
  caution.textContent=warning;
  caution.classList.toggle('active',Boolean(warning));
 }
 if(warnings.length&&warnings[0]!==lastAlert){sound.chirp(760,.13);lastAlert=warnings[0]}
 if(!warnings.length)lastAlert='';
 const secs=Math.floor(flight.clock);
 $('clock').textContent='12:'+String((48+Math.floor(secs/60))%60).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')+' Z';
 drawRadar();
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);
const prevent=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab','ShiftLeft','ShiftRight','ControlLeft','ControlRight'];
document.addEventListener('keydown',e=>{
 if(prevent.includes(e.code))e.preventDefault();
 if(e.repeat)return;
 if(e.code==='KeyH'){e.preventDefault();$('helpScreen').classList.toggle('hidden');return}
 if(!$('helpScreen').classList.contains('hidden')){
  if(e.code==='Escape')$('helpScreen').classList.add('hidden');return;
 }
 if(!flight.started)return;
 if(e.code==='Enter'&&flight.crashed){resetFlight();notify('NEW SORTIE — AIRCRAFT RESET');return}
 if(e.code==='F2'){e.preventDefault();toggleHUD()}
 if(e.code==='KeyG')toggleGear();
 if(e.code==='KeyF')cycleFlaps();
 if(e.code==='KeyV')cycleView();
 if(e.code==='KeyC'){flight.assist=!flight.assist;notify('STABILITY ASSIST / '+(flight.assist?'ON':'OFF'))}
 if(e.code==='KeyP'){flight.paused=!flight.paused;notify(flight.paused?'SIMULATION PAUSED':'SIMULATION RESUMED')}
 if(e.code==='KeyR'){flight.throttle=1;notify('AFTERBURNER SELECTED')}
 if(e.code==='KeyT'){flight.throttle=0;notify('THROTTLE IDLE')}
 if(e.code==='Tab'){selectTarget()}
 if(e.code==='KeyM'||e.code==='Enter')fireMissile();
 keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();setStick(0,0)});
$('startButton').addEventListener('click',()=>{
 flight.started=true;$('startScreen').classList.add('hidden');$('hud').classList.remove('hidden');
 sound.init();if(sound.ctx.state==='suspended')sound.ctx.resume();
 notify('SIERRA TOWER: KESTREL ONE, CLEARED FOR TAKEOFF');
});
$('helpButton').addEventListener('click',()=>$('helpScreen').classList.remove('hidden'));
$('closeHelp').addEventListener('click',()=>$('helpScreen').classList.add('hidden'));
$('viewButton').addEventListener('click',cycleView);
$('hudModeButton').addEventListener('click',toggleHUD);
$('mobileFire').addEventListener('click',fireMissile);
$('mobileGear').addEventListener('click',toggleGear);
$('mobileFlaps').addEventListener('click',cycleFlaps);
$('mobileView').addEventListener('click',cycleView);
$('mobileThrottle').addEventListener('input',e=>flight.throttle=Number(e.target.value)/100);
const stick=$('stickZone'),knob=$('stickKnob');
function moveStick(e){
 const b=stick.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;
 const x=clamp((e.clientX-cx)/48,-1,1),y=clamp((e.clientY-cy)/48,-1,1);
 setStick(x,y);knob.style.transform='translate('+(x*32)+'px,'+(y*32)+'px)';
}
stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);moveStick(e)});
stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture(e.pointerId))moveStick(e)});
function stopStick(){setStick(0,0);knob.style.transform='translate(0,0)'}
stick.addEventListener('pointerup',stopStick);stick.addEventListener('pointercancel',stopStick);
let prev=performance.now(),accumulator=0;
function loop(now){
 requestAnimationFrame(loop);
 const dt=Math.min(.045,Math.max(0,(now-prev)/1000));prev=now;
 if(flight.started&&!flight.paused){
  accumulator+=dt;let steps=0;
  while(accumulator>=1/90&&steps<6){
   updateDrones(1/90);updateFlight(1/90);updateMissiles(1/90);
   accumulator-=1/90;steps++;
  }
 }else if(!flight.started)updateDrones(dt);
 if(!flight.started){
  aircraft.userData.flames.forEach(f=>f.visible=false);
  const t=now*.00015;
  camera.position.set(Math.sin(t)*45+31,15+Math.sin(t*.4)*3,flight.pos.z+41+Math.cos(t)*12);
  camera.lookAt(flight.pos.x,flight.pos.y+1,flight.pos.z-5);
  sky.position.copy(camera.position);
 }else{
  updateCamera(dt);uiTimer+=dt;
  if(uiTimer>.105){updateHUD();uiTimer=0}
  sound.update();
 }
 renderer.render(scene,camera);
 if(now-toastAt>2100)$('toast').classList.remove('show');
}
requestAnimationFrame(loop);