import {catalog,availability,validateBundle,loadAudio} from './library.js';
import {isDeveloperMode} from '../developer/access.js';
import {configurePrivateAudio,clearPrivateAudio} from './private-audio.js';
export const previewSurahs=[7,...Array.from({length:11},(_,i)=>67+i)];
export function chapterFromBundles(id,bundles){
 const meta=catalog.chapters.find(c=>c.id===id);
 if(!meta||!previewSurahs.includes(id)||!Array.isArray(bundles)||bundles.length!==meta.verseCount)throw Error('The full verified chapter is required.');
 const sorted=[...bundles].sort((a,b)=>a.ayah-b.ayah);
 sorted.forEach((b,i)=>{validateBundle(b,`${id}:${i+1}`);if(b.surah!==id)throw Error('Chapter reference mismatch');});
 return {id,name:meta.name,arabic:meta.arabic,meaning:'Developer library · verified source text',origin:'Uthmani · Hafs',developerOnly:true,bundles:sorted,verses:sorted.map(b=>({id:b.ayah,text:b.textUthmani,translation:b.translation,words:b.words.map(w=>w.text),roman:b.words.map(w=>w.transliteration||''),meanings:b.words.map(w=>[w.translation||'',(/اللَّه|ٱللَّه|لِلَّه/.test(w.text)||/Allah/.test(w.translation||''))?'gold':'name']),bundle:b}))};
}
export async function loadDeveloperChapter(id,client){
 if(!isDeveloperMode()||!client||!previewSurahs.includes(id))throw Error('Enable developer mode with your verified owner account first.');
 const {data,error}=await client.functions.invoke('quran-content',{body:{key:`${id}:1`,asset:'chapter'}});
 if(error){let detail='Update the quran-content Edge Function using the developer-library setup guide.';try{detail=(await error.context.json()).error||detail;}catch{}throw Error(detail==='Invalid asset'?'The live library server needs an update. Deploy quran-content using docs/developer-library-preview.md, then retry.':detail);}
 if(!isDeveloperMode())throw Error('Developer access was turned off.');
 return chapterFromBundles(id,data?.bundles);
}
export function authorizeChapterAudio(chapters,client){const bundles=new Map(chapters.filter(c=>c.developerOnly).flatMap(c=>c.bundles.map(b=>[b.key,b])));configurePrivateAudio([...bundles.keys()],async key=>{if(!isDeveloperMode())throw Error('Developer mode is required.');return loadAudio(bundles.get(key),client);});}
export {clearPrivateAudio};
