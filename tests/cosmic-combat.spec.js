import {test,expect} from '@playwright/test';
import {createFlowUnits,flowChoices} from '../src/quest/cosmic/flow-content.js';
import {createFlowRunner} from '../src/puzzles/arcade/cosmic/flow-runner.js';
import {createMission} from '../src/quest/cosmic/mission.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
import {createFlightBonuses} from '../src/quest/cosmic/bonuses.js';
const step=g=>g.dispatch({type:'tick',dt:1/120});
function lane(g,l){while(g.getSnapshot().lane!==l)g.dispatch({type:'lane',direction:Math.sign(l-g.getSnapshot().lane)});}
function until(g,p,max=6000){for(let i=0;i<max;i++){if(p(g.getSnapshot()))return g.getSnapshot();step(g);}throw Error('Simulation did not reach expected state');}
test('word, chunk and whole ayah collect on first contact without a lane confirmation',()=>{
  for(const mode of ['words','mixed','ayahs']){
    let game;
    for(let attempt=1;attempt<50;attempt++){
      const seed=Math.imul(attempt,2654435761)>>>0;
      const g=createFlowRunner({units:[createFlowUnits(['1:3'],mode)[0]],stageId:mode,seed});
      if(g.getSnapshot().objects.find(o=>o.kind==='pickup'&&o.unit.id===g.getSnapshot().unit.id)?.lane===1){game=g;break;}
    }
    game.start();const result=until(game,s=>s.status==='checkpoint');
    expect(result.cursor).toBe(1);expect(result.memoryMistakes).toBe(0);
  }
});
test('blaster projectiles move, strike only asteroids, respect cooldown and keep text intact',()=>{
  const events=[],g=createFlowRunner({units:createFlowUnits(['1:3'],'words'),stageId:'combat',seed:5,onEvent:e=>events.push(e)});g.start();
  const rock=g.getSnapshot().objects.find(o=>o.kind==='asteroid');lane(g,rock.lane);
  for(let i=0;i<30;i++)step(g);
  g.dispatch({type:'fire'});g.dispatch({type:'fire'});
  expect(g.getSnapshot().objects.filter(o=>o.kind==='bolt')).toHaveLength(1);
  until(g,s=>s.destroyed===1);
  expect(g.getSnapshot().score).toBe(10);expect(g.getSnapshot().shield).toBe(3);
  expect(g.getSnapshot().objects.filter(o=>o.kind==='pickup')).toHaveLength(3);
  expect(events.filter(e=>e.type==='runner:asteroid-destroyed')).toHaveLength(1);
  g.pause();const snapshot=g.getSnapshot();g.dispatch({type:'fire'});for(let i=0;i<30;i++)step(g);expect(g.getSnapshot()).toEqual(snapshot);
  g.dispose();expect(g.getSnapshot().objects.some(o=>['bolt','burst'].includes(o.kind))).toBe(false);
});
test('boost accelerates travel, burns and regenerates fuel, rewards correct pickups with a star burst only',()=>{
  for(const mode of ['words','mixed','ayahs']){
    const events=[],g=createFlowRunner({units:[createFlowUnits(['1:3'],mode)[0]],stageId:mode,seed:5,onEvent:e=>events.push(e)});g.start();
    // Avoid rocks and wait until the canonical target approaches the ship.
    until(g,s=>{
      const target=s.objects.find(o=>o.kind==='pickup'&&o.unit.id===s.unit.id);
      const danger=s.objects.find(o=>o.kind==='asteroid'&&o.y>400&&o.y<670);
      if(danger)lane(g,(danger.lane+1)%3);else if(target)lane(g,target.lane);
      return target&&target.y>490;
    });
    g.dispatch({type:'boost',active:true});const before=g.getSnapshot().elapsed;
    step(g);expect(g.getSnapshot().elapsed-before).toBeGreaterThan(1/120);
    const done=until(g,s=>s.status==='checkpoint');
    expect(done.boostedPickups).toBe(1);expect(done.score).toBe(40);
    expect(done.objects.some(o=>o.kind==='starburst')).toBe(true);
    expect(events.find(e=>e.type==='runner:pickup-correct')).toMatchObject({boosted:true,points:40});
  }
  const g=createFlowRunner({units:createFlowUnits(['1:3'],'words'),stageId:'fuel'});g.start();g.dispatch({type:'boost',active:true});
  for(let i=0;i<120;i++)step(g);expect(g.getSnapshot().boostEnergy).toBeCloseTo(3);
  g.pause();expect(g.getSnapshot().boosting).toBe(false);g.resume();for(let i=0;i<60;i++)step(g);expect(g.getSnapshot().boostEnergy).toBeGreaterThan(3);
});
test('wrong boosted text never receives a boost reward or starburst',()=>{
  const events=[],g=createFlowRunner({units:createFlowUnits(['1:3'],'words'),stageId:'wrong',seed:7,onEvent:e=>events.push(e)});g.start();
  until(g,s=>{const wrong=s.objects.find(o=>o.kind==='pickup'&&o.unit.id!==s.unit.id);if(wrong)lane(g,wrong.lane);return wrong&&wrong.y>490;});
  g.dispatch({type:'boost',active:true});until(g,s=>s.memoryMistakes>0);
  expect(g.getSnapshot().score).toBe(0);expect(g.getSnapshot().objects.some(o=>o.kind==='starburst')).toBe(false);
  expect(events.some(e=>e.type==='runner:pickup-correct')).toBe(false);
});
test('bonus XP is capped, idempotent across reloads and isolated across accounts',async()=>{
  const mission=await createMission({surahId:1,selection:'custom',start:3,end:3});
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};let owner='a';
  const clock=()=>new Date('2026-11-03T12:00:00Z');
  const recorder=createFlightBonuses(mission,{storage,getOwner:()=>owner,clock});
  const event={type:'runner:pickup-correct',boosted:true,awardedPoints:40,scoreReceipt:'pickup:1:3:0',targetRef:'1:3',stageIndex:0,roundIndex:0};
  expect((await recorder.record(event)).xp).toBe(4);
  expect((await createFlightBonuses(mission,{storage,getOwner:()=>owner,clock}).record(event)).duplicate).toBe(true);
  expect((await recorder.record({...event,boosted:false})).xp).toBe(0);
  expect((await recorder.record({...event,type:'runner:asteroid-destroyed',scoreReceipt:'rock:0:0',awardedPoints:10})).xp).toBe(2);
  owner='b';await expect(recorder.record({...event,roundIndex:1})).rejects.toThrow('Account changed');
  owner='a';expect((await recorder.record({...event,roundIndex:1})).xp).toBe(0); // existing cooldown
  const capped=createFlightBonuses(mission,{storage,getOwner:()=>owner,clock:()=>new Date('2026-11-03T12:00:01Z')});
  expect((await capped.record({...event,roundIndex:1})).xp).toBe(4);
  const cappedAgain=createFlightBonuses(mission,{storage,getOwner:()=>owner,clock:()=>new Date('2026-11-03T12:00:02Z')});
  expect((await cappedAgain.record({...event,roundIndex:2})).xp).toBe(0);
});

test('consecutive correct pickups in the current lane never require re-arming',()=>{
  const units=createFlowUnits(['1:3'],'words');let game;
  for(let attempt=1;attempt<200;attempt++){
    const seed=Math.imul(attempt,2654435761)>>>0;
    if(flowChoices(units[0],seed).findIndex(u=>u.id===units[0].id)!==1||flowChoices(units[1],(seed+7919+101)>>>0).findIndex(u=>u.id===units[1].id)!==1)continue;
    game=createFlowRunner({units,stageId:'same-lane',seed});break;
  }
  expect(game).toBeTruthy();game.start();
  const done=until(game,s=>s.status==='checkpoint');expect(done.collected).toEqual(units.map(u=>u.id));expect(done.memoryMistakes).toBe(0);
});
test('restarting a round cannot duplicate mission arcade points',async()=>{
  const mission=await createMission({surahId:1,selection:'custom',start:3,end:3}),game=await createFlightController(mission,{pickupMode:'ayahs'});game.start();
  function collect(){until(game,s=>{const target=s.objects.find(o=>o.kind==='pickup'&&o.unit.id===s.unit?.id),rock=s.objects.find(o=>o.kind==='asteroid'&&o.y>400&&o.y<670);if(rock)lane(game,(rock.lane+1)%3);else if(target)lane(game,target.lane);return s.status==='checkpoint';});}
  collect();expect(game.getSnapshot().arcadeScore).toBe(20);game.dispatch({type:'restart'});collect();expect(game.getSnapshot().arcadeScore).toBe(20);
});
