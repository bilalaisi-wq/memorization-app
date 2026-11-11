import {romanHTML} from '../transliteration.js';
import {mountCosmicControls} from '../preferences.js';
import {captureCosmicFocus,restoreCosmicFocus} from '../focus.js';
import {esc} from '../../../ui/dom.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import {freeAyah} from '../gateways.js';
import {canonicalLinkAyah,firstGrapheme} from '../link-content.js';
import {createWeakLinkBoss} from './boss.js';
import {createAudioManager} from '../../../puzzles/arcade/services.js';
import {readLabVolume} from '../../../puzzles/audio-level.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
export function mountWeakBoss(root,{questions,cleared,save,onComplete,onExit,onEvent=()=>{},evidenceStrength='Baseline pace'}){
  const owner=activeProfileId(),audio=createAudioManager({owner:'cosmic-boss',initialVolume:readLabVolume(profileStorage)}),abort=new AbortController();let disposed=false,token=0,warning='',controls=null;
  const game=createWeakLinkBoss({questions,cleared,save,onEvent});
  const stop=()=>{token++;audio.stop();};
  function send(action){if(disposed)return;const focus=captureCosmicFocus(root),before=game.getSnapshot().question.id,draft=root.querySelector('[data-boss-text]')?.value;stop();try{game.dispatch(action);}catch(e){warning=e.message;}paint();if(before===game.getSnapshot().question.id&&draft!==undefined&&root.querySelector('[data-boss-text]'))root.querySelector('[data-boss-text]').value=draft;restoreCosmicFocus(root,focus,{draft:before===game.getSnapshot().question.id});}
  const verse=ref=>`<p class="exp-arabic" lang="ar" dir="rtl">${esc(freeAyah(ref).text)}${romanHTML(freeAyah(ref))} <small>${esc(ref)}</small></p>`;
  function paint(){
    if(disposed)return;const s=game.getSnapshot(),q=s.question;
    let exposed=[];if(q.previous)exposed.push(q.previous);if(s.status==='choices')exposed.push(...q.choices.flatMap(c=>c.refs));if(s.hints||s.revealed)exposed.push(...q.refs);
    let blocked=false;try{reportStudyExposure(exposed);}catch(e){warning=e.message;blocked=true;stop();}
    controls?.dispose();root.innerHTML=`<section class="cosmic-boss" data-boss-state="${s.status}" data-boss-kind="${q.kind}" data-boss-phase="${s.phase}"><div class="runner-heading"><h3>Weak-Link Sentinel</h3><button class="cosmic-secondary" data-boss-exit>Save and return to expedition</button></div><p>${esc(evidenceStrength)} · ${esc(q.label)}</p><p>${esc(q.reason)}</p><div class="boss-celestial" aria-label="${s.cleared.length} of ${s.total} energy shields released"><span class="boss-core" aria-hidden="true">✦</span>${questions.map((x,i)=>`<i class="boss-shield ${s.cleared.includes(x.id)?'is-restored':''}" style="--shield:${i}" aria-hidden="true"></i>`).join('')}</div><progress max="${s.total}" value="${s.cleared.length}" aria-label="Restored boss shields"></progress><p role="status">${esc(warning||s.reason)}</p><div data-boss-body></div><div class="exp-audio"><button class="cosmic-secondary" data-boss-audio>Listen to complete ayah${q.refs.length>1?'s':''} · assistance</button><button class="cosmic-secondary" data-boss-stop>Stop recitation</button><label>Recitation volume<input data-boss-volume type="range" min="0" max="100" value="${Math.round((audio.getVolume?.()??readLabVolume(profileStorage))*100)}"></label></div><p>Untimed memory practice. Words are not combat targets. Spoken comparison is self-assessed; boss results do not update FSRS or certify memorization.</p></section>`;
    root.querySelector('[data-boss-exit]').onclick=()=>{dispose();onExit();};root.querySelector('[data-boss-stop]').onclick=stop;
    root.querySelector('[data-boss-volume]').oninput=e=>audio.setVolume(Number(e.target.value)/100);
    root.querySelector('[data-boss-audio]').onclick=async()=>{stop();const t=token;try{reportStudyExposure(q.refs);send({type:'audio'});}catch(e){warning=e.message;paint();return;}const play=async i=>{if(disposed||t+1!==token||i>=q.refs.length)return;const ok=await audio.play(freeAyah(q.refs[i]).audio,{onEnded:()=>play(i+1)});if(!ok&&!disposed){warning='Audio unavailable. You can retry without a time limit.';paint();}};play(0);};
    controls=mountCosmicControls(root.querySelector('.cosmic-boss'));const body=root.querySelector('[data-boss-body]');
    if(blocked){body.innerHTML='<p>Verified text is hidden until assistance can be recorded.</p><button class="cosmic-secondary" data-boss-refresh>Retry workspace</button>';body.querySelector('button').onclick=paint;return;}
    if(s.status==='ready')body.innerHTML='<h4>Release the celestial shields</h4><button class="cosmic-primary" data-boss-start>Begin boss encounter</button>';
    if(s.status==='paused')body.innerHTML='<button class="cosmic-primary" data-boss-resume>Resume boss encounter</button>';
    const titles={next:'Recall the next ayah',connection:'Connect the ending word to the next opening',missing:'Rebuild the missing ayah',repair:'Repair the approved visual phrases',opening:'Recall the opening word without choices',multi:'Recite this stage’s ayahs together'};
    if(['prompt','choices','repair','comparison'].includes(s.status)){
      body.innerHTML=`<h4>${titles[q.kind]}</h4><p>Assigned references: ${esc(q.refs.join(', '))}</p>${q.previous?`<div class="exp-context"><strong>Preceding ayah · ${esc(q.previous)}</strong>${q.kind==='connection'?`<p class="exp-arabic" lang="ar" dir="rtl">${esc(canonicalLinkAyah(q.previous).words.at(-1).text)}</p>`:verse(q.previous)}</div>`:''}`;
      if(s.status==='prompt')body.innerHTML+='<p>Recall aloud before revealing the activity. There is no timer.</p><button class="cosmic-primary" data-boss-ready>Ready · open challenge</button>';
      if(s.status==='choices'){
        if(['next','connection'].includes(q.kind)&&!q.response)body.innerHTML+=`<div class="boss-choices">${q.choices.map(c=>`<button class="cosmic-secondary exp-arabic" lang="ar" dir="rtl" data-boss-choice="${esc(c.id)}">${esc(c.text)}${romanHTML(c)}</button>`).join('')}</div>`;
        if(['missing','repair'].includes(q.kind))body.innerHTML+=`<p>${q.kind==='repair'?'Published visual phrases; grouping does not certify recitation stops.':q.choices.length===1?'Whole-ayah reconstruction fallback for a long ayah.':'Canonical word tiles; word boundaries are not recitation stops.'}</p><div class="boss-assembly" aria-label="Selected reactor order" dir="rtl">${s.order.map(id=>`<button class="cosmic-secondary exp-arabic" data-boss-tile="${esc(id)}" lang="ar">${esc(q.choices.find(c=>c.id===id).text)}</button>`).join('')}</div><div class="boss-bank" dir="rtl">${q.choices.filter(c=>!s.order.includes(c.id)).map(c=>`<button class="cosmic-secondary exp-arabic" data-boss-tile="${esc(c.id)}" lang="ar">${esc(c.text)}${romanHTML(c)}</button>`).join('')}</div><button class="cosmic-primary" data-boss-check>Check reconstruction</button>`;
        if(q.kind==='opening'||q.response==='typed-ayah')body.innerHTML+='<form data-boss-form><label>Recall answer<input lang="ar" dir="rtl" data-boss-text autocomplete="off"></label><button class="cosmic-primary">Check opening</button></form>';
        if(q.kind==='multi')body.innerHTML+='<p>Quran text is hidden. Recite the assigned complete ayahs, respecting their boundaries.</p><button class="cosmic-primary" data-boss-declared>I recited · reveal for comparison</button>';
      }
      if(s.status==='repair')body.innerHTML+='<p>Your completed shields remain restored.</p><button class="cosmic-primary" data-boss-retry>Retry this shield</button>';
      if(s.status==='comparison')body.innerHTML+=q.refs.map(verse).join('')+'<p>Self-assessed spoken comparison, not automatic verification.</p><button class="cosmic-primary" data-boss-match>My recitation matched</button><button class="cosmic-secondary" data-boss-again>I need more practice</button>';
      if(s.hints){const target=canonicalLinkAyah(q.refs.at(-1));body.innerHTML+=`<aside class="exp-hint">${s.hints===1?`Meaning: ${esc(target.words[0].translation)}`:s.hints===2?`Opening: <span lang="ar">${esc(firstGrapheme(target.words[0].text))}</span>`:q.refs.map(verse).join('')}</aside>`;}
      if(s.hints<3)body.innerHTML+='<button class="cosmic-secondary" data-boss-hint>More help · next hint</button>';
    }
    if(s.status==='shield-cleared')body.innerHTML='<h4>Shield released ✦</h4><p>This shield is saved. Continue when ready.</p><button class="cosmic-primary" data-boss-continue>Continue to next shield</button>';
    if(s.status==='checkpoint')body.innerHTML='<h4>Celestial core restored</h4><p>All shields completed. This is gameplay progress, not a memorization assessment.</p><button class="cosmic-primary" data-boss-finish>Save stage and continue expedition</button>';
    const actions={start:'start',ready:'ready',hint:'hint',retry:'retry',continue:'continue',resume:'resume',check:'check',declared:'declared'};for(const [id,type] of Object.entries(actions))body.querySelector(`[data-boss-${id}]`)?.addEventListener('click',()=>send({type}));
    body.querySelectorAll('[data-boss-choice]').forEach(b=>b.onclick=()=>send({type:'choose',id:b.dataset.bossChoice}));
    body.querySelectorAll('[data-boss-tile]').forEach(b=>b.onclick=()=>send({type:'arrange',order:s.order.includes(b.dataset.bossTile)?s.order.filter(id=>id!==b.dataset.bossTile):[...s.order,b.dataset.bossTile]}));
    body.querySelector('[data-boss-form]')?.addEventListener('submit',e=>{e.preventDefault();send({type:'text',text:body.querySelector('[data-boss-text]').value});});
    body.querySelector('[data-boss-match]')?.addEventListener('click',()=>send({type:'assess',match:true}));body.querySelector('[data-boss-again]')?.addEventListener('click',()=>send({type:'assess',match:false}));body.querySelector('[data-boss-finish]')?.addEventListener('click',()=>onComplete(game.getSnapshot()));
  }
  function dispose(){if(disposed)return;disposed=true;controls?.dispose();stop();audio.dispose();game.dispose();abort.abort();}
  window.addEventListener('blur',()=>send({type:'pause'}),{signal:abort.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)send({type:'pause'});},{signal:abort.signal});window.addEventListener('ayahprofilechange',()=>{if(owner!==activeProfileId()){dispose();root.textContent='Account changed. Reopen Revision Lab.';}},{signal:abort.signal});
  paint();return {dispose,pause:()=>send({type:'pause'}),getSnapshot:()=>game.getSnapshot()};
}
