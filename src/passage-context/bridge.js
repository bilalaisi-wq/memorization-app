import {mountPassageArcade} from '../puzzles/arcade/passage/host.js';
// Keep the public route; use the same verified adapters, audio and receipts as Puzzle Lab.
export function mountContextBridge(root,{refs,client,isCurrent,verifyBundle,onComplete=()=>{}}){
 return mountPassageArcade(root,{refs,game:'bridge',client,isCurrent,verifyBundle,onComplete});
}
