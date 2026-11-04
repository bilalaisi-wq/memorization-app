import {createAyahLink,LINK_MODES} from '../../puzzles/arcade/cosmic/link.js';
import {prepareLinkPlans} from './link-content.js';
import {createFlowUnits} from './flow-content.js';
import {createFlowRunner} from '../../puzzles/arcade/cosmic/flow-runner.js';
import {createMeteorDefense,DEFENSE_CONFIGS} from '../../puzzles/arcade/cosmic/defense.js';
import {createGatewaySession} from './gateways.js';
import {createMission} from './mission.js';
import {createRunner} from '../../puzzles/arcade/cosmic/runner.js';

// One mission director. Arcade checkpoints never certify independent recall or mastery.
export async function createFlightController(manifest,{onEvent=()=>{},slow=false,memoryGateways=false,pickupMode=null,rounds=3,activity='runner',defenseConfig='balanced',linkMode='guided',reducedMotion=false}={}){
  const canonical=await createMission({surahId:manifest.surah,selection:'custom',start:manifest.first,end:manifest.last});
  if(JSON.stringify(manifest)!==JSON.stringify(canonical))throw Error('Mission configuration changed. Rebuild the briefing.');
  if(!Number.isInteger(rounds)||rounds<3||rounds>10)throw Error('Choose between 3 and 10 revision rounds.');
  if(!['runner','defense','link'].includes(activity)||!Object.hasOwn(DEFENSE_CONFIGS,defenseConfig)||!Object.hasOwn(LINK_MODES,linkMode))throw Error('Choose an available Cosmic activity and defense configuration.');
  const runId=crypto.randomUUID();
  const roundCount=pickupMode?rounds:1,listeners=new Set([onEvent]),emit=e=>{for(const fn of [...listeners])fn(e);};
  let index=0,roundIndex=0,engine,disposed=false,currentActivity=activity,stageGates=0,arcadeScore=0;
  const linkPlans={},reviewRequested=new Set();
  if(activity==='link')Object.assign(linkPlans,await prepareLinkPlans(canonical.refs,null));
  const engines=new Map(),checkpoints=new Set(),activityClears=new Set(),scoreReceipts=new Set();
  const gateway=memoryGateways?createGatewaySession(canonical,{onEvent:e=>emit({...e,missionId:canonical.id,sourceHash:canonical.sourceHash})}):null;
  function event(event){
    if(disposed)return;
    if(['runner:checkpoint','defense:checkpoint','link:checkpoint'].includes(event.type)){
      activityClears.add(`${currentActivity}:${index}:${roundIndex}`);
      if(checkpoints.has(event.checkpointId))return;checkpoints.add(event.checkpointId);
    }
    const receipt=event.scoreReceipt?`${currentActivity}:${index}:${roundIndex}:${event.scoreReceipt}`:null;
    const awardedPoints=receipt&&!scoreReceipts.has(receipt)&&Number.isSafeInteger(event.points)&&event.points>0?event.points:0;
    if(awardedPoints){scoreReceipts.add(receipt);arcadeScore+=awardedPoints;}
    const targetIndex=event.targetRef?canonical.refs.indexOf(event.targetRef):-1;
    emit({...event,awardedPoints,...(targetIndex>=0?{fromRef:(event.type.startsWith('defense:memory-')||event.type.startsWith('link:'))?event.fromRef||null:['word','chunk'].includes(event.kind)&&(event.kind==='chunk'?event.unitId.split(':').at(-1).split('-')[0]!=='0':!event.unitId.endsWith(':0'))?event.targetRef:targetIndex?canonical.refs[targetIndex-1]:null}:{}),activity:currentActivity,missionId:canonical.id,runId,stageIndex:index,roundIndex,roundCount,completedCheckpoints:[...checkpoints]});
  }
  function mount(){
    stageGates=0;
    const stage=canonical.stages[index],seed=parseInt(canonical.sourceHash.slice(0,8),16)+index+roundIndex*3571;
    if(currentActivity==='link')engine=createAyahLink({refs:stage.refs,allRefs:canonical.refs,plans:linkPlans,stageId:stage.id,seed,mode:linkMode,reducedMotion,onEvent:event});
    else if(currentActivity==='defense')engine=createMeteorDefense({refs:stage.refs,stageId:stage.id,sourceHash:canonical.sourceHash,seed,configuration:defenseConfig,difficulty:index+roundIndex,slow,onEvent:event});
    else engine=(pickupMode?createFlowRunner:createRunner)({...(pickupMode?{units:createFlowUnits(stage.refs,pickupMode,roundIndex),roundIndex}:{}),stageId:stage.id,seed,difficulty:index,slow,onEvent:event});
    engines.set(currentActivity,engine);
  }
  mount();
  const pending=()=>currentActivity==='runner'&&(gateway?.remaining(index)||0)>0;
  return {
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    start:()=>engine.start(),pause:reason=>engine.pause(reason),resume:()=>engine.resume(),
    dispatch(action){
      if(disposed)return;
      if(currentActivity!=='runner'){engine.dispatch(action);return;}
      const g=gateway?.getSnapshot();
      if(g&&g.state!=='idle'){
        if(action.type==='gateway-continue'&&g.state==='open'){gateway.dispatch({type:'continue'});stageGates++;if(pickupMode){if(gateway.remaining(index))gateway.enter(index);}else engine.resume();}
        else if(action.type.startsWith('gateway-'))gateway.dispatch({...action,type:action.type.slice(8)});
        else if(action.type==='lane')gateway.dispatch(action);
        return;
      }
      if(action.type==='restart')stageGates=canonical.stages[index].refs.filter(ref=>gateway?.getSnapshot().completed.includes(ref)).length;
      engine.dispatch(action);
      if(pickupMode&&pending()&&engine.getSnapshot().status==='checkpoint')gateway.enter(index);
      if(!pickupMode&&pending()&&engine.getSnapshot().status==='running'){
        const s=engine.getSnapshot(),wave=s.waves[Math.min(stageGates,s.waves.length-1)];
        if(s.elapsed>=wave.arrival+1){engine.pause('Safe orbit — memory gateway');gateway.enter(index);}
      }
    },
    getSnapshot(){
      const s=engine.getSnapshot(),g=currentActivity==='runner'?gateway?.getSnapshot():null;
      const atRouteEnd=roundIndex===roundCount-1&&index===canonical.stages.length-1&&s.status==='checkpoint'&&!pending();
      const activityCompletedCount=[...activityClears].filter(key=>key.startsWith(`${currentActivity}:`)).length,activityRequiredCount=canonical.stages.length*roundCount;
      return {...s,status:g&&!['idle','disposed'].includes(g.state)?'gateway':s.status,gateway:g||s.gateway||null,activity:currentActivity,runId,arcadeScore,stageIndex:index,stageCount:canonical.stages.length,roundIndex,roundCount,completedCheckpoints:[...checkpoints],
        atRouteEnd,activityCompletedCount,activityRequiredCount,routeComplete:atRouteEnd&&activityCompletedCount===activityRequiredCount};
    },
    async prepareLink(client,next=false){
      if(disposed)return false;
      const stageIndex=next&&roundIndex===roundCount-1?index+1:index;
      if(!canonical.stages[stageIndex])return false;
      if(!Object.keys(linkPlans).length)Object.assign(linkPlans,await prepareLinkPlans(canonical.refs,null));
      if(disposed)return false;
      const targetStage=canonical.stages[stageIndex],missing=targetStage.refs.filter(ref=>!linkPlans[ref]||client&&!reviewRequested.has(ref));
      missing.forEach(ref=>reviewRequested.add(ref));
      const prepared=await prepareLinkPlans(missing,client);if(disposed)return false;
      Object.assign(linkPlans,prepared);
      if(currentActivity==='link'&&engine.getSnapshot().status==='ready'){engine.dispose();mount();}
      return true;
    },
    switchActivity(next){
      if(disposed||!['runner','defense','link'].includes(next)||next===currentActivity||engine.getSnapshot().status!=='checkpoint'||pending())return false;
      if(next==='link'&&canonical.stages[index].refs.some(ref=>!linkPlans[ref]))return false;
      currentActivity=next;if(engines.has(next))engine=engines.get(next);else mount();
      emit({type:'mission:activity-changed',activity:currentActivity,missionId:canonical.id,runId,stageIndex:index,roundIndex});return true;
    },
    nextStage(){
      if(disposed||engine.getSnapshot().status!=='checkpoint'||pending()||index>=canonical.stages.length-1&&roundIndex>=roundCount-1)return false;
      for(const e of new Set(engines.values()))e.dispose();engines.clear();
      if(roundIndex<roundCount-1)roundIndex++;else{index++;roundIndex=0;}mount();engine.start();return true;
    },
    dispose(){if(disposed)return;disposed=true;for(const e of new Set(engines.values()))e.dispose();engines.clear();gateway?.dispose();listeners.clear();},
  };
}
