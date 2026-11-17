import {registerPlugin} from '@capacitor/core';
const NativeFocus=registerPlugin('AyahAudioFocus');
// Native interruptions pause supported study. Recovery is always learner initiated.
export async function initializeAudioFocus({plugin=NativeFocus,target=window,documentRef=document}={}){
 let disposed=false,hasFocus=false,requesting=false,generation=0;
 const pause=()=>{generation++;hasFocus=false;target.dispatchEvent(new Event('ayah-study-overlay'));documentRef.querySelectorAll('audio,video').forEach(media=>media.pause());target.dispatchEvent(new Event('ayah-audio-interrupted'));};
 const handle=await plugin.addListener('interruption',({interrupted})=>{if(interrupted)pause();});
 const start=async()=>{if(hasFocus||disposed||requesting)return;const token=++generation;requesting=true;try{const result=await plugin.requestFocus();if(disposed||token!==generation){await plugin.releaseFocus();return;}hasFocus=result.granted===true;if(!hasFocus)pause();}catch{if(token===generation)pause();}finally{requesting=false;}};
 const stop=()=>{generation++;hasFocus=false;void plugin.releaseFocus().catch(()=>{});};
 const background=()=>{pause();stop();};
 target.addEventListener('ayah-study-audio-start',start);target.addEventListener('ayah-study-audio-stop',stop);target.addEventListener('ayah-native-background',background);
 return ()=>{disposed=true;target.removeEventListener('ayah-study-audio-start',start);target.removeEventListener('ayah-study-audio-stop',stop);target.removeEventListener('ayah-native-background',background);stop();void handle.remove();};
}
