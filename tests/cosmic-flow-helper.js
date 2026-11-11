import {expect} from '@playwright/test';
export async function flyTo(page,stop='checkpoint') {
  for(let i=0;i<1400;i++){
    const state=await page.locator('.star-runner').getAttribute('data-flight-state');
    if(state===stop)return;
    if(state==='paused'){await page.getByRole('button',{name:'Resume flight',exact:true}).click();continue;}
    if(state==='recovery'){await page.getByRole('button',{name:'Retry · keep collected pieces',exact:true}).click();continue;}
    if(state==='gateway'){
      const ref=await page.locator('.cosmic-memory-gateway').getAttribute('data-target-ref');
      await page.locator('[data-gateway-ready]').click();await page.locator(`[data-ayah-ref="${ref}"]`).click();await page.locator('[data-gateway-choose]').click();await page.locator('[data-gateway-continue]').click();continue;
    }
    if(state!=='running')throw Error(`Unexpected flight state ${state}`);
    const lane=await page.locator('.star-runner').evaluate(view=>{
      const expected=view.dataset.expectedUnit;
      const rock=[...view.querySelectorAll('.runner-asteroid')].find(n=>parseFloat(n.style.top)>55&&parseFloat(n.style.top)<94);
      if(rock){const danger=Math.round((parseFloat(rock.style.left)-20)/30);return (danger+1)%3;}
      const target=[...view.querySelectorAll('.runner-pickup')].find(n=>n.dataset.unitId===expected);
      return target?Number(target.dataset.pickupLane):null;
    });
    if(lane!==null){
      for(let j=0;j<2;j++){const current=Number(await page.locator('.star-runner').getAttribute('data-lane'));if(current===lane)break;await page.locator('.runner-field').focus();await page.keyboard.press(current>lane?'ArrowLeft':'ArrowRight');}

    }
    await page.clock.runFor(500);
  }
  await expect(page.locator('.star-runner')).toHaveAttribute('data-flight-state',stop);
}

export async function flyStageRounds(page){
  for(let i=0;i<10;i++){
    await flyTo(page);
    const next=page.getByRole('button',{name:/^Replay this set · optional round/});
    if(!await next.count())return;
    await next.click();
  }
  throw Error('Round limit exceeded');
}
