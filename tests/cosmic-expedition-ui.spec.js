import {test,expect} from '@playwright/test';
import {flyTo} from './cosmic-flow-helper.js';
import {freeAyah} from '../src/quest/cosmic/gateways.js';
import {canonicalLinkAyah} from '../src/quest/cosmic/link-content.js';
test.setTimeout(360000);
async function plan(page){
  await page.addInitScript(()=>{window.expeditionAudio=[];window.Audio=class{constructor(src){this.src=src;window.expeditionAudio.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}load(){}removeAttribute(){}};});
  await page.route('**/rest/v1/rpc/published_segmentation_review',r=>r.fulfill({json:null}));await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();await page.locator('[name=surah]').selectOption('112');await page.locator('[name=selection]').selectOption('entire');await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption('ayahs');await page.locator('[data-flow-guidance]').uncheck();await page.locator('[data-launch-expedition]').click();await expect(page.locator('[data-exp-resume]')).toBeVisible();
}
async function recognize(page){
  if(await page.locator('[data-gateway-ready]').count())await page.locator('[data-gateway-ready]').click();const ref=await page.locator('.cosmic-memory-gateway').getAttribute('data-target-ref');await page.locator(`[data-ayah-ref="${ref}"]`).click();await page.locator('[data-gateway-choose]').click();await page.locator('[data-gateway-continue]').click();
}
async function defend(page){
  for(let i=0;i<1800;i++){
    const s=await page.locator('.meteor-defense').getAttribute('data-defense-state');if(s==='checkpoint')return;if(s==='gateway'){await recognize(page);continue;}if(s==='paused'){await page.getByRole('button',{name:'Resume defense',exact:true}).click();continue;}if(s==='recovery'){await page.getByRole('button',{name:'Retry wave · keep recognition progress',exact:true}).click();continue;}
    const angle=await page.locator('[data-defense-objects]').evaluate(n=>{const m=[...n.querySelectorAll('.defense-meteor')].map(o=>({x:+o.getAttribute('cx'),y:+o.getAttribute('cy')})).sort((a,b)=>Math.hypot(a.x-500,a.y-340)-Math.hypot(b.x-500,b.y-340))[0];return m?Math.atan2(m.y-340,m.x-500)*180/Math.PI:null;});
    if(angle!==null){await page.locator('[data-defense-aim]').evaluate((n,v)=>{n.value=String(v);n.dispatchEvent(new Event('input',{bubbles:true}));},angle);await page.locator('[data-defense-fire]').click();}await page.clock.runFor(250);
  }throw Error('Defense did not finish');
}
test('entire surah expedition plays all activities, resumes after leaving and finishes with genuine native recall assessment',async({page})=>{
  await plan(page);await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  for(let round=0;round<3;round++){
    await page.locator('[data-exp-resume]').click();await page.getByRole('button',{name:'Start flight',exact:true}).click();await flyTo(page);
    if(round===0){await page.locator('#nav-learn').click();await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Resume saved expedition/}).click();await expect(page.locator('[data-exp-resume]')).toContainText('Star Runner');await expect(page.locator('.cosmic-expedition')).toContainText('round 2/3');}
    else await page.getByRole('button',{name:'Continue expedition',exact:true}).click();
  }
  await expect(page.locator('[data-exp-resume]')).toContainText('Meteor Defense');await page.locator('[data-exp-resume]').click();await page.getByRole('button',{name:'Start Meteor Defense',exact:true}).click();await expect(page.locator('.meteor-defense')).toHaveAttribute('data-defense-state','running');
  await expect.poll(()=>page.evaluate(()=>window.expeditionAudio.filter(a=>a.active).length)).toBe(1);await defend(page);await page.getByRole('button',{name:'Continue expedition',exact:true}).click();
  await expect(page.locator('[data-exp-resume]')).toContainText('Ayah Link');await page.locator('[data-exp-resume]').click();await page.getByRole('button',{name:'Start Ayah Link',exact:true}).click();
  for(let ayah=2;ayah<=4;ayah++){
    if(await page.locator('[data-link-skip]').count())await page.locator('[data-link-skip]').click();
    await page.locator('[data-link-choices]').click();await page.locator(`[data-word-id="112:${ayah}:0"]`).click();await page.clock.runFor(400);await page.locator('[data-link-enter]').click();await page.clock.runFor(900);await page.locator('[data-link-continue]').click();
  }
  await page.getByRole('button',{name:'Continue expedition',exact:true}).click();await page.locator('[data-exp-resume]').click();await page.getByRole('button',{name:'Begin boss encounter',exact:true}).click();
  for(const kind of ['next','connection','missing','opening','multi']){
    await expect(page.locator('.cosmic-boss')).toHaveAttribute('data-boss-kind',kind);await page.locator('[data-boss-ready]').click();
    if(kind==='next')await page.locator('[data-boss-choice="112:2"]').click();
    if(kind==='connection')await page.locator('[data-boss-choice="112:2:0"]').click();
    if(kind==='missing'){for(let i=0;i<canonicalLinkAyah('112:2').words.length;i++)await page.locator(`.boss-bank [data-boss-tile="word:112:2:${i}"]`).click();await page.locator('[data-boss-check]').click();}
    if(kind==='opening'){await page.locator('[data-boss-text]').fill(canonicalLinkAyah('112:2').words[0].text);await page.getByRole('button',{name:'Check opening',exact:true}).click();}
    if(kind==='multi'){await page.locator('[data-boss-declared]').click();await page.locator('[data-boss-match]').click();}
    await page.locator('[data-boss-continue]').click();
  }
  await page.locator('[data-boss-finish]').click();await expect(page.locator('.cosmic-expedition')).toContainText('4 / 4 ayahs accounted for');await expect(page.locator('.cosmic-expedition')).toContainText('3 / 3 internal links');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1'))?.active)).toBeFalsy();
  await page.locator('[data-exp-final]').click();await expect(page.locator('.exp-comparison')).toHaveCount(0);await page.locator('[data-final-begin]').click();await page.locator('[data-final-declare]').click();await page.locator('[data-final-reveal]').click();await expect(page.locator('.exp-comparison article')).toHaveCount(4);await page.locator('[data-final-grade="Good"]').click();await expect(page.locator('.exp-finish')).toContainText('recall assessed');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-expeditions-v1')));expect(Object.values(saved.runs)[0].final.result).toMatchObject({grade:'Good',independent:true,assessmentSource:'self-assessed'});await page.screenshot({path:'/workspace/artifacts/expedition-finish.png',fullPage:true});
});
test('mobile route and pending recall resume across reload without exposing hidden text',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await plan(page);
  // Fixture isolates final recall UI; the complete playable route is exercised above.
  await page.evaluate(async()=>{const {createMission}=await import('/src/quest/cosmic/mission.js'),{createExpeditionStore,expeditionTasks}=await import('/src/quest/cosmic/expedition/store.js');const m=await createMission({surahId:112,selection:'entire'}),s=createExpeditionStore();for(const t of expeditionTasks(m))s.complete(m,t.id);});
  await page.locator('[data-exp-exit]').click();await page.locator('[data-launch-expedition]').click();await page.locator('[data-exp-final]').click();await page.locator('[data-final-begin]').click();await page.reload();await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Resume saved expedition/}).click();await page.locator('[data-exp-final]').click();await expect(page.locator('[data-final-declare]')).toBeVisible();await expect(page.locator('.exp-comparison')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'/workspace/artifacts/expedition-mobile.png',fullPage:true});
  await page.locator('[data-final-audio]').click();await expect.poll(()=>page.evaluate(()=>window.expeditionAudio.some(a=>a.active))).toBe(true);await page.locator('[data-final-declare]').click();await page.locator('[data-final-reveal]').click();await page.locator('[data-final-grade="Hard"]').click();await expect(page.locator('.exp-finish')).toContainText('Assisted practice assessment');
});
