import {createGatewaySession} from './gateways.js';
import { createMission } from './mission.js';
import { createRunner } from '../../puzzles/arcade/cosmic/runner.js';

// Mission adapter: runner checkpoints never mean recognition, recall, or mastery.
export async function createFlightController(manifest, { onEvent=()=>{}, slow=false, memoryGateways=false }={}) {
  const canonical=await createMission({surahId:manifest.surah,selection:'custom',start:manifest.first,end:manifest.last});
  if(JSON.stringify(manifest)!==JSON.stringify(canonical))throw Error('Mission configuration changed. Rebuild the briefing.');
  let index=0, engine, disposed=false;
  const gateway=memoryGateways?createGatewaySession(canonical,{onEvent:e=>onEvent({...e,missionId:canonical.id,sourceHash:canonical.sourceHash})}):null;
  let stageGates=0;
  const checkpoints=new Set();
  function mount() {
    stageGates=0;
    engine=createRunner({stageId:canonical.stages[index].id,seed:parseInt(canonical.sourceHash.slice(0,8),16)+index,
      difficulty:index,slow,onEvent(event){
        if(disposed)return;
        if(event.type==='runner:checkpoint') {
          if(checkpoints.has(event.checkpointId))return;
          checkpoints.add(event.checkpointId);
        }
        onEvent({...event,missionId:canonical.id,stageIndex:index,completedCheckpoints:[...checkpoints]});
      }});
  }
  mount();
  return {
    start:()=>engine.start(), pause:reason=>engine.pause(reason), resume:()=>engine.resume(),
    dispatch(action){
      if(disposed)return;
      const g=gateway?.getSnapshot();
      if(g&&g.state!=='idle'){
        if(action.type==='gateway-continue'&&g.state==='open'){
          gateway.dispatch({type:'continue'});stageGates++;engine.resume();
        }else if(action.type.startsWith('gateway-'))gateway.dispatch({...action,type:action.type.slice(8)});
        else if(action.type==='lane')gateway.dispatch(action);
        return;
      }
      if(action.type==='restart')stageGates=canonical.stages[index].refs.filter(ref=>gateway?.getSnapshot().completed.includes(ref)).length;
      engine.dispatch(action);
      if(gateway?.remaining(index)&&engine.getSnapshot().status==='running'){
        const snap=engine.getSnapshot(),wave=snap.waves[Math.min(stageGates,snap.waves.length-1)];
        if(snap.elapsed>=wave.arrival+1){engine.pause('Safe orbit — memory gateway');gateway.enter(index);}
      }
    },
    getSnapshot:()=>({...engine.getSnapshot(),status:gateway&&gateway.getSnapshot().state!=='idle'&&gateway.getSnapshot().state!=='disposed'?'gateway':engine.getSnapshot().status,gateway:gateway?.getSnapshot()||null,stageIndex:index,stageCount:canonical.stages.length,completedCheckpoints:[...checkpoints],routeComplete:index===canonical.stages.length-1&&engine.getSnapshot().status==='checkpoint'&&(!gateway||gateway.getSnapshot().completed.length===canonical.refs.length)}),
    nextStage(){
      if(disposed||engine.getSnapshot().status!=='checkpoint'||gateway?.remaining(index)>0||index>=canonical.stages.length-1)return false;
      engine.dispose();index++;mount();engine.start();return true;
    },
    dispose(){if(!disposed){engine.dispose();gateway?.dispose();disposed=true;}},
  };
}
