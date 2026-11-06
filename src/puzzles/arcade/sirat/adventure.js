import {seededShuffle} from '../content.js';
export const routes=Object.freeze({garden:'Guided Garden',mountain:'Mountain Challenge',star:'Star Path · optional adventure'});
export function freshAdventure(credits=0){return {route:null,echo:Math.min(3,Math.max(0,credits)),echoUsed:0,echoVisible:false,echoTarget:null,earned:[],elevatorStarted:null,finalActive:false,finalCursor:0,finalChoices:[],finalEvidence:[]};}
export function decoratePlatforms(s){
 const route=s.session.config.siratRoute||'garden',base=s.cursor*1800;
 if(!routes[route])throw Error('Unknown garden route');
 s.quest.route=route;s.quest.elevatorStarted=null;s.quest.echoVisible=false;s.quest.echoTarget=null;
 const ferry=s.platforms.find(p=>p.id==='ferry');if(route!=='garden')ferry.y=route==='mountain'?380:360;
 if(route!=='garden'&&!s.platforms.some(p=>p.optional))s.platforms.push({id:'route-overlook',x:850+base,y:340,w:100,h:20,optional:true});
 s.platforms.find(p=>p.id==='gateway').w=500;
 s.platforms.push({id:'memory-bridge',x:base+1610,y:440,w:55,h:22,memory:true,solid:false},{id:'memory-elevator',x:base+1665,y:440,w:135,h:22,memory:true,elevator:true,moving:true,solid:false});
}
export function finalUnits(s){
 const cp=s.session.checkpoint,current=s.sectors[cp].targets,previous=cp?s.sectors[cp-1].targets:[];
 return [...(current.length<3?previous.slice(-(3-current.length)):[]),...current].slice(-3);
}
export function beginFinal(s){s.quest.finalActive=true;s.quest.finalCursor=0;s.quest.finalChoices=seededShuffle(finalUnits(s).map(p=>p.id),s.session.config.seed+s.session.checkpoint+91);s.direction=0;s.jumpQueued=false;s.message='Final continuation: reconnect these studied pieces in canonical order. Take your time; this is recognition, not spoken assessment.';}
export function awardEcho(s){const receipt=`${s.sectors[s.session.checkpoint].key}:${s.cursor}`;if(!s.quest.earned.includes(receipt)){s.quest.earned.push(receipt);s.quest.echo=Math.min(3,s.quest.echo+1);}}
// Existing learning receipts supply a bounded journey loadout; no XP or FSRS writes.
export function learningEchoCredits(storage){try{const s=JSON.parse(storage.getItem('ayah-learning-v1')||'null');return s?.schemaVersion===1?Math.min(3,Object.values(s.receipts||{}).filter(r=>Number.isFinite(r?.xp)&&r.xp>0).length):0;}catch{return 0;}}
