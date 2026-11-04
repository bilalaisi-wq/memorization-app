import {test,expect} from '@playwright/test';
import {canonicalLinkAyah} from '../src/quest/cosmic/link-content.js';
test.setTimeout(120000);
async function open(page,mode='guided',start='1',end='2',surah='112'){
  await page.route('**/rest/v1/rpc/published_segmentation_review',r=>r.fulfill({json:null}));
  await page.goto('/');await page.locator('#nav-revision-lab').click();await page.getByRole('button',{name:/Cosmic Rush/}).click();
  await page.locator('[name=surah]').selectOption(surah);await page.locator('[name=selection]').selectOption('custom');await page.locator('[name=start]').fill(start);await page.locator('[name=end]').fill(end);await page.getByRole('button',{name:'View mission briefing →'}).click();
  await page.locator('[data-link-mode]').selectOption(mode);await page.clock.install();await page.locator('[data-launch-link]').click();await expect(page.getByRole('button',{name:'Start Ayah Link',exact:true})).toBeVisible();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));await page.getByRole('button',{name:'Start Ayah Link',exact:true}).click();
}
async function choose(page,wrong=false){
  await page.locator('[data-link-choices]').click();const target=await page.locator('.ayah-link').getAttribute('data-pair'),ref=target.split('>')[1]||target;
  const buttons=page.locator('[data-link-choice]');
  const expected=`${ref}:0`;
  // Compare the button's own ID, not a descendant selector.
  const index=await buttons.evaluateAll((nodes,{expected,wrong})=>nodes.findIndex(n=>wrong?n.dataset.wordId!==expected:n.dataset.wordId===expected),{expected,wrong});
  await buttons.nth(index).click();await page.clock.runFor(400);await page.locator('[data-link-enter]').click();
}
test('real demonstration fades/restores markers, keeps exact Arabic, hides opening and opens a steered gateway',async({page})=>{
  await open(page);await expect(page.locator('.ayah-link')).toHaveAttribute('data-pair','112:1>112:2');
  expect(await page.locator('[data-link-text=previous]').textContent()).toBe(canonicalLinkAyah('112:1').text);expect(await page.locator('[data-link-text=next]').textContent()).toBe(canonicalLinkAyah('112:2').text);
  await page.locator('[data-link-connect]').click();await page.clock.runFor(800);await expect(page.locator('.link-verse-marker').first()).toHaveCSS('opacity','0');
  await page.clock.runFor(600);await expect(page.locator('.link-word-blank')).toBeVisible();await page.locator('[data-link-markers]').click();await page.clock.runFor(800);await expect(page.locator('.link-verse-marker').first()).toHaveCSS('opacity','1');
  await choose(page,true);await expect(page.locator('[data-link-retry]')).toBeVisible();await page.locator('[data-link-hint]').click();await page.locator('[data-link-hint]').click();await page.locator('[data-link-hint]').click();await expect(page.locator('.link-hint')).toContainText(canonicalLinkAyah('112:2').words[0].text);
  await page.locator('[data-link-retry]').click();await choose(page);await page.clock.runFor(900);await expect(page.locator('[data-link-continue]')).toBeVisible();await page.locator('[data-link-continue]').click();await expect(page.locator('.ayah-link')).toHaveAttribute('data-link-state','checkpoint');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-links-v1'))?.events.filter(e=>e.type==='link:hint').length)).toBe(3);
  const events=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-links-v1')).events);expect(events.find(e=>e.type==='link:mistake')).toMatchObject({fromRef:'112:1',toRef:'112:2',category:'opening-word-selection'});
});
test('typed opening and spoken self-comparison are distinct; whole-ayah audio stays sequential and stops on exit',async({page})=>{
  await page.addInitScript(()=>{window.linkAudio=[];window.Audio=class{constructor(src){this.src=src;window.linkAudio.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}load(){}removeAttribute(){}};});
  await open(page,'opening');await expect(page.locator('[data-link-choices]')).toHaveCount(0);await expect(page.locator('.link-word-blank')).toBeVisible();
  await page.locator('[data-link-listen]').click();expect(await page.evaluate(()=>window.linkAudio.find(a=>a.active)?.src)).toBe(canonicalLinkAyah('112:1').audio);await page.evaluate(()=>window.linkAudio.find(a=>a.active)?.onended?.());await expect.poll(()=>page.evaluate(()=>window.linkAudio.find(a=>a.active)?.src)).toBe(canonicalLinkAyah('112:2').audio);
  await page.locator('[data-link-typed]').fill(canonicalLinkAyah('112:2').words[0].text);await page.getByRole('button',{name:'Check typed recall',exact:true}).click();await page.clock.runFor(900);await page.locator('[data-link-continue]').click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-links-v1'))?.events.find(e=>e.type==='link:transition-correct')?.category)).toBe('observed-typed-opening');
  const e=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-cosmic-links-v1')).events.find(e=>e.type==='link:transition-correct'));expect(e.assisted).toBe(true);expect(e.independentEligible).toBe(false);
  await page.locator('[data-link-listen]').click();await page.locator('#nav-learn').click();expect(await page.evaluate(()=>window.linkAudio.some(a=>a.active))).toBe(false);
});
test('extended recall hides the full next ayah and self-assessment is clearly labeled',async({page})=>{
  await open(page,'extended');await expect(page.locator('[data-link-typed]')).toBeVisible();await expect(page.locator('[data-link-text=next]')).not.toContainText(canonicalLinkAyah('112:2').words[0].text);
  await page.locator('[data-link-recited]').click();await expect(page.locator('[data-link-self-match]')).toBeVisible();await expect(page.locator('[data-link-text=next]')).toHaveText(canonicalLinkAyah('112:2').text);await page.locator('[data-link-self-again]').click();await expect(page.locator('[data-link-retry]')).toBeVisible();
});
test('unreviewed long ayah uses whole-ayah reactor fallback and mobile/reduced-motion navigation stays usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page,'opening','6','7','1');
  await page.locator('[data-link-typed]').fill(canonicalLinkAyah('1:7').words[0].text);await page.getByRole('button',{name:'Check typed recall',exact:true}).click();await page.clock.runFor(100);
  await expect(page.locator('.link-reactor')).toContainText('Whole-ayah fallback');expect(await page.locator('.link-reactor-tile').count()).toBe(3);
  const right=page.locator('.link-reactor-tile').filter({hasText:canonicalLinkAyah('1:7').text});await right.click();await page.locator('[data-link-check-reactor]').click();await expect(page.locator('[data-link-continue]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:'/workspace/artifacts/ayah-link-mobile.png',fullPage:true});
  await page.evaluate(async()=>{(await import('/src/learner/profile-storage.js')).selectProfile('other-profile');});await expect(page.locator('.ayah-link')).toHaveCount(0);await expect(page.locator('.cosmic-rush')).toContainText('Account changed');
});

test('published approved visual phrases form a real draggable reactor without approving recitation stops',async({page})=>{
  await page.goto('/');await page.locator('#nav-revision-lab').click();
  await page.evaluate(async()=>{
    const {createMission}=await import('/src/quest/cosmic/mission.js');const {createFlightController}=await import('/src/quest/cosmic/controller.js');const {mountAyahLink}=await import('/src/puzzles/arcade/cosmic/link-ui.js');const {localBundle,sha256}=await import('/src/content/library.js');
    const b=localBundle('1:7'),segments=[];for(let first=1;first<=b.words.length;){const last=Math.min(first+2,b.words.length);segments.push({id:segments.length+1,startWord:first,endWord:last,displayStatus:'approved',stopStatus:'pending_review'});first=last+1;}
    const review={verseKey:'1:7',version:1,sourceHash:await sha256(JSON.stringify({key:b.key,text:b.textUthmani,words:b.words.map(w=>w.text)})),reviewerName:'TEST FIXTURE ONLY',sourceEdition:'TEST',riwayah:'Hafs',reviewedAt:'2026-11-01T00:00:00Z',segments};
    const client={rpc:()=>Promise.resolve({data:review})},mission=await createMission({surahId:1,selection:'custom',start:7,end:7});
    const game=await createFlightController(mission,{activity:'link',linkMode:'opening',pickupMode:'ayahs',reducedMotion:true});await game.prepareLink(client);
    const root=document.createElement('section');root.className='cosmic-rush';document.querySelector('main').append(root);window.fixtureLink=await mountAyahLink(root,mission,{controller:game,client});
  });
  await page.getByRole('button',{name:'Start Ayah Link',exact:true}).click();await page.locator('[data-link-typed]').fill(canonicalLinkAyah('1:7').words[0].text);await page.getByRole('button',{name:'Check typed recall',exact:true}).click();await expect(page.locator('.link-reactor')).toContainText('Published visual review');
  const groups=await page.evaluate(()=>window.fixtureLink.getSnapshot().pair.plan.groups.map(g=>({id:g.id,text:g.text})));
  for(const group of [...groups].reverse())await page.locator('.link-reactor-bank .link-reactor-tile').filter({hasText:group.text}).click();
  await page.locator('[data-link-check-reactor]').click();await expect(page.locator('.link-reactor')).toContainText('Adjust the reactor');
  // Native drag corrects the first position without clearing the reactor.
  const last=page.locator('[data-zone=selected]').filter({hasText:groups[0].text}),first=page.locator('[data-zone=selected]').filter({hasText:groups.at(-1).text});await last.dragTo(first);await expect(page.locator('[data-zone=selected]').first()).toHaveText(groups[0].text);
  // Restore the exact canonical arrangement through the same exposed component controls.
  for(const group of groups){const piece=page.locator('[data-zone=selected]').filter({hasText:group.text});if(await piece.count())await piece.click();}
  for(const group of groups)await page.locator('.link-reactor-bank .link-reactor-tile').filter({hasText:group.text}).click();
  await page.locator('[data-link-check-reactor]').click();await expect(page.locator('[data-link-continue]')).toBeVisible();
  await expect(page.locator('[data-link-text=next]')).toHaveText(canonicalLinkAyah('1:7').text);
  await page.screenshot({path:'/workspace/artifacts/ayah-link-reactor.png',fullPage:true});
});
