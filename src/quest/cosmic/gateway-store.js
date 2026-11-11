import {profileStorage,activeProfileId} from '../../learner/profile-storage.js';
import {reference} from '../../content/library.js';
export const GATEWAY_KEY='ayah-cosmic-gateways-v1';
const validRef=ref=>{try{const r=reference(ref);return `${r.surah}:${r.ayah}`===ref;}catch{return false;}};
function validate(data){
  return data?.version===1&&data.runs&&typeof data.runs==='object'&&!Array.isArray(data.runs)&&Object.values(data.runs).every(r=>
    r&&typeof r==='object'&&typeof r.missionId==='string'&&typeof r.sourceHash==='string'&&Array.isArray(r.refs)&&r.refs.every(validRef)&&Array.isArray(r.completed)&&r.completed.every(ref=>r.refs.includes(ref))&&Array.isArray(r.events)&&r.events.every(e=>e&&typeof e==='object'&&typeof e.type==='string'&&typeof e.id==='string'&&r.refs.includes(e.targetRef)&&(!e.fromRef||validRef(e.fromRef))&&(!e.selectedRef||validRef(e.selectedRef))));
}
export function createGatewayRecorder(mission,{storage=profileStorage,getOwner=activeProfileId,runId=crypto.randomUUID()}={}){
  const owner=getOwner();
  return {
    record(event){
      if(getOwner()!==owner)throw Error('Account changed; reopen the mission.');
      if(!['defense:memory-correct','defense:memory-mistake','defense:memory-hint','defense:checkpoint'].includes(event.type)&&!event.type.startsWith('gateway:')&&!['runner:pickup-correct','runner:pickup-mistake','runner:asteroid-destroyed'].includes(event.type))return;
      const raw=storage.getItem(GATEWAY_KEY);let data={version:1,runs:{}};
      if(raw!==null){try{data=JSON.parse(raw);}catch{throw Error('Gateway history is unreadable. Export your progress to recover it; the original has been preserved.');}if(!validate(data))throw Error('Gateway history needs recovery. Export your progress; the original has been preserved.');}
      const run=data.runs[runId]||={missionId:mission.id,sourceHash:mission.sourceHash,refs:[...mission.refs],completed:[],events:[]};
      if(run.missionId!==mission.id||run.sourceHash!==mission.sourceHash)throw Error('Gateway run source changed; the original history is preserved.');
      const id=event.type==='defense:checkpoint'?`${runId}:defense-clear:${event.checkpointId}`:event.type==='defense:memory-correct'?`${runId}:round:${event.roundIndex??0}:defense:${event.targetRef}`:event.type==='runner:asteroid-destroyed'?`${runId}:round:${event.roundIndex??0}:blaster:${event.scoreReceipt}`:event.type==='runner:pickup-correct'?`${runId}:round:${event.roundIndex??0}:pickup:${event.unitId}`:event.type==='gateway:correct'?`${runId}:correct:${event.targetRef}`:`${runId}:${run.events.length}`;
      if(run.events.some(e=>e.id===id))return;
      run.events.push({id,type:event.type,at:new Date().toISOString(),targetRef:event.targetRef,fromRef:event.fromRef,selectedRef:event.selectedRef||null,...(event.type==='defense:checkpoint'?{motorErrors:event.motorErrors,memoryMistakes:event.memoryMistakes,defended:event.defended,coreHealth:event.health}:{}),scorePoints:event.awardedPoints??0,boosted:!!event.boosted,roundIndex:event.roundIndex??0,roundCount:event.roundCount??1,unitId:event.unitId||null,selectedUnitId:event.selectedUnitId||null,assisted:!!event.assisted,stageIndex:Math.floor(mission.refs.indexOf(event.targetRef)/5),crossStage:!['runner:asteroid-destroyed','defense:checkpoint'].includes(event.type)&&mission.refs.indexOf(event.targetRef)>0&&mission.refs.indexOf(event.targetRef)%5===0&&(!event.unitId||event.unitId.startsWith('ayah:')||event.unitId.endsWith(':0')||event.unitId.startsWith('chunk:')&&event.unitId.split(':').at(-1).startsWith('0-')),category:event.type==='defense:checkpoint'?'defense-completion-summary':event.type==='defense:memory-mistake'?'observed-defense-selection':event.type.startsWith('defense:memory-')?'supported-defense-recognition':event.type==='runner:asteroid-destroyed'?'motor-defense':event.type==='runner:pickup-mistake'?'observed-flow-selection':event.type==='gateway:mistake'?'observed-gateway-selection':'supported-sequence-practice'});
      if((event.type==='gateway:correct'||event.type==='runner:pickup-correct'&&event.ayahComplete)&&!run.completed.includes(event.targetRef))run.completed.push(event.targetRef);
      if(!validate(data))throw Error('Invalid gateway event; history has been preserved.');
      const serialized=JSON.stringify(data);if(serialized.length>2_000_000)throw Error('Gateway history is full. Export it before adding more; earlier history has been preserved.');
      storage.setItem(GATEWAY_KEY,serialized);
    },
  };
}
export {validate as validGatewayStore};
