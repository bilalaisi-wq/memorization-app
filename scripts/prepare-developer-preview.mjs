// Safe public pins only; canonical Qur'an and private audio remain outside Git/public.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {contentFingerprint} from '../supabase/functions/_shared/provider-content.js';
const path='supabase/functions/_shared/content-availability.json',availability=JSON.parse(await readFile(path,'utf8'));
const ids=[7,...Array.from({length:11},(_,i)=>67+i)];
for(const e of availability.premium.filter(e=>ids.includes(Number(e.key.split(':')[0])))){
 const b=JSON.parse(await readFile(`.quran-private/${e.key.replace(':','/')}/bundle.json`,'utf8'));
 e.contentSha256=createHash('sha256').update(contentFingerprint(b)).digest('hex');e.audioDurationMs=b.audioAssets[0].durationMs;e.audioBytes=b.audioAssets[0].bytes;
}
availability.developerOnlySurahs=ids;
await writeFile(path,JSON.stringify(availability,null,2)+'\n');
console.log('Pinned Al-A’raf (206 ayahs) and all 11 Juz 29 surahs (431 ayahs) for server-authorized developer preview. No private text or audio published.');

const rows=availability.premium.filter(e=>Number(e.key.split(':')[0])===7).sort((a,b)=>Number(a.key.split(':')[1])-Number(b.key.split(':')[1])).map(e=>`('${e.key}',${e.wordCount},'${e.sha256}',${e.audioDurationMs})`);
const sql='-- Source registration only; no study/waqf/restart approvals are granted.\ninsert into public.quran_review_heads(verse_key,total_words,source_hash,duration_ms) values\n'+rows.join(',\n')+'\non conflict(verse_key) do nothing;\n';
await writeFile('supabase/migrations/20261031_developer_surah_review_sources.sql',sql);
const setup=await readFile('supabase/SETUP_JUZ29.sql','utf8');
await writeFile('supabase/SETUP_DEVELOPER_LIBRARY.sql',setup.replace('commit;\n',sql+'\ncommit;\n'));
