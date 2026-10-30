import {
  reference,
  availableReference,
} from "../../../supabase/functions/_shared/content-policy.js";
import { dayKey } from "../../learning-store.js";
// Read-only projection. Only the existing passage store schedules/grades a review.
export function rescueMap(
  document,
  {
    now = new Date(),
    timeZone = document?.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  } = {},
) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(now);
  } catch {
    timeZone = "UTC";
  }
  const today = dayKey(now, timeZone),
    stars = [],
    unavailable = [],
    notYet = [];
  for (const record of Object.values(document?.records || {})) {
    const { unit, card, history } = record;
    const successful = history?.some(
      (h) =>
        h.independent === true && ["Hard", "Good", "Easy"].includes(h.grade),
    );
    if (!card || !successful) {
      notYet.push(unit?.id);
      continue;
    }
    let supported = true;
    try {
      supported = unit.refs.every((key) => {
        const r = reference(key);
        return key === `${r.surah}:${r.ayah}` && availableReference(key);
      });
    } catch {
      supported = false;
    }
    if (!supported) {
      unavailable.push(unit);
      continue;
    }
    const due = Date.parse(card.due);
    if (!Number.isFinite(due)) {
      unavailable.push(unit);
      continue;
    }
    const state =
      due > +new Date(now)
        ? "upcoming"
        : dayKey(new Date(due), timeZone) < today
          ? "overdue"
          : "due";
    const last = history.at(-1);
    stars.push({
      id: unit.id,
      unit: structuredClone(unit),
      due: card.due,
      state,
      latestGrade: last?.grade || null,
      needsPractice: ["Again", "Hard"].includes(last?.grade),
      independentReviews: history.filter((h) => h.independent === true).length,
      lastReviewed: last?.at || null,
    });
  }
  stars.sort((a, b) => a.id.localeCompare(b.id));
  const queue = stars
    .filter((s) => s.state !== "upcoming")
    .sort(
      (a, b) =>
        Date.parse(a.due) - Date.parse(b.due) || a.id.localeCompare(b.id),
    );
  return {
    stars,
    queue,
    unavailable,
    notYet,
    timeZone,
    today,
    counts: {
      upcoming: stars.filter((s) => s.state === "upcoming").length,
      due: stars.filter((s) => s.state === "due").length,
      overdue: stars.filter((s) => s.state === "overdue").length,
    },
  };
}
export function dailyRoute(map, { limit = 5, skip = [] } = {}) {
  const excluded = new Set(skip);
  const count = Number.isInteger(limit) ? Math.max(1, Math.min(15, limit)) : 5;
  return map.queue
    .filter((s) => !excluded.has(s.id))
    .slice(0, count)
    .map((s) => s.id);
}
export function savedReview(document, attemptId) {
  const active = document?.active;
  if (!active || !active.graded || active.id !== attemptId) return null;
  const record = document.records[active.unitId],
    history = record?.history.find((h) => h.attemptId === attemptId);
  if (!history) return null;
  return {
    id: record.unit.id,
    unit: structuredClone(record.unit),
    attempt: structuredClone(history),
    nextReview: record.card?.due || null,
  };
}
