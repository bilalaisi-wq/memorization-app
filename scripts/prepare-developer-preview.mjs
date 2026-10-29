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

const entries=availability.premium.filter(e=>Number(e.key.split(':')[0])===7).sort((a,b)=>Number(a.key.split(':')[1])-Number(b.key.split(':')[1]));
// Each row is a complete statement, so copying from the middle cannot produce
// an orphan VALUES tuple such as ('7:91',...). Whole-file execution is preferred.
const sql='-- Source registration only; no study/waqf/restart approvals are granted.\n'+entries.map(e=>`insert into public.quran_review_heads(verse_key,total_words,source_hash,duration_ms) values ('${e.key}',${e.wordCount},'${e.sha256}',${e.audioDurationMs}) on conflict(verse_key) do nothing;`).join('\n')+'\n';
await writeFile('supabase/migrations/20261031_developer_surah_review_sources.sql',sql);
const setup=await readFile('supabase/SETUP_JUZ29.sql','utf8');
await writeFile('supabase/SETUP_DEVELOPER_LIBRARY.sql',setup.replace('commit;\n',sql+'\ncommit;\n'));
const guard=`-- Paste this ENTIRE file into a fresh Supabase SQL Editor query. Run with no text selected.
-- If prerequisites are missing, use SETUP_DEVELOPER_LIBRARY.sql instead.
-- Safe to rerun: existing review heads, approvals and progress are preserved.
do $$ begin
 if to_regclass('public.quran_review_heads') is null then
  raise exception 'Review schema is missing. Run the entire SETUP_DEVELOPER_LIBRARY.sql first.';
 end if;
end $$;
`;
await writeFile('supabase/REPAIR_AL_ARAF_SOURCES.sql',guard+sql+"\nselect count(*) as registered_al_araf_ayahs, 206 as expected from public.quran_review_heads where verse_key like '7:%';\n");
