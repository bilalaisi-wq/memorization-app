import {expect} from '@playwright/test';
import {DIRECTIONS,foodCells} from '../src/puzzles/arcade/snake/engine.js';
const k=p=>`${p.x}:${p.y}`;
export async function openSnake(page,{end=1,rules='classic',audio='silent',clock=true}={}){
 page.on('pageerror',e=>{throw e;});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=snake]').click();
 if(end>1){await page.locator('[name=journey]').selectOption('chain');await page.locator('[name=last]').fill(String(end));}
 await page.locator('[name=rules]').selectOption(rules);await page.getByRole('button',{name:'Prepare trail',exact:true}).click();await expect(page.locator('.snake-board')).toBeVisible();
 await page.locator('[data-snake-audio]').selectOption(audio);
 if(clock){await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));}
 await page.getByRole('button',{name:'Start trail',exact:true}).click();
}
export async function snakeDOM(page){return page.evaluate(()=>({
 body:[...document.querySelectorAll('.snake-segment')].map(e=>({x:Number(e.dataset.snakeX),y:Number(e.dataset.snakeY)})),
 food:[...document.querySelectorAll('[data-snake-food]')].map(e=>({id:e.dataset.snakeFood,x:Number(e.dataset.x),y:Number(e.dataset.y),text:e.textContent})),
 portal:document.querySelector('[data-portal-x]')?{x:Number(document.querySelector('[data-portal-x]').dataset.portalX),y:Number(document.querySelector('[data-portal-y]').dataset.portalY)}:null,
 count:document.querySelectorAll('.snake-sequence>span:not(.snake-empty)').length,
 motor:!!document.querySelector('[data-snake-action=recover]'),sector:document.querySelector('[data-snake-sector]').textContent,
}));}
export function snakeRoute(state,goal,blocked=[]){
 const occupied=new Set([...state.body.slice(1),...blocked].map(k)),queue=[{p:state.body[0],path:[]}],seen=new Set([k(state.body[0])]),targets=new Set(goal.map(k));
 for(let i=0;i<queue.length;i++){
  const {p,path}=queue[i];if(targets.has(k(p)))return path;
  for(const [direction,delta] of Object.entries(DIRECTIONS)){
   const next={x:p.x+delta.x,y:p.y+delta.y},key=k(next);
   if(next.x<0||next.x>=10||next.y<0||next.y>=12||occupied.has(key)||seen.has(key))continue;
   seen.add(key);queue.push({p:next,path:[...path,direction]});
  }
 }return null;
}
export async function snakeMove(page,direction){
 const before=await snakeDOM(page);await page.locator('.snake-board').focus();await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);await page.clock.runFor(1000);
 const after=await snakeDOM(page);if(JSON.stringify(before.body[0])===JSON.stringify(after.body[0])&&!after.motor)await page.clock.runFor(40);
}
export async function snakeCollect(page,text){
 const initial=await snakeDOM(page);
 for(let i=0;i<200;i++){
  let state=await snakeDOM(page);
  if(state.motor){await page.getByRole('button',{name:'Continue on a safe route',exact:true}).click();state=await snakeDOM(page);}
  const food=state.food.find(f=>f.text===text);if(!food)throw Error(`Word not found: ${text}`);
  const path=snakeRoute(state,foodCells(food),state.food.filter(f=>f.id!==food.id).flatMap(foodCells));if(!path?.length)throw Error('No route to desired word');
  await snakeMove(page,path[0]);const next=await snakeDOM(page);
  if(next.count!==initial.count||!next.food.some(f=>f.id===food.id))return;
 }throw Error('Word not reached');
}
export async function snakePortal(page){
 for(let i=0;i<200;i++){
  const state=await snakeDOM(page);if(state.motor){await page.getByRole('button',{name:'Continue on a safe route',exact:true}).click();continue;}
  if(!state.portal)return;
  const path=snakeRoute(state,[state.portal]);if(!path?.length)throw Error('Portal route missing');await snakeMove(page,path[0]);
 }
 throw Error('Portal not reached');
}
