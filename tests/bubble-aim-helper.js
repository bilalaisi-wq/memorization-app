import {traceCascade} from '../src/puzzles/arcade/bubble/cascade.js';
// Read only visible geometry; drive the actual pointer and physics, including
// legitimate neutral-obstacle clearing. Never dispatch a correct answer directly.
export async function aimBubble(page,text){
 const arena=page.locator('.bubble-arena'),before=await arena.getAttribute('data-cursor'),sector=await page.locator('.bubble-hud').textContent(),initialCharges=sector.match(/(\d)\/3 memory charges/)?.[1];
 for(let attempt=0;attempt<5;attempt++){
  await page.locator('.gameplay-viewport').evaluate(n=>n.scrollIntoView({block:'start'}));
  const data=await arena.evaluate(field=>{const r=field.getBoundingClientRect();const circle=el=>{const b=el.getBoundingClientRect();return {x:(b.x+b.width/2-r.x)/r.width*900,y:(b.y+b.height/2-r.y)/r.height*820,radius:b.width/r.width*450,id:el.dataset.bubbleId||'neutral',piece:el.classList.contains('word-bubble')?{text:el.querySelector('.arabic').textContent}:null};};return {bubbles:[...field.querySelectorAll('.word-bubble')].map(circle),obstacles:[...field.querySelectorAll('.bubble-crystal')].map(circle)};});
  let best=null;
  for(let i=0;i<=720;i++){
   const angle=-Math.PI+.12+i*(Math.PI-.24)/720,r=traceCascade(data,angle);if(r.hit?.piece?.text!==text)continue;
   const robust=[-.012,.012].every(delta=>traceCascade(data,angle+delta).hit?.piece?.text===text),distance=r.points.slice(1).reduce((n,p,j)=>n+Math.hypot(p.x-r.points[j].x,p.y-r.points[j].y),0),score=(robust?100:0)+Math.min(r.margin||0,60)-distance/100;
   if(!best||score>best.score)best={angle,distance,score};
  }
  if(!best)throw Error('Visible target has no geometric route: '+text);
  const box=await arena.boundingBox(),x=(450+Math.cos(best.angle)*100)/900*box.width,y=(760+Math.sin(best.angle)*100)/820*box.height;
  await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.up();await page.clock.runFor(Math.max(3000,Math.ceil(best.distance/250*1000)+250));
  if((await page.locator('.bubble-hud').textContent()).match(/(\d)\/3 memory charges/)?.[1]!==initialCharges||await arena.getAttribute('data-cursor')!==before||await page.locator('.ayah-bubble').getAttribute('data-state')==='won'||(await page.locator('.bubble-hud').textContent()).split(' · ')[0]!==sector.split(' · ')[0])return;
 }
 throw Error('Actual projectile did not resolve target after visible-geometry retries: '+text);
}
