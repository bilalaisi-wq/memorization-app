import {test,expect} from '@playwright/test';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalReferences,uniqueEntries,auditOverlap,summarizeJuz,assertAuditMetadata,sha256} from '../scripts/lib/quran-coverage.mjs';
import {auditQuran,renderAudit} from '../scripts/audit-quran-manifest.mjs';
import catalog from '../supabase/functions/_shared/quran-catalog.json' with {type:'json'};
import availability from '../supabase/functions/_shared/content-availability.json' with {type:'json'};
const clone=x=>structuredClone(x),refs=canonicalReferences(catalog);
test('all 6236 canonical IDs occur once across 114 chapters and 30 exact juz mappings',()=>{
 expect(refs).toHaveLength(6236);expect(new Set(refs.map(r=>r.key)).size).toBe(6236);
 for(const j of catalog.juzs){const rows=refs.filter(r=>r.juz===j.id);expect(rows).toHaveLength(j.verseCount);expect(rows[0].key).toBe(`${j.ranges[0].surah}:${j.ranges[0].first}`);expect(rows.at(-1).key).toBe(`${j.ranges.at(-1).surah}:${j.ranges.at(-1).last}`);}
 expect(refs.find(r=>r.key==='2:141').juz).toBe(1);expect(refs.find(r=>r.key==='2:142').juz).toBe(2);expect(refs.find(r=>r.key==='2:253').juz).toBe(3);expect(refs.find(r=>r.key==='7:87').juz).toBe(8);expect(refs.find(r=>r.key==='7:88').juz).toBe(9);
});
test('gaps, overlaps, order changes and divergent chapter/juz counts fail without repairing catalog',()=>{
 for(const mutate of [c=>c.chapters[1].ranges[0].last--,c=>c.juzs[0].ranges.push({...c.juzs[0].ranges[0]}),c=>c.juzs[1].ranges[0].first--,c=>c.juzs[2].verseCount++,c=>c.chapters.reverse()]){const c=clone(catalog);mutate(c);const before=JSON.stringify(c);expect(()=>canonicalReferences(c)).toThrow();expect(JSON.stringify(c)).toBe(before);}
});
test('duplicate imports, noncanonical aliases and conflicting public/private hashes are explicit',()=>{
 expect(()=>uniqueEntries([{key:'2:255'},{key:'2:255'}],refs,'import')).toThrow('duplicate');expect(()=>uniqueEntries([{key:'02:255'}],refs,'import')).toThrow('noncanonical');
 expect(auditOverlap([{key:'2:255',contentHash:'a'}],[{key:'2:255',contentHash:'b'}])).toEqual([{key:'2:255',kind:'public-private-overlap',sameContent:false}]);
});
test('metadata guard rejects private Quran bodies and credentials; presence never implies deployment/review',()=>{
 for(const key of ['textUthmani','words','translationSource','audioAssets','access_token'])expect(()=>assertAuditMetadata({a:{[key]:'sensitive'}})).toThrow();
 const verses=refs.map(r=>({...r,policy:'unavailable',stages:{downloaded:false,validated:false}}));const j=summarizeJuz(catalog,verses);expect(j).toHaveLength(30);expect(j.every(x=>x.missing===x.expected&&x.deployed==='not-verified'&&x.reviewed==='not-attested'&&x.releaseStatus==='incomplete')).toBe(true);
});
test('offline audit supports a fresh checkout with no private downloads, preserves source/availability and never touches progress',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ayah-audit-')),old=globalThis.localStorage;globalThis.localStorage={getItem:()=>{throw Error('Do not read progress');},setItem:()=>{throw Error('Do not write progress');}};
 try{const names=['src/data.js','src/additional-surahs.json','supabase/functions/_shared/content-availability.json','supabase/functions/_shared/quran-catalog.json'];const before=await Promise.all(names.map(p=>readFile(new URL('../'+p,import.meta.url))));
 const a=await auditQuran({privateRoot:dir});expect(a.summary.references).toBe(6236);expect(a.summary.free).toBe(571);expect(a.manifest.auxiliaryAssets.filter(x=>x.kind==='public-distractor-word-audio')).toHaveLength(6);expect(a.manifest.verses.find(v=>v.key==='55:5').stages.downloaded).toBe(false);expect(a.summary.local).toBe(571);expect(a.summary.missing).toBe(5665);
 expect(a.manifest.verses.filter(v=>v.policy==='developer-preview')).toHaveLength(637);expect(a.manifest.verses.filter(v=>v.policy==='private-pilot')).toHaveLength(2);
 expect(a.manifest.verses.every(v=>v.stages.reviewed==='not-attested'&&v.stages.deployed==='not-verified')).toBe(true);
 expect(a.manifest.verses.find(v=>v.key==='100:9').stages.validated).toBe(true);
 expect(a.manifest.verses.filter(v=>v.policy==='free').every(v=>v.stages.validated)).toBe(true);
 for(const v of a.manifest.verses.filter(v=>availability.premium.some(e=>e.key===v.key))){const pin=availability.premium.find(e=>e.key===v.key);expect(v.preservedPins).toEqual({bundle:pin.sha256,audio:pin.audioSha256,provider:pin.contentSha256||null,wordCount:pin.wordCount});}
 expect([...renderAudit(a)].some(([,raw])=>/[\u0600-\u06ff]/.test(raw))).toBe(false);
 expect([...renderAudit(a)]).toEqual([...renderAudit(a)]);
 for(const [i,p]of names.entries())expect(sha256(await readFile(new URL('../'+p,import.meta.url)))).toBe(sha256(before[i]));
 }finally{globalThis.localStorage=old;await rm(dir,{recursive:true,force:true});}
});
test('bad private pins, missing full audio and unregistered overlapping copies do not get promoted',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ayah-audit-bad-'));
 try{const b=await readFile(new URL('./fixtures/2-282.json',import.meta.url)),pin=availability.premium.find(e=>e.key==='2:282');await mkdir(join(dir,'2/282'),{recursive:true});await writeFile(join(dir,'2/282/bundle.json'),b);await writeFile(join(dir,'manifest.json'),JSON.stringify({schemaVersion:1,verses:[{...pin,path:'2/282/bundle.json'}]}));
 await mkdir(join(dir,'1/1'),{recursive:true});await writeFile(join(dir,'1/1/bundle.json'),'{}');
 const a=await auditQuran({privateRoot:dir}),row=a.manifest.verses.find(v=>v.key==='2:282');expect(row.stages.downloaded).toBe(true);expect(row.stages.validated).toBe(false);expect(row.issues).toContain('audio-pin-mismatch');expect(a.issues.some(i=>i.kind==='unregistered-private-copy-of-free-ayah')).toBe(true);
 expect(row.missingRequired).toContain('fullAyahAudio');const out=JSON.stringify(a.manifest);expect(out).not.toContain(JSON.parse(b).textUthmani);expect(a.manifest.juzs.find(j=>j.juz===3).releaseStatus).toBe('incomplete');
 await writeFile(join(dir,'manifest.json'),JSON.stringify({schemaVersion:1,verses:[pin,pin]}));await expect(auditQuran({privateRoot:dir})).rejects.toThrow('duplicate');
 }finally{await rm(dir,{recursive:true,force:true});}
});
