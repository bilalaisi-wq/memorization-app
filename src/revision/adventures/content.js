import { wordIdentity } from "../../distractors.js";
import { canonicalSlice } from "../../../supabase/functions/_shared/segmentation.js";
import {
  contentView,
  validateRefs,
  fingerprints,
} from "../../passage-context/model.js";
import {
  loadBundle,
  freeReference,
  localBundle,
} from "../../content/library.js";
import { seededShuffle } from "../../puzzles/arcade/content.js";
import { surahs } from "../../data.js";
const pool = () =>
  surahs
    .filter((s) => freeReference(`${s.id}:1`))
    .flatMap((s) => s.verses.map((v) => localBundle(`${s.id}:${v.id}`)));
// Display workspaces only. No stop/timing/waqf approval is inferred.
export function revisionUnits(bundle, memory = "guided") {
  if (!["guided", "standard", "expert"].includes(memory))
    throw Error("Unsupported memory challenge");
  const words = contentView(bundle, "words"),
    width =
      words.length <= 6
        ? words.length
        : words.length <= 12
        ? 3
        : words.length <= 24
        ? 2
        : words.length <= 36
        ? 3
        : 5,
    units = [];
  for (let i = 0; i < words.length; i += width) {
    const source = words.slice(i, i + width);
    units.push({
      id: `${bundle.key}:${source[0].position}-${source.at(-1).position}`,
      key: bundle.key,
      kind: words.length <= 6 ? "ayah" : "visual-group",
      text: canonicalSlice(bundle, source[0].position, source.at(-1).position),
      transliteration: source.map((w) => w.transliteration || "").join(" "),
      positions: source.map((w) => w.position),
      sourceWordIds: source.map((w) => w.id),
      cue:
        memory === "expert"
          ? ""
          : words
              .slice(Math.max(0, i - (memory === "guided" ? 3 : 1)), i)
              .map((w) => w.text)
              .join(" "),
      cumulative: i > 0 && units.length % (memory === "expert" ? 2 : 4) === 0,
    });
  }
  const expanded = [];
  for (let i = 0; i < units.length; i++) {
    expanded.push(units[i]);
    const interval = memory === "expert" ? 2 : memory === "standard" ? 4 : 6;
    if (
      units.length >= 4 &&
      ((i + 1) % interval === 0 || i === units.length - 1) &&
      i > 0
    ) {
      const first = units[i - 1].positions[0],
        last = units[i].positions.at(-1),
        part = words.slice(first - 1, last);
      expanded.push({
        id: `${bundle.key}:${first}-${last}:review`,
        key: bundle.key,
        kind: "cumulative-review",
        review: true,
        cumulative: true,
        text: canonicalSlice(bundle, first, last),
        positions: part.map((w) => w.position),
        sourceWordIds: part.map((w) => w.id),
        transliteration: part.map((w) => w.transliteration || "").join(" "),
        cue: memory === "guided" ? "Connect these studied groups" : "",
      });
    }
  }
  return expanded;
}
export function revisionChoices(
  unit,
  { seed = 1, turn = 0, memory = "guided", bundles = pool() } = {}
) {
  const seen = new Set([wordIdentity(unit.text)]),
    wrong = [];
  for (const b of seededShuffle(bundles, seed + turn)) {
    const count = unit.positions.length,
      words = b.words.slice(0, count),
      text = words.map((w) => w.text).join(" ");
    if (!text || seen.has(wordIdentity(text))) continue;
    seen.add(wordIdentity(text));
    wrong.push({
      id: `${b.key}:1-${words.length}`,
      key: b.key,
      text,
      transliteration: words.map((w) => w.transliteration || "").join(" "),
      positions: words.map((w) => w.position),
    });
  }
  if (memory === "expert")
    wrong.sort(
      (a, b) =>
        Number(b.text[0] === unit.text[0]) - Number(a.text[0] === unit.text[0])
    );
  const count = memory === "guided" ? 2 : 3;
  if (wrong.length < count - 1)
    throw Error("Distinct source-backed choices unavailable");
  // Rotate the correct slot with a seeded offset: balanced, reproducible, no color clues.
  const answers = wrong.slice(0, count - 1),
    slot = seededShuffle(
      Array.from({ length: count }, (_, i) => i),
      seed + Math.floor(turn / count) * 104729
    )[turn % count];
  answers.splice(slot, 0, { ...unit });
  return answers;
}
export async function authorizeRegion(
  refs,
  index,
  client,
  {
    memory = "guided",
    isCurrent = () => true,
    pin = null,
    verifyBundle = async () => {},
  } = {}
) {
  validateRefs(refs);
  const bundle = await loadBundle(refs[index], client);
  if (!isCurrent()) throw Error("Learning account changed");
  await verifyBundle(bundle);
  if (!isCurrent()) throw Error("Learning account changed");
  const fingerprint = await fingerprints(bundle);
  if (pin && JSON.stringify(pin) !== JSON.stringify(fingerprint))
    throw Error("Source revision changed; saved progress retained for export");
  return { bundle, fingerprint, units: revisionUnits(bundle, memory) };
}
