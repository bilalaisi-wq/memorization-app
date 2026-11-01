import { test, expect } from "@playwright/test";
import { performance } from "node:perf_hooks";
import {
  repairAnalysis,
  chooseRepairGame,
  repairCategories,
} from "../src/quest/repair/model.js";
import { selectionEvidence } from "../src/puzzles/arcade/evidence.js";
import { createSession, reduceSession } from "../src/puzzles/arcade/session.js";
import { createPassageMemory } from "../src/passage/memory.js";
const word = (key, index) => ({
  key,
  index,
  id: `${key}:${index}`,
  text: "fixture",
});
const record = (extra = {}) => ({
  key: "1:1",
  sessionId: "run1",
  game: "snake",
  mistakes: 1,
  at: "2026-10-01T12:00:00Z",
  ...extra,
});
test("no evidence produces no invented weaknesses; all requested categories have transparent policies", () => {
  expect(repairAnalysis().recommendations).toEqual([]);
  for (const c of [
    "word-selection",
    "word-order",
    "phrase-transition",
    "similar-passage",
    "assistance",
    "review-difficulty",
  ])
    expect(repairCategories[c].tip).toBeTruthy();
});
test("new game selections store canonical positional metadata, never Arabic or speech claims", () => {
  const a = word("1:1", 0),
    b = word("1:1", 1),
    c = word("112:1", 0);
  expect(selectionEvidence(a, b).category).toBe("word-order");
  expect(selectionEvidence(c, b).category).toBe("word-selection");
  expect(selectionEvidence({ words: [a, b] }, c).category).toBe(
    "phrase-transition",
  );
  const s = reduceSession(
    reduceSession(
      createSession({
        id: "s",
        game: "snake",
        config: { keys: ["1:1"], chainMode: "practice" },
      }),
      { type: "start" },
    ),
    { type: "mistake", ...selectionEvidence(c, b) },
  );
  expect(s.mistakes[0]).toMatchObject({
    category: "word-selection",
    expected: ["1:1:1"],
    selected: ["112:1:0"],
  });
  expect(JSON.stringify(s)).not.toContain("fixture");
  expect(s.strikes).toBe(1);
});
test("legacy sequence errors remain generic; counters and motor failures cannot establish a word or similar-passage confusion", () => {
  const lab = {
    history: [
      record({
        arcade: {
          mistakes: [{ kind: "sequence", event: 0 }],
          motorErrors: [{ event: 1 }],
        },
      }),
    ],
  };
  const a = repairAnalysis({ lab });
  expect(a.recommendations.map((r) => r.category)).toEqual([
    "sequence-unspecified",
  ]);
  expect(a.diagnostics.motorEvents).toHaveLength(1);
  expect(a.diagnostics.audioInferences).toEqual([]);
  expect(a.diagnostics.independentGrades).toEqual([]);
  expect(
    repairAnalysis({ lab: { history: [record({ game: "detective" })] } })
      .recommendations[0].category,
  ).toBe("similar-passage");
  expect(
    repairAnalysis({
      lab: {
        history: [record({ mistakes: 0, arcade: { motorErrors: [{}] } })],
      },
    }).recommendations,
  ).toEqual([]);
});
test("explicit mistake categories preserve provenance and repeated receipts do not duplicate evidence", () => {
  const h = record({
    arcade: {
      mistakes: [
        { ...selectionEvidence(word("112:1", 0), word("1:1", 1)), event: 3 },
      ],
    },
  });
  const before = JSON.stringify(h);
  const r = repairAnalysis({ lab: { history: [h, h] } }).recommendations[0];
  expect(r.category).toBe("word-selection");
  expect(r.evidence).toHaveLength(1);
  expect(r.evidence[0]).toMatchObject({
    source: "observed-arcade",
    record: "run1",
    selected: ["112:1:0"],
  });
  expect(JSON.stringify(h)).toBe(before);
});
test("assistance is not dependence or failed recall; self-grades retain independence and scheduling flags", () => {
  const unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  const a = repairAnalysis({
    lab: { history: [record({ mistakes: 0, hinted: true })] },
    memory: {
      records: {
        [unit.id]: {
          unit,
          history: [
            {
              attemptId: "x",
              grade: "Again",
              independent: true,
              scheduled: true,
              at: "2026-10-01",
            },
            {
              attemptId: "y",
              grade: "Hard",
              independent: false,
              scheduled: false,
            },
          ],
        },
      },
    },
  });
  expect(
    a.recommendations.find((r) => r.category === "review-difficulty").evidence,
  ).toHaveLength(2);
  expect(
    a.recommendations.find((r) => r.category === "review-difficulty")
      .evidence[0],
  ).toMatchObject({
    source: "self-reported-recall",
    independent: true,
    scheduled: true,
  });
  expect(
    a.recommendations.find((r) => r.category === "assistance").evidence,
  ).toHaveLength(2);
});
test("real recall history is read without mutations or due-date recalculation, including early assisted grades", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    };
  const memory = createPassageMemory(storage, {
    clock: () => new Date("2026-10-01"),
  });
  const unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  const x = memory.begin(unit);
  memory.update("declared");
  memory.update("compared");
  memory.grade(x.id, "Again");
  const raw = [...data.values()][0];
  repairAnalysis({ memory: memory.snapshot() });
  expect([...data.values()][0]).toBe(raw);
  expect(
    repairAnalysis({ memory: memory.snapshot() }).recommendations[0].key,
  ).toBe("1:1");
});
test("planned, hidden and unsupported games never launch; fallback is supported practice", () => {
  const r = { game: "sirat" };
  expect(chooseRepairGame(r, [{ id: "sirat", status: "planned" }])).toBeNull();
  expect(chooseRepairGame(r, [{ id: "maze", status: "available" }])).toBe(
    "maze",
  );
  expect(
    chooseRepairGame({ game: "snake" }, [{ id: "maze" }, { id: "snake" }]),
  ).toBe("snake");
});
test("historical records and many-juz evidence remain read-only and projection is practical at scale", () => {
  const lab = {
    history: Array.from({ length: 10000 }, (_, i) =>
      record({ sessionId: `s${i}`, key: i % 2 ? "1:1" : "114:1" }),
    ),
  };
  const raw = JSON.stringify(lab),
    start = performance.now();
  const a = repairAnalysis({ lab });
  expect(performance.now() - start).toBeLessThan(2000);
  expect(a.recommendations).toHaveLength(2);
  expect(JSON.stringify(lab)).toBe(raw);
  expect(
    repairAnalysis({ lab: { history: [record({ key: "999:1" })] } })
      .recommendations,
  ).toEqual([]);
});

test("malformed optional legacy metadata cannot invent precise errors or crash projection", () => {
  const h = record({
    arcade: {
      mistakes: [
        null,
        { category: "word-order", expected: [], selected: ["not-a-reference"] },
      ],
      motorErrors: "invalid",
      assistance: "invalid",
    },
  });
  const lab = { history: [h] },
    before = JSON.stringify(lab);
  const a = repairAnalysis({ lab });
  expect(a.recommendations.map((r) => r.category)).toEqual([
    "sequence-unspecified",
  ]);
  expect(a.diagnostics.motorEvents).toEqual([]);
  expect(JSON.stringify(lab)).toBe(before);
});
