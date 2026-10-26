import { dayKey } from "../learning-store.js";
import { readGoals } from "../learner/insights.js";
import { validMemory } from "../passage/memory.js";
import {
  availability,
  reference,
} from "../../supabase/functions/_shared/content-policy.js";
import {
  buildPlan,
  DEFAULT_ADVICE,
} from "../../supabase/functions/_shared/coach-core.js";
export const COACH_SETTINGS = "ayah-coach-settings-v1";
export function coachSnapshot(
  learning,
  storage,
  surahs,
  settings = {},
  now = new Date(),
) {
  const state = learning.snapshot(),
    goals = readGoals(storage),
    zone = state.timeZone || "UTC",
    today = dayKey(now, zone);
  const dates = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(Date.parse(`${today}T12:00:00Z`) + i * 86400000).toISOString()
        .slice(0, 10),
  );
  const all = surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
    valid = new Set(all),
    units = [],
    warnings = [];
  let inconsistent = false;
  const add = (id, refs, memory, passage = false) => {
    const history = memory.history || [],
      recent = history.filter((h) =>
        Number.isFinite(Date.parse(h.at)) && Date.parse(h.at) <= now &&
        Date.parse(h.at) >= now - 14 * 86400000
      );
    if (
      history.some((h) =>
        !Number.isFinite(Date.parse(h.at)) || Date.parse(h.at) > now ||
        !["Again", "Hard", "Good", "Easy"].includes(h.grade)
      )
    ) inconsistent = true;
    const failures = recent.filter((h) => h.grade === "Again").length;
    const due = memory.nextReview || memory.card?.due || null;
    if (due && !Number.isFinite(Date.parse(due))) inconsistent = true;
    const when = due && Number.isFinite(Date.parse(due))
      ? dayKey(due, zone)
      : null;
    units.push({
      id,
      refs,
      passage,
      due: when,
      weak: history.at(-1)?.grade === "Again" ||
        history.at(-1)?.independent === false,
      repeated: failures >= 2,
      failures,
      retained: memory.stage === "retained" ||
        passage && (memory.successfulDays || []).length >= 3 &&
          memory.card?.state === 2,
      independent: recent.filter((h) => h.independent === true).length,
      assisted: recent.filter((h) => h.independent === false).length,
    });
  };
  for (const [key, r] of Object.entries(state.records || {})) {
    if (!valid.has(key) || !r.memory) {
      inconsistent = true;
      continue;
    }
    if (r.memory.card || r.memory.history?.length || r.memory.nextReview) {
      add(`ayah:${key}`, [key], r.memory);
    }
  }
  try {
    const raw = storage.getItem("ayah-passage-recall-v1");
    if (raw) {
      const p = JSON.parse(raw);
      if (!validMemory(p)) throw Error();
      for (const [id, r] of Object.entries(p.records)) {
        try {
          r.unit.refs.forEach(reference);
        } catch {
          inconsistent = true;
          continue;
        }
        if (r.unit.type === "ayah" && units.some((u) => u.id === id)) {
          warnings.push(
            "Overlapping ayah records exist in both review systems; they are counted as separate recall units and both schedules are preserved.",
          );
        }
        if (r.card || r.history.length) {
          add(
            `studio:${id}`,
            r.unit.refs,
            { ...r, nextReview: r.card?.due },
            true,
          );
          units.at(-1).unit = r.unit;
        }
      }
    }
  } catch {
    inconsistent = true;
    warnings.push("Passage history needs recovery; it was not changed.");
  }
  let lab = {};
  try {
    const v = JSON.parse(storage.getItem("ayah-puzzle-lab-v1"));
    if (v) {
      if (v.schemaVersion !== 1 || !v.weaknesses) throw Error();
      lab = v.weaknesses;
    }
  } catch {
    inconsistent = true;
    warnings.push("Puzzle Lab history could not be interpreted.");
  }
  const transitionKeys = Object.entries(lab).filter(([k, v]) =>
    valid.has(k) && Number.isFinite(v.transitions) && v.transitions > 0
  ).map(([k]) => k);
  const transitionUnits = units.filter((u) =>
    u.passage && u.refs.length > 1 && (u.weak || u.repeated)
  );
  const transitions = transitionKeys.length + transitionUnits.length;
  const due = units.filter((u) => u.due && u.due <= today).sort((a, b) =>
    a.due.localeCompare(b.due)
  );
  const weak = units.filter((u) => u.weak || u.repeated).sort((a, b) =>
    b.failures - a.failures
  );
  const recentMistakes = Object.values(state.records || {}).reduce(
    (n, r) =>
      n +
      (r.game?.history || []).filter((h) =>
        Date.parse(h.at) >= now - 14 * 86400000 && Date.parse(h.at) <= now
      ).reduce(
        (x, h) =>
          x + (Number.isInteger(h.mistakes) && h.mistakes > 0 ? h.mistakes : 0),
        0,
      ),
    0,
  );
  const targets = goals?.targets || [], known = new Set(goals?.known || []);
  const covered = new Set(units.flatMap((u) => u.refs));
  const candidates = all.filter((k) =>
    !known.has(Number(k.split(":")[0])) &&
    !covered.has(k)
  ).sort((a, b) =>
    Number(targets.includes(Number(b.split(":")[0]))) -
    Number(targets.includes(Number(a.split(":")[0])))
  );
  const summary = {
    minutes: Math.floor(
      Math.max(
        5,
        Math.min(60, Number(settings.minutes) || goals?.minutes || 10),
      ),
    ),
    days: Math.floor(
      Math.max(1, Math.min(7, Number(settings.days) || goals?.days || 5)),
    ),
    reviewCost: Math.min(
      15,
      Math.max(
        2,
        ...units.map((u) =>
          Math.ceil(
            u.refs.reduce((n, k) => {
              const [s, a] = k.split(":").map(Number);
              return n +
                (surahs.find((c) => c.id === s)?.verses.find((v) => v.id === a)
                  ?.words.length ||
                  availability.premium.find((p) => p.key === k)?.wordCount ||
                  300);
            }, 0) / 20,
          )
        ),
      ),
    ),
    tracked: units.length +
      transitionKeys.filter((k) => !units.some((u) => u.id === `ayah:${k}`))
        .length,
    retained: units.filter((u) => u.retained).length,
    independent: Math.min(100000, units.reduce((n, u) => n + u.independent, 0)),
    assisted: Math.min(100000, units.reduce((n, u) => n + u.assisted, 0)),
    due: due.length,
    weak: weak.length,
    repeated: weak.filter((u) => u.repeated).length,
    transitions,
    recentMistakes: Math.min(100000, recentMistakes),
    newAvailable: candidates.length,
    aim: goals?.aim || "daily",
    confidence: goals?.confidence || "new",
    futureDue: dates.map((d, i) =>
      i === 0 ? due.length : units.filter((u) => u.due === d).length
    ),
    inconsistent,
  };
  const labTargets = Object.entries(state.records || {}).filter(([k, r]) =>
    valid.has(k) &&
    (r.game?.history || []).some((h) =>
      h.mistakes > 0 && Date.parse(h.at) >= now - 14 * 86400000 &&
      Date.parse(h.at) <= now
    )
  ).map(([k]) => ({ id: k, refs: [k] }));
  return {
    summary,
    units,
    due,
    weak,
    candidates,
    transitionKeys,
    transitionUnits,
    dates,
    labTargets,
    warnings: [...new Set(warnings)],
    goals,
    lab,
  };
}
export function materializePlan(snapshot, advice = DEFAULT_ADVICE) {
  const plan = buildPlan(snapshot.summary, advice);
  return {
    ...plan,
    tasks: plan.tasks.map((task) => ({
      ...task,
      game: task.type === "transitions" ? "chain" : "falling",
      targets: task.type === "review"
        ? snapshot.due.slice(0, task.count)
        : task.type === "repair"
        ? snapshot.weak.slice(0, task.count)
        : task.type === "new" || task.type === "practice"
        ? [{
          id: snapshot.candidates[0] || snapshot.units[0]?.id || "1:1",
          refs: [snapshot.candidates[0] || snapshot.units[0]?.refs[0] || "1:1"],
        }]
        : task.type === "transitions"
        ? [
          ...snapshot.transitionUnits,
          ...snapshot.transitionKeys.map((k) => ({ id: k, refs: [k] })),
        ].slice(0, task.count)
        : snapshot.labTargets.slice(0, 1),
    })),
  };
}
