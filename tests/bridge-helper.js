import {expect} from '@playwright/test';
import {surahs} from '../src/data.js';
export async function openBridge(page,{end=2,rules='classic',difficulty='beginner',audio='silent',gate=false,start=true,reload=false}={}){
 if(!reload)await page.addInitScript(()=>{window.bridgeAudio=[];window.Audio=class{constructor(src){this.src=src;window.bridgeAudio.push(this);}play(){this.playing=true;return Promise.resolve();}pause(){this.playing=false;}load(){}removeAttribute(){} };});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=bridge]').click();if(await page.locator('.bridge-tutorial-dialog').isVisible())await page.locator('.bridge-tutorial-dialog [data-tutorial-skip]').first().click();
 if(end>2){await page.locator('[name=journey]').selectOption('chain');await page.locator('[name=last]').fill(String(end));}
 if(gate)await page.locator('[name=bridgeGate]').check();await page.locator('[name=rules]').selectOption(rules);await page.locator('[name=difficulty]').selectOption(difficulty);if(!reload)await page.clock.install();await page.getByRole('button',{name:'Prepare crossing',exact:true}).click();await expect(page.locator('.bridge-stage')).toBeVisible();if(audio!==null)await page.locator('[data-bridge-audio]').selectOption(audio);if(start)await page.getByRole('button',{name:'Start linking',exact:true}).click();
}
export function opening(ayah,difficulty='beginner'){return surahs[0].verses[ayah-1].words.slice(0,difficulty==='beginner'?1:3).join(' ');}
export async function currentOpening(page,ayah){const n=Number(await page.locator('.bridge-stage').getAttribute('data-opening-length'));return surahs[0].verses[ayah-1].words.slice(0,n).join(' ');}
export async function selectBridgeEnding(page){if(await page.locator('.bridge-stage').getAttribute('data-endpoint-side')!=='ending')return;const [from]=String(await page.locator('.bridge-stage').getAttribute('data-transition')).split('>'),ayah=Number(from.split(':')[1]),n=Number(await page.locator('.bridge-stage').getAttribute('data-ending-length')),text=surahs[0].verses[ayah-1].words.slice(-n).join(' ');const button=page.locator('[data-bridge-choice]').filter({has:page.getByText(text,{exact:true})});await button.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await button.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
export async function connectBoundary(page,ayah=2,difficulty='beginner'){
 if(await page.locator('[data-bridge-action=ready]').isVisible())await page.locator('[data-bridge-action=ready]').click();
 await selectBridgeEnding(page);const card=page.locator('[data-bridge-choice]').filter({has:page.getByText(await currentOpening(page,ayah),{exact:true})});await card.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await card.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.clock.runFor(2400);
}
