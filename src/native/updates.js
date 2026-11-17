import {CapacitorUpdater} from '@capgo/capacitor-updater';
import {isNativeApp} from './platform.js';
// Download only. Applying is explicit, after pausing study and saving current drafts.
let pending=null;
export const pendingMobileUpdate=()=>pending;
export async function initializeUpdates({updater=CapacitorUpdater,native=isNativeApp(),notify=()=>{}}={}){
 if(!native)return ()=>{};
 const handle=await updater.addListener('updateAvailable',({bundle})=>{pending=bundle?.id?bundle:null;notify(Boolean(pending));});
 return ()=>{pending=null;void handle.remove();};
}
export async function markMobileReady({updater=CapacitorUpdater,native=isNativeApp()}={}){
 // Called after real app initialization, never before the learning screen can render.
 if(native)await updater.notifyAppReady();
}
export async function applyMobileUpdate({updater=CapacitorUpdater,beforeApply=()=>{}}={}){
 if(!pending)return false;
 const bundle=pending;await beforeApply();
 // set reloads this WebView. Never call from a frame, background event or download callback.
 await updater.set({id:bundle.id});return true;
}
