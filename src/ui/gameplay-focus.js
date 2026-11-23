// Focus only on a newly mounted field or explicit start/resume, never every frame.
export function focusGameplay(field,{force=false}={}){
 if(!field?.isConnected)return;
 const active=document.activeElement;
 if(active?.matches('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]')&&!document.querySelector('dialog[open]').contains(field))return;
 if(!force&&field.dataset.gameFocusReady)return;
 field.dataset.gameFocusReady='true';if(!field.hasAttribute('tabindex'))field.tabIndex=0;
 queueMicrotask(()=>{if(field.isConnected&&!document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))field.focus({preventScroll:true});});
}
