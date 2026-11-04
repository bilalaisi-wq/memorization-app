import {test,expect} from '@playwright/test';
import {menu} from './menu-helper.js';
async function start(page){
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('3');await page.locator('[name=end]').fill('3');
  await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-pickup-mode]').selectOption('words');
  await page.locator('[data-flow-guidance]').uncheck();await page.clock.install();await page.locator('[data-launch-runner]').click();await expect(page.getByRole('button',{name:'Start flight',exact:true})).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await page.getByRole('button',{name:'Start flight',exact:true}).click();
}
async function steer(page,lane){for(let i=0;i<2;i++){const now=Number(await page.locator('.star-runner').getAttribute('data-lane'));if(now===lane)return;await page.locator('.runner-field').focus();await page.keyboard.press(now<lane?'ArrowRight':'ArrowLeft');}}
test('header theme chooser is separate from encouragement, persists and stays mobile friendly',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('.header-right [data-header-theme]')).toBeVisible();
  await page.locator('[data-header-theme]').click();await page.locator('[data-theme-choice="night-sky"]').click();await page.locator('[data-appearance-apply]').click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','night-sky');
  await (await menu(page)).getByRole('button',{name:'Encouragement settings',exact:true}).click();
  await expect(page.locator('.experience-dialog')).toBeVisible();await expect(page.locator('.experience-dialog [data-open-appearance]')).toHaveCount(0);
  await page.locator('.experience-dialog [data-close]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('keyboard blaster moves and boost releases on keyup, pause and theme modal',async({page})=>{
  await start(page);await page.locator('.runner-field').focus();await page.keyboard.press('Space');
  await expect(page.locator('.runner-bolt')).toHaveCount(1);const before=await page.locator('.runner-bolt').getAttribute('style');await page.clock.runFor(100);expect(await page.locator('.runner-bolt').getAttribute('style')).not.toBe(before);
  await page.keyboard.down('KeyB');await expect(page.locator('[data-flight-boost]')).toHaveAttribute('aria-pressed','true');
  await page.clock.runFor(200);expect(await page.locator('[data-boost-energy]').evaluate(n=>n.value)).toBeLessThan(4);
  await page.keyboard.up('KeyB');await expect(page.locator('[data-flight-boost]')).toHaveAttribute('aria-pressed','false');
  await page.keyboard.down('KeyB');await page.keyboard.press('KeyP');await page.keyboard.up('KeyB');
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');await expect(page.locator('[data-flight-boost]')).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Resume flight',exact:true}).click();await page.locator('[data-header-theme]').click();
  await expect(page.locator('.appearance-dialog')).toBeVisible();await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state','paused');
});
test('first-pass boosted pickup creates a star burst and records capped XP; mobile boost toggles by tap',async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await start(page);
  let ready=false;
  for(let i=0;i<120;i++){
    if(await page.locator('.star-runner').getAttribute('data-flight-state')==='paused'){await page.getByRole('button',{name:'Resume flight',exact:true}).click();continue;}
    const info=await page.locator('.star-runner').evaluate(n=>{
      const expected=n.dataset.expectedUnit;
      const target=[...n.querySelectorAll('.runner-pickup')].find(o=>o.dataset.unitId===expected);
      const rock=[...n.querySelectorAll('.runner-asteroid')].find(o=>parseFloat(o.style.top)>55&&parseFloat(o.style.top)<94);
      return {targetLane:target?Number(target.dataset.pickupLane):null,y:target?parseFloat(target.style.top):-100,rock:rock?Math.round((parseFloat(rock.style.left)-20)/30):null};
    });
    await steer(page,info.rock===null?(info.targetLane??1):(info.rock+1)%3);
    if(info.y>67&&info.rock===null){ready=true;break;}
    await page.clock.runFor(150);
  }
  expect(ready).toBe(true);
  const button=page.locator('[data-flight-boost]');expect(await button.evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  for(let i=0;i<20&&!await page.locator('.runner-starburst').count();i++)await page.clock.runFor(50);
  await expect(page.locator('.runner-starburst i')).toHaveCount(8);
  await button.click();await expect(button).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-arcade-score]')).toContainText('40 arcade points');await expect(page.locator('[data-bonus-xp]')).toContainText('4 bonus XP');
  await page.clock.runFor(900);expect(await page.locator('.runner-starburst').evaluateAll(nodes=>nodes.every(n=>Number(getComputedStyle(n).opacity)===0))).toBe(true);
  await page.locator('#nav-learn').click();await expect(page.locator('.star-runner')).toHaveCount(0);
});

test('mobile boost and blaster are simple tap buttons alongside steering',async({page})=>{
  await page.setViewportSize({width:390,height:844});await start(page);
  await expect(page.locator('[data-flow-stay]')).toHaveCount(0);
  const boost=page.locator('[data-flight-boost]');await boost.click();
  await expect(boost).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-steer="1"]').click();await expect(page.locator('.star-runner')).toHaveAttribute('data-lane','2');
  await page.locator('[data-flight-fire]').click();await expect(page.locator('.runner-bolt')).toHaveCount(1);
  await expect(boost).toHaveAttribute('aria-pressed','true');await boost.click();await expect(boost).toHaveAttribute('aria-pressed','false');
});
