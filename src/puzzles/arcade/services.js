import {studyAudioStart,studyAudioStop} from '../../ui/encouragement.js';
export function createAudioManager({AudioClass=globalThis.Audio,owner='arcade'}={}) {
  let audio=null,disposed=false,run=0;
  const stop=()=>{run++;if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute?.('src');audio.load?.();audio=null;}studyAudioStop(owner);};
  return {
    async play(url,{loop=false,muted=false,onEnded=()=>{},onError=()=>{}}={}) {
      stop();if(disposed)return false;
      const token=run;
      audio=new AudioClass(url);audio.loop=loop;audio.muted=muted;
      audio.onended=()=>{if(token===run){stop();onEnded();}};audio.onerror=()=>{if(token===run){stop();onError();}};
      studyAudioStart(owner);
      try{await audio.play();return token===run && !disposed;}catch{if(token===run)stop();return false;}
    },
    stop, pause(){audio?.pause();},
    async resume(){try{await audio?.play();}catch{stop();}},
    mute(value){if(audio)audio.muted=!!value;},
    dispose(){disposed=true;stop();},
  };
}
export function bindArcadeInput(root,dispatch,{target=globalThis.document}={}) {
  const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'soft',Space:'drop',KeyP:'pause',KeyC:'hold'};
  const key=e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.('input,select,textarea,button,a,[contenteditable="true"],dialog'))return;
    if(keys[e.code]){e.preventDefault();dispatch({type:keys[e.code],input:'keyboard'});}
  };
  const pointer=e=>{
    const button=e.target.closest?.('[data-arcade-action]');
    if(!button || button.disabled || !root.contains(button))return;
    e.preventDefault();dispatch({type:button.dataset.arcadeAction,input:e.pointerType==='touch'?'touch':'pointer'});
  };
  // Native click supports assistive technology / Enter without duplicating pointerup.
  const click=e=>{if(e.detail===0){const b=e.target.closest?.('[data-arcade-action]');if(b&&!b.disabled)dispatch({type:b.dataset.arcadeAction,input:'keyboard'});}};
  target.addEventListener('keydown',key);root.addEventListener('pointerup',pointer);root.addEventListener('click',click);
  return ()=>{target.removeEventListener('keydown',key);root.removeEventListener('pointerup',pointer);root.removeEventListener('click',click);};
}
export function motionSettings(media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')) {
  return {reducedMotion:!!media?.matches,transitionMs:media?.matches?0:180};
}
// Lifecycle owned by the mounted game; no orphan intervals on navigation.
export function createTicker(callback,ms=100,clock=globalThis) {
  let timer=null;
  return {start(){if(timer===null)timer=clock.setInterval(callback,ms);},pause(){if(timer!==null)clock.clearInterval(timer);timer=null;},dispose(){this.pause();}};
}
