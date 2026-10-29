import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {createContentAdapter} from '../src/puzzles/arcade/content.js';
import {createMaze,stepMaze,generateMaze,buildMazeChambers,directions,cellKey,mazeProfiles} from '../src/puzzles/arcade/maze/engine.js';
import {createLearningStore} from '../src/learning-store.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {createResultRecorder} from '../src/puzzles/arcade/results.js';
const adapter=createContentAdapter(surahs);
export function newMaze({surah=1,start=1,end=start,chainMode='classic',seed=51,difficulty='beginner',reviews={}}={}){const config=adapter.configure({surah,start,end,mode:end===start?'single':'chain',chainMode,seed});return createMaze({id:'test-maze',config,chambers:buildMazeChambers(adapter,config,surahs,{difficulty,reviews}),difficulty});}
export function mazeRoute(layout,start,goal){const queue=[{p:start,path:[]}],seen=new Set([cellKey(start)]);for(let i=0;i<queue.length;i++){const {p,path}=queue[i];if(cellKey(p)===cellKey(goal))return path;for(const [direction,[dx,dy]] of Object.entries(directions)){const n={x:p.x+dx,y:p.y+dy},k=cellKey(n);if(!layout.cells[n.y]?.[n.x]||seen.has(k))continue;seen.add(k);queue.push({p:n,path:[...path,direction]});}}return null;}
export function openChoice(s,correct=true){if(s.deadEnd!==null)s=stepMaze(s,{type:'move',direction:'up'});const target=s.chambers[s.session.checkpoint].targets[s.cursor],index=s.portal?0:s.choices.findIndex(c=>(c.id===target.id)===correct),door=s.layout.doors[index];for(const direction of mazeRoute(s.layout,s.player,door))s=stepMaze(s,{type:'move',direction});return stepMaze(s,{type:'open'});}

test('deterministic generated mazes are connected with intersections, accessible doors and recoverable alcoves',()=>{
 for(const difficulty of Object.keys(mazeProfiles))for(let seed=0;seed<80;seed++){
  const m=generateMaze(seed,difficulty);expect(m).toEqual(generateMaze(seed,difficulty));expect(m.doors).toHaveLength(mazeProfiles[difficulty].choices);
  let intersections=0;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.cells[y][x]){expect(mazeRoute(m,m.start,{x,y})).not.toBeNull();if(Object.values(directions).filter(([dx,dy])=>m.cells[y+dy]?.[x+dx]).length>2)intersections++;}
  expect(intersections).toBeGreaterThan(1);for(const d of m.doors){expect(mazeRoute(m,m.start,d).length).toBeGreaterThan(3);expect(m.cells[d.y+1][d.x]).toBe(1);}
 }
 expect(generateMaze(1)).not.toEqual(generateMaze(2));
});

test('all current ayahs retain exact canonical words, source-backed distractors, deterministic choices and solvable doors',()=>{
 for(const chapter of surahs)for(const verse of chapter.verses){const s=newMaze({surah:chapter.id,start:verse.id,seed:verse.id});
  expect(s.chambers[0].targets.flatMap(t=>t.words.map(w=>w.text))).toEqual(verse.words);
  for(const unit of s.choices)for(const w of unit.words){expect(w.text).toBe(adapter.words(w.key)[w.index].text);expect(w.audio).toBeTruthy();}
  expect(s.choices).toHaveLength(2);expect(s.choices.filter(c=>c.id===s.chambers[0].targets[0].id)).toHaveLength(1);
 }
 expect(newMaze()).toEqual(newMaze());expect(newMaze({difficulty:'standard'}).choices).toHaveLength(3);
});

test('real movement, fog, pause, map assistance and wall bumps never cause memory strikes',()=>{
 let s=newMaze({difficulty:'standard'});expect(stepMaze(s,{type:'move',direction:'right'})).toEqual(s);s=stepMaze(s,{type:'start'});
 const seen=s.seen.length;s=stepMaze(s,{type:'move',direction:'up'});expect(s.session.strikes).toBe(0);expect(s.session.motorErrors).toHaveLength(1);
 const p=s.player;s=stepMaze(s,{type:'open'});expect(s.player).toEqual(p);expect(s.session.strikes).toBe(0);
 s=stepMaze(s,{type:'map'});expect(s.mapRevealed).toBe(true);expect(s.session.assistance[0].kind).toBe('hint');s=stepMaze(s,{type:'map'});expect(s.mapRevealed).toBe(false);
 for(const direction of mazeRoute(s.layout,s.player,s.layout.station))s=stepMaze(s,{type:'move',direction});expect(s.seen.length).toBeGreaterThan(seen);
 s=stepMaze(s,{type:'pause'});expect(stepMaze(s,{type:'move',direction:'up'})).toEqual(s);expect(stepMaze(s,{type:'open'})).toEqual(s);s=stepMaze(s,{type:'resume'});expect(s.session.status).toBe('playing');
 const disposed=stepMaze(s,{type:'dispose'});expect(stepMaze(disposed,{type:'start'})).toEqual(disposed);
});

test('wrong doors cost exactly one strike, enter a real dead end, and require physical recovery',()=>{
 let s=stepMaze(newMaze(),{type:'start'});s=openChoice(s,false);expect(s.session.strikes).toBe(1);expect(s.player.y).toBe(s.layout.height-1);expect(s.deadEnd).not.toBeNull();const old=s;
 s=stepMaze(s,{type:'open'});expect(s.session.strikes).toBe(1);s=stepMaze(s,{type:'move',direction:'up'});expect(s.deadEnd).toBeNull();expect(s.player.y).toBe(old.player.y-1);
 s=openChoice(s);expect(s.cursor).toBe(1);expect(s.captured.map(w=>w.text)).toEqual(adapter.words('1:1').slice(0,1).map(w=>w.text));expect(s.session.strikes).toBe(1);
});

test('Classic shares three strikes, Practice resets per chamber and retains checkpoints on retry',()=>{
 for(const chainMode of ['classic','practice']){let s=stepMaze(newMaze({end:2,chainMode}),{type:'start'});s=openChoice(s,false);
  while(!s.portal)s=openChoice(s);expect(s.session.checkpoint).toBe(0);expect(s.captured.map(w=>w.text)).toEqual(adapter.words('1:1').map(w=>w.text));s=openChoice(s);expect(s.session.checkpoint).toBe(1);expect(s.session.strikes).toBe(chainMode==='practice'?0:1);expect(s.captured).toEqual([]);
  while(s.session.status==='playing')s=openChoice(s,false);expect(s.session.strikes).toBe(3);s=stepMaze(s,{type:'retry'});expect(s.session.checkpoint).toBe(chainMode==='practice'?1:0);expect(s.score).toBe(chainMode==='practice'?600:0);expect(s.session.strikes).toBe(0);
  while(s.session.status==='playing')s=openChoice(s);expect(s.session.status).toBe('won');expect(s.session.completed).toEqual(['1:1','1:2']);
 }
});

test('Expert phrases require approved complete boundaries; original full-ayah audio and stop distinction survive',()=>{
 const config=adapter.configure({surah:1,start:7});expect(()=>buildMazeChambers(adapter,config,surahs,{difficulty:'expert'})).toThrow(/approved/);
 const n=adapter.words('1:7').length,reviews={'1:7':[{key:'1:7',startWord:0,endWord:3,status:'approved',reviewId:'review1'},{key:'1:7',startWord:3,endWord:n,status:'approved',reviewId:'review1'}]};
 const s=newMaze({start:7,difficulty:'expert',reviews});expect(s.chambers[0].targets.flatMap(t=>t.words.map(w=>w.text))).toEqual(adapter.words('1:7').map(w=>w.text));expect(s.chambers[0].audio).toBe(adapter.audio('1:7'));expect(s.choices).toHaveLength(3);
 reviews['1:7'][0].status='draft';expect(()=>newMaze({start:7,difficulty:'expert',reviews})).toThrow();
 let full=stepMaze(newMaze({difficulty:'expert'}),{type:'start'});full=openChoice(full);expect(full.session.status).toBe('won');expect(full.captured.map(w=>w.text)).toEqual(adapter.words('1:1').map(w=>w.text));
});

test('longest current word maze is completable, capped rewards are idempotent, historic progress and FSRS remain untouched',()=>{
 const source=surahs.flatMap(s=>s.verses.map(v=>({s,v}))).sort((a,b)=>b.v.words.length-a.v.words.length)[0];let s=stepMaze(newMaze({surah:source.s.id,start:source.v.id}),{type:'start'});while(s.session.status==='playing')s=openChoice(s);expect(s.captured.map(w=>w.text)).toEqual(source.v.words);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},learning=createLearningStore(storage,surahs),lab=createPuzzleStore(storage,surahs);lab.record({key:'1:1',game:'falling',sessionId:'legacy',mistakes:0,xp:8});
 const before=learning.getRecord(s.session.completed[0]).memory;let account='A';const record=createResultRecorder({learning,lab,accountId:'A',getAccountId:()=>account});record(s.session);record(s.session);record({...s.session,id:'another'});expect(learning.snapshot().wallet.xp).toBe(8);expect(learning.getRecord(s.session.completed[0]).memory).toEqual(before);expect(createPuzzleStore(storage,surahs).snapshot().history.some(h=>h.sessionId==='legacy')).toBe(true);expect(lab.snapshot().history.filter(h=>h.game==='maze')).toHaveLength(2);account='B';expect(()=>record(s.session)).toThrow(/Account changed/);
});
