import {versionedStore} from '../ui/versioned-store.js';
import {catalog} from '../content/library.js';
export const REVISION_BATCH_KEY='ayah-revision-batch-v1';
export function revisionBatchStore(storage){const valid=r=>r===null||r&&['runner','defense','link'].includes(r.activity)&&Number.isSafeInteger(r.first)&&Number.isSafeInteger(r.last)&&Number.isSafeInteger(r.batchSize)&&r.batchSize>0&&r.batchSize<=300&&r.first>=1&&r.last>=r.first&&r.last<=(catalog.chapters.find(c=>c.id===r.surah)?.verseCount||0)&&r.settings&&Object.values(r.settings).every(v=>typeof v==='boolean'||typeof v==='string'&&v.length<60||Number.isFinite(v));return versionedStore(storage,REVISION_BATCH_KEY,()=>({version:1,selection:null}),s=>s?.version===1&&valid(s.selection));}
