import {test,expect} from '@playwright/test';
import {enableDeveloperLab} from './developer-lab-helper.js';
async function prepare(page){await page.goto('/');await enableDeveloperLab(page);await page.locator('#nav-puzzle-lab').click();}
test('tutorial reference exposure marks a matching pending recall assisted without grading or scheduling',async({page})=>{
 await prepare(page);await page.evaluate(async()=>{const {createPassageMemory}=await import('/src/passage/memory.js'),{localBundle}=await import('/src/content/library.js'),{recallUnit}=await import('/src/passage/model.js');const m=createPassageMemory(localStorage);m.begin(await recallUnit([localBundle('112:1')]));});
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1')));
 await page.locator('[data-game=bridge]').click();await expect(page.locator('.bridge-tutorial-dialog')).toBeVisible();await expect(page.locator('[data-tutorial-verse="112:1"]')).toBeVisible();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1')));expect(before.active.assisted).toBe(false);expect(after.active.assisted).toBe(true);expect(after.active.graded).toBeFalsy();expect(after.active.result).toBeUndefined();expect(after.records).toEqual(before.records);expect(after.active.id).toBe(before.active.id);
});
test('failed assistance writes prevent tutorial reference text and recitation from being exposed',async({page})=>{
 await prepare(page);await page.evaluate(()=>{window.guardAudio=[];window.Audio=class{constructor(src){window.guardAudio.push(src);}play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};window.addEventListener('ayah-study-exposure',e=>e.preventDefault());});
 await page.locator('[data-game=bridge]').click();await expect(page.locator('.bridge-tutorial-dialog')).toHaveAttribute('data-phase','blocked');await expect(page.locator('[data-tutorial-verse]')).toHaveCount(0);await expect(page.locator('[data-tutorial-status]')).toContainText('Could not record study assistance');await page.locator('[data-tutorial-replay]').click();expect(await page.evaluate(()=>window.guardAudio.length)).toBe(0);await page.locator('[data-tutorial-skip]').click();await expect(page.locator('.bridge-config')).toBeVisible();
});
