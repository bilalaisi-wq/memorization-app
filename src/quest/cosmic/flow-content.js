import {cosmicSurahs} from './mission.js';
import {freeAyah,comparableAyah} from './gateways.js';
import {createContentAdapter,seededShuffle} from '../../puzzles/arcade/content.js';
const adapter=createContentAdapter(cosmicSurahs);
let wordPool,ayahPool,chunkPool;
export const MIX_WEIGHTS=Object.freeze({chunk:5,ayah:1,word:4});
function chunk(ref,start,end) {
  const words=adapter.words(ref);
  return {id:`chunk:${ref}:${start}-${end}`,key:ref,text:words.slice(start,end).map(w=>w.text).join(' '),kind:'chunk',index:start,endIndex:end,last:end===words.length};
}
export function createFlowUnits(refs,mode='mixed',mixOffset=0) {
  if(!['words','ayahs','mixed'].includes(mode)||!refs.length)throw Error('Choose a supported pickup style.');
  // Deficit-balanced mix: carry unavailable whole-ayah slots to the next ayah.
  // Chunks are contiguous visual groups only, never certified recitation stops.
  const counts={chunk:0,ayah:0,word:0};let total=0;
  if(!Number.isInteger(mixOffset)||mixOffset<0||mixOffset>9)throw Error('Invalid mix offset.');
  const deficit=(a,b)=>(MIX_WEIGHTS[b]*(total+1)-counts[b]*10)-(MIX_WEIGHTS[a]*(total+1)-counts[a]*10);
  // Shift the balancing phase between revision rounds, including one-ayah sets.
  for(;total<mixOffset;total++)counts[Object.keys(counts).sort(deficit)[0]]++;
  return refs.flatMap(ref=>{
    const ayah=freeAyah(ref),words=adapter.words(ref),result=[];
    for(let index=0;index<words.length;){
      const eligible=mode==='ayahs'?['ayah']:mode==='words'?['word']:
        ['chunk','ayah','word'].filter(kind=>kind==='word'||kind==='ayah'&&index===0||kind==='chunk'&&words.length-index>=2);
      const kind=eligible.sort(deficit)[0];
      let unit;
      if(kind==='ayah'){unit={id:`ayah:${ref}`,key:ref,text:ayah.text,audio:ayah.audio,kind,index:0,last:true};index=words.length;}
      else if(kind==='chunk'){const size=Math.min(words.length-index,counts.chunk%2?3:2);unit=chunk(ref,index,index+size);index+=size;}
      else {unit={...words[index],kind:'word',last:index===words.length-1};index++;}
      counts[kind]++;total++;result.push(unit);
    }
    return result;
  });
}
export function flowChoices(unit,seed) {
  const source=freeAyah(unit.key);
  const canonical=unit.kind==='word'?adapter.words(unit.key).find(w=>w.id===unit.id):unit.kind==='chunk'?
    (Number.isInteger(unit.index)&&Number.isInteger(unit.endIndex)&&unit.index>=0&&unit.endIndex<=adapter.words(unit.key).length&&[2,3].includes(unit.endIndex-unit.index)?chunk(unit.key,unit.index,unit.endIndex):null):unit.kind==='ayah'?{id:`ayah:${unit.key}`,text:source.text}:null;
  if(!canonical||canonical.id!==unit.id||canonical.text!==unit.text)throw Error('Pickup must preserve verified source wording.');
  const pool=unit.kind==='chunk'
    ?(chunkPool||=cosmicSurahs.flatMap(s=>s.verses.flatMap(v=>{const ref=`${s.id}:${v.id}`;return v.words.flatMap((_,i)=>[2,3].filter(n=>i+n<=v.words.length).map(n=>chunk(ref,i,i+n)));})))
    :unit.kind==='word'
    ?(wordPool||=cosmicSurahs.flatMap(s=>s.verses.flatMap(v=>adapter.words(`${s.id}:${v.id}`).map(w=>({...w,kind:'word'})))))
    :(ayahPool||=cosmicSurahs.flatMap(s=>s.verses.map(v=>{const a=freeAyah(`${s.id}:${v.id}`);return {id:`ayah:${a.ref}`,key:a.ref,text:a.text,audio:a.audio,kind:'ayah'};})));
  const seen=new Set([comparableAyah(unit.text)]),chosen=[unit];
  const length=unit.text.split(/\s+/).length;
  const eligible=unit.kind!=='ayah'?pool:pool.filter(c=>Math.abs(c.text.split(/\s+/).length-length)<=Math.max(3,Math.ceil(length*.5)));
  for(const candidate of seededShuffle(eligible,seed)) {
    const identity=comparableAyah(candidate.text);
    if(seen.has(identity))continue;
    chosen.push(candidate);seen.add(identity);if(chosen.length===3)break;
  }
  if(chosen.length!==3)throw Error('Distinct authentic pickups are unavailable.');
  return seededShuffle(chosen,seed+29);
}

// Read only the existing source transliteration at the same canonical positions.
export function flowTransliteration(unit){
 const a=freeAyah(unit.key),v=cosmicSurahs.find(s=>s.id===a.surah).verses.find(v=>v.id===a.ayah);
 const first=unit.kind==='ayah'?0:unit.index;
 const last=unit.kind==='ayah'?v.words.length:unit.kind==='chunk'?unit.endIndex:first+1;
 return v.roman.slice(first,last).join(' ');
}
