import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {buildSectors} from '../asteroids/content.js';
import {selectionEvidence} from '../evidence.js';
export const SIRAT={sectionWidth:1800,height:620,playerWidth:30,playerHeight:46,speed:230,jump:580,gravity:1450};
export const siratProfiles={beginner:{choices:2,gap:60},standard:{choices:3,gap:85},expert:{choices:3,gap:85}};
export function buildSiratSections(adapter,config,library,options={}) {
 const sectors=buildSectors(adapter,config,library,options);
 if(sectors.some(s=>s.targets.some(t=>t.words.length>8)))throw Error('Choose word mode or smaller published reviewed phrases for readable gateways.');
 return sectors;
}
export function generatePlatforms(seed,difficulty='beginner',offset=0){
 if(!siratProfiles[difficulty])throw Error('Unknown platform difficulty');
 const easy=difficulty==='beginner',shift=seed%19;
 const floor=(id,x,w,y=440)=>({id,x:x+offset,y,w,h:180,checkpoint:true});
 const result=[floor('start',0,easy?480:360),{id:'ferry',x:(easy?540:450)+offset,y:400,w:easy?180:140,h:22,moving:true,amplitude:easy?20:28,phase:shift/10},floor('garden',easy?790:680,easy?240:350),floor('gateway',1110,690)];
 if(difficulty==='expert')result.push({id:'optional-1',x:810+offset,y:340,w:125,h:20,optional:true},{id:'optional-2',x:1000+offset,y:260,w:100,h:20,optional:true});
 return result;
}
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
export const platformAt=(p,time)=>({...p,x:p.x+(p.moving?Math.sin(time*1.2+p.phase)*p.amplitude:0)});
function layout(s){s.camera=s.cursor*1800;s.gateFeedback=null;s.platforms=generatePlatforms(s.session.config.seed+s.cursor,s.difficulty,s.cursor*SIRAT.sectionWidth);s.player={x:s.cursor*SIRAT.sectionWidth+70,y:440-SIRAT.playerHeight,vx:0,vy:0,grounded:true,support:'start'};s.checkpoint={x:s.player.x,y:s.player.y};s.resolved=false;s.direction=0;s.jumpQueued=false;s.choices=seededShuffle([s.sectors[s.session.checkpoint].targets[s.cursor],...s.sectors[s.session.checkpoint].distractors.slice(0,siratProfiles[s.difficulty].choices-1)],s.session.config.seed+s.cursor);}
export function createSirat({id,config,sectors,difficulty='beginner'}){
 if(!siratProfiles[difficulty]||sectors.map(s=>s.key).join('|')!==config.keys.join('|')||!sectors.length||sectors.some(s=>!s.targets.length||s.distractors.length<siratProfiles[difficulty].choices-1))throw Error('Invalid verified gateway content');
 const s={session:createSession({id,game:'sirat',config}),sectors:structuredClone(sectors),difficulty,cursor:0,captured:[],player:null,platforms:[],choices:[],checkpoint:null,direction:0,jumpQueued:false,resolved:false,awaitingNext:false,time:0,camera:0,recoveries:0,score:0,gateFeedback:null,message:'Explore a fictional hilltop garden. Reach the gateway and choose the next continuation.'};layout(s);return s;
}
export const nearGateway=s=>!s.awaitingNext&&s.player.x>=s.cursor*SIRAT.sectionWidth+1190&&s.player.grounded;
function recover(s){reduce(s,'motor-error');s.recoveries++;s.player={...s.player,...s.checkpoint,vx:0,vy:0,grounded:true,support:null};s.direction=0;s.jumpQueued=false;s.message='Back at your last safe landing. No memory strike or learning penalty.';}
export function stepSirat(previous,action){
 if(previous.session.status==='disposed')return previous;
 const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors};
 if(action.type==='dispose'){reduce(s,'dispose');s.direction=0;return s;}
 if(action.type==='start'&&s.session.status==='ready'){reduce(s,'start');return s;}
 if(action.type==='pause'){reduce(s,'pause');s.direction=0;s.jumpQueued=false;return s;}
 if(action.type==='resume'){reduce(s,'resume');return s;}
 if(action.type==='retry'&&s.session.status==='lost'){reduce(s,'retry');s.cursor=0;s.captured=[];s.awaitingNext=false;layout(s);s.message="A fresh garden checkpoint. Your saved learning progress is safe.";return s;}
 if(s.session.status!=='playing')return previous;
 if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
 if(action.type==='next'&&s.awaitingNext){s.cursor=0;s.captured=[];s.awaitingNext=false;layout(s);s.message="A fresh garden checkpoint. Your saved learning progress is safe.";return s;}
 if(s.awaitingNext)return previous;
 if(action.type==='move'&&[-1,0,1].includes(action.direction)){s.direction=action.direction;return s;}
 if(action.type==='jump'){if(s.player.grounded)s.jumpQueued=true;return s;}
 if(action.type==='recover'){recover(s);return s;}
 if(action.type==='choose'){
  if(!nearGateway(s)||s.resolved||!Number.isInteger(action.index)||!s.choices[action.index])return previous;
  const expected=s.sectors[s.session.checkpoint].targets[s.cursor],selected=s.choices[action.index];
  if(selected.id===expected.id){s.resolved=true;s.captured.push(...expected.words);s.score+=100;s.checkpoint={x:s.cursor*1800+1230,y:394};s.gateFeedback='correct';s.message='Gateway open! Say the continuation aloud, then explore the path ahead.';}
  else{reduce(s,'mistake',selectionEvidence(selected,expected));s.gateFeedback='incorrect';s.message='That continuation belongs elsewhere. Try another gateway; movement mistakes never cost memory charges.';}
  return s;
 }
 if(action.type!=='tick'||!Number.isFinite(action.dt)||action.dt<=0||action.dt>.15)return previous;
 let remaining=action.dt;
 while(remaining>0){const dt=Math.min(remaining,1/120);remaining-=dt;const oldTime=s.time;s.time+=dt;const p=s.player,base=s.cursor*1800;
  if(p.grounded&&p.support){const support=s.platforms.find(q=>q.id===p.support);if(support?.moving)p.x+=platformAt(support,s.time).x-platformAt(support,oldTime).x;}
  p.vx=s.direction*SIRAT.speed;if(s.jumpQueued&&p.grounded){p.vy=-SIRAT.jump;p.grounded=false;p.support=null;}s.jumpQueued=false;
  const old={x:p.x,y:p.y};p.x+=p.vx*dt;p.x=Math.max(base,Math.min(base+(s.resolved?1799:1515),p.x));p.vy+=SIRAT.gravity*dt;p.y+=p.vy*dt;p.grounded=false;p.support=null;
  for(const raw of s.platforms){const q=platformAt(raw,s.time);if(p.x+30<=q.x||p.x>=q.x+q.w||p.y+46<=q.y||p.y>=q.y+q.h)continue;
   if(old.y+46<=q.y+.5&&p.vy>=0){p.y=q.y-46;p.vy=0;p.grounded=true;p.support=q.id;if(raw.checkpoint){s.checkpoint={x:Math.max(q.x+15,Math.min(q.x+q.w-45,p.x)),y:p.y};}}
   else if(old.y>=q.y+q.h-.5&&p.vy<0){p.y=q.y+q.h;p.vy=0;}
   else if(old.x+30<=q.x){p.x=q.x-30;p.vx=0;}
   else if(old.x>=q.x+q.w){p.x=q.x+q.w;p.vx=0;}
  }
  if(p.y>650){recover(s);break;}
  if(s.resolved&&p.x>=base+1740){s.cursor++;if(s.cursor===s.sectors[s.session.checkpoint].targets.length){reduce(s,'checkpoint');if(s.session.status==='won'){s.message='Garden explored! Recognition practice is separate from independent recall.';s.direction=0;break;}s.awaitingNext=true;s.direction=0;s.message='Ayah section complete. Continue into the next garden.';break;}layout(s);s.message='Safe checkpoint reached. A new continuation gateway awaits.';break;}
 }
 s.camera=Math.max(s.cursor*1800,Math.min(s.cursor*1800+900,s.player.x-180));return s;
}
