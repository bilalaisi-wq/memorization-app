import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await page.locator('#nav-revision-lab').click();
  await expect(page.locator('.page-heading h1')).toHaveText('Revision Lab');
  await expect(page.locator('.cosmic-form')).toBeVisible();
}
test('regular navigation supports all mission selections, briefing stages and existing labs', async ({page})=>{
  const premiumRequests=[];
  page.on('request',r=>{if(r.url().includes('/quran-content'))premiumRequests.push(r.url());});
  await open(page);
  expect(await page.locator('.cosmic-form select[name=surah] option').count()).toBe(38);
  await page.locator('[name=surah]').selectOption('78');
  for (const count of [5,10,15,20]) {
    await page.locator('[name=selection]').selectOption(String(count));
    await page.getByRole('button',{name:'View mission briefing →'}).click();
    await expect(page.locator('.cosmic-hero')).toContainText(`${count} ayahs · ${count/5} stage`);
    await expect(page.locator('[data-stage]')).toHaveCount(count/5);
    if(count>5) {
      await page.locator('[data-next]').click();
      await expect(page.locator('#cosmic-stage-title')).toHaveText('Stage 2: Ayahs 6–10');
      await page.locator('[data-previous]').click();
    }
    await expect(page.getByRole('button',{name:'Launch Star Runner',exact:true})).toBeVisible();
    await expect(page.locator('[data-launch-expedition]')).toBeVisible();
    await page.locator('[data-change]').click();
    await page.locator('[name=surah]').selectOption('78');
  }
  await page.locator('[name=selection]').selectOption('custom');
  await page.locator('[name=start]').fill('4');
  await page.locator('[name=end]').fill('14');
  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await expect(page.locator('[data-stage]')).toHaveCount(3);
  await page.locator('[data-stage="2"]').click();
  await expect(page.locator('#cosmic-stage-title')).toHaveText('Stage 3: Ayahs 14–14');
  await page.locator('[data-change]').click();
  await page.locator('[name=surah]').selectOption('108');
  await page.locator('[name=selection]').selectOption('entire');
  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await expect(page.locator('.cosmic-hero')).toContainText('3 ayahs · 1 stage');
  expect(premiumRequests).toEqual([]);
  await page.locator('#nav-puzzle-lab').click();
  await expect(page.locator('.page-heading h1')).toHaveText('Puzzle Lab');
  await expect(page.locator('[data-game=falling]')).toBeVisible();
  await page.locator('#nav-learn').click();
  await expect(page.locator('.builder')).toBeVisible();
});
test('mobile keyboard route planning validates ranges and never grants progress',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page);
  const before = await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|rewards/.test(k))));
  await page.locator('[name=selection]').selectOption('custom');
  await page.locator('[name=start]').fill('5');
  await page.locator('[name=end]').fill('3');
  await page.getByRole('button',{name:'View mission briefing →'}).click();
  await expect(page.locator('[data-error]')).toContainText('Last ayah must be between');
  await page.locator('[name=end]').fill('7');
  await page.getByRole('button',{name:'View mission briefing →'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cosmic-stage-title')).toHaveText('Stage 1: Ayahs 5–7');
  expect(await page.locator('.cosmic-rush').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('#nav-revision-lab')).toBeVisible();
  const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|rewards/.test(k))));
  expect(after).toEqual(before);
  await page.locator('#nav-learn').click();
  await expect(page.locator('.builder')).toBeVisible();
});
