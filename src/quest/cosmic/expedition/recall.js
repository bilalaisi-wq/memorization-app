import {createPassageMemory} from '../../../passage/memory.js';
import {recallUnit} from '../../../passage/model.js';
import {localBundle} from '../../../content/library.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
import {expeditionCoverage} from './store.js';
export async function createFinalRecall(mission,store,{storage=profileStorage,getOwner=activeProfileId}={}){
  const owner=getOwner(),unit=await recallUnit(mission.refs.map(localBundle));
  const check=()=>{if(getOwner()!==owner)throw Error('Account changed; reopen final recall.');};
  const run=()=>{check();const r=store.snapshot().runs[mission.id];if(!r||!expeditionCoverage(mission,r).gameplayComplete)throw Error('Complete the expedition route before final recall.');return r;};
  function active(memory){const r=run(),a=memory.snapshot().active;if(!r.final||a?.id!==r.final.attemptId||a.unitId!==unit.id)throw Error('The saved recall attempt changed elsewhere. Existing progress is preserved; resume the original assessment before starting another.');return a;}
  return {
    unit,
    snapshot(){const r=run(),memory=createPassageMemory(storage);if(memory.warning)throw Error(memory.warning);if(r.final?.result)return {status:'graded',...r.final};if(!r.final)return {status:'ready',unit};const a=active(memory);if(a.graded){store.final(mission,{...r.final,result:a.result});return {status:'graded',...r.final,result:a.result};}return {status:a.compared?'comparison':a.declared?'declared':'hidden',attempt:a,unit};},
    begin(){const r=run();if(r.final)return this.snapshot();const memory=createPassageMemory(storage),old=memory.snapshot().active;if(old&&!old.graded)throw Error('Another passage recall is unfinished. Finish or cancel it in its original assessment before starting this one.');const a=memory.begin(unit);try{store.final(mission,{attemptId:a.id,unitId:unit.id});}catch(e){memory.cancel(a.id);throw e;}return this.snapshot();},
    action(flag){const memory=createPassageMemory(storage),a=active(memory);if(a.graded)throw Error('This recall is already graded.');if(flag==='compared'&&!a.declared)throw Error('Attempt the recitation before revealing the text.');if(!['declared','compared','assisted'].includes(flag))throw Error('Unknown assessment action.');memory.update(flag);return this.snapshot();},
    grade(grade){const memory=createPassageMemory(storage),a=active(memory);const result=memory.grade(a.id,grade,{assessmentSource:'self-assessed'});store.final(mission,{attemptId:a.id,unitId:unit.id,result});return result;},
  };
}
