import {prepareDefenseContent} from '../src/quest/cosmic/defense-content.js';
import {createMeteorDefense} from '../src/puzzles/arcade/cosmic/defense.js';
import {rayIntersection,angleDelta} from '../src/puzzles/arcade/cosmic/defense-beam.js';
export async function makeDefense3(options={}){const refs=options.refs||['112:1'],content=await prepareDefenseContent(refs,null,{memoryDifficulty:'expert',motorDifficulty:options.motorDifficulty||'relaxed'});return createMeteorDefense({refs,seed:31,stageId:'beam3',captureContent:content,carrierMode:'capture',motorDifficulty:'relaxed',...options});}
export const advance=(g,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.05)g.dispatch({type:'tick',dt:.05});};
export function holdAt(g,c,seconds=1.3){g.dispatch({type:'fire',active:false});g.dispatch({type:'aim',angle:Math.atan2(c.y-340,c.x-500)});advance(g,.4);g.dispatch({type:'fire',active:true});advance(g,seconds);g.dispatch({type:'fire',active:false});}
export function pilot3(g,{stopSafe=false,stopAtPage=false,wrong=false,early=false,max=30000}={}){
 let previous=0;
 for(let n=0;n<max;n++){
  const s=g.getSnapshot();if(['checkpoint','page-clear'].includes(s.status)){if(s.status==='checkpoint'||stopAtPage)return s;g.dispatch({type:'next-page'});continue;}
  if(s.status==='ready'){g.start();continue;}if(['recovery','lost'].includes(s.status)){g.dispatch({type:'retry'});continue;}if(s.status==='paused'){g.resume();continue;}
  if(stopSafe&&s.coreStatus==='wave-clear'&&!s.pendingPiece)return s;
  if(s.overheated||s.cooldown>0){g.dispatch({type:'fire',active:false});advance(g,.05);continue;}
  const meteors=s.objects.filter(o=>o.kind==='meteor').sort((a,b)=>Math.hypot(a.x-500,a.y-340)-Math.hypot(b.x-500,b.y-340));
  let desired=meteors.find(m=>rayIntersection(Math.atan2(m.y-340,m.x-500),[...meteors,...s.carriers])?.object.id===m.id);
  if((early&&n<45||!meteors.length&&s.coreStatus==='wave-clear')&&s.expected)desired=s.carriers.find(c=>(c.piece.id===s.expected.id)!==wrong);
  if(desired){const a=Math.atan2(desired.y-340,desired.x-500);g.dispatch({type:'aim',angle:a});if(Math.abs(angleDelta(a,s.angle))<.05)g.dispatch({type:'fire',active:true});else g.dispatch({type:'fire',active:false});}else g.dispatch({type:'fire',active:false});
  advance(g,.05);if(wrong&&g.getSnapshot().strikes>previous)return g.getSnapshot();previous=s.strikes;
 }throw Error('Intelligent defense pilot did not finish');
}
