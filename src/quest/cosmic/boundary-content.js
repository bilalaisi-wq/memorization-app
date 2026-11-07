import {loadBundle,loadAudio,freeReference,catalog} from '../../content/library.js';
import {activeProfileId} from '../../learner/profile-storage.js';
import {fingerprints,validateRefs} from '../../passage-context/model.js';
import {canonicalLinkAyah,linkSpans} from './link-content.js';
import {cosmicSurahs} from './mission.js';
import {comparableAyah} from './gateways.js';
import {seededShuffle} from '../../puzzles/arcade/content.js';
const trusted=new WeakSet();
export function assertBoundaryContent(content){if(!trusted.has(content))throw Error('Load verified, authorized boundary sources first.');content.assertCurrent();return content;}
export async function prepareBoundaryContent(refs,client=null){
 validateRefs(refs);if(refs.some(r=>r.split(':')[0]!==refs[0].split(':')[0]))throw Error('Choose consecutive ayahs within one surah.');
 const owner=activeProfileId(),bundles=new Map(),pins={},resources=new Map();let disposed=false;
 const assertCurrent=()=>{if(disposed||activeProfileId()!==owner)throw Error('Boundary content access changed. Reopen the passage.');};
 const ayahs={};for(const ref of refs){const b=await loadBundle(ref,client);assertCurrent();bundles.set(ref,b);pins[ref]=await fingerprints(b);const chapter=catalog.chapters.find(c=>c.id===b.surah);ayahs[ref]={ref,surah:b.surah,ayah:b.ayah,name:chapter.name,text:b.textUthmani,words:b.words,spans:linkSpans(b),audio:b.freeAudio||null};}
 const content={refs:[...refs],ayahs,pins,private:refs.some(r=>!freeReference(r)),assertCurrent,async revalidate(){for(const ref of refs){const b=await loadBundle(ref,client);assertCurrent();if(JSON.stringify(await fingerprints(b))!==JSON.stringify(pins[ref]))throw Error('Boundary source or review revision changed. Existing evidence is preserved.');}},async audio(ref){assertCurrent();if(!bundles.has(ref))throw Error('Audio reference is outside this passage.');if(!resources.has(ref)){const a=await loadAudio(bundles.get(ref),client);try{assertCurrent();}catch(e){a.revoke();throw e;}if(resources.has(ref))a.revoke();else resources.set(ref,a);}return resources.get(ref).url;},dispose(){disposed=true;resources.forEach(a=>a.revoke());resources.clear();bundles.clear();Object.keys(ayahs).forEach(k=>delete ayahs[k]);}};
 assertCurrent();trusted.add(content);return content;
}
let freePool;
function pool(){return freePool||=(cosmicSurahs.flatMap(s=>s.verses.map(v=>canonicalLinkAyah(`${s.id}:${v.id}`))));}
export function endpoint(ayah,side,length=1){const first=side==='ending'?Math.max(0,ayah.words.length-length):0,last=side==='ending'?ayah.words.length-1:Math.min(ayah.words.length,length)-1;return {id:`${ayah.ref}:${first}-${last}`,ref:ayah.ref,side,first,last,text:ayah.text.slice(ayah.spans[first].start,ayah.spans[last].end)};}
export function boundaryChoices(ayah,side,{length=1,seed=1,single=false}={}){const answer=endpoint(ayah,side,length),seen=new Set([comparableAyah(answer.text)]),result=[answer];if(!single)for(const a of seededShuffle(pool(),seed)){const e=endpoint(a,side,length),identity=comparableAyah(e.text);if(a.ref===ayah.ref||seen.has(identity))continue;seen.add(identity);result.push(e);if(result.length===3)break;}if(!single&&result.length!==3)throw Error('No unambiguous source-backed endpoints are available.');return seededShuffle(result,seed+33);}
