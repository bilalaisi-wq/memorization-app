import {test, expect} from '@playwright/test';

test('Mastery Gallery replaces Journey and contains accessible blank Poetic Tafsir rewards', async ({page})=>{
  await page.goto('/');
  await expect(page.locator('#nav-journey')).toHaveCount(0);
  await page.locator('#nav-gallery').click();
  await expect(page.locator('.page-heading h1')).toHaveText('My Mastery Gallery');
  await expect(page.locator('#gallery-art-panel')).toBeVisible();
  const poetry=page.getByRole('tab',{name:'Poetic Tafsir',exact:true});
  await poetry.click();
  await expect(poetry).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#gallery-art-panel')).toBeHidden();
  await expect(page.locator('.poetic-tafsir-content')).toHaveCount(13);
  expect(await page.locator('.poetic-tafsir-content').allTextContents()).toEqual(Array(13).fill(''));
  await poetry.press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Artwork',exact:true})).toBeFocused();
  await expect(page.locator('#gallery-poetry-panel')).toBeHidden();
  for(const [id,title] of [[1,'Illuminated Path Through World'],[114,'Golden Sanctuary Against the Shadows'],[113,'Dawn Over the Shadow Valley']]) {
    await expect(page.locator(`[data-gallery-surah="${id}"] .mastery-art-title`)).toHaveText(title);
  }
  await page.locator('[data-artwork="113"]').click();
  await expect(page.locator('[data-gallery-surah]')).toHaveCount(1);
  await expect(page.locator('.page-heading h1')).toHaveText('My Mastery Gallery');
  await page.locator('[data-gallery]').click();
  await expect(page.locator('[data-gallery-surah]')).toHaveCount(13);
});
