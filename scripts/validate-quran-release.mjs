// Independent Node validator: preparation never self-certifies a deployable release.
import { readFile, realpath, rename, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  catalog,
  validateBundle,
} from "../supabase/functions/_shared/content-policy.js";
import { canonicalReferences } from "./lib/quran-coverage.mjs";
export const hash = (data) => createHash("sha256").update(data).digest("hex");
export const encode = (value) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
export async function safeRead(root, path) {
  if (
    typeof path !== "string" || !path || path.includes("\\") ||
    path.startsWith("/") ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  ) throw Error("Unsafe asset path");
  const base = await realpath(root), file = await realpath(resolve(base, path));
  if (
    !relative(base, file) || relative(base, file).startsWith(".." + sep) ||
    relative(base, file) === ".."
  ) throw Error("Asset escapes release");
  return readFile(file);
}
const parse = (raw) => JSON.parse(raw.toString());
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const rights = [
  "arabic",
  "translation",
  "transliteration",
  "wordMeanings",
  "fullAyahAudio",
];
export async function validateRelease(root, { writeManifest = false } = {}) {
  const selectionRaw = await safeRead(root, "selection.json"),
    selection = parse(selectionRaw),
    manifestRaw = await safeRead(root, "manifest.json"),
    manifest = parse(manifestRaw);
  const wordReviewRaw = await safeRead(root, "word-audio-review.json"),
    wordReviews = parse(wordReviewRaw);
  assert(
    hash(wordReviewRaw) === selection.wordReviewSha256 &&
      wordReviews.schemaVersion === 1 && Array.isArray(wordReviews.entries),
    "Word review fingerprint mismatch",
  );
  const policyRaw = await safeRead(root, "source-policy.json"),
    policy = parse(policyRaw),
    referenceRaw = await safeRead(root, "reference-manifest.json"),
    independent = parse(referenceRaw);
  assert(
    selection.schemaVersion === 1 && selection.pipelineVersion === 2 &&
      manifest.schemaVersion === 1 && manifest.pipelineVersion === 2,
    "Unsupported release schema",
  );
  // Python serialization is deliberately hashed as stored, including source policy and reference attestations.
  assert(
    hash(policyRaw) === selection.policySha256 &&
      hash(referenceRaw) === selection.referenceManifestSha256,
    "Source approval fingerprint mismatch",
  );
  assert(
    selection.edition === "quran-com-v4-uthmani" &&
      policy.edition === selection.edition &&
      independent.edition === selection.edition &&
      policy.translationResourceId === 20 &&
      policy.sourceVersion === selection.sourceVersion &&
      !!policy.sourceVersion,
    "Source version/edition mismatch",
  );
  for (const kind of rights) {
    const r = policy.rights?.[kind];
    assert(
      r?.commercialUse === true &&
        ["source", "version", "evidence", "reviewer", "reviewedAt"].every((k) =>
          typeof r[k] === "string" && r[k].trim()
        ),
      `Missing rights evidence: ${kind}`,
    );
  }
  const source = independent.source;
  assert(
    independent.schemaVersion === 1 && source?.independentOfQuranCom === true &&
      ["provider", "url", "version", "reviewer", "reviewedAt", "evidence"]
        .every((k) => typeof source[k] === "string" && source[k]),
    "Missing independent mapping evidence",
  );
  const sourceUrl = new URL(source.url);
  assert(
    sourceUrl.protocol === "https:" && sourceUrl.hostname !== "quran.com" &&
      !sourceUrl.hostname.endsWith(".quran.com"),
    "Mapping source is not independent",
  );
  const refs = canonicalReferences(catalog),
    mapping = new Map(refs.map((r) => [r.key, r]));
  assert(
    independent.references?.length === 6236 &&
      new Set(independent.references.map((r) => r.key)).size === 6236 &&
      independent.references.every((r) => mapping.get(r.key)?.juz === r.juz),
    "Independent mapping mismatch",
  );
  assert(
    hash(encode(Object.fromEntries(refs.map((r) => [r.key, r.juz])))) ===
      selection.catalogSha256,
    "Catalog revision mismatch",
  );
  assert(
    new Set(wordReviews.entries.map((r) => `${r.key}:${r.position}`)).size ===
        wordReviews.entries.length &&
      wordReviews.entries.every((r) =>
        selection.privateReferences.includes(r.key)
      ),
    "Duplicate/unselected word audio reviews",
  );
  const keys = selection.references;
  assert(
    Array.isArray(keys) && keys.length > 0 &&
      new Set(keys).size === keys.length && keys.every((k) => mapping.has(k)),
    "Invalid selected references",
  );
  assert(
    JSON.stringify(keys) === JSON.stringify(
      refs.filter((r) => keys.includes(r.key)).map((r) => r.key),
    ),
    "Noncanonical selection ordering",
  );
  const isFree = (k) => mapping.get(k).surah === 1 || mapping.get(k).juz === 30;
  assert(
    JSON.stringify(selection.privateReferences) ===
        JSON.stringify(keys.filter((k) => !isFree(k))) &&
      JSON.stringify(selection.freeReferences) ===
        JSON.stringify(keys.filter(isFree)),
    "Free/private selection mismatch",
  );
  assert(
    /^[a-f0-9]{24}$/.test(manifest.releaseId) &&
      hash(selectionRaw).slice(0, 24) === manifest.releaseId,
    "Release ID mismatch",
  );
  const legacyRaw = await safeRead(root, "legacy-manifest.json");
  assert(
    hash(legacyRaw) === selection.legacyManifestSha256,
    "Legacy manifest fingerprint mismatch",
  );
  const legacy = parse(legacyRaw);
  assert(
    legacy.schemaVersion === 1 && Array.isArray(legacy.verses) &&
      new Set(legacy.verses.map((v) => v.key)).size === legacy.verses.length,
    "Malformed legacy manifest",
  );
  assert(
    Array.isArray(manifest.verses) &&
      JSON.stringify(manifest.verses.map((v) => v.key)) ===
        JSON.stringify(selection.privateReferences),
    "Missing or duplicated release ayahs",
  );
  const assets = [],
    byPath = new Map(),
    byHash = new Map(),
    missingOptional = [];
  const add = (path, raw, type, ref) => {
    const digest = hash(raw);
    assert(!byPath.has(path), "Duplicate asset path");
    byPath.set(path, digest);
    const row = {
      path,
      sha256: digest,
      bytes: raw.length,
      type,
      reference: ref,
    };
    if (byHash.has(digest)) row.duplicateOf = byHash.get(digest);
    else byHash.set(digest, path);
    assets.push(row);
  };
  for (const entry of manifest.verses) {
    const prefix = entry.key.replace(":", "/");
    assert(entry.path === prefix + "/bundle.json", "Noncanonical bundle path");
    const raw = await safeRead(root, entry.path);
    assert(hash(raw) === entry.sha256, "Bundle hash mismatch: " + entry.key);
    const b = validateBundle(parse(raw), entry.key);
    assert(
      b.words.length === entry.wordCount && b.juz === entry.juz,
      "Word/reference metadata mismatch",
    );
    assert(
      b.translationSource?.resourceId === 20 &&
        b.words.every((w) =>
          typeof w.translation === "string" && w.translation.trim() &&
          typeof w.transliteration === "string" && w.transliteration.trim()
        ),
      "Missing translation, transliteration or word meanings",
    );
    assert(
      Array.isArray(b.audioAssets) &&
        b.audioAssets.filter((a) => a.file === prefix + "/full.mp3").length ===
          1,
      "Full-ayah coverage missing",
    );
    // New fetches retain raw responses; legacy reuse retains exact pinned bytes, not new attribution.
    if (entry.provenance?.kind === "provider-fetch") {
      assert(
        entry.sourceVersion === policy.sourceVersion &&
          b.sources.length === 2 &&
          JSON.stringify(entry.provenance.sources) ===
            JSON.stringify(b.sources),
        "Source version mismatch",
      );
      for (const [i, s] of b.sources.entries()) {
        const expected = "https://api.quran.com/api/v4/" +
          (i === 0
            ? `verses/by_key/${entry.key}?words=true&word_fields=text_uthmani,audio_url&translations=20`
            : `quran/verses/uthmani?verse_key=${entry.key}`);
        assert(
          s.url === expected && /^[a-f0-9]{64}$/.test(s.sha256),
          "Unapproved source",
        );
        const sourceRaw = await safeRead(root, "sources/" + s.sha256 + ".json");
        assert(hash(sourceRaw) === s.sha256, "Raw source changed");
        const doc = parse(sourceRaw);
        if (i === 1) {
          assert(
            doc.verses?.[0]?.verse_key === entry.key &&
              doc.verses[0].text_uthmani === b.textUthmani,
            "Canonical text changed",
          );
        } else {
          assert(
            doc.verse?.verse_key === entry.key &&
              doc.verse.juz_number === entry.juz,
            "Provider metadata changed",
          );
          const words = doc.verse.words.filter((w) =>
              w.char_type_name === "word"
            ),
            normal = (t) =>
              t.normalize("NFD").replace(
                /[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g,
                "",
              );
          assert(
            words.length === b.words.length &&
              words.every((w, n) =>
                w.position === n + 1 &&
                normal(w.text_uthmani) === normal(b.words[n].text) &&
                w.translation?.text === b.words[n].translation &&
                w.transliteration?.text === b.words[n].transliteration &&
                (w.audio_url || null) === (b.words[n].audioSource || null)
              ),
            "Source word alignment/aids changed",
          );
          const translation = doc.verse.translations?.find((t) =>
            t.resource_id === 20
          );
          assert(
            typeof translation?.text === "string" && !!translation.text &&
              translation.text === b.translationSource.text,
            "Source translation changed",
          );
        }
      }
    } else {
      const prior = legacy.verses.find((v) => v.key === entry.key);
      assert(
        entry.provenance?.kind === "legacy-reuse" &&
          entry.provenance.legacyManifestSha256 ===
            selection.legacyManifestSha256 &&
          prior?.sha256 === entry.sha256 &&
          prior.audioSha256 === entry.audioSha256 &&
          (!prior.sourceVersion ||
            prior.sourceVersion === policy.sourceVersion),
        "Missing legacy provenance or source version mismatch",
      );
    }
    const prior = legacy.verses.find((v) => v.key === entry.key);
    if (prior && entry.provenance.kind === "provider-fetch") {
      assert(
        selection.refresh === true &&
          entry.migration?.previousSha256 === prior.sha256 &&
          entry.migration.previousAudioSha256 === prior.audioSha256 &&
          entry.migration.reason === policy.migrationReason &&
          !!policy.migrationReason &&
          prior.sourceVersion !== policy.sourceVersion,
        "Unapproved source migration",
      );
    }
    if (entry.provenance.kind === "provider-fetch") {
      const tokens = [];
      let prefix = "";
      const normal = (t) =>
        t.replace(/[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]/g, "");
      for (const token of b.textUthmani.split(/\s+/)) {
        if (normal(token)) {
          tokens.push(prefix + token);
          prefix = "";
        } else if (tokens.length) tokens[tokens.length - 1] += " " + token;
        else prefix += token + " ";
      }
      assert(
        !prefix && tokens.length === b.words.length &&
          tokens.every((t, i) => t === b.words[i].text),
        "Canonical word spelling/marks changed",
      );
    }
    add(entry.path, raw, "application/json", entry.key);
    const [s, v] = entry.key.split(":");
    for (const a of b.audioAssets) {
      const full = a.file === prefix + "/full.mp3";
      const audio = await safeRead(root, a.file);
      if (full) {
        assert(
          a.source ===
              `https://verses.quran.com/Alafasy/mp3/${s.padStart(3, "0")}${
                v.padStart(3, "0")
              }.mp3` && a.sha256 === entry.audioSha256,
          "Unapproved full audio source",
        );
      } else {
        const r = a.wordReview,
          w = b.words[a.wordPosition - 1],
          rights = policy.rights.wordAudio;
        assert(
          rights?.commercialUse === true &&
            ["source", "version", "evidence", "reviewer", "reviewedAt"].every(
              (k) => rights[k],
            ),
          "Missing word audio rights",
        );
        assert(
          Number.isInteger(a.wordPosition) && w?.audioVerified === true &&
            a.file === prefix + `/word-${a.wordPosition}.mp3` &&
            r?.key === entry.key && r.position === a.wordPosition &&
            r.status === "approved" &&
            ["reviewer", "reviewedAt", "evidence"].every((k) => r[k]) &&
            r.textSha256 === hash(w.text) && r.audioSha256 === a.sha256 &&
            wordReviews.entries.some((x) =>
              JSON.stringify(x) === JSON.stringify(r)
            ),
          "Unreviewed word audio",
        );
        const source = `https://audio.qurancdn.com/wbw/${s.padStart(3, "0")}_${
          v.padStart(3, "0")
        }_${String(a.wordPosition).padStart(3, "0")}.mp3`;
        assert(
          a.source === source &&
            (w.audioSource === source ||
              "https://audio.qurancdn.com/" + w.audioSource === source),
          "Word audio source mismatch",
        );
      }
      assert(
        audio.length > 100 &&
          (audio.subarray(0, 3).toString() === "ID3" || audio[0] === 255) &&
          hash(audio) === a.sha256 && a.bytes === audio.length &&
          Number.isFinite(a.durationMs) && a.durationMs > 0,
        "Invalid or missing recording",
      );
      const exec = promisify(execFile), file = resolve(root, a.file);
      await exec("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        file,
        "-f",
        "null",
        "-",
      ], { timeout: 120000, maxBuffer: 1024 * 1024 });
      const { stdout } = await exec("ffprobe", [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file,
      ], { timeout: 30000 });
      assert(
        Math.abs(Math.round(Number(stdout) * 1000) - a.durationMs) <= 1,
        "Decoded audio duration mismatch",
      );
      add(a.file, audio, "audio/mpeg", entry.key);
    }
    for (const w of b.words) {
      if (w.audioVerified === true) {
        assert(
          b.audioAssets.some((a) => a.wordPosition === w.position),
          "Missing reviewed word clip",
        );
      } else {missingOptional.push({
          key: entry.key,
          position: w.position,
          asset: "wordAudio",
          status: "not-reviewed-not-imported",
        });}
    }
  }
  for (const r of wordReviews.entries) {
    assert(
      assets.some((a) =>
        a.path === r.key.replace(":", "/") + `/word-${r.position}.mp3`
      ),
      "Missing approved word recording",
    );
  }
  const upload = {
    schemaVersion: 1,
    pipelineVersion: 2,
    releaseId: manifest.releaseId,
    bucket: "quran-premium",
    prefix: `releases/${manifest.releaseId}`,
    manifestSha256: hash(manifestRaw),
    selectionSha256: hash(selectionRaw),
    policySha256: hash(policyRaw),
    referenceManifestSha256: hash(referenceRaw),
    assets,
    missingOptional,
    activation: "not-activated",
    privateBucketRequired: true,
  };
  if (writeManifest) {
    const path = resolve(root, "upload-manifest.json");
    await writeFile(path + ".partial", encode(upload));
    await rename(path + ".partial", path);
  }
  return upload;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const index = process.argv.indexOf("--release");
  if (index < 0 || !process.argv[index + 1]) {
    throw Error(
      "Usage: node scripts/validate-quran-release.mjs --release .quran-private/candidates/ID",
    );
  }
  const upload = await validateRelease(resolve(process.argv[index + 1]), {
    writeManifest: true,
  });
  console.log(JSON.stringify({
    releaseId: upload.releaseId,
    assets: upload.assets.length,
    duplicateAssets: upload.assets.filter((a) => a.duplicateOf).length,
    wordAudioImported: upload.assets.filter((a) =>
      /\/word-\d+\.mp3$/.test(a.path)
    ).length,
    wordAudioUnreviewed: upload.missingOptional.length,
    activation: upload.activation,
  }));
}
