// Public/free content only. Premium content and recordings never enter this database.
export const OFFLINE_DB = "ayah-free-offline-v1";
export const OFFLINE_VERSION = 1;
let opening;
export function openOfflineDB() {
  if (!globalThis.indexedDB) {
    return Promise.reject(
      Error("Offline downloads need browser IndexedDB storage."),
    );
  }
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(OFFLINE_DB, OFFLINE_VERSION);
      r.onupgradeneeded = () => {
        for (const name of ["packages", "assets", "texts"]) {
          if (!r.result.objectStoreNames.contains(name)) {
            r.result.createObjectStore(name, { keyPath: "id" });
          }
        }
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          opening = null;
        };
        resolve(r.result);
      };
      r.onerror = () => {
        opening = null;
        reject(r.error);
      };
      r.onblocked = () => {
        opening = null;
        reject(Error("Close another Ayah tab to update offline storage."));
      };
    });
  }
  return opening;
}
export async function dbRead(store, id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function dbList(store) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function dbWrite(store, value) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value);
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || Error("Storage write interrupted."));
  });
}
export async function dbRemove(store, id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function assetBytes(path) {
  const a = await dbRead("assets", path);
  if (!a) return null;
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await a.blob.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== a.sha256) {
    throw Error(
      "A downloaded recording failed its integrity check. Remove and retry the download.",
    );
  }
  return a.blob;
}
