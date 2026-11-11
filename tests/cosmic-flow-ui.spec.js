import {test,expect} from '@playwright/test';
import {flyTo} from './cosmic-flow-helper.js';
async function start(page,style='words'){
  await page.goto('/');await page.locator('#nav-revision-lab').click();await expect(page.locator('.cosmic-form')).toBeVisible();
  await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('3');await page.locator('[name=end]').fill('3');
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption(style);await page.locator('[data-flow-guidance]').uncheck();await page.clock.install();
  await page.locator('[data-launch-runner]').click();await page.getByRole('button',{name:'Start flight',exact:true}).click();
}
test('words flow in three lanes with real collision choices, no stars and no interrupting quiz',async({page})=>{
  test.setTimeout(90000);await start(page);
  await expect(page.locator('.runner-pickup')).toHaveCount(3);await expect(page.locator('.runner-star')).toHaveCount(0);
  await expect(page.locator('[data-gateway-ready]')).toHaveCount(0);
  const texts=await page.locator('.runner-pickup').allTextContents();expect(new Set(texts).size).toBe(3);
  const pos=await page.locator('.runner-pickup').first().getAttribute('style');await page.clock.runFor(200);expect(await page.locator('.runner-pickup').first().getAttribute('style')).not.toBe(pos);
  await flyTo(page);await expect(page.locator('[data-stars]')).toContainText('1 ayahs connected');
  await page.locator('.runner-field').focus();await page.keyboard.press('Space');await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','checkpoint');
  const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-gateways-v1')));expect(Object.values(ledger.runs)[0].completed).toEqual(['1:3']);
});
test('whole ayah ribbons remain readable on mobile and recitation pauses the flight',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{window.flowAudio=[];window.Audio=class{constructor(src){this.src=src;window.flowAudio.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}load(){}removeAttribute(){}};});
  await start(page,'ayahs');
  await expect(page.locator('.runner-ribbon').first()).toBeVisible();
  expect(await page.locator('.runner-ribbon').first().evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await page.locator('[data-flow-listen]').click();await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');
  const progress=await page.locator('[data-flight-progress]').evaluate(n=>n.value);await page.clock.runFor(30000);expect(await page.locator('[data-flight-progress]').evaluate(n=>n.value)).toBe(progress);
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();expect(await page.evaluate(()=>window.flowAudio.some(a=>a.active))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#nav-learn').click();await expect(page.locator('.builder')).toBeVisible();
});

test('flowing Quran text fails closed when study assistance cannot be recorded, then recovers',async({page})=>{
  await page.addInitScript(()=>{window.blockFlowText=e=>e.preventDefault();window.addEventListener('ayah-study-exposure',window.blockFlowText);});
  await start(page);
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');
  await expect(page.locator('.runner-pickup')).toHaveCount(0);await expect(page.locator('[data-flow-built]')).toBeEmpty();
  await page.evaluate(()=>window.removeEventListener('ayah-study-exposure',window.blockFlowText));
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();
  await expect(page.locator('.runner-pickup')).toHaveCount(3);await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','running');
});

test('round selector starts at one and chunk revision advances through four increasingly demanding rounds',async({page})=>{
  test.setTimeout(180000);
  await page.goto('/');await page.locator('#nav-revision-lab').click();await expect(page.locator('.cosmic-form')).toBeVisible();
  await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('3');await page.locator('[name=end]').fill('3');
  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await expect(page.locator('[data-flight-rounds]')).toHaveValue('1');
  expect(await page.locator('[data-flight-rounds] option').evaluateAll(nodes=>nodes.map(n=>Number(n.value)))).toEqual([1,2,3,4,5,6,7,8,9,10]);
  await page.locator('[data-flight-rounds]').selectOption('4');await page.locator('[data-flow-guidance]').uncheck();await page.clock.install();
  await page.locator('[data-launch-runner]').click();await page.getByRole('button',{name:'Start flight',exact:true}).click();
  await expect(page.locator('.star-runner')).toHaveAttribute('data-expected-unit',/^chunk:1:3:/);
  for(let i=0;i<4;i++){
    await expect(page.locator('[data-flight-round]')).toContainText(`Round ${i+1} / 4`);
    await expect(page.locator('[data-flight-round]')).toContainText(`${Math.round((1+i*.07)*70)}% normal speed`);
    await expect(page.locator('[data-flight-round]')).toContainText(`${i+1} asteroid`);
    await flyTo(page);
    if(i<3)await page.getByRole('button',{name:`Replay this set · optional round ${i+2} / 4`,exact:true}).click();
  }
  await expect(page.locator('.runner-overlay')).toContainText('Revision rounds complete');
  await expect(page.getByRole('button',{name:'Replay this ayah set',exact:true})).toBeVisible();
  const rounds=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('ayah-cosmic-gateways-v1')).runs)[0].events.filter(e=>e.type==='runner:pickup-correct').map(e=>e.roundIndex));
  expect([...new Set(rounds)]).toEqual([0,1,2,3]);
});
