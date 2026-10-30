import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { localBundle } from "../src/content/library.js";
import {
  createExpeditionMap,
  validDraft,
  expeditionOptions,
} from "../src/quest/expedition/model.js";
import { createQuestStore, QUEST_KEY } from "../src/quest/store.js";
import { wordWindow } from "../src/passage/model.js";
const fixture = (key) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/${key.replace(":", "-")}.json`, import.meta.url),
    ),
  );
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
for (const key of ["1:1", "2:255", "2:282"])
  test(`expedition ${key} preserves exact coverage and separates visual study from independent recall`, async () => {
    const b = key === "1:1" ? localBundle(key) : fixture(key),
      before = JSON.stringify(b),
      map = await createExpeditionMap({ bundles: [b] });
    expect(map).toEqual(await createExpeditionMap({ bundles: [b] }));
    expect(map.routeVersion).toBe(2);
    expect(map.checkpoints[0].stage).toBe("discovery");
    expect(map.checkpoints.at(-1).recall.id).toBe(`ayah:${key}`);
    const forge = map.checkpoints.filter((c) => c.stage === "forge");
    expect(forge).toHaveLength(wordWindow(b, 0).count);
    const positions = forge.flatMap((c) =>
      Array.from(
        { length: c.workspace.lastWord - c.workspace.firstWord + 1 },
        (_, i) => c.workspace.firstWord + i,
      ),
    );
    expect(positions).toEqual(b.words.map((w) => w.position));
    expect(forge.every((c) => c.recall === null)).toBe(true);
    const links = map.checkpoints.filter((c) => c.stage === "link");
    expect(links.map((c) => c.through)).toEqual(forge.map((_, i) => i));
    expect(JSON.stringify(b)).toBe(before);
    const s = storage(),
      store = createQuestStore({
        storage: s,
        owner: null,
        getOwner: () => null,
      });
    store.open(map);
    expect(s.getItem(QUEST_KEY)).not.toMatch(/[\u0600-\u06ff]/);
  });
test("chain ends with exact-reference independent passage recall, never combines text into a new ayah", async () => {
  const map = await createExpeditionMap({
    bundles: [localBundle("1:2"), localBundle("1:1")],
  });
  expect(map.checkpoints.at(-2).stage).toBe("chain");
  const last = map.checkpoints.at(-1);
  expect(last.recall.type).toBe("passage");
  expect(last.recall.refs).toEqual(["1:1", "1:2"]);
  expect(last.passagePins).toHaveLength(2);
});
test("drafts and recovery remain position-only; malformed imports preserve originals", async () => {
  const s = storage(),
    store = createQuestStore({ storage: s, owner: null, getOwner: () => null }),
    b = localBundle("1:1"),
    map = await createExpeditionMap({ bundles: [b] });
  store.open(map);
  const gate = map.checkpoints[0],
    forge = map.checkpoints[1];
  store.start(map, gate);
  store.complete(map, gate, { evidence: "practice" });
  store.start(map, forge);
  const draft = {
    round: 1,
    order: [2, 1],
    assistance: 1,
    mistakes: 0,
    revealed: false,
  };
  store.saveDraft(map, forge, draft);
  expect(store.snapshot().runs[map.id].drafts[forge.id]).toEqual(draft);
  expect(validDraft({ ...draft, order: [999] }, forge, b)).toBe(false);
  const raw = store.exportRaw();
  s.setItem(QUEST_KEY, "broken original");
  expect(() => store.restoreRaw('{"version":99}')).toThrow();
  expect(s.getItem(QUEST_KEY)).toBe("broken original");
  store.restoreRaw(raw);
  expect(s.getItem("ayah-quest-recovery-backup-v1")).toBe("broken original");
  expect(store.snapshot().runs[map.id].drafts[forge.id]).toEqual(draft);
});
test("free selector never advertises unsupported or developer-only chapters to guests", () => {
  const free = expeditionOptions();
  expect(free.some((o) => o.key === "1:1")).toBe(true);
  expect(free.some((o) => o.key === "2:282")).toBe(false);
  const privateOptions = expeditionOptions({ signed: true });
  expect(privateOptions.some((o) => o.key === "2:282")).toBe(true);
  expect(privateOptions.some((o) => o.key === "7:172")).toBe(false);
  expect(
    expeditionOptions({ signed: true, developer: true }).some(
      (o) => o.key === "7:172",
    ),
  ).toBe(true);
});

test("runtime game selection replaces planned or absent trials with an actually registered game", async () => {
  const { chooseRegisteredGame } = await import("../src/quest/checkpoints.js");
  expect(
    chooseRegisteredGame(
      [{ id: "bridge", status: "planned" }, { id: "maze" }],
      "bridge",
      ["falling"],
    ),
  ).toBe("maze");
  expect(
    chooseRegisteredGame(
      [{ id: "falling", status: "available" }, { id: "maze" }],
      "falling",
      ["falling"],
    ),
  ).toBe("falling");
  expect(
    chooseRegisteredGame([{ id: "bridge", status: "planned" }], "bridge", [
      "falling",
    ]),
  ).toBe(null);
});

test("changing between a won arcade and guided practice after a failed checkpoint write cannot award twice", async () => {
  const { createQuestRewards } = await import("../src/quest/rewards.js");
  const { createLearningStore } = await import("../src/learning-store.js");
  const { createPuzzleStore } = await import("../src/puzzles/puzzle-store.js");
  const { surahs } = await import("../src/data.js");
  const s = storage(),
    learning = createLearningStore(s, surahs),
    lab = createPuzzleStore(s, surahs),
    rewards = createQuestRewards({
      storage: s,
      learning,
      lab,
      owner: null,
      getOwner: () => null,
    });
  const trial = async (key) =>
    (
      await createExpeditionMap({ bundles: [localBundle(key)], game: "maze" })
    ).checkpoints.find((c) => c.stage === "trial");
  const snapshot = (cp) => ({
    id: cp.id,
    game: "maze",
    status: "won",
    completed: [cp.key],
    config: { keys: [cp.key], mode: "single", chainMode: "practice", seed: 1 },
    mistakes: [],
    assistance: [],
    motorErrors: [],
  });
  const a = await trial("1:1");
  expect(rewards.arcade(snapshot(a))).toBe(8);
  expect(rewards.practice(a)).toBe(8);
  expect(s.getItem("ayah-rewards-v1")).toBe(null);
  const b = await trial("1:2");
  expect(rewards.practice(b)).toBe(8);
  expect(rewards.arcade(snapshot(b))).toBe(8);
  expect(learning.snapshot().wallet.xp).toBe(8);
  expect(JSON.parse(s.getItem("ayah-rewards-v1")).events).toHaveLength(1);
  expect(() => rewards.arcade({ ...snapshot(b), status: "lost" })).toThrow(
    "completed",
  );
});
