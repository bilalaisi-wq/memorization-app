import {test,expect} from '@playwright/test';
import {appleSnapshot,googleSnapshot} from '../supabase/functions/_shared/native-billing/model.js';
import {purchaseAdapter} from '../src/billing/native/adapter.js';
const now=Date.parse('2026-11-19'),future=now+86400000,token='00000000-0000-4000-8000-000000000001';
const products=[{provider:'apple',product_id:'example.explorer.monthly',base_plan_id:'',plan:'explorer'},{provider:'google',product_id:'example.pathfinder',base_plan_id:'monthly',plan:'pathfinder'}];
const tx={bundleId:'com.ayahaday.app',environment:'Sandbox',type:'Auto-Renewable Subscription',originalTransactionId:'original',transactionId:'renewal',appAccountToken:token,productId:products[0].product_id,expiresDate:future};
const google={testPurchase:{},externalAccountIdentifiers:{obfuscatedExternalAccountId:token},subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:products[1].product_id,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(future).toISOString(),autoRenewingPlan:{autoRenewEnabled:true},latestSuccessfulOrderId:'order'}]};
test('Apple paid period, grace, retry, revocation, upgrade and expiration map to absolute dates, never added time',()=>{
 const snap=(t=tx,r={autoRenewStatus:1},s=1)=>appleSnapshot(t,r,s,products,'sandbox',now);
 expect(snap().access_until).toBe(new Date(future).toISOString());expect(snap(tx,{autoRenewStatus:0}).auto_renew).toBe(false);
 expect(snap(tx,{gracePeriodExpiresDate:future+1000},4).access_until).toBe(new Date(future+1000).toISOString());
 for(const s of [2,3,5])expect(snap(tx,{},s).access_until).toBeNull();expect(snap({...tx,revocationDate:now}).access_until).toBeNull();expect(snap({...tx,isUpgraded:true}).access_until).toBeNull();expect(snap({...tx,expiresDate:now-1}).access_until).toBeNull();
 expect(()=>snap({...tx,environment:'Production'})).toThrow();expect(()=>snap({...tx,bundleId:'other'})).toThrow();expect(()=>snap({...tx,appAccountToken:null})).toThrow();
});
test('Google pending, cancellation, grace, hold and expiration are distinct; arbitrary product/base plan/environment is rejected',()=>{
 const snap=g=>googleSnapshot(g,products,'sandbox','token',now);expect(snap(google).acknowledge).toBe(true);
 for(const state of ['ACTIVE','IN_GRACE_PERIOD','CANCELED'])expect(snap({...google,subscriptionState:'SUBSCRIPTION_STATE_'+state}).access_until).not.toBeNull();
 for(const state of ['PENDING','ON_HOLD','PAUSED','EXPIRED'])expect(snap({...google,subscriptionState:'SUBSCRIPTION_STATE_'+state}).access_until).toBeNull();
 expect(()=>snap({...google,testPurchase:undefined})).toThrow();expect(()=>snap({...google,externalAccountIdentifiers:{}})).toThrow();expect(()=>snap({...google,lineItems:[{...google.lineItems[0],productId:'invented'}]})).toThrow();
});
function fixture(provider='apple'){
 let owner='A',rev=0,verified=true;const calls=[];
 const plugin={configure:async()=>{},getProducts:async()=>({products:[{identifier:products[0].product_id,priceString:'$3.99'}]}),purchaseProduct:async()=>({transactionId:'TX',purchaseToken:'TOKEN'}),finishTransaction:async()=>calls.push('finish'),restorePurchases:async()=>{},getPurchases:async()=>({purchases:[{transactionId:'TX',purchaseToken:'TOKEN'},{transactionId:'TX',purchaseToken:'TOKEN'}]}),manageSubscriptions:async()=>calls.push('manage')};
 const api={invoke:async(_,body)=>{calls.push(body.action);if(body.action==='catalog')return {enabled:true,restoreEnabled:true,bindingToken:token,products:[products[0]]};if(body.action==='start')return {requestId:'request'};if(body.action==='verify')return {verified};return {};}};
 return {adapter:purchaseAdapter({provider,plugin,api,owner:()=>owner,revision:()=>rev}),plugin,api,calls,switch:()=>{owner='B';rev++;},deny:()=>verified=false};
}
test('native delivery requires verified backend response before finishing; restore deduplicates and never changes local entitlement',async()=>{
 const f=fixture(),catalog=await f.adapter.catalog();await f.adapter.purchase(catalog.items[0]);expect(f.calls.indexOf('verify')).toBeLessThan(f.calls.indexOf('finish'));f.calls.length=0;const r=await f.adapter.restore();expect(r.restored).toBe(1);expect(f.calls.filter(c=>c==='verify')).toHaveLength(1);
 const bad=fixture(),c=await bad.adapter.catalog();bad.deny();await expect(bad.adapter.purchase(c.items[0])).rejects.toThrow('not verified');expect(bad.calls).not.toContain('finish');
});
test('account switch during purchase cannot finish or deliver to the newly signed-in owner; concurrent sheet is blocked',async()=>{
 const f=fixture(),catalog=await f.adapter.catalog();let complete;f.plugin.purchaseProduct=()=>new Promise(resolve=>complete=resolve);const first=f.adapter.purchase(catalog.items[0]);await new Promise(r=>setTimeout(r,0));await expect(f.adapter.purchase(catalog.items[0])).rejects.toThrow('already in progress');f.switch();complete({transactionId:'TX'});await expect(first).rejects.toThrow('Account changed');expect(f.calls).not.toContain('verify');expect(f.calls).not.toContain('finish');
});
