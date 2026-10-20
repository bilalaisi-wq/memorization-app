import { test, expect } from "@playwright/test";
import {
  constellationLayout,
  starStatus,
  surahSky,
  observeMastery,
  resetSkyObserver,
} from "../src/themes/constellations.js";
import { validAppearance } from "../src/themes/registry.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
const chapter = {
  id: 108,
  name: "Al-Kawthar",
  verses: [{ id: 1 }, { id: 2 }, { id: 3 }],
};
const retained = () => ({
  memory: { stage: "retained", nextReview: null },
  game: { completed: true },
});
test("layouts are deterministic, distinct, bounded, and key each ayah once", () => {
  const ids = Array.from({ length: 250 }, (_, i) => i + 1);
  expect(constellationLayout(1, [1, 2, 3])).toEqual(
    constellationLayout(1, [1, 2, 3]),
  );
  expect(constellationLayout(1, [1, 2, 3])).not.toEqual(
    constellationLayout(114, [1, 2, 3]),
  );
  const nodes = [];
  for (let offset = 0; offset < ids.length; offset += 24) {
    const page = constellationLayout(80, ids, offset);
    expect(page.length).toBeLessThanOrEqual(24);
    nodes.push(...page);
  }
  expect(new Set(nodes.map((n) => n.key)).size).toBe(250);
  expect(
    nodes.every((n) => n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100),
  ).toBe(true);
});
test("game achievements, assisted recall, and merely reviewing do not imply mastery", () => {
  expect(
    starStatus({
      game: { completed: true, puzzleWins: 100 },
      memory: { stage: "new" },
    }).status,
  ).toBe("inProgress");
  expect(
    starStatus({
      memory: { stage: "reviewing", history: [{ independent: false }] },
    }).status,
  ).toBe("inProgress");
  expect(starStatus(undefined).status).toBe("notStarted");
  expect(
    starStatus(
      { memory: { stage: "retained", nextReview: "2026-10-01T00:00:00Z" } },
      new Date("2026-10-20T00:00Z"),
    ),
  ).toEqual({ status: "mastered", reviewDue: true });
});
test("only persisted retained transitions ignite stars and completion is idempotent across resets/lapses", () => {
  resetSkyObserver();
  const storage = memory(),
    state = { records: {} };
  expect(observeMastery(state, [chapter], storage)).toEqual({
    ignited: [],
    completed: [],
  });
  state.records["108:1"] = retained();
  expect(observeMastery(state, [chapter], storage).ignited).toEqual(["108:1"]);
  state.records["108:2"] = retained();
  observeMastery(state, [chapter], storage);
  state.records["108:3"] = retained();
  expect(observeMastery(state, [chapter], storage)).toEqual({
    ignited: ["108:3"],
    completed: [108],
  });
  expect(observeMastery(state, [chapter], storage)).toEqual({
    ignited: [],
    completed: [],
  });
  state.records["108:3"].memory.stage = "recalling";
  expect(surahSky(chapter, state).mastered).toBe(2);
  observeMastery(state, [chapter], storage);
  resetSkyObserver();
  observeMastery(state, [chapter], storage);
  state.records["108:3"] = retained();
  expect(observeMastery(state, [chapter], storage).completed).toEqual([]);
});
test("historical full constellations do not re-earn effects on dashboard return and failed receipts skip celebration", () => {
  resetSkyObserver();
  const state = {
      records: Object.fromEntries(
        [1, 2, 3].map((a) => [`108:${a}`, retained()]),
      ),
    },
    storage = memory();
  expect(observeMastery(state, [chapter], storage).completed).toEqual([]);
  resetSkyObserver();
  const failed = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    },
    empty = { records: {} };
  observeMastery(empty, [chapter], failed);
  expect(observeMastery(state, [chapter], failed).completed).toEqual([]);
  resetSkyObserver();
  const broken = memory();
  broken.setItem("ayah-sky-celebrations-v1", '{"version":99}');
  observeMastery({ records: {} }, [chapter], broken);
  expect(observeMastery(state, [chapter], broken).completed).toEqual([]);
  expect(broken.getItem("ayah-sky-celebrations-v1")).toBe('{"version":99}');
});
test("invalid appearance settings are rejected and Simple remains the implicit default", () => {
  expect(
    validAppearance({
      version: 1,
      theme: "night-sky",
      reduceEffects: false,
      updatedAt: new Date().toISOString(),
    }),
  ).toBe(true);
  expect(
    validAppearance({
      version: 1,
      theme: "fake",
      reduceEffects: false,
      updatedAt: new Date().toISOString(),
    }),
  ).toBe(false);
});

test("failed canonical recall persistence cannot ignite a new mastered star", async () => {
  const { createLearningStore } = await import("../src/learning-store.js");
  const { surahs } = await import("../src/data.js");
  const storage = memory();
  let blocked = false;
  const safeSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (blocked && key === "ayah-learning-v1") throw new Error("quota");
    safeSet(key, value);
  };
  const store = createLearningStore(storage, surahs, {
    timeZone: "UTC",
    clock: () => new Date("2026-10-01T12:00Z"),
  });
  for (const day of [1, 2]) {
    const a = store.beginRecall("1:1", new Date(`2026-10-0${day}T12:00Z`));
    store.updateRecall(a.id, "compare");
    store.gradeRecall(a.id, "Good", new Date(`2026-10-0${day}T12:00Z`));
  }
  resetSkyObserver();
  observeMastery(store.snapshot(), [surahs[0]], storage);
  const attempt = store.beginRecall("1:1", new Date("2026-10-03T12:00Z"));
  store.updateRecall(attempt.id, "compare");
  blocked = true;
  expect(() =>
    store.gradeRecall(attempt.id, "Good", new Date("2026-10-03T12:00Z")),
  ).toThrow();
  expect(starStatus(store.getRecord("1:1")).status).not.toBe("mastered");
  expect(
    observeMastery(store.snapshot(), [surahs[0]], storage).ignited,
  ).toEqual([]);
});
