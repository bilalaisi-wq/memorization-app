import {createBoundaryLink,BOUNDARY_MODES} from './link-boundary.js';
import {canonicalLinkAyah,pairReference,openingChoices,verifiedReactorPlan,reactorTiles} from '../../../quest/cosmic/link-content.js';
import {comparableAyah} from '../../../quest/cosmic/gateways.js';
export const LINK_MODES=Object.freeze({...BOUNDARY_MODES,guided:'Guided demonstration',recognition:'Recognition with choices',opening:'Independent opening-word recall',extended:'Extended transition recall'});
export function createAyahLink({refs,allRefs=refs,plans,stageId,seed=1,mode='guided',reducedMotion=false,boundaryContent=null,chainMode='practice',initialStrikes=0,cumulativeAll=false,onEvent=()=>{}}){
  if(BOUNDARY_MODES[mode])return createBoundaryLink({refs,allRefs,content:boundaryContent,stageId,seed,mode,reducedMotion,chainMode,initialStrikes,cumulativeAll,onEvent});
  if(!refs?.length||refs.length>5||!Object.hasOwn(LINK_MODES,mode))throw Error('Choose an available Link mode and ayah set.');
  allRefs.forEach((ref,i)=>pairReference(i?allRefs[i-1]:null,ref));
  const pairRefs=refs.filter(ref=>allRefs.length===1||ref!==allRefs[0]||canonicalLinkAyah(ref).words.length>6);
  const pairs=pairRefs.map((ref,i)=>{const index=allRefs.indexOf(ref);if(index<0||i&&allRefs.indexOf(pairRefs[i-1])+1!==index)throw Error('Invalid Link stage references.');return {...pairReference(index?allRefs[index-1]:null,ref),previous:index?canonicalLinkAyah(allRefs[index-1]):null,target:canonicalLinkAyah(ref),plan:verifiedReactorPlan(ref,plans[ref])};});
  let state,serial=0,choices=[],tiles=[],beforePause=null;
  const current=()=>pairs[state.cursor];
  function emit(type,details={}){const p=current();onEvent({...details,type:`link:${type}`,evidenceId:`${stageId}:${serial++}`,stageId,targetRef:p?.toRef,fromRef:p?.fromRef??null,pairKey:p?.pairKey??null,mode,hintLevel:state.hints,assisted:state.assisted,recognitionOnly:true});}
  let presentation=0;
  function question(){const orderSeed=seed+(presentation++)*104729;state.hints=0;state.assisted=mode==='guided';state.markersVisible=true;state.linked=false;state.revealed=false;state.order=[];state.choice=1;state.shipX=.5;state.travel=0;state.anim=0;state.selfReported=false;state.outcome=null;state.reason='';choices=openingChoices(current().toRef,orderSeed+state.cursor*7919);tiles=reactorTiles(current().plan,seed+state.cursor*157);state.status=mode==='guided'?'demonstration':'recall';}
  function reset(){state={status:'ready',cursor:0,completed:[],mistakes:0,markersVisible:true,linked:false,revealed:false,hints:0,assisted:false,order:[],choice:1,shipX:.5,travel:0,anim:0,selfReported:false,outcome:null,reason:'',checkpointId:null};beforePause=null;}
  reset();
  function mistake(kind,selected=null){state.mistakes++;state.reason='That does not match the verified continuation. Use a hint, compare, and try again. Earlier completed links remain.';emit('mistake',{category:kind,selectedWordId:selected?.id||null,selectedRef:selected?.key||null});state.status='repair';}
  function crossed(evidence){state.outcome=evidence;state.linked=true;state.revealed=true;state.travel=0;state.status='crossing';emit('transition-correct',{category:evidence,scoreReceipt:`link:${current().toRef}`,points:20,independentEligible:['opening','extended'].includes(mode)&&!state.assisted});}
  function afterCrossing(){if(current().target.words.length>6){state.status='reactor';state.order=[];state.reason=current().plan.reason;}else{state.status='success';state.reason='Recite both complete ayahs together, observing appropriate recitation stops.';} }
  function charge(){const expected=current().plan.groups;let n=0;for(const id of state.order){if(tiles[id]?.text!==expected[n]?.text)break;n++;}return n/expected.length;}
  const api={
    start(){if(state.status==='ready')question();return api.getSnapshot();},
    pause(){if(!['ready','paused','checkpoint','disposed'].includes(state.status)){beforePause=state.status;state.status='paused';}return api.getSnapshot();},
    resume(){if(state.status==='paused'){state.status=beforePause;beforePause=null;}return api.getSnapshot();},
    dispatch(a){
      if(state.status==='disposed')return api.getSnapshot();if(a.type==='start')return api.start();if(a.type==='pause')return api.pause();if(a.type==='resume')return api.resume();if(a.type==='restart'){reset();return api.start();}
      if(a.type==='markers'&&state.status!=='ready')state.markersVisible=!state.markersVisible;
      if(a.type==='connect'&&state.status==='demonstration'){state.markersVisible=false;state.linked=true;state.status='linking';state.anim=0;}
      if(a.type==='hide-opening'&&['linking','demonstration'].includes(state.status)){state.markersVisible=false;state.linked=true;state.status='recall';}
      if(a.type==='assistance'&&!['ready','checkpoint','disposed'].includes(state.status)){state.assisted=true;emit('assistance',{category:a.category||'study-audio'});}
      if(a.type==='hint'&&['recall','gateway','repair','comparison'].includes(state.status)&&state.hints<3){state.hints++;state.assisted=true;emit('hint',{category:'transition-hint'});}
      if(a.type==='choices'&&state.status==='recall'&&['guided','recognition'].includes(mode)){state.status='gateway';state.choice=1;state.shipX=.5;}
      if(state.status==='gateway'){
        if(a.type==='lane'&&[-1,1].includes(a.direction))state.choice=Math.max(0,Math.min(2,state.choice+a.direction));
        if(a.type==='select'&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<3)state.choice=a.choice;
        if(reducedMotion)state.shipX=[.2,.5,.8][state.choice];
        if(a.type==='enter'&&Math.abs(state.shipX-[.2,.5,.8][state.choice])<.04){const selected=choices[state.choice];if(comparableAyah(selected.text)===comparableAyah(current().target.words[0].text))crossed('observed-opening-selection');else mistake('opening-word-selection',selected);}
      }
      if(a.type==='submit-text'&&state.status==='recall'&&['opening','extended'].includes(mode)){
        const expected=mode==='extended'?current().target.text:current().target.words[0].text;
        if(typeof a.text==='string'&&comparableAyah(a.text)===comparableAyah(expected))crossed(mode==='extended'?'observed-typed-extended':'observed-typed-opening');else mistake(mode==='extended'?'extended-text-recall':'typed-opening-recall');
      }
      if(a.type==='recited'&&state.status==='recall'&&['opening','extended'].includes(mode)){state.selfReported=true;state.revealed=true;state.status='comparison';emit('comparison',{category:'self-assessed-spoken-attempt'});}
      if(a.type==='assess'&&state.status==='comparison'){if(a.match===true)crossed('self-assessed-spoken');else mistake('self-reported-recall-difficulty');}
      if(a.type==='retry'&&state.status==='repair'){if(state.revealed){state.assisted=true;emit('assistance',{category:'prior-reference-comparison'});}state.status='recall';state.revealed=false;state.reason='Try the opening again. Hints remain available.';}
      if(a.type==='arrange'&&state.status==='reactor'&&Array.isArray(a.order)&&a.order.length<=tiles.length&&new Set(a.order).size===a.order.length&&a.order.every(id=>Number.isInteger(id)&&id>=0&&id<tiles.length))state.order=[...a.order];
      if(a.type==='check-reactor'&&state.status==='reactor'){
        const groups=current().plan.groups,correct=state.order.length===groups.length&&state.order.every((id,i)=>tiles[id].text===groups[i].text);
        if(correct){emit('reactor-correct',{category:'supported-phrase-reconstruction',reviewRevision:current().plan.revision,scoreReceipt:`reactor:${current().toRef}`,points:20});state.status='success';state.reason='Reactor charged. Recite both full ayahs together; this grouping does not prescribe waqf.';}
        else{state.mistakes++;state.reason='Adjust the reactor components; remove extras and preserve the verified phrase order.';emit('reactor-mistake',{category:state.order.some(id=>!tiles[id].target)?'phrase-selection':'phrase-order',selectedIds:state.order.map(id=>tiles[id].id),reviewRevision:current().plan.revision});}
      }
      if(a.type==='continue'&&state.status==='success'){
        state.completed.push(current().toRef);
        if(state.cursor===pairs.length-1){state.status='checkpoint';state.checkpointId=`${stageId}:link:${mode}:clear`;emit('checkpoint',{checkpointId:state.checkpointId,completed:[...state.completed]});}
        else{state.cursor++;question();}
      }
      if(a.type==='tick'&&Number.isFinite(a.dt)&&a.dt>0&&a.dt<=.25){
        if(state.status==='linking'){state.anim+=a.dt;if(state.anim>=1.2||reducedMotion){state.status='recall';}}
        if(state.status==='gateway'){const target=[.2,.5,.8][state.choice],delta=target-state.shipX;state.shipX+=Math.sign(delta)*Math.min(Math.abs(delta),a.dt*1.3);}
        if(state.status==='crossing'){state.travel+=a.dt;if(state.travel>=.7||reducedMotion)afterCrossing();}
      }
      return api.getSnapshot();
    },
    getSnapshot(){const p=current();return structuredClone({...state,link:true,mode,pair:p,pairCount:pairs.length,choices:state.status==='gateway'?choices:[],tiles:state.status==='reactor'?tiles:[],charge:state.status==='reactor'?charge():state.status==='success'?1:0,progress:state.completed.length/pairs.length});},
    dispose(){state.status='disposed';beforePause=null;choices=[];tiles=[];},
  };return api;
}
