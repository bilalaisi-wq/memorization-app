import {memoryLevel,motorLevel} from '../difficulty.js';
import {createSession, reduceSession} from '../session.js';
import {answerOrder} from '../../../quest/cosmic/answer-order.js';
import {buildSectors} from '../asteroids/content.js';
import {selectionEvidence} from '../evidence.js';
import {wordIdentity} from '../../../distractors.js';
export const WORLD={width:900,height:820,launcher:{x:450,y:760},shotRadius:13};
export const bubbleProfiles={beginner:{radius:90,choices:2,speed:500},standard:{radius:84,choices:3,speed:640},expert:{radius:128,choices:2,speed:700}};
const identity=p=>p.words.map(w=>wordIdentity(w.text)).join(' ');
export function buildFormations(adapter,config,library,options={}) {
  options={...options,difficulty:memoryLevel(config,options.difficulty)};
  const phraseLibrary=options.difficulty==='expert'&&!config.contextVersion?library.map(chapter=>({...chapter,verses:chapter.verses.filter(verse=>verse.words.length<=4)})):library;
  const sectors=buildSectors(adapter,options.difficulty==='beginner'&&config.difficultySchema===1?{...config,memoryDifficulty:'standard'}:config,phraseLibrary,{...options,difficulty:options.difficulty==='beginner'?'standard':options.difficulty});
  if(sectors.some(s=>s.targets.some(p=>p.words.length>4)))throw Error('Bubble phrase targets must fit four words. Choose Beginner/Standard word mode or smaller published reviewed phrases; no boundaries are generated.');
  return sectors;

}
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
// Connected equal-word circles form one semantic cluster. No color is an answer cue.
export function connectedCluster(bubbles,id) {
  const first=bubbles.find(b=>b.id===id);if(!first?.piece)return [];
  const seen=new Set([id]),queue=[first];
  for(let i=0;i<queue.length;i++)for(const b of bubbles)
    if(b.piece&&!seen.has(b.id)&&identity(first.piece)===identity(b.piece)&&Math.hypot(b.x-queue[i].x,b.y-queue[i].y)<=b.radius+queue[i].radius+2){seen.add(b.id);queue.push(b);}
  return queue.map(b=>b.id);
}
// Three independent lanes leave every semantic cluster directly reachable. The field
// persists: advancing replaces only the resolved cluster and the next target slot.
function slotOrder(s, salt=0) {
  return answerOrder([0,1,2],s.session.config.seed+Math.imul(s.cursor+1,7919)+s.session.checkpoint*104729+salt);
}
function fillSlot(s,slot,piece) {
  const profile=bubbleProfiles[s.difficulty],radius=s.session.config.difficultySchema===1?128:profile.radius;
  const offset=slotOrder(s,slot+311).indexOf(slot)*30;
  const y=400+offset+s.descent;
  const id=`${s.session.checkpoint}-${s.cursor}-${slot}-${s.generation++}`;
  const x=150+slot*300;
  // Small neutral pendants depend on the semantic cluster; only they float away.
  return [0,1].map(row=>({id:`${id}-${row}`,piece,slot,x,y:y-row*radius*2,radius}));
}
function populate(s,previousSlot=null) {
  const sector=s.sectors[s.session.checkpoint],expected=sector.targets[s.cursor];
  if(!expected){s.bubbles=[];return;}
  const slots=slotOrder(s),slot=slots.find(n=>n!==previousSlot);
  const distractors=answerOrder(sector.distractors,s.session.config.seed+s.cursor*65537+1709);
  if(previousSlot===null){
    s.bubbles=slots.flatMap((n,i)=>fillSlot(s,n,n===slot?expected:distractors[i%distractors.length]));
  }else{
    s.bubbles=s.bubbles.filter(b=>b.slot!==slot&&b.slot!==previousSlot);
    const spare=distractors.find(p=>!s.bubbles.some(b=>identity(b.piece)===identity(p)))||distractors[0];
    s.bubbles.push(...fillSlot(s,slot,expected),...fillSlot(s,previousSlot,spare));
  }
  const affected=previousSlot===null?[0,1,2]:[slot,previousSlot];
  s.neutrals=s.neutrals.filter(n=>!affected.includes(n.slot));
  for(const n of affected){const anchor=s.bubbles.find(b=>b.slot===n);for(let j=0;j<1+slotOrder(s,719).indexOf(n);j++)s.neutrals.push({id:`neutral-${anchor.id}-${j}`,slot:n,support:anchor.id,x:anchor.x+(j-1)*32,y:anchor.y+anchor.radius+24,radius:15});}
  s.targetSlot=slot;
  s.placements.push({checkpoint:s.session.checkpoint,cursor:s.cursor,slot,x:150+slot*300,y:s.bubbles.find(b=>b.slot===slot).y});
}
export function trajectoryPreview(state) {
  let x=WORLD.launcher.x,y=WORLD.launcher.y,dx=Math.cos(state.angle),dy=Math.sin(state.angle);
  const points=[{x,y}];
  for(let step=0;step<2200;step++){
    x+=dx*4;y+=dy*4;
    if(x<13){x=26-x;dx=Math.abs(dx);points.push({x,y});}
    if(x>887){x=1774-x;dx=-Math.abs(dx);points.push({x,y});}
    if(state.bubbles.some(b=>Math.hypot(x-b.x,y-b.y)<=b.radius+13)||y<0){points.push({x,y});break;}
  }
  return points;
}
function descend(s) {
  if(s.motionDifficulty==='beginner'||s.shots%4!==0)return;
  s.descent+=18;s.bubbles.forEach(b=>b.y+=18);s.neutrals.forEach(b=>b.y+=18);
  if(s.bubbles.some(b=>b.y+b.radius>=650)){
    s.arcadeRecovery=true;s.projectile=null;
    s.message='Formation reached the safe line. Reset its height — no memory strike.';
  }
}
export function createBubble({id,config,sectors,difficulty='beginner'}) {
  difficulty=memoryLevel(config,difficulty);
  if(!bubbleProfiles[difficulty]||!sectors.length||sectors.map(s=>s.key).join('|')!==config.keys.join('|')||sectors.some(s=>!s.targets.length||!s.distractors.length))throw Error('Invalid verified bubble content');
  const s={session:createSession({id,game:'bubble',config}),sectors:structuredClone(sectors),difficulty,motionDifficulty:motorLevel(config,difficulty),cursor:0,captured:[],bubbles:[],neutrals:[],projectile:null,angle:-Math.PI/2,score:0,shots:0,bounces:0,shotBounces:0,lastClear:[],lastDetached:[],combo:0,placements:[],generation:0,descent:0,arcadeRecovery:false,effect:0,awaitingNext:false,message:'Aim the connector, then launch toward the next continuation.'};populate(s);return s;
}
export function stepBubble(previous,action) {
  if(previous.session.status==='disposed')return previous;
  const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors};
  const status=s.session.status;
  if(action.type==='dispose'){reduce(s,'dispose');s.projectile=null;return s;}
  if(action.type==='start'&&status==='ready'){reduce(s,'start');return s;}
  if(action.type==='pause'){reduce(s,'pause');return s;}
  if(action.type==='resume'){reduce(s,'resume');return s;}
  if(action.type==='retry'&&status==='lost'){reduce(s,'retry');s.cursor=0;s.captured=[];s.projectile=null;s.awaitingNext=false;s.arcadeRecovery=false;s.descent=0;populate(s);return s;}
  if(status!=='playing')return previous;
  if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
  if(action.type==='next'&&s.awaitingNext){s.awaitingNext=false;s.descent=0;populate(s);return s;}
  if(action.type==='recover'&&s.arcadeRecovery){s.bubbles.forEach(b=>b.y-=s.descent);s.neutrals.forEach(b=>b.y-=s.descent);s.descent=0;s.arcadeRecovery=false;s.message='Formation reset. Your words and memory charges are retained.';return s;}
  if(s.awaitingNext||s.arcadeRecovery)return previous;
  if(action.type==='aim'&&!s.projectile&&Number.isFinite(action.angle)){s.angle=Math.max(-Math.PI+.12,Math.min(-.12,action.angle));return s;}
  if(action.type==='launch'&&!s.projectile){const speed=bubbleProfiles[s.motionDifficulty||s.difficulty].speed;s.projectile={...WORLD.launcher,vx:Math.cos(s.angle)*speed,vy:Math.sin(s.angle)*speed};s.shots++;s.shotBounces=0;return s;}
  if(action.type!=='tick'||!s.projectile||!Number.isFinite(action.dt)||action.dt<=0)return previous;
  // Large/lagged frames do not advance or punish the learner. Substeps prevent tunnelling.
  if(action.dt>.15)return previous;
  let remaining=action.dt;
  while(remaining>0&&s.projectile){const dt=Math.min(remaining,.008);remaining-=dt;const p=s.projectile;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.x<WORLD.shotRadius){p.x=2*WORLD.shotRadius-p.x;p.vx=Math.abs(p.vx);s.bounces++;s.shotBounces++;}
    if(p.x>WORLD.width-WORLD.shotRadius){p.x=2*(WORLD.width-WORLD.shotRadius)-p.x;p.vx=-Math.abs(p.vx);s.bounces++;s.shotBounces++;}
    const hit=s.bubbles.find(b=>Math.hypot(p.x-b.x,p.y-b.y)<=b.radius+WORLD.shotRadius);
    if(hit){s.projectile=null;const sector=s.sectors[s.session.checkpoint],expected=sector.targets[s.cursor];
      if(identity(hit.piece)===identity(expected)){
        s.lastClear=s.bubbles.filter(b=>connectedCluster(s.bubbles,hit.id).includes(b.id));s.lastDetached=s.neutrals.filter(n=>s.lastClear.some(b=>b.id===n.support));s.neutrals=s.neutrals.filter(n=>!s.lastDetached.includes(n));s.combo=s.lastClear.length+s.lastDetached.length;s.effect++;s.score+=100*s.lastClear.length+25*s.lastDetached.length+50*Math.min(2,s.shotBounces);s.captured.push(...expected.words);s.cursor++;s.message='Connection found! Say it aloud with the reciter.';
        if(s.cursor===sector.targets.length){reduce(s,'checkpoint');if(s.session.status==='won'){s.bubbles=[];s.neutrals=[];s.message='Formation complete. Your recognition practice is saved separately from recall.';}else{s.cursor=0;s.captured=[];s.bubbles=[];s.neutrals=[];s.awaitingNext=true;s.message='Ayah connected! Continue to the next formation.';}}
        else populate(s,hit.slot);
      }else{reduce(s,'mistake',selectionEvidence(hit.piece,expected));s.message='That is not the next continuation. The formation stays available.';}
      if(s.session.status==='playing'&&!s.awaitingNext)descend(s);
    }else if(p.y<-WORLD.shotRadius){s.projectile=null;reduce(s,'motor-error');s.message='Open-space shot — no memory strike. Adjust your aim and try again.';descend(s);}
  }
  return s;
}
