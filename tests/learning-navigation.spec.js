import {test,expect} from '@playwright/test';
import {LEARNING_KEY} from '../src/learning-store.js';
test('self-assessment retains mode tabs, exits safely and resumes as assisted after study',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Assess this ayah',exact:true}).click();
 await expect(page.locator('.self-assessment')).toBeVisible();
 await expect(page.locator('.reference-card')).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Active recall',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Practice',exact:true}).click();
 await expect(page.locator('.builder')).toBeVisible();await expect(page.locator('.full-verse')).not.toContainText('hidden');
 const pending=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).activeReview,LEARNING_KEY);
 expect(pending.usedHint).toBe(true);expect(pending.graded).toBe(false);
 await page.getByRole('button',{name:'Resume recall',exact:true}).click();
 await expect(page.locator('.assistance-note')).toBeVisible();
 await page.getByRole('tab',{name:'Puzzle quest',exact:true}).click();
 await expect(page.locator('.quest-banner')).toBeVisible();
 await page.reload();await expect(page.locator('.self-assessment')).toBeVisible();
 await page.getByRole('tab',{name:'Ayah chain',exact:true}).click();await expect(page.locator('.sequence-panel')).toBeVisible();
});
test('practice check stays on the ayah and offers continued practice, same-ayah Quest or explicit advance',async({page})=>{
 await page.goto('/');await page.locator('#build-all').click();await page.getByRole('button',{name:'Check ayah',exact:true}).click();
 await expect(page.locator('[data-ayah="0"]')).toHaveClass(/current/);
 await expect(page.getByRole('region',{name:'Choose your next step'})).toBeVisible();
 await page.getByRole('button',{name:'Keep practicing this ayah',exact:true}).click();
 await expect(page.locator('.build-zone .piece')).toHaveCount(4);
 await page.locator('#next').click();await page.getByRole('button',{name:'Try Puzzle Quest for this ayah',exact:true}).click();
 await expect(page.locator('.quest-banner')).toContainText('Ayah 1 quest');
 await page.getByRole('tab',{name:'Practice',exact:true}).click();
 await page.locator('#build-all').click();await page.locator('#next').click();
 await page.getByRole('button',{name:'Next ayah',exact:false}).click();
 await expect(page.locator('[data-ayah="1"]')).toHaveClass(/current/);
});
test('Your Space lab shortcuts stay outside the menu on mobile and desktop',async({page})=>{
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  await expect(page.locator('#nav-learn')).toContainText('Memorization Lab');
  await expect(page.locator('#nav-learn')).toBeVisible();await expect(page.locator('#nav-puzzle-lab')).toBeVisible();
  await page.locator('#nav-puzzle-lab').click();await expect(page.locator('.lab-menu')).toBeVisible();
  await page.locator('#nav-learn').click();await expect(page.getByRole('tab',{name:'Practice',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
