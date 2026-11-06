import {reportStudyExposure} from '../../../study-exposure.js';
import {createAudioManager,motionSettings} from '../services.js';
import {buildCrossings} from './engine.js';
import {versionedStore} from '../../../ui/versioned-store.js';
import {profileStorage,activeProfileId} from '../../../learner/profile-storage.js';
import {esc} from '../../../ui/dom.js';
export const BRIDGE_TUTORIAL_KEY='ayah-bridge-tutorial-v1';
export function createBridgeTutorialStore(storage=profileStorage){
 const store=versionedStore(storage,BRIDGE_TUTORIAL_KEY,()=>({version:1,status:'unseen'}),s=>s?.version===1&&['unseen','skipped','completed'].includes(s.status));
 return {get warning(){return store.warning;},snapshot:store.snapshot,needsTutorial:()=>store.snapshot().status==='unseen',mark(status){if(!['skipped','completed'].includes(status))throw Error('Invalid tutorial outcome');if(store.snapshot().status==='completed')return;store.transact(s=>{s.status=status;});}};
}
export function bridgeTutorialContent(adapter,library){
 const eligible=library.filter(s=>s.verses.some((v,i)=>s.verses[i+1]?.id===v.id+1&&s.verses[i+2]?.id===v.id+2));
 const chapter=eligible.find(s=>s.id===112)||eligible[0];if(!chapter)throw Error('Three authorized consecutive ayahs are needed for the two-bridge tutorial.');
 const first=chapter.verses.find((v,i)=>chapter.verses[i+1]?.id===v.id+1&&chapter.verses[i+2]?.id===v.id+2).id;
 const config=adapter.configure({surah:chapter.id,start:first,end:first+2,mode:'chain',chainMode:'practice',seed:112});
 return {chapter:chapter.name,sectors:buildCrossings(adapter,config,library,{difficulty:'standard'})};
}
const text=ws=>ws.map(w=>w.text).join(' ');
export function mountBridgeTutorial({adapter,library,storage=profileStorage,muted=()=>false,volume=()=>1,onClose=()=>{}}){
 const owner=activeProfileId(),store=createBridgeTutorialStore(storage),scope=new AbortController(),audio=createAudioManager({owner:'bridge-tutorial',initialVolume:volume()}),motion=motionSettings(),focus=document.activeElement;
 const d=document.createElement('dialog');d.className='bridge-tutorial-dialog';d.setAttribute('aria-label','Learn Bridge Builder');
 let content,error='';try{content=bridgeTutorialContent(adapter,library);}catch(e){error=e.message;}
 let index=0,phase='intro',selected=0,noAudio=muted()||volume()===0,closed=false,token=0,timer=null,warning=store.warning,feedback='',paused=false;
 d.innerHTML='<section class="bridge-builder bridge-tutorial"><header><span class="eyebrow">HOW TO PLAY · NO STRIKES · NO XP</span><h2 tabindex="-1">Two ayahs. One connection.</h2><button data-tutorial-skip>Skip tutorial · open setup</button></header><div data-tutorial-body></div><p data-tutorial-status role="status" aria-live="polite"></p><div class="bridge-tutorial-audio"><label><input type="checkbox" data-tutorial-silent> No-audio mode</label><button data-tutorial-replay>♫ Play both complete ayahs</button><button data-tutorial-pause>Pause recitation</button><label>Volume <input type="range" min="0" max="100" data-tutorial-volume aria-label="Tutorial recitation volume"></label></div></section>';
 const controls=document.createElement('div');controls.className='bridge-tutorial-controls';const skip=d.querySelector('[data-tutorial-skip]');skip.textContent='Skip tutorial';controls.append(skip,d.querySelector('[data-tutorial-silent]').closest('label'),d.querySelector('[data-tutorial-pause]'));d.querySelector('header').append(controls);
 const body=d.querySelector('[data-tutorial-body]'),status=d.querySelector('[data-tutorial-status]');
 function stop(){token++;audio.stop();paused=false;}
 function remember(outcome){if(activeProfileId()!==owner)return;try{store.mark(outcome);}catch(e){warning=e.message;}}
 function close(outcome='skipped'){if(closed)return;stop();if(timer!==null)clearTimeout(timer);remember(outcome);closed=true;scope.abort();audio.dispose();d.close();d.remove();if(focus?.isConnected)focus.focus({preventScroll:true});onClose({status:store.snapshot().status,warning});}
 function expose(t,choices=false){
  try{reportStudyExposure([t.from,t.to,...(choices?t.choices.map(c=>c.key):[])],storage);return true;}
  catch(e){stop();phase='blocked';feedback=e.message;d.dataset.phase=phase;body.innerHTML='<p>Reference learning is paused until assistance can be saved. Skip to setup or retry playback after recovering your progress.</p>';status.textContent=feedback;return false;}
 }
 function finishCrossing(){timer=null;if(closed)return;if(index===0){phase='second';feedback='You connected the end of one ayah to the next opening. Try one more with less help.';}else{phase='success';remember('completed');feedback='Two bridges connected! You are ready to choose your own route.';}paint(true);}
 function paint(focusHeading=false){
  if(closed)return;const t=content?.sectors[index];d.dataset.phase=phase;d.dataset.boundary=String(index+1);d.classList.toggle('bridge-reduced',motion.reducedMotion);
  d.querySelector('[data-tutorial-silent]').checked=noAudio;d.querySelector('[data-tutorial-pause]').textContent=paused?'Resume recitation':'Pause recitation';
  if(!t){body.innerHTML=`<p>${esc(error)}</p><button data-tutorial-skip>Open game setup</button>`;status.textContent=warning;return;}
  if(phase==='blocked'){status.textContent=feedback;return;}
  if(!expose(t,phase==='choose'))return;
  const show=['intro','audio-first','audio-second','model'].includes(phase),connected=['model','crossing','success'].includes(phase);
  const mark=(ws,position)=>ws.map((w,i)=>`<span ${i===position?'class="bridge-word-highlight"':''}>${esc(w.text)}</span>`).join(' ');
  const step=phase==='second'?'Now recall the next opening without the golden hint.':phase==='success'?'Ready for your own journey':show?'Listen to two complete ayahs, then notice their connection.':'Say the next opening aloud. Which connector belongs here?';
  body.innerHTML=`<p class="bridge-tutorial-step" tabindex="-1">${index+1}/2 · ${esc(content.chapter)} · ${step}</p>${show?`<div class="bridge-tutorial-verses" dir="rtl" lang="ar"><p class="arabic" data-tutorial-verse="${t.from}" ${phase==='audio-first'?'aria-current="true"':''}>${mark(t.previous,show&&phase!=='intro'?t.previous.length-1:-1)} <small>﴿${t.from}﴾</small></p><p class="arabic" data-tutorial-verse="${t.to}" ${phase==='audio-second'?'aria-current="true"':''}>${mark(t.next,show&&phase!=='intro'?0:-1)} <small>﴿${t.to}﴾</small></p></div>`:''}<div class="bridge-landscape ${connected?'bridge-tutorial-connected':''}"><div class="bridge-island bridge-origin"><small>${t.from}</small><div class="arabic" dir="rtl" lang="ar">${esc(text(t.previous.slice(-1)))}</div><span>End of this ayah</span></div><div class="bridge-gap"><div class="bridge-deck"></div><span class="bridge-lantern" aria-hidden="true">✦</span></div><div class="bridge-island bridge-destination"><small>${t.to}</small><div class="arabic" dir="rtl" lang="ar">${connected?esc(text(t.opening)):'؟'}</div><span>Beginning of the next</span></div></div><div class="bridge-tutorial-actions">${phase==='intro'?'<button class="primary" data-tutorial-listen>Start demonstration</button>':''}${['audio-first','audio-second'].includes(phase)?'<p>Listening in order. There is no time limit.</p><button data-tutorial-noaudio>Continue without audio</button>':''}${phase==='model'?'<p>The golden bridge connects the last word to the next opening. These visual cues do not certify recitation stops.</p><button class="primary" data-tutorial-try>Hide the opening · try this bridge</button>':''}${phase==='second'?'<button class="primary" data-tutorial-second>Try the second transition</button>':''}${phase==='choose'?`<div class="bridge-yard">${t.choices.map((c,i)=>`<button data-tutorial-choice="${i}" class="bridge-connector ${i===selected?'bridge-selected':''} ${index===0&&c.key===t.to?'bridge-guided':''}"><b>${index===0&&c.key===t.to?'This opening connects the islands':`Connector ${i+1}`}</b><span class="arabic" dir="rtl" lang="ar">${esc(text(c.words))}</span></button>`).join('')}</div>`:''}${phase==='crossing'?'<p>The connector snaps in. Follow the lantern from right to left.</p><button data-tutorial-cross>Continue · skip animation</button>':''}${phase==='success'?'<p>Tutorial complete. No XP, strikes or memorization grades were recorded.</p><button class="primary" data-tutorial-finish>Open game setup</button>':''}</div>`;
  status.textContent=warning||feedback;
  if(focusHeading)body.querySelector('.bridge-tutorial-step')?.focus({preventScroll:true});
 }
 function model(){stop();phase='model';feedback=noAudio?'Follow the highlighted source words visually.':'Both complete ayahs have finished. Notice the ending and opening.';paint(true);}
 async function playPair(){
  if(closed||!content)return;if(!expose(content.sectors[index]))return;if(timer!==null){clearTimeout(timer);timer=null;}stop();if(noAudio){model();return;}const run=token,t=content.sectors[index];phase='audio-first';feedback='Listen to the complete first ayah.';paint();
  const fail=()=>{if(!closed&&run===token){feedback='Audio could not play. Retry, or choose Continue without audio. No penalty.';paint();}};
  const second=async()=>{if(closed||run!==token)return;phase='audio-second';feedback='Now listen to the complete following ayah.';paint();const ok=await audio.play(t.nextAudio,{muted:false,onEnded:()=>{if(!closed&&run===token)model();},onError:fail});if(!ok)fail();};
  const ok=await audio.play(t.audio,{muted:false,onEnded:second,onError:fail});if(!ok)fail();
 }
 function choose(i){if(phase!=='choose'||!Number.isInteger(i))return;const t=content.sectors[index],c=t.choices[i];if(!c)return;if(c.key!==t.to){feedback='That opening belongs elsewhere. Try another connector—there are no strikes here.';paint();return;}stop();phase='crossing';feedback='Correct connection. Say both ayahs together.';paint(true);timer=setTimeout(finishCrossing,motion.reducedMotion?200:2000);}
 d.addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;if(el.hasAttribute('data-tutorial-skip'))close();else if(el.hasAttribute('data-tutorial-finish'))close('completed');else if(el.hasAttribute('data-tutorial-listen')||el.hasAttribute('data-tutorial-replay'))playPair();else if(el.hasAttribute('data-tutorial-noaudio')){noAudio=true;model();}else if(el.hasAttribute('data-tutorial-try')){stop();phase='choose';selected=0;feedback='The opening is hidden and the bridge is separated. Tap the golden guide.';paint(true);}else if(el.hasAttribute('data-tutorial-second')){index=1;selected=0;phase='choose';feedback='Recall this opening yourself, then select its connector.';paint(true);}else if(el.hasAttribute('data-tutorial-choice'))choose(Number(el.dataset.tutorialChoice));else if(el.hasAttribute('data-tutorial-cross')){clearTimeout(timer);finishCrossing();}else if(el.hasAttribute('data-tutorial-pause')){paused=!paused;if(paused)audio.pause();else audio.resume();d.querySelector('[data-tutorial-pause]').textContent=paused?'Resume recitation':'Pause recitation';}},{signal:scope.signal});
 d.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||e.target.closest('input,select,textarea,button'))return;if(phase==='choose'&&['ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)){e.preventDefault();if(e.code==='Space'||e.code==='Enter')choose(selected);else{selected=(selected+(e.code==='ArrowLeft'?-1:1)+3)%3;paint();body.querySelector('.bridge-tutorial-step')?.focus({preventScroll:true});}}},{signal:scope.signal});
 d.querySelector('[data-tutorial-silent]').onchange=e=>{noAudio=e.target.checked;if(noAudio){stop();if(phase.startsWith('audio'))model();}paint();};
 const level=d.querySelector('[data-tutorial-volume]');level.value=String(Math.round(volume()*100));level.oninput=()=>audio.setVolume(Number(level.value)/100);
 d.addEventListener('cancel',e=>{e.preventDefault();close();},{signal:scope.signal});window.addEventListener('ayahprofilechange',()=>dispose(),{signal:scope.signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();paused=true;if(timer!==null){clearTimeout(timer);timer=null;}if(!closed)d.querySelector('[data-tutorial-pause]').textContent='Resume recitation';}},{signal:scope.signal});
 function dispose(){if(closed)return;stop();if(timer!==null)clearTimeout(timer);closed=true;scope.abort();audio.dispose();d.close();d.remove();}
 document.body.append(d);paint();d.showModal();d.querySelector('h2').focus();
 return {dispose,getSnapshot:()=>({index,phase,noAudio}),close};
}
