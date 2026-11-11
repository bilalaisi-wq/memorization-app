import { seededShuffle } from "../../puzzles/arcade/content.js";
// Avalanche adjacent small seeds before Fisher-Yates: the first LCG output alone
// otherwise puts the first item in the same slot for long runs of nearby seeds.
export function answerOrder(items, seed) {
  let n = seed >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return seededShuffle(items, (n ^ (n >>> 16)) >>> 0);
}
