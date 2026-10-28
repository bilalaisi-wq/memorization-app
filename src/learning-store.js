import { arcadeIds } from "./puzzles/arcade/registry.js";
import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";
export const LEARNING_KEY = "ayah-learning-v1";
export const LEGACY_BACKUP_KEY = "ayah-learning-legacy-v1";
export const FSRS_SETTINGS = {
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
};
const scheduler = fsrs(FSRS_SETTINGS);
const clone = (value) => JSON.parse(JSON.stringify(value));
const nonnegative = (value) =>
  Number.isFinite(value) && value >= 0 ? value : 0;
const id = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
export function dayKey(date = new Date(), timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function emptyRecord(key) {
  return {
    key,
    game: {
      completed: false,
      puzzleWins: 0,
      puzzleXP: 0,
      puzzleStars: 0,
      mistakes: 0,
      hintUses: 0,
      history: [],
    },
    memory: {
      stage: "new",
      independentAttempts: 0,
      assistedAttempts: 0,
      successfulDays: [],
      mistakes: 0,
      lapses: 0,
      card: null,
      nextReview: null,
      practiceDue: null,
      history: [],
    },
  };
}
function restoreCard(card, now) {
  if (!card) return createEmptyCard(now);
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}
function recomputeStage(memory) {
  memory.stage = memory.card
    ? memory.successfulDays.length >= 3 && memory.card.state === State.Review
      ? "retained"
      : memory.card.state === State.Review
        ? "reviewing"
        : "recalling"
    : memory.assistedAttempts
      ? "studying"
      : "new";
}
function dueAt(memory) {
  const dates = [memory.card?.due, memory.practiceDue].filter(Boolean);
  return dates.sort()[0] || null;
}
export function createLearningStore(
  storage,
  surahs,
  {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    clock = () => new Date(),
  } = {},
) {
  const validKeys = new Set(
    surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
  );
  let warning = "",
    readOnly = false,
    data;
  const safeGet = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      readOnly = true;
      warning =
        "Browser storage is unavailable. Learning changes cannot be saved.";
      return null;
    }
  };
  const parseLegacy = (key, fallback) => {
    const raw = safeGet(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      warning =
        "Some older progress could not be read. Original data is preserved in the migration backup.";
      return fallback;
    }
  };
  function valid(value) {
    const object = (x) => x && typeof x === "object" && !Array.isArray(x);
    const number = (x) => Number.isFinite(x) && x >= 0;
    const date = (x) =>
      x === null || (typeof x === "string" && Number.isFinite(Date.parse(x)));
    try {
      new Intl.DateTimeFormat("en", { timeZone: value?.timeZone }).format(
        new Date(),
      );
    } catch {
      return false;
    }
    if (
      value?.schemaVersion !== 1 ||
      !object(value.records) ||
      !object(value.wallet) ||
      !number(value.wallet.xp) ||
      !number(value.wallet.stars) ||
      !number(value.wallet.streak) ||
      !object(value.rewardLedger) ||
      !object(value.receipts) ||
      typeof value.timeZone !== "string"
    )
      return false;
    if (
      !Object.entries(value.records).every(
        ([key, r]) =>
          /^\d+:\d+$/.test(key) &&
          r?.key === key &&
          object(r.game) &&
          typeof r.game.completed === "boolean" &&
          number(r.game.puzzleWins) &&
          number(r.game.puzzleXP) &&
          number(r.game.puzzleStars) &&
          number(r.game.mistakes) &&
          number(r.game.hintUses) &&
          Array.isArray(r.game.history) &&
          object(r.memory) &&
          Array.isArray(r.memory.history) &&
          Array.isArray(r.memory.successfulDays) &&
          r.memory.successfulDays.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) &&
          date(r.memory.nextReview) &&
          date(r.memory.practiceDue) &&
          number(r.memory.independentAttempts) &&
          number(r.memory.assistedAttempts) &&
          number(r.memory.mistakes) &&
          number(r.memory.lapses) &&
          ["new", "studying", "recalling", "reviewing", "retained"].includes(
            r.memory.stage,
          ) &&
          (!r.memory.card ||
            (date(r.memory.card.due) &&
              r.memory.card.due !== null &&
              date(r.memory.card.last_review ?? null) &&
              number(r.memory.card.reps) &&
              number(r.memory.card.stability) &&
              number(r.memory.card.difficulty) &&
              number(r.memory.card.elapsed_days) &&
              number(r.memory.card.scheduled_days) &&
              number(r.memory.card.lapses) &&
              [0, 1, 2, 3].includes(r.memory.card.state))),
      )
    )
      return false;
    const active = value.activeReview;
    return (
      active === null ||
      (object(active) &&
        typeof active.id === "string" &&
        typeof active.key === "string" &&
        typeof active.graded === "boolean" &&
        typeof active.usedHint === "boolean" &&
        typeof active.audioBeforeRecall === "boolean" &&
        typeof active.declaredRecited === "boolean" &&
        typeof active.comparisonRevealed === "boolean" &&
        (!active.graded ||
          (object(active.result) &&
            ["Again", "Hard", "Good", "Easy"].includes(active.result.grade) &&
            object(active.result.reward) &&
            number(active.result.reward.xp) &&
            number(active.result.reward.stars) &&
            date(active.result.nextReview))))
    );
  }
  const raw = safeGet(LEARNING_KEY);
  if (raw) {
    try {
      data = JSON.parse(raw);
      if (!valid(data)) throw new Error("schema");
    } catch {
      readOnly = true;
      warning =
        "Saved learning data needs recovery. It has not been overwritten; export your data before making changes.";
      data = null;
    }
  }
  if (!data) {
    const quiz = parseLegacy("ayah-quiz", {}),
      mastery = parseLegacy("ayah-mastery", {}),
      completed = parseLegacy("ayah-completed", []);
    data = {
      schemaVersion: 1,
      createdAt: clock().toISOString(),
      timeZone,
      fsrs: { library: "ts-fsrs", version: "5.4.2", settings: FSRS_SETTINGS },
      wallet: {
        xp: nonnegative(quiz?.xp),
        stars: nonnegative(quiz?.stars),
        streak: nonnegative(quiz?.streak),
        legacyXP: nonnegative(quiz?.xp),
      },
      records: {},
      rewardLedger: {},
      receipts: {},
      activeReview: null,
    };
    if (mastery && typeof mastery === "object" && !Array.isArray(mastery))
      for (const [key, wins] of Object.entries(mastery)) {
        if (validKeys.has(key)) {
          data.records[key] = emptyRecord(key);
          data.records[key].game.puzzleWins = nonnegative(wins);
        }
      }
    if (Array.isArray(completed))
      for (const old of completed) {
        const key = typeof old === "number" ? `1:${old + 1}` : old;
        if (validKeys.has(key)) {
          data.records[key] ??= emptyRecord(key);
          data.records[key].game.completed = true;
        }
      }
    if (!readOnly)
      try {
        if (!safeGet(LEGACY_BACKUP_KEY))
          storage.setItem(
            LEGACY_BACKUP_KEY,
            JSON.stringify({
              savedAt: clock().toISOString(),
              keys: Object.fromEntries(
                ["ayah-mastery", "ayah-quiz", "ayah-completed"].map((key) => [
                  key,
                  safeGet(key),
                ]),
              ),
            }),
          );
        storage.setItem(LEARNING_KEY, JSON.stringify(data));
      } catch {
        readOnly = true;
        warning =
          "Learning data could not be saved. Original puzzle progress is unchanged. Check available browser storage.";
      }
  }
  function fresh() {
    const latest = safeGet(LEARNING_KEY);
    if (latest)
      try {
        const parsed = JSON.parse(latest);
        if (valid(parsed)) data = parsed;
        else {
          readOnly = true;
          warning =
            "Learning data has changed to an unsupported format. It will not be overwritten.";
        }
      } catch {
        readOnly = true;
        warning =
          "Learning data could not be read and will not be overwritten.";
      }
  }
  function mirror() {
    try {
      const quiz = parseLegacy("ayah-quiz", {});
      storage.setItem("ayah-quiz", JSON.stringify({ ...quiz, ...data.wallet }));
      const legacy = parseLegacy("ayah-mastery", {});
      storage.setItem(
        "ayah-mastery",
        JSON.stringify({
          ...legacy,
          ...Object.fromEntries(
            Object.values(data.records).map((r) => [r.key, r.game.puzzleWins]),
          ),
        }),
      );
      const completed = parseLegacy("ayah-completed", []);
      const keys = new Set(
        Array.isArray(completed)
          ? completed.map((k) => (typeof k === "number" ? `1:${k + 1}` : k))
          : [],
      );
      for (const r of Object.values(data.records))
        if (r.game.completed) keys.add(r.key);
      storage.setItem("ayah-completed", JSON.stringify([...keys]));
    } catch {
      warning =
        "Learning progress was saved, but legacy progress mirrors could not be refreshed.";
    }
  }
  function transact(fn) {
    fresh();
    if (readOnly) throw new Error(warning);
    const next = clone(data);
    const result = fn(next);
    try {
      storage.setItem(LEARNING_KEY, JSON.stringify(next));
    } catch {
      warning =
        "Browser storage is full or unavailable. This change was not saved. Export existing progress and free space before retrying.";
      throw new Error(warning);
    }
    data = next;
    if (warning.startsWith("Browser storage is full or unavailable."))
      warning = "";
    mirror();
    return result;
  }
  const record = (state, key) => {
    if (!validKeys.has(key)) throw new Error("Unknown ayah");
    return (state.records[key] ??= emptyRecord(key));
  };
  const nowDate = (input) => new Date(input || clock());
  function reward(state, bucket, potential) {
    const prior = state.rewardLedger[bucket] || { xp: 0, stars: 0 };
    const awarded = {
      xp: Math.max(0, potential.xp - prior.xp),
      stars: Math.max(0, potential.stars - prior.stars),
    };
    state.rewardLedger[bucket] = {
      xp: Math.max(prior.xp, potential.xp),
      stars: Math.max(prior.stars, potential.stars),
    };
    state.wallet.xp += awarded.xp;
    state.wallet.stars += awarded.stars;
    return awarded;
  }
  return {
    get warning() {
      return warning;
    },
    get readOnly() {
      return readOnly;
    },
    snapshot() {
      fresh();
      return clone(data);
    },
    getRecord(key) {
      fresh();
      return clone(data.records[key] || emptyRecord(key));
    },
    markPuzzleComplete(key) {
      return transact((state) => {
        record(state, key).game.completed = true;
      });
    },
    recordPuzzle({
      key,
      sessionId,
      level,
      attempts = 0,
      hinted = false,
      potential,
      now,
    }) {
      return transact((state) => {
        if (
          typeof sessionId !== "string" ||
          !sessionId ||
          ![1, 2, 3].includes(level) ||
          !Number.isInteger(attempts) ||
          attempts < 0 ||
          !potential ||
          !Number.isFinite(potential.xp) ||
          potential.xp < 0 ||
          potential.xp > 35 ||
          !Number.isFinite(potential.stars) ||
          potential.stars < 0 ||
          potential.stars > 3
        )
          throw new Error("Invalid puzzle result");
        if (Object.hasOwn(state.receipts, sessionId))
          return { ...state.receipts[sessionId], duplicate: true };
        const date = nowDate(now),
          r = record(state, key);
        r.game.completed = true;
        r.game.mistakes += attempts;
        r.game.hintUses += hinted ? 1 : 0;
        if (!hinted) r.game.puzzleWins++;
        const bucket = `puzzle:${key}:${dayKey(date, state.timeZone)}:${level}`;
        const uses = state.rewardLedger[bucket]?.uses || 0;
        const credit = uses < 2 ? potential : { xp: 0, stars: 0 };
        state.rewardLedger[bucket] = { uses: uses + 1 };
        state.wallet.xp += credit.xp;
        state.wallet.stars += credit.stars;
        r.game.puzzleXP += credit.xp;
        r.game.puzzleStars += credit.stars;
        if (!hinted && attempts === 0) state.wallet.streak++;
        const result = {
          xp: credit.xp,
          stars: credit.stars,
          capped: uses >= 2,
        };
        r.game.history.push({
          sessionId,
          at: date.toISOString(),
          level,
          hinted,
          mistakes: attempts,
          ...result,
        });
        state.receipts[sessionId] = result;
        return result;
      });
    },
    recordLabPuzzle({
      key,
      sessionId,
      game,
      mistakes = 0,
      hinted = false,
      now,
    }) {
      return transact((state) => {
        if (
          ![
            "falling",
            "vanishing",
            "jigsaw",
            "match",
            "chain",
            "continue",
            "detective",
            ...arcadeIds,
          ].includes(game) ||
          typeof sessionId !== "string" ||
          !sessionId ||
          !Number.isInteger(mistakes) ||
          mistakes < 0
        )
          throw new Error("Invalid Puzzle Lab result");
        if (Object.hasOwn(state.receipts, sessionId))
          return { ...state.receipts[sessionId], duplicate: true };
        const date = nowDate(now),
          r = record(state, key);
        const awarded = reward(
          state,
          `lab:${key}:${game}:${dayKey(date, state.timeZone)}`,
          { xp: hinted ? 2 : 8, stars: 0 },
        );
        r.game.puzzleXP += awarded.xp;
        r.game.history.push({
          sessionId,
          at: date.toISOString(),
          game,
          lab: true,
          mistakes,
          hinted,
          ...awarded,
        });
        state.receipts[sessionId] = awarded;
        return clone(awarded);
      });
    },
    beginRecall(key, now) {
      return transact((state) => {
        const date = nowDate(now),
          r = record(state, key);
        state.activeReview = {
          id: id(),
          key,
          startedAt: date.toISOString(),
          declaredRecited: false,
          comparisonRevealed: false,
          usedHint: false,
          audioBeforeRecall: false,
          graded: false,
          wasDue:
            !!r.memory.nextReview && new Date(r.memory.nextReview) <= date,
        };
        return clone(state.activeReview);
      });
    },
    updateRecall(attemptId, action) {
      return transact((state) => {
        const a = state.activeReview;
        if (!a || a.id !== attemptId || a.graded)
          throw new Error(
            "This recall attempt has finished or changed. Start a new attempt.",
          );
        if (action === "compare") {
          a.declaredRecited = true;
          a.comparisonRevealed = true;
        } else if (action === "hint") {
          a.usedHint = true;
          a.comparisonRevealed = true;
        } else if (action === "audio") {
          if (!a.declaredRecited) a.audioBeforeRecall = true;
        } else if (action === "assisted") a.usedHint = true;
        else throw new Error("Unknown recall action");
        return clone(a);
      });
    },
    gradeRecall(attemptId, grade, now) {
      return transact((state) => {
        const a = state.activeReview;
        if (!a || a.id !== attemptId)
          throw new Error(
            "This assessment is no longer active. Start a fresh assessment.",
          );
        if (a.graded) return { ...a.result, duplicate: true };
        if (!a.comparisonRevealed)
          throw new Error("Compare with the verified text before grading.");
        if (!["Again", "Hard", "Good", "Easy"].includes(grade))
          throw new Error("Choose a valid recall grade.");
        const date = nowDate(now),
          r = record(state, a.key),
          m = r.memory,
          independent =
            a.declaredRecited && !a.usedHint && !a.audioBeforeRecall;
        const wasDue = !!m.nextReview && new Date(m.nextReview) <= date;
        const scheduleEligible =
          independent &&
          (!m.card || new Date(m.card.due) <= date || grade === "Again");
        const day = dayKey(date, state.timeZone);
        let fsrsLog = null;
        if (independent) {
          m.independentAttempts++;
          if (grade === "Again") {
            m.mistakes++;
            if (scheduleEligible && m.successfulDays.length) m.lapses++;
          }
        } else m.assistedAttempts++;
        if (scheduleEligible) {
          const result = scheduler.next(
            restoreCard(m.card, date),
            date,
            Rating[grade],
          );
          m.card = clone(result.card);
          fsrsLog = clone(result.log);
          m.practiceDue = null;
          if (grade !== "Again" && !m.successfulDays.includes(day))
            m.successfulDays.push(day);
        } else if (independent) {
          m.practiceDue = null;
        } else if (!independent) {
          m.practiceDue = new Date(
            date.getTime() + 10 * 60 * 1000,
          ).toISOString();
        }
        m.nextReview = dueAt(m);
        recomputeStage(m);
        const potential = !independent
          ? { xp: 5, stars: 1 }
          : !scheduleEligible
            ? { xp: 0, stars: 0 }
            : grade === "Again"
              ? { xp: wasDue ? 10 : 5, stars: 0 }
              : { xp: wasDue ? 60 : 40, stars: wasDue ? 4 : 3 };
        const awarded = reward(
          state,
          `${independent ? "recall" : "study"}:${a.key}:${day}`,
          potential,
        );
        const history = {
          attemptId,
          at: date.toISOString(),
          startedAt: a.startedAt,
          day,
          grade,
          independent,
          usedHint: a.usedHint,
          audioBeforeRecall: a.audioBeforeRecall,
          comparisonRevealed: a.comparisonRevealed,
          wasDue,
          scheduleUpdated: scheduleEligible,
          earlyPractice: independent && !scheduleEligible,
          nextReview: m.nextReview,
          fsrsLog,
          reward: awarded,
        };
        m.history.push(history);
        a.graded = true;
        a.result = { ...history, stage: m.stage };
        state.receipts[attemptId] = awarded;
        return clone(a.result);
      });
    },
    daily(now) {
      fresh();
      const date = nowDate(now),
        day = dayKey(date, data.timeZone);
      const records = Object.values(data.records);
      const dueToday = records
        .filter(
          (r) =>
            r.memory.nextReview &&
            dayKey(r.memory.nextReview, data.timeZone) <= day,
        )
        .sort((a, b) => a.memory.nextReview.localeCompare(b.memory.nextReview));
      const dueNow = dueToday.filter(
        (r) => new Date(r.memory.nextReview) <= date,
      );
      const weak = records.filter(
        (r) =>
          r.memory.history.at(-1)?.grade === "Again" ||
          r.memory.history.at(-1)?.independent === false,
      );
      const suggested = [...validKeys]
        .filter(
          (key) =>
            !data.records[key]?.memory.card &&
            !data.records[key]?.memory.nextReview,
        )
        .sort(
          (a, b) =>
            Number(!!data.records[b]?.game.completed) -
            Number(!!data.records[a]?.game.completed),
        )
        .slice(0, 3);
      return {
        dueToday: clone(dueToday),
        dueNow: clone(dueNow),
        upcoming: clone(
          records
            .filter(
              (r) =>
                r.memory.nextReview && new Date(r.memory.nextReview) > date,
            )
            .sort((a, b) =>
              a.memory.nextReview.localeCompare(b.memory.nextReview),
            ),
        ),
        weak: clone(weak),
        suggested,
        puzzleCompleted: records.filter((r) => r.game.completed).length,
        retained: records.filter((r) => r.memory.stage === "retained").length,
        reviewedToday: records.filter((r) =>
          r.memory.successfulDays.includes(day),
        ).length,
      };
    },
    exportData() {
      fresh();
      return JSON.stringify(
        {
          learning: data,
          rawCanonical: safeGet(LEARNING_KEY),
          legacyBackup: safeGet(LEGACY_BACKUP_KEY),
        },
        null,
        2,
      );
    },
  };
}
