// Visual study cues only. Source positions, correctness, rewards and FSRS never use colors.
export const PIECE_COLORS_KEY='ayah-piece-appearance-v1';
export const COLOR_COUNT=12;
export function createPieceColors(count,previous=[],random=Math.random){
 const palette=[];let remaining=[];
 for(let i=0;i<count;i++){
  if(!remaining.length)remaining=Array.from({length:COLOR_COUNT},(_,c)=>c);
  let choices=remaining.filter(c=>c!==previous[i]&&c!==palette[i-1]);
  if(!choices.length)choices=Array.from({length:COLOR_COUNT},(_,c)=>c).filter(c=>c!==previous[i]&&c!==palette[i-1]);
  const color=choices[Math.floor(random()*choices.length)];palette.push(color);remaining=remaining.filter(c=>c!==color);
 }
 return palette;
}
export function colorDifficulty(storage){try{const value=JSON.parse(storage.getItem(PIECE_COLORS_KEY));return value?.version===1&&value.mode==='neutral'?'neutral':'mixed';}catch{return 'mixed';}}
export function setColorDifficulty(storage,mode){if(!['mixed','neutral'].includes(mode))throw Error('Unknown color difficulty.');storage.setItem(PIECE_COLORS_KEY,JSON.stringify({version:1,mode}));}
export function pieceColorClass(colors,index,mode){return mode==='neutral'?'piece-neutral':`color-${colors[index]}`;}
