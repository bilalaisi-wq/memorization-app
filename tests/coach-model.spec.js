import { expect, test } from "@playwright/test";
import { coachSnapshot, materializePlan } from "../src/coach/model.js";
import {
  buildPlan,
  validateAdvice,
  validateSummary,
} from "../supabase/functions/_shared/coach-core.js";
import { createLearningStore } from "../src/learning-store.js";
import { surahs } from "../src/data.js";
const now = new Date("2026-10-26T12:00:00Z");
const storage = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
const memory = (extra = {}) => ({
  stage: "reviewing",
  history: [],
  successfulDays: [],
  nextReview: null,
  card: null,
  ...extra,
});
const fake = (records = {}) => ({
  snapshot: () => ({ timeZone: "UTC", records }),
});
test("No progress and beginner plans are realistic, count no invented retention, and preserve goals and FSRS", () => {
  const s = storage(), store = createLearningStore(s, surahs);
  const before = store.snapshot();
  const view = coachSnapshot(store, s, surahs, {}, now),
    plan = materializePlan(view);
  expect(view.summary.tracked).toBe(0);
  expect(view.summary.retained).toBe(0);
  expect(plan.minutes).toBeLessThanOrEqual(10);
  expect(plan.tasks.some((t) => t.type === "new")).toBe(true);
  expect(view.candidates[0]).toBe("1:1");
  expect(store.snapshot()).toEqual(before);
  const beginner = coachSnapshot(
    fake({
      "1:1": {
        memory: memory({
          history: [{
            at: now.toISOString(),
            grade: "Again",
            independent: false,
          }],
        }),
      },
    }),
    s,
    surahs,
    {},
    now,
  );
  expect(beginner.summary.weak).toBe(1);
  expect(materializePlan(beginner).tasks[0].type).toBe("repair");
});
test("Extensive overdue review blocks new material, respects time budgets and carries backlog without changing due dates", () => {
  const records = Object.fromEntries(
    surahs.flatMap((s) => s.verses).slice(0, 80).map((
      _,
      i,
    ) => [`1:${i + 1}`, { memory: memory() }]),
  );
  const actual = Object.fromEntries(
    surahs.flatMap((s) =>
      s.verses.map(
        (v) => [`${s.id}:${v.id}`, {
          memory: memory({ nextReview: "2026-10-01T10:00:00Z" }),
        }],
      )
    ).slice(0, 80),
  );
  const before = JSON.stringify(actual),
    view = coachSnapshot(fake(actual), storage(), surahs, {
      minutes: 10,
      days: 3,
    }, now),
    plan = materializePlan(view, {
      focus: "transitions",
      newCap: 2,
      goalAdvice: "maintain",
      breakStyle: "spaced",
    });
  expect(view.summary.due).toBe(80);
  expect(plan.tasks[0].type).toBe("review");
  expect(plan.tasks.some((t) => t.type === "new")).toBe(false);
  expect(plan.minutes).toBeLessThanOrEqual(10);
  expect(plan.remainingDue).toBeGreaterThan(0);
  expect(plan.weekly.filter((d) => d.study)).toHaveLength(3);
  expect(plan.goalAdvice).toBe("reduce");
  expect(JSON.stringify(actual)).toBe(before);
});
test("Many retained ayahs and broad passage histories never become invented verified juz claims; inconsistent records are conservative", () => {
  const s = storage();
  const records = Object.fromEntries(
    surahs.flatMap((c) =>
      c.verses.map(
        (v) => [`${c.id}:${v.id}`, {
          memory: memory({
            stage: "retained",
            nextReview: "2026-11-20T10:00:00Z",
          }),
        }],
      )
    ),
  );
  const view = coachSnapshot(fake(records), s, surahs, {}, now);
  expect(view.summary.retained).toBe(571);
  expect(view.summary.due).toBe(0);
  expect(materializePlan(view).explanations.join(" ")).toContain(
    "not independently verified",
  );
  const bad = coachSnapshot(
    fake({
      "1:1": {
        memory: memory({
          nextReview: "bad",
          history: [{ at: "future-invalid", grade: "Good" }],
        }),
      },
    }),
    s,
    surahs,
    {},
    now,
  );
  expect(bad.summary.inconsistent).toBe(true);
  expect(materializePlan(bad).tasks.some((t) => t.type === "new")).toBe(false);
  expect(() => validateSummary({ ...view.summary, retained: 10001 })).toThrow();
  expect(() => validateAdvice({ focus: "rewrite quran", newCap: 99 }))
    .toThrow();
});
test("Repeated failures, passage transitions and per-store schedules contribute without transmitting references", () => {
  const s = storage(),
    h = [{ at: now.toISOString(), grade: "Again", independent: true }, {
      at: now.toISOString(),
      grade: "Again",
      independent: true,
    }];
  s.setItem(
    "ayah-passage-recall-v1",
    JSON.stringify({
      version: 1,
      records: {
        "passage:test": {
          unit: { id: "passage:test", type: "passage", refs: ["1:1", "1:2"] },
          card: {
            state: 1,
            stability: 1,
            difficulty: 5,
            due: "2026-10-20T10:00:00Z",
          },
          history: h,
          successfulDays: [],
        },
      },
      active: null,
    }),
  );
  s.setItem(
    "ayah-puzzle-lab-v1",
    JSON.stringify({
      schemaVersion: 1,
      weaknesses: { "1:1": { transitions: 2 } },
    }),
  );
  const v = coachSnapshot(
    fake({
      "1:1": {
        memory: memory({ nextReview: "2026-10-20T10:00:00Z", history: h }),
      },
    }),
    s,
    surahs,
    {},
    now,
  );
  expect(v.summary.repeated).toBe(2);
  expect(v.summary.transitions).toBe(2);
  expect(v.summary.due).toBe(2);
  expect(JSON.stringify(v.summary)).not.toContain("1:1");
  expect(() => buildPlan(v.summary)).not.toThrow();
});

test("Thousands of stored Quran recall units across many juz remain recorded evidence, with bounded plans", async () => {
  const { catalog } = await import(
    "../supabase/functions/_shared/content-policy.js"
  );
  const refs = catalog.chapters.flatMap((c) =>
      Array.from({ length: c.verseCount }, (_, i) => `${c.id}:${i + 1}`)
    ).slice(0, 2200),
    s = storage();
  const records = Object.fromEntries(refs.map((key) => [`ayah:${key}`, {
    unit: { id: `ayah:${key}`, type: "ayah", refs: [key] },
    card: {
      state: 2,
      stability: 20,
      difficulty: 4,
      due: "2026-11-15T00:00:00Z",
    },
    history: [],
    successfulDays: ["2026-09-01", "2026-09-10", "2026-09-20"],
  }]));
  s.setItem(
    "ayah-passage-recall-v1",
    JSON.stringify({ version: 1, records, active: null }),
  );
  const view = coachSnapshot(fake(), s, surahs, { minutes: 5 }, now);
  expect(view.summary.retained).toBe(2200);
  expect(view.summary.tracked).toBe(2200);
  expect(materializePlan(view).minutes).toBeLessThanOrEqual(5);
  expect(JSON.stringify(view.summary)).not.toContain("2:255");
});
