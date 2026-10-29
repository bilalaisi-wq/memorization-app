import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockBilling,billingUser} from './billing-fixtures.js';
import {enableDeveloperLab} from './developer-lab-helper.js';
import {menu} from './menu-helper.js';
import {localBundle,catalog,reference,availability} from '../src/content/library.js';
import {createStudyWorkspace} from '../src/content/study-workspace.js';
import {createLearningStore} from '../src/learning-store.js';
import {createPuzzleStore} from '../src/puzzles/puzzle-store.js';
import {surahs} from '../src/data.js';
import {allowedReference} from '../supabase/functions/_shared/content-policy.js';
// Transport-only fixture: existing public test text stands in for a server response.
// It is NOT source validation of Al-A‘raf. scripts/verify-provider-preview.mjs checks
// all 637 genuine private references against their pinned source fingerprints.
const long=JSON.parse(readFileSync(new URL('./fixtures/2-282.json',import.meta.url)));
function chapterFixture(id){const c=catalog.chapters.find(c=>c.id===id);return {surah:id,bundles:Array.from({length:c.verseCount},(_,i)=>{const key=`${id}:${i+1}`,r=reference(key),source=i===0?long:localBundle('1:1');return {...structuredClone(source),key,surah:id,ayah:i+1,juz:r.juz,segments:[{id:'full',reference:key,kind:'whole-ayah',firstWord:1,lastWord:source.words.length}],freeAudio:undefined};})};}
async function privateLibrary(page){const state=await mockBilling(page,{plan:'pathfinder'});await page.route('**/functions/v1/quran-content',async route=>{const b=route.request().postDataJSON();return b.asset==='chapter'?route.fulfill({json:chapterFixture(Number(b.key.split(':')[0]))}):route.fulfill({status:503,json:{error:'Audio unavailable in transport fixture'}});});await page.goto('/');await enableDeveloperLab(page);await page.locator('#surah-picker').selectOption('private:7');await expect(page.locator('.surah-heading h2')).toContainText("Al-A'raf");return state;}

test('private preview requires server-derived developer status; stable reference metadata covers all 637 requested ayahs',()=>{
 expect(availability.developerOnlySurahs).toEqual([7,67,68,69,70,71,72,73,74,75,76,77]);
 for(const id of availability.developerOnlySurahs){const c=catalog.chapters.find(c=>c.id===id),entries=availability.premium.filter(e=>Number(e.key.split(':')[0])===id);expect(entries).toHaveLength(c.verseCount);for(const e of entries){expect(e.contentSha256).toMatch(/^[a-f0-9]{64}$/);expect(e.audioDurationMs).toBeGreaterThan(0);expect(allowedReference(e.key,{plan:'guardian',features:{allQuran:true}})).toBe(false);expect(allowedReference(e.key,{developer:true})).toBe(true);}}
 expect(allowedReference('78:1',{plan:'free'})).toBe(true);
});

test('visual workspaces preserve complete order without granting partial completion; private records survive unavailable content',()=>{
 const w=createStudyWorkspace(128),all=[];for(let p=0;p<w.count;p++){const ids=w.indices();expect(ids.length).toBeLessThanOrEqual(12);all.push(...ids);if(p<w.count-1)w.go(p+1,ids);else w.save(ids);}expect(w.all(w.indices())).toEqual(Array.from({length:128},(_,i)=>i));expect(w.go(0,w.indices())).toEqual(Array.from({length:12},(_,i)=>i));expect(new Set(all).size).toBe(128);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},chapter=chapterFixture(7),library=[...surahs,{id:7,verses:chapter.bundles.map(b=>({id:b.ayah}))}],learning=createLearningStore(storage,surahs);learning.setLibrary(library);learning.markPuzzleComplete('7:1');const before=learning.getRecord('7:1');learning.setLibrary(surahs);expect(learning.getRecord('7:1')).toEqual(before);expect(learning.daily().suggested.every(k=>!k.startsWith('7:'))).toBe(true);const lab=createPuzzleStore(storage,library);lab.record({key:'7:1',game:'maze',sessionId:'private',mistakes:0,xp:8});expect(createPuzzleStore(storage,library).snapshot().history[0].key).toBe('7:1');expect(createLearningStore(storage,surahs).snapshot().records['7:1']).toEqual(before);
});

test('learners including paid accounts see no advanced menu/private chapters; developer cue and failed loading preserve free study',async({page})=>{
 await mockBilling(page,{plan:'pathfinder'});await page.route('**/functions/v1/quran-content',r=>r.fulfill({status:403,json:{error:'Active developer mode is required for this preview'}}));await page.goto('/');await menu(page);
 for(const label of ['Juz 29 library','Hifz Coach','Plans & pricing','Subscription & billing','Passage Builder','Passage memorization','Advanced revision & analytics'])await expect(page.getByRole('button',{name:label,exact:true})).toBeHidden();await expect(page.locator('#surah-picker option[value="private:7"]')).toHaveCount(0);
 await enableDeveloperLab(page);await expect(page.locator('html')).toHaveAttribute('data-developer-mode','true');await expect(page.locator('#surah-picker option[value^="private:"]')).toHaveCount(12);await menu(page);await expect(page.getByRole('button',{name:'Juz 29 library',exact:true})).toBeVisible();await page.locator('#site-menu-toggle').click();
 await page.locator('#surah-picker').selectOption('private:7');await expect(page.locator('[data-private-load-status]')).toContainText('Active developer mode');await expect(page.locator('.surah-heading h2')).toContainText('Al-Fatihah');await expect(page.locator('#surah-picker')).toBeEnabled();
});

test('long private practice/quest uses bounded visual workspaces, full completion and safe developer exit/reload',async({page})=>{
 await privateLibrary(page);await expect(page.locator('.developer-study-note')).toContainText('continuous full ayah');await expect(page.locator('.word-bank [data-word]')).toHaveCount(12);await expect(page.locator('[data-ayah]')).toHaveCount(206);await expect(page.locator('#build-all')).toHaveText('Build this workspace');
 await page.locator('#build-all').click();await page.locator('#workspace-check').click();await expect(page.locator('.feedback')).toContainText('workspace is correct');
 for(let i=1;i<11;i++){await page.locator('[data-workspace-step="1"]').click();await page.locator('#build-all').click();}
 await page.locator('#next').click();await expect(page.locator('.feedback')).toContainText('Beautiful work');const data=await page.evaluate(id=>JSON.parse(localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`)),billingUser.id);expect(data.records['7:1'].game.completed).toBe(true);expect(data.records['7:1'].memory.card).toBeNull();
 await page.locator('[data-mode=quiz]').click();expect(await page.locator('.word-bank [data-word]').count()).toBeLessThanOrEqual(18);await page.evaluate(async()=>{(await import('/src/developer/access.js')).setDeveloperPreview(false);});await expect(page.locator('.developer-study-note')).toHaveCount(0);await expect(page.locator('#surah-picker option[value^="private:"]')).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-developer-mode','false');await page.reload();expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`)).records['7:1'].game.completed,billingUser.id)).toBe(true);
});

test('long-surah chain renders one bounded word puzzle; all four public arcade modes launch without shortening the ayah',async({page})=>{
 await privateLibrary(page);await page.locator('[data-mode=sequence]').click();await page.locator('#chain-start').click();await page.locator('#chain-active-puzzle').selectOption('1');await expect(page.locator('.chain-puzzle')).toHaveCount(1);expect(await page.locator('[data-chain-word]').count()).toBeLessThanOrEqual(12);await page.locator('[data-chain-page="1:1"]').click();expect(await page.locator('[data-chain-word]').count()).toBeLessThanOrEqual(12);
 await page.locator('#nav-puzzle-lab').click();await page.locator('[name=audio]').selectOption('silent');await page.getByRole('button',{name:'Start',exact:true}).click();expect(await page.locator('[data-slot]').count()).toBeLessThanOrEqual(12);await expect(page.locator('.falling-counter')).toContainText('/ 128');
 await page.locator('[data-game=snake]').click();await page.getByRole('button',{name:'Prepare trail',exact:true}).click();await expect(page.locator('.snake-board')).toBeVisible();await page.locator('[data-snake-audio]').selectOption('silent');await page.getByRole('button',{name:'Start trail',exact:true}).click();await expect(page.locator('.snake-word')).toHaveCount(3);await expect(page.locator('.snake-heading')).toContainText('safe length');
 await page.locator('[data-game=asteroids]').click();await page.getByRole('button',{name:'Prepare flight',exact:true}).click();await expect(page.locator('.astro-stage')).toBeVisible();
 await page.locator('[data-game=maze]').click();await page.getByRole('button',{name:'Prepare maze',exact:true}).click();await expect(page.locator('.maze-grid')).toBeVisible();await expect(page.locator('[data-maze-chamber]')).toContainText('/128');await expect(page.locator('.maze-sign')).toHaveCount(2);
});

test('private audio resolves lazily, deduplicates requests, and revokes blobs and late work on access change',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{const m=await import('/src/content/private-audio.js');let loads=0,revoked=0,done;const pending=new Promise(resolve=>done=resolve);m.configurePrivateAudio(['7:1'],async()=>{loads++;return {url:'blob:verified',revoke:()=>revoked++};});const a=await Promise.all([m.resolvePlaybackSource('ayah-private:7:1'),m.resolvePlaybackSource('ayah-private:7:1')]);m.clearPrivateAudio();await Promise.resolve();m.configurePrivateAudio(['7:1'],()=>pending);const late=m.resolvePlaybackSource('ayah-private:7:1').then(()=>false,()=>true);await Promise.resolve();m.clearPrivateAudio();done({url:'blob:late',revoke:()=>revoked++});return {a,loads,rejected:await late,revoked};});expect(r.a).toEqual(['blob:verified','blob:verified']);expect(r.loads).toBe(1);expect(r.rejected).toBe(true);expect(r.revoked).toBe(2);
});

test('long-ayah Serpent remains fully solvable with bounded tail; Space and Maze preserve every source occurrence',async()=>{
 const {createContentAdapter}=await import('../src/puzzles/arcade/content.js'),snake=await import('../src/puzzles/arcade/snake/engine.js'),{buildSectors}=await import('../src/puzzles/arcade/asteroids/content.js'),{buildMazeChambers}=await import('../src/puzzles/arcade/maze/engine.js');
 const library=[...surahs,{id:2,developerOnly:true,verses:[{id:282,words:long.words.map(w=>w.text)}]}],adapter=createContentAdapter(library),config=adapter.configure({surah:2,start:282,seed:92});expect(config.visualWindows).toBe(true);
 const sector=buildSectors(adapter,config,library)[0],chamber=buildMazeChambers(adapter,config,library)[0];expect(sector.targets.flatMap(t=>t.words.map(w=>w.text))).toEqual(long.words.map(w=>w.text));expect(chamber.targets).toHaveLength(128);
 let s=snake.stepSnake(snake.createSnake({id:'long-serpent',config,sectors:snake.buildSnakeSectors(adapter,config)}),{type:'start'}),ticks=0;
 while(s.session.status==='playing'&&ticks++<6000){
  if(s.motorPause)s=snake.stepSnake(s,{type:'recover'});
  const goal=snake.foodCells(s.food.find(f=>f.required)),blocked=new Set([...s.body.slice(1),...s.food.filter(f=>!f.required).flatMap(snake.foodCells)].map(p=>`${p.x}:${p.y}`)),queue=[{p:s.body[0],path:[]}],seen=new Set([`${s.body[0].x}:${s.body[0].y}`]);let path;
  for(let i=0;i<queue.length;i++){const {p,path:route}=queue[i];if(goal.some(g=>g.x===p.x&&g.y===p.y)){path=route;break;}for(const [d,v] of Object.entries(snake.DIRECTIONS)){const n={x:p.x+v.x,y:p.y+v.y},key=`${n.x}:${n.y}`;if(n.x>=0&&n.x<10&&n.y>=0&&n.y<12&&!blocked.has(key)&&!seen.has(key)){seen.add(key);queue.push({p:n,path:[...route,d]});}}}
  expect(path?.length).toBeGreaterThan(0);s=snake.stepSnake(snake.stepSnake(s,{type:'direction',value:path[0]}),{type:'tick'});expect(s.body.length).toBeLessThanOrEqual(15);
 }
 expect(s.session.status).toBe('won');expect(s.captured.map(w=>w.text)).toEqual(long.words.map(w=>w.text));expect(s.session.strikes).toBe(0);
});

test('a late private audio response cannot autoplay through pause or after game disposal',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{
  const source=await import('/src/content/private-audio.js'),{createAudioManager}=await import('/src/puzzles/arcade/services.js');let resolve,played=0,created=0,mutedAtPlay=false;
  source.configurePrivateAudio(['7:1'],()=>new Promise(r=>resolve=r));class AudioMock{constructor(){created++;}play(){played++;mutedAtPlay=this.muted;return Promise.resolve();}pause(){}removeAttribute(){}load(){}}
  const a=createAudioManager({AudioClass:AudioMock});const result=a.play('ayah-private:7:1');a.pause();a.mute(true);await Promise.resolve();resolve({url:'blob:verified',revoke(){}});for(let i=0;i<5;i++)await Promise.resolve();const pausedPlays=played;await a.resume();const started=await result;a.dispose();
  source.configurePrivateAudio(['7:2'],()=>new Promise(r=>resolve=r));const b=createAudioManager({AudioClass:AudioMock});const late=b.play('ayah-private:7:2');await Promise.resolve();b.dispose();resolve({url:'blob:late',revoke(){}});const lateResult=await late;source.clearPrivateAudio();return {pausedPlays,started,played,created,lateResult,mutedAtPlay};
 });expect(r).toEqual({pausedPlays:0,started:true,played:1,created:1,lateResult:false,mutedAtPlay:true});
});

test('named passages include loaded developer chapters and reopen them lazily after a browser reload',async({page})=>{
 const state=await privateLibrary(page);await menu(page);await page.getByRole('button',{name:'Passage Builder',exact:true}).click();
 await expect(page.locator('[data-passage-form] [name=surah] option[value="7"]')).toHaveCount(1);await page.locator('[data-passage-form] [name=surah]').selectOption('7');await page.locator('[data-passage-form] [name=title]').fill('My private passage');await page.getByRole('button',{name:'Save passage',exact:true}).click();await expect(page.locator('.saved-passages')).toContainText('My private passage');expect(state.passages[0].surah).toBe(7);
 await page.reload();await enableDeveloperLab(page);await menu(page);await page.getByRole('button',{name:'Passage Builder',exact:true}).click();await page.getByRole('button',{name:'Practice passage',exact:true}).click();await expect(page.locator('.chain-choices input:checked')).toHaveCount(2);await expect(page.locator('.chain-config')).toContainText("Al-A'raf");
});
