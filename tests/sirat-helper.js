import {platformAt,nearGateway} from '../src/puzzles/arcade/sirat/engine.js';
export function explorerAction(s,{choose=true}={}){
 if(s.awaitingNext)return {type:'next'};
 if(s.quest?.finalActive){const cp=s.session.checkpoint,current=s.sectors[cp].targets,previous=cp?s.sectors[cp-1].targets:[],units=[...(current.length<3?previous.slice(-(3-current.length)):[]),...current].slice(-3);return {type:'link',index:s.quest.finalChoices.indexOf(units[s.quest.finalCursor].id)};}
 if(choose&&nearGateway(s)&&!s.resolved)return {type:'choose',index:s.choices.findIndex(p=>p.id===s.sectors[s.session.checkpoint].targets[s.cursor].id)};
 if(s.player.grounded){const raw=s.platforms.find(p=>p.id===s.player.support);if(raw){const p=platformAt(raw,s.time);if(p.x+p.w-s.player.x-30<25&&!['gateway','memory-bridge','memory-elevator'].includes(raw.id))return {type:'jump'};}}
 return {type:'move',direction:1};
}
export async function openSirat(page,{end=1,rules='classic',difficulty='beginner',audio='silent',route='garden'}={}){
 await page.addInitScript(()=>{window.siratAudio=[];window.Audio=class{constructor(src){this.src=src;window.siratAudio.push(this);}play(){this.playing=true;return Promise.resolve();}pause(){this.playing=false;}load(){}removeAttribute(){} };});
 await page.goto('/');await page.locator('#nav-puzzle-lab').click();await page.locator('[data-game=sirat]').click();if(end>1){await page.locator('[name=journey]').selectOption('chain');await page.locator('[name=last]').fill(String(end));}await page.locator('[name=route]').selectOption(route);await page.locator('[name=rules]').selectOption(rules);await page.locator('[name=difficulty]').selectOption(difficulty);await page.getByRole('button',{name:'Prepare journey',exact:true}).click();await page.clock.install();await page.locator('[data-sirat-audio]').selectOption(audio);await page.getByRole('button',{name:'Start exploring',exact:true}).click();
}
export async function siratDOM(page){return page.locator('.sirat-stage').evaluate(stage=>({status:stage.closest('.sirat-quest').dataset.state,cursor:Number(stage.dataset.cursor),near:stage.dataset.near==='true',x:Number(stage.dataset.x),y:Number(stage.dataset.y),grounded:stage.dataset.grounded==='true',platforms:[...stage.querySelectorAll('[data-platform]')].map(p=>({id:p.dataset.platform,x:parseFloat(p.style.left),y:parseFloat(p.style.top),w:parseFloat(p.style.width)}))}));}
export async function reachGateway(page){
 await page.locator('.sirat-stage').focus();await page.keyboard.down('ArrowRight');let s;
 for(let n=0;n<220;n++){
  s=await siratDOM(page);if(s.near)break;
  // A safe landing stops motion; renew actual keyboard input like a continuing player.
  await page.keyboard.down('ArrowRight');
  if(s.grounded){const p=s.platforms.find(p=>Math.abs(p.y-s.y-46)<1&&s.x+30>p.x&&s.x<p.x+p.w);if(p&&!['gateway','memory-bridge','memory-elevator'].includes(p.id)&&p.x+p.w-s.x-30<25)await page.keyboard.press('Space');}
  await page.clock.runFor(100);
 }
 await page.keyboard.up('ArrowRight');if(!s.near)throw Error('Explorer did not reach the gateway');
}
export async function passGateway(page,expected){await reachGateway(page);await page.locator('[data-sirat-choice]').filter({has:page.getByText(expected,{exact:true})}).click();await page.locator('.sirat-stage').focus();await page.keyboard.down('ArrowRight');await page.clock.runFor(5000);await page.keyboard.up('ArrowRight');await solveSiratFinal(page);}

export async function solveSiratFinal(page){for(let i=0;i<3;i++){const buttons=page.locator('[data-sirat-link]:not([disabled])');if(!await buttons.count())return;const ids=await buttons.evaluateAll(bs=>bs.map(b=>({index:b.dataset.siratLink,id:b.dataset.source})));ids.sort((a,b)=>{const split=id=>id.split(':').map((n,i)=>i===2?Number(n.split('-')[0]):Number(n));const x=split(a.id),y=split(b.id);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];});await page.locator(`[data-sirat-link="${ids[0].index}"]`).click();}}
