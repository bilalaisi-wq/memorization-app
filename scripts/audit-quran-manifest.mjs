// Offline Phase-1 inventory only. Never invokes the importer, network, storage or database.
import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localBundle} from '../src/content/library.js';
import {surahs} from '../src/data.js';
import {validateBundle} from '../supabase/functions/_shared/content-policy.js';
import {contentFingerprint} from '../supabase/functions/_shared/provider-content.js';
import {canonicalReferences,uniqueEntries,auditOverlap,summarizeJuz,sha256,canonicalCompare,assertAuditMetadata} from './lib/quran-coverage.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REQUIRED=['arabic','wordPositions','translation','transliteration','wordMeanings','fullAyahAudio'];
const SOURCES={arabic:'quran-com-uthmani',wordPositions:'quran-com-uthmani',translation:'saheeh-international-20',transliteration:'quran-com-word-aids',wordMeanings:'quran-com-word-aids',fullAyahAudio:'alafasy-full-ayah',wordAudio:'quran-com-word-audio'};
const file=async p=>{try{return await readFile(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const json=async p=>{const b=await file(p);return b===null?null:JSON.parse(b.toString());};
const isMP3=b=>!!b&&b.length>100&&(b.subarray(0,3).toString()==='ID3'||b[0]===255&&(b[1]&224)===224);
export async function auditQuran({privateRoot=resolve(ROOT,'.quran-private')}={}){
 const protectedNames=['src/data.js','src/additional-surahs.json','public/quran-source.json','public/additional-quran-source.json','supabase/functions/_shared/quran-catalog.json','supabase/functions/_shared/content-availability.json','supabase/functions/_shared/provider-content.js','public/fonts/UthmanicHafs.woff2'];
 const inputPins=Object.fromEntries(await Promise.all(protectedNames.map(async p=>[p,sha256(await readFile(resolve(ROOT,p)))])));
 const catalog=await json(resolve(ROOT,'supabase/functions/_shared/quran-catalog.json')),availability=await json(resolve(ROOT,'supabase/functions/_shared/content-availability.json')),provenance=await json(resolve(ROOT,'content-audit/sources.json'));
 inputPins['content-audit/sources.json']=sha256(await readFile(resolve(ROOT,'content-audit/sources.json')));
 const refs=canonicalReferences(catalog),free=uniqueEntries(surahs.flatMap(s=>s.verses.map(v=>({key:`${s.id}:${v.id}`,v}))),refs,'public library'),premium=uniqueEntries(availability.premium,refs,'availability');
 for(const e of availability.premium)if(!/^[a-f0-9]{64}$/.test(e.sha256)||!/^[a-f0-9]{64}$/.test(e.audioSha256)||e.contentSha256!==undefined&&!/^[a-f0-9]{64}$/.test(e.contentSha256)||!Number.isInteger(e.wordCount)||e.wordCount<1)throw Error('Invalid existing availability pin metadata');
 const localManifestRaw=await file(resolve(privateRoot,'manifest.json'));let localRows=[];const issues=[];
 if(localManifestRaw){inputPins['private-manifest-snapshot']=sha256(localManifestRaw);try{const d=JSON.parse(localManifestRaw);if(d.schemaVersion!==1||!Array.isArray(d.verses))throw Error();localRows=d.verses;}catch{issues.push({kind:'invalid-private-manifest'});}}
 const localPins=uniqueEntries(localRows,refs,'private manifest');
 const sourceRows=[];for(const p of ['public/quran-source.json','public/additional-quran-source.json'])for(const v of (await json(resolve(ROOT,p))).verses)sourceRows.push({key:v.verse_key,source:v});
 const rawFree=uniqueEntries(sourceRows,refs,'public source registry');
 const audioCache=new Map();async function audio(p){if(!audioCache.has(p))audioCache.set(p,(async()=>{const b=await file(p);return {present:b!==null,bytes:b?.length||0,sha256:b?sha256(b):null,mp3HeaderValid:isMP3(b),decode:'not-performed'};})());return audioCache.get(p);}
 const physical=new Set();try{for(const s of await readdir(privateRoot,{withFileTypes:true})){if(!s.isDirectory()||!/^\d+$/.test(s.name))continue;for(const a of await readdir(resolve(privateRoot,s.name),{withFileTypes:true})){if(!a.isDirectory()||!/^\d+$/.test(a.name))continue;if(await file(resolve(privateRoot,s.name,a.name,'bundle.json')))physical.add(`${s.name}:${a.name}`);}}}catch(e){if(e.code!=='ENOENT')throw e;}
 const validRefs=new Set(refs.map(r=>r.key));for(const key of physical)if(!validRefs.has(key))issues.push({key,kind:'noncanonical-local-directory'});
 const freeRows=[],privateRows=[],verses=[];
 for(const r of refs){
  const e=premium.get(r.key),publicVerse=free.get(r.key),policy=publicVerse?'free':availability.developerOnlySurahs?.includes(r.surah)?'developer-preview':e?'private-pilot':'unavailable';
  const row={...r,policy,stages:{cataloged:true,downloaded:false,validated:false,reviewed:'not-attested',deployed:'not-verified',publiclyAvailable:'not-verified'},assetProfile:'none',wordCount:null,assets:{},hashes:{},missingRequired:[...REQUIRED],issues:[]};
  if(publicVerse){
   const b=localBundle(r.key),v=publicVerse.v;row.assetProfile='existing-free';row.stages.downloaded=true;row.wordCount=b.words.length;
   try{validateBundle(b,r.key);const original=rawFree.get(r.key)?.source.words;if(!original||original.length!==v.words.length||original.some((w,i)=>canonicalCompare(w.text||w.text_uthmani||'')!==canonicalCompare(v.words[i])))throw Error('public word/source alignment');}catch{row.issues.push('public-source-alignment');}
   row.hashes.display=sha256(b.textUthmani);row.hashes.wordPositions=sha256(JSON.stringify(b.words.map(w=>[w.position,w.text])));
   row.contentHash=sha256(contentFingerprint(b));row.assets.wordPositions={present:true,sha256:row.hashes.wordPositions,source:SOURCES.wordPositions};
   row.assets.arabic={present:true,source:SOURCES.arabic,sha256:row.hashes.display};row.assets.translation={present:typeof b.translation==='string'&&!!b.translation.trim(),source:r.surah===1?'legacy-fatihah-english':SOURCES.translation,sha256:sha256(b.translation)};
   row.assets.transliteration={present:v.roman?.length===v.words.length&&v.roman.every(x=>typeof x==='string'&&x.trim()),source:r.surah===1?'legacy-fatihah-word-aids':SOURCES.transliteration,sha256:sha256(JSON.stringify(v.roman))};
   row.assets.wordMeanings={present:v.meanings?.length===v.words.length&&v.meanings.every(x=>typeof x?.[0]==='string'&&x[0].trim()),source:r.surah===1?'legacy-fatihah-word-aids':SOURCES.wordMeanings,sha256:sha256(JSON.stringify(v.meanings.map(x=>x[0])))};
   const full=await audio(resolve(ROOT,`public/audio/${String(r.surah).padStart(3,'0')}${String(r.ayah).padStart(3,'0')}.mp3`));row.assets.fullAyahAudio={...full,source:SOURCES.fullAyahAudio};
   const wordFiles=await Promise.all(v.words.map((_,i)=>audio(resolve(ROOT,`public/audio/${String(r.surah).padStart(3,'0')}_${String(r.ayah).padStart(3,'0')}_${String(i+1).padStart(3,'0')}.mp3`))));
   const ordinalSourceMatches=(rawFree.get(r.key)?.source.words||[]).filter((w,i)=>w.audio_url?.split('/').at(-1)===`${String(r.surah).padStart(3,'0')}_${String(r.ayah).padStart(3,'0')}_${String(i+1).padStart(3,'0')}.mp3`).length;
   row.assets.wordAudio={ordinalSourceMatches,expected:v.words.length,present:wordFiles.filter(a=>a.present).length,headerValid:wordFiles.filter(a=>a.mp3HeaderValid).length,orderedHash:sha256(JSON.stringify(wordFiles.map((a,i)=>[i+1,a.sha256]))),alignmentReview:'existing-source-association; no-new-teacher-review',source:SOURCES.wordAudio};
   if(!full.mp3HeaderValid)row.issues.push('full-audio-missing-or-invalid-header');freeRows.push(row);
  }else if(e||physical.has(r.key)){
   row.assetProfile='existing-private';row.preservedPins=e?{bundle:e.sha256,audio:e.audioSha256,provider:e.contentSha256||null,wordCount:e.wordCount}:null;
   const path=`${r.surah}/${r.ayah}`,raw=await file(resolve(privateRoot,path,'bundle.json'));
   if(raw){row.stages.downloaded=true;row.hashes.bundle=sha256(raw);try{
    const b=validateBundle(JSON.parse(raw),r.key);row.wordCount=b.words.length;row.hashes.display=sha256(b.textUthmani);row.hashes.wordPositions=sha256(JSON.stringify(b.words.map(w=>[w.position,w.text])));row.contentHash=sha256(contentFingerprint(b));row.assets.wordPositions={present:true,sha256:row.hashes.wordPositions,source:SOURCES.wordPositions};
    if(!e)row.issues.push('private-bundle-not-registered');
    if(e&&row.hashes.bundle!==e.sha256)row.issues.push('bundle-pin-mismatch');if(e&&b.words.length!==e.wordCount)row.issues.push('word-count-mismatch');if(e?.contentSha256&&row.contentHash!==e.contentSha256)row.issues.push('provider-pin-mismatch');
    if(e&&e.juz!==r.juz)row.issues.push('availability-juz-mismatch');
    const old=localPins.get(r.key);if(!old)row.issues.push('local-manifest-entry-missing');else if(old.sha256!==e?.sha256||old.audioSha256!==e?.audioSha256||old.wordCount!==e?.wordCount||old.path!==`${path}/bundle.json`||old.juz!==r.juz)row.issues.push('local-manifest-pin-mismatch');
    for(const kind of ['arabic','translation'])row.assets[kind]={present:typeof b[kind==='arabic'?'textUthmani':'translation']==='string'&&!!b[kind==='arabic'?'textUthmani':'translation'].trim(),source:SOURCES[kind],sha256:sha256(b[kind==='arabic'?'textUthmani':'translation'])};
    for(const [kind,field]of [['transliteration','transliteration'],['wordMeanings','translation']])row.assets[kind]={present:b.words.every(w=>typeof w[field]==='string'&&w[field].trim()),source:SOURCES[kind],sha256:sha256(JSON.stringify(b.words.map(w=>w[field])))};
    const full=await audio(resolve(privateRoot,path,'full.mp3'));row.assets.fullAyahAudio={...full,source:SOURCES.fullAyahAudio};
    if(!full.mp3HeaderValid)row.issues.push('full-audio-missing-or-invalid-header');if(e&&full.sha256!==e.audioSha256)row.issues.push('audio-pin-mismatch');
    const a=b.audioAssets?.find(a=>a.file===`${path}/full.mp3`);if(!a||a.sha256!==full.sha256||a.bytes!==full.bytes||!Number.isFinite(a.durationMs)||a.durationMs<=0||e?.audioDurationMs&&a.durationMs!==e.audioDurationMs||e?.audioBytes&&a.bytes!==e.audioBytes)row.issues.push('audio-metadata-mismatch');
    row.assets.wordAudio={present:0,referenced:b.words.filter(w=>w.audioSource).length,alignmentReview:'not-reviewed',enabled:false,source:SOURCES.wordAudio};
    row.sourceResponsePins=(b.sources||[]).map(s=>typeof s.sha256==='string'&&/^[a-f0-9]{64}$/.test(s.sha256)?s.sha256:null);if(row.sourceResponsePins.some(s=>s===null))row.issues.push('source-response-pin-invalid');row.recitationStops={status:'not-attested',declaredReviewedSegments:b.segments.filter(s=>s.kind==='reviewed'&&s.review?.status==='approved').length,visualGroupingIsApproval:false};
   }catch{row.issues.push('invalid-private-bundle');}}
   else row.issues.push('local-private-bundle-absent');privateRows.push(row);
  }
  row.missingRequired=REQUIRED.filter(k=>!row.assets[k]?.present);row.stages.validated=row.stages.downloaded&&!row.missingRequired.length&&!row.issues.length;
  if(row.issues.length)issues.push(...row.issues.map(kind=>({key:r.key,kind})));verses.push(row);
 }
 const overlaps=auditOverlap(freeRows,privateRows);issues.push(...overlaps);
 // Even registered free keys must not have a second hidden private copy.
 for(const key of [...physical].sort())if(free.has(key)){
  issues.push({key,kind:'unregistered-private-copy-of-free-ayah'});
  try{const duplicate=JSON.parse(await readFile(resolve(privateRoot,key.replace(':','/'),'bundle.json')));if(sha256(contentFingerprint(duplicate))!==freeRows.find(v=>v.key===key).contentHash)issues.push({key,kind:'private-copy-content-mismatch'});}catch{issues.push({key,kind:'invalid-private-copy-of-free-ayah'});}
 }
 for(const e of availability.premium)if(free.has(e.key))issues.push({key:e.key,kind:'public-private-availability-overlap'});
 const declaredRefs=new Set(availability.premium.map(e=>e.key));for(const key of localPins.keys())if(!declaredRefs.has(key))issues.push({key,kind:'local-manifest-entry-not-in-availability'});
 const byKey=new Map(verses.map(v=>[v.key,v]));for(const issue of issues){const row=byKey.get(issue.key);if(row&&!row.issues.includes(issue.kind)){row.issues.push(issue.kind);row.stages.validated=false;}}
 const auxiliaryAssets=[];
 for(const name of (await readdir(resolve(ROOT,'public/audio'))).sort()){
  const match=/^(\d{3})_(\d{3})_(\d{3})\.mp3$/.exec(name);if(!match)continue;
  const key=`${Number(match[1])}:${Number(match[2])}`;if(free.has(key))continue;
  if(!validRefs.has(key)){issues.push({kind:'noncanonical-public-audio-reference'});continue;}
  auxiliaryAssets.push({kind:'public-distractor-word-audio',file:`public/audio/${name}`,key,wordPosition:Number(match[3]),...(await audio(resolve(ROOT,'public/audio',name))),source:SOURCES.wordAudio,grantsWholeAyahAvailability:false});
 }
 auxiliaryAssets.push({kind:'public-font',file:'public/fonts/UthmanicHafs.woff2',sha256:inputPins['public/fonts/UthmanicHafs.woff2'],source:'legacy-uthmanic-hafs-font'});
 const juzs=summarizeJuz(catalog,verses);
 const manifest=assertAuditMetadata({schemaVersion:1,auditKind:'offline-local-inventory',edition:provenance.edition,
  evidenceLimits:{independentExternalCatalogCheck:'not-performed',sourceLicenseClearance:'not-documented',humanEditorialReview:'not-attested',newAudioDecode:'not-performed',hostedDeployment:'not-verified',availabilityUnchanged:true,privateBytesIncluded:false,localAvailability:'snapshot of this audit workspace; re-audit on another machine'},
  inputPins,catalogSources:catalog.sources,auxiliaryAssets,wordIdentityContract:{ayahKey:'surah:ayah',sourcePosition:'1-based ordinal',existingArcadeId:'surah:ayah:zero-based-index',auditIdentity:'original ordered positions and byte hashes; no replacement IDs'},chapters:catalog.chapters.map(c=>({id:c.id,name:c.name,verseCount:c.verseCount,ranges:c.ranges})),juzs,verses});
 for(const p of protectedNames)if(sha256(await readFile(resolve(ROOT,p)))!==inputPins[p])throw Error('Protected input changed during audit: '+p);
 if(localManifestRaw&&sha256(await readFile(resolve(privateRoot,'manifest.json')))!==sha256(localManifestRaw))throw Error('Private pins changed during audit');
 return {manifest,provenance,issues,summary:{surahs:114,juzs:30,references:verses.length,local:verses.filter(v=>v.stages.downloaded).length,validated:verses.filter(v=>v.stages.validated).length,free:freeRows.length,registeredPrivate:availability.premium.length,missing:verses.filter(v=>!v.stages.downloaded).length,issues:issues.length}};
}
// Keep generated per-reference records one per line for practical review/diffs.
const arrayDocument=(header,name,rows)=>JSON.stringify(header,null,2).slice(0,-2)+`,\n  "${name}": [\n`+rows.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n';
export function renderAudit(a){
 const {verses,...header}=a.manifest;
 const manifest=arrayDocument(header,'verses',verses),digest=sha256(manifest),missing=a.manifest.verses.filter(v=>v.missingRequired.length).map(v=>({key:v.key,juz:v.juz,missingRequired:v.missingRequired,declaredPolicy:v.policy}));
 const table=a.manifest.juzs.map(j=>`| ${j.juz} | ${j.first}–${j.last} | ${j.expected} | ${j.local} | ${j.validated} | ${j.free} | ${j.developer} | ${j.premiumPilot} | ${j.missing} | ${j.releaseStatus} |`).join('\n');
 return new Map([
 ['canonical-manifest.json',manifest],
 ['missing-content.json',arrayDocument({schemaVersion:1,manifestSha256:digest,issues:a.issues},'missing',missing)],
 ['juz-audit.md',`# Per-juz local coverage audit\n\nManifest SHA-256: \`${digest}\`. Local technical checks are not rights clearance, scholarly review, deployment or publication. Free policy stays unchanged.\n\n| Juz | Canonical first–last | Expected | Local | Locally validated | Free policy | Developer preview | Private pilots | Missing | Status |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${table}\n\nEvery juz still has unverified rights/review/deployment gates. Existing free Al-Fatihah spans Juz 1; it does not make the rest of that juz available. Existing \'fullyVerifiedJuz\' availability declarations are retained but are not release approvals.\n`],
 ['summary.json',JSON.stringify({schemaVersion:1,manifestSha256:digest,...a.summary,releaseApproved:false},null,2)+'\n'],
 ]);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);if(args.some(x=>!['--check','--help'].includes(x)))throw Error('Use --check or --help only; Phase 1 never imports/publishes');
  if(args.includes('--help'))console.log('node scripts/audit-quran-manifest.mjs [--check]\nOffline metadata-only inventory. Writes content-audit/generated. No imports, uploads or availability changes.');
  else{const a=await auditQuran(),outputs=renderAudit(a),out=resolve(ROOT,'content-audit/generated');
   if(args.includes('--check')){for(const [name,raw]of outputs)if((await file(resolve(out,name)))?.toString()!==raw)throw Error('Audit snapshot differs: '+name+'; regenerate for this workspace and review.');}
   else{await mkdir(out,{recursive:true});for(const[name,raw]of outputs){await writeFile(resolve(out,name+'.tmp'),raw);await rename(resolve(out,name+'.tmp'),resolve(out,name));}}
   console.log(JSON.stringify({...a.summary,checkOnly:args.includes('--check'),releaseApproved:false}));
  }
 }catch(e){console.error(e.message);process.exitCode=1;}
}
