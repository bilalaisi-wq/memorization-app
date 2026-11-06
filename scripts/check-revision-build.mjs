import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createStaticServer} from './serve.mjs';
const server=createStaticServer({root:resolve('dist')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,output=process.argv[2]||'/tmp/ayah-revision-build.json';
let browser;
try{
 browser=await chromium.launch({...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1100,height:850}}),failed=[];page.on('pageerror',e=>failed.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&/\.(js|css)(\?|$)/.test(r.url())&&r.status()!==200)failed.push(`${r.status()} ${r.url()}`);});
 await page.route('**/*.supabase.co/**',r=>r.fulfill({json:null}));
 await page.addInitScript(()=>{window.Audio=class{play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}};});
 await page.goto(base);await page.locator('#nav-revision-lab').click();await expect(page.locator('.cosmic-form')).toBeVisible();await page.locator('[name=surah]').selectOption('112');await page.locator('[name=selection]').selectOption('entire');await page.getByRole('button',{name:'View mission briefing →'}).click();await page.locator('[data-flow-guidance]').uncheck();await page.locator('[data-launch-runner]').click();await page.getByRole('button',{name:'Start flight',exact:true}).click();await page.locator('.runner-field').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('.star-runner')).toHaveAttribute('data-lane','0');await page.keyboard.press('Space');await expect(page.locator('.runner-bolt').first()).toBeVisible();await page.locator('#nav-learn').click();await expect(page.locator('.builder')).toBeVisible();await page.locator('#nav-revision-lab').click();await expect(page.locator('.cosmic-form')).toBeVisible();
 const missing=await fetch(base+'/assets/retired-build.js');expect(missing.status).toBe(404);expect((await fetch(base)).headers.get('cache-control')).toContain('no-store');expect(failed).toEqual([]);
 const result={builtAssets:true,directRevisionPlanner:true,lazyRunnerLoaded:true,keyboardSteering:true,blaster:true,exitAndReopen:true,retiredAssets404:true,htmlNoStore:true,pageErrors:failed};await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
