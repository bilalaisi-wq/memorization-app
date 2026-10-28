import { versionedStore } from "../ui/versioned-store.js";
export const LAB_KEY = "ayah-puzzle-lab-v1";
export const gameTypes = [
  [
    "falling",
    "Falling Words",
    "Stack word tetrominoes and build an ayah tower.",
    "order",
  ],
  [
    "vanishing",
    "Vanishing Ayah",
    "Rebuild words as 25%, 50%, 75%, then all disappear.",
    "vocabulary",
  ],
  [
    "jigsaw",
    "Ayah Jigsaw",
    "Connect larger word groups with fewer cues.",
    "order",
  ],
  [
    "match",
    "Memory Match",
    "Pair words, meanings, audio, or ayah continuations.",
    "vocabulary",
  ],
  [
    "chain",
    "Broken Chain",
    "Restore the ayahs in their canonical order.",
    "transitions",
  ],
  [
    "continue",
    "Continue the Ayah",
    "Try the remaining words before revealing them.",
    "beginning",
  ],
  [
    "detective",
    "Similar Ayah Detective",
    "Distinguish checked passages from the verified library.",
    "similar",
  ],
];
export function createPuzzleStore(storage, surahs) {
  const keys = new Set(
    surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
  );
  const store = versionedStore(
    storage,
    LAB_KEY,
    () => ({ schemaVersion: 1, history: [], weaknesses: {} }),
    (s) =>
      s?.schemaVersion === 1 &&
      Array.isArray(s.history) &&
      s.history.every(
        (h) =>
          keys.has(h.key) &&
          gameTypes.some((g) => g[0] === h.game) &&
          typeof h.sessionId === "string" &&
          Number.isInteger(h.mistakes) &&
          h.mistakes >= 0,
      ) &&
      s.weaknesses &&
      !Array.isArray(s.weaknesses) &&
      Object.entries(s.weaknesses).every(
        ([key, stats]) =>
          keys.has(key) &&
          Object.entries(stats).every(
            ([category, n]) =>
              gameTypes.some((g) => g[3] === category) &&
              Number.isInteger(n) &&
              n >= 0,
          ),
      ),
  );
  return {
    ...store,
    get warning() {
      return store.warning;
    },
    record(result) {
      return store.transact((s) => {
        if (s.history.some((h) => h.sessionId === result.sessionId)) return;
        const category = gameTypes.find((g) => g[0] === result.game)[3];
        const stats = (s.weaknesses[result.key] ??= {});
        // Practice-chain failure receipts already counted earlier errors in this run.
        const mistakes = Number.isInteger(result.arcade?.newErrors) && result.arcade.newErrors >= 0 && result.arcade.newErrors <= result.mistakes ? result.arcade.newErrors : result.mistakes;
        stats[category] = Math.max(
          0,
          (stats[category] || 0) +
            (mistakes || 0) -
            (mistakes ? 0 : 1),
        );
        s.history.push({ ...result, at: new Date().toISOString() });
      });
    },
    recommend(key, learning, now = new Date()) {
      const r = learning.getRecord(key);
      if (r.memory.nextReview && new Date(r.memory.nextReview) <= now)
        return {
          game: "recall",
          reason:
            "This ayah is due. Start with independent recall, then use a corrective puzzle.",
        };
      const stats = store.snapshot().weaknesses[key] || {};
      const category = Object.entries(stats)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (category)
        return {
          game: gameTypes.find((g) => g[3] === category)[0],
          reason: `Based on your recorded ${category} practice mistakes.`,
        };
      if (r.game.mistakes)
        return {
          game: "falling",
          reason:
            "Your Puzzle Quest records show ordering mistakes. Try careful word placement.",
        };
      return {
        game: "falling",
        reason:
          "Start with untimed word placement. Recommendations adapt to your practice mistakes.",
      };
    },
  };
}
