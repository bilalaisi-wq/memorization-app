import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineManifestPlugin } from "./offline-vite-plugin.mjs";
import {
  offlineSelection,
  planDownload,
  verifyManifest,
} from "../src/offline/model.js";
let manifest;
async function fixture() {
  if (manifest) return manifest;
  const p = offlineManifestPlugin();
  p.configResolved({ root: process.cwd() });
  const emitted = [];
  await p.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, {
    "index.html": { type: "asset", source: "<html>free study</html>" },
    "assets/game.js": { type: "chunk", code: "export const publicGame=true;" },
    ".quran-private/not-for-shell.json": { type: "asset", source: "PRIVATE" },
  });
  return manifest = JSON.parse(emitted[0].source);
}
test("download manifest contains exactly free references, source hashes and public shell assets", async () => {
  const m = await fixture();
  assert.equal(Object.keys(m.texts).length, 571);
  assert.equal(Object.keys(m.texts).some((k) => k.startsWith("2:")), false);
  assert.equal(m.shell.some((a) => a.url.includes("private")), false);
  assert.ok(
    Object.values(m.audio).every((a) =>
      /^([a-f0-9]){64}$/.test(a.sha256) && a.bytes > 0
    ),
  );
  assert.equal(verifyManifest(m), m);
});
test("free surah and Juz Amma selection rejects premium/out-of-range content", () => {
  assert.equal(offlineSelection({ surah: 112 }).refs.length, 4);
  assert.equal(offlineSelection({ juz: 30 }).refs.length, 564);
  for (const selection of [{ surah: 2 }, { juz: 29 }, { surah: 115 }, {}]) {
    assert.throws(() => offlineSelection(selection));
  }
});
test("size planning is exact, includes app-shell overhead, and requires no download or storage writes", async () => {
  const m = await fixture(),
    text = await planDownload({ surah: 112 }, { manifest: m }),
    audio = await planDownload({ surah: 112 }, { manifest: m, audio: true });
  assert.equal(text.assets.length, 0);
  assert.equal(text.texts.length, 4);
  assert.ok(audio.assets.length > 4);
  assert.equal(audio.bytes, audio.contentBytes + audio.shellBytes);
  assert.equal(audio.assets.filter((a) => a.kind === "ayah").length, 4);
  assert.ok(
    audio.texts.every((t) =>
      t.bundle.key.startsWith("112:") && t.bundle.textUthmani &&
      t.bundle.contentRevision
    ),
  );
  await assert.rejects(
    planDownload({ surah: 112 }, {
      manifest: m,
      audio: true,
      quota: { quota: 10, usage: 0 },
    }),
    /Not enough/,
  );
});
test("missing audio and source-version mismatches fail the release plan without fabricated replacements", async () => {
  const m = await fixture();
  await assert.rejects(
    planDownload({ surah: 112 }, {
      manifest: { ...m, audio: {} },
      audio: true,
    }),
    /Verified audio missing/,
  );
  await assert.rejects(
    planDownload({ surah: 112 }, {
      manifest: {
        ...m,
        texts: { ...m.texts, "112:1": { sha256: "0".repeat(64) } },
      },
    }),
    /Source revision changed/,
  );
  assert.throws(
    () => verifyManifest({ ...m, audio: { "/private.mp3": { key: "2:255" } } }),
    /Unsafe/,
  );
});
test('manifest rehashes final emitted app bytes after Vite preload transformations',async()=>{
  const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,dirname}=await import('node:path'),{createHash}=await import('node:crypto');
  const dir=await mkdtemp(join(tmpdir(),'ayah-offline-final-'));
  try{const initial=structuredClone(await fixture());await writeFile(join(dir,'offline-manifest.json'),JSON.stringify(initial));for(const row of initial.shell){const target=join(dir,row.url);await mkdir(dirname(target),{recursive:true});await writeFile(target,'FINAL_PRELOAD_TRANSFORM_'+row.url);}
  const plugin=offlineManifestPlugin();plugin.configResolved({root:process.cwd()});await plugin.writeBundle({dir});const final=JSON.parse(await readFile(join(dir,'offline-manifest.json'),'utf8'));assert.notEqual(final.revision,initial.revision);for(const row of final.shell){const bytes=await readFile(join(dir,row.url));assert.equal(row.bytes,bytes.length);assert.equal(row.sha256,createHash('sha256').update(bytes).digest('hex'));}}finally{await rm(dir,{recursive:true,force:true});}
});
