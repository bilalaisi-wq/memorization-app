import {annotateDifficulty,memoryLevel,motorLevel} from '../difficulty.js';
import {mountBridgeTutorial} from './tutorial.js';
import {createBridge,stepBridge,buildCrossings,bridgeTransition} from './engine.js';
import {createBridgeCheckpoints,restoreBridge,BRIDGE_CHECKPOINT_KEY} from './checkpoints.js';
import {createAudioManager,motionSettings} from '../services.js';
import {outsideGameDialog} from '../input-scope.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
import {esc} from '../../../ui/dom.js';
import {successCue} from '../../../ui/encouragement.js';
import {reportStudyExposure} from '../../../study-exposure.js';
export const bridgeRegistration={id:'bridge',title:'Bridge Builder · Ayah Link',create:mountBridge};
const phrase=ws=>ws.map(w=>w.text).join(' ');
export function mountBridge({root,adapter,config,library,id,difficulty='beginner',muted=()=>false,volume=()=>1,initialAudio='listen',storage=profileStorage,onComplete=()=>{},onExit=()=>{},onRecall=()=>{},onSetup=()=>{}}){
 config=annotateDifficulty(config,difficulty);difficulty=memoryLevel(config,difficulty);
 const owner=activeProfileId(),checkpoints=createBridgeCheckpoints(storage),old=checkpoints.read(config,difficulty);
 let state,warning=checkpoints.warning,blocked=!!warning;
 const compatible=old?.config&&Array.isArray(old.config.keys)&&old.config.keys.join('|')===config.keys.join('|')&&old.config.chainMode===config.chainMode&&old.difficulty===difficulty&&Number.isInteger(old.config.seed);
 const sourceConfig=compatible?old.config:config,sectors=buildCrossings(adapter,sourceConfig,library,{difficulty});
 if(old&&!compatible){blocked=true;warning='Saved bridge configuration needs recovery. Original data has not been overwritten.';}
 state=createBridge({id,config:sourceConfig,sectors,difficulty});
 if(old&&!blocked)try{state=restoreBridge(old,sectors);}catch(e){blocked=true;warning=e.message;}
 // Reference views support any unfinished recall; they never submit a grade.
 const first=bridgeTransition(state);reportStudyExposure([first.from,first.to,...first.choices.map(c=>c.key)],storage);
 let tutorial=null,disposed=false,frame=0,last=0,audioMode=difficulty==='expert'?'silent':initialAudio,saved=false,saveError='',audioToken=0,pendingAudio=false,signature='',drag=null,lastDrag=-Infinity;
 const audio=createAudioManager({owner:'bridge',initialVolume:volume()}),scope=new AbortController(),motion=motionSettings();
 root.innerHTML=`<section class="bridge-builder ${motion.reducedMotion?'bridge-reduced':''}" aria-label="Bridge Builder"><header class="bridge-heading"><span aria-hidden="true">✧</span><div><span class="eyebrow">AYAH LINK · TWO SHORES, ONE CONNECTION</span><h3>Bridge Builder</h3><p>Remember how one ayah leads into the next.</p></div></header><div class="bridge-stage" tabindex="0" role="region" aria-label="Ayah bridge. Left and right choose a connector. Space or Enter connects. P pauses."><div class="bridge-toolbar"><label>Recitation<select data-bridge-audio><option value="listen">Guided Listen · loop full ayah</option><option value="echo">Listen Before Challenge</option><option value="silent">Silent Challenge</option></select></label><button data-bridge-action="listen">♫ Replay full ayah</button><button data-bridge-action="pause">Pause / resume</button><button data-bridge-action="demo">How to play</button></div><ol class="bridge-chain-map" dir="rtl" aria-label="Ayah island chain"></ol><p class="bridge-hud"></p><div class="bridge-landscape"><div class="bridge-island bridge-origin"><small data-bridge-from></small><div class="arabic" dir="rtl" lang="ar" data-bridge-ending></div><span>End of this ayah</span></div><div class="bridge-gap" aria-label="Bridge gap"><div class="bridge-deck"></div><span class="bridge-lantern" aria-hidden="true">✦</span></div><div class="bridge-island bridge-destination"><small data-bridge-to></small><div class="arabic" dir="rtl" lang="ar" data-bridge-opening>؟</div><span>What comes next?</span></div></div><div class="bridge-yard" aria-label="Next ayah opening connectors"></div><p class="bridge-status" role="status" aria-live="polite"></p><div class="bridge-overlay"><div data-bridge-panel tabindex="-1"></div></div></div><details><summary>Study the complete ayah pair</summary><div data-bridge-full dir="rtl" lang="ar" class="arabic"></div><p>Exact source text and canonical ayah boundaries are retained. These visual excerpts do not certify recitation stops. Recite both full ayahs together; arcade recognition is separate from independent self-assessed recall.</p></details></section>`;
 const view=root.querySelector('.bridge-builder'),stage=root.querySelector('.bridge-stage'),panel=root.querySelector('[data-bridge-panel]'),yard=root.querySelector('.bridge-yard'),overlay=root.querySelector('.bridge-overlay'),select=root.querySelector('[data-bridge-audio]');select.value=audioMode;
 const transition=()=>bridgeTransition(state);
 function persist(){if(blocked||activeProfileId()!==owner)return;try{checkpoints.save(state);warning='';}catch(e){warning=e.message;}}
 function save(){if(saved)return true;try{onComplete({...state.session,config:annotateDifficulty(state.session.config,difficulty),bridgeVersion:2,transitions:state.sectors.map(t=>({id:t.id,from:t.from,to:t.to})),transitionErrors:state.transitionErrors,arcadeStats:{score:state.score}});saved=true;saveError='';}catch(e){saveError=e.message;}return saved;}
 function paint(){
  if(disposed)return;const s=state.session,t=transition(),choose=s.status==='playing'&&['choose','gate-choose'].includes(state.phase)&&!blocked;
  view.dataset.state=s.status;stage.dataset.phase=state.phase;stage.dataset.transition=t.id;stage.dataset.progress=state.crossing;
  stage.style.setProperty('--crossing',state.crossing);if(config.difficultySchema===1)stage.style.setProperty('--connector-duration',config.motorDifficulty==='arcade'?'2.5s':'6s');stage.classList.toggle('bridge-moving',motorLevel(config,difficulty)!=='beginner'&&!motion.reducedMotion&&choose);
  root.querySelector('.bridge-hud').innerHTML=`<span class="bridge-strikes" aria-hidden="true">${[0,1,2].map(i=>`<i class="${i<3-s.strikes?'charged':'spent'}">✦</i>`).join('')}</span> ${state.gate?'Bridge Gate · '+(state.gate.cursor+1)+'/2 · ':''}Boundary ${Math.min(s.checkpoint+1,state.sectors.length)}/${state.sectors.length} · ${3-s.strikes}/3 memory charges · ${state.bridges.length} bridges linked`;
  const map=root.querySelector('.bridge-chain-map'),mapKey=s.completed.join('|')+':'+t.from;if(map.dataset.signature!==mapKey){map.dataset.signature=mapKey;map.innerHTML=sourceConfig.keys.map((key,i)=>`<li class="${i<s.completed.length?'linked':''}" ${key===t.from?'aria-current="step"':''}><span aria-hidden="true">◆</span><span>${key}</span></li>`).join('');}
  root.querySelector('[data-bridge-from]').textContent=t.from;root.querySelector('[data-bridge-to]').textContent=t.to;
  root.querySelector('[data-bridge-ending]').textContent=phrase(t.ending);root.querySelector('[data-bridge-opening]').textContent=['crossing','gate-crossing'].includes(state.phase)||!state.gate&&state.bridges.includes(t.id)?phrase(t.opening):'؟';
  const sig=JSON.stringify([t.id,state.phase,s.status,state.selection,blocked]);
  if(sig!==signature){signature=sig;yard.innerHTML=['recall','gate-recall'].includes(state.phase)?`<div class="bridge-recall"><strong>${state.gate?"Bridge Gate · recall two consecutive connections":"Cold Crossing"}</strong><p>Say the next opening aloud before revealing choices.</p><p>This attempt is not automatically verified.</p><button class="primary" data-bridge-action="ready">I have recalled it · show connectors</button></div>`:t.choices.map((c,i)=>`<button class="bridge-connector ${i===state.selection?'bridge-selected':''}" data-bridge-choice="${i}" ${choose?'':'disabled'}><b>Connector ${i+1}</b><span class="arabic" dir="rtl" lang="ar">${esc(phrase(c.words))}</span></button>`).join('');}
  const status=root.querySelector('.bridge-status');if(status.textContent!==(warning||state.message))status.textContent=warning||state.message;
  // Preserve a stable reading view while the traveler animates.
  const full=root.querySelector('[data-bridge-full]');if(full.dataset.pair!==t.id){full.dataset.pair=t.id;full.innerHTML=`<p>${esc(phrase(t.previous))} ﴿${esc(t.from)}﴾</p><p>${esc(phrase(t.next))} ﴿${esc(t.to)}﴾</p>`;}
  overlay.hidden=s.status==='playing'&&state.phase!=='checkpoint'&&!blocked;
  if(blocked)panel.innerHTML=`<h4>Saved crossing needs recovery</h4><p>${esc(warning)}</p><button data-bridge-action="export">Export saved checkpoint</button><button data-bridge-action="exit">Return to study</button>`;
  else if(s.status==='ready')panel.innerHTML=`<h4>Link two ayahs</h4><p>The right island shows the end of ${esc(t.from)}. Recall how ${esc(t.to)} begins, then select its connector. The lantern crosses right to left.</p><button class="primary" data-bridge-action="start">Start linking</button><button data-bridge-action="demo">Show me how</button>`;
  else if(s.status==='paused')panel.innerHTML='<h4>Bridge paused</h4><p>No timer. Listen and take the time you need.</p><button class="primary" data-bridge-action="resume">Resume linking</button>';
  else if(s.status==='lost')panel.innerHTML='<div class="bridge-result-art" aria-hidden="true">☾ ⋯ ✦</div><h4>Let’s reconnect</h4><p>Only incorrect Arabic selections used memory charges. Practice retains completed boundaries; Classic restarts this route.</p><button class="primary" data-bridge-action="retry">Retry boundary</button><button data-bridge-action="exit">Return to study</button>';
  else if(s.status==='won')panel.innerHTML=`<div class="bridge-result-art bridge-result-victory" aria-hidden="true">✦ ━ ◆ ━ ✦</div><h4>Every bridge connected! ✦</h4><p class="bridge-save">${saved?'Result saved.':`Not saved: ${esc(saveError)}`}</p><p>Now try reciting without choices. Recognition is not independent recall.</p>${!saved?'<button data-bridge-action="save">Retry saving</button>':''}<button class="primary" data-bridge-action="replay">Link again</button><button data-bridge-action="recall">Try independent recall</button><button data-bridge-action="exit">Return to study</button>`;
  else if(state.phase==='checkpoint')panel.innerHTML='<h4>A new connection ✦</h4><p>Say both ayahs together. Your completed bridge is saved.</p><button class="primary" data-bridge-action="next">Next ayah boundary</button>';
 }
 function stopAudio(){audioToken++;audio.stop();}
 async function listen(before=false,next=false){if(disposed)return;if((before||audioMode==='echo')&&state.session.status==='playing')state=stepBridge(state,{type:'pause'});stopAudio();const token=audioToken;paint();const fail=()=>{if(!disposed&&token===audioToken){state.message='Audio unavailable. Replay when ready; no memory strike.';paint();}};const ok=await audio.play(next?transition().nextAudio:transition().audio,{loop:!before&&audioMode==='listen',muted:muted(),onError:fail});if(disposed||token!==audioToken)return;if(ok&&!muted()){state=stepBridge(state,{type:'assist',kind:'audio'});pendingAudio=false;persist();}if(!ok)fail();}
 function demo(){if(state.session.status==='playing')send({type:'pause'});stopAudio();tutorial?.dispose();tutorial=mountBridgeTutorial({adapter,library,storage,volume,muted,onClose:()=>{tutorial=null;paint();onSetup();}});}

 function send(action){
  if(disposed||activeProfileId()!==owner)return;
  if(action.type==='demo'){demo();return;}
  if(action.type==='export'){const raw=storage.getItem(BRIDGE_CHECKPOINT_KEY),url=URL.createObjectURL(new Blob([raw||'null'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ayah-bridge-recovery.json';a.click();URL.revokeObjectURL(url);return;}
  if(action.type==='exit'){stopAudio();onExit(transition().from);return;}
  if(blocked)return;
  if(action.type==='listen'){listen(true);return;}
  if(action.type==='save'){if(state.session.status==='won')save();paint();return;}
  if(action.type==='recall'){if(state.session.status==='won'&&save()){stopAudio();onRecall(transition().to);}paint();return;}
  if(action.type==='replay'){if(state.session.status!=='won'||!save())return;state=createBridge({id:crypto.randomUUID(),config:sourceConfig,sectors,difficulty});saved=false;action={type:'start'};}
  if(action.type==='pause')action={type:state.session.status==='paused'?'resume':'pause'};
  const before=state;state=stepBridge(state,action);
  if(action.type!=='tick')last=0;
  if(pendingAudio&&state.session.status==='playing'){state=stepBridge(state,{type:'assist',kind:'audio'});pendingAudio=false;}
  if(action.type==='pause')audio.pause();if(action.type==='resume'&&audioMode!=='listen')stopAudio();
  if(state.phase==='gate-recall'&&before.phase!=='gate-recall')stopAudio();
  if(['next','retry'].includes(action.type)||state.phase==='checkpoint'||['lost','won'].includes(state.session.status))stopAudio();
  if(!['crossing','gate-crossing'].includes(before.phase)&&['crossing','gate-crossing'].includes(state.phase)){successCue(`${state.session.id}:${transition().id}`,'Ayahs connected!');if(audioMode==='listen')listen(false,true);}
  if(state.session.status==='won'&&before.session.status!=='won')save();
  if(action.type!=='tick'||before.phase!==state.phase)persist();
  paint();
  if((before.session.status!==state.session.status||before.phase!==state.phase)&&!overlay.hidden)panel.focus({preventScroll:true});
  if(['start','next','retry'].includes(action.type)){reportStudyExposure([transition().from,transition().to]);if(audioMode!=='silent')listen();}
  if(action.type==='resume'&&audioMode==='listen')listen(false,['crossing','gate-crossing'].includes(state.phase));
  if(action.type==='next'){stage.classList.remove('bridge-next-arrival');void stage.offsetWidth;stage.classList.add('bridge-next-arrival');}
  if(['start','resume','next','retry'].includes(action.type)){stage.scrollIntoView({block:'start'});stage.focus({preventScroll:true});}
 }
 const click=e=>{if(e.detail&&performance.now()-lastDrag<180)return;const c=e.target.closest('[data-bridge-choice]'),b=e.target.closest('[data-bridge-action]');if(c&&!c.disabled)send({type:'select',index:Number(c.dataset.bridgeChoice)});else if(b)send({type:b.dataset.bridgeAction});};
 const down=e=>{const c=e.target.closest('[data-bridge-choice]');if(motorLevel(config,difficulty)==='beginner'||!c||c.disabled||e.button>0)return;drag={id:e.pointerId,index:Number(c.dataset.bridgeChoice),x:e.clientX,y:e.clientY,moved:false};c.setPointerCapture?.(e.pointerId);};
 const move=e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>12){drag.moved=true;e.preventDefault();stage.classList.add('bridge-dragging');}};
 const up=e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;stage.classList.remove('bridge-dragging');if(d.moved){lastDrag=performance.now();const gap=root.querySelector('.bridge-gap').getBoundingClientRect();send(e.clientX>=gap.left&&e.clientX<=gap.right&&e.clientY>=gap.top&&e.clientY<=gap.bottom?{type:'select',index:d.index}:{type:'motor-error'});}};
 const cancel=()=>{if(drag?.moved)send({type:'motor-error'});drag=null;stage.classList.remove('bridge-dragging');};
 root.addEventListener('click',click,{signal:scope.signal});root.addEventListener('pointerdown',down,{signal:scope.signal});root.addEventListener('pointermove',move,{signal:scope.signal});root.addEventListener('pointerup',up,{signal:scope.signal});root.addEventListener('pointercancel',cancel,{signal:scope.signal});
 document.addEventListener('keydown',e=>{if(root.closest('[inert]')||outsideGameDialog(root,e)||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea,button,a,[contenteditable=true]'))return;let a;if(e.code==='KeyP')a={type:'pause'};else if(e.code==='ArrowLeft'||e.code==='ArrowRight')a={type:'steer',direction:e.code==='ArrowLeft'?-1:1};else if(e.code==='Space'||e.code==='Enter')a={type:'select'};else if(/^Digit[123]$/.test(e.code))a={type:'select',index:Number(e.code.slice(-1))-1};if(a){e.preventDefault();send(a);}},{signal:scope.signal});
 const blur=()=>{cancel();if(state.session.status==='playing')send({type:'pause'});};window.addEventListener('blur',blur,{signal:scope.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();},{signal:scope.signal});window.addEventListener('ayahprofilechange',()=>dispose(),{signal:scope.signal});
 select.onchange=()=>{audioMode=select.value;stopAudio();if(audioMode!=='silent'&&state.session.status==='playing')listen();};
 root.querySelector('details').addEventListener('toggle',e=>{if(e.target.open)send({type:'assist',kind:'reference'});},{signal:scope.signal});
 function tick(t){if(disposed)return;if(last&&state.session.status==='playing'&&['crossing','gate-crossing'].includes(state.phase))send({type:'tick',dt:Math.min(.1,(t-last)/1000)});last=t;frame=requestAnimationFrame(tick);}
 function dispose(){if(disposed)return;tutorial?.dispose();persist();disposed=true;scope.abort();cancelAnimationFrame(frame);stopAudio();audio.dispose();state=stepBridge(state,{type:'dispose'});root.replaceChildren();}
 // Restore into a safe paused state. Learners explicitly resume before media starts.
 if(old&&!blocked&&state.session.status==='playing')state=stepBridge(state,{type:'pause'});
 if(state.session.status==='won'&&!blocked)save();paint();frame=requestAnimationFrame(tick);
 return {start:()=>send({type:'start'}),pause:()=>{if(state.session.status==='playing')send({type:'pause'});stopAudio();},resume:()=>send({type:'resume'}),dispatch:send,getSnapshot:()=>structuredClone(state),listen:()=>listen(true),mute:()=>audio.mute(muted()),setVolume:v=>audio.setVolume(v),dispose};
}
