import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5182');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=asteroids]').click();await page.getByRole('button',{name:'Prepare flight',exact:true}).click();await page.locator('[data-astro-audio]').selectOption('silent');await page.getByRole('button',{name:'Start flight',exact:true}).click();await page.waitForTimeout(250);await page.locator('.asteroids').screenshot({path:`docs/asteroids-previews/${name}.png`});await page.close();
}
await browser.close();
