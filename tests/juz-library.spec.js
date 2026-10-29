import {enableDeveloperLab} from "./developer-lab-helper.js";
import {test,expect} from '@playwright/test';
test('Juz 29 lists every surah without exposing premium content to guests',async({page})=>{
 await page.route('**/functions/v1/quran-content',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Sign in required'})}));
 await page.goto('/');await enableDeveloperLab(page);await page.getByRole('button',{name:'Menu',exact:true}).click();
 await page.getByRole('button',{name:'Juz 29 library',exact:true}).click();
 const d=page.locator('dialog');await expect(d.locator('.juz-chapters article')).toHaveCount(12);
 await expect(d).toContainText('431 ayahs');await expect(d).toContainText('Al-Mulk');await expect(d).toContainText('Al-Mursalat');
 await d.getByRole('button',{name:'Open Al-Mursalat',exact:true}).click();
 await expect(page.locator('[data-private-load-status]')).toContainText('Sign in required');
 await expect(page.locator('.passage-studio .arabic')).toHaveCount(0);
});

test('developer menu editor previews order and saves only navigation labels',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#site-menu-toggle')).toBeVisible();
 await page.evaluate(async()=>{
  const dev=await import('/src/developer/access.js');
  window.devCalls=[];
  dev.setDeveloperUser({id:'owner',email:'bilalaisi@gmail.com',email_confirmed_at:'2026-01-01'});
  dev.configureDeveloperClient({rpc:async(name,args)=>{window.devCalls.push({name,args});return{data:true};},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})});
  dev.mountDeveloperMenu(document.querySelector('.explore-nav'));
 });
 await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Developer mode',exact:true}).click();
 const d=page.locator('dialog');await d.getByRole('button',{name:'Enable developer access',exact:true}).click();
 await expect(d).toContainText('Developer access enabled.');
 const first=await d.locator('[data-items] li span').first().textContent();
 await d.locator('[data-items] li').first().getByRole('button',{name:/down/}).click();
 await expect(d.locator('[data-items] li span').nth(1)).toHaveText(first);
 await d.getByRole('button',{name:'Save menu order',exact:true}).click();await expect(d).toContainText('Menu order saved');await expect(page.locator('.explore-nav > button').nth(1)).toHaveText(first);
 const calls=await page.evaluate(()=>window.devCalls);
 expect(calls[0]).toEqual({name:'set_my_developer_mode',args:{active:true}});
 expect(calls[1].name).toBe('save_site_menu');expect(calls[1].args.items[1]).toBe(first);
 await d.getByRole('button',{name:'Return to learner mode',exact:true}).click();await expect(d).toContainText('Regular learner access restored.');
});
