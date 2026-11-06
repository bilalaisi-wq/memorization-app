import {test,expect} from '@playwright/test';
import {enableDeveloperLab} from './developer-lab-helper.js';
import {menu} from './menu-helper.js';
import {openMaze,openMazeChoice} from './maze-helper.js';
import {openSirat,reachGateway,siratDOM} from './sirat-helper.js';
import {surahs} from '../src/data.js';
test.setTimeout(120000);
async function sound(page){await page.addInitScript(()=>{window.learningAudio=[];window.Audio=class{constructor(src){this.src=src;window.learningAudio.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}load(){}removeAttribute(){}};});}
const active=page=>page.evaluate(()=>window.learningAudio.filter(a=>a.active).map(a=>({src:a.src,loop:a.loop})));
for(const [game,prepare,start,selector] of [['maze','Prepare maze','Enter maze','data-maze-audio'],['snake','Prepare trail','Start trail','data-snake-audio'],['asteroids','Prepare flight','Start flight','data-astro-audio'],['bubble','Prepare bubbles','Start bubbles','data-bubble-audio'],['sirat','Prepare journey','Start exploring','data-sirat-audio']]){
 test(`${game} starts with continuous verified recitation, allows a temporary audio pause, and disposes on exit`,async({page})=>{
  await sound(page);await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator(`[data-game=${game}]`).click();await page.getByRole('button',{name:prepare,exact:true}).click();await expect(page.locator(`[${selector}]`)).toHaveValue('listen');await page.getByRole('button',{name:start,exact:true}).click();await expect.poll(()=>active(page)).toHaveLength(1);expect((await active(page))[0]).toMatchObject({loop:true});expect((await active(page))[0].src).toContain('001001');
  await page.locator(`[${selector}]`).selectOption('silent');await expect.poll(()=>active(page)).toHaveLength(0);await page.locator(`[${selector}]`).selectOption('listen');await expect.poll(()=>active(page)).toHaveLength(1);expect((await active(page))[0].loop).toBe(true);await page.locator('#nav-learn').click();await expect.poll(()=>active(page)).toHaveLength(0);
 });
}
test('Maze Space opens canonical doors; Arabic meanings and touch controls remain inside the arena on mobile',async({page})=>{
 await sound(page);await page.setViewportSize({width:390,height:844});await openMaze(page,{audio:'listen'});
 const arena=page.locator('.maze-stage');await expect(arena.locator('.maze-door-signs')).toBeVisible();await expect(arena.locator('.maze-pad')).toBeVisible();await expect(arena.locator('[data-maze-audio]')).toBeVisible();await expect(arena.locator('[data-maze-action=listen]')).toBeVisible();expect((await arena.boundingBox()).height).toBeLessThanOrEqual(844);await arena.screenshot({path:'/workspace/artifacts/active-maze-mobile.png'});
 await (await import('./maze-helper.js')).earnMazeKeys(page);
 for(const word of surahs[0].verses[0].words){const {walkMaze,mazeDOM}=await import('./maze-helper.js');const s=await mazeDOM(page);await walkMaze(page,s.signs.indexOf(word));await page.keyboard.press('Space');}
 await expect(page.locator('.memory-maze')).toHaveClass(/maze-victory/);await expect.poll(()=>active(page)).toHaveLength(0);
});
test('Sirat Space commits the arch under the explorer; Up remains a jump, not a memory answer',async({page})=>{
 await openSirat(page,{audio:'listen'});await reachGateway(page);await page.locator('.sirat-stage').focus();const y=(await siratDOM(page)).y;await page.keyboard.press('ArrowUp');await page.clock.runFor(100);expect((await siratDOM(page)).y).toBeLessThan(y);await expect(page.locator('.sirat-sequence')).not.toContainText(surahs[0].verses[0].words[0]);await page.clock.runFor(1000);const choices=await page.locator('[data-sirat-choice] .arabic').allTextContents(),target=choices.indexOf(surahs[0].verses[0].words[0]);expect(target).toBeGreaterThanOrEqual(0);
 await page.locator('.sirat-stage').focus();await page.keyboard.down('ArrowRight');for(let i=0;i<40;i++){if(Number(await page.locator('.sirat-stage').getAttribute('data-selected-gateway'))===target)break;await page.clock.runFor(20);}await page.keyboard.up('ArrowRight');
 const frame=page.locator('.sirat-stage');await expect(frame.locator('.sirat-gateways')).toBeVisible();await expect(frame.locator('[data-sirat-audio]')).toBeVisible();await frame.screenshot({path:'/workspace/artifacts/active-sirat-gateway.png'});await expect(frame.locator('[data-sirat-choice]')).toHaveCount(2);await page.keyboard.press('Space');await expect(page.locator('.sirat-sequence')).toContainText(surahs[0].verses[0].words[0]);await expect(page.locator('.sirat-hud')).toContainText('3/3');
});
test('Maze listening-first freezes navigation until learner resumes; paused narration resets for the next ayah',async({page})=>{
 await sound(page);await openMaze(page,{end:2,rules:'practice',audio:'echo'});await expect(page.locator('[data-maze-action=resume]')).toBeVisible();expect((await active(page))[0].loop).toBe(false);await page.locator('[data-maze-action=resume]').click();await page.locator('[data-maze-audio]').selectOption('listen');await page.locator('[data-maze-audio]').selectOption('silent');
 for(const word of surahs[0].verses[0].words)await openMazeChoice(page,word);
 const {mazeDOM,walkMaze}=await import('./maze-helper.js');const s=await mazeDOM(page),i=s.signs.findIndex(t=>t.includes('ٱلْحَمْدُ'));await walkMaze(page,i);await page.keyboard.press('Space');await (await import('./maze-helper.js')).answerMazeRoom(page);await expect(page.locator('[data-maze-audio]')).toHaveValue('listen');await expect.poll(()=>active(page)).toHaveLength(1);expect((await active(page))[0]).toMatchObject({loop:true});expect((await active(page))[0].src).toContain('001002');
});
test('Bridge is available to learners and survives developer-mode exit; one passage menu entry retains saved passages',async({page})=>{
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await expect(page.locator('[data-game=bridge]')).toBeVisible();
 const available=await page.evaluate(async()=>{const {questArcadeRegistry}=await import('/src/quest/host.js');return questArcadeRegistry().list({developer:false}).some(g=>g.id==='bridge');});expect(available).toBe(true);
 await page.locator('[data-game=bridge]').click();await expect(page.locator('.bridge-tutorial-dialog')).toBeVisible();await page.locator('[data-tutorial-skip]').first().click();await expect(page.locator('.bridge-config')).toBeVisible();
 await enableDeveloperLab(page);await page.evaluate(async()=>{(await import('/src/developer/access.js')).setDeveloperPreview(false);});await expect(page.locator('[data-game=bridge]')).toBeVisible();await page.locator('[data-game=bridge]').click();await expect(page.locator('.bridge-config')).toBeVisible();await expect(page.locator('[data-game=vanishing]')).toBeHidden();
 await enableDeveloperLab(page);await menu(page);await expect(page.getByRole('button',{name:'Passage Builder',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Passage memorization',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Passage Expedition',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Passage Builder',exact:true}).click();await expect(page.locator('[data-open-expedition]')).toBeVisible();await page.locator('[data-open-saved]').click();await expect(page.locator('.billing-dialog')).toBeVisible();
});

test('Ayah Blocks defaults to full-ayah looping rather than a silent stack',async({page})=>{
 await sound(page);await page.goto('/');await page.locator('#nav-puzzle-lab').click();await expect(page.locator('[name=audio]')).toHaveValue('listen');await page.getByRole('button',{name:'Start',exact:true}).click();await expect.poll(()=>active(page)).toHaveLength(1);expect((await active(page))[0].src).toContain('001001');await page.evaluate(()=>window.learningAudio.at(-1).onended());await expect.poll(()=>page.evaluate(()=>window.learningAudio.length)).toBe(2);await expect.poll(()=>active(page)).toHaveLength(1);await page.locator('#nav-learn').click();await expect.poll(()=>active(page)).toHaveLength(0);
});
for(const [game,prepare,start,selector,resume,overlay] of [['snake','Prepare trail','Start trail','data-snake-audio','data-snake-action=resume','.snake-overlay'],['bubble','Prepare bubbles','Start bubbles','data-bubble-audio','data-bubble-action=resume','.bubble-overlay']]){
 test(`${game} listen-first pauses play and remains learner-controlled after recitation`,async({page})=>{
  await sound(page);await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator(`[data-game=${game}]`).click();await page.getByRole('button',{name:prepare,exact:true}).click();await page.locator(`[${selector}]`).selectOption('echo');await page.getByRole('button',{name:start,exact:true}).click();await expect(page.locator(`[${resume}]`)).toBeVisible();await expect.poll(()=>active(page)).toHaveLength(1);expect((await active(page))[0].loop).toBe(false);await page.evaluate(()=>window.learningAudio.at(-1).onended());await expect(page.locator(overlay)).toBeVisible();await page.locator(`[${resume}]`).click();await expect(page.locator(overlay)).toBeHidden();
 });
}
