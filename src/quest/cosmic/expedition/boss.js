import {sha256} from '../../../../supabase/functions/_shared/content-policy.js';
import {canonicalLinkAyah,openingChoices,verifiedReactorPlan} from '../link-content.js';
import {freeAyah,gatewayCandidates,comparableAyah} from '../gateways.js';
import {seededShuffle} from '../../../puzzles/arcade/content.js';
export async function bossQuestions(mission,stageIndex,plans,weak=[],{extended=false,targetRef=null,repairRef=null}={}){
  const refs=mission.stages[stageIndex]?.refs;if(!refs)throw Error('Unknown boss stage.');
  const known=weak.filter(w=>refs.includes(w.toRef)&&w.selectionMistakes+w.typedMismatches+w.selfReportedDifficulty>=2);
  if(targetRef&&!refs.includes(targetRef))throw Error('Boss target is outside the stage.');
  const target=targetRef||known[0]?.toRef||refs.find(r=>mission.refs.indexOf(r)>0)||refs[0],index=mission.refs.indexOf(target),previous=index?mission.refs[index-1]:null;
  const provenance=known[0]?{label:'Recorded difficulty',reason:known[0].reason,evidenceIds:known[0].evidenceIds}:{label:'Baseline challenge',reason:'Insufficient repeated difficulty evidence. This is relevant passage practice, not a diagnosed weakness.',evidenceIds:[]};
  const seed=parseInt(mission.sourceHash.slice(0,8),16)+stageIndex*173;
  const questions=[];
  if(previous){questions.push({kind:'next',refs:[target],previous,choices:gatewayCandidates(target,seed).map(a=>({id:a.ref,text:a.text,refs:[a.ref]})),answer:target});
    questions.push({kind:'connection',refs:[previous,target],previous,choices:openingChoices(target,seed+7).map(w=>({id:w.id,text:w.text,refs:[w.key]})),answer:`${target}:0`});}
  const verse=canonicalLinkAyah(target);
  // Words are canonical pieces, not recitation segments. Bound the workspace.
  const pieces=verse.words.length<=12?verse.words.map((w,i)=>({id:`word:${target}:${i}`,text:w.text,refs:[target]})):[{id:target,text:verse.text,refs:[target]}];
  questions.push({kind:'missing',refs:[target],previous,choices:seededShuffle(pieces,seed+13),answer:pieces.map(p=>p.id)});
  const reviewed=refs.map(ref=>verifiedReactorPlan(ref,plans[ref])).find(p=>(!repairRef||p.ref===repairRef)&&p.kind==='reviewed-phrases'&&p.groups.length>1&&p.groups.length<=12);
  if(reviewed)questions.push({kind:'repair',refs:[reviewed.ref],previous:null,reviewRevision:await sha256(JSON.stringify([reviewed.revision,reviewed.groups.map(g=>[g.id,g.firstWord,g.lastWord])])),reviewVersion:reviewed.groups[0].reviewVersion,choices:seededShuffle(reviewed.groups.map(g=>({id:g.id,text:g.text,refs:[g.reference]})),seed+29),answer:reviewed.groups.map(g=>g.id)});
  else if(previous)questions.push({kind:'opening',refs:[target],previous,choices:[],answer:verse.words[0].text});
  questions.push({kind:'multi',refs,previous:null,choices:[],answer:null});
  return questions.map(q=>({...q,response:extended&&q.kind==='next'?'typed-ayah':null,id:`${mission.stages[stageIndex].id}:boss:${q.kind}:${q.refs.join('|')}`,...(q.refs.includes(target)?provenance:{label:'Baseline challenge',reason:'Stage coverage challenge.',evidenceIds:[]})}));
}
export function createWeakLinkBoss({questions,cleared=[],onEvent=()=>{},save=()=>{}}){
  if(!questions.length||new Set(questions.map(q=>q.id)).size!==questions.length||cleared.some(id=>!questions.some(q=>q.id===id)))throw Error('Boss questions or saved shields need recovery.');
  let state={status:'ready',cursor:0,hints:0,assisted:false,mistakes:0,order:[],revealed:false,declared:false,cleared:[...cleared],reason:''},before=null;
  const current=()=>questions[state.cursor];
  const emit=(type,extra={})=>{const event={id:crypto.randomUUID(),type,questionId:current().id,kind:current().kind,refs:current().refs,previous:current().previous,evidenceIds:current().evidenceIds||[],challengeLabel:current().label,assisted:state.assisted,hints:state.hints,at:new Date().toISOString(),...extra};save(event);onEvent(event);};
  function next(){state.cursor=questions.findIndex(q=>!state.cleared.includes(q.id));if(state.cursor<0){state.cursor=questions.length-1;state.status='checkpoint';return;}state.status='prompt';state.order=[];state.hints=0;state.assisted=false;state.revealed=false;state.declared=false;state.reason='Take your time. Memory challenges are untimed.';}
  function correct(category){emit('correct',{category});state.cleared.push(current().id);state.status='shield-cleared';state.revealed=true;state.reason='Energy shield restored. Your earlier progress is safe.';}
  function wrong(){emit('mistake',{category:current().kind==='multi'?'self-reported-difficulty':current().kind==='opening'||current().response==='typed-ayah'?'observed-typed-response':'observed-memory-response'});state.mistakes++;state.status='repair';state.reason='Use a hint, compare and retry. No earlier shield is lost.';}
  const api={start(){if(state.status==='ready')next();return api.getSnapshot();},pause(){if(!['ready','paused','checkpoint','disposed'].includes(state.status)){before=state.status;state.status='paused';}return api.getSnapshot();},resume(){if(state.status==='paused')state.status=before;return api.getSnapshot();},dispatch(a){
    if(state.status==='disposed')return api.getSnapshot();if(a.type==='start')return api.start();if(a.type==='pause')return api.pause();if(a.type==='resume')return api.resume();
    const q=current();
    if(a.type==='hint'&&['prompt','choices','repair','comparison'].includes(state.status)&&state.hints<3){emit('hint',{hintLevel:state.hints+1,assisted:true});state.hints++;state.assisted=true;}
    if(a.type==='audio'){state.assisted=true;emit('assistance',{category:'full-ayah-audio'});}
    if(a.type==='ready'&&state.status==='prompt')state.status='choices';
    if(a.type==='retry'&&state.status==='repair'){state.assisted ||= state.revealed;state.status='prompt';state.revealed=false;state.order=[];}
    if(a.type==='choose'&&state.status==='choices'&&['next','connection'].includes(q.kind)&&!q.response&&q.choices.some(c=>c.id===a.id)){if(a.id===q.answer)correct('observed-choice');else wrong();}
    if(a.type==='arrange'&&state.status==='choices'&&Array.isArray(q.answer)&&Array.isArray(a.order)&&new Set(a.order).size===a.order.length&&a.order.every(id=>q.choices.some(c=>c.id===id)))state.order=[...a.order];
    if(a.type==='check'&&state.status==='choices'&&Array.isArray(q.answer)){const texts=ids=>ids.map(id=>q.choices.find(c=>c.id===id)?.text);if(state.order.length===q.answer.length&&JSON.stringify(texts(state.order))===JSON.stringify(texts(q.answer)))correct('supported-reconstruction');else wrong();}
    if(a.type==='text'&&state.status==='choices'&&(q.kind==='opening'||q.response==='typed-ayah')){if(typeof a.text==='string'&&comparableAyah(a.text)===comparableAyah(q.response==='typed-ayah'?freeAyah(q.refs[0]).text:q.answer))correct(q.response?'observed-typed-ayah':'observed-typed-opening');else wrong();}
    if(a.type==='declared'&&state.status==='choices'&&q.kind==='multi'){state.declared=true;state.status='comparison';state.revealed=true;emit('comparison',{category:'self-assessed-spoken'});}
    if(a.type==='assess'&&state.status==='comparison'){if(a.match===true)correct('self-assessed-spoken');else wrong();}
    if(a.type==='continue'&&state.status==='shield-cleared')next();
    return api.getSnapshot();
  },getSnapshot:()=>structuredClone({...state,question:current(),total:questions.length,phase:state.cleared.length===questions.length?'restored':state.cleared.length>=questions.length/2?'inner-core':'outer-shields'}),dispose(){state.status='disposed';}};return api;
}
