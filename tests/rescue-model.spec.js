import { test, expect } from "@playwright/test";
import {
  createPassageMemory,
  PASSAGE_MEMORY_KEY,
} from "../src/passage/memory.js";
import { localBundle } from "../src/content/library.js";
import { recallUnit } from "../src/passage/model.js";
import {
  rescueMap,
  dailyRoute,
  savedReview,
} from "../src/quest/rescue/model.js";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
const begin = async (memory, key = "1:1") =>
  memory.begin(await recallUnit([localBundle(key)]));
async function independent(memory, grade = "Good", key = "1:1") {
  const a = await begin(memory, key);
  memory.update("declared");
  memory.update("compared");
  return { attempt: a, result: memory.grade(a.id, grade) };
}

test("stars require a scheduled card and actual successful independent passage history, not puzzles or listening", async () => {
  const s = storage(),
    m = createPassageMemory(s, {
      clock: () => new Date("2026-01-01T12:00Z"),
      timeZone: "UTC",
    });
  const attempt = await begin(m);
  m.update("compared");
  m.grade(attempt.id, "Good");
  expect(rescueMap(m.snapshot()).stars).toHaveLength(0);
  const again = await independent(m, "Again", "1:2");
  expect(again.result.scheduled).toBe(true);
  expect(rescueMap(m.snapshot()).stars).toHaveLength(0);
  await independent(m, "Good", "1:3");
  expect(rescueMap(m.snapshot()).stars.map((s) => s.unit.refs)).toEqual([
    ["1:3"],
  ]);
  expect(rescueMap({ records: {} }).stars).toEqual([]);
});
test("upcoming, due and waiting states use unchanged card dates and local day boundaries", async () => {
  const s = storage();
  let now = new Date("2026-01-01T17:00Z");
  const m = createPassageMemory(s, {
    clock: () => now,
    timeZone: "America/Chicago",
  });
  await independent(m);
  const raw = s.getItem(PASSAGE_MEMORY_KEY),
    due = new Date(m.snapshot().records["ayah:1:1"].card.due);
  expect(
    rescueMap(m.snapshot(), { now: new Date(+due - 1) }).stars[0].state,
  ).toBe("upcoming");
  expect(rescueMap(m.snapshot(), { now: due }).stars[0].state).toBe("due");
  expect(
    rescueMap(m.snapshot(), { now: new Date(+due + 3 * 86400000) }).stars[0]
      .state,
  ).toBe("overdue");
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(raw);
  const doc = m.snapshot();
  doc.records["ayah:1:1"].card.due = "2026-03-08T05:59:00Z";
  expect(
    rescueMap(doc, { now: new Date("2026-03-08T06:01:00Z") }).stars[0].state,
  ).toBe("overdue");
});
for (const grade of ["Again", "Hard", "Good", "Easy"])
  test(`${grade} delegates scheduling to the existing store and reload preserves the exact resulting due date`, async () => {
    const s = storage();
    let now = new Date("2026-01-01T12:00Z");
    const m = createPassageMemory(s, { clock: () => now, timeZone: "UTC" });
    await independent(m);
    now = new Date(m.snapshot().records["ayah:1:1"].card.due);
    const { attempt, result } = await independent(m, grade);
    expect(result.scheduled).toBe(true);
    const record = m.snapshot().records["ayah:1:1"];
    expect(record.card.due).toBe(result.nextReview);
    expect(rescueMap(m.snapshot(), { now }).stars[0].due).toBe(
      result.nextReview,
    );
    const before = m.snapshot();
    expect(m.grade(attempt.id, grade)).toEqual(result);
    expect(m.snapshot()).toEqual(before);
    expect(createPassageMemory(s).snapshot().records["ayah:1:1"].card).toEqual(
      record.card,
    );
    expect(savedReview(m.snapshot(), attempt.id).attempt.grade).toBe(grade);
  });
test("assisted and early successful assessments retain existing due dates and cannot become scheduled restoration events", async () => {
  const s = storage(),
    m = createPassageMemory(s, {
      clock: () => new Date("2026-01-01T12:00Z"),
      timeZone: "UTC",
    });
  await independent(m);
  const card = structuredClone(m.snapshot().records["ayah:1:1"].card);
  const assisted = await begin(m);
  m.update("compared");
  m.grade(assisted.id, "Good");
  expect(m.snapshot().records["ayah:1:1"].card).toEqual(card);
  expect(savedReview(m.snapshot(), assisted.id).attempt.independent).toBe(
    false,
  );
  const early = await independent(m);
  expect(early.result.scheduled).toBe(false);
  expect(m.snapshot().records["ayah:1:1"].card).toEqual(card);
});
test("daily routes use oldest due units only, skip has no persistence effect, and long breaks never create lapse history", async () => {
  const s = storage();
  let now = new Date("2026-01-01T12:00Z");
  const m = createPassageMemory(s, { clock: () => now, timeZone: "UTC" });
  await independent(m, "Good", "1:1");
  now = new Date("2026-01-02T12:00Z");
  await independent(m, "Good", "1:2");
  const before = s.getItem(PASSAGE_MEMORY_KEY),
    model = rescueMap(m.snapshot(), { now: new Date("2027-01-01") });
  expect(dailyRoute(model, { limit: 1 })).toEqual(["ayah:1:1"]);
  expect(dailyRoute(model, { skip: ["ayah:1:1"] })).toEqual(["ayah:1:2"]);
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(before);
  expect(m.snapshot().records["ayah:1:1"].history).toHaveLength(1);
});

test("changed reviewed segment boundaries cannot inherit an older review unit", async () => {
  const { readFileSync } = await import("node:fs");
  const { verifyRescueUnit } = await import("../src/quest/rescue/content.js");
  const source = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  const segment = {
    id: "fixture-only",
    kind: "reviewed",
    reference: source.key,
    firstWord: 1,
    lastWord: 2,
    review: {
      status: "approved",
      reviewer: "TEST FIXTURE",
      reviewedAt: "2026-01-01",
      evidence: "Test mechanics only; not production waqf approval",
    },
  };
  const old = { ...source, segments: [...source.segments, segment] },
    unit = await recallUnit([old], segment);
  const client = {
    functions: {
      invoke: async () => ({ data: structuredClone(old), error: null }),
    },
  };
  await expect(verifyRescueUnit(unit, client)).resolves.toHaveLength(1);
  const changed = {
    ...source,
    segments: [...source.segments, { ...segment, lastWord: 3 }],
  };
  client.functions.invoke = async () => ({
    data: structuredClone(changed),
    error: null,
  });
  await expect(verifyRescueUnit(unit, client)).rejects.toThrow("changed");
});
