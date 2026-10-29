import {chromium} from '@playwright/test';
import {openMaze,openMazeChoice} from '../tests/maze-helper.js';
import {surahs} from '../src/data.js';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
 const page=await browser.newPage({baseURL:'http://127.0.0.1:5192',viewport:{width,height},reducedMotion:'reduce'});
 await openMaze(page);await openMazeChoice(page,surahs[0].verses[0].words[0]);
 if(name==='desktop')await page.evaluate(()=>document.documentElement.dataset.theme='night-sky');
 await page.locator('.memory-maze').screenshot({path:`docs/memory-maze-previews/${name}.png`});await page.close();
}
await browser.close();
