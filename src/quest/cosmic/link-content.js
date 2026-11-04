import {localBundle,loadBundle} from '../../content/library.js';
import {validatePartition} from '../../../supabase/functions/_shared/segmentation.js';
import {sha256} from '../../../supabase/functions/_shared/content-policy.js';
import {freeAyah,comparableAyah,gatewayCandidates} from './gateways.js';
import {createFlowUnits,flowChoices} from './flow-content.js';
import {seededShuffle} from '../../puzzles/arcade/content.js';
const trusted=new WeakSet();
function linkSpans(bundle){
  const normal=t=>t.replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g,'');
  const spans=[];let word=0;
  for(const token of bundle.textUthmani.matchAll(/\S+/g)){
    if(!normal(token[0])){if(spans.length)spans.at(-1).end=token.index+token[0].length;continue;}
    if(normal(token[0])!==normal(bundle.words[word]?.text||''))throw Error('Canonical Link words do not align.');
    spans.push({position:++word,start:token.index,end:token.index+token[0].length});
  }
  if(word!==bundle.words.length)throw Error('Canonical Link word count mismatch.');return spans;
}
function linkSlice(bundle,first,last){const spans=linkSpans(bundle);return bundle.textUthmani.slice(first===1?0:spans[first-1].start,last===bundle.words.length?bundle.textUthmani.length:spans[last-1].end);}
export function canonicalLinkAyah(ref){const ayah=freeAyah(ref),bundle=localBundle(ref);return {...ayah,words:bundle.words,spans:linkSpans(bundle)};}
export const firstGrapheme=text=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ar',{granularity:'grapheme'}).segment(text)][0].segment:Array.from(text)[0];
export function pairReference(fromRef,toRef){
  const next=freeAyah(toRef);if(fromRef===null)return {fromRef:null,toRef,pairKey:null};
  const previous=freeAyah(fromRef);if(previous.surah!==next.surah||previous.ayah+1!==next.ayah)throw Error('Link requires consecutive canonical ayahs.');
  return {fromRef,toRef,pairKey:`${fromRef}>${toRef}`};
}
export const pairFingerprint=async(fromRef,toRef)=>{pairReference(fromRef,toRef);return sha256(JSON.stringify([fromRef,fromRef?freeAyah(fromRef).text:null,toRef,freeAyah(toRef).text]));};
export function openingChoices(ref,seed=1){return flowChoices(createFlowUnits([ref],'words')[0],seed);}
export async function reactorPlan(ref,bundle=localBundle(ref)){
  const canonical=localBundle(ref);freeAyah(ref);
  if(!canonical||bundle.key!==ref||bundle.textUthmani!==canonical.textUthmani||bundle.words?.length!==canonical.words.length||bundle.words.some((w,i)=>w.position!==i+1||w.text!==canonical.words[i].text))throw Error('Reactor source differs from verified Uthmani text.');
  const revision=await sha256(JSON.stringify({key:ref,text:canonical.textUthmani,words:canonical.words.map(w=>w.text)}));
  let ranges=null,reason=canonical.words.length<=6?'Short ayah: whole-ayah practice.':'No complete approved visual phrase partition is available. Use the whole ayah.';
  const review=bundle.segmentationReview;
  if(canonical.words.length>6&&review){
    try{
      if(review.verseKey!==ref||review.sourceHash!==revision||!Number.isInteger(review.version)||review.version<1||!review.reviewerName||!Number.isFinite(Date.parse(review.reviewedAt))||!review.sourceEdition||!review.riwayah)throw Error('Review source/provenance is unverified.');
      validatePartition(review.segments,canonical.words.length);
      if(review.segments.some(s=>s.displayStatus!=='approved'))throw Error('Visual phrase partition has pending or rejected boundaries.');
      ranges=review.segments.map(s=>({first:s.startWord,last:s.endWord}));reason=`Published visual review ${review.version} · ${review.reviewerName}. Grouping does not certify recitation stops.`;
    }catch{reason='Review is incomplete, outdated or unapproved. Whole-ayah fallback is active.';}
  }
  const groups=ranges?ranges.map((r,i)=>({id:`phrase:${ref}:${review.version}:${r.first}-${r.last}`,reference:ref,firstWord:r.first,lastWord:r.last,text:linkSlice(canonical,r.first,r.last),index:i,reviewVersion:review.version})):[{id:`whole:${ref}`,reference:ref,firstWord:1,lastWord:canonical.words.length,text:canonical.textUthmani,index:0}];
  const plan=Object.freeze({ref,revision,kind:ranges?'reviewed-phrases':'whole-ayah',reason,groups:Object.freeze(groups.map(Object.freeze))});trusted.add(plan);return plan;
}
export function verifiedReactorPlan(ref,plan){if(!trusted.has(plan)||plan.ref!==ref)throw Error('Use a verified published reactor plan.');return plan;}
export async function prepareLinkPlans(refs,client){
  const plans={};for(let i=0;i<refs.length;i+=4)await Promise.all(refs.slice(i,i+4).map(async ref=>{
    freeAyah(ref);let bundle=localBundle(ref);
    if(bundle.words.length>6&&client){try{bundle=await loadBundle(ref,client);}catch{/* A source/network failure cannot authorize segmentation. */}}
    try{plans[ref]=await reactorPlan(ref,bundle);}catch{plans[ref]=await reactorPlan(ref);}
  }));return plans;
}
export function reactorTiles(plan,seed){
  verifiedReactorPlan(plan.ref,plan);const tiles=plan.groups.map(g=>({...g,target:true})),seen=new Set(tiles.map(t=>comparableAyah(t.text)));
  for(const ayah of gatewayCandidates(plan.ref,seed)){
    if(ayah.ref===plan.ref||seen.has(comparableAyah(ayah.text)))continue;
    seen.add(comparableAyah(ayah.text));tiles.push({id:`distractor:${ayah.ref}`,reference:ayah.ref,text:ayah.text,target:false});
  }
  const shuffled=seededShuffle(tiles,seed+71);if(shuffled.length>1&&shuffled.every((t,i)=>t.id===tiles[i]?.id))shuffled.push(shuffled.shift());return shuffled;
}
