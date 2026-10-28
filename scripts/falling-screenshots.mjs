// Run against a local development server on port 5174. No account or remote writes.
import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5174');await page.locator('#nav-puzzle-lab').click();
 await page.locator('[name=mode]').selectOption('chain');await page.locator('[name=last]').fill('3');await page.getByRole('button',{name:'Start journey'}).click();
 for(let n=0;n<30;n++){
  if((await page.locator('.tower-hud').textContent()).includes('Ayah 2'))break;
  const i=Number(await page.locator('.falling-block').getAttribute('data-index'));
  await page.locator(i>=4?'#fall-discard':'#fall-place').click();
 }
 while(Number(await page.locator('.falling-block').getAttribute('data-index'))>=4)await page.locator('#fall-discard').click();
 await page.locator('#fall-rotate').click();
 await page.locator('.lab-game').screenshot({path:'docs/falling-previews/desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.lab-game').screenshot({path:'docs/falling-previews/mobile.png'});
} finally {await browser.close();}
