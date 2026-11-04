// Restore only focus owned by a replaced activity subtree; never steal header/nav focus.
export function captureCosmicFocus(root){
 const el=document.activeElement;if(!el||!root.contains(el))return null;
 const data=el.getAttributeNames().find(a=>a.startsWith('data-')&&!['data-zone','data-kind'].includes(a));
 if(data)return {selector:`[${data}="${CSS.escape(el.getAttribute(data))}"]`,value:el.tagName==='INPUT'?el.value:null,start:el.selectionStart,end:el.selectionEnd};
 if(el.matches('.link-gateway-scene'))return {selector:'.link-gateway-scene'};
 if(el.matches('button[type=submit]'))return {selector:'button[type=submit]'};
 return {selector:null};
}
export function restoreCosmicFocus(root,token,{draft=true}={}){
 if(!token)return;let el=token.selector?root.querySelector(token.selector):null;
 if(el&&draft&&token.value!==null&&token.value!==undefined&&el.tagName==='INPUT'){el.value=token.value;try{el.setSelectionRange(token.start,token.end);}catch{}}
 if(!el||el.disabled){el=[...root.querySelectorAll('h4,h3')].at(-1)||root;el.tabIndex=-1;}
 el.focus({preventScroll:true});
}
