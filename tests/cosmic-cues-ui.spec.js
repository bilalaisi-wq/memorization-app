import {test,expect} from '@playwright/test';
import {createFlowUnits} from '../src/quest/cosmic/flow-content.js';
async function open(page,style='words',ref='1:3',failure=false){
  await page.addInitScript(({failure})=>{window.cues=[];window.allowCue=!failure;window.Audio=class{constructor(src){this.src=src;window.cues.push(this);}async play(){if(!window.allowCue)throw Error('autoplay blocked');this.active=true;}pause(){this.active=false;}removeAttribute(){}load(){}};},{failure});
  await page.goto('/');await page.locator('#nav-revision-lab').click();await expect(page.locator('.cosmic-form')).toBeVisible();
  const [surah,ayah]=ref.split(':');await page.locator('[name=surah]').selectOption(surah);await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill(ayah);await page.locator('[name=end]').fill(ayah);
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption(style);await expect(page.locator('[data-flow-guidance]')).toBeChecked();await page.clock.install();
  await page.locator('[data-launch-runner]').click();await expect(page.getByRole('button',{name:'Start flight',exact:true})).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await page.getByRole('button',{name:'Start flight',exact:true}).click();
}
const finish=page=>page.evaluate(()=>window.cues.find(a=>a.active)?.onended?.());
const elapsed=page=>page.locator('.runner-field').evaluate(n=>Number(n.style.getPropertyValue('--flight-time')));
test('default word cue slows moving hazards, restores speed and cues the next individual word once',async({page})=>{
  await open(page);await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','running');await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','true');
  const words=createFlowUnits(['1:3'],'words');expect(await page.evaluate(()=>window.cues.find(a=>a.active)?.src)).toBe(words[0].audio);
  const before=await elapsed(page);await page.clock.runFor(1000);expect((await elapsed(page))-before).toBeCloseTo(.175,1);
  await finish(page);await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','false');
  const resumed=await elapsed(page);await page.clock.runFor(1000);expect((await elapsed(page))-resumed).toBeCloseTo(.7,1);
  for(let i=0;i<50;i++){
    const current=await page.locator('.star-runner').getAttribute('data-expected-unit');if(current===words[1].id)break;
    const lane=await page.locator('.star-runner').evaluate(n=>{const t=[...n.querySelectorAll('.runner-pickup')].find(o=>o.dataset.unitId===n.dataset.expectedUnit);return t?Number(t.dataset.pickupLane):null;});
    if(lane!==null)for(let j=0;j<2;j++){const now=Number(await page.locator('.star-runner').getAttribute('data-lane'));if(now===lane)break;await page.locator('.runner-field').focus();await page.keyboard.press(now<lane?'ArrowRight':'ArrowLeft');}
    await page.clock.runFor(200);
  }
  await expect(page.locator('.star-runner')).toHaveAttribute('data-expected-unit',words[1].id);await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','true');
  expect(await page.evaluate(()=>window.cues.filter(a=>a.src===window.cues[0].src).length)).toBe(1);expect(await page.evaluate(()=>window.cues.find(a=>a.active)?.src)).toBe(words[1].audio);
  await page.locator('#nav-learn').click();expect(await page.evaluate(()=>window.cues.some(a=>a.active))).toBe(false);
});
test('chunk cue plays the verified words consecutively and full ayah uses its own recording',async({page})=>{
  await open(page,'mixed');const words=createFlowUnits(['1:3'],'words');
  await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','true');await finish(page);
  await expect.poll(()=>page.evaluate(()=>window.cues.find(a=>a.active)?.src)).toBe(words[1].audio);
  await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','true');await finish(page);await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','false');
  expect(await page.evaluate(()=>window.cues.map(a=>a.src))).toEqual(words.map(w=>w.audio));
});
test('the requested full ayah cue plays once, and failed autoplay recovers without stopping flight',async({page})=>{
  await open(page,'ayahs','83:10',true);
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','running');await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','false');await expect(page.locator('[data-cue-note]')).toContainText('unavailable');
  await page.evaluate(()=>window.allowCue=true);await page.locator('[data-flow-cue]').click();await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','true');
  expect(await page.evaluate(()=>window.cues.find(a=>a.active)?.src)).toBe(createFlowUnits(['83:10'],'ayahs')[0].audio);
  await finish(page);await expect(page.locator('.star-runner')).toHaveAttribute('data-cue-slow','false');await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','running');
  await page.locator('[data-flow-cue]').click();await page.locator('[data-flight-pause]').click();expect(await page.evaluate(()=>window.cues.some(a=>a.active))).toBe(false);
});
