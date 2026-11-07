import {difficultyKey} from '../difficulty.js';
import {versionedStore} from '../../../ui/versioned-store.js';
import {mazeCheckpoint} from './engine.js';
export const MAZE_CHECKPOINT_KEY='ayah-maze-expeditions-v2';
export const mazeRouteKey=(config,difficulty)=>`${config.keys.join(',')}|${config.chainMode}|${difficulty}|${config.correctionRooms===false?'no-corrections':'corrections'}|${config.mazeScope||'whole'}` + difficultyKey(config);
export function createMazeCheckpoints(storage){
 const store=versionedStore(storage,MAZE_CHECKPOINT_KEY,()=>({version:2,runs:{}}),s=>s?.version===2&&s.runs&&typeof s.runs==='object'&&!Array.isArray(s.runs)&&Object.values(s.runs).every(r=>r?.version===2&&r.session?.config&&typeof r.revision==='string'));
 return {get warning(){return store.warning;},read(config,difficulty){return store.snapshot().runs[mazeRouteKey(config,difficulty)]||null;},save(state){store.transact(s=>{s.runs[mazeRouteKey(state.session.config,state.difficulty)]=mazeCheckpoint(state);});}};
}
