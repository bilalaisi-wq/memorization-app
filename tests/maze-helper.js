import {expect} from '@playwright/test';
const key=p=>`${p.x}:${p.y}`;
function mazeRoute(layout,start,goal){const q=[{p:start,path:[]}],seen=new Set([key(start)]);for(let i=0;i<q.length;i++){const {p,path}=q[i];if(key(p)===key(goal))return path;for(const [d,[dx,dy]] of Object.entries({up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]})){const n={x:p.x+dx,y:p.y+dy},k=key(n);if(layout.cells[n.y]?.[n.x]&&!seen.has(k)){seen.add(k);q.push({p:n,path:[...path,d]});}}}return null;}
export async function openMaze(page,{end=1,rules='classic',difficulty='beginner',audio='silent'}={}){
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=maze]').click();
 if(end>1){await page.locator('[name=journey]').selectOption('chain');await page.locator('[name=last]').fill(String(end));}
 await page.locator('[name=rules]').selectOption(rules);await page.locator('[name=difficulty]').selectOption(difficulty);await page.getByRole('button',{name:'Prepare maze',exact:true}).click();await expect(page.locator('.maze-grid')).toBeVisible();await page.locator('[data-maze-audio]').selectOption(audio);await page.getByRole('button',{name:'Enter maze',exact:true}).click();
}
export async function mazeDOM(page){return page.evaluate(()=>{
 const g=document.querySelector('.maze-grid'),tiles=[...g.querySelectorAll('.maze-tile')],width=Number(getComputedStyle(g).getPropertyValue('--maze-cols')),height=tiles.length/width,cells=Array.from({length:height},()=>Array(width).fill(0));for(const t of tiles)if(t.classList.contains('maze-floor'))cells[Number(t.dataset.y)][Number(t.dataset.x)]=1;
 return {layout:{width,height,cells},player:{x:Number(g.dataset.playerX),y:Number(g.dataset.playerY)},doors:[...g.querySelectorAll('[data-maze-door]')].map(t=>({x:Number(t.dataset.x),y:Number(t.dataset.y),index:Number(t.dataset.mazeDoor)})),signs:[...document.querySelectorAll('.maze-sign .arabic')].map(e=>e.textContent),sequence:document.querySelector('.maze-sequence').textContent};
});}
export async function walkMaze(page,index){const s=await mazeDOM(page),door=s.doors.find(d=>d.index===index),path=mazeRoute(s.layout,s.player,door);if(!path)throw Error('Door not reachable in visible map');await page.locator('.maze-scroll').focus();await page.evaluate(path=>{for(const direction of path)document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{code:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction],bubbles:true}));},path);return path;}
export async function openMazeChoice(page,text){const s=await mazeDOM(page),index=text===null?0:s.signs.indexOf(text);expect(index).toBeGreaterThanOrEqual(0);await walkMaze(page,index);await page.keyboard.press('Enter');}
