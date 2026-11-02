import { test, expect } from "@playwright/test";
import { CloudProgress } from "../src/learner/cloud-progress.js";
const storage = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
test("interrupted multi-key cloud restore preserves the complete original device copy", () => {
  const s = storage();
  s.setItem("ayah-goals-v1", "original goals");
  s.setItem("ayah-activity-v1", "original activity");
  const set = s.setItem;
  s.setItem = (k, v) => {
    if (k === "ayah-activity-v1" && v === "cloud activity")
      throw Error("storage full");
    set(k, v);
  };
  const c = new CloudProgress({}, "A", s);
  expect(() =>
    c.apply({
      "ayah-goals-v1": "cloud goals",
      "ayah-activity-v1": "cloud activity",
    }),
  ).toThrow();
  expect(s.getItem("ayah-goals-v1")).toBe("original goals");
  expect(s.getItem("ayah-activity-v1")).toBe("original activity");
});

test("durable pending recovery retains both copies even when rollback cannot write, and another owner cannot recover it", () => {
  const s = storage();
  s.setItem("ayah-goals-v1", "original goals");
  s.setItem("ayah-activity-v1", "original activity");
  const set = s.setItem;
  let damaged = false;
  s.setItem = (k, v) => {
    if (k === "ayah-activity-v1" && v === "cloud activity") {
      damaged = true;
      throw Error("quota");
    }
    if (damaged && k === "ayah-goals-v1" && v === "original goals")
      throw Error("quota");
    set(k, v);
  };
  const c = new CloudProgress({}, "A", s);
  expect(() =>
    c.apply({
      "ayah-goals-v1": "cloud goals",
      "ayah-activity-v1": "cloud activity",
    }),
  ).toThrow("preserved");
  const backup = JSON.parse(s.getItem("ayah-cloud-restore-backup-v1"));
  expect(backup.state).toBe("pending");
  expect(backup.original["ayah-goals-v1"]).toBe("original goals");
  expect(backup.incoming["ayah-activity-v1"]).toBe("cloud activity");
  expect(() => c.apply({})).toThrow("unfinished");
  expect(() => new CloudProgress({}, "B", s).recover()).toThrow(
    "nothing was overwritten",
  );
  s.setItem = set;
  c.recover();
  expect(s.getItem("ayah-goals-v1")).toBe("original goals");
  expect(s.getItem("ayah-activity-v1")).toBe("original activity");
  expect(c.enabled).toBe(false);
  expect(c.conflict).toBe(true);
});
test("a failed backup write cannot begin a destructive cloud restore", () => {
  const s = storage();
  s.setItem("ayah-goals-v1", "precious");
  s.setItem = () => {
    throw Error("full");
  };
  expect(() => new CloudProgress({}, "A", s).apply({})).toThrow("full");
  expect(s.getItem("ayah-goals-v1")).toBe("precious");
});
test("unsupported sync metadata is preserved and blocks automatic restoration", async () => {
  const s = storage(),
    raw = '{"version":999,"precious":"marker"}';
  s.setItem("ayah-cloud-sync-v1", raw);
  let requests = 0;
  const c = new CloudProgress(
    {
      from: () => {
        requests++;
        throw Error("must not call");
      },
    },
    "A",
    s,
  );
  await c.initialize();
  expect(requests).toBe(0);
  expect(c.conflict).toBe(true);
  expect(c.status).toContain("not been overwritten");
  expect(s.getItem("ayah-cloud-sync-v1")).toBe(raw);
});

test("setting aside an attempt preserves its unit history/card and creates no recall event", async () => {
  const { createPassageMemory, PASSAGE_MEMORY_KEY } =
    await import("../src/passage/memory.js");
  const s = storage(),
    memory = createPassageMemory(s),
    unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  let a = memory.begin(unit);
  memory.update("declared");
  memory.update("compared");
  memory.grade(a.id, "Good", { assessmentSource: "self-assessed" });
  const before = memory.snapshot().records;
  a = memory.begin(unit);
  memory.cancel(a.id);
  expect(memory.snapshot().records).toEqual(before);
  expect(memory.snapshot().active).toBeNull();
  expect(() => memory.cancel(a.id)).toThrow("unfinished");
});
test("legacy non-independent Again records do not become confirmed self-reported failures", async () => {
  const { repairAnalysis } = await import("../src/quest/repair/model.js");
  const unit = { id: "ayah:1:1", type: "ayah", refs: ["1:1"] };
  const a = repairAnalysis({
    memory: {
      records: {
        [unit.id]: {
          unit,
          history: [{ attemptId: "old", grade: "Again", independent: false }],
        },
      },
    },
  });
  const evidence = a.recommendations.find(
    (r) => r.category === "review-difficulty",
  ).evidence[0];
  expect(evidence.source).toBe("legacy-recall-record");
  expect(evidence.detail).toContain("cannot establish");
});
