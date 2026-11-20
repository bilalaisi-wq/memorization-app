import {Capacitor} from '@capacitor/core';
import {NativePurchases} from '@capgo/native-purchases';
import {applePurchasing} from './apple.js';
import {googlePurchasing} from './google.js';
import {activeProfileId} from '../../learner/profile-storage.js';
import {esc} from '../../ui/dom.js';
export async function mountNativeSubscriptions(dialog,root,ctx,api){
 const provider=Capacitor.getPlatform()==='ios'?'apple':'google',label=provider==='apple'?'App Store':'Google Play',owner=activeProfileId();
 const adapter=(provider==='apple'?applePurchasing:googlePurchasing)({plugin:NativePurchases,api});
 const current=()=>dialog.isConnected&&activeProfileId()===owner;
 const controller=new AbortController(),message=dialog.querySelector('[data-billing-status]');
 const dispose=()=>{adapter.dispose();controller.abort();observer.disconnect();};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});dialog.addEventListener('close',dispose,{signal:controller.signal});
 window.addEventListener('ayahprofilechange',dispose,{signal:controller.signal});
 async function run(fn){const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){if(current())message.textContent=e.message;}finally{if(current())buttons.filter(b=>!b.dataset.locked).forEach(b=>b.disabled=false);}}
 let catalog;try{catalog=await adapter.catalog();}catch{catalog={enabled:false,restoreEnabled:false,items:[]};}
 if(!current())return dispose();
 let ent;try{ent=await api.entitlements();}catch{ent=null;}
 if(!current())return dispose();
 const existing=ent&&ent.plan!=='free'&&!ent.developer;
 root.innerHTML=`<section aria-label="Native subscriptions"><h3>${esc(label)} subscriptions</h3><p>Current server-verified plan: <strong data-native-current-plan>${esc(ent?.plan?ent.plan[0].toUpperCase()+ent.plan.slice(1):'unavailable')}</strong></p><p>${catalog.environment==='sandbox'?'Store sandbox / test billing.':'Store billing.'}</p>${!catalog.enabled?'<p>New in-app subscriptions are not enabled in this build.</p>':''}<p>Free Al-Fatihah and Juz Amma remain available. Additional content is delivered only when published and authorized. AI and comprehension lessons are not included unless separately released.</p>${existing?'<p>An existing subscription already provides access. Manage it before buying another subscription.</p>':''}<p data-store-legal></p><div data-store-products></div><div data-native-juz></div><button data-portal hidden disabled style="display:none">Stripe unavailable in native apps</button><button data-plans hidden disabled style="display:none">Web plans unavailable</button><button data-native-restore ${catalog.restoreEnabled?'':'disabled data-locked="true"'}>Restore purchases</button><button data-native-manage>Manage ${esc(label)} subscriptions</button><button data-native-refresh ${catalog.restoreEnabled?'':'disabled data-locked="true"'}>Refresh store status</button><p>Cancellation normally keeps access until the paid period ends. The store determines grace, refunds and revocation. Learning progress stays unchanged.</p><p>Deleting your learning account does not cancel an Apple or Google subscription. Manage subscriptions with its purchase provider before deletion.</p><p data-native-providers></p></section>`;
 for(const [key,title] of [['privacyUrl','Privacy policy'],['termsUrl','Subscription terms']]){try{const url=new URL(catalog[key]);if(url.protocol!=='https:'||url.username||url.password)continue;const a=document.createElement('a');a.href=url.href;a.textContent=title;a.rel='noopener noreferrer';root.querySelector('[data-store-legal]').append(a,document.createTextNode(' · '));}catch{}}
 function drawChoices(value){
  const field=root.querySelector('[data-native-juz]');if(value?.plan!=='explorer'){field.replaceChildren();return;}
  field.innerHTML='<fieldset><legend>Choose up to five additional juz</legend><p>Available only as verified content is published. Juz Amma stays free.</p>'+Array.from({length:29},(_,i)=>`<label><input type="checkbox" data-native-juz-choice value="${i+1}" ${(value.selectedJuz||[]).includes(i+1)?'checked':''}> Juz ${i+1}</label>`).join('')+'<button data-native-save-juz>Save my five choices</button></fieldset>';
  field.querySelector('button').onclick=()=>run(async()=>{const choices=[...field.querySelectorAll('input:checked')].map(n=>Number(n.value));await api.chooseJuz(choices);if(current())message.textContent='Your authorized juz choices were saved.';});
 }
 async function refreshAccess(){const value=await api.entitlements();if(!current())return;root.querySelector('[data-native-current-plan]').textContent=value.plan[0].toUpperCase()+value.plan.slice(1);if(value.plan!=='free')root.querySelectorAll('[data-native-product]').forEach(b=>{b.disabled=true;b.dataset.locked='true';});drawChoices(value);}
 drawChoices(ent);
 const accounts=ent?.providers||[];root.querySelector('[data-native-providers]').textContent=accounts.length?'Purchase providers: '+[...new Set(accounts.map(p=>p.provider==='apple'?'App Store':p.provider==='google'?'Google Play':'Stripe'))].join(', ')+'. Manage a purchase with its original provider.':'';
 if(!catalog.items.length&&catalog.enabled)root.querySelector('[data-store-products]').textContent='No configured store products are currently available. Try again later.';
 for(const item of catalog.items){const button=document.createElement('button');button.className='primary';button.dataset.nativeProduct=item.product_id;button.textContent=`${item.plan} · ${item.price} / ${item.cadence==='annual'?'year':'month'} · auto-renewing`;button.disabled=existing;if(existing)button.dataset.locked='true';button.onclick=()=>run(async()=>{const result=await adapter.purchase(item);await refreshAccess();if(current())message.textContent=result.status==='pending'?'Payment is pending. No premium access has been granted. Restore when the store completes it.':'Store purchase verified by the server. Your account access is updated.';});root.querySelector('[data-store-products]').append(button);}
 root.querySelector('[data-native-restore]').onclick=()=>run(async()=>{const result=await adapter.restore();await refreshAccess();if(current())message.textContent=result.remaining?'This batch was checked. Use Restore again to finish remaining store transactions.':result.restored?'Purchases checked with the store and your account updated.':'No matching purchases found. Sign into the store and learning account originally used.';});
 root.querySelector('[data-native-manage]').onclick=()=>run(()=>adapter.manage());root.querySelector('[data-native-refresh]').onclick=()=>run(async()=>{await adapter.refresh();await refreshAccess();if(current())message.textContent='Store status refreshed from the server.';});
}
