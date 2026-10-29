import {createSession,reduceSession} from '../session.js';
import {seededShuffle} from '../content.js';
export const GRID={columns:10,rows:12};
export const DIRECTIONS={up:{x:0,y:-1},right:{x:1,y:0},down:{x:0,y:1},left:{x:-1,y:0}};
export const snakeSpeeds={slow:1000,steady:650,brisk:380};
const key=p=>`${p.x}:${p.y}`;
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const inside=p=>p.x>=0&&p.x<GRID.columns&&p.y>=0&&p.y<GRID.rows;
const cells=food=>Array.from({length:6},(_,i)=>({x:food.x+i%3,y:food.y+Math.floor(i/3)}));
export const foodCells=cells;
const reduce=(s,type,extra={})=>s.session=reduceSession(s.session,{type,...extra});
export function buildSnakeSectors(adapter,config){
  return config.keys.map((reference,index)=>({key:reference,words:adapter.words(reference),audio:adapter.audio(reference),distractors:adapter.choices(reference,{seed:config.seed+index,count:6,maxWords:config.visualWindows?1000:40}).filter(w=>!w.target)}));
}
function resetBody(s){
  const path=[];
  for(let y=GRID.rows-1;y>=0;y--)for(let n=0;n<GRID.columns;n++)path.push({x:(GRID.rows-1-y)%2?GRID.columns-1-n:n,y});
  const length=3+(s.session.config.visualWindows?Math.min(s.cursor,12):s.cursor);s.body=path.slice(0,length).reverse();
  const next=path[length],head=s.body[0];
  s.direction=Object.keys(DIRECTIONS).find(d=>DIRECTIONS[d].x===next.x-head.x&&DIRECTIONS[d].y===next.y-head.y);
  s.queued=null;
}
// Static reachability is conservative: moving-tail cells are treated as blocked.
export function reachableCells(s,blocked=[]){
  const occupied=new Set([...s.body.slice(1),...blocked].map(key)),queue=[s.body[0]],visited=new Set([key(s.body[0])]);
  for(let i=0;i<queue.length;i++)for(const delta of Object.values(DIRECTIONS)){
    const p={x:queue[i].x+delta.x,y:queue[i].y+delta.y};
    if(!inside(p)||occupied.has(key(p))||visited.has(key(p)))continue;
    visited.add(key(p));queue.push(p);
  }
  return visited;
}
function candidates(s){
  const occupied=new Set(s.body.map(key)),head=s.body[0],result=[];
  for(let y=0;y<=GRID.rows-2;y++)for(let x=0;x<=GRID.columns-3;x++){
    const area=cells({x,y});
    if(area.some(p=>occupied.has(key(p))||Math.abs(p.x-head.x)+Math.abs(p.y-head.y)<3))continue;
    result.push({x,y});
  }
  return seededShuffle(result,s.session.config.seed+s.serial++);
}
function populate(s){
  s.food=[];
  const sector=s.sectors[s.session.checkpoint];
  if(s.cursor===sector.words.length){
    const free=[...reachableCells(s)].filter(k=>k!==key(s.body[0]));
    const value=free.at(-1);s.portal=value?{x:Number(value.split(':')[0]),y:Number(value.split(':')[1])}:null;
    return !!s.portal;
  }
  const reachable=reachableCells(s),places=candidates(s),required=places.find(p=>cells(p).some(c=>reachable.has(key(c))));
  if(!required)return false;
  s.food.push({...required,id:`word-${s.serial++}`,word:sector.words[s.cursor],required:true});
  for(const word of seededShuffle(sector.distractors,s.serial+s.session.config.seed).slice(0,2)){
    const occupied=new Set(s.food.flatMap(cells).map(key));
    const place=places.find(p=>!cells(p).some(c=>occupied.has(key(c)))&&cells(required).some(c=>reachableCells(s,[...s.food.filter(f=>!f.required).flatMap(cells),...cells(p)]).has(key(c))));
    if(place)s.food.push({...place,id:`word-${s.serial++}`,word,required:false});
  }
  return true;
}
function freshSector(s){s.cursor=0;s.captured=[];s.portal=null;resetBody(s);populate(s);}
export function createSnake({id,config,sectors,speed='slow'}){
  if(!snakeSpeeds[speed]||!sectors.length||sectors.map(s=>s.key).join('|')!==config.keys.join('|')||sectors.some(s=>!s.words.length||s.words.length>(config.visualWindows?1000:40)))throw Error('Invalid Snake content or speed');
  const s={session:createSession({id,game:'snake',config}),sectors:structuredClone(sectors),body:[],direction:'up',queued:null,cursor:0,captured:[],food:[],portal:null,score:0,serial:0,speed,steps:0,elapsed:0,motorPause:false,message:'Press Start trail. Steer into the next word.'};
  freshSector(s);return s;
}
export function stepSnake(previous,action){
  if(previous.session.status==='disposed')return previous;
  const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors};
  const status=s.session.status;
  if(action.type==='dispose'){reduce(s,'dispose');return s;}
  if(action.type==='speed'){if(!snakeSpeeds[action.value])return previous;s.speed=action.value;return s;}
  if(action.type==='start'&&status==='ready'){reduce(s,'start');s.message='Follow the trail. Say each collected word aloud.';return s;}
  if(action.type==='pause'){reduce(s,'pause');return s;}
  if(action.type==='resume'){reduce(s,'resume');return s;}
  if(action.type==='retry'&&status==='lost'){s.score=s.session.config.chainMode==='classic'?0:Math.max(0,s.score-s.cursor*100);reduce(s,'retry');s.motorPause=false;freshSector(s);s.message='Fresh trail. Your learning records are safe.';return s;}
  if(status!=='playing')return previous;
  if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
  if(action.type==='recover'&&s.motorPause){resetBody(s);populate(s);s.motorPause=false;s.message='A fresh safe route. Word progress and memory strikes are unchanged.';return s;}
  if(s.motorPause)return previous;
  if(action.type==='direction'){
    const delta=DIRECTIONS[action.value],current=DIRECTIONS[s.direction];
    if(!delta||s.queued||delta.x===current.x&&delta.y===current.y||delta.x===-current.x&&delta.y===-current.y)return previous;
    s.queued=action.value;return s;
  }
  if(action.type!=='tick')return previous;
  if(s.queued){s.direction=s.queued;s.queued=null;}
  const delta=DIRECTIONS[s.direction],head={x:s.body[0].x+delta.x,y:s.body[0].y+delta.y};
  const food=s.food.find(f=>cells(f).some(p=>same(p,head))),sector=s.sectors[s.session.checkpoint];
  const correct=food&&food.word.text===sector.words[s.cursor]?.text;
  const tail=correct?s.body:s.body.slice(0,-1);
  if(!inside(head)||tail.some(p=>same(p,head))){
    reduce(s,'motor-error');s.motorPause=true;s.queued=null;s.message='Wall or tail bump — no memory strike. Continue on a safe route.';return s;
  }
  s.body.unshift(head);if(!correct||s.session.config.visualWindows&&s.body.length>15)s.body.pop();s.steps++;s.elapsed+=snakeSpeeds[s.speed]/1000;
  if(s.portal&&same(s.portal,head)){
    reduce(s,'checkpoint');s.score+=200;freshSector(s);s.message='Portal crossed! A new ayah trail begins.';return s;
  }
  if(correct){
    s.captured.push(sector.words[s.cursor]);s.cursor++;s.score+=100;s.message='Correct word! Your tail grows. Repeat it aloud.';
    if(s.cursor===sector.words.length&&s.session.checkpoint===s.sectors.length-1){reduce(s,'checkpoint');s.score+=200;s.food=[];s.message='Trail complete! Recognition practice is separate from spoken recall.';return s;}
    if(!populate(s)){s.motorPause=true;reduce(s,'motor-error');s.message='Let’s open a safe route. Your words and strikes are unchanged.';}
    if(s.portal)s.message='Ayah assembled! Steer into the glowing portal to continue.';
  }else if(food){
    reduce(s,'mistake');s.message='That was not the next word. The correct word returns; keep looking.';
    if(s.session.status==='playing'&&!populate(s)){s.motorPause=true;reduce(s,'motor-error');}
  }
  // A tail can close a route even without a collision. Pause and re-home instead of trapping play.
  if(s.session.status==='playing'&&!s.motorPause){
    const goal=s.portal?[s.portal]:s.food.filter(f=>f.required).flatMap(cells),reachable=reachableCells(s,s.food.filter(f=>!f.required).flatMap(cells));
    if(!goal.some(p=>reachable.has(key(p)))){s.motorPause=true;reduce(s,'motor-error');s.message='This route is blocked. Continue on a safe route with no memory penalty.';}
  }
  return s;
}
