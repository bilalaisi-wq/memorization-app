import { campaign } from "../registry.js";
import { sha256, localBundle, loadBundle } from "../../content/library.js";
import { recallUnit } from "../../passage/model.js";
import {
  contentRevision,
  segmentationRevision,
  canonicalRef,
} from "../checkpoints.js";
import { rescueMap } from "../rescue/model.js";
import { surahs } from "../../data.js";
import { wordIdentity } from "../../distractors.js";
import { seededShuffle } from "../../puzzles/arcade/content.js";
export const presets = Object.freeze({
  beginner: { choices: 2, chain: 2, max: 3 },
  standard: { choices: 3, chain: 3, max: 6 },
  expert: { choices: 4, chain: 4, max: 10 },
});
export const modes = { boss: "murajaah-boss-rush", survival: "hifz-survival" };
export function survivalChoices(document, now = new Date()) {
  const map = rescueMap(document, { now });
  return [...map.stars].sort(
    (a, b) =>
      (a.state === "upcoming") - (b.state === "upcoming") ||
      Date.parse(a.due) - Date.parse(b.due) ||
      a.id.localeCompare(b.id),
  );
}
export function selectSurvival(
  document,
  ids,
  { length = "short", now = new Date() } = {},
) {
  if (
    !["short", "extended"].includes(length) ||
    !Array.isArray(ids) ||
    !ids.length
  )
    throw Error("Choose memorized units for your route.");
  const allowed = new Set(ids),
    eligible = survivalChoices(document, now),
    selected = eligible.filter((r) => allowed.has(r.id));
  if (selected.length !== allowed.size)
    throw Error("A selected unit has no eligible independent recall record.");
  return selected
    .slice(0, length === "short" ? 3 : 10)
    .map((r) => structuredClone(r.unit));
}
export async function buildRevisionPlan({
  mode,
  preset = "beginner",
  rules = "practice",
  refs = [],
  units = [],
  length = "short",
  client,
  bundleLoader = loadBundle,
}) {
  if (
    !modes[mode] ||
    !["classic", "practice"].includes(rules) ||
    !presets[preset]
  )
    throw Error("Invalid revision configuration.");
  campaign(modes[mode]);
  const bundles = new Map(),
    pins = {};
  async function get(key) {
    canonicalRef(key);
    if (!bundles.has(key)) {
      const b = await bundleLoader(key, client);
      pins[key] = {
        sourceHash: await contentRevision(b),
        segmentHash: await segmentationRevision(b),
      };
      bundles.set(key, b);
    }
    return bundles.get(key);
  }
  let checkpoints = [];
  if (mode === "boss") {
    if (
      refs.length < 2 ||
      refs.length > presets[preset].max ||
      refs.some((key, i) => {
        const [s, a] = key.split(":").map(Number),
          [ps, pa] = (refs[i - 1] || key).split(":").map(Number);
        return i > 0 && (s !== ps || a !== pa + 1);
      })
    )
      throw Error(
        `Choose 2–${presets[preset].max} consecutive ayahs from one surah.`,
      );
    const all = [];
    for (const key of refs) all.push(await get(key));
    const target = all[1],
      tokens = new Set(target.words.map((w) => wordIdentity(w.text)));
    // Identical canonical openings can occur at different references. Such choices
    // are indistinguishable in this task and must never become distractors.
    const previewIdentity = (b) =>
      b.words
        .slice(0, 12)
        .map((w) => wordIdentity(w.text))
        .join(" ");
    const seenPreviews = new Set([previewIdentity(target)]);
    const pool = surahs
      .flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`))
      .filter((k) => !refs.includes(k))
      .map((key) => {
        const b = localBundle(key);
        return {
          key,
          preview: previewIdentity(b),
          score: b.words.reduce(
            (n, w) => n + Number(tokens.has(wordIdentity(w.text))),
            0,
          ),
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.key.localeCompare(b.key, undefined, { numeric: true }),
      )
      .filter((p) => {
        if (seenPreviews.has(p.preview)) return false;
        seenPreviews.add(p.preview);
        return true;
      });
    const candidates = [
      target.key,
      ...pool.slice(0, presets[preset].choices - 1).map((p) => p.key),
    ];
    if (candidates.length !== presets[preset].choices)
      throw Error(
        "Not enough distinguishable verified passages for this gate.",
      );
    for (const key of candidates) await get(key);
    checkpoints = [
      {
        kind: "recall",
        title: "Opening recall",
        unit: await recallUnit([all[0]]),
        requireIndependent: false,
      },
      {
        kind: "recall",
        title: "Continuation recall",
        unit: await recallUnit([all[1]]),
        requireIndependent: false,
        cue: refs[0],
      },
      {
        kind: "discrimination",
        title: "Similar passage discrimination",
        target: target.key,
        choices: candidates,
        similarity:
          pool[0]?.score > 0
            ? "Shared-word candidates"
            : "Verified alternatives; no shared wording found",
      },
      {
        kind: "recall",
        title: "Consecutive ayah recall",
        unit: await recallUnit(all.slice(0, presets[preset].chain)),
        requireIndependent: false,
      },
      {
        kind: "recall",
        title: "Full independent passage recall",
        unit: await recallUnit(all),
        requireIndependent: true,
      },
    ];
  } else {
    if (
      !["short", "extended"].includes(length) ||
      !units.length ||
      units.length > (length === "short" ? 3 : 10)
    )
      throw Error(
        "Choose up to three units for a short route or ten for an extended route.",
      );
    if (new Set(units.map((u) => u.id)).size !== units.length)
      throw Error("Choose distinct recall units.");
    if (new Set(units.flatMap((u) => u.refs)).size > 60)
      throw Error("Choose a smaller route (up to 60 distinct ayahs).");
    for (const unit of units) {
      const all = [];
      for (const key of unit.refs) all.push(await get(key));
      const segment =
        unit.type === "segment"
          ? all[0].segments.find((s) => s.id === unit.segment)
          : null;
      if (
        (unit.type === "segment" && !segment) ||
        (await recallUnit(all, segment)).id !== unit.id
      )
        throw Error("A reviewed unit changed. Saved history is preserved.");
      checkpoints.push({
        kind: "recall",
        title: `Revision stop ${checkpoints.length + 1}`,
        unit: structuredClone(unit),
        requireIndependent: false,
      });
    }
  }
  const definition = {
    version: 1,
    mode,
    campaignId: modes[mode],
    preset,
    rules,
    length,
    pins,
    checkpoints,
  };
  const hash = await sha256(JSON.stringify(definition));
  const plan = {
    ...definition,
    id: `campaign:${hash}`,
    checkpoints: await Promise.all(
      checkpoints.map(async (c, i) => ({
        ...c,
        id: `quest:${await sha256(JSON.stringify([hash, i, c]))}`,
      })),
    ),
  };
  return { plan, bundles };
}
export async function verifyRevisionCheckpoint(
  plan,
  index,
  client,
  bundleLoader = loadBundle,
) {
  const c = plan.checkpoints[index];
  if (!c) throw Error("No checkpoint available.");
  const keys = c.kind === "recall" ? c.unit.refs : c.choices,
    bundles = [];
  for (const key of keys) {
    const b = await bundleLoader(key, client),
      pin = plan.pins[key];
    if (
      !pin ||
      (await contentRevision(b)) !== pin.sourceHash ||
      (await segmentationRevision(b)) !== pin.segmentHash
    )
      throw Error(
        "Source or reviewed segmentation changed. Keep this run for recovery and start a new route.",
      );
    bundles.push(b);
  }
  if (c.kind === "recall") {
    const segment =
      c.unit.type === "segment"
        ? bundles[0].segments.find((s) => s.id === c.unit.segment)
        : null;
    if (
      (c.unit.type === "segment" && !segment) ||
      (await recallUnit(bundles, segment)).id !== c.unit.id
    )
      throw Error("Reviewed recall unit changed.");
  }
  return bundles;
}
export function discriminationOrder(plan, index) {
  const c = plan.checkpoints[index];
  return seededShuffle(c.choices, parseInt(c.id.slice(-8), 16));
}
export function savedRevisionAssessment(document, run) {
  const pending = run.pending,
    active = document?.active;
  if (!pending || !active?.graded || active.unitId !== pending.unitId)
    throw Error("Complete the matching self-assessment first.");
  const h = document.records?.[pending.unitId]?.history.find(
    (h) => h.attemptId === active.id,
  );
  if (
    !h ||
    Date.parse(h.at) < Date.parse(pending.at) ||
    !["Again", "Hard", "Good", "Easy"].includes(h.grade)
  )
    throw Error("No new matching assessment found.");
  return {
    attemptId: h.attemptId,
    unitId: pending.unitId,
    at: h.at,
    grade: h.grade,
    independent: h.independent === true,
    scheduled: h.scheduled === true,
    nextReview: h.nextReview || null,
  };
}
export function revisionSummary(run) {
  const recalls = run.results.filter((r) => r.kind === "recall");
  return {
    attempts: recalls.length,
    coverage: new Set(recalls.map((r) => r.unitId)).size,
    independent: recalls.filter((r) => r.independent).length,
    assisted: recalls.filter((r) => !r.independent).length,
    difficult: recalls.filter((r) => ["Again", "Hard"].includes(r.grade))
      .length,
    scheduled: recalls.filter((r) => r.scheduled).length,
    remaining: run.plan.checkpoints.length - run.cursor,
  };
}
