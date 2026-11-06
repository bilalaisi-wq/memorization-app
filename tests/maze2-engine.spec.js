import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {createContentAdapter} from '../src/puzzles/arcade/content.js';
import {createMaze,stepMaze,buildMazeChambers,directions,cellKey,mazeCheckpoint,restoreMaze} from '../src/puzzles/arcade/maze/engine.js';
import {quiz,keyTypes} from '../src/puzzles/arcade/maze/adventure.js';
import {createMazeCheckpoints,MAZE_CHECKPOINT_KEY} from '../src/puzzles/arcade/maze/checkpoints.js';
import {createLearningStore} from '../src/learning-store.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {createResultRecorder} from '../src/puzzles/arcade/results.js';
const adapter=createContentAdapter(surahs);
const contentCache=new Map();
test.setTimeout(120000);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function fresh({seed=51,difficulty='beginner',end=1,chainMode='classic',correctionRooms=true}={}){const config={...adapter.configure({surah:1,start:1,end,mode:end===1?'single':'chain',chainMode,seed}),mazeVersion:2,correctionRooms};const cacheKey=difficulty+':'+end;if(!contentCache.has(cacheKey))contentCache.set(cacheKey,buildMazeChambers(adapter,config,surahs,{difficulty}));return stepMaze(createMaze({id:'enhanced-maze',config,chambers:contentCache.get(cacheKey),difficulty}),{type:'start'});}
function route(s,goal){const queue=[{p:s.player,path:[]}],seen=new Set([cellKey(s.player)]);for(let i=0;i<queue.length;i++){const {p,path}=queue[i];if(cellKey(p)===cellKey(goal))return path;for(const [direction,[dx,dy]]of Object.entries(directions)){const n={x:p.x+dx,y:p.y+dy};if(s.layout.cells[n.y]?.[n.x]&&!seen.has(cellKey(n))){seen.add(cellKey(n));queue.push({p:n,path:[...path,direction]});}}}return null;}
function walk(s,p){for(const direction of route(s,p)||[])s=stepMaze(s,{type:'move',direction});return s;}
function room(s,name){s=walk(s,s.layout.rooms[name]);return stepMaze(s,{type:'interact'});}
function answer(s,correct=true){const q=quiz(s);return stepMaze(s,{type:'answer',index:q.choices.findIndex(c=>(c.id===q.answer.id)===correct)});}
function keys(s){s=walk(s,s.layout.rooms.crystal);s=stepMaze(s,{type:'conceal'});for(const k of keyTypes)if(!s.quest.keys.includes(k))s=answer(room(s,k));return s;}
function door(s,correct=true){if(s.deadEnd!==null)s=stepMaze(s,{type:'move',direction:'up'});const t=s.chambers[s.session.checkpoint].targets[s.cursor];const i=s.portal?0:s.choices.findIndex(c=>(c.id===t.id)===correct);return stepMaze(walk(s,s.layout.doors[i]),{type:'open'});}
function chamber(s){s=keys(s);while(s.session.status==='playing'&&!s.portal)s=door(s);return s;}

test('Memory Maze 2 rooms and optional shortcuts are deterministic and solvable across 180 seeds and presets',()=>{
 for(const difficulty of ['beginner','standard','expert'])for(let seed=0;seed<60;seed++){const s=fresh({seed,difficulty});expect(s.layout).toEqual(fresh({seed,difficulty}).layout);for(const p of Object.values(s.layout.rooms))expect(route(s,p)).not.toBeNull();for(const p of s.layout.doors)expect(route(s,p)).not.toBeNull();const open=room(s,'switch');expect(open.session.strikes).toBe(0);expect(open.quest.switchOpened).toBe(!!open.layout.secret);for(const p of Object.values(open.layout.rooms))expect(route(open,p)).not.toBeNull();}
});
test('crystal briefly reveals exact source and each distinct key requires a genuine decision; gate cannot bypass keys',()=>{
 let s=fresh();s=room(s,'recognition');expect(s.quest.challenge).toBeNull();s=walk(s,s.layout.rooms.crystal);expect(s.quest.crystalVisible).toBe(true);expect(s.quest.crystalCollected).toBe(true);s=stepMaze(s,{type:'conceal'});s=room(s,'recognition');expect(quiz(s).answer.words.map(w=>w.text)).toEqual(s.chambers[0].targets[0].words.map(w=>w.text));s=answer(s);expect(s.quest.keys).toEqual(['recognition']);
 while(s.cursor<s.chambers[0].targets.length-1)s=door(s);const locked=door(s);expect(locked.cursor).toBe(s.cursor);expect(locked.session.strikes).toBe(0);expect(locked.message).toContain('locked');s=keys(locked);s=door(s);expect(s.session.status).toBe('won');expect(s.quest.keys).toHaveLength(3);
});
test('Arabic errors create optional same-source correction with a different cue; walls and switches are motor-only',()=>{
 let s=fresh();s=stepMaze(s,{type:'move',direction:'up'});expect(s.session.motorErrors).toHaveLength(1);expect(s.session.strikes).toBe(0);s=keys(s);s=door(s,false);expect(s.session.strikes).toBe(1);expect(s.quest.corrections[0]).toMatchObject({index:0,cue:'continuation-door'});s=stepMaze(s,{type:'move',direction:'up'});s=room(s,'correction');expect(quiz(s).prompt).toContain('recognition cue');expect(quiz(s).answer.id).toBe(s.chambers[0].targets[0].id);s=answer(s);expect(s.quest.corrections).toHaveLength(0);expect(s.session.strikes).toBe(1);let optional=fresh({correctionRooms:false});optional=door(optional,false);expect(optional.quest.corrections).toEqual([]);
});
for(const chainMode of ['classic','practice'])test(`${chainMode} chain requires adjacent opening decision and preserves the correct retry coverage`,()=>{
 let s=chamber(fresh({end:2,chainMode}));expect(s.portal).toBe(true);s=door(s);expect(quiz(s).kind).toBe('boundary');expect(quiz(s).context[0].id).toBe(s.chambers[0].words.at(-1).id);expect(quiz(s).answer.key).toBe('1:2');s=answer(s);expect(s.session.completed).toEqual(['1:1']);expect(s.quest.transitionCoverage).toEqual(['1:1>1:2']);s=door(s,false);s=door(s,false);s=door(s,false);expect(s.session.status).toBe('lost');s=stepMaze(s,{type:'retry'});expect(s.session.checkpoint).toBe(chainMode==='practice'?1:0);expect(s.quest.transitionCoverage).toEqual(chainMode==='practice'?['1:1>1:2']:[]);expect(s.session.strikes).toBe(0);
});
test('source choices are unambiguous and authentic in all room types; expert respects canonical approved source limits',()=>{
 for(const difficulty of ['beginner','standard','expert']){let s=fresh({end:2,difficulty});s=keys(s);for(const kind of keyTypes){const q=quiz(s,kind);expect(new Set(q.choices.map(c=>c.words.map(w=>w.text).join(' '))).size).toBe(q.choices.length);for(const c of q.choices)for(const w of c.words)expect(adapter.words(w.key)[w.index].text).toBe(w.text);}s=chamber(s);s=door(s);const q=quiz(s);expect(q.answer.words[0].id).toBe(s.chambers[1].words[0].id);}
});
test('metadata-only checkpoints restore positions, keys, fog and secret paths safely paused, reject revision drift',()=>{
 let s=keys(fresh());s=room(s,'switch');if(s.layout.secret)s=walk(s,s.layout.secret);const saved=mazeCheckpoint(s);expect(JSON.stringify(saved)).not.toMatch(/[\u0600-\u06ff]/);const recovered=restoreMaze(saved,s.chambers);expect(recovered.session.status).toBe('paused');expect(recovered.player).toEqual(s.player);expect(recovered.quest.keys).toEqual(s.quest.keys);expect(recovered.seen).toEqual(s.seen);expect(recovered.quest.crystalVisible).toBe(false);expect(()=>restoreMaze({...saved,revision:'wrong'},s.chambers)).toThrow('source');const invalid=storage();invalid.setItem(MAZE_CHECKPOINT_KEY,'{"version":99,"keep":true}');const store=createMazeCheckpoints(invalid);expect(store.warning).toBeTruthy();expect(()=>store.save(s)).toThrow();expect(invalid.getItem(MAZE_CHECKPOINT_KEY)).toContain('"keep":true');
});
test('won and portal metadata restore, historic maze history stays valid, rewards are idempotent and FSRS stays unchanged',()=>{
 let s=chamber(fresh({end:2,chainMode:'practice'}));expect(restoreMaze(mazeCheckpoint(s),s.chambers).portal).toBe(true);s=answer(door(s));s=chamber(s);expect(s.session.status).toBe('won');expect(restoreMaze(mazeCheckpoint(s),s.chambers).session.status).toBe('won');const mem=storage(),learning=createLearningStore(mem,surahs),lab=createPuzzleStore(mem,surahs);const before=learning.snapshot();let owner='A';const record=createResultRecorder({learning,lab,accountId:'A',getAccountId:()=>owner});const result={...s.session,mazeVersion:2,mazeEvidence:s.quest.evidence,transitionCoverage:s.quest.transitionCoverage};record(result);const xp=learning.snapshot().wallet.xp;record(result);expect(learning.snapshot().wallet.xp).toBe(xp);expect(lab.snapshot().history).toHaveLength(2);for(const r of Object.values(learning.snapshot().records))expect(r.memory.card).toBeNull();owner='B';expect(()=>record(result)).toThrow('Account');expect(before.wallet.xp).toBe(0);
});

test('connection key targets a distinct ending cue and impossible restored portal states are rejected',()=>{let s=fresh();expect(quiz(s,'continuation').answer.id).not.toBe(quiz(s,'connection').answer.id);expect(quiz(s,'connection').answer.id).toBe(s.chambers[0].targets.at(-1).id);const saved=mazeCheckpoint(s);expect(()=>restoreMaze({...saved,portal:true},s.chambers)).toThrow('progression');expect(()=>restoreMaze({...saved,session:{...saved.session,config:{...saved.session.config,seed:-1}}},s.chambers)).toThrow('progression');});
