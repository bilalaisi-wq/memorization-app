import {test,expect} from '@playwright/test';
import {surahs} from '../src/data.js';
async function open(page,{end=1,rules='classic',difficulty='beginner',audio='silent'}={}){
 page.on('pageerror',e=>{throw e;});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=asteroids]').click();
 if(end>1){await page.locator('[name=journey]').selectOption('chain');await page.locator('[name=last]').fill(String(end));}
 await page.locator('[name=rules]').selectOption(rules);await page.locator('[name=difficulty]').selectOption(difficulty);
 await page.getByRole('button',{name:'Prepare flight',exact:true}).click();await expect(page.locator('.astro-stage')).toBeVisible();
 await page.locator('[data-astro-audio]').selectOption(audio);await page.getByRole('button',{name:'Start flight',exact:true}).click();
}
async function captureWord(page,text){
 const object=page.locator('.astro-rock:not(.astro-redirected)').filter({has:page.locator('.arabic', {hasText:text})}).first();
 await object.click({force:true});
 await expect(object).toHaveClass(/astro-locked/,{timeout:15000});
 await page.locator('.astro-stage').focus();await page.keyboard.press('Space');
}
async function solve(page,ayah){
 const assist=page.locator('[data-action=assist]');if(await assist.getAttribute('aria-pressed')==='false')await assist.click();
 for(const word of surahs[0].verses[ayah-1].words)await captureWord(page,word);
}

test('ship moves with held keys, beam needs range, shields redirect readable words, cleanup restores Falling',async({page})=>{
 await open(page);
 const ship=page.locator('.astro-ship'),stage=page.locator('.astro-stage');const left=await ship.evaluate(e=>e.style.left);
 await stage.focus();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(350);await page.keyboard.up('ArrowLeft');expect(await ship.evaluate(e=>e.style.left)).not.toBe(left);
 await stage.scrollIntoViewIfNeeded();const box=await stage.boundingBox();await page.mouse.click(box.x+box.width*.9,box.y+box.height*.95);await page.keyboard.press('Space');await expect(page.locator('.astro-status')).toContainText('No piece in tractor range');await expect(page.locator('[data-strikes]')).toContainText('3 / 3');
 await page.locator('[data-action=assist]').click();const rock=page.locator('.astro-rock').first();await rock.click({force:true});await expect(rock).toHaveClass(/astro-locked/,{timeout:15000});
 const text=await rock.locator('.arabic').textContent();await stage.focus();await page.keyboard.press('KeyE');await expect(rock).toHaveClass(/astro-redirected/);expect(await rock.locator('.arabic').textContent()).toBe(text);
 await page.locator('[data-action=pause]').click();const position=await ship.evaluate(e=>e.style.left);await page.waitForTimeout(150);expect(await ship.evaluate(e=>e.style.left)).toBe(position);
 await page.locator('[data-game=falling]').click();await expect(page.locator('.falling-stage')).toBeVisible();await expect(page.locator('.astro-stage')).toHaveCount(0);
 await page.keyboard.press('Space');await expect(page.locator('[data-slot]')).not.toHaveCount(0);
});

test('Single Ayah wins with a readable RTL sequence and idempotent game XP without recall mastery',async({page})=>{
 test.setTimeout(60000);await open(page);await solve(page,1);
 await expect(page.locator('.asteroids')).toHaveClass(/astro-victory/);await expect(page.locator('.astro-sequence')).toHaveAttribute('dir','rtl');
 for(const word of surahs[0].verses[0].words)await expect(page.locator('.astro-sequence')).toContainText(word);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')));const xp=saved.wallet.xp;expect(saved.records['1:1'].memory.card).toBeNull();
 await expect(page.locator('.astro-save-state')).toContainText('Flight saved');await expect(page.locator('[data-action=save]')).toHaveCount(0);await page.locator('[data-action=replay]').click();await expect(page.locator('.astro-overlay')).toBeHidden();await expect(page.locator('.astro-sequence')).toContainText('Captured words appear here');const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp);expect(after).toBe(xp);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-puzzle-lab-v1')).history.some(r=>r.game==='asteroids'))).toBe(true);
});

test('Chain travels to separate sectors and Echo failures do not trap or penalize learners',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{window.Audio=class{constructor(src){this.src=src;}play(){return Promise.reject(Error('blocked'));}pause(){}removeAttribute(){}load(){}};});
 await open(page,{end:2,rules:'practice',audio:'echo'});await expect(page.locator('.astro-overlay')).toBeHidden();await expect(page.locator('[data-strikes]')).toContainText('3 / 3');
 await page.locator('[data-astro-audio]').selectOption('silent');await solve(page,1);await expect(page.getByRole('button',{name:'Next sector →'})).toBeVisible();await page.getByRole('button',{name:'Next sector →'}).click();
 await expect(page.locator('[data-sector]')).toContainText('1:2');await expect(page.locator('.astro-sequence')).toContainText('Captured words appear here');await solve(page,2);await expect(page.locator('.asteroids')).toHaveClass(/astro-victory/);
});

test('Expert full-ayah phrases remain exact; unreviewed longer phrases fail closed',async({page})=>{
 await open(page,{difficulty:'expert'});await expect(page.locator('.astro-phrase')).not.toHaveCount(0);const full=surahs[0].verses[0].words.join(' ');await expect(page.locator('.astro-rock').filter({hasText:full})).toHaveCount(1);
 await page.locator('[name=first]').fill('7');await page.getByRole('button',{name:'Prepare flight',exact:true}).click();await expect(page.locator('[data-flight-error]')).toContainText('teacher-approved',{timeout:15000});
});

test('mobile pointer controls move and aim; reduced motion disables decorative effects without hiding Arabic',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
 await open(page);await expect(page.locator('.asteroids')).toHaveClass(/astro-reduced/);
 const button=page.locator('[data-move=left]');await button.scrollIntoViewIfNeeded();const r=await button.boundingBox(),ship=page.locator('.astro-ship'),before=await ship.evaluate(e=>e.style.left);
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+20,y:r.y+20}]});await page.waitForTimeout(250);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(await ship.evaluate(e=>e.style.left)).not.toBe(before);
 const rock=page.locator('.astro-rock').first();await page.locator('.astro-stage').scrollIntoViewIfNeeded();const box=await rock.boundingBox(),angle=await ship.evaluate(e=>e.style.transform);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);expect(await ship.evaluate(e=>e.style.transform)).not.toBe(angle);await expect(page.locator('[data-strikes]')).toContainText('3 / 3');
 expect((await page.locator('.astro-stage').boundingBox()).width).toBeLessThanOrEqual(390);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});

test('Echo waits for verified audio, Listen loops, pause resumes and navigation disposes playback',async({page})=>{
 await page.addInitScript(()=>{window.flightAudio=[];window.flightStops=0;window.Audio=class{constructor(src){this.src=src;window.flightAudio.push(this);}play(){return Promise.resolve();}pause(){window.flightStops++;}removeAttribute(){}load(){}};});
 await open(page,{audio:'echo'});await expect(page.locator('[data-panel]')).toContainText('Listen, then echo');const pos=await page.locator('.astro-ship').evaluate(e=>e.style.top);await page.waitForTimeout(150);expect(await page.locator('.astro-ship').evaluate(e=>e.style.top)).toBe(pos);
 await page.evaluate(()=>window.flightAudio.at(-1).onended());await expect(page.locator('.astro-overlay')).toBeHidden();
 await page.locator('[data-astro-audio]').selectOption('listen');expect(await page.evaluate(()=>window.flightAudio.at(-1).loop)).toBe(true);
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-panel]')).toContainText('Take a breath');await page.locator('[data-action=resume]').click();await expect(page.locator('.astro-overlay')).toBeHidden();
 const stops=await page.evaluate(()=>window.flightStops);await page.locator('[data-game=falling]').click();expect(await page.evaluate(()=>window.flightStops)).toBeGreaterThan(stops);
});

test('wrong captures give three strikes, visible game-over, and an explicit fresh retry',async({page})=>{
 test.setTimeout(60000);await open(page,{difficulty:'standard'});await page.locator('[data-action=assist]').click();
 const canonical=new Set(surahs[0].verses[0].words);
 for(let i=0;i<3;i++){
  const texts=await page.locator('.astro-rock:not(.astro-redirected) .arabic').allTextContents();const wrong=texts.find(t=>!canonical.has(t));expect(wrong).toBeTruthy();await captureWord(page,wrong);
 }
 await expect(page.locator('.asteroids')).toHaveClass(/astro-lost/);await expect(page.locator('[data-panel]')).toContainText('Time for a fresh flight');
 await page.getByRole('button',{name:'Retry flight',exact:true}).click();await expect(page.locator('.astro-overlay')).toBeHidden();await expect(page.locator('[data-strikes]')).toContainText('3 / 3');await expect(page.locator('.astro-sequence')).toContainText('Captured words appear here');
});

test('published source-matched approved study phrases enable Expert without approving stops',async({page})=>{
 await page.route('**/rest/v1/rpc/published_segmentation_review',async route=>{
  const {reference,source_hash}=route.request().postDataJSON();
  const n=surahs[0].verses[6].words.length;
  await route.fulfill({json:{verseKey:reference,sourceHash:source_hash,version:3,segments:[{startWord:1,endWord:4,displayStatus:'approved',stopStatus:'pending_review',recitationStop:false},{startWord:5,endWord:n,displayStatus:'approved',stopStatus:'pending_review',recitationStop:false}]}});
 });
 await open(page,{difficulty:'expert'});await page.locator('[name=first]').fill('7');await page.getByRole('button',{name:'Prepare flight',exact:true}).click();
 await expect(page.locator('[data-flight-error]')).toContainText('Ready.');await expect(page.locator('.astro-stage')).toBeVisible();
 const first=surahs[0].verses[6].words.slice(0,4).join(' '),second=surahs[0].verses[6].words.slice(4).join(' ');
 await expect(page.locator('.astro-rock').filter({hasText:first})).toHaveCount(1);await expect(page.locator('.astro-rock').filter({hasText:second})).toHaveCount(1);
});

test('victory offers the next short flight, configurable ayahs and an actual recall route',async({page})=>{
 test.setTimeout(60000);await open(page);await solve(page,1);
 await expect(page.locator('[data-action=continue]')).toHaveText('Continue to ayah 2');
 await page.locator('[data-action=continue]').focus();await page.keyboard.press('Space');
 await expect(page.locator('[data-sector]')).toContainText('1:2');await expect(page.locator('.astro-overlay')).toBeHidden();await expect(page.locator('[data-astro-audio]')).toHaveValue('silent');
 await solve(page,2);await page.locator('[data-action=customize]').click();await expect(page.locator('[name=first]')).toBeFocused();
 await page.locator('[data-action=recall]').click();await expect(page.locator('.astro-stage')).toHaveCount(0);await expect(page.locator('main')).toContainText('SELF-ASSESSED RECITATION');
});

test('a failed save is visible in the victory panel and retry confirms success without duplicate XP',async({page})=>{
 await open(page);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;window.failLabSave=true;Storage.prototype.setItem=function(key,value){if(key==='ayah-puzzle-lab-v1'&&window.failLabSave)throw Error('Storage full');return set.call(this,key,value);};});
 await solve(page,1);await expect(page.locator('.astro-save-state')).toContainText('not finished saving');await expect(page.locator('[data-action=save]')).toHaveText('Retry saving result');
 const xp=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp);
 await page.locator('[data-action=replay]').click();await expect(page.locator('.astro-victory')).toBeVisible();
 await page.evaluate(()=>window.failLabSave=false);await page.locator('[data-action=save]').click();await expect(page.locator('.astro-save-state')).toContainText('Flight saved');await expect(page.locator('[data-action=save]')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).wallet.xp)).toBe(xp);
 await page.locator('[data-action=replay]').click();await expect(page.locator('.astro-overlay')).toBeHidden();
});
