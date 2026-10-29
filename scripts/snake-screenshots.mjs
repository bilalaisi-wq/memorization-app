import {chromium} from '@playwright/test';
import {snakeCollect} from '../tests/snake-helper.js';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
 const page=await browser.newPage({baseURL:'http://127.0.0.1:5183',viewport:{width,height},reducedMotion:'reduce'});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=snake]').click();await page.getByRole('button',{name:'Prepare trail',exact:true}).click();await page.locator('[data-snake-audio]').selectOption('silent');await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.getByRole('button',{name:'Start trail',exact:true}).click();
 const word=await page.evaluate(async()=>(await import('/src/data.js')).surahs[0].verses[0].words[0]);await snakeCollect(page,word);
 await page.locator('.ayah-snake').screenshot({path:`docs/snake-previews/${name}.png`});await page.close();
}
await browser.close();
