import { test, expect } from "@playwright/test";
import { CloudProgress } from "../src/learner/cloud-progress.js";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};
function service() {
  let row = null,
    offline = false;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            offline
              ? { error: new Error("offline") }
              : { data: structuredClone(row), error: null },
        }),
      }),
    }),
    rpc: async (name, args) => {
      if (offline) return { error: new Error("offline") };
      if (args.profile_id !== "user-a") return { error: { code: "42501" } };
      if (args.expected_revision !== (row?.revision || 0))
        return { error: { code: "40001" } };
      row = {
        payload: structuredClone(args.document),
        revision: (row?.revision || 0) + 1,
      };
      return { data: row.revision, error: null };
    },
  };
  return {
    client,
    get row() {
      return row;
    },
    set offline(value) {
      offline = value;
    },
  };
}
test("new devices restore private progress and enabled sync saves later changes without recordings", async () => {
  const api = service(),
    a = storage(),
    first = new CloudProgress(api.client, "user-a", a);
  await first.initialize();
  a.setItem("ayah-goals-v1", '{"targets":[114]}');
  await first.setEnabled(true);
  expect(api.row.revision).toBe(1);
  const b = storage(),
    second = new CloudProgress(api.client, "user-a", b);
  await second.initialize();
  expect(b.getItem("ayah-goals-v1")).toContain("114");
  expect(second.enabled).toBe(false);
  a.setItem("ayah-activity-v1", '{"version":1}');
  await first.save();
  expect(api.row.revision).toBe(2);
  expect(Object.keys(api.row.payload)).toEqual([
    "ayah-goals-v1",
    "ayah-activity-v1",
  ]);
  first.dispose();
  second.dispose();
});
test("concurrent devices cannot silently overwrite progress and resolution is explicit", async () => {
  const api = service(),
    a = storage(),
    first = new CloudProgress(api.client, "user-a", a);
  await first.initialize();
  a.setItem("ayah-goals-v1", "original");
  await first.save();
  const b = storage(),
    second = new CloudProgress(api.client, "user-a", b);
  await second.initialize();
  a.setItem("ayah-goals-v1", "device A");
  await first.save();
  b.setItem("ayah-goals-v1", "device B");
  await expect(second.save()).rejects.toMatchObject({ code: "40001" });
  expect(api.row.payload["ayah-goals-v1"]).toBe("device A");
  expect(b.getItem("ayah-goals-v1")).toBe("device B");
  await second.save({ replace: true });
  expect(api.row.payload["ayah-goals-v1"]).toBe("device B");
  first.dispose();
  second.dispose();
});
test("offline changes are preserved and a returning device loads newer cloud data if locally unchanged", async () => {
  const api = service(),
    a = storage(),
    first = new CloudProgress(api.client, "user-a", a);
  await first.initialize();
  a.setItem("ayah-goals-v1", "original");
  await first.save();
  const b = storage(),
    second = new CloudProgress(api.client, "user-a", b);
  await second.initialize();
  b.setItem("ayah-goals-v1", "new remote");
  await second.save();
  const returning = new CloudProgress(api.client, "user-a", a);
  await returning.initialize();
  expect(a.getItem("ayah-goals-v1")).toBe("new remote");
  api.offline = true;
  a.setItem("ayah-goals-v1", "offline work");
  await expect(returning.save()).rejects.toThrow();
  expect(a.getItem("ayah-goals-v1")).toBe("offline work");
  expect(returning.status).toContain("safe");
  first.dispose();
  second.dispose();
  returning.dispose();
});
test("ambiguous local and remote copies block automatic saving; disposed sessions cannot save", async () => {
  const api = service(),
    a = storage(),
    first = new CloudProgress(api.client, "user-a", a);
  await first.initialize();
  a.setItem("ayah-goals-v1", "cloud");
  await first.save();
  const b = storage();
  b.setItem("ayah-goals-v1", "unrelated local");
  const second = new CloudProgress(api.client, "user-a", b);
  await second.initialize();
  expect(second.conflict).toBe(true);
  await expect(second.save()).rejects.toThrow(/difference/);
  expect(b.getItem("ayah-goals-v1")).toBe("unrelated local");
  second.dispose();
  await second.save({ replace: true });
  expect(api.row.payload["ayah-goals-v1"]).toBe("cloud");
  first.dispose();
});
