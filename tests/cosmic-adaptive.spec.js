import {test,expect} from '@playwright/test';
import {createAdaptiveStore,difficultyModels,ADAPTIVE_KEY} from '../src/quest/cosmic/adaptive.js';
import {repairMissions} from '../src/quest/cosmic/repair.js';
import {createMission} from '../src/quest/cosmic/mission.js';
import {createLinkEvidence} from '../src/quest/cosmic/link-evidence.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('arcade collisions and defense performance adapt motor support without changing memory demands',()=>{
 const refs=['112:1','112:2'],base=difficultyModels(refs),events=Array.from({length:3},(_,i)=>({type:'runner:collision',refs,at:new Date().toISOString(),id:String(i)})),motor=difficultyModels(refs,{events});expect(motor.arcade.level).toBe('supported');expect(motor.arcade.slow).toBe(true);expect(motor.memory).toEqual(base.memory);
 const clean=Array.from({length:3},(_,i)=>({type:'defense:checkpoint',activity:'defense',motorErrors:0,defended:7,refs,id:String(i)}));expect(difficultyModels(refs,{events:clean}).arcade).toMatchObject({level:'confident',configuration:'agile',defensiveAccuracy:1});
});
test('independent recall history, errors and hints change memory demand independently of movement',()=>{
 const refs=['112:2'],events=[],records={unit:{unit:{refs},successfulDays:['2026-10-01','2026-10-02','2026-10-03'],history:[1,2,3].map(d=>({at:`2026-10-0${d}T12:00:00Z`,grade:'Good',independent:true}))}},base=difficultyModels(refs),strong=difficultyModels(refs,{events},{records});expect(strong.memory).toMatchObject({level:'extended',extended:true,linkMode:'opening'});expect(strong.arcade).toEqual(base.arcade);
 const recognition=Array.from({length:20},(_,i)=>({id:String(i),type:'runner:pickup-correct',refs}));expect(difficultyModels(refs,{events:recognition}).memory.extended).toBe(false);const hints=Array.from({length:3},(_,i)=>({id:String(i),type:'link:hint',refs}));expect(difficultyModels(refs,{events:hints}).memory.level).toBe('supported');const failed={unit:{unit:{refs},history:[{grade:'Again',independent:true},{grade:'Again',independent:true}]}};expect(difficultyModels(refs,{events},{records:failed}).memory.level).toBe('supported');
});
test('evidence receipts deduplicate real game notifications, preserve malformed data and isolate owners',()=>{
 const storage=memory();let owner='a';const s=createAdaptiveStore({storage,getOwner:()=>owner}),e={runId:'run',type:'runner:collision',elapsed:1,targetRef:'112:2'};s.record(e);s.record(e);expect(s.snapshot().events).toHaveLength(1);owner='b';expect(()=>s.record({...e,elapsed:2})).toThrow('Account');storage.setItem(ADAPTIVE_KEY,'invalid');const broken=createAdaptiveStore({storage,getOwner:()=>owner});expect(()=>broken.record(e)).toThrow('recovery');expect(storage.getItem(ADAPTIVE_KEY)).toBe('invalid');
});
test('focused repair missions require actual repeated adjacent-pair errors and retain context for recitation',async()=>{
 const m=await createMission({surahId:78,selection:'10',start:1}),storage=memory(),e=createLinkEvidence(m,{storage,getOwner:()=>null,runId:'evidence'});await e.record({type:'link:mistake',evidenceId:'one',targetRef:'78:6',fromRef:'78:5',category:'opening-word-selection'});expect(await repairMissions({linkData:e.snapshot(),expeditions:{version:1,runs:{}}})).toEqual([]);await e.record({type:'link:mistake',evidenceId:'two',targetRef:'78:6',fromRef:'78:5',category:'typed-opening-recall'});const plans=await repairMissions({linkData:e.snapshot(),expeditions:{version:1,runs:{}}});expect(plans).toHaveLength(1);expect(plans[0].pairKey).toBe('78:5>78:6');expect(plans[0].mission.refs).toEqual(['78:4','78:5','78:6','78:7']);expect(plans[0].evidenceIds).toHaveLength(2);
});
test('motor support recovers after clean checkpoints instead of treating old collisions as permanent weakness',()=>{
 const refs=['112:2'],events=[...Array.from({length:5},()=>({type:'runner:collision',refs})),...Array.from({length:3},()=>({type:'runner:checkpoint',activity:'runner',motorErrors:0,laneChanges:2,refs}))];expect(difficultyModels(refs,{events}).arcade.level).toBe('confident');expect(difficultyModels(refs,{events}).memory.level).toBe('baseline');
});
test('extended retrieval uses native successful review days, not UTC date slicing or early-repeat history',()=>{
 const refs=['112:2'],history=[1,2,3].map(d=>({at:`2026-10-0${d}T00:30:00Z`,grade:'Good',independent:true})),records={u:{unit:{refs},history,successfulDays:[]}};expect(difficultyModels(refs,{events:[]},{records}).memory.extended).toBe(false);records.u.successfulDays=['2026-09-30','2026-10-03','2026-10-10'];expect(difficultyModels(refs,{events:[]},{records}).memory.independentDays).toBe(3);expect(difficultyModels(refs,{events:[]},{records}).memory.extended).toBe(true);
});
