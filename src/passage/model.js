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
export function restoreWorkspace(bundle, segment, saved, layout = "legacy") {
  const windowFor = layout === "grouped" ? groupedWindow : wordWindow;
  const count = windowFor(bundle, 0, segment).count;
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
          !windowFor(bundle, Number(page), segment).words.some(w => w.position === id))) {
      throw Error("Saved workspace needs recovery; it has not been overwritten.");
    }
  }
  if (layout === "grouped") for (const [page, ids] of Object.entries(saved.orders)) {
    const groups = windowFor(bundle, Number(page), segment).groups;
    let remaining = [...ids];
    while (remaining.length) {
      const group = groups.find(g => g.id === remaining[0]);
      if (!group || !group.positions.every((id,i) => remaining[i] === id)) throw Error("Saved grouped workspace needs recovery; it has not been overwritten.");
      remaining = remaining.slice(group.positions.length);
    }
  }
  return structuredClone(saved);
}

// Visual grouping only: never a recitation stop or an independent recall unit.
export function groupedWindow(bundle, page = 0, segment = null) {
  const firstWord = segment?.firstWord ?? 1, lastWord = segment?.lastWord ?? bundle.words.length;
  if (!Number.isInteger(firstWord)||!Number.isInteger(lastWord)||firstWord<1||lastWord<firstWord||lastWord>bundle.words.length||bundle.words.some((w,i)=>w.position!==i+1)) throw Error("Invalid canonical word range.");
  const length = lastWord - firstWord + 1;
  const groupSize = length <= 12 ? 1 : length <= 24 ? 2 : length <= 36 ? 3 : 5;
  const capacity = WINDOW_SIZE * groupSize, count = Math.ceil(length / capacity);
  const index = Math.max(0, Math.min(page, count - 1)), first = firstWord + index * capacity, last = Math.min(lastWord, first + capacity - 1);
  const words = bundle.words.slice(first - 1, last), groups = [];
  for (let i = 0; i < words.length; i += groupSize) {
    const part = words.slice(i, i + groupSize);
    groups.push({id: part[0].position, positions: part.map(w => w.position), first: part[0].position, last: part.at(-1).position});
  }
  return {page:index, count, first, last, startWord:first, endWord:last, phrase:index+1, phraseCount:count, continuation:index>0, groupSize, groups, words};
}
