import {profileStorage,activeProfileId} from '../../learner/profile-storage.js';
import {freeAyah} from './gateways.js';
export const GATEWAY_KEY='ayah-cosmic-gateways-v1';
const validRef=ref=>{try{return !!freeAyah(ref);}catch{return false;}};
function validate(data){
  return data?.version===1&&data.runs&&typeof data.runs==='object'&&!Array.isArray(data.runs)&&Object.values(data.runs).every(r=>
    r&&typeof r==='object'&&typeof r.missionId==='string'&&typeof r.sourceHash==='string'&&Array.isArray(r.refs)&&r.refs.every(validRef)&&Array.isArray(r.completed)&&r.completed.every(ref=>r.refs.includes(ref))&&Array.isArray(r.events)&&r.events.every(e=>e&&typeof e==='object'&&typeof e.type==='string'&&typeof e.id==='string'&&r.refs.includes(e.targetRef)&&(!e.fromRef||validRef(e.fromRef))&&(!e.selectedRef||validRef(e.selectedRef))));
}
export function createGatewayRecorder(mission,{storage=profileStorage,getOwner=activeProfileId,runId=crypto.randomUUID()}={}){
  const owner=getOwner();
  return {
    record(event){
      if(getOwner()!==owner)throw Error('Account changed; reopen the mission.');
      if(!event.type.startsWith('gateway:'))return;
      const raw=storage.getItem(GATEWAY_KEY);let data={version:1,runs:{}};
      if(raw!==null){try{data=JSON.parse(raw);}catch{throw Error('Gateway history is unreadable. Export your progress to recover it; the original has been preserved.');}if(!validate(data))throw Error('Gateway history needs recovery. Export your progress; the original has been preserved.');}
      const run=data.runs[runId]||={missionId:mission.id,sourceHash:mission.sourceHash,refs:[...mission.refs],completed:[],events:[]};
      if(run.missionId!==mission.id||run.sourceHash!==mission.sourceHash)throw Error('Gateway run source changed; the original history is preserved.');
      const id=event.type==='gateway:correct'?`${runId}:correct:${event.targetRef}`:`${runId}:${run.events.length}`;
      if(run.events.some(e=>e.id===id))return;
      run.events.push({id,type:event.type,at:new Date().toISOString(),targetRef:event.targetRef,fromRef:event.fromRef,selectedRef:event.selectedRef||null,assisted:!!event.assisted,stageIndex:Math.floor(mission.refs.indexOf(event.targetRef)/5),crossStage:mission.refs.indexOf(event.targetRef)>0&&mission.refs.indexOf(event.targetRef)%5===0,category:event.type==='gateway:mistake'?'observed-gateway-selection':'supported-sequence-practice'});
      if(event.type==='gateway:correct'&&!run.completed.includes(event.targetRef))run.completed.push(event.targetRef);
      if(!validate(data))throw Error('Invalid gateway event; history has been preserved.');
      const serialized=JSON.stringify(data);if(serialized.length>2_000_000)throw Error('Gateway history is full. Export it before adding more; earlier history has been preserved.');
      storage.setItem(GATEWAY_KEY,serialized);
    },
  };
}
