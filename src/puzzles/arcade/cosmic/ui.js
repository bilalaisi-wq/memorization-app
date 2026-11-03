import {createFlowUnits} from '../../../quest/cosmic/flow-content.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import {freeAyah} from '../../../quest/cosmic/gateways.js';
import {createAudioManager} from '../services.js';
import {readLabVolume} from '../../audio-level.js';
import {profileStorage} from '../../../learner/profile-storage.js';
import {createGatewayPanel} from './gateway-ui.js';
import {createGatewayRecorder} from '../../../quest/cosmic/gateway-store.js';
import { createFlightController } from '../../../quest/cosmic/controller.js';
import { activeProfileId } from '../../../learner/profile-storage.js';
import './runner.css';

export async function mountStarRunner(root, mission, {onExit=()=>{},onEvent=()=>{},slow=false,pickupMode='mixed',memoryGateways=false,isCurrent=()=>true}={}) {
  const owner=activeProfileId();
  let saveWarning='',exposureWarning='';const assistedRefs=new Set();
  const recorder=createGatewayRecorder(mission);
  const game=await createFlightController(mission,{slow,pickupMode,memoryGateways,onEvent(event){
    try{recorder.record({...event,assisted:!!event.assisted||assistedRefs.has(event.targetRef)});}catch(error){saveWarning=error.message;}
    onEvent(event);
  }});
  if(!root.isConnected||activeProfileId()!==owner||!isCurrent()){game.dispose();return null;}
  const abort=new AbortController();
  let disposed=false,raf=0,last=0,lastStatus='',pointer=null,warmup=0;
  root.innerHTML=`<section class="star-runner" aria-label="Star Runner flight"><div class="runner-heading"><div><span class="cosmic-eyebrow">COSMIC RUSH · STAR RUNNER</span><h3>Fly your constellation</h3></div><button class="cosmic-secondary" data-flight-exit>Return to mission</button></div><p>Steer into the next correct ayah or word piece. Avoid other authentic Quran pickups and ordinary asteroids. If already in the right lane, press Space or Stay / collect. Every required piece returns until collected.</p><div class="runner-hud"><span data-flight-stage></span><span data-shield></span><span data-stars></span></div><section class="runner-learning" aria-label="Your ayah sequence"><p data-flow-prompt></p><p data-flow-feedback role="status" aria-live="polite"></p><div data-flow-built class="flow-built" lang="ar" dir="rtl"></div><button class="cosmic-secondary" data-flow-listen>Listen to current ayah · pauses flight</button><button class="cosmic-secondary" data-flow-stop>Stop recitation</button><label>Recitation volume<input data-flow-volume type="range" min="0" max="100" value="50"></label></section><progress data-flight-progress max="1" value="0" aria-label="Flight stage progress"></progress><div class="runner-field" tabindex="0" role="group" aria-label="Three lane Quran flight. Left and Right arrows or A and D to steer. Space chooses your current lane. P or Escape pauses."><div class="runner-nebula" aria-hidden="true"></div><div class="runner-spark-field" aria-hidden="true"></div><div class="runner-lanes" aria-hidden="true"><i></i><i></i><i></i></div><div data-flight-objects aria-hidden="true"></div><div class="runner-ship" data-ship aria-hidden="true"><div class="runner-shield"></div><div class="runner-thruster"></div><svg viewBox="0 0 60 80"><path d="M30 4 48 49 58 67 38 61 30 72 22 61 2 67 12 49Z" fill="#c9f4ff" stroke="#80efe5" stroke-width="2"/><path d="M30 12 38 45 30 52 22 45Z" fill="#7478ef"/><path d="M12 49 22 55 16 63 4 66Z M48 49 38 55 44 63 56 66Z" fill="#7c80df"/></svg></div><div class="runner-portals" data-runner-portals hidden aria-hidden="true"><div class="runner-portal">1</div><div class="runner-portal">2</div><div class="runner-portal">3</div></div><div class="runner-overlay" data-flight-overlay></div></div><div class="runner-controls"><button class="cosmic-primary" data-steer="-1" aria-label="Steer left">← Left lane</button><button class="cosmic-secondary" data-flow-stay>Stay / collect</button><button class="cosmic-secondary" data-flight-pause>Pause</button><button class="cosmic-primary" data-steer="1" aria-label="Steer right">Right lane →</button><button class="cosmic-secondary" data-flight-restart>Restart stage</button></div><p data-gateway-save-warning role="status"></p><p data-flight-status role="status" aria-live="polite"></p><p class="runner-help">Arrow keys / A D · swipe left or right · P / Escape: pause. Collect the words or ayahs in canonical order. Wrong text repeats the same target and never costs shields. Asteroid collisions are motor errors. Word pieces are visual study units, not approved recitation stops. Flight checkpoints last until you leave this flight.</p></section>`;
  const view=root.querySelector('.star-runner'), field=root.querySelector('.runner-field'), ship=root.querySelector('[data-ship]'), layer=root.querySelector('[data-flight-objects]'), overlay=root.querySelector('[data-flight-overlay]');
  const flowAudio=createAudioManager({owner:'cosmic-flow',initialVolume:readLabVolume(profileStorage)});
  let exposureWave='',builtKey='',flowAudioToken=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), nodes=new Map();
  const gatewayPanel=createGatewayPanel(root,send,{onNavigate:()=>field.focus({preventScroll:true})});
  const listen=(target,name,fn)=>target.addEventListener(name,fn,{signal:abort.signal});
  function paint() {
    let s=game.getSnapshot(),exposureBlocked=false;
    field.classList.toggle('runner-flow',!!s.flow);
    if(s.flow){
      view.dataset.expectedUnit=s.unit?.id||'';view.dataset.waveId=s.waveId||'';
      const builtRef=s.completedAyahs.at(-1);
      const exposed=[...s.objects.filter(o=>o.kind==='pickup').map(o=>o.unit.key),...(builtRef?[builtRef]:[])];
      const exposureKey=`${s.waveId}:${[...new Set(exposed)].join('|')}`;
      if(exposed.length&&exposureKey!==exposureWave){
        try{reportStudyExposure(exposed);exposureWave=exposureKey;exposureWarning='';}
        catch(error){exposureBlocked=true;builtKey='';game.pause('Study assistance could not be saved. Export or recover progress, then resume.');s=game.getSnapshot();exposureWarning=error.message;}
      }
      if(exposureBlocked)root.querySelector('[data-flow-built]').textContent='';
      root.querySelector('[data-flow-prompt]').textContent=s.unit?`${freeAyah(s.unit.key).name} · Ayah ${s.unit.key.split(':')[1]} · ${s.unit.kind==='word'?'Next word '+(s.unit.index+1):'Next ayah'} · ${s.cursor} / ${s.totalUnits} pieces collected`:'Stage sequence complete';
      if(!exposureBlocked&&builtKey!==`${s.cursor}:${s.unit?.key}`){
        builtKey=`${s.cursor}:${s.unit?.key}`;
        const a=s.unit?freeAyah(s.unit.key):null;
        root.querySelector('[data-flow-built]').textContent=a&&s.unit.kind==='word'?(s.unit.index?createFlowUnits([a.ref],'words').slice(0,s.unit.index).map(w=>w.text).join(' '):builtRef?freeAyah(builtRef).text:''):builtRef?freeAyah(builtRef).text:'';
      }
    }
    root.querySelector('[data-flow-feedback]').textContent=s.flow?s.reason:'';
    layer.removeAttribute('aria-hidden');
    view.dataset.flightState=s.status;view.dataset.lane=String(s.status==='gateway'?s.gateway.lane:s.lane);
    const inOrbit=s.status==='gateway',choosing=inOrbit&&s.gateway.state==='choices';
    field.classList.toggle('runner-orbit',inOrbit);
    field.classList.toggle('runner-route-open',inOrbit&&s.gateway.state==='open');
    root.querySelector('[data-runner-portals]').hidden=!inOrbit;
    root.querySelectorAll('.runner-portal').forEach((p,i)=>p.classList.toggle('is-selected',inOrbit&&s.gateway.lane===i));
    root.querySelector('[data-gateway-save-warning]').textContent=saveWarning||exposureWarning;
    gatewayPanel.paint(s);
    view.classList.toggle('runner-reduced',reduced.matches);
    field.classList.toggle('runner-hit',s.impact>0);
    field.classList.toggle('runner-invulnerable',s.invulnerable>0);
    field.style.setProperty('--flight-time',String(s.elapsed));
    ship.style.left=`${inOrbit?[20,50,80][s.gateway.lane]:s.x/600*100}%`;
    ship.style.top=inOrbit&&s.gateway.state==='open'?'27%':'82.6389%';
    field.style.setProperty('--flight-scroll',`${s.elapsed*30}px`);
    field.style.setProperty('--flight-camera',`${(300-s.x)*.025}px`);
    field.style.setProperty('--flight-bank',reduced.matches?'0deg':`${Math.max(-10,Math.min(10,( [120,300,480][s.lane]-s.x)*.08))}deg`);
    root.querySelector('[data-flight-stage]').textContent=`Stage ${s.stageIndex+1} / ${s.stageCount}`;
    root.querySelector('[data-shield]').textContent=`Shield ${'◈'.repeat(s.shield)}${'◇'.repeat(3-s.shield)} · ${s.shield}/3`;
    root.querySelector('[data-stars]').textContent=s.flow?`${s.completedAyahs.length} ayahs connected · ${s.memoryMistakes} word/ayah selections to practise`:`★ ${s.stars} / 3 navigation stars`;
    root.querySelector('[data-flight-progress]').value=s.progress;
    root.querySelector('[data-flight-pause]').textContent=s.status==='paused'?'Resume':inOrbit?'Safe orbit':'Pause';
    root.querySelector('[data-flight-pause]').disabled=!['running','paused'].includes(s.status);
    root.querySelectorAll('[data-steer]').forEach(b=>b.disabled=s.status!=='running'&&(!choosing||gatewayPanel.blocked));
    root.querySelector('[data-flight-restart]').disabled=inOrbit;
    root.querySelector('[data-flow-stay]').disabled=s.status!=='running';
    const ids=new Set();
    for(const o of exposureBlocked?[]:s.objects){
      ids.add(o.id);let el=nodes.get(o.id);
      if(!el){
        el=document.createElement('div');el.className=`runner-object runner-${o.kind}`;
        el.dataset.objectId=o.id;el.dataset.kind=o.kind;
        if(o.kind==='pickup'){el.lang='ar';el.dir='rtl';el.dataset.unitId=o.unit.id;el.dataset.pickupLane=String(o.lane);el.textContent=o.unit.text;el.setAttribute('aria-label',`${['Left','Middle','Right'][o.lane]} lane: ${o.unit.text}`);}
        else el.textContent=o.kind==='star'?'✦':'';
        el.classList.toggle('runner-ribbon',!!o.ribbon);
        el.style.width=o.kind==='pickup'?(o.ribbon?'92%':'28%'):`${o.radius*2/600*100}%`;
        layer.append(el);nodes.set(o.id,el);
      }
      el.style.left=`${o.ribbon?50:o.x/600*100}%`;el.style.top=`${o.y/720*100}%`;
    }
    for(const [id,el] of nodes)if(!ids.has(id)){el.remove();nodes.delete(id);}
    if(s.status!==lastStatus){
      lastStatus=s.status;
      overlay.hidden=s.status==='running'||s.status==='gateway';
      overlay.replaceChildren();
      const heading=document.createElement('h4'), message=document.createElement('p');heading.tabIndex=-1;
      heading.textContent=({ready:'Ready for launch?',running:'Flight active',gateway:'Safe orbit — memory gateway',paused:'Flight paused',checkpoint:'Safe checkpoint reached',recovery:'Let’s try that stage again'})[s.status]||'Flight ended';
      message.textContent=s.reason||'Steer into the stars and out of the rocks. You control the ship.';
      overlay.append(heading,message);
      const button=document.createElement('button');button.className='cosmic-primary';
      if(s.status==='ready'){button.textContent='Start flight';button.onclick=()=>send({type:'start'});}
      if(s.status==='paused'){button.textContent='Resume flight';button.onclick=()=>send({type:'resume'});}
      if(s.status==='recovery'){button.textContent='Retry · keep collected pieces';button.onclick=()=>send({type:s.flow?'retry':'restart'});}
      if(s.status==='checkpoint'){
        message.textContent=s.routeComplete?'Ayah sequence collected. Your selected ayahs were covered. This is supported practice, not independent memorization mastery.':'Shield restored. Continue to the next flight stage when ready.';
        button.textContent=s.routeComplete?'Fly this stage again':'Continue to next flight stage';button.onclick=()=>{if(s.routeComplete)send({type:'restart'});else{game.nextStage();last=0;warmup=3;paint();schedule();field.focus({preventScroll:true});}};
      }
      if(s.status!=='disposed')overlay.append(button);
      root.querySelector('[data-flight-status]').textContent=heading.textContent;
      if(['checkpoint','recovery','paused'].includes(s.status))heading.focus({preventScroll:true});
    }
  }
  function frame(now){
    raf=0;if(disposed||!root.isConnected){dispose();return;}
    if(game.getSnapshot().status!=='running')return;
    const dt=last?(now-last)/1000:0;last=now;
    // Rebase after the untimed gate/layout transition; never apply catch-up travel.
    if(warmup>0){warmup=dt>0&&dt<=.25?warmup-1:3;}
    else if(dt)game.dispatch({type:'tick',dt});
    paint();schedule();
  }
  function schedule(){if(!disposed&&!raf&&game.getSnapshot().status==='running')raf=requestAnimationFrame(frame);}
  function send(action){
    if(disposed)return;
    if(gatewayPanel.blocked&&(action.type.startsWith('gateway-')||action.type==='lane')&&action.type!=='gateway-refresh')return;
    if(action.type==='toggle')action={type:game.getSnapshot().status==='paused'?'resume':'pause'};
    if(action.type.startsWith('gateway-')||['restart','retry','pause','resume'].includes(action.type)){gatewayPanel.stop();flowAudioToken++;flowAudio.stop();}
    game.dispatch(action);
    if(action.type==='pause')pointer=null;
    if(['pause','resume'].includes(action.type))exposureWave='';
    if(['start','resume','restart','retry','gateway-continue'].includes(action.type)){last=0;field.focus({preventScroll:true});}
    if(game.getSnapshot().status!=='running'){cancelAnimationFrame(raf);raf=0;last=0;}
    paint();
    if(['start','resume','restart','retry','gateway-continue'].includes(action.type))warmup=3;
    if(action.type==='gateway-continue')field.scrollIntoView({block:'center',behavior:'instant'});
    schedule();
  }
  listen(view,'keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
    const direction=({ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1})[event.code];
    if(direction){event.preventDefault();if(!event.repeat)send({type:'lane',direction});}
    else if(['Enter','Space','ArrowUp'].includes(event.code)&&game.getSnapshot().gateway?.state==='choices'&&!event.target.closest('button')){event.preventDefault();if(!event.repeat)send({type:'gateway-choose'});}
    else if(event.code==='Space'&&game.getSnapshot().flow&&!event.target.closest('button')){event.preventDefault();if(!event.repeat)send({type:'confirm-lane'});}
    else if(['KeyP','Escape'].includes(event.code)){event.preventDefault();if(!event.repeat)send({type:'toggle'});}
  });
  listen(field,'pointerdown',event=>{if(pointer||!event.isPrimary||event.target.closest('button')||!['running','gateway'].includes(game.getSnapshot().status))return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};field.setPointerCapture(event.pointerId);});
  listen(field,'pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;if(Math.abs(dx)>25&&Math.abs(dx)>Math.abs(dy))send({type:'lane',direction:Math.sign(dx)});});
  listen(field,'pointercancel',()=>{pointer=null;});
  listen(field,'lostpointercapture',()=>{pointer=null;});
  listen(window,'blur',()=>send({type:'pause',reason:'Flight paused while you were away.'}));
  listen(document,'visibilitychange',()=>{if(document.hidden)send({type:'pause',reason:'Flight paused while the tab was hidden.'});});
  listen(window,'ayahprofilechange',()=>{if(activeProfileId()!==owner){dispose();root.textContent='Account changed. Reopen Revision Lab to start a new flight.';}});
  listen(reduced,'change',paint);
  root.querySelectorAll('[data-steer]').forEach(b=>b.onclick=()=>{send({type:'lane',direction:Number(b.dataset.steer)});field.focus({preventScroll:true});});
  root.querySelector('[data-flow-stay]').onclick=()=>{send({type:'confirm-lane'});field.focus({preventScroll:true});};
  root.querySelector('[data-flow-volume]').value=String(Math.round(readLabVolume(profileStorage)*100));
  root.querySelector('[data-flow-volume]').oninput=e=>flowAudio.setVolume(Number(e.target.value)/100);
  root.querySelector('[data-flow-stop]').onclick=()=>{flowAudioToken++;flowAudio.stop();};
  root.querySelector('[data-flow-listen]').onclick=async()=>{
    const s=game.getSnapshot();if(!s.unit)return;assistedRefs.add(s.unit.key);
    send({type:'pause'});const token=++flowAudioToken;
    try{reportStudyExposure([s.unit.key]);const ok=await flowAudio.play(freeAyah(s.unit.key).audio);if(!ok&&token===flowAudioToken&&!disposed){saveWarning='Recitation could not play. Resume whenever you are ready.';paint();}}
    catch(error){saveWarning=error.message;paint();}
  };
  root.querySelector('[data-flight-pause]').onclick=()=>send({type:'toggle'});
  root.querySelector('[data-flight-restart]').onclick=()=>send({type:'restart'});
  root.querySelector('[data-flight-exit]').onclick=()=>{dispose();onExit();};
  // Cleanup also covers DOM replacement by navigation outside the runner.
  const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});
  observer.observe(document.body,{childList:true,subtree:true});
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();observer.disconnect();pointer=null;nodes.clear();gatewayPanel.dispose();flowAudioToken++;flowAudio.dispose();game.dispose();}
  paint();
  return {start:()=>send({type:'start'}),pause:()=>send({type:'pause'}),resume:()=>send({type:'resume'}),dispatch:send,getSnapshot:()=>game.getSnapshot(),dispose};
}
