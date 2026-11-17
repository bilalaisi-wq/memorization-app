import {App} from '@capacitor/app';
import {Network} from '@capacitor/network';
import {Haptics,NotificationType} from '@capacitor/haptics';
import {LocalNotifications} from '@capacitor/local-notifications';
import {Share} from '@capacitor/share';
import {profileStorage,onProfileChange,profileRevision} from '../learner/profile-storage.js';
import {isNativeApp} from './platform.js';
import {replaceReminders,storedDueDates,REMINDER_IDS} from './reminders.js';
import {initializeUpdates,markMobileReady,pendingMobileUpdate,applyMobileUpdate} from './updates.js';
import {shareableAchievements,shareAchievement} from './sharing.js';
import {initializeAudioFocus} from './audio-focus.js';
import {celestialMotion} from '../themes/appearance.js';
const KEY='ayah-native-preferences-v1';
export function mobilePreferences(storage=profileStorage){let p;try{p=JSON.parse(storage.getItem(KEY));}catch{}return {version:1,reminders:p?.version===1&&p.reminders===true,haptics:p?.version===1&&p.haptics===true,quietStart:Number.isInteger(p?.quietStart)&&p.quietStart>=0&&p.quietStart<24?p.quietStart:22,quietEnd:Number.isInteger(p?.quietEnd)&&p.quietEnd>=0&&p.quietEnd<24?p.quietEnd:8};}
let status='Online',info=null,queue=Promise.resolve(),timer=null;
let reminderEpoch=0;
function refreshReminders(){
 const epoch=++reminderEpoch,prefs=mobilePreferences(),dates=storedDueDates(profileStorage);
 queue=queue.catch(()=>{}).then(()=>epoch===reminderEpoch?replaceReminders(dates,prefs,{isCurrent:()=>epoch===reminderEpoch}):undefined);
 return queue;
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{void refreshReminders().catch(()=>{});},200);}
function cancelOwnerReminders(){++reminderEpoch;clearTimeout(timer);void LocalNotifications.cancel({notifications:REMINDER_IDS.map(id=>({id}))}).catch(()=>{});}
export async function initializeMobileExperience(){
 if(!isNativeApp())return;
 const cleanup=[],handles=[];
 try{cleanup.push(await initializeAudioFocus());}catch{}
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);cleanup.push(()=>target.removeEventListener(type,fn));};
 const network=({connected})=>{status=connected?'Online':'Offline · downloaded free study only';document.querySelectorAll('[data-native-network]').forEach(n=>n.textContent=status);};
 try{network(await Network.getStatus());handles.push(await Network.addListener('networkStatusChange',network));}catch{network({connected:navigator.onLine});}
 try{info=await App.getInfo();}catch{}
 try{cleanup.push(await initializeUpdates({notify:()=>window.dispatchEvent(new Event('ayah-mobile-update'))}));}catch{}
 let last=0;
 listen(window,'ayah-native-success',()=>{if(!mobilePreferences().haptics||performance.now()-last<1000||!celestialMotion())return;last=performance.now();void Haptics.notification({type:NotificationType.Success}).catch(()=>{});});
 listen(window,'ayahprofilechange',()=>{document.querySelector('[data-mobile-settings]')?.close();cancelOwnerReminders();schedule();});
 listen(window,'ayah-audio-interrupted',()=>{document.querySelectorAll('[data-native-audio-status]').forEach(n=>n.textContent='Audio interrupted. Resume your activity, then replay when ready.');});
 listen(window,'ayah-native-foreground',schedule);cleanup.push(onProfileChange(schedule));listen(window,'ayahcosmicchange',schedule);
 try{handles.push(await LocalNotifications.addListener('localNotificationActionPerformed',()=>{document.querySelector('#nav-daily')?.click();}));}catch{}
 schedule();
 // Healthy app acknowledgement happens after the actual DOM has been built, not plugin load.
 await markMobileReady().catch(()=>{});
 return ()=>{cancelOwnerReminders();cleanup.forEach(fn=>fn());handles.forEach(h=>void h.remove());};
}
export function mountMobileSettings(nav){
 if(!isNativeApp())return;
 const button=document.createElement('button');button.className='text-button';button.textContent='Mobile settings & updates';button.onclick=()=>void openMobileSettings();nav.append(button);
 const badge=document.createElement('span');badge.dataset.nativeNetwork='';badge.role='status';badge.textContent=status;nav.append(badge);
}
async function openMobileSettings(){
 window.dispatchEvent(new Event('ayah-study-overlay'));
 const d=document.createElement('dialog');d.className='account-dialog';d.dataset.mobileSettings='';d.setAttribute('aria-labelledby','mobile-settings-title');const p=mobilePreferences(),ownerRevision=profileRevision();
 d.innerHTML='<h2 id="mobile-settings-title">Mobile settings</h2><p data-native-network role="status"></p><p data-version></p><p data-native-audio-status role="status"></p><label><input type="checkbox" data-reminders> Private revision reminders</label><p>Generic reminders only. Permission is requested when you enable them.</p><label>Quiet hours start <input data-start type="number" min="0" max="23"></label><label>Quiet hours end <input data-end type="number" min="0" max="23"></label><label><input data-haptics type="checkbox"> Gentle achievement haptics</label><p>Your recordings stay local unless you explicitly submit them for analysis. Backgrounding pauses study; replay audio when you return.</p><button data-download>Manage downloads</button><button data-share>Share the app</button><section data-achievements aria-label="Share an earned achievement"><h3>Share an achievement</h3><p>Choose a public message. No account details or selected ayahs are shared.</p><div data-achievement-choices></div><p data-share-preview></p><button data-share-achievement disabled>Share selected achievement</button></section><p data-update role="status"></p><button data-apply>Save study & apply update</button><p data-message role="status"></p><button data-save>Save settings</button><button data-close>Close</button>';
 document.body.append(d);d.querySelector('[data-native-network]').textContent=status;d.querySelector('[data-version]').textContent=info?`${info.name} · ${info.version} (${info.build})`:'Version information unavailable';
 d.querySelector('[data-reminders]').checked=p.reminders;d.querySelector('[data-haptics]').checked=p.haptics;d.querySelector('[data-start]').value=p.quietStart;d.querySelector('[data-end]').value=p.quietEnd;
 const update=()=>{d.querySelector('[data-update]').textContent=pendingMobileUpdate()?'A verified frontend update is ready. Applying reloads the app; finish your current activity first.':'No downloaded update. New native features arrive through your app store.';d.querySelector('[data-apply]').hidden=!pendingMobileUpdate();};update();window.addEventListener('ayah-mobile-update',update);
 const close=()=>{window.removeEventListener('ayah-mobile-update',update);d.remove();buttonFocus?.focus();};const buttonFocus=document.activeElement;d.addEventListener('close',close,{once:true});d.querySelector('[data-close]').onclick=()=>d.close();
 d.querySelector('[data-download]').onclick=()=>{d.close();void import('../offline/ui.js').then(m=>m.openDownloadManager());};
 d.querySelector('[data-share]').onclick=()=>void Share.share({title:'Ayah A Day',text:'Practice Qur’an memorization at your own pace.',url:'https://ayah-a-day.up.railway.app/'}).catch(()=>{});
 const choices=d.querySelector('[data-achievement-choices]'),awards=shareableAchievements(profileStorage);let selectedAward=null;
 if(!awards.length)choices.textContent='Earn First steps, Recall explorer, or A week of practice to share a badge.';
 for(const award of awards){const b=document.createElement('button');b.textContent=award.title;b.setAttribute('aria-pressed','false');b.onclick=()=>{selectedAward=award.id;choices.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));d.querySelector('[data-share-preview]').textContent=award.text;d.querySelector('[data-share-achievement]').disabled=false;};choices.append(b);}
 d.querySelector('[data-share-achievement]').onclick=async()=>{if(ownerRevision!==profileRevision())return;try{await shareAchievement(selectedAward,{storage:profileStorage});}catch{d.querySelector('[data-message]').textContent='Sharing was cancelled or unavailable.';}};
 d.querySelector('[data-apply]').onclick=async event=>{event.target.disabled=true;try{await applyMobileUpdate({beforeApply:()=>window.dispatchEvent(new Event('ayah-study-overlay'))});}catch{d.querySelector('[data-message]').textContent='Could not apply the update. Your progress is unchanged.';event.target.disabled=false;}};
 d.querySelector('[data-save]').onclick=async()=>{const next={version:1,reminders:d.querySelector('[data-reminders]').checked,haptics:d.querySelector('[data-haptics]').checked,quietStart:Number(d.querySelector('[data-start]').value),quietEnd:Number(d.querySelector('[data-end]').value)};
  if(![next.quietStart,next.quietEnd].every(n=>Number.isInteger(n)&&n>=0&&n<24)){d.querySelector('[data-message]').textContent='Use hours from 0 to 23.';return;}
  try{if(next.reminders){const permission=await LocalNotifications.requestPermissions();if(ownerRevision!==profileRevision())return;if(permission.display!=='granted'){next.reminders=false;d.querySelector('[data-reminders]').checked=false;}}
   if(ownerRevision!==profileRevision())return;profileStorage.setItem(KEY,JSON.stringify(next));Object.assign(p,next);await refreshReminders();d.querySelector('[data-message]').textContent=next.reminders?'Saved. Generic reminders will respect your quiet hours.':'Saved. Reminders are off.';
  }catch{d.querySelector('[data-message]').textContent='Could not save settings. Try again.';}
 };
 d.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const nodes=[...d.querySelectorAll('button,input,select,a[href]')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 d.showModal();d.querySelector('[data-close]').focus();
}
