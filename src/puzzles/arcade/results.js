import {arcadeIds} from './registry.js';
// Both stores are idempotent. A failed second write can be safely retried.
export function createResultRecorder({learning,lab,accountId,getAccountId}) {
  const identity=accountId ?? null;
  return snapshot=>{
    if (typeof getAccountId!=='function' || getAccountId()!==identity) throw Error('Account changed; reopen this game');
    if(snapshot.status!=='won' || !arcadeIds.includes(snapshot.game)) throw Error('Only completed arcade sessions can be rewarded');
    if(snapshot.completed.join('|')!==snapshot.config.keys.join('|')) throw Error('Incomplete checkpoints');
    if(snapshot.game==='bridge'&&snapshot.bridgeVersion===2){
      const source=snapshot.config.sourceKeys;
      if(!Array.isArray(source)||source.slice(1).join('|')!==snapshot.config.keys.join('|')||!Array.isArray(snapshot.transitions)||snapshot.transitions.length!==source.length-1||snapshot.transitions.some((t,i)=>t.from!==source[i]||t.to!==source[i+1]||t.id!==`${t.from}>${t.to}`||Number(t.to.split(':')[0])!==Number(t.from.split(':')[0])||Number(t.to.split(':')[1])!==Number(t.from.split(':')[1])+1))throw Error('Invalid transition results');
    }
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
          ...(snapshot.game==='bridge'?{...(snapshot.bridgeVersion===2?{bridgeVersion:2,transition:snapshot.transitions.find(t=>t.to===key),transitionErrors:(snapshot.transitionErrors||[]).filter(e=>e.to===key&&snapshot.transitions.some(t=>t.id===e.transitionId&&t.from===e.from&&t.to===e.to)).map(e=>({transitionId:e.transitionId,from:e.from,to:e.to,selected:e.selected,event:e.event}))}:{}),score:Number.isSafeInteger(snapshot.arcadeStats?.score)&&snapshot.arcadeStats.score>=0?snapshot.arcadeStats.score:0,engineeringErrors:Number.isSafeInteger(snapshot.arcadeStats?.engineeringErrors)&&snapshot.arcadeStats.engineeringErrors>=0?snapshot.arcadeStats.engineeringErrors:0,tests:Number.isSafeInteger(snapshot.arcadeStats?.tests)&&snapshot.arcadeStats.tests>=0?snapshot.arcadeStats.tests:0}:{}),
          ...(snapshot.game==='sirat'?{score:Number.isSafeInteger(snapshot.arcadeStats?.score)&&snapshot.arcadeStats.score>=0?snapshot.arcadeStats.score:0,recoveries:Number.isSafeInteger(snapshot.arcadeStats?.recoveries)&&snapshot.arcadeStats.recoveries>=0?snapshot.arcadeStats.recoveries:0}:{}),
          ...(snapshot.game==='bubble'?{score:Number.isSafeInteger(snapshot.arcadeStats?.score)&&snapshot.arcadeStats.score>=0?snapshot.arcadeStats.score:0,shots:Number.isSafeInteger(snapshot.arcadeStats?.shots)&&snapshot.arcadeStats.shots>=0?snapshot.arcadeStats.shots:0,bounces:Number.isSafeInteger(snapshot.arcadeStats?.bounces)&&snapshot.arcadeStats.bounces>=0?snapshot.arcadeStats.bounces:0}:{}),
          ...(snapshot.game==='snake'?{score:Number.isSafeInteger(snapshot.arcadeStats?.score)&&snapshot.arcadeStats.score>=0?snapshot.arcadeStats.score:0,steps:Number.isSafeInteger(snapshot.arcadeStats?.steps)&&snapshot.arcadeStats.steps>=0?snapshot.arcadeStats.steps:0,speed:['slow','steady','brisk'].includes(snapshot.arcadeStats?.speed)?snapshot.arcadeStats.speed:'slow'}:{})}});
      receipts.push(reward);
    }
    return receipts;
  };
}
