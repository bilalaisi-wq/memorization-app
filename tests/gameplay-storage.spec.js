import {test,expect} from '@playwright/test';
import {openBridge} from './bridge-helper.js';
import {openMaze} from './maze-helper.js';
import {openSirat} from './sirat-helper.js';
for(const [game,open,surface,module,key] of [
 ['bridge',openBridge,'.bridge-stage','bridge/checkpoints.js','BRIDGE_CHECKPOINT_KEY'],
 ['maze',openMaze,'.maze-scroll','maze/checkpoints.js','MAZE_CHECKPOINT_KEY'],
 ['sirat',openSirat,'.sirat-stage','sirat/checkpoints.js','SIRAT_KEY'],
])test(`${game}: a failed checkpoint freezes safely, preserves memory evidence and retries the same run`,async({page})=>{
 await page.addInitScript(()=>{window.Audio=class{constructor(src){this.src=src;}play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};});await open(page);
 const storageKey=await page.evaluate(async({module,key})=>(await import(`/src/puzzles/arcade/${module}`))[key],{module,key});expect(typeof storageKey).toBe('string');
 await page.evaluate(key=>{const set=Storage.prototype.setItem;window.checkpointFull=true;Storage.prototype.setItem=function(k,v){if(k.endsWith(key)&&window.checkpointFull)throw Error('Test storage full');return set.call(this,k,v);};},storageKey);
 await page.locator(surface).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('button',{name:'Retry checkpoint save',exact:true})).toBeVisible();await expect(page.locator(`[data-${game}-panel]`)).toContainText('Checkpoint could not save');
 await page.evaluate(()=>window.checkpointFull=false);await page.getByRole('button',{name:'Retry checkpoint save',exact:true}).click();await expect(page.locator(`[data-${game}-action=resume]`)).toBeVisible();await page.locator(`[data-${game}-action=resume]`).click();await expect(page.getByRole('button',{name:'Retry checkpoint save',exact:true})).toHaveCount(0);
 const result=await page.evaluate(key=>({saved:JSON.parse(localStorage.getItem(key)),memory:JSON.parse(localStorage.getItem('ayah-learning-v1'))}),storageKey);expect(result.saved).toBeTruthy();expect(Object.values(result.memory?.records||{}).flatMap(r=>r.memory.history)).toEqual([]);expect(result.memory?.wallet?.xp||0).toBe(0);
});
