import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
 const page=await browser.newPage({baseURL:'http://127.0.0.1:5190',viewport:{width,height},reducedMotion:'reduce'});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[name=audio]').selectOption('silent');await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.getByRole('button',{name:'Start',exact:true}).click();
 await page.locator('.tower-game').screenshot({path:`docs/arcade-controls-previews/blocks-${name}.png`});
 if(name==='mobile')await page.locator('.lab-settings').screenshot({path:'docs/arcade-controls-previews/volume-mobile.png'});
 await page.close();
}
await browser.close();
