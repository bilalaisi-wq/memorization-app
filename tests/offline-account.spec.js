import {test,expect} from '@playwright/test';
import {mockBilling,billingUser} from './billing-fixtures.js';
import {menu} from './menu-helper.js';
import {offlineDeviceOwner,rememberVerifiedDevice} from '../src/offline/identity.js';
test('device namespace requires a matching last verified project/session and grants no authentication',()=>{const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},url='https://test.supabase.co';rememberVerifiedDevice(billingUser,url,storage);expect(offlineDeviceOwner(url,storage)).toBeNull();storage.setItem('sb-test-auth-token',JSON.stringify({user:billingUser,access_token:'EXPIRED_TEST_ONLY'}));expect(offlineDeviceOwner(url,storage)).toBe(billingUser.id);expect(offlineDeviceOwner('https://other.supabase.co',storage)).toBeNull();storage.setItem('sb-test-auth-token',JSON.stringify({user:{id:'99999999-9999-4999-8999-999999999999'},access_token:'TEST_ONLY'}));expect(offlineDeviceOwner(url,storage)).toBeNull();});
test('verified signed-in device retains its own offline learning namespace and queues changes without premium or developer access',async({page})=>{
 await mockBilling(page,{plan:'pathfinder'});await page.goto('/');await expect(page.locator('#nav-learn')).toBeAttached();
 await page.evaluate(id=>{localStorage.setItem(`ayah-user:${id}:ayah-cloud-sync-v1`,JSON.stringify({version:1,enabled:true,revision:0,base:null}));localStorage.setItem('guest-marker','UNCHANGED');},billingUser.id);
 await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));await page.reload();
 expect(await page.evaluate(async()=>{const a=await import('/src/learner/accounts.js'),p=await import('/src/learner/profile-storage.js'),d=await import('/src/developer/access.js');return {owner:p.activeProfileId(),userId:a.appearanceAccount().userId,client:!!a.appearanceAccount().client,developer:d.isDeveloper()};})).toEqual({owner:billingUser.id,userId:null,client:false,developer:false});
 await page.locator('.word-bank .piece').first().click();expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`ayah-user:${id}:ayah-cloud-sync-v1`)).pendingSync,billingUser.id)).toBe(true);
 await (await menu(page)).getByRole('button',{name:'My account',exact:true}).click();await expect(page.locator('[data-content]')).toContainText('local access only');await expect(page.locator('[data-offline-verify]')).toBeVisible();expect(await page.locator('[data-photo]').count()).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('guest-marker'))).toBe('UNCHANGED');
});
