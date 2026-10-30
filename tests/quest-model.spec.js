import { test, expect } from "@playwright/test";
import { localBundle } from "../src/content/library.js";
import { surahs } from "../src/data.js";
import {
  createCampaignMap,
  resumeCampaignMap,
  mapNodes,
  nextCheckpoint,
} from "../src/quest/map.js";
import { campaigns } from "../src/quest/registry.js";
import { createQuestStore, QUEST_KEY } from "../src/quest/store.js";
import { selectRevision, recallEvidence } from "../src/quest/revision.js";
import { createQuestRewards, visualUnlocks } from "../src/quest/rewards.js";
import { createLearningStore } from "../src/learning-store.js";
import { createPuzzleStore } from "../src/puzzles/puzzle-store.js";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};
const bundle = () => localBundle("1:1");
const options = () => ({
  campaignId: "passage-expedition",
  bundles: [bundle()],
  game: "snake",
});
const storeFor = (s, extra = {}) =>
  createQuestStore({ owner: null, getOwner: () => null, storage: s, ...extra });

test("all campaign policies generate canonical deterministic IDs without conflating pages and recall units", async () => {
  expect(campaigns).toHaveLength(5);
  for (const c of campaigns) {
    const args = {
      campaignId: c.id,
      bundles: [localBundle("98:5"), bundle()],
      game: "snake",
    };
    const a = await createCampaignMap(args),
      b = await createCampaignMap({ ...args, bundles: args.bundles.reverse() });
    expect(a).toEqual(b);
    expect(new Set(a.checkpoints.map((c) => c.id)).size).toBe(
      a.checkpoints.length,
    );
    for (const cp of a.checkpoints) {
      expect(cp.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(cp.segmentHash).toHaveLength(64);
      if (cp.type === "study") {
        expect(cp.workspace.lastWord - cp.workspace.firstWord).toBeLessThan(12);
        expect(cp.recall).toBe(null);
      }
      if (cp.type === "recall") {
        expect(cp.workspace).toBe(null);
        expect(cp.recall.id).toBe(`ayah:${cp.key}`);
      }
    }
  }
  await expect(
    createCampaignMap({ campaignId: "x", bundles: [bundle()] }),
  ).rejects.toThrow();
  await expect(
    createCampaignMap({
      ...options(),
      bundles: [{ ...bundle(), key: "01:1" }],
    }),
  ).rejects.toThrow("Canonical");
  await expect(
    createCampaignMap({ ...options(), bundles: [bundle(), bundle()] }),
  ).rejects.toThrow("distinct");
});

test("source/review changes produce fresh maps and old completed checkpoints remain saved", async () => {
  const s = storage(),
    store = storeFor(s),
    map = await createCampaignMap(options());
  store.open(map);
  const cp = map.checkpoints[0];
  store.start(map, cp);
  store.complete(map, cp, { evidence: "practice" });
  expect(nextCheckpoint(map, store.snapshot().runs[map.id]).type).toBe(
    "arcade",
  );
  const resumed = await resumeCampaignMap({
    store,
    runId: map.id,
    bundleLoader: async () => bundle(),
  });
  expect(resumed.changed).toBe(false);
  expect(resumed.map.game).toBe("snake");
  const changed = {
    ...bundle(),
    contentRevision: "new-validated-source-version",
  };
  const newer = await resumeCampaignMap({
    store,
    runId: map.id,
    bundleLoader: async () => changed,
  });
  expect(newer.changed).toBe(true);
  expect(Object.keys(store.snapshot().runs)).toHaveLength(2);
  expect(store.snapshot().runs[map.id].completed[cp.id]).toBeTruthy();
  const reviewed = { ...bundle(), segmentationReview: { version: 1 } };
  expect(
    (await createCampaignMap({ ...options(), bundles: [reviewed] })).id,
  ).not.toBe(map.id);
});

test("resumable checkpoint transactions preserve old learning records, metadata-only storage, locks and duplicates", async () => {
  const s = storage();
  s.setItem("ayah-learning-v1", "existing");
  s.setItem("ayah-passage-recall-v1", "existing");
  const store = storeFor(s),
    map = await createCampaignMap(options());
  store.open(map);
  const [first, second] = map.checkpoints;
  expect(() => store.start(map, second)).toThrow("locked");
  const at = store.start(map, first);
  expect(store.start(map, first)).toBe(at);
  const result = store.complete(map, first, {
    xp: 8,
    evidence: "practice",
    mistakes: 2,
  });
  expect(store.complete(map, first, { xp: 8, evidence: "practice" })).toEqual({
    ...result,
    duplicate: true,
  });
  const reloaded = storeFor(s);
  expect(reloaded.snapshot()).toEqual(store.snapshot());
  expect(
    mapNodes(map, reloaded.snapshot().runs[map.id]).map((n) => n.state),
  ).toEqual(["complete", "available", "locked"]);
  expect(visualUnlocks(map, store.snapshot().runs[map.id])).toHaveLength(1);
  const raw = s.getItem(QUEST_KEY);
  expect(raw).not.toMatch(/[\u0600-\u06ff]/);
  expect(raw).not.toContain("textUthmani");
  expect(s.getItem("ayah-learning-v1")).toBe("existing");
  expect(s.getItem("ayah-passage-recall-v1")).toBe("existing");
});

test("future/corrupt data, failed writes and account changes cannot reset or acknowledge progress", async () => {
  const map = await createCampaignMap(options());
  for (const raw of ["{", '{"version":99,"records":{}}']) {
    const s = storage();
    s.setItem(QUEST_KEY, raw);
    const store = storeFor(s);
    expect(() => store.open(map)).toThrow("recovery");
    expect(store.exportRaw()).toBe(raw);
  }
  const s = storage(),
    store = storeFor(s);
  store.open(map);
  const before = s.getItem(QUEST_KEY);
  const fail = storeFor({
    ...s,
    setItem() {
      throw Error("full");
    },
  });
  expect(() => fail.start(map, map.checkpoints[0])).toThrow("full");
  expect(s.getItem(QUEST_KEY)).toBe(before);
  let owner = "A";
  const a = createQuestStore({
    owner: "A",
    getOwner: () => owner,
    storage: storage(),
  });
  a.open(map);
  owner = "B";
  expect(() => a.snapshot()).toThrow("Account changed");
  expect(() =>
    a.complete(map, map.checkpoints[0], { evidence: "practice" }),
  ).toThrow();
});

test("planned arcade games are normalized to fallback practice and never become launch targets", async () => {
  for (const game of ["bridge", "bubble", "sirat", "unknown"]) {
    const map = await createCampaignMap({ ...options(), game });
    expect(map.game).toBe(null);
    expect(map.checkpoints.find((c) => c.type === "arcade").game).toBe(null);
  }
});

test("read-only revision selectors respect access and existing self-assessed history without scheduling", () => {
  const at = "2026-01-01T00:00:00Z",
    good = { at, attemptId: "attempt", grade: "Good", independent: true };
  const unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  const learning = {
    records: {
      "1:1": { memory: { nextReview: at, lapses: 2, history: [good] } },
      "2:255": { memory: { nextReview: at, history: [] } },
    },
  };
  const before = JSON.stringify(learning);
  expect(
    selectRevision({
      learning,
      allowedRefs: ["1:1"],
      now: new Date("2026-01-02"),
    }),
  ).toMatchObject({ due: [{ unit }], weak: [{ unit }] });
  expect(recallEvidence(unit, { learning, startedAt: at })).toEqual(good);
  expect(recallEvidence(unit, { learning, startedAt: "2026-01-02" })).toBe(
    null,
  );
  expect(
    recallEvidence(unit, {
      learning: {
        records: {
          "1:1": { memory: { history: [{ ...good, independent: false }] } },
        },
      },
      startedAt: at,
    }),
  ).toBe(null);
  expect(JSON.stringify(learning)).toBe(before);
});

test("practice receipts survive split-write retries and share existing reward caps; arcade XP never alters FSRS", async () => {
  const s = storage(),
    learning = createLearningStore(s, surahs),
    lab = createPuzzleStore(s, surahs),
    store = storeFor(s);
  const rewards = createQuestRewards({
    storage: s,
    learning,
    lab,
    owner: null,
    getOwner: () => null,
  });
  const map = await createCampaignMap(options());
  store.open(map);
  const cp = map.checkpoints[0];
  store.start(map, cp);
  expect(rewards.practice(cp)).toBe(8);
  expect(rewards.practice(cp)).toBe(8);
  expect(JSON.parse(s.getItem("ayah-rewards-v1")).events).toHaveLength(1);
  const state = learning.snapshot(),
    memory = state.records["1:1"]?.memory;
  const arcade = {
    id: map.checkpoints[1].id,
    game: "snake",
    status: "won",
    completed: ["1:1"],
    config: { keys: ["1:1"], mode: "single", chainMode: "practice", seed: 1 },
    mistakes: [],
    motorErrors: [],
    assistance: [],
  };
  rewards.arcade(arcade);
  rewards.arcade(arcade);
  rewards.arcade({ ...arcade, id: "another-session" });
  expect(learning.snapshot().wallet.xp - state.wallet.xp).toBe(8);
  if (memory) expect(learning.snapshot().records["1:1"].memory).toEqual(memory);
  expect(learning.snapshot().records["1:1"].memory.history).toEqual([]);
  expect(learning.snapshot().records["1:1"].memory.independentAttempts).toBe(0);
  expect(learning.snapshot().records["1:1"].memory.card).toBe(null);
});

test("reviewed recitation units are explicit, revision-bound and never inferred from visual workspaces", async () => {
  const base = bundle();
  await expect(
    createCampaignMap({ ...options(), units: { "1:1": "visual-page-1" } }),
  ).rejects.toThrow("reviewed");
  const segment = {
    id: "fixture-only",
    reference: "1:1",
    kind: "reviewed",
    firstWord: 1,
    lastWord: 2,
    review: {
      status: "approved",
      reviewer: "TEST FIXTURE",
      reviewedAt: "2026-01-01",
      evidence: "Test mechanics, no production approval",
    },
  };
  const args = {
    ...options(),
    bundles: [{ ...base, segments: [...base.segments, segment] }],
    units: { "1:1": "fixture-only" },
  };
  const map = await createCampaignMap(args),
    cp = map.checkpoints.find((c) => c.type === "recall");
  expect(cp.recall.type).toBe("segment");
  expect(cp.workspace).toBe(null);
  expect(cp.recall.lastWord).toBe(2);
  const edited = { ...segment, lastWord: 3 };
  const newMap = await createCampaignMap({
    ...args,
    bundles: [{ ...base, segments: [...base.segments, edited] }],
  });
  expect(newMap.id).not.toBe(map.id);
  expect(
    newMap.checkpoints.find((c) => c.type === "recall").recall.id,
  ).not.toBe(cp.recall.id);
  const s = storage(),
    store = storeFor(s);
  store.open(map);
  expect(
    (
      await resumeCampaignMap({
        store,
        runId: map.id,
        bundleLoader: async () => args.bundles[0],
      })
    ).map.id,
  ).toBe(map.id);
});

test("a crash between XP receipt and quest commit can be retried without granting a second reward", async () => {
  const s = storage(),
    learning = createLearningStore(s, surahs),
    lab = createPuzzleStore(s, surahs);
  let fail = false;
  const flaky = {
    ...s,
    setItem(k, v) {
      if (fail && k === QUEST_KEY) throw Error("quota");
      s.setItem(k, v);
    },
  };
  const store = storeFor(flaky),
    map = await createCampaignMap(options());
  store.open(map);
  const cp = map.checkpoints[0];
  store.start(map, cp);
  const rewards = createQuestRewards({
    storage: flaky,
    learning,
    lab,
    owner: null,
    getOwner: () => null,
  });
  fail = true;
  const xp = rewards.practice(cp);
  expect(() => store.complete(map, cp, { xp, evidence: "practice" })).toThrow(
    "quota",
  );
  expect(Object.keys(store.snapshot().runs[map.id].completed)).toHaveLength(0);
  fail = false;
  store.complete(map, cp, { xp: rewards.practice(cp), evidence: "practice" });
  expect(JSON.parse(s.getItem("ayah-rewards-v1")).events).toHaveLength(1);
  expect(store.snapshot().runs[map.id].completed[cp.id].xp).toBe(8);
});

test("duplicate recall-unit selectors retain the earliest due date and strongest weak-memory signal", () => {
  const unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  const learning = {
    records: {
      "1:1": { memory: { nextReview: "2026-01-01", lapses: 5, history: [] } },
    },
  };
  const passageMemory = {
    records: {
      "ayah:1:1": {
        unit,
        card: { due: "2026-01-02" },
        history: [{ grade: "Again" }],
      },
    },
  };
  const result = selectRevision({
    learning,
    passageMemory,
    allowedRefs: ["1:1"],
    now: new Date("2026-01-03"),
  });
  expect(result.due).toHaveLength(1);
  expect(result.due[0].due).toBe("2026-01-01");
  expect(result.weak[0].mistakes).toBe(5);
  expect(selectRevision({ allowedRefs: [] })).toEqual({ due: [], weak: [] });
});
