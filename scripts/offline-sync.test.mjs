import { test } from "node:test";
import assert from "node:assert/strict";
import { CloudProgress, SYNC_KEY } from "../src/learner/cloud-progress.js";
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
const online = globalThis.navigator;
function network(value) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: value },
  });
}
function api() {
  let row = null, calls = 0;
  return {
    get row() {
      return row;
    },
    get calls() {
      return calls;
    },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: structuredClone(row) }),
          }),
        }),
      }),
      rpc: async (_name, args) => {
        calls++;
        if (args.profile_id !== "a") return { error: { code: "42501" } };
        if (args.expected_revision !== (row?.revision || 0)) {
          return { error: { code: "40001" } };
        }
        row = {
          revision: (row?.revision || 0) + 1,
          payload: structuredClone(args.document),
        };
        return { data: row.revision };
      },
    },
  };
}
test("offline account edits queue durably across reload, resume through existing CAS and never alter FSRS", async () => {
  try {
    network(true);
    const s = memory(), a = api(), c = new CloudProgress(a.client, "a", s);
    await c.initialize();
    s.setItem("ayah-learning-v1", '{"FSRS":"UNCHANGED"}');
    await c.setEnabled(true);
    network(false);
    s.setItem("ayah-activity-v1", '{"offline":1}');
    c.changed();
    assert.equal(JSON.parse(s.getItem(SYNC_KEY)).pendingSync, true);
    c.dispose();
    const resumed = new CloudProgress(a.client, "a", s);
    await resumed.initialize();
    assert.equal(resumed.conflict, false);
    assert.equal(resumed.needsRefresh, true);
    network(true);
    await resumed.initialize();
    assert.equal(a.row.payload["ayah-activity-v1"], '{"offline":1}');
    assert.equal(a.row.payload["ayah-learning-v1"], '{"FSRS":"UNCHANGED"}');
    assert.equal(resumed.pendingSync, false);
    const revision = a.row.revision;
    await resumed.initialize();
    assert.equal(a.row.revision, revision);
    resumed.dispose();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: online,
    });
  }
});
test("offline edits on both devices preserve both copies and require explicit conflict resolution", async () => {
  try {
    network(true);
    const a = api(), s1 = memory(), one = new CloudProgress(a.client, "a", s1);
    await one.initialize();
    s1.setItem("ayah-goals-v1", "original");
    await one.setEnabled(true);
    const s2 = memory(), two = new CloudProgress(a.client, "a", s2);
    await two.initialize();
    s2.setItem("ayah-goals-v1", "other device");
    await two.save();
    network(false);
    s1.setItem("ayah-goals-v1", "offline learner");
    one.changed();
    network(true);
    await one.initialize();
    assert.equal(one.conflict, true);
    assert.equal(s1.getItem("ayah-goals-v1"), "offline learner");
    assert.equal(a.row.payload["ayah-goals-v1"], "other device");
    await assert.rejects(one.save(), /difference/);
    one.dispose();
    two.dispose();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: online,
    });
  }
});
test("guest or disabled automatic sync never queues an upload without consent", () => {
  try {
    network(false);
    const s = memory(), a = api(), c = new CloudProgress(a.client, "a", s);
    s.setItem("ayah-goals-v1", "guest-like local");
    c.changed();
    assert.equal(a.calls, 0);
    assert.equal(c.pendingSync, false);
    c.dispose();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: online,
    });
  }
});
test('queue metadata storage failure cannot turn a saved learning update into a thrown listener error',()=>{try{network(false);const s=memory(),a=api(),c=new CloudProgress(a.client,'a',s);c.enabled=true;s.setItem('ayah-goals-v1','SAVED_LEARNING');const put=s.setItem;s.setItem=(k,v)=>{if(k===SYNC_KEY)throw Error('Quota exceeded');put(k,v);};assert.doesNotThrow(()=>c.changed());assert.equal(s.getItem('ayah-goals-v1'),'SAVED_LEARNING');assert.match(c.status,/saved locally/);c.dispose();}finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:online});}});
