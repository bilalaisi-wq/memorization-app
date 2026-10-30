import { displayRanges } from "../../supabase/functions/_shared/segmentation.js";
import {
  reviewedSegments,
  sha256,
} from "../../supabase/functions/_shared/content-policy.js";
export const WINDOW_SIZE = 12;
export function wordWindow(bundle, page, segment = null) {
  const ranges = segment
      ? [{ startWord: segment.firstWord, endWord: segment.lastWord }]
      : displayRanges(bundle),
    pages = [];
  ranges.forEach((range, phrase) => {
    for (
      let first = range.startWord;
      first <= range.endWord;
      first += WINDOW_SIZE
    ) {
      pages.push({
        ...range,
        first,
        last: Math.min(range.endWord, first + WINDOW_SIZE - 1),
        phrase: phrase + 1,
        continuation: first > range.startWord || range.continued,
      });
    }
  });
  const index = Math.max(0, Math.min(page, pages.length - 1)), w = pages[index];
  return {
    ...w,
    page: index,
    count: pages.length,
    phraseCount: ranges.length,
    words: bundle.words.slice(w.first - 1, w.last),
  };
}
export function shuffled(ids) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result.every((n, i) => n === ids[i])) {
    result.push(result.shift());
  }
  return result;
}
export function correct(order, words) {
  return order.length === words.length &&
    order.every((id, i) =>
      words.find((w) => w.position === id)?.text === words[i].text
    );
}
export function hiddenWord(position, level) {
  return level === 2 || level === 1 && position % 2 === 0;
}
export async function recallUnit(bundles, segment = null) {
  if (segment) {
    if (
      !reviewedSegments(bundles[0]).some((s) =>
        s.id === segment.id && s.kind === "reviewed"
      )
    ) throw Error("Segment is not reviewed.");
    const hash = await sha256(
      JSON.stringify({
        key: bundles[0].key,
        text: bundles[0].textUthmani,
        segment,
      }),
    );
    return {
      id: `segment:${bundles[0].key}:${segment.id}:${hash.slice(0, 20)}`,
      type: "segment",
      refs: [bundles[0].key],
      segment: segment.id,
      firstWord: segment.firstWord,
      lastWord: segment.lastWord,
      revision: hash,
    };
  }
  const refs = bundles.map((b) => b.key);
  if (refs.length === 1) return { id: `ayah:${refs[0]}`, type: "ayah", refs };
  return {
    id: `passage:${(await sha256(refs.join("|"))).slice(0, 24)}`,
    type: "passage",
    refs,
  };
}

// Validate saved positions against the current source/review without repairing or
// discarding the original record. Older schema-1 records remain supported.
export function restoreWorkspace(bundle, segment, saved) {
  const count = wordWindow(bundle, 0, segment).count;
  if (!saved || !Number.isInteger(saved.page) || saved.page < 0 || saved.page >= count ||
      ![0, 1, 2].includes(saved.level) || !saved.orders || typeof saved.orders !== "object" || Array.isArray(saved.orders) ||
      !Array.isArray(saved.windowSequence) || saved.windowSequence.length !== count ||
      new Set(saved.windowSequence).size !== count ||
      saved.windowSequence.some(p => !Number.isInteger(p) || p < 0 || p >= count)) {
    throw Error("Saved workspace needs recovery; it has not been overwritten.");
  }
  for (const [page, ids] of Object.entries(saved.orders)) {
    if (!/^\d+$/.test(page) || Number(page) >= count || !Array.isArray(ids) ||
        new Set(ids).size !== ids.length || ids.some(id =>
          !wordWindow(bundle, Number(page), segment).words.some(w => w.position === id))) {
      throw Error("Saved workspace needs recovery; it has not been overwritten.");
    }
  }
  return structuredClone(saved);
}
