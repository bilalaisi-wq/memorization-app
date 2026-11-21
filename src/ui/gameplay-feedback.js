import {experiencePreferences,playSuccessSound} from './encouragement.js';

/** Cosmetic only. Call after a canonical decision has been validated by the engine.
 * Receipts live only for this mounted view; never writes XP, memory or source data. */
export function createGameplayFeedback(root) {
  let streak=0,disposed=false,previous=null;const layer=document.createElement('div');layer.className='gameplay-effects-layer';layer.setAttribute('aria-hidden','true');
  const seen=new Set(),timers=new Set(),decorations=new Set();
  function clear(node) {node.remove();decorations.delete(node);}
  function show(target,{id,complete=false,sound=false}={}) {
    if(disposed||!target||!root.contains(target)||!id||seen.has(id))return;
    seen.add(id);if(seen.size>512)seen.delete(seen.values().next().value);
    if(!complete)streak++;let effects=experiencePreferences().effects;if(effects==='full'&&(root.closest('[data-cosmic-effects=minimal]')||document.documentElement.dataset.celestialMotion==='reduced'))effects='minimal';
    root.dispatchEvent(new CustomEvent('ayah-gameplay-success',{bubbles:true,detail:{id,complete,sequence:streak%3===0}}));
    if(sound)playSuccessSound();
    if(effects==='off')return;
    const a=root.getBoundingClientRect(),b=target.getBoundingClientRect();
    if(!b.width||!b.height)return;
    root.classList.add('gameplay-feedback-host');if(!root.contains(layer))root.append(layer);
    const node=document.createElement('div');node.className=`learning-glow learning-glow-${effects}${complete?' learning-glow-complete':''}`;
    node.setAttribute('aria-hidden','true');node.style.cssText=`left:${b.left-a.left+root.scrollLeft}px;top:${b.top-a.top+root.scrollTop}px;width:${b.width}px;height:${b.height}px`;
    node.innerHTML='<svg width="100%" height="100%"><rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" rx="12" pathLength="100"/></svg>';
    if(effects==='full')node.insertAdjacentHTML('beforeend','<span class="learning-spark">✦</span><span class="learning-spark">✧</span>');
    const point={x:b.left-a.left+b.width/2+root.scrollLeft,y:b.top-a.top+b.height/2+root.scrollTop};
    if(previous&&(streak%3===0||complete)&&effects==='full'){
      const line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.classList.add('learning-connection');line.setAttribute('aria-hidden','true');
      const path=document.createElementNS(line.namespaceURI,'path');path.setAttribute('d',`M${previous.x},${previous.y} Q${point.x},${previous.y} ${point.x},${point.y}`);line.append(path);layer.append(line);decorations.add(line);
      const timer=setTimeout(()=>{clear(line);timers.delete(timer);},650);timers.add(timer);
    }
    previous=point;
    if(complete||streak%3===0){const label=document.createElement('span');label.className='learning-combo';label.textContent=complete?'✦ Sequence connected!':'✦ Great sequence!';node.append(label);}
    layer.append(node);decorations.add(node);
    const timer=setTimeout(()=>{clear(node);timers.delete(timer);},complete?650:420);timers.add(timer);
  }
  return {correct:(target,options)=>show(target,options),complete:(target,options)=>show(target,{...options,complete:true}),mistake(){streak=0;previous=null;},dispose(){disposed=true;timers.forEach(clearTimeout);decorations.forEach(n=>n.remove());timers.clear();decorations.clear();seen.clear();layer.remove();root.classList.remove('gameplay-feedback-host');}};
}
