import { test, expect } from '@playwright/test';
import { setDeveloperUser, isDeveloper } from '../src/developer/access.js';

test('developer presentation requires a confirmed, verified owner identity', () => {
  for (const user of [null, {id:'x', email:'bilalaisi@gmail.com'}, {id:'x', email:'other@gmail.com', email_confirmed_at:'2026-10-20'}]) {
    setDeveloperUser(user); expect(isDeveloper()).toBe(false);
  }
  setDeveloperUser({id:'verified-id',email:'BilalAISI@gmail.com',email_confirmed_at:'2026-10-20'});
  expect(isDeveloper()).toBe(true);
  setDeveloperUser(null); expect(isDeveloper()).toBe(false);
});

test('menu collapses, supports Escape and hides editorial diagnostics for guests', async ({page}) => {
  await page.goto('/');
  const toggle = page.getByRole('button', {name:'Menu',exact:true});
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.explore-nav')).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('button', {name:'Mastery Gallery',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.locator('.explore-nav')).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('button',{name:'Developer mode',exact:true})).toHaveCount(0);
  await page.locator('#nav-gallery').click();
  await expect(page.locator('.explore-nav')).toBeHidden();
  await expect(page.locator('.mastery-view')).not.toContainText(/pending|awaiting|source verification|future uploads/i);
  await page.locator('[data-story]').first().click();
  await expect(page.locator('.mastery-dialog')).not.toContainText(/awaiting|source verification/i);
});
