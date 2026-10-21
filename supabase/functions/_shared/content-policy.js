import catalog from "./quran-catalog.json" with { type: "json" };
import availability from "./content-availability.json" with { type: "json" };
export { availability, catalog };
export function reference(key) {
  if (typeof key !== "string" || !/^\d+:\d+$/.test(key)) {
    throw Error("Invalid Quran reference");
  }
  const [surah, ayah] = key.split(":").map(Number),
    chapter = catalog.chapters.find((c) => c.id === surah);
  if (!chapter || ayah < 1 || ayah > chapter.verseCount) {
    throw Error("Unknown Quran reference");
  }
  return {
    key,
    surah,
    ayah,
    juz: chapter.ranges.find((r) => ayah >= r.first && ayah <= r.last).juz,
  };
}
export function freeReference(key) {
  const r = reference(key);
  return r.surah === 1 || r.juz === 30;
}
export function allowedReference(key, ent) {
  const r = reference(key);
  return freeReference(key) || !!ent?.features?.allQuran ||
    (ent?.plan === "explorer" && ent.selectedJuz?.includes(r.juz));
}
export function availableReference(key) {
  return freeReference(key) || availability.premium.some((p) => p.key === key);
}
export function reviewedSegments(bundle) {
  return bundle.segments.filter((s) =>
    s.reference === bundle.key && Number.isInteger(s.firstWord) &&
    Number.isInteger(s.lastWord) && s.firstWord >= 1 &&
    s.lastWord <= bundle.words.length && s.firstWord <= s.lastWord &&
    ((s.kind === "whole-ayah" && s.firstWord === 1 &&
      s.lastWord === bundle.words.length) ||
      (s.kind === "reviewed" && s.review?.status === "approved" &&
        s.review.reviewer && s.review.evidence && s.review.reviewedAt))
  );
}
export function validateBundle(bundle, expectedKey) {
  const r = reference(expectedKey);
  if (
    bundle.schemaVersion !== 1 || bundle.key !== expectedKey ||
    bundle.surah !== r.surah || bundle.ayah !== r.ayah ||
    bundle.juz !== r.juz || !bundle.textUthmani || !bundle.translation ||
    !bundle.sources?.length || !Array.isArray(bundle.words) ||
    !bundle.words.length
  ) throw Error("Invalid content bundle");
  if (
    bundle.words.some((w, i) =>
      w.position !== i + 1 || typeof w.text !== "string" || !w.text
    )
  ) throw Error("Invalid word boundaries");
  if (
    !Array.isArray(bundle.segments) ||
    reviewedSegments(bundle).length !== bundle.segments.length ||
    new Set(bundle.segments.map((s) => s.id)).size !== bundle.segments.length
  ) throw Error("Unapproved segmentation");
  const normal = (t) =>
    t.replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g, "");
  if (
    normal(bundle.textUthmani) !== normal(
      bundle.words.map((w) => w.text).join(""),
    )
  ) throw Error("Text/word mismatch");
  return bundle;
}
export async function sha256(raw) {
  const data = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

export function segmentAudioReviewed(segment, bundle) {
  return segment.kind === "whole-ayah" ||
    segment.review?.status === "approved" &&
      segment.audioReview?.status === "approved" &&
      segment.audioReview.reviewer && segment.audioReview.evidence &&
      segment.audioReview.reviewedAt && Number.isFinite(segment.startMs) &&
      segment.startMs >= 0 && Number.isFinite(segment.endMs) &&
      segment.endMs > segment.startMs &&
      segment.endMs <=
        (bundle.audioAssets?.find((a) => a.file.endsWith("/full.mp3"))
          ?.durationMs || 0);
}
