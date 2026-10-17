/**
 * AERONAUT / terrain material v0.4
 *
 * Six authored, seamless ground maps: soil, arid scrub, weathered rock.
 * Color in WebP; tangent-style normal XY plus perceptual roughness in RGBA WebP.
 * A single PBR shader blends by world elevation, normal/slope and multi-scale
 * geographic noise. Runway fringe is disturbed dry soil, not green pixels.
 * Triplanar projection on steep rock prevents texture stretching.
 *
 * No static sunlight is painted into the texture maps: MeshStandardMaterial
 * preserves actual scene lighting, shadows, fog, and tone mapping.
 */
import * as THREE from 'three';

const surfaceNames=['dirt','scrub','rock'];
const loader=new THREE.TextureLoader();
export const groundMaps={};
for(const name of surfaceNames){
  const read=(suffix,srgb)=>{
    const texture=loader.load(new URL('./assets/terrain/'+name+'-'+suffix+'.webp',import.meta.url).href,
      undefined,undefined,error=>console.warn('[AERONAUT] terrain map unavailable',name,suffix,error));
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.anisotropy=4;
    texture.name='AERONAUT / '+name+' / '+suffix;
    return texture;
  };
  groundMaps[name]={color:read('albedo',true),normalRough:read('normal-roughness',false)};
}

export function createTerrainMaterial(){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:.91,side:THREE.FrontSide});
 material.name='AERONAUT / geological terrain / three-layer PBR';
 material.onBeforeCompile=shader=>{
  for(const name of surfaceNames){
   const cap=name[0].toUpperCase()+name.slice(1);
   shader.uniforms['uTerrain'+cap+'Color']={value:groundMaps[name].color};
   shader.uniforms['uTerrain'+cap+'NR']={value:groundMaps[name].normalRough};
  }
  shader.vertexShader=`varying vec3 vAeroTerrainPos;
varying vec3 vAeroTerrainNorm;
`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    vAeroTerrainPos=position;
    vAeroTerrainNorm=normal;`
  );
  shader.fragmentShader=`
varying vec3 vAeroTerrainPos;
varying vec3 vAeroTerrainNorm;
uniform sampler2D uTerrainDirtColor;
uniform sampler2D uTerrainScrubColor;
uniform sampler2D uTerrainRockColor;
uniform sampler2D uTerrainDirtNR;
uniform sampler2D uTerrainScrubNR;
uniform sampler2D uTerrainRockNR;

float groundHash(vec2 p){
 return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float groundNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.0-2.0*f);
 return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),
            mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);
}
float groundFbm(vec2 p){
 float a=0.5, n=0.0;
 for(int j=0;j<4;j++){n+=groundNoise(p)*a;p=p*2.07+vec2(17.13,9.71);a*=0.5;}
 return n;
}
vec3 terrainMixWeights(vec3 p,vec3 n,float macro,float mid){
 float slope=1.-abs(normalize(n).y);
 float rock=clamp(smoothstep(.15,.48,slope)*.97 +
                   smoothstep(390.,1420.,p.y)*.58 +
                   smoothstep(.73,.89,macro)*.22,0.,.97);
 float nearAirbase=1.-smoothstep(750.,2500.,length(p.xz*vec2(.9,.67)));
 float scrub=smoothstep(.34,.72,macro*.72+mid*.35+.025) *
             (1.-smoothstep(700.,1450.,p.y)) *
             (1.-rock)*(.98-.75*nearAirbase);
 float soil=(1.-rock-scrub)+nearAirbase*.34;
 return max(vec3(.002),vec3(soil,scrub,rock))/
   max(.0001,soil+scrub+rock+nearAirbase*.34);
}
vec4 sampleRock(sampler2D tex,vec3 p,vec3 n){
 vec3 weights=pow(abs(normalize(n)),vec3(6.));
 weights/=max(.00001,weights.x+weights.y+weights.z);
 float scale=.028;
 vec4 alongX=texture2D(tex,p.yz*scale);
 vec4 alongY=texture2D(tex,p.xz*scale);
 vec4 alongZ=texture2D(tex,p.xy*scale);
 return alongX*weights.x+alongY*weights.y+alongZ*weights.z;
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <map_fragment>',
   `#include <map_fragment>
   float largeScale=groundFbm(vAeroTerrainPos.xz*.00039);
   float middleScale=groundFbm(vAeroTerrainPos.xz*.0038);
   vec3 terrainWeights=terrainMixWeights(vAeroTerrainPos,vAeroTerrainNorm,largeScale,middleScale);
   vec2 groundUv=vAeroTerrainPos.xz*.036;
   vec3 soilTex=texture2D(uTerrainDirtColor,groundUv).rgb;
   vec3 scrubTex=texture2D(uTerrainScrubColor,groundUv*.87+vec2(.31,.17)).rgb;
   vec3 rockTex=sampleRock(uTerrainRockColor,vAeroTerrainPos,vAeroTerrainNorm).rgb;
   vec3 macroTint=vec3(.92,.94,.88)+(largeScale-.46)*vec3(.25,.27,.22)
                    +(middleScale-.47)*vec3(.12,.10,.05);
   // Terrain colors remain low-saturation for consistent aviation visibility.
   vec3 groundColor=(soilTex*terrainWeights.x+
      scrubTex*terrainWeights.y+rockTex*terrainWeights.z)*macroTint;
   diffuseColor.rgb*=clamp(groundColor,vec3(.075),vec3(.96));
   vec4 soilNR=texture2D(uTerrainDirtNR,groundUv);
   vec4 scrubNR=texture2D(uTerrainScrubNR,groundUv*.87+vec2(.31,.17));
   vec4 rockNR=sampleRock(uTerrainRockNR,vAeroTerrainPos,vAeroTerrainNorm);
   vec4 blendedNR=soilNR*terrainWeights.x+scrubNR*terrainWeights.y+rockNR*terrainWeights.z;`
  );
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <roughnessmap_fragment>',
   `#include <roughnessmap_fragment>
   roughnessFactor=clamp(blendedNR.a,.48,.99);`
  );
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <normal_fragment_maps>',
   `#include <normal_fragment_maps>
   // Small detail normals in view space; slope comes from geometric normals.
   vec3 groundRelief=blendedNR.rgb*2.-1.;
   vec3 detailView=mat3(viewMatrix)*vec3(groundRelief.x,0.,groundRelief.y);
   normal=normalize(normal+detailView*.21);`
  );
 };
 material.customProgramCacheKey=()=> 'aeronaut-terrain-pbr-v4';
 return material;
}
