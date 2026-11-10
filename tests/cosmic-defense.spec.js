import {test,expect} from '@playwright/test';
import {createMeteorDefense,DEFENSE_CONFIGS} from '../src/puzzles/arcade/cosmic/defense.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
import {createMission} from '../src/quest/cosmic/mission.js';
import {BOOST_MULTIPLIER,BOOST_CAPACITY} from '../src/puzzles/arcade/cosmic/flow-runner.js';
const tick=g=>g.dispatch({type:'tick',dt:1/60});
function answer(g,wrong=false){const s=g.getSnapshot();if(s.gateway.state==='prompt')g.dispatch({type:'gateway-ready'});const t=g.getSnapshot().gateway;g.dispatch({type:'gateway-select',lane:t.candidates.findIndex(c=>wrong?c.ref!==t.current.target.ref:c.ref===t.current.target.ref)});g.dispatch({type:'gateway-choose'});}
function pilot(g){let max=0;for(let i=0;i<30000;i++){
  const s=g.getSnapshot();max=Math.max(max,s.objects.length);
  if(s.status==='checkpoint')return max;
  if(s.status==='ready'){g.start();continue;}
  if(s.status==='gateway'){if(s.gateway.state==='open')g.dispatch({type:'gateway-continue'});else if(s.gateway.state==='repair')g.dispatch({type:'gateway-retry'});else answer(g);continue;}
  if(s.status==='wave-clear'){g.dispatch({type:'next-wave'});continue;}
  if(s.status==='recovery'){g.dispatch({type:'retry'});continue;}
  if(s.status==='paused'){g.resume();continue;}
  if(s.defense){const m=s.objects.filter(o=>o.kind==='meteor').sort((a,b)=>Math.hypot(a.x-500,a.y-340)-Math.hypot(b.x-500,b.y-340))[0];if(m)g.dispatch({type:'aim',angle:Math.atan2(m.y-340,m.x-500)});g.dispatch({type:'fire',active:true});}
  else {const danger=s.objects.find(o=>o.kind==='asteroid'&&o.y>400&&o.y<670),target=s.objects.find(o=>o.kind==='pickup'&&o.unit.id===s.unit?.id);const lane=danger?(danger.lane+1)%3:target?.lane;if(lane!==undefined)while(g.getSnapshot().lane!==lane)g.dispatch({type:'lane',direction:Math.sign(lane-g.getSnapshot().lane)});}
  tick(g);
}throw Error('Activity was not solvable');}
test('boost speed adds 50% to the previous 3.234× rate while retaining four seconds of fuel',()=>{expect(BOOST_MULTIPLIER).toBeCloseTo(3.234*1.5);expect(BOOST_CAPACITY).toBe(4);});
test('defense rejects premium/noncontiguous content and physical objects never carry Quran text',()=>{
  expect(()=>createMeteorDefense({refs:['67:1'],stageId:'x'})).toThrow();expect(()=>createMeteorDefense({refs:['1:1','1:3'],stageId:'x'})).toThrow();expect(()=>createMeteorDefense({refs:['1:1'],stageId:'x',configuration:'unknown'})).toThrow();
  const g=createMeteorDefense({refs:['1:1'],stageId:'neutral'});g.start();answer(g);g.dispatch({type:'gateway-continue'});for(let i=0;i<100;i++)tick(g);
  expect(g.getSnapshot().objects.some(o=>o.kind==='meteor')).toBe(true);
  for(const o of g.getSnapshot().objects){expect(o.text).toBeUndefined();expect(/[\u0600-\u06ff]/u.test(JSON.stringify(o))).toBe(false);}
});
test('only correct canonical memory choices charge abilities; mistakes freeze combat for educational repair',()=>{
  const events=[],g=createMeteorDefense({refs:['112:1'],stageId:'memory',onEvent:e=>events.push(e)});g.start();
  g.dispatch({type:'ability',name:'shield'});expect(g.getSnapshot().shield).toBe(0);answer(g,true);
  expect(g.getSnapshot().gateway.state).toBe('repair');const before=g.getSnapshot();for(let i=0;i<200;i++)tick(g);expect(g.getSnapshot().elapsed).toBe(before.elapsed);expect(g.getSnapshot().health).toBe(before.health);expect(g.getSnapshot().charges.shield).toBe(0);
  g.dispatch({type:'gateway-hint'});g.dispatch({type:'gateway-retry'});answer(g);expect(g.getSnapshot().recognized).toEqual(['112:1']);expect(g.getSnapshot().charges).toEqual({shield:1,pulse:1,repair:1,burst:1});
  expect(events.find(e=>e.type==='defense:memory-correct').assisted).toBe(true);expect(events.find(e=>e.type==='defense:memory-mistake')).toBeTruthy();
});
test('all configurations are deterministic and solvable across real ring/crossfire/sweep waves',()=>{
  for(const configuration of Object.keys(DEFENSE_CONFIGS)){
    const config={refs:['112:1','112:2','112:3'],stageId:'patterns',configuration,seed:721};
    const g=createMeteorDefense(config),same=createMeteorDefense(config);expect(g.getSnapshot()).toEqual(same.getSnapshot());
    const patterns=new Set();const dispatch=g.dispatch;g.dispatch=a=>{const result=dispatch(a);if(g.getSnapshot().pattern)patterns.add(g.getSnapshot().pattern);return result;};
    const count=pilot(g);expect(count).toBeLessThanOrEqual(54);expect(patterns).toEqual(new Set(['ring','crossfire','sweep']));expect(g.getSnapshot().recognized).toEqual(config.refs);expect(g.getSnapshot().health).toBeGreaterThan(0);
    g.dispose();same.dispose();expect(g.getSnapshot().status).toBe('disposed');expect(g.getSnapshot().objects).toHaveLength(0);
  }
});
test('neutral core damage, charged abilities, retries, pause and lag never masquerade as memory failure',()=>{
  const g=createMeteorDefense({refs:['112:1'],stageId:'failure',seed:77});g.start();answer(g);g.dispatch({type:'gateway-continue'});
  g.dispatch({type:'ability',name:'burst'});expect(g.getSnapshot().objects.filter(o=>o.kind==='energy')).toHaveLength(8);expect(g.getSnapshot().charges.burst).toBe(0);
  g.dispatch({type:'ability',name:'shield'});expect(g.getSnapshot().shield).toBe(5);g.dispatch({type:'ability',name:'shield'});expect(g.getSnapshot().charges.shield).toBe(0);
  let damaged=false;for(let i=0;i<3000;i++){tick(g);const s=g.getSnapshot();if(s.health<s.maxHealth&&s.status==='running'){damaged=true;break;}}
  expect(damaged).toBe(true);const health=g.getSnapshot().health;g.dispatch({type:'ability',name:'repair'});expect(g.getSnapshot().health).toBeGreaterThan(health);
  g.dispatch({type:'ability',name:'pulse'});expect(g.getSnapshot().charges.pulse).toBe(0);expect(g.getSnapshot().objects.some(o=>o.kind==='pulse')).toBe(true);
  const before=g.getSnapshot();g.pause();for(let i=0;i<100;i++)tick(g);expect(g.getSnapshot().elapsed).toBe(before.elapsed);g.resume();g.dispatch({type:'tick',dt:2});expect(g.getSnapshot().status).toBe('paused');expect(g.getSnapshot().health).toBe(before.health);
  const idle=createMeteorDefense({refs:['1:1'],stageId:'idle',seed:2});idle.start();answer(idle);idle.dispatch({type:'gateway-continue'});for(let i=0;i<3000&&idle.getSnapshot().status==='running';i++)tick(idle);
  expect(idle.getSnapshot().status).toBe('recovery');expect(idle.getSnapshot().memoryMistakes).toBe(0);expect(idle.getSnapshot().motorErrors).toBeGreaterThan(0);const recognized=idle.getSnapshot().recognized;idle.dispatch({type:'retry'});expect(idle.getSnapshot().recognized).toEqual(recognized);expect(idle.getSnapshot().health).toBe(idle.getSnapshot().maxHealth);
});
test('same mission director switches activities only at checkpoints and restores runner progress',async()=>{
  const mission=await createMission({surahId:112,selection:'custom',start:2,end:2});const events=[];
  const g=await createFlightController(mission,{pickupMode:'ayahs',onEvent:e=>events.push(e)});g.start();expect(g.switchActivity('defense')).toBe(false);pilot(g);
  const before=g.getSnapshot();expect(g.switchActivity('defense')).toBe(true);expect(g.getSnapshot().status).toBe('ready');pilot(g);const defenseScore=g.getSnapshot().arcadeScore;expect(defenseScore).toBeGreaterThan(before.arcadeScore);
  g.dispatch({type:'restart'});pilot(g);expect(g.getSnapshot().arcadeScore).toBe(defenseScore);
  expect(g.switchActivity('runner')).toBe(true);expect(g.getSnapshot().status).toBe('checkpoint');expect(g.getSnapshot().collected).toEqual(before.collected);expect(g.getSnapshot().cursor).toBe(before.cursor);
  expect(g.nextStage()).toBe(true);expect(g.getSnapshot().roundIndex).toBe(1);pilot(g);g.switchActivity('defense');expect(g.getSnapshot().recognized).toEqual([]);g.dispose();expect(g.getSnapshot().status).toBe('disposed');
  expect(events.some(e=>e.type==='defense:memory-correct')).toBe(true);expect(events.some(e=>/fsrs|mastery/.test(e.type))).toBe(false);
  await expect(createFlightController({...mission,surah:67},{activity:'defense'})).rejects.toThrow();
});

test('charged shield really blocks core damage and repair cannot create extra recognition rewards',()=>{
  const g=createMeteorDefense({refs:['1:1'],stageId:'shield-hit',seed:91});g.start();answer(g);g.dispatch({type:'gateway-continue'});
  for(let i=0;i<2000;i++){const s=g.getSnapshot();if(s.objects.some(m=>m.kind==='meteor'&&Math.hypot(m.x-500,m.y-340)<100))break;tick(g);}
  const health=g.getSnapshot().health;g.dispatch({type:'ability',name:'shield'});
  for(let i=0;i<45;i++)tick(g);
  expect(g.getSnapshot().health).toBe(health);expect(g.getSnapshot().defended).toBeGreaterThan(0);expect(g.getSnapshot().recognized).toEqual(['1:1']);
});
test('defense records are backward compatible and bonus XP is idempotent without any native recall grade',async()=>{
  const {createGatewayRecorder,GATEWAY_KEY}=await import('../src/quest/cosmic/gateway-store.js');const {createFlightBonuses}=await import('../src/quest/cosmic/bonuses.js');
  const mission=await createMission({surahId:1,selection:'custom',start:1,end:1}),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const recorder=createGatewayRecorder(mission,{storage,getOwner:()=>null,runId:'defense-evidence'});
  const e={type:'defense:memory-correct',targetRef:'1:1',stageIndex:0,roundIndex:0,roundCount:3,assisted:true};recorder.record(e);recorder.record(e);
  recorder.record({type:'defense:checkpoint',targetRef:'1:1',checkpointId:'defense-1',motorErrors:2,memoryMistakes:0,defended:5,health:64});
  const saved=JSON.parse(data.get(GATEWAY_KEY));expect(saved.version).toBe(1);expect(saved.runs['defense-evidence'].events).toHaveLength(2);expect(saved.runs['defense-evidence'].events[1]).toMatchObject({motorErrors:2,memoryMistakes:0,category:'defense-completion-summary'});
  const bonuses=createFlightBonuses(mission,{storage,getOwner:()=>null,clock:()=>new Date('2026-11-04T12:00:00Z')});expect((await bonuses.record(e)).xp).toBe(4);expect((await bonuses.record(e)).duplicate).toBe(true);
  expect(data.has('ayah-learning-v1')).toBe(false);
  data.set(GATEWAY_KEY,'broken original');expect(()=>recorder.record(e)).toThrow();expect(data.get(GATEWAY_KEY)).toBe('broken original');
});

test('quota-only failure cannot waste a Repair Beam on an unwinnable empty wave',()=>{
  const g=createMeteorDefense({refs:['1:1'],stageId:'quota',configuration:'fortress',seed:2});g.start();answer(g);g.dispatch({type:'gateway-continue'});
  for(let i=0;i<3000&&g.getSnapshot().status==='running';i++)tick(g);
  const before=g.getSnapshot();expect(before.status).toBe('recovery');expect(before.health).toBeGreaterThan(0);expect(before.canRepair).toBe(false);
  g.dispatch({type:'ability',name:'repair'});expect(g.getSnapshot().charges.repair).toBe(before.charges.repair);expect(g.getSnapshot().health).toBe(before.health);
  g.dispatch({type:'retry'});expect(g.getSnapshot().status).toBe('running');expect(g.getSnapshot().health).toBe(before.maxHealth);
});

test('a final-sector handover cannot falsely complete the other activity route',async()=>{
  const mission=await createMission({surahId:112,selection:'custom',start:2,end:2}),g=await createFlightController(mission,{activity:'defense',pickupMode:'ayahs'});
  pilot(g);g.nextStage();pilot(g);g.nextStage();pilot(g);expect(g.getSnapshot().routeComplete).toBe(true);
  g.switchActivity('runner');pilot(g);
  expect(g.getSnapshot()).toMatchObject({atRouteEnd:true,routeComplete:false,activityCompletedCount:1,activityRequiredCount:3});
  expect(g.nextStage()).toBe(false);g.switchActivity('defense');expect(g.getSnapshot().routeComplete).toBe(true);g.dispose();
  expect(()=>createMeteorDefense({refs:['1:1'],stageId:'invalid',configuration:'toString'})).toThrow();
});
test('continuous revision launches first, then asks the same ayah gateway and advances only after a correct entry',()=>{
  const events=[],g=createMeteorDefense({refs:['112:2','112:3'],stageId:'continuous',revisionLoop:true,onEvent:e=>events.push(e)});g.start();expect(g.getSnapshot().status).toBe('running');expect(g.getSnapshot().gateway.state).toBe('idle');g.dispatch({type:'audio-assisted'});
  for(let i=0;i<10000&&g.getSnapshot().status!=='gateway';i++){const s=g.getSnapshot();if(s.status==='recovery'){g.dispatch({type:'retry'});continue;}const m=s.objects.filter(o=>o.kind==='meteor').sort((a,b)=>Math.hypot(a.x-500,a.y-340)-Math.hypot(b.x-500,b.y-340))[0];if(m)g.dispatch({type:'aim',angle:Math.atan2(m.y-340,m.x-500)});g.dispatch({type:'fire',active:true});tick(g);}
  expect(g.getSnapshot().status).toBe('gateway');expect(g.getSnapshot().gateway.current.target.ref).toBe('112:2');answer(g,true);expect(g.getSnapshot().status).toBe('gateway');expect(g.getSnapshot().waveIndex).toBe(0);g.dispatch({type:'gateway-retry'});answer(g);expect(events.find(e=>e.type==='defense:memory-correct').assisted).toBe(true);g.dispatch({type:'gateway-continue'});expect(g.getSnapshot()).toMatchObject({status:'running',waveIndex:1,targetRef:'112:3'});pilot(g);expect(g.getSnapshot().recognized).toEqual(['112:2','112:3']);
});
