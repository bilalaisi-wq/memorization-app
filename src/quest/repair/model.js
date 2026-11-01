import {
  reference,
  availableReference,
} from "../../../supabase/functions/_shared/content-policy.js";
export const repairCategories = Object.freeze({
  "word-selection": {
    title: "Word selection",
    game: "asteroids",
    tip: "Listen, say each word aloud, then choose the next word.",
  },
  "word-order": {
    title: "Word order",
    game: "snake",
    tip: "Connect the words slowly in canonical order; speak each connection.",
  },
  "phrase-transition": {
    title: "Phrase transitions",
    game: "maze",
    tip: "Repeat the transition aloud, then connect the surrounding words.",
  },
  "similar-passage": {
    title: "Similar-passage confusion",
    game: "maze",
    tip: "Compare the verified references in supported practice before recalling.",
  },
  assistance: {
    title: "Study assistance used",
    game: "maze",
    tip: "Assistance is welcome. Practise with support, then try an independent attempt when ready.",
  },
  "review-difficulty": {
    title: "Self-reported review difficulty",
    game: "snake",
    tip: "Listen and rebuild at a comfortable pace, then try a fresh self-assessment.",
  },
  "sequence-unspecified": {
    title: "Sequence practice",
    game: "snake",
    tip: "The old record does not identify a specific word. Rebuild slowly and repeat aloud.",
  },
});
const list = (value) => (Array.isArray(value) ? value : []);
const validRef = (key) => {
  try {
    const r = reference(key);
    return key === r.key && availableReference(key);
  } catch {
    return false;
  }
};
// Transparent read-only projection. Never writes mastery, diagnoses forgetting or estimates precision.
export function repairAnalysis({ lab = {}, memory = {} } = {}) {
  const groups = new Map(),
    seen = new Set();
  const add = (key, category, e) => {
    if (!validRef(key) || !repairCategories[category]) return;
    const token = `${key}|${category}|${e.id}`;
    if (seen.has(token)) return;
    seen.add(token);
    const id = `${key}|${category}`;
    if (!groups.has(id))
      groups.set(id, {
        id,
        key,
        category,
        ...repairCategories[category],
        evidence: [],
      });
    groups.get(id).evidence.push(e);
  };
  for (const h of list(lab.history)) {
    if (!h || typeof h !== "object") continue;
    if (!validRef(h.key) || typeof h.sessionId !== "string") continue;
    const base = { record: h.sessionId, at: h.at || null, game: h.game };
    const events = list(h.arcade?.mistakes).filter(
      (m) => m && typeof m === "object",
    );
    if (Array.isArray(events) && events.length)
      events.forEach((m, i) => {
        const precise =
          ["word-selection", "word-order", "phrase-transition"].includes(
            m.category,
          ) &&
          Array.isArray(m.expected) &&
          Array.isArray(m.selected) &&
          [m.expected, m.selected].every(
            (xs) =>
              xs.length > 0 &&
              xs.length <= 12 &&
              xs.every(
                (id) => typeof id === "string" && /^\d+:\d+:\d+$/.test(id),
              ),
          );
        add(h.key, precise ? m.category : "sequence-unspecified", {
          ...base,
          id: `${h.sessionId}:mistake:${m.event ?? i}`,
          source: "observed-arcade",
          detail: precise
            ? "Recorded selection at a sequence decision."
            : "Sequence mistake; exact cause was not recorded.",
          ...(precise ? { expected: m.expected, selected: m.selected } : {}),
        });
      });
    else if (h.mistakes > 0)
      add(
        h.key,
        h.game === "detective" ? "similar-passage" : "sequence-unspecified",
        {
          ...base,
          id: `${h.sessionId}:aggregate`,
          source: "observed-arcade",
          detail:
            h.game === "detective"
              ? `${h.mistakes} mistake(s) during Similar Ayah Detective. Task-level signal only; conflicting reference and exact cause were not recorded.`
              : `${h.mistakes} recorded practice mistake(s); exact words and cause unavailable.`,
        },
      );
    if (h.hinted === true || list(h.arcade?.assistance).length)
      add(h.key, "assistance", {
        ...base,
        id: `${h.sessionId}:assistance`,
        source: "study-assistance",
        detail:
          "Audio, hints or reference support used. This does not prove dependence.",
      });
  }
  for (const record of Object.values(memory.records || {})) {
    const unit = record?.unit;
    if (!unit?.refs?.length) continue;
    // Most recent five attempts, not an invented weakness score or a forgetting estimate.
    for (const h of list(record.history).slice(-5)) {
      if (!h || typeof h.attemptId !== "string") continue;
      for (const key of unit.refs) {
        const base = {
          id: `${h.attemptId}:${unit.id}`,
          record: h.attemptId,
          unitId: unit.id,
          unit,
          at: h.at || null,
          independent: h.independent === true,
          scheduled: h.scheduled === true,
        };
        if (["Again", "Hard"].includes(h.grade))
          add(key, "review-difficulty", {
            ...base,
            source: "self-reported-recall",
            detail: `Learner graded ${h.grade}; ${h.independent ? "independent attempt" : "assisted/undeclared attempt"}. Not teacher-verified.`,
            grade: h.grade,
          });
        if (h.independent === false)
          add(key, "assistance", {
            ...base,
            source: "self-reported-recall",
            detail:
              "Attempt was not recorded as independent; assistance type may be unknown.",
          });
      }
    }
  }
  const recommendations = [...groups.values()].sort(
    (a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true }) ||
      a.category.localeCompare(b.category),
  );
  return {
    recommendations,
    diagnostics: {
      motorEvents: list(lab.history)
        .filter((h) => h && typeof h.sessionId === "string")
        .flatMap((h) =>
          list(h.arcade?.motorErrors)
            .filter((e) => e && typeof e === "object")
            .map((e, i) => ({
              source: "motor-control",
              record: h.sessionId,
              key: h.key,
              id: `${h.sessionId}:${e.event ?? i}`,
            })),
        ),
      independentGrades: [],
      audioInferences: [],
    },
    limitations: [
      "Independent attempts use learner self-grades, not externally verified recitation.",
      "Motor events are excluded from memory recommendations.",
      "No audio/transcription inference is used.",
      "Similar-passage confusion and assistance dependence cannot be established from aggregate mistakes alone.",
    ],
  };
}
export function chooseRepairGame(recommendation, entries = []) {
  const available = entries.filter(
    (g) =>
      g.status !== "planned" && ["maze", "snake", "asteroids"].includes(g.id),
  );
  return (
    available.find((g) => g.id === recommendation.game)?.id ||
    available[0]?.id ||
    null
  );
}
