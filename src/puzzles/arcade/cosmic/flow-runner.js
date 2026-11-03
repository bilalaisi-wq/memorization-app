import {WORLD} from './runner.js';
import {flowChoices} from '../../../quest/cosmic/flow-content.js';
const clone=x=>structuredClone(x);
// Arabic pickups are intact capsules, separate from unlabeled environmental rocks.
export function createFlowRunner({units,seed=1,stageId,difficulty=0,roundIndex=0,slow=false,onEvent=()=>{}}) {
  if(!units?.length)throw Error('Verified flow units required.');
  if(!Number.isInteger(roundIndex)||roundIndex<0||roundIndex>9)throw Error('Invalid revision round.');
  const speedMultiplier=1+roundIndex*.07,asteroidCount=1+roundIndex;
  let state,wave,round=0;
  function emit(type,detail={}){onEvent({type:`runner:${type}`,stageId,elapsed:state.elapsed,...detail});}
  function spawn(){
    const target=units[state.cursor],choices=flowChoices(target,(seed+round*7919+state.cursor*101)>>>0);
    const ribbon=target.kind==='ayah',level=Math.min(6,difficulty),speed=((ribbon?(slow?32:42):(slow?65:85))+level*2)*speedMultiplier;
    const longest=Math.max(...choices.map(c=>c.text.split(/\s+/).length));
    const readTime=Math.max((ribbon?Math.max(slow?8:6,longest*.65):slow?7:5.8)/speedMultiplier,2.5+(asteroidCount-1)*1.1+1.8);
    const spacing=ribbon?Math.max(5,longest*.5):0;
    const start=state.elapsed;
    wave={id:`${stageId}:${roundIndex}:${seed}:flow:${round++}`,start,ribbon,choices,armed:false,objects:choices.map((c,lane)=>({id:`${stageId}:${roundIndex}:${seed}:flow:${round-1}:${lane}`,kind:'pickup',unit:c,lane,x:WORLD.lanes[lane],radius:25,arrival:start+readTime+lane*spacing})),resolved:false};
    // Rock positions are independent of the correct lane and clear well before text arrives.
    const rockLane=(seed+round*7+state.cursor)%3;
    for(let i=0;i<asteroidCount;i++){const lane=(rockLane+i)%3;wave.objects.push({id:`${stageId}:${roundIndex}:${seed}:flow:${round-1}:rock:${i}`,kind:'asteroid',lane,x:WORLD.lanes[lane],radius:29,arrival:start+2.5+i*1.1,drift:(round+i)%2?24:0});}
    wave.speed=speed;wave.end=Math.max(...wave.objects.map(o=>o.arrival))+1.2;
  }
  function reset(){state={status:'ready',stageId,elapsed:0,lane:1,x:300,shield:3,impact:0,invulnerable:0,motorErrors:0,memoryMistakes:0,cursor:0,collected:[],completedAyahs:[],laneChanges:0,reason:'',checkpointId:null};round=0;spawn();}
  reset();
  function objects(){
    if(!wave)return [];
    return wave.objects.map(o=>({...o,x:WORLD.lanes[o.lane]+(o.drift?Math.sin(state.elapsed*1.7)*o.drift:0),y:WORLD.shipY+(state.elapsed-o.arrival)*wave.speed,ribbon:wave.ribbon&&o.kind==='pickup'}))
      .filter(o=>!o.consumed&&o.y>=-300&&o.y<=WORLD.height+240);
  }
  function snapshot(){return clone({...state,flow:true,roundIndex,speedMultiplier,asteroidCount,unit:units[state.cursor]||null,totalUnits:units.length,objects:objects(),waveId:wave?.id,waves:[],nextSafeLane:null,progress:state.cursor/units.length,slow});}
  function finishWave(selected){
    const target=units[state.cursor];wave.resolved=true;
    wave.objects.forEach(o=>{o.consumed=true;});
    if(selected?.unit.id===target.id){
      state.collected.push(target.id);state.cursor++;
      if(target.last&&!state.completedAyahs.includes(target.key))state.completedAyahs.push(target.key);
      state.reason='Connection collected. Keep building the sequence.';
      emit('pickup-correct',{unitId:target.id,targetRef:target.key,selectedRef:selected.unit.key,selectedUnitId:selected.unit.id,kind:target.kind,ayahComplete:target.last,recognitionOnly:true});
      if(state.cursor===units.length){state.status='checkpoint';state.shield=3;state.checkpointId=`${stageId}:round:${roundIndex}:flow-clear`;emit('checkpoint',{checkpointId:state.checkpointId,completedAyahs:[...state.completedAyahs],category:'supported-sequence-practice'});return;}
    }else if(selected){
      state.memoryMistakes++;state.reason='That piece does not continue the sequence. The same target is returning.';
      emit('pickup-mistake',{unitId:target.id,targetRef:target.key,selectedRef:selected.unit.key,selectedUnitId:selected.unit.id,kind:target.kind,category:'observed-flow-selection'});
    }else{state.reason='The missed piece is returning. Earlier connections stay in place.';emit('pickup-missed',{unitId:target.id,category:'motor-control'});}
    wave.nextAt=state.elapsed+1;
  }
  function tick(dt){
    state.elapsed+=dt;state.invulnerable=Math.max(0,state.invulnerable-dt);state.impact=Math.max(0,state.impact-dt);
    const delta=WORLD.lanes[state.lane]-state.x;state.x+=Math.sign(delta)*Math.min(Math.abs(delta),1400*dt);
    if(wave.resolved){if(state.elapsed>=wave.nextAt)spawn();return;}
    for(const o of objects()){
      if((o.x-state.x)**2+(o.y-WORLD.shipY)**2>(o.radius+17)**2)continue;
      if(o.kind==='pickup'){if(wave.armed){finishWave(o);return;}continue;}
      wave.objects.find(a=>a.id===o.id).consumed=true;
      if(!state.invulnerable){state.shield--;state.motorErrors++;state.invulnerable=1.5;state.impact=.55;emit('collision',{objectId:o.id,shield:state.shield,category:'motor-control'});
        if(!state.shield){state.status='recovery';state.reason='Shield depleted. Retry from this piece; earlier connections are preserved.';return;}}
    }
    if(state.elapsed>wave.end)finishWave(null);
  }
  const api={
    start(){if(state.status==='ready'){state.status='running';emit('start');}return snapshot();},
    pause(reason='Flight paused.'){if(state.status==='running'){state.status='paused';state.reason=reason;emit('pause');}return snapshot();},
    resume(){if(state.status==='paused'){state.status='running';emit('resume');}return snapshot();},
    dispatch(a){
      if(state.status==='disposed')return snapshot();
      if(a.type==='start')return api.start();if(a.type==='pause')return api.pause(a.reason);if(a.type==='resume')return api.resume();
      if(a.type==='restart'){reset();return api.start();}
      if(a.type==='retry'&&state.status==='recovery'){state.shield=3;state.invulnerable=0;state.status='running';spawn();return snapshot();}
      if(state.status!=='running')return snapshot();
      if(a.type==='confirm-lane')wave.armed=true;
      if(a.type==='lane'&&[-1,1].includes(a.direction)){wave.armed=true;const next=Math.max(0,Math.min(2,state.lane+a.direction));if(next!==state.lane){state.lane=next;state.laneChanges++;}}
      if(a.type==='tick'&&Number.isFinite(a.dt)&&a.dt>0){if(a.dt>.25)return api.pause('Flight paused after an interruption. Resume when ready.');let left=a.dt;while(left>1e-8&&state.status==='running'){const d=Math.min(left,1/120);tick(d);left-=d;}}
      return snapshot();
    },getSnapshot:snapshot,dispose(){state.status='disposed';},
  };
  return api;
}
