import {arcadeIds} from './registry.js';
// Both stores are idempotent. A failed second write can be safely retried.
export function createResultRecorder({learning,lab,accountId,getAccountId}) {
  const identity=accountId ?? null;
  return snapshot=>{
    if (typeof getAccountId!=='function' || getAccountId()!==identity) throw Error('Account changed; reopen this game');
    if(snapshot.status!=='won' || !arcadeIds.includes(snapshot.game)) throw Error('Only completed arcade sessions can be rewarded');
    if(snapshot.completed.join('|')!==snapshot.config.keys.join('|')) throw Error('Incomplete checkpoints');
    const receipts=[];
    for(const key of snapshot.completed) {
      const mistakes=snapshot.mistakes.filter(e=>e.key===key).length;
      const assistance=snapshot.assistance.filter(e=>e.key===key).map(e=>({key,kind:e.kind}));
      const sessionId=`arcade:${snapshot.id}:${key}`;
      const reward=learning.recordLabPuzzle({key,sessionId,game:snapshot.game,mistakes,hinted:assistance.length>0});
      lab.record({key,sessionId,game:snapshot.game,mistakes,hinted:assistance.length>0,xp:reward.xp,
        arcade:{schemaVersion:3,success:true,mode:snapshot.config.mode,chainMode:snapshot.config.chainMode,seed:snapshot.config.seed,
          mistakes:snapshot.mistakes.filter(e=>e.key===key),motorErrors:snapshot.motorErrors.filter(e=>e.key===key),assistance,
          completedCheckpoints:[...snapshot.completed],
          ...(Number.isInteger(snapshot.studyScope?.firstWord)&&Number.isInteger(snapshot.studyScope?.lastWord)&&snapshot.studyScope.firstWord>=1&&snapshot.studyScope.lastWord>=snapshot.studyScope.firstWord?{studyScope:{kind:'visual-study',reference:key,firstWord:snapshot.studyScope.firstWord,lastWord:snapshot.studyScope.lastWord}}:{}),
          ...(snapshot.game==='snake'?{score:Number.isSafeInteger(snapshot.arcadeStats?.score)&&snapshot.arcadeStats.score>=0?snapshot.arcadeStats.score:0,steps:Number.isSafeInteger(snapshot.arcadeStats?.steps)&&snapshot.arcadeStats.steps>=0?snapshot.arcadeStats.steps:0,speed:['slow','steady','brisk'].includes(snapshot.arcadeStats?.speed)?snapshot.arcadeStats.speed:'slow'}:{})}});
      receipts.push(reward);
    }
    return receipts;
  };
}
