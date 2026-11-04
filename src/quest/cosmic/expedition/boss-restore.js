import {canonicalLinkAyah} from '../link-content.js';
import {bossQuestions} from './boss.js';
const kinds=new Set(['next','connection','missing','repair','opening','multi']);
export const bossBlueprint=questions=>questions.map(q=>({id:q.id,kind:q.kind,refs:q.refs,previous:q.previous,response:q.response,label:q.label,reason:q.reason,evidenceIds:q.evidenceIds,reviewRevision:q.reviewRevision||null,reviewVersion:q.reviewVersion||null}));
// Persist references and task contracts, never Arabic. Changed review approval can
// downgrade a pending repair to opening recall, never authorize old segmentation.
export async function restoreBossQuestions(mission,stageIndex,plans,blueprint){
  const stage=mission.stages[stageIndex];
  if(!stage||!Array.isArray(blueprint)||blueprint.length<2||blueprint.length>5||new Set(blueprint.map(q=>q.id)).size!==blueprint.length)throw Error('Saved boss blueprint needs recovery.');
  const restored=[];
  for(const pin of blueprint){
    if(!kinds.has(pin.kind)||!Array.isArray(pin.refs)||!pin.refs.length||pin.id!==`${stage.id}:boss:${pin.kind}:${pin.refs.join('|')}`)throw Error('Invalid saved boss reference.');
    const target=pin.kind==='connection'?pin.refs.at(-1):pin.refs[0];if(!stage.refs.includes(target))throw Error('Saved boss is outside this stage.');
    const pool=await bossQuestions(mission,stageIndex,plans,[],{targetRef:target,repairRef:pin.kind==='repair'?target:null,extended:pin.response==='typed-ayah'});
    let q=pool.find(q=>q.kind===pin.kind&&JSON.stringify(q.refs)===JSON.stringify(pin.refs));
    if(pin.kind==='repair'&&(!q||q.reviewRevision!==pin.reviewRevision||q.reviewVersion!==pin.reviewVersion)){
      q=pool.find(q=>q.kind==='opening');
      if(!q)q={kind:'opening',refs:[target],previous:pin.previous,choices:[],answer:canonicalLinkAyah(target).words[0].text};
      q={...q,previous:pin.previous,fallbackFrom:'repair',reason:'The original visual review is unavailable or changed. Use whole-ayah opening recall instead; no unapproved phrase boundary is used.'};
    }
    if(!q||q.previous!==pin.previous)throw Error('Saved boss content changed. Earlier shields remain saved for recovery.');
    restored.push({...q,id:pin.id,label:pin.label,reason:q.fallbackFrom?q.reason:pin.reason,evidenceIds:pin.evidenceIds||[]});
  }
  return restored;
}
