import {memoryLevel,motorLevel} from '../difficulty.js';
import {createSession, reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {buildSectors} from '../asteroids/content.js';
import {selectionEvidence} from '../evidence.js';
import {wordIdentity} from '../../../distractors.js';
export const WORLD={width:900,height:820,launcher:{x:450,y:760},shotRadius:13};
export const bubbleProfiles={beginner:{radius:96,choices:2,speed:500},standard:{radius:84,choices:3,speed:640},expert:{radius:128,choices:2,speed:700}};
const identity=p=>p.words.map(w=>wordIdentity(w.text)).join(' ');
export function buildFormations(adapter,config,library,options={}) {
  options={...options,difficulty:memoryLevel(config,options.difficulty)};
  const phraseLibrary=options.difficulty==='expert'&&!config.contextVersion?library.map(chapter=>({...chapter,verses:chapter.verses.filter(verse=>verse.words.length<=4)})):library;
  const sectors=buildSectors(adapter,config,phraseLibrary,options);
  if(sectors.some(s=>s.targets.some(p=>p.words.length>4)))throw Error('Bubble phrase targets must fit four words. Choose Beginner/Standard word mode or smaller published reviewed phrases; no boundaries are generated.');
  return sectors;

}
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
// Connected equal-word circles form one semantic cluster. No color is an answer cue.
export function connectedCluster(bubbles,id) {
  const first=bubbles.find(b=>b.id===id);if(!first)return [];
  const seen=new Set([id]),queue=[first];
  for(let i=0;i<queue.length;i++)for(const b of bubbles)
    if(!seen.has(b.id)&&identity(first.piece)===identity(b.piece)&&Math.hypot(b.x-queue[i].x,b.y-queue[i].y)<=b.radius+queue[i].radius+2){seen.add(b.id);queue.push(b);}
  return queue.map(b=>b.id);
}
function populate(s) {
  const sector=s.sectors[s.session.checkpoint],profile={...bubbleProfiles[s.difficulty],...(s.session.config.difficultySchema===1?{radius:128,speed:bubbleProfiles[s.motionDifficulty].speed}:{})};
  const expected=sector.targets[s.cursor];if(!expected){s.bubbles=[];return;}
  const candidates=seededShuffle([expected,...sector.distractors.slice(0,profile.choices-1)],s.session.config.seed+s.cursor+s.session.checkpoint*101);
  s.bubbles=candidates.flatMap((piece,i)=>[0,1].map(row=>({id:`${s.session.checkpoint}-${s.cursor}-${i}-${row}`,piece,x:WORLD.width*(i+.5)/candidates.length,y:(s.difficulty==='expert'?420:320)-row*profile.radius*2,radius:profile.radius})));
}
export function createBubble({id,config,sectors,difficulty='beginner'}) {
  difficulty=memoryLevel(config,difficulty);
  if(!bubbleProfiles[difficulty]||!sectors.length||sectors.map(s=>s.key).join('|')!==config.keys.join('|')||sectors.some(s=>!s.targets.length||!s.distractors.length))throw Error('Invalid verified bubble content');
  const s={session:createSession({id,game:'bubble',config}),sectors:structuredClone(sectors),difficulty,motionDifficulty:motorLevel(config,difficulty),cursor:0,captured:[],bubbles:[],projectile:null,angle:-Math.PI/2,score:0,shots:0,bounces:0,lastClear:[],effect:0,awaitingNext:false,message:'Aim the connector, then launch toward the next continuation.'};populate(s);return s;
}
export function stepBubble(previous,action) {
  if(previous.session.status==='disposed')return previous;
  const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors};
  const status=s.session.status;
  if(action.type==='dispose'){reduce(s,'dispose');s.projectile=null;return s;}
  if(action.type==='start'&&status==='ready'){reduce(s,'start');return s;}
  if(action.type==='pause'){reduce(s,'pause');return s;}
  if(action.type==='resume'){reduce(s,'resume');return s;}
  if(action.type==='retry'&&status==='lost'){reduce(s,'retry');s.cursor=0;s.captured=[];s.projectile=null;s.awaitingNext=false;populate(s);return s;}
  if(status!=='playing')return previous;
  if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
  if(action.type==='next'&&s.awaitingNext){s.awaitingNext=false;populate(s);return s;}
  if(s.awaitingNext)return previous;
  if(action.type==='aim'&&!s.projectile&&Number.isFinite(action.angle)){s.angle=Math.max(-Math.PI+.12,Math.min(-.12,action.angle));return s;}
  if(action.type==='launch'&&!s.projectile){const speed=bubbleProfiles[s.motionDifficulty||s.difficulty].speed;s.projectile={...WORLD.launcher,vx:Math.cos(s.angle)*speed,vy:Math.sin(s.angle)*speed};s.shots++;return s;}
  if(action.type!=='tick'||!s.projectile||!Number.isFinite(action.dt)||action.dt<=0)return previous;
  // Large/lagged frames do not advance or punish the learner. Substeps prevent tunnelling.
  if(action.dt>.15)return previous;
  let remaining=action.dt;
  while(remaining>0&&s.projectile){const dt=Math.min(remaining,.008);remaining-=dt;const p=s.projectile;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.x<WORLD.shotRadius){p.x=2*WORLD.shotRadius-p.x;p.vx=Math.abs(p.vx);s.bounces++;}
    if(p.x>WORLD.width-WORLD.shotRadius){p.x=2*(WORLD.width-WORLD.shotRadius)-p.x;p.vx=-Math.abs(p.vx);s.bounces++;}
    const hit=s.bubbles.find(b=>Math.hypot(p.x-b.x,p.y-b.y)<=b.radius+WORLD.shotRadius);
    if(hit){s.projectile=null;const sector=s.sectors[s.session.checkpoint],expected=sector.targets[s.cursor];
      if(identity(hit.piece)===identity(expected)){
        s.lastClear=s.bubbles.filter(b=>connectedCluster(s.bubbles,hit.id).includes(b.id));s.effect++;s.score+=100*s.lastClear.length;s.captured.push(...expected.words);s.cursor++;s.message='Connection found! Say it aloud with the reciter.';
        if(s.cursor===sector.targets.length){reduce(s,'checkpoint');if(s.session.status==='won'){s.bubbles=[];s.message='Formation complete. Your recognition practice is saved separately from recall.';}else{s.cursor=0;s.captured=[];s.bubbles=[];s.awaitingNext=true;s.message='Ayah connected! Continue to the next formation.';}}
        else populate(s);
      }else{reduce(s,'mistake',selectionEvidence(hit.piece,expected));s.message='That is not the next continuation. The formation stays available.';}
    }else if(p.y<-WORLD.shotRadius){s.projectile=null;reduce(s,'motor-error');s.message='Open-space shot — no memory strike. Adjust your aim and try again.';}
  }
  return s;
}
