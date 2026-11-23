import {surahs} from '../src/data.js';
import {test,expect} from '@playwright/test';
import {openBridge,connectBoundary,opening,currentOpening,selectBridgeEnding} from './bridge-helper.js';
for(const mobile of [false,true])test.describe(mobile?'390px Grand Crossing':'desktop Grand Crossing',()=>{
 test.use({viewport:mobile?{width:390,height:844}:{width:1366,height:1000},hasTouch:mobile,reducedMotion:mobile?'reduce':'no-preference'});
 test('five ayahs build four spans automatically, carry a load, repair and reinforce without duplicate rewards',async({page})=>{
  const prefix=`docs/bridge-builder/3-${mobile?'mobile':'desktop'}`;
  await openBridge(page,{end:5,difficulty:'standard',rules:'practice'});
  await page.evaluate(()=>document.documentElement.dataset.theme='night-sky');
  await page.locator('.bridge-stage').evaluate(e=>e.scrollTop=0);await page.locator('.bridge-stage').screenshot({path:`${prefix}-building.png`,animations:'disabled'});
  for(let ayah=2;ayah<=5;ayah++){
   await selectBridgeEnding(page);const choice=page.locator('[data-bridge-choice]').filter({has:page.getByText(await currentOpening(page,ayah),{exact:true})});
   await choice.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await choice.boundingBox();if(mobile)await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
   if(ayah===2){await page.clock.runFor(700);await page.locator('.bridge-stage').evaluate(e=>e.scrollTop=0);await page.locator('.bridge-stage').screenshot({path:`${prefix}-connection.png`,animations:'disabled'});await page.clock.runFor(1700);}else await page.clock.runFor(2400);
   await expect(page.locator('.memory-span.built')).toHaveCount(ayah-1);
   await expect(page.locator('[data-bridge-action=next]')).toHaveCount(0);
  }
  await expect(page.locator('.bridge-builder')).toHaveAttribute('data-state','won');const structureBox=await page.locator('[data-memory-structure]').boundingBox(),statusBox=await page.locator('.bridge-status').boundingBox();expect(structureBox.y+structureBox.height).toBeLessThanOrEqual(statusBox.y);
  const before=await page.evaluate(()=>({history:JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history,learning:JSON.parse(localStorage.getItem('ayah-learning-v1'))}));
  await page.clock.runFor(1000);await expect(page.locator('.memory-traveler')).toBeVisible();
  await page.locator('.bridge-stage').evaluate(e=>e.scrollTop=0);await page.locator('.bridge-stage').screenshot({path:`${prefix}-load.png`,animations:'disabled'});
  await page.locator('.bridge-toolbar [data-bridge-action=pause]').click();
  const x=await page.locator('.memory-traveler').getAttribute('x');await page.clock.runFor(1000);expect(await page.locator('.memory-traveler').getAttribute('x')).toBe(x);
  await page.locator('.gameplay-toolbar [data-game-command=settings]').click();await page.locator('.gameplay-settings [data-game-command=resume]').click();
  await page.clock.runFor(6000);await expect(page.locator('[data-bridge-panel] h4').first()).toHaveText('Grand Crossing complete! ✦');
  await page.locator('.bridge-stage').evaluate(e=>e.scrollTop=0);await page.locator('.bridge-stage').screenshot({path:`${prefix}-grand.png`,animations:'disabled'});
  await page.locator('[data-bridge-action=heavy]').click();await expect(page.locator('.memory-strength')).toContainText('Add braces');
  for(let ayah=2;ayah<=5;ayah++){
   await page.locator('[data-bridge-action=reinforce]').click();
   if(ayah===2){await page.locator('.bridge-stage').evaluate(e=>e.scrollTop=0);await page.locator('.bridge-stage').screenshot({path:`${prefix}-repair.png`,animations:'disabled'});await page.locator('.bridge-toolbar [data-bridge-action=listen]').click();expect(await page.evaluate(()=>window.bridgeAudio.at(-1).src)).toContain('001001');}
   const c=page.locator('[data-reinforce-choice]').filter({has:page.locator('.arabic').filter({hasText:new RegExp('^'+surahs[0].verses[ayah-1].words[0])})});if(mobile)await c.tap();else await c.click();
  }
  await expect(page.locator('.memory-span.braced')).toHaveCount(4);await page.locator('[data-bridge-action=heavy]').click();await page.clock.runFor(6500);
  await expect(page.locator('.memory-strength')).toContainText('Crossing complete');
  const after=await page.evaluate(()=>({history:JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history,learning:JSON.parse(localStorage.getItem('ayah-learning-v1'))}));
  expect(after).toEqual(before);expect(after.history.filter(h=>h.game==='bridge')).toHaveLength(4);expect(Object.values(after.learning.records).flatMap(r=>r.memory.history)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize(mobile?{width:844,height:390}:{width:1024,height:768});await expect(page.locator('.memory-span.built')).toHaveCount(4);
 });
});
