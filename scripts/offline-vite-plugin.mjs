import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { localBundle, sha256 } from "../src/content/library.js";
import { surahs } from "../src/data.js";
import { freeReference } from "../supabase/functions/_shared/content-policy.js";
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function offlineManifestPlugin() {
  let root,write=true;
  return {
    name: "free-offline-manifest",
    enforce: "post",
    configResolved(config) {
      root = config.root;
      write=config.build.write!==false;
    },
    async writeBundle(options) {
      const directory = options.dir || resolve(root, "dist"),
        path = resolve(directory, "offline-manifest.json"),
        manifest = JSON.parse(await readFile(path, "utf8"));
      for (const row of manifest.shell) {
        const bytes = await readFile(resolve(directory, "." + row.url));
        row.bytes = bytes.length;
        row.sha256 = digest(bytes);
      }
      const { revision, ...content } = manifest;
      manifest.revision = digest(JSON.stringify(content));
      await writeFile(path, JSON.stringify(manifest));
    },
    async generateBundle(_options, bundle) {
      if(!write)return; // In-memory policy builds do not prepare deployable app downloads.
      const shell = [], audio = {}, texts = {};
      for (const [file, asset] of Object.entries(bundle)) {
        if (!/^(?:assets\/[\w.-]+\.(?:js|css|woff2)|index\.html)$/.test(file)) {
          continue;
        }
        const bytes = Buffer.from(
          asset.type === "chunk" ? asset.code : asset.source,
        );
        shell.push({
          url: "/" + file,
          bytes: bytes.length,
          sha256: digest(bytes),
        });
      }
      for (
        const file of [
          "appearance-bootstrap.js",
          "module-recovery.js",
          "quran-source.json",
          "additional-quran-source.json",
          "fonts/UthmanicHafs.woff2",
        ]
      ) {
        const bytes = await readFile(resolve(root, "public", file));
        shell.push({
          url: "/" + file,
          bytes: bytes.length,
          sha256: digest(bytes),
        });
      }
      for (const name of await readdir(resolve(root, "public/audio"))) {
        const m = name.match(/^(\d{3})(\d{3})\.mp3$/) ||
          name.match(/^(\d{3})_(\d{3})_(\d{3})\.mp3$/);
        if (!m) continue;
        const key = `${Number(m[1])}:${Number(m[2])}`;
        if (!freeReference(key)) continue;
        const bytes = await readFile(resolve(root, "public/audio", name));
        audio["/audio/" + name] = {
          key,
          kind: m[3] ? "word" : "ayah",
          bytes: bytes.length,
          sha256: digest(bytes),
        };
      }
      for (const s of surahs.filter((s) => s.id === 1 || s.id >= 78)) {
        for (const v of s.verses) {
          const b = localBundle(`${s.id}:${v.id}`);
          b.contentRevision = await sha256(
            JSON.stringify({
              key: b.key,
              text: b.textUthmani,
              words: b.words.map((w) => w.text),
            }),
          );
          const bytes = Buffer.from(JSON.stringify(b));
          texts[b.key] = {
            bytes: bytes.length,
            sha256: digest(bytes),
            contentRevision: b.contentRevision,
          };
        }
      }
      const files = { schemaVersion: 1, shell, audio, texts };
      this.emitFile({
        type: "asset",
        fileName: "offline-manifest.json",
        source: JSON.stringify({
          ...files,
          revision: digest(JSON.stringify(files)),
        }),
      });
    },
  };
}
