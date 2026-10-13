import { versionedStore } from "../ui/versioned-store.js";
import { gallerySurahIds } from "./masteryStories.js";
export const GALLERY_KEY = "ayah-gallery-v1";
export const CHECKPOINT_DAYS = 2;
const validDate = (d) =>
  typeof d === "string" && Number.isFinite(Date.parse(d));
export function qualifyingDays(record) {
  return [
    ...new Set(
      (record?.memory.history || [])
        .filter(
          (h) =>
            h.independent &&
            !h.usedHint &&
            !h.audioBeforeRecall &&
            h.scheduleUpdated &&
            !h.earlyPractice &&
            ["Hard", "Good", "Easy"].includes(h.grade),
        )
        .map((h) => h.day),
    ),
  ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}
export function createMasteryStore(storage, surahs) {
  const chapters = surahs.filter((s) => gallerySurahIds.includes(s.id));
  const validKeys = new Set(
    chapters.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
  );
  const store = versionedStore(
    storage,
    GALLERY_KEY,
    () => ({ schemaVersion: 1, unlocks: {}, collectibles: {}, seen: [] }),
    (s) =>
      s?.schemaVersion === 1 &&
      s.unlocks &&
      s.collectibles &&
      !Array.isArray(s.unlocks) &&
      !Array.isArray(s.collectibles) &&
      Array.isArray(s.seen) &&
      s.seen.every((k) => validKeys.has(k) && !!s.unlocks[k]) &&
      Object.entries(s.unlocks).every(
        ([k, v]) =>
          validKeys.has(k) && validDate(v.at) && Array.isArray(v.days),
      ) &&
      Object.entries(s.collectibles).every(
        ([k, v]) =>
          gallerySurahIds.includes(Number(k)) &&
          validDate(v.completedAt) &&
          chapters
            .find((chapter) => chapter.id === Number(k))
            .verses.every((verse) => s.unlocks[`${k}:${verse.id}`]) &&
          (!v.maintainedAt || validDate(v.maintainedAt)),
      ),
  );
  return {
    ...store,
    get warning() {
      return store.warning;
    },
    sync(learning, now = new Date()) {
      const records = learning.snapshot().records,
        before = store.snapshot();
      const unlocks = [],
        completed = [];
      let changed = false;
      const next = structuredClone(before);
      for (const chapter of chapters) {
        for (const verse of chapter.verses) {
          const key = `${chapter.id}:${verse.id}`,
            days = qualifyingDays(records[key]);
          if (!next.unlocks[key] && days.length >= CHECKPOINT_DAYS) {
            next.unlocks[key] = {
              at: now.toISOString(),
              days: days.slice(0, CHECKPOINT_DAYS),
            };
            unlocks.push(key);
            changed = true;
          }
        }
        const full = chapter.verses.every(
          (v) => next.unlocks[`${chapter.id}:${v.id}`],
        );
        if (full && !next.collectibles[chapter.id]) {
          next.collectibles[chapter.id] = {
            completedAt: now.toISOString(),
            maintainedAt: null,
          };
          completed.push(chapter.id);
          changed = true;
        }
        const maintained =
          full &&
          chapter.verses.every(
            (v) =>
              records[`${chapter.id}:${v.id}`]?.memory.stage === "retained" &&
              qualifyingDays(records[`${chapter.id}:${v.id}`]).length >= 3,
          );
        if (maintained && !next.collectibles[chapter.id].maintainedAt) {
          next.collectibles[chapter.id].maintainedAt = now.toISOString();
          changed = true;
        }
      }
      if (changed) store.transact((s) => Object.assign(s, next));
      return { unlocks, completed };
    },
    markSeen(keys) {
      store.transact((s) => {
        s.seen = [
          ...new Set([...s.seen, ...keys.filter((k) => !!s.unlocks[k])]),
        ];
      });
    },
    progress(surah, learning) {
      const s = store.snapshot(),
        records = learning.snapshot().records;
      const dates = surah.verses
        .map((v) => records[`${surah.id}:${v.id}`]?.memory.nextReview)
        .filter(Boolean)
        .sort();
      return {
        revealed: surah.verses.filter((v) => s.unlocks[`${surah.id}:${v.id}`])
          .length,
        full: !!s.collectibles[surah.id],
        maintained: !!s.collectibles[surah.id]?.maintainedAt,
        currentMaintained: surah.verses.every(
          (v) => records[`${surah.id}:${v.id}`]?.memory.stage === "retained",
        ),
        nextReview: dates[0] || null,
      };
    },
  };
}
