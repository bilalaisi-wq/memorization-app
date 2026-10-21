// Design previews use mocked aliases/totals; no live learner data is requested.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.argv[2] || 'http://127.0.0.1:5174';
const out='docs/leaderboard-previews';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 for(const theme of ['simple','night-sky']) {
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.route('https://ycgyuatjgdbhiakqourg.supabase.co/**',route=>{
    if(route.request().url().includes('/rpc/get_weekly_leaderboard')) return route.fulfill({json:['Cedar42','OliveMoon','QuietRiver','Juniper7','DawnLight','AmberLeaf','WillowPath','MapleStar','SilverSky','PalmGarden'].map((alias,i)=>({alias,xp:1420-i*95,stars:32-i,recalls:24-i}))});
    return route.fulfill({status:503,json:{message:'Preview: service not used'}});
  });
  await page.addInitScript(theme=>{
    localStorage.setItem('ayah-appearance-v1',JSON.stringify({version:1,theme,reduceEffects:true,updatedAt:new Date().toISOString()}));
  },theme);
  await page.goto(base);
  await page.locator('#site-menu-toggle').click();
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await page.locator('.ranking-runners').waitFor();
  await page.locator('.leaderboard-dialog').screenshot({path:`${out}/${theme}-desktop.jpg`,type:'jpeg',quality:88});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.leaderboard-dialog').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:`${out}/${theme}-mobile.jpg`,type:'jpeg',quality:88});
  await context.close();
 }
 await writeFile(`${out}/README.md`,'# Leaderboard design previews\n\nThese screenshots use mocked aliases and totals for visual QA. They are not real learners or live rankings. Production never seeds these entries.\n\n- [Simple desktop](simple-desktop.jpg)\n- [Night Sky desktop](night-sky-desktop.jpg)\n- [Simple mobile](simple-mobile.jpg)\n- [Night Sky mobile](night-sky-mobile.jpg)\n\nRegenerate with a running development server and `node scripts/leaderboard-screenshots.mjs` (optional internal server address argument).\n');
} finally {await browser.close();}
