// Real pinned local source bytes; authenticated transport is mocked, not a hosted-access certification.
import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {mockBilling} from './billing-fixtures.js';
import {enableDeveloperLab} from './developer-lab-helper.js';
for(const [key,name] of [['67:1','juz29'],['2:255','baqarah'],['2:282','long-ayah']])test(`pinned ${key} opens authorized common workspace for local visual evidence`,async({page})=>{
 const file=`.quran-private/${key.replace(':','/')}/bundle.json`;test.skip(!existsSync(file),'Exact private pinned asset is unavailable in this checkout');
 const source=JSON.parse(readFileSync(file));const state=await mockBilling(page,{plan:'pathfinder'});state.ent.developer=true;
 await page.route('**/functions/v1/quran-content',r=>{const requested=r.request().postDataJSON().key;return r.fulfill({json:JSON.parse(readFileSync(`.quran-private/${requested.replace(':','/')}/bundle.json`))});});await page.goto('/');await enableDeveloperLab(page);
 await page.locator('.full-library-availability summary').click();await page.locator(`[data-library-open="${key.startsWith('2:')?'2:255':key}"]`).click();
 if(key==='2:282')await page.locator('[data-reference]').selectOption(key);
 await expect(page.locator('.passage-studio')).toContainText(source.words[0].text);
 expect(await page.locator('.passage-studio [data-word]').count()).toBeLessThanOrEqual(12);
 await page.locator('.passage-studio').screenshot({path:`docs/prelaunch/${name}-local-workspace.png`});
});
test('developer entry remains immediately available when hosted lesson service is absent',async({page})=>{const state=await mockBilling(page,{plan:'pathfinder'});state.ent.developer=true;await page.route('**/functions/v1/chronicles-content',r=>r.fulfill({status:404,json:{error:'Requested function was not found'}}));await page.goto('/');await enableDeveloperLab(page);await page.locator('#nav-comprehension-lab').click();await expect(page.locator('[data-chronicles-demo]')).toBeVisible();await page.locator('.chronicles').screenshot({path:'docs/chronicles-explorer/developer-entry.png'});});
