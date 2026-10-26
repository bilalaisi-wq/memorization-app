import { expect, test } from "@playwright/test";
import { createRewardStore, rewardSummary } from "../src/rewards/store.js";
import { RewardPublisher } from "../src/rewards/publisher.js";
const storage = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
const learning = {
  snapshot: () => ({
    wallet: { xp: 100, stars: 3 },
    records: {
      "1:1": {
        game: {
          history: [{
            sessionId: "q1",
            at: new Date(Date.now() - 1000).toISOString(),
            xp: 20,
            stars: 1,
          }],
        },
        memory: { history: [] },
      },
    },
  }),
};
test("Every mode earns bounded study XP without changing FSRS, and migration preserves undated legacy XP", () => {
  const s = storage(),
    store = createRewardStore(s),
    now = new Date("2026-10-26T12:00:00Z");
  for (
    const mode of [
      "practice",
      "quest",
      "recall-puzzle",
      "active-recall",
      "lab",
      "chain",
      "passage",
      "passage-recall",
    ]
  ) expect(store.award({ mode, unit: "1:1", now }).xp).toBe(1);
  for (let i = 0; i < 20; i++) {
    store.award({
      mode: "practice",
      unit: "1:1",
      now: new Date(+now + i * 1000),
    });
  }
  expect(store.snapshot().events.filter((e) => e.mode === "practice"))
    .toHaveLength(5);
  const summary = rewardSummary(learning, s);
  expect(summary.legacyXP).toBe(80);
  expect(summary.legacyStars).toBe(2);
  expect(learning.snapshot().wallet.xp).toBe(100);
});
test("Publisher retries offline earnings, deduplicates receipts, minimizes reference data and supports older leaderboard deployments", async () => {
  const s = storage(), store = createRewardStore(s);
  store.award({ mode: "practice", unit: "113:1" });
  let fail = true, calls = [];
  const client = {
    rpc: async (name, body) => {
      calls.push({ name, body });
      if (fail) return { error: { message: "offline" } };
      return { data: { balance: 100 } };
    },
  };
  const p = new RewardPublisher(client, learning, s);
  await expect(p.flush()).rejects.toThrow();
  fail = false;
  await p.flush();
  expect(calls.at(-1).body.events.length).toBe(2);
  expect(JSON.stringify(calls.at(-1).body)).not.toContain("113:1");
  await p.flush();
  expect(calls.at(-1).body.events).toEqual([]);
  const old = new RewardPublisher(
    {
      rpc: async (name, body) => {
        calls.push({ name, body });
        return name === "sync_learning_rewards"
          ? { error: { code: "PGRST202" } }
          : { data: null };
      },
    },
    learning,
    s,
  );
  await old.flush();
  expect(calls.at(-1).name).toBe("publish_weekly_activity");
  expect(
    calls.at(-1).body.learning.records.learning_rewards.game.history.length,
  ).toBe(2);
});
test("Unsupported local reward records are preserved instead of overwritten", () => {
  const s = storage();
  s.setItem("ayah-rewards-v1", '{"version":99}');
  const store = createRewardStore(s);
  expect(() => store.award({ mode: "practice", unit: "1:1" })).toThrow();
  expect(s.getItem("ayah-rewards-v1")).toBe('{"version":99}');
});
