export const memoryDifficulties=Object.freeze(['guided','standard','expert']);
export const motorDifficulties=Object.freeze(['relaxed','normal','arcade']);
const memoryMap={guided:'beginner',standard:'standard',expert:'expert'},motorMap={relaxed:'beginner',normal:'standard',arcade:'expert'};
export function validateDifficulties({memoryDifficulty='guided',motorDifficulty='relaxed'}={}){if(!memoryDifficulties.includes(memoryDifficulty)||!motorDifficulties.includes(motorDifficulty))throw Error('Choose a supported memory and movement setting.');return {memoryDifficulty,motorDifficulty};}
export const memoryLevel=(c,legacy='beginner')=>c?.difficultySchema===1?memoryMap[validateDifficulties(c).memoryDifficulty]:legacy;
export const motorLevel=(c,legacy='beginner')=>c?.difficultySchema===1?motorMap[validateDifficulties(c).motorDifficulty]:legacy;
export const snakeMotor=c=>({relaxed:'slow',normal:'steady',arcade:'brisk'})[validateDifficulties(c).motorDifficulty];
export const blocksMotor=c=>({relaxed:'slow',normal:'normal',arcade:'fast'})[validateDifficulties(c).motorDifficulty];
export function annotateDifficulty(config,legacy='beginner',speed=null){return {...config,memoryDifficulty:config.memoryDifficulty||({beginner:'guided',standard:'standard',expert:'expert'}[legacy]||'guided'),motorDifficulty:config.motorDifficulty||(config.siratRelaxed?'relaxed':null)||({slow:'relaxed',steady:'normal',brisk:'arcade',normal:'normal',fast:'arcade'}[speed]||{beginner:'relaxed',standard:'normal',expert:'arcade'}[legacy]||'relaxed')};}
export const difficultyKey=c=>c?.difficultySchema===1?`|profiles:${c.memoryDifficulty}:${c.motorDifficulty}|unit:${c.sourceUnitKind||'words'}|stage:${c.contextStageId||'whole'}`:'';
