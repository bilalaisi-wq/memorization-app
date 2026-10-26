// Offline evaluation only. Never uploads audio/transcripts or writes learning state.
import { readFile } from "node:fs/promises";
import {
  availability,
  sha256,
  validateBundle,
} from "../supabase/functions/_shared/content-policy.js";
import { localBundle } from "../src/content/library.js";
import { evaluateCases } from "../supabase/functions/_shared/recitation-evaluation.js";
if (!process.argv[2]) {
  throw Error(
    "Usage: node scripts/evaluate-recitation.mjs /secure/path/teacher-reviewed-cases.json",
  );
}
const data = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!Array.isArray(data.cases) || !data.cases.length) {
  throw Error("No teacher-reviewed cases supplied.");
}
const cases = [];
for (const c of data.cases) {
  let bundle = localBundle(c.reference);
  if (!bundle) {
    const entry = availability.premium.find((x) => x.key === c.reference);
    if (!entry) throw Error("Reference is not source-validated");
    const [s, a] = c.reference.split(":");
    const raw = await readFile(
      new URL(`../.quran-private/${s}/${a}/bundle.json`, import.meta.url),
    );
    if (await sha256(raw) !== entry.sha256) {
      throw Error("Reference integrity check failed");
    }
    bundle = validateBundle(JSON.parse(raw.toString()), c.reference);
  }
  cases.push({ ...c, words: bundle.words.map((w) => w.text) });
}
console.log(
  JSON.stringify(
    { ...evaluateCases(cases), generatedAt: new Date().toISOString() },
    null,
    2,
  ),
);
