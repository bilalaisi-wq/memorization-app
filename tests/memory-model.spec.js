import { test, expect } from "@playwright/test";
import { fsrs, createEmptyCard, Rating, State } from "ts-fsrs";
import {
  createLearningStore,
  LEARNING_KEY,
  LEGACY_BACKUP_KEY,
  FSRS_SETTINGS,
  dayKey,
} from "../src/learning-store.js";
import { surahs, challengeReward } from "../src/data.js";
class Storage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
  }
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
}
const start = new Date("2026-10-12T12:00:00Z");
const create = (storage = new Storage()) => ({
  storage,
  store: createLearningStore(storage, surahs, {
    timeZone: "UTC",
    clock: () => start,
  }),
});
function assess(store, key, grade, now = start) {
  const a = store.beginRecall(key, now);
  store.updateRecall(a.id, "compare");
  return { attempt: a, result: store.gradeRecall(a.id, grade, now) };
}

test("migration preserves legacy games and unallocated XP without inventing memory", () => {
  const entries = {
    "ayah-mastery": JSON.stringify({ "1:1": 11, "114:1": 4 }),
    "ayah-quiz": JSON.stringify({
      xp: 125,
      stars: 31,
      streak: 7,
      awarded: [0],
    }),
    "ayah-completed": JSON.stringify([0, "114:1"]),
  };
  const { store, storage } = create(new Storage(entries));
  const state = store.snapshot();
  expect(state.wallet).toEqual({
    xp: 125,
    stars: 31,
    streak: 7,
    legacyXP: 125,
  });
  expect(state.records["1:1"].game.puzzleWins).toBe(11);
  expect(state.records["114:1"].game.completed).toBe(true);
  expect(state.records["1:1"].memory.stage).toBe("new");
  expect(state.records["1:1"].memory.card).toBeNull();
  expect(store.daily(start).dueToday).toHaveLength(0);
  expect(JSON.parse(storage.getItem(LEGACY_BACKUP_KEY)).keys).toEqual(entries);
  expect(
    Object.fromEntries(
      Object.keys(entries).map((k) => [k, storage.getItem(k)]),
    ),
  ).toEqual(entries);
  const reloaded = createLearningStore(storage, surahs, {
    timeZone: "UTC",
    clock: () => start,
  });
  expect(reloaded.snapshot()).toEqual(state);
});

test("all four recall grades use the maintained FSRS scheduler and survive date hydration", () => {
  const scheduler = fsrs(FSRS_SETTINGS);
  for (const grade of ["Again", "Hard", "Good", "Easy"]) {
    const { store, storage } = create();
    const { result } = assess(store, "1:1", grade);
    const expected = JSON.parse(
      JSON.stringify(
        scheduler.next(createEmptyCard(start), start, Rating[grade]),
      ),
    );
    const r = store.getRecord("1:1");
    expect(r.memory.card).toEqual(expected.card);
    expect(result.fsrsLog).toEqual(expected.log);
    expect(result.nextReview).toBe(expected.card.due);
    expect(r.memory.independentAttempts).toBe(1);
    expect(r.memory.successfulDays).toHaveLength(grade === "Again" ? 0 : 1);
    const reloaded = createLearningStore(storage, surahs, {
      timeZone: "UTC",
      clock: () => start,
    });
    const next = new Date(expected.card.due);
    assess(reloaded, "1:1", "Good", next);
    expect(reloaded.getRecord("1:1").memory.card.reps).toBe(2);
  }
});

test("hints and listening before recall remain assisted; comparison afterward is eligible", () => {
  for (const action of ["hint", "audio", "assisted"]) {
    const { store } = create();
    const a = store.beginRecall("1:1", start);
    store.updateRecall(a.id, action);
    if (action !== "hint") store.updateRecall(a.id, "compare");
    const result = store.gradeRecall(a.id, "Easy", start);
    expect(result.independent).toBe(false);
    expect(result.scheduleUpdated).toBe(false);
    const m = store.getRecord("1:1").memory;
    expect(m.card).toBeNull();
    expect(m.successfulDays).toEqual([]);
    expect(m.independentAttempts).toBe(0);
    expect(m.assistedAttempts).toBe(1);
    expect(m.nextReview).toBe("2026-10-12T12:10:00.000Z");
    expect(m.history[0].usedHint || m.history[0].audioBeforeRecall).toBe(true);
  }
  const { store } = create();
  const a = store.beginRecall("1:1", start);
  expect(() => store.gradeRecall(a.id, "Good", start)).toThrow("Compare");
  store.updateRecall(a.id, "compare");
  store.updateRecall(a.id, "audio");
  const result = store.gradeRecall(a.id, "Good", start);
  expect(result.independent).toBe(true);
});

test("successful review days are distinct and lapses only follow assessed failure", () => {
  const { store } = create();
  assess(store, "1:1", "Good", start);
  assess(store, "1:1", "Good", new Date("2026-10-12T12:10:00Z"));
  expect(store.getRecord("1:1").memory.successfulDays).toEqual(["2026-10-12"]);
  let date = new Date(store.getRecord("1:1").memory.nextReview);
  assess(store, "1:1", "Easy", date);
  date = new Date(store.getRecord("1:1").memory.nextReview);
  assess(store, "1:1", "Good", date);
  let m = store.getRecord("1:1").memory;
  expect(m.successfulDays.length).toBeGreaterThanOrEqual(3);
  expect(m.stage).toBe("retained");
  expect(m.card.state).toBe(State.Review);
  const wallet = store.snapshot().wallet;
  store.daily(new Date("2028-01-01"));
  expect(store.snapshot().wallet).toEqual(wallet);
  expect(store.getRecord("1:1").memory.lapses).toBe(0);
  assess(store, "1:1", "Again", new Date(m.nextReview));
  m = store.getRecord("1:1").memory;
  expect(m.lapses).toBe(1);
  expect(m.mistakes).toBe(1);
  expect(m.stage).not.toBe("retained");
  expect(m.history.at(-1).grade).toBe("Again");
});

test("early practice and duplicate grading cannot inflate schedule or rewards", () => {
  const { store } = create();
  const { attempt, result } = assess(store, "1:1", "Easy", start);
  const before = store.snapshot();
  const duplicate = store.gradeRecall(attempt.id, "Easy", start);
  expect(duplicate.duplicate).toBe(true);
  expect(store.snapshot()).toEqual(before);
  expect(result.reward.xp).toBe(40);
  const early = assess(
    store,
    "1:1",
    "Easy",
    new Date("2026-10-12T12:01:00Z"),
  ).result;
  expect(early.earlyPractice).toBe(true);
  expect(early.reward.xp).toBe(0);
  expect(store.getRecord("1:1").memory.card).toEqual(
    before.records["1:1"].memory.card,
  );
  expect(store.getRecord("1:1").memory.successfulDays).toHaveLength(1);
  const due = assess(
    store,
    "1:1",
    "Good",
    new Date(before.records["1:1"].memory.nextReview),
  ).result;
  expect(due.reward.xp).toBe(60);
  expect(due.wasDue).toBe(true);
});

test("same-day retrieval reward upgrades are bounded; puzzles have a finite daily cap", () => {
  const { store } = create();
  assess(store, "1:1", "Again", start);
  assess(store, "1:1", "Good", new Date("2026-10-12T12:01:00Z"));
  assess(
    store,
    "1:1",
    "Good",
    new Date(store.getRecord("1:1").memory.nextReview),
  );
  expect(store.snapshot().wallet.xp).toBe(60);
  expect(store.snapshot().wallet.stars).toBe(4);
  const puzzle = create().store;
  const potential = challengeReward(1, 0, false);
  for (let i = 0; i < 8; i++)
    puzzle.recordPuzzle({
      key: "114:1",
      sessionId: "p" + i,
      level: 1,
      attempts: 0,
      hinted: false,
      potential,
      now: start,
    });
  expect(puzzle.snapshot().wallet.xp).toBe(30);
  expect(puzzle.snapshot().wallet.stars).toBe(6);
  expect(puzzle.getRecord("114:1").game.puzzleWins).toBe(8);
  expect(puzzle.getRecord("114:1").memory.independentAttempts).toBe(0);
  const before = puzzle.snapshot();
  expect(
    puzzle.recordPuzzle({
      key: "114:1",
      sessionId: "p0",
      level: 1,
      potential,
      now: start,
    }).duplicate,
  ).toBe(true);
  expect(puzzle.snapshot()).toEqual(before);
  const tomorrow = puzzle.recordPuzzle({
    key: "114:1",
    sessionId: "p9",
    level: 1,
    potential,
    now: new Date("2026-10-13T12:00:00Z"),
  });
  expect(tomorrow.xp).toBe(15);
});

test("stable ayah keys, pending flags, and stale submissions do not leak across surahs", () => {
  const { store, storage } = create();
  const a = store.beginRecall("1:1", start);
  store.updateRecall(a.id, "audio");
  const reloaded = createLearningStore(storage, surahs, { timeZone: "UTC" });
  expect(reloaded.snapshot().activeReview.audioBeforeRecall).toBe(true);
  const b = reloaded.beginRecall("114:1", start);
  expect(b.usedHint).toBe(false);
  expect(b.audioBeforeRecall).toBe(false);
  expect(() => store.gradeRecall(a.id, "Good", start)).toThrow(
    "no longer active",
  );
  reloaded.updateRecall(b.id, "compare");
  reloaded.gradeRecall(b.id, "Good", start);
  expect(reloaded.getRecord("114:1").memory.independentAttempts).toBe(1);
  expect(reloaded.getRecord("1:1").memory.independentAttempts).toBe(0);
});

test("Chicago day boundaries govern rewards and due-today selection", () => {
  expect(dayKey("2026-01-02T03:00:00Z", "America/Chicago")).toBe("2026-01-01");
  const storage = new Storage(),
    now = new Date("2026-01-02T03:00:00Z");
  const store = createLearningStore(storage, surahs, {
    timeZone: "America/Chicago",
    clock: () => now,
  });
  assess(store, "1:1", "Good", now);
  expect(store.daily(now).dueToday).toHaveLength(1);
  expect(store.daily(now).dueNow).toHaveLength(0);
  expect(store.getRecord("1:1").memory.successfulDays).toEqual(["2026-01-01"]);
});

test("unsupported or corrupt canonical data is preserved and exportable", () => {
  for (const raw of [
    "broken json",
    JSON.stringify({ schemaVersion: 99, records: {} }),
  ]) {
    const storage = new Storage({
        [LEARNING_KEY]: raw,
        "ayah-quiz": '{"xp":23,"stars":7}',
      }),
      store = createLearningStore(storage, surahs, {
        timeZone: "UTC",
        clock: () => start,
      });
    expect(store.readOnly).toBe(true);
    expect(() => store.beginRecall("1:1")).toThrow();
    expect(storage.getItem(LEARNING_KEY)).toBe(raw);
    expect(JSON.parse(store.exportData()).rawCanonical).toBe(raw);
    expect(store.snapshot().wallet.xp).toBe(23);
  }
  const storage = new Storage({
      "ayah-mastery": "malformed",
      "ayah-quiz": '{"xp":44,"stars":9}',
    }),
    store = createLearningStore(storage, surahs, {
      timeZone: "UTC",
      clock: () => start,
    });
  expect(
    JSON.parse(storage.getItem(LEGACY_BACKUP_KEY)).keys["ayah-mastery"],
  ).toBe("malformed");
  expect(store.snapshot().wallet.xp).toBe(44);
});

test("failed persistence does not acknowledge or grant an unsaved assessment", () => {
  const { store, storage } = create();
  const a = store.beginRecall("1:1", start);
  store.updateRecall(a.id, "compare");
  const before = storage.getItem(LEARNING_KEY);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === LEARNING_KEY) throw new Error("quota");
    write(key, value);
  };
  expect(() => store.gradeRecall(a.id, "Good", start)).toThrow("not saved");
  expect(storage.getItem(LEARNING_KEY)).toBe(before);
  expect(store.snapshot().activeReview.graded).toBe(false);
  expect(store.snapshot().wallet.xp).toBe(0);
  storage.setItem = write;
  expect(store.gradeRecall(a.id, "Good", start).reward.xp).toBe(40);
});

test("correct study-reminder recall clears the reminder; an actual early lapse updates FSRS", () => {
  const { store } = create();
  assess(store, "1:1", "Easy", start);
  const original = store.getRecord("1:1").memory.card;
  let a = store.beginRecall("1:1", new Date("2026-10-12T12:01:00Z"));
  store.updateRecall(a.id, "hint");
  store.gradeRecall(a.id, "Good", new Date("2026-10-12T12:01:00Z"));
  expect(store.daily(new Date("2026-10-12T12:12:00Z")).dueNow).toHaveLength(1);
  assess(store, "1:1", "Good", new Date("2026-10-12T12:12:00Z"));
  expect(store.getRecord("1:1").memory.card).toEqual(original);
  expect(store.getRecord("1:1").memory.practiceDue).toBeNull();
  expect(store.daily(new Date("2026-10-12T12:13:00Z")).dueNow).toHaveLength(0);
  const result = assess(
    store,
    "1:1",
    "Again",
    new Date("2026-10-12T12:15:00Z"),
  ).result;
  expect(result.scheduleUpdated).toBe(true);
  expect(store.getRecord("1:1").memory.lapses).toBe(1);
  expect(new Date(result.nextReview).getTime()).toBeLessThan(
    new Date(original.due).getTime(),
  );
});
