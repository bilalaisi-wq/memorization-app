import {automaticContinuation} from './automatic-continuation.js';
import {nextBatch} from './next-batch.js';
import {catalog} from '../content/library.js';
import {mountReadingSetting} from './reading-aids.js';
import {mountGameplayFrame} from './gameplay-frame.js';
import {createGameplayFeedback} from './gameplay-feedback.js';
/** Keeps the existing mission controller authoritative, adapting only view controls. */
export function mountCosmicGameplayFrame({root,game,mission,surface,sequence,send,onExit,replay,volume}) {
 mountReadingSetting(root);
 const feedback=createGameplayFeedback(root),handoff=automaticContinuation();
 const snapshot=()=>{const s=game.getSnapshot();return {session:{id:s.runId||mission.id,status:s.status==='running'?'playing':s.status==='checkpoint'?'won':['ready','paused','lost'].includes(s.status)?s.status:'playing',checkpoint:Math.max(0,mission.refs.indexOf(s.routeComplete?mission.refs.at(-1):s.targetRef||s.pair?.toRef||s.unit?.key||mission.stages?.[s.stageIndex]?.refs?.at(-1))),config:{keys:mission.refs,memoryDifficulty:root.__ayahDifficulty?.memory||'guided',motorDifficulty:root.__ayahDifficulty?.motor||'relaxed'},mistakes:[]}};};
 const actions=root.__ayahRevisionActions;
 const next=()=>{if(!actions)return null;const state=game.getSnapshot();if(!state.routeComplete){if(state.status!=='checkpoint')return null;const stage=mission.stages[state.stageIndex+1];return {stage:true,first:stage?.first||Number(mission.refs[0].split(':')[1]),last:stage?.last||Number(mission.refs.at(-1).split(':')[1]),label:stage?`Continue this passage · ayahs ${stage.first}–${stage.last}`:'Continue this set'};}const first=Number(mission.refs[0].split(':')[1]),last=Number(mission.refs.at(-1).split(':')[1]),chapter=catalog.chapters.find(c=>c.id===Number(mission.refs[0].split(':')[0]));return nextBatch({first,last,total:chapter.verseCount,batchSize:actions.batchSize,minAyahs:actions.minAyahs});};
 const journey=actions?{next,choose:kind=>{if(kind==='continue'){const plan=next();if(plan?.stage){const control=root.querySelector('[data-boundary-next],[data-link-next],[data-flight-next-set],[data-flight-continue]')||[...root.querySelectorAll('button')].find(b=>/^(Next mission set|Continue defense)/.test(b.textContent));if(control)control.click();return;}if(plan)return actions.next(plan);}else if(kind==='replay')return actions.replay();else actions.change();},harder:false}:null;
 const controls=mountGameplayFrame({root,journey,surface:()=>root.querySelector(surface)||root,sequence:()=>root.querySelector(sequence)||root,getState:snapshot,dispatch:a=>a.type==='listen'?replay():send(a),onExit,volume});
 return {update(){const s=game.getSnapshot();const continuing=root.__ayahContinuous&&s.status==='checkpoint'&&!s.routeComplete;handoff.update(`${s.runId||mission.id}:${s.stageIndex}:${s.roundIndex}`,continuing,()=>{if(game.nextStage?.()){send({type:'resume'});}});controls.update(snapshot());if(root.__ayahContinuousError)root.querySelectorAll('[data-flight-continue],[data-flight-next-set],[data-boundary-next],[data-game-journey=continue]').forEach(b=>b.disabled=true);},event(e){
  const target=root.querySelector(sequence)||root.querySelector(surface);
  if(['runner:pickup-mistake','defense:capture-mistake','link:mistake'].includes(e.type))feedback.mistake();
  if(['runner:pickup-correct','defense:piece-captured','defense:memory-correct','link:transition-correct','link:reactor-correct','link:endpoint-correct'].includes(e.type)&&e.category!=='self-assessed-spoken'){
   const options={id:`${game.getSnapshot().runId||mission.id}:${e.evidenceId||e.scoreReceipt||e.unitId||e.targetRef}:${e.type}`};
   if(e.ayahComplete)feedback.complete(target,options);else feedback.correct(target,options);
  }
 },dispose(){handoff.dispose();controls.dispose();feedback.dispose();}};
}
