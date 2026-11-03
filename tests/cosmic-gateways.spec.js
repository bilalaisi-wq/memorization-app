import {test,expect} from '@playwright/test';
import {createMission,cosmicSurahs} from '../src/quest/cosmic/mission.js';
import {createGatewaySession,gatewayCandidates,comparableAyah,freeAyah} from '../src/quest/cosmic/gateways.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
import {createGatewayRecorder,GATEWAY_KEY} from '../src/quest/cosmic/gateway-store.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('all 571 selected ayahs have authentic, unique choices and canonical boundary coverage including stage seams',async()=>{
  let count=0;
  for(const surah of cosmicSurahs){
    const mission=await createMission({surahId:surah.id,selection:'entire'}),g=createGatewaySession(mission);
    for(let i=0;i<mission.refs.length;i++){
      expect(g.enter(Math.floor(i/5))).toBe(true);
      const prompt=g.getSnapshot();expect(prompt.state).toBe('prompt');expect(prompt.candidates).toEqual([]);
      expect(prompt.current.target.ref).toBe(mission.refs[i]);
      expect(prompt.current.previous?.ref||null).toBe(i?mission.refs[i-1]:null);
      g.dispatch({type:'tick',dt:1000});expect(g.getSnapshot()).toEqual(prompt);
      g.dispatch({type:'ready'});const choices=g.getSnapshot().candidates;
      expect(choices).toHaveLength(3);expect(new Set(choices.map(v=>comparableAyah(v.text))).size).toBe(3);
      choices.forEach(v=>expect(v.text).toBe(freeAyah(v.ref).text));
      const lane=choices.findIndex(v=>v.ref===mission.refs[i]);expect(lane).toBeGreaterThanOrEqual(0);
      g.dispatch({type:'select',lane});g.dispatch({type:'choose'});expect(g.getSnapshot().state).toBe('open');
      g.dispatch({type:'continue'});count++;
    }
    expect(g.getSnapshot().completed).toEqual(mission.refs);
  }
  expect(count).toBe(571);
});
test('repeated verses, custom starts, repair, hints and forged premium references are handled safely',async()=>{
  const m=await createMission({surahId:109,selection:'custom',start:3,end:5}),events=[],g=createGatewaySession(m,{onEvent:e=>events.push(e)});
  expect(g.enter(0)).toBe(true);expect(g.getSnapshot().current.previous.ref).toBe('109:2');
  g.dispatch({type:'choose'});expect(g.getSnapshot().state).toBe('prompt');
  g.dispatch({type:'ready'});const s=g.getSnapshot(),wrong=s.candidates.findIndex(v=>v.ref!=='109:3');
  expect(s.candidates.some(v=>v.ref==='109:5')).toBe(false);
  g.dispatch({type:'select',lane:wrong});g.dispatch({type:'choose'});
  expect(g.getSnapshot().state).toBe('repair');expect(g.getSnapshot().completed).toEqual([]);
  expect(events.find(e=>e.type==='gateway:mistake')).toMatchObject({expectedRef:'109:3',fromRef:'109:2',category:'observed-gateway-selection'});
  g.dispatch({type:'hint'});expect(g.getSnapshot().hint.text).toBe(freeAyah('109:3').text);
  g.dispatch({type:'retry'});g.dispatch({type:'ready'});g.dispatch({type:'select',lane:g.getSnapshot().candidates.findIndex(v=>v.ref==='109:3')});g.dispatch({type:'choose'});
  expect(g.getSnapshot().completed).toEqual(['109:3']);expect(g.getSnapshot().assisted).toBe(true);
  for(const ref of ['2:255','7:1','67:1','01:1','114:7'])expect(()=>gatewayCandidates(ref)).toThrow();
});
test('controller pauses the world untimed, preserves corrections on motor retry and covers cross-stage transitions',async()=>{
  const m=await createMission({surahId:1,selection:'entire'}),events=[];
  const game=await createFlightController(m,{memoryGateways:true,onEvent:e=>events.push(e)});game.start();
  for(let frame=0;frame<6000;frame++){
    const s=game.getSnapshot();
    if(s.status==='gateway'){
      const before=game.getSnapshot();game.dispatch({type:'tick',dt:999});expect(game.getSnapshot()).toEqual(before);
      if(s.gateway.state==='prompt')game.dispatch({type:'gateway-ready'});
      const choices=game.getSnapshot().gateway;
      if(choices.state==='choices'){game.dispatch({type:'gateway-select',lane:choices.candidates.findIndex(v=>v.ref===choices.current.target.ref)});game.dispatch({type:'gateway-choose'});}
      game.dispatch({type:'gateway-continue'});
    }else if(s.status==='running'){
      if(s.nextSafeLane!==null){let d=s.nextSafeLane-s.lane;while(d){game.dispatch({type:'lane',direction:Math.sign(d)});d-=Math.sign(d);}}
      game.dispatch({type:'tick',dt:1/60});
    }else if(s.status==='checkpoint'){if(s.routeComplete)break;expect(game.nextStage()).toBe(true);}
    else throw Error(s.status);
  }
  expect(game.getSnapshot().routeComplete).toBe(true);expect(game.getSnapshot().gateway.completed).toEqual(m.refs);
  expect(events.find(e=>e.type==='gateway:orbit'&&e.targetRef==='1:6').fromRef).toBe('1:5');
  expect(events.filter(e=>e.type==='gateway:correct')).toHaveLength(7);
});
test('gateway ledger persists only source-backed practice evidence, isolates owners and preserves malformed records for export',async()=>{
  const m=await createMission({surahId:108,selection:'entire'}),storage=memory();let owner='a';
  storage.setItem('ayah-learning-v1','untouched');
  const recorder=createGatewayRecorder(m,{storage,getOwner:()=>owner,runId:'run-1'}),g=createGatewaySession(m,{onEvent:e=>recorder.record(e)});
  g.enter(0);g.dispatch({type:'ready'});g.dispatch({type:'select',lane:g.getSnapshot().candidates.findIndex(v=>v.ref!=='108:1')});g.dispatch({type:'choose'});
  const saved=storage.getItem(GATEWAY_KEY);expect(JSON.parse(saved).runs['run-1'].events.some(e=>e.type==='gateway:mistake')).toBe(true);
  expect(saved).not.toMatch(/[\u0600-\u06ff]/);expect(storage.getItem('ayah-learning-v1')).toBe('untouched');
  owner='b';expect(()=>recorder.record({type:'gateway:ready',targetRef:'108:1'})).toThrow('Account changed');expect(storage.getItem(GATEWAY_KEY)).toBe(saved);
  owner='a';storage.setItem(GATEWAY_KEY,'broken');expect(()=>recorder.record({type:'gateway:ready',targetRef:'108:1'})).toThrow('preserved');expect(storage.getItem(GATEWAY_KEY)).toBe('broken');
});
