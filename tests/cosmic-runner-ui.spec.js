import {flyTo,flyStageRounds} from './cosmic-flow-helper.js';
import {test,expect} from '@playwright/test';
async function open(page,{mobile=false,freeze=false}={}){
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.locator('#nav-revision-lab').click();
  await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=surah]').selectOption('108');
  await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('1');await page.locator('[name=end]').fill('1');

  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await page.locator('[data-pickup-mode]').selectOption('ayahs');
  await page.clock.install();
  await page.getByRole('button',{name:'Launch Star Runner',exact:true}).click();
  await page.getByRole('button',{name:'Start flight',exact:true}).click();
  if(freeze)await page.clock.pauseAt(new Date(Date.now()+100));
}
const state=page=>page.locator('.star-runner').getAttribute('data-flight-state');
async function steer(page,lane){
  for(let n=0;n<2;n++){
    const current=Number(await page.locator('.star-runner').getAttribute('data-lane'));
    if(current===lane)break;
    await page.locator('.runner-field').focus();await page.keyboard.press(lane<current?'ArrowLeft':'ArrowRight');
  }
}
async function pilot(page){await flyStageRounds(page);}
test('real keyboard flight steers, dodges, gathers Quran pickups and reaches a stable safe checkpoint without learning writes',async({page})=>{
  test.setTimeout(300000);
  await open(page);
  const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|rewards/.test(k))));
  await expect(page.locator('[data-flight-status]')).toHaveText('Flight active');
  await page.clock.runFor(1200);
  await expect(page.locator('.runner-pickup').first()).toBeVisible();
  const pos=await page.locator('.runner-pickup').first().getAttribute('style');
  await page.clock.runFor(100);expect(await page.locator('.runner-pickup').first().getAttribute('style')).not.toBe(pos);
  await pilot(page);
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','checkpoint');
  await expect(page.locator('[data-shield]')).toContainText('3/3');
  await expect(page.locator('[data-stars]')).toContainText('1 ayahs connected');
  const progress=await page.locator('[data-flight-progress]').evaluate(n=>n.value);await page.clock.runFor(3000);expect(await page.locator('[data-flight-progress]').evaluate(n=>n.value)).toBe(progress);
  const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|rewards/.test(k))));expect(after).toEqual(before);
  await page.getByRole('button',{name:'Fly this stage again',exact:true}).click();
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','running');
  await expect(page.locator('[data-stars]')).toContainText('0 ayahs connected');
  await page.locator('[data-flight-exit]').click();await expect(page.locator('#cosmic-stage-title')).toBeVisible();
});
test('collision reacts visibly, pause freezes physics, restart repairs ship and exit disposes input',async({page})=>{
  await open(page,{freeze:true});await page.clock.runFor(1200);
  const rockLane=await page.locator('.runner-asteroid').first().evaluate(n=>Math.round((parseFloat(n.style.left)-20)/30));
  await steer(page,rockLane);await page.clock.runFor(1250);
  await expect(page.locator('[data-shield]')).toContainText('2/3');
  await page.keyboard.press('KeyP');
  await expect(page.locator('.runner-field')).toHaveClass(/runner-invulnerable/);await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');
  const position=await page.locator('[data-ship]').getAttribute('style');await page.clock.runFor(3000);expect(await page.locator('[data-ship]').getAttribute('style')).toBe(position);
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('ayah-study-overlay')));
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();
  await page.getByRole('button',{name:'Restart stage',exact:true}).click();
  await expect(page.locator('[data-shield]')).toContainText('3/3');
  await page.locator('#nav-learn').click();await expect(page.locator('.star-runner')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');await page.clock.runFor(1000);await expect(page.locator('.builder')).toBeVisible();
});
test('mobile swipe, touch-sized controls and reduced motion work; profile change disposes flight',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await open(page,{mobile:true,freeze:true});
  await page.getByRole('button',{name:'Steer left',exact:true}).click();await page.clock.runFor(200);
  await expect(page.locator('.star-runner')).toHaveAttribute('data-lane','0');
  await page.locator('.runner-field').scrollIntoViewIfNeeded();
  const box=await page.locator('.runner-field').boundingBox();
  const touch=await page.context().newCDPSession(page);
  const y=box.y+box.height/2;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+40,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+140,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
  await expect(page.locator('.star-runner')).toHaveAttribute('data-lane','1');
  await expect(page.locator('.star-runner')).toHaveClass(/runner-reduced/);
  expect(await page.locator('.runner-thruster').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  expect(await page.locator('[data-steer="1"]').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(async()=>{(await import('/src/learner/profile-storage.js')).selectProfile('other');});
  await expect(page.locator('.star-runner')).toHaveCount(0);
  await expect(page.locator('.cosmic-rush')).toContainText('Account changed');
});

test('mission stages advance only from safe checkpoints and restart retains the current stage',async({page})=>{
  test.setTimeout(300000);
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=surah]').selectOption('114');
  await page.locator('[name=selection]').selectOption('entire');
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption('ayahs');await page.clock.install();
  await page.getByRole('button',{name:'Launch Star Runner',exact:true}).click();await page.getByRole('button',{name:'Start flight',exact:true}).click();
  await pilot(page);await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','checkpoint');
  await expect(page.locator('[data-flight-stage]')).toHaveText('Stage 1 / 2');
  await page.getByRole('button',{name:'Continue to next flight stage',exact:true}).click();
  await expect(page.locator('[data-flight-stage]')).toHaveText('Stage 2 / 2');
  await page.getByRole('button',{name:'Restart stage',exact:true}).click();
  await expect(page.locator('[data-flight-stage]')).toHaveText('Stage 2 / 2');
  await expect(page.locator('[data-shield]')).toContainText('3/3');
  await pilot(page);await expect(page.getByRole('button',{name:'Fly this stage again',exact:true})).toBeVisible();
  await expect(page.locator('.runner-overlay')).toContainText('not independent memorization mastery');
});

test('an overlay cancels a pending launch without leaving an invisible flight or disabled launch button',async({page})=>{
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await page.evaluate(()=>{
    const digest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
    crypto.subtle.digest=(...args)=>{
      if(!first)return digest(...args);
      first=false;
      return new Promise(resolve=>{window.releaseFlightHash=()=>{crypto.subtle.digest=digest;resolve(digest(...args));};});
    };
  });
  await page.getByRole('button',{name:'Launch Star Runner',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseFlightHash)).toBe('function');
  await page.evaluate(()=>window.dispatchEvent(new Event('ayah-study-overlay')));
  await page.evaluate(()=>window.releaseFlightHash());
  await expect(page.getByRole('button',{name:'Launch Star Runner',exact:true})).toBeEnabled();
  await expect(page.locator('.star-runner')).toHaveCount(0);
  await page.getByRole('button',{name:'Launch Star Runner',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start flight',exact:true})).toBeVisible();
});
