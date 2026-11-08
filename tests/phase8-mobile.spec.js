import {test,expect} from '@playwright/test';
import {mockBilling} from './billing-fixtures.js';
test('mobile parking and Hold stay visible without nested horizontal scrolling; reference decoration does not overlap Arabic',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockBilling(page,{signed:false});
 await page.goto('/');await expect(page.locator('.build-zone')).toBeVisible();
 expect(await page.locator('.reference-card').evaluate(el=>getComputedStyle(el,'::after').display)).toBe('none');
 await page.locator('#nav-puzzle-lab').click();await expect(page.locator('.tower-floors')).toBeVisible();
 for(const selector of ['.tower-hold','.tower-parking-words']){
  const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
 }
 expect(await page.locator('.tower-floors').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('Night Sky mission action retains dark readable text on teal',async({page})=>{
 await mockBilling(page,{signed:false});await page.addInitScript(()=>localStorage.setItem('ayah-appearance-v1',JSON.stringify({version:1,theme:'night-sky',reduceEffects:true,updatedAt:'2026-11-08T00:00:00Z'})));
 await page.goto('/');await page.locator('#nav-revision-lab').click();
 await expect(page.locator('.cosmic-primary').first()).toBeVisible();
 expect(await page.locator('.cosmic-primary').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(9, 47, 54)');
});
