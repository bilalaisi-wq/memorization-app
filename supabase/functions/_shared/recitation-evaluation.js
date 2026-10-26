import {
  compareTranscript,
  COMPARISON_VERSION,
  MODEL,
  providerQuality,
} from "./recitation-core.js";
export const REQUIRED_CONDITIONS = [
  "clean",
  "background_noise",
  "different_microphones",
  "accents",
  "pauses",
  "repeated_words",
  "intentional_omissions",
  "incorrect_recitation",
];
export function evaluateCases(cases) {
  const total = {
    recordings: 0,
    assessed: 0,
    abstained: 0,
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
    unassessedTeacherErrors: 0,
  };
  const conditions = {};
  for (const c of cases) {
    if (
      !c.reviewer?.name || !c.reviewer?.credentials ||
      !Number.isFinite(Date.parse(c.reviewer.reviewedAt)) ||
      c.adultConsentReviewed !== true ||
      !/^[a-f0-9]{64}$/i.test(c.audioSha256) || c.provider.model !== MODEL
    ) {
      throw Error(
        "Teacher-reviewed adult evidence, audio hash and matching model are required.",
      );
    }
    const slots = new Set([
      ...c.words.map((_, i) => `word:${i + 1}`),
      ...Array.from({ length: c.words.length + 1 }, (_, i) => `after:${i}`),
    ]);
    const actual = new Set([
      ...(c.teacher.errorWordIndices || []).map((i) => `word:${i}`),
      ...(c.teacher.extraAfterWordIndices || []).map((i) => `after:${i}`),
    ]);
    if ([...actual].some((k) => !slots.has(k))) {
      throw Error("Invalid teacher word index");
    }
    const result = compareTranscript(
      c.words,
      c.provider.transcript,
      providerQuality(c.provider),
    );
    const predicted = new Set(
      result.differences.map((d) =>
        d.wordIndex ? `word:${d.wordIndex}` : `after:${d.afterWord}`
      ),
    );
    const row = {
      recordings: 1,
      assessed: result.status === "could_not_assess" ? 0 : 1,
      abstained: result.status === "could_not_assess" ? 1 : 0,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0,
      unassessedTeacherErrors: 0,
    };
    if (row.abstained) row.unassessedTeacherErrors = actual.size;
    else {for (const slot of slots) {
        row[
          actual.has(slot)
            ? predicted.has(slot) ? "truePositives" : "falseNegatives"
            : predicted.has(slot)
            ? "falsePositives"
            : "trueNegatives"
        ]++;
      }}
    for (const key of Object.keys(total)) total[key] += row[key];
    if (
      !Array.isArray(c.conditions) || !c.conditions.length ||
      c.conditions.some((x) => !REQUIRED_CONDITIONS.includes(x))
    ) throw Error("Label recording conditions");
    for (const condition of new Set(c.conditions)) {
      conditions[condition] ||= Object.fromEntries(
        Object.keys(total).map((k) => [k, 0]),
      );
      for (const key of Object.keys(total)) {
        conditions[condition][key] += row[key];
      }
    }
  }
  const rates = (row) => ({
    ...row,
    coverage: row.recordings ? row.assessed / row.recordings : null,
    falsePositiveRate: row.falsePositives + row.trueNegatives
      ? row.falsePositives / (row.falsePositives + row.trueNegatives)
      : null,
    falseNegativeRate: row.falseNegatives + row.truePositives
      ? row.falseNegatives / (row.falseNegatives + row.truePositives)
      : null,
  });
  return {
    model: MODEL,
    comparisonVersion: COMPARISON_VERSION,
    evidence:
      "Operator-supplied teacher annotations; qualifications and consent require independent review.",
    units:
      "Binary expected-word and insertion-boundary flags, not tajweed scores. Abstentions excluded from assessed confusion counts and reported separately.",
    overall: rates(total),
    conditions: Object.fromEntries(
      Object.entries(conditions).map(([k, v]) => [k, rates(v)]),
    ),
    missingConditions: REQUIRED_CONDITIONS.filter((k) => !conditions[k]),
  };
}
