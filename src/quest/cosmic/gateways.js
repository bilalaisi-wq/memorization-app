import { cosmicSurahs } from './mission.js';
import { verseAudio } from '../../data.js';

export function freeAyah(ref) {
  if(typeof ref!=='string'||!/^\d+:\d+$/.test(ref))throw Error('Canonical free ayah reference required.');
  const [surah,ayah]=ref.split(':').map(Number),chapter=cosmicSurahs.find(s=>s.id===surah);
  const verse=chapter?.verses.find(v=>v.id===ayah);
  if(!verse||ref!==`${surah}:${ayah}`)throw Error('Gateway content must be Al-Fatihah or Juz Amma.');
  return {ref,surah,ayah,name:chapter.name,text:verse.text,audio:verseAudio(ayah,surah)};
}
// Equivalence only; never normalize the Arabic displayed or played to the learner.
export const comparableAyah = text => text.normalize('NFKD').replace(/[\p{M}\u0640\u06dd\u06de\u06e9]/gu,'').replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').trim();
const opening=text=>comparableAyah(text).split(' ').slice(0,3).join(' ');
function shuffle(items,seed) {
  const result=[...items];let n=seed>>>0;
  for(let i=result.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function gatewayCandidates(targetRef,seed=1) {
  const target=freeAyah(targetRef),seen=new Set([comparableAyah(target.text)]);
  const pool=cosmicSurahs.flatMap(s=>s.verses.map(v=>freeAyah(`${s.id}:${v.id}`)));
  const candidates=[target];
  // Full ayahs only; reject identical wording and repeated opening phrases.
  const ordered=[...shuffle(pool.filter(v=>v.surah===target.surah),seed),...shuffle(pool.filter(v=>v.surah!==target.surah),seed+13)];
  for(const candidate of ordered){
    const key=comparableAyah(candidate.text);
    if(seen.has(key)||candidates.some(c=>opening(c.text)===opening(candidate.text)))continue;
    candidates.push(candidate);seen.add(key);if(candidates.length===3)break;
  }
  if(candidates.length!==3)throw Error('Three unambiguous verified gateways are unavailable.');
  return shuffle(candidates,seed+47);
}
export function createGatewaySession(mission,{onEvent=()=>{}}={}) {
  const plan=mission.refs.map((ref,i)=>{
    const target=freeAyah(ref),previous=target.ayah>1?freeAyah(`${target.surah}:${target.ayah-1}`):null;
    if(i&&mission.refs[i-1]!==previous?.ref)throw Error('Gateway route must be contiguous.');
    return {id:`${mission.id}:gateway:${ref}`,target,previous,stageIndex:Math.floor(i/5),ordinal:i};
  });
  let cursor=0,state='idle',lane=1,assisted=false,attempts=0,cachedCursor=-1,cachedCandidates=[];
  const completed=[],mistakes=[];
  const current=()=>plan[cursor];
  const candidates=()=>{
    if(!current())return [];
    if(cachedCursor!==cursor){cachedCandidates=gatewayCandidates(current().target.ref,parseInt(mission.sourceHash.slice(0,8),16)+cursor);cachedCursor=cursor;}
    return cachedCandidates;
  };
  function emit(type,detail={}){const g=current();onEvent({type:`gateway:${type}`,gatewayId:g?.id,targetRef:g?.target.ref,fromRef:g?.previous?.ref||null,stageIndex:g?.stageIndex,assisted,...detail});}
  return {
    enter(stageIndex){if(state!=='idle'||!current()||current().stageIndex!==stageIndex)return false;state='prompt';lane=1;assisted=false;attempts=0;emit('orbit');return true;},
    remaining(stageIndex){return plan.slice(cursor).filter(g=>g.stageIndex===stageIndex).length;},
    dispatch(action){
      if(state==='disposed')return;
      if(action.type==='ready'&&state==='prompt'){state='choices';emit('ready',{selfReported:true});}
      if(action.type==='lane'&&state==='choices'&&[-1,1].includes(action.direction))lane=Math.max(0,Math.min(2,lane+action.direction));
      if(action.type==='select'&&state==='choices'&&Number.isInteger(action.lane)&&action.lane>=0&&action.lane<=2)lane=action.lane;
      if(action.type==='hint'&&['prompt','choices','repair'].includes(state)){assisted=true;emit('hint');}
      if(action.type==='retry'&&state==='repair'){state='prompt';emit('retry');}
      if(action.type==='choose'&&state==='choices'){
        const selected=candidates()[lane];attempts++;
        if(selected.ref!==current().target.ref){
          state='repair';const mistake={id:`${current().id}:attempt:${attempts}`,fromRef:current().previous?.ref||null,expectedRef:current().target.ref,selectedRef:selected.ref,assisted,category:'observed-gateway-selection'};
          mistakes.push(mistake);emit('mistake',{...mistake});
        }else{state='open';completed.push(current().target.ref);emit('correct',{selectedRef:selected.ref,attempts,recognitionOnly:true});}
      }
      if(action.type==='continue'&&state==='open'){emit('continue');cursor++;state='idle';}
    },
    getSnapshot(){const g=current();return structuredClone({state,lane,assisted,attempts,cursor,total:plan.length,completed,mistakes,current:g||null,candidates:state==='choices'?candidates():[],hint:assisted?g?.target:null});},
    dispose(){state='disposed';},
  };
}
