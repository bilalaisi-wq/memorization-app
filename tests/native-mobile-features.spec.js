import {test,expect} from '@playwright/test';
import {authStorage} from '../src/native/credentials.js';
import {quietAdjusted,reminderDates,replaceReminders,storedDueDates} from '../src/native/reminders.js';
import {initializeUpdates,markMobileReady,applyMobileUpdate,pendingMobileUpdate} from '../src/native/updates.js';
import {mobilePreferences} from '../src/native/experience.js';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('native sessions migrate only after verified secure writes; failures retain old credentials and all learning records',async()=>{
 const local=store(),session=store(),secure=store(),key='sb-project-auth-token';for(const name of ['setKeyPrefix','setSynchronize','setDefaultKeychainAccess'])secure[name]=async()=>{};
 local.setItem(key,'SESSION');local.setItem('ayah-learning-v1','ORIGINAL');session.setItem(key+'-code-verifier','PKCE');
 const adapter=await authStorage(key,{native:true,local,session,secure});expect(await adapter.getItem(key)).toBe('SESSION');expect(local.getItem(key)).toBeNull();expect(session.getItem(key+'-code-verifier')).toBeNull();expect(local.getItem('ayah-learning-v1')).toBe('ORIGINAL');
 local.setItem(key,'KEEP');secure.removeItem(key);secure.setItem=async()=>{throw Error('locked');};await expect(authStorage(key,{native:true,local,session,secure})).rejects.toThrow('locked');expect(local.getItem(key)).toBe('KEEP');
 expect(await authStorage(key,{native:false,local,session})).toBe(local);
});
test('quiet hours cover overnight/day windows, invalid dates, daily caps and overdue dates without changing FSRS',()=>{
 const now=new Date(2026,10,13,23),due=new Date(2026,10,13,23,5);expect(quietAdjusted(due).getHours()).toBe(8);expect(quietAdjusted(due).getDate()).toBe(14);expect(quietAdjusted(new Date(2026,10,13,14),12,16).getHours()).toBe(16);
 expect(reminderDates(['bad',now.toISOString(),due.toISOString()],{now})).toHaveLength(1);
 const s=store();s.setItem('ayah-learning-v1',JSON.stringify({schemaVersion:1,records:{'112:1':{memory:{nextReview:due.toISOString(),history:[{}]}}}}));const before=s.getItem('ayah-learning-v1');expect(storedDueDates(s)).toEqual([due.toISOString()]);expect(s.getItem('ayah-learning-v1')).toBe(before);
});
test('notification scheduling never requests permission implicitly and cancels old owner reminders before new ones',async()=>{
 const calls=[],plugin={cancel:async v=>calls.push(['cancel',v]),checkPermissions:async()=>({display:'denied'}),schedule:async v=>calls.push(['schedule',v])};const prefs={reminders:true,quietStart:22,quietEnd:8};await replaceReminders([new Date().toISOString()],prefs,{plugin});expect(calls.map(c=>c[0])).toEqual(['cancel']);plugin.checkPermissions=async()=>({display:'granted'});await replaceReminders([new Date().toISOString()],prefs,{plugin});expect(calls.map(c=>c[0])).toEqual(['cancel','cancel','schedule']);const n=calls[2][1].notifications[0];expect(n.body).not.toMatch(/112|due|account|email/);expect(n.isExactNotification).toBe(false);
});
test('live update download never reloads a running game, explicit application pauses first and readiness waits for app startup',async()=>{
 let listener;const calls=[],updater={addListener:async(_,fn)=>{listener=fn;return {remove:()=>calls.push('dispose')};},set:async x=>calls.push(x),notifyAppReady:async()=>calls.push('ready')};
 const dispose=await initializeUpdates({native:true,updater});await listener({bundle:{id:'signed-test'}});expect(pendingMobileUpdate()?.id).toBe('signed-test');expect(calls).toEqual([]);await markMobileReady({native:true,updater});await applyMobileUpdate({updater,beforeApply:()=>calls.push('pause')});expect(calls).toEqual(['ready','pause',{id:'signed-test'}]);dispose();expect(pendingMobileUpdate()).toBeNull();
});
test('corrupt native preferences are not overwritten and permission/haptics default off',()=>{const s=store();s.setItem('ayah-native-preferences-v1','broken');expect(mobilePreferences(s)).toMatchObject({reminders:false,haptics:false,quietStart:22,quietEnd:8});expect(s.getItem('ayah-native-preferences-v1')).toBe('broken');});
test('approved achievement sharing excludes all private fields and rejects unearned/custom messages',async()=>{
 const {shareableAchievements,shareAchievement}=await import('../src/native/sharing.js');const s=store();
 s.setItem('ayah-achievements-v1',JSON.stringify({version:1,awards:{'first-step':{value:1,earnedAt:'2026-11-13',name:'PRIVATE_NAME',ref:'2:255'},voice:{value:0,earnedAt:null},evil:{value:999,earnedAt:'2026-11-13'}}}));
 expect(shareableAchievements(s).map(x=>x.id)).toEqual(['first-step']);let payload;
 await shareAchievement('first-step',{storage:s,share:{share:async x=>payload=x}});expect(JSON.stringify(payload)).not.toMatch(/PRIVATE_NAME|2:255|earnedAt|account/);
 await expect(shareAchievement('evil',{storage:s,share:{share:async()=>{throw Error('must not call');}}})).rejects.toThrow('not available');
});
test('native audio interruptions pause media and study without automatic replay; pending focus cannot outlive cleanup',async()=>{
 const {initializeAudioFocus}=await import('../src/native/audio-focus.js');const target=new EventTarget(),events=[],media={pause:()=>events.push('media-paused')};let interruption,release=0,resolve;
 target.addEventListener('ayah-study-overlay',()=>events.push('study-paused'));
 const plugin={addListener:async(_,fn)=>{interruption=fn;return {remove:()=>events.push('removed')};},requestFocus:()=>new Promise(r=>resolve=r),releaseFocus:async()=>release++};
 const dispose=await initializeAudioFocus({plugin,target,documentRef:{querySelectorAll:()=>[media]}});target.dispatchEvent(new Event('ayah-study-audio-start'));target.dispatchEvent(new Event('ayah-study-audio-stop'));resolve({granted:true});await new Promise(r=>setTimeout(r,0));expect(release).toBeGreaterThanOrEqual(2);
 interruption({interrupted:true});expect(events).toEqual(['study-paused','media-paused']);interruption({interrupted:false});expect(events).toHaveLength(2);dispose();target.dispatchEvent(new Event('ayah-study-audio-start'));expect(events.at(-1)).toBe('removed');
});
test('backgrounded game frame queues stop, resume at most once, and dispose removes all work',async()=>{
 const {backgroundFrames}=await import('../src/native/frames.js');const target=new EventTarget(),doc=new EventTarget();doc.hidden=false;let sequence=0,calls=0;const frames=new Map(),loop=backgroundFrames({target,documentRef:doc,request:fn=>{frames.set(++sequence,fn);return sequence;},cancel:id=>frames.delete(id)});
 loop.request(()=>calls++);expect(frames.size).toBe(1);target.dispatchEvent(new Event('ayah-native-background'));expect(frames.size).toBe(0);target.dispatchEvent(new Event('ayah-native-foreground'));target.dispatchEvent(new Event('ayah-native-foreground'));expect(frames.size).toBe(1);for(const fn of frames.values())fn(100);frames.clear();expect(calls).toBe(1);
 loop.request(()=>calls++);loop.dispose();expect(frames.size).toBe(0);target.dispatchEvent(new Event('ayah-native-foreground'));expect(frames.size).toBe(0);
});
test('an account change while notification permission is checked cannot schedule the previous owner dates',async()=>{
 let owner=1,resolve,scheduled=0;const pending=replaceReminders(['2026-11-20'],{reminders:true,quietStart:22,quietEnd:8},{isCurrent:()=>owner===1,plugin:{cancel:async()=>{},checkPermissions:()=>new Promise(r=>resolve=r),schedule:async()=>scheduled++}});
 await new Promise(r=>setTimeout(r,0));owner=2;resolve({display:'granted'});await pending;expect(scheduled).toBe(0);
});
