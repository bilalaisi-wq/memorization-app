// Only enrich existing validated entries; never rewrite source bundles or approvals.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBundle} from '../supabase/functions/_shared/content-policy.js';
import {contentFingerprint} from '../supabase/functions/_shared/provider-content.js';
const hash=x=>createHash('sha256').update(x).digest('hex'),path='supabase/functions/_shared/content-availability.json',data=JSON.parse(await readFile(path));
for(const key of ['2:255','2:282']){const entry=data.premium.find(e=>e.key===key),folder=`.quran-private/${key.replace(':','/')}`,raw=await readFile(`${folder}/bundle.json`),audio=await readFile(`${folder}/full.mp3`);if(!entry||hash(raw)!==entry.sha256||hash(audio)!==entry.audioSha256)throw Error(`Existing validated source changed: ${key}`);const b=validateBundle(JSON.parse(raw),key),a=b.audioAssets.find(a=>a.file.endsWith('/full.mp3'));if(a.bytes!==audio.length||a.sha256!==entry.audioSha256||!Number.isFinite(a.durationMs))throw Error('Audio source metadata mismatch');const pin=hash(contentFingerprint(b));if(entry.contentSha256&&entry.contentSha256!==pin)throw Error('Explicit source migration required');Object.assign(entry,{contentSha256:pin,audioDurationMs:a.durationMs,audioBytes:a.bytes});}
await writeFile(path,JSON.stringify(data,null,2)+'\n');console.log('Existing Al-Baqarah pilot pins enriched. Source bytes, publication and approvals unchanged.');
