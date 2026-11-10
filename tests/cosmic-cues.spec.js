import {test,expect} from '@playwright/test';
import {createFlowUnits} from '../src/quest/cosmic/flow-content.js';
import {targetCueSources,createTargetCuePlayer} from '../src/quest/cosmic/target-cues.js';
import {createFlowRunner,BOOST_CAPACITY} from '../src/puzzles/arcade/cosmic/flow-runner.js';
test('cue sources exactly match canonical word, visual chunk and full-ayah recordings',()=>{
  for(const mode of ['words','mixed','ayahs'])for(const unit of createFlowUnits(['83:10','83:11'],mode)){
    const words=createFlowUnits([unit.key],'words');
    expect(targetCueSources(unit)).toEqual(unit.kind==='ayah'?[unit.audio]:words.slice(unit.index,unit.kind==='word'?unit.index+1:unit.endIndex).map(w=>w.audio));
    expect(()=>targetCueSources({...unit,text:'invented'})).toThrow();
  }
});
test('chunk cues wait for each clip end and ignore stale callbacks after stop/dispose',async()=>{
  const calls=[];let complete=0,failed=0;
  const audio={stop(){},async play(src,events){calls.push({src,...events});return true;}};
  const player=createTargetCuePlayer(audio),chunk=createFlowUnits(['1:3'],'mixed')[0];
  player.play(chunk,{onComplete:()=>complete++,onFailure:()=>failed++});await Promise.resolve();
  expect(calls).toHaveLength(1);expect(complete).toBe(0);
  calls[0].onEnded();await Promise.resolve();expect(calls).toHaveLength(2);expect(complete).toBe(0);
  calls[1].onEnded();expect(complete).toBe(1);
  player.play(chunk,{onComplete:()=>complete++});const old=calls.at(-1);player.stop();old.onEnded();expect(complete).toBe(1);
  player.dispose();expect(failed).toBe(0);
});
test('unavailable audio reports failure without certifying recall',async()=>{
  let failed=0,completed=0;const p=createTargetCuePlayer({stop(){},async play(){return false;}});
  p.play(createFlowUnits(['1:3'],'words')[0],{onComplete:()=>completed++,onFailure:()=>failed++});await Promise.resolve();await Promise.resolve();
  expect(failed).toBe(1);expect(completed).toBe(0);p.dispose();
});
test('cue slowdown keeps moving at quarter pace, restores round speed and boost lasts four seconds',()=>{
  const g=createFlowRunner({units:createFlowUnits(['1:3'],'words'),stageId:'cue',roundIndex:2});g.start();g.dispatch({type:'cue',active:true});
  const before=g.getSnapshot().elapsed;for(let i=0;i<120;i++)g.dispatch({type:'tick',dt:1/120});
  expect(g.getSnapshot().status).toBe('running');expect(g.getSnapshot().elapsed-before).toBeCloseTo(.175);
  g.dispatch({type:'cue',active:false});const slow=g.getSnapshot().elapsed;for(let i=0;i<120;i++)g.dispatch({type:'tick',dt:1/120});expect(g.getSnapshot().elapsed-slow).toBeCloseTo(.7);
  expect(BOOST_CAPACITY).toBe(4);g.dispatch({type:'boost',active:true});for(let i=0;i<120;i++)g.dispatch({type:'tick',dt:1/120});expect(g.getSnapshot().boostEnergy).toBeCloseTo(3);g.dispose();
});
