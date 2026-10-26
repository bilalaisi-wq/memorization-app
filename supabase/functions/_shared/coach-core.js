// Shared rules, not a scheduler. No Quran text or generated religious explanation.
export const COACH_VERSION = "hifz-plan-v1";
export const COACH_MODEL = "gpt-4o-mini";
export const COACH_CONSENT = "adult-aggregate-coach-v1";
const numeric = [
  "minutes",
  "days",
  "reviewCost",
  "tracked",
  "retained",
  "independent",
  "assisted",
  "due",
  "weak",
  "repeated",
  "transitions",
  "recentMistakes",
  "newAvailable",
];
export function validateSummary(input) {
  if (
    !input ||
    Object.keys(input).sort().join() !==
      [...numeric, "aim", "confidence", "futureDue", "inconsistent"].sort()
        .join()
  ) throw Error("Invalid summary fields");
  for (const key of numeric) {
    if (
      !Number.isInteger(input[key]) || input[key] < 0 || input[key] > 100000
    ) throw Error("Invalid summary count");
  }
  if (
    input.reviewCost < 2 || input.reviewCost > 15 || input.minutes < 5 ||
    input.minutes > 60 || input.days < 1 || input.days > 7 ||
    input.tracked > 100000 || input.retained > input.tracked ||
    input.weak > input.tracked || input.repeated > input.weak ||
    input.due > input.tracked || input.transitions > input.tracked ||
    input.newAvailable > 6236 ||
    !["daily", "surahs", "review"].includes(input.aim) ||
    !["new", "shaky", "ready"].includes(input.confidence) ||
    typeof input.inconsistent !== "boolean" ||
    !Array.isArray(input.futureDue) || input.futureDue.length !== 7 ||
    input.futureDue.some((n) =>
      !Number.isInteger(n) || n < 0 || n > input.tracked
    ) || input.futureDue[0] !== input.due
  ) throw Error("Inconsistent learning summary");
  return Object.fromEntries(
    [...numeric, "aim", "confidence", "futureDue", "inconsistent"].map(
      (k) => [k, input[k]],
    ),
  );
}
export const DEFAULT_ADVICE = Object.freeze({
  focus: "steady",
  newCap: 1,
  goalAdvice: "maintain",
  breakStyle: "short",
});
export function validateAdvice(value) {
  if (
    !value ||
    Object.keys(value).sort().join() !== "breakStyle,focus,goalAdvice,newCap" ||
    !["steady", "weak", "transitions"].includes(value.focus) ||
    !Number.isInteger(value.newCap) || value.newCap < 0 || value.newCap > 2 ||
    !["maintain", "reduce"].includes(value.goalAdvice) ||
    !["short", "spaced"].includes(value.breakStyle)
  ) throw Error("Unsupported coach response");
  return value;
}
export function buildPlan(input, suggestion = DEFAULT_ADVICE) {
  const s = validateSummary(input), advice = validateAdvice(suggestion);
  const tasks = [];
  let left = s.minutes;
  const add = (type, count, cost, reason) => {
    count = Math.min(count, Math.floor(left / cost));
    if (count > 0) {
      tasks.push({ type, count, minutes: count * cost, reason });
      left -= count * cost;
    }
    return count;
  };
  const reviewCost = Math.min(s.minutes, s.reviewCost),
    capacity = Math.floor(s.minutes / reviewCost),
    overloaded = s.due >= capacity;
  const reviews = add(
    "review",
    s.due,
    reviewCost,
    `FSRS dates indicate these recall units are due. Each has a ${reviewCost}-minute study budget; long units may need another session. Grade whole-unit recall only after completing it.`,
  );
  if (s.weak && left >= 3) {
    add(
      "repair",
      advice.focus === "weak" ? Math.min(2, s.weak) : 1,
      3,
      s.repeated
        ? "Recent repeated Again assessments suggest assisted repair after retrieval."
        : "Recent self-assessments indicate memory needs support.",
    );
  }
  if (
    left >= 3 && s.transitions && (advice.focus === "transitions" || !s.weak)
  ) {
    add(
      "transitions",
      1,
      3,
      "Recorded passage/transition difficulties suggest practicing connections.",
    );
  }
  if (
    left >= 3 && (s.recentMistakes || s.confidence === "shaky") &&
    !tasks.some((t) => t.type === "repair")
  ) {
    add(
      "lab",
      1,
      3,
      "Use a corrective Puzzle Lab challenge, then return to spoken recall.",
    );
  }
  const newLimit =
    overloaded || s.aim === "review" || s.inconsistent || s.repeated > 0 ||
      advice.goalAdvice === "reduce"
      ? 0
      : Math.min(1, advice.newCap, s.newAvailable);
  if (newLimit) {
    add(
      "new",
      newLimit,
      4,
      "Start one source-available ayah with listening, speaking and puzzle practice. New study is not a memorization result.",
    );
  }
  if (!tasks.length) {
    add(
      "practice",
      1,
      3,
      s.tracked
        ? "No due retrieval was identified. Choose gentle practice or rest."
        : "No recorded memorization evidence yet. Begin with a small verified ayah; self-reported knowledge is not mastery.",
    );
  }
  const weekly = [];
  let backlog = 0;
  for (let i = 0; i < 7; i++) {
    backlog += s.futureDue[i];
    const study = i < s.days;
    const reviewUnits = study ? Math.min(backlog, capacity) : 0;
    backlog -= reviewUnits;
    weekly.push({
      offset: i,
      study,
      reviewUnits,
      backlog,
      newUnits:
        study && backlog === 0 && reviewUnits * reviewCost + 4 <= s.minutes &&
          newLimit
          ? 1
          : 0,
      minutes: study
        ? Math.min(
          s.minutes,
          reviewUnits * reviewCost + (backlog === 0 && newLimit ? 4 : 0),
        )
        : 0,
    });
  }
  return {
    version: COACH_VERSION,
    tasks,
    minutes: tasks.reduce((n, t) => n + t.minutes, 0),
    unallocatedMinutes: left,
    remainingDue: s.due - reviews,
    weekly,
    goalAdvice: overloaded || s.repeated || s.inconsistent
      ? "reduce"
      : advice.goalAdvice,
    focus: advice.focus,
    breakStyle: advice.breakStyle,
    explanations: [
      `${s.due} due recall units; ${s.retained} units labeled retained in recorded self-assessment history. These are not independently verified recitations.`,
      s.inconsistent
        ? "Some history could not be interpreted. Recommendations are conservative; original records are untouched."
        : "Planning uses recorded results, not claimed achievements.",
      overloaded
        ? "Your estimated due workload exceeds this session. Pause new work and spread reviews across sessions without moving FSRS dates."
        : "Keep review before new work; practice duration estimates can be adjusted by changing your time budget.",
      "Weekly figures use currently known due dates and a suggested first-days study pattern. Future grades create new dates; this is not a forecast of future mastery.",
    ],
  };
}
