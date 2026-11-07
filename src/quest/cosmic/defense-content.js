import {loadBundle,loadAudio,freeReference,sha256} from '../../content/library.js';
import {activeProfileId} from '../../learner/profile-storage.js';
import {fingerprints,validateRefs} from '../../passage-context/model.js';
import {createArcadePlan} from '../../puzzles/arcade/passage/plan.js';
import {stageAdapter} from '../../puzzles/arcade/passage/adapter.js';
import {createContentAdapter,seededShuffle} from '../../puzzles/arcade/content.js';
import {wordIdentity} from '../../distractors.js';
import {surahs} from '../../data.js';
const trusted=new WeakSet(),pools=new Map();
function decoys(length){if(!pools.has(length)){const library=surahs.filter(s=>s.id===1||s.id>=78&&s.id<=114),a=createContentAdapter(library),out=[];for(const chapter of library)for(const verse of chapter.verses){const words=a.words(`${chapter.id}:${verse.id}`);for(let i=0;i+length<=words.length;i++){const part=words.slice(i,i+length);out.push({...part[0],text:part.map(w=>w.text).join(' '),sourceWordIds:part.map(w=>w.id),sourcePositions:part.map(w=>w.index+1),target:false});}}pools.set(length,out);}return pools.get(length);}
export function assertDefenseContent(c){if(!trusted.has(c))throw Error('Use an authorized PassageContext defense source.');c.assertCurrent();return c;}
export async function prepareDefenseContent(refs,client=null,{memoryDifficulty='standard',motorDifficulty='relaxed',chainMode='practice',verifyBundle=null}={}){
 validateRefs(refs);const owner=activeProfileId(),bundles=new Map(),audio=new Map();let disposed=false;
 const assertCurrent=()=>{if(disposed||owner!==activeProfileId())throw Error('Defense passage access changed. Reopen the selected passage.');};
 for(const key of refs){const b=await loadBundle(key,client);assertCurrent();await verifyBundle?.(b);assertCurrent();bundles.set(key,b);}
 const plan=await createArcadePlan([...bundles.values()],{game:'asteroids',memoryDifficulty,motorDifficulty,chainMode});assertCurrent();
 const c={refs:[...refs],plan,private:refs.some(r=>!freeReference(r)),assertCurrent,stages(keys=refs){assertCurrent();const stages=plan.stages.filter(s=>keys.includes(s.reference));if(!stages.length||keys.some(k=>!bundles.has(k)))throw Error('Invalid defense scope.');return stages.map(s=>{const b=bundles.get(s.reference),a=stageAdapter(b,s,surahs.filter(c=>c.id===1||c.id>=78&&c.id<=114),{memoryDifficulty,seed:s.seed});return {...s,targets:a.words(b.key),distractors:[1,2,3].flatMap(n=>{const seen=new Set(a.words(b.key).map(w=>wordIdentity(w.text))),items=[];for(const w of seededShuffle(decoys(n),(s.seed+parseInt(b.contentRevision.slice(0,8),16))>>>0)){const id=wordIdentity(w.text);if(w.key===b.key||seen.has(id))continue;seen.add(id);items.push(w);if(items.length===12)break;}return items;})};});},async audio(ref){assertCurrent();if(!bundles.has(ref))throw Error('Unauthorized audio reference.');if(!audio.has(ref)){const a=await loadAudio(bundles.get(ref),client);try{assertCurrent();}catch(e){a.revoke();throw e;}if(audio.has(ref))a.revoke();else audio.set(ref,a);}return audio.get(ref).url;},async revalidate(){for(const key of refs){const b=await loadBundle(key,client);assertCurrent();await verifyBundle?.(b);if(JSON.stringify(await fingerprints(b))!==JSON.stringify(plan.pins[key]))throw Error('Source or review changed. Previous defense checkpoints remain recoverable.');}},dispose(){disposed=true;audio.forEach(a=>a.revoke());audio.clear();bundles.clear();}};trusted.add(c);return c;
}
export const defenseRouteId=async(content,{mode,motorDifficulty,keys=content.refs,chainMode='practice'})=>{assertDefenseContent(content);return sha256(JSON.stringify([1,content.plan.id,keys,mode,motorDifficulty,chainMode]));};
