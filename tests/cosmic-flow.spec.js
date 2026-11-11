import {test,expect} from '@playwright/test';
import {createFlowUnits,flowChoices} from '../src/quest/cosmic/flow-content.js';
import {createFlowRunner} from '../src/puzzles/arcade/cosmic/flow-runner.js';
import {createMission,cosmicSurahs} from '../src/quest/cosmic/mission.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
import {comparableAyah,freeAyah} from '../src/quest/cosmic/gateways.js';
const tick=(g,n=1)=>{for(let i=0;i<n*60;i++)g.dispatch({type:'tick',dt:1/60});};
function pilot(game){
  for(let i=0;i<100000;i++){
    const s=game.getSnapshot();if(s.status==='checkpoint')return s;
    if(s.status==='gateway'){game.dispatch({type:'gateway-ready'});const g=game.getSnapshot().gateway;game.dispatch({type:'gateway-select',lane:g.candidates.findIndex(c=>c.ref===g.current.target.ref)});game.dispatch({type:'gateway-choose'});game.dispatch({type:'gateway-continue'});continue;}
    if(s.status==='recovery'){game.dispatch({type:'retry'});continue;}
    const danger=s.objects.find(o=>o.kind==='asteroid'&&o.y>400&&o.y<670),target=s.objects.find(o=>o.kind==='pickup'&&o.unit.id===s.unit.id);
    const lane=danger?(danger.lane+1)%3:target?.lane;
    if(lane!==undefined){let d=lane-s.lane;while(d){game.dispatch({type:'lane',direction:Math.sign(d)});d-=Math.sign(d);}game.dispatch({type:'confirm-lane'});}
    game.dispatch({type:'tick',dt:1/60});
  }
  throw Error('Flow could not finish');
}
test('whole ayahs and canonical word parts preserve all free source text and distinct distractors',()=>{
  for(const chapter of cosmicSurahs){
    const refs=chapter.verses.map(v=>`${chapter.id}:${v.id}`);
    const words=createFlowUnits(refs,'words'),whole=createFlowUnits(refs,'ayahs'),mixed=createFlowUnits(refs,'mixed');
    expect(whole.map(u=>u.text)).toEqual(chapter.verses.map(v=>v.text));
    expect(words.map(u=>u.text)).toEqual(chapter.verses.flatMap(v=>v.words));
    expect(mixed.filter(u=>u.last).map(u=>u.key)).toEqual(refs);
    for(const unit of whole){const choices=flowChoices(unit,67);expect(new Set(choices.map(c=>comparableAyah(c.text))).size).toBe(3);expect(choices.filter(c=>c.id===unit.id)).toHaveLength(1);choices.forEach(c=>expect(c.text).toBe(freeAyah(c.key).text));}
  }
  expect(()=>createFlowUnits(['67:1'])).toThrow();expect(()=>flowChoices({...createFlowUnits(['1:1'],'words')[0],text:'invented'},1)).toThrow();
});
test('active collisions collect words in order, wrong choices repeat without erasing progress or costing shield',()=>{
  const events=[],units=createFlowUnits(['1:3'],'words'),g=createFlowRunner({units,seed:5,stageId:'test',onEvent:e=>events.push(e)});g.start();
  const s=g.getSnapshot(),wrong=s.objects.find(o=>o.kind==='pickup'&&o.unit.id!==s.unit.id),rock=s.objects.find(o=>o.kind==='asteroid');
  let lane=(rock.lane+1)%3;while(g.getSnapshot().lane!==lane)g.dispatch({type:'lane',direction:Math.sign(lane-g.getSnapshot().lane)});tick(g,3.4/.7);
  lane=wrong.lane;while(g.getSnapshot().lane!==lane)g.dispatch({type:'lane',direction:Math.sign(lane-g.getSnapshot().lane)});g.dispatch({type:'confirm-lane'});tick(g,2.8/.7);
  expect(g.getSnapshot().memoryMistakes).toBe(1);expect(g.getSnapshot().cursor).toBe(0);expect(g.getSnapshot().shield).toBe(3);
  const result=pilot(g);expect(result.collected).toEqual(units.map(u=>u.id));expect(result.completedAyahs).toEqual(['1:3']);
  expect(events.find(e=>e.type==='runner:pickup-mistake').category).toBe('observed-flow-selection');
});
test('all pickup styles remain solvable and pause/retry preserve earned sequence',()=>{
  for(const mode of ['words','ayahs','mixed']){
    const game=createFlowRunner({units:createFlowUnits(['112:1','112:2'],mode),seed:31,stageId:mode,slow:true});game.start();
    const first=game.getSnapshot();game.pause();tick(game,4);expect(game.getSnapshot().elapsed).toBe(first.elapsed);game.resume();
    const done=pilot(game);expect(done.status).toBe('checkpoint');expect(done.completedAyahs).toEqual(['112:1','112:2']);
    game.dispose();game.dispatch({type:'restart'});expect(game.getSnapshot().status).toBe('disposed');
  }
});
test('continuous controller needs every pickup before advancing and optionally reviews at stage end',async()=>{
  const m=await createMission({surahId:1,selection:'entire'}),g=await createFlightController(m,{pickupMode:'ayahs'});g.start();
  expect(g.nextStage()).toBe(false);for(let i=0;i<2;i++){pilot(g);expect(g.getSnapshot().routeComplete).toBe(i===1);expect(g.nextStage()).toBe(i<1);}
});


test('word flow plus optional reviews preserve exact boundary evidence across stages',async()=>{
  const {createGatewayRecorder,GATEWAY_KEY}=await import('../src/quest/cosmic/gateway-store.js');
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const m=await createMission({surahId:1,selection:'entire'}),recorder=createGatewayRecorder(m,{storage,getOwner:()=>null,runId:'boundaries'});
  const game=await createFlightController(m,{pickupMode:'words',memoryGateways:true,onEvent:e=>recorder.record(e)});
  game.start();for(let i=0;i<2;i++){pilot(game);expect(game.nextStage()).toBe(i<1);}expect(game.getSnapshot().routeComplete).toBe(true);
  const run=JSON.parse(data.get(GATEWAY_KEY)).runs.boundaries;
  expect(run.completed).toEqual(m.refs);
  const words=run.events.filter(e=>e.type==='runner:pickup-correct'&&e.targetRef==='1:6');
  expect(words[0]).toMatchObject({unitId:'1:6:0',fromRef:'1:5',crossStage:true});
  expect(words[1]).toMatchObject({unitId:'1:6:1',fromRef:'1:6',crossStage:false});
});

test('mixed pickups target 5 chunks : 1 ayah : 4 words with lossless canonical coverage',()=>{
  const refs=cosmicSurahs.flatMap(s=>s.verses.map(v=>`${s.id}:${v.id}`)),units=createFlowUnits(refs);
  expect(createFlowUnits(refs)).toEqual(units);
  const kinds=new Set(Array.from({length:10},(_,i)=>createFlowUnits(['1:1'],'mixed',i)[0].kind));
  expect(kinds).toEqual(new Set(['chunk','word','ayah']));
  const counts={chunk:0,ayah:0,word:0};
  for(const unit of units){
    counts[unit.kind]++;
    if(unit.kind==='chunk'){
      const words=createFlowUnits([unit.key],'words');
      expect([2,3]).toContain(unit.endIndex-unit.index);
      expect(unit.text).toBe(words.slice(unit.index,unit.endIndex).map(w=>w.text).join(' '));
      expect(flowChoices(unit,17).filter(c=>c.id===unit.id)).toHaveLength(1);
    }
  }
  const total=units.length;
  for(const [kind,weight] of Object.entries({chunk:5,ayah:1,word:4}))expect(Math.abs(counts[kind]/total-weight/10)).toBeLessThan(.01);
  for(const ref of refs){
    const selected=units.filter(u=>u.key===ref);
    expect(selected.map(u=>u.text).join(' ')).toBe(selected[0].kind==='ayah'?freeAyah(ref).text:createFlowUnits([ref],'words').map(w=>w.text).join(' '));
    expect(selected.filter(u=>u.last)).toHaveLength(1);
  }
  const target=units.find(u=>u.kind==='chunk');
  expect(()=>flowChoices({...target,endIndex:target.index+4},1)).toThrow();
  expect(()=>flowChoices({...target,text:'invented'},1)).toThrow();
});
test('revision rounds enforce minimum, escalate safely and retain round evidence without duplicate receipts',async()=>{
  const {createGatewayRecorder,GATEWAY_KEY}=await import('../src/quest/cosmic/gateway-store.js');
  const mission=await createMission({surahId:112,selection:'custom',start:2,end:2});
  for(const rounds of [0,-1,11,3.5,NaN])await expect(createFlightController(mission,{pickupMode:'mixed',rounds})).rejects.toThrow();
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const recorder=createGatewayRecorder(mission,{storage,getOwner:()=>null,runId:'rounds'}),events=[];
  const game=await createFlightController(mission,{pickupMode:'words',rounds:4,onEvent:e=>{events.push(e);recorder.record(e);}});
  game.start();
  for(let i=0;i<4;i++){
    const snapshot=game.getSnapshot();expect(snapshot.roundIndex).toBe(i);expect(snapshot.roundCount).toBe(4);
    expect(snapshot.asteroidCount).toBe(i+1);expect(snapshot.speedMultiplier).toBeCloseTo(1+i*.07);
    const checkpoint=pilot(game);expect(checkpoint.routeComplete).toBe(i===3);
    expect(game.nextStage()).toBe(i<3);
  }
  const run=JSON.parse(data.get(GATEWAY_KEY)).runs.rounds;
  expect(new Set(run.events.map(e=>e.roundIndex))).toEqual(new Set([0,1,2,3]));
  const count=run.events.length;events.filter(e=>e.type==='runner:pickup-correct').forEach(e=>recorder.record(e));
  expect(JSON.parse(data.get(GATEWAY_KEY)).runs.rounds.events).toHaveLength(count);
  expect(new Set(game.getSnapshot().completedCheckpoints).size).toBe(4);
  game.dispose();expect(game.nextStage()).toBe(false);
});
