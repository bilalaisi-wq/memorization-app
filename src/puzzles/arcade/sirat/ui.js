import {outsideGameDialog} from '../input-scope.js';
import {createSirat,stepSirat,buildSiratSections,gatewayIndex,nearGateway,platformAt} from './engine.js';
import {createAudioManager,motionSettings} from '../services.js';
import {esc} from '../../../ui/dom.js';
import {successCue} from '../../../ui/encouragement.js';
import {reportStudyExposure} from '../../../study-exposure.js';
export const siratRegistration={id:'sirat',title:'Sirat Quest',create:mountSirat};
const phrase=p=>p.words.map(w=>w.text).join(' ');
export function mountSirat({root,adapter,config,library,id,difficulty='beginner',reviews={},muted=()=>false,volume=()=>1,initialAudio='listen',onComplete=()=>{},onExit=()=>{},onRecall=()=>{}}){
 reportStudyExposure([config.keys[0]]);
 let state=createSirat({id,config,difficulty,sectors:buildSiratSections(adapter,config,library,{difficulty,reviews})}),disposed=false,frame=0,last=0,signature='',sequenceSignature='',saved=false,saveError='',audioMode=initialAudio,audioToken=0,pendingAudio=false;
 const audio=createAudioManager({owner:'sirat',initialVolume:volume()}),motion=motionSettings(),held=new Set(),scope=new AbortController();
 root.innerHTML=`<section class="sirat-quest ${motion.reducedMotion?'sirat-reduced':''}" aria-label="Sirat Quest">
 <div class="sirat-heading"><span aria-hidden="true">❧</span><div><span class="eyebrow">THE HILLTOP GARDENS</span><h3>Sirat Quest</h3><p>Explore, connect, continue.</p></div></div>
 <div class="sirat-toolbar"><label>Recitation<select data-sirat-audio><option value="listen">Continuous ayah recitation</option><option value="echo">Listen before exploring</option><option value="silent">Pause recitation · this ayah</option></select></label><button data-sirat-action="listen">♫ Listen / replay ayah</button><button data-sirat-action="pause">Pause / resume</button><button data-sirat-action="recover">Return to safe checkpoint</button></div>
 <p class="sirat-hud"></p><div class="sirat-sequence arabic" dir="rtl" lang="ar" aria-label="Connected ayah"></div>
 <div class="sirat-stage" tabindex="0" role="region" aria-label="Garden platform level. Arrows move. Space jumps; at a gateway it enters the arch you stand beside. P pauses. Keys 1 to 3 also choose."><div class="sirat-sky" aria-hidden="true"></div><div class="sirat-world"><div class="sirat-platforms"></div><div class="sirat-architecture" aria-hidden="true"></div><div class="sirat-gate" aria-hidden="true">✦</div><div class="sirat-player" aria-label="Garden explorer"><span class="sirat-ears"></span><span class="sirat-face">• •</span><span class="sirat-scarf"></span></div><span class="sirat-checkpoint" aria-hidden="true">⚑</span></div><div class="sirat-overlay"><div data-sirat-panel tabindex="-1"></div></div></div>
 <div class="sirat-pad" aria-label="Explorer controls"><button data-sirat-move="-1" aria-label="Move left">←</button><button data-sirat-move="1" aria-label="Move right">→</button><button class="primary" data-sirat-action="jump">Jump ↑</button><button class="primary" data-sirat-action="enter">Enter · Space</button></div>
 <section class="sirat-gateways" aria-label="Continuation gateways"><h4>Branching gateways</h4><p data-sirat-gate-tip></p><p data-sirat-gate-feedback role="status"></p><div class="sirat-choices"></div></section><p class="sirat-status" role="status" aria-live="polite"></p>
 <details><summary>Garden guide &amp; memorization tips</summary><p>Hold Left/Right or A/D to move. Press Space, Up or W to jump; at a gateway Space enters the nearest arch. Use the large touch controls on a phone. Ride the ferry platform and jump between terraces. Missed jumps return you to your last safe landing without changing memory charges, connected words or learning XP.</p><p>Reach the courtyard, then choose a verified continuation with its button or keys 1–3. Correct choices open the arch; walk through to continue. Speak each continuation aloud. Continuous recitation accompanies play. Listen-first pauses physics; Resume returns to exploration. Difficulty is not a measure of Quran mastery.</p><p>This ordinary fictional landscape does not depict the eschatological Sirat or spiritual judgment. Phrase signs do not certify recitation stops. Game recognition is separate from independent self-assessed recall.</p></details></section>`;
 const view=root.querySelector('.sirat-quest'),stage=root.querySelector('.sirat-stage'),world=root.querySelector('.sirat-world'),platforms=root.querySelector('.sirat-platforms'),player=root.querySelector('.sirat-player'),gate=root.querySelector('.sirat-gate'),overlay=root.querySelector('.sirat-overlay'),panel=root.querySelector('[data-sirat-panel]'),choices=root.querySelector('.sirat-choices'),status=root.querySelector('.sirat-status');
 const sector=()=>state.sectors[state.session.checkpoint];
 stage.append(root.querySelector('.sirat-toolbar'),root.querySelector('.sirat-gateways'),root.querySelector('.sirat-pad'),root.querySelector('.sirat-hud'));root.querySelector('.sirat-pad').append(root.querySelector('[data-sirat-action=pause]'),root.querySelector('[data-sirat-action=listen]'));

 function paint(){
  if(disposed)return;const s=state.session,base=state.cursor*1800,near=nearGateway(state),unit=`${s.checkpoint}:${state.cursor}`;
  root.querySelector('[data-sirat-action=pause]').textContent=s.status==='paused'?'Resume':'Pause';root.querySelector('[data-sirat-action=listen]').textContent='♫ Replay';
  view.dataset.state=s.status;stage.dataset.x=state.player.x;stage.dataset.y=state.player.y;stage.dataset.camera=state.camera;stage.dataset.cursor=state.cursor;stage.dataset.grounded=String(state.player.grounded);stage.dataset.near=String(near);stage.dataset.selectedGateway=String(gatewayIndex(state));
  root.querySelector('.sirat-hud').textContent=`Garden ${s.checkpoint+1}/${config.keys.length} · ${sector().key} · ${3-s.strikes}/3 memory charges · ${state.recoveries} safe returns · ${state.score} recognition points`;
  const seq=root.querySelector('.sirat-sequence'),key=`${sector().key}:${state.captured.length}`;
  if(key!==sequenceSignature){sequenceSignature=key;seq.innerHTML=state.captured.length?`${state.captured.length>12?'<small>Latest 12 connected words · full sequence retained</small>':''}${state.captured.slice(-12).map(w=>`<span>${esc(w.text)}</span>`).join(' ')}`:'<small>Connected words appear here</small>';}
  if(signature!==unit){signature=unit;platforms.innerHTML=state.platforms.map(p=>`<div class="sirat-platform ${p.moving?'sirat-moving':''} ${p.optional?'sirat-optional':''}" data-platform="${p.id}" style="width:${p.w}px;height:${p.h}px;top:${p.y}px"></div>`).join('');root.querySelector('.sirat-architecture').innerHTML=state.choices.map((_,i)=>`<span class="sirat-arch" style="left:${base+1220+i*100}px;top:290px">${i+1}</span>`).join('');choices.innerHTML=state.choices.map((p,i)=>`<button data-sirat-choice="${i}"><b>Gateway ${i+1}</b><span class="arabic" dir="rtl" lang="ar">${esc(phrase(p))}</span></button>`).join('');}
  for(const p of state.platforms)platforms.querySelector(`[data-platform="${p.id}"]`).style.left=`${platformAt(p,state.time).x}px`;
  world.style.transform=`translateX(${-state.camera}px)`;player.style.left=`${state.player.x}px`;player.style.top=`${state.player.y}px`;player.classList.toggle('sirat-airborne',!state.player.grounded);player.classList.toggle('sirat-walking',!!state.direction&&state.player.grounded);player.dataset.facing=state.direction<0?'left':'right';
  gate.style.left=`${base+1545}px`;gate.classList.toggle('sirat-open',state.resolved);gate.textContent=state.resolved?'❧':'✦';const flag=root.querySelector('.sirat-checkpoint');flag.style.left=`${state.checkpoint.x}px`;flag.style.top=`${state.checkpoint.y-15}px`;
  root.querySelector('[data-sirat-gate-tip]').textContent=state.resolved?'The arch is open. Walk right to continue.':near?`Space enters Gateway ${gatewayIndex(state)+1}. Move beside another arch or tap its card. Say the continuation aloud.`:'Explore right to reach the courtyard. Choices unlock at the gateway.';
  root.querySelector('[data-sirat-action=enter]').disabled=!near||state.resolved||s.status!=='playing';
  root.querySelector('[data-sirat-gate-feedback]').textContent=state.gateFeedback==='incorrect'?state.message:'';
  choices.querySelectorAll('button').forEach((b,i)=>{b.disabled=!near||state.resolved||s.status!=='playing';b.classList.toggle('sirat-selected-gateway',near&&i===gatewayIndex(state));});status.textContent=state.message;
  overlay.hidden=s.status==='playing'&&!state.awaitingNext;
  if(s.status==='ready')panel.innerHTML='<h4>A garden adventure awaits</h4><p>Explore terraces, jump gaps and connect the next continuation at each gateway.</p><button class="primary" data-sirat-action="start">Start exploring</button>';
  else if(state.awaitingNext)panel.innerHTML='<h4>Ayah garden complete!</h4><button class="primary" data-sirat-action="next">Next ayah garden →</button>';
  else if(s.status==='paused')panel.innerHTML='<h4>Take your time</h4><p>Physics is frozen. Listen, read or rest.</p><button class="primary" data-sirat-action="resume">Resume exploration</button>';
  else if(s.status==='lost')panel.innerHTML='<h4>Try a new connection</h4><p>Three continuation mistakes used the game charges. Your learning progress is safe.</p><button class="primary" data-sirat-action="retry">Retry garden</button><button data-sirat-action="exit">Return to study</button>';
  else if(s.status==='won')panel.innerHTML=`<h4>Gardens connected! ❧</h4><p class="sirat-save">${saved?'Result saved.':`Not saved yet: ${esc(saveError)}`}</p><p>Try independent recall, repeat the journey or choose the next ayah in the settings.</p>${!saved?'<button data-sirat-action="save">Retry saving</button>':''}<button class="primary" data-sirat-action="replay">Play again</button><button data-sirat-action="recall">Try independent recall</button><button data-sirat-action="exit">Return to study</button>`;
 }
 function stopAudio(){audioToken++;audio.stop();}
 function save(){if(saved)return true;try{onComplete({...state.session,arcadeStats:{score:state.score,recoveries:state.recoveries}});saved=true;saveError='';}catch(e){saveError=e.message;}return saved;}
 function expose(key){try{reportStudyExposure([key]);return true;}catch(e){state.message=e.message;paint();return false;}}
 async function listen(before=false){
  if(disposed)return;if(before||audioMode==='echo'){held.clear();if(state.session.status==='playing')state=stepSirat(state,{type:'pause'});state.message='Listen first, then Resume when ready.';}stopAudio();const token=audioToken;last=0;paint();
  const failed=()=>{if(!disposed&&token===audioToken){state.message='Recitation unavailable. Tap Replay ayah to retry. Memory charges are unchanged.';paint();}};
  const ok=await audio.play(sector().audio,{loop:!before&&audioMode==='listen',muted:muted(),onError:failed});if(disposed||token!==audioToken)return;if(ok&&!muted()){if(state.session.status==='playing')state=stepSirat(state,{type:'assist',kind:'audio'});else pendingAudio=true;}if(!ok)failed();
 }
 function send(action){
  if(disposed)return;
  if(action.type==='listen'){listen(true);return;}
  if(action.type==='exit'){stopAudio();onExit(sector().key);return;}
  if(action.type==='save'){if(state.session.status==='won')save();paint();return;}
  if(action.type==='recall'){if(state.session.status==='won'&&save()){stopAudio();onRecall(sector().key);}paint();return;}
  if(action.type==='replay'){if(audioMode==='silent'){audioMode='listen';root.querySelector('[data-sirat-audio]').value=audioMode;}if(state.session.status!=='won'||!save()||!expose(config.keys[0])){paint();return;}stopAudio();state=createSirat({id:crypto.randomUUID(),config,sectors:state.sectors,difficulty});saved=false;signature='';send({type:'start'});return;}
  if(action.type==='pause')action={type:state.session.status==='paused'?'resume':'pause'};
  if(action.type==='next'&&state.awaitingNext&&!expose(sector().key))return;
  if(action.type==='retry'&&state.session.status==='lost'&&!expose(config.chainMode==='classic'?config.keys[0]:sector().key))return;
  if(action.type==='enter'){if(!nearGateway(state)||state.resolved)return;action={type:'choose',index:gatewayIndex(state)};}
  const before=state;state=stepSirat(state,action);
  if(['pause','resume','retry','next','start'].includes(action.type)){held.clear();last=0;}
  if(action.type==='pause')audio.pause();
  if(['retry','next'].includes(action.type)||state.awaitingNext||['won','lost'].includes(state.session.status))stopAudio();
  if(pendingAudio&&state.session.status==='playing'){state=stepSirat(state,{type:'assist',kind:'audio'});pendingAudio=false;}
  if(state.resolved&&!before.resolved)successCue(`${state.session.id}:${state.session.checkpoint}:${state.cursor}`,'Gateway connected!');
  if(state.session.status==='won'&&before.session.status!=='won'){save();successCue(`${state.session.id}:won`,'Gardens connected!');}
  paint();
  if(['next','retry'].includes(action.type)&&audioMode==='silent'){audioMode='listen';root.querySelector('[data-sirat-audio]').value=audioMode;}
  if((['start','next','retry'].includes(action.type)&&audioMode!=='silent'||action.type==='resume'&&audioMode==='listen')&&state.session.status==='playing')listen();
  if(action.type==='start')stage.scrollIntoView({block:'start',behavior:'instant'});
  if(['start','resume','retry','next'].includes(action.type))stage.focus({preventScroll:true});
 }
 const direction=()=>send({type:'move',direction:(held.has('right')?1:0)-(held.has('left')?1:0)});
 const keydown=e=>{if(root.closest('[inert]')||outsideGameDialog(root,e)||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea,button,a,[contenteditable=true],.sirat-overlay'))return;const d={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'}[e.code];if(d){e.preventDefault();held.add(d);direction();}else if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)send({type:e.code==='Space'&&nearGateway(state)&&!state.resolved?'enter':'jump'});}else if(e.code==='KeyP'&&!e.repeat){e.preventDefault();send({type:'pause'});}else if(/^Digit[123]$/.test(e.code)&&!e.repeat){e.preventDefault();send({type:'choose',index:Number(e.code.slice(-1))-1});}};
 const keyup=e=>{const d={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'}[e.code];if(d){held.delete(d);direction();}};
 const click=e=>{const c=e.target.closest('[data-sirat-choice]'),b=e.target.closest('[data-sirat-action]');if(c)send({type:'choose',index:Number(c.dataset.siratChoice)});else if(b)send({type:b.dataset.siratAction});};
 let pointer=null;const down=e=>{const b=e.target.closest('[data-sirat-move]');if(!b||e.button>0)return;e.preventDefault();pointer=e.pointerId;held.clear();held.add(b.dataset.siratMove==='-1'?'left':'right');b.setPointerCapture?.(pointer);direction();};const up=e=>{if(pointer!==e.pointerId)return;pointer=null;held.clear();direction();};
 const blur=()=>{held.clear();pointer=null;if(state.session.status==='playing')send({type:'pause'});};
 root.addEventListener('click',click,{signal:scope.signal});root.addEventListener('pointerdown',down,{signal:scope.signal});window.addEventListener('pointerup',up,{signal:scope.signal});window.addEventListener('pointercancel',up,{signal:scope.signal});document.addEventListener('keydown',keydown,{signal:scope.signal});document.addEventListener('keyup',keyup,{signal:scope.signal});window.addEventListener('blur',blur,{signal:scope.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();},{signal:scope.signal});
 const select=root.querySelector('[data-sirat-audio]');select.value=audioMode;select.onchange=()=>{audioMode=select.value;stopAudio();if(audioMode!=='silent'&&state.session.status==='playing')listen();};
 function tick(t){if(disposed)return;if(last&&state.session.status==='playing'&&!state.awaitingNext)send({type:'tick',dt:(t-last)/1000});last=t;frame=requestAnimationFrame(tick);}paint();frame=requestAnimationFrame(tick);
 return {start:()=>send({type:'start'}),pause:()=>{held.clear();if(state.session.status==='playing')send({type:'pause'});stopAudio();},resume:()=>send({type:'resume'}),dispatch:send,getSnapshot:()=>structuredClone(state),listen:()=>listen(true),mute:()=>audio.mute(muted()),setVolume:v=>audio.setVolume(v),dispose(){if(disposed)return;disposed=true;scope.abort();held.clear();cancelAnimationFrame(frame);stopAudio();audio.dispose();state=stepSirat(state,{type:'dispose'});root.replaceChildren();}};
}
