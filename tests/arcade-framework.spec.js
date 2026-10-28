import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {createContentAdapter,seededShuffle,difficultyProfiles,createSession,reduceSession,createController,createRegistry,createLauncher,createResultRecorder} from '../src/puzzles/arcade/index.js';
import {createLearningStore} from '../src/learning-store.js';
import {createPuzzleStore,LAB_KEY} from '../src/puzzles/puzzle-store.js';
import {enableDeveloperLab} from './developer-lab-helper.js';
const adapter=createContentAdapter(surahs);
const config=(chainMode='classic')=>adapter.configure({surah:1,start:1,end:2,mode:'chain',chainMode,seed:77});
const initial=(mode='classic')=>createSession({id:'stable',game:'arcade-example',config:config(mode)});
const apply=(s,...actions)=>actions.reduce((s,type)=>reduceSession(s,{type}),s);
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};};

test('canonical content, occurrence provenance, deterministic solvable choices and speed-only profiles',()=>{
 const choices=adapter.choices('1:1',{seed:77});
 expect(choices).toEqual(adapter.choices('1:1',{seed:77}));
 expect(choices.filter(w=>w.target).sort((a,b)=>a.index-b.index).map(w=>w.text)).toEqual(surahs[0].verses[0].words);
 for(const word of choices){const source=surahs.find(s=>s.id===word.surah).verses.find(v=>v.id===word.ayah);expect(word.text).toBe(source.words[word.index]);expect(word.id).toBe(`${word.key}:${word.index}`);expect(word.audio).toBeTruthy();}
 expect(new Set(choices.filter(w=>!w.target).map(w=>w.text)).size).toBe(3);
 expect(seededShuffle([1,2,3,4],5)).toEqual(seededShuffle([1,2,3,4],5));
 expect(Object.values(difficultyProfiles).every(p=>p.wordsVisible && p.distractors===3)).toBe(true);
 expect(()=>adapter.configure({surah:1,start:1,end:9,mode:'chain'})).toThrow();
 expect(()=>adapter.choices('1:1',{maxWords:1})).toThrow(/reviewed phrase/);
 expect(adapter.choices('1:1',{count:0})).toHaveLength(adapter.words('1:1').length);
});

test('only reviewed contiguous phrases cover every original word, with separate approved stops',()=>{
 const n=adapter.words('1:1').length;
 const segments=[{key:'1:1',startWord:0,endWord:1,status:'approved',reviewId:'teacher-1',recitationStop:true}, {key:'1:1',startWord:1,endWord:n,status:'approved',reviewId:'teacher-1'}];
 const result=adapter.phrases('1:1',segments);
 expect(result.flatMap(p=>p.words.map(w=>w.text))).toEqual(surahs[0].verses[0].words);
 expect(result[0].recitationStop).toBe(false);
 expect(adapter.phrases('1:1',[{...segments[0],stopStatus:'approved'},segments[1]])[0].recitationStop).toBe(true);
 for(const invalid of [[{...segments[0],status:'draft'},segments[1]],[segments[0]], [segments[0],{...segments[1],startWord:0}]])expect(()=>adapter.phrases('1:1',invalid)).toThrow();
});

test('three strikes, pause freeze, distinct motor errors, Classic restart and Practice checkpoint retry',()=>{
 for(const mode of ['classic','practice']){
  let s=apply(initial(mode),'start','motor-error','assist','checkpoint');
  expect(s.strikes).toBe(0);expect(s.motorErrors).toHaveLength(1);
  const paused=apply(s,'pause');expect(apply(paused,'mistake')).toEqual(paused);
  s=apply(paused,'resume','mistake','mistake','mistake');expect(s.status).toBe('lost');expect(s.strikes).toBe(3);
  expect(apply(s,'mistake','checkpoint')).toEqual(s);
  s=apply(s,'retry');expect(s.checkpoint).toBe(mode==='practice'?1:0);expect(s.completed).toHaveLength(mode==='practice'?1:0);
  s=apply(s,...(mode==='practice'?['checkpoint']:['checkpoint','checkpoint']));expect(s.status).toBe('won');
 }
 expect(apply(initial(),'start','mistake','checkpoint').strikes).toBe(1);
 expect(apply(initial('practice'),'start','mistake','checkpoint').strikes).toBe(0);
});

test('registry contract, access and launcher dispose exactly once; snapshots are isolated',()=>{
 const registry=createRegistry(),launcher=createLauncher(registry);let disposed=0;
 registry.register({id:'arcade-example',developerOnly:true,create:()=>createController({initial:initial(),onDispose:()=>disposed++})});
 expect(()=>launcher.launch('arcade-example',{})).toThrow(/unavailable/);
 const first=launcher.launch('arcade-example',{}, {developer:true});first.start();first.pause();expect(first.getSnapshot().status).toBe('paused');first.resume();
 const snapshot=first.getSnapshot();snapshot.config.keys.pop();expect(first.getSnapshot().config.keys).toHaveLength(2);
 launcher.launch('arcade-example',{}, {developer:true});expect(disposed).toBe(1);
 launcher.dispose();launcher.dispose();expect(disposed).toBe(2);
 expect(registry.list()).toEqual([]);
 expect(()=>registry.register({id:'arcade-example',create(){}})).toThrow();
});

test('legacy storage, idempotent rewards, capped XP, account isolation and FSRS non-interference',()=>{
 const db=storage(),learning=createLearningStore(db,surahs),lab=createPuzzleStore(db,surahs);
 lab.record({key:'1:1',game:'match',sessionId:'historic',mistakes:2,xp:8});
 const legacy=lab.snapshot().history[0],before=learning.getRecord('1:1').memory;
 let account='A';const record=createResultRecorder({learning,lab,accountId:'A',getAccountId:()=>account});
 const won=apply(initial(),'start','motor-error','assist','checkpoint','checkpoint');
 record(won);const xp=learning.snapshot().wallet.xp;
 record(won);expect(learning.snapshot().wallet.xp).toBe(xp);expect(lab.snapshot().history).toHaveLength(3);
 record({...won,id:'second'});expect(learning.snapshot().wallet.xp).toBe(10);
 record({...won,id:'unassisted',assistance:[]});expect(learning.snapshot().wallet.xp).toBe(16);
 for(let i=0;i<5;i++)record({...won,id:`repeat-${i}`,assistance:[]});
 expect(learning.snapshot().wallet.xp).toBe(16);
 expect(learning.getRecord('1:1').memory).toEqual(before);
 expect(createPuzzleStore(db,surahs).snapshot().history[0]).toEqual(legacy);
 expect(JSON.parse(db.getItem(LAB_KEY)).schemaVersion).toBe(1);
 account='B';expect(()=>record({...won,id:'cross-account'})).toThrow(/Account changed/);
 expect(()=>record(initial())).toThrow();
 const saved=db.getItem(LAB_KEY);db.setItem(LAB_KEY,JSON.stringify({...JSON.parse(saved),schemaVersion:999}));
 const future=createPuzzleStore(db,surahs);expect(()=>future.record(legacy)).toThrow();expect(db.getItem(LAB_KEY)).toContain('999');
});

test('learners cannot launch legacy modes; developer preview mounts and cleans up on revocation',async({page})=>{
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();
 await expect(page.locator('[data-game=falling]')).toBeVisible();
 for(const id of ['vanishing','jigsaw','match','chain','continue','detective','arcade-example']){await expect(page.locator(`[data-game="${id}"]`)).toBeHidden();await expect(page.locator(`[data-game="${id}"]`)).toBeDisabled();}
 await enableDeveloperLab(page);
 await page.locator('[data-game=arcade-example]').click();await page.locator('[data-launch]').click();
 await page.locator('[data-arcade-action=start]').click();await expect(page.locator('[data-arcade-host]')).toContainText('playing');
 await page.locator('[data-arcade-action=pause]').click();await expect(page.locator('[data-arcade-host]')).toContainText('paused');
 await page.evaluate(async()=>{(await import('/src/developer/access.js')).setDeveloperPreview(false);});
 await expect(page.locator('.falling-stage')).toBeVisible();await expect(page.locator('[data-arcade-host]')).toHaveCount(0);
});

test('audio cleanup, reduced motion, keyboard and touch utilities',async({page})=>{
 await page.goto('/');await page.locator('#site-menu-toggle').waitFor();await page.emulateMedia({reducedMotion:'reduce'});
 const result=await page.evaluate(async()=>{
  const {createAudioManager,motionSettings,bindArcadeInput,createTicker}=await import('/src/puzzles/arcade/services.js');
  let stopped=0,played=0,cleared=0;
  class AudioMock{play(){played++;return Promise.resolve();}pause(){stopped++;}removeAttribute(){}load(){}}
  const audio=createAudioManager({AudioClass:AudioMock});await audio.play('verified.mp3');await audio.play('next.mp3');audio.pause();await audio.resume();audio.dispose();await audio.play('ignored.mp3');
  const root=document.createElement('div');root.innerHTML='<button data-arcade-action="left">Left</button><input>';
  document.body.append(root);const events=[],off=bindArcadeInput(root,a=>events.push(a));
  document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true}));
  root.querySelector('input').dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));
  root.querySelector('button').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));
  root.querySelector('button').click();
  off();document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));root.remove();
  const ticker=createTicker(()=>{},100,{setInterval:()=>3,clearInterval:()=>cleared++});ticker.start();ticker.start();ticker.pause();ticker.dispose();
  return {stopped,played,events,cleared,motion:motionSettings()};
 });
 expect(result.played).toBe(3);expect(result.stopped).toBeGreaterThanOrEqual(3);expect(result.cleared).toBe(1);
 expect(result.events.map(e=>e.input)).toEqual(['keyboard','touch','keyboard']);expect(result.motion).toEqual({reducedMotion:true,transitionMs:0});
});

test('failed result persistence retries without duplicate wallet rewards and reload retains metadata',()=>{
 const db=storage(),learning=createLearningStore(db,surahs);
 let fail=true;
 const lab=createPuzzleStore({getItem:db.getItem,setItem:(k,v)=>{if(fail)throw Error('quota');db.setItem(k,v);}},surahs);
 const record=createResultRecorder({learning,lab,accountId:null,getAccountId:()=>null});
 const won=apply(initial(),'start','checkpoint','checkpoint');
 expect(()=>record(won)).toThrow();const xp=learning.snapshot().wallet.xp;
 fail=false;record(won);expect(learning.snapshot().wallet.xp).toBeGreaterThanOrEqual(xp);
 const final=learning.snapshot().wallet.xp;record(won);expect(learning.snapshot().wallet.xp).toBe(final);
 const reloaded=createPuzzleStore(db,surahs).snapshot();expect(reloaded.history).toHaveLength(2);
 expect(reloaded.history[0].arcade.completedCheckpoints).toEqual(['1:1','1:2']);
 const other=createPuzzleStore(storage(),surahs);expect(other.snapshot().history).toHaveLength(0);
});

test('developer recommendations become learner-safe immediately when preview ends',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ayah-puzzle-lab-v1',JSON.stringify({schemaVersion:1,history:[],weaknesses:{'1:1':{vocabulary:2}}})));
 await page.goto('/');await enableDeveloperLab(page);await page.locator('#nav-puzzle-lab').click();
 await expect(page.locator('#lab-recommended')).toHaveText('Vanishing Ayah');
 await page.locator('[data-game=vanishing]').click();
 await page.evaluate(async()=>{(await import('/src/developer/access.js')).setDeveloperPreview(false);});
 await expect(page.locator('#lab-recommended')).toHaveText('Falling Words');
 await expect(page.locator('.falling-stage')).toBeVisible();
 await expect(page.locator('[data-game=vanishing]')).toBeHidden();
});
