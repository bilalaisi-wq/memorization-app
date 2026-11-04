import {test,expect} from '@playwright/test';
import {flyTo} from './cosmic-flow-helper.js';
test.setTimeout(90000);
async function open(page,activity='defense'){
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=surah]').selectOption('112');await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('2');await page.locator('[name=end]').fill('2');
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption('ayahs');await page.locator('[data-flow-guidance]').uncheck();
  await page.clock.install();await page.locator(activity==='defense'?'[data-launch-defense]':'[data-launch-runner]').click();
  const start=page.getByRole('button',{name:activity==='defense'?'Start Meteor Defense':'Start flight',exact:true});await expect(start).toBeVisible();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));await start.click();
}
async function recognize(page,wrong=false){
  await page.locator('[data-gateway-ready]').click();const ref=await page.locator('.cosmic-memory-gateway').getAttribute('data-target-ref');
  await page.locator(wrong?`.gateway-choice [data-ayah-ref]:not([data-ayah-ref="${ref}"])`:`[data-ayah-ref="${ref}"]`).first().click();await page.locator('[data-gateway-choose]').click();
}
async function defend(page){
  for(let i=0;i<400;i++){
    const state=await page.locator('.meteor-defense').getAttribute('data-defense-state');
    if(state==='checkpoint')return;
    if(state==='gateway'){const g=await page.locator('.cosmic-memory-gateway').getAttribute('data-gateway-state');if(g==='open')await page.locator('[data-gateway-continue]').click();else await recognize(page);continue;}
    if(state==='paused'){await page.getByRole('button',{name:'Resume defense',exact:true}).click();continue;}
    if(state==='recovery'){await page.getByRole('button',{name:'Retry wave · keep recognition progress',exact:true}).click();continue;}
    if(state==='wave-clear'){await page.getByRole('button',{name:'Next Quran checkpoint',exact:true}).click();continue;}
    const angle=await page.locator('[data-defense-objects]').evaluate(n=>{const targets=[...n.querySelectorAll('.defense-meteor')].map(o=>({x:Number(o.getAttribute('cx')),y:Number(o.getAttribute('cy'))})).sort((a,b)=>Math.hypot(a.x-500,a.y-340)-Math.hypot(b.x-500,b.y-340));return targets.length?Math.atan2(targets[0].y-340,targets[0].x-500)*180/Math.PI:null;});
    if(angle!==null){await page.locator('[data-defense-aim]').evaluate((n,value)=>{n.value=String(value);n.dispatchEvent(new Event('input',{bubbles:true}));},angle);await page.locator('[data-defense-fire]').click();}
    await page.clock.runFor(250);
  }
  await expect(page.locator('.meteor-defense')).toHaveAttribute('data-defense-state','checkpoint');
}
test('real defense has untimed recovery, charged abilities, aiming/projectiles, pause and exclusive Quran audio',async({page})=>{
  await page.addInitScript(()=>{window.defenseAudio=[];window.Audio=class{constructor(src){this.src=src;window.defenseAudio.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}load(){}removeAttribute(){}};});
  await open(page);await expect(page.locator('.meteor-defense')).toHaveAttribute('data-defense-state','gateway');await expect(page.locator('[data-defense-ability="shield"]')).toBeDisabled();
  const integrity=await page.locator('[data-core-health]').evaluate(n=>n.value);await page.clock.runFor(60000);expect(await page.locator('[data-core-health]').evaluate(n=>n.value)).toBe(integrity);await recognize(page,true);await expect(page.locator('[data-gateway-retry]')).toBeVisible();
  await page.locator('[data-gateway-hint]').click();await page.locator('[data-gateway-hint-audio]').click();expect(await page.evaluate(()=>window.defenseAudio.some(a=>a.active))).toBe(true);
  await page.locator('[data-gateway-retry]').click();expect(await page.evaluate(()=>window.defenseAudio.some(a=>a.active))).toBe(false);await recognize(page);await expect(page.locator('[data-charge="shield"]')).toContainText('1 charge');await page.locator('[data-gateway-continue]').click();
  await page.clock.runFor(1500);await page.screenshot({path:'/workspace/artifacts/meteor-desktop.png',fullPage:true});await expect(page.locator('.defense-meteor').first()).toBeVisible();
  const pos=await page.locator('.defense-meteor').first().getAttribute('cx');await page.clock.runFor(100);expect(await page.locator('.defense-meteor').first().getAttribute('cx')).not.toBe(pos);
  await page.locator('.defense-field').focus();const aim=await page.locator('[data-defense-turret]').getAttribute('transform');await page.keyboard.press('ArrowRight');expect(await page.locator('[data-defense-turret]').getAttribute('transform')).not.toBe(aim);await page.keyboard.press('Space');await expect(page.locator('.defense-energy').first()).toBeVisible();
  await page.keyboard.press('Digit1');await expect(page.locator('[data-charge="shield"]')).toContainText('0 charges');expect(await page.locator('[data-core-shield]').evaluate(n=>n.style.opacity)).toBe('1');
  await page.locator('[data-defense-pause]').click();const snapshot=await page.locator('[data-defense-objects]').innerHTML();await page.clock.runFor(3000);expect(await page.locator('[data-defense-objects]').innerHTML()).toBe(snapshot);
  await page.getByRole('button',{name:'Resume defense',exact:true}).click();await page.locator('[data-defense-listen]').click();await expect(page.locator('.meteor-defense')).toHaveAttribute('data-defense-state','paused');expect(await page.evaluate(()=>window.defenseAudio.some(a=>a.active))).toBe(true);
  await page.locator('#nav-learn').click();await expect(page.locator('.meteor-defense')).toHaveCount(0);expect(await page.evaluate(()=>window.defenseAudio.some(a=>a.active))).toBe(false);
});
test('mission director hands off Runner → Defense victory → original Runner checkpoint without native recall writes',async({page})=>{
  test.setTimeout(180000);await open(page,'runner');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1'))?.records);
  await flyTo(page);const collected=await page.locator('[data-stars]').textContent();await page.locator('[data-enter-defense]').click();await expect(page.locator('.meteor-defense')).toBeVisible();await page.getByRole('button',{name:'Start Meteor Defense',exact:true}).click();
  await defend(page);await expect(page.getByRole('button',{name:'Continue in Star Runner',exact:true})).toBeVisible();await page.getByRole('button',{name:'Continue in Star Runner',exact:true}).click();
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','checkpoint');expect(await page.locator('[data-stars]').textContent()).toBe(collected);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1'))?.records)).toEqual(before);
  const events=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('ayah-cosmic-gateways-v1')).runs));expect(events).toHaveLength(1);expect(events[0].events.some(e=>e.type==='defense:memory-correct')).toBe(true);expect(events[0].events.some(e=>e.type==='runner:pickup-correct')).toBe(true);
});
test('mobile touch aiming and fire, accessible controls, reduced motion and account cleanup',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);await recognize(page);await page.locator('[data-gateway-continue]').click();
  await page.clock.runFor(2500);const field=page.locator('.defense-field');await field.scrollIntoViewIfNeeded();const box=await field.boundingBox(),touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:box.x+box.width*.8,y:box.y+box.height*.3}]});await page.clock.runFor(100);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  await expect(page.locator('.defense-energy').first()).toBeVisible();expect(await page.locator('[data-defense-fire]').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('[data-defense-ability="pulse"]').click();
  const pulse=page.locator('.defense-pulse');const radius=await pulse.evaluate(n=>getComputedStyle(n).r);await page.clock.runFor(100);expect(await pulse.evaluate(n=>getComputedStyle(n).r)).toBe(radius);
  await page.screenshot({path:'/workspace/artifacts/meteor-mobile.png',fullPage:true});
  await page.evaluate(async()=>{(await import('/src/learner/profile-storage.js')).selectProfile('other-account');});await expect(page.locator('.meteor-defense')).toHaveCount(0);await expect(page.locator('.cosmic-rush')).toContainText('Account changed');
});
