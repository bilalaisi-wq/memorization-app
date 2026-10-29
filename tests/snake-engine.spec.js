import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {createContentAdapter} from '../src/puzzles/arcade/content.js';
import {createSnake,stepSnake,buildSnakeSectors,foodCells,reachableCells,GRID,DIRECTIONS} from '../src/puzzles/arcade/snake/engine.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {createLearningStore} from '../src/learning-store.js';
import {createResultRecorder} from '../src/puzzles/arcade/results.js';
import {arcadeNextSteps} from '../src/puzzles/arcade/next-steps.js';
const adapter=createContentAdapter(surahs),k=p=>`${p.x}:${p.y}`;
export function newSnake({surah=1,start=1,end=start,chainMode='classic',seed=43}={}){const config=adapter.configure({surah,start,end,mode:end===start?'single':'chain',chainMode,seed});return createSnake({id:'test-trail',config,sectors:buildSnakeSectors(adapter,config)});}
export function route(state,goal,blocked=[]){
 const occupied=new Set([...state.body.slice(1),...blocked].map(k)),queue=[{p:state.body[0],path:[]}],seen=new Set([k(state.body[0])]),target=new Set(goal.map(k));
 for(let i=0;i<queue.length;i++){
  const {p,path}=queue[i];if(target.has(k(p)))return path;
  for(const [direction,delta] of Object.entries(DIRECTIONS)){
   const next={x:p.x+delta.x,y:p.y+delta.y},key=k(next);
   if(next.x<0||next.x>=GRID.columns||next.y<0||next.y>=GRID.rows||occupied.has(key)||seen.has(key))continue;
   seen.add(key);queue.push({p:next,path:[...path,direction]});
  }
 }return null;
}
function move(s,dir){return stepSnake(stepSnake(s,{type:'direction',value:dir}),{type:'tick'});}
export function collectNext(s){
 for(let i=0;i<400;i++){
  if(s.motorPause)s=stepSnake(s,{type:'recover'});
  const old=s.cursor,food=s.food.find(f=>f.required),path=route(s,foodCells(food),s.food.filter(f=>!f.required).flatMap(foodCells));
  if(!path?.length)throw Error('Required food is unreachable');
  s=move(s,path[0]);if(s.cursor!==old||s.session.status==='won')return s;
 }throw Error('Did not collect word');
}
function wrong(s){
 for(let i=0;i<400;i++){
  if(s.motorPause)s=stepSnake(s,{type:'recover'});
  const target=s.food.find(f=>!f.required&&route(s,foodCells(f),s.food.filter(o=>o.id!==f.id).flatMap(foodCells))?.length);
  if(!target)throw Error('No reachable distractor');
  const path=route(s,foodCells(target),s.food.filter(o=>o.id!==target.id).flatMap(foodCells)),strikes=s.session.strikes;
  s=move(s,path[0]);if(s.session.strikes!==strikes)return s;
 }throw Error('No wrong collection');
}
function portal(s){for(let i=0;i<300;i++){if(s.motorPause)s=stepSnake(s,{type:'recover'});const path=route(s,[s.portal]);if(!path?.length)throw Error('Portal unavailable');const cp=s.session.checkpoint;s=move(s,path[0]);if(s.session.checkpoint!==cp)return s;}throw Error('Portal not reached');}

test('verified deterministic collectibles, queued directions, continuous steps and growing tail',()=>{
 let s=newSnake();expect(s).toEqual(newSnake());expect(s.body).toHaveLength(3);expect(stepSnake(s,{type:'tick'})).toEqual(s);
 for(const f of s.food){expect(f.word.text).toBe(surahs.find(a=>a.id===f.word.surah).verses.find(v=>v.id===f.word.ayah).words[f.word.index]);expect(f.word.audio).toBeTruthy();}
 s=stepSnake(s,{type:'start'});const head=s.body[0];s=stepSnake(s,{type:'tick'});expect(s.body[0]).not.toEqual(head);
 expect(stepSnake(s,{type:'direction',value:'left'})).toEqual(s);
 expect(stepSnake(s,{type:'direction',value:s.direction})).toEqual(s);
 const queued=stepSnake(s,{type:'direction',value:'up'});expect(stepSnake(queued,{type:'direction',value:'down'})).toEqual(queued);
 s=collectNext(s);expect(s.body).toHaveLength(4);expect(s.captured[0].text).toBe(adapter.words('1:1')[0].text);expect(s.score).toBe(100);expect(s.session.strikes).toBe(0);
});

test('wall and tail collisions are only motor events; recovery preserves length, progress and strikes',()=>{
 let s=stepSnake(newSnake(),{type:'start'});s=collectNext(s);s=stepSnake(s,{type:'recover'});
 for(let i=0;i<50&&!s.motorPause;i++)s=stepSnake(s,{type:'tick'});
 expect(s.motorPause).toBe(true);expect(s.session.strikes).toBe(0);expect(s.session.motorErrors.length).toBeGreaterThan(0);
 const saved={cursor:s.cursor,score:s.score,length:s.body.length};s=stepSnake(s,{type:'recover'});expect(s.cursor).toBe(saved.cursor);expect(s.score).toBe(saved.score);expect(s.body).toHaveLength(saved.length);expect(s.motorPause).toBe(false);
 // A non-vacating tail cell causes a motor event, never a memory strike.
 s={...s,body:[{x:4,y:4},{x:4,y:5},{x:5,y:5},{x:5,y:4},{x:5,y:3}],direction:'right',queued:null,food:[]};
 const result=stepSnake(s,{type:'tick'});expect(result.motorPause).toBe(true);expect(result.session.strikes).toBe(0);
});

test('incorrect collection costs exactly one strike; Classic and Practice portals keep correct budgets',()=>{
 for(const chainMode of ['classic','practice']){
  let s=stepSnake(newSnake({end:2,chainMode}),{type:'start'});s=wrong(s);expect(s.session.strikes).toBe(1);expect(s.captured).toHaveLength(0);
  while(!s.portal)s=collectNext(s);expect(s.session.checkpoint).toBe(0);s=portal(s);expect(s.session.checkpoint).toBe(1);expect(s.captured).toEqual([]);expect(s.body).toHaveLength(3);expect(s.session.strikes).toBe(chainMode==='classic'?1:0);
  while(s.session.status==='playing')s=wrong(s);
  expect(s.session.status).toBe('lost');expect(s.session.strikes).toBe(3);expect(stepSnake(s,{type:'tick'})).toEqual(s);
  s=stepSnake(s,{type:'retry'});expect(s.session.checkpoint).toBe(chainMode==='classic'?0:1);expect(s.session.strikes).toBe(0);expect(s.score).toBe(chainMode==='classic'?0:600);
 }
});

test('many seeds and every current verse provide a reachable required word without overlapping body or distractors',()=>{
 for(const chapter of surahs)for(const verse of chapter.verses){
  const s=newSnake({surah:chapter.id,start:verse.id,seed:verse.id+chapter.id});
  const food=s.food.find(f=>f.required),occupied=new Set(s.body.map(k));
  for(const f of s.food)for(const p of foodCells(f)){expect(occupied.has(k(p))).toBe(false);occupied.add(k(p));}
  const reachable=reachableCells(s,s.food.filter(f=>!f.required).flatMap(foodCells));expect(foodCells(food).some(p=>reachable.has(k(p)))).toBe(true);
 }
});

test('longest current ayah remains solvable through tail growth, and speed/pause/disposal preserve word integrity',()=>{
 const sources=surahs.flatMap(s=>s.verses.map(v=>({surah:s.id,verse:v}))).sort((a,b)=>b.verse.words.length-a.verse.words.length),source=sources[0];
 let s=stepSnake(newSnake({surah:source.surah,start:source.verse.id}),{type:'start'});
 while(s.session.status==='playing')s=collectNext(s);
 expect(s.captured.map(w=>w.text)).toEqual(source.verse.words);expect(s.body).toHaveLength(source.verse.words.length+3);expect(s.score).toBe(source.verse.words.length*100+200);
 let paused=stepSnake(stepSnake(newSnake(),{type:'start'}),{type:'pause'});expect(stepSnake(paused,{type:'tick'})).toEqual(paused);paused=stepSnake(paused,{type:'speed',value:'brisk'});expect(paused.speed).toBe('brisk');expect(stepSnake(paused,{type:'resume'}).session.status).toBe('playing');
 const disposed=stepSnake(s,{type:'dispose'});expect(stepSnake(disposed,{type:'start'})).toEqual(disposed);
});

test('Snake records bounded XP, motor events and arcade points without touching FSRS; pacing counts Snake only',()=>{
 let s=stepSnake(newSnake(),{type:'start'});while(s.session.status==='playing')s=collectNext(s);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},learning=createLearningStore(storage,surahs),lab=createPuzzleStore(storage,surahs),record=createResultRecorder({learning,lab,accountId:null,getAccountId:()=>null});
 const before=learning.getRecord('1:1').memory,result={...s.session,arcadeStats:{score:s.score,steps:s.steps,speed:s.speed}};
 record(result);record(result);record({...result,id:'another'});expect(learning.snapshot().wallet.xp).toBe(8);expect(learning.getRecord('1:1').memory).toEqual(before);expect(lab.snapshot().history[0].arcade.score).toBe(600);
 const history=[1,2].map(i=>({game:'snake',key:'1:1',sessionId:`arcade:round${i}:1:1`,at:new Date().toISOString()}));
 expect(arcadeNextSteps({session:s.session,lastAyah:7,history,activity:'round'}).reason).toContain('rounds');
 expect(arcadeNextSteps({session:s.session,lastAyah:7,history:history.map(h=>({...h,game:'asteroids'})),activity:'round'}).action).toBe('continue');
});
