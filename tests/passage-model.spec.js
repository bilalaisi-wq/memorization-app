import { expect, test } from "@playwright/test";
import {
  allowedReference,
  availability,
  catalog,
  reference,
  reviewedSegments,
  validateBundle,
} from "../supabase/functions/_shared/content-policy.js";
import { localBundle } from "../src/content/library.js";
import {
  correct,
  hiddenWord,
  recallUnit,
  wordWindow,
} from "../src/passage/model.js";
import {
  createPassageMemory,
  PASSAGE_MEMORY_KEY,
} from "../src/passage/memory.js";
import { readFileSync } from "node:fs";
const long = JSON.parse(
  readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
);
const storage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
};
test("all 6236 references map exactly once to validated surah/juz metadata", () => {
  expect(catalog.chapters).toHaveLength(114);
  expect(catalog.juzs).toHaveLength(30);
  const refs = new Set();
  for (const j of catalog.juzs) {
    let count = 0;
    for (const range of j.ranges) {
      for (let a = range.first; a <= range.last; a++) {
        const key = `${range.surah}:${a}`;
        expect(refs.has(key)).toBe(false);
        refs.add(key);
        expect(reference(key).juz).toBe(j.id);
        count++;
      }
    }
    expect(count).toBe(j.verseCount);
  }
  expect(refs.size).toBe(6236);
  expect(reference("2:141").juz).toBe(1);
  expect(reference("2:142").juz).toBe(2);
  expect(reference("2:255").juz).toBe(3);
  expect(reference("67:1").juz).toBe(29);
  expect(() => reference("2:287")).toThrow();
  expect(availability.premium).toHaveLength(639);
  expect(availability.fullyVerifiedJuz).toEqual([29,30]);
  const juz29=availability.premium.filter(p=>p.juz===29);
  expect(juz29).toHaveLength(431);
  expect(new Set(juz29.map(p=>p.key)).size).toBe(431);
  for (const c of catalog.chapters.filter(c=>c.id>=67&&c.id<=77)) {
    expect(availability.fullyVerifiedSurahs).toContain(c.id);
    for(let a=1;a<=c.verseCount;a++) expect(juz29.some(p=>p.key===`${c.id}:${a}`)).toBe(true);
  }
  expect(allowedReference("78:1", { plan: "free", features: {} })).toBe(true);
  expect(
    allowedReference("67:1", {
      plan: "explorer",
      selectedJuz: [1, 2, 3, 4, 5],
    }),
  ).toBe(false);
  expect(allowedReference("67:1", { plan: "explorer", selectedJuz: [29] }))
    .toBe(false);
});
test("long ayah integrity and windows preserve exact words and never invent reviewed recitation stops", async () => {
  expect(validateBundle(long, "2:282")).toBe(long);
  expect(long.words).toHaveLength(128);
  expect(reviewedSegments(long)).toHaveLength(1);
  const collected = [];
  for (let p = 0; p < wordWindow(long, 0).count; p++) {
    const w = wordWindow(long, p);
    expect(w.words.length).toBeLessThanOrEqual(12);
    collected.push(...w.words);
  }
  expect(collected).toEqual(long.words);
  expect(correct(collected.map((w) => w.position), long.words)).toBe(true);
  expect(correct(collected.map((w) => w.position).reverse(), long.words)).toBe(
    false,
  );
  expect(() =>
    validateBundle({ ...long, textUthmani: long.textUthmani + "ا" }, long.key)
  ).toThrow();
  const draft = {
    id: "draft",
    reference: long.key,
    kind: "reviewed",
    firstWord: 1,
    lastWord: 12,
    review: { status: "draft" },
  };
  await expect(recallUnit([long], draft)).rejects.toThrow();
  expect(() =>
    validateBundle({ ...long, segments: [...long.segments, draft] }, long.key)
  ).toThrow();
  expect(hiddenWord(2, 1)).toBe(true);
  expect(hiddenWord(1, 1)).toBe(false);
  expect(hiddenWord(1, 2)).toBe(true);
});
test("passage FSRS separates recall units, assisted work, due dates and duplicate grades; reload preserves records", async () => {
  const s = storage(),
    clock = () => new Date("2026-01-01T12:00:00Z"),
    m = createPassageMemory(s, { clock, timeZone: "UTC" }),
    unit = await recallUnit([long]);
  let a = m.begin(unit);
  m.update("compared");
  const assisted = m.grade(a.id, "Good");
  expect(assisted.independent).toBe(false);
  expect(m.snapshot().records[unit.id].card).toBe(null);
  a = m.begin(unit);
  m.update("declared");
  m.update("compared");
  const result = m.grade(a.id, "Good");
  expect(result.independent).toBe(true);
  expect(result.nextReview).not.toBe(null);
  const before = m.snapshot();
  expect(m.grade(a.id, "Good")).toEqual(result);
  expect(m.snapshot()).toEqual(before);
  expect(createPassageMemory(s, { clock }).snapshot()).toEqual(before);
  const passage = await recallUnit([localBundle("1:1"), localBundle("1:2")]);
  expect(passage.id).not.toBe(unit.id);
  expect(passage.type).toBe("passage");
  const failed = {
    getItem: s.getItem,
    setItem() {
      throw Error("Storage full");
    },
  };
  const bad = createPassageMemory(failed, { clock });
  expect(() => bad.begin(passage)).toThrow();
  expect(bad.snapshot()).toEqual(before);
});
test("corrupt passage reviews are preserved; segment revision IDs cannot inherit full-ayah mastery", async () => {
  const s = storage();
  s.setItem(PASSAGE_MEMORY_KEY, '{"futureVersion":99}');
  const m = createPassageMemory(s);
  expect(m.warning).toContain("recovery");
  expect(() => m.begin({ id: "x", type: "ayah", refs: ["1:1"] })).toThrow();
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe('{"futureVersion":99}');
  // Boundary mechanics only: test approvals are fixtures, never shipped with content.
  const segment = {
    id: "fixture-only",
    kind: "reviewed",
    reference: "2:282",
    firstWord: 1,
    lastWord: 2,
    startMs: 0,
    endMs: 1000,
    review: {
      status: "approved",
      reviewer: "TEST FIXTURE",
      reviewedAt: "2026-01-01",
      evidence: "Not a religious review",
    },
  };
  const a = { ...long, segments: [...long.segments, segment] },
    u = await recallUnit([a], segment);
  const changed = { ...segment, lastWord: 3 };
  const v = await recallUnit([{
    ...long,
    segments: [...long.segments, changed],
  }], changed);
  expect(u.id).not.toBe(v.id);
  expect(u.id).not.toBe((await recallUnit([long])).id);
});
