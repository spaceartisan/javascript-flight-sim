import {THREE,V,UP,FWD,scene,aircraft,drones,makeMissileModel,height,shadowDisc,sky,sun} from './world.js';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const RAD=Math.PI/180,DEG=180/Math.PI;
export const keys=new Set();
export const flight={pos:V(0,2,1070),vel:V(),q:new THREE.Quaternion(),angular:V(),throttle:0,spool:0,
gear:true,flaps:1,brake:false,assist:true,fuel:100,missiles:4,kills:0,score:0,
airborne:false,crashed:false,paused:false,started:false,phase:'GROUND • READY',
gload:1,aoa:0,airspeed:0,verticalSpeed:0,lock:false,selected:0,clock:0,missionDone:false,lastTouchdown:0};
export const effects={notify:()=>{},chirp:()=>{},boom:()=>{},launch:()=>{},gear:()=>{},flap:()=>{},select:()=>{},complete:()=>{}};
export let mobileX=0,mobileY=0;
export function setStick(x,y){mobileX=x;mobileY=y}
export function toggleGear(){
 if(flight.crashed)return;
 if(flight.airspeed<3&&flight.pos.y<3){effects.notify('GEAR LOCKED — AIRCRAFT ON GROUND');return}
 flight.gear=!flight.gear;aircraft.userData.gear.visible=flight.gear;
 effects.notify(flight.gear?'LANDING GEAR DOWN & LOCKED':'LANDING GEAR RETRACTING');effects.gear();
}
export function cycleFlaps(){flight.flaps=(flight.flaps+1)%3;effects.notify('FLAPS SET '+[0,12,25][flight.flaps]+'°');effects.flap()}
export function selectTarget(){
 const alive=drones.filter(d=>d.alive);if(!alive.length){effects.notify('NO CONTACTS REMAIN');return}
 const current=alive.findIndex(d=>d.index===flight.selected);
 flight.selected=alive[(current+1)%alive.length].index;
 effects.notify('RADAR CONTACT '+String(flight.selected+1).padStart(2,'0')+' SELECTED');effects.select();
}
export function getTarget(){
 let d=drones.find(d=>d.index===flight.selected&&d.alive);
 if(!d){d=drones.find(x=>x.alive);if(d)flight.selected=d.index}return d;
}
export function targetSolution(d){
 if(!d)return {lock:false,range:0,angle:180};
 const offset=d.model.position.clone().sub(flight.pos),range=offset.length();
 const dir=FWD.clone().applyQuaternion(flight.q);
 const angle=Math.acos(clamp(offset.clone().normalize().dot(dir),-1,1))*DEG;
 return {lock:range<5500&&angle<33&&flight.airspeed>32&&!flight.crashed,range,angle};
}
const missiles=[],explosions=[];
export function fireMissile(){
 if(flight.crashed||flight.paused||!flight.started)return;
 const d=getTarget(),sol=targetSolution(d);
 if(!flight.missiles){effects.notify('STORES EMPTY — LAND TO REARM');effects.chirp(220,.2);return}
 if(!d||!sol.lock){effects.notify('NO MISSILE LOCK — POINT NOSE AT CONTACT');effects.chirp(220,.13);return}
 const station=[[-3.55,-1.0],[3.55,-1.0],[-5.55,-.8],[5.55,-.8]][4-flight.missiles];
 const m=makeMissileModel();m.position.copy(flight.pos).add(V(station[0],-.75,station[1]).applyQuaternion(flight.q));
 m.quaternion.copy(flight.q);scene.add(m);
 const dir=FWD.clone().applyQuaternion(flight.q);
 missiles.push({model:m,vel:flight.vel.clone().addScaledVector(dir,150),target:d,age:0});
 const store=aircraft.userData.stores[4-flight.missiles];if(store)store.model.visible=false;
 flight.missiles--;effects.launch();effects.notify('RAZOR-9 AWAY — CONTACT '+(d.index+1));
}
function hitEffect(position){
 const group=new THREE.Group();
 for(let i=0;i<20;i++){
  const material=new THREE.MeshBasicMaterial({color:i%3===0?'#ffd798':i%2===0?'#ff744e':'#e1eee1',transparent:true,opacity:1});
  const p=new THREE.Mesh(new THREE.IcosahedronGeometry(.7+Math.random()*2,0),material);
  p.position.copy(position);p.userData.vel=V(Math.random()-.5,Math.random()-.2,Math.random()-.5).multiplyScalar(105);group.add(p);
 }
 scene.add(group);explosions.push({group,age:0});effects.boom();
}
export function updateMissiles(dt){
 for(let i=missiles.length-1;i>=0;i--){
  const m=missiles[i];m.age+=dt;
  if(m.target.alive){
   const offset=m.target.model.position.clone().sub(m.model.position),dist=offset.length();
   if(dist<38){
    m.target.alive=false;m.target.model.visible=false;flight.kills++;flight.score+=1500;
    hitEffect(m.target.model.position);effects.notify('SPLASH '+(m.target.index+1)+' — TARGET DESTROYED');
    scene.remove(m.model);missiles.splice(i,1);
    if(flight.kills===3){effects.notify('ALL CONTACTS ELIMINATED — RETURN TO SIERRA');effects.chirp(1300,.32)}
    continue;
   }
   const desired=offset.normalize(),current=m.vel.clone().normalize();
   current.lerp(desired,clamp(dt*2,0,.2)).normalize();m.vel.copy(current.multiplyScalar(Math.min(720,m.vel.length()+270*dt)));
  }
  m.vel.y-=3*dt;m.model.position.addScaledVector(m.vel,dt);
  m.model.quaternion.setFromUnitVectors(FWD,m.vel.clone().normalize());
  if(m.age>17||m.model.position.y<height(m.model.position.x,m.model.position.z)){
   scene.remove(m.model);missiles.splice(i,1);
  }
 }
 for(let i=explosions.length-1;i>=0;i--){
  const e=explosions[i];e.age+=dt;
  for(const p of e.group.children){p.position.addScaledVector(p.userData.vel,dt);p.userData.vel.y-=22*dt;
   p.scale.setScalar(Math.max(.01,1-e.age/1.7));p.material.opacity=Math.max(0,1-e.age/1.7)}
  if(e.age>1.7){scene.remove(e.group);explosions.splice(i,1)}
 }
}
export function updateDrones(dt){
 for(const d of drones){if(!d.alive)continue;d.angle+=dt*d.speed;const a=d.angle;
  d.model.position.copy(d.center).add(V(Math.sin(a)*d.radius,d.altitude+Math.sin(a*1.7)*78,Math.cos(a)*d.radius));
  const dir=V(Math.cos(a)*d.radius*d.speed,Math.cos(a*1.7)*45,-Math.sin(a)*d.radius*d.speed).normalize();
  d.model.quaternion.setFromUnitVectors(FWD,dir);d.model.rotateZ(-.1);
 }
}
const MASS=10600,WING=35,GRAV=9.80665;
export function updateFlight(dt){
 if(flight.crashed||flight.paused)return;
 flight.clock+=dt;
 const shift=keys.has('ShiftLeft')||keys.has('ShiftRight'),control=keys.has('ControlLeft')||keys.has('ControlRight');
 if(shift)flight.throttle=clamp(flight.throttle+dt*.34,0,1);
 if(control)flight.throttle=clamp(flight.throttle-dt*.34,0,1);
 flight.spool+=(flight.throttle-flight.spool)*Math.min(1,dt*1.2);
 flight.fuel=Math.max(0,flight.fuel-dt*(.0014+.0052*flight.spool));
 const pitch=clamp((keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+mobileY,-1,1);
 const roll=clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+mobileX,-1,1);
 const rudder=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
 const ground=height(flight.pos.x,flight.pos.z)+(flight.gear?2:.88);
 const onGround=flight.pos.y<=ground+.13;
 const air=flight.vel.clone().sub(V(1.8,0,-2.4)),Vmag=air.length();
 const forward=FWD.clone().applyQuaternion(flight.q),up=UP.clone().applyQuaternion(flight.q);
 const airDir=Vmag>.1?air.clone().divideScalar(Vmag):forward.clone();
 const along=air.dot(forward),alpha=Vmag>8?-Math.atan2(air.dot(up),Math.max(1,along)):0;
 flight.aoa=alpha*180/Math.PI;flight.airspeed=Vmag;
 const rho=1.225*Math.exp(-Math.max(0,flight.pos.y)/8500),dynamic=.5*rho*Vmag*Vmag;
 let cl=.27+4.9*alpha+[0,.20,.40][flight.flaps];cl=clamp(cl,-.95,1.45);
 const stalled=Math.abs(alpha)>19*RAD&&Vmag>25;
 if(stalled)cl*=clamp(1-(Math.abs(alpha)-19*RAD)*1.65,.20,1);
 const cd=.031+cl*cl*.054+(flight.gear?.036:0)+[0,.018,.05][flight.flaps]+Math.pow(Math.max(0,Vmag-235)/170,2)*.22;
 const thrust=(flight.spool>.84?90000+(flight.spool-.84)/.16*59000:flight.spool/.84*90000)*(flight.fuel>0?1:0);
 const liftAxis=up.clone().addScaledVector(airDir,-up.dot(airDir));if(liftAxis.lengthSq()<.0001)liftAxis.copy(up);liftAxis.normalize();
 const acceleration=forward.clone().multiplyScalar(thrust/MASS).addScaledVector(liftAxis,dynamic*WING*cl/MASS).addScaledVector(airDir,-dynamic*WING*cd/MASS).add(V(0,-GRAV,0));
 flight.brake=onGround&&keys.has('Space');
 if(onGround){
  const speed=flight.vel.length(),friction=flight.brake?5.8:.75;
  acceleration.addScaledVector(speed>.2?flight.vel.clone().normalize():forward,-friction);
  if(speed<.25&&flight.throttle<.04){flight.vel.set(0,0,0);acceleration.x=0;acceleration.z=0}
 }
 const authority=clamp(Vmag/70,.12,1.4),response=onGround?clamp((Vmag-42)/70,0,.75):authority;
 const desiredPitch=pitch*.47*response+(stalled?-.20:0);
 const desiredRoll=-roll*.72*response;
 const bank=Math.atan2(up.x,up.y);
 const coordinated=onGround?0:-GRAV*Math.tan(clamp(bank,-1.05,1.05))/Math.max(Vmag,38)*.80;
 const desiredYaw=onGround?-rudder*.28*clamp(Vmag/30,0,1):(-rudder*.16*response+coordinated);
 const smoothing=1-Math.exp(-dt*5);
 flight.angular.x=lerp(flight.angular.x,desiredPitch,smoothing);
 flight.angular.y=lerp(flight.angular.y,desiredYaw,smoothing);
 flight.angular.z=lerp(flight.angular.z,desiredRoll,smoothing);
 if(flight.assist&&!onGround)flight.angular.x-=clamp(alpha,-.4,.4)*.19*dt;
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(flight.angular.x*dt,flight.angular.y*dt,flight.angular.z*dt,'YXZ'));
 flight.q.multiply(rotation).normalize();
 flight.vel.addScaledVector(acceleration,dt);flight.pos.addScaledVector(flight.vel,dt);
 flight.verticalSpeed=flight.vel.y;flight.gload=(dynamic*WING*cl/MASS)/GRAV;
 const surface=height(flight.pos.x,flight.pos.z)+(flight.gear?2:.88);
 if(flight.pos.y<=surface){
  const descent=-flight.vel.y,landable=Math.abs(flight.pos.x)<33&&Math.abs(flight.pos.z)<1340;
  const level=Math.acos(clamp(UP.clone().applyQuaternion(flight.q).dot(UP),-1,1))*DEG;
  if((descent>9.5||(!flight.gear&&Vmag>26)||(!landable&&Vmag>23)||level>32)&&flight.clock>1.5){
   flight.crashed=true;flight.phase='AIRCRAFT LOST';effects.boom();hitEffect(flight.pos.clone());effects.notify('AIRCRAFT LOST — PRESS ENTER TO RESTART');
  }else{
   if(flight.airborne&&descent>1){flight.lastTouchdown=descent;effects.notify('TOUCHDOWN — '+descent.toFixed(1)+' M/S DESCENT');effects.chirp(480,.24)}
   flight.pos.y=surface;flight.vel.y=Math.max(0,flight.vel.y*.12);flight.airborne=false;
   const euler=new THREE.Euler().setFromQuaternion(flight.q,'YXZ');
   euler.x=clamp(euler.x,-.015,12*RAD);euler.z=lerp(euler.z,0,clamp(dt*5,0,1));flight.q.setFromEuler(euler);
   if(flight.kills===3&&landable&&Vmag<5&&!flight.missionDone){
    flight.missionDone=true;flight.phase='SORTIE COMPLETE';flight.score+=2000;
    effects.notify('SORTIE COMPLETE — SIERRA, WELCOME HOME');effects.complete();
   }
   if(Vmag<3&&flight.missiles<4){
    flight.missiles=4;for(const s of aircraft.userData.stores)s.model.visible=true;effects.notify('GROUND CREW — MISSILES REARMED');
   }
  }
 }else if(flight.pos.y>surface+.5)flight.airborne=true;
 if(flight.pos.y>14500)flight.vel.y=Math.min(flight.vel.y,0);
 flight.phase=flight.crashed?'AIRCRAFT LOST':flight.missionDone?'SORTIE COMPLETE':onGround?Vmag>24?'TAKEOFF ROLL':'GROUND • READY':stalled?'STALL / RECOVER':flight.verticalSpeed>2?'CLIMB':'AIRBORNE';
 syncAircraft();
}
export function syncAircraft(){
 aircraft.position.copy(flight.pos);aircraft.quaternion.copy(flight.q);aircraft.userData.gear.visible=flight.gear;
 const power=clamp((flight.spool-.67)/.33,0,1);
 aircraft.userData.flames.forEach(f=>{
  f.visible=power>.01;
  f.scale.set(1+power*.24,1+power*.24,1+power*.70);
  // Procedural fallback flames are meshes; Blender-authored engines are named groups.
  f.traverse(o=>{
   if(!o.isMesh||!o.material)return;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const material of mats){
    if(material.opacity!==undefined)material.opacity=.13+power*.47;
    if(material.color)material.color.set(power>.58?'#a9eaff':'#488ebc');
   }
  });
 });
 shadowDisc.position.set(flight.pos.x,height(flight.pos.x,flight.pos.z)+.12,flight.pos.z);
 shadowDisc.scale.setScalar(clamp(1-(flight.pos.y-height(flight.pos.x,flight.pos.z))/2200,.1,1));
 sky.position.copy(flight.pos);sun.position.set(flight.pos.x-4200,flight.pos.y+6500,flight.pos.z-5200);sun.target.position.copy(flight.pos);sun.target.updateMatrixWorld();
}
export function resetFlight(){
 flight.pos.set(0,2,1070);flight.vel.set(0,0,0);flight.q.identity();flight.angular.set(0,0,0);
 flight.throttle=0;flight.spool=0;flight.gear=true;flight.flaps=1;flight.brake=false;flight.assist=true;
 flight.fuel=100;flight.missiles=4;flight.kills=0;flight.score=0;flight.airborne=false;flight.crashed=false;
 flight.paused=false;flight.clock=0;flight.missionDone=false;flight.selected=0;flight.phase='GROUND • READY';
 for(const d of drones){d.alive=true;d.model.visible=true;d.angle=d.index*2.5+.3}
 for(const m of missiles)scene.remove(m.model);missiles.length=0;
 for(const e of explosions)scene.remove(e.group);explosions.length=0;
 for(const s of aircraft.userData.stores)s.model.visible=true;syncAircraft();
}
syncAircraft();