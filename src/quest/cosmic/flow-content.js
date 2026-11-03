import {cosmicSurahs} from './mission.js';
import {freeAyah,comparableAyah} from './gateways.js';
import {createContentAdapter,seededShuffle} from '../../puzzles/arcade/content.js';
const adapter=createContentAdapter(cosmicSurahs);
let wordPool,ayahPool;
export function createFlowUnits(refs,mode='mixed') {
  if(!['words','ayahs','mixed'].includes(mode)||!refs.length)throw Error('Choose a supported pickup style.');
  return refs.flatMap(ref=>{
    const ayah=freeAyah(ref),words=adapter.words(ref);
    if(mode==='ayahs'||mode==='mixed'&&words.length<=4)return [{id:`ayah:${ref}`,key:ref,text:ayah.text,audio:ayah.audio,kind:'ayah',index:0,last:true}];
    return words.map((w,i)=>({...w,kind:'word',last:i===words.length-1}));
  });
}
export function flowChoices(unit,seed) {
  const source=freeAyah(unit.key);
  const canonical=unit.kind==='word'?adapter.words(unit.key).find(w=>w.id===unit.id):{id:`ayah:${unit.key}`,text:source.text};
  if(!canonical||canonical.id!==unit.id||canonical.text!==unit.text)throw Error('Pickup must preserve verified source wording.');
  const pool=unit.kind==='word'
    ?(wordPool||=cosmicSurahs.flatMap(s=>s.verses.flatMap(v=>adapter.words(`${s.id}:${v.id}`).map(w=>({...w,kind:'word'})))))
    :(ayahPool||=cosmicSurahs.flatMap(s=>s.verses.map(v=>{const a=freeAyah(`${s.id}:${v.id}`);return {id:`ayah:${a.ref}`,key:a.ref,text:a.text,audio:a.audio,kind:'ayah'};})));
  const seen=new Set([comparableAyah(unit.text)]),chosen=[unit];
  const length=unit.text.split(/\s+/).length;
  const eligible=unit.kind==='word'?pool:pool.filter(c=>Math.abs(c.text.split(/\s+/).length-length)<=Math.max(3,Math.ceil(length*.5)));
  for(const candidate of seededShuffle(eligible,seed)) {
    const identity=comparableAyah(candidate.text);
    if(seen.has(identity))continue;
    chosen.push(candidate);seen.add(identity);if(chosen.length===3)break;
  }
  if(chosen.length!==3)throw Error('Distinct authentic pickups are unavailable.');
  return seededShuffle(chosen,seed+29);
}
