import {LocalNotifications} from '@capacitor/local-notifications';
// Generic reminders only; this module reads dates and never runs or changes FSRS.
export const REMINDER_IDS=Array.from({length:7},(_,i)=>740100+i);
export function quietAdjusted(date,start=22,end=8){
 const result=new Date(date),hour=result.getHours();
 if(start===end)return result;
 if(start>end?(hour>=start||hour<end):(hour>=start&&hour<end)){
  if(start>end&&hour>=start)result.setDate(result.getDate()+1);
  result.setHours(end,0,0,0);
 }
 return result;
}
export function reminderDates(dates,{now=new Date(),quietStart=22,quietEnd=8}={}){
 const unique=new Map();
 for(const value of dates){const due=new Date(value);if(!Number.isFinite(+due))continue;
  const at=quietAdjusted(new Date(Math.max(+due,+now+60000)),quietStart,quietEnd);
  const day=[at.getFullYear(),at.getMonth(),at.getDate()].join('-');if(!unique.has(day))unique.set(day,at);
 }
 return [...unique.values()].sort((a,b)=>a-b).slice(0,7);
}
export async function replaceReminders(dates,prefs,{plugin=LocalNotifications,now=new Date(),isCurrent=()=>true}={}){
 await plugin.cancel({notifications:REMINDER_IDS.map(id=>({id}))});
 if(!prefs.reminders||!isCurrent())return;
 if((await plugin.checkPermissions()).display!=='granted'||!isCurrent())return;
 const notifications=reminderDates(dates,{now,quietStart:prefs.quietStart,quietEnd:prefs.quietEnd}).map((at,i)=>({id:REMINDER_IDS[i],title:'Ayah A Day',body:'A little revision, at your pace.',schedule:{at,allowWhileIdle:false},isExactNotification:false}));
 if(notifications.length)await plugin.schedule({notifications});
}
export function storedDueDates(storage){
 const read=key=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
 const learning=read('ayah-learning-v1'),passage=read('ayah-passage-recall-v1');
 const values=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.values(value):[];
 return [...values(learning?.schemaVersion===1?learning.records:{}).filter(r=>Array.isArray(r?.memory?.history)&&r.memory.history.length).map(r=>r.memory.nextReview),...values(passage?.version===1?passage.records:{}).filter(r=>Array.isArray(r?.history)&&r.history.length).map(r=>r.card?.due)].filter(Boolean);
}
