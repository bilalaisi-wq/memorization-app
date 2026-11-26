import { versionedStore } from "../../ui/versioned-store.js";
import { validateRefs } from "../../passage-context/model.js";
import { TOWERS, SITES } from "./defense.js";
import { placementCheck } from "./defense-maps.js";
export const ADVENTURE_KEY = "ayah-flow-adventures-v1";
const integer = (n, max = 1e9) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const number = (n) => Number.isFinite(n) && Math.abs(n) <= 1e9;
export function validArcade(game, a) {
  if (a === null) return true;
  if (!a || typeof a !== "object") return false;
  if (
    a.version !== undefined &&
    ![1, game === "surah-rush" ? 3 : 2].includes(a.version)
  )
    return false;
  if (game === "ayah-defense" && a.version === 2)
    return (
      [
        "time",
        "coins",
        "energy",
        "core",
        "shield",
        "score",
        "totalEarned",
        "nextEnemyId",
        "nextTowerId",
      ].every((k) => number(a[k]) && a[k] >= 0) &&
      integer(a.map, 3) &&
      integer(a.region, 4) &&
      Array.isArray(a.towers) &&
      a.towers.length <= 24 &&
      new Set(a.towers.map((t) => t.id)).size === a.towers.length &&
      a.towers.every(
        (t) =>
          Object.hasOwn(TOWERS, t.kind) &&
          integer(t.id) &&
          t.id > 0 &&
          integer(t.level, 3) &&
          t.level > 0 &&
          number(t.x) &&
          number(t.y) &&
          placementCheck(a.map, t, a.towers, t.id).valid &&
          number(t.paidCost) &&
          number(t.upgradeSpend) &&
          ["first", "last", "strongest", "nearest"].includes(t.targeting)
      ) &&
      Array.isArray(a.accepted) &&
      a.accepted.length <= 20000 &&
      a.accepted.every((v) => typeof v === "string" && v.length < 100) &&
      a.earnedByRef &&
      Object.entries(a.earnedByRef).every(
        ([k, n]) => /^\d+:\d+$/.test(k) && integer(n, 100)
      ) &&
      a.cooldowns &&
      ["shield", "frost", "overcharge"].every(
        (k) => number(a.cooldowns[k]) && a.cooldowns[k] >= 0
      )
    );
  if (game === "ayah-defense")
    return (
      ["time", "coins", "energy", "core", "shield", "score"].every((k) =>
        number(a[k])
      ) &&
      Array.isArray(a.towers) &&
      a.towers.length <= 6 &&
      new Set(a.towers.map((t) => t.site)).size === a.towers.length &&
      a.towers.every(
        (t) =>
          Object.hasOwn(TOWERS, t.kind) &&
          integer(t.site, 5) &&
          t.x === SITES[t.site].x &&
          t.y === SITES[t.site].y &&
          integer(t.level, 3) &&
          t.level >= 1 &&
          number(t.charge) &&
          typeof t.active === "boolean"
      ) &&
      Array.isArray(a.queue) &&
      a.queue.length <= 6 &&
      a.queue.every((v) => integer(v, 5)) &&
      Array.isArray(a.accepted) &&
      a.accepted.length <= 1000 &&
      a.accepted.every((v) => typeof v === "string" && v.length < 100) &&
      integer(a.region, 4) &&
      a.cooldowns &&
      ["shield", "frost", "overcharge"].every((k) => number(a.cooldowns[k]))
    );
  if (game === "surah-rush" && a.version === 3) {
    const unit = (v) =>
      v === null ||
      (typeof v?.id === "string" &&
        v.id.length < 100 &&
        [2, 3].includes(v.count) &&
        integer(v.length, 100));
    return (
      [
        "x",
        "y",
        "vx",
        "vy",
        "time",
        "distance",
        "flow",
        "score",
        "camera",
        "cameraY",
      ].every((k) => number(a[k])) &&
      integer(a.course, 100000) &&
      integer(a.motorErrors) &&
      integer(a.zone, 4) &&
      unit(a.challenge) &&
      unit(a.pendingChallenge) &&
      typeof a.resolved === "boolean" &&
      typeof a.checkpointPending === "boolean"
    );
  }
  return (
    ["x", "y", "vx", "vy", "time", "distance", "flow", "score"]
      .filter((k) => k !== "time")
      .every((k) => number(a[k])) &&
    integer(a.course) &&
    integer(a.motorErrors)
  );
}
export function validAdventure(r) {
  try {
    validateRefs(r.refs);
  } catch {
    return false;
  }
  return (
    ["ayah-defense", "surah-rush"].includes(r.game) &&
    ["guided", "standard", "expert"].includes(r.settings?.memory) &&
    ["relaxed", "normal", "arcade"].includes(r.settings?.motor) &&
    (r.settings.environment === undefined ||
      integer(r.settings.environment, 4)) &&
    (r.settings.fullSurah === undefined ||
      typeof r.settings.fullSurah === "boolean") &&
    (r.settings.checkpointInterval === undefined ||
      r.settings.checkpointInterval === 25) &&
    (r.settings.map === undefined || integer(r.settings.map, 3)) &&
    (r.settings.tourMaps === undefined ||
      typeof r.settings.tourMaps === "boolean") &&
    (r.finished === undefined || typeof r.finished === "boolean") &&
    (r.finished !== true || r.completed === r.refs.length) &&
    (!r.arcade?.final || r.completed === r.refs.length) &&
    integer(r.completed, r.refs.length) &&
    integer(r.assistance) &&
    (r.history === undefined ||
      (Array.isArray(r.history) && r.history.length <= 50)) &&
    integer(r.unit, 999) &&
    Array.isArray(r.accepted) &&
    r.accepted.length <= 1000 &&
    r.accepted.every(
      (v) => typeof v === "string" && /^\d+:\d+:\d+-\d+(?::review)?$/.test(v)
    ) &&
    r.pins &&
    typeof r.pins === "object" &&
    Object.entries(r.pins).every(
      ([key, p]) =>
        r.refs.includes(key) &&
        /^[a-f0-9]{64}$/.test(p?.source) &&
        /^[a-f0-9]{64}$/.test(p?.review)
    ) &&
    Array.isArray(r.evidence) &&
    r.evidence.length <= 300 &&
    r.evidence.every(
      (e) => ["motor", "memory"].includes(e.kind) && r.refs.includes(e.ref)
    ) &&
    (!r.pendingRewards ||
      (Array.isArray(r.pendingRewards) &&
        r.pendingRewards.every((k) => r.refs.includes(k)))) &&
    (!r.rushCheckpoint ||
      (r.game === "surah-rush" &&
        (r.rushCheckpoint.pending === null ||
          (integer(r.rushCheckpoint.pending, r.completed) &&
            r.rushCheckpoint.pending > 0 &&
            r.rushCheckpoint.pending === r.completed &&
            r.completed < r.refs.length &&
            r.completed % 25 === 0)) &&
        Array.isArray(r.rushCheckpoint.continued) &&
        new Set(r.rushCheckpoint.continued).size ===
          r.rushCheckpoint.continued.length &&
        r.rushCheckpoint.continued.every(
          (n) =>
            integer(n, r.completed) &&
            n > 0 &&
            n % 25 === 0 &&
            n !== r.rushCheckpoint.pending
        ))) &&
    validArcade(r.game, r.arcade)
  );
}
export function adventureStore(storage) {
  const store = versionedStore(
    storage,
    ADVENTURE_KEY,
    () => ({ version: 1, runs: {} }),
    (d) =>
      d?.version === 1 &&
      d.runs &&
      Object.entries(d.runs).every(
        ([id, r]) => /^[a-f0-9]{64}$/.test(id) && validAdventure(r)
      )
  );
  return {
    get warning() {
      return store.warning;
    },
    snapshot: () => store.snapshot(),
    transact(action) {
      return store.transact((next) => {
        const result = action(next);
        if (!Object.values(next.runs).every(validAdventure))
          throw new Error(
            "Invalid adventure update; existing progress was preserved."
          );
        return result;
      });
    },
  };
}
export function newAdventure(game, refs, settings) {
  validateRefs(refs);
  if (
    !["ayah-defense", "surah-rush"].includes(game) ||
    !["guided", "standard", "expert"].includes(settings?.memory) ||
    !["relaxed", "normal", "arcade"].includes(settings?.motor)
  )
    throw new Error("Unsupported adventure settings");
  return {
    game,
    refs: [...refs],
    settings: { ...settings },
    completed: 0,
    unit: 0,
    accepted: [],
    pins: {},
    evidence: [],
    assistance: 0,
    arcade: null,
    finished: false,
  };
}
