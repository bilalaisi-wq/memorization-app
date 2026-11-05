import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {groupedWindow,wordWindow,restoreWorkspace} from '../src/passage/model.js';
import {practiceProgress,recordPracticeXP,acknowledgePracticeRecall,recommendPassageGame,validatePractice} from '../src/passage/practice-plan.js';
const long=JSON.parse(readFileSync(new URL('./fixtures/2-282.json',import.meta.url)));
test('grouped workspaces cover every source word exactly once at each size boundary',()=>{
 for(const length of [1,12,13,24,25,36,37,60,61,128]){
  const b={...long,words:long.words.slice(0,length)},first=groupedWindow(b),all=[];
  expect(first.groupSize).toBe(length<=12?1:length<=24?2:length<=36?3:5);
  for(let page=0;page<first.count;page++){const w=groupedWindow(b,page);expect(w.groups.length).toBeLessThanOrEqual(12);expect(w.groups.flatMap(g=>g.positions)).toEqual(w.words.map(w=>w.position));all.push(...w.words);}
  expect(all).toEqual(b.words);
 }
 expect(groupedWindow(long).count).toBe(3);expect(groupedWindow(long,2).groups.map(g=>g.positions.length)).toEqual([5,3]);
 const segment={firstWord:14,lastWord:37};expect(groupedWindow(long,0,segment).groups.flatMap(g=>g.positions)).toEqual(Array.from({length:24},(_,i)=>i+14));
});
test('legacy drafts retain original ranges; grouped drafts restore exact atomic groups without silently repairing corruption',()=>{
 const legacy=wordWindow(long,0),old={page:0,level:1,orders:{0:[legacy.words[0].position]},windowSequence:Array.from({length:legacy.count},(_,i)=>i)};
 expect(restoreWorkspace(long,null,old)).toEqual(old);
 const w=groupedWindow(long),saved={page:0,level:2,orders:{0:[...w.groups[1].positions,...w.groups[0].positions]},windowSequence:[2,0,1]};
 expect(restoreWorkspace(long,null,saved,'grouped')).toEqual(saved);const broken=structuredClone(saved);broken.orders[0].pop();expect(()=>restoreWorkspace(long,null,broken,'grouped')).toThrow('recovery');expect(broken.orders[0]).toHaveLength(9);
});
test('only real earned receipts count once; self-assessment acknowledgement is required without creating an FSRS schedule',()=>{
 const work={};recordPracticeXP(work,['2:282'],{id:'one',xp:8});recordPracticeXP(work,['2:282'],{id:'one',xp:8});expect(practiceProgress(work,['2:282']).xp).toBe(8);recordPracticeXP(work,['2:282'],{id:'capped',xp:0});recordPracticeXP(work,['2:282'],{id:'two',xp:8});expect(practiceProgress(work,['2:282']).due).toBe(true);expect(practiceProgress(work,['1:1']).due).toBe(false);
 expect(()=>acknowledgePracticeRecall(work,['2:282'],{id:'fake'})).toThrow();acknowledgePracticeRecall(work,['2:282'],{id:'attempt',graded:true,result:{independent:false}});expect(practiceProgress(work,['2:282']).due).toBe(false);const reload=JSON.parse(JSON.stringify(work));expect(practiceProgress(reload,['2:282']).xp).toBe(16);expect(reload).not.toHaveProperty('card');
 work.games=['planned'];expect(()=>validatePractice(work)).toThrow();
});
test('recommendations cite real due dates and self-assessed difficulties, never motor skill or invented mastery',()=>{
 expect(recommendPassageGame(long,{records:{}})).toMatchObject({game:'asteroids',evidence:'content-length'});
 const unit={refs:['2:282']};expect(recommendPassageGame(long,{records:{a:{unit,card:{due:'2020-01-01'},history:[]}}})).toMatchObject({game:'maze',evidence:'fsrs-due'});
 expect(recommendPassageGame(long,{records:{a:{unit,history:[{independent:true,grade:'Again'}]}}})).toMatchObject({evidence:'self-assessed-difficulty'});
 expect(recommendPassageGame(long,{records:{a:{unit,history:[{independent:false,grade:'Again',motorErrors:10}]}}})).toMatchObject({evidence:'content-length'});
});
