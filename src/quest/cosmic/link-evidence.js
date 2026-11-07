import {freeReference,reference,sha256} from '../../content/library.js';
import {assertBoundaryContent} from './boundary-content.js';
import {profileStorage,activeProfileId} from '../../learner/profile-storage.js';
import {versionedStore} from '../../ui/versioned-store.js';
import {pairReference,pairFingerprint} from './link-content.js';
export const LINK_EVIDENCE_KEY='ayah-cosmic-links-v1';
function metadataPair(fromRef,toRef){const n=reference(toRef);if(fromRef===null)return {fromRef:null,toRef,pairKey:null};const p=reference(fromRef);if(p.surah!==n.surah||p.ayah+1!==n.ayah)throw Error('Non-adjacent evidence.');return {fromRef,toRef,pairKey:`${fromRef}>${toRef}`};}
async function revision(from,to,content){if(freeReference(to)&&(!from||freeReference(from)))return pairFingerprint(from,to);assertBoundaryContent(content);if(!content.ayahs[to]||from&&!content.ayahs[from])throw Error('Authorize this boundary before recording evidence.');return sha256(JSON.stringify([from,from?content.ayahs[from].text:null,to,content.ayahs[to].text]));}
const allowed=new Set(['link:hint','link:assistance','link:mistake','link:transition-correct','link:reactor-mistake','link:reactor-correct','link:comparison','link:checkpoint']);
function valid(data){return data?.version===1&&Array.isArray(data.events)&&data.events.every(e=>{
  try{return typeof e.id==='string'&&allowed.has(e.type)&&Number.isFinite(Date.parse(e.at))&&typeof e.sourceRevision==='string'&&/^[a-f0-9]{64}$/.test(e.sourceRevision)&&metadataPair(e.fromRef,e.toRef).pairKey===e.pairKey;}catch{return false;}
});}
export function createLinkEvidence(mission,{storage=profileStorage,getOwner=activeProfileId,runId=crypto.randomUUID(),clock=()=>new Date(),boundaryContent=null}={}){
  const owner=getOwner(),store=versionedStore(storage,LINK_EVIDENCE_KEY,()=>({version:1,events:[]}),valid);let pending=Promise.resolve();
  return {...store,record(event){
    if(!allowed.has(event.type))return Promise.resolve();
    const task=pending.then(async()=>{
      if(getOwner()!==owner)throw Error('Account changed; Link evidence was not saved to another profile.');
      const index=mission.refs.indexOf(event.targetRef),expected=index>0?mission.refs[index-1]:null;
      if(index<0||event.fromRef!==expected||!event.evidenceId)throw Error('Link evidence must match the selected adjacent ayahs.');
      const pair=metadataPair(expected,event.targetRef),sourceRevision=await revision(expected,event.targetRef,boundaryContent);
      if(getOwner()!==owner)throw Error('Account changed; reopen Ayah Link.');
      const id=`${runId}:${event.stageIndex??0}:${event.roundIndex??0}:${event.evidenceId}`;
      return store.transact(data=>{
        if(data.events.some(e=>e.id===id))return {duplicate:true};
        const entry={id,type:event.type,at:clock().toISOString(),...pair,toRef:pair.toRef,sourceRevision,category:event.category||'supported-link-practice',scope:event.type.startsWith('link:reactor-')?'ayah-reconstruction':'transition',mode:event.mode,expectedWordId:`${event.targetRef}:0`,
          hintLevel:event.hintLevel??0,assisted:!!event.assisted,independentEligible:!!event.independentEligible,boundaryVersion:event.boundaryVersion||1,...(event.sourceFingerprints&&['from','to'].every(k=>['source','review'].every(f=>/^[a-f0-9]{64}$/.test(event.sourceFingerprints[k]?.[f]||'')))?{sourceFingerprints:structuredClone(event.sourceFingerprints)}:{}),expectedEndingId:event.expectedEndingId||null,expectedOpeningId:event.expectedOpeningId||null,selectedEndingId:event.selectedEndingId||null,selectedOpeningId:event.selectedOpeningId||null,selectedWordId:event.selectedWordId||null,selectedRef:event.selectedRef||null,reviewRevision:event.reviewRevision||null,
          sourceActivity:'ayah-link',runId,stageIndex:event.stageIndex??0,roundIndex:event.roundIndex??0};
        if(data.events.length>=12000)throw Error('Link evidence storage is full. Export existing progress before adding more.');
        data.events.push(entry);if(JSON.stringify(data).length>2_000_000)throw Error('Link evidence needs export/recovery; earlier records were preserved.');return entry;
      });
    });pending=task.catch(()=>{});return task;
  }};
}
export async function weakLinkCandidates(data,{limit=10,refs=null,boundaryContent=null}={}){
  if(!valid(data))throw Error('Link evidence needs recovery.');const groups=new Map(),scope=refs?new Set(refs):null;
  for(const e of data.events){
    if(!e.pairKey||e.scope!=='transition'||!['link:mistake','link:hint'].includes(e.type)||scope&&(!scope.has(e.fromRef)||!scope.has(e.toRef)))continue;
    const k=`${e.pairKey}:${e.sourceRevision}`;if(!groups.has(k))groups.set(k,{fromRef:e.fromRef,toRef:e.toRef,pairKey:e.pairKey,sourceRevision:e.sourceRevision,selectionMistakes:0,typedMismatches:0,selfReportedDifficulty:0,hints:0,evidenceIds:[]});
    const g=groups.get(k);if(e.type==='link:hint')g.hints++;else if(e.category==='self-reported-recall-difficulty')g.selfReportedDifficulty++;else if(['opening-word-selection','boundary-endpoint-selection'].includes(e.category))g.selectionMistakes++;else g.typedMismatches++;g.evidenceIds.push(e.id);
  }
  const current=[];for(const g of groups.values())if((freeReference(g.toRef)&&freeReference(g.fromRef)||boundaryContent?.refs.includes(g.toRef)&&boundaryContent.refs.includes(g.fromRef))&&g.sourceRevision===await revision(g.fromRef,g.toRef,boundaryContent))current.push({...g,reason:`${g.selectionMistakes} observed choice errors · ${g.typedMismatches} typed mismatches · ${g.selfReportedDifficulty} self-reported difficulties · ${g.hints} hints. No spoken verification.`});
  return current.sort((a,b)=>(b.selectionMistakes+b.typedMismatches+b.selfReportedDifficulty+b.hints)-(a.selectionMistakes+a.typedMismatches+a.selfReportedDifficulty+a.hints)||a.pairKey.localeCompare(b.pairKey)).slice(0,Math.max(0,Math.min(50,limit)));
}
export {valid as validLinkEvidence};
