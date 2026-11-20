import {test,expect} from '@playwright/test';
import {createFalling,stepFalling,landing,collides} from '../src/puzzles/falling-engine.js';
import {towerVerse} from '../src/puzzles/tower-units.js';
import {towerCheckpoints,TOWER_KEY} from '../src/puzzles/tower-checkpoints.js';
import {sourceRoman} from '../src/quest/cosmic/transliteration.js';
import {surahs} from '../src/data.js';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('segmented tower completes 500 toy source tokens with bounded collision board and untimed continuation gates',()=>{
 const words=Array.from({length:500},(_,i)=>`fixture-token-${i}`);let s=createFalling({words,entries:words.map(text=>({text}))});let gates=0;
 for(let i=0;i<1500&&s.status==='playing';i++){
  if(s.gate){const before=structuredClone(s);s=stepFalling(s,{type:'tick'});expect(s).toEqual(before);s=stepFalling(s,{type:'answer-gate',index:s.gate.expected});gates++;}
  else{s=stepFalling(s,{type:'drop'});}
  expect(s.board).toHaveLength(18);expect(s.board.every(r=>r.length===10)).toBe(true);if(s.current?.entry)expect(collides(s.board,s.current)).toBe(false);
 }
 expect(s.status).toBe('won');expect(s.accepted).toEqual(words);expect(s.sections.length).toBeGreaterThan(100);expect(gates).toBeGreaterThan(20);expect(s.strikes).toBe(0);
});
test('real canonical verse grouping retains every source word/transliteration position and partial final groups',()=>{
 for(const chapter of surahs)for(const verse of chapter.verses){const v=towerVerse(verse);expect(v.words.join(' ')).toBe(verse.words.join(' '));if(v.grouped){expect(v.groups.flat()).toEqual(verse.words.map((_,i)=>i));for(let i=0;i<v.groups.length;i++)expect(v.roman[i]).toBe(v.groups[i].map(p=>verse.roman[p]).join(' '));}}
});
test('tower gates separate a deliberate wrong choice from motor moves and preserve completed sections',()=>{
 const words=Array.from({length:12},(_,i)=>`fixture-${i}`);let s=createFalling({words,entries:words.map(text=>({text}))});for(let i=0;i<8;i++)s=stepFalling(s,{type:'drop'});expect(s.gate).not.toBeNull();const sections=structuredClone(s.sections),n=s.accepted.length;
 expect(stepFalling(s,{type:'move',delta:1})).toEqual(s);const bad=s.gate.choices.find(c=>c.index!==n);s=stepFalling(s,{type:'answer-gate',index:bad.index});expect(s.strikes).toBe(1);expect(s.sections).toEqual(sections);expect(s.accepted).toHaveLength(n);s=stepFalling(s,{type:'answer-gate',index:n});expect(s.gate).toBeNull();expect(s.accepted).toHaveLength(n);
});
test('checkpoint records contain only numeric progress/fingerprints, reject drift and preserve corrupt records',()=>{
 const storage=store(),words=Array.from({length:10},(_,i)=>`fixture-${i}`),checkpoints=towerCheckpoints(storage);let s=createFalling({words,entries:words.map(text=>({text}))});for(let i=0;i<4;i++)s=stepFalling(s,{type:'drop'});checkpoints.save('1:1',words,s);expect(checkpoints.read('1:1',words).accepted).toBe(4);expect(storage.getItem(TOWER_KEY)).not.toContain('fixture-');expect(checkpoints.read('1:1',[...words,'changed'])).toBeNull();storage.setItem(TOWER_KEY,'BROKEN');expect(()=>checkpoints.save('1:1',words,s)).toThrow();expect(storage.getItem(TOWER_KEY)).toBe('BROKEN');
});
test('transliteration reuses exact free source positions and refuses incomplete or unavailable group pronunciation',()=>{
 const v=surahs[0].verses[0];expect(sourceRoman({ref:'1:1',index:1})).toBe(v.roman[1]);expect(sourceRoman({sourceWords:[{text:v.words[0],transliteration:v.roman[0]},{text:v.words[1],transliteration:''}]})).toBe('');expect(sourceRoman({ref:'2:255',index:0})).toBe('');
});
test('source revision changes keep prior tower checkpoints exportable and restore earned arcade scores',async()=>{
 const {restoreFallingCheckpoint}=await import('../src/puzzles/falling-engine.js');const storage=store(),checkpoints=towerCheckpoints(storage),words=Array.from({length:12},(_,i)=>`source-fixture-${i}`);let s=createFalling({words,entries:words.map(text=>({text}))});for(let i=0;i<4;i++)s=stepFalling(s,{type:'drop'});checkpoints.save('1:1',words,s);const saved=checkpoints.read('1:1',words),restored=restoreFallingCheckpoint(createFalling({words,entries:words.map(text=>({text}))}),saved);expect(restored.score).toBe(s.score);expect(restored.locks).toBe(s.locks);const revised=[...words,'new-source-version'];checkpoints.save('1:1',revised,s);expect(JSON.parse(storage.getItem(TOWER_KEY)).recovery[0]).toMatchObject({ref:'1:1',fingerprint:saved.fingerprint,accepted:4});expect(storage.getItem(TOWER_KEY)).not.toContain('source-fixture');
});
