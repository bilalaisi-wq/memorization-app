import {loadBundle,loadAudio,freeReference} from '../content/library.js';
import {profileStorage,activeProfileId} from '../learner/profile-storage.js';
import {versionedStore} from '../ui/versioned-store.js';
import {validateRefs,validSelection,fingerprints,contentView,transitionView} from './model.js';
export const PASSAGE_SELECTION_KEY='ayah-passage-context-v1';
// References/fingerprints only. This store never contains text, audio, or access grants.
export function selectionStore(storage){const s=versionedStore(storage,PASSAGE_SELECTION_KEY,()=>({version:1,selection:null}),v=>v?.version===1&&(v.selection===null||validSelection(v.selection))&&Object.keys(v).every(k=>['version','selection'].includes(k)));return {...s,save(selection){if(selection!==null&&!validSelection(selection))throw Error('Invalid passage selection.');s.transact(v=>v.selection=selection);}};}
export function createPassageSession({storage=profileStorage,getOwner=activeProfileId,getClient=()=>null,loader=loadBundle,audioLoader=loadAudio,onInvalidate=()=>{}}={}){
 let owner=getOwner(),generation=0,bundles=new Map(),resources=new Set(),selection=null,disposed=false,revokers=new Set();
 const state=()=>selectionStore(storage);
 const guard=()=>{if(disposed||owner!==getOwner()||!selection)throw Error('Passage context expired. Reauthorize the selected passage.');};
 function invalidate(reason='Content authorization changed.'){generation++;bundles.clear();for(const r of resources)r.revoke();resources.clear();selection=null;for(const stop of [...revokers])stop();revokers.clear();onInvalidate(reason);}
 async function open(refs,{active=refs?.[0],lab='memorization',restore=false}={}){
  if(disposed)throw Error('Passage session closed.');
  validateRefs(refs);if(!refs.includes(active)||!['memorization','puzzle','revision'].includes(lab))throw Error('Invalid passage navigation.');
  invalidate('Loading authorized passage…');owner=getOwner();const token=generation,loaded=new Map(),hashes={};let cursor=0;
  const current=()=>!disposed&&token===generation&&owner===getOwner();
  try{await Promise.all(Array.from({length:Math.min(4,refs.length)},async()=>{while(cursor<refs.length){const key=refs[cursor++],b=await loader(key,getClient());if(!current())throw Error('Passage selection was superseded.');loaded.set(key,b);hashes[key]=await fingerprints(b);if(!current())throw Error('Passage selection was superseded.');}}));
   if(!current())throw Error('Passage selection was superseded.');
   const next={version:1,refs:[...refs],active,lab,fingerprints:Object.fromEntries(refs.map(k=>[k,hashes[k]]))};
   const store=state(),old=store.snapshot().selection;if(store.warning)throw Error(store.warning);
   if(restore&&old&&JSON.stringify(old.fingerprints)!==JSON.stringify(next.fingerprints))throw Error('Selected source or review revision changed. Saved selection and drafts are preserved for recovery.');
   store.save(next);bundles=loaded;selection=next;return descriptor();
  }catch(e){loaded.clear();if(current())invalidate(e.message);throw e;}
 }
 const descriptor=()=>{guard();return structuredClone(selection);};
 const getBundle=key=>{guard();if(!bundles.has(key))throw Error("Reference is outside the selected passage.");return bundles.get(key);};
 const identityChanged=()=>{if(selection&&owner!==getOwner())invalidate("Account changed.");};
 if(typeof window!=="undefined")window.addEventListener("ayahprofilechange",identityChanged);
 return {
  open,descriptor,has:()=>!!selection&&!disposed&&owner===getOwner(),
  saved:()=>{const s=state();return {selection:s.snapshot().selection,warning:s.warning};},
  async restore(){const s=state();if(s.warning)throw Error(s.warning);const old=s.snapshot().selection;if(old)return open(old.refs,{active:old.active,lab:old.lab,restore:true});return null;},
  async assertBundle(bundle){guard();const token=generation,actual=await fingerprints(bundle);guard();if(token!==generation||!selection.fingerprints[bundle.key]||JSON.stringify(actual)!==JSON.stringify(selection.fingerprints[bundle.key])){invalidate('Source or review revision changed. Saved selections and drafts are preserved.');throw Error('Source or review revision changed. Reauthorize the passage.');}return actual;},
  navigate(lab,active=selection?.active){guard();const next={...selection,lab,active};if(!validSelection(next))throw Error('Invalid passage navigation.');state().save(next);selection=next;return descriptor();},
  bundle:getBundle,
  view(kind,key=selection?.active,options){guard();if(kind==='transitions')return transitionView(selection.refs.map(k=>bundles.get(k)));return contentView(getBundle(key),kind,options);},
  async audio(key=selection?.active){guard();const token=generation,r=await audioLoader(getBundle(key),getClient());if(disposed||token!==generation||owner!==getOwner()){r.revoke();throw Error('Audio authorization changed.');}let released=false;const lease={url:r.url,revoke(){if(released)return;released=true;resources.delete(lease);r.revoke();}};resources.add(lease);return lease;},
  own(dispose){guard();revokers.add(dispose);return()=>revokers.delete(dispose);},
  private:()=>!!selection&&selection.refs.some(k=>!freeReference(k)),
  invalidate,
  clear(){invalidate('Selection cleared.');state().save(null);},
  dispose(){invalidate('Passage session closed.');disposed=true;if(typeof window!=='undefined')window.removeEventListener('ayahprofilechange',identityChanged);}
 };
}
