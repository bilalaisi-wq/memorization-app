import { progressKeys } from "./profile-storage.js";
export const RESTORE_KEY = "ayah-cloud-restore-backup-v1";
export const SYNC_KEY = "ayah-cloud-sync-v1";
export function validBackup(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.entries(payload).every(
      ([key, value]) => progressKeys.includes(key) && typeof value === "string",
    )
  );
}
const fingerprint = async (payload) => {
  const encoded = new TextEncoder().encode(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};
export class CloudProgress {
  constructor(client, profileId, storage, onStatus = () => {}) {
    Object.assign(this, {
      client,
      profileId,
      storage,
      onStatus,
      revision: 0,
      base: null,
      enabled: false,
      conflict: false,
      disposed: false,
      timer: null,
      status: "Progress stays on this device until sync is enabled.",
    });
    try {
      const raw = storage.getItem(SYNC_KEY);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (
          saved?.version !== 1 ||
          typeof saved.enabled !== "boolean" ||
          !Number.isInteger(saved.revision) ||
          saved.revision < 0 ||
          (saved.base !== null && typeof saved.base !== "string")
        )
          throw Error();
        this.enabled = saved.enabled;
        this.revision = saved.revision;
        this.base = saved.base;
      }
    } catch {
      this.metadataWarning =
        "Saved cloud sync metadata needs recovery. It has not been overwritten; export device data before choosing a sync direction.";
      this.conflict = true;
    }
  }
  snapshot() {
    return Object.fromEntries(
      progressKeys
        .map((key) => [key, this.storage.getItem(key)])
        .filter(([, value]) => value !== null),
    );
  }
  notify(message) {
    this.status = message;
    this.onStatus(message);
  }
  remember() {
    if (this.metadataWarning) throw Error(this.metadataWarning);
    this.storage.setItem(
      SYNC_KEY,
      JSON.stringify({
        version: 1,
        enabled: this.enabled,
        revision: this.revision,
        base: this.base,
      }),
    );
  }
  async remote() {
    const { data, error } = await this.client
      .from("learner_progress")
      .select("payload,revision")
      .eq("user_id", this.profileId)
      .maybeSingle();
    if (error) throw error;
    if (
      data &&
      (!validBackup(data.payload) || !Number.isInteger(data.revision))
    )
      throw new Error("Cloud backup format or database setup needs attention.");
    return data;
  }
  writePayload(payload) {
    for (const key of progressKeys) {
      const wanted = payload[key] ?? null;
      if (this.storage.getItem(key) === wanted) continue;
      if (wanted !== null) this.storage.setItem(key, wanted);
      else this.storage.removeItem(key);
    }
    if (
      JSON.stringify(this.snapshot()) !==
      JSON.stringify(
        Object.fromEntries(
          progressKeys.filter((k) => k in payload).map((k) => [k, payload[k]]),
        ),
      )
    )
      throw Error("Device storage did not retain the restored copy.");
  }
  apply(payload) {
    if (this.disposed) throw Error("This sync session has ended.");
    if (!validBackup(payload))
      throw Error("Invalid cloud backup; local data is unchanged.");
    const previous = this.storage.getItem(RESTORE_KEY);
    if (previous !== null) {
      let p;
      try {
        p = JSON.parse(previous);
      } catch {
        throw Error(
          "Cloud recovery data needs export; it has not been overwritten.",
        );
      }
      if (
        p.version !== 1 ||
        p.owner !== this.profileId ||
        !validBackup(p.original) ||
        !validBackup(p.incoming) ||
        !["pending", "applied", "rolled-back", "recovered"].includes(p.state)
      )
        throw Error(
          "Cloud recovery data needs export; it has not been overwritten.",
        );
      if (p.state === "pending")
        throw Error(
          "An unfinished cloud restore needs recovery in My account.",
        );
    }
    const backup = {
      version: 1,
      owner: this.profileId,
      state: "pending",
      original: this.snapshot(),
      incoming: structuredClone(payload),
    };
    const raw = JSON.stringify(backup);
    this.storage.setItem(RESTORE_KEY, raw);
    if (this.storage.getItem(RESTORE_KEY) !== raw)
      throw Error("Could not preserve the device copy. Nothing was restored.");
    try {
      this.writePayload(payload);
      backup.state = "applied";
      this.storage.setItem(RESTORE_KEY, JSON.stringify(backup));
    } catch {
      try {
        this.writePayload(backup.original);
        backup.state = "rolled-back";
        this.storage.setItem(RESTORE_KEY, JSON.stringify(backup));
      } catch {
        /* Both full copies remain in the durable pending backup. */
      }
      throw Error(
        "Cloud restore was interrupted. The original device copy is preserved for recovery in My account; export both copies before retrying.",
      );
    }
  }
  recover() {
    if (this.disposed) throw Error("This sync session has ended.");
    let backup;
    try {
      backup = JSON.parse(this.storage.getItem(RESTORE_KEY));
    } catch {}
    if (
      backup?.version !== 1 ||
      backup.owner !== this.profileId ||
      !validBackup(backup.original)
    )
      throw Error("Recovery data needs export; nothing was overwritten.");
    this.writePayload(backup.original);
    backup.state = "recovered";
    this.storage.setItem(RESTORE_KEY, JSON.stringify(backup));
    this.enabled = false;
    this.base = null;
    this.remember();
    this.conflict = true;
    this.notify(
      "The original device copy is recovered. Export both copies before choosing a new cloud sync direction.",
    );
  }
  async initialize() {
    if (this.metadataWarning) {
      this.notify(this.metadataWarning);
      return;
    }
    try {
      const remote = await this.remote();
      if (this.disposed) return;
      const local = this.snapshot(),
        localPrint = await fingerprint(local);
      if (this.disposed) return;
      if (!remote) {
        if (this.revision > 0) {
          this.conflict = true;
          this.notify(
            "Cloud backup changed. Resolve in My account before syncing.",
          );
          return;
        }
        this.revision = 0;
        this.remember();
        if (this.enabled) await this.save();
        return;
      }
      const remotePrint = await fingerprint(remote.payload);
      if (this.disposed) return;
      if ((await fingerprint(this.snapshot())) !== localPrint) {
        this.conflict = true;
        this.notify(
          "This device changed during sync. Local work is preserved; resolve the copies in My account.",
        );
        return;
      }
      if (this.disposed) return;
      if (
        !Object.keys(local).length ||
        localPrint === remotePrint ||
        localPrint === this.base
      ) {
        if (localPrint !== remotePrint) this.apply(remote.payload);
        this.revision = remote.revision;
        this.base = remotePrint;
        this.remember();
        this.notify(
          this.enabled
            ? "Progress loaded. Automatic sync is on."
            : "Private progress loaded from your account. Enable sync to save changes automatically.",
        );
      } else if (remotePrint === this.base) {
        this.revision = remote.revision;
        this.remember();
        if (this.enabled) await this.save();
      } else {
        this.conflict = true;
        this.notify(
          "This device and the cloud have different progress. Choose which copy to keep in My account.",
        );
      }
    } catch {
      this.conflict = true;
      this.notify(
        "Cloud progress could not be loaded. Local progress is safe; reconnect and use My account to retry.",
      );
    }
  }
  async save({ replace = false } = {}) {
    if (this.disposed) return;
    if (this.conflict && !replace)
      throw new Error("Resolve the device/cloud difference before saving.");
    if (this.saving) {
      this.pending = true;
      return this.saving;
    }
    this.saving = (async () => {
      try {
        if (replace) {
          const remote = await this.remote();
          if (this.disposed) return;
          this.revision = remote?.revision || 0;
        }
        const payload = this.snapshot();
        const { data, error } = await this.client.rpc("save_my_progress", {
          profile_id: this.profileId,
          expected_revision: this.revision,
          document: payload,
        });
        if (this.disposed) return;
        if (error) {
          if (error.code === "40001") this.conflict = true;
          throw error;
        }
        if (!Number.isInteger(data))
          throw new Error("The cloud save response was not valid.");
        this.revision = data;
        this.base = await fingerprint(payload);
        if (this.disposed) return;
        this.conflict = false;
        this.metadataWarning = "";
        this.remember();
        this.notify("Core learning progress saved privately across devices.");
      } catch (error) {
        this.notify(
          this.conflict
            ? "Another device has newer progress. Resolve it in My account; both copies are safe."
            : "Not synced. Your progress is safe on this device. Retry when connected.",
        );
        throw error;
      } finally {
        this.saving = null;
        if (this.pending && !this.disposed) {
          this.pending = false;
          this.changed();
        }
      }
    })();
    return this.saving;
  }
  async restore() {
    clearTimeout(this.timer);
    if (this.saving) await this.saving.catch(() => {});
    const remote = await this.remote();
    if (this.disposed) return;
    if (!remote) throw new Error("No cloud backup exists yet.");
    this.apply(remote.payload);
    this.revision = remote.revision;
    this.base = await fingerprint(remote.payload);
    if (this.disposed) return;
    this.conflict = false;
    this.metadataWarning = "";
    this.remember();
    this.notify("Cloud progress restored.");
  }
  async setEnabled(enabled) {
    this.enabled = enabled;
    this.remember();
    if (!enabled) {
      clearTimeout(this.timer);
      this.notify(
        "Automatic sync is off. Your saved cloud copy remains private.",
      );
      return;
    }
    await this.save();
  }
  changed() {
    if (!this.enabled || this.conflict || this.disposed) return;
    clearTimeout(this.timer);
    this.notify("Saving private progress…");
    this.timer = setTimeout(() => this.save().catch(() => {}), 900);
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
