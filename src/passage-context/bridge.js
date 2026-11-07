import {surahs} from '../data.js';
import {loadBundle,loadAudio,freeReference,catalog} from '../content/library.js';
import {configurePrivateAudio,clearPrivateAudio} from '../content/private-audio.js';
import {createContentAdapter} from '../puzzles/arcade/content.js';
import {bridgeRegistration} from '../puzzles/arcade/bridge/ui.js';
import {createRegistry,createLauncher} from '../puzzles/arcade/registry.js';
import {createResultRecorder} from '../puzzles/arcade/results.js';
import {createLearningStore} from '../learning-store.js';
import {createPuzzleStore} from '../puzzles/puzzle-store.js';
import {profileStorage,activeProfileId} from '../learner/profile-storage.js';
import {compatibility} from './compatibility.js';
export async function mountContextBridge(root,{refs,client,isCurrent,verifyBundle,onComplete=()=>{}}){
 const supported=compatibility({game:'bridge',refs});if(!supported.available)throw Error(supported.reason);
 const owner=activeProfileId(),loaded=[];for(const key of refs){const b=await loadBundle(key,client);await verifyBundle?.(b);if(!isCurrent()||owner!==activeProfileId())return null;loaded.push(b);}
 const privateBundles=new Map(loaded.filter(b=>!freeReference(b.key)).map(b=>[b.key,b]));
 configurePrivateAudio([...privateBundles.keys()],async key=>{if(!isCurrent()||owner!==activeProfileId())throw Error('Passage access changed.');return loadAudio(privateBundles.get(key),client);});
 const library=surahs.map(s=>({...s,verses:s.verses.filter(v=>!refs.includes(`${s.id}:${v.id}`))}));
 for(const b of loaded){let c=library.find(c=>c.id===b.surah);if(!c){c={id:b.surah,privateContent:true,verses:[]};library.push(c);}c.verses.push({id:b.ayah,words:b.words.map(w=>w.text)});}
 const adapter=createContentAdapter(library),first=loaded[0],last=loaded.at(-1),config=adapter.configure({surah:first.surah,start:first.ayah,end:last.ayah,mode:'chain',chainMode:'practice',seed:crypto.getRandomValues(new Uint32Array(1))[0]});
 const metadata=catalog.chapters.map(c=>({id:c.id,verses:Array.from({length:c.verseCount},(_,i)=>({id:i+1}))}));
 const record=createResultRecorder({learning:createLearningStore(profileStorage,metadata),lab:createPuzzleStore(profileStorage,metadata),accountId:owner,getAccountId:activeProfileId});
 const registry=createRegistry();registry.register(bridgeRegistration);const launcher=createLauncher(registry);
 try{const game=launcher.launch('bridge',{root,adapter,library,config,passageContext:{refs},id:crypto.randomUUID(),onComplete:s=>{record(s);onComplete({xp:0});window.dispatchEvent(new Event('ayahrewardschanged'));}});return {...game,dispose(){launcher.dispose();clearPrivateAudio();root.replaceChildren();}};}catch(e){launcher.dispose();clearPrivateAudio();throw e;}
}
