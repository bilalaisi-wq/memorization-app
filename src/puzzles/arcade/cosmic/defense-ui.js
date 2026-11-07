import {mountCaptureDefenseUI} from './defense-capture-ui.js';
import {mountCosmicControls,cosmicReducedMotion} from '../../../quest/cosmic/preferences.js';
import {createFlightBonuses} from '../../../quest/cosmic/bonuses.js';
import {createFlightController} from '../../../quest/cosmic/controller.js';
import {createGatewayRecorder} from '../../../quest/cosmic/gateway-store.js';
import {activeProfileId,profileStorage} from '../../../learner/profile-storage.js';
import {createGatewayPanel} from './gateway-ui.js';
import {createAudioManager} from '../services.js';
import {readLabVolume} from '../../audio-level.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import {freeAyah} from '../../../quest/cosmic/gateways.js';
import {DEFENSE_ABILITIES} from './defense.js';
import './runner.css';
import './defense.css';
const NS='http://www.w3.org/2000/svg';
export async function mountMeteorDefense(root,mission,{controller=null,onExit=()=>{},onRunner=null,onLink=null,onCheckpoint=null,isCurrent=()=>true,configuration='balanced',slow=false}={}){
  const owner=activeProfileId(),game=controller||await createFlightController(mission,{activity:'defense',defenseConfig:configuration,slow});
  if(game.getSnapshot().defenseVersion===2)return mountCaptureDefenseUI(root,mission,{game,ownsGame:!controller,onExit,onRunner,onLink,onCheckpoint,isCurrent});
  if(!root.isConnected||owner!==activeProfileId()||!isCurrent()){if(!controller)game.dispose();return null;}
  const recorder=createGatewayRecorder(mission,{runId:game.getSnapshot().runId}),bonuses=createFlightBonuses(mission);let bonusXP=0,warning='',disposed=false,raf=0,last=0,warmup=0,lastState='',audioToken=0,loopKey=null,loopStopped=false,loopFailed=false,controls=null;
  const unsubscribe=game.subscribe(e=>{try{recorder.record(e);}catch(error){warning=error.message;}if(e.type==='defense:memory-correct')bonuses.record(e).then(result=>{if(disposed)return;if(result.xp&&!result.duplicate)bonusXP+=result.xp;paint();}).catch(error=>{if(!disposed){warning=error.message;paint();}});}),abort=new AbortController(),nodes=new Map();
  root.innerHTML=`<section class="meteor-defense" aria-label="Meteor Defense"><div class="runner-heading"><div><span class="cosmic-eyebrow">COSMIC RUSH · METEOR DEFENSE</span><h3>Guard the celestial core</h3></div><button class="cosmic-secondary" data-defense-exit>Return to mission</button></div><p>Aim to protect the core. Listen during each wave, then choose its ayah in the arena. Movement mistakes never grade memorization.</p><div class="runner-hud"><span data-defense-stage></span><span data-defense-wave></span><span data-defense-score></span></div><label class="defense-health">Core integrity <progress data-core-health max="100" value="100"></progress><strong data-core-label></strong></label><div class="runner-field defense-field" tabindex="0" role="group" aria-label="Core defense arena. Aim with arrows or A and D, or point and touch. Space fires. Keys 1 to 4 use charged abilities. P pauses."><svg data-defense-scene viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><radialGradient id="defense-core"><stop stop-color="#efffff"/><stop offset=".45" stop-color="#74eee6"/><stop offset="1" stop-color="#6468b7"/></radialGradient></defs><g class="defense-stars"><circle cx="80" cy="70" r="2"/><circle cx="230" cy="550" r="3"/><circle cx="780" cy="100" r="3"/><circle cx="860" cy="510" r="2"/><circle cx="430" cy="80" r="2"/></g><circle cx="500" cy="340" r="82" class="defense-orbit"/><circle data-core-shield cx="500" cy="340" r="93" class="defense-shield"/><circle cx="500" cy="340" r="44" fill="url(#defense-core)" class="defense-core"/><path d="M500 309 508 332 530 340 508 348 500 371 492 348 470 340 492 332Z" fill="#fff9d5"/><g data-defense-objects></g><g data-defense-turret><path d="M-18 -17 18 -9 45 0 18 9 -18 17 -9 0Z" fill="#d6eeff" stroke="#7fece0" stroke-width="3"/></g></svg><div class="runner-overlay defense-overlay" data-defense-overlay></div></div><div class="defense-controls"><button class="cosmic-primary" data-defense-turn="-1" aria-label="Aim left">↶ Aim left</button><button class="cosmic-primary" data-defense-fire>Fire · Space</button><button class="cosmic-primary" data-defense-turn="1" aria-label="Aim right">Aim right ↷</button><button class="cosmic-secondary" data-defense-pause>Pause</button><button class="cosmic-secondary" data-defense-restart>Restart defense set</button></div><label>Aim direction<input data-defense-aim aria-label="Turret aim direction" type="range" min="-180" max="180" step="1" value="-90"></label><div class="defense-abilities" aria-label="Recognition-charged abilities">${Object.entries(DEFENSE_ABILITIES).map(([id,name],i)=>`<button class="cosmic-secondary" data-defense-ability="${id}"><strong>${i+1} · ${name}</strong><span data-charge="${id}">0 charges</span></button>`).join('')}</div><details class="cosmic-brief-instructions"><summary>Abilities and controls</summary><p>Star Shield protects for 5 seconds. Pulse Wave clears nearby meteors. Repair Beam restores core integrity. Constellation Burst fires eight energy projectiles. Charges come only from correct Quran checkpoint choices. Pro tip: wait until meteors approach before using Shield or Pulse; say each ayah aloud at the untimed checkpoint.</p></details><div class="defense-audio"><button class="cosmic-secondary" data-defense-listen>Replay wave audio</button><label>Recitation volume<input data-defense-volume type="range" min="0" max="100" value="50"></label><button class="cosmic-secondary" data-defense-stop>Stop audio</button></div><p data-defense-warning role="status"></p><p data-defense-status role="status" aria-live="polite"></p></section>`;
  const view=root.querySelector('.meteor-defense'),field=root.querySelector('.defense-field'),scene=root.querySelector('[data-defense-scene]'),objects=root.querySelector('[data-defense-objects]'),overlay=root.querySelector('[data-defense-overlay]');
  const audio=createAudioManager({owner:'meteor-defense-study',initialVolume:readLabVolume(profileStorage)}),panel=createGatewayPanel(root,send,{embedded:true,onNavigate:()=>field.focus({preventScroll:true})});
  const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:abort.signal});
  function stopAudio(){audioToken++;audio.stop();loopKey=null;panel.stop();}
  function syncWaveAudio(s){
    if(s.status!=='running'){if(loopKey){audioToken++;audio.stop();loopKey=null;}return;}
    const key=`${s.stageIndex}:${s.roundIndex}:${s.waveIndex}:${s.targetRef}`;
    if(loopKey===key||loopStopped||loopFailed)return;
    loopKey=key;const token=++audioToken;
    try{reportStudyExposure([s.targetRef]);game.dispatch({type:'audio-assisted'});}catch(error){warning=error.message;loopFailed=true;loopKey=null;return;}
    audio.play(freeAyah(s.targetRef).audio,{loop:true,onError:()=>{if(!disposed&&token===audioToken){loopFailed=true;warning='Wave recitation unavailable. Use Replay wave audio to retry.';}}}).then(ok=>{if(!ok&&!disposed&&token===audioToken){loopFailed=true;warning='Wave recitation unavailable. Use Replay wave audio to retry.';}});
  }
  function paint(){
    const s=game.getSnapshot();syncWaveAudio(s);view.dataset.defenseState=s.status;view.dataset.wave=String(s.waveIndex);view.dataset.pattern=s.pattern||'';
    field.classList.toggle('defense-impact',s.impact>0);field.classList.toggle('defense-reduced',cosmicReducedMotion());
    root.querySelector('[data-defense-stage]').textContent=`Stage ${s.stageIndex+1} / ${s.stageCount} · Round ${s.roundIndex+1} / ${s.roundCount}`;
    root.querySelector('[data-defense-wave]').textContent=`Wave ${s.waveIndex+1} / ${s.waveCount} · ${s.pattern||'recall to begin'} · ${s.waveDefended} meteors defended`;
    root.querySelector('[data-defense-score]').textContent=`${s.arcadeScore} arcade points · ${bonusXP} bonus XP`;
    root.querySelector('[data-core-health]').max=s.maxHealth;root.querySelector('[data-core-health]').value=s.health;root.querySelector('[data-core-label]').textContent=`${s.health} / ${s.maxHealth}`;
    root.querySelector('[data-core-shield]').style.opacity=s.shield>0?'1':'0';
    const x=500+Math.cos(s.angle)*70,y=340+Math.sin(s.angle)*70;root.querySelector('[data-defense-turret]').setAttribute('transform',`translate(${x} ${y}) rotate(${s.angle*180/Math.PI})`);
    root.querySelector('[data-defense-aim]').value=String(Math.atan2(Math.sin(s.angle),Math.cos(s.angle))*180/Math.PI);
    root.querySelector('[data-defense-aim]').disabled=s.status!=='running';
    root.querySelectorAll('[data-defense-turn],[data-defense-fire]').forEach(b=>b.disabled=s.status!=='running');
    root.querySelector('[data-defense-pause]').disabled=!['running','paused'].includes(s.status);root.querySelector('[data-defense-pause]').textContent=s.status==='paused'?'Resume':'Pause';
    root.querySelectorAll('[data-defense-ability]').forEach(b=>{const name=b.dataset.defenseAbility;b.disabled=!s.charges[name]||name==='repair'&&!s.canRepair||s.status!=='running'&&!(s.status==='recovery'&&name==='repair');b.querySelector('span').textContent=`${s.charges[name]} charge${s.charges[name]===1?'':'s'}`;});
    const ids=new Set();for(const o of s.objects){
      ids.add(o.id);let el=nodes.get(o.id);if(!el){el=document.createElementNS(NS,o.kind==='repair'?'line':'circle');el.dataset.defenseObject=o.kind;el.dataset.objectId=o.id;el.setAttribute('class',`defense-object defense-${o.kind}`);objects.append(el);nodes.set(o.id,el);}
      el.setAttribute('cx',o.x);el.setAttribute('cy',o.y);el.setAttribute('r',o.kind==='meteor'?o.radius:o.kind==='energy'?6:o.kind==='pulse'?(1-o.life/.65)*220:50+(1-o.life/.65)*40);
      if(o.kind==='repair'){el.setAttribute('x1',x);el.setAttribute('y1',y);el.setAttribute('x2',500);el.setAttribute('y2',340);}
      el.setAttribute('data-hp',o.hp||0);
    }
    for(const [id,el] of nodes)if(!ids.has(id)){el.remove();nodes.delete(id);}
    field.classList.toggle('defense-gateway-open',s.status==='gateway');panel.paint(s);root.querySelector('[data-defense-warning]').textContent=warning;
    if(s.status!==lastState){
      if(s.status==='gateway')field.scrollIntoView({block:'start',behavior:'instant'});
      lastState=s.status;overlay.hidden=['running','gateway'].includes(s.status);overlay.replaceChildren();
      const heading=document.createElement('h4');heading.tabIndex=-1;heading.textContent=({ready:'Ready to defend?',running:'Defense active',gateway:'Safe orbit · Quran checkpoint',paused:'Defense paused',recovery:'Core needs recovery','wave-clear':'Wave secured',checkpoint:'Celestial core secured'})[s.status]||'Defense ended';
      const message=document.createElement('p');message.textContent=s.reason;if(['recovery','checkpoint','wave-clear'].includes(s.status))message.textContent+=` Core impacts: ${s.motorErrors}. Quran choice repairs: ${s.memoryMistakes}. These are separate outcomes.`;overlay.append(heading,message);
      const button=(label,fn)=>{const b=document.createElement('button');b.className='cosmic-primary';b.textContent=label;b.onclick=fn;overlay.append(b);};
      if(s.status==='ready')button('Start Meteor Defense',()=>send({type:'start'}));
      if(s.status==='paused')button('Resume defense',()=>send({type:'resume'}));
      if(s.status==='recovery')button('Retry wave · keep recognition progress',()=>send({type:'retry'}));
      if(s.status==='wave-clear')button('Next Quran checkpoint',()=>send({type:'next-wave'}));
      if(s.status==='checkpoint'){
        message.textContent=s.routeComplete?'Defense route covered. This is supported practice, not independent recitation certification.':s.atRouteEnd?'Defense checkpoint secured. Earlier Defense checkpoints were not all played in this mixed route. Return to mission to select them.':'Defense set secured. Continue the mission or return to Star Runner.';
        const summary=document.createElement('p');summary.textContent=`Core impacts: ${s.motorErrors} · Quran choice repairs: ${s.memoryMistakes}`;overlay.append(summary);
        if(onCheckpoint)button('Continue expedition',()=>onCheckpoint(s));
        if(!onCheckpoint){
        if(onRunner)button('Continue in Star Runner',onRunner);
        if(onLink)button('Continue in Ayah Link',onLink);
        if(!s.atRouteEnd)button('Continue defense · next round or set',()=>{stopAudio();game.nextStage();last=0;warmup=3;paint();schedule();field.focus({preventScroll:true});});
        button('Replay this defense set',()=>send({type:'restart'}));
        }
      }
      root.querySelector('[data-defense-status]').textContent=heading.textContent;if(!['running','gateway'].includes(s.status))heading.focus({preventScroll:true});
    }
  }
  function frame(now){raf=0;if(disposed||!root.isConnected){dispose();return;}if(game.getSnapshot().status!=='running')return;const dt=last?(now-last)/1000:0;last=now;if(warmup>0)warmup=dt>0&&dt<=.25?warmup-1:3;else if(dt)game.dispatch({type:'tick',dt});paint();schedule();}
  function schedule(){if(!disposed&&!raf&&game.getSnapshot().status==='running')raf=requestAnimationFrame(frame);}
  function send(action){
    if(disposed||panel.blocked&&(action.type.startsWith('gateway-')||action.type==='lane')&&action.type!=='gateway-refresh')return;
    // Neutral defense effects do not interrupt the full-ayah revision loop.
    if(action.type==='toggle')action={type:game.getSnapshot().status==='paused'?'resume':'pause'};
    if(action.type.startsWith('gateway-')||['pause','resume','retry','restart','next-wave'].includes(action.type))stopAudio();
    const before=game.getSnapshot();
    if(['start','restart','retry','gateway-continue'].includes(action.type)){loopStopped=false;loopFailed=false;}
    game.dispatch(action);if(['start','resume','retry','restart','gateway-continue'].includes(action.type)){last=0;warmup=3;}
    if(game.getSnapshot().status!=='running'){cancelAnimationFrame(raf);raf=0;last=0;}
    paint();schedule();
    if(before.status!=='gateway'&&game.getSnapshot().status==='gateway')field.scrollIntoView({block:'start',behavior:'instant'});
    if(['resume','retry','gateway-continue'].includes(action.type))field.focus({preventScroll:true});
    if(action.type==='gateway-continue'&&game.getSnapshot().status==='running')field.scrollIntoView({block:'center',behavior:'instant'});
  }
  function point(e){const r=scene.getBoundingClientRect(),scale=Math.min(r.width/1000,r.height/680),left=(r.width-1000*scale)/2,top=(r.height-680*scale)/2;send({type:'aim',angle:Math.atan2((e.clientY-r.top-top)/scale-340,(e.clientX-r.left-left)/scale-500)});}
  listen(field,'pointermove',e=>{if(game.getSnapshot().status==='running'&&!e.target.closest('button'))point(e);});
  listen(field,'pointerdown',e=>{if(game.getSnapshot().status!=='running'||e.target.closest('button'))return;e.preventDefault();field.setPointerCapture(e.pointerId);point(e);send({type:'fire',active:true});field.focus({preventScroll:true});});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(field,type,()=>send({type:'fire',active:false}));
  listen(view,'keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea,[contenteditable]'))return;
    const s=game.getSnapshot(),dir=({ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1})[e.code];
    if(s.status==='gateway'){
      if(dir){e.preventDefault();if(!e.repeat)send({type:'lane',direction:dir});}
      else if(['Space','Enter','ArrowUp'].includes(e.code)&&!e.target.closest('button')){e.preventDefault();if(!e.repeat)send({type:'gateway-choose'});}return;
    }
    if(dir){e.preventDefault();if(!e.repeat)send({type:'aim',angle:s.angle+dir*.12});send({type:'turn',direction:dir});}
    else if(e.code==='Space'&&s.status==='running'&&!e.target.closest('button')){e.preventDefault();send({type:'fire',active:true});}
    else if(/^Digit[1-4]$/.test(e.code)){e.preventDefault();if(!e.repeat)send({type:'ability',name:Object.keys(DEFENSE_ABILITIES)[Number(e.code.at(-1))-1]});}
    else if(['KeyP','Escape'].includes(e.code)){e.preventDefault();if(!e.repeat)send({type:'toggle'});}
  });
  listen(window,'keyup',e=>{if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code))send({type:'turn',direction:0});if(e.code==='Space')send({type:'fire',active:false});});
  root.querySelectorAll('[data-defense-turn]').forEach(b=>{listen(b,'pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);send({type:'aim',angle:game.getSnapshot().angle+Number(b.dataset.defenseTurn)*.12});send({type:'turn',direction:Number(b.dataset.defenseTurn)});});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,()=>send({type:'turn',direction:0}));b.onclick=e=>{if(e.detail===0)send({type:'aim',angle:game.getSnapshot().angle+Number(b.dataset.defenseTurn)*.18});};});
  const fire=root.querySelector('[data-defense-fire]');listen(fire,'pointerdown',e=>{e.preventDefault();fire.setPointerCapture(e.pointerId);send({type:'fire',active:true});});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(fire,type,()=>send({type:'fire',active:false}));fire.onclick=e=>{if(e.detail===0)send({type:'fire'});};
  root.querySelector('[data-defense-aim]').oninput=e=>send({type:'aim',angle:Number(e.target.value)*Math.PI/180});
  root.querySelectorAll('[data-defense-ability]').forEach(b=>b.onclick=()=>send({type:'ability',name:b.dataset.defenseAbility}));
  root.querySelector('[data-defense-pause]').onclick=()=>send({type:'toggle'});root.querySelector('[data-defense-restart]').onclick=()=>send({type:'restart'});
  root.querySelector('[data-defense-volume]').value=String(Math.round(readLabVolume(profileStorage)*100));root.querySelector('[data-defense-volume]').oninput=e=>audio.setVolume(Number(e.target.value)/100);
  root.querySelector('[data-defense-stop]').onclick=()=>{loopStopped=true;stopAudio();};
  root.querySelector('[data-defense-listen]').onclick=()=>{if(game.getSnapshot().status==='gateway')return;loopStopped=false;loopFailed=false;stopAudio();if(game.getSnapshot().status==='paused')game.resume();paint();schedule();};
  root.querySelector('[data-defense-exit]').onclick=()=>{dispose();onExit();};
  listen(window,'blur',()=>send({type:'pause'}));listen(document,'visibilitychange',()=>{if(document.hidden)send({type:'pause'});});listen(window,'ayahprofilechange',()=>{if(activeProfileId()!==owner){dispose();root.textContent='Account changed. Reopen Revision Lab.';}});
  const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();observer.disconnect();stopAudio();panel.dispose();audio.dispose();unsubscribe();nodes.clear();controls?.dispose();if(!controller)game.dispose();}
  listen(document,'ayahappearancechange',paint);listen(window,'ayahcosmicpreferences',paint);controls=mountCosmicControls(view);paint();return {pause:()=>send({type:'pause'}),resume:()=>send({type:'resume'}),dispose,getSnapshot:()=>game.getSnapshot()};
}

export async function mountPassageDefense(root,{refs,client=null,verifyBundle=null,isCurrent=()=>true,onExit=()=>{},mode='capture',motorDifficulty='relaxed',chainMode='practice'}={}){const {createCaptureDirector}=await import('./defense-capture-host.js');const game=await createCaptureDirector({refs,client,verifyBundle,mode,motorDifficulty,chainMode});if(!root.isConnected||!isCurrent()){game.dispose();return null;}root.classList.add('cosmic-rush');return mountCaptureDefenseUI(root,game.mission,{game,ownsGame:true,onExit,isCurrent});}
