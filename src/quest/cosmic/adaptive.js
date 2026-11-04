import {versionedStore} from '../../ui/versioned-store.js';
import {profileStorage,activeProfileId} from '../../learner/profile-storage.js';
export const ADAPTIVE_KEY='ayah-cosmic-adaptive-v1';
export const validAdaptive=d=>d?.version===1&&Array.isArray(d.events)&&d.events.every(e=>typeof e.id==='string'&&typeof e.type==='string'&&Array.isArray(e.refs)&&e.refs.every(r=>/^\d+:\d+$/.test(r))&&Number.isFinite(Date.parse(e.at)));
const types=new Set(['runner:collision','runner:checkpoint','runner:pickup-mistake','runner:pickup-correct','defense:core-hit','defense:checkpoint','defense:memory-correct','defense:memory-mistake','defense:memory-hint','link:hint','link:mistake','link:transition-correct','link:checkpoint','boss:hint','boss:mistake','boss:correct']);
export function createAdaptiveStore({storage=profileStorage,getOwner=activeProfileId}={}){
 const owner=getOwner(),store=versionedStore(storage,ADAPTIVE_KEY,()=>({version:1,events:[]}),validAdaptive);
 return {...store,record(e,s={}){if(!types.has(e.type))return;if(getOwner()!==owner)throw Error('Account changed; adaptive evidence was not saved.');
  const id=JSON.stringify([e.runId,e.stageIndex,e.roundIndex,e.type,e.evidenceId||e.id||e.scoreReceipt||[e.elapsed,e.objectId,e.targetRef,e.unitId]]);
  return store.transact(d=>{if(d.events.some(x=>x.id===id))return {duplicate:true};if(d.events.length>=12000)throw Error('Export adaptive evidence before adding more; older records are preserved.');
   d.events.push({id,type:e.type,at:new Date().toISOString(),refs:e.refs||[e.fromRef,e.targetRef].filter(Boolean),category:e.category||null,assisted:!!e.assisted,independentEligible:!!e.independentEligible,
    activity:e.activity,stageIndex:e.stageIndex,roundIndex:e.roundIndex,motorErrors:Number.isInteger(s.motorErrors)?s.motorErrors:null,laneChanges:Number.isInteger(s.laneChanges)?s.laneChanges:null,defended:Number.isInteger(s.defended)?s.defended:null,
    shield:Number.isFinite(s.shield)?s.shield:null,slow:!!s.slow,configuration:s.configuration||null,mode:s.mode||null});return {saved:true};});
 }};
}
export function difficultyModels(refs,{events=[]}={},passage={records:{}},weak=[]){
 const scope=new Set(refs),relevant=events.filter(e=>e.refs.some(ref=>scope.has(ref))),checkpoints=events.filter(e=>['runner:checkpoint','defense:checkpoint'].includes(e.type)).slice(-3);
 const collisions=checkpoints.length?checkpoints.reduce((n,e)=>n+(e.motorErrors||0),0):events.filter(e=>['runner:collision','defense:core-hit'].includes(e.type)).slice(-20).length;
 const clean=checkpoints.filter(e=>(e.motorErrors??0)===0&&(e.activity!=='runner'||(e.laneChanges??0)>0));
 const defense=checkpoints.filter(e=>e.activity==='defense'),defended=defense.reduce((n,e)=>n+(e.defended||0),0),impacts=defense.reduce((n,e)=>n+(e.motorErrors||0),0),accuracy=defense.length?defended/Math.max(1,defended+impacts):null;
 const arcade=collisions>=3?{level:'supported',slow:true,configuration:'fortress',reason:`${collisions} observed motor collisions; slower flight and a stronger core are suggested.`}:clean.length>=3&&(accuracy===null||accuracy>=.65)?{level:'confident',slow:false,configuration:'agile',reason:`${clean.length} clean active checkpoints; agile defense is suggested.`}:{level:'baseline',slow:false,configuration:'balanced',reason:'Not enough motor evidence to change the baseline.'};
 const records=Object.values(passage.records||{}).filter(r=>r.unit.refs.some(ref=>scope.has(ref))),history=records.flatMap(r=>r.history).sort((a,b)=>Date.parse(a.at||0)-Date.parse(b.at||0)),independent=history.filter(h=>h.independent===true),days=new Set(records.flatMap(r=>r.successfulDays||[])),failures=independent.slice(-10).filter(h=>h.grade==='Again').length;
 const memoryErrors=relevant.slice(-20).filter(e=>['runner:pickup-mistake','defense:memory-mistake','link:mistake','boss:mistake'].includes(e.type)).length,hints=relevant.slice(-20).filter(e=>['link:hint','defense:memory-hint','boss:hint'].includes(e.type)).length,known=weak.filter(w=>scope.has(w.fromRef)&&scope.has(w.toRef)&&w.selectionMistakes+w.typedMismatches+w.selfReportedDifficulty>=2);
 const memory=failures>=2||known.length||memoryErrors>=2||hints>=3?{level:'supported',linkMode:'guided',extended:false,reason:`${failures} independent Again ratings, ${memoryErrors} observed practice errors, ${hints} hints and ${known.length} repeatedly difficult links.`}:days.size>=3?{level:'extended',linkMode:'opening',extended:true,reason:`Independent self-assessed successes on ${days.size} distinct days. Typed retrieval can increase; movement difficulty is unaffected.`}:{level:'baseline',linkMode:'recognition',extended:false,reason:'Use recognition and recitation practice until sufficient independent history exists.'};
 return {version:1,arcade:{...arcade,collisions,cleanCheckpoints:clean.length,defensiveAccuracy:accuracy},memory:{...memory,independentDays:days.size,failures,memoryErrors,hints}};
}
