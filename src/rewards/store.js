import { versionedStore } from "../ui/versioned-store.js";
import { profileStorage } from "../learner/profile-storage.js";
export const REWARDS_KEY = "ayah-rewards-v1";
export const rewardModes = [
  "practice",
  "quest",
  "recall-puzzle",
  "active-recall",
  "lab",
  "chain",
  "passage",
  "passage-recall",
];
export function createRewardStore(storage = profileStorage) {
  const store = versionedStore(
    storage,
    REWARDS_KEY,
    () => ({ version: 1, events: [], buckets: {} }),
    (v) =>
      v?.version === 1 && Array.isArray(v.events) && v.events.every((e) =>
        typeof e.id === "string" && Number.isFinite(Date.parse(e.at)) &&
        rewardModes.includes(e.mode) && Number.isInteger(e.xp) && e.xp >= 0 &&
        e.xp <= 20
      ) && v.buckets && typeof v.buckets === "object" &&
      !Array.isArray(v.buckets) && Object.values(v.buckets).every((b) =>
        Number.isInteger(b.count) && b.count >= 0 && Number.isFinite(b.last) &&
        b.last >= 0
      ),
  );
  return {
    ...store,
    award({ mode, unit, action = "study", xp = 1, now = new Date(), receiptId = null }) {
      if (
        !rewardModes.includes(mode) || !unit || (receiptId !== null && !/^quest:[a-f0-9]{64}$/.test(receiptId)) || !Number.isInteger(xp) ||
        xp < 1 || xp > 20
      ) throw Error("Invalid study reward");
      const day = new Date(now).toISOString().slice(0, 10),
        bucket = `${day}:${mode}:${unit}:${action}`;
      const result = store.transact((v) => {
        if (receiptId) {
          const previous = v.events.find(e => e.id === receiptId);
          if (previous) return { xp: previous.xp, duplicate: true };
        }
        const old = v.buckets[bucket] || { count: 0, last: 0 },
          daily = v.events.filter((e) => e.at.slice(0, 10) === day).reduce(
            (n, e) => n + e.xp,
            0,
          ),
          modeDaily = v.events.filter((e) =>
            e.at.slice(0, 10) === day && e.mode === mode
          ).reduce((n, e) => n + e.xp, 0);
        if (
          old.count >= (xp > 1 ? 2 : 5) || +new Date(now) - old.last < 300 ||
          daily >= 600 || modeDaily >= 200
        ) return { xp: 0, capped: true };
        const earned = Math.min(xp, 600 - daily, 200 - modeDaily);
        const event = {
          id: receiptId || crypto.randomUUID(),
          at: new Date(now).toISOString(),
          mode,
          xp: earned,
          stars: 0,
          recalls: 0,
        };
        v.events.push(event);
        v.buckets[bucket] = { count: old.count + 1, last: +new Date(now) };
        return { xp: earned, event };
      });
      if (result.xp && !result.duplicate && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ayahrewardschanged", { detail: result }),
        );
      }
      return result;
    },
  };
}
export function awardStudy(input) {
  try {
    return createRewardStore().award(input);
  } catch {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ayahrewardserror"));
    }
    return { xp: 0, unavailable: true };
  }
}
export function receiveRemoteRewards(profile) {
  if (
    !profile || !Number.isFinite(profile.lifetimeXp) ||
    !Number.isFinite(profile.lifetimeStars)
  ) return;
  profileStorage.setItem(
    "ayah-reward-remote-v1",
    JSON.stringify({ xp: profile.lifetimeXp, stars: profile.lifetimeStars }),
  );
  window.dispatchEvent(
    new CustomEvent("ayahrewardsremote", { detail: profile }),
  );
}
export function rewardSummary(learning, storage = profileStorage) {
  const main = learning.snapshot(),
    supp = createRewardStore(storage).snapshot(),
    events = [];
  for (const [key, r] of Object.entries(main.records || {})) {
    for (const [i, h] of (r.game.history || []).entries()) {
      if (h.at) {
        events.push({
          id: `game:${h.sessionId || `${key}:${h.at}:${i}`}`,
          at: h.at,
          mode: h.lab ? "lab" : "quest",
          xp: h.xp || 0,
          stars: h.stars || 0,
          recalls: 0,
        });
      }
    }
    for (const [i, h] of (r.memory.history || []).entries()) {
      if (h.at) {
        events.push({
          id: `recall:${h.attemptId || `${key}:${h.at}:${i}`}`,
          at: h.at,
          mode: "active-recall",
          xp: h.reward?.xp || 0,
          stars: h.reward?.stars || 0,
          recalls: h.independent ? 1 : 0,
        });
      }
    }
  }
  events.push(...supp.events);
  const unique = [
    ...new Map(
      events.filter((e) =>
        Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= Date.now()
      ).map((e) => [e.id, e]),
    ).values(),
  ];
  const xp = main.wallet.xp + supp.events.reduce((n, e) => n + e.xp, 0),
    stars = main.wallet.stars;
  const supplementalIds = new Set(supp.events.map((e) => e.id));
  const original = events.filter((e) => !supplementalIds.has(e.id));
  const legacyXP = Math.max(
      0,
      main.wallet.xp - original.reduce((n, e) => n + e.xp, 0),
    ),
    legacyStars = Math.max(
      0,
      main.wallet.stars - original.reduce((n, e) => n + e.stars, 0),
    );
  let remote = { xp: 0, stars: 0 };
  try {
    remote = JSON.parse(storage.getItem("ayah-reward-remote-v1")) || remote;
  } catch {}
  return {
    xp: Math.max(xp, remote.xp || 0),
    stars: Math.max(stars, remote.stars || 0),
    legacyXP,
    legacyStars,
    events: unique,
    legacyBasis: Math.max(
      0,
      xp + stars * 5 - unique.reduce((n, e) => n + e.xp + e.stars * 5, 0),
    ),
    supplementalXP: xp - main.wallet.xp,
  };
}
