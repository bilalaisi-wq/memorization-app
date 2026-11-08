// Local browser emulation only. No real accounts, payment or lesson approval.
import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {mockBilling} from '../tests/billing-fixtures.js';
const out='docs/release-3.0/screenshots';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const report={environment:'Local Chromium, mocked guest services, reduced motion; no published lesson fixture',cases:[]};
try{
 for(const width of [320,390,1440])for(const theme of ['simple','night-sky']){
  const page=await browser.newPage({viewport:{width,height:width<500?844:1000},hasTouch:width<500,reducedMotion:'reduce'});
  await mockBilling(page,{signed:false});
  await page.route('**/functions/v1/chronicles-content',r=>r.fulfill({json:{lessons:[]}}));
  await page.addInitScript(theme=>{localStorage.setItem('ayah-appearance-v1',JSON.stringify({version:1,theme,reduceEffects:true,updatedAt:"2026-11-07T00:00:00Z"}));window.Audio=class{play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};},theme);
  await page.goto(process.env.RELEASE_AUDIT_URL||'http://127.0.0.1:5173');
  for(const [lab,nav,ready] of [['memorization','#nav-learn','.build-zone'],['puzzle','#nav-puzzle-lab','.puzzle-lab'],['revision','#nav-revision-lab','.cosmic-form'],['comprehension','#nav-comprehension-lab','.chronicles']]){
   const begin=Date.now();await page.locator(nav).click();await expect(page.locator(ready)).toBeVisible();
   const metrics=await page.evaluate(()=>({overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),theme:document.documentElement.dataset.theme,headings:[...document.querySelectorAll('main h1,main h2')].map(n=>n.textContent)}));
   report.cases.push({width,theme,lab,openMs:Date.now()-begin,...metrics});
   expect(metrics.theme).toBe(theme);
   if(theme==='night-sky'&&width!==320)await page.screenshot({path:`${out}/${lab}-${width}.png`,fullPage:true});
  }
  await page.close();
 }
}finally{await browser.close();writeFileSync('docs/release-3.0/ui-metrics.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({cases:report.cases.length,overflow:report.cases.filter(c=>c.overflow>2)}));
