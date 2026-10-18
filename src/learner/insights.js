import { dayKey } from "../learning-store.js";
export const GOALS_KEY = "ayah-goals-v1",
  ACTIVITY_KEY = "ayah-activity-v1";
export function readGoals(storage) {
  try {
    const saved = JSON.parse(storage.getItem(GOALS_KEY));
    return saved?.version === 1 &&
      ["daily", "surahs", "review"].includes(saved.aim) &&
      Number.isFinite(saved.minutes) &&
      saved.minutes >= 5 &&
      saved.minutes <= 30 &&
      Number.isInteger(saved.days) &&
      saved.days >= 1 &&
      saved.days <= 7 &&
      Array.isArray(saved.targets) &&
      saved.targets.every(Number.isInteger) &&
      Array.isArray(saved.known) &&
      saved.known.every(Number.isInteger) &&
      ["new", "shaky", "ready"].includes(saved.confidence)
      ? saved
      : null;
  } catch {
    return null;
  }
}
export function saveGoals(storage, goals, surahs) {
  const valid = new Set(surahs.map((s) => s.id));
  const record = {
    version: 1,
    aim: ["daily", "surahs", "review"].includes(goals.aim)
      ? goals.aim
      : "daily",
    minutes: Math.max(5, Math.min(30, Number(goals.minutes) || 10)),
    days: Math.max(1, Math.min(7, Number(goals.days) || 5)),
    targets: [...new Set(goals.targets.map(Number))].filter((id) =>
      valid.has(id),
    ),
    known: [...new Set(goals.known.map(Number))].filter((id) => valid.has(id)),
    confidence: ["new", "shaky", "ready"].includes(goals.confidence)
      ? goals.confidence
      : "new",
  };
  storage.setItem(GOALS_KEY, JSON.stringify(record));
  return record;
}
export function trackStudy(
  storage,
  key,
  mode,
  now = new Date(),
  timeZone = "UTC",
) {
  // Only explicit learning interactions count; opening the page is not activity.
  let saved;
  try {
    saved = JSON.parse(
      storage.getItem(ACTIVITY_KEY) || '{"version":1,"days":{}}',
    );
  } catch {
    throw new Error(
      "Activity history needs recovery; it has not been overwritten.",
    );
  }
  if (saved?.version !== 1 || !saved.days || Array.isArray(saved.days))
    throw new Error(
      "Activity history needs recovery; it has not been overwritten.",
    );
  const day = dayKey(now, timeZone),
    record = saved.days[day] || { sessions: [], ayahs: [], modes: [] };
  // One study session per ayah/mode/day, regardless of clicks or repeats.
  const id = `${key}:${mode}`;
  if (!record.sessions.includes(id)) record.sessions.push(id);
  if (!record.ayahs.includes(key)) record.ayahs.push(key);
  if (!record.modes.includes(mode)) record.modes.push(mode);
  saved.days[day] = record;
  storage.setItem(ACTIVITY_KEY, JSON.stringify(saved));
}
const previous = (day) =>
  new Date(Date.parse(`${day}T12:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
export function summarizeActivity(state, storage, now = new Date()) {
  const days = {};
  const add = (day, type, key, xp = 0, stars = 0) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const item = (days[day] ||= {
      study: 0,
      puzzles: 0,
      recalls: 0,
      independent: 0,
      xp: 0,
      stars: 0,
      ayahs: new Set(),
    });
    item[type]++;
    item.ayahs.add(key);
    item.xp += xp;
    item.stars += stars;
  };
  try {
    const log = JSON.parse(storage.getItem(ACTIVITY_KEY));
    for (const [day, entry] of Object.entries(log?.days || {}))
      for (const key of entry.ayahs || []) add(day, "study", key);
  } catch {}
  for (const [key, r] of Object.entries(state.records)) {
    for (const h of r.game.history || [])
      if (h.at)
        add(
          dayKey(h.at, state.timeZone),
          "puzzles",
          key,
          h.xp || 0,
          h.stars || 0,
        );
    for (const h of r.memory.history || [])
      if (h.at) {
        const d = dayKey(h.at, state.timeZone);
        add(d, "recalls", key, h.reward?.xp || 0, h.reward?.stars || 0);
        if (h.independent) days[d].independent++;
      }
  }
  const today = dayKey(now, state.timeZone),
    active = Object.keys(days)
      .filter((d) => d <= today)
      .sort();
  let current = 0,
    cursor = days[today] ? today : previous(today);
  while (days[cursor]) {
    current++;
    cursor = previous(cursor);
  }
  let best = 0,
    run = 0,
    last = null;
  for (const d of active) {
    run = last === previous(d) ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return {
    today,
    current,
    best,
    days: Object.fromEntries(
      Object.entries(days).map(([d, item]) => [
        d,
        { ...item, ayahs: [...item.ayahs] },
      ]),
    ),
  };
}
export function nextStep(state, daily, goals, surahs) {
  const targets = goals?.targets?.length
    ? goals.targets
    : surahs.map((s) => s.id);
  const due = daily.dueNow[0];
  if (due)
    return {
      key: due.key,
      mode: "review",
      title: "Retrieve a due ayah first",
      reason:
        "Recite before looking. Record yourself if useful, compare afterward, then self-grade to schedule the next review.",
    };
  const keys = surahs
    .filter((s) => targets.includes(s.id))
    .flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`));
  const key =
    keys.find((k) => state.records[k]?.memory.stage !== "retained") ||
    daily.suggested[0] ||
    keys[0];
  const r = state.records[key],
    known = goals?.known?.includes(Number(key?.split(":")[0]));
  if (goals?.aim === "review" || known || goals?.confidence === "ready")
    return {
      key,
      mode: "review",
      title: "Try self-assessed spoken recall",
      reason:
        "You feel ready. Recite without text first, optionally record, then compare. Confidence is a starting point, not proof of retention.",
    };
  if (r?.memory.history?.at(-1)?.grade === "Again")
    return {
      key,
      mode: "practice",
      title: "Rebuild a small phrase",
      reason:
        "Listen, repeat each word aloud as you move it, and join two or three words before adding more. Return to recall after study.",
    };
  if (goals?.confidence === "shaky" || r?.game.completed || r?.game.puzzleWins)
    return {
      key,
      mode: "quiz",
      title: "Strengthen word order in Puzzle Quest",
      reason:
        "Say each word as you place it. Start at your unlocked level; two fresh, unassisted wins unlock fewer cues. Then try spoken recall.",
    };
  return {
    key,
    mode: "practice",
    title: "Start small in Practice",
    reason:
      "Listen to a word, repeat after the reciter, and say it as you move its piece. Build a short phrase; when comfortable, try Puzzle Quest and spoken recall.",
  };
}
export function achievements(state, surahs, activity) {
  const records = Object.values(state.records),
    recalled = records.filter((r) =>
      r.memory.history?.some((h) => h.independent),
    ).length;
  const retained = records.filter((r) => r.memory.stage === "retained").length;
  const full = surahs.filter((s) =>
    s.verses.every(
      (v) => state.records[`${s.id}:${v.id}`]?.memory.stage === "retained",
    ),
  );
  return [
    {
      id: "first-step",
      icon: "footstep",
      title: "First steps",
      value: records.filter((r) => r.game.completed).length,
      target: 1,
      detail: "Complete your first practice puzzle.",
    },
    {
      id: "voice",
      icon: "voice",
      title: "Recall explorer",
      value: recalled,
      target: 1,
      detail:
        "Complete an independent self-assessed spoken recall. Recording is optional.",
    },
    {
      id: "retained",
      icon: "sprout",
      title: "Growing memory",
      value: retained,
      target: 1,
      detail:
        "Reach retained through independent reviews across distinct days.",
    },
    {
      id: "surah",
      icon: "surah",
      title: "First retained surah",
      value: full.length,
      target: 1,
      detail:
        "Every ayah in one surah reaches retained through spaced, self-assessed recall.",
    },
    {
      id: "week",
      icon: "flame",
      title: "A week of practice",
      value: activity.best,
      target: 7,
      detail:
        "Practice on seven consecutive days. Breaks never remove earned achievements.",
    },
    {
      id: "ten",
      icon: "stars",
      title: "Ten ayahs growing",
      value: retained,
      target: 10,
      detail: "Build retained memory for ten ayahs; keep reviewing them.",
    },
  ];
}

export function preserveAchievements(storage, awards, now = new Date()) {
  let ledger;
  try {
    const raw = storage.getItem("ayah-achievements-v1");
    ledger = raw ? JSON.parse(raw) : { version: 1, awards: {} };
  } catch {
    return awards;
  }
  if (ledger?.version !== 1 || !ledger.awards || Array.isArray(ledger.awards))
    return awards;
  let changed = false;
  const result = awards.map((award) => {
    const previous = ledger.awards[award.id];
    const value = Math.max(award.value, Number(previous?.value) || 0);
    const earnedAt =
      previous?.earnedAt || (value >= award.target ? now.toISOString() : null);
    if (previous?.value !== value || previous?.earnedAt !== earnedAt) {
      ledger.awards[award.id] = { value, earnedAt };
      changed = true;
    }
    return { ...award, value, earnedAt };
  });
  if (changed)
    try {
      storage.setItem("ayah-achievements-v1", JSON.stringify(ledger));
    } catch {}
  return result;
}
