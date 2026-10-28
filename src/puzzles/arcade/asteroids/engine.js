import {createSession,reduceSession} from '../session.js';
import {asteroidProfiles} from './content.js';
export const WORLD={width:1000,height:600,range:260,cone:0.65};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const reduce=(s,type,extra={})=>{s.session=reduceSession(s.session,{type,...extra});};
function fillWave(s) {
  const sector=s.sectors[s.session.checkpoint],profile=asteroidProfiles[s.difficulty];
  const needed=sector.targets[s.cursor];
  const desired=[needed,...(sector.targets[s.cursor+1]?[sector.targets[s.cursor+1]]:[]),...sector.distractors].slice(0,profile.simultaneous);
  for(const piece of desired){
    if(s.objects.some(o=>o.piece.id===piece.id))continue;
    const n=s.serial++,slots=sector.phrases?[[300,130],[700,300],[300,470]]:[[200,80],[800,150],[500,230],[200,330],[800,410]];
    const [x,y]=slots[n%slots.length];
    s.objects.push({id:`object-${n}`,piece,x,y,vx:(n%2?1:-1)*(8+n%7),vy:profile.speed,phase:n,redirected:false});
  }
}
function resetSector(s) {
  s.cursor=0;s.captured=[];s.objects=[];s.ship={x:500,y:480,angle:-Math.PI/2};s.aimId=null;s.sectorReady=false;fillWave(s);
}
export function createAsteroids({id,config,sectors,difficulty='beginner'}) {
  if(!asteroidProfiles[difficulty] || !sectors.length || sectors.map(s=>s.key).join('|')!==config.keys.join('|')) throw Error('Invalid flight configuration');
  const s={session:createSession({id,game:'asteroids',config}),sectors:structuredClone(sectors),difficulty,ship:{x:500,y:480,angle:-Math.PI/2},objects:[],cursor:0,captured:[],serial:0,elapsed:0,pulse:0,beam:0,message:'Press Start flight. Move, aim, then capture.',aimId:null,sectorReady:false,assistedNavigation:false};
  resetSector(s);return s;
}
export function aimedObject(s) {
  return s.objects.filter(o=>!o.redirected && (!s.aimId || o.id===s.aimId)).map(o=>({o,d:Math.hypot(o.x-s.ship.x,o.y-s.ship.y),a:Math.abs(angleDifference(Math.atan2(o.y-s.ship.y,o.x-s.ship.x),s.ship.angle))})).filter(p=>p.d<=WORLD.range && p.a<=WORLD.cone).sort((a,b)=>a.a-b.a||a.d-b.d)[0]?.o??null;
}
export function stepAsteroids(previous,action) {
  if(previous.session.status==='disposed')return previous;
  const s={...structuredClone({...previous,sectors:undefined}),sectors:previous.sectors},status=s.session.status;
  if(action.type==='dispose'){reduce(s,'dispose');return s;}
  if(action.type==='start'&&status==='ready'){reduce(s,'start');s.message='Flight started. The next required piece always returns.';return s;}
  if(action.type==='pause'){reduce(s,'pause');return s;}
  if(action.type==='resume'){reduce(s,'resume');return s;}
  if(action.type==='retry'&&status==='lost'){reduce(s,'retry');resetSector(s);s.message='Fresh flight. Your saved progress is safe.';return s;}
  if(status!=='playing')return previous;
  if(action.type==='assist'){reduce(s,'assist',{kind:action.kind});return s;}
  if(action.type==='next-sector'&&s.sectorReady){s.sectorReady=false;reduce(s,'checkpoint');if(s.session.status==='playing')resetSector(s);return s;}
  if(s.sectorReady)return previous;
  if(action.type==='aim'){
    if(!Number.isFinite(action.x)||!Number.isFinite(action.y))return previous;
    s.ship.angle=Math.atan2(action.y-s.ship.y,action.x-s.ship.x);s.aimId=action.id??null;
  }else if(action.type==='navigate'){
    s.assistedNavigation=!s.assistedNavigation;reduce(s,'assist',{kind:'hint'});s.message=s.assistedNavigation?'Navigation assist on: aim at an object to approach it.':'Manual flight on.';
  }else if(action.type==='move-to'){
    if(!Number.isFinite(action.x)||!Number.isFinite(action.y))return previous;
    s.ship.x=clamp(action.x,110,890);s.ship.y=clamp(action.y,55,550);
  }else if(action.type==='capture'){
    const object=aimedObject(s);
    s.beam=0.3;
    if(!object){s.message='No piece in tractor range. Move closer and aim. No strike.';reduce(s,'motor-error');return s;}
    const sector=s.sectors[s.session.checkpoint],expected=sector.targets[s.cursor];
    // Identical source wording is interchangeable; accepted display always uses the canonical occurrence.
    const text=piece=>piece.words.map(w=>w.text).join(' ');
    if(text(object.piece)===text(expected)){
      s.captured.push(...expected.words);s.cursor++;
      s.objects=s.objects.filter(o=>o.id!==object.id);
      s.message='Captured in order — say the words aloud!';
      if(s.cursor===sector.targets.length){s.sectorReady=true;s.objects=[];s.message='Sector complete. Ready for the next ayah?';if(s.session.checkpoint===s.sectors.length-1){reduce(s,'checkpoint');s.sectorReady=false;s.message='Journey complete! Recognition practice, not independent recall.';}}
      else fillWave(s);
    }else{
      object.redirected=true;object.vx=object.x<500?-260:260;object.vy=-80;
      reduce(s,'mistake');s.message='That is not the next piece. It has been redirected. Try again.';
    }
    s.aimId=null;
  }else if(action.type==='shield'){
    s.pulse=0.65;let deflected=0;
    for(const object of s.objects){if(Math.hypot(object.x-s.ship.x,object.y-s.ship.y)<330){object.redirected=true;object.vx=object.x<s.ship.x?-260:260;object.vy=-100;deflected++;}}
    s.aimId=null;s.message=deflected?'Shield redirected nearby pieces. Required pieces will return.':'Shield pulse ready — move near incoming objects.';
  }else if(action.type==='tick'){
    // A background-tab/lag frame never advances gameplay. No collision/missed-object strikes.
    if(!Number.isFinite(action.dt)||action.dt<=0||action.dt>0.15)return previous;
    const dt=action.dt;s.elapsed+=dt;s.pulse=Math.max(0,s.pulse-dt);s.beam=Math.max(0,s.beam-dt);
    const dx=clamp(action.dx||0,-1,1),dy=clamp(action.dy||0,-1,1),length=Math.max(1,Math.hypot(dx,dy));
    s.ship.x=clamp(s.ship.x+dx/length*245*dt,110,890);s.ship.y=clamp(s.ship.y+dy/length*245*dt,55,550);
    if(action.turn)s.aimId=null;
    s.ship.angle+=(action.turn||0)*2.2*dt;
    for(const o of s.objects){o.x+=o.vx*dt;o.y+=o.vy*dt;if(!o.redirected&&(o.x<(s.sectors[s.session.checkpoint].phrases?290:180)||o.x>(s.sectors[s.session.checkpoint].phrases?710:820)))o.vx*=-1;}
    s.objects=s.objects.filter(o=>o.y<660&&o.y>-150&&o.x>-200&&o.x<1200);
    const target=s.objects.find(o=>o.id===s.aimId&&!o.redirected);
    if(target){s.ship.angle=Math.atan2(target.y-s.ship.y,target.x-s.ship.x);if(s.assistedNavigation){const distance=Math.hypot(target.x-s.ship.x,target.y-s.ship.y);if(distance>150){s.ship.x=clamp(s.ship.x+(target.x-s.ship.x)/distance*180*dt,110,890);s.ship.y=clamp(s.ship.y+(target.y-s.ship.y)/distance*180*dt,55,550);}}}
    fillWave(s);
  }else return previous;
  return s;
}
