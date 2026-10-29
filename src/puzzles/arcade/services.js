import {resolvePlaybackSource} from "../../content/private-audio.js";
import {createAudioLevel} from "../audio-level.js";
import {studyAudioStart,studyAudioStop} from '../../ui/encouragement.js';
export function createAudioManager({AudioClass=globalThis.Audio,owner='arcade',initialVolume=1}={}) {
  let audio=null,disposed=false,run=0,paused=false,deferred=null,desiredMuted=false;
  const level=createAudioLevel({initialVolume});
  const stop=()=>{run++;paused=false;deferred?.(false);deferred=null;level.detach();if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute?.('src');audio.load?.();audio=null;}studyAudioStop(owner);};
  return {
    async play(url,{loop=false,muted=false,onEnded=()=>{},onError=()=>{}}={}) {
      stop();if(disposed)return false;
      const token=run;desiredMuted=muted;
      let source;try{source=await resolvePlaybackSource(url);}catch{if(token===run){stop();onError();}return false;}
      if(token!==run||disposed)return false;
      audio=new AudioClass(source);level.attach(audio);audio.loop=loop;audio.muted=desiredMuted;
      audio.onended=()=>{if(token===run){stop();onEnded();}};audio.onerror=()=>{if(token===run){stop();onError();}};
      if(paused)return new Promise(resolve=>deferred=resolve);
      studyAudioStart(owner);
      try{await audio.play();return token===run && !disposed;}catch{if(token===run)stop();return false;}
    },
    stop, pause(){paused=true;audio?.pause();},
    async resume(){paused=false;level.resume();try{if(audio){studyAudioStart(owner);await audio.play();const complete=deferred;deferred=null;complete?.(true);}}catch{stop();}},
    mute(value){desiredMuted=!!value;if(audio)audio.muted=desiredMuted;},
    setVolume:value=>level.setVolume(value),
    dispose(){disposed=true;stop();level.dispose();},
  };
}
export function bindArcadeInput(root,dispatch,{target=globalThis.document}={}) {
  const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',KeyB:'rotate',KeyN:'rotate',ArrowDown:'soft',Space:'drop',KeyP:'pause',KeyC:'hold'};
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
