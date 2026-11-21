import {createGameplayFeedback} from './gameplay-feedback.js';
import {showFeedbackSettings} from './encouragement.js';

/** An adapter around a mounted engine, not a second game loop or progress store.
 * update() is called by the engine's existing render; dispatch remains authoritative. */
export function mountGameplayFrame({root,surface,dispatch,getState,onExit,sequence,volume,journey,successTarget,progressCount}) {
  const scope=new AbortController(),feedback=createGameplayFeedback(root);let completion=null,viewport=null,completionQueued=false;
  let disposed=false,previous=null,returnFocus=null;
  const toolbar=document.createElement('nav');toolbar.className='gameplay-toolbar';toolbar.setAttribute('aria-label','Game controls');
  toolbar.innerHTML='<button type="button" data-game-command="pause">Pause</button><button type="button" data-game-command="settings">Settings</button><button type="button" data-game-command="listen" aria-label="Replay complete ayah audio">♫ Replay ayah</button><span data-game-progress></span><button type="button" data-game-command="exit">Back</button>';
  root.prepend(toolbar);
  const menu=document.createElement('section');menu.className='gameplay-settings';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Paused game settings');
  menu.innerHTML='<h4>Game paused</h4><p>Your completed learning stays in place.</p><button type="button" data-game-command="resume">Resume game</button><div data-game-options></div><label>Recitation volume<input data-game-volume type="range" min="0" max="1" step=".05" aria-label="Recitation volume"></label><button type="button" data-game-command="effects">Encouragement &amp; effects</button><details><summary>Keyboard shortcuts</summary><p>Escape: pause or resume. At the result: H offers a harder replay when supported. Use the game’s labeled movement and action keys. In the final result: Enter continues when available; R replays. Buttons always work with keyboard and touch.</p></details><button type="button" data-game-command="exit">Change ayahs / back to games</button>';
  root.insertBefore(menu,toolbar.nextSibling);
  const slider=menu.querySelector('[data-game-volume]');slider.value=String(volume?.get?.()??1);slider.closest('label').hidden=!volume;
  slider.addEventListener('input',()=>volume?.set(Number(slider.value)),{signal:scope.signal});
  function settings(){returnFocus=document.activeElement;menu.querySelector('h4').textContent=getState().session.status==='won'?'Game settings':'Game paused';menu.querySelector('[data-game-command=resume]').textContent=getState().session.status==='won'?'Return to result':'Resume game';if(getState().session.status==='playing')dispatch({type:'pause'});menu.hidden=false;
    // Move real controls, retaining their listeners and selected values. No cloned preferences.
    for(const label of root.querySelectorAll('[class$="-toolbar"] label,.reading-toggle,.maze-tools label,.link-audio label,.defense-audio label'))if(!menu.contains(label)&&!toolbar.contains(label))menu.querySelector('[data-game-options]').append(label);
    menu.querySelector('button').focus({preventScroll:true});
  }
  function command(type){if(type==='toggle-pause')return;if(type==='settings'){settings();return;}if(type==='effects'){showFeedbackSettings();return;}if(type==='exit'){onExit?.();return;}if(type==='resume'){menu.hidden=true;dispatch({type:'resume'});const target=getState().session.status==='playing'?surface():(returnFocus?.isConnected?returnFocus:surface());if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=0;target.focus?.({preventScroll:true});}return;}dispatch({type});}
  root.addEventListener('click',e=>{const button=e.target.closest('[data-game-command]');if(button){e.preventDefault();e.stopPropagation();command(button.dataset.gameCommand);}const next=e.target.closest('[data-game-journey]');if(next){e.preventDefault();journey?.choose(next.dataset.gameJourney);}},{signal:scope.signal});
  root.addEventListener('keydown',e=>{
    if(disposed||e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,select,textarea,[contenteditable=true]')||e.target.closest('dialog'))return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();if(!menu.hidden)command('resume');else settings();return;}
    if(getState().session.status!=='won'||e.target.closest('button,a'))return;
    const candidates=e.code==='KeyH'?['harder']:e.code==='KeyR'?['replay','retry']:['Enter','Space'].includes(e.code)?['continue','next']:[];
    const blocks=e.code==='KeyR'?root.querySelector('[data-repeat-same]'):e.code==='KeyH'?root.querySelector('[data-repeat]'):['Enter','Space'].includes(e.code)?root.querySelector('[data-next]'):null;
    const button=blocks||[...root.querySelectorAll('button')].find(b=>!b.disabled&&candidates.some(c=>[...b.attributes].some(a=>(a.name.includes('action')||a.name==='data-game-journey')&&a.value===c)));
    if(button){e.preventDefault();e.stopPropagation();button.click();}
  },{signal:scope.signal});
  function dock(){
    const stage=surface();if(!stage||stage===root)return;
    const field=stage.closest('.tower-layout,.maze-stage')||stage;
    if(!viewport?.isConnected||!viewport.contains(field)){
      viewport?.remove();viewport=document.createElement('section');viewport.className='gameplay-viewport';viewport.setAttribute('aria-label','Game screen');
      field.before(viewport);viewport.append(toolbar,menu,field);field.classList.add('gameplay-playfield');
      const deck=document.createElement('div');deck.className='gameplay-control-deck';
      for(const controls of root.querySelectorAll('.tower-controls,.astro-controls,.snake-direction-pad,.snake-boost-button,.maze-pad,.bubble-controls,.sirat-pad,.runner-controls,.defense-controls,.capture-pad'))if(!field.contains(controls)||controls.classList.contains('maze-pad'))deck.append(controls);
      if(deck.children.length)viewport.append(deck);
    }
  }
  let readerWasPlaying=false;
  root.addEventListener('toggle',e=>{if(disposed||!e.target.matches?.('.reading-guide details')||!matchMedia('(orientation: landscape) and (max-height:550px)').matches)return;const guide=e.target.closest('.reading-guide');guide.classList.toggle('gameplay-guide-expanded',e.target.open);if(e.target.open){readerWasPlaying=getState().session.status==='playing';if(readerWasPlaying)dispatch({type:'pause'});}else if(readerWasPlaying){readerWasPlaying=false;dispatch({type:'resume'});}}, {capture:true,signal:scope.signal});
  const pauseButton=toolbar.querySelector('[data-game-command=pause]');
  function update(state){if(disposed)return;dock();const s=state.session;if(matchMedia('(orientation: landscape) and (max-height:550px)').matches){const guide=root.querySelector('.reading-guide');if(guide&&!guide.dataset.compactReader){guide.dataset.compactReader='true';guide.querySelector('details').open=false;}for(const label of root.querySelectorAll('.maze-tools label'))menu.querySelector('[data-game-options]').append(label);}
    if(s.status==='playing'&&previous?.status==='paused')menu.hidden=true;
    pauseButton.textContent=s.status==='paused'?'Resume':'Pause';
    pauseButton.onclick=()=>{if(getState().session.status==='paused'){menu.hidden=true;dispatch({type:'resume'});}else settings();};
    // The pause button owns its action; prevent delegation from toggling twice.
    pauseButton.dataset.gameCommand='toggle-pause';
    const progress=toolbar.querySelector('[data-game-progress]'),progressText=`${Math.min(s.checkpoint+1,s.config.keys.length)} / ${s.config.keys.length} · ${s.config.keys[s.checkpoint]}`;if(progress.textContent!==progressText)progress.textContent=progressText;
    const count=progressCount?progressCount(state):state.cursor??state.captured?.length??state.bridges?.length??0;
    if(previous&&previous.id===s.id){
      if(s.mistakes.length>previous.mistakes)feedback.mistake();
      if(s.checkpoint>previous.checkpoint||s.status==='won'&&previous.status!=='won')feedback.complete(sequence?.()||surface(),{id:`${s.id}:complete:${previous.checkpoint}`});
      else if(count>previous.count&&s.checkpoint===previous.checkpoint)feedback.correct(successTarget?.()||sequence?.()||surface(),{id:`${s.id}:${s.checkpoint}:${count}`});
    }
    if(journey&&s.status==='won'){
      if(!completion){completion=document.createElement('section');completion.className='gameplay-completion-actions';completion.setAttribute('aria-label','Continue your learning');}
      const overlay=root.querySelector('.astro-overlay,.snake-overlay,.maze-overlay,.bubble-overlay,.sirat-overlay,.bridge-overlay');if(overlay&&!overlay.contains(completion))overlay.append(completion);
      if(!completionQueued){completionQueued=true;queueMicrotask(()=>{completionQueued=false;if(disposed||getState().session.status!=='won')return;
        const next=journey.next?.(),legacy=action=>[...root.querySelectorAll('button')].some(b=>!completion.contains(b)&&[...b.attributes].some(a=>a.name.includes('action')&&a.value===action));
        const available={next:!!next&&!legacy('continue'),replay:!legacy('replay'),harder:!!journey.harder,customize:!legacy('customize'),exit:!legacy('exit')};
        const signature=JSON.stringify([s.id,next,available]);if(completion.dataset.run===signature)return;completion.dataset.run=signature;
        completion.innerHTML=`<h4>More ways to practise</h4>${available.next?`<button type="button" class="primary" data-game-journey="continue">Continue to ${next.first===next.last?'ayah '+next.first:'ayahs '+next.first+'–'+next.last}</button>`:''}${available.replay?'<button type="button" data-game-journey="replay">Repeat this passage</button>':''}${available.harder?'<button type="button" data-game-journey="harder">Repeat with more challenge</button>':''}${available.customize?'<button type="button" data-game-journey="customize">Change ayahs</button>':''}${available.exit?'<button type="button" data-game-command="exit">Back to games / study</button>':''}`;
      });}
      completion.hidden=false;
    }else if(completion)completion.hidden=true;
    previous={id:s.id,checkpoint:s.checkpoint,count,status:s.status,mistakes:s.mistakes.length};
  }
  return {update,settings,correct:feedback.correct,complete:feedback.complete,closeSettings(){menu.hidden=true;},prepareRender(){root.prepend(toolbar,menu);},dispose(){disposed=true;scope.abort();feedback.dispose();toolbar.remove();menu.remove();completion?.remove();if(viewport){while(viewport.firstChild)viewport.before(viewport.firstChild);viewport.remove();}}};
}
