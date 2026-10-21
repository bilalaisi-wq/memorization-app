// Run only with backend deployment credentials in the shell environment.
// No content goes into public/, Vite assets, or a public/signed storage URL.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.startsWith("https://") || !key) {
  throw Error(
    "Supply the Supabase URL and backend service-role key securely; never a VITE_* key.",
  );
}
const role = (() => {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role;
  } catch {
    return null;
  }
})();
if (role !== "service_role" && !key.startsWith("sb_secret_")) {
  throw Error(
    "A backend secret is required; publishable keys cannot upload content.",
  );
}
const manifest = JSON.parse(
  await readFile(".quran-private/manifest.json", "utf8"),
);
const hash = (data) => createHash("sha256").update(data).digest("hex");
for (const entry of manifest.verses) {
  const raw = await readFile(`.quran-private/${entry.path}`);
  if (hash(raw) !== entry.sha256) {
    throw Error("Bundle hash mismatch: " + entry.key);
  }
  const bundle = JSON.parse(raw);
  const items = [[entry.path, raw, "application/json"]];
  for (const a of bundle.audioAssets) {
    const data = await readFile(`.quran-private/${a.file}`);
    if (hash(data) !== a.sha256) throw Error("Audio hash mismatch");
    items.push([a.file, data, "audio/mpeg"]);
  }
  for (const [path, data, type] of items) {
    const response = await fetch(
      `${url}/storage/v1/object/quran-premium/${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          apikey: key,
          "content-type": type,
          "x-upsert": "true",
        },
        body: data,
      },
    );
    if (!response.ok) {
      throw Error(
        `Private upload failed for ${entry.key}: HTTP ${response.status}`,
      );
    }
  }
  console.log("Uploaded validated private reference " + entry.key);
}
