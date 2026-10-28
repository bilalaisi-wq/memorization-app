import {createController,createSession} from './session.js';
import {createAudioManager,bindArcadeInput,motionSettings} from './services.js';
import {esc} from '../../ui/dom.js';
// Contract illustration only. Not one of the six planned games; developer-only.
export const registrationExample = {
  id:'arcade-example',title:'Arcade contract preview',developerOnly:true,
  create({root,adapter,config,id,muted=()=>false,onComplete=()=>{}}) {
    const audio=createAudioManager(),motion=motionSettings();
    let cursor=0,receiptPending=false;
    root.classList.add('arcade-preview');
    root.dataset.reducedMotion=String(motion.reducedMotion);
    root.style.setProperty('--arcade-transition',`${motion.transitionMs}ms`);
    const draw=s=>{
      const key=config.keys[s.checkpoint];
      root.innerHTML=`<h3>Framework preview · ${esc(key)}</h3><p>Developer contract example, not a new arcade game. All Arabic is unchanged source text.</p><p role="status" aria-live="polite">${esc(s.status)} · ${s.strikes}/3 strikes · ${s.completed.length}/${config.keys.length} checkpoints</p><div class="lab-bank" dir="rtl" lang="ar">${adapter.choices(key,{seed:config.seed}).map((w,i)=>`<button class="lab-word" data-choice-id="${i}" ${s.status!=='playing'?'disabled':''}><span class="arabic">${esc(w.text)}</span></button>`).join('')}</div><div class="arcade-controls">${['start','pause','resume','retry','listen'].map(type=>`<button class="text-button" data-arcade-action="${type}">${type}</button>`).join('')}${s.status==='won'?'<button class="primary" data-arcade-action="save">Save result</button>':''}</div><p data-save-status role="status"></p>`;
    };
    const controller=createController({initial:createSession({id,game:'arcade-example',config}),render:draw,onDispose:()=>{unbind();root.removeEventListener('click',choice);audio.dispose();root.replaceChildren();}});
    const send=action=>{
      const s=controller.getSnapshot();
      if(s.status==='disposed')return;
      if(action.type==='save') {
        if(receiptPending)return;
        receiptPending=true;
        try{onComplete(s);root.querySelector('[data-save-status]').textContent='Saved. Arcade practice does not certify memorization.';}catch(e){root.querySelector('[data-save-status]').textContent=e.message;}finally{receiptPending=false;}
        return;
      }
      if(action.type==='listen' && s.status==='playing'){controller.dispatch({type:'assist',kind:'audio'});audio.play(adapter.audio(config.keys[s.checkpoint]),{muted:muted()});return;}
      if(s.status==='won' || s.status==='lost') audio.stop();
      if(action.type==='pause')audio.pause();
      if(action.type==='resume')audio.resume();
      if(action.type==='retry'){cursor=0;audio.stop();}
      controller.dispatch(action);
    };
    const choice=e=>{
      const b=e.target.closest('[data-choice-id]'),s=controller.getSnapshot();
      if(!b||s.status!=='playing')return;
      const key=config.keys[s.checkpoint],word=adapter.choices(key,{seed:config.seed})[Number(b.dataset.choiceId)];
      if(word.target && word.index===cursor) {
        cursor++;
        if(cursor===adapter.words(key).length){cursor=0;audio.stop();controller.dispatch({type:'checkpoint'});}
        else draw(s);
      }else {const next=controller.dispatch({type:'mistake'});if(next.status==='lost')audio.stop();}
    };
    const unbind=bindArcadeInput(root,send);
    root.addEventListener('click',choice);
    draw(controller.getSnapshot());
    return {...controller,listen:()=>send({type:"listen"}),mute:()=>audio.mute(muted()),pause:()=>send({type:"pause"}),resume:()=>send({type:"resume"}),dispatch:send};
  },
};
