import {assertDefenseContent} from '../../../quest/cosmic/defense-content.js';
import {seededShuffle} from '../content.js';
import {rayIntersection,angleDelta,BEAM_LIMIT,BEAM_COOLDOWN} from './defense-beam.js';
const mix=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0;};
const counts={relaxed:7,normal:11,arcade:14},clone=x=>structuredClone(x);
export function createIntelligentDefense({refs,seed=1,stageId,configuration,difficulty,slow,mode,content,motorDifficulty,chainMode,resume,onEvent,coreFactory}){
 assertDefenseContent(content);if(!counts[motorDifficulty]||!['classic','practice'].includes(chainMode)||!['capture','protected'].includes(mode))throw Error('Invalid defense configuration');
 const stages=content.stages(refs);let state,core,carriers=[],held=false,released=true,turn=0,aim=-Math.PI/2,serial=0,rewarded=new Set();
 const current=()=>stages[state.page],target=()=>current().targets[state.cursor],prefix=(p,c)=>stages[p].targets.slice(0,c).flatMap(t=>t.sourceWordIds);
 function emit(type,more={}){onEvent({type:`defense:${type}`,defenseVersion:2,mechanicsVersion:3,stageId,targetRef:current().reference,sourceFingerprint:content.plan.pins[current().reference],recognitionOnly:true,independentEligible:false,...more});}
 function protect(){core.setProtectedCarriers(carriers.map(c=>({id:c.id,x:c.x,y:c.y,radius:c.radius})));}
 function spawn(){
  if(state.pendingPiece||!target()){carriers=[];protect();return;}
  const t=target(),pool=current().distractors.filter(w=>w.sourceWordIds.length===t.sourceWordIds.length&&w.text!==t.text);
  const seen=new Set([t.text]),choices=[t];for(const w of seededShuffle(pool,seed+state.page*7919+state.cursor*101)){if(seen.has(w.text))continue;seen.add(w.text);choices.push(w);if(choices.length===3)break;}
  if(choices.length!==3)throw Error('Three distinguishable authorized carriers are required.');
  const slots=seededShuffle([{x:220,y:180},{x:780,y:180},{x:500,y:570}],mix(seed+state.page*4001+state.cursor*997+71));
  carriers=seededShuffle(choices,mix(seed+state.page*677+state.cursor*41+999)).map((piece,i)=>({id:`carrier:${state.page}:${state.cursor}:${serial++}`,kind:'carrier',piece,x:slots[i].x,y:slots[i].y,homeX:slots[i].x,homeY:slots[i].y,radius:92,age:0,releaseAge:0,shieldFlash:0,redirected:false}));protect();
 }
 function stop(){held=false;turn=0;state.beamActive=false;state.beam=null;state.lockId=null;}
 function makeCore({heal=false}={}){
  const prior=core?.getSnapshot();if(prior)state.pastMotorErrors+=prior.motorErrors;core?.dispose();
  core=coreFactory({refs:[current().reference],stageId:`${stageId}:piece:${state.page}:${state.waveCursor}`,seed:seed+state.page*7919+state.waveCursor*101,configuration,difficulty:difficulty+(state.page+state.waveCursor)%3,slow:slow||motorDifficulty==='relaxed',captureWaveCount:counts[motorDifficulty],onEvent:e=>{
   if(e.type==='defense:points'){const receipt=`piece:${state.page}:${state.waveCursor}:${e.scoreReceipt}`;if(rewarded.has(receipt))return;rewarded.add(receipt);state.score+=e.points;emit('points',{...e,scoreReceipt:receipt});return;}
   if(e.type==='defense:shield-ricochet'){const c=carriers.find(c=>c.id===e.carrierId);if(c)c.shieldFlash=.3;}
   emit(e.type.slice(8),{...e,targetRef:current().reference});
  }});
  if(prior)core.setCaptureResources({charges:prior.charges,...(!heal?{health:prior.health}:{})});protect();stop();
 }
 function reset(){core?.dispose();core=null;rewarded=new Set();state={defenseVersion:2,mechanicsVersion:3,status:'ready',page:0,cursor:0,waveCursor:0,pendingPiece:false,retryWave:false,tool:'intelligent',beamEnergy:100,beamUsed:0,beamActive:false,beam:null,cooldown:0,overheated:false,lockId:null,accepted:[],completedPages:[],completedRefs:[],strikes:0,memoryMistakes:[],motorMisses:0,pastMotorErrors:0,assistance:[],score:0,feedback:null,checkpointId:null,reason:'Aim at a meteor to laser it, or hold on a carrier to pull it. Clear the wave first if you prefer.',mode,motorDifficulty,chainMode};released=true;aim=-Math.PI/2;makeCore();spawn();}
 reset();
 function restore(r){
  if(r.version!==1||!Number.isInteger(r.page)||r.page<0||r.page>=stages.length||!Number.isInteger(r.cursor)||r.cursor<0||r.cursor>stages[r.page].targets.length||JSON.stringify(r.accepted)!==JSON.stringify(prefix(r.page,r.cursor))||JSON.stringify(r.completedPages)!==JSON.stringify(stages.slice(0,r.page).map(s=>s.id))||!Number.isInteger(r.strikes)||r.strikes<0||r.strikes>3||!Array.isArray(r.memoryMistakes)||!Array.isArray(r.assistance)||!Array.isArray(r.completedRefs)||r.completedRefs.some(k=>!refs.includes(k)||stages.some((s,i)=>s.reference===k&&(i>r.page||i===r.page&&r.cursor<s.targets.length))))throw Error('Saved defense state needs recovery; original data is preserved.');
  if(r.tool!==undefined&&!['blaster','tractor'].includes(r.tool))throw Error('Saved legacy tool needs recovery.');
  if(r.phase==='page-clear'&&(r.cursor!==stages[r.page].targets.length||r.page===stages.length-1)||r.phase==='lost'&&r.strikes!==3||r.phase==='checkpoint'&&(r.page!==stages.length-1||r.cursor!==stages[r.page].targets.length||!refs.every(k=>r.completedRefs.includes(k))))throw Error('Saved defense phase needs recovery.');
  if(r.phase!==undefined&&!['ready','running','paused','recovery','lost','page-clear','checkpoint'].includes(r.phase)||r.charges&&['shield','pulse','repair','burst'].some(k=>!Number.isInteger(r.charges[k])||r.charges[k]<0||r.charges[k]>2)||['motorErrors','motorMisses'].some(k=>r[k]!==undefined&&(!Number.isSafeInteger(r[k])||r[k]<0))||new Set(r.completedRefs).size!==r.completedRefs.length)throw Error('Saved defense resources need recovery.');
  const ids=x=>Array.isArray(x)&&x.length>0&&x.length<=12&&x.every(w=>/^\d+:\d+:\d+$/.test(w));
  if(r.memoryMistakes.some(e=>!refs.includes(e.key)||!ids(e.expectedIds)||!ids(e.selectedIds))||r.assistance.some(e=>!refs.includes(e.key)||e.kind!=='audio'))throw Error('Saved defense evidence needs recovery.');
  if(r.mechanicsVersion!==undefined&&r.mechanicsVersion!==3)throw Error('Saved beam version needs recovery.');
  if(r.mechanicsVersion===3&&(!Number.isInteger(r.waveCursor)||r.waveCursor<0||r.waveCursor>r.cursor||r.waveCursor!==r.cursor-(r.pendingPiece?1:0)||typeof r.pendingPiece!=='boolean'||typeof r.retryWave!=='boolean'||!Array.isArray(r.rewarded)||r.rewarded.some(x=>typeof x!=='string')||!Number.isFinite(r.score)||r.score<0))throw Error('Saved wave needs recovery.');
  const legacyPending=r.mechanicsVersion===undefined&&r.cursor===stages[r.page].targets.length&&!['page-clear','checkpoint'].includes(r.phase)&&!r.completedRefs.includes(stages[r.page].reference);
  Object.assign(state,{page:r.page,cursor:r.cursor,accepted:[...r.accepted],completedPages:[...r.completedPages],completedRefs:[...r.completedRefs],strikes:r.strikes,memoryMistakes:clone(r.memoryMistakes),assistance:clone(r.assistance),pastMotorErrors:r.motorErrors||0,motorMisses:r.motorMisses||0,waveCursor:r.waveCursor??r.cursor-(legacyPending?1:0),pendingPiece:r.pendingPiece===true||legacyPending,retryWave:r.retryWave===true,score:r.score||0});rewarded=new Set(r.rewarded||[]);makeCore();core.setCaptureResources({charges:r.charges});spawn();
  if(state.cursor===current().targets.length&&!state.pendingPiece){state.status=state.page===stages.length-1&&refs.every(k=>state.completedRefs.includes(k))?'checkpoint':'page-clear';}
  else if(state.strikes===3)state.status='lost';if(state.status==='checkpoint')state.checkpointId=`${stageId}:defense-capture:${mode}:clear`;state.reason='Saved source progress restored. The unfinished finite wave restarts safely.';
 }
 if(resume)restore(resume);
 function finish(){
  if(!state.pendingPiece||core.getSnapshot().status!=='wave-clear')return;
  state.pendingPiece=false;state.retryWave=false;state.waveCursor=state.cursor;
  if(target()){makeCore();spawn();core.start();return;}
  carriers=[];protect();state.status='page-clear';const next=stages[state.page+1];
  if(!next||next.reference!==current().reference){if(!state.completedRefs.includes(current().reference))state.completedRefs.push(current().reference);emit('memory-correct',{category:'supported-carrier-sequence',assisted:state.assistance.some(a=>a.key===current().reference),scoreReceipt:`capture:${current().reference}`,points:30});}
  if(state.page===stages.length-1){state.status='checkpoint';state.checkpointId=`${stageId}:defense-capture:${mode}:clear`;emit('checkpoint',{checkpointId:state.checkpointId,completedRefs:[...state.completedRefs],memoryMistakes:state.memoryMistakes.length,motorErrors:state.pastMotorErrors+core.getSnapshot().motorErrors});}stop();
 }
 function capture(c){
  if(state.pendingPiece||state.retryWave&&core.getSnapshot().status!=='wave-clear')return;
  if(c.piece.id===target().id){state.accepted.push(...c.piece.sourceWordIds);state.cursor++;state.pendingPiece=true;state.feedback={kind:'correct',text:'Correct!',piece:c.piece,x:c.x,y:c.y,life:.7};emit('piece-captured',{unitId:c.piece.id,sourceIds:[...c.piece.sourceWordIds],assisted:state.assistance.some(a=>a.key===current().reference)});core.dispatch({type:'recognition-charge'});carriers=[];protect();finish();}
  else{state.strikes++;state.memoryMistakes.push({key:current().reference,expectedIds:[...target().sourceWordIds],selectedIds:[...c.piece.sourceWordIds],page:state.page});emit('memory-mistake',{category:'committed-carrier-capture',expectedIds:[...target().sourceWordIds],selectedIds:[...c.piece.sourceWordIds]});const feedback={kind:'incorrect',text:'✕ Not quite — try again.',piece:c.piece,x:c.x,y:c.y,life:1};state.retryWave=true;makeCore({heal:true});spawn();state.feedback=feedback;if(state.strikes===3){state.status='lost';stop();}else core.start();}
 }
 function tick(dt){
  state.cooldown=Math.max(0,state.cooldown-dt);if(state.feedback){state.feedback.life-=dt;if(state.feedback.life<=0)state.feedback=null;}
  if(state.cooldown===0&&released)state.overheated=false;
  const cs=core.getSnapshot(),desired=turn?cs.angle+turn*5*dt:aim,angle=cs.angle+Math.sign(angleDelta(desired,cs.angle))*Math.min(Math.abs(angleDelta(desired,cs.angle)),9*dt);core.dispatch({type:'aim',angle});if(turn)aim=angle;
  state.beamActive=held&&!state.overheated&&state.cooldown===0;
  const hit=state.beamActive?rayIntersection(angle,[...cs.objects.filter(o=>o.kind==='meteor'),...carriers]):null;
  state.beam=state.beamActive?{kind:hit?.object.kind==='carrier'?'tractor':'laser',x:hit?.x??500+Math.cos(angle)*1100,y:hit?.y??340+Math.sin(angle)*1100}:null;state.lockId=hit?.object.kind==='carrier'?hit.object.id:null;
  if(state.beamActive){state.beamUsed+=dt;const o=hit?.object;if(o?.kind==='meteor')core.dispatch({type:'beam-hit',id:o.id,damage:dt*5});else if(o?.kind==='carrier'&&!(state.retryWave&&cs.status!=='wave-clear')){o.releaseAge=0;const distance=Math.hypot(o.x-500,o.y-340),step=Math.min(distance-80,420*dt);if(distance<=90)capture(o);else{o.x+=(500-o.x)/distance*step;o.y+=(340-o.y)/distance*step;}}if(state.beamUsed>=BEAM_LIMIT-1e-8){state.overheated=true;state.cooldown=BEAM_COOLDOWN;held=false;state.beamActive=false;state.beam=null;released=false;}}
  else if(!held){state.beamUsed=Math.max(0,state.beamUsed-dt*5);}
  for(const c of carriers){c.age+=dt;c.shieldFlash=Math.max(0,c.shieldFlash-dt);if(c.id!==state.lockId){c.releaseAge+=dt;if(c.releaseAge>.6){c.x+=(c.homeX-c.x)*Math.min(1,dt*.6);c.y+=(c.homeY-c.y)*Math.min(1,dt*.6);}}}
  protect();core.dispatch({type:'tick',dt});if(core.getSnapshot().status==='recovery'){state.status='recovery';stop();}finish();state.beamEnergy=Math.max(0,Math.round((1-state.beamUsed/BEAM_LIMIT)*100));
 }
 const api={start(){content.assertCurrent();if(state.status==='ready'){state.status='running';core.start();}return api.getSnapshot();},pause(){stop();released=true;if(state.status==='running'){state.status='paused';core.pause();}return api.getSnapshot();},resume(){if(state.status==='paused'){state.status='running';core.resume();}return api.getSnapshot();},dispatch(a){
  if(state.status==='disposed')return api.getSnapshot();content.assertCurrent();if(a.type==='start')return api.start();if(a.type==='pause')return api.pause();if(a.type==='resume')return api.resume();if(a.type==='restart'){reset();return api.start();}
  if(a.type==='audio-assisted'){state.assistance.push({key:current().reference,kind:'audio',page:state.page});return api.getSnapshot();}
  if(a.type==='retry'&&['lost','recovery'].includes(state.status)){if(state.status==='lost'&&chainMode==='classic')reset();else{state.strikes=state.status==='lost'?0:state.strikes;makeCore({heal:true});spawn();}state.status='running';core.start();}
  if(a.type==='next-page'&&state.status==='page-clear'){const before=current().reference;state.completedPages.push(current().id);state.page++;state.cursor=0;state.waveCursor=0;state.accepted=[];if(chainMode==='practice'&&before!==current().reference)state.strikes=0;makeCore();spawn();state.status='running';core.start();}
  if(a.type==='fire'&&a.active===false){held=false;released=true;if(state.cooldown===0)state.overheated=false;state.beamActive=false;state.beam=null;state.lockId=null;return api.getSnapshot();}
  if(a.type==='ability'){core.dispatch(a);if(state.status==='recovery'&&core.getSnapshot().status==='running')state.status='running';return api.getSnapshot();}
  if(state.status!=='running')return api.getSnapshot();
  if(a.type==='aim'&&Number.isFinite(a.angle)){aim=Math.atan2(Math.sin(a.angle),Math.cos(a.angle));turn=0;}
  if(a.type==='turn'&&[-1,0,1].includes(a.direction))turn=a.direction;
  if(a.type==='lock'){const c=carriers.find(c=>c.id===a.id);if(c)aim=Math.atan2(c.y-340,c.x-500);}
  if(a.type==='fire'&&a.active!==false&&released&&!state.overheated&&state.cooldown===0){held=true;released=false;state.beamUsed=0;}
  if(a.type==='ability')core.dispatch(a);
  if(a.type==='tick'&&Number.isFinite(a.dt)&&a.dt>0){if(a.dt>.25)return api.pause();let left=a.dt;while(left>1e-8&&state.status==='running'){const dt=Math.min(left,1/120);tick(dt);left-=dt;}}
  return api.getSnapshot();
 },getCheckpoint(){return {version:1,mechanicsVersion:3,phase:state.status,mode,motorDifficulty,memoryDifficulty:content.plan.memoryDifficulty,configuration,page:state.page,cursor:state.cursor,waveCursor:state.waveCursor,pendingPiece:state.pendingPiece,retryWave:state.retryWave,accepted:[...state.accepted],completedPages:[...state.completedPages],completedRefs:[...state.completedRefs],strikes:state.strikes,memoryMistakes:clone(state.memoryMistakes),assistance:clone(state.assistance),charges:{...core.getSnapshot().charges},motorErrors:state.pastMotorErrors+core.getSnapshot().motorErrors,motorMisses:state.motorMisses,score:state.score,rewarded:[...rewarded]};},getSnapshot(){if(state.status==='disposed')return {defenseVersion:2,status:'disposed',objects:[],carriers:[]};content.assertCurrent();const s=core.getSnapshot();return {...s,...clone(state),defense:true,coreStatus:s.status,wavePhase:s.status==='wave-clear'?'safe-capture':state.retryWave?'retry-wave':'defend',motorErrors:state.pastMotorErrors+s.motorErrors+state.motorMisses,totalPieces:current().targets.length,carriers:clone(carriers),targetRef:current().reference,pageCount:stages.length,sourceStage:{id:current().id,reference:current().reference,firstWord:current().firstWord,lastWord:current().lastWord},expected:state.pendingPiece?null:clone(target()??null),captured:current().targets.slice(0,state.cursor).map(t=>t.text),gateway:null};},dispose(){state.status='disposed';stop();core.dispose();carriers=[];stages.length=0;}};return api;
}
