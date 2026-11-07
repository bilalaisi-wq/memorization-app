import {passageRefs} from '../passage-context/model.js';
import {groupedWindow,correct} from '../passage/model.js';
export const baseline = n => n<=12?1:n<=24?2:n<=36?3:5;
export function expansionRounds(count){
 if(!Number.isInteger(count)||count<1)throw Error('Invalid workspace count');
 const rounds=[{id:'study:0',pages:[0],label:'A'}];
 for(let p=1;p<count;p++){rounds.push({id:`study:${p}`,pages:[p],label:sectionName(p)});rounds.push({id:`link:${p}`,pages:Array.from({length:p+1},(_,i)=>i),label:`A–${sectionName(p)} together`});}
 return rounds;
}
export const sectionName = n => n<26?String.fromCharCode(65+n):`Section ${n+1}`;
export function adaptiveWindow(bundle,page=0,size=0,segment=null){return groupedWindow(bundle,page,segment,size||undefined);}
export function validateOrder(w,ids){if(!Array.isArray(ids)||new Set(ids).size!==ids.length)return false;let rest=[...ids];while(rest.length){const g=w.groups.find(g=>g.id===rest[0]);if(!g||!g.positions.every((p,i)=>rest[i]===p))return false;rest=rest.slice(g.positions.length);}return true;}
export const solved=(w,ids)=>validateOrder(w,ids)&&correct(ids,w.words);
// Only explicit review provenance is accepted. Never generate religious explanations.
const adjacent=(from,to)=>{try{return passageRefs({from,to}).length===2;}catch{return false;}};
export function reviewedAnchors(bundle,entries=[]){
 if(!Array.isArray(entries))return [];

 return entries.filter(a=>a&&['vocabulary','meaning','visual','transition'].includes(a.kind)&&a.reference===bundle.key&&a.sourceHash===bundle.contentRevision&&a.review?.status==='approved'&&a.review.reviewer&&Number.isInteger(a.review.version)&&a.review.version>0&&/^\d{4}-\d\d-\d\d/.test(a.review.date||'')&&Number.isInteger(a.firstWord)&&Number.isInteger(a.lastWord)&&a.firstWord>=1&&a.lastWord>=a.firstWord&&a.lastWord<=bundle.words.length&&typeof a.id==='string'&&typeof a.note==='string'&&a.note.length<=1000&&Array.isArray(a.sources)&&a.sources.length>0&&a.sources.every(s=>typeof s.title==='string'&&/^https:\/\//.test(s.url))&&(a.kind!=='transition'||adjacent(bundle.key,a.nextReference)));
}
