import { execFileSync } from "node:child_process";
// Metadata only: exact source hashes, counts and audio durations. No sacred text edits.
import { readFile, writeFile } from "node:fs/promises";
import { surahs } from "../src/data.js";
import { localBundle, sha256 } from "../src/content/library.js";
const entries = [];
for (const s of surahs) {
  for (const v of s.verses) {
    if (v.words.length <= 12) continue;
    const key = `${s.id}:${v.id}`, b = localBundle(key);
    const hash = await sha256(
      JSON.stringify({
        key: b.key,
        text: b.textUthmani,
        words: b.words.map((w) => w.text),
      }),
    );
    const duration = Math.round(
      Number(
        execFileSync("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          "public" + b.freeAudio,
        ], { encoding: "utf8" }).trim(),
      ) * 1000,
    );
    if (!Number.isFinite(duration) || duration <= 0) {
      throw Error("Invalid source duration");
    }
    entries.push({ key, total: v.words.length, hash, duration });
  }
}
const manifest = JSON.parse(
  await readFile(".quran-private/manifest.json", "utf8"),
);
for (const row of manifest.verses) {
  if (row.wordCount <= 12) continue;
  const b = JSON.parse(await readFile(".quran-private/" + row.path, "utf8"));
  entries.push({
    key: row.key,
    total: row.wordCount,
    hash: row.sha256,
    duration: b.audioAssets[0].durationMs,
  });
}
const sql =
  "-- Automatically prepared source registry. No approvals are created.\ninsert into public.quran_review_heads(verse_key,total_words,source_hash,duration_ms) values\n" +
  entries.map((e) => `('${e.key}',${e.total},'${e.hash}',${e.duration})`).join(
    ",\n",
  ) + "\non conflict(verse_key) do nothing;\n";
await writeFile("supabase/migrations/20261025_review_sources.sql", sql);
console.log(
  `Prepared ${entries.length} current long-ayah review sources; all 6236 references use the same schema.`,
);
