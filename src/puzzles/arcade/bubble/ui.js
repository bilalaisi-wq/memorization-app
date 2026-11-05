import {reportStudyExposure} from "../../../study-exposure.js";
import {createBubble,stepBubble,buildFormations,WORLD} from './engine.js';
import {createAudioManager,motionSettings} from '../services.js';
import {esc} from '../../../ui/dom.js';
import {successCue} from '../../../ui/encouragement.js';
export const bubbleRegistration={id:'bubble',title:'Ayah Bubble Burst',create:mountBubble};
const text=p=>p.words.map(w=>w.text).join(' ');
export function mountBubble({root,adapter,config,library,id,difficulty='beginner',reviews={},muted=()=>false,volume=()=>1,onComplete=()=>{},onExit=()=>{},onRecall=()=>{},initialAudio='listen'}) {
 reportStudyExposure([config.keys[0]]);
 let state=createBubble({id,config,difficulty,sectors:buildFormations(adapter,config,library,{difficulty,reviews})}),disposed=false,frame=0,last=0,saved=false,saveError='',audioMode=initialAudio,pendingAudio=false,mediaToken=0,paintedEffect=0,formationSignature='';
 const audio=createAudioManager({owner:'bubble',initialVolume:volume()}),motion=motionSettings();
 root.innerHTML=`<section class="ayah-bubble ${motion.reducedMotion?'bubble-reduced':''}" aria-label="Ayah Bubble Burst"><div class="bubble-heading"><span aria-hidden="true">◌</span><div><span class="eyebrow">CONNECT YOUR CONSTELLATION</span><h3>Ayah Bubble Burst</h3><p>Aim, connect, repeat aloud.</p></div></div><div class="bubble-toolbar"><label>Recitation<select data-bubble-audio><option value="listen">Continuous ayah recitation</option><option value="echo">Listen before launching</option><option value="silent">Pause recitation · this ayah</option></select></label><button data-bubble-action="listen">♫ Replay full ayah</button><button data-bubble-action="pause">Pause / resume</button></div><div class="bubble-hud" aria-live="polite"></div><div class="bubble-sequence" dir="rtl" lang="ar" aria-label="Assembled ayah"></div><div class="bubble-arena" tabindex="0" role="region" aria-label="Bubble launcher. Left and right arrows aim. Space or Enter launches. P pauses. Drag to aim and release to launch."><svg class="bubble-guide" viewBox="0 0 900 820" aria-hidden="true"><path></path></svg><div class="bubble-targets"></div><div class="bubble-shot" hidden></div><div class="bubble-launcher" aria-hidden="true">✧</div><div class="bubble-effects" aria-hidden="true"></div><div class="bubble-overlay"><div data-bubble-panel tabindex="-1"></div></div></div><div class="bubble-controls"><button data-bubble-action="left" aria-label="Aim left">↶</button><button class="primary" data-bubble-action="launch">Launch connector</button><button data-bubble-action="right" aria-label="Aim right">↷</button><label>Aim angle<input data-bubble-angle type="range" min="-173" max="-7" step="1" value="-90"></label></div><p class="bubble-status" role="status" aria-live="polite"></p><details><summary>Listen to a phrase · help &amp; tips</summary><p>Drag anywhere in the formation to aim; release to shoot. Shots bounce from side walls. Read the words, not their colors. Each cluster repeats one target; connecting it adds that phrase once. Hit the next continuation to lift its connected cluster. Empty-space shots are motor errors, never memory strikes. Three wrong continuations end a Classic run; Practice restores three charges at each ayah. Say each piece aloud. Game recognition is not independently assessed recitation. Phrase previews do not certify recitation stops.</p></details><p>Phrase audio · study assistance</p><div class="bubble-listen-choices"></div></section>`;
 const view=root.querySelector('.ayah-bubble'),arena=root.querySelector('.bubble-arena'),targets=root.querySelector('.bubble-targets'),panel=root.querySelector('[data-bubble-panel]'),overlay=root.querySelector('.bubble-overlay'),status=root.querySelector('.bubble-status'),slider=root.querySelector('[data-bubble-angle]');
 view.dataset.difficulty=difficulty;
 const sector=()=>state.sectors[state.session.checkpoint];
 const place=b=>`left:${b.x/9}%;top:${b.y/8.2}%;width:${b.radius*2/9}%;height:${b.radius*2/8.2}%`;
 function paint(){
  if(disposed)return;const s=state.session;
  view.dataset.state=s.status;arena.dataset.cursor=state.cursor;arena.dataset.angle=state.angle;arena.dataset.bounces=state.bounces;
  root.querySelector('.bubble-hud').textContent=`Formation ${s.checkpoint+1}/${config.keys.length} · ${sector().key} · ${3-s.strikes}/3 memory charges · ${s.motorErrors.length} motor shots · ${state.score} arcade points`;
  const sequence=root.querySelector('.bubble-sequence'),sequenceKey=`${sector().key}:${state.captured.length}`;
  if(sequence.dataset.sequence!==sequenceKey){sequence.dataset.sequence=sequenceKey;sequence.innerHTML=state.captured.length?`${state.captured.length>12?'<small class="bubble-empty">Latest 12 connected words · full sequence retained</small>':''}${state.captured.slice(-12).map(w=>`<span>${esc(w.text)}</span>`).join(' ')}`:'<span class="bubble-empty">Connected words appear here</span>';}

  const signature=state.bubbles.map(b=>b.id).join('|');
  if(signature!==formationSignature){formationSignature=signature;targets.innerHTML=state.bubbles.map(b=>`<div class="word-bubble" style="${place(b)}" data-bubble-id="${b.id}"><span class="arabic" dir="rtl" lang="ar">${esc(text(b.piece))}</span></div>`).join('');
  }
  const shot=root.querySelector('.bubble-shot');shot.hidden=!state.projectile;if(state.projectile){shot.style.left=`${state.projectile.x/9}%`;shot.style.top=`${state.projectile.y/8.2}%`;}
  // Dotted geometric preview includes wall reflections, never a correctness cue.
  let x=450,y=760,dx=Math.cos(state.angle),dy=Math.sin(state.angle),path=`M ${x} ${y}`;
  for(let n=0;n<3;n++){const top=(25-y)/dy,wall=dx<0?(13-x)/dx:(887-x)/dx,t=Math.min(top,wall);x+=dx*t;y+=dy*t;path+=` L ${x} ${y}`;if(top<=wall)break;dx=-dx;}
  root.querySelector('.bubble-guide path').setAttribute('d',path);slider.value=String(Math.round(state.angle*180/Math.PI));
  const choices=[...new Map(state.bubbles.map(b=>[b.piece.id,b.piece])).values()];
  const choicesRoot=root.querySelector('.bubble-listen-choices');
  if(choicesRoot.dataset.signature!==signature){choicesRoot.dataset.signature=signature;choicesRoot.innerHTML=choices.map((p,i)=>`<button data-bubble-phrase="${i}"><span class="arabic" dir="rtl" lang="ar">${esc(text(p))}</span> ♫</button>`).join('');
  }
  if(state.effect!==paintedEffect){paintedEffect=state.effect;const effects=root.querySelector('.bubble-effects');effects.innerHTML=state.lastClear.map(b=>`<span class="bubble-release" style="${place(b)}">✦</span>`).join('');}
  status.textContent=state.message;overlay.hidden=s.status==='playing'&&!state.awaitingNext;
  if(s.status==='ready')panel.innerHTML='<h4>Make a connection</h4><p>Read each target. Aim with arrows or drag, then launch. Side walls reflect your connector.</p><button class="primary" data-bubble-action="start">Start bubbles</button>';
  else if(state.awaitingNext)panel.innerHTML='<h4>Ayah connected!</h4><button class="primary" data-bubble-action="next">Next formation →</button>';
  else if(s.status==='paused')panel.innerHTML='<h4>Take your time</h4><button class="primary" data-bubble-action="resume">Resume bubbles</button>';
  else if(s.status==='lost')panel.innerHTML='<h4>A fresh connection awaits</h4><p>Three memory charges used. Your learning progress is safe.</p><button class="primary" data-bubble-action="retry">Retry checkpoint</button><button data-bubble-action="exit">Return to study</button>';
  else if(s.status==='won')panel.innerHTML=`<h4>Beautiful connections! ✦</h4><p class="bubble-save" role="status">${saved?'Result saved.':`Not saved yet: ${esc(saveError)}`}</p><p>Repeat this ayah, then try independent recall or choose the next ayah in the journey settings.</p>${!saved?'<button data-bubble-action="save">Retry saving</button>':''}<button class="primary" data-bubble-action="replay">Play again</button><button data-bubble-action="recall">Try independent recall</button><button data-bubble-action="exit">Choose another ayah / study</button>`;
 }
 function save(){if(saved)return true;try{onComplete({...state.session,arcadeStats:{score:state.score,shots:state.shots,bounces:state.bounces}});saved=true;saveError='';}catch(e){saveError=e.message;}return saved;}
 let audioWait=null;
 function stopAudio(){mediaToken++;audioWait?.();audioWait=null;audio.stop();}
 async function listen(piece){
  if(!piece&&audioMode==='echo'&&state.session.status==='playing'){state=stepBubble(state,{type:'pause'});paint();}
  stopAudio();const token=mediaToken,urls=piece?piece.words.map(w=>w.audio):[sector().audio];
  for(const url of urls){
   if(disposed||token!==mediaToken)return;
   await new Promise(resolve=>{
    audioWait=resolve;
    audio.play(url,{muted:muted(),loop:!piece&&audioMode==='listen',onEnded:resolve,onError:resolve}).then(ok=>{
     if(disposed||token!==mediaToken){resolve();return;}
     if(ok&&!muted()){if(state.session.status==='playing')state=stepBubble(state,{type:'assist',kind:'audio'});else pendingAudio=true;}
     if(!ok){state.message='Recitation unavailable. Replay the ayah to retry. No memory strike.';paint();resolve();}
    });
   });
  }
  if(piece&&!disposed&&token===mediaToken&&audioMode==='listen'&&state.session.status==='playing')listen();
 }
 function expose(key){try{reportStudyExposure([key]);return true;}catch(e){state.message=e.message;paint();return false;}}
 function send(action){
  if(disposed)return;
  if(action.type==='listen'){listen();return;}
  if(action.type==='save'){if(state.session.status==='won')save();paint();return;}
  if(action.type==='exit'){stopAudio();onExit(sector().key);return;}
  if(action.type==='recall'){if(state.session.status!=='won')return;if(save()){stopAudio();onRecall(sector().key);}paint();return;}
  if(action.type==='replay'){if(audioMode==='silent'){audioMode='listen';root.querySelector('[data-bubble-audio]').value=audioMode;}if(state.session.status!=='won')return;if(!expose(config.keys[0]))return;if(!save()){paint();return;}stopAudio();state=createBubble({id:crypto.randomUUID(),config,difficulty,sectors:state.sectors});saved=false;paint();send({type:'start'});return;}
  if(action.type==='left'||action.type==='right')action={type:'aim',angle:state.angle+(action.type==='left'?-.07:.07)};
  if(action.type==='pause')action={type:state.session.status==='paused'?'resume':'pause'};
  if(action.type==='next'&&state.awaitingNext&&!expose(sector().key))return;
  if(action.type==='retry'&&state.session.status==='lost'&&!expose(config.chainMode==='classic'?config.keys[0]:sector().key))return;
  const old=state;state=stepBubble(state,action);
  if(pendingAudio&&state.session.status==='playing'){state=stepBubble(state,{type:'assist',kind:'audio'});pendingAudio=false;}
  if(['pause','retry','next','start','resume'].includes(action.type))last=0;
  if(state.session.status==='paused')audio.pause();
  if(state.awaitingNext||['won','lost'].includes(state.session.status))stopAudio();
  if(['next','retry'].includes(action.type)&&audioMode==='silent'){audioMode='listen';root.querySelector('[data-bubble-audio]').value=audioMode;}
  if(['start','next','retry'].includes(action.type)&&audioMode!=='silent')listen();
  if(action.type==='resume')audio.resume();
  if(state.effect!==old.effect)successCue(`${state.session.id}:${state.effect}`,'Connection found!');
  if(state.session.status==='won'&&old.session.status!=='won'){save();successCue(`${state.session.id}:won`,'Your constellation is connected!');}
  paint();
  if(['start','resume','retry','next'].includes(action.type))arena.focus({preventScroll:true});
 }
 const click=e=>{const p=e.target.closest('[data-bubble-phrase]');if(p){const pieces=[...new Map(state.bubbles.map(b=>[b.piece.id,b.piece])).values()];listen(pieces[Number(p.dataset.bubblePhrase)]);return;}const b=e.target.closest('[data-bubble-action]');if(b)send({type:b.dataset.bubbleAction});};
 const key=e=>{if(root.closest('[inert]')||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea,button,a,[contenteditable=true],dialog,.bubble-overlay'))return;const type={ArrowLeft:'left',ArrowRight:'right',Space:'launch',Enter:'launch',KeyP:'pause'}[e.code];if(type){e.preventDefault();if(!e.repeat||['left','right'].includes(type))send({type});}};
 let pointer=null;
 function aim(e){const rect=arena.getBoundingClientRect();send({type:'aim',angle:Math.atan2((e.clientY-rect.top)/rect.height*820-760,(e.clientX-rect.left)/rect.width*900-450)});}
 const down=e=>{if(state.session.status!=='playing'||state.awaitingNext||e.target.closest('.bubble-overlay')||e.button>0)return;pointer=e.pointerId;arena.setPointerCapture?.(pointer);aim(e);e.preventDefault();};
 const move=e=>{if(pointer===e.pointerId)aim(e);};const up=e=>{if(pointer!==e.pointerId)return;aim(e);pointer=null;send({type:'launch'});};const cancel=()=>pointer=null;
 const blur=()=>{pointer=null;if(state.session.status==='playing')send({type:'pause'});};const visibility=()=>{if(document.hidden)blur();};
 root.addEventListener('click',click);document.addEventListener('keydown',key);arena.addEventListener('pointerdown',down);arena.addEventListener('pointermove',move);arena.addEventListener('pointerup',up);arena.addEventListener('pointercancel',cancel);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
 slider.oninput=()=>send({type:'aim',angle:Number(slider.value)*Math.PI/180});const select=root.querySelector('[data-bubble-audio]');select.value=audioMode;select.onchange=()=>{audioMode=select.value;stopAudio();if(audioMode!=='silent'&&state.session.status==='playing')listen();};
 function tick(time){if(disposed)return;if(last&&state.projectile&&state.session.status==='playing')send({type:'tick',dt:(time-last)/1000});last=time;frame=requestAnimationFrame(tick);}paint();frame=requestAnimationFrame(tick);
 return {start:()=>send({type:'start'}),pause:()=>{if(state.session.status==='playing')send({type:'pause'});},resume:()=>send({type:'resume'}),dispatch:send,getSnapshot:()=>structuredClone(state),listen:()=>listen(),mute:()=>audio.mute(muted()),setVolume:v=>audio.setVolume(v),dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);stopAudio();audio.dispose();state=stepBubble(state,{type:'dispose'});root.removeEventListener('click',click);document.removeEventListener('keydown',key);arena.removeEventListener('pointerdown',down);arena.removeEventListener('pointermove',move);arena.removeEventListener('pointerup',up);arena.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
