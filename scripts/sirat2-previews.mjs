import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {openSirat,reachGateway} from '../tests/sirat-helper.js';
import {surahs} from '../src/data.js';
await mkdir('docs/sirat-quest',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,width,height]of [['desktop',1280,1100],['mobile',390,844]]){
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion:'reduce'}),page=await context.newPage();await openSirat(page,{route:name==='mobile'?'garden':'mountain'});await page.evaluate(()=>document.documentElement.dataset.theme='night-sky');await reachGateway(page);await page.locator('[data-sirat-choice]').filter({has:page.getByText(surahs[0].verses[0].words[0],{exact:true})}).click();await page.locator('.sirat-stage').focus();await page.keyboard.down('ArrowRight');await page.clock.runFor(2400);await page.keyboard.up('ArrowRight');await page.locator('.sirat-quest').screenshot({path:`docs/sirat-quest/sirat2-${name}.png`});console.log(name,await page.locator('.sirat-stage').evaluate(e=>({playerX:e.dataset.x,camera:e.dataset.camera,elevatorTop:e.querySelector('[data-platform=memory-elevator]').style.top,noOverflow:document.documentElement.scrollWidth<=innerWidth})));await context.close();
}
await browser.close();
