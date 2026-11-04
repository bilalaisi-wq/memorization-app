import {WORLD} from './runner.js';
import {flowChoices} from '../../../quest/cosmic/flow-content.js';
const clone=x=>structuredClone(x);
export const BOOST_CAPACITY=4;
export const BOOST_MULTIPLIER=2.31;
// Arabic pickups are intact capsules, separate from unlabeled environmental rocks.
export function createFlowRunner({units,seed=1,stageId,difficulty=0,roundIndex=0,slow=false,onEvent=()=>{}}) {
  if(!units?.length)throw Error('Verified flow units required.');
  if(!Number.isInteger(roundIndex)||roundIndex<0||roundIndex>9)throw Error('Invalid revision round.');
  const speedMultiplier=1+roundIndex*.07,asteroidCount=1+roundIndex;
  let state,wave,round=0,shots=[],effects=[],shotId=0;
  const scoreReceipts=new Set();
  function points(receipt,value){if(scoreReceipts.has(receipt))return 0;scoreReceipts.add(receipt);state.score+=value;return value;}
  function emit(type,detail={}){onEvent({type:`runner:${type}`,stageId,elapsed:state.elapsed,...detail});}
  function spawn(){
    const target=units[state.cursor],choices=flowChoices(target,(seed+round*7919+state.cursor*101)>>>0);
    const ribbon=target.kind==='ayah',level=Math.min(6,difficulty),speed=((ribbon?(slow?32:42):(slow?65:85))+level*2)*speedMultiplier;
    const longest=Math.max(...choices.map(c=>c.text.split(/\s+/).length));
    const readTime=Math.max((ribbon?Math.max(slow?8:6,longest*.65):slow?7:5.8)/speedMultiplier,2.5+(asteroidCount-1)*1.1+1.8);
    const spacing=ribbon?Math.max(5,longest*.5):0;
    const start=state.elapsed;
    wave={id:`${stageId}:${roundIndex}:${seed}:flow:${round++}`,start,ribbon,choices,objects:choices.map((c,lane)=>({id:`${stageId}:${roundIndex}:${seed}:flow:${round-1}:${lane}`,kind:'pickup',unit:c,lane,x:WORLD.lanes[lane],radius:25,arrival:start+readTime+lane*spacing})),resolved:false};
    // Rock positions are independent of the correct lane and clear well before text arrives.
    const rockLane=(seed+round*7+state.cursor)%3;
    for(let i=0;i<asteroidCount;i++){const lane=(rockLane+i)%3;wave.objects.push({id:`${stageId}:${roundIndex}:${seed}:flow:${round-1}:rock:${i}`,kind:'asteroid',lane,x:WORLD.lanes[lane],rockIndex:i,radius:29,arrival:start+2.5+i*1.1,drift:(round+i)%2?24:0});}
    wave.speed=speed;wave.end=Math.max(...wave.objects.map(o=>o.arrival))+1.2;
  }
  function reset(){shots=[];effects=[];shotId=0;scoreReceipts.clear();state={cueSlow:false,score:0,destroyed:0,boostedPickups:0,boosting:false,boostEnergy:BOOST_CAPACITY,fireCooldown:0,status:'ready',stageId,elapsed:0,lane:1,x:300,shield:3,impact:0,invulnerable:0,motorErrors:0,memoryMistakes:0,cursor:0,collected:[],completedAyahs:[],laneChanges:0,reason:'',checkpointId:null};round=0;spawn();}
  reset();
  function objects(){
    if(!wave)return [];
    return wave.objects.map(o=>({...o,x:WORLD.lanes[o.lane]+(o.drift?Math.sin(state.elapsed*1.7)*o.drift:0),y:WORLD.shipY+(state.elapsed-o.arrival)*wave.speed,ribbon:wave.ribbon&&o.kind==='pickup'}))
      .filter(o=>!o.consumed&&o.y>=-300&&o.y<=WORLD.height+240);
  }
  function snapshot(){return clone({...state,flow:true,roundIndex,speedMultiplier,asteroidCount,unit:units[state.cursor]||null,totalUnits:units.length,objects:[...objects(),...shots.map(b=>({...b,kind:'bolt',radius:5})),...effects.map(e=>({...e,kind:e.kind||'burst',radius:e.kind==='starburst'?90:38}))],waveId:wave?.id,waves:[],nextSafeLane:null,progress:state.cursor/units.length,slow});}
  function finishWave(selected){
    const target=units[state.cursor];wave.resolved=true;
    wave.objects.forEach(o=>{o.consumed=true;});
    if(selected?.unit.id===target.id){
      state.collected.push(target.id);state.cursor++;
      if(target.last&&!state.completedAyahs.includes(target.key))state.completedAyahs.push(target.key);
      const boosted=state.boosting;const scoreReceipt=`pickup:${target.id}`;const earned=points(scoreReceipt,boosted?40:20);
      if(boosted){state.boostedPickups++;effects.push({id:`starburst:${state.cursor}:${round}`,x:state.x,y:WORLD.shipY,life:.8,kind:'starburst'});}
      state.reason=boosted?'Boost connection! +40 arcade points.':'Connection collected. +20 arcade points.';
      emit('pickup-correct',{boosted,points:earned,scoreReceipt,unitId:target.id,targetRef:target.key,selectedRef:selected.unit.key,selectedUnitId:selected.unit.id,kind:target.kind,ayahComplete:target.last,recognitionOnly:true});
      if(state.cursor===units.length){state.status='checkpoint';state.boosting=false;shots=[];state.shield=3;state.checkpointId=`${stageId}:round:${roundIndex}:flow-clear`;emit('checkpoint',{checkpointId:state.checkpointId,completedAyahs:[...state.completedAyahs],category:'supported-sequence-practice'});return;}
    }else if(selected){
      state.memoryMistakes++;state.reason='That piece does not continue the sequence. The same target is returning.';
      emit('pickup-mistake',{unitId:target.id,targetRef:target.key,selectedRef:selected.unit.key,selectedUnitId:selected.unit.id,kind:target.kind,category:'observed-flow-selection'});
    }else{state.reason='The missed piece is returning. Earlier connections stay in place.';emit('pickup-missed',{unitId:target.id,category:'motor-control'});}
    wave.nextAt=state.elapsed+1;
  }
  function tick(dt){
    const boosted=state.boosting&&state.boostEnergy>0;
    if(boosted){state.boostEnergy=Math.max(0,state.boostEnergy-dt);if(!state.boostEnergy)state.boosting=false;}
    else state.boostEnergy=Math.min(BOOST_CAPACITY,state.boostEnergy+dt*.6);
    state.elapsed+=dt*(boosted?BOOST_MULTIPLIER:1)*(state.cueSlow ? .25 : 1);state.fireCooldown=Math.max(0,state.fireCooldown-dt);state.invulnerable=Math.max(0,state.invulnerable-dt);state.impact=Math.max(0,state.impact-dt);
    const delta=WORLD.lanes[state.lane]-state.x;state.x+=Math.sign(delta)*Math.min(Math.abs(delta),1400*dt);
    effects=effects.filter(e=>(e.life-=dt)>0);
    for(const b of shots)b.y-=720*dt;
    shots=shots.filter(b=>b.y>-40&&!b.spent);
    if(wave.resolved){if(state.elapsed>=wave.nextAt)spawn();return;}
    for(const b of shots){
      const rock=objects().find(o=>o.kind==='asteroid'&&(o.x-b.x)**2+(o.y-b.y)**2<=(o.radius+7)**2);
      if(!rock)continue;
      wave.objects.find(o=>o.id===rock.id).consumed=true;b.spent=true;state.destroyed++;
      effects.push({id:`burst:${b.id}`,x:rock.x,y:rock.y,life:.35});
      const scoreReceipt=`rock:${state.cursor}:${rock.rockIndex}`,earned=points(scoreReceipt,10);
      state.reason=earned?'Asteroid cleared! +10 arcade points.':'Asteroid cleared. Already scored for this piece.';
      emit('asteroid-destroyed',{targetRef:units[state.cursor].key,objectId:rock.id,scoreReceipt,points:earned,category:'motor-defense'});
    }
    shots=shots.filter(b=>!b.spent);
    for(const o of objects()){
      if((o.x-state.x)**2+(o.y-WORLD.shipY)**2>(o.radius+17)**2)continue;
      if(o.kind==='pickup'){finishWave(o);return;}
      wave.objects.find(a=>a.id===o.id).consumed=true;
      if(!state.invulnerable){state.shield--;state.motorErrors++;state.invulnerable=1.5;state.impact=.55;emit('collision',{objectId:o.id,shield:state.shield,category:'motor-control'});
        if(!state.shield){state.status='recovery';state.boosting=false;shots=[];state.reason='Shield depleted. Retry from this piece; earlier connections are preserved.';return;}}
    }
    if(state.elapsed>wave.end)finishWave(null);
  }
  const api={
    start(){if(state.status==='ready'){state.status='running';emit('start');}return snapshot();},
    pause(reason='Flight paused.'){if(state.status==='running'){state.status='paused';state.boosting=false;state.reason=reason;emit('pause');}return snapshot();},
    resume(){if(state.status==='paused'){state.status='running';emit('resume');}return snapshot();},
    dispatch(a){
      if(state.status==='disposed')return snapshot();
      if(a.type==='start')return api.start();if(a.type==='pause')return api.pause(a.reason);if(a.type==='resume')return api.resume();
      if(a.type==='restart'){reset();return api.start();}
      if(a.type==='retry'&&state.status==='recovery'){state.shield=3;state.invulnerable=0;shots=[];state.status='running';spawn();return snapshot();}
      if(a.type==='cue'){state.cueSlow=a.active===true;return snapshot();}
      if(state.status!=='running')return snapshot();
      if(a.type==='boost'){state.boosting=a.active===true&&state.boostEnergy>0;}
      if(a.type==='fire'&&state.fireCooldown===0&&shots.length<8){state.fireCooldown=.25;shots.push({id:`bolt:${shotId++}`,x:state.x,y:WORLD.shipY-35});emit('fire');}
      // Staying in a lane is a valid selection; contact never needs re-arming.
      if(a.type==='lane'&&[-1,1].includes(a.direction)){const next=Math.max(0,Math.min(2,state.lane+a.direction));if(next!==state.lane){state.lane=next;state.laneChanges++;}}
      if(a.type==='tick'&&Number.isFinite(a.dt)&&a.dt>0){if(a.dt>.25)return api.pause('Flight paused after an interruption. Resume when ready.');let left=a.dt;while(left>1e-8&&state.status==='running'){const d=Math.min(left,1/120);tick(d);left-=d;}}
      return snapshot();
    },getSnapshot:snapshot,dispose(){state.status='disposed';state.boosting=false;shots=[];effects=[];},
  };
  return api;
}
