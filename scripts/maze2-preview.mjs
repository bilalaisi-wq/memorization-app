import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {openMaze,mazeDOM,walkMazePoint} from '../tests/maze-helper.js';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('docs/memory-maze-previews',{recursive:true});
for(const [name,width,height]of [['desktop',1280,1400],['mobile',390,844]]){
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion:'reduce'}),page=await context.newPage();
 await openMaze(page);await page.evaluate(()=>document.documentElement.dataset.theme='night-sky');const s=await mazeDOM(page);await walkMazePoint(page,s.rooms.crystal);await page.locator('[data-maze-action=conceal]').click();await walkMazePoint(page,s.rooms.recognition);await page.locator('[data-maze-action=interact]').click();
 await page.locator('.maze-player').evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}));
 await page.locator('.maze-stage').screenshot({path:`docs/memory-maze-previews/maze2-${name}.png`});
 await page.locator('[data-maze-action=leave-room]').click();await page.locator('.maze-scroll').focus();
 const report=await page.evaluate(()=>{const times=[];for(let i=0;i<100;i++){const start=performance.now();document.querySelector('.maze-scroll').dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp',bubbles:true}));times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {viewport:innerWidth,events:times.length,medianMs:times[50],p95Ms:times[95],maxMs:times[99],tiles:document.querySelectorAll('.maze-tile').length,documentWidth:document.documentElement.scrollWidth};});
 await writeFile(`/workspace/artifacts/maze2-performance-${name}.json`,JSON.stringify(report,null,2));
 console.log(name,JSON.stringify(report));await context.close();
}
await browser.close();
