import { approvedRecitationSegments } from "../../supabase/functions/_shared/segmentation.js";
import { surahs, verseAudio } from "../data.js";
import {
  availability,
  catalog,
  freeReference,
  reference,
  sha256,
  validateBundle,
} from "../../supabase/functions/_shared/content-policy.js";
export {
  availability,
  catalog,
  freeReference,
  reference,
  sha256,
  validateBundle,
};
export function localBundle(key) {
  if (!freeReference(key)) return null;
  const { surah, ayah, juz } = reference(key),
    chapter = surahs.find((s) => s.id === surah),
    v = chapter?.verses.find((v) => v.id === ayah);
  if (!v) throw Error("Free reference is unavailable");
  return {
    schemaVersion: 1,
    key,
    surah,
    ayah,
    juz,
    textUthmani: v.text,
    translation: v.translation,
    sources: [{
      url: surah === 1 ? "/quran-source.json" : "/additional-quran-source.json",
    }],
    words: v.words.map((text, i) => ({
      position: i + 1,
      text,
      translation: v.meanings[i][0],
      transliteration: v.roman[i],
    })),
    segments: [{
      id: "full",
      reference: key,
      firstWord: 1,
      lastWord: v.words.length,
      kind: "whole-ayah",
    }],
    freeAudio: verseAudio(ayah, surah),
  };
}
export async function loadBundle(key, client) {
  const local = localBundle(key);
  if (local) {
    local.contentRevision = await sha256(
      JSON.stringify({
        key: local.key,
        text: local.textUthmani,
        words: local.words.map((w) => w.text),
      }),
    );
    if (client) {
      try {
        const request = client.rpc("published_segmentation_review", {
          reference: key,
          source_hash: local.contentRevision,
        });
        const result = await (typeof request.abortSignal === "function"
          ? request.abortSignal(AbortSignal.timeout(2000))
          : request);
        if (result.data) {
          local.segmentationReview = result.data;
        }
      } catch {
      }
    }
    if (local.segmentationReview) {
      local.segments.push(
        ...approvedRecitationSegments(local.segmentationReview, local),
      );
    }
    return validateBundle(local, key);
  }
  const entry = availability.premium.find((p) => p.key === key);
  if (!entry) throw Error("This ayah has not been validated for release.");
  if (!client) throw Error("Sign in to request premium content.");
  const { data, error } = await client.functions.invoke("quran-content", {
    body: { key, asset: "bundle" },
  });
  if (error) {
    let message =
      "Private content is not available. Check your subscription and server deployment.";
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw Error(message);
  }
  // The server checks exact bytes against a pinned hash before returning JSON.
  data.contentRevision = entry.sha256;
  return validateBundle(data, key);
}
export async function loadAudio(bundle, client) {
  if (bundle.freeAudio) return { url: bundle.freeAudio, revoke: () => {} };
  const { data, error } = await client.functions.invoke("quran-content", {
    body: { key: bundle.key, asset: "audio" },
  });
  if (error || !(data instanceof Blob)) {
    throw Error("Verified recitation is unavailable.");
  }
  if (
    await sha256(await data.arrayBuffer()) !==
      availability.premium.find((p) => p.key === bundle.key)?.audioSha256
  ) throw Error("Audio integrity check failed.");
  const url = URL.createObjectURL(data);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
export function referenceOptions() {
  return [
    ...surahs.flatMap((s) =>
      s.verses.map((v) => ({
        key: `${s.id}:${v.id}`,
        label: `${s.name} ${s.id}:${v.id} · Free`,
      }))
    ),
    ...availability.premium.map((p) => ({
      key: p.key,
      label: `${
        catalog.chapters.find((c) => c.id === reference(p.key).surah).name
      } ${p.key} · Juz ${p.juz} · Private library`,
    })),
  ];
}
