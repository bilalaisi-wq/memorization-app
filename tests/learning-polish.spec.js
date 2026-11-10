import {test,expect} from '@playwright/test';
import {createFlowRunner,BOOST_MULTIPLIER,NORMAL_FLIGHT_RATE} from '../src/puzzles/arcade/cosmic/flow-runner.js';
import {createFlowUnits,flowTransliteration} from '../src/quest/cosmic/flow-content.js';
import {resolvePlatformCollisions} from '../src/puzzles/arcade/sirat/engine.js';
import {surahs} from '../src/data.js';
import {enableDeveloperLab} from './developer-lab-helper.js';
test('normal flight slows 30 percent while boost is 50 percent faster than the previous absolute boosted rate',()=>{
 const g=createFlowRunner({units:createFlowUnits(['1:1'],'words'),stageId:'rate'});g.start();g.dispatch({type:'tick',dt:.02});expect(g.getSnapshot().elapsed).toBeCloseTo(.02*.7);
 const before=g.getSnapshot().elapsed;g.dispatch({type:'boost',active:true});g.dispatch({type:'tick',dt:.02});expect(g.getSnapshot().elapsed-before).toBeCloseTo(.02*3.234*1.5);expect(NORMAL_FLIGHT_RATE).toBe(.7);expect(BOOST_MULTIPLIER).toBeCloseTo(4.851);
});
test('runner transliterations preserve the source positions for words chunks and ayahs',()=>{for(const mode of ['words','mixed','ayahs'])for(const u of createFlowUnits(['1:1','1:2'],mode)){const [s,a]=u.key.split(':').map(Number),v=surahs.find(c=>c.id===s).verses.find(v=>v.id===a);expect(flowTransliteration(u)).toBe(v.roman.slice(u.kind==='ayah'?0:u.index,u.kind==='ayah'?v.words.length:u.kind==='chunk'?u.endIndex:u.index+1).join(' '));}});
test('exact platform contact stays grounded across zero-time frames instead of flashing doors',()=>{
 const p={x:1200,y:394,vy:0,vx:0,grounded:false},platform={id:'gate-floor',x:1150,y:440,w:500,h:50};
 for(let i=0;i<120;i++){p.grounded=false;resolvePlatformCollisions(p,{x:p.x,y:p.y},[platform],0,0);expect(p.grounded).toBe(true);expect(p.y).toBe(394);}
});
test('Ayah Chain reorders built words by native drag and accessible arrows without clearing the puzzle',async({page})=>{
 await page.goto('/');await page.locator('[data-mode=sequence]').click();await page.locator('#chain-start').click();
 const puzzle=page.locator('[data-puzzle="1"]');for(const i of [1,0,2,3])await puzzle.locator(`.word-bank [data-word="${i}"]`).click();
 await puzzle.locator('.build-zone [data-word="0"]').dragTo(puzzle.locator('.build-zone [data-word="1"]'));
 await expect(puzzle.locator('.build-zone [data-word]')).toHaveCount(4);
 expect(await puzzle.locator('.build-zone [data-word]').evaluateAll(xs=>xs.map(x=>+x.dataset.word))).toEqual([0,1,2,3]);
 await puzzle.locator('.build-zone .piece-wrap').last().locator('[data-earlier]').click();
 expect(await puzzle.locator('.build-zone [data-word]').evaluateAll(xs=>xs.map(x=>+x.dataset.word))).toEqual([0,1,3,2]);
});
test('QUR\'AN CHRONICLES is hidden for learners, developer-only and labeled coming soon',async({page})=>{
 await page.goto('/');await expect(page.locator('#nav-comprehension-lab')).toBeHidden();await enableDeveloperLab(page);await expect(page.locator('#nav-comprehension-lab')).toBeVisible();await expect(page.locator('#nav-comprehension-lab')).toContainText('Coming soon');
 await page.evaluate(async()=>{(await import('/src/developer/access.js')).setDeveloperPreview(false);});await expect(page.locator('#nav-comprehension-lab')).toBeHidden();
});
test('mobile Star Runner pickups show Arabic and source transliteration together',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#nav-revision-lab').click();await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill('3');await page.locator('[name=end]').fill('3');await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-flow-guidance]').uncheck();await page.clock.install();await page.locator('[data-launch-runner]').click();await page.getByRole('button',{name:'Start flight',exact:true}).click();await page.clock.runFor(2000);await expect(page.locator('.runner-pickup-roman').first()).not.toBeEmpty();await expect(page.locator('.runner-pickup-arabic').first()).not.toBeEmpty();await page.screenshot({path:'/workspace/artifacts/runner-reading-mobile.png',fullPage:true});
});
test('Ayah Chain rejects a word dragged from a different ayah workspace',async({page})=>{
 await page.goto('/');await page.locator('[data-mode=sequence]').click();await page.locator('#chain-start').click();
 await page.locator('[data-puzzle="1"] .word-bank [data-word="0"]').dragTo(page.locator('[data-puzzle="2"] .build-zone'));
 await expect(page.locator('[data-puzzle="2"] .build-zone [data-word]')).toHaveCount(0);
});
test('Sirat doorway choices stay visible while standing at the gateway',async({page})=>{
 const {openSirat,reachGateway}=await import('./sirat-helper.js');await openSirat(page);await reachGateway(page);
 await page.keyboard.up('ArrowRight');await page.keyboard.up('KeyD');const stage=page.locator('.sirat-stage');
 await stage.evaluate(el=>{window.gatewayFlashes=0;window.gatewayObserver=new MutationObserver(ms=>{for(const m of ms)if(m.attributeName==='data-near'&&el.dataset.near==='false')window.gatewayFlashes++;});window.gatewayObserver.observe(el,{attributes:true,attributeFilter:['data-near']});});
 await page.clock.runFor(3000);await expect(stage).toHaveAttribute('data-near','true');expect(await page.evaluate(()=>{window.gatewayObserver.disconnect();return window.gatewayFlashes;})).toBe(0);
 await page.screenshot({path:'/workspace/artifacts/sirat-stable-gate.png',fullPage:true});
});
