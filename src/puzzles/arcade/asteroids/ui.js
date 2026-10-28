import {createAsteroids,stepAsteroids,aimedObject,WORLD} from './engine.js';
import {buildSectors,asteroidProfiles} from './content.js';
import {createAudioManager,motionSettings} from '../services.js';
import {esc} from '../../../ui/dom.js';
import {successCue} from '../../../ui/encouragement.js';
const shipArt='<svg viewBox="0 0 80 80" aria-hidden="true"><path class="astro-flame" d="M27 52L40 78 53 52" fill="#f7c86c"/><path d="M40 5L68 63 43 52 12 63Z" fill="#d8eaff" stroke="#7ddbd8" stroke-width="3"/><path d="M40 18L49 41 31 41Z" fill="#7067c6"/><circle cx="40" cy="37" r="6" fill="#72e5f7"/></svg>';
const wordsHTML=words=>words.map(w=>`<span>${esc(w.text)}</span>`).join(' ');
export const asteroidsRegistration={id:'asteroids',title:'Ayah Asteroids',create:mountAsteroids};
export function mountAsteroids({root,adapter,config,library,id,difficulty='beginner',reviews={},muted=()=>false,onComplete=()=>{},onExit=()=>{},getNextSteps=()=>({}),onJourney=()=>{},onRecall=()=>{},onPractice=()=>{},initialAudioMode='listen'}) {
  const sectors=buildSectors(adapter,config,library,{difficulty,reviews});
  let state=createAsteroids({id,config,sectors,difficulty}),disposed=false,frame=0,last=0,audioGate=false,audioMode=initialAudioMode,run=0,transition=false,transitionTimer=null;
  let saveState='pending',saveError='',guidance=null,navigating=false;
  const audio=createAudioManager({owner:'asteroids'}),held=new Set(),motion=motionSettings(),nodes=new Map();
  root.innerHTML=`<section class="asteroids ${motion.reducedMotion?'astro-reduced':''}" aria-label="Ayah Asteroids"><div class="astro-heading"><span class="astro-badge" aria-hidden="true">✦</span><div><span class="eyebrow">A VOYAGE THROUGH WORDS</span><h3>Ayah Asteroids</h3><p>Navigate. Aim. Capture in order.</p></div></div><div class="astro-toolbar"><label>Recitation<select data-astro-audio><option value="listen">Listen &amp; Build</option><option value="echo">Echo · listen before each sector</option><option value="silent">Silent</option></select></label><button class="text-button" data-action="listen">♫ Listen to ayah</button><button class="text-button" data-action="assist" aria-pressed="false">Navigation assist</button><button class="text-button" data-action="pause">Pause flight</button></div><div class="astro-hud"><span data-sector></span><span data-strikes></span><span data-range>Glow = in capture range</span></div><div class="astro-sequence" dir="rtl" lang="ar" aria-label="Captured ayah sequence"></div><p class="astro-cue" data-cue></p><div class="astro-stage" tabindex="0" role="region" aria-label="Space flight. Arrow keys or WASD move, Q and R aim, Space captures, E shields, P pauses."><div class="astro-nebula" aria-hidden="true"></div><svg class="astro-effects" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><line data-aim/><line data-beam/><circle data-pulse/></svg><div class="astro-objects"></div><div class="astro-ship" aria-label="Your ship">${shipArt}</div><div class="astro-reticle" aria-hidden="true">＋</div><div class="astro-overlay"><div data-panel></div></div></div><div class="astro-controls" aria-label="Flight controls"><div class="astro-dpad">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([dir,label])=>`<button data-move="${dir}" aria-label="Fly ${dir}">${label}</button>`).join('')}</div><div><button class="primary" data-action="capture">⌁ Tractor beam <small>Space</small></button><button class="text-button" data-action="shield">◉ Shield pulse <small>E</small></button><button class="text-button" data-action="turn-left" aria-label="Aim left">↶ Q</button><button class="text-button" data-action="turn-right" aria-label="Aim right">R ↷</button></div></div><p class="astro-status" role="status" aria-live="polite"></p><details class="astro-guide"><summary>Flight guide &amp; accessibility</summary><p>Arrow keys / WASD move the ship. Q / R rotate your aim. Space activates the tractor beam; E sends a shield pulse; P pauses. Aim inside the dotted range, then capture. On touch, hold direction buttons or drag the ship; tap an asteroid to track your aim. Tapping never captures it.</p><p>Use Navigation assist to approach an aimed object, or use Pause to read. No collisions, missed objects, empty captures or audio failures cost strikes. Required pieces always return. Shielded words are redirected intact, never destroyed. Only capturing a word or phrase out of order costs a strike.</p><p>Repeat the captured words aloud. Arcade success is recognition practice, not independent recitation or memorization mastery.</p></details></section>`;
  const view=root.querySelector('.asteroids'),stage=root.querySelector('.astro-stage'),objects=root.querySelector('.astro-objects'),ship=root.querySelector('.astro-ship'),overlay=root.querySelector('.astro-overlay'),panel=root.querySelector('[data-panel]'),status=root.querySelector('.astro-status'),cue=root.querySelector('[data-cue]'),sequence=root.querySelector('.astro-sequence');
  panel.tabIndex=-1;
  const say=text=>{status.textContent=text;};
  const sector=()=>sectors[state.session.checkpoint];
  function paint() {
    if(disposed)return;
    const session=state.session,target=aimedObject(state);
    root.querySelector('[data-sector]').textContent=`Sector ${session.checkpoint+1} / ${sectors.length} · ${sector().key}`;
    root.querySelector('[data-strikes]').textContent=`${3-session.strikes} / 3 strikes remaining · ${config.chainMode==='classic'?'whole run':'per ayah'}`;
    root.querySelector('[data-action=assist]').setAttribute('aria-pressed',String(state.assistedNavigation));
    root.querySelector('[data-action=pause]').textContent=session.status==='paused'?'Resume flight':'Pause flight';
    const sequenceHTML=state.captured.length?wordsHTML(state.captured):'<span class="astro-empty">Captured words appear here · right to left</span>';
    if(sequence.innerHTML!==sequenceHTML)sequence.innerHTML=sequenceHTML;
    cue.innerHTML=asteroidProfiles[difficulty].cue && !state.sectorReady && session.status!=='won'?`Next signal: <span class="arabic" dir="rtl" lang="ar">${wordsHTML(sector().targets[state.cursor]?.words||[])}</span>`:'All wording stays visible. Read, listen and capture in order.';
    const bounds=stage.getBoundingClientRect(),visualAngle=Math.atan2(Math.sin(state.ship.angle)*bounds.height/600,Math.cos(state.ship.angle)*bounds.width/1000);
    ship.style.left=`${state.ship.x/10}%`;ship.style.top=`${state.ship.y/6}%`;ship.style.transform=`translate(-50%,-50%) rotate(${visualAngle+Math.PI/2}rad)`;
    for(const object of state.objects){
      let node=nodes.get(object.id);
      if(!node){node=document.createElement('button');node.className=`astro-rock ${object.piece.words.length>1?'astro-phrase':''}`;node.dataset.object=object.id;node.innerHTML=`<span class="arabic" dir="rtl" lang="ar">${wordsHTML(object.piece.words)}</span>`;node.title='Aim at this object; move within range, then use the tractor beam';objects.append(node);nodes.set(object.id,node);}
      node.style.left=`${object.x/10}%`;node.style.top=`${object.y/6}%`;node.classList.toggle('astro-locked',target?.id===object.id);node.classList.toggle('astro-redirected',object.redirected);node.disabled=object.redirected;node.setAttribute('aria-label',`Aim at ${object.piece.words.map(w=>w.text).join(' ')} · source ${object.piece.key}`);
    }
    for(const [key,node] of nodes)if(!state.objects.some(o=>o.id===key)){node.remove();nodes.delete(key);}
    const ex=state.ship.x+Math.cos(state.ship.angle)*WORLD.range,ey=state.ship.y+Math.sin(state.ship.angle)*WORLD.range;
    for(const attr of ['data-aim','data-beam']){const line=root.querySelector(`[${attr}]`);line.setAttribute('x1',state.ship.x);line.setAttribute('y1',state.ship.y);line.setAttribute('x2',target?.x??ex);line.setAttribute('y2',target?.y??ey);}
    root.querySelector('[data-beam]').style.opacity=state.beam>0?'1':'0';
    const pulse=root.querySelector('[data-pulse]');pulse.setAttribute('cx',state.ship.x);pulse.setAttribute('cy',state.ship.y);pulse.setAttribute('r',state.pulse>0?(motion.reducedMotion?220:(1-state.pulse/.65)*330):0);pulse.style.opacity=state.pulse>0?'.6':'0';
    const reticle=root.querySelector('.astro-reticle');reticle.style.left=`${(target?.x??ex)/10}%`;reticle.style.top=`${(target?.y??ey)/6}%`;
    view.classList.toggle('astro-victory',session.status==='won');view.classList.toggle('astro-lost',session.status==='lost');
    const mode=audioGate?'echo':state.sectorReady?'sector':session.status;
    overlay.hidden=mode==='playing';
    const panelMode=mode==='won'?`${mode}:${saveState}:${navigating}`:mode;
    if(panel.dataset.mode!==panelMode){
      panel.dataset.mode=panelMode;
      const title={ready:'Your word voyage awaits',paused:'Take a breath',lost:'Time for a fresh flight',won:'A constellation completed!',sector:'Sector complete!',echo:'Listen, then echo aloud'}[mode]||'';
      const description={ready:'Move your ship toward incoming words. Aim and capture the next piece. Distractors can be redirected with your shield.',paused:'Words and your ship are safely paused.',lost:config.chainMode==='practice'?'Keep your completed sectors. Retry this ayah.':'Three sequence mistakes. Retry the chain from its first sector.',won:'Beautiful work. Choose a short next step for your memory journey.',sector:'Your ayah is assembled. Continue to the next space sector.',echo:'Flight waits for the verified recitation. You can continue without audio at any time.'}[mode]||'';
      const buttons={ready:'<button class="primary" data-action="start">Start flight</button>',paused:'<button class="primary" data-action="resume">Resume flight</button>',lost:'<button class="primary" data-action="retry">Retry flight</button><button class="text-button" data-action="listen">Listen &amp; review</button>',won:'',sector:'<button class="primary" data-action="next-sector">Next sector →</button>',echo:'<button class="primary" data-action="skip-audio">Continue without audio</button>'}[mode]||'';
      panel.innerHTML=`<span class="astro-award" aria-hidden="true">${mode==='won'?'✦':mode==='lost'?'☾':'✧'}</span><h4>${title}</h4><p>${description}</p>${mode==='won'?victoryChoices():buttons}`;
    }
    if(state.message!==status.dataset.message){status.dataset.message=state.message;say(state.message);}
  }
  async function playReference(gate=false,loop=false) {
    const token=++run;audioGate=gate;
    if(state.session.status==='playing')state=stepAsteroids(state,{type:'assist',kind:'audio'});
    paint();
    const release=()=>{if(disposed||token!==run)return;audioGate=false;last=0;paint();};
    const ok=await audio.play(sector().audio,{loop,muted:muted(),onEnded:release,onError:()=>{release();say('Audio could not load. Flight can continue without a strike.');}});
    if(!ok && !disposed && token===run){release();say('Audio could not start. Continue silently or try Listen again. No strike.');}
  }
  function beginAudio(){if(asteroidProfiles[difficulty].cue)state=stepAsteroids(state,{type:'assist',kind:'hint'});run++;audio.stop();audioGate=false;if(audioMode==='listen')playReference(false,true);if(audioMode==='echo')playReference(true,false);}
  function victoryChoices() {
    const step=guidance||{},next=step.next;
    const label=next?(next.first===next.last?`Continue to ayah ${next.first}`:`Continue to ayahs ${next.first}–${next.last}`):'';
    return `<p class="astro-save-state" ${saveState==='failed'?'role="alert"':'role="status"'}>${saveState==='saved'?'✓ Flight saved. Your progress is safe.':saveState==='failed'?`Your flight has not finished saving. ${esc(saveError)}`:'Saving your flight…'}</p>${saveState==='failed'?'<button class="primary" data-action="save">Retry saving result</button>':''}<section class="astro-next-steps" aria-label="Choose your next step"><h5>${esc(step.title||'Keep your memory growing')}</h5><p>${esc(step.reason||'Alternate flight practice with spoken recall.')}</p><div>${next?`<button class="${step.action==='continue'?'primary':'text-button'}" data-action="continue">${label}</button>`:''}<button class="${step.action==='recall'?'primary':'text-button'}" data-action="recall">Try self-assessed recall</button><button class="${step.action==='practice'?'primary':'text-button'}" data-action="practice">Practise with the reciter</button><button class="text-button" data-action="replay">Play again · same ${config.keys.length===1?'ayah':'ayahs'}</button><button class="text-button" data-action="customize">Choose different ayahs</button><button class="text-button" data-action="exit">Return to study / take a break</button></div>${navigating?'<p role="status">Preparing your next step…</p>':''}</section>`;
  }
  function save(){
    if(saveState==='saved')return true;
    try{onComplete(state.session);saveState='saved';saveError='';state.message='Flight saved. Choose your next step below.';}
    catch(e){saveState='failed';saveError=e.message;state.message='Your flight is still here. Retry saving before starting another activity.';}
    paint();return saveState==='saved';
  }
  async function chooseNext(type) {
    if(navigating||state.session.status!=='won')return;
    if(!save())return;
    navigating=true;paint();
    try {
      if(type==='recall')onRecall(guidance?.action==='recall'?guidance.target:sector().key);
      else if(type==='practice')onPractice(guidance?.action==='practice'?guidance.target:sector().key);
      else await onJourney({kind:type,next:guidance?.next,config,audioMode});
    }catch(e){if(!disposed){state.message=`Could not start the next flight: ${e.message} Your completed flight is saved.`;}}
    finally{if(!disposed){navigating=false;paint();}}
  }
  function send(action) {
    if(disposed)return;
    if(['replay','continue','customize','recall','practice'].includes(action.type)){chooseNext(action.type);return;}
    if(action.type==='save'){if(state.session.status==='won')save();return;}
    if(action.type==='exit'){onExit(sector().key);return;}
    if(action.type==='listen'){playReference(state.session.status==='playing',false);return;}
    if(action.type==='skip-audio'){run++;audio.stop();audioGate=false;last=0;paint();return;}
    if(action.type==='assist')action={type:'navigate'};
    if(action.type==='turn-left'||action.type==='turn-right')action={type:'tick',dt:.15,turn:action.type==='turn-left'?-1:1};
    if(action.type==='pause'){action={type:state.session.status==='paused'?'resume':'pause'};}
    if((audioGate||state.session.status==='paused') && !['resume','pause'].includes(action.type))return;
    const prior=state,oldCheckpoint=state.session.checkpoint;
    state=stepAsteroids(state,action);
    if(action.type==='pause'){held.clear();run++;audioGate=false;audio.pause();}
    if(action.type==='resume'){last=0;if(audioMode==='echo')beginAudio();else audio.resume();}
    if(action.type==='start'||action.type==='retry'||oldCheckpoint!==state.session.checkpoint){held.clear();last=0;beginAudio();stage.focus({preventScroll:true});}
    if(action.type==='capture'&&state.cursor>prior.cursor){view.classList.remove('astro-capture');void view.offsetWidth;view.classList.add('astro-capture');}
    if(state.sectorReady||['lost','won'].includes(state.session.status)){run++;audio.stop();audioGate=false;held.clear();}
    if(state.session.status==='won'&&prior.session.status!=='won'){successCue(`${id}:asteroids`,'Your word voyage is complete!');guidance=getNextSteps(state);save();panel.focus?.();}
    if(!transition&&state.session.checkpoint!==oldCheckpoint){transition=true;view.classList.add('astro-sector-transition');transitionTimer=setTimeout(()=>{if(!disposed)view.classList.remove('astro-sector-transition');transition=false;},motion.reducedMotion?0:700);}
    paint();
  }
  const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',KeyQ:'turn-left',KeyR:'turn-right'};
  const typing=e=>e.target.closest?.('input,select,textarea,a,[contenteditable=true],dialog,.astro-overlay')||e.target.closest?.('button')&&!stage.contains(e.target);
  const keydown=e=>{if(typing(e)||e.altKey||e.ctrlKey||e.metaKey)return;if(keys[e.code]){e.preventDefault();held.add(keys[e.code]);}else if(['Space','KeyE','KeyP'].includes(e.code)){e.preventDefault();if(!e.repeat)send({type:{Space:'capture',KeyE:'shield',KeyP:'pause'}[e.code]});}};
  const keyup=e=>{if(keys[e.code])held.delete(keys[e.code]);};
  const coordinates=e=>{const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*1000,y:(e.clientY-r.top)/r.height*600};};
  let dragging=false;
  const pointerdown=e=>{
    const move=e.target.closest('[data-move]');if(move){e.preventDefault();try{move.setPointerCapture?.(e.pointerId);}catch{}held.add(move.dataset.move);return;}
    if(!stage.contains(e.target)||e.target.closest('.astro-overlay'))return;
    if(e.target.closest('.astro-ship')){dragging=true;try{stage.setPointerCapture(e.pointerId);}catch{}e.preventDefault();}
    else {const target=e.target.closest('[data-object]');send({type:'aim',...coordinates(e),id:target?.dataset.object});}
    stage.focus({preventScroll:true});
  };
  const pointermove=e=>{if(dragging){send({type:'move-to',...coordinates(e)});e.preventDefault();}else if(stage.contains(e.target)&&e.pointerType==='mouse'&&!e.target.closest('[data-object],.astro-overlay'))send({type:'aim',...coordinates(e)});};
  const pointerup=e=>{dragging=false;const move=e.target.closest('[data-move]');if(move)held.delete(move.dataset.move);};
  const click=e=>{const button=e.target.closest('[data-action]');if(button){e.preventDefault();send({type:button.dataset.action});}else if(e.detail===0&&e.target.closest('[data-move]')){const dir=e.target.closest('[data-move]').dataset.move;send({type:'tick',dt:.15,dx:dir==='left'?-1:dir==='right'?1:0,dy:dir==='up'?-1:dir==='down'?1:0});}else if(e.detail===0&&e.target.closest('[data-object]')){const o=state.objects.find(o=>o.id===e.target.closest('[data-object]').dataset.object);if(o)send({type:'aim',x:o.x,y:o.y,id:o.id});}};
  const blur=()=>{held.clear();dragging=false;if(state.session.status==='playing')send({type:'pause'});};
  const visibility=()=>{if(document.hidden)blur();};
  const select=root.querySelector('[data-astro-audio]');select.value=audioMode;select.onchange=()=>{audioMode=select.value;if(state.session.status==='playing')beginAudio();else{run++;audio.stop();audioGate=false;}paint();};
  document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  root.addEventListener('pointerdown',pointerdown);root.addEventListener('pointermove',pointermove);root.addEventListener('pointerup',pointerup);root.addEventListener('pointercancel',pointerup);root.addEventListener('click',click);
  function tick(time){if(disposed)return;const dt=last?(time-last)/1000:0;last=time;if(state.session.status==='playing'&&!state.sectorReady&&!audioGate){state=stepAsteroids(state,{type:'tick',dt,dx:Number(held.has('right'))-Number(held.has('left')),dy:Number(held.has('down'))-Number(held.has('up')),turn:Number(held.has('turn-right'))-Number(held.has('turn-left'))});paint();}frame=requestAnimationFrame(tick);}
  paint();frame=requestAnimationFrame(tick);
  return {start:()=>send({type:'start'}),pause:()=>{if(state.session.status==='playing')send({type:'pause'});},resume:()=>{if(state.session.status==='paused')send({type:'resume'});},dispatch:send,getSnapshot:()=>structuredClone(state),listen:()=>send({type:'listen'}),mute:()=>audio.mute(muted()),dispose(){if(disposed)return;disposed=true;run++;held.clear();cancelAnimationFrame(frame);clearTimeout(transitionTimer);audio.dispose();state=stepAsteroids(state,{type:'dispose'});document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pointerdown',pointerdown);root.removeEventListener('pointermove',pointermove);root.removeEventListener('pointerup',pointerup);root.removeEventListener('pointercancel',pointerup);root.removeEventListener('click',click);nodes.clear();root.replaceChildren();}};
}
