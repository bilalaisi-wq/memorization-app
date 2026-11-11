import {romanHTML} from '../../../quest/cosmic/transliteration.js';
import {captureCosmicFocus,restoreCosmicFocus} from '../../../quest/cosmic/focus.js';
import {reportStudyExposure} from '../../../study-exposure.js';
import {esc} from '../../../ui/dom.js';
import {createAudioManager} from '../services.js';
import {readLabVolume} from '../../audio-level.js';
import {profileStorage} from '../../../learner/profile-storage.js';
import './gateways.css';

export function createGatewayPanel(root,send,{onNavigate=()=>{},embedded=false}={}){
  const panel=document.createElement('section');panel.className='cosmic-memory-gateway';panel.hidden=true;panel.setAttribute('aria-label','Untimed Quran memory gateway');
  if(embedded){panel.classList.add('gateway-embedded');root.querySelector('.runner-field').append(panel);}else root.querySelector('.runner-field').after(panel);
  let volume=readLabVolume(profileStorage);
  const audio=createAudioManager({owner:'cosmic-memory-gateway',initialVolume:volume});
  let key='',token=0,disposed=false,blocked=false;
  const stop=()=>{token++;audio.stop();const status=panel.querySelector('[data-gateway-audio-status]');if(status)status.textContent='Recitation stopped.';};
  function paint(snapshot){
    const g=snapshot.gateway;
    if(snapshot.status!=='gateway'||!g){if(!panel.hidden)stop();panel.hidden=true;key='';return;}
    panel.hidden=false;
    const exposed=[g.current.previous?.ref,...g.candidates.map(v=>v.ref),...((g.hint||g.state==='open')?[g.current.target.ref]:[])].filter(Boolean);
    try { reportStudyExposure(exposed); blocked=false; }
    catch(error) {
      blocked=true;key='blocked';stop();
      panel.innerHTML=`<h4 data-gateway-heading tabindex="-1">Study assistance needs to be saved</h4><p role="alert">${esc(error.message)}</p><p>The flight is safely paused. Export or recover your progress before revealing this ayah.</p><button class="cosmic-secondary" data-gateway-refresh>Try showing the gateway again</button>`;
      panel.querySelector('[data-gateway-refresh]').onclick=()=>{key='';send({type:'gateway-refresh'});};
      return;
    }
    const nextKey=`${g.state}:${g.cursor}:${g.lane}:${g.assisted}`;
    if(key===nextKey)return;
    const changedQuestion=!key||key.split(':')[1]!==String(g.cursor),changedState=key.split(':')[0]!==g.state;
    const focus=captureCosmicFocus(panel);key=nextKey;stop();
    const c=g.current;
    panel.dataset.targetRef=c.target.ref;panel.dataset.fromRef=c.previous?.ref||'';panel.dataset.gatewayState=g.state;
    panel.innerHTML=`<span class="cosmic-eyebrow">SAFE ORBIT · UNTIMED</span><h4 tabindex="-1" data-gateway-heading>Memory gateway ${g.cursor+1} of ${g.total}</h4><p>${c.previous?'Recite the next ayah aloud from memory. Take your time before looking at the gateways.':'Recite the opening ayah of '+esc(c.target.name)+' aloud from memory. Take your time before looking at the gateways.'}</p><p>Hazards and flight time are paused. This is sequence practice, not independent recitation certification.</p>${c.previous?`<div class="gateway-preceding"><strong>Preceding ayah · ${esc(c.previous.name)} ${c.previous.ref}</strong><p class="gateway-arabic" lang="ar" dir="rtl">${esc(c.previous.text)}</p>${romanHTML(c.previous)}<button class="cosmic-secondary" data-gateway-previous>Listen to preceding ayah</button></div>`:'<p>This is the beginning of the surah; no preceding ayah is invented.</p>'}<p class="gateway-coverage">${g.completed.length} / ${g.total} gateway reviews complete · Earlier answers stay saved in this flight.</p>${g.state==='prompt'?'<button class="cosmic-primary" data-gateway-ready>Ready — show gateways</button>':''}${g.state==='choices'?`<p>Steer with ← / →, A / D, swipe, or the lane buttons. Enter / ↑ opens the selected gateway. You can also select a card below.</p><div class="gateway-choices">${g.candidates.map((v,i)=>`<article class="gateway-choice ${i===g.lane?'gateway-selected':''}"><button class="cosmic-secondary" data-gateway-select="${i}" data-ayah-ref="${v.ref}" aria-pressed="${i===g.lane}"><span>Gateway ${i+1}</span><span class="gateway-arabic" lang="ar" dir="rtl">${esc(v.text)}</span>${romanHTML(v)}</button><button class="cosmic-secondary" data-gateway-audio="${i}">Listen to gateway ${i+1}</button></article>`).join('')}</div><div class="gateway-steering"><button class="cosmic-secondary" data-gateway-left aria-label="Steer gateway left">← Left</button><button class="cosmic-primary" data-gateway-choose>Enter gateway ${g.lane+1}</button><button class="cosmic-secondary" data-gateway-right aria-label="Steer gateway right">Right →</button></div>`:''}${g.state==='repair'?'<div class="gateway-repair" role="status"><strong>Safe repair checkpoint</strong><p>That ayah does not continue this sequence. Your earlier connections and flight position are preserved. Listen, use a hint, then try again.</p></div><button class="cosmic-primary" data-gateway-retry>Try this gateway again</button>':''}${['prompt','choices','repair'].includes(g.state)?'<button class="cosmic-secondary" data-gateway-hint>Hint — reveal this ayah</button>':''}${g.hint?`<div class="gateway-hint"><strong>Study hint · ${esc(c.target.name)} ${c.target.ref}</strong><p class="gateway-arabic" lang="ar" dir="rtl">${esc(g.hint.text)}</p>${romanHTML(c.target)}<button class="cosmic-secondary" data-gateway-hint-audio>Listen to hint</button></div>`:''}${g.state==='open'?`<div class="gateway-success" role="status"><div class="gateway-constellation" aria-hidden="true">✦ ─ ✧ ─ ✦</div><h4>Connection restored</h4><p>${esc(c.target.name)} · ${c.target.ref}</p><p class="gateway-arabic" lang="ar" dir="rtl">${esc(c.target.text)}</p>${romanHTML(c.target)}</div><button class="cosmic-primary" data-gateway-continue>Continue flight · skip animation</button>`:''}<div class="gateway-audio-controls"><label>Recitation volume<input data-gateway-volume type="range" min="0" max="100" value="${Math.round(volume*100)}"></label><button class="cosmic-secondary" data-gateway-stop>Stop recitation</button></div><p data-gateway-audio-status role="status"></p>`;
    if(embedded){const preceding=panel.querySelector('.gateway-preceding');if(preceding){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Preceding ayah · optional context';preceding.before(details);details.append(summary,preceding);}}
    const bind=(selector,action)=>panel.querySelector(selector)?.addEventListener('click',()=>{stop();send({type:`gateway-${action}`});if(action==='hint')panel.querySelector('[data-gateway-heading]')?.focus();});
    panel.querySelector('[data-gateway-left]')?.addEventListener('click',()=>{send({type:'lane',direction:-1});onNavigate();});
    panel.querySelector('[data-gateway-right]')?.addEventListener('click',()=>{send({type:'lane',direction:1});onNavigate();});
    bind('[data-gateway-ready]','ready');bind('[data-gateway-choose]','choose');bind('[data-gateway-retry]','retry');bind('[data-gateway-hint]','hint');bind('[data-gateway-continue]','continue');
    panel.querySelectorAll('[data-gateway-select]').forEach(b=>b.onclick=()=>{stop();send({type:'gateway-select',lane:Number(b.dataset.gatewaySelect)});onNavigate();});
    async function listen(verse){
      stop();const run=token;const status=panel.querySelector('[data-gateway-audio-status]');status.textContent='Playing verified full-ayah recitation…';
      const ok=await audio.play(verse.audio,{onEnded:()=>{if(run===token&&!disposed)status.textContent='Recitation finished.';}});
      if(run===token&&!disposed&&!ok)status.textContent='Audio could not play. You can still read, recall and continue at your own pace.';
    }
    panel.querySelector('[data-gateway-previous]')?.addEventListener('click',()=>listen(c.previous));
    panel.querySelector('[data-gateway-hint-audio]')?.addEventListener('click',()=>listen(g.hint));
    panel.querySelectorAll('[data-gateway-audio]').forEach(b=>b.onclick=()=>listen(g.candidates[Number(b.dataset.gatewayAudio)]));
    panel.querySelector('[data-gateway-stop]').onclick=()=>{stop();panel.querySelector('[data-gateway-audio-status]').textContent='Recitation stopped.';};
    panel.querySelector('[data-gateway-volume]').oninput=e=>{volume=Number(e.target.value)/100;audio.setVolume(volume);};
    if(changedQuestion||changedState)panel.querySelector('[data-gateway-heading]').focus();else restoreCosmicFocus(panel,focus);
  }
  return {paint,stop,get blocked(){return blocked;},dispose(){disposed=true;stop();audio.dispose();panel.remove();}};
}
