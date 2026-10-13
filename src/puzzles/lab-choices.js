import { shuffled, wordAudio, verseAudio } from "../data.js";
import { createDistractorPicker, wordIdentity } from "../distractors.js";
const pickWords = createDistractorPicker();
const recentPassages = [];
export const textIdentity = (words) =>
  words.map(wordIdentity).filter(Boolean).join(" ");
export function wordChoices(surah, verse, count) {
  const target = verse.words.map((text, i) => ({
    text,
    roman: verse.roman[i],
    meaning: verse.meanings[i][0],
    audio: wordAudio(verse.id, i, surah.id),
    surah: surah.id,
    ayah: verse.id,
    position: i,
  }));
  return [...target, ...pickWords(surah.id, verse.words, count)];
}
// Groups and ayahs remain contiguous, unchanged passages from verified source data.
export function passageChoices(surahs, surahId, excluded, lengths, count) {
  const blocked = new Set(excluded.map(textIdentity)),
    unique = new Set(),
    candidates = [];
  for (const words of excluded)
    for (const length of lengths.filter((length) => length !== null)) {
      for (let i = 0; i + length <= words.length; i++)
        blocked.add(textIdentity(words.slice(i, i + length)));
    }
  for (const s of surahs)
    for (const verse of s.verses) {
      if (s.id === surahId) continue;
      for (const length of new Set(lengths)) {
        if (length === null) {
          candidates.push({
            words: verse.words,
            roman: verse.roman,
            meanings: verse.meanings,
            surah: s.id,
            ayah: verse.id,
            start: 0,
            audio: [verseAudio(verse.id, s.id)],
          });
        } else
          for (let start = 0; start + length <= verse.words.length; start++) {
            candidates.push({
              words: verse.words.slice(start, start + length),
              roman: verse.roman.slice(start, start + length),
              meanings: verse.meanings.slice(start, start + length),
              surah: s.id,
              ayah: verse.id,
              start,
              audio: Array.from({ length }, (_, i) =>
                wordAudio(verse.id, start + i, s.id),
              ),
            });
          }
      }
    }
  const pool = shuffled(candidates.length).map((i) => candidates[i]);
  const selected = [];
  for (const avoidRecent of [true, false]) {
    for (const candidate of pool) {
      const identity = textIdentity(candidate.words);
      if (
        blocked.has(identity) ||
        unique.has(identity) ||
        (avoidRecent && recentPassages.includes(identity))
      )
        continue;
      selected.push(candidate);
      unique.add(identity);
      if (selected.length === count) break;
    }
    if (selected.length === count) break;
  }
  recentPassages.push(...selected.map((p) => textIdentity(p.words)));
  recentPassages.splice(0, Math.max(0, recentPassages.length - 40));
  return selected;
}
