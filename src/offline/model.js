import { surahs, verseAudio, wordAudio } from "../data.js";
import { freeReference, localBundle, sha256 } from "../content/library.js";
import { assetBytes, commitPackage, dbRead, dbWrite } from "./store.js";
export const FREE_CHAPTERS = () =>
  surahs.filter((s) => s.id === 1 || s.id >= 78 && s.id <= 114);
export function offlineSelection({ surah, juz } = {}) {
  const chapters = juz === 30
    ? FREE_CHAPTERS().filter((s) => s.id >= 78)
    : FREE_CHAPTERS().filter((s) => s.id === Number(surah));
  if (!chapters.length || juz !== undefined && juz !== 30) {
    throw Error(
      "Offline downloads currently support Al-Fatihah and Juz Amma only. Premium material requires online authorization.",
    );
  }
  return {
    id: juz === 30 ? "juz:30" : `surah:${Number(surah)}`,
    label: juz === 30 ? "Juz Amma" : chapters[0].name,
    refs: chapters.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
  };
}
export async function canonicalText(key) {
  if (!freeReference(key)) {
    throw Error("Premium offline authorization has not been issued.");
  }
  const b = localBundle(key);
  b.contentRevision = await sha256(
    JSON.stringify({
      key: b.key,
      text: b.textUthmani,
      words: b.words.map((w) => w.text),
    }),
  );
  return b;
}
export function verifyManifest(m) {
  if (
    m?.schemaVersion !== 1 || !/^\w{64}$/.test(m.revision || "") ||
    !Array.isArray(m.shell) || !m.audio || !m.texts
  ) {
    throw Error(
      "Offline manifest is unavailable. Deploy a production build before downloading.",
    );
  }
  for (const [url, a] of Object.entries(m.audio)) {
    if (
      !/^\/audio\/(?:\d{6}|\d{3}_\d{3}_\d{3})\.mp3$/.test(url) ||
      !freeReference(a.key) || !Number.isSafeInteger(a.bytes) || a.bytes < 1 ||
      !/[a-f0-9]{64}/.test(a.sha256)
    ) throw Error("Unsafe offline audio manifest.");
  }
  return m;
}
export async function fetchManifest({ fetcher = fetch } = {}) {
  const r = await fetcher("/offline-manifest.json", { cache: "no-store" });
  if (!r.ok) throw Error("Offline manifest could not load. Retry when online.");
  return verifyManifest(await r.json());
}
export async function planDownload(
  selection,
  { audio = false, manifest, quota = null } = {},
) {
  const chosen = offlineSelection(selection), texts = [];
  const paths = new Set();
  for (const key of chosen.refs) {
    const b = await canonicalText(key),
      item = manifest.texts[key],
      json = JSON.stringify(b);
    if (!item || await sha256(json) !== item.sha256) {
      throw Error(
        `Source revision changed for ${key}; reload the current app before downloading.`,
      );
    }
    texts.push({ id: key, bundle: b, sha256: item.sha256, bytes: item.bytes });
    if (audio) {
      paths.add(verseAudio(b.ayah, b.surah));
      for (let i = 0; i < b.words.length; i++) {
        paths.add(wordAudio(b.ayah, i, b.surah));
      }
    }
  }
  const assets = [...paths].map((url) => {
    const item = manifest.audio[url];
    if (!item) throw Error(`Verified audio missing from release: ${url}`);
    return { id: url, ...item };
  });
  const contentBytes = texts.reduce((s, t) => s + t.bytes, 0) +
      assets.reduce((s, a) => s + a.bytes, 0),
    shellBytes = manifest.shell.reduce((s, a) => s + a.bytes, 0),
    bytes = contentBytes + shellBytes;
  if (
    quota && Number.isFinite(quota.quota) && Number.isFinite(quota.usage) &&
    quota.quota - quota.usage < bytes * 1.1
  ) {
    throw Error(
      "Not enough device storage. Remove downloads or choose text only.",
    );
  }
  return {
    ...chosen,
    version: 1,
    revision: manifest.revision,
    audio,
    assets,
    texts,
    bytes,
    contentBytes,
    shellBytes,
  };
}
export function createDownloadService(
  { fetcher = fetch, clock = () => new Date(), onProgress = () => {} } = {},
) {
  let cancelled = false, running = false;
  return {
    cancel() {
      cancelled = true;
    },
    async download(plan, { prepareShell = async () => {} } = {}) {
      if (running) throw Error("A download is already running.");
      running = true;
      cancelled = false;
      const record = {
        id: plan.id,
        version: 1,
        label: plan.label,
        refs: plan.refs,
        revision: plan.revision,
        audio: plan.audio,
        paths: plan.assets.map((a) => a.id),
        bytes: plan.contentBytes,
        status: "downloading",
        completed: 0,
        total: plan.texts.length + plan.assets.length,
        failed: [],
        updatedAt: clock().toISOString(),
      };
      try {
        const previous = await dbRead("packages", record.id);
        // Retain all previously owned media until this update actually succeeds.
        record.paths = [...new Set([...(Array.isArray(previous?.paths) ? previous.paths : []), ...record.paths])];
        await dbWrite("packages", record);
        await prepareShell();
        for (const t of plan.texts) {
          if (cancelled) throw Error("Download paused. Retry to continue.");
          await dbWrite("texts", { ...t, revision: plan.revision });
          record.completed++;
          onProgress({ ...record });
        }
        // Bounded to one fetch: predictable memory use and reliable mobile cancellation.
        for (const a of plan.assets) {
          if (cancelled) throw Error("Download paused. Retry to continue.");
          try {
            const existing = await dbRead("assets", a.id);
            let reusable = false;
            if (
              existing?.sha256 === a.sha256 && existing.bytes === a.bytes
            ) {
              try {
                await assetBytes(a.id);
                reusable = true;
              } catch {}
            }
            if (!reusable) {
              const r = await fetcher(a.id, {
                cache: "no-store",
                signal: AbortSignal.timeout(45000),
              });
              if (!r.ok) throw Error(`HTTP ${r.status}`);
              const blob = await r.blob();
              if (
                blob.size !== a.bytes ||
                await sha256(await blob.arrayBuffer()) !== a.sha256
              ) throw Error("Source checksum or size mismatch");
              await dbWrite("assets", {
                ...a,
                blob,
                downloadedAt: clock().toISOString(),
              });
            }
            record.completed++;
          } catch (e) {
            record.failed.push({
              path: a.id,
              error: e.name === "QuotaExceededError"
                ? "Device storage is full. Remove downloads or choose text only."
                : e.message,
            });
          }
          await dbWrite("packages", record);
          onProgress({ ...record });
        }
        record.status = record.failed.length ? "incomplete" : "ready";
      } catch (e) {
        record.status = "incomplete";
        record.failed.push({ path: "download", error: e.message });
      } finally {
        running = false;
        record.updatedAt = clock().toISOString();
        if(record.status === "ready") record.paths = plan.assets.map(a => a.id);
        await commitPackage(record, {cleanup: record.status === "ready"});
        onProgress({ ...record });
      }
      return record;
    },
  };
}
export async function removeDownload(id) {
  const row = await dbRead("packages", id);
  if (!row) return;
  await commitPackage(null, { removeId: id, cleanup: true });
}
export async function readDownloaded(key) {
  if (!freeReference(key)) {
    throw Error("Premium materials require online authorization.");
  }
  const row = await dbRead("texts", key);
  if (!row) throw Error("This ayah has not been downloaded.");
  if (await sha256(JSON.stringify(row.bundle)) !== row.sha256) {
    throw Error("Downloaded text is corrupt; remove and retry the download.");
  }
  const current = await canonicalText(key);
  if (current.contentRevision !== row.bundle.contentRevision || await sha256(JSON.stringify(current))!==row.sha256) {
    throw Error(
      "The source revision changed. Update this download before studying it.",
    );
  }
  return row.bundle;
}
