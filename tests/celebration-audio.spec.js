import {enableDeveloperLab} from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { test, expect } from '@playwright/test';

test('success artwork cycles, accepts future manifest images, and respects reduced motion', async ({ page }) => {
  await page.route('**/celebrations.json', route => route.fulfill({json:{schemaVersion:1,images:['/celebrations/one.svg','/celebrations/two.svg','/celebrations/three.svg']}}));
  await page.route('**/celebrations/*.svg', route => route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="gold"/></svg>'}));
  const manifest = page.waitForResponse('**/celebrations.json');
  await page.goto('/');
  await enableDeveloperLab(page);
  await manifest;
  await expect(page.locator("#build-all")).toBeVisible();
  await page.waitForTimeout(50);
  for (const [i, name] of ['one','two','three','one'].entries()) {
    await page.evaluate(async id => (await import('/src/ui/encouragement.js')).successCue(id), `art-${i}`);
    await expect(page.locator('.success-celebration img')).toHaveAttribute('src', `/celebrations/${name}.svg`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(async () => (await import('/src/ui/encouragement.js')).successCue('still-art'));
  await expect(page.locator('.success-celebration')).toHaveClass(/still/);
  expect(await page.locator('.achievement-art').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('Lab automatically pronounces selected choices, replaces audio stop with persistent mute', async ({ page }) => {
  await page.addInitScript(() => {
    window.audioEvents=[];
    window.Audio=class {
      constructor(src){this.src=src;this.muted=false;}
      play(){window.audioEvents.push({src:this.src,muted:this.muted});setTimeout(()=>this.onended?.(),5);return Promise.resolve();}
      pause(){}
    };
  });
  await page.goto('/');
  await enableDeveloperLab(page);
  await (await menu(page)).locator('#nav-lab').click();
  await expect(page.locator('#lab-stop-audio')).toHaveCount(0);
  await expect(page.locator('#fall-pause')).toBeVisible();
  for (const game of ['vanishing','jigsaw','match','chain','continue','detective']) {
    await page.locator(`[data-game="${game}"]`).click();
    if(game === "continue") await page.locator("#continue-compare").click();
    const before = await page.evaluate(()=>window.audioEvents.length);
    await page.locator('.lab-game [data-choice], .lab-game [data-group], .lab-game [data-card], .lab-game [data-chain]').first().click();
    await expect.poll(()=>page.evaluate(()=>window.audioEvents.length)).toBeGreaterThan(before);
  }
  await page.locator('#lab-mute').click();
  await expect(page.locator('#lab-mute')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-game="vanishing"]').click();
  await page.locator('.lab-game [data-choice]').first().click();
  expect(await page.evaluate(()=>window.audioEvents.at(-1).muted)).toBe(true);
  await page.reload();
  await (await menu(page)).locator('#nav-lab').click();
  await expect(page.locator('#lab-mute')).toHaveText('Unmute audio');
});

test('every learning mode offers spoken memorization guidance and mobile text remains readable', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await enableDeveloperLab(page);
  for(const mode of ['practice','quiz','recall','sequence']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    await expect(page.locator('.memory-pro-tip')).toBeVisible();
    expect(await page.locator('.memory-pro-tip p').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('rapid piece choices finish their recordings in order rather than interrupting', async ({page}) => {
  await page.addInitScript(()=>{
    window.playedClips=[];window.finishedClips=[];
    window.Audio=class {
      constructor(src){this.src=src;}
      play(){const src=this.src;window.playedClips.push(src);this.timer=setTimeout(()=>{window.finishedClips.push(src);this.onended?.();},80);return Promise.resolve();}
      pause(){clearTimeout(this.timer);}
    };
  });
  await page.goto('/');
  await enableDeveloperLab(page);
  await (await menu(page)).locator('#nav-lab').click();
  await page.locator('[data-game="jigsaw"]').click();
  await page.evaluate(()=>{
    const ids=[...document.querySelectorAll('[data-group]')].slice(0,2).map(piece=>piece.dataset.group);
    for(const id of ids) document.querySelector(`[data-group="${id}"]`).click();
  });
  await expect.poll(()=>page.evaluate(()=>window.finishedClips.length)).toBeGreaterThanOrEqual(4);
  const clips=await page.evaluate(()=>({played:window.playedClips,finished:window.finishedClips}));
  // The initial Ayah Blocks clip is canceled when changing games; both selected groups finish.
  expect(clips.finished).toEqual(clips.played.slice(-clips.finished.length));
  expect(new Set(clips.finished).size).toBeGreaterThanOrEqual(2);
});
