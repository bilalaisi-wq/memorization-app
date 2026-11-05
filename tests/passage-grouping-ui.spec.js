import {openMazeChoice} from './maze-helper.js';
import {surahs} from '../src/data.js';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {enableDeveloperLab} from './developer-lab-helper.js';
import {mockBilling} from './billing-fixtures.js';
import {menu} from './menu-helper.js';
const long=JSON.parse(readFileSync(new URL('./fixtures/2-282.json',import.meta.url)));
test.setTimeout(120000);
async function open(page){await enableDeveloperLab(page);await menu(page);await page.getByRole('button',{name:'Passage memorization',exact:true}).click();await page.getByRole('button',{name:/Start with Al-Fatihah|Resume saved workspace/}).click();await expect(page.locator('.passage-studio [data-reference]')).toBeVisible();}
async function setup(page){await mockBilling(page,{plan:'pathfinder'});await page.route('**/functions/v1/quran-content',r=>r.fulfill({json:long}));await page.goto('/');await open(page);await page.locator('.passage-studio [data-reference]').selectOption('2:282');await expect(page.locator('.passage-studio [data-layout]')).toHaveValue('grouped');}
async function solve(page){const ids=await page.locator('.passage-studio [data-place=bank] [data-word]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.word)).sort((a,b)=>a-b));for(const id of ids)await page.locator(`.passage-studio [data-place=bank] [data-word="${id}"]`).click();}
test('Ayatul Dayn has 12 five-word pieces, a shorter final page, atomic reorder and source-preserving reload on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await expect(page.locator('.passage-studio [data-word]')).toHaveCount(12);await expect(page.locator('.passage-studio [data-studio]')).toContainText('workspace 1 / 3');
 await page.locator('.passage-studio [data-place=bank] [data-word="1"]').click();await page.locator('.passage-studio [data-place=bank] [data-word="6"]').click();await page.locator('.passage-studio [data-move="6:-1"]').click();
 let saved=await page.evaluate(async()=>{const {profileStorage}=await import('/src/learner/profile-storage.js');return JSON.parse(profileStorage.getItem('ayah-passage-workspaces-v1'));});const rec=Object.entries(saved.records).find(([k])=>k.startsWith('2:282:')&&k.endsWith(':grouped-v1'))[1];expect(rec.orders[0]).toEqual([6,7,8,9,10,1,2,3,4,5]);
 await page.locator('.passage-studio [data-workspace-jump]').selectOption('2');await expect(page.locator('.passage-studio [data-word]')).toHaveCount(2);await expect(page.locator('.passage-studio [data-word="126"]')).toContainText(long.words.slice(125).map(w=>w.text).join(' '));
 await page.reload();await open(page);await expect(page.locator('.passage-studio [data-workspace-jump]')).toHaveValue('2');await expect(page.locator('.passage-studio [data-word]')).toHaveCount(2);expect(await page.locator('.passage-studio').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
 await page.locator('.passage-studio [data-layout]').selectOption('legacy');await expect(page.locator('.passage-studio [data-studio]')).toContainText('workspace 1 / 20');await page.locator('.passage-studio [data-layout]').selectOption('grouped');await expect(page.locator('.passage-studio [data-workspace-jump]')).toHaveValue('2');
});
test('earned XP prompts native self-assessment; game checkboxes persist and recall offers continued practice and next ayah',async({page})=>{
 await setup(page);await page.locator('.passage-studio [data-passage-game-choice=falling]').check();await page.locator('.passage-studio [data-passage-game-choice=asteroids]').uncheck();await expect(page.locator('.passage-studio [data-passage-game=falling]')).toBeVisible();await expect(page.locator('.passage-studio [data-passage-game=asteroids]')).toHaveCount(0);
 await solve(page);await page.locator('.passage-studio [data-check-window]').click();await page.waitForTimeout(350);await page.locator('.passage-studio [data-check-window]').click();await expect(page.locator('.passage-studio [data-required-recall]')).toBeVisible();await expect(page.locator('.passage-studio [data-passage-game=falling]')).toBeDisabled();
 await page.locator('.passage-studio [data-required-recall]').click();await expect(page.locator('.passage-studio [data-place=bank]')).toHaveCount(0);await page.locator('.passage-studio [data-declare]').click();await page.locator('.passage-studio [data-compare]').click();await page.locator('.passage-studio [data-grade=Good]').click();await expect(page.locator('.passage-studio [data-after-recall]')).toBeVisible();await expect(page.locator('.passage-studio [data-passage-game=falling]')).toBeEnabled();
 const memory=await page.evaluate(async()=>{const {profileStorage}=await import('/src/learner/profile-storage.js');return JSON.parse(profileStorage.getItem('ayah-passage-recall-v1'));});expect(memory.records['ayah:2:282'].history).toHaveLength(1);expect(memory.records['ayah:2:282'].history[0].assessmentSource).toBe('self-assessed');
 await page.locator('.passage-studio [data-after-practice]').click();await expect(page.locator('.passage-studio [data-after-recall]')).toHaveCount(0);await page.reload();await open(page);await expect(page.locator('.passage-studio [data-passage-game-choice=falling]')).toBeChecked();await expect(page.locator('.passage-studio [data-required-recall]')).toHaveCount(0);
});
test('selected game launches a real arcade, returns without a false recall grade and cleans up on close',async({page})=>{
 await page.goto('/');await open(page);await page.locator('.passage-studio [data-passage-game-choice=snake]').uncheck();await page.locator('.passage-studio [data-passage-game-choice=falling]').check();await page.locator('.passage-studio [data-passage-game=falling]').click();await expect(page.locator('.passage-studio .tower-board')).toBeVisible();await page.locator('.passage-studio [data-game-back]').click();await expect(page.locator('.passage-studio [data-layout]')).toBeVisible();await expect(page.locator('.passage-studio .tower-board')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('ayah-passage-recall-v1'))).toBeNull();
});

test('all four selected arcade engines launch the late Ayatul Dayn workspace without a fallback quiz',async({page})=>{
 await setup(page);await page.locator('.passage-studio [data-workspace-jump]').selectOption('2');
 for(const [id,selector] of [['snake','.snake-game'],['asteroids','.ayah-asteroids'],['maze','.memory-maze'],['falling','.tower-board']]){
  await page.locator(`.passage-studio [data-passage-game-choice=${id}]`).check();await page.locator(`.passage-studio [data-passage-game=${id}]`).click();
  const target=id==='snake'?'.snake-board':id==='asteroids'?'.asteroids':selector;
  await expect(page.locator(`.passage-studio ${target}`)).toBeVisible();
  const board=page.locator(`.passage-studio ${id==='snake'?'.snake-board':id==='asteroids'?'.astro-stage':id==='maze'?'.maze-scroll':'.tower-board'}`);
  const pause=page.locator(`.passage-studio ${id==='snake'?'[data-snake-action=pause]':id==='asteroids'?'[data-action=pause]':id==='maze'?'[data-maze-action=pause]':'#fall-pause'}`);
  await board.focus();await page.keyboard.press('p');await expect(pause).toContainText('Resume');
  await page.locator('.passage-studio [data-game-back]').click();
  await expect(page.locator('.passage-studio [data-workspace-jump]')).toHaveValue('2');
 }
});

test('a real completed Maze records scoped XP once, updates the header and offers another chosen game without inventing recall',async({page})=>{
 await page.goto('/');await open(page);await page.locator('.passage-studio [data-passage-game-choice=maze]').check();await page.locator('.passage-studio [data-passage-game=maze]').click();await expect(page.locator('.memory-maze')).toBeVisible();await expect(page.locator('.memory-maze .maze-sign .arabic').first()).toBeVisible();
 for(const word of surahs[0].verses[0].words)await openMazeChoice(page,word);
 await expect(page.locator('.passage-studio [data-passage-games]')).toBeVisible();await expect(page.locator('[data-studio-status]')).toContainText('Game saved');
 const saved=await page.evaluate(()=>({work:JSON.parse(localStorage.getItem('ayah-passage-workspaces-v1')),lab:JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')),memory:localStorage.getItem('ayah-passage-recall-v1')}));
 expect(saved.lab.history).toHaveLength(1);expect(saved.lab.history[0].arcade.studyScope).toMatchObject({reference:'1:1',firstWord:1,lastWord:4});expect(Object.values(saved.work.practice['1:1'].receipts)).toEqual([8]);expect(saved.memory).toBeNull();await expect(page.locator('[data-learning-xp]')).toContainText('8 XP');
 await page.locator('.passage-studio [data-practice-recall]').click();await page.locator('.passage-studio [data-declare]').click();await page.locator('.passage-studio [data-compare]').click();await page.locator('.passage-studio [data-grade=Good]').click();await page.locator('.passage-studio [data-after-game]').click();await expect(page.locator('.memory-maze')).toBeVisible();await page.locator('.passage-studio [data-game-back]').click();
 await page.locator('.passage-studio [data-practice-recall]').click();await page.locator('.passage-studio [data-declare]').click();await page.locator('.passage-studio [data-compare]').click();await page.locator('.passage-studio [data-grade=Hard]').click();await page.locator('.passage-studio [data-after-next]').click();await expect(page.locator('.passage-studio [data-reference]')).toHaveValue('1:2');
});

test('modal input ownership permits the embedded board but excludes foreign and nested dialogs',async({page})=>{
 await page.goto('/');await expect(page.locator('main')).toBeVisible();const result=await page.evaluate(async()=>{const {outsideGameDialog}=await import('/src/puzzles/arcade/input-scope.js');const own=document.createElement('dialog'),root=document.createElement('section'),board=document.createElement('div'),foreign=document.createElement('dialog'),other=document.createElement('div'),nested=document.createElement('dialog'),inner=document.createElement('div');root.append(board,nested);nested.append(inner);own.append(root);foreign.append(other);document.body.append(own,foreign);const r=[outsideGameDialog(root,{target:board}),outsideGameDialog(root,{target:other}),outsideGameDialog(root,{target:inner}),outsideGameDialog(document.querySelector('main'),{target:board})];own.remove();foreign.remove();return r;});expect(result).toEqual([false,true,true,true]);
});
