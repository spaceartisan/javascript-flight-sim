/**
 * AERONAUT console operations menu.
 * PS2-era navigation: selectable commands, no marketing landing page.
 * Fully usable via touch, keyboard and standard gamepad.
 */
import {settings,updateSettings,gamepad} from './controls.js';
const $=id=>document.getElementById(id);
const commands=['startButton','menuTraining','menuOptions'];
const preference='aeronaut-menu-audio-v1';
export function installBootMenu({onStart,onManual,sound,started}){
 const screen=$('startScreen'),menu=$('bootMenu'),options=$('bootOptions');
 const buttons=commands.map($);
 let selected=0,closed=false,prevButtons=[],prevAxis=0,lastAxis=0;
 let audioEnabled=true;
 try{audioEnabled=localStorage.getItem(preference)!=='off'}catch{}
 function select(i,focus=false){
  selected=(i+buttons.length)%buttons.length;
  buttons.forEach((button,n)=>{
   const chosen=n===selected;
   button.classList.toggle('selected',chosen);
   if(chosen)button.setAttribute('aria-current','true');
   else button.removeAttribute('aria-current');
  });
  if(focus)buttons[selected].focus({preventScroll:true});
 }
 function syncOptions(){
  $('menuInvertPitch').checked=settings.invertPitch;
  $('menuSensitivity').value=String(settings.sensitivity);
  $('menuDeadzone').value=String(settings.deadzone);
  $('menuSensitivityValue').textContent=Math.round(settings.sensitivity*100)+'%';
  $('menuDeadzoneValue').textContent=Math.round(settings.deadzone*100)+'%';
  $('menuAudioState').textContent=audioEnabled?'ENABLED':'MUTED';
 }
 function openOptions(){
  syncOptions();
  options.classList.remove('hidden');
  $('menuBack').focus({preventScroll:true});
 }
 function closeOptions(){
  options.classList.add('hidden');select(2,true);
 }
 function openManual(){
  // Shared settings are authoritative; update the pre-existing help controls.
  $('invertPitch').checked=settings.invertPitch;
  $('sensitivity').value=String(settings.sensitivity);
  $('deadzone').value=String(settings.deadzone);
  $('sensitivityValue').textContent=Math.round(settings.sensitivity*100)+'%';
  $('deadzoneValue').textContent=Math.round(settings.deadzone*100)+'%';
  onManual();
 }
 function confirm(i=selected){
  if(started()||closed)return;
  select(i);
  if(i===0){
   closed=true;screen.classList.add('boot-departing');
   sound.init();
   if(!audioEnabled&&!sound.muted)sound.mute();
   // No timer, no loading gate: start immediately on the player gesture.
   screen.classList.add('hidden');
   onStart();
  }else if(i===1)openManual();
  else openOptions();
 }
 buttons.forEach((button,i)=>{
  button.addEventListener('pointerenter',()=>{if(!options.classList.contains('hidden'))return;select(i)});
  button.addEventListener('focus',()=>{if(options.classList.contains('hidden'))select(i)});
  button.addEventListener('click',()=>confirm(i));
 });
 $('bootOptionsClose').addEventListener('click',closeOptions);
 $('menuBack').addEventListener('click',closeOptions);
 const pitch=$('menuInvertPitch'),sensitivity=$('menuSensitivity'),deadzone=$('menuDeadzone');
 pitch.addEventListener('change',()=>{updateSettings({invertPitch:pitch.checked});syncOptions()});
 sensitivity.addEventListener('input',()=>{updateSettings({sensitivity:Number(sensitivity.value)});syncOptions()});
 deadzone.addEventListener('input',()=>{updateSettings({deadzone:Number(deadzone.value)});syncOptions()});
 $('menuAudio').addEventListener('click',()=>{
  audioEnabled=!audioEnabled;
  try{localStorage.setItem(preference,audioEnabled?'on':'off')}catch{}
  if(sound.ctx && sound.muted===audioEnabled)sound.mute();
  syncOptions();
 });
 document.addEventListener('keydown',e=>{
  if(started()||closed||screen.classList.contains('hidden'))return;
  if(!options.classList.contains('hidden')){
   if(e.key==='Escape'){e.preventDefault();closeOptions()}
   return;
  }
  if(!$('helpScreen').classList.contains('hidden')){
   if(e.key==='Escape'){$('helpScreen').classList.add('hidden');e.preventDefault();select(1,true)}
   return;
  }
  if(e.code==='ArrowDown'||e.code==='KeyS'){select(selected+1,true);e.preventDefault()}
  else if(e.code==='ArrowUp'||e.code==='KeyW'){select(selected-1,true);e.preventDefault()}
  else if(e.code==='Enter'||e.code==='Space'){
   e.preventDefault();
   // Native button Enter behavior would otherwise fire a second click.
   if(e.target.tagName==='BUTTON'&&commands.includes(e.target.id))return;
   confirm();
  }
 });
 function tick(){
  if(started()||closed)return;
  const buttonsNow=gamepad.buttons;
  if(!gamepad.connected){prevButtons=[];prevAxis=0;return}
  const down=(i)=>(buttonsNow[i]||0)>.55;
  const pressed=i=>down(i)&&!((prevButtons[i]||0)>.55);
  const axis=gamepad.axes[1]||0;
  const dir=down(13)?1:down(12)?-1:axis>.65?1:axis<-.65?-1:0;
  if(options.classList.contains('hidden')&&$('helpScreen').classList.contains('hidden')){
   if(dir!==0&&(dir!==prevAxis||performance.now()-lastAxis>330)){
    select(selected+dir,true);lastAxis=performance.now();
   }
   if(pressed(0))confirm();
  }else if(pressed(1)){
   if(!options.classList.contains('hidden'))closeOptions();
   else {$('helpScreen').classList.add('hidden');select(1,true)}
  }
  prevButtons=[...buttonsNow];prevAxis=dir;
 }
 return {tick,select,confirm,get selected(){return selected},get audioEnabled(){return audioEnabled}};
}
