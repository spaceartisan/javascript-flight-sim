import * as THREE from 'three';
export {THREE};
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const UP=V(0,1,0), FWD=V(0,0,-1);
export const canvas=document.getElementById('sim');
export const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
export const scene=new THREE.Scene();scene.background=new THREE.Color('#a2c3d7');scene.fog=new THREE.FogExp2('#a4beca',.000064);
export const camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.1,45000);
scene.add(new THREE.HemisphereLight(0xc3e9ff,0x826951,2.1));
export const sun=new THREE.DirectionalLight(0xffe3b6,3);
sun.position.set(-4200,6500,-5200);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-300;sun.shadow.camera.right=300;sun.shadow.camera.top=300;sun.shadow.camera.bottom=-300;
sun.shadow.camera.near=1;sun.shadow.camera.far=12000;sun.shadow.bias=-.00016;scene.add(sun);scene.add(sun.target);
export const sky=new THREE.Mesh(new THREE.SphereGeometry(19000,28,18),new THREE.ShaderMaterial({
side:THREE.BackSide,depthWrite:false,fog:false,
vertexShader:'varying vec3 dir;void main(){dir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
fragmentShader:'varying vec3 dir;void main(){float h=clamp(dir.y*.55+.5,0.,1.);vec3 c=mix(vec3(.82,.79,.67),vec3(.19,.46,.73),smoothstep(.17,.93,h));c=mix(vec3(.90,.70,.50),c,smoothstep(0.,.26,h));float s=pow(max(dot(normalize(dir),normalize(vec3(-.38,.48,-.72))),0.),155.);c+=vec3(1.,.65,.3)*s*.72;gl_FragColor=vec4(c,1.);}'
}));sky.frustumCulled=false;scene.add(sky);
export const mat=(c,metal=.08,rough=.82)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const steel=mat('#788d96',.72,.37),panel=mat('#53666e',.65,.47),edge=mat('#a5bac1',.76,.24),dark=mat('#1f343d',.59,.54);
const runwayTexture=new THREE.TextureLoader().load('./assets/concrete.svg');
runwayTexture.colorSpace=THREE.SRGBColorSpace;runwayTexture.wrapS=THREE.RepeatWrapping;runwayTexture.wrapT=THREE.RepeatWrapping;runwayTexture.repeat.set(3,30);
const asphalt=new THREE.MeshStandardMaterial({color:'#515d60',map:runwayTexture,roughness:.94});
const concrete=mat('#758487'),white=mat('#d5ddd4'),yellow=mat('#dcc58b'),red=mat('#bd5a40');
export function box(parent,w,h,d,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=h>.4;m.receiveShadow=true;parent.add(m);return m}
function hash(x,z){const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a)}
function noise(x,z){const X=Math.floor(x),Z=Math.floor(z),u=x-X,t=z-Z,a=u*u*(3-2*u),b=t*t*(3-2*t);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(X,Z),hash(X+1,Z),a),THREE.MathUtils.lerp(hash(X,Z+1),hash(X+1,Z+1),a),b)}
function fbm(x,z){let sum=0,a=.5;for(let i=0;i<5;i++){sum+=noise(x,z)*a;x*=2.06;z*=2.06;a*=.5}return sum}
export function height(x,z){const airport=Math.max(Math.abs(x)/3100,Math.abs(z)/3200),rise=THREE.MathUtils.smoothstep(airport,.55,2.1);
const ridge=Math.max(0,1-Math.abs(x-7300)/12000);
const mountain=(fbm(x*.00035,z*.00035)-.32)*1200+Math.pow(fbm(x*.00085,z*.00085),2)*1300;
return Math.max(-25,(mountain+(Math.sin(x*.00067)+Math.cos(z*.00059))*90+ridge*170)*rise)}
const terrainGeo=new THREE.PlaneGeometry(36000,36000,250,250);terrainGeo.rotateX(-Math.PI/2);
const positions=terrainGeo.attributes.position,colors=[],c=new THREE.Color();
for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),h=height(x,z);positions.setY(i,h);
const n=noise(x*.0018,z*.0018);
if(h>900)c.setHSL(.12,.10,THREE.MathUtils.lerp(.63,.86,THREE.MathUtils.clamp((h-900)/1000,0,1)));
else if(h>250)c.setHSL(.23,.14,THREE.MathUtils.lerp(.34,.48,n));
else c.setHSL(.28,THREE.MathUtils.lerp(.18,.29,n),THREE.MathUtils.lerp(.26,.38,n));
colors.push(c.r,c.g,c.b)}
terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeo.computeVertexNormals();
const terrain=new THREE.Mesh(terrainGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
terrain.receiveShadow=true;scene.add(terrain);
const sea=new THREE.Mesh(new THREE.PlaneGeometry(30000,36000),new THREE.MeshPhysicalMaterial({color:'#427789',metalness:.23,roughness:.35,transparent:true,opacity:.94}));
sea.rotation.x=-Math.PI/2;sea.position.set(-22000,-18,0);scene.add(sea);
const airport=new THREE.Group();scene.add(airport);
box(airport,65,.08,2700,asphalt,0,.045,0);box(airport,245,.09,600,concrete,205,.05,700);
box(airport,165,.09,55,concrete,94,.052,560);box(airport,165,.09,55,concrete,94,.052,-380);
for(const side of [-1,1]){box(airport,9,.055,2700,mat('#6b7772'),side*39,.054,0);
for(let i=-1250;i<=1250;i+=100)box(airport,.35,.02,38,white,side*28,.102,i);
for(let i=-1200;i<=1200;i+=75){const light=box(airport,.8,.24,.8,new THREE.MeshBasicMaterial({color:i>0?'#fff1bc':'#b9e8ff'}),side*36,.28,i);light.castShadow=false}
for(let j=0;j<6;j++){box(airport,2.5,.012,53,white,side*(4+j*3),.11,1165);box(airport,2.5,.012,53,white,side*(4+j*3),.11,-1165)}}
for(let i=-1225;i<=1225;i+=70)box(airport,1.35,.012,30,white,0,.103,i);
for(let i=0;i<5;i++){const z=970-i*190;box(airport,85,25,96,concrete,380,12.55,z);box(airport,91,4,103,panel,380,27,z);
box(airport,60,19,1,dark,380,10,z-48.2);for(let j=0;j<5;j++)box(airport,1,18,1,edge,352+j*14,10,z-48.8)}
const glass=mat('#263f50',.55,.31);
box(airport,30,40,28,concrete,585,20,-85);box(airport,14,77,14,concrete,585,38.5,-85);
box(airport,30,9,30,glass,585,82,-85);box(airport,2,19,2,edge,585,96,-85);
for(let i=0;i<30;i++){const x=400+(i%7)*110,z=-700+Math.floor(i/7)*150,h=11+hash(i,8)*35;
box(airport,12+hash(i,4)*11,h,14+hash(i,2)*14,hash(i,5)>.5?concrete:panel,x,h/2,z)}
const cloudMat=new THREE.MeshLambertMaterial({color:'#ffffff',transparent:true,opacity:.49,depthWrite:false});
for(let i=0;i<48;i++){const group=new THREE.Group(),s=65+hash(i,61)*95;
for(let k=0;k<7;k++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),cloudMat);
m.scale.set(s*(.85+hash(k,3)*.9),s*(.24+hash(k,2)*.26),s*(.55+hash(k,5)));
m.position.set((k-3)*s*.48,(hash(k,7)-.4)*s*.18,(hash(k,9)-.5)*s);group.add(m)}
group.position.set((hash(i,50)-.5)*25000,1150+hash(i,33)*1500,(hash(i,99)-.5)*24000);scene.add(group)}
function poly(parent,points,material,thickness=.14){const s=new THREE.Shape();s.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);s.closePath();
const g=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelThickness:.04,bevelSize:.06,bevelSegments:1});
g.rotateX(Math.PI/2);g.translate(0,thickness*.5,0);const m=new THREE.Mesh(g,material);m.castShadow=true;parent.add(m);return m}
export function makeMissileModel(){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,2.5,10),white);
body.rotation.x=Math.PI/2;g.add(body);const tip=new THREE.Mesh(new THREE.ConeGeometry(.12,.46,10),edge);tip.rotation.x=-Math.PI/2;tip.position.z=-1.45;g.add(tip);
for(let k=0;k<4;k++){const fin=box(g,.05,.46,.42,edge,0,0,.88);fin.rotation.z=k*Math.PI/2}return g}
export function buildKestrel(){
const g=new THREE.Group();g.userData.stores=[];g.userData.flames=[];
const rings=[[-11,.05,.06,.05],[-9.5,.36,.32,.02],[-7,.68,.63,0],[-4,1.03,.8,.05],[0,1.14,.86,0],[3.3,1.06,.80,.02],[6.7,.78,.67,.02],[9.1,.72,.66,.01],[11.1,.3,.33,0]];
const verts=[],idx=[],S=12;
for(const [z,rx,ry,cy] of rings)for(let j=0;j<S;j++){const a=j*2*Math.PI/S;verts.push(Math.cos(a)*rx,Math.sin(a)*ry+cy,z)}
for(let r=0;r<rings.length-1;r++)for(let j=0;j<S;j++){const a=r*S+j,b=r*S+(j+1)%S,c=(r+1)*S+j,d=(r+1)*S+(j+1)%S;idx.push(a,b,c,b,d,c)}
const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(idx);geom.computeVertexNormals();
const body=new THREE.Mesh(geom,steel);body.castShadow=true;g.add(body);
const wing=[[0,-3.5],[1.8,-2.8],[7.95,1.95],[8.28,2.65],[5.9,2.47],[2.25,2.1],[.8,2.2]];
poly(g,wing,steel,.18);poly(g,wing.map(p=>[-p[0],p[1]]).reverse(),steel,.18);
for(const side of [-1,1]){
poly(g,[[side*.7,5.7],[side*1.5,5.5],[side*4.4,8.15],[side*4.3,8.6],[side*1.35,8.05]],panel,.12);
box(g,2.3,.05,.62,edge,side*3.2,0,8.13);
for(const a of [3.55,5.55]){const mount=new THREE.Group();mount.position.set(side*a,-.35,.9+a*.12);g.add(mount);
box(mount,.12,.44,.65,dark,0,-.12,0);
const missile=makeMissileModel();missile.scale.set(.75,.75,.75);missile.position.y=-.62;mount.add(missile);
g.userData.stores.push({model:missile,side,a})}
}
const tailG=new THREE.BufferGeometry();tailG.setAttribute('position',new THREE.Float32BufferAttribute([0,.3,5.3,0,3,7.4,0,.4,10.1],3));
tailG.setIndex([0,1,2]);tailG.computeVertexNormals();const tail=new THREE.Mesh(tailG,new THREE.MeshStandardMaterial({color:'#7f939a',metalness:.6,roughness:.4,side:THREE.DoubleSide}));g.add(tail);
const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,22,12),new THREE.MeshPhysicalMaterial({color:'#173d51',metalness:.5,roughness:.11,transparent:true,opacity:.82,clearcoat:1,clearcoatRoughness:.12}));
canopy.scale.set(.79,.68,2.7);canopy.position.set(0,.78,-4.1);g.add(canopy);
box(g,.075,.9,.15,dark,0,1.02,-3.95);for(const side of [-1,1])box(g,.65,.68,2.4,dark,side*1.04,-.38,.5);
for(const x of [-.47,.47]){const engine=new THREE.Mesh(new THREE.CylinderGeometry(.48,.62,2.1,16,1,true),dark);
engine.rotation.x=Math.PI/2;engine.position.set(x,-.12,9.4);g.add(engine);
const nozzle=new THREE.Mesh(new THREE.TorusGeometry(.46,.1,7,18),edge);nozzle.position.set(x,-.12,10.51);g.add(nozzle);
const flame=new THREE.Mesh(new THREE.ConeGeometry(.36,3.2,12),new THREE.MeshBasicMaterial({color:'#76cffa',transparent:true,opacity:.4,depthWrite:false}));
flame.rotation.x=Math.PI/2;flame.position.set(x,-.12,12);g.add(flame);g.userData.flames.push(flame)}
const gear=new THREE.Group();g.add(gear);g.userData.gear=gear;
for(const [x,z] of [[-2.15,2],[2.15,2],[0,-6.4]]){box(gear,.18,1.4,.22,edge,x,-1.12,z);
const wheel=new THREE.Mesh(new THREE.TorusGeometry(.43,.16,8,13),dark);wheel.rotation.y=Math.PI/2;wheel.position.set(x,-1.93,z);gear.add(wheel)}
for(const side of [-1,1])box(g,.8,.06,.4,red,side*6.4,-.08,2);
return g}
export const aircraft=buildKestrel();scene.add(aircraft);
export const shadowDisc=new THREE.Mesh(new THREE.CircleGeometry(11,32),new THREE.MeshBasicMaterial({color:'#102023',transparent:true,opacity:.13,depthWrite:false}));
shadowDisc.rotation.x=-Math.PI/2;scene.add(shadowDisc);
const droneMaterial=mat('#4b575e',.38,.57);
export const drones=[0,1,2].map(i=>{const g=new THREE.Group();
const fus=new THREE.Mesh(new THREE.ConeGeometry(.9,9,5),droneMaterial);fus.rotation.x=-Math.PI/2;g.add(fus);
poly(g,[[0,-1.7],[1.1,-.6],[6,2.7],[5.8,3.2],[0,1.9]],droneMaterial,.12);
poly(g,[[0,-1.7],[-1.1,-.6],[-6,2.7],[-5.8,3.2],[0,1.9]],droneMaterial,.12);
const fin=new THREE.Mesh(new THREE.ConeGeometry(.75,2.5,3),red);fin.position.set(0,1.1,3);g.add(fin);
scene.add(g);return {model:g,index:i,alive:true,angle:i*2.5+.3,
center:V([300,-2100,1400][i],0,[-3100,-4600,-5300][i]),radius:[650,900,850][i],altitude:[1050,1300,1550][i],speed:[.21,.15,.17][i]}});