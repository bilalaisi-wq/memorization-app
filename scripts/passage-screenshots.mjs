// Local QA previews use mocked entitlements; they do not unlock hosted content.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { mockBilling, billingUser } from '../tests/billing-fixtures.js';
import {enableDeveloperLab} from '../tests/developer-lab-helper.js';
import { menu } from '../tests/menu-helper.js';
const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/2-282.json', import.meta.url)));
mkdirSync('docs/passage-previews', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const night of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    await mockBilling(page, { plan: 'pathfinder' });
    await page.route('**/functions/v1/quran-content', r => r.fulfill({ json: fixture }));
    if (night) await page.addInitScript(id => localStorage.setItem(`ayah-user:${id}:ayah-appearance-v1`, JSON.stringify({ version: 1, theme: 'night-sky', reduceEffects: true, updatedAt: new Date().toISOString() })), billingUser.id);
    await page.goto(process.env.PASSAGE_PREVIEW_URL || 'http://127.0.0.1:5173/');
    await enableDeveloperLab(page);
    await menu(page);
    await page.getByRole('button', { name: 'Passage memorization', exact: true }).click();
    await page.getByRole('button', { name: 'Start with Al-Fatihah' }).click();
    await page.locator('[data-reference]').selectOption('2:282');
    await page.getByText('128 words', { exact: false }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/passage-previews/${night ? 'night' : 'simple'}-desktop.jpg`, type: 'jpeg', quality: 85 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `docs/passage-previews/${night ? 'night' : 'simple'}-mobile.jpg`, type: 'jpeg', quality: 85 });
    await page.locator('.passage-studio [data-word="1"]').click();
    await page.locator('.passage-studio [data-word="2"]').click();
    await page.locator('[data-place="bank"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/passage-previews/${night ? 'night' : 'simple'}-workspace.jpg`, type: 'jpeg', quality: 85 });
    await page.close();
  }
} finally { await browser.close(); }
