// Local QA snapshots use guest earnings; they do not claim hosted database activation.
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {mockBilling} from '../tests/billing-fixtures.js';
import {menu} from '../tests/menu-helper.js';
mkdirSync('docs/shop-previews',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const night of [false,true]){
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  await mockBilling(page,{signed:false});
  await page.addInitScript(night=>{localStorage.setItem('ayah-quiz',JSON.stringify({xp:250,stars:10,streak:0}));if(night)localStorage.setItem('ayah-appearance-v1',JSON.stringify({version:1,theme:'night-sky',reduceEffects:true,updatedAt:new Date().toISOString()}));},night);
  await page.goto('http://127.0.0.1:5174/');await menu(page);
  await page.getByRole('button',{name:'My companion & shop',exact:true}).click();
  await page.locator('[data-shop-item="fox"]').click();
  await page.locator('[data-shop-item="scarf-lilac"]').click();
  await page.evaluate(()=>document.fonts.ready);
  await page.locator(".shop-heading").scrollIntoViewIfNeeded();
  await page.screenshot({path:`docs/shop-previews/${night?'night':'simple'}-desktop.jpg`,type:'jpeg',quality:85});
  await page.locator('[data-filter="creature"]').click();await page.locator('.shop-items').scrollIntoViewIfNeeded();
  await page.screenshot({path:`docs/shop-previews/${night?'night':'simple'}-collection.jpg`,type:'jpeg',quality:85});
  await page.setViewportSize({width:390,height:844});await page.locator('.shop-heading').scrollIntoViewIfNeeded();
  await page.screenshot({path:`docs/shop-previews/${night?'night':'simple'}-mobile.jpg`,type:'jpeg',quality:85});
  await page.close();
 }
}finally{await browser.close();}
