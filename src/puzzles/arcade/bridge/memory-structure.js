/** Deterministic arcade load model. No engineering or memorization certification.
 * One supported span per verified adjacent-ayah completion; no Arabic is stored. */
export function makeMemoryStructure(ids,completed=[],reinforced=[]){
 return {version:1,spans:ids.map(id=>({id,deck:completed.includes(id),supports:completed.includes(id)?2:0,truss:completed.includes(id),reinforced:reinforced.includes(id)})),load:'basic',progress:0,status:'idle',repairs:[],attempts:[]};
}
export function inspectMemoryStructure(structure,difficulty='beginner',load=structure.load,progress=structure.progress){
 const weights={beginner:1,standard:1.25,expert:1.5},weight=(weights[difficulty]||1)*(load==='heavy'?1.6:1),n=structure.spans.length;
 const spans=structure.spans.map((span,i)=>{const capacity=span.deck&&span.truss&&span.supports===2?1.6+(span.reinforced?1.2:0):0;const local=Math.max(0,Math.min(1,progress*n-i)),active=progress*n>=i&&progress*n<=i+1,stress=capacity?weight/capacity:Infinity;return {...span,capacity,stress,active,deflection:active&&capacity?Math.sin(Math.PI*local)*weight/capacity*5:0,stable:capacity>=weight};});
 return {spans,weight,stable:n>0&&spans.every(s=>s.stable),strength:n?Math.round(spans.reduce((n,s)=>n+(s.capacity?Math.min(1,s.capacity/weight):0),0)/n*100):0,weak:spans.filter(s=>!s.stable).map(s=>s.id)};
}
export function startMemoryCrossing(structure,difficulty,load='basic'){
 const next=structuredClone(structure);next.load=load;next.progress=0;const result=inspectMemoryStructure(next,difficulty,load,0);next.status=result.stable?'crossing':'repair';next.repairs=result.weak;return next;
}
export function tickMemoryCrossing(structure,difficulty,dt){
 if(structure.status!=='crossing'||!Number.isFinite(dt)||dt<=0||dt>.2)return structure;
 const next=structuredClone(structure),result=inspectMemoryStructure(next,difficulty);if(!result.stable){next.status='repair';next.repairs=result.weak;return next;}
 next.progress=Math.min(1,next.progress+dt/Math.min(12,2+next.spans.length*.6));if(next.progress===1)next.status='passed';return next;
}
export function validateMemoryStructure(value,ids,completed){
 if(!value||value.version!==1||!Array.isArray(value.spans)||value.spans.length!==ids.length||value.spans.some((s,i)=>s.id!==ids[i]||s.deck!==completed.includes(s.id)||s.supports!==(s.deck?2:0)||s.truss!==s.deck||typeof s.reinforced!=='boolean'||s.reinforced&&!s.deck)||!['basic','heavy'].includes(value.load)||!['idle','crossing','passed','repair'].includes(value.status)||!Number.isFinite(value.progress)||value.progress<0||value.progress>1||!Array.isArray(value.attempts)||value.attempts.length>10000||value.attempts.some(a=>!a||!ids.includes(a.id)||typeof a.correct!=='boolean'||a.assisted!==true)||!Array.isArray(value.repairs)||value.repairs.some(id=>!ids.includes(id)))throw Error('Saved structural state needs recovery. Original checkpoint retained.');
 return structuredClone(value);
}
