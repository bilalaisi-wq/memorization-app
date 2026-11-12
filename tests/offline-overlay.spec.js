import {test,expect} from '@playwright/test';
import {mockBilling} from './billing-fixtures.js';
import {menu} from './menu-helper.js';
import {surahs} from '../src/data.js';
for(const context of [false,true])test(`Download Manager pauses and retains an active ${context?'shared-passage':'regular'} Bubble field`,async({page})=>{
 await mockBilling(page,{signed:false});await page.addInitScript(()=>{window.Audio=class{play(){return Promise.resolve()}pause(){}load(){}removeAttribute(){}};});await page.goto('/');
 if(context){await page.locator('.passage-context-nav summary').click();await page.locator('[data-context-first]').selectOption('1:1');await page.locator('[data-context-last]').fill('1');await page.getByRole('button',{name:'Use passage in all labs',exact:true}).click();}
 await page.locator('#nav-puzzle-lab').click();
 if(context)await page.locator('[data-context-game=bubble]').click();else{await page.locator('[data-game=bubble]').click();await page.getByRole('button',{name:'Prepare bubbles',exact:true}).click();}
 await page.locator('[data-bubble-audio]').selectOption('silent');await page.getByRole('button',{name:'Start bubbles',exact:true}).click();await page.clock.install();const b=await page.locator('.word-bubble').filter({hasText:surahs[0].verses[0].words[0]}).first().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.clock.runFor(2000);await expect(page.locator('.bubble-arena')).toHaveAttribute('data-cursor','1');
 await (await menu(page)).locator('[data-download-manager]').click();await expect(page.locator('.offline-manager')).toBeVisible();await expect(page.locator('.ayah-bubble')).toHaveAttribute('data-state','paused');await page.locator('[data-offline-close]').click();await page.getByRole('button',{name:'Resume bubbles',exact:true}).click();await expect(page.locator('.ayah-bubble')).toHaveAttribute('data-state','playing');await expect(page.locator('.bubble-arena')).toHaveAttribute('data-cursor','1');
});
