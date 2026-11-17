import {Share} from '@capacitor/share';
// Curated public messages only. No names, passage IDs, dates, counts, audio or account IDs.
const approved=Object.freeze({
 'first-step':{title:'First steps',text:'I earned First steps with Ayah A Day — a little practice, every day.',target:1},
 'voice':{title:'Recall explorer',text:'I earned Recall explorer with Ayah A Day by trying self-assessed recall.',target:1},
 'week':{title:'A week of practice',text:'I earned A week of practice with Ayah A Day.',target:7},
});
export function shareableAchievements(storage){
 let data;try{data=JSON.parse(storage.getItem('ayah-achievements-v1'));}catch{return [];}
 if(data?.version!==1||!data.awards||Array.isArray(data.awards))return [];
 return Object.entries(approved).filter(([id,item])=>{const award=data.awards[id];return Number.isFinite(award?.value)&&award.value>=item.target&&Number.isFinite(Date.parse(award.earnedAt));}).map(([id,item])=>({id,title:item.title,text:item.text}));
}
export async function shareAchievement(id,{storage,share=Share}={}){
 const item=shareableAchievements(storage).find(a=>a.id===id);if(!item)throw Error('This achievement is not available for public sharing.');
 await share.share({title:item.title,text:item.text,url:'https://ayah-a-day.up.railway.app/'});
}
