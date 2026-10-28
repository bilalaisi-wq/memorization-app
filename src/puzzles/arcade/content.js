import {wordAudio, verseAudio} from '../../data.js';
import {wordIdentity} from '../../distractors.js';
export const difficultyProfiles = Object.freeze({
  gentle: Object.freeze({descentMs:1300, distractors:3, wordsVisible:true}),
  steady: Object.freeze({descentMs:700, distractors:3, wordsVisible:true}),
  swift: Object.freeze({descentMs:300, distractors:3, wordsVisible:true}),
});
export function seededShuffle(items, seed = 1) {
  let n = seed >>> 0;
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(n / 4294967296 * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Only pass already-authorized, verified library objects. No network text generation.
export function createContentAdapter(library) {
  const verses = new Map(library.flatMap(s => s.verses.map(v => [`${s.id}:${v.id}`, {s,v}])));
  const words = key => {
    const source = verses.get(key);
    if (!source) throw Error('Verified reference unavailable');
    const {s,v} = source;
    return v.words.map((text,index) => ({id:`${key}:${index}`, key, surah:s.id, ayah:v.id, index, text, audio:wordAudio(v.id,index,s.id)}));
  };
  return {
    words,
    audio(key) { words(key); const {s,v}=verses.get(key); return verseAudio(v.id,s.id); },
    configure({surah, start, end = start, mode = 'single', chainMode = 'classic', profile = 'gentle', seed = 1}) {
      if (!['single','chain'].includes(mode) || !['classic','practice'].includes(chainMode) || !difficultyProfiles[profile] || !Number.isInteger(start) || !Number.isInteger(end) || end < start || end-start > 49 || (mode==='single' && end!==start)) throw Error('Invalid arcade configuration');
      const keys = Array.from({length:end-start+1},(_,i)=>`${surah}:${start+i}`);
      keys.forEach(words);
      return {keys,mode,chainMode,profile,seed:seed>>>0};
    },
    phrases(key, segments) {
      const canonical = words(key);
      // Reviewed phrase boundaries only; visual drafts cannot authorize arcade phrases/stops.
      if (!Array.isArray(segments) || !segments.length) throw Error('Reviewed phrases required');
      let cursor = 0;
      const result = segments.map(segment => {
        const {startWord,endWord} = segment; // zero-based, end exclusive
        if (segment.key!==key || segment.status!=='approved' || !segment.reviewId || startWord!==cursor || !Number.isInteger(endWord) || endWord<=startWord || endWord>canonical.length) throw Error('Invalid reviewed phrase coverage');
        cursor=endWord;
        return {key,startWord,endWord,reviewId:segment.reviewId,words:canonical.slice(startWord,endWord),recitationStop:segment.recitationStop===true && segment.stopStatus==='approved'};
      });
      if (cursor!==canonical.length) throw Error('Incomplete phrase coverage');
      return result;
    },
    choices(key, {seed = 1, count = 3, maxWords = 40} = {}) {
      const target = words(key);
      if (target.length>maxWords) throw Error('Long ayah requires reviewed phrase workspace');
      if (!Number.isInteger(count) || count<0 || count>20) throw Error('Invalid distractor count');
      if(count===0) return seededShuffle(target.map(w=>({...w,target:true})),seed);
      const excluded = new Set(target.map(w=>wordIdentity(w.text)));
      const candidates = seededShuffle([...verses.keys()].filter(k=>k!==key).flatMap(words),seed);
      const extras=[];
      for (const word of candidates) {
        const identity=wordIdentity(word.text);
        if (excluded.has(identity)) continue;
        excluded.add(identity); extras.push({...word,target:false});
        if (extras.length===count) break;
      }
      if (extras.length!==count) throw Error('Insufficient verified distractors');
      return seededShuffle([...target.map(w=>({...w,target:true})),...extras],seed);
    },
  };
}
