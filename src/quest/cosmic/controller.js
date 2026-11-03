import {createFlowUnits} from './flow-content.js';
import {createFlowRunner} from '../../puzzles/arcade/cosmic/flow-runner.js';
import {createGatewaySession} from './gateways.js';
import { createMission } from './mission.js';
import { createRunner } from '../../puzzles/arcade/cosmic/runner.js';

// Mission adapter: supported recognition checkpoints never imply independent recall or mastery.
export async function createFlightController(manifest, { onEvent=()=>{}, slow=false, memoryGateways=false, pickupMode=null, rounds=3 }={}) {
  const canonical=await createMission({surahId:manifest.surah,selection:'custom',start:manifest.first,end:manifest.last});
  if(JSON.stringify(manifest)!==JSON.stringify(canonical))throw Error('Mission configuration changed. Rebuild the briefing.');
  if(!Number.isInteger(rounds)||rounds<3||rounds>10)throw Error('Choose between 3 and 10 revision rounds.');
  const roundCount=pickupMode?rounds:1;
  let index=0, roundIndex=0, engine, disposed=false;
  const gateway=memoryGateways?createGatewaySession(canonical,{onEvent:e=>onEvent({...e,missionId:canonical.id,sourceHash:canonical.sourceHash})}):null;
  let stageGates=0;
  const checkpoints=new Set(),scoreReceipts=new Set();let arcadeScore=0;
  function mount() {
    stageGates=0;
    const factory=pickupMode?createFlowRunner:createRunner;
    engine=factory({...(pickupMode?{units:createFlowUnits(canonical.stages[index].refs,pickupMode,roundIndex),roundIndex}:{}),stageId:canonical.stages[index].id,seed:parseInt(canonical.sourceHash.slice(0,8),16)+index+roundIndex*3571,
      difficulty:index,slow,onEvent(event){
        if(disposed)return;
        if(event.type==='runner:checkpoint') {
          if(checkpoints.has(event.checkpointId))return;
          checkpoints.add(event.checkpointId);
        }
        const receipt=event.scoreReceipt?`${index}:${roundIndex}:${event.scoreReceipt}`:null;
        const awardedPoints=receipt&&!scoreReceipts.has(receipt)&&Number.isSafeInteger(event.points)&&event.points>0?event.points:0;
        if(awardedPoints){scoreReceipts.add(receipt);arcadeScore+=awardedPoints;}
        const targetIndex=event.targetRef?canonical.refs.indexOf(event.targetRef):-1;
        onEvent({...event,awardedPoints,...(targetIndex>=0?{fromRef:['word','chunk'].includes(event.kind)&&(event.kind==='chunk'?event.unitId.split(':').at(-1).split('-')[0]!=='0':!event.unitId.endsWith(':0'))?event.targetRef:targetIndex?canonical.refs[targetIndex-1]:null}:{}),missionId:canonical.id,stageIndex:index,roundIndex,roundCount,completedCheckpoints:[...checkpoints]});
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
          gateway.dispatch({type:'continue'});stageGates++;
          if(pickupMode){if(gateway.remaining(index))gateway.enter(index);}else engine.resume();
        }else if(action.type.startsWith('gateway-'))gateway.dispatch({...action,type:action.type.slice(8)});
        else if(action.type==='lane')gateway.dispatch(action);
        return;
      }
      if(action.type==='restart')stageGates=canonical.stages[index].refs.filter(ref=>gateway?.getSnapshot().completed.includes(ref)).length;
      engine.dispatch(action);
      if(pickupMode&&gateway?.remaining(index)&&engine.getSnapshot().status==='checkpoint')gateway.enter(index);
      if(!pickupMode&&gateway?.remaining(index)&&engine.getSnapshot().status==='running'){
        const snap=engine.getSnapshot(),wave=snap.waves[Math.min(stageGates,snap.waves.length-1)];
        if(snap.elapsed>=wave.arrival+1){engine.pause('Safe orbit — memory gateway');gateway.enter(index);}
      }
    },
    getSnapshot:()=>({...engine.getSnapshot(),status:gateway&&gateway.getSnapshot().state!=='idle'&&gateway.getSnapshot().state!=='disposed'?'gateway':engine.getSnapshot().status,gateway:gateway?.getSnapshot()||null,arcadeScore,stageIndex:index,stageCount:canonical.stages.length,roundIndex,roundCount,completedCheckpoints:[...checkpoints],routeComplete:roundIndex===roundCount-1&&index===canonical.stages.length-1&&engine.getSnapshot().status==='checkpoint'&&(!gateway||gateway.getSnapshot().completed.length===canonical.refs.length)}),
    nextStage(){
      if(disposed||engine.getSnapshot().status!=='checkpoint'||gateway?.remaining(index)>0||index>=canonical.stages.length-1&&roundIndex>=roundCount-1)return false;
      engine.dispose();if(roundIndex<roundCount-1)roundIndex++;else{index++;roundIndex=0;}mount();engine.start();return true;
    },
    dispose(){if(!disposed){engine.dispose();gateway?.dispose();disposed=true;}},
  };
}
