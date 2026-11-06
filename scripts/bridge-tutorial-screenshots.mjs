// Local QA fixture only: no production identity, progress or backend writes.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {surahs} from '../src/data.js';
import {enableDeveloperLab} from '../tests/developer-lab-helper.js';
const out=process.argv[2]||'/workspace/artifacts',base=process.env.PROFILE_URL||'http://127.0.0.1:5173';
await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:950},hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage();
 await page.addInitScript(()=>{window.Audio=class{play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};});
 await page.goto(base);await enableDeveloperLab(page);await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=bridge]').click();await expect(page.locator('.bridge-tutorial-dialog')).toBeVisible();
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|recall|bridge-checkpoints/.test(k))));
 const activate=async locator=>mobile?locator.tap():locator.click();
 await activate(page.locator('[data-tutorial-silent]'));await activate(page.locator('[data-tutorial-listen]'));
 await page.screenshot({path:`${out}/bridge-tutorial-${mobile?'mobile':'desktop'}.png`,animations:'disabled'});
 await activate(page.locator('[data-tutorial-try]'));
 for(let ayah=2;ayah<=3;ayah++){
  const opening=surahs.find(s=>s.id===112).verses[ayah-1].words.slice(0,3).join(' ');await activate(page.locator('[data-tutorial-choice]').filter({has:page.getByText(opening,{exact:true})}));
  if(ayah===2){await expect(page.locator('[data-tutorial-second]')).toBeVisible();await activate(page.locator('[data-tutorial-second]'));}
 }
 await expect(page.locator('[data-tutorial-finish]')).toBeVisible();await activate(page.locator('[data-tutorial-finish]'));await expect(page.locator('.bridge-config')).toBeVisible();
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/learning|puzzle-lab|recall|bridge-checkpoints/.test(k))))).toEqual(before);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-bridge-tutorial-v1')).status)).toBe('completed');
 await page.emulateMedia({reducedMotion:'no-preference'});await activate(page.locator('[data-bridge-tutorial]'));await activate(page.locator('[data-tutorial-silent]'));await activate(page.locator('[data-tutorial-listen]'));expect(await page.locator('.bridge-tutorial .bridge-deck').evaluate(e=>getComputedStyle(e).animationName)).toBe('tutorial-build');expect(await page.locator('.bridge-tutorial .bridge-lantern').evaluate(e=>getComputedStyle(e).animationName)).toBe('tutorial-traveler');await activate(page.locator('[data-tutorial-skip]'));
 results.push({viewport:mobile?'390x844':'1280x950',input:mobile?'native touch tap':'pointer',twoTransitions:true,formingBridgeAnimation:true,noRewardsOrMemoryWrites:true});await context.close();
}await writeFile(`${out}/bridge-tutorial-preview.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
