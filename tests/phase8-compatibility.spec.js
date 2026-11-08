import {test,expect} from '@playwright/test';
import {createLabStore} from '../src/memorization/store.js';
import {selectionStore} from '../src/passage-context/session.js';
import {missionStore} from '../src/revision/missions/store.js';
import {chroniclesProgress} from '../src/chronicles/progress.js';
import {createCaptureStore} from '../src/quest/cosmic/defense-capture-store.js';
import {createArcadePassageStore} from '../src/puzzles/arcade/passage/store.js';
import {createRewardStore} from '../src/rewards/store.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {createLearningStore} from '../src/learning-store.js';
import {exportKeys,profileBackup,selectProfile} from '../src/learner/profile-storage.js';
import {catalog} from '../supabase/functions/_shared/content-policy.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
const stores=[
 ['ayah-memorization-lab-v1',createLabStore],
 ['ayah-passage-context-v1',selectionStore],
 ['ayah-revision-missions-v1',missionStore],
 ['ayah-chronicles-v1',chroniclesProgress],
 ['ayah-cosmic-defense-capture-v1',createCaptureStore],
 ['ayah-arcade-passages-v1',createArcadePassageStore],
 ['ayah-rewards-v1',createRewardStore],
];
for(const [key,create] of stores){
 test(`${key}: reload retains supported empty schema; malformed and future records remain exportable and unwritable`,()=>{
  const s=memory(),store=create(s);store.transact(()=>{});const supported=s.getItem(key);
  expect(create(s).snapshot()).toEqual(JSON.parse(supported));
  for(const raw of ['{broken original',JSON.stringify({version:999,records:{precious:true}})]){
   s.setItem(key,raw);const invalid=create(s);expect(invalid.warning).toContain('not been overwritten');
   expect(()=>invalid.transact(()=>{})).toThrow();expect(s.getItem(key)).toBe(raw);
   expect(exportKeys).toContain(key);
  }
 });
}
test('raw device recovery export keeps each supported key byte-for-byte and excludes other accounts and tokens',()=>{
 const old=globalThis.localStorage;globalThis.localStorage=memory();
 try{
  selectProfile('A');for(const key of exportKeys)globalThis.localStorage.setItem(`ayah-user:A:${key}`,`{invalid:${key}`);
  globalThis.localStorage.setItem('ayah-user:B:ayah-learning-v1','B private');
  globalThis.localStorage.setItem('sb-project-auth-token','secret token');
  const backup=profileBackup();expect(Object.keys(backup)).toEqual(exportKeys);
  for(const key of exportKeys)expect(backup[key]).toBe(`{invalid:${key}`);
  expect(JSON.stringify(backup)).not.toContain('secret token');expect(JSON.stringify(backup)).not.toContain('B private');
 }finally{selectProfile(null);globalThis.localStorage=old;}
});
test('premium history survives a free library reload while new free results remain recordable',()=>{
 const library=catalog.chapters.map(c=>({id:c.id,verses:Array.from({length:c.verseCount},(_,i)=>({id:i+1}))}));
 const s=memory(),lab=createPuzzleStore(s,library);
 lab.record({key:'2:255',game:'snake',sessionId:'old-premium',mistakes:1});
 const reloaded=createPuzzleStore(s,library);reloaded.record({key:'1:1',game:'falling',sessionId:'new-free',mistakes:0});
 expect(reloaded.snapshot().history.map(r=>r.sessionId)).toEqual(['old-premium','new-free']);
 const learning=createLearningStore(s,library);learning.markPuzzleComplete('2:255');
 const before=learning.getRecord('2:255');learning.setLibrary([{id:1,verses:[{id:1}]}]);
 learning.markPuzzleComplete('1:1');expect(learning.getRecord('2:255')).toEqual(before);
 expect(learning.daily().puzzleCompleted).toBe(1);expect(learning.getRecord('2:255').memory.card).toBeNull();
});

test('all free canonical ayahs preserve exact text, word positions and bounded group coverage',async()=>{
 const {surahs}=await import('../src/data.js');const {localBundle}=await import('../src/content/library.js');
 const {contentView}=await import('../src/passage-context/model.js');
 let ayahs=0;
 for(const s of surahs.filter(s=>s.id===1||s.id>=78&&s.id<=114))for(const v of s.verses){
  const b=localBundle(`${s.id}:${v.id}`);expect(contentView(b,'ayah').text).toBe(v.text);
  expect(contentView(b,'words').map(w=>w.text)).toEqual(v.words);
  for(const size of [1,2,3,5]){
   const groups=[];const first=contentView(b,'groups',{groupSize:size});
   for(let page=0;page<first.count;page++){const window=contentView(b,'groups',{page,groupSize:size});expect(window.groups.length).toBeLessThanOrEqual(12);expect(window.stopApproved).toBe(false);groups.push(...window.groups);}
   expect(groups.flatMap(g=>g.words.map(w=>w.text))).toEqual(v.words);
   expect(groups.flatMap(g=>g.words.map(w=>w.position))).toEqual(v.words.map((_,i)=>i+1));
  }
  ayahs++;
 }
 expect(ayahs).toBe(571);
});

test('opening Quran annotation stays with the first source slice and creates no extra word',async()=>{
 const {localBundle}=await import('../src/content/library.js');const {canonicalSpans,canonicalSlice}=await import('../supabase/functions/_shared/segmentation.js');
 const b=localBundle('100:9'),before=JSON.stringify(b),spans=canonicalSpans(b);
 expect(spans).toHaveLength(b.words.length);expect(spans[0].start).toBe(0);
 expect(canonicalSlice(b,1,b.words.length)).toBe(b.textUthmani);
 expect(canonicalSlice(b,1,1)).toBe(b.words[0].text);
 expect(canonicalSlice(b,2,2)).toBe(b.words[1].text);expect(JSON.stringify(b)).toBe(before);
 expect(()=>canonicalSpans({...b,textUthmani:'۞ incorrect source'})).toThrow('align');
});

test('editing goals cannot overwrite unreadable or future goals; valid plans remain editable',async()=>{
 const {saveGoals,GOALS_KEY}=await import('../src/learner/insights.js');const s=memory();
 const goals={aim:'daily',minutes:10,days:5,targets:[1],known:[],confidence:'new'};
 for(const raw of ['{invalid goals','{"version":99,"precious":true}']){
  s.setItem(GOALS_KEY,raw);expect(()=>saveGoals(s,goals,[{id:1}])).toThrow('recovery');expect(s.getItem(GOALS_KEY)).toBe(raw);
 }
 s.removeItem(GOALS_KEY);saveGoals(s,goals,[{id:1}]);saveGoals(s,{...goals,confidence:'ready'},[{id:1}]);
 expect(JSON.parse(s.getItem(GOALS_KEY)).confidence).toBe('ready');
});

test('empty-string core and passage records are invalid saved data, not absent records to overwrite',async()=>{
 const {createPassageMemory,PASSAGE_MEMORY_KEY}=await import('../src/passage/memory.js');const s=memory();
 s.setItem('ayah-learning-v1','');const core=createLearningStore(s,[{id:1,verses:[{id:1}]}]);
 expect(core.readOnly).toBe(true);expect(core.warning).toContain('recovery');expect(()=>core.markPuzzleComplete('1:1')).toThrow('not be overwritten');
 expect(s.getItem('ayah-learning-v1')).toBe('');
 s.setItem(PASSAGE_MEMORY_KEY,'');const passage=createPassageMemory(s);
 expect(passage.warning).toContain('recovery');expect(()=>passage.begin({id:'ayah:1:1',type:'ayah',refs:['1:1']})).toThrow('recovery');
 expect(passage.exportRaw()).toBe('');
});
test('core detects a record replaced with empty bytes and preserves an existing empty legacy backup',()=>{
 const s=memory(),library=[{id:1,verses:[{id:1}]}];s.setItem('ayah-learning-legacy-v1','');
 const core=createLearningStore(s,library);expect(s.getItem('ayah-learning-legacy-v1')).toBe('');
 s.setItem('ayah-learning-v1','');expect(()=>core.markPuzzleComplete('1:1')).toThrow('not be overwritten');
 expect(s.getItem('ayah-learning-v1')).toBe('');
});
