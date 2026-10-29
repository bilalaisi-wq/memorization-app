export const LAB_VOLUME_KEY='ayah-lab-volume';
export const clampVolume=(value,fallback=.5)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
export function readLabVolume(storage){
  try{const raw=storage.getItem(LAB_VOLUME_KEY);return raw===null||raw.trim()==='' ? 0.5 : clampVolume(raw);}catch{return .5;}
}
const needsGain=()=>typeof navigator!=='undefined'&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
// iOS media-element volume follows device volume; a gain stage supplies the in-app level.
// Other platforms use native media volume. Mock/unsupported media fall back without blocking playback.
export function createAudioLevel({initialVolume=1,useGain=needsGain(),AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,MediaElementClass=globalThis.HTMLMediaElement}={}){
  let level=clampVolume(initialVolume,1),media=null,context=null,gain=null,source=null,disposed=false;
  const detach=()=>{try{source?.disconnect();}catch{}source=null;media=null;};
  return {
    attach(audio){
      detach();if(disposed)return;
      media=audio;audio.volume=level;
      if(useGain&&AudioContextClass&&MediaElementClass&&audio instanceof MediaElementClass){
        try{
          context||=new AudioContextClass();gain||=context.createGain();
          gain.disconnect();gain.connect(context.destination);gain.gain.value=level;
          source=context.createMediaElementSource(audio);source.connect(gain);audio.volume=1;
          Promise.resolve(context.resume()).catch(()=>{});
        }catch{try{source?.disconnect();}catch{}source=null;audio.volume=level;}
      }
    },
    setVolume(value){level=clampVolume(value);if(gain&&source)gain.gain.value=level;else if(media)media.volume=level;},
    detach,
    resume(){if(context)Promise.resolve(context.resume()).catch(()=>{});},
    dispose(){if(disposed)return;disposed=true;detach();try{gain?.disconnect();}catch{}if(context)Promise.resolve(context.close()).catch(()=>{});context=null;gain=null;},
  };
}
