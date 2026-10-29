// Fixed verified provider URLs only. Hashes contain no premium display text.
import {availability,catalog,reference,sha256,validateBundle} from './content-policy.js';
const API='https://api.quran.com/api/v4/';
const decode=t=>t.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|rsquo|lsquo|hellip);/gi,(_,n,name)=>n?String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',mdash:'—',ndash:'–',rsquo:'’',lsquo:'‘',hellip:'…'})[name.toLowerCase()]);
export const contentFingerprint=b=>JSON.stringify([b.key,b.textUthmani,b.translation,b.words.map(w=>[w.position,w.text,w.translation,w.transliteration,w.audioSource||null])]);
const plain=t=>decode(t.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<[^>]+>/g,''));
const normal=t=>t.normalize('NFD').replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g,'');
async function json(path,fetcher){const response=await fetcher(API+path,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('Verified provider unavailable');const raw=await response.text();if(raw.length>8*1024*1024)throw Error('Provider response too large');return JSON.parse(raw);}
export async function bundleFromProvider(verse,canonical,entry){
 const r=reference(entry.key);if(verse.verse_key!==entry.key||canonical.verse_key!==entry.key||verse.juz_number!==r.juz)throw Error('Provider reference mismatch');
 const words=verse.words.filter(w=>w.char_type_name==='word'),tokens=[];let prefix='';
 for(const token of canonical.text_uthmani.trim().split(/\s+/)){if(normal(token)){tokens.push(prefix+token);prefix='';}else if(tokens.length)tokens[tokens.length-1]+=' '+token;else prefix+=token+' ';}
 if(words.length!==tokens.length||words.some((w,i)=>w.position!==i+1||normal(w.text_uthmani)!==normal(tokens[i])))throw Error('Provider word boundaries changed');
 const translation=verse.translations.find(t=>t.resource_id===20);if(!translation)throw Error('Verified translation unavailable');
 const b={schemaVersion:1,key:entry.key,surah:r.surah,ayah:r.ayah,juz:r.juz,textUthmani:canonical.text_uthmani,translation:plain(translation.text),translationSource:{resourceId:20,name:'Saheeh International',text:translation.text},sources:[{url:API+`verses/by_key/${entry.key}?words=true&word_fields=text_uthmani,audio_url&translations=20`},{url:API+`quran/verses/uthmani?verse_key=${entry.key}`}],words:words.map((w,i)=>({position:i+1,text:tokens[i],translation:w.translation.text,transliteration:w.transliteration.text,audioSource:w.audio_url,audioVerified:false})),segments:[{id:'full',firstWord:1,lastWord:words.length,reference:entry.key,kind:'whole-ayah'}],audioAssets:[{file:`${r.surah}/${r.ayah}/full.mp3`,source:`https://verses.quran.com/Alafasy/mp3/${String(r.surah).padStart(3,'0')}${String(r.ayah).padStart(3,'0')}.mp3`,sha256:entry.audioSha256,durationMs:entry.audioDurationMs,bytes:entry.audioBytes}]};
 if(!entry.contentSha256||await sha256(contentFingerprint(b))!==entry.contentSha256)throw Error('Provider canonical content fingerprint changed');
 return validateBundle(b,entry.key);
}
// A full chapter needs at most five paged provider responses for this preview,
// instead of hundreds of client requests. No data is sent before server auth.
export async function providerChapter(surah,fetcher=fetch){
 if(!availability.developerOnlySurahs?.includes(surah))throw Error('Chapter is not in developer preview');
 const chapter=catalog.chapters.find(c=>c.id===surah),pages=Math.ceil(chapter.verseCount/50);
 const [uth,...responses]=await Promise.all([json(`quran/verses/uthmani?chapter_number=${surah}`,fetcher),...Array.from({length:pages},(_,i)=>json(`verses/by_chapter/${surah}?words=true&word_fields=text_uthmani,audio_url&translations=20&per_page=50&page=${i+1}`,fetcher))]);
 const verses=responses.flatMap(r=>r.verses||[]);if(verses.length!==chapter.verseCount||uth.verses?.length!==chapter.verseCount)throw Error('Incomplete provider chapter');
 return Promise.all(Array.from({length:chapter.verseCount},async(_,i)=>{const key=`${surah}:${i+1}`,entry=availability.premium.find(e=>e.key===key),verse=verses.find(v=>v.verse_key===key),canonical=uth.verses.find(v=>v.verse_key===key);if(!entry||!verse||!canonical)throw Error('Missing chapter reference');return bundleFromProvider(verse,canonical,entry);}));
}
export async function providerBundle(key,fetcher=fetch){const entry=availability.premium.find(e=>e.key===key);if(!entry?.contentSha256)throw Error('Pinned content unavailable');const [v,u]=await Promise.all([json(`verses/by_key/${key}?words=true&word_fields=text_uthmani,audio_url&translations=20`,fetcher),json(`quran/verses/uthmani?verse_key=${key}`,fetcher)]);return bundleFromProvider(v.verse,u.verses[0],entry);}
