import {createFlightController} from '../../../quest/cosmic/controller.js';
import {canonicalLinkAyah,firstGrapheme} from '../../../quest/cosmic/link-content.js';
import {createLinkEvidence,weakLinkCandidates} from '../../../quest/cosmic/link-evidence.js';
import {createFlightBonuses} from '../../../quest/cosmic/bonuses.js';
import {activeProfileId,profileStorage} from '../../../learner/profile-storage.js';
import {createAudioManager} from '../services.js';
import {readLabVolume} from '../../audio-level.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import {bindPieceDrag,stopPieceDrag} from '../../../ui/piece-drag.js';
import {esc} from '../../../ui/dom.js';
import './runner.css';
import './link.css';
const digit=n=>String(n).replace(/\d/g,c=>'٠١٢٣٤٥٦٧٨٩'[Number(c)]);
export function renderLinkAyah(ayah,{end=false,opening=false,hiddenOpening=false,hiddenAll=false}={}){
  if(hiddenAll)return '<p class="link-hidden-text">Recall the complete next ayah before revealing its verified text.</p>';
  const span=end?ayah.spans.at(-1):opening?ayah.spans[0]:null;
  if(!span)return esc(ayah.text);
  const original=ayah.text.slice(span.start,span.end),inside=hiddenOpening?'<span class="link-word-blank" aria-label="Opening word hidden">•••</span>':esc(original);
  return `${esc(ayah.text.slice(0,span.start))}<mark data-link-${end?'ending':'opening'}>${inside}</mark>${esc(ayah.text.slice(span.end))}`;
}
export async function mountAyahLink(root,mission,{controller=null,client=null,mode='guided',onExit=()=>{},onRunner=null,onDefense=null,onCheckpoint=null,isCurrent=()=>true}={}){
  const owner=activeProfileId(),game=controller||await createFlightController(mission,{activity:'link',linkMode:mode,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  if(!controller)await game.prepareLink(client);
  if(!root.isConnected||owner!==activeProfileId()||!isCurrent()){if(!controller)game.dispose();return null;}
  let disposed=false,raf=0,last=0,key='',warning='',exposureBlocked=false,audioToken=0,pending=false,bonusXP=0,weak=[];
  const abort=new AbortController(),evidence=createLinkEvidence(mission,{runId:game.getSnapshot().runId}),bonuses=createFlightBonuses(mission);
  const audio=createAudioManager({owner:'cosmic-link-study',initialVolume:readLabVolume(profileStorage)});
  const unsubscribe=game.subscribe(e=>{
    evidence.record(e).then(()=>{if(!disposed&&e.type==='link:checkpoint')refreshWeak();}).catch(error=>{if(!disposed){warning=error.message;paint();}});
    if(e.type==='link:transition-correct')bonuses.record(e).then(r=>{if(!disposed){if(r.xp&&!r.duplicate)bonusXP+=r.xp;paint();}}).catch(error=>{if(!disposed){warning=error.message;paint();}});
  });
  warning=evidence.warning||'';
  root.innerHTML='<section class="ayah-link" aria-label="Ayah Link and Phrase Repair"><div class="runner-heading"><div><span class="cosmic-eyebrow">COSMIC RUSH · AYAH LINK</span><h3>Connect the ayahs</h3></div><button class="cosmic-secondary" data-link-exit>Return to mission</button></div><p>Connect consecutive ayahs without changing their canonical boundaries. Study grouping does not prescribe waqf or restart rules. Typed matching and learner self-assessment do not verify spoken recitation or update FSRS.</p><p data-link-progress></p><div data-link-body></div><div class="link-audio"><button class="cosmic-secondary" data-link-listen>Listen to both complete ayahs</button><button class="cosmic-secondary" data-link-stop>Stop recitation</button><label>Recitation volume<input data-link-volume type="range" min="0" max="100" value="50"></label></div><button class="cosmic-secondary" data-link-pause>Pause</button><button class="cosmic-secondary" data-link-restart>Restart Link set</button><p data-link-warning role="status"></p><p data-link-status role="status" aria-live="polite"></p><div data-link-weak></div></section>';
  const view=root.querySelector('.ayah-link'),body=root.querySelector('[data-link-body]');
  const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:abort.signal});
  function stopAudio(){audioToken++;audio.stop();}
  async function refreshWeak(){try{weak=await weakLinkCandidates(evidence.snapshot(),{refs:mission.refs,limit:5});if(!disposed)root.querySelector('[data-link-weak]').innerHTML=weak.length?`<details><summary>Transition practice notes</summary>${weak.map(w=>`<p><strong>${esc(w.pairKey)}</strong> · ${esc(w.reason)}</p>`).join('')}</details>`:'';}catch(error){warning=error.message;if(!disposed)root.querySelector('[data-link-warning]').textContent=warning;}}
  function card(ayah,which,s){
    const hidden=which==='next'&&!s.revealed&&!['demonstration','linking','success','reactor','checkpoint'].includes(s.status);
    return `<article class="link-ayah-card"><h4>${esc(ayah.name)} · ${ayah.ref}</h4><div class="link-arabic" lang="ar" dir="rtl" data-link-text="${which}">${renderLinkAyah(ayah,{end:which==='previous',opening:which==='next',hiddenOpening:hidden,hiddenAll:hidden&&s.mode==='extended'})}</div><span class="link-verse-marker" lang="ar" aria-label="Canonical ayah ${ayah.ayah}">۝${digit(ayah.ayah)}</span></article>`;
  }
  function paint(){
    if(disposed)return;const s=game.getSnapshot(),p=s.pair;view.dataset.linkState=s.status;view.dataset.pair=p.pairKey||'foundation';view.dataset.mode=s.mode;
    const exposed=[];
    if(!['ready','paused'].includes(s.status)){
      if(p.previous)exposed.push(p.fromRef);
      const hidden=!s.revealed&&!['demonstration','linking','success','reactor','checkpoint'].includes(s.status);
      if(!hidden||s.hints>0||s.mode!=='extended'&&p.target.words.length>1)exposed.push(p.toRef);
      if(s.status==='gateway')exposed.push(...s.choices.map(w=>w.key));
      if(s.status==='reactor')exposed.push(...s.tiles.map(t=>t.reference));
    }
    try{reportStudyExposure([...new Set(exposed)]);exposureBlocked=false;}catch(error){warning=error.message;exposureBlocked=true;}
    root.querySelector('[data-link-progress]').textContent=`Stage ${s.stageIndex+1} / ${s.stageCount} · Round ${s.roundIndex+1} / ${s.roundCount} · Checkpoint ${s.cursor+1} / ${s.pairCount} · ${s.mistakes} corrections · ${s.arcadeScore} arcade points · ${bonusXP} bonus XP`;
    root.querySelector('[data-link-warning]').textContent=warning;
    const phase=['demonstration','linking'].includes(s.status)?'demo':s.status;
    const nextKey=JSON.stringify([phase,s.cursor,s.mode,s.hints,s.revealed,s.choice,s.order,s.reason,exposureBlocked,p.plan.revision]);
    if(key!==nextKey){
      key=nextKey;stopPieceDrag();
      if(exposureBlocked){body.innerHTML='<h4>Study assistance needs recovery</h4><p>The verified text is hidden until exposure can be recorded.</p><button class="cosmic-secondary" data-link-recover>Retry showing the workspace</button>';body.querySelector('button').onclick=()=>{key='';paint();};return;}
      if(s.status==='ready')body.innerHTML='<h4>Ready to link?</h4><p>Use a guided demonstration, opening-word recognition, typed recall or self-assessed spoken comparison. No speech verification is implied.</p><button class="cosmic-primary" data-link-start>Start Ayah Link</button>';
      else if(s.status==='paused')body.innerHTML='<h4>Link practice paused</h4><button class="cosmic-primary" data-link-resume>Resume Ayah Link</button>';
      else{
        const board=`<div class="link-pair-board ${s.markersVisible?'':'markers-hidden'} ${s.linked?'is-connected':''}" data-link-board>${p.previous?card(p.previous,'previous',s):`<p class="link-foundation">${mission.refs.length>1?'Prepare this first long ayah before linking it to the next. This is a study checkpoint, not an adjacent-pair result.':'Only one ayah is selected. No adjacent pair is invented. Choose at least two ayahs to practice a transition.'}</p>`}${card(p.target,'next',s)}<svg class="link-luminous" aria-hidden="true"><path data-link-path/></svg></div><button class="cosmic-secondary" data-link-markers>${s.markersVisible?'Hide':'Restore'} verse markers</button>`;
        const hints=s.hints?`<aside class="link-hint" role="status">${s.hints===1?`Meaning cue: ${esc(p.target.words[0].translation)}`:s.hints===2?`Opening letter: <span lang="ar" dir="rtl">${esc(firstGrapheme(p.target.words[0].text))}</span>`:`Opening word: <span lang="ar" dir="rtl">${esc(p.target.words[0].text)}</span>`}</aside>`:'';
        let action='';
        if(phase==='demo')action='<p>Notice the ending word and the next opening word. The verse markers are annotations; the underlying ayahs remain distinct.</p><button class="cosmic-primary" data-link-connect>Connect the ayahs</button><button class="cosmic-secondary" data-link-skip>Skip animation · recall opening</button>';
        if(s.status==='recall')action=`<h4>${s.mode==='extended'?'Recall the next complete ayah':'Recall the next opening word'}</h4><p>Say both ayahs aloud at your own pace. No time limit.</p>${['guided','recognition'].includes(s.mode)?'<button class="cosmic-primary" data-link-choices>Ready · show word gateways</button>':'<form data-link-answer><label>Type from memory<input data-link-typed lang="ar" dir="rtl" autocomplete="off" aria-label="Recall answer"></label><button class="cosmic-primary" type="submit">Check typed recall</button></form><button class="cosmic-secondary" data-link-recited>I recited · reveal for self-comparison</button>'}`;
        if(s.status==='gateway'||s.status==='crossing')action=`<div class="link-gateway-scene" tabindex="0" role="group" aria-label="Steer the ship to an opening-word gateway; arrows move, Enter opens the selected route.">${(s.status==='gateway'?s.choices:[]).map((w,i)=>`<button class="link-portal ${i===s.choice?'is-selected':''}" data-link-choice="${i}" data-word-id="${esc(w.id)}" aria-pressed="${i===s.choice}"><span lang="ar" dir="rtl">${esc(w.text)}</span><small>Gateway ${i+1}</small></button>`).join('')}<span class="link-gateway-ship" data-link-ship aria-hidden="true">➤</span><div class="link-gateway-route" aria-hidden="true"></div></div>${s.status==='gateway'?'<div class="link-steering"><button class="cosmic-secondary" data-link-left aria-label="Steer Link gateway left">←</button><button class="cosmic-primary" data-link-enter>Enter selected gateway</button><button class="cosmic-secondary" data-link-right aria-label="Steer Link gateway right">→</button></div>':'<p>Gateway connected · <button class="cosmic-secondary" data-link-finish-animation>Skip crossing animation</button></p>'}`;
        if(s.status==='repair')action='<div class="link-repair" role="status"><h4>Repair this connection</h4><p>This attempt did not match the verified continuation. Listen, use a hint and try again. Earlier links remain.</p><button class="cosmic-primary" data-link-retry>Retry opening recall</button></div>';
        if(s.status==='comparison')action='<h4>Self-assessed spoken comparison</h4><p>Compare with the original text above. This is your assessment, not automatic pronunciation verification.</p><button class="cosmic-primary" data-link-self-match>My recitation matched</button><button class="cosmic-secondary" data-link-self-again>I need more practice</button>';
        if(s.status==='reactor'){
          const tile=(t,i,zone)=>`<div class="piece-wrap"><button class="link-reactor-tile" draggable="true" data-word="${i}" data-zone="${zone}" lang="ar" dir="rtl">${esc(t.text)}</button></div>`;
          action=`<section class="link-reactor"><h4>Broken Verse Reactor</h4><p>${esc(p.plan.reason)}</p><p>${p.plan.kind==='reviewed-phrases'?'Use the reviewed components exactly as supplied.':'Whole-ayah fallback: select the complete correct ayah; unapproved phrase boundaries are not used.'}</p><div class="reactor-cell" aria-hidden="true"><i data-reactor-fill></i><span>✦</span></div><progress data-reactor-progress max="1" value="${s.charge}" aria-label="Canonical reactor charge"></progress><div class="link-reactor-build" data-drop="build" dir="rtl" aria-label="Reactor assembly">${s.order.map(i=>tile(s.tiles[i],i,'selected')).join('')||'<span>Place components here in canonical order</span>'}</div><div class="link-reactor-bank" data-drop="bank" dir="rtl" aria-label="Available reactor components">${s.tiles.map((t,i)=>s.order.includes(i)?'':tile(t,i,'bank')).join('')}</div><button class="cosmic-primary" data-link-check-reactor>Check reactor sequence</button><p role="status">${esc(s.reason)}</p></section>`;
        }
        if(s.status==='success')action=`<div class="link-success"><h4>Connection restored · reactor charged</h4><p>Recite both complete ayahs together. Their canonical boundaries and appropriate waqf rules remain unchanged.</p><p>${s.outcome==='self-assessed-spoken'?'Spoken result is learner self-assessed.':'Correctness here concerns the selected or typed text, not certified spoken recitation.'}</p><button class="cosmic-primary" data-link-continue>Continue Link practice</button></div>`;
        if(s.status==='checkpoint')action=`<h4>Link checkpoint complete</h4><p>${s.routeComplete?'All Link checkpoints in this route were practiced.':'This checkpoint is complete; other activity checkpoints are tracked separately.'} No arcade result certifies long-term memorization.</p>${onCheckpoint?'<button class="cosmic-primary" data-link-expedition>Continue expedition</button>':''}${onRunner?'<button class="cosmic-primary" data-link-runner>Continue in Star Runner</button>':''}${onDefense?'<button class="cosmic-secondary" data-link-defense>Continue in Meteor Defense</button>':''}${!onCheckpoint&&!s.atRouteEnd?'<button class="cosmic-primary" data-link-next>Next Link round or ayah set</button>':''}${!onCheckpoint?'<button class="cosmic-secondary" data-link-replay>Replay this Link set</button>':''}`;
        body.innerHTML=board+action+hints+(['recall','gateway','repair','comparison'].includes(s.status)&&s.hints<3?'<button class="cosmic-secondary" data-link-hint>More help · next hint</button>':'');
      }
      bind();
    }
    const connect=body.querySelector('[data-link-connect]');if(connect)connect.disabled=s.status!=='demonstration';
    const board=body.querySelector('[data-link-board]');if(board){board.classList.toggle('markers-hidden',!s.markersVisible);board.classList.toggle('is-connected',s.linked);const markers=body.querySelector('[data-link-markers]');markers.textContent=`${s.markersVisible?'Hide':'Restore'} verse markers`;drawConnection();}
    const ship=body.querySelector('[data-link-ship]');if(ship){ship.style.left=`${s.shipX*100}%`;ship.style.bottom=`${s.status==='crossing'?10+s.travel/.7*70:10}%`;}
    const enter=body.querySelector('[data-link-enter]');if(enter)enter.disabled=Math.abs(s.shipX-[.2,.5,.8][s.choice])>=.04;
    const fill=body.querySelector('[data-reactor-fill]');if(fill)fill.style.setProperty('--charge',`${s.charge*100}%`);
    root.querySelector('[data-link-pause]').textContent=s.status==='paused'?'Resume':'Pause';
    const status=root.querySelector('[data-link-status]'),message=s.reason||({demonstration:'Study the complete ayahs',linking:'Canonical boundaries remain intact',recall:'Recall at your own pace',gateway:'Steer and enter the word gateway',crossing:'Connection opening',reactor:'Rebuild the verified ayah',success:'Recite the ayahs together',checkpoint:'Link checkpoint saved'})[s.status]||'';if(status.textContent!==message)status.textContent=message;
  }
  function drawConnection(){const board=body.querySelector('[data-link-board]'),from=board?.querySelector('[data-link-ending]'),to=board?.querySelector('[data-link-opening]'),svg=board?.querySelector('svg'),path=board?.querySelector('[data-link-path]');if(!from||!to||!path)return;const r=board.getBoundingClientRect(),a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x1=a.left-r.left+a.width/2,y1=a.top-r.top+a.height/2,x2=b.left-r.left+b.width/2,y2=b.top-r.top+b.height/2;svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);path.setAttribute('d',`M${x1} ${y1} C${x1} ${(y1+y2)/2},${x2} ${(y1+y2)/2},${x2} ${y2}`);}
  function bind(){
    const actions={'start':'start','connect':'connect','skip':'hide-opening','choices':'choices','retry':'retry','hint':'hint','markers':'markers','resume':'resume','continue':'continue','check-reactor':'check-reactor','recited':'recited','replay':'restart'};
    for(const [name,type] of Object.entries(actions))body.querySelector(`[data-link-${name}]`)?.addEventListener('click',()=>send({type}));
    body.querySelector('[data-link-answer]')?.addEventListener('submit',e=>{e.preventDefault();send({type:'submit-text',text:body.querySelector('[data-link-typed]').value});});
    body.querySelector('[data-link-self-match]')?.addEventListener('click',()=>send({type:'assess',match:true}));body.querySelector('[data-link-self-again]')?.addEventListener('click',()=>send({type:'assess',match:false}));
    body.querySelectorAll('[data-link-choice]').forEach(b=>b.onclick=()=>{send({type:'select',choice:Number(b.dataset.linkChoice)});body.querySelector('.link-gateway-scene')?.focus({preventScroll:true});});
    body.querySelector('[data-link-left]')?.addEventListener('click',()=>send({type:'lane',direction:-1}));body.querySelector('[data-link-right]')?.addEventListener('click',()=>send({type:'lane',direction:1}));body.querySelector('[data-link-enter]')?.addEventListener('click',()=>send({type:'enter'}));
    body.querySelector('[data-link-finish-animation]')?.addEventListener('click',()=>{for(let i=0;i<4;i++)game.dispatch({type:'tick',dt:.25});paint();schedule();});
    body.querySelector('[data-link-expedition]')?.addEventListener('click',()=>onCheckpoint?.(game.getSnapshot()));
    body.querySelector('[data-link-runner]')?.addEventListener('click',()=>onRunner?.());body.querySelector('[data-link-defense]')?.addEventListener('click',()=>onDefense?.());
    body.querySelector('[data-link-next]')?.addEventListener('click',async()=>{if(pending)return;pending=true;stopAudio();try{await game.prepareLink(client,true);if(!disposed){game.nextStage();key='';paint();schedule();}}catch(error){warning=error.message;paint();}finally{pending=false;}});
    if(game.getSnapshot().status==='reactor'){
      body.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{const s=game.getSnapshot(),id=Number(b.dataset.word);send({type:'arrange',order:s.order.includes(id)?s.order.filter(i=>i!==id):[...s.order,id]});});
      bindPieceDrag(body,{selection:()=>game.getSnapshot().order,count:game.getSnapshot().tiles.length,locked:()=>disposed||game.getSnapshot().status!=='reactor',change:order=>send({type:'arrange',order})});
    }
  }
  function animated(s){return ['linking','crossing'].includes(s.status)||s.status==='gateway'&&Math.abs(s.shipX-[.2,.5,.8][s.choice])>.001;}
  function frame(now){raf=0;if(disposed||!root.isConnected){dispose();return;}const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(dt)game.dispatch({type:'tick',dt});paint();schedule();}
  function schedule(){if(!disposed&&!raf&&animated(game.getSnapshot()))raf=requestAnimationFrame(frame);}
  function send(action){if(disposed||exposureBlocked)return;stopAudio();game.dispatch(action);paint();schedule();}
  listen(view,'keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return;const s=game.getSnapshot();if(s.status==='gateway'){const dir=({ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1})[e.code];if(dir){e.preventDefault();send({type:'lane',direction:dir});}else if(['Space','Enter'].includes(e.code)&&!e.target.closest('button')){e.preventDefault();send({type:'enter'});}}});
  listen(window,'resize',drawConnection);listen(window,'blur',()=>send({type:'pause'}));listen(document,'visibilitychange',()=>{if(document.hidden)send({type:'pause'});});listen(window,'ayahprofilechange',()=>{if(activeProfileId()!==owner){dispose();root.textContent='Account changed. Reopen Revision Lab.';}});
  root.querySelector('[data-link-exit]').onclick=()=>{dispose();onExit();};root.querySelector('[data-link-pause]').onclick=()=>send({type:game.getSnapshot().status==='paused'?'resume':'pause'});root.querySelector('[data-link-restart]').onclick=()=>send({type:'restart'});
  root.querySelector('[data-link-volume]').value=String(Math.round(readLabVolume(profileStorage)*100));root.querySelector('[data-link-volume]').oninput=e=>audio.setVolume(Number(e.target.value)/100);root.querySelector('[data-link-stop]').onclick=stopAudio;
  root.querySelector('[data-link-listen]').onclick=async()=>{
    const p=game.getSnapshot().pair,refs=[p.fromRef,p.toRef].filter(Boolean);stopAudio();const token=audioToken;
    try{reportStudyExposure(refs);game.dispatch({type:'assistance',category:'full-ayah-audio'});paint();}catch(error){warning=error.message;paint();return;}
    const next=async i=>{if(disposed||token!==audioToken||i>=refs.length)return;const ok=await audio.play(canonicalLinkAyah(refs[i]).audio,{onEnded:()=>next(i+1)});if(!ok&&!disposed&&token===audioToken){warning='Full-ayah recitation could not play. Retry without a time limit.';paint();}};next(0);
  };
  const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();observer.disconnect();stopPieceDrag();stopAudio();audio.dispose();unsubscribe();if(!controller)game.dispose();}
  paint();refreshWeak();return {pause:()=>send({type:'pause'}),resume:()=>send({type:'resume'}),dispose,getSnapshot:()=>game.getSnapshot()};
}
