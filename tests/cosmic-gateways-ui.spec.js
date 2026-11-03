import {flyTo} from './cosmic-flow-helper.js';
import {createLearningStore} from '../src/learning-store.js';
import {createPassageMemory} from '../src/passage/memory.js';
import {surahs} from '../src/data.js';
import {test,expect} from '@playwright/test';
test.setTimeout(180000);
async function orbit(page,{mobile=false}={}){
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    window.gatewayAudio=[];
    window.Audio=class{constructor(src){this.src=src;this.volume=1;window.gatewayAudio.push(this);}play(){this.playing=true;return Promise.resolve();}pause(){this.playing=false;}load(){}removeAttribute(){} };
  });
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=surah]').selectOption('109');await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('3');await page.locator('[name=end]').fill('3');
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption('ayahs');await page.locator('[data-flow-review]').check();await page.clock.install();
  await page.getByRole('button',{name:'Launch Star Runner',exact:true}).click();await page.getByRole('button',{name:'Start flight',exact:true}).click();
  await flyTo(page,'gateway');
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','gateway');
}
test('untimed recall-before-choices, canonical repairs and real steering resume the same frozen flight',async({page})=>{
  await orbit(page);
  const panel=page.locator('.cosmic-memory-gateway');
  await expect(panel).toHaveAttribute('data-target-ref','109:3');await expect(panel).toHaveAttribute('data-from-ref','109:2');
  await expect(page.locator('[data-gateway-select]')).toHaveCount(0);
  const progress=await page.locator('[data-flight-progress]').evaluate(n=>n.value);
  const objects=await page.locator('[data-flight-objects]').innerHTML();
  await page.clock.runFor(120000);expect(await page.locator('[data-flight-objects]').innerHTML()).toBe(objects);expect(await page.locator('[data-flight-progress]').evaluate(n=>n.value)).toBe(progress);
  await page.locator('[data-gateway-previous]').click();await expect.poll(()=>page.evaluate(()=>window.gatewayAudio.filter(a=>a.playing).length)).toBe(1);
  await page.locator('[data-gateway-ready]').click();await expect(page.locator('[data-gateway-select]')).toHaveCount(3);
  expect(await page.evaluate(()=>window.gatewayAudio.some(a=>a.playing))).toBe(false);
  const wrong=page.locator('[data-gateway-select]:not([data-ayah-ref="109:3"])').first();await wrong.click();await page.locator('[data-gateway-choose]').click();
  await expect(panel).toHaveAttribute('data-gateway-state','repair');await expect(panel).toContainText('Safe repair checkpoint');
  await page.locator('[data-gateway-hint]').click();await expect(page.locator('.gateway-hint')).toContainText('109:3');
  await expect(page.locator('[data-gateway-heading]')).toBeFocused();
  await page.locator('[data-gateway-retry]').click();await page.locator('[data-gateway-ready]').click();
  const target=Number(await page.locator('[data-ayah-ref="109:3"]').getAttribute('data-gateway-select'));
  await page.locator('.runner-field').focus();
  for(let i=0;i<2;i++){const lane=Number(await page.locator('.star-runner').getAttribute('data-lane'));if(lane===target)break;await page.keyboard.press(lane>target?'ArrowLeft':'ArrowRight');}
  await expect(page.locator('.gateway-selected [data-gateway-select]')).toHaveAttribute('data-ayah-ref','109:3');
  await page.keyboard.press('Enter');await expect(panel).toHaveAttribute('data-gateway-state','open');
  await page.locator('[data-gateway-continue]').click();await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','checkpoint');
  const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-gateways-v1')));
  const run=Object.values(ledger.runs)[0];expect(run.completed).toEqual(['109:3']);expect(run.events.filter(e=>e.type==='gateway:mistake')).toHaveLength(1);
});
test('mobile choices are readable, touch steering works, audio stays exclusive and exits cleanly with reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await orbit(page,{mobile:true});
  await page.locator('[data-gateway-ready]').click();
  const start=Number(await page.locator('.star-runner').getAttribute('data-lane'));
  await page.locator('[data-gateway-left]').click();await expect(page.locator('.star-runner')).toHaveAttribute('data-lane',String(Math.max(0,start-1)));
  await expect(page.locator('.runner-field')).toBeFocused();
  await page.locator('[data-gateway-audio="0"]').click();await page.locator('[data-gateway-audio="1"]').click();
  expect(await page.evaluate(()=>window.gatewayAudio.filter(a=>a.playing).length)).toBe(1);
  expect(await page.locator('.cosmic-memory-gateway').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#nav-learn').click();expect(await page.evaluate(()=>window.gatewayAudio.some(a=>a.playing))).toBe(false);
  await expect(page.locator('.builder')).toBeVisible();
});


test('gateway text exposure protects unfinished core and passage recall without grading or scheduling',async({page})=>{
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
  createLearningStore(storage,surahs).beginRecall('109:3');
  createPassageMemory(storage).begin({id:'ayah:109:3',type:'ayah',refs:['109:3']});
  await page.addInitScript(data=>{for(const [k,v] of data)localStorage.setItem(k,v);},[...entries]);
  await orbit(page);
  const before=await page.evaluate(()=>({core:JSON.parse(localStorage.getItem('ayah-learning-v1')),passage:JSON.parse(localStorage.getItem('ayah-passage-recall-v1'))}));
  expect(before.core.activeReview.usedHint).toBe(true);expect(before.passage.active.assisted).toBe(true);
  await page.locator('[data-gateway-ready]').click();
  const after=await page.evaluate(()=>({core:JSON.parse(localStorage.getItem('ayah-learning-v1')),passage:JSON.parse(localStorage.getItem('ayah-passage-recall-v1'))}));
  expect(after.core.activeReview.usedHint).toBe(true);expect(after.passage.active.assisted).toBe(true);
  expect(after.core.records['109:3'].memory.card).toEqual(before.core.records['109:3'].memory.card);
  expect(after.passage.records['ayah:109:3'].history).toEqual([]);
  expect(after.core.wallet).toEqual(before.core.wallet);
});

test('failed assistance protection never reveals choices and can be retried safely',async({page})=>{
  await orbit(page);
  await page.evaluate(()=>window.addEventListener('ayah-study-exposure',e=>e.preventDefault(),{once:true}));
  await page.locator('[data-gateway-ready]').click();
  await expect(page.locator('.cosmic-memory-gateway')).toContainText('Study assistance needs to be saved');
  await expect(page.locator('[data-gateway-select]')).toHaveCount(0);
  await page.locator('.runner-field').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','gateway');
  await page.locator('[data-gateway-refresh]').click();await expect(page.locator('[data-gateway-select]')).toHaveCount(3);
});
