import {test,expect} from '@playwright/test';
import {createRunner,buildRunnerWaves,WORLD,PATTERNS} from '../src/puzzles/arcade/cosmic/runner.js';
import {createMission} from '../src/quest/cosmic/mission.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
function advance(game,seconds){for(let t=0;t<seconds;t+=1/60)game.dispatch({type:'tick',dt:1/60});}
function pilot(game){
  for(let n=0;n<2400&&game.getSnapshot().status==='running';n++){
    const s=game.getSnapshot();
    if(s.nextSafeLane!==null){let delta=s.nextSafeLane-s.lane;while(delta){game.dispatch({type:'lane',direction:Math.sign(delta)});delta-=Math.sign(delta);}}
    game.dispatch({type:'tick',dt:1/60});
  }
  return game.getSnapshot();
}
test('seeded patterns are deterministic and always leave a safe lane with sufficient reaction gaps',()=>{
  const seen=new Set();
  for(let seed=0;seed<100;seed++)for(const slow of [false,true]){
    const waves=buildRunnerWaves(seed,9,slow);
    expect(waves).toEqual(buildRunnerWaves(seed,9,slow));
    for(const w of waves){
      seen.add(w.pattern);
      expect(w.objects.filter(o=>o.kind==='asteroid').every(o=>o.lane!==w.safeLane)).toBe(true);
      expect(w.objects.find(o=>o.kind==='star').lane).toBe(w.safeLane);
      expect(w.objects.every(o=>o.drift+o.radius+17<180)).toBe(true);
    }
    expect(waves[1].arrival-waves[0].arrival).toBeGreaterThan(2);
  }
  expect([...seen].sort()).toEqual([...PATTERNS].sort());
});
test('ship actually moves smoothly, respects lanes, and scenery objects scroll and drift',()=>{
  const game=createRunner({seed:1});game.start();
  game.dispatch({type:'lane',direction:-1});
  expect(game.getSnapshot().x).toBe(300);
  game.dispatch({type:'tick',dt:.05});
  expect(game.getSnapshot().x).toBeLessThan(300);
  expect(game.getSnapshot().x).toBeGreaterThan(120);
  advance(game,1);expect(game.getSnapshot().x).toBe(120);
  game.dispatch({type:'lane',direction:-1});expect(game.getSnapshot().lane).toBe(0);
  const a=game.getSnapshot().objects.find(o=>o.drift);
  expect(a).toBeTruthy();advance(game,.1);
  const b=game.getSnapshot().objects.find(o=>o.id===a.id);
  expect(b.x).not.toBe(a.x);expect(b.y).toBeGreaterThan(a.y);
});
test('collision shield, invulnerability, recovery, pause, lag guard and restart are motor-only',()=>{
  const events=[],game=createRunner({seed:1,onEvent:e=>events.push(e)});game.start();
  const blocked=[0,1,2].find(l=>l!==game.getSnapshot().waves[0].safeLane);
  while(game.getSnapshot().lane!==blocked)game.dispatch({type:'lane',direction:Math.sign(blocked-game.getSnapshot().lane)});
  advance(game,5/.7);
  expect(game.getSnapshot().shield).toBe(2);expect(game.getSnapshot().invulnerable).toBeGreaterThan(0);
  expect(events.find(e=>e.type==='runner:collision').category).toBe('motor-control');
  const t=game.getSnapshot().elapsed;game.pause();advance(game,2);expect(game.getSnapshot().elapsed).toBe(t);
  game.resume();game.dispatch({type:'tick',dt:4});expect(game.getSnapshot().status).toBe('paused');expect(game.getSnapshot().shield).toBe(2);
  game.dispatch({type:'restart'});expect(game.getSnapshot().shield).toBe(3);expect(game.getSnapshot().elapsed).toBe(0);
  game.dispose();game.dispatch({type:'restart'});expect(game.getSnapshot().status).toBe('disposed');
});
test('uncontrolled flight cannot clear a stage; active piloting reaches stable, idempotent checkpoints',()=>{
  const idle=createRunner();idle.start();advance(idle,40);expect(idle.getSnapshot().status).toBe('recovery');
  for(const slow of [true,false])for(let seed=0;seed<25;seed++){
    const events=[],game=createRunner({seed,difficulty:6,slow,onEvent:e=>events.push(e)});game.start();
    const s=pilot(game);expect(s.status).toBe('checkpoint');expect(s.stars).toBe(6);expect(s.motorErrors).toBe(0);expect(s.shield).toBe(3);
    advance(game,2);expect(game.getSnapshot()).toEqual(s);expect(events.filter(e=>e.type==='runner:checkpoint')).toHaveLength(1);
  }
});
test('mission adapter validates free manifests, preserves earlier safe checkpoints on retry, and never emits mission mastery',async()=>{
  const mission=await createMission({surahId:78,selection:'10'}),events=[];
  await expect(createFlightController({...mission,surah:67})).rejects.toThrow();
  await expect(createFlightController({...mission,sourceHash:'tampered'})).rejects.toThrow();
  const game=await createFlightController(mission,{onEvent:e=>events.push(e)});
  expect(game.nextStage()).toBe(false);game.start();pilot(game);
  expect(game.getSnapshot().completedCheckpoints).toHaveLength(1);
  expect(game.nextStage()).toBe(true);game.dispatch({type:'restart'});expect(game.getSnapshot().stageIndex).toBe(1);
  expect(game.getSnapshot().completedCheckpoints).toHaveLength(1);pilot(game);
  expect(game.getSnapshot().routeComplete).toBe(true);expect(game.getSnapshot().completedCheckpoints).toHaveLength(2);
  expect(events.every(e=>e.type.startsWith('runner:'))).toBe(true);
  game.dispatch({type:'restart'});pilot(game);expect(events.filter(e=>e.type==='runner:checkpoint')).toHaveLength(2);
  game.dispose();expect(game.nextStage()).toBe(false);
});
