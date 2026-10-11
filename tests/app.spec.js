import {test,expect} from '@playwright/test';
test('seven ayahs, partial building and word order challenge',async({page})=>{
 await page.goto('/');await expect(page.locator('.ayah-item')).toHaveCount(7);await expect(page.locator('.word-bank .piece')).toHaveCount(4);
 await page.locator('.word-bank [data-word="0"]').click();await page.locator('.word-bank [data-word="1"]').click();await expect(page.locator('.build-zone .piece')).toHaveCount(2);await expect(page.locator('#practice-audio')).toBeEnabled();
 await page.locator('#next').click();await expect(page.locator('.feedback')).toContainText('Build all');
 await page.locator('[data-mode="quiz"]').click();await expect(page.locator('.full-verse')).toContainText('hidden');
 for(const i of [1,0,2,3])await page.locator(`.word-bank [data-word="${i}"]`).click();await page.locator('#next').click();await expect(page.locator('.feedback')).toContainText('out of order');
 await page.locator('#clear').click();for(let i=0;i<4;i++)await page.locator(`.word-bank [data-word="${i}"]`).click();await page.locator('#next').click();await expect(page.locator('.feedback')).toContainText('Beautiful work');await expect(page.locator('.progress-summary')).toContainText('1 / 7');
 await page.reload();await expect(page.locator('.progress-summary')).toContainText('1 / 7');
 await page.locator('[data-ayah="6"]').click();await expect(page.locator('.word-bank .piece')).toHaveCount(9);
});
test('active recall hides words; all seven ayahs render; mobile fits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('[data-mode="recall"]').click();await expect(page.locator('.word-bank .arabic').filter({hasText:'؟'})).toHaveCount(2);await page.locator('#reveal-words').click();await expect(page.locator('.word-bank .arabic').filter({hasText:'؟'})).toHaveCount(0);
 for(let i=0;i<7;i++){await page.locator(`[data-ayah="${i}"]`).click();await expect(page.locator('.reference-top')).toContainText(`AYAH ${i+1}`);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/ayah-mobile.png',fullPage:true});
});
test('audio plays selected words in order for each repetition and handles errors',async({page})=>{
 await page.addInitScript(()=>{window.played=[];window.Audio=class{constructor(url){this.url=url;}play(){window.played.push(this.url);setTimeout(()=>this.onended?.(),15);return Promise.resolve();}pause(){}}});
 await page.goto('/');for(const i of [0,1])await page.locator(`.word-bank [data-word="${i}"]`).click();await page.locator('#practice-audio').click();await expect(page.locator('.feedback')).toContainText('Listening complete');const urls=await page.evaluate(()=>window.played);expect(urls).toHaveLength(6);expect(urls[0]).toContain('001_001_001');expect(urls[1]).toContain('001_001_002');
 await page.locator('#full-audio').click();await expect(page.locator('.feedback')).toContainText('Listening complete');expect(await page.evaluate(()=>window.played.at(-1))).toContain('001001.mp3');
 await page.evaluate(()=>{window.Audio=class{play(){return Promise.reject(new Error('blocked'));}pause(){}}});await page.locator('#full-audio').click();await expect(page.locator('.feedback')).toContainText('Audio could not load');
});
test('desktop font and layout',async({page})=>{await page.setViewportSize({width:1440,height:1100});await page.goto('/');await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.fonts.check('30px Uthmanic'))).toBe(true);await page.screenshot({path:'/tmp/ayah-desktop.png',fullPage:true});});
test('real bundled recordings decode and selected-word playback completes',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{const source=await(await fetch('/quran-source.json')).json();const urls=source.verses.flatMap(v=>['/audio/001'+v.verse_key.split(':')[1].padStart(3,'0')+'.mp3',...v.words.map(w=>'/audio/'+w.audio_url.split('/').at(-1))]);return Promise.all(urls.map(url=>new Promise(resolve=>{const a=new Audio();a.onloadedmetadata=()=>resolve({url,ok:a.duration>0});a.onerror=()=>resolve({url,ok:false});a.src=url;})));});
 expect(result).toHaveLength(36);expect(result.every(r=>r.ok)).toBe(true);
 await page.locator('#repeat').selectOption('1');for(const i of [0,1])await page.locator(`.word-bank [data-word="${i}"]`).click();await page.locator('#practice-audio').click();await expect(page.locator('.feedback')).toContainText('Listening complete',{timeout:20000});
});
