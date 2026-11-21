import {mountReadingSetting} from './reading-aids.js';
import {mountGameplayFrame} from './gameplay-frame.js';
import {createGameplayFeedback} from './gameplay-feedback.js';
/** Keeps the existing mission controller authoritative, adapting only view controls. */
export function mountCosmicGameplayFrame({root,game,mission,surface,sequence,send,onExit,replay,volume}) {
 mountReadingSetting(root);
 const feedback=createGameplayFeedback(root);
 const snapshot=()=>{const s=game.getSnapshot();return {session:{id:s.runId||mission.id,status:s.status==='running'?'playing':s.status==='checkpoint'?'won':['ready','paused','lost'].includes(s.status)?s.status:'playing',checkpoint:Math.max(0,mission.refs.indexOf(s.targetRef||s.pair?.toRef||s.unit?.key)),config:{keys:mission.refs},mistakes:[]}};};
 const controls=mountGameplayFrame({root,surface:()=>root.querySelector(surface)||root,sequence:()=>root.querySelector(sequence)||root,getState:snapshot,dispatch:a=>a.type==='listen'?replay():send(a),onExit,volume});
 return {update(){controls.update(snapshot());},event(e){
  const target=root.querySelector(sequence)||root.querySelector(surface);
  if(['runner:pickup-mistake','defense:capture-mistake','link:mistake'].includes(e.type))feedback.mistake();
  if(['runner:pickup-correct','defense:piece-captured','defense:memory-correct','link:transition-correct','link:reactor-correct'].includes(e.type)&&e.category!=='self-assessed-spoken'){
   const options={id:`${game.getSnapshot().runId||mission.id}:${e.evidenceId||e.scoreReceipt||e.unitId||e.targetRef}:${e.type}`};
   if(e.ayahComplete)feedback.complete(target,options);else feedback.correct(target,options);
  }
 },dispose(){controls.dispose();feedback.dispose();}};
}
