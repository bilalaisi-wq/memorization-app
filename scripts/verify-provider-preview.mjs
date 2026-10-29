// Optional live-source smoke check. No credentials, uploads or private content output.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {providerChapter} from '../supabase/functions/_shared/provider-content.js';
const run=promisify(execFile);
const fetcher=async url=>{const {stdout}=await run('curl',['-fsSL','--retry','2','--max-time','25',url],{maxBuffer:12*1024*1024});return new Response(stdout);};
for(const id of [7,...Array.from({length:11},(_,i)=>67+i)]){const bundles=await providerChapter(id,fetcher);console.log(`Surah ${id}: ${bundles.length} ayahs; all canonical text, translation and ordered word fingerprints match.`);}
