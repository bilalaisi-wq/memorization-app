import {endpointLengths} from '../../../quest/cosmic/boundary-content.js';
import {makeMemoryStructure,startMemoryCrossing,tickMemoryCrossing} from './memory-structure.js';
import {memoryLevel} from '../difficulty.js';
import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {wordIdentity} from '../../../distractors.js';
export const bridgeProfiles=Object.freeze({beginner:{ending:1,opening:1,moving:false},standard:{ending:3,opening:3,moving:true},expert:{ending:3,opening:3,moving:true}});
const identity=words=>words.map(w=>wordIdentity(w.text)).join(' ');
export const transitionId=(from,to)=>`${from}>${to}`;
export function buildCrossings(adapter,config,library,{difficulty='beginner'}={}){
 difficulty=memoryLevel(config,difficulty);
 const profile=bridgeProfiles[difficulty];if(!profile||config.keys.length<2)throw Error('Choose at least two consecutive ayahs for an ayah-to-ayah bridge.');
 const all=library.flatMap(s=>s.verses.map(v=>`${s.id}:${v.id}`));
 return config.keys.slice(1).map((to,i)=>{
  const from=config.keys[i],[s,a]=from.split(':').map(Number),[t,b]=to.split(':').map(Number);
  if(s!==t||b!==a+1)throw Error('Bridge transitions require adjacent ayahs in canonical order.');
  const lengths=config.bridgeEndpoints==='both'?endpointLengths(config.seed,i):{ending:profile.ending,opening:profile.opening};const previous=adapter.words(from),next=adapter.words(to),opening=next.slice(0,lengths.opening),seen=new Set([identity(opening)]),alternatives=[];
  const pool=seededShuffle(all,config.seed+i);
  if(difficulty==='expert'){const expected=new Set(opening.map(w=>wordIdentity(w.text))),score=key=>adapter.words(key).slice(0,lengths.opening).reduce((n,w)=>n+(expected.has(wordIdentity(w.text))?1:0),0);pool.sort((a,b)=>score(b)-score(a));}
  for(const key of pool){
   if(key===to)continue;const words=adapter.words(key).slice(0,lengths.opening),value=identity(words);
   // Identical displayed openings can never be a wrong answer; exclude them.
   if(!value||seen.has(value))continue;seen.add(value);alternatives.push({id:key,key,words});if(alternatives.length===2)break;
  }
  if(alternatives.length!==2)throw Error('Insufficient distinguishable verified openings. Choose another authorized passage.');
  const ending=previous.slice(-lengths.ending),endingSeen=new Set([identity(ending)]),endingAlternatives=[];for(const key of seededShuffle(all,config.seed+i+7919)){const words=adapter.words(key).slice(-lengths.ending),value=identity(words);if(!value||endingSeen.has(value))continue;endingSeen.add(value);endingAlternatives.push({id:key,key,words});if(endingAlternatives.length===2)break;}if(endingAlternatives.length!==2)throw Error('Insufficient distinct source endings.');
  return {endingChoices:seededShuffle([{id:from,key:from,words:ending},...endingAlternatives],config.seed+i+97),id:transitionId(from,to),key:to,from,to,previous,next,ending,opening,audio:adapter.audio(from),nextAudio:adapter.audio(to),choices:seededShuffle([{id:to,key:to,words:opening},...alternatives],config.seed+i+17)};
 });
}
export function bridgeRevision(sectors){let n=2166136261;for(const c of sectors.map(t=>[t.id,...t.previous.map(w=>w.text),...t.next.map(w=>w.text)].join('|')).join('\n'))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
export function createBridge({id,config,sectors,difficulty='beginner'}){
 difficulty=memoryLevel(config,difficulty);
 if(!bridgeProfiles[difficulty]||sectors.length!==config.keys.length-1||sectors.some((s,i)=>s.from!==config.keys[i]||s.to!==config.keys[i+1]||s.choices.length!==3||s.choices.filter(c=>c.key===s.to).length!==1||new Set(s.choices.map(c=>identity(c.words))).size!==3))throw Error('Invalid verified transition content');
 const session=createSession({id,game:'bridge',config:{...config,sourceKeys:[...config.keys],keys:config.keys.slice(1)}});
 return {endpointSide:config.bridgeEndpoints==='both'?'ending':'opening',endingSelected:null,pressure:'relaxed',spanTime:0,timerExpired:false,version:2,structure:makeMemoryStructure(sectors.map(t=>t.id)),session,sourceConfig:structuredClone(config),sectors,difficulty,revision:bridgeRevision(sectors),phase:difficulty==='expert'?'recall':'choose',crossing:0,bridges:[],transitionErrors:[],score:0,clock:0,selection:0,gate:null,gatesCleared:[],message:'Recall the opening of the next ayah. Connect the right island to the left island.'};
}
const reduce=(s,type,extra={})=>{const cp=s.session.checkpoint;if(s.gate&&['mistake','assist','motor-error'].includes(type))s.session.checkpoint=s.gate.start+s.gate.cursor;s.session=reduceSession(s.session,{type,...extra});if(s.gate&&['mistake','assist','motor-error'].includes(type))s.session.checkpoint=cp;};
export const bridgeTransition=s=>s.sectors[s.gate?s.gate.start+s.gate.cursor:s.session.checkpoint];
export function stepBridge(previous,action){
 if(previous.session.status==='disposed')return previous;
 const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors},t=bridgeTransition(s);
 if(action.type==='load-test'&&s.session.status==='won'){s.structurePaused=false;s.structure=startMemoryCrossing(s.structure,s.difficulty,action.load==='heavy'?'heavy':'basic');s.message=s.structure.status==='repair'?'Revisit the highlighted connection to add a brace. Your completed bridges remain safe.':'Watch the load travel across every connected span.';return s;}
 if(action.type==='reinforce'&&s.session.status==='won'&&s.structure.status!=='crossing'){
  const span=s.structure.spans.find(p=>p.id===action.id&&p.deck);if(!span)return previous;
  s.reinforcement={id:span.id,selection:0};s.rehearsalStrikes=s.rehearsalStrikes??0;if(s.rehearsalStrikes>=3)return previous;s.message='Recall this connection again to add a brace. This is supported recognition, not independent recall.';return s;
 }
 if(action.type==='reinforce-retry'&&s.session.status==='won'){s.rehearsalStrikes=0;s.reinforcement=null;return s;}
 if(action.type==='reinforce-select'&&s.reinforcement&&s.session.status==='won'&&(s.rehearsalStrikes??0)<3){
  const pair=s.sectors.find(t=>t.id===s.reinforcement.id),choice=pair.choices[action.index];if(!choice)return previous;
  const correct=choice.key===pair.to;s.structure.attempts.push({id:pair.id,correct,assisted:true});if(s.structure.attempts.length>10000)s.structure.attempts.shift();
  if(correct){s.structure.spans.find(p=>p.id===pair.id).reinforced=true;s.reinforcement=null;if(s.sourceConfig.chainMode==='practice')s.rehearsalStrikes=0;s.message='Brace added! Try the heavier crossing. No extra XP or recall grade.';}
  else{s.rehearsalStrikes=(s.rehearsalStrikes??0)+1;s.transitionErrors.push({transitionId:pair.id,from:pair.from,to:pair.to,selected:choice.key,event:s.session.events});s.message=s.rehearsalStrikes===3?'Three rehearsal strikes. Restart reinforcement when ready; your finished route stays safe.':'That opening belongs elsewhere. One rehearsal memory strike; your finished route stays safe.';}
  return s;
 }
 if(action.type==='pause'&&s.session.status==='won'){s.structurePaused=true;return s;}
 if(action.type==='resume'&&s.session.status==='won'){s.structurePaused=false;return s;}
 if(action.type==='tick'&&s.session.status==='won'){if(s.structurePaused)return previous;s.structure=tickMemoryCrossing(s.structure,s.difficulty,action.dt);return s;}
 if(action.type==='pressure'&&['relaxed','adventure','challenge'].includes(action.value)){s.pressure=action.value;s.spanTime=0;s.timerExpired=false;return s;}
 if(action.type==='dispose'){reduce(s,'dispose');return s;}
 if(action.type==='start'&&s.session.status==='ready'){reduce(s,'start');return s;}
 if(action.type==='pause'){reduce(s,'pause');return s;}
 if(action.type==='resume'){reduce(s,'resume');return s;}
 if(action.type==='retry'&&s.session.status==='lost'){s.endingSelected=null;s.endpointSide=s.sourceConfig.bridgeEndpoints==='both'?'ending':'opening';s.spanTime=0;s.timerExpired=false;reduce(s,'retry');if(s.sourceConfig.chainMode==='classic'){s.bridges=[];s.structure=makeMemoryStructure(s.sectors.map(t=>t.id));s.score=0;s.gate=null;s.gatesCleared=[];}s.phase=s.gate?'gate-recall':s.difficulty==='expert'?'recall':'choose';s.crossing=0;return s;}
 if(action.type==='assist'&&['ready','playing','paused'].includes(s.session.status)){const status=s.session.status;s.session.status='playing';reduce(s,'assist',{kind:action.kind});s.session.status=status;return s;}
 if(s.session.status!=='playing')return previous;
 if(action.type==='motor-error'){reduce(s,'motor-error');s.message='Connector returned safely. Tap it or try again; no memory strike.';return s;}
 if(action.type==='ready'&&['recall','gate-recall'].includes(s.phase)){s.phase=s.gate?'gate-choose':'choose';s.message='Choose the opening you recalled. This is recognition, not a verified oral assessment.';return s;}
 if(action.type==='next'&&s.phase==='checkpoint'){s.phase=s.difficulty==='expert'?'recall':'choose';s.crossing=0;s.selection=0;s.endingSelected=null;s.endpointSide=s.sourceConfig.bridgeEndpoints==='both'?'ending':'opening';s.spanTime=0;s.timerExpired=false;s.message='Recite the ending, then recall the next opening.';return s;}
 if(action.type==='steer'&&['choose','gate-choose'].includes(s.phase)){s.selection=(s.selection+(action.direction<0?-1:1)+3)%3;return s;}
 if(action.type==='tick'){
  if(!Number.isFinite(action.dt)||action.dt<=0||action.dt>.2)return previous;
  s.clock+=action.dt;if(['choose','gate-choose'].includes(s.phase)&&s.pressure!=='relaxed'&&!s.timerExpired){s.spanTime+=action.dt;if(s.spanTime>(s.pressure==='challenge'?18:35)){s.timerExpired=true;reduce(s,'motor-error');s.message='The optional speed window ended. The traveler waits safely; no memory strike.';}}
  if(['crossing','gate-crossing'].includes(s.phase)){s.crossing=Math.min(1,s.crossing+action.dt/2);if(s.crossing===1){
   if(s.gate){if(s.gate.cursor===0){s.gate.cursor=1;s.endingSelected=null;s.endpointSide=s.sourceConfig.bridgeEndpoints==='both'?'ending':'opening';s.phase='gate-recall';s.crossing=0;if(s.sourceConfig.chainMode==='practice')s.session.strikes=0;s.message='First Gate link recalled. Now try the next boundary.';}else{for(const pair of s.sectors.slice(s.gate.start,s.gate.start+2))s.structure.spans.find(p=>p.id===pair.id).reinforced=true;s.gatesCleared.push(s.gate.id);s.gate=null;s.phase='checkpoint';s.message='Bridge Gate cleared. Two connections reviewed; no extra completion or recall grade awarded.';}}
   else{s.bridges.push(t.id);const span=s.structure.spans.find(p=>p.id===t.id);Object.assign(span,{deck:true,supports:2,truss:true});s.score+=100;reduce(s,'checkpoint');s.phase=s.session.status==='won'?'complete':'checkpoint';if(s.session.status==='won')s.structure=startMemoryCrossing(s.structure,s.difficulty);s.message='Connection complete! Recite both ayahs together. Game success does not certify memorization.';
    if(s.sourceConfig.bridgeGate&&s.session.status!=='won'&&s.bridges.length%3===0){s.gate={id:`gate:${s.bridges.length}`,start:s.bridges.length-2,cursor:0};s.endingSelected=null;s.endpointSide=s.sourceConfig.bridgeEndpoints==='both'?'ending':'opening';s.phase='gate-recall';s.crossing=0;s.message='Bridge Gate: say two consecutive openings from memory before revealing their connectors.';}
   }
  }}
  return s;
 }
 if(action.type==='select'&&['choose','gate-choose'].includes(s.phase)){
  const endingTurn=s.sourceConfig.bridgeEndpoints==='both'&&s.endpointSide==='ending';const list=endingTurn?t.endingChoices:t.choices;const index=action.index??s.selection,choice=list[index];if(!Number.isInteger(index)||!choice)return previous;
  if(choice.key!==(endingTurn?t.from:t.to)){const evidence={category:'phrase-transition',side:endingTurn?'ending':'opening',expected:(endingTurn?t.ending:t.opening).map(w=>w.id),selected:choice.words.map(w=>w.id)};reduce(s,'mistake',evidence);s.transitionErrors.push({transitionId:t.id,from:t.from,to:t.to,selected:choice.key,event:s.session.events});s.message='That opening belongs elsewhere. Listen, recall and try again. Completed bridges stay safe.';return s;}
  if(endingTurn){s.endingSelected=choice.id;s.endpointSide='opening';s.selection=0;s.message='Ending restored. Now recall the next opening to construct this span.';return s;}if(s.pressure!=='relaxed'&&!s.timerExpired)s.score+=20;
  s.phase=s.gate?'gate-crossing':'crossing';s.crossing=0;s.message='The bridge connects! Follow the lantern from right to left.';return s;
 }
 return previous;
}
