import {createMission,cosmicSurahs} from './mission.js';
import {createLinkEvidence,weakLinkCandidates} from './link-evidence.js';
import {createExpeditionStore} from './expedition/store.js';
import {expeditionWeakLinks} from './expedition/weakness.js';
export async function repairMissions({linkData=createLinkEvidence(null).snapshot(),expeditions=createExpeditionStore().snapshot()}={}){
 const refs=cosmicSurahs.flatMap(s=>s.verses.map(v=>`${s.id}:${v.id}`)),weak=await expeditionWeakLinks({refs},expeditions,await weakLinkCandidates(linkData,{refs,limit:50}));
 const plans=[];for(const w of weak.filter(w=>w.selectionMistakes+w.typedMismatches+w.selfReportedDifficulty>=2).slice(0,5)){
  const [surah,from]=w.fromRef.split(':').map(Number),last=cosmicSurahs.find(s=>s.id===surah).verses.length;
  plans.push({pairKey:w.pairKey,evidenceIds:w.evidenceIds,reason:w.reason,mission:await createMission({surahId:surah,selection:'custom',start:Math.max(1,from-1),end:Math.min(last,from+2)})});
 }return plans;
}
