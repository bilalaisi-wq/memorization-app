import {test,expect} from '@playwright/test';
import {readLabVolume,createAudioLevel,LAB_VOLUME_KEY} from '../src/puzzles/audio-level.js';
import {startFalling} from './falling-helper.js';
const getStorage=value=>({getItem:()=>value});
async function mocks(page){await page.addInitScript(()=>{window.arcadeAudio=[];window.Audio=class{constructor(src){this.src=src;window.arcadeAudio.push(this);}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}};});}
async function open(page){page.on('pageerror',e=>{throw e;});await page.goto('/');await page.locator('#nav-puzzle-lab').click();}
async function level(page,percentage){await page.locator('#lab-volume').fill(String(percentage));await expect(page.locator('#lab-volume-value')).toHaveText(`${percentage}%`);}

test('safe volume defaults, zero, clamping and media fallback do not affect mute',()=>{
 expect(readLabVolume(getStorage(null))).toBe(.5);expect(readLabVolume(getStorage('bad'))).toBe(.5);expect(readLabVolume(getStorage(''))).toBe(.5);expect(readLabVolume(getStorage('0'))).toBe(0);expect(readLabVolume(getStorage('2'))).toBe(1);expect(readLabVolume(getStorage('-1'))).toBe(0);expect(readLabVolume({getItem(){throw Error('offline');}})).toBe(.5);
 const control=createAudioLevel({initialVolume:.25,useGain:false}),a={muted:true};control.attach(a);expect(a.volume).toBe(.25);control.setVolume(0);expect(a.volume).toBe(0);expect(a.muted).toBe(true);control.detach();control.setVolume(.8);const b={};control.attach(b);expect(b.volume).toBe(.8);control.dispose();
});

test('mobile gain stage adjusts level and releases graph/context resources',()=>{
 let closed=0,disconnected=0,resumed=0,source;
 class Media{}
 const gain={gain:{value:1},connect(){},disconnect(){disconnected++;}};
 class Context{destination={};createGain(){return gain;}createMediaElementSource(){return source={connect(){},disconnect(){disconnected++;}};}resume(){resumed++;return Promise.resolve();}close(){closed++;return Promise.resolve();}}
 const control=createAudioLevel({initialVolume:.4,useGain:true,AudioContextClass:Context,MediaElementClass:Media}),audio=new Media();control.attach(audio);expect(audio.volume).toBe(1);expect(gain.gain.value).toBe(.4);control.setVolume(.1);expect(gain.gain.value).toBe(.1);control.resume();control.dispose();control.dispose();expect(closed).toBe(1);expect(disconnected).toBeGreaterThanOrEqual(2);expect(resumed).toBe(2);
 const fallback=createAudioLevel({initialVolume:.3,useGain:true,AudioContextClass:class{constructor(){throw Error('unavailable');}},MediaElementClass:Media}),other=new Media();fallback.attach(other);expect(other.volume).toBe(.3);fallback.dispose();
});

test('new game names and recitation level persist across all games, new clips, mute and reload',async({page})=>{
 await mocks(page);await open(page);
 await expect(page.locator('[data-game=falling]')).toContainText('Ayah Blocks');await expect(page.locator('[data-game=asteroids]')).toContainText('Ayah Space');await expect(page.locator('[data-game=snake]')).toContainText('Ayah Serpent');
 await expect(page.locator('#lab-volume')).toHaveValue('50');await level(page,23);
 await page.getByRole('button',{name:'Start',exact:true}).click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.23);
 await level(page,61);expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.61);
 await page.locator('#lab-mute').click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).muted)).toBe(true);await level(page,15);await page.locator('#lab-mute').click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.15);
 for(const game of ['asteroids','snake']){
  await page.locator(`[data-game=${game}]`).click();await page.getByRole('button',{name:game==='asteroids'?'Prepare flight':'Prepare trail',exact:true}).click();await page.getByRole('button',{name:game==='asteroids'?'Start flight':'Start trail',exact:true}).click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.15);
  await level(page,42);expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.42);await page.locator('#lab-replay').click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(.42);await level(page,15);
 }
 await level(page,0);expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(0);await page.reload();await page.locator('#nav-puzzle-lab').click();await expect(page.locator('#lab-volume')).toHaveValue('0');await page.getByRole('button',{name:'Start',exact:true}).click();expect(await page.evaluate(()=>window.arcadeAudio.at(-1).volume)).toBe(0);
 expect(await page.evaluate(key=>localStorage.getItem(key),LAB_VOLUME_KEY)).toBe('0');
});

test('B/N rotate without clicking the board, preserve arrows/X, and leave typing/volume keys alone',async({page})=>{
 await open(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await startFalling(page);
 // Hold can replace the square shape, whose rotation is intentionally invariant.
 if(await page.locator('.falling-block').getAttribute('data-shape')==='O')await page.locator('#fall-hold').click();
 const cells=()=>page.locator('.tetromino-cell.active').evaluateAll(nodes=>nodes.map(e=>[e.style.getPropertyValue('--x'),e.style.getPropertyValue('--y')]));
 const before=await cells();await page.locator('.falling-stage').focus();await page.keyboard.press('b');expect(await cells()).not.toEqual(before);const afterB=await cells();await page.keyboard.press('n');expect(await cells()).not.toEqual(afterB);
 await page.locator('[name=first]').focus();const typed=await cells();await page.keyboard.press('b');expect(await cells()).toEqual(typed);
 await page.locator('#lab-volume').focus();const current=await cells();await page.keyboard.press('ArrowRight');expect(await cells()).toEqual(current);
 await expect(page.locator('.falling-stage')).toHaveAttribute('aria-keyshortcuts',/B N/);
});

test('phone keypad has large real touch targets for move, rotate, lower and drop without overflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();await mocks(page);await open(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await startFalling(page);
 const board=page.locator('.falling-stage');await board.scrollIntoViewIfNeeded();
 for(const id of ['fall-left','fall-right','fall-rotate','fall-down','fall-place']){const box=await page.locator(`#${id}`).boundingBox();expect(box.width).toBeGreaterThanOrEqual(64);expect(box.height).toBeGreaterThanOrEqual(68);}
 await page.locator('#fall-left').tap();await expect(page.locator('.falling-block')).toHaveAttribute('data-lane','2');
 await page.locator('#fall-right').tap();await expect(page.locator('.falling-block')).toHaveAttribute('data-lane','3');
 await page.locator('#fall-rotate').tap();await page.locator('#fall-down').tap();const evidence=()=>page.evaluate(()=>({placed:document.querySelector('.falling-counter').textContent,strikes:document.querySelectorAll('.tower-strikes .used').length,locked:document.querySelectorAll('.tetromino-cell.locked').length}));const prior=await evidence();await page.locator('#fall-place').tap();expect(await evidence()).not.toEqual(prior);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.falling-block')).toBeVisible();await context.close();
});
