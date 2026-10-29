import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
import {wordIdentity} from '../../../distractors.js';
import {buildSectors} from '../asteroids/content.js';
export const mazeProfiles=Object.freeze({beginner:{size:9,choices:2,visible:true},standard:{size:13,choices:3,visible:false},expert:{size:17,choices:3,visible:false}});
export const directions={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
export const cellKey=({x,y})=>`${x}:${y}`;
// Every carved cell is connected. A separate choice hall keeps all doors reachable
// without crossing another door, and each door has its own recoverable alcove.
export function generateMaze(seed,difficulty='beginner'){
 const profile=mazeProfiles[difficulty];if(!profile)throw Error('Unknown maze difficulty');
 const width=profile.size,height=width+2,cells=Array.from({length:height},()=>Array(width).fill(0));
 let serial=0;const nextSeed=()=>{let n=(seed^Math.imul(++serial,0x9e3779b9))>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);return (n^(n>>>13))>>>0;};const start={x:1,y:1},stack=[start];cells[1][1]=1;
 while(stack.length){const p=stack.at(-1);const next=seededShuffle(Object.values(directions),nextSeed()).map(([dx,dy])=>({x:p.x+dx*2,y:p.y+dy*2})).find(n=>n.x>0&&n.x<width-1&&n.y>0&&n.y<width-1&&!cells[n.y][n.x]);
  if(!next){stack.pop();continue;}cells[(p.y+next.y)/2][(p.x+next.x)/2]=1;cells[next.y][next.x]=1;stack.push(next);
 }
 const hall=width,exitX=width-2;cells[width-1][exitX]=1;
 for(let x=1;x<width-1;x++)cells[hall][x]=1;
 const positions=profile.choices===2?[1,width-2]:[1,Math.floor(width/2),width-2];
 const doors=positions.map((x,index)=>{cells[hall+1][x]=1;return {x,y:hall,index};});
 return {width,height,cells,start,doors,station:{x:exitX,y:hall-1}};
}
export function buildMazeChambers(adapter,config,library,{difficulty='beginner',reviews={}}={}){
 if(!mazeProfiles[difficulty])throw Error('Unknown maze difficulty');
 return buildSectors(adapter,config,library,{difficulty,reviews}).map(s=>{
  if(s.distractors.length<mazeProfiles[difficulty].choices-1)throw Error('Insufficient verified maze choices');
  if(!s.phrases)s.distractors=adapter.choices(s.key,{seed:config.seed,count:12}).filter(w=>!w.target).map(w=>({id:`${w.key}:${w.index}-${w.index}`,key:w.key,words:[w],order:-1,target:false}));
  else {
   const excluded=new Set(s.targets.map(t=>unitIdentity(t))),pool=library.flatMap(ch=>ch.verses.filter(v=>v.words.length<=8).map(v=>{const words=adapter.words(`${ch.id}:${v.id}`);return {id:`${words[0].key}:0-${words.length-1}`,key:words[0].key,words,order:-1,target:false};})).filter(p=>p.key!==s.key&&!excluded.has(unitIdentity(p)));
   const selected=new Map();for(const target of s.targets)for(const p of seededShuffle(pool,config.seed).sort((a,b)=>similarity(b,target)-similarity(a,target)).slice(0,6))selected.set(unitIdentity(p),p);
   s.distractors=[...selected.values()];
  }
  return s;
 });
}
const unitIdentity=u=>u.words.map(w=>wordIdentity(w.text)).join(' ');
const similarity=(a,b)=>{const x=unitIdentity(a),y=unitIdentity(b);return [...x].filter(c=>y.includes(c)).length/Math.max(x.length,y.length);};
function reveal(s){
 const {x,y}=s.player;
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  const px=x+dx,py=y+dy;if(px>=0&&py>=0&&px<s.layout.width&&py<s.layout.height&&Math.abs(dx)+Math.abs(dy)<=3){const k=`${px}:${py}`;if(!s.seen.includes(k))s.seen.push(k);}
 }
}
function wing(s){
 const seed=(s.session.config.seed+s.session.checkpoint*1009+s.cursor*79)>>>0,sector=s.chambers[s.session.checkpoint];
 s.layout=generateMaze(seed,s.difficulty);s.player={...s.layout.start};s.seen=[];s.deadEnd=null;
 const target=sector.targets[s.cursor];
 const pool=seededShuffle(sector.distractors,seed);if(s.difficulty==='expert')pool.sort((a,b)=>similarity(b,target)-similarity(a,target));
 const distractors=pool.slice(0,mazeProfiles[s.difficulty].choices-1);
 s.choices=seededShuffle([target,...distractors],seed+51).map((unit,index)=>({...unit,door:index}));
 reveal(s);
}
export function createMaze({id,config,chambers,difficulty='beginner'}){
 if(!mazeProfiles[difficulty]||!chambers.length||chambers.map(s=>s.key).join('|')!==config.keys.join('|')||chambers.some(c=>!c.targets.length||c.targets.flatMap(t=>t.words).map(w=>w.id).join('|')!==c.words.map(w=>w.id).join('|')))throw Error('Invalid verified maze content');
 const s={session:createSession({id,game:'maze',config}),chambers:structuredClone(chambers),difficulty,cursor:0,captured:[],seen:[],player:null,layout:null,choices:[],deadEnd:null,portal:false,mapRevealed:false,score:0,steps:0,message:'Press Enter maze to begin. Explore, then open the next correct continuation.'};wing(s);return s;
}
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
export function stepMaze(previous,action){
 if(previous.session.status==='disposed')return previous;
 const s={...structuredClone({...previous,chambers:undefined}),chambers:previous.chambers},status=s.session.status;
 if(action.type==='dispose'){reduce(s,'dispose');return s;}
 if(action.type==='start'&&status==='ready'){reduce(s,'start');s.message='Explore the corridors. Walk to a numbered door and read its continuation.';return s;}
 if(action.type==='pause'||action.type==='resume'){reduce(s,action.type);return s;}
 if(action.type==='retry'&&status==='lost'){
  s.score=s.session.config.chainMode==='classic'?0:Math.max(0,s.score-s.cursor*100);reduce(s,'retry');s.cursor=0;s.captured=[];s.portal=false;s.mapRevealed=false;wing(s);s.message='A fresh route. Completed Practice chambers stay safe.';return s;
 }
 if(status!=='playing')return previous;
 if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
 if(action.type==='map'){s.mapRevealed=!s.mapRevealed;if(s.mapRevealed&&!mazeProfiles[s.difficulty].visible)reduce(s,'assist',{kind:'hint'});return s;}
 if(action.type==='move'){
  const delta=directions[action.direction];if(!delta)return previous;
  const p={x:s.player.x+delta[0],y:s.player.y+delta[1]};
  if(!s.layout.cells[p.y]?.[p.x]){reduce(s,'motor-error');s.message='A wall — try another corridor. No memory strike.';return s;}
  // Alcoves only open after an incorrect choice; no accidental entry or strike.
  if(p.y===s.layout.height-1&&s.deadEnd!==p.x)return previous;
  s.player=p;s.steps++;reveal(s);
  if(s.deadEnd!==null&&p.y<s.layout.height-1){s.deadEnd=null;s.message='Back on the path. Read the other doors and try again.';}
  else if(s.layout.doors.some(d=>d.x===p.x&&d.y===p.y))s.message='You reached a door. Read its Arabic sign, then Open door (Enter).';
  else if(cellKey(p)===cellKey(s.layout.station))s.message='Listening station: replay the full ayah, or keep exploring.';
  return s;
 }
 if(action.type==='open'){
  const door=s.layout.doors.find(d=>cellKey(d)===cellKey(s.player));
  if(!door){s.message='Walk to a numbered door first. Navigation never costs a memory strike.';return s;}
  if(s.portal){
   reduce(s,'checkpoint');s.score+=200;s.cursor=0;s.captured=[];s.portal=false;s.mapRevealed=false;wing(s);s.message='A new chamber, a new ayah. Listen, then explore.';return s;
  }
  const choice=s.choices[door.index],target=s.chambers[s.session.checkpoint].targets[s.cursor];
  if(choice.id!==target.id){reduce(s,'mistake');s.deadEnd=door.x;s.player={x:door.x,y:door.y+1};reveal(s);s.message='Not the next continuation. One memory strike. Step back out of this dead end and try another door.';return s;}
  s.captured.push(...target.words);s.cursor++;s.score+=100;s.message='The path opens! Say the continuation aloud.';
  if(s.cursor===s.chambers[s.session.checkpoint].targets.length){
   if(s.session.checkpoint===s.chambers.length-1){reduce(s,'checkpoint');s.score+=200;s.message='Maze complete! Recognition practice is separate from independent recitation.';}
   else{s.portal=true;s.message='Ayah assembled! Open any glowing portal door to enter the next chamber.';}
  }else wing(s);
  return s;
 }
 return previous;
}
