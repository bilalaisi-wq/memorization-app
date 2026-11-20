import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=JSON.parse(readFileSync(new URL('./fixtures/2-282.json',import.meta.url)));
test('source-validated Ayatul Dayn component keeps 128 words in 26 visual pieces and a bounded tower',async({page})=>{
 await page.goto('/');await expect(page.locator('main')).toBeVisible();await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
 await page.evaluate(async b=>{
  const {mountFalling}=await import('/src/puzzles/falling-ui.js'),{towerVerse}=await import('/src/puzzles/tower-units.js');
  window.Audio=class{play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};
  const verse=towerVerse({id:b.ayah,words:b.words.map(w=>w.text),roman:b.words.map(w=>w.transliteration||''),meanings:b.words.map(w=>[w.translation||'',''])});
  const entries=verse.words.map((text,i)=>({text,roman:verse.roman[i],sourceWords:verse.groups[i].map(p=>b.words[p]),surah:b.surah,ayah:b.ayah,position:i}));
  window.longTower=mountFalling(document.querySelector('main'),{surah:{id:b.surah,name:'Al-Baqarah · canonical source fixture',verses:[verse]},verse,muted:()=>true,onFinish:()=>{},onExit:()=>{},say:()=>{},questOptions:{entries,order:entries.map((_,i)=>i),audioSource:b.audioAssets[0]?.source||''}});window.longTower.start();
 },source);
 for(let i=0;i<12;i++){const gate=page.locator('[data-tower-gate]');if(await gate.count()){const expected=await page.evaluate(()=>window.longTower.getSnapshot().gate.expected);await page.locator(`[data-tower-gate="${expected}"]`).click();}await page.locator('#fall-place').click();}
 await expect(page.locator('.falling-counter')).toContainText('12 / 26 pieces');await expect(page.locator('.falling-counter')).toContainText('60 / 128');await expect(page.locator('[data-tower-section]')).toHaveCount(3);expect(await page.locator('[data-slot]').count()).toBeLessThanOrEqual(12);const s=await page.evaluate(()=>window.longTower.getSnapshot());expect(s.board).toHaveLength(18);expect(s.accepted.join(' ')).toBe(source.words.slice(0,60).map(w=>w.text).join(' '));
 await page.locator('[data-show-transliteration]').first().check();await page.screenshot({path:'/workspace/artifacts/irda-long-128-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/workspace/artifacts/irda-long-128-mobile.png',fullPage:true});const label=page.locator('.tower-label');expect(await label.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.evaluate(()=>window.longTower.dispose());
});
test('registered PassageContext Blocks labels grouped stage pieces and their original source-word counts',async({page})=>{
 await page.goto('/');await expect(page.locator('main')).toBeVisible();await page.evaluate(async b=>{
  window.Audio=class{play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};
  const {createArcadePlan}=await import('/src/puzzles/arcade/passage/plan.js'),{stageAdapter}=await import('/src/puzzles/arcade/passage/adapter.js'),{blocksRegistration}=await import('/src/quest/expedition/blocks.js'),{surahs}=await import('/src/data.js');
  const plan=await createArcadePlan([b],{game:'falling',groupSize:2}),adapter=stageAdapter(b,plan.stages[0],surahs);const root=document.createElement('section');root.id='registered-long';document.querySelector('main').append(root);window.registeredLong=blocksRegistration.create({root,adapter,config:{keys:[b.key],seed:1,chainMode:'practice',memoryDifficulty:'guided',motorDifficulty:'relaxed'},id:'registered-long-test',muted:()=>true,volume:()=>0,onComplete:()=>{}});
 },source);await expect(page.locator('#registered-long .falling-counter')).toContainText('12 pieces');await expect(page.locator('#registered-long .falling-counter')).toContainText('Source words 0 / 24');expect(await page.locator('#registered-long [data-slot]').count()).toBeLessThanOrEqual(12);await page.evaluate(()=>window.registeredLong.dispose());
});
