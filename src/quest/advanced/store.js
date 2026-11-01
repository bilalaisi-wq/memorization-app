import { canonicalRef } from "../checkpoints.js";
import { modes, savedRevisionAssessment } from "./model.js";
export const REVISION_KEY = "ayah-quest-revision-v1";
const digest = /^(quest|campaign):[a-f0-9]{64}$/;
export function validRevision(data, owner) {
  try {
    if (
      data?.version !== 1 ||
      data.owner !== owner ||
      !data.runs ||
      typeof data.runs !== "object" ||
      Array.isArray(data.runs) ||
      !Array.isArray(data.consumed)
    )
      return false;
    if (
      !data.consumed.every((x) => typeof x === "string") ||
      new Set(data.consumed).size !== data.consumed.length
    )
      return false;
    return Object.entries(data.runs).every(([id, r]) => {
      const p = r.plan;
      if (
        r.id !== id ||
        !p ||
        p.version !== 1 ||
        !["boss", "survival"].includes(p.mode) ||
        p.campaignId !== modes[p.mode] ||
        !digest.test(p.id) ||
        !["beginner", "standard", "expert"].includes(p.preset) ||
        !["classic", "practice"].includes(p.rules) ||
        !Array.isArray(p.checkpoints) ||
        !p.checkpoints.length ||
        p.checkpoints.length > 10 ||
        !p.pins ||
        !["playing", "camp", "paused", "won", "lost", "ended"].includes(
          r.status,
        )
      )
        return false;
      if (
        p.mode === "boss" &&
        (p.checkpoints.length !== 5 ||
          p.checkpoints.map((c) => c.kind).join("|") !==
            "recall|recall|discrimination|recall|recall" ||
          p.checkpoints[4].requireIndependent !== true)
      )
        return false;
      if (
        !Object.entries(p.pins).every(
          ([key, pin]) =>
            canonicalRef(key) === key &&
            /^[a-f0-9]{64}$/.test(pin.sourceHash) &&
            /^[a-f0-9]{64}$/.test(pin.segmentHash),
        )
      )
        return false;
      if (
        !p.checkpoints.every(
          (c) =>
            digest.test(c.id) &&
            typeof c.title === "string" &&
            (c.kind === "discrimination"
              ? Array.isArray(c.choices) &&
                c.choices.includes(c.target) &&
                c.choices.every((k) => p.pins[k])
              : c.kind === "recall" &&
                typeof c.unit?.id === "string" &&
                ["ayah", "segment", "passage"].includes(c.unit.type) &&
                Array.isArray(c.unit.refs) &&
                c.unit.refs.length > 0 &&
                c.unit.refs.every((k) => p.pins[k])),
        )
      )
        return false;
      return (
        Number.isInteger(r.cursor) &&
        r.cursor >= 0 &&
        r.cursor <= p.checkpoints.length &&
        Number.isInteger(r.charges) &&
        r.charges >= 0 &&
        r.charges <= 3 &&
        Number.isInteger(r.campCursor) &&
        r.campCursor >= 0 &&
        r.campCursor <= r.cursor &&
        typeof r.assisted === "boolean" &&
        typeof r.choiceLocked === "boolean" &&
        Number.isInteger(r.supportUses) &&
        r.supportUses >= 0 &&
        Array.isArray(r.results) &&
        r.results.every(
          (x) =>
            digest.test(x.checkpointId) &&
            ["recall", "discrimination"].includes(x.kind) &&
            Number.isFinite(Date.parse(x.at)) &&
            (x.kind === "recall"
              ? typeof x.attemptId === "string" &&
                data.consumed.includes(x.attemptId) &&
                ["Again", "Hard", "Good", "Easy"].includes(x.grade) &&
                typeof x.independent === "boolean" &&
                typeof x.scheduled === "boolean"
              : typeof x.correct === "boolean"),
        ) &&
        (!r.pending ||
          (r.pending.checkpointId === p.checkpoints[r.cursor]?.id &&
            r.pending.unitId === p.checkpoints[r.cursor]?.unit?.id &&
            Number.isFinite(Date.parse(r.pending.at)))) &&
        Number.isFinite(Date.parse(r.updatedAt))
      );
    });
  } catch {
    return false;
  }
}
export function createRevisionStore({
  storage,
  owner = null,
  getOwner,
  clock = () => new Date(),
}) {
  if (typeof getOwner !== "function")
    throw Error("Live account guard required.");
  const guard = () => {
    if (getOwner() !== owner) throw Error("Account changed. Reopen revision.");
  };
  function read() {
    guard();
    const raw = storage.getItem(REVISION_KEY);
    if (raw === null) return { version: 1, owner, runs: {}, consumed: [] };
    try {
      const d = JSON.parse(raw);
      if (!validRevision(d, owner)) throw Error();
      return d;
    } catch {
      throw Error(
        "Saved advanced revision data needs recovery. It has not been overwritten.",
      );
    }
  }
  function write(fn) {
    const d = read(),
      result = fn(d);
    guard();
    if (!validRevision(d, owner))
      throw Error("Invalid revision state. Existing records are unchanged.");
    const raw = JSON.stringify(d);
    storage.setItem(REVISION_KEY, raw);
    if (storage.getItem(REVISION_KEY) !== raw)
      throw Error("Revision save failed. Retry applying the saved assessment.");
    return structuredClone(result);
  }
  function change(id, fn) {
    return write((d) => {
      const r = d.runs[id];
      if (!r) throw Error("Unknown revision run.");
      const result = fn(r, d);
      r.updatedAt = new Date(clock()).toISOString();
      return result || r;
    });
  }
  function playable(r) {
    if (r.status !== "playing") throw Error("Resume the active route first.");
  }
  function advance(r) {
    r.cursor++;
    r.assisted = false;
    r.choiceLocked = false;
    r.pending = null;
    if (r.charges === 0) r.status = "lost";
    else if (r.cursor === r.plan.checkpoints.length) r.status = "won";
    else if (r.plan.mode === "survival" && r.cursor % 3 === 0)
      r.status = "camp";
  }
  return {
    snapshot: () => structuredClone(read()),
    exportRaw: () => {
      guard();
      return storage.getItem(REVISION_KEY);
    },
    create(plan) {
      return write((d) => {
        const id = crypto.randomUUID(),
          at = new Date(clock()).toISOString();
        const r = {
          id,
          plan: structuredClone(plan),
          status: "playing",
          cursor: 0,
          charges: 3,
          campCursor: 0,
          assisted: false,
          supportUses: 0,
          choiceLocked: false,
          pending: null,
          results: [],
          updatedAt: at,
        };
        d.runs[id] = r;
        return r;
      });
    },
    assist: (id) =>
      change(id, (r) => {
        if (!["playing", "camp"].includes(r.status))
          throw Error("Resume before using support.");
        r.assisted = true;
        r.supportUses++;
      }),
    fresh: (id) =>
      change(id, (r) => {
        playable(r);
        if (r.pending)
          throw Error("Finish the pending assessment before starting fresh.");
        r.assisted = false;
      }),
    begin: (id) =>
      change(id, (r) => {
        playable(r);
        const c = r.plan.checkpoints[r.cursor];
        if (c.kind !== "recall")
          throw Error("This gate uses observed text discrimination.");
        r.pending ??= {
          checkpointId: c.id,
          unitId: c.unit.id,
          at: new Date(clock()).toISOString(),
        };
      }),
    apply(id, document) {
      return change(id, (r, d) => {
        playable(r);
        const h = savedRevisionAssessment(document, r);
        if (d.consumed.includes(h.attemptId))
          throw Error("This assessment has already been applied.");
        const c = r.plan.checkpoints[r.cursor];
        r.results.push({ ...h, kind: "recall", checkpointId: c.id });
        d.consumed.push(h.attemptId);
        r.pending = null;
        if (h.grade === "Again") r.charges--;
        if (r.plan.mode === "survival") advance(r);
        else if (
          h.grade !== "Again" &&
          (!c.requireIndependent || h.independent)
        )
          advance(r);
        else if (r.charges === 0) r.status = "lost";
      });
    },
    choose: (id, key) =>
      change(id, (r) => {
        playable(r);
        const c = r.plan.checkpoints[r.cursor];
        if (
          c.kind !== "discrimination" ||
          r.choiceLocked ||
          !c.choices.includes(key)
        )
          throw Error("Choose an available verified option.");
        const correct = key === c.target;
        r.results.push({
          kind: "discrimination",
          checkpointId: c.id,
          key,
          correct,
          assisted: r.assisted,
          at: new Date(clock()).toISOString(),
        });
        if (correct) advance(r);
        else {
          r.charges--;
          r.choiceLocked = true;
          if (r.charges === 0) r.status = "lost";
        }
      }),
    unlock: (id) =>
      change(id, (r) => {
        playable(r);
        r.choiceLocked = false;
      }),
    camp: (id) =>
      change(id, (r) => {
        if (r.status !== "camp") throw Error("Reach a campsite first.");
        if (r.plan.rules === "practice") r.charges = 3;
        r.campCursor = r.cursor;
        r.status = "playing";
        r.assisted = false;
      }),
    pause: (id) =>
      change(id, (r) => {
        if (!["playing", "camp"].includes(r.status))
          throw Error("This run cannot be paused.");
        r.resumeStatus = r.status;
        r.status = "paused";
      }),
    resume: (id) =>
      change(id, (r) => {
        if (r.status !== "paused") throw Error("This run is not resting.");
        r.status = r.resumeStatus || "playing";
        delete r.resumeStatus;
      }),
    end: (id) =>
      change(id, (r) => {
        if (!["playing", "camp", "paused"].includes(r.status))
          throw Error("This run has already ended.");
        r.status = "ended";
        r.pending = null;
      }),
    retry: (id) =>
      change(id, (r) => {
        if (r.status !== "lost")
          throw Error("Retry is available after game over.");
        r.cursor =
          r.plan.rules === "classic"
            ? 0
            : r.plan.mode === "boss"
              ? r.cursor
              : r.campCursor;
        r.status = "playing";
        r.charges = 3;
        r.pending = null;
        r.assisted = false;
        r.choiceLocked = false;
        if (r.plan.rules === "classic") r.campCursor = 0;
      }),
  };
}
