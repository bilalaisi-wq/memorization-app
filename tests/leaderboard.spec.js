import {test,expect} from '@playwright/test';
import {menu} from './menu-helper.js';
const rows=Array.from({length:14},(_,i)=>({alias:i===0?'Cedar42':`Learner${i+1}`,xp:1400-i*80,stars:30-i,recalls:20-i}));
async function open(page,data=rows,night=false) {
  await page.route('https://ycgyuatjgdbhiakqourg.supabase.co/rest/v1/rpc/get_weekly_leaderboard',r=>r.fulfill({json:data}));
  if(night) await page.addInitScript(()=>localStorage.setItem('ayah-appearance-v1',JSON.stringify({version:1,theme:'night-sky',reduceEffects:true,updatedAt:new Date().toISOString()})));
  await page.goto('/');await menu(page);await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.locator('.weekly-ranking')).toBeVisible();
}
for(const night of [false,true]) test(`top ten ${night?'comets':'podium'} keeps scores, order, and readable mobile layout`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,rows,night);
  await expect(page.locator('.podium-card')).toHaveCount(3);await expect(page.locator('.runner-card')).toHaveCount(7);
  await expect(page.locator('.podium-1')).toContainText('Cedar42');await expect(page.locator('.podium-1')).toContainText('1400');
  await expect(page.locator('.weekly-ranking')).not.toContainText('Learner11');
  await expect(page.locator(night?'.podium-1 .rank-comet':'.podium-1 .rank-medal')).toBeVisible();
  await expect(page.locator(night?'.podium-1 .rank-medal':'.podium-1 .rank-comet')).toBeHidden();
  await expect(page.locator('.ranking-note')).toContainText('Sharing is optional');
  expect(await page.locator('.leaderboard-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
test('empty and partial rankings do not invent winners and escape aliases',async({page})=>{
 await open(page,[]);await expect(page.locator('.ranking-empty')).toContainText('No learners have opted in');await expect(page.locator('.podium-card')).toHaveCount(0);
 await page.keyboard.press('Escape');
 await page.route('**/rest/v1/rpc/get_weekly_leaderboard',r=>r.fulfill({json:[{...rows[0],alias:'<img src=x onerror=alert(1)>'}]}));
 await menu(page);await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 await expect(page.locator('.podium-card')).toHaveCount(1);await expect(page.locator('.rank-alias')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('.weekly-ranking img')).toHaveCount(0);
});

test('comet motion respects appearance and browser reductions; failures retain useful feedback',async({page})=>{
 await open(page,rows,true);
 const flight=page.locator('.podium-1 .comet-flight');
 expect(await flight.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.evaluate(()=>{document.documentElement.dataset.celestialMotion='full';delete document.documentElement.dataset.skyVisible;});
 expect(await flight.evaluate(el=>getComputedStyle(el).animationName)).toBe('comet-drift');
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await flight.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.keyboard.press('Escape');
 await page.route('**/rest/v1/rpc/get_weekly_leaderboard',r=>r.fulfill({status:503,json:{message:'Unavailable'}}));
 await menu(page);await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 await expect(page.locator('.leaderboard-dialog')).toContainText('Your personal learning still works');
});
