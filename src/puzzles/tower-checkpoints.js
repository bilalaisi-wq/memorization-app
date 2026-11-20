import {versionedStore} from '../ui/versioned-store.js';
export const TOWER_KEY='ayah-blocks-checkpoints-v1';
// Local draft drift check, not source approval, cryptographic authorization, or recall evidence.
export function towerFingerprint(words){let hash=2166136261;for(const c of words.join('\u001f'))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return `${words.length}:${hash.toString(16)}`;}
const reference=key=>/^\d+:\d+$/.test(key);
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
function validRecord(r){return r&&typeof r.fingerprint==='string'&&nonnegative(r.accepted)&&nonnegative(r.strikes)&&r.strikes<3&&['score','locks','gatesCompleted','gateErrors','maxCombo'].every(k=>r[k]===undefined||nonnegative(r[k]))&&(!r.errors||Array.isArray(r.errors)&&r.errors.length<=100&&r.errors.every(e=>typeof e.kind==='string'&&e.kind.length<60&&(!e.reference||reference(e.reference))));}
function valid(d){return d?.version===1&&d.records&&typeof d.records==='object'&&!Array.isArray(d.records)&&Object.entries(d.records).every(([key,r])=>reference(key)&&validRecord(r))&&(!d.recovery||Array.isArray(d.recovery)&&d.recovery.every(r=>reference(r.ref)&&validRecord(r)));}
export function towerCheckpoints(storage){
 const store=versionedStore(storage,TOWER_KEY,()=>({version:1,records:{}}),valid);
 return {
  get warning(){return store.warning;},
  read(ref,words){const r=store.snapshot().records[ref];return r&&r.fingerprint===towerFingerprint(words)?r:null;},
  save(ref,words,state,errors=state.errors||[]){
   if(state.status!=='playing'||!state.sections.length)return;
   const accepted=state.sections.at(-1).last;if(accepted>=words.length)return;
   store.transact(d=>{
    const fingerprint=towerFingerprint(words),old=d.records[ref];
    if(old&&old.fingerprint!==fingerprint)(d.recovery??=[]).push({ref,...old});
    d.records[ref]={fingerprint,accepted,strikes:state.strikes,score:state.score,locks:state.locks,gatesCompleted:state.gatesCompleted,gateErrors:state.gateErrors,maxCombo:state.maxCombo,errors:errors.map(e=>({kind:e.kind,...(e.reference?{reference:e.reference}:{}),...(Number.isInteger(e.position)?{position:e.position}:{}),...(Number.isInteger(e.expectedPosition)?{expectedPosition:e.expectedPosition}:{})}))};
   });
  },
  clear(ref){store.transact(d=>delete d.records[ref]);},
 };
}
