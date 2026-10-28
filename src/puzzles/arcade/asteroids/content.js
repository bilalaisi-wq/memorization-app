import {wordIdentity} from '../../../distractors.js';
import {seededShuffle} from '../content.js';

export const asteroidProfiles = Object.freeze({
  beginner: {speed:22, simultaneous:3, distractors:1, cue:true},
  standard: {speed:35, simultaneous:5, distractors:3, cue:false},
  expert: {speed:42, simultaneous:3, distractors:2, cue:false},
});
const identity = words => words.map(w=>wordIdentity(w.text)).join(' ');
const unit = (words, order, target=true) => ({id:`${words[0].key}:${words[0].index}-${words.at(-1).index}`,key:words[0].key,words,order,target});

// Only authenticated/published, source-hash-matched review documents belong in reviews.
export function buildSectors(adapter, config, library, {difficulty='beginner', reviews={}}={}) {
  if(!asteroidProfiles[difficulty]) throw Error('Unknown flight difficulty');
  const phrasePool=library.flatMap(s=>s.verses.filter(v=>v.words.length<=8).map(v=>unit(adapter.words(`${s.id}:${v.id}`),-1,false)));
  return config.keys.map((key,sector)=>{
    const canonical=adapter.words(key),review=reviews[key];
    const phrases=difficulty==='expert'||canonical.length>40;
    let targets;
    if(phrases) {
      if(review) targets=adapter.phrases(key,review).map((p,i)=>unit(p.words,i));
      else if(canonical.length<=8) targets=[unit(canonical,0)]; // Full ayah is an existing verified boundary.
      else throw Error(`${key}: phrase flight needs published teacher-approved study boundaries. Choose Beginner/Standard for short ayahs.`);
      if(targets.some(t=>t.words.length>12)) throw Error(`${key}: approved phrases are too large for a readable flight workspace.`);
    } else targets=canonical.map((w,i)=>unit([w],i));
    const excluded=new Set(targets.map(t=>identity(t.words)));
    let candidates=phrases?phrasePool.filter(p=>p.key!==key && !excluded.has(identity(p.words))):adapter.choices(key,{seed:config.seed+sector,count:12}).filter(w=>!w.target).map(w=>unit([w],-1,false));
    candidates=seededShuffle(candidates,config.seed+sector);
    if(difficulty==='expert') {
      const target=identity(targets[0].words);
      const similarity=p=>{const value=identity(p.words);return [...value].filter(c=>target.includes(c)).length/Math.max(value.length,target.length);};
      candidates.sort((a,b)=>similarity(b)-similarity(a));
    }
    const seen=new Set(),distractors=[];
    for(const candidate of candidates){const text=identity(candidate.words);if(seen.has(text))continue;seen.add(text);distractors.push(candidate);if(distractors.length===asteroidProfiles[difficulty].distractors)break;}
    if(!distractors.length)throw Error('No verified distractors available');
    return {key,targets,distractors,words:canonical,audio:adapter.audio(key),phrases};
  });
}
