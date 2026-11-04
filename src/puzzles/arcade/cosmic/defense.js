import {createGatewaySession,freeAyah} from '../../../quest/cosmic/gateways.js';
export const DEFENSE_WORLD=Object.freeze({width:1000,height:680,cx:500,cy:340,coreRadius:44});
export const DEFENSE_CONFIGS=Object.freeze({
  balanced:Object.freeze({health:100,turn:2.5,cooldown:.22,speed:65,label:'Balanced · steady defense'}),
  fortress:Object.freeze({health:130,turn:1.9,cooldown:.30,speed:58,label:'Fortress · stronger core'}),
  agile:Object.freeze({health:90,turn:3.2,cooldown:.16,speed:72,label:'Agile · quick turret'}),
});
export const DEFENSE_ABILITIES=Object.freeze({shield:'Star Shield',pulse:'Pulse Wave',repair:'Repair Beam',burst:'Constellation Burst'});
const clone=x=>structuredClone(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createMeteorDefense({refs,seed=1,stageId,sourceHash='',configuration='balanced',difficulty=0,slow=false,revisionLoop=false,onEvent=()=>{}}){
  if(!Array.isArray(refs)||!refs.length||refs.length>5||!Object.hasOwn(DEFENSE_CONFIGS,configuration))throw Error('Choose a verified defense set and configuration.');
  refs.forEach((ref,i)=>{const v=freeAyah(ref);if(i){const p=freeAyah(refs[i-1]);if(v.surah!==p.surah||v.ayah!==p.ayah+1)throw Error('Defense references must be consecutive.');}});
  const config=DEFENSE_CONFIGS[configuration],W=DEFENSE_WORLD;
  let state,meteors=[],bolts=[],effects=[],plan=[],memory,spawned=0,shot=0,waveTime=0,turn=0,held=false;
  const earned=new Set(),listened=new Set();
  const emit=(type,detail={})=>onEvent({...detail,type:`defense:${type}`,stageId,elapsed:state.elapsed,targetRef:detail.targetRef||refs[state.waveIndex]});
  const effect=(kind,x=W.cx,y=W.cy)=>{effects.push({id:`fx:${shot++}`,kind,x,y,life:.65});effects=effects.slice(-12);};
  function award(id,points){if(earned.has(id))return;earned.add(id);state.score+=points;emit('points',{scoreReceipt:`defense:${id}`,points});}
  function freshMemory(){
    memory?.dispose();
    memory=createGatewaySession({id:`${stageId}:defense`,refs,sourceHash},{onEvent(e){
      if(e.type==='gateway:correct'){
        state.recognized=[...new Set([...state.recognized,e.targetRef])];
        for(const name of Object.keys(DEFENSE_ABILITIES))state.charges[name]=Math.min(2,state.charges[name]+1);
        emit('memory-correct',{...e,assisted:e.assisted||listened.has(e.targetRef),recognitionOnly:true});effect('charge');
      }else if(e.type==='gateway:mistake'){state.memoryMistakes++;emit('memory-mistake',e);}
      else if(e.type==='gateway:hint')emit('memory-hint',e);
    }});
  }
  function pattern(){
    let n=(seed+state.waveIndex*7919)>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    const count=7+Math.min(3,Math.max(0,difficulty)),type=['ring','crossfire','sweep'][(state.waveIndex+difficulty)%3];
    state.pattern=type;state.meteorCount=count;
    return Array.from({length:count},(_,i)=>{
      let angle;
      if(type==='ring')angle=random()*Math.PI*2;
      else if(type==='crossfire')angle=(i%2?0:Math.PI)+(random()-.5)*.7;
      else angle=-Math.PI*.9+(i/(count-1))*Math.PI*.8;
      const distance=460,radius=22+random()*8,speed=(config.speed+random()*15+Math.min(5,difficulty)*2)*(slow?.7:1);
      return {id:`meteor:${state.waveIndex}:${i}`,kind:'meteor',x:W.cx+Math.cos(angle)*distance,y:W.cy+Math.sin(angle)*distance,
        vx:-Math.cos(angle)*speed,vy:-Math.sin(angle)*speed,radius,hp:i%4===3?2:1,at:1+i*(type==='crossfire'?1.05:1.2),damage:18,curve:type==='sweep'?(i%2?12:-12):0};
    });
  }
  function clearMotor(){meteors=[];bolts=[];effects=[];turn=0;held=false;state.cooldown=0;state.shield=0;state.impact=0;}
  function reset(){
    state={status:'ready',stageId,elapsed:0,waveIndex:0,angle:-Math.PI/2,health:config.health,maxHealth:config.health,shield:0,cooldown:0,impact:0,
      charges:{shield:0,pulse:0,repair:0,burst:0},recognized:[],memoryMistakes:0,motorErrors:0,defended:0,waveDefended:0,score:0,reason:'Recall to charge your defenses, then protect the core.',checkpointId:null};
    earned.clear();clearMotor();freshMemory();
  }
  reset();
  function launchWave(){clearMotor();waveTime=0;spawned=0;state.waveDefended=0;plan=pattern();state.status='running';state.reason='Aim and defend the energy core. Only neutral meteors are combat targets.';emit('wave-start',{pattern:state.pattern});}
  function resolve(m,ability=false){meteors=meteors.filter(o=>o.id!==m.id);state.defended++;state.waveDefended++;effect('hit',m.x,m.y);award(m.id,ability?10:20);}
  function fire(angle=state.angle){if(bolts.length>=32)return;bolts.push({id:`energy:${shot++}`,kind:'energy',x:W.cx+Math.cos(angle)*70,y:W.cy+Math.sin(angle)*70,vx:Math.cos(angle)*600,vy:Math.sin(angle)*600,radius:6,life:2});}
  function canRepair(){return state.health<state.maxHealth&&(state.status==='running'||state.status==='recovery'&&(spawned<plan.length||meteors.length>0||state.waveDefended>=Math.ceil(plan.length*.4)));}
  function ability(name){
    if(!Object.hasOwn(DEFENSE_ABILITIES,name)||!state.charges[name]||!['running','recovery'].includes(state.status)||state.status==='recovery'&&name!=='repair')return;
    if(name==='repair'&&!canRepair())return;
    state.charges[name]--;
    if(name==='shield'){state.shield=5;effect('shield');}
    if(name==='pulse'){effect('pulse');for(const m of [...meteors])if(Math.hypot(m.x-W.cx,m.y-W.cy)<220)resolve(m,true);}
    if(name==='repair'){state.health=Math.min(state.maxHealth,state.health+36);effect('repair');if(state.status==='recovery')state.status='running';}
    if(name==='burst'){effect('burst');for(let i=0;i<8;i++)fire(state.angle+i*Math.PI/4);}
    state.reason=`${DEFENSE_ABILITIES[name]} activated using a recognition-earned charge.`;emit('ability',{ability:name,category:'motor-defense'});
  }
  function tick(dt){
    state.elapsed+=dt;waveTime+=dt;state.angle+=turn*config.turn*dt;state.cooldown=Math.max(0,state.cooldown-dt);state.shield=Math.max(0,state.shield-dt);state.impact=Math.max(0,state.impact-dt);
    if(held&&state.cooldown===0){fire();state.cooldown=config.cooldown;}
    while(spawned<plan.length&&waveTime>=plan[spawned].at)meteors.push({...plan[spawned++]});
    for(const m of meteors){m.x+=m.vx*dt;m.y+=m.vy*dt+Math.sin(waveTime*1.4)*m.curve*dt;}
    for(const b of bolts){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      const m=meteors.find(m=>Math.hypot(m.x-b.x,m.y-b.y)<=m.radius+b.radius);
      if(m){b.life=0;m.hp--;effect('spark',m.x,m.y);if(!m.hp)resolve(m);}
    }
    bolts=bolts.filter(b=>b.life>0&&b.x>-50&&b.x<W.width+50&&b.y>-150&&b.y<W.height+150);
    effects=effects.filter(e=>(e.life-=dt)>0);
    for(const m of [...meteors])if(Math.hypot(m.x-W.cx,m.y-W.cy)<m.radius+W.coreRadius){
      if(state.shield>0){resolve(m,true);effect('shield');}
      else{meteors=meteors.filter(o=>o.id!==m.id);state.health=Math.max(0,state.health-m.damage);state.motorErrors++;state.impact=.4;emit('core-hit',{damage:m.damage,health:state.health,category:'motor-control'});}
      if(!state.health){state.status='recovery';turn=0;held=false;bolts=[];state.reason='Core offline. Retry this wave with your recorded recognition progress intact, or use a charged Repair Beam.';emit('core-down',{category:'motor-control'});return;}
    }
    if(spawned===plan.length&&!meteors.length){
      turn=0;held=false;bolts=[];
      if(state.waveDefended<Math.ceil(plan.length*.4)){state.status='recovery';state.reason='Defend more meteors to secure the sector. Retry this wave; your Quran checkpoint remains completed.';return;}
      if(revisionLoop){state.status='gateway';state.reason='Wave secured. Recall the ayah you heard, then enter its gateway.';memory.enter(0);}
      else if(state.waveIndex===refs.length-1){state.status='checkpoint';state.checkpointId=`${stageId}:defense:${difficulty}:clear`;state.reason='Core secured. Defense practice is complete, not certified memorization.';emit('checkpoint',{checkpointId:state.checkpointId,motorErrors:state.motorErrors,memoryMistakes:state.memoryMistakes,defended:state.defended,health:state.health});}
      else{state.status='wave-clear';state.reason='Wave secured. Take the next untimed Quran checkpoint to recharge your defenses.';}
    }
  }
  const api={
    start(){if(state.status==='ready'){if(revisionLoop)launchWave();else{state.status='gateway';memory.enter(0);}}return api.getSnapshot();},
    pause(reason='Defense paused.'){if(state.status==='running'){state.status='paused';state.reason=reason;turn=0;held=false;}return api.getSnapshot();},
    resume(){if(state.status==='paused'){state.status='running';turn=0;held=false;}return api.getSnapshot();},
    dispatch(a){
      if(state.status==='disposed')return api.getSnapshot();
      if(a.type==='start')return api.start();if(a.type==='pause')return api.pause(a.reason);if(a.type==='resume')return api.resume();
      if(a.type==='restart'){reset();return api.start();}
      if(a.type==='audio-assisted'){listened.add(refs[state.waveIndex]);return api.getSnapshot();}
      if(state.status==='gateway'){
        if(a.type==='gateway-continue'&&memory.getSnapshot().state==='open'){memory.dispatch({type:'continue'});if(revisionLoop&&state.waveIndex===refs.length-1){state.status='checkpoint';state.checkpointId=`${stageId}:defense:${difficulty}:clear`;emit('checkpoint',{checkpointId:state.checkpointId,motorErrors:state.motorErrors,memoryMistakes:state.memoryMistakes,defended:state.defended,health:state.health});}else{if(revisionLoop)state.waveIndex++;launchWave();}}
        else if(a.type.startsWith('gateway-'))memory.dispatch({...a,type:a.type.slice(8)});
        else if(a.type==='lane')memory.dispatch(a);
        return api.getSnapshot();
      }
      if(a.type==='next-wave'&&state.status==='wave-clear'){state.waveIndex++;state.status='gateway';memory.enter(0);return api.getSnapshot();}
      if(a.type==='retry'&&state.status==='recovery'){state.health=state.maxHealth;launchWave();return api.getSnapshot();}
      if(a.type==='ability'){ability(a.name);return api.getSnapshot();}
      if(state.status!=='running')return api.getSnapshot();
      if(a.type==='aim'&&Number.isFinite(a.angle))state.angle=a.angle;
      if(a.type==='turn'&&[-1,0,1].includes(a.direction))turn=a.direction;
      if(a.type==='fire'){held=a.active===true;if(a.active!==false&&state.cooldown===0){fire();state.cooldown=config.cooldown;}}
      if(a.type==='tick'&&Number.isFinite(a.dt)&&a.dt>0){if(a.dt>.25)return api.pause('Defense paused after an interruption; no catch-up damage.');let left=a.dt;while(left>1e-8&&state.status==='running'){const dt=Math.min(left,1/120);tick(dt);left-=dt;}}
      return api.getSnapshot();
    },
    getSnapshot(){return clone({...state,canRepair:canRepair(),defense:true,revisionLoop,configuration,world:W,objects:[...meteors,...bolts,...effects],gateway:memory.getSnapshot(),targetRef:refs[state.waveIndex],progress:state.waveIndex/refs.length,waveCount:refs.length});},
    dispose(){state.status='disposed';meteors=[];bolts=[];effects=[];turn=0;held=false;memory.dispose();},
  };
  return api;
}
