import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  approvedRecitationSegments,
  canonicalSlice,
  canonicalSpans,
  displayRanges,
  draftSegments,
  validatePartition,
} from "../supabase/functions/_shared/segmentation.js";
import { localBundle } from "../src/content/library.js";
import { surahs } from "../src/data.js";
const fixture = (key) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${key}.json`, import.meta.url)));
test("supplied draft ranges cover exact canonical words and retain symbols without certifying stops", () => {
  for (const [key, count, n] of [["2-255", 50, 9], ["2-282", 128, 19]]) {
    const b = fixture(key), original = JSON.stringify(b), d = draftSegments(b);
    expect(d.segments).toHaveLength(n);
    expect(
      d.segments.every((s) =>
        s.stopStatus === "pending_review" && !s.recitationStop
      ),
    ).toBe(true);
    expect(
      d.segments.flatMap((s) =>
        Array.from(
          { length: s.endWord - s.startWord + 1 },
          (_, i) => s.startWord + i,
        )
      ),
    ).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    expect(canonicalSpans(b)).toHaveLength(count);
    expect(canonicalSlice(b, 1, count)).toBe(b.textUthmani.trim());
    expect(JSON.stringify(b)).toBe(original);
  }
  const draft = draftSegments(fixture("2-282"));
  expect(draft.segments.filter((s) => s.symbolMismatch).map((s) => s.endWord))
    .toEqual([95]);
  expect(draft.segments.find((s) => s.endWord === 95).actualPauseMark).toBe("ۖ");
  expect(draft.segments.find((s) => s.endWord === 95).pauseMark).toBe("none");
});
test("general segmentation applies to every currently available long ayah, never arbitrary recitation stops", () => {
  for (const s of surahs) {
    for (const v of s.verses) {
      const b = localBundle(`${s.id}:${v.id}`), d = draftSegments(b);
      if (b.words.length > 12) {
        expect(d).not.toBe(null);
        expect(() => validatePartition(d.segments, b.words.length)).not
          .toThrow();
        expect(d.segments.every((x) => x.stopStatus === "pending_review")).toBe(
          true,
        );
      } else expect(d).toBe(null);
    }
  }
});
test("rejected display boundaries merge without omitting text; stop approval alone never approves another boundary", () => {
  const b = fixture("2-282"), d = draftSegments(b);
  d.segments[0].displayStatus = "rejected";
  const updated = {
    ...b,
    segmentationReview: {
      ...d,
      version: 1,
      reviewerName: "TEST ONLY",
      reviewedAt: "2026-01-01",
    },
  };
  const ranges = displayRanges(updated);
  expect(ranges[0].startWord).toBe(1);
  expect(ranges[0].endWord).toBe(14);
  expect(ranges).toHaveLength(18);
  expect(approvedRecitationSegments(updated.segmentationReview, b)).toEqual([]);
  updated.segmentationReview.segments[1].stopStatus = "approved";
  updated.segmentationReview.segments[1].restartWord = 11;
  const approved = approvedRecitationSegments(updated.segmentationReview, b);
  expect(approved).toHaveLength(1);
  expect(approved[0].firstWord).toBe(1);
  expect(approved[0].lastWord).toBe(14);
  expect(approved[0].audioReview).toBeUndefined();
  expect(() =>
    validatePartition([{ startWord: 1, endWord: 10 }, {
      startWord: 10,
      endWord: 128,
    }], 128)
  ).toThrow();
  expect(() => validatePartition([{ startWord: 1, endWord: 127 }], 128))
    .toThrow();
});
