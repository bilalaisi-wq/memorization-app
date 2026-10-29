// Suggestions only: never grade recall or change the FSRS schedule.
export function arcadeNextSteps({session,elapsed=0,goals,due=[],history=[],lastAyah,now=new Date(),activity='flight'}) {
  const keys=session.config.keys,last=Number(keys.at(-1).split(':')[1]),surah=Number(keys[0].split(':')[0]);
  const recent=new Set(history.filter(h=>h.game===(session.game||'asteroids')&&Date.parse(h.at)>=now.getTime()-86400000).map(h=>h.sessionId.split(':').slice(0,-2).join(':'))).size;
  const small=goals?.confidence==='shaky'||session.mistakes.length>0||goals?.minutes<=10;
  const size=small?1:Math.min(3,keys.length);
  const next=last<lastAyah?{first:last+1,last:Math.min(lastAyah,last+size),surah}:null;
  let title='Take one small step forward',reason=`Try recalling this ayah aloud, then choose another short ${activity} when you feel ready.`,action='recall',target=keys.at(-1);
  if(due.length){title='Make room for your due revision';reason='You have scheduled recall due. Review one now before adding more material.';target=due[0].key;}
  else if(goals?.confidence==='shaky'||session.mistakes.length){title='Strengthen this ayah before adding more';reason=`Try a short Practice session, repeat aloud with the reciter, then return for another ${activity}.`;action='practice';}
  else if(elapsed>=Math.min(goals?.minutes||15,20)*60||recent>=2){title='Give another memory skill a turn';reason=`You have done several ${activity}s or reached your study-time intention. Try self-assessed recall or take a break before another game.`;}
  else if(goals?.aim==='review'||goals?.known?.includes(surah)||goals?.confidence==='ready'){title='Try it without the visible words';reason=`Your revision goal or confidence suggests a self-assessed recitation. Record yourself and compare with the reciter; this ${activity} alone does not prove retention.`;}
  else if(goals?.targets?.length&&!goals.targets.includes(surah)){title='Return to your chosen surah goal';reason=`This ${activity} is complete. Continue your goal in Practice, then try recall when ready.`;action='practice';target=`${goals.targets[0]}:1`;}
  else if(next){action='continue';title=next.first===next.last?`Try ayah ${next.first} next`:`Try ayahs ${next.first}–${next.last} next`;reason=small?'Keep the pace gentle: one new ayah, then practise saying it without the pieces.':`Continue with a short ${activity}, then alternate with spoken recall. A puzzle win is practice, not proof of memorization.`;}
  return {title,reason,action,target,next};
}
