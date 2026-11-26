import {passageRun} from './continuous/model.js';
import {revisionBatchStore} from './batch-store.js';
import {profileStorage} from '../learner/profile-storage.js';
import {cosmicReducedMotion} from '../quest/cosmic/preferences.js';
import {repairMissions} from '../quest/cosmic/repair.js';
import {COSMIC_EXPEDITIONS_ENABLED} from '../quest/cosmic/release.js';
import '../quest/cosmic/polish.css';
import {createExpeditionStore} from '../quest/cosmic/expedition/store.js';
import {LINK_MODES} from '../puzzles/arcade/cosmic/link.js';
import {appearanceAccount} from '../learner/accounts.js';
import { esc, clearLearningView } from '../ui/dom.js';
import { cosmicSurahs, createMission, objectives } from '../quest/cosmic/mission.js';
import './revision.css';
import {createFlightController} from '../quest/cosmic/controller.js';
import {DEFENSE_CONFIGS} from '../puzzles/arcade/cosmic/defense.js';
let cleanup = () => {}, pause = () => {};
export function stopRevisionLab() { cleanup(); cleanup = () => {}; pause = () => {}; }
export function pauseRevisionLab() { pause(); }

export function mountRevisionLab(main,{selectedPassage=null,onMissionSelection=()=>{}}={}) {
  stopRevisionLab();
  let flight = null, director=null;
  cleanup = () => { generation++; flight?.dispose();director?.dispose();director=null; };
  pause = () => {
    if(!flight)generation++; flight?.pause();
    // An overlay may interrupt source validation before a flight exists.
    main.querySelectorAll('[data-launch-runner],[data-launch-defense],[data-launch-capture],[data-launch-link],[data-launch-expedition]').forEach(b=>b.disabled=false);
  };
  clearLearningView(main);
  main.querySelector('.page-heading h1').textContent = 'Revision Lab';
  const root = document.createElement('section');
  root.className = 'cosmic-rush';
  root.setAttribute('aria-label', 'Revision Lab');
  main.append(root);
  let generation = 0,atSelection=false,atPlanner=false;
  const practiceSwitch=e=>{if(root.__ayahRevisionActions&&['runner','defense','link'].includes(e.detail?.activity))void Promise.resolve(root.__ayahRevisionActions.switch(e.detail.activity)).catch(error=>{if(root.isConnected){const note=document.createElement('p');note.setAttribute('role','alert');note.textContent=error.message;root.append(note);}});};root.addEventListener('ayah-practice-switch',practiceSwitch);const disposeRevision=cleanup;cleanup=()=>{delete root.__ayahRevisionActions;delete root.__ayahContinuous;delete root.__ayahContinuousError;delete root.__ayahRestartChallenge;delete root.__ayahDifficulty;root.removeEventListener('ayah-practice-switch',practiceSwitch);disposeRevision();};
  const restored=()=>{if((atSelection||atPlanner)&&root.isConnected)savedRoutes();};window.addEventListener('ayahcosmicrestored',restored);
  const oldCleanup=cleanup;cleanup=()=>{window.removeEventListener('ayahcosmicrestored',restored);oldCleanup();};
  async function missions(){
    const token=++generation;atPlanner=false;atSelection=false;flight?.dispose();director?.dispose();director=null;flight=null;
    try{const {mountRevisionMissions}=await import('./missions/ui.js');if(token!==generation||!root.isConnected)return;flight=mountRevisionMissions(root,{client:appearanceAccount().client,refs:selectedPassage?.refs||null,defaultGame:selectedPassage?'runner':'snake',isCurrent:()=>token===generation,onExit:selection});}catch(e){if(token===generation){planner();const p=document.createElement('p');p.textContent=e.message;root.append(p);}}
  }
  function missionEntry(){const b=document.createElement('button');b.className='cosmic-secondary';b.dataset.revisionMissions='';b.textContent='Memory Rescue & Long-Surah Marathon';b.onclick=missions;root.prepend(b);}
  function selection() {
    delete root.__ayahRevisionActions;delete root.__ayahContinuous;delete root.__ayahContinuousError;delete root.__ayahRestartChallenge;delete root.__ayahDifficulty;
    atSelection=true;atPlanner=false;
    generation++;
    flight?.dispose();director?.dispose();flight=null;director=null;
    const cards=[['runner','✧','Star Runner','Fly through space and collect the correct Qur’an words.','Word order and supported revision'],['defense','☄','Meteor Defense','Protect your star and capture the right words.','Recognize the next word group'],['link','✦','Ayah Link','Connect the end of one ayah to the beginning of the next.','Adjacent-ayah connections'],['cosmic','✴','Cosmic Rush Adventure','Play several challenges in one Qur’an adventure.','Custom passages and saved expeditions'],['rescue','◇','Memory Rescue','Practice parts you have found difficult.','Evidence-based corrective practice'],['marathon','☾','Long-Surah Marathon','Review a longer passage through several challenges.','Steady, bounded passage revision'],['ayah-defense','⌂','Ayah Defense','Build towers and guide your fortress with continuous Qur’an revision.','Long-surah strategy'],['surah-rush','➤','Surah Rush','Run, jump and open the correct Arabic continuation routes.','Momentum passage revision']];
    root.innerHTML=`<div class="cosmic-hero"><span class="cosmic-eyebrow">ONE AYAH AT A TIME</span><h2>Choose your revision game</h2><p>Listen, say the words aloud, and build your confidence.</p></div><div class="revision-game-grid">${cards.map(([id,icon,title,description,skill])=>`<article class="revision-game-card"><span class="game-card-icon" aria-hidden="true">${icon}</span><h3>${title}</h3><p>${description}</p><small>Practice: ${skill}</small><button class="cosmic-primary" data-revision-game="${id}" ${id==='cosmic'?'data-cosmic-select':''}>Play ${title}</button></article>`).join('')}</div>`;
    root.querySelectorAll('[data-revision-game]').forEach(button=>button.onclick=()=>{const id=button.dataset.revisionGame;if(id==='cosmic')planner();else if(id==='rescue'||id==='marathon')missions();else if(['ayah-defense','surah-rush'].includes(id))void adventureSetup(id);else if(['atlas','forge','command'].includes(id))void longSetup(id);else basicSetup(id);});
    const archive=document.createElement('details');archive.className='revision-archive';archive.innerHTML='<summary>Previous long-passage games · saved progress</summary>'+[['atlas','Constellation Atlas'],['forge','Ayah Forge'],['command','Memory Command']].map(([id,name])=>`<button data-revision-game="${id}">${name} · archived</button>`).join('');archive.querySelectorAll('button').forEach(b=>b.onclick=()=>longSetup(b.dataset.revisionGame));root.append(archive);
    savedRoutes();
  }
  async function adventureSetup(game,initial=null){
    if(!initial&&selectedPassage?.refs?.length&&selectedPassage.refs[0].split(':')[0]===selectedPassage.refs.at(-1).split(':')[0])initial={surah:Number(selectedPassage.refs[0].split(':')[0]),first:Number(selectedPassage.refs[0].split(':')[1]),size:selectedPassage.refs.length};
    const token=++generation;atPlanner=false;atSelection=false;flight?.dispose();director?.dispose();flight=director=null;
    const {catalog}=await import('../content/library.js');if(token!==generation)return;const name=game==='ayah-defense'?'Ayah Defense':'Surah Rush';
    root.innerHTML=`<section class="revision-basic-setup"><button data-adventure-back>Revision games</button><h2>${name}</h2><form><label>Surah<select name=surah>${catalog.chapters.map(c=>`<option value="${c.id}">${c.id}. ${esc(c.name)}</option>`).join('')}</select></label><label>Passage<select name=selection><option value=5>Five ayahs</option><option value=10>Ten ayahs</option><option value=15>Fifteen ayahs</option><option value=20>Twenty ayahs</option><option value=30>Thirty ayahs</option><option value=entire>Entire surah</option><option value=custom>Custom range</option></select></label><label>First ayah<input name=first type=number min=1 value=1 required></label><label>Last ayah<input name=last type=number min=1 value=5></label><label>Memory challenge<select name=memory><option value=guided>Easy · more support</option><option value=standard>Normal · some support</option><option value=expert>Hard · recall before choices</option></select></label><label>Game speed<select name=motor><option value=relaxed>Relaxed</option><option value=normal>Normal</option><option value=arcade>Fast</option></select></label>${game==='ayah-defense'?'<label>Garden map<select name=defenseMap><option value=0>Garden Trail · beginner</option><option value=1>Spiral Grove · intermediate</option><option value=2>Twin Rivers · advanced</option><option value=3>Celestial Crossroads · expert</option></select></label><label><input type=checkbox name=tourMaps> Change maps each expedition region (displaced towers refund paid costs)</label>':''}<button class=cosmic-primary>Prepare game</button><p>Private source text requires online server authorization. Visual groups are not recitation stopping points.</p></form><p role=alert data-adventure-error></p><div data-adventure-host></div></section>`;
    const form=root.querySelector('form'),error=root.querySelector('[data-adventure-error]');if(initial){form.elements.surah.value=String(initial.surah);form.elements.first.value=String(initial.first);form.elements.selection.value='custom';const c=catalog.chapters.find(c=>c.id===initial.surah);form.elements.last.value=String(Math.min(c.verseCount,initial.first+initial.size-1));}
    const refresh=()=>{const c=catalog.chapters.find(c=>c.id===Number(form.elements.surah.value));form.elements.first.max=form.elements.last.max=c.verseCount;form.elements.last.closest('label').hidden=form.elements.selection.value!=='custom';form.elements.first.disabled=form.elements.selection.value==='entire';};form.elements.selection.onchange=refresh;form.elements.surah.onchange=()=>{form.elements.first.value='1';refresh();};refresh();if(game==='surah-rush'){for(const o of form.elements.motor.options)o.textContent={relaxed:'Speed Course · gentle routes',normal:'Adventure Course · balanced',arcade:'Technical Course · platform challenge'}[o.value];form.elements.motor.value='normal';const label=document.createElement('label');label.textContent='Starting environment';label.innerHTML+='<select name=rushEnvironment><option value=0>Emerald Adventure</option><option value=1>Moonlight Forest</option><option value=2>Celestial Skyways</option><option value=3>Neon Clockwork City</option><option value=4>Oasis Canyon</option></select>';form.elements.motor.closest('label').after(label);}root.querySelector('[data-adventure-back]').onclick=selection;
    form.onsubmit=async e=>{e.preventDefault();try{const {marathonRange}=await import('./missions/model.js'),{mountAdventure}=await import('./adventures/ui.js');if(token!==generation)return;const refs=marathonRange({surah:Number(form.elements.surah.value),selection:form.elements.selection.value,first:Number(form.elements.first.value),last:Number(form.elements.last.value)});flight?.dispose();flight=await mountAdventure(root.querySelector('[data-adventure-host]'),{game,refs,client:appearanceAccount().client,settings:{memory:form.elements.memory.value,motor:form.elements.motor.value,...(game==='surah-rush'?{environment:Number(form.elements.rushEnvironment.value)}:{}),...(game==='ayah-defense'?{map:Number(form.elements.defenseMap.value),tourMaps:form.elements.tourMaps.checked}:{})},isCurrent:()=>token===generation,onExit:selection,onNext:range=>{const c=catalog.chapters.find(c=>c.id===range.surah);if(range.first>c.verseCount){error.textContent='Surah complete. Choose another passage whenever ready.';return;}void adventureSetup(game,range);}});form.hidden=true;root.querySelector('[data-adventure-host]').scrollIntoView({block:'start'});}catch(e){if(token===generation)error.textContent=e.message;}};
  }
  async function longSetup(mode){
    const token=++generation;flight?.dispose();director?.dispose();flight=director=null;
    const {catalog}=await import('../content/library.js');if(token!==generation)return;
    root.innerHTML=`<section class="revision-basic-setup"><button data-long-back>Revision games</button><h2>${{atlas:'Constellation Atlas',forge:'Ayah Forge',command:'Memory Command'}[mode]}</h2><p>Designed for long passages. Private sources require online server authorization. Missing material will remain unavailable.</p><form><label>Surah<select name="surah">${catalog.chapters.map(c=>`<option value="${c.id}" ${c.id===(mode==='forge'?98:78)?'selected':''}>${c.id}. ${esc(c.name)}</option>`).join('')}</select></label><label>First ayah<input name="first" type="number" min=1 value=${mode==='forge'?5:1}></label><label>Last ayah<input name="last" type="number" min=1 value=${mode==='forge'?5:10}></label><button>Start long-passage game</button></form><p data-long-error role=alert></p><div data-long-host></div></section>`;
    root.querySelector('[data-long-back]').onclick=selection;root.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;try{const {marathonRange,rescueRecommendations}=await import('./missions/model.js'),{mountLongGame}=await import('./long-games/ui.js');if(token!==generation)return;const refs=marathonRange({surah:Number(form.elements.surah.value),selection:'custom',first:Number(form.elements.first.value),last:Number(form.elements.last.value)});const read=k=>{try{return JSON.parse(profileStorage.getItem(k)||'{}');}catch{return {};}};flight?.dispose();flight=await mountLongGame(root.querySelector('[data-long-host]'),{mode,refs,client:appearanceAccount().client,isCurrent:()=>token===generation,onExit:selection,evidence:rescueRecommendations({lab:read('ayah-puzzle-lab-v1'),memory:read('ayah-passage-recall-v1'),learning:read('ayah-learning-v1'),links:read('ayah-cosmic-links-v1')})});}catch(error){if(token===generation)root.querySelector('[data-long-error]').textContent=error.message;}};
  }
  function basicSetup(activity) {
    atSelection=false;atPlanner=false;generation++;
    const titles={runner:'Star Runner',defense:'Meteor Defense',link:'Ayah Link'};
    root.innerHTML=`<section class="revision-basic-setup" aria-label="${titles[activity]} game screen"><button class="cosmic-secondary" data-back>← Revision games</button><h2>${titles[activity]}</h2><p>Choose your ayahs, listen, and play. You can pause at any time.</p><form><label>Choose your surah<select name="surah">${cosmicSurahs.slice().sort((a,b)=>a.id-b.id).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Choose your ayahs<select name="selection"><option value="5">Up to five ayahs</option><option value="10">Up to ten ayahs</option><option value="15">Up to fifteen ayahs</option><option value="20">Up to twenty ayahs</option><option value="30">Up to thirty ayahs</option><option value="entire">Entire surah</option><option value="custom">Custom range</option></select></label><label>First ayah<input name="start" type="number" min="1" value="1" required></label><label data-basic-end hidden>Last ayah<input name="end" type="number" min="1" value="2"></label><label>Memory challenge<select name="memory"><option value="guided">Easy · more hints</option><option value="standard">Normal · some hints</option><option value="expert">Hard · fewer hints</option></select></label><label>Game speed<select name="motor"><option value="relaxed">Relaxed · take your time</option><option value="normal">Normal · regular speed</option><option value="arcade">Fast · arcade challenge</option></select></label><details><summary>Advanced Settings</summary><p>Memory challenge changes learning support. Game speed changes movement, never your memory assessment.</p><label>Revision rounds<input name="rounds" type="number" min="1" max="10" value="1"></label><label>Pickup style<select name="pickup"><option value="mixed">Word groups, words and ayahs</option><option value="words">Word by word</option><option value="ayahs">Complete ayahs</option></select></label><label><input name="audio" type="checkbox" checked> Play verified learning cues</label><label><input name="gateways" type="checkbox"> Add safe gateway review</label><p>Transliteration, recitation volume, and effects are available inside the game.</p><button type="button" class="cosmic-secondary" data-full-planner>Open full mission planner</button></details><button class="cosmic-primary" type="submit">Start Game</button><p data-basic-error role="alert"></p></form></section>`;
    const form=root.querySelector('form');if(activity==='link')form.elements.motor.closest('label').hidden=true;const refresh=()=>{const surah=cosmicSurahs.find(s=>s.id===Number(form.elements.surah.value));form.elements.start.max=form.elements.end.max=surah.verses.length;form.elements.start.disabled=form.elements.selection.value==='entire';root.querySelector('[data-basic-end]').hidden=form.elements.selection.value!=='custom';form.elements.end.disabled=form.elements.selection.value!=='custom';};
    form.elements.surah.onchange=()=>{form.elements.start.value='1';form.elements.end.value='2';refresh();};form.elements.selection.onchange=refresh;refresh();
    root.querySelector('[data-back]').onclick=selection;root.querySelector('[data-full-planner]').onclick=planner;
    form.onsubmit=async event=>{event.preventDefault();const token=++generation;form.querySelector('[type=submit]').disabled=true;
      try{const mission=await createMission({surahId:Number(form.elements.surah.value),selection:form.elements.selection.value,start:Number(form.elements.start.value),end:Number(form.elements.end.value)});if(token!==generation||!root.isConnected)return;
        if(activity==='link'&&mission.refs.length<2)throw Error('Choose at least two consecutive ayahs to connect.');
        const options={rounds:Number(form.elements.rounds.value),slow:form.elements.motor.value==='relaxed',defenseMotor:form.elements.motor.value,runnerMotor:form.elements.motor.value,defenseMemory:form.elements.memory.value,memoryDifficulty:form.elements.memory.value,defenseMode:activity==='defense'?'capture':null,pickupMode:form.elements.pickup.value,guidancePreference:form.elements.audio.checked,guidance:form.elements.audio.checked&&form.elements.memory.value!=='expert',memoryGateways:form.elements.gateways.checked,linkMode:form.elements.memory.value==='guided'?'endpoints':form.elements.memory.value==='expert'&&mission.refs.length>2?'constellation':'boundary',linkChainMode:'practice',compact:matchMedia('(max-width:600px)').matches,reducedMotion:cosmicReducedMotion()};
        // Use the same validated mission/controller and source gates as the full planner.
        await startBasic(mission,activity,options,()=>basicSetup(activity));
      }catch(error){if(root.querySelector('[data-basic-error]')){root.querySelector('[data-basic-error]').textContent=error.message;form.querySelector('[type=submit]').disabled=false;}}
    };
  }
  async function startBasic(mission,activity,options,back){
    root.__ayahContinuous=true;root.__ayahDifficulty={memory:options.memoryDifficulty||'guided',motor:options.defenseMotor||'relaxed'};delete root.__ayahContinuousError;delete root.__ayahRestartChallenge;
    const batchSize=options.batchSize||mission.refs.length;
    const batchStore=revisionBatchStore(profileStorage);batchStore.transact(s=>s.selection={surah:Number(mission.refs[0].split(':')[0]),first:Number(mission.refs[0].split(':')[1]),last:Number(mission.refs.at(-1).split(':')[1]),batchSize,activity,settings:Object.fromEntries(Object.entries(options).filter(([k,v])=>!['controller','client'].includes(k)&&['boolean','number','string'].includes(typeof v)))});
    root.__ayahRevisionActions={minAyahs:activity==='link'?2:1,batchSize,switch:type=>startBasic(mission,type,{...options,batchSize},back),replay:()=>startBasic(mission,activity,{...options,batchSize,restart:true},back),change:back,next:async range=>{const next=await createMission({surahId:Number(mission.refs[0].split(':')[0]),selection:'custom',start:range.first,end:range.last});await startBasic(next,activity,{...options,batchSize},back);}};
    const token=++generation;flight?.dispose();director?.dispose();flight=null;
    let runOwner=null;
    const continuous=await passageRun(mission.refs,{activity,settings:options.continuousIdentity||{source:mission.sourceHash,memory:options.memoryDifficulty||'guided',motor:options.defenseMotor||'relaxed'},storage:profileStorage,guard:()=>{if(!root.isConnected||(runOwner?director!==runOwner:token!==generation))throw Error('Learning account or game changed.');}});
    // Explicit replay starts a new supported run; a saved selection resumes its prefix.
    if(options.restart===true||continuous.completed===mission.refs.length)continuous.restart();
    const current=await createFlightController(mission,{...options,activity,initialStage:continuous.next,onEvent:e=>{if(['runner:checkpoint','defense:checkpoint','link:checkpoint'].includes(e.type)){try{continuous.complete(mission.stages[e.stageIndex].refs);}catch(error){root.__ayahContinuous=false;root.__ayahContinuousError=true;const retry=document.createElement('button');retry.textContent='Retry checkpoint save';retry.onclick=()=>{try{continuous.complete(mission.stages[e.stageIndex].refs);root.__ayahContinuousError=false;root.__ayahContinuous=true;retry.remove();if(current.nextStage())flight?.dispatch?.({type:'resume'});}catch(error){retry.textContent=error.message;}};root.prepend(retry);const note=document.createElement('p');note.setAttribute('role','alert');note.textContent=error.message;root.prepend(note);}}}});if(token!==generation||!root.isConnected){current.dispose();return;}director=current;runOwner=current;
    root.__ayahRestartChallenge=next=>startBasic(mission,activity,{...options,continuousIdentity:continuous.settings,memoryDifficulty:next.memory,defenseMemory:next.memory,defenseMotor:next.motor,runnerMotor:next.motor,slow:next.motor==='relaxed',guidance:next.memory!=='expert'&&(options.guidancePreference??options.guidance),linkMode:next.memory==='guided'?'endpoints':next.memory==='expert'&&mission.refs.length>2?'constellation':'boundary'},back);
    const show=async next=>{const viewToken=++generation;flight?.dispose();flight=null;
      if(next==='link')await current.prepareLink(appearanceAccount().client);
      if(viewToken!==generation||director!==current||!root.isConnected)return;
      const module=await(next==='link'?import('../puzzles/arcade/cosmic/link-ui.js'):next==='defense'?import('../puzzles/arcade/cosmic/defense-ui.js'):import('../puzzles/arcade/cosmic/ui.js'));
      if(viewToken!==generation||director!==current||!root.isConnected)return;
      const exit=()=>{generation++;flight?.dispose();current.dispose();flight=null;director=null;back();};
      const transition=async type=>{if(director!==current)return;if(type==='link')await current.prepareLink(appearanceAccount().client);if(director===current&&current.switchActivity(type))await show(type);};
      const common={...options,controller:current,client:appearanceAccount().client,isCurrent:()=>viewToken===generation,onExit:exit,onRunner:()=>transition('runner'),onDefense:()=>transition('defense'),onLink:()=>transition('link')};
      const mounted=next==='link'?await module.mountAyahLink(root,mission,common):next==='defense'?await module.mountMeteorDefense(root,mission,common):await module.mountStarRunner(root,mission,common);
      if(viewToken!==generation||!root.isConnected)mounted?.dispose();else {flight=mounted;mounted?.start?.();root.querySelector('.gameplay-viewport')?.scrollIntoView({block:'start'});}
    };
    try{await show(activity);}catch(error){if(director===current){current.dispose();director=null;back();const note=root.querySelector('[data-basic-error]');if(note)note.textContent=`Could not open game: ${error.message}`;}}
  }
  function savedRoutes(){
    root.querySelector('.exp-saved-routes')?.remove();
    const back=atPlanner?planner:selection;
    const saved=createExpeditionStore();
    const list=document.createElement('div');list.className='exp-saved-routes';const title=document.createElement('h3');title.textContent='Continue Your Adventure';list.append(title);
    if(saved.warning){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=saved.warning;list.append(p);}
    for(const run of COSMIC_EXPEDITIONS_ENABLED?Object.values(saved.snapshot().runs).reverse():[]){
      const b=document.createElement('button');b.className='cosmic-secondary';b.textContent=`Resume saved expedition · ${cosmicSurahs.find(s=>s.id===run.surah)?.name||run.surah} ${run.first}–${run.last}${run.final?.result?' · assessed':''}`;
      b.onclick=async()=>{const token=++generation;b.disabled=true;try{const mission=await createMission({surahId:run.surah,selection:'custom',start:run.first,end:run.last});if(token!==generation)return;if(mission.id!==run.missionId||mission.sourceHash!==run.sourceHash)throw Error('Saved content revision changed. Export the existing expedition before recovery.');await expedition(mission,{rounds:run.rounds},back);}catch(e){if(token===generation){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e.message;list.append(p);b.disabled=false;}}};list.append(b);
    }
    const batch=revisionBatchStore(profileStorage);if(batch.warning){const note=document.createElement('p');note.textContent=batch.warning;list.append(note);}const selected=batch.snapshot().selection;if(selected&&!batch.warning){const button=document.createElement('button');button.className='cosmic-secondary';button.textContent=`Resume selected ${selected.activity} batch · ${selected.surah}:${selected.first}–${selected.last}`;button.title='Saved checkpoints remain. An unfinished standalone flight restarts its selected batch.';button.onclick=async()=>{try{const mission=await createMission({surahId:selected.surah,selection:'custom',start:selected.first,end:selected.last});await startBasic(mission,selected.activity,{...selected.settings,batchSize:selected.batchSize},back);}catch(e){button.after(Object.assign(document.createElement('p'),{textContent:e.message}));}};list.append(button);}
    root.append(list);
    const repairToken=generation;if(COSMIC_EXPEDITIONS_ENABLED)repairMissions().then(plans=>{if(repairToken!==generation||!root.isConnected||!list.isConnected)return;for(const plan of plans){const b=document.createElement('button');b.className='cosmic-secondary';b.textContent=`Repair ${plan.pairKey} · practice with surrounding context`;b.title=plan.reason;b.onclick=()=>expedition(plan.mission,{rounds:3},back);list.append(b);}}).catch(error=>{if(repairToken===generation){const p=document.createElement('p');p.textContent=error.message;list.append(p);}});
  }

  async function expedition(mission,options,back){
    if(!COSMIC_EXPEDITIONS_ENABLED)throw Error('Expeditions are paused for this rollout. Standalone activities remain available.');
    atSelection=false;atPlanner=false;
    const token=++generation;flight?.dispose();director?.dispose();director=null;flight=null;
    try{const {mountExpedition}=await import('../quest/cosmic/expedition/ui.js');if(token!==generation||!root.isConnected)return;const next=await mountExpedition(root,mission,{...options,isCurrent:()=>token===generation,onExit:()=>{flight=null;back();}});if(token!==generation||!root.isConnected)next?.dispose();else flight=next;}catch(e){if(token===generation&&root.isConnected){back();const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e.message;root.append(p);}}
  }
  function planner() {
    delete root.__ayahRevisionActions;delete root.__ayahContinuous;delete root.__ayahContinuousError;delete root.__ayahRestartChallenge;
    atSelection=false;atPlanner=true;
    generation++;
    root.innerHTML = `<button class="cosmic-secondary" data-back>← Revision Lab</button><div class="cosmic-hero"><span class="cosmic-eyebrow">COSMIC RUSH · MISSION PLANNER</span><h2>Chart your ayah journey</h2><p>Al-Fatihah and Juz Amma are free for everyone. Choose a contiguous passage, then explore its route.</p></div><form class="cosmic-form"><label>Surah<select name="surah">${cosmicSurahs.slice().sort((a,b)=>a.id-b.id).map(s=>`<option value="${s.id}">${esc(s.name)} · ${s.verses.length} ayahs</option>`).join('')}</select></label><label>Passage length<select name="selection"><option value="5">Five ayahs</option><option value="10">Ten ayahs</option><option value="15">Fifteen ayahs</option><option value="20">Twenty ayahs</option><option value="30">Thirty ayahs</option><option value="custom">Custom contiguous range</option><option value="entire">Entire surah</option></select></label><label data-start>First ayah<input name="start" type="number" min="1" value="1" required></label><label data-end hidden>Last ayah<input name="end" type="number" min="1" value="1"></label><p class="cosmic-range-note">Presets use up to the selected number of ayahs. Shorter surahs and passages include all remaining ayahs.</p><button class="cosmic-primary" type="submit">View mission briefing →</button><p data-error role="alert"></p></form>`;
    missionEntry();root.querySelector('[data-back]').onclick = selection;
    const form = root.querySelector('form');
    const update = () => {
      const s = cosmicSurahs.find(s=>s.id === Number(form.elements.surah.value));
      form.elements.start.max = form.elements.end.max = String(s.verses.length);
      const entire = form.elements.selection.value === 'entire';
      root.querySelector('[data-start]').hidden = entire;
      form.elements.start.disabled = entire;
      const custom = form.elements.selection.value === 'custom';
      root.querySelector('[data-end]').hidden = !custom;
      form.elements.end.disabled = !custom;
      root.querySelector('[data-error]').textContent = '';
    };
    form.elements.surah.onchange = () => { form.elements.start.value = '1'; form.elements.end.value = '1'; update(); };
    form.elements.selection.onchange = update;
    update();
    savedRoutes();
    form.onsubmit = async event => {
      event.preventDefault();
      const token = ++generation;
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        const mission = await createMission({surahId:Number(form.elements.surah.value),selection:form.elements.selection.value,start:Number(form.elements.start.value),end:Number(form.elements.end.value)});
        if (token !== generation || !root.isConnected) return;
        void Promise.resolve(onMissionSelection(mission.refs)).catch(()=>{});
        briefing(mission);
      } catch (error) {
        if (token === generation && root.isConnected) { root.querySelector('[data-error]').textContent = error.message; submit.disabled = false; }
      }
    };
  }
  function briefing(mission) {
    atSelection=false;atPlanner=false;
    let active = 0;
    const s = cosmicSurahs.find(s=>s.id === mission.surah);
    function render(focus = false) {
      const stage = mission.stages[active];
      root.innerHTML = `<button class="cosmic-secondary" data-change>← Change mission</button><div class="cosmic-hero"><span class="cosmic-eyebrow">MISSION BRIEFING</span><h2>${esc(s.name)} · Ayahs ${mission.first}–${mission.last}</h2><p>${mission.refs.length} ayahs · ${mission.stages.length} ${mission.stages.length===1?'stage':'stages'} · Free content</p><p>Stages group up to five consecutive ayahs. These are mission groups, not recitation stopping points.</p></div><div class="cosmic-route" role="navigation" aria-label="Mission constellation">${mission.stages.map((stage,i)=>`<button class="cosmic-node ${i===active?'is-current':''}" data-stage="${i}" ${i===active?'aria-current="step"':''}><span class="cosmic-star" aria-hidden="true">✦</span><strong>Stage ${stage.order}</strong><small>Ayahs ${stage.first}–${stage.last}</small></button>`).join('')}</div><section class="cosmic-briefing" tabindex="-1" aria-labelledby="cosmic-stage-title"><span class="cosmic-eyebrow">ROUTE PREVIEW · NOT COMPLETED</span><h3 id="cosmic-stage-title">Stage ${stage.order}: Ayahs ${stage.first}–${stage.last}</h3><ol>${objectives.map(o=>`<li><strong>${esc(o.title)}</strong><p>${esc(o.description)}</p></li>`).join('')}</ol><div class="cosmic-stage-nav"><button class="cosmic-secondary" data-previous ${active===0?'disabled':''}>← Previous stage</button><button class="cosmic-secondary" data-next ${active===mission.stages.length-1?'disabled':''}>Next stage →</button></div><label>Flight pace<select data-flight-pace><option value="standard">Standard</option><option value="slow">Slow · extra reaction time</option></select></label><label>Pickup style<select data-pickup-mode><option value="mixed">Mixed · chunks 5 : ayahs 1 : words 4</option><option value="words">Word by word</option><option value="ayahs">Whole ayahs</option></select></label><label>Revision rounds per ayah set<select data-flight-rounds>${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1} rounds</option>`).join('')}</select></label><p>One pass is enough to continue. Choose extra rounds only when useful. Every round adds 7% to base flight speed and one more asteroid per wave. Mixed mode targets 5 chunks : 1 whole ayah : 4 single words; short passages adapt to word boundaries.</p><label class="flow-review-option"><input type="checkbox" data-flow-guidance checked> Play a target audio cue before each piece</label><label class="flow-review-option"><input type="checkbox" data-flow-review> Add untimed gateway review at stage checkpoints</label><label>Defense configuration<select data-defense-config>${Object.entries(DEFENSE_CONFIGS).map(([key,c])=>`<option value="${key}">${esc(c.label)}</option>`).join('')}</select></label><label>Ayah Link level<select data-link-mode>${Object.entries(LINK_MODES).map(([key,label])=>`<option value="${key}" ${key==='constellation'&&mission.refs.length<3?'disabled':''}>${esc(label)}</option>`).join('')}</select></label><p>L2 restores each boundary pair. L3 adds a no-demonstration cumulative pass across the selected chain; it needs at least three ayahs.</p><label>Link strike rules<select data-link-rules><option value="practice">Practice · checkpoint each connection</option><option value="classic">Classic · three across this set</option></select></label>${COSMIC_EXPEDITIONS_ENABLED?'<button class="cosmic-primary" data-launch-expedition>Start or resume full expedition</button>':''}<button class="cosmic-primary" data-launch-link>Launch Ayah Link</button><button class="cosmic-primary" data-launch-runner>Launch Star Runner</button><label>Protect and Capture style<select data-defense-capture-mode><option value="capture">D2 · Defend and Capture</option><option value="protected">D1 · Protected Ayah Orbs</option></select></label><label>Defense movement<select data-defense-motor><option value="relaxed">Relaxed</option><option value="normal">Normal</option><option value="arcade">Arcade</option></select></label><button class="cosmic-primary" data-launch-capture>Launch Protect and Capture</button><button class="cosmic-secondary" data-launch-defense>Launch Meteor Defense</button><p class="cosmic-availability" role="status">Steer into the next correct ayah or word as it flows through space. Avoid authentic distractors and asteroids. Meteor Defense is playable as a separate activity and from a cleared Star Runner checkpoint. Ayah Link teaches consecutive transitions and uses reviewed reactor phrases or whole-ayah fallback. The saved expedition alternates all three activities with a celestial boss and offers final self-assessed passage recall. Flight begins at the selected stage and pauses at each safe checkpoint. Collect every selected ayah in order. Missed pieces return; wrong pickups keep earlier progress. Optional gateway review pauses at stage checkpoints. This is recognition practice, not independent memorization mastery.</p></section>`;
      const launch=async(activity,capture=false)=>{
        const token=++generation;
        const options={defenseMode:capture?root.querySelector('[data-defense-capture-mode]').value:null,defenseMotor:root.querySelector('[data-defense-motor]').value,slow:root.querySelector('[data-flight-pace]').value==='slow',rounds:Number(root.querySelector('[data-flight-rounds]').value),guidance:root.querySelector('[data-flow-guidance]').checked,pickupMode:root.querySelector('[data-pickup-mode]').value,memoryGateways:root.querySelector('[data-flow-review]').checked,defenseConfig:root.querySelector('[data-defense-config]').value,linkMode:root.querySelector('[data-link-mode]').value,linkChainMode:root.querySelector('[data-link-rules]').value,compact:matchMedia('(max-width:600px)').matches,reducedMotion:cosmicReducedMotion()};
        root.querySelectorAll('[data-launch-runner],[data-launch-defense],[data-launch-capture],[data-launch-link],[data-launch-expedition]').forEach(b=>b.disabled=true);
        let owned=null;
        try{
          director?.dispose();const next=await createFlightController(mission,{...options,activity,initialStage:active});
          if(token!==generation||!root.isConnected){next.dispose();return;}director=next;owned=next;
          await show(activity,options);
        }catch(error){if((token===generation||owned&&director===owned)&&root.isConnected){flight?.dispose();director?.dispose();director=null;render(true);root.querySelector('.cosmic-availability').textContent=`Could not open activity: ${error.message}`;}}
      };
      async function show(activity,options){
        const token=++generation;flight?.dispose();flight=null;
        const exit=()=>{flight?.dispose();flight=null;director?.dispose();director=null;render(true);};
        const transition=async(next)=>{const current=director;if(!current)return;const before=generation;try{if(next==='link')await current.prepareLink(appearanceAccount().client);if(current!==director||before!==generation||!root.isConnected)return;if(!current.switchActivity(next))return;await show(next,options);}catch(error){const note=root.querySelector('[data-link-warning],[data-defense-warning],[data-gateway-save-warning]');if(note)note.textContent=error.message;}};
        if(activity==='link'){await director.prepareLink(appearanceAccount().client);if(token!==generation||!root.isConnected)return;}
        const module=await (activity==='link'?import('../puzzles/arcade/cosmic/link-ui.js'):activity==='defense'?import('../puzzles/arcade/cosmic/defense-ui.js'):import('../puzzles/arcade/cosmic/ui.js'));if(token!==generation||!root.isConnected)return;
        const {mountAyahLink,mountMeteorDefense,mountStarRunner}=module;
        const mounted=activity==='link'?await mountAyahLink(root,mission,{controller:director,client:appearanceAccount().client,isCurrent:()=>token===generation,onExit:exit,onRunner:()=>transition('runner'),onDefense:()=>transition('defense')}):activity==='defense'?await mountMeteorDefense(root,mission,{controller:director,configuration:options.defenseConfig,isCurrent:()=>token===generation,onExit:exit,onRunner:()=>transition('runner'),onLink:()=>transition('link')}):await mountStarRunner(root,mission,{...options,controller:director,isCurrent:()=>token===generation,onExit:exit,onDefense:()=>transition('defense'),onLink:()=>transition('link')});
        if(token!==generation||!root.isConnected)mounted?.dispose();else flight=mounted;
      }
      root.querySelector('[data-launch-runner]').onclick=()=>launch('runner');
      root.querySelector('[data-launch-defense]').onclick=()=>launch('defense');root.querySelector('[data-launch-capture]').onclick=()=>launch('defense',true);
      root.querySelector('[data-launch-link]').onclick=()=>launch('link');
      if(COSMIC_EXPEDITIONS_ENABLED)root.querySelector('[data-launch-expedition]').onclick=()=>expedition(mission,{rounds:Number(root.querySelector('[data-flight-rounds]').value),slow:root.querySelector('[data-flight-pace]').value==='slow',guidance:root.querySelector('[data-flow-guidance]').checked,pickupMode:root.querySelector('[data-pickup-mode]').value},()=>render(true));
      root.querySelector('[data-change]').onclick = planner;
      root.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{active=Number(b.dataset.stage);render(true);});
      root.querySelector('[data-previous]').onclick=()=>{active--;render(true);};
      root.querySelector('[data-next]').onclick=()=>{active++;render(true);};
      if(focus)root.querySelector('.cosmic-briefing').focus();
    }
    render(true);
  }
  selection();
  if(selectedPassage){void missions();return;}
}