import {seededShuffle} from '../content.js';
import {wordIdentity} from '../../../distractors.js';
import {selectionEvidence} from '../evidence.js';
export const keyTypes=['recognition','continuation','connection'];
export const sameCell=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
const identity=p=>p.words.map(w=>wordIdentity(w.text)).join(' ');
export function freshQuest(){return {keys:[],crystalCollected:false,crystalVisible:false,challenge:null,switchOpened:false,corrections:[],evidence:[],transitionCoverage:[]};}
export function decorateMaze(s){
 const m=s.layout,available=[];
 for(let y=1;y<m.width-1;y++)for(let x=1;x<m.width-1;x++)if(m.cells[y][x]&&!sameCell({x,y},m.start)&&!sameCell({x,y},m.station))available.push({x,y});
 const cells=seededShuffle(available,s.session.config.seed+s.session.checkpoint*997+s.cursor*37);
 const names=['crystal',...keyTypes,'correction','switch','landmark'];m.rooms=Object.fromEntries(names.map((k,i)=>[k,cells[i]]));
 const shortcuts=[];for(let y=1;y<m.width-1;y++)for(let x=1;x<m.width-1;x++)if(!m.cells[y][x]&&((m.cells[y][x-1]&&m.cells[y][x+1])||(m.cells[y-1]?.[x]&&m.cells[y+1]?.[x])))shortcuts.push({x,y});
 m.secret=seededShuffle(shortcuts,s.session.config.seed+s.cursor)[0]||null;
 s.quest.switchOpened=false;
}
export function currentRoom(s){return Object.entries(s.layout.rooms||{}).find(([,p])=>sameCell(p,s.player))?.[0]||null;}
export function quiz(s,kind=s.quest.challenge){
 const sector=s.chambers[s.session.checkpoint],next=s.chambers[s.session.checkpoint+1];let answer,context=[],prompt;
 if(kind==='boundary'){
  if(!next)return null;answer=next.targets[0];context=sector.words.slice(-1);prompt=`Connect ${sector.key} → ${next.key}: which opening comes next?`;
 }else if(kind==='correction'){
  const item=s.quest.corrections[0];if(!item)return null;answer=sector.targets[item.index];context=item.cue==='recognition'?sector.words.slice(-1):sector.targets[Math.max(0,item.index-1)].words;prompt=`Correction room · ${item.cue==='recognition'?'connection':'recognition'} cue. Find the same verified continuation (${sector.key}, piece ${item.index+1}).`;
 }else if(kind==='recognition'){answer=sector.targets[0];prompt='Recognition key · Which verified source piece did your crystal reveal?';}
 else if(kind==='continuation'){answer=sector.targets[Math.min(1,sector.targets.length-1)];context=sector.targets.length>1?sector.targets[0].words:sector.words.slice(-1);prompt=sector.targets.length>1?'Continuation key · What follows this source piece?':'Continuation key · Which complete source unit contains this ending?';}
 else if(kind==='connection'){
  const previous=s.chambers[s.session.checkpoint-1];
  if(previous){answer=sector.targets[0];context=previous.words.slice(-1);prompt=`Connection key · ${previous.key} → ${sector.key}: recall this ayah’s opening.`;}
  else if(sector.targets.length>1){answer=sector.targets.at(-1);context=sector.targets.at(-2).words;prompt='Connection key · Join the ending pieces to complete this ayah.';}
  else{answer=sector.targets[0];context=sector.words.slice(-1);prompt='Connection key · Link this ending to its complete verified source unit.';}
 }else return null;
 const seen=new Set([identity(answer)]),extras=[];
 for(const c of [...(kind==='boundary'?next.distractors:sector.distractors),...sector.targets]){const value=identity(c);if(!seen.has(value)){seen.add(value);extras.push(c);}if(extras.length===(s.difficulty==='beginner'?1:2))break;}
 if(!extras.length)throw Error('No unambiguous verified room alternatives');
 return {kind,prompt,answer,context,choices:seededShuffle([answer,...extras],s.session.config.seed+s.session.checkpoint*31+[...kind].reduce((n,c)=>n+c.charCodeAt(0),0))};
}
export function queueCorrection(s,index,cue,event){
 if(s.session.config.correctionRooms===false||s.quest.corrections.some(c=>c.index===index))return;
 s.quest.corrections.push({index,cue,event});s.quest.corrections=s.quest.corrections.slice(-6);
}
export function afterMove(s){
 const room=currentRoom(s);
 if(room==='crystal'&&!s.quest.crystalCollected){s.quest.crystalCollected=true;s.quest.crystalVisible=true;s.message='Memory crystal found. Remember its verified wording for a later room. Conceal it when ready; there is no response timer.';}
 else if(room)s.message=room==='landmark'?'Moon Garden landmark. The numbered doors lie beyond the southern listening station.':`You reached the ${room} room. Press E or Interact.`;
}
export function interact(s){
 const room=currentRoom(s);if(!room){s.message='Walk onto a crystal, key room, switch or landmark to interact.';return;}
 if(room==='crystal'){if(s.quest.crystalCollected)s.quest.crystalVisible=true;return;}
 if(room==='switch'){if(s.layout.secret&&!s.quest.switchOpened){s.layout.cells[s.layout.secret.y][s.layout.secret.x]=1;s.quest.switchOpened=true;s.message='A secret shortcut opens. All required rooms remain reachable without it.';}else s.message='The shortcut is already open. It is optional.';return;}
 if(room==='landmark'){s.message='Moon Garden: use coordinates and the listening station to navigate. Secret shortcuts never require trivia.';return;}
 if(room==='correction'&&!s.quest.corrections.length){s.message='This optional room is ready if a genuine Arabic mistake needs another cue.';return;}
 if(keyTypes.includes(room)&&s.quest.keys.includes(room)){s.message='This memory key is already earned. Your progress is safe.';return;}
 if(keyTypes.includes(room)&&!s.quest.crystalCollected){s.message='Find the ◆ crystal first, then return to the key rooms.';return;}
 if(keyTypes.includes(room)&&s.quest.crystalVisible){s.message='Conceal the crystal first, or let its brief reveal finish. No time pressure.';return;}
 s.quest.challenge=room;s.message=quiz(s)?.prompt||s.message;
}
export function answerQuiz(s,index,reduce){
 const q=quiz(s),choice=q?.choices[index];if(!q||!Number.isInteger(index)||!choice)return false;
 const correct=identity(choice)===identity(q.answer);
 s.quest.evidence.push({kind:q.kind,key:s.chambers[s.session.checkpoint].key,expected:q.answer.words.flatMap(w=>w.sourceWordIds||[w.id]),selected:choice.words.flatMap(w=>w.sourceWordIds||[w.id]),correct,event:s.session.events});
 if(!correct){reduce(s,'mistake',selectionEvidence(choice,q.answer));if(q.kind!=='correction'&&q.kind!=='boundary'){const target=s.chambers[s.session.checkpoint].targets.findIndex(t=>t.id===q.answer.id);queueCorrection(s,Math.max(0,target),q.kind,s.session.events);}s.message='That wording belongs elsewhere. One Arabic-memory strike. Try again, listen or return to exploration.';return false;}
 if(keyTypes.includes(q.kind))s.quest.keys.push(q.kind);
 if(q.kind==='correction')s.quest.corrections.shift();
 s.quest.challenge=null;s.message=q.kind==='correction'?'The same passage connected with a different cue. Corrective practice is not an FSRS review.':'Memory key earned. Keep exploring; arcade recognition is not independently assessed recitation.';return true;
}
