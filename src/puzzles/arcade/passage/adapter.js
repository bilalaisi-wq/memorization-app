import {createContentAdapter,seededShuffle} from '../content.js';
import {contentView} from '../../../passage-context/model.js';
import {wordIdentity} from '../../../distractors.js';
// Grouped tokens retain exact source words/IDs. They never authorize audio cuts.
export function stageAdapter(bundle,stage,library,{audio='',memoryDifficulty='guided',seed=1}={}){
 const base=createContentAdapter(library),source=contentView(bundle,'words').map(w=>({...w,key:bundle.key,surah:bundle.surah,ayah:bundle.ayah}));
 const targets=stage.units.map(unit=>{const words=unit.positions.map(p=>source[p-1]);return {...words[0],text:words.map(w=>w.text).join(' '),transliteration:words.map(w=>w.transliteration||'').join(' '),id:words[0].id,index:words[0].index,audio,sourceWordIds:words.map(w=>w.id),sourcePositions:[...unit.positions],sourceWords:words,unitKind:unit.kind,stopApproved:unit.stopApproved,reviewId:unit.reviewId||null};});
 const words=key=>key===bundle.key?targets:base.words(key);
 return {...base,words,audio:key=>key===bundle.key?audio:base.audio(key),choices(key,{count=3,seed:choiceSeed=seed}={}){
  const target=words(key);if(key!==bundle.key)return base.choices(key,{count,seed:choiceSeed});if(!Number.isInteger(count)||count<0||count>20)throw Error('Invalid choice count.');
  const excluded=new Set(source.map(w=>wordIdentity(w.text))),seen=new Set(target.map(w=>wordIdentity(w.text))),pool=seededShuffle(library.flatMap(s=>s.verses.filter(v=>`${s.id}:${v.id}`!==key).flatMap(v=>base.words(`${s.id}:${v.id}`))),choiceSeed);
  if(memoryDifficulty==='expert'){const identity=wordIdentity(target[0].text);pool.sort((a,b)=>similarity(b.text,identity)-similarity(a.text,identity));}
  const extra=[];for(const w of pool){const id=wordIdentity(w.text);if(seen.has(id)||excluded.has(id))continue;seen.add(id);extra.push({...w,target:false});if(extra.length===count)break;}
  if(count===0)return seededShuffle(target.map(w=>({...w,target:true})),choiceSeed);
  if(extra.length!==count)throw Error('Not enough distinguishable verified distractors. Choose another available game or passage.');
  return seededShuffle([...target.map(w=>({...w,target:true})),...extra],choiceSeed);
 }};
}
const similarity=(text,target)=>[...wordIdentity(text)].filter(c=>target.includes(c)).length/Math.max(1,wordIdentity(text).length,target.length);
