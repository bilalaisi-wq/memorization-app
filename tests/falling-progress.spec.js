import {test,expect} from '@playwright/test';
import {createPuzzleStore,LAB_KEY} from '../src/puzzles/puzzle-store.js';
import {createLearningStore} from '../src/learning-store.js';
import {surahs} from '../src/data.js';
test('versioned arcade receipts preserve legacy history, count errors once, cap XP and never schedule memory',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
 const lab=createPuzzleStore(storage,surahs),learning=createLearningStore(storage,surahs);
 lab.record({key:'1:1',game:'vanishing',sessionId:'legacy',mistakes:1,hinted:false,xp:8});
 const legacy=structuredClone(lab.snapshot().history[0]);
 const errors=Array.from({length:3},()=>({kind:'sequence',surah:1,ayah:1,position:0,expectedPosition:1,word:surahs[0].verses[0].words[0]}));
 lab.record({key:'1:1',game:'falling',sessionId:'failed',mistakes:3,xp:0,hinted:true,arcade:{schemaVersion:2,success:false,errors,newErrors:3}});
 expect(lab.snapshot().weaknesses['1:1'].order).toBe(3);
 for(let i=0;i<8;i++){
  const reward=learning.recordLabPuzzle({key:'1:1',game:'falling',sessionId:`success-${i}`,mistakes:3,hinted:false});
  lab.record({key:'1:1',game:'falling',sessionId:`success-${i}`,mistakes:3,xp:reward.xp,hinted:false,arcade:{schemaVersion:2,success:true,errors,newErrors:0}});
 }
 expect(learning.snapshot().wallet.xp).toBe(8);
 expect(learning.getRecord('1:1').memory.card).toBeNull();
 expect(lab.snapshot().weaknesses['1:1'].order).toBe(0);
 const saved=JSON.parse(storage.getItem(LAB_KEY));expect(saved.schemaVersion).toBe(1);expect(saved.history[0]).toEqual(legacy);
 const reloaded=createPuzzleStore(storage,surahs);expect(reloaded.snapshot().history.at(-1).arcade.errors).toEqual(errors);
 const count=reloaded.snapshot().history.length;reloaded.record(saved.history.at(-1));expect(reloaded.snapshot().history).toHaveLength(count);
});
