import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {createContentAdapter} from '../src/puzzles/arcade/content.js';
import {buildSectors} from '../src/puzzles/arcade/asteroids/content.js';
import {createAsteroids,stepAsteroids,aimedObject} from '../src/puzzles/arcade/asteroids/engine.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {createLearningStore} from '../src/learning-store.js';
import {createResultRecorder} from '../src/puzzles/arcade/results.js';
const adapter=createContentAdapter(surahs);
function create({difficulty='beginner',chainMode='classic',end=1}={}){const config=adapter.configure({surah:1,start:1,end,mode:end===1?'single':'chain',chainMode,seed:7});return createAsteroids({id:'flight',config,difficulty,sectors:buildSectors(adapter,config,surahs,{difficulty})});}
const step=stepAsteroids;
function capture(s,object){s=step(s,{type:'move-to',x:object.x,y:object.y+140});s=step(s,{type:'aim',x:object.x,y:object.y,id:object.id});return step(s,{type:'capture'});}
function correct(s){const expected=s.sectors[s.session.checkpoint].targets[s.cursor];const object=s.objects.find(o=>o.piece.id===expected.id&&!o.redirected);if(!object)throw Error('Required piece missing');return capture(s,object);}
function wrong(s){return capture(s,s.objects.find(o=>!o.piece.target&&!o.redirected));}
function completeSector(s){while(s.session.status==='playing'&&!s.sectorReady)s=correct(s);return s;}

test('deterministic, source-backed, bounded waves; actual movement, aiming and capture range',()=>{
 let s=create();expect(s).toEqual(create());expect(s.objects).toHaveLength(3);
 for(const o of s.objects)for(const w of o.piece.words)expect(w.text).toBe(surahs.find(ch=>ch.id===w.surah).verses.find(v=>v.id===w.ayah).words[w.index]);
 expect(step(s,{type:'tick',dt:.1})).toEqual(s);
 s=step(s,{type:'start'});const old=s.ship.x;s=step(s,{type:'tick',dt:.1,dx:1});expect(s.ship.x).toBeGreaterThan(old);
 const o=s.objects[0],before=o.y;s=step(s,{type:'tick',dt:.1});expect(s.objects[0].y).toBeGreaterThan(before);
 s=step(s,{type:'aim',x:1000,y:600});s=step(s,{type:'capture'});expect(s.cursor).toBe(0);expect(s.session.strikes).toBe(0);expect(s.session.motorErrors).toHaveLength(1);
 s=correct(s);expect(s.cursor).toBe(1);expect(s.captured.map(w=>w.text)).toEqual(adapter.words('1:1').slice(0,1).map(w=>w.text));
 expect(aimedObject(step(s,{type:'aim',x:1000,y:0}))).toBeNull();
});

test('missed and shielded required pieces return unchanged; lag and pause never cost strikes',()=>{
 let s=step(create(),{type:'start'});const id=s.objects[0].id,words=s.objects[0].piece.words;
 s=step(s,{type:'tick',dt:30,dx:1});expect(s.elapsed).toBe(0);
 s=step(s,{type:'move-to',x:s.objects[0].x,y:s.objects[0].y+100});s=step(s,{type:'shield'});
 expect(s.objects.find(o=>o.id===id).redirected).toBe(true);expect(s.objects.find(o=>o.id===id).piece.words).toEqual(words);
 for(let i=0;i<450;i++)s=step(s,{type:'tick',dt:.1});
 expect(s.objects.some(o=>o.piece.id===s.sectors[0].targets[0].id&&!o.redirected)).toBe(true);expect(s.session.strikes).toBe(0);
 const paused=step(s,{type:'pause'});expect(step(paused,{type:'tick',dt:.1})).toEqual(paused);expect(step(paused,{type:'capture'})).toEqual(paused);
 expect(step(paused,{type:'resume'}).session.status).toBe('playing');
});

test('only wrong captures strike, three freezes run; Classic restarts chain and Practice keeps sectors',()=>{
 for(const chainMode of ['classic','practice']){
  let s=step(create({chainMode,end:2}),{type:'start'});s=wrong(s);expect(s.session.strikes).toBe(1);
  s=completeSector(s);expect(s.sectorReady).toBe(true);s=step(s,{type:'next-sector'});
  expect(s.session.checkpoint).toBe(1);expect(s.session.strikes).toBe(chainMode==='classic'?1:0);
  while(s.session.status==='playing'){
    const o=s.objects.find(o=>!o.piece.target&&!o.redirected);
    if(o)s=capture(s,o);else for(let i=0;i<120;i++)s=step(s,{type:'tick',dt:.1});
  }
  expect(s.session.status).toBe('lost');expect(s.session.strikes).toBe(3);expect(step(s,{type:'capture'})).toEqual(s);
  s=step(s,{type:'retry'});expect(s.session.checkpoint).toBe(chainMode==='classic'?0:1);expect(s.session.strikes).toBe(0);
 }
});

test('Expert uses only verified whole ayahs or approved covering phrases, never draft splits',()=>{
 const s=create({difficulty:'expert'});expect(s.sectors[0].targets).toHaveLength(1);expect(s.sectors[0].targets[0].words.map(w=>w.text)).toEqual(adapter.words('1:1').map(w=>w.text));
 const config=adapter.configure({surah:1,start:7});
 expect(()=>buildSectors(adapter,config,surahs,{difficulty:'expert'})).toThrow(/approved/);
 const n=adapter.words('1:7').length;
 const reviewed=[{key:'1:7',startWord:0,endWord:4,status:'approved',reviewId:'teacher:1'},{key:'1:7',startWord:4,endWord:n,status:'approved',reviewId:'teacher:1'}];
 const sectors=buildSectors(adapter,config,surahs,{difficulty:'expert',reviews:{'1:7':reviewed}});
 expect(sectors[0].targets.flatMap(t=>t.words)).toEqual(adapter.words('1:7'));
 expect(()=>buildSectors(adapter,config,surahs,{difficulty:'expert',reviews:{'1:7':reviewed.map(r=>({...r,status:'pending_review'}))}})).toThrow();
});

test('successful sectors record capped idempotent XP, keep history and never change FSRS',()=>{
 let s=step(create({end:2}),{type:'start'});s=completeSector(s);s=step(s,{type:'next-sector'});s=completeSector(s);expect(s.session.status).toBe('won');
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},learning=createLearningStore(storage,surahs),lab=createPuzzleStore(storage,surahs),record=createResultRecorder({learning,lab,accountId:null,getAccountId:()=>null});
 const memory=learning.getRecord('1:1').memory;record(s.session);expect(learning.snapshot().wallet.xp).toBe(16);record(s.session);record({...s.session,id:'another'});expect(learning.snapshot().wallet.xp).toBe(16);expect(learning.getRecord('1:1').memory).toEqual(memory);
 expect(lab.snapshot().history[0].game).toBe('asteroids');expect(lab.snapshot().history[0].arcade.completedCheckpoints).toEqual(['1:1','1:2']);
 const disposed=step(s,{type:'dispose'});expect(step(disposed,{type:'start'})).toEqual(disposed);
});

test('a tracked object drifting out of range cannot capture a different object or cause a strike',()=>{
 let s=step(create(),{type:'start'});const required=s.objects[0],distractor=s.objects.find(o=>!o.piece.target);
 s=step(s,{type:'move-to',x:distractor.x,y:distractor.y+100});
 s=step(s,{type:'aim',x:required.x,y:required.y,id:required.id});
 expect(aimedObject(s)).toBeNull();s=step(s,{type:'capture'});expect(s.session.strikes).toBe(0);
 expect(s.session.motorErrors).toHaveLength(1);expect(s.cursor).toBe(0);
});
