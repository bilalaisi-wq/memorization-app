import {versionedStore} from '../../../ui/versioned-store.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
import {createMission} from '../mission.js';
export const EXPEDITION_KEY='ayah-cosmic-expeditions-v1';
export function expeditionTasks(mission,rounds=3){
  if(!Number.isInteger(rounds)||rounds<3||rounds>10)throw Error('Choose 3–10 flight rounds.');
  return mission.stages.flatMap((stage,stageIndex)=>[
    ...Array.from({length:rounds},(_,roundIndex)=>({id:`${stage.id}:runner:${roundIndex}`,stageIndex,roundIndex,activity:'runner'})),
    ...['defense','link','boss'].map(activity=>({id:`${stage.id}:${activity}:0`,stageIndex,roundIndex:0,activity})),
  ]);
}
function valid(d){return d?.version===1&&d.runs&&typeof d.runs==='object'&&!Array.isArray(d.runs)&&Object.values(d.runs).every(r=>r&&typeof r.missionId==='string'&&typeof r.runId==='string'&&/^[a-f0-9]{64}$/.test(r.sourceHash)&&Number.isInteger(r.surah)&&Number.isInteger(r.first)&&Number.isInteger(r.last)&&Number.isInteger(r.rounds)&&r.rounds>=3&&r.rounds<=10&&Array.isArray(r.completed)&&new Set(r.completed).size===r.completed.length&&r.completed.every(x=>typeof x==='string')&&(!r.settings||typeof r.settings.slow==='boolean'&&typeof r.settings.guidance==='boolean'&&['mixed','words','ayahs'].includes(r.settings.pickupMode))&&r.boss&&typeof r.boss==='object'&&!Array.isArray(r.boss)&&Object.values(r.boss).every(b=>Array.isArray(b.cleared)&&Array.isArray(b.events))&&(!r.final||typeof r.final.attemptId==='string'&&typeof r.final.unitId==='string'));}
export function createExpeditionStore({storage=profileStorage,getOwner=activeProfileId}={}){
  const owner=getOwner(),store=versionedStore(storage,EXPEDITION_KEY,()=>({version:1,runs:{}}),valid);
  const check=()=>{if(owner!==getOwner())throw Error('Account changed. Reopen your expedition.');};
  const write=fn=>{check();return store.transact(d=>{const result=fn(d);if(JSON.stringify(d).length>2_000_000)throw Error('Export expedition progress before adding more; existing data is preserved.');return result;});};
  async function verify(mission){const current=await createMission({surahId:mission.surah,selection:'custom',start:mission.first,end:mission.last});check();if(JSON.stringify(current)!==JSON.stringify(mission))throw Error('Rebuild this mission from verified free content.');}
  return {
    get warning(){return store.warning;},snapshot:()=>{check();return store.snapshot();},
    async open(mission,rounds=3,settings={}){await verify(mission);expeditionTasks(mission,rounds);return write(d=>{
      const old=d.runs[mission.id];if(old){if(old.sourceHash!==mission.sourceHash)throw Error('Saved source revision differs. Export before recovery.');const expected=expeditionTasks(mission,old.rounds);if(old.completed.some((id,i)=>id!==expected[i]?.id))throw Error('Saved route needs recovery; it has not been changed.');return old;}
      if(Object.keys(d.runs).length>=100)throw Error('Export existing expeditions before creating more.');
      const {slow=false,guidance=true,pickupMode='mixed'}=settings;if(typeof slow!=='boolean'||typeof guidance!=='boolean'||!['mixed','words','ayahs'].includes(pickupMode))throw Error('Invalid expedition settings.');
      const run={settings:{slow,guidance,pickupMode},missionId:mission.id,runId:crypto.randomUUID(),sourceHash:mission.sourceHash,surah:mission.surah,first:mission.first,last:mission.last,rounds,completed:[],boss:{},final:null,startedAt:new Date().toISOString()};d.runs[mission.id]=run;return run;
    });},
    decision(mission,taskId,models){return write(d=>{const r=d.runs[mission.id];if(!r||expeditionTasks(mission,r.rounds)[r.completed.length]?.id!==taskId)throw Error('Not the current adaptive checkpoint.');r.difficulty??={};r.difficulty[taskId]??=structuredClone(models);return r.difficulty[taskId];});},
    complete(mission,taskId){return write(d=>{const r=d.runs[mission.id];if(!r)throw Error('Start the expedition first.');if(r.completed.includes(taskId))return {duplicate:true};const expected=expeditionTasks(mission,r.rounds)[r.completed.length];if(expected?.id!==taskId)throw Error('Complete the current checkpoint before advancing.');r.completed.push(taskId);r.savedAt=new Date().toISOString();return r;});},
    pinBoss(mission,taskId,blueprint){return write(d=>{const r=d.runs[mission.id],task=r&&expeditionTasks(mission,r.rounds)[r.completed.length];if(task?.id!==taskId||task.activity!=='boss')throw Error('This boss is not active.');const b=r.boss[taskId]??={cleared:[],events:[]};b.blueprint??=structuredClone(blueprint);return b.blueprint;});},
    boss(mission,taskId,event){return write(d=>{const r=d.runs[mission.id],task=r&&expeditionTasks(mission,r.rounds)[r.completed.length];if(task?.id!==taskId||task.activity!=='boss')throw Error('This boss is not the active checkpoint.');const b=r.boss[taskId]??={cleared:[],events:[]};if(typeof event.id!=='string'||!['correct','mistake','hint','assistance','comparison'].includes(event.type)||b.blueprint&&!b.blueprint.some(q=>q.id===event.questionId))throw Error('Boss evidence must match its pinned question.');if(b.events.some(e=>e.id===event.id))return {duplicate:true};if(b.events.length>=2000)throw Error('Boss history needs export before more attempts.');b.events.push(event);if(event.type==='correct'&&!b.cleared.includes(event.questionId))b.cleared.push(event.questionId);return b;});},
    final(mission,assessment){return write(d=>{const r=d.runs[mission.id];if(!r||r.completed.length!==expeditionTasks(mission,r.rounds).length)throw Error('Finish the gameplay route before final recall.');if(r.final?.attemptId===assessment.attemptId&&r.final.result)return r.final;if(r.final&&!r.final.result&&r.final.attemptId!==assessment.attemptId)throw Error('Resolve the saved recall attempt before replacing it.');r.final=structuredClone(assessment);return r.final;});},
  };
}
export function expeditionCoverage(mission,run){
  const tasks=expeditionTasks(mission,run.rounds),done=new Set(run.completed),stages=mission.stages.filter((s,i)=>tasks.filter(t=>t.stageIndex===i).every(t=>done.has(t.id)));
  const refs=stages.flatMap(s=>s.refs),links=mission.refs.slice(1).filter(ref=>done.has(tasks.find(t=>t.activity==='link'&&mission.stages[t.stageIndex].refs.includes(ref))?.id)).map(ref=>`${mission.refs[mission.refs.indexOf(ref)-1]}>${ref}`);
  return {refs,links,stages:stages.length,totalStages:mission.stages.length,gameplayComplete:run.completed.length===tasks.length,assessment:run.final?.result||null};
}
export {valid as validExpeditionStore};
