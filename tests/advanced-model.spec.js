import { test, expect } from "@playwright/test";
import {
  buildRevisionPlan,
  verifyRevisionCheckpoint,
  selectSurvival,
  survivalChoices,
  savedRevisionAssessment,
  revisionSummary,
} from "../src/quest/advanced/model.js";
import {
  createRevisionStore,
  REVISION_KEY,
} from "../src/quest/advanced/store.js";
import {
  createPassageMemory,
  PASSAGE_MEMORY_KEY,
} from "../src/passage/memory.js";
import { wordIdentity } from "../src/distractors.js";
import { localBundle } from "../src/content/library.js";
import { recallUnit } from "../src/passage/model.js";
const makeStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const makeStore = (storage) =>
  createRevisionStore({
    storage,
    owner: null,
    getOwner: () => null,
    clock: () => new Date("2026-11-01T12:00:00Z"),
  });
const boss = (extra = {}) =>
  buildRevisionPlan({ mode: "boss", refs: ["1:1", "1:2"], ...extra });
function grade(memory, unit, grade = "Good", assisted = false) {
  const a = memory.begin(unit);
  if (assisted) memory.update("abandon");
  memory.update("declared");
  memory.update("compared");
  memory.grade(a.id, grade);
  return a.id;
}
const mem = (s) =>
  createPassageMemory(s, { clock: () => new Date("2026-11-01T12:01:00Z") });
test("five deterministic progressive gates store references and hashes, never duplicated Quran text", async () => {
  const a = await boss(),
    b = await boss();
  expect(a.plan).toEqual(b.plan);
  expect(a.plan.checkpoints.map((c) => c.kind)).toEqual([
    "recall",
    "recall",
    "discrimination",
    "recall",
    "recall",
  ]);
  expect(a.plan.checkpoints.at(-1).requireIndependent).toBe(true);
  const raw = JSON.stringify(a.plan);
  expect(raw).not.toContain(localBundle("1:1").textUthmani);
  expect(raw).not.toContain("textUthmani");
  expect(a.plan.checkpoints[2].choices).toHaveLength(2);
  const expert = await boss({
    preset: "expert",
    refs: ["1:1", "1:2", "1:3", "1:4", "1:5"],
  });
  expect(expert.plan.checkpoints[2].choices).toHaveLength(4);
  expect(expert.plan.checkpoints[3].unit.refs).toHaveLength(4);
  expect(expert.plan.checkpoints[4].unit.refs).toHaveLength(5);
  await expect(boss({ refs: ["1:1", "1:3"] })).rejects.toThrow("consecutive");
  await expect(boss({ refs: ["1:1"] })).rejects.toThrow();
});
test("FSRS-aware routes use actual independently recalled material, retain early units and prioritize due dates without writes", async () => {
  const s = makeStorage();
  let now = "2026-10-01T12:00:00Z";
  const m = createPassageMemory(s, { clock: () => new Date(now) });
  for (const key of ["1:1", "1:2", "1:3", "1:4"]) {
    now = key === "1:4" ? "2026-11-01T11:59:00Z" : "2026-10-01T12:00:00Z";
    grade(m, await recallUnit([localBundle(key)]));
  }
  const raw = s.getItem(PASSAGE_MEMORY_KEY),
    d = m.snapshot(),
    rows = survivalChoices(d, new Date("2026-11-01T12:00:00Z"));
  expect(rows.at(-1).state).toBe("upcoming");
  const ids = rows.map((r) => r.id);
  expect(
    selectSurvival(d, ids, { now: new Date("2026-11-01T12:00:00Z") }),
  ).toHaveLength(3);
  expect(selectSurvival(d, ids, { length: "extended" })).toHaveLength(4);
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(raw);
  expect(() => selectSurvival(d, ["ayah:114:1"])).toThrow("eligible");
});
test("Classic charges span all gates; Practice retries retain the current gate; no game state mutation schedules FSRS", async () => {
  for (const rules of ["classic", "practice"]) {
    const s = makeStorage(),
      store = makeStore(s),
      memory = mem(s),
      { plan } = await boss({ rules }),
      r = store.create(plan);
    store.begin(r.id);
    grade(memory, plan.checkpoints[0].unit);
    store.apply(r.id, memory.snapshot());
    const raw = s.getItem(PASSAGE_MEMORY_KEY);
    for (let i = 0; i < 3; i++) {
      store.begin(r.id);
      grade(memory, plan.checkpoints[1].unit, "Again");
      store.apply(r.id, memory.snapshot());
    }
    expect(store.snapshot().runs[r.id].status).toBe("lost");
    const before = s.getItem(PASSAGE_MEMORY_KEY);
    store.retry(r.id);
    expect(store.snapshot().runs[r.id].cursor).toBe(
      rules === "classic" ? 0 : 1,
    );
    expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(before);
    expect(raw).not.toBe(before);
  }
});
test("independent and assisted self-grades remain distinct, final assisted Good never clears the full recall gate", async () => {
  const s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    { plan } = await boss(),
    r = store.create(plan);
  for (let i = 0; i < 2; i++) {
    store.begin(r.id);
    grade(memory, plan.checkpoints[i].unit, "Good", i === 0);
    store.apply(r.id, memory.snapshot());
  }
  store.choose(r.id, plan.checkpoints[2].target);
  store.begin(r.id);
  grade(memory, plan.checkpoints[3].unit);
  store.apply(r.id, memory.snapshot());
  store.begin(r.id);
  grade(memory, plan.checkpoints[4].unit, "Good", true);
  store.apply(r.id, memory.snapshot());
  expect(store.snapshot().runs[r.id]).toMatchObject({
    cursor: 4,
    charges: 3,
    status: "playing",
  });
  store.fresh(r.id);
  store.begin(r.id);
  grade(memory, plan.checkpoints[4].unit, "Hard");
  store.apply(r.id, memory.snapshot());
  const done = store.snapshot().runs[r.id];
  expect(done.status).toBe("won");
  expect(revisionSummary(done).assisted).toBe(2);
});
test("discrimination is observed puzzle correctness, locks wrong choices and never creates a recall record", async () => {
  const s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    { plan } = await boss(),
    r = store.create(plan);
  for (let i = 0; i < 2; i++) {
    store.begin(r.id);
    grade(memory, plan.checkpoints[i].unit);
    store.apply(r.id, memory.snapshot());
  }
  const raw = s.getItem(PASSAGE_MEMORY_KEY),
    wrong = plan.checkpoints[2].choices.find(
      (k) => k !== plan.checkpoints[2].target,
    );
  store.choose(r.id, wrong);
  expect(() => store.choose(r.id, wrong)).toThrow("available");
  expect(store.snapshot().runs[r.id].charges).toBe(2);
  store.unlock(r.id);
  store.choose(r.id, plan.checkpoints[2].target);
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(raw);
});
test("assessment receipts cannot be reused across checkpoints, runs or reloads", async () => {
  const s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    { plan } = await boss(),
    r = store.create(plan);
  store.begin(r.id);
  grade(memory, plan.checkpoints[0].unit);
  store.apply(r.id, memory.snapshot());
  expect(() => store.apply(r.id, memory.snapshot())).toThrow();
  const another = store.create(plan);
  store.begin(another.id);
  expect(() => store.apply(another.id, memory.snapshot())).toThrow(
    "already been applied",
  );
  expect(makeStore(s).snapshot().runs[r.id].cursor).toBe(1);
});
test("failed game-state saves can apply the actual persisted grade again without another FSRS grade", async () => {
  const s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    { plan } = await boss(),
    r = store.create(plan);
  store.begin(r.id);
  grade(memory, plan.checkpoints[0].unit);
  const raw = s.getItem(PASSAGE_MEMORY_KEY),
    set = s.setItem;
  s.setItem = (k, v) => {
    if (k === REVISION_KEY) throw Error("disk full");
    set(k, v);
  };
  expect(() => store.apply(r.id, memory.snapshot())).toThrow("disk full");
  s.setItem = set;
  makeStore(s).apply(r.id, memory.snapshot());
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(raw);
});
test("Survival emphasizes coverage, practice camps restore lanterns and pauses never penalize missed days", async () => {
  const units = await Promise.all(
      ["1:1", "1:2", "1:3", "1:4"].map((k) => recallUnit([localBundle(k)])),
    ),
    { plan } = await buildRevisionPlan({
      mode: "survival",
      units,
      length: "extended",
    }),
    s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    r = store.create(plan);
  for (let i = 0; i < 3; i++) {
    store.begin(r.id);
    grade(memory, units[i], i === 0 ? "Again" : "Good");
    store.apply(r.id, memory.snapshot());
  }
  expect(store.snapshot().runs[r.id]).toMatchObject({
    cursor: 3,
    charges: 2,
    status: "camp",
  });
  const raw = s.getItem(PASSAGE_MEMORY_KEY);
  store.pause(r.id);
  const later = createRevisionStore({
    storage: s,
    owner: null,
    getOwner: () => null,
    clock: () => new Date("2027-01-01"),
  });
  later.resume(r.id);
  expect(later.snapshot().runs[r.id].charges).toBe(2);
  later.camp(r.id);
  expect(later.snapshot().runs[r.id].charges).toBe(3);
  later.end(r.id);
  expect(s.getItem(PASSAGE_MEMORY_KEY)).toBe(raw);
  expect(revisionSummary(later.snapshot().runs[r.id]).coverage).toBe(3);
});
test("Classic Survival camp does not replenish the run-wide charge budget", async () => {
  const units = await Promise.all(
      ["1:1", "1:2", "1:3", "1:4"].map((k) => recallUnit([localBundle(k)])),
    ),
    { plan } = await buildRevisionPlan({
      mode: "survival",
      units,
      length: "extended",
      rules: "classic",
    }),
    s = makeStorage(),
    store = makeStore(s),
    memory = mem(s),
    r = store.create(plan);
  for (let i = 0; i < 3; i++) {
    store.begin(r.id);
    grade(memory, units[i], i === 0 ? "Again" : "Good");
    store.apply(r.id, memory.snapshot());
  }
  store.camp(r.id);
  expect(store.snapshot().runs[r.id].charges).toBe(2);
});
test("revised sources fail closed; unknown accounts and corrupt/future state are preserved", async () => {
  const { plan } = await boss();
  await expect(
    verifyRevisionCheckpoint(plan, 0, null, async (key) => ({
      ...localBundle(key),
      segmentationReview: { version: 99 },
    })),
  ).rejects.toThrow("changed");
  const s = makeStorage(),
    store = makeStore(s);
  s.setItem(REVISION_KEY, '{"version":900}');
  expect(() => store.create(plan)).toThrow("not been overwritten");
  expect(s.getItem(REVISION_KEY)).toBe('{"version":900}');
  expect(() =>
    createRevisionStore({
      storage: s,
      owner: "A",
      getOwner: () => "B",
    }).snapshot(),
  ).toThrow("Account changed");
});

test("initial support is persisted atomically with an actual recall attempt and cannot schedule an independent success", async () => {
  const storage = makeStorage(),
    memory = mem(storage),
    unit = await recallUnit([localBundle("1:1")]);
  let writes = 0;
  const set = storage.setItem;
  storage.setItem = (k, v) => {
    writes++;
    set(k, v);
  };
  const a = memory.begin(unit, { assisted: true });
  expect(writes).toBe(1);
  expect(memory.snapshot().active.assisted).toBe(true);
  memory.update("declared");
  memory.update("compared");
  const result = memory.grade(a.id, "Good");
  expect(result).toMatchObject({
    independent: false,
    scheduled: false,
    nextReview: null,
  });
  expect(memory.snapshot().records[unit.id].card).toBeNull();
});

test("identical authentic ayahs at different references can never be indistinguishable distractors", async () => {
  const { plan } = await boss({ refs: ["82:12", "82:13"], preset: "expert" });
  const previews = plan.checkpoints[2].choices.map((key) =>
    localBundle(key)
      .words.slice(0, 12)
      .map((w) => wordIdentity(w.text))
      .join(" "),
  );
  expect(new Set(previews).size).toBe(4);
  expect(plan.checkpoints[2].choices).toContain("82:13");
  expect(plan.checkpoints[2].choices).not.toContain("83:22");
});
