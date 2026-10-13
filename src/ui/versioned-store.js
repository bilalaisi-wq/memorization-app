// Preserve malformed/future data and acknowledge mutations only after a successful write.
export function versionedStore(storage, key, initial, validate) {
  let data = initial(),
    warning = "",
    blocked = false;
  function refresh() {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return;
      const next = JSON.parse(raw);
      if (!validate(next)) throw new Error("Unsupported saved data");
      data = next;
    } catch {
      blocked = true;
      warning = `Saved ${key} data is unavailable or needs recovery. It has not been overwritten.`;
    }
  }
  refresh();
  return {
    get warning() {
      return warning;
    },
    snapshot() {
      refresh();
      return structuredClone(data);
    },
    transact(action) {
      refresh();
      if (blocked) throw new Error(warning);
      const next = structuredClone(data);
      const result = action(next);
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        warning = `Could not save ${key} progress. Free browser storage and try again.`;
        throw new Error(warning);
      }
      data = next;
      warning = "";
      return result;
    },
  };
}
