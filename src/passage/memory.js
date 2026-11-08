import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";
import { dayKey, FSRS_SETTINGS } from "../learning-store.js";
const scheduler = fsrs(FSRS_SETTINGS);
export const PASSAGE_MEMORY_KEY = "ayah-passage-recall-v1";
const BASE = "ayah-passage-sync-v1";
const clone = (x) => JSON.parse(JSON.stringify(x));
export function validMemory(data) {
  return data?.version === 1 && data.records &&
    typeof data.records === "object" && !Array.isArray(data.records) &&
    Object.entries(data.records).every(([key, r]) =>
      r.unit?.id === key &&
      ["ayah", "segment", "passage"].includes(r.unit.type) &&
      Array.isArray(r.unit.refs) && r.unit.refs.length > 0 &&
      r.unit.refs.every((k) => /^\d+:\d+$/.test(k)) &&
      Array.isArray(r.history) && Array.isArray(r.successfulDays) &&
      (!r.card ||
        (Number.isFinite(r.card.stability) &&
          Number.isFinite(r.card.difficulty) &&
          Number.isFinite(Date.parse(r.card.due)) &&
          [0, 1, 2, 3].includes(r.card.state)))
    ) &&
    (!data.active ||
      (typeof data.active.id === "string" && data.records[data.active.unitId] &&
        typeof data.active.declared === "boolean" &&
        typeof data.active.assisted === "boolean" &&
        typeof data.active.compared === "boolean"));
}
export function createPassageMemory(
  storage,
  {
    clock = () => new Date(),
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  } = {},
) {
  let data = { version: 1, timeZone, records: {}, active: null }, warning = "";
  const raw = storage.getItem(PASSAGE_MEMORY_KEY);
  let lastRaw=raw;
  if (raw !== null) {
    try {
      const value = JSON.parse(raw);
      if (!validMemory(value)) throw Error();
      data = value;
    } catch {
      warning =
        "Saved passage reviews need recovery. They have not been overwritten.";
    }
  }
  const save = (fn) => {
    if (warning) throw Error(warning);
    if(storage.getItem(PASSAGE_MEMORY_KEY)!==lastRaw)throw Error("Passage reviews changed in another surface. Reopen the assessment before saving; existing history is preserved.");
    const next = clone(data), result = fn(next);
    storage.setItem(PASSAGE_MEMORY_KEY, JSON.stringify(next));
    if (storage.getItem(PASSAGE_MEMORY_KEY) !== JSON.stringify(next)) {
      throw Error("Passage review could not be saved. Retry or export.");
    }
    data = next;lastRaw=JSON.stringify(next);
    return clone(result ?? next);
  };
  return {
    get warning() {
      return warning;
    },
    snapshot: () => clone(data),
    exportRaw: () => storage.getItem(PASSAGE_MEMORY_KEY),
    begin(unit, { assisted = false } = {}) {
      return save((d) => {
        d.records[unit.id] ??= {
          unit: clone(unit),
          card: null,
          history: [],
          successfulDays: [],
        };
        d.active = {
          id: crypto.randomUUID(),
          unitId: unit.id,
          declared: false,
          assisted: assisted === true,
          compared: false,
        };
        return d.active;
      });
    },
    update(flag, evidence = null) {
      return save((d) => {
        if (!d.active) throw Error("Start a recall first.");
        if(flag === "anchor"){d.active.assisted=true;d.active.anchorIds=Array.isArray(evidence)?evidence.filter(id=>typeof id==='string').slice(0,100):[];}
        if (flag === "abandon") d.active.assisted = true;
        else if (flag === "declared") d.active.declared = true;
        else if (flag === "compared") {
          if (!d.active.declared) d.active.assisted = true;
          d.active.compared = true;
        } else if (flag === "assisted" && !d.active.declared) {
          d.active.assisted = true;
        }
        return d.active;
      });
    },
    cancel(attemptId) {
      return save(d=>{if(!d.active||d.active.id!==attemptId||d.active.graded)throw Error("No matching unfinished assessment.");const unitId=d.active.unitId;d.active=null;return {attemptId,unitId,cancelled:true};});
    },
    grade(attemptId, grade, {assessmentSource} = {}) {
      return save((d) => {
        const a = d.active;
        if (!a || a.id !== attemptId || !a.compared) {
          throw Error("Compare your recitation before grading.");
        }
        if (a.graded) return a.result;
        if (!["Again", "Hard", "Good", "Easy"].includes(grade)) {
          throw Error("Invalid grade");
        }
        const r = d.records[a.unitId],
          now = new Date(clock()),
          independent = a.declared && !a.assisted,
          eligible = independent &&
            (!r.card || Date.parse(r.card.due) <= now.getTime() ||
              grade === "Again");
        if (eligible) {
          const card = r.card
            ? {
              ...r.card,
              due: new Date(r.card.due),
              last_review: r.card.last_review
                ? new Date(r.card.last_review)
                : undefined,
            }
            : createEmptyCard(now);
          r.card = clone(scheduler.next(card, now, Rating[grade]).card);
          if (
            grade !== "Again" &&
            !r.successfulDays.includes(dayKey(now, data.timeZone || timeZone))
          ) r.successfulDays.push(dayKey(now, data.timeZone || timeZone));
        }
        const result = {
          grade,
          ...(assessmentSource === "self-assessed" ? {assessmentSource} : {}),
          independent,
          ...(a.anchorIds?{anchorIds:clone(a.anchorIds)}:{}),
          scheduled: eligible,
          nextReview: r.card?.due || null,
          stage: r.successfulDays.length >= 3 && r.card?.state === State.Review
            ? "retained"
            : r.card
            ? "reviewing"
            : "studying",
        };
        r.history.push({ at: now.toISOString(), attemptId, ...result });
        a.graded = true;
        a.result = result;
        return result;
      });
    },
    async sync(client, userId) {
      if (warning) throw Error(warning);
      if (!client || !userId) {
        throw Error(
          "Sign in to sync private passage reviews. Local reviews remain saved.",
        );
      }
      const originalRaw=storage.getItem(PASSAGE_MEMORY_KEY);
      if(originalRaw!==lastRaw)throw Error("Passage reviews changed. Reopen before syncing; history was preserved.");
      const { data: remote, error } = await client.from("passage_learning")
        .select("document,revision").eq("user_id", userId).maybeSingle();
      if(storage.getItem(PASSAGE_MEMORY_KEY)!==originalRaw)throw Error("Passage reviews changed during sync. Local data was preserved; retry.");
      if (error) {
        throw Error(
          "Passage review sync is unavailable; local reviews are unchanged.",
        );
      }
      let base = { revision: 0, json: null };
      try {
        base = JSON.parse(storage.getItem(BASE)) || base;
      } catch {}
      const local = JSON.stringify(data),
        empty = !Object.keys(data.records).length && !data.active;
      const canonical=value=>JSON.stringify((function ordered(v){return Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;})(value));
      if(remote&&validMemory(remote.document)&&canonical(remote.document)===canonical(data)){
        storage.setItem(BASE,JSON.stringify({revision:remote.revision,json:local}));
        return "Passage reviews are up to date.";
      }
      if (remote && remote.revision !== base.revision) {
        if (!empty && local !== base.json) {
          throw Error(
            "Another device changed passage reviews. Export both copies before restoring; nothing was overwritten.",
          );
        }
        if (!validMemory(remote.document)) {
          throw Error("Cloud passage data needs recovery.");
        }
        if(data.active&&!data.active.graded)throw Error("An unfinished passage attempt is open. Finish or cancel it before restoring another device’s review history.");
        storage.setItem(PASSAGE_MEMORY_KEY, JSON.stringify(remote.document));lastRaw=JSON.stringify(remote.document);
        data = clone(remote.document);
        storage.setItem(
          BASE,
          JSON.stringify({
            revision: remote.revision,
            json: JSON.stringify(data),
          }),
        );
        return "Private passage reviews restored.";
      }
      if (local === base.json) return "Passage reviews are up to date.";
      const result = await client.rpc("save_my_passage_learning", {
        expected_revision: remote?.revision || 0,
        document: data,
      });
      if (result.error) {
        throw Error(
          "Passage sync conflict or unavailable. Local reviews are unchanged; export before restoring.",
        );
      }
      storage.setItem(
        BASE,
        JSON.stringify({ revision: result.data, json: local }),
      );
      return "Private passage reviews saved.";
    },
  };
}
