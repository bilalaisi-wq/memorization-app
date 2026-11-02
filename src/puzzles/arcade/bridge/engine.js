import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {buildSectors} from '../asteroids/content.js';
import {selectionEvidence} from '../evidence.js';
import {wordIdentity} from '../../../distractors.js';
import {makeStructure,bridgeProfiles,inspectBridge} from './structure.js';
export {bridgeProfiles} from './structure.js';
const identity=p=>p.words.map(w=>wordIdentity(w.text)).join(' ');
export function buildCrossings(adapter,config,library,options={}){const sectors=buildSectors(adapter,config,library,options);if(sectors.some(s=>s.targets.some(p=>p.words.length>8)))throw Error('Choose word mode or smaller published reviewed phrases for bridge labels.');return sectors;}
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
function crossing(s){const sector=s.sectors[s.session.checkpoint],count=Math.min(4,sector.targets.length-s.windowStart);s.structure=makeStructure(count,s.difficulty);s.beams=[];s.supports=[];s.testing=null;s.lastLoadIndex=0;s.lastReport=null;s.awaitingNext=false;s.awaitingWindow=false;s.selectedBeam=null;refreshChoices(s);}
function refreshChoices(s){if(s.beams.length>=s.structure.nodes.length-1){s.choices=[];return;}const sector=s.sectors[s.session.checkpoint],expected=sector.targets[s.windowStart+s.beams.length];const all=[...sector.targets.slice(s.windowStart+s.beams.length,s.windowStart+s.structure.nodes.length-1),...sector.distractors];const seen=new Set();s.choices=expected?seededShuffle(all.filter(p=>{const value=identity(p);if(seen.has(value))return false;seen.add(value);return true;}),s.session.config.seed+s.windowStart+s.beams.length):[];}
export function createBridge({id,config,sectors,difficulty='beginner'}){if(!bridgeProfiles[difficulty]||!sectors.length||sectors.map(s=>s.key).join('|')!==config.keys.join('|')||sectors.some(s=>!s.targets.length||!s.distractors.length))throw Error('Invalid verified bridge content');const s={session:createSession({id,game:'bridge',config}),sectors:structuredClone(sectors),difficulty,windowStart:0,captured:[],beams:[],supports:[],structure:null,choices:[],testing:null,lastReport:null,engineeringErrors:0,tests:0,score:0,lastLoadIndex:0,awaitingNext:false,awaitingWindow:false,message:'Select the next Arabic piece, then connect it between deck joints. Supports and load testing are separate engineering decisions.'};crossing(s);return s;}
function engineering(s,message){reduce(s,'motor-error');s.engineeringErrors++;s.message=`Engineering check: ${message} No memory strike. Your accepted words are safe.`;}
export function stepBridge(previous,action){
 if(previous.session.status==='disposed')return previous;
 const s={...structuredClone({...previous,sectors:undefined,lastReport:undefined,structure:undefined}),sectors:previous.sectors,lastReport:previous.lastReport,structure:previous.structure};
 if(action.type==='dispose'){reduce(s,'dispose');s.testing=null;return s;}
 if(action.type==='start'&&s.session.status==='ready'){reduce(s,'start');return s;}
 if(action.type==='pause'){reduce(s,'pause');return s;}
 if(action.type==='resume'){reduce(s,'resume');return s;}
 if(action.type==='retry'&&s.session.status==='lost'){reduce(s,'retry');s.windowStart=0;s.captured=[];crossing(s);return s;}
 if(s.session.status!=='playing')return previous;
 if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
 if(action.type==='next'&&(s.awaitingNext||s.awaitingWindow)){crossing(s);return s;}
 if(s.awaitingNext||s.awaitingWindow)return previous;
 if(s.testing){
  if(action.type!=='tick'||!Number.isFinite(action.dt)||action.dt<=0||action.dt>.15)return previous;
  s.testing.progress=Math.min(1,s.testing.progress+action.dt*.2);const index=Math.min(24,Math.floor(s.testing.progress*24)),load=s.lastReport.cases[index];s.lastLoadIndex=index;
  if(!load.stable){s.testing=null;engineering(s,load.reason);return s;}
  if(s.testing.progress===1){s.testing=null;s.score+=100*s.beams.length;s.windowStart+=s.beams.length;const sector=s.sectors[s.session.checkpoint];if(s.windowStart===sector.targets.length){reduce(s,'checkpoint');if(s.session.status==='won'){s.message='Crossing complete! Recognition and construction are separate from independent recall.';}else{s.windowStart=0;s.captured=[];s.awaitingNext=true;s.message='Ayah crossing complete. Prepare the next linked crossing.';}}else{s.awaitingWindow=true;s.message='Load test passed. Continue with the next connected study section.';}}
  return s;
 }
 if(action.type==='select'){
  if(s.beams.length>=s.structure.nodes.length-1)return previous;
  const selected=s.choices[action.index],expected=s.sectors[s.session.checkpoint].targets[s.windowStart+s.beams.length];if(!Number.isInteger(action.index)||!selected||!expected)return previous;
  if(identity(selected)!==identity(expected)){reduce(s,'mistake',selectionEvidence(selected,expected));s.message='That is not the next Arabic continuation. The bridge and accepted pieces stay intact.';return s;}
  s.beams.push({id:s.windowStart+s.beams.length,piece:expected,bay:null,reinforced:false});s.selectedBeam=s.beams.at(-1).id;s.captured.push(...expected.words);s.message='Correct continuation. Place this beam where the structure needs it.';refreshChoices(s);return s;
 }
 const beam=s.beams.find(b=>b.id===action.beamId);
 if(action.type==='place'){
  if(!beam||!Number.isInteger(action.from)||!Number.isInteger(action.to)||action.from<0||action.to<0||action.from>=s.structure.nodes.length||action.to>=s.structure.nodes.length)return previous;
  if(Math.abs(action.from-action.to)!==1){engineering(s,'A deck beam must connect two neighboring deck joints.');return s;}
  const bay=Math.min(action.from,action.to);if(s.beams.some(b=>b.id!==beam.id&&b.bay===bay)){engineering(s,'That bay already has a beam. Move or remove it first.');return s;}
  beam.bay=bay;s.lastReport=null;s.selectedBeam=beam.id;s.message='Connection made. You can move this beam without retaking the Arabic selection.';return s;
 }
 if(action.type==='remove'&&beam){beam.bay=null;s.lastReport=null;return s;}
 if(action.type==='reinforce'&&beam){const limit=bridgeProfiles[s.difficulty].upgrades;if(!beam.reinforced&&s.beams.filter(b=>b.reinforced).length>=limit){engineering(s,'The reinforcement budget is used. Remove another upgrade first.');return s;}beam.reinforced=!beam.reinforced;s.lastReport=null;return s;}
 if(action.type==='support'){
  const node=s.structure.nodes[action.node],profile=bridgeProfiles[s.difficulty];if(!node||node.anchor||!['pier','left','right'].includes(action.kind))return previous;
  const existing=s.supports.findIndex(p=>p.node===node.id&&p.kind===action.kind);if(existing>=0){s.supports.splice(existing,1);s.lastReport=null;return s;}
  const pier=action.kind==='pier',used=s.supports.filter(p=>(p.kind==='pier')===pier).length;
  if(used>=(pier?profile.pierBudget:profile.strutBudget)||(pier&&s.difficulty==='beginner'&&node.id!==Math.floor((s.structure.nodes.length-1)/2))){engineering(s,'This support is outside the available foundation or budget. Try another layout.');return s;}
  s.supports.push({node:node.id,kind:action.kind});s.lastReport=null;s.message='Support installed. Test the load to see how this layout behaves.';return s;
 }
 if(action.type==='test'){
  if(s.beams.length!==s.structure.nodes.length-1){engineering(s,'Accept every required Arabic beam before testing.');return s;}
  s.tests++;s.lastReport=inspectBridge(s.structure,s.beams,s.supports);
  if(!s.lastReport.connected){engineering(s,s.lastReport.reason);return s;}
  s.lastLoadIndex=0;s.testing={progress:0};s.message='Load cart crossing. The model checks bending and member load at each position.';return s;
 }
 return previous;
}
