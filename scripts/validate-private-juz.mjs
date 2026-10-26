// Validates the exact local release against the public hash manifest. No uploads.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {availability,catalog,validateBundle} from '../supabase/functions/_shared/content-policy.js';
const juz=Number(process.argv[2]||29);
const mapping=catalog.juzs.find(j=>j.id===juz);
if(!mapping) throw Error('Unknown juz');
const expected=mapping.ranges.flatMap(r=>Array.from({length:r.last-r.first+1},(_,i)=>`${r.surah}:${r.first+i}`));
const entries=availability.premium.filter(e=>e.juz===juz);
if(entries.length!==expected.length || new Set(entries.map(e=>e.key)).size!==expected.length || expected.some(k=>!entries.some(e=>e.key===k))) throw Error('Missing or duplicated references');
const sha=b=>createHash('sha256').update(b).digest('hex');
let words=0;
for(const entry of entries){
 const path=entry.key.replace(':','/');
 const raw=await readFile(`.quran-private/${path}/bundle.json`);
 if(sha(raw)!==entry.sha256) throw Error('Bundle hash mismatch '+entry.key);
 const b=validateBundle(JSON.parse(raw),entry.key);words+=b.words.length;
 if(b.words.length!==entry.wordCount) throw Error('Word count mismatch');
 const audio=await readFile(`.quran-private/${path}/full.mp3`);
 if(sha(audio)!==entry.audioSha256) throw Error('Audio hash mismatch '+entry.key);
 for(const asset of b.audioAssets) if(asset.durationMs<=0||asset.bytes!==audio.length) throw Error('Invalid audio metadata');
}
console.log(`Juz ${juz}: ${mapping.ranges.length} surahs, ${entries.length} ayahs, ${words} ordered words; every text/audio digest verified.`);
