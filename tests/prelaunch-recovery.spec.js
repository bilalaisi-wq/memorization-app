import {test,expect} from '@playwright/test';
import {createLearningStore,LEARNING_KEY,LEGACY_BACKUP_KEY} from '../src/learning-store.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};};
const library=[{id:1,verses:[{id:1}]}];
for(const raw of ['', '{broken backup', '{"version":999,"precious":"retain"}'])test(`unsupported migration backup preserves legacy originals and blocks writes: ${JSON.stringify(raw)}`,()=>{
 const s=memory(),original='{unreadable precious legacy marker';s.setItem('ayah-mastery',original);s.setItem(LEGACY_BACKUP_KEY,raw);
 const core=createLearningStore(s,library);expect(core.readOnly).toBe(true);expect(core.warning).toContain('backup needs recovery');
 expect(()=>core.markPuzzleComplete('1:1')).toThrow();expect(s.getItem('ayah-mastery')).toBe(original);expect(s.getItem(LEGACY_BACKUP_KEY)).toBe(raw);expect(s.getItem(LEARNING_KEY)).toBeNull();
});
for(const key of ['ayah-mastery','ayah-quiz','ayah-completed'])test(`corrupt ${key} after migration is preserved while canonical learning continues`,()=>{
 const s=memory(),core=createLearningStore(s,library),raw='{precious post-migration legacy data';s.setItem(key,raw);
 const before=Object.fromEntries(['ayah-mastery','ayah-quiz','ayah-completed'].map(k=>[k,s.getItem(k)]));
 core.markPuzzleComplete('1:1');expect(core.getRecord('1:1').game.completed).toBe(true);expect(core.warning).toContain('not been overwritten');
 expect(Object.fromEntries(Object.keys(before).map(k=>[k,s.getItem(k)]))).toEqual(before);
});
test('valid original backup permits supported migration without modifying its raw bytes',()=>{
 const s=memory(),raw=JSON.stringify({savedAt:'2026-01-01',keys:{'ayah-mastery':'{}','ayah-quiz':'{}','ayah-completed':'[]'}});s.setItem(LEGACY_BACKUP_KEY,raw);
 const core=createLearningStore(s,library);expect(core.readOnly).toBe(false);core.markPuzzleComplete('1:1');expect(s.getItem(LEGACY_BACKUP_KEY)).toBe(raw);
});
