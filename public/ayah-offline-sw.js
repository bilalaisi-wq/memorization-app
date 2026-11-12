/* Explicit public/free downloads only. Never cache authentication or private endpoints. */
const PREFIX = "ayah-public-shell-v1-";
const DB = "ayah-free-offline-v1";
const hash = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const safePath = (p) =>
  /^\/assets\/[\w.-]+\.(?:js|css|woff2)$/.test(p) ||
  [
    "/index.html",
    "/appearance-bootstrap.js",
    "/module-recovery.js",
    "/quran-source.json",
    "/additional-quran-source.json",
    "/fonts/UthmanicHafs.woff2",
  ].includes(p);
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
async function prepareShell(port) {
  let name;
  try {
    const r = await fetch("/offline-manifest.json", { cache: "no-store" });
    if (!r.ok) throw Error("Could not load offline app manifest.");
    const manifest = await r.json();
    if (
      manifest.schemaVersion !== 1 ||
      !/^([a-f0-9]){64}$/.test(manifest.revision) ||
      !Array.isArray(manifest.shell) || manifest.shell.length > 500
    ) throw Error("Invalid offline app manifest.");
    name = PREFIX + manifest.revision;
    const cache = await caches.open(name);
    for (const item of manifest.shell) {
      if (
        !safePath(item.url) || !Number.isSafeInteger(item.bytes) ||
        item.bytes > 15 * 1024 * 1024 || !/^([a-f0-9]){64}$/.test(item.sha256)
      ) throw Error("Unsafe app-shell asset.");
      const stored = await cache.match(item.url);
      if (
        stored && await hash(await stored.clone().arrayBuffer()) === item.sha256
      ) continue;
      const response = await fetch(item.url, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok) throw Error("App shell asset unavailable: " + item.url);
      const bytes = await response.clone().arrayBuffer();
      if (
        bytes.byteLength !== item.bytes || await hash(bytes) !== item.sha256
      ) {
        throw Error("App source changed while downloading. Reload and retry.");
      }
      await cache.put(item.url, response);
    }
    const index = await cache.match("/index.html");
    if (!index) throw Error("App shell is incomplete.");
    await cache.put("/", index.clone());
    await cache.put(
      "/offline-manifest.json",
      new Response(JSON.stringify(manifest), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    // Only replace an older usable shell after this entire revision has validated.
    const meta = await caches.open("ayah-public-shell-index-v1");
    await meta.put("/__ayah-active-shell", new Response(name));
    for (const old of await caches.keys()) {
      if (old.startsWith(PREFIX) && old !== name) await caches.delete(old);
    }
    port?.postMessage({ ok: true, revision: manifest.revision });
  } catch (error) {
    port?.postMessage({ ok: false, error: error.message });
  }
}
self.addEventListener("message", (e) => {
  if (e.data?.type === "PREPARE_FREE_SHELL") {
    e.waitUntil(prepareShell(e.ports[0]));
  }
});
async function downloadedAudio(path, request) {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      for (const s of ["packages", "assets", "texts"]) {
        if (!r.result.objectStoreNames.contains(s)) {
          r.result.createObjectStore(s, { keyPath: "id" });
        }
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  let row;
  try {
    row = await new Promise((resolve, reject) => {
      const r = db.transaction("assets").objectStore("assets").get(path);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
  if (!row || !row.blob) return null;
  const m = path.match(/^\/audio\/(\d{3})(?:_?)(\d{3})(?:_\d{3})?\.mp3$/);
  if (
    !m || !(Number(m[1]) === 1 || Number(m[1]) >= 78 && Number(m[1]) <= 114) ||
    row.key !== `${Number(m[1])}:${Number(m[2])}`
  ) return null;
  const bytes = await row.blob.arrayBuffer();
  if (await hash(bytes) !== row.sha256) {
    return new Response("Recording integrity check failed. Retry download.", {
      status: 503,
    });
  }
  const headers = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416 });
    const size = bytes.byteLength;
    let start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2])),
      end = match[1]
        ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1)
        : size - 1;
    if (
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 ||
      start >= size || end < start
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    return new Response(
      request.method === "HEAD" ? null : bytes.slice(start, end + 1),
      {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      },
    );
  }
  return new Response(request.method === "HEAD" ? null : bytes, {
    headers: { ...headers, "Content-Length": String(bytes.byteLength) },
  });
}
async function shellFallback(request, path) {
  try {
    return await fetch(request);
  } catch (error) {
    const meta = await caches.open("ayah-public-shell-index-v1"),
      pointer = await meta.match("/__ayah-active-shell");
    if (pointer) {
      const cache = await caches.open(await pointer.text()),
        cached = await cache.match(request.mode === "navigate" ? "/" : path);
      if (cached) return cached;
    }
    throw error;
  }
}
self.addEventListener("fetch", (e) => {
  const request = e.request, url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    !["GET", "HEAD"].includes(request.method) ||
    request.headers.has("authorization")
  ) return;
  const path = url.pathname;
  if (/^\/audio\/(?:\d{6}|\d{3}_\d{3}_\d{3})\.mp3$/.test(path)) {
    e.respondWith(
      downloadedAudio(path, request).catch(() => null).then((found) =>
        found || fetch(request)
      ),
    );
    return;
  }
  if (
    request.mode === "navigate" || safePath(path) ||
    path === "/offline-manifest.json"
  ) e.respondWith(shellFallback(request, path));
});
