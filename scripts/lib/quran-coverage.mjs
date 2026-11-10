// Phase-1 audit only: canonical IDs and metadata; never generates or repairs Quran text.
import {createHash} from 'node:crypto';
export const sha256=raw=>createHash('sha256').update(raw).digest('hex');
export const canonicalCompare=t=>t.normalize('NFD').replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g,'');
export function canonicalReferences(catalog){
 if(catalog?.schemaVersion!==1||catalog.chapters?.length!==114||catalog.juzs?.length!==30)throw Error('Expected the existing 114-surah / 30-juz catalog');
 const refs=new Map(),juzRefs=new Map();
 for(const [i,c] of catalog.chapters.entries()){
  if(c.id!==i+1||!Number.isInteger(c.verseCount)||c.verseCount<1||!Array.isArray(c.ranges))throw Error('Invalid chapter identity/count');
  let next=1;
  for(const r of c.ranges){if(!Number.isInteger(r.first)||!Number.isInteger(r.last)||r.first!==next||r.last<r.first||r.last>c.verseCount||!Number.isInteger(r.juz)||r.juz<1||r.juz>30)throw Error('Chapter range gap/overlap');
   for(let a=r.first;a<=r.last;a++)refs.set(`${c.id}:${a}`,{key:`${c.id}:${a}`,surah:c.id,ayah:a,juz:r.juz});next=r.last+1;}
  if(next!==c.verseCount+1)throw Error('Incomplete chapter coverage');
 }
 for(const [i,j] of catalog.juzs.entries()){
  if(j.id!==i+1||!Number.isInteger(j.verseCount)||!Array.isArray(j.ranges))throw Error('Invalid juz identity');
  const keys=[];
  for(const r of j.ranges){if(!Number.isInteger(r.surah)||!Number.isInteger(r.first)||!Number.isInteger(r.last)||r.last<r.first)throw Error('Invalid juz range');
   for(let a=r.first;a<=r.last;a++){const key=`${r.surah}:${a}`;if(!refs.has(key)||refs.get(key).juz!==j.id||juzRefs.has(key))throw Error('Juz duplicate/boundary mismatch');keys.push(key);juzRefs.set(key,j.id);}}
  if(keys.length!==j.verseCount)throw Error('Juz count mismatch');
 }
 if(refs.size!==6236||juzRefs.size!==6236)throw Error('Expected 6236 unique canonical references');
 const canonical=[...refs.keys()],fromJuz=catalog.juzs.flatMap(j=>j.ranges.flatMap(r=>Array.from({length:r.last-r.first+1},(_,i)=>`${r.surah}:${r.first+i}`)));
 if(JSON.stringify(canonical)!==JSON.stringify(fromJuz))throw Error('Juz ordering disagrees with canonical order');
 return [...refs.values()];
}
export function uniqueEntries(rows,refs,label){
 const valid=new Set(refs.map(r=>r.key)),seen=new Map();
 for(const row of rows){if(!valid.has(row.key))throw Error(`${label}: noncanonical reference`);if(seen.has(row.key))throw Error(`${label}: duplicate reference ${row.key}`);seen.set(row.key,row);}
 return seen;
}
export function auditOverlap(publicRows,privateRows){const free=new Set(publicRows.map(r=>r.key));return privateRows.filter(r=>free.has(r.key)).map(r=>({key:r.key,kind:'public-private-overlap',sameContent:r.contentHash===publicRows.find(p=>p.key===r.key).contentHash}));}
export function summarizeJuz(catalog,verses){return catalog.juzs.map(j=>{
 const rows=verses.filter(v=>v.juz===j.id),counts={expected:j.verseCount,local:0,validated:0,free:0,developer:0,premiumPilot:0,missing:0};
 for(const v of rows){if(v.stages.downloaded)counts.local++;else counts.missing++;if(v.stages.validated)counts.validated++;if(v.policy==='free')counts.free++;if(v.policy==='developer-preview')counts.developer++;if(v.policy==='private-pilot')counts.premiumPilot++;}
 return {juz:j.id,first:rows[0].key,last:rows.at(-1).key,ranges:j.ranges,...counts,
  reviewed:'not-attested',deployed:'not-verified',publiclyAvailable:'not-verified',
  releaseStatus:counts.missing?'incomplete':counts.validated!==counts.expected?'local-validation-failed':j.id===30?'existing-free-bundle; release-evidence-gaps':'locally-prepared; not-release-approved',
  releaseBlockers:[...(counts.missing?['missing-required-assets']:[]),...(counts.validated!==counts.local?['local-validation-errors']:[]),'rights-evidence-not-documented','editorial-review-not-attested','deployment-not-verified']};
 });}
export function assertAuditMetadata(value){
 // Metadata outputs may contain IDs/hashes/provider attributions, never private payloads.
 const banned=new Set(['textUthmani','text_uthmani','translationSource','audioSource','audioAssets','access_token','refresh_token','service_role','text','words']);
 const walk=v=>{if(Array.isArray(v))return v.forEach(walk);if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(banned.has(k))throw Error('Private payload field in audit: '+k);walk(x);}};walk(value);return value;
}
