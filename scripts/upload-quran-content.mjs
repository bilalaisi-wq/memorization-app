// Operator-only. Immutable quarantine upload; never activates runtime availability.
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  encode,
  hash,
  safeRead,
  validateRelease,
} from "./validate-quran-release.mjs";
export async function uploadAsset({ request, path, data, type, sha256 }) {
  const get = async () => {
    const readPath = path.startsWith("object/")
      ? "object/authenticated/" + path.slice(7)
      : path;
    const response = await request(readPath, { method: "GET" });
    if (response.status === 404) return false;
    if (!response.ok) {
      throw Error("Remote comparison failed: HTTP " + response.status);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== sha256) {
      throw Error("Remote immutable asset conflict: " + path);
    }
    return true;
  };
  if (await get()) return "unchanged";
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": type, "x-upsert": "false" },
    body: data,
  });
  if (!response.ok && response.status !== 409) {
    throw Error("Upload failed: HTTP " + response.status);
  }
  if (!await get()) throw Error("Uploaded asset not verified");
  return response.status === 409 ? "unchanged" : "uploaded";
}
export async function deployRelease(
  root,
  { url, key, transport = fetch, upload = false } = {},
) {
  const manifest = await validateRelease(root);
  const stored = JSON.parse(
    (await safeRead(root, "upload-manifest.json")).toString(),
  );
  if (JSON.stringify(stored) !== JSON.stringify(manifest)) {
    throw Error("Upload manifest stale; run independent validator again");
  }
  if (!upload) {
    return {
      mode: "dry-run",
      releaseId: manifest.releaseId,
      assets: manifest.assets.length,
      bytes: manifest.assets.reduce((n, a) => n + a.bytes, 0),
      activation: "not-activated",
    };
  }
  const origin = new URL(url);
  if (
    origin.protocol !== "https:" || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash
  ) throw Error("Require HTTPS Supabase origin");
  let role;
  try {
    role = JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role;
  } catch {}
  if (!key || !(role === "service_role" || key.startsWith("sb_secret_"))) {
    throw Error(
      "Backend service credential required; never use VITE_* or publishable keys",
    );
  }
  const request = async (path, options = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await transport(
          origin.origin + "/storage/v1/" + path,
          {
            ...options,
            redirect: "error",
            signal: AbortSignal.timeout(60000),
            headers: {
              ...options.headers,
              authorization: `Bearer ${key}`,
              apikey: key,
            },
          },
        );
        if (
          (response.status === 429 || response.status >= 500) && attempt < 2
        ) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        return response;
      } catch (error) {
        if (attempt === 2) {
          throw Error(
            "Storage request failed; credentials omitted from diagnostics",
          );
        }
      }
    }
  };
  const bucket = await request("bucket/quran-premium");
  if (!bucket.ok || (await bucket.json()).public !== false) {
    throw Error("quran-premium must exist and be private");
  }
  const journalPath = resolve(root, "upload-journal.json");
  let journal;
  try {
    journal = JSON.parse(await readFile(journalPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw Error("Malformed upload journal; preserve it for recovery");
    }
  }
  const digest = hash(encode(manifest));
  if (
    journal &&
    (journal.origin !== origin.origin ||
      journal.releaseId !== manifest.releaseId ||
      journal.manifestSha256 !== digest)
  ) throw Error("Upload journal project/release mismatch");
  journal ??= {
    schemaVersion: 1,
    origin: origin.origin,
    releaseId: manifest.releaseId,
    manifestSha256: digest,
    completed: {},
  };
  for (const asset of manifest.assets) {
    const data = await safeRead(root, asset.path);
    if (hash(data) !== asset.sha256) throw Error("Asset changed during upload");
    const path = "object/quran-premium/" + manifest.prefix + "/" + asset.path;
    // Recheck remote data on every resume, including receipts written before a crash.
    const result = await uploadAsset({
      request,
      path,
      data,
      type: asset.type,
      sha256: asset.sha256,
    });
    journal.completed[asset.path] = { sha256: asset.sha256, result };
    await writeFile(journalPath + ".partial", encode(journal), { mode: 0o600 });
    await rename(journalPath + ".partial", journalPath);
  }
  return {
    mode: "uploaded",
    releaseId: manifest.releaseId,
    assets: manifest.assets.length,
    activation: "not-activated",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2), i = args.indexOf("--release");
  if (
    i < 0 || !args[i + 1] || args.some((a, n) =>
      n !== i + 1 && !["--release", "--upload", "--dry-run"].includes(a)
    ) || args.includes("--upload") && args.includes("--dry-run")
  ) {
    throw Error(
      "Usage: node scripts/upload-quran-content.mjs --release PATH [--upload | --dry-run]",
    );
  }
  console.log(
    JSON.stringify(
      await deployRelease(resolve(args[i + 1]), {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        upload: args.includes("--upload"),
      }),
    ),
  );
}
