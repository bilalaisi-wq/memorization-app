import { scopedStorage } from "../learner/profile-storage.js";
import { canonicalRef } from "./checkpoints.js";
import { arcadeGames } from "../puzzles/arcade/registry.js";
import { campaign } from "./registry.js";
import { nextCheckpoint } from "./map.js";
export const QUEST_KEY = "ayah-quest-campaigns-v1";
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const digest = /^[a-f0-9]{64}$/;
const cpId = (id) => typeof id === "string" && /^quest:[a-f0-9]{64}$/.test(id);
function valid(data, owner) {
  try {
    if (data.version !== 1 || data.owner !== owner || !object(data.runs))
      return false;
    return Object.entries(data.runs).every(([id, r]) => {
      campaign(r.campaignId);
      if (
        r.game !== null &&
        r.game !== "falling" &&
        !arcadeGames.some((g) => g.id === r.game)
      )
        return false;
      if (
        r.units !== undefined &&
        (!object(r.units) ||
          Object.entries(r.units).some(
            ([k, v]) =>
              canonicalRef(k) !== k ||
              typeof v !== "string" ||
              !/^[a-zA-Z0-9:_-]{1,128}$/.test(v),
          ))
      )
        return false;
      if (r.routeVersion !== undefined && ![1, 2].includes(r.routeVersion))
        return false;
      if (
        r.drafts !== undefined &&
        (!object(r.drafts) ||
          Object.entries(r.drafts).some(
            ([id, d]) =>
              !r.checkpointIds.includes(id) ||
              !object(d) ||
              Object.keys(d).some(
                (k) =>
                  ![
                    "round",
                    "order",
                    "mistakes",
                    "assistance",
                    "revealed",
                  ].includes(k),
              ) ||
              !Array.isArray(d.order) ||
              !d.order.every(Number.isInteger) ||
              !Number.isInteger(d.round) ||
              d.round < 0 ||
              d.round > 2 ||
              !Number.isInteger(d.mistakes) ||
              d.mistakes < 0 ||
              !Number.isInteger(d.assistance) ||
              d.assistance < 0 ||
              typeof d.revealed !== "boolean",
          ))
      )
        return false;
      return (
        /^campaign:[a-f0-9]{64}$/.test(id) &&
        r.id === id &&
        Array.isArray(r.checkpointIds) &&
        r.checkpointIds.length > 0 &&
        r.checkpointIds.every(cpId) &&
        new Set(r.checkpointIds).size === r.checkpointIds.length &&
        object(r.started) &&
        Object.entries(r.started).every(
          ([k, v]) =>
            r.checkpointIds.includes(k) && Number.isFinite(Date.parse(v)),
        ) &&
        object(r.completed) &&
        Object.entries(r.completed).every(
          ([k, v]) =>
            r.checkpointIds.includes(k) &&
            Number.isFinite(Date.parse(v.at)) &&
            Number.isInteger(v.xp) &&
            v.xp >= 0 &&
            v.xp <= 80 &&
            ["practice", "arcade", "self-assessed"].includes(v.evidence) &&
            ["mistakes", "motorErrors", "assistance"].every(
              (n) => Number.isInteger(v[n]) && v[n] >= 0,
            ),
        ) &&
        Array.isArray(r.refs) &&
        r.refs.length > 0 &&
        r.refs.length <= 10 &&
        new Set(r.refs).size === r.refs.length &&
        r.refs.every((k) => canonicalRef(k) === k) &&
        Array.isArray(r.revisions) &&
        r.revisions.length === r.checkpointIds.length &&
        r.revisions.every(
          (x) => digest.test(x.sourceHash) && digest.test(x.segmentHash),
        ) &&
        Array.isArray(r.unlocks) &&
        new Set(r.unlocks).size === r.unlocks.length &&
        r.unlocks.every((k) => cpId(k) && r.completed[k])
      );
    });
  } catch {
    return false;
  }
}
// A fixed namespace plus a live identity guard; never let a stale activity write to a new profile.
export function createQuestStore({
  owner = null,
  getOwner,
  storage = owner ? scopedStorage(owner) : localStorage,
  clock = () => new Date(),
}) {
  if (typeof getOwner !== "function")
    throw Error("Live account identity required");
  let warning = "";
  const guard = () => {
    if (getOwner() !== owner) throw Error("Account changed; reopen the quest");
  };
  const read = () => {
    guard();
    const raw = storage.getItem(QUEST_KEY);
    if (raw === null) return { version: 1, owner, runs: {} };
    try {
      const data = JSON.parse(raw);
      if (!valid(data, owner)) throw Error();
      return data;
    } catch {
      warning = "Saved quest data needs recovery; it has not been overwritten.";
      throw Error(warning);
    }
  };
  const transact = (fn) => {
    const next = read(),
      result = fn(next);
    guard();
    if (!valid(next, owner))
      throw Error("Invalid quest document; existing data is unchanged");
    const raw = JSON.stringify(next);
    storage.setItem(QUEST_KEY, raw);
    if (storage.getItem(QUEST_KEY) !== raw)
      throw Error(
        "Quest save failed; retry without losing existing learning records",
      );
    return structuredClone(result);
  };
  const checkMap = (map, r) => {
    if (
      map.version !== 1 ||
      r.campaignId !== map.campaignId ||
      r.checkpointIds.join("|") !== map.checkpoints.map((c) => c.id).join("|")
    )
      throw Error("Quest source or route changed; open a new map");
  };
  return {
    get warning() {
      return warning;
    },
    snapshot: () => structuredClone(read()),
    exportRaw: () => {
      guard();
      return storage.getItem(QUEST_KEY);
    },
    restoreRaw(raw) {
      guard();
      const parsed = JSON.parse(raw);
      if (
        !valid(parsed, owner) ||
        Object.keys(parsed).some(
          (k) => !["version", "owner", "runs"].includes(k),
        ) ||
        Object.values(parsed.runs).some((r) =>
          Object.keys(r).some(
            (k) =>
              ![
                "id",
                "campaignId",
                "game",
                "routeVersion",
                "drafts",
                "units",
                "checkpointIds",
                "refs",
                "revisions",
                "started",
                "completed",
                "unlocks",
              ].includes(k),
          ),
        )
      )
        throw Error(
          "Invalid or incompatible expedition backup. Original records are unchanged.",
        );
      const previous = storage.getItem(QUEST_KEY);
      if (previous !== null)
        storage.setItem("ayah-quest-recovery-backup-v1", previous);
      storage.setItem(QUEST_KEY, raw);
      if (storage.getItem(QUEST_KEY) !== raw)
        throw Error(
          "Restore could not be saved. The recovery backup is preserved.",
        );
      warning = "";
      return structuredClone(parsed);
    },
    open(map) {
      return transact((d) => {
        campaign(map.campaignId);
        d.runs[map.id] ??= {
          id: map.id,
          campaignId: map.campaignId,
          game: map.game,
          routeVersion: map.routeVersion || 1,
          drafts: {},
          units: map.units || {},
          checkpointIds: map.checkpoints.map((c) => c.id),
          refs: [...new Set(map.checkpoints.map((c) => canonicalRef(c.key)))],
          revisions: map.checkpoints.map((c) => ({
            sourceHash: c.sourceHash,
            segmentHash: c.segmentHash,
          })),
          started: {},
          completed: {},
          unlocks: [],
        };
        const r = d.runs[map.id];
        checkMap(map, r);
        return r;
      });
    },
    start(map, checkpoint) {
      return transact((d) => {
        const r = d.runs[map.id];
        if (!r) throw Error("Open the map first");
        checkMap(map, r);
        if (nextCheckpoint(map, r)?.id !== checkpoint.id)
          throw Error("Checkpoint is locked or already complete");
        r.started[checkpoint.id] ??= new Date(clock()).toISOString();
        return r.started[checkpoint.id];
      });
    },
    saveDraft(map, checkpoint, draft) {
      return transact((d) => {
        const r = d.runs[map.id];
        checkMap(map, r);
        if (nextCheckpoint(map, r)?.id !== checkpoint.id)
          throw Error("Only the current workspace can be saved.");
        r.drafts ??= {};
        r.drafts[checkpoint.id] = structuredClone(draft);
        return draft;
      });
    },
    complete(
      map,
      checkpoint,
      { xp = 0, evidence, mistakes = 0, motorErrors = 0, assistance = 0 },
    ) {
      return transact((d) => {
        const r = d.runs[map.id];
        if (!r) throw Error("Open the map first");
        checkMap(map, r);
        if (r.completed[checkpoint.id])
          return { ...r.completed[checkpoint.id], duplicate: true };
        if (
          nextCheckpoint(map, r)?.id !== checkpoint.id ||
          !r.started[checkpoint.id]
        )
          throw Error("Checkpoint is not active");
        const result = {
          at: new Date(clock()).toISOString(),
          xp,
          evidence,
          mistakes,
          motorErrors,
          assistance,
        };
        if (
          !Number.isInteger(xp) ||
          xp < 0 ||
          xp > 80 ||
          !["practice", "arcade", "self-assessed"].includes(evidence) ||
          ![mistakes, motorErrors, assistance].every(
            (n) => Number.isInteger(n) && n >= 0,
          )
        )
          throw Error("Invalid checkpoint result");
        r.completed[checkpoint.id] = result;
        r.unlocks.push(checkpoint.id);
        return result;
      });
    },
  };
}
