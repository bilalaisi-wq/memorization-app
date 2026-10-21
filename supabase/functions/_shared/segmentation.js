import draft from "./quran_long_ayah_segments_DRAFT.json" with { type: "json" };
export { draft };
const marks = /[\u06d6-\u06dc]/g;
const normalize = (t) =>
  t.replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g, "");
export function canonicalSpans(bundle) {
  const spans = [];
  let word = 0;
  for (const match of bundle.textUthmani.matchAll(/\S+/g)) {
    if (!normalize(match[0])) {
      if (!spans.length) throw Error("Unexpected opening mark");
      spans.at(-1).end = match.index + match[0].length;
      continue;
    }
    if (normalize(match[0]) !== normalize(bundle.words[word]?.text || "")) {
      throw Error("Canonical orthographic words do not align");
    }
    spans.push({
      position: ++word,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  if (word !== bundle.words.length) {
    throw Error("Canonical word count mismatch");
  }
  return spans;
}
export function canonicalSlice(bundle, first, last) {
  const spans = canonicalSpans(bundle);
  if (!spans[first - 1] || !spans[last - 1] || last < first) {
    throw Error("Invalid canonical range");
  }
  return bundle.textUthmani.slice(spans[first - 1].start, spans[last - 1].end);
}
export function validatePartition(segments, total) {
  if (!Array.isArray(segments) || !segments.length) {
    throw Error("No study segments");
  }
  let next = 1;
  for (const s of segments) {
    if (
      !Number.isInteger(s.startWord) || !Number.isInteger(s.endWord) ||
      s.startWord !== next || s.endWord < s.startWord || s.endWord > total
    ) {
      throw Error(
        "Study segments contain a gap, overlap or invalid word index",
      );
    }
    next = s.endWord + 1;
  }
  if (next !== total + 1) throw Error("Study segments omit words");
  return segments;
}
export function draftSegments(bundle) {
  let source = draft.verses.find((v) => v.verse_key === bundle.key);
  if (!source) {
    if (bundle.words.length <= 12) return null;
    const spans = canonicalSpans(bundle),
      endpoints = spans.filter((span) =>
        /[\u06d6-\u06dc]/.test(
          bundle.textUthmani.slice(span.start, span.end),
        ) || span.position === bundle.words.length
      );
    let first = 1;
    source = {
      verse_key: bundle.key,
      total_words: bundle.words.length,
      riwayah: "Hafs an Asim; source edition requires teacher confirmation",
      segments: endpoints.map((span, i) => {
        const symbol = span.position === bundle.words.length
          ? "end_of_ayah"
          : (bundle.textUthmani.slice(span.start, span.end).match(
            /[\u06d6-\u06dc]/g,
          ) || []).at(-1);
        const row = {
          segment: i + 1,
          start_word: first,
          end_word: span.position,
          arabic_topic: "Study phrase " + (i + 1),
          source_pause_symbol: symbol,
          boundary_type: span.position === bundle.words.length
            ? "verse_end"
            : "mushaf_pause_mark_present",
        };
        first = span.position + 1;
        return row;
      }),
    };
  }

  if (source.total_words !== bundle.words.length) {
    throw Error(
      "Research draft word count differs from the authoritative text",
    );
  }
  const segments = source.segments.map((s) => ({
    id: s.segment,
    startWord: s.start_word,
    endWord: s.end_word,
    topic: s.arabic_topic,
    pauseMark: s.source_pause_symbol,
    displayStatus: "pending_review",
    stopStatus: "pending_review",
    recitationStop: false,
    restartWord: null,
    boundaryType: s.boundary_type,
  }));
  validatePartition(segments, source.total_words);
  for (const s of segments) {
    const actual =
      [...canonicalSlice(bundle, s.endWord, s.endWord).matchAll(marks)].map(
        (m) => m[0],
      ).at(-1) || "none";
    s.actualPauseMark = s.endWord === bundle.words.length
      ? "end_of_ayah"
      : actual;
    s.symbolMismatch = s.pauseMark !== s.actualPauseMark;
  }
  return {
    verseKey: bundle.key,
    totalWords: source.total_words,
    sourceEdition:
      "Quran.com Uthmani / Madinah-style marks — edition to be confirmed by reviewer",
    riwayah: source.riwayah,
    version: 0,
    segments,
  };
}
export function studySegmentation(bundle) {
  const initial = draftSegments(bundle);
  if (!initial) return null;
  const review = bundle.segmentationReview;
  if (!review) return initial;
  validatePartition(review.segments, bundle.words.length);
  return {
    ...review,
    segments: review.segments.map((s) => ({
      ...s,
      recitationStop: s.stopStatus === "approved",
      actualPauseMark: initial.segments.find((x) => x.endWord === s.endWord)
        ?.actualPauseMark ||
        [...canonicalSlice(bundle, s.endWord, s.endWord).matchAll(marks)].map(
          (m) => m[0],
        ).at(-1) || "none",
    })),
  };
}
export function displayRanges(bundle) {
  const data = studySegmentation(bundle);
  if (!data) {
    return [{
      startWord: 1,
      endWord: bundle.words.length,
      topic: "Whole ayah",
      continued: false,
    }];
  }
  const ranges = [];
  let start = 1;
  for (const s of data.segments) {
    if (s.displayStatus === "rejected" && s.endWord !== bundle.words.length) {
      continue;
    }
    ranges.push({
      ...s,
      startWord: start,
      continued: s.boundaryType === "phrase_only_no_attested_pause_mark" ||
        s.pauseMark === "none",
    });
    start = s.endWord + 1;
  }
  validatePartition(ranges, bundle.words.length);
  return ranges;
}
export function approvedRecitationSegments(review, bundle) {
  if (!review) return [];
  validatePartition(review.segments, bundle.words.length);
  const output = [];
  let start = 1;
  for (const row of review.segments) {
    if (row.stopStatus !== "approved") continue;
    if (
      !Number.isInteger(row.restartWord) || row.restartWord < 1 ||
      row.restartWord > bundle.words.length
    ) continue;
    output.push({
      id: `review-${review.version}-${row.id}`,
      reference: bundle.key,
      kind: "reviewed",
      firstWord: start,
      lastWord: row.endWord,
      review: {
        status: "approved",
        reviewer: review.reviewerName,
        reviewedAt: review.reviewedAt,
        evidence: review.sourceEdition + " · " + review.riwayah +
          " · revision " + review.version,
      },
      startMs: row.audioStartMs,
      endMs: row.audioEndMs,
      audioReview: row.audioApproved
        ? {
          status: "approved",
          reviewer: review.reviewerName,
          reviewedAt: review.reviewedAt,
          evidence: review.sourceEdition,
        }
        : undefined,
    });
    start = row.restartWord;
  }
  return output.filter((s) => s.firstWord <= s.lastWord);
}
