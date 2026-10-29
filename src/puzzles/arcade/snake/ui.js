import {createSnake,stepSnake,buildSnakeSectors,snakeSpeeds,GRID} from './engine.js';
import {createAudioManager,motionSettings} from '../services.js';
import {esc} from '../../../ui/dom.js';
import {successCue} from '../../../ui/encouragement.js';
export const snakeRegistration={id:'snake',title:'Ayah Snake',create:mountSnake};
const wordsHTML=words=>words.map(w=>`<span>${esc(w.text)}</span>`).join(' ');
export function mountSnake({root,adapter,config,id,speed='slow',muted=()=>false,initialAudio='listen',onComplete=()=>{},onRecall=()=>{},onPractice=()=>{},onJourney=()=>{},onExit=()=>{},getNextSteps=()=>({})}){
  let state=createSnake({id,config,sectors:buildSnakeSectors(adapter,config),speed}),disposed=false,frame=0,last=0,accumulator=0,audioMode=initialAudio,saveState='pending',saveError='',guidance=null,navigating=false,pendingAudio=false;
  const audio=createAudioManager({owner:'snake'}),motion=motionSettings();
  root.innerHTML=`<section class="ayah-snake ${motion.reducedMotion?'snake-reduced':''}" aria-label="Ayah Snake"><div class="snake-heading"><span aria-hidden="true">❧</span><div><span class="eyebrow">GROW YOUR MEMORY TRAIL</span><h3>Ayah Snake</h3><p>Steer, collect, speak — one word at a time.</p></div></div><div class="snake-toolbar"><label>Movement<select data-snake-speed><option value="slow">Slow · room to think</option><option value="steady">Steady</option><option value="brisk">Brisk</option></select></label><label>Recitation<select data-snake-audio><option value="listen">Listen &amp; grow · repeat ayah</option><option value="silent">Silent</option></select></label><button class="text-button" data-snake-action="listen">♫ Replay ayah</button><button class="text-button" data-snake-action="pause">Pause trail</button></div><div class="snake-hud"><span data-snake-sector></span><span data-snake-strikes></span><span data-snake-score></span><span data-snake-motors></span></div><div class="snake-sequence" dir="rtl" lang="ar" aria-label="Assembled ayah"><span class="snake-empty">Collected words appear here</span></div><div class="snake-board" tabindex="0" role="region" aria-label="Snake garden. Arrow keys or WASD steer. P pauses. Collect the next word and avoid your tail and the walls."><div class="snake-board-items"></div><div class="snake-overlay"><div data-snake-panel tabindex="-1"></div></div></div><div class="snake-direction-pad" aria-label="Steer the snake">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([d,label])=>`<button data-snake-direction="${d}" aria-label="Steer ${d}">${label}</button>`).join('')}</div><p class="snake-status" role="status" aria-live="polite"></p><details class="snake-guide"><summary>How to play &amp; memorization tips</summary><p>The snake keeps moving. Use arrows or WASD, the large direction pad, or swipe the garden to turn. Reverse turns are ignored; one turn is queued per step. Choose Slow or pause whenever you need time to read.</p><p>Collect the next word in order. Correct words grow your tail and give arcade points. Incorrect words cost one memory strike. A wall or tail bump pauses the trail, records only a motor event and offers a safe route with your collected words, tail length and strikes intact. Collisions never cost learning XP or a memory strike.</p><p>Speak each collected word aloud and repeat with the verified reciter. Enter the glowing portal to continue a chain. Arcade points and recognition success are separate from XP caps, independent recall and memorization mastery.</p></details></section>`;
  const view=root.querySelector('.ayah-snake'),board=root.querySelector('.snake-board'),items=root.querySelector('.snake-board-items'),overlay=root.querySelector('.snake-overlay'),panel=root.querySelector('[data-snake-panel]'),status=root.querySelector('.snake-status');
  const sector=()=>state.sectors[state.session.checkpoint];
  const resetClock=()=>{last=0;accumulator=0;};
  const position=(p,w=1,h=1)=>`left:${p.x/GRID.columns*100}%;top:${p.y/GRID.rows*100}%;width:${w/GRID.columns*100}%;height:${h/GRID.rows*100}%`;
  function paint(){
    if(disposed)return;
    const session=state.session;board.dataset.direction=state.direction;
    root.querySelector('[data-snake-sector]').textContent=`Garden ${session.checkpoint+1}/${config.keys.length} · ${sector().key}`;
    root.querySelector('[data-snake-strikes]').textContent=`${3-session.strikes}/3 memory strikes remaining · ${config.chainMode==='classic'?'whole chain':'per ayah'}`;
    root.querySelector('[data-snake-score]').textContent=`${state.score} arcade points`;
    root.querySelector('[data-snake-motors]').textContent=`${session.motorErrors.length} motor bumps · no memory penalty`;
    root.querySelector('[data-snake-action=pause]').textContent=session.status==='paused'?'Resume trail':'Pause trail';
    root.querySelector('.snake-sequence').innerHTML=state.captured.length?wordsHTML(state.captured):'<span class="snake-empty" dir="ltr">Collected words appear here</span>';
    const rotation={up:0,right:90,down:180,left:270}[state.direction];
    items.innerHTML=state.body.map((p,i)=>`<div data-snake-x="${p.x}" data-snake-y="${p.y}" class="snake-segment ${i===0?'snake-head':''}" style="${position(p)}" ${i===0?'aria-label="Snake head"':'aria-hidden="true"'}>${i===0?`<svg viewBox="0 0 40 40" style="transform:rotate(${rotation}deg)" aria-hidden="true"><path d="M20 1C2 1 2 14 3 28Q20 40 37 28C38 14 38 1 20 1" fill="#e7e9a5"/><circle cx="12" cy="12" r="5" fill="#fff"/><circle cx="28" cy="12" r="5" fill="#fff"/><circle cx="12" cy="10" r="2.5" fill="#244b40"/><circle cx="28" cy="10" r="2.5" fill="#244b40"/></svg>`:''}</div>`).join('')+state.food.map(f=>`<div class="snake-word" style="${position(f,3,2)}" data-snake-food="${f.id}" data-x="${f.x}" data-y="${f.y}" aria-label="Word from ${f.word.key}"><span class="arabic" dir="rtl" lang="ar">${esc(f.word.text)}</span></div>`).join('')+(state.portal?`<div class="snake-portal" style="${position(state.portal)}" data-portal-x="${state.portal.x}" data-portal-y="${state.portal.y}" aria-label="Portal to the next ayah">✧</div>`:'');
    const mode=session.status==='playing'&&state.motorPause?'motor':session.status;
    overlay.hidden=mode==='playing';view.classList.toggle('snake-victory',mode==='won');view.classList.toggle('snake-game-over',mode==='lost');
    const signature=`${mode}:${saveState}:${navigating}`;
    if(panel.dataset.mode!==signature){
      panel.dataset.mode=signature;
      const titles={ready:'A little trail, a growing memory',paused:'Take a mindful pause',motor:'A bump, not a memory mistake',lost:'Time for a fresh trail',won:'Your ayah garden is growing!'};
      const description={ready:'The snake moves continuously. Steer into the next correct Arabic word; your tail grows with each success.',paused:'Your snake and words are safely paused.',motor:'Your word progress, tail growth and memory strikes stay intact. Continue on a safe route.',lost:config.chainMode==='practice'?'Retry this ayah and keep completed gardens.':'Retry the chain from its first ayah. Your saved progress stays safe.',won:'Beautiful work. Choose a next step for your memory.'};
      const actions={ready:'<button class="primary" data-snake-action="start">Start trail</button>',paused:'<button class="primary" data-snake-action="resume">Resume trail</button>',motor:'<button class="primary" data-snake-action="recover">Continue on a safe route</button>',lost:'<button class="primary" data-snake-action="retry">Retry trail</button><button class="text-button" data-snake-action="listen">Listen &amp; review</button>'};
      panel.innerHTML=`<span class="snake-award" aria-hidden="true">${mode==='won'?'✿':mode==='lost'?'❧':'✧'}</span><h4>${titles[mode]||''}</h4><p>${description[mode]||''}</p>${mode==='won'?completion():actions[mode]||''}`;
    }
    if(status.textContent!==state.message)status.textContent=state.message;
  }
  function completion(){
    const next=guidance?.next;
    return `<p class="snake-save" role="${saveState==='failed'?'alert':'status'}">${saveState==='saved'?'✓ Trail saved. Your progress is safe.':saveState==='failed'?`Your trail has not finished saving. ${esc(saveError)}`:'Saving your trail…'}</p>${saveState==='failed'?'<button class="primary" data-snake-action="save">Retry saving result</button>':''}<h5>${esc(guidance?.title||'Keep growing, one small step at a time')}</h5><p>${esc(guidance?.reason||'Alternate word practice with spoken recall.')}</p><div class="snake-next-actions">${next?`<button class="${guidance?.action==='continue'?'primary':'text-button'}" data-snake-action="continue">Continue to ${next.first===next.last?`ayah ${next.first}`:`ayahs ${next.first}–${next.last}`}</button>`:''}<button class="text-button" data-snake-action="replay">Play again · same ${config.keys.length===1?'ayah':'ayahs'}</button><button class="text-button" data-snake-action="customize">Choose different ayahs</button><button class="${guidance?.action==='recall'?'primary':'text-button'}" data-snake-action="recall">Try self-assessed recall</button><button class="${guidance?.action==='practice'?'primary':'text-button'}" data-snake-action="practice">Practise with the reciter</button><button class="text-button" data-snake-action="exit">Return to study / take a break</button></div>${navigating?'<p role="status">Preparing your next trail…</p>':''}`;
  }
  function save(){
    if(saveState==='saved')return true;
    try{onComplete({...state.session,arcadeStats:{score:state.score,steps:state.steps,speed:state.speed}});saveState='saved';saveError='';state.message='Trail saved. Choose your next step.';}
    catch(e){saveState='failed';saveError=e.message;state.message='Retry saving before starting another trail.';}
    paint();return saveState==='saved';
  }
  function listen(){
    const owner=state.session.id,checkpoint=state.session.checkpoint;
    audio.play(sector().audio,{loop:audioMode==='listen',muted:muted(),onError:()=>{if(!disposed){state.message='Audio could not load. Keep playing without a strike.';paint();}}}).then(ok=>{if(disposed||owner!==state.session.id||checkpoint!==state.session.checkpoint)return;if(ok&&!muted()){if(state.session.status==='playing')state=stepSnake(state,{type:'assist',kind:'audio'});else pendingAudio=true;}if(!ok){state.message='Audio could not start. You can play silently without a strike.';paint();}});
  }
  function beginAudio(){audio.stop();if(audioMode==='listen')listen();}
  async function choose(action){
    if(navigating||state.session.status!=='won'||!save())return;
    navigating=true;paint();
    try{
      if(action==='recall')onRecall(guidance?.action==='recall'?guidance.target:sector().key);
      else if(action==='practice')onPractice(guidance?.action==='practice'?guidance.target:sector().key);
      else await onJourney({kind:action,next:guidance?.next,config,audioMode,speed:state.speed});
    }catch(e){if(!disposed)state.message=`Could not start the next trail: ${e.message} Your completed trail is saved.`;}
    finally{if(!disposed){navigating=false;paint();}}
  }
  function send(action){
    if(disposed)return;
    if(['replay','continue','customize','recall','practice'].includes(action.type)){choose(action.type);return;}
    if(action.type==='save'){if(state.session.status==='won')save();return;}
    if(action.type==='exit'){onExit(sector().key);return;}
    if(action.type==='listen'){listen();return;}
    if(action.type==='pause')action={type:state.session.status==='paused'?'resume':'pause'};
    const before=state;state=stepSnake(state,action);
    if(state.session.status==='playing'&&pendingAudio){state=stepSnake(state,{type:'assist',kind:'audio'});pendingAudio=false;}
    if(['start','retry','recover','resume','speed'].includes(action.type))resetClock();
    if(action.type==='pause'||state.motorPause)audio.pause();
    if(['start','retry'].includes(action.type)||before.session.checkpoint!==state.session.checkpoint)beginAudio();
    if(['recover','resume'].includes(action.type)&&audioMode==='listen')listen();
    if(['won','lost'].includes(state.session.status))audio.stop();
    if(before.session.checkpoint!==state.session.checkpoint){view.classList.remove('snake-crossing');void view.offsetWidth;view.classList.add('snake-crossing');resetClock();}
    if(state.session.status==='won'&&before.session.status!=='won'){
      guidance=getNextSteps(state);save();successCue(`${id}:snake`,'Your ayah trail is complete!');panel.focus({preventScroll:true});
    }
    paint();
    if(['start','retry','recover','resume'].includes(action.type))board.focus({preventScroll:true});
  }
  const directionKeys={ArrowUp:'up',KeyW:'up',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left'};
  const keydown=e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea,button,a,[contenteditable=true],.snake-overlay,dialog'))return;
    if(directionKeys[e.code]){e.preventDefault();send({type:'direction',value:directionKeys[e.code]});}
    if(e.code==='KeyP'&&!e.repeat){e.preventDefault();send({type:'pause'});}
  };
  const click=e=>{const direction=e.target.closest('[data-snake-direction]'),button=e.target.closest('[data-snake-action]');if(direction){send({type:'direction',value:direction.dataset.snakeDirection});board.focus({preventScroll:true});}else if(button)send({type:button.dataset.snakeAction});};
  let touch=null;
  const down=e=>{if(board.contains(e.target)&&!e.target.closest('.snake-overlay')){touch={x:e.clientX,y:e.clientY};try{board.setPointerCapture(e.pointerId);}catch{}board.focus({preventScroll:true});}};
  const up=e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;send({type:'direction',value:Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'});};
  const cancel=()=>touch=null;
  const blur=()=>{touch=null;if(state.session.status==='playing')send({type:'pause'});};
  const visibility=()=>{if(document.hidden)blur();};
  const speedSelect=root.querySelector('[data-snake-speed]');speedSelect.value=speed;speedSelect.onchange=()=>send({type:'speed',value:speedSelect.value});
  const audioSelect=root.querySelector('[data-snake-audio]');audioSelect.value=audioMode;audioSelect.onchange=()=>{audioMode=audioSelect.value;audio.stop();if(audioMode==='listen'&&state.session.status==='playing'&&!state.motorPause)listen();};
  root.addEventListener('click',click);board.addEventListener('pointerdown',down);board.addEventListener('pointerup',up);board.addEventListener('pointercancel',cancel);document.addEventListener('keydown',keydown);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  function tick(time){
    if(disposed)return;
    const elapsed=last?time-last:0;last=time;
    if(state.session.status==='playing'&&!state.motorPause){
      if(elapsed>0&&elapsed<=200){accumulator+=elapsed;if(accumulator>=snakeSpeeds[state.speed]){accumulator=0;send({type:'tick'});}}else accumulator=0;
    }
    frame=requestAnimationFrame(tick);
  }
  paint();frame=requestAnimationFrame(tick);
  return {start:()=>send({type:'start'}),pause:()=>{if(state.session.status==='playing')send({type:'pause'});},resume:()=>send({type:'resume'}),dispatch:send,getSnapshot:()=>structuredClone(state),listen:()=>send({type:'listen'}),mute:()=>audio.mute(muted()),dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);audio.dispose();state=stepSnake(state,{type:'dispose'});root.removeEventListener('click',click);board.removeEventListener('pointerdown',down);board.removeEventListener('pointerup',up);board.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',keydown);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
