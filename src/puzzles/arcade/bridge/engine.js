import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {wordIdentity} from '../../../distractors.js';
export const bridgeProfiles=Object.freeze({beginner:{ending:1,opening:1,moving:false},standard:{ending:3,opening:3,moving:true},expert:{ending:3,opening:3,moving:true}});
const identity=words=>words.map(w=>wordIdentity(w.text)).join(' ');
export const transitionId=(from,to)=>`${from}>${to}`;
export function buildCrossings(adapter,config,library,{difficulty='beginner'}={}){
 const profile=bridgeProfiles[difficulty];if(!profile||config.keys.length<2)throw Error('Choose at least two consecutive ayahs for an ayah-to-ayah bridge.');
 const all=library.flatMap(s=>s.verses.map(v=>`${s.id}:${v.id}`));
 return config.keys.slice(1).map((to,i)=>{
  const from=config.keys[i],[s,a]=from.split(':').map(Number),[t,b]=to.split(':').map(Number);
  if(s!==t||b!==a+1)throw Error('Bridge transitions require adjacent ayahs in canonical order.');
  const previous=adapter.words(from),next=adapter.words(to),opening=next.slice(0,profile.opening),seen=new Set([identity(opening)]),alternatives=[];
  const pool=seededShuffle(all,config.seed+i);
  if(difficulty==='expert'){const expected=new Set(opening.map(w=>wordIdentity(w.text))),score=key=>adapter.words(key).slice(0,profile.opening).reduce((n,w)=>n+(expected.has(wordIdentity(w.text))?1:0),0);pool.sort((a,b)=>score(b)-score(a));}
  for(const key of pool){
   if(key===to)continue;const words=adapter.words(key).slice(0,profile.opening),value=identity(words);
   // Identical displayed openings can never be a wrong answer; exclude them.
   if(!value||seen.has(value))continue;seen.add(value);alternatives.push({id:key,key,words});if(alternatives.length===2)break;
  }
  if(alternatives.length!==2)throw Error('Insufficient distinguishable verified openings. Choose another authorized passage.');
  return {id:transitionId(from,to),key:to,from,to,previous,next,ending:previous.slice(-profile.ending),opening,audio:adapter.audio(from),nextAudio:adapter.audio(to),choices:seededShuffle([{id:to,key:to,words:opening},...alternatives],config.seed+i+17)};
 });
}
export function bridgeRevision(sectors){let n=2166136261;for(const c of sectors.map(t=>[t.id,...t.previous.map(w=>w.text),...t.next.map(w=>w.text)].join('|')).join('\n'))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
export function createBridge({id,config,sectors,difficulty='beginner'}){
 if(!bridgeProfiles[difficulty]||sectors.length!==config.keys.length-1||sectors.some((s,i)=>s.from!==config.keys[i]||s.to!==config.keys[i+1]||s.choices.length!==3||s.choices.filter(c=>c.key===s.to).length!==1||new Set(s.choices.map(c=>identity(c.words))).size!==3))throw Error('Invalid verified transition content');
 const session=createSession({id,game:'bridge',config:{...config,sourceKeys:[...config.keys],keys:config.keys.slice(1)}});
 return {version:2,session,sourceConfig:structuredClone(config),sectors,difficulty,revision:bridgeRevision(sectors),phase:difficulty==='expert'?'recall':'choose',crossing:0,bridges:[],transitionErrors:[],score:0,clock:0,selection:0,gate:null,gatesCleared:[],message:'Recall the opening of the next ayah. Connect the right island to the left island.'};
}
const reduce=(s,type,extra={})=>{const cp=s.session.checkpoint;if(s.gate&&['mistake','assist','motor-error'].includes(type))s.session.checkpoint=s.gate.start+s.gate.cursor;s.session=reduceSession(s.session,{type,...extra});if(s.gate&&['mistake','assist','motor-error'].includes(type))s.session.checkpoint=cp;};
export const bridgeTransition=s=>s.sectors[s.gate?s.gate.start+s.gate.cursor:s.session.checkpoint];
export function stepBridge(previous,action){
 if(previous.session.status==='disposed')return previous;
 const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors},t=bridgeTransition(s);
 if(action.type==='dispose'){reduce(s,'dispose');return s;}
 if(action.type==='start'&&s.session.status==='ready'){reduce(s,'start');return s;}
 if(action.type==='pause'){reduce(s,'pause');return s;}
 if(action.type==='resume'){reduce(s,'resume');return s;}
 if(action.type==='retry'&&s.session.status==='lost'){reduce(s,'retry');if(s.sourceConfig.chainMode==='classic'){s.bridges=[];s.score=0;s.gate=null;s.gatesCleared=[];}s.phase=s.gate?'gate-recall':s.difficulty==='expert'?'recall':'choose';s.crossing=0;return s;}
 if(action.type==='assist'&&['ready','playing','paused'].includes(s.session.status)){const status=s.session.status;s.session.status='playing';reduce(s,'assist',{kind:action.kind});s.session.status=status;return s;}
 if(s.session.status!=='playing')return previous;
 if(action.type==='motor-error'){reduce(s,'motor-error');s.message='Connector returned safely. Tap it or try again; no memory strike.';return s;}
 if(action.type==='ready'&&['recall','gate-recall'].includes(s.phase)){s.phase=s.gate?'gate-choose':'choose';s.message='Choose the opening you recalled. This is recognition, not a verified oral assessment.';return s;}
 if(action.type==='next'&&s.phase==='checkpoint'){s.phase=s.difficulty==='expert'?'recall':'choose';s.crossing=0;s.selection=0;s.message='Recite the ending, then recall the next opening.';return s;}
 if(action.type==='steer'&&['choose','gate-choose'].includes(s.phase)){s.selection=(s.selection+(action.direction<0?-1:1)+3)%3;return s;}
 if(action.type==='tick'){
  if(!Number.isFinite(action.dt)||action.dt<=0||action.dt>.2)return previous;
  s.clock+=action.dt;
  if(['crossing','gate-crossing'].includes(s.phase)){s.crossing=Math.min(1,s.crossing+action.dt/2);if(s.crossing===1){
   if(s.gate){if(s.gate.cursor===0){s.gate.cursor=1;s.phase='gate-recall';s.crossing=0;if(s.sourceConfig.chainMode==='practice')s.session.strikes=0;s.message='First Gate link recalled. Now try the next boundary.';}else{s.gatesCleared.push(s.gate.id);s.gate=null;s.phase='checkpoint';s.message='Bridge Gate cleared. Two connections reviewed; no extra completion or recall grade awarded.';}}
   else{s.bridges.push(t.id);s.score+=100;reduce(s,'checkpoint');s.phase=s.session.status==='won'?'complete':'checkpoint';s.message='Connection complete! Recite both ayahs together. Game success does not certify memorization.';
    if(s.sourceConfig.bridgeGate&&s.session.status!=='won'&&s.bridges.length%3===0){s.gate={id:`gate:${s.bridges.length}`,start:s.bridges.length-2,cursor:0};s.phase='gate-recall';s.crossing=0;s.message='Bridge Gate: say two consecutive openings from memory before revealing their connectors.';}
   }
  }}
  return s;
 }
 if(action.type==='select'&&['choose','gate-choose'].includes(s.phase)){
  const index=action.index??s.selection,choice=t.choices[index];if(!Number.isInteger(index)||!choice)return previous;
  if(choice.key!==t.to){const evidence={category:'phrase-transition',expected:t.opening.map(w=>w.id),selected:choice.words.map(w=>w.id)};reduce(s,'mistake',evidence);s.transitionErrors.push({transitionId:t.id,from:t.from,to:t.to,selected:choice.key,event:s.session.events});s.message='That opening belongs elsewhere. Listen, recall and try again. Completed bridges stay safe.';return s;}
  s.phase=s.gate?'gate-crossing':'crossing';s.crossing=0;s.message='The bridge connects! Follow the lantern from right to left.';return s;
 }
 return previous;
}
