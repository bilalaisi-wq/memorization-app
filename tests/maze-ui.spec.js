import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
import {openMaze,mazeDOM,openMazeChoice,walkMaze} from './maze-helper.js';
const words=surahs[0].verses[0].words;

test('maze launcher, real keyboard corridors, Arabic door decisions, exact RTL victory, saved replay and reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await openMaze(page);const initial=await mazeDOM(page);
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-maze-strikes]')).toContainText('3/3');expect((await mazeDOM(page)).player).toEqual(initial.player);await expect(page.locator('.maze-status')).toContainText('No memory strike');
 const wrong=(await mazeDOM(page)).signs.find(t=>t!==words[0]);await openMazeChoice(page,wrong);await expect(page.locator('[data-maze-strikes]')).toContainText('2/3');await expect(page.locator('.maze-status')).toContainText('dead end');const dead=await mazeDOM(page);await page.keyboard.press('ArrowUp');expect((await mazeDOM(page)).player.y).toBe(dead.player.y-1);
 for(const word of words)await openMazeChoice(page,word);
 await expect(page.locator('.memory-maze')).toHaveClass(/maze-victory/);await expect(page.locator('[data-maze-panel]')).toContainText('Journey saved');await expect(page.locator('.maze-sequence')).toHaveAttribute('dir','rtl');expect(await page.locator('.maze-sequence').textContent()).toBe(words.join(' '));
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')));expect(saved.records['1:1'].memory.card).toBeNull();const xp=saved.wallet.xp;
 await page.locator('[data-maze-action=replay]').click();await expect(page.locator('.maze-overlay')).toBeHidden();expect((await mazeDOM(page)).player).toEqual({x:1,y:1});expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp)).toBe(xp);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history.some(h=>h.game==='maze'))).toBe(true);expect(errors).toEqual([]);
});

test('chain portals, Practice chamber retry, next-ayah guidance and recall navigation',async({page})=>{
 await openMaze(page,{end:2,rules:'practice'});for(const word of words)await openMazeChoice(page,word);await expect(page.locator('.maze-status')).toContainText('portal');await expect(page.locator('[data-maze-chamber]')).toContainText('1:1');await openMazeChoice(page,null);await expect(page.locator('[data-maze-chamber]')).toContainText('1:2');
 const nextWords=surahs[0].verses[1].words;
 for(let i=0;i<3;i++){if(i)await page.keyboard.press('ArrowUp');const wrong=(await mazeDOM(page)).signs.find(t=>t!==nextWords[0]);await openMazeChoice(page,wrong);}
 await expect(page.locator('.memory-maze')).toHaveClass(/maze-game-over/);await page.locator('[data-maze-action=retry]').click();await expect(page.locator('[data-maze-chamber]')).toContainText('1:2');await expect(page.locator('[data-maze-strikes]')).toContainText('3/3');
 for(const word of nextWords)await openMazeChoice(page,word);await expect(page.locator('[data-maze-panel]')).toContainText('Journey saved');await expect(page.locator('[data-maze-action=continue]')).toContainText('ayah 3');await page.locator('[data-maze-action=recall]').click();await expect(page.locator('.maze-grid')).toHaveCount(0);await expect(page.locator('main')).toContainText('SELF-ASSESSED RECITATION');
});

test('fog exploration, map reveal, zoom, native input guards, pause and cleanup preserve other games',async({page})=>{
 await openMaze(page,{difficulty:'standard'});expect(await page.locator('.maze-fog').count()).toBeGreaterThan(20);await page.locator('[data-maze-action=map]').click();await expect(page.locator('.maze-fog')).toHaveCount(0);await expect(page.locator('[data-maze-action=map]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-maze-action=zoom-in]').click();expect(await page.locator('.maze-grid').evaluate(e=>getComputedStyle(e).getPropertyValue('--maze-zoom'))).toBe('1.25');
 const before=(await mazeDOM(page)).player;await page.locator('#lab-volume').focus();await page.keyboard.press('ArrowLeft');expect((await mazeDOM(page)).player).toEqual(before);
 await page.locator('.maze-scroll').focus();await page.keyboard.press('p');await expect(page.locator('.maze-overlay')).toBeVisible();await page.keyboard.press('ArrowDown');expect((await mazeDOM(page)).player).toEqual(before);await page.locator('[data-maze-action=resume]').click();await expect(page.locator('.maze-overlay')).toBeHidden();
 const correct=(await mazeDOM(page)).signs.find(t=>t===words[0]);await openMazeChoice(page,correct);expect(await page.locator('.maze-fog').count()).toBe(0);await page.locator('[data-maze-action=map]').click();expect(await page.locator('.maze-fog').count()).toBeGreaterThan(20);
 await page.locator('[data-game=falling]').click();await expect(page.locator('.falling-stage')).toBeVisible();await expect(page.locator('.maze-grid')).toHaveCount(0);await page.locator('[data-game=snake]').click();await expect(page.locator('.snake-config')).toBeVisible();
});

test('entry audio, listening stations, shared volume, silence, failures and disposal',async({page})=>{
 await page.addInitScript(()=>{window.mazeAudio=[];window.mazeStops=0;window.Audio=class{constructor(src){this.src=src;window.mazeAudio.push(this);}play(){return window.failMazeAudio?Promise.reject(Error('offline')):Promise.resolve();}pause(){window.mazeStops++;}removeAttribute(){}load(){}};});
 await openMaze(page,{audio:'listen'});expect(await page.evaluate(()=>window.mazeAudio.at(-1).src)).toContain('001001');expect(await page.evaluate(()=>window.mazeAudio.at(-1).loop)).toBe(false);
 await page.locator('#lab-volume').fill('23');expect(await page.evaluate(()=>window.mazeAudio.at(-1).volume)).toBe(.23);await page.locator('#lab-mute').click();expect(await page.evaluate(()=>window.mazeAudio.at(-1).muted)).toBe(true);
 await page.locator('[data-maze-audio]').selectOption('silent');const stops=await page.evaluate(()=>window.mazeStops);await page.evaluate(()=>window.failMazeAudio=true);await page.locator('[data-maze-action=listen]').click();await expect(page.locator('.maze-status')).toContainText('could not start');await expect(page.locator('[data-maze-strikes]')).toContainText('3/3');
 await page.locator('[data-game=asteroids]').click();expect(await page.evaluate(()=>window.mazeStops)).toBeGreaterThanOrEqual(stops);await expect(page.locator('.maze-grid')).toHaveCount(0);
});

test('mobile touch movement, swipes, readable signs, reduced motion and Night Sky fit the viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();await openMaze(page);await page.evaluate(()=>document.documentElement.dataset.theme='night-sky');await expect(page.locator('.memory-maze')).toHaveClass(/maze-reduced/);
 const s=await mazeDOM(page),direction=s.layout.cells[1][2]?'right':'down',button=page.getByRole('button',{name:`Move ${direction}`,exact:true});const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(64);expect(box.width).toBeGreaterThanOrEqual(64);await button.tap();expect((await mazeDOM(page)).player).not.toEqual(s.player);
 const before=(await mazeDOM(page)).player;await page.locator('.maze-scroll').scrollIntoViewIfNeeded();const b=await page.locator('.maze-scroll').boundingBox(),cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.5,y:b.y+b.height*.5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*.5+(direction==='right'?45:0),y:b.y+b.height*.5+(direction==='down'?45:0)}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 // Swipe may meet the next corridor wall; it remains a navigation event, never a memory mistake.
 await expect(page.locator('[data-maze-strikes]')).toContainText('3/3');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.maze-sign .arabic').first()).toBeVisible();expect(await page.locator('.maze-sign .arabic').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(28);await context.close();
});

test('failed saving gives retry feedback, duplicate XP is prevented, and unsupported Expert phrases fail safely',async({page})=>{
 await openMaze(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;window.failMazeSave=true;Storage.prototype.setItem=function(k,v){if(k==='ayah-puzzle-lab-v1'&&window.failMazeSave)throw Error('Storage full');return set.call(this,k,v);};});for(const word of words)await openMazeChoice(page,word);await expect(page.locator('[data-maze-panel]')).toContainText('Not saved yet');const xp=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp);await page.locator('[data-maze-action=replay]').click();await expect(page.locator('.maze-victory')).toBeVisible();await page.evaluate(()=>window.failMazeSave=false);await page.locator('[data-maze-action=save]').click();await expect(page.locator('[data-maze-panel]')).toContainText('Journey saved');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp)).toBe(xp);
 await page.locator('[name=first]').fill('7');await page.locator('[name=difficulty]').selectOption('expert');await page.getByRole('button',{name:'Prepare maze',exact:true}).click();await expect(page.locator('[data-maze-preparation]')).toContainText('approved');await expect(page.locator('.maze-victory')).toBeVisible();
});
