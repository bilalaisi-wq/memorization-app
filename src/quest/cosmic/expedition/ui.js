import {mountConstellationReveal} from '../celebration.js';
import {captureCosmicFocus,restoreCosmicFocus} from '../focus.js';
import {mountCosmicControls,cosmicReducedMotion} from '../preferences.js';
import {createAdaptiveStore,difficultyModels} from '../adaptive.js';
import {expeditionWeakLinks} from './weakness.js';
import {createRewardStore} from '../../../rewards/store.js';
import {sha256} from '../../../../supabase/functions/_shared/content-policy.js';
import {bossBlueprint,restoreBossQuestions} from './boss-restore.js';
import {createFlightBonuses} from '../bonuses.js';
import {esc} from '../../../ui/dom.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
import {appearanceAccount} from '../../../learner/accounts.js';
import {createFlightController} from '../controller.js';
import {prepareLinkPlans} from '../link-content.js';
import {createLinkEvidence,weakLinkCandidates} from '../link-evidence.js';
import {createExpeditionStore,expeditionTasks,activeExpeditionTasks,expeditionCoverage} from './store.js';
import {bossQuestions} from './boss.js';
import {createFinalRecall} from './recall.js';
import {createAudioManager} from '../../../puzzles/arcade/services.js';
import {readLabVolume} from '../../../puzzles/audio-level.js';
import {freeAyah} from '../gateways.js';
import {createPassageMemory} from '../../../passage/memory.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import './expedition.css';
const labels={runner:'Star Runner',defense:'Meteor Defense',link:'Ayah Link',boss:'Weak-Link Sentinel'};
export async function mountExpedition(root,mission,{rounds=1,slow=false,guidance=true,pickupMode='mixed',onExit=()=>{},isCurrent=()=>true}={}){
  const owner=activeProfileId(),store=createExpeditionStore(),adaptive=createAdaptiveStore(),abort=new AbortController();let disposed=false,generation=0,child=null,director=null,unsubscribe=()=>{},recall=null,warning='',recallAudio=null,audioEpoch=0,controls=null;
  const opened=await store.open(mission,rounds,{slow,guidance,pickupMode});
  if(opened.settings)({slow,guidance,pickupMode}=opened.settings);
  if(!root.isConnected||!isCurrent()||owner!==activeProfileId())return null;
  const current=()=>!disposed&&root.isConnected&&owner===activeProfileId()&&isCurrent();
  const saved=()=>store.snapshot().runs[mission.id];
  function clear(){generation++;unsubscribe();unsubscribe=()=>{};child?.dispose();child=null;recall=null;director?.dispose();director=null;audioEpoch++;recallAudio?.dispose();recallAudio=null;}
  function note(error){warning=error.message||String(error);const n=root.querySelector('[data-exp-warning]');if(n)n.textContent=warning;}
  function shell(){controls?.dispose();root.innerHTML=`<section class="cosmic-expedition"><div class="runner-heading"><div><span class="cosmic-eyebrow">COSMIC RUSH · SAVED EXPEDITION</span><h3>${esc(freeAyah(mission.refs[0]).name)} · ${mission.first}–${mission.last}</h3></div><button class="cosmic-secondary" data-exp-exit>Save and return to mission</button></div><p data-exp-warning role="alert">${esc(warning)}</p><div data-exp-host></div></section>`;root.querySelector('[data-exp-exit]').onclick=()=>{dispose();onExit();};controls=mountCosmicControls(root.querySelector('.cosmic-expedition'));return root.querySelector('[data-exp-host]');}
  function overview(){
    clear();if(!current())return;const r=saved(),tasks=activeExpeditionTasks(mission,r),coverage=expeditionCoverage(mission,r),task=tasks[r.completed.length],host=shell();
    host.innerHTML=`<h4 tabindex="-1">Your constellation route</h4><p>${coverage.stages} / ${coverage.totalStages} stages saved · ${coverage.refs.length} / ${mission.refs.length} ayahs accounted for · ${coverage.links.length} / ${Math.max(0,mission.refs.length-1)} internal links practiced</p><div class="exp-stage-map" role="list">${mission.stages.map((s,i)=>{const done=tasks.filter(t=>t.stageIndex===i).every(t=>r.completed.includes(t.id));return `<article role="listitem" class="exp-stage ${done?'is-complete':task?.stageIndex===i?'is-current':''}"><span aria-hidden="true">${done?'✦':'✧'}</span><h4>Stage ${i+1}</h4><p>Ayahs ${s.first}–${s.last}</p><p>${done?'Saved checkpoint':task?.stageIndex===i?'Current stage':'Ahead on your route'}</p><small>Runner → Defense → Link → Sentinel</small></article>`;}).join('')}</div><p>Stages group approximately five ayahs. Mission grouping does not prescribe recitation stops. Completed activities stay saved; an interrupted activity restarts safely.</p>${task?`<p>Next: stage ${task.stageIndex+1} · ${labels[task.activity]}${task.activity==='runner'?` · round ${task.roundIndex+1}/${r.rounds}`:''}</p><button class="cosmic-primary" data-exp-resume>Resume expedition · ${labels[task.activity]}</button>`:`<h4>Gameplay route complete</h4><p>${r.final?.result?'A self-assessed recall result is recorded separately below.':'Final oral recall is still pending. Gameplay does not certify memorization.'}</p><button class="cosmic-primary" data-exp-final>${r.final?.result?'View recall assessment':'Continue to final oral recall'}</button>`}`;
    if(coverage.gameplayComplete)mountConstellationReveal(host,mission,coverage);
    host.querySelector('[data-exp-resume]')?.addEventListener('click',()=>launch().catch(note));host.querySelector('[data-exp-final]')?.addEventListener('click',()=>final().catch(note));host.querySelector('h4').focus({preventScroll:true});
  }
  async function launch(){
    clear();const epoch=generation,run=saved(),task=activeExpeditionTasks(mission,run)[run.completed.length];if(!task){await final();return;}const host=shell(),valid=()=>current()&&epoch===generation;
    host.innerHTML='<p role="status">Preparing verified passage and checkpoint…</p>';
    const evidence=createLinkEvidence(mission);let weak=[];try{weak=await weakLinkCandidates(evidence.snapshot(),{refs:mission.refs});weak=await expeditionWeakLinks(mission,store.snapshot(),weak);}catch(e){note(e);}if(!valid())return;
    const decision=store.decision(mission,task.id,difficultyModels(mission.stages[task.stageIndex].refs,adaptive.snapshot(),createPassageMemory(profileStorage).snapshot(),weak));
    const effectiveSlow=slow||decision.arcade.slow;
    const complete=()=>{if(!valid())return;try{store.complete(mission,task.id);overview();}catch(e){note(e);}};
    if(task.activity==='boss'){
      const plans=await prepareLinkPlans(mission.stages[task.stageIndex].refs,appearanceAccount().client);if(!valid())return;
      let questions=await bossQuestions(mission,task.stageIndex,plans,weak,{extended:decision.memory.extended});if(!valid())return;
      const old=saved().boss[task.id],supported=decision.memory.level==='supported';
      const ordered=decision.memory.extended?[...questions].sort((a,b)=>(b.kind==='opening'||b.kind==='multi')-(a.kind==='opening'||a.kind==='multi')):questions;
      const blueprint=store.pinBoss(mission,task.id,bossBlueprint(ordered)),pinned=await restoreBossQuestions(mission,task.stageIndex,plans,blueprint);if(!valid())return;
      const bonuses=createFlightBonuses(mission);
      const {mountWeakBoss}=await import('./boss-ui.js');if(!valid())return;
      child=mountWeakBoss(host,{questions:pinned,cleared:old?.cleared||[],save:event=>store.boss(mission,task.id,event),onEvent:event=>{try{adaptive.record({...event,type:`boss:${event.type}`,runId:run.runId,stageIndex:task.stageIndex,roundIndex:0});}catch(e){note(e);}if(event.type==='correct')bonuses.record({type:'boss:memory-correct',targetRef:event.refs.at(-1),stageIndex:task.stageIndex,roundIndex:0,questionId:event.questionId}).catch(note);},onExit:overview,evidenceStrength:`${decision.memory.level} memory demand · ${decision.memory.reason}`,onComplete:s=>{if(s.status==='checkpoint')complete();}});return;
    }
    root.querySelector('[data-exp-warning]').textContent=`Arcade: ${decision.arcade.reason} Memory: ${decision.memory.reason}`;
    const stageRounds=Math.max(1,...activeExpeditionTasks(mission,run).filter(t=>t.activity==='runner'&&t.stageIndex===task.stageIndex).map(t=>t.roundIndex+1));
    const next=await createFlightController(mission,{initialStage:task.stageIndex,initialRound:task.roundIndex,activity:task.activity,pickupMode:task.activity==='runner'?pickupMode:null,rounds:stageRounds,slow:effectiveSlow,defenseConfig:decision.arcade.configuration,linkMode:decision.memory.linkMode,compact:matchMedia('(max-width:600px)').matches,reducedMotion:cosmicReducedMotion()});
    if(!valid()){next.dispose();return;}director=next;
    if(task.activity==='link'){await director.prepareLink(appearanceAccount().client);if(!valid())return;}
    // Save immediately on genuine engine completion, before the learner leaves the screen.
    let completed=false;unsubscribe=director.subscribe(e=>{try{adaptive.record({...e,targetRef:e.targetRef||mission.stages[task.stageIndex].refs.at(-1)},{...director.getSnapshot(),slow:effectiveSlow});}catch(error){note(error);}if(e.type===`${task.activity}:checkpoint`&&!completed){try{store.complete(mission,task.id);completed=true;}catch(error){note(error);}}});
    const onCheckpoint=()=>{if(director?.getSnapshot().status!=='checkpoint')return;complete();};
    const options={controller:director,configuration:decision.arcade.configuration,onExit:overview,onCheckpoint,isCurrent:valid};
    const module=await (task.activity==='runner'?import('../../../puzzles/arcade/cosmic/ui.js'):task.activity==='defense'?import('../../../puzzles/arcade/cosmic/defense-ui.js'):import('../../../puzzles/arcade/cosmic/link-ui.js'));if(!valid())return;const {mountStarRunner,mountMeteorDefense,mountAyahLink}=module;
    const view=task.activity==='runner'?await mountStarRunner(host,mission,{...options,slow:effectiveSlow,guidance,pickupMode,rounds:run.rounds}):task.activity==='defense'?await mountMeteorDefense(host,mission,options):await mountAyahLink(host,mission,{...options,client:appearanceAccount().client});
    if(!valid())view?.dispose();else child=view;
  }
  async function final(){
    clear();const epoch=generation;recall=await createFinalRecall(mission,store);if(!current()||epoch!==generation)return;drawFinal();
  }
  async function rewardFinal(s){try{const id=await sha256(JSON.stringify(['cosmic-final',mission.id,s.attemptId]));if(owner!==activeProfileId())return;createRewardStore(profileStorage).award({mode:'passage-recall',unit:s.unitId,action:'assessment',xp:s.result.independent?10:3,receiptId:`quest:${id}`});}catch(e){if(current())note(e);}}
  function drawFinal(){
    if(!current())return;const host=shell();let s;try{s=recall.snapshot();}catch(e){note(e);host.innerHTML='<p>The saved recall needs recovery. Earlier gameplay remains saved.</p><button class="cosmic-secondary" data-exp-overview>Return to route</button>';host.querySelector('button').onclick=overview;return;}
    host.innerHTML=`<h4>Final oral recall · self-assessed recitation</h4><p>Assigned passage: ${esc(mission.refs[0])}–${esc(mission.refs.at(-1))}. No automatic speech verification is performed. Gameplay completion and recall assessment are separate.</p>`;
    if(s.status==='ready')host.innerHTML+='<p>All Quran text is hidden. When ready, begin and recite the assigned passage from memory.</p><button class="cosmic-primary" data-final-begin>Begin independent passage recall</button>';
    if(['hidden','declared'].includes(s.status))host.innerHTML+=`<p>Recite at your own pace, respecting canonical ayah boundaries. There is no timer.</p>${s.status==='hidden'?'<button class="cosmic-primary" data-final-declare>I recited the passage from memory</button>':'<button class="cosmic-primary" data-final-reveal>Reveal verified text and compare</button>'}<button class="cosmic-secondary" data-final-audio>Listen to passage · study assistance</button>`;
    if(s.status==='comparison'){
      try{reportStudyExposure(mission.refs);host.innerHTML+=`<div class="exp-comparison">${mission.refs.map(ref=>`<article><strong>${esc(ref)}</strong><p class="exp-arabic" dir="rtl" lang="ar">${esc(freeAyah(ref).text)}</p><button class="cosmic-secondary" data-final-listen="${ref}">Listen to complete ayah ${ref}</button></article>`).join('')}</div><p>Compare your attempt, then choose your own rating. Assistance and early reviews follow the existing FSRS rules.</p><div class="exp-ratings">${['Again','Hard','Good','Easy'].map(g=>`<button class="cosmic-primary" data-final-grade="${g}">${g}</button>`).join('')}</div>`;}catch(e){note(e);host.innerHTML+='<p>Comparison is hidden until assistance tracking is recovered.</p><button class="cosmic-secondary" data-final-refresh>Retry comparison</button>';}
    }
    if(s.status==='graded')rewardFinal(s);
    if(s.status==='graded')host.innerHTML+=`<div class="exp-finish"><span aria-hidden="true">✦ ─ ✧ ─ ✦</span><h4>Expedition completed · recall assessed</h4><p>Your rating: ${esc(s.result.grade)} · ${s.result.independent?'Independent self-assessed attempt':'Assisted practice assessment'}</p><p>${s.result.nextReview?`Next review: ${esc(new Date(s.result.nextReview).toLocaleString())}`:'No independent review date was created by assisted practice.'}</p><p>This does not certify tajweed or long-term memorization. Again is useful feedback, not a loss of game progress.</p></div>`;
    host.innerHTML+='<button class="cosmic-secondary" data-final-stop>Stop recitation</button><label>Recitation volume<input data-final-volume type="range" min="0" max="100" value="50"></label><button class="cosmic-secondary" data-exp-overview>Save and return to constellation route</button><p data-final-note role="status"></p>';
    if(s.status==='graded')mountConstellationReveal(host,mission,expeditionCoverage(mission,saved()));
    const action=fn=>()=>{const focus=captureCosmicFocus(root);try{audioEpoch++;recallAudio?.stop();fn();drawFinal();restoreCosmicFocus(root,focus);}catch(e){note(e);}};
    host.querySelector('[data-final-begin]')?.addEventListener('click',action(()=>recall.begin()));host.querySelector('[data-final-declare]')?.addEventListener('click',action(()=>recall.action('declared')));host.querySelector('[data-final-reveal]')?.addEventListener('click',action(()=>recall.action('compared')));host.querySelector('[data-final-refresh]')?.addEventListener('click',drawFinal);
    host.querySelectorAll('[data-final-grade]').forEach(b=>b.onclick=action(()=>recall.grade(b.dataset.finalGrade)));host.querySelector('[data-exp-overview]').onclick=overview;
    const audio=()=>recallAudio??=createAudioManager({owner:'cosmic-final-recall',initialVolume:readLabVolume(profileStorage)});
    host.querySelector('[data-final-volume]').value=String(Math.round((recallAudio?.getVolume()??readLabVolume(profileStorage))*100));
    host.querySelector('[data-final-stop]').onclick=()=>{audioEpoch++;recallAudio?.stop();};host.querySelector('[data-final-volume]').oninput=e=>audio().setVolume(Number(e.target.value)/100);
    async function play(refs){try{recall.action('assisted');reportStudyExposure(refs);audioEpoch++;audio().stop();const epoch=audioEpoch;const next=async i=>{if(!current()||epoch!==audioEpoch||i>=refs.length)return;const ok=await audio().play(freeAyah(refs[i]).audio,{onEnded:()=>next(i+1)});if(!ok&&current())note('Recitation unavailable; retry when ready.');};next(0);}catch(e){note(e);}}
    host.querySelector('[data-final-audio]')?.addEventListener('click',()=>play(mission.refs));host.querySelectorAll('[data-final-listen]').forEach(b=>b.onclick=()=>play([b.dataset.finalListen]));
  }
  function dispose(){if(disposed)return;disposed=true;clear();controls?.dispose();abort.abort();observer.disconnect();}
  const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('ayahprofilechange',()=>{if(owner!==activeProfileId()){dispose();root.textContent='Account changed. Reopen Revision Lab.';}},{signal:abort.signal});
  const pause=()=>{if(!child&&!recall){overview();return;}child?.pause();audioEpoch++;recallAudio?.stop();};window.addEventListener('blur',pause,{signal:abort.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},{signal:abort.signal});
  overview();return {isExpedition:true,dispose,pause,getSnapshot:()=>saved()};
}
