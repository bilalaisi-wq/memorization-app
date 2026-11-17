// Pointer/touch + HTML drag support. Only locally owned sources from the active round commit.
export function bindAnswerDrag(root,{source,target,round,onDrop,onMiss=()=>{}}){
 const abort=new AbortController();let drag=null,suppress=0;
 const listen=(node,type,fn)=>node.addEventListener(type,fn,{signal:abort.signal});
 function clear(){drag?.ghost?.remove();root.querySelectorAll('.answer-drop-over').forEach(n=>n.classList.remove('answer-drop-over'));drag=null;}
 function start(node,x,y,pointer){clear();drag={node,round:round(),x,y,pointer,moved:false,ghost:null};}
 function end(node){const d=drag;if(!d)return;clear();if(d.round!==round()||!d.node.isConnected)return;if(!node||!root.contains(node)){onMiss();return;}onDrop(d.node,node);}
 listen(root,'pointerdown',e=>{const node=e.target.closest(source);if(!node||node.disabled||e.button>0)return;e.preventDefault();node.focus({preventScroll:true});start(node,e.clientX,e.clientY,e.pointerId);});
 listen(window,'pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<10)return;drag.moved=true;if(!drag.ghost){const ghost=drag.node.cloneNode(true);ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;ghost.className='answer-drag-ghost';ghost.style.pointerEvents='none';document.body.append(ghost);drag.ghost=ghost;}drag.ghost.style.left=`${e.clientX}px`;drag.ghost.style.top=`${e.clientY}px`;root.querySelectorAll('.answer-drop-over').forEach(n=>n.classList.remove('answer-drop-over'));document.elementFromPoint(e.clientX,e.clientY)?.closest(target)?.classList.add('answer-drop-over');e.preventDefault();});
 listen(window,'pointerup',e=>{if(!drag||drag.pointer!==e.pointerId)return;if(!drag.moved){clear();return;}suppress=performance.now()+500;end(document.elementFromPoint(e.clientX,e.clientY)?.closest(target));});
 listen(window,'pointercancel',clear);listen(window,'blur',clear);
 root.addEventListener('click',e=>{if(performance.now()<suppress){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal:abort.signal});
 listen(root,'dragstart',e=>{const node=e.target.closest(source);if(!node||node.disabled)return;start(node,0,0,null);drag.moved=true;e.dataTransfer?.setData('text/plain','ayah-local-answer');});
 listen(root,'dragover',e=>{if(drag&&e.target.closest(target))e.preventDefault();});
 listen(root,'drop',e=>{if(!drag)return;e.preventDefault();suppress=performance.now()+500;end(e.target.closest(target));});listen(root,'dragend',clear);
 return ()=>{clear();abort.abort();};
}
