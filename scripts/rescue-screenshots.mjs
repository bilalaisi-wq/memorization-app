// Local QA fixtures use the existing grader under a controlled clock; no demo history ships in src/.
import {chromium} from '@playwright/test';
import {mockBilling} from '../tests/billing-fixtures.js';
import {RESCUE_TIME,seedRescue,openRescue,gradeRescue} from '../tests/rescue-helper.js';
import {mkdirSync} from 'node:fs';
mkdirSync('docs/rescue-previews',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',timezoneId:'America/Chicago'});
  await mockBilling(page,{signed:false});await page.clock.install({time:new Date(RESCUE_TIME)});
  await page.goto(process.env.RESCUE_PREVIEW_URL||'http://127.0.0.1:5194');
  await seedRescue(page,{keys:['1:1','1:2','1:3','1:4','1:5','1:6','1:7','114:1','114:2','114:3','114:4','114:5']});
  await openRescue(page);await page.evaluate(()=>document.fonts.ready);
  if(name==='desktop')await page.screenshot({path:'docs/rescue-previews/desktop-map.png'});
  else await page.locator('.cr-sky-panel').evaluate(el=>{const root=document.querySelector('.constellation-rescue');root.scrollTop+=el.getBoundingClientRect().top-90;});
  if(name==='mobile')await page.screenshot({path:'docs/rescue-previews/mobile-map.png'});
  if(name==='desktop'){
   await page.locator('[data-cr-start]').click();await gradeRescue(page,'Good');await page.screenshot({path:'docs/rescue-previews/desktop-reviewed.png'});
   await page.locator('.cr-route').evaluate(el=>{const root=document.querySelector('.constellation-rescue');root.scrollTop+=el.getBoundingClientRect().top-100;});await page.screenshot({path:'docs/rescue-previews/desktop-route.png'});
  }else{
   await page.locator('.cr-detail').evaluate(el=>{const root=document.querySelector('.constellation-rescue');root.scrollTop+=el.getBoundingClientRect().top-90;});await page.screenshot({path:'docs/rescue-previews/mobile-detail.png'});
  }
  await page.close();
 }
}finally{await browser.close();}
