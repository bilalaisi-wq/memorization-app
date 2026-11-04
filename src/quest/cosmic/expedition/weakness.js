import {createMission} from '../mission.js';
import {pairReference} from '../link-content.js';
// Only observed adjacent-transition responses contribute. Reconstruction errors,
// motor events and whole-passage self-reports cannot diagnose a particular link.
export async function expeditionWeakLinks(mission,data,linkEvidence=[]){
  const groups=new Map(linkEvidence.map(w=>[w.pairKey,{...w,evidenceIds:[...w.evidenceIds]}]));
  for(const run of Object.values(data.runs)){
    const events=Object.values(run.boss).flatMap(b=>b.events).filter(e=>e.type==='mistake'&&['next','connection','opening'].includes(e.kind)&&e.previous&&e.refs?.length&&mission.refs.includes(e.previous)&&mission.refs.includes(e.refs.at(-1)));
    if(!events.length)continue;let canonical;try{canonical=await createMission({surahId:run.surah,selection:'custom',start:run.first,end:run.last});}catch{continue;}if(canonical.sourceHash!==run.sourceHash)continue;
    for(const e of events){let pair;try{pair=pairReference(e.previous,e.refs.at(-1));}catch{continue;}if(!groups.has(pair.pairKey))groups.set(pair.pairKey,{...pair,selectionMistakes:0,typedMismatches:0,selfReportedDifficulty:0,hints:0,evidenceIds:[]});const g=groups.get(pair.pairKey);if(g.evidenceIds.includes(e.id))continue;g.evidenceIds.push(e.id);if(e.kind==='opening'||e.category==='observed-typed-response')g.typedMismatches++;else g.selectionMistakes++;}
  }
  return [...groups.values()].map(g=>({...g,reason:`${g.selectionMistakes} observed choice errors · ${g.typedMismatches} typed mismatches · ${g.selfReportedDifficulty} self-reported difficulties · ${g.hints} Link hints. Sources: recorded Link/boss evidence; no spoken certification.`})).sort((a,b)=>(b.selectionMistakes+b.typedMismatches+b.selfReportedDifficulty)-(a.selectionMistakes+a.typedMismatches+a.selfReportedDifficulty)||a.pairKey.localeCompare(b.pairKey));
}
