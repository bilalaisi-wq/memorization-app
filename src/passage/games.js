import {createQuestHost,questArcadeRegistry} from '../quest/host.js';
import {blocksRegistration} from '../quest/expedition/blocks.js';
import {createExpeditionMap} from '../quest/expedition/model.js';
import {createQuestStore} from '../quest/store.js';
import {createLearningStore} from '../learning-store.js';
import {createPuzzleStore} from '../puzzles/puzzle-store.js';
import {activeProfileId,profileStorage} from '../learner/profile-storage.js';
import {referenceOptions,reference,sha256} from '../content/library.js';
import {PASSAGE_GAMES} from './practice-plan.js';
import {readLabVolume} from '../puzzles/audio-level.js';
// Reuses the authenticated source/revision checks, canonical word adapter,
// media cleanup, motor/memory separation and capped arcade result recorder.
export async function mountPassageGame(root,{bundle,window:workspace,game,ctx,storage,onComplete,isCurrent=()=>true}) {
  if(!PASSAGE_GAMES.some(g=>g.id===game))throw Error('Choose an available Passage Builder game.');
  const owner=activeProfileId(),base=await createExpeditionMap({bundles:[bundle],game});
  const definition={...base.checkpoints.find(c=>c.stage==='trial'),workspace:{page:workspace.page,firstWord:workspace.first,lastWord:workspace.last},session:crypto.randomUUID()};
  definition.id=`quest:${await sha256(JSON.stringify(definition))}`;
  const map={...base,routeVersion:1,id:`campaign:${await sha256(definition.id)}`,checkpoints:[definition]};
  if(!isCurrent()||!root.isConnected)return null;
  const chapters=new Map();for(const o of referenceOptions()){const r=reference(o.key);if(!chapters.has(r.surah))chapters.set(r.surah,{id:r.surah,verses:[]});chapters.get(r.surah).verses.push({id:r.ayah});}
  // Notify the existing header/cloud/leaderboard observers, with the same live
  // owner guard as the studio. Never publish private Quran content.
  const guarded=storage;
  const observed={getItem:k=>guarded.getItem(k),setItem:(k,v)=>{guarded.getItem(k);if(activeProfileId()!==owner)throw Error('Account changed.');profileStorage.setItem(k,v);},removeItem:k=>{guarded.getItem(k);if(activeProfileId()!==owner)throw Error('Account changed.');profileStorage.removeItem(k);}};
  storage=observed;
  const library=[...chapters.values()],learning=createLearningStore(storage,library),lab=createPuzzleStore(storage,library);
  const store=createQuestStore({owner,getOwner:activeProfileId,storage});store.open(map);
  const registry=questArcadeRegistry();registry.register(blocksRegistration);
  const host=createQuestHost({root,map,store,owner,getOwner:activeProfileId,storage,learning,lab,client:ctx.client,registry,volume:()=>readLabVolume(storage),onProgress:(saved,cp)=>{onComplete({id:cp.id,xp:saved.xp||0});window.dispatchEvent(new CustomEvent("ayahrewardschanged",{detail:{xp:saved.xp||0}}));}});
  try{await host.launch(definition.id);if(!isCurrent()||!root.isConnected){host.dispose();return null;}return host;}catch(e){host.dispose();throw e;}
}
