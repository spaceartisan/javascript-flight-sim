// Browser-level smoke QA for AERONAUT desktop and mobile flight controls.
// Start a local server and run with: node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({
 headless:true,channel:'chrome',args:['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
await fs.mkdir('test-results',{recursive:true});

async function testMode(name,viewport,isMobile){
 const page=await browser.newPage({viewport,isMobile,hasTouch:isMobile,deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err.stack||err)));
 try{
  await page.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startButton').click({timeout:15000});
  await page.locator('#hud').waitFor({state:'visible',timeout:15000});
  await page.waitForTimeout(1400);
  assert.equal(errors.length,0,name+' script errors: '+errors.join('\n'));
  const mode=await page.evaluate(async()=>{
   const {flight}=await import('./sim.js');
   return {started:flight.started,velocity:flight.airspeed};
  });
  assert.equal(mode.started,true,name+' failed to start simulation');
  assert(await page.locator('#sim').isVisible(),name+' canvas missing');
  if(isMobile){
   assert(await page.locator('#mobile').isVisible(),name+' mobile controls missing');
   const visible=await page.evaluate(()=>{
    const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    return {screen:{w:innerWidth,h:innerHeight},console:box('mobile'),dock:box('mobileThrottle'),actions:box('mobileFire'),stick:box('stickZone')};
   });
   assert(visible.dock.width>75,name+' throttle too narrow');
   assert(visible.actions.width>50,name+' fire action too narrow');
   assert(visible.stick.width>120,name+' flight touch area too narrow');
   const zone=await page.locator('#stickZone').boundingBox();
   assert(zone,name+' touch region not rendered');
   const origin={x:zone.x+Math.min(90,zone.width*.25),y:zone.y+Math.min(70,zone.height*.3)};
   await page.mouse.move(origin.x,origin.y);
   await page.mouse.down();
   await page.mouse.move(origin.x+40,origin.y+50,{steps:6});
   let axes=await page.evaluate(async()=>{const c=await import('./controls.js');return c.readControls(new Set())});
   assert(axes.pitch>.25&&axes.roll>.15,name+' floating stick did not drive pitch/roll: '+JSON.stringify(axes));
   await page.mouse.up();
   axes=await page.evaluate(async()=>{const c=await import('./controls.js');return c.readControls(new Set())});
   assert(Math.abs(axes.pitch)<.01&&Math.abs(axes.roll)<.01,name+' floating stick remained pressed');
   await page.locator('#mobileThrottle').evaluate(el=>{
    el.value='66';el.dispatchEvent(new Event('input',{bubbles:true}));
   });
   const power=await page.evaluate(async()=>{const {flight}=await import('./sim.js');return flight.throttle});
   assert(power>.64&&power<.68,name+' mobile throttle not wired: '+power);
   await page.locator('#mobilePause').click();
   assert(await page.locator('#pauseScreen').isVisible(),name+' pause screen missing');
   await page.locator('#restartFlight').click();
   assert(!(await page.locator('#pauseScreen').isVisible()),name+' unable to resume/restart');
   assert.equal(await page.locator('#mobileThrottle').inputValue(),'0',name+' throttle did not reset');
  }else{
   await page.keyboard.down('Shift');
   await page.waitForTimeout(900);
   await page.keyboard.up('Shift');
   const power=await page.evaluate(async()=>{const {flight}=await import('./sim.js');return flight.throttle});
   assert(power>.08,name+' keyboard throttle failed');
   await page.keyboard.press('h');
   assert(await page.locator('#helpScreen').isVisible(),'help manual failed to open');
   await page.locator('#closeHelp').click();
   await page.keyboard.press('p');
   assert(await page.locator('#pauseScreen').isVisible(),'keyboard pause failed');
   await page.locator('#resumeFlight').click();
   assert(!(await page.locator('#pauseScreen').isVisible()),'resume failed');
  }
  await page.screenshot({path:`test-results/${name}.png`,fullPage:true});
  console.log(name+': PASS — cockpit started, input, layout and pause/restart');
 }finally{await page.close()}
}
try{
 await testMode('desktop-1280x720',{width:1280,height:720},false);
 await testMode('mobile-landscape-844x390',{width:844,height:390},true);
 await testMode('mobile-portrait-390x844',{width:390,height:844},true);
}finally{await browser.close()}
