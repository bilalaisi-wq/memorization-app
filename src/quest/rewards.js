import { arcadeIds } from "../puzzles/arcade/registry.js";
import { createResultRecorder } from "../puzzles/arcade/results.js";
import { createRewardStore } from "../rewards/store.js";
export function createQuestRewards({
  storage,
  learning,
  lab,
  owner,
  getOwner,
}) {
  const arcade = createResultRecorder({
    learning,
    lab,
    accountId: owner,
    getAccountId: getOwner,
  });
  const practice = createRewardStore(storage);
  return {
    arcade(snapshot) {
      if (getOwner() !== owner)
        throw Error("Account changed; reopen the quest");
      if (
        snapshot.status !== "won" ||
        !arcadeIds.includes(snapshot.game) ||
        snapshot.completed?.join("|") !== snapshot.config?.keys?.join("|")
      )
        throw Error("Only completed arcade sessions can be rewarded");
      const prior = practice
        .snapshot()
        .events.find((event) => event.id === snapshot.id);
      if (prior) return prior.xp;
      return arcade(snapshot).reduce((n, r) => n + r.xp, 0);
    },
    practice(checkpoint) {
      if (getOwner() !== owner)
        throw Error("Account changed; reopen the quest");
      const prior =
        learning.snapshot().receipts?.[
          `arcade:${checkpoint.id}:${checkpoint.key}`
        ];
      if (prior) return prior.xp;
      return practice.award({
        mode: "passage",
        unit: checkpoint.key,
        action: "completion",
        xp: 8,
        receiptId: checkpoint.id,
      }).xp;
    },
  };
}
export function visualUnlocks(map, run) {
  return map.checkpoints
    .filter((c) => run?.unlocks?.includes(c.id))
    .map((c) => ({
      id: c.id,
      key: c.key,
      kind: "quest-token",
      label: "Activity completed · not memorization mastery",
    }));
}
