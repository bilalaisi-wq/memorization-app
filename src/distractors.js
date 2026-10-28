import { surahs, wordAudio, shuffled } from "./data.js";

// Compare spelling without recitation marks; preserve the authenticated display text.
export const wordIdentity = (text) => text
  .normalize("NFKD")
  .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED\s]/g, "")
  .replace(/ٱ/g, "ا");

// Retain source occurrences so each selected word keeps its own exact recording.
export const distractorWords = surahs.flatMap((surah) =>
  surah.verses.flatMap((verse) => verse.words.map((text, i) => ({
    text,
    roman: verse.roman[i],
    meaning: verse.meanings[i][0],
    art: verse.meanings[i][1],
    audio: wordAudio(verse.id, i, surah.id),
    surah: surah.id,
    ayah: verse.id,
    position: i,
    source: `${surah.name} ${surah.id}:${verse.id}`,
  }))),
);

export function createDistractorPicker() {
  let recent = [];
  return (surahId, words, count) => {
    const excluded = new Set(words.map(wordIdentity));
    const used = new Set();
    const sources = new Set();
    const picked = [];
    const pool = shuffled(distractorWords.length)
      .map((i) => distractorWords[i])
      .filter((word) => word.surah !== surahId && !excluded.has(wordIdentity(word.text)));
    // Prefer unfamiliar words from different surahs, then relax only if necessary.
    for (const pass of [0, 1, 2]) {
      for (const word of pool) {
        const identity = wordIdentity(word.text);
        if (used.has(identity) || (pass < 2 && recent.includes(identity)) ||
            (pass === 0 && sources.has(word.surah))) continue;
        picked.push(word);
        used.add(identity);
        sources.add(word.surah);
        if (picked.length === count) break;
      }
      if (picked.length === count) break;
    }
    recent = [...recent, ...used].slice(-40);
    return picked;
  };
}
