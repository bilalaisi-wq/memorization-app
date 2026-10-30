import { validateBundle, reference, sha256 } from "../content/library.js";
import { reviewedSegments } from "../../supabase/functions/_shared/content-policy.js";
import { wordWindow, recallUnit } from "../passage/model.js";
import { campaign } from "./registry.js";
import { arcadeGames } from "../puzzles/arcade/registry.js";
export const canonicalRef = (key) => {
  const r = reference(key);
  if (key !== `${r.surah}:${r.ayah}`)
    throw Error("Canonical surah:ayah reference required");
  return r.key;
};
export const playableGame = (id) =>
  arcadeGames.some((g) => g.id === id && g.status === "available");
export async function contentRevision(bundle) {
  validateBundle(bundle, canonicalRef(bundle.key));
  // Hash exact source even for free bundles without a supplied contentRevision.
  const revision =
    bundle.contentRevision ||
    (await sha256(
      JSON.stringify({
        key: bundle.key,
        text: bundle.textUthmani,
        words: bundle.words.map((w) => w.text),
      }),
    ));
  return sha256(
    JSON.stringify([
      bundle.key,
      bundle.textUthmani,
      bundle.words.map((w) => [w.position, w.text]),
      revision,
    ]),
  );
}
export async function segmentationRevision(bundle) {
  return sha256(
    JSON.stringify([
      bundle.segmentationReview || null,
      reviewedSegments(bundle),
      Array.from({ length: wordWindow(bundle, 0).count }, (_, i) => {
        const w = wordWindow(bundle, i);
        return [w.first, w.last];
      }),
    ]),
  );
}
export async function generateCheckpoints({
  campaignId,
  bundles,
  game = "maze",
  units = {},
}) {
  const policy = campaign(campaignId);
  if (
    !Array.isArray(bundles) ||
    !bundles.length ||
    bundles.length > 10 ||
    new Set(bundles.map((b) => b.key)).size !== bundles.length
  )
    throw Error("Choose one to ten distinct verified ayahs");
  const sorted = [...bundles].sort(
    (a, b) => a.surah - b.surah || a.ayah - b.ayah,
  );
  if (
    !units ||
    typeof units !== "object" ||
    Array.isArray(units) ||
    Object.keys(units).some((key) => !bundles.some((b) => b.key === key))
  )
    throw Error("Invalid recitation unit selection");
  const checkpoints = [];
  for (const bundle of sorted) {
    const sourceHash = await contentRevision(bundle),
      segmentHash = await segmentationRevision(bundle);
    const segmentId = units[bundle.key];
    const selectedSegment = segmentId
      ? reviewedSegments(bundle).find(
          (s) => s.id === segmentId && s.kind === "reviewed",
        )
      : null;
    if (
      segmentId &&
      (!/^[a-zA-Z0-9:_-]{1,128}$/.test(segmentId) || !selectedSegment)
    )
      throw Error("Only current reviewed recitation units may be selected");
    for (const type of policy.activities) {
      const count = type === "study" ? wordWindow(bundle, 0).count : 1;
      for (let page = 0; page < count; page++) {
        const w = wordWindow(bundle, page);
        const definition = {
          version: 1,
          campaignId,
          key: bundle.key,
          sourceHash,
          segmentHash,
          type,
          game: type === "arcade" && playableGame(game) ? game : null,
          // A visual page never becomes a recitation unit or stop.
          workspace:
            type === "study"
              ? { page, firstWord: w.first, lastWord: w.last }
              : null,
          recall:
            type === "recall"
              ? await recallUnit([bundle], selectedSegment)
              : null,
        };
        const id = `quest:${await sha256(JSON.stringify(definition))}`;
        checkpoints.push({ ...definition, id });
      }
    }
  }
  return checkpoints;
}
