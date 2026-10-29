import {test,expect} from '@playwright/test';
import {foodCells} from '../src/puzzles/arcade/snake/engine.js';
import {surahs} from '../src/data.js';
import {openSnake,snakeDOM,snakeMove,snakeCollect,snakePortal,snakeRoute} from './snake-helper.js';
const words=surahs[0].verses[0].words;

test('continuous movement, keyboard steering, pause, slow speed and safe wall recovery never cost memory strikes',async({page})=>{
 await openSnake(page);const before=await snakeDOM(page);await page.clock.runFor(1100);expect((await snakeDOM(page)).body[0]).not.toEqual(before.body[0]);
 const safe=await snakeDOM(page);await page.clock.fastForward(10000);expect((await snakeDOM(page)).body).toEqual(safe.body);
 await snakeMove(page,'up');expect((await snakeDOM(page)).body[0].y).toBeLessThan(before.body[0].y);
 await page.locator('[data-snake-action=pause]').click();const paused=await snakeDOM(page);await page.clock.runFor(5000);expect((await snakeDOM(page)).body).toEqual(paused.body);await page.locator('[data-snake-action=resume]').click();
 // Keep a direction until a wall stops the snake. Food may add only deliberate sequence mistakes; steer down along the empty starting corridor.
 await snakeMove(page,'left');await page.clock.runFor(6000);await expect(page.locator('[data-snake-action=recover]')).toBeVisible();
 const strikes=await page.locator('[data-snake-strikes]').textContent();await page.getByRole('button',{name:'Continue on a safe route',exact:true}).click();await expect(page.locator('.snake-overlay')).toBeHidden();expect(await page.locator('[data-snake-strikes]').textContent()).toBe(strikes);
 await page.locator('[data-snake-speed]').selectOption('brisk');await expect(page.locator('[data-snake-speed]')).toHaveValue('brisk');
 await page.locator('[data-game=falling]').click();await expect(page.locator('.falling-stage')).toBeVisible();await expect(page.locator('.snake-board')).toHaveCount(0);
});

test('correct words grow a real tail, assemble exact RTL text, save and replay without farming XP',async({page})=>{
 test.setTimeout(90000);await openSnake(page);
 for(const word of words)await snakeCollect(page,word);
 await expect(page.locator('.ayah-snake')).toHaveClass(/snake-victory/);await expect(page.locator('.snake-sequence')).toHaveAttribute('dir','rtl');
 expect((await snakeDOM(page)).body).toHaveLength(3+words.length);expect(await page.locator('.snake-sequence').textContent()).toBe(words.join(' '));await expect(page.locator('.snake-save')).toContainText('Trail saved');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1'))),xp=saved.wallet.xp;expect(saved.records['1:1'].memory.card).toBeNull();
 const receipt=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history.find(h=>h.game==='snake'));expect(receipt.arcade.score).toBe(600);
 await page.locator('[data-snake-action=replay]').focus();await page.keyboard.press('Space');await expect(page.locator('.snake-overlay')).toBeHidden();expect((await snakeDOM(page)).count).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp)).toBe(xp);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history.some(h=>h.game==='snake'))).toBe(true);
});

test('Chain uses a physical portal and Practice checkpoints; completion offers next ayahs and recall',async({page})=>{
 test.setTimeout(90000);await openSnake(page,{end:2,rules:'practice'});
 for(const word of words)await snakeCollect(page,word);
 await expect(page.locator('.snake-portal')).toBeVisible();await expect(page.locator('[data-snake-sector]')).toContainText('1:1');await snakePortal(page);await expect(page.locator('[data-snake-sector]')).toContainText('1:2');expect((await snakeDOM(page)).count).toBe(0);
 for(const word of surahs[0].verses[1].words)await snakeCollect(page,word);
 await expect(page.locator('.snake-save')).toContainText('Trail saved');await expect(page.locator('[data-snake-action=continue]')).toContainText('ayahs 3–4');
 await page.locator('[data-snake-action=recall]').click();await expect(page.locator('.snake-board')).toHaveCount(0);await expect(page.locator('main')).toContainText('SELF-ASSESSED RECITATION');
});

test('three wrong words show game over and retry, while motor bumps never consume memory strikes',async({page})=>{
 test.setTimeout(90000);await openSnake(page);
 for(let i=0;i<3;i++){
  const before=await page.locator('[data-snake-strikes]').textContent();
  for(let move=0;move<150;move++){
   let state=await snakeDOM(page);if(state.motor){await page.locator('[data-snake-action=recover]').click();state=await snakeDOM(page);}
   const wrong=state.food.find(f=>f.text!==words[0]&&snakeRoute(state,foodCells(f),state.food.filter(o=>o.id!==f.id).flatMap(foodCells))?.length);expect(wrong).toBeTruthy();
   const path=snakeRoute(state,foodCells(wrong),state.food.filter(o=>o.id!==wrong.id).flatMap(foodCells));await snakeMove(page,path[0]);
   if(await page.locator('[data-snake-strikes]').textContent()!==before)break;
  }
 }
 await expect(page.locator('.ayah-snake')).toHaveClass(/snake-game-over/);await expect(page.locator('[data-snake-strikes]')).toContainText('0/3');
 await page.getByRole('button',{name:'Retry trail',exact:true}).click();await expect(page.locator('.snake-overlay')).toBeHidden();await expect(page.locator('[data-snake-strikes]')).toContainText('3/3');
});

test('verified looping audio, silence, mute and playback failures clean up on navigation',async({page})=>{
 await page.addInitScript(()=>{window.snakeAudio=[];window.snakeStops=0;window.Audio=class{constructor(src){this.src=src;window.snakeAudio.push(this);}play(){return Promise.resolve();}pause(){window.snakeStops++;}removeAttribute(){}load(){}};});
 await openSnake(page,{audio:'listen'});expect(await page.evaluate(()=>window.snakeAudio.at(-1).loop)).toBe(true);expect(await page.evaluate(()=>window.snakeAudio.at(-1).src)).toContain('001001');
 await page.locator('#lab-mute').click();expect(await page.evaluate(()=>window.snakeAudio.at(-1).muted)).toBe(true);
 await page.locator('[data-snake-audio]').selectOption('silent');const stopped=await page.evaluate(()=>window.snakeStops);expect(stopped).toBeGreaterThan(0);
 await page.locator('[data-snake-action=listen]').click();expect(await page.evaluate(()=>window.snakeAudio.at(-1).loop)).toBe(false);
 await page.locator('[data-game=asteroids]').click();expect(await page.evaluate(()=>window.snakeStops)).toBeGreaterThan(stopped);await expect(page.locator('.snake-board')).toHaveCount(0);
});

test('mobile touch direction pad and swipes steer; reduced motion keeps Arabic visible and board fits',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
 await openSnake(page);await expect(page.locator('.ayah-snake')).toHaveClass(/snake-reduced/);
 const before=await snakeDOM(page);await page.getByRole('button',{name:'Steer up',exact:true}).tap();await page.clock.runFor(1100);expect((await snakeDOM(page)).body[0].y).toBeLessThan(before.body[0].y);
 const board=page.locator('.snake-board');await board.scrollIntoViewIfNeeded();const box=await board.boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.6,y:box.y+box.height*.6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.8,y:box.y+box.height*.6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(1100);
 await expect(board).toHaveAttribute('data-direction','right');expect((await board.boundingBox()).width).toBeLessThanOrEqual(390);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.snake-word .arabic').first()).toBeVisible();await context.close();
});

test('audio failure cannot stop movement or consume a strike',async({page})=>{
 await page.addInitScript(()=>{window.Audio=class{play(){return Promise.reject(Error('offline'));}pause(){}removeAttribute(){}load(){}};});
 await openSnake(page,{audio:'listen'});await expect(page.locator('.snake-status')).toContainText('could not start');await expect(page.locator('[data-snake-strikes]')).toContainText('3/3');
 const before=await snakeDOM(page);await page.clock.runFor(1100);expect((await snakeDOM(page)).body[0]).not.toEqual(before.body[0]);await expect(page.locator('[data-snake-strikes]')).toContainText('3/3');
});

test('save failure stays visible and retry confirms success without duplicate XP',async({page})=>{
 test.setTimeout(90000);await openSnake(page);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.failSnakeSave=true;Storage.prototype.setItem=function(key,value){if(key==='ayah-puzzle-lab-v1'&&window.failSnakeSave)throw Error('Storage full');return original.call(this,key,value);};});
 for(const word of words)await snakeCollect(page,word);
 await expect(page.locator('.snake-save')).toContainText('not finished saving');const xp=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp);
 await page.locator('[data-snake-action=replay]').click();await expect(page.locator('.snake-victory')).toBeVisible();
 await page.evaluate(()=>window.failSnakeSave=false);await page.locator('[data-snake-action=save]').click();await expect(page.locator('.snake-save')).toContainText('Trail saved');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp)).toBe(xp);await expect(page.locator('[data-snake-action=save]')).toHaveCount(0);
});
