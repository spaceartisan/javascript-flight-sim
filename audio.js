// GeneralUser GS v2.0.3 asset-powered cockpit/flight audio.
// All SF2 patches were rendered offline with tools/render-generaluser.py.
// No SoundFont, FluidSynth or Csound is downloaded or executed in the browser.
// The sample-bank is additive to subtle procedural noise for responsive sound.
const BANK=Object.freeze({
 engine:'engine-core',afterburner:'afterburner',air:'air-rush',
 select:'contact-select',lock:'seeker-lock',gear:'gear-action',
 missile:'missile-launch',impact:'impact',caution:'caution',complete:'mission-clear'
});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export class AeroAudio {
 constructor(){
  this.ctx=null;this.master=null;this.compressor=null;this.muted=false;
  this.buffers=new Map();this.failed=[];this.loading=null;this.loops={};
  this.fallback={};this.last={};this.locked=false;
 }
 init(){
  if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return}
  const AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioCtx)return;
  const ctx=this.ctx=new AudioCtx({latencyHint:'interactive'});
  const master=this.master=ctx.createGain();master.gain.value=.56;
  const compressor=this.compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-16;compressor.knee.value=20;
  compressor.ratio.value=3;compressor.attack.value=.012;compressor.release.value=.23;
  master.connect(compressor).connect(ctx.destination);
  this.makeFallback();
  this.loading=this.loadBank();
  ctx.resume().catch(()=>{});
 }
 makeFallback(){
  const ctx=this.ctx;
  const tones=[['low','sawtooth',46],['whine','triangle',94]];
  for(const [name,type,hz] of tones){
   const oscillator=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
   oscillator.type=type;oscillator.frequency.value=hz;
   filter.type='lowpass';filter.frequency.value=350;gain.gain.value=.0001;
   oscillator.connect(filter).connect(gain).connect(this.master);oscillator.start();
   this.fallback[name]={oscillator,filter,gain};
  }
  const length=ctx.sampleRate;
  const noise=ctx.createBuffer(1,length,ctx.sampleRate),data=noise.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  source.buffer=noise;source.loop=true;filter.type='lowpass';filter.frequency.value=360;
  gain.gain.value=.0001;source.connect(filter).connect(gain).connect(this.master);source.start();
  this.fallback.noise={source,filter,gain};
 }
 async loadBank(){
  const pending=Object.values(BANK).map(async name=>{
   try{
    const url=new URL('./assets/audio/'+name+'.ogg',import.meta.url);
    const response=await fetch(url);
    if(!response.ok)throw new Error('HTTP '+response.status);
    const binary=await response.arrayBuffer();
    const buffer=await this.ctx.decodeAudioData(binary);
    if(buffer.duration<=.05)throw new Error('Empty audio');
    this.buffers.set(name,buffer);
    if(['engine-core','afterburner','air-rush'].includes(name))this.startLoop(name,buffer);
   }catch(err){
    this.failed.push(name);
    console.warn('[AERONAUT audio] Sample unavailable; synthesis fallback:',name,err);
   }
  });
  await Promise.allSettled(pending);
  return {loaded:this.buffers.size,failed:[...this.failed]};
 }
 startLoop(name,buffer){
  if(!this.ctx||this.loops[name])return;
  const ctx=this.ctx,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;
  filter.type=name==='air-rush'?'bandpass':'lowpass';
  filter.frequency.value=name==='air-rush'?950:700;
  filter.Q.value=name==='air-rush'?.42:.65;
  gain.gain.value=0;
  source.connect(filter).connect(gain).connect(this.master);
  source.start();
  this.loops[name]={source,filter,gain};
 }
 setGain(node,value,tau=.12){
  if(!node||!this.ctx)return;
  node.gain.setTargetAtTime(value,this.ctx.currentTime,tau);
 }
 update(flight,view=0){
  if(!this.ctx)return;
  const ctx=this.ctx,t=ctx.currentTime,p=clamp(flight.spool||0,0,1);
  const airspeed=clamp(flight.airspeed||0,0,420);
  const cockpit=view===1,paused=flight.paused;
  const envelope=paused?.22:1,interior=cockpit?.58:1;
  const engine=this.loops['engine-core'];
  const after=this.loops['afterburner'];
  const air=this.loops['air-rush'];
  if(engine){
   engine.source.playbackRate.setTargetAtTime(.74+p*.91,t,.18);
   engine.filter.frequency.setTargetAtTime(420+3400*Math.pow(p,1.4),t,.18);
   this.setGain(engine.gain,(.065+p*.47)*envelope*interior,.17);
  }
  if(after){
   after.source.playbackRate.setTargetAtTime(.74+p*.77,t,.2);
   after.filter.frequency.setTargetAtTime(360+3100*p,t,.21);
   this.setGain(after.gain,(Math.max(0,(p-.78)/.22)**1.65)*.60*envelope*interior,.2);
  }
  if(air){
   air.source.playbackRate.setTargetAtTime(.79+airspeed/340,t,.2);
   air.filter.frequency.setTargetAtTime(620+airspeed*10,t,.15);
   this.setGain(air.gain,Math.min(.53,airspeed/540)*envelope*(cockpit?.45:1),.13);
  }
  const fb=this.fallback;
  if(fb.low){
   fb.low.oscillator.frequency.setTargetAtTime(37+p*83,t,.1);
   fb.whine.oscillator.frequency.setTargetAtTime(86+p*263,t,.1);
   fb.low.filter.frequency.setTargetAtTime(220+p*1000,t,.15);
   fb.whine.filter.frequency.setTargetAtTime(440+p*2600,t,.15);
   this.setGain(fb.low.gain,(engine?.024:.064)*(.15+p*.9)*envelope*interior,.16);
   this.setGain(fb.whine.gain,(engine?.013:.07)*(.09+p*.9)*envelope*interior,.16);
   fb.noise.filter.frequency.setTargetAtTime(260+airspeed*6,t,.17);
   this.setGain(fb.noise.gain,(air?.02:.19)*(airspeed/400)*envelope,.18);
  }
 }
 play(name,volume=1,pitch=1){
  if(!this.ctx)return false;
  const buffer=this.buffers.get(BANK[name]||name);
  if(!buffer)return false;
  const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=buffer;source.playbackRate.value=pitch;gain.gain.value=clamp(volume,0,2);
  source.connect(gain).connect(this.master);source.start();
  source.onended=()=>{source.disconnect();gain.disconnect()};
  return true;
 }
 chirp(frequency=900,duration=.15,type='sine',volume=.17){
  if(!this.ctx)return;
  const ctx=this.ctx,t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(frequency,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(75,frequency*.63),t+duration);
  g.gain.setValueAtTime(Math.max(.0001,volume*.40),t);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(this.master);
  o.start(t);o.stop(t+duration+.03);
  o.onended=()=>{o.disconnect();g.disconnect()};
 }
 oneShot(name,volume=1,cooldown=.0,fallbackHz=700){
  const now=this.ctx?.currentTime??0;
  if(now-(this.last[name]??-100)<cooldown)return;
  this.last[name]=now;
  if(!this.play(name,volume))this.chirp(fallbackHz,.22);
 }
 launch(){
  this.oneShot('missile',1.08,.08,410);
  // Keep a tiny velocity-sensitive ignition sweep beneath the rendered strike.
  this.chirp(680,.29,'sawtooth',.055);
 }
 boom(){this.oneShot('impact',1.22,.08,125)}
 gear(){this.oneShot('gear',.62,.22,330)}
 flap(){this.oneShot('gear',.35,.18,470)}
 select(){this.oneShot('select',.54,.09,930)}
 lock(){
  if(this.locked)return;
  this.locked=true;
  this.oneShot('lock',.82,.45,1100);
 }
 unlock(){this.locked=false}
 caution(){this.oneShot('caution',.70,2.6,690)}
 complete(){this.oneShot('complete',1.08,2,1110)}
 mute(){
  this.muted=!this.muted;
  if(this.ctx)this.setGain(this.master,this.muted?0:.56,.07);
  return this.muted;
 }
}
export const sound=new AeroAudio();
